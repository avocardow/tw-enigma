# Watch Mode Development Guide

## Overview

TW-Enigma's Watch Mode provides real-time optimization and hot reload capabilities for development workflows. It monitors file changes and automatically applies Tailwind CSS optimizations with intelligent caching, debouncing, and performance optimization.

## Features

- **Real-time File Monitoring**: Watches source files for changes using efficient file system events
- **Intelligent Caching**: Multi-level caching with strategic and optimization caches
- **Debouncing & Throttling**: Prevents excessive processing during rapid file changes
- **Hot Reload Integration**: Seamless integration with development servers
- **Performance Optimization**: Concurrent processing with configurable limits
- **Enhanced Logging**: Color-coded console output with detailed progress tracking

## Quick Start

### Basic Usage

```typescript
import { WatchManager } from '@tw-enigma/core';

const watchManager = new WatchManager({
  mode: 'development',
  hotReload: true,
  autoRefresh: true
});

await watchManager.start();
```

### Configuration Options

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
  
  caching: {
    enabled: boolean;
    strategy: 'memory' | 'disk' | 'hybrid';
    maxAge: number;
    maxSize: number;
    enablePredictivePrefetch: boolean;
    // ... more caching options
  };
  
  logging: {
    level: 'debug' | 'info' | 'warn' | 'error';
    verbose: boolean;
    timestamped: boolean;
  };
}
```

## Environment-Specific Configuration

### Development Mode

```typescript
const devConfig = {
  mode: 'development',
  hotReload: true,
  autoRefresh: true,
  notifications: true,
  logging: { 
    level: 'debug', 
    verbose: true, 
    timestamped: true 
  },
  performance: { 
    throttleMs: 100, 
    batchSize: 5, 
    maxConcurrency: 2 
  },
  caching: {
    enabled: true,
    strategy: 'memory',
    maxAge: 60000, // 1 minute for fast feedback
    fileChangeDebounce: 500
  }
};
```

### Production Mode

```typescript
const prodConfig = {
  mode: 'production',
  hotReload: false,
  autoRefresh: false,
  notifications: false,
  logging: { 
    level: 'warn', 
    verbose: false, 
    timestamped: false 
  },
  performance: { 
    throttleMs: 1000, 
    batchSize: 20, 
    maxConcurrency: 8 
  },
  caching: {
    enabled: true,
    strategy: 'hybrid',
    maxAge: 3600000, // 1 hour for stability
    enablePredictivePrefetch: true,
    compressionEnabled: true,
    fileChangeDebounce: 2000
  }
};
```

## Advanced Usage

### Custom Event Handlers

```typescript
const watchManager = new WatchManager(config);

// Add custom handlers for specific file types
watchManager.addHandler({
  id: 'custom-css-handler',
  priority: 1,
  patterns: ['**/*.css', '**/*.scss'],
  handler: async (event) => {
    console.log(`CSS file changed: ${event.path}`);
    // Custom processing logic
  },
  enabled: true
});

await watchManager.start();
```

### Performance Monitoring

```typescript
// Get real-time statistics
const stats = watchManager.getStats();
console.log('Watch Statistics:', {
  totalEvents: stats.totalEvents,
  uptime: stats.uptime,
  memoryUsage: stats.memoryUsage,
  cacheStats: stats.cacheStats
});

// Monitor events
watchManager.on('file-event', ({ event, context }) => {
  console.log(`File ${event.type}: ${event.path}`);
});

watchManager.on('optimization-completed', ({ result, fromCache }) => {
  console.log(`Optimization ${fromCache ? 'from cache' : 'processed'}`);
});
```

### Cache Management

```typescript
// Manual cache operations
await watchManager.clearCaches();
await watchManager.invalidateCacheForFiles(['src/styles.css']);

// Get cache analytics
const analytics = watchManager.getCacheAnalytics();
console.log('Cache Performance:', analytics);
```

## Integration Guides

### Webpack Integration

```javascript
// webpack.config.js
const { WatchManager } = require('@tw-enigma/core');

module.exports = {
  // ... webpack config
  plugins: [
    {
      apply: (compiler) => {
        const watchManager = new WatchManager({
          mode: process.env.NODE_ENV === 'development' ? 'development' : 'production'
        });

        compiler.hooks.watchRun.tapAsync('TW-Enigma-Watch', async (compiler, callback) => {
          await watchManager.start();
          callback();
        });

        compiler.hooks.watchClose.tap('TW-Enigma-Watch', () => {
          watchManager.stop();
        });
      }
    }
  ]
};
```

### Vite Integration

```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import { WatchManager } from '@tw-enigma/core';

export default defineConfig({
  plugins: [
    {
      name: 'tw-enigma-watch',
      configureServer(server) {
        const watchManager = new WatchManager({
          mode: 'development',
          hotReload: true
        });

        server.middlewares.use('/tw-enigma-status', (req, res) => {
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(watchManager.getStats()));
        });

        watchManager.start();
        
        return () => watchManager.stop();
      }
    }
  ]
});
```

### Next.js Integration

```javascript
// next.config.js
const { WatchManager } = require('@tw-enigma/core');

let watchManager;

module.exports = {
  webpack: (config, { dev }) => {
    if (dev && !watchManager) {
      watchManager = new WatchManager({
        mode: 'development',
        hotReload: true,
        autoRefresh: true
      });
      watchManager.start();
    }
    return config;
  }
};
```

## File Patterns and Prioritization

### Default Watch Patterns

```typescript
const defaultPatterns = [
  {
    glob: 'src/**/*.{js,jsx,ts,tsx}',
    priority: 1,
    debounceMs: 200
  },
  {
    glob: 'src/**/*.{css,scss,sass,less}',
    priority: 2,
    debounceMs: 300
  },
  {
    glob: 'src/**/*.{html,htm,vue,svelte}',
    priority: 3,
    debounceMs: 500
  }
];
```

### Custom Pattern Configuration

```typescript
const watchConfig = new WatchConfiguration({
  // Base configuration
}, [
  // Custom patterns
  {
    glob: 'components/**/*.tsx',
    priority: 0, // Highest priority
    debounceMs: 150,
    enabled: true,
    metadata: { type: 'component', framework: 'react' }
  }
]);
```

## Performance Optimization

### Debouncing Configuration

Different file types have optimized debounce times:

- **JavaScript/TypeScript**: 200ms (fast feedback)
- **CSS/SCSS**: 300ms (medium debounce)
- **HTML/Templates**: 500ms (longer debounce)
- **Configuration files**: Auto-restart trigger

### Throttling Settings

```typescript
// Prevent overwhelming the system
const performanceConfig = {
  throttleMs: 100,      // Minimum time between processing
  batchSize: 10,        // Events processed per batch
  maxConcurrency: 4     // Parallel processing limit
};
```

### Cache Strategy Selection

- **Memory**: Fast access, limited by RAM
- **Disk**: Persistent, larger capacity
- **Hybrid**: Best of both worlds (recommended)

## Logging and Debugging

### Log Levels

- **trace**: Detailed execution flow
- **debug**: Development debugging info
- **info**: General operational messages
- **warn**: Warning conditions
- **error**: Error conditions only

### Enhanced Console Output

```typescript
// Enable verbose logging
const config = {
  logging: {
    level: 'debug',
    verbose: true,
    timestamped: true
  }
};

// Watch mode provides color-coded output:
// 🚀 Watch mode started
// 📄 ADD: src/component.tsx
// ✏️ CHANGE: src/styles.css
// ✅ Optimization completed - 45ms
// ⚡ Optimization completed (cache hit) - 2ms
// 💾 Cache HIT: optimization-key
// 📦 Batch processed 5 events in 120ms
```

### Log File Output

```typescript
const logger = createWatchLogger({
  logging: {
    level: 'info',
    verbose: false,
    timestamped: true
  }
}, 'MyWatchMode');

// Logs are automatically structured and can be output to files
// via the underlying logger system
```

## Error Handling and Troubleshooting

### Common Issues

#### High Memory Usage

```typescript
// Reduce cache size
const config = {
  caching: {
    maxSize: 50 * 1024 * 1024, // 50MB instead of default 100MB
    evictionStrategy: 'lru'     // Aggressive cleanup
  }
};
```

#### Slow Performance

```typescript
// Optimize for speed
const config = {
  performance: {
    throttleMs: 200,      // Higher throttle
    batchSize: 20,        // Larger batches
    maxConcurrency: 8     // More parallel processing
  },
  caching: {
    strategy: 'memory',   // Fastest cache
    enablePredictivePrefetch: false // Reduce overhead
  }
};
```

#### Too Many File Events

```typescript
// Increase debouncing
const config = {
  caching: {
    fileChangeDebounce: 1000  // Wait 1 second before processing
  }
};

// Or add more specific ignore patterns
const watchConfig = new WatchConfiguration(config, patterns, [
  '**/node_modules/**',
  '**/.git/**',
  '**/dist/**',
  '**/coverage/**',
  '**/*.log'
]);
```

### Debugging Commands

```typescript
// Get current statistics
console.log(watchManager.getStats());

// Get event handler statistics  
console.log(watchManager.getEventHandlerStats());

// Reset statistics
watchManager.resetEventStats();

// Check if watch mode is active
console.log(watchManager.isActive());
```

## API Reference

### WatchManager Class

#### Constructor
```typescript
constructor(config?: Partial<WatchModeConfig>, projectRoot?: string)
```

#### Methods

##### `start(config?: WatchModeConfig): Promise<void>`
Start watch mode with optional configuration override.

##### `stop(): Promise<void>`
Stop watch mode and clean up resources.

##### `restart(): Promise<void>`
Restart watch mode (equivalent to stop + start).

##### `addHandler(handler: WatchHandler): void`
Add custom event handler for specific patterns.

##### `removeHandler(handlerId: string): void`
Remove event handler by ID.

##### `getStats(): WatchStats`
Get current watch statistics including performance metrics.

##### `isActive(): boolean`
Check if watch mode is currently active.

##### `updateConfig(config: Partial<WatchModeConfig>): void`
Update configuration while running.

#### Events

```typescript
// File system events
watchManager.on('file-event', ({ event, context }) => {});
watchManager.on('batch-processed', ({ events, context }) => {});

// Optimization events
watchManager.on('optimization-completed', ({ result, fromCache }) => {});
watchManager.on('optimization-error', ({ error }) => {});

// Cache events
watchManager.on('cache-hit', ({ type, key }) => {});
watchManager.on('cache-miss', ({ type, key }) => {});
watchManager.on('cache-invalidated', ({ reason }) => {});

// Lifecycle events
watchManager.on('started', ({ context }) => {});
watchManager.on('stopped', ({ context }) => {});
watchManager.on('error', ({ error, context }) => {});
```

### WatchLogger Class

#### Methods

##### `logWatchStart(patterns: string[], projectRoot: string): void`
Log watch mode startup with patterns.

##### `logWatchStop(duration: number): void`
Log watch mode shutdown with duration.

##### `logFileEvent(event: WatchEvent, processed: boolean, reason?: string): void`
Log file system events with processing status.

##### `logOptimization(files: string[], duration: number, success: boolean, cacheHit: boolean): void`
Log optimization completion with performance metrics.

##### `logCacheOperation(operation: 'hit' | 'miss' | 'set' | 'invalidate', key: string, details?: any): void`
Log cache operations with color coding.

##### `logBatchProcessing(eventCount: number, duration: number, concurrency: number): void`
Log batch processing statistics.

##### `logPerformanceStats(stats: WatchStats): void`
Log performance statistics in verbose mode.

## Best Practices

### Development Workflow

1. **Start Simple**: Begin with default configuration
2. **Monitor Performance**: Use `getStats()` to track resource usage
3. **Optimize Gradually**: Adjust throttling and caching based on needs
4. **Use Verbose Logging**: Enable detailed logs during development
5. **Handle Errors**: Implement proper error handling for production

### Production Deployment

1. **Disable Hot Reload**: Set `hotReload: false` in production
2. **Optimize Caching**: Use hybrid strategy with larger cache sizes
3. **Reduce Logging**: Use warn/error level only
4. **Increase Batching**: Higher batch sizes for better throughput
5. **Monitor Resources**: Track memory and CPU usage

### Integration Tips

1. **Framework Integration**: Use framework-specific hooks when available
2. **Custom Handlers**: Add handlers for framework-specific patterns
3. **Error Boundaries**: Wrap watch operations in try-catch blocks
4. **Cleanup**: Always call `stop()` on application shutdown
5. **Testing**: Use test mode configuration for automated testing

## Migration Guide

### From Manual File Watching

```typescript
// Before: Manual fs.watch
fs.watch('src', { recursive: true }, (eventType, filename) => {
  // Manual processing
});

// After: TW-Enigma Watch Mode
const watchManager = new WatchManager({
  mode: 'development'
});
await watchManager.start();
```

### From Build Tool Watchers

```typescript
// Before: Webpack watch mode only
module.exports = {
  watch: true,
  // ...
};

// After: Integrated TW-Enigma watching
module.exports = {
  plugins: [
    new TwEnigmaWatchPlugin()
  ]
};
```

## Contributing

When contributing to Watch Mode functionality:

1. **Follow Patterns**: Use existing event handler patterns
2. **Add Tests**: Include tests for new watch patterns
3. **Update Docs**: Document new configuration options
4. **Performance**: Consider performance implications
5. **Logging**: Add appropriate logging with proper levels

## Support

For issues and support:

1. Check the troubleshooting section
2. Enable verbose logging for detailed diagnostics
3. Review the API reference for proper usage
4. Submit issues with logs and configuration details