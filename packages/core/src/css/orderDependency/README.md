# CSS Order Dependency Handling

A comprehensive system for preserving CSS cascade order and specificity during optimization operations in TW-Enigma.

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Core Components](#core-components)
- [Configuration](#configuration)
- [Usage Examples](#usage-examples)
- [Error Handling](#error-handling)
- [Integration](#integration)
- [Troubleshooting](#troubleshooting)

## Overview

The CSS Order Dependency Handling system ensures that CSS optimization processes maintain the correct cascade order and specificity relationships between rules. This prevents visual regressions that can occur when CSS rules are reordered without considering their dependencies.

### Key Features

- **Order Preservation Analysis**: Identifies critical order dependencies between CSS rules
- **Dependency Detection**: Detects various types of dependencies (specificity, cascade, order, etc.)
- **Specificity Calculation**: Calculates and analyzes CSS specificity conflicts
- **Safe Reordering**: Provides algorithms for safely reordering CSS rules
- **Conflict Reporting**: Generates comprehensive reports of potential conflicts
- **Configurable Strictness**: Adjustable settings for different optimization scenarios

## Architecture

The system follows a modular architecture with clear separation of concerns:

```
CSS Order Dependency Handling
├── Order Preservation Analysis    (Analyzes rule dependencies)
├── Dependency Detection Engine    (Detects rule relationships)
├── Specificity Calculator        (Computes CSS specificity)
├── Reordering Logic Engine       (Safe rule reordering)
├── Conflict Reporter            (Generates warnings/reports)
└── Configuration System         (Manages settings)
```

### Data Flow

1. **Input**: CSS rules are parsed and indexed
2. **Analysis**: Order preservation analysis identifies dependencies
3. **Detection**: Dependency engine finds rule relationships
4. **Calculation**: Specificity calculator computes rule weights
5. **Processing**: Reordering logic determines safe optimizations
6. **Output**: Conflict reporter generates warnings and recommendations

## Core Components

### OrderPreservationAnalyzer

The main analyzer that coordinates all dependency analysis operations.

```typescript
import { OrderPreservationAnalyzer } from './orderAnalysis';

const analyzer = new OrderPreservationAnalyzer({
  strictness: 'balanced',
  enableCaching: true,
});

const analysis = await analyzer.analyzeOrder(cssRules);
console.log(`Found ${analysis.constraints.length} order constraints`);
```

### DependencyDetectionEngine

Detects various types of dependencies between CSS rules:

- **Specificity Dependencies**: Rules with overlapping selectors
- **Cascade Dependencies**: Rules that depend on source order
- **Order Dependencies**: Rules with explicit ordering requirements
- **Reset Dependencies**: Rules that reset properties set by others
- **Fallback Dependencies**: Vendor prefix and feature query fallbacks

```typescript
import { DependencyDetectionEngine } from './dependencyDetection';

const detector = new DependencyDetectionEngine(config);
const dependencies = await detector.detectDependencies(rules);
```

### SpecificityCalculator

Calculates CSS specificity and identifies conflicts:

```typescript
import { SpecificityCalculator } from './specificityCalculation';

const calculator = new SpecificityCalculator(config);
const specificity = calculator.calculateSpecificity('.btn.primary');
// Returns: { specificity: [0, 0, 2, 0], weight: 20, ... }
```

### ReorderingLogicEngine

Provides safe CSS rule reordering with conflict detection:

```typescript
import { ReorderingLogicEngine } from './reorderingLogic';

const reorderer = new ReorderingLogicEngine(config);
const result = await reorderer.reorderRules(rules);

if (result.isSafe) {
  console.log('Safe to reorder:', result.newOrder);
} else {
  console.log('Conflicts found:', result.conflicts);
}
```

### ConflictReporter

Generates detailed reports in multiple formats:

```typescript
import { ConflictReporter } from './conflictReporting';

const reporter = new ConflictReporter(config);
const reports = reporter.generateReport(conflicts, rules);

// Multiple output formats: console, JSON, HTML, Markdown
console.log(reports[0]); // Console-formatted report
```

## Configuration

The system provides extensive configuration options through the `OrderHandlingConfig` class:

### Basic Configuration

```typescript
import { OrderHandlingConfig } from './configuration';

const config = new OrderHandlingConfig({
  strictness: 'balanced',
  enableDependencyDetection: true,
  enableAutoResolution: true,
  maxProcessingTime: 15000,
  enableCaching: true,
  cacheSize: 500,
});
```

### Strictness Levels

- **`strict`**: Maximum preservation, minimal optimization
- **`balanced`**: Balanced approach (default)
- **`permissive`**: Aggressive optimization with relaxed constraints
- **`preserve-all`**: No reordering, analysis only

### Advanced Configuration

```typescript
// Configure warning behavior
config.configureWarnings({
  suppressTypes: [ConflictType.CASCADE_INTERFERENCE],
  escalateTypes: [ConflictType.CIRCULAR_DEPENDENCY],
  reportFormats: [ReportFormat.CONSOLE, ReportFormat.JSON],
});

// Configure performance settings
config.configurePerformance({
  maxProcessingTime: 30000,
  enableCaching: true,
  cacheSize: 1000,
  enableParallelProcessing: true,
});
```

## Usage Examples

### Basic Order Analysis

```typescript
import { createOrderHandlingSystem } from './factory';

// Create system with default configuration
const system = createOrderHandlingSystem();

// Analyze CSS rules
const cssRules = [
  {
    id: 'rule1',
    selector: '.btn',
    declarations: [{ property: 'color', value: 'blue' }],
    lineNumber: 10,
    sourceFile: 'styles.css',
    type: 'style',
    important: false,
  },
  // ... more rules
];

const analysis = await system.analyzeOrder(cssRules);
console.log('Analysis complete:', analysis);
```

### Custom Configuration

```typescript
import { OrderHandlingConfig, createOrderHandlingSystem } from './';

// Create custom configuration
const config = new OrderHandlingConfig({
  strictness: 'strict',
  enableDependencyDetection: true,
  reportFormat: [ReportFormat.JSON, ReportFormat.HTML],
  ignoredProperties: ['z-index'],
  preserveOrderSelectors: ['*:hover', '*:focus', '*:active'],
});

// Create system with custom config
const system = createOrderHandlingSystem(config);
```

### Handling Results

```typescript
const result = await system.analyzeAndReorder(rules);

if (result.conflicts.length > 0) {
  console.log('Conflicts detected:');
  result.conflicts.forEach((conflict) => {
    console.log(`- ${conflict.type}: ${conflict.description}`);
  });
}

if (result.isSafe) {
  console.log('Safe to apply optimizations');
  // Apply the new order
  const optimizedRules = result.newOrder.map((id) => rules.find((rule) => rule.id === id));
} else {
  console.log('Optimization not recommended due to conflicts');
}
```

## Error Handling

The system provides comprehensive error handling with specific error types:

### ConfigurationError

Thrown when configuration validation fails:

```typescript
try {
  const config = new OrderHandlingConfig({
    strictness: 'invalid-level', // Invalid strictness
  });
} catch (error) {
  if (error instanceof ConfigurationError) {
    console.error('Configuration error:', error.message);
    console.error('Field:', error.field);
  }
}
```

### Common Error Scenarios

1. **Invalid Configuration**: Invalid strictness levels, negative cache sizes
2. **Processing Timeouts**: Analysis exceeding time limits
3. **Memory Limits**: Processing too many rules
4. **Invalid CSS**: Malformed selectors or declarations

### Error Recovery

```typescript
const analyzer = new OrderPreservationAnalyzer(config);

try {
  const result = await analyzer.analyzeOrder(rules);
} catch (error) {
  if (error.message.includes('timeout')) {
    // Retry with reduced strictness
    config.setStrictness('permissive');
    const result = await analyzer.analyzeOrder(rules);
  }
}
```

## Integration

### Build Tool Integration

#### Webpack Plugin

```javascript
const { CSSOrderDependencyPlugin } = require('tw-enigma');

module.exports = {
  plugins: [
    new CSSOrderDependencyPlugin({
      strictness: 'balanced',
      reportPath: './css-analysis-report.json',
    }),
  ],
};
```

#### PostCSS Plugin

```javascript
const postcss = require('postcss');
const { cssOrderDependencyPlugin } = require('tw-enigma');

postcss([
  cssOrderDependencyPlugin({
    strictness: 'strict',
    enableReporting: true,
  }),
]).process(css, { from: 'input.css', to: 'output.css' });
```

### API Integration

```typescript
import { TwEnigma } from 'tw-enigma';

const enigma = new TwEnigma({
  orderDependency: {
    strictness: 'balanced',
    enableDependencyDetection: true,
    reportFormat: ['console', 'json'],
  },
});

const result = await enigma.optimize(cssContent);
```

## Troubleshooting

### Performance Issues

**Problem**: Analysis takes too long
**Solution**:

```typescript
config.configurePerformance({
  maxProcessingTime: 5000,
  enableCaching: true,
  enableParallelProcessing: true,
});
```

**Problem**: High memory usage
**Solution**:

```typescript
config.updateConfig({
  cacheSize: 100, // Reduce cache size
  enableParallelProcessing: false,
});
```

### False Positives

**Problem**: Too many conflict warnings
**Solution**:

```typescript
config.configureWarnings({
  suppressTypes: [ConflictType.CASCADE_INTERFERENCE, ConflictType.INHERITANCE],
});
```

**Problem**: Rules incorrectly marked as dependent
**Solution**:

```typescript
config.updateConfig({
  strictness: 'permissive',
  ignoredProperties: ['z-index', 'position'],
});
```

### Debugging

Enable detailed logging:

```typescript
const config = new OrderHandlingConfig({
  performanceTracking: true,
  reportFormat: [ReportFormat.CONSOLE, ReportFormat.JSON],
});

// Check statistics
const stats = config.getStats();
console.log('Enabled features:', stats.enabledFeatures);
```

## Best Practices

1. **Start with Balanced Mode**: Use `balanced` strictness for most projects
2. **Review Reports**: Always review conflict reports before applying optimizations
3. **Test Thoroughly**: Test visual output after any reordering
4. **Use Caching**: Enable caching for large projects
5. **Monitor Performance**: Track processing times and memory usage
6. **Gradual Optimization**: Start conservative, increase optimization gradually

## API Reference

For detailed API documentation, see the individual module files:

- [`types.ts`](./types.ts) - Type definitions
- [`constants.ts`](./constants.ts) - Configuration constants
- [`orderAnalysis.ts`](./orderAnalysis.ts) - Order preservation analysis
- [`dependencyDetection.ts`](./dependencyDetection.ts) - Dependency detection
- [`specificityCalculation.ts`](./specificityCalculation.ts) - Specificity calculation
- [`reorderingLogic.ts`](./reorderingLogic.ts) - Reordering algorithms
- [`conflictReporting.ts`](./conflictReporting.ts) - Conflict reporting
- [`configuration.ts`](./configuration.ts) - Configuration management
- [`factory.ts`](./factory.ts) - Factory functions

## Contributing

When contributing to this module:

1. Maintain backward compatibility
2. Add comprehensive tests for new features
3. Update documentation for any API changes
4. Follow the existing code style and patterns
5. Consider performance implications of changes
