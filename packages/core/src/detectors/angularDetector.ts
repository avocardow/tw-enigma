/**
 * Angular Framework Detector
 *
 * Detects Angular framework usage through:
 * - Package.json dependencies (@angular/core package)
 * - Angular configuration files (angular.json, ng-package.json)
 * - TypeScript configuration and Angular patterns
 * - Angular CLI structure and patterns
 * - Angular version detection (2+)
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

export class AngularDetector implements IFrameworkDetector {
  readonly frameworkType: FrameworkType = 'angular';
  readonly name = 'Angular Detector';

  canDetect(_context: DetectionContext): boolean {
    // Can always attempt Angular detection
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
      angularVersion: 'unknown',
      hasAngularCLI: false,
      hasRxJS: false,
      hasZoneJS: false,
      libraries: [],
    };

    // Check package.json dependencies
    if (context.packageJson) {
      const packageResults = this.analyzePackageJson(context.packageJson);
      if (packageResults.isAngular) {
        sources.push({
          type: 'package',
          description: 'Angular dependencies found in package.json',
          confidence: packageResults.confidence,
          location: 'package.json',
          evidence: packageResults.evidence,
        });
        confidence += packageResults.confidence;
        version = packageResults.version;
        metadata.dependencies = packageResults.dependencies;
        metadata.angularVersion = packageResults.angularVersion;
        metadata.hasAngularCLI = packageResults.hasAngularCLI;
        metadata.hasRxJS = packageResults.hasRxJS;
        metadata.hasZoneJS = packageResults.hasZoneJS;
        metadata.libraries = packageResults.libraries;
      }
    }

    // Check configuration files
    if (context.configFiles) {
      const configResults = this.analyzeConfigFiles(context.configFiles);
      if (configResults.isAngular) {
        sources.push({
          type: 'config',
          description: 'Angular-related configuration found',
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
      if (codeResults.isAngular) {
        sources.push({
          type: 'code',
          description: 'Angular patterns found in source code',
          confidence: codeResults.confidence,
          evidence: codeResults.evidence,
        });
        confidence += codeResults.confidence;
      }
    }

    // Check file structure
    if (context.fileStructure) {
      const fsResults = this.analyzeFileStructure(context.fileStructure);
      if (fsResults.isAngular) {
        sources.push({
          type: 'filesystem',
          description: 'Angular-specific file structure detected',
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

    // TypeScript is essentially required for modern Angular
    metadata.hasTypeScript = this.detectTypeScriptSupport(context);

    // Detect build system
    metadata.buildSystem = this.detectBuildSystem(context);

    // Detect entry points
    metadata.entryPoints = this.detectEntryPoints(context);

    // Detect SSR/SSG capabilities (Angular Universal supports SSR)
    const ssrResult = SSRDetector.detect(context, 'angular');
    if (ssrResult.isSSRCapable) {
      metadata.ssrInfo = ssrResult.ssrInfo;
      metadata.hasSSR = ssrResult.ssrInfo.hasSSR;
      metadata.hasSSG = ssrResult.ssrInfo.hasSSG;
      metadata.renderingModes = ssrResult.ssrInfo.renderingModes;
    }

    // Detect CSS-in-JS libraries
    const cssResult = CSSInJSDetector.detect(context, 'angular');
    if (cssResult.hasCSSInJS) {
      metadata.cssInfo = cssResult.cssInfo;
      metadata.hasCSSInJS = cssResult.cssInfo.hasCSSInJS;
      metadata.stylingLibraries = cssResult.cssInfo.libraries.map(lib => lib.name);
      metadata.primaryStylingLibrary = cssResult.cssInfo.primaryLibrary;
    }

    return {
      type: 'angular',
      name: 'Angular',
      version,
      confidence: normalizedConfidence,
      sources,
      metadata,
    };
  }

  private analyzePackageJson(packageJson: any): {
    isAngular: boolean;
    confidence: number;
    version?: string;
    evidence: string[];
    dependencies: string[];
    angularVersion: string;
    hasAngularCLI: boolean;
    hasRxJS: boolean;
    hasZoneJS: boolean;
    libraries: string[];
  } {
    const evidence: string[] = [];
    const dependencies: string[] = [];
    const libraries: string[] = [];
    let confidence = 0;
    let version: string | undefined;
    let angularVersion = 'unknown';
    let hasAngularCLI = false;
    let hasRxJS = false;
    let hasZoneJS = false;

    const allDeps = {
      ...packageJson.dependencies,
      ...packageJson.devDependencies,
      ...packageJson.peerDependencies,
    };

    // Core Angular package
    if (allDeps['@angular/core']) {
      evidence.push('@angular/core dependency found');
      dependencies.push('@angular/core');
      confidence += 0.8;
      version = allDeps['@angular/core'];

      // Determine Angular version
      if (version) {
        const versionNumber = version.replace(/[^\d]/g, '').charAt(0);
        if (versionNumber) {
          angularVersion = `${versionNumber}.x`;
          evidence.push(`Angular ${versionNumber}.x detected`);
        }
      }
    }

    // Essential Angular packages
    const corePackages = [
      '@angular/common',
      '@angular/forms',
      '@angular/router',
      '@angular/platform-browser',
      '@angular/platform-browser-dynamic',
      '@angular/animations',
      '@angular/cdk',
      '@angular/material',
    ];

    let coreCount = 0;
    for (const pkg of corePackages) {
      if (allDeps[pkg]) {
        coreCount++;
        dependencies.push(pkg);
        if (coreCount <= 4) {
          evidence.push(`${pkg} dependency found`);
        }

        // Special handling for UI libraries
        if (pkg === '@angular/material' || pkg === '@angular/cdk') {
          libraries.push('Angular Material');
        }
      }
    }

    if (coreCount > 0) {
      confidence += Math.min(coreCount * 0.05, 0.3);
    }

    // Angular CLI
    if (allDeps['@angular/cli']) {
      evidence.push('@angular/cli dependency found');
      dependencies.push('@angular/cli');
      hasAngularCLI = true;
      confidence += 0.2;
    }

    // RxJS (essential for Angular)
    if (allDeps.rxjs) {
      evidence.push('rxjs dependency found');
      dependencies.push('rxjs');
      hasRxJS = true;
      confidence += 0.15;
    }

    // Zone.js (required for Angular change detection)
    if (allDeps['zone.js']) {
      evidence.push('zone.js dependency found');
      dependencies.push('zone.js');
      hasZoneJS = true;
      confidence += 0.1;
    }

    // Angular dev tools and build packages
    const devTools = [
      '@angular-devkit/build-angular',
      '@angular-devkit/core',
      '@angular-devkit/schematics',
      '@angular/compiler',
      '@angular/compiler-cli',
      '@angular/language-service',
      'ng-packagr',
      'protractor', // Legacy e2e testing
      '@angular/service-worker',
    ];

    let devToolsCount = 0;
    for (const tool of devTools) {
      if (allDeps[tool]) {
        devToolsCount++;
        dependencies.push(tool);
        if (devToolsCount <= 3) {
          evidence.push(`${tool} tool found`);
        }

        if (tool === '@angular/service-worker') {
          libraries.push('Service Worker');
        }
      }
    }

    if (devToolsCount > 0) {
      confidence += Math.min(devToolsCount * 0.03, 0.2);
    }

    // Angular ecosystem libraries
    const ecosystemLibs = [
      '@ngrx/store', // State management
      '@ngrx/effects',
      '@ngrx/router-store',
      '@ngx-translate/core', // Internationalization
      '@angular/fire', // Firebase
      '@auth0/angular-jwt', // JWT
      'primeng', // UI library
      'ng-bootstrap',
      '@ng-bootstrap/ng-bootstrap',
      'ngx-bootstrap',
      'angular2-jwt',
      'ng2-charts',
      'ngx-charts',
      'ag-grid-angular',
    ];

    let ecosystemCount = 0;
    for (const lib of ecosystemLibs) {
      if (allDeps[lib]) {
        ecosystemCount++;
        libraries.push(lib);
        if (ecosystemCount <= 3) {
          evidence.push(`${lib} library found`);
        }
      }
    }

    if (ecosystemCount > 0) {
      confidence += Math.min(ecosystemCount * 0.02, 0.15);
    }

    // Check scripts for Angular CLI
    if (packageJson.scripts) {
      const scripts = packageJson.scripts;
      let scriptCount = 0;

      if (
        scripts.ng ||
        scripts.start?.includes('ng serve') ||
        scripts.build?.includes('ng build')
      ) {
        evidence.push('Angular CLI scripts found');
        scriptCount++;
        hasAngularCLI = true;
      }

      if (scripts.test?.includes('ng test') || scripts.e2e?.includes('ng e2e')) {
        evidence.push('Angular CLI test scripts found');
        scriptCount++;
      }

      if (scriptCount > 0) {
        confidence += scriptCount * 0.1;
      }
    }

    return {
      isAngular: confidence > 0,
      confidence,
      version,
      evidence,
      dependencies,
      angularVersion,
      hasAngularCLI,
      hasRxJS,
      hasZoneJS,
      libraries,
    };
  }

  private analyzeConfigFiles(configFiles: Map<string, any>): {
    isAngular: boolean;
    confidence: number;
    evidence: string[];
    configFiles: string[];
  } {
    const evidence: string[] = [];
    const foundConfigFiles: string[] = [];
    let confidence = 0;

    // Angular CLI configuration
    const angularJson = configFiles.get('angular.json');
    if (angularJson) {
      evidence.push('angular.json found');
      foundConfigFiles.push('angular.json');
      confidence += 0.7;

      // Analyze content for Angular-specific patterns
      if (angularJson.projects || angularJson.defaultProject) {
        evidence.push('Angular CLI project configuration found');
        confidence += 0.1;
      }

      if (angularJson.architect || angularJson.schematics) {
        evidence.push('Angular CLI build configuration found');
        confidence += 0.05;
      }
    }

    // Legacy Angular CLI configuration
    const angularCliJson = configFiles.get('.angular-cli.json');
    if (angularCliJson) {
      evidence.push('.angular-cli.json found (legacy)');
      foundConfigFiles.push('.angular-cli.json');
      confidence += 0.6;
    }

    // Angular library configuration
    const ngPackageJson = configFiles.get('ng-package.json');
    if (ngPackageJson) {
      evidence.push('ng-package.json found');
      foundConfigFiles.push('ng-package.json');
      confidence += 0.5;
    }

    // TypeScript configuration for Angular
    const tsConfig = configFiles.get('tsconfig.json');
    if (tsConfig) {
      const content = JSON.stringify(tsConfig);
      if (
        content.includes('@angular') ||
        content.includes('experimentalDecorators') ||
        content.includes('emitDecoratorMetadata')
      ) {
        evidence.push('Angular TypeScript configuration found');
        foundConfigFiles.push('tsconfig.json');
        confidence += 0.2;
      }
    }

    // Angular-specific TypeScript configs
    const tsConfigApp = configFiles.get('tsconfig.app.json');
    const tsConfigSpec = configFiles.get('tsconfig.spec.json');
    if (tsConfigApp || tsConfigSpec) {
      evidence.push('Angular-specific TypeScript configs found');
      foundConfigFiles.push('tsconfig.app.json / tsconfig.spec.json');
      confidence += 0.15;
    }

    // Karma configuration (Angular's default test runner)
    const karmaConfig = configFiles.get('karma.conf.js');
    if (karmaConfig?.content || karmaConfig?._rawContent) {
      const content = karmaConfig._rawContent || JSON.stringify(karmaConfig);
      if (
        content.includes('@angular-devkit/build-angular') ||
        content.includes('karma-coverage-istanbul-reporter')
      ) {
        evidence.push('Angular Karma test configuration found');
        foundConfigFiles.push('karma.conf.js');
        confidence += 0.2;
      }
    }

    // Protractor configuration (legacy e2e)
    const protractorConfig = configFiles.get('protractor.conf.js');
    if (protractorConfig) {
      evidence.push('Protractor e2e configuration found');
      foundConfigFiles.push('protractor.conf.js');
      confidence += 0.15;
    }

    // ESLint configuration with Angular
    const eslintConfig = configFiles.get('.eslintrc.js') || configFiles.get('.eslintrc.json');
    if (eslintConfig) {
      const content = eslintConfig._rawContent || JSON.stringify(eslintConfig);
      if (
        content.includes('@angular-eslint') ||
        content.includes('@typescript-eslint/eslint-plugin')
      ) {
        evidence.push('Angular ESLint configuration found');
        foundConfigFiles.push('ESLint configuration');
        confidence += 0.1;
      }
    }

    return {
      isAngular: confidence > 0,
      confidence,
      evidence,
      configFiles: foundConfigFiles,
    };
  }

  private analyzeSourcePatterns(sourcePatterns: string[]): {
    isAngular: boolean;
    confidence: number;
    evidence: string[];
  } {
    const evidence: string[] = [];
    let confidence = 0;

    // Angular-specific file patterns
    if (
      sourcePatterns.includes('*.component.ts') ||
      sourcePatterns.includes('*.service.ts') ||
      sourcePatterns.includes('*.module.ts')
    ) {
      evidence.push('Angular TypeScript patterns found');
      confidence += 0.4;
    }

    // HTML templates
    if (sourcePatterns.includes('*.component.html')) {
      evidence.push('Angular component templates found');
      confidence += 0.2;
    }

    // Angular-specific directories
    const angularDirs = ['src/app', 'src/environments'];
    for (const dir of angularDirs) {
      if (sourcePatterns.includes(dir)) {
        evidence.push(`${dir} directory found`);
        confidence += 0.1;
      }
    }

    // Main entry point
    if (sourcePatterns.includes('src/main.ts')) {
      evidence.push('Angular main.ts entry point found');
      confidence += 0.15;
    }

    // Polyfills (common in Angular apps)
    if (sourcePatterns.includes('src/polyfills.ts')) {
      evidence.push('Angular polyfills.ts found');
      confidence += 0.1;
    }

    return {
      isAngular: confidence > 0,
      confidence,
      evidence,
    };
  }

  private analyzeFileStructure(fileStructure: { directories: string[]; files: string[] }): {
    isAngular: boolean;
    confidence: number;
    evidence: string[];
  } {
    const evidence: string[] = [];
    let confidence = 0;

    // Look for Angular-specific configuration files
    const angularFiles = [
      'angular.json',
      '.angular-cli.json',
      'ng-package.json',
      'karma.conf.js',
      'protractor.conf.js',
    ];

    let angularFileCount = 0;
    for (const file of angularFiles) {
      if (fileStructure.files.includes(file)) {
        angularFileCount++;
        evidence.push(`${file} found`);
      }
    }

    if (angularFileCount > 0) {
      confidence += Math.min(angularFileCount * 0.25, 0.6);
    }

    // Check for Angular CLI project structure
    const hasSrc = fileStructure.directories.includes('src');
    const hasApp = fileStructure.directories.includes('app');
    const hasEnvironments = fileStructure.directories.includes('environments');
    const hasAssets = fileStructure.directories.includes('assets');

    if (hasSrc) {
      evidence.push('src directory found');
      confidence += 0.05;
    }

    if (hasApp) {
      evidence.push('app directory found');
      confidence += 0.1;
    }

    if (hasEnvironments) {
      evidence.push('environments directory found');
      confidence += 0.1;
    }

    if (hasAssets) {
      evidence.push('assets directory found');
      confidence += 0.05;
    }

    // Angular CLI project structure
    if (hasSrc && hasApp) {
      evidence.push('Angular CLI project structure detected');
      confidence += 0.2;
    }

    // Check for Angular-specific files in src
    const angularSourceFiles = [
      'main.ts',
      'polyfills.ts',
      'styles.css',
      'styles.scss',
      'test.ts',
      'app.module.ts',
      'app.component.ts',
    ];

    let sourceFileCount = 0;
    for (const file of angularSourceFiles) {
      if (fileStructure.files.includes(file)) {
        sourceFileCount++;
        if (sourceFileCount <= 3) {
          evidence.push(`${file} found`);
        }
      }
    }

    if (sourceFileCount > 0) {
      confidence += Math.min(sourceFileCount * 0.05, 0.2);
    }

    return {
      isAngular: confidence > 0,
      confidence,
      evidence,
    };
  }

  private detectTypeScriptSupport(context: DetectionContext): boolean {
    // Angular essentially requires TypeScript from version 2+
    if (context.packageJson) {
      const allDeps = {
        ...context.packageJson.dependencies,
        ...context.packageJson.devDependencies,
      };

      // Angular always uses TypeScript
      if (allDeps['@angular/core']) {
        return true;
      }

      if (allDeps.typescript || allDeps['@angular/compiler']) {
        return true;
      }
    }

    // Check for TypeScript config
    if (context.configFiles?.has('tsconfig.json')) {
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

      if (allDeps['@angular-devkit/build-angular'] || allDeps['@angular/cli']) {
        return 'Angular CLI';
      }
      if (allDeps.webpack) {
        return 'Webpack';
      }
      if (allDeps.esbuild) {
        return 'esbuild';
      }
    }

    if (context.configFiles?.has('angular.json')) {
      return 'Angular CLI';
    }

    if (context.configFiles?.has('webpack.config.js')) {
      return 'Webpack';
    }

    return 'Angular CLI'; // Default for Angular projects
  }

  private detectEntryPoints(context: DetectionContext): string[] {
    const entryPoints: string[] = [];

    // Check for common Angular entry points
    const commonEntries = [
      'src/main.ts',
      'src/main.js',
      'src/polyfills.ts',
      'src/app/app.module.ts',
      'src/app/app.component.ts',
      'src/index.html',
      'angular.json',
    ];

    for (const entry of commonEntries) {
      const fileName = entry.split('/').pop()!;
      if (context.fileStructure?.files.includes(fileName)) {
        entryPoints.push(entry);
      }
    }

    // Angular typically uses src/main.ts as the primary entry point
    if (context.fileStructure?.files.includes('main.ts')) {
      entryPoints.unshift('src/main.ts');
    }

    return [...new Set(entryPoints)]; // Remove duplicates
  }
}
