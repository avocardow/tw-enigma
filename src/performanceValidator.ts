import { EventEmitter } from 'events';
import { cpus, totalmem, freemem } from 'os';
// import { statSync } from 'fs';
// import { join } from 'path';
import { createLogger } from './logger';
import { type EnigmaConfig } from './config';

const logger = createLogger('performance-validator');

/**
 * Performance metrics interface
 */
export interface PerformanceMetrics {
  score: number;                    // Overall performance score (0-100)
  memoryImpact: number;            // Memory usage impact (0-100)
  cpuImpact: number;               // CPU usage impact (0-100)
  ioImpact: number;                // I/O impact (0-100)
  networkImpact: number;           // Network impact (0-100)
  buildTimeImpact: number;         // Build time impact (0-100)
  recommendations: PerformanceRecommendation[];
  warnings: PerformanceWarning[];
  bottlenecks: PerformanceBottleneck[];
}

/**
 * Performance recommendation
 */
export interface PerformanceRecommendation {
  type: 'optimization' | 'configuration' | 'resource' | 'architecture';
  priority: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  impact: string;
  implementation: string;
  estimatedImprovement: number;    // Percentage improvement
}

/**
 * Performance warning
 */
export interface PerformanceWarning {
  type: 'memory' | 'cpu' | 'io' | 'network' | 'timeout' | 'concurrency';
  severity: 'info' | 'warning' | 'error' | 'critical';
  message: string;
  currentValue: string;
  recommendedValue: string;
  impact: string;
}

/**
 * Performance bottleneck
 */
export interface PerformanceBottleneck {
  component: string;
  type: 'memory' | 'cpu' | 'io' | 'network' | 'algorithm';
  severity: number;                // 0-100
  description: string;
  cause: string;
  solution: string;
  estimatedCost: number;           // Performance cost percentage
}

/**
 * System resource information
 */
export interface SystemResources {
  cpuCores: number;
  totalMemory: number;
  freeMemory: number;
  memoryUsagePercent: number;
  platform: string;
  architecture: string;
}

/**
 * Performance benchmark results
 */
export interface BenchmarkResult {
  operation: string;
  duration: number;
  memoryUsed: number;
  cpuUsage: number;
  throughput: number;
  efficiency: number;
}

/**
 * Performance validation options
 */
export interface PerformanceValidationOptions {
  includeSystemAnalysis?: boolean;
  runBenchmarks?: boolean;
  analyzeFileSystem?: boolean;
  checkNetworkImpact?: boolean;
  generateOptimizations?: boolean;
}

/**
 * Performance validator class
 */
export class PerformanceValidator extends EventEmitter {
  private config: EnigmaConfig;
  private systemResources: SystemResources;
  private benchmarkResults: Map<string, BenchmarkResult> = new Map();
  
  constructor(config: EnigmaConfig) {
    super();
    this.config = config;
    this.systemResources = this.getSystemResources();
    
    logger.debug('PerformanceValidator initialized', {
      cpuCores: this.systemResources.cpuCores,
      totalMemory: `${Math.round(this.systemResources.totalMemory / 1024 / 1024 / 1024)}GB`,
      platform: this.systemResources.platform
    });
  }
  
  /**
   * Get system resource information
   */
  private getSystemResources(): SystemResources {
    const totalMem = totalmem();
    const freeMem = freemem();
    
    return {
      cpuCores: cpus().length,
      totalMemory: totalMem,
      freeMemory: freeMem,
      memoryUsagePercent: ((totalMem - freeMem) / totalMem) * 100,
      platform: process.platform,
      architecture: process.arch
    };
  }
  
  /**
   * Analyze configuration performance impact
   */
  public async analyzePerformance(options: PerformanceValidationOptions = {}): Promise<PerformanceMetrics> {
    const {
      // includeSystemAnalysis = true,
      runBenchmarks = false,
      analyzeFileSystem = true,
      checkNetworkImpact = false,
      generateOptimizations = true
    } = options;
    
    logger.info('Starting performance analysis');
    this.emit('analysis:start');
    
    try {
      // Analyze different performance aspects
      const memoryAnalysis = await this.analyzeMemoryImpact();
      const cpuAnalysis = await this.analyzeCpuImpact();
      const ioAnalysis = analyzeFileSystem ? await this.analyzeIoImpact() : { score: 100, warnings: [], bottlenecks: [] };
      const networkAnalysis = checkNetworkImpact ? await this.analyzeNetworkImpact() : { score: 100, warnings: [], bottlenecks: [] };
      const buildTimeAnalysis = await this.analyzeBuildTimeImpact();
      
      // Run benchmarks if requested
      if (runBenchmarks) {
        await this.runPerformanceBenchmarks();
      }
      
      // Calculate overall score
      const overallScore = this.calculateOverallScore(
        memoryAnalysis.score,
        cpuAnalysis.score,
        ioAnalysis.score,
        networkAnalysis.score,
        buildTimeAnalysis.score
      );
      
      // Generate recommendations
      const recommendations = generateOptimizations ? 
        await this.generateRecommendations(memoryAnalysis, cpuAnalysis, ioAnalysis, networkAnalysis, buildTimeAnalysis) : [];
      
      // Collect warnings and bottlenecks
      const warnings = [
        ...memoryAnalysis.warnings,
        ...cpuAnalysis.warnings,
        ...ioAnalysis.warnings,
        ...networkAnalysis.warnings,
        ...buildTimeAnalysis.warnings
      ];
      
      // Add warning for very short runtime checkInterval
      if (this.config.runtime && typeof this.config.runtime.checkInterval === 'number' && this.config.runtime.checkInterval < 1000) {
        warnings.push({
          type: 'timeout',
          severity: 'warning',
          message: `Runtime check interval (${this.config.runtime.checkInterval}ms) is very short and may cause frequent checks or network timeouts`,
          currentValue: `${this.config.runtime.checkInterval}ms`,
          recommendedValue: '>=1000ms',
          impact: 'Frequent checks may cause performance issues or network timeouts'
        });
      }
      
      const bottlenecks = [
        ...memoryAnalysis.bottlenecks,
        ...cpuAnalysis.bottlenecks,
        ...ioAnalysis.bottlenecks,
        ...networkAnalysis.bottlenecks,
        ...buildTimeAnalysis.bottlenecks
      ];
      
      const metrics: PerformanceMetrics = {
        score: overallScore,
        memoryImpact: memoryAnalysis.score,
        cpuImpact: cpuAnalysis.score,
        ioImpact: ioAnalysis.score,
        networkImpact: networkAnalysis.score,
        buildTimeImpact: buildTimeAnalysis.score,
        recommendations,
        warnings,
        bottlenecks
      };
      
      this.emit('analysis:complete', metrics);
      logger.info(`Performance analysis complete. Overall score: ${overallScore}`);
      
      return metrics;
      
    } catch (error) {
      this.emit('analysis:error', error);
      logger.error('Performance analysis failed:', error instanceof Error ? { message: error.message, stack: error.stack } : { error: String(error) });
      throw error;
    }
  }
  
  /**
   * Analyze memory impact
   */
  private async analyzeMemoryImpact(): Promise<{
    score: number;
    warnings: PerformanceWarning[];
    bottlenecks: PerformanceBottleneck[];
  }> {
    const warnings: PerformanceWarning[] = [];
    const bottlenecks: PerformanceBottleneck[] = [];
    let score = 100;
    
    // Parse memory limit
    const memoryLimit = this.parseMemoryLimit('256MB'); // Default memory limit
    const availableMemory = this.systemResources.freeMemory;
    
    // Check if memory limit is reasonable
    if (memoryLimit > availableMemory * 0.8) {
      warnings.push({
        type: 'memory',
        severity: 'warning',
        message: 'Memory limit exceeds 80% of available system memory',
        currentValue: '256MB',
        recommendedValue: `${Math.round(availableMemory * 0.6 / 1024 / 1024)}MB`,
        impact: 'May cause system instability and swapping'
      });
      score -= 20;
    }
    
    // Check concurrency vs memory
    const concurrency = this.config.maxConcurrency || 1;
    const estimatedMemoryPerWorker = memoryLimit / concurrency;
    
    if (estimatedMemoryPerWorker < 64 * 1024 * 1024) { // Less than 64MB per worker
      bottlenecks.push({
        component: 'Worker Memory Allocation',
        type: 'memory',
        severity: 75,
        description: 'Insufficient memory per worker thread',
        cause: `High concurrency (${concurrency}) with limited memory budget`,
        solution: 'Reduce concurrency or increase memory limit',
        estimatedCost: 30
      });
      score -= 25;
    }
    
    // Check for memory-intensive operations
    // Remove optimization config references as they don't exist in EnigmaConfig
    // if (this.config.optimization?.treeshake && this.config.optimization?.deadCodeElimination) {
      // warnings.push({
      //   type: 'memory',
      //   severity: 'info',
      //   message: 'Multiple memory-intensive optimizations enabled',
      //   currentValue: 'treeshake + deadCodeElimination',
      //   recommendedValue: 'Consider enabling one at a time for large projects',
      //   impact: 'Increased memory usage during processing'
      // });
      // score -= 5;
    // }
    
    return { score: Math.max(0, score), warnings, bottlenecks };
  }
  
  /**
   * Analyze CPU impact
   */
  private async analyzeCpuImpact(): Promise<{
    score: number;
    warnings: PerformanceWarning[];
    bottlenecks: PerformanceBottleneck[];
  }> {
    const warnings: PerformanceWarning[] = [];
    const bottlenecks: PerformanceBottleneck[] = [];
    let score = 100;
    
    const concurrency = this.config.maxConcurrency || 1;
    const availableCores = this.systemResources.cpuCores;
    
    // Check concurrency vs available cores
    if (concurrency > availableCores * 2) {
      warnings.push({
        type: 'cpu',
        severity: 'warning',
        message: 'Concurrency exceeds 2x available CPU cores',
        currentValue: concurrency.toString(),
        recommendedValue: (availableCores * 2).toString(),
        impact: 'Context switching overhead may reduce performance'
      });
      score -= 15;
    }
    
    // Check for CPU-intensive operations
    const cpuIntensiveOps = [];
    // Remove optimization config references as they don't exist in EnigmaConfig
    // if (this.config.optimization?.minifyClassNames) cpuIntensiveOps.push('minifyClassNames');
    // if (this.config.optimization?.treeshake) cpuIntensiveOps.push('treeshake');
    // if (this.config.optimization?.deadCodeElimination) cpuIntensiveOps.push('deadCodeElimination');
    if (this.config.minify) cpuIntensiveOps.push('minify');
    
    if (cpuIntensiveOps.length > 2) {
      bottlenecks.push({
        component: 'Optimization Pipeline',
        type: 'cpu',
        severity: 60,
        description: 'Multiple CPU-intensive optimizations enabled',
        cause: `${cpuIntensiveOps.length} CPU-intensive operations: ${cpuIntensiveOps.join(', ')}`,
        solution: 'Consider disabling some optimizations or running them sequentially',
        estimatedCost: 25
      });
      score -= 20;
    }
    
    // Check timeout vs complexity
    const timeout = 15000; // Default timeout since performance config doesn't exist
    if (timeout < 10000 && cpuIntensiveOps.length > 1) {
      warnings.push({
        type: 'timeout',
        severity: 'warning',
        message: 'Short timeout with CPU-intensive operations',
        currentValue: `${timeout}ms`,
        recommendedValue: '30000ms',
        impact: 'Operations may timeout before completion'
      });
      score -= 10;
    }
    
    return { score: Math.max(0, score), warnings, bottlenecks };
  }
  
  /**
   * Analyze I/O impact
   */
  private async analyzeIoImpact(): Promise<{
    score: number;
    warnings: PerformanceWarning[];
    bottlenecks: PerformanceBottleneck[];
  }> {
    const warnings: PerformanceWarning[] = [];
    const bottlenecks: PerformanceBottleneck[] = [];
    let score = 100;
    
    // Analyze input paths
    const inputPaths = ['./src']; // Default input paths since inputPaths doesn't exist in config
    const totalFiles = await this.estimateFileCount(inputPaths);
    
    if (totalFiles > 10000) {
      bottlenecks.push({
        component: 'File System Scanning',
        type: 'io',
        severity: 70,
        description: 'Large number of input files',
        cause: `Estimated ${totalFiles} files to process`,
        solution: 'Use more specific include/exclude patterns or reduce input scope',
        estimatedCost: 35
      });
      score -= 25;
    }
    
    // Check cache configuration
    // Remove cacheDir reference as it doesn't exist in EnigmaConfig
    // if (!this.config.cacheDir) {
      // warnings.push({
      //   type: 'io',
      //   severity: 'warning',
      //   message: 'No cache directory configured',
      //   currentValue: 'undefined',
      //   recommendedValue: './.cache/tw-enigma',
      //   impact: 'Repeated processing of unchanged files'
      // });
      // score -= 15;
    // }
    
    // Check output configuration
    // Remove output config reference as it doesn't exist in EnigmaConfig
    // if (this.config.output?.preserveOriginal && totalFiles > 5000) {
      // warnings.push({
      //   type: 'io',
      //   severity: 'info',
      //   message: 'Preserving original files with large file count',
      //   currentValue: 'true',
      //   recommendedValue: 'false for production builds',
      //   impact: 'Increased disk usage and I/O operations'
      // });
      // score -= 5;
    // }
    
    // Check watch mode impact
    if (this.config.watcher?.enabled && totalFiles > 1000) {
      warnings.push({
        type: 'io',
        severity: 'info',
        message: 'Watch mode with large file count',
        currentValue: `${totalFiles} files`,
        recommendedValue: 'Use more specific watch patterns',
        impact: 'High file system watcher overhead'
      });
      score -= 10;
    }
    
    return { score: Math.max(0, score), warnings, bottlenecks };
  }
  
  /**
   * Analyze network impact
   */
  private async analyzeNetworkImpact(): Promise<{
    score: number;
    warnings: PerformanceWarning[];
    bottlenecks: PerformanceBottleneck[];
  }> {
    const warnings: PerformanceWarning[] = [];
    const bottlenecks: PerformanceBottleneck[] = [];
    const score = 100;
    
    // Check for network-dependent operations
    // (This would be expanded based on actual network operations in the config)
    
    return { score, warnings, bottlenecks };
  }
  
  /**
   * Analyze build time impact
   */
  private async analyzeBuildTimeImpact(): Promise<{
    score: number;
    warnings: PerformanceWarning[];
    bottlenecks: PerformanceBottleneck[];
  }> {
    const warnings: PerformanceWarning[] = [];
    const bottlenecks: PerformanceBottleneck[] = [];
    let score = 100;
    
    // Estimate build time based on configuration
    const factors = {
      fileCount: await this.estimateFileCount(['./src']), // Default input paths
      optimizations: this.countOptimizations(),
              concurrency: this.config.maxConcurrency || 1,
      sourceMaps: this.config.sourceMaps || false
    };
    
    const estimatedBuildTime = this.estimateBuildTime(factors);
    
    if (estimatedBuildTime > 60000) { // More than 1 minute
      bottlenecks.push({
        component: 'Build Pipeline',
        type: 'algorithm',
        severity: 80,
        description: 'Long estimated build time',
        cause: `Estimated ${Math.round(estimatedBuildTime / 1000)}s build time`,
        solution: 'Optimize configuration or increase concurrency',
        estimatedCost: 40
      });
      score -= 30;
    }
    
    return { score: Math.max(0, score), warnings, bottlenecks };
  }
  
  /**
   * Generate performance recommendations
   */
  private async generateRecommendations(..._analyses: any[]): Promise<PerformanceRecommendation[]> {
    const recommendations: PerformanceRecommendation[] = [];
    
    // Memory optimization recommendations
    const memoryLimit = this.parseMemoryLimit(this.config.performance?.maxMemoryUsage || '256MB');
    const optimalMemory = Math.min(this.systemResources.freeMemory * 0.6, 2 * 1024 * 1024 * 1024); // Max 2GB
    
    if (memoryLimit < optimalMemory * 0.5) {
      recommendations.push({
        type: 'configuration',
        priority: 'medium',
        title: 'Increase Memory Allocation',
        description: 'Current memory limit is conservative and may limit performance',
        impact: 'Faster processing with reduced memory pressure',
        implementation: `Set maxMemoryUsage to "${Math.round(optimalMemory / 1024 / 1024)}MB"`,
        estimatedImprovement: 15
      });
    }
    
    // Concurrency optimization
    const optimalConcurrency = Math.min(this.systemResources.cpuCores, 8);
    if ((this.config.concurrency || 1) < optimalConcurrency) {
      recommendations.push({
        type: 'configuration',
        priority: 'high',
        title: 'Optimize Concurrency',
        description: 'Increase concurrency to better utilize available CPU cores',
        impact: 'Significantly faster processing for large projects',
        implementation: `Set concurrency to ${optimalConcurrency}`,
        estimatedImprovement: 30
      });
    }
    
    // Cache optimization
    if (!this.config.cacheDir) {
      recommendations.push({
        type: 'configuration',
        priority: 'high',
        title: 'Enable Caching',
        description: 'Configure cache directory to avoid reprocessing unchanged files',
        impact: 'Dramatically faster incremental builds',
        implementation: 'Set cacheDir to "./.cache/tw-enigma"',
        estimatedImprovement: 50
      });
    }
    
    // Optimization pipeline recommendations
    const optimizationCount = this.countOptimizations();
    if (optimizationCount > 3) {
      recommendations.push({
        type: 'optimization',
        priority: 'medium',
        title: 'Optimize Build Pipeline',
        description: 'Consider disabling some optimizations for faster development builds',
        impact: 'Faster development iteration cycles',
        implementation: 'Disable non-essential optimizations in development mode',
        estimatedImprovement: 25
      });
    }
    
    return recommendations;
  }
  
  /**
   * Run performance benchmarks
   */
  private async runPerformanceBenchmarks(): Promise<void> {
    logger.info('Running performance benchmarks');
    
    // Benchmark file processing
    const fileProcessingBenchmark = await this.benchmarkFileProcessing();
    this.benchmarkResults.set('fileProcessing', fileProcessingBenchmark);
    
    // Benchmark optimization operations
    const optimizationBenchmark = await this.benchmarkOptimizations();
    this.benchmarkResults.set('optimization', optimizationBenchmark);
    
    this.emit('benchmarks:complete', Array.from(this.benchmarkResults.entries()));
  }
  
  /**
   * Benchmark file processing
   */
  private async benchmarkFileProcessing(): Promise<BenchmarkResult> {
    const startTime = Date.now();
    const startMemory = process.memoryUsage().heapUsed;
    
    // Simulate file processing
    const fileCount = 100;
    for (let i = 0; i < fileCount; i++) {
      // Simulate processing overhead
      await new Promise(resolve => setImmediate(resolve));
    }
    
    const endTime = Date.now();
    const endMemory = process.memoryUsage().heapUsed;
    
    return {
      operation: 'File Processing',
      duration: endTime - startTime,
      memoryUsed: endMemory - startMemory,
      cpuUsage: 0, // Would need more sophisticated measurement
      throughput: fileCount / ((endTime - startTime) / 1000),
      efficiency: 100 // Placeholder
    };
  }
  
  /**
   * Benchmark optimization operations
   */
  private async benchmarkOptimizations(): Promise<BenchmarkResult> {
    const startTime = Date.now();
    const startMemory = process.memoryUsage().heapUsed;
    
    // Simulate optimization operations
    const operations = 50;
    for (let i = 0; i < operations; i++) {
      // Simulate CPU-intensive work
      const data = new Array(1000).fill(0).map((_, idx) => idx * Math.random());
      data.sort();
    }
    
    const endTime = Date.now();
    const endMemory = process.memoryUsage().heapUsed;
    
    return {
      operation: 'Optimization',
      duration: endTime - startTime,
      memoryUsed: endMemory - startMemory,
      cpuUsage: 0,
      throughput: operations / ((endTime - startTime) / 1000),
      efficiency: 100
    };
  }
  
  /**
   * Calculate overall performance score
   */
  private calculateOverallScore(...scores: number[]): number {
    const weights = [0.25, 0.25, 0.2, 0.1, 0.2]; // memory, cpu, io, network, buildTime
    const weightedSum = scores.reduce((sum, score, index) => sum + score * weights[index], 0);
    return Math.round(weightedSum);
  }
  
  /**
   * Parse memory limit string to bytes
   */
  private parseMemoryLimit(limit: string): number {
    const match = limit.match(/^(\d+(?:\.\d+)?)\s*(MB|GB|KB)?$/i);
    if (!match) return 256 * 1024 * 1024; // Default 256MB
    
    const value = parseFloat(match[1]);
    const unit = (match[2] || 'MB').toUpperCase();
    
    switch (unit) {
      case 'KB': return value * 1024;
      case 'MB': return value * 1024 * 1024;
      case 'GB': return value * 1024 * 1024 * 1024;
      default: return value;
    }
  }
  
  /**
   * Estimate file count for given paths
   */
  private async estimateFileCount(paths: string[]): Promise<number> {
    // This is a simplified estimation
    // In a real implementation, you'd use glob patterns and file system scanning
    return paths.length * 100; // Rough estimate
  }
  
  /**
   * Count enabled optimizations
   */
  private countOptimizations(): number {
    let count = 0;
    // Use actual EnigmaConfig properties instead of non-existent optimization object
    if (this.config.minify) count++;
    if (this.config.sourceMaps) count++;
    // Add other actual config properties that represent optimizations
    
    return count;
  }
  
  /**
   * Estimate build time based on factors
   */
  private estimateBuildTime(factors: {
    fileCount: number;
    optimizations: number;
    concurrency: number;
    sourceMaps: boolean;
  }): number {
    // Simplified build time estimation formula
    const baseTime = factors.fileCount * 10; // 10ms per file
    const optimizationOverhead = factors.optimizations * factors.fileCount * 2;
    const concurrencyFactor = Math.max(1, factors.concurrency);
    const sourceMapOverhead = factors.sourceMaps ? factors.fileCount * 5 : 0;
    
    return (baseTime + optimizationOverhead + sourceMapOverhead) / concurrencyFactor;
  }
  
  /**
   * Get benchmark results
   */
  public getBenchmarkResults(): Map<string, BenchmarkResult> {
    return new Map(this.benchmarkResults);
  }
  

}

/**
 * Create performance validator
 */
export function createPerformanceValidator(config: EnigmaConfig): PerformanceValidator {
  return new PerformanceValidator(config);
}

/**
 * Quick performance analysis
 */
export async function analyzeConfigPerformance(
  config: EnigmaConfig,
  options?: PerformanceValidationOptions
): Promise<PerformanceMetrics> {
  const validator = new PerformanceValidator(config);
  return validator.analyzePerformance(options);
}

/**
 * Get performance recommendations for configuration
 */
export async function getPerformanceRecommendations(config: EnigmaConfig): Promise<PerformanceRecommendation[]> {
  const validator = new PerformanceValidator(config);
  const metrics = await validator.analyzePerformance({ generateOptimizations: true });
  return metrics.recommendations;
}

/**
 * Export for testing and advanced usage
 */
export {
  PerformanceValidator as PerformanceValidatorClass
}; 