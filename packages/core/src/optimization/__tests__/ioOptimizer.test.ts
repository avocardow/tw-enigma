/**
 * Copyright (c) 2025 Rowan Cardow
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IOOptimizer } from '../ioOptimizer.js';

describe('IOOptimizer', () => {
  let ioOptimizer: IOOptimizer;
  let testDir: string;
  let testFiles: string[];

  beforeEach(async () => {
    ioOptimizer = new IOOptimizer({
      bufferSize: 4096,
      maxConcurrentOps: 4,
      enableBatching: true,
      batchSize: 5,
      enableCaching: true,
      cacheSize: 1024 * 1024,
      maxRetries: 2,
      retryDelay: 100,
    });

    // Create temporary test directory
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'io-optimizer-test-'));
    testFiles = [];

    await ioOptimizer.start();
  });

  afterEach(async () => {
    await ioOptimizer.stop();

    // Clean up test files
    for (const file of testFiles) {
      try {
        await fs.unlink(file);
      } catch {
        // Ignore errors during cleanup
      }
    }

    // Clean up test directory
    try {
      await fs.rmdir(testDir);
    } catch {
      // Ignore errors during cleanup
    }
  });

  describe('Basic File Operations', () => {
    it('should read file successfully', async () => {
      const testFile = path.join(testDir, 'test-read.txt');
      const testData = 'Hello, World!';
      await fs.writeFile(testFile, testData);
      testFiles.push(testFile);

      const result = await ioOptimizer.readFile(testFile);

      expect(result.success).toBe(true);
      expect(result.data?.toString()).toBe(testData);
      expect(result.bytesProcessed).toBe(testData.length);
      expect(result.retries).toBe(0);
    });

    it('should write file successfully', async () => {
      const testFile = path.join(testDir, 'test-write.txt');
      const testData = 'Hello, World!';
      testFiles.push(testFile);

      const result = await ioOptimizer.writeFile(testFile, testData);

      expect(result.success).toBe(true);
      expect(result.bytesProcessed).toBe(testData.length);

      const fileContent = await fs.readFile(testFile, 'utf8');
      expect(fileContent).toBe(testData);
    });

    it('should copy file successfully', async () => {
      const sourceFile = path.join(testDir, 'source.txt');
      const destFile = path.join(testDir, 'dest.txt');
      const testData = 'Copy test data';

      await fs.writeFile(sourceFile, testData);
      testFiles.push(sourceFile, destFile);

      const result = await ioOptimizer.copyFile(sourceFile, destFile);

      expect(result.success).toBe(true);
      expect(result.bytesProcessed).toBe(testData.length);

      const copiedContent = await fs.readFile(destFile, 'utf8');
      expect(copiedContent).toBe(testData);
    });

    it('should move file successfully', async () => {
      const sourceFile = path.join(testDir, 'move-source.txt');
      const destFile = path.join(testDir, 'move-dest.txt');
      const testData = 'Move test data';

      await fs.writeFile(sourceFile, testData);
      testFiles.push(destFile); // Only dest file will exist after move

      const result = await ioOptimizer.moveFile(sourceFile, destFile);

      expect(result.success).toBe(true);

      // Source should not exist
      await expect(fs.access(sourceFile)).rejects.toThrow();

      // Destination should exist with correct content
      const movedContent = await fs.readFile(destFile, 'utf8');
      expect(movedContent).toBe(testData);
    });

    it('should delete file successfully', async () => {
      const testFile = path.join(testDir, 'delete-test.txt');
      const testData = 'Delete me';

      await fs.writeFile(testFile, testData);

      const result = await ioOptimizer.deleteFile(testFile);

      expect(result.success).toBe(true);
      await expect(fs.access(testFile)).rejects.toThrow();
    });
  });

  describe('Batch Operations', () => {
    it('should batch read multiple files', async () => {
      const files = ['file1.txt', 'file2.txt', 'file3.txt'];
      const filePaths = files.map((f) => path.join(testDir, f));
      const testData = ['Data 1', 'Data 2', 'Data 3'];

      for (let i = 0; i < files.length; i++) {
        await fs.writeFile(filePaths[i], testData[i]);
        testFiles.push(filePaths[i]);
      }

      const results = await ioOptimizer.batchReadFiles(filePaths);

      expect(results).toHaveLength(3);
      results.forEach((result, index) => {
        expect(result.success).toBe(true);
        expect(result.bytesProcessed).toBe(testData[index].length);
      });
    });

    it('should batch write multiple files', async () => {
      const files = [
        { path: path.join(testDir, 'batch1.txt'), data: 'Batch data 1' },
        { path: path.join(testDir, 'batch2.txt'), data: 'Batch data 2' },
        { path: path.join(testDir, 'batch3.txt'), data: 'Batch data 3' },
      ];

      files.forEach((f) => testFiles.push(f.path));

      const results = await ioOptimizer.batchWriteFiles(files);

      expect(results).toHaveLength(3);

      for (let i = 0; i < files.length; i++) {
        expect(results[i].success).toBe(true);
        expect(results[i].bytesProcessed).toBe(files[i].data.length);

        const content = await fs.readFile(files[i].path, 'utf8');
        expect(content).toBe(files[i].data);
      }
    });
  });

  describe('Checksum Operations', () => {
    it('should read file with checksum validation', async () => {
      const testFile = path.join(testDir, 'checksum-test.txt');
      const testData = 'Checksum test data';
      await fs.writeFile(testFile, testData);
      testFiles.push(testFile);

      const result = await ioOptimizer.readFileWithChecksum(testFile);

      expect(result.success).toBe(true);
      expect(result.data?.toString()).toBe(testData);
      expect(result.checksum).toBeDefined();
      expect(typeof result.checksum).toBe('string');
      expect(result.checksum).toHaveLength(64); // SHA-256 hex length
    });

    it('should write file with checksum generation', async () => {
      const testFile = path.join(testDir, 'write-checksum.txt');
      const testData = 'Write with checksum';
      testFiles.push(testFile);

      const result = await ioOptimizer.writeFileWithChecksum(testFile, testData);

      expect(result.success).toBe(true);
      expect(result.checksum).toBeDefined();
      expect(typeof result.checksum).toBe('string');
      expect(result.checksum).toHaveLength(64);

      const fileContent = await fs.readFile(testFile, 'utf8');
      expect(fileContent).toBe(testData);
    });

    it('should validate checksum on read', async () => {
      const testFile = path.join(testDir, 'validate-checksum.txt');
      const testData = 'Validate checksum data';
      testFiles.push(testFile);

      // First write and get the checksum
      const writeResult = await ioOptimizer.writeFileWithChecksum(testFile, testData);
      const expectedChecksum = writeResult.checksum;

      // Then read with checksum validation
      const readResult = await ioOptimizer.readFileWithChecksum(testFile, expectedChecksum);

      expect(readResult.success).toBe(true);
      expect(readResult.checksum).toBe(expectedChecksum);
    });

    it('should throw error on checksum mismatch', async () => {
      const testFile = path.join(testDir, 'checksum-mismatch.txt');
      const testData = 'Checksum mismatch test';
      await fs.writeFile(testFile, testData);
      testFiles.push(testFile);

      const wrongChecksum = 'a'.repeat(64); // Invalid checksum

      await expect(ioOptimizer.readFileWithChecksum(testFile, wrongChecksum)).rejects.toThrow(
        'Checksum mismatch'
      );
    });
  });

  describe('Compression Operations', () => {
    it('should compress and write file', async () => {
      const testFile = path.join(testDir, 'compress-test.txt.gz');
      const testData = 'Compress this data'.repeat(100); // Make it compressible
      testFiles.push(testFile);

      const result = await ioOptimizer.writeCompressed(testFile.replace('.gz', ''), testData);

      expect(result.success).toBe(true);
      expect(result.bytesProcessed).toBeLessThan(testData.length); // Should be compressed

      // Verify compressed file exists
      await expect(fs.access(testFile)).resolves.not.toThrow();
    });

    it('should read and decompress file', async () => {
      const testFile = path.join(testDir, 'decompress-test.txt');
      const compressedFile = testFile + '.gz';
      const testData = 'Decompress this data'.repeat(50);
      testFiles.push(compressedFile);

      // First compress
      await ioOptimizer.writeCompressed(testFile, testData);

      // Then decompress
      const result = await ioOptimizer.readCompressed(compressedFile);

      expect(result.success).toBe(true);
      expect(result.data?.toString()).toBe(testData);
      expect(result.bytesProcessed).toBe(testData.length);
    });
  });

  describe('Stream Processing', () => {
    it('should process file with stream processor', async () => {
      const sourceFile = path.join(testDir, 'stream-source.txt');
      const destFile = path.join(testDir, 'stream-dest.txt');
      const testData = 'Stream processing test data';

      await fs.writeFile(sourceFile, testData);
      testFiles.push(sourceFile, destFile);

      // Processor that converts to uppercase
      const processor = (chunk: Buffer): Buffer => {
        return Buffer.from(chunk.toString().toUpperCase());
      };

      const result = await ioOptimizer.streamProcess(sourceFile, destFile, processor);

      expect(result.success).toBe(true);
      expect(result.bytesProcessed).toBe(testData.length);

      const processedContent = await fs.readFile(destFile, 'utf8');
      expect(processedContent).toBe(testData.toUpperCase());
    });
  });

  describe('Memory-Mapped Operations', () => {
    it('should read file using memory mapping', async () => {
      const testFile = path.join(testDir, 'mmap-test.txt');
      const testData = 'Memory mapped read test data';
      await fs.writeFile(testFile, testData);
      testFiles.push(testFile);

      const result = await ioOptimizer.memoryMappedRead(testFile, 0, testData.length);

      expect(result.success).toBe(true);
      expect(result.data?.toString()).toBe(testData);
      expect(result.bytesProcessed).toBe(testData.length);
      expect(result.metadata.memoryMapped).toBe(true);
    });

    it('should read partial file with offset', async () => {
      const testFile = path.join(testDir, 'mmap-partial.txt');
      const testData = 'This is a test for partial reading';
      await fs.writeFile(testFile, testData);
      testFiles.push(testFile);

      const offset = 10;
      const length = 8;
      const result = await ioOptimizer.memoryMappedRead(testFile, offset, length);

      expect(result.success).toBe(true);
      expect(result.data?.toString()).toBe(testData.substring(offset, offset + length));
      expect(result.bytesProcessed).toBe(length);
    });
  });

  describe('Directory Scanning', () => {
    it('should scan directory recursively', async () => {
      // Create test directory structure
      const subDir = path.join(testDir, 'subdir');
      await fs.mkdir(subDir);

      const files = [
        path.join(testDir, 'file1.txt'),
        path.join(testDir, 'file2.css'),
        path.join(subDir, 'file3.txt'),
        path.join(subDir, 'file4.js'),
      ];

      for (const file of files) {
        await fs.writeFile(file, 'test content');
        testFiles.push(file);
      }

      const scannedFiles = await ioOptimizer.scanDirectory(testDir, { recursive: true });

      expect(scannedFiles).toHaveLength(4);
      expect(scannedFiles.sort()).toEqual(files.sort());
    });

    it('should filter files by extension', async () => {
      const files = [
        path.join(testDir, 'file1.txt'),
        path.join(testDir, 'file2.css'),
        path.join(testDir, 'file3.js'),
      ];

      for (const file of files) {
        await fs.writeFile(file, 'test content');
        testFiles.push(file);
      }

      const txtFiles = await ioOptimizer.scanDirectory(testDir, {
        recursive: false,
        extensions: ['.txt'],
      });

      expect(txtFiles).toHaveLength(1);
      expect(txtFiles[0]).toBe(files[0]);
    });

    it('should respect maxDepth limit', async () => {
      // Create nested directory structure
      const level1 = path.join(testDir, 'level1');
      const level2 = path.join(level1, 'level2');
      await fs.mkdir(level1);
      await fs.mkdir(level2);

      const files = [
        path.join(testDir, 'root.txt'),
        path.join(level1, 'level1.txt'),
        path.join(level2, 'level2.txt'),
      ];

      for (const file of files) {
        await fs.writeFile(file, 'test content');
        testFiles.push(file);
      }

      const scannedFiles = await ioOptimizer.scanDirectory(testDir, {
        recursive: true,
        maxDepth: 1,
      });

      expect(scannedFiles).toHaveLength(2);
      expect(scannedFiles).toContain(files[0]);
      expect(scannedFiles).toContain(files[1]);
      expect(scannedFiles).not.toContain(files[2]);
    });
  });

  describe('Error Handling', () => {
    it('should handle file not found errors', async () => {
      const nonExistentFile = path.join(testDir, 'does-not-exist.txt');

      const result = await ioOptimizer.readFile(nonExistentFile);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.retries).toBeGreaterThan(0);
    });

    it('should retry operations on failure', async () => {
      const testFile = path.join(testDir, 'retry-test.txt');

      // Mock fs.readFile to fail initially then succeed
      const originalReadFile = fs.readFile;
      let attempts = 0;

      vi.spyOn(fs, 'readFile').mockImplementation(async (path: any, options?: any) => {
        attempts++;
        if (attempts <= 2) {
          throw new Error('Simulated failure');
        }
        return originalReadFile(path, options);
      });

      await fs.writeFile(testFile, 'test data');
      testFiles.push(testFile);

      const result = await ioOptimizer.readFile(testFile);

      expect(result.success).toBe(true);
      expect(result.retries).toBe(2);
      expect(attempts).toBe(3);

      vi.restoreAllMocks();
    });
  });

  describe('Metrics', () => {
    it('should track operation metrics', async () => {
      const testFile = path.join(testDir, 'metrics-test.txt');
      const testData = 'Metrics test data';
      testFiles.push(testFile);

      await ioOptimizer.writeFile(testFile, testData);
      await ioOptimizer.readFile(testFile);

      const metrics = ioOptimizer.getMetrics();

      expect(metrics.totalOperations).toBe(2);
      expect(metrics.totalBytesWritten).toBe(testData.length);
      expect(metrics.totalBytesRead).toBe(testData.length);
      expect(metrics.averageLatency).toBeGreaterThan(0);
    });
  });
});
