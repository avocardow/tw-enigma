/**
 * Copyright (c) 2025 Rowan Cardow
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { EventEmitter } from "events";
import { watch, FSWatcher } from "chokidar";
import { createLogger, Logger } from "./logger";
import { EnigmaConfig } from "./config";
import { readFile } from "fs/promises";
import { extname } from "path";
import { createHash } from "crypto";

/**
 * Hot reload configuration
 */
export interface HotReloadConfig {
  enabled: boolean;
  port: number;
  host: string;
  debounceMs: number;
  includeSourceMaps: boolean;
  liveReload: boolean;
  hotSwapCSS: boolean;
  preserveState: boolean;
  notifyBrowser: boolean;
  autoConnect: boolean;
  reconnectAttempts: number;
  reconnectDelay: number;
  supportedFrameworks: string[];
  watchPatterns: string[];
  ignorePatterns: string[];
  optimizationTriggers: {
    onChange: boolean;
    onSave: boolean;
    onBuild: boolean;
    manual: boolean;
  };
  performance: {
    batchUpdates: boolean;
    maxBatchSize: number;
    throttleMs: number;
    enableAnalytics: boolean;
  };
}

/**
 * File change event
 */
export interface FileChangeEvent {
  path: string;
  type: 'add' | 'change' | 'unlink';
  timestamp: Date;
  size?: number;
  hash?: string;
  framework?: string;
  isCSS: boolean;
  isHTML: boolean;
  isJS: boolean;
  requiresOptimization: boolean;
  [key: string]: unknown; // Add index signature for compatibility with ErrorContext
}

/**
 * Optimization result for HMR
 */
export interface HMROptimizationResult {
  id: string;
  timestamp: Date;
  files: {
    input: string[];
    output: string[];
    modified: string[];
  };
  changes: {
    classesAdded: string[];
    classesRemoved: string[];
    classesModified: string[];
    sizeBefore: number;
    sizeAfter: number;
    reductionPercent: number;
  };
  performance: {
    analysisTime: number;
    optimizationTime: number;
    totalTime: number;
    memoryUsed: number;
  };
  sourceMap?: string;
  success: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * HMR client connection
 */
export interface HMRClient {
  id: string;
  socket: any;
  userAgent: string;
  connected: Date;
  lastPing: Date;
  framework?: string;
  capabilities: {
    css: boolean;
    javascript: boolean;
    sourceMap: boolean;
    liveReload: boolean;
  };
}

/**
 * Hot reload events
 */
export interface HotReloadEvents {
  'file-changed': (event: FileChangeEvent) => void;
  'optimization-started': (files: string[]) => void;
  'optimization-completed': (result: HMROptimizationResult) => void;
  'optimization-failed': (error: Error, files: string[]) => void;
  'client-connected': (client: HMRClient) => void;
  'client-disconnected': (clientId: string) => void;
  'css-updated': (cssPath: string, changes: any) => void;
  'reload-requested': (type: 'full' | 'css' | 'partial', files: string[]) => void;
  'error': (error: Error) => void;
  'performance-warning': (metric: string, value: number) => void;
}

/**
 * Enhanced Hot Module Replacement System
 * Provides real-time feedback for CSS optimization during development
 */
export class DevHotReload extends EventEmitter {
  private config: HotReloadConfig;
  private logger: Logger;
  private isActive = false;
  private watcher?: FSWatcher;
  private server?: any;
  private clients: Map<string, HMRClient> = new Map();
  private pendingChanges: Map<string, FileChangeEvent> = new Map();
  private debounceTimeout?: NodeJS.Timeout;
  private optimizationQueue: string[] = [];
  private isOptimizing = false;
  private optimizationHistory: HMROptimizationResult[] = [];
  private fileHashes: Map<string, string> = new Map();
  private startTime: number;

  constructor(
    config: Partial<HotReloadConfig> = {},
    private enigmaConfig: EnigmaConfig,
    private optimizationCallback?: (files: string[]) => Promise<any>
  ) {
    super();
    
    this.config = {
      enabled: true,
      port: 3002,
      host: 'localhost',
      debounceMs: 300,
      includeSourceMaps: true,
      liveReload: true,
      hotSwapCSS: true,
      preserveState: true,
      notifyBrowser: true,
      autoConnect: true,
      reconnectAttempts: 5,
      reconnectDelay: 1000,
      supportedFrameworks: ['react', 'vue', 'angular', 'svelte', 'vanilla'],
      watchPatterns: [
        '**/*.css',
        '**/*.scss',
        '**/*.sass',
        '**/*.less',
        '**/*.html',
        '**/*.htm',
        '**/*.js',
        '**/*.jsx',
        '**/*.ts',
        '**/*.tsx',
        '**/*.vue',
        '**/*.svelte',
      ],
      ignorePatterns: [
        '**/node_modules/**',
        '**/dist/**',
        '**/build/**',
        '**/.git/**',
        '**/.enigma/**',
        '**/coverage/**',
      ],
      optimizationTriggers: {
        onChange: true,
        onSave: true,
        onBuild: false,
        manual: true,
      },
      performance: {
        batchUpdates: true,
        maxBatchSize: 10,
        throttleMs: 100,
        enableAnalytics: true,
      },
      ...config,
    };

    this.logger = createLogger("DevHotReload");
    this.startTime = Date.now();

    this.logger.debug("Hot reload system initialized", { config: this.config });
  }

  /**
   * Start the hot reload system
   */
  async start(): Promise<void> {
    if (this.isActive) {
      this.logger.warn("Hot reload system already running");
      return;
    }

    if (!this.config.enabled) {
      this.logger.info("Hot reload system disabled");
      return;
    }

    this.isActive = true;
    this.logger.info("Starting hot reload system", {
      port: this.config.port,
      host: this.config.host,
    });

    try {
      // Start file watcher
      await this.startFileWatcher();

      // Start WebSocket server for browser communication
      if (this.config.notifyBrowser) {
        await this.startWebSocketServer();
      }

      this.logger.info("Hot reload system started", {
        watchPatterns: this.config.watchPatterns.length,
        ignorePatterns: this.config.ignorePatterns.length,
        wsUrl: this.config.notifyBrowser ? `ws://${this.config.host}:${this.config.port}` : undefined,
      });

    } catch (error) {
      this.logger.error("Failed to start hot reload system", { error });
      throw error;
    }
  }

  /**
   * Stop the hot reload system
   */
  async stop(): Promise<void> {
    if (!this.isActive) {
      this.logger.warn("Hot reload system not running");
      return;
    }

    this.isActive = false;
    this.logger.info("Stopping hot reload system");

    try {
      // Stop file watcher
      if (this.watcher) {
        await this.watcher.close();
        this.watcher = undefined;
      }

      // Stop WebSocket server
      if (this.server) {
        this.server.close();
        this.server = undefined;
      }

      // Clear pending operations
      if (this.debounceTimeout) {
        clearTimeout(this.debounceTimeout);
        this.debounceTimeout = undefined;
      }

      // Disconnect all clients
      for (const [clientId, client] of this.clients) {
        try {
          client.socket.close();
        } catch (error) {
          this.logger.debug("Error closing client connection", { clientId, error });
        }
      }
      this.clients.clear();

      this.logger.info("Hot reload system stopped");

    } catch (error) {
      this.logger.error("Error stopping hot reload system", { error });
      throw error;
    }
  }

  /**
   * Manually trigger optimization for specific files
   */
  async triggerOptimization(files: string[]): Promise<HMROptimizationResult | null> {
    if (!this.isActive) {
      throw new Error("Hot reload system not active");
    }

    this.logger.debug("Manual optimization triggered", { files });
    return this.processOptimization(files, 'manual');
  }

  /**
   * Force reload for all connected clients
   */
  forceReload(type: 'full' | 'css' | 'partial' = 'full'): void {
    if (!this.config.notifyBrowser) {
      return;
    }

    this.logger.debug("Force reload requested", { type, clients: this.clients.size });
    this.broadcastToClients('reload', { type, timestamp: Date.now() });
    this.emit('reload-requested', type, []);
  }

  /**
   * Get current hot reload status
   */
  getStatus(): {
    isActive: boolean;
    clients: number;
    watchedFiles: number;
    optimizationQueue: number;
    recentOptimizations: number;
    uptime: number;
    performance: {
      averageOptimizationTime: number;
      totalOptimizations: number;
      successRate: number;
    };
  } {
    const recentOptimizations = this.optimizationHistory.filter(
      result => Date.now() - result.timestamp.getTime() < 300000 // Last 5 minutes
    );

    const successfulOptimizations = this.optimizationHistory.filter(r => r.success);
    const averageOptimizationTime = successfulOptimizations.length > 0
      ? successfulOptimizations.reduce((sum, r) => sum + r.performance.totalTime, 0) / successfulOptimizations.length
      : 0;

    return {
      isActive: this.isActive,
      clients: this.clients.size,
      watchedFiles: this.fileHashes.size,
      optimizationQueue: this.optimizationQueue.length,
      recentOptimizations: recentOptimizations.length,
      uptime: Date.now() - this.startTime,
      performance: {
        averageOptimizationTime,
        totalOptimizations: this.optimizationHistory.length,
        successRate: this.optimizationHistory.length > 0
          ? (successfulOptimizations.length / this.optimizationHistory.length) * 100
          : 0,
      },
    };
  }

  /**
   * Get optimization history
   */
  getOptimizationHistory(limit = 50): HMROptimizationResult[] {
    return this.optimizationHistory
      .slice(-limit)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<HotReloadConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.logger.debug("Configuration updated", { config: this.config });
  }

  /**
   * Start file watcher
   */
  private async startFileWatcher(): Promise<void> {
    this.watcher = watch(this.config.watchPatterns, {
      ignored: this.config.ignorePatterns,
      persistent: true,
      ignoreInitial: true,
      awaitWriteFinish: {
        stabilityThreshold: 100,
        pollInterval: 50,
      },
      depth: 10,
    });

    if (!this.watcher) {
      throw new Error('Failed to initialize file watcher');
    }

    this.watcher.on('add', (path) => this.handleFileChange(path, 'add'));
    this.watcher.on('change', (path) => this.handleFileChange(path, 'change'));
    this.watcher.on('unlink', (path) => this.handleFileChange(path, 'unlink'));

    this.watcher.on('error', (error) => {
      this.logger.error("File watcher error", { error });
      this.emit('error', error);
    });

    this.logger.debug("File watcher started", {
      watchPatterns: this.config.watchPatterns,
      ignorePatterns: this.config.ignorePatterns,
    });
  }

  /**
   * Start WebSocket server for browser communication
   */
  private async startWebSocketServer(): Promise<void> {
    const { WebSocketServer } = await import('ws');
    
    this.server = new WebSocketServer({
      port: this.config.port,
      host: this.config.host,
    });

    this.server.on('connection', (socket: any, request: any) => {
      this.handleClientConnection(socket, request);
    });

    this.server.on('error', (error: Error) => {
      this.logger.error("WebSocket server error", { error });
      this.emit('error', error);
    });

    this.logger.debug("WebSocket server started", {
      url: `ws://${this.config.host}:${this.config.port}`,
    });
  }

  /**
   * Handle new client connection
   */
  private handleClientConnection(socket: any, request: any): void {
    const clientId = this.generateClientId();
    const userAgent = request.headers['user-agent'] || 'Unknown';
    
    const client: HMRClient = {
      id: clientId,
      socket,
      userAgent,
      connected: new Date(),
      lastPing: new Date(),
      capabilities: {
        css: true,
        javascript: true,
        sourceMap: this.config.includeSourceMaps,
        liveReload: this.config.liveReload,
      },
    };

    this.clients.set(clientId, client);

    socket.on('message', (data: any) => {
      this.handleClientMessage(clientId, data);
    });

    socket.on('close', () => {
      this.clients.delete(clientId);
      this.emit('client-disconnected', clientId);
      this.logger.debug("Client disconnected", { clientId });
    });

    socket.on('error', (error: Error) => {
      this.logger.debug("Client socket error", { clientId, error });
    });

    // Send welcome message
    this.sendToClient(clientId, 'connected', {
      id: clientId,
      capabilities: client.capabilities,
      config: {
        hotSwapCSS: this.config.hotSwapCSS,
        liveReload: this.config.liveReload,
        includeSourceMaps: this.config.includeSourceMaps,
      },
    });

    this.emit('client-connected', client);
    this.logger.debug("Client connected", { clientId, userAgent });
  }

  /**
   * Handle client message
   */
  private handleClientMessage(clientId: string, data: any): void {
    try {
      const message = JSON.parse(data.toString());
      const client = this.clients.get(clientId);
      
      if (!client) {
        return;
      }

      switch (message.type) {
        case 'ping':
          client.lastPing = new Date();
          this.sendToClient(clientId, 'pong', { timestamp: Date.now() });
          break;

        case 'capabilities':
          client.capabilities = { ...client.capabilities, ...message.capabilities };
          break;

        case 'framework':
          client.framework = message.framework;
          break;

        case 'trigger-optimization':
          if (message.files && Array.isArray(message.files)) {
            this.triggerOptimization(message.files);
          }
          break;

        default:
          this.logger.debug("Unknown client message type", { clientId, type: message.type });
      }
    } catch (error) {
      this.logger.debug("Error parsing client message", { clientId, error });
    }
  }

  /**
   * Handle file change event
   */
  private async handleFileChange(path: string, type: 'add' | 'change' | 'unlink'): Promise<void> {
    const ext = extname(path).toLowerCase();
    const isCSS = ['.css', '.scss', '.sass', '.less'].includes(ext);
    const isHTML = ['.html', '.htm'].includes(ext);
    const isJS = ['.js', '.jsx', '.ts', '.tsx', '.vue', '.svelte'].includes(ext);

    // Calculate file hash for change detection
    let hash: string | undefined;
    let size: number | undefined;
    
    if (type !== 'unlink') {
      try {
        const content = await readFile(path, 'utf-8');
        hash = createHash('md5').update(content).digest('hex');
        size = content.length;

        // Check if file actually changed
        const previousHash = this.fileHashes.get(path);
        if (previousHash === hash) {
          return; // No actual change
        }
        
        this.fileHashes.set(path, hash);
      } catch (error) {
        this.logger.debug("Error reading file for change detection", { path, error });
        return;
      }
    } else {
      this.fileHashes.delete(path);
    }

    const changeEvent: FileChangeEvent = {
      path,
      type,
      timestamp: new Date(),
      size,
      hash,
      isCSS,
      isHTML,
      isJS,
      requiresOptimization: isCSS || isHTML || isJS,
    };

    this.logger.debug("File change detected", changeEvent);
    this.emit('file-changed', changeEvent);

    // Add to pending changes
    this.pendingChanges.set(path, changeEvent);

    // Trigger optimization if configured
    if (changeEvent.requiresOptimization && this.shouldTriggerOptimization('onChange')) {
      this.scheduleOptimization();
    }
  }

  /**
   * Schedule optimization with debouncing
   */
  private scheduleOptimization(): void {
    if (this.debounceTimeout) {
      clearTimeout(this.debounceTimeout);
    }

    this.debounceTimeout = setTimeout(() => {
      this.processQueuedOptimizations();
    }, this.config.debounceMs);
  }

  /**
   * Process queued optimizations
   */
  private async processQueuedOptimizations(): Promise<void> {
    if (this.isOptimizing || this.pendingChanges.size === 0) {
      return;
    }

    const changedFiles = Array.from(this.pendingChanges.keys());
    this.pendingChanges.clear();

    await this.processOptimization(changedFiles, 'onChange');
  }

  /**
   * Process optimization for files
   */
  private async processOptimization(
    files: string[],
    trigger: 'onChange' | 'onSave' | 'onBuild' | 'manual'
  ): Promise<HMROptimizationResult | null> {
    if (this.isOptimizing) {
      // Add to queue
      this.optimizationQueue.push(...files);
      return null;
    }

    this.isOptimizing = true;
    const startTime = Date.now();
    const resultId = this.generateOptimizationId();

    this.logger.debug("Starting optimization", { files, trigger, resultId });
    this.emit('optimization-started', files);

    try {
      // Perform optimization using callback if provided
      let optimizationResult: any = null;
      const analysisStartTime = Date.now();
      
      if (this.optimizationCallback) {
        optimizationResult = await this.optimizationCallback(files);
      }
      
      const analysisTime = Date.now() - analysisStartTime;
      const optimizationTime = Date.now() - analysisStartTime;
      const totalTime = Date.now() - startTime;

      const result: HMROptimizationResult = {
        id: resultId,
        timestamp: new Date(),
        files: {
          input: files,
          output: optimizationResult?.outputFiles || [],
          modified: optimizationResult?.modifiedFiles || files,
        },
        changes: {
          classesAdded: optimizationResult?.changes?.classesAdded || [],
          classesRemoved: optimizationResult?.changes?.classesRemoved || [],
          classesModified: optimizationResult?.changes?.classesModified || [],
          sizeBefore: optimizationResult?.sizeBefore || 0,
          sizeAfter: optimizationResult?.sizeAfter || 0,
          reductionPercent: optimizationResult?.reductionPercent || 0,
        },
        performance: {
          analysisTime,
          optimizationTime,
          totalTime,
          memoryUsed: process.memoryUsage().heapUsed,
        },
        sourceMap: optimizationResult?.sourceMap,
        success: optimizationResult?.success !== false,
        errors: optimizationResult?.errors || [],
        warnings: optimizationResult?.warnings || [],
      };

      this.optimizationHistory.push(result);
      
      // Keep only recent results
      if (this.optimizationHistory.length > 1000) {
        this.optimizationHistory = this.optimizationHistory.slice(-500);
      }

      this.emit('optimization-completed', result);

      // Notify connected clients
      if (this.config.notifyBrowser && result.success) {
        this.notifyClientsOfOptimization(result);
      }

      this.logger.debug("Optimization completed", {
        resultId,
        totalTime,
        success: result.success,
        files: result.files.modified.length,
      });

      return result;

    } catch (error) {
      this.logger.error("Optimization failed", { files, trigger, error });
      this.emit('optimization-failed', error as Error, files);
      return null;
    } finally {
      this.isOptimizing = false;
      
      // Process any queued optimizations
      if (this.optimizationQueue.length > 0) {
        const queuedFiles = [...this.optimizationQueue];
        this.optimizationQueue = [];
        setImmediate(() => this.processOptimization(queuedFiles, 'onChange'));
      }
    }
  }

  /**
   * Notify clients of optimization result
   */
  private notifyClientsOfOptimization(result: HMROptimizationResult): void {
    const cssFiles = result.files.modified.filter(file => 
      ['.css', '.scss', '.sass', '.less'].includes(extname(file))
    );

    if (cssFiles.length > 0 && this.config.hotSwapCSS) {
      // Hot swap CSS
      this.broadcastToClients('css-update', {
        files: cssFiles,
        changes: result.changes,
        sourceMap: this.config.includeSourceMaps ? result.sourceMap : undefined,
        timestamp: result.timestamp,
      });
      
      cssFiles.forEach(file => this.emit('css-updated', file, result.changes));
    } else if (this.config.liveReload) {
      // Full page reload
      this.broadcastToClients('reload', {
        type: 'full',
        reason: 'optimization-completed',
        files: result.files.modified,
        timestamp: result.timestamp,
      });
    }
  }

  /**
   * Send message to specific client
   */
  private sendToClient(clientId: string, type: string, data: any): void {
    const client = this.clients.get(clientId);
    if (!client || client.socket.readyState !== 1) {
      return;
    }

    try {
      client.socket.send(JSON.stringify({ type, data, timestamp: Date.now() }));
    } catch (error) {
      this.logger.debug("Error sending message to client", { clientId, error });
    }
  }

  /**
   * Broadcast message to all connected clients
   */
  private broadcastToClients(type: string, data: any): void {
    const message = JSON.stringify({ type, data, timestamp: Date.now() });
    
    for (const [clientId, client] of this.clients) {
      if (client.socket.readyState === 1) {
        try {
          client.socket.send(message);
        } catch (error) {
          this.logger.debug("Error broadcasting to client", { clientId, error });
        }
      }
    }
  }

  /**
   * Check if optimization should be triggered
   */
  private shouldTriggerOptimization(trigger: keyof HotReloadConfig['optimizationTriggers']): boolean {
    return this.config.optimizationTriggers[trigger];
  }

  /**
   * Generate unique client ID
   */
  private generateClientId(): string {
    return `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate unique optimization ID
   */
  private generateOptimizationId(): string {
    return `opt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

/**
 * Create a hot reload system instance
 */
export function createDevHotReload(
  config: EnigmaConfig,
  hotReloadConfig?: Partial<HotReloadConfig>,
  optimizationCallback?: (files: string[]) => Promise<any>
): DevHotReload | null {
  if (!config.dev.enabled) {
    return null;
  }

  return new DevHotReload(hotReloadConfig, config, optimizationCallback);
}

/**
 * Type-safe event emitter interface
 */
// Interface declaration moved to class definition 