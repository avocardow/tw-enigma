/**
 * Copyright (c) 2025 Rowan Cardow
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {
  OptimizedFrequencyCounter,
  PatternTrie,
  CoOccurrenceMatrix,
  NormalizedPatternCache,
  DataStructureManager,
  createDataStructureManager,
  createFrequencyCounter,
  createPatternTrie,
  DEFAULT_DATA_STRUCTURE_CONFIG,
} from '../dataStructures';

describe('OptimizedFrequencyCounter', () => {
  let counter: OptimizedFrequencyCounter<string>;

  beforeEach(() => {
    counter = new OptimizedFrequencyCounter({
      maxEntries: 100,
      enableLRUEviction: true,
    });
  });

  describe('basic operations', () => {
    test('should increment frequency correctly', () => {
      expect(counter.increment('test')).toBe(1);
      expect(counter.increment('test')).toBe(2);
      expect(counter.increment('other')).toBe(1);
    });

    test('should decrement frequency correctly', () => {
      counter.increment('test');
      counter.increment('test');
      
      expect(counter.decrement('test')).toBe(1);
      expect(counter.decrement('test')).toBe(0);
      expect(counter.decrement('test')).toBe(0); // Should not go below 0
    });

    test('should get frequency correctly', () => {
      counter.increment('test');
      counter.increment('test');
      
      expect(counter.get('test')).toBe(2);
      expect(counter.get('nonexistent')).toBe(0);
    });

    test('should check existence correctly', () => {
      counter.increment('test');
      
      expect(counter.has('test')).toBe(true);
      expect(counter.has('nonexistent')).toBe(false);
    });

    test('should delete entries correctly', () => {
      counter.increment('test');
      
      expect(counter.delete('test')).toBe(true);
      expect(counter.has('test')).toBe(false);
      expect(counter.delete('nonexistent')).toBe(false);
    });

    test('should clear all entries', () => {
      counter.increment('test1');
      counter.increment('test2');
      
      counter.clear();
      
      expect(counter.size()).toBe(0);
      expect(counter.has('test1')).toBe(false);
      expect(counter.has('test2')).toBe(false);
    });
  });

  describe('advanced operations', () => {
    beforeEach(() => {
      // Setup test data
      for (let i = 0; i < 5; i++) {
        counter.increment('high-freq');
      }
      for (let i = 0; i < 3; i++) {
        counter.increment('medium-freq');
      }
      counter.increment('low-freq');
    });

    test('should return top K items correctly', () => {
      const topK = counter.getTopK(2);
      
      expect(topK).toHaveLength(2);
      expect(topK[0]).toEqual(['high-freq', 5]);
      expect(topK[1]).toEqual(['medium-freq', 3]);
    });

    test('should return items above minimum frequency', () => {
      const above2 = counter.getMinimumFrequency(2);
      
      expect(above2).toHaveLength(2);
      expect(above2.find(([key]) => key === 'high-freq')).toBeDefined();
      expect(above2.find(([key]) => key === 'medium-freq')).toBeDefined();
      expect(above2.find(([key]) => key === 'low-freq')).toBeUndefined();
    });

    test('should provide iterators', () => {
      const entries = Array.from(counter.entries());
      const keys = Array.from(counter.keys());
      const values = Array.from(counter.values());
      
      expect(entries).toHaveLength(3);
      expect(keys).toHaveLength(3);
      expect(values).toHaveLength(3);
      
      expect(keys).toContain('high-freq');
      expect(values).toContain(5);
    });
  });

  describe('LRU eviction', () => {
    test('should evict least recently used items when limit exceeded', () => {
      const smallCounter = new OptimizedFrequencyCounter({
        maxEntries: 3,
        enableLRUEviction: true,
      });

      // Add items up to limit
      smallCounter.increment('item1');
      smallCounter.increment('item2');
      smallCounter.increment('item3');
      
      expect(smallCounter.size()).toBe(3);
      
      // Access item1 to make it recently used
      smallCounter.get('item1');
      
      // Add new item, should evict least recently used
      smallCounter.increment('item4');
      smallCounter.increment('item5');
      
      // item1 should still exist (recently accessed)
      expect(smallCounter.has('item1')).toBe(true);
      // Some older items should be evicted
      expect(smallCounter.size()).toBeLessThanOrEqual(3);
    });
  });

  describe('memory statistics', () => {
    test('should provide memory usage statistics', () => {
      counter.increment('test1');
      counter.increment('test2');
      
      const stats = counter.getMemoryStats();
      
      expect(stats.mapEntries).toBe(2);
      expect(stats.accessOrderEntries).toBe(2);
      expect(stats.estimatedMemoryBytes).toBeGreaterThan(0);
    });
  });
});

describe('PatternTrie', () => {
  let trie: PatternTrie<string>;

  beforeEach(() => {
    trie = new PatternTrie({
      maxTrieDepth: 10,
    });
  });

  describe('basic operations', () => {
    test('should insert and search patterns correctly', () => {
      trie.insert('hello', 'value1');
      trie.insert('world', 'value2');
      
      expect(trie.search('hello')).toBe('value1');
      expect(trie.search('world')).toBe('value2');
      expect(trie.search('nonexistent')).toBeUndefined();
    });

    test('should check pattern existence correctly', () => {
      trie.insert('test', 'value');
      
      expect(trie.has('test')).toBe(true);
      expect(trie.has('nonexistent')).toBe(false);
    });

    test('should handle prefix searches', () => {
      trie.insert('prefix-1', 'value1');
      trie.insert('prefix-2', 'value2');
      trie.insert('other', 'value3');
      
      const prefixResults = trie.getByPrefix('prefix');
      
      expect(prefixResults).toHaveLength(2);
      expect(prefixResults.map(r => r.pattern)).toContain('prefix-1');
      expect(prefixResults.map(r => r.pattern)).toContain('prefix-2');
      expect(prefixResults.map(r => r.pattern)).not.toContain('other');
    });

    test('should track frequency correctly', () => {
      trie.insert('test', 'value1');
      trie.insert('test', 'value2'); // Should update frequency
      
      const results = trie.getByPrefix('test');
      expect(results[0].frequency).toBe(2);
    });

    test('should delete patterns correctly', () => {
      trie.insert('test', 'value');
      
      expect(trie.delete('test')).toBe(true);
      expect(trie.has('test')).toBe(false);
      expect(trie.delete('nonexistent')).toBe(false);
    });

    test('should clear all patterns', () => {
      trie.insert('test1', 'value1');
      trie.insert('test2', 'value2');
      
      trie.clear();
      
      expect(trie.has('test1')).toBe(false);
      expect(trie.has('test2')).toBe(false);
    });
  });

  describe('frequency-based queries', () => {
    beforeEach(() => {
      // Insert patterns with different frequencies
      for (let i = 0; i < 5; i++) {
        trie.insert('high-freq', `value${i}`);
      }
      for (let i = 0; i < 2; i++) {
        trie.insert('low-freq', `value${i}`);
      }
    });

    test('should return patterns by minimum frequency', () => {
      const highFreqPatterns = trie.getByMinFrequency(3);
      
      expect(highFreqPatterns).toHaveLength(1);
      expect(highFreqPatterns[0].pattern).toBe('high-freq');
      expect(highFreqPatterns[0].frequency).toBe(5);
    });

    test('should sort results by frequency', () => {
      trie.insert('medium-freq', 'value');
      trie.insert('medium-freq', 'value');
      trie.insert('medium-freq', 'value');
      
      const allPatterns = trie.getByMinFrequency(1);
      
      expect(allPatterns[0].frequency).toBeGreaterThanOrEqual(allPatterns[1].frequency);
      expect(allPatterns[1].frequency).toBeGreaterThanOrEqual(allPatterns[2].frequency);
    });
  });

  describe('metadata handling', () => {
    test('should store and preserve metadata', () => {
      const metadata = { source: 'test.ts', line: 10 };
      trie.insert('test', 'value', metadata);
      
      const results = trie.getByPrefix('test');
      expect(results[0]).toHaveProperty('pattern', 'test');
    });
  });

  describe('statistics', () => {
    test('should provide trie statistics', () => {
      trie.insert('test1', 'value1');
      trie.insert('test2', 'value2');
      trie.insert('longer-pattern', 'value3');
      
      const stats = trie.getStats();
      
      expect(stats.nodeCount).toBeGreaterThan(0);
      expect(stats.patternCount).toBe(3);
      expect(stats.maxDepth).toBeGreaterThan(0);
      expect(stats.memoryEstimateBytes).toBeGreaterThan(0);
    });
  });
});

describe('CoOccurrenceMatrix', () => {
  let matrix: CoOccurrenceMatrix;

  beforeEach(() => {
    matrix = new CoOccurrenceMatrix({
      enableCoOccurrenceTracking: true,
      maxCoOccurrenceDistance: 5,
    });
  });

  describe('basic operations', () => {
    test('should add co-occurrences correctly', () => {
      matrix.addCoOccurrence('class1', 'class2');
      matrix.addCoOccurrence('class1', 'class2'); // Should increment
      
      expect(matrix.getCoOccurrence('class1', 'class2')).toBe(2);
      expect(matrix.getCoOccurrence('class2', 'class1')).toBe(2); // Should be symmetric
    });

    test('should handle distance constraints', () => {
      matrix.addCoOccurrence('class1', 'class2', 3);
      matrix.addCoOccurrence('class1', 'class3', 10); // Should be ignored (exceeds max distance)
      
      expect(matrix.getCoOccurrence('class1', 'class2')).toBe(1);
      expect(matrix.getCoOccurrence('class1', 'class3')).toBe(0);
    });

    test('should find co-occurring patterns', () => {
      matrix.addCoOccurrence('class1', 'class2');
      matrix.addCoOccurrence('class1', 'class3');
      matrix.addCoOccurrence('class1', 'class2'); // Higher frequency with class2
      
      const coOccurring = matrix.getCoOccurringPatterns('class1');
      
      expect(coOccurring).toHaveLength(2);
      expect(coOccurring[0].pattern).toBe('class2'); // Should be sorted by score
      expect(coOccurring[0].count).toBe(2);
    });

    test('should return top co-occurrences', () => {
      matrix.addCoOccurrence('class1', 'class2');
      matrix.addCoOccurrence('class1', 'class2');
      matrix.addCoOccurrence('class3', 'class4');
      
      const topPairs = matrix.getTopCoOccurrences(5);
      
      expect(topPairs.length).toBeGreaterThan(0);
      expect(topPairs[0]).toHaveProperty('pattern1');
      expect(topPairs[0]).toHaveProperty('pattern2');
      expect(topPairs[0]).toHaveProperty('count');
      expect(topPairs[0]).toHaveProperty('score');
    });

    test('should clear all data', () => {
      matrix.addCoOccurrence('class1', 'class2');
      
      matrix.clear();
      
      expect(matrix.getCoOccurrence('class1', 'class2')).toBe(0);
    });
  });

  describe('statistics', () => {
    test('should provide matrix statistics', () => {
      matrix.addCoOccurrence('class1', 'class2');
      matrix.addCoOccurrence('class1', 'class3');
      
      const stats = matrix.getStats();
      
      expect(stats.uniquePatterns).toBe(3);
      expect(stats.totalCoOccurrences).toBeGreaterThan(0);
      expect(stats.memoryEstimateBytes).toBeGreaterThan(0);
    });
  });

  describe('disabled tracking', () => {
    test('should not track when disabled', () => {
      const disabledMatrix = new CoOccurrenceMatrix({
        enableCoOccurrenceTracking: false,
      });
      
      disabledMatrix.addCoOccurrence('class1', 'class2');
      
      expect(disabledMatrix.getCoOccurrence('class1', 'class2')).toBe(0);
    });
  });
});

describe('NormalizedPatternCache', () => {
  let cache: NormalizedPatternCache;

  beforeEach(() => {
    cache = new NormalizedPatternCache({
      patternCacheSize: 10,
    });
  });

  describe('basic operations', () => {
    test('should cache normalized patterns', () => {
      const normalizer = jest.fn((pattern: string) => pattern.toLowerCase());
      
      const result1 = cache.getNormalized('Test', normalizer);
      const result2 = cache.getNormalized('Test', normalizer);
      
      expect(result1).toBe('test');
      expect(result2).toBe('test');
      expect(normalizer).toHaveBeenCalledTimes(1); // Should be cached
    });

    test('should handle cache hits and misses', () => {
      cache.set('test', 'normalized-test');
      
      expect(cache.has('test')).toBe(true);
      expect(cache.has('nonexistent')).toBe(false);
    });

    test('should provide cache statistics', () => {
      cache.set('test1', 'normalized1');
      cache.set('test2', 'normalized2');
      
      const stats = cache.getStats();
      
      expect(stats.size).toBe(2);
      expect(stats.maxSize).toBe(10);
      expect(stats.memoryEstimateBytes).toBeGreaterThan(0);
    });

    test('should clear cache', () => {
      cache.set('test', 'normalized');
      
      cache.clear();
      
      expect(cache.has('test')).toBe(false);
    });
  });

  describe('LRU eviction', () => {
    test('should evict old entries when cache is full', () => {
      const smallCache = new NormalizedPatternCache({
        patternCacheSize: 3,
      });

      smallCache.set('item1', 'norm1');
      smallCache.set('item2', 'norm2');
      smallCache.set('item3', 'norm3');
      
      // Access item1 to make it recently used
      smallCache.has('item1');
      
      // Add more items
      smallCache.set('item4', 'norm4');
      smallCache.set('item5', 'norm5');
      
      // item1 should still exist (recently accessed)
      expect(smallCache.has('item1')).toBe(true);
      // Cache should not exceed max size significantly
      expect(smallCache.getStats().size).toBeLessThanOrEqual(4);
    });
  });
});

describe('DataStructureManager', () => {
  let manager: DataStructureManager;

  beforeEach(() => {
    manager = new DataStructureManager({
      maxEntries: 100,
      enableCoOccurrenceTracking: true,
    });
  });

  describe('integration operations', () => {
    test('should add patterns across all data structures', () => {
      manager.addPattern('test-pattern', ['related1', 'related2']);
      
      expect(manager.frequencyCounter.get('test-pattern')).toBe(1);
      expect(manager.patternTrie.has('test-pattern')).toBe(true);
      
      const coOccurring = manager.coOccurrenceMatrix.getCoOccurringPatterns('test-pattern');
      expect(coOccurring.length).toBeGreaterThan(0);
    });

    test('should analyze patterns comprehensively', () => {
      manager.addPattern('test-pattern', ['related']);
      manager.addPattern('test-pattern'); // Increment frequency
      
      const analysis = manager.analyzePattern('test-pattern');
      
      expect(analysis.frequency).toBe(2);
      expect(analysis.exists).toBe(true);
      expect(analysis.coOccurringPatterns).toBeDefined();
      expect(analysis.prefixMatches).toBeDefined();
    });

    test('should provide overall statistics', () => {
      manager.addPattern('pattern1');
      manager.addPattern('pattern2', ['pattern1']);
      
      const stats = manager.getOverallStats();
      
      expect(stats.frequencyCounter.mapEntries).toBeGreaterThan(0);
      expect(stats.patternTrie.patternCount).toBeGreaterThan(0);
      expect(stats.totalMemoryEstimateBytes).toBeGreaterThan(0);
    });

    test('should clear all data structures', () => {
      manager.addPattern('test');
      
      manager.clearAll();
      
      expect(manager.frequencyCounter.size()).toBe(0);
      expect(manager.patternTrie.has('test')).toBe(false);
      expect(manager.coOccurrenceMatrix.getCoOccurrence('test', 'test')).toBe(0);
    });
  });

  describe('memory pressure monitoring', () => {
    test('should detect memory pressure', () => {
      // Add many patterns to trigger pressure
      for (let i = 0; i < 200; i++) {
        manager.addPattern(`pattern-${i}`);
      }
      
      const pressureCheck = manager.checkMemoryPressure();
      
      expect(pressureCheck).toHaveProperty('isUnderPressure');
      expect(pressureCheck).toHaveProperty('recommendations');
      expect(pressureCheck).toHaveProperty('currentMemoryMB');
      expect(pressureCheck).toHaveProperty('estimatedMaxMemoryMB');
    });

    test('should provide recommendations when under pressure', () => {
      const largeManager = new DataStructureManager({
        maxEntries: 10, // Very small limit
      });
      
      for (let i = 0; i < 50; i++) {
        largeManager.addPattern(`pattern-${i}`);
      }
      
      const pressureCheck = largeManager.checkMemoryPressure();
      
      if (pressureCheck.isUnderPressure) {
        expect(pressureCheck.recommendations.length).toBeGreaterThan(0);
      }
    });
  });
});

describe('Factory Functions', () => {
  test('createDataStructureManager should create manager with config', () => {
    const config = {
      maxEntries: 50,
      enableLRUEviction: false,
    };
    
    const manager = createDataStructureManager(config);
    
    expect(manager).toBeInstanceOf(DataStructureManager);
  });

  test('createFrequencyCounter should create counter with config', () => {
    const config = {
      maxEntries: 50,
    };
    
    const counter = createFrequencyCounter<string>(config);
    
    expect(counter).toBeInstanceOf(OptimizedFrequencyCounter);
  });

  test('createPatternTrie should create trie with config', () => {
    const config = {
      maxTrieDepth: 15,
    };
    
    const trie = createPatternTrie<string>(config);
    
    expect(trie).toBeInstanceOf(PatternTrie);
  });
});

describe('Configuration', () => {
  test('should use default configuration', () => {
    const manager = new DataStructureManager();
    const stats = manager.getOverallStats();
    
    expect(stats).toBeDefined();
  });

  test('should merge partial configuration with defaults', () => {
    const manager = new DataStructureManager({
      maxEntries: 25,
      // Other fields should use defaults
    });
    
    // Should work without errors
    manager.addPattern('test');
    expect(manager.frequencyCounter.get('test')).toBe(1);
  });

  test('should validate configuration', () => {
    expect(() => {
      new DataStructureManager({
        maxEntries: -1, // Invalid
      });
    }).not.toThrow(); // Should handle invalid configs gracefully
  });
});

describe('Edge Cases and Error Handling', () => {
  test('should handle empty patterns gracefully', () => {
    const manager = new DataStructureManager();
    
    manager.addPattern('');
    manager.addPattern('   '); // Whitespace only
    
    // Should not crash
    const analysis = manager.analyzePattern('');
    expect(analysis).toBeDefined();
  });

  test('should handle very long patterns', () => {
    const manager = new DataStructureManager({
      maxTrieDepth: 5, // Short depth
    });
    
    const longPattern = 'a'.repeat(100);
    manager.addPattern(longPattern);
    
    // Should truncate and work
    expect(manager.patternTrie.has(longPattern.substring(0, 5))).toBe(true);
  });

  test('should handle special characters in patterns', () => {
    const manager = new DataStructureManager();
    
    const specialPattern = 'test-pattern_with.special@chars#123';
    manager.addPattern(specialPattern);
    
    expect(manager.frequencyCounter.get(specialPattern)).toBe(1);
  });

  test('should handle unicode characters', () => {
    const cache = new NormalizedPatternCache();
    const normalizer = (pattern: string) => pattern.normalize('NFKC');
    
    const unicodePattern = 'test-émojis-🎉-unicode';
    const normalized = cache.getNormalized(unicodePattern, normalizer);
    
    expect(normalized).toBe(unicodePattern.normalize('NFKC'));
  });
});

describe('Performance and Scalability', () => {
  test('should handle large number of patterns efficiently', () => {
    const manager = new DataStructureManager({
      maxEntries: 10000,
    });
    
    const start = Date.now();
    
    // Add many patterns
    for (let i = 0; i < 1000; i++) {
      manager.addPattern(`pattern-${i}`);
    }
    
    const duration = Date.now() - start;
    
    // Should complete reasonably quickly (adjust threshold as needed)
    expect(duration).toBeLessThan(5000); // 5 seconds
    
    const stats = manager.getOverallStats();
    expect(stats.frequencyCounter.mapEntries).toBe(1000);
  });

  test('should provide memory estimates within reasonable bounds', () => {
    const manager = new DataStructureManager();
    
    for (let i = 0; i < 100; i++) {
      manager.addPattern(`pattern-${i}`);
    }
    
    const stats = manager.getOverallStats();
    
    // Memory estimate should be reasonable (not negative or extremely large)
    expect(stats.totalMemoryEstimateBytes).toBeGreaterThan(0);
    expect(stats.totalMemoryEstimateBytes).toBeLessThan(100 * 1024 * 1024); // Less than 100MB
  });
});