/**
 * SSR/SSG Detection Utility
 *
 * Provides comprehensive detection capabilities for server-side rendering
 * and static site generation patterns across different frameworks.
 */

import type { DetectionContext } from '../frameworkDetector';

export interface SSRSSGInfo {
  hasSSR: boolean;
  hasSSG: boolean;
  hasISR: boolean; // Incremental Static Regeneration
  hasHydration: boolean;
  renderingModes: RenderingMode[];
  ssrFramework?: string;
  staticExportEnabled?: boolean;
  prerenderingEnabled?: boolean;
}

export type RenderingMode =
  | 'spa' // Single Page Application
  | 'ssr' // Server-Side Rendering
  | 'ssg' // Static Site Generation
  | 'isr' // Incremental Static Regeneration
  | 'hybrid'; // Mixed rendering modes

export interface SSRDetectionResult {
  isSSRCapable: boolean;
  confidence: number;
  evidence: string[];
  ssrInfo: SSRSSGInfo;
}

/**
 * Universal SSR/SSG detector that works across frameworks
 */
export class SSRDetector {
  /**
   * Detect SSR/SSG capabilities for any framework
   */
  static detect(context: DetectionContext, frameworkType?: string): SSRDetectionResult {
    const evidence: string[] = [];
    let confidence = 0;
    const ssrInfo: SSRSSGInfo = {
      hasSSR: false,
      hasSSG: false,
      hasISR: false,
      hasHydration: false,
      renderingModes: ['spa'], // Default to SPA
      staticExportEnabled: false,
      prerenderingEnabled: false,
    };

    // Framework-specific SSR detection
    if (frameworkType) {
      const frameworkResult = this.detectFrameworkSpecificSSR(context, frameworkType);
      confidence += frameworkResult.confidence;
      evidence.push(...frameworkResult.evidence);
      Object.assign(ssrInfo, frameworkResult.ssrInfo);
    }

    // Universal package.json analysis
    const packageResult = this.analyzePackageJsonForSSR(context.packageJson);
    confidence += packageResult.confidence;
    evidence.push(...packageResult.evidence);
    this.mergeSSRInfo(ssrInfo, packageResult.ssrInfo);

    // Configuration file analysis
    const configResult = this.analyzeConfigFilesForSSR(context.configFiles);
    confidence += configResult.confidence;
    evidence.push(...configResult.evidence);
    this.mergeSSRInfo(ssrInfo, configResult.ssrInfo);

    // File structure analysis
    const fileResult = this.analyzeFileStructureForSSR(context.fileStructure);
    confidence += fileResult.confidence;
    evidence.push(...fileResult.evidence);
    this.mergeSSRInfo(ssrInfo, fileResult.ssrInfo);

    // Update rendering modes based on detected capabilities
    this.updateRenderingModes(ssrInfo);

    return {
      isSSRCapable: ssrInfo.hasSSR || ssrInfo.hasSSG || ssrInfo.hasISR,
      confidence: Math.min(confidence, 1.0),
      evidence,
      ssrInfo,
    };
  }

  /**
   * Framework-specific SSR detection
   */
  private static detectFrameworkSpecificSSR(
    context: DetectionContext,
    frameworkType: string
  ): SSRDetectionResult {
    switch (frameworkType) {
      case 'nextjs':
        return this.detectNextjsSSR(context);
      case 'nuxtjs':
      case 'vue':
        return this.detectNuxtSSR(context);
      case 'svelte':
        return this.detectSvelteKitSSR(context);
      case 'angular':
        return this.detectAngularUniversalSSR(context);
      case 'solid':
        return this.detectSolidStartSSR(context);
      default:
        return {
          isSSRCapable: false,
          confidence: 0,
          evidence: [],
          ssrInfo: this.getDefaultSSRInfo(),
        };
    }
  }

  /**
   * Next.js SSR detection
   */
  private static detectNextjsSSR(context: DetectionContext): SSRDetectionResult {
    const evidence: string[] = [];
    let confidence = 0;
    const ssrInfo: SSRSSGInfo = this.getDefaultSSRInfo();

    if (context.packageJson) {
      const allDeps = {
        ...context.packageJson.dependencies,
        ...context.packageJson.devDependencies,
      };

      if (allDeps.next) {
        ssrInfo.hasSSR = true;
        ssrInfo.hasSSG = true;
        ssrInfo.hasISR = true;
        ssrInfo.hasHydration = true;
        ssrInfo.ssrFramework = 'Next.js';
        evidence.push('Next.js supports SSR/SSG by default');
        confidence += 0.8;
      }
    }

    // Check for Next.js config with output export
    const nextConfig =
      context.configFiles?.get('next.config.js') ||
      context.configFiles?.get('next.config.mjs') ||
      context.configFiles?.get('next.config.ts');

    if (nextConfig?._rawContent) {
      const content = nextConfig._rawContent;
      if (content.includes('output:') && content.includes('export')) {
        ssrInfo.staticExportEnabled = true;
        evidence.push('Next.js static export configured');
        confidence += 0.2;
      }
      if (content.includes('trailingSlash') || content.includes('generateStaticParams')) {
        evidence.push('Next.js static generation patterns found');
        confidence += 0.1;
      }
    }

    // Check for App Router vs Pages Router
    if (context.fileStructure?.directories.includes('app')) {
      evidence.push('Next.js App Router detected (supports RSC)');
      confidence += 0.1;
    }

    if (context.fileStructure?.directories.includes('pages')) {
      evidence.push('Next.js Pages Router detected');
      confidence += 0.1;
    }

    return {
      isSSRCapable: ssrInfo.hasSSR,
      confidence,
      evidence,
      ssrInfo,
    };
  }

  /**
   * Nuxt.js SSR detection
   */
  private static detectNuxtSSR(context: DetectionContext): SSRDetectionResult {
    const evidence: string[] = [];
    let confidence = 0;
    const ssrInfo: SSRSSGInfo = this.getDefaultSSRInfo();

    if (context.packageJson) {
      const allDeps = {
        ...context.packageJson.dependencies,
        ...context.packageJson.devDependencies,
      };

      if (allDeps.nuxt || allDeps['@nuxt/kit']) {
        ssrInfo.hasSSR = true;
        ssrInfo.hasSSG = true;
        ssrInfo.hasHydration = true;
        ssrInfo.ssrFramework = 'Nuxt.js';
        evidence.push('Nuxt.js supports SSR/SSG by default');
        confidence += 0.8;
      }
    }

    // Check for Nuxt config
    const nuxtConfig =
      context.configFiles?.get('nuxt.config.js') ||
      context.configFiles?.get('nuxt.config.ts');

    if (nuxtConfig?._rawContent) {
      const content = nuxtConfig._rawContent;
      if (content.includes('ssr:') && content.includes('false')) {
        ssrInfo.hasSSR = false;
        evidence.push('Nuxt.js SSR disabled in config');
      }
      if (content.includes('generate') || content.includes('nitro')) {
        ssrInfo.hasSSG = true;
        evidence.push('Nuxt.js static generation configured');
        confidence += 0.2;
      }
    }

    return {
      isSSRCapable: ssrInfo.hasSSR,
      confidence,
      evidence,
      ssrInfo,
    };
  }

  /**
   * SvelteKit SSR detection
   */
  private static detectSvelteKitSSR(context: DetectionContext): SSRDetectionResult {
    const evidence: string[] = [];
    let confidence = 0;
    const ssrInfo: SSRSSGInfo = this.getDefaultSSRInfo();

    if (context.packageJson) {
      const allDeps = {
        ...context.packageJson.dependencies,
        ...context.packageJson.devDependencies,
      };

      if (allDeps['@sveltejs/kit']) {
        ssrInfo.hasSSR = true;
        ssrInfo.hasSSG = true;
        ssrInfo.hasHydration = true;
        ssrInfo.ssrFramework = 'SvelteKit';
        evidence.push('SvelteKit supports SSR/SSG by default');
        confidence += 0.8;
      }

      // Check for SvelteKit adapters
      const staticAdapters = ['@sveltejs/adapter-static'];
      const ssrAdapters = ['@sveltejs/adapter-node', '@sveltejs/adapter-vercel'];

      for (const adapter of staticAdapters) {
        if (allDeps[adapter]) {
          ssrInfo.staticExportEnabled = true;
          evidence.push(`SvelteKit static adapter found: ${adapter}`);
          confidence += 0.2;
        }
      }

      for (const adapter of ssrAdapters) {
        if (allDeps[adapter]) {
          evidence.push(`SvelteKit SSR adapter found: ${adapter}`);
          confidence += 0.1;
        }
      }
    }

    return {
      isSSRCapable: ssrInfo.hasSSR,
      confidence,
      evidence,
      ssrInfo,
    };
  }

  /**
   * Angular Universal SSR detection
   */
  private static detectAngularUniversalSSR(context: DetectionContext): SSRDetectionResult {
    const evidence: string[] = [];
    let confidence = 0;
    const ssrInfo: SSRSSGInfo = this.getDefaultSSRInfo();

    if (context.packageJson) {
      const allDeps = {
        ...context.packageJson.dependencies,
        ...context.packageJson.devDependencies,
      };

      if (allDeps['@nguniversal/express-engine'] || allDeps['@angular/ssr']) {
        ssrInfo.hasSSR = true;
        ssrInfo.hasHydration = true;
        ssrInfo.ssrFramework = 'Angular Universal';
        evidence.push('Angular Universal SSR detected');
        confidence += 0.8;
      }

      if (allDeps['@nguniversal/builders']) {
        evidence.push('Angular Universal builders found');
        confidence += 0.2;
      }
    }

    // Check for Angular config
    const angularConfig = context.configFiles?.get('angular.json');
    if (angularConfig) {
      const content = JSON.stringify(angularConfig);
      if (content.includes('server') && content.includes('build')) {
        evidence.push('Angular server build configuration found');
        confidence += 0.3;
      }
      if (content.includes('prerender')) {
        ssrInfo.prerenderingEnabled = true;
        evidence.push('Angular prerendering configured');
        confidence += 0.2;
      }
    }

    return {
      isSSRCapable: ssrInfo.hasSSR,
      confidence,
      evidence,
      ssrInfo,
    };
  }

  /**
   * SolidStart SSR detection
   */
  private static detectSolidStartSSR(context: DetectionContext): SSRDetectionResult {
    const evidence: string[] = [];
    let confidence = 0;
    const ssrInfo: SSRSSGInfo = this.getDefaultSSRInfo();

    if (context.packageJson) {
      const allDeps = {
        ...context.packageJson.dependencies,
        ...context.packageJson.devDependencies,
      };

      if (allDeps['@solidjs/start']) {
        ssrInfo.hasSSR = true;
        ssrInfo.hasSSG = true;
        ssrInfo.hasHydration = true;
        ssrInfo.ssrFramework = 'SolidStart';
        evidence.push('SolidStart supports SSR/SSG by default');
        confidence += 0.8;
      }
    }

    return {
      isSSRCapable: ssrInfo.hasSSR,
      confidence,
      evidence,
      ssrInfo,
    };
  }

  /**
   * Analyze package.json for SSR-related dependencies
   */
  private static analyzePackageJsonForSSR(packageJson: any): SSRDetectionResult {
    const evidence: string[] = [];
    let confidence = 0;
    const ssrInfo: SSRSSGInfo = this.getDefaultSSRInfo();

    if (!packageJson) {
      return { isSSRCapable: false, confidence: 0, evidence: [], ssrInfo };
    }

    const allDeps = {
      ...packageJson.dependencies,
      ...packageJson.devDependencies,
    };

    // Universal SSR libraries
    const ssrLibraries = [
      'react-dom/server',
      'vue/server-renderer',
      'express',
      'fastify',
      'koa',
      'hapi',
      '@apollo/server',
      'graphql-yoga',
    ];

    for (const lib of ssrLibraries) {
      if (allDeps[lib]) {
        ssrInfo.hasSSR = true;
        evidence.push(`SSR library found: ${lib}`);
        confidence += 0.1;
      }
    }

    // Static site generators
    const ssgLibraries = [
      'gatsby',
      'gridsome',
      'vuepress',
      'docusaurus',
      'astro',
      'eleventy',
      '@11ty/eleventy',
    ];

    for (const lib of ssgLibraries) {
      if (allDeps[lib]) {
        ssrInfo.hasSSG = true;
        ssrInfo.ssrFramework = lib;
        evidence.push(`SSG framework found: ${lib}`);
        confidence += 0.3;
      }
    }

    // Hydration libraries
    const hydrationLibraries = ['react-hydrate', 'vue-hydrate'];

    for (const lib of hydrationLibraries) {
      if (allDeps[lib]) {
        ssrInfo.hasHydration = true;
        evidence.push(`Hydration library found: ${lib}`);
        confidence += 0.1;
      }
    }

    return {
      isSSRCapable: ssrInfo.hasSSR || ssrInfo.hasSSG,
      confidence,
      evidence,
      ssrInfo,
    };
  }

  /**
   * Analyze configuration files for SSR patterns
   */
  private static analyzeConfigFilesForSSR(configFiles?: Map<string, any>): SSRDetectionResult {
    const evidence: string[] = [];
    let confidence = 0;
    const ssrInfo: SSRSSGInfo = this.getDefaultSSRInfo();

    if (!configFiles) {
      return { isSSRCapable: false, confidence: 0, evidence: [], ssrInfo };
    }

    // Check various config files for SSR patterns
    for (const [fileName, config] of configFiles) {
      if (config?._rawContent) {
        const content = config._rawContent.toLowerCase();

        // Server-side rendering indicators
        if (content.includes('ssr') || content.includes('server')) {
          ssrInfo.hasSSR = true;
          evidence.push(`SSR configuration found in ${fileName}`);
          confidence += 0.2;
        }

        // Static generation indicators
        if (content.includes('static') || content.includes('generate') || content.includes('prerender')) {
          ssrInfo.hasSSG = true;
          evidence.push(`Static generation configuration found in ${fileName}`);
          confidence += 0.2;
        }

        // Hydration indicators
        if (content.includes('hydrat') || content.includes('client-side')) {
          ssrInfo.hasHydration = true;
          evidence.push(`Hydration configuration found in ${fileName}`);
          confidence += 0.1;
        }
      }
    }

    return {
      isSSRCapable: ssrInfo.hasSSR || ssrInfo.hasSSG,
      confidence,
      evidence,
      ssrInfo,
    };
  }

  /**
   * Analyze file structure for SSR patterns
   */
  private static analyzeFileStructureForSSR(fileStructure?: {
    directories: string[];
    files: string[];
  }): SSRDetectionResult {
    const evidence: string[] = [];
    let confidence = 0;
    const ssrInfo: SSRSSGInfo = this.getDefaultSSRInfo();

    if (!fileStructure) {
      return { isSSRCapable: false, confidence: 0, evidence: [], ssrInfo };
    }

    // Server-related directories
    const serverDirs = ['server', 'api', 'pages/api', 'app/api'];
    for (const dir of serverDirs) {
      if (fileStructure.directories.includes(dir)) {
        ssrInfo.hasSSR = true;
        evidence.push(`Server directory found: ${dir}`);
        confidence += 0.1;
      }
    }

    // Static generation directories
    const staticDirs = ['static', 'public', 'dist', 'build', 'out'];
    for (const dir of staticDirs) {
      if (fileStructure.directories.includes(dir)) {
        evidence.push(`Static directory found: ${dir}`);
        confidence += 0.05;
      }
    }

    // Server-related files
    const serverFiles = ['server.js', 'server.ts', 'app.js', 'app.ts'];
    for (const file of serverFiles) {
      if (fileStructure.files.includes(file)) {
        ssrInfo.hasSSR = true;
        evidence.push(`Server file found: ${file}`);
        confidence += 0.1;
      }
    }

    return {
      isSSRCapable: ssrInfo.hasSSR || ssrInfo.hasSSG,
      confidence,
      evidence,
      ssrInfo,
    };
  }

  /**
   * Merge SSR info objects
   */
  private static mergeSSRInfo(target: SSRSSGInfo, source: SSRSSGInfo): void {
    target.hasSSR = target.hasSSR || source.hasSSR;
    target.hasSSG = target.hasSSG || source.hasSSG;
    target.hasISR = target.hasISR || source.hasISR;
    target.hasHydration = target.hasHydration || source.hasHydration;
    target.staticExportEnabled = target.staticExportEnabled || source.staticExportEnabled;
    target.prerenderingEnabled = target.prerenderingEnabled || source.prerenderingEnabled;

    if (source.ssrFramework && !target.ssrFramework) {
      target.ssrFramework = source.ssrFramework;
    }
  }

  /**
   * Update rendering modes based on capabilities
   */
  private static updateRenderingModes(ssrInfo: SSRSSGInfo): void {
    const modes: RenderingMode[] = [];

    if (ssrInfo.hasSSR && ssrInfo.hasSSG) {
      modes.push('hybrid');
    } else if (ssrInfo.hasSSR) {
      modes.push('ssr');
    } else if (ssrInfo.hasSSG) {
      modes.push('ssg');
    } else {
      modes.push('spa');
    }

    if (ssrInfo.hasISR) {
      modes.push('isr');
    }

    ssrInfo.renderingModes = modes;
  }

  /**
   * Get default SSR info
   */
  private static getDefaultSSRInfo(): SSRSSGInfo {
    return {
      hasSSR: false,
      hasSSG: false,
      hasISR: false,
      hasHydration: false,
      renderingModes: ['spa'],
      staticExportEnabled: false,
      prerenderingEnabled: false,
    };
  }
}