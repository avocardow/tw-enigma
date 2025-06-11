/**
 * Copyright (c) 2025 Rowan Cardow
 * 
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * Configuration Detector - Auto-detect Build Tool and Framework Configurations
 * Leverages framework detection from Task 25 to automatically configure build tool integrations
 */

import { readFile, access } from 'fs/promises';
import { join, resolve } from 'path';
import { createLogger } from '../../logger.js';
import { FrameworkDetector } from '../../frameworkDetector.js';
import type { FrameworkInfo, DetectionResult } from '../../frameworkDetector.js';
import type { 
  BuildToolType, 
  BuildToolPluginConfig, 
  BuildToolContext,
  BuildPhase 
} from './buildToolPlugin.js';

const logger = createLogger('config-detector');

/**
 * Detected build tool configuration
 */
export interface DetectedBuildConfig {
  /** Build tool type */
  buildTool: BuildToolType;
  /** Configuration file path */
  configPath?: string;
  /** Parsed configuration object */
  config: Record<string, any>;
  /** Confidence score (0-1) */
  confidence: number;
  /** Detection source */
  source: 'config-file' | 'package-json' | 'file-structure' | 'framework-detection';
  /** Framework information */
  framework?: FrameworkInfo;
}

/**
 * Auto-configuration result
 */
export interface AutoConfigResult {
  /** Successfully detected configurations */
  detected: DetectedBuildConfig[];
  /** Recommended configuration */
  recommended?: DetectedBuildConfig;
  /** Generated plugin configurations */
  pluginConfigs: BuildToolPluginConfig[];
  /** Warning messages */
  warnings: string[];
  /** Errors encountered */
  errors: string[];
}

/**
 * Configuration detection patterns
 */
interface ConfigPattern {
  /** Build tool type */
  buildTool: BuildToolType;
  /** Configuration file patterns */
  configFiles: string[];
  /** Package.json dependency patterns */
  dependencies: string[];
  /** Signature patterns in config files */
  signatures: string[];
  /** Detection function */
  detect: (configPath: string, content: string) => Promise<DetectedBuildConfig | null>;
}

/**
 * Configuration detector class
 */
export class ConfigDetector {
  private frameworkDetector: FrameworkDetector;
  private patterns: ConfigPattern[];

  constructor() {
    this.frameworkDetector = new FrameworkDetector();
    this.patterns = this.initializePatterns();
    
    logger.debug('Configuration detector initialized');
  }

  /**
   * Auto-detect build tool configurations in a project
   */
  async detectConfiguration(projectRoot: string): Promise<AutoConfigResult> {
    const result: AutoConfigResult = {
      detected: [],
      pluginConfigs: [],
      warnings: [],
      errors: []
    };

    try {
      // First, detect frameworks to guide build tool detection
      const frameworkResults = await this.frameworkDetector.detect(projectRoot);
      const framework = frameworkResults.primary; // Use primary framework

      logger.debug('Framework detection completed', { 
        framework: framework?.name,
        confidence: framework?.confidence 
      });

      // Detect build tools based on configuration files
      for (const pattern of this.patterns) {
        try {
          const configs = await this.detectBuildTool(projectRoot, pattern, framework);
          result.detected.push(...configs);
        } catch (error) {
          logger.warn(`Error detecting ${pattern.buildTool}`, { error });
          result.warnings.push(`Failed to detect ${pattern.buildTool}: ${error instanceof Error ? error.message : String(error)}`);
        }
      }

      // Remove duplicates and sort by confidence
      result.detected = this.deduplicateConfigs(result.detected);
      result.detected.sort((a, b) => b.confidence - a.confidence);

      // Select recommended configuration
      if (result.detected.length > 0) {
        result.recommended = result.detected[0];
      }

      // Generate plugin configurations
      result.pluginConfigs = await this.generatePluginConfigs(result.detected, framework);

      logger.info('Configuration detection completed', {
        detected: result.detected.length,
        recommended: result.recommended?.buildTool,
        framework: framework?.name
      });

    } catch (error) {
      logger.error('Configuration detection failed', { error });
      result.errors.push(`Configuration detection failed: ${error instanceof Error ? error.message : String(error)}`);
    }

    return result;
  }

  /**
   * Initialize detection patterns for different build tools
   */
  private initializePatterns(): ConfigPattern[] {
    return [
      // Webpack
      {
        buildTool: 'webpack',
        configFiles: ['webpack.config.js', 'webpack.config.ts', 'webpack.config.mjs'],
        dependencies: ['webpack', 'webpack-cli', 'webpack-dev-server'],
        signatures: ['module.exports', 'entry:', 'output:', 'plugins:'],
        detect: this.detectWebpack.bind(this)
      },

      // Vite
      {
        buildTool: 'vite',
        configFiles: ['vite.config.js', 'vite.config.ts', 'vite.config.mjs'],
        dependencies: ['vite', '@vitejs/plugin-react', '@vitejs/plugin-vue'],
        signatures: ['defineConfig', 'plugins:', 'build:', 'server:'],
        detect: this.detectVite.bind(this)
      },

      // Next.js
      {
        buildTool: 'nextjs',
        configFiles: ['next.config.js', 'next.config.mjs'],
        dependencies: ['next'],
        signatures: ['nextConfig', 'module.exports', 'experimental:', 'webpack:'],
        detect: this.detectNextjs.bind(this)
      },

      // ESBuild
      {
        buildTool: 'esbuild',
        configFiles: ['esbuild.config.js', 'esbuild.config.mjs'],
        dependencies: ['esbuild'],
        signatures: ['build(', 'entryPoints:', 'outdir:', 'bundle:'],
        detect: this.detectESBuild.bind(this)
      },

      // Rollup
      {
        buildTool: 'rollup',
        configFiles: ['rollup.config.js', 'rollup.config.ts', 'rollup.config.mjs'],
        dependencies: ['rollup'],
        signatures: ['export default', 'input:', 'output:', 'plugins:'],
        detect: this.detectRollup.bind(this)
      },

      // Parcel
      {
        buildTool: 'parcel',
        configFiles: ['.parcelrc', 'parcel.config.js'],
        dependencies: ['parcel'],
        signatures: ['"extends":', '"transformers":', '"bundler":'],
        detect: this.detectParcel.bind(this)
      }
    ];
  }

  /**
   * Detect build tool configurations
   */
  private async detectBuildTool(
    projectRoot: string,
    pattern: ConfigPattern,
    framework?: FrameworkInfo
  ): Promise<DetectedBuildConfig[]> {
    const configs: DetectedBuildConfig[] = [];

    // Check for configuration files
    for (const configFile of pattern.configFiles) {
      const configPath = join(projectRoot, configFile);
      
      try {
        await access(configPath);
        const content = await readFile(configPath, 'utf-8');
        
        // Check for signature patterns
        const hasSignatures = pattern.signatures.some(sig => content.includes(sig));
        if (hasSignatures) {
          const detected = await pattern.detect(configPath, content);
          if (detected) {
            detected.framework = framework;
            configs.push(detected);
          }
        }
      } catch {
        // File doesn't exist, continue
      }
    }

    // Check package.json for dependencies if no config file found
    if (configs.length === 0) {
      const packageJsonPath = join(projectRoot, 'package.json');
      try {
        const packageContent = await readFile(packageJsonPath, 'utf-8');
        const packageJson = JSON.parse(packageContent);
        const allDeps = {
          ...packageJson.dependencies,
          ...packageJson.devDependencies,
          ...packageJson.peerDependencies
        };

        const hasToolDeps = pattern.dependencies.some(dep => dep in allDeps);
        if (hasToolDeps) {
          configs.push({
            buildTool: pattern.buildTool,
            config: packageJson,
            confidence: 0.6, // Medium confidence for package.json only
            source: 'package-json',
            framework
          });
        }
      } catch {
        // package.json doesn't exist or is malformed
      }
    }

    return configs;
  }

  /**
   * Webpack detection
   */
  private async detectWebpack(configPath: string, content: string): Promise<DetectedBuildConfig | null> {
    try {
      // Basic webpack config detection
      const config = {
        configPath,
        type: 'webpack',
        hasReact: content.includes('react'),
        hasTypescript: content.includes('typescript') || content.includes('.ts'),
        hasDevServer: content.includes('webpack-dev-server') || content.includes('devServer'),
        hasHMR: content.includes('hot: true') || content.includes('HotModuleReplacementPlugin')
      };

      return {
        buildTool: 'webpack',
        configPath,
        config,
        confidence: 0.9,
        source: 'config-file'
      };
    } catch (error) {
      logger.warn('Failed to parse webpack config', { configPath, error });
      return null;
    }
  }

  /**
   * Vite detection
   */
  private async detectVite(configPath: string, content: string): Promise<DetectedBuildConfig | null> {
    try {
      const config = {
        configPath,
        type: 'vite',
        hasReact: content.includes('@vitejs/plugin-react') || content.includes('plugin-react'),
        hasVue: content.includes('@vitejs/plugin-vue') || content.includes('plugin-vue'),
        hasTypescript: content.includes('typescript') || configPath.endsWith('.ts'),
        hasServer: content.includes('server:'),
        hasBuild: content.includes('build:')
      };

      return {
        buildTool: 'vite',
        configPath,
        config,
        confidence: 0.95,
        source: 'config-file'
      };
    } catch (error) {
      logger.warn('Failed to parse vite config', { configPath, error });
      return null;
    }
  }

  /**
   * Next.js detection
   */
  private async detectNextjs(configPath: string, content: string): Promise<DetectedBuildConfig | null> {
    try {
      const config = {
        configPath,
        type: 'nextjs',
        hasAppDir: content.includes('appDir') || content.includes('experimental'),
        hasTypescript: content.includes('typescript'),
        hasWebpackConfig: content.includes('webpack:'),
        hasExperimental: content.includes('experimental:')
      };

      return {
        buildTool: 'nextjs',
        configPath,
        config,
        confidence: 0.95,
        source: 'config-file'
      };
    } catch (error) {
      logger.warn('Failed to parse next.js config', { configPath, error });
      return null;
    }
  }

  /**
   * ESBuild detection
   */
  private async detectESBuild(configPath: string, content: string): Promise<DetectedBuildConfig | null> {
    try {
      const config = {
        configPath,
        type: 'esbuild',
        hasBundle: content.includes('bundle:'),
        hasWatch: content.includes('watch:'),
        hasMinify: content.includes('minify:')
      };

      return {
        buildTool: 'esbuild',
        configPath,
        config,
        confidence: 0.85,
        source: 'config-file'
      };
    } catch (error) {
      logger.warn('Failed to parse esbuild config', { configPath, error });
      return null;
    }
  }

  /**
   * Rollup detection
   */
  private async detectRollup(configPath: string, content: string): Promise<DetectedBuildConfig | null> {
    try {
      const config = {
        configPath,
        type: 'rollup',
        hasPlugins: content.includes('plugins:'),
        hasInput: content.includes('input:'),
        hasOutput: content.includes('output:')
      };

      return {
        buildTool: 'rollup',
        configPath,
        config,
        confidence: 0.85,
        source: 'config-file'
      };
    } catch (error) {
      logger.warn('Failed to parse rollup config', { configPath, error });
      return null;
    }
  }

  /**
   * Parcel detection
   */
  private async detectParcel(configPath: string, content: string): Promise<DetectedBuildConfig | null> {
    try {
      const config = {
        configPath,
        type: 'parcel',
        hasTransformers: content.includes('transformers'),
        hasBundler: content.includes('bundler'),
        hasExtends: content.includes('extends')
      };

      return {
        buildTool: 'parcel',
        configPath,
        config,
        confidence: 0.8,
        source: 'config-file'
      };
    } catch (error) {
      logger.warn('Failed to parse parcel config', { configPath, error });
      return null;
    }
  }

  /**
   * Remove duplicate configurations
   */
  private deduplicateConfigs(configs: DetectedBuildConfig[]): DetectedBuildConfig[] {
    const seen = new Set<string>();
    return configs.filter(config => {
      const key = `${config.buildTool}-${config.configPath || 'no-path'}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  /**
   * Generate plugin configurations based on detected build tools
   */
  private async generatePluginConfigs(
    configs: DetectedBuildConfig[],
    framework?: FrameworkInfo
  ): Promise<BuildToolPluginConfig[]> {
    const pluginConfigs: BuildToolPluginConfig[] = [];

    for (const config of configs) {
      const pluginConfig: BuildToolPluginConfig = {
        name: `enigma-${config.buildTool}-plugin`,
        enabled: true,
        priority: this.getBuildToolPriority(config.buildTool),
        buildTool: {
          type: config.buildTool,
          autoDetect: true,
          configPath: config.configPath,
          development: {
            hmr: true,
            hmrDelay: 100,
            liveReload: true
          },
          production: {
            sourceMaps: true,
            minify: true,
            extractCSS: true
          },
          hooks: {
            enabledPhases: this.getEnabledPhases(config.buildTool),
            priority: this.getBuildToolPriority(config.buildTool)
          }
        }
      };

      // Customize based on framework
      if (framework) {
        this.customizeForFramework(pluginConfig, framework);
      }

      pluginConfigs.push(pluginConfig);
    }

    return pluginConfigs;
  }

  /**
   * Get build tool priority for execution order
   */
  private getBuildToolPriority(buildTool: BuildToolType): number {
    const priorities: Record<BuildToolType, number> = {
      'nextjs': 1,     // Highest priority for frameworks
      'vite': 2,
      'webpack': 3,
      'esbuild': 4,
      'rollup': 5,
      'parcel': 6,
      'custom': 10     // Lowest priority
    };

    return priorities[buildTool] || 10;
  }

  /**
   * Get enabled phases for a build tool
   */
  private getEnabledPhases(buildTool: BuildToolType): BuildPhase[] {
    const phaseMap: Record<BuildToolType, BuildPhase[]> = {
      'webpack': ['beforeBuild', 'compilation', 'emit', 'afterBuild'],
      'vite': ['buildStart', 'transform', 'generateBundle', 'afterBuild'],
      'nextjs': ['beforeBuild', 'compilation', 'afterBuild', 'development', 'production'],
      'esbuild': ['beforeBuild', 'transform', 'afterBuild'],
      'rollup': ['buildStart', 'transform', 'generateBundle', 'afterBuild'],
      'parcel': ['beforeBuild', 'transform', 'afterBuild'],
      'custom': ['beforeBuild', 'transform', 'afterBuild']
    };

    return phaseMap[buildTool] || ['beforeBuild', 'afterBuild'];
  }

  /**
   * Customize plugin configuration for specific frameworks
   */
  private customizeForFramework(config: BuildToolPluginConfig, framework: FrameworkInfo): void {
    switch (framework.type) {
      case 'react':
        if (config.buildTool.development) {
          config.buildTool.development.hmr = true; // React benefits from HMR
        }
        break;
        
      case 'nextjs':
        if (config.buildTool.production) {
          config.buildTool.production.extractCSS = true; // Next.js handles CSS extraction
        }
        break;
        
      case 'vite':
        if (config.buildTool.development) {
          config.buildTool.development.hmrDelay = 50; // Vite is faster
        }
        break;
    }
  }
} 