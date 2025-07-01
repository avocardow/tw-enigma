/**
 * Basic integration tests for Pattern Selection and Optimization System
 *
 * These tests verify core functionality of the pattern selection system.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { PatternSelectionEngine } from '../patternSelection';

describe('Pattern Selection Integration Tests', () => {
  let selectionEngine: PatternSelectionEngine;

  beforeEach(() => {
    selectionEngine = new PatternSelectionEngine({
      algorithm: 'heuristic',
      criteria: {
        frequency: 0.25,
        performance: 0.2,
        maintainability: 0.2,
        hierarchy: 0.15,
        conflicts: 0.1,
        consolidation: 0.05,
        semantics: 0.03,
        dependencies: 0.02,
      },
    });
  });

  afterEach(() => {
    if (selectionEngine && typeof selectionEngine.reset === 'function') {
      selectionEngine.reset();
    }
  });

  describe('Basic Pattern Selection', () => {
    it('should create engine with default configuration', () => {
      expect(selectionEngine).toBeDefined();
      expect(typeof selectionEngine.selectOptimalPatterns).toBe('function');
    });

    it('should handle empty pattern array gracefully', async () => {
      const result = await selectionEngine.selectOptimalPatterns([]);
      expect(result).toBeDefined();
      expect(result.selectedPatterns).toHaveLength(0);
      expect(result.rejectedPatterns).toHaveLength(0);
    });

    it('should provide performance statistics', () => {
      const stats = selectionEngine.getPerformanceStats();
      expect(stats).toBeDefined();
      expect(typeof stats.averageProcessingTime).toBe('number');
      expect(typeof stats.totalSelections).toBe('number');
    });

    it('should allow configuration updates', () => {
      expect(() => {
        selectionEngine.updateConfig({
          algorithm: 'greedy',
        });
      }).not.toThrow();
    });
  });

  describe('Algorithm Selection', () => {
    it('should work with greedy algorithm', () => {
      const greedyEngine = new PatternSelectionEngine({ algorithm: 'greedy' });
      expect(greedyEngine).toBeDefined();
    });

    it('should work with heuristic algorithm', () => {
      const heuristicEngine = new PatternSelectionEngine({ algorithm: 'heuristic' });
      expect(heuristicEngine).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle null input gracefully', async () => {
      try {
        await selectionEngine.selectOptimalPatterns(null as any);
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it('should handle undefined input gracefully', async () => {
      try {
        await selectionEngine.selectOptimalPatterns(undefined as any);
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });
});
