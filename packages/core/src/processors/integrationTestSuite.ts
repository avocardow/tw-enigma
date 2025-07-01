import { Logger } from '../utils/logger';
import { ASTTemplateParser } from './astTemplateParser';
import { DynamicClassAPI } from './dynamicClassAPI';
import { FallbackHandler } from './fallbackHandler';
import { TemplateLiteralDetector } from './templateLiteralDetector';
import { TemplateLiteralPerformanceTester } from './templateLiteralPerformanceTester';
import type { ProcessingContext } from './types';

export interface TestCase {
  name: string;
  input: string;
  expectedOutput?: any;
  shouldFail?: boolean;
  expectedError?: string;
  category: 'standard' | 'edge' | 'error';
  description: string;
}

export interface TestResult {
  name: string;
  passed: boolean;
  error?: Error;
  executionTime: number;
  output?: any;
  category: string;
}

export interface TestSuiteResult {
  totalTests: number;
  passedTests: number;
  failedTests: number;
  executionTime: number;
  coverage: {
    detection: number;
    parsing: number;
    runtime: number;
    fallback: number;
  };
  results: TestResult[];
  summary: string;
}

export interface IntegrationTestConfig {
  timeout: number;
  verbose: boolean;
  stopOnFirstFailure: boolean;
  coverageThreshold: number;
  categories: Array<'standard' | 'edge' | 'error'>;
  performanceBaselines?: {
    detectionTime: number;
    parsingTime: number;
    generationTime: number;
  };
}

export class IntegrationTestSuite {
  private detector: TemplateLiteralDetector;
  private parser: ASTTemplateParser;
  private api: DynamicClassAPI;
  private fallbackHandler: FallbackHandler;
  private performanceTester: TemplateLiteralPerformanceTester;
  private logger: Logger;
  private config: IntegrationTestConfig;

  constructor(config: Partial<IntegrationTestConfig> = {}) {
    this.config = {
      timeout: 30000,
      verbose: false,
      stopOnFirstFailure: false,
      coverageThreshold: 80,
      categories: ['standard', 'edge', 'error'],
      ...config,
    };

    this.logger = new Logger({ component: 'IntegrationTestSuite' });

    this.detector = new TemplateLiteralDetector({
      includeTagged: true,
      includeMultiline: true,
      maxLength: 10000,
    });
    
    this.parser = new ASTTemplateParser({
      typescript: true,
      jsx: true,
      plugins: ['decorators', 'classProperties'],
    });
    
    this.api = new DynamicClassAPI({
      cache: true,
      cacheTTL: 300000,
      optimization: 'basic',
    });
    
    this.fallbackHandler = new FallbackHandler();
    
    this.performanceTester = new TemplateLiteralPerformanceTester({
      iterations: 50,
      complexityLevels: ['simple', 'moderate'],
      enableMemoryProfiling: false,
      enableConcurrencyTesting: false,
      maxTestDuration: 10000,
      workerThreads: 1,
    });
  }

  public async runAllTests(): Promise<TestSuiteResult> {
    const startTime = Date.now();
    const testCases = this.generateTestCases();
    const results: TestResult[] = [];
    let passedTests = 0;
    let failedTests = 0;

    this.logger.info(`Starting integration test suite with ${testCases.length} test cases`);

    for (const testCase of testCases) {
      if (!this.config.categories.includes(testCase.category)) {
        continue;
      }

      try {
        const result = await this.executeTestCase(testCase);
        results.push(result);

        if (result.passed) {
          passedTests++;
        } else {
          failedTests++;
          if (this.config.stopOnFirstFailure) {
            break;
          }
        }

        if (this.config.verbose) {
          this.logger.info(`Test "${testCase.name}": ${result.passed ? 'PASSED' : 'FAILED'}`);
        }
      } catch (error) {
        const result: TestResult = {
          name: testCase.name,
          passed: false,
          error: error as Error,
          executionTime: 0,
          category: testCase.category,
        };
        results.push(result);
        failedTests++;

        if (this.config.stopOnFirstFailure) {
          break;
        }
      }
    }

    const totalTime = Date.now() - startTime;
    const coverage = await this.calculateCoverage(results);

    const suiteResult: TestSuiteResult = {
      totalTests: results.length,
      passedTests,
      failedTests,
      executionTime: totalTime,
      coverage,
      results,
      summary: this.generateSummary(passedTests, failedTests, totalTime, coverage),
    };

    this.logger.info(suiteResult.summary);
    return suiteResult;
  }

  private async executeTestCase(testCase: TestCase): Promise<TestResult> {
    const startTime = Date.now();

    try {
      // End-to-end pipeline test
      const detectionResult = await this.testDetection(testCase.input);
      const parsingResult = await this.testParsing(testCase.input);
      const runtimeResult = await this.testRuntimeGeneration(testCase.input);
      const fallbackResult = await this.testFallbackHandling(testCase.input);

      const executionTime = Date.now() - startTime;

      // Validate expected outcomes
      if (testCase.shouldFail) {
        return {
          name: testCase.name,
          passed:
            detectionResult.error !== undefined ||
            parsingResult.error !== undefined ||
            runtimeResult.error !== undefined,
          executionTime,
          category: testCase.category,
          output: { detectionResult, parsingResult, runtimeResult, fallbackResult },
        };
      }

      // Check for successful execution
      const allSuccessful =
        detectionResult.success && parsingResult.success && runtimeResult.success;

      return {
        name: testCase.name,
        passed: allSuccessful,
        executionTime,
        category: testCase.category,
        output: { detectionResult, parsingResult, runtimeResult, fallbackResult },
      };
    } catch (error) {
      return {
        name: testCase.name,
        passed: false,
        error: error as Error,
        executionTime: Date.now() - startTime,
        category: testCase.category,
      };
    }
  }

  private async testDetection(
    input: string
  ): Promise<{ success: boolean; error?: Error; result?: any }> {
    try {
      const result = this.detector.detect(input);
      return { success: true, result };
    } catch (error) {
      return { success: false, error: error as Error };
    }
  }

  private async testParsing(
    input: string
  ): Promise<{ success: boolean; error?: Error; result?: any }> {
    try {
      const result = this.parser.parse(input, { filePath: 'test.js' });
      return { success: true, result };
    } catch (error) {
      return { success: false, error: error as Error };
    }
  }

  private async testRuntimeGeneration(
    input: string
  ): Promise<{ success: boolean; error?: Error; result?: any }> {
    try {
      const context: ProcessingContext = {
        variables: {
          variant: 'primary',
          isActive: true,
          theme: { mode: 'dark' },
        },
      };
      const result = await this.api.generateClasses(input, context);
      return { success: true, result };
    } catch (error) {
      return { success: false, error: error as Error };
    }
  }

  private async testFallbackHandling(
    input: string
  ): Promise<{ success: boolean; error?: Error; result?: any }> {
    try {
      const context: ProcessingContext = {
        variables: {
          variant: 'primary',
          isActive: true,
        },
      };
      const result = await this.fallbackHandler.processWithFallback(
        input,
        context,
        new Error('Simulated test error')
      );
      return { success: true, result };
    } catch (error) {
      return { success: false, error: error as Error };
    }
  }

  private generateTestCases(): TestCase[] {
    return [
      // Standard cases
      {
        name: 'Basic Template Literal',
        input: '`hello ${world}`',
        category: 'standard',
        description: 'Basic template literal with single expression',
      },
      {
        name: 'Multi-line Template',
        input: `\`line1
        \${variable}
        line3\``,
        category: 'standard',
        description: 'Multi-line template literal',
      },
      {
        name: 'Nested Template Expressions',
        input: '`outer ${`inner ${nested}`} outer`',
        category: 'standard',
        description: 'Template literal with nested template expressions',
      },
      {
        name: 'Tagged Template Literal',
        input: 'css`color: ${color}; background: ${bg};`',
        category: 'standard',
        description: 'Tagged template literal for CSS-in-JS',
      },
      {
        name: 'Conditional Class Generation',
        input: '`base-class ${isActive ? "active" : ""} ${variant}-class`',
        category: 'standard',
        description: 'Template with conditional class names',
      },
      {
        name: 'Complex Expression',
        input: '`${baseClasses.join(" ")} ${computeVariant(props)} ${theme[mode]}`',
        category: 'standard',
        description: 'Template with complex expressions',
      },

      // Edge cases
      {
        name: 'Empty Template',
        input: '``',
        category: 'edge',
        description: 'Empty template literal',
      },
      {
        name: 'Template with Escaped Backticks',
        input: '`hello \\`world\\` test`',
        category: 'edge',
        description: 'Template literal with escaped backticks',
      },
      {
        name: 'Deeply Nested Templates',
        input: '`level1 ${`level2 ${`level3 ${`level4`}`}`}`',
        category: 'edge',
        description: 'Deeply nested template literals',
      },
      {
        name: 'Template with Unicode',
        input: '`Hello 世界 ${emoji} 🌍`',
        category: 'edge',
        description: 'Template literal with Unicode characters',
      },
      {
        name: 'Large Template Literal',
        input: '`' + 'x'.repeat(10000) + ' ${variable} ' + 'y'.repeat(10000) + '`',
        category: 'edge',
        description: 'Very large template literal',
      },
      {
        name: 'Template with Special Characters',
        input: '`class-${variant.replace(/[^a-zA-Z0-9]/g, "-")} ${props["data-test"]}`',
        category: 'edge',
        description: 'Template with special character handling',
      },

      // Error cases
      {
        name: 'Malformed Template',
        input: '`unclosed template ${expression',
        category: 'error',
        shouldFail: true,
        description: 'Malformed template literal',
      },
      {
        name: 'Invalid JavaScript Expression',
        input: '`hello ${invalid..syntax} world`',
        category: 'error',
        shouldFail: true,
        description: 'Template with invalid JavaScript expression',
      },
      {
        name: 'Circular Reference in Expression',
        input: '`${obj.prop.obj.prop.obj.prop}`',
        category: 'error',
        shouldFail: true,
        description: 'Template with potential circular reference',
      },
      {
        name: 'Undefined Variables',
        input: '`${undefinedVariable} ${anotherUndefined}`',
        category: 'error',
        shouldFail: true,
        description: 'Template with undefined variables',
      },
      {
        name: 'Non-string Template',
        input: 123 as any,
        category: 'error',
        shouldFail: true,
        description: 'Non-string input to template processor',
      },
      {
        name: 'Null Input',
        input: null as any,
        category: 'error',
        shouldFail: true,
        description: 'Null input to template processor',
      },
    ];
  }

  private async calculateCoverage(results: TestResult[]): Promise<TestSuiteResult['coverage']> {
    const categoryResults = {
      detection: 0,
      parsing: 0,
      runtime: 0,
      fallback: 0,
    };

    let totalTests = 0;

    for (const result of results) {
      if (result.output && typeof result.output === 'object') {
        totalTests++;
        if (result.output.detectionResult?.success) categoryResults.detection++;
        if (result.output.parsingResult?.success) categoryResults.parsing++;
        if (result.output.runtimeResult?.success) categoryResults.runtime++;
        if (result.output.fallbackResult?.success) categoryResults.fallback++;
      }
    }

    return {
      detection: totalTests > 0 ? (categoryResults.detection / totalTests) * 100 : 0,
      parsing: totalTests > 0 ? (categoryResults.parsing / totalTests) * 100 : 0,
      runtime: totalTests > 0 ? (categoryResults.runtime / totalTests) * 100 : 0,
      fallback: totalTests > 0 ? (categoryResults.fallback / totalTests) * 100 : 0,
    };
  }

  private generateSummary(
    passed: number,
    failed: number,
    totalTime: number,
    coverage: TestSuiteResult['coverage']
  ): string {
    const total = passed + failed;
    const passRate = total > 0 ? (passed / total) * 100 : 0;

    return `
Integration Test Suite Results:
==============================
Total Tests: ${total}
Passed: ${passed} (${passRate.toFixed(1)}%)
Failed: ${failed}
Execution Time: ${totalTime}ms

Coverage:
- Detection: ${coverage.detection.toFixed(1)}%
- Parsing: ${coverage.parsing.toFixed(1)}%
- Runtime: ${coverage.runtime.toFixed(1)}%
- Fallback: ${coverage.fallback.toFixed(1)}%

Overall Status: ${failed === 0 ? 'SUCCESS' : 'FAILURES DETECTED'}
    `.trim();
  }

  public async runPerformanceTests(): Promise<{ performanceResults: any }> {
    this.logger.info('Running performance tests...');

    const performanceResults = await this.performanceTester.runFullTestSuite();

    return { performanceResults };
  }

  public async validateEndToEndWorkflow(): Promise<boolean> {
    const testInput = `
      const dynamicClasses = \`
        base-class
        \${isActive ? 'active' : 'inactive'}
        \${variant}-variant
        \${theme.mode === 'dark' ? 'dark-theme' : 'light-theme'}
      \`;
    `;

    try {
      // Full pipeline test
      const detected = this.detector.detect(testInput);
      const parsed = this.parser.parse(testInput, { filePath: 'e2e-test.js' });
      const context: ProcessingContext = {
        variables: {
          isActive: true,
          variant: 'primary',
          theme: { mode: 'dark' },
        },
      };
      const classes = await this.api.generateClasses(testInput, context);

      return detected.templates.length > 0 && parsed.templates.length > 0 && classes.classes.length > 0;
    } catch (error) {
      this.logger.error('End-to-end workflow validation failed', { error });
      return false;
    }
  }
}

// Export factory function for easy instantiation
export function createIntegrationTestSuite(
  config?: Partial<IntegrationTestConfig>
): IntegrationTestSuite {
  return new IntegrationTestSuite(config);
}

// Export utility functions for test automation
export async function runQuickValidation(): Promise<boolean> {
  const suite = createIntegrationTestSuite({
    categories: ['standard'],
    stopOnFirstFailure: true,
    timeout: 10000,
  });

  const result = await suite.runAllTests();
  return result.failedTests === 0;
}

export async function runFullTestSuite(): Promise<TestSuiteResult> {
  const suite = createIntegrationTestSuite({
    verbose: true,
    coverageThreshold: 90,
  });

  return await suite.runAllTests();
}
