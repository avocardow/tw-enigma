/**
 * Svelte Framework Detector
 *
 * Detects Svelte framework usage through:
 * - Package.json dependencies (svelte package)
 * - Svelte configuration files (svelte.config.js)
 * - SvelteKit configuration and patterns
 * - File patterns (.svelte files)
 */

import type {
  IFrameworkDetector,
  FrameworkInfo,
  DetectionContext,
  DetectionSource,
  FrameworkType,
} from '../frameworkDetector';
import { SSRDetector } from './ssrDetector';
import { CSSInJSDetector } from './cssInJsDetector';

export class SvelteDetector implements IFrameworkDetector {
  readonly frameworkType: FrameworkType = 'svelte';
  readonly name = 'Svelte Detector';

  canDetect(_context: DetectionContext): boolean {
    // Can always attempt Svelte detection
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
      svelteKitEnabled: false,
      preprocessors: [],
    };

    // Check package.json dependencies
    if (context.packageJson) {
      const packageResults = this.analyzePackageJson(context.packageJson);
      if (packageResults.isSvelte) {
        sources.push({
          type: 'package',
          description: 'Svelte dependencies found in package.json',
          confidence: packageResults.confidence,
          location: 'package.json',
          evidence: packageResults.evidence,
        });
        confidence += packageResults.confidence;
        version = packageResults.version;
        metadata.dependencies = packageResults.dependencies;
        metadata.svelteKitEnabled = packageResults.svelteKitEnabled;
        metadata.preprocessors = packageResults.preprocessors;
      }
    }

    // Check configuration files
    if (context.configFiles) {
      const configResults = this.analyzeConfigFiles(context.configFiles);
      if (configResults.isSvelte) {
        sources.push({
          type: 'config',
          description: 'Svelte configuration found',
          confidence: configResults.confidence,
          evidence: configResults.evidence,
        });
        confidence += configResults.confidence;
        metadata.configFiles = configResults.configFiles;
        if (configResults.preprocessors.length > 0) {
          metadata.preprocessors = [...(metadata.preprocessors || []), ...configResults.preprocessors];
        }
      }
    }

    // Check file structure
    if (context.fileStructure) {
      const fsResults = this.analyzeFileStructure(context.fileStructure);
      if (fsResults.isSvelte) {
        sources.push({
          type: 'filesystem',
          description: 'Svelte file structure detected',
          confidence: fsResults.confidence,
          evidence: fsResults.evidence,
        });
        confidence += fsResults.confidence;
      }
    }

    // Check source patterns
    if (context.sourcePatterns) {
      const codeResults = this.analyzeSourcePatterns(context.sourcePatterns);
      if (codeResults.isSvelte) {
        sources.push({
          type: 'code',
          description: 'Svelte patterns found in source code',
          confidence: codeResults.confidence,
          evidence: codeResults.evidence,
        });
        confidence += codeResults.confidence;
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

    // Detect SSR/SSG capabilities (SvelteKit supports SSR/SSG)
    const ssrResult = SSRDetector.detect(context, 'svelte');
    if (ssrResult.isSSRCapable) {
      metadata.ssrInfo = ssrResult.ssrInfo;
      metadata.hasSSR = ssrResult.ssrInfo.hasSSR;
      metadata.hasSSG = ssrResult.ssrInfo.hasSSG;
      metadata.renderingModes = ssrResult.ssrInfo.renderingModes;
    }

    // Detect CSS-in-JS libraries
    const cssResult = CSSInJSDetector.detect(context, 'svelte');
    if (cssResult.hasCSSInJS) {
      metadata.cssInfo = cssResult.cssInfo;
      metadata.hasCSSInJS = cssResult.cssInfo.hasCSSInJS;
      metadata.stylingLibraries = cssResult.cssInfo.libraries.map(lib => lib.name);
      metadata.primaryStylingLibrary = cssResult.cssInfo.primaryLibrary;
    }

    return {
      type: 'svelte',
      name: 'Svelte',
      version,
      confidence: normalizedConfidence,
      sources,
      metadata,
    };
  }

  private analyzePackageJson(packageJson: any): {
    isSvelte: boolean;
    confidence: number;
    version?: string;
    evidence: string[];
    dependencies: string[];
    svelteKitEnabled: boolean;
    preprocessors: string[];
  } {
    const evidence: string[] = [];
    const dependencies: string[] = [];
    const preprocessors: string[] = [];
    let confidence = 0;
    let version: string | undefined;
    let svelteKitEnabled = false;

    const allDeps = {
      ...packageJson.dependencies,
      ...packageJson.devDependencies,
      ...packageJson.peerDependencies,
    };

    // Core Svelte package
    if (allDeps.svelte) {
      evidence.push('svelte dependency found');
      dependencies.push('svelte');
      confidence += 0.7; // High confidence for Svelte dependency
      version = allDeps.svelte;
    }

    // SvelteKit detection
    if (allDeps['@sveltejs/kit']) {
      evidence.push('@sveltejs/kit dependency found');
      dependencies.push('@sveltejs/kit');
      svelteKitEnabled = true;
      confidence += 0.6; // Very high confidence for SvelteKit
    }

    // SvelteKit adapters
    const svelteKitAdapters = [
      '@sveltejs/adapter-auto',
      '@sveltejs/adapter-static',
      '@sveltejs/adapter-node',
      '@sveltejs/adapter-vercel',
      '@sveltejs/adapter-netlify',
      '@sveltejs/adapter-cloudflare',
      '@sveltejs/adapter-cloudflare-workers',
    ];

    let adapterCount = 0;
    for (const adapter of svelteKitAdapters) {
      if (allDeps[adapter]) {
        adapterCount++;
        dependencies.push(adapter);
        if (adapterCount <= 2) {
          evidence.push(`${adapter} found`);
        }
      }
    }

    if (adapterCount > 0) {
      confidence += Math.min(adapterCount * 0.1, 0.2);
      svelteKitEnabled = true;
    }

    // Svelte preprocessors
    const sveltePreprocessors = [
      'svelte-preprocess',
      '@sveltejs/vite-plugin-svelte',
      'svelte-loader',
      'rollup-plugin-svelte',
    ];

    let preprocessorCount = 0;
    for (const preprocessor of sveltePreprocessors) {
      if (allDeps[preprocessor]) {
        preprocessorCount++;
        preprocessors.push(preprocessor);
        dependencies.push(preprocessor);
        if (preprocessorCount <= 2) {
          evidence.push(`${preprocessor} found`);
        }
      }
    }

    if (preprocessorCount > 0) {
      confidence += Math.min(preprocessorCount * 0.1, 0.25);
    }

    // Svelte ecosystem packages
    const svelteEcosystem = [
      'svelte-spa-router',
      'svelte-routing',
      '@roxi/routify',
      'svelte-stores',
      'svelte-i18n',
      'svelte-motion',
      '@smui/core',
      'carbon-components-svelte',
      'svelte-material-ui',
    ];

    let ecosystemCount = 0;
    for (const pkg of svelteEcosystem) {
      if (allDeps[pkg]) {
        ecosystemCount++;
        dependencies.push(pkg);
        if (ecosystemCount <= 2) {
          evidence.push(`${pkg} found`);
        }
      }
    }

    if (ecosystemCount > 0) {
      confidence += Math.min(ecosystemCount * 0.05, 0.15);
    }

    // Check for Svelte scripts in package.json
    if (packageJson.scripts) {
      const scripts = packageJson.scripts;
      let scriptCount = 0;

      if (scripts.dev && scripts.dev.includes('svelte')) {
        evidence.push('svelte dev script found');
        scriptCount++;
      }

      if (scripts.build && scripts.build.includes('svelte')) {
        evidence.push('svelte build script found');
        scriptCount++;
      }

      if (scriptCount > 0) {
        confidence += scriptCount * 0.1;
      }
    }

    return {
      isSvelte: confidence > 0,
      confidence,
      version,
      evidence,
      dependencies,
      svelteKitEnabled,
      preprocessors,
    };
  }

  private analyzeConfigFiles(configFiles: Map<string, any>): {
    isSvelte: boolean;
    confidence: number;
    evidence: string[];
    configFiles: string[];
    preprocessors: string[];
  } {
    const evidence: string[] = [];
    const foundConfigFiles: string[] = [];
    const preprocessors: string[] = [];
    let confidence = 0;

    // Svelte configuration files
    const svelteConfigs = ['svelte.config.js', 'svelte.config.mjs', 'svelte.config.ts'];

    for (const configFile of svelteConfigs) {
      if (configFiles.has(configFile)) {
        evidence.push(`${configFile} found`);
        foundConfigFiles.push(configFile);
        confidence += 0.6; // High confidence for Svelte config

        // Analyze config content for preprocessors
        const config = configFiles.get(configFile);
        if (config?._rawContent) {
          const content = config._rawContent;

          if (content.includes('svelte-preprocess')) {
            preprocessors.push('svelte-preprocess');
            evidence.push('svelte-preprocess configured');
          }

          if (content.includes('@sveltejs/kit')) {
            evidence.push('SvelteKit configuration found');
            confidence += 0.2;
          }

          if (content.includes('adapter')) {
            evidence.push('SvelteKit adapter configuration found');
            confidence += 0.1;
          }
        }

        break; // Only count one config file
      }
    }

    // Check for Vite with Svelte plugin
    const viteConfigs = ['vite.config.js', 'vite.config.ts', 'vite.config.mjs'];
    for (const configFile of viteConfigs) {
      if (configFiles.has(configFile)) {
        const config = configFiles.get(configFile);
        if (config?._rawContent) {
          const content = config._rawContent;
          if (content.includes('@sveltejs/vite-plugin-svelte') || content.includes('plugin-svelte')) {
            evidence.push('Vite Svelte plugin configuration found');
            foundConfigFiles.push(configFile);
            confidence += 0.4;
            break;
          }
        }
      }
    }

    // Check for Rollup configuration
    const rollupConfig = configFiles.get('rollup.config.js');
    if (rollupConfig?._rawContent) {
      if (rollupConfig._rawContent.includes('rollup-plugin-svelte')) {
        evidence.push('Rollup Svelte plugin found');
        foundConfigFiles.push('rollup.config.js');
        confidence += 0.3;
      }
    }

    return {
      isSvelte: confidence > 0,
      confidence,
      evidence,
      configFiles: foundConfigFiles,
      preprocessors,
    };
  }

  private analyzeFileStructure(fileStructure: { directories: string[]; files: string[] }): {
    isSvelte: boolean;
    confidence: number;
    evidence: string[];
  } {
    const evidence: string[] = [];
    let confidence = 0;

    // Check for Svelte-specific files
    const svelteFiles = [
      'svelte.config.js',
      'svelte.config.ts',
      'app.html',
      'app.d.ts',
    ];

    let svelteFileCount = 0;
    for (const file of svelteFiles) {
      if (fileStructure.files.includes(file)) {
        svelteFileCount++;
        evidence.push(`${file} found`);
      }
    }

    if (svelteFileCount > 0) {
      confidence += Math.min(svelteFileCount * 0.3, 0.6);
    }

    // Check for SvelteKit project structure
    const svelteKitDirs = ['src/routes', 'src/lib', 'src/app.html'];
    let svelteKitIndicators = 0;

    if (fileStructure.directories.includes('src')) {
      // Check for SvelteKit specific patterns
      if (fileStructure.files.includes('app.html')) {
        svelteKitIndicators++;
        evidence.push('SvelteKit app.html found');
      }
    }

    // Check for common Svelte directories
    const svelteDirs = ['src', 'static', 'lib'];
    let dirCount = 0;
    for (const dir of svelteDirs) {
      if (fileStructure.directories.includes(dir)) {
        dirCount++;
        if (dir === 'static') {
          evidence.push('static directory found (SvelteKit pattern)');
          confidence += 0.15;
        } else {
          confidence += 0.05;
        }
      }
    }

    if (svelteKitIndicators > 0) {
      confidence += svelteKitIndicators * 0.2;
    }

    return {
      isSvelte: confidence > 0,
      confidence,
      evidence,
    };
  }

  private analyzeSourcePatterns(sourcePatterns: string[]): {
    isSvelte: boolean;
    confidence: number;
    evidence: string[];
  } {
    const evidence: string[] = [];
    let confidence = 0;

    // Check for .svelte files
    if (sourcePatterns.includes('*.svelte')) {
      evidence.push('Svelte files found');
      confidence += 0.5; // High confidence for .svelte files
    }

    // Check for src directory (common in Svelte projects)
    if (sourcePatterns.includes('src')) {
      evidence.push('src directory in source patterns');
      confidence += 0.1;
    }

    // Check for lib directory (common in SvelteKit)
    if (sourcePatterns.includes('lib')) {
      evidence.push('lib directory found (SvelteKit pattern)');
      confidence += 0.15;
    }

    return {
      isSvelte: confidence > 0,
      confidence,
      evidence,
    };
  }

  private detectTypeScriptSupport(context: DetectionContext): boolean {
    // Check for TypeScript dependencies
    if (context.packageJson) {
      const allDeps = {
        ...context.packageJson.dependencies,
        ...context.packageJson.devDependencies,
      };

      if (allDeps.typescript || allDeps['@tsconfig/svelte']) {
        return true;
      }
    }

    // Check for TypeScript config files
    if (
      context.configFiles?.has('tsconfig.json') ||
      context.configFiles?.has('svelte.config.ts')
    ) {
      return true;
    }

    // Check for TypeScript files
    if (context.sourcePatterns?.includes('*.ts')) {
      return true;
    }

    return false;
  }

  private detectBuildSystem(context: DetectionContext): string | undefined {
    if (context.packageJson) {
      const allDeps = {
        ...context.packageJson.dependencies,
        ...context.packageJson.devDependencies,
      };

      if (allDeps['@sveltejs/kit']) return 'SvelteKit';
      if (allDeps.vite || allDeps['@sveltejs/vite-plugin-svelte']) return 'Vite';
      if (allDeps.rollup || allDeps['rollup-plugin-svelte']) return 'Rollup';
      if (allDeps.webpack || allDeps['svelte-loader']) return 'Webpack';
    }

    if (context.configFiles?.has('svelte.config.js') || context.configFiles?.has('svelte.config.ts')) {
      return 'SvelteKit';
    }

    if (context.configFiles?.has('vite.config.js') || context.configFiles?.has('vite.config.ts')) {
      return 'Vite';
    }

    if (context.configFiles?.has('rollup.config.js')) {
      return 'Rollup';
    }

    return undefined;
  }

  private detectEntryPoints(context: DetectionContext): string[] {
    const entryPoints: string[] = [];

    // Check package.json main field
    if (context.packageJson?.main) {
      entryPoints.push(context.packageJson.main);
    }

    // Common Svelte entry points
    const commonEntries = [
      'src/main.js',
      'src/main.ts',
      'src/app.js',
      'src/app.ts',
      'src/App.svelte',
      'src/routes/+layout.svelte', // SvelteKit
      'src/routes/+page.svelte',   // SvelteKit
    ];

    for (const entry of commonEntries) {
      const fileName = entry.split('/').pop()!;
      if (context.fileStructure?.files.includes(fileName)) {
        entryPoints.push(entry);
      }
    }

    return [...new Set(entryPoints)]; // Remove duplicates
  }
}