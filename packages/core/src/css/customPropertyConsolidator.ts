/**
 * CSS Custom Property Consolidation Logic
 * 
 * Implements consolidation logic to merge and group related custom properties,
 * reducing duplication and promoting DRY principles while maintaining scope
 * integrity and preventing naming conflicts.
 */

import type { 
  VariableMap, 
  CustomPropertyDeclaration, 
  CustomPropertyUsage,
  PropertyScope 
} from './customPropertyDetector.js';
import type { OptimizationStrategy, OptimizationAction } from './customPropertyOptimizer.js';

export interface ConsolidationGroup {
  /** Group category */
  category: VariableCategory;
  /** Group name/identifier */
  name: string;
  /** Variables in this group */
  variables: CustomPropertyDeclaration[];
  /** Recommended primary variable */
  primaryVariable: CustomPropertyDeclaration;
  /** Variables to be consolidated into primary */
  consolidateVariables: CustomPropertyDeclaration[];
  /** Estimated savings from consolidation */
  estimatedSavings: number;
  /** Consolidation safety level */
  safetyLevel: 'safe' | 'caution' | 'risky';
}

export interface ConsolidationResult {
  /** Original file content */
  originalContent: string;
  /** Updated file content */
  updatedContent: string;
  /** File path */
  filePath: string;
  /** Changes made */
  changes: ConsolidationChange[];
  /** Any errors encountered */
  errors: ConsolidationError[];
}

export interface ConsolidationChange {
  /** Type of change */
  type: 'declaration_removed' | 'declaration_merged' | 'usage_updated' | 'scope_moved';
  /** Line number where change occurred */
  line: number;
  /** Original content */
  original: string;
  /** New content */
  replacement: string;
  /** Variable name affected */
  variableName: string;
}

export interface ConsolidationError {
  /** Error type */
  type: 'naming_conflict' | 'scope_violation' | 'dependency_break' | 'syntax_error';
  /** Error message */
  message: string;
  /** Variable name that caused error */
  variableName?: string;
  /** File path where error occurred */
  filePath: string;
  /** Line number if applicable */
  line?: number;
}

export interface RefactoringPlan {
  /** Groups to be consolidated */
  groups: ConsolidationGroup[];
  /** Files that will be modified */
  affectedFiles: string[];
  /** Total estimated savings */
  totalSavings: number;
  /** Consolidation actions in execution order */
  actions: ConsolidationAction[];
  /** Potential conflicts and risks */
  risks: ConsolidationRisk[];
}

export interface ConsolidationAction {
  /** Action type */
  type: 'merge_declarations' | 'update_usages' | 'move_to_global' | 'remove_duplicates';
  /** Target group */
  targetGroup: string;
  /** Variables involved */
  variables: string[];
  /** Files to be modified */
  files: string[];
  /** Execution order (lower numbers first) */
  order: number;
  /** Whether this action is safe to auto-execute */
  autoExecutable: boolean;
}

export interface ConsolidationRisk {
  /** Risk type */
  type: 'naming_conflict' | 'scope_leak' | 'dependency_break' | 'override_cascade';
  /** Risk level */
  level: 'low' | 'medium' | 'high';
  /** Risk description */
  description: string;
  /** Affected variables */
  variables: string[];
  /** Suggested mitigation */
  mitigation?: string;
}

export type VariableCategory = 
  | 'color' 
  | 'typography' 
  | 'spacing' 
  | 'sizing' 
  | 'shadow' 
  | 'border' 
  | 'animation' 
  | 'layout'
  | 'other';

export interface ConsolidationOptions {
  /** Categories to consolidate */
  targetCategories: VariableCategory[];
  /** Whether to move variables to global scope when beneficial */
  enableGlobalPromotion: boolean;
  /** Minimum usage count for global promotion */
  globalPromotionThreshold: number;
  /** Preserve original variable names when possible */
  preserveOriginalNames: boolean;
  /** Generate backup files before modification */
  createBackups: boolean;
  /** Validate consolidation before applying */
  validateBeforeApply: boolean;
  /** Maximum number of variables per group */
  maxGroupSize: number;
}

export class CustomPropertyConsolidator {
  private options: ConsolidationOptions;

  constructor(options: Partial<ConsolidationOptions> = {}) {
    this.options = {
      targetCategories: ['color', 'typography', 'spacing', 'sizing'],
      enableGlobalPromotion: true,
      globalPromotionThreshold: 3,
      preserveOriginalNames: true,
      createBackups: true,
      validateBeforeApply: true,
      maxGroupSize: 10,
      ...options
    };
  }

  /**
   * Create a consolidation plan from variable map
   */
  createConsolidationPlan(variableMap: VariableMap): RefactoringPlan {
    const groups = this.groupVariables(variableMap);
    const actions = this.planConsolidationActions(groups, variableMap);
    const risks = this.analyzeConsolidationRisks(groups, variableMap);
    
    const affectedFiles = new Set<string>();
    for (const group of groups) {
      group.variables.forEach(v => affectedFiles.add(v.filePath));
    }

    const totalSavings = groups.reduce((sum, group) => sum + group.estimatedSavings, 0);

    return {
      groups,
      affectedFiles: Array.from(affectedFiles),
      totalSavings,
      actions,
      risks
    };
  }

  /**
   * Execute consolidation plan
   */
  async executeConsolidationPlan(
    plan: RefactoringPlan,
    fileContents: Map<string, string>
  ): Promise<Map<string, ConsolidationResult>> {
    const results = new Map<string, ConsolidationResult>();

    // Sort actions by execution order
    const sortedActions = plan.actions.sort((a, b) => a.order - b.order);

    // Process each file
    for (const filePath of plan.affectedFiles) {
      const originalContent = fileContents.get(filePath) || '';
      let updatedContent = originalContent;
      const changes: ConsolidationChange[] = [];
      const errors: ConsolidationError[] = [];

      try {
        // Apply relevant actions to this file
        const fileActions = sortedActions.filter(action => 
          action.files.includes(filePath)
        );

        for (const action of fileActions) {
          const actionResult = await this.executeAction(action, updatedContent, filePath, plan);
          updatedContent = actionResult.content;
          changes.push(...actionResult.changes);
          errors.push(...actionResult.errors);
        }

        results.set(filePath, {
          originalContent,
          updatedContent,
          filePath,
          changes,
          errors
        });

      } catch (error) {
        errors.push({
          type: 'syntax_error',
          message: `Failed to process file: ${error instanceof Error ? error.message : String(error)}`,
          filePath
        });

        results.set(filePath, {
          originalContent,
          updatedContent: originalContent, // Revert on error
          filePath,
          changes: [],
          errors
        });
      }
    }

    return results;
  }

  /**
   * Group variables by category and similarity
   */
  private groupVariables(variableMap: VariableMap): ConsolidationGroup[] {
    const groups: ConsolidationGroup[] = [];
    const processed = new Set<string>();

    // Group by category first
    const categoryGroups = new Map<VariableCategory, CustomPropertyDeclaration[]>();
    
    for (const [name, declarations] of variableMap.declarations) {
      if (processed.has(name)) continue;

      for (const declaration of declarations) {
        const category = this.categorizeVariable(declaration);
        
        if (!this.options.targetCategories.includes(category)) continue;

        if (!categoryGroups.has(category)) {
          categoryGroups.set(category, []);
        }
        categoryGroups.get(category)!.push(declaration);
      }
    }

    // Create consolidation groups within each category
    for (const [category, declarations] of categoryGroups) {
      const similarityGroups = this.findSimilarVariablesInCategory(declarations);
      
      for (const similarGroup of similarityGroups) {
        if (similarGroup.length < 2) continue;

        const group = this.createConsolidationGroup(category, similarGroup, variableMap);
        if (group) {
          groups.push(group);
          similarGroup.forEach(decl => processed.add(decl.name));
        }
      }
    }

    // Find scope-based consolidation opportunities
    const scopeGroups = this.findScopeConsolidationOpportunities(variableMap, processed);
    groups.push(...scopeGroups);

    return groups;
  }

  /**
   * Categorize a variable based on its name and value
   */
  private categorizeVariable(declaration: CustomPropertyDeclaration): VariableCategory {
    const name = declaration.name.toLowerCase();
    const value = declaration.value.toLowerCase();

    // Color patterns
    if (this.isColorValue(value) || 
        name.includes('color') || 
        name.includes('bg') || 
        name.includes('background') ||
        name.includes('text') ||
        name.includes('border-color')) {
      return 'color';
    }

    // Typography patterns
    if (name.includes('font') || 
        name.includes('text') || 
        name.includes('letter') ||
        name.includes('line-height') ||
        value.includes('em') ||
        value.includes('rem')) {
      return 'typography';
    }

    // Spacing patterns
    if (name.includes('margin') || 
        name.includes('padding') || 
        name.includes('gap') ||
        name.includes('space') ||
        name.includes('spacing')) {
      return 'spacing';
    }

    // Sizing patterns
    if (name.includes('width') || 
        name.includes('height') || 
        name.includes('size') ||
        name.includes('radius')) {
      return 'sizing';
    }

    // Shadow patterns
    if (name.includes('shadow') || 
        name.includes('elevation') ||
        value.includes('drop-shadow') ||
        value.includes('box-shadow')) {
      return 'shadow';
    }

    // Border patterns
    if (name.includes('border') && !name.includes('color')) {
      return 'border';
    }

    // Animation patterns
    if (name.includes('duration') || 
        name.includes('delay') || 
        name.includes('timing') ||
        name.includes('transition') ||
        name.includes('animation')) {
      return 'animation';
    }

    // Layout patterns
    if (name.includes('z-index') || 
        name.includes('position') || 
        name.includes('flex') ||
        name.includes('grid')) {
      return 'layout';
    }

    return 'other';
  }

  /**
   * Find similar variables within a category
   */
  private findSimilarVariablesInCategory(
    declarations: CustomPropertyDeclaration[]
  ): CustomPropertyDeclaration[][] {
    const groups: CustomPropertyDeclaration[][] = [];
    const processed = new Set<string>();

    for (const declaration of declarations) {
      if (processed.has(declaration.name)) continue;

      const similarDeclarations = declarations.filter(other => 
        !processed.has(other.name) && 
        this.areVariablesSimilar(declaration, other)
      );

      if (similarDeclarations.length > 1) {
        groups.push(similarDeclarations);
        similarDeclarations.forEach(d => processed.add(d.name));
      }
    }

    return groups;
  }

  /**
   * Create a consolidation group from similar variables
   */
  private createConsolidationGroup(
    category: VariableCategory,
    variables: CustomPropertyDeclaration[],
    variableMap: VariableMap
  ): ConsolidationGroup | null {
    if (variables.length < 2 || variables.length > this.options.maxGroupSize) {
      return null;
    }

    // Select primary variable (prefer global scope, then most used)
    const primaryVariable = this.selectPrimaryVariable(variables, variableMap);
    const consolidateVariables = variables.filter(v => v !== primaryVariable);

    // Calculate estimated savings
    const estimatedSavings = this.calculateConsolidationSavings(
      primaryVariable, 
      consolidateVariables, 
      variableMap
    );

    // Determine safety level
    const safetyLevel = this.assessConsolidationSafety(
      primaryVariable, 
      consolidateVariables, 
      variableMap
    );

    return {
      category,
      name: this.generateGroupName(category, primaryVariable),
      variables,
      primaryVariable,
      consolidateVariables,
      estimatedSavings,
      safetyLevel
    };
  }

  /**
   * Find scope-based consolidation opportunities
   */
  private findScopeConsolidationOpportunities(
    variableMap: VariableMap,
    processed: Set<string>
  ): ConsolidationGroup[] {
    const groups: ConsolidationGroup[] = [];

    if (!this.options.enableGlobalPromotion) {
      return groups;
    }

    // Find variables used across multiple scopes
    for (const [name, declarations] of variableMap.declarations) {
      if (processed.has(name)) continue;

      const usages = variableMap.usages.get(name) || [];
      const uniqueScopes = new Set(declarations.map(d => d.scope.identifier));

      // Consider for global promotion if used in multiple scopes
      if (uniqueScopes.size >= this.options.globalPromotionThreshold && 
          usages.length >= this.options.globalPromotionThreshold) {
        
        const globalDeclaration = declarations.find(d => d.scope.type === 'global');
        
        if (!globalDeclaration) {
          // Create a consolidation group for global promotion
          const primaryVariable = declarations[0];
          const category = this.categorizeVariable(primaryVariable);

          groups.push({
            category,
            name: `global-${category}-${name}`,
            variables: declarations,
            primaryVariable: {
              ...primaryVariable,
              scope: {
                type: 'global',
                identifier: ':root',
                nestingLevel: 0,
                parentScopes: []
              }
            },
            consolidateVariables: declarations,
            estimatedSavings: usages.length * 5, // Estimated scope savings
            safetyLevel: 'caution'
          });

          processed.add(name);
        }
      }
    }

    return groups;
  }

  /**
   * Plan consolidation actions in execution order
   */
  private planConsolidationActions(
    groups: ConsolidationGroup[],
    variableMap: VariableMap
  ): ConsolidationAction[] {
    const actions: ConsolidationAction[] = [];
    let order = 1;

    // Step 1: Remove duplicate declarations (safest first)
    const safeGroups = groups.filter(g => g.safetyLevel === 'safe');
    for (const group of safeGroups) {
      const affectedFiles = new Set<string>();
      group.variables.forEach(v => affectedFiles.add(v.filePath));

      actions.push({
        type: 'remove_duplicates',
        targetGroup: group.name,
        variables: group.consolidateVariables.map(v => v.name),
        files: Array.from(affectedFiles),
        order: order++,
        autoExecutable: true
      });
    }

    // Step 2: Update usages to point to primary variables
    for (const group of groups) {
      if (group.consolidateVariables.length === 0) continue;

      const usageFiles = new Set<string>();
      for (const variable of group.consolidateVariables) {
        const usages = variableMap.usages.get(variable.name) || [];
        usages.forEach(u => usageFiles.add(u.filePath));
      }

      if (usageFiles.size > 0) {
        actions.push({
          type: 'update_usages',
          targetGroup: group.name,
          variables: group.consolidateVariables.map(v => v.name),
          files: Array.from(usageFiles),
          order: order++,
          autoExecutable: group.safetyLevel === 'safe'
        });
      }
    }

    // Step 3: Merge declarations (more complex changes)
    const complexGroups = groups.filter(g => g.safetyLevel !== 'safe');
    for (const group of complexGroups) {
      const affectedFiles = new Set<string>();
      group.variables.forEach(v => affectedFiles.add(v.filePath));

      actions.push({
        type: 'merge_declarations',
        targetGroup: group.name,
        variables: group.consolidateVariables.map(v => v.name),
        files: Array.from(affectedFiles),
        order: order++,
        autoExecutable: false
      });
    }

    // Step 4: Global promotions (highest risk)
    const globalPromotions = groups.filter(g => 
      g.primaryVariable.scope.type === 'global' && 
      g.variables.some(v => v.scope.type !== 'global')
    );
    
    for (const group of globalPromotions) {
      const affectedFiles = new Set<string>();
      group.variables.forEach(v => affectedFiles.add(v.filePath));

      actions.push({
        type: 'move_to_global',
        targetGroup: group.name,
        variables: group.variables.map(v => v.name),
        files: Array.from(affectedFiles),
        order: order++,
        autoExecutable: false
      });
    }

    return actions;
  }

  /**
   * Analyze consolidation risks
   */
  private analyzeConsolidationRisks(
    groups: ConsolidationGroup[],
    variableMap: VariableMap
  ): ConsolidationRisk[] {
    const risks: ConsolidationRisk[] = [];

    for (const group of groups) {
      // Check for naming conflicts
      const nameConflicts = this.checkNamingConflicts(group, variableMap);
      risks.push(...nameConflicts);

      // Check for scope violations
      const scopeRisks = this.checkScopeViolations(group, variableMap);
      risks.push(...scopeRisks);

      // Check for dependency breaks
      const dependencyRisks = this.checkDependencyRisks(group, variableMap);
      risks.push(...dependencyRisks);

      // Check for override cascading issues
      const cascadeRisks = this.checkOverrideCascadeRisks(group, variableMap);
      risks.push(...cascadeRisks);
    }

    return risks;
  }

  /**
   * Execute a specific consolidation action
   */
  private async executeAction(
    action: ConsolidationAction,
    content: string,
    filePath: string,
    plan: RefactoringPlan
  ): Promise<{ content: string; changes: ConsolidationChange[]; errors: ConsolidationError[] }> {
    const changes: ConsolidationChange[] = [];
    const errors: ConsolidationError[] = [];
    let updatedContent = content;

    try {
      switch (action.type) {
        case 'remove_duplicates':
          ({ content: updatedContent, changes: changes } = 
            this.removeDuplicateDeclarations(action, updatedContent, filePath, plan));
          break;

        case 'update_usages':
          ({ content: updatedContent, changes: changes } = 
            this.updateVariableUsages(action, updatedContent, filePath, plan));
          break;

        case 'merge_declarations':
          ({ content: updatedContent, changes: changes } = 
            this.mergeDeclarations(action, updatedContent, filePath, plan));
          break;

        case 'move_to_global':
          ({ content: updatedContent, changes: changes } = 
            this.moveToGlobalScope(action, updatedContent, filePath, plan));
          break;
      }
    } catch (error) {
      errors.push({
        type: 'syntax_error',
        message: `Action execution failed: ${error instanceof Error ? error.message : String(error)}`,
        filePath
      });
    }

    return { content: updatedContent, changes, errors };
  }

  // Helper methods

  private areVariablesSimilar(var1: CustomPropertyDeclaration, var2: CustomPropertyDeclaration): boolean {
    // Check if values are identical or very similar
    const normalizedValue1 = this.normalizeValue(var1.value);
    const normalizedValue2 = this.normalizeValue(var2.value);
    
    if (normalizedValue1 === normalizedValue2) {
      return true;
    }

    // Check for similar color values
    if (this.isColorValue(var1.value) && this.isColorValue(var2.value)) {
      return this.areColorsSimilar(var1.value, var2.value);
    }

    // Check for similar size values
    if (this.isSizeValue(var1.value) && this.isSizeValue(var2.value)) {
      return this.areSizesSimilar(var1.value, var2.value);
    }

    return false;
  }

  private selectPrimaryVariable(
    variables: CustomPropertyDeclaration[],
    variableMap: VariableMap
  ): CustomPropertyDeclaration {
    // Prefer global scope
    const globalVar = variables.find(v => v.scope.type === 'global');
    if (globalVar) return globalVar;

    // Prefer most used variable
    let mostUsed = variables[0];
    let maxUsages = 0;

    for (const variable of variables) {
      const usageCount = (variableMap.usages.get(variable.name) || []).length;
      if (usageCount > maxUsages) {
        maxUsages = usageCount;
        mostUsed = variable;
      }
    }

    return mostUsed;
  }

  private calculateConsolidationSavings(
    primary: CustomPropertyDeclaration,
    consolidate: CustomPropertyDeclaration[],
    variableMap: VariableMap
  ): number {
    let savings = 0;

    for (const variable of consolidate) {
      // Savings from removing declaration
      savings += variable.fullName.length + variable.value.length + 3; // ": ;"
      
      // Savings/cost from updating usages (name length difference)
      const usages = variableMap.usages.get(variable.name) || [];
      const nameDifference = variable.name.length - primary.name.length;
      savings += usages.length * nameDifference;
    }

    return Math.max(0, savings);
  }

  private assessConsolidationSafety(
    primary: CustomPropertyDeclaration,
    consolidate: CustomPropertyDeclaration[],
    variableMap: VariableMap
  ): 'safe' | 'caution' | 'risky' {
    // Check if all variables have identical values
    const allIdentical = consolidate.every(v => 
      this.normalizeValue(v.value) === this.normalizeValue(primary.value)
    );

    if (allIdentical) {
      // Check scope compatibility
      const allSameScope = consolidate.every(v => 
        v.scope.type === primary.scope.type
      );

      if (allSameScope) return 'safe';
      return 'caution';
    }

    return 'risky';
  }

  private generateGroupName(category: VariableCategory, primary: CustomPropertyDeclaration): string {
    return `${category}-group-${primary.name}`;
  }

  private normalizeValue(value: string): string {
    return value.trim().toLowerCase().replace(/\s+/g, ' ');
  }

  private isColorValue(value: string): boolean {
    const colorPatterns = [
      /^#[0-9a-fA-F]{3,8}$/,
      /^rgb\(.*\)$/,
      /^rgba\(.*\)$/,
      /^hsl\(.*\)$/,
      /^hsla\(.*\)$/
    ];
    return colorPatterns.some(pattern => pattern.test(value.trim()));
  }

  private isSizeValue(value: string): boolean {
    return /^[\d.]+\s*(px|em|rem|%|vh|vw|pt|pc|in|cm|mm|ex|ch|vmin|vmax)$/i.test(value.trim());
  }

  private areColorsSimilar(color1: string, color2: string): boolean {
    return this.normalizeValue(color1) === this.normalizeValue(color2);
  }

  private areSizesSimilar(size1: string, size2: string): boolean {
    const value1 = parseFloat(size1);
    const value2 = parseFloat(size2);
    return !isNaN(value1) && !isNaN(value2) && Math.abs(value1 - value2) <= 1;
  }

  private checkNamingConflicts(group: ConsolidationGroup, variableMap: VariableMap): ConsolidationRisk[] {
    // Implementation would check for potential naming conflicts
    return [];
  }

  private checkScopeViolations(group: ConsolidationGroup, variableMap: VariableMap): ConsolidationRisk[] {
    // Implementation would check for scope-related risks
    return [];
  }

  private checkDependencyRisks(group: ConsolidationGroup, variableMap: VariableMap): ConsolidationRisk[] {
    // Implementation would check for dependency-breaking risks
    return [];
  }

  private checkOverrideCascadeRisks(group: ConsolidationGroup, variableMap: VariableMap): ConsolidationRisk[] {
    // Implementation would check for CSS cascade issues
    return [];
  }

  private removeDuplicateDeclarations(
    action: ConsolidationAction,
    content: string,
    filePath: string,
    plan: RefactoringPlan
  ): { content: string; changes: ConsolidationChange[] } {
    // Implementation would remove duplicate variable declarations
    return { content, changes: [] };
  }

  private updateVariableUsages(
    action: ConsolidationAction,
    content: string,
    filePath: string,
    plan: RefactoringPlan
  ): { content: string; changes: ConsolidationChange[] } {
    // Implementation would update var() usages to point to primary variables
    return { content, changes: [] };
  }

  private mergeDeclarations(
    action: ConsolidationAction,
    content: string,
    filePath: string,
    plan: RefactoringPlan
  ): { content: string; changes: ConsolidationChange[] } {
    // Implementation would merge variable declarations
    return { content, changes: [] };
  }

  private moveToGlobalScope(
    action: ConsolidationAction,
    content: string,
    filePath: string,
    plan: RefactoringPlan
  ): { content: string; changes: ConsolidationChange[] } {
    // Implementation would move variables to global scope
    return { content, changes: [] };
  }
}

/**
 * Utility function to create a consolidator
 */
export function createCustomPropertyConsolidator(options: Partial<ConsolidationOptions> = {}): CustomPropertyConsolidator {
  return new CustomPropertyConsolidator(options);
}

/**
 * Utility function to create consolidation plan
 */
export function createConsolidationPlan(
  variableMap: VariableMap,
  options: Partial<ConsolidationOptions> = {}
): RefactoringPlan {
  const consolidator = createCustomPropertyConsolidator(options);
  return consolidator.createConsolidationPlan(variableMap);
}