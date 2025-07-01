/**
 * Conflict Reporting System
 *
 * Generates comprehensive warnings and reports for CSS order, specificity,
 * and dependency conflicts with multiple output formats and severity levels.
 */

import { CONFLICT_SEVERITY_LEVELS } from './constants';
import {
  ConflictReport,
  ConflictSeverity,
  ConflictType,
  CSSRule,
  OrderHandlingOptions,
  ReportFormat,
} from './types';

/**
 * Advanced conflict reporting system with multiple output formats
 */
export class ConflictReporter {
  private config: OrderHandlingOptions;
  private suppressedTypes: Set<ConflictType>;
  private escalatedTypes: Set<ConflictType>;
  private reportCache: Map<string, string>;

  constructor(config: OrderHandlingOptions) {
    this.config = config;
    this.suppressedTypes = new Set();
    this.escalatedTypes = new Set();
    this.reportCache = new Map();
  }

  /**
   * Generate comprehensive conflict report in specified formats
   */
  public generateReport(conflicts: ConflictReport[], rules?: Map<string, CSSRule>): string[] {
    const startTime = Date.now();
    const reports: string[] = [];

    try {
      // Filter conflicts by severity and type
      const filteredConflicts = this.filterConflicts(conflicts);

      // Sort conflicts by severity and type
      const sortedConflicts = this.sortConflicts(filteredConflicts);

      // Generate reports in requested formats
      for (const format of this.config.reportFormat) {
        let report: string;

        switch (format) {
          case ReportFormat.CONSOLE:
            report = this.generateConsoleReport(sortedConflicts, rules);
            break;
          case ReportFormat.JSON:
            report = this.generateJSONReport(sortedConflicts, rules);
            break;
          case ReportFormat.HTML:
            report = this.generateHTMLReport(sortedConflicts, rules);
            break;
          case ReportFormat.MARKDOWN:
            report = this.generateMarkdownReport(sortedConflicts, rules);
            break;
          default:
            report = this.generateConsoleReport(sortedConflicts, rules);
        }

        reports.push(report);
      }

      const processingTime = Date.now() - startTime;
      if (processingTime > 1000) {
        console.warn(
          `Conflict report generation took ${processingTime}ms for ${conflicts.length} conflicts`
        );
      }

      return reports;
    } catch (error) {
      console.error('Failed to generate conflict report:', error);
      return [`Error generating report: ${(error as Error).message}`];
    }
  }

  /**
   * Generate warnings for specific conflict types
   */
  public generateWarnings(conflicts: ConflictReport[]): string[] {
    const warnings: string[] = [];

    const filteredConflicts = this.filterConflicts(conflicts);

    for (const conflict of filteredConflicts) {
      const warning = this.formatWarning(conflict);
      warnings.push(warning);
    }

    return warnings;
  }

  /**
   * Export report to file (returns file content)
   */
  public exportReport(
    conflicts: ConflictReport[],
    format: ReportFormat,
    rules?: Map<string, CSSRule>
  ): string {
    const filteredConflicts = this.filterConflicts(conflicts);
    const sortedConflicts = this.sortConflicts(filteredConflicts);

    switch (format) {
      case ReportFormat.JSON:
        return this.generateJSONReport(sortedConflicts, rules);
      case ReportFormat.HTML:
        return this.generateHTMLReport(sortedConflicts, rules);
      case ReportFormat.MARKDOWN:
        return this.generateMarkdownReport(sortedConflicts, rules);
      default:
        return this.generateConsoleReport(sortedConflicts, rules);
    }
  }

  /**
   * Configure warning suppression and escalation
   */
  public configureWarnings(options: {
    suppressTypes?: ConflictType[];
    escalateTypes?: ConflictType[];
    clearSuppressed?: boolean;
    clearEscalated?: boolean;
  }): void {
    if (options.clearSuppressed) {
      this.suppressedTypes.clear();
    }
    if (options.clearEscalated) {
      this.escalatedTypes.clear();
    }

    if (options.suppressTypes) {
      options.suppressTypes.forEach((type) => this.suppressedTypes.add(type));
    }
    if (options.escalateTypes) {
      options.escalateTypes.forEach((type) => this.escalatedTypes.add(type));
    }
  }

  /**
   * Filter conflicts based on configuration
   */
  private filterConflicts(conflicts: ConflictReport[]): ConflictReport[] {
    return conflicts
      .filter((conflict) => {
        // Skip suppressed types
        if (this.suppressedTypes.has(conflict.type)) {
          return false;
        }

        // Apply severity filtering based on strictness
        const minSeverityLevel = this.getMinimumSeverityLevel();
        const conflictSeverityLevel = CONFLICT_SEVERITY_LEVELS[conflict.severity];

        return conflictSeverityLevel >= minSeverityLevel;
      })
      .map((conflict) => {
        // Escalate severity if configured
        if (this.escalatedTypes.has(conflict.type)) {
          return {
            ...conflict,
            severity: this.escalateSeverity(conflict.severity),
          };
        }
        return conflict;
      });
  }

  /**
   * Sort conflicts by severity and type
   */
  private sortConflicts(conflicts: ConflictReport[]): ConflictReport[] {
    return conflicts.sort((a, b) => {
      // Sort by severity first (higher severity first)
      const severityDiff =
        CONFLICT_SEVERITY_LEVELS[b.severity] - CONFLICT_SEVERITY_LEVELS[a.severity];
      if (severityDiff !== 0) return severityDiff;

      // Then by conflict type
      return a.type.localeCompare(b.type);
    });
  }

  /**
   * Generate console-formatted report
   */
  private generateConsoleReport(conflicts: ConflictReport[], rules?: Map<string, CSSRule>): string {
    const lines: string[] = [];

    // Header
    lines.push('🎯 CSS Order Dependency Analysis Report');
    lines.push('='.repeat(50));
    lines.push(`Total conflicts found: ${conflicts.length}`);
    lines.push('');

    // Summary by severity
    const severitySummary = this.getSeveritySummary(conflicts);
    lines.push('📊 Summary by Severity:');
    Object.entries(severitySummary).forEach(([severity, count]) => {
      const icon = this.getSeverityIcon(severity as ConflictSeverity);
      lines.push(`  ${icon} ${severity.toUpperCase()}: ${count}`);
    });
    lines.push('');

    // Group by severity
    const groupedBySeverity = this.groupBySeverity(conflicts);

    Object.entries(groupedBySeverity).forEach(([severity, severityConflicts]) => {
      if (severityConflicts.length === 0) return;

      const icon = this.getSeverityIcon(severity as ConflictSeverity);
      lines.push(`${icon} ${severity.toUpperCase()} CONFLICTS (${severityConflicts.length})`);
      lines.push('-'.repeat(30));

      severityConflicts.forEach((conflict, index) => {
        lines.push(`${index + 1}. ${this.formatConflictForConsole(conflict, rules)}`);
        lines.push('');
      });
    });

    // Footer with recommendations
    lines.push('💡 Recommendations:');
    lines.push('- Review CRITICAL and HIGH severity conflicts first');
    lines.push('- Consider adjusting CSS specificity for conflicting rules');
    lines.push('- Use CSS cascade order to resolve dependencies');
    lines.push('- Test thoroughly after any reordering changes');

    return lines.join('\n');
  }

  /**
   * Generate JSON-formatted report
   */
  private generateJSONReport(conflicts: ConflictReport[], rules?: Map<string, CSSRule>): string {
    const report = {
      metadata: {
        timestamp: new Date().toISOString(),
        totalConflicts: conflicts.length,
        severitySummary: this.getSeveritySummary(conflicts),
        generator: 'TW-Enigma CSS Order Dependency Analyzer',
      },
      conflicts: conflicts.map((conflict) => ({
        ...conflict,
        rules: conflict.involvedRules.map((ruleId) => {
          const rule = rules?.get(ruleId);
          return rule
            ? {
                id: rule.id,
                selector: rule.selector,
                sourceFile: rule.sourceFile,
                lineNumber: rule.lineNumber,
              }
            : { id: ruleId };
        }),
      })),
      recommendations: this.generateRecommendations(conflicts),
    };

    return JSON.stringify(report, null, 2);
  }

  /**
   * Generate HTML-formatted report
   */
  private generateHTMLReport(conflicts: ConflictReport[], rules?: Map<string, CSSRule>): string {
    const severitySummary = this.getSeveritySummary(conflicts);
    const groupedBySeverity = this.groupBySeverity(conflicts);

    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>CSS Order Dependency Analysis Report</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 40px; line-height: 1.6; }
        .header { border-bottom: 2px solid #e1e5e9; padding-bottom: 20px; margin-bottom: 30px; }
        .summary { background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 30px; }
        .severity-critical { color: #dc3545; }
        .severity-high { color: #fd7e14; }
        .severity-medium { color: #ffc107; }
        .severity-low { color: #28a745; }
        .severity-info { color: #17a2b8; }
        .conflict-card { border: 1px solid #dee2e6; border-radius: 8px; padding: 20px; margin-bottom: 20px; }
        .conflict-title { font-weight: bold; margin-bottom: 10px; }
        .conflict-details { background: #f8f9fa; padding: 15px; border-radius: 4px; margin-top: 10px; }
        .rule-info { font-family: monospace; background: #e9ecef; padding: 8px; border-radius: 4px; margin: 5px 0; }
        pre { background: #f8f9fa; padding: 15px; border-radius: 4px; overflow-x: auto; }
    </style>
</head>
<body>
    <div class="header">
        <h1>🎯 CSS Order Dependency Analysis Report</h1>
        <p>Generated on ${new Date().toLocaleString()}</p>
        <p>Total conflicts found: <strong>${conflicts.length}</strong></p>
    </div>

    <div class="summary">
        <h2>📊 Summary by Severity</h2>
        ${Object.entries(severitySummary)
          .map(
            ([severity, count]) =>
              `<div class="severity-${severity}">• ${severity.toUpperCase()}: ${count}</div>`
          )
          .join('')}
    </div>

    ${Object.entries(groupedBySeverity)
      .map(([severity, severityConflicts]) => {
        if (severityConflicts.length === 0) return '';

        return `
        <div class="severity-section">
            <h2 class="severity-${severity}">${severity.toUpperCase()} CONFLICTS (${severityConflicts.length})</h2>
            ${severityConflicts
              .map(
                (conflict) => `
                <div class="conflict-card">
                    <div class="conflict-title severity-${severity}">${conflict.type.replace(/-/g, ' ').toUpperCase()}</div>
                    <p>${conflict.description}</p>
                    <div class="conflict-details">
                        <strong>Affected Rules:</strong>
                        ${conflict.involvedRules
                          .map((ruleId) => {
                            const rule = rules?.get(ruleId);
                            return rule
                              ? `<div class="rule-info">${rule.selector} (${rule.sourceFile}:${rule.lineNumber})</div>`
                              : `<div class="rule-info">Rule ID: ${ruleId}</div>`;
                          })
                          .join('')}
                        ${conflict.suggestion ? `<p><strong>Suggestion:</strong> ${conflict.suggestion}</p>` : ''}
                    </div>
                </div>
            `
              )
              .join('')}
        </div>
      `;
      })
      .join('')}

    <div class="recommendations">
        <h2>💡 Recommendations</h2>
        <ul>
            <li>Review CRITICAL and HIGH severity conflicts first</li>
            <li>Consider adjusting CSS specificity for conflicting rules</li>
            <li>Use CSS cascade order to resolve dependencies</li>
            <li>Test thoroughly after any reordering changes</li>
        </ul>
    </div>
</body>
</html>`;
  }

  /**
   * Generate Markdown-formatted report
   */
  private generateMarkdownReport(
    conflicts: ConflictReport[],
    rules?: Map<string, CSSRule>
  ): string {
    const lines: string[] = [];
    const severitySummary = this.getSeveritySummary(conflicts);
    const groupedBySeverity = this.groupBySeverity(conflicts);

    // Header
    lines.push('# 🎯 CSS Order Dependency Analysis Report');
    lines.push('');
    lines.push(`**Generated:** ${new Date().toLocaleString()}`);
    lines.push(`**Total conflicts found:** ${conflicts.length}`);
    lines.push('');

    // Summary
    lines.push('## 📊 Summary by Severity');
    lines.push('');
    Object.entries(severitySummary).forEach(([severity, count]) => {
      const icon = this.getSeverityIcon(severity as ConflictSeverity);
      lines.push(`- ${icon} **${severity.toUpperCase()}:** ${count}`);
    });
    lines.push('');

    // Conflicts by severity
    Object.entries(groupedBySeverity).forEach(([severity, severityConflicts]) => {
      if (severityConflicts.length === 0) return;

      const icon = this.getSeverityIcon(severity as ConflictSeverity);
      lines.push(`## ${icon} ${severity.toUpperCase()} Conflicts (${severityConflicts.length})`);
      lines.push('');

      severityConflicts.forEach((conflict, index) => {
        lines.push(`### ${index + 1}. ${conflict.type.replace(/-/g, ' ').toUpperCase()}`);
        lines.push('');
        lines.push(conflict.description);
        lines.push('');

        if (conflict.involvedRules.length > 0) {
          lines.push('**Affected Rules:**');
          conflict.involvedRules.forEach((ruleId) => {
            const rule = rules?.get(ruleId);
            if (rule) {
              lines.push(`- \`${rule.selector}\` (${rule.sourceFile}:${rule.lineNumber})`);
            } else {
              lines.push(`- Rule ID: ${ruleId}`);
            }
          });
          lines.push('');
        }

        if (conflict.suggestion) {
          lines.push(`**💡 Suggestion:** ${conflict.suggestion}`);
          lines.push('');
        }
      });
    });

    // Recommendations
    lines.push('## 💡 Recommendations');
    lines.push('');
    lines.push('- Review CRITICAL and HIGH severity conflicts first');
    lines.push('- Consider adjusting CSS specificity for conflicting rules');
    lines.push('- Use CSS cascade order to resolve dependencies');
    lines.push('- Test thoroughly after any reordering changes');

    return lines.join('\n');
  }

  /**
   * Format a single warning message
   */
  private formatWarning(conflict: ConflictReport): string {
    const icon = this.getSeverityIcon(conflict.severity);
    const type = conflict.type.replace(/-/g, ' ').toUpperCase();

    return `${icon} ${conflict.severity.toUpperCase()}: ${type} - ${conflict.description}`;
  }

  /**
   * Format conflict for console output
   */
  private formatConflictForConsole(conflict: ConflictReport, rules?: Map<string, CSSRule>): string {
    const lines: string[] = [];

    lines.push(`${conflict.type.replace(/-/g, ' ').toUpperCase()}`);
    lines.push(`   Description: ${conflict.description}`);

    if (conflict.involvedRules.length > 0) {
      lines.push(`   Affected rules: ${conflict.involvedRules.length}`);
      conflict.involvedRules.forEach((ruleId) => {
        const rule = rules?.get(ruleId);
        if (rule) {
          lines.push(`     • ${rule.selector} (${rule.sourceFile}:${rule.lineNumber})`);
        } else {
          lines.push(`     • Rule ID: ${ruleId}`);
        }
      });
    }

    if (conflict.suggestion) {
      lines.push(`   💡 Suggestion: ${conflict.suggestion}`);
    }

    return lines.join('\n');
  }

  /**
   * Utility methods
   */
  private getSeverityIcon(severity: ConflictSeverity): string {
    switch (severity) {
      case ConflictSeverity.CRITICAL:
        return '🚨';
      case ConflictSeverity.HIGH:
        return '⚠️';
      case ConflictSeverity.MEDIUM:
        return '🔔';
      case ConflictSeverity.LOW:
        return 'ℹ️';
      case ConflictSeverity.INFO:
        return '💡';
      default:
        return '•';
    }
  }

  private getSeveritySummary(conflicts: ConflictReport[]): Record<string, number> {
    const summary: Record<string, number> = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
      info: 0,
    };

    conflicts.forEach((conflict) => {
      summary[conflict.severity] = (summary[conflict.severity] || 0) + 1;
    });

    return summary;
  }

  private groupBySeverity(conflicts: ConflictReport[]): Record<string, ConflictReport[]> {
    const groups: Record<string, ConflictReport[]> = {
      critical: [],
      high: [],
      medium: [],
      low: [],
      info: [],
    };

    conflicts.forEach((conflict) => {
      if (!groups[conflict.severity]) {
        groups[conflict.severity] = [];
      }
      groups[conflict.severity].push(conflict);
    });

    return groups;
  }

  private getMinimumSeverityLevel(): number {
    // Adjust based on strictness level
    switch (this.config.strictness) {
      case 'permissive':
        return CONFLICT_SEVERITY_LEVELS[ConflictSeverity.HIGH];
      case 'balanced':
        return CONFLICT_SEVERITY_LEVELS[ConflictSeverity.MEDIUM];
      case 'strict':
        return CONFLICT_SEVERITY_LEVELS[ConflictSeverity.LOW];
      case 'preserve-all':
        return CONFLICT_SEVERITY_LEVELS[ConflictSeverity.INFO];
      default:
        return CONFLICT_SEVERITY_LEVELS[ConflictSeverity.MEDIUM];
    }
  }

  private escalateSeverity(severity: ConflictSeverity): ConflictSeverity {
    switch (severity) {
      case ConflictSeverity.INFO:
        return ConflictSeverity.LOW;
      case ConflictSeverity.LOW:
        return ConflictSeverity.MEDIUM;
      case ConflictSeverity.MEDIUM:
        return ConflictSeverity.HIGH;
      case ConflictSeverity.HIGH:
        return ConflictSeverity.CRITICAL;
      case ConflictSeverity.CRITICAL:
        return ConflictSeverity.CRITICAL;
      default:
        return severity;
    }
  }

  private generateRecommendations(conflicts: ConflictReport[]): string[] {
    const recommendations: string[] = [];
    const conflictTypes = new Set(conflicts.map((c) => c.type));

    if (conflictTypes.has(ConflictType.SPECIFICITY_CONFLICT)) {
      recommendations.push(
        'Consider using more specific selectors or adjusting CSS specificity hierarchy'
      );
    }

    if (conflictTypes.has(ConflictType.ORDER_VIOLATION)) {
      recommendations.push(
        'Review CSS cascade order and ensure dependent rules maintain proper sequence'
      );
    }

    if (conflictTypes.has(ConflictType.CIRCULAR_DEPENDENCY)) {
      recommendations.push('Resolve circular dependencies by restructuring CSS rules');
    }

    if (conflictTypes.has(ConflictType.CASCADE_INTERFERENCE)) {
      recommendations.push('Check for unintended cascade interference between rules');
    }

    return recommendations;
  }

  /**
   * Clear internal caches
   */
  public clearCache(): void {
    this.reportCache.clear();
  }

  /**
   * Get reporting statistics
   */
  public getStats(): {
    suppressedTypes: number;
    escalatedTypes: number;
    cacheSize: number;
  } {
    return {
      suppressedTypes: this.suppressedTypes.size,
      escalatedTypes: this.escalatedTypes.size,
      cacheSize: this.reportCache.size,
    };
  }
}
