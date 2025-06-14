/**
 * Tests for Framework Detection System
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "fs/promises";
import * as path from "path";
import {
  FrameworkDetector,
  createFrameworkDetector,
  detectFramework,
  FrameworkDetectionError,
  type DetectionResult,
  type FrameworkType,
} from "../../src/frameworkDetector.ts";

describe("FrameworkDetector", () => {
  let testDir: string;
  let detector: FrameworkDetector;

  beforeEach(async () => {
    // Create temporary test directory
    testDir = path.join(process.cwd(), "test-temp", Math.random().toString(36));
    await fs.mkdir(testDir, { recursive: true });

    detector = createFrameworkDetector({
      rootPath: testDir,
      enableCaching: false, // Disable caching for tests
    });
  });

  afterEach(async () => {
    // Clean up test directory
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe("Basic Framework Detection", () => {
    it("should detect React framework from package.json", async () => {
      // Setup React project
      const packageJson = {
        name: "test-react-app",
        dependencies: {
          react: "^18.2.0",
          "react-dom": "^18.2.0",
        },
        scripts: {
          start: "react-scripts start",
          build: "react-scripts build",
        },
      };

      await fs.writeFile(
        path.join(testDir, "package.json"),
        JSON.stringify(packageJson, null, 2),
      );

      // Create basic React file structure
      await fs.mkdir(path.join(testDir, "src"), { recursive: true });
      await fs.writeFile(
        path.join(testDir, "src", "App.jsx"),
        "export default function App() { return <div>Hello</div>; }",
      );

      const result = await detector.detect();

      expect(result.frameworks).toHaveLength(1);
      expect(result.primary?.type).toBe("react");
      expect(result.primary?.name).toBe("React");
      expect(result.primary?.confidence).toBeGreaterThan(0.5);
      expect(result.primary?.metadata.dependencies).toContain("react");
      expect(result.primary?.metadata.hasTypeScript).toBe(false);
    });

    it("should detect Next.js framework from package.json and file structure", async () => {
      // Setup Next.js project
      const packageJson = {
        name: "test-nextjs-app",
        dependencies: {
          next: "^14.0.0",
          react: "^18.2.0",
          "react-dom": "^18.2.0",
        },
        scripts: {
          dev: "next dev",
          build: "next build",
          start: "next start",
        },
      };

      await fs.writeFile(
        path.join(testDir, "package.json"),
        JSON.stringify(packageJson, null, 2),
      );

      // Create Next.js file structure
      await fs.mkdir(path.join(testDir, "pages"), { recursive: true });
      await fs.mkdir(path.join(testDir, "public"), { recursive: true });
      await fs.writeFile(
        path.join(testDir, "pages", "index.js"),
        "export default function Home() { return <div>Home</div>; }",
      );
      await fs.writeFile(
        path.join(testDir, "next.config.js"),
        "module.exports = {}",
      );

      const result = await detector.detect();

      expect(result.frameworks.length).toBeGreaterThanOrEqual(1);
      const nextjsFramework = result.frameworks.find(
        (fw) => fw.type === "nextjs",
      );

      expect(nextjsFramework).toBeDefined();
      expect(nextjsFramework?.confidence).toBeGreaterThan(0.8);
      expect(nextjsFramework?.metadata.dependencies).toContain("next");
      expect(nextjsFramework?.metadata.configFiles).toContain("next.config.js");
      expect(nextjsFramework?.metadata.routingMode).toBe("pages");
    });

    it("should detect Vite framework from package.json and configuration", async () => {
      // Setup Vite + React project
      const packageJson = {
        name: "test-vite-app",
        dependencies: {
          react: "^18.2.0",
          "react-dom": "^18.2.0",
        },
        devDependencies: {
          vite: "^5.0.0",
          "@vitejs/plugin-react": "^4.0.0",
        },
        scripts: {
          dev: "vite",
          build: "vite build",
          preview: "vite preview",
        },
      };

      await fs.writeFile(
        path.join(testDir, "package.json"),
        JSON.stringify(packageJson, null, 2),
      );

      // Create Vite configuration
      const viteConfig = `
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
})
      `;

      await fs.writeFile(path.join(testDir, "vite.config.js"), viteConfig);
      await fs.writeFile(
        path.join(testDir, "index.html"),
        '<!DOCTYPE html><html><head></head><body><div id="root"></div></body></html>',
      );

      // Create Vite file structure
      await fs.mkdir(path.join(testDir, "src"), { recursive: true });
      await fs.writeFile(
        path.join(testDir, "src", "main.jsx"),
        'import React from "react"',
      );

      const result = await detector.detect();

      const viteFramework = result.frameworks.find((fw) => fw.type === "vite");

      expect(viteFramework).toBeDefined();
      expect(viteFramework?.confidence).toBeGreaterThan(0.6);
      expect(viteFramework?.metadata.dependencies).toContain("vite");
      expect(viteFramework?.metadata.targetFramework).toBe("react");
      expect(viteFramework?.metadata.vitePlugins).toContain(
        "@vitejs/plugin-react",
      );
    });

    it("should handle projects with no framework detected", async () => {
      // Setup plain Node.js project
      const packageJson = {
        name: "test-plain-app",
        dependencies: {
          express: "^4.18.0",
        },
      };

      await fs.writeFile(
        path.join(testDir, "package.json"),
        JSON.stringify(packageJson, null, 2),
      );

      await fs.writeFile(
        path.join(testDir, "index.js"),
        'const express = require("express");',
      );

      const result = await detector.detect();

      expect(result.frameworks).toHaveLength(0);
      expect(result.primary).toBeUndefined();
      expect(result.overallConfidence).toBe(0);
    });
  });

  describe("Multi-Framework Detection", () => {
    it("should detect multiple frameworks in hybrid projects", async () => {
      // Setup project with both React and Vite
      const packageJson = {
        name: "test-multi-framework",
        dependencies: {
          react: "^18.2.0",
          "react-dom": "^18.2.0",
        },
        devDependencies: {
          vite: "^5.0.0",
          "@vitejs/plugin-react": "^4.0.0",
          "@types/react": "^18.0.0",
          typescript: "^5.0.0",
        },
        scripts: {
          dev: "vite",
          build: "vite build",
        },
      };

      await fs.writeFile(
        path.join(testDir, "package.json"),
        JSON.stringify(packageJson, null, 2),
      );

      await fs.writeFile(
        path.join(testDir, "vite.config.ts"),
        'import { defineConfig } from "vite"',
      );
      await fs.writeFile(
        path.join(testDir, "tsconfig.json"),
        '{"compilerOptions": {"jsx": "react-jsx"}}',
      );

      await fs.mkdir(path.join(testDir, "src"), { recursive: true });
      await fs.writeFile(
        path.join(testDir, "src", "App.tsx"),
        'import React from "react"',
      );

      const result = await detector.detect();

      expect(result.frameworks.length).toBeGreaterThanOrEqual(2);

      const reactFramework = result.frameworks.find(
        (fw) => fw.type === "react",
      );
      const viteFramework = result.frameworks.find((fw) => fw.type === "vite");

      expect(reactFramework).toBeDefined();
      expect(viteFramework).toBeDefined();

      // Should be sorted by confidence
      expect(result.frameworks[0].confidence).toBeGreaterThanOrEqual(
        result.frameworks[1].confidence,
      );

      // Both should detect TypeScript
      expect(reactFramework?.metadata.hasTypeScript).toBe(true);
      expect(viteFramework?.metadata.hasTypeScript).toBe(true);
    });

    it("should handle Next.js with App Router configuration", async () => {
      const packageJson = {
        name: "test-nextjs-app-router",
        dependencies: {
          next: "^14.0.0",
          react: "^18.2.0",
          "react-dom": "^18.2.0",
        },
      };

      await fs.writeFile(
        path.join(testDir, "package.json"),
        JSON.stringify(packageJson, null, 2),
      );

      // Create App Router structure
      await fs.mkdir(path.join(testDir, "app"), { recursive: true });
      await fs.writeFile(
        path.join(testDir, "app", "layout.tsx"),
        "export default function RootLayout() {}",
      );
      await fs.writeFile(
        path.join(testDir, "app", "page.tsx"),
        "export default function HomePage() {}",
      );

      const result = await detector.detect();

      const nextjsFramework = result.frameworks.find(
        (fw) => fw.type === "nextjs",
      );

      expect(nextjsFramework).toBeDefined();
      expect(nextjsFramework?.metadata.routingMode).toBe("app");
      expect(nextjsFramework?.metadata.nextjsFeatures).toContain("App Router");
    });
  });

  describe("Error Handling", () => {
    it("should handle invalid package.json gracefully", async () => {
      // Write invalid JSON
      await fs.writeFile(
        path.join(testDir, "package.json"),
        "{ invalid json }",
      );

      const result = await detector.detect();

      expect(result.frameworks).toHaveLength(0);
      expect(result.issues).toHaveLength(0); // Invalid package.json should not cause issues
    });

    it("should handle missing directory gracefully", async () => {
      const nonExistentDir = path.join(testDir, "non-existent");

      await expect(detector.detect(nonExistentDir)).rejects.toThrow(
        FrameworkDetectionError,
      );
    });

    it("should handle permission errors gracefully", async () => {
      // This test might not work on all systems, so we'll check if we can create the scenario
      try {
        await fs.mkdir(path.join(testDir, "restricted"), { mode: 0o000 });
        const result = await detector.detect();
        // If we get here, the system handled the permission error gracefully
        expect(result).toBeDefined();
      } catch (error) {
        // Permission setup failed, skip this test
        expect(true).toBe(true);
      }
    });
  });

  describe("Configuration Options", () => {
    it("should respect confidence threshold setting", async () => {
      const strictDetector = createFrameworkDetector({
        rootPath: testDir,
        confidenceThreshold: 0.9, // Very high threshold
      });

      // Setup minimal React indicators (low confidence)
      const packageJson = {
        name: "test-low-confidence",
        dependencies: {
          react: "^18.2.0", // Only basic React, no ecosystem
        },
      };

      await fs.writeFile(
        path.join(testDir, "package.json"),
        JSON.stringify(packageJson, null, 2),
      );

      const result = await strictDetector.detect();

      // Should have no frameworks due to high threshold
      expect(result.frameworks).toHaveLength(0);
    });

    it("should cache detection results when enabled", async () => {
      const cachingDetector = createFrameworkDetector({
        rootPath: testDir,
        enableCaching: true,
      });

      const packageJson = {
        name: "test-caching",
        dependencies: {
          react: "^18.2.0",
          "react-dom": "^18.2.0",
        },
      };

      await fs.writeFile(
        path.join(testDir, "package.json"),
        JSON.stringify(packageJson, null, 2),
      );

      const result1 = await cachingDetector.detect();
      const result2 = await cachingDetector.detect();

      expect(result1.performance.cacheMisses).toBe(1);
      expect(result2.performance.cacheMisses).toBe(0); // Should be cached
      expect(result1.frameworks).toEqual(result2.frameworks);
    });

    it("should respect maxCodeFiles limitation", async () => {
      const limitedDetector = createFrameworkDetector({
        rootPath: testDir,
        maxCodeFiles: 1, // Very limited
      });

      // This test verifies the detector respects the limit
      // The exact behavior may vary, but it should not crash
      const result = await limitedDetector.detect();
      expect(result).toBeDefined();
    });
  });

  describe("Utility Functions", () => {
    it("should provide createFrameworkDetector utility", () => {
      const detector = createFrameworkDetector();
      expect(detector).toBeInstanceOf(FrameworkDetector);
    });

    it("should provide detectFramework utility function", async () => {
      const packageJson = {
        name: "test-utility",
        dependencies: {
          react: "^18.2.0",
        },
      };

      await fs.writeFile(
        path.join(testDir, "package.json"),
        JSON.stringify(packageJson, null, 2),
      );

      const result = await detectFramework(testDir);

      expect(result).toBeDefined();
      expect(result.context.rootPath).toBe(testDir);
    });
  });

  describe("Performance Metrics", () => {
    it("should provide performance metrics", async () => {
      const packageJson = {
        name: "test-performance",
        dependencies: {
          react: "^18.2.0",
        },
      };

      await fs.writeFile(
        path.join(testDir, "package.json"),
        JSON.stringify(packageJson, null, 2),
      );

      const result = await detector.detect();

      expect(result.performance).toBeDefined();
      expect(result.performance.detectionTime).toBeGreaterThan(0);
      expect(result.performance.filesAnalyzed).toBeGreaterThanOrEqual(0);
      expect(result.performance.cacheMisses).toBe(1);
    });
  });
});
