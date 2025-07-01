/**
 * File System Interceptor
 * Intercepts file system operations for dry run mode
 */

import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import * as path from 'path';
import { getDryRunManager } from './dryRunManager';
import { Logger } from '../utils/logger';

export interface FileSystemInterceptorOptions {
  /** Enable interception globally */
  enabled: boolean;
  /** Log intercepted operations */
  logOperations: boolean;
  /** Allow read operations to pass through */
  allowReads: boolean;
  /** Whitelist of paths that should never be intercepted */
  whitelist: string[];
  /** Blacklist of paths that should always be intercepted */
  blacklist: string[];
}

export interface InterceptedOperation {
  /** Method name that was intercepted */
  method: string;
  /** Arguments passed to the method */
  args: any[];
  /** Whether this was a dry run interception */
  isDryRun: boolean;
  /** Timestamp of interception */
  timestamp: number;
  /** Result that would have been returned */
  simulatedResult?: any;
}

export class FileSystemInterceptor {
  private logger: Logger;
  private options: FileSystemInterceptorOptions;
  private originalMethods: Map<string, Function> = new Map();
  private interceptedOperations: InterceptedOperation[] = [];
  private isInstalled = false;

  constructor(options: Partial<FileSystemInterceptorOptions> = {}) {
    this.options = {
      enabled: false,
      logOperations: true,
      allowReads: true,
      whitelist: [],
      blacklist: [],
      ...options,
    };

    this.logger = new Logger({ component: 'FileSystemInterceptor' });
  }

  /**
   * Install file system interception
   */
  install(): void {
    if (this.isInstalled) {
      this.logger.warn('File system interceptor already installed');
      return;
    }

    this.logger.info('Installing file system interceptor');

    // Intercept async fs methods
    this.interceptAsyncMethod(fs, 'writeFile');
    this.interceptAsyncMethod(fs, 'appendFile');
    this.interceptAsyncMethod(fs, 'unlink');
    this.interceptAsyncMethod(fs, 'rmdir');
    this.interceptAsyncMethod(fs, 'mkdir');
    this.interceptAsyncMethod(fs, 'rename');
    this.interceptAsyncMethod(fs, 'copyFile');
    this.interceptAsyncMethod(fs, 'chmod');
    this.interceptAsyncMethod(fs, 'chown');
    this.interceptAsyncMethod(fs, 'utimes');
    this.interceptAsyncMethod(fs, 'rm');

    // Intercept sync fs methods
    this.interceptSyncMethod(fsSync, 'writeFileSync');
    this.interceptSyncMethod(fsSync, 'appendFileSync');
    this.interceptSyncMethod(fsSync, 'unlinkSync');
    this.interceptSyncMethod(fsSync, 'rmdirSync');
    this.interceptSyncMethod(fsSync, 'mkdirSync');
    this.interceptSyncMethod(fsSync, 'renameSync');
    this.interceptSyncMethod(fsSync, 'copyFileSync');
    this.interceptSyncMethod(fsSync, 'chmodSync');
    this.interceptSyncMethod(fsSync, 'chownSync');
    this.interceptSyncMethod(fsSync, 'utimesSync');
    this.interceptSyncMethod(fsSync, 'rmSync');

    this.isInstalled = true;
  }

  /**
   * Uninstall file system interception
   */
  uninstall(): void {
    if (!this.isInstalled) {
      this.logger.warn('File system interceptor not installed');
      return;
    }

    this.logger.info('Uninstalling file system interceptor');

    // Restore original methods
    for (const [methodPath, originalMethod] of this.originalMethods) {
      const [objectName, methodName] = methodPath.split('.');
      const targetObject = objectName === 'fs' ? fs : fsSync;
      (targetObject as any)[methodName] = originalMethod;
    }

    this.originalMethods.clear();
    this.isInstalled = false;
  }

  /**
   * Intercept an async file system method
   */
  private interceptAsyncMethod(fsModule: any, methodName: string): void {
    const originalMethod = fsModule[methodName];
    if (!originalMethod) {
      this.logger.warn(`Method not found for interception: ${methodName}`);
      return;
    }

    this.originalMethods.set(`fs.${methodName}`, originalMethod);

    fsModule[methodName] = async (...args: any[]) => {
      const filePath = this.extractFilePath(args);
      const shouldIntercept = this.shouldInterceptOperation(filePath, methodName);

      const operation: InterceptedOperation = {
        method: methodName,
        args: this.sanitizeArgs(args),
        isDryRun: shouldIntercept,
        timestamp: Date.now(),
      };

      if (shouldIntercept) {
        // Record the operation in dry run manager
        this.recordDryRunOperation(methodName, args);
        
        // Simulate the operation
        const simulatedResult = this.simulateAsyncOperation(methodName, args);
        operation.simulatedResult = simulatedResult;

        if (this.options.logOperations) {
          this.logger.debug(`Intercepted async operation: ${methodName}`, {
            filePath,
            isDryRun: true,
          });
        }

        this.interceptedOperations.push(operation);
        return simulatedResult;
      } else {
        // Execute the original method
        if (this.options.logOperations) {
          this.logger.debug(`Passing through async operation: ${methodName}`, {
            filePath,
            isDryRun: false,
          });
        }

        this.interceptedOperations.push(operation);
        return originalMethod.apply(fsModule, args);
      }
    };
  }

  /**
   * Intercept a sync file system method
   */
  private interceptSyncMethod(fsModule: any, methodName: string): void {
    const originalMethod = fsModule[methodName];
    if (!originalMethod) {
      this.logger.warn(`Method not found for interception: ${methodName}`);
      return;
    }

    this.originalMethods.set(`fsSync.${methodName}`, originalMethod);

    fsModule[methodName] = (...args: any[]) => {
      const filePath = this.extractFilePath(args);
      const shouldIntercept = this.shouldInterceptOperation(filePath, methodName);

      const operation: InterceptedOperation = {
        method: methodName,
        args: this.sanitizeArgs(args),
        isDryRun: shouldIntercept,
        timestamp: Date.now(),
      };

      if (shouldIntercept) {
        // Record the operation in dry run manager
        this.recordDryRunOperation(methodName, args);
        
        // Simulate the operation
        const simulatedResult = this.simulateSyncOperation(methodName, args);
        operation.simulatedResult = simulatedResult;

        if (this.options.logOperations) {
          this.logger.debug(`Intercepted sync operation: ${methodName}`, {
            filePath,
            isDryRun: true,
          });
        }

        this.interceptedOperations.push(operation);
        return simulatedResult;
      } else {
        // Execute the original method
        if (this.options.logOperations) {
          this.logger.debug(`Passing through sync operation: ${methodName}`, {
            filePath,
            isDryRun: false,
          });
        }

        this.interceptedOperations.push(operation);
        return originalMethod.apply(fsModule, args);
      }
    };
  }

  /**
   * Determine if an operation should be intercepted
   */
  private shouldInterceptOperation(filePath: string, methodName: string): boolean {
    if (!this.options.enabled) {
      return false;
    }

    const dryRunManager = getDryRunManager();
    if (!dryRunManager.isActive()) {
      return false;
    }

    // Check read operations
    if (this.isReadOperation(methodName) && this.options.allowReads) {
      return false;
    }

    // Check whitelist (never intercept)
    for (const whitelistPath of this.options.whitelist) {
      if (filePath.includes(whitelistPath)) {
        return false;
      }
    }

    // Check blacklist (always intercept)
    for (const blacklistPath of this.options.blacklist) {
      if (filePath.includes(blacklistPath)) {
        return true;
      }
    }

    // Default behavior: intercept write operations in dry run mode
    return !this.isReadOperation(methodName);
  }

  /**
   * Check if operation is a read operation
   */
  private isReadOperation(methodName: string): boolean {
    const readOperations = [
      'readFile', 'readFileSync',
      'readdir', 'readdirSync',
      'stat', 'statSync',
      'lstat', 'lstatSync',
      'access', 'accessSync',
      'exists', 'existsSync',
      'realpath', 'realpathSync',
      'readlink', 'readlinkSync',
    ];

    return readOperations.includes(methodName);
  }

  /**
   * Extract file path from method arguments
   */
  private extractFilePath(args: any[]): string {
    if (args.length === 0) {
      return '';
    }

    const firstArg = args[0];
    if (typeof firstArg === 'string') {
      return firstArg;
    }

    if (firstArg && typeof firstArg === 'object' && firstArg.toString) {
      return firstArg.toString();
    }

    return '';
  }

  /**
   * Sanitize arguments for logging (remove sensitive data)
   */
  private sanitizeArgs(args: any[]): any[] {
    return args.map(arg => {
      if (typeof arg === 'string') {
        return arg;
      }
      if (Buffer.isBuffer(arg)) {
        return `<Buffer ${arg.length} bytes>`;
      }
      if (typeof arg === 'function') {
        return '<Function>';
      }
      if (typeof arg === 'object' && arg !== null) {
        return '<Object>';
      }
      return arg;
    });
  }

  /**
   * Record operation in dry run manager
   */
  private recordDryRunOperation(methodName: string, args: any[]): void {
    const dryRunManager = getDryRunManager();
    const filePath = this.extractFilePath(args);

    try {
      switch (methodName) {
        case 'writeFile':
        case 'writeFileSync':
          dryRunManager.recordFileWrite(filePath, args[1] || '', `Write file via ${methodName}`);
          break;
        case 'appendFile':
        case 'appendFileSync':
          dryRunManager.recordFileModify(filePath, { operation: 'append', data: args[1] }, `Append to file via ${methodName}`);
          break;
        case 'unlink':
        case 'unlinkSync':
          dryRunManager.recordFileDelete(filePath, `Delete file via ${methodName}`);
          break;
        case 'mkdir':
        case 'mkdirSync':
          dryRunManager.recordDirectoryCreate(filePath, `Create directory via ${methodName}`);
          break;
        case 'rmdir':
        case 'rmdirSync':
        case 'rm':
        case 'rmSync':
          if (this.isDirectory(filePath)) {
            dryRunManager.recordDirectoryDelete(filePath, `Delete directory via ${methodName}`);
          } else {
            dryRunManager.recordFileDelete(filePath, `Delete file via ${methodName}`);
          }
          break;
        case 'rename':
        case 'renameSync':
          dryRunManager.recordFileModify(filePath, { operation: 'rename', newPath: args[1] }, `Rename via ${methodName}`);
          break;
        case 'copyFile':
        case 'copyFileSync':
          dryRunManager.recordFileWrite(args[1], '', `Copy file via ${methodName}`);
          break;
        case 'chmod':
        case 'chmodSync':
          dryRunManager.recordFileModify(filePath, { operation: 'chmod', mode: args[1] }, `Change permissions via ${methodName}`);
          break;
        case 'chown':
        case 'chownSync':
          dryRunManager.recordFileModify(filePath, { operation: 'chown', uid: args[1], gid: args[2] }, `Change ownership via ${methodName}`);
          break;
        case 'utimes':
        case 'utimesSync':
          dryRunManager.recordFileModify(filePath, { operation: 'utimes', atime: args[1], mtime: args[2] }, `Change times via ${methodName}`);
          break;
        default:
          dryRunManager.recordOperation({
            type: 'file-modify',
            target: filePath,
            description: `Unknown file operation: ${methodName}`,
            data: { methodName, args: this.sanitizeArgs(args) },
          });
      }
    } catch (error) {
      this.logger.warn(`Failed to record dry run operation: ${methodName}`, { error, filePath });
    }
  }

  /**
   * Simulate async operation result
   */
  private simulateAsyncOperation(methodName: string, args: any[]): Promise<any> {
    switch (methodName) {
      case 'writeFile':
      case 'appendFile':
      case 'unlink':
      case 'rmdir':
      case 'rm':
      case 'rename':
      case 'copyFile':
      case 'chmod':
      case 'chown':
      case 'utimes':
        return Promise.resolve(undefined);
      case 'mkdir':
        return Promise.resolve(undefined);
      default:
        return Promise.resolve(undefined);
    }
  }

  /**
   * Simulate sync operation result
   */
  private simulateSyncOperation(methodName: string, args: any[]): any {
    switch (methodName) {
      case 'writeFileSync':
      case 'appendFileSync':
      case 'unlinkSync':
      case 'rmdirSync':
      case 'rmSync':
      case 'renameSync':
      case 'copyFileSync':
      case 'chmodSync':
      case 'chownSync':
      case 'utimesSync':
        return undefined;
      case 'mkdirSync':
        return undefined;
      default:
        return undefined;
    }
  }

  /**
   * Check if path is likely a directory
   */
  private isDirectory(filePath: string): boolean {
    // Simple heuristic: no extension = directory
    return !path.extname(filePath);
  }

  /**
   * Get intercepted operations
   */
  getInterceptedOperations(): InterceptedOperation[] {
    return [...this.interceptedOperations];
  }

  /**
   * Clear intercepted operations log
   */
  clearOperations(): void {
    this.interceptedOperations = [];
  }

  /**
   * Update interceptor options
   */
  updateOptions(options: Partial<FileSystemInterceptorOptions>): void {
    this.options = { ...this.options, ...options };
    this.logger.debug('Updated file system interceptor options', options);
  }

  /**
   * Get current options
   */
  getOptions(): FileSystemInterceptorOptions {
    return { ...this.options };
  }

  /**
   * Check if interceptor is installed
   */
  isInterceptorInstalled(): boolean {
    return this.isInstalled;
  }
}

/**
 * Global file system interceptor instance
 */
let globalInterceptor: FileSystemInterceptor | null = null;

/**
 * Get the global file system interceptor
 */
export function getFileSystemInterceptor(): FileSystemInterceptor {
  if (!globalInterceptor) {
    globalInterceptor = new FileSystemInterceptor();
  }
  return globalInterceptor;
}

/**
 * Create a new file system interceptor
 */
export function createFileSystemInterceptor(options?: Partial<FileSystemInterceptorOptions>): FileSystemInterceptor {
  return new FileSystemInterceptor(options);
}

/**
 * Install global file system interception
 */
export function installGlobalInterception(options?: Partial<FileSystemInterceptorOptions>): void {
  const interceptor = getFileSystemInterceptor();
  if (options) {
    interceptor.updateOptions(options);
  }
  interceptor.install();
}

/**
 * Uninstall global file system interception
 */
export function uninstallGlobalInterception(): void {
  const interceptor = getFileSystemInterceptor();
  interceptor.uninstall();
}

export default FileSystemInterceptor;