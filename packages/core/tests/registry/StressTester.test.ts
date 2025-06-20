/**
 * Copyright (c) 2025 Rowan Cardow
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * Stress Tester Tests
 * Tests for stress testing utilities and memory leak detection
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_STRESS_CONFIG,
  StressTester,
  createStressTester,
  runMemoryLeakTest,
} from '../../src/registry/StressTester';
import { createRegistry } from '../../src/registry/index';
import type { DOMElementRegistry } from '../../src/types/registry';

describe('StressTester', () => {
  let stressTester: StressTester;
  let registry: DOMElementRegistry;

  beforeEach(() => {
    // Mock performance.now for consistent testing
    vi.stubGlobal('performance', {
      now: vi.fn(() => Date.now()),
      memory: {
        usedJSHeapSize: 1024 * 1024, // 1MB
        totalJSHeapSize: 2048 * 1024, // 2MB
      },
    });

    stressTester = createStressTester({
      debug: false,
      duration: 100, // Short duration for testing
      iterations: 10,
      elementCount: 50,
      classCount: 10,
      operationDelay: 0,
    });

    registry = createRegistry({ debug: false });
  });

  afterEach(() => {
    if (stressTester) {
      stressTester.destroy();
    }
    if (registry) {
      registry.destroy();
    }
    vi.unstubAllGlobals();
  });

  describe('Stress Tester Creation', () => {
    it('should create stress tester with default configuration', () => {
      const defaultTester = new StressTester();
      expect(defaultTester).toBeDefined();
      defaultTester.destroy();
    });

    it('should use default stress configuration values', () => {
      expect(DEFAULT_STRESS_CONFIG.elementCount).toBe(1000);
      expect(DEFAULT_STRESS_CONFIG.classCount).toBe(50);
      expect(DEFAULT_STRESS_CONFIG.iterations).toBe(100);
      expect(DEFAULT_STRESS_CONFIG.duration).toBe(30000);
      expect(DEFAULT_STRESS_CONFIG.memoryThreshold).toBe(50);
      expect(DEFAULT_STRESS_CONFIG.scenarios).toContain('element-churn');
    });
  });

  describe('Individual Scenario Testing', () => {
    it('should run element-churn scenario', async () => {
      const result = await stressTester.runScenario('element-churn');
      expect(result.scenario).toBe('element-churn');
      expect(result.passed).toBe(true);
      expect(result.operationsCount).toBeGreaterThan(0);
    });

    it('should run class-churn scenario', async () => {
      const result = await stressTester.runScenario('class-churn');
      expect(result.scenario).toBe('class-churn');
      expect(result.passed).toBe(true);
    });
  });

  describe('Memory Leak Test Utility', () => {
    it('should run quick memory leak test', async () => {
      const testRegistry = createRegistry({ debug: false });
      const result = await runMemoryLeakTest(testRegistry, 50);

      expect(result).toHaveProperty('leaked');
      expect(result).toHaveProperty('memoryDelta');
      expect(result).toHaveProperty('duration');
      expect(typeof result.leaked).toBe('boolean');

      testRegistry.destroy();
    });
  });
});
