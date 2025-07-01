/**
 * Copyright (c) 2025 Rowan Cardow
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { promises as fs } from 'fs';
import * as path from 'path';
import { glob } from 'glob';
import { DataSource } from './incrementalPipeline.js';
import { FileProcessor } from '../processors/fileProcessor.js';

/**
 * Configuration for file system data source
 */
export interface FileSystemSourceConfig {
  patterns: string[];
  excludePatterns?: string[];
  baseDirectory?: string;
  followSymlinks?: boolean;
  maxDepth?: number;
  includeHidden?: boolean;
  batchSize?: number;
  enableWatching?: boolean;
  watchDebounceMs?: number;
}

/**
 * File system data source implementation
 */
export class FileSystemDataSource implements DataSource<string> {
  public readonly id: string;
  public readonly supportsStreaming = true;
  public readonly supportsBatching = true;

  private readonly config: Required<FileSystemSourceConfig>;
  private fileList: string[] = [];
  private currentIndex = 0;
  private isInitialized = false;
  private watcher?: any; // fs.FSWatcher type

  constructor(id: string, config: FileSystemSourceConfig) {
    this.id = id;
    this.config = {
      patterns: config.patterns,
      excludePatterns: config.excludePatterns || [],
      baseDirectory: config.baseDirectory || process.cwd(),
      followSymlinks: config.followSymlinks || false,
      maxDepth: config.maxDepth || 10,
      includeHidden: config.includeHidden || false,
      batchSize: config.batchSize || 100,
      enableWatching: config.enableWatching || false,
      watchDebounceMs: config.watchDebounceMs || 300,
    };
  }

  /**
   * Initialize the data source by discovering files
   */
  private async initialize(): Promise<void> {
    if (this.isInitialized) return;

    this.fileList = await this.discoverFiles();
    this.currentIndex = 0;
    this.isInitialized = true;

    if (this.config.enableWatching) {
      await this.setupFileWatcher();
    }
  }

  /**
   * Discover files matching the configured patterns
   */
  private async discoverFiles(): Promise<string[]> {
    const allFiles = new Set<string>();

    for (const pattern of this.config.patterns) {
      const globPattern = path.isAbsolute(pattern) 
        ? pattern 
        : path.join(this.config.baseDirectory, pattern);

      const files = await glob(globPattern, {
        ignore: this.config.excludePatterns,
        follow: this.config.followSymlinks,
        maxDepth: this.config.maxDepth,
        dot: this.config.includeHidden,
        absolute: true,
        nodir: true,
      });

      files.forEach(file => allFiles.add(file));
    }

    // Sort files for consistent processing order
    return Array.from(allFiles).sort();
  }

  /**
   * Set up file system watcher for dynamic updates
   */
  private async setupFileWatcher(): Promise<void> {
    if (typeof require === 'undefined') {
      console.warn('File watching not supported in this environment');
      return;
    }

    try {
      const chokidar = require('chokidar');
      
      this.watcher = chokidar.watch(this.config.patterns, {
        ignored: this.config.excludePatterns,
        persistent: true,
        ignoreInitial: true,
        followSymlinks: this.config.followSymlinks,
        depth: this.config.maxDepth,
        awaitWriteFinish: {
          stabilityThreshold: this.config.watchDebounceMs,
          pollInterval: 100,
        },
      });

      this.watcher.on('add', (filePath: string) => {
        if (!this.fileList.includes(filePath)) {
          this.fileList.push(filePath);
        }
      });

      this.watcher.on('unlink', (filePath: string) => {
        const index = this.fileList.indexOf(filePath);
        if (index !== -1) {
          this.fileList.splice(index, 1);
          if (index < this.currentIndex) {
            this.currentIndex--;
          }
        }
      });

      this.watcher.on('change', (filePath: string) => {
        // For changed files, we might want to re-add them to the processing queue
        // This depends on the specific use case
      });

    } catch (error) {
      console.warn('Failed to setup file watcher:', error.message);
    }
  }

  /**
   * Read data from source (streaming)
   */
  public async* read(): AsyncIterable<string> {
    await this.initialize();

    while (this.currentIndex < this.fileList.length) {
      yield this.fileList[this.currentIndex];
      this.currentIndex++;
    }
  }

  /**
   * Read batch of data
   */
  public async readBatch(size: number): Promise<string[]> {
    await this.initialize();

    const batchSize = Math.min(size, this.fileList.length - this.currentIndex);
    const batch = this.fileList.slice(this.currentIndex, this.currentIndex + batchSize);
    this.currentIndex += batchSize;

    return batch;
  }

  /**
   * Get total count of files
   */
  public async count(): Promise<number> {
    await this.initialize();
    return this.fileList.length;
  }

  /**
   * Check if more data is available
   */
  public async hasMore(): Promise<boolean> {
    await this.initialize();
    return this.currentIndex < this.fileList.length;
  }

  /**
   * Reset the data source to start from the beginning
   */
  public async reset(): Promise<void> {
    this.currentIndex = 0;
  }

  /**
   * Refresh the file list
   */
  public async refresh(): Promise<void> {
    this.fileList = await this.discoverFiles();
    this.currentIndex = 0;
  }

  /**
   * Close the data source and clean up resources
   */
  public async close(): Promise<void> {
    if (this.watcher) {
      await this.watcher.close();
      this.watcher = undefined;
    }
  }

  /**
   * Get current progress information
   */
  public getProgress(): { processed: number; total: number; percentage: number } {
    return {
      processed: this.currentIndex,
      total: this.fileList.length,
      percentage: this.fileList.length > 0 ? (this.currentIndex / this.fileList.length) * 100 : 0,
    };
  }
}

/**
 * Configuration for stream data source
 */
export interface StreamSourceConfig {
  batchSize?: number;
  encoding?: BufferEncoding;
  highWaterMark?: number;
}

/**
 * Stream-based data source implementation
 */
export class StreamDataSource implements DataSource<string> {
  public readonly id: string;
  public readonly supportsStreaming = true;
  public readonly supportsBatching = true;

  private readonly config: Required<StreamSourceConfig>;
  private readonly inputStream: NodeJS.ReadableStream;
  private buffer: string[] = [];
  private isStreamEnded = false;

  constructor(id: string, inputStream: NodeJS.ReadableStream, config: StreamSourceConfig = {}) {
    this.id = id;
    this.inputStream = inputStream;
    this.config = {
      batchSize: config.batchSize || 100,
      encoding: config.encoding || 'utf8',
      highWaterMark: config.highWaterMark || 64 * 1024,
    };

    this.setupStreamHandlers();
  }

  /**
   * Set up stream event handlers
   */
  private setupStreamHandlers(): void {
    this.inputStream.on('data', (chunk: Buffer | string) => {
      const data = chunk.toString(this.config.encoding);
      // Split by lines and add to buffer
      const lines = data.split('\n');
      this.buffer.push(...lines.filter(line => line.trim().length > 0));
    });

    this.inputStream.on('end', () => {
      this.isStreamEnded = true;
    });

    this.inputStream.on('error', (error) => {
      console.error('Stream error:', error);
      this.isStreamEnded = true;
    });
  }

  /**
   * Read data from source (streaming)
   */
  public async* read(): AsyncIterable<string> {
    while (!this.isStreamEnded || this.buffer.length > 0) {
      if (this.buffer.length > 0) {
        yield this.buffer.shift()!;
      } else {
        // Wait for more data
        await new Promise(resolve => setTimeout(resolve, 10));
      }
    }
  }

  /**
   * Read batch of data
   */
  public async readBatch(size: number): Promise<string[]> {
    const batch: string[] = [];

    while (batch.length < size && (!this.isStreamEnded || this.buffer.length > 0)) {
      if (this.buffer.length > 0) {
        batch.push(this.buffer.shift()!);
      } else {
        // Wait for more data
        await new Promise(resolve => setTimeout(resolve, 10));
      }
    }

    return batch;
  }

  /**
   * Get total count (not available for streams)
   */
  public async count(): Promise<number | undefined> {
    return undefined;
  }

  /**
   * Check if more data is available
   */
  public async hasMore(): Promise<boolean> {
    return !this.isStreamEnded || this.buffer.length > 0;
  }
}

/**
 * Configuration for array data source
 */
export interface ArraySourceConfig<T> {
  batchSize?: number;
  randomize?: boolean;
  seed?: number;
}

/**
 * Array-based data source implementation
 */
export class ArrayDataSource<T> implements DataSource<T> {
  public readonly id: string;
  public readonly supportsStreaming = true;
  public readonly supportsBatching = true;

  private readonly config: Required<ArraySourceConfig<T>>;
  private readonly items: T[];
  private currentIndex = 0;

  constructor(id: string, items: T[], config: ArraySourceConfig<T> = {}) {
    this.id = id;
    this.config = {
      batchSize: config.batchSize || 100,
      randomize: config.randomize || false,
      seed: config.seed || Date.now(),
    };

    this.items = [...items];
    
    if (this.config.randomize) {
      this.shuffleArray(this.items, this.config.seed);
    }
  }

  /**
   * Shuffle array using Fisher-Yates algorithm with seed
   */
  private shuffleArray(array: T[], seed: number): void {
    let m = array.length;
    let t: T;
    let i: number;

    // Use a simple linear congruential generator for seeded randomness
    let random = () => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };

    while (m) {
      i = Math.floor(random() * m--);
      t = array[m];
      array[m] = array[i];
      array[i] = t;
    }
  }

  /**
   * Read data from source (streaming)
   */
  public async* read(): AsyncIterable<T> {
    while (this.currentIndex < this.items.length) {
      yield this.items[this.currentIndex];
      this.currentIndex++;
    }
  }

  /**
   * Read batch of data
   */
  public async readBatch(size: number): Promise<T[]> {
    const batchSize = Math.min(size, this.items.length - this.currentIndex);
    const batch = this.items.slice(this.currentIndex, this.currentIndex + batchSize);
    this.currentIndex += batchSize;
    return batch;
  }

  /**
   * Get total count
   */
  public async count(): Promise<number> {
    return this.items.length;
  }

  /**
   * Check if more data is available
   */
  public async hasMore(): Promise<boolean> {
    return this.currentIndex < this.items.length;
  }

  /**
   * Reset the data source
   */
  public async reset(): Promise<void> {
    this.currentIndex = 0;
  }

  /**
   * Get current progress
   */
  public getProgress(): { processed: number; total: number; percentage: number } {
    return {
      processed: this.currentIndex,
      total: this.items.length,
      percentage: this.items.length > 0 ? (this.currentIndex / this.items.length) * 100 : 0,
    };
  }
}

/**
 * URL-based data source for fetching remote data
 */
export class URLDataSource implements DataSource<string> {
  public readonly id: string;
  public readonly supportsStreaming = true;
  public readonly supportsBatching = true;

  private readonly urls: string[];
  private currentIndex = 0;

  constructor(id: string, urls: string | string[]) {
    this.id = id;
    this.urls = Array.isArray(urls) ? urls : [urls];
  }

  /**
   * Read data from URLs (streaming)
   */
  public async* read(): AsyncIterable<string> {
    for (const url of this.urls) {
      try {
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        const text = await response.text();
        yield text;
        this.currentIndex++;
      } catch (error) {
        console.error(`Failed to fetch ${url}:`, error);
        // Continue with next URL
      }
    }
  }

  /**
   * Read batch of URLs
   */
  public async readBatch(size: number): Promise<string[]> {
    const batch: string[] = [];
    const endIndex = Math.min(this.currentIndex + size, this.urls.length);

    const promises = this.urls.slice(this.currentIndex, endIndex).map(async (url) => {
      try {
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        return await response.text();
      } catch (error) {
        console.error(`Failed to fetch ${url}:`, error);
        return null;
      }
    });

    const results = await Promise.all(promises);
    this.currentIndex = endIndex;

    return results.filter((result): result is string => result !== null);
  }

  /**
   * Get total count
   */
  public async count(): Promise<number> {
    return this.urls.length;
  }

  /**
   * Check if more data is available
   */
  public async hasMore(): Promise<boolean> {
    return this.currentIndex < this.urls.length;
  }
}

/**
 * Factory functions for creating data sources
 */
export function createFileSystemSource(id: string, config: FileSystemSourceConfig): FileSystemDataSource {
  return new FileSystemDataSource(id, config);
}

export function createStreamSource(id: string, stream: NodeJS.ReadableStream, config?: StreamSourceConfig): StreamDataSource {
  return new StreamDataSource(id, stream, config);
}

export function createArraySource<T>(id: string, items: T[], config?: ArraySourceConfig<T>): ArrayDataSource<T> {
  return new ArrayDataSource(id, items, config);
}

export function createURLSource(id: string, urls: string | string[]): URLDataSource {
  return new URLDataSource(id, urls);
}

/**
 * Utility function to create a file system source for common patterns
 */
export function createStandardFileSource(id: string, patterns?: string[]): FileSystemDataSource {
  const defaultPatterns = [
    '**/*.html',
    '**/*.htm',
    '**/*.js',
    '**/*.jsx',
    '**/*.ts',
    '**/*.tsx',
    '**/*.vue',
    '**/*.svelte',
  ];

  return createFileSystemSource(id, {
    patterns: patterns || defaultPatterns,
    excludePatterns: [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/.next/**',
      '**/.nuxt/**',
      '**/coverage/**',
      '**/*.min.js',
      '**/*.bundle.js',
    ],
    enableWatching: false,
    batchSize: 50,
  });
}