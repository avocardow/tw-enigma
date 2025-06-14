import { describe, test, expect, beforeEach } from "vitest";
import {
  CssInjector,
  CssInjectionOptions,
  CssInjectionError,
  DuplicateInjectionError,
  PathCalculationError,
  HtmlStructureError,
  createCssInjector,
  validateInjectionRequest,
} from "../src/cssInjector.ts";

describe("CssInjector", () => {
  let injector: CssInjector;
  const defaultOptions: Partial<CssInjectionOptions> = {
    cssPath: "/styles/main.css",
    htmlPath: "/pages/index.html",
    useRelativePaths: true,
  };

  beforeEach(() => {
    injector = new CssInjector(defaultOptions);
  });

  describe("Constructor and Configuration", () => {
    test("should create instance with valid options", () => {
      expect(injector).toBeInstanceOf(CssInjector);
    });

    test("should validate required options", () => {
      expect(() => new CssInjector({})).toThrow(CssInjectionError);
      expect(() => new CssInjector({ cssPath: "" })).toThrow(CssInjectionError);
      expect(() => new CssInjector({ htmlPath: "" })).toThrow(
        CssInjectionError,
      );
    });

    test("should apply default options correctly", () => {
      const testInjector = new CssInjector({
        cssPath: "test.css",
        htmlPath: "test.html",
      });
      expect(testInjector).toBeInstanceOf(CssInjector);
    });

    test("should validate insert position values", () => {
      expect(
        () =>
          new CssInjector({
            cssPath: "test.css",
            htmlPath: "test.html",
            insertPosition: "invalid" as
              | "first"
              | "last"
              | "before-existing"
              | "after-meta",
          }),
      ).toThrow(CssInjectionError);
    });

    test("should validate duplicate strategy values", () => {
      expect(
        () =>
          new CssInjector({
            cssPath: "test.css",
            htmlPath: "test.html",
            duplicateStrategy: "invalid" as "skip" | "replace" | "error",
          }),
      ).toThrow(CssInjectionError);
    });
  });

  describe("HTML Document Structure Analysis", () => {
    test("should analyze simple HTML document", async () => {
      const html = `
        <!DOCTYPE html>
        <html>
          <head>
            <title>Test</title>
            <meta charset="utf-8">
          </head>
          <body>
            <h1>Hello</h1>
          </body>
        </html>
      `;

      const result = await injector.injectIntoString(html);

      expect(result.success).toBe(true);
      expect(result.documentStructure.hasHead).toBe(true);
      expect(result.documentStructure.hasBody).toBe(true);
      expect(result.documentStructure.doctype).toBe("<!DOCTYPE html>");
      expect(result.documentStructure.metaTags).toHaveLength(1);
      expect(result.documentStructure.metaTags[0].content).toBe("utf-8");
    });

    test("should detect existing stylesheets", async () => {
      const html = `
        <html>
          <head>
            <link rel="stylesheet" href="existing.css">
            <link rel="stylesheet" href="another.css" type="text/css">
          </head>
          <body></body>
        </html>
      `;

      const result = await injector.injectIntoString(html);

      expect(result.documentStructure.existingLinks).toHaveLength(2);
      expect(result.documentStructure.existingLinks[0].href).toBe(
        "existing.css",
      );
      expect(result.documentStructure.existingLinks[1].href).toBe(
        "another.css",
      );
    });

    test("should detect existing style tags", async () => {
      const html = `
        <html>
          <head>
            <style>body { margin: 0; }</style>
            <style type="text/css" media="print">@page { margin: 0; }</style>
          </head>
          <body></body>
        </html>
      `;

      const result = await injector.injectIntoString(html);

      expect(result.documentStructure.existingStyles).toHaveLength(2);
      expect(result.documentStructure.existingStyles[0].content).toBe(
        "body { margin: 0; }",
      );
      expect(result.documentStructure.existingStyles[1].media).toBe("print");
    });

    test("should detect indentation patterns - spaces", async () => {
      const html = `
<!DOCTYPE html>
<html>
  <head>
    <title>Test</title>
  </head>
  <body>
    <h1>Hello</h1>
  </body>
</html>
      `;

      const result = await injector.injectIntoString(html);

      expect(result.documentStructure.indentationPattern.type).toBe("spaces");
      expect(result.documentStructure.indentationPattern.size).toBe(2);
      expect(result.documentStructure.indentationPattern.consistent).toBe(true);
    });

    test("should detect indentation patterns - tabs", async () => {
      const html = `
<!DOCTYPE html>
<html>
\t<head>
\t\t<title>Test</title>
\t</head>
\t<body>
\t\t<h1>Hello</h1>
\t</body>
</html>
      `;

      const result = await injector.injectIntoString(html);

      expect(result.documentStructure.indentationPattern.type).toBe("tabs");
      expect(result.documentStructure.indentationPattern.size).toBe(1);
    });

    test("should handle documents without head", async () => {
      const testInjector = new CssInjector({
        cssPath: "test.css",
        htmlPath: "test.html",
        createHeadIfMissing: true,
      });

      const html = "<body><h1>Hello</h1></body>";
      const result = await testInjector.injectIntoString(html);

      expect(result.success).toBe(true);
      expect(result.html).toContain("<head>");
      expect(result.html).toContain("<link");
    });

    test("should throw error for documents without head when createHeadIfMissing is false", async () => {
      const testInjector = new CssInjector({
        cssPath: "test.css",
        htmlPath: "test.html",
        createHeadIfMissing: false,
      });

      const html = "<body><h1>Hello</h1></body>";

      await expect(testInjector.injectIntoString(html)).rejects.toThrow(
        HtmlStructureError,
      );
    });
  });

  describe("Link Tag Injection", () => {
    test("should inject CSS link with default settings", async () => {
      const html = `
        <html>
          <head>
            <title>Test</title>
          </head>
          <body></body>
        </html>
      `;

      const result = await injector.injectIntoString(html);

      expect(result.success).toBe(true);
      expect(result.html).toContain(
        '<link rel="stylesheet" type="text/css" href="../styles/main.css">',
      );
    });

    test("should inject at first position", async () => {
      const testInjector = new CssInjector({
        cssPath: "test.css",
        htmlPath: "test.html",
        insertPosition: "first",
      });

      const html = `
        <html>
          <head>
            <title>Test</title>
            <meta charset="utf-8">
          </head>
          <body></body>
        </html>
      `;

      const result = await testInjector.injectIntoString(html);

      expect(result.success).toBe(true);

      // Extract head content to check order
      const headMatch = result.html.match(/<head[^>]*>(.*?)<\/head>/s);
      expect(headMatch).toBeTruthy();

      const headContent = headMatch![1];
      const linkIndex = headContent.indexOf("<link");
      const titleIndex = headContent.indexOf("<title");

      expect(linkIndex).toBeLessThan(titleIndex);
    });

    test("should inject at last position", async () => {
      const testInjector = new CssInjector({
        cssPath: "test.css",
        htmlPath: "test.html",
        insertPosition: "last",
      });

      const html = `
        <html>
          <head>
            <title>Test</title>
            <meta charset="utf-8">
          </head>
          <body></body>
        </html>
      `;

      const result = await testInjector.injectIntoString(html);

      expect(result.success).toBe(true);

      // Extract head content to check order
      const headMatch = result.html.match(/<head[^>]*>(.*?)<\/head>/s);
      expect(headMatch).toBeTruthy();

      const headContent = headMatch![1];
      const linkIndex = headContent.indexOf("<link");
      const metaIndex = headContent.lastIndexOf("<meta");

      expect(linkIndex).toBeGreaterThan(metaIndex);
    });

    test("should inject after meta tags", async () => {
      const testInjector = new CssInjector({
        cssPath: "test.css",
        htmlPath: "test.html",
        insertPosition: "after-meta",
      });

      const html = `
        <html>
          <head>
            <title>Test</title>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width">
          </head>
          <body></body>
        </html>
      `;

      const result = await testInjector.injectIntoString(html);

      expect(result.success).toBe(true);

      // Check that link comes after the last meta tag
      const headMatch = result.html.match(/<head[^>]*>(.*?)<\/head>/s);
      expect(headMatch).toBeTruthy();

      const headContent = headMatch![1];
      const linkIndex = headContent.indexOf("<link");
      const lastMetaIndex = headContent.lastIndexOf("<meta");

      expect(linkIndex).toBeGreaterThan(lastMetaIndex);
    });

    test("should inject before existing stylesheets", async () => {
      const testInjector = new CssInjector({
        cssPath: "test.css",
        htmlPath: "test.html",
        insertPosition: "before-existing",
      });

      const html = `
        <html>
          <head>
            <title>Test</title>
            <link rel="stylesheet" href="existing.css">
          </head>
          <body></body>
        </html>
      `;

      const result = await testInjector.injectIntoString(html);

      expect(result.success).toBe(true);

      // Check that our link comes before the existing one
      const headMatch = result.html.match(/<head[^>]*>(.*?)<\/head>/s);
      expect(headMatch).toBeTruthy();

      const headContent = headMatch![1];
      const newLinkIndex = headContent.indexOf('href="test.css"');
      const existingLinkIndex = headContent.indexOf('href="existing.css"');

      expect(newLinkIndex).toBeLessThan(existingLinkIndex);
    });

    test("should preserve indentation when injecting", async () => {
      const html = `
<!DOCTYPE html>
<html>
  <head>
    <title>Test</title>
  </head>
  <body></body>
</html>
      `;

      const result = await injector.injectIntoString(html);

      expect(result.success).toBe(true);

      // Check that the injected link has proper indentation
      const lines = result.html.split("\n");
      const linkLine = lines.find((line) => line.includes("<link"));

      expect(linkLine).toBeTruthy();
      expect(linkLine!.startsWith("  ")).toBe(true); // Should have 2 spaces
    });

    test("should handle custom link attributes", async () => {
      const testInjector = new CssInjector({
        cssPath: "test.css",
        htmlPath: "test.html",
        linkAttributes: {
          rel: "stylesheet",
          type: "text/css",
          media: "screen",
        },
      });

      const html = "<html><head></head><body></body></html>";
      const result = await testInjector.injectIntoString(html);

      expect(result.success).toBe(true);
      expect(result.html).toContain('media="screen"');
      expect(result.html).toContain('rel="stylesheet"');
      expect(result.html).toContain('type="text/css"');
    });
  });

  describe("Path Calculation", () => {
    test("should calculate relative paths correctly", async () => {
      const testInjector = new CssInjector({
        cssPath: "/styles/main.css",
        htmlPath: "/pages/index.html",
        useRelativePaths: true,
      });

      const html = "<html><head></head><body></body></html>";
      const result = await testInjector.injectIntoString(html);

      expect(result.success).toBe(true);
      expect(result.relativePath).toBe("../styles/main.css");
      expect(result.html).toContain('href="../styles/main.css"');
    });

    test("should use absolute paths when configured", async () => {
      const testInjector = new CssInjector({
        cssPath: "/styles/main.css",
        htmlPath: "/pages/index.html",
        useRelativePaths: false,
      });

      const html = "<html><head></head><body></body></html>";
      const result = await testInjector.injectIntoString(html);

      expect(result.success).toBe(true);
      expect(result.relativePath).toBe("/styles/main.css");
      expect(result.html).toContain('href="/styles/main.css"');
    });

    test("should handle base path configuration", async () => {
      const testInjector = new CssInjector({
        cssPath: "styles/main.css",
        htmlPath: "pages/index.html",
        basePath: "/project",
        useRelativePaths: true,
      });

      const html = "<html><head></head><body></body></html>";
      const result = await testInjector.injectIntoString(html);

      expect(result.success).toBe(true);
      expect(result.relativePath).toBe("../styles/main.css");
    });

    test("should normalize path separators for web", async () => {
      const testInjector = new CssInjector({
        cssPath: "styles\\main.css", // Windows-style path
        htmlPath: "pages\\index.html",
        useRelativePaths: true,
      });

      const html = "<html><head></head><body></body></html>";
      const result = await testInjector.injectIntoString(html);

      expect(result.success).toBe(true);
      expect(result.relativePath).not.toContain("\\");
      expect(result.relativePath).toContain("/");
    });
  });

  describe("Error Handling", () => {
    test("should handle invalid HTML", async () => {
      const html = "<invalid><unclosed><nested>";

      // Should not throw, but handle gracefully
      const result = await injector.injectIntoString(html);
      expect(result.success).toBe(true);
    });

    test("should respect file size limits", async () => {
      const testInjector = new CssInjector({
        cssPath: "test.css",
        htmlPath: "test.html",
        maxFileSize: 10, // Very small limit
      });

      const html =
        "<html><head></head><body>This is longer than 10 bytes</body></html>";

      await expect(testInjector.injectIntoString(html)).rejects.toThrow(
        CssInjectionError,
      );
    });

    test("should provide detailed error information", async () => {
      try {
        await injector.injectIntoString("");
      } catch (error) {
        expect(error).toBeInstanceOf(CssInjectionError);
        if (error instanceof CssInjectionError) {
          expect(error.source).toBeDefined();
          expect(error.message).toBeTruthy();
        }
      }
    });
  });

  describe("Result Metadata", () => {
    test("should include processing metadata", async () => {
      const html = "<html><head></head><body></body></html>";
      const result = await injector.injectIntoString(html, "test-source");

      expect(result.metadata.source).toBe("test-source");
      expect(result.metadata.processedAt).toBeInstanceOf(Date);
      expect(typeof result.metadata.processingTime).toBe("number");
      expect(result.metadata.processingTime).toBeGreaterThan(0);
      expect(Array.isArray(result.metadata.errors)).toBe(true);
      expect(Array.isArray(result.metadata.warnings)).toBe(true);
    });

    test("should track successful injection", async () => {
      const html = "<html><head></head><body></body></html>";
      const result = await injector.injectIntoString(html);

      expect(result.success).toBe(true);
      expect(result.injectedCssPath).toBe("/styles/main.css");
      expect(typeof result.relativePath).toBe("string");
      expect(result.duplicateDetected).toBe(false);
      expect(result.duplicateAction).toBeNull();
    });
  });
});

describe("Factory Functions", () => {
  test("createCssInjector should create valid instance", () => {
    const injector = createCssInjector({
      cssPath: "test.css",
      htmlPath: "test.html",
    });

    expect(injector).toBeInstanceOf(CssInjector);
  });

  test("validateInjectionRequest should validate requests", () => {
    const validRequest = {
      cssFilePath: "test.css",
      htmlFilePath: "test.html",
    };

    const result = validateInjectionRequest(validRequest);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  test("validateInjectionRequest should catch invalid requests", () => {
    const invalidRequest = {
      cssFilePath: "",
      htmlFilePath: "",
      position: "invalid",
    };

    const result = validateInjectionRequest(invalidRequest);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });
});

describe("Custom Error Classes", () => {
  test("CssInjectionError should include source and code", () => {
    const error = new CssInjectionError(
      "Test message",
      "test-source",
      undefined,
      "TEST_CODE",
    );

    expect(error.name).toBe("CssInjectionError");
    expect(error.message).toBe("Test message");
    expect(error.source).toBe("test-source");
    expect(error.code).toBe("TEST_CODE");
  });

  test("DuplicateInjectionError should include href information", () => {
    const error = new DuplicateInjectionError(
      "Duplicate found",
      "existing.css",
      "new.css",
      "test-source",
    );

    expect(error.name).toBe("DuplicateInjectionError");
    expect(error.existingHref).toBe("existing.css");
    expect(error.newHref).toBe("new.css");
  });

  test("PathCalculationError should include path information", () => {
    const error = new PathCalculationError(
      "Path calculation failed",
      "/from/path",
      "/to/path",
    );

    expect(error.name).toBe("PathCalculationError");
    expect(error.fromPath).toBe("/from/path");
    expect(error.toPath).toBe("/to/path");
  });

  test("HtmlStructureError should include HTML content", () => {
    const error = new HtmlStructureError(
      "Invalid structure",
      "<invalid>html</invalid>",
    );

    expect(error.name).toBe("HtmlStructureError");
    expect(error.htmlContent).toBe("<invalid>html</invalid>");
  });
});
