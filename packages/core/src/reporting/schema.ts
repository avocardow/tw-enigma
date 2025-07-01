/**
 * JSON Schema definitions for TW-Enigma optimization reports
 */

export interface ReportMetadata {
  /** ISO 8601 timestamp when the report was generated */
  timestamp: string;
  /** TW-Enigma version used for optimization */
  version: string;
  /** Project context information */
  context: {
    /** Project name or identifier */
    projectName?: string;
    /** Project root directory */
    projectRoot: string;
    /** Configuration file path used */
    configPath?: string;
    /** Branch or commit identifier */
    revision?: string;
  };
  /** Report generation duration in milliseconds */
  generationTimeMs: number;
}

export interface FileOptimizationResult {
  /** Original file path relative to project root */
  originalPath: string;
  /** Optimized file path relative to project root */
  optimizedPath: string;
  /** Original file size in bytes */
  originalSizeBytes: number;
  /** Optimized file size in bytes */
  optimizedSizeBytes: number;
  /** Size reduction in bytes */
  sizeSavedBytes: number;
  /** Size reduction as percentage (0-100) */
  sizeSavedPercent: number;
  /** Number of CSS classes processed */
  classCount: number;
  /** Number of classes optimized */
  classesOptimized: number;
  /** Processing time in milliseconds */
  processingTimeMs: number;
  /** Error details if processing failed */
  error?: {
    message: string;
    code?: string;
    stack?: string;
  };
}

export interface OptimizationSummary {
  /** Total number of files processed */
  totalFiles: number;
  /** Number of files successfully optimized */
  filesOptimized: number;
  /** Number of files that failed processing */
  filesFailed: number;
  /** Total original size across all files in bytes */
  totalOriginalSizeBytes: number;
  /** Total optimized size across all files in bytes */
  totalOptimizedSizeBytes: number;
  /** Total size saved across all files in bytes */
  totalSizeSavedBytes: number;
  /** Overall size reduction percentage (0-100) */
  totalSizeSavedPercent: number;
  /** Total number of CSS classes processed */
  totalClasses: number;
  /** Total number of classes optimized */
  totalClassesOptimized: number;
  /** Class optimization rate as percentage (0-100) */
  classOptimizationPercent: number;
  /** Total processing time in milliseconds */
  totalProcessingTimeMs: number;
  /** Average processing time per file in milliseconds */
  averageProcessingTimeMs: number;
}

export interface PerformanceMetrics {
  /** Memory usage statistics */
  memory: {
    /** Peak memory usage in bytes */
    peakUsageBytes: number;
    /** Memory usage at start in bytes */
    startUsageBytes: number;
    /** Memory usage at end in bytes */
    endUsageBytes: number;
  };
  /** CPU usage statistics */
  cpu?: {
    /** CPU time used in milliseconds */
    cpuTimeMs: number;
    /** Average CPU utilization percentage (0-100) */
    averageUtilizationPercent: number;
  };
  /** Disk I/O statistics */
  disk?: {
    /** Number of files read */
    filesRead: number;
    /** Number of files written */
    filesWritten: number;
    /** Total bytes read */
    bytesRead: number;
    /** Total bytes written */
    bytesWritten: number;
  };
}

export interface ConfigurationDetails {
  /** Configuration options used */
  options: Record<string, any>;
  /** Framework detection results */
  framework?: {
    /** Detected framework name */
    name: string;
    /** Framework version if detected */
    version?: string;
    /** Framework-specific settings applied */
    settings?: Record<string, any>;
  };
  /** Pattern optimization settings */
  patterns?: {
    /** Pattern strategy used */
    strategy: string;
    /** Custom patterns defined */
    customPatterns?: string[];
    /** Pattern matching statistics */
    statistics?: {
      totalPatterns: number;
      patternsMatched: number;
      patternMatchRate: number;
    };
  };
}

export interface QualityMetrics {
  /** CSS validation results */
  cssValidation?: {
    /** Number of validation errors */
    errors: number;
    /** Number of validation warnings */
    warnings: number;
    /** Validation details */
    issues?: Array<{
      type: 'error' | 'warning';
      message: string;
      line?: number;
      column?: number;
      file?: string;
    }>;
  };
  /** Accessibility impact assessment */
  accessibility?: {
    /** Whether accessibility was preserved */
    preserved: boolean;
    /** Accessibility issues detected */
    issues?: string[];
    /** Accessibility score (0-100) */
    score?: number;
  };
  /** Browser compatibility assessment */
  compatibility?: {
    /** Supported browser list */
    supportedBrowsers: string[];
    /** Compatibility issues detected */
    issues?: Array<{
      browser: string;
      version: string;
      issue: string;
      severity: 'low' | 'medium' | 'high';
    }>;
  };
}

export interface OptimizationReport {
  /** Report metadata and generation info */
  metadata: ReportMetadata;
  /** High-level optimization summary */
  summary: OptimizationSummary;
  /** Detailed results for each file */
  files: FileOptimizationResult[];
  /** Performance metrics during optimization */
  performance: PerformanceMetrics;
  /** Configuration details used */
  configuration: ConfigurationDetails;
  /** Quality and validation metrics */
  quality: QualityMetrics;
  /** Historical comparison data */
  comparison?: {
    /** Previous report timestamp for comparison */
    previousReportTimestamp?: string;
    /** Changes in key metrics */
    changes?: {
      /** Change in total size saved (bytes) */
      sizeSavedBytesDelta: number;
      /** Change in processing time (ms) */
      processingTimeMsDelta: number;
      /** Change in optimization rate (percentage points) */
      optimizationRateDelta: number;
    };
  };
  /** Any errors or warnings during report generation */
  reportErrors?: Array<{
    type: 'error' | 'warning';
    message: string;
    context?: string;
  }>;
}

/**
 * JSON Schema validation for optimization reports
 */
export const REPORT_SCHEMA_VERSION = '1.0.0';

export const OPTIMIZATION_REPORT_SCHEMA = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  $id: 'https://tw-enigma.dev/schemas/optimization-report.json',
  title: 'TW-Enigma Optimization Report',
  description: 'Schema for TW-Enigma CSS optimization reports',
  type: 'object',
  required: ['metadata', 'summary', 'files', 'performance', 'configuration', 'quality'],
  properties: {
    metadata: {
      type: 'object',
      required: ['timestamp', 'version', 'context', 'generationTimeMs'],
      properties: {
        timestamp: { type: 'string', format: 'date-time' },
        version: { type: 'string' },
        context: {
          type: 'object',
          required: ['projectRoot'],
          properties: {
            projectName: { type: 'string' },
            projectRoot: { type: 'string' },
            configPath: { type: 'string' },
            revision: { type: 'string' }
          }
        },
        generationTimeMs: { type: 'number', minimum: 0 }
      }
    },
    summary: {
      type: 'object',
      required: [
        'totalFiles', 'filesOptimized', 'filesFailed',
        'totalOriginalSizeBytes', 'totalOptimizedSizeBytes', 'totalSizeSavedBytes', 'totalSizeSavedPercent',
        'totalClasses', 'totalClassesOptimized', 'classOptimizationPercent',
        'totalProcessingTimeMs', 'averageProcessingTimeMs'
      ],
      properties: {
        totalFiles: { type: 'integer', minimum: 0 },
        filesOptimized: { type: 'integer', minimum: 0 },
        filesFailed: { type: 'integer', minimum: 0 },
        totalOriginalSizeBytes: { type: 'integer', minimum: 0 },
        totalOptimizedSizeBytes: { type: 'integer', minimum: 0 },
        totalSizeSavedBytes: { type: 'integer', minimum: 0 },
        totalSizeSavedPercent: { type: 'number', minimum: 0, maximum: 100 },
        totalClasses: { type: 'integer', minimum: 0 },
        totalClassesOptimized: { type: 'integer', minimum: 0 },
        classOptimizationPercent: { type: 'number', minimum: 0, maximum: 100 },
        totalProcessingTimeMs: { type: 'number', minimum: 0 },
        averageProcessingTimeMs: { type: 'number', minimum: 0 }
      }
    },
    files: {
      type: 'array',
      items: {
        type: 'object',
        required: [
          'originalPath', 'optimizedPath',
          'originalSizeBytes', 'optimizedSizeBytes', 'sizeSavedBytes', 'sizeSavedPercent',
          'classCount', 'classesOptimized', 'processingTimeMs'
        ],
        properties: {
          originalPath: { type: 'string' },
          optimizedPath: { type: 'string' },
          originalSizeBytes: { type: 'integer', minimum: 0 },
          optimizedSizeBytes: { type: 'integer', minimum: 0 },
          sizeSavedBytes: { type: 'integer', minimum: 0 },
          sizeSavedPercent: { type: 'number', minimum: 0, maximum: 100 },
          classCount: { type: 'integer', minimum: 0 },
          classesOptimized: { type: 'integer', minimum: 0 },
          processingTimeMs: { type: 'number', minimum: 0 },
          error: {
            type: 'object',
            properties: {
              message: { type: 'string' },
              code: { type: 'string' },
              stack: { type: 'string' }
            }
          }
        }
      }
    },
    performance: {
      type: 'object',
      required: ['memory'],
      properties: {
        memory: {
          type: 'object',
          required: ['peakUsageBytes', 'startUsageBytes', 'endUsageBytes'],
          properties: {
            peakUsageBytes: { type: 'integer', minimum: 0 },
            startUsageBytes: { type: 'integer', minimum: 0 },
            endUsageBytes: { type: 'integer', minimum: 0 }
          }
        },
        cpu: {
          type: 'object',
          properties: {
            cpuTimeMs: { type: 'number', minimum: 0 },
            averageUtilizationPercent: { type: 'number', minimum: 0, maximum: 100 }
          }
        },
        disk: {
          type: 'object',
          properties: {
            filesRead: { type: 'integer', minimum: 0 },
            filesWritten: { type: 'integer', minimum: 0 },
            bytesRead: { type: 'integer', minimum: 0 },
            bytesWritten: { type: 'integer', minimum: 0 }
          }
        }
      }
    },
    configuration: {
      type: 'object',
      required: ['options'],
      properties: {
        options: { type: 'object' },
        framework: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            version: { type: 'string' },
            settings: { type: 'object' }
          }
        },
        patterns: {
          type: 'object',
          properties: {
            strategy: { type: 'string' },
            customPatterns: {
              type: 'array',
              items: { type: 'string' }
            },
            statistics: {
              type: 'object',
              properties: {
                totalPatterns: { type: 'integer', minimum: 0 },
                patternsMatched: { type: 'integer', minimum: 0 },
                patternMatchRate: { type: 'number', minimum: 0, maximum: 100 }
              }
            }
          }
        }
      }
    },
    quality: {
      type: 'object',
      properties: {
        cssValidation: {
          type: 'object',
          properties: {
            errors: { type: 'integer', minimum: 0 },
            warnings: { type: 'integer', minimum: 0 },
            issues: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  type: { type: 'string', enum: ['error', 'warning'] },
                  message: { type: 'string' },
                  line: { type: 'integer', minimum: 1 },
                  column: { type: 'integer', minimum: 1 },
                  file: { type: 'string' }
                }
              }
            }
          }
        },
        accessibility: {
          type: 'object',
          properties: {
            preserved: { type: 'boolean' },
            issues: {
              type: 'array',
              items: { type: 'string' }
            },
            score: { type: 'number', minimum: 0, maximum: 100 }
          }
        },
        compatibility: {
          type: 'object',
          properties: {
            supportedBrowsers: {
              type: 'array',
              items: { type: 'string' }
            },
            issues: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  browser: { type: 'string' },
                  version: { type: 'string' },
                  issue: { type: 'string' },
                  severity: { type: 'string', enum: ['low', 'medium', 'high'] }
                }
              }
            }
          }
        }
      }
    },
    comparison: {
      type: 'object',
      properties: {
        previousReportTimestamp: { type: 'string', format: 'date-time' },
        changes: {
          type: 'object',
          properties: {
            sizeSavedBytesDelta: { type: 'integer' },
            processingTimeMsDelta: { type: 'number' },
            optimizationRateDelta: { type: 'number' }
          }
        }
      }
    },
    reportErrors: {
      type: 'array',
      items: {
        type: 'object',
        required: ['type', 'message'],
        properties: {
          type: { type: 'string', enum: ['error', 'warning'] },
          message: { type: 'string' },
          context: { type: 'string' }
        }
      }
    }
  }
};