/**
 * CSS Custom Property Preservation and Scope Management
 * 
 * Ensures essential variables are preserved and scoped correctly,
 * preventing accidental overrides or loss of critical custom properties
 * while enforcing best practices for variable scope management.
 */

import type { 
  VariableMap, 
  CustomPropertyDeclaration, 
  CustomPropertyUsage,
  PropertyScope 
} from './customPropertyDetector.js';
import type { ConsolidationGroup, RefactoringPlan } from './customPropertyConsolidator.js';

export interface PreservationRule {
  /** Rule name */
  name: string;
  /** Rule description */
  description: string;
  /** Rule type */
  type: 'preserve' | 'scope_check' | 'shadow_warning' | 'usage_protection';
  /** Variables to preserve */
  preserveVariables?: string[];
  /** Scope patterns to protect */
  protectedScopes?: string[];
  /** Conditions for applying the rule */
  conditions: PreservationCondition[];
}

export interface PreservationCondition {
  /** Condition type */
  type: 'usage_count' | 'scope_type' | 'name_pattern' | 'value_pattern' | 'theme_variable' | 'accessibility';
  /** Condition parameters */
  params: Record<string, any>;
  /** Minimum match threshold */
  threshold?: number;
}

export interface ScopeViolation {
  /** Violation type */
  type: 'shadow' | 'override' | 'scope_leak' | 'naming_conflict' | 'cascading_issue';
  /** Severity level */
  severity: 'error' | 'warning' | 'info';
  /** Violation message */
  message: string;
  /** Primary variable involved */
  primaryVariable: string;
  /** Secondary variable if applicable */
  secondaryVariable?: string;
  /** File paths affected */
  files: string[];
  /** Recommended fix */
  recommendedFix?: string;
  /** Auto-fixable flag */
  autoFixable: boolean;
}

export interface PreservationReport {
  /** Variables protected from modification */
  protectedVariables: string[];
  /** Scope violations found */
  violations: ScopeViolation[];
  /** Variables that should be preserved but aren't protected */
  unprotectedCritical: string[];
  /** Suggestions for scope improvements */
  scopeOptimizations: ScopeOptimization[];
  /** Rollback information */
  rollbackInfo: RollbackInfo;
}

export interface ScopeOptimization {
  /** Optimization type */
  type: 'promote_to_global' | 'localize_scope' | 'consolidate_scopes' | 'rename_for_clarity';
  /** Variable name */
  variable: string;
  /** Current scope */
  currentScope: PropertyScope;
  /** Recommended scope */
  recommendedScope: PropertyScope;
  /** Reason for recommendation */
  reason: string;
  /** Estimated benefit */
  benefit: 'performance' | 'maintainability' | 'clarity' | 'compatibility';
}

export interface RollbackInfo {
  /** Rollback checkpoint ID */
  checkpointId: string;
  /** Original file states */
  originalStates: Map<string, string>;
  /** Changes made */
  changeLog: ChangeRecord[];
  /** Rollback instructions */
  rollbackInstructions: RollbackInstruction[];
}

export interface ChangeRecord {
  /** Change ID */
  id: string;
  /** Timestamp */
  timestamp: string;
  /** File path */
  filePath: string;
  /** Change type */
  type: 'variable_removed' | 'variable_modified' | 'scope_changed' | 'usage_updated';
  /** Original content */
  before: string;
  /** New content */
  after: string;
  /** Variable name affected */
  variableName: string;
}

export interface RollbackInstruction {
  /** Instruction type */
  type: 'restore_file' | 'restore_variable' | 'restore_scope';
  /** Target file or variable */
  target: string;
  /** Restoration content */
  content: string;
  /** Execution order */
  order: number;
}

export interface PreservationOptions {
  /** Enable automatic protection of theme variables */
  protectThemeVariables: boolean;
  /** Enable automatic protection of accessibility variables */
  protectAccessibilityVariables: boolean;
  /** Minimum usage count for automatic protection */
  protectionThreshold: number;
  /** Enable scope violation warnings */
  enableScopeWarnings: boolean;
  /** Enable rollback functionality */
  enableRollback: boolean;
  /** Custom preservation rules */
  customRules: PreservationRule[];
  /** Protected variable patterns */
  protectedPatterns: string[];
}

export class CustomPropertyPreserver {
  private options: PreservationOptions;
  private defaultRules: PreservationRule[];

  constructor(options: Partial<PreservationOptions> = {}) {
    this.options = {
      protectThemeVariables: true,
      protectAccessibilityVariables: true,
      protectionThreshold: 3,
      enableScopeWarnings: true,
      enableRollback: true,
      customRules: [],
      protectedPatterns: [
        'theme-*',
        'color-*',
        'font-*',
        'size-*',
        'spacing-*',
        'z-index-*',
        'duration-*',
        'ease-*',
        'breakpoint-*'
      ],
      ...options
    };

    this.defaultRules = this.createDefaultRules();
  }

  /**
   * Analyze variable map for preservation needs
   */
  analyzePreservation(variableMap: VariableMap): PreservationReport {
    const protectedVariables = this.identifyProtectedVariables(variableMap);
    const violations = this.detectScopeViolations(variableMap);
    const unprotectedCritical = this.findUnprotectedCriticalVariables(variableMap, protectedVariables);
    const scopeOptimizations = this.generateScopeOptimizations(variableMap);
    const rollbackInfo = this.prepareRollbackInfo();

    return {
      protectedVariables,
      violations,
      unprotectedCritical,
      scopeOptimizations,
      rollbackInfo
    };
  }

  /**
   * Validate consolidation plan against preservation rules
   */
  validateConsolidationPlan(
    plan: RefactoringPlan,
    variableMap: VariableMap
  ): { valid: boolean; violations: ScopeViolation[]; blockedActions: string[] } {
    const violations: ScopeViolation[] = [];
    const blockedActions: string[] = [];
    const protectedVariables = this.identifyProtectedVariables(variableMap);

    for (const group of plan.groups) {
      // Check if any protected variables are being modified
      const protectedInGroup = group.consolidateVariables.filter(v => 
        protectedVariables.includes(v.name)
      );

      if (protectedInGroup.length > 0) {
        violations.push({
          type: 'override',
          severity: 'error',
          message: `Consolidation would modify protected variables: ${protectedInGroup.map(v => v.name).join(', ')}`,
          primaryVariable: group.primaryVariable.name,
          files: protectedInGroup.map(v => v.filePath),
          recommendedFix: 'Exclude protected variables from consolidation',
          autoFixable: true
        });
      }

      // Check for scope violations in the consolidation
      const scopeViolations = this.checkGroupScopeViolations(group, variableMap);
      violations.push(...scopeViolations);
    }

    for (const action of plan.actions) {
      const protectedInAction = action.variables.filter(v => 
        protectedVariables.includes(v)
      );

      if (protectedInAction.length > 0) {
        blockedActions.push(action.targetGroup);
      }
    }

    return {
      valid: violations.filter(v => v.severity === 'error').length === 0,
      violations,
      blockedActions
    };
  }

  /**
   * Apply preservation rules to protect variables
   */
  applyPreservationRules(
    variableMap: VariableMap,
    plan: RefactoringPlan
  ): RefactoringPlan {
    const protectedVariables = this.identifyProtectedVariables(variableMap);
    
    // Filter out protected variables from consolidation groups
    const filteredGroups = plan.groups.map(group => {
      const safeConsolidateVariables = group.consolidateVariables.filter(v => 
        !protectedVariables.includes(v.name)
      );

      return {
        ...group,
        consolidateVariables: safeConsolidateVariables,
        estimatedSavings: this.recalculateSavings(group, safeConsolidateVariables.length)
      };
    }).filter(group => group.consolidateVariables.length > 0);

    // Filter out blocked actions
    const safeActions = plan.actions.filter(action => {
      const hasProtectedVariables = action.variables.some(v => 
        protectedVariables.includes(v)
      );
      return !hasProtectedVariables;
    });

    return {
      ...plan,
      groups: filteredGroups,
      actions: safeActions,
      totalSavings: filteredGroups.reduce((sum, group) => sum + group.estimatedSavings, 0)
    };
  }

  /**
   * Create rollback checkpoint
   */
  createRollbackCheckpoint(fileContents: Map<string, string>): string {
    const checkpointId = `checkpoint_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    if (this.options.enableRollback) {
      // In a real implementation, this would persist the checkpoint
      console.log(`Created rollback checkpoint: ${checkpointId}`);
    }

    return checkpointId;
  }

  /**
   * Execute rollback to checkpoint
   */
  async executeRollback(
    checkpointId: string,
    rollbackInfo: RollbackInfo
  ): Promise<{ success: boolean; restoredFiles: string[]; errors: string[] }> {
    const restoredFiles: string[] = [];
    const errors: string[] = [];

    try {
      // Sort instructions by execution order
      const sortedInstructions = rollbackInfo.rollbackInstructions.sort((a, b) => a.order - b.order);

      for (const instruction of sortedInstructions) {
        try {
          switch (instruction.type) {
            case 'restore_file':
              // In a real implementation, would restore file content
              restoredFiles.push(instruction.target);
              break;
            case 'restore_variable':
              // In a real implementation, would restore specific variable
              break;
            case 'restore_scope':
              // In a real implementation, would restore scope changes
              break;
          }
        } catch (error) {
          errors.push(`Failed to execute rollback instruction for ${instruction.target}: ${error instanceof Error ? error.message : String(error)}`);
        }
      }

      return {
        success: errors.length === 0,
        restoredFiles,
        errors
      };
    } catch (error) {
      return {
        success: false,
        restoredFiles,
        errors: [`Rollback failed: ${error instanceof Error ? error.message : String(error)}`]
      };
    }
  }

  // Helper methods

  private createDefaultRules(): PreservationRule[] {
    return [
      {
        name: 'Protect Theme Variables',
        description: 'Preserve variables used for theme switching',
        type: 'preserve',
        conditions: [
          {
            type: 'name_pattern',
            params: { patterns: ['*theme*', '*dark*', '*light*', '*mode*'] }
          }
        ]
      },
      {
        name: 'Protect Accessibility Variables',
        description: 'Preserve variables important for accessibility',
        type: 'preserve',
        conditions: [
          {
            type: 'name_pattern',
            params: { patterns: ['*focus*', '*contrast*', '*a11y*', '*accessibility*'] }
          }
        ]
      },
      {
        name: 'Protect High-Usage Variables',
        description: 'Preserve frequently used variables',
        type: 'preserve',
        conditions: [
          {
            type: 'usage_count',
            params: { minUsages: this.options.protectionThreshold }
          }
        ]
      },
      {
        name: 'Warn About Variable Shadowing',
        description: 'Detect variables that shadow others',
        type: 'shadow_warning',
        conditions: [
          {
            type: 'scope_type',
            params: { allowedShadowing: false }
          }
        ]
      },
      {
        name: 'Global Scope Best Practices',
        description: 'Enforce global scope usage patterns',
        type: 'scope_check',
        protectedScopes: [':root'],
        conditions: [
          {
            type: 'scope_type',
            params: { enforceGlobalForCommon: true }
          }
        ]
      }
    ];
  }

  private identifyProtectedVariables(variableMap: VariableMap): string[] {
    const protected: Set<string> = new Set();
    const allRules = [...this.defaultRules, ...this.options.customRules];

    for (const [variableName, declarations] of variableMap.declarations) {
      for (const rule of allRules) {
        if (rule.type === 'preserve' && this.matchesRule(variableName, declarations, variableMap, rule)) {
          protected.add(variableName);
          break;
        }
      }

      // Check against protected patterns
      for (const pattern of this.options.protectedPatterns) {
        if (this.matchesPattern(variableName, pattern)) {
          protected.add(variableName);
          break;
        }
      }
    }

    return Array.from(protected);
  }

  private detectScopeViolations(variableMap: VariableMap): ScopeViolation[] {
    const violations: ScopeViolation[] = [];

    // Check for variable shadowing
    const shadowViolations = this.detectVariableShadowing(variableMap);
    violations.push(...shadowViolations);

    // Check for naming conflicts
    const namingViolations = this.detectNamingConflicts(variableMap);
    violations.push(...namingViolations);

    // Check for scope leaks
    const scopeLeaks = this.detectScopeLeaks(variableMap);
    violations.push(...scopeLeaks);

    // Check for cascading issues
    const cascadingIssues = this.detectCascadingIssues(variableMap);
    violations.push(...cascadingIssues);

    return violations;
  }

  private detectVariableShadowing(variableMap: VariableMap): ScopeViolation[] {
    const violations: ScopeViolation[] = [];

    for (const [variableName, declarations] of variableMap.declarations) {
      if (declarations.length <= 1) continue;

      // Group by scope hierarchy to detect shadowing
      const scopeGroups = this.groupByHierarchy(declarations);
      
      for (const [parentScope, childScopes] of scopeGroups) {
        if (childScopes.length > 0) {
          violations.push({
            type: 'shadow',
            severity: 'warning',
            message: `Variable --${variableName} is shadowed in nested scopes`,
            primaryVariable: variableName,
            files: [parentScope.filePath, ...childScopes.map(s => s.filePath)],
            recommendedFix: `Consider using different variable names or consolidating scopes`,
            autoFixable: false
          });
        }
      }
    }

    return violations;
  }

  private detectNamingConflicts(variableMap: VariableMap): ScopeViolation[] {
    const violations: ScopeViolation[] = [];

    for (const conflict of variableMap.scopeConflicts) {
      violations.push({
        type: 'naming_conflict',
        severity: 'error',
        message: `Variable --${conflict.name} has conflicting declarations`,
        primaryVariable: conflict.name,
        files: conflict.declarations.map(d => d.filePath),
        recommendedFix: 'Rename one of the conflicting variables or consolidate their scopes',
        autoFixable: false
      });
    }

    return violations;
  }

  private detectScopeLeaks(variableMap: VariableMap): ScopeViolation[] {
    const violations: ScopeViolation[] = [];

    for (const [variableName, usages] of variableMap.usages) {
      const declarations = variableMap.declarations.get(variableName);
      if (!declarations) continue;

      // Check if variable is used outside its declared scope
      for (const usage of usages) {
        const accessibleDeclarations = this.findAccessibleDeclarations(usage, declarations);
        
        if (accessibleDeclarations.length === 0) {
          violations.push({
            type: 'scope_leak',
            severity: 'error',
            message: `Variable --${variableName} used outside its scope in ${usage.filePath}`,
            primaryVariable: variableName,
            files: [usage.filePath],
            recommendedFix: 'Move variable to a common parent scope or create a local declaration',
            autoFixable: false
          });
        }
      }
    }

    return violations;
  }

  private detectCascadingIssues(variableMap: VariableMap): ScopeViolation[] {
    const violations: ScopeViolation[] = [];

    // Check for variables that might cause unexpected cascading
    for (const [variableName, declarations] of variableMap.declarations) {
      const globalDeclaration = declarations.find(d => d.scope.type === 'global');
      const localDeclarations = declarations.filter(d => d.scope.type !== 'global');

      if (globalDeclaration && localDeclarations.length > 0) {
        violations.push({
          type: 'cascading_issue',
          severity: 'info',
          message: `Variable --${variableName} has both global and local declarations, may cause unexpected cascading`,
          primaryVariable: variableName,
          files: declarations.map(d => d.filePath),
          recommendedFix: 'Consider using different names for global and local variants',
          autoFixable: false
        });
      }
    }

    return violations;
  }

  private findUnprotectedCriticalVariables(
    variableMap: VariableMap,
    protectedVariables: string[]
  ): string[] {
    const critical: string[] = [];

    for (const [variableName, usages] of variableMap.usages) {
      if (protectedVariables.includes(variableName)) continue;

      // Consider high-usage variables as critical
      if (usages.length >= this.options.protectionThreshold * 2) {
        critical.push(variableName);
        continue;
      }

      // Consider variables used in important contexts as critical
      const hasImportantUsage = usages.some(usage => 
        this.isImportantContext(usage)
      );

      if (hasImportantUsage) {
        critical.push(variableName);
      }
    }

    return critical;
  }

  private generateScopeOptimizations(variableMap: VariableMap): ScopeOptimization[] {
    const optimizations: ScopeOptimization[] = [];

    for (const [variableName, declarations] of variableMap.declarations) {
      const usages = variableMap.usages.get(variableName) || [];
      
      // Suggest global promotion for widely used variables
      if (usages.length >= this.options.protectionThreshold && 
          !declarations.some(d => d.scope.type === 'global')) {
        
        const uniqueScopes = new Set(declarations.map(d => d.scope.identifier));
        
        if (uniqueScopes.size > 2) {
          optimizations.push({
            type: 'promote_to_global',
            variable: variableName,
            currentScope: declarations[0].scope,
            recommendedScope: {
              type: 'global',
              identifier: ':root',
              nestingLevel: 0,
              parentScopes: []
            },
            reason: `Variable used in ${uniqueScopes.size} different scopes`,
            benefit: 'maintainability'
          });
        }
      }

      // Suggest localization for unused global variables
      const globalDeclaration = declarations.find(d => d.scope.type === 'global');
      if (globalDeclaration && usages.length <= 1) {
        const usage = usages[0];
        if (usage) {
          optimizations.push({
            type: 'localize_scope',
            variable: variableName,
            currentScope: globalDeclaration.scope,
            recommendedScope: {
              type: 'component',
              identifier: usage.selector,
              nestingLevel: 1,
              parentScopes: []
            },
            reason: 'Variable only used in one location',
            benefit: 'performance'
          });
        }
      }
    }

    return optimizations;
  }

  private prepareRollbackInfo(): RollbackInfo {
    return {
      checkpointId: '',
      originalStates: new Map(),
      changeLog: [],
      rollbackInstructions: []
    };
  }

  private matchesRule(
    variableName: string,
    declarations: CustomPropertyDeclaration[],
    variableMap: VariableMap,
    rule: PreservationRule
  ): boolean {
    for (const condition of rule.conditions) {
      if (!this.matchesCondition(variableName, declarations, variableMap, condition)) {
        return false;
      }
    }
    return true;
  }

  private matchesCondition(
    variableName: string,
    declarations: CustomPropertyDeclaration[],
    variableMap: VariableMap,
    condition: PreservationCondition
  ): boolean {
    switch (condition.type) {
      case 'usage_count':
        const usages = variableMap.usages.get(variableName) || [];
        return usages.length >= (condition.params.minUsages || 1);

      case 'name_pattern':
        const patterns = condition.params.patterns || [];
        return patterns.some((pattern: string) => this.matchesPattern(variableName, pattern));

      case 'scope_type':
        return declarations.some(d => d.scope.type === condition.params.scopeType);

      case 'theme_variable':
        return this.isThemeVariable(variableName, declarations);

      case 'accessibility':
        return this.isAccessibilityVariable(variableName, declarations);

      default:
        return false;
    }
  }

  private matchesPattern(variableName: string, pattern: string): boolean {
    const regex = new RegExp(pattern.replace(/\*/g, '.*'), 'i');
    return regex.test(variableName);
  }

  private isThemeVariable(variableName: string, declarations: CustomPropertyDeclaration[]): boolean {
    const themePatterns = ['theme', 'dark', 'light', 'mode', 'color-scheme'];
    return themePatterns.some(pattern => variableName.toLowerCase().includes(pattern));
  }

  private isAccessibilityVariable(variableName: string, declarations: CustomPropertyDeclaration[]): boolean {
    const a11yPatterns = ['focus', 'contrast', 'a11y', 'accessibility', 'aria'];
    return a11yPatterns.some(pattern => variableName.toLowerCase().includes(pattern));
  }

  private checkGroupScopeViolations(
    group: ConsolidationGroup,
    variableMap: VariableMap
  ): ScopeViolation[] {
    const violations: ScopeViolation[] = [];

    // Check if consolidation would create scope violations
    for (const variable of group.consolidateVariables) {
      const usages = variableMap.usages.get(variable.name) || [];
      
      for (const usage of usages) {
        if (!this.isAccessibleFromScope(usage, group.primaryVariable.scope)) {
          violations.push({
            type: 'scope_leak',
            severity: 'error',
            message: `Consolidating --${variable.name} would make it inaccessible from ${usage.filePath}`,
            primaryVariable: group.primaryVariable.name,
            secondaryVariable: variable.name,
            files: [usage.filePath, group.primaryVariable.filePath],
            recommendedFix: 'Keep variable in original scope or move to common parent scope',
            autoFixable: false
          });
        }
      }
    }

    return violations;
  }

  private recalculateSavings(group: ConsolidationGroup, newVariableCount: number): number {
    // Simplified recalculation based on new variable count
    const ratio = newVariableCount / group.consolidateVariables.length;
    return Math.floor(group.estimatedSavings * ratio);
  }

  private groupByHierarchy(
    declarations: CustomPropertyDeclaration[]
  ): Map<CustomPropertyDeclaration, CustomPropertyDeclaration[]> {
    const hierarchy = new Map<CustomPropertyDeclaration, CustomPropertyDeclaration[]>();

    for (const declaration of declarations) {
      const children = declarations.filter(other => 
        other !== declaration && 
        this.isChildScope(declaration.scope, other.scope)
      );
      hierarchy.set(declaration, children);
    }

    return hierarchy;
  }

  private isChildScope(parent: PropertyScope, child: PropertyScope): boolean {
    if (parent.type === 'global' && child.type !== 'global') {
      return true;
    }
    
    return child.nestingLevel > parent.nestingLevel &&
           child.parentScopes.includes(parent.identifier);
  }

  private findAccessibleDeclarations(
    usage: CustomPropertyUsage,
    declarations: CustomPropertyDeclaration[]
  ): CustomPropertyDeclaration[] {
    return declarations.filter(declaration => 
      this.isAccessibleFromUsage(usage, declaration)
    );
  }

  private isAccessibleFromUsage(usage: CustomPropertyUsage, declaration: CustomPropertyDeclaration): boolean {
    // Global variables are accessible everywhere
    if (declaration.scope.type === 'global') {
      return true;
    }

    // Same file and compatible scope
    if (declaration.filePath === usage.filePath) {
      return this.isScopeCompatible(usage.selector, declaration.scope);
    }

    return false;
  }

  private isAccessibleFromScope(usage: CustomPropertyUsage, scope: PropertyScope): boolean {
    // Global scope is accessible everywhere
    if (scope.type === 'global') {
      return true;
    }

    // Check if usage location is compatible with the scope
    return this.isScopeCompatible(usage.selector, scope);
  }

  private isScopeCompatible(usageSelector: string, declarationScope: PropertyScope): boolean {
    // Simplified scope compatibility check
    if (declarationScope.type === 'global') {
      return true;
    }

    // Check if usage selector matches or is nested within declaration scope
    return usageSelector.includes(declarationScope.identifier) ||
           declarationScope.identifier.includes(usageSelector);
  }

  private isImportantContext(usage: CustomPropertyUsage): boolean {
    const importantProperties = [
      'color', 'background-color', 'border-color',
      'font-family', 'font-size', 'line-height',
      'z-index', 'position', 'display'
    ];

    return importantProperties.includes(usage.cssProperty);
  }
}

/**
 * Utility function to create a preserver
 */
export function createCustomPropertyPreserver(options: Partial<PreservationOptions> = {}): CustomPropertyPreserver {
  return new CustomPropertyPreserver(options);
}

/**
 * Utility function to analyze preservation needs
 */
export function analyzePreservation(
  variableMap: VariableMap,
  options: Partial<PreservationOptions> = {}
): PreservationReport {
  const preserver = createCustomPropertyPreserver(options);
  return preserver.analyzePreservation(variableMap);
}