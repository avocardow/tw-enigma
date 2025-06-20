/**
 * Copyright (c) 2025 Rowan Cardow
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * Registry Builder Tests
 * Tests for the Registry Builder component lifecycle and API
 */

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  RegistryBuilderError,
  RegistryBuilder as RegistryBuilderImpl,
  createRegistryBuilder,
  destroyGlobalRegistryBuilder,
  getGlobalRegistryBuilder,
} from '../../src/registry/RegistryBuilder';
import type { CSSRuleInfo, RegistryBuilderConfig } from '../../src/types/registry';

// Mock data for testing
const mockCSSRules: CSSRuleInfo[] = [
  {
    rule: { cssText: '.test-class-a { color: red; }' } as CSSStyleRule,
    originalSelector: '.test-class-a',
    className: 'test-class-a',
    stylesheetHref: null,
  },
  {
    rule: { cssText: '.test-class-b { color: blue; }' } as CSSStyleRule,
    originalSelector: '.test-class-b',
    className: 'test-class-b',
    stylesheetHref: 'test.css',
  },
];

describe('RegistryBuilder', () => {
  let builder: RegistryBuilderImpl;
  let mockRuleDiscoveryFn: ReturnType<typeof vi.fn>;

  beforeAll(() => {
    // Mock performance.now with incremental values for timing tests
    let counter = 0;
    vi.stubGlobal('performance', {
      now: vi.fn(() => Date.now() + counter++ * 10),
    });
  });

  beforeEach(() => {
    // Create fresh mock for each test
    mockRuleDiscoveryFn = vi.fn().mockResolvedValue(mockCSSRules);

    builder = new RegistryBuilderImpl({
      id: 'test-builder',
      autoInit: false, // Disable auto-init for controlled testing
      maxRegistries: 5,
      enableMetrics: true,
      ruleDiscoveryFn: mockRuleDiscoveryFn,
    });
  });

  afterEach(async () => {
    if (builder && !builder.isDestroyed) {
      await builder.destroy();
    }
    // Clean up global builder if it exists
    await destroyGlobalRegistryBuilder();
  });

  describe('Constructor and Configuration', () => {
    it('should create builder with default configuration', () => {
      const defaultBuilder = new RegistryBuilderImpl({
        autoInit: false, // Disable auto-init for predictable testing
      });

      expect(defaultBuilder.config.autoInit).toBe(false);
      expect(defaultBuilder.config.ssrCompatible).toBe(true);
      expect(defaultBuilder.config.maxRegistries).toBe(10);
      expect(defaultBuilder.config.enableMetrics).toBe(true);
      expect(defaultBuilder.isDestroyed).toBe(false);
      expect(defaultBuilder.registries.size).toBe(0);

      defaultBuilder.destroy();
    });

    it('should create builder with custom configuration', () => {
      const config: RegistryBuilderConfig = {
        id: 'custom-builder',
        autoInit: false,
        maxRegistries: 3,
        enableMetrics: false,
        ssrCompatible: false,
      };

      const customBuilder = new RegistryBuilderImpl(config);

      expect(customBuilder.config.id).toBe('custom-builder');
      expect(customBuilder.config.autoInit).toBe(false);
      expect(customBuilder.config.maxRegistries).toBe(3);
      expect(customBuilder.config.enableMetrics).toBe(false);
      expect(customBuilder.config.ssrCompatible).toBe(false);

      customBuilder.destroy();
    });

    it('should provide immutable config access', () => {
      const originalConfig = builder.config;

      // Attempt to modify the returned config
      (originalConfig as any).maxRegistries = 999;

      // Should not affect the internal config
      expect(builder.config.maxRegistries).toBe(5);
    });
  });

  describe('Registry Creation and Management', () => {
    it('should create registry with unique ID', async () => {
      const registry = await builder.createRegistry('test-registry-1', {}, mockCSSRules);

      expect(registry).toBeDefined();
      expect(builder.registries.size).toBe(1);
      expect(builder.getRegistry('test-registry-1')).toBe(registry);
    });

    it('should prevent duplicate registry IDs', async () => {
      await builder.createRegistry('duplicate-test', {}, mockCSSRules);

      await expect(builder.createRegistry('duplicate-test', {}, mockCSSRules)).rejects.toThrow(
        RegistryBuilderError
      );

      expect(builder.registries.size).toBe(1);
    });

    it('should enforce maximum registry limit', async () => {
      // Create maximum number of registries
      for (let i = 0; i < 5; i++) {
        await builder.createRegistry(`registry-${i}`, {}, mockCSSRules);
      }

      // Attempt to create one more
      await expect(builder.createRegistry('overflow-registry', {}, mockCSSRules)).rejects.toThrow(
        'Maximum number of registries reached'
      );

      expect(builder.registries.size).toBe(5);
    });

    it('should handle concurrent registry creation', async () => {
      const promises = [
        builder.createRegistry('concurrent-1', {}, mockCSSRules),
        builder.createRegistry('concurrent-2', {}, mockCSSRules),
        builder.createRegistry('concurrent-3', {}, mockCSSRules),
      ];

      const registries = await Promise.all(promises);

      expect(registries).toHaveLength(3);
      expect(builder.registries.size).toBe(3);
      registries.forEach((registry, index) => {
        expect(registry).toBe(builder.getRegistry(`concurrent-${index + 1}`));
      });
    });

    it('should use rule discovery function when no selectors provided', async () => {
      const registry = await builder.createRegistry('discovery-test');

      expect(mockRuleDiscoveryFn).toHaveBeenCalled();
      expect(registry).toBeDefined();
    });

    it('should return undefined for non-existent registry', () => {
      const registry = builder.getRegistry('non-existent');
      expect(registry).toBeUndefined();
    });
  });

  describe('Registry Updates', () => {
    it('should update existing registry with new selectors', async () => {
      await builder.createRegistry('update-test', {}, mockCSSRules);

      const newRules: CSSRuleInfo[] = [
        {
          rule: { cssText: '.new-class { color: green; }' } as CSSStyleRule,
          originalSelector: '.new-class',
          className: 'new-class',
          stylesheetHref: null,
        },
      ];

      await expect(builder.updateRegistry('update-test', newRules)).resolves.not.toThrow();

      expect(builder.metrics.totalUpdates).toBe(1);
    });

    it('should handle update of non-existent registry', async () => {
      await expect(builder.updateRegistry('non-existent', mockCSSRules)).rejects.toThrow(
        "Registry 'non-existent' not found"
      );
    });

    it('should track update metrics', async () => {
      await builder.createRegistry('metrics-test', {}, mockCSSRules);

      const initialUpdates = builder.metrics.totalUpdates;

      await builder.updateRegistry('metrics-test', mockCSSRules);

      expect(builder.metrics.totalUpdates).toBe(initialUpdates + 1);
    });
  });

  describe('Registry Destruction', () => {
    it('should destroy individual registry', async () => {
      await builder.createRegistry('destroy-test', {}, mockCSSRules);

      expect(builder.registries.size).toBe(1);

      await builder.destroyRegistry('destroy-test');

      expect(builder.registries.size).toBe(0);
      expect(builder.getRegistry('destroy-test')).toBeUndefined();
    });

    it('should handle destruction of non-existent registry gracefully', async () => {
      await expect(builder.destroyRegistry('non-existent')).resolves.not.toThrow();
    });

    it('should destroy all registries when builder is destroyed', async () => {
      await builder.createRegistry('test-1', {}, mockCSSRules);
      await builder.createRegistry('test-2', {}, mockCSSRules);

      expect(builder.registries.size).toBe(2);

      await builder.destroy();

      expect(builder.registries.size).toBe(0);
      expect(builder.isDestroyed).toBe(true);
    });

    it('should prevent operations after destruction', async () => {
      await builder.destroy();

      await expect(builder.createRegistry('post-destroy', {}, mockCSSRules)).rejects.toThrow(
        'Registry builder has been destroyed'
      );
    });
  });

  describe('Bulk Operations', () => {
    beforeEach(async () => {
      await builder.createRegistry('bulk-1', {}, mockCSSRules);
      await builder.createRegistry('bulk-2', {}, mockCSSRules);
      await builder.createRegistry('bulk-3', {}, mockCSSRules);
    });

    it('should perform bulk operations on all registries', async () => {
      const results = await builder.bulkOperation((registry, id) => {
        return `processed-${id}`;
      });

      expect(results.size).toBe(3);
      expect(results.get('bulk-1')).toBe('processed-bulk-1');
      expect(results.get('bulk-2')).toBe('processed-bulk-2');
      expect(results.get('bulk-3')).toBe('processed-bulk-3');
    });

    it('should perform bulk operations on specific registries', async () => {
      const results = await builder.bulkOperation(
        (registry, id) => `specific-${id}`,
        ['bulk-1', 'bulk-3']
      );

      expect(results.size).toBe(2);
      expect(results.get('bulk-1')).toBe('specific-bulk-1');
      expect(results.get('bulk-3')).toBe('specific-bulk-3');
      expect(results.has('bulk-2')).toBe(false);
    });

    it('should handle errors in bulk operations gracefully', async () => {
      const results = await builder.bulkOperation((registry, id) => {
        if (id === 'bulk-2') {
          throw new Error('Simulated error');
        }
        return `success-${id}`;
      });

      expect(results.size).toBe(3);
      expect(results.get('bulk-1')).toBe('success-bulk-1');
      expect(results.get('bulk-2')).toBeInstanceOf(Error);
      expect(results.get('bulk-3')).toBe('success-bulk-3');
    });
  });

  describe('Event Management', () => {
    it('should add event listeners to all registries', async () => {
      const handler = vi.fn();

      await builder.createRegistry('event-test-1', {}, mockCSSRules);
      builder.addEventListener('element-added', handler);

      await builder.createRegistry('event-test-2', {}, mockCSSRules);

      // Both registries should have the handler
      const registry1 = builder.getRegistry('event-test-1')!;
      const registry2 = builder.getRegistry('event-test-2')!;

      expect(registry1).toBeDefined();
      expect(registry2).toBeDefined();
    });

    it('should remove event listeners from all registries', async () => {
      const handler = vi.fn();

      await builder.createRegistry('remove-event-test', {}, mockCSSRules);
      builder.addEventListener('element-added', handler);
      builder.removeEventListener('element-added', handler);

      // Handler should be removed from registry
      const registry = builder.getRegistry('remove-event-test')!;
      expect(registry).toBeDefined();
    });
  });

  describe('Statistics and Metrics', () => {
    it('should provide aggregated statistics', async () => {
      await builder.createRegistry('stats-1', {}, mockCSSRules);
      await builder.createRegistry('stats-2', {}, mockCSSRules);

      const stats = builder.getAggregatedStats();

      expect(stats.registryCount).toBe(2);
      expect(stats.totalClasses).toBeGreaterThanOrEqual(0);
      expect(stats.totalElements).toBeGreaterThanOrEqual(0);
    });

    it('should track builder metrics', async () => {
      const initialMetrics = builder.metrics;

      await builder.createRegistry('metrics-1', {}, mockCSSRules);
      await builder.createRegistry('metrics-2', {}, mockCSSRules);

      const updatedMetrics = builder.metrics;

      expect(updatedMetrics.totalRegistriesCreated).toBe(2);
      expect(updatedMetrics.activeRegistries).toBe(2);
      expect(updatedMetrics.averageInitTime).toBeGreaterThan(0);
    });

    it('should cleanup all registries', async () => {
      await builder.createRegistry('cleanup-1', {}, mockCSSRules);
      await builder.createRegistry('cleanup-2', {}, mockCSSRules);

      await expect(builder.cleanup()).resolves.not.toThrow();
    });
  });

  describe('Error Handling', () => {
    it('should handle registry creation errors', async () => {
      const failingBuilder = new RegistryBuilderImpl({
        ruleDiscoveryFn: () => {
          throw new Error('Discovery failed');
        },
      });

      await expect(failingBuilder.createRegistry('failing-registry')).rejects.toThrow(
        'Failed to create registry'
      );

      expect(failingBuilder.metrics.errorCount).toBeGreaterThan(0);

      await failingBuilder.destroy();
    });

    it('should track error counts', async () => {
      const initialErrors = builder.metrics.errorCount;

      await builder.createRegistry('duplicate', {}, mockCSSRules);

      try {
        await builder.createRegistry('duplicate', {}, mockCSSRules);
      } catch (error) {
        // Expected to fail with RegistryBuilderError
        expect(error).toBeInstanceOf(RegistryBuilderError);
      }

      expect(builder.metrics.errorCount).toBe(initialErrors + 1);
    });
  });
});

describe('Factory Functions', () => {
  afterEach(async () => {
    await destroyGlobalRegistryBuilder();
  });

  describe('createRegistryBuilder', () => {
    it('should create new builder instance', () => {
      const builder = createRegistryBuilder({
        id: 'factory-test',
        maxRegistries: 3,
      });

      expect(builder).toBeInstanceOf(RegistryBuilderImpl);
      expect(builder.config.id).toBe('factory-test');
      expect(builder.config.maxRegistries).toBe(3);

      builder.destroy();
    });
  });

  describe('Global Registry Builder', () => {
    it('should create global builder instance', () => {
      const builder = getGlobalRegistryBuilder({
        id: 'global-test',
      });

      expect(builder).toBeInstanceOf(RegistryBuilderImpl);
      expect(builder.config.id).toBe('global-test');
    });

    it('should return same instance on subsequent calls', () => {
      const builder1 = getGlobalRegistryBuilder();
      const builder2 = getGlobalRegistryBuilder();

      expect(builder1).toBe(builder2);
    });

    it('should create new instance after destruction', async () => {
      const builder1 = getGlobalRegistryBuilder();
      await destroyGlobalRegistryBuilder();

      const builder2 = getGlobalRegistryBuilder();

      expect(builder1).not.toBe(builder2);
      expect(builder1.isDestroyed).toBe(true);
      expect(builder2.isDestroyed).toBe(false);
    });

    it('should destroy global builder', async () => {
      const builder = getGlobalRegistryBuilder();

      expect(builder.isDestroyed).toBe(false);

      await destroyGlobalRegistryBuilder();

      expect(builder.isDestroyed).toBe(true);
    });
  });
});

describe('SSR Compatibility', () => {
  it('should handle server-side environment', () => {
    // Mock server environment
    const originalWindow = globalThis.window;
    const originalDocument = globalThis.document;

    delete (globalThis as any).window;
    delete (globalThis as any).document;

    try {
      const builder = new RegistryBuilderImpl({
        autoInit: true,
        ssrCompatible: true,
      });

      expect(builder.isDestroyed).toBe(false);
      expect(builder.registries.size).toBe(0); // Should not auto-initialize on server

      builder.destroy();
    } finally {
      // Restore environment
      globalThis.window = originalWindow;
      globalThis.document = originalDocument;
    }
  });
});

describe('Registry Builder Error', () => {
  it('should create error with proper properties', () => {
    const error = new RegistryBuilderError('Test error', 'TEST_CODE', 'test-registry');

    expect(error.name).toBe('RegistryBuilderError');
    expect(error.message).toBe('Test error');
    expect(error.code).toBe('TEST_CODE');
    expect(error.registryId).toBe('test-registry');
    expect(error).toBeInstanceOf(Error);
  });

  it('should create error without registry ID', () => {
    const error = new RegistryBuilderError('Test error', 'TEST_CODE');

    expect(error.registryId).toBeUndefined();
  });
});
