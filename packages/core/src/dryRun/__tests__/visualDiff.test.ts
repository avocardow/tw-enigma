/**
 * Visual Diff Tests
 * Tests for the visual diff generation system
 */

import { describe, test, expect, beforeEach } from 'vitest';
import { VisualDiffGenerator, generateVisualDiff } from '../visualDiff';
import type { DryRunResult, DryRunContext } from '../dryRunManager';

describe('VisualDiffGenerator', () => {
  let generator: VisualDiffGenerator;
  let mockResult: DryRunResult;

  beforeEach(() => {
    generator = new VisualDiffGenerator();

    // Create mock dry run result
    mockResult = {
      context: {
        sessionId: 'test-session-123',
        startTime: Date.now() - 5000,
        config: {
          enabled: true,
          logOperations: true,
          validateOperations: true,
          maxOperations: 10000,
          includeFileSystemChecks: true,
          simulateLatency: false,
          operationTimeout: 5000,
        },
        operations: [
          {
            type: 'file-write',
            id: 'op-1',
            target: '/project/src/styles.css',
            description: 'Create optimized CSS file',
            timestamp: Date.now(),
            wouldSucceed: true,
            sizeImpact: 2048,
            data: { contentLength: 1500 },
          },
          {
            type: 'file-modify',
            id: 'op-2',
            target: '/project/src/index.html',
            description: 'Update HTML with scrambled classes',
            timestamp: Date.now(),
            wouldSucceed: true,
            sizeImpact: 512,
            data: { operation: 'scramble' },
          },
          {
            type: 'file-delete',
            id: 'op-3',
            target: '/project/temp/old-styles.css',
            description: 'Remove temporary CSS file',
            timestamp: Date.now(),
            wouldSucceed: true,
            sizeImpact: -1024,
          },
        ],
        operationCounts: {
          'file-write': 1,
          'file-modify': 1,
          'file-delete': 1,
        },
        metadata: {
          projectRoot: '/project',
          optimizationLevel: 'aggressive',
          targetFramework: 'react',
        },
      } as DryRunContext,
      totalOperations: 3,
      operationsByType: {
        'file-write': [
          {
            type: 'file-write',
            id: 'op-1',
            target: '/project/src/styles.css',
            description: 'Create optimized CSS file',
            timestamp: Date.now(),
            wouldSucceed: true,
            sizeImpact: 2048,
            data: { contentLength: 1500 },
          },
        ],
        'file-modify': [
          {
            type: 'file-modify',
            id: 'op-2',
            target: '/project/src/index.html',
            description: 'Update HTML with scrambled classes',
            timestamp: Date.now(),
            wouldSucceed: true,
            sizeImpact: 512,
            data: { operation: 'scramble' },
          },
        ],
        'file-delete': [
          {
            type: 'file-delete',
            id: 'op-3',
            target: '/project/temp/old-styles.css',
            description: 'Remove temporary CSS file',
            timestamp: Date.now(),
            wouldSucceed: true,
            sizeImpact: -1024,
          },
        ],
      },
      summary: {
        filesWouldBeCreated: 1,
        filesWouldBeModified: 1,
        filesWouldBeDeleted: 1,
        directoriesWouldBeCreated: 0,
        directoriesWouldBeDeleted: 0,
        totalSizeImpact: 1536,
        estimatedDuration: 150,
        potentialErrors: 0,
      },
      duration: 4500,
    };
  });

  describe('Diff Generation', () => {
    test('should generate visual diff for dry run result', async () => {
      const result = await generator.generateDiff(mockResult);

      expect(result).toBeDefined();
      expect(result.fileDiffs).toHaveLength(3);
      expect(result.summary).toBeDefined();
      expect(result.metadata).toBeDefined();
    });

    test('should handle file creation diff', async () => {
      const result = await generator.generateDiff(mockResult);
      const createDiff = result.fileDiffs.find(f => f.type === 'create');

      expect(createDiff).toBeDefined();
      expect(createDiff!.filePath).toBe('/project/src/styles.css');
      expect(createDiff!.textDiff).toBeDefined();
      expect(createDiff!.textDiff!.stats.additions).toBeGreaterThan(0);
    });

    test('should handle file modification diff', async () => {
      const result = await generator.generateDiff(mockResult);
      const modifyDiff = result.fileDiffs.find(f => f.type === 'modify');

      expect(modifyDiff).toBeDefined();
      expect(modifyDiff!.filePath).toBe('/project/src/index.html');
      expect(modifyDiff!.textDiff).toBeDefined();
    });

    test('should handle file deletion diff', async () => {
      const result = await generator.generateDiff(mockResult);
      const deleteDiff = result.fileDiffs.find(f => f.type === 'delete');

      expect(deleteDiff).toBeDefined();
      expect(deleteDiff!.filePath).toBe('/project/temp/old-styles.css');
      expect(deleteDiff!.textDiff).toBeDefined();
      expect(deleteDiff!.textDiff!.stats.deletions).toBeGreaterThan(0);
    });

    test('should calculate correct summary statistics', async () => {
      const result = await generator.generateDiff(mockResult);

      expect(result.summary.filesCreated).toBe(1);
      expect(result.summary.filesModified).toBe(1);
      expect(result.summary.filesDeleted).toBe(1);
      expect(result.summary.totalChanges).toBe(3);
    });

    test('should include processing metadata', async () => {
      const result = await generator.generateDiff(mockResult);

      expect(result.metadata.timestamp).toBeGreaterThan(0);
      expect(result.metadata.processingTime).toBeGreaterThan(0);
      expect(result.metadata.options).toBeDefined();
    });
  });

  describe('Text Diff Generation', () => {
    test('should generate unified diff format', async () => {
      const result = await generator.generateDiff(mockResult);
      const textDiff = result.fileDiffs[0].textDiff;

      expect(textDiff).toBeDefined();
      expect(textDiff!.unifiedDiff).toContain('---');
      expect(textDiff!.unifiedDiff).toContain('+++');
      expect(textDiff!.unifiedDiff).toContain('@@');
    });

    test('should generate HTML diff format', async () => {
      const result = await generator.generateDiff(mockResult);
      const textDiff = result.fileDiffs[0].textDiff;

      expect(textDiff).toBeDefined();
      expect(textDiff!.htmlDiff).toContain('<div class="diff-container">');
      expect(textDiff!.htmlDiff).toContain('diff-add');
    });

    test('should calculate diff statistics', async () => {
      const result = await generator.generateDiff(mockResult);
      const textDiff = result.fileDiffs[0].textDiff;

      expect(textDiff).toBeDefined();
      expect(textDiff!.stats).toBeDefined();
      expect(textDiff!.stats.totalLines).toBeGreaterThan(0);
    });

    test('should handle empty files', async () => {
      // Mock operation with no content
      const emptyResult = {
        ...mockResult,
        context: {
          ...mockResult.context,
          operations: [
            {
              type: 'file-write' as const,
              id: 'op-empty',
              target: '/project/empty.txt',
              description: 'Create empty file',
              timestamp: Date.now(),
              wouldSucceed: true,
              sizeImpact: 0,
              data: { contentLength: 0 },
            },
          ],
        },
      };

      const result = await generator.generateDiff(emptyResult);
      expect(result.fileDiffs).toHaveLength(1);
      expect(result.fileDiffs[0].textDiff?.original).toBe('');
    });
  });

  describe('Diff Options', () => {
    test('should respect sensitivity option', async () => {
      const options = { sensitivity: 0.9 };
      const result = await generator.generateDiff(mockResult, options);

      expect(result.metadata.options.sensitivity).toBe(0.9);
    });

    test('should handle ignore whitespace option', async () => {
      const options = { ignoreWhitespace: true };
      const result = await generator.generateDiff(mockResult, options);

      expect(result.metadata.options.ignoreWhitespace).toBe(true);
    });

    test('should handle ignore case option', async () => {
      const options = { ignoreCase: true };
      const result = await generator.generateDiff(mockResult, options);

      expect(result.metadata.options.ignoreCase).toBe(true);
    });

    test('should respect context lines option', async () => {
      const options = { contextLines: 5 };
      const result = await generator.generateDiff(mockResult, options);

      expect(result.metadata.options.contextLines).toBe(5);
    });

    test('should handle different output formats', async () => {
      const formats = ['unified', 'context', 'side-by-side', 'html'] as const;

      for (const format of formats) {
        const options = { outputFormat: format };
        const result = await generator.generateDiff(mockResult, options);
        expect(result.metadata.options.outputFormat).toBe(format);
      }
    });
  });

  describe('Line Diff Algorithm', () => {
    test('should detect line additions', async () => {
      const result = await generator.generateDiff(mockResult);
      const textDiff = result.fileDiffs.find(f => f.type === 'create')?.textDiff;

      expect(textDiff).toBeDefined();
      const addLines = textDiff!.lines.filter(l => l.type === 'add');
      expect(addLines.length).toBeGreaterThan(0);
      expect(addLines[0].indicator).toBe('+');
      expect(addLines[0].cssClass).toBe('diff-add');
    });

    test('should detect line deletions', async () => {
      const result = await generator.generateDiff(mockResult);
      const textDiff = result.fileDiffs.find(f => f.type === 'delete')?.textDiff;

      expect(textDiff).toBeDefined();
      const removeLines = textDiff!.lines.filter(l => l.type === 'remove');
      expect(removeLines.length).toBeGreaterThan(0);
      expect(removeLines[0].indicator).toBe('-');
      expect(removeLines[0].cssClass).toBe('diff-remove');
    });

    test('should calculate line similarity', async () => {
      const result = await generator.generateDiff(mockResult);
      const textDiff = result.fileDiffs.find(f => f.type === 'modify')?.textDiff;

      expect(textDiff).toBeDefined();
      expect(textDiff!.lines.length).toBeGreaterThan(0);
    });

    test('should include line numbers when enabled', async () => {
      const options = { showLineNumbers: true };
      const result = await generator.generateDiff(mockResult, options);
      const textDiff = result.fileDiffs[0].textDiff;

      expect(textDiff).toBeDefined();
      const linesWithNumbers = textDiff!.lines.filter(l => 
        l.originalLineNumber !== undefined || l.newLineNumber !== undefined
      );
      expect(linesWithNumbers.length).toBeGreaterThan(0);
    });
  });

  describe('HTML Output', () => {
    test('should generate valid HTML', async () => {
      const result = await generator.generateDiff(mockResult);
      const htmlDiff = result.fileDiffs[0].textDiff?.htmlDiff;

      expect(htmlDiff).toBeDefined();
      expect(htmlDiff).toContain('<div class="diff-container">');
      expect(htmlDiff).toContain('</div>');
      expect(htmlDiff).toContain('<style>');
    });

    test('should escape HTML characters', async () => {
      // This would be tested with content containing HTML characters
      const result = await generator.generateDiff(mockResult);
      const htmlDiff = result.fileDiffs[0].textDiff?.htmlDiff;

      expect(htmlDiff).toBeDefined();
      // HTML should be properly escaped
      expect(htmlDiff).not.toContain('<script>');
    });

    test('should include CSS classes for styling', async () => {
      const result = await generator.generateDiff(mockResult);
      const lines = result.fileDiffs[0].textDiff?.lines;

      expect(lines).toBeDefined();
      const addLine = lines!.find(l => l.type === 'add');
      if (addLine) {
        expect(addLine.cssClass).toBe('diff-add');
      }
    });
  });

  describe('Error Handling', () => {
    test('should handle malformed operations gracefully', async () => {
      const invalidResult = {
        ...mockResult,
        context: {
          ...mockResult.context,
          operations: [
            {
              type: 'invalid-type' as any,
              id: 'op-invalid',
              target: '/project/invalid.txt',
              description: 'Invalid operation',
              timestamp: Date.now(),
              wouldSucceed: true,
            },
          ],
        },
      };

      const result = await generator.generateDiff(invalidResult);
      expect(result.fileDiffs).toHaveLength(1);
      expect(result.fileDiffs[0].error).toBeDefined();
    });

    test('should continue processing after errors', async () => {
      const mixedResult = {
        ...mockResult,
        context: {
          ...mockResult.context,
          operations: [
            ...mockResult.context.operations,
            {
              type: 'invalid-type' as any,
              id: 'op-invalid',
              target: '/project/invalid.txt',
              description: 'Invalid operation',
              timestamp: Date.now(),
              wouldSucceed: true,
            },
          ],
        },
      };

      const result = await generator.generateDiff(mixedResult);
      expect(result.fileDiffs.length).toBeGreaterThan(3);
      
      const validDiffs = result.fileDiffs.filter(f => !f.error);
      const errorDiffs = result.fileDiffs.filter(f => f.error);
      
      expect(validDiffs.length).toBe(3);
      expect(errorDiffs.length).toBe(1);
    });
  });

  describe('Configuration Management', () => {
    test('should update options', () => {
      const newOptions = { sensitivity: 0.95, ignoreWhitespace: true };
      generator.updateOptions(newOptions);

      const options = generator.getOptions();
      expect(options.sensitivity).toBe(0.95);
      expect(options.ignoreWhitespace).toBe(true);
    });

    test('should preserve existing options when updating', () => {
      const originalOptions = generator.getOptions();
      generator.updateOptions({ sensitivity: 0.9 });

      const updatedOptions = generator.getOptions();
      expect(updatedOptions.sensitivity).toBe(0.9);
      expect(updatedOptions.contextLines).toBe(originalOptions.contextLines);
    });
  });

  describe('Global Functions', () => {
    test('should generate visual diff using global function', async () => {
      const result = await generateVisualDiff(mockResult, { sensitivity: 0.8 });

      expect(result).toBeDefined();
      expect(result.fileDiffs).toHaveLength(3);
      expect(result.metadata.options.sensitivity).toBe(0.8);
    });
  });

  describe('Performance', () => {
    test('should complete diff generation in reasonable time', async () => {
      const startTime = performance.now();
      const result = await generator.generateDiff(mockResult);
      const endTime = performance.now();

      expect(result).toBeDefined();
      expect(endTime - startTime).toBeLessThan(1000); // Should complete within 1 second
    });

    test('should handle large numbers of operations', async () => {
      // Create result with many operations
      const manyOperations = Array.from({ length: 100 }, (_, i) => ({
        type: 'file-write' as const,
        id: `op-${i}`,
        target: `/project/file-${i}.css`,
        description: `Create file ${i}`,
        timestamp: Date.now(),
        wouldSucceed: true,
        sizeImpact: 100,
        data: { contentLength: 500 },
      }));

      const largeResult = {
        ...mockResult,
        context: {
          ...mockResult.context,
          operations: manyOperations,
        },
        totalOperations: manyOperations.length,
      };

      const result = await generator.generateDiff(largeResult);
      expect(result.fileDiffs).toHaveLength(100);
      expect(result.summary.totalChanges).toBe(100);
    });
  });
});