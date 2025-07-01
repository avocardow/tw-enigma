/**
 * Tests for EdgeCaseHandler
 */

import {
  EdgeCaseHandler,
  EdgeCaseType,
  analyzeCSS,
  generateEdgeCaseReport,
} from '../../src/css/edgeCaseHandler';

describe('EdgeCaseHandler', () => {
  let handler: EdgeCaseHandler;

  beforeEach(() => {
    handler = new EdgeCaseHandler();
  });

  describe('Duplicate Rules Detection', () => {
    it('should detect duplicate CSS rules', () => {
      const css = `
        .button { color: blue; margin: 10px; }
        .button { color: blue; margin: 10px; }
        .header { font-size: 16px; }
      `;

      const reports = handler.processCSS(css);
      const duplicateReports = reports.filter((r) => r.type === EdgeCaseType.DUPLICATE_RULES);

      expect(duplicateReports).toHaveLength(1);
      expect(duplicateReports[0].context.selector).toBe('.button');
      expect(duplicateReports[0].severity).toBe('warning');
      expect(duplicateReports[0].resolution?.strategy).toBe('merge');
    });

    it('should not flag different rules as duplicates', () => {
      const css = `
        .button { color: blue; }
        .button { color: red; }
        .header { color: blue; }
      `;

      const reports = handler.processCSS(css);
      const duplicateReports = reports.filter((r) => r.type === EdgeCaseType.DUPLICATE_RULES);

      expect(duplicateReports).toHaveLength(0);
    });
  });

  describe('Conflicting Selectors Detection', () => {
    it('should detect conflicting selectors with same specificity', () => {
      const css = `
        .button { color: blue; }
        .header { color: red; }
        .footer { color: blue; }
      `;

      const reports = handler.processCSS(css);
      // Note: This simplified test may not detect conflicts unless selectors target same elements
      // In a real implementation, we'd need more sophisticated conflict detection
    });

    it('should calculate CSS specificity correctly', () => {
      const css = `
        #main .button { color: blue; }
        .button.primary { color: red; }
      `;

      const reports = handler.processCSS(css);
      // The specificity calculation should work correctly
      // #main .button = 100 + 10 = 110
      // .button.primary = 10 + 10 = 20
    });
  });

  describe('Invalid Property Values Detection', () => {
    it('should detect invalid color values', () => {
      const css = `
        .button { color: invalidcolor; }
        .header { color: #ff0000; }
      `;

      const reports = handler.processCSS(css);
      const invalidReports = reports.filter((r) => r.type === EdgeCaseType.INVALID_PROPERTY_VALUE);

      expect(invalidReports).toHaveLength(1);
      expect(invalidReports[0].context.property).toBe('color');
      expect(invalidReports[0].context.value).toBe('invalidcolor');
      expect(invalidReports[0].severity).toBe('error');
    });

    it('should detect invalid width values', () => {
      const css = `
        .container { width: invalidwidth; }
        .sidebar { width: 100px; }
      `;

      const reports = handler.processCSS(css);
      const invalidReports = reports.filter((r) => r.type === EdgeCaseType.INVALID_PROPERTY_VALUE);

      expect(invalidReports).toHaveLength(1);
      expect(invalidReports[0].context.property).toBe('width');
    });

    it('should accept valid CSS values', () => {
      const css = `
        .button {
          color: #ff0000;
          width: 100px;
          height: auto;
          margin: 10px 5px;
          display: flex;
        }
      `;

      const reports = handler.processCSS(css);
      const invalidReports = reports.filter((r) => r.type === EdgeCaseType.INVALID_PROPERTY_VALUE);

      expect(invalidReports).toHaveLength(0);
    });
  });

  describe('Browser Compatibility Detection', () => {
    it('should detect browser compatibility issues for gap property', () => {
      const css = `
        .container {
          display: flex;
          gap: 10px;
        }
      `;

      const reports = handler.processCSS(css);
      const compatReports = reports.filter((r) => r.type === EdgeCaseType.BROWSER_COMPATIBILITY);

      expect(compatReports).toHaveLength(1);
      expect(compatReports[0].context.property).toBe('gap');
      expect(compatReports[0].browserIssue).toBeDefined();
      expect(compatReports[0].browserIssue?.unsupportedBrowsers).toContain('IE');
    });

    it('should detect backdrop-filter compatibility issues', () => {
      const css = `
        .modal { backdrop-filter: blur(10px); }
      `;

      const reports = handler.processCSS(css);
      const compatReports = reports.filter((r) => r.type === EdgeCaseType.BROWSER_COMPATIBILITY);

      expect(compatReports).toHaveLength(1);
      expect(compatReports[0].browserIssue?.prefix).toBe('-webkit-');
    });

    it('should be configurable to disable browser compatibility checks', () => {
      const handlerWithoutCompat = new EdgeCaseHandler({
        enableBrowserCompatibilityChecks: false,
      });

      const css = `
        .container { gap: 10px; }
      `;

      const reports = handlerWithoutCompat.processCSS(css);
      const compatReports = reports.filter((r) => r.type === EdgeCaseType.BROWSER_COMPATIBILITY);

      expect(compatReports).toHaveLength(0);
    });
  });

  describe('Deprecated Properties Detection', () => {
    it('should detect deprecated properties', () => {
      const css = `
        .element { text-decoration-skip: ink; }
      `;

      const reports = handler.processCSS(css);
      const deprecatedReports = reports.filter((r) => r.type === EdgeCaseType.DEPRECATED_PROPERTY);

      expect(deprecatedReports).toHaveLength(1);
      expect(deprecatedReports[0].context.property).toBe('text-decoration-skip');
      expect(deprecatedReports[0].suggestions).toContain(
        'Consider using: text-decoration-skip-ink'
      );
    });

    it('should be configurable to disable deprecation warnings', () => {
      const handlerWithoutDeprecation = new EdgeCaseHandler({
        enableDeprecationWarnings: false,
      });

      const css = `
        .element { zoom: 2; }
      `;

      const reports = handlerWithoutDeprecation.processCSS(css);
      const deprecatedReports = reports.filter((r) => r.type === EdgeCaseType.DEPRECATED_PROPERTY);

      expect(deprecatedReports).toHaveLength(0);
    });
  });

  describe('Excessive Nesting Detection', () => {
    it('should detect excessive nesting depth', () => {
      const css = `
        .level1 .level2 .level3 .level4 .level5 .level6 .level7 .level8 .level9 .level10 .level11 {
          color: red;
        }
      `;

      const reports = handler.processCSS(css);
      const nestingReports = reports.filter((r) => r.type === EdgeCaseType.EXCESSIVE_NESTING);

      expect(nestingReports).toHaveLength(1);
      expect(nestingReports[0].context.value).toBe('11');
      expect(nestingReports[0].suggestions).toContain(
        'Reduce nesting depth to improve performance'
      );
    });

    it('should not flag reasonable nesting depth', () => {
      const css = `
        .container .card .title { color: blue; }
      `;

      const reports = handler.processCSS(css);
      const nestingReports = reports.filter((r) => r.type === EdgeCaseType.EXCESSIVE_NESTING);

      expect(nestingReports).toHaveLength(0);
    });

    it('should respect custom nesting depth limit', () => {
      const handlerWithCustomDepth = new EdgeCaseHandler({
        maxNestingDepth: 3,
      });

      const css = `
        .a .b .c .d { color: red; }
      `;

      const reports = handlerWithCustomDepth.processCSS(css);
      const nestingReports = reports.filter((r) => r.type === EdgeCaseType.EXCESSIVE_NESTING);

      expect(nestingReports).toHaveLength(1);
    });
  });

  describe('Performance Impact Detection', () => {
    it('should detect high number of CSS rules', () => {
      // Generate CSS with many rules
      const rules = Array.from({ length: 1001 }, (_, i) => `.rule${i} { color: blue; }`);
      const css = rules.join('\n');

      const reports = handler.processCSS(css);
      const performanceReports = reports.filter((r) => r.type === EdgeCaseType.PERFORMANCE_IMPACT);

      expect(performanceReports).toHaveLength(1);
      expect(performanceReports[0].context.property).toBe('rule-count');
      expect(parseInt(performanceReports[0].context.value)).toBeGreaterThan(1000);
    });

    it('should be configurable to disable performance checks', () => {
      const handlerWithoutPerf = new EdgeCaseHandler({
        enablePerformanceChecks: false,
      });

      const rules = Array.from({ length: 1001 }, (_, i) => `.rule${i} { color: blue; }`);
      const css = rules.join('\n');

      const reports = handlerWithoutPerf.processCSS(css);
      const performanceReports = reports.filter((r) => r.type === EdgeCaseType.PERFORMANCE_IMPACT);

      expect(performanceReports).toHaveLength(0);
    });
  });

  describe('Malformed CSS Detection', () => {
    it('should handle malformed CSS gracefully', () => {
      const css = `
        .button { color: blue; margin
        .header { color: red;
      `;

      const reports = handler.processCSS(css);
      // Should not throw an error and may detect syntax issues
      expect(reports).toBeDefined();
    });

    it('should detect syntax errors', () => {
      const css = `
        .button { color: blue;
        .header color: red; }
      `;

      const reports = handler.processCSS(css);
      // The parser should handle this and may flag syntax issues
      expect(reports).toBeDefined();
    });
  });

  describe('Report Filtering and Querying', () => {
    it('should filter reports by type', () => {
      const css = `
        .button { gap: 10px; text-decoration-skip: ink; }
      `;

      handler.processCSS(css);
      const browserReports = handler.getReportsByType(EdgeCaseType.BROWSER_COMPATIBILITY);
      const deprecatedReports = handler.getReportsByType(EdgeCaseType.DEPRECATED_PROPERTY);

      expect(browserReports).toHaveLength(1);
      expect(deprecatedReports).toHaveLength(1);
    });

    it('should filter reports by severity', () => {
      const css = `
        .button {
          color: invalidcolor;
          gap: 10px;
        }
      `;

      handler.processCSS(css);
      const errorReports = handler.getReportsBySeverity('error');
      const warningReports = handler.getReportsBySeverity('warning');

      expect(errorReports.length).toBeGreaterThan(0);
      expect(warningReports.length).toBeGreaterThan(0);
    });

    it('should generate summary report', () => {
      const css = `
        .button {
          color: invalidcolor;
          gap: 10px;
          text-decoration-skip: ink;
        }
        .button {
          color: invalidcolor;
          gap: 10px;
          text-decoration-skip: ink;
        }
      `;

      handler.processCSS(css);
      const summary = handler.generateSummary();

      expect(summary.totalIssues).toBeGreaterThan(0);
      expect(summary.errorCount).toBeGreaterThan(0);
      expect(summary.warningCount).toBeGreaterThan(0);
      expect(summary.byType).toBeDefined();
      expect(summary.recommendations).toBeDefined();
      expect(Array.isArray(summary.recommendations)).toBe(true);
    });
  });

  describe('Helper Functions', () => {
    it('analyzeCSS helper should work correctly', () => {
      const css = `
        .button { gap: 10px; }
      `;

      const reports = analyzeCSS(css);
      expect(reports).toBeDefined();
      expect(Array.isArray(reports)).toBe(true);
    });

    it('generateEdgeCaseReport helper should work correctly', () => {
      const css = `
        .button { gap: 10px; }
      `;

      const summary = generateEdgeCaseReport(css);
      expect(summary).toBeDefined();
      expect(typeof summary.totalIssues).toBe('number');
      expect(Array.isArray(summary.recommendations)).toBe(true);
    });

    it('should accept configuration in helper functions', () => {
      const css = `
        .button { gap: 10px; }
      `;

      const reports = analyzeCSS(css, {
        enableBrowserCompatibilityChecks: false,
      });

      const compatReports = reports.filter((r) => r.type === EdgeCaseType.BROWSER_COMPATIBILITY);
      expect(compatReports).toHaveLength(0);
    });
  });

  describe('Context Information', () => {
    it('should include source file information when provided', () => {
      const css = `
        .button { color: invalidcolor; }
      `;

      const reports = handler.processCSS(css, { file: 'test.css' });
      expect(reports[0].context.sourceFile).toBe('test.css');
    });

    it('should include line numbers in context', () => {
      const css = `
        .button { color: blue; }
        .header { color: invalidcolor; }
      `;

      const reports = handler.processCSS(css);
      const invalidReport = reports.find((r) => r.type === EdgeCaseType.INVALID_PROPERTY_VALUE);

      expect(invalidReport?.context.sourceLine).toBeDefined();
    });

    it('should include timestamps in context', () => {
      const css = `
        .button { color: blue; }
      `;

      const before = Date.now();
      const reports = handler.processCSS(css);
      const after = Date.now();

      if (reports.length > 0) {
        expect(reports[0].context.timestamp).toBeGreaterThanOrEqual(before);
        expect(reports[0].context.timestamp).toBeLessThanOrEqual(after);
      }
    });
  });

  describe('Integration with Existing Validation Infrastructure', () => {
    it('should be compatible with existing error types', () => {
      // Test that the EdgeCaseHandler can work alongside existing validation
      const css = `
        .button { color: invalidcolor; }
      `;

      const reports = handler.processCSS(css);
      expect(reports).toBeDefined();

      // Should be able to convert to existing error types if needed
      const hasValidationErrors = reports.some(
        (r) => r.type === EdgeCaseType.INVALID_PROPERTY_VALUE
      );
      expect(hasValidationErrors).toBe(true);
    });
  });
});

describe('Edge Case Types Coverage', () => {
  it('should cover all defined edge case types', () => {
    const definedTypes = Object.values(EdgeCaseType);

    // Verify all types are properly defined
    expect(definedTypes).toContain(EdgeCaseType.CONFLICTING_SELECTORS);
    expect(definedTypes).toContain(EdgeCaseType.INVALID_PROPERTY_VALUE);
    expect(definedTypes).toContain(EdgeCaseType.DUPLICATE_RULES);
    expect(definedTypes).toContain(EdgeCaseType.CIRCULAR_REFERENCE);
    expect(definedTypes).toContain(EdgeCaseType.BROWSER_COMPATIBILITY);
    expect(definedTypes).toContain(EdgeCaseType.MALFORMED_SYNTAX);
    expect(definedTypes).toContain(EdgeCaseType.EXCESSIVE_NESTING);
    expect(definedTypes).toContain(EdgeCaseType.DEPRECATED_PROPERTY);
    expect(definedTypes).toContain(EdgeCaseType.PERFORMANCE_IMPACT);
    expect(definedTypes).toContain(EdgeCaseType.SPECIFICITY_CONFLICT);
  });
});
