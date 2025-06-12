/**
 * Vite Framework Detector
 *
 * Detects Vite build tool usage through:
 * - Package.json dependencies (vite package)
 * - Vite configuration files (vite.config.js/ts)
 * - Vite-specific plugins and patterns
 * - Build script patterns
 */

import type {
  IFrameworkDetector,
  FrameworkInfo,
  DetectionContext,
  DetectionSource,
  FrameworkType,
} from "../frameworkDetector.js";

export class ViteDetector implements IFrameworkDetector {
  readonly frameworkType: FrameworkType = "vite";
  readonly name = "Vite Detector";

  canDetect(context: DetectionContext): boolean {
    // Can always attempt Vite detection
    return true;
  }

  async detect(context: DetectionContext): Promise<FrameworkInfo | null> {
    const sources: DetectionSource[] = [];
    let confidence = 0;
    let version: string | undefined;
    const metadata: FrameworkInfo["metadata"] = {
      dependencies: [],
      configFiles: [],
      hasTypeScript: false,
      vitePlugins: [],
      targetFramework: "unknown",
    };

    // Check package.json dependencies
    if (context.packageJson) {
      const packageResults = this.analyzePackageJson(context.packageJson);
      if (packageResults.isVite) {
        sources.push({
          type: "package",
          description: "Vite dependencies found in package.json",
          confidence: packageResults.confidence,
          location: "package.json",
          evidence: packageResults.evidence,
        });
        confidence += packageResults.confidence;
        version = packageResults.version;
        metadata.dependencies = packageResults.dependencies;
        metadata.vitePlugins = packageResults.plugins;
        metadata.targetFramework = packageResults.targetFramework;
      }
    }

    // Check configuration files
    if (context.configFiles) {
      const configResults = this.analyzeConfigFiles(context.configFiles);
      if (configResults.isVite) {
        sources.push({
          type: "config",
          description: "Vite configuration found",
          confidence: configResults.confidence,
          evidence: configResults.evidence,
        });
        confidence += configResults.confidence;
        metadata.configFiles = configResults.configFiles;
        if (configResults.plugins.length > 0) {
          metadata.vitePlugins = [
            ...(metadata.vitePlugins || []),
            ...configResults.plugins,
          ];
        }
        if (configResults.targetFramework !== "unknown") {
          metadata.targetFramework = configResults.targetFramework;
        }
      }
    }

    // Check file structure
    if (context.fileStructure) {
      const fsResults = this.analyzeFileStructure(context.fileStructure);
      if (fsResults.isVite) {
        sources.push({
          type: "filesystem",
          description: "Vite file structure detected",
          confidence: fsResults.confidence,
          evidence: fsResults.evidence,
        });
        confidence += fsResults.confidence;
      }
    }

    // Check source patterns
    if (context.sourcePatterns) {
      const codeResults = this.analyzeSourcePatterns(context.sourcePatterns);
      if (codeResults.isVite) {
        sources.push({
          type: "code",
          description: "Vite patterns found in source code",
          confidence: codeResults.confidence,
          evidence: codeResults.evidence,
        });
        confidence += codeResults.confidence;
      }
    }

    // Normalize confidence (ensure it doesn't exceed 1.0)
    const normalizedConfidence = Math.min(confidence, 1.0);

    // Return null if confidence is too low
    if (normalizedConfidence < 0.4) {
      return null;
    }

    // Detect TypeScript support
    metadata.hasTypeScript = this.detectTypeScriptSupport(context);

    // Detect build system (always Vite for Vite projects)
    metadata.buildSystem = "Vite";

    // Detect entry points
    metadata.entryPoints = this.detectEntryPoints(context);

    return {
      type: "vite",
      name: "Vite",
      version,
      confidence: normalizedConfidence,
      sources,
      metadata,
    };
  }

  private analyzePackageJson(packageJson: any): {
    isVite: boolean;
    confidence: number;
    version?: string;
    evidence: string[];
    dependencies: string[];
    plugins: string[];
    targetFramework: string;
  } {
    const evidence: string[] = [];
    const dependencies: string[] = [];
    const plugins: string[] = [];
    let confidence = 0;
    let version: string | undefined;
    let targetFramework = "unknown";

    const allDeps = {
      ...packageJson.dependencies,
      ...packageJson.devDependencies,
      ...packageJson.peerDependencies,
    };

    // Core Vite package
    if (allDeps.vite) {
      evidence.push("vite dependency found");
      dependencies.push("vite");
      confidence += 0.7; // High confidence for Vite dependency
      version = allDeps.vite;
    }

    // Vite plugins (these help determine target framework)
    const vitePlugins = [
      "@vitejs/plugin-react",
      "@vitejs/plugin-react-swc",
      "@vitejs/plugin-vue",
      "@vitejs/plugin-vue-jsx",
      "@vitejs/plugin-preact",
      "@vitejs/plugin-solid",
      "@vitejs/plugin-svelte",
      "@vitejs/plugin-legacy",
      "vite-plugin-pwa",
      "vite-plugin-windicss",
      "vite-plugin-eslint",
      "vite-plugin-checker",
      "vite-plugin-mock",
      "unplugin-auto-import",
      "unplugin-vue-components",
    ];

    let pluginCount = 0;
    for (const plugin of vitePlugins) {
      if (allDeps[plugin]) {
        pluginCount++;
        plugins.push(plugin);
        dependencies.push(plugin);
        if (pluginCount <= 3) {
          evidence.push(`${plugin} found`);
        }

        // Determine target framework based on plugins
        if (plugin.includes("react")) {
          targetFramework = "react";
        } else if (plugin.includes("vue")) {
          targetFramework = "vue";
        } else if (plugin.includes("preact")) {
          targetFramework = "preact";
        } else if (plugin.includes("solid")) {
          targetFramework = "solid";
        } else if (plugin.includes("svelte")) {
          targetFramework = "svelte";
        }
      }
    }

    if (pluginCount > 0) {
      confidence += Math.min(pluginCount * 0.1, 0.25);
    }

    // Check for Vite scripts
    if (packageJson.scripts) {
      const scripts = packageJson.scripts;
      let scriptCount = 0;

      if (
        scripts.dev &&
        (scripts.dev.includes("vite") || scripts.dev === "vite")
      ) {
        evidence.push("vite dev script found");
        scriptCount++;
      }

      if (scripts.build && scripts.build.includes("vite build")) {
        evidence.push("vite build script found");
        scriptCount++;
      }

      if (scripts.preview && scripts.preview.includes("vite preview")) {
        evidence.push("vite preview script found");
        scriptCount++;
      }

      if (scriptCount > 0) {
        confidence += scriptCount * 0.1;
      }
    }

    // Additional Vite ecosystem tools
    const viteEcosystem = [
      "vitest",
      "@vitest/ui",
      "vitepress",
      "vite-node",
      "rollup", // Vite uses Rollup internally
    ];

    let ecosystemCount = 0;
    for (const tool of viteEcosystem) {
      if (allDeps[tool]) {
        ecosystemCount++;
        dependencies.push(tool);
        if (ecosystemCount <= 2) {
          evidence.push(`${tool} found`);
        }
      }
    }

    if (ecosystemCount > 0) {
      confidence += Math.min(ecosystemCount * 0.05, 0.15);
    }

    return {
      isVite: confidence > 0,
      confidence,
      version,
      evidence,
      dependencies,
      plugins,
      targetFramework,
    };
  }

  private analyzeConfigFiles(configFiles: Map<string, any>): {
    isVite: boolean;
    confidence: number;
    evidence: string[];
    configFiles: string[];
    plugins: string[];
    targetFramework: string;
  } {
    const evidence: string[] = [];
    const foundConfigFiles: string[] = [];
    const plugins: string[] = [];
    let confidence = 0;
    let targetFramework = "unknown";

    // Vite configuration files
    const viteConfigs = [
      "vite.config.js",
      "vite.config.ts",
      "vite.config.mjs",
      "vite.config.mts",
    ];

    for (const configFile of viteConfigs) {
      if (configFiles.has(configFile)) {
        evidence.push(`${configFile} found`);
        foundConfigFiles.push(configFile);
        confidence += 0.6; // High confidence for Vite config

        // Analyze config content for plugins
        const config = configFiles.get(configFile);
        if (config?._rawContent) {
          const content = config._rawContent;

          // Look for Vite plugins in config
          if (content.includes("@vitejs/plugin-react")) {
            plugins.push("@vitejs/plugin-react");
            targetFramework = "react";
            evidence.push("React plugin configured");
          }

          if (content.includes("@vitejs/plugin-vue")) {
            plugins.push("@vitejs/plugin-vue");
            targetFramework = "vue";
            evidence.push("Vue plugin configured");
          }

          if (content.includes("@vitejs/plugin-svelte")) {
            plugins.push("@vitejs/plugin-svelte");
            targetFramework = "svelte";
            evidence.push("Svelte plugin configured");
          }

          if (content.includes("defineConfig")) {
            evidence.push("Vite defineConfig usage found");
            confidence += 0.1;
          }
        }

        break; // Only count one config file
      }
    }

    // Check for Vitest configuration
    const vitestConfigs = [
      "vitest.config.js",
      "vitest.config.ts",
      "vitest.workspace.js",
      "vitest.workspace.ts",
    ];

    for (const configFile of vitestConfigs) {
      if (configFiles.has(configFile)) {
        evidence.push(`${configFile} found (Vitest)`);
        foundConfigFiles.push(configFile);
        confidence += 0.2;
        break;
      }
    }

    return {
      isVite: confidence > 0,
      confidence,
      evidence,
      configFiles: foundConfigFiles,
      plugins,
      targetFramework,
    };
  }

  private analyzeFileStructure(fileStructure: {
    directories: string[];
    files: string[];
  }): {
    isVite: boolean;
    confidence: number;
    evidence: string[];
  } {
    const evidence: string[] = [];
    let confidence = 0;

    // Check for Vite-specific files
    const viteFiles = [
      "vite.config.js",
      "vite.config.ts",
      "vite.config.mjs",
      "vitest.config.js",
      "vitest.config.ts",
    ];

    let viteFileCount = 0;
    for (const file of viteFiles) {
      if (fileStructure.files.includes(file)) {
        viteFileCount++;
        evidence.push(`${file} found`);
      }
    }

    if (viteFileCount > 0) {
      confidence += Math.min(viteFileCount * 0.3, 0.6);
    }

    // Check for common Vite project structure
    const hasPublic = fileStructure.directories.includes("public");
    const hasSrc = fileStructure.directories.includes("src");
    const hasDist = fileStructure.directories.includes("dist");

    if (hasPublic) {
      evidence.push("public directory found");
      confidence += 0.1;
    }

    if (hasSrc) {
      evidence.push("src directory found");
      confidence += 0.05;
    }

    if (hasDist) {
      evidence.push("dist directory found (Vite output)");
      confidence += 0.05;
    }

    // Check for index.html in root (typical Vite pattern)
    if (fileStructure.files.includes("index.html")) {
      evidence.push("index.html in root (Vite pattern)");
      confidence += 0.2;
    }

    return {
      isVite: confidence > 0,
      confidence,
      evidence,
    };
  }

  private analyzeSourcePatterns(sourcePatterns: string[]): {
    isVite: boolean;
    confidence: number;
    evidence: string[];
  } {
    const evidence: string[] = [];
    let confidence = 0;

    // Check for src directory (common in Vite projects)
    if (sourcePatterns.includes("src")) {
      evidence.push("src directory in source patterns");
      confidence += 0.1;
    }

    // Check for JSX/TSX files (often used with Vite + React)
    if (sourcePatterns.includes("*.jsx") || sourcePatterns.includes("*.tsx")) {
      confidence += 0.05;
    }

    // Check for Vue files (Vite + Vue)
    if (sourcePatterns.includes("*.vue")) {
      evidence.push("Vue files found");
      confidence += 0.15;
    }

    // Check for Svelte files (Vite + Svelte)
    if (sourcePatterns.includes("*.svelte")) {
      evidence.push("Svelte files found");
      confidence += 0.15;
    }

    return {
      isVite: confidence > 0,
      confidence,
      evidence,
    };
  }

  private detectTypeScriptSupport(context: DetectionContext): boolean {
    // Check for TypeScript dependencies
    if (context.packageJson) {
      const allDeps = {
        ...context.packageJson.dependencies,
        ...context.packageJson.devDependencies,
      };

      if (allDeps.typescript || allDeps["@types/node"]) {
        return true;
      }
    }

    // Check for TypeScript config files
    if (
      context.configFiles?.has("tsconfig.json") ||
      context.configFiles?.has("tsconfig.node.json")
    ) {
      return true;
    }

    // Check for TypeScript files
    if (
      context.sourcePatterns?.includes("*.tsx") ||
      context.sourcePatterns?.includes("*.ts")
    ) {
      return true;
    }

    // Check for Vite TypeScript config
    if (context.fileStructure?.files.includes("vite.config.ts")) {
      return true;
    }

    return false;
  }

  private detectEntryPoints(context: DetectionContext): string[] {
    const entryPoints: string[] = [];

    // Check for common Vite entry points
    const commonEntries = [
      "src/main.js",
      "src/main.ts",
      "src/main.jsx",
      "src/main.tsx",
      "src/index.js",
      "src/index.ts",
      "src/App.js",
      "src/App.ts",
      "src/App.jsx",
      "src/App.tsx",
      "src/App.vue",
      "index.html", // Vite uses index.html as entry point
    ];

    for (const entry of commonEntries) {
      const fileName = entry.split("/").pop()!;
      if (context.fileStructure?.files.includes(fileName)) {
        entryPoints.push(entry);
      }
    }

    // Vite always uses index.html as the main entry point
    if (context.fileStructure?.files.includes("index.html")) {
      entryPoints.unshift("index.html");
    }

    return [...new Set(entryPoints)]; // Remove duplicates
  }
}
