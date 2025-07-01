/**
 * Solid.js Framework Detector
 *
 * Detects Solid.js framework usage through:
 * - Package.json dependencies (solid-js package)
 * - Solid.js configuration files (solid.config.ts)
 * - JSX patterns specific to Solid
 * - Build system integration (Vite with Solid plugin)
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

export class SolidDetector implements IFrameworkDetector {
  readonly frameworkType: FrameworkType = 'solid';
  readonly name = 'Solid.js Detector';

  canDetect(_context: DetectionContext): boolean {
    // Can always attempt Solid detection
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
      solidStartEnabled: false,
      routingLibrary: undefined,
    };

    // Check package.json dependencies
    if (context.packageJson) {
      const packageResults = this.analyzePackageJson(context.packageJson);
      if (packageResults.isSolid) {
        sources.push({
          type: 'package',
          description: 'Solid.js dependencies found in package.json',
          confidence: packageResults.confidence,
          location: 'package.json',
          evidence: packageResults.evidence,
        });
        confidence += packageResults.confidence;
        version = packageResults.version;
        metadata.dependencies = packageResults.dependencies;
        metadata.solidStartEnabled = packageResults.solidStartEnabled;
        metadata.routingLibrary = packageResults.routingLibrary;
      }
    }

    // Check configuration files
    if (context.configFiles) {
      const configResults = this.analyzeConfigFiles(context.configFiles);
      if (configResults.isSolid) {
        sources.push({
          type: 'config',
          description: 'Solid.js configuration found',
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
      if (fsResults.isSolid) {
        sources.push({
          type: 'filesystem',
          description: 'Solid.js file structure detected',
          confidence: fsResults.confidence,
          evidence: fsResults.evidence,
        });
        confidence += fsResults.confidence;
      }
    }

    // Check source patterns
    if (context.sourcePatterns) {
      const codeResults = this.analyzeSourcePatterns(context.sourcePatterns);
      if (codeResults.isSolid) {
        sources.push({
          type: 'code',
          description: 'Solid.js patterns found in source code',
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

    // Detect SSR/SSG capabilities (SolidStart supports SSR/SSG)
    const ssrResult = SSRDetector.detect(context, 'solid');
    if (ssrResult.isSSRCapable) {
      metadata.ssrInfo = ssrResult.ssrInfo;
      metadata.hasSSR = ssrResult.ssrInfo.hasSSR;
      metadata.hasSSG = ssrResult.ssrInfo.hasSSG;
      metadata.renderingModes = ssrResult.ssrInfo.renderingModes;
    }

    // Detect CSS-in-JS libraries
    const cssResult = CSSInJSDetector.detect(context, 'solid');
    if (cssResult.hasCSSInJS) {
      metadata.cssInfo = cssResult.cssInfo;
      metadata.hasCSSInJS = cssResult.cssInfo.hasCSSInJS;
      metadata.stylingLibraries = cssResult.cssInfo.libraries.map(lib => lib.name);
      metadata.primaryStylingLibrary = cssResult.cssInfo.primaryLibrary;
    }

    return {
      type: 'solid',
      name: 'Solid.js',
      version,
      confidence: normalizedConfidence,
      sources,
      metadata,
    };
  }

  private analyzePackageJson(packageJson: any): {
    isSolid: boolean;
    confidence: number;
    version?: string;
    evidence: string[];
    dependencies: string[];
    solidStartEnabled: boolean;
    routingLibrary?: string;
  } {
    const evidence: string[] = [];
    const dependencies: string[] = [];
    let confidence = 0;
    let version: string | undefined;
    let solidStartEnabled = false;
    let routingLibrary: string | undefined;

    const allDeps = {
      ...packageJson.dependencies,
      ...packageJson.devDependencies,
      ...packageJson.peerDependencies,
    };

    // Core Solid.js package
    if (allDeps['solid-js']) {
      evidence.push('solid-js dependency found');
      dependencies.push('solid-js');
      confidence += 0.7; // High confidence for Solid.js dependency
      version = allDeps['solid-js'];
    }

    // SolidStart (meta-framework)
    if (allDeps['@solidjs/start']) {
      evidence.push('@solidjs/start dependency found');
      dependencies.push('@solidjs/start');
      solidStartEnabled = true;
      confidence += 0.6; // Very high confidence for SolidStart
    }

    // Solid routing
    const solidRouting = [
      '@solidjs/router',
      'solid-app-router',
    ];

    for (const router of solidRouting) {
      if (allDeps[router]) {
        evidence.push(`${router} found`);
        dependencies.push(router);
        routingLibrary = router;
        confidence += 0.2;
        break; // Only count one router
      }
    }

    // Solid ecosystem packages
    const solidEcosystem = [
      'solid-styled-components',
      '@solid-primitives/storage',
      '@solid-primitives/i18n',
      '@solid-primitives/media',
      '@solid-primitives/utils',
      'solid-headless',
      '@kobalte/core',
      '@hope-ui/solid',
      'solid-ui',
    ];

    let ecosystemCount = 0;
    for (const pkg of solidEcosystem) {
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

    // Vite Solid plugin
    if (allDeps['vite-plugin-solid']) {
      evidence.push('vite-plugin-solid found');
      dependencies.push('vite-plugin-solid');
      confidence += 0.3;
    }

    // Babel preset for Solid
    if (allDeps['babel-preset-solid']) {
      evidence.push('babel-preset-solid found');
      dependencies.push('babel-preset-solid');
      confidence += 0.2;
    }

    // TypeScript types
    if (allDeps['@types/solid-js']) {
      evidence.push('@types/solid-js found');
      dependencies.push('@types/solid-js');
      confidence += 0.1;
    }

    // Check for Solid-specific scripts
    if (packageJson.scripts) {
      const scripts = packageJson.scripts;
      let scriptCount = 0;

      if (scripts.dev && scripts.dev.includes('solid')) {
        evidence.push('solid dev script found');
        scriptCount++;
      }

      if (scripts.build && scripts.build.includes('solid')) {
        evidence.push('solid build script found');
        scriptCount++;
      }

      if (scriptCount > 0) {
        confidence += scriptCount * 0.1;
      }
    }

    return {
      isSolid: confidence > 0,
      confidence,
      version,
      evidence,
      dependencies,
      solidStartEnabled,
      routingLibrary,
    };
  }

  private analyzeConfigFiles(configFiles: Map<string, any>): {
    isSolid: boolean;
    confidence: number;
    evidence: string[];
    configFiles: string[];
  } {
    const evidence: string[] = [];
    const foundConfigFiles: string[] = [];
    let confidence = 0;

    // Solid.js configuration files
    const solidConfigs = ['solid.config.ts', 'solid.config.js'];

    for (const configFile of solidConfigs) {
      if (configFiles.has(configFile)) {
        evidence.push(`${configFile} found`);
        foundConfigFiles.push(configFile);
        confidence += 0.6; // High confidence for Solid config
        break; // Only count one config file
      }
    }

    // Check for Vite with Solid plugin
    const viteConfigs = ['vite.config.js', 'vite.config.ts', 'vite.config.mjs'];
    for (const configFile of viteConfigs) {
      if (configFiles.has(configFile)) {
        const config = configFiles.get(configFile);
        if (config?._rawContent) {
          const content = config._rawContent;
          if (content.includes('vite-plugin-solid') || content.includes('solid()')) {
            evidence.push('Vite Solid plugin configuration found');
            foundConfigFiles.push(configFile);
            confidence += 0.4;
            break;
          }
        }
      }
    }

    // Check for Babel configuration with Solid preset
    const babelConfig = configFiles.get('babel.config.js') || configFiles.get('.babelrc');
    if (babelConfig) {
      const content = babelConfig._rawContent || JSON.stringify(babelConfig);
      if (content.includes('babel-preset-solid') || content.includes('solid')) {
        evidence.push('Babel Solid preset found');
        foundConfigFiles.push('babel configuration');
        confidence += 0.3;
      }
    }

    // Check for TypeScript configuration with JSX preserve
    const tsConfig = configFiles.get('tsconfig.json');
    if (tsConfig) {
      const content = JSON.stringify(tsConfig);
      if (content.includes('preserve') && content.includes('jsx')) {
        // Solid typically uses JSX preserve mode
        evidence.push('TypeScript JSX preserve configuration found');
        foundConfigFiles.push('tsconfig.json');
        confidence += 0.1;
      }
    }

    return {
      isSolid: confidence > 0,
      confidence,
      evidence,
      configFiles: foundConfigFiles,
    };
  }

  private analyzeFileStructure(fileStructure: { directories: string[]; files: string[] }): {
    isSolid: boolean;
    confidence: number;
    evidence: string[];
  } {
    const evidence: string[] = [];
    let confidence = 0;

    // Check for Solid-specific files
    const solidFiles = [
      'solid.config.js',
      'solid.config.ts',
      'entry-client.tsx',
      'entry-server.tsx',
    ];

    let solidFileCount = 0;
    for (const file of solidFiles) {
      if (fileStructure.files.includes(file)) {
        solidFileCount++;
        evidence.push(`${file} found`);
      }
    }

    if (solidFileCount > 0) {
      confidence += Math.min(solidFileCount * 0.25, 0.5);
    }

    // Check for common Solid directory patterns
    const solidDirs = ['src', 'components', 'routes'];
    let dirCount = 0;
    for (const dir of solidDirs) {
      if (fileStructure.directories.includes(dir)) {
        dirCount++;
        confidence += 0.05;
      }
    }

    // Check for Solid-specific file patterns in root
    const solidRootFiles = ['App.tsx', 'App.jsx', 'index.tsx', 'index.jsx'];
    for (const file of solidRootFiles) {
      if (fileStructure.files.includes(file)) {
        evidence.push(`${file} file found`);
        confidence += 0.1;
      }
    }

    // Check for public directory (common in Solid projects)
    if (fileStructure.directories.includes('public')) {
      confidence += 0.05;
    }

    return {
      isSolid: confidence > 0,
      confidence,
      evidence,
    };
  }

  private analyzeSourcePatterns(sourcePatterns: string[]): {
    isSolid: boolean;
    confidence: number;
    evidence: string[];
  } {
    const evidence: string[] = [];
    let confidence = 0;

    // JSX/TSX files indicate potential Solid usage
    if (sourcePatterns.includes('*.jsx')) {
      evidence.push('JSX files found');
      confidence += 0.2; // Lower confidence since JSX could be React
    }

    if (sourcePatterns.includes('*.tsx')) {
      evidence.push('TSX files found');
      confidence += 0.2; // Lower confidence since TSX could be React
    }

    // Check for src directory (common in Solid projects)
    if (sourcePatterns.includes('src')) {
      evidence.push('src directory in source patterns');
      confidence += 0.1;
    }

    // Check for components directory
    if (sourcePatterns.includes('components')) {
      evidence.push('components directory found');
      confidence += 0.1;
    }

    return {
      isSolid: confidence > 0,
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

      if (allDeps.typescript || allDeps['@types/solid-js']) {
        return true;
      }
    }

    // Check for TypeScript config files
    if (
      context.configFiles?.has('tsconfig.json') ||
      context.configFiles?.has('solid.config.ts')
    ) {
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

      if (allDeps['@solidjs/start']) return 'SolidStart';
      if (allDeps.vite || allDeps['vite-plugin-solid']) return 'Vite';
      if (allDeps.webpack) return 'Webpack';
      if (allDeps.rollup) return 'Rollup';
    }

    if (context.configFiles?.has('solid.config.js') || context.configFiles?.has('solid.config.ts')) {
      return 'SolidStart';
    }

    if (context.configFiles?.has('vite.config.js') || context.configFiles?.has('vite.config.ts')) {
      return 'Vite';
    }

    return undefined;
  }

  private detectEntryPoints(context: DetectionContext): string[] {
    const entryPoints: string[] = [];

    // Check package.json main field
    if (context.packageJson?.main) {
      entryPoints.push(context.packageJson.main);
    }

    // Common Solid entry points
    const commonEntries = [
      'src/index.js',
      'src/index.ts',
      'src/index.jsx',
      'src/index.tsx',
      'src/main.js',
      'src/main.ts',
      'src/main.jsx',
      'src/main.tsx',
      'src/App.jsx',
      'src/App.tsx',
      'entry-client.tsx', // SolidStart
      'entry-server.tsx', // SolidStart
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