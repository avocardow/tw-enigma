/**
 * Copyright (c) 2025 Rowan Cardow
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { EventEmitter } from "events";
import { watch, FSWatcher } from "chokidar";
import { readFileSync, existsSync, statSync } from "fs";
import { resolve, basename } from "path";
import { logger } from "./logger.ts";
import { ConfigError } from "./errors.ts";
import { validateConfig } from "./configValidator.ts";
import type { EnigmaConfig } from "./config.ts";
import type { ValidationResult } from "./configValidator.ts";

/**
 * Configuration watcher events
 */
export interface ConfigWatcherEvents {
  "config-changed": (result: ConfigChangeResult) => void;
  "config-validated": (result: ValidationResult) => void;
  "config-error": (error: ConfigError) => void;
  "file-added": (filepath: string) => void;
  "file-removed": (filepath: string) => void;
  "watcher-ready": () => void;
  "watcher-error": (error: Error) => void;
}

/**
 * Configuration change result
 */
export interface ConfigChangeResult {
  filepath: string;
  timestamp: Date;
  changeType: "added" | "changed" | "removed";
  isValid: boolean;
  config?: EnigmaConfig;
  validation?: ValidationResult;
  error?: ConfigError;
  previousConfig?: EnigmaConfig;
}

/**
 * Configuration watcher options
 */
export interface ConfigWatcherOptions {
  enabled: boolean;
  debounceMs: number;
  ignoreInitial: boolean;
  persistent: boolean;
  followSymlinks: boolean;
  ignorePermissionErrors: boolean;
  atomic: boolean;
  awaitWriteFinish: {
    stabilityThreshold: number;
    pollInterval: number;
  };
  watchPatterns: string[];
  ignorePatterns: string[];
  validateOnChange: boolean;
  backupOnChange: boolean;
  maxBackups: number;
}

/**
 * File change tracking
 */
interface FileChangeTracker {
  filepath: string;
  lastModified: Date;
  lastSize: number;
  changeCount: number;
  isStable: boolean;
  debounceTimer?: NodeJS.Timeout;
}

/**
 * Configuration file watcher
 */
export class ConfigWatcher extends EventEmitter {
  private options: ConfigWatcherOptions;
  private watcher?: FSWatcher;
  private isWatching: boolean = false;
  private watchedFiles: Set<string> = new Set();
  private fileTrackers: Map<string, FileChangeTracker> = new Map();
  private currentConfig?: EnigmaConfig;
  private configHistory: Array<{ timestamp: Date; config: EnigmaConfig; filepath: string }> = [];

  constructor(options?: Partial<ConfigWatcherOptions>) {
    super();
    
    this.options = {
      enabled: true,
      debounceMs: 300,
      ignoreInitial: true,
      persistent: true,
      followSymlinks: false,
      ignorePermissionErrors: true,
      atomic: true,
      awaitWriteFinish: {
        stabilityThreshold: 100,
        pollInterval: 100,
      },
      watchPatterns: [
        "**/.enigmarc*",
        "**/enigma.config.*",
        "**/package.json",
        "**/.env*",
      ],
      ignorePatterns: [
        "**/node_modules/**",
        "**/.git/**",
        "**/dist/**",
        "**/build/**",
        "**/*.tmp",
        "**/*.temp",
        "**/.DS_Store",
      ],
      validateOnChange: true,
      backupOnChange: true,
      maxBackups: 10,
      ...options,
    };

    logger.debug("ConfigWatcher initialized", { options: this.options });
  }

  /**
   * Start watching configuration files
   */
  public async start(watchPaths?: string[]): Promise<void> {
    if (this.isWatching) {
      logger.warn("ConfigWatcher is already running");
      return;
    }

    if (!this.options.enabled) {
      logger.info("ConfigWatcher is disabled");
      return;
    }

    const pathsToWatch = watchPaths || this.options.watchPatterns;
    
    logger.info("Starting configuration file watcher", {
      paths: pathsToWatch,
      debounceMs: this.options.debounceMs,
    });

    try {
      this.watcher = watch(pathsToWatch, {
        ignored: this.options.ignorePatterns,
        ignoreInitial: this.options.ignoreInitial,
        persistent: this.options.persistent,
        followSymlinks: this.options.followSymlinks,
        ignorePermissionErrors: this.options.ignorePermissionErrors,
        atomic: this.options.atomic,
        awaitWriteFinish: this.options.awaitWriteFinish,
      });

      this.setupWatcherEvents();
      this.isWatching = true;

      // Wait for watcher to be ready
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error("Watcher initialization timeout"));
        }, 5000);

        this.watcher!.on("ready", () => {
          clearTimeout(timeout);
          resolve();
        });

        this.watcher!.on("error", (error) => {
          clearTimeout(timeout);
          reject(error);
        });
      });

      logger.info("Configuration file watcher started successfully");
      this.emit("watcher-ready");
    } catch (error) {
      logger.error("Failed to start configuration file watcher", { error });
      this.emit("watcher-error", error as Error);
      throw new ConfigError(
        `Failed to start configuration file watcher: ${error instanceof Error ? error.message : String(error)}`,
        undefined,
        error as Error,
        { operation: "startWatcher" }
      );
    }
  }

  /**
   * Stop watching configuration files
   */
  public async stop(): Promise<void> {
    if (!this.isWatching) {
      return;
    }

    logger.info("Stopping configuration file watcher");

    // Clear all debounce timers
    for (const tracker of this.fileTrackers.values()) {
      if (tracker.debounceTimer) {
        clearTimeout(tracker.debounceTimer);
      }
    }

    this.fileTrackers.clear();
    this.watchedFiles.clear();

    if (this.watcher) {
      await this.watcher.close();
      this.watcher = undefined;
    }

    this.isWatching = false;
    logger.info("Configuration file watcher stopped");
  }

  /**
   * Add a file or pattern to watch
   */
  public addWatch(path: string): void {
    if (!this.watcher) {
      throw new ConfigError("Watcher not initialized", path, undefined, { operation: "addWatch" });
    }

    logger.debug("Adding watch path", { path });
    this.watcher.add(path);
    this.watchedFiles.add(resolve(path));
  }

  /**
   * Remove a file or pattern from watching
   */
  public removeWatch(path: string): void {
    if (!this.watcher) {
      return;
    }

    logger.debug("Removing watch path", { path });
    this.watcher.unwatch(path);
    this.watchedFiles.delete(resolve(path));
    this.fileTrackers.delete(resolve(path));
  }

  /**
   * Get currently watched files
   */
  public getWatchedFiles(): string[] {
    return Array.from(this.watchedFiles);
  }

  /**
   * Get configuration change history
   */
  public getConfigHistory(): Array<{ timestamp: Date; config: EnigmaConfig; filepath: string }> {
    return [...this.configHistory];
  }

  /**
   * Manually trigger validation of a configuration file
   */
  public async validateFile(filepath: string): Promise<ValidationResult> {
    logger.debug("Manually validating configuration file", { filepath });

    try {
      const config = await this.loadConfigFile(filepath);
      const validation = await validateConfig(config, filepath);

      this.emit("config-validated", validation);
      return validation;
    } catch (error) {
      logger.error("Manual configuration validation failed", { filepath, error });
      
      const configError = new ConfigError(
        `Manual validation failed for ${filepath}: ${error instanceof Error ? error.message : String(error)}`,
        filepath,
        error as Error,
        { operation: "manualValidation" }
      );

      this.emit("config-error", configError);
      throw configError;
    }
  }

  /**
   * Set up watcher event handlers
   */
  private setupWatcherEvents(): void {
    if (!this.watcher) {
      return;
    }

    this.watcher.on("add", (filepath) => {
      logger.debug("Configuration file added", { filepath });
      this.watchedFiles.add(resolve(filepath));
      this.emit("file-added", filepath);
      this.handleFileChange(filepath, "added");
    });

    this.watcher.on("change", (filepath) => {
      logger.debug("Configuration file changed", { filepath });
      this.handleFileChange(filepath, "changed");
    });

    this.watcher.on("unlink", (filepath) => {
      logger.debug("Configuration file removed", { filepath });
      this.watchedFiles.delete(resolve(filepath));
      this.fileTrackers.delete(resolve(filepath));
      this.emit("file-removed", filepath);
      this.handleFileChange(filepath, "removed");
    });

    this.watcher.on("error", (error) => {
      logger.error("Configuration watcher error", { error });
      this.emit("watcher-error", error);
    });

    this.watcher.on("ready", () => {
      logger.debug("Configuration watcher ready");
      this.emit("watcher-ready");
    });
  }

  /**
   * Handle file change with debouncing
   */
  private handleFileChange(filepath: string, changeType: "added" | "changed" | "removed"): void {
    const resolvedPath = resolve(filepath);
    
    // Get or create file tracker
    let tracker = this.fileTrackers.get(resolvedPath);
    if (!tracker) {
      tracker = {
        filepath: resolvedPath,
        lastModified: new Date(),
        lastSize: 0,
        changeCount: 0,
        isStable: false,
      };
      this.fileTrackers.set(resolvedPath, tracker);
    }

    // Clear existing debounce timer
    if (tracker.debounceTimer) {
      clearTimeout(tracker.debounceTimer);
    }

    // Update tracker
    tracker.lastModified = new Date();
    tracker.changeCount++;
    tracker.isStable = false;

    // Update file size if file exists
    if (changeType !== "removed" && existsSync(resolvedPath)) {
      try {
        const stats = statSync(resolvedPath);
        tracker.lastSize = stats.size;
      } catch (error) {
        logger.warn("Failed to get file stats", { filepath: resolvedPath, error });
      }
    }

    // Set up debounced processing
    tracker.debounceTimer = setTimeout(() => {
      this.processFileChange(resolvedPath, changeType, tracker!);
    }, this.options.debounceMs);
  }

  /**
   * Process file change after debounce period
   */
  private async processFileChange(filepath: string, changeType: "added" | "changed" | "removed", tracker: FileChangeTracker): Promise<void> {
    tracker.isStable = true;
    tracker.debounceTimer = undefined;

    logger.debug("Processing configuration file change", {
      filepath,
      changeType,
      changeCount: tracker.changeCount,
    });

    const result: ConfigChangeResult = {
      filepath,
      timestamp: new Date(),
      changeType,
      isValid: false,
      previousConfig: this.currentConfig,
    };

    try {
      if (changeType === "removed") {
        // Handle file removal
        result.isValid = true;
        this.emit("config-changed", result);
        return;
      }

      // Backup current configuration if enabled
      if (this.options.backupOnChange && this.currentConfig) {
        this.backupConfiguration(this.currentConfig, filepath);
      }

      // Load and validate the configuration
      if (this.options.validateOnChange) {
        const configData = await this.loadConfigFile(filepath);
        const validation = await validateConfig(configData, filepath);

        result.config = configData as EnigmaConfig;
        result.validation = validation;
        result.isValid = validation.isValid;

        if (validation.isValid) {
          this.currentConfig = configData as EnigmaConfig;
          this.addToHistory(configData as EnigmaConfig, filepath);
        }

        this.emit("config-validated", validation);
      } else {
        // Just load without validation
        const configData = await this.loadConfigFile(filepath);
        result.config = configData as EnigmaConfig;
        result.isValid = true;
        this.currentConfig = configData as EnigmaConfig;
        this.addToHistory(configData as EnigmaConfig, filepath);
      }

      this.emit("config-changed", result);
    } catch (error) {
      logger.error("Failed to process configuration file change", { filepath, error });
      
      const configError = new ConfigError(
        `Failed to process configuration change in ${filepath}: ${error instanceof Error ? error.message : String(error)}`,
        filepath,
        error as Error,
        { operation: "processFileChange", changeType }
      );

      result.error = configError;
      this.emit("config-error", configError);
      this.emit("config-changed", result);
    }
  }

  /**
   * Load configuration from file
   */
  private async loadConfigFile(filepath: string): Promise<unknown> {
    if (!existsSync(filepath)) {
      throw new ConfigError(`Configuration file not found: ${filepath}`, filepath);
    }

    try {
      const content = readFileSync(filepath, "utf-8");
      
      // Parse based on file extension
      const ext = filepath.toLowerCase();
      if (ext.endsWith(".json")) {
        return JSON.parse(content);
      } else if (ext.endsWith(".js") || ext.endsWith(".mjs")) {
        // For JS files, we'd need to use dynamic import or eval (not recommended)
        // For now, assume JSON format
        return JSON.parse(content);
      } else {
        // Try to parse as JSON by default
        return JSON.parse(content);
      }
    } catch (error) {
      throw new ConfigError(
        `Failed to parse configuration file ${filepath}: ${error instanceof Error ? error.message : String(error)}`,
        filepath,
        error as Error,
        { operation: "loadConfigFile" }
      );
    }
  }

  /**
   * Add configuration to history
   */
  private addToHistory(config: EnigmaConfig, filepath: string): void {
    this.configHistory.push({
      timestamp: new Date(),
      config: { ...config }, // Deep copy to prevent mutations
      filepath,
    });

    // Keep only recent history
    if (this.configHistory.length > 50) {
      this.configHistory = this.configHistory.slice(-50);
    }
  }

  /**
   * Backup current configuration
   */
  private backupConfiguration(config: EnigmaConfig, filepath: string): void {
    try {
      // This is a simplified backup - in a real implementation,
      // you might want to write to a backup directory
      logger.debug("Backing up configuration", { filepath });
      
      // Add to history as backup
      this.addToHistory(config, filepath);
    } catch (error) {
      logger.warn("Failed to backup configuration", { filepath, error });
    }
  }

  /**
   * Check if a file is a configuration file
   */
  private isConfigFile(filepath: string): boolean {
    const filename = basename(filepath).toLowerCase();
    const configPatterns = [
      /^\.enigmarc/,
      /^enigma\.config\./,
      /^package\.json$/,
      /^\.env/,
    ];

    return configPatterns.some(pattern => pattern.test(filename));
  }
}

/**
 * Factory function for creating configuration watcher
 */
export function createConfigWatcher(options?: Partial<ConfigWatcherOptions>): ConfigWatcher {
  return new ConfigWatcher(options);
}

/**
 * Convenience function for watching a specific configuration file
 */
export async function watchConfigFile(filepath: string, options?: Partial<ConfigWatcherOptions>): Promise<ConfigWatcher> {
  const watcher = createConfigWatcher(options);
  await watcher.start([filepath]);
  return watcher;
} 