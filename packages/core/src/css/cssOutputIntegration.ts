/**
 * Copyright (c) 2025 Rowan Cardow
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { z } from 'zod';
import type { ExtractionResult } from '../optimization/completeConsolidator';
import {
  CssOutputConfig,
  CssOutputConfigManager,
  createCssOutputConfig,
} from '../output/cssOutputConfig';
import {
  ApplyDirectiveConfig,
  ApplyDirectiveCreator,
  ApplyDirectiveResult,
  createApplyDirectiveCreator,
} from './applyDirectiveCreator';
import { CssFormatterConfig } from './cssFormatter';

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

/**
 * Configuration for CSS output integration with @apply directives
 */
export interface CssOutputIntegrationConfig {
  /** @apply directive creation configuration */
  applyDirective: ApplyDirectiveConfig;
  /** CSS output configuration */
  output: CssOutputConfig;
  /** File naming configuration */
  fileNaming: FileNamingConfig;
  /** Module organization configuration */
  modularization: ModularizationConfig;
  /** Post-processing configuration */
  postProcessing: PostProcessingConfig;
  /** CSS formatting configuration */
  formatting: CssFormatterConfig;
}

/**
 * File naming configuration for generated CSS files
 */
export interface FileNamingConfig {
  /** Base filename for CSS output */
  baseName: string;
  /** Include hash in filename for cache-busting */
  includeHash: boolean;
  /** Hash length when includeHash is true */
  hashLength: number;
  /** File extension */
  extension: string;
  /** Directory structure strategy */
  directoryStrategy: 'flat' | 'modular' | 'feature';
  /** Suffix for different file types */
  suffixes: {
    main: string;
    critical: string;
    chunks: string;
    vendors: string;
  };
}

/**
 * Modularization configuration for organizing CSS output
 */
export interface ModularizationConfig {
  /** Enable modular output (separate files per feature/component) */
  enabled: boolean;
  /** Modularization strategy */
  strategy: 'component' | 'feature' | 'usage' | 'hybrid';
  /** Group patterns by semantic similarity */
  semanticGrouping: boolean;
  /** Create separate utilities file */
  separateUtilities: boolean;
  /** Create separate components file */
  separateComponents: boolean;
  /** Create separate base styles file */
  separateBase: boolean;
  /** Maximum patterns per module */
  maxPatternsPerModule: number;
  /** Include cross-references between modules */
  includeCrossRefs: boolean;
}

/**
 * Post-processing configuration for generated CSS
 */
export interface PostProcessingConfig {
  /** Enable PostCSS processing */
  enablePostCSS: boolean;
  /** PostCSS plugins to apply */
  postCSSPlugins: string[];
  /** Enable autoprefixer */
  autoprefix: boolean;
  /** Target browsers for autoprefixer */
  browsers: string[];
  /** Enable CSS validation */
  validate: boolean;
  /** Enable CSS linting */
  lint: boolean;
  /** CSS linting rules */
  lintRules: Record<string, any>;
}

/**
 * Result of CSS generation with output integration
 */
export interface CssGenerationResult {
  /** Generated CSS files */
  files: GeneratedCssFile[];
  /** Pattern mappings used */
  mappings: Map<string, string>;
  /** Generation statistics */
  statistics: {
    totalFiles: number;
    totalRules: number;
    totalSize: number;
    compressionRatio: number;
    processingTime: number;
  };
  /** Validation results */
  validation: {
    isValid: boolean;
    errors: string[];
    warnings: string[];
  };
  /** Performance metrics */
  performance: {
    criticalCssSize: number;
    estimatedLoadTime: number;
    cacheEfficiency: number;
  };
}

/**
 * Generated CSS file information
 */
export interface GeneratedCssFile {
  /** File path relative to output directory */
  path: string;
  /** CSS content */
  content: string;
  /** File size in bytes */
  size: number;
  /** File type classification */
  type: 'main' | 'critical' | 'chunk' | 'vendor' | 'module';
  /** Associated pattern count */
  patternCount: number;
  /** File hash for cache-busting */
  hash?: string;
}

// =============================================================================
// VALIDATION SCHEMAS
// =============================================================================

export const FileNamingConfigSchema = z.object({
  baseName: z.string().default('enigma'),
  includeHash: z.boolean().default(true),
  hashLength: z.number().min(4).max(32).default(8),
  extension: z.string().default('.css'),
  directoryStrategy: z.enum(['flat', 'modular', 'feature']).default('modular'),
  suffixes: z
    .object({
      main: z.string().default(''),
      critical: z.string().default('.critical'),
      chunks: z.string().default('.chunk'),
      vendors: z.string().default('.vendor'),
    })
    .default({}),
});

export const ModularizationConfigSchema = z.object({
  enabled: z.boolean().default(true),
  strategy: z.enum(['component', 'feature', 'usage', 'hybrid']).default('hybrid'),
  semanticGrouping: z.boolean().default(true),
  separateUtilities: z.boolean().default(true),
  separateComponents: z.boolean().default(true),
  separateBase: z.boolean().default(false),
  maxPatternsPerModule: z.number().min(5).max(100).default(25),
  includeCrossRefs: z.boolean().default(false),
});

export const PostProcessingConfigSchema = z.object({
  enablePostCSS: z.boolean().default(true),
  postCSSPlugins: z.array(z.string()).default(['autoprefixer']),
  autoprefix: z.boolean().default(true),
  browsers: z.array(z.string()).default(['> 1%', 'last 2 versions']),
  validate: z.boolean().default(true),
  lint: z.boolean().default(false),
  lintRules: z.record(z.any()).default({}),
});

export const CssFormatterConfigSchema = z.object({
  indentStyle: z.enum(['spaces', 'tabs']).default('spaces'),
  indentSize: z.number().min(1).max(8).default(2),
  spacingRules: z
    .object({
      beforeColon: z.boolean().default(false),
      afterColon: z.boolean().default(true),
      beforeBrace: z.boolean().default(true),
      afterBrace: z.boolean().default(false),
      beforeSemicolon: z.boolean().default(false),
    })
    .default({}),
  propertyOrder: z.enum(['alphabetical', 'grouped', 'smacss', 'custom']).default('grouped'),
  customOrder: z.array(z.string()).optional(),
  outputFormat: z.enum(['compact', 'pretty', 'readable']).default('pretty'),
  includeComments: z.boolean().default(false),
  enforceConventions: z.boolean().default(false),
  namingConvention: z.enum(['bem', 'smacss', 'none']).default('none'),
  braceStyle: z.enum(['same-line', 'new-line']).default('same-line'),
  propertiesPerLine: z.enum(['single', 'multiple']).default('single'),
  preserveComments: z.boolean().default(true),
  maxLineLength: z.number().min(40).default(80),
  sortSelectors: z.boolean().default(false),
  groupRelatedRules: z.boolean().default(false),
});

// =============================================================================
// CSS OUTPUT INTEGRATION CLASS
// =============================================================================

/**
 * Integrates @apply directive creation with comprehensive CSS output management
 */
export class CssOutputIntegration {
  private applyDirectiveCreator: ApplyDirectiveCreator;
  private outputConfigManager: CssOutputConfigManager;
  private config: CssOutputIntegrationConfig;

  constructor(config?: Partial<CssOutputIntegrationConfig>) {
    // Set up default configuration
    this.config = this.normalizeConfig(config || {});

    // Initialize components
    this.applyDirectiveCreator = createApplyDirectiveCreator(this.config.applyDirective);
    this.outputConfigManager = createCssOutputConfig(this.config.output);
  }

  /**
   * Generates CSS with full output management integration
   */
  async generateCssWithOutput(
    patterns: Map<string, ExtractionResult>,
    outputDirectory: string
  ): Promise<CssGenerationResult> {
    const startTime = Date.now();

    try {
      // Step 1: Create @apply directives
      const directiveResult = await this.applyDirectiveCreator.createDirectives(patterns);

      if (!directiveResult.css) {
        throw new Error('No CSS generated from patterns');
      }

      // Step 2: Process and organize CSS based on modularization strategy
      const cssModules = await this.organizeCssModules(directiveResult, patterns);

      // Step 3: Apply output configuration and generate files
      const generatedFiles = await this.generateOutputFiles(cssModules, outputDirectory);

      // Step 4: Post-process files if enabled
      if (this.config.postProcessing.enablePostCSS) {
        await this.postProcessFiles(generatedFiles);
      }

      // Step 5: Validate generated CSS
      const validation = await this.validateGeneratedCss(generatedFiles);

      // Step 6: Calculate performance metrics
      const performance = this.calculatePerformanceMetrics(generatedFiles);

      // Step 7: Calculate statistics
      const statistics = this.calculateStatistics(generatedFiles, Date.now() - startTime);

      return {
        files: generatedFiles,
        mappings: directiveResult.mappings,
        statistics,
        validation,
        performance,
      };
    } catch (error) {
      throw new Error(
        `CSS generation failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Organizes CSS into modules based on configuration
   */
  private async organizeCssModules(
    directiveResult: ApplyDirectiveResult,
    patterns: Map<string, ExtractionResult>
  ): Promise<CssModule[]> {
    const modules: CssModule[] = [];

    if (!this.config.modularization.enabled) {
      // Single module strategy
      modules.push({
        name: 'main',
        type: 'main',
        css: directiveResult.css,
        patterns: Array.from(patterns.values()),
        dependencies: [],
      });
      return modules;
    }

    // Modular strategy based on configuration
    switch (this.config.modularization.strategy) {
      case 'component':
        return this.organizeByComponent(directiveResult, patterns);
      case 'feature':
        return this.organizeByFeature(directiveResult, patterns);
      case 'usage':
        return this.organizeByUsage(directiveResult, patterns);
      case 'hybrid':
        return this.organizeHybrid(directiveResult, patterns);
      default:
        return modules;
    }
  }

  /**
   * Organizes CSS by component patterns
   */
  private async organizeByComponent(
    directiveResult: ApplyDirectiveResult,
    patterns: Map<string, ExtractionResult>
  ): Promise<CssModule[]> {
    const modules: CssModule[] = [];
    const componentGroups = this.groupPatternsByComponent(patterns);

    for (const [componentName, componentPatterns] of componentGroups.entries()) {
      const css = await this.generateCssForPatterns(componentPatterns);
      modules.push({
        name: `component-${componentName}`,
        type: 'component',
        css,
        patterns: componentPatterns,
        dependencies: [],
      });
    }

    return modules;
  }

  /**
   * Organizes CSS by feature patterns
   */
  private async organizeByFeature(
    directiveResult: ApplyDirectiveResult,
    patterns: Map<string, ExtractionResult>
  ): Promise<CssModule[]> {
    const modules: CssModule[] = [];
    const featureGroups = this.groupPatternsByFeature(patterns);

    for (const [featureName, featurePatterns] of featureGroups.entries()) {
      const css = await this.generateCssForPatterns(featurePatterns);
      modules.push({
        name: `feature-${featureName}`,
        type: 'feature',
        css,
        patterns: featurePatterns,
        dependencies: [],
      });
    }

    return modules;
  }

  /**
   * Organizes CSS by usage frequency
   */
  private async organizeByUsage(
    directiveResult: ApplyDirectiveResult,
    patterns: Map<string, ExtractionResult>
  ): Promise<CssModule[]> {
    const modules: CssModule[] = [];
    const sortedPatterns = Array.from(patterns.values()).sort((a, b) => b.frequency - a.frequency);

    // High usage patterns (critical)
    const criticalPatterns = sortedPatterns.slice(0, Math.ceil(sortedPatterns.length * 0.2));
    if (criticalPatterns.length > 0) {
      modules.push({
        name: 'critical',
        type: 'critical',
        css: await this.generateCssForPatterns(criticalPatterns),
        patterns: criticalPatterns,
        dependencies: [],
      });
    }

    // Medium usage patterns
    const mediumPatterns = sortedPatterns.slice(
      Math.ceil(sortedPatterns.length * 0.2),
      Math.ceil(sortedPatterns.length * 0.8)
    );
    if (mediumPatterns.length > 0) {
      modules.push({
        name: 'main',
        type: 'main',
        css: await this.generateCssForPatterns(mediumPatterns),
        patterns: mediumPatterns,
        dependencies: [],
      });
    }

    // Low usage patterns (lazy load)
    const lazyPatterns = sortedPatterns.slice(Math.ceil(sortedPatterns.length * 0.8));
    if (lazyPatterns.length > 0) {
      modules.push({
        name: 'lazy',
        type: 'chunk',
        css: await this.generateCssForPatterns(lazyPatterns),
        patterns: lazyPatterns,
        dependencies: [],
      });
    }

    return modules;
  }

  /**
   * Organizes CSS using hybrid strategy (combination of approaches)
   */
  private async organizeHybrid(
    directiveResult: ApplyDirectiveResult,
    patterns: Map<string, ExtractionResult>
  ): Promise<CssModule[]> {
    const modules: CssModule[] = [];

    // First, separate by semantic categories
    const { utilities, components, base } = this.categorizePatterns(patterns);

    // Create base module if configured
    if (this.config.modularization.separateBase && base.length > 0) {
      modules.push({
        name: 'base',
        type: 'base',
        css: await this.generateCssForPatterns(base),
        patterns: base,
        dependencies: [],
      });
    }

    // Create utilities module if configured
    if (this.config.modularization.separateUtilities && utilities.length > 0) {
      modules.push({
        name: 'utilities',
        type: 'utilities',
        css: await this.generateCssForPatterns(utilities),
        patterns: utilities,
        dependencies: base.length > 0 ? ['base'] : [],
      });
    }

    // Create components modules
    if (this.config.modularization.separateComponents && components.length > 0) {
      const componentGroups = this.groupPatternsByUsage(
        components,
        this.config.modularization.maxPatternsPerModule
      );

      for (let i = 0; i < componentGroups.length; i++) {
        modules.push({
          name: `components-${i + 1}`,
          type: 'component',
          css: await this.generateCssForPatterns(componentGroups[i]),
          patterns: componentGroups[i],
          dependencies: ['utilities', 'base'].filter((dep) => modules.some((m) => m.name === dep)),
        });
      }
    }

    // Fallback: create main module if no other modules were created
    if (modules.length === 0) {
      modules.push({
        name: 'main',
        type: 'main',
        css: directiveResult.css,
        patterns: Array.from(patterns.values()),
        dependencies: [],
      });
    }

    return modules;
  }

  /**
   * Generates output files from CSS modules
   */
  private async generateOutputFiles(
    modules: CssModule[],
    outputDirectory: string
  ): Promise<GeneratedCssFile[]> {
    const files: GeneratedCssFile[] = [];

    // Ensure output directory exists
    await fs.mkdir(outputDirectory, { recursive: true });

    for (const module of modules) {
      const filename = this.generateFileName(module);
      const filePath = path.join(outputDirectory, filename);

      // Apply CSS formatting based on output configuration
      const formattedCss = this.formatCss(module.css);

      // Write file
      await fs.writeFile(filePath, formattedCss, 'utf-8');

      // Calculate file hash if enabled
      const hash = this.config.fileNaming.includeHash
        ? this.calculateHash(formattedCss).slice(0, this.config.fileNaming.hashLength)
        : undefined;

      files.push({
        path: path.relative(outputDirectory, filePath),
        content: formattedCss,
        size: Buffer.byteLength(formattedCss, 'utf-8'),
        type: module.type as any,
        patternCount: module.patterns.length,
        hash,
      });
    }

    return files;
  }

  /**
   * Post-processes generated CSS files
   */
  private async postProcessFiles(files: GeneratedCssFile[]): Promise<void> {
    // Implementation would integrate with PostCSS, autoprefixer, etc.
    // This is a placeholder for the actual post-processing logic

    if (this.config.postProcessing.autoprefix) {
      // Apply autoprefixer to each file
      for (const file of files) {
        // Placeholder: would use autoprefixer here
        // file.content = await autoprefixer.process(file.content, { browsers: this.config.postProcessing.browsers });
      }
    }
  }

  /**
   * Validates generated CSS files
   */
  private async validateGeneratedCss(files: GeneratedCssFile[]): Promise<{
    isValid: boolean;
    errors: string[];
    warnings: string[];
  }> {
    const validation = {
      isValid: true,
      errors: [] as string[],
      warnings: [] as string[],
    };

    if (!this.config.postProcessing.validate) {
      return validation;
    }

    for (const file of files) {
      // Basic CSS validation
      try {
        // Placeholder: would use css-tree or similar for validation
        // const ast = cssTree.parse(file.content);
        // ... validation logic
      } catch (error) {
        validation.isValid = false;
        validation.errors.push(
          `Invalid CSS in ${file.path}: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }

    return validation;
  }

  // Helper methods (implementation details)
  private normalizeConfig(config: Partial<CssOutputIntegrationConfig>): CssOutputIntegrationConfig {
    return {
      applyDirective: config.applyDirective || {},
      output: config.output || {},
      fileNaming: FileNamingConfigSchema.parse(config.fileNaming || {}),
      modularization: ModularizationConfigSchema.parse(config.modularization || {}),
      postProcessing: PostProcessingConfigSchema.parse(config.postProcessing || {}),
      formatting: config.formatting || {},
    };
  }

  private groupPatternsByComponent(
    patterns: Map<string, ExtractionResult>
  ): Map<string, ExtractionResult[]> {
    // Implementation: analyze patterns to group by component semantic meaning
    const groups = new Map<string, ExtractionResult[]>();

    for (const pattern of patterns.values()) {
      const componentName = this.inferComponentName(pattern);
      if (!groups.has(componentName)) {
        groups.set(componentName, []);
      }
      groups.get(componentName)!.push(pattern);
    }

    return groups;
  }

  private groupPatternsByFeature(
    patterns: Map<string, ExtractionResult>
  ): Map<string, ExtractionResult[]> {
    // Implementation: analyze patterns to group by feature
    const groups = new Map<string, ExtractionResult[]>();

    for (const pattern of patterns.values()) {
      const featureName = this.inferFeatureName(pattern);
      if (!groups.has(featureName)) {
        groups.set(featureName, []);
      }
      groups.get(featureName)!.push(pattern);
    }

    return groups;
  }

  private categorizePatterns(patterns: Map<string, ExtractionResult>): {
    utilities: ExtractionResult[];
    components: ExtractionResult[];
    base: ExtractionResult[];
  } {
    const utilities: ExtractionResult[] = [];
    const components: ExtractionResult[] = [];
    const base: ExtractionResult[] = [];

    for (const pattern of patterns.values()) {
      const category = this.categorizePattern(pattern);
      switch (category) {
        case 'utility':
          utilities.push(pattern);
          break;
        case 'component':
          components.push(pattern);
          break;
        case 'base':
          base.push(pattern);
          break;
        default:
          utilities.push(pattern); // Default to utilities
      }
    }

    return { utilities, components, base };
  }

  private groupPatternsByUsage(
    patterns: ExtractionResult[],
    maxPerGroup: number
  ): ExtractionResult[][] {
    const groups: ExtractionResult[][] = [];
    let currentGroup: ExtractionResult[] = [];

    for (const pattern of patterns) {
      if (currentGroup.length >= maxPerGroup) {
        groups.push(currentGroup);
        currentGroup = [];
      }
      currentGroup.push(pattern);
    }

    if (currentGroup.length > 0) {
      groups.push(currentGroup);
    }

    return groups;
  }

  private async generateCssForPatterns(patterns: ExtractionResult[]): Promise<string> {
    const tempPatterns = new Map<string, ExtractionResult>();
    patterns.forEach((pattern) => {
      tempPatterns.set(pattern.original, pattern);
    });

    const result = await this.applyDirectiveCreator.createDirectives(tempPatterns);
    return result.css;
  }

  private generateFileName(module: CssModule): string {
    const { baseName, extension, suffixes, includeHash } = this.config.fileNaming;
    const suffix = suffixes[module.type as keyof typeof suffixes] || '';

    let filename = `${baseName}${suffix}${extension}`;

    if (module.name !== 'main') {
      filename = `${baseName}-${module.name}${suffix}${extension}`;
    }

    return filename;
  }

  private formatCss(css: string): string {
    // Apply CSS formatting based on output configuration
    const outputConfig = this.outputConfigManager.getConfig();

    if (outputConfig.optimization.minify) {
      // Remove extra whitespace for minification
      return css.replace(/\s+/g, ' ').replace(/;\s*}/g, '}').trim();
    }

    // Pretty formatting (already handled by ApplyDirectiveCreator)
    return css;
  }

  private calculateHash(content: string): string {
    // Simple hash implementation - in production would use crypto
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(16);
  }

  private calculateStatistics(files: GeneratedCssFile[], processingTime: number) {
    const totalSize = files.reduce((sum, file) => sum + file.size, 0);
    const totalRules = files.reduce((sum, file) => {
      // Estimate rules by counting opening braces
      return sum + (file.content.match(/\{/g) || []).length;
    }, 0);

    return {
      totalFiles: files.length,
      totalRules,
      totalSize,
      compressionRatio: 0, // Would calculate based on original vs compressed
      processingTime,
    };
  }

  private calculatePerformanceMetrics(files: GeneratedCssFile[]) {
    const criticalFile = files.find((f) => f.type === 'critical');
    const criticalCssSize = criticalFile ? criticalFile.size : 0;

    return {
      criticalCssSize,
      estimatedLoadTime: this.estimateLoadTime(files),
      cacheEfficiency: this.calculateCacheEfficiency(files),
    };
  }

  private estimateLoadTime(files: GeneratedCssFile[]): number {
    // Simple estimation based on file sizes and typical connection speeds
    const totalSize = files.reduce((sum, file) => sum + file.size, 0);
    // Assume 1 Mbps connection, factor in HTTP overhead
    return Math.ceil(((totalSize * 8) / (1024 * 1024)) * 1000) + files.length * 100; // +100ms per file for latency
  }

  private calculateCacheEfficiency(files: GeneratedCssFile[]): number {
    // Efficiency based on file count and size distribution
    if (files.length === 0) return 0;

    const sizes = files.map((f) => f.size);
    const avgSize = sizes.reduce((sum, size) => sum + size, 0) / sizes.length;
    const variance =
      sizes.reduce((sum, size) => sum + Math.pow(size - avgSize, 2), 0) / sizes.length;

    // Lower variance = better cache efficiency
    return Math.max(0, 100 - (variance / avgSize) * 100);
  }

  // Inference helper methods
  private inferComponentName(pattern: ExtractionResult): string {
    // Simple heuristic based on pattern content
    const classes = pattern.original.split(/\s+/);

    if (classes.some((cls) => cls.includes('btn') || cls.includes('button'))) return 'button';
    if (classes.some((cls) => cls.includes('card'))) return 'card';
    if (classes.some((cls) => cls.includes('nav'))) return 'navigation';
    if (classes.some((cls) => cls.includes('form'))) return 'form';
    if (classes.some((cls) => cls.includes('modal'))) return 'modal';

    return 'generic';
  }

  private inferFeatureName(pattern: ExtractionResult): string {
    // Simple heuristic based on pattern content
    const classes = pattern.original.split(/\s+/);

    if (classes.some((cls) => cls.includes('auth') || cls.includes('login')))
      return 'authentication';
    if (classes.some((cls) => cls.includes('shop') || cls.includes('cart'))) return 'shopping';
    if (classes.some((cls) => cls.includes('admin'))) return 'admin';
    if (classes.some((cls) => cls.includes('user') || cls.includes('profile'))) return 'user';

    return 'general';
  }

  private categorizePattern(pattern: ExtractionResult): 'utility' | 'component' | 'base' {
    const classes = pattern.original.split(/\s+/);

    // Simple categorization logic
    if (
      classes.length <= 2 &&
      classes.every(
        (cls) =>
          cls.startsWith('text-') ||
          cls.startsWith('bg-') ||
          cls.startsWith('p-') ||
          cls.startsWith('m-')
      )
    ) {
      return 'utility';
    }

    if (classes.some((cls) => cls.includes('base') || cls.includes('reset'))) {
      return 'base';
    }

    return 'component';
  }

  /**
   * Updates configuration
   */
  updateConfig(config: Partial<CssOutputIntegrationConfig>): void {
    this.config = { ...this.config, ...this.normalizeConfig(config) };
    this.applyDirectiveCreator.updateConfig(this.config.applyDirective);
    this.outputConfigManager.updateConfig(this.config.output);
  }

  /**
   * Gets current configuration
   */
  getConfig(): CssOutputIntegrationConfig {
    return { ...this.config };
  }
}

// =============================================================================
// SUPPORTING TYPES
// =============================================================================

interface CssModule {
  name: string;
  type: 'main' | 'critical' | 'chunk' | 'vendor' | 'component' | 'feature' | 'utilities' | 'base';
  css: string;
  patterns: ExtractionResult[];
  dependencies: string[];
}

// =============================================================================
// FACTORY FUNCTIONS
// =============================================================================

/**
 * Creates CSS output integration with default configuration
 */
export function createCssOutputIntegration(
  config?: Partial<CssOutputIntegrationConfig>
): CssOutputIntegration {
  return new CssOutputIntegration(config);
}

/**
 * Creates configuration optimized for production
 */
export function createProductionIntegrationConfig(): Partial<CssOutputIntegrationConfig> {
  return {
    applyDirective: {
      outputFormat: 'compact',
      includeComments: false,
      enableLayers: true,
      detectCircularRefs: true,
    },
    fileNaming: {
      baseName: 'enigma',
      includeHash: true,
      hashLength: 8,
      extension: '.css',
      directoryStrategy: 'modular',
      suffixes: {
        main: '',
        critical: '.critical',
        chunks: '.chunk',
        vendors: '.vendor',
      },
    },
    modularization: {
      enabled: true,
      strategy: 'hybrid',
      semanticGrouping: true,
      separateUtilities: true,
      separateComponents: true,
      separateBase: false,
      maxPatternsPerModule: 20,
      includeCrossRefs: false,
    },
    postProcessing: {
      enablePostCSS: true,
      autoprefix: true,
      validate: true,
      lint: false,
    },
  };
}

/**
 * Creates configuration optimized for development
 */
export function createDevelopmentIntegrationConfig(): Partial<CssOutputIntegrationConfig> {
  return {
    applyDirective: {
      outputFormat: 'readable',
      includeComments: true,
      enableLayers: false,
      detectCircularRefs: true,
    },
    fileNaming: {
      baseName: 'enigma-dev',
      includeHash: false,
      extension: '.css',
      directoryStrategy: 'flat',
      suffixes: {
        main: '',
        critical: '.critical',
        chunks: '.chunk',
        vendors: '.vendor',
      },
    },
    modularization: {
      enabled: false,
      strategy: 'hybrid',
      semanticGrouping: false,
      separateUtilities: false,
      separateComponents: false,
      separateBase: false,
      maxPatternsPerModule: 50,
      includeCrossRefs: true,
    },
    postProcessing: {
      enablePostCSS: false,
      autoprefix: false,
      validate: true,
      lint: true,
    },
  };
}
