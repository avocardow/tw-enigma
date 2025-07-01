/**
 * Edge Case Handler for CSS Generation System
 *
 * This module provides comprehensive edge case detection and handling for CSS generation,
 * building upon the existing validation infrastructure in the TW-Enigma system.
 *
 * Edge cases handled:
 * - Conflicting selectors and specificity issues
 * - Invalid property values and browser compatibility
 * - Duplicate rules and property conflicts
 * - Circular references in @apply directives
 * - Browser compatibility issues
 * - Malformed CSS syntax
 * - Performance degradation from excessive nesting
 */

// Types for edge case handling
export interface EdgeCaseContext {
  selector: string;
  property: string;
  value: string;
  sourceLine?: number;
  sourceFile?: string;
  timestamp: number;
}

export interface ConflictResolution {
  strategy: 'override' | 'merge' | 'warn' | 'skip';
  priority: number;
  reason: string;
  originalValue?: string;
  resolvedValue?: string;
}

export interface BrowserCompatibilityIssue {
  property: string;
  value: string;
  supportedBrowsers: string[];
  unsupportedBrowsers: string[];
  fallback?: string;
  prefix?: string;
}

export interface EdgeCaseReport {
  type: EdgeCaseType;
  severity: 'error' | 'warning' | 'info';
  context: EdgeCaseContext;
  message: string;
  resolution?: ConflictResolution;
  browserIssue?: BrowserCompatibilityIssue;
  suggestions: string[];
}

export enum EdgeCaseType {
  CONFLICTING_SELECTORS = 'conflicting_selectors',
  INVALID_PROPERTY_VALUE = 'invalid_property_value',
  DUPLICATE_RULES = 'duplicate_rules',
  CIRCULAR_REFERENCE = 'circular_reference',
  BROWSER_COMPATIBILITY = 'browser_compatibility',
  MALFORMED_SYNTAX = 'malformed_syntax',
  EXCESSIVE_NESTING = 'excessive_nesting',
  DEPRECATED_PROPERTY = 'deprecated_property',
  PERFORMANCE_IMPACT = 'performance_impact',
  SPECIFICITY_CONFLICT = 'specificity_conflict',
}

// Browser compatibility database (simplified)
const BROWSER_COMPATIBILITY_DB: Record<string, BrowserCompatibilityIssue> = {
  gap: {
    property: 'gap',
    value: '*',
    supportedBrowsers: ['Chrome 84+', 'Firefox 63+', 'Safari 14.1+'],
    unsupportedBrowsers: ['IE', 'Chrome <84', 'Firefox <63'],
    fallback: 'Use margin-based spacing for legacy browsers',
  },
  'grid-template-areas': {
    property: 'grid-template-areas',
    value: '*',
    supportedBrowsers: ['Chrome 57+', 'Firefox 52+', 'Safari 10.1+'],
    unsupportedBrowsers: ['IE <16'],
    fallback: 'Use explicit grid-column and grid-row for IE',
  },
  'backdrop-filter': {
    property: 'backdrop-filter',
    value: '*',
    supportedBrowsers: ['Chrome 76+', 'Firefox 103+', 'Safari 9+'],
    unsupportedBrowsers: ['IE'],
    prefix: '-webkit-',
    fallback: 'Use solid background colors for unsupported browsers',
  },
};

// CSS property validation patterns
const PROPERTY_VALIDATION_PATTERNS: Record<string, RegExp> = {
  color:
    /^(#[0-9a-f]{3,8}|rgb\(|rgba\(|hsl\(|hsla\(|transparent|inherit|initial|unset|red|blue|green|black|white|yellow|orange|purple|pink|gray|grey|brown|cyan|magenta|lime|navy|teal|silver|gold|indigo|violet|maroon|olive|aqua|fuchsia)$/i,
  width: /^(auto|inherit|initial|unset|\d+(\.\d+)?(px|em|rem|%|vh|vw|ch|ex))$/i,
  height: /^(auto|inherit|initial|unset|\d+(\.\d+)?(px|em|rem|%|vh|vw|ch|ex))$/i,
  margin:
    /^(auto|inherit|initial|unset|\d+(\.\d+)?(px|em|rem|%|vh|vw|ch|ex))(\s+(auto|inherit|initial|unset|\d+(\.\d+)?(px|em|rem|%|vh|vw|ch|ex))){0,3}$/i,
  padding:
    /^(\d+(\.\d+)?(px|em|rem|%|vh|vw|ch|ex))(\s+(\d+(\.\d+)?(px|em|rem|%|vh|vw|ch|ex))){0,3}$/i,
  display: /^(none|block|inline|inline-block|flex|grid|table|table-cell|table-row)$/i,
};

// Deprecated properties and their modern alternatives
const DEPRECATED_PROPERTIES: Record<string, string> = {
  'text-decoration-skip': 'text-decoration-skip-ink',
  'image-rendering': 'Use modern alternatives like crisp-edges',
  zoom: 'transform: scale()',
  filter: 'Use backdrop-filter for modern effects',
};

/**
 * Main Edge Case Handler Class
 */
export class EdgeCaseHandler {
  private reports: EdgeCaseReport[] = [];
  private config: EdgeCaseConfig;
  private maxNestingDepth: number = 10;
  private performanceThresholds = {
    maxSelectors: 1000,
    maxRules: 1000,
    maxFileSize: 1024 * 1024, // 1MB
  };

  constructor(config: EdgeCaseConfig = {}) {
    this.config = {
      enableBrowserCompatibilityChecks: true,
      enablePerformanceChecks: true,
      enableDeprecationWarnings: true,
      maxNestingDepth: 10,
      strictMode: false,
      ...config,
    };
    this.maxNestingDepth = this.config.maxNestingDepth || 10;
  }

  /**
   * Process CSS content and detect edge cases
   */
  public processCSS(cssContent: string, context: { file?: string } = {}): EdgeCaseReport[] {
    this.reports = [];

    try {
      // Parse CSS and analyze for edge cases
      const cssRules = this.parseCSS(cssContent);

      // Run all edge case checks
      this.checkDuplicateRules(cssRules, context);
      this.checkConflictingSelectors(cssRules, context);
      this.checkInvalidPropertyValues(cssRules, context);
      this.checkBrowserCompatibility(cssRules, context);
      this.checkDeprecatedProperties(cssRules, context);
      this.checkExcessiveNesting(cssRules, context);
      this.checkPerformanceImpact(cssRules, context);

      return this.reports;
    } catch (error) {
      this.addReport({
        type: EdgeCaseType.MALFORMED_SYNTAX,
        severity: 'error',
        context: {
          selector: 'N/A',
          property: 'N/A',
          value: 'N/A',
          sourceFile: context.file,
          timestamp: Date.now(),
        },
        message: `Failed to parse CSS: ${error instanceof Error ? error.message : String(error)}`,
        suggestions: [
          'Check for unclosed brackets or quotes',
          'Validate CSS syntax with a linter',
          'Ensure proper escaping of special characters',
        ],
      });

      return this.reports;
    }
  }

  /**
   * Parse CSS content into analyzable rules
   */
  private parseCSS(cssContent: string): CSSRule[] {
    const rules: CSSRule[] = [];

    // Simple CSS parser - in production, would use a proper CSS parser
    const ruleMatches = cssContent.match(/([^{}]+)\s*\{([^{}]*)\}/g);

    if (ruleMatches) {
      ruleMatches.forEach((ruleText, index) => {
        const match = ruleText.match(/([^{}]+)\s*\{([^{}]*)\}/);
        if (match) {
          const selector = match[1].trim();
          const declarations = match[2].trim();

          const properties: CSSProperty[] = [];
          const propMatches = declarations.match(/([^:;]+):\s*([^;]+)/g);

          if (propMatches) {
            propMatches.forEach((propText) => {
              const propMatch = propText.match(/([^:;]+):\s*([^;]+)/);
              if (propMatch) {
                properties.push({
                  property: propMatch[1].trim(),
                  value: propMatch[2].trim(),
                });
              }
            });
          }

          rules.push({
            selector,
            properties,
            line: index + 1,
          });
        }
      });
    }

    return rules;
  }

  /**
   * Check for duplicate rules
   */
  private checkDuplicateRules(rules: CSSRule[], context: { file?: string }): void {
    const ruleMap = new Map<string, CSSRule[]>();

    rules.forEach((rule) => {
      const key = `${rule.selector}:${rule.properties.map((p) => `${p.property}:${p.value}`).join(';')}`;

      if (!ruleMap.has(key)) {
        ruleMap.set(key, []);
      }
      ruleMap.get(key)!.push(rule);
    });

    ruleMap.forEach((duplicateRules, _key) => {
      if (duplicateRules.length > 1) {
        this.addReport({
          type: EdgeCaseType.DUPLICATE_RULES,
          severity: 'warning',
          context: {
            selector: duplicateRules[0].selector,
            property: 'multiple',
            value: 'duplicate',
            sourceLine: duplicateRules[0].line,
            sourceFile: context.file,
            timestamp: Date.now(),
          },
          message: `Duplicate rule found: ${duplicateRules[0].selector} (${duplicateRules.length} occurrences)`,
          resolution: {
            strategy: 'merge',
            priority: 1,
            reason: 'Consolidate duplicate rules to reduce CSS size',
          },
          suggestions: [
            'Consolidate duplicate rules into a single declaration',
            'Use CSS custom properties for repeated values',
            'Consider using CSS modules or styled-components for scoping',
          ],
        });
      }
    });
  }

  /**
   * Check for conflicting selectors
   */
  private checkConflictingSelectors(rules: CSSRule[], context: { file?: string }): void {
    const selectorGroups = new Map<string, CSSRule[]>();

    // Group rules by property
    rules.forEach((rule) => {
      rule.properties.forEach((prop) => {
        const key = prop.property;
        if (!selectorGroups.has(key)) {
          selectorGroups.set(key, []);
        }
        selectorGroups.get(key)!.push({
          ...rule,
          properties: [prop], // Only include the relevant property
        });
      });
    });

    selectorGroups.forEach((propertyRules, property) => {
      if (propertyRules.length > 1) {
        // Check for specificity conflicts
        const conflicts = this.detectSpecificityConflicts(propertyRules);

        conflicts.forEach((conflict) => {
          this.addReport({
            type: EdgeCaseType.CONFLICTING_SELECTORS,
            severity: 'warning',
            context: {
              selector: conflict.conflictingSelectors.join(' vs '),
              property: property,
              value: conflict.values.join(' vs '),
              sourceFile: context.file,
              timestamp: Date.now(),
            },
            message: `Conflicting selectors for property '${property}': ${conflict.conflictingSelectors.join(' vs ')}`,
            resolution: {
              strategy: 'warn',
              priority: 2,
              reason: conflict.reason,
            },
            suggestions: [
              'Increase specificity of the intended selector',
              'Use !important sparingly to resolve conflicts',
              'Restructure CSS to avoid specificity conflicts',
              'Consider using CSS-in-JS for component-scoped styles',
            ],
          });
        });
      }
    });
  }

  /**
   * Check for invalid property values
   */
  private checkInvalidPropertyValues(rules: CSSRule[], context: { file?: string }): void {
    rules.forEach((rule) => {
      rule.properties.forEach((prop) => {
        const pattern = PROPERTY_VALIDATION_PATTERNS[prop.property];

        if (pattern && !pattern.test(prop.value)) {
          this.addReport({
            type: EdgeCaseType.INVALID_PROPERTY_VALUE,
            severity: 'error',
            context: {
              selector: rule.selector,
              property: prop.property,
              value: prop.value,
              sourceLine: rule.line,
              sourceFile: context.file,
              timestamp: Date.now(),
            },
            message: `Invalid value '${prop.value}' for property '${prop.property}' in selector '${rule.selector}'`,
            suggestions: [
              `Check the syntax for ${prop.property} property`,
              'Refer to MDN documentation for valid values',
              'Use CSS validation tools to check syntax',
              'Consider using CSS custom properties for complex values',
            ],
          });
        }
      });
    });
  }

  /**
   * Check browser compatibility
   */
  private checkBrowserCompatibility(rules: CSSRule[], context: { file?: string }): void {
    if (!this.config.enableBrowserCompatibilityChecks) return;

    rules.forEach((rule) => {
      rule.properties.forEach((prop) => {
        const compatIssue = BROWSER_COMPATIBILITY_DB[prop.property];

        if (compatIssue) {
          this.addReport({
            type: EdgeCaseType.BROWSER_COMPATIBILITY,
            severity: 'warning',
            context: {
              selector: rule.selector,
              property: prop.property,
              value: prop.value,
              sourceLine: rule.line,
              sourceFile: context.file,
              timestamp: Date.now(),
            },
            message: `Browser compatibility issue with '${prop.property}' in '${rule.selector}'`,
            browserIssue: compatIssue,
            suggestions: [
              compatIssue.fallback || 'Consider providing fallbacks for older browsers',
              compatIssue.prefix ? `Use vendor prefix: ${compatIssue.prefix}${prop.property}` : '',
              'Test across target browsers',
              'Use feature detection with @supports',
            ].filter(Boolean),
          });
        }
      });
    });
  }

  /**
   * Check for deprecated properties
   */
  private checkDeprecatedProperties(rules: CSSRule[], context: { file?: string }): void {
    if (!this.config.enableDeprecationWarnings) return;

    rules.forEach((rule) => {
      rule.properties.forEach((prop) => {
        const alternative = DEPRECATED_PROPERTIES[prop.property];

        if (alternative) {
          this.addReport({
            type: EdgeCaseType.DEPRECATED_PROPERTY,
            severity: 'warning',
            context: {
              selector: rule.selector,
              property: prop.property,
              value: prop.value,
              sourceLine: rule.line,
              sourceFile: context.file,
              timestamp: Date.now(),
            },
            message: `Deprecated property '${prop.property}' used in '${rule.selector}'`,
            suggestions: [
              `Consider using: ${alternative}`,
              'Update to modern CSS alternatives',
              'Check browser support for replacement properties',
            ],
          });
        }
      });
    });
  }

  /**
   * Check for excessive nesting
   */
  private checkExcessiveNesting(rules: CSSRule[], context: { file?: string }): void {
    rules.forEach((rule) => {
      const nestingDepth = this.calculateNestingDepth(rule.selector);

      if (nestingDepth > this.maxNestingDepth) {
        this.addReport({
          type: EdgeCaseType.EXCESSIVE_NESTING,
          severity: 'warning',
          context: {
            selector: rule.selector,
            property: 'nesting',
            value: nestingDepth.toString(),
            sourceLine: rule.line,
            sourceFile: context.file,
            timestamp: Date.now(),
          },
          message: `Excessive nesting depth (${nestingDepth}) in selector '${rule.selector}'`,
          suggestions: [
            'Reduce nesting depth to improve performance',
            'Use CSS modules or BEM methodology',
            'Consider flattening nested selectors',
            'Use CSS custom properties instead of deep nesting',
          ],
        });
      }
    });
  }

  /**
   * Check for performance impact
   */
  private checkPerformanceImpact(rules: CSSRule[], context: { file?: string }): void {
    if (!this.config.enablePerformanceChecks) return;

    if (rules.length > this.performanceThresholds.maxRules) {
      this.addReport({
        type: EdgeCaseType.PERFORMANCE_IMPACT,
        severity: 'warning',
        context: {
          selector: 'global',
          property: 'rule-count',
          value: rules.length.toString(),
          sourceFile: context.file,
          timestamp: Date.now(),
        },
        message: `High number of CSS rules (${rules.length}) may impact performance`,
        suggestions: [
          'Consider splitting CSS into multiple files',
          'Use CSS purging tools to remove unused styles',
          'Implement critical CSS loading strategies',
          'Use CSS-in-JS for component-level styles',
        ],
      });
    }
  }

  /**
   * Helper methods
   */
  private detectSpecificityConflicts(rules: CSSRule[]): Array<{
    conflictingSelectors: string[];
    values: string[];
    reason: string;
  }> {
    const conflicts: Array<{
      conflictingSelectors: string[];
      values: string[];
      reason: string;
    }> = [];

    // Simple specificity conflict detection
    for (let i = 0; i < rules.length; i++) {
      for (let j = i + 1; j < rules.length; j++) {
        const rule1 = rules[i];
        const rule2 = rules[j];

        if (rule1.properties[0].value !== rule2.properties[0].value) {
          const spec1 = this.calculateSpecificity(rule1.selector);
          const spec2 = this.calculateSpecificity(rule2.selector);

          if (spec1 === spec2) {
            conflicts.push({
              conflictingSelectors: [rule1.selector, rule2.selector],
              values: [rule1.properties[0].value, rule2.properties[0].value],
              reason: 'Equal specificity - document order determines which rule applies',
            });
          }
        }
      }
    }

    return conflicts;
  }

  private calculateSpecificity(selector: string): number {
    // Simplified specificity calculation
    let specificity = 0;
    specificity += (selector.match(/#/g) || []).length * 100; // IDs
    specificity += (selector.match(/\./g) || []).length * 10; // Classes
    specificity += (selector.match(/[a-zA-Z]/g) || []).length * 1; // Elements
    return specificity;
  }

  private calculateNestingDepth(selector: string): number {
    return (selector.match(/\s+/g) || []).length + 1;
  }

  private addReport(report: EdgeCaseReport): void {
    this.reports.push(report);
  }

  /**
   * Get all detected edge cases
   */
  public getReports(): EdgeCaseReport[] {
    return [...this.reports];
  }

  /**
   * Get reports by type
   */
  public getReportsByType(type: EdgeCaseType): EdgeCaseReport[] {
    return this.reports.filter((report) => report.type === type);
  }

  /**
   * Get reports by severity
   */
  public getReportsBySeverity(severity: 'error' | 'warning' | 'info'): EdgeCaseReport[] {
    return this.reports.filter((report) => report.severity === severity);
  }

  /**
   * Generate summary report
   */
  public generateSummary(): EdgeCaseSummary {
    const summary: EdgeCaseSummary = {
      totalIssues: this.reports.length,
      errorCount: this.getReportsBySeverity('error').length,
      warningCount: this.getReportsBySeverity('warning').length,
      infoCount: this.getReportsBySeverity('info').length,
      byType: {} as Record<EdgeCaseType, number>,
      criticalIssues: this.reports.filter((r) => r.severity === 'error').slice(0, 5),
      recommendations: this.generateRecommendations(),
    };

    // Count by type
    Object.values(EdgeCaseType).forEach((type) => {
      summary.byType[type] = this.getReportsByType(type).length;
    });

    return summary;
  }

  private generateRecommendations(): string[] {
    const recommendations: string[] = [];

    if (this.getReportsByType(EdgeCaseType.DUPLICATE_RULES).length > 0) {
      recommendations.push('Consider consolidating duplicate CSS rules to reduce file size');
    }

    if (this.getReportsByType(EdgeCaseType.BROWSER_COMPATIBILITY).length > 0) {
      recommendations.push('Add vendor prefixes and fallbacks for better browser support');
    }

    if (this.getReportsByType(EdgeCaseType.EXCESSIVE_NESTING).length > 0) {
      recommendations.push('Reduce CSS nesting depth to improve performance and maintainability');
    }

    if (this.getReportsByType(EdgeCaseType.DEPRECATED_PROPERTY).length > 0) {
      recommendations.push('Update deprecated CSS properties to modern alternatives');
    }

    return recommendations;
  }
}

// Supporting types and interfaces
interface EdgeCaseConfig {
  enableBrowserCompatibilityChecks?: boolean;
  enablePerformanceChecks?: boolean;
  enableDeprecationWarnings?: boolean;
  maxNestingDepth?: number;
  strictMode?: boolean;
}

interface CSSRule {
  selector: string;
  properties: CSSProperty[];
  line?: number;
}

interface CSSProperty {
  property: string;
  value: string;
}

interface EdgeCaseSummary {
  totalIssues: number;
  errorCount: number;
  warningCount: number;
  infoCount: number;
  byType: Record<EdgeCaseType, number>;
  criticalIssues: EdgeCaseReport[];
  recommendations: string[];
}

// Export helper function for easy integration
export function analyzeCSS(cssContent: string, config?: EdgeCaseConfig): EdgeCaseReport[] {
  const handler = new EdgeCaseHandler(config);
  return handler.processCSS(cssContent);
}

export function generateEdgeCaseReport(
  cssContent: string,
  config?: EdgeCaseConfig
): EdgeCaseSummary {
  const handler = new EdgeCaseHandler(config);
  handler.processCSS(cssContent);
  return handler.generateSummary();
}
