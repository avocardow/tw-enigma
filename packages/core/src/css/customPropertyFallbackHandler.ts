/**
 * CSS Custom Property Fallback Handling and Polyfill Integration
 * 
 * Provides robust fallback mechanisms for custom properties to ensure
 * compatibility with older browsers or environments lacking full CSS
 * variable support, with automatic fallback insertion and polyfill integration.
 */

import type { 
  VariableMap, 
  CustomPropertyDeclaration, 
  CustomPropertyUsage 
} from './customPropertyDetector.js';

export interface FallbackConfiguration {
  /** Enable automatic fallback insertion */
  autoInsertFallbacks: boolean;
  /** Fallback enforcement level */
  enforcementLevel: 'strict' | 'relaxed' | 'optional';
  /** Target browser support */
  browserTargets: BrowserTarget[];
  /** Custom fallback values */
  customFallbacks: Map<string, string>;
  /** Polyfill configuration */
  polyfillConfig: PolyfillConfiguration;
  /** Fallback value generation strategies */
  fallbackStrategies: FallbackStrategy[];
}

export interface BrowserTarget {
  /** Browser name */
  name: string;
  /** Minimum version */
  version: string;
  /** CSS custom property support level */
  supportLevel: 'full' | 'partial' | 'none';
  /** Required polyfills */
  requiredPolyfills: string[];
}

export interface PolyfillConfiguration {
  /** Enable polyfill integration */
  enabled: boolean;
  /** Polyfill provider */
  provider: 'postcss-custom-properties' | 'css-vars-ponyfill' | 'custom';
  /** Polyfill options */
  options: Record<string, any>;
  /** Runtime polyfill injection */
  runtimeInjection: boolean;
  /** Build-time transformation */
  buildTimeTransform: boolean;
}

export interface FallbackStrategy {
  /** Strategy name */
  name: string;
  /** Strategy type */
  type: 'static' | 'computed' | 'inherited' | 'default';
  /** Property patterns this strategy applies to */
  propertyPatterns: string[];
  /** Value generation function */
  generateFallback: (variable: CustomPropertyDeclaration, context: FallbackContext) => string | null;
  /** Priority (higher numbers processed first) */
  priority: number;
}

export interface FallbackContext {
  /** Current usage context */
  usage: CustomPropertyUsage;
  /** All variable declarations */
  declarations: Map<string, CustomPropertyDeclaration[]>;
  /** Browser target information */
  browserTarget: BrowserTarget;
  /** Existing fallback if any */
  existingFallback?: string;
}

export interface FallbackAnalysis {
  /** Total variable usages analyzed */
  totalUsages: number;
  /** Usages missing fallbacks */
  missingFallbacks: FallbackMissing[];
  /** Usages with invalid fallbacks */
  invalidFallbacks: FallbackInvalid[];
  /** Generated fallback suggestions */
  fallbackSuggestions: FallbackSuggestion[];
  /** Browser compatibility warnings */
  compatibilityWarnings: CompatibilityWarning[];
  /** Polyfill recommendations */
  polyfillRecommendations: PolyfillRecommendation[];
}

export interface FallbackMissing {
  /** Variable name */
  variable: string;
  /** Usage location */
  usage: CustomPropertyUsage;
  /** Risk level without fallback */
  riskLevel: 'low' | 'medium' | 'high';
  /** Recommended fallback value */
  recommendedFallback: string;
  /** Fallback generation strategy used */
  strategy: string;
}

export interface FallbackInvalid {
  /** Variable name */
  variable: string;
  /** Usage location */
  usage: CustomPropertyUsage;
  /** Current invalid fallback */
  currentFallback: string;
  /** Validation error */
  error: string;
  /** Corrected fallback suggestion */
  correctedFallback: string;
}

export interface FallbackSuggestion {
  /** Variable name */
  variable: string;
  /** Suggested fallback value */
  fallbackValue: string;
  /** Confidence level */
  confidence: number;
  /** Strategy used to generate suggestion */
  strategy: string;
  /** Applicable contexts */
  contexts: string[];
}

export interface CompatibilityWarning {
  /** Warning type */
  type: 'unsupported_browser' | 'partial_support' | 'polyfill_required' | 'performance_impact';
  /** Warning message */
  message: string;
  /** Affected browsers */
  browsers: string[];
  /** Variables affected */
  variables: string[];
  /** Severity level */
  severity: 'info' | 'warning' | 'error';
  /** Recommended action */
  recommendedAction: string;
}

export interface PolyfillRecommendation {
  /** Polyfill name */
  name: string;
  /** Purpose */
  purpose: string;
  /** Target browsers */
  targetBrowsers: string[];
  /** Installation instructions */
  installation: string;
  /** Configuration options */
  configuration: Record<string, any>;
  /** Performance impact */
  performanceImpact: 'low' | 'medium' | 'high';
}

export interface FallbackTransformResult {
  /** Original CSS content */
  originalContent: string;
  /** Transformed CSS content with fallbacks */
  transformedContent: string;
  /** Transformations applied */
  transformations: FallbackTransformation[];
  /** Errors encountered */
  errors: FallbackError[];
  /** Statistics */
  stats: FallbackStats;
}

export interface FallbackTransformation {
  /** Transformation type */
  type: 'fallback_added' | 'fallback_updated' | 'polyfill_injected' | 'property_expanded';
  /** Line number */
  line: number;
  /** Column position */
  column: number;
  /** Original text */
  original: string;
  /** Transformed text */
  transformed: string;
  /** Variable name */
  variableName: string;
  /** Strategy used */
  strategy: string;
}

export interface FallbackError {
  /** Error type */
  type: 'generation_failed' | 'invalid_syntax' | 'circular_reference' | 'unsupported_value';
  /** Error message */
  message: string;
  /** Variable name */
  variableName: string;
  /** File path */
  filePath: string;
  /** Line number */
  line: number;
  /** Original error if available */
  originalError?: Error;
}

export interface FallbackStats {
  /** Total fallbacks processed */
  totalProcessed: number;
  /** Fallbacks added */
  fallbacksAdded: number;
  /** Fallbacks updated */
  fallbacksUpdated: number;
  /** Errors encountered */
  errorsEncountered: number;
  /** Processing time */
  processingTimeMs: number;
}

export class CustomPropertyFallbackHandler {
  private config: FallbackConfiguration;
  private defaultStrategies: FallbackStrategy[];

  constructor(config: Partial<FallbackConfiguration> = {}) {
    this.config = {
      autoInsertFallbacks: true,
      enforcementLevel: 'relaxed',
      browserTargets: this.getDefaultBrowserTargets(),
      customFallbacks: new Map(),
      polyfillConfig: {
        enabled: true,
        provider: 'postcss-custom-properties',
        options: {},
        runtimeInjection: false,
        buildTimeTransform: true
      },
      fallbackStrategies: [],
      ...config
    };

    this.defaultStrategies = this.createDefaultStrategies();
    this.config.fallbackStrategies = [...this.defaultStrategies, ...this.config.fallbackStrategies];
  }

  /**
   * Analyze variable map for fallback requirements
   */
  analyzeFallbacks(variableMap: VariableMap): FallbackAnalysis {
    const missingFallbacks: FallbackMissing[] = [];
    const invalidFallbacks: FallbackInvalid[] = [];
    const fallbackSuggestions: FallbackSuggestion[] = [];
    const compatibilityWarnings: CompatibilityWarning[] = [];
    let totalUsages = 0;

    for (const [variableName, usages] of variableMap.usages) {
      totalUsages += usages.length;
      const declarations = variableMap.declarations.get(variableName) || [];

      for (const usage of usages) {
        // Check if fallback is missing
        if (!usage.fallback) {
          const missing = this.analyzeMissingFallback(variableName, usage, declarations);
          if (missing) {
            missingFallbacks.push(missing);
          }
        } else {
          // Validate existing fallback
          const validation = this.validateFallback(variableName, usage, declarations);
          if (!validation.valid) {
            invalidFallbacks.push({
              variable: variableName,
              usage,
              currentFallback: usage.fallback,
              error: validation.error,
              correctedFallback: validation.correctedValue
            });
          }
        }

        // Generate fallback suggestions
        const suggestion = this.generateFallbackSuggestion(variableName, usage, declarations);
        if (suggestion) {
          fallbackSuggestions.push(suggestion);
        }
      }
    }

    // Check browser compatibility
    const compatibility = this.analyzeBrowserCompatibility(variableMap);
    compatibilityWarnings.push(...compatibility);

    // Generate polyfill recommendations
    const polyfillRecommendations = this.generatePolyfillRecommendations(
      variableMap,
      missingFallbacks.length > 0
    );

    return {
      totalUsages,
      missingFallbacks,
      invalidFallbacks,
      fallbackSuggestions,
      compatibilityWarnings,
      polyfillRecommendations
    };
  }

  /**
   * Transform CSS content to add fallbacks
   */
  async transformCssWithFallbacks(
    content: string,
    filePath: string,
    variableMap: VariableMap
  ): Promise<FallbackTransformResult> {
    const startTime = Date.now();
    const transformations: FallbackTransformation[] = [];
    const errors: FallbackError[] = [];
    let transformedContent = content;

    try {
      // Find all var() usages in the content
      const varUsages = this.findVarUsages(content, filePath);

      // Process each usage
      for (const varUsage of varUsages) {
        try {
          const transformation = await this.processVarUsage(
            varUsage,
            variableMap,
            transformedContent
          );

          if (transformation) {
            transformedContent = this.applyTransformation(transformedContent, transformation);
            transformations.push(transformation);
          }
        } catch (error) {
          errors.push({
            type: 'generation_failed',
            message: `Failed to process var() usage: ${error instanceof Error ? error.message : String(error)}`,
            variableName: varUsage.variableName,
            filePath,
            line: varUsage.line,
            originalError: error instanceof Error ? error : undefined
          });
        }
      }

      // Apply polyfill transformations if enabled
      if (this.config.polyfillConfig.enabled && this.config.polyfillConfig.buildTimeTransform) {
        const polyfillResult = await this.applyPolyfillTransformations(transformedContent, variableMap);
        transformedContent = polyfillResult.content;
        transformations.push(...polyfillResult.transformations);
        errors.push(...polyfillResult.errors);
      }

    } catch (error) {
      errors.push({
        type: 'generation_failed',
        message: `Failed to transform CSS: ${error instanceof Error ? error.message : String(error)}`,
        variableName: '',
        filePath,
        line: 0,
        originalError: error instanceof Error ? error : undefined
      });
    }

    const processingTimeMs = Date.now() - startTime;

    return {
      originalContent: content,
      transformedContent,
      transformations,
      errors,
      stats: {
        totalProcessed: varUsages.length,
        fallbacksAdded: transformations.filter(t => t.type === 'fallback_added').length,
        fallbacksUpdated: transformations.filter(t => t.type === 'fallback_updated').length,
        errorsEncountered: errors.length,
        processingTimeMs
      }
    };
  }

  /**
   * Generate polyfill code for runtime injection
   */
  generatePolyfillCode(variableMap: VariableMap): string {
    if (!this.config.polyfillConfig.enabled || !this.config.polyfillConfig.runtimeInjection) {
      return '';
    }

    const declarations = Array.from(variableMap.declarations.values()).flat();
    const globalDeclarations = declarations.filter(d => d.scope.type === 'global');

    let polyfillCode = `
// CSS Custom Properties Polyfill
(function() {
  'use strict';
  
  // Check for native support
  if (window.CSS && CSS.supports && CSS.supports('color', 'var(--test)')) {
    return; // Native support available
  }
  
  // Polyfill implementation
  var customProperties = {
`;

    for (const declaration of globalDeclarations) {
      polyfillCode += `    '${declaration.fullName}': '${declaration.value}',\n`;
    }

    polyfillCode += `  };
  
  // Apply custom properties
  function applyCustomProperties() {
    var elements = document.querySelectorAll('*');
    for (var i = 0; i < elements.length; i++) {
      var element = elements[i];
      var styles = window.getComputedStyle(element);
      
      for (var prop in customProperties) {
        if (element.style.getPropertyValue(prop)) {
          element.style.setProperty(prop, customProperties[prop]);
        }
      }
    }
  }
  
  // Initialize polyfill
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', applyCustomProperties);
  } else {
    applyCustomProperties();
  }
})();
`;

    return polyfillCode;
  }

  // Helper methods

  private getDefaultBrowserTargets(): BrowserTarget[] {
    return [
      {
        name: 'Chrome',
        version: '49',
        supportLevel: 'full',
        requiredPolyfills: []
      },
      {
        name: 'Firefox',
        version: '31',
        supportLevel: 'full',
        requiredPolyfills: []
      },
      {
        name: 'Safari',
        version: '9.1',
        supportLevel: 'full',
        requiredPolyfills: []
      },
      {
        name: 'Edge',
        version: '16',
        supportLevel: 'full',
        requiredPolyfills: []
      },
      {
        name: 'Internet Explorer',
        version: '11',
        supportLevel: 'none',
        requiredPolyfills: ['css-vars-ponyfill']
      }
    ];
  }

  private createDefaultStrategies(): FallbackStrategy[] {
    return [
      {
        name: 'Color Fallback',
        type: 'static',
        propertyPatterns: ['*color*', '*bg*', '*background*', '*border*'],
        generateFallback: (variable, context) => {
          if (this.isColorValue(variable.value)) {
            return variable.value;
          }
          return this.getDefaultColorFallback(context.usage.cssProperty);
        },
        priority: 100
      },
      {
        name: 'Size Fallback',
        type: 'static',
        propertyPatterns: ['*size*', '*width*', '*height*', '*margin*', '*padding*'],
        generateFallback: (variable, context) => {
          if (this.isSizeValue(variable.value)) {
            return variable.value;
          }
          return this.getDefaultSizeFallback(context.usage.cssProperty);
        },
        priority: 90
      },
      {
        name: 'Font Fallback',
        type: 'static',
        propertyPatterns: ['*font*', '*text*'],
        generateFallback: (variable, context) => {
          if (context.usage.cssProperty.includes('font-family')) {
            return 'sans-serif';
          }
          if (context.usage.cssProperty.includes('font-size')) {
            return '1rem';
          }
          return variable.value;
        },
        priority: 80
      },
      {
        name: 'Custom Fallback',
        type: 'static',
        propertyPatterns: ['*'],
        generateFallback: (variable, context) => {
          const customFallback = this.config.customFallbacks.get(variable.name);
          return customFallback || variable.value;
        },
        priority: 50
      },
      {
        name: 'Default Value Fallback',
        type: 'default',
        propertyPatterns: ['*'],
        generateFallback: (variable) => variable.value,
        priority: 10
      }
    ];
  }

  private analyzeMissingFallback(
    variableName: string,
    usage: CustomPropertyUsage,
    declarations: CustomPropertyDeclaration[]
  ): FallbackMissing | null {
    if (this.config.enforcementLevel === 'optional') {
      return null;
    }

    const declaration = declarations.find(d => 
      d.scope.type === 'global' || this.isScopeAccessible(usage, d.scope)
    );

    if (!declaration) {
      return null;
    }

    const riskLevel = this.assessFallbackRisk(usage, declaration);
    const strategy = this.selectBestStrategy(declaration, { usage, declarations: new Map(), browserTarget: this.config.browserTargets[0] });
    const recommendedFallback = strategy?.generateFallback(declaration, {
      usage,
      declarations: new Map(),
      browserTarget: this.config.browserTargets[0]
    }) || declaration.value;

    return {
      variable: variableName,
      usage,
      riskLevel,
      recommendedFallback,
      strategy: strategy?.name || 'default'
    };
  }

  private validateFallback(
    variableName: string,
    usage: CustomPropertyUsage,
    declarations: CustomPropertyDeclaration[]
  ): { valid: boolean; error: string; correctedValue: string } {
    if (!usage.fallback) {
      return { valid: true, error: '', correctedValue: '' };
    }

    const fallback = usage.fallback;

    // Check for circular references
    if (fallback.includes(`var(--${variableName})`)) {
      return {
        valid: false,
        error: 'Circular reference in fallback',
        correctedValue: declarations[0]?.value || 'initial'
      };
    }

    // Validate syntax based on property type
    const isValid = this.validateFallbackSyntax(usage.cssProperty, fallback);
    
    return {
      valid: isValid,
      error: isValid ? '' : 'Invalid fallback value for property type',
      correctedValue: this.getValidFallbackForProperty(usage.cssProperty, fallback)
    };
  }

  private generateFallbackSuggestion(
    variableName: string,
    usage: CustomPropertyUsage,
    declarations: CustomPropertyDeclaration[]
  ): FallbackSuggestion | null {
    if (usage.fallback) {
      return null; // Already has fallback
    }

    const declaration = declarations.find(d => 
      d.scope.type === 'global' || this.isScopeAccessible(usage, d.scope)
    );

    if (!declaration) {
      return null;
    }

    const strategy = this.selectBestStrategy(declaration, {
      usage,
      declarations: new Map(),
      browserTarget: this.config.browserTargets[0]
    });

    if (!strategy) {
      return null;
    }

    const fallbackValue = strategy.generateFallback(declaration, {
      usage,
      declarations: new Map(),
      browserTarget: this.config.browserTargets[0]
    });

    if (!fallbackValue) {
      return null;
    }

    return {
      variable: variableName,
      fallbackValue,
      confidence: this.calculateConfidence(strategy, declaration, usage),
      strategy: strategy.name,
      contexts: [usage.cssProperty]
    };
  }

  private analyzeBrowserCompatibility(variableMap: VariableMap): CompatibilityWarning[] {
    const warnings: CompatibilityWarning[] = [];

    for (const target of this.config.browserTargets) {
      if (target.supportLevel === 'none') {
        const allVariables = Array.from(variableMap.declarations.keys());
        
        warnings.push({
          type: 'unsupported_browser',
          message: `${target.name} ${target.version} does not support CSS custom properties`,
          browsers: [`${target.name} ${target.version}`],
          variables: allVariables,
          severity: 'warning',
          recommendedAction: `Use polyfill: ${target.requiredPolyfills.join(', ')}`
        });
      } else if (target.supportLevel === 'partial') {
        warnings.push({
          type: 'partial_support',
          message: `${target.name} ${target.version} has partial CSS custom property support`,
          browsers: [`${target.name} ${target.version}`],
          variables: [],
          severity: 'info',
          recommendedAction: 'Test thoroughly and consider polyfills for complex use cases'
        });
      }
    }

    return warnings;
  }

  private generatePolyfillRecommendations(
    variableMap: VariableMap,
    hasMissingFallbacks: boolean
  ): PolyfillRecommendation[] {
    const recommendations: PolyfillRecommendation[] = [];

    const unsupportedBrowsers = this.config.browserTargets.filter(b => b.supportLevel === 'none');

    if (unsupportedBrowsers.length > 0) {
      recommendations.push({
        name: 'css-vars-ponyfill',
        purpose: 'Runtime polyfill for CSS custom properties',
        targetBrowsers: unsupportedBrowsers.map(b => `${b.name} ${b.version}`),
        installation: 'npm install css-vars-ponyfill',
        configuration: {
          include: '[data-css-vars-ponyfill]',
          exclude: '[data-css-vars-ponyfill="false"]',
          variables: this.extractGlobalVariables(variableMap)
        },
        performanceImpact: 'medium'
      });

      recommendations.push({
        name: 'postcss-custom-properties',
        purpose: 'Build-time transformation for CSS custom properties',
        targetBrowsers: unsupportedBrowsers.map(b => `${b.name} ${b.version}`),
        installation: 'npm install postcss-custom-properties',
        configuration: {
          preserve: false,
          importFrom: ['.taskmaster/custom-properties.json']
        },
        performanceImpact: 'low'
      });
    }

    return recommendations;
  }

  private findVarUsages(content: string, filePath: string): Array<{
    variableName: string;
    fullExpression: string;
    fallback?: string;
    line: number;
    column: number;
    start: number;
    end: number;
  }> {
    const usages: Array<{
      variableName: string;
      fullExpression: string;
      fallback?: string;
      line: number;
      column: number;
      start: number;
      end: number;
    }> = [];

    const varPattern = /var\(\s*--([a-zA-Z0-9-_]+)(?:\s*,\s*([^)]+))?\s*\)/g;
    const lines = content.split('\n');

    let match;
    while ((match = varPattern.exec(content)) !== null) {
      const start = match.index;
      const end = start + match[0].length;
      const lineInfo = this.getLineColumn(content, start);

      usages.push({
        variableName: match[1],
        fullExpression: match[0],
        fallback: match[2],
        line: lineInfo.line,
        column: lineInfo.column,
        start,
        end
      });
    }

    return usages;
  }

  private async processVarUsage(
    varUsage: any,
    variableMap: VariableMap,
    content: string
  ): Promise<FallbackTransformation | null> {
    if (varUsage.fallback || !this.config.autoInsertFallbacks) {
      return null; // Already has fallback or auto-insertion disabled
    }

    const declarations = variableMap.declarations.get(varUsage.variableName);
    if (!declarations || declarations.length === 0) {
      return null; // Variable not found
    }

    const primaryDeclaration = declarations.find(d => d.scope.type === 'global') || declarations[0];
    const strategy = this.selectBestStrategy(primaryDeclaration, {
      usage: {
        name: varUsage.variableName,
        expression: varUsage.fullExpression,
        filePath: '',
        line: varUsage.line,
        column: varUsage.column,
        cssProperty: this.extractCssProperty(content, varUsage.start),
        selector: 'unknown'
      },
      declarations: new Map(),
      browserTarget: this.config.browserTargets[0]
    });

    if (!strategy) {
      return null;
    }

    const fallbackValue = strategy.generateFallback(primaryDeclaration, {
      usage: {
        name: varUsage.variableName,
        expression: varUsage.fullExpression,
        filePath: '',
        line: varUsage.line,
        column: varUsage.column,
        cssProperty: this.extractCssProperty(content, varUsage.start),
        selector: 'unknown'
      },
      declarations: new Map(),
      browserTarget: this.config.browserTargets[0]
    });

    if (!fallbackValue) {
      return null;
    }

    const newExpression = `var(--${varUsage.variableName}, ${fallbackValue})`;

    return {
      type: 'fallback_added',
      line: varUsage.line,
      column: varUsage.column,
      original: varUsage.fullExpression,
      transformed: newExpression,
      variableName: varUsage.variableName,
      strategy: strategy.name
    };
  }

  private applyTransformation(content: string, transformation: FallbackTransformation): string {
    return content.replace(transformation.original, transformation.transformed);
  }

  private async applyPolyfillTransformations(
    content: string,
    variableMap: VariableMap
  ): Promise<{ content: string; transformations: FallbackTransformation[]; errors: FallbackError[] }> {
    // Simplified polyfill transformation
    return {
      content,
      transformations: [],
      errors: []
    };
  }

  private selectBestStrategy(
    declaration: CustomPropertyDeclaration,
    context: FallbackContext
  ): FallbackStrategy | null {
    const applicableStrategies = this.config.fallbackStrategies.filter(strategy =>
      strategy.propertyPatterns.some(pattern =>
        this.matchesPattern(declaration.name, pattern) ||
        this.matchesPattern(context.usage.cssProperty, pattern)
      )
    );

    // Sort by priority (highest first)
    applicableStrategies.sort((a, b) => b.priority - a.priority);

    return applicableStrategies[0] || null;
  }

  private assessFallbackRisk(
    usage: CustomPropertyUsage,
    declaration: CustomPropertyDeclaration
  ): 'low' | 'medium' | 'high' {
    // Critical properties have higher risk
    const criticalProperties = ['color', 'background-color', 'font-family'];
    
    if (criticalProperties.includes(usage.cssProperty)) {
      return 'high';
    }

    // Dynamic or complex values have medium risk
    if (declaration.containsVariables || declaration.value.includes('calc(')) {
      return 'medium';
    }

    return 'low';
  }

  private isScopeAccessible(usage: CustomPropertyUsage, scope: any): boolean {
    // Simplified scope accessibility check
    return scope.type === 'global' || usage.filePath === scope.filePath;
  }

  private calculateConfidence(
    strategy: FallbackStrategy,
    declaration: CustomPropertyDeclaration,
    usage: CustomPropertyUsage
  ): number {
    let confidence = 0.5; // Base confidence

    // Higher confidence for exact matches
    if (strategy.propertyPatterns.some(pattern => 
        this.matchesPattern(declaration.name, pattern, true))) {
      confidence += 0.3;
    }

    // Higher confidence for static strategies
    if (strategy.type === 'static') {
      confidence += 0.2;
    }

    // Lower confidence for complex values
    if (declaration.containsVariables) {
      confidence -= 0.2;
    }

    return Math.max(0, Math.min(1, confidence));
  }

  private extractGlobalVariables(variableMap: VariableMap): Record<string, string> {
    const globals: Record<string, string> = {};

    for (const [name, declarations] of variableMap.declarations) {
      const globalDeclaration = declarations.find(d => d.scope.type === 'global');
      if (globalDeclaration) {
        globals[globalDeclaration.fullName] = globalDeclaration.value;
      }
    }

    return globals;
  }

  private getLineColumn(content: string, index: number): { line: number; column: number } {
    const lines = content.substring(0, index).split('\n');
    return {
      line: lines.length,
      column: lines[lines.length - 1].length + 1
    };
  }

  private extractCssProperty(content: string, varStart: number): string {
    // Find the CSS property that contains this var() usage
    const beforeVar = content.substring(0, varStart);
    const propertyMatch = beforeVar.match(/([a-zA-Z-]+)\s*:\s*[^;]*$/);
    return propertyMatch ? propertyMatch[1] : 'unknown';
  }

  private matchesPattern(text: string, pattern: string, exact = false): boolean {
    if (exact) {
      return text === pattern.replace(/\*/g, '');
    }
    const regex = new RegExp(pattern.replace(/\*/g, '.*'), 'i');
    return regex.test(text);
  }

  private isColorValue(value: string): boolean {
    return /^(#[0-9a-fA-F]{3,8}|rgb\(|rgba\(|hsl\(|hsla\()/.test(value.trim());
  }

  private isSizeValue(value: string): boolean {
    return /^\d+(\.\d+)?(px|em|rem|%|vh|vw|pt|pc|in|cm|mm|ex|ch|vmin|vmax)$/.test(value.trim());
  }

  private getDefaultColorFallback(property: string): string {
    const colorDefaults: Record<string, string> = {
      'color': '#000000',
      'background-color': 'transparent',
      'border-color': 'currentColor'
    };
    return colorDefaults[property] || '#000000';
  }

  private getDefaultSizeFallback(property: string): string {
    const sizeDefaults: Record<string, string> = {
      'font-size': '1rem',
      'width': 'auto',
      'height': 'auto',
      'margin': '0',
      'padding': '0'
    };
    return sizeDefaults[property] || '0';
  }

  private validateFallbackSyntax(property: string, fallback: string): boolean {
    // Simplified validation
    if (property.includes('color')) {
      return this.isColorValue(fallback) || fallback === 'transparent' || fallback === 'currentColor';
    }
    
    if (property.includes('size') || property.includes('width') || property.includes('height')) {
      return this.isSizeValue(fallback) || fallback === 'auto';
    }

    return true; // Default to valid for other properties
  }

  private getValidFallbackForProperty(property: string, invalidFallback: string): string {
    if (property.includes('color')) {
      return this.getDefaultColorFallback(property);
    }
    
    if (property.includes('size') || property.includes('width') || property.includes('height')) {
      return this.getDefaultSizeFallback(property);
    }

    return 'initial';
  }
}

/**
 * Utility function to create a fallback handler
 */
export function createCustomPropertyFallbackHandler(
  config: Partial<FallbackConfiguration> = {}
): CustomPropertyFallbackHandler {
  return new CustomPropertyFallbackHandler(config);
}

/**
 * Utility function to analyze fallbacks
 */
export function analyzeFallbacks(
  variableMap: VariableMap,
  config: Partial<FallbackConfiguration> = {}
): FallbackAnalysis {
  const handler = createCustomPropertyFallbackHandler(config);
  return handler.analyzeFallbacks(variableMap);
}