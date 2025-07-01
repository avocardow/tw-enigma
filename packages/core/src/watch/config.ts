import { resolve } from 'path';
import { createLogger } from '../utils/logger';
import { WatchConfig, WatchModeConfig, WatchPattern } from './types';

const logger = createLogger('WatchConfiguration');

/**
 * Default watch mode configuration
 */
export const DEFAULT_WATCH_MODE_CONFIG: WatchModeConfig = {
  enabled: true,
  mode: 'development',
  hotReload: true,
  autoRefresh: true,
  notifications: true,
  performance: {
    throttleMs: 100,
    batchSize: 10,
    maxConcurrency: 4,
  },
  integrations: {
    devServer: true,
    browser: true,
    editor: false,
    terminal: true,
  },
  caching: {
    enabled: true,
    strategy: 'hybrid',
    maxAge: 300000, // 5 minutes
    maxSize: 100 * 1024 * 1024, // 100 MB in bytes
    enablePredictivePrefetch: true,
    compressionEnabled: true,
    analyticsEnabled: true,
    evictionStrategy: 'adaptive',
    prefetchThreshold: 0.7,
    maxPrefetchSize: 10 * 1024 * 1024, // 10 MB
    prefetchConcurrency: 3,
    enableDeduplication: true,
    enableCacheWarming: false,
    fileChangeDebounce: 1000, // 1 second
  },
  logging: {
    level: 'info',
    verbose: false,
    timestamped: true,
  },
};

/**
 * Default file watching patterns
 */
export const DEFAULT_WATCH_PATTERNS: WatchPattern[] = [
  {
    glob: 'src/**/*.{js,jsx,ts,tsx}',
    priority: 1,
    debounceMs: 200,
    enabled: true,
    metadata: { type: 'javascript', category: 'source' },
  },
  {
    glob: 'src/**/*.{css,scss,sass,less,styl}',
    priority: 2,
    debounceMs: 300,
    enabled: true,
    metadata: { type: 'stylesheet', category: 'source' },
  },
  {
    glob: 'src/**/*.{html,htm,vue,svelte}',
    priority: 3,
    debounceMs: 500,
    enabled: true,
    metadata: { type: 'template', category: 'source' },
  },
  {
    glob: 'public/**/*.{html,css,js}',
    priority: 4,
    debounceMs: 1000,
    enabled: true,
    metadata: { type: 'public', category: 'assets' },
  },
  {
    glob: 'styles/**/*.{css,scss,sass,less}',
    priority: 5,
    debounceMs: 300,
    enabled: true,
    metadata: { type: 'stylesheet', category: 'styles' },
  },
];

/**
 * Default ignored patterns
 */
export const DEFAULT_IGNORED_PATTERNS = [
  '**/node_modules/**',
  '**/.git/**',
  '**/dist/**',
  '**/build/**',
  '**/.next/**',
  '**/.nuxt/**',
  '**/coverage/**',
  '**/.nyc_output/**',
  '**/.cache/**',
  '**/.temp/**',
  '**/.tmp/**',
  '**/*.log',
  '**/.DS_Store',
  '**/Thumbs.db',
  '**/*.swp',
  '**/*.swo',
  '**/*~',
];

/**
 * Watch configuration manager
 */
export class WatchConfiguration {
  private config: WatchModeConfig;
  private watchPatterns: WatchPattern[];
  private ignoredPatterns: string[];
  private projectRoot: string;

  constructor(
    config?: Partial<WatchModeConfig>,
    patterns?: WatchPattern[],
    ignored?: string[],
    projectRoot?: string
  ) {
    this.config = this.mergeConfig(config);
    this.watchPatterns = patterns || [...DEFAULT_WATCH_PATTERNS];
    this.ignoredPatterns = ignored || [...DEFAULT_IGNORED_PATTERNS];
    this.projectRoot = projectRoot || process.cwd();

    logger.debug('WatchConfiguration initialized', {
      config: this.config,
      patterns: this.watchPatterns.length,
      ignored: this.ignoredPatterns.length,
      projectRoot: this.projectRoot,
    });
  }

  /**
   * Get current configuration
   */
  getConfig(): WatchModeConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(updates: Partial<WatchModeConfig>): void {
    const oldConfig = { ...this.config };
    this.config = this.mergeConfig(updates, this.config);

    logger.info('Configuration updated', {
      changes: this.getConfigDiff(oldConfig, this.config),
    });
  }

  /**
   * Get watch patterns
   */
  getWatchPatterns(): WatchPattern[] {
    return this.watchPatterns.filter((pattern) => pattern.enabled);
  }

  /**
   * Add watch pattern
   */
  addWatchPattern(pattern: WatchPattern): void {
    this.watchPatterns.push(pattern);
    logger.debug('Watch pattern added', { pattern });
  }

  /**
   * Remove watch pattern
   */
  removeWatchPattern(glob: string): void {
    const index = this.watchPatterns.findIndex((p) => p.glob === glob);
    if (index !== -1) {
      const removed = this.watchPatterns.splice(index, 1)[0];
      logger.debug('Watch pattern removed', { pattern: removed });
    }
  }

  /**
   * Get ignored patterns
   */
  getIgnoredPatterns(): string[] {
    return [...this.ignoredPatterns];
  }

  /**
   * Add ignored pattern
   */
  addIgnoredPattern(pattern: string): void {
    if (!this.ignoredPatterns.includes(pattern)) {
      this.ignoredPatterns.push(pattern);
      logger.debug('Ignored pattern added', { pattern });
    }
  }

  /**
   * Remove ignored pattern
   */
  removeIgnoredPattern(pattern: string): void {
    const index = this.ignoredPatterns.indexOf(pattern);
    if (index !== -1) {
      this.ignoredPatterns.splice(index, 1);
      logger.debug('Ignored pattern removed', { pattern });
    }
  }

  /**
   * Get file watcher configuration
   */
  getWatchConfig(): WatchConfig {
    return {
      enabled: this.config.enabled,
      patterns: this.watchPatterns,
      ignored: this.ignoredPatterns,
      persistent: true,
      ignoreInitial: true,
      followSymlinks: false,
      depth: 10,
      awaitWriteFinish: {
        stabilityThreshold: 100,
        pollInterval: 100,
      },
      atomic: true,
      ignorePermissionErrors: true,
      cwd: this.projectRoot,
    };
  }

  /**
   * Resolve patterns relative to project root
   */
  resolvePatterns(patterns: string[]): string[] {
    return patterns
      .map((pattern) => {
        if (pattern.startsWith('/')) {
          return pattern;
        }
        return resolve(this.projectRoot, pattern);
      })
      .filter(Boolean);
  }

  /**
   * Validate configuration
   */
  validate(): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Validate basic config
    if (!this.config.enabled) {
      errors.push('Watch mode is disabled');
    }

    if (this.config.performance.throttleMs < 0) {
      errors.push('Throttle time must be non-negative');
    }

    if (this.config.performance.batchSize < 1) {
      errors.push('Batch size must be at least 1');
    }

    if (this.config.performance.maxConcurrency < 1) {
      errors.push('Max concurrency must be at least 1');
    }

    // Validate caching configuration
    if (this.config.caching.maxAge < 0) {
      errors.push('Cache max age must be non-negative');
    }

    if (this.config.caching.maxSize < 0) {
      errors.push('Cache max size must be non-negative');
    }

    if (this.config.caching.fileChangeDebounce < 0) {
      errors.push('File change debounce must be non-negative');
    }

    if (this.config.caching.prefetchThreshold < 0 || this.config.caching.prefetchThreshold > 1) {
      errors.push('Prefetch threshold must be between 0 and 1');
    }

    // Validate patterns
    if (this.watchPatterns.length === 0) {
      errors.push('At least one watch pattern must be specified');
    }

    for (const pattern of this.watchPatterns) {
      if (!pattern.glob || pattern.glob.trim().length === 0) {
        errors.push(`Invalid pattern glob: ${pattern.glob}`);
      }

      if (pattern.priority < 0) {
        errors.push(`Pattern priority must be non-negative: ${pattern.glob}`);
      }

      if (pattern.debounceMs && pattern.debounceMs < 0) {
        errors.push(`Pattern debounce time must be non-negative: ${pattern.glob}`);
      }

      if (pattern.debounceMs && pattern.debounceMs > 10000) {
        errors.push(`Pattern debounce time too high (max 10s): ${pattern.glob}`);
      }

      if (pattern.throttleMs && pattern.throttleMs < 0) {
        errors.push(`Pattern throttle time must be non-negative: ${pattern.glob}`);
      }

      if (pattern.throttleMs && pattern.throttleMs > 5000) {
        errors.push(`Pattern throttle time too high (max 5s): ${pattern.glob}`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Get configuration for specific mode
   */
  getModeConfig(mode: 'development' | 'production' | 'test'): Partial<WatchModeConfig> {
    const configs = {
      development: {
        hotReload: true,
        autoRefresh: true,
        notifications: true,
        logging: { level: 'debug' as const, verbose: true, timestamped: true },
        performance: { throttleMs: 100, batchSize: 5, maxConcurrency: 2 },
        caching: {
          enabled: true,
          strategy: 'memory' as const,
          maxAge: 60000, // 1 minute for fast development feedback
          maxSize: 50 * 1024 * 1024, // 50 MB
          enablePredictivePrefetch: false, // Keep simple for development
          compressionEnabled: false,
          analyticsEnabled: true,
          evictionStrategy: 'lru' as const,
          prefetchThreshold: 0.5,
          maxPrefetchSize: 5 * 1024 * 1024,
          prefetchConcurrency: 2,
          enableDeduplication: false,
          enableCacheWarming: false,
          fileChangeDebounce: 500,
        },
      },
      production: {
        hotReload: false,
        autoRefresh: false,
        notifications: false,
        logging: { level: 'warn' as const, verbose: false, timestamped: false },
        performance: { throttleMs: 1000, batchSize: 20, maxConcurrency: 8 },
        caching: {
          enabled: true,
          strategy: 'hybrid' as const,
          maxAge: 3600000, // 1 hour for production stability
          maxSize: 500 * 1024 * 1024, // 500 MB
          enablePredictivePrefetch: true,
          compressionEnabled: true,
          analyticsEnabled: false, // Reduce overhead
          evictionStrategy: 'adaptive' as const,
          prefetchThreshold: 0.8,
          maxPrefetchSize: 50 * 1024 * 1024,
          prefetchConcurrency: 5,
          enableDeduplication: true,
          enableCacheWarming: true,
          fileChangeDebounce: 2000,
        },
      },
      test: {
        hotReload: false,
        autoRefresh: false,
        notifications: false,
        logging: { level: 'error' as const, verbose: false, timestamped: false },
        performance: { throttleMs: 50, batchSize: 1, maxConcurrency: 1 },
        caching: {
          enabled: false, // Disable caching for test determinism
          strategy: 'memory' as const,
          maxAge: 10000, // 10 seconds
          maxSize: 10 * 1024 * 1024, // 10 MB
          enablePredictivePrefetch: false,
          compressionEnabled: false,
          analyticsEnabled: false,
          evictionStrategy: 'fifo' as const,
          prefetchThreshold: 0.3,
          maxPrefetchSize: 1 * 1024 * 1024,
          prefetchConcurrency: 1,
          enableDeduplication: false,
          enableCacheWarming: false,
          fileChangeDebounce: 100,
        },
      },
    };

    return configs[mode] || configs.development;
  }

  /**
   * Merge configurations
   */
  private mergeConfig(updates?: Partial<WatchModeConfig>, base?: WatchModeConfig): WatchModeConfig {
    const baseConfig = base || DEFAULT_WATCH_MODE_CONFIG;

    if (!updates) {
      return { ...baseConfig };
    }

    return {
      ...baseConfig,
      ...updates,
      performance: {
        ...baseConfig.performance,
        ...(updates.performance || {}),
      },
      integrations: {
        ...baseConfig.integrations,
        ...(updates.integrations || {}),
      },
      caching: {
        ...baseConfig.caching,
        ...(updates.caching || {}),
      },
      logging: {
        ...baseConfig.logging,
        ...(updates.logging || {}),
      },
    };
  }

  /**
   * Get configuration differences
   */
  private getConfigDiff(
    oldConfig: WatchModeConfig,
    newConfig: WatchModeConfig
  ): Record<string, { old: any; new: any }> {
    const diff: Record<string, { old: any; new: any }> = {};

    const keys = new Set([...Object.keys(oldConfig), ...Object.keys(newConfig)]);

    for (const key of keys) {
      const oldValue = (oldConfig as any)[key];
      const newValue = (newConfig as any)[key];

      if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
        diff[key] = { old: oldValue, new: newValue };
      }
    }

    return diff;
  }
}

/**
 * Create default watch configuration
 */
export function createWatchConfiguration(
  config?: Partial<WatchModeConfig>,
  projectRoot?: string
): WatchConfiguration {
  return new WatchConfiguration(config, undefined, undefined, projectRoot);
}

/**
 * Create production watch configuration
 */
export function createProductionWatchConfiguration(projectRoot?: string): WatchConfiguration {
  const config = new WatchConfiguration();
  const prodConfig = config.getModeConfig('production');
  return new WatchConfiguration(prodConfig, undefined, undefined, projectRoot);
}

/**
 * Create test watch configuration
 */
export function createTestWatchConfiguration(projectRoot?: string): WatchConfiguration {
  const config = new WatchConfiguration();
  const testConfig = config.getModeConfig('test');
  return new WatchConfiguration(testConfig, undefined, undefined, projectRoot);
}
