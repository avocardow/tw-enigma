/**
 * Copyright (c) 2025 Rowan Cardow
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * Stress Testing Utilities
 * Tools for testing memory management and detecting leaks under load
 */

import type { DOMElementRegistry } from '../types/registry';
import type { MemoryManager } from './MemoryManager';

export type ScenarioName = 'element-churn' | 'memory-pressure' | 'high-frequency-ops';

export interface ScenarioOptions {
  duration?: number;
  elementCount?: number;
  maxMemory?: number;
  opsPerSecond?: number;
}

export interface StressTestReport {
  scenario: ScenarioName;
  status: 'completed' | 'stopped' | 'error';
  parameters: ScenarioOptions;
  duration: number;
  metrics: {
    totalOperations: number;
    averageOpsPerSecond: number;
  };
  memory: {
    startMemory: number;
    endMemory: number;
    peakMemory: number;
  };
  errors: string[];
}

/**
 * Stress Tester for DOM Element Registry
 */
export class StressTester {
  private memoryManager: MemoryManager;
  private registries: DOMElementRegistry[];
  private isRunning = false;
  private stopSignal = false;

  constructor(memoryManager: MemoryManager, registries: DOMElementRegistry[]) {
    this.memoryManager = memoryManager;
    this.registries = registries;
  }

  async runScenario(scenario: ScenarioName, options: ScenarioOptions): Promise<StressTestReport> {
    this.isRunning = true;
    this.stopSignal = false;
    const startTime = Date.now();
    const startMemory = this.memoryManager.stats.totalMemoryUsage;
    let peakMemory = startMemory;
    let totalOperations = 0;
    const errors: string[] = [];

    const report: StressTestReport = {
      scenario,
      status: 'completed',
      parameters: options,
      duration: 0,
      metrics: { totalOperations: 0, averageOpsPerSecond: 0 },
      memory: { startMemory, endMemory: 0, peakMemory: 0 },
      errors: [],
    };

    const runDuration = options.duration || 1000;

    const intervalId = setInterval(() => {
      const currentMemory = this.memoryManager.stats.totalMemoryUsage;
      if (currentMemory > peakMemory) {
        peakMemory = currentMemory;
      }
    }, 50);

    const scenarioEndTime = startTime + runDuration;

    while (Date.now() < scenarioEndTime && !this.stopSignal) {
      try {
        switch (scenario) {
          case 'element-churn':
            await this.elementChurnStep(options.elementCount || 100);
            break;
          case 'memory-pressure':
            await this.memoryPressureStep(options.maxMemory || 80);
            break;
          case 'high-frequency-ops':
            await this.highFrequencyOpsStep();
            break;
        }
        totalOperations++;
      } catch (e: any) {
        errors.push(e.message);
      }
    }

    clearInterval(intervalId);

    report.duration = Date.now() - startTime;
    report.status = this.stopSignal ? 'stopped' : 'completed';
    report.metrics.totalOperations = totalOperations;
    if (report.duration > 0) {
      report.metrics.averageOpsPerSecond = (totalOperations / report.duration) * 1000;
    }
    report.memory.endMemory = this.memoryManager.stats.totalMemoryUsage;
    report.memory.peakMemory = peakMemory;
    report.errors = errors;

    this.isRunning = false;
    return report;
  }

  private async elementChurnStep(elementCount: number) {
    const registry = this.registries[0];
    const elements = Array.from({ length: elementCount }, () => document.createElement('div'));
    elements.forEach((el) => registry.addElement('test', el));
    this.memoryManager.updateMemoryStats(); // Force stats update
    elements.forEach((el) => el.remove());
    registry.cleanup();
  }

  private async memoryPressureStep(maxMemoryMB: number) {
    const registry = this.registries[0];
    const maxMemoryBytes = maxMemoryMB * 1024 * 1024;
    let iterations = 0;
    const maxIterations = 5000; // Failsafe

    // Add elements until memory pressure is high
    while (
      this.memoryManager.stats.totalMemoryUsage < maxMemoryBytes &&
      !this.stopSignal &&
      iterations < maxIterations
    ) {
      const el = document.createElement('div');
      registry.addElement('pressure-test', el);
      this.memoryManager.updateMemoryStats(); // Update stats within the loop
      await new Promise((r) => setTimeout(r, 1));
      iterations++;
    }
    // Clean up some to release pressure
    registry.cleanup();
  }

  private async highFrequencyOpsStep() {
    const registry = this.registries[0];
    const el = document.createElement('div');
    registry.addElement('freq-test', el);
    this.memoryManager.updateMemoryStats();
    registry.cleanup();
  }

  public stop() {
    this.stopSignal = true;
  }

  public destroy() {
    this.stop();
  }
}
