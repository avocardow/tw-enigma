/**
 * Interactive CLI Interface
 * Provides interactive command-line interface for dry run operations
 */

import { Logger } from '../utils/logger';
import { startDryRun, endDryRun, withDryRun } from './utils';
import { getDryRunReportGenerator } from './reportGenerator';
import { getVisualDiffGenerator } from './visualDiff';
import { getImpactEstimator } from './impactEstimator';
import { getOutputManager } from './outputManager';
import type { DryRunResult, DryRunConfig } from './dryRunManager';
import type { OutputConfig, OutputDestination, OutputFormat } from './outputManager';

export interface CLISession {
  /** Session ID */
  id: string;
  /** Session start time */
  startTime: number;
  /** Current step */
  currentStep: string;
  /** Session state */
  state: Record<string, any>;
  /** User preferences */
  preferences: CLIPreferences;
}

export interface CLIPreferences {
  /** Preferred output format */
  outputFormat: OutputFormat['type'];
  /** Preferred output destination */
  outputDestination: OutputDestination['type'];
  /** Show detailed progress */
  verbose: boolean;
  /** Use colors in output */
  useColors: boolean;
  /** Confirm destructive actions */
  confirmActions: boolean;
  /** Auto-save session state */
  autoSave: boolean;
}

export interface CLICommand {
  /** Command name */
  name: string;
  /** Command description */
  description: string;
  /** Command aliases */
  aliases: string[];
  /** Command handler */
  handler: (args: string[], session: CLISession) => Promise<void>;
  /** Command validation */
  validate?: (args: string[]) => string | null;
  /** Show in help */
  hidden?: boolean;
}

export interface CLIStep {
  /** Step name */
  name: string;
  /** Step description */
  description: string;
  /** Step prompt */
  prompt: string;
  /** Input validation */
  validate?: (input: string) => string | null;
  /** Input transformation */
  transform?: (input: string) => any;
  /** Skip condition */
  skip?: (session: CLISession) => boolean;
}

export class InteractiveCLI {
  private logger: Logger;
  private sessions = new Map<string, CLISession>();
  private currentSession: CLISession | null = null;
  private commands = new Map<string, CLICommand>();
  private readline: any; // Would import readline in real implementation

  constructor() {
    this.logger = new Logger({ component: 'InteractiveCLI' });
    this.initializeCommands();
  }

  /**
   * Start interactive session
   */
  async startSession(preferences: Partial<CLIPreferences> = {}): Promise<CLISession> {
    const session: CLISession = {
      id: this.generateSessionId(),
      startTime: Date.now(),
      currentStep: 'welcome',
      state: {},
      preferences: {
        outputFormat: 'html',
        outputDestination: 'file',
        verbose: false,
        useColors: true,
        confirmActions: true,
        autoSave: true,
        ...preferences,
      },
    };

    this.sessions.set(session.id, session);
    this.currentSession = session;

    this.logger.info('Started interactive CLI session', { sessionId: session.id });

    await this.showWelcome(session);
    return session;
  }

  /**
   * Run interactive dry run workflow
   */
  async runDryRunWorkflow(
    projectContext: {
      projectRoot: string;
      optimizationLevel: string;
      targetFramework?: string;
    }
  ): Promise<void> {
    if (!this.currentSession) {
      throw new Error('No active session. Call startSession() first.');
    }

    const session = this.currentSession;
    session.state.projectContext = projectContext;

    try {
      // Step 1: Configure dry run
      await this.configureDryRun(session);

      // Step 2: Execute dry run
      await this.executeDryRun(session);

      // Step 3: Generate reports
      await this.generateReports(session);

      // Step 4: Show visual diff
      await this.showVisualDiff(session);

      // Step 5: Analyze impact
      await this.analyzeImpact(session);

      // Step 6: Configure output
      await this.configureOutput(session);

      // Step 7: Export results
      await this.exportResults(session);

      // Step 8: Confirm or modify
      await this.confirmOrModify(session);

      await this.showCompletion(session);
    } catch (error) {
      await this.handleError(session, error);
    }
  }

  /**
   * Initialize CLI commands
   */
  private initializeCommands(): void {
    this.commands.set('help', {
      name: 'help',
      description: 'Show available commands',
      aliases: ['h', '?'],
      handler: this.handleHelp.bind(this),
    });

    this.commands.set('config', {
      name: 'config',
      description: 'Configure session preferences',
      aliases: ['cfg'],
      handler: this.handleConfig.bind(this),
    });

    this.commands.set('status', {
      name: 'status',
      description: 'Show current session status',
      aliases: ['st'],
      handler: this.handleStatus.bind(this),
    });

    this.commands.set('export', {
      name: 'export',
      description: 'Export current results',
      aliases: ['exp'],
      handler: this.handleExport.bind(this),
    });

    this.commands.set('diff', {
      name: 'diff',
      description: 'Show visual diff',
      aliases: ['d'],
      handler: this.handleDiff.bind(this),
    });

    this.commands.set('impact', {
      name: 'impact',
      description: 'Show impact analysis',
      aliases: ['imp'],
      handler: this.handleImpact.bind(this),
    });

    this.commands.set('reset', {
      name: 'reset',
      description: 'Reset current session',
      aliases: ['r'],
      handler: this.handleReset.bind(this),
    });

    this.commands.set('quit', {
      name: 'quit',
      description: 'Exit interactive mode',
      aliases: ['q', 'exit'],
      handler: this.handleQuit.bind(this),
    });
  }

  /**
   * Show welcome message
   */
  private async showWelcome(session: CLISession): Promise<void> {
    this.println(session, this.colorize('cyan', '╔══════════════════════════════════════════╗'));
    this.println(session, this.colorize('cyan', '║         TW-Enigma Dry Run Mode          ║'));
    this.println(session, this.colorize('cyan', '╚══════════════════════════════════════════╝'));
    this.println(session, '');
    this.println(session, 'Welcome to the interactive dry run interface!');
    this.println(session, 'This tool will guide you through simulating optimization changes safely.');
    this.println(session, '');
    this.println(session, this.colorize('yellow', 'Type "help" for available commands or press Enter to continue.'));
    this.println(session, '');
  }

  /**
   * Configure dry run settings
   */
  private async configureDryRun(session: CLISession): Promise<void> {
    session.currentStep = 'configure';
    
    this.println(session, this.colorize('blue', '📋 Step 1: Configure Dry Run'));
    this.println(session, '');

    // Ask for optimization level if not provided
    if (!session.state.projectContext.optimizationLevel) {
      const level = await this.prompt(session, {
        name: 'optimizationLevel',
        description: 'Select optimization level',
        prompt: 'Choose optimization level (basic|aggressive|extreme): ',
        validate: (input) => {
          if (!['basic', 'aggressive', 'extreme'].includes(input)) {
            return 'Please choose: basic, aggressive, or extreme';
          }
          return null;
        },
      });
      session.state.projectContext.optimizationLevel = level;
    }

    // Configure dry run options
    const enableValidation = await this.promptYesNo(
      session,
      'Enable operation validation? (recommended)',
      true
    );

    const includeFileSystemChecks = await this.promptYesNo(
      session,
      'Include file system checks?',
      true
    );

    const maxOperations = await this.prompt(session, {
      name: 'maxOperations',
      description: 'Maximum operations to track',
      prompt: 'Max operations to track (default: 10000): ',
      transform: (input) => input ? parseInt(input, 10) : 10000,
      validate: (input) => {
        const num = parseInt(input, 10);
        if (input && (isNaN(num) || num < 1)) {
          return 'Please enter a positive number';
        }
        return null;
      },
    });

    session.state.dryRunConfig = {
      enabled: true,
      logOperations: session.preferences.verbose,
      validateOperations: enableValidation,
      maxOperations,
      includeFileSystemChecks,
      simulateLatency: false,
      operationTimeout: 5000,
    } as DryRunConfig;

    this.println(session, this.colorize('green', '✅ Dry run configuration completed'));
    this.println(session, '');
  }

  /**
   * Execute dry run
   */
  private async executeDryRun(session: CLISession): Promise<void> {
    session.currentStep = 'execute';
    
    this.println(session, this.colorize('blue', '🚀 Step 2: Execute Dry Run'));
    this.println(session, '');

    this.showProgress(session, 'Starting dry run simulation...');

    try {
      const result = await withDryRun(
        session.state.projectContext,
        async () => {
          // Simulate some optimization operations
          await this.simulateOptimizationOperations(session);
          return 'Dry run completed successfully';
        },
        session.state.dryRunConfig
      );

      session.state.dryRunResult = result.dryRunResult;
      this.hideProgress(session);

      this.println(session, this.colorize('green', '✅ Dry run completed successfully'));
      this.println(session, `Operations simulated: ${result.dryRunResult.totalOperations}`);
      this.println(session, `Duration: ${Math.round(result.dryRunResult.duration)}ms`);
      this.println(session, '');
    } catch (error) {
      this.hideProgress(session);
      throw error;
    }
  }

  /**
   * Generate reports
   */
  private async generateReports(session: CLISession): Promise<void> {
    session.currentStep = 'reports';
    
    this.println(session, this.colorize('blue', '📊 Step 3: Generate Reports'));
    this.println(session, '');

    this.showProgress(session, 'Generating preview report...');

    const reportGenerator = getDryRunReportGenerator();
    const report = reportGenerator.generateReport(session.state.dryRunResult, {
      format: session.preferences.outputFormat,
      includeOperationDetails: true,
      includeRawData: false,
    });

    session.state.report = report;
    this.hideProgress(session);

    this.println(session, this.colorize('green', '✅ Report generated'));
    this.println(session, `Sections: ${report.sections.length}`);
    this.println(session, `Warnings: ${report.issues.warnings.length}`);
    this.println(session, `Errors: ${report.issues.errors.length}`);
    this.println(session, '');

    // Show summary
    const showSummary = await this.promptYesNo(session, 'Show executive summary?', true);
    if (showSummary) {
      this.println(session, this.colorize('yellow', '📄 Executive Summary:'));
      this.println(session, report.summary.content);
      this.println(session, '');
    }
  }

  /**
   * Show visual diff
   */
  private async showVisualDiff(session: CLISession): Promise<void> {
    session.currentStep = 'diff';
    
    this.println(session, this.colorize('blue', '🔍 Step 4: Visual Diff Analysis'));
    this.println(session, '');

    const showDiff = await this.promptYesNo(session, 'Generate visual diff?', true);
    if (!showDiff) return;

    this.showProgress(session, 'Generating visual diff...');

    const diffGenerator = getVisualDiffGenerator();
    const diffResult = await diffGenerator.generateDiff(session.state.dryRunResult, {
      outputFormat: 'unified',
      showLineNumbers: true,
      contextLines: 3,
    });

    session.state.visualDiff = diffResult;
    this.hideProgress(session);

    this.println(session, this.colorize('green', '✅ Visual diff generated'));
    this.println(session, `Files changed: ${diffResult.summary.totalChanges}`);
    this.println(session, `Additions: ${diffResult.summary.totalAdditions}`);
    this.println(session, `Deletions: ${diffResult.summary.totalDeletions}`);
    this.println(session, '');

    // Show sample diff
    const showSample = await this.promptYesNo(session, 'Show sample diff?', false);
    if (showSample && diffResult.fileDiffs.length > 0) {
      const firstDiff = diffResult.fileDiffs[0];
      this.println(session, this.colorize('yellow', `📄 Sample diff for ${firstDiff.filePath}:`));
      if (firstDiff.textDiff) {
        const lines = firstDiff.textDiff.unifiedDiff.split('\n').slice(0, 10);
        this.println(session, lines.join('\n'));
        if (firstDiff.textDiff.unifiedDiff.split('\n').length > 10) {
          this.println(session, this.colorize('gray', '... (truncated)'));
        }
      }
      this.println(session, '');
    }
  }

  /**
   * Analyze impact
   */
  private async analyzeImpact(session: CLISession): Promise<void> {
    session.currentStep = 'impact';
    
    this.println(session, this.colorize('blue', '⚡ Step 5: Impact Analysis'));
    this.println(session, '');

    const analyzeImpact = await this.promptYesNo(session, 'Analyze change impact?', true);
    if (!analyzeImpact) return;

    this.showProgress(session, 'Analyzing impact...');

    const impactEstimator = getImpactEstimator();
    const impactMetrics = await impactEstimator.estimateImpact(session.state.dryRunResult, {
      totalFiles: 1000, // Would be detected in real implementation
    });

    session.state.impactMetrics = impactMetrics;
    this.hideProgress(session);

    this.println(session, this.colorize('green', '✅ Impact analysis completed'));
    this.println(session, `Risk Level: ${this.colorizeRisk(impactMetrics.riskLevel)}`);
    this.println(session, `Confidence: ${Math.round(impactMetrics.confidence * 100)}%`);
    this.println(session, `Files Affected: ${impactMetrics.scope.filesAffected}`);
    this.println(session, `Critical Files: ${impactMetrics.scope.criticalFilesAffected}`);
    this.println(session, '');

    // Show risks
    if (impactMetrics.risks.length > 0) {
      const showRisks = await this.promptYesNo(session, 'Show risk details?', true);
      if (showRisks) {
        this.println(session, this.colorize('yellow', '⚠️  Risk Factors:'));
        for (const risk of impactMetrics.risks.slice(0, 3)) {
          this.println(session, `  • ${risk.description} (Severity: ${risk.severity})`);
        }
        if (impactMetrics.risks.length > 3) {
          this.println(session, this.colorize('gray', `  ... and ${impactMetrics.risks.length - 3} more`));
        }
        this.println(session, '');
      }
    }
  }

  /**
   * Configure output
   */
  private async configureOutput(session: CLISession): Promise<void> {
    session.currentStep = 'output';
    
    this.println(session, this.colorize('blue', '💾 Step 6: Configure Output'));
    this.println(session, '');

    // Choose output format
    const format = await this.prompt(session, {
      name: 'outputFormat',
      description: 'Select output format',
      prompt: 'Output format (json|html|markdown|text): ',
      validate: (input) => {
        if (!['json', 'html', 'markdown', 'text'].includes(input)) {
          return 'Please choose: json, html, markdown, or text';
        }
        return null;
      },
    });

    // Choose output destination
    const destination = await this.prompt(session, {
      name: 'outputDestination',
      description: 'Select output destination',
      prompt: 'Output destination (file|console|both): ',
      validate: (input) => {
        if (!['file', 'console', 'both'].includes(input)) {
          return 'Please choose: file, console, or both';
        }
        return null;
      },
    });

    const destinations: OutputDestination[] = [];
    
    if (destination === 'console' || destination === 'both') {
      destinations.push({ type: 'console' });
    }

    if (destination === 'file' || destination === 'both') {
      const filename = await this.prompt(session, {
        name: 'filename',
        description: 'Output filename',
        prompt: `Output filename (default: dry-run-results.${format}): `,
        transform: (input) => input || `dry-run-results.${format}`,
      });
      destinations.push({ type: 'file', path: filename });
    }

    session.state.outputConfig = {
      destinations,
      format: { type: format as any },
      validate: true,
      backup: false,
      overwrite: true,
      createDirectories: true,
      timeout: 30000,
      retry: { attempts: 3, delay: 1000 },
    } as OutputConfig;

    this.println(session, this.colorize('green', '✅ Output configuration completed'));
    this.println(session, '');
  }

  /**
   * Export results
   */
  private async exportResults(session: CLISession): Promise<void> {
    session.currentStep = 'export';
    
    this.println(session, this.colorize('blue', '📤 Step 7: Export Results'));
    this.println(session, '');

    this.showProgress(session, 'Exporting results...');

    const outputManager = getOutputManager();
    const result = await outputManager.outputCombinedResults(
      {
        dryRunResult: session.state.dryRunResult,
        report: session.state.report,
        visualDiff: session.state.visualDiff,
        impactMetrics: session.state.impactMetrics,
      },
      session.state.outputConfig
    );

    session.state.outputResult = result;
    this.hideProgress(session);

    if (result.success) {
      this.println(session, this.colorize('green', '✅ Results exported successfully'));
      for (const dest of result.destinations) {
        if (dest.success) {
          this.println(session, `  • ${dest.destination.type}: ${dest.path || 'success'} (${this.formatBytes(dest.size || 0)})`);
        }
      }
    } else {
      this.println(session, this.colorize('red', '❌ Export failed'));
      for (const dest of result.destinations) {
        if (!dest.success) {
          this.println(session, `  • ${dest.destination.type}: ${dest.error}`);
        }
      }
    }
    this.println(session, '');
  }

  /**
   * Confirm or modify
   */
  private async confirmOrModify(session: CLISession): Promise<void> {
    session.currentStep = 'confirm';
    
    this.println(session, this.colorize('blue', '✅ Step 8: Review and Confirm'));
    this.println(session, '');

    // Show summary
    this.println(session, this.colorize('yellow', '📋 Operation Summary:'));
    this.println(session, `  • Operations: ${session.state.dryRunResult.totalOperations}`);
    this.println(session, `  • Files affected: ${session.state.impactMetrics?.scope.filesAffected || 0}`);
    this.println(session, `  • Risk level: ${this.colorizeRisk(session.state.impactMetrics?.riskLevel || 'low')}`);
    this.println(session, `  • Output format: ${session.state.outputConfig.format.type}`);
    this.println(session, '');

    const action = await this.prompt(session, {
      name: 'action',
      description: 'Choose action',
      prompt: 'Choose action (proceed|modify|cancel): ',
      validate: (input) => {
        if (!['proceed', 'modify', 'cancel'].includes(input)) {
          return 'Please choose: proceed, modify, or cancel';
        }
        return null;
      },
    });

    switch (action) {
      case 'proceed':
        this.println(session, this.colorize('green', '✅ Proceeding with current configuration'));
        break;
      case 'modify':
        this.println(session, this.colorize('yellow', '🔄 Modification options:'));
        this.println(session, '  1. Reconfigure dry run');
        this.println(session, '  2. Change output settings');
        this.println(session, '  3. Re-run analysis');
        // Would implement modification flow
        break;
      case 'cancel':
        this.println(session, this.colorize('red', '❌ Operation cancelled'));
        return;
    }

    this.println(session, '');
  }

  /**
   * Show completion
   */
  private async showCompletion(session: CLISession): Promise<void> {
    this.println(session, this.colorize('green', '🎉 Dry Run Completed Successfully!'));
    this.println(session, '');
    this.println(session, 'The dry run simulation has been completed. No actual changes');
    this.println(session, 'have been made to your project files.');
    this.println(session, '');
    this.println(session, this.colorize('cyan', 'Next steps:'));
    this.println(session, '  • Review the generated reports');
    this.println(session, '  • Check the visual diff for unexpected changes');
    this.println(session, '  • Consider the risk analysis before proceeding');
    this.println(session, '  • Run the actual optimization when ready');
    this.println(session, '');
  }

  /**
   * Utility methods
   */
  private async prompt(session: CLISession, step: CLIStep): Promise<any> {
    // Would implement actual readline interaction
    this.print(session, step.prompt);
    
    // Simulate user input for demo
    const mockInput = this.getMockInput(step.name);
    this.println(session, this.colorize('gray', mockInput));
    
    if (step.validate) {
      const error = step.validate(mockInput);
      if (error) {
        this.println(session, this.colorize('red', `Error: ${error}`));
        return this.prompt(session, step);
      }
    }

    return step.transform ? step.transform(mockInput) : mockInput;
  }

  private async promptYesNo(session: CLISession, question: string, defaultValue: boolean = false): Promise<boolean> {
    const defaultText = defaultValue ? 'Y/n' : 'y/N';
    const input = await this.prompt(session, {
      name: 'yesno',
      description: question,
      prompt: `${question} (${defaultText}): `,
      transform: (input) => {
        if (!input) return defaultValue;
        return input.toLowerCase().startsWith('y');
      },
    });
    return input;
  }

  private print(session: CLISession, text: string): void {
    process.stdout.write(text);
  }

  private println(session: CLISession, text: string = ''): void {
    console.log(text);
  }

  private colorize(color: string, text: string): string {
    if (!this.currentSession?.preferences.useColors) return text;
    
    const colors: Record<string, string> = {
      red: '\x1b[31m',
      green: '\x1b[32m',
      yellow: '\x1b[33m',
      blue: '\x1b[34m',
      cyan: '\x1b[36m',
      gray: '\x1b[90m',
      reset: '\x1b[0m',
    };

    return `${colors[color] || ''}${text}${colors.reset}`;
  }

  private colorizeRisk(riskLevel: string): string {
    switch (riskLevel) {
      case 'critical': return this.colorize('red', riskLevel.toUpperCase());
      case 'high': return this.colorize('red', riskLevel);
      case 'medium': return this.colorize('yellow', riskLevel);
      case 'low': return this.colorize('green', riskLevel);
      default: return riskLevel;
    }
  }

  private showProgress(session: CLISession, message: string): void {
    this.print(session, `${message} `);
    // Would implement spinner/progress indicator
  }

  private hideProgress(session: CLISession): void {
    this.println(session, '');
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  }

  private getMockInput(stepName: string): string {
    // Mock inputs for demonstration
    const mockInputs: Record<string, string> = {
      optimizationLevel: 'aggressive',
      maxOperations: '5000',
      outputFormat: 'html',
      outputDestination: 'file',
      filename: 'dry-run-report.html',
      action: 'proceed',
      yesno: 'y',
    };
    return mockInputs[stepName] || 'default';
  }

  private async simulateOptimizationOperations(session: CLISession): Promise<void> {
    // Simulate some optimization operations for demo
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  private generateSessionId(): string {
    return `cli-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
  }

  private async handleError(session: CLISession, error: any): Promise<void> {
    this.hideProgress(session);
    this.println(session, this.colorize('red', '❌ An error occurred:'));
    this.println(session, this.colorize('red', error instanceof Error ? error.message : String(error)));
    this.println(session, '');
    
    const retry = await this.promptYesNo(session, 'Would you like to retry?', false);
    if (retry) {
      // Would implement retry logic
      this.println(session, this.colorize('yellow', '🔄 Retrying...'));
    }
  }

  /**
   * Command handlers
   */
  private async handleHelp(args: string[], session: CLISession): Promise<void> {
    this.println(session, this.colorize('cyan', 'Available Commands:'));
    this.println(session, '');
    
    for (const command of this.commands.values()) {
      if (!command.hidden) {
        const aliases = command.aliases.length > 0 ? ` (${command.aliases.join(', ')})` : '';
        this.println(session, `  ${this.colorize('yellow', command.name)}${aliases} - ${command.description}`);
      }
    }
    this.println(session, '');
  }

  private async handleConfig(args: string[], session: CLISession): Promise<void> {
    this.println(session, this.colorize('cyan', 'Current Configuration:'));
    this.println(session, JSON.stringify(session.preferences, null, 2));
    this.println(session, '');
  }

  private async handleStatus(args: string[], session: CLISession): Promise<void> {
    this.println(session, this.colorize('cyan', 'Session Status:'));
    this.println(session, `  Session ID: ${session.id}`);
    this.println(session, `  Current Step: ${session.currentStep}`);
    this.println(session, `  Started: ${new Date(session.startTime).toLocaleString()}`);
    this.println(session, '');
  }

  private async handleExport(args: string[], session: CLISession): Promise<void> {
    if (session.state.outputResult) {
      this.println(session, this.colorize('green', 'Previous export results:'));
      this.println(session, JSON.stringify(session.state.outputResult, null, 2));
    } else {
      this.println(session, this.colorize('yellow', 'No export results available'));
    }
    this.println(session, '');
  }

  private async handleDiff(args: string[], session: CLISession): Promise<void> {
    if (session.state.visualDiff) {
      this.println(session, this.colorize('cyan', 'Visual Diff Summary:'));
      this.println(session, `Files changed: ${session.state.visualDiff.summary.totalChanges}`);
      this.println(session, `Total additions: ${session.state.visualDiff.summary.totalAdditions}`);
      this.println(session, `Total deletions: ${session.state.visualDiff.summary.totalDeletions}`);
    } else {
      this.println(session, this.colorize('yellow', 'No visual diff available'));
    }
    this.println(session, '');
  }

  private async handleImpact(args: string[], session: CLISession): Promise<void> {
    if (session.state.impactMetrics) {
      this.println(session, this.colorize('cyan', 'Impact Analysis:'));
      this.println(session, `Risk Level: ${this.colorizeRisk(session.state.impactMetrics.riskLevel)}`);
      this.println(session, `Confidence: ${Math.round(session.state.impactMetrics.confidence * 100)}%`);
      this.println(session, `Files Affected: ${session.state.impactMetrics.scope.filesAffected}`);
    } else {
      this.println(session, this.colorize('yellow', 'No impact analysis available'));
    }
    this.println(session, '');
  }

  private async handleReset(args: string[], session: CLISession): Promise<void> {
    const confirm = await this.promptYesNo(session, 'Reset current session?', false);
    if (confirm) {
      session.state = {};
      session.currentStep = 'welcome';
      this.println(session, this.colorize('green', '✅ Session reset'));
    }
    this.println(session, '');
  }

  private async handleQuit(args: string[], session: CLISession): Promise<void> {
    this.println(session, this.colorize('cyan', 'Thank you for using TW-Enigma Dry Run!'));
    process.exit(0);
  }
}

/**
 * Global CLI instance
 */
let globalCLI: InteractiveCLI | null = null;

/**
 * Get the global CLI instance
 */
export function getInteractiveCLI(): InteractiveCLI {
  if (!globalCLI) {
    globalCLI = new InteractiveCLI();
  }
  return globalCLI;
}

/**
 * Create a new CLI instance
 */
export function createInteractiveCLI(): InteractiveCLI {
  return new InteractiveCLI();
}

/**
 * Start interactive dry run session
 */
export async function startInteractiveDryRun(
  projectContext: {
    projectRoot: string;
    optimizationLevel: string;
    targetFramework?: string;
  },
  preferences?: Partial<CLIPreferences>
): Promise<void> {
  const cli = getInteractiveCLI();
  await cli.startSession(preferences);
  await cli.runDryRunWorkflow(projectContext);
}

export default InteractiveCLI;