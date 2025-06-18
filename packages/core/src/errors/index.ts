/**
 * Copyright (c) 2025 Rowan Cardow
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

// Error context and utilities
export {
  ErrorCategory,
  ErrorSeverity,
  createErrorContext,
  deserializeErrorContext,
  enhanceErrorContext,
  formatErrorContext,
  serializeErrorContext,
  type ErrorContext,
} from './ErrorContext';

// Enhanced error types
export {
  ConfigurationError,
  EnhancedError,
  FileOperationError,
  IntegrationError,
  PerformanceError,
  ValidationError,
  createErrorByCategory,
  isConfigurationError,
  isEnhancedError,
  isFileOperationError,
  isIntegrationError,
  isPerformanceError,
  isValidationError,
} from './types';

// Re-export legacy error types for backward compatibility
export {
  CacheError,
  CollisionError,
  InvalidNameError,
  NameGenerationError,
  PrettyNameExhaustionError,
} from '../processors/nameGeneration';

export { LengthEnforcementError } from '../processors/lengthEnforcement';

// Error handling utilities
export {
  DEFAULT_ERROR_HANDLER_CONFIG,
  ErrorHandler,
  globalErrorHandler,
  withErrorHandling,
  type ErrorHandlerConfig,
  type ErrorHandlingResult,
  type RecoveryStrategy,
  type RetryStrategy,
} from './ErrorHandler';
