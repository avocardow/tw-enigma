/**
 * Copyright (c) 2025 Rowan Cardow
 * 
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * HMR Handler - Hot Module Replacement for CSS Updates
 * Manages live reloading and hot updates for Tailwind CSS changes during development
 */

import { EventEmitter } from 'events';
import { createLogger } from '../../logger.js';
import type { 
  HMRUpdate, 
  BuildToolContext, 
  BuildToolType,
  OptimizationResult 
} from './buildToolPlugin.js';

const logger = createLogger('hmr-handler');

/**
 * HMR update types
 */
export type HMRUpdateType = 'css' | 'js' | 'asset' | 'full-reload';

/**
 * HMR configuration options
 */
export interface HMRConfig {
  /** Enable HMR */
  enabled: boolean;
  /** Update delay in milliseconds */
  delay: number;
  /** Port for HMR server */
  port?: number;
  /** Enable live reload as fallback */
  liveReload: boolean;
  /** Include source maps in updates */
  sourceMaps: boolean;
  /** File extensions to watch */
  watchExtensions: string[];
  /** Directories to watch */
  watchDirectories: string[];
  /** Files/patterns to ignore */
  ignore: string[];
}

/**
 * HMR update payload
 */
export interface HMRUpdatePayload {
  /** Update type */
  type: HMRUpdateType;
  /** File path that changed */
  filePath: string;
  /** New CSS content */
  css?: string;
  /** Source map */
  sourceMap?: string;
  /** Optimization results */
  optimization?: OptimizationResult;
  /** Timestamp */
  timestamp: number;
  /** Build tool that triggered the update */
  buildTool: BuildToolType;
}

/**
 * HMR client connection interface
 */
export interface HMRClient {
  /** Client ID */
  id: string;
  /** Send update to client */
  send(payload: HMRUpdatePayload): void;
  /** Close client connection */
  close(): void;
  /** Check if client is connected */
  isConnected(): boolean;
}

/**
 * HMR server interface for different build tools
 */
export interface HMRServer {
  /** Start HMR server */
  start(port?: number): Promise<void>;
  /** Stop HMR server */
  stop(): Promise<void>;
  /** Send update to all clients */
  broadcast(payload: HMRUpdatePayload): void;
  /** Get connected clients */
  getClients(): HMRClient[];
  /** Check if server is running */
  isRunning(): boolean;
}

/**
 * HMR update queue entry
 */
interface HMRQueueEntry {
  payload: HMRUpdatePayload;
  timestamp: number;
  retries: number;
}

/**
 * Main HMR handler class
 */
export class HMRHandler extends EventEmitter {
  private config: HMRConfig;
  private updateQueue: HMRQueueEntry[] = [];
  private isProcessing = false;
  private lastUpdate = 0;
  private servers = new Map<BuildToolType, HMRServer>();
  private fileWatchers = new Map<string, any>();

  constructor(config: Partial<HMRConfig> = {}) {
    super();
    
    this.config = {
      enabled: true,
      delay: 100,
      liveReload: true,
      sourceMaps: true,
      watchExtensions: ['.css', '.html', '.js', '.ts', '.jsx', '.tsx', '.vue', '.svelte'],
      watchDirectories: ['src', 'public', 'app', 'pages'],
      ignore: ['node_modules/**', 'dist/**', 'build/**', '.git/**'],
      ...config
    };

    logger.debug('HMR handler initialized', { config: this.config });
  }

  /**
   * Initialize HMR for a build tool
   */
  async initialize(buildTool: BuildToolType, server: HMRServer): Promise<void> {
    if (!this.config.enabled) {
      logger.debug('HMR disabled, skipping initialization');
      return;
    }

    try {
      this.servers.set(buildTool, server);
      await server.start(this.config.port);
      
      logger.info(`HMR initialized for ${buildTool}`, {
        port: this.config.port,
        watchExtensions: this.config.watchExtensions
      });

      this.emit('initialized', { buildTool });
    } catch (error) {
      logger.error(`Failed to initialize HMR for ${buildTool}`, { error });
      throw error;
    }
  }

  /**
   * Handle CSS update
   */
  async handleCSSUpdate(
    filePath: string,
    css: string,
    context: BuildToolContext,
    optimization?: OptimizationResult
  ): Promise<void> {
    if (!this.config.enabled) {
      return;
    }

    const payload: HMRUpdatePayload = {
      type: 'css',
      filePath,
      css,
      optimization,
      timestamp: Date.now(),
      buildTool: context.buildTool,
      sourceMap: optimization?.sourceMap
    };

    await this.queueUpdate(payload);
  }

  /**
   * Handle asset update
   */
  async handleAssetUpdate(
    filePath: string,
    content: string,
    context: BuildToolContext
  ): Promise<void> {
    if (!this.config.enabled) {
      return;
    }

    const payload: HMRUpdatePayload = {
      type: 'asset',
      filePath,
      css: content,
      timestamp: Date.now(),
      buildTool: context.buildTool
    };

    await this.queueUpdate(payload);
  }

  /**
   * Trigger full page reload
   */
  async triggerReload(context: BuildToolContext, reason?: string): Promise<void> {
    if (!this.config.enabled) {
      return;
    }

    const payload: HMRUpdatePayload = {
      type: 'full-reload',
      filePath: '',
      timestamp: Date.now(),
      buildTool: context.buildTool
    };

    logger.info('Triggering full page reload', { buildTool: context.buildTool, reason });
    await this.queueUpdate(payload);
  }

  /**
   * Queue an HMR update
   */
  private async queueUpdate(payload: HMRUpdatePayload): Promise<void> {
    const entry: HMRQueueEntry = {
      payload,
      timestamp: Date.now(),
      retries: 0
    };

    this.updateQueue.push(entry);
    
    if (!this.isProcessing) {
      this.processQueue();
    }
  }

  /**
   * Process the update queue
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.updateQueue.length === 0) {
      return;
    }

    this.isProcessing = true;

    while (this.updateQueue.length > 0) {
      const entry = this.updateQueue.shift()!;
      
      // Apply delay to prevent spam
      const timeSinceLastUpdate = Date.now() - this.lastUpdate;
      if (timeSinceLastUpdate < this.config.delay) {
        await new Promise(resolve => setTimeout(resolve, this.config.delay - timeSinceLastUpdate));
      }

      try {
        await this.processUpdate(entry);
        this.lastUpdate = Date.now();
        
        this.emit('update', entry.payload);
      } catch (error) {
        logger.error('Failed to process HMR update', { 
          error, 
          payload: entry.payload,
          retries: entry.retries 
        });

        // Retry logic
        if (entry.retries < 3) {
          entry.retries++;
          this.updateQueue.unshift(entry);
        } else {
          logger.error('HMR update failed after 3 retries, triggering full reload');
          await this.triggerReload({
            buildTool: entry.payload.buildTool,
            phase: 'development'
          } as BuildToolContext, 'HMR update failed');
        }
      }
    }

    this.isProcessing = false;
  }

  /**
   * Process a single update
   */
  private async processUpdate(entry: HMRQueueEntry): Promise<void> {
    const { payload } = entry;
    const server = this.servers.get(payload.buildTool);

    if (!server) {
      throw new Error(`No HMR server found for build tool: ${payload.buildTool}`);
    }

    if (!server.isRunning()) {
      throw new Error(`HMR server for ${payload.buildTool} is not running`);
    }

    // Broadcast update to all connected clients
    server.broadcast(payload);
    
    logger.debug('HMR update sent', {
      type: payload.type,
      filePath: payload.filePath,
      buildTool: payload.buildTool,
      clients: server.getClients().length
    });
  }

  /**
   * Start file watching for automatic updates
   */
  async startWatching(projectRoot: string): Promise<void> {
    if (!this.config.enabled) {
      return;
    }

    // Implementation would use chokidar or similar file watcher
    // For now, just log the intention
    logger.info('Starting file watching for HMR', {
      projectRoot,
      watchDirectories: this.config.watchDirectories,
      watchExtensions: this.config.watchExtensions
    });

    this.emit('watching-started', { projectRoot });
  }

  /**
   * Stop file watching
   */
  async stopWatching(): Promise<void> {
    for (const [path, watcher] of Array.from(this.fileWatchers)) {
      if (watcher && typeof watcher.close === 'function') {
        await watcher.close();
      }
    }
    
    this.fileWatchers.clear();
    logger.info('File watching stopped');
    
    this.emit('watching-stopped');
  }

  /**
   * Shutdown HMR handler
   */
  async shutdown(): Promise<void> {
    logger.info('Shutting down HMR handler');

    // Stop file watching
    await this.stopWatching();

    // Stop all servers
    for (const [buildTool, server] of Array.from(this.servers)) {
      try {
        await server.stop();
        logger.debug(`HMR server stopped for ${buildTool}`);
      } catch (error) {
        logger.error(`Error stopping HMR server for ${buildTool}`, { error });
      }
    }

    this.servers.clear();
    this.updateQueue.length = 0;
    this.isProcessing = false;

    this.emit('shutdown');
  }

  /**
   * Get HMR statistics
   */
  getStats() {
    return {
      enabled: this.config.enabled,
      queueLength: this.updateQueue.length,
      isProcessing: this.isProcessing,
      lastUpdate: this.lastUpdate,
      connectedServers: Array.from(this.servers.keys()),
      totalClients: Array.from(this.servers.values())
        .reduce((total, server) => total + server.getClients().length, 0)
    };
  }

  /**
   * Update HMR configuration
   */
  updateConfig(newConfig: Partial<HMRConfig>): void {
    this.config = { ...this.config, ...newConfig };
    logger.debug('HMR configuration updated', { config: this.config });
    
    this.emit('config-updated', this.config);
  }
}

/**
 * Create HMR handler instance
 */
export function createHMRHandler(config?: Partial<HMRConfig>): HMRHandler {
  return new HMRHandler(config);
}

/**
 * Default HMR configuration
 */
export const defaultHMRConfig: HMRConfig = {
  enabled: true,
  delay: 100,
  liveReload: true,
  sourceMaps: true,
  watchExtensions: ['.css', '.html', '.js', '.ts', '.jsx', '.tsx', '.vue', '.svelte'],
  watchDirectories: ['src', 'public', 'app', 'pages'],
  ignore: ['node_modules/**', 'dist/**', 'build/**', '.git/**']
}; 