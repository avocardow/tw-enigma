import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as fs from "fs/promises";
import type { Stats } from "fs";
import {
  HtmlExtractor,
  createHtmlExtractor,
  extractClassesFromHtml,
  extractClassesFromFile,
  HtmlParsingError,
  FileReadError,
  type HtmlExtractionOptions,
} from "../src/htmlExtractor.js";

// Mock fs module
vi.mock("fs/promises");
const mockFs = vi.mocked(fs);

describe("HtmlExtractor", () => {
  let extractor: HtmlExtractor;

  beforeEach(() => {
    extractor = new HtmlExtractor();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("Constructor and Options", () => {
    it("should create extractor with default options", () => {
      const extractor = new HtmlExtractor();
      expect(extractor).toBeInstanceOf(HtmlExtractor);
    });

    it("should create extractor with custom options", () => {
      const options: Partial<HtmlExtractionOptions> = {
        caseSensitive: false,
        ignoreEmpty: false,
        maxFileSize: 5000000,
        timeout: 3000,
      };
      const extractor = new HtmlExtractor(options);
      expect(extractor).toBeInstanceOf(HtmlExtractor);
    });

    it("should validate options schema", () => {
      expect(() => new HtmlExtractor({ maxFileSize: -1 })).toThrow();
      expect(() => new HtmlExtractor({ timeout: -1 })).toThrow();
    });
  });

  describe("extractFromString", () => {
    it("should extract classes from simple HTML", async () => {
      const html =
        '<div class="container"><p class="text-blue-500">Hello</p></div>';

      const result = await extractor.extractFromString(html);

      expect(result.uniqueClasses).toBe(2);
      expect(result.totalElements).toBe(2);
      expect(result.totalClasses).toBe(2);
      expect(result.classes.has("container")).toBe(true);
      expect(result.classes.has("text-blue-500")).toBe(true);
      expect(result.metadata.source).toBe("string");
      expect(result.metadata.errors).toEqual([]);
    });

    it("should handle multiple classes on single element", async () => {
      const html =
        '<div class="flex justify-center items-center bg-red-500">Content</div>';

      const result = await extractor.extractFromString(html);

      expect(result.uniqueClasses).toBe(4);
      expect(result.totalClasses).toBe(4);
      expect(result.classes.has("flex")).toBe(true);
      expect(result.classes.has("justify-center")).toBe(true);
      expect(result.classes.has("items-center")).toBe(true);
      expect(result.classes.has("bg-red-500")).toBe(true);
    });

    it("should handle class frequency counting", async () => {
      const html = `
        <div class="container">
          <p class="text">First</p>
          <p class="text">Second</p>
          <span class="container">Nested</span>
        </div>
      `;

      const result = await extractor.extractFromString(html);

      expect(result.classes.get("container")?.frequency).toBe(2);
      expect(result.classes.get("text")?.frequency).toBe(2);
    });

    it("should capture element context information", async () => {
      const html =
        '<div id="main" class="container" data-test="value">Content</div>';

      const result = await extractor.extractFromString(html);

      const containerClass = result.classes.get("container");
      expect(containerClass?.contexts).toHaveLength(1);
      expect(containerClass?.contexts[0].tagName).toBe("div");
      expect(containerClass?.contexts[0].attributes.id).toBe("main");
      expect(containerClass?.contexts[0].attributes["data-test"]).toBe("value");
      expect(containerClass?.contexts[0].depth).toBeGreaterThanOrEqual(0);
    });

    it("should calculate element depth correctly", async () => {
      const html = `
        <div class="level-0">
          <div class="level-1">
            <div class="level-2">
              <span class="level-3">Deep</span>
            </div>
          </div>
        </div>
      `;

      const result = await extractor.extractFromString(html);

      expect(result.classes.get("level-3")?.contexts[0].depth).toBe(3);
      expect(result.classes.get("level-2")?.contexts[0].depth).toBe(2);
      expect(result.classes.get("level-1")?.contexts[0].depth).toBe(1);
      expect(result.classes.get("level-0")?.contexts[0].depth).toBe(0);
    });

    it("should handle case sensitivity option", async () => {
      const html = '<div class="Container TEXT-BLUE">Content</div>';

      // Case sensitive (default)
      const resultSensitive = await extractor.extractFromString(html);
      expect(resultSensitive.classes.has("Container")).toBe(true);
      expect(resultSensitive.classes.has("TEXT-BLUE")).toBe(true);

      // Case insensitive
      const insensitiveExtractor = new HtmlExtractor({ caseSensitive: false });
      const resultInsensitive =
        await insensitiveExtractor.extractFromString(html);
      expect(resultInsensitive.classes.has("container")).toBe(true);
      expect(resultInsensitive.classes.has("text-blue")).toBe(true);
    });

    it("should handle empty and whitespace classes", async () => {
      const html = '<div class="  valid   empty    another  ">Content</div>';

      const result = await extractor.extractFromString(html);

      expect(result.classes.has("valid")).toBe(true);
      expect(result.classes.has("another")).toBe(true);
      expect(result.classes.has("")).toBe(false);
      expect(result.classes.has(" ")).toBe(false);
    });

    it("should handle ignoreEmpty option", async () => {
      const html = '<div class="  valid     ">Content</div>';

      // Ignore empty (default)
      const resultIgnore = await extractor.extractFromString(html);
      expect(resultIgnore.uniqueClasses).toBe(1);

      // Don't ignore empty
      const keepEmptyExtractor = new HtmlExtractor({ ignoreEmpty: false });
      const resultKeep = await keepEmptyExtractor.extractFromString(html);
      expect(resultKeep.uniqueClasses).toBeGreaterThanOrEqual(1);
    });

    it("should handle malformed HTML gracefully", async () => {
      const html =
        '<div class="test"><p class="broken">Unclosed<span class="nested">Content';

      const result = await extractor.extractFromString(html);

      expect(result.classes.has("test")).toBe(true);
      expect(result.classes.has("broken")).toBe(true);
      expect(result.classes.has("nested")).toBe(true);
      expect(result.metadata.errors).toEqual([]);
    });

    it("should handle special characters in class names", async () => {
      const html =
        '<div class="class-with-dashes class_with_underscores class:with:colons class.with.dots">Content</div>';

      const result = await extractor.extractFromString(html);

      expect(result.classes.has("class-with-dashes")).toBe(true);
      expect(result.classes.has("class_with_underscores")).toBe(true);
      expect(result.classes.has("class:with:colons")).toBe(true);
      expect(result.classes.has("class.with.dots")).toBe(true);
    });

    it("should handle elements without class attributes", async () => {
      const html =
        '<div><p>No classes here</p><span id="test">Still no classes</span></div>';

      const result = await extractor.extractFromString(html);

      expect(result.uniqueClasses).toBe(0);
      expect(result.totalElements).toBe(0);
      expect(result.totalClasses).toBe(0);
    });

    it("should handle empty HTML", async () => {
      const result = await extractor.extractFromString("");

      expect(result.uniqueClasses).toBe(0);
      expect(result.totalElements).toBe(0);
      expect(result.totalClasses).toBe(0);
    });

    it("should handle HTML with only whitespace", async () => {
      const result = await extractor.extractFromString("   \n\t   ");

      expect(result.uniqueClasses).toBe(0);
      expect(result.totalElements).toBe(0);
      expect(result.totalClasses).toBe(0);
    });

    it("should measure processing time", async () => {
      const html = '<div class="test">Content</div>';

      const result = await extractor.extractFromString(html);

      expect(result.metadata.processingTime).toBeGreaterThanOrEqual(0);
      expect(typeof result.metadata.processingTime).toBe("number");
    });

    it("should sanitize sensitive attributes", async () => {
      const html =
        '<div class="test" password="secret" token="abc123" id="safe" data-public="ok">Content</div>';

      const result = await extractor.extractFromString(html);

      const testClass = result.classes.get("test");
      expect(testClass?.contexts[0].attributes).not.toHaveProperty("password");
      expect(testClass?.contexts[0].attributes).not.toHaveProperty("token");
      expect(testClass?.contexts[0].attributes).toHaveProperty("id");
      expect(testClass?.contexts[0].attributes).toHaveProperty("data-public");
    });

    it("should limit context collection to prevent memory issues", async () => {
      let html = "";
      for (let i = 0; i < 20; i++) {
        html += `<div class="repeated">Item ${i}</div>`;
      }

      const result = await extractor.extractFromString(html);

      const repeatedClass = result.classes.get("repeated");
      expect(repeatedClass?.frequency).toBe(20);
      expect(repeatedClass?.contexts.length).toBeLessThanOrEqual(10);
    });
  });

  describe("extractFromFile", () => {
    beforeEach(() => {
      // Mock file system operations
      mockFs.stat = vi.fn();
      mockFs.readFile = vi.fn();
    });

    it("should extract classes from file", async () => {
      const html = '<div class="file-test">Content</div>';

      mockFs.stat.mockResolvedValue({ size: 1000 } as Stats);
      mockFs.readFile.mockResolvedValue(html);

      const result = await extractor.extractFromFile("/test.html");

      expect(result.classes.has("file-test")).toBe(true);
      expect(result.metadata.source).toBe("/test.html");
      expect(result.metadata.fileSize).toBe(1000);
    });

    it("should reject files exceeding size limit", async () => {
      mockFs.stat.mockResolvedValue({ size: 20 * 1024 * 1024 } as Stats); // 20MB

      await expect(extractor.extractFromFile("/large.html")).rejects.toThrow(
        FileReadError,
      );
    });

    it("should handle file read errors", async () => {
      mockFs.stat.mockResolvedValue({ size: 1000 } as Stats);
      mockFs.readFile.mockRejectedValue(new Error("File not found"));

      await expect(
        extractor.extractFromFile("/nonexistent.html"),
      ).rejects.toThrow(FileReadError);
    });

    it("should handle file stat errors", async () => {
      mockFs.stat.mockRejectedValue(new Error("Permission denied"));

      await expect(
        extractor.extractFromFile("/forbidden.html"),
      ).rejects.toThrow(FileReadError);
    });

    it("should handle timeout for large files", async () => {
      const shortTimeoutExtractor = new HtmlExtractor({ timeout: 100 });

      mockFs.stat.mockResolvedValue({ size: 1000 } as Stats);
      mockFs.readFile.mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(() => resolve("<div>Content</div>"), 200),
          ),
      );

      await expect(
        shortTimeoutExtractor.extractFromFile("/slow.html"),
      ).rejects.toThrow("timeout");
    });
  });

  describe("extractFromFiles", () => {
    beforeEach(() => {
      mockFs.stat = vi.fn();
      mockFs.readFile = vi.fn();
    });

    it("should extract from multiple files", async () => {
      const files = ["/file1.html", "/file2.html"];

      mockFs.stat.mockResolvedValue({ size: 1000 } as Stats);
      mockFs.readFile
        .mockResolvedValueOnce('<div class="file1">Content 1</div>')
        .mockResolvedValueOnce('<div class="file2">Content 2</div>');

      const results = await extractor.extractFromFiles(files);

      expect(results).toHaveLength(2);
      expect(results[0].classes.has("file1")).toBe(true);
      expect(results[1].classes.has("file2")).toBe(true);
    });

    it("should handle mixed success and failure", async () => {
      const files = ["/good.html", "/bad.html"];

      mockFs.stat.mockResolvedValue({ size: 1000 } as Stats);
      mockFs.readFile
        .mockResolvedValueOnce('<div class="good">Content</div>')
        .mockRejectedValueOnce(new Error("Bad file"));

      const results = await extractor.extractFromFiles(files);

      expect(results).toHaveLength(2);
      expect(results[0].classes.has("good")).toBe(true);
      expect(results[1].metadata.errors).toHaveLength(1);
    });

    it("should handle empty file list", async () => {
      const results = await extractor.extractFromFiles([]);

      expect(results).toHaveLength(0);
    });
  });

  describe("Error Handling", () => {
    it("should throw HtmlParsingError for invalid HTML processing", async () => {
      // Mock cheerio to throw an error
      const invalidHtml = '<div class="test">Content</div>';

      // Since cheerio is quite robust, we need to create a scenario where it might fail
      // For this test, we'll assume extremely malformed input that could cause issues
      vi.spyOn(
        extractor as unknown as { parseClassAttribute: () => void },
        "parseClassAttribute",
      ).mockImplementation(() => {
        throw new Error("Mocked parsing error");
      });

      await expect(extractor.extractFromString(invalidHtml)).rejects.toThrow(
        HtmlParsingError,
      );
    });

    it("should include error context in HtmlParsingError", async () => {
      vi.spyOn(
        extractor as unknown as { parseClassAttribute: () => void },
        "parseClassAttribute",
      ).mockImplementation(() => {
        throw new Error("Mocked error");
      });

      try {
        await extractor.extractFromString('<div class="test">Content</div>');
      } catch (error) {
        expect(error).toBeInstanceOf(HtmlParsingError);
        expect((error as HtmlParsingError).source).toBe("string");
        expect((error as HtmlParsingError).cause).toBeInstanceOf(Error);
      }
    });

    it("should include file path in FileReadError", async () => {
      mockFs.stat.mockRejectedValue(new Error("Not found"));

      try {
        await extractor.extractFromFile("/missing.html");
      } catch (error) {
        expect(error).toBeInstanceOf(FileReadError);
        expect((error as FileReadError).filePath).toBe("/missing.html");
      }
    });
  });

  describe("Convenience Functions", () => {
    it("should create extractor with createHtmlExtractor", () => {
      const extractor = createHtmlExtractor({ caseSensitive: false });
      expect(extractor).toBeInstanceOf(HtmlExtractor);
    });

    it("should extract from HTML string with convenience function", async () => {
      const result = await extractClassesFromHtml(
        '<div class="convenience">Test</div>',
      );

      expect(result.classes.has("convenience")).toBe(true);
    });

    it("should extract from file with convenience function", async () => {
      mockFs.stat.mockResolvedValue({ size: 1000 } as Stats);
      mockFs.readFile.mockResolvedValue(
        '<div class="file-convenience">Test</div>',
      );

      const result = await extractClassesFromFile("/test.html");

      expect(result.classes.has("file-convenience")).toBe(true);
    });
  });

  describe("Edge Cases and Performance", () => {
    it("should handle very large HTML documents", async () => {
      // Generate large HTML with many classes
      let html = "<html><body>";
      for (let i = 0; i < 1000; i++) {
        html += `<div class="class-${i} common-class">Content ${i}</div>`;
      }
      html += "</body></html>";

      const result = await extractor.extractFromString(html);

      expect(result.totalElements).toBe(1000);
      expect(result.classes.get("common-class")?.frequency).toBe(1000);
      expect(result.uniqueClasses).toBe(1001); // 1000 unique + 1 common
    });

    it("should handle HTML with deeply nested elements", async () => {
      let html = "";
      let closeHtml = "";

      for (let i = 0; i < 100; i++) {
        html += `<div class="level-${i}">`;
        closeHtml = "</div>" + closeHtml;
      }
      html += "Deep content" + closeHtml;

      const result = await extractor.extractFromString(html);

      expect(result.totalElements).toBe(100);
      expect(result.classes.get("level-99")?.contexts[0].depth).toBe(99);
    });

    it("should handle HTML with no class attributes efficiently", async () => {
      let html = "<html><body>";
      for (let i = 0; i < 10000; i++) {
        html += `<div id="item-${i}">Content ${i}</div>`;
      }
      html += "</body></html>";

      const startTime = Date.now();
      const result = await extractor.extractFromString(html);
      const endTime = Date.now();

      expect(result.totalElements).toBe(0);
      expect(result.uniqueClasses).toBe(0);
      expect(endTime - startTime).toBeLessThan(1000); // Should be fast
    });

    it("should handle Unicode and international characters in class names", async () => {
      const html =
        '<div class="测试-class класс-тест 日本語-クラス">Content</div>';

      const result = await extractor.extractFromString(html);

      expect(result.classes.has("测试-class")).toBe(true);
      expect(result.classes.has("класс-тест")).toBe(true);
      expect(result.classes.has("日本語-クラス")).toBe(true);
    });

    it("should preserve whitespace when configured", async () => {
      const html = '<div class="  spaced   class  ">Content</div>';

      const preserveWhitespaceExtractor = new HtmlExtractor({
        preserveWhitespace: true,
        ignoreEmpty: false,
      });

      const result = await preserveWhitespaceExtractor.extractFromString(html);

      // Should include empty strings and preserve spaces
      expect(result.totalClasses).toBeGreaterThan(2);
    });
  });
});
