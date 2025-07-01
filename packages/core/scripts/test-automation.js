#!/usr/bin/env node

/**
 * Test Automation Script for TW-Enigma Detection System
 * 
 * Automates comprehensive testing including unit tests, integration tests,
 * performance benchmarks, and coverage reporting
 */

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// Configuration
const config = {
  testTypes: ['unit', 'integration', 'performance'],
  coverageThreshold: 80,
  maxTestTime: 300000, // 5 minutes
  retryAttempts: 2,
  parallelism: true,
};

// Color output utilities
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title) {
  log(`\n${'='.repeat(60)}`, 'cyan');
  log(`  ${title}`, 'bright');
  log(`${'='.repeat(60)}`, 'cyan');
}

function logStep(step) {
  log(`\n▶ ${step}`, 'blue');
}

function logSuccess(message) {
  log(`✅ ${message}`, 'green');
}

function logError(message) {
  log(`❌ ${message}`, 'red');
}

function logWarning(message) {
  log(`⚠️  ${message}`, 'yellow');
}

// Test execution functions
async function runUnitTests() {
  logStep('Running unit tests...');
  
  try {
    execSync('npm run test:unit', { 
      stdio: 'inherit',
      timeout: config.maxTestTime,
    });
    logSuccess('Unit tests completed successfully');
    return true;
  } catch (error) {
    logError(`Unit tests failed: ${error.message}`);
    return false;
  }
}

async function runIntegrationTests() {
  logStep('Running integration tests...');
  
  try {
    execSync('npx jest --config jest.config.integration.js', { 
      stdio: 'inherit',
      timeout: config.maxTestTime,
    });
    logSuccess('Integration tests completed successfully');
    return true;
  } catch (error) {
    logError(`Integration tests failed: ${error.message}`);
    return false;
  }
}

async function runPerformanceTests() {
  logStep('Running performance benchmarks...');
  
  try {
    // Create a simple performance test runner
    const performanceTest = `
      const { performance } = require('perf_hooks');
      const { FrameworkDetector } = require('./dist/frameworkDetector');
      
      async function benchmark() {
        const detector = new FrameworkDetector();
        const iterations = 10;
        const times = [];
        
        for (let i = 0; i < iterations; i++) {
          const start = performance.now();
          await detector.detect('.');
          const end = performance.now();
          times.push(end - start);
        }
        
        const avg = times.reduce((a, b) => a + b, 0) / times.length;
        const min = Math.min(...times);
        const max = Math.max(...times);
        
        console.log(\`Performance Results:\`);
        console.log(\`  Average: \${avg.toFixed(2)}ms\`);
        console.log(\`  Min: \${min.toFixed(2)}ms\`);
        console.log(\`  Max: \${max.toFixed(2)}ms\`);
        
        if (avg > 5000) {
          console.error('Performance degradation detected!');
          process.exit(1);
        }
      }
      
      benchmark().catch(console.error);
    `;
    
    fs.writeFileSync('temp-perf-test.js', performanceTest);
    execSync('node temp-perf-test.js', { stdio: 'inherit' });
    fs.unlinkSync('temp-perf-test.js');
    
    logSuccess('Performance tests completed successfully');
    return true;
  } catch (error) {
    logError(`Performance tests failed: ${error.message}`);
    return false;
  }
}

async function generateCoverageReport() {
  logStep('Generating coverage report...');
  
  try {
    execSync('npx jest --coverage --coverageReporters=text-summary,html,lcov', { 
      stdio: 'inherit' 
    });
    
    // Check coverage threshold
    const coveragePath = './coverage/lcov-report/index.html';
    if (fs.existsSync(coveragePath)) {
      logSuccess('Coverage report generated');
      log(`View detailed report at: file://${path.resolve(coveragePath)}`, 'blue');
    }
    
    return true;
  } catch (error) {
    logError(`Coverage generation failed: ${error.message}`);
    return false;
  }
}

async function validateTestStructure() {
  logStep('Validating test structure...');
  
  const requiredFiles = [
    'tests/detectors/frameworkDetector.test.ts',
    'tests/detectors/ssrDetector.test.ts',
    'tests/detectors/cssInJsDetector.test.ts',
    'tests/integration/frameworkIntegration.test.ts',
    'tests/integration/ssrCompatibility.test.ts',
    'tests/setup/matchers.ts',
    'tests/setup/integration.setup.ts',
  ];
  
  const missingFiles = requiredFiles.filter(file => !fs.existsSync(file));
  
  if (missingFiles.length > 0) {
    logWarning(`Missing test files: ${missingFiles.join(', ')}`);
  } else {
    logSuccess('Test structure validation passed');
  }
  
  return missingFiles.length === 0;
}

async function runLintAndTypeCheck() {
  logStep('Running linting and type checking...');
  
  try {
    execSync('npm run lint', { stdio: 'inherit' });
    logSuccess('Linting passed');
    
    execSync('npx tsc --noEmit', { stdio: 'inherit' });
    logSuccess('Type checking passed');
    
    return true;
  } catch (error) {
    logError(`Linting/type checking failed: ${error.message}`);
    return false;
  }
}

async function checkTestCoverage() {
  logStep('Checking test coverage...');
  
  try {
    const coverageJsonPath = './coverage/coverage-summary.json';
    
    if (!fs.existsSync(coverageJsonPath)) {
      logWarning('Coverage summary not found, generating...');
      await generateCoverageReport();
    }
    
    if (fs.existsSync(coverageJsonPath)) {
      const coverage = JSON.parse(fs.readFileSync(coverageJsonPath, 'utf8'));
      const totalCoverage = coverage.total;
      
      log(`Coverage Summary:`, 'cyan');
      log(`  Lines: ${totalCoverage.lines.pct}%`);
      log(`  Functions: ${totalCoverage.functions.pct}%`);
      log(`  Branches: ${totalCoverage.branches.pct}%`);
      log(`  Statements: ${totalCoverage.statements.pct}%`);
      
      const minCoverage = Math.min(
        totalCoverage.lines.pct,
        totalCoverage.functions.pct,
        totalCoverage.branches.pct,
        totalCoverage.statements.pct
      );
      
      if (minCoverage >= config.coverageThreshold) {
        logSuccess(`Coverage threshold met (${minCoverage}% >= ${config.coverageThreshold}%)`);
        return true;
      } else {
        logError(`Coverage below threshold (${minCoverage}% < ${config.coverageThreshold}%)`);
        return false;
      }
    }
    
    return false;
  } catch (error) {
    logError(`Coverage check failed: ${error.message}`);
    return false;
  }
}

async function runAllTests() {
  logSection('TW-Enigma Detection System Test Suite');
  
  const results = {
    structure: false,
    lint: false,
    unit: false,
    integration: false,
    performance: false,
    coverage: false,
  };
  
  try {
    // 1. Validate test structure
    results.structure = await validateTestStructure();
    
    // 2. Run linting and type checking
    results.lint = await runLintAndTypeCheck();
    
    // 3. Run unit tests
    if (results.lint) {
      results.unit = await runUnitTests();
    }
    
    // 4. Run integration tests
    if (results.unit) {
      results.integration = await runIntegrationTests();
    }
    
    // 5. Run performance tests
    if (results.integration) {
      results.performance = await runPerformanceTests();
    }
    
    // 6. Generate and check coverage
    results.coverage = await checkTestCoverage();
    
    // Summary
    logSection('Test Results Summary');
    
    Object.entries(results).forEach(([test, passed]) => {
      if (passed) {
        logSuccess(`${test.charAt(0).toUpperCase() + test.slice(1)}: PASSED`);
      } else {
        logError(`${test.charAt(0).toUpperCase() + test.slice(1)}: FAILED`);
      }
    });
    
    const allPassed = Object.values(results).every(Boolean);
    
    if (allPassed) {
      logSuccess('\n🎉 All tests passed successfully!');
      process.exit(0);
    } else {
      logError('\n💥 Some tests failed. Please review the output above.');
      process.exit(1);
    }
    
  } catch (error) {
    logError(`Test execution failed: ${error.message}`);
    process.exit(1);
  }
}

// CLI interface
function showHelp() {
  log('TW-Enigma Test Automation', 'bright');
  log('\nUsage: node test-automation.js [command]\n');
  log('Commands:');
  log('  all           Run all tests (default)');
  log('  unit          Run unit tests only');
  log('  integration   Run integration tests only');
  log('  performance   Run performance tests only');
  log('  coverage      Generate coverage report');
  log('  lint          Run linting and type checking');
  log('  validate      Validate test structure');
  log('  help          Show this help message');
}

// Main execution
async function main() {
  const command = process.argv[2] || 'all';
  
  switch (command) {
    case 'unit':
      await runUnitTests();
      break;
    case 'integration':
      await runIntegrationTests();
      break;
    case 'performance':
      await runPerformanceTests();
      break;
    case 'coverage':
      await generateCoverageReport();
      break;
    case 'lint':
      await runLintAndTypeCheck();
      break;
    case 'validate':
      await validateTestStructure();
      break;
    case 'help':
      showHelp();
      break;
    case 'all':
    default:
      await runAllTests();
      break;
  }
}

// Handle uncaught errors
process.on('unhandledRejection', (error) => {
  logError(`Unhandled rejection: ${error.message}`);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  logError(`Uncaught exception: ${error.message}`);
  process.exit(1);
});

// Run the script
main();