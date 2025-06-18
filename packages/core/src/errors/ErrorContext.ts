/**
 * Copyright (c) 2025 Rowan Cardow
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * Error severity levels for classification and handling
 */
export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

/**
 * Error categories for systematic classification
 */
export enum ErrorCategory {
  VALIDATION = 'validation',
  FILE_OPERATION = 'file_operation',
  PERFORMANCE = 'performance',
  CONFIGURATION = 'configuration',
  INTEGRATION = 'integration',
  NETWORK = 'network',
  SECURITY = 'security',
  USER_INPUT = 'user_input',
  SYSTEM = 'system',
}

/**
 * Rich context information for error diagnostics
 */
export interface ErrorContext {
  /** Unique error ID for tracking and correlation */
  errorId: string;

  /** Timestamp when error occurred */
  timestamp: Date;

  /** Error severity level */
  severity: ErrorSeverity;

  /** Error category for classification */
  category: ErrorCategory;

  /** Operation being performed when error occurred */
  operation: string;

  /** File path(s) involved in the operation, if any */
  filePaths?: string[];

  /** Configuration values relevant to the error */
  configuration?: Record<string, unknown>;

  /** System state at time of error */
  systemState?: {
    nodeVersion?: string;
    platform?: string;
    memoryUsage?: NodeJS.MemoryUsage;
    cwd?: string;
  };

  /** User input that triggered the error */
  userInput?: unknown;

  /** Additional context data specific to the error */
  metadata?: Record<string, unknown>;

  /** Stack trace from the error location */
  stackTrace?: string;

  /** Related error IDs for error correlation */
  relatedErrors?: string[];

  /** Recovery suggestions for the error */
  recoverySuggestions?: string[];
}

/**
 * Creates a new error context with default values
 */
export function createErrorContext(
  operation: string,
  category: ErrorCategory,
  severity: ErrorSeverity = ErrorSeverity.MEDIUM,
  metadata?: Record<string, unknown>
): ErrorContext {
  return {
    errorId: generateErrorId(),
    timestamp: new Date(),
    severity,
    category,
    operation,
    systemState: {
      nodeVersion: process.version,
      platform: process.platform,
      memoryUsage: process.memoryUsage(),
      cwd: process.cwd(),
    },
    metadata,
    stackTrace: new Error().stack,
  };
}

/**
 * Enhances an existing error context with additional information
 */
export function enhanceErrorContext(
  context: ErrorContext,
  updates: Partial<ErrorContext>
): ErrorContext {
  return {
    ...context,
    ...updates,
    metadata: {
      ...context.metadata,
      ...updates.metadata,
    },
    systemState: {
      ...context.systemState,
      ...updates.systemState,
    },
    relatedErrors: [...(context.relatedErrors || []), ...(updates.relatedErrors || [])],
    recoverySuggestions: [
      ...(context.recoverySuggestions || []),
      ...(updates.recoverySuggestions || []),
    ],
  };
}

/**
 * Generates a unique error ID for tracking
 */
function generateErrorId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `err_${timestamp}_${random}`;
}

/**
 * Formats error context for logging
 */
export function formatErrorContext(context: ErrorContext): string {
  const sections = [
    `Error ID: ${context.errorId}`,
    `Timestamp: ${context.timestamp.toISOString()}`,
    `Severity: ${context.severity.toUpperCase()}`,
    `Category: ${context.category}`,
    `Operation: ${context.operation}`,
  ];

  if (context.filePaths?.length) {
    sections.push(`Files: ${context.filePaths.join(', ')}`);
  }

  if (context.metadata && Object.keys(context.metadata).length > 0) {
    sections.push(`Metadata: ${JSON.stringify(context.metadata, null, 2)}`);
  }

  if (context.recoverySuggestions?.length) {
    sections.push(
      `Recovery Suggestions:\n${context.recoverySuggestions.map((s) => `  - ${s}`).join('\n')}`
    );
  }

  return sections.join('\n');
}

/**
 * Serializes error context for storage or transmission
 */
export function serializeErrorContext(context: ErrorContext): string {
  return JSON.stringify(context, null, 2);
}

/**
 * Deserializes error context from stored format
 */
export function deserializeErrorContext(serialized: string): ErrorContext {
  const parsed = JSON.parse(serialized);
  return {
    ...parsed,
    timestamp: new Date(parsed.timestamp),
  };
}
