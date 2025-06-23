// Test import to debug module resolution
import * as scrambleModule from '@tw-enigma/scramble';

console.log('Available exports:', Object.keys(scrambleModule));
console.log('ScrambleEngine type:', typeof scrambleModule.ScrambleEngine);

// Try direct import

export {};
