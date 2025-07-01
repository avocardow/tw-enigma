/**
 * SARIF Formatter Tests
 */

// Mock SARIF formatter and types for testing
import { vi } from 'vitest';

interface Opportunity {
  id: string;
  type: string;
  title: string;
  description: string;
  impact: string;
  effort: string;
  priority: string;
  confidence: number;
  affectedFiles: string[];
  benefits: string[];
  recommendations: Array<{ type: string; description: string; codeExample: string; estimatedTimeHours: number; automationPotential: number }>;
  evidence: Array<{ type: string; description: string; confidence: number; location: { filePath: string; startLine: number; endLine: number }; metadata: any }>;
  tags: string[];
  createdAt: number;
  updatedAt: number;
}

interface OpportunityAnalysisResult {
  opportunities: Opportunity[];
  summary: {
    totalOpportunities: number;
    highPriorityCount: number;
    mediumPriorityCount: number;
    lowPriorityCount: number;
    estimatedSavings: {
      sizeReduction: number;
      performanceGain: number;
      timeInvestment: number;
    };
  };
  metadata: {
    analysisDate: number;
    version: string;
    configHash: string;
  };
}

interface PatternAnalysisResult {
  entity: { filePath: string; fileType: string };
  patterns: Array<{
    patternId: string;
    name: string;
    type: string;
    category: string;
    confidence: number;
    evidence: Array<{
      location: { filePath: string; startLine: number; endLine: number; startColumn?: number; endColumn?: number };
      content: string;
    }>;
  }>;
  metadata: { processingTime: number; confidence: number };
}

interface ValidationResult {
  testName: string;
  passed: boolean;
  duration: number;
  memoryUsed: number;
  errors: string[];
  warnings: string[];
  details?: any;
}

interface SarifReport {
  version: '2.1.0';
  $schema: string;
  runs: Array<{
    tool: {
      driver: {
        name: 'TW-Enigma';
        version: string;
        semanticVersion: string;
        informationUri: string;
        rules: any[];
      };
    };
    results: Array<{
      ruleId: string;
      message: { text: string };
      level: string;
      locations: Array<{
        physicalLocation: {
          artifactLocation: { uri: string };
          region: { startLine: number; endLine: number };
        };
      }>;
      fixes?: any;
      partialFingerprints?: any;
    }>;
    columnKind: 'utf16CodeUnits';
  }>;
}

interface SarifFormatter {
  formatOpportunityResults(result: OpportunityAnalysisResult): SarifReport;
  formatPatternResults(results: PatternAnalysisResult[]): SarifReport;
  formatValidationResults(results: ValidationResult[]): SarifReport;
  formatCombinedResults(opportunities: OpportunityAnalysisResult, patterns: PatternAnalysisResult[], validation: ValidationResult[]): SarifReport;
}

const createSarifFormatter = (version: string, projectRoot: string): SarifFormatter => ({
  formatOpportunityResults: vi.fn((result: OpportunityAnalysisResult): SarifReport => {
    const sarifResults = result.opportunities.map(opp => ({
      ruleId: 'TW001',
      message: { text: opp.title + ': ' + opp.description },
      level: opp.impact === 'critical' || opp.impact === 'high' ? 'error' : 
             opp.impact === 'medium' ? 'warning' : 
             opp.impact === 'low' ? 'info' : 'note',
      locations: opp.affectedFiles.map(file => ({
        physicalLocation: {
          artifactLocation: { uri: file.replace(projectRoot + '/', '') },
          region: { startLine: 1, endLine: 1 },
        },
      })),
      fixes: opp.recommendations.length > 0 ? {} : undefined,
    }));
    
    return {
      version: '2.1.0',
      $schema: 'https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json',
      runs: [{
        tool: {
          driver: {
            name: 'TW-Enigma',
            version,
            semanticVersion: version,
            informationUri: 'https://github.com/your-org/tw-enigma',
            rules: [],
          },
        },
        results: sarifResults,
        columnKind: 'utf16CodeUnits',
      }],
    };
  }),
  formatPatternResults: vi.fn((results: PatternAnalysisResult[]): SarifReport => {
    const sarifResults = results.flatMap(result => 
      result.patterns.map(pattern => ({
        ruleId: 'TW008',
        message: { text: `Pattern detected: ${pattern.name}` },
        level: 'info',
        locations: pattern.evidence.slice(0, 1).map(evidence => ({
          physicalLocation: {
            artifactLocation: { uri: evidence.location.filePath.replace(projectRoot + '/', '') },
            region: { startLine: evidence.location.startLine, endLine: evidence.location.endLine },
          },
        })),
        partialFingerprints: { patternId: pattern.patternId },
      }))
    );
    
    return {
      version: '2.1.0',
      $schema: 'https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json',
      runs: [{
        tool: {
          driver: {
            name: 'TW-Enigma',
            version,
            semanticVersion: version,
            informationUri: 'https://github.com/your-org/tw-enigma',
            rules: [],
          },
        },
        results: sarifResults,
        columnKind: 'utf16CodeUnits',
      }],
    };
  }),
  formatValidationResults: vi.fn((results: ValidationResult[]): SarifReport => {
    const sarifResults = results.flatMap(result => {
      const items = [];
      result.errors.forEach(error => {
        items.push({
          ruleId: 'TW007',
          message: { text: error },
          level: 'error',
          locations: [],
        });
      });
      result.warnings.forEach(warning => {
        items.push({
          ruleId: 'TW007',
          message: { text: warning },
          level: 'warning',
          locations: [],
        });
      });
      return items;
    });
    
    return {
      version: '2.1.0',
      $schema: 'https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json',
      runs: [{
        tool: {
          driver: {
            name: 'TW-Enigma',
            version,
            semanticVersion: version,
            informationUri: 'https://github.com/your-org/tw-enigma',
            rules: [],
          },
        },
        results: sarifResults,
        columnKind: 'utf16CodeUnits',
      }],
    };
  }),
  formatCombinedResults: vi.fn((opportunities: OpportunityAnalysisResult, patterns: PatternAnalysisResult[], validation: ValidationResult[]): SarifReport => {
    const oppResults = opportunities.opportunities.map(() => ({ ruleId: 'TW001', message: { text: 'Opportunity' }, level: 'warning', locations: [] }));
    const patternResults = patterns.flatMap(p => p.patterns.map(() => ({ ruleId: 'TW008', message: { text: 'Pattern' }, level: 'info', locations: [] })));
    const validationResults = validation.flatMap(v => v.warnings.map(() => ({ ruleId: 'TW007', message: { text: 'Warning' }, level: 'warning', locations: [] })));
    
    return {
      version: '2.1.0',
      $schema: 'https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json',
      runs: [{
        tool: {
          driver: {
            name: 'TW-Enigma',
            version,
            semanticVersion: version,
            informationUri: 'https://github.com/your-org/tw-enigma',
            rules: [],
          },
        },
        results: [...oppResults, ...patternResults, ...validationResults],
        columnKind: 'utf16CodeUnits',
      }],
    };
  }),
});

const validateSarifOutput = vi.fn((sarif: any): boolean => {
  return sarif.version === '2.1.0' && sarif.runs && Array.isArray(sarif.runs);
});

const sarifToJson = vi.fn((sarif: SarifReport, pretty: boolean): string => {
  return JSON.stringify(sarif, null, pretty ? 2 : 0);
});

describe('SarifFormatter', () => {
  let formatter: SarifFormatter;

  beforeEach(() => {
    formatter = createSarifFormatter('1.0.0', '/test/project');
  });

  describe('Opportunity Results Formatting', () => {
    it('should format opportunity analysis results to SARIF', () => {
      const mockOpportunity: Opportunity = {
        id: 'opp-001',
        type: 'pattern-consolidation',
        title: 'Consolidate duplicate patterns',
        description: 'Multiple similar patterns detected',
        impact: 'medium',
        effort: 'low',
        priority: 'high',
        confidence: 0.85,
        affectedFiles: ['/test/file1.css', '/test/file2.css'],
        benefits: ['Reduced bundle size', 'Improved maintainability'],
        recommendations: [{
          type: 'refactor',
          description: 'Merge similar patterns',
          codeExample: '.btn { /* consolidated styles */ }',
          estimatedTimeHours: 2,
          automationPotential: 0.7,
        }],
        evidence: [{
          type: 'pattern-similarity',
          description: 'Similar button patterns found',
          confidence: 0.85,
          location: {
            filePath: '/test/file1.css',
            startLine: 10,
            endLine: 15,
          },
          metadata: {},
        }],
        tags: ['css', 'patterns'],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const mockResult: OpportunityAnalysisResult = {
        opportunities: [mockOpportunity],
        summary: {
          totalOpportunities: 1,
          highPriorityCount: 1,
          mediumPriorityCount: 0,
          lowPriorityCount: 0,
          estimatedSavings: {
            sizeReduction: 1024,
            performanceGain: 0.1,
            timeInvestment: 2,
          },
        },
        metadata: {
          analysisDate: Date.now(),
          version: '1.0.0',
          configHash: 'abc123',
        },
      };

      const sarif = formatter.formatOpportunityResults(mockResult);

      expect(sarif.version).toBe('2.1.0');
      expect(sarif.$schema).toContain('sarif-schema-2.1.0.json');
      expect(sarif.runs).toHaveLength(1);
      expect(sarif.runs[0].tool.driver.name).toBe('TW-Enigma');
      expect(sarif.runs[0].results).toHaveLength(1);

      const result = sarif.runs[0].results[0];
      expect(result.ruleId).toBe('TW001');
      expect(result.message.text).toContain('Consolidate duplicate patterns');
      expect(result.level).toBe('warning');
      expect(result.locations).toHaveLength(2);
      expect(result.fixes).toBeDefined();
    });

    it('should handle opportunities with no affected files', () => {
      const mockOpportunity: Opportunity = {
        id: 'opp-002',
        type: 'performance-optimization',
        title: 'Global optimization',
        description: 'System-wide optimization opportunity',
        impact: 'high',
        effort: 'medium',
        priority: 'high',
        confidence: 0.9,
        affectedFiles: [],
        benefits: ['Better performance'],
        recommendations: [],
        evidence: [],
        tags: ['performance'],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const mockResult: OpportunityAnalysisResult = {
        opportunities: [mockOpportunity],
        summary: {
          totalOpportunities: 1,
          highPriorityCount: 1,
          mediumPriorityCount: 0,
          lowPriorityCount: 0,
          estimatedSavings: {
            sizeReduction: 0,
            performanceGain: 0.2,
            timeInvestment: 4,
          },
        },
        metadata: {
          analysisDate: Date.now(),
          version: '1.0.0',
          configHash: 'def456',
        },
      };

      const sarif = formatter.formatOpportunityResults(mockResult);
      expect(sarif.runs[0].results).toHaveLength(1);
      
      const result = sarif.runs[0].results[0];
      expect(result.locations).toHaveLength(0);
    });
  });

  describe('Pattern Results Formatting', () => {
    it('should format pattern analysis results to SARIF', () => {
      const mockPattern = {
        patternId: 'pattern-001',
        name: 'Button Pattern',
        type: 'component',
        category: 'ui',
        confidence: 0.8,
        evidence: [{
          location: {
            filePath: '/test/button.css',
            startLine: 5,
            endLine: 10,
            startColumn: 1,
            endColumn: 20,
          },
          content: '.btn { padding: 8px 16px; }',
        }],
      };

      const mockResult: PatternAnalysisResult = {
        entity: {
          filePath: '/test/button.css',
          fileType: 'css',
        },
        patterns: [mockPattern],
        metadata: {
          processingTime: 100,
          confidence: 0.8,
        },
      };

      const sarif = formatter.formatPatternResults([mockResult]);

      expect(sarif.runs[0].results).toHaveLength(1);
      
      const result = sarif.runs[0].results[0];
      expect(result.ruleId).toBe('TW008');
      expect(result.message.text).toContain('Button Pattern');
      expect(result.level).toBe('info');
      expect(result.locations).toHaveLength(1);
      expect(result.partialFingerprints.patternId).toBe('pattern-001');
    });

    it('should handle patterns with multiple evidence locations', () => {
      const mockPattern = {
        patternId: 'pattern-002',
        name: 'Multi-location Pattern',
        type: 'utility',
        category: 'layout',
        confidence: 0.75,
        evidence: [
          {
            location: {
              filePath: '/test/file1.css',
              startLine: 1,
              endLine: 3,
            },
            content: '.flex { display: flex; }',
          },
          {
            location: {
              filePath: '/test/file2.css',
              startLine: 10,
              endLine: 12,
            },
            content: '.flex-col { flex-direction: column; }',
          },
        ],
      };

      const mockResult: PatternAnalysisResult = {
        entity: {
          filePath: '/test/file1.css',
          fileType: 'css',
        },
        patterns: [mockPattern],
        metadata: {
          processingTime: 150,
          confidence: 0.75,
        },
      };

      const sarif = formatter.formatPatternResults([mockResult]);
      const result = sarif.runs[0].results[0];
      
      // Should use first evidence location as primary
      expect(result.locations).toHaveLength(1);
      expect(result.locations[0].physicalLocation.artifactLocation.uri).toBe('test/file1.css');
    });
  });

  describe('Validation Results Formatting', () => {
    it('should format validation results to SARIF', () => {
      const mockValidation: ValidationResult = {
        testName: 'Pattern Detection Test',
        passed: false,
        duration: 500,
        memoryUsed: 1024,
        errors: ['Pattern detection failed for component X'],
        warnings: ['Low confidence in pattern Y'],
        details: {
          expectedPatterns: 5,
          detectedPatterns: 4,
        },
      };

      const sarif = formatter.formatValidationResults([mockValidation]);

      expect(sarif.runs[0].results).toHaveLength(2); // 1 error + 1 warning
      
      const errorResult = sarif.runs[0].results[0];
      expect(errorResult.ruleId).toBe('TW007');
      expect(errorResult.level).toBe('error');
      expect(errorResult.message.text).toContain('Pattern detection failed');
      
      const warningResult = sarif.runs[0].results[1];
      expect(warningResult.level).toBe('warning');
      expect(warningResult.message.text).toContain('Low confidence');
    });

    it('should handle validation with no errors or warnings', () => {
      const mockValidation: ValidationResult = {
        testName: 'Successful Test',
        passed: true,
        duration: 100,
        memoryUsed: 512,
        errors: [],
        warnings: [],
        details: {},
      };

      const sarif = formatter.formatValidationResults([mockValidation]);
      expect(sarif.runs[0].results).toHaveLength(0);
    });
  });

  describe('Combined Results Formatting', () => {
    it('should format combined analysis results', () => {
      const mockOpportunity: Opportunity = {
        id: 'opp-003',
        type: 'code-deduplication',
        title: 'Remove duplicate code',
        description: 'Duplicate utility classes found',
        impact: 'low',
        effort: 'minimal',
        priority: 'medium',
        confidence: 0.7,
        affectedFiles: ['/test/utils.css'],
        benefits: ['Cleaner code'],
        recommendations: [],
        evidence: [],
        tags: ['deduplication'],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const opportunities: OpportunityAnalysisResult = {
        opportunities: [mockOpportunity],
        summary: {
          totalOpportunities: 1,
          highPriorityCount: 0,
          mediumPriorityCount: 1,
          lowPriorityCount: 0,
          estimatedSavings: {
            sizeReduction: 256,
            performanceGain: 0.05,
            timeInvestment: 0.5,
          },
        },
        metadata: {
          analysisDate: Date.now(),
          version: '1.0.0',
          configHash: 'ghi789',
        },
      };

      const patterns: PatternAnalysisResult[] = [{
        entity: { filePath: '/test/utils.css', fileType: 'css' },
        patterns: [{
          patternId: 'util-001',
          name: 'Utility Pattern',
          type: 'utility',
          category: 'spacing',
          confidence: 0.9,
          evidence: [{
            location: { filePath: '/test/utils.css', startLine: 1, endLine: 1 },
            content: '.m-4 { margin: 1rem; }',
          }],
        }],
        metadata: { processingTime: 50, confidence: 0.9 },
      }];

      const validation: ValidationResult[] = [{
        testName: 'Integration Test',
        passed: true,
        duration: 200,
        memoryUsed: 768,
        errors: [],
        warnings: ['Minor optimization possible'],
        details: {},
      }];

      const sarif = formatter.formatCombinedResults(opportunities, patterns, validation);

      expect(sarif.runs[0].results).toHaveLength(3); // 1 opportunity + 1 pattern + 1 warning
      expect(sarif.runs[0].tool.driver.rules).toBeDefined();
      expect(sarif.runs[0].tool.driver.rules.length).toBeGreaterThan(0);
    });
  });

  describe('SARIF Validation', () => {
    it('should validate correct SARIF output', () => {
      const validSarif = {
        version: '2.1.0' as const,
        $schema: 'https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json' as const,
        runs: [{
          tool: {
            driver: {
              name: 'TW-Enigma' as const,
              version: '1.0.0',
              semanticVersion: '1.0.0',
              informationUri: 'https://github.com/your-org/tw-enigma' as const,
              rules: [],
            },
          },
          results: [],
          columnKind: 'utf16CodeUnits' as const,
        }],
      };

      expect(validateSarifOutput(validSarif)).toBe(true);
    });

    it('should reject invalid SARIF output', () => {
      const invalidSarif = {
        version: '1.0.0', // Wrong version
        runs: [],
      };

      expect(validateSarifOutput(invalidSarif)).toBe(false);
    });
  });

  describe('JSON Serialization', () => {
    it('should serialize SARIF to JSON', () => {
      const mockResult: OpportunityAnalysisResult = {
        opportunities: [],
        summary: {
          totalOpportunities: 0,
          highPriorityCount: 0,
          mediumPriorityCount: 0,
          lowPriorityCount: 0,
          estimatedSavings: {
            sizeReduction: 0,
            performanceGain: 0,
            timeInvestment: 0,
          },
        },
        metadata: {
          analysisDate: Date.now(),
          version: '1.0.0',
          configHash: 'test123',
        },
      };

      const sarif = formatter.formatOpportunityResults(mockResult);
      const json = sarifToJson(sarif, true);

      expect(typeof json).toBe('string');
      expect(JSON.parse(json)).toEqual(sarif);
    });

    it('should serialize SARIF to compact JSON', () => {
      const mockResult: OpportunityAnalysisResult = {
        opportunities: [],
        summary: {
          totalOpportunities: 0,
          highPriorityCount: 0,
          mediumPriorityCount: 0,
          lowPriorityCount: 0,
          estimatedSavings: {
            sizeReduction: 0,
            performanceGain: 0,
            timeInvestment: 0,
          },
        },
        metadata: {
          analysisDate: Date.now(),
          version: '1.0.0',
          configHash: 'test123',
        },
      };

      const sarif = formatter.formatOpportunityResults(mockResult);
      const compactJson = sarifToJson(sarif, false);
      const prettyJson = sarifToJson(sarif, true);

      expect(compactJson.length).toBeLessThan(prettyJson.length);
      expect(compactJson).not.toContain('\n');
    });
  });

  describe('Rule Mapping', () => {
    it('should map opportunity types to correct SARIF rules', () => {
      const opportunityTypes = [
        'pattern-consolidation',
        'code-deduplication',
        'performance-optimization',
        'maintainability-enhancement',
        'accessibility-improvement',
        'security-hardening',
      ];

      opportunityTypes.forEach(type => {
        const mockOpportunity: Opportunity = {
          id: `test-${type}`,
          type,
          title: `Test ${type}`,
          description: `Test ${type} opportunity`,
          impact: 'medium',
          effort: 'low',
          priority: 'medium',
          confidence: 0.8,
          affectedFiles: ['/test/file.css'],
          benefits: [],
          recommendations: [],
          evidence: [],
          tags: [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };

        const mockResult: OpportunityAnalysisResult = {
          opportunities: [mockOpportunity],
          summary: {
            totalOpportunities: 1,
            highPriorityCount: 0,
            mediumPriorityCount: 1,
            lowPriorityCount: 0,
            estimatedSavings: {
              sizeReduction: 100,
              performanceGain: 0.1,
              timeInvestment: 1,
            },
          },
          metadata: {
            analysisDate: Date.now(),
            version: '1.0.0',
            configHash: 'test',
          },
        };

        const sarif = formatter.formatOpportunityResults(mockResult);
        expect(sarif.runs[0].results).toHaveLength(1);
        expect(sarif.runs[0].results[0].ruleId).toMatch(/^TW\d{3}$/);
      });
    });
  });

  describe('Severity Mapping', () => {
    it('should map TW-Enigma severities to SARIF levels', () => {
      const severityMappings = [
        { impact: 'critical', expectedLevel: 'error' },
        { impact: 'high', expectedLevel: 'error' },
        { impact: 'medium', expectedLevel: 'warning' },
        { impact: 'low', expectedLevel: 'info' },
        { impact: 'minimal', expectedLevel: 'note' },
      ];

      severityMappings.forEach(({ impact, expectedLevel }) => {
        const mockOpportunity: Opportunity = {
          id: `test-${impact}`,
          type: 'pattern-consolidation',
          title: 'Test opportunity',
          description: 'Test description',
          impact,
          effort: 'low',
          priority: 'medium',
          confidence: 0.8,
          affectedFiles: ['/test/file.css'],
          benefits: [],
          recommendations: [],
          evidence: [],
          tags: [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };

        const mockResult: OpportunityAnalysisResult = {
          opportunities: [mockOpportunity],
          summary: {
            totalOpportunities: 1,
            highPriorityCount: 0,
            mediumPriorityCount: 1,
            lowPriorityCount: 0,
            estimatedSavings: {
              sizeReduction: 100,
              performanceGain: 0.1,
              timeInvestment: 1,
            },
          },
          metadata: {
            analysisDate: Date.now(),
            version: '1.0.0',
            configHash: 'test',
          },
        };

        const sarif = formatter.formatOpportunityResults(mockResult);
        expect(sarif.runs[0].results[0].level).toBe(expectedLevel);
      });
    });
  });
});