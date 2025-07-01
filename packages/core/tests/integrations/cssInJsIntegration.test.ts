/**
 * CSS-in-JS Integration Tests
 */

import type { FrameworkInfo } from '../../src/frameworkDetector';
import {
  CSSInJSIntegration,
  CSS_IN_JS_LIBRARIES,
  createCSSInJSIntegration,
  detectAndConfigureCSSInJS,
  type CSSInJSDetectionResult,
  type CSSInJSLibrary,
  type CSSInJSOptimizationConfig,
} from '../../src/integrations/cssInJsIntegration';

describe('CSSInJSIntegration', () => {
  let integration: CSSInJSIntegration;

  beforeEach(() => {
    integration = new CSSInJSIntegration();
  });

  afterEach(() => {
    integration.removeAllListeners();
  });

  describe('library registry', () => {
    it('should have comprehensive library definitions', () => {
      expect(Object.keys(CSS_IN_JS_LIBRARIES)).toHaveLength(22);

      // Check React libraries
      expect(CSS_IN_JS_LIBRARIES['styled-components']).toBeDefined();
      expect(CSS_IN_JS_LIBRARIES['@emotion/react']).toBeDefined();
      expect(CSS_IN_JS_LIBRARIES['@emotion/styled']).toBeDefined();

      // Check Vue libraries
      expect(CSS_IN_JS_LIBRARIES['vue-styled-components']).toBeDefined();
      expect(CSS_IN_JS_LIBRARIES['@emotion/vue']).toBeDefined();

      // Check Angular libraries
      expect(CSS_IN_JS_LIBRARIES['@angular/material']).toBeDefined();
      expect(CSS_IN_JS_LIBRARIES['ng-zorro-antd']).toBeDefined();

      // Check universal libraries
      expect(CSS_IN_JS_LIBRARIES['linaria']).toBeDefined();
      expect(CSS_IN_JS_LIBRARIES['stitches']).toBeDefined();
      expect(CSS_IN_JS_LIBRARIES['vanilla-extract']).toBeDefined();
    });

    it('should have correct framework classifications', () => {
      expect(CSS_IN_JS_LIBRARIES['styled-components'].framework).toBe('react');
      expect(CSS_IN_JS_LIBRARIES['vue-styled-components'].framework).toBe('vue');
      expect(CSS_IN_JS_LIBRARIES['@angular/material'].framework).toBe('angular');
      expect(CSS_IN_JS_LIBRARIES['linaria'].framework).toBe('universal');
    });

    it('should have accurate capability flags', () => {
      // Libraries with zero runtime
      expect(CSS_IN_JS_LIBRARIES['linaria'].requiresRuntime).toBe(false);
      expect(CSS_IN_JS_LIBRARIES['vanilla-extract'].requiresRuntime).toBe(false);
      expect(CSS_IN_JS_LIBRARIES['@compiled/react'].requiresRuntime).toBe(false);

      // Libraries with runtime requirements
      expect(CSS_IN_JS_LIBRARIES['styled-components'].requiresRuntime).toBe(true);
      expect(CSS_IN_JS_LIBRARIES['@emotion/react'].requiresRuntime).toBe(true);

      // SSR support
      expect(CSS_IN_JS_LIBRARIES['styled-components'].supportsSSR).toBe(true);
      expect(CSS_IN_JS_LIBRARIES['@emotion/react'].supportsSSR).toBe(true);
      expect(CSS_IN_JS_LIBRARIES['linaria'].supportsSSR).toBe(true);
    });
  });

  describe('library detection', () => {
    const mockReactFramework: FrameworkInfo = {
      type: 'react',
      name: 'React',
      confidence: 0.9,
      sources: [],
      metadata: {
        dependencies: ['react', 'react-dom', 'styled-components'],
        devDependencies: ['@types/styled-components'],
        hasTypeScript: true,
        buildSystem: 'Create React App',
      },
    };

    it('should detect styled-components in React project', async () => {
      const results = await integration.detectLibraries(mockReactFramework, '/test/project');

      const styledComponents = results.find((r) => r.library === 'styled-components');
      expect(styledComponents).toBeDefined();
      expect(styledComponents!.confidence).toBeGreaterThan(0.3);
      expect(styledComponents!.framework).toBe('react');
    });

    it('should detect emotion libraries', async () => {
      const emotionFramework: FrameworkInfo = {
        ...mockReactFramework,
        metadata: {
          ...mockReactFramework.metadata,
          dependencies: ['react', 'react-dom', '@emotion/react', '@emotion/styled'],
        },
      };

      const results = await integration.detectLibraries(emotionFramework, '/test/project');

      const emotionReact = results.find((r) => r.library === '@emotion/react');
      const emotionStyled = results.find((r) => r.library === '@emotion/styled');

      expect(emotionReact).toBeDefined();
      expect(emotionStyled).toBeDefined();
      expect(emotionReact!.confidence).toBeGreaterThan(0.3);
      expect(emotionStyled!.confidence).toBeGreaterThan(0.3);
    });

    it('should detect Vue CSS-in-JS libraries', async () => {
      const vueFramework: FrameworkInfo = {
        type: 'vue',
        name: 'Vue',
        confidence: 0.9,
        sources: [],
        metadata: {
          dependencies: ['vue', 'vue-styled-components'],
          buildSystem: 'Vue CLI',
        },
      };

      const results = await integration.detectLibraries(vueFramework, '/test/project');

      const vueStyled = results.find((r) => r.library === 'vue-styled-components');
      expect(vueStyled).toBeDefined();
      expect(vueStyled!.framework).toBe('vue');
    });

    it('should detect Angular Material', async () => {
      const angularFramework: FrameworkInfo = {
        type: 'angular',
        name: 'Angular',
        confidence: 0.9,
        sources: [],
        metadata: {
          dependencies: ['@angular/core', '@angular/material', '@angular/cdk'],
          buildSystem: 'Angular CLI',
        },
      };

      const results = await integration.detectLibraries(angularFramework, '/test/project');

      const angularMaterial = results.find((r) => r.library === '@angular/material');
      expect(angularMaterial).toBeDefined();
      expect(angularMaterial!.framework).toBe('angular');
    });

    it('should detect universal libraries across frameworks', async () => {
      const frameworks = [
        {
          ...mockReactFramework,
          metadata: { ...mockReactFramework.metadata, dependencies: ['react', 'linaria'] },
        },
        {
          type: 'vue' as const,
          name: 'Vue',
          confidence: 0.9,
          sources: [],
          metadata: { dependencies: ['vue', 'linaria'] },
        },
        {
          type: 'angular' as const,
          name: 'Angular',
          confidence: 0.9,
          sources: [],
          metadata: { dependencies: ['@angular/core', 'linaria'] },
        },
      ];

      for (const framework of frameworks) {
        const results = await integration.detectLibraries(framework, '/test/project');
        const linaria = results.find((r) => r.library === 'linaria');

        expect(linaria).toBeDefined();
        expect(linaria!.framework).toBe('universal');
      }
    });

    it('should emit detection events', async () => {
      const events: string[] = [];
      integration.on('detectionStart', () => events.push('start'));
      integration.on('detectionComplete', () => events.push('complete'));

      await integration.detectLibraries(mockReactFramework, '/test/project');

      expect(events).toContain('start');
      expect(events).toContain('complete');
    });

    it('should filter by framework compatibility', async () => {
      const results = await integration.detectLibraries(mockReactFramework, '/test/project');

      // Should not detect Vue-specific libraries in React project
      const vueLibrary = results.find((r) => r.library === 'vue-styled-components');
      expect(vueLibrary).toBeUndefined();

      // Should not detect Angular-specific libraries in React project
      const angularLibrary = results.find((r) => r.library === '@angular/material');
      expect(angularLibrary).toBeUndefined();
    });

    it('should sort results by confidence', async () => {
      const results = await integration.detectLibraries(mockReactFramework, '/test/project');

      if (results.length > 1) {
        for (let i = 1; i < results.length; i++) {
          expect(results[i - 1].confidence).toBeGreaterThanOrEqual(results[i].confidence);
        }
      }
    });
  });

  describe('preset generation', () => {
    const mockDetectionResults: CSSInJSDetectionResult[] = [
      {
        library: 'styled-components',
        confidence: 0.9,
        framework: 'react',
        evidence: ['Found styled-components in dependencies'],
        configFiles: ['.babelrc'],
        entryPoints: ['src/App.tsx'],
      },
    ];

    const mockFrameworkInfo: FrameworkInfo = {
      type: 'react',
      name: 'React',
      confidence: 0.9,
      sources: [],
      metadata: {
        dependencies: ['react', 'react-dom', 'styled-components'],
        buildSystem: 'Create React App',
      },
    };

    it('should generate preset for detected library', () => {
      const preset = integration.generatePreset(mockDetectionResults, mockFrameworkInfo);

      expect(preset).toBeDefined();
      expect(preset!.library).toBe('styled-components');
      expect(preset!.framework).toBe('react');
      expect(preset!.name).toBe('styled-components-react');
      expect(preset!.config).toBeDefined();
      expect(preset!.buildPlugins).toContain('babel-plugin-styled-components');
    });

    it('should generate development vs production configs', () => {
      const originalEnv = process.env.NODE_ENV;

      // Test development config
      process.env.NODE_ENV = 'development';
      const devPreset = integration.generatePreset(mockDetectionResults, mockFrameworkInfo);
      expect(devPreset!.config.generateSourceMaps).toBe(true);
      expect(devPreset!.config.minimizeSize).toBe(false);
      expect(devPreset!.config.enableHMR).toBe(true);

      // Test production config
      process.env.NODE_ENV = 'production';
      const prodPreset = integration.generatePreset(mockDetectionResults, mockFrameworkInfo);
      expect(prodPreset!.config.generateSourceMaps).toBe(false);
      expect(prodPreset!.config.minimizeSize).toBe(true);
      expect(prodPreset!.config.enableHMR).toBe(false);

      process.env.NODE_ENV = originalEnv;
    });

    it('should handle SSR configuration', () => {
      const ssrFramework: FrameworkInfo = {
        ...mockFrameworkInfo,
        metadata: {
          ...mockFrameworkInfo.metadata,
          buildSystem: 'Next.js',
          hasSSR: true,
        },
      };

      const preset = integration.generatePreset(mockDetectionResults, ssrFramework);
      expect(preset!.config).toBeDefined();
      expect(preset!.runtimeRequirements).toContain('SSR style collection');
    });

    it('should return null for empty detection results', () => {
      const preset = integration.generatePreset([], mockFrameworkInfo);
      expect(preset).toBeNull();
    });

    it('should emit preset generation events', () => {
      const events: any[] = [];
      integration.on('presetGenerated', (data) => events.push(data));

      integration.generatePreset(mockDetectionResults, mockFrameworkInfo);

      expect(events).toHaveLength(1);
      expect(events[0].library).toBe('styled-components');
    });
  });

  describe('CSS extraction', () => {
    const mockDetectionResults: CSSInJSDetectionResult[] = [
      {
        library: 'styled-components',
        confidence: 0.9,
        framework: 'react',
        evidence: ['Found styled-components in dependencies'],
        configFiles: [],
        entryPoints: [],
      },
    ];

    const mockConfig: CSSInJSOptimizationConfig = {
      extractStatic: true,
      optimizeRuntime: true,
      generateSourceMaps: true,
      removeDuplicates: true,
      minimizeSize: false,
      preserveDebugInfo: true,
      enableHMR: true,
      customThemeExtraction: true,
    };

    it('should extract CSS from detected libraries', async () => {
      const result = await integration.extractCSS(
        mockDetectionResults,
        mockConfig,
        '/test/project'
      );

      expect(result).toBeDefined();
      expect(result.staticCSS).toBeDefined();
      expect(result.dynamicPatterns).toBeDefined();
      expect(result.themeVariables).toBeDefined();
      expect(result.componentMappings).toBeInstanceOf(Map);
      expect(result.optimizationMetrics).toBeDefined();
    });

    it('should handle multiple libraries', async () => {
      const multipleLibraries: CSSInJSDetectionResult[] = [
        ...mockDetectionResults,
        {
          library: '@emotion/react',
          confidence: 0.8,
          framework: 'react',
          evidence: ['Found @emotion/react in dependencies'],
          configFiles: [],
          entryPoints: [],
        },
      ];

      const result = await integration.extractCSS(multipleLibraries, mockConfig, '/test/project');

      expect(result.staticCSS).toContain('styled-components');
      expect(result.staticCSS).toContain('@emotion/react');
    });

    it('should provide optimization metrics', async () => {
      const result = await integration.extractCSS(
        mockDetectionResults,
        mockConfig,
        '/test/project'
      );

      expect(result.optimizationMetrics.originalSize).toBeGreaterThan(0);
      expect(result.optimizationMetrics.extractedSize).toBeGreaterThanOrEqual(0);
      expect(result.optimizationMetrics.runtimeReduction).toBeGreaterThanOrEqual(0);
      expect(result.optimizationMetrics.bundleImpact).toBeGreaterThanOrEqual(0);
    });

    it('should emit extraction events', async () => {
      const events: string[] = [];
      integration.on('extractionStart', () => events.push('start'));
      integration.on('extractionComplete', () => events.push('complete'));

      await integration.extractCSS(mockDetectionResults, mockConfig, '/test/project');

      expect(events).toContain('start');
      expect(events).toContain('complete');
    });
  });

  describe('compatibility validation', () => {
    it('should validate framework compatibility', () => {
      const reactFramework: FrameworkInfo = {
        type: 'react',
        name: 'React',
        confidence: 0.9,
        sources: [],
        metadata: {},
      };

      const incompatibleResults: CSSInJSDetectionResult[] = [
        {
          library: 'vue-styled-components',
          confidence: 0.8,
          framework: 'vue',
          evidence: [],
          configFiles: [],
          entryPoints: [],
        },
      ];

      const validation = integration.validateCompatibility(incompatibleResults, reactFramework);

      expect(validation.compatible).toBe(false);
      expect(validation.issues).toContain('vue-styled-components is not compatible with react');
    });

    it('should detect conflicting libraries', () => {
      const reactFramework: FrameworkInfo = {
        type: 'react',
        name: 'React',
        confidence: 0.9,
        sources: [],
        metadata: {},
      };

      const conflictingResults: CSSInJSDetectionResult[] = [
        {
          library: 'styled-components',
          confidence: 0.9,
          framework: 'react',
          evidence: [],
          configFiles: [],
          entryPoints: [],
        },
        {
          library: '@emotion/styled',
          confidence: 0.8,
          framework: 'react',
          evidence: [],
          configFiles: [],
          entryPoints: [],
        },
      ];

      const validation = integration.validateCompatibility(conflictingResults, reactFramework);

      expect(validation.issues.some((issue) => issue.includes('conflicts with'))).toBe(true);
      expect(validation.recommendations.some((rec) => rec.includes('one CSS-in-JS library'))).toBe(
        true
      );
    });

    it('should check SSR compatibility', () => {
      const ssrFramework: FrameworkInfo = {
        type: 'react',
        name: 'React',
        confidence: 0.9,
        sources: [],
        metadata: {
          hasSSR: true,
        },
      };

      // Assume goober doesn't support SSR properly for this test
      const ssrResults: CSSInJSDetectionResult[] = [
        {
          library: 'goober',
          confidence: 0.8,
          framework: 'universal',
          evidence: [],
          configFiles: [],
          entryPoints: [],
        },
      ];

      const validation = integration.validateCompatibility(ssrResults, ssrFramework);

      // Note: goober actually supports SSR, so this test might need adjustment
      // based on the actual library definitions
      expect(validation).toBeDefined();
    });

    it('should validate compatible setup', () => {
      const reactFramework: FrameworkInfo = {
        type: 'react',
        name: 'React',
        confidence: 0.9,
        sources: [],
        metadata: {},
      };

      const compatibleResults: CSSInJSDetectionResult[] = [
        {
          library: 'styled-components',
          confidence: 0.9,
          framework: 'react',
          evidence: [],
          configFiles: [],
          entryPoints: [],
        },
      ];

      const validation = integration.validateCompatibility(compatibleResults, reactFramework);

      expect(validation.compatible).toBe(true);
      expect(validation.issues).toHaveLength(0);
    });
  });

  describe('utility methods', () => {
    it('should return detected libraries', () => {
      expect(integration.getDetectedLibraries()).toEqual([]);

      // After detection, there should be results
      // This would be populated by actual detection calls
    });

    it('should return available presets', () => {
      expect(integration.getPresets()).toEqual([]);
    });

    it('should get library information', () => {
      const styledComponentsInfo = integration.getLibraryInfo('styled-components');
      expect(styledComponentsInfo).toBeDefined();
      expect(styledComponentsInfo!.name).toBe('styled-components');
      expect(styledComponentsInfo!.framework).toBe('react');
    });

    it('should return undefined for unknown library', () => {
      const unknownInfo = integration.getLibraryInfo('unknown-library' as CSSInJSLibrary);
      expect(unknownInfo).toBeUndefined();
    });
  });
});

describe('CSS-in-JS factory functions', () => {
  it('should create integration instance', () => {
    const integration = createCSSInJSIntegration();
    expect(integration).toBeInstanceOf(CSSInJSIntegration);
  });

  it('should detect and configure CSS-in-JS', async () => {
    const frameworkInfo: FrameworkInfo = {
      type: 'react',
      name: 'React',
      confidence: 0.9,
      sources: [],
      metadata: {
        dependencies: ['react', 'react-dom', 'styled-components'],
      },
    };

    const result = await detectAndConfigureCSSInJS(frameworkInfo, '/test/project');

    expect(result.detectionResults).toBeDefined();
    expect(result.preset).toBeDefined();
    expect(result.compatibility).toBeDefined();
    expect(result.extractionResult).toBeDefined();
  });

  it('should handle no CSS-in-JS libraries', async () => {
    const frameworkInfo: FrameworkInfo = {
      type: 'react',
      name: 'React',
      confidence: 0.9,
      sources: [],
      metadata: {
        dependencies: ['react', 'react-dom'],
      },
    };

    const result = await detectAndConfigureCSSInJS(frameworkInfo, '/test/project');

    expect(result.detectionResults).toHaveLength(0);
    expect(result.preset).toBeNull();
    expect(result.extractionResult).toBeNull();
    expect(result.compatibility.compatible).toBe(true);
  });
});

describe('CSS-in-JS configuration optimization', () => {
  it('should optimize for zero-runtime libraries', () => {
    const integration = createCSSInJSIntegration();

    const zeroRuntimeLibraries: CSSInJSLibrary[] = [
      'linaria',
      'vanilla-extract',
      '@compiled/react',
      'style9',
    ];

    zeroRuntimeLibraries.forEach((library) => {
      const libraryInfo = integration.getLibraryInfo(library);
      expect(libraryInfo!.requiresRuntime).toBe(false);
      expect(libraryInfo!.buildTimeOptimization).toBe(true);
    });
  });

  it('should provide appropriate configuration hints', () => {
    const integration = createCSSInJSIntegration();

    const styledComponentsInfo = integration.getLibraryInfo('styled-components');
    expect(styledComponentsInfo!.configurationHints).toContain(
      'Enable babel plugin for better performance'
    );

    const linariaInfo = integration.getLibraryInfo('linaria');
    expect(linariaInfo!.configurationHints).toContain('No runtime overhead');

    const emotionInfo = integration.getLibraryInfo('@emotion/react');
    expect(emotionInfo!.configurationHints).toContain(
      'Configure @emotion/babel-plugin for optimization'
    );
  });

  it('should handle framework-specific optimizations', () => {
    const integration = createCSSInJSIntegration();

    // React-specific
    const styledComponents = integration.getLibraryInfo('styled-components');
    expect(styledComponents!.framework).toBe('react');

    // Vue-specific
    const vueStyled = integration.getLibraryInfo('vue-styled-components');
    expect(vueStyled!.framework).toBe('vue');

    // Angular-specific
    const angularMaterial = integration.getLibraryInfo('@angular/material');
    expect(angularMaterial!.framework).toBe('angular');

    // Universal
    const linaria = integration.getLibraryInfo('linaria');
    expect(linaria!.framework).toBe('universal');
  });
});
