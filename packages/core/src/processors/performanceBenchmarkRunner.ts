/**
 * Performance Benchmark Runner
 * Automated benchmark execution and CI integration
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { TemplateLiteralPerformanceTester } from './templateLiteralPerformanceTester';

export interface BenchmarkConfig {
  outputDir: string;
  baselineFile: string;
  reportFile: string;
  enableRegression: boolean;
  ciMode: boolean;
  failOnRegression: boolean;
  failOnThresholds: boolean;
}

export interface BenchmarkResult {
  timestamp: string;
  environment: {
    nodeVersion: string;
    platform: string;
    cpus: number;
    memory: string;
  };
  testResult: any;
  regressionDetected: boolean;
  thresholdsPassed: boolean;
  success: boolean;
}

export class PerformanceBenchmarkRunner {
  private config: BenchmarkConfig;
  private tester: TemplateLiteralPerformanceTester;

  constructor(config: Partial<BenchmarkConfig> = {}) {
    this.config = {
      outputDir: './benchmark-results',
      baselineFile: 'performance-baseline.json',
      reportFile: 'performance-report.md',
      enableRegression: true,
      ciMode: process.env.CI === 'true',
      failOnRegression: true,
      failOnThresholds: true,
      ...config,
    };

    // Configure tester for CI vs local
    const testerConfig = this.config.ciMode
      ? {
          iterations: 100,
          complexityLevels: ['simple', 'moderate', 'complex'] as const,
          enableMemoryProfiling: true,
          enableConcurrencyTesting: false, // Disable in CI
          maxTestDuration: 30000,
          workerThreads: 2,
          thresholds: {
            detectionLatency: 10,
            parsingLatency: 50,
            generationLatency: 20,
            fallbackLatency: 100,
            memoryUsage: 100,
            throughput: 50,
          },
        }
      : {
          iterations: 500,
          complexityLevels: ['simple', 'moderate', 'complex', 'extreme'] as const,
          enableMemoryProfiling: true,
          enableConcurrencyTesting: true,
          maxTestDuration: 120000,
          workerThreads: 4,
          thresholds: {
            detectionLatency: 5,
            parsingLatency: 25,
            generationLatency: 10,
            fallbackLatency: 50,
            memoryUsage: 50,
            throughput: 100,
          },
        };

    this.tester = new TemplateLiteralPerformanceTester(testerConfig);
  }

  /**
   * Run complete benchmark suite
   */
  async runBenchmark(): Promise<BenchmarkResult> {
    console.log('🚀 Starting performance benchmark...');
    
    try {
      // Ensure output directory exists
      await this.ensureOutputDirectory();

      // Load baseline if regression testing is enabled
      if (this.config.enableRegression) {
        await this.loadBaseline();
      }

      // Run performance tests
      const testResult = await this.tester.runFullTestSuite();

      // Create benchmark result
      const result: BenchmarkResult = {
        timestamp: new Date().toISOString(),
        environment: await this.getEnvironmentInfo(),
        testResult,
        regressionDetected: testResult.regressionDetected,
        thresholdsPassed: testResult.passedThresholds,
        success: this.determineSuccess(testResult),
      };

      // Save results
      await this.saveResults(result);

      // Update baseline if this is a good run
      if (result.success && !this.config.ciMode) {
        await this.updateBaseline(testResult.metrics);
      }

      // Generate and save report
      const report = this.generateBenchmarkReport(result);
      await this.saveReport(report);

      console.log('✅ Benchmark completed successfully');
      return result;
    } catch (error) {
      console.error('❌ Benchmark failed:', error);
      throw error;
    }
  }

  /**
   * Ensure output directory exists
   */
  private async ensureOutputDirectory(): Promise<void> {
    try {
      await fs.access(this.config.outputDir);
    } catch {
      await fs.mkdir(this.config.outputDir, { recursive: true });
    }
  }

  /**
   * Load performance baseline
   */
  private async loadBaseline(): Promise<void> {
    const baselinePath = path.join(this.config.outputDir, this.config.baselineFile);
    
    try {
      const baselineData = await fs.readFile(baselinePath, 'utf8');
      const baseline = JSON.parse(baselineData);
      this.tester.setBaseline(baseline.metrics);
      console.log('📊 Loaded performance baseline');
    } catch (error) {
      console.log('⚠️ No baseline found, will establish new baseline');
    }
  }

  /**
   * Update performance baseline
   */
  private async updateBaseline(metrics: any[]): Promise<void> {
    const baselinePath = path.join(this.config.outputDir, this.config.baselineFile);
    
    const baseline = {
      timestamp: new Date().toISOString(),
      environment: await this.getEnvironmentInfo(),
      metrics,
    };

    await fs.writeFile(baselinePath, JSON.stringify(baseline, null, 2));
    console.log('📊 Updated performance baseline');
  }

  /**
   * Get environment information
   */
  private async getEnvironmentInfo(): Promise<BenchmarkResult['environment']> {
    const os = await import('os');
    
    return {
      nodeVersion: process.version,
      platform: `${os.platform()} ${os.release()}`,
      cpus: os.cpus().length,
      memory: `${Math.round(os.totalmem() / 1024 / 1024 / 1024)}GB`,
    };
  }

  /**
   * Determine if benchmark was successful
   */
  private determineSuccess(testResult: any): boolean {
    if (this.config.failOnThresholds && !testResult.passedThresholds) {
      return false;
    }
    
    if (this.config.failOnRegression && testResult.regressionDetected) {
      return false;
    }
    
    return true;
  }

  /**
   * Save benchmark results
   */
  private async saveResults(result: BenchmarkResult): Promise<void> {
    const timestamp = result.timestamp.replace(/[:.]/g, '-');
    const resultsPath = path.join(this.config.outputDir, `benchmark-${timestamp}.json`);
    
    await fs.writeFile(resultsPath, JSON.stringify(result, null, 2));
    
    // Also save as latest
    const latestPath = path.join(this.config.outputDir, 'benchmark-latest.json');
    await fs.writeFile(latestPath, JSON.stringify(result, null, 2));
    
    console.log(`💾 Saved benchmark results to ${resultsPath}`);
  }

  /**
   * Generate comprehensive benchmark report
   */
  private generateBenchmarkReport(result: BenchmarkResult): string {
    const sections = [
      '# Performance Benchmark Report',
      '',
      `**Timestamp:** ${result.timestamp}`,
      `**Success:** ${result.success ? '✅' : '❌'}`,
      `**Regression Detected:** ${result.regressionDetected ? '❌' : '✅'}`,
      `**Thresholds Passed:** ${result.thresholdsPassed ? '✅' : '❌'}`,
      '',
      '## Environment',
      `- Node.js: ${result.environment.nodeVersion}`,
      `- Platform: ${result.environment.platform}`,
      `- CPUs: ${result.environment.cpus}`,
      `- Memory: ${result.environment.memory}`,
      '',
      '## Test Configuration',
      `- CI Mode: ${this.config.ciMode}`,
      `- Regression Testing: ${this.config.enableRegression}`,
      `- Fail on Regression: ${this.config.failOnRegression}`,
      `- Fail on Thresholds: ${this.config.failOnThresholds}`,
      '',
    ];

    // Add detailed performance report
    const performanceReport = this.tester.generateReport(result.testResult);
    sections.push(performanceReport);

    // Add benchmark-specific analysis
    sections.push('', '## Benchmark Analysis');
    
    if (result.regressionDetected) {
      sections.push('⚠️ **Performance regression detected!**');
      sections.push('- Some operations are significantly slower than baseline');
      sections.push('- Review recent changes for performance impact');
      sections.push('');
    }
    
    if (!result.thresholdsPassed) {
      sections.push('⚠️ **Performance thresholds not met!**');
      sections.push('- Some operations exceed acceptable latency/throughput limits');
      sections.push('- Consider optimization before release');
      sections.push('');
    }
    
    if (result.success) {
      sections.push('✅ **All performance criteria met**');
      sections.push('- No regressions detected');
      sections.push('- All thresholds within acceptable limits');
      sections.push('- Ready for deployment');
    }

    return sections.join('\n');
  }

  /**
   * Save benchmark report
   */
  private async saveReport(report: string): Promise<void> {
    const reportPath = path.join(this.config.outputDir, this.config.reportFile);
    await fs.writeFile(reportPath, report);
    
    console.log(`📄 Saved benchmark report to ${reportPath}`);
  }

  /**
   * Run benchmark and exit with appropriate code for CI
   */
  async runAndExit(): Promise<void> {
    try {
      const result = await this.runBenchmark();
      
      if (result.success) {
        console.log('🎉 Benchmark passed - exiting with code 0');
        process.exit(0);
      } else {
        console.error('💥 Benchmark failed - exiting with code 1');
        process.exit(1);
      }
    } catch (error) {
      console.error('💥 Benchmark error - exiting with code 1');
      console.error(error);
      process.exit(1);
    }
  }

  /**
   * Clean up old benchmark results
   */
  async cleanup(keepDays = 30): Promise<void> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - keepDays);
    
    try {
      const files = await fs.readdir(this.config.outputDir);
      const benchmarkFiles = files.filter(f => f.startsWith('benchmark-') && f.endsWith('.json'));
      
      for (const file of benchmarkFiles) {
        if (file === 'benchmark-latest.json') continue;
        
        const filePath = path.join(this.config.outputDir, file);
        const stats = await fs.stat(filePath);
        
        if (stats.mtime < cutoffDate) {
          await fs.unlink(filePath);
          console.log(`🗑️ Cleaned up old benchmark: ${file}`);
        }
      }
    } catch (error) {
      console.warn('⚠️ Cleanup failed:', error);
    }
  }
}

// CLI interface
if (require.main === module) {
  const args = process.argv.slice(2);
  const config: Partial<BenchmarkConfig> = {};
  
  // Parse CLI arguments
  for (let i = 0; i < args.length; i += 2) {
    const flag = args[i];
    const value = args[i + 1];
    
    switch (flag) {
      case '--output-dir':
        config.outputDir = value;
        break;
      case '--baseline-file':
        config.baselineFile = value;
        break;
      case '--report-file':
        config.reportFile = value;
        break;
      case '--no-regression':
        config.enableRegression = false;
        i--; // No value for this flag
        break;
      case '--no-fail-regression':
        config.failOnRegression = false;
        i--; // No value for this flag
        break;
      case '--no-fail-thresholds':
        config.failOnThresholds = false;
        i--; // No value for this flag
        break;
    }
  }
  
  const runner = new PerformanceBenchmarkRunner(config);
  
  if (args.includes('--cleanup')) {
    runner.cleanup().then(() => {
      console.log('✅ Cleanup completed');
      process.exit(0);
    });
  } else {
    runner.runAndExit();
  }
}

export default PerformanceBenchmarkRunner;