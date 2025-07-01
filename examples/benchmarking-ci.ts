/**
 * CI Benchmarking Example
 * 
 * This example demonstrates how to use the TW-Enigma benchmarking system
 * in CI/CD environments with baseline comparison, regression detection,
 * and performance budget enforcement.
 */

import {
  BenchmarkRunner,
  createBenchmarkSuite,
  ResultAnalyzer,
} from '@tw-enigma/core/benchmarking';

import {
  createCIBenchmarkProfiler,
  createCIProfilingExporter,
} from '@tw-enigma/core/benchmarking/profiling';

import { promises as fs } from 'fs';
import path from 'path';

interface CIEnvironment {
  isCI: boolean;
  provider: string;
  branch: string;
  commitSha: string;
  pullRequestNumber?: string;
  buildNumber?: string;
}

// Detect CI environment
function detectCIEnvironment(): CIEnvironment {
  const env = process.env;
  
  return {
    isCI: env.CI === 'true',
    provider: env.GITHUB_ACTIONS ? 'github' : 
              env.GITLAB_CI ? 'gitlab' :
              env.JENKINS_URL ? 'jenkins' :
              env.CIRCLECI ? 'circle' : 'unknown',
    branch: env.GITHUB_REF_NAME || env.CI_COMMIT_REF_NAME || env.BRANCH_NAME || 'unknown',
    commitSha: env.GITHUB_SHA || env.CI_COMMIT_SHA || env.GIT_COMMIT || 'unknown',
    pullRequestNumber: env.GITHUB_PR_NUMBER || env.CI_MERGE_REQUEST_IID,
    buildNumber: env.GITHUB_RUN_NUMBER || env.CI_PIPELINE_ID || env.BUILD_NUMBER,
  };
}

// Performance budget configuration
interface PerformanceBudget {
  maxMeanDuration: number;
  maxMemoryUsage: number;
  maxRegressionPercent: number;
  failOnRegression: boolean;
}

const PERFORMANCE_BUDGETS: Record<string, PerformanceBudget> = {
  'css-parsing': {
    maxMeanDuration: 100, // 100ms
    maxMemoryUsage: 50 * 1024 * 1024, // 50MB
    maxRegressionPercent: 10, // 10%
    failOnRegression: true,
  },
  'css-optimization': {
    maxMeanDuration: 200, // 200ms
    maxMemoryUsage: 100 * 1024 * 1024, // 100MB
    maxRegressionPercent: 15, // 15%
    failOnRegression: true,
  },
  'css-compression': {
    maxMeanDuration: 50, // 50ms
    maxMemoryUsage: 25 * 1024 * 1024, // 25MB
    maxRegressionPercent: 5, // 5%
    failOnRegression: false, // Warning only
  },
};

// Baseline management
class BaselineManager {
  private baselineDir: string;

  constructor(baselineDir = './benchmark-baselines') {
    this.baselineDir = baselineDir;
  }

  async saveBaseline(results: any[], metadata: any): Promise<void> {
    await fs.mkdir(this.baselineDir, { recursive: true });
    
    const baselineData = {
      metadata,
      results,
      createdAt: new Date().toISOString(),
    };

    const filename = `baseline-${metadata.branch}-${metadata.commitSha.slice(0, 8)}.json`;
    const filepath = path.join(this.baselineDir, filename);
    
    await fs.writeFile(filepath, JSON.stringify(baselineData, null, 2));
    console.log(`💾 Baseline saved: ${filepath}`);
  }

  async loadBaseline(branch = 'main'): Promise<any[] | null> {
    try {
      // Try to load latest baseline for branch
      const files = await fs.readdir(this.baselineDir);
      const baselineFiles = files
        .filter(f => f.startsWith(`baseline-${branch}-`) && f.endsWith('.json'))
        .sort()
        .reverse();

      if (baselineFiles.length === 0) {
        console.warn(`⚠️  No baseline found for branch: ${branch}`);
        return null;
      }

      const latestBaseline = baselineFiles[0];
      const filepath = path.join(this.baselineDir, latestBaseline);
      const data = JSON.parse(await fs.readFile(filepath, 'utf-8'));
      
      console.log(`📊 Loaded baseline: ${latestBaseline}`);
      return data.results;
    } catch (error) {
      console.warn(`⚠️  Failed to load baseline: ${error.message}`);
      return null;
    }
  }
}

// Performance budget checker
class BudgetChecker {
  checkBudgets(results: any[]): { passed: boolean; violations: any[] } {
    const violations: any[] = [];

    for (const result of results) {
      if (!result.success) continue;

      const budgetKey = this.getBudgetKey(result.name);
      const budget = PERFORMANCE_BUDGETS[budgetKey];
      
      if (!budget) continue;

      // Check duration budget
      if (result.metrics.mean > budget.maxMeanDuration) {
        violations.push({
          benchmark: result.name,
          type: 'duration',
          actual: result.metrics.mean,
          budget: budget.maxMeanDuration,
          severity: budget.failOnRegression ? 'error' : 'warning',
        });
      }

      // Check memory budget
      if (result.metrics.memoryUsage.heapUsed > budget.maxMemoryUsage) {
        violations.push({
          benchmark: result.name,
          type: 'memory',
          actual: result.metrics.memoryUsage.heapUsed,
          budget: budget.maxMemoryUsage,
          severity: budget.failOnRegression ? 'error' : 'warning',
        });
      }
    }

    const errorViolations = violations.filter(v => v.severity === 'error');
    return {
      passed: errorViolations.length === 0,
      violations,
    };
  }

  checkRegressions(current: any[], baseline: any[]): { passed: boolean; regressions: any[] } {
    const regressions: any[] = [];

    for (const currentResult of current) {
      if (!currentResult.success) continue;

      const baselineResult = baseline.find(b => b.name === currentResult.name);
      if (!baselineResult || !baselineResult.success) continue;

      const budgetKey = this.getBudgetKey(currentResult.name);
      const budget = PERFORMANCE_BUDGETS[budgetKey];
      if (!budget) continue;

      // Calculate performance change
      const currentMean = currentResult.metrics.mean;
      const baselineMean = baselineResult.metrics.mean;
      const changePercent = ((currentMean - baselineMean) / baselineMean) * 100;

      if (changePercent > budget.maxRegressionPercent) {
        regressions.push({
          benchmark: currentResult.name,
          baseline: baselineMean,
          current: currentMean,
          changePercent,
          threshold: budget.maxRegressionPercent,
          severity: budget.failOnRegression ? 'error' : 'warning',
        });
      }
    }

    const errorRegressions = regressions.filter(r => r.severity === 'error');
    return {
      passed: errorRegressions.length === 0,
      regressions,
    };
  }

  private getBudgetKey(benchmarkName: string): string {
    const name = benchmarkName.toLowerCase();
    if (name.includes('parsing')) return 'css-parsing';
    if (name.includes('optimization')) return 'css-optimization';
    if (name.includes('compression')) return 'css-compression';
    return 'css-parsing'; // default
  }
}

// CI-specific benchmark suite
function createCIBenchmarkSuite() {
  const suite = createBenchmarkSuite({
    name: 'CI Performance Tests',
    description: 'Performance benchmarks optimized for CI execution',
    tags: ['ci', 'performance', 'regression'],
  });

  // Lightweight CSS samples for CI
  const smallCSS = '.button { background: blue; padding: 10px; }';
  const mediumCSS = Array(50).fill(smallCSS).join('\n');

  // Fast parsing benchmark
  suite.addBenchmark({
    name: 'CSS Parsing Performance',
    fn: async () => {
      // Simulate fast CSS parsing
      await new Promise(resolve => setTimeout(resolve, Math.random() * 20));
      return { rules: mediumCSS.split('{').length - 1 };
    },
    tags: ['parsing'],
  });

  // Optimization benchmark
  suite.addBenchmark({
    name: 'CSS Optimization Performance',
    fn: async () => {
      // Simulate CSS optimization
      await new Promise(resolve => setTimeout(resolve, Math.random() * 30));
      return mediumCSS.replace(/\s+/g, ' ').trim();
    },
    tags: ['optimization'],
  });

  // Compression benchmark
  suite.addBenchmark({
    name: 'CSS Compression Performance',
    fn: async () => {
      // Simulate CSS compression
      await new Promise(resolve => setTimeout(resolve, Math.random() * 10));
      return mediumCSS.replace(/\s+/g, '').replace(/;}/g, '}');
    },
    tags: ['compression'],
  });

  return suite;
}

// Generate CI summary
function generateCISummary(
  results: any[],
  budgetCheck: any,
  regressionCheck: any,
  ciEnv: CIEnvironment
): string {
  const successCount = results.filter(r => r.success).length;
  const totalCount = results.length;
  
  let summary = `## 📊 Performance Benchmark Results\n\n`;
  summary += `**Branch:** ${ciEnv.branch} | **Commit:** ${ciEnv.commitSha.slice(0, 8)}\n`;
  summary += `**Build:** ${ciEnv.buildNumber || 'N/A'} | **Provider:** ${ciEnv.provider}\n\n`;
  
  summary += `### Overall Status\n`;
  summary += `- ✅ Benchmarks: ${successCount}/${totalCount} passed\n`;
  summary += `- 💰 Budget: ${budgetCheck.passed ? '✅ PASS' : '❌ FAIL'}\n`;
  summary += `- 📈 Regression: ${regressionCheck.passed ? '✅ PASS' : '❌ FAIL'}\n\n`;

  // Benchmark results table
  summary += `### Benchmark Results\n\n`;
  summary += `| Benchmark | Duration | Memory | Status |\n`;
  summary += `|-----------|----------|--------|---------|\n`;
  
  results.forEach(result => {
    if (result.success) {
      const duration = `${result.metrics.mean.toFixed(2)}ms`;
      const memory = `${(result.metrics.memoryUsage.heapUsed / 1024 / 1024).toFixed(1)}MB`;
      summary += `| ${result.name} | ${duration} | ${memory} | ✅ |\n`;
    } else {
      summary += `| ${result.name} | - | - | ❌ |\n`;
    }
  });

  // Budget violations
  if (budgetCheck.violations.length > 0) {
    summary += `\n### 💰 Budget Violations\n\n`;
    budgetCheck.violations.forEach(v => {
      const emoji = v.severity === 'error' ? '❌' : '⚠️';
      const actual = v.type === 'memory' 
        ? `${(v.actual / 1024 / 1024).toFixed(1)}MB`
        : `${v.actual.toFixed(2)}ms`;
      const budget = v.type === 'memory'
        ? `${(v.budget / 1024 / 1024).toFixed(1)}MB`
        : `${v.budget}ms`;
      
      summary += `- ${emoji} **${v.benchmark}** ${v.type}: ${actual} > ${budget}\n`;
    });
  }

  // Regressions
  if (regressionCheck.regressions.length > 0) {
    summary += `\n### 📈 Performance Regressions\n\n`;
    regressionCheck.regressions.forEach(r => {
      const emoji = r.severity === 'error' ? '❌' : '⚠️';
      summary += `- ${emoji} **${r.benchmark}**: ${r.changePercent.toFixed(1)}% slower (${r.current.toFixed(2)}ms vs ${r.baseline.toFixed(2)}ms)\n`;
    });
  }

  return summary;
}

async function main() {
  console.log('🚀 TW-Enigma CI Benchmarking Example\n');

  const ciEnv = detectCIEnvironment();
  console.log('🔍 CI Environment:');
  console.log(`  Provider: ${ciEnv.provider}`);
  console.log(`  Branch: ${ciEnv.branch}`);
  console.log(`  Commit: ${ciEnv.commitSha.slice(0, 8)}`);
  console.log(`  Is CI: ${ciEnv.isCI}\n`);

  // Create CI-optimized configuration
  const ciConfig = {
    iterations: ciEnv.isCI ? 20 : 50, // Fewer iterations in CI
    warmupIterations: ciEnv.isCI ? 5 : 10,
    timeout: 30000, // 30 second timeout
    
    parallel: {
      enabled: !ciEnv.isCI, // Disable parallel in CI for consistency
    },
    
    outputDirectory: './ci-benchmark-results',
    
    reporting: {
      formats: ['json', 'csv'] as const, // Lightweight formats for CI
      includeSystemInfo: true,
      includeDetailedMetrics: false,
    },
    
    validation: {
      checkSystemRequirements: false, // Skip in CI
      requireCleanEnvironment: ciEnv.isCI,
    },
  };

  // Create CI-optimized profiler
  const profiler = ciEnv.isCI ? undefined : createCIBenchmarkProfiler();
  
  // Create benchmark suite
  const suite = createCIBenchmarkSuite();
  
  // Run benchmarks
  console.log('📊 Running CI benchmarks...');
  const runner = new BenchmarkRunner(ciConfig, profiler);
  const results = await runner.runSuite(suite);
  
  console.log(`✅ Benchmarks completed: ${results.filter(r => r.success).length}/${results.length} passed\n`);

  // Baseline management
  const baselineManager = new BaselineManager();
  
  // Save baseline if on main branch
  if (ciEnv.branch === 'main') {
    await baselineManager.saveBaseline(results, ciEnv);
  }

  // Load baseline for comparison
  const baseline = await baselineManager.loadBaseline('main');
  
  // Check performance budgets
  const budgetChecker = new BudgetChecker();
  const budgetCheck = budgetChecker.checkBudgets(results);
  
  console.log('💰 Budget Check:');
  console.log(`  Status: ${budgetCheck.passed ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`  Violations: ${budgetCheck.violations.length}`);
  
  budgetCheck.violations.forEach(violation => {
    const emoji = violation.severity === 'error' ? '❌' : '⚠️';
    console.log(`    ${emoji} ${violation.benchmark} ${violation.type}: exceeded budget`);
  });

  // Check for regressions if baseline exists
  let regressionCheck = { passed: true, regressions: [] };
  if (baseline) {
    regressionCheck = budgetChecker.checkRegressions(results, baseline);
    
    console.log('\n📈 Regression Check:');
    console.log(`  Status: ${regressionCheck.passed ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`  Regressions: ${regressionCheck.regressions.length}`);
    
    regressionCheck.regressions.forEach(regression => {
      const emoji = regression.severity === 'error' ? '❌' : '⚠️';
      console.log(`    ${emoji} ${regression.benchmark}: ${regression.changePercent.toFixed(1)}% slower`);
    });
  } else {
    console.log('\n📈 Regression Check: ⏭️ SKIPPED (no baseline)');
  }

  // Generate CI summary
  const summary = generateCISummary(results, budgetCheck, regressionCheck, ciEnv);
  
  // Save summary for CI
  const summaryPath = './ci-benchmark-results/summary.md';
  await fs.mkdir(path.dirname(summaryPath), { recursive: true });
  await fs.writeFile(summaryPath, summary);
  
  console.log(`\n📄 CI summary saved: ${summaryPath}`);

  // Export results for CI artifacts
  if (profiler) {
    const exporter = createCIProfilingExporter();
    const profilingData = runner.getProfilingData();
    
    if (profilingData.length > 0) {
      await exporter.exportProfilingData(profilingData);
      console.log('📊 Profiling data exported');
    }
  }

  // GitHub Actions specific output
  if (ciEnv.provider === 'github') {
    // Set job summary
    if (process.env.GITHUB_STEP_SUMMARY) {
      await fs.appendFile(process.env.GITHUB_STEP_SUMMARY, summary);
    }
    
    // Set outputs
    console.log(`::set-output name=budget-passed::${budgetCheck.passed}`);
    console.log(`::set-output name=regression-passed::${regressionCheck.passed}`);
    console.log(`::set-output name=benchmark-count::${results.length}`);
  }

  // Final exit code
  const overallPassed = budgetCheck.passed && regressionCheck.passed;
  
  console.log(`\n🏁 Final Result: ${overallPassed ? '✅ PASS' : '❌ FAIL'}`);
  
  if (!overallPassed) {
    console.log('\n❌ Performance checks failed:');
    if (!budgetCheck.passed) {
      console.log('  - Performance budget violations detected');
    }
    if (!regressionCheck.passed) {
      console.log('  - Performance regressions detected');
    }
  }

  // Exit with appropriate code for CI
  process.exit(overallPassed ? 0 : 1);
}

// Error handling for CI
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled promise rejection:', reason);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught exception:', error);
  process.exit(1);
});

// Run the example
if (require.main === module) {
  main().catch(error => {
    console.error('❌ CI benchmark failed:', error);
    process.exit(1);
  });
}

export { main as runCIBenchmark };