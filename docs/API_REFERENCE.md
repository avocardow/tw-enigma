# TW-Enigma Framework Integration API Reference

## Overview

This comprehensive API reference covers all classes, interfaces, methods, and configuration options available in TW-Enigma's framework integration system, including responsive and pseudo-class optimization.

## Table of Contents

1. [Core Framework API](#core-framework-api)
2. [Framework Detection API](#framework-detection-api)
3. [Configuration Presets API](#configuration-presets-api)
4. [CSS-in-JS Integration API](#css-in-js-integration-api)
5. [SSR/SSG API](#ssrssg-api)
6. [Build System Integration API](#build-system-integration-api)
7. [Responsive & Pseudo-Class API](#responsive--pseudo-class-api)
8. [Configuration Schema](#configuration-schema)
9. [Plugin Development API](#plugin-development-api)
10. [Type Definitions](#type-definitions)
11. [Error Reference](#error-reference)

## Core Framework API

### TWEnigmaEngine

Main optimization engine for framework integration.

```typescript
class TWEnigmaEngine {
  constructor(config: TWEnigmaConfig);
  
  // Core optimization methods
  optimizeClasses(classes: string[]): Promise<OptimizationResult>;
  optimizeCSS(css: string): Promise<CSSOptimizationResult>;
  optimizeComponent(component: ComponentInfo): Promise<ComponentOptimizationResult>;
  
  // Framework-specific methods
  detectFramework(projectPath?: string): Promise<FrameworkInfo>;
  applyFrameworkOptimizations(framework: FrameworkType): void;
  
  // Configuration methods
  updateConfig(config: Partial<TWEnigmaConfig>): void;
  getConfig(): TWEnigmaConfig;
  validateConfig(): ValidationResult;
  
  // Cache management
  clearCache(): void;
  getCacheStats(): CacheStats;
  
  // Metrics and reporting
  getMetrics(): PerformanceMetrics;
  generateReport(): OptimizationReport;
}
```

#### Constructor Options

```typescript
interface TWEnigmaConfig {
  // Framework configuration
  framework?: FrameworkConfig;
  
  // Optimization settings
  optimization?: OptimizationConfig;
  
  // CSS-in-JS configuration
  cssInJs?: CSSInJSConfig;
  
  // SSR configuration
  ssr?: SSRConfig;
  
  // Cache settings
  cache?: CacheConfig;
  
  // Debug options
  debug?: DebugConfig;
}
```

#### Example Usage

```typescript
import { TWEnigmaEngine } from '@tw-enigma/core';

const engine = new TWEnigmaEngine({
  framework: {
    type: 'react',
    preset: 'react-nextjs',
  },
  optimization: {
    strategy: 'atomic',
    threshold: 2,
  },
  cache: {
    enabled: true,
    maxSize: 1000,
  },
});

// Optimize classes
const result = await engine.optimizeClasses([
  'bg-blue-500',
  'text-white',
  'hover:bg-blue-600',
]);

console.log('Optimized classes:', result.optimizedClasses);
```

## Framework Detection API

### FrameworkDetector

Automatic framework detection system.

```typescript
class FrameworkDetector {
  constructor(options?: FrameworkDetectorOptions);
  
  // Detection methods
  detect(projectPath: string): Promise<FrameworkInfo>;
  detectFromPackageJson(packageJson: PackageJson): FrameworkInfo;
  detectFromFiles(fileList: string[]): FrameworkInfo;
  
  // Configuration methods
  addCustomDetector(detector: CustomDetector): void;
  setConfidenceThreshold(threshold: number): void;
  
  // Utility methods
  getAvailableDetectors(): DetectorInfo[];
  clearCache(): void;
}
```

#### FrameworkInfo Interface

```typescript
interface FrameworkInfo {
  type: FrameworkType;
  confidence: number;
  metadata: {
    version?: string;
    buildSystem?: string;
    hasSSR?: boolean;
    hasTypeScript?: boolean;
    packageManager?: string;
    dependencies?: string[];
  };
  detectionSource: DetectionSource[];
  detectedBy: string[];
}
```

#### Example Usage

```typescript
import { FrameworkDetector } from '@tw-enigma/core';

const detector = new FrameworkDetector({
  confidenceThreshold: 0.8,
  enableCaching: true,
});

const frameworkInfo = await detector.detect('./my-project');
console.log(`Detected: ${frameworkInfo.type}`);
```

## Configuration Presets API

### ConfigPresetManager

Management system for framework configuration presets.

```typescript
class ConfigPresetManager {
  constructor(options?: PresetManagerOptions);
  
  // Preset retrieval
  getAvailablePresets(): ConfigPreset[];
  getFrameworkPresets(framework: FrameworkType): ConfigPreset[];
  getPreset(id: string): ConfigPreset | undefined;
  
  // Preset management
  registerPreset(preset: ConfigPreset): void;
  unregisterPreset(id: string): boolean;
  
  // Configuration creation
  createConfig(
    presetId: string,
    overrides?: ConfigOverride[],
    customConfig?: CustomConfig
  ): FrameworkConfig;
  
  // Recommendations
  recommendPreset(frameworkInfo: FrameworkInfo): ConfigPreset | null;
  
  // Validation
  validateConfig(config: FrameworkConfig): ValidationResult;
}
```

#### ConfigPreset Interface

```typescript
interface ConfigPreset {
  id: string;
  name: string;
  description: string;
  config: FrameworkConfig;
  framework: FrameworkType;
  supportedBuildSystems: string[];
  ssrCompatible: boolean;
  prerequisites: string[];
  recommendedCSSInJS: CSSInJSLibrary[];
  compatibility: {
    node: string[];
    packageManagers: string[];
    buildTools: string[];
  };
}
```

## CSS-in-JS Integration API

### CSSInJSProcessor

CSS-in-JS library integration and optimization.

```typescript
class CSSInJSProcessor {
  constructor(config: CSSInJSConfig);
  
  // Processing methods
  processStyledComponents(code: string): Promise<ProcessingResult>;
  processEmotion(code: string): Promise<ProcessingResult>;
  processStitches(code: string): Promise<ProcessingResult>;
  
  // Extraction methods
  extractStaticStyles(component: ComponentCode): Promise<StaticStylesResult>;
  extractThemeTokens(styles: string): Promise<ThemeTokensResult>;
  
  // Runtime optimization
  optimizeRuntimeStyles(styles: RuntimeStyles): OptimizedRuntimeStyles;
}
```

#### CSSInJSConfig Interface

```typescript
interface CSSInJSConfig {
  libraries: CSSInJSLibrary[];
  staticExtraction?: {
    enabled: boolean;
    strategy: 'build-time' | 'runtime' | 'hybrid';
    output: {
      directory: string;
      filename: string;
      sourceMap: boolean;
    };
  };
  runtime?: {
    optimization: {
      caching: boolean;
      batching: boolean;
      lazyLoading: boolean;
    };
  };
  styledComponents?: StyledComponentsConfig;
  emotion?: EmotionConfig;
}
```

## SSR/SSG API

### SSRProcessor

Server-side rendering optimization system.

```typescript
class SSRProcessor {
  constructor(config: SSRConfig);
  
  // Critical CSS extraction
  extractCriticalCSS(html: string, context: SSRContext): Promise<CriticalCSSResult>;
  
  // CSS injection
  injectCSS(html: string, css: string, options: InjectionOptions): string;
  
  // Streaming support
  createStreamProcessor(options: StreamOptions): SSRStreamProcessor;
  
  // Cache management
  getCachedCSS(key: string): string | null;
  setCachedCSS(key: string, css: string, ttl?: number): void;
}
```

#### SSRConfig Interface

```typescript
interface SSRConfig {
  criticalCSS?: {
    enabled: boolean;
    detection: {
      viewport: { width: number; height: number };
      aboveFold: boolean;
      components?: string[];
      routes?: Record<string, string[]>;
    };
    extraction: {
      removeUnused: boolean;
      minify: boolean;
      includeMediaQueries: boolean;
    };
  };
  injection?: {
    strategy: 'inline' | 'link' | 'hybrid';
    inlineCritical?: {
      enabled: boolean;
      maxSize: string;
      position: 'head' | 'body';
    };
  };
}
```

## Build System Integration API

### WebpackPlugin

TW-Enigma Webpack plugin.

```typescript
class TWEnigmaWebpackPlugin {
  constructor(options: WebpackPluginOptions);
  apply(compiler: Compiler): void;
}

interface WebpackPluginOptions {
  configFile?: string;
  include?: RegExp;
  exclude?: RegExp;
  cache?: boolean;
  parallel?: boolean;
  debug?: boolean;
}
```

### VitePlugin

TW-Enigma Vite plugin.

```typescript
function twEnigmaPlugin(options: VitePluginOptions): Plugin;

interface VitePluginOptions {
  configFile?: string;
  enforce?: 'pre' | 'post';
  css?: {
    preprocessorOptions?: {
      postcss?: {
        plugins: any[];
      };
    };
  };
}
```

## Responsive & Pseudo-Class API

## Core Classes

### ResponsiveOptimizationEngine

Main entry point for responsive optimization operations.

#### Constructor

```typescript
constructor(config: ResponsiveOptimizationConfig)
```

#### Methods

##### `optimizeClasses(classes: string[]): Promise<OptimizationResult>`

Optimizes an array of CSS classes using all configured optimization strategies.

**Parameters:**

- `classes`: Array of CSS class names to optimize

**Returns:** Promise resolving to `OptimizationResult`

**Example:**

```typescript
const engine = new ResponsiveOptimizationEngine({
  enablePseudoClassOptimization: true,
  enableBreakpointGrouping: true,
});

const result = await engine.optimizeClasses([
  'sm:text-red-500',
  'md:text-blue-500',
  'lg:hover:text-green-500',
]);
```

##### `analyzePatterns(patterns: string[]): Promise<PatternAnalysisResult>`

Analyzes patterns without applying optimizations.

**Parameters:**

- `patterns`: Array of pattern strings to analyze

**Returns:** Promise resolving to `PatternAnalysisResult`

##### `validateConfiguration(): ValidationResult`

Validates the current engine configuration.

**Returns:** `ValidationResult` object with validation status and errors

### PseudoClassHandler

Handles pseudo-class specific optimization logic.

#### Constructor

```typescript
constructor(config: PseudoClassConfig, performanceMonitor?: PerformanceMonitor)
```

#### Methods

##### `optimizePseudoClasses(patterns: ParsedPattern[]): OptimizationResult`

Optimizes pseudo-class patterns using LVHA+ ordering and conflict resolution.

**Parameters:**

- `patterns`: Array of parsed patterns containing pseudo-class information

**Returns:** `OptimizationResult` with optimized patterns

##### `validatePseudoClassOrder(pattern: ParsedPattern): ValidationResult`

Validates pseudo-class order according to LVHA+ rules.

**Parameters:**

- `pattern`: Single parsed pattern to validate

**Returns:** `ValidationResult` with validation status

##### `reorderPseudoClasses(pattern: ParsedPattern): ParsedPattern`

Reorders pseudo-classes in a pattern to follow optimal ordering.

**Parameters:**

- `pattern`: Pattern to reorder

**Returns:** Reordered `ParsedPattern`

### PatternGroupingEngine

Manages pattern grouping with multiple strategies.

#### Constructor

```typescript
constructor(config: GroupingConfig, performanceMonitor?: PerformanceMonitor)
```

#### Methods

##### `groupPatterns(patterns: ParsedPattern[]): GroupingResult`

Groups patterns using configured strategies.

**Parameters:**

- `patterns`: Array of patterns to group

**Returns:** `GroupingResult` with grouped patterns

##### `resolveConflicts(groups: PatternGroup[]): ConflictResolutionResult`

Resolves conflicts between pattern groups.

**Parameters:**

- `groups`: Array of pattern groups to analyze for conflicts

**Returns:** `ConflictResolutionResult` with resolution strategy

##### `optimizeGroups(groups: PatternGroup[]): OptimizationResult`

Applies optimizations to grouped patterns.

**Parameters:**

- `groups`: Array of pattern groups to optimize

**Returns:** `OptimizationResult` with optimized groups

### PatternMergingEngine

Handles sophisticated pattern merging and conflict resolution.

#### Constructor

```typescript
constructor(config: MergingConfig, performanceMonitor?: PerformanceMonitor)
```

#### Methods

##### `mergePatterns(patterns: ParsedPattern[]): MergingResult`

Merges compatible patterns using configured strategies.

**Parameters:**

- `patterns`: Array of patterns to merge

**Returns:** `MergingResult` with merged patterns

##### `analyzeConflicts(patterns: ParsedPattern[]): ConflictAnalysisResult`

Analyzes conflicts between patterns without resolving them.

**Parameters:**

- `patterns`: Array of patterns to analyze

**Returns:** `ConflictAnalysisResult` with detailed conflict information

##### `resolveMergingConflicts(conflicts: MergingConflict[]): ConflictResolutionResult`

Resolves specific merging conflicts.

**Parameters:**

- `conflicts`: Array of merging conflicts to resolve

**Returns:** `ConflictResolutionResult` with resolution strategies

### BreakpointCompatibilityEngine

Manages breakpoint definitions and compatibility.

#### Constructor

```typescript
constructor(config: BreakpointCompatibilityConfig)
```

#### Methods

##### `validateBreakpoints(breakpoints: BreakpointDefinition[]): ValidationResult`

Validates breakpoint definitions for consistency and order.

**Parameters:**

- `breakpoints`: Array of breakpoint definitions to validate

**Returns:** `ValidationResult` with validation status

##### `generateMediaQueries(breakpoints: BreakpointDefinition[]): MediaQueryResult`

Generates CSS media queries for breakpoint definitions.

**Parameters:**

- `breakpoints`: Array of breakpoint definitions

**Returns:** `MediaQueryResult` with generated media queries

##### `addCustomBreakpoint(breakpoint: BreakpointDefinition): boolean`

Adds a custom breakpoint definition.

**Parameters:**

- `breakpoint`: Breakpoint definition to add

**Returns:** Boolean indicating success

##### `removeBreakpoint(name: string): boolean`

Removes a breakpoint definition by name.

**Parameters:**

- `name`: Name of the breakpoint to remove

**Returns:** Boolean indicating success

### ComplexPatternHandler

Handles complex pattern combinations and advanced optimization.

#### Constructor

```typescript
constructor(
  responsiveConfig: ResponsiveOptimizationConfig,
  breakpointEngine: BreakpointCompatibilityEngine,
  config: ComplexPatternConfig
)
```

#### Methods

##### `parseComplexPattern(pattern: string): ParsedComplexPattern`

Parses a complex pattern into its constituent components.

**Parameters:**

- `pattern`: Complex pattern string to parse

**Returns:** `ParsedComplexPattern` with detailed analysis

##### `analyzeComplexCombinations(patterns: string[]): ComplexCombinationResult`

Analyzes a collection of complex patterns for optimization opportunities.

**Parameters:**

- `patterns`: Array of complex pattern strings

**Returns:** `ComplexCombinationResult` with analysis results

##### `optimizeComplexPatterns(patterns: ParsedComplexPattern[]): OptimizationResult`

Applies optimizations to complex patterns.

**Parameters:**

- `patterns`: Array of parsed complex patterns

**Returns:** `OptimizationResult` with optimized patterns

##### `validateComplexPatterns(patterns: ParsedComplexPattern[]): ValidationResult`

Validates complex patterns for correctness and conflicts.

**Parameters:**

- `patterns`: Array of parsed complex patterns to validate

**Returns:** `ValidationResult` with validation results

## Configuration Interfaces

### ResponsiveOptimizationConfig

Main configuration interface for the optimization engine.

```typescript
interface ResponsiveOptimizationConfig {
  // Core features
  enablePseudoClassOptimization: boolean;
  enableBreakpointGrouping: boolean;
  enableComplexPatternHandling: boolean;

  // Performance
  includeOptimizationMetrics: boolean;
  enableCaching: boolean;
  maxCacheSize: number;
  enableParallelProcessing: boolean;
  parallelThreshold: number;

  // Breakpoints
  customBreakpoints?: BreakpointDefinition[];
  strictBreakpointOrder: boolean;
  defaultBreakpointStrategy: 'mobile-first' | 'desktop-first';

  // Pseudo-classes
  supportedPseudoClasses: string[];
  enforceLVHAOrder: boolean;
  allowCustomPseudoClasses: boolean;

  // Optimization strategies
  mergeStrategy: 'mobile-first' | 'desktop-first' | 'specificity' | 'custom';
  preserveSourceOrder: boolean;
  aggressiveOptimization: boolean;
  enableConflictResolution: boolean;

  // Error handling
  strictMode: boolean;
  errorReporting: 'none' | 'console' | 'throw' | 'collect';
  maxErrors: number;
}
```

### PseudoClassConfig

Configuration for pseudo-class handling.

```typescript
interface PseudoClassConfig {
  // Core settings
  supportedPseudoClasses: string[];
  enforceLVHAOrder: boolean;
  allowCustomPseudoClasses: boolean;

  // Optimization
  enableOptimization: boolean;
  enableReordering: boolean;
  enableGrouping: boolean;

  // Performance
  enableCaching: boolean;
  maxCacheSize: number;
  cacheStrategy: 'lru' | 'fifo' | 'custom';

  // Validation
  strictValidation: boolean;
  warnOnInvalidOrder: boolean;
  errorOnUnsupportedPseudoClass: boolean;
}
```

### GroupingConfig

Configuration for pattern grouping strategies.

```typescript
interface GroupingConfig {
  // Strategies
  strategies: GroupingStrategy[];
  primaryStrategy: GroupingStrategy;
  fallbackStrategy?: GroupingStrategy;

  // Grouping rules
  enableHierarchical: boolean;
  maxGroupSize: number;
  minGroupSize: number;
  enableNestedGroups: boolean;

  // Conflict resolution
  enableConflictResolution: boolean;
  conflictResolutionStrategy: ConflictResolutionStrategy;
  preserveOriginalOrder: boolean;

  // Performance
  enableCaching: boolean;
  maxCacheSize: number;
  enableParallelProcessing: boolean;

  // Custom rules
  customGroupingRules?: CustomGroupingRule[];
  enableCustomStrategies: boolean;
}
```

### MergingConfig

Configuration for pattern merging operations.

```typescript
interface MergingConfig {
  // Core settings
  enableMerging: boolean;
  mergeStrategies: MergeStrategy[];
  defaultMergeStrategy: MergeStrategy;

  // Conflict resolution
  enableConflictResolution: boolean;
  conflictResolutionStrategy: ConflictResolutionStrategy;
  preserveImportantDeclarations: boolean;

  // Performance
  enableCaching: boolean;
  maxCacheSize: number;
  enableParallelProcessing: boolean;
  parallelThreshold: number;

  // Validation
  enablePreMergeValidation: boolean;
  enablePostMergeValidation: boolean;
  strictMode: boolean;

  // Custom rules
  customMergeRules?: CustomMergeRule[];
  customConflictHandlers?: CustomConflictHandler[];
}
```

### BreakpointCompatibilityConfig

Configuration for breakpoint compatibility and management.

```typescript
interface BreakpointCompatibilityConfig {
  // Breakpoint definitions
  breakpoints: BreakpointDefinition[];
  allowCustomBreakpoints: boolean;
  enableRuntimeModification: boolean;

  // Validation
  enableValidation: boolean;
  strictOrder: boolean;
  allowOverlapping: boolean;

  // Media query generation
  mediaQueryStrategy: 'mobile-first' | 'desktop-first' | 'range';
  includeMaxWidth: boolean;
  customMediaQueryTemplate?: string;

  // Performance
  enableCaching: boolean;
  maxCacheSize: number;

  // Migration and compatibility
  enableLegacySupport: boolean;
  legacyBreakpointMapping?: Record<string, string>;
  migrationWarnings: boolean;
}
```

### ComplexPatternConfig

Configuration for complex pattern handling.

```typescript
interface ComplexPatternConfig {
  // Parsing configuration
  parsing: {
    enableDeepParsing: boolean;
    maxNestingDepth: number;
    supportArbitraryValues: boolean;
    enablePatternCaching: boolean;
  };

  // Validation configuration
  validation: {
    strictBreakpointOrder: boolean;
    strictPseudoClassOrder: boolean;
    warnOnHighComplexity: boolean;
    maxComplexityScore: number;
  };

  // Optimization configuration
  optimization: {
    aggressiveOptimization: boolean;
    enableCombination: boolean;
    enableSimplification: boolean;
    enableReordering: boolean;
    complexityThreshold: number;
  };

  // Performance configuration
  performance: {
    enableCaching: boolean;
    maxCacheSize: number;
    enableParallelProcessing: boolean;
    parallelThreshold: number;
    enablePerformanceMonitoring: boolean;
  };

  // Error handling configuration
  errorHandling: {
    strictMode: boolean;
    errorReporting: 'none' | 'console' | 'throw' | 'collect';
    maxErrors: number;
    enableRecovery: boolean;
  };
}
```

## Result Types

### OptimizationResult

Result object returned by optimization operations.

```typescript
interface OptimizationResult {
  // Optimized output
  optimizedClasses: string[];
  originalClasses: string[];

  // Optimization details
  appliedOptimizations: OptimizationMetadata[];
  groupingChanges: GroupingChange[];
  mergingChanges: MergingChange[];

  // Performance metrics
  metrics: PerformanceMetrics;
  timings: OptimizationTimings;

  // Validation results
  validationResults: ValidationResult[];
  warnings: OptimizationWarning[];
  errors: OptimizationError[];

  // Statistics
  reductionPercentage: number;
  conflictsResolved: number;
  patternsProcessed: number;
}
```

### ValidationResult

Result object for validation operations.

```typescript
interface ValidationResult {
  // Validation status
  isValid: boolean;
  hasWarnings: boolean;
  hasErrors: boolean;

  // Detailed results
  errors: ValidationError[];
  warnings: ValidationWarning[];
  suggestions: ValidationSuggestion[];

  // Context information
  validatedPatterns: string[];
  validationRulesApplied: string[];
  timestamp: Date;
}
```

### PatternAnalysisResult

Result object for pattern analysis operations.

```typescript
interface PatternAnalysisResult {
  // Pattern breakdown
  patterns: ParsedPattern[];
  complexPatterns: ParsedComplexPattern[];

  // Analysis results
  complexityScores: ComplexityScore[];
  conflictAnalysis: ConflictAnalysis;
  optimizationOpportunities: OptimizationOpportunity[];

  // Statistics
  totalPatterns: number;
  uniqueBreakpoints: string[];
  uniquePseudoClasses: string[];
  averageComplexity: number;

  // Recommendations
  recommendations: AnalysisRecommendation[];
  suggestedOptimizations: SuggestedOptimization[];
}
```

## Utility Functions

### createBreakpointCompatibilityEngine

Factory function for creating a BreakpointCompatibilityEngine instance.

```typescript
function createBreakpointCompatibilityEngine(
  config: BreakpointCompatibilityConfig
): BreakpointCompatibilityEngine;
```

### createComplexPatternHandler

Factory function for creating a ComplexPatternHandler instance.

```typescript
function createComplexPatternHandler(
  responsiveConfig: ResponsiveOptimizationConfig,
  breakpointEngine: BreakpointCompatibilityEngine,
  config: ComplexPatternConfig
): ComplexPatternHandler;
```

### parsePattern

Utility function for parsing individual patterns.

```typescript
function parsePattern(pattern: string): ParsedPattern;
```

### validateBreakpointOrder

Utility function for validating breakpoint order.

```typescript
function validateBreakpointOrder(breakpoints: BreakpointDefinition[]): ValidationResult;
```

### generateOptimizationReport

Utility function for generating detailed optimization reports.

```typescript
function generateOptimizationReport(result: OptimizationResult): OptimizationReport;
```

## Error Types

### OptimizationError

Base error class for optimization-related errors.

```typescript
class OptimizationError extends Error {
  code: string;
  context: OptimizationErrorContext;
  suggestions: string[];
}
```

### ValidationError

Error class for validation failures.

```typescript
class ValidationError extends OptimizationError {
  validationRule: string;
  invalidValue: any;
  expectedValue?: any;
}
```

### ConfigurationError

Error class for configuration-related issues.

```typescript
class ConfigurationError extends OptimizationError {
  configurationKey: string;
  providedValue: any;
  validValues?: any[];
}
```

## Constants and Enums

### GroupingStrategy

Enumeration of available grouping strategies.

```typescript
enum GroupingStrategy {
  BY_BREAKPOINT = 'by-breakpoint',
  BY_PSEUDO_CLASS = 'by-pseudo-class',
  BY_PROPERTY = 'by-property',
  BY_VALUE = 'by-value',
  BY_SELECTOR = 'by-selector',
  BY_UTILITY_TYPE = 'by-utility-type',
  BY_COMPLEXITY = 'by-complexity',
  HIERARCHICAL = 'hierarchical',
}
```

### MergeStrategy

Enumeration of available merge strategies.

```typescript
enum MergeStrategy {
  MOBILE_FIRST = 'mobile-first',
  DESKTOP_FIRST = 'desktop-first',
  SPECIFICITY_BASED = 'specificity-based',
  PROPERTY_BASED = 'property-based',
  SELECTOR_BASED = 'selector-based',
  CUSTOM = 'custom',
}
```

### ComplexPatternType

Enumeration of complex pattern types.

```typescript
enum ComplexPatternType {
  SIMPLE_UTILITY = 'simple-utility',
  RESPONSIVE_UTILITY = 'responsive-utility',
  PSEUDO_UTILITY = 'pseudo-utility',
  RESPONSIVE_PSEUDO = 'responsive-pseudo',
  MULTI_BREAKPOINT = 'multi-breakpoint',
  MULTI_PSEUDO = 'multi-pseudo',
  NESTED_PSEUDO = 'nested-pseudo',
  COMBINED_COMPLEX = 'combined-complex',
  GROUPED_PATTERN = 'grouped-pattern',
  ARBITRARY_COMPLEX = 'arbitrary-complex',
}
```

### ConflictType

Enumeration of conflict types.

```typescript
enum ConflictType {
  SPECIFICITY_CONFLICT = 'specificity-conflict',
  CASCADE_CONFLICT = 'cascade-conflict',
  INHERITANCE_CONFLICT = 'inheritance-conflict',
  BREAKPOINT_ORDER_CONFLICT = 'breakpoint-order-conflict',
  PSEUDO_ORDER_CONFLICT = 'pseudo-order-conflict',
  GROUP_MEMBERSHIP_CONFLICT = 'group-membership-conflict',
}
```

## Examples

### Complete Integration Example

```typescript
import {
  ResponsiveOptimizationEngine,
  createBreakpointCompatibilityEngine,
  createComplexPatternHandler,
  GroupingStrategy,
  MergeStrategy,
} from '@tw-enigma/core';

// Create custom breakpoint engine
const breakpointEngine = createBreakpointCompatibilityEngine({
  breakpoints: [
    { name: 'xs', minWidth: 475, order: 0 },
    { name: 'sm', minWidth: 640, order: 1 },
    { name: 'md', minWidth: 768, order: 2 },
    { name: 'lg', minWidth: 1024, order: 3 },
    { name: 'xl', minWidth: 1280, order: 4 },
    { name: '2xl', minWidth: 1536, order: 5 },
  ],
  allowCustomBreakpoints: true,
  enableValidation: true,
});

// Create complex pattern handler
const complexHandler = createComplexPatternHandler(
  {
    enablePseudoClassOptimization: true,
    enableBreakpointGrouping: true,
    enableComplexPatternHandling: true,
    mergeStrategy: 'mobile-first',
    aggressiveOptimization: true,
  },
  breakpointEngine,
  {
    parsing: {
      enableDeepParsing: true,
      maxNestingDepth: 10,
      supportArbitraryValues: true,
    },
    optimization: {
      aggressiveOptimization: true,
      enableCombination: true,
      enableSimplification: true,
    },
    validation: {
      strictBreakpointOrder: true,
      strictPseudoClassOrder: true,
      warnOnHighComplexity: true,
    },
  }
);

// Create main optimization engine
const engine = new ResponsiveOptimizationEngine({
  enablePseudoClassOptimization: true,
  enableBreakpointGrouping: true,
  enableComplexPatternHandling: true,
  includeOptimizationMetrics: true,
  enableCaching: true,
  maxCacheSize: 1000,
  mergeStrategy: 'mobile-first',
  aggressiveOptimization: true,
});

// Optimize a complex set of classes
async function optimizeComplexClasses() {
  const classes = [
    'sm:text-red-500',
    'md:text-blue-500',
    'lg:hover:text-green-500',
    'xl:focus:active:text-purple-500',
    'sm:group-hover:focus:disabled:bg-gray-100',
    'md:peer-focus:hover:bg-yellow-200',
    'lg:first:last:odd:text-orange-500',
  ];

  const result = await engine.optimizeClasses(classes);

  console.log('Original classes:', result.originalClasses);
  console.log('Optimized classes:', result.optimizedClasses);
  console.log('Reduction percentage:', result.reductionPercentage);
  console.log('Performance metrics:', result.metrics);

  if (result.warnings.length > 0) {
    console.warn('Warnings:', result.warnings);
  }

  if (result.errors.length > 0) {
    console.error('Errors:', result.errors);
  }

  return result;
}

// Run the optimization
optimizeComplexClasses().catch(console.error);
```

This API reference provides comprehensive documentation for all classes, interfaces, and utilities in the responsive and pseudo-class optimization system. For more examples and advanced usage patterns, see the main documentation and examples directory.
