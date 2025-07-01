/**
 * Type definitions for template literal processing and dynamic class generation
 */

export interface SourceLocation {
  /** Line number (1-based) */
  line: number;
  /** Column number (1-based) */
  column: number;
  /** Absolute position in source */
  position: number;
}

export interface ProcessingContext {
  /** Source file path */
  filePath?: string;
  /** Framework type if detected */
  framework?: string;
  /** Project root directory */
  projectRoot?: string;
  /** Custom processing options */
  options?: Record<string, any>;
  /** Variables available in the context */
  variables?: Record<string, any>;
  /** Build tool being used */
  buildTool?: string;
  /** Processing metadata */
  metadata?: Record<string, any>;
}

export interface DynamicClassPattern {
  /** Pattern identifier */
  id: string;
  /** Pattern type */
  type: 'template-literal' | 'conditional' | 'computed' | 'state-based';
  /** Original source pattern */
  source: string;
  /** Static class parts */
  staticClasses: string[];
  /** Dynamic expression parts */
  expressions: Array<{
    content: string;
    type: 'variable' | 'function' | 'conditional' | 'object-key';
    dependencies?: string[];
  }>;
  /** Confidence in pattern detection */
  confidence: number;
  /** Source location */
  location: SourceLocation;
}

export interface OptimizationHint {
  /** Hint type */
  type: 'precompute' | 'cache' | 'inline' | 'extract';
  /** Target pattern or expression */
  target: string;
  /** Suggested optimization */
  suggestion: string;
  /** Estimated impact */
  impact: 'high' | 'medium' | 'low';
  /** Implementation complexity */
  complexity: 'simple' | 'moderate' | 'complex';
}

export interface RuntimeClassMapping {
  /** Original dynamic pattern */
  pattern: string;
  /** Generated static classes */
  staticClasses: string[];
  /** Runtime resolution function */
  resolver?: (context: any) => string[];
  /** Cache key for optimization */
  cacheKey?: string;
  /** Expiration time for cached results */
  expiresAt?: number;
}

export interface FallbackStrategy {
  /** Strategy name */
  name: string;
  /** Strategy priority (lower number = higher priority) */
  priority: number;
  /** Check if strategy can handle the template and error */
  canHandle: (template: string, error: Error) => boolean;
  /** Process the template with this strategy */
  process: (template: string, context: ProcessingContext) => Promise<FallbackResult>;
}

export interface FallbackResult {
  /** Whether the fallback was successful */
  success: boolean;
  /** Generated classes */
  classes: string[];
  /** Strategy used */
  strategy: string;
  /** Confidence in the result (0-1) */
  confidence: number;
  /** Warnings generated during processing */
  warnings: string[];
  /** Additional metadata */
  metadata?: Record<string, any>;
}

export interface FallbackConfig {
  /** Default fallback strategy */
  strategy?: string;
  /** Enable metrics collection */
  enableMetrics?: boolean;
  /** Enable detailed logging */
  enableDetailedLogging?: boolean;
  /** Maximum fallback attempts */
  maxFallbackAttempts?: number;
  /** Fallback timeout in milliseconds */
  fallbackTimeout?: number;
  /** Preserve original classes */
  preserveOriginalClasses?: boolean;
  /** Enable emergency fallback */
  emergencyFallbackEnabled?: boolean;
}
