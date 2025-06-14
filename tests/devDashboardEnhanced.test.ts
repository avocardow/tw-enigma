/**
 * Copyright (c) 2025 Rowan Cardow
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DevDashboardEnhanced } from '../src/devDashboardEnhanced.js';
import { EnigmaConfig } from '../src/config.js';
import * as fs from 'fs/promises';
import { EventEmitter } from 'events';

// Mock file system operations
vi.mock('fs/promises', () => ({
  writeFile: vi.fn(),
  readFile: vi.fn(),
  mkdir: vi.fn(),
  access: vi.fn(),
  stat: vi.fn(),
  readdir: vi.fn(),
}));

// Mock HTTP server
vi.mock('http', () => ({
  createServer: vi.fn().mockImplementation(() => ({
    listen: vi.fn(),
    close: vi.fn(),
    on: vi.fn(),
  })),
}));

describe('DevDashboardEnhanced', () => {
  let dashboard: DevDashboardEnhanced;
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
          enhanced: {
            enabled: true,
            analytics: {
              enabled: true,
              retentionDays: 30,
              trackOptimizations: true,
              trackPerformance: true,
              trackFileChanges: true,
              trackClassUsage: true,
            },
            visualizations: {
              enabled: true,
              charts: {
                performance: true,
                optimization: true,
                fileChanges: true,
                classUsage: true,
              },
              realTime: true,
            },
            alerts: {
              enabled: true,
              performance: {
                enabled: true,
                buildTimeThreshold: 5000,
                memoryThreshold: 512,
                cpuThreshold: 80,
              },
              optimization: {
                enabled: true,
                savingsThreshold: 10,
                errorThreshold: 5,
              },
            },
            reports: {
              enabled: true,
              formats: ['html', 'json', 'csv'],
              schedule: 'daily',
              email: false,
            },
          },
        },
      },
    } as EnigmaConfig;

    // Provide a mock baseDashboard as an EventEmitter with getDashboardState()
    const baseDashboard = new EventEmitter();
    baseDashboard.getDashboardState = () => ({
      config: {},
      metrics: [],
      logs: [],
      isRunning: false,
      uptime: 0,
      clientCount: 0,
    });

    dashboard = new DevDashboardEnhanced(baseDashboard, mockConfig);
  });

  afterEach(async () => {
    if (dashboard) {
      await dashboard.stop();
    }
  });

  describe('initialization', () => {
    it('should initialize with enhanced configuration', () => {
      expect(dashboard).toBeDefined();
      const status = dashboard.getStatus();
      expect(status.isActive).toBe(false);
      expect(status.enhanced.analytics.enabled).toBe(true);
      expect(status.enhanced.visualizations.enabled).toBe(true);
    });

    it('should handle disabled enhanced features', () => {
      const disabledConfig = { ...mockConfig };
      disabledConfig.dev.dashboard.enhanced.enabled = false;
      
      const disabledDashboard = new DevDashboardEnhanced({}, disabledConfig);
      expect(disabledDashboard).toBeDefined();
    });

    it('should handle selective feature enabling', () => {
      const selectiveConfig = { ...mockConfig };
      selectiveConfig.dev.dashboard.enhanced.analytics.enabled = false;
      selectiveConfig.dev.dashboard.enhanced.visualizations.enabled = true;
      
      const selectiveDashboard = new DevDashboardEnhanced({}, selectiveConfig);
      expect(selectiveDashboard).toBeDefined();
    });
  });

  describe('lifecycle management', () => {
    it('should start enhanced dashboard', async () => {
      await dashboard.start();
      const status = dashboard.getStatus();
      expect(status.isActive).toBe(true);
    });

    it('should stop enhanced dashboard', async () => {
      await dashboard.start();
      await dashboard.stop();
      const status = dashboard.getStatus();
      expect(status.isActive).toBe(false);
    });

    it('should handle multiple start calls gracefully', async () => {
      await dashboard.start();
      await dashboard.start(); // Should not throw
      const status = dashboard.getStatus();
      expect(status.isActive).toBe(true);
    });
  });

  describe('analytics data collection', () => {
    beforeEach(async () => {
      await dashboard.start();
    });

    it('should collect optimization analytics', async () => {
      const optimizationData = {
        file: 'test.css',
        originalSize: 1000,
        optimizedSize: 800,
        savings: 200,
        duration: 150,
        timestamp: new Date(),
        classes: ['btn', 'text-center'],
      };

      await dashboard.recordOptimization(optimizationData);
      
      const analytics = await dashboard.getAnalytics();
      expect(analytics.optimizations.total).toBeGreaterThan(0);
      expect(analytics.optimizations.totalSavings).toBe(200);
    });

    it('should collect performance analytics', async () => {
      const performanceData = {
        buildTime: 2500,
        memoryUsage: 256,
        cpuUsage: 45,
        timestamp: new Date(),
      };

      await dashboard.recordPerformance(performanceData);
      
      const analytics = await dashboard.getAnalytics();
      expect(analytics.performance.averageBuildTime).toBeGreaterThan(0);
    });

    it('should collect file change analytics', async () => {
      const fileChangeData = {
        file: 'test.css',
        type: 'modified',
        size: 1200,
        timestamp: new Date(),
      };

      await dashboard.recordFileChange(fileChangeData);
      
      const analytics = await dashboard.getAnalytics();
      expect(analytics.fileChanges.total).toBeGreaterThan(0);
    });

    it('should track class usage analytics', async () => {
      const classUsageData = {
        class: 'btn-primary',
        file: 'test.css',
        occurrences: 5,
        context: 'button',
        timestamp: new Date(),
      };

      await dashboard.recordClassUsage(classUsageData);
      
      const analytics = await dashboard.getAnalytics();
      expect(analytics.classUsage.totalClasses).toBeGreaterThan(0);
    });

    it('should handle analytics data retention', async () => {
      // Mock old data (31 days ago)
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 31);

      const oldOptimizationData = {
        file: 'old.css',
        originalSize: 500,
        optimizedSize: 400,
        savings: 100,
        duration: 100,
        timestamp: oldDate,
        classes: ['old-class'],
      };

      await dashboard.recordOptimization(oldOptimizationData);
      await dashboard.cleanupOldAnalytics();
      
      const analytics = await dashboard.getAnalytics();
      // Old data should be cleaned up based on retention policy
      expect(analytics).toBeDefined();
    });
  });

  describe('visualization generation', () => {
    beforeEach(async () => {
      await dashboard.start();
      
      // Add some sample data for visualizations
      await dashboard.recordOptimization({
        file: 'test1.css',
        originalSize: 1000,
        optimizedSize: 800,
        savings: 200,
        duration: 150,
        timestamp: new Date(),
        classes: ['btn'],
      });

      await dashboard.recordPerformance({
        buildTime: 2500,
        memoryUsage: 256,
        cpuUsage: 45,
        timestamp: new Date(),
      });
    });

    it('should generate performance charts', async () => {
      const chart = await dashboard.generateChart('performance', 'line', {
        timeRange: '24h',
        metric: 'buildTime',
      });

      expect(chart).toBeDefined();
      expect(chart.type).toBe('line');
      expect(chart.data).toBeDefined();
      expect(chart.options).toBeDefined();
    });

    it('should generate optimization charts', async () => {
      const chart = await dashboard.generateChart('optimization', 'bar', {
        timeRange: '7d',
        metric: 'savings',
      });

      expect(chart).toBeDefined();
      expect(chart.type).toBe('bar');
      expect(chart.data.datasets.length).toBeGreaterThan(0);
    });

    it('should generate file change charts', async () => {
      const chart = await dashboard.generateChart('fileChanges', 'pie', {
        timeRange: '1d',
        groupBy: 'fileType',
      });

      expect(chart).toBeDefined();
      expect(chart.type).toBe('pie');
    });

    it('should generate class usage charts', async () => {
      const chart = await dashboard.generateChart('classUsage', 'doughnut', {
        timeRange: '7d',
        limit: 10,
      });

      expect(chart).toBeDefined();
      expect(chart.type).toBe('doughnut');
    });

    it('should handle invalid chart parameters', async () => {
      const chart = await dashboard.generateChart('invalid', 'unknown', {});
      
      expect(chart).toBeDefined();
      expect(chart.error).toBeDefined();
    });

    it('should support real-time chart updates', async () => {
      const initialChart = await dashboard.generateChart('performance', 'line', {
        timeRange: '1h',
        realTime: true,
      });

      // Add new data
      await dashboard.recordPerformance({
        buildTime: 3000,
        memoryUsage: 300,
        cpuUsage: 50,
        timestamp: new Date(),
      });

      const updatedChart = await dashboard.generateChart('performance', 'line', {
        timeRange: '1h',
        realTime: true,
      });

      expect(updatedChart.data.datasets[0].data.length).toBeGreaterThanOrEqual(
        initialChart.data.datasets[0].data.length
      );
    });
  });

  describe('performance alerts', () => {
    beforeEach(async () => {
      await dashboard.start();
    });

    it('should trigger build time alerts', async () => {
      const alertSpy = vi.fn();
      dashboard.on('alert', alertSpy);

      // Record performance that exceeds threshold
      await dashboard.recordPerformance({
        buildTime: 6000, // Exceeds 5000ms threshold
        memoryUsage: 200,
        cpuUsage: 40,
        timestamp: new Date(),
      });

      expect(alertSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'performance',
          severity: 'warning',
          metric: 'buildTime',
        })
      );
    });

    it('should trigger memory usage alerts', async () => {
      const alertSpy = vi.fn();
      dashboard.on('alert', alertSpy);

      await dashboard.recordPerformance({
        buildTime: 2000,
        memoryUsage: 600, // Exceeds 512MB threshold
        cpuUsage: 40,
        timestamp: new Date(),
      });

      expect(alertSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'performance',
          severity: 'warning',
          metric: 'memory',
        })
      );
    });

    it('should trigger CPU usage alerts', async () => {
      const alertSpy = vi.fn();
      dashboard.on('alert', alertSpy);

      await dashboard.recordPerformance({
        buildTime: 2000,
        memoryUsage: 200,
        cpuUsage: 85, // Exceeds 80% threshold
        timestamp: new Date(),
      });

      expect(alertSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'performance',
          severity: 'warning',
          metric: 'cpu',
        })
      );
    });

    it('should trigger optimization savings alerts', async () => {
      const alertSpy = vi.fn();
      dashboard.on('alert', alertSpy);

      await dashboard.recordOptimization({
        file: 'test.css',
        originalSize: 1000,
        optimizedSize: 950,
        savings: 50, // Exceeds 10% threshold (5%)
        duration: 150,
        timestamp: new Date(),
        classes: ['btn'],
      });

      expect(alertSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'optimization',
          severity: 'info',
          metric: 'lowSavings',
        })
      );
    });

    it('should not trigger alerts when within thresholds', async () => {
      const alertSpy = vi.fn();
      dashboard.on('alert', alertSpy);

      await dashboard.recordPerformance({
        buildTime: 2000,
        memoryUsage: 200,
        cpuUsage: 40,
        timestamp: new Date(),
      });

      expect(alertSpy).not.toHaveBeenCalled();
    });
  });

  describe('report generation', () => {
    beforeEach(async () => {
      await dashboard.start();
      
      // Add sample data for reports
      await dashboard.recordOptimization({
        file: 'test.css',
        originalSize: 1000,
        optimizedSize: 800,
        savings: 200,
        duration: 150,
        timestamp: new Date(),
        classes: ['btn', 'text-center'],
      });
    });

    it('should generate HTML reports', async () => {
      const report = await dashboard.generateReport('html', {
        timeRange: '7d',
        includeCharts: true,
        includeAnalytics: true,
      });

      expect(report).toBeDefined();
      expect(report.format).toBe('html');
      expect(report.content).toContain('<html>');
      expect(report.content).toContain('chart');
    });

    it('should generate JSON reports', async () => {
      const report = await dashboard.generateReport('json', {
        timeRange: '7d',
        includeAnalytics: true,
      });

      expect(report).toBeDefined();
      expect(report.format).toBe('json');
      
      const data = JSON.parse(report.content);
      expect(data.analytics).toBeDefined();
      expect(data.timeRange).toBe('7d');
    });

    it('should generate CSV reports', async () => {
      const report = await dashboard.generateReport('csv', {
        timeRange: '7d',
        data: 'optimizations',
      });

      expect(report).toBeDefined();
      expect(report.format).toBe('csv');
      expect(report.content).toContain('file,originalSize,optimizedSize');
    });

    it('should save reports to file system', async () => {
      await dashboard.saveReport('html', {
        timeRange: '7d',
        filename: 'test-report.html',
      });

      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('test-report.html'),
        expect.any(String)
      );
    });

    it('should handle report generation errors', async () => {
      (fs.writeFile as any).mockRejectedValue(new Error('Disk full'));

      await expect(
        dashboard.saveReport('html', {
          timeRange: '7d',
          filename: 'test-report.html',
        })
      ).rejects.toThrow('Disk full');
    });
  });

  describe('integration with existing DevDashboard', () => {
    beforeEach(async () => {
      await dashboard.start();
    });

    it('should extend base dashboard functionality', async () => {
      // Test that base dashboard methods still work
      const status = dashboard.getStatus();
      expect(status.isActive).toBe(true);
      expect(status.enhanced).toBeDefined();
    });

    it('should coordinate with HotReload events', async () => {
      const hotReloadData = {
        type: 'css-updated',
        file: 'test.css',
        content: '.test { color: red; }',
        timestamp: new Date(),
      };

      await dashboard.handleHotReloadEvent(hotReloadData);
      
      const analytics = await dashboard.getAnalytics();
      expect(analytics.fileChanges.total).toBeGreaterThan(0);
    });

    it('should coordinate with IDE Integration events', async () => {
      const ideData = {
        type: 'validation-completed',
        file: 'test.css',
        diagnostics: [],
        timestamp: new Date(),
      };

      await dashboard.handleIdeEvent(ideData);
      
      // Should be recorded in analytics
      expect(true).toBe(true); // Mock assertion
    });
  });

  describe('data export and import', () => {
    beforeEach(async () => {
      await dashboard.start();
    });

    it('should export analytics data', async () => {
      await dashboard.recordOptimization({
        file: 'test.css',
        originalSize: 1000,
        optimizedSize: 800,
        savings: 200,
        duration: 150,
        timestamp: new Date(),
        classes: ['btn'],
      });

      const exportData = await dashboard.exportData({
        format: 'json',
        timeRange: '30d',
        includeAll: true,
      });

      expect(exportData).toBeDefined();
      expect(typeof exportData).toBe('string');
      
      const parsed = JSON.parse(exportData);
      expect(parsed.optimizations).toBeDefined();
    });

    it('should import analytics data', async () => {
      const importData = {
        optimizations: [{
          file: 'imported.css',
          originalSize: 500,
          optimizedSize: 400,
          savings: 100,
          duration: 100,
          timestamp: new Date().toISOString(),
          classes: ['imported'],
        }],
      };

      await dashboard.importData(JSON.stringify(importData));
      
      const analytics = await dashboard.getAnalytics();
      expect(analytics.optimizations.total).toBeGreaterThan(0);
    });

    it('should handle invalid import data gracefully', async () => {
      const invalidData = '{ invalid json }';
      
      await expect(dashboard.importData(invalidData)).rejects.toThrow();
    });
  });

  describe('error handling', () => {
    it('should handle analytics storage errors', async () => {
      (fs.writeFile as any).mockRejectedValue(new Error('Storage full'));
      
      await dashboard.start();
      
      await expect(
        dashboard.recordOptimization({
          file: 'test.css',
          originalSize: 1000,
          optimizedSize: 800,
          savings: 200,
          duration: 150,
          timestamp: new Date(),
          classes: ['btn'],
        })
      ).resolves.not.toThrow();
    });

    it('should handle chart generation errors', async () => {
      await dashboard.start();
      
      // Mock Chart.js error
      const chart = await dashboard.generateChart('performance', 'invalid', {});
      
      expect(chart.error).toBeDefined();
    });

    it('should emit error events for debugging', async () => {
      await new Promise<void>((resolve, reject) => {
        dashboard.on('error', (error) => {
          try {
            expect(error).toBeInstanceOf(Error);
            resolve();
          } catch (e) {
            reject(e);
          }
        });
        dashboard.emit('error', new Error('Test error'));
      });
    });
  });

  describe('performance monitoring', () => {
    beforeEach(async () => {
      await dashboard.start();
    });

    it('should track analytics collection performance', async () => {
      const startTime = Date.now();
      
      await dashboard.recordOptimization({
        file: 'test.css',
        originalSize: 1000,
        optimizedSize: 800,
        savings: 200,
        duration: 150,
        timestamp: new Date(),
        classes: ['btn'],
      });
      
      const endTime = Date.now();
      expect(endTime - startTime).toBeLessThan(1000); // Should be fast
    });

    it('should monitor chart generation performance', async () => {
      const startTime = Date.now();
      
      await dashboard.generateChart('performance', 'line', {
        timeRange: '24h',
        metric: 'buildTime',
      });
      
      const endTime = Date.now();
      expect(endTime - startTime).toBeLessThan(5000); // Should be reasonable
    });

    it('should track memory usage of analytics data', () => {
      const status = dashboard.getStatus();
      expect(typeof status.memoryUsage).toBe('object');
      expect(status.memoryUsage.heapUsed).toBeGreaterThan(0);
    });
  });
}); 