# Responsive and Pseudo-Class Optimization

## Overview

The TW-Enigma Responsive and Pseudo-Class Optimization system provides advanced optimization strategies for responsive utilities and pseudo-class variants in Tailwind CSS. This comprehensive system handles complex pattern combinations, breakpoint management, and intelligent conflict resolution.

## Table of Contents

1. [Core Systems](#core-systems)
2. [Quick Start](#quick-start)
3. [Configuration](#configuration)
4. [Usage Examples](#usage-examples)
5. [Advanced Features](#advanced-features)
6. [Troubleshooting](#troubleshooting)
7. [API Reference](#api-reference)
8. [Extension Points](#extension-points)

## Core Systems

The optimization system consists of five interconnected components:

### 1. Pseudo-Class Handler

- **Purpose**: Advanced pseudo-class pattern detection and optimization
- **File**: `packages/core/src/optimization/pseudoClassHandler.ts`
- **Features**: LVHA+ order validation, caching, performance monitoring

### 2. Pattern Grouping Engine

- **Purpose**: Multi-strategy pattern grouping with hierarchical structures
- **File**: `packages/core/src/optimization/patternGrouping.ts`
- **Features**: 8 grouping strategies, conflict resolution, nested groupings

### 3. Pattern Merging Engine

- **Purpose**: Sophisticated conflict resolution and pattern merging
- **File**: `packages/core/src/optimization/patternMerging.ts`
- **Features**: 6 merge strategies, conflict analysis, custom rules

### 4. Breakpoint Compatibility Engine

- **Purpose**: Configurable breakpoint handling and extensibility
- **File**: `packages/core/src/optimization/breakpointCompatibility.ts`
- **Features**: Custom breakpoints, validation, media query generation

### 5. Complex Pattern Handler

- **Purpose**: Advanced handling of complex pattern combinations
- **File**: `packages/core/src/optimization/complexPatternHandler.ts`
- **Features**: 10 pattern types, complexity scoring, optimization recommendations

## Quick Start

### Basic Usage

```typescript
import {
  ResponsiveOptimizationEngine,
  createBreakpointCompatibilityEngine,
  createComplexPatternHandler,
} from '@tw-enigma/core';

// Create the optimization engine
const optimizationEngine = new ResponsiveOptimizationEngine({
  enablePseudoClassOptimization: true,
  enableBreakpointGrouping: true,
  enableComplexPatternHandling: true,
  includeOptimizationMetrics: true,
});

// Optimize a set of classes
const result = await optimizationEngine.optimizeClasses([
  'sm:text-red-500',
  'md:text-blue-500',
  'lg:hover:text-green-500',
  'xl:focus:active:text-purple-500',
]);

console.log('Optimized classes:', result.optimizedClasses);
console.log('Performance metrics:', result.metrics);
```

### Advanced Usage with Custom Configuration

```typescript
import { createComplexPatternHandler, createBreakpointCompatibilityEngine } from '@tw-enigma/core';

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
  enableRuntimeModification: false,
});

// Create complex pattern handler with aggressive optimization
const complexHandler = createComplexPatternHandler(
  {
    /* responsive config */
  },
  breakpointEngine,
  {
    optimization: {
      aggressiveOptimization: true,
      enableCombination: true,
      enableSimplification: true,
      enableReordering: true,
    },
    validation: {
      strictBreakpointOrder: true,
      strictPseudoClassOrder: true,
      warnOnHighComplexity: true,
    },
  }
);

// Analyze complex patterns
const analysis = complexHandler.analyzeComplexCombinations([
  'lg:group-hover:focus:disabled:text-blue-500',
  'md:peer-focus:hover:bg-red-500',
  'sm:first:last:odd:text-green-500',
]);

console.log('Pattern analysis:', analysis);
```

## Configuration

### Responsive Optimization Configuration

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

  // Breakpoints
  customBreakpoints?: BreakpointDefinition[];
  strictBreakpointOrder: boolean;

  // Pseudo-classes
  supportedPseudoClasses: string[];
  enforceLVHAOrder: boolean;

  // Optimization strategies
  mergeStrategy: 'mobile-first' | 'desktop-first' | 'specificity';
  preserveSourceOrder: boolean;
  aggressiveOptimization: boolean;
}
```

### Breakpoint Configuration

```typescript
interface BreakpointDefinition {
  name: string;
  minWidth: number;
  maxWidth?: number;
  order: number;
  alias?: string[];
  metadata?: Record<string, any>;
}

// Example configuration
const breakpointConfig = {
  breakpoints: [
    { name: 'sm', minWidth: 640, order: 1 },
    { name: 'md', minWidth: 768, order: 2 },
    { name: 'lg', minWidth: 1024, order: 3 },
  ],
  allowCustomBreakpoints: true,
  enableValidation: true,
  defaultStrategy: 'mobile-first',
};
```

### Pattern Grouping Configuration

```typescript
interface GroupingConfig {
  strategies: GroupingStrategy[];
  enableHierarchical: boolean;
  maxGroupSize: number;
  enableConflictResolution: boolean;
  customGroupingRules?: CustomGroupingRule[];
}

// Available grouping strategies
type GroupingStrategy =
  | 'breakpoint'
  | 'pseudo-class'
  | 'component'
  | 'semantic'
  | 'property'
  | 'utility'
  | 'priority'
  | 'frequency';
```

## Usage Examples

### Example 1: Basic Responsive Optimization

```typescript
// Input classes
const inputClasses = [
  'text-red-500',
  'sm:text-blue-500',
  'md:text-green-500',
  'lg:text-purple-500',
];

// Optimize
const result = await optimizationEngine.optimizeClasses(inputClasses);

// Output: Optimized and grouped by breakpoint
console.log(result.optimizedClasses);
// ['text-red-500 sm:text-blue-500 md:text-green-500 lg:text-purple-500']
```

### Example 2: Pseudo-Class Optimization

```typescript
// Input classes with pseudo-classes
const inputClasses = [
  'hover:bg-blue-500',
  'focus:bg-blue-600',
  'active:bg-blue-700',
  'disabled:bg-gray-300',
];

// The system automatically orders pseudo-classes according to LVHA+ rules
const result = await optimizationEngine.optimizeClasses(inputClasses);

// Output: Properly ordered pseudo-classes
console.log(result.optimizedClasses);
// ['hover:bg-blue-500 focus:bg-blue-600 active:bg-blue-700 disabled:bg-gray-300']
```

### Example 3: Complex Pattern Combinations

```typescript
// Input: Complex responsive + pseudo-class combinations
const complexPatterns = [
  'lg:group-hover:focus:text-white',
  'md:peer-focus:hover:bg-red-500',
  'sm:first-child:last-child:text-center',
  'xl:dark:motion-reduce:opacity-50',
];

// Analyze complexity and conflicts
const analysis = complexHandler.analyzeComplexCombinations(complexPatterns);

// Get optimization recommendations
console.log(
  'Complexity scores:',
  analysis.patterns.map((p) => p.complexity.score)
);
console.log('Conflicts detected:', analysis.conflicts);
console.log('Optimization opportunities:', analysis.optimizations);
```

### Example 4: Custom Breakpoint Integration

```typescript
// Define custom breakpoints for a design system
const customBreakpoints = [
  { name: 'mobile', minWidth: 320, order: 0 },
  { name: 'tablet', minWidth: 768, order: 1 },
  { name: 'desktop', minWidth: 1200, order: 2 },
  { name: 'wide', minWidth: 1600, order: 3 },
];

const breakpointEngine = createBreakpointCompatibilityEngine({
  breakpoints: customBreakpoints,
  allowCustomBreakpoints: true,
  enableValidation: true,
});

// Use with pattern optimization
const patterns = ['mobile:text-sm', 'tablet:text-base', 'desktop:text-lg', 'wide:text-xl'];

const result = await optimizationEngine.optimizeClasses(patterns);
```

### Example 5: Pattern Grouping by Component

```typescript
// Input: Classes from different components
const componentClasses = [
  // Button component
  'btn-primary',
  'hover:btn-primary-hover',
  'focus:btn-primary-focus',

  // Card component
  'card-base',
  'sm:card-responsive',
  'dark:card-dark',

  // Navigation component
  'nav-item',
  'active:nav-item-active',
];

// Group by component context
const groupingEngine = new PatternGroupingEngine(
  {
    strategies: ['component', 'semantic'],
    enableHierarchical: true,
  },
  responsiveConfig
);

const grouped = groupingEngine.groupPatterns(componentClasses);
console.log('Component groups:', grouped);
```

## Advanced Features

### 1. Complexity Analysis

The system provides detailed complexity scoring for patterns:

```typescript
import { analyzePatternComplexity } from '@tw-enigma/core';

// Analyze individual pattern complexity
const complexity = analyzePatternComplexity('lg:group-hover:focus:disabled:text-blue-500');

console.log('Complexity score:', complexity.score); // 0-100
console.log('Pattern type:', complexity.type);
console.log('Issues:', complexity.issues);
```

### 2. Conflict Detection and Resolution

```typescript
// Detect conflicts between patterns
const patterns = [
  'text-red-500',
  'sm:text-blue-500',
  'text-green-500', // Potential conflict
];

const analysis = complexHandler.analyzeComplexCombinations(patterns);

// Check for conflicts
analysis.conflicts.forEach((conflict) => {
  console.log(`${conflict.severity}: ${conflict.description}`);
  if (conflict.resolution) {
    console.log(`Resolution: ${conflict.resolution.action}`);
  }
});
```

### 3. Performance Monitoring

```typescript
// Enable performance monitoring
const optimizationEngine = new ResponsiveOptimizationEngine({
  includeOptimizationMetrics: true,
  enableCaching: true,
});

const result = await optimizationEngine.optimizeClasses(largeClassList);

// Access performance metrics
console.log('Processing time:', result.metrics.processingTime);
console.log('Memory usage:', result.metrics.memoryUsage);
console.log('Cache hit rate:', result.metrics.cacheHitRate);
```

### 4. Custom Merge Strategies

```typescript
// Define custom merge strategy
const mergingEngine = new PatternMergingEngine({
  strategy: 'custom',
  customRules: [
    {
      name: 'component-priority',
      pattern: '^(btn|card|nav)-',
      priority: 10,
      action: 'prioritize',
    },
    {
      name: 'utility-merge',
      pattern: '^(text|bg|border)-',
      priority: 5,
      action: 'merge',
    },
  ],
});

const mergeResult = mergingEngine.mergePatterns(patterns);
```

## Troubleshooting

### Common Issues and Solutions

#### 1. Pseudo-Class Order Warnings

**Issue**: Getting warnings about pseudo-class order

```
Warning: Pseudo-classes not in LVHA+ order
```

**Solution**: Enable strict pseudo-class ordering

```typescript
const config = {
  validation: {
    strictPseudoClassOrder: true,
    errorOnInvalidCombinations: false, // Use warnings instead
  },
};
```

#### 2. Breakpoint Order Conflicts

**Issue**: Breakpoints are not in optimal order

```
Warning: Breakpoints not in optimal order
```

**Solution**: Define explicit breakpoint order

```typescript
const breakpointEngine = createBreakpointCompatibilityEngine({
  breakpoints: [
    { name: 'sm', minWidth: 640, order: 1 },
    { name: 'md', minWidth: 768, order: 2 },
    { name: 'lg', minWidth: 1024, order: 3 },
  ],
  enforceOrder: true,
});
```

#### 3. High Complexity Patterns

**Issue**: Patterns exceed complexity threshold

```
Error: Pattern exceeds maximum complexity: 85 > 80
```

**Solution**: Adjust complexity limits or simplify patterns

```typescript
const config = {
  parsing: {
    maxComplexity: 90, // Increase limit
    warnOnHighComplexity: true, // Use warnings instead of errors
  },
};
```

#### 4. Memory Issues with Large Pattern Sets

**Issue**: High memory usage with large class lists

**Solution**: Optimize caching and enable parallel processing

```typescript
const config = {
  performance: {
    enableCaching: true,
    maxCacheSize: 500, // Reduce cache size
    enableParallelProcessing: true,
    timeoutMs: 15000,
  },
};
```

#### 5. Custom Breakpoint Validation Errors

**Issue**: Custom breakpoints fail validation

**Solution**: Ensure proper breakpoint configuration

```typescript
const customBreakpoints = [
  {
    name: 'tablet-sm',
    minWidth: 600,
    maxWidth: 767, // Optional max width
    order: 1.5, // Can use decimals for ordering
    alias: ['tab-sm'], // Optional aliases
  },
];

// Validate before use
const validation = breakpointEngine.validateBreakpoints(customBreakpoints);
if (!validation.isValid) {
  console.error('Validation errors:', validation.errors);
}
```

### Debug Mode

Enable debug mode for detailed logging:

```typescript
const config = {
  errorHandling: {
    reportAllErrors: true,
    includeStackTrace: true,
    continueOnError: true,
  },
};
```

### Performance Optimization Tips

1. **Use Caching**: Enable caching for repeated pattern sets
2. **Batch Processing**: Process large class lists in batches
3. **Lazy Loading**: Only load complex handlers when needed
4. **Memory Management**: Monitor and limit cache sizes
5. **Parallel Processing**: Enable for CPU-intensive operations

## API Reference

### ResponsiveOptimizationEngine

Main engine for responsive optimization.

```typescript
class ResponsiveOptimizationEngine {
  constructor(config: ResponsiveOptimizationConfig);

  // Main optimization method
  async optimizeClasses(classes: string[]): Promise<OptimizationResult>;

  // Pattern analysis
  analyzePatterns(patterns: string[]): PatternAnalysis;

  // Configuration management
  updateConfig(config: Partial<ResponsiveOptimizationConfig>): void;
  getConfig(): ResponsiveOptimizationConfig;

  // Performance monitoring
  getMetrics(): PerformanceMetrics;
  clearCache(): void;
}
```

### ComplexPatternHandler

Handler for complex pattern combinations.

```typescript
class ComplexPatternHandler {
  constructor(
    config: Partial<ComplexPatternConfig>,
    responsiveConfig: ResponsiveOptimizationConfig,
    breakpointEngine: BreakpointCompatibilityEngine
  );

  // Pattern parsing and analysis
  parseComplexPattern(pattern: string): ParsedComplexPattern;
  analyzeComplexCombinations(patterns: string[]): ComplexCombinationResult;

  // Optimization
  optimizeComplexPatterns(patterns: string[]): OptimizationResult;

  // Validation
  validateComplexPatterns(patterns: string[]): ValidationResult;

  // Utilities
  getMetrics(): HandlerMetrics;
  clearCaches(): void;
}
```

### BreakpointCompatibilityEngine

Engine for breakpoint management.

```typescript
class BreakpointCompatibilityEngine {
  constructor(config: BreakpointConfig);

  // Breakpoint management
  addBreakpoint(breakpoint: BreakpointDefinition): void;
  removeBreakpoint(name: string): void;
  getBreakpoint(name: string): BreakpointDefinition | undefined;

  // Validation
  isValidBreakpoint(name: string): boolean;
  validateBreakpoints(breakpoints: BreakpointDefinition[]): ValidationResult;

  // Ordering and comparison
  compareBreakpoints(a: string, b: string): number;
  getBreakpointOrder(name: string): number;

  // Media queries
  generateMediaQuery(breakpoint: string, strategy?: 'mobile-first' | 'desktop-first'): string;

  // Configuration
  updateConfig(config: Partial<BreakpointConfig>): void;
  getConfig(): BreakpointConfig;
}
```

### PatternGroupingEngine

Engine for pattern grouping and organization.

```typescript
class PatternGroupingEngine {
  constructor(config: GroupingConfig, responsiveConfig: ResponsiveOptimizationConfig);

  // Grouping operations
  groupPatterns(patterns: string[], strategy?: GroupingStrategy): PatternGroup[];
  analyzeGrouping(patterns: string[]): GroupingAnalysis;

  // Group management
  createGroup(config: GroupConfig): PatternGroup;
  mergeGroups(groups: PatternGroup[]): PatternGroup;
  validateGroups(groups: PatternGroup[]): ValidationResult;

  // Configuration
  addGroupingStrategy(strategy: CustomGroupingStrategy): void;
  removeGroupingStrategy(name: string): void;

  // Performance
  getMetrics(): GroupingMetrics;
  clearCache(): void;
}
```

### PatternMergingEngine

Engine for pattern merging and conflict resolution.

```typescript
class PatternMergingEngine {
  constructor(config: MergeConfig);

  // Merging operations
  mergePatterns(patterns: string[]): MergeResult;
  analyzeConflicts(patterns: string[]): PatternConflict[];

  // Custom rules
  addCustomRule(rule: CustomMergeRule): void;
  removeCustomRule(name: string): void;

  // Validation and configuration
  validateConfig(): ValidationResult;
  clearCache(): void;
  getCacheStats(): CacheStats;
}
```

### Factory Functions

Convenient factory functions for creating optimized instances:

```typescript
// Create standard responsive optimization engine
function createResponsiveOptimizationEngine(
  config?: Partial<ResponsiveOptimizationConfig>
): ResponsiveOptimizationEngine;

// Create breakpoint compatibility engine
function createBreakpointCompatibilityEngine(
  config?: Partial<BreakpointConfig>
): BreakpointCompatibilityEngine;

// Create complex pattern handler with default configuration
function createComplexPatternHandler(
  responsiveConfig: ResponsiveOptimizationConfig,
  breakpointEngine: BreakpointCompatibilityEngine,
  config?: Partial<ComplexPatternConfig>
): ComplexPatternHandler;

// Create aggressive optimization handler
function createAggressiveComplexPatternHandler(
  responsiveConfig: ResponsiveOptimizationConfig,
  breakpointEngine: BreakpointCompatibilityEngine
): ComplexPatternHandler;

// Create pattern grouping engine
function createPatternGroupingEngine(
  config?: Partial<GroupingConfig>,
  responsiveConfig?: ResponsiveOptimizationConfig
): PatternGroupingEngine;

// Create pattern merging engine with strategy
function createPatternMergingEngine(config?: Partial<MergeConfig>): PatternMergingEngine;
function createMobileFirstMerger(): PatternMergingEngine;
function createDesktopFirstMerger(): PatternMergingEngine;
function createSpecificityMerger(): PatternMergingEngine;
```

### Utility Functions

Helper functions for quick analysis and validation:

```typescript
// Quick pattern complexity analysis
function analyzePatternComplexity(pattern: string): {
  score: number;
  type: ComplexPatternType;
  issues: string[];
};

// Quick pattern validation
function validateComplexPattern(pattern: string): {
  isValid: boolean;
  errors: string[];
  warnings: string[];
};

// Quick pattern merging
function mergePatterns(patterns: string[], strategy?: MergeStrategy): MergeResult;

// Quick conflict analysis
function analyzePatternConflicts(patterns: string[]): PatternConflict[];
```

## Extension Points

The system provides several extension points for customization:

### 1. Custom Grouping Strategies

```typescript
interface CustomGroupingStrategy {
  name: string;
  description: string;
  classify: (pattern: string) => PatternClassification;
  group: (classifications: PatternClassification[]) => PatternGroup[];
  priority: number;
}

// Register custom strategy
groupingEngine.addGroupingStrategy({
  name: 'framework-specific',
  description: 'Group patterns by framework (React, Vue, etc.)',
  classify: (pattern) => {
    // Custom classification logic
    return {
      /* classification */
    };
  },
  group: (classifications) => {
    // Custom grouping logic
    return [
      /* groups */
    ];
  },
  priority: 8,
});
```

### 2. Custom Merge Rules

```typescript
interface CustomMergeRule {
  name: string;
  pattern: string; // Regex pattern
  priority: number;
  action: 'merge' | 'skip' | 'prioritize';
  condition?: (patterns: string[]) => boolean;
}

// Add custom merge rule
mergingEngine.addCustomRule({
  name: 'component-utilities',
  pattern: '^(btn|card|nav|form)-',
  priority: 15,
  action: 'prioritize',
  condition: (patterns) => patterns.length > 1,
});
```

### 3. Custom Pseudo-Class Validation

```typescript
interface CustomPseudoClassRule {
  name: string;
  order: number;
  conflictsWith?: string[];
  requiredContext?: string[];
}

// Extend pseudo-class support
pseudoClassHandler.addCustomPseudoClass({
  name: 'custom-hover',
  order: 15,
  conflictsWith: ['focus'],
  requiredContext: ['interactive'],
});
```

### 4. Custom Breakpoint Strategies

```typescript
interface CustomBreakpointStrategy {
  name: string;
  generateMediaQuery: (breakpoint: BreakpointDefinition) => string;
  compareBreakpoints: (a: BreakpointDefinition, b: BreakpointDefinition) => number;
  validateBreakpoint: (breakpoint: BreakpointDefinition) => ValidationResult;
}

// Register custom breakpoint strategy
breakpointEngine.addStrategy({
  name: 'container-queries',
  generateMediaQuery: (bp) => `@container (min-width: ${bp.minWidth}px)`,
  compareBreakpoints: (a, b) => a.minWidth - b.minWidth,
  validateBreakpoint: (bp) => ({ isValid: bp.minWidth > 0, errors: [] }),
});
```

### 5. Performance Hooks

```typescript
interface PerformanceHooks {
  onOptimizationStart?: (patterns: string[]) => void;
  onOptimizationEnd?: (result: OptimizationResult) => void;
  onCacheHit?: (key: string) => void;
  onCacheMiss?: (key: string) => void;
  onError?: (error: Error, context: string) => void;
}

// Register performance hooks
optimizationEngine.registerHooks({
  onOptimizationStart: (patterns) => {
    console.log(`Starting optimization of ${patterns.length} patterns`);
  },
  onOptimizationEnd: (result) => {
    console.log(`Optimization completed in ${result.metrics.processingTime}ms`);
  },
  onError: (error, context) => {
    console.error(`Error in ${context}:`, error.message);
  },
});
```

## Framework Integration

### React Integration

```typescript
import { useResponsiveOptimization } from '@tw-enigma/react';

function MyComponent() {
  const { optimizeClasses, isOptimizing } = useResponsiveOptimization();

  const classes = optimizeClasses([
    'text-red-500',
    'sm:text-blue-500',
    'lg:hover:text-green-500'
  ]);

  return (
    <div className={classes.join(' ')}>
      Optimized responsive content
    </div>
  );
}
```

### Vue Integration

```vue
<template>
  <div :class="optimizedClasses">Optimized responsive content</div>
</template>

<script setup>
import { useResponsiveOptimization } from '@tw-enigma/vue';

const { optimizeClasses } = useResponsiveOptimization();

const optimizedClasses = optimizeClasses([
  'text-red-500',
  'sm:text-blue-500',
  'lg:hover:text-green-500',
]);
</script>
```

### Build Tool Integration

```javascript
// webpack.config.js
const { ResponsiveOptimizationPlugin } = require('@tw-enigma/webpack');

module.exports = {
  plugins: [
    new ResponsiveOptimizationPlugin({
      enablePseudoClassOptimization: true,
      enableBreakpointGrouping: true,
      optimizationLevel: 'aggressive',
    }),
  ],
};
```

---

For more detailed examples and advanced usage patterns, see the [examples](../examples/) directory and [API Reference](./API_REFERENCE.md).
