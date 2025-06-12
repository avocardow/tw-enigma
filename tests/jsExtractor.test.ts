import { describe, it, expect, beforeEach, vi } from "vitest";
import * as fs from "fs/promises";
import type { Stats } from "fs";
import {
  JsExtractor,
  createJsExtractor,
  extractClassesFromJs,
  extractClassesFromJsFile,
  JsParsingError,
  JsFileReadError,
  JsExtractionOptionsSchema,
} from "../src/jsExtractor.js";

// Mock fs module - ensure fs/promises is mocked correctly
vi.mock("fs/promises", () => ({
  stat: vi.fn(),
  readFile: vi.fn(),
}));

// Also mock the old style for compatibility
vi.mock("fs", () => ({
  promises: {
    stat: vi.fn(),
    readFile: vi.fn(),
  },
}));

const mockFs = vi.mocked(fs);

describe("JsExtractor", () => {
  let extractor: JsExtractor;

  beforeEach(() => {
    extractor = new JsExtractor();
    vi.clearAllMocks();
  });

  describe("Zod Schema Validation", () => {
    it("should validate default options", () => {
      const result = JsExtractionOptionsSchema.parse({});
      expect(result).toEqual({
        enableFrameworkDetection: true,
        includeDynamicClasses: true,
        caseSensitive: true,
        ignoreEmpty: true,
        maxFileSize: 10 * 1024 * 1024,
        timeout: 10000,
        supportedFrameworks: ["react", "preact", "solid", "vue", "angular"],
      });
    });

    it("should validate custom options", () => {
      const options = {
        enableFrameworkDetection: false,
        includeDynamicClasses: false,
        caseSensitive: false,
        timeout: 5000,
      };
      const result = JsExtractionOptionsSchema.parse(options);
      expect(result.enableFrameworkDetection).toBe(false);
      expect(result.includeDynamicClasses).toBe(false);
      expect(result.caseSensitive).toBe(false);
      expect(result.timeout).toBe(5000);
    });

    it("should reject invalid options", () => {
      expect(() => JsExtractionOptionsSchema.parse({ timeout: -1 })).toThrow();
      expect(() =>
        JsExtractionOptionsSchema.parse({ maxFileSize: 0 }),
      ).toThrow();
    });
  });

  describe("Framework Detection", () => {
    it("should detect React framework", async () => {
      const code = `
        import React from 'react';
        function Component() {
          return <div className="container">Hello</div>;
        }
      `;
      const result = await extractor.extractFromString(code);
      expect(result.framework).toBe("react");
    });

    it("should detect Preact framework", async () => {
      const code = `
        import { h } from 'preact';
        function Component() {
          return <div className="container">Hello</div>;
        }
      `;
      const result = await extractor.extractFromString(code);
      expect(result.framework).toBe("preact");
    });

    it("should detect Solid framework", async () => {
      const code = `
        import { createSignal } from 'solid-js';
        function Component() {
          return <div className="container">Hello</div>;
        }
      `;
      const result = await extractor.extractFromString(code);
      expect(result.framework).toBe("solid");
    });

    it("should detect Vue framework", async () => {
      const code = `
        import { defineComponent } from 'vue';
        export default defineComponent({
          template: '<div class="container">Hello</div>'
        });
      `;
      const result = await extractor.extractFromString(code);
      expect(result.framework).toBe("vue");
    });

    it("should detect Angular framework", async () => {
      const code = `
        import { Component } from '@angular/core';
        @Component({
          template: '<div class="container">Hello</div>'
        })
        export class MyComponent {}
      `;
      const result = await extractor.extractFromString(code);
      expect(result.framework).toBe("angular");
    });

    it("should default to React for JSX without imports", async () => {
      const code = `
        function Component() {
          return <div className="container">Hello</div>;
        }
      `;
      const result = await extractor.extractFromString(code);
      expect(result.framework).toBe("react");
    });

    it("should return unknown for non-framework JavaScript", async () => {
      const code = `
        const obj = { className: "container" };
        console.log(obj);
      `;
      const result = await extractor.extractFromString(code);
      expect(result.framework).toBe("unknown");
    });

    it("should skip framework detection when disabled", async () => {
      extractor = new JsExtractor({ enableFrameworkDetection: false });
      const code = `
        import React from 'react';
        function Component() {
          return <div className="container">Hello</div>;
        }
      `;
      const result = await extractor.extractFromString(code);
      expect(result.framework).toBe("unknown");
    });
  });

  describe("Static Class Extraction", () => {
    it("should extract className attributes", async () => {
      const code = `
        <div className="container flex items-center">
        <span className="text-red-500">Text</span>
      `;
      const result = await extractor.extractFromString(code);

      expect(result.classes.has("container")).toBe(true);
      expect(result.classes.has("flex")).toBe(true);
      expect(result.classes.has("items-center")).toBe(true);
      expect(result.classes.has("text-red-500")).toBe(true);
      expect(result.metadata.extractionStats.staticMatches).toBe(2);
    });

    it("should extract class attributes", async () => {
      const code = `
        <div class="container flex">
        <span class="text-blue-500">Text</span>
      `;
      const result = await extractor.extractFromString(code);

      expect(result.classes.has("container")).toBe(true);
      expect(result.classes.has("flex")).toBe(true);
      expect(result.classes.has("text-blue-500")).toBe(true);
    });

    it("should handle single quotes", async () => {
      const code = `<div className='container flex'>`;
      const result = await extractor.extractFromString(code);

      expect(result.classes.has("container")).toBe(true);
      expect(result.classes.has("flex")).toBe(true);
    });

    it("should handle backticks", async () => {
      const code = `<div className=\`container flex\`>`;
      const result = await extractor.extractFromString(code);

      expect(result.classes.has("container")).toBe(true);
      expect(result.classes.has("flex")).toBe(true);
    });

    it("should track line numbers and patterns", async () => {
      const code = `
        function Component() {
          return (
            <div className="container">
              <span className="text-red-500">Text</span>
            </div>
          );
        }
      `;
      const result = await extractor.extractFromString(code);

      const containerClass = result.classes.get("container");
      expect(containerClass?.contexts[0].lineNumber).toBe(4);
      expect(containerClass?.contexts[0].pattern).toContain(
        'className="container"',
      );
    });
  });

  describe("Template Literal Extraction", () => {
    it("should extract simple template literals", async () => {
      const code = `
        <div className={\`container flex\`}>
        <span className={\`text-red-500 font-bold\`}>
      `;
      const result = await extractor.extractFromString(code);

      expect(result.classes.has("container")).toBe(true);
      expect(result.classes.has("flex")).toBe(true);
      expect(result.classes.has("text-red-500")).toBe(true);
      expect(result.classes.has("font-bold")).toBe(true);
      expect(result.metadata.extractionStats.templateMatches).toBe(2);
    });

    it("should handle template literals with variables (static part only)", async () => {
      const code = `<div className={\`container \${variant} flex\`}>`;
      const result = await extractor.extractFromString(code);

      // Should only extract the static part before ${
      expect(result.classes.has("container")).toBe(true);
      expect(result.classes.has("flex")).toBe(false); // After ${, so not extracted
    });
  });

  describe("Utility Function Extraction", () => {
    it("should extract clsx function calls", async () => {
      const code = `
        const className = clsx("container flex", "text-red-500");
        const other = clsx('bg-blue-500', 'p-4');
      `;
      const result = await extractor.extractFromString(code);

      expect(result.classes.has("container")).toBe(true);
      expect(result.classes.has("flex")).toBe(true);
      expect(result.classes.has("text-red-500")).toBe(true);
      expect(result.classes.has("bg-blue-500")).toBe(true);
      expect(result.classes.has("p-4")).toBe(true);
      expect(result.metadata.extractionStats.utilityMatches).toBe(4);
    });

    it("should extract classnames function calls", async () => {
      const code = `
        const className = classnames("container", "flex");
      `;
      const result = await extractor.extractFromString(code);

      expect(result.classes.has("container")).toBe(true);
      expect(result.classes.has("flex")).toBe(true);
    });

    it("should extract cn function calls", async () => {
      const code = `
        const className = cn("container", "flex");
      `;
      const result = await extractor.extractFromString(code);

      expect(result.classes.has("container")).toBe(true);
      expect(result.classes.has("flex")).toBe(true);
    });
  });

  describe("Dynamic Expression Extraction", () => {
    it("should extract classes from simple expressions", async () => {
      const code = `
        <div className={isActive ? "active bg-green-500" : "inactive bg-gray-500"}>
        <span className={status === "error" ? "text-red-500" : "text-blue-500"}>
      `;
      const result = await extractor.extractFromString(code);

      expect(result.classes.has("active")).toBe(true);
      expect(result.classes.has("bg-green-500")).toBe(true);
      expect(result.classes.has("inactive")).toBe(true);
      expect(result.classes.has("bg-gray-500")).toBe(true);
      expect(result.classes.has("text-red-500")).toBe(true);
      expect(result.classes.has("text-blue-500")).toBe(true);
      expect(result.metadata.extractionStats.dynamicMatches).toBe(2);
    });

    it("should skip dynamic extraction when disabled", async () => {
      extractor = new JsExtractor({ includeDynamicClasses: false });
      const code = `<div className={isActive ? "active" : "inactive"}>`;
      const result = await extractor.extractFromString(code);

      expect(result.classes.has("active")).toBe(false);
      expect(result.classes.has("inactive")).toBe(false);
      expect(result.metadata.extractionStats.dynamicMatches).toBe(0);
    });
  });

  describe("Case Sensitivity", () => {
    it("should respect case sensitivity by default", async () => {
      const code = `
        <div className="Container container">
      `;
      const result = await extractor.extractFromString(code);

      expect(result.classes.has("Container")).toBe(true);
      expect(result.classes.has("container")).toBe(true);
      expect(result.classes.size).toBe(2);
    });

    it("should ignore case when disabled", async () => {
      extractor = new JsExtractor({ caseSensitive: false });
      const code = `
        <div className="Container container">
      `;
      const result = await extractor.extractFromString(code);

      expect(result.classes.has("container")).toBe(true);
      expect(result.classes.size).toBe(1);
      const classData = result.classes.get("container");
      expect(classData?.frequency).toBe(2);
    });
  });

  describe("Empty Class Handling", () => {
    it("should ignore empty classes by default", async () => {
      extractor = new JsExtractor({ ignoreEmpty: true });
      const code = `
        <div className="container  ">
        <span className="   text-red-500">
      `;
      const result = await extractor.extractFromString(code);

      expect(result.classes.has("container")).toBe(true);
      expect(result.classes.has("text-red-500")).toBe(true);
      expect(result.classes.has("")).toBe(false);
      expect(result.classes.has("   ")).toBe(false);
    });

    it("should include empty classes when configured", async () => {
      extractor = new JsExtractor({ ignoreEmpty: false });
      const code = `<div className="container  ">`;
      const result = await extractor.extractFromString(code);

      expect(result.classes.has("container")).toBe(true);
      expect(result.classes.has("")).toBe(true);
    });
  });

  describe("Class Frequency and Context", () => {
    it("should track class frequency", async () => {
      const code = `
        <div className="container">
        <span className="container">
        <p className="text-red-500 container">
      `;
      const result = await extractor.extractFromString(code);

      const containerClass = result.classes.get("container");
      expect(containerClass?.frequency).toBe(3);
      expect(containerClass?.contexts).toHaveLength(3);
    });

    it("should limit context entries to prevent memory issues", async () => {
      let code = "";
      for (let i = 0; i < 15; i++) {
        code += `<div className="container">\n`;
      }

      const result = await extractor.extractFromString(code);
      const containerClass = result.classes.get("container");
      expect(containerClass?.frequency).toBe(15);
      expect(containerClass?.contexts).toHaveLength(10); // Limited to 10
    });

    it("should include framework and extraction type in context", async () => {
      const code = `
        import React from 'react';
        <div className="container">
      `;
      const result = await extractor.extractFromString(code);

      const containerClass = result.classes.get("container");
      expect(containerClass?.contexts[0].framework).toBe("react");
      expect(containerClass?.contexts[0].extractionType).toBe("static");
    });
  });

  describe("Statistics and Metadata", () => {
    it("should provide comprehensive statistics", async () => {
      const code = `
        import React from 'react';
        function Component() {
          return (
            <div className="container">
              <span className={\`text-red-500\`}>
              <p className={condition ? "active" : "inactive"}>
              {clsx("utility-class")}
            </div>
          );
        }
      `;
      const result = await extractor.extractFromString(code);

      expect(result.framework).toBe("react");
      expect(result.totalMatches).toBeGreaterThan(0);
      expect(result.totalClasses).toBeGreaterThan(0);
      expect(result.uniqueClasses).toBe(result.classes.size);
      expect(result.metadata.source).toBe("string");
      expect(result.metadata.processedAt).toBeInstanceOf(Date);
      expect(result.metadata.processingTime).toBeGreaterThanOrEqual(0);
      expect(result.metadata.errors).toEqual([]);
      expect(result.metadata.extractionStats.staticMatches).toBeGreaterThan(0);
      expect(result.metadata.extractionStats.templateMatches).toBeGreaterThan(
        0,
      );
      expect(result.metadata.extractionStats.dynamicMatches).toBeGreaterThan(0);
      expect(result.metadata.extractionStats.utilityMatches).toBeGreaterThan(0);
    });
  });

  describe("Error Handling", () => {
    it("should handle parsing errors gracefully", async () => {
      const code = null as unknown as string;

      await expect(extractor.extractFromString(code)).rejects.toThrow(
        JsParsingError,
      );
    });

    it("should include error details in metadata on failure", async () => {
      try {
        await extractor.extractFromString(null as unknown as string);
      } catch (error) {
        expect(error).toBeInstanceOf(JsParsingError);
        expect((error as JsParsingError).source).toBe("string");
      }
    });
  });

  describe("File Operations", () => {
    beforeEach(() => {
      mockFs.stat.mockResolvedValue({ size: 1000 } as Stats);
      mockFs.readFile.mockResolvedValue('const className = "container";');
    });

    it("should extract classes from file", async () => {
      const result = await extractor.extractFromFile("test.js");

      expect(result.classes.has("container")).toBe(true);
      expect(result.metadata.source).toBe("test.js");
      expect(result.metadata.fileSize).toBe(1000);
      expect(mockFs.stat).toHaveBeenCalledWith("test.js");
      expect(mockFs.readFile).toHaveBeenCalledWith("test.js", "utf8");
    });

    it("should reject files that are too large", async () => {
      mockFs.stat.mockResolvedValue({ size: 20 * 1024 * 1024 } as Stats); // 20MB

      await expect(extractor.extractFromFile("large.js")).rejects.toThrow(
        JsFileReadError,
      );
    });

    it("should handle file read errors", async () => {
      mockFs.stat.mockRejectedValue(new Error("File not found"));

      await expect(extractor.extractFromFile("missing.js")).rejects.toThrow(
        JsFileReadError,
      );
    });

    it("should process multiple files", async () => {
      mockFs.readFile
        .mockResolvedValueOnce('const a = "class-a";')
        .mockResolvedValueOnce('const b = "class-b";');

      const results = await extractor.extractFromFiles([
        "file1.js",
        "file2.js",
      ]);

      expect(results).toHaveLength(2);
      expect(results[0].classes.has("class-a")).toBe(true);
      expect(results[1].classes.has("class-b")).toBe(true);
    });

    it("should handle file errors in batch processing", async () => {
      mockFs.readFile
        .mockResolvedValueOnce('const a = "class-a";')
        .mockRejectedValueOnce(new Error("Read error"));

      const results = await extractor.extractFromFiles([
        "file1.js",
        "file2.js",
      ]);

      expect(results).toHaveLength(2);
      expect(results[0].classes.has("class-a")).toBe(true);
      expect(results[1].classes.size).toBe(0);
      expect(results[1].metadata.errors).toHaveLength(1);
    });
  });

  describe("Timeout Handling", () => {
    it("should handle file read timeout", async () => {
      extractor = new JsExtractor({ timeout: 100 });

      // Mock file stat to return a valid size
      mockFs.stat.mockResolvedValue({ size: 1000 } as Stats);

      // Mock a slow file read that exceeds timeout
      mockFs.readFile.mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve("test"), 200)),
      );

      await expect(extractor.extractFromFile("slow.js")).rejects.toThrow(
        /timeout|Failed to read file/i,
      );
    });
  });

  describe("Complex Integration Tests", () => {
    it("should handle complex React component", async () => {
      const code = `
        import React, { useState } from 'react';
        import clsx from 'clsx';
        
        export default function Button({ variant = 'primary', size = 'md', disabled = false, children }) {
          const [isPressed, setIsPressed] = useState(false);
          
          const baseClasses = "inline-flex items-center justify-center font-medium rounded-md transition-colors";
          const variantClasses = {
            primary: "bg-blue-600 text-white hover:bg-blue-700",
            secondary: "bg-gray-200 text-gray-900 hover:bg-gray-300",
            outline: "border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
          };
          const sizeClasses = {
            sm: "px-3 py-1.5 text-sm",
            md: "px-4 py-2 text-base",
            lg: "px-6 py-3 text-lg"
          };
          
          return (
            <button
              className={clsx(
                baseClasses,
                variantClasses[variant],
                sizeClasses[size],
                disabled && "opacity-50 cursor-not-allowed",
                isPressed && "transform scale-95"
              )}
              disabled={disabled}
              onMouseDown={() => setIsPressed(true)}
              onMouseUp={() => setIsPressed(false)}
            >
              {children}
            </button>
          );
        }
      `;

      const result = await extractor.extractFromString(code);

      expect(result.framework).toBe("react");
      expect(result.classes.has("inline-flex")).toBe(true);
      expect(result.classes.has("items-center")).toBe(true);
      expect(result.classes.has("bg-blue-600")).toBe(true);
      expect(result.classes.has("text-white")).toBe(true);
      expect(result.classes.has("opacity-50")).toBe(true);
      expect(result.classes.has("cursor-not-allowed")).toBe(true);
      expect(result.totalClasses).toBeGreaterThan(10);
      expect(result.metadata.extractionStats.staticMatches).toBeGreaterThan(0);
      expect(result.metadata.extractionStats.utilityMatches).toBeGreaterThan(0);
      expect(result.metadata.extractionStats.dynamicMatches).toBeGreaterThan(0);
    });
  });
});

describe("Factory Functions", () => {
  it("should create extractor with createJsExtractor", () => {
    const extractor = createJsExtractor({ caseSensitive: false });
    expect(extractor).toBeInstanceOf(JsExtractor);
  });

  it("should extract classes with convenience function", async () => {
    const code = '<div className="container">Test</div>';
    const result = await extractClassesFromJs(code);

    expect(result.classes.has("container")).toBe(true);
  });

  it("should extract classes from file with convenience function", async () => {
    const mockFs = vi.mocked(fs);
    mockFs.stat.mockResolvedValue({ size: 100 } as Stats);
    mockFs.readFile.mockResolvedValue('<div className="container">Test</div>');

    const result = await extractClassesFromJsFile("test.js");

    expect(result.classes.has("container")).toBe(true);
  });
});
