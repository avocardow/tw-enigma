/**
 * Config Module - Configuration Management
 *
 * This module contains configuration management functionality including
 * validation, migration, backup, and watching capabilities.
 */

// Core Configuration
export * from './config';
export * from './configValidator';
export * from './configDefaults';
export type { CliArguments } from './config';

// Configuration Lifecycle
export * from './configMigration';
export * from './configBackup';
export * from './configSafeUpdater';
export * from './configWatcher';

// Advanced Configuration System (Task 17)
export {
  ConfigFileParser,
  ConfigFileParseError,
} from './configFileParser';

export type {
  ConfigFileParserOptions,
  ParsedConfig,
  ConfigParseWarning,
  ConfigFileFormat,
} from './configFileParser';

export {
  ConfigOverrideProcessor,
  ConfigOverrideError,
  createConfigOverrideProcessor,
  applyConfigOverrides,
} from './configOverrides';

export type {
  ConfigOverrideOptions,
  OverrideResult,
  OverrideWarning,
} from './configOverrides';

export {
  ConfigManager,
  ConfigManagerError,
  createConfigManager,
  loadTWEnigmaConfig,
} from './configManager';

export type {
  ConfigManagerOptions,
  LoadedConfig,
  ConfigManagerWarning,
} from './configManager';

export {
  TWEnigmaConfigSchema,
  PartialTWEnigmaConfigSchema,
  ENV_VAR_MAPPING,
  CLI_FLAG_MAPPING,
  DEFAULT_PRESETS,
} from './configSchema';

export type {
  TWEnigmaConfig,
} from './configSchema';

export {
  ConfigValidator,
  ConfigValidationError,
  createConfigValidator,
  validateTWEnigmaConfig,
} from './configValidation';

export type {
  ValidationContext,
  ValidationRule,
  ValidationIssue,
  ValidationResult,
  ConfigValidatorOptions,
} from './configValidation';

export {
  IntelligentDefaultsEngine,
  createIntelligentDefaults,
  applyIntelligentDefaults,
} from './intelligentDefaults';

export type {
  DefaultsContext,
  DefaultRule,
  DefaultsResult,
  IntelligentDefaultsOptions,
} from './intelligentDefaults';

// Version export for config module
export const configVersion = '0.1.0';
