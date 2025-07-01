/**
 * CSS-in-JS Library Detection Utility
 *
 * Provides comprehensive detection capabilities for CSS-in-JS libraries
 * and styling solutions across different frameworks.
 */

import type { DetectionContext } from '../frameworkDetector';

export interface CSSInJSInfo {
  hasCSSInJS: boolean;
  libraries: CSSInJSLibrary[];
  primaryLibrary?: string;
  stylingApproach: StylingApproach[];
  hasThemeProvider: boolean;
  hasStyledComponents: boolean;
  hasUtilityFirst: boolean; // Tailwind, UnoCSS, etc.
}

export interface CSSInJSLibrary {
  name: string;
  type: CSSInJSType;
  confidence: number;
  version?: string;
  features: string[];
}

export type CSSInJSType =
  | 'styled-components' // Template literals
  | 'emotion' // CSS-in-JS with emotion
  | 'chakra-ui' // Component library
  | 'material-ui' // Material Design
  | 'mantine' // Full-featured React components
  | 'styled-system' // Style props
  | 'stitches' // CSS-in-JS with great DX
  | 'vanilla-extract' // Zero-runtime CSS-in-JS
  | 'linaria' // CSS-in-JS with zero runtime
  | 'jss' // CSS-in-JS library
  | 'aphrodite' // CSS-in-JS library
  | 'glamorous' // Deprecated but still used
  | 'theme-ui' // Themeable design system
  | 'tailwind' // Utility-first CSS
  | 'unocss' // Instant on-demand CSS
  | 'windicss' // Next generation utility-first CSS
  | 'css-modules' // CSS Modules
  | 'postcss' // CSS processor
  | 'sass' // Sass/SCSS
  | 'less' // Less CSS
  | 'stylus' // Stylus CSS
  | 'unknown';

export type StylingApproach =
  | 'css-in-js' // Runtime CSS-in-JS
  | 'zero-runtime' // Build-time CSS-in-JS
  | 'utility-first' // Tailwind-style utilities
  | 'component-library' // Pre-built components
  | 'css-modules' // CSS Modules approach
  | 'preprocessor' // Sass, Less, Stylus
  | 'traditional' // Traditional CSS
  | 'hybrid'; // Multiple approaches

export interface CSSInJSDetectionResult {
  hasCSSInJS: boolean;
  confidence: number;
  evidence: string[];
  cssInfo: CSSInJSInfo;
}

/**
 * Universal CSS-in-JS detector that works across frameworks
 */
export class CSSInJSDetector {
  /**
   * Detect CSS-in-JS libraries and styling approaches
   */
  static detect(context: DetectionContext, frameworkType?: string): CSSInJSDetectionResult {
    const evidence: string[] = [];
    let confidence = 0;
    const cssInfo: CSSInJSInfo = {
      hasCSSInJS: false,
      libraries: [],
      stylingApproach: ['traditional'],
      hasThemeProvider: false,
      hasStyledComponents: false,
      hasUtilityFirst: false,
    };

    // Package.json analysis for CSS-in-JS libraries
    const packageResult = this.analyzePackageJsonForCSS(context.packageJson);
    confidence += packageResult.confidence;
    evidence.push(...packageResult.evidence);
    this.mergeCSSInfo(cssInfo, packageResult.cssInfo);

    // Configuration file analysis
    const configResult = this.analyzeConfigFilesForCSS(context.configFiles);
    confidence += configResult.confidence;
    evidence.push(...configResult.evidence);
    this.mergeCSSInfo(cssInfo, configResult.cssInfo);

    // File structure analysis
    const fileResult = this.analyzeFileStructureForCSS(context.fileStructure);
    confidence += fileResult.confidence;
    evidence.push(...fileResult.evidence);
    this.mergeCSSInfo(cssInfo, fileResult.cssInfo);

    // Framework-specific CSS patterns
    if (frameworkType) {
      const frameworkResult = this.detectFrameworkSpecificCSS(context, frameworkType);
      confidence += frameworkResult.confidence;
      evidence.push(...frameworkResult.evidence);
      this.mergeCSSInfo(cssInfo, frameworkResult.cssInfo);
    }

    // Update styling approaches and primary library
    this.updateStylingApproaches(cssInfo);
    this.determinePrimaryLibrary(cssInfo);

    return {
      hasCSSInJS: cssInfo.hasCSSInJS,
      confidence: Math.min(confidence, 1.0),
      evidence,
      cssInfo,
    };
  }

  /**
   * Analyze package.json for CSS-in-JS dependencies
   */
  private static analyzePackageJsonForCSS(packageJson: any): CSSInJSDetectionResult {
    const evidence: string[] = [];
    let confidence = 0;
    const cssInfo: CSSInJSInfo = this.getDefaultCSSInfo();

    if (!packageJson) {
      return { hasCSSInJS: false, confidence: 0, evidence: [], cssInfo };
    }

    const allDeps = {
      ...packageJson.dependencies,
      ...packageJson.devDependencies,
    };

    // CSS-in-JS Libraries
    const cssLibraries = [
      // Styled Components
      { name: 'styled-components', type: 'styled-components' as CSSInJSType, weight: 0.4 },
      { name: '@styled-system/css', type: 'styled-system' as CSSInJSType, weight: 0.3 },
      
      // Emotion
      { name: '@emotion/react', type: 'emotion' as CSSInJSType, weight: 0.4 },
      { name: '@emotion/styled', type: 'emotion' as CSSInJSType, weight: 0.4 },
      { name: '@emotion/css', type: 'emotion' as CSSInJSType, weight: 0.3 },
      
      // Component Libraries
      { name: '@chakra-ui/react', type: 'chakra-ui' as CSSInJSType, weight: 0.5 },
      { name: '@mui/material', type: 'material-ui' as CSSInJSType, weight: 0.5 },
      { name: '@material-ui/core', type: 'material-ui' as CSSInJSType, weight: 0.5 },
      { name: '@mantine/core', type: 'mantine' as CSSInJSType, weight: 0.5 },
      { name: 'theme-ui', type: 'theme-ui' as CSSInJSType, weight: 0.4 },
      
      // Zero-runtime CSS-in-JS
      { name: '@vanilla-extract/css', type: 'vanilla-extract' as CSSInJSType, weight: 0.4 },
      { name: 'linaria', type: 'linaria' as CSSInJSType, weight: 0.4 },
      { name: '@stitches/react', type: 'stitches' as CSSInJSType, weight: 0.4 },
      
      // Traditional CSS-in-JS
      { name: 'jss', type: 'jss' as CSSInJSType, weight: 0.3 },
      { name: 'aphrodite', type: 'aphrodite' as CSSInJSType, weight: 0.3 },
      { name: 'glamorous', type: 'glamorous' as CSSInJSType, weight: 0.2 },
      
      // Utility-first CSS
      { name: 'tailwindcss', type: 'tailwind' as CSSInJSType, weight: 0.5 },
      { name: 'unocss', type: 'unocss' as CSSInJSType, weight: 0.4 },
      { name: 'windicss', type: 'windicss' as CSSInJSType, weight: 0.4 },
      
      // CSS Modules and preprocessors
      { name: 'sass', type: 'sass' as CSSInJSType, weight: 0.2 },
      { name: 'node-sass', type: 'sass' as CSSInJSType, weight: 0.2 },
      { name: 'less', type: 'less' as CSSInJSType, weight: 0.2 },
      { name: 'stylus', type: 'stylus' as CSSInJSType, weight: 0.2 },
      { name: 'postcss', type: 'postcss' as CSSInJSType, weight: 0.1 },
    ];

    for (const lib of cssLibraries) {
      if (allDeps[lib.name]) {
        const library: CSSInJSLibrary = {
          name: lib.name,
          type: lib.type,
          confidence: lib.weight,
          version: allDeps[lib.name],
          features: this.getLibraryFeatures(lib.type),
        };

        cssInfo.libraries.push(library);
        cssInfo.hasCSSInJS = true;
        confidence += lib.weight;
        evidence.push(`${lib.name} dependency found`);

        // Set specific flags
        if (lib.type === 'styled-components' || lib.type === 'emotion') {
          cssInfo.hasStyledComponents = true;
        }
        if (lib.type === 'tailwind' || lib.type === 'unocss' || lib.type === 'windicss') {
          cssInfo.hasUtilityFirst = true;
        }
      }
    }

    // Theme providers detection
    const themeProviders = [
      '@chakra-ui/theme',
      '@mui/system',
      'styled-theming',
      '@theme-ui/theme-provider',
      'styled-components/theme',
    ];

    for (const provider of themeProviders) {
      if (allDeps[provider]) {
        cssInfo.hasThemeProvider = true;
        evidence.push(`Theme provider found: ${provider}`);
        confidence += 0.1;
      }
    }

    // CSS-in-JS related tools
    const cssTools = [
      'babel-plugin-styled-components',
      '@emotion/babel-plugin',
      'babel-plugin-macros',
      'twin.macro',
      'styled-jsx',
    ];

    for (const tool of cssTools) {
      if (allDeps[tool]) {
        evidence.push(`CSS-in-JS tool found: ${tool}`);
        confidence += 0.1;
      }
    }

    return {
      hasCSSInJS: cssInfo.hasCSSInJS,
      confidence,
      evidence,
      cssInfo,
    };
  }

  /**
   * Analyze configuration files for CSS patterns
   */
  private static analyzeConfigFilesForCSS(configFiles?: Map<string, any>): CSSInJSDetectionResult {
    const evidence: string[] = [];
    let confidence = 0;
    const cssInfo: CSSInJSInfo = this.getDefaultCSSInfo();

    if (!configFiles) {
      return { hasCSSInJS: false, confidence: 0, evidence: [], cssInfo };
    }

    // Check Tailwind config
    const tailwindConfig = configFiles.get('tailwind.config.js') || configFiles.get('tailwind.config.ts');
    if (tailwindConfig) {
      const library: CSSInJSLibrary = {
        name: 'tailwindcss',
        type: 'tailwind',
        confidence: 0.5,
        features: ['utility-first', 'responsive', 'dark-mode', 'customizable'],
      };
      cssInfo.libraries.push(library);
      cssInfo.hasUtilityFirst = true;
      cssInfo.hasCSSInJS = true;
      evidence.push('Tailwind CSS configuration found');
      confidence += 0.5;
    }

    // Check UnoCSS config
    const unoConfig = configFiles.get('uno.config.ts') || configFiles.get('unocss.config.ts');
    if (unoConfig) {
      const library: CSSInJSLibrary = {
        name: 'unocss',
        type: 'unocss',
        confidence: 0.4,
        features: ['utility-first', 'instant', 'customizable'],
      };
      cssInfo.libraries.push(library);
      cssInfo.hasUtilityFirst = true;
      cssInfo.hasCSSInJS = true;
      evidence.push('UnoCSS configuration found');
      confidence += 0.4;
    }

    // Check PostCSS config
    const postcssConfig = configFiles.get('postcss.config.js') || configFiles.get('postcss.config.ts');
    if (postcssConfig) {
      evidence.push('PostCSS configuration found');
      confidence += 0.1;

      if (postcssConfig._rawContent) {
        const content = postcssConfig._rawContent;
        if (content.includes('tailwindcss')) {
          cssInfo.hasUtilityFirst = true;
          evidence.push('Tailwind CSS in PostCSS config');
          confidence += 0.2;
        }
        if (content.includes('autoprefixer')) {
          evidence.push('Autoprefixer in PostCSS config');
        }
      }
    }

    // Check for CSS-in-JS in various config files
    for (const [fileName, config] of configFiles) {
      if (config?._rawContent) {
        const content = config._rawContent.toLowerCase();

        if (content.includes('styled-components')) {
          evidence.push(`Styled Components configuration found in ${fileName}`);
          cssInfo.hasStyledComponents = true;
          confidence += 0.2;
        }

        if (content.includes('@emotion')) {
          evidence.push(`Emotion configuration found in ${fileName}`);
          cssInfo.hasStyledComponents = true;
          confidence += 0.2;
        }

        if (content.includes('css-modules')) {
          evidence.push(`CSS Modules configuration found in ${fileName}`);
          confidence += 0.2;
        }
      }
    }

    return {
      hasCSSInJS: cssInfo.hasCSSInJS,
      confidence,
      evidence,
      cssInfo,
    };
  }

  /**
   * Analyze file structure for CSS patterns
   */
  private static analyzeFileStructureForCSS(fileStructure?: {
    directories: string[];
    files: string[];
  }): CSSInJSDetectionResult {
    const evidence: string[] = [];
    let confidence = 0;
    const cssInfo: CSSInJSInfo = this.getDefaultCSSInfo();

    if (!fileStructure) {
      return { hasCSSInJS: false, confidence: 0, evidence: [], cssInfo };
    }

    // Check for styling-related files
    const styleFiles = {
      'tailwind.config.js': { type: 'tailwind' as CSSInJSType, confidence: 0.5 },
      'tailwind.config.ts': { type: 'tailwind' as CSSInJSType, confidence: 0.5 },
      'postcss.config.js': { type: 'postcss' as CSSInJSType, confidence: 0.2 },
      'uno.config.ts': { type: 'unocss' as CSSInJSType, confidence: 0.4 },
      'windi.config.js': { type: 'windicss' as CSSInJSType, confidence: 0.4 },
    };

    for (const [file, info] of Object.entries(styleFiles)) {
      if (fileStructure.files.includes(file)) {
        const library: CSSInJSLibrary = {
          name: file.replace(/\.(js|ts)$/, ''),
          type: info.type,
          confidence: info.confidence,
          features: this.getLibraryFeatures(info.type),
        };
        cssInfo.libraries.push(library);
        cssInfo.hasCSSInJS = true;
        evidence.push(`${file} configuration file found`);
        confidence += info.confidence;

        if (info.type === 'tailwind' || info.type === 'unocss' || info.type === 'windicss') {
          cssInfo.hasUtilityFirst = true;
        }
      }
    }

    // Check for styling directories
    const styleDirs = ['styles', 'css', 'scss', 'sass', 'less', 'stylus'];
    for (const dir of styleDirs) {
      if (fileStructure.directories.includes(dir)) {
        evidence.push(`${dir} directory found`);
        confidence += 0.1;
      }
    }

    // Check for theme directories
    const themeDirs = ['theme', 'themes', 'design-system'];
    for (const dir of themeDirs) {
      if (fileStructure.directories.includes(dir)) {
        cssInfo.hasThemeProvider = true;
        evidence.push(`${dir} directory found`);
        confidence += 0.15;
      }
    }

    return {
      hasCSSInJS: cssInfo.hasCSSInJS,
      confidence,
      evidence,
      cssInfo,
    };
  }

  /**
   * Framework-specific CSS detection
   */
  private static detectFrameworkSpecificCSS(
    context: DetectionContext,
    frameworkType: string
  ): CSSInJSDetectionResult {
    const evidence: string[] = [];
    let confidence = 0;
    const cssInfo: CSSInJSInfo = this.getDefaultCSSInfo();

    // Framework-specific styling patterns
    if (frameworkType === 'react' && context.packageJson) {
      const allDeps = {
        ...context.packageJson.dependencies,
        ...context.packageJson.devDependencies,
      };

      // React-specific styling libraries
      if (allDeps['@mui/material'] || allDeps['@material-ui/core']) {
        evidence.push('Material-UI detected for React');
        confidence += 0.3;
      }
      if (allDeps['@chakra-ui/react']) {
        evidence.push('Chakra UI detected for React');
        confidence += 0.3;
      }
    }

    if (frameworkType === 'vue' && context.packageJson) {
      const allDeps = {
        ...context.packageJson.dependencies,
        ...context.packageJson.devDependencies,
      };

      // Vue-specific styling
      if (allDeps['vuetify']) {
        evidence.push('Vuetify detected for Vue');
        confidence += 0.3;
      }
      if (allDeps['quasar']) {
        evidence.push('Quasar detected for Vue');
        confidence += 0.3;
      }
    }

    return {
      hasCSSInJS: cssInfo.hasCSSInJS,
      confidence,
      evidence,
      cssInfo,
    };
  }

  /**
   * Get default CSS info
   */
  private static getDefaultCSSInfo(): CSSInJSInfo {
    return {
      hasCSSInJS: false,
      libraries: [],
      stylingApproach: ['traditional'],
      hasThemeProvider: false,
      hasStyledComponents: false,
      hasUtilityFirst: false,
    };
  }

  /**
   * Get library-specific features
   */
  private static getLibraryFeatures(type: CSSInJSType): string[] {
    const features: Record<CSSInJSType, string[]> = {
      'styled-components': ['runtime', 'template-literals', 'theme-provider'],
      'emotion': ['runtime', 'css-prop', 'styled-api'],
      'chakra-ui': ['component-library', 'theme-provider', 'responsive'],
      'material-ui': ['component-library', 'theme-provider', 'material-design'],
      'mantine': ['component-library', 'theme-provider', 'hooks'],
      'styled-system': ['style-props', 'responsive', 'theme-aware'],
      'stitches': ['zero-runtime', 'theme-provider', 'variants'],
      'vanilla-extract': ['zero-runtime', 'type-safe', 'build-time'],
      'linaria': ['zero-runtime', 'css-extraction'],
      'jss': ['runtime', 'javascript-based'],
      'aphrodite': ['runtime', 'atomic-css'],
      'glamorous': ['runtime', 'template-literals'],
      'theme-ui': ['theme-provider', 'sx-prop', 'responsive'],
      'tailwind': ['utility-first', 'responsive', 'customizable'],
      'unocss': ['utility-first', 'instant', 'atomic'],
      'windicss': ['utility-first', 'on-demand', 'variant-groups'],
      'css-modules': ['scoped-css', 'build-time'],
      'postcss': ['css-processor', 'plugins'],
      'sass': ['preprocessor', 'variables', 'mixins'],
      'less': ['preprocessor', 'variables', 'mixins'],
      'stylus': ['preprocessor', 'variables', 'mixins'],
      'unknown': [],
    };
    return features[type] || [];
  }

  /**
   * Merge CSS info objects
   */
  private static mergeCSSInfo(target: CSSInJSInfo, source: CSSInJSInfo): void {
    target.hasCSSInJS = target.hasCSSInJS || source.hasCSSInJS;
    target.hasThemeProvider = target.hasThemeProvider || source.hasThemeProvider;
    target.hasStyledComponents = target.hasStyledComponents || source.hasStyledComponents;
    target.hasUtilityFirst = target.hasUtilityFirst || source.hasUtilityFirst;
    target.libraries.push(...source.libraries);
  }

  /**
   * Update styling approaches based on detected libraries
   */
  private static updateStylingApproaches(cssInfo: CSSInJSInfo): void {
    const approaches: StylingApproach[] = [];

    const hasRuntimeCSS = cssInfo.libraries.some(lib => 
      ['styled-components', 'emotion', 'jss', 'aphrodite'].includes(lib.type)
    );
    const hasZeroRuntime = cssInfo.libraries.some(lib => 
      ['vanilla-extract', 'linaria', 'stitches'].includes(lib.type)
    );
    const hasUtilityFirst = cssInfo.libraries.some(lib => 
      ['tailwind', 'unocss', 'windicss'].includes(lib.type)
    );
    const hasComponentLibrary = cssInfo.libraries.some(lib => 
      ['chakra-ui', 'material-ui', 'mantine', 'theme-ui'].includes(lib.type)
    );
    const hasPreprocessor = cssInfo.libraries.some(lib => 
      ['sass', 'less', 'stylus'].includes(lib.type)
    );

    if (hasRuntimeCSS) approaches.push('css-in-js');
    if (hasZeroRuntime) approaches.push('zero-runtime');
    if (hasUtilityFirst) approaches.push('utility-first');
    if (hasComponentLibrary) approaches.push('component-library');
    if (hasPreprocessor) approaches.push('preprocessor');

    if (approaches.length > 1) {
      approaches.push('hybrid');
    } else if (approaches.length === 0) {
      approaches.push('traditional');
    }

    cssInfo.stylingApproach = approaches;
  }

  /**
   * Determine primary library based on confidence scores
   */
  private static determinePrimaryLibrary(cssInfo: CSSInJSInfo): void {
    if (cssInfo.libraries.length === 0) return;

    const sorted = cssInfo.libraries.sort((a, b) => b.confidence - a.confidence);
    cssInfo.primaryLibrary = sorted[0].name;
  }
}