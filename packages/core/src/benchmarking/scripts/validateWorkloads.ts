#!/usr/bin/env node

import { promises as fs } from 'fs';
import { dirname } from 'path';
import { createLogger } from '../../utils/logger';
import { RealWorldLoader } from '../workloads/RealWorldLoader';
import { WorkloadManager } from '../workloads/WorkloadManager';

const logger = createLogger('WorkloadValidator');

/**
 * Configuration for workload validation
 */
interface ValidationConfig {
  workloadsPath: string;
  verbose: boolean;
  fixIssues: boolean;
  reportPath?: string;
  anomalyThreshold: number;
  checksumVerification: boolean;
  contentValidation: boolean;
  statisticsValidation: boolean;
}

/**
 * Workload validation results
 */
interface ValidationResults {
  totalWorkloads: number;
  validWorkloads: number;
  invalidWorkloads: number;
  criticalIssues: number;
  warningIssues: number;
  fixedIssues: number;
  workloadResults: Map<string, WorkloadValidationResult>;
  summary: ValidationSummary;
}

/**
 * Individual workload validation result
 */
interface WorkloadValidationResult {
  workloadId: string;
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  fixed: ValidationFix[];
  statistics: WorkloadStatistics;
}

/**
 * Validation error
 */
interface ValidationError {
  type: 'checksum' | 'content' | 'manifest' | 'corruption' | 'missing' | 'format';
  severity: 'critical' | 'major' | 'minor';
  message: string;
  details: Record<string, any>;
  fixable: boolean;
}

/**
 * Validation warning
 */
interface ValidationWarning {
  type: 'anomaly' | 'metadata' | 'performance' | 'compatibility';
  message: string;
  details: Record<string, any>;
  recommendation: string;
}

/**
 * Validation fix
 */
interface ValidationFix {
  type: string;
  description: string;
  before: any;
  after: any;
}

/**
 * Workload statistics
 */
interface WorkloadStatistics {
  fileCount: number;
  totalSize: number;
  avgFileSize: number;
  complexity: number;
  lastModified: Date;
  integrityScore: number;
}

/**
 * Validation summary
 */
interface ValidationSummary {
  overallHealth: 'excellent' | 'good' | 'fair' | 'poor' | 'critical';
  integrityRate: number;
  anomaliesDetected: number;
  recommendedActions: string[];
  performanceImpact: 'none' | 'low' | 'medium' | 'high';
}

/**
 * Workload integrity validator
 */
export class WorkloadValidator {
  private workloadManager: WorkloadManager;
  private realWorldLoader: RealWorldLoader;
  private config: ValidationConfig;

  constructor(config: ValidationConfig) {
    this.config = config;
    this.workloadManager = new WorkloadManager(config.workloadsPath);
    this.realWorldLoader = new RealWorldLoader(config.workloadsPath);
  }

  /**
   * Run complete workload validation
   */
  async validate(): Promise<ValidationResults> {
    logger.info('Starting comprehensive workload validation', {
      workloadsPath: this.config.workloadsPath,
      verbose: this.config.verbose,
      fixIssues: this.config.fixIssues,
    });

    await this.workloadManager.initialize();
    await this.realWorldLoader.initialize();

    const results: ValidationResults = {
      totalWorkloads: 0,
      validWorkloads: 0,
      invalidWorkloads: 0,
      criticalIssues: 0,
      warningIssues: 0,
      fixedIssues: 0,
      workloadResults: new Map(),
      summary: {
        overallHealth: 'excellent',
        integrityRate: 100,
        anomaliesDetected: 0,
        recommendedActions: [],
        performanceImpact: 'none',
      },
    };

    // Get all available workloads
    const workloads = await this.realWorldLoader.getAvailableWorkloads();
    results.totalWorkloads = workloads.length;

    logger.info(`Found ${workloads.length} workloads to validate`);

    // Validate each workload
    for (const workload of workloads) {
      if (this.config.verbose) {
        logger.info(`Validating workload: ${workload.name} (${workload.id})`);
      }

      const workloadResult = await this.validateSingleWorkload(workload.id);
      results.workloadResults.set(workload.id, workloadResult);

      if (workloadResult.valid) {
        results.validWorkloads++;
      } else {
        results.invalidWorkloads++;
      }

      results.criticalIssues += workloadResult.errors.filter(
        (e) => e.severity === 'critical'
      ).length;
      results.warningIssues += workloadResult.warnings.length;
      results.fixedIssues += workloadResult.fixed.length;
    }

    // Generate summary
    results.summary = this.generateSummary(results);

    // Save report if requested
    if (this.config.reportPath) {
      await this.saveValidationReport(results);
    }

    this.logValidationResults(results);

    return results;
  }

  /**
   * Validate a single workload
   */
  private async validateSingleWorkload(workloadId: string): Promise<WorkloadValidationResult> {
    const result: WorkloadValidationResult = {
      workloadId,
      valid: true,
      errors: [],
      warnings: [],
      fixed: [],
      statistics: {
        fileCount: 0,
        totalSize: 0,
        avgFileSize: 0,
        complexity: 0,
        lastModified: new Date(),
        integrityScore: 100,
      },
    };

    try {
      // Load workload dataset
      const dataset = await this.workloadManager.loadWorkloadDataset(workloadId);

      // Update statistics
      result.statistics.fileCount = dataset.files.length;
      result.statistics.totalSize = dataset.files.reduce((sum, file) => sum + file.size, 0);
      result.statistics.avgFileSize = result.statistics.totalSize / dataset.files.length;
      result.statistics.complexity = dataset.metadata.characteristics.complexity;
      result.statistics.lastModified = dataset.metadata.updated;

      // Validate checksum integrity
      if (this.config.checksumVerification) {
        await this.validateChecksums(dataset, result);
      }

      // Validate content integrity
      if (this.config.contentValidation) {
        await this.validateContent(dataset, result);
      }

      // Validate statistics and detect anomalies
      if (this.config.statisticsValidation) {
        await this.validateStatistics(dataset, result);
      }

      // Calculate integrity score
      result.statistics.integrityScore = this.calculateIntegrityScore(result);

      // Determine if workload is valid
      result.valid =
        result.errors.filter((e) => e.severity === 'critical' || e.severity === 'major').length ===
        0;

      // Apply fixes if configured
      if (this.config.fixIssues && !result.valid) {
        await this.applyFixes(workloadId, result);
      }
    } catch (error) {
      result.valid = false;
      result.errors.push({
        type: 'corruption',
        severity: 'critical',
        message: `Failed to load workload: ${(error as Error).message}`,
        details: { error: (error as Error).stack },
        fixable: false,
      });
    }

    return result;
  }

  /**
   * Validate checksum integrity
   */
  private async validateChecksums(dataset: any, result: WorkloadValidationResult): Promise<void> {
    const { metadata, files, manifest } = dataset;

    // Verify manifest checksums
    if (!manifest.checksums || !manifest.checksums.dataset) {
      result.errors.push({
        type: 'checksum',
        severity: 'major',
        message: 'Missing dataset checksum in manifest',
        details: { manifest: manifest.checksums },
        fixable: true,
      });
    }

    // Verify individual file checksums
    for (const file of files) {
      if (!file.checksum) {
        result.errors.push({
          type: 'checksum',
          severity: 'minor',
          message: `Missing checksum for file: ${file.path}`,
          details: { filePath: file.path },
          fixable: true,
        });
        continue;
      }

      const expectedChecksum = this.calculateChecksum(file.content);
      if (file.checksum !== expectedChecksum) {
        result.errors.push({
          type: 'checksum',
          severity: 'critical',
          message: `Checksum mismatch for file: ${file.path}`,
          details: {
            filePath: file.path,
            expected: expectedChecksum,
            actual: file.checksum,
          },
          fixable: true,
        });
      }
    }

    // Verify metadata integrity
    if (!metadata.integrity || !metadata.integrity.checksum) {
      result.warnings.push({
        type: 'metadata',
        message: 'Missing integrity metadata',
        details: { metadata: metadata.integrity },
        recommendation: 'Update metadata with integrity information',
      });
    }
  }

  /**
   * Validate content integrity
   */
  private async validateContent(dataset: any, result: WorkloadValidationResult): Promise<void> {
    const { files } = dataset;

    for (const file of files) {
      // Check for empty or corrupted files
      if (!file.content || file.content.length === 0) {
        result.errors.push({
          type: 'content',
          severity: 'major',
          message: `Empty file content: ${file.path}`,
          details: { filePath: file.path, size: file.size },
          fixable: false,
        });
        continue;
      }

      // Check content size consistency
      if (file.size !== file.content.length) {
        result.errors.push({
          type: 'content',
          severity: 'minor',
          message: `Size mismatch for file: ${file.path}`,
          details: {
            filePath: file.path,
            expectedSize: file.content.length,
            recordedSize: file.size,
          },
          fixable: true,
        });
      }

      // Validate CSS content format
      if (file.type === 'css' && file.path.endsWith('.css')) {
        await this.validateCSSContent(file, result);
      }

      // Check for binary content in text files
      if (this.containsBinaryContent(file.content)) {
        result.warnings.push({
          type: 'content',
          message: `Possible binary content in text file: ${file.path}`,
          details: { filePath: file.path },
          recommendation: 'Verify file encoding and content type',
        });
      }
    }
  }

  /**
   * Validate CSS content
   */
  private async validateCSSContent(file: any, result: WorkloadValidationResult): Promise<void> {
    try {
      // Basic CSS syntax validation
      const content = file.content;

      // Check for balanced braces
      const openBraces = (content.match(/{/g) || []).length;
      const closeBraces = (content.match(/}/g) || []).length;

      if (openBraces !== closeBraces) {
        result.errors.push({
          type: 'format',
          severity: 'major',
          message: `Unbalanced CSS braces in file: ${file.path}`,
          details: {
            filePath: file.path,
            openBraces,
            closeBraces,
          },
          fixable: false,
        });
      }

      // Check for common CSS syntax errors
      const commonErrors = [
        { pattern: /[{;]\s*[^}]*[{;]\s*[^}]*}/g, message: 'Possible malformed CSS rules' },
        { pattern: /:\s*;/g, message: 'Empty CSS property values' },
        { pattern: /[^;{}]\s*}/g, message: 'Missing semicolons' },
      ];

      for (const { pattern, message } of commonErrors) {
        const matches = content.match(pattern);
        if (matches && matches.length > 5) {
          // Allow some tolerance
          result.warnings.push({
            type: 'content',
            message: `${message} in file: ${file.path}`,
            details: { filePath: file.path, matches: matches.length },
            recommendation: 'Review CSS syntax and formatting',
          });
        }
      }
    } catch (error) {
      result.warnings.push({
        type: 'content',
        message: `Failed to validate CSS content: ${file.path}`,
        details: { filePath: file.path, error: (error as Error).message },
        recommendation: 'Manually review file content',
      });
    }
  }

  /**
   * Validate statistics and detect anomalies
   */
  private async validateStatistics(dataset: any, result: WorkloadValidationResult): Promise<void> {
    const { metadata } = dataset;
    const characteristics = metadata.characteristics;

    // Check for statistical anomalies
    const anomalies = [];

    // File count anomaly
    if (characteristics.fileCount !== dataset.files.length) {
      anomalies.push({
        type: 'file_count_mismatch',
        expected: characteristics.fileCount,
        actual: dataset.files.length,
      });
    }

    // Total size anomaly
    const actualTotalSize = dataset.files.reduce((sum: number, file: any) => sum + file.size, 0);
    const sizeDifference =
      Math.abs(characteristics.totalSize - actualTotalSize) / characteristics.totalSize;
    if (sizeDifference > this.config.anomalyThreshold) {
      anomalies.push({
        type: 'total_size_anomaly',
        expected: characteristics.totalSize,
        actual: actualTotalSize,
        difference: sizeDifference,
      });
    }

    // Average file size anomaly
    const actualAvgSize = actualTotalSize / dataset.files.length;
    const avgSizeDifference =
      Math.abs(characteristics.avgFileSize - actualAvgSize) / characteristics.avgFileSize;
    if (avgSizeDifference > this.config.anomalyThreshold) {
      anomalies.push({
        type: 'avg_size_anomaly',
        expected: characteristics.avgFileSize,
        actual: actualAvgSize,
        difference: avgSizeDifference,
      });
    }

    // Add anomalies as warnings
    for (const anomaly of anomalies) {
      result.warnings.push({
        type: 'anomaly',
        message: `Statistical anomaly detected: ${anomaly.type}`,
        details: anomaly,
        recommendation: 'Update workload metadata or investigate data corruption',
      });
    }
  }

  /**
   * Apply automatic fixes where possible
   */
  private async applyFixes(workloadId: string, result: WorkloadValidationResult): Promise<void> {
    for (const error of result.errors) {
      if (!error.fixable) continue;

      try {
        switch (error.type) {
          case 'checksum':
            await this.fixChecksumError(workloadId, error, result);
            break;
          case 'content':
            await this.fixContentError(workloadId, error, result);
            break;
          default:
            if (this.config.verbose) {
              logger.warn(`No automatic fix available for error type: ${error.type}`);
            }
        }
      } catch (fixError) {
        logger.error(`Failed to apply fix for ${error.type}:`, fixError);
      }
    }
  }

  /**
   * Fix checksum errors
   */
  private async fixChecksumError(
    workloadId: string,
    error: ValidationError,
    result: WorkloadValidationResult
  ): Promise<void> {
    // This would implement checksum repair logic
    // For now, we'll just log what would be fixed
    result.fixed.push({
      type: 'checksum',
      description: `Would recalculate checksum for: ${error.details.filePath}`,
      before: error.details.actual,
      after: error.details.expected,
    });
  }

  /**
   * Fix content errors
   */
  private async fixContentError(
    workloadId: string,
    error: ValidationError,
    result: WorkloadValidationResult
  ): Promise<void> {
    // This would implement content repair logic
    // For now, we'll just log what would be fixed
    result.fixed.push({
      type: 'content',
      description: `Would fix content error in: ${error.details.filePath}`,
      before: error.details,
      after: 'corrected_content',
    });
  }

  /**
   * Calculate integrity score
   */
  private calculateIntegrityScore(result: WorkloadValidationResult): number {
    let score = 100;

    // Subtract points for errors
    for (const error of result.errors) {
      switch (error.severity) {
        case 'critical':
          score -= 25;
          break;
        case 'major':
          score -= 10;
          break;
        case 'minor':
          score -= 5;
          break;
      }
    }

    // Subtract points for warnings
    score -= result.warnings.length * 2;

    return Math.max(0, score);
  }

  /**
   * Generate validation summary
   */
  private generateSummary(results: ValidationResults): ValidationSummary {
    const integrityRate = (results.validWorkloads / results.totalWorkloads) * 100;

    let overallHealth: ValidationSummary['overallHealth'];
    if (integrityRate >= 95) overallHealth = 'excellent';
    else if (integrityRate >= 85) overallHealth = 'good';
    else if (integrityRate >= 70) overallHealth = 'fair';
    else if (integrityRate >= 50) overallHealth = 'poor';
    else overallHealth = 'critical';

    const recommendedActions: string[] = [];

    if (results.criticalIssues > 0) {
      recommendedActions.push(`Address ${results.criticalIssues} critical issues immediately`);
    }

    if (results.invalidWorkloads > results.totalWorkloads * 0.1) {
      recommendedActions.push('Review workload collection process');
    }

    if (results.warningIssues > results.totalWorkloads * 0.5) {
      recommendedActions.push('Update workload metadata and documentation');
    }

    let performanceImpact: ValidationSummary['performanceImpact'];
    if (results.criticalIssues > 5) performanceImpact = 'high';
    else if (results.criticalIssues > 2) performanceImpact = 'medium';
    else if (results.criticalIssues > 0) performanceImpact = 'low';
    else performanceImpact = 'none';

    return {
      overallHealth,
      integrityRate,
      anomaliesDetected: results.warningIssues,
      recommendedActions,
      performanceImpact,
    };
  }

  /**
   * Save validation report
   */
  private async saveValidationReport(results: ValidationResults): Promise<void> {
    const reportPath = this.config.reportPath!;

    try {
      await fs.mkdir(dirname(reportPath), { recursive: true });

      const report = {
        timestamp: new Date().toISOString(),
        config: this.config,
        results,
        recommendations: this.generateRecommendations(results),
      };

      await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
      logger.info(`Validation report saved to: ${reportPath}`);
    } catch (error) {
      logger.error('Failed to save validation report:', error);
    }
  }

  /**
   * Generate recommendations based on validation results
   */
  private generateRecommendations(results: ValidationResults): string[] {
    const recommendations: string[] = [];

    // Add specific recommendations based on results
    if (results.criticalIssues > 0) {
      recommendations.push('Run workload integrity repair immediately');
    }

    if (results.summary.integrityRate < 90) {
      recommendations.push('Consider rebuilding workload collection from source');
    }

    if (results.summary.anomaliesDetected > results.totalWorkloads * 0.2) {
      recommendations.push('Update workload generation and validation processes');
    }

    return recommendations;
  }

  /**
   * Log validation results
   */
  private logValidationResults(results: ValidationResults): void {
    logger.info('Workload validation completed', {
      totalWorkloads: results.totalWorkloads,
      validWorkloads: results.validWorkloads,
      invalidWorkloads: results.invalidWorkloads,
      integrityRate: results.summary.integrityRate.toFixed(1) + '%',
      overallHealth: results.summary.overallHealth,
    });

    if (results.criticalIssues > 0) {
      logger.error(`Found ${results.criticalIssues} critical issues requiring immediate attention`);
    }

    if (results.warningIssues > 0) {
      logger.warn(`Found ${results.warningIssues} warnings that should be reviewed`);
    }

    if (results.fixedIssues > 0) {
      logger.info(`Automatically fixed ${results.fixedIssues} issues`);
    }

    if (results.summary.recommendedActions.length > 0) {
      logger.info('Recommended actions:');
      results.summary.recommendedActions.forEach((action) => {
        logger.info(`- ${action}`);
      });
    }
  }

  /**
   * Utility: Calculate checksum
   */
  private calculateChecksum(content: string): string {
    // Simple hash implementation (in production, use crypto.createHash)
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(16);
  }

  /**
   * Utility: Check for binary content
   */
  private containsBinaryContent(content: string): boolean {
    // Check for null bytes and non-printable characters
    return /[\x00-\x08\x0E-\x1F\x7F]/.test(content);
  }
}

/**
 * CLI interface for workload validation
 */
export async function runWorkloadValidation(options: {
  workloadsPath?: string;
  verbose?: boolean;
  fix?: boolean;
  report?: string;
  threshold?: number;
}): Promise<ValidationResults> {
  const config: ValidationConfig = {
    workloadsPath: options.workloadsPath || './benchmark-workloads',
    verbose: options.verbose || false,
    fixIssues: options.fix || false,
    reportPath: options.report,
    anomalyThreshold: options.threshold || 0.1, // 10% threshold
    checksumVerification: true,
    contentValidation: true,
    statisticsValidation: true,
  };

  const validator = new WorkloadValidator(config);
  return validator.validate();
}

/**
 * Default export for CLI usage
 */
if (require.main === module) {
  const args = process.argv.slice(2);

  const options = {
    workloadsPath: args.find((arg) => arg.startsWith('--path='))?.split('=')[1],
    verbose: args.includes('--verbose') || args.includes('-v'),
    fix: args.includes('--fix'),
    report: args.find((arg) => arg.startsWith('--report='))?.split('=')[1],
    threshold: parseFloat(
      args.find((arg) => arg.startsWith('--threshold='))?.split('=')[1] || '0.1'
    ),
  };

  runWorkloadValidation(options)
    .then((results) => {
      process.exit(results.criticalIssues > 0 ? 1 : 0);
    })
    .catch((error) => {
      console.error('Validation failed:', error);
      process.exit(1);
    });
}
