/**
 * Specificity Calculator
 *
 * Implements a robust specificity calculator that computes the specificity
 * of each selector and analyzes conflicts between rules.
 */

import { PERFORMANCE_THRESHOLDS, SPECIFICITY_WEIGHTS } from './constants';
import {
  ConflictSeverity,
  CSSRule,
  OrderHandlingOptions,
  SpecificityConflict,
  SpecificityInfo,
  SpecificityLevel,
} from './types';

/**
 * CSS specificity calculation and conflict analysis engine
 */
export class SpecificityCalculator {
  private config: OrderHandlingOptions;
  private specificityCache: Map<string, SpecificityInfo>;
  private conflictCache: Map<string, SpecificityConflict[]>;
  private selectorPatterns: Map<string, RegExp>;

  constructor(config: OrderHandlingOptions) {
    this.config = config;
    this.specificityCache = new Map();
    this.conflictCache = new Map();
    this.selectorPatterns = this.initializeSelectorPatterns();
  }

  /**
   * Calculate specificity for a CSS rule
   */
  public calculateSpecificity(rule: CSSRule): SpecificityInfo {
    // Check cache first
    const cacheKey = this.getCacheKey(rule);
    const cached = this.specificityCache.get(cacheKey);
    if (cached && this.config.enableCaching) {
      return { ...cached, ruleId: rule.id };
    }

    const startTime = Date.now();

    try {
      // Parse and calculate specificity
      const specificity = this.parseSpecificity(rule.selector);
      const weight = this.calculateWeight(specificity, rule);
      const level = this.determineSpecificityLevel(specificity);

      const specificityInfo: SpecificityInfo = {
        ruleId: rule.id,
        specificity,
        weight,
        hasImportant: rule.important || false,
        layerPriority: this.calculateLayerPriority(rule.layer),
        level,
        isInline: this.isInlineStyle(rule),
        components: this.analyzeSpecificityComponents(rule.selector),
        calculationTime: Date.now() - startTime,
      };

      // Cache result
      if (this.config.enableCaching) {
        this.specificityCache.set(cacheKey, specificityInfo);
      }

      return specificityInfo;
    } catch (error) {
      // Return safe fallback for invalid selectors
      return this.createFallbackSpecificity(rule, error as Error);
    }
  }

  /**
   * Analyze conflicts between rules based on specificity
   */
  public analyzeConflicts(rules: CSSRule[]): SpecificityConflict[] {
    const conflicts: SpecificityConflict[] = [];
    const startTime = Date.now();

    // Group rules by their target elements and properties
    const ruleGroups = this.groupRulesByTarget(rules);

    ruleGroups.forEach((targetRules, target) => {
      if (targetRules.length <= 1) return;

      // Find conflicts within this group
      const groupConflicts = this.findConflictsInGroup(targetRules, target);
      conflicts.push(...groupConflicts);
    });

    // Sort conflicts by severity
    conflicts.sort((a, b) => this.compareConflictSeverity(a.severity, b.severity));

    // Performance check
    const calculationTime = Date.now() - startTime;
    if (calculationTime > PERFORMANCE_THRESHOLDS.SPECIFICITY_CALCULATION_MS) {
      console.warn(
        `Specificity conflict analysis took ${calculationTime}ms for ${rules.length} rules`
      );
    }

    return conflicts;
  }

  /**
   * Compare two specificity values
   */
  public compareSpecificity(
    spec1: [number, number, number, number],
    spec2: [number, number, number, number],
    rule1?: CSSRule,
    rule2?: CSSRule
  ): number {
    // Handle !important
    if (rule1?.important && !rule2?.important) return 1;
    if (!rule1?.important && rule2?.important) return -1;

    // Handle layer priority
    if (rule1?.layer !== rule2?.layer) {
      const layer1Priority = this.calculateLayerPriority(rule1?.layer);
      const layer2Priority = this.calculateLayerPriority(rule2?.layer);
      if (layer1Priority !== layer2Priority) {
        return layer1Priority - layer2Priority;
      }
    }

    // Compare specificity components
    for (let i = 0; i < 4; i++) {
      if (spec1[i] !== spec2[i]) {
        return spec1[i] - spec2[i];
      }
    }

    return 0; // Equal specificity
  }

  /**
   * Batch calculate specificity for multiple rules
   */
  public batchCalculateSpecificity(rules: CSSRule[]): Map<string, SpecificityInfo> {
    const results = new Map<string, SpecificityInfo>();
    const startTime = Date.now();

    // Process in batches for better performance
    const batchSize = this.config.batchSize || 100;
    for (let i = 0; i < rules.length; i += batchSize) {
      const batch = rules.slice(i, i + batchSize);

      for (const rule of batch) {
        try {
          const specificity = this.calculateSpecificity(rule);
          results.set(rule.id, specificity);
        } catch (error) {
          console.warn(`Failed to calculate specificity for rule ${rule.id}:`, error);
          results.set(rule.id, this.createFallbackSpecificity(rule, error as Error));
        }
      }
    }

    const calculationTime = Date.now() - startTime;
    if (calculationTime > PERFORMANCE_THRESHOLDS.BATCH_CALCULATION_MS) {
      console.warn(
        `Batch specificity calculation took ${calculationTime}ms for ${rules.length} rules`
      );
    }

    return results;
  }

  /**
   * Parse selector and calculate specificity components
   */
  private parseSpecificity(selector: string): [number, number, number, number] {
    // Clean and normalize selector
    const cleanSelector = this.normalizeSelector(selector);

    // Initialize counters: [inline, ids, classes, elements]
    const specificity: [number, number, number, number] = [0, 0, 0, 0];

    // Handle inline styles (would be passed as special selector)
    if (cleanSelector === ':inline') {
      specificity[0] = 1;
      return specificity;
    }

    // Split selector by combinators while preserving context
    const selectorParts = this.splitSelectorParts(cleanSelector);

    for (const part of selectorParts) {
      const partSpecificity = this.calculatePartSpecificity(part);
      // Add component specificity
      for (let i = 1; i < 4; i++) {
        specificity[i] += partSpecificity[i];
      }
    }

    return specificity;
  }

  /**
   * Calculate specificity for a single selector part
   */
  private calculatePartSpecificity(selectorPart: string): [number, number, number, number] {
    const specificity: [number, number, number, number] = [0, 0, 0, 0];

    // Count IDs
    const idMatches = selectorPart.match(this.selectorPatterns.get('id')!);
    if (idMatches) {
      specificity[1] += idMatches.length;
    }

    // Count classes, attributes, and pseudo-classes
    const classMatches = selectorPart.match(this.selectorPatterns.get('class')!);
    const attrMatches = selectorPart.match(this.selectorPatterns.get('attribute')!);
    const pseudoClassMatches = selectorPart.match(this.selectorPatterns.get('pseudoClass')!);

    if (classMatches) specificity[2] += classMatches.length;
    if (attrMatches) specificity[2] += attrMatches.length;
    if (pseudoClassMatches) {
      // Handle special pseudo-classes
      for (const match of pseudoClassMatches) {
        specificity[2] += this.getPseudoClassSpecificity(match);
      }
    }

    // Count elements and pseudo-elements
    const elementMatches = selectorPart.match(this.selectorPatterns.get('element')!);
    const pseudoElementMatches = selectorPart.match(this.selectorPatterns.get('pseudoElement')!);

    if (elementMatches) {
      // Filter out pseudo-classes and other non-element matches
      const realElements = elementMatches.filter(
        (match) => !match.startsWith(':') && !match.startsWith('[') && !match.startsWith('.')
      );
      specificity[3] += realElements.length;
    }
    if (pseudoElementMatches) specificity[3] += pseudoElementMatches.length;

    return specificity;
  }

  /**
   * Get specificity value for special pseudo-classes
   */
  private getPseudoClassSpecificity(pseudoClass: string): number {
    // Handle :is(), :where(), :not(), etc.
    if (
      pseudoClass.includes(':is(') ||
      pseudoClass.includes(':where(') ||
      pseudoClass.includes(':not(') ||
      pseudoClass.includes(':has(')
    ) {
      // Extract inner selector and calculate its specificity
      const inner = this.extractInnerSelector(pseudoClass);
      if (inner) {
        const innerSpec = this.parseSpecificity(inner);
        // :where() has 0 specificity, others use max specificity of inner selectors
        if (pseudoClass.includes(':where(')) return 0;
        return Math.max(...innerSpec.slice(1)); // Exclude inline style component
      }
    }

    // :nth-child() and similar have class-level specificity
    if (
      pseudoClass.includes(':nth-') ||
      pseudoClass.includes(':lang(') ||
      pseudoClass.includes(':dir(')
    ) {
      return 1;
    }

    return 1; // Default pseudo-class specificity
  }

  /**
   * Calculate weight based on specificity and other factors
   */
  private calculateWeight(specificity: [number, number, number, number], rule: CSSRule): number {
    let weight = 0;

    // Base weight from specificity
    weight += specificity[0] * SPECIFICITY_WEIGHTS.INLINE;
    weight += specificity[1] * SPECIFICITY_WEIGHTS.ID;
    weight += specificity[2] * SPECIFICITY_WEIGHTS.CLASS;
    weight += specificity[3] * SPECIFICITY_WEIGHTS.ELEMENT;

    // !important multiplier
    if (rule.important) {
      weight *= SPECIFICITY_WEIGHTS.IMPORTANT_MULTIPLIER;
    }

    // Layer priority adjustment
    const layerPriority = this.calculateLayerPriority(rule.layer);
    weight += layerPriority * SPECIFICITY_WEIGHTS.LAYER;

    // Origin priority (user agent < user < author)
    if (rule.origin) {
      switch (rule.origin) {
        case 'user-agent':
          weight += SPECIFICITY_WEIGHTS.USER_AGENT;
          break;
        case 'user':
          weight += SPECIFICITY_WEIGHTS.USER;
          break;
        case 'author':
          weight += SPECIFICITY_WEIGHTS.AUTHOR;
          break;
      }
    }

    return weight;
  }

  /**
   * Determine specificity level
   */
  private determineSpecificityLevel(
    specificity: [number, number, number, number]
  ): SpecificityLevel {
    if (specificity[0] > 0) return SpecificityLevel.INLINE;
    if (specificity[1] > 0) return SpecificityLevel.ID;
    if (specificity[2] > 0) return SpecificityLevel.CLASS;
    if (specificity[3] > 0) return SpecificityLevel.ELEMENT;
    return SpecificityLevel.UNIVERSAL;
  }

  /**
   * Analyze specificity components
   */
  private analyzeSpecificityComponents(selector: string): {
    ids: string[];
    classes: string[];
    attributes: string[];
    pseudoClasses: string[];
    elements: string[];
    pseudoElements: string[];
    universal: boolean;
  } {
    const components = {
      ids: this.extractMatches(selector, this.selectorPatterns.get('id')!),
      classes: this.extractMatches(selector, this.selectorPatterns.get('class')!),
      attributes: this.extractMatches(selector, this.selectorPatterns.get('attribute')!),
      pseudoClasses: this.extractMatches(selector, this.selectorPatterns.get('pseudoClass')!),
      elements: this.extractMatches(selector, this.selectorPatterns.get('element')!),
      pseudoElements: this.extractMatches(selector, this.selectorPatterns.get('pseudoElement')!),
      universal: selector.includes('*'),
    };

    return components;
  }

  /**
   * Group rules by their target elements and properties
   */
  private groupRulesByTarget(rules: CSSRule[]): Map<string, CSSRule[]> {
    const groups = new Map<string, CSSRule[]>();

    for (const rule of rules) {
      // Create a key based on selector target and properties
      const key = this.createTargetKey(rule);

      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(rule);
    }

    return groups;
  }

  /**
   * Find conflicts within a group of rules
   */
  private findConflictsInGroup(rules: CSSRule[], target: string): SpecificityConflict[] {
    const conflicts: SpecificityConflict[] = [];

    for (let i = 0; i < rules.length; i++) {
      for (let j = i + 1; j < rules.length; j++) {
        const rule1 = rules[i];
        const rule2 = rules[j];

        const conflict = this.analyzeRuleConflict(rule1, rule2, target);
        if (conflict) {
          conflicts.push(conflict);
        }
      }
    }

    return conflicts;
  }

  /**
   * Analyze conflict between two rules
   */
  private analyzeRuleConflict(
    rule1: CSSRule,
    rule2: CSSRule,
    target: string
  ): SpecificityConflict | null {
    const spec1 = this.calculateSpecificity(rule1);
    const spec2 = this.calculateSpecificity(rule2);

    const comparison = this.compareSpecificity(spec1.specificity, spec2.specificity, rule1, rule2);

    // Only report conflicts where there's overlap
    const commonProperties = this.findCommonProperties(rule1, rule2);
    if (commonProperties.length === 0) {
      return null;
    }

    let severity: ConflictSeverity;
    let reason: string;

    if (comparison === 0) {
      // Equal specificity - order matters
      severity = ConflictSeverity.HIGH;
      reason = 'Equal specificity - cascade order determines winner';
    } else if (Math.abs(comparison) === 1) {
      // Close specificity
      severity = ConflictSeverity.MEDIUM;
      reason = 'Close specificity values may cause confusion';
    } else {
      // Clear specificity difference
      severity = ConflictSeverity.LOW;
      reason = 'Clear specificity hierarchy';
    }

    return {
      rule1Id: rule1.id,
      rule2Id: rule2.id,
      target,
      rule1Specificity: spec1,
      rule2Specificity: spec2,
      severity,
      reason,
      conflictingProperties: commonProperties,
      recommendation: this.generateConflictRecommendation(rule1, rule2, comparison),
    };
  }

  /**
   * Initialize selector pattern regexes
   */
  private initializeSelectorPatterns(): Map<string, RegExp> {
    return new Map([
      ['id', /#[a-zA-Z][\w-]*/g],
      ['class', /\.[a-zA-Z][\w-]*/g],
      ['attribute', /\[[^\]]*\]/g],
      ['pseudoClass', /:(?!:)[a-zA-Z-]+(?:\([^)]*\))?/g],
      ['pseudoElement', /::[a-zA-Z-]+/g],
      ['element', /(?:^|[>\s+~])\s*([a-zA-Z][\w-]*)/g],
      ['combinator', /[>\s+~]/g],
    ]);
  }

  /**
   * Utility methods
   */
  private getCacheKey(rule: CSSRule): string {
    return `${rule.selector}:${rule.important}:${rule.layer}:${rule.origin}`;
  }

  private normalizeSelector(selector: string): string {
    return selector.trim().replace(/\s+/g, ' ');
  }

  private splitSelectorParts(selector: string): string[] {
    // Split by comma first (for selector groups)
    const selectorGroups = selector.split(',').map((s) => s.trim());

    // For each group, split by combinators
    const parts: string[] = [];
    for (const group of selectorGroups) {
      const groupParts = group
        .split(/[>\s+~]/)
        .map((s) => s.trim())
        .filter(Boolean);
      parts.push(...groupParts);
    }

    return parts;
  }

  private calculateLayerPriority(layer?: string): number {
    if (!layer) return 0;
    // Implement layer priority logic
    // Lower layer names typically have higher priority
    return layer.split('.').length * 100;
  }

  private isInlineStyle(rule: CSSRule): boolean {
    return rule.selector === ':inline' || rule.type === 'inline';
  }

  private extractInnerSelector(pseudoClass: string): string | null {
    const match = pseudoClass.match(/\(([^)]+)\)/);
    return match ? match[1] : null;
  }

  private extractMatches(text: string, pattern: RegExp): string[] {
    const matches = text.match(pattern);
    return matches || [];
  }

  private createTargetKey(rule: CSSRule): string {
    // Simplified target key - in reality this would be more sophisticated
    const normalizedSelector = this.normalizeSelector(rule.selector);
    const properties = Object.keys(rule.declarations || {})
      .sort()
      .join(',');
    return `${normalizedSelector}:${properties}`;
  }

  private findCommonProperties(rule1: CSSRule, rule2: CSSRule): string[] {
    const props1 = new Set(Object.keys(rule1.declarations || {}));
    const props2 = new Set(Object.keys(rule2.declarations || {}));

    return Array.from(props1).filter((prop) => props2.has(prop));
  }

  private compareConflictSeverity(
    severity1: ConflictSeverity,
    severity2: ConflictSeverity
  ): number {
    const severityOrder = [ConflictSeverity.LOW, ConflictSeverity.MEDIUM, ConflictSeverity.HIGH];
    return severityOrder.indexOf(severity2) - severityOrder.indexOf(severity1);
  }

  private generateConflictRecommendation(
    rule1: CSSRule,
    rule2: CSSRule,
    comparison: number
  ): string {
    if (comparison === 0) {
      return 'Consider increasing specificity of the intended winner or reordering rules';
    } else if (comparison > 0) {
      return 'Rule 1 has higher specificity and will override Rule 2';
    } else {
      return 'Rule 2 has higher specificity and will override Rule 1';
    }
  }

  private createFallbackSpecificity(rule: CSSRule, error: Error): SpecificityInfo {
    console.warn(`Failed to calculate specificity for rule ${rule.id}: ${error.message}`);

    return {
      ruleId: rule.id,
      specificity: [0, 0, 0, 1], // Default to element level
      weight: 1,
      hasImportant: rule.important || false,
      layerPriority: 0,
      level: SpecificityLevel.ELEMENT,
      isInline: false,
      components: {
        ids: [],
        classes: [],
        attributes: [],
        pseudoClasses: [],
        elements: [],
        pseudoElements: [],
        universal: false,
      },
      calculationTime: 0,
      error: error.message,
    };
  }

  /**
   * Clear caches and reset state
   */
  public clearCache(): void {
    this.specificityCache.clear();
    this.conflictCache.clear();
  }

  /**
   * Get cache statistics
   */
  public getCacheStats(): {
    specificityCached: number;
    conflictsCached: number;
  } {
    return {
      specificityCached: this.specificityCache.size,
      conflictsCached: this.conflictCache.size,
    };
  }
}
