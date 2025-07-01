/**
 * Copyright (c) 2025 Rowan Cardow
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * API Interfaces for TW-Enigma Integration
 * 
 * Provides comprehensive APIs for triggering discovery, analysis, and integration
 * with external toolchains, CI/CD pipelines, and development environments.
 */

import { z } from 'zod';
import type { OpportunityAnalysisResult } from '../../optimization/opportunityIdentification';
import type { PatternAnalysisResult } from '../../optimization/patternDetection';
import type { ValidationResult } from '../../validation/endToEndValidation';

// API Authentication and Security Schemas
export const ApiKeySchema = z.object({
  /** API key identifier */
  keyId: z.string(),
  /** Hashed API key value */
  keyHash: z.string(),
  /** Key scope permissions */
  scopes: z.array(z.enum(['read', 'write', 'admin', 'discovery', 'analysis'])),
  /** Expiration timestamp */
  expiresAt: z.number().optional(),
  /** Associated project/organization */
  projectId: z.string().optional(),
  /** Rate limiting tier */
  rateLimitTier: z.enum(['basic', 'premium', 'enterprise']).default('basic'),
});

export type ApiKey = z.infer<typeof ApiKeySchema>;

// Discovery API Request/Response Schemas
export const DiscoveryRequestSchema = z.object({
  /** Target directory or file paths */
  targets: z.array(z.string()),
  /** File patterns to include */
  include: z.array(z.string()).default(['**/*.{html,js,jsx,ts,tsx,vue,svelte}']),
  /** File patterns to exclude */
  exclude: z.array(z.string()).default(['node_modules/**', '.git/**', 'dist/**']),
  /** Discovery configuration */
  config: z.object({
    /** Enable incremental scanning */
    incremental: z.boolean().default(true),
    /** Maximum file size to process (MB) */
    maxFileSize: z.number().default(10),
    /** Parallelization factor */
    concurrency: z.number().min(1).max(16).default(4),
    /** Pattern detection sensitivity */
    sensitivity: z.enum(['low', 'medium', 'high']).default('medium'),
    /** Enable pattern analysis */
    enablePatternAnalysis: z.boolean().default(true),
    /** Enable opportunity identification */
    enableOpportunityDetection: z.boolean().default(true),
  }).default({}),
  /** Output format preferences */
  outputFormat: z.array(z.enum(['json', 'sarif', 'html', 'markdown'])).default(['json']),
  /** Webhook URL for completion notification */
  webhookUrl: z.string().url().optional(),
});

export type DiscoveryRequest = z.infer<typeof DiscoveryRequestSchema>;

export const DiscoveryResponseSchema = z.object({
  /** Request ID for tracking */
  requestId: z.string(),
  /** Processing status */
  status: z.enum(['pending', 'processing', 'completed', 'failed']),
  /** Start timestamp */
  startedAt: z.number(),
  /** Completion timestamp */
  completedAt: z.number().optional(),
  /** Discovery results */
  results: z.object({
    /** Discovered entities */
    entities: z.array(z.object({
      filePath: z.string(),
      fileType: z.string(),
      patterns: z.number(),
      size: z.number(),
      lastModified: z.number(),
    })),
    /** Pattern analysis results */
    patternAnalysis: z.any().optional(),
    /** Opportunity analysis results */
    opportunityAnalysis: z.any().optional(),
    /** Validation results */
    validationResults: z.any().optional(),
  }).optional(),
  /** Processing statistics */
  stats: z.object({
    filesProcessed: z.number(),
    patternsFound: z.number(),
    opportunitiesIdentified: z.number(),
    processingTimeMs: z.number(),
    errorCount: z.number(),
  }),
  /** Error information if failed */
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.any().optional(),
  }).optional(),
  /** Download URLs for generated reports */
  downloadUrls: z.record(z.string()).optional(),
});

export type DiscoveryResponse = z.infer<typeof DiscoveryResponseSchema>;

// Analysis API Schemas
export const AnalysisRequestSchema = z.object({
  /** Analysis type */
  type: z.enum(['pattern', 'opportunity', 'validation', 'full']),
  /** Input data */
  input: z.object({
    /** File paths or discovery result ID */
    source: z.union([z.array(z.string()), z.string()]),
    /** Analysis configuration */
    config: z.any().optional(),
  }),
  /** Analysis options */
  options: z.object({
    /** Include detailed metrics */
    includeMetrics: z.boolean().default(true),
    /** Include recommendations */
    includeRecommendations: z.boolean().default(true),
    /** Maximum analysis depth */
    maxDepth: z.number().min(1).max(10).default(5),
    /** Quality threshold */
    qualityThreshold: z.number().min(0).max(1).default(0.8),
  }).default({}),
});

export type AnalysisRequest = z.infer<typeof AnalysisRequestSchema>;

// SARIF Output Schema (Static Analysis Results Interchange Format)
export const SarifOutputSchema = z.object({
  version: z.literal('2.1.0'),
  $schema: z.literal('https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json'),
  runs: z.array(z.object({
    tool: z.object({
      driver: z.object({
        name: z.literal('TW-Enigma'),
        version: z.string(),
        semanticVersion: z.string(),
        informationUri: z.literal('https://github.com/your-org/tw-enigma'),
        rules: z.array(z.object({
          id: z.string(),
          name: z.string(),
          shortDescription: z.object({
            text: z.string(),
          }),
          fullDescription: z.object({
            text: z.string(),
          }),
          messageStrings: z.record(z.object({
            text: z.string(),
          })),
          defaultConfiguration: z.object({
            level: z.enum(['error', 'warning', 'note', 'info']),
          }),
          helpUri: z.string().optional(),
        })),
      }),
    }),
    results: z.array(z.object({
      ruleId: z.string(),
      message: z.object({
        text: z.string(),
        id: z.string().optional(),
      }),
      level: z.enum(['error', 'warning', 'note', 'info']),
      locations: z.array(z.object({
        physicalLocation: z.object({
          artifactLocation: z.object({
            uri: z.string(),
          }),
          region: z.object({
            startLine: z.number(),
            startColumn: z.number().optional(),
            endLine: z.number().optional(),
            endColumn: z.number().optional(),
            snippet: z.object({
              text: z.string(),
            }).optional(),
          }),
        }),
      })),
      fixes: z.array(z.object({
        description: z.object({
          text: z.string(),
        }),
        artifactChanges: z.array(z.object({
          artifactLocation: z.object({
            uri: z.string(),
          }),
          replacements: z.array(z.object({
            deletedRegion: z.object({
              startLine: z.number(),
              startColumn: z.number(),
              endLine: z.number(),
              endColumn: z.number(),
            }),
            insertedContent: z.object({
              text: z.string(),
            }),
          })),
        })),
      })).optional(),
      partialFingerprints: z.record(z.string()).optional(),
      baselineState: z.enum(['new', 'unchanged', 'updated', 'absent']).optional(),
    })),
    columnKind: z.enum(['utf16CodeUnits', 'unicodeCodePoints']).default('utf16CodeUnits'),
  })),
});

export type SarifOutput = z.infer<typeof SarifOutputSchema>;

// CI/CD Integration Schemas
export const CicdIntegrationSchema = z.object({
  /** Integration type */
  type: z.enum(['github-actions', 'gitlab-ci', 'jenkins', 'azure-devops', 'circle-ci', 'travis-ci']),
  /** Configuration for specific CI/CD platform */
  config: z.object({
    /** Repository information */
    repository: z.object({
      owner: z.string(),
      name: z.string(),
      branch: z.string().optional(),
      commitSha: z.string().optional(),
    }),
    /** Pull request information */
    pullRequest: z.object({
      number: z.number(),
      title: z.string(),
      base: z.string(),
      head: z.string(),
    }).optional(),
    /** Authentication tokens */
    credentials: z.object({
      token: z.string(),
      type: z.enum(['bearer', 'basic', 'oauth']).default('bearer'),
    }).optional(),
    /** Notification preferences */
    notifications: z.object({
      /** Post comments on PRs */
      comments: z.boolean().default(true),
      /** Update commit status */
      commitStatus: z.boolean().default(true),
      /** Create annotations */
      annotations: z.boolean().default(true),
      /** Fail build on issues */
      failOnIssues: z.boolean().default(false),
    }).default({}),
  }),
});

export type CicdIntegration = z.infer<typeof CicdIntegrationSchema>;

// IDE Integration Schemas
export const IdeIntegrationSchema = z.object({
  /** IDE type */
  type: z.enum(['vscode', 'jetbrains', 'vim', 'emacs', 'sublime', 'atom']),
  /** Integration features */
  features: z.object({
    /** Real-time analysis */
    liveAnalysis: z.boolean().default(true),
    /** Inline suggestions */
    inlineSuggestions: z.boolean().default(true),
    /** Code actions */
    codeActions: z.boolean().default(true),
    /** Hover information */
    hoverInfo: z.boolean().default(true),
    /** Diagnostics */
    diagnostics: z.boolean().default(true),
  }).default({}),
  /** Language server configuration */
  languageServer: z.object({
    /** Server port */
    port: z.number().min(1024).max(65535).default(3001),
    /** Enable debug mode */
    debug: z.boolean().default(false),
    /** Log level */
    logLevel: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
  }).default({}),
});

export type IdeIntegration = z.infer<typeof IdeIntegrationSchema>;

// Webhook Payload Schemas
export const WebhookPayloadSchema = z.object({
  /** Event type */
  event: z.enum(['discovery.completed', 'analysis.completed', 'validation.completed', 'error.occurred']),
  /** Timestamp */
  timestamp: z.number(),
  /** Request ID */
  requestId: z.string(),
  /** Project/organization ID */
  projectId: z.string().optional(),
  /** Event data */
  data: z.any(),
  /** Signature for verification */
  signature: z.string().optional(),
});

export type WebhookPayload = z.infer<typeof WebhookPayloadSchema>;

// Rate Limiting Configuration
export const RateLimitConfigSchema = z.object({
  /** Requests per minute */
  requestsPerMinute: z.number().min(1).max(1000),
  /** Requests per hour */
  requestsPerHour: z.number().min(1).max(10000),
  /** Concurrent requests */
  concurrentRequests: z.number().min(1).max(50),
  /** Burst allowance */
  burstSize: z.number().min(1).max(100),
});

export type RateLimitConfig = z.infer<typeof RateLimitConfigSchema>;

// API Response Wrapper
export const ApiResponseSchema = z.object({
  /** Success status */
  success: z.boolean(),
  /** Response data */
  data: z.any().optional(),
  /** Error information */
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.any().optional(),
  }).optional(),
  /** Request metadata */
  meta: z.object({
    requestId: z.string(),
    timestamp: z.number(),
    version: z.string(),
    rateLimit: z.object({
      remaining: z.number(),
      resetAt: z.number(),
    }).optional(),
  }),
});

export type ApiResponse<T = unknown> = Omit<z.infer<typeof ApiResponseSchema>, 'data'> & {
  data?: T;
};

// Export Formats
export type OutputFormat = 'json' | 'sarif' | 'html' | 'markdown' | 'csv' | 'xml';

export interface OutputFormatConfig {
  format: OutputFormat;
  options?: {
    pretty?: boolean;
    includeMetadata?: boolean;
    template?: string;
    customFields?: string[];
  };
}

// Integration Status
export interface IntegrationStatus {
  /** Integration name */
  name: string;
  /** Current status */
  status: 'active' | 'inactive' | 'error' | 'pending';
  /** Last update timestamp */
  lastUpdate: number;
  /** Connection health */
  health: 'healthy' | 'degraded' | 'unhealthy';
  /** Performance metrics */
  metrics: {
    requestCount: number;
    averageResponseTime: number;
    errorRate: number;
    uptime: number;
  };
  /** Configuration */
  config: unknown;
}

// Batch Processing Support
export const BatchRequestSchema = z.object({
  /** Batch ID */
  batchId: z.string().optional(),
  /** Individual requests */
  requests: z.array(z.union([DiscoveryRequestSchema, AnalysisRequestSchema])),
  /** Batch options */
  options: z.object({
    /** Process in parallel */
    parallel: z.boolean().default(true),
    /** Maximum parallelism */
    maxParallel: z.number().min(1).max(10).default(3),
    /** Continue on error */
    continueOnError: z.boolean().default(true),
    /** Progress callback URL */
    progressUrl: z.string().url().optional(),
  }).default({}),
});

export type BatchRequest = z.infer<typeof BatchRequestSchema>;

// Plugin Integration Support
export interface PluginManifest {
  name: string;
  version: string;
  description: string;
  author: string;
  license: string;
  homepage?: string;
  repository?: string;
  keywords: string[];
  engines: {
    'tw-enigma': string;
    node: string;
  };
  main: string;
  types?: string;
  capabilities: {
    discovery?: boolean;
    analysis?: boolean;
    validation?: boolean;
    outputFormats?: OutputFormat[];
    integrations?: string[];
  };
  configuration?: {
    schema: unknown;
    defaults: unknown;
  };
}

// Security and Access Control
export interface AccessControlList {
  /** Resource type */
  resource: 'discovery' | 'analysis' | 'validation' | 'admin';
  /** Allowed actions */
  actions: ('read' | 'write' | 'delete' | 'admin')[];
  /** IP address restrictions */
  ipRestrictions?: string[];
  /** Time-based restrictions */
  timeRestrictions?: {
    start: string; // HH:MM format
    end: string;   // HH:MM format
    timezone: string;
    days: number[]; // 0=Sunday, 1=Monday, etc.
  };
  /** Rate limiting overrides */
  rateLimitOverrides?: Partial<RateLimitConfig>;
}

// Health Check Response
export interface HealthCheckResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: number;
  version: string;
  services: {
    discovery: 'up' | 'down' | 'degraded';
    analysis: 'up' | 'down' | 'degraded';
    validation: 'up' | 'down' | 'degraded';
    database: 'up' | 'down' | 'degraded';
    cache: 'up' | 'down' | 'degraded';
  };
  metrics: {
    uptime: number;
    memoryUsage: number;
    cpuUsage: number;
    diskUsage: number;
    responseTime: number;
  };
  dependencies: {
    name: string;
    status: 'up' | 'down' | 'degraded';
    responseTime?: number;
    error?: string;
  }[];
}