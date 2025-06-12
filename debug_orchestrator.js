import { createCssOutputOrchestrator } from './dist/index.js';
import { createDevelopmentConfig } from './dist/index.js';
import fs from 'fs/promises';
import path from 'path';

async function debugOrchestrator() {
  try {
    console.log('🔧 Creating configuration...');
    const config = createDevelopmentConfig();
    console.log('✅ Configuration created');
    
    // Debug the config structure, especially critical CSS
    console.log('📊 Config critical CSS:', JSON.stringify(config.criticalCss || config.critical, null, 2));
    console.log('📊 Config keys:', Object.keys(config));

    console.log('🔧 Creating orchestrator...');
    const orchestrator = createCssOutputOrchestrator(config);
    console.log('✅ Orchestrator created');

    console.log('🔧 Preparing test bundle...');
    const testBundle = {
      id: 'test-bundle',
      content: '.test { color: red; background-color: blue; }',
      sourcePath: 'test.css',
      priority: 1,
    };

    console.log('🔧 Preparing processing options...');
    const options = {
      environment: 'test',
      sourceMaps: false,
      outputDir: './temp-test-output',
    };

    // Create temp output directory
    await fs.mkdir('./temp-test-output', { recursive: true });
    console.log('✅ Output directory created');

    console.log('🔧 Processing bundle...');
    
    // Let's manually test the individual components
    console.log('🔍 Testing CSS analyzer...');
    try {
      const components = orchestrator.getComponents();
      const analyzer = components.analyzer;
      console.log('✅ Analyzer available:', !!analyzer);
      
      const analysis = await analyzer.analyzeCss(testBundle.content, {
        includeSizeMetrics: true,
        includeComplexityMetrics: true,
        includePerformanceMetrics: true,
      });
      console.log('✅ CSS analysis completed:', typeof analysis, Object.keys(analysis || {}));
    } catch (error) {
      console.error('❌ Analyzer failed:', error.message);
    }

    console.log('🔍 Testing CSS chunker directly...');
    try {
      const components = orchestrator.getComponents();
      const chunker = components.chunker;
      console.log('✅ Chunker available:', !!chunker);
      
      // Test if chunking methods exist and work
      const chunkBySize = chunker.chunkBySize(testBundle.content);
      console.log('✅ chunkBySize result:', Array.isArray(chunkBySize), chunkBySize?.length);
      
      // Test development config strategy
      console.log('📊 Config strategy:', config.strategy);
      console.log('📊 Config chunking strategy:', config.chunking?.strategy);
      
    } catch (error) {
      console.error('❌ Chunker failed:', error.message);
    }

    const result = await orchestrator.orchestrate([testBundle], options);
    
    console.log('✅ Processing completed!');
    console.log('Results size:', result.results.size);
    console.log('Global stats:', result.globalStats);
    console.log('Warnings:', result.warnings);
    
    if (result.results.size > 0) {
      const bundleResult = result.results.get('test-bundle');
      console.log('Bundle result exists:', !!bundleResult);
      if (bundleResult) {
        console.log('Chunks length:', bundleResult.chunks?.length);
        console.log('Hashes size:', bundleResult.hashes?.size);
        console.log('Stats:', bundleResult.stats);
      }
    } else {
      console.log('❌ No results found. This indicates the bundle processing failed.');
      if (result.warnings.length > 0) {
        console.log('📋 Warnings that might explain the issue:');
        result.warnings.forEach((warning, index) => {
          console.log(`  ${index + 1}. ${warning}`);
        });
      }
    }

    // Cleanup
    await fs.rm('./temp-test-output', { recursive: true, force: true });

  } catch (error) {
    console.error('❌ Error:', error);
    console.error('Stack:', error.stack);
  }
}

debugOrchestrator(); 