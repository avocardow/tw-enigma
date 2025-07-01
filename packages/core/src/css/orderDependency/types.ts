/**
 * Core types and interfaces for CSS Order Dependency Handling
 */

/**
 * Represents a CSS rule with all relevant information for order analysis
 */
export interface CSSRule {
  /** Unique identifier for the rule */
  id: string;
  /** CSS selector text */
  selector: string;
  /** CSS declarations within the rule */
  declarations: Record<string, string> | CSSDeclaration[];
  /** Original line number in source file */
  lineNumber: number;
  /** Source file path */
  sourceFile: string;
  /** Parent rule (for nested rules) */
  parent?: CSSRule;
  /** Rule type (style, media, supports, etc.) */
  type: RuleType;
  /** Media query text if applicable */
  mediaQuery?: string;
  /** Layer name if applicable (@layer) */
  layer?: string;
  /** Importance level (!important) */
  important: boolean;
  /** CSS origin (user-agent, user, author) */
  origin?: 'user-agent' | 'user' | 'author';
}

/**
 * Individual CSS declaration (property: value)
 */
export interface CSSDeclaration {
  /** CSS property name */
  property: string;
  /** CSS property value */
  value: string;
  /** Whether this declaration has !important */
  important: boolean;
  /** Source location info */
  sourceLocation?: SourceLocation;
}

/**
 * Source location information
 */
export interface SourceLocation {
  line: number;
  column: number;
  file: string;
}

/**
 * Types of CSS rules
 */
export enum RuleType {
  STYLE = 'style',
  MEDIA = 'media',
  SUPPORTS = 'supports',
  IMPORT = 'import',
  KEYFRAMES = 'keyframes',
  FONT_FACE = 'font-face',
  PAGE = 'page',
  NAMESPACE = 'namespace',
  LAYER = 'layer',
  INLINE = 'inline',
}

/**
 * Rule order information and constraints
 */
export interface RuleOrder {
  /** Rule identifier */
  ruleId: string;
  /** Original position in stylesheet */
  originalIndex: number;
  /** Current position after any reordering */
  currentIndex: number;
  /** Whether this rule's order is critical */
  orderCritical: boolean;
  /** Rules that must come before this one */
  mustComeBefore: string[];
  /** Rules that must come after this one */
  mustComeAfter: string[];
  /** Group identifier for related rules */
  groupId?: string;
}

/**
 * CSS specificity information
 */
export interface SpecificityInfo {
  /** Rule identifier */
  ruleId: string;
  /** Specificity values [inline, ids, classes, elements] */
  specificity: [number, number, number, number];
  /** Total specificity weight */
  weight: number;
  /** Whether rule has !important */
  hasImportant: boolean;
  /** Layer priority (higher number = higher priority) */
  layerPriority: number;
  /** Specificity level classification */
  level: SpecificityLevel;
  /** Whether this is an inline style */
  isInline: boolean;
  /** Breakdown of specificity components */
  components: SpecificityComponents;
  /** Time taken to calculate (ms) */
  calculationTime: number;
  /** Error message if calculation failed */
  error?: string;
}

/**
 * Specificity level classification
 */
export enum SpecificityLevel {
  INLINE = 'inline',
  ID = 'id',
  CLASS = 'class',
  ELEMENT = 'element',
  UNIVERSAL = 'universal',
}

/**
 * Breakdown of specificity components
 */
export interface SpecificityComponents {
  ids: string[];
  classes: string[];
  attributes: string[];
  pseudoClasses: string[];
  elements: string[];
  pseudoElements: string[];
  universal: boolean;
}

/**
 * Specificity conflict information
 */
export interface SpecificityConflict {
  /** First rule ID */
  rule1Id: string;
  /** Second rule ID */
  rule2Id: string;
  /** Target element/selector */
  target: string;
  /** First rule specificity */
  rule1Specificity: SpecificityInfo;
  /** Second rule specificity */
  rule2Specificity: SpecificityInfo;
  /** Conflict severity */
  severity: ConflictSeverity;
  /** Reason for conflict */
  reason: string;
  /** Properties that conflict */
  conflictingProperties: string[];
  /** Recommendation for resolution */
  recommendation: string;
}

/**
 * Dependency relationship between CSS rules
 */
export interface RuleDependency {
  /** Source rule ID */
  from: string;
  /** Target rule ID */
  to: string;
  /** Type of dependency */
  type: DependencyType;
  /** Reason for the dependency */
  reason: string;
  /** Severity of breaking this dependency */
  severity: ConflictSeverity;
  /** Properties involved in the dependency */
  properties: string[];
}

/**
 * Types of rule dependencies
 */
export enum DependencyType {
  /** Rule overrides another due to specificity */
  OVERRIDE = 'override',
  /** Rule cascades from another */
  CASCADE = 'cascade',
  /** Rule resets properties set by another */
  RESET = 'reset',
  /** Rule provides fallback for another */
  FALLBACK = 'fallback',
  /** Rules must maintain relative order */
  ORDER_DEPENDENT = 'order-dependent',
  /** Rule inherits from another */
  INHERITANCE = 'inheritance',
}

/**
 * Dependency graph representing rule relationships
 */
export interface DependencyGraph {
  /** All rules in the graph */
  rules: Map<string, CSSRule>;
  /** Dependencies between rules */
  dependencies: RuleDependency[];
  /** Topologically sorted rule order */
  sortedOrder: string[];
  /** Circular dependencies detected */
  circularDependencies: string[][];
  /** Rules that can be safely reordered */
  reorderableRules: string[];
}

/**
 * Order constraint for CSS rules
 */
export interface OrderConstraint {
  /** Constraint identifier */
  id: string;
  /** Type of constraint */
  type: ConstraintType;
  /** Rules affected by this constraint */
  ruleIds: string[];
  /** Human-readable description */
  description: string;
  /** Whether constraint can be violated */
  flexible: boolean;
  /** Priority of this constraint */
  priority: number;
}

/**
 * Types of order constraints
 */
export enum ConstraintType {
  /** Rules must maintain exact order */
  STRICT_ORDER = 'strict-order',
  /** Rules must be grouped together */
  GROUP_TOGETHER = 'group-together',
  /** Rule must come before others */
  BEFORE = 'before',
  /** Rule must come after others */
  AFTER = 'after',
  /** Rules cannot be reordered */
  NO_REORDER = 'no-reorder',
}

/**
 * Result of reordering analysis
 */
export interface ReorderingResult {
  /** Original rule order */
  originalOrder: string[];
  /** Proposed new order */
  newOrder: string[];
  /** Rules that were moved */
  movedRules: string[];
  /** Conflicts detected during reordering */
  conflicts: ConflictReport[];
  /** Optimization benefits gained */
  benefits: OptimizationBenefit[];
  /** Whether reordering is safe */
  isSafe: boolean;
  /** Performance metrics */
  metrics: ReorderingMetrics;
}

/**
 * Optimization benefit from reordering
 */
export interface OptimizationBenefit {
  /** Type of benefit */
  type: BenefitType;
  /** Quantified benefit amount */
  amount: number;
  /** Description of the benefit */
  description: string;
  /** Rules involved in this benefit */
  affectedRules: string[];
}

/**
 * Types of optimization benefits
 */
export enum BenefitType {
  /** Reduced CSS file size */
  SIZE_REDUCTION = 'size-reduction',
  /** Improved grouping for compression */
  GROUPING = 'grouping',
  /** Better caching potential */
  CACHING = 'caching',
  /** Reduced specificity conflicts */
  SPECIFICITY = 'specificity',
}

/**
 * Performance metrics for reordering
 */
export interface ReorderingMetrics {
  /** Processing time in milliseconds */
  processingTime: number;
  /** Memory usage in bytes */
  memoryUsage: number;
  /** Number of rules analyzed */
  rulesAnalyzed: number;
  /** Number of dependencies found */
  dependenciesFound: number;
  /** Cache hit rate */
  cacheHitRate: number;
}

/**
 * Conflict report for order/specificity issues
 */
export interface ConflictReport {
  /** Unique conflict identifier */
  id: string;
  /** Type of conflict */
  type: ConflictType;
  /** Severity level */
  severity: ConflictSeverity;
  /** Rules involved in the conflict */
  involvedRules: string[];
  /** Human-readable description */
  description: string;
  /** Suggested resolution */
  suggestion?: string;
  /** Whether conflict can be auto-resolved */
  autoResolvable: boolean;
  /** Source location of the conflict */
  location: SourceLocation;
}

/**
 * Types of conflicts
 */
export enum ConflictType {
  /** Specificity conflict */
  SPECIFICITY_CONFLICT = 'specificity-conflict',
  /** Order dependency violation */
  ORDER_VIOLATION = 'order-violation',
  /** Circular dependency */
  CIRCULAR_DEPENDENCY = 'circular-dependency',
  /** Cascade interference */
  CASCADE_INTERFERENCE = 'cascade-interference',
  /** Inheritance conflict */
  INHERITANCE_CONFLICT = 'inheritance-conflict',
}

/**
 * Severity levels for conflicts
 */
export enum ConflictSeverity {
  /** Will definitely break styling */
  CRITICAL = 'critical',
  /** Likely to cause issues */
  HIGH = 'high',
  /** May cause minor issues */
  MEDIUM = 'medium',
  /** Unlikely to cause issues */
  LOW = 'low',
  /** Informational only */
  INFO = 'info',
}

/**
 * Configuration options for order handling
 */
export interface OrderHandlingOptions {
  /** Strictness level for order preservation */
  strictness: StrictnessLevel;
  /** Enable dependency detection */
  enableDependencyDetection: boolean;
  /** Enable automatic conflict resolution */
  enableAutoResolution: boolean;
  /** Maximum processing time in milliseconds */
  maxProcessingTime: number;
  /** Enable caching for performance */
  enableCaching: boolean;
  /** Cache size limit */
  cacheSize: number;
  /** Report format preferences */
  reportFormat: ReportFormat[];
  /** Properties to ignore in analysis */
  ignoredProperties: string[];
  /** Selectors to always preserve order */
  preserveOrderSelectors: string[];
  /** Enable parallel processing */
  enableParallelProcessing: boolean;
  /** Batch size for processing rules */
  batchSize?: number;
}

/**
 * Strictness levels
 */
export enum StrictnessLevel {
  /** Maximum optimization, minimal order preservation */
  PERMISSIVE = 'permissive',
  /** Balanced approach */
  BALANCED = 'balanced',
  /** Conservative reordering */
  STRICT = 'strict',
  /** No reordering allowed */
  PRESERVE_ALL = 'preserve-all',
}

/**
 * Report output formats
 */
export enum ReportFormat {
  CONSOLE = 'console',
  JSON = 'json',
  HTML = 'html',
  MARKDOWN = 'markdown',
}
