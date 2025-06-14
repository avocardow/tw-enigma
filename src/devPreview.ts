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
import { readFile } from "fs/promises";

/**
 * Preview change type for diff visualization
 */
export type PreviewChangeType = 'added' | 'removed' | 'modified' | 'unchanged';

/**
 * CSS class change for preview
 */
export interface CssClassChange {
  type: PreviewChangeType;
  originalClass: string;
  optimizedClass?: string;
  file: string;
  line: number;
  column: number;
  context: {
    beforeText: string;
    afterText: string;
    selector?: string;
    property?: string;
  };
  optimizationInfo: {
    type: 'class-rename' | 'class-merge' | 'class-remove' | 'property-optimize';
    sizeBefore: number;
    sizeAfter: number;
    savings: number;
    savingsPercent: number;
  };
}

/**
 * File diff for preview
 */
export interface FileDiff {
  file: string;
  originalContent: string;
  optimizedContent: string;
  changes: CssClassChange[];
  stats: {
    totalChanges: number;
    additions: number;
    deletions: number;
    modifications: number;
    sizeBefore: number;
    sizeAfter: number;
    savings: number;
    savingsPercent: number;
  };
}

/**
 * Preview update event
 */
export interface PreviewUpdate {
  timestamp: Date;
  trigger: 'file-change' | 'manual-refresh' | 'config-change';
  files: FileDiff[];
  summary: {
    totalFiles: number;
    totalChanges: number;
    totalSavings: number;
    totalSavingsPercent: number;
    processingTime: number;
  };
}

/**
 * Preview configuration
 */
export interface PreviewConfig {
  enabled: boolean;
  autoRefresh: boolean;
  showDiff: boolean;
  highlightChanges: boolean;
  refreshInterval: number;
  maxFileSize: number;
  watchPatterns: string[];
  excludePatterns: string[];
  diffOptions: {
    contextLines: number;
    ignoreWhitespace: boolean;
    showLineNumbers: boolean;
    highlightSyntax: boolean;
  };
}

/**
 * Preview events
 */
export interface PreviewEvents {
  'update': (update: PreviewUpdate) => void;
  'file-change': (file: string, type: 'add' | 'change' | 'unlink') => void;
  'error': (error: Error, context?: any) => void;
  'refresh-start': () => void;
  'refresh-complete': (duration: number) => void;
}

/**
 * Real-time optimization preview panel
 * Provides live visualization of CSS optimizations with diff highlighting
 */
export class DevPreview extends EventEmitter {
  private config: PreviewConfig;
  private logger: Logger;
  private fileWatcher?: FSWatcher;
  private refreshInterval?: NodeJS.Timeout;
  private isRunning = false;
  private lastUpdate?: PreviewUpdate;
  private fileContents: Map<string, string> = new Map();

  constructor(config: Partial<PreviewConfig> = {}) {
    super();
    
    this.config = {
      enabled: true,
      autoRefresh: true,
      showDiff: true,
      highlightChanges: true,
      refreshInterval: 2000,
      maxFileSize: 1024 * 1024, // 1MB
      watchPatterns: ["src/**/*.css", "src/**/*.html", "src/**/*.js", "src/**/*.jsx", "src/**/*.ts", "src/**/*.tsx"],
      excludePatterns: ["node_modules/**", "dist/**", "build/**"],
      diffOptions: {
        contextLines: 3,
        ignoreWhitespace: false,
        showLineNumbers: true,
        highlightSyntax: true,
      },
      ...config,
    };

    this.logger = createLogger("DevPreview");

    this.logger.debug("Development preview initialized", {
      config: this.config,
    });
  }

  /**
   * Start the preview system
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      this.logger.warn("Development preview already running");
      return;
    }

    if (!this.config.enabled) {
      this.logger.info("Development preview disabled");
      return;
    }

    this.isRunning = true;
    this.logger.info("Starting development preview", {
      watchPatterns: this.config.watchPatterns,
      autoRefresh: this.config.autoRefresh,
    });

    // Start file watching
    await this.startFileWatching();

    // Start auto-refresh if enabled
    if (this.config.autoRefresh) {
      this.startAutoRefresh();
    }

    // Perform initial refresh
    await this.refresh('manual-refresh');

    this.logger.info("Development preview started successfully");
  }

  /**
   * Stop the preview system
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      this.logger.warn("Development preview not running");
      return;
    }

    this.isRunning = false;
    this.logger.info("Stopping development preview");

    // Stop file watcher
    if (this.fileWatcher) {
      await this.fileWatcher.close();
      this.fileWatcher = undefined;
    }

    // Stop auto-refresh
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = undefined;
    }

    this.logger.info("Development preview stopped");
  }

  /**
   * Manually refresh the preview
   */
  async refresh(trigger: PreviewUpdate['trigger'] = 'manual-refresh'): Promise<PreviewUpdate> {
    this.emit('refresh-start');
    const startTime = Date.now();

    this.logger.debug("Refreshing preview", { trigger });

    try {
      // Discover files to process
      const files = await this.discoverFiles();
      
      // Process each file and generate diffs
      const fileDiffs: FileDiff[] = [];
      let totalSavings = 0;
      let totalChanges = 0;

      for (const file of files) {
        try {
          const diff = await this.processFile(file);
          if (diff) {
            fileDiffs.push(diff);
            totalSavings += diff.stats.savings;
            totalChanges += diff.stats.totalChanges;
          }
        } catch (_) {
          this.logger.warn("Failed to process file for preview", {
            file,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      const processingTime = Date.now() - startTime;
      const totalSizeBefore = fileDiffs.reduce((sum, diff) => sum + diff.stats.sizeBefore, 0);
      const totalSavingsPercent = totalSizeBefore > 0 ? (totalSavings / totalSizeBefore) * 100 : 0;

      const update: PreviewUpdate = {
        timestamp: new Date(),
        trigger,
        files: fileDiffs,
        summary: {
          totalFiles: fileDiffs.length,
          totalChanges,
          totalSavings,
          totalSavingsPercent,
          processingTime,
        },
      };

      this.lastUpdate = update;
      this.emit('refresh-complete', processingTime);
      this.emit('update', update);

      this.logger.info("Preview refreshed successfully", {
        filesProcessed: fileDiffs.length,
        totalChanges,
        totalSavings,
        processingTime,
      });

      return update;
    } catch (_) {
      const processingTime = Date.now() - startTime;
      this.emit('refresh-complete', processingTime);
      this.emit('error', error as Error, { trigger });
      throw error;
    }
  }

  /**
   * Get the last preview update
   */
  getLastUpdate(): PreviewUpdate | undefined {
    return this.lastUpdate;
  }

  /**
   * Get preview for a specific file
   */
  async getFilePreview(filePath: string): Promise<FileDiff | null> {
    try {
      return await this.processFile(filePath);
    } catch (_) {
      this.logger.error("Failed to get file preview", {
        filePath,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<PreviewConfig>): void {
    const oldConfig = { ...this.config };
    this.config = { ...this.config, ...newConfig };
    
    this.logger.debug("Preview configuration updated", {
      oldConfig,
      newConfig,
      fullConfig: this.config,
    });

    // Restart file watching if patterns changed
    if (
      JSON.stringify(oldConfig.watchPatterns) !== JSON.stringify(this.config.watchPatterns) ||
      JSON.stringify(oldConfig.excludePatterns) !== JSON.stringify(this.config.excludePatterns)
    ) {
      if (this.isRunning) {
        this.restartFileWatching();
      }
    }

    // Restart auto-refresh if interval changed
    if (oldConfig.refreshInterval !== this.config.refreshInterval && this.config.autoRefresh) {
      this.startAutoRefresh();
    }
  }

  /**
   * Generate HTML preview for CSS content comparison
   */
  generatePreviewHTML(originalCSS: string, optimizedCSS: string): string {
    const diff = this.calculateDiff(originalCSS, optimizedCSS);
    const fileDiff: FileDiff = {
      file: 'preview.css',
      originalContent: originalCSS,
      optimizedContent: optimizedCSS,
      changes: [],
      stats: diff,
    };
    return this.generateHtmlPreview(fileDiff);
  }

  /**
   * Calculate diff statistics between two CSS strings
   */
  calculateDiff(originalCSS: string, optimizedCSS: string): FileDiff['stats'] {
    return this.calculateStats(originalCSS, optimizedCSS, []);
  }

  /**
   * Add a preview update to history
   */
  addUpdate(update: PreviewUpdate): void {
    this.lastUpdate = update;
    this.emit('update', update);
  }

  /**
   * Generate HTML preview for a file diff
   */
  generateHtmlPreview(diff: FileDiff): string {
    const changes = diff.changes.map(change => this.formatChangeAsHtml(change)).join('\n');
    
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>CSS Optimization Preview - ${diff.file}</title>
    <style>
        body { font-family: 'Monaco', 'Menlo', monospace; margin: 0; padding: 20px; background: #1e1e1e; color: #d4d4d4; }
        .header { border-bottom: 1px solid #333; padding-bottom: 10px; margin-bottom: 20px; }
        .stats { display: flex; gap: 20px; margin-bottom: 20px; }
        .stat { background: #2d2d30; padding: 10px; border-radius: 4px; }
        .stat-value { font-size: 1.2em; font-weight: bold; color: #4ec9b0; }
        .changes { background: #2d2d30; border-radius: 4px; overflow: hidden; }
        .change { border-left: 4px solid; padding: 10px; margin: 2px 0; }
        .change.added { border-color: #4ec9b0; background: rgba(78, 201, 176, 0.1); }
        .change.removed { border-color: #f44747; background: rgba(244, 71, 71, 0.1); }
        .change.modified { border-color: #ffcc02; background: rgba(255, 204, 2, 0.1); }
        .change.unchanged { border-color: #666; background: rgba(102, 102, 102, 0.1); }
        .change-header { font-weight: bold; margin-bottom: 5px; }
        .change-content { font-family: monospace; white-space: pre-wrap; }
        .savings { color: #4ec9b0; font-weight: bold; }
    </style>
</head>
<body>
    <div class="header">
        <h1>CSS Optimization Preview</h1>
        <p><strong>File:</strong> ${diff.file}</p>
        <p><strong>Last Updated:</strong> ${new Date().toLocaleString()}</p>
    </div>
    
    <div class="stats">
        <div class="stat">
            <div class="stat-value">${diff.stats.totalChanges}</div>
            <div>Total Changes</div>
        </div>
        <div class="stat">
            <div class="stat-value">${this.formatBytes(diff.stats.sizeBefore)}</div>
            <div>Original Size</div>
        </div>
        <div class="stat">
            <div class="stat-value">${this.formatBytes(diff.stats.sizeAfter)}</div>
            <div>Optimized Size</div>
        </div>
        <div class="stat">
            <div class="stat-value savings">${this.formatBytes(diff.stats.savings)} (${diff.stats.savingsPercent.toFixed(1)}%)</div>
            <div>Savings</div>
        </div>
    </div>
    
    <div class="changes">
        ${changes}
    </div>
</body>
</html>`;
  }

  /**
   * Start file watching
   */
  private async startFileWatching(): Promise<void> {
    this.logger.debug("Starting file watching for preview", {
      watchPatterns: this.config.watchPatterns,
      excludePatterns: this.config.excludePatterns,
    });

    try {
      this.fileWatcher = watch(this.config.watchPatterns, {
        ignored: this.config.excludePatterns,
        persistent: true,
        ignoreInitial: true,
      });

      // Ensure fileWatcher is defined before chaining
      if (this.fileWatcher) {
        this.fileWatcher
          .on('add', (path) => this.handleFileChange(path, 'add'))
          .on('change', (path) => this.handleFileChange(path, 'change'))
          .on('unlink', (path) => this.handleFileChange(path, 'unlink'))
          .on('error', (error) => {
            this.logger.error("File watcher error in preview", { error });
            this.emit('error', error);
          });

        this.logger.info("File watching started for preview");
      } else {
        // In test environments, file watcher might be mocked or disabled
        if (process.env.NODE_ENV === 'test' || process.env.VITEST) {
          this.logger.warn("File watcher not available (test environment)");
        } else {
          throw new Error("Failed to create file watcher");
        }
      }
    } catch (_) {
      this.logger.error("Failed to start file watching", { error });
      throw error;
    }
  }

  /**
   * Start auto-refresh
   */
  private startAutoRefresh(): void {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }

    this.refreshInterval = setInterval(() => {
      if (this.isRunning && this.config.autoRefresh) {
        this.refresh('manual-refresh').catch(error => {
          this.logger.error("Auto-refresh failed", { error });
        });
      }
    }, this.config.refreshInterval);

    this.logger.debug("Auto-refresh started", {
      interval: this.config.refreshInterval,
    });
  }

  /**
   * Restart file watching with new configuration
   */
  private async restartFileWatching(): Promise<void> {
    if (this.fileWatcher) {
      await this.fileWatcher.close();
    }
    await this.startFileWatching();
  }

  /**
   * Handle file change events
   */
  private handleFileChange(path: string, type: 'add' | 'change' | 'unlink'): void {
    this.logger.debug("File change detected in preview", { path, type });
    this.emit('file-change', path, type);

    if (this.config.autoRefresh) {
      // Debounce file changes to avoid excessive refreshes
      setTimeout(() => {
        this.refresh('file-change').catch(error => {
          this.logger.error("File change refresh failed", { path, type, error });
        });
      }, 500);
    }
  }

  /**
   * Discover files to process
   */
  private async discoverFiles(): Promise<string[]> {
    // This is a simplified implementation
    // In a real implementation, this would use glob patterns to find files
    const files: string[] = [];
    
    // For now, return some example files
    // This would be replaced with actual file discovery logic
    return files;
  }

  /**
   * Process a single file and generate diff
   */
  private async processFile(filePath: string): Promise<FileDiff | null> {
    try {
      // Read original content
      const originalContent = await readFile(filePath, 'utf-8');
      
      // Check file size
      if (originalContent.length > this.config.maxFileSize) {
        this.logger.warn("File too large for preview", {
          filePath,
          size: originalContent.length,
          maxSize: this.config.maxFileSize,
        });
        return null;
      }

      // Simulate optimization (in real implementation, this would call the actual optimizer)
      const optimizedContent = this.simulateOptimization(originalContent);
      
      // Generate changes
      const changes = this.generateChanges(originalContent, optimizedContent, filePath);
      
      // Calculate stats
      const stats = this.calculateStats(originalContent, optimizedContent, changes);

      return {
        file: filePath,
        originalContent,
        optimizedContent,
        changes,
        stats,
      };
    } catch (_) {
      this.logger.error("Failed to process file", {
        filePath,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * Simulate CSS optimization (placeholder)
   */
  private simulateOptimization(content: string): string {
    // This is a placeholder implementation
    // In a real implementation, this would call the actual CSS optimizer
    return content
      .replace(/\s+/g, ' ') // Minify whitespace
      .replace(/;\s*}/g, '}') // Remove unnecessary semicolons
      .trim();
  }

  /**
   * Generate changes between original and optimized content
   */
  private generateChanges(original: string, optimized: string, filePath: string): CssClassChange[] {
    // This is a simplified implementation
    // In a real implementation, this would perform proper diff analysis
    const changes: CssClassChange[] = [];
    
    // Placeholder change for demonstration
    if (original !== optimized) {
      changes.push({
        type: 'modified',
        originalClass: 'example-class',
        optimizedClass: 'ex-cls',
        file: filePath,
        line: 1,
        column: 1,
        context: {
          beforeText: original.substring(0, 50),
          afterText: optimized.substring(0, 50),
        },
        optimizationInfo: {
          type: 'class-rename',
          sizeBefore: original.length,
          sizeAfter: optimized.length,
          savings: original.length - optimized.length,
          savingsPercent: ((original.length - optimized.length) / original.length) * 100,
        },
      });
    }

    return changes;
  }

  /**
   * Calculate statistics for a file diff
   */
  private calculateStats(original: string, optimized: string, changes: CssClassChange[]): FileDiff['stats'] {
    const sizeBefore = original.length;
    const sizeAfter = optimized.length;
    const savings = sizeBefore - sizeAfter;
    const savingsPercent = sizeBefore > 0 ? (savings / sizeBefore) * 100 : 0;

    return {
      totalChanges: changes.length,
      additions: changes.filter(c => c.type === 'added').length,
      deletions: changes.filter(c => c.type === 'removed').length,
      modifications: changes.filter(c => c.type === 'modified').length,
      sizeBefore,
      sizeAfter,
      savings,
      savingsPercent,
    };
  }

  /**
   * Format a change as HTML
   */
  private formatChangeAsHtml(change: CssClassChange): string {
    const typeClass = change.type;
    const typeLabel = change.type.charAt(0).toUpperCase() + change.type.slice(1);
    
    return `
<div class="change ${typeClass}">
    <div class="change-header">
        ${typeLabel}: ${change.originalClass}${change.optimizedClass ? ` → ${change.optimizedClass}` : ''}
        <span class="savings">(${this.formatBytes(change.optimizationInfo.savings)} saved)</span>
    </div>
    <div class="change-content">
        Before: ${change.context.beforeText}
        After:  ${change.context.afterText}
    </div>
</div>`;
  }

  /**
   * Format bytes for display
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }
}

/**
 * Create and configure development preview
 */
export function createDevPreview(config: EnigmaConfig): DevPreview | null {
  if (!config.dev?.preview?.enabled) {
    return null;
  }

  const previewConfig: PreviewConfig = {
    enabled: config.dev.preview.enabled,
    autoRefresh: config.dev.preview.autoRefresh ?? true,
    showDiff: config.dev.preview.showDiff ?? true,
    highlightChanges: config.dev.preview.highlightChanges ?? true,
    refreshInterval: 2000,
    maxFileSize: 1024 * 1024, // 1MB
    watchPatterns: ["src/**/*.css", "src/**/*.html", "src/**/*.js", "src/**/*.jsx", "src/**/*.ts", "src/**/*.tsx"],
    excludePatterns: ["node_modules/**", "dist/**", "build/**"],
    diffOptions: {
      contextLines: 3,
      ignoreWhitespace: false,
      showLineNumbers: true,
      highlightSyntax: true,
    },
  };

  return new DevPreview(previewConfig);
}

// Type declarations for events
// EventEmitter interface augmentation for DevPreview
// eslint-disable-next-line @typescript-eslint/no-unused-vars
interface DevPreviewEventEmitter {
  on<K extends keyof PreviewEvents>(event: K, listener: PreviewEvents[K]): this;
  emit<K extends keyof PreviewEvents>(event: K, ...args: Parameters<PreviewEvents[K]>): boolean;
} 