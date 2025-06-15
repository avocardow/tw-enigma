/**
 * Copyright (c) 2025 Rowan Cardow
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  CssChunker,
  CssChunk,
  ChunkingStrategy,
  UsagePatternAnalyzer,
  TestDependencyGraph,
  createCssChunker,
  validateChunkingStrategy,
} from "../../src/output/cssChunker.ts";
import { ChunkingConfig } from "../../src/output/cssOutputConfig.ts";

// =============================================================================
// TEST DATA AND FIXTURES
// =============================================================================

const mockCssContent = `
/* Component styles */
.button {
  padding: 0.5rem 1rem;
  border-radius: 0.25rem;
  border: 1px solid #e2e8f0;
  background-color: #ffffff;
  color: #374151;
  cursor: pointer;
}

.button:hover {
  background-color: #f9fafb;
}

.button-primary {
  background-color: #3b82f6;
  color: #ffffff;
  border-color: #3b82f6;
}

.card {
  background-color: #ffffff;
  border-radius: 0.5rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  padding: 1.5rem;
}

.card-header {
  border-bottom: 1px solid #e2e8f0;
  margin-bottom: 1rem;
  padding-bottom: 1rem;
}

.form-input {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid #d1d5db;
  border-radius: 0.375rem;
}

.form-input:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}
`;

const mockLargeCssContent = `
/* Large CSS file for size-based chunking tests */
${Array.from(
  { length: 100 },
  (_, i) => `
.component-${i} {
  color: #${i.toString(16).padStart(6, "0")};
  padding: ${i}px;
  margin: ${i * 2}px;
  width: ${i * 10}px;
  height: ${i * 8}px;
}

.component-${i}:hover {
  opacity: 0.8;
}

.component-${i}:active {
  transform: scale(0.95);
}
`,
).join("")}
`;

const createMockChunk = (overrides: Partial<CssChunk> = {}): CssChunk => ({
  id: "1",
  name: "main",
  content: mockCssContent,
  size: Buffer.byteLength(mockCssContent, "utf8"),
  type: "main",
  priority: 1,
  rules: [], // Add missing rules property
  dependencies: new Set(),
  routes: new Set(["/"]),
  components: new Set(["Button", "Card"]),
  loadingStrategy: "eager",
  ...overrides,
});

const mockChunkingConfig: ChunkingConfig = {
  strategy: "hybrid",
  maxChunkSize: 50000,
  minChunkSize: 10000,
  targetChunks: 3,
  enableTreeShaking: true,
  preserveComments: false,
  splitVendor: true,
  splitCritical: true,
  routeBased: true,
  componentBased: true,
};

const mockUsageData = {
  files: [
    {
      path: "/src/components/Button.tsx",
      classes: ["button", "button-primary"],
      frequency: { button: 15, "button-primary": 8 },
    },
    {
      path: "/src/components/Card.tsx",
      classes: ["card", "card-header"],
      frequency: { card: 12, "card-header": 6 },
    },
    {
      path: "/src/pages/Home.tsx",
      classes: ["button", "card", "form-input"],
      frequency: { button: 3, card: 2, "form-input": 4 },
    },
    {
      path: "/src/pages/Dashboard.tsx",
      classes: ["card", "form-input"],
      frequency: { card: 5, "form-input": 8 },
    },
  ],
  routes: [
    { path: "/", components: ["Button", "Card"], critical: true },
    { path: "/dashboard", components: ["Card"], critical: false },
    { path: "/profile", components: ["Button"], critical: false },
  ],
};

// =============================================================================
// DEPENDENCY GRAPH TESTS
// =============================================================================

describe("DependencyGraph", () => {
  let graph: TestDependencyGraph;

  beforeEach(() => {
    graph = new TestDependencyGraph();
  });

  describe("constructor", () => {
    it("should create empty dependency graph", () => {
      expect(graph.getNodes().size).toBe(0);
      expect(graph.getEdges().size).toBe(0);
    });
  });

  describe("addNode", () => {
    it("should add CSS rule node", () => {
      graph.addNode("button", "rule", mockCssContent);

      const nodes = graph.getNodes();
      expect(nodes.has("button")).toBe(true);
      expect(nodes.get("button")).toMatchObject({
        id: "button",
        type: "rule",
        content: mockCssContent,
        dependencies: new Set(),
        dependents: new Set(),
      });
    });

    it("should add component node", () => {
      graph.addNode("Button", "component", "");

      const nodes = graph.getNodes();
      expect(nodes.has("Button")).toBe(true);
      expect(nodes.get("Button")?.type).toBe("component");
    });

    it("should not duplicate existing nodes", () => {
      graph.addNode("button", "rule", mockCssContent);
      graph.addNode("button", "rule", "different content");

      const nodes = graph.getNodes();
      expect(nodes.size).toBe(1);
      expect(nodes.get("button")?.content).toBe(mockCssContent); // First content preserved
    });
  });

  describe("addEdge", () => {
    beforeEach(() => {
      graph.addNode("button", "rule", "");
      graph.addNode("button-primary", "rule", "");
    });

    it("should add dependency edge", () => {
      graph.addEdge("button-primary", "button", "extends");

      const edges = graph.getEdges();
      expect(edges.size).toBe(1);

      const buttonNode = graph.getNodes().get("button");
      const primaryNode = graph.getNodes().get("button-primary");

      expect(buttonNode?.dependents.has("button-primary")).toBe(true);
      expect(primaryNode?.dependencies.has("button")).toBe(true);
    });

    it("should handle different edge types", () => {
      // Add the missing node first
      graph.addNode("form-input", "rule", "");
      
      graph.addEdge("button-primary", "button", "extends");
      graph.addEdge("button", "form-input", "composes");

      const edges = graph.getEdges();
      expect(edges.size).toBe(2);

      // Check edge types
      for (const [, edge] of edges) {
        if (edge.from === "button-primary") {
          expect(edge.type).toBe("extends");
        } else if (edge.from === "button") {
          expect(edge.type).toBe("composes");
        }
      }
    });

    it("should not add edge with missing nodes", () => {
      expect(() => {
        graph.addEdge("nonexistent", "button", "extends");
      }).toThrow();
    });
  });

  describe("getStronglyConnectedComponents", () => {
    it("should find strongly connected components", () => {
      // Create a cycle: A -> B -> C -> A
      graph.addNode("A", "rule", "");
      graph.addNode("B", "rule", "");
      graph.addNode("C", "rule", "");
      graph.addEdge("A", "B", "extends");
      graph.addEdge("B", "C", "extends");
      graph.addEdge("C", "A", "extends");

      const components = graph.getStronglyConnectedComponents();

      // Should find one component with all three nodes
      expect(components).toHaveLength(1);
      expect(components[0]).toEqual(expect.arrayContaining(["A", "B", "C"]));
    });

    it("should handle acyclic graph", () => {
      graph.addNode("A", "rule", "");
      graph.addNode("B", "rule", "");
      graph.addNode("C", "rule", "");
      graph.addEdge("A", "B", "extends");
      graph.addEdge("B", "C", "extends");

      const components = graph.getStronglyConnectedComponents();

      // Each node should be its own component
      expect(components).toHaveLength(3);
      expect(components.map((c) => c.length)).toEqual([1, 1, 1]);
    });
  });

  describe("getTopologicalOrder", () => {
    it("should return topological order for acyclic graph", () => {
      graph.addNode("A", "rule", "");
      graph.addNode("B", "rule", "");
      graph.addNode("C", "rule", "");
      graph.addEdge("C", "B", "extends");
      graph.addEdge("B", "A", "extends");

      const order = graph.getTopologicalOrder();

      expect(order).toHaveLength(3);

      // A should come before B, B should come before C
      const indexA = order.indexOf("A");
      const indexB = order.indexOf("B");
      const indexC = order.indexOf("C");

      expect(indexA).toBeLessThan(indexB);
      expect(indexB).toBeLessThan(indexC);
    });

    it("should handle cyclic graph", () => {
      graph.addNode("A", "rule", "");
      graph.addNode("B", "rule", "");
      graph.addEdge("A", "B", "extends");
      graph.addEdge("B", "A", "extends");

      const order = graph.getTopologicalOrder();

      // Should still return all nodes even with cycles
      expect(order).toHaveLength(2);
      expect(order).toEqual(expect.arrayContaining(["A", "B"]));
    });
  });

  describe("analyzeDependencies", () => {
    it("should analyze CSS dependencies", () => {
      const cssWithDependencies = `
        .base { color: blue; }
        .extended:extend(.base) { font-weight: bold; }
        .composed { .base(); background: white; }
      `;

      const analysis = graph.analyzeDependencies(cssWithDependencies);

      expect(analysis.rules.size).toBeGreaterThan(0);
      expect(analysis.imports).toBeDefined();
      expect(analysis.extends).toBeDefined();
      expect(analysis.composes).toBeDefined();
    });
  });
});

// =============================================================================
// USAGE PATTERN ANALYZER TESTS
// =============================================================================

describe("UsagePatternAnalyzer", () => {
  let analyzer: UsagePatternAnalyzer;

  beforeEach(() => {
    analyzer = new UsagePatternAnalyzer();
  });

  describe("constructor", () => {
    it("should create usage pattern analyzer", () => {
      expect(analyzer).toBeInstanceOf(UsagePatternAnalyzer);
    });
  });

  describe("analyzeUsage", () => {
    it("should analyze usage patterns from source files", () => {
      const analysis = analyzer.analyzeUsage(mockUsageData.files);

      expect(analysis.classFrequency.has("button")).toBe(true);
      expect(analysis.classFrequency.get("button")).toBe(18); // 15 + 3
      expect(analysis.classFrequency.get("card")).toBe(19); // 12 + 2 + 5

      expect(analysis.componentUsage.has("Button")).toBe(true);
      expect(analysis.fileAssociations.size).toBeGreaterThan(0);
    });

    it("should handle empty usage data", () => {
      const analysis = analyzer.analyzeUsage([]);

      expect(analysis.classFrequency.size).toBe(0);
      expect(analysis.componentUsage.size).toBe(0);
      expect(analysis.fileAssociations.size).toBe(0);
    });

    it("should calculate co-occurrence patterns", () => {
      const analysis = analyzer.analyzeUsage(mockUsageData.files);

      // button and button-primary should co-occur
      const buttonCoOccurrence = analysis.coOccurrence.get("button");
      expect(buttonCoOccurrence?.has("button-primary")).toBe(true);

      // card and card-header should co-occur
      const cardCoOccurrence = analysis.coOccurrence.get("card");
      expect(cardCoOccurrence?.has("card-header")).toBe(true);
    });
  });

  describe("getClassesByFrequency", () => {
    it("should return classes sorted by frequency", () => {
      const analysis = analyzer.analyzeUsage(mockUsageData.files);
      const sortedClasses = analyzer.getClassesByFrequency(analysis);

      expect(sortedClasses).toBeInstanceOf(Array);
      expect(sortedClasses.length).toBeGreaterThan(0);

      // Should be sorted in descending order of frequency
      for (let i = 1; i < sortedClasses.length; i++) {
        const prevFreq = analysis.classFrequency.get(sortedClasses[i - 1]) || 0;
        const currFreq = analysis.classFrequency.get(sortedClasses[i]) || 0;
        expect(prevFreq).toBeGreaterThanOrEqual(currFreq);
      }
    });
  });

  describe("getRouteSpecificClasses", () => {
    it("should identify route-specific class usage", () => {
      const analysis = analyzer.analyzeUsage(mockUsageData.files);
      const routeClasses = analyzer.getRouteSpecificClasses(
        analysis,
        mockUsageData.routes,
      );

      expect(routeClasses.has("/")).toBe(true);
      expect(routeClasses.has("/dashboard")).toBe(true);

      const homeClasses = routeClasses.get("/");
      expect(homeClasses?.has("button")).toBe(true);
      expect(homeClasses?.has("card")).toBe(true);
    });
  });
});

// =============================================================================
// CSS CHUNKER TESTS
// =============================================================================

describe("CssChunker", () => {
  let chunker: any; // Use any type since PatchedCssChunker has different interface

  beforeEach(() => {
    chunker = createCssChunker(mockChunkingConfig);
  });

  describe("constructor", () => {
    it("should create CSS chunker with config", () => {
      expect(chunker).toBeInstanceOf(CssChunker);
    });

    it("should validate chunking strategy", () => {
      expect(() => {
        new CssChunker({ ...mockChunkingConfig, strategy: "invalid" as any });
      }).toThrow();
    });
  });

  describe("chunkBySize", () => {
    it("should split large CSS into size-based chunks", () => {
      const config = {
        ...mockChunkingConfig,
        strategy: "size" as ChunkingStrategy,
      };
      const sizeChunker = new CssChunker(config);

      const chunks = sizeChunker.chunkBySize(mockLargeCssContent, {
        routes: new Set(["/large"]),
        components: new Set(["LargeComponent"]),
      });

      expect(chunks.length).toBeGreaterThan(1);

      // Each chunk should be under max size
      for (const chunk of chunks) {
        expect(chunk.size).toBeLessThanOrEqual(config.maxChunkSize);
      }

      // Total content should be preserved
      const totalContent = chunks.map((c) => c.content).join("");
      expect(totalContent.replace(/\s/g, "")).toContain(
        mockLargeCssContent.replace(/\s/g, ""),
      );
    });

    it("should handle small CSS content", () => {
      const chunks = chunker.chunkBySize(mockCssContent, {
        routes: new Set(["/"]),
        components: new Set(["Button"]),
      });

      // Small content should result in single chunk
      expect(chunks).toHaveLength(1);
      expect(chunks[0].content).toBe(mockCssContent);
    });

    it("should respect minimum chunk size", () => {
      const config = {
        ...mockChunkingConfig,
        strategy: "size" as ChunkingStrategy,
        minChunkSize: 1000,
      };
      const sizeChunker = new CssChunker(config);

      const chunks = sizeChunker.chunkBySize(mockLargeCssContent, {
        routes: new Set(["/test"]),
        components: new Set(["Test"]),
      });

      // All chunks should be above minimum size (except possibly the last one)
      for (let i = 0; i < chunks.length - 1; i++) {
        expect(chunks[i].size).toBeGreaterThanOrEqual(config.minChunkSize);
      }
    });
  });

  describe("chunkByUsage", () => {
    it("should create usage-based chunks", () => {
      const config = {
        ...mockChunkingConfig,
        strategy: "usage" as ChunkingStrategy,
      };
      const usageChunker = new CssChunker(config);

      const chunks = usageChunker.chunkByUsage(mockCssContent, mockUsageData);

      expect(chunks.length).toBeGreaterThan(0);

      // Should group related classes together
      const buttonChunk = chunks.find((c) => c.content.includes("button"));
      const cardChunk = chunks.find((c) => c.content.includes("card"));

      expect(buttonChunk).toBeDefined();
      expect(cardChunk).toBeDefined();
    });

    it("should handle empty usage data", () => {
      const chunks = chunker.chunkByUsage(mockCssContent, {
        files: [],
        routes: [],
      });

      // Should still create at least one chunk
      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks[0].content).toContain(mockCssContent);
    });
  });

  describe("chunkByRoute", () => {
    it("should create route-specific chunks", () => {
      const config = {
        ...mockChunkingConfig,
        strategy: "route" as ChunkingStrategy,
      };
      const routeChunker = new CssChunker(config);

      const chunks = routeChunker.chunkByRoute(mockCssContent, mockUsageData);

      expect(chunks.length).toBeGreaterThan(0);

      // Should have chunks for different routes
      const homeChunk = chunks.find((c) => c.routes.has("/"));
      const dashboardChunk = chunks.find((c) => c.routes.has("/dashboard"));

      expect(homeChunk).toBeDefined();
      expect(dashboardChunk).toBeDefined();
    });

    it("should mark critical route chunks", () => {
      const chunks = chunker.chunkByRoute(mockCssContent, mockUsageData);

      const criticalChunk = chunks.find((c) => c.routes.has("/"));
      expect(criticalChunk?.type).toBe("critical");
    });
  });

  describe("chunkByComponent", () => {
    it("should create component-specific chunks", () => {
      const config = {
        ...mockChunkingConfig,
        strategy: "component" as ChunkingStrategy,
      };
      const componentChunker = new CssChunker(config);

      const chunks = componentChunker.chunkByComponent(
        mockCssContent,
        mockUsageData,
      );

      expect(chunks.length).toBeGreaterThan(0);

      // Should have chunks for different components
      const buttonChunk = chunks.find((c) => c.components.has("Button"));
      const cardChunk = chunks.find((c) => c.components.has("Card"));

      expect(buttonChunk).toBeDefined();
      expect(cardChunk).toBeDefined();
    });
  });

  describe("chunkHybrid", () => {
    it("should combine multiple chunking strategies", () => {
      const chunks = chunker.chunkHybrid(mockCssContent, mockUsageData);

      expect(chunks.length).toBeGreaterThan(0);

      // Should have different types of chunks
      const chunkTypes = new Set(chunks.map((c) => c.type));
      expect(chunkTypes.size).toBeGreaterThan(1);
    });

    it("should optimize chunk distribution", () => {
      const chunks = chunker.chunkHybrid(mockLargeCssContent, mockUsageData);

      // Should respect target chunk count
      expect(chunks.length).toBeLessThanOrEqual(
        mockChunkingConfig.targetChunks * 2,
      );

      // Should have reasonable size distribution
      const totalSize = chunks.reduce((sum, chunk) => sum + chunk.size, 0);
      const averageSize = totalSize / chunks.length;

      expect(averageSize).toBeGreaterThan(mockChunkingConfig.minChunkSize);
      expect(averageSize).toBeLessThan(mockChunkingConfig.maxChunkSize);
    });
  });

  describe("processChunks", () => {
    it("should process CSS and create chunks", () => {
      const result = chunker.processChunks(mockCssContent, mockUsageData);

      expect(result.chunks.length).toBeGreaterThan(0);
      expect(result.metadata).toBeDefined();
      expect(result.metadata.totalSize).toBeGreaterThan(0);
      expect(result.metadata.chunkCount).toBe(result.chunks.length);
    });

    it("should include processing metadata", () => {
      const result = chunker.processChunks(mockCssContent, mockUsageData);

      expect(result.metadata).toMatchObject({
        strategy: mockChunkingConfig.strategy,
        totalSize: expect.any(Number),
        chunkCount: expect.any(Number),
        averageChunkSize: expect.any(Number),
        processingTime: expect.any(Number),
      });
    });

    it("should handle different strategies", () => {
      const strategies: ChunkingStrategy[] = [
        "size",
        "usage",
        "route",
        "component",
        "hybrid",
      ];

      for (const strategy of strategies) {
        const config = { ...mockChunkingConfig, strategy };
        const strategyChunker = new CssChunker(config);

        const result = strategyChunker.processChunks(
          mockCssContent,
          mockUsageData,
        );

        expect(result.chunks.length).toBeGreaterThan(0);
        expect(result.metadata.strategy).toBe(strategy);
      }
    });
  });

  describe("optimizeChunks", () => {
    it("should merge small chunks", () => {
      // Create chunks with some very small ones
      const smallChunks = [
        createMockChunk({
          id: "1",
          name: "small1",
          content: ".a{color:red}",
          size: 13,
        }),
        createMockChunk({
          id: "2",
          name: "small2",
          content: ".b{color:blue}",
          size: 14,
        }),
        createMockChunk({
          id: "3",
          name: "large",
          content: mockCssContent,
          size: mockCssContent.length,
        }),
      ];

      const optimized = chunker.optimizeChunks(smallChunks);

      // Should have fewer chunks due to merging
      expect(optimized.length).toBeLessThan(smallChunks.length);

      // Large chunk should be preserved
      const largeChunk = optimized.find((c) => c.content.includes("button"));
      expect(largeChunk).toBeDefined();
    });

    it("should preserve chunk dependencies", () => {
      const chunksWithDeps = [
        createMockChunk({ id: "1", name: "base", dependencies: new Set() }),
        createMockChunk({
          id: "2",
          name: "dependent",
          dependencies: new Set(["1"]),
        }),
      ];

      const optimized = chunker.optimizeChunks(chunksWithDeps);

      // Dependencies should be preserved
      const dependentChunk = optimized.find((c) => c.name === "dependent");
      expect(dependentChunk?.dependencies.has("1")).toBe(true);
    });
  });
});

// =============================================================================
// UTILITY FUNCTION TESTS
// =============================================================================

describe("Utility Functions", () => {
  describe("createCssChunker", () => {
    it("should create CSS chunker with config", () => {
      const chunker = createCssChunker(mockChunkingConfig);
      expect(chunker).toBeInstanceOf(CssChunker);
    });

    it("should validate config", () => {
      expect(() => {
        createCssChunker({ ...mockChunkingConfig, strategy: "invalid" as any });
      }).toThrow();
    });
  });

  describe("validateChunkingStrategy", () => {
    it("should validate valid strategies", () => {
      const validStrategies: ChunkingStrategy[] = [
        "size",
        "usage",
        "route",
        "component",
        "hybrid",
      ];

      for (const strategy of validStrategies) {
        expect(() => validateChunkingStrategy(strategy)).not.toThrow();
      }
    });

    it("should reject invalid strategies", () => {
      expect(() => {
        validateChunkingStrategy("invalid" as any);
      }).toThrow();
    });
  });
});

// =============================================================================
// INTEGRATION TESTS
// =============================================================================

describe("Integration Tests", () => {
  it("should create complete chunking pipeline", () => {
    const chunker = createCssChunker(mockChunkingConfig);

    // Process large CSS with complex usage patterns
    const complexUsageData = {
      files: [
        ...mockUsageData.files,
        {
          path: "/src/components/ComplexComponent.tsx",
          classes: Array.from({ length: 50 }, (_, i) => `component-${i}`),
          frequency: Array.from({ length: 50 }, (_, i) => ({
            [`component-${i}`]: i + 1,
          })).reduce((acc, curr) => ({ ...acc, ...curr }), {}),
        },
      ],
      routes: [
        ...mockUsageData.routes,
        { path: "/complex", components: ["ComplexComponent"], critical: false },
      ],
    };

    const result = chunker.processChunks(mockLargeCssContent, complexUsageData);

    // Should create reasonable number of chunks
    expect(result.chunks.length).toBeGreaterThan(1);
    expect(result.chunks.length).toBeLessThanOrEqual(10);

    // Should preserve all content
    const totalContent = result.chunks.map((c) => c.content).join("");
    expect(totalContent.length).toBeGreaterThan(0);

    // Should have reasonable metadata
    expect(result.metadata.totalSize).toBeGreaterThan(0);
    expect(result.metadata.averageChunkSize).toBeGreaterThan(0);
    expect(result.metadata.processingTime).toBeGreaterThan(0);
  });

  it("should handle edge cases gracefully", () => {
    const chunker = createCssChunker(mockChunkingConfig);

    // Empty CSS
    const emptyResult = chunker.processChunks("", mockUsageData);
    expect(emptyResult.chunks).toHaveLength(0);

    // CSS with only comments
    const commentOnlyResult = chunker.processChunks(
      "/* just comments */",
      mockUsageData,
    );
    expect(commentOnlyResult.chunks.length).toBeLessThanOrEqual(1);

    // CSS with invalid syntax
    const invalidCssResult = chunker.processChunks(
      ".invalid { color: ; }",
      mockUsageData,
    );
    expect(invalidCssResult.chunks.length).toBeGreaterThan(0);
  });

  it("should work with different chunking configurations", () => {
    const configs = [
      {
        ...mockChunkingConfig,
        strategy: "size" as ChunkingStrategy,
        maxChunkSize: 20000,
      },
      {
        ...mockChunkingConfig,
        strategy: "usage" as ChunkingStrategy,
        targetChunks: 5,
      },
      {
        ...mockChunkingConfig,
        strategy: "route" as ChunkingStrategy,
        routeBased: true,
      },
      {
        ...mockChunkingConfig,
        strategy: "component" as ChunkingStrategy,
        componentBased: true,
      },
      {
        ...mockChunkingConfig,
        strategy: "hybrid" as ChunkingStrategy,
        splitVendor: true,
      },
    ];

    for (const config of configs) {
      const chunker = createCssChunker(config);
      const result = chunker.processChunks(mockCssContent, mockUsageData);

      expect(result.chunks.length).toBeGreaterThan(0);
      expect(result.metadata.strategy).toBe(config.strategy);
    }
  });

  it("should maintain CSS rule integrity across chunks", () => {
    const chunker = createCssChunker({
      ...mockChunkingConfig,
      strategy: "size",
      maxChunkSize: 500, // Force splitting
    });

    const result = chunker.processChunks(mockCssContent, mockUsageData);

    // Check that CSS rules are not broken across chunks
    for (const chunk of result.chunks) {
      // Count opening and closing braces
      const openBraces = (chunk.content.match(/\{/g) || []).length;
      const closeBraces = (chunk.content.match(/\}/g) || []).length;

      expect(openBraces).toBe(closeBraces);
    }
  });
});
