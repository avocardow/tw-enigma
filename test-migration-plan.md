# Test Migration Plan - Task #9

## Migration Overview
- **Total Test Files:** 51
- **Total Lines:** ~36,618
- **Target Packages:** core, cli
- **Migration Strategy:** Categorize by functionality, maintain structure

## Test Categorization

### Core Package Tests (packages/core/tests/)
**Core CSS Processing & Optimization:**
- `cssGeneration.test.ts` - CSS generation and @apply directives
- `cssInjector.test.ts` - CSS injection into HTML files
- `cssChunker.test.ts` - CSS chunking and splitting
- `cssOptimizationCli.test.ts` - Core optimization logic (not CLI interface)
- `cssOutputConfig.test.ts` - CSS output configuration
- `cssOutputOrchestrator.test.ts` - CSS output orchestration
- `cssReportGenerator.test.ts` - CSS report generation

**Pattern Analysis & Processing:**
- `patternAnalysis.test.ts` - Pattern frequency analysis
- `patternValidator.test.ts` - Pattern validation logic
- `nameGeneration.test.ts` - CSS class name generation

**File Processing & Extraction:**
- `htmlExtractor.test.ts` - HTML class extraction
- `htmlRewriter.test.ts` - HTML rewriting logic
- `jsExtractor.test.ts` - JavaScript class extraction
- `jsRewriter.test.ts` - JavaScript rewriting logic
- `fileDiscovery.test.ts` - File discovery and scanning
- `pathUtils.test.ts` - Path utilities and helpers

**Atomic Operations & File Management:**
- `atomicOps/AtomicFileCreator.test.ts` - Atomic file creation
- `atomicOps/AtomicFileManager.test.ts` - Atomic file management
- `atomicOps/AtomicFileReader.test.ts` - Atomic file reading
- `atomicOps/AtomicFileWriter.test.ts` - Atomic file writing
- `atomicOps/AtomicOperationsSystem.test.ts` - Atomic operations system
- `atomicOps/AtomicPermissionManager.test.ts` - Atomic permission management
- `atomicOps/AtomicRollbackManager.test.ts` - Atomic rollback management
- `fileIntegrity.test.ts` - File integrity validation

**Caching & Performance:**
- `optimizationCache.test.ts` - Optimization caching
- `optimizationCacheIntegration.test.ts` - Cache integration
- `cacheManager.test.ts` - Cache management
- `streamOptimizer.test.ts` - Stream optimization

**Framework Detection & Integration:**
- `frameworkDetector/frameworkDetector.test.ts` - Framework detection logic
- `integrations/integrationManager.test.ts` - Integration management

**Configuration & Validation:**
- `config.test.ts` - Core configuration logic
- `configValidation.test.ts` - Configuration validation
- `productionCssConfigManager.test.ts` - Production CSS configuration

**Error Handling & Logging:**
- `errorHandler.test.ts` - Error handling system
- `logger.test.ts` - Logging functionality

**PostCSS Integration:**
- `postcss/basic.test.ts` - PostCSS basic functionality

**Tailwind Plugin System:**
- `tailwindPlugin.test.ts` - Tailwind plugin functionality
- `plugin-system.test.ts` - Plugin system architecture

**Utilities & Helpers:**
- `assetHasher.test.ts` - Asset hashing utilities

**Dry Run & Development:**
- `dryRun/dryRunIntegration.test.ts` - Dry run functionality
- `devDashboardEnhanced.test.ts` - Development dashboard
- `devExperience.test.ts` - Developer experience features
- `devHotReload.test.ts` - Hot reload functionality
- `devIdeIntegration.test.ts` - IDE integration
- `devTools.test.ts` - Development tools

### CLI Package Tests (packages/cli/tests/)
**CLI Interface & Commands:**
- `cli.test.ts` - Main CLI interface and commands

**Output & Reporting:**
- `output/ciIntegration.test.ts` - CI integration output
- `reporter.test.ts` (from tests/reporter.test.ts) - CLI reporting
- `results/reporter.test.ts` (from tests/integration/reporter.test.ts) - Results reporting

### Integration Tests (tests/integration/ - Keep at root level)
**Cross-Package Integration:**
- `integration/optimization-pipeline.test.ts` - Full optimization pipeline
- `integration/tailwind.test.ts` - Tailwind integration testing

### Shared Test Infrastructure
**Test Fixtures & Utilities:**
- `tests/fixtures/` - Keep at root level for shared access
- `tests/setup.ts` - Root-level test setup
- `tests/utils/` - Shared test utilities
- `tests/performance/` - Performance testing infrastructure

## Migration Steps

### Phase 1: Core Package Migration
1. Create directory structure in packages/core/tests/
2. Migrate core functionality tests
3. Update imports to use @tw-enigma/core
4. Validate test execution

### Phase 2: CLI Package Migration  
1. Create directory structure in packages/cli/tests/
2. Migrate CLI-specific tests
3. Update imports to use @tw-enigma/cli and @tw-enigma/core
4. Validate CLI test execution

### Phase 3: Integration & Shared Resources
1. Keep integration tests at root level
2. Update shared fixtures and utilities
3. Configure workspace-level test coordination
4. Validate full test suite execution

### Phase 4: Cleanup & Validation
1. Remove original test files after successful migration
2. Update package.json test scripts
3. Configure Turbo for test orchestration
4. Validate CI/CD integration

## Import Path Updates Required

### Core Package Tests
- `../src/` → `@tw-enigma/core`
- Relative imports within core → `@tw-enigma/core/[module]`

### CLI Package Tests  
- `../src/` → `@tw-enigma/cli`
- Core functionality imports → `@tw-enigma/core`

### Integration Tests
- Core imports → `@tw-enigma/core`
- CLI imports → `@tw-enigma/cli`

## Test Script Configuration

### Root package.json
```json
{
  "scripts": {
    "test": "turbo run test",
    "test:core": "turbo run test --filter=@tw-enigma/core",
    "test:cli": "turbo run test --filter=@tw-enigma/cli",
    "test:integration": "vitest run tests/integration",
    "test:watch": "turbo run test:watch",
    "test:coverage": "turbo run test:coverage"
  }
}
```

### Package-level scripts
```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage"
  }
}
``` 