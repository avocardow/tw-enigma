# CLI Integration Tests

This directory contains comprehensive integration tests for the `enigma` command, ensuring it works correctly across various scenarios and environments.

## Test Structure

### Test Files

- **`enigma-integration.test.ts`** - Core integration tests covering basic optimization scenarios
- **`enigma-dry-run-verbose.test.ts`** - Specialized tests for dry-run and verbose modes
- **`enigma-scramble-errors.test.ts`** - Tests for scramble functionality and error handling
- **`test-config.ts`** - Shared test configuration and utilities

### Test Fixtures

- **`fixtures/enigma-integration/basic-project/`** - Simple project with common Tailwind patterns
- **`fixtures/enigma-integration/scramble-project/`** - Project designed for scramble effects testing

## Running Tests

### Individual Test Suites

```bash
# Run all integration tests
npm run test:integration

# Run dry-run and verbose mode tests
npm run test:dry-run

# Run scramble and error scenario tests
npm run test:scramble

# Run all end-to-end tests
npm run test:e2e

# Run with coverage
npm run test:coverage
```

### Development Testing

```bash
# Watch mode for development
npm run test:watch

# Run specific test file
npx vitest run tests/enigma-integration.test.ts

# Run specific test pattern
npx vitest run --testNamePattern="dry run"

# Debug mode with verbose output
DEBUG_CLI=true npm run test:integration
```

### CI Testing

```bash
# CI mode with full reporting
npm run test:ci

# Quick validation
npm run test:unit
```

## Test Categories

### 1. Basic Optimization Scenarios

Tests core functionality:
- Default settings optimization
- Input/output directory handling
- Configuration file loading
- Minification and source maps
- File type filtering
- Concurrent processing

### 2. Dry Run Mode

Verifies dry-run safety:
- No file modifications
- No output file creation
- Complete workflow analysis
- Configuration processing
- Pattern detection

### 3. Verbose and Logging Modes

Tests output verbosity:
- Detailed logging in verbose mode
- Trace-level output in very verbose mode
- Minimized output in quiet mode
- Debug information display
- Log level configuration

### 4. Scramble Integration

Tests scramble functionality:
- Package detection
- Configuration options
- Graceful fallback when unavailable
- Error handling
- Debug mode

### 5. Error Handling

Tests robustness:
- Missing configuration files
- Invalid input directories
- Permission issues
- Parameter validation
- Resource limits
- Timeout scenarios

## Test Environment

### Environment Variables

The tests use these environment variables:

- `CI=true` - Enables CI mode with extended timeouts
- `CLI_TEST_MODE=true` - Enables test-specific behavior
- `DEBUG_CLI=true` - Enables debug output
- `NODE_ENV=test` - Sets test environment
- `FORCE_COLOR=0` - Disables colors for consistent output

### Timeouts

- **Unit tests**: 10 seconds
- **Integration tests**: 30 seconds (60s in CI)
- **E2E tests**: 60 seconds (120s in CI)

### File System

Tests use temporary directories:
- `test-temp/` - Temporary working directories
- Automatic cleanup after tests
- Preservation of recent runs for debugging

## Test Fixtures

### Basic Project

Contains:
- HTML files with repeated Tailwind patterns
- JSX components with utility classes
- Configuration file
- Package.json with dependencies

Expected patterns:
- `bg-white rounded-lg shadow-md p-6`
- `bg-blue-500 hover:bg-blue-600 text-white font-medium py-2 px-4 rounded`
- `flex items-center justify-between`

### Scramble Project

Contains:
- HTML with scramble-ready patterns
- Complex class combinations
- Gradient and animation classes

Expected patterns:
- `fixed top-0 left-0 right-0 z-50`
- `bg-gradient-to-br from-purple-400 to-blue-400`
- `bg-white rounded-xl shadow-lg hover:shadow-xl`

## Assertions and Validation

### Output Validation

Tests verify expected console output:
- Success messages
- Progress indicators
- Error messages
- Configuration details
- File discovery results

### File System Validation

Tests check:
- File modification times
- Content checksums
- Directory creation
- Permission handling

### Exit Code Validation

Tests verify:
- Success (exit code 0)
- Expected failures (exit code 1)
- Graceful error handling
- Timeout handling

## Debugging Tests

### Local Debugging

```bash
# Run with debug output
DEBUG_CLI=true npm run test:integration

# Run single test with verbose output
npx vitest run --testNamePattern="basic optimization" --reporter=verbose

# Keep test artifacts
PRESERVE_TEST_TEMP=true npm run test:e2e
```

### CI Debugging

```bash
# Simulate CI environment
CI=true npm run test:ci

# Test with different Node versions
nvm use 18 && npm test
nvm use 20 && npm test
```

### Test Artifacts

When tests fail, check:
- `test-temp/` for temporary files
- `test-results.json` for detailed results
- `coverage/` for coverage reports
- Console output for error messages

## Adding New Tests

### Test Structure

```typescript
import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { setupTestProject, executeEnigmaCommand } from './test-utils';

describe('New Test Suite', () => {
  let testProject: TestProject;

  afterEach(async () => {
    if (testProject) {
      await testProject.cleanup();
    }
  });

  test('should handle new scenario', async () => {
    testProject = await setupTestProject('basic-project');
    
    const result = executeEnigmaCommand(['--new-option'], testProject.workingDir);
    
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('expected output');
  });
});
```

### Best Practices

1. **Use fixtures** - Always test against realistic project structures
2. **Clean up** - Ensure temporary files are removed
3. **Validate thoroughly** - Check exit codes, output, and file system state
4. **Handle timeouts** - Use appropriate timeouts for different test types
5. **Test error cases** - Verify graceful error handling
6. **CI compatibility** - Ensure tests work in CI environments

## Performance Considerations

### Test Speed

- Use dry-run mode when file modifications aren't needed
- Limit file processing with `--max-files`
- Use appropriate timeouts
- Clean up efficiently

### Resource Usage

- Monitor memory usage in CI
- Limit concurrent processes
- Use temporary directories efficiently
- Clean up after each test

### Reliability

- Handle platform differences
- Use absolute paths
- Validate environment setup
- Provide clear error messages

## CI Integration

The tests are integrated with GitHub Actions via `.github/workflows/cli-integration-tests.yml`:

- **Matrix testing** across Node.js versions and operating systems
- **Parallel execution** of different test suites
- **Coverage reporting** with Codecov integration
- **Artifact collection** for debugging failed runs
- **Performance monitoring** with timing information

See the workflow file for detailed CI configuration and customization options.