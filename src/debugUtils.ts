/**
 * Copyright (c) 2025 Rowan Cardow
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { createLogger, Logger } from "./logger.js";
import { EnigmaConfig } from "./config.js";
import { readFile, writeFile } from "fs/promises";
import { join, relative, extname } from "path";

/**
 * CSS class pattern information
 */
export interface ClassPattern {
  pattern: string;
  type: 'utility' | 'component' | 'responsive' | 'state' | 'arbitrary' | 'custom';
  framework: 'tailwind' | 'bootstrap' | 'custom' | 'unknown';
  frequency: number;
  files: string[];
  variants: string[];
  complexity: number;
  optimizable: boolean;
  optimizationSuggestions: string[];
  examples: Array<{
    file: string;
    line: number;
    context: string;
    usage: string;
  }>;
}

/**
 * Class analysis result
 */
export interface ClassAnalysisResult {
  totalClasses: number;
  uniqueClasses: number;
  duplicateClasses: number;
  patterns: ClassPattern[];
  frameworkBreakdown: {
    tailwind: number;
    bootstrap: number;
    custom: number;
    unknown: number;
  };
  typeBreakdown: {
    utility: number;
    component: number;
    responsive: number;
    state: number;
    arbitrary: number;
    custom: number;
  };
  optimizationOpportunities: {
    duplicateRemoval: number;
    classShortening: number;
    patternConsolidation: number;
    unusedClasses: number;
  };
  complexityScore: number;
  recommendations: string[];
}

/**
 * Debug session information
 */
export interface DebugSession {
  id: string;
  timestamp: Date;
  config: EnigmaConfig;
  files: string[];
  analysis: ClassAnalysisResult;
  optimizationSteps: Array<{
    step: string;
    description: string;
    before: any;
    after: any;
    impact: {
      sizeReduction: number;
      classesAffected: number;
      filesModified: number;
    };
  }>;
  performance: {
    analysisTime: number;
    optimizationTime: number;
    totalTime: number;
    memoryUsage: number;
  };
}

/**
 * Debug configuration
 */
export interface DebugConfig {
  enabled: boolean;
  verbose: boolean;
  saveSession: boolean;
  outputPath: string;
  includeSourceMaps: boolean;
  trackPerformance: boolean;
  analyzePatterns: boolean;
  generateRecommendations: boolean;
  maxFileSize: number;
  excludePatterns: string[];
}

/**
 * Debug utilities for CSS class pattern analysis
 * Provides comprehensive debugging and analysis tools for developers
 */
export class DebugUtils {
  private logger: Logger;
  private config: DebugConfig;
  private currentSession?: DebugSession;
  private patternCache: Map<string, ClassPattern> = new Map();

  constructor(config: Partial<DebugConfig> = {}) {
    this.config = {
      enabled: true,
      verbose: false,
      saveSession: true,
      outputPath: "debug-sessions",
      includeSourceMaps: true,
      trackPerformance: true,
      analyzePatterns: true,
      generateRecommendations: true,
      maxFileSize: 1024 * 1024, // 1MB
      excludePatterns: ["node_modules/**", "dist/**", "build/**"],
      ...config,
    };

    this.logger = createLogger("DebugUtils");

    this.logger.debug("Debug utilities initialized", {
      config: this.config,
    });
  }

  /**
   * Start a new debug session
   */
  async startSession(files: string[], enigmaConfig: EnigmaConfig): Promise<string> {
    if (!this.config.enabled) {
      throw new Error("Debug utilities are disabled");
    }

    const sessionId = this.generateSessionId();
    const startTime = Date.now();

    this.logger.info("Starting debug session", {
      sessionId,
      filesCount: files.length,
    });

    // Analyze classes in all files
    const analysis = await this.analyzeClasses(files);

    this.currentSession = {
      id: sessionId,
      timestamp: new Date(),
      config: enigmaConfig,
      files,
      analysis,
      optimizationSteps: [],
      performance: {
        analysisTime: Date.now() - startTime,
        optimizationTime: 0,
        totalTime: 0,
        memoryUsage: process.memoryUsage().heapUsed,
      },
    };

    this.logger.info("Debug session started", {
      sessionId,
      totalClasses: analysis.totalClasses,
      uniqueClasses: analysis.uniqueClasses,
      complexityScore: analysis.complexityScore,
    });

    return sessionId;
  }

  /**
   * End the current debug session
   */
  async endSession(): Promise<DebugSession | null> {
    if (!this.currentSession) {
      this.logger.warn("No active debug session to end");
      return null;
    }

    const session = this.currentSession;
    session.performance.totalTime = Date.now() - session.timestamp.getTime();

    this.logger.info("Ending debug session", {
      sessionId: session.id,
      totalTime: session.performance.totalTime,
      optimizationSteps: session.optimizationSteps.length,
    });

    // Save session if configured
    if (this.config.saveSession) {
      await this.saveSession(session);
    }

    this.currentSession = undefined;
    return session;
  }

  /**
   * Analyze CSS classes in files
   */
  async analyzeClasses(files: string[]): Promise<ClassAnalysisResult> {
    this.logger.debug("Analyzing CSS classes", {
      filesCount: files.length,
    });

    const patterns: ClassPattern[] = [];
    const classFrequency: Map<string, number> = new Map();
    const classFiles: Map<string, Set<string>> = new Map();
    const classExamples: Map<string, Array<{ file: string; line: number; context: string; usage: string }>> = new Map();

    let totalClasses = 0;

    // Process each file
    for (const file of files) {
      try {
        const content = await readFile(file, 'utf-8');
        
        // Check file size
        if (content.length > this.config.maxFileSize) {
          this.logger.warn("File too large for analysis", {
            file,
            size: content.length,
            maxSize: this.config.maxFileSize,
          });
          continue;
        }

        const fileClasses = this.extractClassesFromFile(content, file);
        totalClasses += fileClasses.length;

        // Update frequency and file tracking
        fileClasses.forEach(({ className, line, context, usage }) => {
          classFrequency.set(className, (classFrequency.get(className) || 0) + 1);
          
          if (!classFiles.has(className)) {
            classFiles.set(className, new Set());
          }
          classFiles.get(className)!.add(file);

          if (!classExamples.has(className)) {
            classExamples.set(className, []);
          }
          const examples = classExamples.get(className)!;
          if (examples.length < 5) { // Limit examples per class
            examples.push({ file, line, context, usage });
          }
        });
      } catch (error) {
        this.logger.error("Failed to analyze file", {
          file,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    // Generate patterns from collected data
    for (const [className, frequency] of classFrequency.entries()) {
      const pattern = this.analyzeClassPattern(
        className,
        frequency,
        Array.from(classFiles.get(className) || []),
        classExamples.get(className) || []
      );
      patterns.push(pattern);
    }

    // Calculate statistics
    const uniqueClasses = classFrequency.size;
    const duplicateClasses = totalClasses - uniqueClasses;

    const frameworkBreakdown = this.calculateFrameworkBreakdown(patterns);
    const typeBreakdown = this.calculateTypeBreakdown(patterns);
    const optimizationOpportunities = this.calculateOptimizationOpportunities(patterns);
    const complexityScore = this.calculateComplexityScore(patterns);
    const recommendations = this.generateRecommendations(patterns, optimizationOpportunities);

    const result: ClassAnalysisResult = {
      totalClasses,
      uniqueClasses,
      duplicateClasses,
      patterns,
      frameworkBreakdown,
      typeBreakdown,
      optimizationOpportunities,
      complexityScore,
      recommendations,
    };

    this.logger.info("Class analysis completed", {
      totalClasses,
      uniqueClasses,
      duplicateClasses,
      patternsFound: patterns.length,
      complexityScore,
    });

    return result;
  }

  /**
   * Add an optimization step to the current session
   */
  addOptimizationStep(
    step: string,
    description: string,
    before: any,
    after: any,
    impact: { sizeReduction: number; classesAffected: number; filesModified: number }
  ): void {
    if (!this.currentSession) {
      this.logger.warn("No active debug session for optimization step");
      return;
    }

    this.currentSession.optimizationSteps.push({
      step,
      description,
      before,
      after,
      impact,
    });

    this.logger.debug("Optimization step added", {
      step,
      impact,
    });
  }

  /**
   * Get debug information for a specific class
   */
  getClassDebugInfo(className: string): ClassPattern | null {
    if (this.patternCache.has(className)) {
      return this.patternCache.get(className)!;
    }

    if (!this.currentSession) {
      return null;
    }

    const pattern = this.currentSession.analysis.patterns.find(p => p.pattern === className);
    if (pattern) {
      this.patternCache.set(className, pattern);
    }

    return pattern || null;
  }

  /**
   * Generate a debug report
   */
  generateDebugReport(): string {
    if (!this.currentSession) {
      return "No active debug session";
    }

    const session = this.currentSession;
    const analysis = session.analysis;

    let report = `# CSS Class Analysis Debug Report\n\n`;
    report += `**Session ID:** ${session.id}\n`;
    report += `**Timestamp:** ${session.timestamp.toISOString()}\n`;
    report += `**Files Analyzed:** ${session.files.length}\n\n`;

    // Summary statistics
    report += `## Summary Statistics\n\n`;
    report += `- **Total Classes:** ${analysis.totalClasses}\n`;
    report += `- **Unique Classes:** ${analysis.uniqueClasses}\n`;
    report += `- **Duplicate Classes:** ${analysis.duplicateClasses}\n`;
    report += `- **Complexity Score:** ${analysis.complexityScore}/10\n\n`;

    // Framework breakdown
    report += `## Framework Breakdown\n\n`;
    Object.entries(analysis.frameworkBreakdown).forEach(([framework, count]) => {
      const percentage = ((count / analysis.uniqueClasses) * 100).toFixed(1);
      report += `- **${framework}:** ${count} (${percentage}%)\n`;
    });
    report += `\n`;

    // Type breakdown
    report += `## Class Type Breakdown\n\n`;
    Object.entries(analysis.typeBreakdown).forEach(([type, count]) => {
      const percentage = ((count / analysis.uniqueClasses) * 100).toFixed(1);
      report += `- **${type}:** ${count} (${percentage}%)\n`;
    });
    report += `\n`;

    // Optimization opportunities
    report += `## Optimization Opportunities\n\n`;
    Object.entries(analysis.optimizationOpportunities).forEach(([opportunity, count]) => {
      report += `- **${opportunity}:** ${count} classes\n`;
    });
    report += `\n`;

    // Top patterns by frequency
    const topPatterns = analysis.patterns
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, 10);

    report += `## Top 10 Most Frequent Patterns\n\n`;
    topPatterns.forEach((pattern, index) => {
      report += `${index + 1}. **${pattern.pattern}** (${pattern.type}, ${pattern.framework})\n`;
      report += `   - Frequency: ${pattern.frequency}\n`;
      report += `   - Files: ${pattern.files.length}\n`;
      report += `   - Optimizable: ${pattern.optimizable ? 'Yes' : 'No'}\n\n`;
    });

    // Recommendations
    if (analysis.recommendations.length > 0) {
      report += `## Recommendations\n\n`;
      analysis.recommendations.forEach((recommendation, index) => {
        report += `${index + 1}. ${recommendation}\n`;
      });
      report += `\n`;
    }

    // Optimization steps
    if (session.optimizationSteps.length > 0) {
      report += `## Optimization Steps\n\n`;
      session.optimizationSteps.forEach((step, index) => {
        report += `### Step ${index + 1}: ${step.step}\n\n`;
        report += `${step.description}\n\n`;
        report += `**Impact:**\n`;
        report += `- Size Reduction: ${step.impact.sizeReduction} bytes\n`;
        report += `- Classes Affected: ${step.impact.classesAffected}\n`;
        report += `- Files Modified: ${step.impact.filesModified}\n\n`;
      });
    }

    // Performance metrics
    report += `## Performance Metrics\n\n`;
    report += `- **Analysis Time:** ${session.performance.analysisTime}ms\n`;
    report += `- **Optimization Time:** ${session.performance.optimizationTime}ms\n`;
    report += `- **Total Time:** ${session.performance.totalTime}ms\n`;
    report += `- **Memory Usage:** ${(session.performance.memoryUsage / 1024 / 1024).toFixed(2)}MB\n`;

    return report;
  }

  /**
   * Export debug data as JSON
   */
  exportDebugData(): any {
    if (!this.currentSession) {
      return null;
    }

    return {
      session: this.currentSession,
      config: this.config,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Update debug configuration
   */
  updateConfig(newConfig: Partial<DebugConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.logger.debug("Debug configuration updated", {
      newConfig,
      fullConfig: this.config,
    });
  }

  /**
   * Extract classes from file content
   */
  private extractClassesFromFile(content: string, filePath: string): Array<{
    className: string;
    line: number;
    context: string;
    usage: string;
  }> {
    const classes: Array<{ className: string; line: number; context: string; usage: string }> = [];
    const lines = content.split('\n');
    const ext = extname(filePath).toLowerCase();

    // Different extraction patterns based on file type
    let classRegex: RegExp;
    
    if (['.html', '.htm', '.jsx', '.tsx'].includes(ext)) {
      // HTML/JSX class attributes
      classRegex = /class(?:Name)?=["']([^"']+)["']/g;
    } else if (['.css', '.scss', '.sass', '.less'].includes(ext)) {
      // CSS class selectors
      classRegex = /\.([a-zA-Z_-][a-zA-Z0-9_-]*)/g;
    } else if (['.js', '.ts'].includes(ext)) {
      // JavaScript/TypeScript class strings
      classRegex = /["']([a-zA-Z_-][a-zA-Z0-9_\s-]+)["']/g;
    } else {
      // Generic pattern
      classRegex = /class(?:Name)?=["']([^"']+)["']|\.([a-zA-Z_-][a-zA-Z0-9_-]*)/g;
    }

    lines.forEach((line, lineIndex) => {
      let match: RegExpExecArray | null;
      while ((match = classRegex.exec(line)) !== null) {
        const classString = match?.[1] || match?.[2];
        if (classString && match) {
          // Split multiple classes
          const individualClasses = classString.split(/\s+/).filter(cls => cls.trim());
          
          // Store match[0] for use in forEach to avoid null reference
          const matchUsage = match[0];
          individualClasses.forEach(className => {
            if (className && this.isValidClassName(className)) {
              classes.push({
                className: className.trim(),
                line: lineIndex + 1,
                context: line.trim(),
                usage: matchUsage,
              });
            }
          });
        }
      }
    });

    return classes;
  }

  /**
   * Analyze a class pattern
   */
  private analyzeClassPattern(
    className: string,
    frequency: number,
    files: string[],
    examples: Array<{ file: string; line: number; context: string; usage: string }>
  ): ClassPattern {
    const type = this.classifyType(className);
    const framework = this.classifyFramework(className);
    const variants = this.extractVariants(className);
    const complexity = this.calculateClassComplexity(className);
    const optimizable = this.isOptimizable(className, frequency);
    const optimizationSuggestions = this.generateOptimizationSuggestions(className, frequency, type);

    return {
      pattern: className,
      type,
      framework,
      frequency,
      files,
      variants,
      complexity,
      optimizable,
      optimizationSuggestions,
      examples,
    };
  }

  /**
   * Classify class type
   */
  private classifyType(className: string): ClassPattern['type'] {
    // Responsive patterns
    if (/^(sm|md|lg|xl|2xl):/.test(className)) {
      return 'responsive';
    }

    // State patterns
    if (/^(hover|focus|active|disabled|visited):/.test(className)) {
      return 'state';
    }

    // Arbitrary values
    if (/\[.*\]/.test(className)) {
      return 'arbitrary';
    }

    // Utility classes (common patterns)
    if (/^(p|m|w|h|text|bg|border|flex|grid|space|gap)-/.test(className)) {
      return 'utility';
    }

    // Component-like classes
    if (/^[A-Z]/.test(className) || className.includes('__') || className.includes('--')) {
      return 'component';
    }

    return 'custom';
  }

  /**
   * Classify framework
   */
  private classifyFramework(className: string): ClassPattern['framework'] {
    // Tailwind patterns
    if (/^(p|m|w|h|text|bg|border|flex|grid|space|gap|justify|items|self|place|content|order|col|row|auto|static|fixed|absolute|relative|sticky|inset|top|right|bottom|left|z|opacity|shadow|ring|blur|brightness|contrast|drop|grayscale|hue|invert|saturate|sepia|backdrop|divide|sr|not-sr|pointer|select|resize|scroll|snap|touch|will|appearance|cursor|outline|accent|caret|decoration|underline|overline|line|list|whitespace|break|hyphens|content|table|caption|border|empty|only|first|last|odd|even|target|default|checked|indeterminate|placeholder|autofill|required|valid|invalid|in|out|read|motion|print|dark|portrait|landscape|contrast|prefers|supports|aria|data)-/.test(className)) {
      return 'tailwind';
    }

    // Bootstrap patterns
    if (/^(btn|card|nav|navbar|modal|alert|badge|breadcrumb|carousel|collapse|dropdown|form|input|list|pagination|progress|spinner|toast|tooltip|popover|container|row|col|d-|flex-|justify-|align-|text-|bg-|border-|p-|m-|w-|h-)-/.test(className)) {
      return 'bootstrap';
    }

    // Check for common framework prefixes
    if (className.includes(':') || className.includes('[') || /^(sm|md|lg|xl|2xl|hover|focus|active|disabled|visited|first|last|odd|even|group|peer):/.test(className)) {
      return 'tailwind';
    }

    return 'custom';
  }

  /**
   * Extract variants from class name
   */
  private extractVariants(className: string): string[] {
    const variants: string[] = [];
    const parts = className.split(':');
    
    if (parts.length > 1) {
      // All parts except the last are variants
      variants.push(...parts.slice(0, -1));
    }

    return variants;
  }

  /**
   * Calculate class complexity
   */
  private calculateClassComplexity(className: string): number {
    let complexity = 1;

    // Variants add complexity
    const variants = className.split(':').length - 1;
    complexity += variants * 0.5;

    // Arbitrary values add complexity
    if (/\[.*\]/.test(className)) {
      complexity += 1;
    }

    // Long class names are more complex
    if (className.length > 20) {
      complexity += 0.5;
    }

    // Multiple hyphens indicate compound utilities
    const hyphens = (className.match(/-/g) || []).length;
    if (hyphens > 2) {
      complexity += (hyphens - 2) * 0.2;
    }

    return Math.min(complexity, 5); // Cap at 5
  }

  /**
   * Check if class is optimizable
   */
  private isOptimizable(className: string, frequency: number): boolean {
    // High frequency classes are good candidates
    if (frequency > 5) return true;

    // Long class names can be shortened
    if (className.length > 15) return true;

    // Classes with many variants can be optimized
    if (className.split(':').length > 2) return true;

    // Arbitrary values might be optimizable
    if (/\[.*\]/.test(className)) return true;

    return false;
  }

  /**
   * Generate optimization suggestions
   */
  private generateOptimizationSuggestions(className: string, frequency: number, type: ClassPattern['type']): string[] {
    const suggestions: string[] = [];

    if (frequency > 10) {
      suggestions.push("Consider extracting to a component class due to high frequency");
    }

    if (className.length > 20) {
      suggestions.push("Class name is long, consider shortening or using CSS custom properties");
    }

    if (type === 'arbitrary') {
      suggestions.push("Arbitrary value detected, consider adding to theme configuration");
    }

    if (className.split(':').length > 3) {
      suggestions.push("Multiple variants detected, consider simplifying or using CSS nesting");
    }

    if (frequency === 1) {
      suggestions.push("Single use class, consider if it's necessary or can be inlined");
    }

    return suggestions;
  }

  /**
   * Calculate framework breakdown
   */
  private calculateFrameworkBreakdown(patterns: ClassPattern[]): ClassAnalysisResult['frameworkBreakdown'] {
    const breakdown = { tailwind: 0, bootstrap: 0, custom: 0, unknown: 0 };
    
    patterns.forEach(pattern => {
      breakdown[pattern.framework]++;
    });

    return breakdown;
  }

  /**
   * Calculate type breakdown
   */
  private calculateTypeBreakdown(patterns: ClassPattern[]): ClassAnalysisResult['typeBreakdown'] {
    const breakdown = { utility: 0, component: 0, responsive: 0, state: 0, arbitrary: 0, custom: 0 };
    
    patterns.forEach(pattern => {
      breakdown[pattern.type]++;
    });

    return breakdown;
  }

  /**
   * Calculate optimization opportunities
   */
  private calculateOptimizationOpportunities(patterns: ClassPattern[]): ClassAnalysisResult['optimizationOpportunities'] {
    const opportunities = {
      duplicateRemoval: 0,
      classShortening: 0,
      patternConsolidation: 0,
      unusedClasses: 0,
    };

    patterns.forEach(pattern => {
      if (pattern.frequency > 1) {
        opportunities.duplicateRemoval++;
      }
      
      if (pattern.pattern.length > 15) {
        opportunities.classShortening++;
      }
      
      if (pattern.frequency > 5 && pattern.type === 'utility') {
        opportunities.patternConsolidation++;
      }
      
      if (pattern.frequency === 1 && pattern.files.length === 1) {
        opportunities.unusedClasses++;
      }
    });

    return opportunities;
  }

  /**
   * Calculate overall complexity score
   */
  private calculateComplexityScore(patterns: ClassPattern[]): number {
    if (patterns.length === 0) return 0;

    const avgComplexity = patterns.reduce((sum, pattern) => sum + pattern.complexity, 0) / patterns.length;
    const variantComplexity = patterns.filter(p => p.variants.length > 0).length / patterns.length;
    const arbitraryComplexity = patterns.filter(p => p.type === 'arbitrary').length / patterns.length;

    const score = (avgComplexity * 0.5) + (variantComplexity * 3) + (arbitraryComplexity * 2);
    return Math.min(Math.round(score * 10) / 10, 10);
  }

  /**
   * Generate recommendations
   */
  private generateRecommendations(patterns: ClassPattern[], opportunities: ClassAnalysisResult['optimizationOpportunities']): string[] {
    const recommendations: string[] = [];

    if (opportunities.duplicateRemoval > 10) {
      recommendations.push("Consider extracting frequently used class combinations into component classes");
    }

    if (opportunities.classShortening > 5) {
      recommendations.push("Many long class names detected, consider using CSS custom properties or shorter aliases");
    }

    if (opportunities.patternConsolidation > 3) {
      recommendations.push("High-frequency utility classes could be consolidated into design tokens");
    }

    if (opportunities.unusedClasses > 20) {
      recommendations.push("Many single-use classes detected, consider removing unused styles");
    }

    const arbitraryCount = patterns.filter(p => p.type === 'arbitrary').length;
    if (arbitraryCount > 5) {
      recommendations.push("Consider adding frequently used arbitrary values to your theme configuration");
    }

    const responsiveCount = patterns.filter(p => p.type === 'responsive').length;
    if (responsiveCount > patterns.length * 0.3) {
      recommendations.push("High responsive class usage, ensure mobile-first approach is being followed");
    }

    return recommendations;
  }

  /**
   * Check if class name is valid
   */
  private isValidClassName(className: string): boolean {
    // Basic validation for CSS class names
    return /^[a-zA-Z_-][a-zA-Z0-9_:-]*$/.test(className) && className.length > 0;
  }

  /**
   * Generate unique session ID
   */
  private generateSessionId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `debug-${timestamp}-${random}`;
  }

  /**
   * Save debug session to file
   */
  private async saveSession(session: DebugSession): Promise<void> {
    try {
      const filename = `${session.id}.json`;
      const filepath = join(this.config.outputPath, filename);
      const content = JSON.stringify(session, null, 2);
      
      await writeFile(filepath, content, 'utf-8');
      
      this.logger.info("Debug session saved", {
        sessionId: session.id,
        filepath,
        size: content.length,
      });
    } catch (error) {
      this.logger.error("Failed to save debug session", {
        sessionId: session.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

/**
 * Create and configure debug utilities
 */
export function createDebugUtils(config: EnigmaConfig): DebugUtils | null {
  if (!config.debug) {
    return null;
  }

  const debugConfig: DebugConfig = {
    enabled: config.debug,
    verbose: config.verbose ?? false,
    saveSession: true,
    outputPath: "debug-sessions",
    includeSourceMaps: config.sourceMaps ?? false,
    trackPerformance: true,
    analyzePatterns: true,
    generateRecommendations: true,
    maxFileSize: 1024 * 1024, // 1MB
    excludePatterns: ["node_modules/**", "dist/**", "build/**"],
  };

  return new DebugUtils(debugConfig);
} 