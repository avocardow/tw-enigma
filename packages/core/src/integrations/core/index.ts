/**
 * Core Integration Modules
 * Exports all core integration functionality
 */

export type { BuildToolPlugin } from './buildToolPlugin';
export {
  BUILD_TOOL_PRESETS,
  BuildToolWatchIntegration,
  createBuildToolWatchIntegration,
} from './buildToolWatchIntegration';
export type {
  BuildToolAdapter,
  BuildToolWatchConfig,
  BuildToolWatchEvents,
  WatchIntegrationResult,
} from './buildToolWatchIntegration';
export * from './configDetector';
export { HMRHandler } from './hmrHandler';
export { IntegrationManager } from './integrationManager';
