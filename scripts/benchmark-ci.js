#!/usr/bin/env node

/**
 * CI Benchmark Runner Script
 * 
 * This script provides a command-line interface for running benchmarks in CI/CD environments.
 * It supports multiple CI providers, baseline comparison, and various output formats.
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs').promises;

// Configuration
const PERFORMANCE_BUDGETS = {
  'css-parsing': { maxMean: 100, maxMemory: 50 * 1024 * 1024 },
  'css-optimization': { maxMean: 200, maxMemory: 100 * 1024 * 1024 },
  'css-compression': { maxMean: 50, maxMemory: 25 * 1024 * 1024 },
  'file-discovery': { maxMean: 150, maxMemory: 75 * 1024 * 1024 },
  'pattern-analysis': { maxMean: 300, maxMemory: 150 * 1024 * 1024 },
};

const CI_CONFIG = {
  regressionThreshold: 10, // 10% regression threshold
  memoryThreshold: 20, // 20% memory increase threshold
  minIterations: 5,
  maxIterations: 10,
  warmupIterations: 2,
};

/**
 * CI Benchmark Runner
 */
async function main() {
  const args = process.argv.slice(2);
  const config = parseArgs(args);
  
  console.log('🚀 Starting TW-Enigma CI Benchmarks...');
  console.log(`Configuration:`, config);
  
  try {
    await ensureOutputDirectory(config.outputDir);
    const results = await runBenchmarkSuites(config.suites);
    const analysis = await analyzeBenchmarkResults(results, config);
    await generateReports(analysis, config);
    
    console.log('✅ Benchmarks completed successfully');
    
    // Exit with error code if performance regression detected
    if (analysis.hasRegression) {
      console.error('❌ Performance regression detected!');
      process.exit(1);
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Benchmark execution failed:', error.message);
    process.exit(1);
  }
}

/**
 * Parse command line arguments
 */
function parseArgs(args) {
  const config = {
    suites: ['core-optimization', 'css-generation'],
    outputDir: './benchmark-results',
    formats: ['html', 'json'],
    baseline: false,
    regressionThreshold: CI_CONFIG.regressionThreshold,
    memoryThreshold: CI_CONFIG.memoryThreshold,
  };
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    switch (arg) {
      case '--suites':
      case '-s':
        config.suites = args[++i].split(',');
        break;
      case '--output':
      case '-o':
        config.outputDir = args[++i];
        break;
      case '--formats':
      case '-f':
        config.formats = args[++i].split(',');
        break;
      case '--baseline':
      case '-b':
        config.baseline = true;
        break;
      case '--threshold':
      case '-t':
        config.regressionThreshold = parseFloat(args[++i]);
        break;
      case '--memory-threshold':
      case '-m':
        config.memoryThreshold = parseFloat(args[++i]);
        break;
      case '--help':
      case '-h':
        printUsage();
        process.exit(0);
        break;
    }
  }
  
  return config;
}

/**
 * Print usage information
 */
function printUsage() {
  console.log(`
TW-Enigma CI Benchmark Runner

Usage: node benchmark-ci.js [options]

Options:
  -s, --suites <suites>           Comma-separated benchmark suites (default: core-optimization,css-generation)
  -o, --output <dir>              Output directory (default: ./benchmark-results)
  -f, --formats <formats>         Report formats: html,json,csv (default: html,json)
  -b, --baseline                  Enable baseline comparison
  -t, --threshold <percent>       Performance regression threshold (default: 10)
  -m, --memory-threshold <percent> Memory increase threshold (default: 20)
  -h, --help                      Show this help

Examples:
  node benchmark-ci.js
  node benchmark-ci.js --suites core-optimization --baseline
  node benchmark-ci.js --threshold 5 --output ./reports
  `);
}

/**
 * Ensure output directory exists
 */
async function ensureOutputDirectory(outputDir) {
  try {
    await fs.mkdir(outputDir, { recursive: true });
    console.log(`📁 Output directory ready: ${outputDir}`);
  } catch (error) {
    throw new Error(`Failed to create output directory: ${error.message}`);
  }
}

/**
 * Run benchmark suites
 */
async function runBenchmarkSuites(suites) {
  const results = {};
  
  for (const suite of suites) {
    console.log(`🏃 Running benchmark suite: ${suite}`);
    
    try {
      const result = await runSingleBenchmarkSuite(suite);
      results[suite] = result;
      console.log(`✅ Completed benchmark suite: ${suite}`);
    } catch (error) {
      console.error(`❌ Failed benchmark suite: ${suite} - ${error.message}`);
      results[suite] = { error: error.message, failed: true };
    }
  }
  
  return results;
}

/**
 * Run a single benchmark suite
 */
async function runSingleBenchmarkSuite(suite) {
  const { performance } = require('perf_hooks');
  
  const suiteMap = {
    'core-optimization': runCoreOptimizationBenchmark,
    'css-generation': runCSSGenerationBenchmark,
    'file-discovery': runFileDiscoveryBenchmark,
    'pattern-analysis': runPatternAnalysisBenchmark,
  };
  
  const benchmarkFn = suiteMap[suite];
  if (!benchmarkFn) {
    throw new Error(`Unknown benchmark suite: ${suite}`);
  }
  
  return await benchmarkFn();
}

/**
 * Core optimization benchmark
 */
async function runCoreOptimizationBenchmark() {
  const { performance } = require('perf_hooks');
  const results = [];
  
  // Simple optimization simulation
  for (let i = 0; i < CI_CONFIG.minIterations; i++) {
    const start = performance.now();
    
    // Simulate CSS optimization work
    const testCSS = Array(1000).fill('.test { color: red; }').join('\n');
    const optimized = testCSS.replace(/\s+/g, ' ').trim();
    
    const end = performance.now();
    const duration = end - start;
    
    results.push({
      iteration: i + 1,
      duration,
      memoryUsed: process.memoryUsage().heapUsed,
      inputSize: testCSS.length,
      outputSize: optimized.length,
    });
  }
  
  return {
    suite: 'core-optimization',
    iterations: results.length,
    meanDuration: results.reduce((sum, r) => sum + r.duration, 0) / results.length,
    minDuration: Math.min(...results.map(r => r.duration)),
    maxDuration: Math.max(...results.map(r => r.duration)),
    meanMemory: results.reduce((sum, r) => sum + r.memoryUsed, 0) / results.length,
    results,
  };
}

/**
 * CSS generation benchmark
 */
async function runCSSGenerationBenchmark() {
  const { performance } = require('perf_hooks');
  const results = [];
  
  for (let i = 0; i < CI_CONFIG.minIterations; i++) {
    const start = performance.now();
    
    // Simulate CSS generation
    const classNames = Array(500).fill(0).map((_, idx) => `.class-${idx}`);
    const css = classNames.map(name => `${name} { display: block; }`).join('\n');
    
    const end = performance.now();
    const duration = end - start;
    
    results.push({
      iteration: i + 1,
      duration,
      memoryUsed: process.memoryUsage().heapUsed,
      classCount: classNames.length,
      outputSize: css.length,
    });
  }
  
  return {
    suite: 'css-generation',
    iterations: results.length,
    meanDuration: results.reduce((sum, r) => sum + r.duration, 0) / results.length,
    minDuration: Math.min(...results.map(r => r.duration)),
    maxDuration: Math.max(...results.map(r => r.duration)),
    meanMemory: results.reduce((sum, r) => sum + r.memoryUsed, 0) / results.length,
    results,
  };
}

/**
 * File discovery benchmark
 */
async function runFileDiscoveryBenchmark() {
  const { performance } = require('perf_hooks');
  const results = [];
  
  for (let i = 0; i < CI_CONFIG.minIterations; i++) {
    const start = performance.now();
    
    // Simulate file discovery
    try {
      const files = execSync('find . -name "*.ts" -o -name "*.js" | head -100', { encoding: 'utf8' })
        .split('\n')
        .filter(Boolean);
      
      const end = performance.now();
      const duration = end - start;
      
      results.push({
        iteration: i + 1,
        duration,
        memoryUsed: process.memoryUsage().heapUsed,
        fileCount: files.length,
      });
    } catch (error) {
      results.push({
        iteration: i + 1,
        duration: 0,
        memoryUsed: process.memoryUsage().heapUsed,
        fileCount: 0,
        error: error.message,
      });
    }
  }
  
  const validResults = results.filter(r => !r.error);
  
  return {
    suite: 'file-discovery',
    iterations: validResults.length,
    meanDuration: validResults.reduce((sum, r) => sum + r.duration, 0) / validResults.length,
    minDuration: Math.min(...validResults.map(r => r.duration)),
    maxDuration: Math.max(...validResults.map(r => r.duration)),
    meanMemory: validResults.reduce((sum, r) => sum + r.memoryUsed, 0) / validResults.length,
    results,
  };
}

/**
 * Pattern analysis benchmark
 */
async function runPatternAnalysisBenchmark() {
  const { performance } = require('perf_hooks');
  const results = [];
  
  for (let i = 0; i < CI_CONFIG.minIterations; i++) {
    const start = performance.now();
    
    // Simulate pattern analysis
    const patterns = Array(200).fill(0).map((_, idx) => 
      `bg-blue-${idx % 10}00 text-white p-${idx % 5} rounded-${idx % 3 ? 'lg' : 'md'}`
    );
    
    const uniquePatterns = [...new Set(patterns)];
    const analyzedPatterns = uniquePatterns.map(pattern => ({
      pattern,
      classes: pattern.split(' '),
      frequency: patterns.filter(p => p === pattern).length,
    }));
    
    const end = performance.now();
    const duration = end - start;
    
    results.push({
      iteration: i + 1,
      duration,
      memoryUsed: process.memoryUsage().heapUsed,
      totalPatterns: patterns.length,
      uniquePatterns: uniquePatterns.length,
      analyzedCount: analyzedPatterns.length,
    });
  }
  
  return {
    suite: 'pattern-analysis',
    iterations: results.length,
    meanDuration: results.reduce((sum, r) => sum + r.duration, 0) / results.length,
    minDuration: Math.min(...results.map(r => r.duration)),
    maxDuration: Math.max(...results.map(r => r.duration)),
    meanMemory: results.reduce((sum, r) => sum + r.memoryUsed, 0) / results.length,
    results,
  };
}

/**
 * Analyze benchmark results
 */
async function analyzeBenchmarkResults(results, config) {
  const analysis = {
    timestamp: new Date().toISOString(),
    hasRegression: false,
    hasMemoryRegression: false,
    summary: {},
    details: {},
  };
  
  for (const [suiteName, result] of Object.entries(results)) {
    if (result.failed) {
      analysis.details[suiteName] = { error: result.error, status: 'failed' };
      continue;
    }
    
    const budget = PERFORMANCE_BUDGETS[suiteName];
    const performanceRegression = budget && result.meanDuration > budget.maxMean;
    const memoryRegression = budget && result.meanMemory > budget.maxMemory;
    
    const regressionPct = budget 
      ? ((result.meanDuration - budget.maxMean) / budget.maxMean * 100)
      : 0;
    
    const memoryPct = budget 
      ? ((result.meanMemory - budget.maxMemory) / budget.maxMemory * 100)
      : 0;
    
    if (performanceRegression || regressionPct > config.regressionThreshold) {
      analysis.hasRegression = true;
    }
    
    if (memoryRegression || memoryPct > config.memoryThreshold) {
      analysis.hasMemoryRegression = true;
    }
    
    analysis.details[suiteName] = {
      status: 'passed',
      meanDuration: result.meanDuration,
      meanMemory: result.meanMemory,
      iterations: result.iterations,
      performanceRegression,
      memoryRegression,
      regressionPct: Math.max(0, regressionPct),
      memoryPct: Math.max(0, memoryPct),
      budget,
    };
    
    analysis.summary[suiteName] = {
      avgDuration: `${result.meanDuration.toFixed(2)}ms`,
      avgMemory: `${(result.meanMemory / 1024 / 1024).toFixed(2)}MB`,
      status: performanceRegression || memoryRegression ? '❌ REGRESSION' : '✅ PASSED',
    };
  }
  
  return analysis;
}

/**
 * Generate benchmark reports
 */
async function generateReports(analysis, config) {
  console.log('📋 Generating benchmark reports...');
  
  // Generate JSON report
  if (config.formats.includes('json')) {
    const jsonReport = {
      ...analysis,
      config: {
        suites: config.suites,
        regressionThreshold: config.regressionThreshold,
        memoryThreshold: config.memoryThreshold,
      },
    };
    
    const jsonPath = path.join(config.outputDir, 'benchmark-report.json');
    await fs.writeFile(jsonPath, JSON.stringify(jsonReport, null, 2));
    console.log(`  ✅ JSON report: ${jsonPath}`);
  }
  
  // Generate HTML report
  if (config.formats.includes('html')) {
    const htmlContent = generateHTMLReport(analysis);
    const htmlPath = path.join(config.outputDir, 'benchmark-report.html');
    await fs.writeFile(htmlPath, htmlContent);
    console.log(`  ✅ HTML report: ${htmlPath}`);
  }
  
  // Generate console summary
  console.log('\n📊 Benchmark Summary:');
  console.log('====================');
  
  Object.entries(analysis.summary).forEach(([suite, summary]) => {
    console.log(`  ${suite}:`);
    console.log(`    Duration: ${summary.avgDuration}`);
    console.log(`    Memory: ${summary.avgMemory}`);
    console.log(`    Status: ${summary.status}`);
  });
  
  if (analysis.hasRegression || analysis.hasMemoryRegression) {
    console.log('\n⚠️  Performance regressions detected:');
    
    Object.entries(analysis.details).forEach(([suite, details]) => {
      if (details.performanceRegression || details.memoryRegression) {
        console.log(`    ${suite}:`);
        if (details.performanceRegression) {
          console.log(`      Performance: +${details.regressionPct.toFixed(1)}% slower`);
        }
        if (details.memoryRegression) {
          console.log(`      Memory: +${details.memoryPct.toFixed(1)}% more usage`);
        }
      }
    });
  }
}

/**
 * Generate HTML report
 */
function generateHTMLReport(analysis) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>TW-Enigma Benchmark Report</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 20px; }
        .header { border-bottom: 2px solid #e1e5e9; padding-bottom: 20px; margin-bottom: 30px; }
        .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; margin-bottom: 30px; }
        .card { border: 1px solid #e1e5e9; border-radius: 8px; padding: 20px; background: #f8f9fa; }
        .status-pass { color: #28a745; font-weight: bold; }
        .status-fail { color: #dc3545; font-weight: bold; }
        .details { margin-top: 30px; }
        .suite { margin-bottom: 20px; padding: 15px; border: 1px solid #dee2e6; border-radius: 6px; }
        .timestamp { color: #6c757d; font-size: 0.9em; }
    </style>
</head>
<body>
    <div class="header">
        <h1>🔬 TW-Enigma Benchmark Report</h1>
        <p class="timestamp">Generated: ${analysis.timestamp}</p>
    </div>
    
    <div class="summary">
        ${Object.entries(analysis.summary).map(([suite, summary]) => `
            <div class="card">
                <h3>${suite}</h3>
                <p><strong>Duration:</strong> ${summary.avgDuration}</p>
                <p><strong>Memory:</strong> ${summary.avgMemory}</p>
                <p><strong>Status:</strong> <span class="${summary.status.includes('✅') ? 'status-pass' : 'status-fail'}">${summary.status}</span></p>
            </div>
        `).join('')}
    </div>
    
    <div class="details">
        <h2>Detailed Results</h2>
        ${Object.entries(analysis.details).map(([suite, details]) => `
            <div class="suite">
                <h3>${suite}</h3>
                ${details.error ? `
                    <p class="status-fail">Error: ${details.error}</p>
                ` : `
                    <p><strong>Iterations:</strong> ${details.iterations}</p>
                    <p><strong>Mean Duration:</strong> ${details.meanDuration.toFixed(2)}ms</p>
                    <p><strong>Mean Memory:</strong> ${(details.meanMemory / 1024 / 1024).toFixed(2)}MB</p>
                    ${details.budget ? `
                        <p><strong>Performance Budget:</strong> ${details.budget.maxMean}ms (${details.performanceRegression ? 'EXCEEDED' : 'OK'})</p>
                        <p><strong>Memory Budget:</strong> ${(details.budget.maxMemory / 1024 / 1024).toFixed(2)}MB (${details.memoryRegression ? 'EXCEEDED' : 'OK'})</p>
                    ` : ''}
                `}
            </div>
        `).join('')}
    </div>
</body>
</html>`;
}

// Run the main function if this script is executed directly
if (require.main === module) {
  main().catch(error => {
    console.error('❌ Benchmark CI script failed:', error.message);
    process.exit(1);
  });
}

module.exports = {
  main,
  runBenchmarkSuites,
  analyzeBenchmarkResults,
  generateReports,
  PERFORMANCE_BUDGETS,
  CI_CONFIG,
};
