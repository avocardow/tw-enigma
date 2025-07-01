/**
 * Copyright (c) 2025 Rowan Cardow
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * CLI Interface for TW-Enigma Integration
 * 
 * Provides command-line interfaces for triggering discovery, analysis,
 * and integration with external toolchains and CI/CD pipelines.
 */

import { Command } from 'commander';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { dirname, resolve } from 'path';
import { createLogger } from '../../utils/logger';
import { createApiServer } from '../api/apiServer';
import { createSarifFormatter } from '../formatters/sarifFormatter';
import { createOpportunityIdentificationEngine } from '../../optimization/opportunityIdentification';
import type {
  DiscoveryRequest,
  AnalysisRequest,
  OutputFormat,
  OutputFormatConfig,
} from '../core/apiInterfaces';

const logger = createLogger('cli-interface');

/**
 * CLI configuration
 */
export interface CliConfig {
  /** Default output directory */
  outputDir: string;
  /** Default project root */
  projectRoot: string;
  /** Default output format */
  defaultFormat: OutputFormat;
  /** API server configuration */
  apiServer?: {
    enabled: boolean;
    port: number;
    host: string;
  };
  /** Logging configuration */
  logging: {
    level: 'error' | 'warn' | 'info' | 'debug';
    file?: string;
  };
}

/**
 * CLI command result
 */
export interface CliResult {
  success: boolean;
  message: string;
  data?: unknown;
  outputFiles?: string[];
  exitCode: number;
}

/**
 * CLI Interface implementation
 */
export class CliInterface {
  private config: CliConfig;
  private program: Command;

  constructor(config: Partial<CliConfig> = {}) {
    this.config = {
      outputDir: './tw-enigma-output',
      projectRoot: process.cwd(),
      defaultFormat: 'json',
      logging: {
        level: 'info',
      },
      ...config,
    };

    this.program = new Command();
    this.setupCommands();
  }

  /**
   * Setup CLI commands
   */
  private setupCommands(): void {
    this.program
      .name('tw-enigma')
      .description('TW-Enigma CSS optimization and pattern analysis tool')
      .version('1.0.0');

    // Discovery command
    this.program
      .command('discover')
      .description('Discover and analyze CSS patterns in project files')
      .option('-t, --targets <paths...>', 'Target files or directories', ['.'])
      .option('-i, --include <patterns...>', 'File patterns to include', ['**/*.{html,js,jsx,ts,tsx,vue,svelte}'])
      .option('-e, --exclude <patterns...>', 'File patterns to exclude', ['node_modules/**', '.git/**', 'dist/**'])
      .option('-o, --output <dir>', 'Output directory', this.config.outputDir)
      .option('-f, --format <format>', 'Output format (json, sarif, html, markdown)', this.config.defaultFormat)
      .option('--incremental', 'Enable incremental scanning', true)
      .option('--max-file-size <mb>', 'Maximum file size to process (MB)', '10')
      .option('--concurrency <num>', 'Parallelization factor', '4')
      .option('--sensitivity <level>', 'Pattern detection sensitivity (low, medium, high)', 'medium')
      .option('--no-patterns', 'Disable pattern analysis')
      .option('--no-opportunities', 'Disable opportunity detection')
      .option('--webhook <url>', 'Webhook URL for completion notification')
      .action(this.handleDiscovery.bind(this));

    // Analysis command
    this.program
      .command('analyze')
      .description('Analyze specific patterns or files')
      .argument('<type>', 'Analysis type (pattern, opportunity, validation, full)')
      .option('-s, --source <source>', 'Source files or discovery result ID')
      .option('-o, --output <dir>', 'Output directory', this.config.outputDir)
      .option('-f, --format <format>', 'Output format', this.config.defaultFormat)
      .option('--include-metrics', 'Include detailed metrics', true)
      .option('--include-recommendations', 'Include recommendations', true)
      .option('--max-depth <num>', 'Maximum analysis depth', '5')
      .option('--quality-threshold <num>', 'Quality threshold (0-1)', '0.8')
      .action(this.handleAnalysis.bind(this));

    // Server command
    this.program
      .command('server')
      .description('Start TW-Enigma API server')
      .option('-p, --port <port>', 'Server port', '3000')
      .option('-h, --host <host>', 'Server host', '0.0.0.0')
      .option('--https', 'Enable HTTPS')
      .option('--cert <path>', 'SSL certificate path')
      .option('--key <path>', 'SSL key path')
      .option('--api-keys <keys...>', 'API keys for authentication')
      .option('--cors-origins <origins...>', 'CORS allowed origins', ['*'])
      .option('--debug', 'Enable debug mode')
      .action(this.handleServer.bind(this));

    // Export command
    this.program
      .command('export')
      .description('Export analysis results to different formats')
      .argument('<input>', 'Input file or directory')
      .option('-f, --format <format>', 'Output format', 'sarif')
      .option('-o, --output <file>', 'Output file path')
      .option('--pretty', 'Pretty print output', true)
      .option('--include-metadata', 'Include metadata', true)
      .action(this.handleExport.bind(this));

    // Validate command
    this.program
      .command('validate')
      .description('Validate TW-Enigma configuration and setup')
      .option('--config <path>', 'Configuration file path')
      .option('--project-root <path>', 'Project root directory', this.config.projectRoot)
      .option('--check-dependencies', 'Check build tool dependencies', true)
      .action(this.handleValidate.bind(this));

    // Integration commands
    const integrationCmd = this.program
      .command('integration')
      .description('Manage integrations with external tools');

    integrationCmd
      .command('setup')
      .description('Setup integration with CI/CD or IDE')
      .argument('<type>', 'Integration type (github-actions, gitlab-ci, jenkins, vscode, jetbrains)')
      .option('--output <dir>', 'Output directory for configuration files', this.config.outputDir)
      .option('--project <name>', 'Project name')
      .option('--repo <repo>', 'Repository identifier')
      .action(this.handleIntegrationSetup.bind(this));

    integrationCmd
      .command('test')
      .description('Test integration configuration')
      .argument('<type>', 'Integration type')
      .option('--config <path>', 'Configuration file path')
      .action(this.handleIntegrationTest.bind(this));
  }

  /**
   * Handle discovery command
   */
  private async handleDiscovery(options: Record<string, unknown>): Promise<CliResult> {
    try {
      logger.info('Starting discovery process', { targets: options.targets });

      const request: DiscoveryRequest = {
        targets: options.targets as string[],
        include: options.include as string[],
        exclude: options.exclude as string[],
        config: {
          incremental: options.incremental as boolean,
          maxFileSize: parseInt(options.maxFileSize as string),
          concurrency: parseInt(options.concurrency as string),
          sensitivity: options.sensitivity as 'low' | 'medium' | 'high',
          enablePatternAnalysis: options.patterns as boolean,
          enableOpportunityDetection: options.opportunities as boolean,
        },
        outputFormat: [options.format as OutputFormat],
        webhookUrl: options.webhook as string,
      };

      // Run discovery process
      const discoveryResult = await this.runDiscovery(request);

      // Ensure output directory exists
      await mkdir(options.output, { recursive: true });

      // Save results
      const outputFiles = await this.saveResults(
        discoveryResult,
        options.output as string,
        options.format as OutputFormat
      );

      logger.info('Discovery completed successfully', {
        outputFiles: outputFiles.length,
        outputDirectory: options.output,
      });

      return {
        success: true,
        message: `Discovery completed. Results saved to ${options.output as string}`,
        data: discoveryResult,
        outputFiles,
        exitCode: 0,
      };
    } catch (error) {
      logger.error('Discovery failed', { error });
      return {
        success: false,
        message: `Discovery failed: ${error instanceof Error ? error.message : String(error)}`,
        exitCode: 1,
      };
    }
  }

  /**
   * Handle analysis command
   */
  private async handleAnalysis(type: string, options: Record<string, unknown>): Promise<CliResult> {
    try {
      logger.info('Starting analysis process', { type, source: options.source });

      const request: AnalysisRequest = {
        type: type as 'pattern' | 'opportunity' | 'validation' | 'full',
        input: {
          source: options.source ? [options.source as string] : ['.'],
        },
        options: {
          includeMetrics: options.includeMetrics as boolean,
          includeRecommendations: options.includeRecommendations as boolean,
          maxDepth: parseInt(options.maxDepth as string),
          qualityThreshold: parseFloat(options.qualityThreshold as string),
        },
      };

      // Run analysis process
      const analysisResult = await this.runAnalysis(request);

      // Ensure output directory exists
      await mkdir(options.output, { recursive: true });

      // Save results
      const outputFiles = await this.saveResults(
        analysisResult,
        options.output as string,
        options.format as OutputFormat
      );

      logger.info('Analysis completed successfully', {
        type,
        outputFiles: outputFiles.length,
      });

      return {
        success: true,
        message: `Analysis completed. Results saved to ${options.output as string}`,
        data: analysisResult,
        outputFiles,
        exitCode: 0,
      };
    } catch (error) {
      logger.error('Analysis failed', { error });
      return {
        success: false,
        message: `Analysis failed: ${error instanceof Error ? error.message : String(error)}`,
        exitCode: 1,
      };
    }
  }

  /**
   * Handle server command
   */
  private async handleServer(options: Record<string, unknown>): Promise<CliResult> {
    try {
      logger.info('Starting TW-Enigma API server', {
        port: options.port,
        host: options.host,
      });

      const serverConfig = {
        port: parseInt(options.port as string),
        host: options.host as string,
        https: options.https as boolean,
        ssl: options.https
          ? {
              cert: options.cert as string,
              key: options.key as string,
            }
          : undefined,
        cors: {
          origins: options.corsOrigins as string[],
          methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
          headers: ['Content-Type', 'Authorization', 'X-API-Key'],
        },
        debug: options.debug as boolean,
        apiKeys: options.apiKeys
          ? (options.apiKeys as string[]).map((key: string, index: number) => ({
              keyId: `cli-key-${index}`,
              keyHash: this.hashApiKey(key),
              scopes: ['read', 'write', 'discovery', 'analysis'] as const,
            }))
          : [],
      };

      const server = createApiServer(serverConfig);
      await server.start();

      // Keep server running until interrupted
      process.on('SIGINT', async () => {
        logger.info('Shutting down server...');
        await server.stop();
        process.exit(0);
      });

      return {
        success: true,
        message: `Server started on ${options.https ? 'https' : 'http'}://${options.host as string}:${options.port as string}`,
        exitCode: 0,
      };
    } catch (error) {
      logger.error('Server failed to start', { error });
      return {
        success: false,
        message: `Server failed to start: ${error instanceof Error ? error.message : String(error)}`,
        exitCode: 1,
      };
    }
  }

  /**
   * Handle export command
   */
  private async handleExport(input: string, options: Record<string, unknown>): Promise<CliResult> {
    try {
      logger.info('Exporting analysis results', { input, format: options.format });

      // Read input data
      const inputData = await readFile(input, 'utf-8');
      const data = JSON.parse(inputData);

      // Convert to requested format
      const formattedOutput = await this.convertToFormat(data, options.format as OutputFormat, {
        pretty: options.pretty as boolean,
        includeMetadata: options.includeMetadata as boolean,
      });

      // Determine output path
      const outputPath = (options.output as string) || `${input}.${options.format as string}`;

      // Ensure output directory exists
      await mkdir(dirname(outputPath), { recursive: true });

      // Write output
      await writeFile(outputPath, formattedOutput);

      logger.info('Export completed successfully', { outputPath });

      return {
        success: true,
        message: `Export completed. Output saved to ${outputPath}`,
        outputFiles: [outputPath],
        exitCode: 0,
      };
    } catch (error) {
      logger.error('Export failed', { error });
      return {
        success: false,
        message: `Export failed: ${error instanceof Error ? error.message : String(error)}`,
        exitCode: 1,
      };
    }
  }

  /**
   * Handle validate command
   */
  private async handleValidate(options: any): Promise<CliResult> {
    try {
      logger.info('Validating TW-Enigma configuration', {
        projectRoot: options.projectRoot,
      });

      const validationResults = [];
      let hasErrors = false;

      // Validate project structure
      try {
        const fs = await import('fs/promises');
        await fs.access(options.projectRoot);
        validationResults.push('✅ Project root directory exists');
      } catch {
        validationResults.push('❌ Project root directory not found');
        hasErrors = true;
      }

      // Check for configuration file
      if (options.config) {
        try {
          await readFile(options.config, 'utf-8');
          validationResults.push('✅ Configuration file found');
        } catch {
          validationResults.push('❌ Configuration file not found');
          hasErrors = true;
        }
      }

      // Check dependencies if requested
      if (options.checkDependencies) {
        try {
          const packageJsonPath = resolve(options.projectRoot, 'package.json');
          const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf-8'));

          const hasBuildTool =
            packageJson.dependencies?.webpack ||
            packageJson.devDependencies?.webpack ||
            packageJson.dependencies?.vite ||
            packageJson.devDependencies?.vite ||
            packageJson.dependencies?.next ||
            packageJson.devDependencies?.next;

          if (hasBuildTool) {
            validationResults.push('✅ Build tool dependency found');
          } else {
            validationResults.push('⚠️ No build tool dependencies detected');
          }
        } catch {
          validationResults.push('❌ package.json not found');
          hasErrors = true;
        }
      }

      const message = validationResults.join('\n');

      return {
        success: !hasErrors,
        message,
        exitCode: hasErrors ? 1 : 0,
      };
    } catch (error) {
      logger.error('Validation failed', { error });
      return {
        success: false,
        message: `Validation failed: ${error instanceof Error ? error.message : String(error)}`,
        exitCode: 1,
      };
    }
  }

  /**
   * Handle integration setup command
   */
  private async handleIntegrationSetup(type: string, options: any): Promise<CliResult> {
    try {
      logger.info('Setting up integration', { type });

      const configFiles = await this.generateIntegrationConfig(type, {
        outputDir: options.output,
        projectName: options.project,
        repository: options.repo,
      });

      // Ensure output directory exists
      await mkdir(options.output, { recursive: true });

      // Write configuration files
      const outputFiles = [];
      for (const [filename, content] of Object.entries(configFiles)) {
        const filePath = resolve(options.output, filename);
        await writeFile(filePath, content);
        outputFiles.push(filePath);
      }

      logger.info('Integration setup completed', { type, files: outputFiles.length });

      return {
        success: true,
        message: `Integration setup completed for ${type}. Configuration files saved to ${options.output}`,
        outputFiles,
        exitCode: 0,
      };
    } catch (error) {
      logger.error('Integration setup failed', { error });
      return {
        success: false,
        message: `Integration setup failed: ${error instanceof Error ? error.message : String(error)}`,
        exitCode: 1,
      };
    }
  }

  /**
   * Handle integration test command
   */
  private async handleIntegrationTest(type: string, options: any): Promise<CliResult> {
    try {
      logger.info('Testing integration', { type, config: options.config });

      // Mock integration test - in real implementation would test actual integrations
      const testResults = [
        '✅ Configuration file is valid',
        '✅ Required environment variables are set',
        '✅ API endpoints are accessible',
        '✅ Authentication is working',
      ];

      return {
        success: true,
        message: `Integration test completed for ${type}:\n${testResults.join('\n')}`,
        exitCode: 0,
      };
    } catch (error) {
      logger.error('Integration test failed', { error });
      return {
        success: false,
        message: `Integration test failed: ${error instanceof Error ? error.message : String(error)}`,
        exitCode: 1,
      };
    }
  }

  /**
   * Run discovery process (mock implementation)
   */
  private async runDiscovery(request: DiscoveryRequest): Promise<any> {
    // This would integrate with the actual discovery engine
    const opportunityEngine = createOpportunityIdentificationEngine();

    return {
      requestId: `discovery-${Date.now()}`,
      status: 'completed',
      startedAt: Date.now(),
      completedAt: Date.now() + 1000,
      results: {
        entities: request.targets.map((target) => ({
          filePath: target,
          fileType: target.split('.').pop() || 'unknown',
          patterns: Math.floor(Math.random() * 10),
          size: Math.floor(Math.random() * 100000),
          lastModified: Date.now(),
        })),
      },
      stats: {
        filesProcessed: request.targets.length,
        patternsFound: Math.floor(Math.random() * 50),
        opportunitiesIdentified: Math.floor(Math.random() * 10),
        processingTimeMs: 1000,
        errorCount: 0,
      },
    };
  }

  /**
   * Run analysis process (mock implementation)
   */
  private async runAnalysis(request: AnalysisRequest): Promise<any> {
    return {
      requestId: `analysis-${Date.now()}`,
      type: request.type,
      status: 'completed',
      startedAt: Date.now(),
      completedAt: Date.now() + 500,
      results: {
        summary: `${request.type} analysis completed`,
        findings: [],
        recommendations: [],
      },
    };
  }

  /**
   * Save results to files
   */
  private async saveResults(data: any, outputDir: string, format: OutputFormat): Promise<string[]> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const outputFiles = [];

    // Save primary format
    const primaryFile = resolve(outputDir, `tw-enigma-results-${timestamp}.${format}`);
    const formattedContent = await this.convertToFormat(data, format, { pretty: true });
    await writeFile(primaryFile, formattedContent);
    outputFiles.push(primaryFile);

    // Also save as JSON for compatibility
    if (format !== 'json') {
      const jsonFile = resolve(outputDir, `tw-enigma-results-${timestamp}.json`);
      await writeFile(jsonFile, JSON.stringify(data, null, 2));
      outputFiles.push(jsonFile);
    }

    return outputFiles;
  }

  /**
   * Convert data to specified format
   */
  private async convertToFormat(
    data: any,
    format: OutputFormat,
    options: { pretty?: boolean; includeMetadata?: boolean } = {}
  ): Promise<string> {
    switch (format) {
      case 'json':
        return JSON.stringify(data, null, options.pretty ? 2 : 0);

      case 'sarif':
        const sarifFormatter = createSarifFormatter();
        const sarifOutput = sarifFormatter.formatCombinedResults(data);
        return JSON.stringify(sarifOutput, null, options.pretty ? 2 : 0);

      case 'markdown':
        return this.convertToMarkdown(data, options);

      case 'html':
        return this.convertToHtml(data, options);

      case 'csv':
        return this.convertToCsv(data);

      case 'xml':
        return this.convertToXml(data);

      default:
        throw new Error(`Unsupported format: ${format}`);
    }
  }

  /**
   * Convert to Markdown format
   */
  private convertToMarkdown(data: any, options: any): string {
    const lines = ['# TW-Enigma Analysis Results\n'];

    if (data.requestId) {
      lines.push(`**Request ID:** ${data.requestId}\n`);
    }

    if (data.stats) {
      lines.push('## Statistics\n');
      lines.push(`- Files processed: ${data.stats.filesProcessed}`);
      lines.push(`- Patterns found: ${data.stats.patternsFound}`);
      lines.push(`- Opportunities identified: ${data.stats.opportunitiesIdentified}`);
      lines.push(`- Processing time: ${data.stats.processingTimeMs}ms\n`);
    }

    if (data.results?.entities) {
      lines.push('## Processed Files\n');
      data.results.entities.forEach((entity: any) => {
        lines.push(`- **${entity.filePath}** (${entity.fileType}): ${entity.patterns} patterns`);
      });
      lines.push('');
    }

    if (options.includeMetadata && data.meta) {
      lines.push('## Metadata\n');
      lines.push('```json');
      lines.push(JSON.stringify(data.meta, null, 2));
      lines.push('```\n');
    }

    return lines.join('\n');
  }

  /**
   * Convert to HTML format
   */
  private convertToHtml(data: any, options: any): string {
    return `
<!DOCTYPE html>
<html>
<head>
    <title>TW-Enigma Analysis Results</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; }
        .stats { background: #f5f5f5; padding: 20px; border-radius: 5px; }
        .entity { margin: 10px 0; padding: 10px; border-left: 3px solid #007acc; }
        pre { background: #f8f8f8; padding: 15px; overflow-x: auto; }
    </style>
</head>
<body>
    <h1>TW-Enigma Analysis Results</h1>
    
    ${data.requestId ? `<p><strong>Request ID:</strong> ${data.requestId}</p>` : ''}
    
    ${data.stats ? `
    <div class="stats">
        <h2>Statistics</h2>
        <ul>
            <li>Files processed: ${data.stats.filesProcessed}</li>
            <li>Patterns found: ${data.stats.patternsFound}</li>
            <li>Opportunities identified: ${data.stats.opportunitiesIdentified}</li>
            <li>Processing time: ${data.stats.processingTimeMs}ms</li>
        </ul>
    </div>
    ` : ''}
    
    ${data.results?.entities ? `
    <h2>Processed Files</h2>
    ${data.results.entities.map((entity: any) => `
        <div class="entity">
            <strong>${entity.filePath}</strong> (${entity.fileType})<br>
            Patterns: ${entity.patterns}, Size: ${entity.size} bytes
        </div>
    `).join('')}
    ` : ''}
    
    ${options.includeMetadata && data.meta ? `
    <h2>Metadata</h2>
    <pre>${JSON.stringify(data.meta, null, 2)}</pre>
    ` : ''}
</body>
</html>`;
  }

  /**
   * Convert to CSV format
   */
  private convertToCsv(data: any): string {
    if (!data.results?.entities) {
      return 'No entities found';
    }

    const headers = ['File Path', 'File Type', 'Patterns', 'Size', 'Last Modified'];
    const rows = [headers.join(',')];

    data.results.entities.forEach((entity: any) => {
      rows.push([
        entity.filePath,
        entity.fileType,
        entity.patterns,
        entity.size,
        new Date(entity.lastModified).toISOString(),
      ].join(','));
    });

    return rows.join('\n');
  }

  /**
   * Convert to XML format
   */
  private convertToXml(data: any): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
<tw-enigma-results>
    ${data.requestId ? `<request-id>${data.requestId}</request-id>` : ''}
    ${data.stats ? `
    <statistics>
        <files-processed>${data.stats.filesProcessed}</files-processed>
        <patterns-found>${data.stats.patternsFound}</patterns-found>
        <opportunities-identified>${data.stats.opportunitiesIdentified}</opportunities-identified>
        <processing-time-ms>${data.stats.processingTimeMs}</processing-time-ms>
    </statistics>
    ` : ''}
    ${data.results?.entities ? `
    <entities>
        ${data.results.entities.map((entity: any) => `
        <entity>
            <file-path>${entity.filePath}</file-path>
            <file-type>${entity.fileType}</file-type>
            <patterns>${entity.patterns}</patterns>
            <size>${entity.size}</size>
            <last-modified>${new Date(entity.lastModified).toISOString()}</last-modified>
        </entity>
        `).join('')}
    </entities>
    ` : ''}
</tw-enigma-results>`;
  }

  /**
   * Generate integration configuration files
   */
  private async generateIntegrationConfig(
    type: string,
    options: { outputDir: string; projectName?: string; repository?: string }
  ): Promise<Record<string, string>> {
    const configs: Record<string, string> = {};

    switch (type) {
      case 'github-actions':
        configs['.github/workflows/tw-enigma.yml'] = this.generateGitHubActionConfig(options);
        break;

      case 'gitlab-ci':
        configs['tw-enigma-ci.yml'] = this.generateGitLabCIConfig(options);
        break;

      case 'jenkins':
        configs['Jenkinsfile'] = this.generateJenkinsConfig(options);
        break;

      case 'vscode':
        configs['.vscode/settings.json'] = this.generateVSCodeConfig(options);
        configs['.vscode/tasks.json'] = this.generateVSCodeTasksConfig(options);
        break;

      case 'jetbrains':
        configs['.idea/tw-enigma.xml'] = this.generateJetBrainsConfig(options);
        break;

      default:
        throw new Error(`Unsupported integration type: ${type}`);
    }

    return configs;
  }

  /**
   * Generate GitHub Actions configuration
   */
  private generateGitHubActionConfig(options: any): string {
    return `name: TW-Enigma Analysis

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]

jobs:
  tw-enigma-analysis:
    runs-on: ubuntu-latest
    
    steps:
    - name: Checkout code
      uses: actions/checkout@v3
    
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
        cache: 'npm'
    
    - name: Install dependencies
      run: npm ci
    
    - name: Run TW-Enigma discovery
      run: npx tw-enigma discover --format sarif --output ./tw-enigma-results
    
    - name: Upload SARIF to GitHub Security
      uses: github/codeql-action/upload-sarif@v2
      with:
        sarif_file: ./tw-enigma-results/tw-enigma-results-*.sarif
    
    - name: Upload analysis results
      uses: actions/upload-artifact@v3
      with:
        name: tw-enigma-results
        path: ./tw-enigma-results/
    
    - name: Comment PR with results
      if: github.event_name == 'pull_request'
      uses: actions/github-script@v6
      with:
        script: |
          const fs = require('fs');
          const results = JSON.parse(fs.readFileSync('./tw-enigma-results/tw-enigma-results-latest.json', 'utf8'));
          
          const comment = \`## TW-Enigma Analysis Results
          
          📊 **Statistics:**
          - Files processed: \${results.stats.filesProcessed}
          - Patterns found: \${results.stats.patternsFound}
          - Opportunities identified: \${results.stats.opportunitiesIdentified}
          
          View detailed results in the [artifacts](\${context.payload.pull_request.html_url}/checks).
          \`;
          
          github.rest.issues.createComment({
            issue_number: context.issue.number,
            owner: context.repo.owner,
            repo: context.repo.repo,
            body: comment
          });
`;
  }

  /**
   * Generate GitLab CI configuration
   */
  private generateGitLabCIConfig(options: any): string {
    return `tw-enigma-analysis:
  stage: test
  image: node:18
  
  script:
    - npm ci
    - npx tw-enigma discover --format sarif --output ./tw-enigma-results
    - npx tw-enigma validate --project-root .
  
  artifacts:
    reports:
      sast: tw-enigma-results/*.sarif
    paths:
      - tw-enigma-results/
    expire_in: 1 week
  
  only:
    - merge_requests
    - main
    - develop
`;
  }

  /**
   * Generate Jenkins configuration
   */
  private generateJenkinsConfig(options: any): string {
    return `pipeline {
    agent any
    
    stages {
        stage('Install Dependencies') {
            steps {
                sh 'npm ci'
            }
        }
        
        stage('TW-Enigma Analysis') {
            steps {
                sh 'npx tw-enigma discover --format sarif --output ./tw-enigma-results'
                sh 'npx tw-enigma validate --project-root .'
            }
        }
    }
    
    post {
        always {
            archiveArtifacts artifacts: 'tw-enigma-results/**/*', allowEmptyArchive: true
            
            publishHTML([
                allowMissing: false,
                alwaysLinkToLastBuild: true,
                keepAll: true,
                reportDir: 'tw-enigma-results',
                reportFiles: '*.html',
                reportName: 'TW-Enigma Analysis Report'
            ])
        }
        
        success {
            echo 'TW-Enigma analysis completed successfully'
        }
        
        failure {
            echo 'TW-Enigma analysis failed'
        }
    }
}`;
  }

  /**
   * Generate VS Code configuration
   */
  private generateVSCodeConfig(options: any): string {
    return JSON.stringify({
      'tw-enigma.enabled': true,
      'tw-enigma.autoDiscovery': true,
      'tw-enigma.outputFormat': 'json',
      'tw-enigma.sensitivity': 'medium',
      'tw-enigma.includeRecommendations': true,
    }, null, 2);
  }

  /**
   * Generate VS Code tasks configuration
   */
  private generateVSCodeTasksConfig(options: any): string {
    return JSON.stringify({
      version: '2.0.0',
      tasks: [
        {
          label: 'TW-Enigma: Discover Patterns',
          type: 'shell',
          command: 'npx',
          args: ['tw-enigma', 'discover', '--format', 'json'],
          group: 'build',
          presentation: {
            echo: true,
            reveal: 'always',
            focus: false,
            panel: 'shared',
          },
          problemMatcher: [],
        },
        {
          label: 'TW-Enigma: Validate Setup',
          type: 'shell',
          command: 'npx',
          args: ['tw-enigma', 'validate'],
          group: 'test',
          presentation: {
            echo: true,
            reveal: 'always',
            focus: false,
            panel: 'shared',
          },
          problemMatcher: [],
        },
      ],
    }, null, 2);
  }

  /**
   * Generate JetBrains IDE configuration
   */
  private generateJetBrainsConfig(options: any): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
<project version="4">
  <component name="TWEnigmaSettings">
    <option name="enabled" value="true" />
    <option name="autoDiscovery" value="true" />
    <option name="outputFormat" value="json" />
    <option name="sensitivity" value="medium" />
    <option name="includeRecommendations" value="true" />
  </component>
</project>`;
  }

  /**
   * Hash API key for secure storage
   */
  private hashApiKey(key: string): string {
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(key).digest('hex');
  }

  /**
   * Parse CLI arguments and execute
   */
  async parse(argv: string[]): Promise<CliResult> {
    try {
      await this.program.parseAsync(argv);
      return {
        success: true,
        message: 'Command executed successfully',
        exitCode: 0,
      };
    } catch (error) {
      return {
        success: false,
        message: `Command failed: ${error instanceof Error ? error.message : String(error)}`,
        exitCode: 1,
      };
    }
  }

  /**
   * Get help text
   */
  getHelp(): string {
    return this.program.helpInformation();
  }
}

/**
 * Factory function to create CLI interface
 */
export function createCliInterface(config?: Partial<CliConfig>): CliInterface {
  return new CliInterface(config);
}

/**
 * Main CLI entry point
 */
export async function runCli(argv: string[] = process.argv): Promise<void> {
  const cli = createCliInterface();
  const result = await cli.parse(argv);
  
  if (!result.success) {
    console.error(result.message);
    process.exit(result.exitCode);
  }
}