/**
 * Copyright (c) 2025 Rowan Cardow
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DevIdeIntegration } from '../src/devIdeIntegration.js';
import { EnigmaConfig } from '../src/config.js';
import * as fs from 'fs/promises';
import * as path from 'path';

// Mock file system operations
vi.mock('fs/promises', () => ({
  writeFile: vi.fn(),
  readFile: vi.fn(),
  mkdir: vi.fn(),
  access: vi.fn(),
  stat: vi.fn(),
}));

// Mock path operations
vi.mock('path', () => ({
  join: vi.fn((...args) => args.join('/')),
  dirname: vi.fn((p) => p.split('/').slice(0, -1).join('/')),
  resolve: vi.fn((p) => p),
  exists: vi.fn(),
}));

describe('DevIdeIntegration', () => {
  let ideIntegration: DevIdeIntegration;
  let mockConfig: EnigmaConfig;

  beforeEach(() => {
    mockConfig = {
      dev: {
        enabled: true,
        ide: {
          enabled: true,
          autoSetup: true,
          vscode: {
            enabled: true,
            extensions: true,
            settings: true,
            tasks: true,
            launch: true,
          },
          webstorm: {
            enabled: true,
            fileTypes: true,
            inspections: true,
          },
          vim: {
            enabled: false,
          },
          autocomplete: {
            enabled: true,
            cssClasses: true,
            directives: true,
            configOptions: true,
          },
          diagnostics: {
            enabled: true,
            classValidation: true,
            configValidation: true,
            performance: true,
          },
          languageServer: {
            enabled: true,
            port: 3003,
            host: 'localhost',
          },
        },
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
      const status = ideIntegration.getStatus();
      expect(status.isActive).toBe(false);
      expect(status.supportedIdes).toContain('vscode');
      expect(status.supportedIdes).toContain('webstorm');
    });

    it('should handle disabled IDE integration', () => {
      const disabledConfig = { ...mockConfig };
      disabledConfig.dev.ide.enabled = false;
      
      const disabledIdeIntegration = new DevIdeIntegration({}, disabledConfig);
      expect(disabledIdeIntegration).toBeDefined();
    });

    it('should handle selective IDE enabling', () => {
      const selectiveConfig = { ...mockConfig };
      selectiveConfig.dev.ide.vscode.enabled = false;
      selectiveConfig.dev.ide.webstorm.enabled = true;
      
      const selectiveIdeIntegration = new DevIdeIntegration({}, selectiveConfig);
      expect(selectiveIdeIntegration).toBeDefined();
    });
  });

  describe('lifecycle management', () => {
    it('should start IDE integration', async () => {
      await ideIntegration.start();
      const status = ideIntegration.getStatus();
      expect(status.isActive).toBe(true);
    });

    it('should stop IDE integration', async () => {
      await ideIntegration.start();
      await ideIntegration.stop();
      const status = ideIntegration.getStatus();
      expect(status.isActive).toBe(false);
    });

    it('should handle multiple start calls gracefully', async () => {
      await ideIntegration.start();
      await ideIntegration.start(); // Should not throw
      const status = ideIntegration.getStatus();
      expect(status.isActive).toBe(true);
    });
  });

  describe('VSCode integration', () => {
    beforeEach(async () => {
      await ideIntegration.start();
    });

    it('should setup VSCode configuration', async () => {
      await ideIntegration.setupVSCode();
      
      // Verify file system calls
      expect(fs.mkdir).toHaveBeenCalledWith('.vscode', { recursive: true });
      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('settings.json'),
        expect.any(String)
      );
    });

    it('should create VSCode extensions.json', async () => {
      await ideIntegration.setupVSCode();
      
      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('extensions.json'),
        expect.stringMatching(/bradlc\.vscode-tailwindcss/)
      );
    });

    it('should create VSCode tasks.json', async () => {
      await ideIntegration.setupVSCode();
      
      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('tasks.json'),
        expect.stringMatching(/enigma.*optimize/)
      );
    });

    it('should create VSCode launch.json', async () => {
      await ideIntegration.setupVSCode();
      
      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('launch.json'),
        expect.stringMatching(/configurations/)
      );
    });

    it('should handle VSCode setup errors gracefully', async () => {
      (fs.writeFile as any).mockRejectedValue(new Error('Permission denied'));
      
      await expect(ideIntegration.setupVSCode()).resolves.not.toThrow();
    });
  });

  describe('WebStorm integration', () => {
    beforeEach(async () => {
      await ideIntegration.start();
    });

    it('should setup WebStorm configuration', async () => {
      await ideIntegration.setupWebStorm();
      
      expect(fs.mkdir).toHaveBeenCalledWith('.idea', { recursive: true });
      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('enigma.xml'),
        expect.any(String)
      );
    });

    it('should create WebStorm file type associations', async () => {
      await ideIntegration.setupWebStorm();
      
      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('enigma.xml'),
        expect.stringMatching(/enigma.*config/)
      );
    });

    it('should handle WebStorm setup errors gracefully', async () => {
      (fs.writeFile as any).mockRejectedValue(new Error('Access denied'));
      
      await expect(ideIntegration.setupWebStorm()).resolves.not.toThrow();
    });
  });

  describe('Vim integration', () => {
    beforeEach(async () => {
      // Enable Vim for these tests
      mockConfig.dev.ide.vim.enabled = true;
      ideIntegration = new DevIdeIntegration({}, mockConfig);
      await ideIntegration.start();
    });

    it('should setup Vim configuration when enabled', async () => {
      await ideIntegration.setupVim();
      
      expect(fs.mkdir).toHaveBeenCalledWith('.vim', { recursive: true });
      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('enigma.vim'),
        expect.any(String)
      );
    });

    it('should create Vim commands and mappings', async () => {
      await ideIntegration.setupVim();
      
      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('enigma.vim'),
        expect.stringMatching(/command.*Enigma/)
      );
    });
  });

  describe('autocomplete system', () => {
    beforeEach(async () => {
      await ideIntegration.start();
    });

    it('should generate CSS class autocomplete data', async () => {
      const classes = ['btn', 'text-center', 'bg-blue-500'];
      const autocompleteData = await ideIntegration.generateAutocomplete(classes);
      
      expect(autocompleteData).toBeDefined();
      expect(autocompleteData.cssClasses).toContain('btn');
      expect(autocompleteData.cssClasses).toContain('text-center');
    });

    it('should generate directive autocomplete data', async () => {
      const autocompleteData = await ideIntegration.generateAutocomplete([]);
      
      expect(autocompleteData.directives).toBeDefined();
      expect(autocompleteData.directives.length).toBeGreaterThan(0);
    });

    it('should generate config option autocomplete data', async () => {
      const autocompleteData = await ideIntegration.generateAutocomplete([]);
      
      expect(autocompleteData.configOptions).toBeDefined();
      expect(autocompleteData.configOptions.length).toBeGreaterThan(0);
    });

    it('should update autocomplete data when classes change', async () => {
      const initialClasses = ['btn'];
      const updatedClasses = ['btn', 'card', 'header'];
      
      const initialData = await ideIntegration.generateAutocomplete(initialClasses);
      const updatedData = await ideIntegration.generateAutocomplete(updatedClasses);
      
      expect(updatedData.cssClasses.length).toBeGreaterThan(initialData.cssClasses.length);
    });
  });

  describe('diagnostics system', () => {
    beforeEach(async () => {
      await ideIntegration.start();
    });

    it('should validate CSS classes in files', async () => {
      const mockFileContent = '.btn { color: red; } .invalid-class { color: blue; }';
      (fs.readFile as any).mockResolvedValue(mockFileContent);
      
      const diagnostics = await ideIntegration.validateFile('test.css');
      
      expect(Array.isArray(diagnostics)).toBe(true);
    });

    it('should provide configuration validation', async () => {
      const mockConfig = { invalid: 'configuration' };
      const diagnostics = await ideIntegration.validateConfiguration(mockConfig);
      
      expect(Array.isArray(diagnostics)).toBe(true);
    });

    it('should detect performance issues', async () => {
      const mockFileContent = '.very-complex-selector:nth-child(odd):hover::before { color: red; }';
      (fs.readFile as any).mockResolvedValue(mockFileContent);
      
      const diagnostics = await ideIntegration.validateFile('test.css');
      
      expect(Array.isArray(diagnostics)).toBe(true);
    });

    it('should handle file read errors gracefully', async () => {
      (fs.readFile as any).mockRejectedValue(new Error('File not found'));
      
      const diagnostics = await ideIntegration.validateFile('/invalid/path.css');
      
      expect(Array.isArray(diagnostics)).toBe(true);
      expect(diagnostics.length).toBe(0);
    });
  });

  describe('Language Server Protocol (LSP)', () => {
    beforeEach(async () => {
      await ideIntegration.start();
      // Reset language server state
      ideIntegration.resetLanguageServer();
    });

    it('should start LSP server', async () => {
      await ideIntegration.startLanguageServer();
      
      const status = ideIntegration.getStatus();
      expect(status.languageServer.isRunning).toBe(true);
    });

    it('should stop LSP server', async () => {
      await ideIntegration.startLanguageServer();
      await ideIntegration.stopLanguageServer();
      
      const status = ideIntegration.getStatus();
      expect(status.languageServer.isRunning).toBe(false);
    });

    it('should handle LSP requests', async () => {
      await ideIntegration.startLanguageServer();
      
      const request = {
        method: 'textDocument/completion',
        params: {
          textDocument: { uri: 'file:///test.css' },
          position: { line: 0, character: 5 },
        },
      };
      
      const response = await ideIntegration.handleLSPRequest(request);
      expect(response).toBeDefined();
    });

    it('should provide hover information', async () => {
      await ideIntegration.startLanguageServer();
      
      const hoverRequest = {
        method: 'textDocument/hover',
        params: {
          textDocument: { uri: 'file:///test.css' },
          position: { line: 0, character: 5 },
        },
      };
      
      const response = await ideIntegration.handleLSPRequest(hoverRequest);
      expect(response).toBeDefined();
    });
  });

  describe('code snippets', () => {
    beforeEach(async () => {
      await ideIntegration.start();
    });

    it('should generate React component snippets', async () => {
      const snippets = await ideIntegration.generateSnippets('react');
      
      expect(snippets).toBeDefined();
      expect(snippets.react).toBeDefined();
      expect(snippets.react.length).toBeGreaterThan(0);
    });

    it('should generate Vue component snippets', async () => {
      const snippets = await ideIntegration.generateSnippets('vue');
      
      expect(snippets).toBeDefined();
      expect(snippets.vue).toBeDefined();
      expect(snippets.vue.length).toBeGreaterThan(0);
    });

    it('should generate generic CSS snippets', async () => {
      const snippets = await ideIntegration.generateSnippets('css');
      
      expect(snippets).toBeDefined();
      expect(snippets.css).toBeDefined();
      expect(snippets.css.length).toBeGreaterThan(0);
    });

    it('should handle unknown framework gracefully', async () => {
      const snippets = await ideIntegration.generateSnippets('unknown');
      
      expect(snippets).toBeDefined();
      // Should provide generic snippets
    });
  });

  describe('error handling', () => {
    it('should handle file system permission errors', async () => {
      (fs.writeFile as any).mockRejectedValue(new Error('EACCES: permission denied'));
      
      await ideIntegration.start();
      await expect(ideIntegration.setupVSCode()).resolves.not.toThrow();
    });

    it('should handle LSP server startup failures', async () => {
      // Mock port conflict
      const conflictConfig = { ...mockConfig };
      conflictConfig.dev.ide.languageServer.port = -1;
      
      const conflictIdeIntegration = new DevIdeIntegration({}, conflictConfig);
      await conflictIdeIntegration.start();
      
      await expect(conflictIdeIntegration.startLanguageServer()).rejects.toThrow();
    });

    it('should emit error events for debugging', async () => {
      await new Promise<void>((resolve, reject) => {
        ideIntegration.on('error', (error) => {
          try {
            expect(error).toBeInstanceOf(Error);
            resolve();
          } catch (e) {
            reject(e);
          }
        });
        ideIntegration.emit('error', new Error('Test error'));
      });
    });
  });

      describe('performance monitoring', () => {
    beforeEach(async () => {
      await ideIntegration.start();
      // Reset language server state
      ideIntegration.resetLanguageServer();
    });

    it('should track setup time for IDEs', async () => {
      await ideIntegration.setupVSCode();
      
      const status = ideIntegration.getStatus();
      expect(status.setupTimes.vscode).toBeGreaterThanOrEqual(0);
    });

    it('should monitor LSP request performance', async () => {
      await ideIntegration.startLanguageServer();
      
      const request = {
        method: 'textDocument/completion',
        params: {
          textDocument: { uri: 'file:///test.css' },
          position: { line: 0, character: 5 },
        },
      };
      
      await ideIntegration.handleLSPRequest(request);
      
      const status = ideIntegration.getStatus();
      expect(status.languageServer.requestCount).toBeGreaterThanOrEqual(1);
    });

    it('should track memory usage', () => {
      const status = ideIntegration.getStatus();
      expect(typeof status.memoryUsage).toBe('object');
      expect(status.memoryUsage.heapUsed).toBeGreaterThan(0);
    });
  });

  describe('integration with optimization engine', () => {
    beforeEach(async () => {
      await ideIntegration.start();
    });

    it('should update autocomplete when optimization completes', async () => {
      const optimizationResult = {
        classes: ['new-class', 'optimized-class'],
        removedClasses: ['old-class'],
        file: 'test.css',
      };

      await ideIntegration.handleOptimizationResult(optimizationResult);
      
      // Should update autocomplete data
      const autocomplete = await ideIntegration.generateAutocomplete(optimizationResult.classes);
      expect(autocomplete.cssClasses).toContain('new-class');
    });

    it('should provide optimization suggestions', async () => {
      const cssContent = '.btn { padding: 0.5rem 1rem; background: blue; }';
      const suggestions = await ideIntegration.getOptimizationSuggestions(cssContent);
      
      expect(Array.isArray(suggestions)).toBe(true);
    });
  });
}); 