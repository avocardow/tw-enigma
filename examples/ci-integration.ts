/**
 * CI/CD Integration Example
 * 
 * This example demonstrates how to integrate TW-Enigma dry run and performance testing
 * into CI/CD pipelines including GitHub Actions, GitLab CI, and Jenkins.
 */

import {
  getPerformanceTestRunner,
  createDryRunConfig,
  withDryRun,
  getDryRunReportGenerator,
  getOutputManager,
  PerformanceTestRunner,
  RegressionTestConfig,
  ContinuousIntegrationConfig,
  TestResult
} from '@tw-enigma/core';

/**
 * Main CI integration example
 */
async function ciIntegrationExample() {
  console.log('🚀 CI/CD Integration Example');
  console.log('============================\n');

  // Detect CI environment
  const ciEnvironment = detectCIEnvironment();
  console.log(`📋 Detected CI Environment: ${ciEnvironment}\n`);

  try {
    // Run different CI workflows
    await githubActionsWorkflow();
    await gitlabCIWorkflow();
    await jenkinsWorkflow();
    await genericCIWorkflow();
    await pullRequestValidation();

    console.log('\n✅ All CI integration examples completed successfully!');

  } catch (error) {
    console.error('❌ CI integration failed:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

/**
 * GitHub Actions workflow example
 */
async function githubActionsWorkflow(): Promise<void> {
  console.log('🐙 GitHub Actions Workflow');
  console.log('==========================\n');

  // Simulate GitHub Actions environment
  process.env.GITHUB_ACTIONS = 'true';
  process.env.GITHUB_EVENT_NAME = 'pull_request';
  process.env.GITHUB_REF = 'refs/pull/123/merge';

  console.log('📊 Running GitHub Actions checks...');

  try {
    // Step 1: Validate configuration
    await validateConfiguration();

    // Step 2: Run dry run analysis
    const dryRunResult = await runDryRunForCI({
      projectRoot: './src',
      optimizationLevel: 'aggressive',
      reportFormat: 'json',
      outputPath: './github-actions-dry-run.json',
    });

    // Step 3: Run performance regression tests
    const perfResult = await runPerformanceRegression({
      baselinePath: './performance-baseline.json',
      maxRegression: 15,
      outputFormat: 'junit',
      outputPath: './performance-results.xml',
    });

    // Step 4: Generate artifacts
    await generateCIArtifacts({
      dryRunResult,
      performanceResult: perfResult,
      environment: 'github-actions',
    });

    console.log('✅ GitHub Actions workflow completed successfully\n');

  } catch (error) {
    console.error('❌ GitHub Actions workflow failed:', error);
    setGitHubActionsOutput('result', 'failure');
    setGitHubActionsOutput('error', error instanceof Error ? error.message : String(error));
    throw error;
  }
}

/**
 * GitLab CI workflow example
 */
async function gitlabCIWorkflow(): Promise<void> {
  console.log('🦊 GitLab CI Workflow');
  console.log('=====================\n');

  // Simulate GitLab CI environment
  process.env.GITLAB_CI = 'true';
  process.env.CI_PIPELINE_ID = '12345';
  process.env.CI_MERGE_REQUEST_ID = '67';

  console.log('📊 Running GitLab CI checks...');

  try {
    // Step 1: Pre-flight checks
    await preflightChecks();

    // Step 2: Parallel dry run execution
    const results = await Promise.all([
      runDryRunForCI({
        projectRoot: './frontend',
        optimizationLevel: 'aggressive',
        reportFormat: 'html',
        outputPath: './gitlab-frontend-dry-run.html',
      }),
      runDryRunForCI({
        projectRoot: './backend/styles',
        optimizationLevel: 'basic',
        reportFormat: 'json',
        outputPath: './gitlab-backend-dry-run.json',
      }),
    ]);

    // Step 3: Merge request performance impact
    await analyzeMergeRequestImpact(results);

    console.log('✅ GitLab CI workflow completed successfully\n');

  } catch (error) {
    console.error('❌ GitLab CI workflow failed:', error);
    // Set GitLab CI variables for failure handling
    throw error;
  }
}

/**
 * Jenkins workflow example
 */
async function jenkinsWorkflow(): Promise<void> {
  console.log('🏗️  Jenkins Workflow');
  console.log('===================\n');

  // Simulate Jenkins environment
  process.env.JENKINS_URL = 'true';
  process.env.BUILD_NUMBER = '456';
  process.env.JOB_NAME = 'tw-enigma-performance-test';

  console.log('📊 Running Jenkins build...');

  try {
    // Step 1: Environment setup
    await setupJenkinsEnvironment();

    // Step 2: Build stage - dry run validation
    console.log('🔧 Build Stage: Dry Run Validation');
    const buildResult = await runDryRunForCI({
      projectRoot: process.env.WORKSPACE || './src',
      optimizationLevel: 'production',
      reportFormat: 'xml',
      outputPath: './jenkins-build-report.xml',
    });

    // Step 3: Test stage - performance benchmarks
    console.log('🧪 Test Stage: Performance Benchmarks');
    const testResult = await runPerformanceBenchmark({
      scenarios: ['smoke', 'regression'],
      outputFormat: 'junit',
      archiveResults: true,
    });

    // Step 4: Deploy stage preparation
    console.log('🚀 Deploy Stage: Artifact Preparation');
    await prepareDeploymentArtifacts({
      buildResult,
      testResult,
      environment: 'jenkins',
    });

    console.log('✅ Jenkins workflow completed successfully\n');

  } catch (error) {
    console.error('❌ Jenkins workflow failed:', error);
    // Mark Jenkins build as unstable/failed
    throw error;
  }
}

/**
 * Generic CI workflow for other platforms
 */
async function genericCIWorkflow(): Promise<void> {
  console.log('🔧 Generic CI Workflow');
  console.log('======================\n');

  console.log('📊 Running generic CI checks...');

  const config = {
    projectRoot: './src',
    optimizationLevel: process.env.NODE_ENV === 'production' ? 'extreme' : 'aggressive',
    enableRegression: true,
    generateArtifacts: true,
    parallelExecution: process.env.CI_PARALLEL === 'true',
  };

  try {
    // Step 1: Configuration validation
    await validateEnvironment(config);

    // Step 2: Dry run execution
    const dryRunPromise = runDryRunForCI({
      projectRoot: config.projectRoot,
      optimizationLevel: config.optimizationLevel,
      reportFormat: 'both', // Generate both HTML and JSON
      outputPath: './ci-dry-run',
    });

    // Step 3: Performance testing (can run in parallel)
    const perfPromise = config.parallelExecution 
      ? runPerformanceRegression({
          baselinePath: './ci-baseline.json',
          maxRegression: 20,
          outputFormat: 'json',
          outputPath: './ci-performance.json',
        })
      : Promise.resolve(null);

    // Wait for both to complete
    const [dryRunResult, perfResult] = await Promise.all([dryRunPromise, perfPromise]);

    // Step 4: Results analysis
    await analyzeResults({
      dryRun: dryRunResult,
      performance: perfResult,
      config,
    });

    console.log('✅ Generic CI workflow completed successfully\n');

  } catch (error) {
    console.error('❌ Generic CI workflow failed:', error);
    throw error;
  }
}

/**
 * Pull request validation workflow
 */
async function pullRequestValidation(): Promise<void> {
  console.log('🔍 Pull Request Validation');
  console.log('==========================\n');

  const prNumber = process.env.GITHUB_PR_NUMBER || process.env.CI_MERGE_REQUEST_ID || '123';
  console.log(`📋 Validating PR #${prNumber}...\n`);

  try {
    // Step 1: Quick smoke test
    console.log('💨 Running smoke tests...');
    const smokeResult = await runQuickValidation();

    if (!smokeResult.passed) {
      throw new Error(`Smoke test failed: ${smokeResult.reason}`);
    }

    // Step 2: Performance impact analysis
    console.log('⚡ Analyzing performance impact...');
    const impactAnalysis = await analyzePerformanceImpact({
      baseline: './pr-baseline.json',
      threshold: 10, // 10% regression threshold for PRs
    });

    // Step 3: Generate PR comment
    const comment = generatePRComment({
      smokeResult,
      impactAnalysis,
      dryRunSummary: await getDryRunSummary(),
    });

    console.log('📝 PR Validation Summary:');
    console.log(comment);

    // In real implementation, this would post to GitHub/GitLab API
    await simulateCommentPost(prNumber, comment);

    console.log('✅ Pull request validation completed\n');

  } catch (error) {
    console.error('❌ Pull request validation failed:', error);
    
    // Post failure comment
    const failureComment = `❌ **TW-Enigma Validation Failed**\n\nError: ${error instanceof Error ? error.message : error}\n\nPlease review the changes and try again.`;
    await simulateCommentPost(prNumber, failureComment);
    
    throw error;
  }
}

/**
 * Utility functions for CI operations
 */

async function validateConfiguration(): Promise<void> {
  console.log('🔍 Validating configuration...');
  await new Promise(resolve => setTimeout(resolve, 500));
  console.log('✅ Configuration valid');
}

async function runDryRunForCI(options: {
  projectRoot: string;
  optimizationLevel: string;
  reportFormat: string;
  outputPath: string;
}): Promise<any> {
  console.log(`🧪 Running dry run for ${options.projectRoot}...`);

  const config = createDryRunConfig({
    enabled: true,
    maxOperations: 5000,
    logOperations: false, // Reduce noise in CI
    validateOperations: true,
    operationTimeout: 10000, // Longer timeout for CI
  });

  const result = await withDryRun(
    {
      projectRoot: options.projectRoot,
      optimizationLevel: options.optimizationLevel,
    },
    async () => {
      // Simulate optimization operations
      await new Promise(resolve => setTimeout(resolve, 1000));
      return 'CI dry run completed';
    },
    config
  );

  // Generate report
  const reportGenerator = getDryRunReportGenerator();
  const report = reportGenerator.generateReport(result.dryRunResult, {
    format: options.reportFormat,
    includeOperationDetails: false, // Reduce size for CI
    includeMetrics: true,
  });

  // Save to specified path
  const outputManager = getOutputManager();
  await outputManager.outputCombinedResults(
    { dryRunResult: result.dryRunResult, report },
    {
      destinations: [{ type: 'file', path: options.outputPath }],
      format: { type: options.reportFormat as any },
    }
  );

  console.log(`✅ Dry run completed, report saved to ${options.outputPath}`);
  return result;
}

async function runPerformanceRegression(options: {
  baselinePath: string;
  maxRegression: number;
  outputFormat: string;
  outputPath: string;
}): Promise<TestResult> {
  console.log('⚡ Running performance regression tests...');

  const runner = getPerformanceTestRunner();
  const suites = runner.createStandardTestSuites();
  const regressionSuite = suites.find(suite => suite.name === 'regression');

  if (!regressionSuite) {
    throw new Error('No regression test suite available');
  }

  const regressionConfig: RegressionTestConfig = {
    baselinePath: options.baselinePath,
    maxRegression: options.maxRegression,
    metricsToCheck: ['executionTime', 'memoryUsage'],
    updateBaselineOnImprovement: false, // Don't auto-update in CI
    failOnRegression: true,
  };

  const ciConfig: ContinuousIntegrationConfig = {
    enabled: true,
    outputFormat: options.outputFormat as any,
    resultsPath: options.outputPath,
    uploadResults: false,
    failFast: true,
  };

  const result = await runner.runTestSuite(regressionSuite, {
    regressionTest: regressionConfig,
    ciConfig: ciConfig,
  });

  console.log(`✅ Performance tests completed: ${result.status}`);
  return result;
}

async function generateCIArtifacts(options: {
  dryRunResult: any;
  performanceResult: TestResult;
  environment: string;
}): Promise<void> {
  console.log('📦 Generating CI artifacts...');

  const artifacts = {
    timestamp: new Date().toISOString(),
    environment: options.environment,
    dryRun: {
      operations: options.dryRunResult.dryRunResult.totalOperations,
      duration: options.dryRunResult.dryRunResult.duration,
      status: 'completed',
    },
    performance: {
      testsRun: options.performanceResult.testsRun,
      testsPassed: options.performanceResult.testsPassed,
      status: options.performanceResult.status,
    },
  };

  // In real implementation, would upload to artifact storage
  console.log('📊 Artifact summary:', JSON.stringify(artifacts, null, 2));
  console.log('✅ Artifacts generated');
}

function detectCIEnvironment(): string {
  if (process.env.GITHUB_ACTIONS) return 'GitHub Actions';
  if (process.env.GITLAB_CI) return 'GitLab CI';
  if (process.env.JENKINS_URL) return 'Jenkins';
  if (process.env.CIRCLECI) return 'CircleCI';
  if (process.env.TRAVIS) return 'Travis CI';
  if (process.env.CI) return 'Generic CI';
  return 'Local Development';
}

function setGitHubActionsOutput(name: string, value: string): void {
  if (process.env.GITHUB_ACTIONS) {
    console.log(`::set-output name=${name}::${value}`);
  }
}

async function preflightChecks(): Promise<void> {
  console.log('🛫 Running preflight checks...');
  await new Promise(resolve => setTimeout(resolve, 300));
  console.log('✅ Preflight checks passed');
}

async function analyzeMergeRequestImpact(results: any[]): Promise<void> {
  console.log('🔍 Analyzing merge request impact...');
  
  const totalOperations = results.reduce((sum, result) => 
    sum + (result.dryRunResult?.totalOperations || 0), 0);
  
  console.log(`📊 Total operations across all modules: ${totalOperations}`);
  console.log('✅ Impact analysis completed');
}

async function setupJenkinsEnvironment(): Promise<void> {
  console.log('🔧 Setting up Jenkins environment...');
  await new Promise(resolve => setTimeout(resolve, 200));
  console.log('✅ Jenkins environment ready');
}

async function runPerformanceBenchmark(options: {
  scenarios: string[];
  outputFormat: string;
  archiveResults: boolean;
}): Promise<TestResult> {
  console.log(`🧪 Running performance benchmark: ${options.scenarios.join(', ')}`);
  
  // Mock test result
  const result: TestResult = {
    status: 'passed',
    testsRun: options.scenarios.length,
    testsPassed: options.scenarios.length,
    testsFailed: 0,
    duration: 5000,
    failures: [],
  };

  if (options.archiveResults) {
    console.log('📦 Archiving benchmark results...');
  }

  console.log('✅ Performance benchmark completed');
  return result;
}

async function prepareDeploymentArtifacts(options: {
  buildResult: any;
  testResult: TestResult;
  environment: string;
}): Promise<void> {
  console.log('🚀 Preparing deployment artifacts...');
  
  const manifest = {
    build: {
      status: 'success',
      operations: options.buildResult.dryRunResult?.totalOperations || 0,
    },
    tests: {
      status: options.testResult.status,
      passed: options.testResult.testsPassed,
      total: options.testResult.testsRun,
    },
    environment: options.environment,
    timestamp: new Date().toISOString(),
  };

  console.log('📄 Deployment manifest:', JSON.stringify(manifest, null, 2));
  console.log('✅ Deployment artifacts ready');
}

async function validateEnvironment(config: any): Promise<void> {
  console.log('🔍 Validating environment...');
  console.log(`Configuration: ${JSON.stringify(config, null, 2)}`);
  await new Promise(resolve => setTimeout(resolve, 300));
  console.log('✅ Environment validation passed');
}

async function analyzeResults(options: {
  dryRun: any;
  performance: any;
  config: any;
}): Promise<void> {
  console.log('📊 Analyzing results...');
  
  const summary = {
    dryRunOperations: options.dryRun?.dryRunResult?.totalOperations || 0,
    performanceStatus: options.performance?.status || 'skipped',
    configLevel: options.config.optimizationLevel,
  };

  console.log('📈 Results summary:', summary);
  console.log('✅ Analysis completed');
}

async function runQuickValidation(): Promise<{ passed: boolean; reason?: string }> {
  console.log('💨 Running quick validation...');
  await new Promise(resolve => setTimeout(resolve, 500));
  
  // Mock validation result
  return { passed: true };
}

async function analyzePerformanceImpact(options: {
  baseline: string;
  threshold: number;
}): Promise<{ regression: number; status: string }> {
  console.log('⚡ Analyzing performance impact...');
  await new Promise(resolve => setTimeout(resolve, 800));
  
  // Mock impact analysis
  const regression = Math.random() * 5; // 0-5% regression
  const status = regression > options.threshold ? 'warning' : 'good';
  
  return { regression, status };
}

async function getDryRunSummary(): Promise<{ operations: number; issues: number }> {
  return { operations: 150, issues: 0 };
}

function generatePRComment(options: {
  smokeResult: any;
  impactAnalysis: any;
  dryRunSummary: any;
}): string {
  return `## 🔍 TW-Enigma Analysis Results

### ✅ Smoke Tests
All smoke tests passed successfully.

### ⚡ Performance Impact
- Performance regression: ${options.impactAnalysis.regression.toFixed(2)}%
- Status: ${options.impactAnalysis.status === 'good' ? '✅ Good' : '⚠️ Warning'}

### 🧪 Dry Run Summary
- Operations simulated: ${options.dryRunSummary.operations}
- Issues found: ${options.dryRunSummary.issues}

### 📊 Recommendation
${options.impactAnalysis.status === 'good' 
  ? '✅ **Ready to merge** - No significant performance impact detected.'
  : '⚠️ **Review recommended** - Performance impact detected, please review changes.'
}

---
*Generated by TW-Enigma CI/CD Integration*`;
}

async function simulateCommentPost(prNumber: string, comment: string): Promise<void> {
  console.log(`💬 Posting comment to PR #${prNumber}:`);
  console.log('---');
  console.log(comment);
  console.log('---');
  console.log('✅ Comment posted (simulated)');
}

// Run the example
if (require.main === module) {
  ciIntegrationExample().catch((error) => {
    console.error('CI Integration example failed:', error);
    process.exit(1);
  });
}

export { 
  ciIntegrationExample,
  githubActionsWorkflow,
  gitlabCIWorkflow,
  jenkinsWorkflow,
  genericCIWorkflow,
  pullRequestValidation
};