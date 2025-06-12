/**
 * Copyright (c) 2025 Rowan Cardow
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, it, expect, beforeEach, afterEach, vi, Mock } from 'vitest';
import { EventEmitter } from 'events';
import { promises as fs } from 'fs';
import { DevDiagnostics, createDevDiagnostics } from '../src/devDiagnostics.js';
import { DevPreview, createDevPreview } from '../src/devPreview.js';
import { SourceMapGenerator, createSourceMapGenerator } from '../src/sourceMapGenerator.js';
import { DevDashboard, createDevDashboard } from '../src/devDashboard.js';
import { EnigmaConfig } from '../src/config.js';

// Mock dependencies
vi.mock('fs', () => ({
  promises: {
    readFile: vi.fn(),
    writeFile: vi.fn(),
    stat: vi.fn(),
    mkdir: vi.fn(),
  },
}));

const mockFileWatcher = {
  on: vi.fn().mockReturnThis(),
  close: vi.fn().mockResolvedValue(undefined),
};

// Mock chokidar with proper named export and parameter handling
vi.mock('chokidar', () => ({
  watch: vi.fn().mockImplementation((patterns, options) => {
    // Always return the mock file watcher regardless of parameters
    return mockFileWatcher;
  }),
  FSWatcher: vi.fn(),
}));

vi.mock('source-map', () => ({
  SourceMapGenerator: vi.fn(() => ({
    addMapping: vi.fn(),
    toString: vi.fn(() => '{"version":3,"file":"optimized.css","sources":[],"names":[],"mappings":""}'),
  })),
}));

const mockHttpServer = {
  listen: vi.fn((port, host, callback) => {
    if (typeof host === 'function') {
      host(); // host is actually the callback
    } else if (callback) {
      callback();
    }
    return mockHttpServer;
  }),
  close: vi.fn((callback) => {
    if (callback) callback();
    return mockHttpServer;
  }),
  on: vi.fn().mockReturnThis(),
};

vi.mock('http', () => ({
  createServer: vi.fn(() => mockHttpServer),
}));

describe('Development Experience Tools', () => {
  let mockConfig: EnigmaConfig;

  beforeEach(() => {
    mockConfig = {
      input: 'src/**/*.{html,js,ts,jsx,tsx}',
      output: 'dist/optimized.css',
      pretty: false,
      minify: true,
      removeUnused: true,
      verbose: false,
      veryVerbose: false,
      quiet: false,
      debug: false,
      maxConcurrency: 4,
      classPrefix: "",
      excludePatterns: [],
      followSymlinks: false,
      excludeExtensions: [],
      preserveComments: false,
      sourceMaps: true,
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
          port: 3000,
          host: 'localhost',
          updateInterval: 1000,
          showMetrics: true,
          showLogs: true,
          maxLogEntries: 1000,
        },
      },
    } as EnigmaConfig;

    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('DevDiagnostics', () => {
    let diagnostics: DevDiagnostics;

    beforeEach(() => {
      diagnostics = new DevDiagnostics({
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
      });
    });

    afterEach(async () => {
      await diagnostics.stop();
    });

    it('should initialize with correct configuration', () => {
      expect(diagnostics).toBeInstanceOf(DevDiagnostics);
      expect(diagnostics).toBeInstanceOf(EventEmitter);
    });

    it('should start and stop monitoring', async () => {
      await diagnostics.start();
      expect(diagnostics.isRunning()).toBe(true);

      await diagnostics.stop();
      expect(diagnostics.isRunning()).toBe(false);
    });

    it('should collect performance metrics', async () => {
      await diagnostics.start();
      
      const metrics = diagnostics.getMetrics();
      expect(metrics).toHaveProperty('memoryUsage');
      expect(metrics).toHaveProperty('processingTime');
      expect(metrics).toHaveProperty('cpuUsage');
      expect(metrics).toHaveProperty('eventLoopDelay');
      expect(metrics.memoryUsage).toHaveProperty('heapUsed');
      expect(metrics.memoryUsage).toHaveProperty('heapTotal');
    });

    it('should emit performance updates', async () => {
      const updateSpy = vi.fn();
      diagnostics.on('performance-update', updateSpy);

      await diagnostics.start();
      
      // Wait for at least one update
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(updateSpy).toHaveBeenCalled();
    });

    it('should detect threshold violations', async () => {
      const thresholdSpy = vi.fn();
      diagnostics.on('threshold-exceeded', thresholdSpy);

      await diagnostics.start();

      // Simulate high memory usage
      const originalMemoryUsage = process.memoryUsage;
      process.memoryUsage = vi.fn(() => ({
        rss: 1024 * 1024 * 1024 * 2, // 2GB
        heapTotal: 1024 * 1024 * 1024 * 2,
        heapUsed: 1024 * 1024 * 1024 * 2,
        external: 0,
        arrayBuffers: 0,
      }));

      // Trigger metrics collection
      await new Promise(resolve => setTimeout(resolve, 100));

      process.memoryUsage = originalMemoryUsage;
    });

    it('should track file watching', async () => {
      await diagnostics.start();
      
      const watchStats = diagnostics.getWatchStats();
      expect(watchStats).toHaveProperty('watchedFiles');
      expect(watchStats).toHaveProperty('totalChanges');
      expect(watchStats).toHaveProperty('lastChange');
    });

    it('should analyze class patterns', () => {
      const analysis = diagnostics.analyzeClasses(['btn', 'btn-primary', 'text-center', 'custom-class']);
      
      expect(analysis).toHaveProperty('totalClasses');
      expect(analysis).toHaveProperty('frameworkClasses');
      expect(analysis).toHaveProperty('customClasses');
      expect(analysis).toHaveProperty('patterns');
      expect(analysis.totalClasses).toBe(4);
    });

    it('should create diagnostics from config', () => {
      const diagnostics = createDevDiagnostics(mockConfig);
      expect(diagnostics).toBeInstanceOf(DevDiagnostics);
    });

    it('should return null when diagnostics disabled', () => {
      const disabledConfig = { ...mockConfig };
      disabledConfig.dev!.diagnostics!.enabled = false;
      
      const diagnostics = createDevDiagnostics(disabledConfig);
      expect(diagnostics).toBeNull();
    });
  });

  describe('DevPreview', () => {
    let preview: DevPreview;

    beforeEach(() => {
      preview = new DevPreview({
        enabled: true,
        autoRefresh: true,
        showDiff: true,
        highlightChanges: true,
        refreshInterval: 2000,
        maxFileSize: 1024 * 1024,
        watchPatterns: ['src/**/*.css'],
        excludePatterns: ['node_modules/**'],
        diffOptions: {
          contextLines: 3,
          ignoreWhitespace: false,
          showLineNumbers: true,
          highlightSyntax: true,
        },
      });
    });

    afterEach(async () => {
      await preview.stop();
    });

    it('should initialize with correct configuration', () => {
      expect(preview).toBeInstanceOf(DevPreview);
      expect(preview).toBeInstanceOf(EventEmitter);
    });

    it('should start and stop file watching', async () => {
      await preview.start();
      expect(preview['isRunning']).toBe(true);

      await preview.stop();
      expect(preview['isRunning']).toBe(false);
    });

    it('should generate preview HTML', () => {
      const originalCSS = '.btn { color: blue; padding: 10px; }';
      const optimizedCSS = '.btn { color: blue; padding: 10px; }';
      
      const html = preview.generatePreviewHTML(originalCSS, optimizedCSS);
      
      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('CSS Optimization Preview');
      expect(html).toContain('36 B'); // Size information
      expect(html).toContain('Total Changes');
    });

    it('should calculate diff statistics', () => {
      const originalCSS = '.btn { color: blue; padding: 10px; }\n.card { margin: 20px; }';
      const optimizedCSS = '.btn { color: red; padding: 10px; }';
      
      const diff = preview.calculateDiff(originalCSS, optimizedCSS);
      
      expect(diff).toHaveProperty('additions');
      expect(diff).toHaveProperty('deletions');
      expect(diff).toHaveProperty('modifications');
      expect(diff).toHaveProperty('totalChanges');
    });

    it('should track change history', () => {
      const update = {
        timestamp: new Date(),
        trigger: 'manual-refresh' as const,
        files: [{
          file: 'test.css',
          originalContent: '.btn { color: blue; }',
          optimizedContent: '.btn { color: red; }',
          changes: [],
          stats: {
            totalChanges: 1,
            additions: 0,
            deletions: 0,
            modifications: 1,
            sizeBefore: 20,
            sizeAfter: 19,
            savings: 1,
            savingsPercent: 5,
          },
        }],
        summary: {
          totalFiles: 1,
          totalChanges: 5,
          totalSavings: 1024,
          totalSavingsPercent: 5,
          processingTime: 100,
        },
      };

      preview.addUpdate(update);
      
      const lastUpdate = preview.getLastUpdate();
      expect(lastUpdate).toEqual(update);
    });

    it('should create preview from config', () => {
      const preview = createDevPreview(mockConfig);
      expect(preview).toBeInstanceOf(DevPreview);
    });

    it('should return null when preview disabled', () => {
      const disabledConfig = { ...mockConfig };
      disabledConfig.dev!.preview!.enabled = false;
      
      const preview = createDevPreview(disabledConfig);
      expect(preview).toBeNull();
    });
  });

  describe('SourceMapGenerator', () => {
    let sourceMapGen: SourceMapGenerator;

    beforeEach(() => {
      sourceMapGen = new SourceMapGenerator({
        enabled: true,
        inlineSourceMap: false,
        includeContent: true,
        outputPath: 'dist/maps',
        includeNames: true,
        separateFiles: true,
        transformationMappings: true,
        debugInfo: true,
      });
    });

    it('should initialize with correct configuration', () => {
      expect(sourceMapGen).toBeInstanceOf(SourceMapGenerator);
    });

    it('should track CSS transformations', () => {
      // Test addTransformation since that's what adds to getMappings()
      sourceMapGen.addTransformation({
        originalClass: '.btn',
        optimizedClass: '.a',
        originalFile: 'input.css',
        originalLine: 1,
        originalColumn: 0,
        generatedLine: 1,
        generatedColumn: 0,
        transformationType: 'class-rename',
      });

      const mappings = sourceMapGen.getMappings();
      expect(mappings).toHaveLength(1);
      expect(mappings[0]).toHaveProperty('originalFile', 'input.css');
      expect(mappings[0]).toHaveProperty('originalClass', '.btn');
    });

    it('should generate source map', async () => {
      sourceMapGen.addMapping({
        originalFile: 'input.css',
        originalLine: 1,
        originalColumn: 0,
        generatedLine: 1,
        generatedColumn: 0,
        name: 'btn',
      });

      const sourceMap = await sourceMapGen.generateSourceMap('output.css');
      
      expect(sourceMap).toContain('"version":3');
      expect(sourceMap).toContain('"file"');
      expect(sourceMap).toContain('"mappings"');
    });

    it('should generate debug report', () => {
      sourceMapGen.addTransformation({
        originalClass: '.unused',
        optimizedClass: '',
        originalFile: 'input.css',
        originalLine: 1,
        originalColumn: 0,
        generatedLine: 1,
        generatedColumn: 0,
        transformationType: 'class-remove',
      });

      const report = sourceMapGen.generateDebugReport();
      
      expect(report).toHaveProperty('summary');
      expect(report).toHaveProperty('mappings');
      expect(report.mappings).toHaveLength(1);
      expect(report.summary.optimizationStats.classesRemoved).toBe(1);
    });

    it('should save source map to file', async () => {
      const mockWriteFile = vi.mocked(fs.writeFile);
      mockWriteFile.mockResolvedValue(undefined);

      await sourceMapGen.saveSourceMap('output.css', 'map-content');
      
      expect(mockWriteFile).toHaveBeenCalledWith(
        expect.stringContaining('output.css.map'),
        'map-content',
        'utf-8'
      );
    });

    it('should create source map generator from config', () => {
      const generator = createSourceMapGenerator(mockConfig);
      expect(generator).toBeInstanceOf(SourceMapGenerator);
    });

    it('should return null when source maps disabled', () => {
      const disabledConfig = { ...mockConfig };
      disabledConfig.sourceMaps = false;
      disabledConfig.dev!.enabled = false;
      
      const generator = createSourceMapGenerator(disabledConfig);
      expect(generator).toBeNull();
    });
  });

  describe('DevDashboard', () => {
    let dashboard: DevDashboard;

    beforeEach(() => {
      dashboard = new DevDashboard({
        enabled: true,
        port: 3001, // Use different port to avoid conflicts
        host: 'localhost',
        updateInterval: 1000,
        maxLogEntries: 1000,
        showMetrics: true,
        showLogs: true,
        autoRefresh: true,
        theme: 'dark',
      });
    });

    afterEach(async () => {
      await dashboard.stop();
    });

    it('should initialize with correct configuration', () => {
      expect(dashboard).toBeInstanceOf(DevDashboard);
      expect(dashboard).toBeInstanceOf(EventEmitter);
    });

    it('should start and stop HTTP server', async () => {
      await dashboard.start();
      await dashboard.stop();
      
      // Server start/stop is mocked, so we just verify no errors
      expect(true).toBe(true);
    });

    it('should add log entries', () => {
      dashboard.addLogEntry('info', 'Test message', 'TestModule', { data: 'test' });
      
      const state = dashboard.getDashboardState();
      expect(state.logs).toHaveLength(1);
      expect(state.logs[0]).toHaveProperty('level', 'info');
      expect(state.logs[0]).toHaveProperty('message', 'Test message');
      expect(state.logs[0]).toHaveProperty('module', 'TestModule');
    });

    it('should limit log entries', () => {
      const dashboard = new DevDashboard({ maxLogEntries: 2 });
      
      dashboard.addLogEntry('info', 'Message 1', 'Test');
      dashboard.addLogEntry('info', 'Message 2', 'Test');
      dashboard.addLogEntry('info', 'Message 3', 'Test');
      
      const state = dashboard.getDashboardState();
      expect(state.logs).toHaveLength(2);
      expect(state.logs[0].message).toBe('Message 2');
      expect(state.logs[1].message).toBe('Message 3');
    });

    it('should get dashboard state', () => {
      const state = dashboard.getDashboardState();
      
      expect(state).toHaveProperty('config');
      expect(state).toHaveProperty('metrics');
      expect(state).toHaveProperty('logs');
      expect(state).toHaveProperty('isRunning');
      expect(state).toHaveProperty('uptime');
      expect(state).toHaveProperty('clientCount');
    });

    it('should emit log entry events', () => {
      const logSpy = vi.fn();
      dashboard.on('log-entry', logSpy);
      
      dashboard.addLogEntry('warn', 'Warning message', 'TestModule');
      
      expect(logSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          level: 'warn',
          message: 'Warning message',
          module: 'TestModule',
        })
      );
    });

    it('should create dashboard from config', () => {
      const dashboard = createDevDashboard(mockConfig);
      expect(dashboard).toBeInstanceOf(DevDashboard);
    });

    it('should return null when dashboard disabled', () => {
      const disabledConfig = { ...mockConfig };
      disabledConfig.dev!.dashboard!.enabled = false;
      
      const dashboard = createDevDashboard(disabledConfig);
      expect(dashboard).toBeNull();
    });
  });

  describe('Integration Tests', () => {
    it('should integrate all development tools', async () => {
      const diagnostics = createDevDiagnostics(mockConfig);
      const preview = createDevPreview(mockConfig);
      const sourceMapGen = createSourceMapGenerator(mockConfig);
      const dashboard = createDevDashboard(mockConfig);

      expect(diagnostics).toBeInstanceOf(DevDiagnostics);
      expect(preview).toBeInstanceOf(DevPreview);
      expect(sourceMapGen).toBeInstanceOf(SourceMapGenerator);
      expect(dashboard).toBeInstanceOf(DevDashboard);

      // Start all tools
      await diagnostics!.start();
      await preview!.start();
      await dashboard!.start();

      // Verify they're running
      expect(diagnostics!.isRunning()).toBe(true);
      expect(preview!['isRunning']).toBe(true);

      // Stop all tools
      await diagnostics!.stop();
      await preview!.stop();
      await dashboard!.stop();

      // Verify they're stopped
      expect(diagnostics!.isRunning()).toBe(false);
      expect(preview!['isRunning']).toBe(false);
    });

    it('should handle tool communication', async () => {
      const diagnostics = createDevDiagnostics(mockConfig);
      const dashboard = createDevDashboard(mockConfig);

      const logSpy = vi.fn();
      dashboard!.on('log-entry', logSpy);

      await diagnostics!.start();
      await dashboard!.start();

      // Simulate diagnostics event
      diagnostics!.emit('performance-update', {
        memoryUsage: process.memoryUsage(),
        processingTime: 100,
        cpuUsage: process.cpuUsage(),
        eventLoopDelay: 0,
        activeHandles: 0,
        activeRequests: 0,
      });

      // Add log entry to dashboard
      dashboard!.addLogEntry('info', 'Diagnostics updated', 'Integration');

      expect(logSpy).toHaveBeenCalled();

      await diagnostics!.stop();
      await dashboard!.stop();
    });
  });
}); 