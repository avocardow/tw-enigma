/**
 * Configuration File Parser
 * Robust parser for configuration files supporting multiple formats
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { z } from 'zod';
import { Logger } from '../utils/logger';

export interface ConfigFileParserOptions {
  /** Support for comment parsing in JSON files */
  allowComments: boolean;
  /** Maximum file size to parse (in bytes) */
  maxFileSize: number;
  /** Supported file extensions */
  supportedExtensions: string[];
  /** Whether to validate against schema during parsing */
  validateOnParse: boolean;
  /** Custom validation schema */
  schema?: z.ZodSchema;
  /** Whether to follow extends/inheritance */
  followExtends: boolean;
  /** Maximum depth for extends chain */
  maxExtendsDepth: number;
}

export interface ParsedConfig {
  /** Parsed configuration object */
  config: any;
  /** Source file path */
  filePath: string;
  /** File format detected */
  format: ConfigFileFormat;
  /** Extends chain if applicable */
  extendsChain?: string[];
  /** Parsing metadata */
  metadata: {
    parseTime: number;
    fileSize: number;
    lineCount: number;
    hasComments: boolean;
  };
  /** Any warnings during parsing */
  warnings: ConfigParseWarning[];
}

export interface ConfigParseWarning {
  type: 'deprecated' | 'unknown_key' | 'type_coercion' | 'extends_cycle' | 'file_not_found';
  message: string;
  location?: {
    line?: number;
    column?: number;
    key?: string;
  };
}

export type ConfigFileFormat = 'json' | 'yaml' | 'yml' | 'js' | 'mjs' | 'ts' | 'toml';

export class ConfigFileParseError extends Error {
  constructor(
    message: string,
    public filePath: string,
    public format: ConfigFileFormat,
    public line?: number,
    public column?: number,
    public cause?: Error
  ) {
    super(message);
    this.name = 'ConfigFileParseError';
  }
}

export class ConfigFileParser {
  private logger: Logger;
  private options: ConfigFileParserOptions;

  constructor(options: Partial<ConfigFileParserOptions> = {}) {
    this.options = {
      allowComments: true,
      maxFileSize: 1024 * 1024, // 1MB
      supportedExtensions: ['.json', '.yaml', '.yml', '.js', '.mjs', '.ts', '.toml'],
      validateOnParse: false,
      followExtends: true,
      maxExtendsDepth: 10,
      ...options,
    };

    this.logger = new Logger({ component: 'ConfigFileParser' });
  }

  /**
   * Parse configuration file at the given path
   */
  async parseFile(filePath: string): Promise<ParsedConfig> {
    const startTime = Date.now();

    try {
      // Validate file exists and is readable
      await this.validateFile(filePath);

      // Determine file format
      const format = this.detectFormat(filePath);

      // Read file content
      const content = await fs.readFile(filePath, 'utf8');
      const stats = await fs.stat(filePath);

      // Parse based on format
      let { config, warnings } = await this.parseContent(content, format, filePath);

      // Handle extends/inheritance
      let extendsChain: string[] | undefined;
      if (this.options.followExtends && config.extends) {
        const { resolvedConfig, chain } = await this.resolveExtends(config, filePath);
        config = resolvedConfig;
        extendsChain = chain;
      }

      // Validate if schema provided
      if (this.options.validateOnParse && this.options.schema) {
        try {
          this.options.schema.parse(config);
        } catch (error) {
          if (error instanceof z.ZodError) {
            throw new ConfigFileParseError(
              `Configuration validation failed: ${error.message}`,
              filePath,
              format
            );
          }
          throw error;
        }
      }

      return {
        config,
        filePath,
        format,
        extendsChain,
        metadata: {
          parseTime: Date.now() - startTime,
          fileSize: stats.size,
          lineCount: content.split('\n').length,
          hasComments: this.detectComments(content, format),
        },
        warnings,
      };
    } catch (error) {
      if (error instanceof ConfigFileParseError) {
        throw error;
      }

      throw new ConfigFileParseError(
        `Failed to parse config file: ${error instanceof Error ? error.message : String(error)}`,
        filePath,
        this.detectFormat(filePath),
        undefined,
        undefined,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Parse configuration from string content
   */
  async parseContent(
    content: string,
    format: ConfigFileFormat,
    filePath?: string
  ): Promise<{ config: any; warnings: ConfigParseWarning[] }> {
    const warnings: ConfigParseWarning[] = [];

    try {
      let config: any;

      switch (format) {
        case 'json':
          config = await this.parseJSON(content, warnings);
          break;
        case 'yaml':
        case 'yml':
          config = await this.parseYAML(content, warnings);
          break;
        case 'js':
        case 'mjs':
          config = await this.parseJavaScript(content, filePath, warnings);
          break;
        case 'ts':
          config = await this.parseTypeScript(content, filePath, warnings);
          break;
        case 'toml':
          config = await this.parseTOML(content, warnings);
          break;
        default:
          throw new Error(`Unsupported config format: ${format}`);
      }

      return { config, warnings };
    } catch (error) {
      throw new ConfigFileParseError(
        `Failed to parse ${format.toUpperCase()}: ${error instanceof Error ? error.message : String(error)}`,
        filePath || '<string>',
        format,
        undefined,
        undefined,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Parse JSON content with optional comment support
   */
  private async parseJSON(content: string, warnings: ConfigParseWarning[]): Promise<any> {
    try {
      if (this.options.allowComments) {
        // Remove comments while preserving line numbers for error reporting
        content = this.stripJSONComments(content);
      }

      return JSON.parse(content);
    } catch (error) {
      if (error instanceof SyntaxError) {
        const match = error.message.match(/at position (\d+)/);
        if (match) {
          const position = parseInt(match[1], 10);
          const lines = content.substring(0, position).split('\n');
          throw new Error(
            `JSON syntax error at line ${lines.length}, column ${lines[lines.length - 1].length + 1}: ${error.message}`
          );
        }
      }
      throw error;
    }
  }

  /**
   * Parse YAML content
   */
  private async parseYAML(content: string, warnings: ConfigParseWarning[]): Promise<any> {
    try {
      // Dynamic import to avoid bundling YAML parser if not used
      const yaml = await import('yaml');
      return yaml.parse(content);
    } catch (error) {
      throw new Error(
        `YAML parsing failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Parse JavaScript configuration
   */
  private async parseJavaScript(
    content: string,
    filePath: string | undefined,
    warnings: ConfigParseWarning[]
  ): Promise<any> {
    if (!filePath) {
      throw new Error('File path required for JavaScript config parsing');
    }

    try {
      // Use dynamic import for ES modules
      const configModule = await import(filePath);
      return configModule.default || configModule;
    } catch (error) {
      // Fallback to require for CommonJS
      try {
        delete require.cache[require.resolve(filePath)];
        return require(filePath);
      } catch (requireError) {
        throw new Error(
          `JavaScript config loading failed: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }
  }

  /**
   * Parse TypeScript configuration
   */
  private async parseTypeScript(
    content: string,
    filePath: string | undefined,
    warnings: ConfigParseWarning[]
  ): Promise<any> {
    try {
      // Dynamic import for TypeScript support
      const ts = await import('typescript');

      // Compile TypeScript to JavaScript
      const result = ts.transpile(content, {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2018,
      });

      // Evaluate the compiled JavaScript
      const module = { exports: {} };
      const func = new Function('module', 'exports', 'require', result);
      func(module, module.exports, require);

      return module.exports;
    } catch (error) {
      throw new Error(
        `TypeScript config parsing failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Parse TOML content
   */
  private async parseTOML(content: string, warnings: ConfigParseWarning[]): Promise<any> {
    try {
      // Dynamic import to avoid bundling TOML parser if not used
      const toml = await import('@iarna/toml');
      return toml.parse(content);
    } catch (error) {
      throw new Error(
        `TOML parsing failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Resolve extends/inheritance chain
   */
  private async resolveExtends(
    config: any,
    basePath: string,
    depth = 0,
    visited = new Set<string>()
  ): Promise<{ resolvedConfig: any; chain: string[] }> {
    if (depth >= this.options.maxExtendsDepth) {
      throw new Error(`Extends chain too deep (max: ${this.options.maxExtendsDepth})`);
    }

    if (!config.extends) {
      return { resolvedConfig: config, chain: [] };
    }

    const extendsPath = this.resolveExtendsPath(config.extends, basePath);

    if (visited.has(extendsPath)) {
      throw new Error(`Circular extends detected: ${extendsPath}`);
    }

    visited.add(extendsPath);

    try {
      const parentConfig = await this.parseFile(extendsPath);
      const { resolvedConfig: resolvedParent, chain: parentChain } = await this.resolveExtends(
        parentConfig.config,
        extendsPath,
        depth + 1,
        visited
      );

      // Deep merge parent and current config
      const merged = this.deepMerge(resolvedParent, config);
      delete merged.extends; // Remove extends after resolving

      return {
        resolvedConfig: merged,
        chain: [...parentChain, extendsPath],
      };
    } catch (error) {
      this.logger.warn(`Failed to resolve extends path: ${extendsPath}`, { error });
      return { resolvedConfig: config, chain: [] };
    }
  }

  /**
   * Resolve extends path relative to base configuration
   */
  private resolveExtendsPath(extendsValue: string, basePath: string): string {
    if (path.isAbsolute(extendsValue)) {
      return extendsValue;
    }

    const baseDir = path.dirname(basePath);
    const resolvedPath = path.resolve(baseDir, extendsValue);

    // Try with different extensions if no extension provided
    if (!path.extname(resolvedPath)) {
      for (const ext of this.options.supportedExtensions) {
        const pathWithExt = resolvedPath + ext;
        try {
          fs.access(pathWithExt);
          return pathWithExt;
        } catch {
          // Continue trying other extensions
        }
      }
    }

    return resolvedPath;
  }

  /**
   * Deep merge two objects
   */
  private deepMerge(target: any, source: any): any {
    if (source === null || source === undefined) {
      return target;
    }

    if (target === null || target === undefined) {
      return source;
    }

    if (typeof target !== 'object' || typeof source !== 'object') {
      return source;
    }

    if (Array.isArray(source)) {
      return source.slice();
    }

    const result = { ...target };

    for (const key in source) {
      if (source.hasOwnProperty(key)) {
        if (
          typeof source[key] === 'object' &&
          source[key] !== null &&
          !Array.isArray(source[key])
        ) {
          result[key] = this.deepMerge(result[key], source[key]);
        } else {
          result[key] = source[key];
        }
      }
    }

    return result;
  }

  /**
   * Detect file format from extension
   */
  private detectFormat(filePath: string): ConfigFileFormat {
    const ext = path.extname(filePath).toLowerCase();

    switch (ext) {
      case '.json':
        return 'json';
      case '.yaml':
        return 'yaml';
      case '.yml':
        return 'yml';
      case '.js':
        return 'js';
      case '.mjs':
        return 'mjs';
      case '.ts':
        return 'ts';
      case '.toml':
        return 'toml';
      default:
        throw new Error(`Unsupported config file extension: ${ext}`);
    }
  }

  /**
   * Validate file exists and is readable
   */
  private async validateFile(filePath: string): Promise<void> {
    try {
      const stats = await fs.stat(filePath);

      if (!stats.isFile()) {
        throw new Error(`Path is not a file: ${filePath}`);
      }

      if (stats.size > this.options.maxFileSize) {
        throw new Error(`File too large: ${stats.size} bytes (max: ${this.options.maxFileSize})`);
      }

      // Check if file extension is supported
      const ext = path.extname(filePath).toLowerCase();
      if (!this.options.supportedExtensions.includes(ext)) {
        throw new Error(`Unsupported file extension: ${ext}`);
      }

      // Try to access the file
      await fs.access(filePath, fs.constants.R_OK);
    } catch (error) {
      if ((error as any).code === 'ENOENT') {
        throw new Error(`Config file not found: ${filePath}`);
      }
      if ((error as any).code === 'EACCES') {
        throw new Error(`Config file not readable: ${filePath}`);
      }
      throw error;
    }
  }

  /**
   * Strip JSON comments while preserving line numbers
   */
  private stripJSONComments(content: string): string {
    const lines = content.split('\n');
    const result: string[] = [];

    for (const line of lines) {
      // Remove single-line comments
      const commentIndex = line.indexOf('//');
      if (commentIndex !== -1) {
        // Check if it's inside a string
        const beforeComment = line.substring(0, commentIndex);
        const quotes = (beforeComment.match(/"/g) || []).length;

        // If even number of quotes, comment is outside string
        if (quotes % 2 === 0) {
          result.push(beforeComment);
          continue;
        }
      }

      result.push(line);
    }

    return result.join('\n');
  }

  /**
   * Detect if content has comments
   */
  private detectComments(content: string, format: ConfigFileFormat): boolean {
    switch (format) {
      case 'json':
        return /\/\/|\/\*/.test(content);
      case 'yaml':
      case 'yml':
        return /#/.test(content);
      case 'toml':
        return /#/.test(content);
      case 'js':
      case 'mjs':
      case 'ts':
        return /\/\/|\/\*/.test(content);
      default:
        return false;
    }
  }

  /**
   * Find configuration files in directory
   */
  async findConfigFiles(dirPath: string, fileNames: string[]): Promise<string[]> {
    const found: string[] = [];

    try {
      for (const fileName of fileNames) {
        for (const ext of this.options.supportedExtensions) {
          const filePath = path.join(dirPath, fileName + ext);

          try {
            await fs.access(filePath);
            found.push(filePath);
          } catch {
            // File doesn't exist, continue
          }
        }
      }
    } catch (error) {
      this.logger.warn(`Failed to search for config files in ${dirPath}`, { error });
    }

    return found;
  }

  /**
   * Get supported file extensions
   */
  getSupportedExtensions(): string[] {
    return [...this.options.supportedExtensions];
  }

  /**
   * Update parser options
   */
  updateOptions(options: Partial<ConfigFileParserOptions>): void {
    this.options = { ...this.options, ...options };
  }
}

export default ConfigFileParser;
