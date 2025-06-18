/**
 * CLI Type Definitions
 *
 * TypeScript interfaces and types for CLI options and configurations.
 */

/**
 * Global CLI options interface
 */
export interface GlobalOptions {
  verbose?: boolean;
  debug?: boolean;
  pretty?: boolean;
  p?: boolean; // Short flag for pretty
  config?: string;
  c?: string; // Alternative config flag
  input?: string;
  output?: string;
  quiet?: boolean;
  format?: 'json' | 'console' | 'markdown' | 'html' | 'all';
  maxConcurrency?: number;
  excludePatterns?: string[];
  length?: number; // Minimum class name length (1-26)
}

/**
 * Parsed and validated CLI options with resolved values
 */
export interface ValidatedOptions {
  verbose: boolean;
  debug: boolean;
  pretty: boolean;
  config: string | null;
  input: string | null;
  output: string | null;
  quiet: boolean;
  format: 'json' | 'console' | 'markdown' | 'html' | 'all';
  maxConcurrency: number;
  excludePatterns: string[];
  length: number | null; // null if not specified, otherwise validated 1-26
}
