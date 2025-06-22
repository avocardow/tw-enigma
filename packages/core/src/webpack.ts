/**
 * Webpack Integration for TW-Enigma
 *
 * This module provides webpack-specific integration for the TW-Enigma CSS optimization engine.
 */

export {
  EnigmaWebpackPlugin,
  createWebpackPlugin,
  defaultWebpackConfig,
} from './integrations/webpack/webpackPlugin';

export type { WebpackPluginConfig } from './integrations/webpack/webpackPlugin';

// For backward compatibility, also export as TwEnigmaWebpackPlugin
export { EnigmaWebpackPlugin as TwEnigmaWebpackPlugin } from './integrations/webpack/webpackPlugin';
