/**
 * Copyright (c) 2025 Rowan Cardow
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type {
  CssPerformanceReport,
  BudgetViolation,
} from "./cssReportGenerator.js";
import type { CssOutputConfig } from "./cssOutputConfig.js";

/**
 * CI environment detection result
 */
export interface CiEnvironment {
  /** CI provider name */
  provider:
    | "github"
    | "gitlab"
    | "jenkins"
    | "azure"
    | "circleci"
    | "travis"
    | "unknown";

  /** Build ID or number */
  buildId?: string;

  /** Branch name */
  branch?: string;

  /** Commit SHA */
  commit?: string;

  /** Pull/Merge request number */
  pullRequest?: string;

  /** Environment variables relevant to CI */
  env: Record<string, string>;

  /** Whether running in CI environment */
  isCI: boolean;
}

/**
 * Performance comparison result
 */
export interface PerformanceComparison {
  /** Current report */
  current: CssPerformanceReport;

  /** Baseline report for comparison */
  baseline?: CssPerformanceReport;

  /** Performance delta metrics */
  delta: {
    scoreChange: number;
    sizeChange: number;
    loadTimeChange: number;
    compressionChange: number;
  };

  /** Regression analysis */
  regressions: PerformanceRegression[];

  /** Improvements detected */
  improvements: PerformanceImprovement[];
}

/**
 * Performance regression detected
 */
export interface PerformanceRegression {
  /** Type of regression */
  type:
    | "size_increase"
    | "load_time_increase"
    | "score_decrease"
    | "budget_violation";

  /** Severity level */
  severity: "minor" | "moderate" | "major";

  /** Description of regression */
  description: string;

  /** Current value */
  current: number;

  /** Previous value */
  previous: number;

  /** Percentage change */
  changePercent: number;

  /** Recommended actions */
  actions: string[];
}

/**
 * Performance improvement detected
 */
export interface PerformanceImprovement {
  /** Type of improvement */
  type:
    | "size_reduction"
    | "load_time_improvement"
    | "score_increase"
    | "compression_improvement";

  /** Description of improvement */
  description: string;

  /** Current value */
  current: number;

  /** Previous value */
  previous: number;

  /** Percentage improvement */
  improvementPercent: number;
}

/**
 * CI integration options
 */
export interface CiIntegrationOptions {
  /** Baseline report file path */
  baselinePath?: string;

  /** Output directory for reports */
  outputDir?: string;

  /** Whether to fail CI on budget violations */
  failOnBudgetViolation?: boolean;

  /** Whether to fail CI on performance regressions */
  failOnRegression?: boolean;

  /** Minimum performance score threshold */
  minPerformanceScore?: number;

  /** Maximum acceptable size increase percentage */
  maxSizeIncrease?: number;

  /** Whether to generate GitHub/GitLab comments */
  generateComments?: boolean;

  /** Custom webhook URL for notifications */
  webhookUrl?: string;
}

/**
 * CI Integration for CSS Performance Monitoring
 */
export class CiIntegration {
  private config: CssOutputConfig;
  private options: CiIntegrationOptions;
  private environment: CiEnvironment;

  constructor(config: CssOutputConfig, options: CiIntegrationOptions = {}) {
    this.config = config;
    this.options = {
      failOnBudgetViolation: true,
      failOnRegression: false,
      minPerformanceScore: 70,
      maxSizeIncrease: 10,
      generateComments: true,
      ...options,
    };
    this.environment = this.detectCiEnvironment();
  }

  /**
   * Detect CI environment and extract relevant information
   */
  private detectCiEnvironment(): CiEnvironment {
    const env = process.env;

    // GitHub Actions
    if (env.GITHUB_ACTIONS) {
      return {
        provider: "github",
        buildId: env.GITHUB_RUN_ID,
        branch: env.GITHUB_REF_NAME,
        commit: env.GITHUB_SHA,
        pullRequest:
          env.GITHUB_EVENT_NAME === "pull_request"
            ? env.GITHUB_EVENT_NUMBER
            : undefined,
        env: {
          GITHUB_REPOSITORY: env.GITHUB_REPOSITORY || "",
          GITHUB_ACTOR: env.GITHUB_ACTOR || "",
          GITHUB_WORKFLOW: env.GITHUB_WORKFLOW || "",
        },
        isCI: true,
      };
    }

    // GitLab CI
    if (env.GITLAB_CI) {
      return {
        provider: "gitlab",
        buildId: env.CI_PIPELINE_ID,
        branch: env.CI_COMMIT_REF_NAME,
        commit: env.CI_COMMIT_SHA,
        pullRequest: env.CI_MERGE_REQUEST_IID,
        env: {
          CI_PROJECT_PATH: env.CI_PROJECT_PATH || "",
          CI_COMMIT_AUTHOR: env.CI_COMMIT_AUTHOR || "",
          CI_PIPELINE_URL: env.CI_PIPELINE_URL || "",
        },
        isCI: true,
      };
    }

    // Jenkins
    if (env.JENKINS_URL) {
      return {
        provider: "jenkins",
        buildId: env.BUILD_NUMBER,
        branch: env.GIT_BRANCH,
        commit: env.GIT_COMMIT,
        env: {
          JOB_NAME: env.JOB_NAME || "",
          BUILD_URL: env.BUILD_URL || "",
        },
        isCI: true,
      };
    }

    // Azure DevOps
    if (env.AZURE_HTTP_USER_AGENT) {
      return {
        provider: "azure",
        buildId: env.BUILD_BUILDNUMBER,
        branch: env.BUILD_SOURCEBRANCH,
        commit: env.BUILD_SOURCEVERSION,
        pullRequest: env.SYSTEM_PULLREQUEST_PULLREQUESTNUMBER,
        env: {
          BUILD_REPOSITORY_NAME: env.BUILD_REPOSITORY_NAME || "",
          BUILD_DEFINITIONNAME: env.BUILD_DEFINITIONNAME || "",
        },
        isCI: true,
      };
    }

    // CircleCI
    if (env.CIRCLECI) {
      return {
        provider: "circleci",
        buildId: env.CIRCLE_BUILD_NUM,
        branch: env.CIRCLE_BRANCH,
        commit: env.CIRCLE_SHA1,
        pullRequest: env.CIRCLE_PULL_REQUEST?.split("/").pop(),
        env: {
          CIRCLE_PROJECT_REPONAME: env.CIRCLE_PROJECT_REPONAME || "",
          CIRCLE_USERNAME: env.CIRCLE_USERNAME || "",
        },
        isCI: true,
      };
    }

    // Travis CI
    if (env.TRAVIS) {
      return {
        provider: "travis",
        buildId: env.TRAVIS_BUILD_NUMBER,
        branch: env.TRAVIS_BRANCH,
        commit: env.TRAVIS_COMMIT,
        pullRequest:
          env.TRAVIS_PULL_REQUEST !== "false"
            ? env.TRAVIS_PULL_REQUEST
            : undefined,
        env: {
          TRAVIS_REPO_SLUG: env.TRAVIS_REPO_SLUG || "",
          TRAVIS_EVENT_TYPE: env.TRAVIS_EVENT_TYPE || "",
        },
        isCI: true,
      };
    }

    // Generic CI detection
    const isCI = !!(env.CI || env.CONTINUOUS_INTEGRATION);

    return {
      provider: "unknown",
      buildId: env.BUILD_NUMBER || env.BUILD_ID,
      branch: env.BRANCH || env.GIT_BRANCH,
      commit: env.COMMIT || env.GIT_COMMIT,
      env: {},
      isCI,
    };
  }

  /**
   * Process performance report in CI environment
   */
  async processReport(report: CssPerformanceReport): Promise<{
    success: boolean;
    comparison?: PerformanceComparison;
    exitCode: number;
    summary: string;
  }> {
    let success = true;
    let exitCode = 0;
    const messages: string[] = [];

    // Load baseline for comparison
    const baseline = await this.loadBaseline();
    const comparison = baseline
      ? this.compareReports(report, baseline)
      : undefined;

    // Check performance thresholds
    if (
      this.options.minPerformanceScore &&
      report.metrics.performanceScore < this.options.minPerformanceScore
    ) {
      success = false;
      exitCode = 1;
      messages.push(
        `❌ Performance score ${report.metrics.performanceScore} below threshold ${this.options.minPerformanceScore}`,
      );
    } else {
      messages.push(
        `✅ Performance score: ${report.metrics.performanceScore}/100`,
      );
    }

    // Check budget violations
    if (this.options.failOnBudgetViolation && !report.budgetAnalysis.passed) {
      success = false;
      exitCode = 1;
      const errorViolations = report.budgetAnalysis.violations.filter(
        (v) => v.severity === "error",
      );
      messages.push(
        `❌ ${errorViolations.length} budget violation(s) detected`,
      );
    } else if (report.budgetAnalysis.passed) {
      messages.push(`✅ All performance budgets passed`);
    }

    // Check for regressions
    if (comparison && this.options.failOnRegression) {
      const majorRegressions = comparison.regressions.filter(
        (r) => r.severity === "major",
      );
      if (majorRegressions.length > 0) {
        success = false;
        exitCode = 1;
        messages.push(
          `❌ ${majorRegressions.length} major performance regression(s) detected`,
        );
      }
    }

    // Check size increase threshold
    if (comparison && this.options.maxSizeIncrease) {
      const sizeIncreasePercent = comparison.delta.sizeChange;
      if (sizeIncreasePercent > this.options.maxSizeIncrease) {
        success = false;
        exitCode = 1;
        messages.push(
          `❌ Size increase ${sizeIncreasePercent.toFixed(1)}% exceeds threshold ${this.options.maxSizeIncrease}%`,
        );
      }
    }

    // Save current report as baseline (for future comparisons)
    await this.saveBaseline(report);

    // Generate CI outputs
    await this.generateCiOutputs(report, comparison);

    // Generate comments for GitHub/GitLab
    if (this.options.generateComments && this.environment.pullRequest) {
      await this.generatePrComment(report, comparison);
    }

    // Send webhook notification
    if (this.options.webhookUrl) {
      await this.sendWebhookNotification(report, success, comparison);
    }

    const summary = messages.join("\n");

    return {
      success,
      comparison,
      exitCode,
      summary,
    };
  }

  /**
   * Compare current report with baseline
   */
  private compareReports(
    current: CssPerformanceReport,
    baseline: CssPerformanceReport,
  ): PerformanceComparison {
    const delta = {
      scoreChange:
        current.metrics.performanceScore - baseline.metrics.performanceScore,
      sizeChange:
        ((current.metrics.totalCompressedSize -
          baseline.metrics.totalCompressedSize) /
          baseline.metrics.totalCompressedSize) *
        100,
      loadTimeChange:
        current.metrics.averageLoadTime - baseline.metrics.averageLoadTime,
      compressionChange:
        current.metrics.overallCompressionRatio -
        baseline.metrics.overallCompressionRatio,
    };

    const regressions = this.detectRegressions(current, baseline, delta);
    const improvements = this.detectImprovements(current, baseline, delta);

    return {
      current,
      baseline,
      delta,
      regressions,
      improvements,
    };
  }

  /**
   * Detect performance regressions
   */
  private detectRegressions(
    current: CssPerformanceReport,
    baseline: CssPerformanceReport,
    delta: any,
  ): PerformanceRegression[] {
    const regressions: PerformanceRegression[] = [];

    // Performance score regression
    if (delta.scoreChange < -5) {
      regressions.push({
        type: "score_decrease",
        severity:
          delta.scoreChange < -15
            ? "major"
            : delta.scoreChange < -10
              ? "moderate"
              : "minor",
        description: `Performance score decreased by ${Math.abs(delta.scoreChange).toFixed(1)} points`,
        current: current.metrics.performanceScore,
        previous: baseline.metrics.performanceScore,
        changePercent: delta.scoreChange,
        actions: [
          "Review recent CSS changes for optimization opportunities",
          "Check if new dependencies increased bundle size",
          "Verify compression settings are optimal",
        ],
      });
    }

    // Size increase regression
    if (delta.sizeChange > 5) {
      regressions.push({
        type: "size_increase",
        severity:
          delta.sizeChange > 20
            ? "major"
            : delta.sizeChange > 10
              ? "moderate"
              : "minor",
        description: `Bundle size increased by ${delta.sizeChange.toFixed(1)}%`,
        current: current.metrics.totalCompressedSize,
        previous: baseline.metrics.totalCompressedSize,
        changePercent: delta.sizeChange,
        actions: [
          "Analyze which bundles grew in size",
          "Check for unused CSS that could be removed",
          "Verify tree-shaking is working correctly",
        ],
      });
    }

    // Load time regression
    if (delta.loadTimeChange > 500) {
      regressions.push({
        type: "load_time_increase",
        severity:
          delta.loadTimeChange > 2000
            ? "major"
            : delta.loadTimeChange > 1000
              ? "moderate"
              : "minor",
        description: `Load time increased by ${delta.loadTimeChange.toFixed(0)}ms`,
        current: current.metrics.averageLoadTime,
        previous: baseline.metrics.averageLoadTime,
        changePercent:
          (delta.loadTimeChange / baseline.metrics.averageLoadTime) * 100,
        actions: [
          "Optimize critical CSS extraction",
          "Review chunking strategy",
          "Enable resource preloading",
        ],
      });
    }

    // Budget violations (new in current report)
    const newViolations = current.budgetAnalysis.violations.filter(
      (cv) =>
        !baseline.budgetAnalysis.violations.some((bv) => bv.type === cv.type),
    );

    newViolations.forEach((violation) => {
      regressions.push({
        type: "budget_violation",
        severity: violation.severity === "error" ? "major" : "moderate",
        description: `New budget violation: ${violation.message}`,
        current: violation.actual,
        previous: violation.limit,
        changePercent:
          ((violation.actual - violation.limit) / violation.limit) * 100,
        actions: violation.recommendations,
      });
    });

    return regressions;
  }

  /**
   * Detect performance improvements
   */
  private detectImprovements(
    current: CssPerformanceReport,
    baseline: CssPerformanceReport,
    delta: any,
  ): PerformanceImprovement[] {
    const improvements: PerformanceImprovement[] = [];

    if (delta.scoreChange > 5) {
      improvements.push({
        type: "score_increase",
        description: `Performance score improved by ${delta.scoreChange.toFixed(1)} points`,
        current: current.metrics.performanceScore,
        previous: baseline.metrics.performanceScore,
        improvementPercent: delta.scoreChange,
      });
    }

    if (delta.sizeChange < -5) {
      improvements.push({
        type: "size_reduction",
        description: `Bundle size reduced by ${Math.abs(delta.sizeChange).toFixed(1)}%`,
        current: current.metrics.totalCompressedSize,
        previous: baseline.metrics.totalCompressedSize,
        improvementPercent: Math.abs(delta.sizeChange),
      });
    }

    if (delta.loadTimeChange < -200) {
      improvements.push({
        type: "load_time_improvement",
        description: `Load time improved by ${Math.abs(delta.loadTimeChange).toFixed(0)}ms`,
        current: current.metrics.averageLoadTime,
        previous: baseline.metrics.averageLoadTime,
        improvementPercent:
          Math.abs(delta.loadTimeChange / baseline.metrics.averageLoadTime) *
          100,
      });
    }

    if (delta.compressionChange < -0.05) {
      improvements.push({
        type: "compression_improvement",
        description: `Compression ratio improved by ${Math.abs(delta.compressionChange * 100).toFixed(1)}%`,
        current: current.metrics.overallCompressionRatio,
        previous: baseline.metrics.overallCompressionRatio,
        improvementPercent: Math.abs(delta.compressionChange) * 100,
      });
    }

    return improvements;
  }

  /**
   * Load baseline report for comparison
   */
  private async loadBaseline(): Promise<CssPerformanceReport | null> {
    if (!this.options.baselinePath) return null;

    try {
      const fs = await import("fs/promises");
      const content = await fs.readFile(this.options.baselinePath, "utf-8");
      return JSON.parse(content);
    } catch {
      return null; // Baseline doesn't exist yet
    }
  }

  /**
   * Save current report as baseline
   */
  private async saveBaseline(report: CssPerformanceReport): Promise<void> {
    if (!this.options.baselinePath) return;

    try {
      const fs = await import("fs/promises");
      const path = await import("path");

      // Ensure directory exists
      await fs.mkdir(path.dirname(this.options.baselinePath), {
        recursive: true,
      });

      // Save report
      await fs.writeFile(
        this.options.baselinePath,
        JSON.stringify(report, null, 2),
      );
    } catch (error) {
      console.warn("Failed to save baseline report:", error);
    }
  }

  /**
   * Generate CI-specific outputs (artifacts, summaries, etc.)
   */
  private async generateCiOutputs(
    report: CssPerformanceReport,
    comparison?: PerformanceComparison,
  ): Promise<void> {
    const outputDir = this.options.outputDir || "./css-performance-reports";

    try {
      const fs = await import("fs/promises");
      const path = await import("path");

      // Ensure output directory exists
      await fs.mkdir(outputDir, { recursive: true });

      // Save detailed JSON report
      const reportPath = path.join(
        outputDir,
        `css-performance-${this.environment.buildId || "latest"}.json`,
      );
      await fs.writeFile(reportPath, JSON.stringify(report, null, 2));

      // Generate markdown summary
      const { CssReportGenerator } = await import("./cssReportGenerator.js");
      const generator = new CssReportGenerator(this.config);
      const markdown = await generator.exportReport(report, "markdown");

      const summaryPath = path.join(
        outputDir,
        `css-performance-${this.environment.buildId || "latest"}.md`,
      );
      await fs.writeFile(summaryPath, markdown);

      // Generate CI-specific summary
      if (comparison) {
        const ciSummary = this.generateCiSummary(report, comparison);
        const ciSummaryPath = path.join(
          outputDir,
          `ci-summary-${this.environment.buildId || "latest"}.md`,
        );
        await fs.writeFile(ciSummaryPath, ciSummary);
      }

      console.log(`📊 CSS performance reports saved to ${outputDir}`);
    } catch (error) {
      console.warn("Failed to generate CI outputs:", error);
    }
  }

  /**
   * Generate CI summary for build logs
   */
  private generateCiSummary(
    report: CssPerformanceReport,
    comparison: PerformanceComparison,
  ): string {
    const lines = ["# CSS Performance Summary\n"];

    // Key metrics
    lines.push("## Key Metrics");
    lines.push(
      `- **Performance Score:** ${report.metrics.performanceScore}/100 ${comparison.delta.scoreChange >= 0 ? "📈" : "📉"} (${comparison.delta.scoreChange > 0 ? "+" : ""}${comparison.delta.scoreChange.toFixed(1)})`,
    );
    lines.push(
      `- **Total Size:** ${Math.round(report.metrics.totalCompressedSize / 1024)}KB ${comparison.delta.sizeChange <= 0 ? "📉" : "📈"} (${comparison.delta.sizeChange > 0 ? "+" : ""}${comparison.delta.sizeChange.toFixed(1)}%)`,
    );
    lines.push(
      `- **Load Time:** ${Math.round(report.metrics.averageLoadTime)}ms ${comparison.delta.loadTimeChange <= 0 ? "📉" : "📈"} (${comparison.delta.loadTimeChange > 0 ? "+" : ""}${comparison.delta.loadTimeChange.toFixed(0)}ms)`,
    );
    lines.push(
      `- **Budget Status:** ${report.budgetAnalysis.passed ? "✅ PASSED" : "❌ FAILED"}`,
    );
    lines.push("");

    // Regressions
    if (comparison.regressions.length > 0) {
      lines.push("## ⚠️ Regressions Detected");
      comparison.regressions.forEach((regression) => {
        lines.push(
          `- **${regression.type.replace("_", " ")}:** ${regression.description} (${regression.severity})`,
        );
      });
      lines.push("");
    }

    // Improvements
    if (comparison.improvements.length > 0) {
      lines.push("## 🎉 Improvements Detected");
      comparison.improvements.forEach((improvement) => {
        lines.push(
          `- **${improvement.type.replace("_", " ")}:** ${improvement.description}`,
        );
      });
      lines.push("");
    }

    // Recommendations (top 3)
    if (report.recommendations.length > 0) {
      lines.push("## 💡 Top Recommendations");
      report.recommendations.slice(0, 3).forEach((rec) => {
        lines.push(
          `- **${rec.title}** (${rec.priority} priority): ${rec.description}`,
        );
      });
      lines.push("");
    }

    return lines.join("\n");
  }

  /**
   * Generate Pull Request comment
   */
  private async generatePrComment(
    report: CssPerformanceReport,
    comparison?: PerformanceComparison,
  ): Promise<void> {
    if (!comparison) return;

    const comment = this.generateCiSummary(report, comparison);

    // The actual PR commenting would depend on the CI provider
    // This is a placeholder for the comment content
    console.log("PR Comment would be:", comment);

    // Save comment to file for CI to post
    if (this.options.outputDir) {
      try {
        const fs = await import("fs/promises");
        const path = await import("path");
        const commentPath = path.join(this.options.outputDir, "pr-comment.md");
        await fs.writeFile(commentPath, comment);
      } catch (error) {
        console.warn("Failed to save PR comment:", error);
      }
    }
  }

  /**
   * Send webhook notification
   */
  private async sendWebhookNotification(
    report: CssPerformanceReport,
    success: boolean,
    comparison?: PerformanceComparison,
  ): Promise<void> {
    if (!this.options.webhookUrl) return;

    const payload = {
      timestamp: new Date().toISOString(),
      environment: this.environment,
      success,
      performanceScore: report.metrics.performanceScore,
      budgetPassed: report.budgetAnalysis.passed,
      totalSize: report.metrics.totalCompressedSize,
      comparison: comparison
        ? {
            scoreChange: comparison.delta.scoreChange,
            sizeChange: comparison.delta.sizeChange,
            regressionsCount: comparison.regressions.length,
            improvementsCount: comparison.improvements.length,
          }
        : null,
    };

    try {
      const response = await fetch(this.options.webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        console.warn(`Webhook notification failed: ${response.status}`);
      }
    } catch (error) {
      console.warn("Failed to send webhook notification:", error);
    }
  }

  /**
   * Get CI environment information
   */
  getCiEnvironment(): CiEnvironment {
    return this.environment;
  }
}

/**
 * Factory function to create CI integration
 */
export function createCiIntegration(
  config: CssOutputConfig,
  options?: CiIntegrationOptions,
): CiIntegration {
  return new CiIntegration(config, options);
}
