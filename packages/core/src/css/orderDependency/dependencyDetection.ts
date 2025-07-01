/**
 * Dependency Detection Engine
 *
 * Develops an engine to detect dependencies between CSS rules based on
 * selector overlap, specificity, and property conflicts.
 */

import { PERFORMANCE_THRESHOLDS, PSEUDO_CLASS_PRIORITIES, RESET_PROPERTIES } from './constants';
import {
  ConflictSeverity,
  CSSRule,
  DependencyGraph,
  DependencyType,
  OrderHandlingOptions,
  RuleDependency,
  RuleType,
} from './types';

/**
 * CSS rule dependency detection and analysis engine
 */
export class DependencyDetectionEngine {
  private config: OrderHandlingOptions;
  private dependencyCache: Map<string, RuleDependency[]>;
  private selectorCache: Map<string, ParsedSelector>;

  constructor(config: OrderHandlingOptions) {
    this.config = config;
    this.dependencyCache = new Map();
    this.selectorCache = new Map();
  }

  /**
   * Detect dependencies between CSS rules
   */
  public async detectDependencies(rules: CSSRule[]): Promise<DependencyGraph> {
    const startTime = Date.now();

    this.validateRules(rules);

    const ruleMap = new Map(rules.map((r) => [r.id, r]));
    const dependencies: RuleDependency[] = [];

    // Detect all types of dependencies
    for (let i = 0; i < rules.length; i++) {
      for (let j = i + 1; j < rules.length; j++) {
        const rule1 = rules[i];
        const rule2 = rules[j];

        const ruleDependencies = await this.analyzeRulePair(rule1, rule2);
        dependencies.push(...ruleDependencies);
      }
    }

    // Build dependency graph
    const graph = this.buildDependencyGraph(ruleMap, dependencies);

    // Detect circular dependencies
    const circularDependencies = this.detectCircularDependencies(graph);

    // Perform topological sort
    const sortedOrder = this.topologicalSort(graph);

    // Identify reorderable rules
    const reorderableRules = this.identifyReorderableRules(graph, dependencies);

    return {
      rules: ruleMap,
      dependencies,
      sortedOrder,
      circularDependencies,
      reorderableRules,
    };
  }

  /**
   * Analyze dependency between two rules
   */
  private async analyzeRulePair(rule1: CSSRule, rule2: CSSRule): Promise<RuleDependency[]> {
    const dependencies: RuleDependency[] = [];

    // Check cache first
    const cacheKey = `${rule1.id}:${rule2.id}`;
    const cached = this.dependencyCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    // Skip analysis if rules don't potentially interact
    if (!this.rulesCanInteract(rule1, rule2)) {
      return dependencies;
    }

    // Detect different types of dependencies
    const overrideDeps = this.detectOverrideDependency(rule1, rule2);
    const cascadeDeps = this.detectCascadeDependency(rule1, rule2);
    const resetDeps = this.detectResetDependency(rule1, rule2);
    const fallbackDeps = this.detectFallbackDependency(rule1, rule2);
    const orderDeps = this.detectOrderDependency(rule1, rule2);
    const inheritanceDeps = this.detectInheritanceDependency(rule1, rule2);

    dependencies.push(
      ...overrideDeps,
      ...cascadeDeps,
      ...resetDeps,
      ...fallbackDeps,
      ...orderDeps,
      ...inheritanceDeps
    );

    // Cache results
    if (this.config.enableCaching) {
      this.dependencyCache.set(cacheKey, dependencies);
    }

    return dependencies;
  }

  /**
   * Check if two rules can potentially interact
   */
  private rulesCanInteract(rule1: CSSRule, rule2: CSSRule): boolean {
    // Different media queries might not interact
    if (rule1.mediaQuery !== rule2.mediaQuery) {
      // Check if media queries overlap
      if (!this.mediaQueriesOverlap(rule1.mediaQuery, rule2.mediaQuery)) {
        return false;
      }
    }

    // Different layers have different priorities
    if (rule1.layer !== rule2.layer) {
      return true; // Different layers can still interact
    }

    // Check selector overlap
    return this.selectorsOverlap(rule1.selector, rule2.selector);
  }

  /**
   * Detect override dependencies (specificity-based)
   */
  private detectOverrideDependency(rule1: CSSRule, rule2: CSSRule): RuleDependency[] {
    const dependencies: RuleDependency[] = [];

    if (!this.selectorsOverlap(rule1.selector, rule2.selector)) {
      return dependencies;
    }

    const spec1 = this.calculateSpecificity(rule1.selector);
    const spec2 = this.calculateSpecificity(rule2.selector);
    const commonProperties = this.getCommonProperties(rule1, rule2);

    if (commonProperties.length > 0) {
      if (this.compareSpecificity(spec2, spec1) > 0) {
        // rule2 overrides rule1
        dependencies.push({
          from: rule1.id,
          to: rule2.id,
          type: DependencyType.OVERRIDE,
          reason: `Higher specificity rule overrides lower specificity rule`,
          severity: ConflictSeverity.MEDIUM,
          properties: commonProperties,
        });
      } else if (this.compareSpecificity(spec1, spec2) === 0) {
        // Same specificity - order matters
        dependencies.push({
          from: rule1.id,
          to: rule2.id,
          type: DependencyType.CASCADE,
          reason: `Same specificity - later rule cascades over earlier rule`,
          severity: ConflictSeverity.HIGH,
          properties: commonProperties,
        });
      }
    }

    return dependencies;
  }

  /**
   * Detect cascade dependencies (source order based)
   */
  private detectCascadeDependency(rule1: CSSRule, rule2: CSSRule): RuleDependency[] {
    const dependencies: RuleDependency[] = [];

    if (!this.selectorsOverlap(rule1.selector, rule2.selector)) {
      return dependencies;
    }

    const commonProperties = this.getCommonProperties(rule1, rule2);
    if (commonProperties.length === 0) {
      return dependencies;
    }

    const spec1 = this.calculateSpecificity(rule1.selector);
    const spec2 = this.calculateSpecificity(rule2.selector);

    // If specificity is equal, source order determines cascade
    if (this.compareSpecificity(spec1, spec2) === 0) {
      dependencies.push({
        from: rule1.id,
        to: rule2.id,
        type: DependencyType.CASCADE,
        reason: 'Source order determines cascade for equal specificity',
        severity: ConflictSeverity.HIGH,
        properties: commonProperties,
      });
    }

    return dependencies;
  }

  /**
   * Detect reset dependencies (shorthand properties)
   */
  private detectResetDependency(rule1: CSSRule, rule2: CSSRule): RuleDependency[] {
    const dependencies: RuleDependency[] = [];

    if (!this.selectorsOverlap(rule1.selector, rule2.selector)) {
      return dependencies;
    }

    // Normalize declarations to array format
    const decls2 = Array.isArray(rule2.declarations)
      ? rule2.declarations
      : Object.entries(rule2.declarations).map(([property, value]) => ({
          property,
          value,
          important: false,
        }));

    const decls1 = Array.isArray(rule1.declarations)
      ? rule1.declarations
      : Object.entries(rule1.declarations).map(([property, value]) => ({
          property,
          value,
          important: false,
        }));

    // Check if rule2 resets properties set by rule1
    for (const decl2 of decls2) {
      const resetProps = RESET_PROPERTIES[decl2.property as keyof typeof RESET_PROPERTIES];
      if (resetProps) {
        const rule1Props = decls1.map((d) => d.property);
        const resetConflicts = resetProps.filter(
          (prop) => prop === '*' || rule1Props.includes(prop)
        );

        if (resetConflicts.length > 0) {
          dependencies.push({
            from: rule1.id,
            to: rule2.id,
            type: DependencyType.RESET,
            reason: `Shorthand property '${decl2.property}' resets longhand properties`,
            severity: ConflictSeverity.HIGH,
            properties: resetConflicts,
          });
        }
      }
    }

    return dependencies;
  }

  /**
   * Detect fallback dependencies
   */
  private detectFallbackDependency(rule1: CSSRule, rule2: CSSRule): RuleDependency[] {
    const dependencies: RuleDependency[] = [];

    if (!this.selectorsOverlap(rule1.selector, rule2.selector)) {
      return dependencies;
    }

    // Normalize declarations to array format
    const decls1 = Array.isArray(rule1.declarations)
      ? rule1.declarations
      : Object.entries(rule1.declarations).map(([property, value]) => ({
          property,
          value,
          important: false,
        }));

    const decls2 = Array.isArray(rule2.declarations)
      ? rule2.declarations
      : Object.entries(rule2.declarations).map(([property, value]) => ({
          property,
          value,
          important: false,
        }));

    // Look for fallback patterns (e.g., vendor prefixes, feature queries)
    for (const decl1 of decls1) {
      for (const decl2 of decls2) {
        if (this.isFallbackPair(decl1.property, decl2.property)) {
          dependencies.push({
            from: rule1.id,
            to: rule2.id,
            type: DependencyType.FALLBACK,
            reason: `Fallback property '${decl1.property}' for '${decl2.property}'`,
            severity: ConflictSeverity.LOW,
            properties: [decl1.property, decl2.property],
          });
        }
      }
    }

    return dependencies;
  }

  /**
   * Detect order-sensitive dependencies
   */
  private detectOrderDependency(rule1: CSSRule, rule2: CSSRule): RuleDependency[] {
    const dependencies: RuleDependency[] = [];

    // Pseudo-class ordering dependencies
    if (this.isPseudoClassOrderSensitive(rule1, rule2)) {
      const priority1 = this.getPseudoClassPriority(rule1.selector);
      const priority2 = this.getPseudoClassPriority(rule2.selector);

      if (priority1 !== priority2) {
        dependencies.push({
          from: priority1 < priority2 ? rule1.id : rule2.id,
          to: priority1 < priority2 ? rule2.id : rule1.id,
          type: DependencyType.ORDER_DEPENDENT,
          reason: 'Pseudo-class order affects user interaction',
          severity: ConflictSeverity.HIGH,
          properties: this.getCommonProperties(rule1, rule2),
        });
      }
    }

    // Media query dependencies
    if (this.isMediaQueryOrderSensitive(rule1, rule2)) {
      dependencies.push({
        from: rule1.id,
        to: rule2.id,
        type: DependencyType.ORDER_DEPENDENT,
        reason: 'Media query order affects responsive behavior',
        severity: ConflictSeverity.MEDIUM,
        properties: this.getCommonProperties(rule1, rule2),
      });
    }

    return dependencies;
  }

  /**
   * Detect inheritance dependencies
   */
  private detectInheritanceDependency(rule1: CSSRule, rule2: CSSRule): RuleDependency[] {
    const dependencies: RuleDependency[] = [];

    // Check if rule2 selector is a descendant of rule1 selector
    if (this.isDescendantSelector(rule2.selector, rule1.selector)) {
      const inheritableProperties = this.getInheritableProperties(rule1, rule2);

      if (inheritableProperties.length > 0) {
        dependencies.push({
          from: rule1.id,
          to: rule2.id,
          type: DependencyType.INHERITANCE,
          reason: 'Child selector inherits from parent selector',
          severity: ConflictSeverity.LOW,
          properties: inheritableProperties,
        });
      }
    }

    return dependencies;
  }

  /**
   * Build dependency graph from rules and dependencies
   */
  private buildDependencyGraph(
    ruleMap: Map<string, CSSRule>,
    dependencies: RuleDependency[]
  ): Map<string, string[]> {
    const graph = new Map<string, string[]>();

    // Initialize graph with all rules
    ruleMap.forEach((_, ruleId) => {
      graph.set(ruleId, []);
    });

    // Add dependencies to graph
    for (const dep of dependencies) {
      const dependents = graph.get(dep.from) || [];
      dependents.push(dep.to);
      graph.set(dep.from, dependents);
    }

    return graph;
  }

  /**
   * Detect circular dependencies in the graph
   */
  private detectCircularDependencies(graph: Map<string, string[]>): string[][] {
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    const cycles: string[][] = [];

    const dfs = (node: string, path: string[]): void => {
      if (recursionStack.has(node)) {
        // Found a cycle
        const cycleStart = path.indexOf(node);
        cycles.push(path.slice(cycleStart).concat(node));
        return;
      }

      if (visited.has(node)) {
        return;
      }

      visited.add(node);
      recursionStack.add(node);
      path.push(node);

      const neighbors = graph.get(node) || [];
      for (const neighbor of neighbors) {
        dfs(neighbor, [...path]);
      }

      recursionStack.delete(node);
    };

    for (const node of graph.keys()) {
      if (!visited.has(node)) {
        dfs(node, []);
      }
    }

    return cycles;
  }

  /**
   * Perform topological sort on the dependency graph
   */
  private topologicalSort(graph: Map<string, string[]>): string[] {
    const inDegree = new Map<string, number>();
    const queue: string[] = [];
    const result: string[] = [];

    // Calculate in-degrees
    for (const node of graph.keys()) {
      inDegree.set(node, 0);
    }

    for (const [_node, neighbors] of graph) {
      for (const neighbor of neighbors) {
        inDegree.set(neighbor, (inDegree.get(neighbor) || 0) + 1);
      }
    }

    // Find nodes with no incoming edges
    for (const [node, degree] of inDegree) {
      if (degree === 0) {
        queue.push(node);
      }
    }

    // Process queue
    while (queue.length > 0) {
      const node = queue.shift()!;
      result.push(node);

      const neighbors = graph.get(node) || [];
      for (const neighbor of neighbors) {
        const newDegree = (inDegree.get(neighbor) || 0) - 1;
        inDegree.set(neighbor, newDegree);

        if (newDegree === 0) {
          queue.push(neighbor);
        }
      }
    }

    return result;
  }

  /**
   * Identify rules that can be safely reordered
   */
  private identifyReorderableRules(
    graph: Map<string, string[]>,
    dependencies: RuleDependency[]
  ): string[] {
    const reorderable: string[] = [];
    const criticalDeps = dependencies.filter(
      (dep) => dep.severity === ConflictSeverity.CRITICAL || dep.severity === ConflictSeverity.HIGH
    );

    for (const node of graph.keys()) {
      const hasCriticalDeps = criticalDeps.some((dep) => dep.from === node || dep.to === node);

      if (!hasCriticalDeps) {
        reorderable.push(node);
      }
    }

    return reorderable;
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
  }

  private selectorsOverlap(selector1: string, selector2: string): boolean {
    // Simplified selector overlap detection
    // In a real implementation, this would use a proper CSS selector parser

    const parsed1 = this.parseSelector(selector1);
    const parsed2 = this.parseSelector(selector2);

    return this.parsedSelectorsOverlap(parsed1, parsed2);
  }

  private parseSelector(selector: string): ParsedSelector {
    const cacheKey = selector;
    const cached = this.selectorCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    // Basic selector parsing (simplified)
    const parsed: ParsedSelector = {
      original: selector,
      elements: [],
      classes: [],
      ids: [],
      pseudoClasses: [],
      pseudoElements: [],
      attributes: [],
    };

    // Extract different parts of the selector
    parsed.elements = this.extractElements(selector);
    parsed.classes = this.extractClasses(selector);
    parsed.ids = this.extractIds(selector);
    parsed.pseudoClasses = this.extractPseudoClasses(selector);
    parsed.pseudoElements = this.extractPseudoElements(selector);
    parsed.attributes = this.extractAttributes(selector);

    this.selectorCache.set(cacheKey, parsed);
    return parsed;
  }

  private parsedSelectorsOverlap(sel1: ParsedSelector, sel2: ParsedSelector): boolean {
    // Check if selectors can target the same elements

    // If they have different IDs, they can't overlap
    if (sel1.ids.length > 0 && sel2.ids.length > 0) {
      const commonIds = sel1.ids.filter((id) => sel2.ids.includes(id));
      if (commonIds.length === 0) {
        return false;
      }
    }

    // Check for element overlap
    if (sel1.elements.length > 0 && sel2.elements.length > 0) {
      const commonElements = sel1.elements.filter((el) => sel2.elements.includes(el));
      if (commonElements.length === 0) {
        return false;
      }
    }

    // If one has classes and the other doesn't, they might still overlap
    // More sophisticated overlap detection would be needed for a complete implementation

    return true; // Conservative approach - assume overlap
  }

  private calculateSpecificity(selector: string): [number, number, number, number] {
    // CSS specificity calculation: [inline, ids, classes/attributes/pseudo-classes, elements/pseudo-elements]
    const parsed = this.parseSelector(selector);

    return [
      0, // inline styles (not applicable to stylesheets)
      parsed.ids.length,
      parsed.classes.length + parsed.attributes.length + parsed.pseudoClasses.length,
      parsed.elements.length + parsed.pseudoElements.length,
    ];
  }

  private compareSpecificity(
    spec1: [number, number, number, number],
    spec2: [number, number, number, number]
  ): number {
    for (let i = 0; i < 4; i++) {
      if (spec1[i] !== spec2[i]) {
        return spec1[i] - spec2[i];
      }
    }
    return 0;
  }

  private getCommonProperties(rule1: CSSRule, rule2: CSSRule): string[] {
    // Normalize declarations to array format
    const decls1 = Array.isArray(rule1.declarations)
      ? rule1.declarations
      : Object.entries(rule1.declarations).map(([property, value]) => ({
          property,
          value,
          important: false,
        }));

    const decls2 = Array.isArray(rule2.declarations)
      ? rule2.declarations
      : Object.entries(rule2.declarations).map(([property, value]) => ({
          property,
          value,
          important: false,
        }));

    const props1 = new Set(decls1.map((d) => d.property));
    const props2 = new Set(decls2.map((d) => d.property));

    return Array.from(props1).filter((prop: string) => props2.has(prop));
  }

  private mediaQueriesOverlap(mq1: string | undefined, mq2: string | undefined): boolean {
    if (!mq1 && !mq2) return true; // Both apply to all media
    if (!mq1 || !mq2) return true; // One applies to all media

    // Simplified media query overlap detection
    // In reality, this would need proper media query parsing
    return mq1 === mq2;
  }

  private isFallbackPair(prop1: string, prop2: string): boolean {
    // Check for common fallback patterns
    const fallbackPairs = [
      ['color', '-webkit-text-fill-color'],
      ['display', '-webkit-box'],
      ['display', '-ms-flexbox'],
      ['background', 'background-image'],
      ['background-image', '-webkit-gradient'],
    ];

    return fallbackPairs.some(
      ([fallback, modern]) =>
        (prop1 === fallback && prop2 === modern) || (prop1 === modern && prop2 === fallback)
    );
  }

  private isPseudoClassOrderSensitive(rule1: CSSRule, rule2: CSSRule): boolean {
    const base1 = rule1.selector.replace(/:[a-zA-Z-]+/g, '');
    const base2 = rule2.selector.replace(/:[a-zA-Z-]+/g, '');

    return base1 === base2 && rule1.selector.includes(':') && rule2.selector.includes(':');
  }

  private getPseudoClassPriority(selector: string): number {
    const pseudoClasses = this.extractPseudoClasses(selector);
    let maxPriority = 0;

    for (const pseudo of pseudoClasses) {
      const priority = (PSEUDO_CLASS_PRIORITIES as any)[pseudo] || 0;
      maxPriority = Math.max(maxPriority, priority);
    }

    return maxPriority;
  }

  private isMediaQueryOrderSensitive(rule1: CSSRule, rule2: CSSRule): boolean {
    return (
      rule1.type === RuleType.MEDIA &&
      rule2.type === RuleType.MEDIA &&
      this.selectorsOverlap(rule1.selector, rule2.selector)
    );
  }

  private isDescendantSelector(child: string, parent: string): boolean {
    // Simplified descendant detection
    return child.includes(parent) && child !== parent;
  }

  private getInheritableProperties(rule1: CSSRule, rule2: CSSRule): string[] {
    const inheritableProps = [
      'color',
      'font-family',
      'font-size',
      'font-weight',
      'font-style',
      'line-height',
      'text-align',
      'text-indent',
      'text-transform',
      'letter-spacing',
      'word-spacing',
      'white-space',
      'direction',
    ];

    const rule1Props = rule1.declarations.map((d) => d.property);
    return rule1Props.filter((prop) => inheritableProps.includes(prop));
  }

  // Selector parsing helper methods

  private extractElements(selector: string): string[] {
    const matches = selector.match(/(?:^|[\s>+~])([a-zA-Z][\w-]*)/g);
    return matches ? matches.map((m) => m.trim()) : [];
  }

  private extractClasses(selector: string): string[] {
    const matches = selector.match(/\.[a-zA-Z][\w-]*/g);
    return matches ? matches.map((m) => m.substring(1)) : [];
  }

  private extractIds(selector: string): string[] {
    const matches = selector.match(/#[a-zA-Z][\w-]*/g);
    return matches ? matches.map((m) => m.substring(1)) : [];
  }

  private extractPseudoClasses(selector: string): string[] {
    const matches = selector.match(/:[a-zA-Z-]+(?:\([^)]*\))?/g);
    return matches || [];
  }

  private extractPseudoElements(selector: string): string[] {
    const matches = selector.match(/::[a-zA-Z-]+/g);
    return matches || [];
  }

  private extractAttributes(selector: string): string[] {
    const matches = selector.match(/\[[^\]]*\]/g);
    return matches || [];
  }

  /**
   * Clear all caches
   */
  public clearCache(): void {
    this.dependencyCache.clear();
    this.selectorCache.clear();
  }

  /**
   * Get cache statistics
   */
  public getCacheStats(): {
    dependenciesCached: number;
    selectorsCached: number;
  } {
    return {
      dependenciesCached: this.dependencyCache.size,
      selectorsCached: this.selectorCache.size,
    };
  }
}

/**
 * Parsed selector representation for analysis
 */
interface ParsedSelector {
  original: string;
  elements: string[];
  classes: string[];
  ids: string[];
  pseudoClasses: string[];
  pseudoElements: string[];
  attributes: string[];
}
