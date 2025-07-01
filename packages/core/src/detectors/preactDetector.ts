/**
 * Preact Framework Detector
 *
 * Detects Preact framework usage through:
 * - Package.json dependencies (preact package)
 * - Preact CLI configuration
 * - JSX patterns specific to Preact
 * - Build system integration with Preact plugins
 */

import type {
  IFrameworkDetector,
  FrameworkInfo,
  DetectionContext,
  DetectionSource,
  FrameworkType,
} from '../frameworkDetector';
import { CSSInJSDetector } from './cssInJsDetector';

export class PreactDetector implements IFrameworkDetector {
  readonly frameworkType: FrameworkType = 'preact';
  readonly name = 'Preact Detector';

  canDetect(_context: DetectionContext): boolean {
    // Can always attempt Preact detection
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
      preactCliEnabled: false,
      routingLibrary: undefined,
      reactCompatEnabled: false,
    };

    // Check package.json dependencies
    if (context.packageJson) {
      const packageResults = this.analyzePackageJson(context.packageJson);
      if (packageResults.isPreact) {
        sources.push({
          type: 'package',
          description: 'Preact dependencies found in package.json',
          confidence: packageResults.confidence,
          location: 'package.json',
          evidence: packageResults.evidence,
        });
        confidence += packageResults.confidence;
        version = packageResults.version;
        metadata.dependencies = packageResults.dependencies;
        metadata.preactCliEnabled = packageResults.preactCliEnabled;
        metadata.routingLibrary = packageResults.routingLibrary;
        metadata.reactCompatEnabled = packageResults.reactCompatEnabled;
      }
    }

    // Check configuration files
    if (context.configFiles) {
      const configResults = this.analyzeConfigFiles(context.configFiles);
      if (configResults.isPreact) {
        sources.push({
          type: 'config',
          description: 'Preact configuration found',
          confidence: configResults.confidence,
          evidence: configResults.evidence,
        });
        confidence += configResults.confidence;
        metadata.configFiles = configResults.configFiles;
      }
    }

    // Check file structure
    if (context.fileStructure) {
      const fsResults = this.analyzeFileStructure(context.fileStructure);
      if (fsResults.isPreact) {
        sources.push({
          type: 'filesystem',
          description: 'Preact file structure detected',
          confidence: fsResults.confidence,
          evidence: fsResults.evidence,
        });
        confidence += fsResults.confidence;
      }
    }

    // Check source patterns
    if (context.sourcePatterns) {
      const codeResults = this.analyzeSourcePatterns(context.sourcePatterns);
      if (codeResults.isPreact) {
        sources.push({
          type: 'code',
          description: 'Preact patterns found in source code',
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

    // Detect CSS-in-JS libraries
    const cssResult = CSSInJSDetector.detect(context, 'preact');
    if (cssResult.hasCSSInJS) {
      metadata.cssInfo = cssResult.cssInfo;
      metadata.hasCSSInJS = cssResult.cssInfo.hasCSSInJS;
      metadata.stylingLibraries = cssResult.cssInfo.libraries.map(lib => lib.name);
      metadata.primaryStylingLibrary = cssResult.cssInfo.primaryLibrary;
    }

    return {
      type: 'preact',
      name: 'Preact',
      version,
      confidence: normalizedConfidence,
      sources,
      metadata,
    };
  }

  private analyzePackageJson(packageJson: any): {
    isPreact: boolean;
    confidence: number;
    version?: string;
    evidence: string[];
    dependencies: string[];
    preactCliEnabled: boolean;
    routingLibrary?: string;
    reactCompatEnabled: boolean;
  } {
    const evidence: string[] = [];
    const dependencies: string[] = [];
    let confidence = 0;
    let version: string | undefined;
    let preactCliEnabled = false;
    let routingLibrary: string | undefined;
    let reactCompatEnabled = false;

    const allDeps = {
      ...packageJson.dependencies,
      ...packageJson.devDependencies,
      ...packageJson.peerDependencies,
    };

    // Core Preact package
    if (allDeps.preact) {
      evidence.push('preact dependency found');
      dependencies.push('preact');
      confidence += 0.7; // High confidence for Preact dependency
      version = allDeps.preact;
    }

    // Preact CLI
    if (allDeps['preact-cli']) {
      evidence.push('preact-cli found');
      dependencies.push('preact-cli');
      preactCliEnabled = true;
      confidence += 0.5;
    }

    // React compatibility layer
    if (allDeps['preact/compat']) {
      evidence.push('preact/compat found');
      dependencies.push('preact/compat');
      reactCompatEnabled = true;
      confidence += 0.3;
    }

    // Preact router
    if (allDeps['preact-router']) {
      evidence.push('preact-router found');
      dependencies.push('preact-router');
      routingLibrary = 'preact-router';
      confidence += 0.2;
    }

    // Preact ecosystem packages
    const preactEcosystem = [
      'preact-render-to-string',
      'preact-ssr-prepass',
      'preact-iso',
      '@preact/signals',
      '@preact/signals-core',
      'preact-helmet',
      'preact-portal',
      'preact-custom-element',
      'preact-markup',
      'preact-transitioning',
    ];

    let ecosystemCount = 0;
    for (const pkg of preactEcosystem) {
      if (allDeps[pkg]) {
        ecosystemCount++;
        dependencies.push(pkg);
        if (ecosystemCount <= 3) {
          evidence.push(`${pkg} found`);
        }
      }
    }

    if (ecosystemCount > 0) {
      confidence += Math.min(ecosystemCount * 0.05, 0.2);
    }

    // Build tools and plugins
    const preactTools = [
      '@preact/preset-vite',
      'preact-loader',
      'babel-preset-preact',
      'eslint-config-preact',
      '@types/preact',
    ];

    let toolsCount = 0;
    for (const tool of preactTools) {
      if (allDeps[tool]) {
        toolsCount++;
        dependencies.push(tool);
        if (toolsCount <= 2) {
          evidence.push(`${tool} found`);
        }
      }
    }

    if (toolsCount > 0) {
      confidence += Math.min(toolsCount * 0.1, 0.25);
    }

    // Check for Preact-specific scripts
    if (packageJson.scripts) {
      const scripts = packageJson.scripts;
      let scriptCount = 0;

      // Preact CLI scripts
      if (scripts.build && scripts.build.includes('preact build')) {
        evidence.push('preact build script found');
        scriptCount++;
      }

      if (scripts.dev && scripts.dev.includes('preact')) {
        evidence.push('preact dev script found');
        scriptCount++;
      }

      if (scripts.serve && scripts.serve.includes('preact serve')) {
        evidence.push('preact serve script found');
        scriptCount++;
      }

      if (scriptCount > 0) {
        confidence += scriptCount * 0.1;
        preactCliEnabled = true;
      }
    }

    return {
      isPreact: confidence > 0,
      confidence,
      version,
      evidence,
      dependencies,
      preactCliEnabled,
      routingLibrary,
      reactCompatEnabled,
    };
  }

  private analyzeConfigFiles(configFiles: Map<string, any>): {
    isPreact: boolean;
    confidence: number;
    evidence: string[];
    configFiles: string[];
  } {
    const evidence: string[] = [];
    const foundConfigFiles: string[] = [];
    let confidence = 0;

    // Preact CLI configuration
    const preactConfig = configFiles.get('preact.config.js');
    if (preactConfig) {
      evidence.push('preact.config.js found');
      foundConfigFiles.push('preact.config.js');
      confidence += 0.6; // High confidence for Preact CLI config
    }

    // Check for Vite with Preact preset
    const viteConfigs = ['vite.config.js', 'vite.config.ts', 'vite.config.mjs'];
    for (const configFile of viteConfigs) {
      if (configFiles.has(configFile)) {
        const config = configFiles.get(configFile);
        if (config?._rawContent) {
          const content = config._rawContent;
          if (content.includes('@preact/preset-vite') || content.includes('preact()')) {
            evidence.push('Vite Preact preset configuration found');
            foundConfigFiles.push(configFile);
            confidence += 0.4;
            break;
          }
        }
      }
    }

    // Check for Webpack configuration with Preact
    const webpackConfig = configFiles.get('webpack.config.js');
    if (webpackConfig?._rawContent) {
      if (
        webpackConfig._rawContent.includes('preact') ||
        webpackConfig._rawContent.includes('preact-loader')
      ) {
        evidence.push('Webpack Preact configuration found');
        foundConfigFiles.push('webpack.config.js');
        confidence += 0.3;
      }
    }

    // Check for Babel configuration with Preact preset
    const babelConfig = configFiles.get('babel.config.js') || configFiles.get('.babelrc');
    if (babelConfig) {
      const content = babelConfig._rawContent || JSON.stringify(babelConfig);
      if (content.includes('babel-preset-preact') || content.includes('preact')) {
        evidence.push('Babel Preact preset found');
        foundConfigFiles.push('babel configuration');
        confidence += 0.2;
      }
    }

    // Check for TypeScript configuration with JSX factory
    const tsConfig = configFiles.get('tsconfig.json');
    if (tsConfig) {
      const content = JSON.stringify(tsConfig);
      if (content.includes('h') && content.includes('Fragment')) {
        // Preact uses h function and Fragment
        evidence.push('TypeScript Preact JSX configuration found');
        foundConfigFiles.push('tsconfig.json');
        confidence += 0.15;
      }
    }

    return {
      isPreact: confidence > 0,
      confidence,
      evidence,
      configFiles: foundConfigFiles,
    };
  }

  private analyzeFileStructure(fileStructure: { directories: string[]; files: string[] }): {
    isPreact: boolean;
    confidence: number;
    evidence: string[];
  } {
    const evidence: string[] = [];
    let confidence = 0;

    // Check for Preact-specific files
    const preactFiles = [
      'preact.config.js',
      'manifest.json', // Common in Preact CLI projects
    ];

    let preactFileCount = 0;
    for (const file of preactFiles) {
      if (fileStructure.files.includes(file)) {
        preactFileCount++;
        evidence.push(`${file} found`);
      }
    }

    if (preactFileCount > 0) {
      confidence += Math.min(preactFileCount * 0.3, 0.5);
    }

    // Check for common Preact CLI project structure
    const preactDirs = ['src', 'assets', 'components', 'routes'];
    let dirCount = 0;
    for (const dir of preactDirs) {
      if (fileStructure.directories.includes(dir)) {
        dirCount++;
        confidence += 0.05;
      }
    }

    // Check for Preact-specific file patterns
    const preactRootFiles = ['index.js', 'index.ts', 'App.js', 'App.jsx', 'App.tsx'];
    for (const file of preactRootFiles) {
      if (fileStructure.files.includes(file)) {
        evidence.push(`${file} file found`);
        confidence += 0.1;
      }
    }

    // Check for template.html (common in Preact CLI)
    if (fileStructure.files.includes('template.html')) {
      evidence.push('template.html found (Preact CLI pattern)');
      confidence += 0.2;
    }

    // Check for size-plugin config (common optimization in Preact projects)
    if (fileStructure.files.includes('size-plugin.json')) {
      evidence.push('size-plugin.json found (Preact optimization)');
      confidence += 0.15;
    }

    return {
      isPreact: confidence > 0,
      confidence,
      evidence,
    };
  }

  private analyzeSourcePatterns(sourcePatterns: string[]): {
    isPreact: boolean;
    confidence: number;
    evidence: string[];
  } {
    const evidence: string[] = [];
    let confidence = 0;

    // JSX/TSX files indicate potential Preact usage
    if (sourcePatterns.includes('*.jsx')) {
      evidence.push('JSX files found');
      confidence += 0.2; // Lower confidence since JSX could be React
    }

    if (sourcePatterns.includes('*.tsx')) {
      evidence.push('TSX files found');
      confidence += 0.2; // Lower confidence since TSX could be React
    }

    // Check for src directory (common in Preact projects)
    if (sourcePatterns.includes('src')) {
      evidence.push('src directory in source patterns');
      confidence += 0.1;
    }

    // Check for routes directory (common in Preact CLI)
    if (sourcePatterns.includes('routes')) {
      evidence.push('routes directory found (Preact CLI pattern)');
      confidence += 0.15;
    }

    // Check for assets directory
    if (sourcePatterns.includes('assets')) {
      evidence.push('assets directory found');
      confidence += 0.05;
    }

    return {
      isPreact: confidence > 0,
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

      if (allDeps.typescript || allDeps['@types/preact']) {
        return true;
      }
    }

    // Check for TypeScript config files
    if (context.configFiles?.has('tsconfig.json')) {
      return true;
    }

    // Check for TypeScript files
    if (context.sourcePatterns?.includes('*.tsx') || context.sourcePatterns?.includes('*.ts')) {
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

      if (allDeps['preact-cli']) return 'Preact CLI';
      if (allDeps.vite || allDeps['@preact/preset-vite']) return 'Vite';
      if (allDeps.webpack || allDeps['preact-loader']) return 'Webpack';
      if (allDeps.rollup) return 'Rollup';
      if (allDeps.parcel) return 'Parcel';
    }

    if (context.configFiles?.has('preact.config.js')) {
      return 'Preact CLI';
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

    // Check package.json main field
    if (context.packageJson?.main) {
      entryPoints.push(context.packageJson.main);
    }

    // Common Preact entry points
    const commonEntries = [
      'src/index.js',
      'src/index.ts',
      'src/index.jsx',
      'src/index.tsx',
      'src/main.js',
      'src/main.ts',
      'src/main.jsx',
      'src/main.tsx',
      'index.js',
      'index.jsx',
      'index.tsx',
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