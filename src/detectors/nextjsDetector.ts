/**
 * Next.js Framework Detector
 *
 * Detects Next.js framework usage through:
 * - Package.json dependencies (next package)
 * - Next.js specific file structure (pages/, app/ directories)
 * - Configuration files (next.config.js)
 * - Next.js specific imports and patterns
 */

import type {
  IFrameworkDetector,
  FrameworkInfo,
  DetectionContext,
  DetectionSource,
  FrameworkType,
} from "../frameworkDetector";

export class NextjsDetector implements IFrameworkDetector {
  readonly frameworkType: FrameworkType = "nextjs";
  readonly name = "Next.js Detector";

  canDetect(_context: DetectionContext): boolean {
    // Can always attempt Next.js detection
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
      nextjsFeatures: [],
      routingMode: "unknown",
    };

    // Check package.json dependencies
    if (context.packageJson) {
      const packageResults = this.analyzePackageJson(context.packageJson);
      if (packageResults.isNextjs) {
        sources.push({
          type: "package",
          description: "Next.js dependencies found in package.json",
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
      if (configResults.isNextjs) {
        sources.push({
          type: "config",
          description: "Next.js configuration found",
          confidence: configResults.confidence,
          evidence: configResults.evidence,
        });
        confidence += configResults.confidence;
        metadata.configFiles = configResults.configFiles;
      }
    }

    // Check file structure (most important for Next.js)
    if (context.fileStructure) {
      const fsResults = this.analyzeFileStructure(context.fileStructure);
      if (fsResults.isNextjs) {
        sources.push({
          type: "filesystem",
          description: "Next.js file structure detected",
          confidence: fsResults.confidence,
          evidence: fsResults.evidence,
        });
        confidence += fsResults.confidence;
        metadata.routingMode = fsResults.routingMode;
        metadata.nextjsFeatures = fsResults.features;
      }
    }

    // Check source patterns
    if (context.sourcePatterns) {
      const codeResults = this.analyzeSourcePatterns(context.sourcePatterns);
      if (codeResults.isNextjs) {
        sources.push({
          type: "code",
          description: "Next.js patterns found in source code",
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

    // Detect build system (always Next.js for Next.js projects)
    metadata.buildSystem = "Next.js";

    // Detect entry points
    metadata.entryPoints = this.detectEntryPoints(context);

    return {
      type: "nextjs",
      name: "Next.js",
      version,
      confidence: normalizedConfidence,
      sources,
      metadata,
    };
  }

  private analyzePackageJson(packageJson: any): {
    isNextjs: boolean;
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

    // Core Next.js package
    if (allDeps.next) {
      evidence.push("next dependency found");
      dependencies.push("next");
      confidence += 0.8; // High confidence for Next.js dependency
      version = allDeps.next;
    }

    // Next.js ecosystem packages
    const nextjsEcosystem = [
      "@next/bundle-analyzer",
      "@next/eslint-plugin-next",
      "eslint-config-next",
      "@next/font",
      "@next/mdx",
      "next-auth",
      "next-themes",
      "next-seo",
      "next-sitemap",
      "next-i18next",
      "next-pwa",
    ];

    let ecosystemCount = 0;
    for (const pkg of nextjsEcosystem) {
      if (allDeps[pkg]) {
        ecosystemCount++;
        dependencies.push(pkg);
        if (ecosystemCount <= 3) {
          evidence.push(`${pkg} found`);
        }
      }
    }

    if (ecosystemCount > 0) {
      confidence += Math.min(ecosystemCount * 0.05, 0.15);
    }

    // Check for Next.js scripts
    if (packageJson.scripts) {
      const scripts = packageJson.scripts;
      let scriptCount = 0;

      if (scripts.dev && scripts.dev.includes("next dev")) {
        evidence.push("next dev script found");
        scriptCount++;
      }

      if (scripts.build && scripts.build.includes("next build")) {
        evidence.push("next build script found");
        scriptCount++;
      }

      if (scripts.start && scripts.start.includes("next start")) {
        evidence.push("next start script found");
        scriptCount++;
      }

      if (scriptCount > 0) {
        confidence += scriptCount * 0.1;
      }
    }

    return {
      isNextjs: confidence > 0,
      confidence,
      version,
      evidence,
      dependencies,
    };
  }

  private analyzeConfigFiles(configFiles: Map<string, any>): {
    isNextjs: boolean;
    confidence: number;
    evidence: string[];
    configFiles: string[];
  } {
    const evidence: string[] = [];
    const foundConfigFiles: string[] = [];
    let confidence = 0;

    // Next.js configuration files
    const nextConfigs = ["next.config.js", "next.config.mjs", "next.config.ts"];

    for (const configFile of nextConfigs) {
      if (configFiles.has(configFile)) {
        evidence.push(`${configFile} found`);
        foundConfigFiles.push(configFile);
        confidence += 0.6; // High confidence for Next.js config
        break; // Only count one config file
      }
    }

    // TypeScript configuration with Next.js specific settings
    const tsConfig = configFiles.get("tsconfig.json");
    if (tsConfig) {
      const content = JSON.stringify(tsConfig);
      if (
        content.includes("next/core-web-vitals") ||
        content.includes("next") ||
        content.includes(".next")
      ) {
        evidence.push("Next.js TypeScript configuration found");
        foundConfigFiles.push("tsconfig.json");
        confidence += 0.2;
      }
    }

    // ESLint configuration with Next.js
    const eslintConfig =
      configFiles.get(".eslintrc.js") ||
      configFiles.get(".eslintrc.json") ||
      configFiles.get("eslint.config.js");
    if (eslintConfig) {
      const content = eslintConfig._rawContent || JSON.stringify(eslintConfig);
      if (
        content.includes("next/core-web-vitals") ||
        content.includes("@next/eslint-plugin-next")
      ) {
        evidence.push("Next.js ESLint configuration found");
        foundConfigFiles.push("eslint configuration");
        confidence += 0.15;
      }
    }

    return {
      isNextjs: confidence > 0,
      confidence,
      evidence,
      configFiles: foundConfigFiles,
    };
  }

  private analyzeFileStructure(fileStructure: {
    directories: string[];
    files: string[];
  }): {
    isNextjs: boolean;
    confidence: number;
    evidence: string[];
    routingMode: string;
    features: string[];
  } {
    const evidence: string[] = [];
    const features: string[] = [];
    let confidence = 0;
    let routingMode = "unknown";

    // Check for Next.js specific directories
    const hasPages = fileStructure.directories.includes("pages");
    const hasApp = fileStructure.directories.includes("app");
    const hasPublic = fileStructure.directories.includes("public");
    const hasApi = fileStructure.directories.includes("api");

    // Pages Router (traditional Next.js)
    if (hasPages) {
      evidence.push("pages directory found (Pages Router)");
      features.push("Pages Router");
      confidence += 0.7;
      routingMode = "pages";
    }

    // App Router (Next.js 13+)
    if (hasApp) {
      evidence.push("app directory found (App Router)");
      features.push("App Router");
      confidence += 0.7;
      routingMode = hasPages ? "hybrid" : "app";
    }

    // Public directory (common in Next.js)
    if (hasPublic) {
      evidence.push("public directory found");
      confidence += 0.2;
    }

    // API routes
    if (hasApi || hasPages) {
      // API routes can be in pages/api or app/api
      features.push("API Routes");
      confidence += 0.1;
    }

    // Next.js specific directories
    const nextjsDirs = ["components", "lib", "utils", "styles", "hooks"];
    let commonDirsCount = 0;
    for (const dir of nextjsDirs) {
      if (fileStructure.directories.includes(dir)) {
        commonDirsCount++;
      }
    }

    if (commonDirsCount >= 2) {
      evidence.push("Next.js common directories found");
      confidence += 0.1;
    }

    // Check for Next.js specific files
    const nextjsFiles = [
      "next-env.d.ts",
      "_app.js",
      "_app.tsx",
      "_document.js",
      "_document.tsx",
      "middleware.js",
      "middleware.ts",
      "layout.js",
      "layout.tsx",
      "page.js",
      "page.tsx",
      "loading.js",
      "loading.tsx",
      "error.js",
      "error.tsx",
      "not-found.js",
      "not-found.tsx",
    ];

    let nextjsFileCount = 0;
    for (const file of nextjsFiles) {
      if (fileStructure.files.includes(file)) {
        nextjsFileCount++;
        if (nextjsFileCount <= 3) {
          evidence.push(`${file} found`);
        }

        // Special handling for specific files
        if (file === "next-env.d.ts") {
          features.push("TypeScript");
        }
        if (file === "_app.js" || file === "_app.tsx") {
          features.push("Custom App Component");
        }
        if (file === "_document.js" || file === "_document.tsx") {
          features.push("Custom Document");
        }
        if (file === "middleware.js" || file === "middleware.ts") {
          features.push("Middleware");
        }
        if (file.includes("layout")) {
          features.push("Layout Components");
        }
      }
    }

    if (nextjsFileCount > 0) {
      confidence += Math.min(nextjsFileCount * 0.1, 0.3);
    }

    return {
      isNextjs: confidence > 0,
      confidence,
      evidence,
      routingMode,
      features,
    };
  }

  private analyzeSourcePatterns(sourcePatterns: string[]): {
    isNextjs: boolean;
    confidence: number;
    evidence: string[];
  } {
    const evidence: string[] = [];
    let confidence = 0;

    // Check for pages or app directories in patterns
    if (sourcePatterns.includes("pages")) {
      evidence.push("pages directory in source patterns");
      confidence += 0.3;
    }

    if (sourcePatterns.includes("app")) {
      evidence.push("app directory in source patterns");
      confidence += 0.3;
    }

    // JSX/TSX files (common in Next.js but not specific)
    if (sourcePatterns.includes("*.jsx") || sourcePatterns.includes("*.tsx")) {
      confidence += 0.1;
    }

    return {
      isNextjs: confidence > 0,
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

      if (
        allDeps.typescript ||
        allDeps["@types/node"] ||
        allDeps["@types/react"]
      ) {
        return true;
      }
    }

    // Check for next-env.d.ts
    if (context.fileStructure?.files.includes("next-env.d.ts")) {
      return true;
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

  private detectEntryPoints(context: DetectionContext): string[] {
    const entryPoints: string[] = [];

    // Next.js doesn't have traditional entry points as it's file-system based routing
    // But we can identify key files

    if (context.fileStructure?.files.includes("_app.js")) {
      entryPoints.push("pages/_app.js");
    }

    if (context.fileStructure?.files.includes("_app.tsx")) {
      entryPoints.push("pages/_app.tsx");
    }

    if (context.fileStructure?.files.includes("layout.js")) {
      entryPoints.push("app/layout.js");
    }

    if (context.fileStructure?.files.includes("layout.tsx")) {
      entryPoints.push("app/layout.tsx");
    }

    // Check for index pages
    if (context.fileStructure?.directories.includes("pages")) {
      entryPoints.push("pages/index");
    }

    if (context.fileStructure?.directories.includes("app")) {
      entryPoints.push("app/page");
    }

    return entryPoints;
  }
}
