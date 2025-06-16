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

export class CiIntegration {
  constructor(private config: CssOutputConfig) {}

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

  processReport(report: CssPerformanceReport): void {
    const ciEnv = this.getCiEnvironment();

    if (!ciEnv.isCI) {
      console.log('Running in non-CI environment');
      return;
    }

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

    if (!budgetAnalysis.passed) {
      console.error('Performance budget violations detected!');
      budgetAnalysis.violations.forEach((violation) => {
        console.error(`- ${violation}`);
      });
      process.exit(1);
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

export function createCiIntegration(config: CssOutputConfig): CiIntegration {
  return new CiIntegration(config);
}
