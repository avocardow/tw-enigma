/**
 * Intelligent Defaults System
 * Context-aware default configuration values with dynamic computation
 */

import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs/promises';
import { TWEnigmaConfig, DEFAULT_PRESETS } from './configSchema';
import { Logger } from '../utils/logger';

export interface DefaultsContext {
  /** Working directory */
  workingDir: string;
  /** Node.js environment */
  nodeEnv?: string;
  /** Package.json information if available */
  packageInfo?: {
    name?: string;
    version?: string;
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
    scripts?: Record<string, string>;
  };
  /** System information */
  system: {
    platform: string;
    arch: string;
    cpuCount: number;
    totalMemory: number;
  };
  /** Detected frameworks */
  detectedFrameworks: string[];
  /** Project type indicators */
  projectType?: 'library' | 'application' | 'monorepo' | 'unknown';
  /** CI/CD environment detection */
  ciEnvironment?: string;
}

export interface DefaultRule {
  /** Rule name for identification */
  name: string;
  /** Description of what this rule does */
  description: string;
  /** Priority (higher number = higher priority) */
  priority: number;
  /** Configuration path this rule applies to */
  configPath: string;
  /** Condition function to determine if rule should apply */
  condition: (context: DefaultsContext) => boolean;
  /** Function to compute the default value */
  compute: (context: DefaultsContext, currentValue?: any) => any;
  /** Whether this rule can override existing values */
  canOverride: boolean;
  /** Tags for rule categorization */
  tags: string[];
}

export interface DefaultsResult {
  /** Final configuration with defaults applied */
  config: TWEnigmaConfig;
  /** Rules that were applied */
  appliedRules: {
    rule: string;
    path: string;
    oldValue: any;
    newValue: any;
    reason: string;
  }[];
  /** Rules that were skipped and why */
  skippedRules: {
    rule: string;
    reason: string;
  }[];
  /** Context used for defaults computation */
  context: DefaultsContext;
  /** Warnings about default applications */
  warnings: string[];
}

export interface IntelligentDefaultsOptions {
  /** Working directory for context detection */
  workingDir?: string;
  /** Custom default rules */
  customRules?: DefaultRule[];
  /** Rules to disable */
  disabledRules?: string[];
  /** Whether to allow rules to override existing values */
  allowOverrides?: boolean;
  /** Maximum time to spend on context detection (ms) */
  contextTimeout?: number;
}

export class IntelligentDefaultsEngine {
  private logger: Logger;
  private options: Required<IntelligentDefaultsOptions>;
  private rules: Map<string, DefaultRule>;

  constructor(options: IntelligentDefaultsOptions = {}) {
    this.options = {
      workingDir: process.cwd(),
      customRules: [],
      disabledRules: [],
      allowOverrides: false,
      contextTimeout: 5000,
      ...options,
    };

    this.logger = new Logger({ component: 'IntelligentDefaults' });
    this.rules = new Map();
    this.initializeBuiltinRules();
    this.registerCustomRules();
  }

  /**
   * Apply intelligent defaults to configuration
   */
  async applyDefaults(
    config: Partial<TWEnigmaConfig>,
    contextOverrides: Partial<DefaultsContext> = {}
  ): Promise<DefaultsResult> {
    const context = await this.buildContext(contextOverrides);
    const appliedRules: DefaultsResult['appliedRules'] = [];
    const skippedRules: DefaultsResult['skippedRules'] = [];
    const warnings: string[] = [];

    // Start with the input config
    let resultConfig = this.deepClone(config) as TWEnigmaConfig;

    // Sort rules by priority (highest first)
    const sortedRules = Array.from(this.rules.values()).sort((a, b) => b.priority - a.priority);

    this.logger.debug('Applying intelligent defaults', {
      totalRules: sortedRules.length,
      context: {
        nodeEnv: context.nodeEnv,
        detectedFrameworks: context.detectedFrameworks,
        projectType: context.projectType,
      },
    });

    for (const rule of sortedRules) {
      if (this.options.disabledRules.includes(rule.name)) {
        skippedRules.push({
          rule: rule.name,
          reason: 'Rule disabled in options',
        });
        continue;
      }

      // Check if rule condition is met
      if (!rule.condition(context)) {
        skippedRules.push({
          rule: rule.name,
          reason: 'Rule condition not met',
        });
        continue;
      }

      // Get current value at config path
      const currentValue = this.getNestedValue(resultConfig, rule.configPath);
      
      // Skip if value exists and rule can't override
      if (currentValue !== undefined && !rule.canOverride && !this.options.allowOverrides) {
        skippedRules.push({
          rule: rule.name,
          reason: 'Value already exists and override not allowed',
        });
        continue;
      }

      try {
        // Compute new default value
        const newValue = rule.compute(context, currentValue);
        
        if (newValue !== undefined && newValue !== currentValue) {
          // Apply the new value
          this.setNestedValue(resultConfig, rule.configPath, newValue);
          
          appliedRules.push({
            rule: rule.name,
            path: rule.configPath,
            oldValue: currentValue,
            newValue,
            reason: rule.description,
          });

          this.logger.debug(`Applied default rule: ${rule.name}`, {
            path: rule.configPath,
            oldValue: currentValue,
            newValue,
          });
        } else {
          skippedRules.push({
            rule: rule.name,
            reason: 'Computed value same as current or undefined',
          });
        }
      } catch (error) {
        this.logger.warn(`Failed to apply default rule: ${rule.name}`, { error });
        skippedRules.push({
          rule: rule.name,
          reason: `Rule execution failed: ${error instanceof Error ? error.message : String(error)}`,
        });
      }
    }

    this.logger.info('Intelligent defaults application completed', {
      appliedRules: appliedRules.length,
      skippedRules: skippedRules.length,
      warnings: warnings.length,
    });

    return {
      config: resultConfig,
      appliedRules,
      skippedRules,
      context,
      warnings,
    };
  }

  /**
   * Build context for defaults computation
   */
  private async buildContext(overrides: Partial<DefaultsContext> = {}): Promise<DefaultsContext> {
    const workingDir = overrides.workingDir || this.options.workingDir;
    
    const baseContext: DefaultsContext = {
      workingDir,
      nodeEnv: process.env.NODE_ENV,
      system: {
        platform: os.platform(),
        arch: os.arch(),
        cpuCount: os.cpus().length,
        totalMemory: os.totalmem(),
      },
      detectedFrameworks: [],
      ciEnvironment: this.detectCIEnvironment(),
      ...overrides,
    };

    // Try to gather additional context with timeout
    try {
      await Promise.race([
        this.enhanceContext(baseContext),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Context timeout')), this.options.contextTimeout)
        ),
      ]);
    } catch (error) {
      this.logger.warn('Context enhancement timed out or failed, using basic context', { error });
    }

    return baseContext;
  }

  /**
   * Enhance context with additional project information
   */
  private async enhanceContext(context: DefaultsContext): Promise<void> {
    // Try to read package.json
    try {
      const packagePath = path.join(context.workingDir, 'package.json');
      const packageContent = await fs.readFile(packagePath, 'utf8');
      context.packageInfo = JSON.parse(packageContent);
      
      // Detect frameworks from dependencies
      context.detectedFrameworks = this.detectFrameworks(context.packageInfo);
      
      // Detect project type
      context.projectType = this.detectProjectType(context.packageInfo, context.workingDir);
    } catch (error) {
      this.logger.debug('Could not read package.json', { error });
    }
  }

  /**
   * Detect frameworks from package.json
   */
  private detectFrameworks(packageInfo: DefaultsContext['packageInfo']): string[] {
    if (!packageInfo) return [];

    const frameworks: string[] = [];
    const allDeps = {
      ...packageInfo.dependencies,
      ...packageInfo.devDependencies,
    };

    const frameworkDetectors = {
      react: ['react', '@types/react'],
      vue: ['vue', '@vue/cli'],
      angular: ['@angular/core', '@angular/cli'],
      svelte: ['svelte', '@sveltejs/kit'],
      solid: ['solid-js'],
      preact: ['preact'],
      lit: ['lit', 'lit-element'],
      next: ['next'],
      nuxt: ['nuxt'],
      vite: ['vite'],
      webpack: ['webpack'],
      rollup: ['rollup'],
      parcel: ['parcel'],
    };

    for (const [framework, deps] of Object.entries(frameworkDetectors)) {
      if (deps.some(dep => dep in allDeps)) {
        frameworks.push(framework);
      }
    }

    return frameworks;
  }

  /**
   * Detect project type
   */
  private detectProjectType(
    packageInfo: DefaultsContext['packageInfo'],
    workingDir: string
  ): DefaultsContext['projectType'] {
    if (!packageInfo) return 'unknown';

    // Check for monorepo indicators
    if (packageInfo.name?.includes('monorepo') || 
        'workspaces' in packageInfo ||
        packageInfo.dependencies?.['lerna'] ||
        packageInfo.devDependencies?.['lerna']) {
      return 'monorepo';
    }

    // Check for library indicators
    if (packageInfo.name?.startsWith('@') ||
        'main' in packageInfo ||
        'module' in packageInfo ||
        'exports' in packageInfo ||
        packageInfo.scripts?.['build-lib']) {
      return 'library';
    }

    return 'application';
  }

  /**
   * Detect CI/CD environment
   */
  private detectCIEnvironment(): string | undefined {
    const env = process.env;
    
    if (env.GITHUB_ACTIONS) return 'github-actions';
    if (env.GITLAB_CI) return 'gitlab-ci';
    if (env.TRAVIS) return 'travis';
    if (env.CIRCLECI) return 'circleci';
    if (env.JENKINS_URL) return 'jenkins';
    if (env.BUILDKITE) return 'buildkite';
    if (env.CI) return 'unknown-ci';
    
    return undefined;
  }

  /**
   * Initialize built-in default rules
   */
  private initializeBuiltinRules(): void {
    // Performance defaults based on system capabilities
    this.addRule({
      name: 'performance-workers',
      description: 'Set worker count based on CPU cores',
      priority: 100,
      configPath: 'performance.workers',
      condition: (context) => true,
      compute: (context, currentValue) => {
        if (currentValue !== undefined) return currentValue;
        
        const cpus = context.system.cpuCount;
        if (cpus <= 2) return 1;
        if (cpus <= 4) return 2;
        if (cpus <= 8) return Math.max(2, Math.floor(cpus * 0.75));
        return Math.max(4, Math.floor(cpus * 0.5));
      },
      canOverride: false,
      tags: ['performance', 'system'],
    });

    this.addRule({
      name: 'performance-batch-size',
      description: 'Set batch size based on available memory',
      priority: 90,
      configPath: 'performance.batchSize',
      condition: (context) => true,
      compute: (context, currentValue) => {
        if (currentValue !== undefined) return currentValue;
        
        const memoryGB = context.system.totalMemory / (1024 * 1024 * 1024);
        if (memoryGB < 2) return 25;
        if (memoryGB < 4) return 50;
        if (memoryGB < 8) return 100;
        if (memoryGB < 16) return 200;
        return 500;
      },
      canOverride: false,
      tags: ['performance', 'memory'],
    });

    // Environment-specific defaults
    this.addRule({
      name: 'development-optimization',
      description: 'Disable heavy optimizations in development',
      priority: 80,
      configPath: 'optimization.level',
      condition: (context) => context.nodeEnv === 'development',
      compute: (context, currentValue) => {
        if (currentValue !== undefined) return currentValue;
        return 'basic';
      },
      canOverride: false,
      tags: ['environment', 'development'],
    });

    this.addRule({
      name: 'development-scrambling',
      description: 'Disable class scrambling in development',
      priority: 80,
      configPath: 'optimization.scrambleClassNames',
      condition: (context) => context.nodeEnv === 'development',
      compute: (context, currentValue) => {
        if (currentValue !== undefined) return currentValue;
        return false;
      },
      canOverride: false,
      tags: ['environment', 'development'],
    });

    this.addRule({
      name: 'production-optimization',
      description: 'Enable aggressive optimizations in production',
      priority: 80,
      configPath: 'optimization.level',
      condition: (context) => context.nodeEnv === 'production',
      compute: (context, currentValue) => {
        if (currentValue !== undefined) return currentValue;
        return 'aggressive';
      },
      canOverride: false,
      tags: ['environment', 'production'],
    });

    this.addRule({
      name: 'ci-parallel-disable',
      description: 'Disable parallel processing in CI to avoid resource contention',
      priority: 85,
      configPath: 'performance.parallel',
      condition: (context) => context.ciEnvironment !== undefined,
      compute: (context, currentValue) => {
        if (currentValue !== undefined) return currentValue;
        return false;
      },
      canOverride: false,
      tags: ['environment', 'ci'],
    });

    // Framework-specific defaults
    this.addRule({
      name: 'react-file-patterns',
      description: 'Add React-specific file patterns',
      priority: 70,
      configPath: 'files.include',
      condition: (context) => context.detectedFrameworks.includes('react'),
      compute: (context, currentValue) => {
        const patterns = currentValue || [];
        const reactPatterns = ['**/*.{jsx,tsx}', '**/components/**/*.{js,ts}'];
        
        return Array.from(new Set([...patterns, ...reactPatterns]));
      },
      canOverride: true,
      tags: ['framework', 'react'],
    });

    this.addRule({
      name: 'vue-file-patterns',
      description: 'Add Vue-specific file patterns',
      priority: 70,
      configPath: 'files.include',
      condition: (context) => context.detectedFrameworks.includes('vue'),
      compute: (context, currentValue) => {
        const patterns = currentValue || [];
        const vuePatterns = ['**/*.vue', '**/components/**/*.{js,ts}'];
        
        return Array.from(new Set([...patterns, ...vuePatterns]));
      },
      canOverride: true,
      tags: ['framework', 'vue'],
    });

    this.addRule({
      name: 'angular-file-patterns',
      description: 'Add Angular-specific file patterns',
      priority: 70,
      configPath: 'files.include',
      condition: (context) => context.detectedFrameworks.includes('angular'),
      compute: (context, currentValue) => {
        const patterns = currentValue || [];
        const angularPatterns = ['**/*.component.{html,ts}', '**/src/**/*.{html,ts}'];
        
        return Array.from(new Set([...patterns, ...angularPatterns]));
      },
      canOverride: true,
      tags: ['framework', 'angular'],
    });

    // Project type defaults
    this.addRule({
      name: 'library-source-maps',
      description: 'Enable source maps for libraries',
      priority: 60,
      configPath: 'output.sourceMaps',
      condition: (context) => context.projectType === 'library',
      compute: (context, currentValue) => {
        if (currentValue !== undefined) return currentValue;
        return true;
      },
      canOverride: false,
      tags: ['project-type', 'library'],
    });

    this.addRule({
      name: 'monorepo-cache-dir',
      description: 'Use shared cache directory for monorepos',
      priority: 60,
      configPath: 'cache.directory',
      condition: (context) => context.projectType === 'monorepo',
      compute: (context, currentValue) => {
        if (currentValue !== undefined) return currentValue;
        return '../../.tw-enigma-cache';
      },
      canOverride: false,
      tags: ['project-type', 'monorepo'],
    });

    // Output defaults
    this.addRule({
      name: 'output-directory',
      description: 'Set output directory based on project structure',
      priority: 50,
      configPath: 'output.outDir',
      condition: (context) => true,
      compute: (context, currentValue) => {
        if (currentValue !== undefined) return currentValue;
        
        // Check common build directories
        const commonDirs = ['dist', 'build', 'out', '.next/static'];
        for (const dir of commonDirs) {
          const fullPath = path.join(context.workingDir, dir);
          try {
            // We can't use async here, so this is just a suggestion
            return dir;
          } catch {
            // Directory doesn't exist
          }
        }
        
        return './dist';
      },
      canOverride: false,
      tags: ['output'],
    });

    // Cache defaults
    this.addRule({
      name: 'cache-size-limit',
      description: 'Set cache size based on available disk space',
      priority: 40,
      configPath: 'cache.maxSize',
      condition: (context) => true,
      compute: (context, currentValue) => {
        if (currentValue !== undefined) return currentValue;
        
        // Conservative default based on memory
        const memoryGB = context.system.totalMemory / (1024 * 1024 * 1024);
        if (memoryGB < 4) return 50; // 50MB
        if (memoryGB < 8) return 100; // 100MB
        if (memoryGB < 16) return 200; // 200MB
        return 500; // 500MB
      },
      canOverride: false,
      tags: ['cache', 'storage'],
    });
  }

  /**
   * Register custom rules
   */
  private registerCustomRules(): void {
    for (const rule of this.options.customRules) {
      this.addRule(rule);
    }
  }

  /**
   * Add a default rule
   */
  addRule(rule: DefaultRule): void {
    this.rules.set(rule.name, rule);
    this.logger.debug(`Registered default rule: ${rule.name}`);
  }

  /**
   * Remove a default rule
   */
  removeRule(ruleName: string): boolean {
    return this.rules.delete(ruleName);
  }

  /**
   * Get all default rules
   */
  getRules(): DefaultRule[] {
    return Array.from(this.rules.values());
  }

  /**
   * Get rules by tag
   */
  getRulesByTag(tag: string): DefaultRule[] {
    return Array.from(this.rules.values()).filter(rule => rule.tags.includes(tag));
  }

  /**
   * Deep clone an object
   */
  private deepClone(obj: any): any {
    if (obj === null || typeof obj !== 'object') return obj;
    if (obj instanceof Date) return new Date(obj.getTime());
    if (Array.isArray(obj)) return obj.map(item => this.deepClone(item));
    
    const cloned = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        cloned[key] = this.deepClone(obj[key]);
      }
    }
    return cloned;
  }

  /**
   * Get nested value from object using dot notation
   */
  private getNestedValue(obj: any, path: string): any {
    const keys = path.split('.');
    let current = obj;
    
    for (const key of keys) {
      if (current === null || current === undefined || !(key in current)) {
        return undefined;
      }
      current = current[key];
    }
    
    return current;
  }

  /**
   * Set nested value in object using dot notation
   */
  private setNestedValue(obj: any, path: string, value: any): void {
    const keys = path.split('.');
    let current = obj;
    
    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      if (!(key in current) || typeof current[key] !== 'object' || current[key] === null) {
        current[key] = {};
      }
      current = current[key];
    }
    
    current[keys[keys.length - 1]] = value;
  }

  /**
   * Update options
   */
  updateOptions(options: Partial<IntelligentDefaultsOptions>): void {
    this.options = { ...this.options, ...options };
    
    if (options.customRules) {
      this.registerCustomRules();
    }
  }
}

/**
 * Create an intelligent defaults engine
 */
export function createIntelligentDefaults(options?: IntelligentDefaultsOptions): IntelligentDefaultsEngine {
  return new IntelligentDefaultsEngine(options);
}

/**
 * Quick utility to apply intelligent defaults
 */
export async function applyIntelligentDefaults(
  config: Partial<TWEnigmaConfig>,
  options?: IntelligentDefaultsOptions
): Promise<DefaultsResult> {
  const engine = createIntelligentDefaults(options);
  return engine.applyDefaults(config);
}

export default IntelligentDefaultsEngine;