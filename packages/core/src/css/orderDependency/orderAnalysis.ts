/**
 * Order Preservation Analysis
 *
 * Analyzes CSS rules to identify critical order dependencies that affect
 * the cascade and ensures that reordering does not break intended styling.
 */

import {
  AT_RULE_PRIORITIES,
  DEFAULT_ORDER_CONFIG,
  ORDER_SENSITIVE_PROPERTIES,
  PERFORMANCE_THRESHOLDS,
  PSEUDO_CLASS_PRIORITIES,
} from './constants';
import {
  ConstraintType,
  CSSRule,
  OrderConstraint,
  OrderHandlingOptions,
  RuleOrder,
  RuleType,
} from './types';

/**
 * Analyzes CSS rule order and identifies critical dependencies
 */
export class OrderPreservationAnalyzer {
  private config: OrderHandlingOptions;
  private ruleCache: Map<string, CSSRule>;
  private orderCache: Map<string, RuleOrder>;
  private constraintCache: Map<string, OrderConstraint[]>;

  constructor(config: Partial<OrderHandlingOptions> = {}) {
    this.config = { ...DEFAULT_ORDER_CONFIG, ...config };
    this.ruleCache = new Map();
    this.orderCache = new Map();
    this.constraintCache = new Map();
  }

  /**
   * Analyze a set of CSS rules to determine order preservation requirements
   */
  public async analyzeRules(rules: CSSRule[]): Promise<{
    ruleOrders: RuleOrder[];
    constraints: OrderConstraint[];
    criticalRules: string[];
    reorderableRules: string[];
    analysisMetrics: {
      processingTime: number;
      rulesAnalyzed: number;
      constraintsFound: number;
      cacheHitRate: number;
    };
  }> {
    const startTime = Date.now();
    let cacheHits = 0;
    let cacheMisses = 0;

    // Validate input
    this.validateRules(rules);

    // Index rules for efficient lookup
    const ruleMap = this.indexRules(rules);

    // Analyze each rule's order requirements
    const ruleOrders: RuleOrder[] = [];
    const allConstraints: OrderConstraint[] = [];

    for (let i = 0; i < rules.length; i++) {
      const rule = rules[i];
      const cacheKey = this.getCacheKey(rule);

      // Check cache first
      let ruleOrder = this.orderCache.get(cacheKey);
      let constraints = this.constraintCache.get(cacheKey);

      if (ruleOrder && constraints) {
        cacheHits++;
      } else {
        cacheMisses++;

        // Analyze rule order requirements
        ruleOrder = await this.analyzeRuleOrder(rule, i, ruleMap);
        constraints = await this.analyzeRuleConstraints(rule, i, rules, ruleMap);

        // Cache results if caching is enabled
        if (this.config.enableCaching) {
          this.orderCache.set(cacheKey, ruleOrder);
          this.constraintCache.set(cacheKey, constraints);
        }
      }

      ruleOrders.push(ruleOrder);
      allConstraints.push(...constraints);
    }

    // Identify critical vs reorderable rules
    const criticalRules = ruleOrders
      .filter((order) => order.orderCritical)
      .map((order) => order.ruleId);

    const reorderableRules = ruleOrders
      .filter((order) => !order.orderCritical)
      .map((order) => order.ruleId);

    const processingTime = Date.now() - startTime;
    const cacheHitRate = cacheHits / (cacheHits + cacheMisses);

    return {
      ruleOrders,
      constraints: allConstraints,
      criticalRules,
      reorderableRules,
      analysisMetrics: {
        processingTime,
        rulesAnalyzed: rules.length,
        constraintsFound: allConstraints.length,
        cacheHitRate,
      },
    };
  }

  /**
   * Analyze order requirements for a single rule
   */
  private async analyzeRuleOrder(
    rule: CSSRule,
    index: number,
    ruleMap: Map<string, CSSRule>
  ): Promise<RuleOrder> {
    const orderCritical = this.isOrderCritical(rule);
    const mustComeBefore: string[] = [];
    const mustComeAfter: string[] = [];

    // Analyze dependencies based on rule type
    switch (rule.type) {
      case RuleType.IMPORT:
        // @import must come before most other rules
        mustComeBefore.push(
          ...Array.from(ruleMap.keys()).filter((id) => {
            const otherRule = ruleMap.get(id);
            return (
              otherRule && otherRule.type !== RuleType.IMPORT && otherRule.type !== RuleType.LAYER
            );
          })
        );
        break;

      case RuleType.LAYER:
        // @layer must come before regular styles
        mustComeBefore.push(
          ...Array.from(ruleMap.keys()).filter((id) => {
            const otherRule = ruleMap.get(id);
            return otherRule && otherRule.type === RuleType.STYLE;
          })
        );
        break;

      case RuleType.MEDIA:
        // Media queries often depend on base styles
        mustComeAfter.push(...this.findBaseStyleDependencies(rule, ruleMap));
        break;

      case RuleType.STYLE:
        // Analyze pseudo-class ordering
        if (this.hasPseudoClasses(rule.selector)) {
          const pseudoDependencies = this.analyzePseudoClassOrder(rule, ruleMap);
          mustComeAfter.push(...pseudoDependencies);
        }
        break;
    }

    return {
      ruleId: rule.id,
      originalIndex: index,
      currentIndex: index,
      orderCritical,
      mustComeBefore,
      mustComeAfter,
      groupId: this.determineGroupId(rule),
    };
  }

  /**
   * Analyze constraints for a rule
   */
  private async analyzeRuleConstraints(
    rule: CSSRule,
    index: number,
    allRules: CSSRule[],
    _ruleMap: Map<string, CSSRule>
  ): Promise<OrderConstraint[]> {
    const constraints: OrderConstraint[] = [];

    // At-rule ordering constraints
    if (rule.type !== RuleType.STYLE) {
      const atRuleConstraint = this.createAtRuleConstraint(rule, allRules);
      if (atRuleConstraint) {
        constraints.push(atRuleConstraint);
      }
    }

    // Pseudo-class ordering constraints
    if (this.hasPseudoClasses(rule.selector)) {
      const pseudoConstraints = this.createPseudoClassConstraints(rule, allRules);
      constraints.push(...pseudoConstraints);
    }

    // Media query constraints
    if (rule.type === RuleType.MEDIA) {
      const mediaConstraints = this.createMediaQueryConstraints(rule, allRules);
      constraints.push(...mediaConstraints);
    }

    // Property-specific constraints
    const propertyConstraints = this.createPropertyConstraints(rule, allRules);
    constraints.push(...propertyConstraints);

    // User-defined preserve order constraints
    const preserveConstraints = this.createPreserveOrderConstraints(rule);
    constraints.push(...preserveConstraints);

    return constraints;
  }

  /**
   * Determine if a rule's order is critical
   */
  private isOrderCritical(rule: CSSRule): boolean {
    // At-rules generally have critical ordering
    if (rule.type !== RuleType.STYLE) {
      return true;
    }

    // Rules with !important are less order-sensitive
    if (rule.important) {
      return false;
    }

    // Check for order-sensitive properties
    const hasOrderSensitiveProps = rule.declarations.some((decl) =>
      ORDER_SENSITIVE_PROPERTIES.includes(decl.property as any)
    );

    if (hasOrderSensitiveProps) {
      return true;
    }

    // Check for pseudo-classes
    if (this.hasPseudoClasses(rule.selector)) {
      return true;
    }

    // Check for user-defined preserve patterns
    const shouldPreserve = this.config.preserveOrderSelectors.some((pattern) =>
      this.matchesPattern(rule.selector, pattern)
    );

    return shouldPreserve;
  }

  /**
   * Index rules for efficient lookup
   */
  private indexRules(rules: CSSRule[]): Map<string, CSSRule> {
    const ruleMap = new Map<string, CSSRule>();

    for (const rule of rules) {
      ruleMap.set(rule.id, rule);
      this.ruleCache.set(rule.id, rule);
    }

    return ruleMap;
  }

  /**
   * Find base style dependencies for media queries
   */
  private findBaseStyleDependencies(rule: CSSRule, ruleMap: Map<string, CSSRule>): string[] {
    const dependencies: string[] = [];

    // Extract selectors from media query content
    const mediaSelectors = this.extractSelectorsFromRule(rule);

    // Find base styles that match these selectors
    for (const [id, otherRule] of ruleMap) {
      if (otherRule.type === RuleType.STYLE && !otherRule.mediaQuery) {
        const baseSelectors = this.extractSelectorsFromRule(otherRule);

        // Check for selector overlap
        if (this.hasSelectorsOverlap(mediaSelectors, baseSelectors)) {
          dependencies.push(id);
        }
      }
    }

    return dependencies;
  }

  /**
   * Analyze pseudo-class ordering requirements
   */
  private analyzePseudoClassOrder(rule: CSSRule, ruleMap: Map<string, CSSRule>): string[] {
    const dependencies: string[] = [];
    const rulePseudos = this.extractPseudoClasses(rule.selector);

    for (const [id, otherRule] of ruleMap) {
      if (otherRule.type === RuleType.STYLE) {
        const otherPseudos = this.extractPseudoClasses(otherRule.selector);

        // Check if rules target the same element with different pseudo-classes
        if (this.hasSameBaseSelector(rule.selector, otherRule.selector)) {
          for (const rulePseudo of rulePseudos) {
            for (const otherPseudo of otherPseudos) {
              const rulePriority = (PSEUDO_CLASS_PRIORITIES as any)[rulePseudo] || 0;
              const otherPriority = (PSEUDO_CLASS_PRIORITIES as any)[otherPseudo] || 0;

              // Rule should come after lower priority pseudo-classes
              if (rulePriority > otherPriority) {
                dependencies.push(id);
              }
            }
          }
        }
      }
    }

    return dependencies;
  }

  /**
   * Create at-rule ordering constraint
   */
  private createAtRuleConstraint(rule: CSSRule, allRules: CSSRule[]): OrderConstraint | null {
    const priority = AT_RULE_PRIORITIES[`@${rule.type}` as keyof typeof AT_RULE_PRIORITIES];
    if (!priority) return null;

    const beforeRules: string[] = [];
    const afterRules: string[] = [];

    for (const otherRule of allRules) {
      if (otherRule.id === rule.id) continue;

      const otherPriority =
        AT_RULE_PRIORITIES[`@${otherRule.type}` as keyof typeof AT_RULE_PRIORITIES];

      if (otherPriority && otherPriority > priority) {
        beforeRules.push(otherRule.id);
      } else if (otherPriority && otherPriority < priority) {
        afterRules.push(otherRule.id);
      }
    }

    return {
      id: `at-rule-${rule.type}-${rule.id}`,
      type: ConstraintType.STRICT_ORDER,
      ruleIds: [rule.id, ...beforeRules, ...afterRules],
      description: `@${rule.type} must maintain proper at-rule ordering`,
      flexible: false,
      priority: 10,
    };
  }

  /**
   * Create pseudo-class ordering constraints
   */
  private createPseudoClassConstraints(rule: CSSRule, allRules: CSSRule[]): OrderConstraint[] {
    const constraints: OrderConstraint[] = [];
    const relatedRules = this.findPseudoClassRelatedRules(rule, allRules);

    if (relatedRules.length > 1) {
      constraints.push({
        id: `pseudo-order-${rule.id}`,
        type: ConstraintType.STRICT_ORDER,
        ruleIds: relatedRules,
        description: 'Pseudo-class rules must maintain LVHA order',
        flexible: false,
        priority: 8,
      });
    }

    return constraints;
  }

  /**
   * Create media query constraints
   */
  private createMediaQueryConstraints(rule: CSSRule, allRules: CSSRule[]): OrderConstraint[] {
    const constraints: OrderConstraint[] = [];
    const baseDependencies = this.findBaseStyleDependencies(
      rule,
      new Map(allRules.map((r) => [r.id, r]))
    );

    if (baseDependencies.length > 0) {
      constraints.push({
        id: `media-${rule.id}`,
        type: ConstraintType.AFTER,
        ruleIds: [rule.id, ...baseDependencies],
        description: 'Media query must come after base styles',
        flexible: true,
        priority: 6,
      });
    }

    return constraints;
  }

  /**
   * Create property-specific constraints
   */
  private createPropertyConstraints(rule: CSSRule, allRules: CSSRule[]): OrderConstraint[] {
    const constraints: OrderConstraint[] = [];

    // Check for z-index dependencies
    const hasZIndex = rule.declarations.some((decl) => decl.property === 'z-index');
    if (hasZIndex) {
      const positionDependencies = this.findPositionDependencies(rule, allRules);
      if (positionDependencies.length > 0) {
        constraints.push({
          id: `z-index-${rule.id}`,
          type: ConstraintType.AFTER,
          ruleIds: [rule.id, ...positionDependencies],
          description: 'z-index rules should come after position rules',
          flexible: true,
          priority: 7,
        });
      }
    }

    return constraints;
  }

  /**
   * Create user-defined preserve order constraints
   */
  private createPreserveOrderConstraints(rule: CSSRule): OrderConstraint[] {
    const constraints: OrderConstraint[] = [];

    const shouldPreserve = this.config.preserveOrderSelectors.some((pattern) =>
      this.matchesPattern(rule.selector, pattern)
    );

    if (shouldPreserve) {
      constraints.push({
        id: `preserve-${rule.id}`,
        type: ConstraintType.NO_REORDER,
        ruleIds: [rule.id],
        description: 'Rule marked for order preservation',
        flexible: false,
        priority: 9,
      });
    }

    return constraints;
  }

  // Helper methods

  private validateRules(rules: CSSRule[]): void {
    if (!Array.isArray(rules)) {
      throw new Error('Rules must be an array');
    }

    if (rules.length > PERFORMANCE_THRESHOLDS.MAX_RULES_LIMIT) {
      throw new Error(
        `Too many rules: ${rules.length}. Maximum: ${PERFORMANCE_THRESHOLDS.MAX_RULES_LIMIT}`
      );
    }

    for (const rule of rules) {
      if (!rule.id || !rule.selector) {
        throw new Error('Invalid rule: missing id or selector');
      }
    }
  }

  private getCacheKey(rule: CSSRule): string {
    return `${rule.id}:${rule.selector}:${rule.type}:${rule.lineNumber}`;
  }

  private determineGroupId(rule: CSSRule): string | undefined {
    if (rule.mediaQuery) {
      return `media:${rule.mediaQuery}`;
    }
    if (rule.layer) {
      return `layer:${rule.layer}`;
    }
    if (rule.type !== RuleType.STYLE) {
      return `at-rule:${rule.type}`;
    }
    return undefined;
  }

  private hasPseudoClasses(selector: string): boolean {
    return /:[a-zA-Z-]+(?:\([^)]*\))?/.test(selector);
  }

  private extractSelectorsFromRule(rule: CSSRule): string[] {
    return rule.selector.split(',').map((s) => s.trim());
  }

  private hasSelectorsOverlap(selectors1: string[], selectors2: string[]): boolean {
    for (const sel1 of selectors1) {
      for (const sel2 of selectors2) {
        if (this.selectorsMatch(sel1, sel2)) {
          return true;
        }
      }
    }
    return false;
  }

  private selectorsMatch(sel1: string, sel2: string): boolean {
    // Simplified selector matching - would need more sophisticated logic
    const base1 = sel1.replace(/:[a-zA-Z-]+(?:\([^)]*\))?/g, '').trim();
    const base2 = sel2.replace(/:[a-zA-Z-]+(?:\([^)]*\))?/g, '').trim();
    return base1 === base2;
  }

  private extractPseudoClasses(selector: string): string[] {
    const matches = selector.match(/:[a-zA-Z-]+(?:\([^)]*\))?/g);
    return matches || [];
  }

  private hasSameBaseSelector(sel1: string, sel2: string): boolean {
    return this.selectorsMatch(sel1, sel2);
  }

  private findPseudoClassRelatedRules(rule: CSSRule, allRules: CSSRule[]): string[] {
    const relatedRules: string[] = [];
    const baseSelector = rule.selector.replace(/:[a-zA-Z-]+(?:\([^)]*\))?/g, '').trim();

    for (const otherRule of allRules) {
      if (otherRule.type === RuleType.STYLE) {
        const otherBaseSelector = otherRule.selector
          .replace(/:[a-zA-Z-]+(?:\([^)]*\))?/g, '')
          .trim();
        if (baseSelector === otherBaseSelector && this.hasPseudoClasses(otherRule.selector)) {
          relatedRules.push(otherRule.id);
        }
      }
    }

    // Sort by pseudo-class priority
    return relatedRules.sort((a, b) => {
      const ruleA = allRules.find((r) => r.id === a);
      const ruleB = allRules.find((r) => r.id === b);

      if (!ruleA || !ruleB) return 0;

      const pseudosA = this.extractPseudoClasses(ruleA.selector);
      const pseudosB = this.extractPseudoClasses(ruleB.selector);

      const priorityA = Math.max(...pseudosA.map((p) => (PSEUDO_CLASS_PRIORITIES as any)[p] || 0));
      const priorityB = Math.max(...pseudosB.map((p) => (PSEUDO_CLASS_PRIORITIES as any)[p] || 0));

      return priorityA - priorityB;
    });
  }

  private findPositionDependencies(rule: CSSRule, allRules: CSSRule[]): string[] {
    const dependencies: string[] = [];
    const ruleSelectors = this.extractSelectorsFromRule(rule);

    for (const otherRule of allRules) {
      if (otherRule.id === rule.id) continue;

      const hasPosition = otherRule.declarations.some(
        (decl) => decl.property === 'position' && decl.value !== 'static'
      );

      if (hasPosition) {
        const otherSelectors = this.extractSelectorsFromRule(otherRule);
        if (this.hasSelectorsOverlap(ruleSelectors, otherSelectors)) {
          dependencies.push(otherRule.id);
        }
      }
    }

    return dependencies;
  }

  private matchesPattern(selector: string, pattern: string): boolean {
    // Convert pattern to regex
    const regexPattern = pattern.replace(/\*/g, '.*').replace(/\?/g, '.');

    const regex = new RegExp(`^${regexPattern}$`, 'i');
    return regex.test(selector);
  }

  /**
   * Clear all caches
   */
  public clearCache(): void {
    this.ruleCache.clear();
    this.orderCache.clear();
    this.constraintCache.clear();
  }

  /**
   * Get cache statistics
   */
  public getCacheStats(): {
    rulesCached: number;
    ordersCached: number;
    constraintsCached: number;
  } {
    return {
      rulesCached: this.ruleCache.size,
      ordersCached: this.orderCache.size,
      constraintsCached: this.constraintCache.size,
    };
  }
}
