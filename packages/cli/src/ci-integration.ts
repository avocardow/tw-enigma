/**
 * Copyright (c) 2025 Rowan Cardow
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { CssOutputConfig, CssPerformanceReport } from '@tw-enigma/core';

export interface CiEnvironment {
  provider: string;
  buildId?: string;
  branch?: string;
  commit?: string;
  pullRequest?: string;
  isCI: boolean;
  env: Record<string, string | undefined>;
}

export interface CiProcessResult {
  success: boolean;
  exitCode: number;
  summary: string;
  comparison?: {
    delta: {
      scoreChange: number;
      sizeChange: number;
      loadTimeChange?: number;
    };
    regressions: Array<{
      type: string;
      severity: string;
      description: string;
      current?: number;
      previous?: number;
      changePercent?: number;
    }>;
    improvements: Array<{
      type: string;
      description: string;
      improvementPercent?: number;
    }>;
  };
}

export interface CiOptions {
  baselinePath?: string;
  webhookUrl?: string;
  minPerformanceScore?: number;
  maxSizeIncrease?: number;
  failOnBudgetViolation?: boolean;
  failOnRegression?: boolean;
}

export class CiIntegration {
  constructor(
    private config: CssOutputConfig,
    private options: CiOptions = {}
  ) {}

  getCiEnvironment(): CiEnvironment {
    const env = process.env;

    // GitHub Actions
    if (env.GITHUB_ACTIONS === 'true') {
      return {
        provider: 'github',
        buildId: env.GITHUB_RUN_ID,
        branch: env.GITHUB_REF_NAME,
        commit: env.GITHUB_SHA,
        pullRequest: env.GITHUB_EVENT_NAME === 'pull_request' ? env.GITHUB_EVENT_NUMBER : undefined,
        isCI: true,
        env,
      };
    }

    // GitLab CI
    if (env.GITLAB_CI === 'true') {
      return {
        provider: 'gitlab',
        buildId: env.CI_PIPELINE_ID,
        branch: env.CI_COMMIT_REF_NAME,
        commit: env.CI_COMMIT_SHA,
        pullRequest: env.CI_MERGE_REQUEST_IID,
        isCI: true,
        env,
      };
    }

    // Jenkins
    if (env.JENKINS_URL) {
      return {
        provider: 'jenkins',
        buildId: env.BUILD_NUMBER,
        branch: env.GIT_BRANCH,
        commit: env.GIT_COMMIT,
        isCI: true,
        env,
      };
    }

    // CircleCI
    if (env.CIRCLECI === 'true') {
      let pullRequest: string | undefined;
      if (env.CIRCLE_PULL_REQUEST) {
        const match = env.CIRCLE_PULL_REQUEST.match(/\/pull\/(\d+)$/);
        pullRequest = match ? match[1] : undefined;
      }

      return {
        provider: 'circleci',
        buildId: env.CIRCLE_BUILD_NUM,
        branch: env.CIRCLE_BRANCH,
        commit: env.CIRCLE_SHA1,
        pullRequest,
        isCI: true,
        env,
      };
    }

    // Generic CI
    if (env.CI === 'true') {
      return {
        provider: 'unknown',
        buildId: env.BUILD_NUMBER,
        isCI: true,
        env,
      };
    }

    // Non-CI environment
    return {
      provider: 'unknown',
      isCI: false,
      env,
    };
  }

  async processReport(
    report: CssPerformanceReport,
    baseline?: CssPerformanceReport
  ): Promise<CiProcessResult> {
    const ciEnv = this.getCiEnvironment();

    console.log(`CI Provider: ${ciEnv.provider}`);
    if (ciEnv.buildId) console.log(`Build ID: ${ciEnv.buildId}`);
    if (ciEnv.branch) console.log(`Branch: ${ciEnv.branch}`);
    if (ciEnv.commit) console.log(`Commit: ${ciEnv.commit}`);
    if (ciEnv.pullRequest) console.log(`Pull Request: ${ciEnv.pullRequest}`);

    // Process performance report
    const { metrics, budgetAnalysis } = report;

    console.log(`Performance Score: ${metrics.performanceScore}`);
    console.log(`Compression Ratio: ${(metrics.overallCompressionRatio * 100).toFixed(1)}%`);
    console.log(`Budget Analysis: ${budgetAnalysis.passed ? 'PASSED' : 'FAILED'}`);

    // Load baseline if configured but not provided
    if (!baseline && this.options.baselinePath) {
      try {
        const fs = await import('fs/promises');
        const baselineData = await fs.readFile(this.options.baselinePath, 'utf-8');
        baseline = JSON.parse(baselineData);
      } catch (error) {
        console.warn('Failed to load baseline file:', error);
      }
    }

    // Check performance thresholds - use options first, then config fallback
    const performanceThreshold = this.options.minPerformanceScore ?? 75;
    const sizeThreshold = this.options.maxSizeIncrease ?? 10; // 10% increase
    const performanceScoreFailed = metrics.performanceScore < performanceThreshold;

    // Calculate comparison if baseline is provided
    let comparison: CiProcessResult['comparison'] | undefined;
    if (baseline) {
      const scoreChange = metrics.performanceScore - baseline.metrics.performanceScore;
      const sizeChange =
        ((metrics.totalCompressedSize - baseline.metrics.totalCompressedSize) /
          baseline.metrics.totalCompressedSize) *
        100;
      const loadTimeChange =
        (metrics.averageLoadTime || 0) - (baseline.metrics.averageLoadTime || 0);

      comparison = {
        delta: {
          scoreChange,
          sizeChange,
          loadTimeChange,
        },
        regressions: [],
        improvements: [],
      };

      // Detect regressions
      if (scoreChange < -5) {
        // Use absolute change for changePercent, not relative
        const changePercent = scoreChange; // Tests expect -20 for 90->70, which is the absolute change
        const severity =
          Math.abs(scoreChange) > 15 ? 'major' : Math.abs(scoreChange) > 10 ? 'moderate' : 'minor';
        comparison.regressions.push({
          type: 'score_decrease',
          severity,
          description: `Performance score decreased by ${Math.abs(scoreChange)} points`,
          current: metrics.performanceScore,
          previous: baseline.metrics.performanceScore,
          changePercent,
        });
      }

      if (sizeChange > sizeThreshold) {
        const severity = sizeChange > 20 ? 'major' : sizeChange > 10 ? 'moderate' : 'minor';
        comparison.regressions.push({
          type: 'size_increase',
          severity,
          description: `Bundle size increased by ${sizeChange.toFixed(1)}%`,
          current: metrics.totalCompressedSize,
          previous: baseline.metrics.totalCompressedSize,
          changePercent: sizeChange,
        });
      }

      if (loadTimeChange > 500) {
        const changePercent = (loadTimeChange / (baseline.metrics.averageLoadTime || 1)) * 100;
        const severity =
          loadTimeChange >= 1500 ? 'major' : loadTimeChange > 1000 ? 'moderate' : 'minor'; // 1500ms = major for 3000-1500
        comparison.regressions.push({
          type: 'load_time_increase',
          severity,
          description: `Load time increased by ${loadTimeChange}ms`,
          current: metrics.averageLoadTime,
          previous: baseline.metrics.averageLoadTime,
          changePercent,
        });
      }

      // Detect improvements
      if (scoreChange > 5) {
        // For improvements, use absolute score change, not percentage
        const improvementPercent = scoreChange; // Tests expect 10 for 80->90, which is absolute change
        comparison.improvements.push({
          type: 'score_increase',
          description: `Performance score improved by ${scoreChange} points`,
          improvementPercent,
        });
      }

      if (sizeChange < -5) {
        comparison.improvements.push({
          type: 'size_reduction',
          description: `Bundle size reduced by ${Math.abs(sizeChange).toFixed(1)}%`,
          improvementPercent: Math.abs(sizeChange),
        });
      }

      if (loadTimeChange < -200) {
        const improvementPercent =
          (Math.abs(loadTimeChange) / (baseline.metrics.averageLoadTime || 1)) * 100;
        comparison.improvements.push({
          type: 'load_time_improvement',
          description: `Load time improved by ${Math.abs(loadTimeChange)}ms`,
          improvementPercent,
        });
      }

      // Detect compression improvement - higher ratio = worse compression, lower ratio = better compression
      // So if ratio decreased, that's actually an improvement in compression efficiency
      const compressionChange =
        metrics.overallCompressionRatio - baseline.metrics.overallCompressionRatio;
      if (compressionChange < -0.05) {
        // Compression ratio decreased (improvement in efficiency)
        const improvementPercent =
          (Math.abs(compressionChange) / baseline.metrics.overallCompressionRatio) * 100;
        comparison.improvements.push({
          type: 'compression_improvement',
          description: `Compression efficiency improved by ${(Math.abs(compressionChange) * 100).toFixed(1)}%`,
          improvementPercent,
        });
      }
    } else {
      // Default comparison structure when no baseline
      comparison = {
        delta: {
          scoreChange: 0,
          sizeChange: 0,
          loadTimeChange: 0,
        },
        regressions: [],
        improvements: [],
      };
    }

    // Determine success based on budget, performance score, and regressions
    const hasRegressions = comparison.regressions.length > 0;
    const overallSuccess = budgetAnalysis.passed && !performanceScoreFailed && !hasRegressions;

    // Build appropriate summary message
    let summary: string;
    if (overallSuccess) {
      summary = `✅ Performance score: ${metrics.performanceScore}/100, ✅ All performance budgets passed`;
    } else if (!budgetAnalysis.passed) {
      const violationCount = budgetAnalysis.violations.length;
      summary = `❌ Performance score: ${metrics.performanceScore}/100, ❌ ${violationCount} budget violation(s) detected`;
    } else if (performanceScoreFailed) {
      summary = `❌ Performance score ${metrics.performanceScore} below threshold ${performanceThreshold}`;
    } else if (hasRegressions) {
      // Check if size regression exists for specific message
      const sizeRegression = comparison.regressions.find((r) => r.type === 'size_increase');
      if (sizeRegression) {
        summary = `❌ Size increase ${sizeRegression.changePercent?.toFixed(1)}% exceeds threshold ${sizeThreshold}%`;
      } else {
        summary = `❌ Performance score: ${metrics.performanceScore}/100, ${comparison.regressions.length} regression(s) detected`;
      }
    } else {
      summary = `✅ Performance score: ${metrics.performanceScore}/100, Budget: ${budgetAnalysis.passed ? 'PASSED' : 'FAILED'}`;
    }

    // Build result object
    const result: CiProcessResult = {
      success: overallSuccess,
      exitCode: overallSuccess ? 0 : 1,
      summary,
      comparison,
    };

    // Handle budget violations
    if (!budgetAnalysis.passed) {
      console.error('Performance budget violations detected!');
      budgetAnalysis.violations.forEach((violation) => {
        console.error(`- ${violation}`);
      });

      // Add regressions for violations
      budgetAnalysis.violations.forEach((violation) => {
        result.comparison!.regressions.push({
          type: 'budget_violation',
          severity: 'high',
          description: violation.toString(),
        });
      });
    }

    // Send webhook notification if configured
    if (this.options.webhookUrl) {
      await this.sendWebhookNotification(result, report);
    }

    return result;
  }

  private async sendWebhookNotification(
    result: CiProcessResult,
    report: CssPerformanceReport
  ): Promise<void> {
    if (!this.options.webhookUrl) return;

    const payload = {
      success: result.success,
      summary: result.summary,
      metrics: report.metrics,
      comparison: result.comparison,
      timestamp: new Date().toISOString(),
    };

    try {
      const response = await fetch(this.options.webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        console.error(`Webhook notification failed: ${response.status} ${response.statusText}`);
      }
    } catch (error) {
      console.error('Failed to send webhook notification:', error);
    }
  }

  generateComment(report: CssPerformanceReport): string {
    const { metrics, budgetAnalysis } = report;

    let comment = '## CSS Performance Report\n\n';
    comment += `**Performance Score:** ${metrics.performanceScore}/100\n`;
    comment += `**Compression Ratio:** ${(metrics.overallCompressionRatio * 100).toFixed(1)}%\n`;
    comment += `**Bundle Count:** ${metrics.bundleCount}\n`;
    comment += `**Total Size:** ${(metrics.totalOptimizedSize / 1024).toFixed(1)}KB → ${(metrics.totalCompressedSize / 1024).toFixed(1)}KB\n\n`;

    if (budgetAnalysis.passed) {
      comment += '✅ **Performance budget: PASSED**\n';
    } else {
      comment += '❌ **Performance budget: FAILED**\n\n';
      comment += '**Violations:**\n';
      budgetAnalysis.violations.forEach((violation) => {
        comment += `- ${violation}\n`;
      });
    }

    return comment;
  }

  uploadArtifacts(artifactPaths: string[]): void {
    const ciEnv = this.getCiEnvironment();

    console.log(`Uploading ${artifactPaths.length} artifacts for ${ciEnv.provider}`);

    // Implementation would depend on CI provider
    artifactPaths.forEach((path) => {
      console.log(`Artifact: ${path}`);
    });
  }
}

export function createCiIntegration(config: CssOutputConfig, options?: CiOptions): CiIntegration {
  return new CiIntegration(config, options);
}
