/**
 * Tests for AnalysisResultStore
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { AnalysisResultStore, createAnalysisResultStore } from '../../src/optimization/analysisResultStore';
import type { EntityMetadata, PatternDefinition, DiscoverySessionResult } from '../../src/optimization/analysisResultStore';

describe('AnalysisResultStore', () => {
  let tempDir: string;
  let store: AnalysisResultStore;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'tw-enigma-analysis-store-test-'));
    store = createAnalysisResultStore({
      dataDirectory: tempDir,
      enableAsyncWrites: false,
    });
    await store.initialize();
  });

  afterEach(async () => {
    await store.close();
    await rm(tempDir, { recursive: true, force: true });
  });

  describe('Entity Metadata Management', () => {
    it('should store and retrieve entity metadata', async () => {
      const metadata: EntityMetadata = {
        filePath: '/test/file.css',
        fileType: 'css',
        lastModified: Date.now(),
        size: 1024,
        checksum: 'abc123',
        analysisVersion: '1.0.0',
        patterns: ['pattern1', 'pattern2'],
        dependencies: ['/test/dependency.css'],
        tags: ['utility', 'components'],
      };

      await store.storeEntityMetadata(metadata);
      const retrieved = await store.getEntityMetadata('/test/file.css');

      expect(retrieved).toEqual(metadata);
    });

    it('should return null for non-existent entities', async () => {
      const result = await store.getEntityMetadata('/non-existent.css');
      expect(result).toBeNull();
    });

    it('should handle multiple versions of the same entity', async () => {
      const metadata1: EntityMetadata = {
        filePath: '/test/versioned.css',
        fileType: 'css',
        lastModified: 1000,
        size: 512,
        checksum: 'v1',
        analysisVersion: '1.0.0',
        patterns: ['pattern1'],
        dependencies: [],
        tags: [],
      };

      const metadata2: EntityMetadata = {
        filePath: '/test/versioned.css',
        fileType: 'css',
        lastModified: 2000,
        size: 1024,
        checksum: 'v2',
        analysisVersion: '1.0.0',
        patterns: ['pattern1', 'pattern2'],
        dependencies: [],
        tags: [],
      };

      await store.storeEntityMetadata(metadata1);
      await store.storeEntityMetadata(metadata2);

      const retrieved = await store.getEntityMetadata('/test/versioned.css');
      expect(retrieved?.lastModified).toBe(2000);
      expect(retrieved?.patterns).toHaveLength(2);
    });
  });

  describe('Pattern Analysis Results', () => {
    it('should store pattern analysis results', async () => {
      const patterns: PatternDefinition[] = [
        {
          id: 'pattern1',
          name: 'Button Pattern',
          type: 'component',
          category: 'ui',
          confidence: 0.9,
          frequency: 5,
          locations: [
            {
              file: 'button.css',
              startLine: 1,
              endLine: 10,
              context: '.btn { ... }',
            },
          ],
          signature: 'btn-signature',
          relationships: [],
          metadata: { framework: 'custom' },
        },
      ];

      const result = {
        entityId: 'entity123',
        patterns,
        metadata: { test: true },
      };

      await store.storePatternAnalysisResults([result]);

      const retrievedResults = await store.getEntityAnalysisResults('entity123');
      expect(retrievedResults).toHaveLength(1);
      expect(retrievedResults[0].patterns).toHaveLength(1);
      expect(retrievedResults[0].patterns[0].name).toBe('Button Pattern');
    });

    it('should deduplicate patterns across entities', async () => {
      const pattern: PatternDefinition = {
        id: 'shared-pattern',
        name: 'Shared Pattern',
        type: 'utility',
        category: 'spacing',
        confidence: 0.8,
        frequency: 3,
        locations: [
          {
            file: 'styles.css',
            startLine: 1,
            endLine: 1,
          },
        ],
        signature: 'shared-signature',
        relationships: [],
        metadata: {},
      };

      const result1 = {
        entityId: 'entity1',
        patterns: [pattern],
        metadata: {},
      };

      const result2 = {
        entityId: 'entity2',
        patterns: [{ ...pattern, frequency: 5 }], // Same pattern, higher frequency
        metadata: {},
      };

      await store.storePatternAnalysisResults([result1]);
      await store.storePatternAnalysisResults([result2]);

      // Both entities should reference the same pattern, with updated frequency
      const results1 = await store.getEntityAnalysisResults('entity1');
      const results2 = await store.getEntityAnalysisResults('entity2');

      expect(results1[0].patterns[0].frequency).toBe(5); // Updated to higher frequency
      expect(results2[0].patterns[0].frequency).toBe(5);
    });
  });

  describe('Pattern Querying', () => {
    beforeEach(async () => {
      // Set up test patterns
      const patterns: PatternDefinition[] = [
        {
          id: 'util1',
          name: 'Margin Utility',
          type: 'utility',
          category: 'spacing',
          confidence: 0.9,
          frequency: 10,
          locations: [],
          signature: 'margin-sig',
          relationships: [],
          metadata: {},
        },
        {
          id: 'comp1',
          name: 'Button Component',
          type: 'component',
          category: 'ui',
          confidence: 0.8,
          frequency: 5,
          locations: [],
          signature: 'button-sig',
          relationships: [],
          metadata: {},
        },
        {
          id: 'util2',
          name: 'Padding Utility',
          type: 'utility',
          category: 'spacing',
          confidence: 0.7,
          frequency: 8,
          locations: [],
          signature: 'padding-sig',
          relationships: [],
          metadata: {},
        },
      ];

      for (const pattern of patterns) {
        await store.storePatternAnalysisResults([{
          entityId: `entity-${pattern.id}`,
          patterns: [pattern],
          metadata: {},
        }]);
      }
    });

    it('should query patterns by category', async () => {
      const results = await store.queryPatterns({ category: 'spacing' });
      
      expect(results).toHaveLength(2);
      expect(results.every(p => p.category === 'spacing')).toBe(true);
    });

    it('should query patterns by type', async () => {
      const results = await store.queryPatterns({ patternType: 'utility' });
      
      expect(results).toHaveLength(2);
      expect(results.every(p => p.type === 'utility')).toBe(true);
    });

    it('should filter by confidence threshold', async () => {
      const results = await store.queryPatterns({ confidenceThreshold: 0.8 });
      
      expect(results).toHaveLength(2);
      expect(results.every(p => p.confidence >= 0.8)).toBe(true);
    });

    it('should sort patterns by frequency', async () => {
      const results = await store.queryPatterns({
        sortBy: 'frequency',
        sortOrder: 'desc',
      });
      
      expect(results).toHaveLength(3);
      expect(results[0].frequency).toBeGreaterThanOrEqual(results[1].frequency);
      expect(results[1].frequency).toBeGreaterThanOrEqual(results[2].frequency);
    });

    it('should apply limit and offset', async () => {
      const results = await store.queryPatterns({
        limit: 2,
        offset: 1,
      });
      
      expect(results).toHaveLength(2);
    });
  });

  describe('Discovery Sessions', () => {
    it('should store and retrieve discovery sessions', async () => {
      const session: DiscoverySessionResult = {
        sessionId: 'session123',
        startTime: 1000,
        endTime: 2000,
        entitiesProcessed: ['entity1', 'entity2'],
        totalPatterns: 10,
        uniquePatterns: 8,
        duplicatePatterns: 2,
        processingMetrics: [],
        errors: [],
        warnings: ['Minor issue detected'],
      };

      await store.storeDiscoverySession(session);
      const retrieved = await store.getDiscoverySession('session123');

      expect(retrieved).toEqual(session);
    });

    it('should list recent sessions', async () => {
      const sessions = [
        {
          sessionId: 'session1',
          startTime: 1000,
          endTime: 1500,
          entitiesProcessed: [],
          totalPatterns: 5,
          uniquePatterns: 5,
          duplicatePatterns: 0,
          processingMetrics: [],
          errors: [],
          warnings: [],
        },
        {
          sessionId: 'session2',
          startTime: 2000,
          endTime: 2500,
          entitiesProcessed: [],
          totalPatterns: 8,
          uniquePatterns: 7,
          duplicatePatterns: 1,
          processingMetrics: [],
          errors: [],
          warnings: [],
        },
      ];

      for (const session of sessions) {
        await store.storeDiscoverySession(session);
      }

      const recent = await store.getRecentSessions(5);
      expect(recent).toHaveLength(2);
      expect(recent[0].sessionId).toBe('session2'); // Most recent first
    });
  });

  describe('Pattern Frequency Storage', () => {
    it('should store and retrieve pattern frequencies', async () => {
      const frequencyMap = new Map([
        ['pattern1', 5],
        ['pattern2', 3],
        ['pattern3', 8],
      ]);

      await store.storePatternFrequency('session123', frequencyMap);
      const retrieved = await store.getPatternFrequency('session123');

      expect(retrieved).toEqual(frequencyMap);
    });
  });

  describe('Incremental Updates', () => {
    it('should perform incremental updates', async () => {
      // Set up initial state
      const metadata: EntityMetadata = {
        filePath: '/test/incremental.css',
        fileType: 'css',
        lastModified: 1000,
        size: 512,
        checksum: 'old',
        analysisVersion: '1.0.0',
        patterns: [],
        dependencies: [],
        tags: [],
      };

      await store.storeEntityMetadata(metadata);

      const session: DiscoverySessionResult = {
        sessionId: 'baseline',
        startTime: 1000,
        endTime: 1500,
        entitiesProcessed: ['/test/incremental.css'],
        totalPatterns: 1,
        uniquePatterns: 1,
        duplicatePatterns: 0,
        processingMetrics: [],
        errors: [],
        warnings: [],
      };

      await store.storeDiscoverySession(session);

      // Perform incremental update
      const context = {
        baselineSessionId: 'baseline',
        changedEntities: ['/test/incremental.css'],
        addedEntities: [],
        removedEntities: [],
        timestamp: 2000,
        reason: 'file_change' as const,
      };

      await store.performIncrementalUpdate(context);

      // Verify old analysis results were removed
      const results = await store.getEntityAnalysisResults('/test/incremental.css');
      expect(results).toHaveLength(0);
    });
  });

  describe('Session Diffing', () => {
    it('should diff between sessions', async () => {
      // Create patterns for different sessions
      const oldPattern: PatternDefinition = {
        id: 'old-pattern',
        name: 'Old Pattern',
        type: 'utility',
        category: 'spacing',
        confidence: 0.8,
        frequency: 3,
        locations: [],
        signature: 'old-sig',
        relationships: [],
        metadata: {},
      };

      const newPattern: PatternDefinition = {
        id: 'new-pattern',
        name: 'New Pattern',
        type: 'component',
        category: 'ui',
        confidence: 0.9,
        frequency: 5,
        locations: [],
        signature: 'new-sig',
        relationships: [],
        metadata: {},
      };

      const modifiedPattern: PatternDefinition = {
        id: 'modified-pattern',
        name: 'Modified Pattern',
        type: 'utility',
        category: 'spacing',
        confidence: 0.7,
        frequency: 2,
        locations: [],
        signature: 'mod-sig',
        relationships: [],
        metadata: {},
      };

      const modifiedPatternV2: PatternDefinition = {
        ...modifiedPattern,
        confidence: 0.9, // Changed confidence
        frequency: 4, // Changed frequency
      };

      // Store old session data
      await store.storePatternAnalysisResults([
        { entityId: 'entity1', patterns: [oldPattern, modifiedPattern], metadata: {} },
      ]);

      const oldSession: DiscoverySessionResult = {
        sessionId: 'old-session',
        startTime: 1000,
        endTime: 1500,
        entitiesProcessed: ['entity1'],
        totalPatterns: 2,
        uniquePatterns: 2,
        duplicatePatterns: 0,
        processingMetrics: [],
        errors: [],
        warnings: [],
      };

      await store.storeDiscoverySession(oldSession);

      // Store new session data
      await store.storePatternAnalysisResults([
        { entityId: 'entity2', patterns: [newPattern, modifiedPatternV2], metadata: {} },
      ]);

      const newSession: DiscoverySessionResult = {
        sessionId: 'new-session',
        startTime: 2000,
        endTime: 2500,
        entitiesProcessed: ['entity2'],
        totalPatterns: 2,
        uniquePatterns: 2,
        duplicatePatterns: 0,
        processingMetrics: [],
        errors: [],
        warnings: [],
      };

      await store.storeDiscoverySession(newSession);

      // Perform diff
      const diff = await store.diffSessions('old-session', 'new-session');

      expect(diff.addedPatterns).toHaveLength(1);
      expect(diff.addedPatterns[0].name).toBe('New Pattern');
      
      expect(diff.removedPatterns).toHaveLength(1);
      expect(diff.removedPatterns[0].name).toBe('Old Pattern');
      
      expect(diff.modifiedPatterns).toHaveLength(1);
      expect(diff.modifiedPatterns[0].old.confidence).toBe(0.7);
      expect(diff.modifiedPatterns[0].new.confidence).toBe(0.9);
    });
  });

  describe('Storage Metrics', () => {
    it('should provide storage metrics', async () => {
      // Add some test data
      const metadata: EntityMetadata = {
        filePath: '/test/metrics.css',
        fileType: 'css',
        lastModified: Date.now(),
        size: 1024,
        checksum: 'metrics-checksum',
        analysisVersion: '1.0.0',
        patterns: [],
        dependencies: [],
        tags: [],
      };

      await store.storeEntityMetadata(metadata);

      const session: DiscoverySessionResult = {
        sessionId: 'metrics-session',
        startTime: 1000,
        endTime: 2000,
        entitiesProcessed: ['/test/metrics.css'],
        totalPatterns: 1,
        uniquePatterns: 1,
        duplicatePatterns: 0,
        processingMetrics: [],
        errors: [],
        warnings: [],
      };

      await store.storeDiscoverySession(session);

      const metrics = await store.getStorageMetrics();

      expect(metrics.entities).toBeGreaterThan(0);
      expect(metrics.sessions).toBeGreaterThan(0);
      expect(metrics.totalSize).toBeGreaterThan(0);
    });
  });

  describe('Compaction and Cleanup', () => {
    it('should compact all stores', async () => {
      // Add some data
      for (let i = 0; i < 10; i++) {
        const metadata: EntityMetadata = {
          filePath: `/test/compact-${i}.css`,
          fileType: 'css',
          lastModified: Date.now(),
          size: 512,
          checksum: `checksum-${i}`,
          analysisVersion: '1.0.0',
          patterns: [],
          dependencies: [],
          tags: [],
        };

        await store.storeEntityMetadata(metadata);
      }

      // Compact
      await store.compact();

      // Verify data integrity
      for (let i = 0; i < 10; i++) {
        const retrieved = await store.getEntityMetadata(`/test/compact-${i}.css`);
        expect(retrieved).toBeTruthy();
        expect(retrieved?.checksum).toBe(`checksum-${i}`);
      }
    });
  });

  describe('Error Handling', () => {
    it('should handle concurrent operations', async () => {
      const promises = [];

      for (let i = 0; i < 20; i++) {
        const metadata: EntityMetadata = {
          filePath: `/test/concurrent-${i}.css`,
          fileType: 'css',
          lastModified: Date.now(),
          size: 512,
          checksum: `concurrent-${i}`,
          analysisVersion: '1.0.0',
          patterns: [],
          dependencies: [],
          tags: [],
        };

        promises.push(store.storeEntityMetadata(metadata));
      }

      await Promise.all(promises);

      // Verify all data was stored
      for (let i = 0; i < 20; i++) {
        const retrieved = await store.getEntityMetadata(`/test/concurrent-${i}.css`);
        expect(retrieved).toBeTruthy();
      }
    });

    it('should handle missing sessions gracefully', async () => {
      const diff = await expect(
        store.diffSessions('non-existent-1', 'non-existent-2')
      ).rejects.toThrow('One or both sessions not found');
    });
  });
});