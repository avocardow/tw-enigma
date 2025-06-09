import { cosmiconfig, cosmiconfigSync } from "cosmiconfig";
import { z } from "zod";
import { HtmlExtractionOptionsSchema, type HtmlExtractionOptions } from "./htmlExtractor.js";

/**
 * Configuration schema using Zod for validation
 * Defines all possible configuration options for Tailwind Enigma
 */
export const EnigmaConfigSchema = z.object({
  // Output settings
  pretty: z
    .boolean()
    .default(false)
    .describe("Enable pretty output formatting"),

  // File processing
  input: z.string().optional().describe("Input file or directory to process"),
  output: z.string().optional().describe("Output file or directory"),

  // Processing options
  minify: z.boolean().default(true).describe("Minify the output CSS"),
  removeUnused: z.boolean().default(true).describe("Remove unused CSS classes"),

  // Debug and logging
  verbose: z.boolean().default(false).describe("Enable verbose logging"),
  debug: z.boolean().default(false).describe("Enable debug mode"),

  // Performance settings
  maxConcurrency: z
    .number()
    .min(1)
    .max(10)
    .default(4)
    .describe("Maximum concurrent file processing"),

  // Output customization
  classPrefix: z
    .string()
    .default("")
    .describe("Prefix for generated class names"),
  excludePatterns: z
    .array(z.string())
    .default([])
    .describe("Patterns to exclude from processing"),

  // File Discovery Options
  followSymlinks: z
    .boolean()
    .default(false)
    .describe("Follow symbolic links during file discovery"),
  maxFiles: z
    .number()
    .int()
    .min(1)
    .optional()
    .describe("Maximum number of files to process"),
  includeFileTypes: z
    .array(z.enum(["HTML", "JAVASCRIPT", "CSS", "TEMPLATE"]))
    .optional()
    .describe("Specific file types to include"),
  excludeExtensions: z
    .array(z.string())
    .default([])
    .describe("File extensions to exclude"),

  // Advanced options
  preserveComments: z
    .boolean()
    .default(false)
    .describe("Preserve CSS comments in output"),
  sourceMaps: z.boolean().default(false).describe("Generate source maps"),

  // HTML Class Extractor Configuration
  htmlExtractor: HtmlExtractionOptionsSchema
    .optional()
    .describe("HTML class extraction configuration options"),
});

/**
 * Inferred TypeScript type from the Zod schema
 */
export type EnigmaConfig = z.infer<typeof EnigmaConfigSchema>;

/**
 * CLI arguments interface for type safety
 */
export interface CliArguments {
  pretty?: boolean;
  config?: string;
  verbose?: boolean;
  debug?: boolean;
  input?: string;
  output?: string;
  minify?: boolean;
  removeUnused?: boolean;
  maxConcurrency?: number;
  classPrefix?: string;
  excludePatterns?: string[];
  followSymlinks?: boolean;
  maxFiles?: number;
  includeFileTypes?: ("HTML" | "JAVASCRIPT" | "CSS" | "TEMPLATE")[];
  excludeExtensions?: string[];
  preserveComments?: boolean;
  sourceMaps?: boolean;
  // HTML extractor CLI options
  htmlCaseSensitive?: boolean;
  htmlIgnoreEmpty?: boolean;
  htmlMaxFileSize?: number;
  htmlTimeout?: number;
  htmlPreserveWhitespace?: boolean;
}

/**
 * Configuration loading result
 */
export interface ConfigResult {
  config: EnigmaConfig;
  filepath?: string;
  isEmpty?: boolean;
}

/**
 * Configuration error with helpful context
 */
export class ConfigError extends Error {
  constructor(
    message: string,
    public filepath?: string,
    public cause?: Error,
  ) {
    super(message);
    this.name = "ConfigError";
  }
}

/**
 * Default configuration values
 */
const DEFAULT_CONFIG: EnigmaConfig = {
  pretty: false,
  minify: true,
  removeUnused: true,
  verbose: false,
  debug: false,
  maxConcurrency: 4,
  classPrefix: "",
  excludePatterns: [],
  followSymlinks: false,
  excludeExtensions: [],
  preserveComments: false,
  sourceMaps: false,
};

/**
 * Deep merge utility for configuration objects
 * Later values take precedence over earlier ones
 */
function deepMerge<T extends Record<string, unknown>>(
  target: T,
  ...sources: Array<Partial<T>>
): T {
  if (!sources.length) return target;
  const source = sources.shift();

  if (isObject(target) && isObject(source)) {
    for (const key in source) {
      if (isObject(source[key])) {
        if (!target[key]) Object.assign(target, { [key]: {} });
        deepMerge(
          target[key] as Record<string, unknown>,
          source[key] as Record<string, unknown>,
        );
      } else {
        Object.assign(target, { [key]: source[key] });
      }
    }
  }

  return deepMerge(target, ...sources);
}

/**
 * Check if value is a plain object
 */
function isObject(item: unknown): item is Record<string, unknown> {
  return item !== null && typeof item === "object" && !Array.isArray(item);
}

/**
 * Convert CLI arguments to configuration format
 */
function normalizeCliArguments(args: CliArguments): Partial<EnigmaConfig> {
  const config: Partial<EnigmaConfig> = {};

  // Map CLI arguments to config properties
  if (args.pretty !== undefined) config.pretty = args.pretty;
  if (args.verbose !== undefined) config.verbose = args.verbose;
  if (args.debug !== undefined) config.debug = args.debug;
  if (args.input !== undefined) config.input = args.input;
  if (args.output !== undefined) config.output = args.output;
  if (args.minify !== undefined) config.minify = args.minify;
  if (args.removeUnused !== undefined) config.removeUnused = args.removeUnused;
  if (args.maxConcurrency !== undefined)
    config.maxConcurrency = args.maxConcurrency;
  if (args.classPrefix !== undefined) config.classPrefix = args.classPrefix;
  if (args.excludePatterns !== undefined)
    config.excludePatterns = args.excludePatterns;
  if (args.followSymlinks !== undefined)
    config.followSymlinks = args.followSymlinks;
  if (args.maxFiles !== undefined) config.maxFiles = args.maxFiles;
  if (args.includeFileTypes !== undefined)
    config.includeFileTypes = args.includeFileTypes;
  if (args.excludeExtensions !== undefined)
    config.excludeExtensions = args.excludeExtensions;
  if (args.preserveComments !== undefined)
    config.preserveComments = args.preserveComments;
  if (args.sourceMaps !== undefined) config.sourceMaps = args.sourceMaps;

  // HTML extractor options
  const htmlExtractorConfig: Partial<HtmlExtractionOptions> = {};
  if (args.htmlCaseSensitive !== undefined)
    htmlExtractorConfig.caseSensitive = args.htmlCaseSensitive;
  if (args.htmlIgnoreEmpty !== undefined)
    htmlExtractorConfig.ignoreEmpty = args.htmlIgnoreEmpty;
  if (args.htmlMaxFileSize !== undefined)
    htmlExtractorConfig.maxFileSize = args.htmlMaxFileSize;
  if (args.htmlTimeout !== undefined)
    htmlExtractorConfig.timeout = args.htmlTimeout;
  if (args.htmlPreserveWhitespace !== undefined)
    htmlExtractorConfig.preserveWhitespace = args.htmlPreserveWhitespace;

  if (Object.keys(htmlExtractorConfig).length > 0) {
    // Apply defaults using the schema to ensure all fields have proper values
    config.htmlExtractor = HtmlExtractionOptionsSchema.parse(htmlExtractorConfig);
  }

  return config;
}

/**
 * Validate configuration using Zod schema
 */
function validateConfig(config: unknown, filepath?: string): EnigmaConfig {
  try {
    return EnigmaConfigSchema.parse(config);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const issues = error.issues
        .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
        .join("\n");

      throw new ConfigError(
        `Invalid configuration${filepath ? ` in ${filepath}` : ""}:\n${issues}`,
        filepath,
        error,
      );
    }
    throw new ConfigError(
      `Configuration validation failed${filepath ? ` for ${filepath}` : ""}`,
      filepath,
      error as Error,
    );
  }
}

/**
 * Asynchronously load configuration from files using cosmiconfig
 */
async function loadConfigFromFile(
  searchFrom?: string,
  configFile?: string,
): Promise<{
  config: Partial<EnigmaConfig>;
  filepath?: string;
  isEmpty?: boolean;
}> {
  const explorer = cosmiconfig("enigma");

  try {
    let result;

    if (configFile) {
      // Load specific config file
      result = await explorer.load(configFile);
    } else {
      // Search for config file
      result = await explorer.search(searchFrom);
    }

    if (!result) {
      return { config: {} };
    }

    return {
      config: result.config || {},
      filepath: result.filepath,
      isEmpty: result.isEmpty,
    };
  } catch (error) {
    throw new ConfigError(
      `Failed to load configuration${configFile ? ` from ${configFile}` : ""}`,
      configFile,
      error as Error,
    );
  }
}

/**
 * Synchronously load configuration from files using cosmiconfig
 */
function loadConfigFromFileSync(
  searchFrom?: string,
  configFile?: string,
): {
  config: Partial<EnigmaConfig>;
  filepath?: string;
  isEmpty?: boolean;
} {
  const explorer = cosmiconfigSync("enigma");

  try {
    let result;

    if (configFile) {
      // Load specific config file
      result = explorer.load(configFile);
    } else {
      // Search for config file
      result = explorer.search(searchFrom);
    }

    if (!result) {
      return { config: {} };
    }

    return {
      config: result.config || {},
      filepath: result.filepath,
      isEmpty: result.isEmpty,
    };
  } catch (error) {
    throw new ConfigError(
      `Failed to load configuration${configFile ? ` from ${configFile}` : ""}`,
      configFile,
      error as Error,
    );
  }
}

/**
 * Asynchronously load and merge configuration from all sources
 * Precedence: defaults → config file → CLI arguments (CLI wins)
 */
export async function loadConfig(
  cliArgs: CliArguments = {},
  searchFrom?: string,
): Promise<ConfigResult> {
  try {
    // Step 1: Start with defaults
    let mergedConfig = { ...DEFAULT_CONFIG };

    // Step 2: Load and merge config file
    const {
      config: fileConfig,
      filepath,
      isEmpty,
    } = await loadConfigFromFile(searchFrom, cliArgs.config);

    if (Object.keys(fileConfig).length > 0) {
      mergedConfig = deepMerge(mergedConfig, fileConfig);
    }

    // Step 3: Apply CLI arguments (highest precedence)
    const normalizedCliArgs = normalizeCliArguments(cliArgs);
    if (Object.keys(normalizedCliArgs).length > 0) {
      mergedConfig = deepMerge(mergedConfig, normalizedCliArgs);
    }

    // Step 4: Validate final configuration
    const validatedConfig = validateConfig(mergedConfig, filepath);

    return {
      config: validatedConfig,
      filepath,
      isEmpty,
    };
  } catch (error) {
    if (error instanceof ConfigError) {
      throw error;
    }
    throw new ConfigError(
      "Failed to load configuration",
      undefined,
      error as Error,
    );
  }
}

/**
 * Synchronously load and merge configuration from all sources
 * Precedence: defaults → config file → CLI arguments (CLI wins)
 */
export function loadConfigSync(
  cliArgs: CliArguments = {},
  searchFrom?: string,
): ConfigResult {
  try {
    // Step 1: Start with defaults
    let mergedConfig = { ...DEFAULT_CONFIG };

    // Step 2: Load and merge config file
    const {
      config: fileConfig,
      filepath,
      isEmpty,
    } = loadConfigFromFileSync(searchFrom, cliArgs.config);

    if (Object.keys(fileConfig).length > 0) {
      mergedConfig = deepMerge(mergedConfig, fileConfig);
    }

    // Step 3: Apply CLI arguments (highest precedence)
    const normalizedCliArgs = normalizeCliArguments(cliArgs);
    if (Object.keys(normalizedCliArgs).length > 0) {
      mergedConfig = deepMerge(mergedConfig, normalizedCliArgs);
    }

    // Step 4: Validate final configuration
    const validatedConfig = validateConfig(mergedConfig, filepath);

    return {
      config: validatedConfig,
      filepath,
      isEmpty,
    };
  } catch (error) {
    if (error instanceof ConfigError) {
      throw error;
    }
    throw new ConfigError(
      "Failed to load configuration",
      undefined,
      error as Error,
    );
  }
}

/**
 * Get configuration with sensible defaults for common use cases
 */
export async function getConfig(cliArgs?: CliArguments): Promise<EnigmaConfig> {
  const result = await loadConfig(cliArgs);
  return result.config;
}

/**
 * Get configuration synchronously with sensible defaults
 */
export function getConfigSync(cliArgs?: CliArguments): EnigmaConfig {
  const result = loadConfigSync(cliArgs);
  return result.config;
}

/**
 * Create a sample configuration file content for users
 */
export function createSampleConfig(): string {
  return `// enigma.config.js
module.exports = {
  // Output settings
  pretty: false,
  
  // File processing
  input: "./src",
  output: "./dist",
  
  // Processing options
  minify: true,
  removeUnused: true,
  
  // Debug and logging
  verbose: false,
  debug: false,
  
  // Performance settings
  maxConcurrency: 4,
  
  // Output customization
  classPrefix: "",
  excludePatterns: ["node_modules/**", "*.test.*"],
  
  // File Discovery Options
  followSymlinks: false,
  // maxFiles: 1000,
  // includeFileTypes: ["HTML", "JAVASCRIPT"],
  excludeExtensions: [".min.js", ".min.css"],
  
  // Advanced options
  preserveComments: false,
  sourceMaps: false,
};
`;
}


