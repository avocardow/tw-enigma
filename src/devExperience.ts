/**
 * Copyright (c) 2025 Rowan Cardow
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { EventEmitter } from "events";
import { createLogger, Logger } from "./logger.ts";
import { EnigmaConfig } from "./config.ts";
import { DevDiagnostics, DevPerformanceMetrics } from "./devDiagnostics.ts";
import { DevDashboard } from "./devDashboard.ts";
import { DevPreview } from "./devPreview.ts";
import { DebugUtils, DebugSession } from "./debugUtils.ts";
import { SourceMapGenerator } from "./sourceMapGenerator.ts";
import { readFile, writeFile, mkdir } from "fs/promises";
import { join, dirname } from "path";
import { existsSync } from "fs";
import { DevDashboardEnhanced } from "./devDashboardEnhanced.ts";
import { DevHotReload } from "./devHotReload.ts";
import { DevIdeIntegration } from "./devIdeIntegration.ts";

/**
 * Development experience configuration
 */
export interface DevExperienceConfig {
  enabled: boolean;
  autoStart: boolean;
  coordinateTools: boolean;
  persistState: boolean;
  enableHotReload: boolean;
  enableSourceMaps: boolean;
  enablePerformanceMonitoring: boolean;
  enableRealTimePreview: boolean;
  enableDebugConsole: boolean;
  enableFileWatcher: boolean;
  integrations: {
    vscode: boolean;
    webstorm: boolean;
    browser: boolean;
    terminal: boolean;
  };
  notifications: {
    enabled: boolean;
    level: 'error' | 'warn' | 'info' | 'debug';
    desktop: boolean;
    browser: boolean;
  };
  performance: {
    trackMetrics: boolean;
    enableProfiling: boolean;
    memoryThreshold: number;
    cpuThreshold: number;
    alertOnThresholds: boolean;
  };
}

/**
 * Development experience state
 */
export interface DevExperienceState {
  isActive: boolean;
  tools: {
    diagnostics: boolean;
    dashboard: boolean;
    preview: boolean;
    debugUtils: boolean;
    sourceMap: boolean;
  };
  sessions: {
    current?: string;
    history: string[];
  };
  metrics: {
    totalOptimizations: number;
    totalErrors: number;
    averageProcessingTime: number;
    uptime: number;
  };
  files: {
    watched: number;
    modified: number;
    lastChange?: Date;
  };
}

/**
 * Development experience events
 */
export interface DevExperienceEvents {
  'tools-started': (tools: string[]) => void;
  'tools-stopped': (tools: string[]) => void;
  'optimization-completed': (result: any) => void;
  'error-detected': (error: Error, context: string) => void;
  'performance-alert': (metric: string, value: number, threshold: number) => void;
  'file-changed': (path: string, type: string) => void;
  'session-started': (sessionId: string) => void;
  'session-ended': (sessionId: string, results: any) => void;
  'notification': (level: string, message: string, data?: any) => void;
}

/**
 * Comprehensive Development Experience Manager
 * Coordinates all development tools for optimal developer experience
 */
export class DevExperienceManager extends EventEmitter {
  private config: DevExperienceConfig;
  private logger: Logger;
  private isActive = false;
  private tools: {
    diagnostics?: DevDiagnostics;
    dashboard?: DevDashboard;
    preview?: DevPreview;
    debugUtils?: DebugUtils;
    sourceMap?: SourceMapGenerator;
  } = {};
  private state: DevExperienceState;
  private stateFile: string;
  private startTime: number;
  private dashboardEnhanced!: DevDashboardEnhanced;
  private hotReload!: DevHotReload;
  private ideIntegration!: DevIdeIntegration;

  constructor(
    config: Partial<DevExperienceConfig> = {},
    private enigmaConfig: EnigmaConfig
  ) {
    super();
    
    this.config = {
      enabled: true,
      autoStart: false,
      coordinateTools: true,
      persistState: true,
      enableHotReload: true,
      enableSourceMaps: true,
      enablePerformanceMonitoring: true,
      enableRealTimePreview: true,
      enableDebugConsole: true,
      enableFileWatcher: true,
      integrations: {
        vscode: true,
        webstorm: true,
        browser: true,
        terminal: true,
      },
      notifications: {
        enabled: true,
        level: 'info',
        desktop: false,
        browser: true,
      },
      performance: {
        trackMetrics: true,
        enableProfiling: false,
        memoryThreshold: 512,
        cpuThreshold: 80,
        alertOnThresholds: true,
      },
      ...config,
    };

    this.logger = createLogger("DevExperienceManager");
    this.startTime = Date.now();
    this.stateFile = join(process.cwd(), '.enigma', 'dev-state.json');
    
    this.state = {
      isActive: false,
      tools: {
        diagnostics: false,
        dashboard: false,
        preview: false,
        debugUtils: false,
        sourceMap: false,
      },
      sessions: {
        history: [],
      },
      metrics: {
        totalOptimizations: 0,
        totalErrors: 0,
        averageProcessingTime: 0,
        uptime: 0,
      },
      files: {
        watched: 0,
        modified: 0,
      },
    };

    this.setupEventHandlers();
    this.logger.debug("Development experience manager initialized", { config: this.config });
  }

  /**
   * Start the comprehensive development experience
   */
  async start(): Promise<void> {
    if (this.isActive) {
      this.logger.warn("Development experience already running");
      return;
    }

    if (!this.config.enabled) {
      this.logger.info("Development experience disabled");
      return;
    }

    this.isActive = true;
    this.state.isActive = true;
    this.logger.info("Starting comprehensive development experience");

    try {
      // Load previous state if available
      if (this.config.persistState) {
        await this.loadState();
      }

      // Ensure active state is set even after loading previous state
      this.isActive = true;
      this.state.isActive = true;

      // Initialize tools in coordinated manner
      await this.initializeTools();
      
      // Start tools based on configuration
      const startedTools: string[] = [];

      if (this.config.enablePerformanceMonitoring && this.tools.diagnostics) {
        await this.tools.diagnostics.start();
        this.state.tools.diagnostics = true;
        startedTools.push("diagnostics");
      }

      if (this.config.enableDebugConsole && this.tools.debugUtils) {
        // Debug utils don't need explicit start, just initialize
        this.state.tools.debugUtils = true;
        startedTools.push("debugUtils");
      }

      if (this.config.enableSourceMaps && this.tools.sourceMap) {
        // Source map generator doesn't need explicit start
        this.state.tools.sourceMap = true;
        startedTools.push("sourceMap");
      }

      if (this.config.enableRealTimePreview && this.tools.preview) {
        await this.tools.preview.start();
        this.state.tools.preview = true;
        startedTools.push("preview");
      }

      // Start dashboard last to coordinate all other tools
      if (this.tools.dashboard) {
        await this.tools.dashboard.start();
        this.state.tools.dashboard = true;
        startedTools.push("dashboard");
      }

      this.emit('tools-started', startedTools);
      
      if (this.config.persistState) {
        await this.saveState();
      }

      this.logger.info("Development experience started", {
        tools: startedTools,
        dashboardUrl: this.tools.dashboard && this.enigmaConfig.dev?.dashboard ? `http://${this.enigmaConfig.dev.dashboard.host}:${this.enigmaConfig.dev.dashboard.port}` : undefined,
      });

      // Send notification
      this.sendNotification('info', 'Development experience started', {
        tools: startedTools,
        url: this.tools.dashboard && this.enigmaConfig.dev?.dashboard ? `http://${this.enigmaConfig.dev.dashboard.host}:${this.enigmaConfig.dev.dashboard.port}` : undefined,
      });

    } catch (_error) {
      // Reset state on failure
      this.isActive = false;
      this.state.isActive = false;
      
      this.logger.error("Failed to start development experience", { error });
      this.emit('error-detected', error as Error, 'startup');
      throw error;
    }
  }

  /**
   * Stop the development experience
   */
  async stop(): Promise<void> {
    if (!this.isActive) {
      this.logger.warn("Development experience not running");
      return;
    }

    this.isActive = false;
    this.state.isActive = false;
    this.logger.info("Stopping development experience");

    const stoppedTools: string[] = [];

    try {
      // Stop tools in reverse order
      if (this.tools.dashboard && this.state.tools.dashboard) {
        await this.tools.dashboard.stop();
        this.state.tools.dashboard = false;
        stoppedTools.push("dashboard");
      }

      if (this.tools.preview && this.state.tools.preview) {
        await this.tools.preview.stop();
        this.state.tools.preview = false;
        stoppedTools.push("preview");
      }

      if (this.tools.diagnostics && this.state.tools.diagnostics) {
        await this.tools.diagnostics.stop();
        this.state.tools.diagnostics = false;
        stoppedTools.push("diagnostics");
      }

      this.state.tools.debugUtils = false;
      this.state.tools.sourceMap = false;
      if (stoppedTools.length > 0) {
        stoppedTools.push("debugUtils", "sourceMap");
      }

      this.emit('tools-stopped', stoppedTools);

      if (this.config.persistState) {
        await this.saveState();
      }

      this.logger.info("Development experience stopped", { tools: stoppedTools });

    } catch (_error) {
      this.logger.error("Error stopping development experience", { error });
      throw error;
    }
  }

  /**
   * Start a new development session
   */
  async startSession(files: string[]): Promise<string> {
    if (!this.isActive) {
      throw new Error("Development experience not active");
    }

    if (!this.tools.debugUtils) {
      throw new Error("Debug utils not available");
    }

    const sessionId = await this.tools.debugUtils.startSession(files, this.enigmaConfig);
    this.state.sessions.current = sessionId;
    this.state.sessions.history.push(sessionId);

    this.emit('session-started', sessionId);
    this.sendNotification('info', `Debug session started: ${sessionId}`, { files: files.length });

    if (this.config.persistState) {
      await this.saveState();
    }

    return sessionId;
  }

  /**
   * End the current development session
   */
  async endSession(): Promise<DebugSession | null> {
    if (!this.tools.debugUtils || !this.state.sessions.current) {
      return null;
    }

    const session = await this.tools.debugUtils.endSession();
    const sessionId = this.state.sessions.current;
    this.state.sessions.current = undefined;

    if (session) {
      this.emit('session-ended', sessionId, session);
      this.sendNotification('info', `Debug session completed: ${sessionId}`, {
        totalTime: session.performance.totalTime,
        classesAnalyzed: session.analysis.totalClasses,
      });
    }

    if (this.config.persistState) {
      await this.saveState();
    }

    return session;
  }

  /**
   * Get current development experience state
   */
  getState(): DevExperienceState {
    this.state.metrics.uptime = Date.now() - this.startTime;
    return { ...this.state };
  }

  /**
   * Get comprehensive metrics from all tools
   */
  async getComprehensiveMetrics(): Promise<{
    performance?: DevPerformanceMetrics;
    dashboard?: any;
    state: DevExperienceState;
  }> {
    const metrics: any = {
      state: this.getState(),
    };

    if (this.tools.diagnostics?.isRunning()) {
      metrics.performance = this.tools.diagnostics.getMetrics();
    }

    if (this.tools.dashboard) {
      metrics.dashboard = this.tools.dashboard.getDashboardState();
    }

    return metrics;
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<DevExperienceConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.logger.debug("Configuration updated", { config: this.config });
  }

  /**
   * Send notification through available channels
   */
  private sendNotification(level: string, message: string, data?: any): void {
    if (!this.config.notifications.enabled) {
      return;
    }

    const shouldSend = this.shouldSendNotification(level);
    if (!shouldSend) {
      return;
    }

    this.emit('notification', level, message, data);

    // Log the notification
    switch (level) {
      case 'debug':
        this.logger.debug(message, data);
        break;
      case 'info':
        this.logger.info(message, data);
        break;
      case 'warn':
        this.logger.warn(message, data);
        break;
      case 'error':
        this.logger.error(message, data);
        break;
      default:
        this.logger.info(message, data);
    }

    // Add to dashboard if available
    if (this.tools.dashboard) {
      this.tools.dashboard.addLogEntry(level as any, message, 'DevExperience', data);
    }
  }

  /**
   * Check if notification should be sent based on level
   */
  private shouldSendNotification(level: string): boolean {
    const levels = ['debug', 'info', 'warn', 'error'];
    const currentLevelIndex = levels.indexOf(this.config.notifications.level);
    const messageLevelIndex = levels.indexOf(level);
    return messageLevelIndex >= currentLevelIndex;
  }

  /**
   * Initialize development tools based on configuration
   */
  private async initializeTools(): Promise<void> {
    const config = this.enigmaConfig;
    
    // Initialize tools with safe configuration defaults
    const dashboardConfig = config.dev?.dashboard || {
      enabled: true,
      port: 3001,
      host: 'localhost',
      updateInterval: 1000,
      showMetrics: true,
      showLogs: true,
      maxLogEntries: 100,
    };

    const hotReloadConfig = (config.dev as any)?.hotReload || {
      enabled: true,
      port: 3002,
      host: 'localhost',
      debounceMs: 300,
      watchPatterns: ['src/**/*.css', 'src/**/*.html'],
    };

    const ideConfig = (config.dev as any)?.ide || {
      enabled: true,
      port: 3003,
      supportedIdes: ['vscode', 'webstorm', 'vim'],
      autocomplete: true,
      diagnostics: true,
    };

    // Initialize core development tools
    try {
      // Initialize diagnostics if performance monitoring is enabled
      if (this.config.enablePerformanceMonitoring) {
        this.tools.diagnostics = new DevDiagnostics(config);
      }

      // Initialize dashboard if enabled
      if (dashboardConfig.enabled) {
        this.tools.dashboard = new DevDashboard(dashboardConfig);
      }

      // Initialize preview if real-time preview is enabled
      if (this.config.enableRealTimePreview && config.dev?.preview) {
        this.tools.preview = new DevPreview(config.dev.preview, config);
      }

      // Initialize debug utils if debug console is enabled
      if (this.config.enableDebugConsole) {
        this.tools.debugUtils = new DebugUtils();
      }

      // Initialize source map generator if source maps are enabled
      if (this.config.enableSourceMaps) {
        this.tools.sourceMap = new SourceMapGenerator();
      }
    } catch (_error) {
      this.logger.warn("Some tools failed to initialize", { error });
    }

    // Initialize Enhanced Dashboard (only if base dashboard exists)
    if (this.tools.dashboard) {
      try {
        this.dashboardEnhanced = new DevDashboardEnhanced(
          this.tools.dashboard,
          {
            ...dashboardConfig,
            enhanced: {
              enabled: true,
              analytics: {
                enabled: true,
                retentionDays: 30,
                trackOptimizations: true,
                trackPerformance: true,
                trackFileChanges: true,
                trackClassUsage: true,
              },
              visualizations: {
                enabled: true,
                charts: {
                  performance: true,
                  optimization: true,
                  fileChanges: true,
                  classUsage: true,
                },
                realTime: true,
              },
              alerts: {
                enabled: true,
                performance: {
                  enabled: true,
                  buildTimeThreshold: 5000,
                  memoryThreshold: 512,
                  cpuThreshold: 80,
                },
                optimization: {
                  enabled: true,
                  savingsThreshold: 10,
                  errorThreshold: 5,
                },
              },
              reports: {
                enabled: true,
                formats: ['html', 'json', 'csv'],
                schedule: 'daily',
                email: false,
              },
            },
          } as any
        );
      } catch (_error) {
        this.logger.warn("Enhanced dashboard failed to initialize", { error });
      }
    }

    // Initialize Hot Reload (with error handling for missing ws dependency)
    try {
      this.hotReload = new DevHotReload(
        {},
        {
          ...config,
          dev: {
            ...(config.dev as any),
            hotReload: hotReloadConfig,
          },
        } as any
      );
    } catch (_error) {
      this.logger.warn("Hot reload failed to initialize", { error });
    }

    // Initialize IDE Integration
    try {
      this.ideIntegration = new DevIdeIntegration(
        {},
        {
          ...config,
          dev: {
            ...(config.dev as any),
            ide: ideConfig,
          },
        } as any
      );
    } catch (_error) {
      this.logger.warn("IDE integration failed to initialize", { error });
    }

    // Setup event coordination
    // this.setupEventCoordination(); // Method not implemented yet
  }

  /**
   * Setup event handlers for coordinating tools
   */
  private setupEventHandlers(): void {
    // Handle performance alerts
    this.on('performance-alert', (metric, value, threshold) => {
      if (this.config.performance.alertOnThresholds) {
        this.sendNotification('warn', `Performance alert: ${metric} exceeded threshold`, {
          metric,
          value,
          threshold,
        });
      }
    });

    // Handle optimization completion
    this.on('optimization-completed', (result) => {
      this.state.metrics.totalOptimizations++;
      this.sendNotification('info', 'Optimization completed', result);
    });

    // Handle errors
    this.on('error-detected', (error, _context) => {
      this.state.metrics.totalErrors++;
      this.sendNotification('error', `Error in ${context}: ${error.message}`, {
        error: error.message,
        context,
      });
    });

    // Handle file changes
    this.on('file-changed', (path, type) => {
      this.state.files.modified++;
      this.state.files.lastChange = new Date();
      
      if (this.config.enableHotReload) {
        // Trigger hot reload if supported
        this.sendNotification('debug', `File changed: ${path} (${type})`);
      }
    });
  }

  /**
   * Load previous state from disk
   */
  private async loadState(): Promise<void> {
    try {
      if (existsSync(this.stateFile)) {
        const content = await readFile(this.stateFile, 'utf-8');
        const savedState = JSON.parse(content);
        this.state = { ...this.state, ...savedState };
        this.logger.debug("Previous state loaded", { stateFile: this.stateFile });
      }
    } catch (_error) {
      this.logger.warn("Failed to load previous state", { error, stateFile: this.stateFile });
    }
  }

  /**
   * Save current state to disk
   */
  private async saveState(): Promise<void> {
    try {
      await mkdir(dirname(this.stateFile), { recursive: true });
      await writeFile(this.stateFile, JSON.stringify(this.state, null, 2));
      this.logger.debug("State saved", { stateFile: this.stateFile });
    } catch (_error) {
      this.logger.warn("Failed to save state", { error, stateFile: this.stateFile });
    }
  }
}

/**
 * Create a development experience manager instance
 */
export function createDevExperienceManager(
  config: EnigmaConfig,
  devExperienceConfig?: Partial<DevExperienceConfig>
): DevExperienceManager | null {
  if (!config.dev.enabled) {
    return null;
  }

  return new DevExperienceManager(devExperienceConfig, config);
}

/**
 * Type-safe event emitter interface
 */
// Interface declaration moved to class definition 