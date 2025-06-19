/**
 * Template processor for scramble configuration injection
 * Handles placeholder replacement with type safety and validation
 */

export interface TemplateConfig {
  [key: string]: string | number | boolean;
}

export interface TemplateProcessorOptions {
  placeholderPattern?: RegExp;
  strict?: boolean; // Throw error on missing placeholders
  validateTypes?: boolean; // Validate that replacement values match expected types
}

export interface ProcessingResult {
  output: string;
  replacements: Record<string, any>;
  warnings: string[];
  errors: string[];
}

export class TemplateProcessor {
  private options: Required<TemplateProcessorOptions>;
  private readonly defaultPattern = /\{\{([A-Z_]+)\}\}/g;

  constructor(options: TemplateProcessorOptions = {}) {
    this.options = {
      placeholderPattern: options.placeholderPattern || this.defaultPattern,
      strict: options.strict ?? true,
      validateTypes: options.validateTypes ?? true,
    };
  }

  /**
   * Process template string by replacing placeholders with provided values
   */
  process(template: string, config: TemplateConfig): ProcessingResult {
    const result: ProcessingResult = {
      output: template,
      replacements: {},
      warnings: [],
      errors: [],
    };

    // Find all placeholders in the template
    const placeholders = this.extractPlaceholders(template);
    const providedKeys = Object.keys(config);

    // Check for missing placeholders
    for (const placeholder of placeholders) {
      if (!(placeholder in config)) {
        if (this.options.strict) {
          result.errors.push(`Missing value for placeholder: ${placeholder}`);
        } else {
          result.warnings.push(
            `No value provided for placeholder: ${placeholder}, keeping original`
          );
        }
      }
    }

    // Check for extra configuration values
    for (const key of providedKeys) {
      if (!placeholders.includes(key)) {
        result.warnings.push(`Unused configuration value: ${key}`);
      }
    }

    // Perform replacements
    result.output = template.replace(this.options.placeholderPattern, (match, placeholder) => {
      if (placeholder in config) {
        const value = config[placeholder];
        const replacement = this.formatValue(value);
        result.replacements[placeholder] = replacement;
        return replacement;
      }
      return match; // Keep original if no replacement found
    });

    return result;
  }

  /**
   * Extract all placeholder names from template
   */
  private extractPlaceholders(template: string): string[] {
    const placeholders: string[] = [];
    let match;

    // Reset regex state
    this.options.placeholderPattern.lastIndex = 0;

    while ((match = this.options.placeholderPattern.exec(template)) !== null) {
      if (!placeholders.includes(match[1])) {
        placeholders.push(match[1]);
      }
    }

    return placeholders;
  }

  /**
   * Format value for JavaScript code injection
   */
  private formatValue(value: string | number | boolean): string {
    if (typeof value === 'string') {
      // Escape quotes and special characters for JavaScript string literals
      return value
        .replace(/\\/g, '\\\\')
        .replace(/"/g, '\\"')
        .replace(/\n/g, '\\n')
        .replace(/\r/g, '\\r');
    } else if (typeof value === 'number') {
      if (!Number.isFinite(value)) {
        throw new Error(`Invalid number value: ${value}`);
      }
      return value.toString();
    } else if (typeof value === 'boolean') {
      return value.toString();
    } else {
      throw new Error(`Unsupported value type: ${typeof value}`);
    }
  }

  /**
   * Validate template syntax
   */
  validateTemplate(template: string): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check for unmatched braces first
    const openBraces = (template.match(/\{/g) || []).length;
    const closeBraces = (template.match(/\}/g) || []).length;

    if (openBraces !== closeBraces) {
      errors.push(`Unmatched braces: ${openBraces} opening, ${closeBraces} closing`);
      return {
        isValid: false,
        errors,
      };
    }

    // First, remove all valid {{PLACEHOLDER}} patterns from the template
    // to avoid false positives when checking for malformed patterns
    const templateWithoutValidPlaceholders = template.replace(/\{\{[A-Z_]+\}\}/g, '');

    // Look for obvious malformed patterns (single braces) in the cleaned template
    const problematicPatterns = [
      /\{[^}]*\}/g, // Any remaining single braces
    ];

    for (const pattern of problematicPatterns) {
      let match;
      while ((match = pattern.exec(templateWithoutValidPlaceholders)) !== null) {
        errors.push(`Malformed placeholder: ${match[0]}`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }
}

/**
 * Default configuration values for scramble template
 */
export const DEFAULT_SCRAMBLE_TEMPLATE_CONFIG: TemplateConfig = {
  SCRAMBLE_INTERVAL: 150,
  SCRAMBLE_MODE: 'all',
  CHARSET: 'abcdefghijklmnopqrstuvwxyz0123456789',
  DEBUG_MODE: false,
  RETRY_ATTEMPTS: 3,
  CLEANUP_INTERVAL: 30,
  MAX_REGISTRY_SIZE: 1000,
  PERFORMANCE_MONITORING: false,
};

/**
 * Convenience function to process scramble template with defaults
 */
export function processScrambleTemplate(
  template: string,
  userConfig: Partial<TemplateConfig> = {}
): ProcessingResult {
  const config = { ...DEFAULT_SCRAMBLE_TEMPLATE_CONFIG, ...userConfig };
  const processor = new TemplateProcessor();
  return processor.process(template, config);
}
