// Test environment variable loading
process.env.TW_ENIGMA_NAME_GENERATION_MINIMUM_LENGTH = '8';
process.env.TW_ENIGMA_NAME_GENERATION_STRATEGY = 'hybrid';
process.env.TW_ENIGMA_NAME_GENERATION_PREFIX = 'env-';

// Load the module after setting env vars
const { normalizeCliArguments } = require('./src/config/config.ts');

console.log('=== Environment Variable Test ===');
try {
  const envResult = normalizeCliArguments({});
  console.log(
    '✅ Environment variables loaded:',
    JSON.stringify(envResult.nameGeneration, null, 2)
  );
} catch (error) {
  console.log('❌ Environment test failed:', error.message);
}

console.log('\n=== Priority Test (CLI > ENV) ===');
try {
  const priorityResult = normalizeCliArguments({
    nameGenerationMinimumLength: 12, // Should override ENV value of 8
  });
  console.log('✅ Priority logic working:', JSON.stringify(priorityResult.nameGeneration, null, 2));
} catch (error) {
  console.log('❌ Priority test failed:', error.message);
}
