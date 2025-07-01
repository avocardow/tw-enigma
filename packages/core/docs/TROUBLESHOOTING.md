# Troubleshooting Guide

A comprehensive guide to diagnosing and resolving common issues with TW-Enigma's dry run system.

## Table of Contents

- [Quick Diagnosis](#quick-diagnosis)
- [Common Issues](#common-issues)
- [Performance Problems](#performance-problems)
- [Configuration Issues](#configuration-issues)
- [Output and Reporting Problems](#output-and-reporting-problems)
- [Interactive CLI Issues](#interactive-cli-issues)
- [Integration Problems](#integration-problems)
- [Advanced Debugging](#advanced-debugging)
- [Getting Help](#getting-help)

## Quick Diagnosis

### System Health Check

```typescript
import { dryRunManager } from '@tw-enigma/core';

async function healthCheck() {
  const status = await dryRunManager.getSystemStatus();
  console.log('System Status:', status);

  if (!status.healthy) {
    console.log('Issues detected:', status.issues);
  }
}
```

### Enable Verbose Logging

```bash
# Enable detailed logging
export DEBUG=tw-enigma:*
export LOG_LEVEL=verbose

# Run with maximum verbosity
npx tw-enigma --dry-run --verbose --debug
```

### Quick Fixes Checklist

- [ ] Check Node.js version (≥16.0.0 required)
- [ ] Verify all dependencies are installed
- [ ] Ensure input files exist and are readable
- [ ] Check available disk space for temporary files
- [ ] Verify write permissions for output directory
- [ ] Clear temporary files: `rm -rf .tw-enigma/temp`

## Common Issues

### 1. Dry Run Fails to Start

**Symptoms:**

- Command exits immediately
- "Cannot initialize dry run" error
- No output generated

**Causes and Solutions:**

#### Missing Dependencies

```bash
# Check if all dependencies are installed
npm ls @tw-enigma/core

# Reinstall if needed
npm install @tw-enigma/core@latest
```

#### Permission Issues

```bash
# Check file permissions
ls -la input-files/

# Fix permissions
chmod 644 input-files/*
chmod 755 input-directory/
```

#### Invalid Configuration

```typescript
// Validate configuration
import { configValidator } from '@tw-enigma/core';

const isValid = await configValidator.validate('tw-enigma.config.js');
if (!isValid) {
  console.log('Configuration errors:', configValidator.getErrors());
}
```

### 2. File System Interceptor Not Working

**Symptoms:**

- Files are actually modified during dry run
- Changes persist after dry run completion
- No interception logs in debug output

**Solutions:**

#### Check Interceptor Initialization

```typescript
import { fileSystemInterceptor } from '@tw-enigma/core';

// Verify interceptor is active
console.log('Interceptor active:', fileSystemInterceptor.isActive());

// Manual activation if needed
await fileSystemInterceptor.activate();
```

#### Verify Hook Installation

```typescript
// Check if Node.js hooks are properly installed
const hooks = process.binding('fs');
console.log('FS hooks:', Object.keys(hooks));
```

#### Reset Interceptor State

```typescript
// Reset if interceptor is stuck
await fileSystemInterceptor.reset();
await fileSystemInterceptor.activate();
```

### 3. Memory Issues During Large Operations

**Symptoms:**

- "Out of memory" errors
- Slow performance on large codebases
- Process crashes unexpectedly

**Solutions:**

#### Increase Node.js Memory Limit

```bash
# Increase heap size
node --max-old-space-size=8192 node_modules/.bin/tw-enigma

# Set environment variable
export NODE_OPTIONS="--max-old-space-size=8192"
```

#### Use Streaming Mode

```typescript
import { dryRunManager } from '@tw-enigma/core';

// Enable streaming for large files
await dryRunManager.configure({
  streaming: true,
  chunkSize: 1024 * 1024, // 1MB chunks
  maxConcurrency: 4,
});
```

#### Optimize Processing

```typescript
// Reduce parallel processing
await dryRunManager.configure({
  maxConcurrency: 2,
  batchSize: 10,
  enableGarbageCollection: true,
});
```

### 4. Inaccurate Simulation Results

**Symptoms:**

- Dry run results don't match actual execution
- Missing files in simulation
- Incorrect size calculations

**Solutions:**

#### Verify File Discovery

```typescript
import { fileDiscovery } from '@tw-enigma/core';

// Check discovered files
const files = await fileDiscovery.scanDirectory('./src');
console.log('Discovered files:', files.length);
console.log(
  'Patterns matched:',
  files.map((f) => f.pattern)
);
```

#### Update Pattern Matching

```typescript
// Ensure patterns are comprehensive
await dryRunManager.configure({
  patterns: {
    include: ['**/*.{js,jsx,ts,tsx,vue,svelte}'],
    exclude: ['node_modules/**', '.git/**'],
    followSymlinks: false,
  },
});
```

#### Validate Dependencies

```typescript
// Check dependency resolution
const deps = await dependencyAnalyzer.analyze('./src');
console.log('Dependencies:', deps);
```

## Performance Problems

### 1. Slow Execution

**Diagnosis:**

```typescript
import { performanceAnalyzer } from '@tw-enigma/core';

// Profile execution
const profile = await performanceAnalyzer.profile(async () => {
  await dryRunManager.execute();
});

console.log('Performance bottlenecks:', profile.bottlenecks);
```

**Common Bottlenecks:**

#### I/O Bound Operations

```typescript
// Optimize file system operations
await dryRunManager.configure({
  caching: {
    enabled: true,
    strategy: 'memory',
    maxSize: '500MB',
  },
  parallelism: {
    fileReading: 8,
    processing: 4,
  },
});
```

#### CPU Intensive Tasks

```typescript
// Use worker threads for heavy processing
await dryRunManager.configure({
  workers: {
    enabled: true,
    count: require('os').cpus().length - 1,
    taskThreshold: 100, // files
  },
});
```

#### Memory Leaks

```typescript
// Enable memory monitoring
await dryRunManager.configure({
  monitoring: {
    memory: true,
    interval: 5000, // 5 seconds
    threshold: 0.9, // 90% usage warning
  },
});
```

### 2. High Memory Usage

**Solutions:**

#### Streaming Processing

```typescript
// Process files in streams
await dryRunManager.configure({
  streaming: {
    enabled: true,
    bufferSize: 64 * 1024, // 64KB
    highWaterMark: 1024 * 1024, // 1MB
  },
});
```

#### Garbage Collection Tuning

```bash
# Enable aggressive GC
node --expose-gc --optimize-for-size node_modules/.bin/tw-enigma

# Monitor GC
node --trace-gc node_modules/.bin/tw-enigma
```

#### Memory Pooling

```typescript
// Use object pooling for frequent allocations
await dryRunManager.configure({
  pooling: {
    enabled: true,
    maxPoolSize: 1000,
    preAllocate: 100,
  },
});
```

## Configuration Issues

### 1. Configuration Not Loading

**Symptoms:**

- Default settings always used
- Custom configuration ignored
- "Config file not found" warnings

**Solutions:**

#### Check Configuration Path

```typescript
import { configManager } from '@tw-enigma/core';

// Verify config file location
const configPath = configManager.getConfigPath();
console.log('Config path:', configPath);
console.log('Config exists:', fs.existsSync(configPath));
```

#### Validate Configuration Format

```javascript
// tw-enigma.config.js
module.exports = {
  // Ensure proper structure
  dryRun: {
    enabled: true,
    outputPath: './dry-run-results',
  },
  // Common mistake: missing comma
  patterns: ['**/*.js'],
};
```

#### Debug Configuration Loading

```typescript
// Enable config debugging
process.env.DEBUG = 'tw-enigma:config';

// Load with error reporting
try {
  const config = await configManager.load();
  console.log('Loaded config:', config);
} catch (error) {
  console.error('Config error:', error.message);
}
```

### 2. Environment Variables Not Working

**Solutions:**

#### Check Variable Names

```bash
# Correct environment variables
export TW_ENIGMA_DRY_RUN=true
export TW_ENIGMA_OUTPUT_PATH="./results"
export TW_ENIGMA_LOG_LEVEL="debug"

# Verify they're set
env | grep TW_ENIGMA
```

#### Priority Order

```typescript
// Configuration precedence (highest to lowest):
// 1. Command line arguments
// 2. Environment variables
// 3. Configuration file
// 4. Default values

// Check effective configuration
const effectiveConfig = configManager.getEffectiveConfig();
console.log('Final config:', effectiveConfig);
```

## Output and Reporting Problems

### 1. No Reports Generated

**Symptoms:**

- Empty output directory
- Missing report files
- No console output

**Solutions:**

#### Check Output Configuration

```typescript
import { outputManager } from '@tw-enigma/core';

// Verify output settings
const config = await outputManager.getConfiguration();
console.log('Output config:', config);

// Test output directory
const testResult = await outputManager.testOutput();
console.log('Output test:', testResult);
```

#### Verify Permissions

```bash
# Check output directory permissions
ls -la ./dry-run-results/
mkdir -p ./dry-run-results/
chmod 755 ./dry-run-results/
```

#### Enable Report Generation

```typescript
// Ensure reporting is enabled
await dryRunManager.configure({
  reporting: {
    enabled: true,
    formats: ['json', 'html', 'markdown'],
    includeDetails: true,
  },
});
```

### 2. Corrupted or Incomplete Reports

**Solutions:**

#### Validate Report Data

```typescript
import { reportValidator } from '@tw-enigma/core';

// Validate generated reports
const isValid = await reportValidator.validate('./dry-run-results/report.json');
if (!isValid) {
  console.log('Validation errors:', reportValidator.getErrors());
}
```

#### Check Disk Space

```bash
# Ensure adequate disk space
df -h .
du -sh ./dry-run-results/
```

#### Regenerate Reports

```typescript
// Force report regeneration
await reportGenerator.regenerate({
  force: true,
  cleanPrevious: true,
});
```

### 3. Visual Diff Not Displaying

**Solutions:**

#### Check Diff Engine

```typescript
import { visualDiff } from '@tw-enigma/core';

// Test diff functionality
const testDiff = await visualDiff.test();
console.log('Diff engine status:', testDiff);
```

#### Verify Dependencies

```bash
# Check for required dependencies
npm ls diff
npm ls chalk
npm ls cli-highlight
```

#### Alternative Diff Formats

```typescript
// Try different diff formats
await visualDiff.configure({
  format: 'side-by-side', // or 'unified', 'context'
  colorize: true,
  showWhitespace: true,
});
```

## Interactive CLI Issues

### 1. CLI Not Responding

**Symptoms:**

- Prompts don't appear
- Input not accepted
- CLI hangs indefinitely

**Solutions:**

#### Check TTY Support

```typescript
// Verify TTY availability
console.log('Is TTY:', process.stdin.isTTY);
console.log('Terminal columns:', process.stdout.columns);
```

#### Test Input/Output

```bash
# Test basic I/O
echo "test" | npx tw-enigma --interactive

# Force TTY mode
script -c "npx tw-enigma --interactive" /dev/null
```

#### Reset Terminal State

```bash
# Reset terminal
reset
stty sane

# Clear screen
clear
```

### 2. Broken Display or Formatting

**Solutions:**

#### Check Terminal Capabilities

```typescript
// Detect terminal features
const terminalInfo = {
  colorSupport: process.stdout.hasColors(),
  columns: process.stdout.columns,
  rows: process.stdout.rows,
};
console.log('Terminal:', terminalInfo);
```

#### Disable Advanced Features

```bash
# Run without colors/formatting
NO_COLOR=1 npx tw-enigma --interactive

# Simple mode
npx tw-enigma --interactive --simple
```

#### Update Terminal Emulator

```bash
# Test with different terminals
# Try: Terminal.app, iTerm2, gnome-terminal, etc.
```

## Integration Problems

### 1. Build Tool Integration Failures

**Webpack Issues:**

```javascript
// webpack.config.js
const TwEnigmaPlugin = require('@tw-enigma/webpack-plugin');

module.exports = {
  plugins: [
    new TwEnigmaPlugin({
      // Ensure dry run is properly configured
      dryRun: process.env.NODE_ENV === 'development',
      debug: true,
    }),
  ],
};
```

**Vite Issues:**

```javascript
// vite.config.js
import { defineConfig } from 'vite';
import twEnigma from '@tw-enigma/vite-plugin';

export default defineConfig({
  plugins: [
    twEnigma({
      // Enable verbose logging for debugging
      verbose: true,
      dryRun: true,
    }),
  ],
});
```

### 2. CI/CD Pipeline Failures

**GitHub Actions:**

```yaml
# .github/workflows/enigma-test.yml
- name: Debug Dry Run
  run: |
    npm run tw-enigma:dry-run -- --verbose --debug
    ls -la ./dry-run-results/
    cat ./dry-run-results/report.json
```

**Jenkins:**

```groovy
// Jenkinsfile
stage('TW-Enigma Dry Run') {
  steps {
    script {
      // Capture output for debugging
      sh 'npm run tw-enigma:dry-run 2>&1 | tee enigma-output.log'
      archiveArtifacts 'enigma-output.log'
    }
  }
}
```

## Advanced Debugging

### 1. Enable Comprehensive Logging

```typescript
// Enable all debug channels
process.env.DEBUG = 'tw-enigma:*';

// Specific debugging
process.env.DEBUG = 'tw-enigma:dry-run,tw-enigma:fs,tw-enigma:performance';

// Log to file
process.env.DEBUG_FILE = './debug.log';
```

### 2. Memory and Performance Profiling

```bash
# Generate heap snapshot
node --inspect node_modules/.bin/tw-enigma --dry-run

# CPU profiling
node --prof node_modules/.bin/tw-enigma --dry-run
node --prof-process isolate-*.log > cpu-profile.txt
```

### 3. System Tracing

```bash
# Trace system calls (Linux/macOS)
strace -e trace=file npx tw-enigma --dry-run 2>&1 | grep -E "(open|read|write)"

# macOS alternative
dtruss -f npx tw-enigma --dry-run
```

### 4. Custom Debug Hooks

```typescript
// Add custom debugging
import { dryRunManager } from '@tw-enigma/core';

dryRunManager.on('file:process:start', (file) => {
  console.log('Processing:', file.path);
});

dryRunManager.on('file:process:end', (file, result) => {
  console.log('Completed:', file.path, 'Changes:', result.changes.length);
});

dryRunManager.on('error', (error) => {
  console.error('Error details:', {
    message: error.message,
    stack: error.stack,
    context: error.context,
  });
});
```

### 5. State Inspection

```typescript
// Inspect internal state
const internalState = dryRunManager.getInternalState();
console.log('Interceptor state:', internalState.interceptor);
console.log('Processing queue:', internalState.queue);
console.log('Memory usage:', internalState.memory);
```

## Getting Help

### 1. Collect Diagnostic Information

```bash
# Generate diagnostic report
npx tw-enigma --dry-run --diagnostic > diagnostic-report.txt
```

```typescript
// Programmatic diagnostic collection
import { diagnosticCollector } from '@tw-enigma/core';

const report = await diagnosticCollector.generateReport({
  includeSystemInfo: true,
  includeConfiguration: true,
  includeRecentLogs: true,
  sanitize: true, // Remove sensitive information
});

console.log('Diagnostic report:', report);
```

### 2. Reproduce Issues

```bash
# Create minimal reproduction
mkdir tw-enigma-debug
cd tw-enigma-debug
npm init -y
npm install @tw-enigma/core

# Create minimal test case
echo "console.log('test');" > test.js
npx tw-enigma --dry-run test.js --verbose
```

### 3. Report Issues

When reporting issues, include:

1. **Environment Information:**

   - Node.js version: `node --version`
   - npm version: `npm --version`
   - Operating system: `uname -a` (Linux/macOS) or `ver` (Windows)
   - TW-Enigma version: `npm ls @tw-enigma/core`

2. **Configuration:**

   - Configuration file content
   - Environment variables
   - Command line arguments used

3. **Error Details:**

   - Complete error messages
   - Stack traces
   - Debug logs
   - Steps to reproduce

4. **Expected vs Actual Behavior:**
   - What you expected to happen
   - What actually happened
   - Any workarounds found

### 4. Community Resources

- **GitHub Issues:** Report bugs and request features
- **Discussions:** Ask questions and share solutions
- **Documentation:** Check latest docs for updates
- **Examples:** Review example projects and configurations

### 5. Professional Support

For enterprise users requiring dedicated support:

- Priority issue resolution
- Custom integration assistance
- Performance optimization consulting
- Training and onboarding

---

## Emergency Recovery

### 1. System Reset

```bash
# Complete reset
rm -rf node_modules package-lock.json
rm -rf .tw-enigma/
npm cache clean --force
npm install
```

### 2. Safe Mode Operation

```bash
# Run in safe mode (minimal features)
npx tw-enigma --dry-run --safe-mode --no-cache --no-workers
```

### 3. Backup and Recovery

```typescript
// Create configuration backup
import { configManager } from '@tw-enigma/core';

await configManager.backup('./config-backup.json');

// Restore from backup
await configManager.restore('./config-backup.json');
```

### 4. Data Recovery

```bash
# Recover from interrupted dry run
npx tw-enigma --recover --session-id=<last-session-id>

# List recoverable sessions
npx tw-enigma --list-sessions
```

---

_This troubleshooting guide covers the most common issues and their solutions. For additional help, please refer to the [GitHub Issues](https://github.com/tw-enigma/tw-enigma/issues) or contact support._
