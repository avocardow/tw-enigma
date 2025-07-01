/**
 * Error Handling and Edge Case Support for Framework Detection
 *
 * Provides comprehensive error handling, recovery strategies, and edge case
 * management for the framework detection system.
 */

import type { DetectionContext, FrameworkInfo } from '../frameworkDetector';

export interface ErrorRecoveryOptions {
  maxRetries: number;
  fallbackDetection: boolean;
  skipCorruptedFiles: boolean;
  timeoutMs: number;
  gracefulDegradation: boolean;
}

export interface DetectionError {
  type: ErrorType;
  message: string;
  context?: string;
  originalError?: Error;
  recoverable: boolean;
  suggestedAction?: string;
}

export type ErrorType =
  | 'file_not_found'
  | 'permission_denied'
  | 'invalid_json'
  | 'timeout'
  | 'network_error'
  | 'corrupted_file'
  | 'unsupported_format'
  | 'circular_dependency'
  | 'memory_limit'
  | 'unknown';

export interface RecoveryResult {
  success: boolean;
  data?: any;
  error?: DetectionError;
  fallbackUsed: boolean;
}

/**
 * Comprehensive error handler for framework detection
 */
export class FrameworkDetectionErrorHandler {
  private options: ErrorRecoveryOptions;
  private errorHistory: DetectionError[] = [];

  constructor(options: Partial<ErrorRecoveryOptions> = {}) {
    this.options = {
      maxRetries: 3,
      fallbackDetection: true,
      skipCorruptedFiles: true,
      timeoutMs: 30000,
      gracefulDegradation: true,
      ...options,
    };
  }

  /**
   * Safe file reading with error recovery
   */
  async safeFileRead(filePath: string, parser?: (content: string) => any): Promise<RecoveryResult> {
    let lastError: DetectionError | undefined;
    
    for (let attempt = 0; attempt < this.options.maxRetries; attempt++) {
      try {
        const fs = await import('fs/promises');
        const content = await this.withTimeout(
          fs.readFile(filePath, 'utf-8'),
          this.options.timeoutMs
        );

        if (parser) {
          try {
            const parsed = parser(content);
            return { success: true, data: parsed, fallbackUsed: false };
          } catch (parseError) {
            lastError = this.createError(
              'invalid_json',
              `Failed to parse ${filePath}: ${parseError instanceof Error ? parseError.message : String(parseError)}`,
              filePath,
              parseError instanceof Error ? parseError : undefined
            );

            if (this.options.gracefulDegradation) {
              // Return raw content if parsing fails
              return { success: true, data: content, fallbackUsed: true };
            }
          }
        } else {
          return { success: true, data: content, fallbackUsed: false };
        }
      } catch (error) {
        lastError = this.handleFileError(error, filePath);
        
        if (!lastError.recoverable) {
          break;
        }

        // Wait before retry (exponential backoff)
        if (attempt < this.options.maxRetries - 1) {
          await this.delay(Math.pow(2, attempt) * 100);
        }
      }
    }

    return {
      success: false,
      error: lastError,
      fallbackUsed: false,
    };
  }

  /**
   * Safe JSON parsing with error recovery
   */
  safeJsonParse(content: string, context: string = 'unknown'): RecoveryResult {
    try {
      const parsed = JSON.parse(content);
      return { success: true, data: parsed, fallbackUsed: false };
    } catch (error) {
      const detectionError = this.createError(
        'invalid_json',
        `JSON parsing failed in ${context}: ${error instanceof Error ? error.message : String(error)}`,
        context,
        error instanceof Error ? error : undefined
      );

      if (this.options.gracefulDegradation) {
        // Try to extract basic information from malformed JSON
        const fallbackData = this.attemptPartialJsonParse(content);
        if (fallbackData) {
          return { success: true, data: fallbackData, fallbackUsed: true };
        }
      }

      return {
        success: false,
        error: detectionError,
        fallbackUsed: false,
      };
    }
  }

  /**
   * Safe directory traversal with error handling
   */
  async safeDirectoryRead(dirPath: string): Promise<RecoveryResult> {
    try {
      const fs = await import('fs/promises');
      const items = await this.withTimeout(
        fs.readdir(dirPath, { withFileTypes: true }),
        this.options.timeoutMs
      );

      const directories: string[] = [];
      const files: string[] = [];

      for (const item of items) {
        try {
          if (item.isDirectory()) {
            directories.push(item.name);
          } else if (item.isFile()) {
            files.push(item.name);
          }
        } catch (itemError) {
          // Skip problematic items if configured to do so
          if (this.options.skipCorruptedFiles) {
            continue;
          }
          throw itemError;
        }
      }

      return {
        success: true,
        data: { directories, files },
        fallbackUsed: false,
      };
    } catch (error) {
      const detectionError = this.handleFileError(error, dirPath);
      
      if (this.options.fallbackDetection && detectionError.recoverable) {
        // Try alternative detection methods
        return {
          success: true,
          data: { directories: [], files: [] },
          fallbackUsed: true,
        };
      }

      return {
        success: false,
        error: detectionError,
        fallbackUsed: false,
      };
    }
  }

  /**
   * Validate detection context and handle edge cases
   */
  validateDetectionContext(context: DetectionContext): {
    isValid: boolean;
    errors: DetectionError[];
    sanitizedContext: DetectionContext;
  } {
    const errors: DetectionError[] = [];
    const sanitizedContext = { ...context };

    // Validate root path
    if (!context.rootPath || typeof context.rootPath !== 'string') {
      errors.push(this.createError(
        'invalid_json',
        'Invalid or missing root path in detection context',
        'context.rootPath'
      ));
      sanitizedContext.rootPath = process.cwd();
    }

    // Validate package.json
    if (context.packageJson && typeof context.packageJson !== 'object') {
      errors.push(this.createError(
        'invalid_json',
        'Invalid package.json format in detection context',
        'context.packageJson'
      ));
      sanitizedContext.packageJson = undefined;
    }

    // Sanitize package.json dependencies
    if (sanitizedContext.packageJson) {
      sanitizedContext.packageJson = this.sanitizePackageJson(sanitizedContext.packageJson);
    }

    // Validate config files
    if (context.configFiles && !(context.configFiles instanceof Map)) {
      errors.push(this.createError(
        'invalid_json',
        'Invalid config files format in detection context',
        'context.configFiles'
      ));
      sanitizedContext.configFiles = new Map();
    }

    // Validate file structure
    if (context.fileStructure && (
      !Array.isArray(context.fileStructure.directories) ||
      !Array.isArray(context.fileStructure.files)
    )) {
      errors.push(this.createError(
        'invalid_json',
        'Invalid file structure format in detection context',
        'context.fileStructure'
      ));
      sanitizedContext.fileStructure = { directories: [], files: [] };
    }

    return {
      isValid: errors.length === 0,
      errors,
      sanitizedContext,
    };
  }

  /**
   * Handle conflicting framework detections
   */
  resolveFrameworkConflicts(frameworks: FrameworkInfo[]): {
    resolved: FrameworkInfo[];
    conflicts: Array<{ frameworks: string[]; resolution: string }>;
  } {
    const conflicts: Array<{ frameworks: string[]; resolution: string }> = [];
    const resolved: FrameworkInfo[] = [];

    // Group frameworks by confidence levels
    const highConfidence = frameworks.filter(fw => fw.confidence >= 0.8);
    const mediumConfidence = frameworks.filter(fw => fw.confidence >= 0.5 && fw.confidence < 0.8);
    const lowConfidence = frameworks.filter(fw => fw.confidence < 0.5);

    // Handle high confidence conflicts
    if (highConfidence.length > 1) {
      const conflictingNames = highConfidence.map(fw => fw.name);
      
      // Next.js takes precedence over React
      if (conflictingNames.includes('Next.js') && conflictingNames.includes('React')) {
        resolved.push(highConfidence.find(fw => fw.name === 'Next.js')!);
        conflicts.push({
          frameworks: ['Next.js', 'React'],
          resolution: 'Next.js selected as it includes React'
        });
      }
      // Nuxt takes precedence over Vue
      else if (conflictingNames.includes('Nuxt.js') && conflictingNames.includes('Vue.js')) {
        resolved.push(highConfidence.find(fw => fw.name === 'Nuxt.js')!);
        conflicts.push({
          frameworks: ['Nuxt.js', 'Vue.js'],
          resolution: 'Nuxt.js selected as it includes Vue.js'
        });
      }
      // SvelteKit takes precedence over Svelte
      else if (conflictingNames.includes('SvelteKit') && conflictingNames.includes('Svelte')) {
        resolved.push(highConfidence.find(fw => fw.name === 'SvelteKit')!);
        conflicts.push({
          frameworks: ['SvelteKit', 'Svelte'],
          resolution: 'SvelteKit selected as it includes Svelte'
        });
      }
      // For other conflicts, choose highest confidence
      else {
        const highest = highConfidence.reduce((prev, current) => 
          prev.confidence > current.confidence ? prev : current
        );
        resolved.push(highest);
        conflicts.push({
          frameworks: conflictingNames,
          resolution: `${highest.name} selected with highest confidence (${highest.confidence})`
        });
      }
    } else if (highConfidence.length === 1) {
      resolved.push(highConfidence[0]);
    }

    // Add medium confidence frameworks if no high confidence ones
    if (resolved.length === 0 && mediumConfidence.length > 0) {
      const highest = mediumConfidence.reduce((prev, current) => 
        prev.confidence > current.confidence ? prev : current
      );
      resolved.push(highest);
    }

    // Add low confidence frameworks if nothing else
    if (resolved.length === 0 && lowConfidence.length > 0) {
      const highest = lowConfidence.reduce((prev, current) => 
        prev.confidence > current.confidence ? prev : current
      );
      resolved.push(highest);
    }

    return { resolved, conflicts };
  }

  /**
   * Get error history
   */
  getErrorHistory(): DetectionError[] {
    return [...this.errorHistory];
  }

  /**
   * Clear error history
   */
  clearErrorHistory(): void {
    this.errorHistory = [];
  }

  /**
   * Create standardized error
   */
  private createError(
    type: ErrorType,
    message: string,
    context?: string,
    originalError?: Error
  ): DetectionError {
    const error: DetectionError = {
      type,
      message,
      context,
      originalError,
      recoverable: this.isRecoverable(type),
      suggestedAction: this.getSuggestedAction(type),
    };

    this.errorHistory.push(error);
    return error;
  }

  /**
   * Handle file system errors
   */
  private handleFileError(error: unknown, context: string): DetectionError {
    if (error instanceof Error) {
      // Node.js filesystem error codes
      const nodeError = error as NodeJS.ErrnoException;
      
      switch (nodeError.code) {
        case 'ENOENT':
          return this.createError('file_not_found', `File not found: ${context}`, context, error);
        case 'EACCES':
        case 'EPERM':
          return this.createError('permission_denied', `Permission denied: ${context}`, context, error);
        case 'ETIMEDOUT':
          return this.createError('timeout', `Operation timed out: ${context}`, context, error);
        case 'EMFILE':
        case 'ENFILE':
          return this.createError('memory_limit', `Too many open files: ${context}`, context, error);
        default:
          return this.createError('unknown', `Unknown file error: ${error.message}`, context, error);
      }
    }

    return this.createError('unknown', `Unknown error: ${String(error)}`, context);
  }

  /**
   * Determine if error type is recoverable
   */
  private isRecoverable(type: ErrorType): boolean {
    const recoverableTypes: ErrorType[] = [
      'timeout',
      'network_error',
      'invalid_json',
      'corrupted_file',
    ];
    return recoverableTypes.includes(type);
  }

  /**
   * Get suggested action for error type
   */
  private getSuggestedAction(type: ErrorType): string {
    const actions: Record<ErrorType, string> = {
      file_not_found: 'Check if the file exists and path is correct',
      permission_denied: 'Check file permissions and access rights',
      invalid_json: 'Validate JSON syntax and format',
      timeout: 'Increase timeout or check system performance',
      network_error: 'Check network connectivity',
      corrupted_file: 'Try to restore from backup or recreate file',
      unsupported_format: 'Use supported file format',
      circular_dependency: 'Review and fix circular dependencies',
      memory_limit: 'Close unused files or increase memory limit',
      unknown: 'Review error details and context',
    };
    return actions[type] || 'Review error details';
  }

  /**
   * Sanitize package.json data
   */
  private sanitizePackageJson(packageJson: any): any {
    const sanitized = { ...packageJson };

    // Ensure dependencies are objects
    ['dependencies', 'devDependencies', 'peerDependencies'].forEach(key => {
      if (sanitized[key] && typeof sanitized[key] !== 'object') {
        sanitized[key] = {};
      }
    });

    // Ensure scripts is an object
    if (sanitized.scripts && typeof sanitized.scripts !== 'object') {
      sanitized.scripts = {};
    }

    return sanitized;
  }

  /**
   * Attempt partial JSON parsing for malformed JSON
   */
  private attemptPartialJsonParse(content: string): any | null {
    try {
      // Try to extract basic fields from malformed JSON
      const nameMatch = content.match(/"name"\s*:\s*"([^"]+)"/);
      const versionMatch = content.match(/"version"\s*:\s*"([^"]+)"/);
      
      if (nameMatch || versionMatch) {
        const partial: any = {};
        if (nameMatch) partial.name = nameMatch[1];
        if (versionMatch) partial.version = versionMatch[1];
        
        // Try to extract dependencies section
        const depsMatch = content.match(/"dependencies"\s*:\s*\{([^}]+)\}/);
        if (depsMatch) {
          const depsStr = depsMatch[1];
          const deps: any = {};
          const depMatches = depsStr.match(/"([^"]+)"\s*:\s*"([^"]+)"/g);
          if (depMatches) {
            depMatches.forEach(match => {
              const [, name, version] = match.match(/"([^"]+)"\s*:\s*"([^"]+)"/) || [];
              if (name && version) {
                deps[name] = version;
              }
            });
            partial.dependencies = deps;
          }
        }
        
        return partial;
      }
    } catch {
      // Ignore parsing errors for partial extraction
    }
    
    return null;
  }

  /**
   * Promise timeout wrapper
   */
  private withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    return Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error(`Operation timed out after ${timeoutMs}ms`)), timeoutMs);
      }),
    ]);
  }

  /**
   * Delay utility
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}