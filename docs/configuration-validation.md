# Configuration Validation Guide

This guide covers the comprehensive configuration validation system in Tailwind Enigma Core, which provides robust validation, monitoring, and safety features for all configuration files and settings.

## Table of Contents

1. [Overview](#overview)
2. [Quick Start](#quick-start)
3. [Validation Components](#validation-components)
4. [Enhanced Configuration Manager](#enhanced-configuration-manager)
5. [Configuration Defaults](#configuration-defaults)
6. [Migration System](#migration-system)
7. [Performance Validation](#performance-validation)
8. [Backup and Restoration](#backup-and-restoration)
9. [File Watching](#file-watching)
10. [Error Handling](#error-handling)
11. [Best Practices](#best-practices)
12. [Troubleshooting](#troubleshooting)

## Overview

The configuration validation system provides multiple layers of validation and safety features:

- **JSON Schema Validation**: Comprehensive type checking and constraint validation
- **Runtime Validation**: Live monitoring of configuration constraints and resource usage
- **File Watching**: Automatic validation when configuration files change
- **Smart Defaults**: Environment-specific defaults with progressive fallbacks
- **Migration System**: Automatic configuration upgrades between versions
- **Performance Analysis**: Detection of performance bottlenecks and optimization recommendations
- **Backup & Restore**: Automatic backups with integrity verification and one-click restoration

## Quick Start

### Basic Usage

```typescript
import { createEnhancedConfigManager } from './src/config.js';

// Create configuration manager
const configManager = createEnhancedConfigManager('development', {
  enableWatching: true,
  enableBackup: true,
  enablePerformanceValidation: true
});

// Load and validate configuration
const result = await configManager.loadConfig();

console.log('Configuration loaded:', result.config);
console.log('Validation result:', result.validation);
console.log('Performance score:', result.performanceMetrics?.score);
```

### One-time Configuration Loading

```typescript
import { loadEnhancedConfig } from './src/config.js';

// Load configuration with validation (no watching)
const config = await loadEnhancedConfig('./my-project', 'production');
```

## Validation Components

### 1. JSON Schema Validation

The schema validator provides comprehensive type checking and constraint validation:

```typescript
import { createConfigValidator, validateConfigSchema } from './src/configValidator.js';

// Create validator
const validator = createConfigValidator();

// Validate configuration file
const result = await validator.validateFile('./enigma.config.json');

if (!result.isValid) {
  console.error('Validation errors:', result.errors);
  console.log('Suggestions:', result.suggestions);
}

// Validate configuration object
const schemaResult = await validateConfigSchema(config);
```

**Features:**
- Type checking for all configuration fields
- Cross-field validation (e.g., output path different from input)
- Security validation (path traversal protection)
- Performance validation (resource limits)
- Helpful error messages with suggestions

### 2. Runtime Validation

Runtime validation monitors configuration constraints during execution:

```typescript
import { createRuntimeValidator } from './src/runtimeValidator.js';

const runtimeValidator = createRuntimeValidator(config);

// Validate file system paths
const pathResult = await runtimeValidator.validatePaths();

// Validate resource constraints
const constraintResult = await runtimeValidator.validateConstraints();

// Complete validation
const completeResult = await runtimeValidator.validateComplete();

// Monitor runtime metrics
runtimeValidator.on('constraint-violation', (event) => {
  console.warn('Constraint violation:', event);
});

runtimeValidator.startMonitoring();
```

**Features:**
- File system path validation
- Resource constraint monitoring (memory, CPU, disk)
- Real-time constraint violation detection
- Performance impact assessment
- Security checks

## Enhanced Configuration Manager

The `EnhancedConfigManager` provides a comprehensive configuration management solution:

```typescript
import { createEnhancedConfigManager } from './src/config.js';

const manager = createEnhancedConfigManager('production', {
  enableWatching: true,
  enableBackup: true,
  enablePerformanceValidation: true,
  enableMigration: true,
  validateOnLoad: true,
  createBackupOnLoad: false
});

// Load configuration with full validation
const result = await manager.loadConfig('./project-root');

// Update configuration safely
const updateResult = await manager.updateConfig({
  concurrency: 8,
  minify: true
}, {
  createBackup: true,
  validateBeforeUpdate: true,
  description: 'Increase concurrency for production'
});

// Get performance metrics
const metrics = await manager.getPerformanceMetrics();

// List backups
const backups = manager.listBackups({
  tags: ['manual'],
  limit: 10
});

// Restore from backup
await manager.restoreFromBackup(backupId);

// Cleanup when done
await manager.cleanup();
```

## Configuration Defaults

The defaults system provides intelligent fallbacks and environment-specific configurations:

```typescript
import { createConfigDefaults, getEnvironmentDefaults } from './src/configDefaults.js';

// Get environment-specific defaults
const devDefaults = getEnvironmentDefaults('development');
const prodDefaults = getEnvironmentDefaults('production');

// Create defaults manager
const defaultsManager = createConfigDefaults('development');

// Apply defaults to partial configuration
const partialConfig = {
  inputPaths: ['./src'],
  concurrency: 4
};

const completeConfig = defaultsManager.createConfigWithDefaults(partialConfig);

// Get fallback chain
const fallbackChain = defaultsManager.getFallbackChain();
```

**Environment Defaults:**

| Setting | Development | Production | Test | CI |
|---------|-------------|------------|------|-----|
| `watch` | `true` | `false` | `false` | `false` |
| `minify` | `false` | `true` | `false` | `true` |
| `sourceMaps` | `true` | `false` | `true` | `false` |
| `concurrency` | `2` | `4` | `1` | `2` |
| `optimization.removeUnused` | `false` | `true` | `false` | `true` |

## Migration System

The migration system handles configuration upgrades between versions:

```typescript
import { createConfigMigration, migrateConfig, needsConfigMigration } from './src/configMigration.js';

// Check if migration is needed
const needsMigration = needsConfigMigration('./enigma.config.json');

// Migrate configuration
const migrationResult = await migrateConfig('./enigma.config.json', {
  autoMigrate: true,
  createBackup: true
});

if (migrationResult.success) {
  console.log('Migrations applied:', migrationResult.migrationsApplied);
} else {
  console.error('Migration failed:', migrationResult.errors);
}

// Manual migration management
const migration = createConfigMigration('./enigma.config.json');
const availableMigrations = migration.getAvailableMigrations();
```

**Supported Migrations:**
- `0.1.0 → 0.2.0`: Restructure optimization settings into nested object
- `0.2.0 → 0.3.0`: Add performance configuration section
- `0.3.0 → 0.4.0`: Update output format options

## Performance Validation

Performance validation analyzes configuration for bottlenecks and provides optimization recommendations:

```typescript
import { createPerformanceValidator, analyzeConfigPerformance } from './src/performanceValidator.js';

// Quick analysis
const metrics = await analyzeConfigPerformance(config);

console.log('Performance score:', metrics.score); // 0-100
console.log('Bottlenecks:', metrics.bottlenecks);
console.log('Recommendations:', metrics.recommendations);

// Detailed analysis
const validator = createPerformanceValidator(config);
const detailedMetrics = await validator.analyzePerformance();

// Monitor performance in real-time
validator.on('performance-warning', (warning) => {
  console.warn('Performance warning:', warning);
});

validator.startMonitoring();
```

**Performance Metrics:**
- **Overall Score**: 0-100 performance rating
- **Memory Impact**: Estimated memory usage impact
- **CPU Impact**: Estimated CPU usage impact
- **I/O Impact**: File system operation impact
- **Network Impact**: Network operation impact

**Common Recommendations:**
- Increase concurrency for better parallelization
- Enable caching to reduce redundant operations
- Optimize file patterns to reduce I/O
- Adjust memory limits for better performance
- Use more efficient optimization settings

## Backup and Restoration

The backup system provides automatic backups with integrity verification:

```typescript
import { createConfigBackup, backupConfig, restoreConfig } from './src/configBackup.js';

// Quick backup
const backup = await backupConfig('./enigma.config.json', {
  description: 'Before major changes',
  tags: ['manual', 'important']
});

// Restore from backup
const restoreResult = await restoreConfig('./enigma.config.json', backup.id);

// Advanced backup management
const backupManager = createConfigBackup('./enigma.config.json', undefined, {
  maxBackups: 10,
  autoCleanup: true
});

// Create backup with metadata
const backup = await backupManager.createBackup({
  description: 'Production deployment config',
  tags: ['production', 'deployment'],
  isAutomatic: false
});

// List backups with filters
const backups = backupManager.listBackups({
  tags: ['production'],
  isAutomatic: false,
  limit: 5
});

// Verify backup integrity
const verification = await backupManager.verifyBackup(backup.id);

if (!verification.isValid) {
  console.error('Backup corruption detected:', verification.errors);
}
```

**Backup Features:**
- Automatic backup creation before changes
- Versioned storage with metadata
- Integrity verification with checksums
- Retention policies and automatic cleanup
- Tag-based organization and filtering
- One-click restoration

## File Watching

The file watching system monitors configuration files for changes:

```typescript
import { createConfigWatcher } from './src/configWatcher.js';

const watcher = createConfigWatcher('./enigma.config.json', {
  validateOnChange: true,
  createBackupOnChange: true,
  debounceMs: 300
});

// Listen for events
watcher.on('change', (event) => {
  console.log('Configuration changed:', event.filepath);
});

watcher.on('validation', (event) => {
  if (!event.validation.isValid) {
    console.error('Invalid configuration:', event.validation.errors);
  }
});

watcher.on('backup', (event) => {
  console.log('Backup created:', event.backupId);
});

watcher.on('error', (error) => {
  console.error('Watcher error:', error);
});

// Start watching
await watcher.start();

// Stop watching
await watcher.stop();
```

**Watching Features:**
- Real-time file change detection
- Debounced validation to avoid excessive processing
- Automatic backup creation on changes
- Event-driven architecture for integration
- Graceful handling of temporary file states

## Error Handling

The validation system provides comprehensive error handling with detailed messages:

### Validation Errors

```typescript
// Schema validation errors
{
  isValid: false,
  errors: [
    "inputPaths must be an array",
    "concurrency must be a positive number",
    "outputPath cannot be the same as inputPath"
  ],
  suggestions: [
    "Change inputPaths to an array: [\"./src\"]",
    "Set concurrency to a number between 1 and 16",
    "Use a different directory for outputPath"
  ]
}

// Runtime validation errors
{
  isValid: false,
  errors: [
    "Input path '/nonexistent' does not exist",
    "Insufficient disk space for cache directory"
  ],
  warnings: [
    "High concurrency (32) may impact system performance",
    "Memory limit (64MB) is very low for this project size"
  ]
}
```

### Error Recovery

```typescript
try {
  const result = await configManager.loadConfig();
} catch (error) {
  if (error.code === 'CONFIG_VALIDATION_FAILED') {
    // Handle validation errors
    console.error('Configuration validation failed:', error.details);
    
    // Try loading with defaults
    const defaultsManager = createConfigDefaults('development');
    const fallbackConfig = defaultsManager.createConfigWithDefaults({});
    
  } else if (error.code === 'CONFIG_MIGRATION_FAILED') {
    // Handle migration errors
    console.error('Configuration migration failed:', error.details);
    
    // Restore from backup
    await configManager.restoreFromBackup(lastKnownGoodBackup);
  }
}
```

## Best Practices

### 1. Environment-Specific Configuration

Use environment-specific defaults and validation:

```typescript
// Development
const devManager = createEnhancedConfigManager('development', {
  enableWatching: true,
  enablePerformanceValidation: false, // Less strict in dev
  createBackupOnLoad: false
});

// Production
const prodManager = createEnhancedConfigManager('production', {
  enableWatching: false,
  enablePerformanceValidation: true, // Strict in production
  createBackupOnLoad: true
});
```

### 2. Gradual Migration

Enable features gradually to avoid disruption:

```typescript
const manager = createEnhancedConfigManager('production', {
  enableMigration: true,
  enableBackup: true,
  enablePerformanceValidation: false, // Enable later
  validateOnLoad: true
});
```

### 3. Monitoring and Alerting

Set up monitoring for configuration issues:

```typescript
const runtimeValidator = createRuntimeValidator(config);

runtimeValidator.on('constraint-violation', (event) => {
  // Send alert to monitoring system
  alerting.send({
    level: 'warning',
    message: `Configuration constraint violation: ${event.constraint}`,
    value: event.value,
    threshold: event.threshold
  });
});
```

### 4. Backup Strategy

Implement a comprehensive backup strategy:

```typescript
const backupManager = createConfigBackup('./enigma.config.json', undefined, {
  maxBackups: 20,
  autoCleanup: true
});

// Create tagged backups for important changes
await backupManager.createBackup({
  description: 'Before production deployment',
  tags: ['production', 'deployment', 'critical']
});

// Regular automated backups
setInterval(async () => {
  await backupManager.createBackup({
    description: 'Scheduled backup',
    tags: ['automated'],
    isAutomatic: true
  });
}, 24 * 60 * 60 * 1000); // Daily
```

### 5. Performance Optimization

Regularly analyze and optimize configuration performance:

```typescript
const performanceValidator = createPerformanceValidator(config);
const metrics = await performanceValidator.analyzePerformance();

if (metrics.score < 70) {
  console.warn('Configuration performance is below optimal');
  
  // Apply recommendations
  for (const recommendation of metrics.recommendations) {
    if (recommendation.impact === 'high' && recommendation.effort === 'low') {
      console.log('Consider applying:', recommendation.title);
      console.log('Description:', recommendation.description);
    }
  }
}
```

## Troubleshooting

### Common Issues

#### 1. Validation Failures

**Problem**: Configuration validation fails with unclear errors.

**Solution**:
```typescript
const validator = createConfigValidator();
const result = await validator.validateFile('./enigma.config.json');

// Check detailed errors and suggestions
console.log('Errors:', result.errors);
console.log('Suggestions:', result.suggestions);
console.log('Field errors:', result.fieldErrors);
```

#### 2. Migration Issues

**Problem**: Configuration migration fails or produces unexpected results.

**Solution**:
```typescript
// Check migration status
const migration = createConfigMigration('./enigma.config.json');
const status = migration.getMigrationStatus();

// Manual migration with backup
const result = await migration.migrate({
  autoMigrate: false, // Manual approval
  createBackup: true,
  dryRun: true // Test first
});
```

#### 3. Performance Issues

**Problem**: Configuration validation is slow or impacts performance.

**Solution**:
```typescript
// Disable expensive validations in development
const manager = createEnhancedConfigManager('development', {
  enablePerformanceValidation: false,
  enableWatching: false // Disable if not needed
});

// Use caching for repeated validations
const validator = createConfigValidator({
  enableCaching: true,
  cacheSize: 100
});
```

#### 4. File Watching Issues

**Problem**: File watcher not detecting changes or causing high CPU usage.

**Solution**:
```typescript
const watcher = createConfigWatcher('./enigma.config.json', {
  debounceMs: 1000, // Increase debounce
  validateOnChange: false, // Disable if not needed
  ignorePatterns: ['**/.git/**', '**/node_modules/**'] // Ignore unnecessary files
});
```

#### 5. Backup Corruption

**Problem**: Configuration backups are corrupted or invalid.

**Solution**:
```typescript
const backupManager = createConfigBackup('./enigma.config.json');

// Verify all backups
const backups = backupManager.listBackups();
for (const backup of backups) {
  const verification = await backupManager.verifyBackup(backup.id);
  if (!verification.isValid) {
    console.error(`Backup ${backup.id} is corrupted:`, verification.errors);
    // Remove corrupted backup
    await backupManager.removeBackup(backup.id);
  }
}
```

### Debug Mode

Enable debug logging for detailed troubleshooting:

```typescript
// Set environment variable
process.env.DEBUG = 'enigma:config*';

// Or enable programmatically
import { createLogger } from './src/utils/logger.js';
const logger = createLogger('config');
logger.level = 'debug';
```

### Support

For additional support:

1. Check the [main documentation](../README.md)
2. Review [configuration examples](../examples/)
3. File an issue on the [GitHub repository](https://github.com/your-org/tw-enigma-core)
4. Join the community discussions

---

This configuration validation system provides robust, production-ready validation and safety features for Tailwind Enigma Core. By following this guide and best practices, you can ensure reliable and optimized configuration management for your projects. 