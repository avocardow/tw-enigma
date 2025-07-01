# Usage Examples - Responsive and Pseudo-Class Optimization

## Overview

This document provides practical examples of using the TW-Enigma Responsive and Pseudo-Class Optimization system. Examples are organized by complexity and use case.

## Table of Contents

1. [Basic Examples](#basic-examples)
2. [Configuration Examples](#configuration-examples)
3. [Advanced Patterns](#advanced-patterns)
4. [Integration Scenarios](#integration-scenarios)
5. [Performance Optimization](#performance-optimization)
6. [Error Handling](#error-handling)

## Basic Examples

### Simple Responsive Optimization

```typescript
import { ResponsiveOptimizationEngine } from '@tw-enigma/core';

// Basic setup
const engine = new ResponsiveOptimizationEngine({
  enablePseudoClassOptimization: true,
  enableBreakpointGrouping: true,
  enableComplexPatternHandling: false, // Start simple
  includeOptimizationMetrics: true,
  strictBreakpointOrder: true,
  enforceLVHAOrder: true,
  mergeStrategy: 'mobile-first',
  aggressiveOptimization: false,
});

// Simple optimization
async function basicOptimization() {
  const classes = [
    'text-blue-500',
    'sm:text-red-500',
    'md:text-green-500',
    'lg:text-purple-500',
    'hover:text-gray-800',
    'focus:text-gray-900',
  ];

  const result = await engine.optimizeClasses(classes);

  console.log('Input classes:', result.originalClasses);
  console.log('Optimized classes:', result.optimizedClasses);
  console.log('Reduction:', `${result.reductionPercentage}%`);
}
```

### Pseudo-Class Optimization

```typescript
import { PseudoClassHandler } from '@tw-enigma/core';

// Configure pseudo-class handling
const pseudoHandler = new PseudoClassHandler({
  supportedPseudoClasses: [
    'hover',
    'focus',
    'active',
    'visited',
    'disabled',
    'first-child',
    'last-child',
    'nth-child',
    'group-hover',
    'peer-focus',
  ],
  enforceLVHAOrder: true, // Link, Visited, Hover, Active order
  enableOptimization: true,
  enableReordering: true,
  strictValidation: true,
});

// Example with LVHA ordering
const patterns = [
  { class: 'link:text-blue-500', pseudo: ['link'] },
  { class: 'active:text-blue-700', pseudo: ['active'] },
  { class: 'hover:text-blue-600', pseudo: ['hover'] },
  { class: 'visited:text-purple-500', pseudo: ['visited'] },
];

const optimized = pseudoHandler.optimizePseudoClasses(patterns);
// Result will be properly ordered: link, visited, hover, active
```

## Configuration Examples

### Custom Breakpoint Configuration

```typescript
import { createBreakpointCompatibilityEngine } from '@tw-enigma/core';

// Custom breakpoint setup
const breakpointEngine = createBreakpointCompatibilityEngine({
  breakpoints: [
    { name: 'xs', minWidth: 475, order: 0 },
    { name: 'sm', minWidth: 640, order: 1 },
    { name: 'md', minWidth: 768, order: 2 },
    { name: 'lg', minWidth: 1024, order: 3 },
    { name: 'xl', minWidth: 1280, order: 4 },
    { name: '2xl', minWidth: 1536, order: 5 },
    // Custom breakpoints
    { name: 'mobile', minWidth: 320, maxWidth: 767, order: 0.5 },
    { name: 'tablet', minWidth: 768, maxWidth: 1023, order: 2.5 },
  ],
  allowCustomBreakpoints: true,
  enableValidation: true,
  mediaQueryStrategy: 'mobile-first',
});

// Validate breakpoints
const validation = breakpointEngine.validateBreakpoints(breakpointEngine.getBreakpoints());

if (!validation.isValid) {
  console.error('Breakpoint validation failed:', validation.errors);
}

// Generate media queries
const mediaQueries = breakpointEngine.generateMediaQueries(breakpointEngine.getBreakpoints());

console.log('Generated media queries:', mediaQueries.queries);
```

### Advanced Engine Configuration

```typescript
const advancedEngine = new ResponsiveOptimizationEngine({
  // Core features
  enablePseudoClassOptimization: true,
  enableBreakpointGrouping: true,
  enableComplexPatternHandling: true,

  // Performance
  includeOptimizationMetrics: true,
  enableCaching: true,
  maxCacheSize: 2000,
  enableParallelProcessing: true,
  parallelThreshold: 100,

  // Optimization strategies
  mergeStrategy: 'specificity',
  preserveSourceOrder: false,
  aggressiveOptimization: true,
  enableConflictResolution: true,

  // Validation
  strictBreakpointOrder: true,
  enforceLVHAOrder: true,
  allowCustomPseudoClasses: true,

  // Error handling
  strictMode: false,
  errorReporting: 'collect',
  maxErrors: 50,

  // Custom breakpoints
  customBreakpoints: [{ name: 'ultra-wide', minWidth: 2560, order: 6 }],

  // Supported pseudo-classes
  supportedPseudoClasses: [
    'hover',
    'focus',
    'active',
    'visited',
    'disabled',
    'first-child',
    'last-child',
    'nth-child',
    'nth-of-type',
    'group-hover',
    'group-focus',
    'peer-hover',
    'peer-focus',
    'before',
    'after',
    'placeholder',
    'selection',
  ],
});
```

## Advanced Patterns

### Complex Pattern Handling

```typescript
import { createComplexPatternHandler } from '@tw-enigma/core';

// Setup complex pattern handler
const complexHandler = createComplexPatternHandler(
  advancedEngine.config, // Use the advanced configuration
  breakpointEngine,
  {
    parsing: {
      enableDeepParsing: true,
      maxNestingDepth: 15,
      supportArbitraryValues: true,
      enablePatternCaching: true,
    },
    optimization: {
      aggressiveOptimization: true,
      enableCombination: true,
      enableSimplification: true,
      enableReordering: true,
      complexityThreshold: 7,
    },
    validation: {
      strictBreakpointOrder: true,
      strictPseudoClassOrder: true,
      warnOnHighComplexity: true,
      maxComplexityScore: 8,
    },
    performance: {
      enableCaching: true,
      maxCacheSize: 1000,
      enableParallelProcessing: true,
      parallelThreshold: 50,
      enablePerformanceMonitoring: true,
    },
  }
);

// Analyze complex patterns
const complexPatterns = [
  'lg:group-hover:focus:disabled:text-blue-500',
  'md:peer-focus:hover:first:bg-red-500',
  'sm:dark:group-hover:peer-focus:text-green-500',
  'xl:first-child:last-child:only-child:p-4',
  'lg:nth-child(odd):hover:focus:bg-gradient-to-r',
];

async function analyzeComplexPatterns() {
  const analysis = complexHandler.analyzeComplexCombinations(complexPatterns);

  console.log('Pattern Analysis:');
  console.log('- Total patterns:', analysis.totalPatterns);
  console.log('- High complexity patterns:', analysis.highComplexityPatterns.length);
  console.log('- Conflicts detected:', analysis.conflicts.length);
  console.log('- Optimization opportunities:', analysis.optimizationOpportunities.length);

  // Parse individual complex pattern
  const parsed = complexHandler.parseComplexPattern('lg:group-hover:focus:disabled:text-blue-500');

  console.log('Parsed Pattern:');
  console.log('- Type:', parsed.type);
  console.log('- Complexity score:', parsed.complexityScore);
  console.log('- Breakpoints:', parsed.breakpoints);
  console.log('- Pseudo classes:', parsed.pseudoClasses);
  console.log('- Base utility:', parsed.baseUtility);
}
```

### Pattern Grouping and Merging

```typescript
import { PatternGroupingEngine, PatternMergingEngine } from '@tw-enigma/core';

// Configure grouping
const groupingEngine = new PatternGroupingEngine({
  strategies: ['by-breakpoint', 'by-pseudo-class', 'by-property', 'hierarchical'],
  primaryStrategy: 'by-breakpoint',
  fallbackStrategy: 'by-property',
  enableHierarchical: true,
  maxGroupSize: 10,
  minGroupSize: 2,
  enableConflictResolution: true,
  conflictResolutionStrategy: 'merge-compatible',
  enableCaching: true,
});

// Configure merging
const mergingEngine = new PatternMergingEngine({
  enableMerging: true,
  mergeStrategies: ['mobile-first', 'specificity-based'],
  defaultMergeStrategy: 'mobile-first',
  enableConflictResolution: true,
  conflictResolutionStrategy: 'preserve-important',
  preserveImportantDeclarations: true,
  enablePreMergeValidation: true,
  enablePostMergeValidation: true,
});

// Group and merge patterns
const patterns = [
  { class: 'text-red-500', breakpoint: null, pseudo: [] },
  { class: 'sm:text-blue-500', breakpoint: 'sm', pseudo: [] },
  { class: 'md:text-green-500', breakpoint: 'md', pseudo: [] },
  { class: 'hover:text-gray-800', breakpoint: null, pseudo: ['hover'] },
  { class: 'sm:hover:text-gray-900', breakpoint: 'sm', pseudo: ['hover'] },
];

// Group patterns
const groupingResult = groupingEngine.groupPatterns(patterns);
console.log('Groups created:', groupingResult.groups.length);

// Merge compatible patterns
const mergingResult = mergingEngine.mergePatterns(patterns);
console.log('Patterns merged:', mergingResult.mergedPatterns.length);
console.log('Merge conflicts:', mergingResult.conflicts.length);
```

## Integration Scenarios

### Build System Integration

```typescript
// webpack.config.js or vite.config.js integration
import { ResponsiveOptimizationEngine } from '@tw-enigma/core';

class TailwindEnigmaPlugin {
  constructor(options = {}) {
    this.engine = new ResponsiveOptimizationEngine({
      enablePseudoClassOptimization: true,
      enableBreakpointGrouping: true,
      enableComplexPatternHandling: true,
      aggressiveOptimization: options.aggressive || false,
      ...options,
    });
  }

  apply(compiler) {
    compiler.hooks.compilation.tap('TailwindEnigmaPlugin', (compilation) => {
      compilation.hooks.processAssets.tapAsync('TailwindEnigmaPlugin', async (assets, callback) => {
        try {
          for (const [filename, asset] of Object.entries(assets)) {
            if (filename.endsWith('.css')) {
              const source = asset.source();
              const optimized = await this.optimizeCSS(source);

              compilation.updateAsset(filename, new RawSource(optimized));
            }
          }
          callback();
        } catch (error) {
          callback(error);
        }
      });
    });
  }

  async optimizeCSS(cssContent) {
    // Extract classes from CSS
    const classMatches = cssContent.match(/\.[a-zA-Z][\w-]*(?::[a-zA-Z][\w-]*)*/g);
    const classes = classMatches ? classMatches.map((c) => c.substring(1)) : [];

    if (classes.length === 0) return cssContent;

    // Optimize classes
    const result = await this.engine.optimizeClasses(classes);

    // Replace in CSS (simplified)
    let optimizedCSS = cssContent;
    result.originalClasses.forEach((original, index) => {
      const optimized = result.optimizedClasses[index];
      if (original !== optimized) {
        optimizedCSS = optimizedCSS.replace(
          new RegExp(`\\.${escapeRegex(original)}\\b`, 'g'),
          `.${optimized}`
        );
      }
    });

    return optimizedCSS;
  }
}

function escapeRegex(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
```

### React Component Integration

```typescript
import React, { useMemo } from 'react';
import { ResponsiveOptimizationEngine } from '@tw-enigma/core';

// Hook for optimizing classes
function useOptimizedClasses(classes: string[], dependencies: any[] = []) {
  return useMemo(async () => {
    const engine = new ResponsiveOptimizationEngine({
      enablePseudoClassOptimization: true,
      enableBreakpointGrouping: true,
      enableCaching: true,
    });

    const result = await engine.optimizeClasses(classes);
    return result.optimizedClasses.join(' ');
  }, [classes.join(' '), ...dependencies]);
}

// Component with optimized classes
function OptimizedButton({ size = 'md', variant = 'primary', ...props }) {
  const baseClasses = [
    'inline-flex', 'items-center', 'justify-center',
    'rounded-md', 'font-medium', 'transition-colors',
    'focus:outline-none', 'focus:ring-2', 'focus:ring-offset-2',
  ];

  const sizeClasses = {
    sm: ['px-3', 'py-1.5', 'text-sm'],
    md: ['px-4', 'py-2', 'text-base'],
    lg: ['px-6', 'py-3', 'text-lg'],
  };

  const variantClasses = {
    primary: [
      'bg-blue-600', 'text-white', 'hover:bg-blue-700',
      'focus:ring-blue-500', 'disabled:bg-blue-300',
    ],
    secondary: [
      'bg-gray-200', 'text-gray-900', 'hover:bg-gray-300',
      'focus:ring-gray-500', 'disabled:bg-gray-100',
    ],
  };

  const allClasses = [
    ...baseClasses,
    ...sizeClasses[size],
    ...variantClasses[variant],
  ];

  const optimizedClassName = useOptimizedClasses(allClasses, [size, variant]);

  return (
    <button className={optimizedClassName} {...props} />
  );
}
```

## Performance Optimization

### Caching Strategy

```typescript
// Global cache configuration
const cacheConfig = {
  enableCaching: true,
  maxCacheSize: 5000,
  cacheStrategy: 'lru', // Least Recently Used
  enablePerformanceMonitoring: true,
};

// Engine with optimized caching
const performanceEngine = new ResponsiveOptimizationEngine({
  ...cacheConfig,
  enableParallelProcessing: true,
  parallelThreshold: 200, // Process in parallel if > 200 classes
  aggressiveOptimization: true,
});

// Batch processing for large datasets
async function processBatches(allClasses: string[], batchSize = 500) {
  const batches = [];
  for (let i = 0; i < allClasses.length; i += batchSize) {
    batches.push(allClasses.slice(i, i + batchSize));
  }

  const results = await Promise.all(
    batches.map((batch) => performanceEngine.optimizeClasses(batch))
  );

  // Combine results
  const combinedResult = {
    optimizedClasses: results.flatMap((r) => r.optimizedClasses),
    originalClasses: results.flatMap((r) => r.originalClasses),
    metrics: results.reduce(
      (acc, r) => ({
        totalTime: acc.totalTime + r.metrics.totalTime,
        cacheHits: acc.cacheHits + r.metrics.cacheHits,
        cacheMisses: acc.cacheMisses + r.metrics.cacheMisses,
      }),
      { totalTime: 0, cacheHits: 0, cacheMisses: 0 }
    ),
  };

  return combinedResult;
}
```

### Memory Management

```typescript
// Memory-conscious configuration
const memoryOptimizedEngine = new ResponsiveOptimizationEngine({
  enableCaching: true,
  maxCacheSize: 1000, // Smaller cache
  enableParallelProcessing: false, // Disable to save memory
  aggressiveOptimization: false, // Less memory-intensive
  includeOptimizationMetrics: false, // Skip metrics to save memory
  errorReporting: 'none', // Don't collect errors
});

// Process in smaller chunks
async function memoryEfficientProcessing(classes: string[]) {
  const chunkSize = 100;
  const results = [];

  for (let i = 0; i < classes.length; i += chunkSize) {
    const chunk = classes.slice(i, i + chunkSize);
    const result = await memoryOptimizedEngine.optimizeClasses(chunk);

    results.push({
      optimized: result.optimizedClasses,
      original: result.originalClasses,
    });

    // Clear cache periodically to manage memory
    if (i % 1000 === 0) {
      memoryOptimizedEngine.clearCache();
    }
  }

  return results;
}
```

## Error Handling

### Comprehensive Error Handling

```typescript
import { OptimizationError, ValidationError, ConfigurationError } from '@tw-enigma/core';

async function robustOptimization(classes: string[]) {
  const engine = new ResponsiveOptimizationEngine({
    strictMode: false, // Allow recovery from errors
    errorReporting: 'collect',
    maxErrors: 100,
  });

  try {
    const result = await engine.optimizeClasses(classes);

    // Handle warnings
    if (result.warnings.length > 0) {
      console.warn('Optimization warnings:');
      result.warnings.forEach((warning) => {
        console.warn(`- ${warning.type}: ${warning.message}`);
      });
    }

    // Handle non-fatal errors
    if (result.errors.length > 0) {
      console.error('Optimization errors (non-fatal):');
      result.errors.forEach((error) => {
        console.error(`- ${error.code}: ${error.message}`);
        if (error.suggestions.length > 0) {
          console.log('  Suggestions:', error.suggestions);
        }
      });
    }

    return {
      success: true,
      result,
      fallbackUsed: result.errors.length > 0,
    };
  } catch (error) {
    if (error instanceof ValidationError) {
      console.error('Validation failed:', error.message);
      console.error('Rule:', error.validationRule);
      console.error('Invalid value:', error.invalidValue);

      // Try with relaxed validation
      return retryWithRelaxedValidation(classes);
    } else if (error instanceof ConfigurationError) {
      console.error('Configuration error:', error.message);
      console.error('Key:', error.configurationKey);
      console.error('Provided:', error.providedValue);

      // Try with default configuration
      return retryWithDefaults(classes);
    } else if (error instanceof OptimizationError) {
      console.error('Optimization failed:', error.message);
      console.error('Code:', error.code);
      console.error('Context:', error.context);

      if (error.suggestions.length > 0) {
        console.log('Suggestions:', error.suggestions);
      }

      // Return original classes as fallback
      return {
        success: false,
        result: { optimizedClasses: classes, originalClasses: classes },
        fallbackUsed: true,
        error: error.message,
      };
    } else {
      console.error('Unexpected error:', error);
      throw error;
    }
  }
}

async function retryWithRelaxedValidation(classes: string[]) {
  const relaxedEngine = new ResponsiveOptimizationEngine({
    strictMode: false,
    strictBreakpointOrder: false,
    enforceLVHAOrder: false,
    errorReporting: 'console',
  });

  try {
    const result = await relaxedEngine.optimizeClasses(classes);
    return { success: true, result, fallbackUsed: true };
  } catch (error) {
    return {
      success: false,
      result: { optimizedClasses: classes, originalClasses: classes },
      fallbackUsed: true,
      error: error.message,
    };
  }
}

async function retryWithDefaults(classes: string[]) {
  const defaultEngine = new ResponsiveOptimizationEngine({
    enablePseudoClassOptimization: true,
    enableBreakpointGrouping: true,
    enableComplexPatternHandling: false,
    strictMode: false,
  });

  try {
    const result = await defaultEngine.optimizeClasses(classes);
    return { success: true, result, fallbackUsed: true };
  } catch (error) {
    return {
      success: false,
      result: { optimizedClasses: classes, originalClasses: classes },
      fallbackUsed: true,
      error: error.message,
    };
  }
}
```

### Input Validation and Sanitization

```typescript
function validateAndSanitizeClasses(classes: string[]): string[] {
  return classes
    .filter(Boolean) // Remove empty strings
    .filter((cls) => typeof cls === 'string') // Ensure strings
    .map((cls) => cls.trim()) // Trim whitespace
    .filter((cls) => cls.length > 0) // Remove empty after trim
    .filter((cls) => /^[a-zA-Z][\w-]*(?::[a-zA-Z][\w-]*)*$/.test(cls)) // Basic CSS class validation
    .slice(0, 10000); // Limit to prevent memory issues
}

async function safeOptimization(rawClasses: any[]) {
  try {
    // Validate and sanitize input
    const validClasses = validateAndSanitizeClasses(rawClasses);

    if (validClasses.length === 0) {
      return {
        success: false,
        error: 'No valid classes provided',
        result: { optimizedClasses: [], originalClasses: [] },
      };
    }

    if (validClasses.length !== rawClasses.length) {
      console.warn(`Filtered ${rawClasses.length - validClasses.length} invalid classes`);
    }

    // Proceed with optimization
    return await robustOptimization(validClasses);
  } catch (error) {
    return {
      success: false,
      error: error.message,
      result: { optimizedClasses: [], originalClasses: [] },
    };
  }
}
```

This comprehensive guide provides practical examples for implementing responsive and pseudo-class optimization in various scenarios, from basic usage to advanced integration patterns and robust error handling.
