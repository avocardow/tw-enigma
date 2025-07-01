/**
 * CSS Custom Property Documentation Generator
 * 
 * Generates comprehensive documentation for all custom properties,
 * including their purpose, accepted values, usage examples, and dependencies
 * with automatic updates and team accessibility features.
 */

import { promises as fs } from 'fs';
import path from 'path';
import type { 
  VariableMap, 
  CustomPropertyDeclaration, 
  CustomPropertyUsage,
  VariableCategory 
} from './customPropertyDetector.js';
import type { OptimizationReport } from './customPropertyOptimizer.js';
import type { PreservationReport } from './customPropertyPreserver.js';

export interface DocumentationConfiguration {
  /** Output formats to generate */
  outputFormats: DocumentationFormat[];
  /** Output directory */
  outputDirectory: string;
  /** Include usage examples */
  includeExamples: boolean;
  /** Include optimization suggestions */
  includeOptimizations: boolean;
  /** Include dependency graphs */
  includeDependencyGraphs: boolean;
  /** Group variables by category */
  groupByCategory: boolean;
  /** Generate index files */
  generateIndex: boolean;
  /** Custom templates */
  customTemplates: Map<DocumentationFormat, string>;
  /** Documentation metadata */
  metadata: DocumentationMetadata;
}

export interface DocumentationMetadata {
  /** Project name */
  projectName: string;
  /** Project version */
  version: string;
  /** Author information */
  author?: string;
  /** Description */
  description?: string;
  /** Last updated timestamp */
  lastUpdated: string;
  /** Generation tool info */
  generatedBy: string;
}

export type DocumentationFormat = 'markdown' | 'json' | 'html' | 'csv' | 'yaml';

export interface VariableDocumentation {
  /** Variable name */
  name: string;
  /** Full name with -- prefix */
  fullName: string;
  /** Variable description */
  description: string;
  /** Variable category */
  category: VariableCategory;
  /** Variable value */
  value: string;
  /** Parsed value information */
  valueInfo: ValueInfo;
  /** Scope information */
  scope: ScopeInfo;
  /** Usage information */
  usage: UsageInfo;
  /** Dependencies */
  dependencies: DependencyInfo;
  /** Examples */
  examples: ExampleInfo[];
  /** Optimization notes */
  optimizations: OptimizationNote[];
  /** Tags for categorization */
  tags: string[];
  /** Deprecation status */
  deprecated?: DeprecationInfo;
}

export interface ValueInfo {
  /** Value type */
  type: 'color' | 'size' | 'font' | 'string' | 'number' | 'complex';
  /** Parsed components */
  components: ValueComponent[];
  /** Valid range or options */
  validValues?: string[];
  /** Default fallback */
  defaultFallback?: string;
  /** Browser compatibility */
  browserSupport: BrowserSupport;
}

export interface ValueComponent {
  /** Component type */
  type: 'unit' | 'color' | 'keyword' | 'function' | 'variable';
  /** Component value */
  value: string;
  /** Component description */
  description?: string;
}

export interface ScopeInfo {
  /** Scope type */
  type: 'global' | 'component' | 'local' | 'dynamic';
  /** Scope identifier */
  identifier: string;
  /** File where declared */
  declaredIn: string[];
  /** Inheritance chain */
  inheritance: string[];
  /** Override behavior */
  overrideBehavior: 'cascade' | 'inherit' | 'initial';
}

export interface UsageInfo {
  /** Usage count */
  count: number;
  /** Files where used */
  usedIn: string[];
  /** CSS properties where used */
  properties: string[];
  /** Contexts where used */
  contexts: UsageContext[];
  /** Common patterns */
  patterns: UsagePattern[];
}

export interface UsageContext {
  /** CSS selector */
  selector: string;
  /** CSS property */
  property: string;
  /** File path */
  filePath: string;
  /** Line number */
  line: number;
  /** Context description */
  description?: string;
}

export interface UsagePattern {
  /** Pattern name */
  name: string;
  /** Pattern description */
  description: string;
  /** Usage frequency */
  frequency: number;
  /** Example selectors */
  examples: string[];
}

export interface DependencyInfo {
  /** Variables this depends on */
  dependsOn: string[];
  /** Variables that depend on this */
  dependents: string[];
  /** Dependency graph depth */
  depth: number;
  /** Circular dependencies */
  circularDependencies: string[];
}

export interface ExampleInfo {
  /** Example title */
  title: string;
  /** Example description */
  description: string;
  /** CSS code example */
  css: string;
  /** HTML context if applicable */
  html?: string;
  /** Expected result */
  result?: string;
  /** Browser notes */
  browserNotes?: string;
}

export interface OptimizationNote {
  /** Note type */
  type: 'suggestion' | 'warning' | 'improvement';
  /** Note message */
  message: string;
  /** Potential savings */
  savings?: string;
  /** Implementation difficulty */
  difficulty: 'easy' | 'medium' | 'hard';
  /** Related variables */
  relatedVariables: string[];
}

export interface DeprecationInfo {
  /** Deprecation reason */
  reason: string;
  /** Replacement variable */
  replacement?: string;
  /** Deprecation timeline */
  timeline: string;
  /** Migration guide */
  migrationGuide?: string;
}

export interface BrowserSupport {
  /** Supported browsers */
  supported: string[];
  /** Partially supported browsers */
  partial: string[];
  /** Unsupported browsers */
  unsupported: string[];
  /** Required polyfills */
  polyfills: string[];
}

export interface DocumentationIndex {
  /** Generated timestamp */
  timestamp: string;
  /** Project metadata */
  project: DocumentationMetadata;
  /** Summary statistics */
  summary: DocumentationSummary;
  /** Categories index */
  categories: CategoryIndex[];
  /** Files index */
  files: FileIndex[];
  /** Variable index */
  variables: VariableIndex[];
}

export interface DocumentationSummary {
  /** Total variables */
  totalVariables: number;
  /** Variables by category */
  byCategory: Record<VariableCategory, number>;
  /** Variables by scope */
  byScope: Record<string, number>;
  /** Total usage count */
  totalUsages: number;
  /** Files analyzed */
  filesAnalyzed: number;
}

export interface CategoryIndex {
  /** Category name */
  category: VariableCategory;
  /** Variable count */
  count: number;
  /** Category description */
  description: string;
  /** Documentation file */
  documentationFile: string;
  /** Variables in category */
  variables: string[];
}

export interface FileIndex {
  /** File path */
  filePath: string;
  /** Variables declared */
  declared: string[];
  /** Variables used */
  used: string[];
  /** File size */
  fileSize: number;
  /** Last modified */
  lastModified: string;
}

export interface VariableIndex {
  /** Variable name */
  name: string;
  /** Category */
  category: VariableCategory;
  /** Scope type */
  scope: string;
  /** Usage count */
  usageCount: number;
  /** Documentation file */
  documentationFile: string;
}

export class CustomPropertyDocumentationGenerator {
  private config: DocumentationConfiguration;

  constructor(config: Partial<DocumentationConfiguration> = {}) {
    this.config = {
      outputFormats: ['markdown', 'json'],
      outputDirectory: '.tw-enigma/docs/custom-properties',
      includeExamples: true,
      includeOptimizations: true,
      includeDependencyGraphs: true,
      groupByCategory: true,
      generateIndex: true,
      customTemplates: new Map(),
      metadata: {
        projectName: 'CSS Custom Properties',
        version: '1.0.0',
        lastUpdated: new Date().toISOString(),
        generatedBy: 'TW-Enigma Documentation Generator'
      },
      ...config
    };
  }

  /**
   * Generate comprehensive documentation from variable map
   */
  async generateDocumentation(
    variableMap: VariableMap,
    optimizationReport?: OptimizationReport,
    preservationReport?: PreservationReport
  ): Promise<{ files: string[]; index: DocumentationIndex }> {
    const documentation = await this.createVariableDocumentation(
      variableMap,
      optimizationReport,
      preservationReport
    );

    const index = this.createDocumentationIndex(documentation, variableMap);
    const generatedFiles: string[] = [];

    // Create output directory
    await fs.mkdir(this.config.outputDirectory, { recursive: true });

    // Generate documentation files
    if (this.config.groupByCategory) {
      const categorizedFiles = await this.generateCategorizedDocumentation(documentation);
      generatedFiles.push(...categorizedFiles);
    } else {
      const allInOneFiles = await this.generateAllInOneDocumentation(documentation);
      generatedFiles.push(...allInOneFiles);
    }

    // Generate index files
    if (this.config.generateIndex) {
      const indexFiles = await this.generateIndexFiles(index);
      generatedFiles.push(...indexFiles);
    }

    return { files: generatedFiles, index };
  }

  /**
   * Update existing documentation with new changes
   */
  async updateDocumentation(
    newVariableMap: VariableMap,
    previousDocumentation?: DocumentationIndex
  ): Promise<{ updated: string[]; created: string[]; removed: string[] }> {
    const updated: string[] = [];
    const created: string[] = [];
    const removed: string[] = [];

    // Generate new documentation
    const { files: newFiles } = await this.generateDocumentation(newVariableMap);

    if (previousDocumentation) {
      // Compare with previous documentation to track changes
      const previousFiles = new Set(previousDocumentation.files.map(f => f.filePath));
      const newFileSet = new Set(newFiles);

      for (const file of newFiles) {
        if (previousFiles.has(file)) {
          updated.push(file);
        } else {
          created.push(file);
        }
      }

      for (const file of previousFiles) {
        if (!newFileSet.has(file)) {
          removed.push(file);
        }
      }
    } else {
      created.push(...newFiles);
    }

    return { updated, created, removed };
  }

  /**
   * Generate live documentation server configuration
   */
  generateLiveDocumentationConfig(): {
    configFile: string;
    serverScript: string;
    watchPatterns: string[];
  } {
    const configFile = `
module.exports = {
  title: '${this.config.metadata.projectName} - Custom Properties',
  description: 'Comprehensive documentation for CSS custom properties',
  base: '/custom-properties/',
  src: '${this.config.outputDirectory}',
  patterns: ['**/*.md', '**/*.json'],
  sidebar: 'auto',
  plugins: [
    ['@vuepress/search', { searchMaxSuggestions: 10 }],
    ['@vuepress/back-to-top'],
    ['@vuepress/medium-zoom']
  ],
  themeConfig: {
    nav: [
      { text: 'Home', link: '/' },
      { text: 'Variables', link: '/variables/' },
      { text: 'Categories', link: '/categories/' },
      { text: 'Examples', link: '/examples/' }
    ],
    sidebar: {
      '/variables/': 'auto',
      '/categories/': 'auto',
      '/examples/': 'auto'
    }
  }
};
`;

    const serverScript = `
const { createServer } = require('vitepress');
const chokidar = require('chokidar');
const { generateDocumentation } = require('./documentation-generator');

async function startLiveDocumentation() {
  const server = await createServer({
    configFile: './vitepress.config.js'
  });

  // Watch for CSS file changes
  const watcher = chokidar.watch(['**/*.css', '**/*.scss', '**/*.js', '**/*.jsx', '**/*.ts', '**/*.tsx'], {
    ignored: ['node_modules/**', 'dist/**'],
    persistent: true
  });

  watcher.on('change', async (path) => {
    console.log('File changed:', path);
    console.log('Regenerating documentation...');
    
    try {
      await generateDocumentation();
      console.log('Documentation updated');
    } catch (error) {
      console.error('Failed to update documentation:', error);
    }
  });

  await server.listen(3000);
  console.log('Documentation server running at http://localhost:3000');
}

startLiveDocumentation().catch(console.error);
`;

    return {
      configFile,
      serverScript,
      watchPatterns: [
        '**/*.css',
        '**/*.scss',
        '**/*.sass',
        '**/*.less',
        '**/*.js',
        '**/*.jsx',
        '**/*.ts',
        '**/*.tsx',
        '**/*.vue'
      ]
    };
  }

  // Helper methods

  private async createVariableDocumentation(
    variableMap: VariableMap,
    optimizationReport?: OptimizationReport,
    preservationReport?: PreservationReport
  ): Promise<VariableDocumentation[]> {
    const documentation: VariableDocumentation[] = [];

    for (const [variableName, declarations] of variableMap.declarations) {
      const primaryDeclaration = declarations.find(d => d.scope.type === 'global') || declarations[0];
      const usages = variableMap.usages.get(variableName) || [];

      const doc: VariableDocumentation = {
        name: variableName,
        fullName: primaryDeclaration.fullName,
        description: this.generateDescription(primaryDeclaration, usages),
        category: this.categorizeVariable(primaryDeclaration),
        value: primaryDeclaration.value,
        valueInfo: this.analyzeValue(primaryDeclaration),
        scope: this.analyzeScopeInfo(declarations),
        usage: this.analyzeUsageInfo(usages),
        dependencies: this.analyzeDependencies(variableName, variableMap),
        examples: this.generateExamples(primaryDeclaration, usages),
        optimizations: this.extractOptimizationNotes(variableName, optimizationReport),
        tags: this.generateTags(primaryDeclaration, usages),
        deprecated: this.checkDeprecation(variableName, preservationReport)
      };

      documentation.push(doc);
    }

    return documentation.sort((a, b) => a.name.localeCompare(b.name));
  }

  private generateDescription(
    declaration: CustomPropertyDeclaration,
    usages: CustomPropertyUsage[]
  ): string {
    const category = this.categorizeVariable(declaration);
    const usageCount = usages.length;
    const scope = declaration.scope.type;

    let description = `A ${scope} ${category} variable`;

    if (usageCount > 0) {
      description += ` used in ${usageCount} location${usageCount !== 1 ? 's' : ''}`;
    }

    // Add value-specific description
    if (this.isColorValue(declaration.value)) {
      description += ` defining a color value`;
    } else if (this.isSizeValue(declaration.value)) {
      description += ` defining a size measurement`;
    } else if (declaration.value.includes('font')) {
      description += ` defining a font property`;
    }

    return description + '.';
  }

  private categorizeVariable(declaration: CustomPropertyDeclaration): VariableCategory {
    const name = declaration.name.toLowerCase();
    const value = declaration.value.toLowerCase();

    if (this.isColorValue(value) || name.includes('color') || name.includes('bg')) {
      return 'color';
    }
    if (name.includes('font') || name.includes('text')) {
      return 'typography';
    }
    if (name.includes('margin') || name.includes('padding') || name.includes('space')) {
      return 'spacing';
    }
    if (name.includes('width') || name.includes('height') || name.includes('size')) {
      return 'sizing';
    }
    if (name.includes('shadow') || name.includes('elevation')) {
      return 'shadow';
    }
    if (name.includes('border')) {
      return 'border';
    }
    if (name.includes('duration') || name.includes('timing') || name.includes('animation')) {
      return 'animation';
    }
    if (name.includes('z-index') || name.includes('position')) {
      return 'layout';
    }

    return 'other';
  }

  private analyzeValue(declaration: CustomPropertyDeclaration): ValueInfo {
    const value = declaration.value;
    const type = this.determineValueType(value);
    const components = this.parseValueComponents(value);

    return {
      type,
      components,
      validValues: this.getValidValues(type, value),
      defaultFallback: this.generateDefaultFallback(type, value),
      browserSupport: this.analyzeBrowserSupport(value)
    };
  }

  private analyzeScopeInfo(declarations: CustomPropertyDeclaration[]): ScopeInfo {
    const primaryDeclaration = declarations.find(d => d.scope.type === 'global') || declarations[0];
    
    return {
      type: primaryDeclaration.scope.type as any,
      identifier: primaryDeclaration.scope.identifier,
      declaredIn: declarations.map(d => d.filePath),
      inheritance: primaryDeclaration.scope.parentScopes,
      overrideBehavior: 'cascade'
    };
  }

  private analyzeUsageInfo(usages: CustomPropertyUsage[]): UsageInfo {
    const usedIn = [...new Set(usages.map(u => u.filePath))];
    const properties = [...new Set(usages.map(u => u.cssProperty))];
    
    const contexts: UsageContext[] = usages.map(usage => ({
      selector: usage.selector,
      property: usage.cssProperty,
      filePath: usage.filePath,
      line: usage.line,
      description: `Used in ${usage.selector} for ${usage.cssProperty}`
    }));

    const patterns = this.analyzeUsagePatterns(usages);

    return {
      count: usages.length,
      usedIn,
      properties,
      contexts,
      patterns
    };
  }

  private analyzeDependencies(variableName: string, variableMap: VariableMap): DependencyInfo {
    const declarations = variableMap.declarations.get(variableName) || [];
    const dependsOn: string[] = [];
    const dependents: string[] = [];

    // Find variables this depends on
    for (const declaration of declarations) {
      dependsOn.push(...declaration.referencedVariables);
    }

    // Find variables that depend on this
    for (const [otherName, otherDeclarations] of variableMap.declarations) {
      if (otherName === variableName) continue;
      
      for (const otherDeclaration of otherDeclarations) {
        if (otherDeclaration.referencedVariables.includes(variableName)) {
          dependents.push(otherName);
        }
      }
    }

    const circularDependencies = this.findCircularDependencies(variableName, variableMap);

    return {
      dependsOn: [...new Set(dependsOn)],
      dependents: [...new Set(dependents)],
      depth: this.calculateDependencyDepth(variableName, variableMap),
      circularDependencies
    };
  }

  private generateExamples(
    declaration: CustomPropertyDeclaration,
    usages: CustomPropertyUsage[]
  ): ExampleInfo[] {
    const examples: ExampleInfo[] = [];

    // Basic usage example
    examples.push({
      title: 'Basic Usage',
      description: `How to use ${declaration.fullName} in your CSS`,
      css: `.example {
  ${usages[0]?.cssProperty || 'color'}: var(${declaration.fullName});
}`,
      html: '<div class="example">Example content</div>',
      result: `Applies ${declaration.value} to the element`
    });

    // Fallback example
    examples.push({
      title: 'With Fallback',
      description: `Using ${declaration.fullName} with a fallback value`,
      css: `.example-fallback {
  ${usages[0]?.cssProperty || 'color'}: var(${declaration.fullName}, ${this.generateDefaultFallback(this.determineValueType(declaration.value), declaration.value)});
}`,
      html: '<div class="example-fallback">Fallback example</div>',
      result: `Falls back to default value if variable is not defined`
    });

    // Advanced examples based on usage patterns
    const uniqueProperties = [...new Set(usages.map(u => u.cssProperty))];
    if (uniqueProperties.length > 1) {
      examples.push({
        title: 'Multiple Properties',
        description: `${declaration.fullName} used across different CSS properties`,
        css: uniqueProperties.slice(0, 3).map(prop => 
          `.example-${prop.replace(/[^a-zA-Z0-9]/g, '')} {
  ${prop}: var(${declaration.fullName});
}`
        ).join('\n\n'),
        result: `Variable applied to multiple properties: ${uniqueProperties.join(', ')}`
      });
    }

    return examples;
  }

  private extractOptimizationNotes(
    variableName: string,
    optimizationReport?: OptimizationReport
  ): OptimizationNote[] {
    const notes: OptimizationNote[] = [];

    if (!optimizationReport) {
      return notes;
    }

    // Check if variable is mentioned in optimization strategies
    for (const strategies of Object.values(optimizationReport.strategies)) {
      for (const strategy of strategies) {
        if (strategy.affectedVariables.includes(variableName)) {
          notes.push({
            type: strategy.riskLevel === 'low' ? 'suggestion' : 'warning',
            message: strategy.description,
            savings: `${strategy.estimatedSavings} bytes`,
            difficulty: strategy.riskLevel === 'low' ? 'easy' : 'medium',
            relatedVariables: strategy.affectedVariables.filter(v => v !== variableName)
          });
        }
      }
    }

    // Check if variable is unused
    if (optimizationReport.strategies.low.some(s => 
        s.name === 'Unused Variable Removal' && 
        s.affectedVariables.includes(variableName))) {
      notes.push({
        type: 'warning',
        message: 'This variable is not used and could be removed',
        difficulty: 'easy',
        relatedVariables: []
      });
    }

    return notes;
  }

  private generateTags(
    declaration: CustomPropertyDeclaration,
    usages: CustomPropertyUsage[]
  ): string[] {
    const tags: string[] = [];

    // Add category tag
    tags.push(this.categorizeVariable(declaration));

    // Add scope tag
    tags.push(declaration.scope.type);

    // Add usage-based tags
    if (usages.length === 0) {
      tags.push('unused');
    } else if (usages.length > 10) {
      tags.push('frequently-used');
    }

    // Add value-based tags
    if (declaration.containsVariables) {
      tags.push('composite');
    }

    if (declaration.value.includes('calc(')) {
      tags.push('calculated');
    }

    return tags;
  }

  private checkDeprecation(
    variableName: string,
    preservationReport?: PreservationReport
  ): DeprecationInfo | undefined {
    // Check if variable is marked for removal or replacement
    if (preservationReport?.unprotectedCritical.includes(variableName)) {
      return {
        reason: 'Variable is critical but unprotected',
        timeline: 'Review recommended',
        migrationGuide: 'Consider adding preservation rules for this variable'
      };
    }

    return undefined;
  }

  private createDocumentationIndex(
    documentation: VariableDocumentation[],
    variableMap: VariableMap
  ): DocumentationIndex {
    const categories = this.createCategoryIndex(documentation);
    const files = this.createFileIndex(variableMap);
    const variables = this.createVariableIndex(documentation);

    const byCategory = documentation.reduce((acc, doc) => {
      acc[doc.category] = (acc[doc.category] || 0) + 1;
      return acc;
    }, {} as Record<VariableCategory, number>);

    const byScope = documentation.reduce((acc, doc) => {
      acc[doc.scope.type] = (acc[doc.scope.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      timestamp: new Date().toISOString(),
      project: this.config.metadata,
      summary: {
        totalVariables: documentation.length,
        byCategory,
        byScope,
        totalUsages: documentation.reduce((sum, doc) => sum + doc.usage.count, 0),
        filesAnalyzed: files.length
      },
      categories,
      files,
      variables
    };
  }

  private async generateCategorizedDocumentation(
    documentation: VariableDocumentation[]
  ): Promise<string[]> {
    const files: string[] = [];
    const categories = this.groupByCategory(documentation);

    for (const [category, variables] of categories) {
      for (const format of this.config.outputFormats) {
        const fileName = `${category}.${format}`;
        const filePath = path.join(this.config.outputDirectory, fileName);
        
        const content = await this.generateContent(variables, format, category);
        await fs.writeFile(filePath, content, 'utf8');
        files.push(filePath);
      }
    }

    return files;
  }

  private async generateAllInOneDocumentation(
    documentation: VariableDocumentation[]
  ): Promise<string[]> {
    const files: string[] = [];

    for (const format of this.config.outputFormats) {
      const fileName = `custom-properties.${format}`;
      const filePath = path.join(this.config.outputDirectory, fileName);
      
      const content = await this.generateContent(documentation, format);
      await fs.writeFile(filePath, content, 'utf8');
      files.push(filePath);
    }

    return files;
  }

  private async generateIndexFiles(index: DocumentationIndex): Promise<string[]> {
    const files: string[] = [];

    for (const format of this.config.outputFormats) {
      const fileName = `index.${format}`;
      const filePath = path.join(this.config.outputDirectory, fileName);
      
      let content: string;
      
      if (format === 'json') {
        content = JSON.stringify(index, null, 2);
      } else if (format === 'markdown') {
        content = this.generateMarkdownIndex(index);
      } else {
        content = JSON.stringify(index, null, 2);
      }
      
      await fs.writeFile(filePath, content, 'utf8');
      files.push(filePath);
    }

    return files;
  }

  private async generateContent(
    documentation: VariableDocumentation[],
    format: DocumentationFormat,
    category?: string
  ): Promise<string> {
    switch (format) {
      case 'markdown':
        return this.generateMarkdown(documentation, category);
      case 'json':
        return JSON.stringify(documentation, null, 2);
      case 'html':
        return this.generateHtml(documentation, category);
      case 'csv':
        return this.generateCsv(documentation);
      case 'yaml':
        return this.generateYaml(documentation);
      default:
        return JSON.stringify(documentation, null, 2);
    }
  }

  private generateMarkdown(documentation: VariableDocumentation[], category?: string): string {
    const title = category ? `${category} Variables` : 'CSS Custom Properties';
    
    let markdown = `# ${title}\n\n`;
    markdown += `Generated on: ${new Date().toLocaleString()}\n\n`;
    
    if (category) {
      markdown += `This document contains all ${category} variables in the project.\n\n`;
    }

    markdown += `## Table of Contents\n\n`;
    for (const doc of documentation) {
      markdown += `- [${doc.name}](#${doc.name.toLowerCase().replace(/[^a-z0-9]/g, '-')})\n`;
    }
    markdown += '\n';

    for (const doc of documentation) {
      markdown += this.generateVariableMarkdown(doc);
      markdown += '\n---\n\n';
    }

    return markdown;
  }

  private generateVariableMarkdown(doc: VariableDocumentation): string {
    let markdown = `## ${doc.name}\n\n`;
    markdown += `**Full Name:** \`${doc.fullName}\`\n\n`;
    markdown += `**Category:** ${doc.category}\n\n`;
    markdown += `**Description:** ${doc.description}\n\n`;
    markdown += `**Value:** \`${doc.value}\`\n\n`;
    markdown += `**Scope:** ${doc.scope.type} (${doc.scope.identifier})\n\n`;

    if (doc.usage.count > 0) {
      markdown += `**Usage:** Used ${doc.usage.count} times across ${doc.usage.usedIn.length} files\n\n`;
    }

    if (doc.dependencies.dependsOn.length > 0) {
      markdown += `**Dependencies:** ${doc.dependencies.dependsOn.map(dep => `\`--${dep}\``).join(', ')}\n\n`;
    }

    if (doc.examples.length > 0) {
      markdown += `### Examples\n\n`;
      for (const example of doc.examples) {
        markdown += `#### ${example.title}\n\n`;
        markdown += `${example.description}\n\n`;
        markdown += '```css\n';
        markdown += example.css;
        markdown += '\n```\n\n';
        
        if (example.html) {
          markdown += '```html\n';
          markdown += example.html;
          markdown += '\n```\n\n';
        }
      }
    }

    if (doc.optimizations.length > 0) {
      markdown += `### Optimization Notes\n\n`;
      for (const note of doc.optimizations) {
        markdown += `- **${note.type}:** ${note.message}\n`;
      }
      markdown += '\n';
    }

    return markdown;
  }

  private generateHtml(documentation: VariableDocumentation[], category?: string): string {
    const title = category ? `${category} Variables` : 'CSS Custom Properties';
    
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; line-height: 1.6; margin: 40px; }
        .variable { border: 1px solid #e1e5e9; border-radius: 6px; margin: 20px 0; padding: 20px; }
        .variable-name { font-size: 1.5em; font-weight: bold; color: #0366d6; }
        .variable-value { background: #f6f8fa; padding: 10px; border-radius: 3px; font-family: monospace; }
        .examples { background: #f6f8fa; padding: 15px; border-radius: 6px; margin: 10px 0; }
        .tag { background: #0366d6; color: white; padding: 2px 6px; border-radius: 3px; font-size: 0.8em; margin: 2px; }
        pre { background: #f6f8fa; padding: 10px; border-radius: 3px; overflow-x: auto; }
    </style>
</head>
<body>
    <h1>${title}</h1>
    <p>Generated on: ${new Date().toLocaleString()}</p>
    
    ${documentation.map(doc => `
        <div class="variable">
            <div class="variable-name">${doc.name}</div>
            <p><strong>Full Name:</strong> <code>${doc.fullName}</code></p>
            <p><strong>Description:</strong> ${doc.description}</p>
            <div class="variable-value">${doc.value}</div>
            <p><strong>Category:</strong> ${doc.category}</p>
            <p><strong>Scope:</strong> ${doc.scope.type}</p>
            <div>
                ${doc.tags.map(tag => `<span class="tag">${tag}</span>`).join('')}
            </div>
            
            ${doc.examples.length > 0 ? `
                <h3>Examples</h3>
                ${doc.examples.map(example => `
                    <div class="examples">
                        <h4>${example.title}</h4>
                        <p>${example.description}</p>
                        <pre><code>${example.css}</code></pre>
                    </div>
                `).join('')}
            ` : ''}
        </div>
    `).join('')}
</body>
</html>`;
  }

  private generateCsv(documentation: VariableDocumentation[]): string {
    const headers = 'Name,Full Name,Category,Value,Scope,Usage Count,Dependencies,Tags';
    const rows = documentation.map(doc => [
      doc.name,
      doc.fullName,
      doc.category,
      doc.value.replace(/"/g, '""'),
      doc.scope.type,
      doc.usage.count.toString(),
      doc.dependencies.dependsOn.join(';'),
      doc.tags.join(';')
    ].map(cell => `"${cell}"`).join(','));

    return [headers, ...rows].join('\n');
  }

  private generateYaml(documentation: VariableDocumentation[]): string {
    // Simplified YAML generation
    let yaml = 'custom_properties:\n';
    
    for (const doc of documentation) {
      yaml += `  - name: ${doc.name}\n`;
      yaml += `    full_name: ${doc.fullName}\n`;
      yaml += `    category: ${doc.category}\n`;
      yaml += `    value: "${doc.value}"\n`;
      yaml += `    scope: ${doc.scope.type}\n`;
      yaml += `    usage_count: ${doc.usage.count}\n`;
      yaml += `    tags: [${doc.tags.join(', ')}]\n`;
    }
    
    return yaml;
  }

  private generateMarkdownIndex(index: DocumentationIndex): string {
    return `# CSS Custom Properties Documentation Index

Generated on: ${new Date(index.timestamp).toLocaleString()}

## Project Information

- **Name:** ${index.project.projectName}
- **Version:** ${index.project.version}
- **Generated by:** ${index.project.generatedBy}

## Summary

- **Total Variables:** ${index.summary.totalVariables}
- **Total Usages:** ${index.summary.totalUsages}
- **Files Analyzed:** ${index.summary.filesAnalyzed}

### Variables by Category

${Object.entries(index.summary.byCategory).map(([category, count]) => 
  `- **${category}:** ${count} variables`
).join('\n')}

### Variables by Scope

${Object.entries(index.summary.byScope).map(([scope, count]) => 
  `- **${scope}:** ${count} variables`
).join('\n')}

## Categories

${index.categories.map(cat => 
  `- [${cat.category}](${cat.documentationFile}) - ${cat.count} variables`
).join('\n')}

## All Variables

${index.variables.map(variable => 
  `- [\`${variable.name}\`](${variable.documentationFile}) - ${variable.category} (${variable.usageCount} usages)`
).join('\n')}
`;
  }

  // Helper methods (implementation details would continue...)
  
  private determineValueType(value: string): ValueInfo['type'] {
    if (this.isColorValue(value)) return 'color';
    if (this.isSizeValue(value)) return 'size';
    if (value.includes('font')) return 'font';
    if (/^\d+(\.\d+)?$/.test(value)) return 'number';
    if (value.includes('calc(') || value.includes('var(')) return 'complex';
    return 'string';
  }

  private parseValueComponents(value: string): ValueComponent[] {
    // Simplified component parsing
    return [{
      type: 'string',
      value: value,
      description: 'Raw value'
    }];
  }

  private getValidValues(type: ValueInfo['type'], value: string): string[] | undefined {
    if (type === 'color') {
      return ['color names', 'hex values', 'rgb()', 'hsl()', 'transparent'];
    }
    return undefined;
  }

  private generateDefaultFallback(type: ValueInfo['type'], value: string): string {
    switch (type) {
      case 'color': return 'transparent';
      case 'size': return '0';
      case 'font': return 'inherit';
      default: return 'initial';
    }
  }

  private analyzeBrowserSupport(value: string): BrowserSupport {
    return {
      supported: ['Chrome 49+', 'Firefox 31+', 'Safari 9.1+', 'Edge 16+'],
      partial: [],
      unsupported: ['IE 11'],
      polyfills: ['css-vars-ponyfill']
    };
  }

  private analyzeUsagePatterns(usages: CustomPropertyUsage[]): UsagePattern[] {
    // Simplified pattern analysis
    const patterns: UsagePattern[] = [];
    
    const propertyFrequency = usages.reduce((acc, usage) => {
      acc[usage.cssProperty] = (acc[usage.cssProperty] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    for (const [property, frequency] of Object.entries(propertyFrequency)) {
      if (frequency > 1) {
        patterns.push({
          name: `${property} Usage`,
          description: `Used in ${property} declarations`,
          frequency,
          examples: usages.filter(u => u.cssProperty === property).map(u => u.selector).slice(0, 3)
        });
      }
    }

    return patterns;
  }

  private findCircularDependencies(variableName: string, variableMap: VariableMap): string[] {
    // Simplified circular dependency detection
    return [];
  }

  private calculateDependencyDepth(variableName: string, variableMap: VariableMap): number {
    // Simplified depth calculation
    return 0;
  }

  private groupByCategory(documentation: VariableDocumentation[]): Map<string, VariableDocumentation[]> {
    const groups = new Map<string, VariableDocumentation[]>();
    
    for (const doc of documentation) {
      const category = doc.category;
      if (!groups.has(category)) {
        groups.set(category, []);
      }
      groups.get(category)!.push(doc);
    }
    
    return groups;
  }

  private createCategoryIndex(documentation: VariableDocumentation[]): CategoryIndex[] {
    const categories = new Map<VariableCategory, VariableDocumentation[]>();
    
    for (const doc of documentation) {
      if (!categories.has(doc.category)) {
        categories.set(doc.category, []);
      }
      categories.get(doc.category)!.push(doc);
    }

    return Array.from(categories.entries()).map(([category, variables]) => ({
      category,
      count: variables.length,
      description: `Variables related to ${category}`,
      documentationFile: `${category}.md`,
      variables: variables.map(v => v.name)
    }));
  }

  private createFileIndex(variableMap: VariableMap): FileIndex[] {
    const files = new Map<string, { declared: string[], used: string[] }>();
    
    // Collect declarations
    for (const [name, declarations] of variableMap.declarations) {
      for (const declaration of declarations) {
        if (!files.has(declaration.filePath)) {
          files.set(declaration.filePath, { declared: [], used: [] });
        }
        files.get(declaration.filePath)!.declared.push(name);
      }
    }

    // Collect usages
    for (const [name, usages] of variableMap.usages) {
      for (const usage of usages) {
        if (!files.has(usage.filePath)) {
          files.set(usage.filePath, { declared: [], used: [] });
        }
        files.get(usage.filePath)!.used.push(name);
      }
    }

    return Array.from(files.entries()).map(([filePath, data]) => ({
      filePath,
      declared: [...new Set(data.declared)],
      used: [...new Set(data.used)],
      fileSize: 0, // Would need actual file reading
      lastModified: new Date().toISOString()
    }));
  }

  private createVariableIndex(documentation: VariableDocumentation[]): VariableIndex[] {
    return documentation.map(doc => ({
      name: doc.name,
      category: doc.category,
      scope: doc.scope.type,
      usageCount: doc.usage.count,
      documentationFile: `${doc.category}.md#${doc.name.toLowerCase()}`
    }));
  }

  private isColorValue(value: string): boolean {
    return /^(#[0-9a-fA-F]{3,8}|rgb\(|rgba\(|hsl\(|hsla\()/.test(value.trim());
  }

  private isSizeValue(value: string): boolean {
    return /^\d+(\.\d+)?(px|em|rem|%|vh|vw|pt|pc|in|cm|mm|ex|ch|vmin|vmax)$/.test(value.trim());
  }
}

/**
 * Utility function to create a documentation generator
 */
export function createCustomPropertyDocumentationGenerator(
  config: Partial<DocumentationConfiguration> = {}
): CustomPropertyDocumentationGenerator {
  return new CustomPropertyDocumentationGenerator(config);
}

/**
 * Utility function to generate documentation
 */
export async function generateCustomPropertyDocumentation(
  variableMap: VariableMap,
  config: Partial<DocumentationConfiguration> = {},
  optimizationReport?: OptimizationReport,
  preservationReport?: PreservationReport
): Promise<{ files: string[]; index: DocumentationIndex }> {
  const generator = createCustomPropertyDocumentationGenerator(config);
  return await generator.generateDocumentation(variableMap, optimizationReport, preservationReport);
}