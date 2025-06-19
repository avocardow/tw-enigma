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
  debug?: boolean; // Enable debug information collection
}

export interface DebugInfo {
  templateLength: number;
  placeholdersFound: string[];
  configKeys: string[];
  processingSteps: string[];
  validationSteps: string[];
  replacementDetails: Array<{
    placeholder: string;
    originalValue: any;
    formattedValue: string;
    type: string;
  }>;
}

export interface ProcessingResult {
  output: string;
  replacements: Record<string, any>;
  warnings: string[];
  errors: string[];
  debug?: DebugInfo; // Only present when debug mode is enabled
}

export class TemplateProcessor {
  private options: Required<TemplateProcessorOptions>;
  private readonly defaultPattern = /\{\{([A-Z_0-9]+)\}\}/g;

  constructor(options: TemplateProcessorOptions = {}) {
    this.options = {
      placeholderPattern: options.placeholderPattern || this.defaultPattern,
      strict: options.strict ?? true,
      validateTypes: options.validateTypes ?? true,
      debug: options.debug ?? false,
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

    // Initialize debug info if debug mode is enabled
    if (this.options.debug) {
      result.debug = {
        templateLength: template.length,
        placeholdersFound: [],
        configKeys: Object.keys(config),
        processingSteps: [],
        validationSteps: [],
        replacementDetails: [],
      };
      result.debug.processingSteps.push(
        `Starting template processing (${template.length} characters)`
      );
      result.debug.processingSteps.push(
        `Configuration provided with ${Object.keys(config).length} keys: [${Object.keys(config).join(', ')}]`
      );
    }

    // Find all placeholders in the template
    const placeholders = this.extractPlaceholders(template);
    const providedKeys = Object.keys(config);

    if (this.options.debug) {
      result.debug!.placeholdersFound = placeholders;
      result.debug!.processingSteps.push(
        `Found ${placeholders.length} unique placeholders: [${placeholders.join(', ')}]`
      );
    }

    // Check for missing placeholders
    for (const placeholder of placeholders) {
      if (!(placeholder in config)) {
        if (this.options.strict) {
          result.errors.push(`Missing value for placeholder: ${placeholder}`);
          if (this.options.debug) {
            result.debug!.processingSteps.push(
              `❌ Missing placeholder in strict mode: ${placeholder}`
            );
          }
        } else {
          result.warnings.push(
            `No value provided for placeholder: ${placeholder}, keeping original`
          );
          if (this.options.debug) {
            result.debug!.processingSteps.push(
              `⚠️  Missing placeholder (non-strict): ${placeholder}`
            );
          }
        }
      } else {
        if (this.options.debug) {
          result.debug!.processingSteps.push(
            `✅ Found value for placeholder: ${placeholder} = ${config[placeholder]} (${typeof config[placeholder]})`
          );
        }
      }
    }

    // Check for extra configuration values
    for (const key of providedKeys) {
      if (!placeholders.includes(key)) {
        result.warnings.push(`Unused configuration value: ${key}`);
        if (this.options.debug) {
          result.debug!.processingSteps.push(
            `⚠️  Unused configuration key: ${key} = ${config[key]}`
          );
        }
      }
    }

    // Perform replacements
    if (this.options.debug) {
      result.debug!.processingSteps.push(`Starting placeholder replacement...`);
    }

    result.output = template.replace(this.options.placeholderPattern, (match, placeholder) => {
      if (placeholder in config) {
        const value = config[placeholder];
        const replacement = this.formatValue(value);
        result.replacements[placeholder] = replacement;

        if (this.options.debug) {
          result.debug!.replacementDetails.push({
            placeholder,
            originalValue: value,
            formattedValue: replacement,
            type: typeof value,
          });
          result.debug!.processingSteps.push(
            `🔄 Replaced {{${placeholder}}} with: ${replacement} (${typeof value})`
          );
        }

        return replacement;
      }

      if (this.options.debug) {
        result.debug!.processingSteps.push(`⏭️  Skipped {{${placeholder}}} (no value provided)`);
      }

      return match; // Keep original if no replacement found
    });

    if (this.options.debug) {
      result.debug!.processingSteps.push(`✅ Template processing complete`);
      result.debug!.processingSteps.push(
        `📊 Final stats: ${Object.keys(result.replacements).length} replacements, ${result.warnings.length} warnings, ${result.errors.length} errors`
      );
    }

    return result;
  }

  /**
   * Extract all placeholder names from template
   */
  private extractPlaceholders(template: string): string[] {
    const placeholders: string[] = [];

    // Use matchAll instead of exec to avoid potential infinite loops
    // Create a new regex instance to avoid shared state issues
    // Preserve original flags and ensure global flag is set
    const originalFlags = this.options.placeholderPattern.flags;
    const globalFlags = originalFlags.includes('g') ? originalFlags : originalFlags + 'g';
    const regex = new RegExp(this.options.placeholderPattern.source, globalFlags);
    const matches = template.matchAll(regex);

    for (const match of matches) {
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
        .replace(/\r/g, '\\r')
        .replace(/\t/g, '\\t');
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
  validateTemplate(template: string): { isValid: boolean; errors: string[]; debug?: string[] } {
    const errors: string[] = [];
    const debugSteps: string[] = [];

    if (this.options.debug) {
      debugSteps.push(`🔍 Starting template validation (${template.length} characters)`);
    }

    // Check for unmatched braces first
    const openBraces = (template.match(/\{/g) || []).length;
    const closeBraces = (template.match(/\}/g) || []).length;

    if (this.options.debug) {
      debugSteps.push(`📊 Brace count analysis: ${openBraces} opening, ${closeBraces} closing`);
    }

    if (openBraces !== closeBraces) {
      errors.push(`Unmatched braces: ${openBraces} opening, ${closeBraces} closing`);
      if (this.options.debug) {
        debugSteps.push(`❌ Unmatched braces detected`);
      }
      return {
        isValid: false,
        errors,
        debug: this.options.debug ? debugSteps : undefined,
      };
    }

    // First, remove all valid {{PLACEHOLDER}} patterns from the template
    // to avoid false positives when checking for malformed patterns
    const validPlaceholders = template.match(/\{\{[A-Z_0-9]+\}\}/g) || [];
    const templateWithoutValidPlaceholders = template.replace(/\{\{[A-Z_0-9]+\}\}/g, '');

    if (this.options.debug) {
      debugSteps.push(
        `✅ Found ${validPlaceholders.length} valid placeholders: [${validPlaceholders.join(', ')}]`
      );
      debugSteps.push(
        `🧹 Cleaned template for malformed pattern check (${templateWithoutValidPlaceholders.length} characters remaining)`
      );
    }

    // Look for obvious malformed patterns (single braces) in the cleaned template
    const problematicPatterns = [
      /\{\{[^}]*\}\}/g, // Triple+ braces like {{{VALUE}}}
      /\{[A-Z_0-9]+\}/g, // Single braces around uppercase identifiers (likely meant to be placeholders)
    ];

    for (const pattern of problematicPatterns) {
      let match;
      while ((match = pattern.exec(templateWithoutValidPlaceholders)) !== null) {
        errors.push(`Malformed placeholder: ${match[0]}`);
        if (this.options.debug) {
          debugSteps.push(`❌ Found malformed placeholder: ${match[0]}`);
        }
      }
    }

    if (this.options.debug) {
      debugSteps.push(`✅ Validation complete: ${errors.length === 0 ? 'VALID' : 'INVALID'}`);
    }

    return {
      isValid: errors.length === 0,
      errors,
      debug: this.options.debug ? debugSteps : undefined,
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
  userConfig: Partial<TemplateConfig> = {},
  options: { debug?: boolean } = {}
): ProcessingResult {
  // Filter out undefined values from userConfig to ensure proper typing
  const filteredUserConfig: TemplateConfig = Object.fromEntries(
    Object.entries(userConfig).filter(([_, value]) => value !== undefined)
  ) as TemplateConfig;

  const config = { ...DEFAULT_SCRAMBLE_TEMPLATE_CONFIG, ...filteredUserConfig };
  const processor = new TemplateProcessor({ debug: options.debug });

  const result = processor.process(template, config);

  if (options.debug && result.debug) {
    result.debug.processingSteps.unshift(`🎯 Using scramble template defaults`);
    result.debug.processingSteps.unshift(
      `📦 Default config keys: [${Object.keys(DEFAULT_SCRAMBLE_TEMPLATE_CONFIG).join(', ')}]`
    );
    if (Object.keys(userConfig).length > 0) {
      result.debug.processingSteps.unshift(
        `🔧 User overrides: [${Object.keys(userConfig).join(', ')}]`
      );
    }
  }

  return result;
}
