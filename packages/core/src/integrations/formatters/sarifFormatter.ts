/**
 * Copyright (c) 2025 Rowan Cardow
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * SARIF (Static Analysis Results Interchange Format) Output Formatter
 * 
 * Converts TW-Enigma analysis results to SARIF 2.1.0 format for integration
 * with security and code quality tools, CI/CD pipelines, and IDEs.
 */

import { createHash } from 'crypto';
import type { SarifOutput } from '../core/apiInterfaces';
import type { OpportunityAnalysisResult, Opportunity } from '../../optimization/opportunityIdentification';
import type { PatternAnalysisResult } from '../../optimization/patternDetection';
import type { ValidationResult } from '../../validation/endToEndValidation';

/**
 * SARIF rule severity mapping
 */
const SEVERITY_MAPPING = {
  error: 'error' as const,
  warning: 'warning' as const,
  info: 'info' as const,
  note: 'note' as const,
};

/**
 * TW-Enigma to SARIF severity mapping
 */
const TW_ENIGMA_SEVERITY_MAP = {
  critical: 'error',
  high: 'error',
  medium: 'warning',
  low: 'info',
  minimal: 'note',
} as const;

/**
 * SARIF rule definitions for TW-Enigma analysis
 */
const SARIF_RULES = {
  'pattern-consolidation': {
    id: 'TW001',
    name: 'PatternConsolidationOpportunity',
    shortDescription: 'Pattern consolidation opportunity detected',
    fullDescription: 'Multiple similar patterns detected that could be consolidated to reduce code duplication and improve maintainability.',
    messageStrings: {
      default: 'Pattern consolidation opportunity: {0}',
      withMetrics: 'Pattern consolidation opportunity: {0}. Potential {1}% code reduction.',
    },
    helpUri: 'https://github.com/your-org/tw-enigma/docs/patterns/consolidation',
  },
  'code-deduplication': {
    id: 'TW002',
    name: 'CodeDeduplicationOpportunity',
    shortDescription: 'Code deduplication opportunity detected',
    fullDescription: 'Duplicate code patterns found that could be refactored to improve maintainability.',
    messageStrings: {
      default: 'Code deduplication opportunity: {0}',
    },
    helpUri: 'https://github.com/your-org/tw-enigma/docs/patterns/deduplication',
  },
  'performance-optimization': {
    id: 'TW003',
    name: 'PerformanceOptimizationOpportunity',
    shortDescription: 'Performance optimization opportunity detected',
    fullDescription: 'Potential performance improvements identified in CSS patterns or structure.',
    messageStrings: {
      default: 'Performance optimization opportunity: {0}',
    },
    helpUri: 'https://github.com/your-org/tw-enigma/docs/performance/optimization',
  },
  'maintainability-enhancement': {
    id: 'TW004',
    name: 'MaintainabilityEnhancementOpportunity',
    shortDescription: 'Maintainability enhancement opportunity detected',
    fullDescription: 'Code structure or patterns that could be improved for better maintainability.',
    messageStrings: {
      default: 'Maintainability enhancement opportunity: {0}',
    },
    helpUri: 'https://github.com/your-org/tw-enigma/docs/maintainability/enhancement',
  },
  'accessibility-improvement': {
    id: 'TW005',
    name: 'AccessibilityImprovementOpportunity',
    shortDescription: 'Accessibility improvement opportunity detected',
    fullDescription: 'Potential accessibility improvements identified in CSS patterns.',
    messageStrings: {
      default: 'Accessibility improvement opportunity: {0}',
    },
    helpUri: 'https://github.com/your-org/tw-enigma/docs/accessibility/improvement',
  },
  'security-hardening': {
    id: 'TW006',
    name: 'SecurityHardeningOpportunity',
    shortDescription: 'Security hardening opportunity detected',
    fullDescription: 'Potential security improvements identified in CSS patterns or configuration.',
    messageStrings: {
      default: 'Security hardening opportunity: {0}',
    },
    helpUri: 'https://github.com/your-org/tw-enigma/docs/security/hardening',
  },
  'validation-failure': {
    id: 'TW007',
    name: 'ValidationFailure',
    shortDescription: 'Validation failure detected',
    fullDescription: 'End-to-end validation test failed, indicating potential issues with pattern detection or optimization.',
    messageStrings: {
      default: 'Validation failure: {0}',
    },
    helpUri: 'https://github.com/your-org/tw-enigma/docs/validation/failures',
  },
  'pattern-detection-issue': {
    id: 'TW008',
    name: 'PatternDetectionIssue',
    shortDescription: 'Pattern detection issue found',
    fullDescription: 'Issues detected during pattern analysis that may affect optimization results.',
    messageStrings: {
      default: 'Pattern detection issue: {0}',
    },
    helpUri: 'https://github.com/your-org/tw-enigma/docs/patterns/detection-issues',
  },
} as const;

/**
 * SARIF formatter for TW-Enigma analysis results
 */
export class SarifFormatter {
  private version: string;
  private repositoryRoot: string;

  constructor(version: string = '1.0.0', repositoryRoot: string = process.cwd()) {
    this.version = version;
    this.repositoryRoot = repositoryRoot;
  }

  /**
   * Convert opportunity analysis results to SARIF format
   */
  formatOpportunityResults(results: OpportunityAnalysisResult): SarifOutput {
    const sarifResults = results.opportunities.map(opportunity => 
      this.convertOpportunityToSarifResult(opportunity)
    ).filter(Boolean);

    return this.createSarifDocument(sarifResults);
  }

  /**
   * Convert pattern analysis results to SARIF format
   */
  formatPatternResults(results: PatternAnalysisResult[]): SarifOutput {
    const sarifResults = results.flatMap(result => 
      result.patterns.map(pattern => this.convertPatternToSarifResult(pattern, result))
    ).filter(Boolean);

    return this.createSarifDocument(sarifResults);
  }

  /**
   * Convert validation results to SARIF format
   */
  formatValidationResults(results: ValidationResult[]): SarifOutput {
    const sarifResults = results.flatMap(result => 
      this.convertValidationToSarifResults(result)
    ).filter(Boolean);

    return this.createSarifDocument(sarifResults);
  }

  /**
   * Convert combined analysis results to SARIF format
   */
  formatCombinedResults(
    opportunities?: OpportunityAnalysisResult,
    patterns?: PatternAnalysisResult[],
    validation?: ValidationResult[]
  ): SarifOutput {
    const allResults = [];

    if (opportunities) {
      allResults.push(...opportunities.opportunities.map(opp => 
        this.convertOpportunityToSarifResult(opp)
      ));
    }

    if (patterns) {
      allResults.push(...patterns.flatMap(result => 
        result.patterns.map(pattern => this.convertPatternToSarifResult(pattern, result))
      ));
    }

    if (validation) {
      allResults.push(...validation.flatMap(result => 
        this.convertValidationToSarifResults(result)
      ));
    }

    return this.createSarifDocument(allResults.filter(Boolean));
  }

  /**
   * Convert an opportunity to a SARIF result
   */
  private convertOpportunityToSarifResult(opportunity: Opportunity): any {
    const ruleMapping = this.getRuleMapping(opportunity.type);
    if (!ruleMapping) return null;

    const level = this.mapSeverityToSarifLevel(opportunity.impact);
    
    // Create locations from affected files
    const locations = opportunity.affectedFiles.map(filePath => ({
      physicalLocation: {
        artifactLocation: {
          uri: this.getRelativeUri(filePath),
        },
        region: {
          startLine: 1,
          startColumn: 1,
          snippet: {
            text: `// ${opportunity.type.replace('-', ' ')} opportunity detected`,
          },
        },
      },
    }));

    // Create fixes if recommendations are available
    const fixes = opportunity.recommendations.length > 0 ? [{
      description: {
        text: opportunity.recommendations[0].description,
      },
      artifactChanges: opportunity.affectedFiles.map(filePath => ({
        artifactLocation: {
          uri: this.getRelativeUri(filePath),
        },
        replacements: [{
          deletedRegion: {
            startLine: 1,
            startColumn: 1,
            endLine: 1,
            endColumn: 1,
          },
          insertedContent: {
            text: opportunity.recommendations[0].codeExample || '',
          },
        }],
      })),
    }] : undefined;

    return {
      ruleId: ruleMapping.id,
      message: {
        text: this.formatMessage(ruleMapping.messageStrings.default, [
          opportunity.title,
          opportunity.description,
        ]),
        id: 'default',
      },
      level,
      locations,
      fixes,
      partialFingerprints: {
        opportunityId: opportunity.id,
        opportunityType: opportunity.type,
        confidenceScore: opportunity.confidence.toString(),
      },
      baselineState: 'new',
      properties: {
        impact: opportunity.impact,
        effort: opportunity.effort,
        priority: opportunity.priority,
        confidence: opportunity.confidence,
        estimatedTimeHours: opportunity.recommendations.reduce(
          (sum, rec) => sum + (rec.estimatedTimeHours || 0), 0
        ),
        benefits: opportunity.benefits,
        evidence: opportunity.evidence.map(e => ({
          type: e.type,
          description: e.description,
          confidence: e.confidence,
        })),
      },
    };
  }

  /**
   * Convert a pattern to a SARIF result
   */
  private convertPatternToSarifResult(pattern: any, analysisResult: PatternAnalysisResult): any {
    if (!pattern.evidence || pattern.evidence.length === 0) return null;

    const ruleMapping = SARIF_RULES['pattern-detection-issue'];
    const level = pattern.confidence > 0.8 ? 'info' : 'warning';

    // Use the first evidence location as primary location
    const primaryEvidence = pattern.evidence[0];
    const locations = [{
      physicalLocation: {
        artifactLocation: {
          uri: this.getRelativeUri(primaryEvidence.location.filePath),
        },
        region: {
          startLine: primaryEvidence.location.startLine || 1,
          startColumn: primaryEvidence.location.startColumn || 1,
          endLine: primaryEvidence.location.endLine || primaryEvidence.location.startLine || 1,
          endColumn: primaryEvidence.location.endColumn || primaryEvidence.location.startColumn || 1,
          snippet: {
            text: primaryEvidence.content || '',
          },
        },
      },
    }];

    return {
      ruleId: ruleMapping.id,
      message: {
        text: `Pattern detected: ${pattern.name} (confidence: ${(pattern.confidence * 100).toFixed(1)}%)`,
        id: 'default',
      },
      level,
      locations,
      partialFingerprints: {
        patternId: pattern.patternId,
        patternType: pattern.type,
        confidence: pattern.confidence.toString(),
      },
      baselineState: 'new',
      properties: {
        pattern: {
          id: pattern.patternId,
          name: pattern.name,
          type: pattern.type,
          category: pattern.category,
          confidence: pattern.confidence,
          evidenceCount: pattern.evidence.length,
        },
        analysisMetadata: {
          entityPath: analysisResult.entity.filePath,
          entityType: analysisResult.entity.fileType,
        },
      },
    };
  }

  /**
   * Convert validation results to SARIF results
   */
  private convertValidationToSarifResults(validation: ValidationResult): any[] {
    const results = [];

    // Convert errors to SARIF results
    for (const error of validation.errors) {
      results.push({
        ruleId: SARIF_RULES['validation-failure'].id,
        message: {
          text: `Validation error in ${validation.testName}: ${error}`,
          id: 'default',
        },
        level: 'error',
        locations: [{
          physicalLocation: {
            artifactLocation: {
              uri: 'validation-suite',
            },
            region: {
              startLine: 1,
              startColumn: 1,
            },
          },
        }],
        partialFingerprints: {
          testName: validation.testName,
          errorType: 'validation-error',
          errorMessage: this.createFingerprint(error),
        },
        properties: {
          validation: {
            testName: validation.testName,
            passed: validation.passed,
            duration: validation.duration,
            memoryUsed: validation.memoryUsed,
          },
        },
      });
    }

    // Convert warnings to SARIF results
    for (const warning of validation.warnings) {
      results.push({
        ruleId: SARIF_RULES['validation-failure'].id,
        message: {
          text: `Validation warning in ${validation.testName}: ${warning}`,
          id: 'default',
        },
        level: 'warning',
        locations: [{
          physicalLocation: {
            artifactLocation: {
              uri: 'validation-suite',
            },
            region: {
              startLine: 1,
              startColumn: 1,
            },
          },
        }],
        partialFingerprints: {
          testName: validation.testName,
          warningType: 'validation-warning',
          warningMessage: this.createFingerprint(warning),
        },
        properties: {
          validation: {
            testName: validation.testName,
            passed: validation.passed,
            duration: validation.duration,
            memoryUsed: validation.memoryUsed,
          },
        },
      });
    }

    return results;
  }

  /**
   * Create a complete SARIF document
   */
  private createSarifDocument(results: any[]): SarifOutput {
    return {
      version: '2.1.0',
      $schema: 'https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json',
      runs: [{
        tool: {
          driver: {
            name: 'TW-Enigma',
            version: this.version,
            semanticVersion: this.version,
            informationUri: 'https://github.com/your-org/tw-enigma',
            rules: Object.values(SARIF_RULES).map(rule => ({
              id: rule.id,
              name: rule.name,
              shortDescription: {
                text: rule.shortDescription,
              },
              fullDescription: {
                text: rule.fullDescription,
              },
              messageStrings: Object.fromEntries(
                Object.entries(rule.messageStrings).map(([key, value]) => [
                  key,
                  { text: value }
                ])
              ),
              defaultConfiguration: {
                level: this.getDefaultLevelForRule(rule.id),
              },
              helpUri: rule.helpUri,
            })),
          },
        },
        results,
        columnKind: 'utf16CodeUnits',
      }],
    };
  }

  /**
   * Get rule mapping for opportunity type
   */
  private getRuleMapping(opportunityType: string): typeof SARIF_RULES[keyof typeof SARIF_RULES] | null {
    const ruleKey = opportunityType.replace('_', '-') as keyof typeof SARIF_RULES;
    return SARIF_RULES[ruleKey] || null;
  }

  /**
   * Map TW-Enigma severity to SARIF level
   */
  private mapSeverityToSarifLevel(severity: string): 'error' | 'warning' | 'info' | 'note' {
    const mapped = TW_ENIGMA_SEVERITY_MAP[severity as keyof typeof TW_ENIGMA_SEVERITY_MAP];
    return SEVERITY_MAPPING[mapped as keyof typeof SEVERITY_MAPPING] || 'info';
  }

  /**
   * Get default severity level for a rule
   */
  private getDefaultLevelForRule(ruleId: string): 'error' | 'warning' | 'info' | 'note' {
    switch (ruleId) {
      case 'TW007': // validation-failure
        return 'error';
      case 'TW006': // security-hardening
        return 'error';
      case 'TW001': // pattern-consolidation
      case 'TW002': // code-deduplication
        return 'warning';
      case 'TW003': // performance-optimization
      case 'TW004': // maintainability-enhancement
      case 'TW005': // accessibility-improvement
        return 'info';
      default:
        return 'info';
    }
  }

  /**
   * Format message string with parameters
   */
  private formatMessage(template: string, params: string[]): string {
    return template.replace(/\{(\d+)\}/g, (match, index) => {
      const paramIndex = parseInt(index, 10);
      return params[paramIndex] || match;
    });
  }

  /**
   * Get relative URI for file path
   */
  private getRelativeUri(filePath: string): string {
    if (filePath.startsWith(this.repositoryRoot)) {
      return filePath.substring(this.repositoryRoot.length + 1);
    }
    return filePath;
  }

  /**
   * Create fingerprint for deduplication
   */
  private createFingerprint(content: string): string {
    return createHash('md5').update(content).digest('hex').substring(0, 8);
  }
}

/**
 * Factory function to create SARIF formatter
 */
export function createSarifFormatter(version?: string, repositoryRoot?: string): SarifFormatter {
  return new SarifFormatter(version, repositoryRoot);
}

/**
 * Utility function to validate SARIF output
 */
export function validateSarifOutput(sarif: unknown): sarif is SarifOutput {
  try {
    // Basic validation - in a real implementation, you'd use a JSON schema validator
    const sarifObj = sarif as SarifOutput;
    return (
      sarifObj &&
      sarifObj.version === '2.1.0' &&
      Array.isArray(sarifObj.runs) &&
      sarifObj.runs.length > 0 &&
      sarifObj.runs[0].tool &&
      sarifObj.runs[0].tool.driver &&
      sarifObj.runs[0].tool.driver.name === 'TW-Enigma'
    );
  } catch {
    return false;
  }
}

/**
 * Convert SARIF output to JSON string with proper formatting
 */
export function sarifToJson(sarif: SarifOutput, pretty: boolean = true): string {
  return JSON.stringify(sarif, null, pretty ? 2 : 0);
}