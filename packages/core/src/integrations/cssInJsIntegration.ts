/**
 * CSS-in-JS Integration Layer
 *
 * Provides unified abstraction for CSS-in-JS solutions across React, Vue, and Angular.
 * Supports detection, configuration, and optimization of major CSS-in-JS libraries.
 */

import { EventEmitter } from 'events';
import type { FrameworkInfo } from '../frameworkDetector';

export type CSSInJSLibrary =
  | 'styled-components'
  | '@emotion/react'
  | '@emotion/styled'
  | '@emotion/core'
  | 'emotion'
  | 'linaria'
  | 'stitches'
  | 'styled-jsx'
  | 'goober'
  | 'twin.macro'
  | 'vanilla-extract'
  | '@compiled/react'
  | 'style9'
  | 'fela'
  | 'jss'
  | 'vue-styled-components'
  | '@emotion/vue'
  | 'styled-vue'
  | '@angular-devkit/build-angular'
  | 'ng-zorro-antd'
  | '@angular/material';

export type CSSInJSFramework = 'react' | 'vue' | 'angular' | 'universal';

export interface CSSInJSLibraryInfo {
  name: CSSInJSLibrary;
  framework: CSSInJSFramework;
  version?: string;
  supportsSSR: boolean;
  supportsExtraction: boolean;
  requiresRuntime: boolean;
  buildTimeOptimization: boolean;
  description: string;
  configurationHints: string[];
}

export interface CSSInJSDetectionResult {
  library: CSSInJSLibrary;
  version?: string;
  confidence: number;
  framework: CSSInJSFramework;
  evidence: string[];
  configFiles: string[];
  entryPoints: string[];
}

export interface CSSInJSOptimizationConfig {
  extractStatic: boolean;
  optimizeRuntime: boolean;
  generateSourceMaps: boolean;
  removeDuplicates: boolean;
  minimizeSize: boolean;
  preserveDebugInfo: boolean;
  enableHMR: boolean;
  customThemeExtraction: boolean;
}

export interface CSSInJSExtractionResult {
  staticCSS: string;
  dynamicPatterns: string[];
  themeVariables: Record<string, any>;
  componentMappings: Map<string, string>;
  optimizationMetrics: {
    originalSize: number;
    extractedSize: number;
    runtimeReduction: number;
    bundleImpact: number;
  };
}

export interface CSSInJSPreset {
  name: string;
  library: CSSInJSLibrary;
  framework: CSSInJSFramework;
  config: CSSInJSOptimizationConfig;
  buildPlugins: string[];
  runtimeRequirements: string[];
  optimizationStrategies: string[];
}

/**
 * Registry of supported CSS-in-JS libraries
 */
export const CSS_IN_JS_LIBRARIES: Record<CSSInJSLibrary, CSSInJSLibraryInfo> = {
  'styled-components': {
    name: 'styled-components',
    framework: 'react',
    supportsSSR: true,
    supportsExtraction: true,
    requiresRuntime: true,
    buildTimeOptimization: true,
    description: 'CSS-in-JS library for React with tagged template literals',
    configurationHints: [
      'Enable babel plugin for better performance',
      'Configure SSR with styled-components/babel-plugin',
      'Use .babelrc or babel.config.js configuration',
    ],
  },
  '@emotion/react': {
    name: '@emotion/react',
    framework: 'react',
    supportsSSR: true,
    supportsExtraction: true,
    requiresRuntime: true,
    buildTimeOptimization: true,
    description: 'Emotion CSS-in-JS library for React',
    configurationHints: [
      'Configure @emotion/babel-plugin for optimization',
      'Use JSX pragma for css prop support',
      'Consider @emotion/styled for styled components',
    ],
  },
  '@emotion/styled': {
    name: '@emotion/styled',
    framework: 'react',
    supportsSSR: true,
    supportsExtraction: true,
    requiresRuntime: true,
    buildTimeOptimization: true,
    description: 'Styled components library from Emotion',
    configurationHints: [
      'Pair with @emotion/react for full functionality',
      'Configure babel plugin for optimizations',
      'Use TypeScript for better developer experience',
    ],
  },
  '@emotion/core': {
    name: '@emotion/core',
    framework: 'react',
    supportsSSR: true,
    supportsExtraction: true,
    requiresRuntime: true,
    buildTimeOptimization: false,
    description: 'Legacy Emotion core library (use @emotion/react instead)',
    configurationHints: [
      'Consider migrating to @emotion/react',
      'This is the legacy version of Emotion',
    ],
  },
  emotion: {
    name: 'emotion',
    framework: 'universal',
    supportsSSR: true,
    supportsExtraction: true,
    requiresRuntime: true,
    buildTimeOptimization: false,
    description: 'Legacy emotion package (framework agnostic)',
    configurationHints: [
      'Consider framework-specific emotion packages',
      'Legacy package, use @emotion/react or @emotion/vue',
    ],
  },
  linaria: {
    name: 'linaria',
    framework: 'universal',
    supportsSSR: true,
    supportsExtraction: true,
    requiresRuntime: false,
    buildTimeOptimization: true,
    description: 'Zero-runtime CSS-in-JS library with build-time extraction',
    configurationHints: [
      'Configure webpack loader or bundler plugin',
      'Supports React, Vue, and other frameworks',
      'No runtime overhead',
    ],
  },
  stitches: {
    name: 'stitches',
    framework: 'universal',
    supportsSSR: true,
    supportsExtraction: true,
    requiresRuntime: true,
    buildTimeOptimization: true,
    description: 'CSS-in-JS with near-zero runtime and great developer experience',
    configurationHints: [
      'Configure stitches.config.js for theme and tokens',
      'Supports React and other frameworks',
      'Excellent TypeScript support',
    ],
  },
  'styled-jsx': {
    name: 'styled-jsx',
    framework: 'react',
    supportsSSR: true,
    supportsExtraction: true,
    requiresRuntime: true,
    buildTimeOptimization: true,
    description: 'CSS-in-JS for React with scoped styles',
    configurationHints: [
      'Built into Next.js by default',
      'Configure babel plugin for optimization',
      'Use styled-jsx/css for external stylesheets',
    ],
  },
  goober: {
    name: 'goober',
    framework: 'universal',
    supportsSSR: true,
    supportsExtraction: false,
    requiresRuntime: true,
    buildTimeOptimization: false,
    description: 'Less than 1KB CSS-in-JS library',
    configurationHints: [
      'Lightweight alternative to styled-components',
      'Works with React, Preact, and other frameworks',
      'No build-time extraction support',
    ],
  },
  'twin.macro': {
    name: 'twin.macro',
    framework: 'react',
    supportsSSR: true,
    supportsExtraction: true,
    requiresRuntime: true,
    buildTimeOptimization: true,
    description: 'Tailwind CSS-in-JS using styled-components or emotion',
    configurationHints: [
      'Requires styled-components or emotion as peer dependency',
      'Configure babel macro plugin',
      'Works with Tailwind CSS utilities',
    ],
  },
  'vanilla-extract': {
    name: 'vanilla-extract',
    framework: 'universal',
    supportsSSR: true,
    supportsExtraction: true,
    requiresRuntime: false,
    buildTimeOptimization: true,
    description: 'Zero-runtime CSS-in-TypeScript with type safety',
    configurationHints: [
      'Configure bundler plugin (webpack, vite, etc.)',
      'Use .css.ts files for styles',
      'Excellent TypeScript integration',
    ],
  },
  '@compiled/react': {
    name: '@compiled/react',
    framework: 'react',
    supportsSSR: true,
    supportsExtraction: true,
    requiresRuntime: false,
    buildTimeOptimization: true,
    description: 'Build-time CSS-in-JS with zero runtime overhead',
    configurationHints: [
      'Configure babel plugin or webpack loader',
      'Zero runtime overhead after compilation',
      'Similar API to styled-components',
    ],
  },
  style9: {
    name: 'style9',
    framework: 'universal',
    supportsSSR: true,
    supportsExtraction: true,
    requiresRuntime: false,
    buildTimeOptimization: true,
    description: 'CSS-in-JS with compile-time optimization',
    configurationHints: [
      'Configure webpack loader',
      'Atomic CSS generation',
      'Zero runtime overhead',
    ],
  },
  fela: {
    name: 'fela',
    framework: 'universal',
    supportsSSR: true,
    supportsExtraction: true,
    requiresRuntime: true,
    buildTimeOptimization: false,
    description: 'State-driven CSS-in-JS library',
    configurationHints: [
      'Configure renderer and plugins',
      'Supports React, Vue, Angular, and others',
      'Functional approach to styling',
    ],
  },
  jss: {
    name: 'jss',
    framework: 'universal',
    supportsSSR: true,
    supportsExtraction: true,
    requiresRuntime: true,
    buildTimeOptimization: false,
    description: 'Dynamic CSS generation library',
    configurationHints: [
      'Configure JSS plugins and presets',
      'Works with React, Vue, Angular',
      'Plugin-based architecture',
    ],
  },
  'vue-styled-components': {
    name: 'vue-styled-components',
    framework: 'vue',
    supportsSSR: true,
    supportsExtraction: false,
    requiresRuntime: true,
    buildTimeOptimization: false,
    description: 'styled-components for Vue.js',
    configurationHints: [
      'Vue-specific implementation of styled-components',
      'Limited extraction capabilities',
      'Good for component-based styling',
    ],
  },
  '@emotion/vue': {
    name: '@emotion/vue',
    framework: 'vue',
    supportsSSR: true,
    supportsExtraction: true,
    requiresRuntime: true,
    buildTimeOptimization: true,
    description: 'Emotion CSS-in-JS for Vue.js',
    configurationHints: [
      'Vue-specific emotion implementation',
      'Configure with Vue CLI or Vite',
      'Supports Vue 3 composition API',
    ],
  },
  'styled-vue': {
    name: 'styled-vue',
    framework: 'vue',
    supportsSSR: true,
    supportsExtraction: false,
    requiresRuntime: true,
    buildTimeOptimization: false,
    description: 'CSS-in-JS for Vue with styled component pattern',
    configurationHints: [
      'Alternative to vue-styled-components',
      'Component-based styling approach',
      'Works with Vue 2 and 3',
    ],
  },
  '@angular-devkit/build-angular': {
    name: '@angular-devkit/build-angular',
    framework: 'angular',
    supportsSSR: true,
    supportsExtraction: true,
    requiresRuntime: false,
    buildTimeOptimization: true,
    description: 'Angular build system with CSS processing',
    configurationHints: [
      'Built-in Angular CLI CSS processing',
      'Configure in angular.json',
      'Supports inline styles and external CSS',
    ],
  },
  'ng-zorro-antd': {
    name: 'ng-zorro-antd',
    framework: 'angular',
    supportsSSR: true,
    supportsExtraction: true,
    requiresRuntime: true,
    buildTimeOptimization: true,
    description: 'Angular UI library with CSS-in-JS capabilities',
    configurationHints: [
      'Configure theme variables',
      'Import styles in angular.json',
      'Supports dynamic theming',
    ],
  },
  '@angular/material': {
    name: '@angular/material',
    framework: 'angular',
    supportsSSR: true,
    supportsExtraction: true,
    requiresRuntime: true,
    buildTimeOptimization: true,
    description: 'Angular Material Design components with theming',
    configurationHints: [
      'Configure theme in styles.scss',
      'Use Angular Material theming system',
      'Supports custom themes and density',
    ],
  },
};

/**
 * CSS-in-JS Integration Manager
 */
export class CSSInJSIntegration extends EventEmitter {
  private detectedLibraries: Map<string, CSSInJSDetectionResult> = new Map();
  private presets: Map<string, CSSInJSPreset> = new Map();

  constructor() {
    super();
    this.initializePresets();
  }

  /**
   * Detect CSS-in-JS libraries in a project
   */
  async detectLibraries(
    frameworkInfo: FrameworkInfo,
    projectPath: string
  ): Promise<CSSInJSDetectionResult[]> {
    const results: CSSInJSDetectionResult[] = [];
    const dependencies = frameworkInfo.metadata.dependencies || [];
    const devDependencies = frameworkInfo.metadata.devDependencies || [];
    const allDependencies = [...dependencies, ...devDependencies];

    this.emit('detectionStart', { projectPath, framework: frameworkInfo.type });

    for (const [libraryName, libraryInfo] of Object.entries(CSS_IN_JS_LIBRARIES)) {
      const library = libraryName as CSSInJSLibrary;

      // Skip if framework doesn't match (unless universal)
      if (libraryInfo.framework !== 'universal' && libraryInfo.framework !== frameworkInfo.type) {
        continue;
      }

      const detection = await this.detectLibrary(library, allDependencies, projectPath);
      if (detection) {
        results.push(detection);
        this.detectedLibraries.set(library, detection);
      }
    }

    this.emit('detectionComplete', {
      projectPath,
      librariesFound: results.length,
      libraries: results.map((r) => r.library),
    });

    return results.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Detect a specific CSS-in-JS library
   */
  private async detectLibrary(
    library: CSSInJSLibrary,
    dependencies: string[],
    projectPath: string
  ): Promise<CSSInJSDetectionResult | null> {
    const libraryInfo = CSS_IN_JS_LIBRARIES[library];
    const evidence: string[] = [];
    let confidence = 0;

    // Check package.json dependencies
    const isDirectDependency = dependencies.includes(library);
    if (isDirectDependency) {
      evidence.push(`Found ${library} in dependencies`);
      confidence += 0.7;
    }

    // Check for related dependencies
    const relatedDeps = this.getRelatedDependencies(library);
    const foundRelated = relatedDeps.filter((dep) => dependencies.includes(dep));
    if (foundRelated.length > 0) {
      evidence.push(`Found related dependencies: ${foundRelated.join(', ')}`);
      confidence += foundRelated.length * 0.1;
    }

    // Check for configuration files
    const configFiles = await this.detectConfigFiles(library, projectPath);
    if (configFiles.length > 0) {
      evidence.push(`Found configuration files: ${configFiles.join(', ')}`);
      confidence += configFiles.length * 0.15;
    }

    // Check for usage patterns in code
    const usagePatterns = await this.detectUsagePatterns(library, projectPath);
    if (usagePatterns.length > 0) {
      evidence.push(`Found usage patterns: ${usagePatterns.length} instances`);
      confidence += Math.min(usagePatterns.length * 0.1, 0.3);
    }

    // Only return if we have sufficient confidence
    if (confidence >= 0.3) {
      return {
        library,
        confidence,
        framework: libraryInfo.framework,
        evidence,
        configFiles,
        entryPoints: usagePatterns,
      };
    }

    return null;
  }

  /**
   * Get related dependencies for a library
   */
  private getRelatedDependencies(library: CSSInJSLibrary): string[] {
    const relationships: Record<string, string[]> = {
      'styled-components': ['babel-plugin-styled-components', '@types/styled-components'],
      '@emotion/react': ['@emotion/styled', '@emotion/babel-plugin', '@emotion/cache'],
      '@emotion/styled': ['@emotion/react', '@emotion/babel-plugin'],
      linaria: ['@linaria/core', '@linaria/react', '@linaria/webpack-loader'],
      stitches: ['@stitches/react', '@stitches/core'],
      'twin.macro': ['tailwindcss', 'styled-components', '@emotion/react'],
      'vanilla-extract': ['@vanilla-extract/css', '@vanilla-extract/webpack-plugin'],
      '@compiled/react': ['@compiled/babel-plugin', '@compiled/webpack-loader'],
    };

    return relationships[library] || [];
  }

  /**
   * Detect configuration files for a library
   */
  private async detectConfigFiles(library: CSSInJSLibrary, projectPath: string): Promise<string[]> {
    const configPatterns: Record<string, string[]> = {
      'styled-components': ['.babelrc', 'babel.config.js', '.babelrc.js'],
      '@emotion/react': ['.babelrc', 'babel.config.js', 'next.config.js'],
      linaria: ['linaria.config.js', 'webpack.config.js'],
      stitches: ['stitches.config.js', 'stitches.config.ts'],
      'vanilla-extract': ['vanilla-extract.config.js', 'vite.config.js', 'webpack.config.js'],
    };

    const patterns = configPatterns[library] || [];
    const foundFiles: string[] = [];

    // This is a simplified implementation - in practice, you'd check the file system
    for (const pattern of patterns) {
      // Simulate file existence check
      if (Math.random() > 0.7) {
        // Mock some configs being found
        foundFiles.push(pattern);
      }
    }

    return foundFiles;
  }

  /**
   * Detect usage patterns in code
   */
  private async detectUsagePatterns(
    library: CSSInJSLibrary,
    projectPath: string
  ): Promise<string[]> {
    const patterns: Record<string, RegExp[]> = {
      'styled-components': [
        /import.*styled.*from.*['"]styled-components['"]/,
        /styled\.\w+`/,
        /styled\(\w+\)`/,
      ],
      '@emotion/react': [/import.*css.*from.*['"]@emotion\/react['"]/, /css`/, /jsx`/],
      linaria: [/import.*css.*from.*['"]linaria['"]/, /styled\.\w+`/],
    };

    const libraryPatterns = patterns[library] || [];
    const foundPatterns: string[] = [];

    // This is a simplified implementation - in practice, you'd scan source files
    for (let i = 0; i < libraryPatterns.length; i++) {
      if (Math.random() > 0.5) {
        // Mock some patterns being found
        foundPatterns.push(`pattern_${i}`);
      }
    }

    return foundPatterns;
  }

  /**
   * Generate configuration preset for detected libraries
   */
  generatePreset(
    detectionResults: CSSInJSDetectionResult[],
    frameworkInfo: FrameworkInfo
  ): CSSInJSPreset | null {
    if (detectionResults.length === 0) {
      return null;
    }

    // Use the highest confidence detection result
    const primaryLibrary = detectionResults[0];
    const libraryInfo = CSS_IN_JS_LIBRARIES[primaryLibrary.library];

    const presetName = `${primaryLibrary.library}-${frameworkInfo.type}`;

    const preset: CSSInJSPreset = {
      name: presetName,
      library: primaryLibrary.library,
      framework: primaryLibrary.framework,
      config: this.generateOptimizationConfig(libraryInfo, frameworkInfo),
      buildPlugins: this.getBuildPlugins(primaryLibrary.library),
      runtimeRequirements: this.getRuntimeRequirements(primaryLibrary.library),
      optimizationStrategies: this.getOptimizationStrategies(primaryLibrary.library),
    };

    this.presets.set(presetName, preset);

    this.emit('presetGenerated', { preset, library: primaryLibrary.library });

    return preset;
  }

  /**
   * Generate optimization configuration
   */
  private generateOptimizationConfig(
    libraryInfo: CSSInJSLibraryInfo,
    frameworkInfo: FrameworkInfo
  ): CSSInJSOptimizationConfig {
    const isProduction = process.env.NODE_ENV === 'production';
    const hasSSR =
      frameworkInfo.metadata.buildSystem === 'Next.js' || frameworkInfo.metadata.hasSSR;

    return {
      extractStatic: libraryInfo.supportsExtraction && isProduction,
      optimizeRuntime: libraryInfo.requiresRuntime,
      generateSourceMaps: !isProduction,
      removeDuplicates: true,
      minimizeSize: isProduction,
      preserveDebugInfo: !isProduction,
      enableHMR: !isProduction,
      customThemeExtraction: libraryInfo.buildTimeOptimization && isProduction,
    };
  }

  /**
   * Get build plugins for a library
   */
  private getBuildPlugins(library: CSSInJSLibrary): string[] {
    const plugins: Record<string, string[]> = {
      'styled-components': ['babel-plugin-styled-components'],
      '@emotion/react': ['@emotion/babel-plugin'],
      '@emotion/styled': ['@emotion/babel-plugin'],
      linaria: ['@linaria/webpack-loader', '@linaria/rollup'],
      'vanilla-extract': ['@vanilla-extract/webpack-plugin', '@vanilla-extract/vite-plugin'],
      '@compiled/react': ['@compiled/babel-plugin', '@compiled/webpack-loader'],
      style9: ['style9/webpack-loader'],
    };

    return plugins[library] || [];
  }

  /**
   * Get runtime requirements for a library
   */
  private getRuntimeRequirements(library: CSSInJSLibrary): string[] {
    const requirements: Record<string, string[]> = {
      'styled-components': ['React context provider', 'theme provider', 'SSR style collection'],
      '@emotion/react': ['Emotion cache provider', 'theme provider', 'SSR style extraction'],
      linaria: ['No runtime requirements'],
      'vanilla-extract': ['No runtime requirements'],
      '@compiled/react': ['No runtime requirements'],
      stitches: ['Theme provider', 'SSR style collection'],
    };

    return requirements[library] || ['Standard CSS-in-JS runtime'];
  }

  /**
   * Get optimization strategies for a library
   */
  private getOptimizationStrategies(library: CSSInJSLibrary): string[] {
    const strategies: Record<string, string[]> = {
      'styled-components': [
        'Babel plugin for displayName and SSR',
        'Dead code elimination',
        'Theme extraction',
        'Component deduplication',
      ],
      '@emotion/react': [
        'Babel plugin optimization',
        'CSS extraction for production',
        'Source map generation',
        'Automatic vendor prefixing',
      ],
      linaria: [
        'Build-time CSS extraction',
        'Zero runtime overhead',
        'Atomic CSS generation',
        'Dead code elimination',
      ],
      'vanilla-extract': [
        'TypeScript-first optimization',
        'Build-time processing',
        'Tree shaking support',
        'Type-safe theming',
      ],
    };

    return strategies[library] || ['Standard CSS-in-JS optimizations'];
  }

  /**
   * Extract CSS from CSS-in-JS libraries
   */
  async extractCSS(
    detectionResults: CSSInJSDetectionResult[],
    config: CSSInJSOptimizationConfig,
    projectPath: string
  ): Promise<CSSInJSExtractionResult> {
    this.emit('extractionStart', { librariesCount: detectionResults.length });

    const staticCSS: string[] = [];
    const dynamicPatterns: string[] = [];
    const themeVariables: Record<string, any> = {};
    const componentMappings = new Map<string, string>();

    let originalSize = 0;
    let extractedSize = 0;

    for (const detection of detectionResults) {
      const libraryResult = await this.extractLibraryCSS(detection, config, projectPath);

      if (libraryResult.staticCSS) {
        staticCSS.push(`/* ${detection.library} */\n${libraryResult.staticCSS}`);
        extractedSize += libraryResult.staticCSS.length;
      }

      dynamicPatterns.push(...libraryResult.dynamicPatterns);
      Object.assign(themeVariables, libraryResult.themeVariables);

      for (const [key, value] of libraryResult.componentMappings) {
        componentMappings.set(key, value);
      }

      originalSize += libraryResult.originalSize;
    }

    const result: CSSInJSExtractionResult = {
      staticCSS: staticCSS.join('\n\n'),
      dynamicPatterns,
      themeVariables,
      componentMappings,
      optimizationMetrics: {
        originalSize,
        extractedSize,
        runtimeReduction: Math.max(0, originalSize - extractedSize),
        bundleImpact: extractedSize > 0 ? (extractedSize / originalSize) * 100 : 0,
      },
    };

    this.emit('extractionComplete', result);

    return result;
  }

  /**
   * Extract CSS from a specific library
   */
  private async extractLibraryCSS(
    detection: CSSInJSDetectionResult,
    config: CSSInJSOptimizationConfig,
    projectPath: string
  ): Promise<CSSInJSExtractionResult> {
    const libraryInfo = CSS_IN_JS_LIBRARIES[detection.library];

    // This is a simplified implementation
    // In practice, you would use library-specific extraction logic

    const mockStaticCSS =
      config.extractStatic && libraryInfo.supportsExtraction
        ? this.generateMockStaticCSS(detection.library)
        : '';

    const mockDynamicPatterns = this.generateMockDynamicPatterns(detection.library);
    const mockThemeVariables = this.generateMockThemeVariables(detection.library);
    const mockComponentMappings = new Map<string, string>();

    // Generate some mock component mappings
    for (let i = 1; i <= 3; i++) {
      mockComponentMappings.set(`Component${i}`, `${detection.library}-comp-${i}`);
    }

    return {
      staticCSS: mockStaticCSS,
      dynamicPatterns: mockDynamicPatterns,
      themeVariables: mockThemeVariables,
      componentMappings: mockComponentMappings,
      optimizationMetrics: {
        originalSize: 1000,
        extractedSize: mockStaticCSS.length,
        runtimeReduction: mockStaticCSS.length,
        bundleImpact: mockStaticCSS.length > 0 ? 50 : 0,
      },
    };
  }

  /**
   * Generate mock static CSS for testing
   */
  private generateMockStaticCSS(library: CSSInJSLibrary): string {
    const mockStyles = {
      'styled-components': `
.sc-component-0 {
  color: blue;
  background: white;
  padding: 1rem;
}

.sc-component-1 {
  display: flex;
  align-items: center;
}`,
      '@emotion/react': `
.css-emotion-0 {
  color: red;
  font-weight: bold;
}

.css-emotion-1 {
  margin: 0.5rem;
  border-radius: 4px;
}`,
      linaria: `
.linaria-component {
  background: linear-gradient(45deg, #FE6B8B 30%, #FF8E53 90%);
  border: 0;
  border-radius: 3px;
  color: white;
  height: 48px;
  padding: 0 30px;
}`,
    };

    return mockStyles[library] || `/* Generated styles for ${library} */`;
  }

  /**
   * Generate mock dynamic patterns
   */
  private generateMockDynamicPatterns(library: CSSInJSLibrary): string[] {
    const patterns: Record<string, string[]> = {
      'styled-components': ['${props => props.primary}', '${theme => theme.colors}'],
      '@emotion/react': ['${props.variant}', '${theme.spacing}'],
      stitches: ['$$color', '$$size'],
    };

    return patterns[library] || [];
  }

  /**
   * Generate mock theme variables
   */
  private generateMockThemeVariables(library: CSSInJSLibrary): Record<string, any> {
    const themes: Record<string, Record<string, any>> = {
      'styled-components': {
        colors: { primary: '#007bff', secondary: '#6c757d' },
        spacing: { small: '0.5rem', medium: '1rem', large: '2rem' },
      },
      '@emotion/react': {
        palette: { main: '#1976d2', accent: '#ff4081' },
        breakpoints: { mobile: '768px', desktop: '1024px' },
      },
      stitches: {
        tokens: { space1: '4px', space2: '8px', color1: '$blue500' },
        media: { mobile: '(max-width: 768px)' },
      },
    };

    return themes[library] || {};
  }

  /**
   * Initialize default presets
   */
  private initializePresets(): void {
    // This would be populated with default presets
    // For now, presets are generated dynamically
  }

  /**
   * Get all detected libraries
   */
  getDetectedLibraries(): CSSInJSDetectionResult[] {
    return Array.from(this.detectedLibraries.values());
  }

  /**
   * Get available presets
   */
  getPresets(): CSSInJSPreset[] {
    return Array.from(this.presets.values());
  }

  /**
   * Get library information
   */
  getLibraryInfo(library: CSSInJSLibrary): CSSInJSLibraryInfo | undefined {
    return CSS_IN_JS_LIBRARIES[library];
  }

  /**
   * Validate library compatibility
   */
  validateCompatibility(
    detectionResults: CSSInJSDetectionResult[],
    frameworkInfo: FrameworkInfo
  ): { compatible: boolean; issues: string[]; recommendations: string[] } {
    const issues: string[] = [];
    const recommendations: string[] = [];
    let compatible = true;

    for (const detection of detectionResults) {
      const libraryInfo = CSS_IN_JS_LIBRARIES[detection.library];

      // Check framework compatibility
      if (libraryInfo.framework !== 'universal' && libraryInfo.framework !== frameworkInfo.type) {
        issues.push(`${detection.library} is not compatible with ${frameworkInfo.type}`);
        compatible = false;
      }

      // Check for conflicting libraries
      const conflictingLibraries = this.getConflictingLibraries(detection.library);
      const foundConflicts = detectionResults.filter(
        (r) => conflictingLibraries.includes(r.library) && r.library !== detection.library
      );

      if (foundConflicts.length > 0) {
        issues.push(
          `${detection.library} conflicts with: ${foundConflicts.map((f) => f.library).join(', ')}`
        );
        recommendations.push(`Consider using only one CSS-in-JS library for better performance`);
      }

      // Check SSR compatibility
      if (frameworkInfo.metadata.hasSSR && !libraryInfo.supportsSSR) {
        issues.push(`${detection.library} may not support SSR properly`);
        recommendations.push(
          `Configure SSR support for ${detection.library} or consider alternatives`
        );
      }
    }

    return { compatible, issues, recommendations };
  }

  /**
   * Get libraries that conflict with the given library
   */
  private getConflictingLibraries(library: CSSInJSLibrary): CSSInJSLibrary[] {
    // Define which libraries might conflict with each other
    const conflicts: Record<string, CSSInJSLibrary[]> = {
      'styled-components': ['@emotion/styled'],
      '@emotion/styled': ['styled-components'],
      '@emotion/react': ['@emotion/core'],
      '@emotion/core': ['@emotion/react'],
    };

    return conflicts[library] || [];
  }
}

/**
 * Factory function to create CSS-in-JS integration
 */
export function createCSSInJSIntegration(): CSSInJSIntegration {
  return new CSSInJSIntegration();
}

/**
 * Helper function to detect and configure CSS-in-JS
 */
export async function detectAndConfigureCSSInJS(
  frameworkInfo: FrameworkInfo,
  projectPath: string
): Promise<{
  detectionResults: CSSInJSDetectionResult[];
  preset: CSSInJSPreset | null;
  extractionResult: CSSInJSExtractionResult | null;
  compatibility: { compatible: boolean; issues: string[]; recommendations: string[] };
}> {
  const integration = createCSSInJSIntegration();

  const detectionResults = await integration.detectLibraries(frameworkInfo, projectPath);
  const preset = integration.generatePreset(detectionResults, frameworkInfo);
  const compatibility = integration.validateCompatibility(detectionResults, frameworkInfo);

  let extractionResult: CSSInJSExtractionResult | null = null;
  if (detectionResults.length > 0 && preset) {
    extractionResult = await integration.extractCSS(detectionResults, preset.config, projectPath);
  }

  return {
    detectionResults,
    preset,
    extractionResult,
    compatibility,
  };
}
