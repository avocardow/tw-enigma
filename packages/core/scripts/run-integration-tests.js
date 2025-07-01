#!/usr/bin/env node
/**
 * Integration Test Runner
 * CLI script for running template literal integration tests
 */

const { spawn } = require('child_process');
const fs = require('fs').promises;
const path = require('path');

async function main() {
  const args = process.argv.slice(2);
  
  // Parse command line arguments
  const config = {
    watch: false,
    coverage: false,
    verbose: false,
    timeout: 60000,
    filter: '',
    reporter: 'default',
    outputDir: './test-results',
    bail: false,
    parallel: true,
    categories: 'all', // all, standard, edge, error
  };

  let i = 0;
  while (i < args.length) {
    const arg = args[i];
    
    switch (arg) {
      case '--help':
      case '-h':
        printHelp();
        process.exit(0);
        break;
        
      case '--watch':
      case '-w':
        config.watch = true;
        break;
        
      case '--coverage':
      case '-c':
        config.coverage = true;
        break;
        
      case '--verbose':
      case '-v':
        config.verbose = true;
        break;
        
      case '--timeout':
        config.timeout = parseInt(args[++i], 10);
        break;
        
      case '--filter':
      case '-f':
        config.filter = args[++i];
        break;
        
      case '--reporter':
      case '-r':
        config.reporter = args[++i];
        break;
        
      case '--output-dir':
      case '-o':
        config.outputDir = args[++i];
        break;
        
      case '--bail':
      case '-b':
        config.bail = true;
        break;
        
      case '--no-parallel':
        config.parallel = false;
        break;
        
      case '--categories':
        config.categories = args[++i];
        break;
        
      case '--quick':
        config.timeout = 30000;
        config.categories = 'standard';
        config.bail = true;
        break;
        
      case '--full':
        config.timeout = 120000;
        config.categories = 'all';
        config.coverage = true;
        break;
        
      default:
        console.error(`Unknown argument: ${arg}`);
        printHelp();
        process.exit(1);
    }
    
    i++;
  }

  console.log('🧪 Starting TW-Enigma Template Literal Integration Tests');
  console.log('Configuration:', JSON.stringify(config, null, 2));

  try {
    // Ensure output directory exists
    await ensureOutputDirectory(config.outputDir);

    // Run the tests
    await runIntegrationTests(config);
    
  } catch (error) {
    console.error('❌ Integration tests failed:', error.message);
    process.exit(1);
  }
}

async function ensureOutputDirectory(outputDir) {
  try {
    await fs.access(outputDir);
  } catch {
    await fs.mkdir(outputDir, { recursive: true });
  }
}

async function runIntegrationTests(config) {
  return new Promise((resolve, reject) => {
    // Build vitest command
    const vitestArgs = [
      'vitest',
      'packages/core/tests/processors/templateLiteralIntegration.test.ts'
    ];

    // Add vitest flags based on config
    if (!config.watch) {
      vitestArgs.push('run');
    }

    if (config.coverage) {
      vitestArgs.push('--coverage');
    }

    if (config.verbose) {
      vitestArgs.push('--reporter=verbose');
    } else if (config.reporter !== 'default') {
      vitestArgs.push(`--reporter=${config.reporter}`);
    }

    if (config.bail) {
      vitestArgs.push('--bail=1');
    }

    if (!config.parallel) {
      vitestArgs.push('--no-threads');
    }

    if (config.filter) {
      vitestArgs.push(`--testNamePattern=${config.filter}`);
    }

    vitestArgs.push(`--testTimeout=${config.timeout}`);

    console.log(`\n🏃 Running command: npx ${vitestArgs.join(' ')}\n`);

    // Spawn vitest process
    const vitestProcess = spawn('npx', vitestArgs, {
      stdio: 'inherit',
      env: {
        ...process.env,
        // Set environment variables for test configuration
        INTEGRATION_TEST_CATEGORIES: config.categories,
        INTEGRATION_TEST_TIMEOUT: config.timeout.toString(),
        INTEGRATION_TEST_VERBOSE: config.verbose.toString(),
        INTEGRATION_TEST_OUTPUT_DIR: config.outputDir,
      }
    });

    vitestProcess.on('close', (code) => {
      if (code === 0) {
        console.log('\n✅ Integration tests passed successfully');
        resolve();
      } else {
        console.log(`\n❌ Integration tests failed with exit code ${code}`);
        reject(new Error(`Tests failed with exit code ${code}`));
      }
    });

    vitestProcess.on('error', (error) => {
      console.error('\n💥 Failed to start test process:', error);
      reject(error);
    });

    // Handle process termination
    process.on('SIGINT', () => {
      console.log('\n🛑 Terminating tests...');
      vitestProcess.kill('SIGINT');
    });

    process.on('SIGTERM', () => {
      console.log('\n🛑 Terminating tests...');
      vitestProcess.kill('SIGTERM');
    });
  });
}

function printHelp() {
  console.log(`
TW-Enigma Template Literal Integration Test Runner

USAGE:
  node run-integration-tests.js [OPTIONS]

OPTIONS:
  --help, -h              Show this help message
  --watch, -w             Run tests in watch mode
  --coverage, -c          Generate test coverage report
  --verbose, -v           Verbose test output
  --timeout MILLISECONDS  Test timeout (default: 60000)
  --filter PATTERN        Filter tests by name pattern
  --reporter REPORTER     Test reporter (default, verbose, json, junit)
  --output-dir DIR        Output directory for results (default: ./test-results)
  --bail, -b              Stop on first test failure
  --no-parallel           Disable parallel test execution
  --categories CATEGORY   Test categories to run (all, standard, edge, error)

PRESETS:
  --quick                 Quick test run (standard tests only, 30s timeout)
  --full                  Full test suite with coverage (all tests, 120s timeout)

EXAMPLES:
  # Run all integration tests
  node run-integration-tests.js
  
  # Quick validation run
  node run-integration-tests.js --quick
  
  # Full test suite with coverage
  node run-integration-tests.js --full
  
  # Watch mode for development
  node run-integration-tests.js --watch --verbose
  
  # Run only error handling tests
  node run-integration-tests.js --categories=error --verbose
  
  # Run with custom timeout and filter
  node run-integration-tests.js --timeout=90000 --filter="end-to-end"

ENVIRONMENT VARIABLES:
  CI=true                 Automatically adjusts configuration for CI
  DEBUG=true              Enable debug output

EXIT CODES:
  0                       All tests passed
  1                       Tests failed or error occurred
`);
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  process.exit(1);
});

// Run main function
if (require.main === module) {
  main().catch(error => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });
}

module.exports = { main, runIntegrationTests };