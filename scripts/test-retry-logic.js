#!/usr/bin/env node

/**
 * Test Retry Logic for TW-Enigma CI/CD
 * 
 * Implements intelligent retry logic for flaky tests, with exponential backoff,
 * test isolation, and failure pattern analysis to improve CI reliability.
 */

const { execSync, spawn } = require('child_process');
const fs = require('fs-extra');
const path = require('path');

class TestRetryManager {
  constructor(options = {}) {
    this.config = {
      maxRetries: options.maxRetries || 3,
      baseDelay: options.baseDelay || 1000, // ms
      maxDelay: options.maxDelay || 30000, // ms
      backoffFactor: options.backoffFactor || 2,
      jitterFactor: options.jitterFactor || 0.1,
      retryablePatterns: options.retryablePatterns || [
        /timeout/i,
        /ECONNRESET/i,
        /ENOTFOUND/i,
        /network/i,
        /temporary/i,
        /flaky/i,
        /race condition/i,
        /async.*timeout/i,
      ],
      nonRetryablePatterns: options.nonRetryablePatterns || [
        /syntax error/i,
        /type error/i,
        /reference error/i,
        /assertion.*failed/i,
        /expect.*received/i,
        /test.*failed/i,
      ],
    };
    
    this.retryHistory = new Map();
    this.flakyCounts = new Map();
  }
  
  /**
   * Determine if an error should trigger a retry
   */
  shouldRetry(error, attempt, testName) {
    if (attempt >= this.config.maxRetries) {
      return false;
    }
    
    const errorMessage = error.message || error.toString();
    
    // Check for non-retryable patterns first
    for (const pattern of this.config.nonRetryablePatterns) {
      if (pattern.test(errorMessage)) {
        return false;
      }
    }
    
    // Check for retryable patterns
    for (const pattern of this.config.retryablePatterns) {
      if (pattern.test(errorMessage)) {
        this.recordFlaky(testName);
        return true;
      }
    }
    
    // Default: retry on infrastructure-related errors
    const infraErrors = [
      'ECONNRESET',
      'ETIMEDOUT',
      'ENOTFOUND',
      'spawn ENOENT',
    ];
    
    return infraErrors.some(infraError => errorMessage.includes(infraError));
  }
  
  /**
   * Calculate delay with exponential backoff and jitter
   */
  calculateDelay(attempt) {
    const exponentialDelay = this.config.baseDelay * Math.pow(this.config.backoffFactor, attempt - 1);
    const jitter = exponentialDelay * this.config.jitterFactor * Math.random();
    const totalDelay = Math.min(exponentialDelay + jitter, this.config.maxDelay);
    
    return Math.floor(totalDelay);
  }
  
  /**
   * Record flaky test for analysis
   */
  recordFlaky(testName) {
    const count = this.flakyCounts.get(testName) || 0;
    this.flakyCounts.set(testName, count + 1);
  }
  
  /**
   * Execute test with retry logic
   */
  async executeWithRetry(testCommand, options = {}) {
    const {
      testName = 'unknown',
      cwd = process.cwd(),
      env = process.env,
      timeout = 60000,
      beforeRetry = null,
    } = options;
    
    let lastError = null;
    
    for (let attempt = 1; attempt <= this.config.maxRetries + 1; attempt++) {
      try {
        console.log(`🔄 Running ${testName} (attempt ${attempt}/${this.config.maxRetries + 1})`);
        
        const result = execSync(testCommand, {
          cwd,
          env: {
            ...env,
            TEST_ATTEMPT: attempt.toString(),
            TEST_RETRY: attempt > 1 ? 'true' : 'false',
          },
          timeout,
          stdio: 'pipe',
          encoding: 'utf8',
        });
        
        // Success
        console.log(`✅ ${testName} passed on attempt ${attempt}`);
        this.recordSuccess(testName, attempt);
        return { success: true, output: result, attempt };
        
      } catch (error) {
        lastError = error;
        const isLastAttempt = attempt > this.config.maxRetries;
        
        if (!this.shouldRetry(error, attempt, testName) || isLastAttempt) {
          console.log(`❌ ${testName} failed definitively on attempt ${attempt}`);
          this.recordFailure(testName, attempt, error);
          break;
        }
        
        // Calculate delay and wait before retry
        const delay = this.calculateDelay(attempt);
        console.log(`⏳ ${testName} failed on attempt ${attempt}, retrying in ${delay}ms...`);
        console.log(`   Error: ${error.message.split('\n')[0]}`);
        
        // Execute beforeRetry hook if provided
        if (beforeRetry) {
          try {
            await beforeRetry(attempt, error);
          } catch (hookError) {
            console.warn(`⚠️  beforeRetry hook failed: ${hookError.message}`);
          }
        }
        
        await this.sleep(delay);
      }
    }
    
    return { 
      success: false, 
      error: lastError.message,
      output: lastError.stdout || lastError.stderr || '',
      attempt: this.config.maxRetries + 1,
    };
  }
  
  /**
   * Record successful test execution
   */
  recordSuccess(testName, attempt) {
    if (!this.retryHistory.has(testName)) {
      this.retryHistory.set(testName, []);
    }
    
    this.retryHistory.get(testName).push({
      timestamp: new Date().toISOString(),
      success: true,
      attempt,
    });
  }
  
  /**
   * Record failed test execution
   */
  recordFailure(testName, attempt, error) {
    if (!this.retryHistory.has(testName)) {
      this.retryHistory.set(testName, []);
    }
    
    this.retryHistory.get(testName).push({
      timestamp: new Date().toISOString(),
      success: false,
      attempt,
      error: error.message,
    });
  }
  
  /**
   * Sleep for specified duration
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  /**
   * Generate flaky test report
   */
  generateFlakyReport() {
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        totalTests: this.retryHistory.size,
        flakyTests: this.flakyCounts.size,
        flakyPercentage: this.retryHistory.size > 0 
          ? (this.flakyCounts.size / this.retryHistory.size * 100).toFixed(2)
          : 0,
      },
      flakyTests: Array.from(this.flakyCounts.entries()).map(([testName, count]) => ({
        testName,
        flakyCount: count,
        history: this.retryHistory.get(testName) || [],
      })).sort((a, b) => b.flakyCount - a.flakyCount),
    };
    
    return report;
  }
  
  /**
   * Save flaky test report
   */
  async saveFlakyReport() {
    const report = this.generateFlakyReport();
    const reportPath = path.join('test-results', 'flaky-test-report.json');
    
    await fs.ensureDir(path.dirname(reportPath));
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
    
    console.log(`📊 Flaky test report saved: ${reportPath}`);
    
    // Print summary
    if (report.flakyTests.length > 0) {
      console.log(`⚠️  Found ${report.flakyTests.length} flaky tests:`);
      report.flakyTests.slice(0, 5).forEach(test => {
        console.log(`   - ${test.testName}: ${test.flakyCount} flaky occurrences`);
      });
    }
    
    return reportPath;
  }
  
  /**
   * Create test runner with retry logic
   */
  createRetryTestRunner() {
    return async (testSuite, testCommands) => {
      const results = [];
      
      for (const [testName, command] of Object.entries(testCommands)) {
        const result = await this.executeWithRetry(command, {
          testName: `${testSuite}:${testName}`,
          beforeRetry: async (attempt, error) => {
            // Clean up any temporary files between retries
            const tempDirs = ['test-temp', '.test-isolation'];
            for (const dir of tempDirs) {
              try {
                if (fs.existsSync(dir)) {
                  await fs.remove(dir);
                }
              } catch (cleanupError) {
                console.warn(`Failed to cleanup ${dir}:`, cleanupError.message);
              }
            }
          },
        });
        
        results.push({ testName, ...result });
      }
      
      return results;
    };
  }
}

// CLI interface for standalone usage
async function runCLI() {
  const args = process.argv.slice(2);
  const command = args.join(' ');
  
  if (!command) {
    console.error('Usage: node test-retry-logic.js <test-command>');
    process.exit(1);
  }
  
  const retryManager = new TestRetryManager({
    maxRetries: parseInt(process.env.MAX_RETRIES) || 3,
  });
  
  const result = await retryManager.executeWithRetry(command, {
    testName: 'cli-test',
  });
  
  if (result.success) {
    console.log(result.output);
    await retryManager.saveFlakyReport();
    process.exit(0);
  } else {
    console.error(result.output);
    await retryManager.saveFlakyReport();
    process.exit(1);
  }
}

// Export for use as module
module.exports = {
  TestRetryManager,
  createRetryTestRunner: (options) => new TestRetryManager(options).createRetryTestRunner(),
};

// Run CLI if executed directly
if (require.main === module) {
  runCLI().catch(error => {
    console.error('Retry logic failed:', error.message);
    process.exit(1);
  });
}