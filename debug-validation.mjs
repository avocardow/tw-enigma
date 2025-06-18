import { validateNameGenerationOptions } from './dist/index.mjs';

const invalidOptions = [
  { minimumLength: 0 }, // Below minimum
  { minimumLength: 27 }, // Above maximum
  { minimumLength: -1 }, // Negative
  { minimumLength: 'abc' }, // Wrong type
  { minimumLength: 1.5 }, // Decimal
];

console.log('Testing invalid options individually:');

invalidOptions.forEach((options, i) => {
  try {
    const result = validateNameGenerationOptions(options);
    console.log(`❌ Option ${i} did NOT throw (result: ${result.minimumLength}):`, options);
  } catch (e) {
    console.log(`✅ Option ${i} threw correctly:`, options, '->', e.message);
  }
});

console.log('\nTesting the whole array loop (like in test):');
try {
  for (const options of invalidOptions) {
    validateNameGenerationOptions(options);
  }
  console.log('❌ All options passed without throwing!');
} catch (e) {
  console.log('✅ At least one threw an error:', e.message);
}
