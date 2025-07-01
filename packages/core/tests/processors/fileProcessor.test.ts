/**
 * Copyright (c) 2025 Rowan Cardow
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  FileProcessingError,
  FileProcessor,
  createFileProcessor,
  processFiles,
} from '../../src/processors/fileProcessor';

describe('FileProcessor', () => {
  let testDir: string;
  let processor: FileProcessor;

  beforeEach(async () => {
    // Create temporary directory for tests
    testDir = await fs.mkdtemp(join(tmpdir(), 'file-processor-test-'));

    processor = createFileProcessor({
      patterns: ['**/*.{html,js,ts,tsx,jsx,css}'],
      verbose: false,
      dryRun: false,
    });
  });

  afterEach(async () => {
    // Clean up test directory
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      console.warn('Failed to cleanup test directory:', error);
    }
  });

  describe('Basic Configuration and Initialization', () => {
    it('should create FileProcessor with default configuration', () => {
      const defaultProcessor = createFileProcessor({
        patterns: ['*.html'],
      });

      const config = defaultProcessor.getConfig();
      expect(config.patterns).toEqual(['*.html']);
      expect(config.defaultEncoding).toBe('utf8');
      expect(config.detectEncoding).toBe(true);
      expect(config.backup.enabled).toBe(true);
      expect(config.concurrent).toBe(true);
      expect(config.maxConcurrency).toBe(10);
    });

    it('should validate configuration on construction', () => {
      expect(() => {
        createFileProcessor({ patterns: [] });
      }).toThrow(FileProcessingError);

      expect(() => {
        createFileProcessor({
          patterns: ['*.html'],
          output: { directory: '/' },
        });
      }).toThrow(FileProcessingError);
    });

    it('should allow configuration updates', () => {
      processor.updateConfig({
        verbose: true,
        maxConcurrency: 5,
      });

      const config = processor.getConfig();
      expect(config.verbose).toBe(true);
      expect(config.maxConcurrency).toBe(5);
    });
  });

  describe('File Discovery and Glob Patterns', () => {
    beforeEach(async () => {
      // Create test files
      await fs.writeFile(join(testDir, 'index.html'), '<html><body>test</body></html>');
      await fs.writeFile(join(testDir, 'app.js'), 'console.log("test");');
      await fs.writeFile(join(testDir, 'styles.css'), 'body { margin: 0; }');
      await fs.writeFile(
        join(testDir, 'component.tsx'),
        'export const Component = () => <div>test</div>;'
      );

      // Create subdirectory with files
      const subDir = join(testDir, 'components');
      await fs.mkdir(subDir);
      await fs.writeFile(
        join(subDir, 'button.tsx'),
        'export const Button = () => <button>Click</button>;'
      );
      await fs.writeFile(join(subDir, 'ignore.txt'), 'should be ignored');
    });

    it('should discover files using glob patterns', async () => {
      processor.updateConfig({
        patterns: [join(testDir, '**/*.{html,js,css,tsx}')],
      });

      const files = await processor.discoverFiles();

      expect(files).toHaveLength(4);
      expect(files.some((f) => f.endsWith('index.html'))).toBe(true);
      expect(files.some((f) => f.endsWith('app.js'))).toBe(true);
      expect(files.some((f) => f.endsWith('styles.css'))).toBe(true);
      expect(files.some((f) => f.endsWith('component.tsx'))).toBe(true);
      expect(files.some((f) => f.endsWith('button.tsx'))).toBe(true);
    });

    it('should support exclusion patterns', async () => {
      processor.updateConfig({
        patterns: [join(testDir, '**/*')],
        exclude: ['**/*.txt', '**/components/**'],
      });

      const files = await processor.discoverFiles();

      expect(files.some((f) => f.endsWith('ignore.txt'))).toBe(false);
      expect(files.some((f) => f.endsWith('button.tsx'))).toBe(false);
    });

    it('should handle empty glob results', async () => {
      processor.updateConfig({
        patterns: [join(testDir, '**/*.nonexistent')],
      });

      const files = await processor.discoverFiles();
      expect(files).toEqual([]);
    });

    it('should handle invalid glob patterns gracefully', async () => {
      processor.updateConfig({
        patterns: ['[invalid-glob'],
        continueOnError: true,
      });

      await expect(processor.discoverFiles()).rejects.toThrow(FileProcessingError);
    });
  });

  describe('File Loading and Encoding Detection', () => {
    beforeEach(async () => {
      // Create files with different encodings
      await fs.writeFile(join(testDir, 'utf8.txt'), 'Hello UTF-8 世界', 'utf8');
      await fs.writeFile(join(testDir, 'ascii.txt'), 'Hello ASCII', 'ascii');

      // Create UTF-16 LE file with BOM
      const utf16Buffer = Buffer.concat([
        Buffer.from([0xff, 0xfe]), // UTF-16 LE BOM
        Buffer.from('Hello UTF-16', 'utf16le'),
      ]);
      await fs.writeFile(join(testDir, 'utf16.txt'), utf16Buffer);
    });

    it('should load files into memory', async () => {
      const files = [join(testDir, 'utf8.txt'), join(testDir, 'ascii.txt')];

      await processor.loadFiles(files);

      const stats = processor.getStatistics();
      expect(stats.loadedFiles).toBe(2);
      expect(stats.modifiedFiles).toBe(0);
    });

    it('should detect UTF-16 LE encoding with BOM', async () => {
      processor.updateConfig({ detectEncoding: true });

      await processor.loadFiles([join(testDir, 'utf16.txt')]);

      // File should be loaded (we can't directly test encoding without accessing internals)
      const stats = processor.getStatistics();
      expect(stats.loadedFiles).toBe(1);
    });

    it('should use default encoding when detection is disabled', async () => {
      processor.updateConfig({
        detectEncoding: false,
        defaultEncoding: 'utf8',
      });

      await processor.loadFiles([join(testDir, 'utf8.txt')]);

      const stats = processor.getStatistics();
      expect(stats.loadedFiles).toBe(1);
    });

    it('should handle file loading errors gracefully', async () => {
      processor.updateConfig({ continueOnError: true });

      const files = [join(testDir, 'nonexistent.txt'), join(testDir, 'utf8.txt')];

      await processor.loadFiles(files);

      const stats = processor.getStatistics();
      expect(stats.loadedFiles).toBe(1); // Only utf8.txt should load
      expect(stats.totalErrors).toBeGreaterThan(0);
    });

    it('should handle concurrent file loading', async () => {
      // Create multiple files
      const files = [];
      for (let i = 0; i < 20; i++) {
        const filePath = join(testDir, `file${i}.txt`);
        await fs.writeFile(filePath, `Content ${i}`);
        files.push(filePath);
      }

      processor.updateConfig({
        concurrent: true,
        maxConcurrency: 5,
      });

      const startTime = Date.now();
      await processor.loadFiles(files);
      const duration = Date.now() - startTime;

      const stats = processor.getStatistics();
      expect(stats.loadedFiles).toBe(20);
      expect(duration).toBeLessThan(5000); // Should complete reasonably quickly
    });
  });

  describe('File Content Operations', () => {
    let testFile: string;

    beforeEach(async () => {
      testFile = join(testDir, 'test.html');
      await fs.writeFile(testFile, '<div class="old-class">content</div>');
      await processor.loadFiles([testFile]);
    });

    it('should apply replace operations', () => {
      const success = processor.applyOperation(testFile, {
        type: 'replace',
        target: 'old-class',
        replacement: 'new-class',
      });

      expect(success).toBe(true);

      const stats = processor.getStatistics();
      expect(stats.modifiedFiles).toBe(1);
    });

    it('should apply regex replace operations', () => {
      const success = processor.applyOperation(testFile, {
        type: 'replace',
        target: /class="[^"]*"/g,
        replacement: 'class="updated-class"',
      });

      expect(success).toBe(true);
    });

    it('should apply insert operations', () => {
      const success = processor.applyOperation(testFile, {
        type: 'insert',
        position: 0,
        replacement: '<!-- Header -->\n',
      });

      expect(success).toBe(true);
    });

    it('should apply delete operations', () => {
      const success = processor.applyOperation(testFile, {
        type: 'delete',
        target: 'content',
      });

      expect(success).toBe(true);
    });

    it('should apply append operations', () => {
      const success = processor.applyOperation(testFile, {
        type: 'append',
        replacement: '\n<!-- Footer -->',
      });

      expect(success).toBe(true);
    });

    it('should apply prepend operations', () => {
      const success = processor.applyOperation(testFile, {
        type: 'prepend',
        replacement: '<!DOCTYPE html>\n',
      });

      expect(success).toBe(true);
    });

    it('should validate operations when validation function provided', () => {
      const success = processor.applyOperation(testFile, {
        type: 'replace',
        target: 'old-class',
        replacement: 'new-class',
        validate: (content) => content.includes('new-class'),
      });

      expect(success).toBe(true);
    });

    it('should fail validation when validation function returns false', () => {
      const success = processor.applyOperation(testFile, {
        type: 'replace',
        target: 'old-class',
        replacement: 'new-class',
        validate: (content) => content.includes('impossible-string'),
      });

      expect(success).toBe(false);

      const stats = processor.getStatistics();
      expect(stats.totalErrors).toBeGreaterThan(0);
    });

    it('should handle operations on non-loaded files', () => {
      const nonExistentFile = join(testDir, 'nonexistent.html');

      const success = processor.applyOperation(nonExistentFile, {
        type: 'replace',
        target: 'test',
        replacement: 'replaced',
      });

      expect(success).toBe(false);
    });
  });

  describe('Output Configuration and File Writing', () => {
    let sourceFile: string;
    let outputDir: string;

    beforeEach(async () => {
      sourceFile = join(testDir, 'source.html');
      outputDir = join(testDir, 'output');

      await fs.writeFile(sourceFile, '<div>original content</div>');
      await fs.mkdir(outputDir, { recursive: true });

      processor.updateConfig({
        patterns: [sourceFile],
        output: {
          directory: outputDir,
          preserveStructure: false,
          createDirectories: true,
        },
      });
    });

    it('should write files to custom output directory', async () => {
      await processor.loadFiles([sourceFile]);
      processor.applyOperation(sourceFile, {
        type: 'replace',
        target: 'original',
        replacement: 'modified',
      });

      const results = await processor.processFiles();

      expect(results.success).toBe(true);
      expect(results.processedFiles).toBe(1);

      const outputFile = join(outputDir, 'source.html');
      const content = await fs.readFile(outputFile, 'utf8');
      expect(content).toContain('modified content');
    });

    it('should preserve directory structure when configured', async () => {
      const subDir = join(testDir, 'src');
      const nestedFile = join(subDir, 'nested.html');

      await fs.mkdir(subDir, { recursive: true });
      await fs.writeFile(nestedFile, '<div>nested</div>');

      processor.updateConfig({
        patterns: [nestedFile],
        output: {
          directory: outputDir,
          preserveStructure: true,
        },
      });

      await processor.loadFiles([nestedFile]);
      processor.applyOperation(nestedFile, {
        type: 'replace',
        target: 'nested',
        replacement: 'processed',
      });

      await processor.processFiles();

      // Check that directory structure is preserved
      const expectedOutput = join(outputDir, 'src', 'nested.html');
      const content = await fs.readFile(expectedOutput, 'utf8');
      expect(content).toContain('processed');
    });

    it('should handle overwrite policies', async () => {
      const outputFile = join(outputDir, 'source.html');
      await fs.writeFile(outputFile, 'existing content');

      processor.updateConfig({
        output: {
          directory: outputDir,
          overwritePolicy: 'never',
        },
      });

      await processor.loadFiles([sourceFile]);
      processor.applyOperation(sourceFile, {
        type: 'replace',
        target: 'original',
        replacement: 'modified',
      });

      const results = await processor.processFiles();

      // File should be skipped due to never overwrite policy
      expect(results.results[0].warnings.some((w) => w.includes('overwrite policy'))).toBe(true);

      // Original file should remain unchanged
      const content = await fs.readFile(outputFile, 'utf8');
      expect(content).toBe('existing content');
    });

    it('should support dry run mode', async () => {
      processor.updateConfig({ dryRun: true });

      await processor.loadFiles([sourceFile]);
      processor.applyOperation(sourceFile, {
        type: 'replace',
        target: 'original',
        replacement: 'modified',
      });

      const results = await processor.processFiles();

      expect(results.success).toBe(true);
      expect(results.results[0].warnings.some((w) => w.includes('Dry run mode'))).toBe(true);

      // No output file should be created
      const outputFile = join(outputDir, 'source.html');
      await expect(fs.access(outputFile)).rejects.toThrow();
    });
  });

  describe('Backup System', () => {
    let sourceFile: string;

    beforeEach(async () => {
      sourceFile = join(testDir, 'backup-test.html');
      await fs.writeFile(sourceFile, '<div>original content</div>');

      processor.updateConfig({
        patterns: [sourceFile],
        backup: {
          enabled: true,
          strategy: 'timestamp',
          maxBackups: 3,
        },
      });
    });

    it('should create backups before overwriting files', async () => {
      await processor.loadFiles([sourceFile]);
      processor.applyOperation(sourceFile, {
        type: 'replace',
        target: 'original',
        replacement: 'modified',
      });

      const results = await processor.processFiles();

      expect(results.success).toBe(true);
      expect(results.results[0].backup).toBeDefined();

      // Backup file should exist
      const backupFile = results.results[0].backup!;
      const backupContent = await fs.readFile(backupFile, 'utf8');
      expect(backupContent).toContain('original content');
    });

    it('should support versioned backup strategy', async () => {
      processor.updateConfig({
        backup: {
          enabled: true,
          strategy: 'versioned',
          maxBackups: 5,
        },
      });

      // Process file multiple times to create multiple versions
      for (let i = 1; i <= 3; i++) {
        processor.clear();
        await processor.loadFiles([sourceFile]);
        processor.applyOperation(sourceFile, {
          type: 'replace',
          target: /content/g,
          replacement: `content-v${i}`,
        });

        await processor.processFiles();
      }

      // Check that versioned backups exist
      const backupDir = join(dirname(sourceFile), '.backup');
      const backupFiles = await fs.readdir(backupDir);

      const versionedBackups = backupFiles.filter((f) => f.match(/\.v\d+\.backup$/));
      expect(versionedBackups.length).toBeGreaterThan(0);
    });

    it('should clean up old backups according to retention policy', async () => {
      processor.updateConfig({
        backup: {
          enabled: true,
          strategy: 'versioned',
          maxBackups: 2,
        },
      });

      // Create more backups than the retention limit
      for (let i = 1; i <= 4; i++) {
        processor.clear();
        await processor.loadFiles([sourceFile]);
        processor.applyOperation(sourceFile, {
          type: 'replace',
          target: /content/g,
          replacement: `content-v${i}`,
        });

        await processor.processFiles();
      }

      const backupDir = join(dirname(sourceFile), '.backup');
      const backupFiles = await fs.readdir(backupDir);

      // Should not exceed maxBackups limit
      expect(backupFiles.length).toBeLessThanOrEqual(2);
    });

    it('should handle backup failures gracefully', async () => {
      // Create a backup directory as a file to cause backup failure
      const backupDir = join(dirname(sourceFile), '.backup');
      await fs.writeFile(backupDir, 'blocking file');

      processor.updateConfig({ continueOnError: true });

      await processor.loadFiles([sourceFile]);
      processor.applyOperation(sourceFile, {
        type: 'replace',
        target: 'original',
        replacement: 'modified',
      });

      const results = await processor.processFiles();

      // Should continue processing despite backup failure
      expect(results.results[0].status).toBe('failed');
      expect(results.results[0].errors.length).toBeGreaterThan(0);
    });
  });

  describe('Performance and Stress Testing', () => {
    it('should handle large numbers of files efficiently', async () => {
      const fileCount = 100;
      const files = [];

      // Create many test files
      for (let i = 0; i < fileCount; i++) {
        const filePath = join(testDir, `large-test-${i}.html`);
        await fs.writeFile(filePath, `<div class="item-${i}">Content ${i}</div>`);
        files.push(filePath);
      }

      processor.updateConfig({
        patterns: [join(testDir, 'large-test-*.html')],
        concurrent: true,
        maxConcurrency: 10,
        verbose: false,
      });

      const startTime = Date.now();

      const discoveredFiles = await processor.discoverFiles();
      expect(discoveredFiles).toHaveLength(fileCount);

      await processor.loadFiles(discoveredFiles);

      // Apply operations to all files
      for (const file of discoveredFiles) {
        processor.applyOperation(file, {
          type: 'replace',
          target: /item-(\d+)/g,
          replacement: 'processed-item-$1',
        });
      }

      const results = await processor.processFiles();
      const duration = Date.now() - startTime;

      expect(results.success).toBe(true);
      expect(results.processedFiles).toBe(fileCount);
      expect(duration).toBeLessThan(30000); // Should complete within 30 seconds

      console.log(
        `Processed ${fileCount} files in ${duration}ms (${(duration / fileCount).toFixed(2)}ms/file)`
      );
    }, 45000); // Extended timeout for performance test

    it('should handle large file content efficiently', async () => {
      // Create a large file (1MB)
      const largeContent = 'x'.repeat(1024 * 1024);
      const largeFile = join(testDir, 'large-file.html');
      await fs.writeFile(largeFile, `<div>${largeContent}</div>`);

      await processor.loadFiles([largeFile]);

      const startTime = Date.now();

      processor.applyOperation(largeFile, {
        type: 'replace',
        target: largeContent,
        replacement: 'replaced-content',
      });

      const results = await processor.processFiles();
      const duration = Date.now() - startTime;

      expect(results.success).toBe(true);
      expect(duration).toBeLessThan(5000); // Should handle large files efficiently

      const stats = processor.getStatistics();
      expect(stats.memoryUsage).toBeGreaterThan(0);

      console.log(
        `Processed 1MB file in ${duration}ms, memory usage: ${(stats.memoryUsage / 1024 / 1024).toFixed(2)}MB`
      );
    });

    it('should maintain reasonable memory usage with many files', async () => {
      const fileCount = 50;
      const files = [];

      // Create moderate-sized files
      for (let i = 0; i < fileCount; i++) {
        const content = `<div>${'content '.repeat(1000)}</div>`;
        const filePath = join(testDir, `memory-test-${i}.html`);
        await fs.writeFile(filePath, content);
        files.push(filePath);
      }

      await processor.loadFiles(files);

      const initialStats = processor.getStatistics();
      const initialMemory = initialStats.memoryUsage;

      // Apply operations
      for (const file of files) {
        processor.applyOperation(file, {
          type: 'replace',
          target: 'content',
          replacement: 'modified',
        });
      }

      const finalStats = processor.getStatistics();
      const finalMemory = finalStats.memoryUsage;

      // Memory usage should be reasonable (less than 100MB for this test)
      expect(finalMemory).toBeLessThan(100 * 1024 * 1024);

      console.log(
        `Memory usage: initial ${(initialMemory / 1024 / 1024).toFixed(2)}MB, final ${(finalMemory / 1024 / 1024).toFixed(2)}MB`
      );
    });

    it('should handle concurrent processing without race conditions', async () => {
      const fileCount = 20;
      const files = [];

      // Create test files
      for (let i = 0; i < fileCount; i++) {
        const filePath = join(testDir, `concurrent-test-${i}.html`);
        await fs.writeFile(filePath, `<div id="item-${i}">original</div>`);
        files.push(filePath);
      }

      processor.updateConfig({
        concurrent: true,
        maxConcurrency: 5,
      });

      await processor.loadFiles(files);

      // Apply operations to all files
      files.forEach((file) => {
        processor.applyOperation(file, {
          type: 'replace',
          target: 'original',
          replacement: 'concurrent-processed',
        });
      });

      const results = await processor.processFiles();

      expect(results.success).toBe(true);
      expect(results.processedFiles).toBe(fileCount);

      // Verify all files were processed correctly
      for (let i = 0; i < fileCount; i++) {
        const outputContent = await fs.readFile(files[i], 'utf8');
        expect(outputContent).toContain('concurrent-processed');
      }
    });

    it('should gracefully handle low-resource conditions', async () => {
      processor.updateConfig({
        maxConcurrency: 1, // Limit concurrency
        maxErrors: 5,
        continueOnError: true,
      });

      const fileCount = 30;
      const files = [];

      // Create files, some with problematic content
      for (let i = 0; i < fileCount; i++) {
        const filePath = join(testDir, `resource-test-${i}.html`);
        const content = i % 5 === 0 ? '' : `<div>content-${i}</div>`;
        await fs.writeFile(filePath, content);
        files.push(filePath);
      }

      await processor.loadFiles(files);

      // Apply operations
      files.forEach((file) => {
        processor.applyOperation(file, {
          type: 'replace',
          target: /content-(\d+)/g,
          replacement: 'processed-$1',
        });
      });

      const results = await processor.processFiles();

      // Should complete despite some errors
      expect(results.totalFiles).toBe(fileCount);
      expect(results.processedFiles + results.skippedFiles + results.failedFiles).toBe(fileCount);

      const stats = processor.getStatistics();
      console.log(
        `Low-resource test: ${results.processedFiles} processed, ${results.skippedFiles} skipped, ${results.failedFiles} failed`
      );
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should handle file system errors gracefully', async () => {
      processor.updateConfig({ continueOnError: true });

      // Try to process non-existent files
      const nonExistentFiles = [
        join(testDir, 'nonexistent1.html'),
        join(testDir, 'nonexistent2.html'),
      ];

      await processor.loadFiles(nonExistentFiles);

      const stats = processor.getStatistics();
      expect(stats.totalErrors).toBeGreaterThan(0);
    });

    it('should enforce error limits', async () => {
      processor.updateConfig({
        maxErrors: 2,
        continueOnError: false,
      });

      // Create scenario that will generate errors
      const files = [];
      for (let i = 0; i < 5; i++) {
        files.push(join(testDir, `error-test-${i}.html`));
      }

      try {
        await processor.loadFiles(files);
      } catch (error) {
        expect(error).toBeInstanceOf(FileProcessingError);
      }

      const stats = processor.getStatistics();
      expect(stats.totalErrors).toBeGreaterThan(0);
    });

    it('should provide detailed error context', async () => {
      const invalidFile = join(testDir, 'invalid.html');

      try {
        await processor.loadFiles([invalidFile]);
      } catch (error) {
        expect(error).toBeInstanceOf(FileProcessingError);
        const fileError = error as FileProcessingError;
        expect(fileError.filePath).toBeDefined();
        expect(fileError.operation).toBeDefined();
      }
    });
  });

  describe('Integration with External Systems', () => {
    it('should integrate with mock consolidator', async () => {
      const mockConsolidator = {
        consolidate: vi.fn().mockResolvedValue({
          fileModifications: [],
          patterns: new Map(),
          identifierMappings: new Map(),
          statistics: {
            totalPatternsFound: 0,
            totalPatternsConsolidated: 0,
            totalFilesModified: 0,
            totalReplacements: 0,
            processingTime: 0,
          },
          errors: [],
          warnings: [],
          analysisResult: {
            frequencyMap: new Map(),
            aggregatedData: new Map(),
            statistics: {
              totalPatterns: 0,
              totalOccurrences: 0,
              averageFrequency: 0,
              maxFrequency: 0,
              minFrequency: 0,
            },
          },
        }),
      };

      processor.setConsolidator(mockConsolidator as any);

      const testFile = join(testDir, 'integration-test.html');
      await fs.writeFile(testFile, '<div class="test">content</div>');

      await processor.loadFiles([testFile]);
      const results = await processor.processFiles();

      expect(results.success).toBe(true);
      expect(mockConsolidator.consolidate).toHaveBeenCalled();
    });

    it('should integrate with mock CSS formatter', async () => {
      const mockFormatter = {
        format: vi.fn().mockResolvedValue('/* formatted css */'),
      };

      processor.setCssFormatter(mockFormatter as any);

      const cssFile = join(testDir, 'style.css');
      await fs.writeFile(cssFile, 'body { margin: 0; }');

      await processor.loadFiles([cssFile]);
      const results = await processor.processFiles();

      expect(results.success).toBe(true);
      expect(mockFormatter.format).toHaveBeenCalled();
    });
  });

  describe('Statistics and Monitoring', () => {
    beforeEach(async () => {
      // Create test files
      for (let i = 0; i < 5; i++) {
        const filePath = join(testDir, `stats-test-${i}.html`);
        await fs.writeFile(filePath, `<div>content-${i}</div>`);
      }
    });

    it('should track loading statistics', async () => {
      const files = await processor.discoverFiles();
      await processor.loadFiles(files);

      const stats = processor.getStatistics();
      expect(stats.loadedFiles).toBe(files.length);
      expect(stats.modifiedFiles).toBe(0);
      expect(stats.memoryUsage).toBeGreaterThan(0);
    });

    it('should track modification statistics', async () => {
      const files = await processor.discoverFiles();
      await processor.loadFiles(files);

      // Modify some files
      files.slice(0, 3).forEach((file) => {
        processor.applyOperation(file, {
          type: 'replace',
          target: /content-(\d+)/,
          replacement: 'modified-$1',
        });
      });

      const stats = processor.getStatistics();
      expect(stats.modifiedFiles).toBe(3);
    });

    it('should provide comprehensive processing results', async () => {
      const files = await processor.discoverFiles();
      await processor.loadFiles(files);

      // Modify files
      files.forEach((file) => {
        processor.applyOperation(file, {
          type: 'replace',
          target: /content-(\d+)/,
          replacement: 'final-$1',
        });
      });

      const results = await processor.processFiles();

      expect(results.totalFiles).toBe(files.length);
      expect(results.processedFiles).toBe(files.length);
      expect(results.statistics.totalClassReplacements).toBeGreaterThan(0);
      expect(results.statistics.averageFileSize).toBeGreaterThan(0);
      expect(results.totalProcessingTime).toBeGreaterThan(0);
    });
  });

  describe('Factory Functions', () => {
    it('should create processor via factory function', () => {
      const factoryProcessor = createFileProcessor({
        patterns: ['*.html'],
        verbose: true,
      });

      expect(factoryProcessor).toBeInstanceOf(FileProcessor);
      expect(factoryProcessor.getConfig().verbose).toBe(true);
    });

    it('should process files via convenience function', async () => {
      const testFile = join(testDir, 'convenience-test.html');
      await fs.writeFile(testFile, '<div>test content</div>');

      const results = await processFiles([testFile], { dryRun: true });

      expect(results.success).toBe(true);
      expect(results.totalFiles).toBe(1);
    });
  });

  describe('Memory Management and Cleanup', () => {
    it('should clear internal state', async () => {
      const testFile = join(testDir, 'cleanup-test.html');
      await fs.writeFile(testFile, '<div>content</div>');

      await processor.loadFiles([testFile]);
      processor.applyOperation(testFile, {
        type: 'replace',
        target: 'content',
        replacement: 'modified',
      });

      let stats = processor.getStatistics();
      expect(stats.loadedFiles).toBe(1);
      expect(stats.modifiedFiles).toBe(1);

      processor.clear();

      stats = processor.getStatistics();
      expect(stats.loadedFiles).toBe(0);
      expect(stats.modifiedFiles).toBe(0);
      expect(stats.totalErrors).toBe(0);
      expect(stats.totalWarnings).toBe(0);
    });

    it('should handle memory efficiently after multiple operations', async () => {
      const iterations = 10;

      for (let i = 0; i < iterations; i++) {
        const testFile = join(testDir, `memory-iteration-${i}.html`);
        await fs.writeFile(testFile, `<div>iteration-${i}</div>`);

        await processor.loadFiles([testFile]);
        processor.applyOperation(testFile, {
          type: 'replace',
          target: `iteration-${i}`,
          replacement: `processed-${i}`,
        });

        await processor.processFiles();
        processor.clear();
      }

      // Memory should be cleaned up between iterations
      const finalStats = processor.getStatistics();
      expect(finalStats.loadedFiles).toBe(0);
      expect(finalStats.memoryUsage).toBe(0);
    });
  });
});
