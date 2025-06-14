import { ProductionCssConfigManager } from './dist/index.js';

// Test the exact same scenario as the failing test
const configManager = new ProductionCssConfigManager();

const sampleCliArgs = {
  environment: "production",
  preset: "cdn",
  minify: true,
  compress: "gzip",
  sourceMap: false,
  chunks: "auto",
  "critical-css": true,
  "performance-budget": "100KB",
  output: "/tmp",
  verbose: false,
  "asset-hash": true,
  "hash-length": 8,
};

const devArgs = {
  ...sampleCliArgs,
  environment: "development",
};

const prodArgs = {
  ...sampleCliArgs,
  environment: "production",
};

console.log('=== DEVELOPMENT CONFIG ===');
const devConfig = configManager.fromCliArgs(devArgs);
console.log('devConfig.optimization.minify:', devConfig.optimization.minify);
console.log('devConfig.compression.type:', devConfig.compression.type);
console.log('devConfig.optimization.sourceMap:', devConfig.optimization.sourceMap);

console.log('\n=== PRODUCTION CONFIG ===');
const prodConfig = configManager.fromCliArgs(prodArgs);
console.log('prodConfig.optimization.minify:', prodConfig.optimization.minify);
console.log('prodConfig.compression.type:', prodConfig.compression.type);
console.log('prodConfig.optimization.sourceMap:', prodConfig.optimization.sourceMap); 