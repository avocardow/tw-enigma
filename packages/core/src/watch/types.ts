import { FSWatcher } from 'chokidar';
import { EventEmitter } from 'events';

/**
 * File change event types
 */
export type WatchEventType =
  | 'add'
  | 'change'
  | 'unlink'
  | 'addDir'
  | 'unlinkDir'
  | 'ready'
  | 'error';

/**
 * File change event
 */
export interface WatchEvent {
  type: WatchEventType;
  path: string;
  stats?: any;
  timestamp: Date;
  metadata?: Record<string, any>;
}

/**
 * Watch pattern configuration
 */
export interface WatchPattern {
  glob: string;
  priority: number;
  debounceMs?: number;
  throttleMs?: number;
  enabled: boolean;
  metadata?: Record<string, any>;
}

/**
 * File watching configuration
 */
export interface WatchConfig {
  enabled: boolean;
  patterns: WatchPattern[];
  ignored: string[];
  persistent: boolean;
  ignoreInitial: boolean;
  followSymlinks: boolean;
  depth?: number;
  awaitWriteFinish?: {
    stabilityThreshold: number;
    pollInterval: number;
  };
  usePolling?: boolean;
  interval?: number;
  binaryInterval?: number;
  atomic?: boolean;
  ignorePermissionErrors?: boolean;
  cwd?: string;
  disableGlobbing?: boolean;
  useFsEvents?: boolean;
  alwaysStat?: boolean;
}

/**
 * Watch mode configuration
 */
export interface WatchModeConfig {
  enabled: boolean;
  mode: 'development' | 'production' | 'test';
  hotReload: boolean;
  autoRefresh: boolean;
  notifications: boolean;
  performance: {
    throttleMs: number;
    batchSize: number;
    maxConcurrency: number;
  };
  integrations: {
    devServer: boolean;
    browser: boolean;
    editor: boolean;
    terminal: boolean;
  };
  caching: {
    enabled: boolean;
    strategy: 'memory' | 'disk' | 'hybrid';
    maxAge: number;
    maxSize: number;
    enablePredictivePrefetch: boolean;
    compressionEnabled: boolean;
    analyticsEnabled: boolean;
    evictionStrategy: 'lru' | 'lfu' | 'fifo' | 'adaptive' | 'ttl';
    prefetchThreshold: number;
    maxPrefetchSize: number;
    prefetchConcurrency: number;
    enableDeduplication: boolean;
    enableCacheWarming: boolean;
    diskCacheDir?: string;
    fileChangeDebounce: number;
  };
  logging: {
    level: 'debug' | 'info' | 'warn' | 'error';
    verbose: boolean;
    timestamped: boolean;
  };
}

/**
 * Watch statistics
 */
export interface WatchStats {
  totalFiles: number;
  watchedFiles: number;
  ignoredFiles: number;
  totalEvents: number;
  eventsByType: Record<WatchEventType, number>;
  lastEvent?: Date;
  averageEventProcessingTime: number;
  uptime: number;
  memoryUsage: NodeJS.MemoryUsage;
  cpuUsage: NodeJS.CpuUsage;
}

/**
 * Watch handler interface
 */
export interface WatchHandler {
  id: string;
  priority: number;
  patterns: string[];
  handler: (event: WatchEvent) => Promise<void> | void;
  enabled: boolean;
  metadata?: Record<string, any>;
}

/**
 * Watch context
 */
export interface WatchContext {
  projectRoot: string;
  workingDirectory: string;
  config: WatchModeConfig;
  handlers: Map<string, WatchHandler>;
  watchers: Map<string, FSWatcher>;
  stats: WatchStats;
  startTime: Date;
  isActive: boolean;
}

/**
 * Optimization pipeline stage
 */
export interface OptimizationStage {
  id: string;
  name: string;
  enabled: boolean;
  priority: number;
  execute: (context: OptimizationContext) => Promise<OptimizationResult>;
  dependencies?: string[];
  timeout?: number;
  retryCount?: number;
}

/**
 * Optimization context
 */
export interface OptimizationContext {
  changedFiles: string[];
  event: WatchEvent;
  config: WatchModeConfig;
  cache: Map<string, any>;
  startTime: Date;
  metadata: Record<string, any>;
}

/**
 * Optimization result
 */
export interface OptimizationResult {
  success: boolean;
  duration: number;
  filesProcessed: number;
  bytesOptimized: number;
  warnings: string[];
  errors: string[];
  metadata: Record<string, any>;
}

/**
 * Watch manager interface
 */
export interface IWatchManager extends EventEmitter {
  start(config: WatchModeConfig): Promise<void>;
  stop(): Promise<void>;
  restart(): Promise<void>;
  addHandler(handler: WatchHandler): void;
  removeHandler(handlerId: string): void;
  getStats(): WatchStats;
  isActive(): boolean;
  updateConfig(config: Partial<WatchModeConfig>): void;
}

/**
 * File watcher interface
 */
export interface IFileWatcher extends EventEmitter {
  watch(patterns: string[], config: WatchConfig): Promise<void>;
  unwatch(patterns?: string[]): Promise<void>;
  add(paths: string | string[]): void;
  remove(paths: string | string[]): void;
  getWatched(): string[];
  close(): Promise<void>;
}

/**
 * Event handler interface
 */
export interface IWatchEventHandler extends EventEmitter {
  handleEvent(event: WatchEvent, context: WatchContext): Promise<void>;
  addProcessor(processor: EventProcessor): void;
  removeProcessor(processorId: string): void;
  getProcessors(): EventProcessor[];
}

/**
 * Event processor interface
 */
export interface EventProcessor {
  id: string;
  name: string;
  priority: number;
  patterns: string[];
  process: (event: WatchEvent, context: WatchContext) => Promise<void>;
  enabled: boolean;
}

/**
 * Watch controller interface
 */
export interface IWatchController extends EventEmitter {
  initialize(config: WatchModeConfig): Promise<void>;
  start(): Promise<void>;
  stop(): Promise<void>;
  pause(): void;
  resume(): void;
  getStatus(): WatchControllerStatus;
}

/**
 * Watch controller status
 */
export interface WatchControllerStatus {
  state: 'stopped' | 'starting' | 'running' | 'paused' | 'stopping' | 'error';
  uptime: number;
  totalEvents: number;
  lastEvent?: Date;
  activeHandlers: number;
  memoryUsage: number;
  cpuUsage: number;
}

/**
 * Build tool integration interface
 */
export interface BuildToolIntegration {
  name: string;
  version?: string;
  configPath?: string;
  commands: {
    build: string;
    dev: string;
    test?: string;
  };
  hooks: {
    beforeBuild?: () => Promise<void>;
    afterBuild?: () => Promise<void>;
    onError?: (error: Error) => Promise<void>;
  };
  watchPatterns: string[];
  outputPatterns: string[];
}

/**
 * Performance monitoring data
 */
export interface PerformanceMetrics {
  eventProcessingTime: {
    min: number;
    max: number;
    avg: number;
    p95: number;
    p99: number;
  };
  memoryUsage: {
    heapUsed: number;
    heapTotal: number;
    external: number;
    rss: number;
  };
  cpuUsage: {
    user: number;
    system: number;
  };
  fileSystemStats: {
    totalWatched: number;
    eventsPerSecond: number;
    diskReadOps: number;
    diskWriteOps: number;
  };
  optimizationMetrics: {
    totalOptimizations: number;
    successRate: number;
    averageOptimizationTime: number;
    bytesOptimized: number;
  };
}
