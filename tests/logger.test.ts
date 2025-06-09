import { describe, it, expect, beforeEach, afterEach, vi, Mock } from 'vitest';
import { Logger, LogLevel, LogLevelNames, logger, createLogger, ErrorContext } from '../src/logger.js';

// Mock console methods
const originalConsoleLog = console.log;
const originalConsoleError = console.error;
let consoleOutput: string[] = [];
let errorOutput: string[] = [];

describe('Logger', () => {
  beforeEach(() => {
    consoleOutput = [];
    errorOutput = [];
    
    // Mock console.log and console.error
    console.log = vi.fn().mockImplementation((message: string) => {
      consoleOutput.push(message);
    });
    console.error = vi.fn().mockImplementation((message: string) => {
      errorOutput.push(message);
    });
  });

  afterEach(() => {
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
    vi.clearAllMocks();
  });

  describe('LogLevel', () => {
    it('should have correct numeric values for log levels', () => {
      expect(LogLevel.TRACE).toBe(0);
      expect(LogLevel.DEBUG).toBe(1);
      expect(LogLevel.INFO).toBe(2);
      expect(LogLevel.WARN).toBe(3);
      expect(LogLevel.ERROR).toBe(4);
      expect(LogLevel.FATAL).toBe(5);
    });

    it('should have correct level names', () => {
      expect(LogLevelNames[LogLevel.TRACE]).toBe('TRACE');
      expect(LogLevelNames[LogLevel.DEBUG]).toBe('DEBUG');
      expect(LogLevelNames[LogLevel.INFO]).toBe('INFO');
      expect(LogLevelNames[LogLevel.WARN]).toBe('WARN');
      expect(LogLevelNames[LogLevel.ERROR]).toBe('ERROR');
      expect(LogLevelNames[LogLevel.FATAL]).toBe('FATAL');
    });
  });

  describe('Logger Constructor', () => {
    it('should create logger with default options', () => {
      const testLogger = new Logger();
      
      testLogger.info('test message');
      
      expect(consoleOutput).toHaveLength(1);
      expect(consoleOutput[0]).toContain('INFO');
      expect(consoleOutput[0]).toContain('test message');
    });

    it('should create logger with custom options', () => {
      const testLogger = new Logger({
        level: LogLevel.DEBUG,
        verbose: true,
        outputFormat: 'json',
        colorize: false,
        component: 'TestComponent',
      });
      
      testLogger.debug('debug message');
      
      expect(consoleOutput).toHaveLength(1);
      const logEntry = JSON.parse(consoleOutput[0]);
      expect(logEntry.level).toBe('DEBUG');
      expect(logEntry.message).toBe('debug message');
      expect(logEntry.component).toBe('TestComponent');
    });

    it('should respect silent mode', () => {
      const testLogger = new Logger({ silent: true });
      
      testLogger.error('silent error');
      
      expect(consoleOutput).toHaveLength(0);
    });
  });

  describe('Log Level Filtering', () => {
    it('should respect log level threshold', () => {
      const testLogger = new Logger({ level: LogLevel.WARN });
      
      testLogger.trace('trace message');
      testLogger.debug('debug message');
      testLogger.info('info message');
      testLogger.warn('warn message');
      testLogger.error('error message');
      testLogger.fatal('fatal message');
      
      expect(consoleOutput).toHaveLength(3); // Only WARN, ERROR, FATAL
      expect(consoleOutput[0]).toContain('WARN');
      expect(consoleOutput[1]).toContain('ERROR');
      expect(consoleOutput[2]).toContain('FATAL');
    });

    it('should set log level dynamically', () => {
      const testLogger = new Logger({ level: LogLevel.ERROR });
      
      testLogger.info('info message 1');
      expect(consoleOutput).toHaveLength(0);
      
      testLogger.setLevel(LogLevel.INFO);
      testLogger.info('info message 2');
      expect(consoleOutput).toHaveLength(1);
    });

    it('should enable verbose mode correctly', () => {
      const testLogger = new Logger({ level: LogLevel.INFO });
      
      testLogger.setVerbose(true);
      testLogger.debug('debug message');
      
      expect(consoleOutput).toHaveLength(1);
      expect(consoleOutput[0]).toContain('DEBUG');
    });
  });

  describe('Output Formats', () => {
    it('should format human-readable output correctly', () => {
      const testLogger = new Logger({
        outputFormat: 'human',
        colorize: false,
        timestamp: false,
      });
      
      testLogger.info('test message');
      
      expect(consoleOutput[0]).toMatch(/^INFO\s+test message$/);
    });

    it('should format JSON output correctly', () => {
      const testLogger = new Logger({
        outputFormat: 'json',
        component: 'TestComponent',
      });
      
      testLogger.info('json test message');
      
      const logEntry = JSON.parse(consoleOutput[0]);
      expect(logEntry.level).toBe('INFO');
      expect(logEntry.message).toBe('json test message');
      expect(logEntry.component).toBe('TestComponent');
      expect(logEntry.timestamp).toBeDefined();
    });

    it('should include context in output', () => {
      const testLogger = new Logger({ outputFormat: 'json' });
      const context: ErrorContext = {
        operation: 'testOperation',
        filePath: '/test/file.js',
        userId: 'test-user',
      };
      
      testLogger.info('context test', context);
      
      const logEntry = JSON.parse(consoleOutput[0]);
      expect(logEntry.context).toEqual(context);
    });

    it('should format timestamps correctly', () => {
      const testLogger = new Logger({
        outputFormat: 'human',
        colorize: false,
        timestamp: true,
      });
      
      testLogger.info('timestamp test');
      
      // Account for potential ANSI color codes and match the timestamp pattern
      expect(consoleOutput[0]).toMatch(/\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\]/);
    });
  });

  describe('Error Logging', () => {
    it('should log Error objects with stack traces', () => {
      const testLogger = new Logger({
        outputFormat: 'json',
      });
      const testError = new Error('Test error message');
      
      testLogger.error(testError);
      
      const logEntry = JSON.parse(consoleOutput[0]);
      expect(logEntry.level).toBe('ERROR');
      expect(logEntry.message).toBe('Test error message');
      expect(logEntry.error).toBeDefined();
      expect(logEntry.error.name).toBe('Error');
      expect(logEntry.error.message).toBe('Test error message');
      expect(logEntry.error.stack).toBeDefined();
    });

    it('should log string error messages', () => {
      const testLogger = new Logger({ outputFormat: 'json' });
      
      testLogger.error('String error message');
      
      const logEntry = JSON.parse(consoleOutput[0]);
      expect(logEntry.level).toBe('ERROR');
      expect(logEntry.message).toBe('String error message');
      expect(logEntry.error).toBeUndefined();
    });

    it('should handle fatal errors correctly', () => {
      const testLogger = new Logger({ outputFormat: 'json' });
      const fatalError = new Error('Fatal error');
      
      testLogger.fatal(fatalError);
      
      const logEntry = JSON.parse(consoleOutput[0]);
      expect(logEntry.level).toBe('FATAL');
      expect(logEntry.error.name).toBe('Error');
    });
  });

  describe('Child Loggers', () => {
    it('should create child loggers with inherited settings', () => {
      const parentLogger = new Logger({
        level: LogLevel.DEBUG,
        outputFormat: 'json',
        verbose: true,
      });
      
      const childLogger = parentLogger.child('ChildComponent');
      childLogger.info('child message');
      
      const logEntry = JSON.parse(consoleOutput[0]);
      expect(logEntry.level).toBe('INFO');
      expect(logEntry.message).toBe('child message');
      expect(logEntry.component).toBe('ChildComponent');
    });

    it('should allow child loggers to override parent settings', () => {
      const parentLogger = new Logger({
        level: LogLevel.INFO,
        outputFormat: 'human',
      });
      
      const childLogger = parentLogger.child('ChildComponent', {
        level: LogLevel.DEBUG,
        outputFormat: 'json',
      });
      
      childLogger.debug('child debug message');
      
      const logEntry = JSON.parse(consoleOutput[0]);
      expect(logEntry.level).toBe('DEBUG');
      expect(logEntry.component).toBe('ChildComponent');
    });
  });

  describe('Performance Timing', () => {
    it('should log performance timing correctly', () => {
      const testLogger = new Logger({ 
        outputFormat: 'json',
        level: LogLevel.DEBUG // Ensure DEBUG level is enabled
      });
      const operation = 'file-processing';
      const duration = 1234;
      
      testLogger.timing(operation, duration);
      
      expect(consoleOutput).toHaveLength(1);
      const logEntry = JSON.parse(consoleOutput[0]);
      expect(logEntry.level).toBe('DEBUG');
      expect(logEntry.message).toContain(operation);
      expect(logEntry.message).toContain('1234ms');
      expect(logEntry.context.operation).toBe(operation);
      expect(logEntry.context.processingTime).toBe(duration);
    });

    it('should include additional context in timing logs', () => {
      const testLogger = new Logger({ 
        outputFormat: 'json',
        level: LogLevel.DEBUG // Ensure DEBUG level is enabled
      });
      const context: ErrorContext = {
        filePath: '/test/file.js',
        userId: 'test-user',
      };
      
      testLogger.timing('test-operation', 500, context);
      
      expect(consoleOutput).toHaveLength(1);
      const logEntry = JSON.parse(consoleOutput[0]);
      expect(logEntry.context.filePath).toBe('/test/file.js');
      expect(logEntry.context.userId).toBe('test-user');
      expect(logEntry.context.operation).toBe('test-operation');
      expect(logEntry.context.processingTime).toBe(500);
    });
  });

  describe('Default Logger Instance', () => {
    it('should have sensible defaults for development', async () => {
      // Mock process.env for this test
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';
      
      // Import again to get fresh instance with new env
      vi.resetModules();
      const { logger: devLogger } = await import('../src/logger.js');
      
      devLogger.debug('dev debug message');
      
      expect(consoleOutput).toHaveLength(1);
      expect(consoleOutput[0]).toContain('DEBUG');
      
      process.env.NODE_ENV = originalEnv;
    });

    it('should respect environment variables', async () => {
      const originalVerbose = process.env.ENIGMA_VERBOSE;
      const originalNodeEnv = process.env.NODE_ENV;
      
      process.env.ENIGMA_VERBOSE = 'true';
      process.env.NODE_ENV = 'development'; // Ensure DEBUG level is enabled
      
      vi.resetModules();
      const { logger: verboseLogger } = await import('../src/logger.js');
      
      verboseLogger.debug('verbose debug message');
      
      expect(consoleOutput).toHaveLength(1);
      
      process.env.ENIGMA_VERBOSE = originalVerbose;
      process.env.NODE_ENV = originalNodeEnv;
    });
  });

  describe('createLogger Helper', () => {
    it('should create component-specific loggers', () => {
      const componentLogger = createLogger('TestComponent');
      componentLogger.info('component message');
      
      // Should contain component name in human-readable format
      expect(consoleOutput[0]).toContain('[TestComponent]');
    });

    it('should pass through custom options', () => {
      const customLogger = createLogger('CustomComponent', {
        outputFormat: 'json',
        level: LogLevel.DEBUG,
      });
      
      customLogger.debug('custom debug message');
      
      const logEntry = JSON.parse(consoleOutput[0]);
      expect(logEntry.level).toBe('DEBUG');
      expect(logEntry.component).toBe('CustomComponent');
    });
  });

  describe('Edge Cases', () => {
    it('should handle undefined context gracefully', () => {
      const testLogger = new Logger({ outputFormat: 'json' });
      
      testLogger.info('message with undefined context', undefined);
      
      const logEntry = JSON.parse(consoleOutput[0]);
      expect(logEntry.context).toBeUndefined();
    });

    it('should handle empty context objects', () => {
      const testLogger = new Logger({ outputFormat: 'json' });
      
      testLogger.info('message with empty context', {});
      
      const logEntry = JSON.parse(consoleOutput[0]);
      expect(logEntry.context).toBeUndefined();
    });

    it('should handle complex context objects', () => {
      const testLogger = new Logger({ outputFormat: 'json' });
      const complexContext: ErrorContext = {
        operation: 'complex-test',
        nested: {
          value: 42,
          array: [1, 2, 3],
          boolean: true,
        } as any,
      };
      
      testLogger.info('complex context message', complexContext);
      
      const logEntry = JSON.parse(consoleOutput[0]);
      expect(logEntry.context.operation).toBe('complex-test');
      expect(logEntry.context.nested).toEqual({
        value: 42,
        array: [1, 2, 3],
        boolean: true,
      });
    });

    it('should handle very long messages', () => {
      const testLogger = new Logger({ outputFormat: 'json' });
      const longMessage = 'A'.repeat(10000);
      
      testLogger.info(longMessage);
      
      const logEntry = JSON.parse(consoleOutput[0]);
      expect(logEntry.message).toBe(longMessage);
      expect(logEntry.message).toHaveLength(10000);
    });
  });

  describe('Integration Tests', () => {
    it('should work correctly with multiple loggers', () => {
      const logger1 = new Logger({
        component: 'Component1',
        outputFormat: 'json',
      });
      const logger2 = new Logger({
        component: 'Component2',
        outputFormat: 'json',
      });
      
      logger1.info('message from component 1');
      logger2.warn('warning from component 2');
      
      expect(consoleOutput).toHaveLength(2);
      
      const entry1 = JSON.parse(consoleOutput[0]);
      const entry2 = JSON.parse(consoleOutput[1]);
      
      expect(entry1.component).toBe('Component1');
      expect(entry1.level).toBe('INFO');
      expect(entry2.component).toBe('Component2');
      expect(entry2.level).toBe('WARN');
    });

    it('should maintain context across multiple log calls', () => {
      const testLogger = createLogger('ContextTest');
      const context: ErrorContext = {
        operation: 'multi-step-process',
        requestId: 'req-123',
      };
      
      testLogger.info('Step 1 starting', context);
      testLogger.debug('Step 1 processing', context);
      testLogger.info('Step 1 completed', context);
      
      expect(consoleOutput).toHaveLength(2); // DEBUG filtered out by default
      consoleOutput.forEach(output => {
        expect(output).toContain('[ContextTest]');
        if (testLogger['outputFormat'] === 'json') {
          const entry = JSON.parse(output);
          expect(entry.context?.operation).toBe('multi-step-process');
          expect(entry.context?.requestId).toBe('req-123');
        }
      });
    });
  });
}); 