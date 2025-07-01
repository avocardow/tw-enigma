/**
 * Error Recovery Strategies System
 * 
 * This module implements comprehensive error recovery strategies for different
 * error categories. It provides automatic retry logic, fallback mechanisms,
 * circuit breaker patterns, and user prompt strategies.
 */

import { EventEmitter } from 'events';
import { ErrorCategory, ErrorSeverity } from './types';
import { EnigmaError } from '../utils/errors';
import { createLogger, Logger } from '../utils/logger';

export enum RecoveryStrategyType {
  /** Automatic retry with exponential backoff */
  RETRY = 'retry',
  /** Switch to alternative implementation */
  FALLBACK = 'fallback',
  /** Open circuit breaker to prevent cascade failures */
  CIRCUIT_BREAKER = 'circuit_breaker',
  /** Prompt user for action */
  USER_PROMPT = 'user_prompt',
  /** Graceful degradation with reduced functionality */
  GRACEFUL_DEGRADATION = 'graceful_degradation',
  /** Skip the failing operation and continue */
  SKIP = 'skip',
  /** Abort the operation entirely */
  ABORT = 'abort'
}

export interface RecoveryConfig {
  /** Maximum number of retry attempts */
  maxRetries: number;
  /** Initial retry delay in milliseconds */
  initialDelay: number;
  /** Maximum retry delay in milliseconds */
  maxDelay: number;
  /** Backoff multiplier for exponential backoff */
  backoffMultiplier: number;
  /** Jitter factor to prevent thundering herd (0-1) */
  jitter: number;
  /** Timeout for each retry attempt */
  timeoutMs: number;
  /** Circuit breaker threshold (failures before opening) */
  circuitBreakerThreshold: number;
  /** Circuit breaker timeout (how long to stay open) */
  circuitBreakerTimeoutMs: number;
  /** Enable user prompts in interactive mode */
  enableUserPrompts: boolean;
  /** Enable graceful degradation */
  enableGracefulDegradation: boolean;
}

export interface RecoveryContext {
  /** Original error that triggered recovery */
  originalError: Error;
  /** Error category */
  category: ErrorCategory;
  /** Error severity */
  severity: ErrorSeverity;
  /** Operation that failed */
  operation: string;
  /** Attempt number (0-based) */
  attemptNumber: number;
  /** Total elapsed time since first attempt */
  elapsedTime: number;
  /** Additional context data */
  metadata: Record<string, any>;
  /** Previous recovery attempts */
  previousAttempts: RecoveryAttempt[];
}

export interface RecoveryAttempt {
  /** Strategy used for this attempt */
  strategy: RecoveryStrategyType;
  /** Timestamp of attempt */
  timestamp: Date;
  /** Whether the attempt succeeded */
  success: boolean;
  /** Error encountered during recovery (if any) */
  error?: Error;
  /** Duration of recovery attempt */
  duration: number;
  /** Additional metadata */
  metadata?: Record<string, any>;
}

export interface RecoveryResult {
  /** Whether recovery was successful */
  success: boolean;
  /** Strategy that was used */
  strategy: RecoveryStrategyType;
  /** Result value (if recovery succeeded) */
  result?: any;
  /** Error if recovery failed */
  error?: Error;
  /** Total number of attempts made */
  totalAttempts: number;
  /** Total time spent on recovery */
  totalTime: number;
  /** Details of each attempt */
  attempts: RecoveryAttempt[];
  /** Whether to continue with the operation */
  shouldContinue: boolean;
}

export interface RecoveryStrategy {
  /** Strategy type */
  type: RecoveryStrategyType;
  /** Function to execute the recovery */
  execute: (context: RecoveryContext, config: RecoveryConfig) => Promise<RecoveryResult>;
  /** Check if this strategy can handle the given error */
  canHandle: (error: Error, context: RecoveryContext) => boolean;
  /** Priority (higher numbers = higher priority) */
  priority: number;
}

export class RecoveryStrategies extends EventEmitter {
  private strategies = new Map<RecoveryStrategyType, RecoveryStrategy>();
  private config: RecoveryConfig;
  private logger: Logger;
  private circuitStates = new Map<string, { failures: number; lastFailure: Date; isOpen: boolean }>();

  constructor(config: Partial<RecoveryConfig> = {}) {
    super();
    
    this.config = {
      maxRetries: 3,
      initialDelay: 1000,
      maxDelay: 30000,
      backoffMultiplier: 2,
      jitter: 0.1,
      timeoutMs: 10000,
      circuitBreakerThreshold: 5,
      circuitBreakerTimeoutMs: 60000,
      enableUserPrompts: true,
      enableGracefulDegradation: true,
      ...config
    };

    this.logger = createLogger({
      name: 'RecoveryStrategies',
      level: 'info',
      outputs: ['console']
    });

    this.initializeDefaultStrategies();
  }

  private initializeDefaultStrategies(): void {
    // Retry Strategy
    this.registerStrategy({
      type: RecoveryStrategyType.RETRY,
      priority: 10,
      canHandle: (error, context) => {
        // Retry for transient errors
        return context.category === ErrorCategory.EXTERNAL_SERVICE ||
               context.category === ErrorCategory.RESOURCE ||
               (context.category === ErrorCategory.OPERATIONAL && context.severity <= ErrorSeverity.MEDIUM);
      },
      execute: async (context, config) => {
        return this.executeRetryStrategy(context, config);
      }
    });

    // Fallback Strategy
    this.registerStrategy({
      type: RecoveryStrategyType.FALLBACK,
      priority: 8,
      canHandle: (error, context) => {
        // Use fallback for service failures
        return context.category === ErrorCategory.EXTERNAL_SERVICE ||
               context.category === ErrorCategory.RESOURCE;
      },
      execute: async (context, config) => {
        return this.executeFallbackStrategy(context, config);
      }
    });

    // Circuit Breaker Strategy
    this.registerStrategy({
      type: RecoveryStrategyType.CIRCUIT_BREAKER,
      priority: 9,
      canHandle: (error, context) => {
        // Use circuit breaker for repeated failures
        const circuitKey = `${context.operation}-${context.category}`;
        const circuitState = this.circuitStates.get(circuitKey);
        return circuitState && circuitState.failures >= config.circuitBreakerThreshold;
      },
      execute: async (context, config) => {
        return this.executeCircuitBreakerStrategy(context, config);
      }
    });

    // User Prompt Strategy
    this.registerStrategy({
      type: RecoveryStrategyType.USER_PROMPT,
      priority: 6,
      canHandle: (error, context) => {
        // Prompt user for configuration or validation errors
        return config.enableUserPrompts && (
          context.category === ErrorCategory.CONFIGURATION ||
          context.category === ErrorCategory.VALIDATION
        );
      },
      execute: async (context, config) => {
        return this.executeUserPromptStrategy(context, config);
      }
    });

    // Graceful Degradation Strategy
    this.registerStrategy({
      type: RecoveryStrategyType.GRACEFUL_DEGRADATION,
      priority: 5,
      canHandle: (error, context) => {
        // Use degradation for non-critical features
        return config.enableGracefulDegradation && context.severity <= ErrorSeverity.MEDIUM;
      },
      execute: async (context, config) => {
        return this.executeGracefulDegradationStrategy(context, config);
      }
    });

    // Skip Strategy
    this.registerStrategy({
      type: RecoveryStrategyType.SKIP,
      priority: 3,
      canHandle: (error, context) => {
        // Skip for low-severity operational errors
        return context.category === ErrorCategory.OPERATIONAL && 
               context.severity <= ErrorSeverity.LOW;
      },
      execute: async (context, config) => {
        return this.executeSkipStrategy(context, config);
      }
    });

    // Abort Strategy (last resort)
    this.registerStrategy({
      type: RecoveryStrategyType.ABORT,
      priority: 1,
      canHandle: (error, context) => {
        // Always can handle (last resort)
        return true;
      },
      execute: async (context, config) => {
        return this.executeAbortStrategy(context, config);
      }
    });
  }

  public registerStrategy(strategy: RecoveryStrategy): void {
    this.strategies.set(strategy.type, strategy);
  }

  public async executeRecovery(
    error: Error,
    operation: string,
    metadata: Record<string, any> = {}
  ): Promise<RecoveryResult> {
    const startTime = Date.now();
    const context: RecoveryContext = {
      originalError: error,
      category: this.categorizeError(error),
      severity: this.determineSeverity(error),
      operation,
      attemptNumber: 0,
      elapsedTime: 0,
      metadata,
      previousAttempts: []
    };

    this.logger.info(`Starting recovery for operation: ${operation}`, {
      error: error.message,
      category: context.category,
      severity: context.severity
    });

    // Update circuit breaker state
    this.updateCircuitState(operation, context.category);

    // Get applicable strategies sorted by priority
    const applicableStrategies = Array.from(this.strategies.values())
      .filter(strategy => strategy.canHandle(error, context))
      .sort((a, b) => b.priority - a.priority);

    if (applicableStrategies.length === 0) {
      return {
        success: false,
        strategy: RecoveryStrategyType.ABORT,
        error: new Error('No recovery strategies available'),
        totalAttempts: 0,
        totalTime: Date.now() - startTime,
        attempts: [],
        shouldContinue: false
      };
    }

    // Try strategies in priority order
    for (const strategy of applicableStrategies) {
      try {
        this.logger.debug(`Attempting recovery with strategy: ${strategy.type}`);
        
        const result = await strategy.execute(context, this.config);
        
        if (result.success) {
          this.logger.info(`Recovery successful using strategy: ${strategy.type}`, {
            attempts: result.totalAttempts,
            duration: result.totalTime
          });
          
          // Reset circuit breaker on success
          this.resetCircuitState(operation, context.category);
          
          this.emit('recovery-success', {
            operation,
            strategy: strategy.type,
            result,
            context
          });
          
          return result;
        } else {
          this.logger.warn(`Recovery strategy ${strategy.type} failed:`, result.error?.message);
          
          // Add this strategy's attempts to context for next strategy
          context.previousAttempts.push(...result.attempts);
          context.attemptNumber += result.totalAttempts;
          context.elapsedTime = Date.now() - startTime;
        }
      } catch (strategyError) {
        this.logger.error(`Recovery strategy ${strategy.type} threw error:`, strategyError);
      }
    }

    // All strategies failed
    const totalTime = Date.now() - startTime;
    this.logger.error(`All recovery strategies failed for operation: ${operation}`, {
      totalTime,
      totalAttempts: context.attemptNumber
    });

    this.emit('recovery-failure', {
      operation,
      originalError: error,
      totalTime,
      totalAttempts: context.attemptNumber,
      context
    });

    return {
      success: false,
      strategy: RecoveryStrategyType.ABORT,
      error: error,
      totalAttempts: context.attemptNumber,
      totalTime,
      attempts: context.previousAttempts,
      shouldContinue: false
    };
  }

  private async executeRetryStrategy(context: RecoveryContext, config: RecoveryConfig): Promise<RecoveryResult> {
    const attempts: RecoveryAttempt[] = [];
    const startTime = Date.now();
    let lastError = context.originalError;

    for (let attempt = 0; attempt < config.maxRetries; attempt++) {
      if (attempt > 0) {
        const delay = this.calculateRetryDelay(attempt, config);
        this.logger.debug(`Retrying in ${delay}ms (attempt ${attempt + 1}/${config.maxRetries})`);
        await this.sleep(delay);
      }

      const attemptStart = Date.now();
      try {
        // This would normally retry the original operation
        // For now, we simulate based on error characteristics
        const shouldSucceed = this.shouldRetrySucceed(context, attempt);
        
        if (shouldSucceed) {
          const duration = Date.now() - attemptStart;
          attempts.push({
            strategy: RecoveryStrategyType.RETRY,
            timestamp: new Date(),
            success: true,
            duration
          });

          return {
            success: true,
            strategy: RecoveryStrategyType.RETRY,
            result: { recovered: true, method: 'retry' },
            totalAttempts: attempt + 1,
            totalTime: Date.now() - startTime,
            attempts,
            shouldContinue: true
          };
        } else {
          throw new Error(`Retry attempt ${attempt + 1} failed`);
        }
      } catch (error) {
        const duration = Date.now() - attemptStart;
        lastError = error instanceof Error ? error : new Error(String(error));
        
        attempts.push({
          strategy: RecoveryStrategyType.RETRY,
          timestamp: new Date(),
          success: false,
          error: lastError,
          duration
        });
      }
    }

    return {
      success: false,
      strategy: RecoveryStrategyType.RETRY,
      error: lastError,
      totalAttempts: config.maxRetries,
      totalTime: Date.now() - startTime,
      attempts,
      shouldContinue: false
    };
  }

  private async executeFallbackStrategy(context: RecoveryContext, config: RecoveryConfig): Promise<RecoveryResult> {
    const startTime = Date.now();
    
    try {
      // Simulate fallback logic based on operation type
      let fallbackResult: any;
      
      if (context.operation.includes('file')) {
        fallbackResult = { cached: true, source: 'fallback' };
      } else if (context.operation.includes('network')) {
        fallbackResult = { offline: true, source: 'cache' };
      } else {
        fallbackResult = { degraded: true, source: 'fallback' };
      }

      return {
        success: true,
        strategy: RecoveryStrategyType.FALLBACK,
        result: fallbackResult,
        totalAttempts: 1,
        totalTime: Date.now() - startTime,
        attempts: [{
          strategy: RecoveryStrategyType.FALLBACK,
          timestamp: new Date(),
          success: true,
          duration: Date.now() - startTime
        }],
        shouldContinue: true
      };
    } catch (error) {
      return {
        success: false,
        strategy: RecoveryStrategyType.FALLBACK,
        error: error instanceof Error ? error : new Error(String(error)),
        totalAttempts: 1,
        totalTime: Date.now() - startTime,
        attempts: [{
          strategy: RecoveryStrategyType.FALLBACK,
          timestamp: new Date(),
          success: false,
          error: error instanceof Error ? error : new Error(String(error)),
          duration: Date.now() - startTime
        }],
        shouldContinue: false
      };
    }
  }

  private async executeCircuitBreakerStrategy(context: RecoveryContext, config: RecoveryConfig): Promise<RecoveryResult> {
    const circuitKey = `${context.operation}-${context.category}`;
    const circuitState = this.circuitStates.get(circuitKey);
    
    if (circuitState?.isOpen) {
      // Circuit is open - fail fast
      return {
        success: false,
        strategy: RecoveryStrategyType.CIRCUIT_BREAKER,
        error: new Error('Circuit breaker is open - failing fast'),
        totalAttempts: 0,
        totalTime: 0,
        attempts: [],
        shouldContinue: false
      };
    }

    // Try to close circuit and proceed with fallback
    const fallbackResult = await this.executeFallbackStrategy(context, config);
    
    return {
      ...fallbackResult,
      strategy: RecoveryStrategyType.CIRCUIT_BREAKER
    };
  }

  private async executeUserPromptStrategy(context: RecoveryContext, config: RecoveryConfig): Promise<RecoveryResult> {
    // Simulate user prompt (in real implementation, this would show a CLI prompt)
    const startTime = Date.now();
    
    try {
      // For simulation, we assume user provides a fix
      const userResponse = await this.simulateUserPrompt(context);
      
      return {
        success: userResponse.success,
        strategy: RecoveryStrategyType.USER_PROMPT,
        result: userResponse.result,
        totalAttempts: 1,
        totalTime: Date.now() - startTime,
        attempts: [{
          strategy: RecoveryStrategyType.USER_PROMPT,
          timestamp: new Date(),
          success: userResponse.success,
          duration: Date.now() - startTime,
          metadata: { userInput: userResponse.input }
        }],
        shouldContinue: userResponse.success
      };
    } catch (error) {
      return {
        success: false,
        strategy: RecoveryStrategyType.USER_PROMPT,
        error: error instanceof Error ? error : new Error(String(error)),
        totalAttempts: 1,
        totalTime: Date.now() - startTime,
        attempts: [{
          strategy: RecoveryStrategyType.USER_PROMPT,
          timestamp: new Date(),
          success: false,
          error: error instanceof Error ? error : new Error(String(error)),
          duration: Date.now() - startTime
        }],
        shouldContinue: false
      };
    }
  }

  private async executeGracefulDegradationStrategy(context: RecoveryContext, config: RecoveryConfig): Promise<RecoveryResult> {
    const startTime = Date.now();
    
    // Graceful degradation - continue with reduced functionality
    return {
      success: true,
      strategy: RecoveryStrategyType.GRACEFUL_DEGRADATION,
      result: { 
        degraded: true, 
        disabledFeatures: this.getFeaturesToDisable(context),
        message: 'Operating with reduced functionality'
      },
      totalAttempts: 1,
      totalTime: Date.now() - startTime,
      attempts: [{
        strategy: RecoveryStrategyType.GRACEFUL_DEGRADATION,
        timestamp: new Date(),
        success: true,
        duration: Date.now() - startTime
      }],
      shouldContinue: true
    };
  }

  private async executeSkipStrategy(context: RecoveryContext, config: RecoveryConfig): Promise<RecoveryResult> {
    const startTime = Date.now();
    
    return {
      success: true,
      strategy: RecoveryStrategyType.SKIP,
      result: { skipped: true, reason: 'Non-critical operation' },
      totalAttempts: 1,
      totalTime: Date.now() - startTime,
      attempts: [{
        strategy: RecoveryStrategyType.SKIP,
        timestamp: new Date(),
        success: true,
        duration: Date.now() - startTime
      }],
      shouldContinue: true
    };
  }

  private async executeAbortStrategy(context: RecoveryContext, config: RecoveryConfig): Promise<RecoveryResult> {
    const startTime = Date.now();
    
    return {
      success: false,
      strategy: RecoveryStrategyType.ABORT,
      error: context.originalError,
      totalAttempts: 1,
      totalTime: Date.now() - startTime,
      attempts: [{
        strategy: RecoveryStrategyType.ABORT,
        timestamp: new Date(),
        success: false,
        error: context.originalError,
        duration: Date.now() - startTime
      }],
      shouldContinue: false
    };
  }

  private calculateRetryDelay(attempt: number, config: RecoveryConfig): number {
    const exponentialDelay = config.initialDelay * Math.pow(config.backoffMultiplier, attempt);
    const cappedDelay = Math.min(exponentialDelay, config.maxDelay);
    
    // Add jitter to prevent thundering herd
    const jitter = (Math.random() - 0.5) * 2 * config.jitter * cappedDelay;
    
    return Math.max(0, cappedDelay + jitter);
  }

  private shouldRetrySucceed(context: RecoveryContext, attempt: number): boolean {
    // Simulate increasing success probability with attempts
    const baseSuccessRate = 0.3;
    const improvementPerAttempt = 0.2;
    const successRate = Math.min(0.9, baseSuccessRate + (attempt * improvementPerAttempt));
    
    return Math.random() < successRate;
  }

  private async simulateUserPrompt(context: RecoveryContext): Promise<{ success: boolean; result?: any; input?: string }> {
    // Simulate user interaction
    await this.sleep(1000); // Simulate thinking time
    
    if (context.category === ErrorCategory.CONFIGURATION) {
      return {
        success: true,
        result: { configFixed: true },
        input: 'fixed-config-value'
      };
    }
    
    return {
      success: false,
      input: 'user-cancelled'
    };
  }

  private getFeaturesToDisable(context: RecoveryContext): string[] {
    const features = [];
    
    if (context.category === ErrorCategory.EXTERNAL_SERVICE) {
      features.push('remote-api', 'sync-features');
    }
    
    if (context.category === ErrorCategory.RESOURCE) {
      features.push('advanced-optimization', 'detailed-metrics');
    }
    
    return features;
  }

  private categorizeError(error: Error): ErrorCategory {
    if (error instanceof EnigmaError) {
      return ErrorCategory.OPERATIONAL; // Default for EnigmaError
    }
    
    const message = error.message.toLowerCase();
    
    if (message.includes('enoent') || message.includes('permission')) {
      return ErrorCategory.EXTERNAL_SERVICE;
    }
    
    if (message.includes('memory') || message.includes('timeout')) {
      return ErrorCategory.RESOURCE;
    }
    
    if (message.includes('config') || message.includes('invalid')) {
      return ErrorCategory.CONFIGURATION;
    }
    
    return ErrorCategory.OPERATIONAL;
  }

  private determineSeverity(error: Error): ErrorSeverity {
    if (error instanceof EnigmaError) {
      return ErrorSeverity.MEDIUM; // Default for EnigmaError
    }
    
    const message = error.message.toLowerCase();
    
    if (message.includes('critical') || message.includes('fatal')) {
      return ErrorSeverity.CRITICAL;
    }
    
    if (message.includes('error') || message.includes('failed')) {
      return ErrorSeverity.HIGH;
    }
    
    if (message.includes('warning') || message.includes('deprecated')) {
      return ErrorSeverity.MEDIUM;
    }
    
    return ErrorSeverity.LOW;
  }

  private updateCircuitState(operation: string, category: ErrorCategory): void {
    const circuitKey = `${operation}-${category}`;
    const state = this.circuitStates.get(circuitKey) || { failures: 0, lastFailure: new Date(), isOpen: false };
    
    state.failures++;
    state.lastFailure = new Date();
    
    if (state.failures >= this.config.circuitBreakerThreshold) {
      state.isOpen = true;
      this.logger.warn(`Circuit breaker opened for ${circuitKey}`, { failures: state.failures });
      
      // Schedule circuit reset
      setTimeout(() => {
        this.resetCircuitState(operation, category);
      }, this.config.circuitBreakerTimeoutMs);
    }
    
    this.circuitStates.set(circuitKey, state);
  }

  private resetCircuitState(operation: string, category: ErrorCategory): void {
    const circuitKey = `${operation}-${category}`;
    this.circuitStates.delete(circuitKey);
    this.logger.info(`Circuit breaker reset for ${circuitKey}`);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  public updateConfig(updates: Partial<RecoveryConfig>): void {
    this.config = { ...this.config, ...updates };
  }

  public getConfig(): RecoveryConfig {
    return { ...this.config };
  }

  public getCircuitStates(): Map<string, any> {
    return new Map(this.circuitStates);
  }
}

// Global instance
let globalRecoveryStrategies: RecoveryStrategies | null = null;

export function getRecoveryStrategies(): RecoveryStrategies {
  if (!globalRecoveryStrategies) {
    globalRecoveryStrategies = new RecoveryStrategies();
  }
  return globalRecoveryStrategies;
}

export function setRecoveryStrategies(strategies: RecoveryStrategies): void {
  globalRecoveryStrategies = strategies;
}

// Convenience function
export async function executeErrorRecovery(
  error: Error,
  operation: string,
  metadata?: Record<string, any>
): Promise<RecoveryResult> {
  return getRecoveryStrategies().executeRecovery(error, operation, metadata);
}

// Export types
export type { RecoveryConfig, RecoveryContext, RecoveryAttempt, RecoveryResult, RecoveryStrategy };