/**
 * CSS Custom Property Optimization Strategy
 * 
 * Analyzes detected variables to identify optimization opportunities,
 * including redundant variable reduction, value merging, and shorthand
 * property leveraging while preserving dependencies and specificity.
 */

import type { 
  VariableMap, 
  CustomPropertyDeclaration, 
  CustomPropertyUsage,
  PropertyScope 
} from './customPropertyDetector.js';

export interface OptimizationStrategy {
  /** Strategy name */
  name: string;
  /** Strategy description */
  description: string;
  /** Estimated savings in bytes */
  estimatedSavings: number;
  /** Risk level (low, medium, high) */
  riskLevel: 'low' | 'medium' | 'high';
  /** Variables affected by this strategy */
  affectedVariables: string[];
  /** Specific optimization actions */
  actions: OptimizationAction[];
}

export interface OptimizationAction {
  /** Action type */
  type: 'merge' | 'remove' | 'shorthand' | 'rename' | 'consolidate';
  /** Target variable(s) */
  targets: string[];
  /** Replacement variable or value */
  replacement?: string;
  /** Detailed description of the action */
  description: string;
  /** Estimated character savings */
  savings: number;
  /** Files that will be affected */
  affectedFiles: string[];
}

export interface OptimizationReport {
  /** Total estimated savings in bytes */
  totalSavings: number;
  /** Number of optimization opportunities */
  opportunityCount: number;
  /** Strategies organized by risk level */
  strategies: {
    low: OptimizationStrategy[];
    medium: OptimizationStrategy[];
    high: OptimizationStrategy[];
  };
  /** Variables that cannot be optimized and why */
  unoptimizable: Array<{
    variable: string;
    reason: string;
    scope: PropertyScope;
  }>;
  /** Potential issues and warnings */
  warnings: OptimizationWarning[];
}

export interface OptimizationWarning {
  /** Warning type */
  type: 'dependency' | 'scope' | 'dynamic' | 'compatibility';
  /** Warning message */
  message: string;
  /** Affected variables */
  variables: string[];
  /** Severity level */
  severity: 'info' | 'warning' | 'error';
}

export interface OptimizationOptions {
  /** Include aggressive optimizations */
  aggressive: boolean;
  /** Preserve original variable names when possible */
  preserveNames: boolean;
  /** Minimum savings threshold for recommendations */
  minSavingsThreshold: number;
  /** Target CSS properties for shorthand optimization */
  shorthandTargets: string[];
  /** Value similarity threshold (0-1) */
  similarityThreshold: number;
  /** Maximum scope depth for consolidation */
  maxScopeDepth: number;
}

export class CustomPropertyOptimizer {
  private options: OptimizationOptions;

  constructor(options: Partial<OptimizationOptions> = {}) {
    this.options = {
      aggressive: false,
      preserveNames: true,
      minSavingsThreshold: 10,
      shorthandTargets: ['margin', 'padding', 'border', 'font', 'background'],
      similarityThreshold: 0.9,
      maxScopeDepth: 3,
      ...options
    };
  }

  /**
   * Analyze variable map and generate optimization strategies
   */
  analyzeOptimizations(variableMap: VariableMap): OptimizationReport {
    const strategies: OptimizationStrategy[] = [];
    const warnings: OptimizationWarning[] = [];
    const unoptimizable: OptimizationReport['unoptimizable'] = [];

    // Analyze different optimization opportunities
    strategies.push(...this.findRedundantVariables(variableMap, warnings));
    strategies.push(...this.findSimilarVariables(variableMap, warnings));
    strategies.push(...this.findShorthandOpportunities(variableMap, warnings));
    strategies.push(...this.findUnusedVariables(variableMap, warnings));
    strategies.push(...this.findConsolidationOpportunities(variableMap, warnings));

    // Identify unoptimizable variables
    this.identifyUnoptimizableVariables(variableMap, unoptimizable, warnings);

    // Calculate total savings
    const totalSavings = strategies.reduce((sum, strategy) => sum + strategy.estimatedSavings, 0);

    // Categorize strategies by risk level
    const categorizedStrategies = {
      low: strategies.filter(s => s.riskLevel === 'low'),
      medium: strategies.filter(s => s.riskLevel === 'medium'),
      high: strategies.filter(s => s.riskLevel === 'high')
    };

    return {
      totalSavings,
      opportunityCount: strategies.length,
      strategies: categorizedStrategies,
      unoptimizable,
      warnings
    };
  }

  /**
   * Find variables with identical values
   */
  private findRedundantVariables(
    variableMap: VariableMap,
    warnings: OptimizationWarning[]
  ): OptimizationStrategy[] {
    const strategies: OptimizationStrategy[] = [];
    const valueGroups = new Map<string, CustomPropertyDeclaration[]>();

    // Group variables by their values
    for (const [name, declarations] of variableMap.declarations) {
      for (const declaration of declarations) {
        // Normalize value for comparison
        const normalizedValue = this.normalizeValue(declaration.value);
        
        if (!valueGroups.has(normalizedValue)) {
          valueGroups.set(normalizedValue, []);
        }
        valueGroups.get(normalizedValue)!.push(declaration);
      }
    }

    // Find groups with multiple variables
    for (const [value, declarations] of valueGroups) {
      if (declarations.length < 2) continue;

      // Group by scope to avoid conflicts
      const scopeGroups = this.groupByScope(declarations);
      
      for (const [scopeKey, scopedDeclarations] of scopeGroups) {
        if (scopedDeclarations.length < 2) continue;

        const primaryVar = scopedDeclarations[0];
        const redundantVars = scopedDeclarations.slice(1);
        
        // Check for dependencies
        const hasDependencies = this.checkDependencies(redundantVars.map(v => v.name), variableMap);
        
        if (hasDependencies) {
          warnings.push({
            type: 'dependency',
            message: `Cannot merge redundant variables due to dependencies`,
            variables: redundantVars.map(v => v.name),
            severity: 'warning'
          });
          continue;
        }

        const actions: OptimizationAction[] = redundantVars.map(redundantVar => ({
          type: 'merge',
          targets: [redundantVar.name],
          replacement: primaryVar.name,
          description: `Merge --${redundantVar.name} into --${primaryVar.name} (identical value: ${value})`,
          savings: this.calculateMergeSavings(redundantVar, primaryVar, variableMap),
          affectedFiles: this.getAffectedFiles([redundantVar.name], variableMap)
        }));

        const totalSavings = actions.reduce((sum, action) => sum + action.savings, 0);

        if (totalSavings >= this.options.minSavingsThreshold) {
          strategies.push({
            name: 'Redundant Variable Merge',
            description: `Merge ${redundantVars.length} redundant variables with identical values`,
            estimatedSavings: totalSavings,
            riskLevel: 'low',
            affectedVariables: redundantVars.map(v => v.name),
            actions
          });
        }
      }
    }

    return strategies;
  }

  /**
   * Find variables with similar values that could be consolidated
   */
  private findSimilarVariables(
    variableMap: VariableMap,
    warnings: OptimizationWarning[]
  ): OptimizationStrategy[] {
    const strategies: OptimizationStrategy[] = [];
    const declarations = Array.from(variableMap.declarations.values()).flat();

    // Find similar color values
    const colorVars = declarations.filter(d => this.isColorValue(d.value));
    const colorGroups = this.groupSimilarColors(colorVars);
    
    for (const group of colorGroups) {
      if (group.length < 2) continue;

      const strategy = this.createColorConsolidationStrategy(group, variableMap, warnings);
      if (strategy) {
        strategies.push(strategy);
      }
    }

    // Find similar size values
    const sizeVars = declarations.filter(d => this.isSizeValue(d.value));
    const sizeGroups = this.groupSimilarSizes(sizeVars);
    
    for (const group of sizeGroups) {
      if (group.length < 2) continue;

      const strategy = this.createSizeConsolidationStrategy(group, variableMap, warnings);
      if (strategy) {
        strategies.push(strategy);
      }
    }

    return strategies;
  }

  /**
   * Find opportunities for CSS shorthand properties
   */
  private findShorthandOpportunities(
    variableMap: VariableMap,
    warnings: OptimizationWarning[]
  ): OptimizationStrategy[] {
    const strategies: OptimizationStrategy[] = [];

    // Analyze variable usage patterns for shorthand opportunities
    for (const [name, usages] of variableMap.usages) {
      const relatedUsages = this.findRelatedPropertyUsages(usages, this.options.shorthandTargets);
      
      if (relatedUsages.length > 0) {
        const strategy = this.createShorthandStrategy(name, relatedUsages, variableMap, warnings);
        if (strategy) {
          strategies.push(strategy);
        }
      }
    }

    return strategies;
  }

  /**
   * Find unused variables that can be removed
   */
  private findUnusedVariables(
    variableMap: VariableMap,
    warnings: OptimizationWarning[]
  ): OptimizationStrategy[] {
    const strategies: OptimizationStrategy[] = [];
    
    if (variableMap.unusedVariables.length === 0) {
      return strategies;
    }

    const actions: OptimizationAction[] = [];
    
    for (const unusedVar of variableMap.unusedVariables) {
      const declarations = variableMap.declarations.get(unusedVar);
      if (!declarations) continue;

      // Check if variable might be used dynamically
      const isDynamic = declarations.some(d => d.scope.type === 'dynamic');
      
      if (isDynamic) {
        warnings.push({
          type: 'dynamic',
          message: `Variable --${unusedVar} might be used dynamically, manual verification recommended`,
          variables: [unusedVar],
          severity: 'warning'
        });
        continue;
      }

      const savings = this.calculateRemovalSavings(declarations);
      
      actions.push({
        type: 'remove',
        targets: [unusedVar],
        description: `Remove unused variable --${unusedVar}`,
        savings,
        affectedFiles: declarations.map(d => d.filePath)
      });
    }

    if (actions.length > 0) {
      const totalSavings = actions.reduce((sum, action) => sum + action.savings, 0);
      
      strategies.push({
        name: 'Unused Variable Removal',
        description: `Remove ${actions.length} unused variables`,
        estimatedSavings: totalSavings,
        riskLevel: 'low',
        affectedVariables: actions.map(a => a.targets[0]),
        actions
      });
    }

    return strategies;
  }

  /**
   * Find opportunities to consolidate variables across scopes
   */
  private findConsolidationOpportunities(
    variableMap: VariableMap,
    warnings: OptimizationWarning[]
  ): OptimizationStrategy[] {
    const strategies: OptimizationStrategy[] = [];

    // Find variables that could be moved to global scope
    const globalCandidates = this.findGlobalConsolidationCandidates(variableMap);
    
    for (const candidate of globalCandidates) {
      const strategy = this.createGlobalConsolidationStrategy(candidate, variableMap, warnings);
      if (strategy) {
        strategies.push(strategy);
      }
    }

    return strategies;
  }

  /**
   * Identify variables that cannot be optimized
   */
  private identifyUnoptimizableVariables(
    variableMap: VariableMap,
    unoptimizable: OptimizationReport['unoptimizable'],
    warnings: OptimizationWarning[]
  ): void {
    for (const [name, declarations] of variableMap.declarations) {
      // Variables with circular dependencies
      if (this.hasCircularDependency(name, variableMap)) {
        unoptimizable.push({
          variable: name,
          reason: 'Circular dependency detected',
          scope: declarations[0].scope
        });
      }

      // Variables used in complex expressions
      const usages = variableMap.usages.get(name) || [];
      if (usages.some(usage => this.isComplexExpression(usage.expression))) {
        unoptimizable.push({
          variable: name,
          reason: 'Used in complex calc() or other expressions',
          scope: declarations[0].scope
        });
      }

      // Variables with dynamic scope
      if (declarations.some(d => d.scope.type === 'dynamic')) {
        unoptimizable.push({
          variable: name,
          reason: 'Dynamically scoped variable',
          scope: declarations[0].scope
        });
      }
    }
  }

  // Helper methods

  private normalizeValue(value: string): string {
    return value.trim().toLowerCase().replace(/\s+/g, ' ');
  }

  private groupByScope(declarations: CustomPropertyDeclaration[]): Map<string, CustomPropertyDeclaration[]> {
    const groups = new Map<string, CustomPropertyDeclaration[]>();
    
    for (const declaration of declarations) {
      const scopeKey = `${declaration.scope.type}:${declaration.scope.identifier}`;
      
      if (!groups.has(scopeKey)) {
        groups.set(scopeKey, []);
      }
      groups.get(scopeKey)!.push(declaration);
    }
    
    return groups;
  }

  private checkDependencies(variables: string[], variableMap: VariableMap): boolean {
    for (const variable of variables) {
      const usages = variableMap.usages.get(variable);
      if (usages && usages.length > 0) {
        return true;
      }
    }
    return false;
  }

  private calculateMergeSavings(
    redundantVar: CustomPropertyDeclaration,
    primaryVar: CustomPropertyDeclaration,
    variableMap: VariableMap
  ): number {
    const usages = variableMap.usages.get(redundantVar.name) || [];
    const declarationSavings = redundantVar.fullName.length + redundantVar.value.length + 3; // includes ": " and ";"
    const usageSavings = usages.length * (redundantVar.name.length - primaryVar.name.length);
    
    return declarationSavings + usageSavings;
  }

  private calculateRemovalSavings(declarations: CustomPropertyDeclaration[]): number {
    return declarations.reduce((sum, decl) => {
      return sum + decl.fullName.length + decl.value.length + 3; // includes ": " and ";"
    }, 0);
  }

  private getAffectedFiles(variables: string[], variableMap: VariableMap): string[] {
    const files = new Set<string>();
    
    for (const variable of variables) {
      const declarations = variableMap.declarations.get(variable) || [];
      const usages = variableMap.usages.get(variable) || [];
      
      declarations.forEach(d => files.add(d.filePath));
      usages.forEach(u => files.add(u.filePath));
    }
    
    return Array.from(files);
  }

  private isColorValue(value: string): boolean {
    const colorPatterns = [
      /^#[0-9a-fA-F]{3,8}$/,           // Hex colors
      /^rgb\(.*\)$/,                    // RGB colors
      /^rgba\(.*\)$/,                   // RGBA colors
      /^hsl\(.*\)$/,                    // HSL colors
      /^hsla\(.*\)$/,                   // HSLA colors
      /^(red|blue|green|white|black|yellow|purple|orange|pink|brown|gray|grey)$/i // Named colors
    ];
    
    return colorPatterns.some(pattern => pattern.test(value.trim()));
  }

  private isSizeValue(value: string): boolean {
    const sizePattern = /^[\d.]+\s*(px|em|rem|%|vh|vw|pt|pc|in|cm|mm|ex|ch|vmin|vmax)$/i;
    return sizePattern.test(value.trim());
  }

  private groupSimilarColors(colorVars: CustomPropertyDeclaration[]): CustomPropertyDeclaration[][] {
    // Simplified color similarity grouping
    const groups: CustomPropertyDeclaration[][] = [];
    const processed = new Set<string>();
    
    for (const colorVar of colorVars) {
      if (processed.has(colorVar.name)) continue;
      
      const similarColors = colorVars.filter(other => 
        !processed.has(other.name) && 
        this.areColorsSimilar(colorVar.value, other.value)
      );
      
      if (similarColors.length > 1) {
        groups.push(similarColors);
        similarColors.forEach(c => processed.add(c.name));
      }
    }
    
    return groups;
  }

  private groupSimilarSizes(sizeVars: CustomPropertyDeclaration[]): CustomPropertyDeclaration[][] {
    // Group sizes that are within a threshold
    const groups: CustomPropertyDeclaration[][] = [];
    const processed = new Set<string>();
    
    for (const sizeVar of sizeVars) {
      if (processed.has(sizeVar.name)) continue;
      
      const similarSizes = sizeVars.filter(other =>
        !processed.has(other.name) &&
        this.areSizesSimilar(sizeVar.value, other.value)
      );
      
      if (similarSizes.length > 1) {
        groups.push(similarSizes);
        similarSizes.forEach(s => processed.add(s.name));
      }
    }
    
    return groups;
  }

  private areColorsSimilar(color1: string, color2: string): boolean {
    // Simplified color similarity - in production, would use proper color space calculations
    return this.normalizeValue(color1) === this.normalizeValue(color2);
  }

  private areSizesSimilar(size1: string, size2: string): boolean {
    const value1 = parseFloat(size1);
    const value2 = parseFloat(size2);
    
    if (isNaN(value1) || isNaN(value2)) return false;
    
    const threshold = Math.abs(value1 * (1 - this.options.similarityThreshold));
    return Math.abs(value1 - value2) <= threshold;
  }

  private createColorConsolidationStrategy(
    group: CustomPropertyDeclaration[],
    variableMap: VariableMap,
    warnings: OptimizationWarning[]
  ): OptimizationStrategy | null {
    const primaryVar = group[0];
    const consolidateVars = group.slice(1);
    
    const actions: OptimizationAction[] = consolidateVars.map(v => ({
      type: 'consolidate',
      targets: [v.name],
      replacement: primaryVar.name,
      description: `Consolidate similar color --${v.name} into --${primaryVar.name}`,
      savings: this.calculateMergeSavings(v, primaryVar, variableMap),
      affectedFiles: this.getAffectedFiles([v.name], variableMap)
    }));

    const totalSavings = actions.reduce((sum, action) => sum + action.savings, 0);

    if (totalSavings < this.options.minSavingsThreshold) {
      return null;
    }

    return {
      name: 'Similar Color Consolidation',
      description: `Consolidate ${consolidateVars.length} similar color variables`,
      estimatedSavings: totalSavings,
      riskLevel: 'medium',
      affectedVariables: consolidateVars.map(v => v.name),
      actions
    };
  }

  private createSizeConsolidationStrategy(
    group: CustomPropertyDeclaration[],
    variableMap: VariableMap,
    warnings: OptimizationWarning[]
  ): OptimizationStrategy | null {
    const primaryVar = group[0];
    const consolidateVars = group.slice(1);
    
    const actions: OptimizationAction[] = consolidateVars.map(v => ({
      type: 'consolidate',
      targets: [v.name],
      replacement: primaryVar.name,
      description: `Consolidate similar size --${v.name} into --${primaryVar.name}`,
      savings: this.calculateMergeSavings(v, primaryVar, variableMap),
      affectedFiles: this.getAffectedFiles([v.name], variableMap)
    }));

    const totalSavings = actions.reduce((sum, action) => sum + action.savings, 0);

    if (totalSavings < this.options.minSavingsThreshold) {
      return null;
    }

    return {
      name: 'Similar Size Consolidation',
      description: `Consolidate ${consolidateVars.length} similar size variables`,
      estimatedSavings: totalSavings,
      riskLevel: 'medium',
      affectedVariables: consolidateVars.map(v => v.name),
      actions
    };
  }

  private findRelatedPropertyUsages(
    usages: CustomPropertyUsage[],
    shorthandTargets: string[]
  ): CustomPropertyUsage[] {
    return usages.filter(usage =>
      shorthandTargets.some(target =>
        usage.cssProperty.startsWith(target)
      )
    );
  }

  private createShorthandStrategy(
    name: string,
    relatedUsages: CustomPropertyUsage[],
    variableMap: VariableMap,
    warnings: OptimizationWarning[]
  ): OptimizationStrategy | null {
    // Simplified shorthand analysis
    const savings = relatedUsages.length * 5; // Estimated savings per shorthand conversion
    
    if (savings < this.options.minSavingsThreshold) {
      return null;
    }

    return {
      name: 'Shorthand Property Optimization',
      description: `Convert --${name} usage to shorthand properties`,
      estimatedSavings: savings,
      riskLevel: 'medium',
      affectedVariables: [name],
      actions: [{
        type: 'shorthand',
        targets: [name],
        description: `Use shorthand properties for --${name}`,
        savings,
        affectedFiles: relatedUsages.map(u => u.filePath)
      }]
    };
  }

  private findGlobalConsolidationCandidates(variableMap: VariableMap): CustomPropertyDeclaration[] {
    const candidates: CustomPropertyDeclaration[] = [];
    
    for (const [name, declarations] of variableMap.declarations) {
      // Look for variables used across multiple scopes that could be global
      const scopes = new Set(declarations.map(d => d.scope.identifier));
      
      if (scopes.size > 2 && !declarations.some(d => d.scope.type === 'global')) {
        candidates.push(...declarations);
      }
    }
    
    return candidates;
  }

  private createGlobalConsolidationStrategy(
    candidate: CustomPropertyDeclaration,
    variableMap: VariableMap,
    warnings: OptimizationWarning[]
  ): OptimizationStrategy | null {
    const usages = variableMap.usages.get(candidate.name) || [];
    const savings = usages.length * 3; // Estimated savings from scope consolidation
    
    if (savings < this.options.minSavingsThreshold) {
      return null;
    }

    return {
      name: 'Global Scope Consolidation',
      description: `Move --${candidate.name} to global scope`,
      estimatedSavings: savings,
      riskLevel: 'high',
      affectedVariables: [candidate.name],
      actions: [{
        type: 'consolidate',
        targets: [candidate.name],
        replacement: `:root --${candidate.name}`,
        description: `Move --${candidate.name} to global :root scope`,
        savings,
        affectedFiles: [candidate.filePath]
      }]
    };
  }

  private hasCircularDependency(variable: string, variableMap: VariableMap): boolean {
    const visited = new Set<string>();
    const path = new Set<string>();
    
    const hasCycle = (current: string): boolean => {
      if (path.has(current)) return true;
      if (visited.has(current)) return false;
      
      visited.add(current);
      path.add(current);
      
      const declarations = variableMap.declarations.get(current) || [];
      for (const declaration of declarations) {
        for (const referenced of declaration.referencedVariables) {
          if (hasCycle(referenced)) return true;
        }
      }
      
      path.delete(current);
      return false;
    };
    
    return hasCycle(variable);
  }

  private isComplexExpression(expression: string): boolean {
    return expression.includes('calc(') || 
           expression.includes('min(') || 
           expression.includes('max(') ||
           expression.includes('clamp(');
  }
}

/**
 * Utility function to create an optimizer
 */
export function createCustomPropertyOptimizer(options: Partial<OptimizationOptions> = {}): CustomPropertyOptimizer {
  return new CustomPropertyOptimizer(options);
}

/**
 * Utility function to analyze optimizations
 */
export function analyzeCustomPropertyOptimizations(
  variableMap: VariableMap,
  options: Partial<OptimizationOptions> = {}
): OptimizationReport {
  const optimizer = createCustomPropertyOptimizer(options);
  return optimizer.analyzeOptimizations(variableMap);
}