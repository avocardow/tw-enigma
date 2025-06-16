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

// Configuration Lifecycle
export * from './configMigration';
export * from './configBackup';
export * from './configSafeUpdater';
export * from './configWatcher';

// Version export for config module
export const configVersion = '0.1.0';
