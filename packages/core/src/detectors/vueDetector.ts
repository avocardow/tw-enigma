/**
 * Vue Framework Detector
 *
 * Detects Vue.js framework usage through:
 * - Package.json dependencies (vue package)
 * - Vue configuration files (vue.config.js, vite.config.js with Vue plugins)
 * - Single File Component (.vue) patterns
 * - Vue-specific imports and patterns
 * - Vue 2 vs Vue 3 detection
 */

import type {
  DetectionContext,
  DetectionSource,
  FrameworkInfo,
  FrameworkType,
  IFrameworkDetector,
} from '../frameworkDetector';
import { SSRDetector } from './ssrDetector';
import { CSSInJSDetector } from './cssInJsDetector';

export class VueDetector implements IFrameworkDetector {
  readonly frameworkType: FrameworkType = 'vue';
  readonly name = 'Vue Detector';

  canDetect(_context: DetectionContext): boolean {
    // Can always attempt Vue detection
    return true;
  }

  async detect(context: DetectionContext): Promise<FrameworkInfo | null> {
    const sources: DetectionSource[] = [];
    let confidence = 0;
    let version: string | undefined;
    const metadata: FrameworkInfo['metadata'] = {
      dependencies: [],
      configFiles: [],
      hasTypeScript: false,
      vueVersion: 'unknown',
      compositionAPI: false,
      singleFileComponents: false,
    };

    // Check package.json dependencies
    if (context.packageJson) {
      const packageResults = this.analyzePackageJson(context.packageJson);
      if (packageResults.isVue) {
        sources.push({
          type: 'package',
          description: 'Vue dependencies found in package.json',
          confidence: packageResults.confidence,
          location: 'package.json',
          evidence: packageResults.evidence,
        });
        confidence += packageResults.confidence;
        version = packageResults.version;
        metadata.dependencies = packageResults.dependencies;
        metadata.vueVersion = packageResults.vueVersion;
        metadata.compositionAPI = packageResults.compositionAPI;
      }
    }

    // Check configuration files
    if (context.configFiles) {
      const configResults = this.analyzeConfigFiles(context.configFiles);
      if (configResults.isVue) {
        sources.push({
          type: 'config',
          description: 'Vue-related configuration found',
          confidence: configResults.confidence,
          evidence: configResults.evidence,
        });
        confidence += configResults.confidence;
        metadata.configFiles = configResults.configFiles;
      }
    }

    // Check source patterns
    if (context.sourcePatterns) {
      const codeResults = this.analyzeSourcePatterns(context.sourcePatterns);
      if (codeResults.isVue) {
        sources.push({
          type: 'code',
          description: 'Vue patterns found in source code',
          confidence: codeResults.confidence,
          evidence: codeResults.evidence,
        });
        confidence += codeResults.confidence;
        metadata.singleFileComponents = codeResults.singleFileComponents;
      }
    }

    // Check file structure
    if (context.fileStructure) {
      const fsResults = this.analyzeFileStructure(context.fileStructure);
      if (fsResults.isVue) {
        sources.push({
          type: 'filesystem',
          description: 'Vue-specific file structure detected',
          confidence: fsResults.confidence,
          evidence: fsResults.evidence,
        });
        confidence += fsResults.confidence;
      }
    }

    // Normalize confidence (ensure it doesn't exceed 1.0)
    const normalizedConfidence = Math.min(confidence, 1.0);

    // Return null if confidence is too low
    if (normalizedConfidence < 0.3) {
      return null;
    }

    // Detect TypeScript support
    metadata.hasTypeScript = this.detectTypeScriptSupport(context);

    // Detect build system
    metadata.buildSystem = this.detectBuildSystem(context);

    // Detect entry points
    metadata.entryPoints = this.detectEntryPoints(context);

    // Detect SSR/SSG capabilities (Nuxt.js supports SSR/SSG)
    const ssrResult = SSRDetector.detect(context, 'vue');
    if (ssrResult.isSSRCapable) {
      metadata.ssrInfo = ssrResult.ssrInfo;
      metadata.hasSSR = ssrResult.ssrInfo.hasSSR;
      metadata.hasSSG = ssrResult.ssrInfo.hasSSG;
      metadata.renderingModes = ssrResult.ssrInfo.renderingModes;
    }

    // Detect CSS-in-JS libraries
    const cssResult = CSSInJSDetector.detect(context, 'vue');
    if (cssResult.hasCSSInJS) {
      metadata.cssInfo = cssResult.cssInfo;
      metadata.hasCSSInJS = cssResult.cssInfo.hasCSSInJS;
      metadata.stylingLibraries = cssResult.cssInfo.libraries.map(lib => lib.name);
      metadata.primaryStylingLibrary = cssResult.cssInfo.primaryLibrary;
    }

    return {
      type: 'vue',
      name: 'Vue.js',
      version,
      confidence: normalizedConfidence,
      sources,
      metadata,
    };
  }

  private analyzePackageJson(packageJson: any): {
    isVue: boolean;
    confidence: number;
    version?: string;
    evidence: string[];
    dependencies: string[];
    vueVersion: string;
    compositionAPI: boolean;
  } {
    const evidence: string[] = [];
    const dependencies: string[] = [];
    let confidence = 0;
    let version: string | undefined;
    let vueVersion = 'unknown';
    let compositionAPI = false;

    const allDeps = {
      ...packageJson.dependencies,
      ...packageJson.devDependencies,
      ...packageJson.peerDependencies,
    };

    // Core Vue package
    if (allDeps.vue) {
      evidence.push('vue dependency found');
      dependencies.push('vue');
      confidence += 0.7;
      version = allDeps.vue;

      // Determine Vue version
      if (version) {
        if (version.startsWith('^3') || version.startsWith('3') || version.startsWith('~3')) {
          vueVersion = '3.x';
          compositionAPI = true;
          evidence.push('Vue 3.x detected');
        } else if (
          version.startsWith('^2') ||
          version.startsWith('2') ||
          version.startsWith('~2')
        ) {
          vueVersion = '2.x';
          evidence.push('Vue 2.x detected');
        }
      }
    }

    // Vue ecosystem packages
    const vueEcosystem = [
      'vue-router',
      'vuex',
      'pinia', // Vue 3 state management
      'vue-composition-api', // Vue 2 composition API backport
      '@vue/composition-api',
      'vuelidate',
      '@vuelidate/core',
      'vue-i18n',
      'vue-meta',
      '@vue/head',
      'vue-apollo',
      '@vue/apollo-composable',
      'vue-class-component',
      'vue-property-decorator',
      'vue-styled-components',
      'vue-demi', // Vue 2/3 compatibility
    ];

    let ecosystemCount = 0;
    for (const pkg of vueEcosystem) {
      if (allDeps[pkg]) {
        ecosystemCount++;
        dependencies.push(pkg);
        if (ecosystemCount <= 3) {
          evidence.push(`${pkg} dependency found`);
        }

        // Specific package indicators
        if (pkg === 'pinia') {
          vueVersion = '3.x';
          compositionAPI = true;
        }
        if (pkg === 'vuex' && allDeps.vue && allDeps.vue.startsWith('2')) {
          vueVersion = '2.x';
        }
        if (pkg === '@vue/composition-api' || pkg === 'vue-composition-api') {
          compositionAPI = true;
        }
      }
    }

    if (ecosystemCount > 0) {
      confidence += Math.min(ecosystemCount * 0.1, 0.25);
    }

    // Vue build tools and dev dependencies
    const vueTools = [
      '@vue/cli',
      '@vue/cli-service',
      'vue-cli-service',
      '@vitejs/plugin-vue',
      '@vitejs/plugin-vue-jsx',
      'vue-loader',
      'vue-template-compiler', // Vue 2
      '@vue/compiler-sfc', // Vue 3
      'vue-eslint-parser',
      'eslint-plugin-vue',
      '@vue/eslint-config-typescript',
      '@vue/eslint-config-prettier',
      'vue-tsc',
      '@vue/test-utils',
      'vite-plugin-vue',
      'rollup-plugin-vue',
    ];

    let toolsCount = 0;
    for (const tool of vueTools) {
      if (allDeps[tool]) {
        toolsCount++;
        dependencies.push(tool);
        if (toolsCount <= 3) {
          evidence.push(`${tool} tool found`);
        }

        // Version-specific tools
        if (tool === 'vue-template-compiler') {
          vueVersion = '2.x';
        }
        if (tool === '@vue/compiler-sfc' || tool === '@vitejs/plugin-vue') {
          vueVersion = '3.x';
          compositionAPI = true;
        }
      }
    }

    if (toolsCount > 0) {
      confidence += Math.min(toolsCount * 0.05, 0.2);
    }

    // Check scripts for Vue CLI
    if (packageJson.scripts) {
      const scripts = packageJson.scripts;
      let scriptCount = 0;

      if (scripts.serve && scripts.serve.includes('vue-cli-service')) {
        evidence.push('vue-cli-service serve script found');
        scriptCount++;
      }

      if (scripts.build && scripts.build.includes('vue-cli-service')) {
        evidence.push('vue-cli-service build script found');
        scriptCount++;
      }

      if (scripts.dev && scripts.dev.includes('vite') && allDeps['@vitejs/plugin-vue']) {
        evidence.push('Vite with Vue plugin script found');
        scriptCount++;
      }

      if (scriptCount > 0) {
        confidence += scriptCount * 0.1;
      }
    }

    return {
      isVue: confidence > 0,
      confidence,
      version,
      evidence,
      dependencies,
      vueVersion,
      compositionAPI,
    };
  }

  private analyzeConfigFiles(configFiles: Map<string, any>): {
    isVue: boolean;
    confidence: number;
    evidence: string[];
    configFiles: string[];
  } {
    const evidence: string[] = [];
    const foundConfigFiles: string[] = [];
    let confidence = 0;

    // Vue CLI configuration
    const vueConfig = configFiles.get('vue.config.js');
    if (vueConfig) {
      evidence.push('vue.config.js found');
      foundConfigFiles.push('vue.config.js');
      confidence += 0.6;

      // Analyze content for Vue-specific patterns
      if (vueConfig._rawContent) {
        const content = vueConfig._rawContent;
        if (content.includes('configureWebpack') || content.includes('chainWebpack')) {
          evidence.push('Vue CLI webpack configuration found');
          confidence += 0.1;
        }
        if (content.includes('pwa') || content.includes('outputDir')) {
          evidence.push('Vue CLI project configuration found');
          confidence += 0.05;
        }
      }
    }

    // Vite with Vue plugin
    const viteConfig =
      configFiles.get('vite.config.js') ||
      configFiles.get('vite.config.ts') ||
      configFiles.get('vite.config.mjs');

    if (viteConfig?.plugins || viteConfig?._rawContent) {
      const content = viteConfig._rawContent || JSON.stringify(viteConfig);
      if (content.includes('@vitejs/plugin-vue') || content.includes('plugin-vue')) {
        evidence.push('Vite Vue plugin configuration found');
        foundConfigFiles.push('vite.config.*');
        confidence += 0.5;
      }
      if (content.includes('vue()') || content.includes('createVuePlugin')) {
        evidence.push('Vue plugin setup found in Vite config');
        confidence += 0.1;
      }
    }

    // TypeScript configuration for Vue
    const tsConfig = configFiles.get('tsconfig.json');
    if (tsConfig) {
      const content = JSON.stringify(tsConfig);
      if (content.includes('"vue"') || content.includes('vue-tsc') || content.includes('.vue')) {
        evidence.push('Vue TypeScript configuration found');
        foundConfigFiles.push('tsconfig.json');
        confidence += 0.2;
      }
    }

    // ESLint configuration with Vue
    const eslintConfig = configFiles.get('.eslintrc.js') || configFiles.get('.eslintrc.json');
    if (eslintConfig) {
      const content = eslintConfig._rawContent || JSON.stringify(eslintConfig);
      if (content.includes('plugin:vue/') || content.includes('eslint-plugin-vue')) {
        evidence.push('ESLint Vue plugin configuration found');
        foundConfigFiles.push('ESLint configuration');
        confidence += 0.15;
      }
    }

    // Webpack configuration with Vue loader
    const webpackConfig = configFiles.get('webpack.config.js');
    if (webpackConfig?._rawContent) {
      if (
        webpackConfig._rawContent.includes('vue-loader') ||
        webpackConfig._rawContent.includes('.vue')
      ) {
        evidence.push('Webpack Vue loader configuration found');
        foundConfigFiles.push('webpack.config.js');
        confidence += 0.3;
      }
    }

    return {
      isVue: confidence > 0,
      confidence,
      evidence,
      configFiles: foundConfigFiles,
    };
  }

  private analyzeSourcePatterns(sourcePatterns: string[]): {
    isVue: boolean;
    confidence: number;
    evidence: string[];
    singleFileComponents: boolean;
  } {
    const evidence: string[] = [];
    let confidence = 0;
    let singleFileComponents = false;

    // .vue files are the strongest indicator
    if (sourcePatterns.includes('*.vue')) {
      evidence.push('Vue Single File Components found');
      confidence += 0.6;
      singleFileComponents = true;
    }

    // Common Vue project directories
    const vueDirs = ['src', 'components', 'views', 'pages', 'layouts'];
    for (const dir of vueDirs) {
      if (sourcePatterns.includes(dir)) {
        evidence.push(`${dir} directory found`);
        confidence += 0.05;
      }
    }

    // Check for Vue-specific patterns
    if (sourcePatterns.includes('src/main.js') || sourcePatterns.includes('src/main.ts')) {
      confidence += 0.1;
    }

    return {
      isVue: confidence > 0,
      confidence,
      evidence,
      singleFileComponents,
    };
  }

  private analyzeFileStructure(fileStructure: { directories: string[]; files: string[] }): {
    isVue: boolean;
    confidence: number;
    evidence: string[];
  } {
    const evidence: string[] = [];
    let confidence = 0;

    // Look for Vue-specific configuration files
    const vueFiles = ['vue.config.js', 'vue.config.ts', '.vuerc'];

    let vueFileCount = 0;
    for (const file of vueFiles) {
      if (fileStructure.files.includes(file)) {
        vueFileCount++;
        evidence.push(`${file} found`);
      }
    }

    if (vueFileCount > 0) {
      confidence += Math.min(vueFileCount * 0.3, 0.6);
    }

    // Check for common Vue project structure
    const hasPublic = fileStructure.directories.includes('public');
    const hasSrc = fileStructure.directories.includes('src');
    const hasComponents = fileStructure.directories.includes('components');
    const hasViews = fileStructure.directories.includes('views');

    if (hasPublic) {
      evidence.push('public directory found');
      confidence += 0.05;
    }

    if (hasSrc) {
      evidence.push('src directory found');
      confidence += 0.05;
    }

    if (hasComponents) {
      evidence.push('components directory found');
      confidence += 0.1;
    }

    if (hasViews) {
      evidence.push('views directory found');
      confidence += 0.1;
    }

    // Vue CLI project structure
    if (hasPublic && hasSrc && hasComponents) {
      evidence.push('Vue CLI project structure detected');
      confidence += 0.15;
    }

    return {
      isVue: confidence > 0,
      confidence,
      evidence,
    };
  }

  private detectTypeScriptSupport(context: DetectionContext): boolean {
    // Check for TypeScript in package.json
    if (context.packageJson) {
      const allDeps = {
        ...context.packageJson.dependencies,
        ...context.packageJson.devDependencies,
      };

      if (allDeps.typescript || allDeps['vue-tsc'] || allDeps['@vue/typescript']) {
        return true;
      }
    }

    // Check for TypeScript config
    if (context.configFiles?.has('tsconfig.json')) {
      return true;
    }

    // Check for .ts/.tsx files in source patterns
    if (context.sourcePatterns) {
      return context.sourcePatterns.some(
        (pattern) => pattern.includes('.ts') || pattern.includes('.tsx')
      );
    }

    return false;
  }

  private detectBuildSystem(context: DetectionContext): string | undefined {
    if (context.packageJson) {
      const allDeps = {
        ...context.packageJson.dependencies,
        ...context.packageJson.devDependencies,
      };

      if (allDeps['@vue/cli-service'] || allDeps['vue-cli-service']) return 'Vue CLI';
      if (allDeps.vite || allDeps['@vitejs/plugin-vue']) return 'Vite';
      if (allDeps.webpack || allDeps['vue-loader']) return 'Webpack';
      if (allDeps.rollup || allDeps['rollup-plugin-vue']) return 'Rollup';
    }

    if (context.configFiles?.has('vue.config.js')) {
      return 'Vue CLI';
    }

    if (context.configFiles?.has('vite.config.js') || context.configFiles?.has('vite.config.ts')) {
      return 'Vite';
    }

    if (context.configFiles?.has('webpack.config.js')) {
      return 'Webpack';
    }

    return undefined;
  }

  private detectEntryPoints(context: DetectionContext): string[] {
    const entryPoints: string[] = [];

    // Check for common Vue entry points
    const commonEntries = [
      'src/main.js',
      'src/main.ts',
      'src/app.js',
      'src/app.ts',
      'src/index.js',
      'src/index.ts',
      'src/App.vue',
      'public/index.html',
      'index.html',
    ];

    for (const entry of commonEntries) {
      const fileName = entry.split('/').pop()!;
      if (context.fileStructure?.files.includes(fileName)) {
        entryPoints.push(entry);
      }
    }

    // Vue typically uses src/main.js or src/main.ts as entry point
    if (context.fileStructure?.files.includes('main.js')) {
      entryPoints.unshift('src/main.js');
    }
    if (context.fileStructure?.files.includes('main.ts')) {
      entryPoints.unshift('src/main.ts');
    }

    return [...new Set(entryPoints)]; // Remove duplicates
  }
}
