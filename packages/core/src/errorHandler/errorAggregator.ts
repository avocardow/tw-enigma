/**
 * Error Aggregation and Correlation System
 * 
 * This module provides comprehensive error aggregation, correlation, and analysis
 * capabilities for the TW-Enigma error handling system. It enables:
 * - Error grouping by type, frequency, and context
 * - Cross-service error correlation for root cause analysis
 * - Trend analysis and pattern detection
 * - Performance monitoring and alerting
 */

import { EventEmitter } from 'events';
import { ErrorCategory, ErrorSeverity } from './types';
import { createLogger, Logger } from '../utils/logger';

export interface ErrorAggregationConfig {
  /** Maximum number of aggregated error groups to keep in memory */
  maxGroups: number;
  /** Time window for correlation analysis (in milliseconds) */
  correlationWindow: number;
  /** Minimum occurrences for an error to be considered significant */
  significanceThreshold: number;
  /** Enable automatic pattern detection */
  enablePatternDetection: boolean;
  /** Storage backend for persistent aggregation data */
  storageBackend?: 'memory' | 'file' | 'database';
  /** File path for file-based storage */
  storageFilePath?: string;
  /** Enable real-time alerting */
  enableAlerting: boolean;
  /** Alert thresholds */
  alertThresholds: {
    errorRatePerMinute: number;
    criticalErrorThreshold: number;
    memoryUsageThreshold: number;
  };
}

export interface ErrorOccurrence {
  /** Unique occurrence ID */
  id: string;
  /** Error instance */
  error: Error;
  /** Error category */
  category: ErrorCategory;
  /** Error severity */
  severity: ErrorSeverity;
  /** Timestamp of occurrence */
  timestamp: Date;
  /** Context information */
  context: {
    operation?: string;
    component?: string;
    userId?: string;
    sessionId?: string;
    requestId?: string;
    correlationId?: string;
    filePath?: string;
    lineNumber?: number;
    metadata?: Record<string, any>;
  };
  /** Stack trace hash for grouping */
  stackHash: string;
  /** Error fingerprint for deduplication */
  fingerprint: string;
}

export interface ErrorGroup {
  /** Unique group ID */
  id: string;
  /** Error fingerprint that defines this group */
  fingerprint: string;
  /** Group signature (error type + location) */
  signature: string;
  /** Error category */
  category: ErrorCategory;
  /** Highest severity seen in this group */
  maxSeverity: ErrorSeverity;
  /** Total occurrences */
  count: number;
  /** First occurrence timestamp */
  firstSeen: Date;
  /** Last occurrence timestamp */
  lastSeen: Date;
  /** Recent occurrences (limited set) */
  recentOccurrences: ErrorOccurrence[];
  /** Context patterns */
  contextPatterns: {
    operations: Map<string, number>;
    components: Map<string, number>;
    users: Map<string, number>;
    sessions: Map<string, number>;
  };
  /** Trend analysis */
  trends: {
    hourlyDistribution: number[];
    dailyDistribution: number[];
    weeklyDistribution: number[];
    rateOfIncrease: number;
  };
  /** Associated alerts */
  alerts: ErrorAlert[];
}

export interface ErrorCorrelation {
  /** Correlation ID */
  id: string;
  /** Timestamp of correlation */
  timestamp: Date;
  /** Primary error group */
  primaryGroup: string;
  /** Related error groups */
  relatedGroups: string[];
  /** Correlation strength (0-1) */
  strength: number;
  /** Correlation type */
  type: 'temporal' | 'contextual' | 'causal' | 'pattern';
  /** Analysis details */
  analysis: {
    timeWindow: number;
    commonContext: Record<string, any>;
    pattern: string;
    confidence: number;
  };
}

export interface ErrorAlert {
  /** Alert ID */
  id: string;
  /** Alert type */
  type: 'rate_threshold' | 'critical_error' | 'pattern_detected' | 'correlation_found';
  /** Alert severity */
  severity: 'low' | 'medium' | 'high' | 'critical';
  /** Alert message */
  message: string;
  /** Timestamp */
  timestamp: Date;
  /** Related error group */
  errorGroupId: string;
  /** Alert metadata */
  metadata: Record<string, any>;
  /** Whether alert has been acknowledged */
  acknowledged: boolean;
}

export interface AggregationMetrics {
  /** Total errors processed */
  totalErrors: number;
  /** Total error groups */
  totalGroups: number;
  /** Active correlations */
  activeCorrelations: number;
  /** Memory usage */
  memoryUsage: {
    groups: number;
    occurrences: number;
    correlations: number;
  };
  /** Processing performance */
  performance: {
    avgProcessingTime: number;
    maxProcessingTime: number;
    errorsPerSecond: number;
  };
  /** Alert statistics */
  alerts: {
    total: number;
    unacknowledged: number;
    byType: Record<string, number>;
  };
}

export class ErrorAggregator extends EventEmitter {
  private config: ErrorAggregationConfig;
  private logger: Logger;
  private errorGroups = new Map<string, ErrorGroup>();
  private correlations = new Map<string, ErrorCorrelation>();
  private alerts = new Map<string, ErrorAlert>();
  private processingTimes: number[] = [];
  private errorRateTracker: Date[] = [];
  private groupCounter = 0;
  private correlationCounter = 0;
  private alertCounter = 0;

  constructor(config: Partial<ErrorAggregationConfig> = {}) {
    super();
    
    this.config = {
      maxGroups: 10000,
      correlationWindow: 300000, // 5 minutes
      significanceThreshold: 5,
      enablePatternDetection: true,
      storageBackend: 'memory',
      enableAlerting: true,
      alertThresholds: {
        errorRatePerMinute: 100,
        criticalErrorThreshold: 5,
        memoryUsageThreshold: 1000
      },
      ...config
    };

    this.logger = createLogger({
      name: 'ErrorAggregator',
      level: 'info',
      outputs: ['console']
    });

    this.startPeriodicTasks();
  }

  private startPeriodicTasks(): void {
    // Clean up old data every 5 minutes
    setInterval(() => {
      this.cleanupOldData();
    }, 300000);

    // Update trends every hour
    setInterval(() => {
      this.updateTrends();
    }, 3600000);

    // Check alerts every minute
    setInterval(() => {
      this.checkAlerts();
    }, 60000);

    // Clean up rate tracker every minute
    setInterval(() => {
      const oneMinuteAgo = new Date(Date.now() - 60000);
      this.errorRateTracker = this.errorRateTracker.filter(ts => ts > oneMinuteAgo);
    }, 60000);
  }

  public async aggregateError(
    error: Error,
    context: ErrorOccurrence['context'] = {},
    category: ErrorCategory = ErrorCategory.OPERATIONAL,
    severity: ErrorSeverity = ErrorSeverity.MEDIUM
  ): Promise<void> {
    const startTime = Date.now();

    try {
      // Create error occurrence
      const occurrence = this.createErrorOccurrence(error, context, category, severity);
      
      // Track error rate
      this.errorRateTracker.push(new Date());
      
      // Find or create error group
      const group = await this.findOrCreateErrorGroup(occurrence);
      
      // Update group with new occurrence
      this.updateErrorGroup(group, occurrence);
      
      // Detect correlations
      await this.detectCorrelations(group, occurrence);
      
      // Check for patterns
      if (this.config.enablePatternDetection) {
        await this.detectPatterns(group);
      }
      
      // Emit events
      this.emit('error-aggregated', {
        occurrence,
        group,
        isNewGroup: group.count === 1
      });
      
      // Track performance
      const processingTime = Date.now() - startTime;
      this.processingTimes.push(processingTime);
      if (this.processingTimes.length > 1000) {
        this.processingTimes = this.processingTimes.slice(-1000);
      }
      
    } catch (aggregationError) {
      this.logger.error('Error during aggregation:', aggregationError);
    }
  }

  private createErrorOccurrence(
    error: Error,
    context: ErrorOccurrence['context'],
    category: ErrorCategory,
    severity: ErrorSeverity
  ): ErrorOccurrence {
    const stackHash = this.generateStackHash(error.stack || '');
    const fingerprint = this.generateErrorFingerprint(error, context);
    
    return {
      id: `occurrence-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      error,
      category,
      severity,
      timestamp: new Date(),
      context,
      stackHash,
      fingerprint
    };
  }

  private generateStackHash(stack: string): string {
    // Simple hash of the stack trace for grouping
    let hash = 0;
    for (let i = 0; i < stack.length; i++) {
      const char = stack.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(16);
  }

  private generateErrorFingerprint(error: Error, context: ErrorOccurrence['context']): string {
    // Create a unique fingerprint for grouping similar errors
    const components = [
      error.name,
      error.message.replace(/\d+/g, 'N'), // Replace numbers with 'N'
      context.operation || 'unknown',
      context.component || 'unknown',
      this.generateStackHash(error.stack || '')
    ];
    
    return components.join('|');
  }

  private async findOrCreateErrorGroup(occurrence: ErrorOccurrence): Promise<ErrorGroup> {
    const existingGroup = this.errorGroups.get(occurrence.fingerprint);
    
    if (existingGroup) {
      return existingGroup;
    }
    
    // Create new group
    const group: ErrorGroup = {
      id: `group-${++this.groupCounter}`,
      fingerprint: occurrence.fingerprint,
      signature: `${occurrence.error.name}@${occurrence.context.operation}`,
      category: occurrence.category,
      maxSeverity: occurrence.severity,
      count: 0,
      firstSeen: occurrence.timestamp,
      lastSeen: occurrence.timestamp,
      recentOccurrences: [],
      contextPatterns: {
        operations: new Map(),
        components: new Map(),
        users: new Map(),
        sessions: new Map()
      },
      trends: {
        hourlyDistribution: new Array(24).fill(0),
        dailyDistribution: new Array(7).fill(0),
        weeklyDistribution: new Array(52).fill(0),
        rateOfIncrease: 0
      },
      alerts: []
    };
    
    this.errorGroups.set(occurrence.fingerprint, group);
    
    // Cleanup if we have too many groups
    if (this.errorGroups.size > this.config.maxGroups) {
      this.cleanupOldestGroups();
    }
    
    this.logger.info(`Created new error group: ${group.id}`, {
      fingerprint: group.fingerprint,
      signature: group.signature
    });
    
    return group;
  }

  private updateErrorGroup(group: ErrorGroup, occurrence: ErrorOccurrence): void {
    // Update basic stats
    group.count++;
    group.lastSeen = occurrence.timestamp;
    group.maxSeverity = Math.max(group.maxSeverity, occurrence.severity);
    
    // Add to recent occurrences (keep last 100)
    group.recentOccurrences.push(occurrence);
    if (group.recentOccurrences.length > 100) {
      group.recentOccurrences = group.recentOccurrences.slice(-100);
    }
    
    // Update context patterns
    if (occurrence.context.operation) {
      const count = group.contextPatterns.operations.get(occurrence.context.operation) || 0;
      group.contextPatterns.operations.set(occurrence.context.operation, count + 1);
    }
    
    if (occurrence.context.component) {
      const count = group.contextPatterns.components.get(occurrence.context.component) || 0;
      group.contextPatterns.components.set(occurrence.context.component, count + 1);
    }
    
    if (occurrence.context.userId) {
      const count = group.contextPatterns.users.get(occurrence.context.userId) || 0;
      group.contextPatterns.users.set(occurrence.context.userId, count + 1);
    }
    
    if (occurrence.context.sessionId) {
      const count = group.contextPatterns.sessions.get(occurrence.context.sessionId) || 0;
      group.contextPatterns.sessions.set(occurrence.context.sessionId, count + 1);
    }
    
    // Update trend data
    const hour = occurrence.timestamp.getHours();
    const day = occurrence.timestamp.getDay();
    const week = this.getWeekOfYear(occurrence.timestamp);
    
    group.trends.hourlyDistribution[hour]++;
    group.trends.dailyDistribution[day]++;
    group.trends.weeklyDistribution[week % 52]++;
  }

  private async detectCorrelations(group: ErrorGroup, occurrence: ErrorOccurrence): Promise<void> {
    // Find related errors within the correlation window
    const windowStart = new Date(occurrence.timestamp.getTime() - this.config.correlationWindow);
    const relatedGroups: string[] = [];
    
    for (const [fingerprint, otherGroup] of this.errorGroups) {
      if (fingerprint === group.fingerprint) continue;
      
      // Check if other group has recent activity
      if (otherGroup.lastSeen >= windowStart) {
        const correlation = this.calculateCorrelation(group, otherGroup, occurrence);
        if (correlation.strength > 0.7) { // High correlation threshold
          relatedGroups.push(otherGroup.id);
        }
      }
    }
    
    // Create correlation if related groups found
    if (relatedGroups.length > 0) {
      const correlation: ErrorCorrelation = {
        id: `correlation-${++this.correlationCounter}`,
        timestamp: occurrence.timestamp,
        primaryGroup: group.id,
        relatedGroups,
        strength: relatedGroups.length > 1 ? 0.8 : 0.7,
        type: 'temporal',
        analysis: {
          timeWindow: this.config.correlationWindow,
          commonContext: this.findCommonContext(group, relatedGroups),
          pattern: 'temporal_clustering',
          confidence: 0.8
        }
      };
      
      this.correlations.set(correlation.id, correlation);
      
      this.emit('correlation-detected', correlation);
      
      this.logger.info(`Detected correlation: ${correlation.id}`, {
        primaryGroup: group.id,
        relatedGroups,
        strength: correlation.strength
      });
    }
  }

  private calculateCorrelation(
    group1: ErrorGroup,
    group2: ErrorGroup,
    occurrence: ErrorOccurrence
  ): { strength: number; type: string } {
    let strength = 0;
    let type = 'unknown';
    
    // Temporal correlation
    const timeDiff = Math.abs(group1.lastSeen.getTime() - group2.lastSeen.getTime());
    if (timeDiff < 60000) { // Within 1 minute
      strength += 0.4;
      type = 'temporal';
    }
    
    // Context correlation
    const commonOperations = this.findCommonMapEntries(
      group1.contextPatterns.operations,
      group2.contextPatterns.operations
    );
    if (commonOperations.length > 0) {
      strength += 0.3;
      type = 'contextual';
    }
    
    // Component correlation
    const commonComponents = this.findCommonMapEntries(
      group1.contextPatterns.components,
      group2.contextPatterns.components
    );
    if (commonComponents.length > 0) {
      strength += 0.3;
      type = 'contextual';
    }
    
    return { strength: Math.min(1, strength), type };
  }

  private findCommonMapEntries<T>(map1: Map<T, number>, map2: Map<T, number>): T[] {
    const common: T[] = [];
    for (const [key] of map1) {
      if (map2.has(key)) {
        common.push(key);
      }
    }
    return common;
  }

  private findCommonContext(group: ErrorGroup, relatedGroupIds: string[]): Record<string, any> {
    const common: Record<string, any> = {};
    
    // Find common operations
    const allOperations = new Set(group.contextPatterns.operations.keys());
    for (const groupId of relatedGroupIds) {
      const relatedGroup = Array.from(this.errorGroups.values()).find(g => g.id === groupId);
      if (relatedGroup) {
        for (const op of relatedGroup.contextPatterns.operations.keys()) {
          if (allOperations.has(op)) {
            common.operations = common.operations || [];
            if (!common.operations.includes(op)) {
              common.operations.push(op);
            }
          }
        }
      }
    }
    
    return common;
  }

  private async detectPatterns(group: ErrorGroup): Promise<void> {
    // Pattern detection logic
    if (group.count >= this.config.significanceThreshold) {
      // Check for spike patterns
      const recentCount = group.recentOccurrences.filter(
        occ => occ.timestamp.getTime() > Date.now() - 300000 // Last 5 minutes
      ).length;
      
      if (recentCount > group.count * 0.5) { // More than 50% of errors in last 5 minutes
        this.createAlert({
          type: 'pattern_detected',
          severity: 'high',
          message: `Error spike detected in group ${group.id}`,
          errorGroupId: group.id,
          metadata: {
            recentCount,
            totalCount: group.count,
            pattern: 'spike'
          }
        });
      }
    }
  }

  private createAlert(alertData: {
    type: ErrorAlert['type'];
    severity: ErrorAlert['severity'];
    message: string;
    errorGroupId: string;
    metadata: Record<string, any>;
  }): void {
    const alert: ErrorAlert = {
      id: `alert-${++this.alertCounter}`,
      timestamp: new Date(),
      acknowledged: false,
      ...alertData
    };
    
    this.alerts.set(alert.id, alert);
    
    // Add alert to the error group
    const group = Array.from(this.errorGroups.values()).find(g => g.id === alertData.errorGroupId);
    if (group) {
      group.alerts.push(alert);
    }
    
    this.emit('alert-created', alert);
    
    this.logger.warn(`Alert created: ${alert.message}`, {
      alertId: alert.id,
      type: alert.type,
      severity: alert.severity
    });
  }

  private cleanupOldData(): void {
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    
    // Remove old error groups
    for (const [fingerprint, group] of this.errorGroups) {
      if (group.lastSeen < oneWeekAgo && group.count < this.config.significanceThreshold) {
        this.errorGroups.delete(fingerprint);
      }
    }
    
    // Remove old correlations
    for (const [id, correlation] of this.correlations) {
      if (correlation.timestamp < oneWeekAgo) {
        this.correlations.delete(id);
      }
    }
    
    // Remove acknowledged alerts older than 24 hours
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    for (const [id, alert] of this.alerts) {
      if (alert.acknowledged && alert.timestamp < oneDayAgo) {
        this.alerts.delete(id);
      }
    }
  }

  private cleanupOldestGroups(): void {
    // Remove oldest groups that are least active
    const groups = Array.from(this.errorGroups.values())
      .sort((a, b) => {
        // Sort by last seen (oldest first) and count (lowest first)
        const timeDiff = a.lastSeen.getTime() - b.lastSeen.getTime();
        return timeDiff !== 0 ? timeDiff : a.count - b.count;
      });
    
    // Remove oldest 10% of groups
    const toRemove = Math.floor(groups.length * 0.1);
    for (let i = 0; i < toRemove; i++) {
      this.errorGroups.delete(groups[i].fingerprint);
    }
  }

  private updateTrends(): void {
    for (const group of this.errorGroups.values()) {
      // Calculate rate of increase based on recent activity
      const oneHourAgo = new Date(Date.now() - 3600000);
      const recentCount = group.recentOccurrences.filter(
        occ => occ.timestamp > oneHourAgo
      ).length;
      
      const previousHourCount = group.recentOccurrences.filter(
        occ => occ.timestamp < oneHourAgo && 
               occ.timestamp > new Date(Date.now() - 7200000)
      ).length;
      
      group.trends.rateOfIncrease = previousHourCount > 0 
        ? (recentCount - previousHourCount) / previousHourCount 
        : 0;
    }
  }

  private checkAlerts(): void {
    // Check error rate alerts
    const currentRate = this.errorRateTracker.length;
    if (currentRate > this.config.alertThresholds.errorRatePerMinute) {
      this.createAlert({
        type: 'rate_threshold',
        severity: 'high',
        message: `High error rate detected: ${currentRate} errors/minute`,
        errorGroupId: 'system',
        metadata: {
          currentRate,
          threshold: this.config.alertThresholds.errorRatePerMinute
        }
      });
    }
    
    // Check critical error alerts
    for (const group of this.errorGroups.values()) {
      if (group.maxSeverity >= ErrorSeverity.CRITICAL) {
        const recentCritical = group.recentOccurrences.filter(
          occ => occ.severity >= ErrorSeverity.CRITICAL &&
                 occ.timestamp.getTime() > Date.now() - 300000
        ).length;
        
        if (recentCritical >= this.config.alertThresholds.criticalErrorThreshold) {
          this.createAlert({
            type: 'critical_error',
            severity: 'critical',
            message: `Critical errors detected in group ${group.id}`,
            errorGroupId: group.id,
            metadata: {
              criticalCount: recentCritical,
              threshold: this.config.alertThresholds.criticalErrorThreshold
            }
          });
        }
      }
    }
  }

  private getWeekOfYear(date: Date): number {
    const start = new Date(date.getFullYear(), 0, 1);
    const diff = date.getTime() - start.getTime();
    return Math.floor(diff / (7 * 24 * 60 * 60 * 1000));
  }

  // Public API methods

  public getErrorGroups(filter?: {
    category?: ErrorCategory;
    minSeverity?: ErrorSeverity;
    since?: Date;
    limit?: number;
  }): ErrorGroup[] {
    let groups = Array.from(this.errorGroups.values());
    
    if (filter) {
      if (filter.category !== undefined) {
        groups = groups.filter(g => g.category === filter.category);
      }
      
      if (filter.minSeverity !== undefined) {
        groups = groups.filter(g => g.maxSeverity >= filter.minSeverity);
      }
      
      if (filter.since) {
        groups = groups.filter(g => g.lastSeen >= filter.since!);
      }
      
      if (filter.limit) {
        groups = groups.slice(0, filter.limit);
      }
    }
    
    return groups.sort((a, b) => b.lastSeen.getTime() - a.lastSeen.getTime());
  }

  public getCorrelations(groupId?: string): ErrorCorrelation[] {
    const correlations = Array.from(this.correlations.values());
    
    if (groupId) {
      return correlations.filter(
        c => c.primaryGroup === groupId || c.relatedGroups.includes(groupId)
      );
    }
    
    return correlations.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  public getAlerts(filter?: {
    type?: ErrorAlert['type'];
    severity?: ErrorAlert['severity'];
    acknowledged?: boolean;
    since?: Date;
  }): ErrorAlert[] {
    let alerts = Array.from(this.alerts.values());
    
    if (filter) {
      if (filter.type) {
        alerts = alerts.filter(a => a.type === filter.type);
      }
      
      if (filter.severity) {
        alerts = alerts.filter(a => a.severity === filter.severity);
      }
      
      if (filter.acknowledged !== undefined) {
        alerts = alerts.filter(a => a.acknowledged === filter.acknowledged);
      }
      
      if (filter.since) {
        alerts = alerts.filter(a => a.timestamp >= filter.since!);
      }
    }
    
    return alerts.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  public acknowledgeAlert(alertId: string): boolean {
    const alert = this.alerts.get(alertId);
    if (alert) {
      alert.acknowledged = true;
      this.emit('alert-acknowledged', alert);
      return true;
    }
    return false;
  }

  public getMetrics(): AggregationMetrics {
    const totalOccurrences = Array.from(this.errorGroups.values())
      .reduce((sum, group) => sum + group.count, 0);
    
    const avgProcessingTime = this.processingTimes.length > 0
      ? this.processingTimes.reduce((a, b) => a + b, 0) / this.processingTimes.length
      : 0;
    
    const maxProcessingTime = this.processingTimes.length > 0
      ? Math.max(...this.processingTimes)
      : 0;
    
    const errorsPerSecond = this.errorRateTracker.length / 60; // Rate per second over last minute
    
    const unacknowledgedAlerts = Array.from(this.alerts.values())
      .filter(a => !a.acknowledged).length;
    
    const alertsByType = Array.from(this.alerts.values())
      .reduce((acc, alert) => {
        acc[alert.type] = (acc[alert.type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
    
    return {
      totalErrors: totalOccurrences,
      totalGroups: this.errorGroups.size,
      activeCorrelations: this.correlations.size,
      memoryUsage: {
        groups: this.errorGroups.size,
        occurrences: totalOccurrences,
        correlations: this.correlations.size
      },
      performance: {
        avgProcessingTime,
        maxProcessingTime,
        errorsPerSecond
      },
      alerts: {
        total: this.alerts.size,
        unacknowledged: unacknowledgedAlerts,
        byType: alertsByType
      }
    };
  }

  public updateConfig(updates: Partial<ErrorAggregationConfig>): void {
    this.config = { ...this.config, ...updates };
  }

  public close(): void {
    this.removeAllListeners();
    this.errorGroups.clear();
    this.correlations.clear();
    this.alerts.clear();
    this.processingTimes = [];
    this.errorRateTracker = [];
  }
}

// Global instance
let globalErrorAggregator: ErrorAggregator | null = null;

export function getErrorAggregator(): ErrorAggregator {
  if (!globalErrorAggregator) {
    globalErrorAggregator = new ErrorAggregator();
  }
  return globalErrorAggregator;
}

export function setErrorAggregator(aggregator: ErrorAggregator): void {
  if (globalErrorAggregator) {
    globalErrorAggregator.close();
  }
  globalErrorAggregator = aggregator;
}

// Convenience functions
export async function aggregateError(
  error: Error,
  context?: ErrorOccurrence['context'],
  category?: ErrorCategory,
  severity?: ErrorSeverity
): Promise<void> {
  return getErrorAggregator().aggregateError(error, context, category, severity);
}

export function getErrorAnalytics(): AggregationMetrics {
  return getErrorAggregator().getMetrics();
}

// Export types
export type {
  ErrorAggregationConfig,
  ErrorOccurrence,
  ErrorGroup,
  ErrorCorrelation,
  ErrorAlert,
  AggregationMetrics
};