# Error Handling and Logging Guide

A comprehensive guide to TW-Enigma's robust error handling and logging system.

## Table of Contents

- [Overview](#overview)
- [Error Categories and Severity](#error-categories-and-severity)
- [Logging System](#logging-system)
- [Error Recovery Strategies](#error-recovery-strategies)
- [Circuit Breaker Pattern](#circuit-breaker-pattern)
- [Common Error Scenarios](#common-error-scenarios)
- [Configuration](#configuration)
- [Monitoring and Analytics](#monitoring-and-analytics)
- [API Reference](#api-reference)
- [Best Practices](#best-practices)

## Overview

TW-Enigma provides a comprehensive error handling and logging system designed for robustness, observability, and automatic recovery. The system includes:

- **Centralized Error Handling**: All errors flow through a unified system
- **Structured Logging**: Configurable logging with multiple output formats
- **Circuit Breaker Pattern**: Prevents cascading failures
- **Automatic Recovery**: Smart retry and fallback mechanisms
- **Rich Context**: Detailed error information for debugging
- **Performance Analytics**: Real-time health monitoring

## Error Categories and Severity

### Error Categories

```typescript
enum ErrorCategory {
  OPERATIONAL = 'operational', // File system, network, permissions
  PROGRAMMING = 'programming', // Type errors, logic errors
  EXTERNAL_SERVICE = 'external', // API failures, timeouts
  CONFIGURATION = 'configuration', // Invalid config, env vars
  RESOURCE = 'resource', // Memory, disk, CPU limits
  VALIDATION = 'validation', // Input validation, schema violations
}
```

### Severity Levels

```typescript
enum ErrorSeverity {
  CRITICAL = 'critical', // System-threatening, immediate attention
  HIGH = 'high', // Functional errors affecting core operations
  MEDIUM = 'medium', // Recoverable errors with automatic retry
  LOW = 'low', // Warning-level issues with graceful degradation
}
```

### Enhanced Error Types

The system provides specialized error classes for different scenarios:

```typescript
// Validation errors
throw new ValidationError('Invalid configuration', context, {
  validationPath: 'config.optimization.level',
  expectedType: 'number',
  receivedValue: 'invalid',
  constraintViolations: ['Must be between 1 and 10'],
});

// File operation errors
throw new FileOperationError('Failed to write file', context, {
  operation: 'write',
  filePath: '/path/to/file.css',
  permissions: '644',
  fileSize: 1024,
});

// Performance errors
throw new PerformanceError('Operation timeout', context, {
  performanceType: 'timeout',
  threshold: 5000,
  actualValue: 7500,
  duration: 7500,
});

// Configuration errors
throw new ConfigurationError('Invalid plugin config', context, {
  configPath: '.enigma.config.js',
  configKey: 'plugins.optimization',
  expectedFormat: 'object',
  validOptions: ['enabled', 'disabled', 'auto'],
});

// Integration errors
throw new IntegrationError('Plugin compatibility issue', context, {
  integrationType: 'plugin',
  integrationName: '@my/plugin',
  version: '1.2.0',
  expectedVersion: '^2.0.0',
});
```

## Logging System

### Basic Usage

```typescript
import { createLogger } from '@tw-enigma/core';

const logger = createLogger('MyComponent');

logger.info('Starting optimization process');
logger.warn('Large file detected, this may take longer');
logger.error('Optimization failed', { filePath: '/path/to/file.css' });
```

### Configuration

```typescript
const logger = createLogger('MyComponent', {
  level: LogLevel.DEBUG,
  verbose: true,
  outputFormat: 'json',
  fileOutput: {
    filePath: './logs/enigma.log',
    format: 'json',
    maxSize: 10 * 1024 * 1024, // 10MB
    maxFiles: 5,
    compress: true,
  },
});
```

### Log Levels

```typescript
logger.trace('Detailed debug information');
logger.debug('General debug information');
logger.info('General information');
logger.warn('Warning conditions');
logger.error('Error conditions');
logger.fatal('Fatal error conditions');
```

### Structured Logging

```typescript
logger.info('File processed successfully', {
  component: 'FileProcessor',
  operation: 'optimize',
  filePath: '/src/styles.css',
  processingTime: 1250,
  fileSize: 15360,
  compressionRatio: 0.65,
});
```

### Performance Metrics

```typescript
logger.performanceMetrics('optimization', {
  memoryUsage: process.memoryUsage(),
  processingTime: 2500,
  fileCount: 15,
  totalFileSize: 245760,
  optimizationRatio: 0.78,
});
```

## Error Recovery Strategies

### Automatic Retry

```typescript
import { ErrorHandler } from '@tw-enigma/core';

const errorHandler = ErrorHandler.getInstance({
  maxRetries: 3,
  retryDelay: 1000,
  exponentialBackoff: true,
});

// Errors are automatically retried based on category and severity
await withErrorHandling(async () => {
  return await riskyOperation();
});
```

### Fallback Mechanisms

```typescript
// Graceful degradation
try {
  const optimizedCSS = await optimizer.optimize(css);
  return optimizedCSS;
} catch (error) {
  if (error.isRetryable()) {
    // Will be automatically retried
    throw error;
  }

  // Use fallback
  logger.warn('Optimization failed, using original CSS', { error });
  return originalCSS;
}
```

### Custom Recovery Strategies

```typescript
errorHandler.setRecoveryStrategy(
  ErrorCategory.EXTERNAL_SERVICE,
  async (error, context, attempt) => {
    if (attempt < 3) {
      // Exponential backoff
      await sleep(Math.pow(2, attempt) * 1000);
      return true; // Continue retrying
    }

    // Switch to cached data
    await switchToCachedData();
    return false; // Stop retrying
  }
);
```

## Circuit Breaker Pattern

The circuit breaker pattern prevents cascading failures by temporarily stopping requests to failing services.

### Basic Usage

```typescript
import { CircuitBreakerRegistry } from '@tw-enigma/core';

const circuit = CircuitBreakerRegistry.getInstance().getCircuit('external-api');

const result = await circuit.call(
  () => fetchFromAPI(),
  (error) => getCachedData() // Fallback
);
```

### Circuit States

- **CLOSED**: Normal operation, requests pass through
- **OPEN**: Circuit is broken, requests fail immediately with fallback
- **HALF_OPEN**: Testing state, limited requests allowed to test recovery

### Configuration

```typescript
const circuit = CircuitBreakerRegistry.getInstance().createCircuit('my-service', {
  failureThreshold: 5, // Open after 5 failures
  recoveryTimeout: 30000, // Wait 30s before trying recovery
  successThreshold: 3, // Close after 3 successful calls
  monitoringWindow: 60000, // Monitor failures over 60s window
});
```

## Common Error Scenarios

### File Operation Failures

```typescript
// Handle file permission errors
try {
  await fileProcessor.writeFile(content, filePath);
} catch (error) {
  if (error instanceof FileOperationError && error.operation === 'permission') {
    logger.error('Permission denied', {
      filePath: error.filePath,
      permissions: error.permissions,
      suggestion: 'Check file permissions and try again',
    });

    // Attempt to fix permissions
    await fs.chmod(error.filePath, 0o644);

    // Retry operation
    return await fileProcessor.writeFile(content, filePath);
  }
  throw error;
}
```

### Memory Pressure

```typescript
// Handle out of memory conditions
try {
  const result = await processLargeFiles(files);
  return result;
} catch (error) {
  if (error instanceof PerformanceError && error.performanceType === 'memory') {
    logger.warn('Memory pressure detected, switching to streaming mode');

    // Use streaming processor for large files
    return await streamingProcessor.process(files);
  }
  throw error;
}
```

### Configuration Validation

```typescript
// Handle invalid configuration
try {
  const config = await loadConfiguration();
  return config;
} catch (error) {
  if (error instanceof ConfigurationError) {
    logger.error('Configuration validation failed', {
      configPath: error.configPath,
      configKey: error.configKey,
      validOptions: error.validOptions,
      suggestion: 'Please check your configuration file',
    });

    // Use default configuration
    return getDefaultConfiguration();
  }
  throw error;
}
```

### External Service Failures

```typescript
// Handle API timeouts and failures
try {
  const data = await externalAPI.fetch();
  return data;
} catch (error) {
  if (error instanceof IntegrationError) {
    logger.warn('External service unavailable', {
      service: error.integrationName,
      version: error.version,
      suggestion: 'Using cached data instead',
    });

    // Circuit breaker will handle automatic fallback
    return await getCachedData();
  }
  throw error;
}
```

## Configuration

### Error Handler Configuration

```typescript
import { initializeErrorHandling } from '@tw-enigma/core';

// Initialize with custom configuration
const errorHandler = initializeErrorHandling({
  maxRetries: 5,
  retryDelay: 2000,
  exponentialBackoff: true,
  circuitBreakerEnabled: true,
  enableAnalytics: true,
  logLevel: 'info',

  // Alert thresholds
  alertThresholds: {
    critical: 1, // Alert immediately on critical errors
    high: 3, // Alert after 3 high-severity errors
    medium: 10, // Alert after 10 medium-severity errors
    low: 50, // Alert after 50 low-severity errors
  },

  // Circuit breaker settings
  circuitBreaker: {
    failureThreshold: 5,
    recoveryTimeout: 30000,
    successThreshold: 3,
    monitoringWindow: 60000,
  },

  // Retry settings
  retry: {
    maxAttempts: 3,
    baseDelay: 1000,
    maxDelay: 10000,
    backoffMultiplier: 2,
    jitter: true,
  },

  // Timeout settings
  timeouts: {
    operation: 30000,
    gracefulShutdown: 5000,
    resourceCleanup: 3000,
  },
});
```

### Environment Variables

```bash
# Logging configuration
TW_ENIGMA_LOG_LEVEL=debug
TW_ENIGMA_LOG_FORMAT=json
TW_ENIGMA_LOG_FILE=/var/log/enigma.log

# Error handling
TW_ENIGMA_MAX_RETRIES=5
TW_ENIGMA_RETRY_DELAY=2000
TW_ENIGMA_CIRCUIT_BREAKER_ENABLED=true

# Monitoring
TW_ENIGMA_ENABLE_ANALYTICS=true
TW_ENIGMA_HEALTH_CHECK_INTERVAL=30000
```

## Monitoring and Analytics

### System Health Monitoring

```typescript
import { getSystemHealth } from '@tw-enigma/core';

// Get overall system health
const health = getSystemHealth();
console.log('System Status:', health.overall);
console.log('Error Rate:', health.errorHandler.errorRate);
console.log('Circuit Breakers:', health.circuitBreakers);
```

### Error Analytics

```typescript
// Get detailed error analytics
const analytics = errorHandler.getAnalytics();

console.log('Total Errors:', analytics.totalErrors);
console.log('Recovery Rate:', analytics.recoveryRate);
console.log('Errors by Category:', analytics.errorsByCategory);
console.log('Errors by Severity:', analytics.errorsBySeverity);
```

### Health Checks

```typescript
// Custom health checks
errorHandler.addHealthCheck('database', async () => {
  try {
    await database.ping();
    return { status: 'pass', message: 'Database connection healthy' };
  } catch (error) {
    return {
      status: 'fail',
      message: 'Database connection failed',
      error: error.message,
    };
  }
});
```

### Event Handling

```typescript
// Listen to error events
errorHandler.on('error', (event) => {
  if (event.severity === 'critical') {
    // Send alert to monitoring system
    sendSlackAlert(`Critical error: ${event.message}`);
  }
});

errorHandler.on('recovery', (event) => {
  logger.info('Service recovered', {
    component: event.component,
    downtime: event.downtime,
  });
});
```

## API Reference

### Core Classes

#### ErrorHandler

```typescript
class ErrorHandler {
  static getInstance(config?: ErrorHandlerConfig): ErrorHandler;

  handleError(error: Error, context?: EnhancedErrorContext): Promise<boolean>;
  setRecoveryStrategy(category: ErrorCategory, strategy: ErrorRecoveryCallback): void;
  getAnalytics(): ErrorAnalytics;
  on(event: string, listener: Function): void;
  addHealthCheck(name: string, check: Function): void;
}
```

#### Logger

```typescript
class Logger {
  constructor(options: LoggerOptions);

  trace(message: string, context?: ErrorContext): void;
  debug(message: string, context?: ErrorContext): void;
  info(message: string, context?: ErrorContext): void;
  warn(message: string, context?: ErrorContext): void;
  error(messageOrError: string | Error, context?: ErrorContext): void;
  fatal(messageOrError: string | Error, context?: ErrorContext): void;

  performanceMetrics(operation: string, metrics: PerformanceMetrics): void;
  startProgress(id: string, options: ProgressOptions): void;
  updateProgress(id: string, current: number): void;
  completeProgress(id: string, summary?: string): void;
}
```

#### CircuitBreaker

```typescript
class CircuitBreaker {
  constructor(name: string, options: CircuitBreakerOptions);

  call<T>(operation: () => Promise<T>, fallback?: CircuitBreakerFallback<T>): Promise<T>;
  getMetrics(): CircuitBreakerMetrics;
  reset(): void;
  forceOpen(): void;
  forceClose(): void;
}
```

### Enhanced Error Classes

```typescript
// Base enhanced error with rich context
class EnhancedError extends Error {
  readonly context: ErrorContext;
  readonly originalError?: Error;

  getFormattedMessage(): string;
  isRetryable(): boolean;
  getRetryDelay(): number;
}

// Specialized error types
class ValidationError extends EnhancedError {
  /* ... */
}
class FileOperationError extends EnhancedError {
  /* ... */
}
class PerformanceError extends EnhancedError {
  /* ... */
}
class ConfigurationError extends EnhancedError {
  /* ... */
}
class IntegrationError extends EnhancedError {
  /* ... */
}
```

### Utility Functions

```typescript
// Error handling utilities
function withErrorHandling<T>(operation: () => Promise<T>): Promise<T>;
function categorizeError(error: Error): ErrorCategory;
function isRetryableError(error: Error): boolean;

// Logging utilities
function createLogger(component: string, options?: LoggerOptions): Logger;
function parseLogLevel(level: string): LogLevel;

// System utilities
function initializeErrorHandling(config?: Partial<ErrorHandlerConfig>): ErrorHandler;
function getSystemHealth(): SystemHealth;
function shutdownErrorHandling(): Promise<void>;
```

## Best Practices

### Error Handling

1. **Use Appropriate Error Types**: Choose the most specific error class for your scenario
2. **Provide Rich Context**: Include relevant information for debugging
3. **Handle Errors Gracefully**: Implement fallbacks and recovery strategies
4. **Don't Swallow Errors**: Always log or handle errors appropriately
5. **Use Circuit Breakers**: Protect against cascading failures

```typescript
// Good
try {
  const result = await riskyOperation();
  return result;
} catch (error) {
  logger.error('Operation failed', {
    operation: 'riskyOperation',
    parameters: {
      /* ... */
    },
    attempt: retryCount,
    suggestion: 'Check network connectivity',
  });

  if (error.isRetryable() && retryCount < maxRetries) {
    return await retryWithBackoff();
  }

  // Fallback
  return getDefaultResult();
}

// Bad
try {
  const result = await riskyOperation();
  return result;
} catch (error) {
  console.log('Error:', error.message); // Insufficient logging
  return null; // Silent failure
}
```

### Logging

1. **Use Structured Logging**: Include context and metadata
2. **Log at Appropriate Levels**: Don't over-log or under-log
3. **Include Performance Metrics**: Track timing and resource usage
4. **Use Consistent Format**: Maintain consistent log structure
5. **Avoid Sensitive Data**: Don't log passwords, tokens, or PII

```typescript
// Good
logger.info('User authentication successful', {
  userId: user.id,
  loginMethod: 'oauth',
  duration: loginDuration,
  ipAddress: request.ip,
  userAgent: request.userAgent,
});

// Bad
logger.info(`User ${user.email} logged in with password ${user.password}`);
```

### Monitoring

1. **Set Up Health Checks**: Monitor critical system components
2. **Use Circuit Breakers**: Prevent cascading failures
3. **Monitor Error Rates**: Track error trends over time
4. **Set Up Alerts**: Get notified of critical issues
5. **Regular Health Reviews**: Periodically review system health

```typescript
// Set up comprehensive monitoring
const errorHandler = initializeErrorHandling({
  enableAnalytics: true,
  alertThresholds: {
    critical: 1,
    high: 5,
    medium: 20,
    low: 100,
  },
});

// Add custom health checks
errorHandler.addHealthCheck('external-api', async () => {
  const start = Date.now();
  try {
    await api.healthCheck();
    return {
      status: 'pass',
      duration: Date.now() - start,
      message: 'API responding normally',
    };
  } catch (error) {
    return {
      status: 'fail',
      duration: Date.now() - start,
      message: `API health check failed: ${error.message}`,
    };
  }
});
```

### Performance

1. **Monitor Memory Usage**: Track memory consumption
2. **Use Timeouts**: Prevent hanging operations
3. **Implement Backpressure**: Handle high load gracefully
4. **Cache When Possible**: Reduce redundant operations
5. **Profile Regularly**: Identify performance bottlenecks

```typescript
// Monitor performance
logger.performanceMetrics('css-optimization', {
  memoryUsage: process.memoryUsage(),
  processingTime: Date.now() - startTime,
  fileCount: files.length,
  totalFileSize: totalSize,
  optimizationRatio: newSize / originalSize,
});
```

For more detailed information, see the [API Reference](./api-reference.md) and [Troubleshooting Guide](./TROUBLESHOOTING.md).
