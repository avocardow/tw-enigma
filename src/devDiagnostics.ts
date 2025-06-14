/**
 * Copyright (c) 2025 Rowan Cardow
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { EventEmitter } from "events";
import { watch, FSWatcher } from "chokidar";
import { createLogger, Logger } from "./logger.ts";
import { EnigmaConfig } from "./config.ts";

/**
 * Performance metrics interface
 */
export interface DevPerformanceMetrics {
  memoryUsage: NodeJS.MemoryUsage;
  processingTime: number;
  cpuUsage: NodeJS.CpuUsage;
  eventLoopDelay: number;
  activeHandles: number;
  activeRequests: number;
}

/**
 * File watching statistics
 */
export interface FileWatchStats {
  watchedFiles: number;
  totalChanges: number;
  lastChange: Date | null;
  changesByType: Record<string, number>;
}

/**
 * Class analysis result
 */
export interface ClassAnalysisResult {
  totalClasses: number;
  frameworkClasses: number;
  customClasses: number;
  patterns: {
    tailwind: string[];
    bootstrap: string[];
    custom: string[];
  };
  duplicates: string[];
  unused: string[];
}

/**
 * Diagnostics configuration
 */
export interface DiagnosticsConfig {
  enabled: boolean;
  performance: boolean;
  memory: boolean;
  fileWatcher: boolean;
  classAnalysis: boolean;
  thresholds: {
    memoryWarning: number; // MB
    memoryError: number; // MB
    cpuWarning: number; // percentage
    cpuError: number; // percentage
  };
}

/**
 * Diagnostics events
 */
export interface DiagnosticsEvents {
  'performance-update': (metrics: DevPerformanceMetrics) => void;
  'threshold-exceeded': (type: string, value: number, threshold: number) => void;
  'file-change': (path: string, type: string) => void;
  'error': (error: Error) => void;
}

/**
 * Development diagnostics system
 * Provides performance monitoring, file watching, and class analysis
 */
export class DevDiagnostics extends EventEmitter {
  private config: DiagnosticsConfig;
  private logger: Logger;
  private isActive = false;
  private metricsInterval?: NodeJS.Timeout;
  private fileWatcher?: FSWatcher;
  private watchStats: FileWatchStats;
  private startTime: number;
  private lastCpuUsage: NodeJS.CpuUsage;

  constructor(config: Partial<DiagnosticsConfig> = {}) {
    super();
    
    this.config = {
      enabled: true,
      performance: true,
      memory: true,
      fileWatcher: true,
      classAnalysis: true,
      thresholds: {
        memoryWarning: 512,
        memoryError: 1024,
        cpuWarning: 80,
        cpuError: 95,
      },
      ...config,
    };

    this.logger = createLogger("DevDiagnostics");
    this.startTime = Date.now();
    this.lastCpuUsage = process.cpuUsage();
    
    this.watchStats = {
      watchedFiles: 0,
      totalChanges: 0,
      lastChange: null,
      changesByType: {},
    };

    this.logger.debug("Development diagnostics initialized", {
      config: this.config,
    });
  }

  /**
   * Start diagnostics monitoring
   */
  async start(): Promise<void> {
    if (this.isActive) {
      this.logger.warn("Development diagnostics already running");
      return;
    }

    if (!this.config.enabled) {
      this.logger.info("Development diagnostics disabled");
      return;
    }

    this.isActive = true;
    this.logger.info("Starting development diagnostics");

    // Start performance monitoring
    if (this.config.performance) {
      this.startPerformanceMonitoring();
    }

    // Start file watching
    if (this.config.fileWatcher) {
      this.startFileWatching();
    }

    this.logger.info("Development diagnostics started");
  }

  /**
   * Stop diagnostics monitoring
   */
  async stop(): Promise<void> {
    if (!this.isActive) {
      this.logger.warn("Development diagnostics not running");
      return;
    }

    this.isActive = false;
    this.logger.info("Stopping development diagnostics");

    // Stop performance monitoring
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
      this.metricsInterval = undefined;
    }

    // Stop file watching
    if (this.fileWatcher) {
      await this.fileWatcher.close();
      this.fileWatcher = undefined;
    }

    this.logger.info("Development diagnostics stopped");
  }

  /**
   * Check if diagnostics is running
   */
  isRunning(): boolean {
    return this.isActive;
  }

  /**
   * Get current performance metrics
   */
  getMetrics(): DevPerformanceMetrics {
    const memoryUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage(this.lastCpuUsage);
    this.lastCpuUsage = process.cpuUsage();

    return {
      memoryUsage,
      processingTime: Date.now() - this.startTime,
      cpuUsage,
      eventLoopDelay: this.measureEventLoopDelay(),
      activeHandles: (process as any)._getActiveHandles?.()?.length || 0,
      activeRequests: (process as any)._getActiveRequests?.()?.length || 0,
    };
  }

  /**
   * Get file watching statistics
   */
  getWatchStats(): FileWatchStats {
    return { ...this.watchStats };
  }

  /**
   * Analyze CSS class patterns
   */
  analyzeClasses(classes: string[]): ClassAnalysisResult {
    const tailwindPatterns = /^(bg-|text-|p-|m-|w-|h-|flex|grid|border|rounded)/;
    const bootstrapPatterns = /^(btn|card|nav|container|row|col)/;
    
    const result: ClassAnalysisResult = {
      totalClasses: classes.length,
      frameworkClasses: 0,
      customClasses: 0,
      patterns: {
        tailwind: [],
        bootstrap: [],
        custom: [],
      },
      duplicates: [],
      unused: [],
    };

    const classCount = new Map<string, number>();
    
    for (const className of classes) {
      // Count occurrences
      classCount.set(className, (classCount.get(className) || 0) + 1);
      
      // Classify patterns
      if (tailwindPatterns.test(className)) {
        result.patterns.tailwind.push(className);
        result.frameworkClasses++;
      } else if (bootstrapPatterns.test(className)) {
        result.patterns.bootstrap.push(className);
        result.frameworkClasses++;
      } else {
        result.patterns.custom.push(className);
        result.customClasses++;
      }
    }

    // Find duplicates
    for (const [className, count] of Array.from(classCount.entries())) {
      if (count > 1) {
        result.duplicates.push(className);
      }
    }

    return result;
  }

  /**
   * Start performance monitoring
   */
  private startPerformanceMonitoring(): void {
    this.metricsInterval = setInterval(() => {
      const metrics = this.getMetrics();
      
      // Check thresholds
      this.checkThresholds(metrics);
      
      // Emit update
      this.emit('performance-update', metrics);
      
      this.logger.debug("Performance metrics updated", {
        memoryMB: Math.round(metrics.memoryUsage.heapUsed / 1024 / 1024),
        eventLoopDelay: metrics.eventLoopDelay,
      });
    }, 1000); // Update every second
  }

  /**
   * Start file watching
   */
  private startFileWatching(): void {
    const patterns = [
      'src/**/*.{css,html,js,jsx,ts,tsx}',
      'styles/**/*.css',
      'public/**/*.html',
    ];

    this.fileWatcher = watch(patterns, {
      ignored: /node_modules|\.git/,
      persistent: true,
    });

    // Safety check to ensure fileWatcher is defined before chaining
    if (this.fileWatcher) {
      this.fileWatcher
        .on('add', (path) => this.handleFileChange(path, 'add'))
        .on('change', (path) => this.handleFileChange(path, 'change'))
        .on('unlink', (path) => this.handleFileChange(path, 'unlink'))
        .on('error', (error) => {
          this.logger.error("File watcher error", { error });
          this.emit('error', error);
        });

      this.logger.debug("File watching started", { patterns });
    } else {
      this.logger.warn("File watcher could not be initialized");
    }
  }

  /**
   * Handle file change events
   */
  private handleFileChange(path: string, type: string): void {
    this.watchStats.totalChanges++;
    this.watchStats.lastChange = new Date();
    this.watchStats.changesByType[type] = (this.watchStats.changesByType[type] || 0) + 1;

    this.emit('file-change', path, type);
    
    this.logger.debug("File change detected", { path, type });
  }

  /**
   * Check performance thresholds
   */
  private checkThresholds(metrics: DevPerformanceMetrics): void {
    const memoryMB = metrics.memoryUsage.heapUsed / 1024 / 1024;
    
    // Memory thresholds
    if (memoryMB > this.config.thresholds.memoryError) {
      this.emit('threshold-exceeded', 'memory', memoryMB, this.config.thresholds.memoryError);
      this.logger.error("Memory usage critical", { memoryMB, threshold: this.config.thresholds.memoryError });
    } else if (memoryMB > this.config.thresholds.memoryWarning) {
      this.emit('threshold-exceeded', 'memory', memoryMB, this.config.thresholds.memoryWarning);
      this.logger.warn("Memory usage high", { memoryMB, threshold: this.config.thresholds.memoryWarning });
    }

    // CPU thresholds (simplified calculation)
    const cpuPercent = this.calculateCpuPercent(metrics.cpuUsage);
    if (cpuPercent > this.config.thresholds.cpuError) {
      this.emit('threshold-exceeded', 'cpu', cpuPercent, this.config.thresholds.cpuError);
      this.logger.error("CPU usage critical", { cpuPercent, threshold: this.config.thresholds.cpuError });
    } else if (cpuPercent > this.config.thresholds.cpuWarning) {
      this.emit('threshold-exceeded', 'cpu', cpuPercent, this.config.thresholds.cpuWarning);
      this.logger.warn("CPU usage high", { cpuPercent, threshold: this.config.thresholds.cpuWarning });
    }
  }

  /**
   * Measure event loop delay (simplified)
   */
  private measureEventLoopDelay(): number {
    const start = process.hrtime.bigint();
    setImmediate(() => {
      const delay = Number(process.hrtime.bigint() - start) / 1000000; // Convert to ms
      return delay;
    });
    return 0; // Simplified for now
  }

  /**
   * Calculate CPU percentage (simplified)
   */
  private calculateCpuPercent(cpuUsage: NodeJS.CpuUsage): number {
    // Simplified CPU calculation
    const totalUsage = cpuUsage.user + cpuUsage.system;
    return Math.min(100, (totalUsage / 1000000) * 100); // Convert microseconds to percentage
  }
}

/**
 * Create and configure development diagnostics
 */
export function createDevDiagnostics(config: EnigmaConfig): DevDiagnostics | null {
  if (!config.dev?.diagnostics?.enabled) {
    return null;
  }

  const diagnosticsConfig: DiagnosticsConfig = {
    enabled: config.dev.diagnostics.enabled,
    performance: config.dev.diagnostics.performance ?? true,
    memory: config.dev.diagnostics.memory ?? true,
    fileWatcher: config.dev.diagnostics.fileWatcher ?? true,
    classAnalysis: config.dev.diagnostics.classAnalysis ?? true,
    thresholds: {
      memoryWarning: config.dev.diagnostics.thresholds?.memoryWarning ?? 512,
      memoryError: config.dev.diagnostics.thresholds?.memoryError ?? 1024,
      cpuWarning: config.dev.diagnostics.thresholds?.cpuWarning ?? 80,
      cpuError: config.dev.diagnostics.thresholds?.cpuError ?? 95,
    },
  };

  return new DevDiagnostics(diagnosticsConfig);
}

// Type declarations for events
// EventEmitter interface augmentation for DevDiagnostics
// eslint-disable-next-line @typescript-eslint/no-unused-vars
interface DevDiagnosticsEventEmitter {
  on<K extends keyof DiagnosticsEvents>(event: K, listener: DiagnosticsEvents[K]): this;
  emit<K extends keyof DiagnosticsEvents>(event: K, ...args: Parameters<DiagnosticsEvents[K]>): boolean;
} 