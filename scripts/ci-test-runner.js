#!/usr/bin/env node

/**
 * CI Test Runner for TW-Enigma
 * 
 * Orchestrates test execution in CI environments with proper error handling,
 * retry logic, and result aggregation for optimal CI/CD pipeline performance.
 */

const { execSync, spawn } = require('child_process');
const fs = require('fs-extra');
const path = require('path');

// CI Configuration
const CI_CONFIG = {
  maxRetries: 2,
  timeouts: {
    unit: 120000,      // 2 minutes
    integration: 300000, // 5 minutes
    e2e: 600000,       // 10 minutes
  },
  parallelism: process.env.CI_PARALLEL_JOBS || 'auto',
  coverage: {
    threshold: 75,
    formats: ['text', 'lcov', 'json-summary', 'html'],
  },
  artifacts: {
    retentionDays: 7,
    paths: ['coverage', 'test-results', 'benchmark-results'],
  },
};

// Utility functions
const logger = {
  info: (msg) => console.log(`ℹ️  ${msg}`),
  success: (msg) => console.log(`✅ ${msg}`),
  error: (msg) => console.error(`❌ ${msg}`),
  warn: (msg) => console.warn(`⚠️  ${msg}`),
  debug: (msg) => process.env.DEBUG && console.log(`🐛 ${msg}`),
};

function createTestEnvironment() {
  const env = {
    ...process.env,
    NODE_ENV: 'test',
    CI: 'true',
    FORCE_COLOR: '0', // Disable colors for consistent output parsing
    // Test-specific environment variables
    TEST_TIMEOUT: '30000',
    JEST_WORKERS: CI_CONFIG.parallelism === 'auto' ? '1' : CI_CONFIG.parallelism,
    // Disable features that might interfere with testing
    DISABLE_OPENCOLLECTIVE: 'true',
    DISABLE_UPDATE_NOTIFIER: 'true',
    npm_config_update_notifier: 'false',
  };

  // Set up test directories
  ['test-results', 'coverage', 'benchmark-results'].forEach(dir => {
    fs.ensureDirSync(dir);
  });

  return env;
}

async function runCommand(command, options = {}) {
  const {
    timeout = 120000,
    retries = CI_CONFIG.maxRetries,
    cwd = process.cwd(),
    env = createTestEnvironment(),
    description = command,
  } = options;

  logger.info(`Running: ${description}`);
  
  for (let attempt = 1; attempt <= retries + 1; attempt++) {
    try {
      const result = execSync(command, {
        cwd,
        env,
        timeout,
        stdio: 'pipe',
        encoding: 'utf8',
      });
      
      logger.success(`${description} completed successfully`);
      return { success: true, output: result, attempt };
    } catch (error) {
      const isLastAttempt = attempt > retries;
      const errorMsg = `${description} failed (attempt ${attempt}/${retries + 1})`;
      
      if (isLastAttempt) {
        logger.error(`${errorMsg}: ${error.message}`);
        return { 
          success: false, 
          error: error.message, 
          output: error.stdout || error.stderr || '',
          attempt 
        };
      } else {
        logger.warn(`${errorMsg}, retrying...`);
        // Exponential backoff for retries
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
      }
    }
  }
}

async function runUnitTests() {
  logger.info('🧪 Starting unit tests...');
  
  const result = await runCommand(
    'npm run test:unit -- --coverage --testTimeout=30000 --maxWorkers=1',
    {
      timeout: CI_CONFIG.timeouts.unit,
      description: 'Unit tests',
    }
  );
  
  if (result.success) {
    logger.success('Unit tests completed successfully');
  } else {
    logger.error('Unit tests failed');
  }
  
  return result;
}

async function runIntegrationTests() {
  logger.info('🔧 Starting integration tests...');
  
  const result = await runCommand(
    'npm run test:integration -- --testTimeout=60000 --maxWorkers=1 --verbose',
    {
      timeout: CI_CONFIG.timeouts.integration,
      description: 'Integration tests',
    }
  );
  
  if (result.success) {
    logger.success('Integration tests completed successfully');
  } else {
    logger.error('Integration tests failed');
  }
  
  return result;
}

async function runLintingAndTypeChecking() {
  logger.info('🔍 Running linting and type checking...');
  
  const lintResult = await runCommand('npm run lint', {
    description: 'ESLint checks',
    timeout: 60000,
  });
  
  const typeResult = await runCommand('npm run type-check', {
    description: 'TypeScript type checking',
    timeout: 60000,
  });
  
  const success = lintResult.success && typeResult.success;
  if (success) {
    logger.success('Linting and type checking completed successfully');
  } else {
    logger.error('Linting or type checking failed');
  }
  
  return { 
    success, 
    linting: lintResult, 
    typeChecking: typeResult 
  };
}

async function runBenchmarks() {
  logger.info('⚡ Running performance benchmarks...');
  
  const result = await runCommand('npm run benchmark:ci', {
    timeout: 180000, // 3 minutes for benchmarks
    description: 'Performance benchmarks',
  });
  
  if (result.success) {
    logger.success('Benchmarks completed successfully');
  } else {
    logger.warn('Benchmarks failed (non-blocking)');
  }
  
  return result;
}

async function analyzeCoverage() {
  logger.info('📊 Analyzing test coverage...');
  
  try {
    const summaryPath = path.join('coverage', 'coverage-summary.json');
    
    if (!fs.existsSync(summaryPath)) {
      logger.warn('Coverage summary not found, skipping analysis');
      return { success: false, reason: 'No coverage data' };
    }
    
    const coverage = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
    const total = coverage.total;
    
    const metrics = {
      lines: total.lines.pct,
      functions: total.functions.pct,
      branches: total.branches.pct,
      statements: total.statements.pct,
    };
    
    const minCoverage = Math.min(...Object.values(metrics));
    const passed = minCoverage >= CI_CONFIG.coverage.threshold;
    
    logger.info('Coverage Report:');
    Object.entries(metrics).forEach(([type, pct]) => {
      const status = pct >= CI_CONFIG.coverage.threshold ? '✅' : '❌';
      logger.info(`  ${status} ${type}: ${pct}%`);
    });
    
    if (passed) {
      logger.success(`Coverage threshold met (${minCoverage}% >= ${CI_CONFIG.coverage.threshold}%)`);
    } else {
      logger.error(`Coverage below threshold (${minCoverage}% < ${CI_CONFIG.coverage.threshold}%)`);
    }
    
    return { success: passed, coverage: metrics, minCoverage };
  } catch (error) {
    logger.error(`Coverage analysis failed: ${error.message}`);
    return { success: false, error: error.message };
  }
}

async function generateTestReports() {
  logger.info('📋 Generating test reports...');
  
  try {
    // Collect test results
    const testResults = {
      timestamp: new Date().toISOString(),
      ci: {
        branch: process.env.GITHUB_REF_NAME || process.env.BRANCH_NAME || 'unknown',
        commit: process.env.GITHUB_SHA || process.env.COMMIT_SHA || 'unknown',
        job: process.env.GITHUB_JOB || process.env.JOB_NAME || 'unknown',
      },
      environment: {
        node: process.version,
        platform: process.platform,
        arch: process.arch,
      },
    };
    
    // Save consolidated test results
    const reportPath = path.join('test-results', 'ci-test-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(testResults, null, 2));
    
    logger.success(`Test report generated: ${reportPath}`);
    return { success: true, reportPath };
  } catch (error) {
    logger.error(`Report generation failed: ${error.message}`);
    return { success: false, error: error.message };
  }
}

function printSummary(results) {
  console.log('\n' + '='.repeat(60));
  console.log('  🎯 CI TEST EXECUTION SUMMARY');
  console.log('='.repeat(60));
  
  const sections = [
    { name: 'Linting & Type Checking', result: results.linting },
    { name: 'Unit Tests', result: results.unit },
    { name: 'Integration Tests', result: results.integration },
    { name: 'Coverage Analysis', result: results.coverage },
    { name: 'Performance Benchmarks', result: results.benchmarks },
  ];
  
  sections.forEach(({ name, result }) => {
    const status = result?.success ? '✅ PASS' : '❌ FAIL';
    const attempts = result?.attempt ? ` (attempt ${result.attempt})` : '';
    console.log(`  ${status} ${name}${attempts}`);
  });
  
  const allPassed = sections.every(({ result }) => result?.success);
  
  console.log('\n' + '='.repeat(60));
  if (allPassed) {
    console.log('  🎉 ALL TESTS PASSED! Pipeline ready for deployment.');
  } else {
    console.log('  💥 SOME TESTS FAILED! Review the output above.');
  }
  console.log('='.repeat(60));
  
  return allPassed;
}

async function main() {
  logger.info('🚀 Starting TW-Enigma CI Test Runner...');
  logger.info(`Environment: Node.js ${process.version}, Platform: ${process.platform}`);
  logger.info(`Parallelism: ${CI_CONFIG.parallelism}, Max retries: ${CI_CONFIG.maxRetries}`);
  
  const results = {};
  let shouldContinue = true;
  
  try {
    // Phase 1: Static analysis
    if (shouldContinue) {
      results.linting = await runLintingAndTypeChecking();
      shouldContinue = results.linting.success;
    }
    
    // Phase 2: Unit tests (fast feedback)
    if (shouldContinue) {
      results.unit = await runUnitTests();
      shouldContinue = results.unit.success;
    }
    
    // Phase 3: Integration tests (slower but comprehensive)
    if (shouldContinue) {
      results.integration = await runIntegrationTests();
      // Continue even if integration tests fail for coverage analysis
    }
    
    // Phase 4: Coverage analysis
    results.coverage = await analyzeCoverage();
    
    // Phase 5: Performance benchmarks (non-blocking)
    results.benchmarks = await runBenchmarks();
    
    // Phase 6: Generate reports
    await generateTestReports();
    
    // Final summary
    const success = printSummary(results);
    
    process.exit(success ? 0 : 1);
    
  } catch (error) {
    logger.error(`CI runner failed: ${error.message}`);
    process.exit(1);
  }
}

// CLI interface
if (require.main === module) {
  main().catch(error => {
    logger.error(`Unhandled error: ${error.message}`);
    process.exit(1);
  });
}

module.exports = {
  runUnitTests,
  runIntegrationTests,
  runLintingAndTypeChecking,
  runBenchmarks,
  analyzeCoverage,
  generateTestReports,
};