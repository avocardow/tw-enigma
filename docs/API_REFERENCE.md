# API Reference

This document provides comprehensive API reference documentation for the Tailwind Enigma packages.

## Table of Contents

- [Package Overview](#package-overview)
- [@tw-enigma/core API](#tw-enigmacore-api)
  - [Core Engine](#core-engine)
  - [CSS Generation](#css-generation)
  - [Processors](#processors)
  - [Configuration](#configuration)
  - [Utilities](#utilities)
  - [Types](#types)
- [@tw-enigma/cli API](#tw-enigmacli-api)
  - [Commands](#commands)
  - [CLI Utilities](#cli-utilities)
- [Integration Examples](#integration-examples)
- [Error Handling](#error-handling)
- [TypeScript Support](#typescript-support)

---

## Package Overview

Tailwind Enigma consists of two main packages:

- **@tw-enigma/core**: Core optimization engine with CSS generation, analysis, and processing capabilities
- **@tw-enigma/cli**: Command-line interface for interacting with the optimization engine

## @tw-enigma/core API

### Core Engine

#### `EnhancedCSSGenerator`

The main CSS generation engine that provides intelligent optimization and code generation.

```typescript
import { EnhancedCSSGenerator } from '@tw-enigma/core';

class EnhancedCSSGenerator {
  constructor(config: EnigmaConfig, frequencyAnalyzer: FrequencyAnalyzer, enablePostCSS?: boolean);

  async generateEnhancedCSS(
    classFrequencies: Map<string, number>,
    options?: Partial<CssGenerationOptions>
  ): Promise<GeneratedCSS>;

  getPostCSSMetrics(): any;

  async updatePostCSSConfig(updates: {
    optimizationLevel?: 'none' | 'basic' | 'standard' | 'aggressive';
    enableTailwindOptimizer?: boolean;
    enableCSSMinifier?: boolean;
    enableSourceMapper?: boolean;
    customPluginConfigs?: Record<string, any>;
  }): Promise<void>;
}
```

**Usage Example:**

```typescript
import { EnhancedCSSGenerator, loadConfig } from '@tw-enigma/core';

const config = await loadConfig();
const generator = new EnhancedCSSGenerator(config, frequencyAnalyzer);

const result = await generator.generateEnhancedCSS(classFrequencies, {
  strategy: 'mixed',
  useApplyDirective: true,
  sortingStrategy: 'frequency',
});

console.log(result.css);
console.log(`Generated ${result.rules.length} CSS rules`);
```

### CSS Generation

#### Core Functions

##### `generateOptimizedCss()`

Generate optimized CSS from class patterns or frequency data.

```typescript
// Overload 1: From patterns
function generateOptimizedCss(
  patterns: AggregatedClassData[],
  options?: Partial<CssGenerationOptions>
): CssGenerationResult;

// Overload 2: From frequency map
function generateOptimizedCss(
  frequencyMap: PatternFrequencyMap,
  nameOptions: any,
  cssOptions: CssGenerationOptions
): CssGenerationResult;
```

**Parameters:**

- `patterns`: Array of aggregated class data from analysis
- `frequencyMap`: Map of class patterns to their frequency
- `options`: Configuration options for CSS generation

**Returns:** `CssGenerationResult` containing generated CSS, rules, and metadata

**Example:**

```typescript
import { generateOptimizedCss } from '@tw-enigma/core';

const result = generateOptimizedCss(patterns, {
  strategy: 'mixed',
  useApplyDirective: true,
  sortingStrategy: 'frequency',
  commentLevel: 'detailed',
});

console.log('Generated CSS:', result.css);
console.log('Compression ratio:', result.statistics.compressionRatio);
```

##### `generateCssRules()`

Generate CSS rules from class patterns.

```typescript
function generateCssRules(
  patterns: AggregatedClassData[] | { frequencyMap: Map<string, number>; [key: string]: any },
  options?: CssGenerationOptions
): CssRule[];
```

**Example:**

```typescript
const rules = generateCssRules(patterns, {
  selectorNaming: 'pretty',
  minimumFrequency: 3,
});

rules.forEach((rule) => {
  console.log(`${rule.selector} (${rule.frequency} uses)`);
});
```

#### Apply Directives

##### `generateApplyDirective()`

Generate Tailwind CSS `@apply` directives from class lists.

```typescript
function generateApplyDirective(classes: string[], options: CssGenerationOptions): ApplyDirective;
```

**Example:**

```typescript
const directive = generateApplyDirective(['text-lg', 'font-bold', 'text-blue-600'], options);

console.log(directive.optimized); // "@apply text-lg font-bold text-blue-600"
```

##### `validateApplyDirective()`

Validate apply directive syntax and compatibility.

```typescript
function validateApplyDirective(
  directive: ApplyDirective | string
): Array<{ type: 'error' | 'warning'; message: string }> | boolean;
```

#### Pattern Classification

##### `classifyPattern()`

Classify CSS patterns into atomic, utility, or component categories.

```typescript
function classifyPattern(
  pattern: AggregatedClassData,
  options: CssGenerationOptions
): PatternClassification;
```

**Example:**

```typescript
const classification = classifyPattern(pattern, options);

console.log(`Pattern type: ${classification.type}`);
console.log(`Confidence: ${classification.confidence}`);
console.log(`Recommended strategy: ${classification.recommendedStrategy}`);
```

#### Sorting and Organization

##### `sortCssRules()`

Sort CSS rules using various strategies.

```typescript
function sortCssRules(
  rules: CssRule[],
  strategy: CssGenerationOptions['sortingStrategy'] | CssGenerationOptions,
  customSortFn?: (a: CssRule, b: CssRule) => number
): CssRule[];
```

**Strategies:**

- `"frequency"`: Sort by usage frequency
- `"specificity"`: Sort by CSS specificity
- `"alphabetical"`: Sort alphabetically
- `"custom"`: Use custom sort function

**Example:**

```typescript
const sortedRules = sortCssRules(rules, 'frequency');
const customSorted = sortCssRules(rules, 'custom', (a, b) => {
  return a.complexity - b.complexity;
});
```

#### Comments and Documentation

##### `generateCssComments()`

Generate descriptive comments for CSS rules.

```typescript
function generateCssComments(
  rules: CssRule[] | CssRule,
  statistics: CssGenerationStatistics,
  commentLevel?: CssGenerationOptions['commentLevel']
): string;
```

**Comment Levels:**

- `"none"`: No comments
- `"minimal"`: Basic rule descriptions
- `"detailed"`: Comprehensive information
- `"verbose"`: Full analysis and recommendations

#### Types and Interfaces

##### `CssGenerationOptions`

Configuration options for CSS generation.

```typescript
interface CssGenerationOptions {
  strategy: 'atomic' | 'utility' | 'component' | 'mixed';
  useApplyDirective: boolean;
  sortingStrategy: 'specificity' | 'frequency' | 'alphabetical' | 'custom';
  commentLevel: 'none' | 'minimal' | 'detailed' | 'verbose';
  selectorNaming: 'sequential' | 'frequency-optimized' | 'pretty' | 'custom';
  minimumFrequency: number;
  includeSourceMaps: boolean;
  formatOutput: boolean;
  maxRulesPerFile: number;
  enableOptimizations: boolean;
  customSortFunction?: (a: CssRule, b: CssRule) => number;
  customNamingFunction?: (pattern: AggregatedClassData) => string;
  enableValidation: boolean;
  skipInvalidClasses: boolean;
  warnOnInvalidClasses: boolean;
}
```

##### `CssGenerationResult`

Result object from CSS generation operations.

```typescript
interface CssGenerationResult {
  css: string;
  rules: CssRule[];
  sourceClasses: string[];
  statistics: CssGenerationStatistics;
  metadata: {
    generatedAt: string;
    strategy: string;
    totalInputClasses: number;
    compressionAchieved: boolean;
    validationMetadata?: {
      totalClassesValidated: number;
      validClasses: number;
      invalidClasses: number;
      warningsGenerated: number;
      skippedClasses: number;
    };
  };
  warnings: string[];
  errors: string[];
  sourceMap?: string;
}
```

##### `CssRule`

Individual CSS rule representation.

```typescript
interface CssRule {
  selector: string;
  declarations: string[];
  applyDirective?: string;
  frequency: number;
  patternType: 'atomic' | 'utility' | 'component';
  sourceClasses: string[];
  complexity: number;
  coOccurrenceStrength: number;
}
```

### Processors

#### HTML Processing

##### `htmlExtractor`

Extract CSS classes from HTML files.

```typescript
import { htmlExtractor } from '@tw-enigma/core';

// Extract classes from HTML content
const classes = await htmlExtractor.extract(htmlContent, options);
```

##### `htmlRewriter`

Rewrite HTML files with optimized CSS classes.

```typescript
import { htmlRewriter } from '@tw-enigma/core';

// Rewrite HTML with optimized classes
const rewrittenHtml = await htmlRewriter.rewrite(htmlContent, classMapping);
```

#### JavaScript Processing

##### `jsExtractor`

Extract CSS classes from JavaScript/TypeScript files.

```typescript
import { jsExtractor } from '@tw-enigma/core';

// Extract classes from JS/TS content
const classes = await jsExtractor.extract(jsContent, options);
```

##### `jsRewriter`

Rewrite JavaScript files with optimized CSS classes.

```typescript
import { jsRewriter } from '@tw-enigma/core';

// Rewrite JS with optimized classes
const rewrittenJs = await jsRewriter.rewrite(jsContent, classMapping);
```

#### Pattern Analysis

##### `patternAnalysis`

Analyze CSS class usage patterns.

```typescript
import { patternAnalysis } from '@tw-enigma/core';

// Analyze patterns in extracted data
const analysis = await patternAnalysis.analyze(extractedData, options);
```

### Configuration

#### `loadConfig()`

Load and validate Enigma configuration.

```typescript
import { loadConfig } from '@tw-enigma/core';

const config = await loadConfig(configPath);
```

#### Configuration Types

##### `EnigmaConfig`

Main configuration interface for the Enigma engine.

```typescript
interface EnigmaConfig {
  // Core optimization settings
  optimization: {
    strategy: 'atomic' | 'utility' | 'component' | 'mixed';
    enableMinification: boolean;
    preserveComments: boolean;
    generateSourceMaps: boolean;
  };

  // File processing settings
  files: {
    input: string[];
    output: string;
    ignore: string[];
    extensions: string[];
  };

  // CSS generation settings
  css: CssGenerationOptions;

  // Performance settings
  performance: {
    maxConcurrency: number;
    memoryLimit: number;
    timeout: number;
  };
}
```

### Utilities

#### `logger`

Structured logging utility.

```typescript
import { logger } from '@tw-enigma/core';

logger.info('Processing files...', { count: files.length });
logger.error('Failed to process file', { file: path, error });
logger.debug('Analysis complete', { duration: time });
```

#### `fileDiscovery`

File discovery and filtering utilities.

```typescript
import { fileDiscovery } from '@tw-enigma/core';

// Discover files matching patterns
const files = await fileDiscovery.find(['src/**/*.{js,ts,jsx,tsx}'], {
  ignore: ['node_modules/**', 'dist/**'],
});
```

#### `pathUtils`

Path manipulation utilities optimized for the Enigma workflow.

```typescript
import { pathUtils } from '@tw-enigma/core';

// Normalize and resolve paths
const normalized = pathUtils.normalize(inputPath);
const relative = pathUtils.relative(from, to);
```

### Error Classes

#### `CssGenerationError`

Base error class for CSS generation issues.

```typescript
class CssGenerationError extends Error {
  constructor(
    message: string,
    public code: string,
    public context?: Record<string, unknown>
  );
}
```

#### `InvalidCssError`

Error for invalid CSS syntax or structure.

```typescript
class InvalidCssError extends CssGenerationError {
  constructor(
    message: string,
    public invalidCss: string,
    public reason?: string
  );
}
```

#### `ApplyDirectiveError`

Error for invalid @apply directive usage.

```typescript
class ApplyDirectiveError extends CssGenerationError {
  constructor(
    message: string,
    public directive: string,
    public classes?: string[]
  );
}
```

---

## @tw-enigma/cli API

### Commands

The CLI provides several commands for interacting with the Enigma engine:

#### `init-config`

Initialize Enigma configuration for a project.

```bash
npx @tw-enigma/cli init-config [options]
```

**Options:**

- `--force`: Overwrite existing configuration
- `--template <name>`: Use a specific template
- `--output <path>`: Specify output directory

#### `css-config`

Configure CSS generation settings.

```bash
npx @tw-enigma/cli css-config [options]
```

**Options:**

- `--strategy <strategy>`: Set optimization strategy
- `--apply-directives`: Enable @apply directive generation
- `--comments <level>`: Set comment verbosity level

### CLI Utilities

#### Version Information

```typescript
import { version, cliVersion, name } from '@tw-enigma/cli';

console.log(`${name} v${version}`);
```

#### Command Registration

```typescript
import { registerCommands } from '@tw-enigma/cli';
import { Command } from 'commander';

const program = new Command();
registerCommands(program);
```

---

## Integration Examples

### Basic CSS Optimization

```typescript
import { EnhancedCSSGenerator, loadConfig, fileDiscovery, htmlExtractor } from '@tw-enigma/core';

async function optimizeProject() {
  // Load configuration
  const config = await loadConfig();

  // Discover files
  const files = await fileDiscovery.find(config.files.input, {
    ignore: config.files.ignore,
  });

  // Extract classes
  const allClasses = new Map<string, number>();

  for (const file of files) {
    const content = await fs.readFile(file, 'utf8');
    const classes = await htmlExtractor.extract(content);

    classes.forEach((freq, className) => {
      allClasses.set(className, (allClasses.get(className) || 0) + freq);
    });
  }

  // Generate optimized CSS
  const generator = new EnhancedCSSGenerator(config, frequencyAnalyzer);
  const result = await generator.generateEnhancedCSS(allClasses, {
    strategy: 'mixed',
    useApplyDirective: true,
    commentLevel: 'detailed',
  });

  // Write output
  await fs.writeFile(config.files.output, result.css);

  console.log(`Generated ${result.rules.length} CSS rules`);
  console.log(`Compression ratio: ${result.statistics.compressionRatio}%`);
}
```

### Custom Plugin Integration

```typescript
import { EnhancedCSSGenerator } from '@tw-enigma/core';

const generator = new EnhancedCSSGenerator(config, frequencyAnalyzer);

// Configure PostCSS plugins
await generator.updatePostCSSConfig({
  optimizationLevel: 'aggressive',
  enableTailwindOptimizer: true,
  enableCSSMinifier: true,
  customPluginConfigs: {
    autoprefixer: { grid: true },
    cssnano: { preset: 'advanced' },
  },
});

const result = await generator.generateEnhancedCSS(classFrequencies);
```

### Framework Integration

#### React/Vite Integration

```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import { EnigmaVitePlugin } from '@tw-enigma/vite-plugin';

export default defineConfig({
  plugins: [
    EnigmaVitePlugin({
      strategy: 'mixed',
      useApplyDirective: true,
      outputPath: 'src/styles/optimized.css',
    }),
  ],
});
```

#### Webpack Integration

```javascript
// webpack.config.js
const { EnigmaWebpackPlugin } = require('@tw-enigma/webpack-plugin');

module.exports = {
  plugins: [
    new EnigmaWebpackPlugin({
      input: ['src/**/*.{js,jsx,ts,tsx}'],
      output: 'dist/optimized.css',
      strategy: 'component',
    }),
  ],
};
```

---

## Error Handling

### Best Practices

```typescript
import { CssGenerationError, InvalidCssError, ApplyDirectiveError } from '@tw-enigma/core';

try {
  const result = await generator.generateEnhancedCSS(classFrequencies);
} catch (error) {
  if (error instanceof InvalidCssError) {
    console.error('Invalid CSS:', error.invalidCss);
    console.error('Reason:', error.reason);
  } else if (error instanceof ApplyDirectiveError) {
    console.error('Invalid @apply directive:', error.directive);
    console.error('Problematic classes:', error.classes);
  } else if (error instanceof CssGenerationError) {
    console.error('CSS Generation failed:', error.message);
    console.error('Error code:', error.code);
    console.error('Context:', error.context);
  } else {
    console.error('Unexpected error:', error);
  }
}
```

### Error Recovery

```typescript
import { generateOptimizedCss } from '@tw-enigma/core';

const options = {
  strategy: 'mixed',
  enableValidation: true,
  skipInvalidClasses: true,
  warnOnInvalidClasses: true,
};

const result = generateOptimizedCss(patterns, options);

// Check for warnings
if (result.warnings.length > 0) {
  console.warn('Warnings during generation:');
  result.warnings.forEach((warning) => console.warn(warning));
}

// Check for validation errors
if (result.metadata.validationMetadata) {
  const validation = result.metadata.validationMetadata;
  console.log(`Validated ${validation.totalClassesValidated} classes`);
  console.log(`Valid: ${validation.validClasses}, Invalid: ${validation.invalidClasses}`);
}
```

---

## TypeScript Support

### Type Definitions

All packages include comprehensive TypeScript definitions. Import types directly:

```typescript
import type {
  CssGenerationOptions,
  CssGenerationResult,
  CssRule,
  EnigmaConfig,
  PatternClassification,
} from '@tw-enigma/core';
```

### Generic Types

```typescript
import type { AggregatedClassData } from '@tw-enigma/core';

function processPatterns<T extends AggregatedClassData>(
  patterns: T[],
  processor: (pattern: T) => void
): void {
  patterns.forEach(processor);
}
```

### Module Augmentation

Extend types for custom implementations:

```typescript
declare module '@tw-enigma/core' {
  interface CssGenerationOptions {
    customOption?: boolean;
  }

  interface EnigmaConfig {
    customSettings?: Record<string, any>;
  }
}
```

---

## Performance Considerations

### Memory Management

```typescript
// Process files in batches to manage memory
const batchSize = 100;
for (let i = 0; i < files.length; i += batchSize) {
  const batch = files.slice(i, i + batchSize);
  await processBatch(batch);
}
```

### Optimization Settings

```typescript
const performanceOptions = {
  maxRulesPerFile: 1000,
  enableOptimizations: true,
  minimumFrequency: 2, // Only include classes used 2+ times
  strategy: 'mixed' as const, // Most efficient strategy
};
```

### Monitoring

```typescript
const result = await generator.generateEnhancedCSS(classFrequencies);

console.log('Performance Metrics:');
console.log(`Generation time: ${result.statistics.generationTime}ms`);
console.log(`Memory usage: ${result.statistics.memoryUsage}MB`);
console.log(`Compression ratio: ${result.statistics.compressionRatio}%`);
```

---

For more examples and advanced usage patterns, see the [Examples](../examples/) directory and [Architecture Documentation](./ARCHITECTURE.md).
