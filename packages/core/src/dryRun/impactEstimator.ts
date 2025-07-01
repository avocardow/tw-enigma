/**
 * Impact Estimator
 * Analyzes and quantifies the impact of proposed changes from dry run results
 */

import { Logger } from '../utils/logger';
import type { DryRunResult, DryRunOperation } from './dryRunManager';
import type { PreviewReport } from './reportGenerator';

export interface ImpactMetrics {
  /** Overall risk level */
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  /** Confidence in the impact assessment (0-1) */
  confidence: number;
  /** Scope of changes */
  scope: {
    filesAffected: number;
    totalFiles: number;
    percentageAffected: number;
    criticalFilesAffected: number;
    dependencyFilesAffected: number;
  };
  /** Size impact analysis */
  sizeImpact: {
    totalBytes: number;
    percentageChange: number;
    largestChange: number;
    averageChange: number;
  };
  /** Performance impact */
  performanceImpact: {
    estimatedDuration: number;
    complexOperations: number;
    parallelizable: boolean;
    memoryUsage: number;
  };
  /** Risk factors */
  risks: RiskFactor[];
  /** Change categories */
  categories: ChangeCategory[];
}

export interface RiskFactor {
  /** Risk type */
  type: 'critical-file' | 'dependency' | 'size' | 'complexity' | 'cascade' | 'security';
  /** Risk severity (0-10) */
  severity: number;
  /** Risk description */
  description: string;
  /** Affected files/components */
  affected: string[];
  /** Mitigation suggestions */
  mitigation?: string;
}

export interface ChangeCategory {
  /** Category name */
  name: string;
  /** Number of operations in this category */
  count: number;
  /** Impact weight (0-1) */
  weight: number;
  /** Category description */
  description: string;
}

export interface ComponentDependency {
  /** File path */
  path: string;
  /** Dependencies */
  dependencies: string[];
  /** Dependents */
  dependents: string[];
  /** Dependency depth */
  depth: number;
  /** Criticality score (0-1) */
  criticality: number;
}

export interface ImpactEstimationConfig {
  /** Critical file patterns */
  criticalFilePatterns: string[];
  /** Dependency analysis depth */
  dependencyDepth: number;
  /** Risk thresholds */
  riskThresholds: {
    fileSizeChange: number;
    fileCountPercentage: number;
    criticalFileChanges: number;
  };
  /** Performance thresholds */
  performanceThresholds: {
    operationCount: number;
    estimatedDuration: number;
    memoryUsage: number;
  };
  /** Include dependency analysis */
  includeDependencyAnalysis: boolean;
  /** Include security analysis */
  includeSecurityAnalysis: boolean;
}

export class ImpactEstimationError extends Error {
  constructor(
    message: string,
    public readonly cause?: Error,
    public readonly context?: string
  ) {
    super(message);
    this.name = 'ImpactEstimationError';
  }
}

export class ImpactEstimator {
  private logger: Logger;
  private config: ImpactEstimationConfig;

  constructor(config: Partial<ImpactEstimationConfig> = {}) {
    this.config = {
      criticalFilePatterns: [
        '**/package.json',
        '**/tsconfig.json',
        '**/webpack.config.*',
        '**/vite.config.*',
        '**/rollup.config.*',
        '**/next.config.*',
        '**/nuxt.config.*',
        '**/vue.config.*',
        '**/angular.json',
        '**/tailwind.config.*',
        '**/postcss.config.*',
        '**/.env*',
        '**/index.html',
        '**/main.*',
        '**/App.*',
        '**/router.*',
        '**/store.*',
      ],
      dependencyDepth: 3,
      riskThresholds: {
        fileSizeChange: 1024 * 1024, // 1MB
        fileCountPercentage: 20, // 20% of files
        criticalFileChanges: 1,
      },
      performanceThresholds: {
        operationCount: 1000,
        estimatedDuration: 30000, // 30 seconds
        memoryUsage: 512 * 1024 * 1024, // 512MB
      },
      includeDependencyAnalysis: true,
      includeSecurityAnalysis: true,
      ...config,
    };

    this.logger = new Logger({ component: 'ImpactEstimator' });
  }

  /**
   * Estimate impact from dry run results
   */
  async estimateImpact(
    result: DryRunResult,
    projectContext?: {
      totalFiles?: number;
      dependencies?: ComponentDependency[];
      projectSize?: number;
    }
  ): Promise<ImpactMetrics> {
    try {
      this.logger.debug('Estimating impact for dry run result', {
        operationCount: result.totalOperations,
        projectContext: !!projectContext,
      });

      const scope = this.calculateScope(result, projectContext);
      const sizeImpact = this.calculateSizeImpact(result, projectContext);
      const performanceImpact = this.calculatePerformanceImpact(result);
      const risks = await this.identifyRisks(result, projectContext);
      const categories = this.categorizeChanges(result);
      const riskLevel = this.calculateOverallRisk(risks, scope, sizeImpact);
      const confidence = this.calculateConfidence(result, projectContext);

      const metrics: ImpactMetrics = {
        riskLevel,
        confidence,
        scope,
        sizeImpact,
        performanceImpact,
        risks,
        categories,
      };

      this.logger.info('Impact estimation completed', {
        riskLevel,
        confidence,
        risksFound: risks.length,
      });

      return metrics;
    } catch (error) {
      this.logger.error('Failed to estimate impact', { error });
      throw new ImpactEstimationError(
        'Impact estimation failed',
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  /**
   * Estimate impact from preview report
   */
  async estimateImpactFromReport(
    report: PreviewReport,
    projectContext?: Parameters<typeof this.estimateImpact>[1]
  ): Promise<ImpactMetrics> {
    return this.estimateImpact(report.data.result, projectContext);
  }

  /**
   * Calculate scope metrics
   */
  private calculateScope(
    result: DryRunResult,
    projectContext?: { totalFiles?: number; dependencies?: ComponentDependency[] }
  ): ImpactMetrics['scope'] {
    const operations = result.context.operations;
    const affectedFiles = new Set(operations.map(op => op.target));
    
    const filesAffected = affectedFiles.size;
    const totalFiles = projectContext?.totalFiles || 1000; // Default estimate
    const percentageAffected = (filesAffected / totalFiles) * 100;

    // Identify critical files
    const criticalFilesAffected = Array.from(affectedFiles).filter(file =>
      this.isCriticalFile(file)
    ).length;

    // Identify dependency files
    const dependencyFilesAffected = projectContext?.dependencies
      ? Array.from(affectedFiles).filter(file =>
          projectContext.dependencies!.some(dep => dep.path === file && dep.dependents.length > 5)
        ).length
      : 0;

    return {
      filesAffected,
      totalFiles,
      percentageAffected,
      criticalFilesAffected,
      dependencyFilesAffected,
    };
  }

  /**
   * Calculate size impact metrics
   */
  private calculateSizeImpact(
    result: DryRunResult,
    projectContext?: { projectSize?: number }
  ): ImpactMetrics['sizeImpact'] {
    const operations = result.context.operations;
    const totalBytes = result.summary.totalSizeImpact;
    const projectSize = projectContext?.projectSize || 10 * 1024 * 1024; // 10MB default
    const percentageChange = Math.abs((totalBytes / projectSize) * 100);

    // Find largest single change
    const largestChange = Math.max(
      ...operations.map(op => Math.abs(op.sizeImpact || 0))
    );

    // Calculate average change
    const changesWithSize = operations.filter(op => op.sizeImpact !== undefined);
    const averageChange = changesWithSize.length > 0
      ? changesWithSize.reduce((sum, op) => sum + Math.abs(op.sizeImpact!), 0) / changesWithSize.length
      : 0;

    return {
      totalBytes,
      percentageChange,
      largestChange,
      averageChange,
    };
  }

  /**
   * Calculate performance impact metrics
   */
  private calculatePerformanceImpact(result: DryRunResult): ImpactMetrics['performanceImpact'] {
    const operations = result.context.operations;
    const estimatedDuration = result.summary.estimatedDuration;

    // Count complex operations
    const complexOperations = operations.filter(op =>
      op.type === 'file-modify' || 
      (op.sizeImpact && Math.abs(op.sizeImpact) > 100000) // Large files
    ).length;

    // Determine if operations can be parallelized
    const parallelizable = operations.every(op =>
      !operations.some(other => 
        other !== op && this.hasOperationDependency(op, other)
      )
    );

    // Estimate memory usage
    const memoryUsage = operations.reduce((sum, op) => {
      const size = Math.abs(op.sizeImpact || 0);
      return sum + (size * 2); // Assume 2x memory overhead
    }, 0);

    return {
      estimatedDuration,
      complexOperations,
      parallelizable,
      memoryUsage,
    };
  }

  /**
   * Identify risk factors
   */
  private async identifyRisks(
    result: DryRunResult,
    projectContext?: { dependencies?: ComponentDependency[] }
  ): Promise<RiskFactor[]> {
    const risks: RiskFactor[] = [];
    const operations = result.context.operations;

    // Critical file risks
    const criticalFileOps = operations.filter(op => this.isCriticalFile(op.target));
    if (criticalFileOps.length > 0) {
      risks.push({
        type: 'critical-file',
        severity: Math.min(10, criticalFileOps.length * 3),
        description: `${criticalFileOps.length} critical files will be modified`,
        affected: criticalFileOps.map(op => op.target),
        mitigation: 'Review critical file changes carefully and ensure proper backups',
      });
    }

    // Large size change risks
    const largeSizeOps = operations.filter(op => 
      op.sizeImpact && Math.abs(op.sizeImpact) > this.config.riskThresholds.fileSizeChange
    );
    if (largeSizeOps.length > 0) {
      risks.push({
        type: 'size',
        severity: Math.min(10, largeSizeOps.length * 2),
        description: `${largeSizeOps.length} operations involve large size changes`,
        affected: largeSizeOps.map(op => op.target),
        mitigation: 'Monitor disk space and consider chunked processing',
      });
    }

    // Dependency risks
    if (this.config.includeDependencyAnalysis && projectContext?.dependencies) {
      const dependencyRisks = this.analyzeDependencyRisks(operations, projectContext.dependencies);
      risks.push(...dependencyRisks);
    }

    // Complexity risks
    const complexityScore = this.calculateComplexityScore(operations);
    if (complexityScore > 7) {
      risks.push({
        type: 'complexity',
        severity: complexityScore,
        description: 'High complexity operations detected',
        affected: operations.map(op => op.target),
        mitigation: 'Consider breaking down into smaller batches',
      });
    }

    // Security risks
    if (this.config.includeSecurityAnalysis) {
      const securityRisks = this.analyzeSecurityRisks(operations);
      risks.push(...securityRisks);
    }

    // Cascade effect risks
    const cascadeRisks = this.analyzeCascadeRisks(operations);
    risks.push(...cascadeRisks);

    return risks;
  }

  /**
   * Categorize changes
   */
  private categorizeChanges(result: DryRunResult): ChangeCategory[] {
    const operations = result.context.operations;
    const categories: ChangeCategory[] = [];

    // Group by operation type
    const typeGroups = operations.reduce((groups, op) => {
      groups[op.type] = (groups[op.type] || 0) + 1;
      return groups;
    }, {} as Record<string, number>);

    // Convert to categories
    Object.entries(typeGroups).forEach(([type, count]) => {
      categories.push({
        name: this.getOperationTypeName(type),
        count,
        weight: this.getOperationTypeWeight(type),
        description: this.getOperationTypeDescription(type),
      });
    });

    // Add file type categories
    const fileTypeGroups = operations.reduce((groups, op) => {
      const ext = this.getFileExtension(op.target);
      groups[ext] = (groups[ext] || 0) + 1;
      return groups;
    }, {} as Record<string, number>);

    Object.entries(fileTypeGroups).forEach(([ext, count]) => {
      if (count > 1) { // Only include if multiple files
        categories.push({
          name: `${ext.toUpperCase()} Files`,
          count,
          weight: this.getFileTypeWeight(ext),
          description: `Operations affecting ${ext} files`,
        });
      }
    });

    return categories.sort((a, b) => b.weight * b.count - a.weight * a.count);
  }

  /**
   * Calculate overall risk level
   */
  private calculateOverallRisk(
    risks: RiskFactor[],
    scope: ImpactMetrics['scope'],
    sizeImpact: ImpactMetrics['sizeImpact']
  ): ImpactMetrics['riskLevel'] {
    let riskScore = 0;

    // Risk factor contribution
    const maxRiskSeverity = Math.max(...risks.map(r => r.severity), 0);
    riskScore += maxRiskSeverity * 0.4;

    // Scope contribution
    if (scope.criticalFilesAffected > 0) riskScore += 3;
    if (scope.percentageAffected > this.config.riskThresholds.fileCountPercentage) riskScore += 2;
    if (scope.dependencyFilesAffected > 5) riskScore += 2;

    // Size impact contribution
    if (Math.abs(sizeImpact.totalBytes) > this.config.riskThresholds.fileSizeChange) riskScore += 2;
    if (sizeImpact.percentageChange > 50) riskScore += 3;

    // Determine risk level
    if (riskScore >= 8) return 'critical';
    if (riskScore >= 6) return 'high';
    if (riskScore >= 3) return 'medium';
    return 'low';
  }

  /**
   * Calculate confidence score
   */
  private calculateConfidence(
    result: DryRunResult,
    projectContext?: { totalFiles?: number; dependencies?: ComponentDependency[] }
  ): number {
    let confidence = 1.0;

    // Reduce confidence for incomplete data
    if (!projectContext?.totalFiles) confidence -= 0.2;
    if (!projectContext?.dependencies && this.config.includeDependencyAnalysis) confidence -= 0.2;

    // Reduce confidence for failed operations
    const failedOps = result.context.operations.filter(op => !op.wouldSucceed);
    if (failedOps.length > 0) {
      confidence -= Math.min(0.5, failedOps.length * 0.1);
    }

    // Reduce confidence for very large operation sets
    if (result.totalOperations > 1000) {
      confidence -= 0.1;
    }

    return Math.max(0, Math.min(1, confidence));
  }

  /**
   * Check if file is critical
   */
  private isCriticalFile(filePath: string): boolean {
    return this.config.criticalFilePatterns.some(pattern => {
      const regex = new RegExp(
        pattern.replace(/\*\*/g, '.*').replace(/\*/g, '[^/]*').replace(/\?/g, '[^/]')
      );
      return regex.test(filePath);
    });
  }

  /**
   * Check for operation dependencies
   */
  private hasOperationDependency(op1: DryRunOperation, op2: DryRunOperation): boolean {
    // Simple heuristic: operations on the same file or directory are dependent
    if (op1.target === op2.target) return true;
    
    // Check if one operation affects a parent directory of another
    const dir1 = op1.target.substring(0, op1.target.lastIndexOf('/'));
    const dir2 = op2.target.substring(0, op2.target.lastIndexOf('/'));
    
    return dir1.startsWith(dir2) || dir2.startsWith(dir1);
  }

  /**
   * Analyze dependency risks
   */
  private analyzeDependencyRisks(
    operations: DryRunOperation[],
    dependencies: ComponentDependency[]
  ): RiskFactor[] {
    const risks: RiskFactor[] = [];
    
    const highDependencyFiles = operations.filter(op => {
      const dep = dependencies.find(d => d.path === op.target);
      return dep && (dep.dependents.length > 10 || dep.criticality > 0.8);
    });

    if (highDependencyFiles.length > 0) {
      risks.push({
        type: 'dependency',
        severity: Math.min(10, highDependencyFiles.length * 2),
        description: `${highDependencyFiles.length} files with high dependency impact`,
        affected: highDependencyFiles.map(op => op.target),
        mitigation: 'Test dependent components thoroughly',
      });
    }

    return risks;
  }

  /**
   * Analyze security risks
   */
  private analyzeSecurityRisks(operations: DryRunOperation[]): RiskFactor[] {
    const risks: RiskFactor[] = [];
    
    const securitySensitiveOps = operations.filter(op =>
      op.target.includes('.env') ||
      op.target.includes('secret') ||
      op.target.includes('key') ||
      op.target.includes('password') ||
      op.target.includes('auth')
    );

    if (securitySensitiveOps.length > 0) {
      risks.push({
        type: 'security',
        severity: 8,
        description: 'Operations affecting security-sensitive files',
        affected: securitySensitiveOps.map(op => op.target),
        mitigation: 'Review security implications and update access controls',
      });
    }

    return risks;
  }

  /**
   * Analyze cascade effect risks
   */
  private analyzeCascadeRisks(operations: DryRunOperation[]): RiskFactor[] {
    const risks: RiskFactor[] = [];
    
    // Look for operations that might trigger rebuilds or recompilation
    const cascadeOps = operations.filter(op =>
      op.target.includes('config') ||
      op.target.includes('package.json') ||
      op.target.includes('tsconfig') ||
      op.target.includes('webpack') ||
      op.target.includes('vite')
    );

    if (cascadeOps.length > 0) {
      risks.push({
        type: 'cascade',
        severity: Math.min(8, cascadeOps.length * 3),
        description: 'Changes may trigger cascading effects',
        affected: cascadeOps.map(op => op.target),
        mitigation: 'Prepare for longer processing times and additional changes',
      });
    }

    return risks;
  }

  /**
   * Calculate complexity score for operations
   */
  private calculateComplexityScore(operations: DryRunOperation[]): number {
    let score = 0;

    // Base complexity from operation count
    score += Math.min(5, operations.length / 100);

    // Complexity from operation types
    const modifyOps = operations.filter(op => op.type === 'file-modify').length;
    score += Math.min(3, modifyOps / 20);

    // Complexity from size changes
    const largeSizeOps = operations.filter(op => 
      op.sizeImpact && Math.abs(op.sizeImpact) > 1000000
    ).length;
    score += Math.min(2, largeSizeOps);

    return Math.min(10, score);
  }

  /**
   * Get operation type display name
   */
  private getOperationTypeName(type: string): string {
    const names: Record<string, string> = {
      'file-write': 'File Creation',
      'file-modify': 'File Modification',
      'file-delete': 'File Deletion',
      'directory-create': 'Directory Creation',
      'directory-delete': 'Directory Deletion',
      'config-update': 'Configuration Update',
      'cache-clear': 'Cache Clear',
    };
    return names[type] || type;
  }

  /**
   * Get operation type weight
   */
  private getOperationTypeWeight(type: string): number {
    const weights: Record<string, number> = {
      'file-write': 0.3,
      'file-modify': 0.8,
      'file-delete': 0.6,
      'directory-create': 0.2,
      'directory-delete': 0.7,
      'config-update': 0.9,
      'cache-clear': 0.1,
    };
    return weights[type] || 0.5;
  }

  /**
   * Get operation type description
   */
  private getOperationTypeDescription(type: string): string {
    const descriptions: Record<string, string> = {
      'file-write': 'New files will be created',
      'file-modify': 'Existing files will be modified',
      'file-delete': 'Files will be removed',
      'directory-create': 'New directories will be created',
      'directory-delete': 'Directories will be removed',
      'config-update': 'Configuration files will be updated',
      'cache-clear': 'Cache files will be cleared',
    };
    return descriptions[type] || 'Operations of this type';
  }

  /**
   * Get file extension
   */
  private getFileExtension(filePath: string): string {
    const match = filePath.match(/\.([^.]+)$/);
    return match ? match[1].toLowerCase() : 'unknown';
  }

  /**
   * Get file type weight
   */
  private getFileTypeWeight(extension: string): number {
    const weights: Record<string, number> = {
      'js': 0.8,
      'ts': 0.8,
      'jsx': 0.8,
      'tsx': 0.8,
      'vue': 0.8,
      'css': 0.6,
      'scss': 0.6,
      'less': 0.6,
      'html': 0.7,
      'json': 0.4,
      'md': 0.2,
      'txt': 0.1,
    };
    return weights[extension] || 0.3;
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<ImpactEstimationConfig>): void {
    this.config = { ...this.config, ...config };
    this.logger.debug('Updated impact estimator configuration', config);
  }

  /**
   * Get current configuration
   */
  getConfig(): ImpactEstimationConfig {
    return { ...this.config };
  }
}

/**
 * Global impact estimator instance
 */
let globalImpactEstimator: ImpactEstimator | null = null;

/**
 * Get the global impact estimator
 */
export function getImpactEstimator(): ImpactEstimator {
  if (!globalImpactEstimator) {
    globalImpactEstimator = new ImpactEstimator();
  }
  return globalImpactEstimator;
}

/**
 * Create a new impact estimator
 */
export function createImpactEstimator(config?: Partial<ImpactEstimationConfig>): ImpactEstimator {
  return new ImpactEstimator(config);
}

/**
 * Estimate impact in one step
 */
export async function estimateChangeImpact(
  result: DryRunResult,
  projectContext?: Parameters<ImpactEstimator['estimateImpact']>[1]
): Promise<ImpactMetrics> {
  const estimator = getImpactEstimator();
  return estimator.estimateImpact(result, projectContext);
}

export default ImpactEstimator;