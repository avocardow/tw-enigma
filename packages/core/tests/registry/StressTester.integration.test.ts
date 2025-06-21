/**
 * @vitest-environment jsdom
 */

/**
 * Copyright (c) 2025 Rowan Cardow
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * Stress Tester Integration Tests
 * Validates the StressTester's ability to simulate various load scenarios
 * and produce meaningful reports. This acts as an integration test for the
 * entire memory management system.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRegistry, DOMElementRegistry } from '../../src/registry';
import { createMemoryManager, MemoryManager } from '../../src/registry/MemoryManager';
import { StressTester } from '../../src/registry/StressTester';

describe('StressTester Integration', () => {
  let memoryManager: MemoryManager;
  let registry: DOMElementRegistry;
  let stressTester: StressTester;

  beforeEach(() => {
    // Ensure a clean state for each test
    memoryManager = createMemoryManager({
      memoryCheckInterval: 50,
      enableMemoryPressureMonitoring: true,
    });
    registry = createRegistry({ name: 'stress-test-registry' });
    memoryManager.registerRegistry(registry);
    stressTester = new StressTester(memoryManager, [registry]);
  });

  afterEach(() => {
    stressTester.destroy();
    memoryManager.destroy();
    registry.destroy();
    vi.unstubAllGlobals();
  });

  it('should run element-churn scenario and generate a report', async () => {
    const report = await stressTester.runScenario('element-churn', {
      duration: 200, // ms
      elementCount: 100,
    });

    expect(report.scenario).toBe('element-churn');
    expect(report.parameters.duration).toBe(200);
    expect(report.parameters.elementCount).toBe(100);
    expect(report.metrics.totalOperations).toBeGreaterThan(0);
    expect(report.metrics.averageOpsPerSecond).toBeGreaterThan(0);
    expect(report.memory.endMemory).toBeGreaterThanOrEqual(0);
  });

  it('should run memory-pressure scenario and adapt', async () => {
    // Mock performance.memory to simulate pressure
    vi.stubGlobal('performance', {
      now: vi.fn().mockReturnValue(0), // Keep time constant for this test
      memory: {
        usedJSHeapSize: 50 * 1024 * 1024, // Start with moderate pressure
        totalJSHeapSize: 100 * 1024 * 1024,
      },
    });

    const report = await stressTester.runScenario('memory-pressure', {
      duration: 200,
      maxMemory: 80, // 80MB
    });

    expect(report.scenario).toBe('memory-pressure');
    expect(report.metrics.totalOperations).toBeGreaterThan(0);
    expect(report.memory.peakMemory).toBeGreaterThanOrEqual(0);
    // With adaptation, it should not exceed the maxMemory by too much
    expect(report.memory.endMemory).toBeLessThan(90 * 1024 * 1024);
  });

  it('should handle high-frequency scenario without errors', async () => {
    const report = await stressTester.runScenario('high-frequency-ops', {
      duration: 100,
      opsPerSecond: 1000,
    });

    expect(report.scenario).toBe('high-frequency-ops');
    expect(report.metrics.totalOperations).toBeGreaterThan(50); // Should be around 100
    expect(report.metrics.averageOpsPerSecond).toBeGreaterThan(500);
    expect(report.errors.length).toBe(0);
  });

  it('should run multiple scenarios sequentially', async () => {
    const churnReport = await stressTester.runScenario('element-churn', {
      duration: 100,
      elementCount: 50,
    });
    expect(churnReport.scenario).toBe('element-churn');

    const pressureReport = await stressTester.runScenario('memory-pressure', {
      duration: 100,
      maxMemory: 80,
    });
    expect(pressureReport.scenario).toBe('memory-pressure');

    const finalStats = memoryManager.stats;
    expect(finalStats.totalMemoryUsage).toBeGreaterThanOrEqual(0);
  });

  it('should stop a running scenario', async () => {
    const promise = stressTester.runScenario('element-churn', {
      duration: 5000,
      elementCount: 1000,
    });

    // Allow some operations to run
    await new Promise((r) => setTimeout(r, 50));

    stressTester.stop();

    const report = await promise;

    expect(report.metrics.totalOperations).toBeGreaterThan(0);
    expect(report.metrics.totalOperations).toBeLessThan(5000); // Should not have completed all, but allow for more operations in test env
    expect(report.status).toBe('stopped');
  });
});
