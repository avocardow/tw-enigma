import { createProductionConfigManager, validateProductionConfig } from './src/output/cssOutputConfig.ts';

// Test the configuration creation and validation
console.log('Testing configuration creation...');

try {
  // Create the same configuration as the CLI
  const cliArgs = {
    strategy: undefined,
    environment: 'production',
    compress: undefined,
    "critical-css": undefined,
    outDir: undefined,
    verbose: true,
    chunkSize: undefined,
    force: undefined,
    budgets: undefined,
    dryRun: undefined,
  };

  console.log('CLI args:', cliArgs);

  const configManager = createProductionConfigManager(undefined, undefined);
  console.log('Config manager created');

  const config = configManager.applyCliOverrides(cliArgs);
  console.log('Config generated:', JSON.stringify(config, null, 2));

  const validation = validateProductionConfig(config);
  console.log('Validation result:', {
    valid: validation.valid,
    errors: validation.errors,
    warnings: validation.warnings,
    suggestions: validation.suggestions
  });

} catch (error) {
  console.error('Error:', error.message);
  console.error('Stack:', error.stack);
} 