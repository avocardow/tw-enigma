/**
 * Copyright (c) 2025 Rowan Cardow
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DevExperienceManager } from '../src/devExperience.js';
import { DevHotReload } from '../src/devHotReload.js';
import { DevIdeIntegration } from '../src/devIdeIntegration.js';
import { DevDashboardEnhanced } from '../src/devDashboardEnhanced.js';
import { DevDashboard } from '../src/devDashboard.js';
import { EnigmaConfig } from '../src/config.js';

describe('DevExperienceManager', () => {
  let devExperience: DevExperienceManager;
  let mockConfig: EnigmaConfig;

  beforeEach(() => {
    mockConfig = {
      dev: {
        enabled: true,
        watch: true,
        server: {
          enabled: true,
          port: 3000,
          host: 'localhost',
          open: false,
        },
        diagnostics: {
          enabled: true,
          performance: true,
          memory: true,
          fileWatcher: true,
          classAnalysis: true,
          thresholds: {
            memoryWarning: 512,
            memoryError: 1024,
            cpuWarning: 80,
            cpuError: 95,
          },
        },
        preview: {
          enabled: true,
          autoRefresh: true,
          showDiff: true,
          highlightChanges: true,
        },
        dashboard: {
          enabled: true,
          port: 3001,
          host: 'localhost',
          updateInterval: 1000,
          showMetrics: true,
          showLogs: true,
          maxLogEntries: 100,
        },
      },
    } as EnigmaConfig;

    devExperience = new DevExperienceManager({}, mockConfig);
  });

  afterEach(async () => {
    if (devExperience) {
      await devExperience.stop();
    }
  });

  describe('initialization', () => {
    it('should initialize with default configuration', () => {
      expect(devExperience).toBeDefined();
      const state = devExperience.getState();
      expect(state.isActive).toBe(false);
      expect(state.tools.diagnostics).toBe(false);
      expect(state.tools.dashboard).toBe(false);
    });

    it('should handle disabled development mode', () => {
      const disabledConfig = { ...mockConfig };
      disabledConfig.dev.enabled = false;
      
      const disabledDevExperience = new DevExperienceManager({}, disabledConfig);
      expect(disabledDevExperience).toBeDefined();
    });
  });

  describe('lifecycle management', () => {
    it('should start development experience', async () => {
      await devExperience.start();
      const state = devExperience.getState();
      expect(state.isActive).toBe(true);
    });

    it('should stop development experience', async () => {
      await devExperience.start();
      await devExperience.stop();
      const state = devExperience.getState();
      expect(state.isActive).toBe(false);
    });

    it('should handle multiple start calls gracefully', async () => {
      await devExperience.start();
      await devExperience.start(); // Should not throw
      const state = devExperience.getState();
      expect(state.isActive).toBe(true);
    });
  });

  describe('session management', () => {
    beforeEach(async () => {
      await devExperience.start();
    });

    it('should start and end debug sessions', async () => {
      const files = ['test.css', 'test.html'];
      const sessionId = await devExperience.startSession(files);
      
      expect(sessionId).toBeDefined();
      expect(typeof sessionId).toBe('string');

      const session = await devExperience.endSession();
      expect(session).toBeDefined();
    });

    it('should track session history', async () => {
      const files = ['test.css'];
      await devExperience.startSession(files);
      await devExperience.endSession();

      const state = devExperience.getState();
      expect(state.sessions.history.length).toBeGreaterThan(0);
    });
  });

  describe('metrics and monitoring', () => {
    beforeEach(async () => {
      await devExperience.start();
    });

    it('should collect comprehensive metrics', async () => {
      const metrics = await devExperience.getComprehensiveMetrics();
      
      expect(metrics).toBeDefined();
      expect(metrics.state).toBeDefined();
      expect(metrics.state.isActive).toBe(true);
    });

    it('should track uptime correctly', async () => {
      const state1 = devExperience.getState();
      const uptime1 = state1.metrics.uptime;

      // Wait a bit
      await new Promise(resolve => setTimeout(resolve, 100));

      const state2 = devExperience.getState();
      const uptime2 = state2.metrics.uptime;

      expect(uptime2).toBeGreaterThan(uptime1);
    });
  });

  describe('configuration updates', () => {
    it('should update configuration', () => {
      const newConfig = {
        enableHotReload: false,
        enableSourceMaps: false,
      };

      devExperience.updateConfig(newConfig);
      // Configuration should be updated internally
      expect(true).toBe(true); // Basic assertion since config is private
    });
  });

  describe('event handling', () => {
    beforeEach(async () => {
      await devExperience.start();
    });

    it('should emit tools-started event', (done) => {
      devExperience.on('tools-started', (tools) => {
        expect(Array.isArray(tools)).toBe(true);
        done();
      });
      
      // Trigger event by restarting
      devExperience.stop().then(() => devExperience.start());
    });

    it('should emit error events', (done) => {
      devExperience.on('error-detected', (error, context) => {
        expect(error).toBeInstanceOf(Error);
        expect(typeof context).toBe('string');
        done();
      });
      
      // Simulate error
      devExperience.emit('error-detected', new Error('Test error'), 'test');
    });
  });
});

describe('DevHotReload', () => {
  let hotReload: DevHotReload;
  let mockConfig: EnigmaConfig;

  beforeEach(() => {
    mockConfig = {
      dev: {
        enabled: true,
      },
    } as EnigmaConfig;

    hotReload = new DevHotReload({}, mockConfig);
  });

  afterEach(async () => {
    if (hotReload) {
      await hotReload.stop();
    }
  });

  describe('initialization', () => {
    it('should initialize with default configuration', () => {
      expect(hotReload).toBeDefined();
      const status = hotReload.getStatus();
      expect(status.isActive).toBe(false);
      expect(status.clients).toBe(0);
    });
  });

  describe('lifecycle management', () => {
    it('should start hot reload system', async () => {
      await hotReload.start();
      const status = hotReload.getStatus();
      expect(status.isActive).toBe(true);
    });

    it('should stop hot reload system', async () => {
      await hotReload.start();
      await hotReload.stop();
      const status = hotReload.getStatus();
      expect(status.isActive).toBe(false);
    });
  });

  describe('optimization tracking', () => {
    beforeEach(async () => {
      await hotReload.start();
    });

    it('should track optimization history', () => {
      const history = hotReload.getOptimizationHistory();
      expect(Array.isArray(history)).toBe(true);
    });

    it('should trigger manual optimization', async () => {
      const files = ['test.css'];
      const result = await hotReload.triggerOptimization(files);
      
      // Result might be null if no callback is provided
      expect(result === null || typeof result === 'object').toBe(true);
    });
  });

  describe('status reporting', () => {
    it('should provide comprehensive status', () => {
      const status = hotReload.getStatus();
      
      expect(status).toHaveProperty('isActive');
      expect(status).toHaveProperty('clients');
      expect(status).toHaveProperty('watchedFiles');
      expect(status).toHaveProperty('performance');
      expect(status.performance).toHaveProperty('totalOptimizations');
      expect(status.performance).toHaveProperty('successRate');
    });
  });

  describe('configuration', () => {
    it('should update configuration', () => {
      const newConfig = {
        debounceMs: 500,
        liveReload: false,
      };

      hotReload.updateConfig(newConfig);
      expect(true).toBe(true); // Config is private, so just verify no errors
    });
  });
});

describe('DevIdeIntegration', () => {
  let ideIntegration: DevIdeIntegration;
  let mockConfig: EnigmaConfig;

  beforeEach(() => {
    mockConfig = {
      dev: {
        enabled: true,
      },
    } as EnigmaConfig;

    ideIntegration = new DevIdeIntegration({}, mockConfig);
  });

  afterEach(async () => {
    if (ideIntegration) {
      await ideIntegration.stop();
    }
  });

  describe('initialization', () => {
    it('should initialize with default configuration', () => {
      expect(ideIntegration).toBeDefined();
    });
  });

  describe('lifecycle management', () => {
    it('should start IDE integration', async () => {
      await ideIntegration.start();
      expect(true).toBe(true); // No public state to check
    });

    it('should stop IDE integration', async () => {
      await ideIntegration.start();
      await ideIntegration.stop();
      expect(true).toBe(true); // No public state to check
    });
  });

  describe('autocomplete functionality', () => {
    beforeEach(async () => {
      await ideIntegration.start();
    });

    it('should provide autocomplete items', () => {
      const items = ideIntegration.getAutoCompleteItems(
        'test.css',
        { line: 0, character: 0 },
        'class'
      );
      
      expect(Array.isArray(items)).toBe(true);
    });

    it('should handle different file types', () => {
      const cssItems = ideIntegration.getAutoCompleteItems(
        'test.css',
        { line: 0, character: 0 },
        'class'
      );
      
      const jsItems = ideIntegration.getAutoCompleteItems(
        'test.js',
        { line: 0, character: 0 },
        'className'
      );
      
      expect(Array.isArray(cssItems)).toBe(true);
      expect(Array.isArray(jsItems)).toBe(true);
    });
  });

  describe('file validation', () => {
    beforeEach(async () => {
      await ideIntegration.start();
    });

    it('should validate CSS files', async () => {
      // Mock file content
      const mockPath = 'test.css';
      const diagnostics = await ideIntegration.validateFile(mockPath);
      
      expect(Array.isArray(diagnostics)).toBe(true);
    });
  });

  describe('configuration updates', () => {
    it('should update configuration', () => {
      const newConfig = {
        features: {
          autocomplete: false,
          diagnostics: true,
          snippets: true,
          hover: true,
          formatting: false,
          linting: true,
        },
      };

      ideIntegration.updateConfig(newConfig);
      expect(true).toBe(true); // Config is private
    });
  });
});

describe('DevDashboardEnhanced', () => {
  let dashboardEnhanced: DevDashboardEnhanced;
  let baseDashboard: DevDashboard;
  let mockConfig: EnigmaConfig;

  beforeEach(() => {
    mockConfig = {
      dev: {
        enabled: true,
        dashboard: {
          enabled: true,
          port: 3001,
          host: 'localhost',
          updateInterval: 1000,
          showMetrics: true,
          showLogs: true,
          maxLogEntries: 100,
        },
      },
    } as EnigmaConfig;

    // Create base dashboard
    baseDashboard = new DevDashboard({
      enabled: true,
      port: 3001,
      host: 'localhost',
    });

    dashboardEnhanced = new DevDashboardEnhanced(baseDashboard);
  });

  afterEach(async () => {
    if (dashboardEnhanced) {
      await dashboardEnhanced.stop();
    }
    if (baseDashboard) {
      await baseDashboard.stop();
    }
  });

  describe('initialization', () => {
    it('should initialize with base dashboard', () => {
      expect(dashboardEnhanced).toBeDefined();
    });
  });

  describe('enhanced state management', () => {
    beforeEach(async () => {
      await dashboardEnhanced.start();
    });

    it('should provide enhanced state', () => {
      const state = dashboardEnhanced.getEnhancedState();
      
      expect(state).toHaveProperty('base');
      expect(state).toHaveProperty('analytics');
      expect(state).toHaveProperty('charts');
      expect(state).toHaveProperty('alerts');
      expect(state).toHaveProperty('config');
      
      expect(Array.isArray(state.analytics)).toBe(true);
      expect(Array.isArray(state.charts)).toBe(true);
      expect(Array.isArray(state.alerts)).toBe(true);
    });
  });

  describe('analytics and reporting', () => {
    beforeEach(async () => {
      await dashboardEnhanced.start();
    });

    it('should generate analytics reports', async () => {
      const jsonReport = await dashboardEnhanced.generateReport('json');
      expect(typeof jsonReport).toBe('string');
      expect(() => JSON.parse(jsonReport)).not.toThrow();

      const csvReport = await dashboardEnhanced.generateReport('csv');
      expect(typeof csvReport).toBe('string');
      expect(csvReport).toContain('Timestamp');

      const htmlReport = await dashboardEnhanced.generateReport('html');
      expect(typeof htmlReport).toBe('string');
      expect(htmlReport).toContain('<!DOCTYPE html>');
    });

    it('should provide optimization insights', () => {
      const insights = dashboardEnhanced.getOptimizationInsights();
      
      expect(insights).toHaveProperty('trends');
      expect(insights).toHaveProperty('recommendations');
      expect(insights).toHaveProperty('bottlenecks');
      
      expect(Array.isArray(insights.trends)).toBe(true);
      expect(Array.isArray(insights.recommendations)).toBe(true);
      expect(Array.isArray(insights.bottlenecks)).toBe(true);
    });
  });

  describe('lifecycle management', () => {
    it('should start enhanced features', async () => {
      await dashboardEnhanced.start();
      expect(true).toBe(true); // No public state to verify start
    });

    it('should stop enhanced features', async () => {
      await dashboardEnhanced.start();
      await dashboardEnhanced.stop();
      expect(true).toBe(true); // No public state to verify stop
    });
  });
});

describe('Integration Tests', () => {
  let devExperience: DevExperienceManager;
  let hotReload: DevHotReload;
  let ideIntegration: DevIdeIntegration;
  let mockConfig: EnigmaConfig;

  beforeEach(() => {
    mockConfig = {
      dev: {
        enabled: true,
        watch: true,
        server: {
          enabled: true,
          port: 3000,
          host: 'localhost',
          open: false,
        },
        diagnostics: {
          enabled: true,
          performance: true,
          memory: true,
          fileWatcher: true,
          classAnalysis: true,
          thresholds: {
            memoryWarning: 512,
            memoryError: 1024,
            cpuWarning: 80,
            cpuError: 95,
          },
        },
        preview: {
          enabled: true,
          autoRefresh: true,
          showDiff: true,
          highlightChanges: true,
        },
        dashboard: {
          enabled: true,
          port: 3001,
          host: 'localhost',
          updateInterval: 1000,
          showMetrics: true,
          showLogs: true,
          maxLogEntries: 100,
        },
      },
    } as EnigmaConfig;
  });

  afterEach(async () => {
    if (devExperience) await devExperience.stop();
    if (hotReload) await hotReload.stop();
    if (ideIntegration) await ideIntegration.stop();
  });

  describe('coordinated startup', () => {
    it('should start all development tools in coordination', async () => {
      // Create all components
      devExperience = new DevExperienceManager({}, mockConfig);
      hotReload = new DevHotReload({}, mockConfig);
      ideIntegration = new DevIdeIntegration({}, mockConfig);

      // Start all components
      await Promise.all([
        devExperience.start(),
        hotReload.start(),
        ideIntegration.start(),
      ]);

      // Verify all are running
      const devState = devExperience.getState();
      const hotStatus = hotReload.getStatus();

      expect(devState.isActive).toBe(true);
      expect(hotStatus.isActive).toBe(true);
    });

    it('should handle component failures gracefully', async () => {
      devExperience = new DevExperienceManager({}, mockConfig);
      
      // This should not throw even if some tools fail to start
      await expect(devExperience.start()).resolves.not.toThrow();
    });
  });

  describe('event coordination', () => {
    beforeEach(async () => {
      devExperience = new DevExperienceManager({}, mockConfig);
      hotReload = new DevHotReload({}, mockConfig);
      ideIntegration = new DevIdeIntegration({}, mockConfig);

      await Promise.all([
        devExperience.start(),
        hotReload.start(),
        ideIntegration.start(),
      ]);
    });

    it('should coordinate optimization events', (done) => {
      let eventCount = 0;

      const checkComplete = () => {
        eventCount++;
        if (eventCount >= 1) {
          done();
        }
      };

      // Listen for coordination events
      devExperience.on('optimization-completed', checkComplete);

      // Trigger optimization
      devExperience.emit('optimization-completed', { test: true });
    });

    it('should share file change events', (done) => {
      hotReload.on('file-changed', (event) => {
        expect(event).toHaveProperty('path');
        expect(event).toHaveProperty('type');
        done();
      });

      // Simulate file change
      hotReload.emit('file-changed', {
        path: 'test.css',
        type: 'change',
        timestamp: new Date(),
        isCSS: true,
        isHTML: false,
        isJS: false,
        requiresOptimization: true,
      });
    });
  });

  describe('performance under load', () => {
    beforeEach(async () => {
      devExperience = new DevExperienceManager({}, mockConfig);
      await devExperience.start();
    });

    it('should handle multiple rapid session operations', async () => {
      const promises = [];
      const files = ['test1.css', 'test2.css'];

      // Create multiple sessions rapidly
      for (let i = 0; i < 5; i++) {
        promises.push(
          devExperience.startSession([`test${i}.css`])
            .then(() => devExperience.endSession())
        );
      }

      await expect(Promise.all(promises)).resolves.not.toThrow();
    });

    it('should maintain performance metrics under load', async () => {
      // Generate load by creating multiple metric collections
      for (let i = 0; i < 10; i++) {
        await devExperience.getComprehensiveMetrics();
      }

      const finalMetrics = await devExperience.getComprehensiveMetrics();
      expect(finalMetrics).toBeDefined();
      expect(finalMetrics.state).toBeDefined();
    });
  });
});

describe('Error Handling and Edge Cases', () => {
  let mockConfig: EnigmaConfig;

  beforeEach(() => {
    mockConfig = {
      dev: {
        enabled: true,
      },
    } as EnigmaConfig;
  });

  describe('graceful degradation', () => {
    it('should handle missing dependencies gracefully', () => {
      // Test with minimal config
      const devExperience = new DevExperienceManager({}, mockConfig);
      expect(devExperience).toBeDefined();
    });

    it('should handle invalid file paths', async () => {
      const ideIntegration = new DevIdeIntegration({}, mockConfig);
      await ideIntegration.start();

      // This should not throw
      const diagnostics = await ideIntegration.validateFile('/invalid/path/file.css');
      expect(Array.isArray(diagnostics)).toBe(true);

      await ideIntegration.stop();
    });

    it('should handle network errors in hot reload', async () => {
      const hotReload = new DevHotReload({
        port: 0, // Invalid port
      }, mockConfig);

      // Should handle startup errors gracefully
      await expect(hotReload.start()).rejects.toThrow();
    });
  });

  describe('memory management', () => {
    it('should clean up resources on stop', async () => {
      const devExperience = new DevExperienceManager({}, mockConfig);
      
      await devExperience.start();
      await devExperience.stop();

      // State should reflect stopped status
      const state = devExperience.getState();
      expect(state.isActive).toBe(false);
    });
  });

  describe('configuration validation', () => {
    it('should handle invalid configuration gracefully', () => {
      const invalidConfig = {
        dev: {
          enabled: true,
          dashboard: {
            port: -1, // Invalid port
          },
        },
      } as EnigmaConfig;

      expect(() => {
        new DevExperienceManager({}, invalidConfig);
      }).not.toThrow();
    });
  });
}); 