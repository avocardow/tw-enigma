# Dynamic Class Generation Support

TW-Enigma provides comprehensive support for dynamic CSS class generation through template literals, JavaScript expressions, and runtime optimization. This guide covers the detection, parsing, and optimization of dynamic class patterns.

## Overview

Dynamic class generation allows developers to create CSS classes conditionally based on state, props, theme values, or other runtime conditions. TW-Enigma analyzes these patterns at build time and provides runtime optimization strategies.

### Key Features

- **Template Literal Detection**: Automatic detection of template literals containing CSS classes
- **AST-based Parsing**: Precise analysis using JavaScript/TypeScript Abstract Syntax Trees
- **Runtime API**: Efficient class generation with caching and optimization
- **Performance Optimization**: Multiple optimization strategies for different use cases
- **Framework Integration**: Support for React, Vue, Angular, and other frameworks

## Template Literal Detection

### Basic Usage

```typescript
import { TemplateLiteralDetector } from '@tw-enigma/core';

const detector = new TemplateLiteralDetector({
  includeTagged: true,
  includeMultiline: true,
  maxLength: 1000,
});

const source = `
const buttonClasses = \`px-4 py-2 \${variant === 'primary' ? 'bg-blue-500' : 'bg-gray-500'} rounded\`;
const cardClasses = css\`
  background: white;
  padding: \${spacing}rem;
  border-radius: 0.5rem;
\`;
`;

const result = detector.detect(source);
console.log(result.templates); // Array of detected templates
console.log(result.count); // Number of templates found
```

### Detection Options

```typescript
interface TemplateDetectionOptions {
  /** Include tagged template literals (e.g., css`...`, styled`...`) */
  includeTagged?: boolean;

  /** Include multiline templates */
  includeMultiline?: boolean;

  /** Maximum template length to analyze */
  maxLength?: number;

  /** Include nested templates */
  includeNested?: boolean;

  /** Custom tag names to specifically look for */
  targetTags?: string[];
}
```

### Template Match Structure

```typescript
interface TemplateLiteralMatch {
  /** Raw template literal content including backticks */
  raw: string;

  /** Processed content without backticks */
  content: string;

  /** Position information */
  start: number;
  end: number;
  location: SourceLocation;

  /** Template type information */
  isTagged: boolean;
  tagName?: string;

  /** Parsed components */
  staticParts: string[];
  expressions: Array<{
    content: string;
    start: number;
    end: number;
  }>;

  /** Detection confidence (0-1) */
  confidence: number;
}
```

## AST-based Parsing

For more precise analysis, use the AST-based parser:

```typescript
import { ASTTemplateParser } from '@tw-enigma/core';

const parser = new ASTTemplateParser({
  typescript: true,
  jsx: true,
  plugins: ['decorators', 'classProperties'],
});

const result = parser.parse(sourceCode, {
  filePath: 'components/Button.tsx',
  framework: 'react',
});

// Extract dynamic patterns
const patterns = parser.extractDynamicPatterns(result.templates);
```

### AST Template Structure

```typescript
interface ASTTemplateLiteral {
  /** Babel AST node */
  node: t.TemplateLiteral | t.TaggedTemplateExpression;

  /** Node path for transformations */
  path: NodePath<t.TemplateLiteral | t.TaggedTemplateExpression>;

  /** Static string parts */
  quasis: string[];

  /** Expression nodes */
  expressions: t.Expression[];

  /** Generated code for expressions */
  expressionCode: string[];

  /** Template metadata */
  isTagged: boolean;
  tagName?: string;
  location: SourceLocation;
  confidence: number;
}
```

## Runtime API

### Basic Class Generation

```typescript
import { DynamicClassAPI } from '@tw-enigma/core';

const api = new DynamicClassAPI({
  cache: true,
  cacheTTL: 300000, // 5 minutes
  optimization: 'basic',
});

// Generate classes from template
const result = await api.generateClasses(
  'px-4 py-2 ${variant === "primary" ? "bg-blue-500" : "bg-gray-500"}',
  {
    props: { variant: 'primary' },
    theme: { spacing: { lg: '1rem' } },
  }
);

console.log(result.classes); // "px-4 py-2 bg-blue-500"
console.log(result.cached); // false (first time)
console.log(result.optimizations); // Applied optimizations
```

### Pattern Registration

```typescript
// Register a dynamic pattern
const pattern: DynamicClassPattern = {
  id: 'button-variant',
  type: 'conditional',
  source: 'px-4 py-2 ${variant === "primary" ? "bg-blue-500" : "bg-gray-500"}',
  staticClasses: ['px-4', 'py-2'],
  expressions: [
    {
      content: 'variant === "primary" ? "bg-blue-500" : "bg-gray-500"',
      type: 'conditional',
      dependencies: ['variant'],
    },
  ],
  confidence: 0.95,
  location: { line: 10, column: 15, position: 250 },
};

api.registerPattern(pattern);

// Generate from registered pattern
const result = await api.generateFromPattern('button-variant', {
  props: { variant: 'secondary' },
});
```

### Custom Processors

```typescript
// Add custom class processor
api.addProcessor({
  name: 'responsive-processor',
  process: (classes, context) => {
    // Add responsive prefixes based on breakpoint
    if (context.breakpoint === 'mobile') {
      return classes.map((cls) => `sm:${cls}`);
    }
    return classes;
  },
  priority: 50,
});

// Add template processor
api.addTemplateProcessor({
  process: (template, context) => {
    // Replace theme variables
    return template.replace(/theme\.(\w+)/g, (match, key) => {
      return context.theme?.[key] || match;
    });
  },
  canProcess: (template) => template.includes('theme.'),
  priority: 100,
});
```

## Performance Optimization

### Optimization Strategies

```typescript
import { TemplateOptimizer } from '@tw-enigma/core';

const optimizer = new TemplateOptimizer({
  enableParsingCache: true,
  enablePatternCache: true,
  enableResultCache: true,
  cacheOptions: {
    parsing: { max: 1000, ttl: 600000 }, // 10 minutes
    patterns: { max: 500, ttl: 1800000 }, // 30 minutes
    results: { max: 2000, ttl: 300000 }, // 5 minutes
  },
  levels: {
    detection: 'balanced',
    caching: 'aggressive',
    processing: 'optimized',
  },
});

// Optimize detection
const { templates, optimizations } = optimizer.optimizeDetection(sourceCode);

// Batch optimization for multiple files
const sources = [
  /* array of source code strings */
];
const report = optimizer.batchOptimize(sources);

console.log(report.improvements.cacheHitRate); // 0.85
console.log(report.recommendations); // Optimization suggestions
```

### Optimization Levels

#### Detection Levels

- **fast**: Simple regex-based detection, fastest but less accurate
- **balanced**: Combination of regex and basic parsing (default)
- **thorough**: Full AST parsing, most accurate but slower

#### Caching Levels

- **minimal**: Basic result caching only
- **standard**: Parse, pattern, and result caching (default)
- **aggressive**: Extended TTL and larger cache sizes

#### Processing Levels

- **basic**: Simple expression evaluation
- **optimized**: Memoization and smart caching (default)
- **maximum**: Advanced optimizations with dependency analysis

### Memory Management

```typescript
// Monitor memory usage
const stats = api.getCacheStats();
console.log(stats.size); // Current cache size
console.log(stats.hitRate); // Cache hit rate
console.log(stats.avgGenerationTime); // Average generation time

// Optimize memory usage
const { freedMemory, optimizations } = optimizer.optimizeMemory();
console.log(`Freed ${freedMemory} bytes`);

// Clear caches when needed
api.clearCache();
optimizer.resetMetrics();
```

## Framework Integration

### React Integration

```typescript
import { useDynamicClasses } from '@tw-enigma/react';

function Button({ variant, size, children }) {
  const classes = useDynamicClasses(
    `px-4 py-2 ${variant === 'primary' ? 'bg-blue-500' : 'bg-gray-500'} ${size === 'large' ? 'text-lg' : 'text-sm'}`,
    { variant, size }
  );

  return <button className={classes}>{children}</button>;
}
```

### Vue Integration

```vue
<template>
  <button :class="buttonClasses">{{ children }}</button>
</template>

<script setup>
import { useDynamicClasses } from '@tw-enigma/vue';

const props = defineProps(['variant', 'size']);

const buttonClasses = useDynamicClasses(
  `px-4 py-2 ${props.variant === 'primary' ? 'bg-blue-500' : 'bg-gray-500'}`,
  () => ({ variant: props.variant, size: props.size })
);
</script>
```

### Angular Integration

```typescript
import { Component, Input } from '@angular/core';
import { DynamicClassService } from '@tw-enigma/angular';

@Component({
  selector: 'app-button',
  template: '<button [class]="buttonClasses">{{ children }}</button>',
})
export class ButtonComponent {
  @Input() variant: string = 'primary';
  @Input() size: string = 'medium';

  constructor(private dynamicClasses: DynamicClassService) {}

  get buttonClasses() {
    return this.dynamicClasses.generate(
      `px-4 py-2 ${this.variant === 'primary' ? 'bg-blue-500' : 'bg-gray-500'}`,
      { variant: this.variant, size: this.size }
    );
  }
}
```

## Common Patterns

### Conditional Classes

```typescript
// Simple conditional
const classes = `base-class ${condition ? 'conditional-class' : 'default-class'}`;

// Multiple conditions
const classes = `
  base-class
  ${isPrimary ? 'bg-blue-500' : ''}
  ${isLarge ? 'text-lg p-4' : 'text-sm p-2'}
  ${isDisabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-blue-600'}
`;

// Object-based conditions
const classes = Object.entries({
  'bg-blue-500': isPrimary,
  'bg-gray-500': !isPrimary,
  'text-lg': isLarge,
  'opacity-50': isDisabled,
})
  .filter(([cls, condition]) => condition)
  .map(([cls]) => cls)
  .join(' ');
```

### Theme-based Classes

```typescript
// Theme variables
const classes = `
  bg-${theme.primary}
  text-${theme.text}
  border-${theme.border}
  ${spacing[size]}
`;

// Responsive themes
const classes = `
  ${breakpoint === 'mobile' ? 'px-2 py-1' : 'px-4 py-2'}
  ${darkMode ? 'bg-gray-800 text-white' : 'bg-white text-gray-800'}
`;
```

### State-based Classes

```typescript
// Component state
const classes = `
  transition-all duration-200
  ${isHovered ? 'scale-105' : 'scale-100'}
  ${isFocused ? 'ring-2 ring-blue-500' : ''}
  ${isPressed ? 'scale-95' : ''}
`;

// Form validation
const inputClasses = `
  border rounded px-3 py-2
  ${hasError ? 'border-red-500 bg-red-50' : 'border-gray-300'}
  ${isValid ? 'border-green-500' : ''}
  ${isFocused ? 'outline-none ring-2 ring-blue-500' : ''}
`;
```

## Build-time Optimization

### Static Analysis

TW-Enigma can analyze templates at build time to:

1. **Extract static classes**: Identify classes that never change
2. **Precompile patterns**: Generate optimized runtime code
3. **Eliminate dead code**: Remove unused dynamic branches
4. **Bundle optimization**: Split static and dynamic classes

### Build Integration

```javascript
// Webpack plugin
const { TWEnigmaPlugin } = require('@tw-enigma/webpack');

module.exports = {
  plugins: [
    new TWEnigmaPlugin({
      dynamicClasses: {
        analyze: true,
        optimize: true,
        precompile: ['conditional', 'state-based'],
      },
    }),
  ],
};

// Vite plugin
import { twEnigma } from '@tw-enigma/vite';

export default {
  plugins: [
    twEnigma({
      dynamicClasses: {
        detection: 'thorough',
        optimization: 'aggressive',
      },
    }),
  ],
};
```

## Best Practices

### Performance

1. **Use static classes when possible**: Prefer static strings over dynamic generation
2. **Cache expensive computations**: Use memoization for complex expressions
3. **Minimize dependencies**: Reduce the number of variables in expressions
4. **Batch updates**: Group multiple class changes together

### Maintainability

1. **Extract common patterns**: Create reusable pattern definitions
2. **Use type safety**: Leverage TypeScript for expression validation
3. **Document complex logic**: Add comments for conditional expressions
4. **Test dynamic behavior**: Write tests for different state combinations

### Security

1. **Validate inputs**: Sanitize dynamic values before class generation
2. **Avoid user content**: Don't allow user input directly in class expressions
3. **Use allowlists**: Restrict allowed class names when necessary

## Error Handling

### Detection Errors

```typescript
const result = detector.detect(sourceCode);

if (result.errors.length > 0) {
  result.errors.forEach((error) => {
    console.error(`${error.severity}: ${error.message}`);
    if (error.location) {
      console.error(`  at line ${error.location.line}, column ${error.location.column}`);
    }
  });
}
```

### Runtime Errors

```typescript
try {
  const result = await api.generateClasses(template, context);

  if (result.warnings.length > 0) {
    console.warn('Generation warnings:', result.warnings);
  }

  return result.classes;
} catch (error) {
  console.error('Class generation failed:', error);
  return fallbackClasses;
}
```

### Graceful Degradation

```typescript
const api = new DynamicClassAPI({
  optimization: 'basic',
  fallbackStrategy: 'static', // Use static classes on error
  errorReporting: true,
});

// API will automatically handle errors and provide fallbacks
const result = await api.generateClasses(template, context);
// result.classes will always be a valid string
```

## Debugging

### Development Mode

```typescript
const api = new DynamicClassAPI({
  development: true, // Enable debug logging
  cache: false, // Disable caching for debugging
});

// Enable detailed logging
api.addProcessor({
  name: 'debug-logger',
  process: (classes, context) => {
    console.log('Processing classes:', classes);
    console.log('With context:', context);
    return classes;
  },
  priority: -100, // Run last
});
```

### Performance Profiling

```typescript
const optimizer = new TemplateOptimizer();

// Profile batch operations
const report = optimizer.batchOptimize(sources);
console.log('Performance Report:', {
  totalTime: report.metrics.parseTime.total,
  avgTime: report.metrics.parseTime.avg,
  cacheHitRate: report.improvements.cacheHitRate,
  memoryUsage: report.metrics.memoryUsage.total,
});

// Get optimization recommendations
report.recommendations.forEach((rec) => {
  console.log(`${rec.type}: ${rec.suggestion} (${rec.impact} impact)`);
});
```

## Migration Guide

### From Static to Dynamic

1. **Identify dynamic patterns**: Find repeated conditional logic
2. **Extract to templates**: Convert to template literal format
3. **Add context**: Define required props/state variables
4. **Optimize gradually**: Start with basic optimization, then enhance

### Framework Migration

When migrating between frameworks:

1. **Export patterns**: Use `api.getPatterns()` to extract pattern definitions
2. **Update syntax**: Adapt templates to new framework conventions
3. **Test thoroughly**: Verify all dynamic behaviors work correctly
4. **Optimize for target**: Adjust optimization settings for the new framework

This comprehensive guide covers all aspects of dynamic class generation in TW-Enigma. For specific use cases or advanced configurations, refer to the framework-specific documentation or the API reference.

## Error Codes Reference

### Detection Errors (E1xxx)

| Code  | Message                          | Cause                               | Solution                                                |
| ----- | -------------------------------- | ----------------------------------- | ------------------------------------------------------- |
| E1001 | Invalid template literal syntax  | Malformed template literal          | Check for proper backtick usage and escaping            |
| E1002 | Unterminated template expression | Missing closing `}` in `${}`        | Add missing closing brace                               |
| E1003 | Nested template depth exceeded   | Too many nested template literals   | Simplify template structure or increase maxNestingDepth |
| E1004 | Invalid JavaScript expression    | Syntax error in template expression | Fix JavaScript syntax in template                       |
| E1005 | Circular template reference      | Template references itself          | Remove circular dependency                              |

### Parsing Errors (E2xxx)

| Code  | Message               | Cause                                        | Solution                                                         |
| ----- | --------------------- | -------------------------------------------- | ---------------------------------------------------------------- |
| E2001 | AST parsing failed    | Unable to parse JavaScript code              | Check for valid JavaScript syntax                                |
| E2002 | Unsupported node type | AST contains unsupported JavaScript features | Use supported JavaScript features or enable experimental parsing |
| E2003 | Parser timeout        | Code too complex to parse within time limit  | Simplify code or increase parser timeout                         |
| E2004 | Memory limit exceeded | Code requires too much memory to parse       | Split large files or increase memory limit                       |

### Runtime Errors (E3xxx)

| Code  | Message                      | Cause                                       | Solution                                              |
| ----- | ---------------------------- | ------------------------------------------- | ----------------------------------------------------- |
| E3001 | Context variable undefined   | Required variable not provided in context   | Provide all required variables in context object      |
| E3002 | Type mismatch in expression  | Variable type doesn't match expected type   | Check variable types in context                       |
| E3003 | Function execution failed    | Error executing template function           | Debug function logic and ensure proper error handling |
| E3004 | Class generation timeout     | Template took too long to generate          | Optimize template or increase timeout                 |
| E3005 | Invalid class name generated | Generated class contains invalid characters | Sanitize input variables or fix template logic        |

### Optimization Errors (E4xxx)

| Code  | Message                        | Cause                                 | Solution                                      |
| ----- | ------------------------------ | ------------------------------------- | --------------------------------------------- |
| E4001 | Cache corruption detected      | Cache data is invalid or corrupted    | Clear cache and regenerate                    |
| E4002 | Performance threshold exceeded | Operation exceeded performance limits | Optimize template or increase limits          |
| E4003 | Memory pressure warning        | High memory usage detected            | Reduce cache size or optimize memory usage    |
| E4004 | Optimization failed            | Unable to optimize template           | Use fallback strategy or disable optimization |

### Configuration Errors (E5xxx)

| Code  | Message                 | Cause                                          | Solution                                        |
| ----- | ----------------------- | ---------------------------------------------- | ----------------------------------------------- |
| E5001 | Invalid configuration   | Configuration object has invalid properties    | Check configuration against schema              |
| E5002 | Missing required option | Required configuration option not provided     | Provide required configuration options          |
| E5003 | Conflicting options     | Configuration options conflict with each other | Review and fix conflicting settings             |
| E5004 | Unsupported feature     | Feature not supported in current environment   | Use alternative approach or upgrade environment |

## API Reference Appendix

### Core Classes

#### `TemplateLiteralDetector`

```typescript
class TemplateLiteralDetector {
  constructor(options: DetectorOptions);
  detect(sourceCode: string): DetectionResult;
  configure(options: Partial<DetectorOptions>): void;
  getStats(): DetectionStats;
}

interface DetectorOptions {
  patterns: PatternConfig[];
  maxNestingDepth: number;
  includeTaggedTemplates: boolean;
  customDetectors: CustomDetector[];
}

interface DetectionResult {
  templates: TemplateLiteral[];
  errors: DetectionError[];
  warnings: string[];
  metadata: ResultMetadata;
}
```

#### `ASTTemplateParser`

```typescript
class ASTTemplateParser {
  constructor(options: ParserOptions);
  parse(sourceCode: string): ParseResult;
  parseTemplate(template: TemplateLiteral): ParsedTemplate;
  extractExpressions(ast: Node): Expression[];
}

interface ParserOptions {
  parser: 'babel' | 'acorn' | 'esprima';
  parserOptions: any;
  timeout: number;
  memoryLimit: number;
}

interface ParseResult {
  ast: Node;
  templates: ParsedTemplate[];
  expressions: Expression[];
  errors: ParseError[];
}
```

#### `DynamicClassAPI`

```typescript
class DynamicClassAPI {
  constructor(options: APIOptions);
  generateClasses(template: string, context: ClassContext): Promise<GenerationResult>;
  registerPattern(name: string, pattern: PatternDefinition): void;
  addProcessor(processor: ClassProcessor): void;
  getMetrics(): PerformanceMetrics;
  clearCache(): void;
}

interface APIOptions {
  optimization: OptimizationLevel;
  cache: CacheOptions;
  processors: ClassProcessor[];
  fallbackStrategy: FallbackStrategy;
}

interface GenerationResult {
  classes: string;
  metadata: GenerationMetadata;
  warnings: string[];
  cacheHit: boolean;
}
```

### Utility Functions

```typescript
// Template validation
function validateTemplate(template: string): ValidationResult;
function sanitizeClasses(classes: string): string;
function normalizeClassName(name: string): string;

// Performance utilities
function measurePerformance<T>(fn: () => T): PerformanceResult<T>;
function profileMemoryUsage(operation: () => void): MemoryProfile;
function benchmarkGeneration(templates: string[], context: ClassContext): BenchmarkResult;

// Framework helpers
function createReactHook(api: DynamicClassAPI): UseDynamicClassesHook;
function createVueComposable(api: DynamicClassAPI): VueDynamicClassesComposable;
function createAngularService(api: DynamicClassAPI): AngularDynamicClassesService;
```

### Type Definitions

```typescript
type OptimizationLevel = 'basic' | 'standard' | 'aggressive';
type FallbackStrategy = 'static' | 'empty' | 'error' | 'custom';
type PerformanceLevel = 'development' | 'production' | 'benchmark';

interface ClassContext {
  [key: string]: any;
  _meta?: {
    framework?: string;
    component?: string;
    timestamp?: number;
  };
}

interface PerformanceMetrics {
  generation: {
    total: number;
    average: number;
    min: number;
    max: number;
  };
  cache: {
    hits: number;
    misses: number;
    hitRate: number;
  };
  memory: {
    used: number;
    peak: number;
    gcCount: number;
  };
}
```

## Troubleshooting Guide

### Common Issues

#### Template Not Detected

- **Symptom**: Templates not being processed
- **Causes**: Incorrect syntax, missing configuration
- **Solutions**: Verify template literal syntax, check detector configuration

#### Performance Issues

- **Symptom**: Slow class generation
- **Causes**: Complex templates, insufficient caching
- **Solutions**: Optimize templates, enable caching, use appropriate optimization level

#### Memory Usage

- **Symptom**: High memory consumption
- **Causes**: Large cache size, memory leaks
- **Solutions**: Reduce cache size, enable garbage collection, profile memory usage

#### Integration Problems

- **Symptom**: Framework integration not working
- **Causes**: Incorrect configuration, version compatibility
- **Solutions**: Check framework version, verify integration setup, consult framework-specific docs

### Debug Checklist

1. ✅ Template syntax is valid
2. ✅ All required variables provided in context
3. ✅ Configuration matches environment
4. ✅ Cache is not corrupted
5. ✅ Memory limits are appropriate
6. ✅ Performance settings are optimized
7. ✅ Error handling is implemented
8. ✅ Fallback strategies are configured

This completes the comprehensive documentation for TW-Enigma's Dynamic Class Generation system.
