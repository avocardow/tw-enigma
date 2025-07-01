/**
 * User-Facing Error Messaging System
 * 
 * This module provides a comprehensive system for mapping internal error codes
 * to user-friendly messages with actionable advice. Features include:
 * - Error code namespace mapping
 * - Localization support
 * - Context-aware message generation
 * - Security-conscious information hiding
 * - Actionable suggestions and recovery guidance
 */

import { ErrorCategory, ErrorSeverity } from './types';
import { EnigmaError } from '../utils/errors';

export interface UserMessage {
  /** Primary user-facing message */
  message: string;
  /** Detailed explanation (optional) */
  details?: string;
  /** Actionable suggestions for resolution */
  suggestions: string[];
  /** Documentation links for more help */
  helpLinks?: string[];
  /** Whether this error requires immediate attention */
  requiresAttention: boolean;
  /** Estimated recovery difficulty (1-5 scale) */
  recoveryDifficulty: number;
}

export interface ErrorCodeMapping {
  /** Error code (e.g., 'CORE-001', 'CLI-PARSE-002') */
  code: string;
  /** Error category */
  category: ErrorCategory;
  /** Error severity */
  severity: ErrorSeverity;
  /** Template for user message */
  messageTemplate: string;
  /** Template for detailed explanation */
  detailTemplate?: string;
  /** Static suggestions */
  suggestions: string[];
  /** Help documentation links */
  helpLinks?: string[];
  /** Security level - controls information exposure */
  securityLevel: 'public' | 'internal' | 'sensitive';
  /** Localization keys */
  localizationKeys?: {
    message: string;
    details?: string;
    suggestions: string[];
  };
}

export interface MessageContext {
  /** File path (sanitized for security) */
  filePath?: string;
  /** Line number */
  lineNumber?: number;
  /** Operation that failed */
  operation?: string;
  /** Input value that caused error (sanitized) */
  inputValue?: string;
  /** Expected format or value */
  expectedFormat?: string;
  /** Available options */
  availableOptions?: string[];
  /** Performance metrics */
  metrics?: {
    processingTime?: number;
    memoryUsage?: number;
  };
  /** User environment info */
  environment?: {
    nodeVersion?: string;
    platform?: string;
    workingDirectory?: string;
  };
}

export interface LocalizationProvider {
  /** Get localized string by key */
  get(key: string, locale?: string, context?: Record<string, any>): string;
  /** Check if key exists for locale */
  has(key: string, locale?: string): boolean;
  /** Get available locales */
  getAvailableLocales(): string[];
}

export class UserMessageSystem {
  private errorMappings = new Map<string, ErrorCodeMapping>();
  private localizationProvider?: LocalizationProvider;
  private defaultLocale = 'en';
  private currentLocale = 'en';
  private securityMode: 'development' | 'production' = 'development';

  constructor(options: {
    defaultLocale?: string;
    currentLocale?: string;
    securityMode?: 'development' | 'production';
    localizationProvider?: LocalizationProvider;
  } = {}) {
    this.defaultLocale = options.defaultLocale || 'en';
    this.currentLocale = options.currentLocale || 'en';
    this.securityMode = options.securityMode || 'development';
    this.localizationProvider = options.localizationProvider;
    
    this.initializeDefaultMappings();
  }

  private initializeDefaultMappings(): void {
    // Core system errors
    this.registerErrorMapping({
      code: 'CORE-001',
      category: ErrorCategory.CONFIGURATION,
      severity: ErrorSeverity.HIGH,
      messageTemplate: 'Configuration file not found at {filePath}',
      detailTemplate: 'TW-Enigma could not locate the configuration file. This file is required for operation.',
      suggestions: [
        'Create a configuration file using: tw-enigma init-config',
        'Check that the file path is correct and accessible',
        'Verify file permissions allow reading'
      ],
      helpLinks: ['https://tw-enigma.dev/docs/configuration'],
      securityLevel: 'public'
    });

    this.registerErrorMapping({
      code: 'CORE-002',
      category: ErrorCategory.CONFIGURATION,
      severity: ErrorSeverity.MEDIUM,
      messageTemplate: 'Invalid configuration: {details}',
      detailTemplate: 'The configuration file contains invalid or incompatible settings.',
      suggestions: [
        'Validate the configuration file syntax',
        'Check for required fields that may be missing',
        'Compare with example configuration files',
        'Reset to defaults with: tw-enigma init-config --reset'
      ],
      helpLinks: ['https://tw-enigma.dev/docs/configuration#validation'],
      securityLevel: 'public'
    });

    // File processing errors
    this.registerErrorMapping({
      code: 'FILE-001',
      category: ErrorCategory.EXTERNAL_SERVICE,
      severity: ErrorSeverity.MEDIUM,
      messageTemplate: 'Cannot read file: {filePath}',
      detailTemplate: 'The file exists but cannot be read due to permissions or encoding issues.',
      suggestions: [
        'Check file permissions (should be readable)',
        'Verify file encoding is UTF-8',
        'Ensure file is not locked by another process',
        'Try running with elevated permissions if necessary'
      ],
      securityLevel: 'public'
    });

    this.registerErrorMapping({
      code: 'FILE-002',
      category: ErrorCategory.VALIDATION,
      severity: ErrorSeverity.LOW,
      messageTemplate: 'File format not supported: {filePath}',
      detailTemplate: 'The file type is not supported by TW-Enigma optimization.',
      suggestions: [
        'Ensure file has a supported extension (.html, .tsx, .jsx, .vue)',
        'Check that file contains valid syntax',
        'Review supported file types in documentation'
      ],
      helpLinks: ['https://tw-enigma.dev/docs/supported-files'],
      securityLevel: 'public'
    });

    // CSS processing errors
    this.registerErrorMapping({
      code: 'CSS-001',
      category: ErrorCategory.PROGRAMMING,
      severity: ErrorSeverity.HIGH,
      messageTemplate: 'CSS parsing failed in {filePath} at line {lineNumber}',
      detailTemplate: 'The CSS syntax is invalid and cannot be processed.',
      suggestions: [
        'Check CSS syntax for errors around line {lineNumber}',
        'Validate CSS using a CSS validator',
        'Ensure all CSS rules are properly closed',
        'Remove any non-standard CSS extensions'
      ],
      helpLinks: ['https://tw-enigma.dev/docs/css-compatibility'],
      securityLevel: 'public'
    });

    // Pattern analysis errors
    this.registerErrorMapping({
      code: 'PATTERN-001',
      category: ErrorCategory.OPERATIONAL,
      severity: ErrorSeverity.MEDIUM,
      messageTemplate: 'No patterns found meeting minimum frequency threshold',
      detailTemplate: 'TW-Enigma could not find any CSS class patterns that appear frequently enough to optimize.',
      suggestions: [
        'Lower the minimum frequency threshold with --min-frequency',
        'Check that your CSS files contain Tailwind utility classes',
        'Verify input directory contains the correct files',
        'Use --verbose flag to see detailed pattern analysis'
      ],
      helpLinks: ['https://tw-enigma.dev/docs/pattern-detection'],
      securityLevel: 'public'
    });

    // Memory and performance errors
    this.registerErrorMapping({
      code: 'PERF-001',
      category: ErrorCategory.RESOURCE,
      severity: ErrorSeverity.MEDIUM,
      messageTemplate: 'Memory usage exceeds threshold: {memoryUsage}MB',
      detailTemplate: 'The optimization process is using more memory than the configured limit.',
      suggestions: [
        'Use --memory-efficient-mode for large projects',
        'Reduce --data-structure-max-entries value',
        'Process files in smaller batches',
        'Increase system memory or close other applications'
      ],
      helpLinks: ['https://tw-enigma.dev/docs/performance-tuning'],
      securityLevel: 'public'
    });

    // CLI errors
    this.registerErrorMapping({
      code: 'CLI-001',
      category: ErrorCategory.VALIDATION,
      severity: ErrorSeverity.MEDIUM,
      messageTemplate: 'Invalid command line arguments: {details}',
      detailTemplate: 'The provided command line arguments are invalid or incompatible.',
      suggestions: [
        'Check command syntax with --help',
        'Verify all required arguments are provided',
        'Ensure flag values are within valid ranges',
        'Remove conflicting flags'
      ],
      helpLinks: ['https://tw-enigma.dev/docs/cli-reference'],
      securityLevel: 'public'
    });

    // Integration errors
    this.registerErrorMapping({
      code: 'INTEGRATION-001',
      category: ErrorCategory.EXTERNAL_SERVICE,
      severity: ErrorSeverity.HIGH,
      messageTemplate: 'Build tool integration failed: {operation}',
      detailTemplate: 'TW-Enigma could not integrate with your build tool configuration.',
      suggestions: [
        'Verify build tool version compatibility',
        'Check build configuration file syntax',
        'Ensure TW-Enigma plugin is properly installed',
        'Review integration documentation for your build tool'
      ],
      helpLinks: ['https://tw-enigma.dev/docs/integrations'],
      securityLevel: 'public'
    });
  }

  public registerErrorMapping(mapping: ErrorCodeMapping): void {
    this.errorMappings.set(mapping.code, mapping);
  }

  private sanitizeValue(value: any, securityLevel: string): string {
    if (this.securityMode === 'production' && securityLevel === 'sensitive') {
      return '[REDACTED]';
    }
    
    if (this.securityMode === 'production' && securityLevel === 'internal') {
      // Sanitize potentially sensitive information
      if (typeof value === 'string') {
        // Remove file paths in production
        return value.replace(/\/[^\s]+/g, '[PATH]');
      }
    }
    
    return String(value || '');
  }

  private interpolateTemplate(template: string, context: MessageContext, securityLevel: string): string {
    return template.replace(/\{([^}]+)\}/g, (match, key) => {
      const value = (context as any)[key];
      if (value === undefined) return match;
      
      return this.sanitizeValue(value, securityLevel);
    });
  }

  private getLocalizedString(key: string, fallback: string, context?: Record<string, any>): string {
    if (this.localizationProvider && this.localizationProvider.has(key, this.currentLocale)) {
      return this.localizationProvider.get(key, this.currentLocale, context);
    }
    
    if (this.currentLocale !== this.defaultLocale && 
        this.localizationProvider && 
        this.localizationProvider.has(key, this.defaultLocale)) {
      return this.localizationProvider.get(key, this.defaultLocale, context);
    }
    
    return fallback;
  }

  public generateUserMessage(
    error: Error | EnigmaError,
    context: MessageContext = {}
  ): UserMessage {
    let errorCode: string | undefined;
    let errorMapping: ErrorCodeMapping | undefined;

    // Extract error code if available
    if (error instanceof EnigmaError && error.errorId) {
      errorCode = error.errorId;
      errorMapping = this.errorMappings.get(errorCode);
    }

    // Try to infer error code from error type or message
    if (!errorMapping) {
      errorCode = this.inferErrorCode(error, context);
      if (errorCode) {
        errorMapping = this.errorMappings.get(errorCode);
      }
    }

    // Fallback to generic error handling
    if (!errorMapping) {
      return this.generateGenericUserMessage(error, context);
    }

    const securityLevel = errorMapping.securityLevel;
    
    // Generate localized message
    const message = this.localizationProvider && errorMapping.localizationKeys
      ? this.getLocalizedString(errorMapping.localizationKeys.message, errorMapping.messageTemplate, context)
      : this.interpolateTemplate(errorMapping.messageTemplate, context, securityLevel);

    const details = errorMapping.detailTemplate
      ? this.localizationProvider && errorMapping.localizationKeys?.details
        ? this.getLocalizedString(errorMapping.localizationKeys.details, errorMapping.detailTemplate, context)
        : this.interpolateTemplate(errorMapping.detailTemplate, context, securityLevel)
      : undefined;

    // Generate suggestions with context
    const suggestions = errorMapping.suggestions.map(suggestion => 
      this.interpolateTemplate(suggestion, context, securityLevel)
    );

    return {
      message,
      details,
      suggestions,
      helpLinks: errorMapping.helpLinks || [],
      requiresAttention: errorMapping.severity >= ErrorSeverity.HIGH,
      recoveryDifficulty: this.calculateRecoveryDifficulty(errorMapping)
    };
  }

  private inferErrorCode(error: Error, context: MessageContext): string | undefined {
    const message = error.message.toLowerCase();
    const name = error.name.toLowerCase();

    // Configuration errors
    if (message.includes('config') && message.includes('not found')) {
      return 'CORE-001';
    }
    if (message.includes('config') && (message.includes('invalid') || message.includes('validation'))) {
      return 'CORE-002';
    }

    // File errors
    if (name.includes('enoent') || message.includes('no such file')) {
      return 'FILE-001';
    }
    if (message.includes('unsupported') && message.includes('file')) {
      return 'FILE-002';
    }

    // CSS errors
    if (name.includes('css') || message.includes('css parse')) {
      return 'CSS-001';
    }

    // Pattern errors
    if (message.includes('no patterns') || message.includes('frequency')) {
      return 'PATTERN-001';
    }

    // Memory errors
    if (message.includes('memory') || message.includes('heap')) {
      return 'PERF-001';
    }

    // CLI errors
    if (message.includes('argument') || message.includes('flag')) {
      return 'CLI-001';
    }

    return undefined;
  }

  private generateGenericUserMessage(error: Error, context: MessageContext): UserMessage {
    const isOperational = error.name !== 'Error' && error.name !== 'TypeError' && error.name !== 'ReferenceError';
    
    let message = 'An unexpected error occurred';
    let suggestions = ['Please try again', 'Check the input parameters'];
    
    if (isOperational) {
      message = `Operation failed: ${error.message}`;
      suggestions = [
        'Verify your input is correct',
        'Check system requirements',
        'Review the documentation for this operation',
        'Contact support if the problem persists'
      ];
    } else {
      suggestions = [
        'This appears to be a system error',
        'Please report this issue with the stack trace',
        'Try restarting the operation',
        'Check for system updates'
      ];
    }

    return {
      message,
      suggestions,
      requiresAttention: true,
      recoveryDifficulty: isOperational ? 3 : 5,
      helpLinks: ['https://tw-enigma.dev/docs/troubleshooting']
    };
  }

  private calculateRecoveryDifficulty(mapping: ErrorCodeMapping): number {
    // Base difficulty on category and severity
    let difficulty = 2;
    
    switch (mapping.category) {
      case ErrorCategory.CONFIGURATION:
        difficulty = 2; // Usually fixable by user
        break;
      case ErrorCategory.VALIDATION:
        difficulty = 1; // Easy to fix
        break;
      case ErrorCategory.EXTERNAL_SERVICE:
        difficulty = 4; // May require external changes
        break;
      case ErrorCategory.PROGRAMMING:
        difficulty = 5; // Requires code changes
        break;
      case ErrorCategory.RESOURCE:
        difficulty = 3; // System configuration
        break;
      default:
        difficulty = 3;
    }
    
    // Adjust for severity
    if (mapping.severity >= ErrorSeverity.CRITICAL) {
      difficulty = Math.min(5, difficulty + 1);
    }
    
    return difficulty;
  }

  public setLocale(locale: string): void {
    this.currentLocale = locale;
  }

  public setSecurityMode(mode: 'development' | 'production'): void {
    this.securityMode = mode;
  }

  public getErrorMapping(code: string): ErrorCodeMapping | undefined {
    return this.errorMappings.get(code);
  }

  public getAllErrorCodes(): string[] {
    return Array.from(this.errorMappings.keys());
  }

  public getErrorCodesByCategory(category: ErrorCategory): string[] {
    return Array.from(this.errorMappings.entries())
      .filter(([_, mapping]) => mapping.category === category)
      .map(([code, _]) => code);
  }
}

// Global instance
let globalUserMessageSystem: UserMessageSystem | null = null;

export function getUserMessageSystem(): UserMessageSystem {
  if (!globalUserMessageSystem) {
    globalUserMessageSystem = new UserMessageSystem();
  }
  return globalUserMessageSystem;
}

export function setUserMessageSystem(system: UserMessageSystem): void {
  globalUserMessageSystem = system;
}

// Convenience function for generating user messages
export function generateUserMessage(error: Error, context?: MessageContext): UserMessage {
  return getUserMessageSystem().generateUserMessage(error, context);
}

// Export types
export type { UserMessage, ErrorCodeMapping, MessageContext, LocalizationProvider };