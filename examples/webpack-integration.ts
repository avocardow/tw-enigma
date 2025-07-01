/**
 * Webpack Integration Example
 * 
 * This example demonstrates how to integrate TW-Enigma dry run functionality
 * with Webpack builds, including plugin configuration, hooks, and optimization.
 */

import { 
  EnigmaWebpackPlugin,
  createDryRunConfig,
  withDryRun,
  getDryRunReportGenerator,
  getPerformanceTestRunner
} from '@tw-enigma/core';

import webpack from 'webpack';
import path from 'path';

/**
 * Main webpack integration example
 */
async function webpackIntegrationExample() {
  console.log('📦 Webpack Integration Example');
  console.log('==============================\n');

  try {
    // Different integration approaches
    await basicWebpackIntegration();
    await advancedWebpackIntegration();
    await developmentModeIntegration();
    await productionModeIntegration();
    await customHooksIntegration();

    console.log('\n✅ All Webpack integration examples completed successfully!');

  } catch (error) {
    console.error('❌ Webpack integration failed:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

/**
 * Basic Webpack plugin integration
 */
async function basicWebpackIntegration(): Promise<void> {
  console.log('🔧 Basic Webpack Integration');
  console.log('============================\n');

  const webpackConfig: webpack.Configuration = {
    mode: 'development',
    entry: './src/index.js',
    output: {
      path: path.resolve(__dirname, 'dist'),
      filename: 'bundle.js',
    },
    plugins: [
      new EnigmaWebpackPlugin({
        // Basic dry run configuration
        dryRun: true,
        outputPath: './webpack-dry-run-report.html',
        performanceTests: false,
      }),
    ],
    module: {
      rules: [
        {
          test: /\.css$/,
          use: ['style-loader', 'css-loader'],
        },
        {
          test: /\.(js|jsx|ts|tsx)$/,
          exclude: /node_modules/,
          use: {
            loader: 'babel-loader',
            options: {
              presets: ['@babel/preset-react', '@babel/preset-typescript'],
            },
          },
        },
      ],
    },
  };

  console.log('🚀 Running basic Webpack build with TW-Enigma...');
  
  // Simulate webpack compilation
  await simulateWebpackBuild(webpackConfig, 'basic');
  
  console.log('✅ Basic Webpack integration completed\n');
}

/**
 * Advanced Webpack plugin configuration
 */
async function advancedWebpackIntegration(): Promise<void> {
  console.log('⚙️  Advanced Webpack Integration');
  console.log('================================\n');

  const webpackConfig: webpack.Configuration = {
    mode: 'production',
    entry: {
      main: './src/index.js',
      vendor: './src/vendor.js',
    },
    output: {
      path: path.resolve(__dirname, 'dist'),
      filename: '[name].[contenthash].js',
      clean: true,
    },
    optimization: {
      splitChunks: {
        chunks: 'all',
      },
    },
    plugins: [
      new EnigmaWebpackPlugin({
        // Advanced configuration
        dryRun: process.env.NODE_ENV !== 'production',
        outputPath: './advanced-dry-run-report.html',
        performanceTests: true,
        regressionBaseline: './performance-baseline.json',
        
        // Optimization settings
        optimization: {
          level: 'aggressive',
          preserveClassNames: ['btn-*', 'nav-*'],
          minifyCSS: true,
          generateSourceMaps: true,
        },
        
        // Framework detection
        framework: {
          autoDetect: true,
          type: 'react',
          version: '18',
        },
        
        // Advanced dry run options
        dryRunConfig: {
          maxOperations: 10000,
          validateOperations: true,
          includeFileSystemChecks: true,
          generateVisualDiff: true,
          analyzeImpact: true,
        },
        
        // Performance monitoring
        performance: {
          enabled: true,
          thresholds: {
            maxExecutionTime: 30000,
            maxMemoryUsage: 512 * 1024 * 1024,
          },
          regressionTesting: {
            enabled: true,
            maxRegression: 15,
            updateBaseline: false,
          },
        },
        
        // Hook into Webpack lifecycle
        hooks: {
          beforeCompile: async (compilation) => {
            console.log('🔄 TW-Enigma: Before compilation hook triggered');
          },
          afterCompile: async (compilation, stats) => {
            console.log('✅ TW-Enigma: After compilation hook triggered');
            console.log(`Compilation time: ${stats.endTime - stats.startTime}ms`);
          },
          beforeOptimize: async (assets) => {
            console.log('🎯 TW-Enigma: Before optimization hook triggered');
            console.log(`Assets to optimize: ${Object.keys(assets).length}`);
          },
          afterOptimize: async (result) => {
            console.log('🚀 TW-Enigma: After optimization hook triggered');
            console.log(`Optimization result: ${result.status}`);
          },
        },
      }),
    ],
  };

  console.log('🚀 Running advanced Webpack build with TW-Enigma...');
  
  await simulateWebpackBuild(webpackConfig, 'advanced');
  
  console.log('✅ Advanced Webpack integration completed\n');
}

/**
 * Development mode integration
 */
async function developmentModeIntegration(): Promise<void> {
  console.log('🛠️  Development Mode Integration');
  console.log('================================\n');

  const webpackConfig: webpack.Configuration = {
    mode: 'development',
    devtool: 'eval-source-map',
    entry: './src/index.js',
    output: {
      path: path.resolve(__dirname, 'dev-dist'),
      filename: '[name].js',
    },
    devServer: {
      port: 3000,
      hot: true,
    },
    plugins: [
      new EnigmaWebpackPlugin({
        // Development-optimized settings
        dryRun: true, // Always dry run in development
        outputPath: './dev-dry-run-report.html',
        
        // Fast development settings
        optimization: {
          level: 'basic', // Faster compilation
          minifyCSS: false,
          generateSourceMaps: true,
        },
        
        // Development-friendly dry run
        dryRunConfig: {
          maxOperations: 1000, // Smaller limit for faster feedback
          logOperations: true, // More verbose in development
          validateOperations: true,
          simulateLatency: false, // No artificial delays
        },
        
        // Watch mode support
        watchMode: {
          enabled: true,
          debounceDelay: 300,
          aggregateTimeout: 200,
        },
        
        // Development hooks
        hooks: {
          onFileChange: async (changedFiles) => {
            console.log('📁 Files changed:', changedFiles);
            console.log('🔄 Running incremental dry run...');
          },
          onHotReload: async () => {
            console.log('🔥 Hot reload triggered, updating TW-Enigma analysis...');
          },
        },
      }),
    ],
  };

  console.log('🚀 Running development Webpack build with TW-Enigma...');
  
  await simulateWebpackBuild(webpackConfig, 'development');
  
  console.log('✅ Development mode integration completed\n');
}

/**
 * Production mode integration
 */
async function productionModeIntegration(): Promise<void> {
  console.log('🏭 Production Mode Integration');
  console.log('==============================\n');

  const webpackConfig: webpack.Configuration = {
    mode: 'production',
    entry: './src/index.js',
    output: {
      path: path.resolve(__dirname, 'prod-dist'),
      filename: '[name].[contenthash].js',
      clean: true,
    },
    optimization: {
      minimize: true,
      splitChunks: {
        chunks: 'all',
        cacheGroups: {
          vendor: {
            test: /[\\/]node_modules[\\/]/,
            name: 'vendors',
            chunks: 'all',
          },
        },
      },
    },
    plugins: [
      new EnigmaWebpackPlugin({
        // Production-optimized settings
        dryRun: process.env.DRY_RUN === 'true', // Optional dry run
        outputPath: './prod-dry-run-report.html',
        
        // Aggressive production optimization
        optimization: {
          level: 'extreme',
          minifyCSS: true,
          generateSourceMaps: false, // Disable for smaller bundles
          scrambleClassNames: true,
          removeUnusedCSS: true,
        },
        
        // Production dry run settings
        dryRunConfig: {
          maxOperations: 20000, // Higher limit for comprehensive analysis
          validateOperations: true,
          includeFileSystemChecks: true,
          generateVisualDiff: false, // Skip for performance
          analyzeImpact: true,
        },
        
        // Performance validation
        performance: {
          enabled: true,
          thresholds: {
            maxExecutionTime: 60000, // 1 minute max
            maxMemoryUsage: 1024 * 1024 * 1024, // 1GB max
            maxBundleSize: 5 * 1024 * 1024, // 5MB max
          },
          regressionTesting: {
            enabled: true,
            baselinePath: './prod-baseline.json',
            maxRegression: 10, // Stricter for production
            failOnRegression: true,
          },
        },
        
        // Production validation hooks
        hooks: {
          beforeBundle: async (assets) => {
            console.log('📦 Validating assets before bundling...');
            // Validate critical assets exist
          },
          afterBundle: async (bundle) => {
            console.log('🔍 Analyzing production bundle...');
            // Check bundle size, performance metrics
          },
          onValidationFail: async (errors) => {
            console.error('❌ Production validation failed:', errors);
            throw new Error('Production build validation failed');
          },
        },
      }),
    ],
  };

  console.log('🚀 Running production Webpack build with TW-Enigma...');
  
  await simulateWebpackBuild(webpackConfig, 'production');
  
  console.log('✅ Production mode integration completed\n');
}

/**
 * Custom hooks integration
 */
async function customHooksIntegration(): Promise<void> {
  console.log('🪝 Custom Hooks Integration');
  console.log('===========================\n');

  // Custom plugin class extending EnigmaWebpackPlugin
  class CustomEnigmaPlugin extends EnigmaWebpackPlugin {
    constructor(options: any) {
      super({
        ...options,
        hooks: {
          // Custom lifecycle hooks
          onProjectAnalysis: async (analysis) => {
            console.log('📊 Custom: Project analysis completed');
            console.log(`Files analyzed: ${analysis.totalFiles}`);
            console.log(`Classes found: ${analysis.totalClasses}`);
          },
          
          onOptimizationStart: async (context) => {
            console.log('🎯 Custom: Optimization starting');
            console.log(`Target: ${context.optimizationLevel}`);
          },
          
          onOptimizationProgress: async (progress) => {
            if (progress.percentage % 20 === 0) { // Log every 20%
              console.log(`⏳ Custom: Optimization progress ${progress.percentage}%`);
            }
          },
          
          onOptimizationComplete: async (result) => {
            console.log('✅ Custom: Optimization completed');
            console.log(`Classes optimized: ${result.classesOptimized}`);
            console.log(`Size reduction: ${result.sizeReduction}%`);
          },
          
          onError: async (error) => {
            console.error('❌ Custom: Error occurred');
            console.error(error.message);
            
            // Custom error handling
            if (error.recoverable) {
              console.log('🔄 Custom: Attempting recovery...');
              // Implement recovery logic
            }
          },
          
          onPerformanceThresholdExceeded: async (metric, threshold, actual) => {
            console.warn(`⚠️  Custom: Performance threshold exceeded`);
            console.warn(`Metric: ${metric}, Threshold: ${threshold}, Actual: ${actual}`);
            
            // Custom performance handling
            if (metric === 'memoryUsage') {
              console.log('🧹 Custom: Triggering garbage collection');
            }
          },
          
          onCacheHit: async (cacheKey, size) => {
            console.log(`💾 Custom: Cache hit for ${cacheKey} (${size} bytes)`);
          },
          
          onCacheMiss: async (cacheKey) => {
            console.log(`🔍 Custom: Cache miss for ${cacheKey}`);
          },
          
          ...options.hooks,
        },
      });
    }
  }

  const webpackConfig: webpack.Configuration = {
    mode: 'development',
    entry: './src/index.js',
    output: {
      path: path.resolve(__dirname, 'custom-dist'),
      filename: '[name].js',
    },
    plugins: [
      new CustomEnigmaPlugin({
        dryRun: true,
        outputPath: './custom-hooks-report.html',
        optimization: {
          level: 'aggressive',
        },
        // Enable performance monitoring to trigger hooks
        performance: {
          enabled: true,
          thresholds: {
            maxExecutionTime: 5000, // Low threshold to trigger warnings
            maxMemoryUsage: 100 * 1024 * 1024, // 100MB
          },
        },
      }),
    ],
  };

  console.log('🚀 Running custom hooks Webpack build...');
  
  await simulateWebpackBuild(webpackConfig, 'custom-hooks');
  
  console.log('✅ Custom hooks integration completed\n');
}

/**
 * Simulate webpack build process
 */
async function simulateWebpackBuild(config: webpack.Configuration, type: string): Promise<void> {
  console.log(`📦 Simulating ${type} Webpack build...`);
  
  // Simulate compilation phases
  const phases = [
    'Entry resolution',
    'Module parsing',
    'Dependency analysis',
    'TW-Enigma analysis',
    'Optimization',
    'Code generation',
    'Asset generation',
  ];

  for (const [index, phase] of phases.entries()) {
    await new Promise(resolve => setTimeout(resolve, 200));
    console.log(`  ${index + 1}/${phases.length} ${phase}...`);
  }

  // Simulate plugin execution
  const enigmaPlugin = config.plugins?.find(plugin => 
    plugin instanceof EnigmaWebpackPlugin || 
    plugin.constructor.name.includes('Enigma')
  );

  if (enigmaPlugin) {
    console.log('  🔧 TW-Enigma plugin executing...');
    await simulateEnigmaPluginExecution(enigmaPlugin, type);
  }

  // Simulate compilation stats
  const stats = {
    startTime: Date.now() - 3000,
    endTime: Date.now(),
    assets: generateMockAssets(type),
    modules: generateMockModules(type),
    chunks: generateMockChunks(type),
  };

  console.log(`✅ ${type} build completed in ${stats.endTime - stats.startTime}ms`);
  console.log(`   Assets: ${stats.assets.length}`);
  console.log(`   Modules: ${stats.modules.length}`);
  console.log(`   Chunks: ${stats.chunks.length}`);
}

/**
 * Simulate TW-Enigma plugin execution
 */
async function simulateEnigmaPluginExecution(plugin: any, buildType: string): Promise<void> {
  console.log('    🎯 Analyzing project structure...');
  await new Promise(resolve => setTimeout(resolve, 300));
  
  console.log('    🔍 Scanning for CSS classes...');
  await new Promise(resolve => setTimeout(resolve, 400));
  
  console.log('    ⚡ Running dry run analysis...');
  await new Promise(resolve => setTimeout(resolve, 500));
  
  console.log('    📊 Generating optimization report...');
  await new Promise(resolve => setTimeout(resolve, 300));
  
  console.log('    💾 Caching results...');
  await new Promise(resolve => setTimeout(resolve, 200));
  
  // Mock plugin results
  const mockResults = {
    classesFound: Math.floor(Math.random() * 500) + 100,
    classesOptimized: Math.floor(Math.random() * 200) + 50,
    sizeReduction: (Math.random() * 40 + 10).toFixed(1),
    executionTime: Math.floor(Math.random() * 2000) + 500,
  };

  console.log(`    ✅ TW-Enigma analysis completed:`);
  console.log(`       Classes found: ${mockResults.classesFound}`);
  console.log(`       Classes optimized: ${mockResults.classesOptimized}`);
  console.log(`       Size reduction: ${mockResults.sizeReduction}%`);
  console.log(`       Execution time: ${mockResults.executionTime}ms`);
}

/**
 * Generate mock webpack assets
 */
function generateMockAssets(buildType: string): Array<{ name: string; size: number }> {
  const baseAssets = [
    { name: 'main.js', size: 150000 },
    { name: 'main.css', size: 45000 },
  ];

  if (buildType === 'production') {
    return [
      { name: 'main.[hash].js', size: 120000 },
      { name: 'vendor.[hash].js', size: 350000 },
      { name: 'main.[hash].css', size: 35000 },
    ];
  }

  if (buildType === 'advanced') {
    return [
      ...baseAssets,
      { name: 'vendor.js', size: 400000 },
      { name: 'polyfills.js', size: 50000 },
    ];
  }

  return baseAssets;
}

/**
 * Generate mock webpack modules
 */
function generateMockModules(buildType: string): Array<{ name: string; size: number }> {
  const baseCount = buildType === 'production' ? 200 : 150;
  return Array.from({ length: baseCount }, (_, i) => ({
    name: `./src/module-${i}.js`,
    size: Math.floor(Math.random() * 10000) + 1000,
  }));
}

/**
 * Generate mock webpack chunks
 */
function generateMockChunks(buildType: string): Array<{ name: string; size: number }> {
  const chunks = [{ name: 'main', size: 150000 }];
  
  if (buildType === 'production' || buildType === 'advanced') {
    chunks.push({ name: 'vendor', size: 350000 });
  }
  
  return chunks;
}

// Example webpack configuration exports for different environments
export const developmentConfig: webpack.Configuration = {
  mode: 'development',
  devtool: 'eval-source-map',
  plugins: [
    new EnigmaWebpackPlugin({
      dryRun: true,
      optimization: { level: 'basic' },
      outputPath: './dev-report.html',
    }),
  ],
};

export const productionConfig: webpack.Configuration = {
  mode: 'production',
  plugins: [
    new EnigmaWebpackPlugin({
      dryRun: process.env.DRY_RUN === 'true',
      optimization: { level: 'extreme' },
      outputPath: './prod-report.html',
      performance: {
        enabled: true,
        regressionTesting: {
          enabled: true,
          baselinePath: './baseline.json',
        },
      },
    }),
  ],
};

// Run the example
if (require.main === module) {
  webpackIntegrationExample().catch(console.error);
}

export { 
  webpackIntegrationExample,
  basicWebpackIntegration,
  advancedWebpackIntegration,
  developmentModeIntegration,
  productionModeIntegration,
  customHooksIntegration
};