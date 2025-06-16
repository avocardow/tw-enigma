/**
 * Copyright (c) 2025 Rowan Cardow
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Stats } from "fs";
import { promisify } from "util";

// =============================================================================
// TYPES & INTERFACES
// =============================================================================

/**
 * Mock file metadata for virtual file system
 */
export interface MockFileMetadata {
  /** File creation timestamp */
  created: Date;
  /** Last modification timestamp */
  modified: Date;
  /** File size in bytes */
  size: number;
  /** File permissions mask */
  mode: number;
  /** Whether this is a directory */
  isDirectory: boolean;
  /** Whether this is a file */
  isFile: boolean;
  /** Whether this is a symbolic link */
  isSymbolicLink: boolean;
  /** Parent directory path */
  parent?: string;
  /** Original file path if this was loaded from disk */
  originalPath?: string;
}

/**
 * Mock file entry for virtual file system
 */
export interface MockFileEntry {
  /** File content (Buffer for binary, string for text) */
  content: Buffer | string;
  /** File metadata */
  metadata: MockFileMetadata;
  /** Encoding used for text files */
  encoding?: BufferEncoding;
}

/**
 * File operation types for tracking changes
 */
export type FileOperationType =
  | "read"
  | "write"
  | "delete"
  | "create"
  | "mkdir"
  | "exists"
  | "stat";

/**
 * File operation record for tracking changes
 */
export interface FileOperation {
  /** Type of operation */
  type: FileOperationType;
  /** File path involved */
  path: string;
  /** Timestamp of operation */
  timestamp: Date;
  /** Content before operation (for modifications) */
  previousContent?: Buffer | string;
  /** Content after operation (for creations/modifications) */
  newContent?: Buffer | string;
  /** Metadata changes */
  metadata?: Partial<MockFileMetadata>;
  /** Success status */
  success: boolean;
  /** Error message if operation failed */
  error?: string;
}

/**
 * Mock file system interface for dry run operations
 */
export interface IMockFileSystem {
  // File operations
  readFile(path: string, encoding?: BufferEncoding): Promise<string | Buffer>;
  readFileSync(path: string, encoding?: BufferEncoding): string | Buffer;
  writeFile(
    path: string,
    content: string | Buffer,
    encoding?: BufferEncoding,
  ): Promise<void>;
  writeFileSync(
    path: string,
    content: string | Buffer,
    encoding?: BufferEncoding,
  ): void;

  // Directory operations
  mkdir(
    path: string,
    options?: { recursive?: boolean; mode?: number },
  ): Promise<void>;
  mkdirSync(
    path: string,
    options?: { recursive?: boolean; mode?: number },
  ): void;

  // File system queries
  exists(path: string): Promise<boolean>;
  existsSync(path: string): boolean;
  stat(path: string): Promise<Stats>;
  statSync(path: string): Stats;

  // Management operations
  loadFromDisk(path: string): Promise<void>;
  getOperations(): FileOperation[];
  clearOperations(): void;
  getFileState(path: string): MockFileEntry | undefined;
  getAllFiles(): Map<string, MockFileEntry>;
  reset(): void;
}

// =============================================================================
// MOCK FILE SYSTEM IMPLEMENTATION
// =============================================================================

/**
 * Virtual file system implementation for dry run mode
 */
export class MockFileSystem implements IMockFileSystem {
  private files = new Map<string, MockFileEntry>();
  private operations: FileOperation[] = [];
  private originalFs: any;

  constructor() {
    // Store reference to original fs module for disk loading
    // We need require here for dynamic loading - cannot use ES6 import
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    this.originalFs = require("fs");
  }

  // ---------------------------------------------------------------------------
  // FILE OPERATIONS
  // ---------------------------------------------------------------------------

  /**
   * Read file content (async)
   */
  async readFile(
    path: string,
    encoding?: BufferEncoding,
  ): Promise<string | Buffer> {
    return this.performOperation("read", path, async () => {
      const normalized = this.normalizePath(path);
      const entry = this.files.get(normalized);

      if (!entry) {
        throw new Error(`ENOENT: no such file or directory, open '${path}'`);
      }

      if (entry.metadata.isDirectory) {
        throw new Error(
          `EISDIR: illegal operation on a directory, read '${path}'`,
        );
      }

      // Update access time
      entry.metadata.modified = new Date();

      if (encoding && Buffer.isBuffer(entry.content)) {
        return entry.content.toString(encoding);
      }

      if (!encoding && typeof entry.content === "string") {
        return Buffer.from(entry.content, entry.encoding || "utf8");
      }

      return entry.content;
    });
  }

  /**
   * Read file content (sync)
   */
  readFileSync(path: string, encoding?: BufferEncoding): string | Buffer {
    const normalized = this.normalizePath(path);
    const entry = this.files.get(normalized);

    this.recordOperation({
      type: "read",
      path,
      timestamp: new Date(),
      success: !!entry,
      error: entry
        ? undefined
        : `ENOENT: no such file or directory, open '${path}'`,
    });

    if (!entry) {
      throw new Error(`ENOENT: no such file or directory, open '${path}'`);
    }

    if (entry.metadata.isDirectory) {
      throw new Error(
        `EISDIR: illegal operation on a directory, read '${path}'`,
      );
    }

    // Update access time
    entry.metadata.modified = new Date();

    if (encoding && Buffer.isBuffer(entry.content)) {
      return entry.content.toString(encoding);
    }

    if (!encoding && typeof entry.content === "string") {
      return Buffer.from(entry.content, entry.encoding || "utf8");
    }

    return entry.content;
  }

  /**
   * Write file content (async)
   */
  async writeFile(
    path: string,
    content: string | Buffer,
    encoding?: BufferEncoding,
  ): Promise<void> {
    const normalized = this.normalizePath(path);
    const existing = this.files.get(normalized);
    
    return this.performOperation(
      "write",
      path,
      async () => {

        // Ensure parent directory exists
        const parentDir = this.getParentDirectory(normalized);
        if (parentDir && !this.files.has(parentDir)) {
          await this.mkdir(parentDir, { recursive: true });
        }

        const now = new Date();
        const size = Buffer.isBuffer(content)
          ? content.length
          : Buffer.byteLength(content, encoding || "utf8");

        const entry: MockFileEntry = {
          content,
          encoding:
            typeof content === "string" ? encoding || "utf8" : undefined,
          metadata: {
            created: existing?.metadata.created || now,
            modified: now,
            size,
            mode: existing?.metadata.mode || 0o644,
            isDirectory: false,
            isFile: true,
            isSymbolicLink: false,
            parent: parentDir,
          },
        };

        this.files.set(normalized, entry);
      },
      existing?.content,
      content,
    );
  }

  /**
   * Write file content (sync)
   */
  writeFileSync(
    path: string,
    content: string | Buffer,
    encoding?: BufferEncoding,
  ): void {
    const normalized = this.normalizePath(path);
    const existing = this.files.get(normalized);

    // Ensure parent directory exists
    const parentDir = this.getParentDirectory(normalized);
    if (parentDir && !this.files.has(parentDir)) {
      this.mkdirSync(parentDir, { recursive: true });
    }

    const now = new Date();
    const size = Buffer.isBuffer(content)
      ? content.length
      : Buffer.byteLength(content, encoding || "utf8");

    const entry: MockFileEntry = {
      content,
      encoding: typeof content === "string" ? encoding || "utf8" : undefined,
      metadata: {
        created: existing?.metadata.created || now,
        modified: now,
        size,
        mode: existing?.metadata.mode || 0o644,
        isDirectory: false,
        isFile: true,
        isSymbolicLink: false,
        parent: parentDir,
      },
    };

    this.files.set(normalized, entry);

    this.recordOperation({
      type: existing ? "write" : "create",
      path,
      timestamp: now,
      previousContent: existing?.content,
      newContent: content,
      success: true,
    });
  }

  // ---------------------------------------------------------------------------
  // DIRECTORY OPERATIONS
  // ---------------------------------------------------------------------------

  /**
   * Create directory (async)
   */
  async mkdir(
    path: string,
    options?: { recursive?: boolean; mode?: number },
  ): Promise<void> {
    return this.performOperation("mkdir", path, async () => {
      const normalized = this.normalizePath(path);

      if (this.files.has(normalized)) {
        if (options?.recursive) {
          return; // Already exists, that's fine for recursive
        }
        throw new Error(`EEXIST: file already exists, mkdir '${path}'`);
      }

      // Handle recursive creation
      if (options?.recursive) {
        const parts = normalized.split("/").filter(Boolean);
        let currentPath = "";

        for (const part of parts) {
          currentPath += "/" + part;
          if (!this.files.has(currentPath)) {
            this.createDirectory(currentPath, options.mode);
          }
        }
      } else {
        // Check if parent exists
        const parent = this.getParentDirectory(normalized);
        if (parent && !this.files.has(parent)) {
          throw new Error(`ENOENT: no such file or directory, mkdir '${path}'`);
        }

        this.createDirectory(normalized, options?.mode);
      }
    });
  }

  /**
   * Create directory (sync)
   */
  mkdirSync(
    path: string,
    options?: { recursive?: boolean; mode?: number },
  ): void {
    const normalized = this.normalizePath(path);

    if (this.files.has(normalized)) {
      if (options?.recursive) {
        this.recordOperation({
          type: "mkdir",
          path,
          timestamp: new Date(),
          success: true,
        });
        return; // Already exists, that's fine for recursive
      }

      this.recordOperation({
        type: "mkdir",
        path,
        timestamp: new Date(),
        success: false,
        error: `EEXIST: file already exists, mkdir '${path}'`,
      });
      throw new Error(`EEXIST: file already exists, mkdir '${path}'`);
    }

    // Handle recursive creation
    if (options?.recursive) {
      const parts = normalized.split("/").filter(Boolean);
      let currentPath = "";

      for (const part of parts) {
        currentPath += "/" + part;
        if (!this.files.has(currentPath)) {
          this.createDirectory(currentPath, options.mode);
        }
      }
    } else {
      // Check if parent exists
      const parent = this.getParentDirectory(normalized);
      if (parent && !this.files.has(parent)) {
        this.recordOperation({
          type: "mkdir",
          path,
          timestamp: new Date(),
          success: false,
          error: `ENOENT: no such file or directory, mkdir '${path}'`,
        });
        throw new Error(`ENOENT: no such file or directory, mkdir '${path}'`);
      }

      this.createDirectory(normalized, options?.mode);
    }

    this.recordOperation({
      type: "mkdir",
      path,
      timestamp: new Date(),
      success: true,
    });
  }

  // ---------------------------------------------------------------------------
  // FILE SYSTEM QUERIES
  // ---------------------------------------------------------------------------

  /**
   * Check if file/directory exists (async)
   */
  async exists(path: string): Promise<boolean> {
    return this.performOperation("exists", path, async () => {
      const normalized = this.normalizePath(path);
      return this.files.has(normalized);
    });
  }

  /**
   * Check if file/directory exists (sync)
   */
  existsSync(path: string): boolean {
    const normalized = this.normalizePath(path);
    const exists = this.files.has(normalized);

    this.recordOperation({
      type: "exists",
      path,
      timestamp: new Date(),
      success: true,
    });

    return exists;
  }

  /**
   * Get file/directory stats (async)
   */
  async stat(path: string): Promise<Stats> {
    return this.performOperation("stat", path, async () => {
      const normalized = this.normalizePath(path);
      const entry = this.files.get(normalized);

      if (!entry) {
        throw new Error(`ENOENT: no such file or directory, stat '${path}'`);
      }

      return this.createMockStats(entry.metadata);
    });
  }

  /**
   * Get file/directory stats (sync)
   */
  statSync(path: string): Stats {
    const normalized = this.normalizePath(path);
    const entry = this.files.get(normalized);

    if (!entry) {
      this.recordOperation({
        type: "stat",
        path,
        timestamp: new Date(),
        success: false,
        error: `ENOENT: no such file or directory, stat '${path}'`,
      });
      throw new Error(`ENOENT: no such file or directory, stat '${path}'`);
    }

    this.recordOperation({
      type: "stat",
      path,
      timestamp: new Date(),
      success: true,
    });

    return this.createMockStats(entry.metadata);
  }

  // ---------------------------------------------------------------------------
  // MANAGEMENT OPERATIONS
  // ---------------------------------------------------------------------------

  /**
   * Load an existing file from disk into the mock file system
   */
  async loadFromDisk(path: string): Promise<void> {
    try {
      const stats = await promisify(this.originalFs.stat)(path);
      const normalized = this.normalizePath(path);

      if (stats.isDirectory()) {
        this.createDirectory(normalized, stats.mode);
      } else if (stats.isFile()) {
        const content = await promisify(this.originalFs.readFile)(path);

        const entry: MockFileEntry = {
          content,
          metadata: {
            created: stats.birthtime,
            modified: stats.mtime,
            size: stats.size,
            mode: stats.mode,
            isDirectory: false,
            isFile: true,
            isSymbolicLink: false,
            originalPath: path,
          },
        };

        this.files.set(normalized, entry);
      }
    } catch {
      // File doesn't exist on disk, that's fine
    }
  }

  /**
   * Get all recorded operations
   */
  getOperations(): FileOperation[] {
    return [...this.operations];
  }

  /**
   * Clear operation history
   */
  clearOperations(): void {
    this.operations = [];
  }

  /**
   * Get current state of a file
   */
  getFileState(path: string): MockFileEntry | undefined {
    const normalized = this.normalizePath(path);
    return this.files.get(normalized);
  }

  /**
   * Get all files in the mock file system
   */
  getAllFiles(): Map<string, MockFileEntry> {
    return new Map(this.files);
  }

  /**
   * Reset the mock file system
   */
  reset(): void {
    this.files.clear();
    this.operations = [];
  }

  // ---------------------------------------------------------------------------
  // PRIVATE HELPER METHODS
  // ---------------------------------------------------------------------------

  private normalizePath(path: string): string {
    // Convert to forward slashes and remove duplicate slashes
    let normalized = path.replace(/\\/g, "/").replace(/\/+/g, "/");

    // Ensure absolute path for consistency
    if (!normalized.startsWith("/")) {
      normalized = "/" + normalized;
    }

    return normalized;
  }

  private getParentDirectory(path: string): string | undefined {
    const parts = path.split("/").filter(Boolean);
    if (parts.length <= 1) return undefined;
    return "/" + parts.slice(0, -1).join("/");
  }

  private createDirectory(path: string, mode?: number): void {
    const now = new Date();
    const entry: MockFileEntry = {
      content: "",
      metadata: {
        created: now,
        modified: now,
        size: 0,
        mode: mode || 0o755,
        isDirectory: true,
        isFile: false,
        isSymbolicLink: false,
        parent: this.getParentDirectory(path),
      },
    };

    this.files.set(path, entry);
  }

  private createMockStats(metadata: MockFileMetadata): Stats {
    // Create a mock Stats object with the required properties
    return {
      isFile: () => metadata.isFile,
      isDirectory: () => metadata.isDirectory,
      isSymbolicLink: () => metadata.isSymbolicLink,
      size: metadata.size,
      mode: metadata.mode,
      mtime: metadata.modified,
      birthtime: metadata.created,
      ctime: metadata.modified,
      atime: metadata.modified,
      // Add other Stats properties as needed
    } as Stats;
  }

  private async performOperation<T>(
    type: FileOperationType,
    path: string,
    operation: () => Promise<T>,
    previousContent?: Buffer | string,
    newContent?: Buffer | string,
  ): Promise<T> {
    try {
      const result = await operation();

      this.recordOperation({
        type,
        path,
        timestamp: new Date(),
        previousContent,
        newContent,
        success: true,
      });

      return result;
    } catch (error) {
      this.recordOperation({
        type,
        path,
        timestamp: new Date(),
        previousContent,
        newContent,
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });

      throw error;
    }
  }

  private recordOperation(operation: FileOperation): void {
    this.operations.push(operation);
  }
}

// =============================================================================
// FACTORY FUNCTIONS
// =============================================================================

/**
 * Create a new mock file system instance
 */
export function createMockFileSystem(): IMockFileSystem {
  return new MockFileSystem();
}

/**
 * Create a mock file system with pre-loaded files from disk
 */
export async function createMockFileSystemFromDisk(
  paths: string[],
): Promise<IMockFileSystem> {
  const mockFs = new MockFileSystem();

  for (const path of paths) {
    await mockFs.loadFromDisk(path);
  }

  return mockFs;
}
