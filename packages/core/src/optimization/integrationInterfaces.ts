/**
 * Copyright (c) 2025 Rowan Cardow
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { z } from 'zod';
import type { PatternAnalysisInput } from '../processors/patternAnalysis';
import type { MultiPassDiscovery, MultiPassDiscoveryConfig } from './multiPassDiscovery';
import { createMultiPassDiscovery } from './multiPassDiscovery';

/**
 * Integration configuration schema
 */
export const IntegrationConfigSchema = z.object({
  enableRestApi: z.boolean().default(false),
  restApiPort: z.number().min(1000).max(65535).default(3000),
  restApiHost: z.string().default('localhost'),
  enableGrpcApi: z.boolean().default(false),
  grpcPort: z.number().min(1000).max(65535).default(50051),
  grpcHost: z.string().default('localhost'),
  enableDirectLibrary: z.boolean().default(true),
  enableInputValidation: z.boolean().default(true),
  strictValidation: z.boolean().default(false),
  maxInputSize: z.number().min(1).default(100000000),
  enableDetailedErrors: z.boolean().default(true),
  includeStackTraces: z.boolean().default(false),
  enableRequestCaching: z.boolean().default(false),
  cacheExpiration: z.number().min(1).default(3600),
  enableRateLimiting: z.boolean().default(false),
  rateLimit: z.number().min(1).default(100),
  enableMetrics: z.boolean().default(true),
  enableLogging: z.boolean().default(true),
  logLevel: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
});

export type IntegrationConfig = z.infer<typeof IntegrationConfigSchema>;

/**
 * Standard API request schema
 */
export const OptimizationRequestSchema = z.object({
  input: z.object({
    files: z
      .array(
        z.object({
          path: z.string(),
          content: z.string(),
        })
      )
      .min(1),
    patterns: z.record(z.string(), z.any()).optional(),
    metadata: z.record(z.string(), z.any()).optional(),
  }),
  config: z
    .object({
      maxPasses: z.number().min(1).max(50).default(10),
      convergenceThreshold: z.number().min(0).max(1).default(0.05),
      optimizationStrategy: z.enum(['aggressive', 'balanced', 'conservative']).default('balanced'),
      enableMetricsCollection: z.boolean().default(true),
      enableCheckpointing: z.boolean().default(false),
    })
    .default({}),
  options: z
    .object({
      async: z.boolean().default(false),
      callbackUrl: z.string().url().optional(),
      trackingId: z.string().optional(),
    })
    .default({}),
});

export type OptimizationRequest = z.infer<typeof OptimizationRequestSchema>;

/**
 * Standard API response schema
 */
export const OptimizationResponseSchema = z.object({
  success: z.boolean(),
  result: z
    .object({
      convergence: z
        .object({
          hasConverged: z.boolean(),
          convergenceReason: z.string(),
          finalPass: z.number(),
          confidenceScore: z.number(),
        })
        .optional(),
      metrics: z
        .array(
          z.object({
            passNumber: z.number(),
            duration: z.number(),
            compressionRatio: z.number(),
            patternDiversity: z.number(),
          })
        )
        .optional(),
      optimizedFiles: z
        .array(
          z.object({
            path: z.string(),
            content: z.string(),
            sizeBefore: z.number(),
            sizeAfter: z.number(),
          })
        )
        .optional(),
      summary: z
        .object({
          totalPasses: z.number(),
          totalOptimizationTime: z.number(),
          overallEfficiency: z.number(),
          finalCompressionRatio: z.number(),
        })
        .optional(),
    })
    .optional(),
  error: z
    .object({
      code: z.string(),
      message: z.string(),
      details: z.any().optional(),
      stackTrace: z.string().optional(),
    })
    .optional(),
  metadata: z.object({
    requestId: z.string(),
    timestamp: z.date(),
    processingTime: z.number(),
    trackingId: z.string().optional(),
  }),
});

export type OptimizationResponse = z.infer<typeof OptimizationResponseSchema>;

/**
 * Integration error class
 */
export class IntegrationError extends Error {
  public code: string;
  public statusCode: number;
  public details?: any;

  constructor(message: string, code: string, statusCode: number = 500, details?: any) {
    super(message);
    this.name = 'IntegrationError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

/**
 * Request validation result
 */
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  sanitizedInput?: any;
}

/**
 * Integration metrics
 */
export interface IntegrationMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageProcessingTime: number;
  peakProcessingTime: number;
  requestsPerMinute: number;
  errorsByCode: Record<string, number>;
  lastRequestTime?: Date;
}

/**
 * Base integration adapter interface
 */
export interface IntegrationAdapter {
  initialize(): Promise<void>;
  processOptimization(request: OptimizationRequest): Promise<OptimizationResponse>;
  validateRequest(request: unknown): ValidationResult;
  getMetrics(): IntegrationMetrics;
  shutdown(): Promise<void>;
}

/**
 * Direct library integration adapter
 */
export class DirectLibraryAdapter implements IntegrationAdapter {
  private config: IntegrationConfig;
  private optimizationEngine: MultiPassDiscovery;
  private metrics: IntegrationMetrics;

  constructor(config: Partial<IntegrationConfig> = {}) {
    this.config = IntegrationConfigSchema.parse(config);
    this.optimizationEngine = createMultiPassDiscovery();
    this.metrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageProcessingTime: 0,
      peakProcessingTime: 0,
      requestsPerMinute: 0,
      errorsByCode: {},
    };
  }

  public async initialize(): Promise<void> {
    this.logInfo('DirectLibraryAdapter initialized');
  }

  public async processOptimization(request: OptimizationRequest): Promise<OptimizationResponse> {
    const requestId = this.generateRequestId();
    const startTime = Date.now();

    try {
      this.metrics.totalRequests++;
      this.metrics.lastRequestTime = new Date();

      const validation = this.validateRequest(request);
      if (!validation.isValid) {
        throw new IntegrationError(
          `Request validation failed: ${validation.errors.join(', ')}`,
          'VALIDATION_ERROR',
          400,
          { errors: validation.errors, warnings: validation.warnings }
        );
      }

      const input: PatternAnalysisInput = {
        files: request.input.files.map((file) => ({
          path: file.path,
          content: file.content,
        })),
        patterns: request.input.patterns || {},
        metadata: request.input.metadata || {},
      };

      const engineConfig: Partial<MultiPassDiscoveryConfig> = {
        maxPasses: request.config.maxPasses,
        convergenceThreshold: request.config.convergenceThreshold,
        optimizationStrategy: request.config.optimizationStrategy,
        enableMetricsCollection: request.config.enableMetricsCollection,
        enableCheckpointing: request.config.enableCheckpointing,
      };

      const engine = createMultiPassDiscovery(engineConfig);
      const result = await engine.optimize(input);

      const processingTime = Date.now() - startTime;
      this.updateMetrics(processingTime, true);

      const response: OptimizationResponse = {
        success: true,
        result: {
          convergence: {
            hasConverged: result.convergence.hasConverged,
            convergenceReason: result.convergence.convergenceReason,
            finalPass: result.convergence.finalPass,
            confidenceScore: result.convergence.confidenceScore,
          },
          metrics: result.passMetrics.map((metric) => ({
            passNumber: metric.passNumber,
            duration: metric.duration,
            compressionRatio: metric.compressionRatio,
            patternDiversity: metric.patternDiversity,
          })),
          optimizedFiles: input.files.map((file) => ({
            path: file.path,
            content: file.content,
            sizeBefore: file.content.length,
            sizeAfter: file.content.length * result.finalCompressionRatio,
          })),
          summary: {
            totalPasses: result.totalPassesExecuted,
            totalOptimizationTime: result.totalOptimizationTime,
            overallEfficiency: result.overallEfficiency,
            finalCompressionRatio: result.finalCompressionRatio,
          },
        },
        metadata: {
          requestId,
          timestamp: new Date(),
          processingTime,
          trackingId: request.options.trackingId,
        },
      };

      this.logInfo(`Optimization completed for request ${requestId} in ${processingTime}ms`);
      return response;
    } catch (error) {
      const processingTime = Date.now() - startTime;
      this.updateMetrics(processingTime, false);

      if (error instanceof IntegrationError) {
        this.updateErrorMetrics(error.code);
        return this.createErrorResponse(requestId, error);
      }

      const integrationError = new IntegrationError(
        `Optimization failed: ${error instanceof Error ? error.message : String(error)}`,
        'OPTIMIZATION_ERROR',
        500,
        { originalError: error instanceof Error ? error.message : String(error) }
      );

      this.updateErrorMetrics(integrationError.code);
      return this.createErrorResponse(requestId, integrationError);
    }
  }

  public validateRequest(request: unknown): ValidationResult {
    try {
      const parsedRequest = OptimizationRequestSchema.parse(request);

      const errors: string[] = [];
      const warnings: string[] = [];

      if (this.config.enableInputValidation) {
        if (
          parsedRequest.input.files.some((file) => file.content.length > this.config.maxInputSize)
        ) {
          errors.push('One or more files exceed maximum input size');
        }

        const emptyFiles = parsedRequest.input.files.filter(
          (file) => file.content.trim().length === 0
        );
        if (emptyFiles.length > 0) {
          warnings.push(`${emptyFiles.length} files are empty`);
        }

        const invalidPaths = parsedRequest.input.files.filter(
          (file) => !file.path || file.path.trim().length === 0
        );
        if (invalidPaths.length > 0) {
          errors.push('One or more files have invalid paths');
        }
      }

      return {
        isValid: errors.length === 0,
        errors,
        warnings,
        sanitizedInput: parsedRequest,
      };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return {
          isValid: false,
          errors: error.errors.map((err) => `${err.path.join('.')}: ${err.message}`),
          warnings: [],
        };
      }

      return {
        isValid: false,
        errors: [`Validation error: ${error instanceof Error ? error.message : String(error)}`],
        warnings: [],
      };
    }
  }

  public getMetrics(): IntegrationMetrics {
    return { ...this.metrics };
  }

  public async shutdown(): Promise<void> {
    this.logInfo('DirectLibraryAdapter shutting down');
  }

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }

  private updateMetrics(processingTime: number, success: boolean): void {
    if (success) {
      this.metrics.successfulRequests++;
    } else {
      this.metrics.failedRequests++;
    }

    const totalProcessingTime =
      this.metrics.averageProcessingTime * (this.metrics.totalRequests - 1) + processingTime;
    this.metrics.averageProcessingTime = totalProcessingTime / this.metrics.totalRequests;
    this.metrics.peakProcessingTime = Math.max(this.metrics.peakProcessingTime, processingTime);
    this.metrics.requestsPerMinute = this.metrics.totalRequests;
  }

  private updateErrorMetrics(errorCode: string): void {
    this.metrics.errorsByCode[errorCode] = (this.metrics.errorsByCode[errorCode] || 0) + 1;
  }

  private createErrorResponse(requestId: string, error: IntegrationError): OptimizationResponse {
    const response: OptimizationResponse = {
      success: false,
      error: {
        code: error.code,
        message: error.message,
        details: error.details,
        stackTrace: this.config.includeStackTraces ? error.stack : undefined,
      },
      metadata: {
        requestId,
        timestamp: new Date(),
        processingTime: 0,
      },
    };

    this.logError(`Request ${requestId} failed: ${error.message}`, error);
    return response;
  }

  private logInfo(message: string): void {
    if (this.config.enableLogging && ['debug', 'info'].includes(this.config.logLevel)) {
      console.info(`[DirectLibraryAdapter] ${message}`);
    }
  }

  private logError(message: string, error?: Error): void {
    if (this.config.enableLogging) {
      console.error(`[DirectLibraryAdapter] ${message}`, error);
    }
  }
}

/**
 * REST API integration adapter
 */
export class RestApiAdapter implements IntegrationAdapter {
  private config: IntegrationConfig;
  private directAdapter: DirectLibraryAdapter;

  constructor(config: Partial<IntegrationConfig> = {}) {
    this.config = IntegrationConfigSchema.parse(config);
    this.directAdapter = new DirectLibraryAdapter(config);
  }

  public async initialize(): Promise<void> {
    await this.directAdapter.initialize();

    if (this.config.enableRestApi) {
      this.logInfo(
        `REST API server would start on ${this.config.restApiHost}:${this.config.restApiPort}`
      );
    }
  }

  public async processOptimization(request: OptimizationRequest): Promise<OptimizationResponse> {
    return await this.directAdapter.processOptimization(request);
  }

  public validateRequest(request: unknown): ValidationResult {
    return this.directAdapter.validateRequest(request);
  }

  public getMetrics(): IntegrationMetrics {
    return this.directAdapter.getMetrics();
  }

  public async shutdown(): Promise<void> {
    await this.directAdapter.shutdown();
    this.logInfo('REST API adapter shutting down');
  }

  private logInfo(message: string): void {
    if (this.config.enableLogging) {
      console.info(`[RestApiAdapter] ${message}`);
    }
  }
}

/**
 * gRPC integration adapter
 */
export class GrpcApiAdapter implements IntegrationAdapter {
  private config: IntegrationConfig;
  private directAdapter: DirectLibraryAdapter;

  constructor(config: Partial<IntegrationConfig> = {}) {
    this.config = IntegrationConfigSchema.parse(config);
    this.directAdapter = new DirectLibraryAdapter(config);
  }

  public async initialize(): Promise<void> {
    await this.directAdapter.initialize();

    if (this.config.enableGrpcApi) {
      this.logInfo(`gRPC server would start on ${this.config.grpcHost}:${this.config.grpcPort}`);
    }
  }

  public async processOptimization(request: OptimizationRequest): Promise<OptimizationResponse> {
    return await this.directAdapter.processOptimization(request);
  }

  public validateRequest(request: unknown): ValidationResult {
    return this.directAdapter.validateRequest(request);
  }

  public getMetrics(): IntegrationMetrics {
    return this.directAdapter.getMetrics();
  }

  public async shutdown(): Promise<void> {
    await this.directAdapter.shutdown();
    this.logInfo('gRPC adapter shutting down');
  }

  private logInfo(message: string): void {
    if (this.config.enableLogging) {
      console.info(`[GrpcApiAdapter] ${message}`);
    }
  }
}

/**
 * Integration manager to handle multiple adapters
 */
export class IntegrationManager {
  private config: IntegrationConfig;
  private adapters: Map<string, IntegrationAdapter> = new Map();

  constructor(config: Partial<IntegrationConfig> = {}) {
    this.config = IntegrationConfigSchema.parse(config);
  }

  public async initialize(): Promise<void> {
    if (this.config.enableDirectLibrary) {
      const directAdapter = new DirectLibraryAdapter(this.config);
      await directAdapter.initialize();
      this.adapters.set('direct', directAdapter);
    }

    if (this.config.enableRestApi) {
      const restAdapter = new RestApiAdapter(this.config);
      await restAdapter.initialize();
      this.adapters.set('rest', restAdapter);
    }

    if (this.config.enableGrpcApi) {
      const grpcAdapter = new GrpcApiAdapter(this.config);
      await grpcAdapter.initialize();
      this.adapters.set('grpc', grpcAdapter);
    }

    this.logInfo(`Integration manager initialized with ${this.adapters.size} adapters`);
  }

  public getAdapter(type: 'direct' | 'rest' | 'grpc'): IntegrationAdapter | undefined {
    return this.adapters.get(type);
  }

  public async processOptimization(
    request: OptimizationRequest,
    adapterType: 'direct' | 'rest' | 'grpc' = 'direct'
  ): Promise<OptimizationResponse> {
    const adapter = this.adapters.get(adapterType);
    if (!adapter) {
      throw new IntegrationError(
        `Adapter ${adapterType} is not available`,
        'ADAPTER_NOT_FOUND',
        404
      );
    }

    return await adapter.processOptimization(request);
  }

  public getAggregatedMetrics(): Record<string, IntegrationMetrics> {
    const metrics: Record<string, IntegrationMetrics> = {};

    for (const [type, adapter] of this.adapters) {
      metrics[type] = adapter.getMetrics();
    }

    return metrics;
  }

  public async shutdown(): Promise<void> {
    for (const [type, adapter] of this.adapters) {
      this.logInfo(`Shutting down ${type} adapter`);
      await adapter.shutdown();
    }

    this.adapters.clear();
    this.logInfo('Integration manager shutdown complete');
  }

  private logInfo(message: string): void {
    if (this.config.enableLogging) {
      console.info(`[IntegrationManager] ${message}`);
    }
  }
}

/**
 * Factory functions
 */
export function createDirectLibraryAdapter(
  config: Partial<IntegrationConfig> = {}
): DirectLibraryAdapter {
  return new DirectLibraryAdapter(config);
}

export function createRestApiAdapter(config: Partial<IntegrationConfig> = {}): RestApiAdapter {
  return new RestApiAdapter(config);
}

export function createGrpcApiAdapter(config: Partial<IntegrationConfig> = {}): GrpcApiAdapter {
  return new GrpcApiAdapter(config);
}

export function createIntegrationManager(
  config: Partial<IntegrationConfig> = {}
): IntegrationManager {
  return new IntegrationManager(config);
}

/**
 * Example usage
 */
export async function exampleIntegrationUsage(): Promise<void> {
  const manager = createIntegrationManager({
    enableDirectLibrary: true,
    enableLogging: true,
    logLevel: 'info',
  });

  await manager.initialize();

  const request: OptimizationRequest = {
    input: {
      files: [
        {
          path: 'example.css',
          content: '.btn { margin: 10px; } .button { margin: 10px; }',
        },
      ],
    },
    config: {
      maxPasses: 5,
      optimizationStrategy: 'balanced',
    },
    options: {
      trackingId: 'example-001',
    },
  };

  const response = await manager.processOptimization(request, 'direct');
  console.log('Optimization completed:', response.success);

  await manager.shutdown();
}
