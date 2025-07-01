# Watch Mode API Reference

## Core Classes

### WatchManager

The main orchestrator for watch mode functionality.

```typescript
class WatchManager extends EventEmitter implements IWatchManager {
  constructor(config?: Partial<WatchModeConfig>, projectRoot?: string);
  
  async start(config?: WatchModeConfig): Promise<void>;
  async stop(): Promise<void>;
  async restart(): Promise<void>;
  
  addHandler(handler: WatchHandler): void;
  removeHandler(handlerId: string): void;
  
  getStats(): WatchStats & { cacheStats?: any };
  getCacheAnalytics(): any;
  getEventHandlerStats(): any;
  
  isActive(): boolean;
  updateConfig(config: Partial<WatchModeConfig>): void;
  getConfig(): WatchModeConfig;
  
  async clearCaches(): Promise<void>;
  async invalidateCacheForFiles(files: string[]): Promise<void>;
  resetEventStats(): void;
}
```

### WatchEventHandler

Handles file system events with debouncing and throttling.

```typescript
class WatchEventHandler extends EventEmitter implements IWatchEventHandler {
  async handleEvent(event: WatchEvent, context: WatchContext): Promise<void>;
  
  addProcessor(processor: EventProcessor): void;
  removeProcessor(processorId: string): void;
  getProcessors(): EventProcessor[];
  
  getEventStats(): EventStats;
  resetEventStats(): void;
  clearAllTimers(): void;
  
  setWatchLogger(watchLogger: WatchLogger): void;
}
```

### WatchLogger

Specialized logging for watch mode operations.

```typescript
class WatchLogger {
  constructor(config: WatchModeConfig, component?: string);
  
  logWatchStart(patterns: string[], projectRoot: string): void;
  logWatchStop(duration: number): void;
  
  logFileEvent(event: WatchEvent, processed: boolean, reason?: string): void;
  logOptimization(files: string[], duration: number, success: boolean, cacheHit: boolean, results?: OptimizationResults): void;
  logCacheOperation(operation: CacheOperation, key: string, details?: any): void;
  logBatchProcessing(eventCount: number, duration: number, concurrency: number): void;
  logPerformanceStats(stats: WatchStats): void;
  
  logError(error: Error, operation: string, context?: WatchLogContext): void;
  logWarning(message: string, operation: string, context?: WatchLogContext): void;
  
  startProgress(id: string, total: number, label: string): void;
  updateProgress(id: string, current: number, info?: string): void;
  completeProgress(id: string, summary?: string): void;
  
  logConfigChange(oldConfig: Partial<WatchModeConfig>, newConfig: Partial<WatchModeConfig>): void;
  logStartupBanner(): void;
  
  cleanup(): void;
}
```

### WatchConfiguration

Configuration management for watch mode.

```typescript
class WatchConfiguration {
  constructor(
    config?: Partial<WatchModeConfig>,
    patterns?: WatchPattern[],
    ignored?: string[],
    projectRoot?: string
  );
  
  getConfig(): WatchModeConfig;
  updateConfig(updates: Partial<WatchModeConfig>): void;
  
  getWatchPatterns(): WatchPattern[];
  addWatchPattern(pattern: WatchPattern): void;
  removeWatchPattern(glob: string): void;
  
  getIgnoredPatterns(): string[];
  addIgnoredPattern(pattern: string): void;
  removeIgnoredPattern(pattern: string): void;
  
  getWatchConfig(): WatchConfig;
  resolvePatterns(patterns: string[]): string[];
  
  validate(): { isValid: boolean; errors: string[] };
  getModeConfig(mode: 'development' | 'production' | 'test'): Partial<WatchModeConfig>;
}
```

## Type Definitions

### Core Types

```typescript
interface WatchModeConfig {
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
```

### Event Types

```typescript
type WatchEventType = 'add' | 'change' | 'unlink' | 'addDir' | 'unlinkDir' | 'ready' | 'error';

interface WatchEvent {
  type: WatchEventType;
  path: string;
  stats?: any;
  timestamp: Date;
  metadata?: Record<string, any>;
}

interface WatchContext {
  projectRoot: string;
  workingDirectory: string;
  config: WatchModeConfig;
  handlers: Map<string, WatchHandler>;
  watchers: Map<string, FSWatcher>;
  stats: WatchStats;
  startTime: Date;
  isActive: boolean;
}
```

### Handler Types

```typescript
interface WatchHandler {
  id: string;
  priority: number;
  patterns: string[];
  handler: (event: WatchEvent) => Promise<void> | void;
  enabled: boolean;
  metadata?: Record<string, any>;
}

interface EventProcessor {
  id: string;
  name: string;
  priority: number;
  patterns: string[];
  process: (event: WatchEvent, context: WatchContext) => Promise<void>;
  enabled: boolean;
}
```

### Statistics Types

```typescript
interface WatchStats {
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

interface EventStats {
  totalEvents: number;
  filteredEvents: number;
  activeDebounceTimers: number;
  activeThrottleWindows: number;
  eventsByPath: Map<string, number>;
}
```

### Pattern Types

```typescript
interface WatchPattern {
  glob: string;
  priority: number;
  debounceMs?: number;
  throttleMs?: number;
  enabled: boolean;
  metadata?: Record<string, any>;
}

interface WatchConfig {
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
```

### Optimization Types

```typescript
interface OptimizationContext {
  changedFiles: string[];
  event: WatchEvent;
  config: WatchModeConfig;
  cache: Map<string, any>;
  startTime: Date;
  metadata: Record<string, any>;
}

interface OptimizationResult {
  success: boolean;
  duration: number;
  filesProcessed: number;
  bytesOptimized: number;
  warnings: string[];
  errors: string[];
  metadata: Record<string, any>;
}

interface OptimizationStage {
  id: string;
  name: string;
  enabled: boolean;
  priority: number;
  execute: (context: OptimizationContext) => Promise<OptimizationResult>;
  dependencies?: string[];
  timeout?: number;
  retryCount?: number;
}
```

### Logging Types

```typescript
interface WatchLogContext extends ErrorContext {
  eventType?: string;
  filePath?: string;
  processingTime?: number;
  cacheHit?: boolean;
  batchSize?: number;
  throttled?: boolean;
  debounced?: boolean;
  optimizationPassed?: boolean;
}

type CacheOperation = 'hit' | 'miss' | 'set' | 'invalidate';
```

## Event System

### WatchManager Events

```typescript
// Lifecycle events
watchManager.on('started', ({ context }: { context: WatchContext }) => void);
watchManager.on('stopped', ({ context }: { context: WatchContext }) => void);
watchManager.on('error', ({ error, context }: { error: Error; context: WatchContext }) => void);

// File events
watchManager.on('file-event', ({ event, context, fromCache }: {
  event: WatchEvent;
  context: WatchContext;
  fromCache?: boolean;
}) => void);

// Processing events
watchManager.on('batch-processed', ({ events, context }: {
  events: WatchEvent[];
  context: WatchContext;
}) => void);

// Optimization events
watchManager.on('optimization-completed', ({ result, fromCache, event, context }: {
  result: any;
  fromCache: boolean;
  event: WatchEvent;
  context: WatchContext;
}) => void);

watchManager.on('optimization-error', ({ error }: { error: Error }) => void);

// Cache events
watchManager.on('cache-hit', ({ type, key }: { type: string; key: string }) => void);
watchManager.on('cache-miss', ({ type, key }: { type: string; key: string }) => void);
watchManager.on('cache-invalidated', ({ reason }: { reason: string }) => void);
watchManager.on('caches-cleared', () => void);

// Configuration events
watchManager.on('config-updated', ({ config, context }: {
  config: Partial<WatchModeConfig>;
  context: WatchContext;
}) => void);

// File type specific events
watchManager.on('js-file-changed', ({ event, context }: {
  event: WatchEvent;
  context: WatchContext;
}) => void);

watchManager.on('css-file-changed', ({ event, context }: {
  event: WatchEvent;
  context: WatchContext;
}) => void);

watchManager.on('html-file-changed', ({ event, context }: {
  event: WatchEvent;
  context: WatchContext;
}) => void);

watchManager.on('config-file-changed', ({ event, context }: {
  event: WatchEvent;
  context: WatchContext;
}) => void);
```

### WatchEventHandler Events

```typescript
// Processing events
eventHandler.on('batch-processed', ({ events, context }: {
  events: WatchEvent[];
  context: WatchContext;
}) => void);

eventHandler.on('batch-error', ({ error, events, context }: {
  error: Error;
  events: WatchEvent[];
  context: WatchContext;
}) => void);

// Processor events
eventHandler.on('processor-completed', ({ processor, event, context, duration }: {
  processor: EventProcessor;
  event: WatchEvent;
  context: WatchContext;
  duration: number;
}) => void);

eventHandler.on('processor-error', ({ processor, event, context, error, duration }: {
  processor: EventProcessor;
  event: WatchEvent;
  context: WatchContext;
  error: Error;
  duration: number;
}) => void);

// Optimization events
eventHandler.on('optimization-completed', ({ event, context, results, duration }: {
  event: WatchEvent;
  context: WatchContext;
  results: OptimizationResult[];
  duration: number;
}) => void);

eventHandler.on('optimization-error', ({ event, context, error, duration }: {
  event: WatchEvent;
  context: WatchContext;
  error: Error;
  duration: number;
}) => void);
```

## Factory Functions

### Configuration Factories

```typescript
// Create default configuration
function createWatchConfiguration(
  config?: Partial<WatchModeConfig>,
  projectRoot?: string
): WatchConfiguration;

// Create production configuration
function createProductionWatchConfiguration(projectRoot?: string): WatchConfiguration;

// Create test configuration
function createTestWatchConfiguration(projectRoot?: string): WatchConfiguration;

// Create watch logger
function createWatchLogger(config: WatchModeConfig, component?: string): WatchLogger;
```

### Default Configurations

```typescript
const DEFAULT_WATCH_MODE_CONFIG: WatchModeConfig;
const DEFAULT_WATCH_PATTERNS: WatchPattern[];
const DEFAULT_IGNORED_PATTERNS: string[];
```

## Interface Implementations

### IWatchManager

```typescript
interface IWatchManager extends EventEmitter {
  start(config: WatchModeConfig): Promise<void>;
  stop(): Promise<void>;
  restart(): Promise<void>;
  addHandler(handler: WatchHandler): void;
  removeHandler(handlerId: string): void;
  getStats(): WatchStats;
  isActive(): boolean;
  updateConfig(config: Partial<WatchModeConfig>): void;
}
```

### IWatchEventHandler

```typescript
interface IWatchEventHandler extends EventEmitter {
  handleEvent(event: WatchEvent, context: WatchContext): Promise<void>;
  addProcessor(processor: EventProcessor): void;
  removeProcessor(processorId: string): void;
  getProcessors(): EventProcessor[];
}
```

### IFileWatcher

```typescript
interface IFileWatcher extends EventEmitter {
  watch(patterns: string[], config: WatchConfig): Promise<void>;
  unwatch(patterns?: string[]): Promise<void>;
  add(paths: string | string[]): void;
  remove(paths: string | string[]): void;
  getWatched(): string[];
  close(): Promise<void>;
}
```

## Error Types

### Watch Errors

```typescript
class WatchModeError extends Error {
  constructor(message: string, public code?: string) {
    super(message);
    this.name = 'WatchModeError';
  }
}

class ConfigurationError extends WatchModeError {
  constructor(message: string, public field?: string) {
    super(message, 'CONFIG_ERROR');
    this.name = 'ConfigurationError';
  }
}

class FileWatchError extends WatchModeError {
  constructor(message: string, public path?: string) {
    super(message, 'FILE_WATCH_ERROR');
    this.name = 'FileWatchError';
  }
}

class OptimizationError extends WatchModeError {
  constructor(message: string, public stage?: string) {
    super(message, 'OPTIMIZATION_ERROR');
    this.name = 'OptimizationError';
  }
}
```

## Advanced Usage Examples

### Custom Event Processor

```typescript
const customProcessor: EventProcessor = {
  id: 'tailwind-extractor',
  name: 'Tailwind Class Extractor',
  priority: 1,
  patterns: ['**/*.{js,jsx,ts,tsx,vue,svelte}'],
  enabled: true,
  process: async (event: WatchEvent, context: WatchContext) => {
    if (event.type === 'change' || event.type === 'add') {
      // Extract Tailwind classes from file
      const content = await fs.readFile(event.path, 'utf-8');
      const classes = extractTailwindClasses(content);
      
      // Update optimization context
      context.metadata.extractedClasses = classes;
    }
  }
};

watchManager.eventHandler.addProcessor(customProcessor);
```

### Custom Cache Strategy

```typescript
const cacheConfig = {
  caching: {
    enabled: true,
    strategy: 'hybrid' as const,
    maxAge: 5 * 60 * 1000, // 5 minutes
    maxSize: 200 * 1024 * 1024, // 200MB
    
    // Custom eviction based on file types
    evictionStrategy: 'adaptive' as const,
    
    // Predictive prefetching for related files
    enablePredictivePrefetch: true,
    prefetchThreshold: 0.8,
    
    // Compression for disk cache
    compressionEnabled: true,
    
    // Analytics for optimization
    analyticsEnabled: true,
    
    // Debouncing to prevent cache thrashing
    fileChangeDebounce: 800
  }
};
```

### Performance Monitoring

```typescript
class WatchPerformanceMonitor {
  private watchManager: WatchManager;
  private metrics: Map<string, number[]> = new Map();
  
  constructor(watchManager: WatchManager) {
    this.watchManager = watchManager;
    this.setupMonitoring();
  }
  
  private setupMonitoring() {
    this.watchManager.on('optimization-completed', ({ result, duration }) => {
      this.recordMetric('optimization-time', duration);
    });
    
    this.watchManager.on('cache-hit', () => {
      this.recordMetric('cache-hits', 1);
    });
    
    this.watchManager.on('cache-miss', () => {
      this.recordMetric('cache-misses', 1);
    });
  }
  
  private recordMetric(name: string, value: number) {
    const values = this.metrics.get(name) || [];
    values.push(value);
    
    // Keep only last 100 values
    if (values.length > 100) {
      values.shift();
    }
    
    this.metrics.set(name, values);
  }
  
  getAverageOptimizationTime(): number {
    const times = this.metrics.get('optimization-time') || [];
    return times.reduce((sum, time) => sum + time, 0) / times.length;
  }
  
  getCacheHitRatio(): number {
    const hits = this.metrics.get('cache-hits')?.length || 0;
    const misses = this.metrics.get('cache-misses')?.length || 0;
    return hits / (hits + misses);
  }
}
```