# TW-Enigma Resource Management System

## Overview

The TW-Enigma Resource Management System provides comprehensive resource quota management, enforcement, and monitoring to prevent resource exhaustion and ensure predictable performance during large-scale CSS processing operations.

## Architecture

### Core Components

#### 1. ResourceManager (`resourceManager.ts`)
Central resource tracking and quota enforcement system that monitors:
- **Processing Limits**: File size, processing time, concurrency
- **Memory Quotas**: Heap usage, GC triggers, memory pressure handling
- **CPU Constraints**: Usage thresholds, throttling, concurrent operations
- **Network Limits**: Connection limits, rate limiting, timeouts
- **Disk I/O Quotas**: Usage limits, file handle management

#### 2. ResourceEnforcer (`resourceEnforcer.ts`)
Advanced enforcement system providing:
- **Multiple Strategies**: fail_fast, queue, throttle, graceful_degradation
- **Priority Queuing**: High/medium/low priority operation handling
- **Adaptive Scaling**: Automatic resource limit adjustments
- **Intelligent Throttling**: Dynamic backoff and recovery

#### 3. ResourceIntegration (`resourceIntegration.ts`)
Integration layer connecting resource management with TW-Enigma's processing pipeline:
- **File Processing**: Resource validation and tracking for individual files
- **Batch Processing**: Resource management for batch operations
- **Event Integration**: Real-time monitoring and alerting
- **Performance Insights**: Usage analysis and optimization recommendations

## Configuration

### Basic Configuration

```typescript
import { createResourceIntegration } from './optimization/resourceIntegration.js';

const resourceSystem = createResourceIntegration({
  resourceQuotas: {
    processing: {
      maxFileSize: 50 * 1024 * 1024,     // 50MB per file
      maxProcessingTime: 300000,          // 5 minutes
      maxConcurrentFiles: 100,            // 100 concurrent files
      maxFilesPerBatch: 1000,             // 1000 files per batch
    },
    memory: {
      maxHeapUsage: 2048,                 // 2GB heap limit
      gcTriggerThreshold: 0.8,            // GC at 80% usage
      enableAutomaticGC: true,
    },
    cpu: {
      maxCpuUsage: 0.8,                   // 80% CPU limit
      maxConcurrentOperations: 10,
      enableCpuThrottling: true,
    },
  },
  resourceEnforcement: {
    enforcement: {
      strategy: 'throttle',               // throttle | queue | fail_fast | graceful_degradation
      enableAdaptiveScaling: true,
    },
    queuing: {
      maxQueueSize: 1000,
      queueTimeout: 300000,               // 5 minutes
      enablePriorityQueues: true,
    },
  },
});
```

### Environment Variable Configuration

```bash
# Processing limits
export TW_ENIGMA_MAX_FILE_SIZE=52428800          # 50MB
export TW_ENIGMA_MAX_PROCESSING_TIME=300000      # 5 minutes
export TW_ENIGMA_MAX_CONCURRENT_FILES=100

# Memory limits
export TW_ENIGMA_MAX_HEAP_USAGE=2048             # 2GB in MB
export TW_ENIGMA_GC_TRIGGER_THRESHOLD=0.8        # 80%

# CPU limits
export TW_ENIGMA_MAX_CPU_USAGE=0.8               # 80%
export TW_ENIGMA_MAX_CONCURRENT_OPERATIONS=10

# Network limits
export TW_ENIGMA_MAX_CONNECTIONS=50
export TW_ENIGMA_CONNECTION_TIMEOUT=30000        # 30 seconds
export TW_ENIGMA_MAX_REQUESTS_PER_SECOND=100

# Enforcement strategy
export TW_ENIGMA_ENFORCEMENT_STRATEGY=throttle
export TW_ENIGMA_MAX_QUEUE_SIZE=1000
```

### Environment-Specific Configurations

#### Development Environment
```typescript
const devConfig = getDefaultResourceConfig('development');
// - Lower limits for development safety
// - Aggressive error reporting
// - Real-time monitoring enabled
```

#### Production Environment
```typescript
const prodConfig = getDefaultResourceConfig('production');
// - Higher limits for production throughput
// - Queue-based enforcement for reliability
// - Advanced monitoring and alerting
```

#### Test Environment
```typescript
const testConfig = getDefaultResourceConfig('test');
// - Minimal limits for fast test execution
// - Fail-fast enforcement
// - Monitoring disabled for performance
```

## Usage Examples

### File Processing with Resource Management

```typescript
import { createResourceIntegration } from './optimization/resourceIntegration.js';

// Initialize resource system
const resourceSystem = createResourceIntegration({
  resourceQuotas: {
    processing: {
      maxFileSize: 10 * 1024 * 1024, // 10MB limit
      maxConcurrentFiles: 5,
    },
  },
});

// Process a file with resource validation
async function processFileWithQuotas(filePath: string) {
  const stats = await fs.stat(filePath);
  
  // Request permission to process the file
  const allocation = await resourceSystem.requestFileProcessing(
    filePath,
    stats.size,
    {
      priority: 'medium',
      estimatedProcessingTime: 30000, // 30 seconds
      estimatedMemoryUsage: 100,      // 100MB
    }
  );
  
  if (!allocation.allowed) {
    console.warn(`File rejected: ${allocation.reason}`);
    if (allocation.queuePosition) {
      console.info(`Queue position: ${allocation.queuePosition}, estimated wait: ${allocation.estimatedWaitTime}ms`);
    }
    return;
  }
  
  try {
    // Process the file
    console.log(`Processing ${filePath}...`);
    await actualFileProcessing(filePath);
    
    // Mark as completed successfully
    resourceSystem.completeFileProcessing(allocation.operationId!, true);
    console.log(`Successfully processed ${filePath}`);
    
  } catch (error) {
    // Mark as failed
    resourceSystem.completeFileProcessing(allocation.operationId!, false);
    console.error(`Failed to process ${filePath}:`, error);
  }
}
```

### Batch Processing with Resource Management

```typescript
// Process multiple files as a batch
async function processBatchWithQuotas(files: Array<{path: string, size: number}>) {
  const batchId = `batch_${Date.now()}`;
  
  // Request permission for batch processing
  const allocation = await resourceSystem.requestBatchProcessing(
    batchId,
    files,
    {
      priority: 'high',
      estimatedProcessingTime: files.length * 5000, // 5s per file
      estimatedMemoryUsage: files.length * 50,      // 50MB per file
    }
  );
  
  if (!allocation.allowed) {
    console.warn(`Batch rejected: ${allocation.reason}`);
    return;
  }
  
  try {
    console.log(`Processing batch of ${files.length} files...`);
    
    // Process files with individual resource tracking
    for (const file of files) {
      await processFileWithQuotas(file.path);
    }
    
    // Mark batch as completed
    resourceSystem.completeBatchProcessing(allocation.operationId!, true);
    console.log(`Successfully processed batch ${batchId}`);
    
  } catch (error) {
    resourceSystem.completeBatchProcessing(allocation.operationId!, false);
    console.error(`Batch processing failed:`, error);
  }
}
```

### Monitoring and Alerting

```typescript
// Set up resource monitoring
resourceSystem.on('resource.violation', (event) => {
  console.warn(`Resource violation: ${event.category} - ${event.message} (${event.severity})`);
  
  if (event.severity === 'critical') {
    // Trigger alert system
    notifyOpsTeam(event);
  }
});

resourceSystem.on('memory.pressure', (event) => {
  console.warn(`Memory pressure detected: ${event.usage}MB / ${event.limit}MB`);
  console.info(`Action taken: ${event.action}`);
});

resourceSystem.on('throttling.activated', (event) => {
  console.info(`Throttling activated: ${event.reason}, backoff: ${event.backoffMs}ms`);
});

// Get real-time resource status
setInterval(() => {
  const status = resourceSystem.getResourceStatus();
  
  console.log('Resource Status:');
  console.log(`- Memory: ${status.currentUsage.memory.heapUsed.toFixed(2)}MB (${(status.currentUsage.memory.percentage * 100).toFixed(1)}%)`);
  console.log(`- Active operations: ${status.activeOperations.total}`);
  console.log(`- Queue size: ${status.enforcement.queues.total}`);
  console.log(`- Violations: ${status.violations.length}`);
}, 10000); // Every 10 seconds
```

### Dynamic Configuration Updates

```typescript
// Update resource limits at runtime
resourceSystem.updateConfiguration({
  resourceQuotas: {
    processing: {
      maxConcurrentFiles: 200, // Increase concurrency
    },
    memory: {
      maxHeapUsage: 4096, // Increase memory limit to 4GB
    },
  },
});

console.log('Resource limits updated');
```

## Enforcement Strategies

### 1. Fail Fast (`fail_fast`)
- **Behavior**: Immediately reject operations when limits are exceeded
- **Use Case**: Testing environments, strict resource control
- **Pros**: Predictable behavior, prevents resource exhaustion
- **Cons**: May reject valid operations during temporary spikes

### 2. Queue (`queue`)
- **Behavior**: Queue operations when limits are exceeded
- **Use Case**: Production environments, guaranteed processing
- **Pros**: Ensures all operations eventually process
- **Cons**: May lead to long wait times during high load

### 3. Throttle (`throttle`)
- **Behavior**: Apply progressive delays when limits are exceeded
- **Use Case**: Balanced environments, gradual backpressure
- **Pros**: Adaptive response, maintains throughput
- **Cons**: Increased latency during resource pressure

### 4. Graceful Degradation (`graceful_degradation`)
- **Behavior**: Reduce operation scope/quality when limits are exceeded
- **Use Case**: Performance-critical environments
- **Pros**: Maintains service availability
- **Cons**: Reduced output quality

## Performance Monitoring

### Real-time Metrics

The resource system provides comprehensive metrics:

```typescript
const metrics = resourceSystem.getResourceStatus();

// Processing metrics
console.log(`Files processed: ${metrics.statistics.totalFilesProcessed}`);
console.log(`Average processing time: ${metrics.statistics.averageFileProcessingTime}ms`);
console.log(`Rejection rate: ${metrics.statistics.totalFilesRejected / (metrics.statistics.totalFilesProcessed + metrics.statistics.totalFilesRejected) * 100}%`);

// Resource utilization
console.log(`Memory usage: ${metrics.currentUsage.memory.percentage * 100}%`);
console.log(`Active operations: ${metrics.activeOperations.total}`);
console.log(`Queue utilization: ${metrics.enforcement.queues.total / 1000 * 100}%`);

// Violations and issues
console.log(`Active violations: ${metrics.violations.length}`);
console.log(`Total resource violations: ${metrics.statistics.totalResourceViolations}`);
```

### Performance Recommendations

```typescript
const recommendations = resourceSystem.getPerformanceRecommendations();

recommendations.forEach(rec => {
  console.log(`${rec.category}: ${rec.recommendation}`);
  console.log(`  Impact: ${rec.impact}, Effort: ${rec.effort}`);
});

// Example output:
// memory: Consider increasing memory limits or enabling more aggressive garbage collection
//   Impact: high, Effort: low
// concurrency: Consider increasing concurrent file processing limits
//   Impact: medium, Effort: medium
```

## Integration with Existing Systems

### Metrics Collector Integration

```typescript
import { MetricsCollector } from '../metrics/collector.js';
import { createResourceIntegration } from './resourceIntegration.js';

const metricsCollector = new MetricsCollector();
const resourceSystem = createResourceIntegration(config, metricsCollector);

// Resource metrics are automatically collected and integrated
```

### Performance Monitor Integration

```typescript
import { PerformanceMonitor } from '../metrics/performanceMonitor.js';
import { createResourceIntegration } from './resourceIntegration.js';

const performanceMonitor = new PerformanceMonitor(metricsCollector);
const resourceSystem = createResourceIntegration(config, metricsCollector, performanceMonitor);

// Performance data feeds into resource management decisions
```

### Memory Monitor Integration

```typescript
import { MemoryMonitor } from '../metrics/memoryMonitor.js';
import { createResourceIntegration } from './resourceIntegration.js';

const memoryMonitor = new MemoryMonitor({}, metricsCollector, performanceMonitor);
const resourceSystem = createResourceIntegration(config, metricsCollector, performanceMonitor, memoryMonitor);

// Memory monitoring provides real-time data for resource decisions
```

## Error Handling and Recovery

### Automatic Recovery

```typescript
// Automatic memory reclamation
resourceSystem.on('memory.pressure', async () => {
  console.log('Memory pressure detected, initiating cleanup...');
  
  // System automatically:
  // 1. Clears low-priority operations
  // 2. Triggers garbage collection
  // 3. Reduces cache sizes
  // 4. Switches to memory-efficient mode
});

// Automatic scaling
resourceSystem.on('resource.scaled', (event) => {
  console.log(`Auto-scaled ${event.resource}: ${event.fromValue} -> ${event.toValue}`);
});
```

### Manual Recovery

```typescript
// Emergency cleanup
await resourceSystem.emergencyCleanup();
console.log('Emergency cleanup completed');

// Configuration adjustments
resourceSystem.updateConfiguration({
  resourceQuotas: {
    memory: {
      maxHeapUsage: resourceSystem.getCurrentUsage().memory.heapUsed * 2, // Double current usage
    },
  },
});
```

## Best Practices

### 1. Configuration Tuning

- **Start Conservative**: Begin with lower limits and increase based on monitoring
- **Environment-Specific**: Use different configs for dev/test/prod
- **Monitor Continuously**: Track metrics to identify optimization opportunities

### 2. Error Handling

```typescript
// Always handle allocation failures gracefully
const allocation = await resourceSystem.requestFileProcessing(filePath, fileSize);
if (!allocation.allowed) {
  // Log the reason
  logger.warn(`File processing rejected: ${allocation.reason}`);
  
  // Implement retry logic if appropriate
  if (allocation.queuePosition && allocation.estimatedWaitTime) {
    await scheduleRetry(filePath, allocation.estimatedWaitTime);
  }
  
  return;
}
```

### 3. Resource Estimation

```typescript
// Provide accurate estimates for better resource planning
const allocation = await resourceSystem.requestFileProcessing(filePath, fileSize, {
  estimatedProcessingTime: calculateEstimatedTime(fileSize),
  estimatedMemoryUsage: calculateEstimatedMemory(fileComplexity),
  priority: determinePriority(fileType),
});
```

### 4. Monitoring Integration

```typescript
// Integrate with existing monitoring systems
resourceSystem.on('resource.violation', (event) => {
  // Send to metrics system
  metricsCollector.incrementCounter('resource_violations_total', {
    category: event.category,
    severity: event.severity,
  });
  
  // Send alerts
  if (event.severity === 'critical') {
    alerting.sendAlert('resource_violation', event);
  }
});
```

## Troubleshooting

### Common Issues

#### High Memory Usage
```typescript
// Check memory configuration
const status = resourceSystem.getResourceStatus();
if (status.currentUsage.memory.percentage > 0.9) {
  console.log('Memory usage high, consider:');
  console.log('- Increasing maxHeapUsage limit');
  console.log('- Reducing maxConcurrentFiles');
  console.log('- Enabling more aggressive GC');
  console.log('- Implementing batch size limits');
}
```

#### Frequent Rejections
```typescript
// Analyze rejection patterns
const stats = resourceSystem.getResourceStatus().statistics;
const rejectionRate = stats.totalFilesRejected / (stats.totalFilesProcessed + stats.totalFilesRejected);

if (rejectionRate > 0.1) {
  console.log('High rejection rate detected:');
  console.log('- Consider increasing resource limits');
  console.log('- Implement queue-based enforcement');
  console.log('- Add retry logic for rejected operations');
}
```

#### Queue Overflow
```typescript
resourceSystem.on('queue.overflow', (event) => {
  console.warn(`Queue overflow: ${event.size}/${event.limit}`);
  console.log('Consider:');
  console.log('- Increasing queue size');
  console.log('- Adding more processing capacity');
  console.log('- Implementing load balancing');
});
```

### Debugging

```typescript
// Enable detailed logging
const resourceSystem = createResourceIntegration({
  resourceIntegration: {
    monitoring: {
      enabled: true,
      realTimeUpdates: true,
    },
  },
});

// Monitor all events
resourceSystem.onAny((eventName, ...args) => {
  console.log(`Resource Event: ${eventName}`, args);
});
```

## Migration Guide

### From Legacy System

1. **Install Resource Management**:
   ```typescript
   import { createResourceIntegration } from './optimization/resourceIntegration.js';
   ```

2. **Replace Direct Processing**:
   ```typescript
   // Old approach
   await processFile(filePath);
   
   // New approach with resource management
   const allocation = await resourceSystem.requestFileProcessing(filePath, fileSize);
   if (allocation.allowed) {
     await processFile(filePath);
     resourceSystem.completeFileProcessing(allocation.operationId!, true);
   }
   ```

3. **Add Monitoring**:
   ```typescript
   // Set up resource monitoring
   resourceSystem.on('resource.violation', handleViolation);
   resourceSystem.on('memory.pressure', handleMemoryPressure);
   ```

4. **Configure Limits**:
   ```typescript
   // Start with conservative limits
   const config = getDefaultResourceConfig('production');
   // Adjust based on your system's capacity
   ```

## API Reference

### ResourceManager

#### Methods
- `startOperation(context: OperationContext): Promise<boolean>`
- `completeOperation(operationId: string, success?: boolean): void`
- `validateFileProcessing(filePath: string, fileSize: number): ValidationResult`
- `getCurrentUsage(): ResourceUsageSnapshot`
- `getStatistics(): ResourceStatistics`
- `updateConfig(updates: Partial<ResourceQuotaConfig>): void`

#### Events
- `resourceViolation`: Resource limit exceeded
- `memoryReclamationRequested`: Memory pressure detected
- `operationStarted`: Operation began
- `operationCompleted`: Operation finished

### ResourceEnforcer

#### Methods
- `requestAllocation(context: OperationContext): Promise<AllocationResult>`
- `completeOperation(operationId: string, success?: boolean): void`
- `getStatistics(): EnforcementStatistics`

#### Events
- `resourceScaled`: Automatic scaling occurred
- `throttlingActivated`: Throttling engaged
- `operationDegraded`: Operation quality reduced

### ResourceIntegration

#### Methods
- `requestFileProcessing(filePath: string, fileSize: number, options?): Promise<AllocationResult>`
- `completeFileProcessing(operationId: string, success?: boolean): void`
- `requestBatchProcessing(batchId: string, files: FileInfo[], options?): Promise<AllocationResult>`
- `completeBatchProcessing(operationId: string, success?: boolean): void`
- `getResourceStatus(): ResourceStatus`
- `getPerformanceRecommendations(): Recommendation[]`
- `updateConfiguration(updates: Partial<ExtendedResourceConfig>): void`
- `emergencyCleanup(): Promise<void>`

#### Events
- `file.processing.started`: File processing began
- `file.processing.completed`: File processing finished
- `file.processing.rejected`: File processing rejected
- `batch.processing.started`: Batch processing began
- `batch.processing.completed`: Batch processing finished
- `batch.processing.rejected`: Batch processing rejected
- `resource.violation`: Resource limit violated
- `memory.pressure`: Memory pressure detected
- `throttling.activated`: Throttling engaged

This comprehensive resource management system ensures TW-Enigma can handle large-scale processing workloads reliably while maintaining system stability and predictable performance.