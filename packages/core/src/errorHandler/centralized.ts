/**
 * Centralized Error Handling Architecture
 * 
 * This module provides a unified error handling system that consolidates
 * the two existing error handling systems in TW-Enigma:
 * 1. Primary ErrorHandler system (/errorHandler/)
 * 2. Enhanced Error system (/errors/)
 */

import { EventEmitter } from 'events';
import { Logger, createLogger } from '../utils/logger';
import { ErrorHandler as PrimaryErrorHandler, initializeErrorHandling } from './index';
import { ErrorHandler as EnhancedErrorHandler, globalErrorHandler } from '../errors';
import { ErrorCategory, ErrorSeverity, type ErrorHandlerConfig } from './types';
import { createErrorContext, type ErrorContext } from '../errors/ErrorContext';

export interface CentralizedErrorConfig {
  /** Enable primary error handler features (circuit breaker, analytics) */
  enablePrimaryFeatures: boolean;
  /** Enable enhanced error features (context, recovery) */
  enableEnhancedFeatures: boolean;
  /** Default configuration for primary error handler */
  primaryConfig?: Partial<ErrorHandlerConfig>;
  /** Enable detailed logging */
  enableDetailedLogging: boolean;
  /** Custom logger instance */
  logger?: Logger;
  /** Project context for error tracking */
  projectContext?: {
    name: string;
    version: string;
    environment: 'development' | 'production' | 'test';
  };
}

export interface ErrorEvent {
  id: string;
  timestamp: Date;
  error: Error;
  category: ErrorCategory;
  severity: ErrorSeverity;
  context: ErrorContext;
  recoveryAttempted: boolean;
  recoverySuccessful?: boolean;
  source: 'primary' | 'enhanced' | 'unhandled';
}

export class CentralizedErrorHandler extends EventEmitter {
  private static instance: CentralizedErrorHandler | null = null;
  private logger: Logger;
  private config: CentralizedErrorConfig;
  private primaryHandler: PrimaryErrorHandler | null = null;
  private enhancedHandler: EnhancedErrorHandler | null = null;
  private errorCount = 0;
  private initialized = false;

  private constructor(config: CentralizedErrorConfig) {
    super();
    this.config = config;
    this.logger = config.logger || createLogger({
      name: 'CentralizedErrorHandler',
      level: 'info',
      outputs: ['console']
    });
  }

  public static getInstance(config?: CentralizedErrorConfig): CentralizedErrorHandler {
    if (!CentralizedErrorHandler.instance) {
      const defaultConfig: CentralizedErrorConfig = {
        enablePrimaryFeatures: true,
        enableEnhancedFeatures: true,
        enableDetailedLogging: true,
        projectContext: {
          name: '@tw-enigma/core',
          version: '0.1.0',
          environment: process.env.NODE_ENV === 'production' ? 'production' : 'development'
        }
      };
      
      CentralizedErrorHandler.instance = new CentralizedErrorHandler({
        ...defaultConfig,
        ...config
      });
    }
    return CentralizedErrorHandler.instance;
  }

  public async initialize(): Promise<void> {
    if (this.initialized) {
      this.logger.warn('CentralizedErrorHandler already initialized');
      return;
    }

    try {
      this.logger.info('Initializing centralized error handling system...');

      // Initialize primary error handler if enabled
      if (this.config.enablePrimaryFeatures) {
        this.primaryHandler = initializeErrorHandling(this.config.primaryConfig);
        this.logger.info('Primary error handler initialized');

        // Forward primary handler events
        this.primaryHandler.on('error', (event) => {
          this.handleErrorEvent({
            ...event,
            source: 'primary'
          } as ErrorEvent);
        });

        this.primaryHandler.on('recovery', (event) => {
          this.emit('recovery', { ...event, source: 'primary' });
        });
      }

      // Initialize enhanced error handler if enabled
      if (this.config.enableEnhancedFeatures) {
        this.enhancedHandler = globalErrorHandler;
        this.logger.info('Enhanced error handler initialized');
      }

      // Set up global error handlers
      this.setupGlobalHandlers();

      this.initialized = true;
      this.logger.info('Centralized error handling system initialized successfully');
      
      this.emit('initialized', {
        primaryFeatures: this.config.enablePrimaryFeatures,
        enhancedFeatures: this.config.enableEnhancedFeatures,
        timestamp: new Date()
      });
    } catch (error) {
      this.logger.error('Failed to initialize centralized error handling:', error);
      throw error;
    }
  }

  private setupGlobalHandlers(): void {
    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      this.handleCriticalError(error, 'uncaughtException');
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
      const error = reason instanceof Error ? reason : new Error(String(reason));
      this.handleCriticalError(error, 'unhandledRejection', { promise });
    });

    // Handle warnings
    process.on('warning', (warning) => {
      this.handleWarning(warning);
    });
  }

  private async handleCriticalError(
    error: Error, 
    type: string, 
    metadata?: Record<string, any>
  ): Promise<void> {
    const errorEvent: ErrorEvent = {
      id: `critical-${++this.errorCount}-${Date.now()}`,
      timestamp: new Date(),
      error,
      category: ErrorCategory.OPERATIONAL,
      severity: ErrorSeverity.CRITICAL,
      context: createErrorContext({
        operation: type,
        metadata: {
          ...metadata,
          pid: process.pid,
          memory: process.memoryUsage(),
          uptime: process.uptime()
        }
      }),
      recoveryAttempted: false,
      source: 'unhandled'
    };

    this.handleErrorEvent(errorEvent);

    // For critical errors, attempt graceful shutdown
    if (type === 'uncaughtException') {
      this.logger.fatal('Uncaught exception detected, initiating graceful shutdown...');
      setTimeout(() => {
        process.exit(1);
      }, 1000);
    }
  }

  private handleWarning(warning: Error): void {
    const context = createErrorContext({
      operation: 'process-warning',
      metadata: {
        name: warning.name,
        code: (warning as any).code,
        stack: warning.stack
      }
    });

    this.logger.warn(`Process warning: ${warning.message}`, { context });
  }

  private handleErrorEvent(event: ErrorEvent): void {
    // Log the error event
    this.logger.error(`Error ${event.id}:`, {
      error: event.error.message,
      category: event.category,
      severity: event.severity,
      source: event.source,
      context: event.context
    });

    // Emit for external handlers
    this.emit('error', event);

    // Update statistics
    this.errorCount++;
  }

  public async handleError(
    error: Error,
    options: {
      category?: ErrorCategory;
      severity?: ErrorSeverity;
      operation?: string;
      metadata?: Record<string, any>;
      attemptRecovery?: boolean;
    } = {}
  ): Promise<boolean> {
    const {
      category = ErrorCategory.OPERATIONAL,
      severity = ErrorSeverity.MEDIUM,
      operation = 'unknown',
      metadata = {},
      attemptRecovery = true
    } = options;

    const context = createErrorContext({
      operation,
      metadata: {
        ...metadata,
        timestamp: new Date().toISOString(),
        projectContext: this.config.projectContext
      }
    });

    const errorEvent: ErrorEvent = {
      id: `error-${++this.errorCount}-${Date.now()}`,
      timestamp: new Date(),
      error,
      category,
      severity,
      context,
      recoveryAttempted: attemptRecovery,
      source: 'enhanced'
    };

    // Attempt recovery using appropriate handler
    let recoverySuccessful = false;
    if (attemptRecovery) {
      if (this.primaryHandler && this.config.enablePrimaryFeatures) {
        try {
          recoverySuccessful = await this.primaryHandler.handleError(error);
        } catch (recoveryError) {
          this.logger.error('Recovery attempt failed:', recoveryError);
        }
      } else if (this.enhancedHandler && this.config.enableEnhancedFeatures) {
        try {
          const result = await this.enhancedHandler.handleError(error, {
            maxRetries: 3,
            retryDelay: 1000
          });
          recoverySuccessful = result.recovered;
        } catch (recoveryError) {
          this.logger.error('Enhanced recovery attempt failed:', recoveryError);
        }
      }
    }

    errorEvent.recoverySuccessful = recoverySuccessful;
    this.handleErrorEvent(errorEvent);

    return recoverySuccessful;
  }

  public getStatistics(): {
    totalErrors: number;
    initialized: boolean;
    enabledFeatures: string[];
    uptime: number;
    primaryHandlerStats?: any;
    enhancedHandlerStats?: any;
  } {
    const stats = {
      totalErrors: this.errorCount,
      initialized: this.initialized,
      enabledFeatures: [
        ...(this.config.enablePrimaryFeatures ? ['primary'] : []),
        ...(this.config.enableEnhancedFeatures ? ['enhanced'] : [])
      ],
      uptime: process.uptime(),
      primaryHandlerStats: undefined as any,
      enhancedHandlerStats: undefined as any
    };

    if (this.primaryHandler) {
      try {
        stats.primaryHandlerStats = this.primaryHandler.getAnalytics();
      } catch (error) {
        this.logger.warn('Failed to get primary handler stats:', error);
      }
    }

    return stats;
  }

  public async shutdown(): Promise<void> {
    if (!this.initialized) {
      return;
    }

    this.logger.info('Shutting down centralized error handling system...');

    try {
      // Shutdown primary handler
      if (this.primaryHandler) {
        this.primaryHandler.destroy();
      }

      // Remove global handlers
      process.removeAllListeners('uncaughtException');
      process.removeAllListeners('unhandledRejection');
      process.removeAllListeners('warning');

      this.initialized = false;
      this.emit('shutdown');
      
      this.logger.info('Centralized error handling system shutdown complete');
    } catch (error) {
      this.logger.error('Error during shutdown:', error);
    }
  }

  public static async reset(): Promise<void> {
    if (CentralizedErrorHandler.instance) {
      await CentralizedErrorHandler.instance.shutdown();
      CentralizedErrorHandler.instance = null;
    }
  }
}

// Convenience functions for global access
let globalCentralizedHandler: CentralizedErrorHandler | null = null;

export function initializeCentralizedErrorHandling(config?: CentralizedErrorConfig): Promise<CentralizedErrorHandler> {
  globalCentralizedHandler = CentralizedErrorHandler.getInstance(config);
  return globalCentralizedHandler.initialize().then(() => globalCentralizedHandler!);
}

export function getCentralizedErrorHandler(): CentralizedErrorHandler {
  if (!globalCentralizedHandler) {
    throw new Error('Centralized error handler not initialized. Call initializeCentralizedErrorHandling() first.');
  }
  return globalCentralizedHandler;
}

export async function handleCentralizedError(
  error: Error,
  options?: Parameters<CentralizedErrorHandler['handleError']>[1]
): Promise<boolean> {
  const handler = getCentralizedErrorHandler();
  return handler.handleError(error, options);
}

export async function shutdownCentralizedErrorHandling(): Promise<void> {
  if (globalCentralizedHandler) {
    await globalCentralizedHandler.shutdown();
    globalCentralizedHandler = null;
  }
}

// Type exports
export type { CentralizedErrorConfig, ErrorEvent };