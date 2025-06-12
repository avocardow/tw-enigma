/**
 * Unit tests for comprehensive error handling system
 * Tests circuit breaker functionality, error categorization, and recovery strategies
 */

import { describe, it, expect, beforeEach, afterEach, vi, Mock } from "vitest";
import { EventEmitter } from "events";
import {
  CircuitBreaker,
  CircuitBreakerRegistry,
  CircuitBreakerOpenError,
} from "../src/errorHandler/circuitBreaker.js";
import {
  ErrorHandler,
  getErrorHandler,
  handleError,
} from "../src/errorHandler/errorHandler.js";
import {
  ErrorSeverity,
  ErrorCategory,
  CircuitBreakerState,
  HealthStatus,
  categorizeError,
  severityToNumber,
  isEnigmaError,
} from "../src/errorHandler/types.js";

// Mock the logger
vi.mock("../src/logger.js", () => ({
  createLogger: vi.fn(() => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    fatal: vi.fn(),
  })),
}));

describe("Error Type Functions", () => {
  describe("categorizeError", () => {
    it("should categorize configuration errors", () => {
      const error = new Error("Invalid configuration value");
      expect(categorizeError(error)).toBe(ErrorCategory.CONFIGURATION);
    });

    it("should categorize validation errors", () => {
      const error = new Error("Schema validation failed");
      expect(categorizeError(error)).toBe(ErrorCategory.VALIDATION);
    });

    it("should categorize resource errors", () => {
      const error = new Error("Out of memory");
      expect(categorizeError(error)).toBe(ErrorCategory.RESOURCE);
    });

    it("should categorize external service errors", () => {
      const error = new Error("Network timeout occurred");
      expect(categorizeError(error)).toBe(ErrorCategory.EXTERNAL_SERVICE);
    });

    it("should categorize programming errors", () => {
      const error = new TypeError("Cannot read property of undefined");
      expect(categorizeError(error)).toBe(ErrorCategory.PROGRAMMING);
    });

    it("should default to operational errors", () => {
      const error = new Error("Some unknown error");
      expect(categorizeError(error)).toBe(ErrorCategory.OPERATIONAL);
    });
  });

  describe("severityToNumber", () => {
    it("should convert severity levels to numbers", () => {
      expect(severityToNumber(ErrorSeverity.CRITICAL)).toBe(4);
      expect(severityToNumber(ErrorSeverity.HIGH)).toBe(3);
      expect(severityToNumber(ErrorSeverity.MEDIUM)).toBe(2);
      expect(severityToNumber(ErrorSeverity.LOW)).toBe(1);
    });
  });

  describe("isEnigmaError", () => {
    it("should identify enigma errors with severity", () => {
      const error = { severity: ErrorSeverity.HIGH } as any;
      expect(isEnigmaError(error)).toBe(true);
    });

    it("should identify regular errors without severity", () => {
      const error = new Error("Regular error");
      expect(isEnigmaError(error)).toBe(false);
    });
  });
});

describe("CircuitBreaker", () => {
  let circuitBreaker: CircuitBreaker;

  beforeEach(() => {
    circuitBreaker = new CircuitBreaker("test-circuit", {
      failureThreshold: 3,
      recoveryTimeout: 1000,
      successThreshold: 2,
      monitoringWindow: 5000,
    });
  });

  afterEach(() => {
    circuitBreaker.destroy();
  });

  describe("initialization", () => {
    it("should start in CLOSED state", () => {
      expect(circuitBreaker.getState()).toBe(CircuitBreakerState.CLOSED);
      expect(circuitBreaker.isHealthy()).toBe(true);
    });
  });

  describe("call method", () => {
    it("should execute successful operations", async () => {
      const mockAction = vi.fn().mockResolvedValue("success");

      const result = await circuitBreaker.call(mockAction);

      expect(result).toBe("success");
      expect(mockAction).toHaveBeenCalledTimes(1);
      expect(circuitBreaker.getState()).toBe(CircuitBreakerState.CLOSED);
    });

    it("should handle single failures", async () => {
      const mockAction = vi.fn().mockRejectedValue(new Error("Test failure"));

      await expect(circuitBreaker.call(mockAction)).rejects.toThrow(
        "Test failure",
      );

      expect(circuitBreaker.getState()).toBe(CircuitBreakerState.CLOSED);
      expect(circuitBreaker.getMetrics().failureCount).toBe(1);
    });

    it("should open circuit after failure threshold", async () => {
      const mockAction = vi.fn().mockRejectedValue(new Error("Test failure"));

      // Trigger failures to exceed threshold
      for (let i = 0; i < 3; i++) {
        try {
          await circuitBreaker.call(mockAction);
        } catch {
          // Expected to fail
        }
      }

      expect(circuitBreaker.getState()).toBe(CircuitBreakerState.OPEN);
      expect(circuitBreaker.isHealthy()).toBe(false);
    });

    it("should reject immediately when circuit is open", async () => {
      const mockAction = vi.fn().mockRejectedValue(new Error("Test failure"));

      // Open the circuit
      for (let i = 0; i < 3; i++) {
        try {
          await circuitBreaker.call(mockAction);
        } catch {
          // Expected to fail
        }
      }

      // Circuit should now be open and reject immediately
      await expect(circuitBreaker.call(mockAction)).rejects.toBeInstanceOf(
        CircuitBreakerOpenError,
      );

      // Action should not be called when circuit is open
      expect(mockAction).toHaveBeenCalledTimes(3); // Only the initial attempts
    });

    it("should use fallback when circuit is open", async () => {
      const mockAction = vi.fn().mockRejectedValue(new Error("Test failure"));
      const mockFallback = vi.fn().mockReturnValue("fallback-result");

      // Open the circuit
      for (let i = 0; i < 3; i++) {
        try {
          await circuitBreaker.call(mockAction);
        } catch {
          // Expected to fail
        }
      }

      // Call with fallback
      const result = await circuitBreaker.call(mockAction, mockFallback);

      expect(result).toBe("fallback-result");
      expect(mockFallback).toHaveBeenCalledTimes(1);
    });
  });

  describe("recovery mechanism", () => {
    it("should transition to HALF_OPEN after recovery timeout", async () => {
      const mockAction = vi.fn().mockRejectedValue(new Error("Test failure"));

      // Open the circuit
      for (let i = 0; i < 3; i++) {
        try {
          await circuitBreaker.call(mockAction);
        } catch {
          // Expected to fail
        }
      }

      expect(circuitBreaker.getState()).toBe(CircuitBreakerState.OPEN);

      // Wait for recovery timeout (using a shorter timeout for testing)
      await new Promise((resolve) => setTimeout(resolve, 1100));

      expect(circuitBreaker.getState()).toBe(CircuitBreakerState.HALF_OPEN);
    });

    it("should close circuit after successful operations in HALF_OPEN", async () => {
      // Force circuit to HALF_OPEN state
      circuitBreaker.forceState(CircuitBreakerState.HALF_OPEN);

      const mockAction = vi.fn().mockResolvedValue("success");

      // Execute successful operations to meet success threshold
      for (let i = 0; i < 2; i++) {
        await circuitBreaker.call(mockAction);
      }

      expect(circuitBreaker.getState()).toBe(CircuitBreakerState.CLOSED);
    });
  });

  describe("metrics", () => {
    it("should track metrics accurately", async () => {
      const successAction = vi.fn().mockResolvedValue("success");
      const failureAction = vi.fn().mockRejectedValue(new Error("failure"));

      // Execute some operations
      await circuitBreaker.call(successAction);
      await circuitBreaker.call(successAction);

      try {
        await circuitBreaker.call(failureAction);
      } catch {
        // Expected to fail
      }

      const metrics = circuitBreaker.getMetrics();

      expect(metrics.totalRequests).toBe(3);
      expect(metrics.totalSuccesses).toBe(2);
      expect(metrics.totalFailures).toBe(1);
      expect(metrics.uptime).toBeCloseTo(66.67, 1); // 2/3 success rate
    });
  });

  describe("reset functionality", () => {
    it("should reset circuit to initial state", async () => {
      const mockAction = vi.fn().mockRejectedValue(new Error("Test failure"));

      // Generate some activity
      try {
        await circuitBreaker.call(mockAction);
      } catch {
        // Expected to fail
      }

      circuitBreaker.reset();

      const metrics = circuitBreaker.getMetrics();
      expect(circuitBreaker.getState()).toBe(CircuitBreakerState.CLOSED);
      expect(metrics.totalRequests).toBe(0);
      expect(metrics.totalFailures).toBe(0);
      expect(metrics.failureCount).toBe(0);
    });
  });
});

describe("CircuitBreakerRegistry", () => {
  let registry: CircuitBreakerRegistry;

  beforeEach(() => {
    registry = CircuitBreakerRegistry.getInstance();
  });

  afterEach(() => {
    registry.destroyAll();
  });

  it("should create and manage circuit breakers", () => {
    const circuit1 = registry.getCircuit("test-1");
    const circuit2 = registry.getCircuit("test-2");

    expect(circuit1).toBeInstanceOf(CircuitBreaker);
    expect(circuit2).toBeInstanceOf(CircuitBreaker);
    expect(circuit1).not.toBe(circuit2);
  });

  it("should return same instance for same name", () => {
    const circuit1 = registry.getCircuit("test");
    const circuit2 = registry.getCircuit("test");

    expect(circuit1).toBe(circuit2);
  });

  it("should provide overall health status", () => {
    const circuit1 = registry.getCircuit("healthy");
    const circuit2 = registry.getCircuit("unhealthy");

    // Force one circuit to be unhealthy
    circuit2.forceState(CircuitBreakerState.OPEN);

    const health = registry.getOverallHealth();

    expect(health.total).toBe(2);
    expect(health.healthy).toBe(1);
    expect(health.unhealthy).toBe(1);
    expect(health.degraded).toBe(0);
  });

  it("should reset all circuits", () => {
    const circuit1 = registry.getCircuit("test-1");
    const circuit2 = registry.getCircuit("test-2");

    // Force circuits to unhealthy states
    circuit1.forceState(CircuitBreakerState.OPEN);
    circuit2.forceState(CircuitBreakerState.HALF_OPEN);

    registry.resetAll();

    expect(circuit1.getState()).toBe(CircuitBreakerState.CLOSED);
    expect(circuit2.getState()).toBe(CircuitBreakerState.CLOSED);
  });
});

describe("ErrorHandler", () => {
  let errorHandler: ErrorHandler;

  beforeEach(() => {
    errorHandler = ErrorHandler.getInstance({
      maxRetries: 2,
      retryDelay: 100,
      exponentialBackoff: false,
      circuitBreakerEnabled: true,
      enableAnalytics: true,
      logLevel: "error",
    });

    // Suppress error event emissions during tests to prevent unhandled errors
    errorHandler.removeAllListeners("error");
    errorHandler.on("error", () => {
      // Silently handle errors during tests
    });
  });

  afterEach(() => {
    errorHandler.removeAllListeners();
    errorHandler.resetStats();
    errorHandler.destroy();
  });

  describe("error handling", () => {
    it("should handle errors and update statistics", async () => {
      const error = new Error("Test error");

      const result = await errorHandler.handleError(error);

      expect(result).toBe(true); // Non-fatal error should return true

      const stats = errorHandler.getStats();
      expect(stats.totalErrors).toBe(1);
      expect(stats.errorsByCategory[ErrorCategory.OPERATIONAL]).toBe(1);
    });

    it("should categorize errors correctly", async () => {
      const configError = new Error("Invalid configuration");
      const networkError = new Error("Network timeout");

      await errorHandler.handleError(configError);
      await errorHandler.handleError(networkError);

      const stats = errorHandler.getStats();
      expect(stats.errorsByCategory[ErrorCategory.CONFIGURATION]).toBe(1);
      expect(stats.errorsByCategory[ErrorCategory.EXTERNAL_SERVICE]).toBe(1);
    });

    it("should attempt recovery when strategy provided", async () => {
      const error = new Error("Test error");
      const mockAction = vi.fn().mockResolvedValue(undefined);

      const recoveryStrategy = {
        type: "retry" as const,
        action: mockAction,
      };

      const result = await errorHandler.handleError(
        error,
        undefined,
        recoveryStrategy,
      );

      expect(result).toBe(true);
      expect(mockAction).toHaveBeenCalled();

      const stats = errorHandler.getStats();
      expect(stats.recoveryAttempts).toBe(1);
      expect(stats.successfulRecoveries).toBe(1);
    });

    it("should use circuit breaker for appropriate errors", async () => {
      const networkError = new Error("Network timeout");

      // Set up context to trigger circuit breaker usage
      const context = {
        component: "NetworkService",
        operationId: "api-call",
      };

      await errorHandler.handleError(networkError, context);

      // Verify circuit breaker was used by checking if circuit was created
      const registry = CircuitBreakerRegistry.getInstance();
      const circuits = registry.getAllCircuits();

      expect(Object.keys(circuits).length).toBeGreaterThan(0);
    });
  });

  describe("analytics", () => {
    it("should provide comprehensive analytics", async () => {
      const error1 = new Error("Test error 1");
      const error2 = new Error("Network timeout");

      await errorHandler.handleError(error1);
      await errorHandler.handleError(error2);

      const analytics = errorHandler.getAnalytics();

      expect(analytics.totalErrors).toBe(2);
      expect(analytics.systemHealth).toBeDefined();
      expect(analytics.timestamp).toBeInstanceOf(Date);
      expect(analytics.errorsByCategory).toBeDefined();
      expect(analytics.errorsBySeverity).toBeDefined();
    });

    it("should calculate system health correctly", async () => {
      // Initially should be healthy
      let analytics = errorHandler.getAnalytics();
      expect(analytics.systemHealth).toBe(HealthStatus.HEALTHY);

      // Add many high severity errors
      for (let i = 0; i < 6; i++) {
        const error = new TypeError("Programming error");
        await errorHandler.handleError(error);
      }

      analytics = errorHandler.getAnalytics();
      expect(analytics.systemHealth).toBe(HealthStatus.DEGRADED);
    });
  });

  describe("event emission", () => {
    it("should emit error events", async () => {
      const errorEventSpy = vi.fn();

      // Remove the default silent handler and add our spy
      errorHandler.removeAllListeners("error");
      errorHandler.on("error", errorEventSpy);

      const error = new Error("Test error");
      await errorHandler.handleError(error);

      expect(errorEventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          error,
          category: ErrorCategory.OPERATIONAL,
          severity: ErrorSeverity.MEDIUM,
        }),
      );
    });

    it("should emit recovery events", async () => {
      const recoveryEventSpy = vi.fn();

      // Keep the error handler silent and just listen for recovery events
      errorHandler.on("recovery", recoveryEventSpy);

      const error = new Error("Test error");
      const recoveryStrategy = {
        type: "retry" as const,
        action: vi.fn().mockResolvedValue(undefined),
      };

      await errorHandler.handleError(error, undefined, recoveryStrategy);

      expect(recoveryEventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          error,
          strategy: recoveryStrategy,
          success: true,
        }),
      );
    });
  });

  describe("singleton pattern", () => {
    it("should return same instance", () => {
      const instance1 = ErrorHandler.getInstance();
      const instance2 = ErrorHandler.getInstance();

      expect(instance1).toBe(instance2);
    });
  });

  describe("convenience functions", () => {
    it("should provide global error handler access", () => {
      const handler = getErrorHandler();
      expect(handler).toBeInstanceOf(ErrorHandler);
    });

    it("should provide global error handling function", async () => {
      const error = new Error("Test error");
      const result = await handleError(error);

      expect(result).toBe(true);
    });
  });
});

describe("Error Recovery Strategies", () => {
  let errorHandler: ErrorHandler;

  beforeEach(() => {
    errorHandler = ErrorHandler.getInstance();

    // Suppress error event emissions during tests
    errorHandler.removeAllListeners("error");
    errorHandler.on("error", () => {
      // Silently handle errors during tests
    });
  });

  afterEach(() => {
    errorHandler.removeAllListeners();
    errorHandler.resetStats();
  });

  it("should execute retry strategy", async () => {
    const error = new Error("Temporary failure");
    const mockAction = vi.fn().mockResolvedValue(undefined);

    const retryStrategy = {
      type: "retry" as const,
      config: { maxRetries: 3, retryDelay: 50 },
      action: mockAction,
    };

    const result = await errorHandler.handleError(
      error,
      undefined,
      retryStrategy,
    );

    expect(result).toBe(true);
    expect(mockAction).toHaveBeenCalled();
  });

  it("should execute fallback strategy", async () => {
    const error = new Error("Service unavailable");
    const mockAction = vi.fn().mockResolvedValue(undefined);

    const fallbackStrategy = {
      type: "fallback" as const,
      config: { fallbackAction: "use-cache" },
      action: mockAction,
    };

    const result = await errorHandler.handleError(
      error,
      undefined,
      fallbackStrategy,
    );

    expect(result).toBe(true);
    expect(mockAction).toHaveBeenCalled();
  });

  it("should execute graceful degradation strategy", async () => {
    const error = new Error("Performance degraded");
    const degradationEventSpy = vi.fn();

    // Listen for degradation events
    errorHandler.on("degradation", degradationEventSpy);

    const degradationStrategy = {
      type: "graceful-degradation" as const,
      config: { degradationLevel: "partial" },
    };

    const result = await errorHandler.handleError(
      error,
      undefined,
      degradationStrategy,
    );

    expect(result).toBe(true);
    expect(degradationEventSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        level: "partial",
      }),
    );
  });
});
