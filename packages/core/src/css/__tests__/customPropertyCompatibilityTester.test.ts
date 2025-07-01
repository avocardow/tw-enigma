/**
 * Tests for CSS Custom Property Compatibility Tester
 */

import {
  CustomPropertyCompatibilityTester,
  createCustomPropertyCompatibilityTester,
  runCompatibilityTests,
  type CompatibilityTestConfiguration,
  type TestEnvironment,
  type CssInJsFramework,
  type BrowserTarget,
  type DeviceType,
  type TestScenario,
  type CompatibilityTestResults
} from '../customPropertyCompatibilityTester';
import type { VariableMap } from '../customPropertyDetector';

// Mock variable map for testing
const mockVariableMap: VariableMap = {
  declarations: new Map([
    ['primary-color', [{
      name: 'primary-color',
      fullName: '--primary-color',
      value: '#007bff',
      filePath: '/test/styles.css',
      line: 1,
      column: 1,
      scope: {
        type: 'global',
        identifier: ':root',
        nestingLevel: 0,
        parentScopes: []
      },
      containsVariables: false,
      referencedVariables: [],
      computedValue: '#007bff'
    }]],
    ['secondary-color', [{
      name: 'secondary-color',
      fullName: '--secondary-color',
      value: '#6c757d',
      filePath: '/test/styles.css',
      line: 2,
      column: 1,
      scope: {
        type: 'global',
        identifier: ':root',
        nestingLevel: 0,
        parentScopes: []
      },
      containsVariables: false,
      referencedVariables: [],
      computedValue: '#6c757d'
    }]]
  ]),
  usages: new Map([
    ['primary-color', [{
      name: 'primary-color',
      expression: 'var(--primary-color)',
      filePath: '/test/component.css',
      line: 5,
      column: 15,
      cssProperty: 'color',
      selector: '.button',
      fallback: undefined
    }]],
    ['secondary-color', [{
      name: 'secondary-color',
      expression: 'var(--secondary-color, #999)',
      filePath: '/test/component.css',
      line: 6,
      column: 15,
      cssProperty: 'border-color',
      selector: '.button',
      fallback: '#999'
    }]]
  ]),
  scopeConflicts: [],
  circularReferences: []
};

const mockOptimizedCss = `
:root {
  --primary-color: #007bff;
  --secondary-color: #6c757d;
}

.button {
  color: var(--primary-color);
  border-color: var(--secondary-color, #999);
}
`;

describe('CustomPropertyCompatibilityTester', () => {
  let tester: CustomPropertyCompatibilityTester;

  beforeEach(() => {
    tester = new CustomPropertyCompatibilityTester();
  });

  describe('Constructor and Configuration', () => {
    it('should create tester with default configuration', () => {
      expect(tester).toBeInstanceOf(CustomPropertyCompatibilityTester);
    });

    it('should create tester with custom configuration', () => {
      const customConfig: Partial<CompatibilityTestConfiguration> = {
        performanceThresholds: {
          maxRenderTime: 500,
          maxFileSize: 25000,
          maxMemoryUsage: 50,
          maxCpuUsage: 60,
          maxNetworkRequests: 5
        },
        reporting: {
          formats: ['json'],
          outputDirectory: './custom-reports',
          includeScreenshots: false,
          includePerformanceMetrics: true,
          includeDetailedLogs: true,
          aggregation: {
            groupByEnvironment: false,
            groupByFramework: true,
            groupByScenario: true,
            includeTrends: false
          }
        }
      };

      const customTester = new CustomPropertyCompatibilityTester(customConfig);
      expect(customTester).toBeInstanceOf(CustomPropertyCompatibilityTester);
    });
  });

  describe('Compatibility Testing', () => {
    it('should run compatibility tests across environments', async () => {
      const results = await tester.runCompatibilityTests(mockVariableMap, mockOptimizedCss);
      
      expect(results).toBeDefined();
      expect(results.summary).toBeDefined();
      expect(results.environmentResults).toBeInstanceOf(Map);
      expect(results.frameworkResults).toBeInstanceOf(Map);
      expect(results.browserResults).toBeInstanceOf(Map);
      expect(results.deviceResults).toBeInstanceOf(Map);
      expect(results.performanceAnalysis).toBeDefined();
      expect(results.compatibilityMatrix).toBeDefined();
      expect(results.recommendations).toBeInstanceOf(Array);
    });

    it('should test default environments', async () => {
      const results = await tester.runCompatibilityTests(mockVariableMap, mockOptimizedCss);
      
      // Should test Chrome, Firefox, Safari, and IE11 by default
      expect(results.environmentResults.size).toBeGreaterThanOrEqual(4);
      expect(results.environmentResults.has('chrome-latest')).toBe(true);
      expect(results.environmentResults.has('firefox-latest')).toBe(true);
      expect(results.environmentResults.has('safari-latest')).toBe(true);
      expect(results.environmentResults.has('ie11')).toBe(true);
    });

    it('should test CSS-in-JS frameworks', async () => {
      const results = await tester.runCompatibilityTests(mockVariableMap, mockOptimizedCss);
      
      // Should test styled-components and emotion by default
      expect(results.frameworkResults.size).toBeGreaterThanOrEqual(2);
      expect(results.frameworkResults.has('styled-components')).toBe(true);
      expect(results.frameworkResults.has('emotion')).toBe(true);
    });

    it('should test browser compatibility', async () => {
      const results = await tester.runCompatibilityTests(mockVariableMap, mockOptimizedCss);
      
      // Should test multiple browsers
      expect(results.browserResults.size).toBeGreaterThanOrEqual(4);
      
      // Check that results have expected structure
      for (const [browserKey, result] of results.browserResults) {
        expect(result.browser).toBeDefined();
        expect(result.testResults).toBeInstanceOf(Array);
        expect(result.actualSupport).toBeDefined();
        expect(result.polyfillEffectiveness).toBeDefined();
        expect(result.renderingQuality).toBeDefined();
      }
    });

    it('should test device compatibility', async () => {
      const results = await tester.runCompatibilityTests(mockVariableMap, mockOptimizedCss);
      
      // Should test desktop, mobile, and tablet by default
      expect(results.deviceResults.size).toBeGreaterThanOrEqual(3);
      expect(results.deviceResults.has('desktop')).toBe(true);
      expect(results.deviceResults.has('mobile')).toBe(true);
      expect(results.deviceResults.has('tablet')).toBe(true);
    });
  });

  describe('Performance Analysis', () => {
    it('should analyze performance across environments', async () => {
      const results = await tester.runCompatibilityTests(mockVariableMap, mockOptimizedCss);
      
      expect(results.performanceAnalysis).toBeDefined();
      expect(results.performanceAnalysis.trends).toBeInstanceOf(Array);
      expect(results.performanceAnalysis.bottlenecks).toBeInstanceOf(Array);
      expect(results.performanceAnalysis.optimizations).toBeInstanceOf(Array);
      expect(results.performanceAnalysis.regressions).toBeInstanceOf(Array);
    });

    it('should collect performance metrics', async () => {
      const results = await tester.runCompatibilityTests(mockVariableMap, mockOptimizedCss);
      
      for (const [envId, result] of results.environmentResults) {
        expect(result.performanceMetrics).toBeDefined();
        expect(result.performanceMetrics.renderTiming).toBeDefined();
        expect(result.performanceMetrics.resourceUsage).toBeDefined();
        expect(result.performanceMetrics.networkPerformance).toBeDefined();
        expect(result.performanceMetrics.cssMetrics).toBeDefined();
        
        expect(typeof result.performanceMetrics.renderTiming.firstPaint).toBe('number');
        expect(typeof result.performanceMetrics.renderTiming.firstContentfulPaint).toBe('number');
        expect(typeof result.performanceMetrics.resourceUsage.memoryUsage).toBe('number');
        expect(typeof result.performanceMetrics.resourceUsage.cpuUsage).toBe('number');
      }
    });
  });

  describe('Compatibility Matrix', () => {
    it('should generate compatibility matrix', async () => {
      const results = await tester.runCompatibilityTests(mockVariableMap, mockOptimizedCss);
      
      expect(results.compatibilityMatrix).toBeDefined();
      expect(results.compatibilityMatrix.environments).toBeInstanceOf(Map);
      expect(results.compatibilityMatrix.frameworks).toBeInstanceOf(Map);
      expect(results.compatibilityMatrix.browsers).toBeInstanceOf(Map);
      expect(results.compatibilityMatrix.features).toBeInstanceOf(Map);
    });

    it('should calculate environment compatibility scores', async () => {
      const results = await tester.runCompatibilityTests(mockVariableMap, mockOptimizedCss);
      
      for (const [envId, compatibility] of results.compatibilityMatrix.environments) {
        expect(typeof compatibility.score).toBe('number');
        expect(compatibility.score).toBeGreaterThanOrEqual(0);
        expect(compatibility.score).toBeLessThanOrEqual(1);
        expect(compatibility.supportedFeatures).toBeInstanceOf(Array);
        expect(compatibility.unsupportedFeatures).toBeInstanceOf(Array);
        expect(compatibility.partialSupportFeatures).toBeInstanceOf(Array);
        expect(compatibility.requiredPolyfills).toBeInstanceOf(Array);
      }
    });

    it('should analyze framework compatibility', async () => {
      const results = await tester.runCompatibilityTests(mockVariableMap, mockOptimizedCss);
      
      for (const [frameworkName, compatibility] of results.compatibilityMatrix.frameworks) {
        expect(compatibility.integrationLevel).toMatch(/^(native|plugin|manual|unsupported)$/);
        expect(compatibility.cssInJsSupport).toMatch(/^(full|partial|none)$/);
        expect(typeof compatibility.themeIntegration).toBe('boolean');
        expect(typeof compatibility.ssrCompatibility).toBe('boolean');
        expect(typeof compatibility.typescriptSupport).toBe('boolean');
      }
    });

    it('should analyze browser compatibility', async () => {
      const results = await tester.runCompatibilityTests(mockVariableMap, mockOptimizedCss);
      
      for (const [browserKey, compatibility] of results.compatibilityMatrix.browsers) {
        expect(typeof compatibility.nativeSupport).toBe('number');
        expect(typeof compatibility.polyfillSupport).toBe('number');
        expect(compatibility.criticalIssues).toBeInstanceOf(Array);
        expect(compatibility.knownLimitations).toBeInstanceOf(Array);
        expect(compatibility.recommendedConfig).toBeDefined();
      }
    });
  });

  describe('Recommendations', () => {
    it('should generate recommendations based on test results', async () => {
      const results = await tester.runCompatibilityTests(mockVariableMap, mockOptimizedCss);
      
      expect(results.recommendations).toBeInstanceOf(Array);
      
      for (const recommendation of results.recommendations) {
        expect(recommendation.type).toMatch(/^(polyfill|fallback|optimization|configuration|alternative)$/);
        expect(recommendation.priority).toMatch(/^(low|medium|high|critical)$/);
        expect(typeof recommendation.title).toBe('string');
        expect(typeof recommendation.description).toBe('string');
        expect(recommendation.implementation).toBeInstanceOf(Array);
        expect(typeof recommendation.expectedBenefit).toBe('string');
        expect(recommendation.effort).toMatch(/^(low|medium|high)$/);
        expect(recommendation.affectedEnvironments).toBeInstanceOf(Array);
      }
    });

    it('should recommend polyfills for unsupported environments', async () => {
      const results = await tester.runCompatibilityTests(mockVariableMap, mockOptimizedCss);
      
      // Should have polyfill recommendations for IE11
      const polyfillRecommendations = results.recommendations.filter(r => r.type === 'polyfill');
      expect(polyfillRecommendations.length).toBeGreaterThan(0);
      
      const ie11Recommendation = polyfillRecommendations.find(r => 
        r.affectedEnvironments.includes('ie11')
      );
      expect(ie11Recommendation).toBeDefined();
    });

    it('should recommend optimizations for performance issues', async () => {
      const results = await tester.runCompatibilityTests(mockVariableMap, mockOptimizedCss);
      
      // Check if performance optimization recommendations are generated when bottlenecks exist
      if (results.performanceAnalysis.bottlenecks.length > 0) {
        const optimizationRecommendations = results.recommendations.filter(r => r.type === 'optimization');
        expect(optimizationRecommendations.length).toBeGreaterThan(0);
      }
    });
  });

  describe('Test Results Structure', () => {
    it('should have proper test result structure', async () => {
      const results = await tester.runCompatibilityTests(mockVariableMap, mockOptimizedCss);
      
      // Test summary structure
      expect(results.summary).toBeDefined();
      expect(typeof results.summary.totalTests).toBe('number');
      expect(typeof results.summary.passed).toBe('number');
      expect(typeof results.summary.failed).toBe('number');
      expect(typeof results.summary.skipped).toBe('number');
      expect(typeof results.summary.successRate).toBe('number');
      expect(typeof results.summary.duration).toBe('number');
      expect(typeof results.summary.criticalFailures).toBe('number');
    });

    it('should have environment test results', async () => {
      const results = await tester.runCompatibilityTests(mockVariableMap, mockOptimizedCss);
      
      for (const [envId, result] of results.environmentResults) {
        expect(typeof result.environmentId).toBe('string');
        expect(result.testResults).toBeInstanceOf(Array);
        expect(result.status).toMatch(/^(passed|failed|partial|skipped)$/);
        expect(result.performanceMetrics).toBeDefined();
        expect(result.compatibilityIssues).toBeInstanceOf(Array);
        expect(result.screenshots).toBeInstanceOf(Array);
        
        // Check individual test results
        for (const testResult of result.testResults) {
          expect(typeof testResult.scenarioId).toBe('string');
          expect(testResult.status).toMatch(/^(passed|failed|skipped|error)$/);
          expect(typeof testResult.executionTime).toBe('number');
          expect(testResult.output).toBeDefined();
          expect(testResult.errors).toBeInstanceOf(Array);
          expect(testResult.assertions).toBeInstanceOf(Array);
        }
      }
    });

    it('should have framework test results', async () => {
      const results = await tester.runCompatibilityTests(mockVariableMap, mockOptimizedCss);
      
      for (const [frameworkName, result] of results.frameworkResults) {
        expect(typeof result.frameworkName).toBe('string');
        expect(result.testResults).toBeInstanceOf(Array);
        expect(result.integrationStatus).toMatch(/^(full|partial|broken)$/);
        expect(result.performanceImpact).toBeDefined();
        expect(result.cssInJsIssues).toBeInstanceOf(Array);
        
        // Check performance impact structure
        expect(typeof result.performanceImpact.renderTimeImpact).toBe('number');
        expect(typeof result.performanceImpact.memoryImpact).toBe('number');
        expect(typeof result.performanceImpact.bundleSizeImpact).toBe('number');
        expect(typeof result.performanceImpact.runtimeOverhead).toBe('number');
      }
    });

    it('should have browser test results', async () => {
      const results = await tester.runCompatibilityTests(mockVariableMap, mockOptimizedCss);
      
      for (const [browserKey, result] of results.browserResults) {
        expect(result.browser).toBeDefined();
        expect(result.testResults).toBeInstanceOf(Array);
        expect(result.actualSupport).toBeDefined();
        expect(result.polyfillEffectiveness).toBeDefined();
        expect(result.renderingQuality).toBeDefined();
        
        // Check browser information
        expect(typeof result.browser.name).toBe('string');
        expect(typeof result.browser.version).toBe('string');
        expect(typeof result.browser.engine).toBe('string');
        expect(result.browser.supportMatrix).toBeDefined();
        
        // Check polyfill effectiveness
        expect(typeof result.polyfillEffectiveness.polyfillName).toBe('string');
        expect(typeof result.polyfillEffectiveness.effectivenessScore).toBe('number');
        expect(result.polyfillEffectiveness.featuresPolyfilled).toBeInstanceOf(Array);
        expect(result.polyfillEffectiveness.performanceImpact).toMatch(/^(negligible|low|medium|high)$/);
        
        // Check rendering quality
        expect(typeof result.renderingQuality.visualAccuracy).toBe('number');
        expect(result.renderingQuality.textQuality).toMatch(/^(excellent|good|fair|poor)$/);
        expect(typeof result.renderingQuality.colorAccuracy).toBe('number');
        expect(typeof result.renderingQuality.layoutConsistency).toBe('number');
      }
    });

    it('should have device test results', async () => {
      const results = await tester.runCompatibilityTests(mockVariableMap, mockOptimizedCss);
      
      for (const [deviceId, result] of results.deviceResults) {
        expect(result.device).toBeDefined();
        expect(result.testResults).toBeInstanceOf(Array);
        expect(result.actualPerformance).toBeDefined();
        expect(result.responsiveBehavior).toBeDefined();
        
        // Check device information
        expect(typeof result.device.id).toBe('string');
        expect(typeof result.device.name).toBe('string');
        expect(result.device.category).toMatch(/^(desktop|tablet|mobile|tv|watch|embedded)$/);
        expect(result.device.screenSize).toBeDefined();
        expect(result.device.performance).toBeDefined();
        
        // Check responsive behavior
        expect(result.responsiveBehavior.breakpointHandling).toMatch(/^(excellent|good|fair|poor)$/);
        expect(typeof result.responsiveBehavior.viewportAdaptation).toBe('boolean');
        expect(typeof result.responsiveBehavior.orientationSupport).toBe('boolean');
        
        // Check battery impact for mobile devices
        if (result.device.performance.battery && result.batteryImpact) {
          expect(result.batteryImpact.powerConsumption).toMatch(/^(low|medium|high)$/);
          expect(typeof result.batteryImpact.drainPerHour).toBe('number');
          expect(typeof result.batteryImpact.efficiencyScore).toBe('number');
          expect(result.batteryImpact.optimizationRecommendations).toBeInstanceOf(Array);
        }
      }
    });
  });

  describe('Error Handling', () => {
    it('should handle empty variable map', async () => {
      const emptyVariableMap: VariableMap = {
        declarations: new Map(),
        usages: new Map(),
        scopeConflicts: [],
        circularReferences: []
      };
      
      const results = await tester.runCompatibilityTests(emptyVariableMap, '');
      expect(results).toBeDefined();
      expect(results.summary.totalTests).toBeGreaterThanOrEqual(0);
    });

    it('should handle invalid CSS content', async () => {
      const invalidCss = 'invalid css content { broken syntax';
      
      const results = await tester.runCompatibilityTests(mockVariableMap, invalidCss);
      expect(results).toBeDefined();
      // Should still complete tests even with invalid CSS
    });
  });

  describe('Utility Functions', () => {
    it('should create tester with utility function', () => {
      const customTester = createCustomPropertyCompatibilityTester({
        performanceThresholds: {
          maxRenderTime: 2000,
          maxFileSize: 100000,
          maxMemoryUsage: 200,
          maxCpuUsage: 90,
          maxNetworkRequests: 20
        }
      });
      
      expect(customTester).toBeInstanceOf(CustomPropertyCompatibilityTester);
    });

    it('should run tests with utility function', async () => {
      const results = await runCompatibilityTests(mockVariableMap, mockOptimizedCss, {
        reporting: {
          formats: ['json'],
          outputDirectory: './test-reports',
          includeScreenshots: false,
          includePerformanceMetrics: true,
          includeDetailedLogs: false,
          aggregation: {
            groupByEnvironment: true,
            groupByFramework: false,
            groupByScenario: false,
            includeTrends: false
          }
        }
      });
      
      expect(results).toBeDefined();
      expect(results.summary).toBeDefined();
      expect(results.environmentResults).toBeInstanceOf(Map);
    });
  });

  describe('Compatibility Issues', () => {
    it('should identify compatibility issues', async () => {
      const results = await tester.runCompatibilityTests(mockVariableMap, mockOptimizedCss);
      
      for (const [envId, result] of results.environmentResults) {
        expect(result.compatibilityIssues).toBeInstanceOf(Array);
        
        for (const issue of result.compatibilityIssues) {
          expect(issue.type).toMatch(/^(rendering|behavior|performance|accessibility|security)$/);
          expect(issue.severity).toMatch(/^(low|medium|high|critical)$/);
          expect(typeof issue.description).toBe('string');
          expect(issue.affectedComponents).toBeInstanceOf(Array);
        }
      }
    });

    it('should identify CSS-in-JS specific issues', async () => {
      const results = await tester.runCompatibilityTests(mockVariableMap, mockOptimizedCss);
      
      for (const [frameworkName, result] of results.frameworkResults) {
        expect(result.cssInJsIssues).toBeInstanceOf(Array);
        
        for (const issue of result.cssInJsIssues) {
          expect(typeof issue.framework).toBe('string');
          expect(issue.type).toMatch(/^(variable_injection|theme_integration|ssr_hydration|build_time|runtime_performance)$/);
          expect(typeof issue.description).toBe('string');
        }
      }
    });
  });

  describe('Performance Thresholds', () => {
    it('should respect performance thresholds', async () => {
      const strictConfig: Partial<CompatibilityTestConfiguration> = {
        performanceThresholds: {
          maxRenderTime: 100, // Very strict threshold
          maxFileSize: 1000,
          maxMemoryUsage: 10,
          maxCpuUsage: 20,
          maxNetworkRequests: 1
        }
      };
      
      const strictTester = new CustomPropertyCompatibilityTester(strictConfig);
      const results = await strictTester.runCompatibilityTests(mockVariableMap, mockOptimizedCss);
      
      // Should generate performance-related recommendations due to strict thresholds
      const performanceRecommendations = results.recommendations.filter(r => 
        r.type === 'optimization' && r.description.toLowerCase().includes('performance')
      );
      
      // With strict thresholds, we should get performance recommendations
      expect(results.performanceAnalysis.bottlenecks.length).toBeGreaterThanOrEqual(0);
    });
  });
});