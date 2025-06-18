/**
 * Copyright (c) 2025 Rowan Cardow
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Logger } from './logger';

/**
 * Warning levels for the warning system
 */
export enum WarningLevel {
  INFO = 'info',
  WARNING = 'warning',
  CRITICAL = 'critical',
}

/**
 * Configuration for the warning system
 */
export interface WarningConfig {
  /** Minimum length value that triggers warnings */
  lengthThreshold: number;
  /** Whether to show capacity tables in warnings */
  showCapacityTable: boolean;
  /** Whether to show performance implications */
  showPerformanceInfo: boolean;
  /** Whether warnings are enabled */
  enabled: boolean;
  /** Logger instance to use for warnings */
  logger?: Logger;
  /** Alphabet used for capacity calculations */
  alphabet: string;
}

/**
 * Data structure for length warning information
 */
export interface LengthWarningData {
  /** Requested length value */
  length: number;
  /** Warning level */
  level: WarningLevel;
  /** Main warning message */
  message: string;
  /** Capacity information table */
  capacityTable: CapacityInfo[];
  /** Performance implications */
  performanceInfo: PerformanceInfo;
  /** Recommendations for the user */
  recommendations: string[];
}

/**
 * Capacity information for a specific length
 */
export interface CapacityInfo {
  /** Length value */
  length: number;
  /** Total capacity at this length */
  capacity: number;
  /** Cumulative capacity up to this length */
  cumulativeCapacity: number;
  /** Human-readable capacity description */
  description: string;
}

/**
 * Performance impact information
 */
export interface PerformanceInfo {
  /** Estimated computational overhead */
  computationalOverhead: string;
  /** Memory usage implications */
  memoryUsage: string;
  /** Processing time estimate */
  processingTime: string;
  /** Risk level */
  riskLevel: 'low' | 'moderate' | 'high' | 'extreme';
}

/**
 * Default warning configuration
 */
const DEFAULT_WARNING_CONFIG: WarningConfig = {
  lengthThreshold: 15,
  showCapacityTable: true,
  showPerformanceInfo: true,
  enabled: true,
  alphabet: 'abcdefghijklmnopqrstuvwxyz',
};

/**
 * Warning System Class
 * Manages length-based warnings with capacity tables and performance implications
 */
export class WarningSystem {
  private config: WarningConfig;
  private logger: Logger;

  constructor(config: Partial<WarningConfig> = {}) {
    this.config = { ...DEFAULT_WARNING_CONFIG, ...config };
    this.logger = config.logger || new Logger({ component: 'WarningSystem' });
  }

  /**
   * Check if a length value should trigger a warning
   */
  shouldWarn(length: number): boolean {
    return this.config.enabled && length >= this.config.lengthThreshold;
  }

  /**
   * Generate warning data for a given length
   */
  generateWarningData(length: number): LengthWarningData {
    const level = this.determineWarningLevel(length);
    const message = this.generateWarningMessage(length, level);
    const capacityTable = this.generateCapacityTable(length);
    const performanceInfo = this.generatePerformanceInfo(length);
    const recommendations = this.generateRecommendations(length, level);

    return {
      length,
      level,
      message,
      capacityTable,
      performanceInfo,
      recommendations,
    };
  }

  /**
   * Display warning for high length value
   */
  warnForHighLength(length: number): void {
    if (!this.shouldWarn(length)) {
      return;
    }

    const warningData = this.generateWarningData(length);
    this.displayWarning(warningData);
  }

  /**
   * Update warning configuration
   */
  updateConfig(newConfig: Partial<WarningConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Get current configuration
   */
  getConfig(): WarningConfig {
    return { ...this.config };
  }

  /**
   * Determine warning level based on length value
   */
  private determineWarningLevel(length: number): WarningLevel {
    if (length >= 25) {
      return WarningLevel.CRITICAL;
    } else if (length >= 20) {
      return WarningLevel.WARNING;
    } else {
      return WarningLevel.INFO;
    }
  }

  /**
   * Generate the main warning message
   */
  private generateWarningMessage(length: number, level: WarningLevel): string {
    switch (level) {
      case WarningLevel.CRITICAL:
        return `🚨 CRITICAL: Length ${length} is extremely high and may cause severe performance issues`;
      case WarningLevel.WARNING:
        return `⚠️  WARNING: Length ${length} is high and may impact performance`;
      case WarningLevel.INFO:
        return `ℹ️  INFO: Length ${length} may have increased computational overhead`;
      default:
        return `Length ${length} exceeds recommended threshold`;
    }
  }

  /**
   * Generate capacity table for length analysis
   */
  private generateCapacityTable(maxLength: number): CapacityInfo[] {
    const table: CapacityInfo[] = [];
    const base = this.config.alphabet.length;
    let cumulativeCapacity = 0;

    for (let length = 1; length <= Math.min(maxLength, 10); length++) {
      const capacity = Math.pow(base, length);
      cumulativeCapacity += capacity;

      table.push({
        length,
        capacity,
        cumulativeCapacity,
        description: this.formatCapacityDescription(capacity),
      });
    }

    return table;
  }

  /**
   * Generate performance impact information
   */
  private generatePerformanceInfo(length: number): PerformanceInfo {
    let riskLevel: 'low' | 'moderate' | 'high' | 'extreme' = 'low';
    let computationalOverhead = 'Minimal';
    let memoryUsage = 'Low';
    let processingTime = 'Fast';

    if (length >= 25) {
      riskLevel = 'extreme';
      computationalOverhead = 'Extreme (exponential growth)';
      memoryUsage = 'Very High (>1GB potential)';
      processingTime = 'Very Slow (minutes)';
    } else if (length >= 20) {
      riskLevel = 'high';
      computationalOverhead = 'High (significant impact)';
      memoryUsage = 'High (100MB+)';
      processingTime = 'Slow (several seconds)';
    } else if (length >= 17) {
      riskLevel = 'moderate';
      computationalOverhead = 'Moderate (noticeable impact)';
      memoryUsage = 'Moderate (10-100MB)';
      processingTime = 'Moderate (1-5 seconds)';
    } else if (length >= 15) {
      riskLevel = 'low';
      computationalOverhead = 'Low (minor impact)';
      memoryUsage = 'Low (<10MB)';
      processingTime = 'Still Fast (<1 second)';
    }

    return {
      computationalOverhead,
      memoryUsage,
      processingTime,
      riskLevel,
    };
  }

  /**
   * Generate recommendations based on length and warning level
   */
  private generateRecommendations(length: number, level: WarningLevel): string[] {
    const recommendations: string[] = [];

    switch (level) {
      case WarningLevel.CRITICAL:
        recommendations.push('Consider using a lower length value (10-15) for better performance');
        recommendations.push(
          'For extreme obfuscation, consider length 12-15 which still provides strong security'
        );
        recommendations.push('Use --pretty flag to optimize name generation for specific patterns');
        recommendations.push('Consider processing smaller batches of files to manage memory usage');
        break;

      case WarningLevel.WARNING:
        recommendations.push(
          'Consider using length 10-15 for optimal performance vs security balance'
        );
        recommendations.push('Monitor memory usage during processing of large projects');
        recommendations.push('Use caching to improve performance for repeated operations');
        break;

      case WarningLevel.INFO:
        recommendations.push(
          'This length provides good security while maintaining reasonable performance'
        );
        recommendations.push('Consider your project size when using this length value');
        break;
    }

    // Add general recommendations
    if (length >= 15) {
      recommendations.push('Use --quiet-warnings to suppress these warnings if intentional');
      recommendations.push('Monitor build times and adjust length if needed');
    }

    return recommendations;
  }

  /**
   * Format capacity description in human-readable format
   */
  private formatCapacityDescription(capacity: number): string {
    if (capacity >= 1e12) {
      return `${(capacity / 1e12).toFixed(1)} trillion combinations`;
    } else if (capacity >= 1e9) {
      return `${(capacity / 1e9).toFixed(1)} billion combinations`;
    } else if (capacity >= 1e6) {
      return `${(capacity / 1e6).toFixed(1)} million combinations`;
    } else if (capacity >= 1e3) {
      return `${(capacity / 1e3).toFixed(1)} thousand combinations`;
    } else {
      return `${capacity} combinations`;
    }
  }

  /**
   * Display the warning with formatted output
   */
  private displayWarning(warningData: LengthWarningData): void {
    const { level, message, capacityTable, performanceInfo, recommendations } = warningData;

    // Log main warning message
    switch (level) {
      case WarningLevel.CRITICAL:
        this.logger.error(message);
        break;
      case WarningLevel.WARNING:
        this.logger.warn(message);
        break;
      case WarningLevel.INFO:
        this.logger.info(message);
        break;
    }

    // Show capacity table if enabled
    if (this.config.showCapacityTable && capacityTable.length > 0) {
      this.logger.info('📊 Capacity Analysis:');
      capacityTable.forEach((info) => {
        this.logger.info(
          `  Length ${info.length}: ${info.description} (cumulative: ${this.formatCapacityDescription(info.cumulativeCapacity)})`
        );
      });
    }

    // Show performance info if enabled
    if (this.config.showPerformanceInfo) {
      this.logger.info('⚡ Performance Impact:');
      this.logger.info(`  Computational Overhead: ${performanceInfo.computationalOverhead}`);
      this.logger.info(`  Memory Usage: ${performanceInfo.memoryUsage}`);
      this.logger.info(`  Processing Time: ${performanceInfo.processingTime}`);
      this.logger.info(`  Risk Level: ${performanceInfo.riskLevel.toUpperCase()}`);
    }

    // Show recommendations
    if (recommendations.length > 0) {
      this.logger.info('💡 Recommendations:');
      recommendations.forEach((rec) => {
        this.logger.info(`  • ${rec}`);
      });
    }
  }
}

/**
 * Create a default warning system instance
 */
let defaultWarningSystem: WarningSystem | null = null;

/**
 * Get the default warning system instance
 */
export function getDefaultWarningSystem(): WarningSystem {
  if (!defaultWarningSystem) {
    defaultWarningSystem = new WarningSystem();
  }
  return defaultWarningSystem;
}

/**
 * Convenience function to warn for high length values
 */
export function warnForHighLength(length: number, config?: Partial<WarningConfig>): void {
  if (config) {
    const warningSystem = new WarningSystem(config);
    warningSystem.warnForHighLength(length);
  } else {
    getDefaultWarningSystem().warnForHighLength(length);
  }
}

/**
 * Convenience function to check if a length should trigger a warning
 */
export function shouldWarn(length: number, threshold: number = 15): boolean {
  return length >= threshold;
}

/**
 * Generate capacity table for external use
 */
export function generateCapacityTable(maxLength: number, alphabet?: string): CapacityInfo[] {
  const warningSystem = new WarningSystem({ alphabet: alphabet || 'abcdefghijklmnopqrstuvwxyz' });
  return warningSystem.generateWarningData(maxLength).capacityTable;
}
