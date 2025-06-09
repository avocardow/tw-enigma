/**
 * Circuit Breaker Implementation for Tailwind Enigma Core
 * Provides resilient error handling with automatic failure detection and recovery
 */

import { EventEmitter } from 'events';
import { createLogger } from '../logger.js';
import {
  CircuitBreakerState,
  CircuitBreakerMetrics,
  ErrorHandlerConfig,
  EnhancedErrorContext,
  CircuitBreakerFallback,
  ErrorSeverity,
  ErrorCategory
} from './types.js';

const circuitLogger = createLogger('CircuitBreaker');

/**
 * Circuit breaker error thrown when circuit is open
 */
export class CircuitBreakerOpenError extends Error {
  constructor(
    public readonly circuitName: string,
    public readonly lastFailure?: Error
  ) {
    super(`Circuit breaker '${circuitName}' is OPEN. Last failure: ${lastFailure?.message || 'Unknown'}`);
    this.name = 'CircuitBreakerOpenError';
  }
}

/**
 * Circuit breaker configuration with sensible defaults
 */
interface CircuitBreakerConfig {
  failureThreshold: number;       // Number of failures before opening circuit
  recoveryTimeout: number;        // Time to wait before attempting recovery (ms)
  successThreshold: number;       // Successful calls needed to close circuit
  monitoringWindow: number;       // Time window for monitoring failures (ms)
  enabled: boolean;              // Whether circuit breaker is enabled
}

/**
 * Default circuit breaker configuration
 */
const DEFAULT_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 5,           // Open after 5 failures
  recoveryTimeout: 30000,        // Wait 30 seconds before trying again
  successThreshold: 3,           // Need 3 successes to close circuit
  monitoringWindow: 60000,       // Monitor failures over 1 minute window
  enabled: true                  // Circuit breaker enabled by default
};

/**
 * Response time tracking for performance metrics
 */
class ResponseTimeTracker {
  private measurements: number[] = [];
  private readonly maxMeasurements = 1000;

  addMeasurement(responseTime: number): void {
    this.measurements.push(responseTime);
    if (this.measurements.length > this.maxMeasurements) {
      this.measurements.shift(); // Remove oldest measurement
    }
  }

  getStatistics() {
    if (this.measurements.length === 0) {
      return { average: 0, min: 0, max: 0, p95: 0, p99: 0 };
    }

    const sorted = [...this.measurements].sort((a, b) => a - b);
    const sum = this.measurements.reduce((acc, time) => acc + time, 0);

    return {
      average: sum / this.measurements.length,
      min: sorted[0],
      max: sorted[sorted.length - 1],
      p95: sorted[Math.floor(sorted.length * 0.95)] || 0,
      p99: sorted[Math.floor(sorted.length * 0.99)] || 0
    };
  }

  reset(): void {
    this.measurements = [];
  }
}

/**
 * Comprehensive Circuit Breaker implementation
 */
export class CircuitBreaker extends EventEmitter {
  private state: CircuitBreakerState = CircuitBreakerState.CLOSED;
  private failureCount = 0;
  private successCount = 0;
  private lastFailureTime: Date | null = null;
  private lastSuccessTime: Date | null = null;
  private totalRequests = 0;
  private totalFailures = 0;
  private totalSuccesses = 0;
  private readonly responseTimeTracker = new ResponseTimeTracker();
  private readonly failureWindow: Date[] = [];
  private recoveryTimer: NodeJS.Timeout | null = null;

  constructor(
    private readonly name: string,
    private readonly configOverrides: Partial<CircuitBreakerConfig> = {}
  ) {
    super();
    
    // Merge with defaults
    this.config = { ...DEFAULT_CONFIG, ...this.configOverrides };
    
    circuitLogger.debug('Circuit breaker created', {
      name: this.name,
      config: this.config
    });
  }

  private readonly config: CircuitBreakerConfig;

  /**
   * Execute a function with circuit breaker protection
   */
  async call<T>(
    action: () => Promise<T>,
    fallback?: CircuitBreakerFallback<T>,
    context?: EnhancedErrorContext
  ): Promise<T> {
    if (!this.config.enabled) {
      return action();
    }

    const startTime = Date.now();
    this.totalRequests++;

    // Check circuit state before executing
    if (this.state === CircuitBreakerState.OPEN) {
      const error = new CircuitBreakerOpenError(this.name, this.getLastError());
      
      if (fallback) {
        circuitLogger.warn('Circuit open, using fallback', {
          circuitName: this.name,
          context
        });
        return fallback(error);
      }
      
      throw error;
    }

    try {
      const result = await action();
      const responseTime = Date.now() - startTime;
      
      this.onSuccess(responseTime);
      return result;
      
    } catch (error) {
      const responseTime = Date.now() - startTime;
      
      await this.onFailure(error as Error, responseTime, context);
      
      // If we have a fallback and the circuit is now open, use it
      if (fallback) {
        circuitLogger.warn('Action failed, using fallback', {
          circuitName: this.name,
          error: (error as Error).message,
          circuitState: this.state,
          context
        });
        return fallback(error as Error);
      }
      
      throw error;
    }
  }

  /**
   * Handle successful operation
   */
  private onSuccess(responseTime: number): void {
    this.totalSuccesses++;
    this.successCount++;
    this.lastSuccessTime = new Date();
    this.responseTimeTracker.addMeasurement(responseTime);

    circuitLogger.debug('Circuit breaker success', {
      circuitName: this.name,
      responseTime,
      state: this.state,
      successCount: this.successCount
    });

    // If we're in HALF_OPEN state and have enough successes, close the circuit
    if (this.state === CircuitBreakerState.HALF_OPEN && 
        this.successCount >= this.config.successThreshold) {
      this.moveToState(CircuitBreakerState.CLOSED);
    }

    this.emit('success', {
      circuitName: this.name,
      responseTime,
      state: this.state
    });
  }

  /**
   * Handle failed operation
   */
  private async onFailure(error: Error, responseTime: number, context?: EnhancedErrorContext): Promise<void> {
    this.totalFailures++;
    this.failureCount++;
    this.lastFailureTime = new Date();
    this.responseTimeTracker.addMeasurement(responseTime);

    // Add to failure window for monitoring
    this.failureWindow.push(new Date());
    this.cleanupFailureWindow();

    const enhancedContext: EnhancedErrorContext = {
      ...context,
      component: 'CircuitBreaker',
      operationId: `circuit-${this.name}`,
      timestamp: new Date(),
      duration: responseTime
    };

    circuitLogger.error('Circuit breaker failure', {
      circuitName: this.name,
      error: error.message,
      responseTime,
      state: this.state,
      failureCount: this.failureCount,
      context: enhancedContext
    });

    // Check if we should open the circuit
    if (this.shouldOpenCircuit()) {
      this.moveToState(CircuitBreakerState.OPEN);
    }

    this.emit('failure', {
      circuitName: this.name,
      error,
      responseTime,
      state: this.state,
      context: enhancedContext
    });
  }

  /**
   * Determine if circuit should be opened based on failure threshold
   */
  private shouldOpenCircuit(): boolean {
    if (this.state === CircuitBreakerState.OPEN) {
      return false; // Already open
    }

    // Check failure count within monitoring window
    const recentFailures = this.failureWindow.length;
    return recentFailures >= this.config.failureThreshold;
  }

  /**
   * Clean up old failures from monitoring window
   */
  private cleanupFailureWindow(): void {
    const cutoff = new Date(Date.now() - this.config.monitoringWindow);
    let index = 0;
    while (index < this.failureWindow.length && this.failureWindow[index] < cutoff) {
      index++;
    }
    this.failureWindow.splice(0, index);
  }

  /**
   * Move circuit breaker to new state
   */
  private moveToState(newState: CircuitBreakerState): void {
    const oldState = this.state;
    this.state = newState;

    circuitLogger.info('Circuit breaker state change', {
      circuitName: this.name,
      oldState,
      newState,
      failureCount: this.failureCount,
      successCount: this.successCount
    });

    // Reset counters based on new state
    switch (newState) {
      case CircuitBreakerState.CLOSED:
        this.failureCount = 0;
        this.successCount = 0;
        this.failureWindow.length = 0;
        this.responseTimeTracker.reset();
        this.clearRecoveryTimer();
        break;

      case CircuitBreakerState.OPEN:
        this.successCount = 0;
        this.scheduleRecoveryAttempt();
        break;

      case CircuitBreakerState.HALF_OPEN:
        this.successCount = 0;
        this.clearRecoveryTimer();
        break;
    }

    this.emit('stateChange', {
      circuitName: this.name,
      oldState,
      newState,
      timestamp: new Date()
    });
  }

  /**
   * Schedule automatic recovery attempt
   */
  private scheduleRecoveryAttempt(): void {
    this.clearRecoveryTimer();
    
    this.recoveryTimer = setTimeout(() => {
      if (this.state === CircuitBreakerState.OPEN) {
        circuitLogger.info('Attempting circuit recovery', {
          circuitName: this.name,
          lastFailure: this.lastFailureTime
        });
        
        this.moveToState(CircuitBreakerState.HALF_OPEN);
        
        this.emit('recoveryAttempt', {
          circuitName: this.name,
          timestamp: new Date()
        });
      }
    }, this.config.recoveryTimeout);
  }

  /**
   * Clear recovery timer
   */
  private clearRecoveryTimer(): void {
    if (this.recoveryTimer) {
      clearTimeout(this.recoveryTimer);
      this.recoveryTimer = null;
    }
  }

  /**
   * Get last recorded error (for debugging)
   */
  private getLastError(): Error | undefined {
    // This would typically store the last error, simplified for now
    return new Error('Circuit breaker failure threshold exceeded');
  }

  /**
   * Get current circuit breaker metrics
   */
  getMetrics(): CircuitBreakerMetrics {
    const responseTimeStats = this.responseTimeTracker.getStatistics();
    const uptime = this.totalRequests > 0 
      ? (this.totalSuccesses / this.totalRequests) * 100 
      : 100;

    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      lastFailureTime: this.lastFailureTime,
      lastSuccessTime: this.lastSuccessTime,
      totalRequests: this.totalRequests,
      totalFailures: this.totalFailures,
      totalSuccesses: this.totalSuccesses,
      uptime,
      responseTime: responseTimeStats
    };
  }

  /**
   * Reset circuit breaker to initial state
   */
  reset(): void {
    circuitLogger.info('Resetting circuit breaker', {
      circuitName: this.name,
      previousState: this.state
    });

    this.moveToState(CircuitBreakerState.CLOSED);
    this.totalRequests = 0;
    this.totalFailures = 0;
    this.totalSuccesses = 0;
    this.lastFailureTime = null;
    this.lastSuccessTime = null;
    this.responseTimeTracker.reset();

    this.emit('reset', {
      circuitName: this.name,
      timestamp: new Date()
    });
  }

  /**
   * Force circuit to specific state (for testing)
   */
  forceState(state: CircuitBreakerState): void {
    circuitLogger.warn('Force changing circuit breaker state', {
      circuitName: this.name,
      oldState: this.state,
      newState: state
    });

    this.moveToState(state);
  }

  /**
   * Get current state
   */
  getState(): CircuitBreakerState {
    return this.state;
  }

  /**
   * Check if circuit is healthy
   */
  isHealthy(): boolean {
    return this.state === CircuitBreakerState.CLOSED;
  }

  /**
   * Cleanup resources when circuit breaker is destroyed
   */
  destroy(): void {
    this.clearRecoveryTimer();
    this.removeAllListeners();
    
    circuitLogger.debug('Circuit breaker destroyed', {
      circuitName: this.name
    });
  }
}

/**
 * Circuit breaker registry for managing multiple circuit breakers
 */
export class CircuitBreakerRegistry {
  private static instance: CircuitBreakerRegistry;
  private readonly circuits = new Map<string, CircuitBreaker>();
  private readonly logger = createLogger('CircuitBreakerRegistry');

  static getInstance(): CircuitBreakerRegistry {
    if (!CircuitBreakerRegistry.instance) {
      CircuitBreakerRegistry.instance = new CircuitBreakerRegistry();
    }
    return CircuitBreakerRegistry.instance;
  }

  /**
   * Get or create a circuit breaker
   */
  getCircuit(name: string, config?: Partial<CircuitBreakerConfig>): CircuitBreaker {
    if (!this.circuits.has(name)) {
      const circuit = new CircuitBreaker(name, config);
      this.circuits.set(name, circuit);
      
      this.logger.info('Created new circuit breaker', { name, config });
    }
    
    return this.circuits.get(name)!;
  }

  /**
   * Get all circuit breakers
   */
  getAllCircuits(): Record<string, CircuitBreaker> {
    const result: Record<string, CircuitBreaker> = {};
    this.circuits.forEach((circuit, name) => {
      result[name] = circuit;
    });
    return result;
  }

  /**
   * Get metrics for all circuits
   */
  getAllMetrics(): Record<string, CircuitBreakerMetrics> {
    const result: Record<string, CircuitBreakerMetrics> = {};
    this.circuits.forEach((circuit, name) => {
      result[name] = circuit.getMetrics();
    });
    return result;
  }

  /**
   * Reset all circuit breakers
   */
  resetAll(): void {
    this.logger.info('Resetting all circuit breakers');
    this.circuits.forEach(circuit => circuit.reset());
  }

  /**
   * Destroy all circuit breakers
   */
  destroyAll(): void {
    this.logger.info('Destroying all circuit breakers');
    this.circuits.forEach(circuit => circuit.destroy());
    this.circuits.clear();
  }

  /**
   * Check overall health of all circuits
   */
  getOverallHealth(): {
    healthy: number;
    degraded: number;
    unhealthy: number;
    total: number;
  } {
    let healthy = 0;
    let degraded = 0;
    let unhealthy = 0;

    this.circuits.forEach(circuit => {
      const state = circuit.getState();
      if (state === CircuitBreakerState.CLOSED) {
        healthy++;
      } else if (state === CircuitBreakerState.HALF_OPEN) {
        degraded++;
      } else {
        unhealthy++;
      }
    });

    return {
      healthy,
      degraded,
      unhealthy,
      total: this.circuits.size
    };
  }
}

/**
 * Utility function to wrap any async function with circuit breaker protection
 */
export function withCircuitBreaker<T extends (...args: any[]) => Promise<any>>(
  name: string,
  fn: T,
  config?: Partial<CircuitBreakerConfig>,
  fallback?: CircuitBreakerFallback<ReturnType<T>>
): T {
  const registry = CircuitBreakerRegistry.getInstance();
  const circuit = registry.getCircuit(name, config);

  return ((...args: Parameters<T>) => {
    return circuit.call(
      () => fn(...args),
      fallback as CircuitBreakerFallback<Awaited<ReturnType<T>>>,
      {
        operationId: `wrapped-${name}`,
        component: 'CircuitBreakerWrapper'
      }
    );
  }) as T;
} 