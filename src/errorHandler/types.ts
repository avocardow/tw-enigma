/**
 * Copyright (c) 2025 Rowan Cardow
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * Comprehensive Error Handling Types for Tailwind Enigma Core
 * Provides TypeScript interfaces for advanced error handling, circuit breaker patterns,
 * and graceful recovery mechanisms.
 */

import { ErrorContext } from "../logger.js";

/**
 * Error severity levels for categorization and routing
 */
export enum ErrorSeverity {
  CRITICAL = "critical", // System-threatening errors requiring immediate attention
  HIGH = "high", // Functional errors affecting core operations
  MEDIUM = "medium", // Recoverable errors with automatic retry
  LOW = "low", // Warning-level issues with graceful degradation
}

/**
 * Error categories for different types of failures
 */
export enum ErrorCategory {
  OPERATIONAL = "operational", // File system, network, permissions
  PROGRAMMING = "programming", // Type errors, null references, logic errors
  EXTERNAL_SERVICE = "external", // API failures, timeouts, external dependencies
  CONFIGURATION = "configuration", // Invalid config, missing environment variables
  RESOURCE = "resource", // Memory, disk space, CPU limitations
  VALIDATION = "validation", // Input validation, schema violations
}

/**
 * Circuit breaker states
 */
export enum CircuitBreakerState {
  CLOSED = "closed", // Normal operation, requests pass through
  OPEN = "open", // Circuit is broken, requests fail immediately
  HALF_OPEN = "half_open", // Testing state, limited requests allowed
}

/**
 * Recovery strategy types
 */
export enum RecoveryStrategy {
  RETRY = "retry", // Automatic retry with backoff
  FALLBACK = "fallback", // Use fallback/default values
  GRACEFUL_DEGRADATION = "degradation", // Reduce functionality
  CIRCUIT_BREAKER = "circuit_breaker", // Circuit breaker protection
  MANUAL_INTERVENTION = "manual", // Requires manual intervention
}

/**
 * Enhanced error context with comprehensive metadata
 */
export interface EnhancedErrorContext extends ErrorContext {
  // Core identification
  correlationId?: string; // Request/operation correlation ID
  operationId?: string; // Specific operation being performed
  component?: string; // Component/module where error occurred

  // Timing and performance
  timestamp?: Date; // When the error occurred
  duration?: number; // Operation duration before failure (ms)
  timeout?: number; // Configured timeout value (ms)

  // Environmental context
  nodeVersion?: string; // Node.js version
  platform?: string; // Operating system platform
  availableMemory?: number; // Available memory at time of error (bytes)
  cpuUsage?: {
    // CPU usage statistics
    user: number;
    system: number;
  };

  // Error-specific context
  retryCount?: number; // Number of retry attempts made
  maxRetries?: number; // Maximum retry attempts allowed
  lastRetryAt?: Date; // Timestamp of last retry attempt
  recoveryStrategy?: RecoveryStrategy; // Recommended recovery strategy

  // User and request context
  userId?: string; // User identifier if applicable
  requestId?: string; // HTTP request ID if applicable
  userAgent?: string; // User agent information

  // Additional metadata
  tags?: Record<string, string>; // Additional tag-based metadata
  metrics?: Record<string, number>; // Additional numeric metrics
}

/**
 * Error handler configuration options
 */
export interface ErrorHandlerConfig {
  maxRetries: number;
  retryDelay: number;
  exponentialBackoff: boolean;
  circuitBreakerEnabled: boolean;
  enableAnalytics: boolean;
  logLevel: string;
  alertThresholds?: Record<ErrorSeverity, number>;

  // Circuit breaker settings
  circuitBreaker?: {
    failureThreshold?: number; // Number of failures before opening circuit
    recoveryTimeout?: number; // Time to wait before attempting recovery (ms)
    successThreshold?: number; // Successful calls needed to close circuit
    monitoringWindow?: number; // Time window for monitoring failures (ms)
  };

  // Retry settings
  retry?: {
    maxAttempts?: number; // Maximum retry attempts
    baseDelay?: number; // Base delay between retries (ms)
    maxDelay?: number; // Maximum delay between retries (ms)
    backoffMultiplier?: number; // Exponential backoff multiplier
    jitter?: boolean; // Add random jitter to prevent thundering herd
  };

  // Timeout settings
  timeouts?: {
    operation?: number; // Default operation timeout (ms)
    gracefulShutdown?: number; // Graceful shutdown timeout (ms)
    resourceCleanup?: number; // Resource cleanup timeout (ms)
  };

  // Monitoring and reporting
  monitoring?: {
    enabled?: boolean; // Enable error monitoring
    sampleRate?: number; // Sampling rate for error reporting (0-1)
    batchSize?: number; // Batch size for error reporting
    flushInterval?: number; // Interval to flush error reports (ms)
  };

  // Recovery settings
  recovery?: {
    enableAutoRecovery?: boolean; // Enable automatic recovery
    healthCheckInterval?: number; // Health check interval (ms)
    maxRecoveryAttempts?: number; // Maximum recovery attempts
  };
}

/**
 * Circuit breaker statistics and metrics
 */
export interface CircuitBreakerMetrics {
  state: CircuitBreakerState; // Current circuit breaker state
  failureCount: number; // Current failure count
  successCount: number; // Success count in current window
  lastFailureTime: Date | null; // Timestamp of last failure
  lastSuccessTime: Date | null; // Timestamp of last success
  totalRequests: number; // Total requests through circuit breaker
  totalFailures: number; // Total failures recorded
  totalSuccesses: number; // Total successes recorded
  uptime: number; // Circuit breaker uptime percentage
  responseTime: {
    // Response time statistics
    average: number;
    min: number;
    max: number;
    p95: number;
    p99: number;
  };
}

/**
 * Error analytics and reporting data
 */
export interface ErrorAnalytics {
  totalErrors: number;
  errorsByCategory: Record<ErrorCategory, number>;
  errorsBySeverity: Record<ErrorSeverity, number>;
  recoveryRate: number;
  lastErrorTime: Date | null;
  circuitBreakerMetrics: Record<string, CircuitBreakerMetrics>;
  systemHealth: HealthStatus;
  uptime: number;
  timestamp: Date;
}

/**
 * Graceful shutdown context and state
 */
export interface ShutdownContext {
  signal: string; // Signal that triggered shutdown (SIGTERM, SIGINT, etc.)
  timestamp: Date; // When shutdown was initiated
  gracefulTimeout: number; // Timeout for graceful shutdown (ms)
  forceTimeout: number; // Timeout before force shutdown (ms)
  activeOperations: string[]; // List of active operations to cleanup
  cleanupTasks: Array<{
    // Cleanup tasks to execute
    name: string;
    priority: number;
    timeout: number;
  }>;
}

/**
 * Health check result interface
 */
export interface HealthCheckResult {
  status: "healthy" | "degraded" | "unhealthy"; // Overall health status
  timestamp: Date; // When health check was performed
  duration: number; // Time taken for health check (ms)
  checks: Record<
    string,
    {
      // Individual check results
      status: "pass" | "warn" | "fail";
      message?: string;
      duration?: number;
      metadata?: Record<string, any>;
    }
  >;
  system: {
    // System resource information
    memory: {
      used: number;
      free: number;
      total: number;
    };
    cpu: {
      usage: number;
      loadAverage: number[];
    };
    uptime: number;
  };
}

/**
 * Error reporting interface for external monitoring systems
 */
export interface ErrorReport {
  id: string; // Unique error report ID
  timestamp: Date; // When error occurred
  severity: ErrorSeverity; // Error severity level
  category: ErrorCategory; // Error category
  message: string; // Human-readable error message
  stack?: string; // Stack trace if available
  context: EnhancedErrorContext; // Complete error context
  analytics?: Partial<ErrorAnalytics>; // Error analytics data
  fingerprint?: string; // Error fingerprint for deduplication
  resolved?: boolean; // Whether error has been resolved
  resolvedAt?: Date; // When error was resolved
  resolutionMethod?: string; // How error was resolved
}

/**
 * Type guards for error handling
 */
export function isOperationalError(error: Error): boolean {
  return (
    error.name.includes("File") ||
    error.name.includes("Network") ||
    error.name.includes("Permission") ||
    error.name.includes("Timeout")
  );
}

export function isProgrammingError(error: Error): boolean {
  return (
    error.name.includes("Type") ||
    error.name.includes("Reference") ||
    error.name.includes("Syntax")
  );
}

export function isCriticalError(error: Error): boolean {
  return (
    error.message.toLowerCase().includes("out of memory") ||
    error.message.toLowerCase().includes("segmentation fault") ||
    error.message.toLowerCase().includes("stack overflow")
  );
}

/**
 * Utility type for async error handling
 */
export type AsyncErrorHandler<T> = (
  error: Error,
  context?: EnhancedErrorContext,
) => Promise<T>;

/**
 * Function signature for error recovery callbacks
 */
export type ErrorRecoveryCallback = (
  error: Error,
  context: EnhancedErrorContext,
  attempt: number,
) => Promise<boolean>;

/**
 * Function signature for circuit breaker fallback
 */
export type CircuitBreakerFallback<T> = (error: Error) => Promise<T> | T;

/**
 * Circuit breaker health status interface
 */
export interface CircuitBreakerHealthStatus {
  total: number;
  healthy: number;
  unhealthy: number;
  degraded: number;
}

/**
 * Error recovery strategy interface
 */
export interface ErrorRecoveryStrategy {
  type: "retry" | "fallback" | "circuit-breaker" | "graceful-degradation";
  config?: {
    maxRetries?: number;
    retryDelay?: number;
    fallbackAction?: string;
    degradationLevel?: "minimal" | "partial" | "full";
  };
  action?: () => Promise<void>;
}

/**
 * Health status enumeration
 */
export enum HealthStatus {
  HEALTHY = "healthy",
  DEGRADED = "degraded",
  UNHEALTHY = "unhealthy",
}

/**
 * Check if error is an Enigma error with severity
 */
export function isEnigmaError(
  error: Error,
): error is Error & { severity?: ErrorSeverity } {
  return error && typeof error === "object" && "severity" in error;
}

/**
 * Categorize error based on error type and message
 */
export function categorizeError(error: Error): ErrorCategory {
  const message = error.message?.toLowerCase() || "";
  const name = error.name?.toLowerCase() || "";

  // Configuration errors
  if (
    name.includes("config") ||
    message.includes("configuration") ||
    message.includes("env") ||
    message.includes("environment")
  ) {
    return ErrorCategory.CONFIGURATION;
  }

  // Validation errors
  if (
    name.includes("validation") ||
    message.includes("invalid") ||
    message.includes("schema") ||
    name.includes("zod")
  ) {
    return ErrorCategory.VALIDATION;
  }

  // Resource errors
  if (
    message.includes("memory") ||
    message.includes("disk") ||
    message.includes("enospc") ||
    message.includes("emfile")
  ) {
    return ErrorCategory.RESOURCE;
  }

  // External service errors
  if (
    message.includes("network") ||
    message.includes("timeout") ||
    message.includes("enotfound") ||
    message.includes("econnrefused")
  ) {
    return ErrorCategory.EXTERNAL_SERVICE;
  }

  // Programming errors
  if (
    name.includes("type") ||
    name.includes("reference") ||
    message.includes("undefined") ||
    message.includes("null")
  ) {
    return ErrorCategory.PROGRAMMING;
  }

  // Default to operational
  return ErrorCategory.OPERATIONAL;
}

/**
 * Convert severity to numeric value for comparison
 */
export function severityToNumber(severity: ErrorSeverity): number {
  switch (severity) {
    case ErrorSeverity.CRITICAL:
      return 4;
    case ErrorSeverity.HIGH:
      return 3;
    case ErrorSeverity.MEDIUM:
      return 2;
    case ErrorSeverity.LOW:
      return 1;
    default:
      return 0;
  }
}
