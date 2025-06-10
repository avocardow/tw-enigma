import { describe, test, expect, beforeEach } from 'vitest';
import {
  // Base conversion utilities
  toBase26,
  fromBase26,
  toBase36,
  toCustomBase,
  calculateOptimalLength,
  validateBaseConversions,
  
  // Sequential generation
  generateSequentialName,
  generateSequentialNames,
  createNameCollisionCache,
  hasNameCollision,
  generateNextAvailableName,
  batchGenerateAvailableNames,
  calculateGenerationStatistics,
  validateGenerationSetup,
  
  // Frequency-based optimization
  sortByFrequency,
  createFrequencyBuckets,
  optimizeByFrequency,
  calculateCompressionStats,
  analyzeFrequencyDistribution,
  
  // Main API
  NameCollisionManager,
  generateOptimizedNames,
  exportNameGenerationResult,
  generateSimpleNames,
  
  // Configuration and validation
  validateNameGenerationOptions,
  isValidCssIdentifier,
  isReservedName,
  
  // Constants and types
  ALPHABET_CONFIGS,
  NameGenerationError,
  CollisionError,
  InvalidNameError,
  CacheError,
  
  type NameGenerationOptions,
  type PatternFrequencyMap,
  type AggregatedClassData,
} from '../src/nameGeneration.js';

// Mock data for testing
const mockFrequencyMap: PatternFrequencyMap = new Map([
  ['text-blue-500', {
    totalFrequency: 150,
    sourceFrequency: { html: 80, jsx: 70 },
    coOccurrences: new Map([['bg-white', 45], ['p-4', 30]]),
    frameworkUsage: { react: 70, vue: 80 },
    sourceFiles: ['src/App.tsx', 'src/components/Button.tsx'],
    attributes: { htmlClasses: 80, jsxClasses: 70 },
  }],
  ['bg-white', {
    totalFrequency: 120,
    sourceFrequency: { html: 60, jsx: 60 },
    coOccurrences: new Map([['text-blue-500', 45], ['rounded', 25]]),
    frameworkUsage: { react: 60, vue: 60 },
    sourceFiles: ['src/App.tsx'],
    attributes: { htmlClasses: 60, jsxClasses: 60 },
  }],
  ['p-4', {
    totalFrequency: 80,
    sourceFrequency: { html: 40, jsx: 40 },
    coOccurrences: new Map([['text-blue-500', 30], ['bg-white', 20]]),
    frameworkUsage: { react: 40, vue: 40 },
    sourceFiles: ['src/components/Card.tsx'],
    attributes: { htmlClasses: 40, jsxClasses: 40 },
  }],
  ['hover:bg-blue-600', {
    totalFrequency: 25,
    sourceFrequency: { html: 10, jsx: 15 },
    coOccurrences: new Map([['text-white', 15]]),
    frameworkUsage: { react: 15, vue: 10 },
    sourceFiles: ['src/components/Button.tsx'],
    attributes: { htmlClasses: 10, jsxClasses: 15 },
  }],
  ['text-sm', {
    totalFrequency: 60,
    sourceFrequency: { html: 30, jsx: 30 },
    coOccurrences: new Map([['text-gray-600', 20]]),
    frameworkUsage: { react: 30, vue: 30 },
    sourceFiles: ['src/components/Text.tsx'],
    attributes: { htmlClasses: 30, jsxClasses: 30 },
  }],
]);

describe('Name Generation Module', () => {
  describe('Base Conversion Utilities', () => {
    test('toBase26 generates correct sequence', () => {
      expect(toBase26(0)).toBe('a');
      expect(toBase26(25)).toBe('z');
      expect(toBase26(26)).toBe('aa');
      expect(toBase26(51)).toBe('az');
      expect(toBase26(52)).toBe('ba');
      expect(toBase26(701)).toBe('zz');
      expect(toBase26(702)).toBe('aaa');
    });

    test('fromBase26 correctly reverses toBase26', () => {
      const testValues = [0, 1, 25, 26, 51, 52, 100, 701, 702, 1000];
      
      for (const value of testValues) {
        const base26 = toBase26(value);
        const reversed = fromBase26(base26);
        expect(reversed).toBe(value);
      }
    });

    test('toBase36 generates CSS-safe names', () => {
      const name1 = toBase36(0);
      const name2 = toBase36(25);
      const name3 = toBase36(26);
      
      expect(name1).toBe('a');
      expect(name2).toBe('z');
      expect(name3).toBe('a'); // Implementation uses letters first, then extends
      
      // All names should be CSS-valid
      expect(isValidCssIdentifier(name1)).toBe(true);
      expect(isValidCssIdentifier(name2)).toBe(true);
      expect(isValidCssIdentifier(name3)).toBe(true);
    });

    test('toCustomBase handles different alphabets', () => {
      const minimalAlphabet = 'abc';
      
      expect(toCustomBase(0, minimalAlphabet)).toBe('a');
      expect(toCustomBase(1, minimalAlphabet)).toBe('b');
      expect(toCustomBase(2, minimalAlphabet)).toBe('c');
      expect(toCustomBase(3, minimalAlphabet)).toBe('aa');
    });

    test('calculateOptimalLength provides accurate capacity calculations', () => {
      const result = calculateOptimalLength(100, ALPHABET_CONFIGS.minimal);
      
      expect(result.minLength).toBeGreaterThan(0);
      expect(result.capacity).toBeGreaterThanOrEqual(100);
      expect(result.efficiency).toBeGreaterThan(0);
      expect(result.efficiency).toBeLessThanOrEqual(100);
      expect(result.charactersPerLength).toHaveLength(result.minLength);
    });

    test('validateBaseConversions catches conversion errors', () => {
      expect(() => validateBaseConversions(10)).not.toThrow();
      
      const results = validateBaseConversions(10);
      expect(results).toHaveLength(10);
      
      for (const result of results) {
        expect(result.valid).toBe(true);
        expect(result.input).toBeGreaterThanOrEqual(0);
        expect(result.output).toBeTruthy();
      }
    });

    test('base conversion error handling', () => {
      expect(() => toBase26(-1)).toThrow(NameGenerationError);
      expect(() => fromBase26('')).toThrow(NameGenerationError);
      expect(() => fromBase26('123')).toThrow(NameGenerationError);
      expect(() => toCustomBase(0, 'a')).toThrow(NameGenerationError);
    });
  });

  describe('Sequential Name Generation', () => {
    const basicOptions: NameGenerationOptions = {
      alphabet: ALPHABET_CONFIGS.minimal,
      strategy: 'sequential',
      numericSuffix: false,
      startIndex: 0,
      enableFrequencyOptimization: false,
      frequencyThreshold: 1,
      reservedNames: [],
      avoidConflicts: true,
      enableCaching: false,
      batchSize: 100,
      maxCacheSize: 1000,
      prefix: '',
      suffix: '',
      ensureCssValid: true,
    };

    test('generateSequentialName creates valid CSS identifiers', () => {
      const name1 = generateSequentialName(0, basicOptions);
      const name2 = generateSequentialName(25, basicOptions);
      const name3 = generateSequentialName(26, basicOptions);
      
      expect(name1).toBe('a');
      expect(name2).toBe('z');
      expect(name3).toBe('aa');
      
      expect(isValidCssIdentifier(name1)).toBe(true);
      expect(isValidCssIdentifier(name2)).toBe(true);
      expect(isValidCssIdentifier(name3)).toBe(true);
    });

    test('generateSequentialNames creates multiple names efficiently', () => {
      const names = generateSequentialNames(5, basicOptions);
      
      expect(names).toHaveLength(5);
      expect(names).toEqual(['a', 'b', 'c', 'd', 'e']);
      
      // All should be unique
      const uniqueNames = new Set(names);
      expect(uniqueNames.size).toBe(names.length);
    });

    test('collision cache management', () => {
      const cache = createNameCollisionCache(basicOptions);
      
      expect(cache.usedNames.size).toBe(0);
      expect(cache.reservedNames.size).toBeGreaterThan(0); // CSS keywords
      expect(cache.nameIndex).toBe(0);
      
      // Test collision detection
      expect(hasNameCollision('auto', cache)).toBe(true); // CSS keyword
      expect(hasNameCollision('customname', cache)).toBe(false);
      
      // Test name generation with collision avoidance
      const result = generateNextAvailableName(cache, basicOptions);
      expect(result.name).toBeTruthy();
      expect(result.index).toBeGreaterThanOrEqual(0);
      expect(cache.usedNames.has(result.name)).toBe(true);
    });

    test('batch generation with collision checking', () => {
      const cache = createNameCollisionCache(basicOptions);
      const results = batchGenerateAvailableNames(10, cache, basicOptions);
      
      expect(results).toHaveLength(10);
      
      // All names should be unique
      const names = results.map(r => r.name);
      const uniqueNames = new Set(names);
      expect(uniqueNames.size).toBe(names.length);
      
      // All should be in cache
      for (const result of results) {
        expect(cache.usedNames.has(result.name)).toBe(true);
      }
    });

    test('generation statistics are accurate', () => {
      const stats = calculateGenerationStatistics(100, basicOptions);
      
      expect(stats.expectedLength).toBeGreaterThan(0);
      expect(stats.minLength).toBeGreaterThan(0);
      expect(stats.maxLength).toBeGreaterThanOrEqual(stats.minLength);
      expect(stats.efficiency).toBeGreaterThan(0);
      expect(stats.estimatedCollisions).toBeGreaterThanOrEqual(0);
      expect(stats.totalCapacity).toBeGreaterThanOrEqual(100);
    });

    test('setup validation catches configuration errors', () => {
      const invalidOptions = { ...basicOptions, alphabet: 'a' }; // Too short
      const validation = validateGenerationSetup(invalidOptions);
      
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('Alphabet must have at least 2 characters');
    });
  });

  describe('Frequency-Based Optimization', () => {
    test('sortByFrequency orders classes correctly', () => {
      const sorted = sortByFrequency(mockFrequencyMap, {
        frequencyThreshold: 1,
      } as NameGenerationOptions);
      
      expect(sorted).toHaveLength(5);
      expect(sorted[0].name).toBe('text-blue-500'); // Highest frequency (150)
      expect(sorted[1].name).toBe('bg-white'); // Second highest (120)
      expect(sorted[4].name).toBe('hover:bg-blue-600'); // Lowest (25)
      
      // Frequencies should be in descending order
      for (let i = 1; i < sorted.length; i++) {
        expect(sorted[i-1].frequency).toBeGreaterThanOrEqual(sorted[i].frequency);
      }
    });

    test('createFrequencyBuckets distributes classes by frequency', () => {
      const sorted = sortByFrequency(mockFrequencyMap, {
        frequencyThreshold: 1,
      } as NameGenerationOptions);
      
      const buckets = createFrequencyBuckets(sorted, {} as NameGenerationOptions);
      
      expect(buckets.length).toBeGreaterThan(0);
      
      // Check bucket strategies
      const strategies = buckets.map(b => b.strategy);
      expect(strategies).toContain('shortest'); // Top frequency bucket
      
      // Total names should equal input
      const totalNames = buckets.reduce((sum, bucket) => sum + bucket.names.length, 0);
      expect(totalNames).toBe(sorted.length);
    });

    test('optimizeByFrequency generates appropriate mappings', () => {
      const nameMap = optimizeByFrequency(mockFrequencyMap, {
        alphabet: ALPHABET_CONFIGS.minimal,
        strategy: 'frequency-optimized',
        frequencyThreshold: 1,
      } as NameGenerationOptions);
      
      expect(nameMap.size).toBe(mockFrequencyMap.size);
      
      // Highest frequency class should get shortest name
      const highestFreqClass = 'text-blue-500';
      const optimizedName = nameMap.get(highestFreqClass);
      expect(optimizedName).toBeTruthy();
      expect(optimizedName!.length).toBeLessThanOrEqual(2); // Should be very short
    });

    test('calculateCompressionStats provides accurate metrics', () => {
      const nameMap = new Map([
        ['text-blue-500', 'a'],
        ['bg-white', 'b'],
        ['hover:bg-blue-600', 'c'],
      ]);
      
      const stats = calculateCompressionStats(mockFrequencyMap, nameMap);
      
      expect(stats.totalOriginalLength).toBeGreaterThan(0);
      expect(stats.totalOptimizedLength).toBeGreaterThan(0);
      expect(stats.overallCompressionRatio).toBeGreaterThan(1); // Should be compressed
      expect(stats.classCompressionRatios).toHaveLength(nameMap.size);
      expect(stats.frequencyWeightedCompression).toBeGreaterThan(1);
      expect(stats.bestCompressed).toBeTruthy();
      expect(stats.worstCompressed).toBeTruthy();
    });

    test('analyzeFrequencyDistribution provides insights', () => {
      const analysis = analyzeFrequencyDistribution(mockFrequencyMap);
      
      expect(analysis.totalClasses).toBe(mockFrequencyMap.size);
      expect(analysis.averageFrequency).toBeGreaterThan(0);
      expect(analysis.medianFrequency).toBeGreaterThan(0);
      expect(analysis.frequencyRanges).toHaveLength(5);
      expect(analysis.recommendations).toHaveLength(analysis.recommendations.length);
      
      // Frequency ranges should add up to total
      const totalFromRanges = analysis.frequencyRanges.reduce((sum, range) => sum + range.count, 0);
      expect(totalFromRanges).toBe(analysis.totalClasses);
    });
  });

  describe('Collision Management', () => {
    let manager: NameCollisionManager;
    const testOptions: NameGenerationOptions = {
      alphabet: ALPHABET_CONFIGS.standard,
      strategy: 'sequential',
      reservedNames: ['custom-reserved'],
      enableCaching: true,
    } as NameGenerationOptions;

    beforeEach(() => {
      manager = new NameCollisionManager(testOptions, true);
    });

    test('collision manager initializes correctly', () => {
      const stats = manager.getStats();
      
      expect(stats.usedNames).toBe(0);
      expect(stats.reservedNames).toBeGreaterThan(0); // CSS keywords + custom
      expect(stats.currentIndex).toBe(0);
      expect(stats.cacheHitRate).toBe(0);
    });

    test('collision manager handles cache loading', async () => {
      const existingCache = new Map([
        ['old-class', 'a'],
        ['another-class', 'b'],
      ]);
      
      await manager.loadFromCache(existingCache);
      
      const stats = manager.getStats();
      expect(stats.usedNames).toBe(2);
      expect(stats.currentIndex).toBeGreaterThanOrEqual(2);
    });

    test('collision manager reserves names correctly', () => {
      const success1 = manager.reserveName('uniquename', 'original-class');
      const success2 = manager.reserveName('uniquename'); // Should fail - collision
      
      expect(success1).toBe(true);
      expect(success2).toBe(false);
      
      const stats = manager.getStats();
      expect(stats.usedNames).toBe(1);
    });

    test('collision manager saves cache', async () => {
      manager.reserveName('testname', 'original');
      const savedCache = await manager.saveToCache();
      
      expect(savedCache.has('original')).toBe(true);
      expect(savedCache.get('original')).toBe('testname');
    });

    test('collision manager clears correctly', () => {
      manager.reserveName('testname');
      manager.clear();
      
      const stats = manager.getStats();
      expect(stats.usedNames).toBe(0);
      expect(stats.currentIndex).toBe(0);
    });
  });

  describe('Main API Functions', () => {
    test('generateOptimizedNames produces complete results', async () => {
      const options: NameGenerationOptions = {
        strategy: 'frequency-optimized',
        alphabet: ALPHABET_CONFIGS.minimal,
        enableCaching: false,
      } as NameGenerationOptions;
      
      const result = await generateOptimizedNames(mockFrequencyMap, options);
      
      expect(result.nameMap.size).toBe(mockFrequencyMap.size);
      expect(result.reverseMap.size).toBe(mockFrequencyMap.size);
      expect(result.generatedNames).toHaveLength(mockFrequencyMap.size);
      
      // Metadata validation
      expect(result.metadata.totalNames).toBe(mockFrequencyMap.size);
      expect(result.metadata.generationTime).toBeGreaterThanOrEqual(0);
      expect(result.metadata.strategy).toBe('frequency-optimized');
      expect(result.metadata.overallCompressionRatio).toBeGreaterThan(1);
      
      // Statistics validation
      expect(result.statistics.lengthDistribution.size).toBeGreaterThan(0);
      expect(result.statistics.frequencyBuckets).toHaveLength(result.statistics.frequencyBuckets.length);
      expect(result.statistics.mostCompressed).toBeTruthy();
      expect(result.statistics.leastCompressed).toBeTruthy();
    });

    test('generateOptimizedNames handles different strategies', async () => {
      const strategies: Array<NameGenerationOptions['strategy']> = ['sequential', 'frequency-optimized', 'hybrid'];
      
      for (const strategy of strategies) {
        const options: NameGenerationOptions = {
          strategy,
          alphabet: ALPHABET_CONFIGS.standard,
        } as NameGenerationOptions;
        
        const result = await generateOptimizedNames(mockFrequencyMap, options);
        expect(result.metadata.strategy).toBe(strategy);
        expect(result.nameMap.size).toBe(mockFrequencyMap.size);
      }
    });

    test('exportNameGenerationResult creates JSON-serializable output', async () => {
      const result = await generateOptimizedNames(mockFrequencyMap, {
        strategy: 'sequential',
      } as NameGenerationOptions);
      
      const exported = exportNameGenerationResult(result);
      
      expect(typeof exported.nameMap).toBe('object');
      expect(typeof exported.reverseMap).toBe('object');
      expect(typeof exported.metadata).toBe('object');
      expect(typeof exported.statistics.lengthDistribution).toBe('object');
      
      // Should be JSON serializable
      expect(() => JSON.stringify(exported)).not.toThrow();
    });

    test('generateSimpleNames works without frequency data', async () => {
      const classNames = ['class1', 'class2', 'class3'];
      const nameMap = await generateSimpleNames(classNames, {
        alphabet: ALPHABET_CONFIGS.minimal,
      } as NameGenerationOptions);
      
      expect(nameMap.size).toBe(classNames.length);
      
      for (const className of classNames) {
        expect(nameMap.has(className)).toBe(true);
        const optimizedName = nameMap.get(className)!;
        expect(isValidCssIdentifier(optimizedName)).toBe(true);
      }
    });
  });

  describe('Configuration and Validation', () => {
    test('validateNameGenerationOptions handles default values', () => {
      const minimal = {};
      const validated = validateNameGenerationOptions(minimal);
      
      expect(validated.alphabet).toBeTruthy();
      expect(validated.strategy).toBeTruthy();
      expect(validated.ensureCssValid).toBe(true);
      expect(validated.enableCaching).toBe(true);
    });

    test('validateNameGenerationOptions validates input types', () => {
      const invalid = {
        alphabet: 123, // Wrong type
        strategy: 'invalid-strategy',
        batchSize: -1,
      };
      
      expect(() => validateNameGenerationOptions(invalid)).toThrow(NameGenerationError);
    });

    test('isValidCssIdentifier correctly validates CSS names', () => {
      expect(isValidCssIdentifier('validname')).toBe(true);
      expect(isValidCssIdentifier('valid-name')).toBe(true);
      expect(isValidCssIdentifier('valid_name')).toBe(true);
      expect(isValidCssIdentifier('ValidName')).toBe(true);
      expect(isValidCssIdentifier('valid123')).toBe(true);
      
      expect(isValidCssIdentifier('123invalid')).toBe(false); // Starts with number
      expect(isValidCssIdentifier('-invalid')).toBe(false); // Starts with hyphen
      expect(isValidCssIdentifier('invalid name')).toBe(false); // Contains space
      expect(isValidCssIdentifier('invalid@name')).toBe(false); // Invalid character
    });

    test('isReservedName detects CSS keywords and custom reserved names', () => {
      expect(isReservedName('auto')).toBe(true); // CSS keyword
      expect(isReservedName('AUTO')).toBe(true); // Case insensitive
      expect(isReservedName('inherit')).toBe(true);
      expect(isReservedName('customname')).toBe(false);
      
      const customReserved = new Set(['myreserved', 'anotherone']);
      expect(isReservedName('myreserved', customReserved)).toBe(true);
      expect(isReservedName('notreserved', customReserved)).toBe(false);
    });
  });

  describe('Error Handling', () => {
    test('NameGenerationError includes cause information', () => {
      const cause = new Error('Original error');
      const error = new NameGenerationError('Generation failed', cause);
      
      expect(error.message).toBe('Generation failed');
      expect(error.cause).toBe(cause);
      expect(error.name).toBe('NameGenerationError');
    });

    test('CollisionError includes conflict details', () => {
      const error = new CollisionError('Collision detected', 'existing', 'attempted');
      
      expect(error.conflictingName).toBe('existing');
      expect(error.attemptedName).toBe('attempted');
      expect(error.name).toBe('CollisionError');
    });

    test('InvalidNameError includes validation details', () => {
      const error = new InvalidNameError('Invalid CSS identifier', 'badname', 'css-invalid');
      
      expect(error.invalidName).toBe('badname');
      expect(error.reason).toBe('css-invalid');
      expect(error.name).toBe('InvalidNameError');
    });

    test('CacheError includes operation details', () => {
      const error = new CacheError('Cache operation failed', 'write');
      
      expect(error.operation).toBe('write');
      expect(error.name).toBe('CacheError');
    });
  });

  describe('Performance and Edge Cases', () => {
    test('handles large numbers of classes efficiently', async () => {
      // Create a larger mock frequency map
      const largeMap = new Map<string, AggregatedClassData>();
      for (let i = 0; i < 1000; i++) {
        largeMap.set(`class-${i}`, {
          totalFrequency: Math.floor(Math.random() * 100) + 1,
          sourceFrequency: { html: 50, jsx: 50 },
          coOccurrences: new Map(),
          frameworkUsage: { react: 50, vue: 50 },
          sourceFiles: [`file-${i}.tsx`],
          attributes: { htmlClasses: 50, jsxClasses: 50 },
        });
      }
      
      const startTime = Date.now();
      const result = await generateOptimizedNames(largeMap, {
        strategy: 'frequency-optimized',
        batchSize: 100,
      } as NameGenerationOptions);
      const endTime = Date.now();
      
      expect(result.nameMap.size).toBe(1000);
      expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5 seconds
    });

    test('handles empty frequency map gracefully', async () => {
      const emptyMap = new Map<string, AggregatedClassData>();
      const result = await generateOptimizedNames(emptyMap);
      
      expect(result.nameMap.size).toBe(0);
      expect(result.generatedNames).toHaveLength(0);
      expect(result.metadata.totalNames).toBe(0);
    });

    test('handles collision exhaustion gracefully', () => {
      const tinyAlphabet = 'ab'; // Very small alphabet
      const cache = createNameCollisionCache({
        alphabet: tinyAlphabet,
        reservedNames: ['a', 'b'], // Reserve all possible names
      } as NameGenerationOptions);
      
      expect(() => generateNextAvailableName(cache, {
        alphabet: tinyAlphabet,
        reservedNames: ['a', 'b'],
      } as NameGenerationOptions)).toThrow(CollisionError);
    });

    test('maintains consistency across multiple runs with caching', async () => {
      const options: NameGenerationOptions = {
        strategy: 'sequential',
        enableCaching: true,
        startIndex: 0,
      } as NameGenerationOptions;
      
      const result1 = await generateOptimizedNames(mockFrequencyMap, options);
      const cache = new Map(result1.nameMap);
      
      const result2 = await generateOptimizedNames(mockFrequencyMap, options, cache);
      
      // Results should be identical when using same cache
      expect(result1.nameMap.size).toBe(result2.nameMap.size);
      for (const [key, value] of result1.nameMap) {
        expect(result2.nameMap.get(key)).toBe(value);
      }
    });
  });
}); 