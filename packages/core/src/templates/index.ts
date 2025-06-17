/**
 * Templates Module
 * Provides plugin templates and scaffolding
 */

// Export everything from pluginTemplate except pluginInfo
export {
  MyCustomPlugin,
  pluginInfo as basicPluginInfo,
  createMyCustomPlugin,
} from './pluginTemplate';

// Export everything from postcssPluginTemplate except pluginInfo
export {
  MyPostCSSPlugin,
  createMyPostCSSPlugin,
  pluginInfo as postcssPluginInfo,
} from './postcssPluginTemplate';
