// Core configuration module
export * from "./config.js";

// File discovery module
export * from "./fileDiscovery.js";

// HTML class extraction module
export * from "./htmlExtractor.js";

// JavaScript/JSX class extraction module
export * from "./jsExtractor.js";

// Main entry point for the library
export { version } from "../package.json";

// Main exports for Tailwind Enigma Core
export * from './config.js';
export * from './fileDiscovery.js';
export * from './htmlExtractor.js';
export * from './jsExtractor.js';
export * from './patternAnalysis.js';

// Core components
export { logger } from './logger.js';
export { ErrorHandler } from './errorHandler/errorHandler.js';

// Performance optimizations
export * from './performance/index.js'; 