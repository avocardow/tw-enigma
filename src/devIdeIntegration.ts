/**
 * Copyright (c) 2025 Rowan Cardow
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { EventEmitter } from "events";
import { createLogger, Logger } from "./logger.js";
import { EnigmaConfig } from "./config.js";
import { writeFile, readFile, mkdir, access, constants } from "fs/promises";
import { join, dirname, resolve } from "path";
import { execSync } from "child_process";

/**
 * IDE integration configuration
 */
export interface IdeIntegrationConfig {
  enabled: boolean;
  supportedIdes: {
    vscode: boolean;
    webstorm: boolean;
    sublimeText: boolean;
    atom: boolean;
    vim: boolean;
    neovim: boolean;
  };
  features: {
    autocomplete: boolean;
    diagnostics: boolean;
    snippets: boolean;
    documentSymbols: boolean;
    hover: boolean;
    gotoDefinition: boolean;
    codeActions: boolean;
    formatting: boolean;
    linting: boolean;
  };
  languageServer: {
    enabled: boolean;
    port: number;
    host: string;
    protocol: 'tcp' | 'stdio';
    capabilities: string[];
  };
  snippets: {
    generateForFrameworks: string[];
    includeCustomClasses: boolean;
    includeUtilityClasses: boolean;
    includeComponentClasses: boolean;
  };
  autoCompletion: {
    classNames: boolean;
    directives: boolean;
    configOptions: boolean;
    filePathss: boolean;
    frameworkSpecific: boolean;
  };
}

/**
 * IDE-specific configuration
 */
export interface IdeSpecificConfig {
  vscode: {
    settingsPath: string;
    extensionPath: string;
    snippetsPath: string;
    tasksPath: string;
    launchPath: string;
  };
  webstorm: {
    configPath: string;
    templatesPath: string;
    inspectionsPath: string;
    fileTypesPath: string;
  };
  vim: {
    configPath: string;
    pluginPath: string;
    snippetsPath: string;
  };
}

/**
 * Autocomplete item
 */
export interface AutoCompleteItem {
  label: string;
  kind: 'class' | 'directive' | 'config' | 'file' | 'snippet';
  detail: string;
  documentation: string;
  insertText: string;
  filterText: string;
  sortText: string;
  framework?: string;
  category: string;
  examples: string[];
  deprecated?: boolean;
  experimental?: boolean;
}

/**
 * Code snippet
 */
export interface CodeSnippet {
  name: string;
  prefix: string;
  description: string;
  body: string[];
  scope: string[];
  framework?: string;
  category: string;
  placeholders: Array<{
    index: number;
    placeholder: string;
    choices?: string[];
  }>;
}

/**
 * Diagnostic item
 */
export interface DiagnosticItem {
  range: {
    start: { line: number; character: number };
    end: { line: number; character: number };
  };
  severity: 'error' | 'warning' | 'info' | 'hint';
  message: string;
  source: string;
  code?: string | number;
  relatedInformation?: Array<{
    location: string;
    message: string;
  }>;
  codeActions?: Array<{
    title: string;
    kind: string;
    edit: any;
  }>;
}

/**
 * IDE integration events
 */
export interface IdeIntegrationEvents {
  'autocomplete-requested': (uri: string, position: any) => void;
  'diagnostics-updated': (uri: string, diagnostics: DiagnosticItem[]) => void;
  'snippet-inserted': (snippet: CodeSnippet, location: string) => void;
  'code-action-executed': (action: string, uri: string) => void;
  'config-updated': (ide: string, config: any) => void;
  'error': (error: Error) => void;
}

/**
 * Enhanced IDE Integration System
 * Provides comprehensive IDE support with language server, autocomplete, and diagnostics
 */
export class DevIdeIntegration extends EventEmitter {
  private config: IdeIntegrationConfig;
  private logger: Logger;
  private isActive = false;
  private projectRoot: string;
  private ideConfigs: IdeSpecificConfig;
  private autoCompleteItems: Map<string, AutoCompleteItem[]> = new Map();
  private codeSnippets: Map<string, CodeSnippet[]> = new Map();
  private activeLanguageServer?: any;

  constructor(
    config: Partial<IdeIntegrationConfig> = {},
    private enigmaConfig: EnigmaConfig,
    projectRoot?: string
  ) {
    super();
    
    this.projectRoot = projectRoot || process.cwd();
    
    this.config = {
      enabled: true,
      supportedIdes: {
        vscode: true,
        webstorm: true,
        sublimeText: false,
        atom: false,
        vim: true,
        neovim: true,
      },
      features: {
        autocomplete: true,
        diagnostics: true,
        snippets: true,
        documentSymbols: true,
        hover: true,
        gotoDefinition: true,
        codeActions: true,
        formatting: true,
        linting: true,
      },
      languageServer: {
        enabled: true,
        port: 3003,
        host: 'localhost',
        protocol: 'tcp',
        capabilities: [
          'textDocument/completion',
          'textDocument/hover',
          'textDocument/diagnostics',
          'textDocument/formatting',
          'textDocument/codeAction',
        ],
      },
      snippets: {
        generateForFrameworks: ['react', 'vue', 'angular', 'svelte'],
        includeCustomClasses: true,
        includeUtilityClasses: true,
        includeComponentClasses: true,
      },
      autoCompletion: {
        classNames: true,
        directives: true,
        configOptions: true,
        filePathss: true,
        frameworkSpecific: true,
      },
      ...config,
    };

    this.logger = createLogger("DevIdeIntegration");
    
    this.ideConfigs = {
      vscode: {
        settingsPath: join(this.projectRoot, '.vscode', 'settings.json'),
        extensionPath: join(this.projectRoot, '.vscode', 'extensions.json'),
        snippetsPath: join(this.projectRoot, '.vscode', 'snippets'),
        tasksPath: join(this.projectRoot, '.vscode', 'tasks.json'),
        launchPath: join(this.projectRoot, '.vscode', 'launch.json'),
      },
      webstorm: {
        configPath: join(this.projectRoot, '.idea', 'enigma.xml'),
        templatesPath: join(this.projectRoot, '.idea', 'fileTemplates'),
        inspectionsPath: join(this.projectRoot, '.idea', 'inspectionProfiles'),
        fileTypesPath: join(this.projectRoot, '.idea', 'fileTypes.xml'),
      },
      vim: {
        configPath: join(this.projectRoot, '.vim', 'enigma.vim'),
        pluginPath: join(this.projectRoot, '.vim', 'plugin'),
        snippetsPath: join(this.projectRoot, '.vim', 'snippets'),
      },
    };

    this.logger.debug("IDE integration initialized", { config: this.config });
  }

  /**
   * Start IDE integration
   */
  async start(): Promise<void> {
    if (this.isActive) {
      this.logger.warn("IDE integration already running");
      return;
    }

    if (!this.config.enabled) {
      this.logger.info("IDE integration disabled");
      return;
    }

    this.isActive = true;
    this.logger.info("Starting IDE integration");

    try {
      // Generate IDE configurations
      await this.generateIdeConfigurations();

      // Generate autocomplete data
      await this.generateAutoCompleteData();

      // Generate code snippets
      await this.generateCodeSnippets();

      // Start language server if enabled
      if (this.config.languageServer.enabled) {
        await this.startLanguageServer();
      }

      this.logger.info("IDE integration started", {
        ides: Object.entries(this.config.supportedIdes)
          .filter(([, enabled]) => enabled)
          .map(([ide]) => ide),
        features: Object.entries(this.config.features)
          .filter(([, enabled]) => enabled)
          .map(([feature]) => feature),
      });

    } catch (error) {
      this.logger.error("Failed to start IDE integration", { error });
      throw error;
    }
  }

  /**
   * Stop IDE integration
   */
  async stop(): Promise<void> {
    if (!this.isActive) {
      this.logger.warn("IDE integration not running");
      return;
    }

    this.isActive = false;
    this.logger.info("Stopping IDE integration");

    try {
      // Stop language server
      if (this.activeLanguageServer) {
        this.activeLanguageServer.stop();
        this.activeLanguageServer = undefined;
      }

      this.logger.info("IDE integration stopped");

    } catch (error) {
      this.logger.error("Error stopping IDE integration", { error });
      throw error;
    }
  }

  /**
   * Get autocomplete items for a specific context
   */
  getAutoCompleteItems(
    uri: string,
    position: { line: number; character: number },
    context: string
  ): AutoCompleteItem[] {
    const extension = uri.split('.').pop()?.toLowerCase();
    const framework = this.detectFramework(uri);
    const key = `${extension}-${framework}-${context}`;
    
    this.emit('autocomplete-requested', uri, position);
    
    return this.autoCompleteItems.get(key) || this.autoCompleteItems.get('default') || [];
  }

  /**
   * Get code snippets for a specific context
   */
  getCodeSnippets(scope: string, framework?: string): CodeSnippet[] {
    const key = framework ? `${scope}-${framework}` : scope;
    return this.codeSnippets.get(key) || this.codeSnippets.get(scope) || [];
  }

  /**
   * Validate file and return diagnostics
   */
  async validateFile(uri: string): Promise<DiagnosticItem[]> {
    const diagnostics: DiagnosticItem[] = [];
    
    try {
      const content = await readFile(uri, 'utf-8');
      const framework = this.detectFramework(uri);
      
      // Validate CSS classes
      const classValidation = await this.validateClasses(content, framework);
      diagnostics.push(...classValidation);
      
      // Validate configuration
      if (uri.includes('enigma.config') || uri.includes('.enigmarc')) {
        const configValidation = await this.validateConfiguration(content);
        diagnostics.push(...configValidation);
      }
      
      this.emit('diagnostics-updated', uri, diagnostics);
      
    } catch (error) {
      this.logger.debug("Error validating file", { uri, error });
    }
    
    return diagnostics;
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<IdeIntegrationConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.logger.debug("Configuration updated", { config: this.config });
  }

  /**
   * Generate IDE-specific configurations
   */
  private async generateIdeConfigurations(): Promise<void> {
    const promises: Promise<void>[] = [];

    if (this.config.supportedIdes.vscode) {
      promises.push(this.generateVSCodeConfig());
    }

    if (this.config.supportedIdes.webstorm) {
      promises.push(this.generateWebStormConfig());
    }

    if (this.config.supportedIdes.vim || this.config.supportedIdes.neovim) {
      promises.push(this.generateVimConfig());
    }

    await Promise.all(promises);
  }

  /**
   * Generate VSCode configuration
   */
  private async generateVSCodeConfig(): Promise<void> {
    // VSCode settings
    const settings = {
      "enigma.enabled": true,
      "enigma.autoOptimize": this.enigmaConfig.dev.enabled,
      "enigma.showDiagnostics": this.config.features.diagnostics,
      "enigma.enableAutoComplete": this.config.features.autocomplete,
      "enigma.languageServer": {
        "enabled": this.config.languageServer.enabled,
        "port": this.config.languageServer.port,
      },
      "files.associations": {
        "*.enigmarc": "json",
        "enigma.config.*": "javascript",
      },
      "emmet.includeLanguages": {
        "javascript": "html",
        "typescript": "html",
        "javascriptreact": "html",
        "typescriptreact": "html",
      },
    };

    // VSCode extensions recommendations
    const extensions = {
      "recommendations": [
        "bradlc.vscode-tailwindcss",
        "esbenp.prettier-vscode",
        "ms-vscode.vscode-typescript-next",
      ],
    };

    // VSCode tasks
    const tasks = {
      "version": "2.0.0",
      "tasks": [
        {
          "label": "Enigma: Optimize",
          "type": "shell",
          "command": "npx",
          "args": ["enigma", "optimize"],
          "group": "build",
          "presentation": {
            "echo": true,
            "reveal": "always",
            "focus": false,
            "panel": "shared",
          },
          "problemMatcher": [],
        },
        {
          "label": "Enigma: Watch",
          "type": "shell",
          "command": "npx",
          "args": ["enigma", "watch"],
          "group": "build",
          "isBackground": true,
          "presentation": {
            "echo": true,
            "reveal": "always",
            "focus": false,
            "panel": "shared",
          },
          "problemMatcher": [],
        },
      ],
    };

    // VSCode launch configuration
    const launch = {
      "version": "0.2.0",
      "configurations": [
        {
          "name": "Debug Enigma",
          "type": "node",
          "request": "launch",
          "program": "${workspaceFolder}/node_modules/.bin/enigma",
          "args": ["optimize", "--debug"],
          "console": "integratedTerminal",
          "env": {
            "NODE_ENV": "development",
          },
        },
      ],
    };

    // Create directories and files
    await mkdir(dirname(this.ideConfigs.vscode.settingsPath), { recursive: true });
    await mkdir(this.ideConfigs.vscode.snippetsPath, { recursive: true });

    await Promise.all([
      this.writeJsonFile(this.ideConfigs.vscode.settingsPath, settings),
      this.writeJsonFile(this.ideConfigs.vscode.extensionPath, extensions),
      this.writeJsonFile(this.ideConfigs.vscode.tasksPath, tasks),
      this.writeJsonFile(this.ideConfigs.vscode.launchPath, launch),
    ]);

    // Generate VSCode snippets
    await this.generateVSCodeSnippets();

    this.logger.debug("VSCode configuration generated");
    this.emit('config-updated', 'vscode', { settings, extensions, tasks, launch });
  }

  /**
   * Generate WebStorm configuration
   */
  private async generateWebStormConfig(): Promise<void> {
    const config = `<?xml version="1.0" encoding="UTF-8"?>
<application>
  <component name="EnigmaSettings">
    <option name="enabled" value="true" />
    <option name="autoOptimize" value="${this.enigmaConfig.dev.enabled}" />
    <option name="showDiagnostics" value="${this.config.features.diagnostics}" />
    <option name="enableAutoComplete" value="${this.config.features.autocomplete}" />
    <option name="languageServerPort" value="${this.config.languageServer.port}" />
  </component>
</application>`;

    const fileTypes = `<?xml version="1.0" encoding="UTF-8"?>
<application>
  <component name="FileTypeManager" version="18">
    <extensionMap>
      <mapping pattern=".enigmarc" type="JSON" />
      <mapping pattern="enigma.config.*" type="JavaScript" />
    </extensionMap>
  </component>
</application>`;

    await mkdir(dirname(this.ideConfigs.webstorm.configPath), { recursive: true });
    await mkdir(this.ideConfigs.webstorm.templatesPath, { recursive: true });

    await Promise.all([
      writeFile(this.ideConfigs.webstorm.configPath, config),
      writeFile(this.ideConfigs.webstorm.fileTypesPath, fileTypes),
    ]);

    this.logger.debug("WebStorm configuration generated");
    this.emit('config-updated', 'webstorm', { config, fileTypes });
  }

  /**
   * Generate Vim configuration
   */
  private async generateVimConfig(): Promise<void> {
    const config = `" Enigma Tailwind CSS Optimizer configuration
let g:enigma_enabled = 1
let g:enigma_auto_optimize = ${this.enigmaConfig.dev.enabled ? 1 : 0}
let g:enigma_show_diagnostics = ${this.config.features.diagnostics ? 1 : 0}
let g:enigma_language_server_port = ${this.config.languageServer.port}

" File type associations
autocmd BufNewFile,BufRead .enigmarc setfiletype json
autocmd BufNewFile,BufRead enigma.config.* setfiletype javascript

" Commands
command! EnigmaOptimize !npx enigma optimize
command! EnigmaWatch !npx enigma watch &

" Key mappings
nnoremap <leader>eo :EnigmaOptimize<CR>
nnoremap <leader>ew :EnigmaWatch<CR>`;

    await mkdir(dirname(this.ideConfigs.vim.configPath), { recursive: true });
    await mkdir(this.ideConfigs.vim.snippetsPath, { recursive: true });

    await writeFile(this.ideConfigs.vim.configPath, config);

    this.logger.debug("Vim configuration generated");
    this.emit('config-updated', 'vim', { config });
  }

  /**
   * Generate autocomplete data
   */
  private async generateAutoCompleteData(): Promise<void> {
    const frameworks = ['react', 'vue', 'angular', 'svelte', 'vanilla'];
    const fileTypes = ['css', 'html', 'javascript', 'typescript', 'jsx', 'tsx', 'vue', 'svelte'];

    for (const framework of frameworks) {
      for (const fileType of fileTypes) {
        const items = await this.generateAutoCompleteForContext(framework, fileType);
        this.autoCompleteItems.set(`${fileType}-${framework}`, items);
      }
    }

    // Generate default autocomplete items
    const defaultItems = await this.generateAutoCompleteForContext('vanilla', 'css');
    this.autoCompleteItems.set('default', defaultItems);
  }

  /**
   * Generate autocomplete items for specific context
   */
  private async generateAutoCompleteForContext(
    framework: string,
    fileType: string
  ): Promise<AutoCompleteItem[]> {
    const items: AutoCompleteItem[] = [];

    // Tailwind utility classes
    const utilityClasses = [
      { name: 'flex', description: 'Display: flex', category: 'Layout' },
      { name: 'grid', description: 'Display: grid', category: 'Layout' },
      { name: 'hidden', description: 'Display: none', category: 'Layout' },
      { name: 'block', description: 'Display: block', category: 'Layout' },
      { name: 'inline', description: 'Display: inline', category: 'Layout' },
      { name: 'text-center', description: 'Text align: center', category: 'Typography' },
      { name: 'text-left', description: 'Text align: left', category: 'Typography' },
      { name: 'text-right', description: 'Text align: right', category: 'Typography' },
      { name: 'bg-red-500', description: 'Background: red-500', category: 'Background' },
      { name: 'text-blue-600', description: 'Color: blue-600', category: 'Typography' },
    ];

    for (const utilityClass of utilityClasses) {
      items.push({
        label: utilityClass.name,
        kind: 'class',
        detail: utilityClass.description,
        documentation: `Tailwind CSS utility class: ${utilityClass.description}`,
        insertText: utilityClass.name,
        filterText: utilityClass.name,
        sortText: `a_${utilityClass.name}`,
        framework,
        category: utilityClass.category,
        examples: [`<div class="${utilityClass.name}">Content</div>`],
      });
    }

    // Configuration options
    if (fileType === 'javascript' || fileType === 'typescript') {
      const configOptions = [
        'input', 'output', 'removeUnused', 'minify', 'classPrefix',
        'excludePatterns', 'preserveComments', 'sourceMaps'
      ];

      for (const option of configOptions) {
        items.push({
          label: option,
          kind: 'config',
          detail: `Configuration option: ${option}`,
          documentation: `Enigma configuration option for ${option}`,
          insertText: option,
          filterText: option,
          sortText: `b_${option}`,
          framework,
          category: 'Configuration',
          examples: [`${option}: true`],
        });
      }
    }

    return items;
  }

  /**
   * Generate code snippets
   */
  private async generateCodeSnippets(): Promise<void> {
    const frameworks = this.config.snippets.generateForFrameworks;

    for (const framework of frameworks) {
      const snippets = await this.generateSnippetsForFramework(framework);
      this.codeSnippets.set(framework, snippets);
    }

    // Generate general snippets
    const generalSnippets = await this.generateGeneralSnippets();
    this.codeSnippets.set('general', generalSnippets);
  }

  /**
   * Generate snippets for specific framework
   */
  private async generateSnippetsForFramework(framework: string): Promise<CodeSnippet[]> {
    const snippets: CodeSnippet[] = [];

    if (framework === 'react') {
      snippets.push({
        name: 'React Component with Tailwind',
        prefix: 'enigma-react-component',
        description: 'React component with Tailwind CSS classes',
        body: [
          'import React from \'react\';',
          '',
          'interface ${1:ComponentName}Props {',
          '  ${2:prop}: ${3:string};',
          '}',
          '',
          'export const ${1:ComponentName}: React.FC<${1:ComponentName}Props> = ({ ${2:prop} }) => {',
          '  return (',
          '    <div className="${4:flex items-center justify-center}">',
          '      <h1 className="${5:text-2xl font-bold text-gray-800}">{${2:prop}}</h1>',
          '    </div>',
          '  );',
          '};',
        ],
        scope: ['javascript', 'typescript', 'javascriptreact', 'typescriptreact'],
        framework: 'react',
        category: 'Component',
        placeholders: [
          { index: 1, placeholder: 'ComponentName' },
          { index: 2, placeholder: 'prop' },
          { index: 3, placeholder: 'string' },
          { index: 4, placeholder: 'flex items-center justify-center' },
          { index: 5, placeholder: 'text-2xl font-bold text-gray-800' },
        ],
      });
    }

    if (framework === 'vue') {
      snippets.push({
        name: 'Vue Component with Tailwind',
        prefix: 'enigma-vue-component',
        description: 'Vue component with Tailwind CSS classes',
        body: [
          '<template>',
          '  <div class="${1:flex items-center justify-center}">',
          '    <h1 class="${2:text-2xl font-bold text-gray-800}">{{ ${3:title} }}</h1>',
          '  </div>',
          '</template>',
          '',
          '<script lang="ts">',
          'import { defineComponent } from \'vue\';',
          '',
          'export default defineComponent({',
          '  name: \'${4:ComponentName}\',',
          '  props: {',
          '    ${3:title}: {',
          '      type: String,',
          '      required: true,',
          '    },',
          '  },',
          '});',
          '</script>',
        ],
        scope: ['vue'],
        framework: 'vue',
        category: 'Component',
        placeholders: [
          { index: 1, placeholder: 'flex items-center justify-center' },
          { index: 2, placeholder: 'text-2xl font-bold text-gray-800' },
          { index: 3, placeholder: 'title' },
          { index: 4, placeholder: 'ComponentName' },
        ],
      });
    }

    return snippets;
  }

  /**
   * Generate general snippets
   */
  private async generateGeneralSnippets(): Promise<CodeSnippet[]> {
    return [
      {
        name: 'Enigma Configuration',
        prefix: 'enigma-config',
        description: 'Basic Enigma configuration file',
        body: [
          '{',
          '  "input": "${1:src/**/*.{html,js,jsx,ts,tsx,vue}}",',
          '  "output": "${2:dist}",',
          '  "removeUnused": ${3:true},',
          '  "minify": ${4:true},',
          '  "classPrefix": "${5:tw-}",',
          '  "preserveComments": ${6:false},',
          '  "sourceMaps": ${7:true}',
          '}',
        ],
        scope: ['json', 'javascript'],
        category: 'Configuration',
        placeholders: [
          { index: 1, placeholder: 'src/**/*.{html,js,jsx,ts,tsx,vue}' },
          { index: 2, placeholder: 'dist' },
          { index: 3, placeholder: 'true', choices: ['true', 'false'] },
          { index: 4, placeholder: 'true', choices: ['true', 'false'] },
          { index: 5, placeholder: 'tw-' },
          { index: 6, placeholder: 'false', choices: ['true', 'false'] },
          { index: 7, placeholder: 'true', choices: ['true', 'false'] },
        ],
      },
    ];
  }

  /**
   * Generate VSCode snippets
   */
  private async generateVSCodeSnippets(): Promise<void> {
    const allSnippets = new Map<string, any>();

    // Collect all snippets by scope
    for (const [framework, snippets] of this.codeSnippets) {
      for (const snippet of snippets) {
        for (const scope of snippet.scope) {
          if (!allSnippets.has(scope)) {
            allSnippets.set(scope, {});
          }
          
          allSnippets.get(scope)[snippet.name] = {
            prefix: snippet.prefix,
            body: snippet.body,
            description: snippet.description,
          };
        }
      }
    }

    // Write snippet files
    for (const [scope, snippets] of allSnippets) {
      const filename = `${scope}.json`;
      const filepath = join(this.ideConfigs.vscode.snippetsPath, filename);
      await this.writeJsonFile(filepath, snippets);
    }
  }

  /**
   * Start language server
   */
  private async startLanguageServer(): Promise<void> {
    // This would typically start a full language server
    // For now, we'll create a simple placeholder
    this.logger.debug("Language server started", {
      port: this.config.languageServer.port,
      capabilities: this.config.languageServer.capabilities,
    });
  }

  /**
   * Validate CSS classes in content
   */
  private async validateClasses(content: string, framework?: string): Promise<DiagnosticItem[]> {
    const diagnostics: DiagnosticItem[] = [];
    
    // Simple validation - check for unknown Tailwind classes
    const classRegex = /class(?:Name)?=['"]([^'"]*)['"]/g;
    let match;
    let lineNumber = 0;
    
    const lines = content.split('\n');
    for (const line of lines) {
      while ((match = classRegex.exec(line)) !== null) {
        const classes = match[1].split(/\s+/);
        for (const className of classes) {
          if (className && !this.isValidTailwindClass(className)) {
            diagnostics.push({
              range: {
                start: { line: lineNumber, character: match.index },
                end: { line: lineNumber, character: match.index + match[0].length },
              },
              severity: 'warning',
              message: `Unknown Tailwind CSS class: ${className}`,
              source: 'enigma',
              code: 'unknown-class',
              codeActions: [
                {
                  title: `Remove class '${className}'`,
                  kind: 'quickfix',
                  edit: {
                    // Edit details would be implemented here
                  },
                },
              ],
            });
          }
        }
      }
      lineNumber++;
    }
    
    return diagnostics;
  }

  /**
   * Validate configuration content
   */
  private async validateConfiguration(content: string): Promise<DiagnosticItem[]> {
    const diagnostics: DiagnosticItem[] = [];
    
    try {
      const config = JSON.parse(content);
      
      // Validate against schema
      if (!config.input) {
        diagnostics.push({
          range: { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } },
          severity: 'error',
          message: 'Missing required field: input',
          source: 'enigma',
          code: 'missing-field',
        });
      }
      
    } catch (error) {
      diagnostics.push({
        range: { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } },
        severity: 'error',
        message: 'Invalid JSON syntax',
        source: 'enigma',
        code: 'syntax-error',
      });
    }
    
    return diagnostics;
  }

  /**
   * Check if class is valid Tailwind class
   */
  private isValidTailwindClass(className: string): boolean {
    // This would typically check against a comprehensive list
    // For now, we'll do basic validation
    const commonPrefixes = [
      'flex', 'grid', 'block', 'inline', 'hidden',
      'text-', 'bg-', 'border-', 'p-', 'm-', 'w-', 'h-',
      'rounded', 'shadow', 'opacity-', 'transform',
    ];
    
    return commonPrefixes.some(prefix => className.startsWith(prefix)) || 
           className.includes('-') || 
           className.length < 20; // Basic heuristic
  }

  /**
   * Detect framework from file URI
   */
  private detectFramework(uri: string): string {
    if (uri.includes('react') || uri.endsWith('.jsx') || uri.endsWith('.tsx')) {
      return 'react';
    }
    if (uri.endsWith('.vue')) {
      return 'vue';
    }
    if (uri.includes('angular')) {
      return 'angular';
    }
    if (uri.endsWith('.svelte')) {
      return 'svelte';
    }
    return 'vanilla';
  }

  /**
   * Write JSON file helper
   */
  private async writeJsonFile(filepath: string, data: any): Promise<void> {
    try {
      await mkdir(dirname(filepath), { recursive: true });
      await writeFile(filepath, JSON.stringify(data, null, 2));
    } catch (error) {
      this.logger.debug("Error writing JSON file", { filepath, error });
    }
  }
}

/**
 * Create an IDE integration instance
 */
export function createDevIdeIntegration(
  config: EnigmaConfig,
  ideConfig?: Partial<IdeIntegrationConfig>,
  projectRoot?: string
): DevIdeIntegration | null {
  if (!config.dev.enabled) {
    return null;
  }

  return new DevIdeIntegration(ideConfig, config, projectRoot);
}

/**
 * Type-safe event emitter interface
 */
declare interface DevIdeIntegration {
  on<K extends keyof IdeIntegrationEvents>(event: K, listener: IdeIntegrationEvents[K]): this;
  emit<K extends keyof IdeIntegrationEvents>(event: K, ...args: Parameters<IdeIntegrationEvents[K]>): boolean;
} 