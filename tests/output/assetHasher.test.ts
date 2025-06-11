/**
 * Copyright (c) 2025 Rowan Cardow
 * 
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { 
  AssetHasher, 
  CssCompressor, 
  CssMinifier, 
  ManifestGenerator,
  AssetHashingOptions,
  CompressedAsset,
  AssetManifest,
  createAssetHasher,
  createCssCompressor,
  createCssMinifier,
  createManifestGenerator,
  validateAssetHashingOptions
} from '../../src/output/assetHasher.js';
import { CssChunk } from '../../src/output/cssChunker.js';
import { CompressionConfig, OptimizationConfig, OutputPaths } from '../../src/output/cssOutputConfig.js';

// =============================================================================
// TEST DATA AND FIXTURES
// =============================================================================

const mockCssContent = `
/* Main styles */
.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
}

.header {
  background-color: #ffffff;
  border-bottom: 1px solid #e2e8f0;
  padding: 1rem 0;
}

.nav-item {
  display: inline-block;
  margin-right: 2rem;
  color: #4a5568;
}

.nav-item:hover {
  color: #2d3748;
}

@media (max-width: 768px) {
  .container {
    padding: 10px;
  }
  
  .nav-item {
    display: block;
    margin: 0.5rem 0;
  }
}
`;

const mockMinifiableCss = `
/* Remove this comment */
.test {
  color: red;
  color: blue; /* duplicate */
}

.test {
  background: white;
}

.empty-rule {
  /* nothing here */
}

.calc-test {
  width: calc(100px + 50px);
  height: calc(10px);
}

.color-test {
  color: #ff0000;
  background: rgb(255, 255, 255);
  border: #aabbcc;
}
`;

const createMockChunk = (overrides: Partial<CssChunk> = {}): CssChunk => ({
  id: '1',
  name: 'main',
  content: mockCssContent,
  size: Buffer.byteLength(mockCssContent, 'utf8'),
  type: 'main',
  priority: 1,
  dependencies: new Set(),
  routes: new Set(['/']),
  components: new Set(['Header', 'Container']),
  loadingStrategy: 'eager',
  ...overrides
});

const mockCompressionConfig: CompressionConfig = {
  type: 'auto',
  level: 6,
  threshold: 1024,
  includeBrotli: true,
  includeGzip: true
};

const mockOptimizationConfig: OptimizationConfig = {
  minify: true,
  removeComments: true,
  mergeDuplicates: true,
  normalizeColors: true,
  optimizeCalc: true,
  removeEmpty: true,
  sourceMap: false
};

const mockOutputPaths: OutputPaths = {
  css: 'dist/css',
  assets: 'dist/assets',
  manifest: 'dist/manifest.json',
  reports: 'dist/reports'
};

// =============================================================================
// ASSET HASHER TESTS
// =============================================================================

describe('AssetHasher', () => {
  let assetHasher: AssetHasher;

  beforeEach(() => {
    assetHasher = new AssetHasher();
  });

  afterEach(() => {
    assetHasher.clearCache();
  });

  describe('constructor', () => {
    it('should create with default options', () => {
      const hasher = new AssetHasher();
      expect(hasher).toBeInstanceOf(AssetHasher);
    });

    it('should create with custom options', () => {
      const options: AssetHashingOptions = {
        algorithm: 'sha256',
        length: 16,
        includeContent: true,
        includeMetadata: true,
        generateIntegrity: true,
        integrityAlgorithm: 'sha512'
      };

      const hasher = new AssetHasher(options);
      expect(hasher).toBeInstanceOf(AssetHasher);
    });

    it('should validate options with Zod schema', () => {
      expect(() => {
        new AssetHasher({ algorithm: 'invalid' as any });
      }).toThrow();
    });
  });

  describe('hashContent', () => {
    it('should hash CSS content successfully', () => {
      const result = assetHasher.hashContent(mockCssContent, 'main.css');

      expect(result).toMatchObject({
        original: 'main.css',
        hashed: expect.stringMatching(/^main\.[a-f0-9]{8}\.css$/),
        hash: expect.stringMatching(/^[a-f0-9]{8}$/),
        algorithm: 'xxhash',
        size: expect.any(Number),
        mimeType: 'text/css',
        lastModified: expect.any(Date)
      });

      expect(result.integrity).toMatch(/^sha384-/);
    });

    it('should generate different hashes for different content', () => {
      const result1 = assetHasher.hashContent('content1', 'test1.css');
      const result2 = assetHasher.hashContent('content2', 'test2.css');

      expect(result1.hash).not.toBe(result2.hash);
      expect(result1.hashed).not.toBe(result2.hashed);
    });

    it('should generate same hash for identical content', () => {
      const result1 = assetHasher.hashContent(mockCssContent, 'test.css');
      const result2 = assetHasher.hashContent(mockCssContent, 'test.css');

      expect(result1.hash).toBe(result2.hash);
      expect(result1.hashed).toBe(result2.hashed);
    });

    it('should respect hash length option', () => {
      const hasher = new AssetHasher({ length: 16 });
      const result = hasher.hashContent(mockCssContent, 'test.css');

      expect(result.hash).toHaveLength(16);
      expect(result.hashed).toMatch(/^test\.[a-f0-9]{16}\.css$/);
    });

    it('should support different hash algorithms', () => {
      const algorithms: Array<AssetHashingOptions['algorithm']> = ['md5', 'sha1', 'sha256'];

      for (const algorithm of algorithms) {
        const hasher = new AssetHasher({ algorithm });
        const result = hasher.hashContent(mockCssContent, 'test.css');

        expect(result.algorithm).toBe(algorithm);
        expect(result.hash).toMatch(/^[a-f0-9]+$/);
      }
    });

    it('should generate integrity hash when enabled', () => {
      const hasher = new AssetHasher({ 
        generateIntegrity: true,
        integrityAlgorithm: 'sha256' 
      });
      const result = hasher.hashContent(mockCssContent, 'test.css');

      expect(result.integrity).toMatch(/^sha256-/);
    });

    it('should not generate integrity hash when disabled', () => {
      const hasher = new AssetHasher({ generateIntegrity: false });
      const result = hasher.hashContent(mockCssContent, 'test.css');

      expect(result.integrity).toBeUndefined();
    });

    it('should handle metadata inclusion', () => {
      const hasher = new AssetHasher({ includeMetadata: true });
      const result1 = hasher.hashContent(mockCssContent, 'test1.css');
      const result2 = hasher.hashContent(mockCssContent, 'test2.css');

      // Different filenames should produce different hashes when metadata is included
      expect(result1.hash).not.toBe(result2.hash);
    });
  });

  describe('hashChunk', () => {
    it('should hash a CSS chunk', () => {
      const chunk = createMockChunk();
      const result = assetHasher.hashChunk(chunk);

      expect(result.original).toBe('main.css');
      expect(result.hashed).toMatch(/^main\.[a-f0-9]{8}\.css$/);
      expect(result.size).toBe(chunk.size);
    });

    it('should handle chunks with different names', () => {
      const chunk1 = createMockChunk({ name: 'vendor' });
      const chunk2 = createMockChunk({ name: 'critical' });

      const result1 = assetHasher.hashChunk(chunk1);
      const result2 = assetHasher.hashChunk(chunk2);

      expect(result1.original).toBe('vendor.css');
      expect(result2.original).toBe('critical.css');
    });
  });

  describe('hashChunks', () => {
    it('should hash multiple chunks', () => {
      const chunks = [
        createMockChunk({ id: '1', name: 'main' }),
        createMockChunk({ id: '2', name: 'vendor' }),
        createMockChunk({ id: '3', name: 'critical' })
      ];

      const results = assetHasher.hashChunks(chunks);

      expect(results.size).toBe(3);
      expect(results.has('1')).toBe(true);
      expect(results.has('2')).toBe(true);
      expect(results.has('3')).toBe(true);

      const mainResult = results.get('1')!;
      expect(mainResult.original).toBe('main.css');
    });

    it('should handle empty chunks array', () => {
      const results = assetHasher.hashChunks([]);
      expect(results.size).toBe(0);
    });
  });

  describe('cache functionality', () => {
    it('should cache hash results', () => {
      const spy = jest.spyOn(require('crypto'), 'createHash');
      
      // First call should create hash
      assetHasher.hashContent(mockCssContent, 'test.css');
      const firstCallCount = spy.mock.calls.length;

      // Second call should use cache
      assetHasher.hashContent(mockCssContent, 'test.css');
      const secondCallCount = spy.mock.calls.length;

      expect(secondCallCount).toBe(firstCallCount);
      spy.mockRestore();
    });

    it('should clear cache', () => {
      assetHasher.hashContent(mockCssContent, 'test.css');
      
      const stats = assetHasher.getCacheStats();
      expect(stats.size).toBeGreaterThan(0);

      assetHasher.clearCache();
      
      const clearedStats = assetHasher.getCacheStats();
      expect(clearedStats.size).toBe(0);
    });
  });
});

// =============================================================================
// CSS COMPRESSOR TESTS
// =============================================================================

describe('CssCompressor', () => {
  let compressor: CssCompressor;

  beforeEach(() => {
    compressor = new CssCompressor(mockCompressionConfig);
  });

  describe('constructor', () => {
    it('should create with compression config', () => {
      expect(compressor).toBeInstanceOf(CssCompressor);
    });
  });

  describe('compressContent', () => {
    it('should compress CSS content with gzip', async () => {
      const config: CompressionConfig = {
        ...mockCompressionConfig,
        type: 'gzip'
      };
      const gzipCompressor = new CssCompressor(config);

      const results = await gzipCompressor.compressContent(mockCssContent, 'test.css');

      expect(results).toHaveLength(1);
      expect(results[0]).toMatchObject({
        originalPath: 'test.css',
        compressedPath: 'test.css.gz',
        originalSize: expect.any(Number),
        compressedSize: expect.any(Number),
        compressionRatio: expect.any(Number),
        compressionType: 'gzip',
        compressionLevel: config.level,
        isMinified: true
      });

      expect(results[0].compressedSize).toBeLessThan(results[0].originalSize);
    });

    it('should compress CSS content with brotli', async () => {
      const config: CompressionConfig = {
        ...mockCompressionConfig,
        type: 'brotli'
      };
      const brotliCompressor = new CssCompressor(config);

      const results = await brotliCompressor.compressContent(mockCssContent, 'test.css');

      expect(results).toHaveLength(1);
      expect(results[0].compressionType).toBe('brotli');
      expect(results[0].compressedPath).toBe('test.css.br');
    });

    it('should compress with both formats when type is auto', async () => {
      const results = await compressor.compressContent(mockCssContent, 'test.css');

      expect(results).toHaveLength(2);
      
      const brotliResult = results.find(r => r.compressionType === 'brotli');
      const gzipResult = results.find(r => r.compressionType === 'gzip');

      expect(brotliResult).toBeDefined();
      expect(gzipResult).toBeDefined();
    });

    it('should skip compression for files below threshold', async () => {
      const config: CompressionConfig = {
        ...mockCompressionConfig,
        threshold: 10000 // Higher than our test content
      };
      const thresholdCompressor = new CssCompressor(config);

      const results = await thresholdCompressor.compressContent(mockCssContent, 'test.css');

      expect(results).toHaveLength(0);
    });

    it('should handle compression errors gracefully', async () => {
      // Mock a compression failure
      const originalGzip = require('zlib').gzip;
      require('zlib').gzip = vi.fn((content, options, callback) => {
        callback(new Error('Compression failed'));
      });

      const results = await compressor.compressContent(mockCssContent, 'test.css');

      // Should return partial results (brotli might still work)
      expect(results.length).toBeLessThanOrEqual(2);

      // Restore original function
      require('zlib').gzip = originalGzip;
    });
  });

  describe('compressChunk', () => {
    it('should compress a CSS chunk', async () => {
      const chunk = createMockChunk();
      const results = await compressor.compressChunk(chunk);

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].originalPath).toBe('main.css');
    });
  });

  describe('compressChunks', () => {
    it('should compress multiple chunks in parallel', async () => {
      const chunks = [
        createMockChunk({ id: '1', name: 'main' }),
        createMockChunk({ id: '2', name: 'vendor' }),
        createMockChunk({ id: '3', name: 'critical' })
      ];

      const startTime = Date.now();
      const results = await compressor.compressChunks(chunks);
      const endTime = Date.now();

      expect(results.size).toBe(3);
      expect(results.has('1')).toBe(true);
      expect(results.has('2')).toBe(true);
      expect(results.has('3')).toBe(true);

      // Parallel processing should be faster than sequential
      // This is a rough test, but processing should complete reasonably quickly
      expect(endTime - startTime).toBeLessThan(5000);
    });

    it('should handle empty chunks array', async () => {
      const results = await compressor.compressChunks([]);
      expect(results.size).toBe(0);
    });
  });
});

// =============================================================================
// CSS MINIFIER TESTS
// =============================================================================

describe('CssMinifier', () => {
  let minifier: CssMinifier;

  beforeEach(() => {
    minifier = new CssMinifier(mockOptimizationConfig);
  });

  describe('constructor', () => {
    it('should create with optimization config', () => {
      expect(minifier).toBeInstanceOf(CssMinifier);
    });
  });

  describe('minifyCss', () => {
    it('should minify CSS when minification is enabled', async () => {
      const result = await minifier.minifyCss(mockMinifiableCss, 'test.css');

      expect(result.minified).toBeDefined();
      expect(result.stats.minifiedSize).toBeLessThan(result.stats.originalSize);
      expect(result.stats.reduction).toBeGreaterThan(0);
    });

    it('should skip minification when disabled', async () => {
      const config: OptimizationConfig = {
        ...mockOptimizationConfig,
        minify: false
      };
      const noMinifyMinifier = new CssMinifier(config);

      const result = await noMinifyMinifier.minifyCss(mockMinifiableCss, 'test.css');

      expect(result.minified).toBe(mockMinifiableCss);
      expect(result.stats.reduction).toBe(0);
    });

    it('should remove comments when configured', async () => {
      const cssWithComments = `
        /* Remove this comment */
        .test { color: red; }
        /*! Keep this important comment */
        .important { color: blue; }
      `;

      const result = await minifier.minifyCss(cssWithComments, 'test.css');

      expect(result.minified).not.toContain('Remove this comment');
      expect(result.minified).toContain('Keep this important comment');
    });

    it('should merge duplicate selectors when configured', async () => {
      const cssWithDuplicates = `
        .test { color: red; }
        .other { background: blue; }
        .test { margin: 10px; }
      `;

      const result = await minifier.minifyCss(cssWithDuplicates, 'test.css');

      // Should have merged .test rules
      const testRuleCount = (result.minified.match(/\.test/g) || []).length;
      expect(testRuleCount).toBe(1);
    });

    it('should normalize colors when configured', async () => {
      const cssWithColors = `
        .test {
          color: #ff0000;
          background: #aabbcc;
          border: rgb(255, 255, 255);
        }
      `;

      const result = await minifier.minifyCss(cssWithColors, 'test.css');

      // Should convert #ff0000 to #f00, #aabbcc to #abc
      expect(result.minified).toContain('#f00');
      expect(result.minified).toContain('#abc');
    });

    it('should optimize calc() expressions when configured', async () => {
      const cssWithCalc = `
        .test {
          width: calc(10px);
          height: calc(100px + 50px);
        }
      `;

      const result = await minifier.minifyCss(cssWithCalc, 'test.css');

      // Should simplify calc(10px) to 10px
      expect(result.minified).toContain('10px');
      expect(result.minified).not.toContain('calc(10px)');
    });

    it('should remove empty rules when configured', async () => {
      const cssWithEmpty = `
        .test { color: red; }
        .empty { /* nothing */ }
        .another { margin: 10px; }
      `;

      const result = await minifier.minifyCss(cssWithEmpty, 'test.css');

      expect(result.minified).not.toContain('.empty');
      expect(result.minified).toContain('.test');
      expect(result.minified).toContain('.another');
    });

    it('should generate source maps when configured', async () => {
      const config: OptimizationConfig = {
        ...mockOptimizationConfig,
        sourceMap: true
      };
      const sourcemapMinifier = new CssMinifier(config);

      const result = await sourcemapMinifier.minifyCss(mockMinifiableCss, 'test.css');

      expect(result.sourceMap).toBeDefined();
      expect(result.sourceMap).toContain('mappings');
    });

    it('should handle CSS processing errors gracefully', async () => {
      const invalidCss = '.test { color: ; }'; // Invalid CSS

      await expect(minifier.minifyCss(invalidCss, 'test.css')).rejects.toThrow(/CSS minification failed/);
    });
  });

  describe('minifyChunk', () => {
    it('should minify a CSS chunk', async () => {
      const chunk = createMockChunk({ content: mockMinifiableCss });
      const result = await minifier.minifyChunk(chunk);

      expect(result.content).not.toBe(chunk.content);
      expect(result.size).toBeLessThan(chunk.size);
      expect(result.id).toBe(chunk.id);
      expect(result.name).toBe(chunk.name);
    });
  });

  describe('minifyChunks', () => {
    it('should minify multiple chunks in parallel', async () => {
      const chunks = [
        createMockChunk({ id: '1', content: mockMinifiableCss }),
        createMockChunk({ id: '2', content: mockMinifiableCss }),
        createMockChunk({ id: '3', content: mockMinifiableCss })
      ];

      const startTime = Date.now();
      const results = await minifier.minifyChunks(chunks);
      const endTime = Date.now();

      expect(results).toHaveLength(3);
      
      for (const result of results) {
        expect(result.content.length).toBeLessThan(mockMinifiableCss.length);
      }

      // Parallel processing should be reasonably fast
      expect(endTime - startTime).toBeLessThan(3000);
    });
  });
});

// =============================================================================
// MANIFEST GENERATOR TESTS
// =============================================================================

describe('ManifestGenerator', () => {
  let generator: ManifestGenerator;

  beforeEach(() => {
    generator = new ManifestGenerator(mockOutputPaths);
  });

  describe('constructor', () => {
    it('should create with output paths', () => {
      expect(generator).toBeInstanceOf(ManifestGenerator);
    });
  });

  describe('generateManifest', () => {
    it('should generate a complete asset manifest', () => {
      const chunks = [
        createMockChunk({ id: '1', name: 'main', priority: 1 }),
        createMockChunk({ id: '2', name: 'vendor', priority: 2 }),
        createMockChunk({ id: '3', name: 'critical', priority: 3 })
      ];

      const hashes = new Map([
        ['1', { 
          original: 'main.css', 
          hashed: 'main.abc123.css', 
          hash: 'abc123', 
          algorithm: 'xxhash' as const,
          size: 1000,
          mimeType: 'text/css',
          lastModified: new Date(),
          integrity: 'sha384-hash1'
        }],
        ['2', { 
          original: 'vendor.css', 
          hashed: 'vendor.def456.css', 
          hash: 'def456', 
          algorithm: 'xxhash' as const,
          size: 2000,
          mimeType: 'text/css',
          lastModified: new Date(),
          integrity: 'sha384-hash2'
        }],
        ['3', { 
          original: 'critical.css', 
          hashed: 'critical.ghi789.css', 
          hash: 'ghi789', 
          algorithm: 'xxhash' as const,
          size: 500,
          mimeType: 'text/css',
          lastModified: new Date(),
          integrity: 'sha384-hash3'
        }]
      ]);

      const compressions = new Map([
        ['1', [{
          originalPath: 'main.css',
          compressedPath: 'main.css.gz',
          originalSize: 1000,
          compressedSize: 300,
          compressionRatio: 0.3,
          compressionType: 'gzip' as const,
          compressionLevel: 6,
          isMinified: true
        }]],
        ['2', [{
          originalPath: 'vendor.css',
          compressedPath: 'vendor.css.br',
          originalSize: 2000,
          compressedSize: 400,
          compressionRatio: 0.2,
          compressionType: 'brotli' as const,
          compressionLevel: 6,
          isMinified: true
        }]]
      ]);

      const manifest = generator.generateManifest(chunks, hashes, compressions);

      expect(manifest).toMatchObject({
        version: '1.0.0',
        generated: expect.any(Date),
        buildConfig: {
          strategy: 'css-output-optimization',
          optimization: true,
          compression: true,
          hashing: true
        },
        assets: expect.any(Object),
        entrypoints: expect.any(Object),
        stats: {
          totalFiles: 3,
          totalSize: 3500,
          compressedSize: 700,
          compressionRatio: 5,
          optimizationRatio: 1
        }
      });

      // Check individual assets
      expect(manifest.assets['main.css']).toMatchObject({
        file: 'main.css',
        src: 'main.abc123.css',
        size: 1000,
        hash: 'abc123',
        integrity: 'sha384-hash1',
        type: 'css',
        priority: 1,
        loading: 'eager',
        compressed: {
          gzip: {
            file: 'main.css.gz',
            size: 300
          }
        }
      });

      expect(manifest.assets['vendor.css']).toMatchObject({
        compressed: {
          brotli: {
            file: 'vendor.css.br',
            size: 400
          }
        }
      });

      // Check entrypoints
      expect(manifest.entrypoints).toHaveProperty('main');
      expect(manifest.entrypoints).toHaveProperty('secondary');
    });

    it('should handle chunks without compression', () => {
      const chunks = [createMockChunk({ id: '1', name: 'main' })];
      const hashes = new Map([
        ['1', { 
          original: 'main.css', 
          hashed: 'main.abc123.css', 
          hash: 'abc123', 
          algorithm: 'xxhash' as const,
          size: 1000,
          mimeType: 'text/css',
          lastModified: new Date(),
          integrity: 'sha384-hash1'
        }]
      ]);
      const compressions = new Map();

      const manifest = generator.generateManifest(chunks, hashes, compressions);

      expect(manifest.assets['main.css'].compressed).toBeUndefined();
      expect(manifest.buildConfig.compression).toBe(false);
    });

    it('should handle chunks without routes or components', () => {
      const chunks = [createMockChunk({ 
        id: '1', 
        name: 'main',
        routes: new Set(),
        components: new Set()
      })];
      const hashes = new Map([
        ['1', { 
          original: 'main.css', 
          hashed: 'main.abc123.css', 
          hash: 'abc123', 
          algorithm: 'xxhash' as const,
          size: 1000,
          mimeType: 'text/css',
          lastModified: new Date(),
          integrity: 'sha384-hash1'
        }]
      ]);
      const compressions = new Map();

      const manifest = generator.generateManifest(chunks, hashes, compressions);

      expect(manifest.assets['main.css'].routes).toBeUndefined();
      expect(manifest.assets['main.css'].components).toBeUndefined();
    });

    it('should skip chunks without hashes', () => {
      const chunks = [createMockChunk({ id: '1', name: 'main' })];
      const hashes = new Map(); // No hashes
      const compressions = new Map();

      const manifest = generator.generateManifest(chunks, hashes, compressions);

      expect(Object.keys(manifest.assets)).toHaveLength(0);
      expect(manifest.stats.totalFiles).toBe(0);
    });
  });

  describe('saveManifest', () => {
    it('should save manifest successfully', async () => {
      const manifest: AssetManifest = {
        version: '1.0.0',
        generated: new Date(),
        buildConfig: {
          strategy: 'test',
          optimization: true,
          compression: true,
          hashing: true
        },
        assets: {},
        entrypoints: {},
        stats: {
          totalFiles: 0,
          totalSize: 0,
          compressedSize: 0,
          compressionRatio: 1,
          optimizationRatio: 1
        }
      };

      await expect(generator.saveManifest(manifest, 'test-manifest.json')).resolves.toBeUndefined();
    });
  });
});

// =============================================================================
// UTILITY FUNCTION TESTS
// =============================================================================

describe('Utility Functions', () => {
  describe('createAssetHasher', () => {
    it('should create asset hasher with default options', () => {
      const hasher = createAssetHasher();
      expect(hasher).toBeInstanceOf(AssetHasher);
    });

    it('should create asset hasher with custom options', () => {
      const options = { algorithm: 'sha256' as const, length: 16 };
      const hasher = createAssetHasher(options);
      expect(hasher).toBeInstanceOf(AssetHasher);
    });
  });

  describe('createCssCompressor', () => {
    it('should create CSS compressor with config', () => {
      const compressor = createCssCompressor(mockCompressionConfig);
      expect(compressor).toBeInstanceOf(CssCompressor);
    });
  });

  describe('createCssMinifier', () => {
    it('should create CSS minifier with config', () => {
      const minifier = createCssMinifier(mockOptimizationConfig);
      expect(minifier).toBeInstanceOf(CssMinifier);
    });
  });

  describe('createManifestGenerator', () => {
    it('should create manifest generator with paths', () => {
      const generator = createManifestGenerator(mockOutputPaths);
      expect(generator).toBeInstanceOf(ManifestGenerator);
    });
  });

  describe('validateAssetHashingOptions', () => {
    it('should validate valid options', () => {
      const validOptions = {
        algorithm: 'sha256',
        length: 10,
        includeContent: true,
        includeMetadata: false,
        generateIntegrity: true,
        integrityAlgorithm: 'sha384'
      };

      const result = validateAssetHashingOptions(validOptions);
      expect(result).toEqual(validOptions);
    });

    it('should throw on invalid options', () => {
      const invalidOptions = {
        algorithm: 'invalid',
        length: -1
      };

      expect(() => validateAssetHashingOptions(invalidOptions)).toThrow();
    });

    it('should apply defaults for missing options', () => {
      const partialOptions = {
        algorithm: 'md5'
      };

      const result = validateAssetHashingOptions(partialOptions);
      expect(result).toMatchObject({
        algorithm: 'md5',
        length: 8,
        includeContent: true,
        includeMetadata: false,
        generateIntegrity: true,
        integrityAlgorithm: 'sha384'
      });
    });
  });
});

// =============================================================================
// INTEGRATION TESTS
// =============================================================================

describe('Integration Tests', () => {
  it('should create complete asset optimization pipeline', async () => {
    // Create components
    const hasher = createAssetHasher({ algorithm: 'sha256', length: 12 });
    const compressor = createCssCompressor(mockCompressionConfig);
    const minifier = createCssMinifier(mockOptimizationConfig);
    const generator = createManifestGenerator(mockOutputPaths);

    // Create test chunks
    const chunks = [
      createMockChunk({ id: '1', name: 'main', content: mockMinifiableCss }),
      createMockChunk({ id: '2', name: 'vendor', content: mockCssContent })
    ];

    // Process pipeline
    const minifiedChunks = await minifier.minifyChunks(chunks);
    const hashes = hasher.hashChunks(minifiedChunks);
    const compressions = await compressor.compressChunks(minifiedChunks);
    const manifest = generator.generateManifest(minifiedChunks, hashes, compressions);

    // Verify complete pipeline
    expect(minifiedChunks).toHaveLength(2);
    expect(hashes.size).toBe(2);
    expect(compressions.size).toBe(2);
    expect(Object.keys(manifest.assets)).toHaveLength(2);

    // Verify optimization occurred
    for (const chunk of minifiedChunks) {
      expect(chunk.size).toBeLessThan(Buffer.byteLength(mockMinifiableCss, 'utf8'));
    }

    // Verify compression occurred
    for (const [chunkId, compressedAssets] of compressions) {
      expect(compressedAssets.length).toBeGreaterThan(0);
      for (const asset of compressedAssets) {
        expect(asset.compressedSize).toBeLessThan(asset.originalSize);
      }
    }

    // Verify manifest completeness
    expect(manifest.stats.totalFiles).toBe(2);
    expect(manifest.stats.compressionRatio).toBeGreaterThan(1);
    expect(manifest.buildConfig.optimization).toBe(true);
    expect(manifest.buildConfig.compression).toBe(true);
    expect(manifest.buildConfig.hashing).toBe(true);
  });

  it('should handle error scenarios gracefully', async () => {
    const hasher = createAssetHasher();
    const compressor = createCssCompressor({
      ...mockCompressionConfig,
      threshold: 999999 // Very high threshold to skip compression
    });
    const minifier = createCssMinifier({
      ...mockOptimizationConfig,
      minify: false // Disable minification
    });
    const generator = createManifestGenerator(mockOutputPaths);

    const chunks = [createMockChunk({ id: '1', name: 'main' })];

    // Process with limitations
    const minifiedChunks = await minifier.minifyChunks(chunks);
    const hashes = hasher.hashChunks(minifiedChunks);
    const compressions = await compressor.compressChunks(minifiedChunks);
    const manifest = generator.generateManifest(minifiedChunks, hashes, compressions);

    // Should still work but with no optimization
    expect(minifiedChunks[0].content).toBe(chunks[0].content); // No minification
    expect(compressions.get('1')).toHaveLength(0); // No compression
    expect(manifest.buildConfig.compression).toBe(false);
    expect(manifest.stats.compressionRatio).toBe(1);
  });
}); 