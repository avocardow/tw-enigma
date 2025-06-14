/**
 * React Framework Detector
 *
 * Detects React framework usage through:
 * - Package.json dependencies
 * - Import patterns
 * - JSX syntax analysis
 * - Configuration files
 */

import type {
  IFrameworkDetector,
  FrameworkInfo,
  DetectionContext,
  DetectionSource,
  FrameworkType,
} from "../frameworkDetector";

export class ReactDetector implements IFrameworkDetector {
  readonly frameworkType: FrameworkType = "react";
  readonly name = "React Detector";

  canDetect(context: DetectionContext): boolean {
    // Can always attempt React detection
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
    };

    // Check package.json dependencies
    if (context.packageJson) {
      const packageResults = this.analyzePackageJson(context.packageJson);
      if (packageResults.isReact) {
        sources.push({
          type: "package",
          description: "React dependencies found in package.json",
          confidence: packageResults.confidence,
          location: "package.json",
          evidence: packageResults.evidence,
        });
        confidence += packageResults.confidence;
        version = packageResults.version;
        metadata.dependencies = packageResults.dependencies;
      }
    }

    // Check configuration files
    if (context.configFiles) {
      const configResults = this.analyzeConfigFiles(context.configFiles);
      if (configResults.isReact) {
        sources.push({
          type: "config",
          description: "React-related configuration found",
          confidence: configResults.confidence,
          evidence: configResults.evidence,
        });
        confidence += configResults.confidence;
        metadata.configFiles = configResults.configFiles;
      }
    }

    // Check source patterns
    if (context.sourcePatterns) {
      const codeResults = this.analyzeSourcePatterns(context.sourcePatterns);
      if (codeResults.isReact) {
        sources.push({
          type: "code",
          description: "React patterns found in source code",
          confidence: codeResults.confidence,
          evidence: codeResults.evidence,
        });
        confidence += codeResults.confidence;
      }
    }

    // Check file structure
    if (context.fileStructure) {
      const fsResults = this.analyzeFileStructure(context.fileStructure);
      if (fsResults.isReact) {
        sources.push({
          type: "filesystem",
          description: "React-specific file structure detected",
          confidence: fsResults.confidence,
          evidence: fsResults.evidence,
        });
        confidence += fsResults.confidence;
      }
    }

    // Normalize confidence (ensure it doesn't exceed 1.0)
    const normalizedConfidence = Math.min(confidence, 1.0);

    // Return null if confidence is too low
    if (normalizedConfidence < 0.3) {
      return null;
    }

    // Detect TypeScript support
    metadata.hasTypeScript = this.detectTypeScriptSupport(context);

    // Detect build system
    metadata.buildSystem = this.detectBuildSystem(context);

    // Detect entry points
    metadata.entryPoints = this.detectEntryPoints(context);

    return {
      type: "react",
      name: "React",
      version,
      confidence: normalizedConfidence,
      sources,
      metadata,
    };
  }

  private analyzePackageJson(packageJson: any): {
    isReact: boolean;
    confidence: number;
    version?: string;
    evidence: string[];
    dependencies: string[];
  } {
    const evidence: string[] = [];
    const dependencies: string[] = [];
    let confidence = 0;
    let version: string | undefined;

    const allDeps = {
      ...packageJson.dependencies,
      ...packageJson.devDependencies,
      ...packageJson.peerDependencies,
    };

    // Core React packages
    if (allDeps.react) {
      evidence.push("react dependency found");
      dependencies.push("react");
      confidence += 0.6;
      version = allDeps.react;
    }

    if (allDeps["react-dom"]) {
      evidence.push("react-dom dependency found");
      dependencies.push("react-dom");
      confidence += 0.3;
    }

    // React ecosystem packages
    const reactEcosystem = [
      "react-router",
      "react-router-dom",
      "react-query",
      "@tanstack/react-query",
      "react-hook-form",
      "react-redux",
      "@reduxjs/toolkit",
      "styled-components",
      "@emotion/react",
      "framer-motion",
      "react-spring",
      "react-transition-group",
      "react-helmet",
      "react-helmet-async",
    ];

    let ecosystemCount = 0;
    for (const pkg of reactEcosystem) {
      if (allDeps[pkg]) {
        ecosystemCount++;
        dependencies.push(pkg);
        if (ecosystemCount <= 3) {
          // Diminishing returns
          evidence.push(`${pkg} dependency found`);
        }
      }
    }

    if (ecosystemCount > 0) {
      confidence += Math.min(ecosystemCount * 0.1, 0.3);
    }

    // React tools and build systems
    const reactTools = [
      "create-react-app",
      "react-scripts",
      "@vitejs/plugin-react",
      "@vitejs/plugin-react-swc",
      "eslint-plugin-react",
      "eslint-plugin-react-hooks",
      "@types/react",
      "@types/react-dom",
    ];

    let toolsCount = 0;
    for (const tool of reactTools) {
      if (allDeps[tool]) {
        toolsCount++;
        dependencies.push(tool);
        if (toolsCount <= 2) {
          evidence.push(`${tool} tool found`);
        }
      }
    }

    if (toolsCount > 0) {
      confidence += Math.min(toolsCount * 0.05, 0.2);
    }

    return {
      isReact: confidence > 0,
      confidence,
      version,
      evidence,
      dependencies,
    };
  }

  private analyzeConfigFiles(configFiles: Map<string, any>): {
    isReact: boolean;
    confidence: number;
    evidence: string[];
    configFiles: string[];
  } {
    const evidence: string[] = [];
    const foundConfigFiles: string[] = [];
    let confidence = 0;

    // Vite React plugin
    const viteConfig =
      configFiles.get("vite.config.js") ||
      configFiles.get("vite.config.ts") ||
      configFiles.get("vite.config.mjs");

    if (viteConfig?.plugins || viteConfig?._rawContent) {
      const content = viteConfig._rawContent || JSON.stringify(viteConfig);
      if (
        content.includes("@vitejs/plugin-react") ||
        content.includes("plugin-react")
      ) {
        evidence.push("Vite React plugin configuration found");
        foundConfigFiles.push("vite.config.*");
        confidence += 0.4;
      }
    }

    // Webpack configuration
    const webpackConfig = configFiles.get("webpack.config.js");
    if (webpackConfig?._rawContent) {
      if (
        webpackConfig._rawContent.includes("react") ||
        webpackConfig._rawContent.includes("jsx")
      ) {
        evidence.push("React-related webpack configuration found");
        foundConfigFiles.push("webpack.config.js");
        confidence += 0.3;
      }
    }

    // Babel configuration
    const babelConfig =
      configFiles.get("babel.config.js") || configFiles.get(".babelrc");
    if (babelConfig) {
      const content = babelConfig._rawContent || JSON.stringify(babelConfig);
      if (
        content.includes("@babel/preset-react") ||
        content.includes("react")
      ) {
        evidence.push("Babel React preset found");
        foundConfigFiles.push("babel configuration");
        confidence += 0.2;
      }
    }

    // TypeScript configuration
    const tsConfig = configFiles.get("tsconfig.json");
    if (tsConfig) {
      const content = JSON.stringify(tsConfig);
      if (content.includes('"jsx"') || content.includes("react")) {
        evidence.push("TypeScript JSX configuration found");
        foundConfigFiles.push("tsconfig.json");
        confidence += 0.15;
      }
    }

    return {
      isReact: confidence > 0,
      confidence,
      evidence,
      configFiles: foundConfigFiles,
    };
  }

  private analyzeSourcePatterns(sourcePatterns: string[]): {
    isReact: boolean;
    confidence: number;
    evidence: string[];
  } {
    const evidence: string[] = [];
    let confidence = 0;

    // JSX/TSX files indicate React
    if (sourcePatterns.includes("*.jsx")) {
      evidence.push("JSX files found");
      confidence += 0.3;
    }

    if (sourcePatterns.includes("*.tsx")) {
      evidence.push("TSX files found");
      confidence += 0.3;
    }

    // Common React directories
    const reactDirs = ["components", "src"];
    for (const dir of reactDirs) {
      if (sourcePatterns.includes(dir)) {
        evidence.push(`${dir} directory found`);
        confidence += 0.1;
      }
    }

    return {
      isReact: confidence > 0,
      confidence,
      evidence,
    };
  }

  private analyzeFileStructure(fileStructure: {
    directories: string[];
    files: string[];
  }): {
    isReact: boolean;
    confidence: number;
    evidence: string[];
  } {
    const evidence: string[] = [];
    let confidence = 0;

    // Check for React-specific directories
    const reactDirs = ["components", "hooks", "contexts", "providers"];
    for (const dir of reactDirs) {
      if (fileStructure.directories.includes(dir)) {
        evidence.push(`${dir} directory found`);
        confidence += 0.1;
      }
    }

    // Check for React-specific files
    const reactFiles = [
      "App.jsx",
      "App.tsx",
      "index.jsx",
      "index.tsx",
      "App.js",
      "index.js",
    ];

    for (const file of reactFiles) {
      if (fileStructure.files.includes(file)) {
        evidence.push(`${file} file found`);
        confidence += 0.15;
      }
    }

    // Check for Create React App specific files
    if (fileStructure.files.includes("public")) {
      // const _craIndicators = ["public/index.html", "src/App.js", "src/index.js"];
      // This is a simplified check - in real implementation we'd check deeper
      confidence += 0.1;
      evidence.push("Create React App structure detected");
    }

    return {
      isReact: confidence > 0,
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

      if (allDeps.typescript || allDeps["@types/react"]) {
        return true;
      }
    }

    // Check for TSX files
    if (context.sourcePatterns?.includes("*.tsx")) {
      return true;
    }

    // Check for tsconfig.json
    if (context.configFiles?.has("tsconfig.json")) {
      return true;
    }

    return false;
  }

  private detectBuildSystem(context: DetectionContext): string | undefined {
    if (context.packageJson) {
      const allDeps = {
        ...context.packageJson.dependencies,
        ...context.packageJson.devDependencies,
      };

      if (allDeps["react-scripts"]) return "Create React App";
      if (allDeps.vite || allDeps["@vitejs/plugin-react"]) return "Vite";
      if (allDeps.webpack) return "Webpack";
      if (allDeps.parcel) return "Parcel";
    }

    if (
      context.configFiles?.has("vite.config.js") ||
      context.configFiles?.has("vite.config.ts")
    ) {
      return "Vite";
    }

    if (context.configFiles?.has("webpack.config.js")) {
      return "Webpack";
    }

    return undefined;
  }

  private detectEntryPoints(context: DetectionContext): string[] {
    const entryPoints: string[] = [];

    // Check package.json main field
    if (context.packageJson?.main) {
      entryPoints.push(context.packageJson.main);
    }

    // Common React entry points
    const commonEntries = [
      "src/index.js",
      "src/index.ts",
      "src/index.jsx",
      "src/index.tsx",
    ];
    for (const entry of commonEntries) {
      if (context.fileStructure?.files.includes(entry.split("/").pop()!)) {
        entryPoints.push(entry);
      }
    }

    return entryPoints;
  }
}
