# TW-Enigma CLI Command Structure Analysis

## Overview
Analysis of the current CLI architecture for Task 3.1 - preparing for maximum optimization default behavior implementation.

## Command Hierarchy

### Primary Entry Point: `/packages/cli/src/index.ts`
- **Main Program**: `enigma` (program name)
- **Description**: "🎨 @tw-enigma/cli - Intelligent CSS optimization engine"
- **Default Action**: `enigmaAction` (imports from commands/enigma.ts)

### Available Commands (via registerCommands):
1. **enigma** - Main consolidation command
2. **init-config** - Create sample configuration file
3. **css-config** - Generate/validate CSS output configuration  
4. **template** - Process templates with placeholder replacement
5. **scramble** - Integrate scramble effect into build output
6. **optimize** - Advanced CSS pattern optimization (CompleteConsolidator)

## Main CLI Options (Global Level)
Located in `/packages/cli/src/index.ts` lines 115-135:

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--input <path>` | string | none | Input directory to scan for CSS files |
| `--output <path>` | string | "enigma.css" | Output path for generated CSS file |
| `--length <number>` | number | 1 | Length of generated class names |
| `--min-frequency <number>` | number | 2 | Minimum frequency for pattern detection |
| `--dry-run` | boolean | false | Preview changes without writing files |
| `--verbose` | boolean | false | Enable verbose logging |
| `--debug` | boolean | false | Enable debug mode |
| `--pretty` | boolean | false | Enable pretty mode for formatted output |
| `-p` | boolean | false | Short flag for pretty mode |
| `--config <path>` | string | none | Path to configuration file |
| `-c, --config <path>` | string | none | Alternative config syntax |
| `--quiet` | boolean | false | Quiet mode (only warnings/errors) |
| `--format <format>` | string | none | Output format (json, console, markdown, html, all) |
| `--max-concurrency <number>` | number | none | Maximum concurrent operations |
| `--exclude-patterns <patterns...>` | array | none | Patterns to exclude from processing |
| `--use-optimizer` | boolean | false | **KEY**: Use CompleteConsolidator |
| `--data-structure-max-entries <number>` | number | none | Memory optimization |
| `--enable-lru-eviction` | boolean | false | LRU eviction for memory management |
| `--pattern-cache-size <number>` | number | none | Pattern normalization cache size |
| `--memory-efficient-mode` | boolean | false | Memory-efficient processing |

## Enigma Subcommand Structure
Located in `/packages/cli/src/commands/enigma.ts` lines 57-95:

### EnigmaOptions Interface (lines 28-55):
```typescript
interface EnigmaOptions {
  input?: string;
  output?: string;
  length?: string | number;
  minFrequency?: string | number;
  dryRun?: boolean;
  verbose?: boolean;
  useOptimizer?: boolean;              // KEY: Controls CompleteConsolidator usage
  caseSensitive?: boolean;
  enablePatternGrouping?: boolean;
  enableCoOccurrenceAnalysis?: boolean;
  maxCoOccurrenceDistance?: string | number;
  includeFrameworkAnalysis?: boolean;
  enableValidation?: boolean;
  outputFormat?: 'map' | 'array' | 'json';
  sortBy?: 'frequency' | 'alphabetical' | 'source';
  sortDirection?: 'asc' | 'desc';
  enableAtomicWrites?: boolean;
  createBackups?: boolean;
  identifierBase?: string | number;
  identifierStartLength?: string | number;
  identifierMaxLength?: string | number;
  identifierPrefix?: string;
  dataStructureMaxEntries?: string | number;
  enableLruEviction?: boolean;
  patternCacheSize?: string | number;
  memoryEfficientMode?: boolean;
}
```

### Enigma Command Options (lines 59-84):
| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `-i, --input <path>` | string | "./src" | Input directory to scan |
| `-o, --output <path>` | string | "./enigma.css" | Output CSS file path |
| `-l, --length <number>` | string | "1" | Length of generated class identifiers |
| `-m, --min-frequency <number>` | string | "2" | Minimum pattern frequency threshold |
| `--dry-run` | boolean | false | Preview changes without writing |
| `-v, --verbose` | boolean | false | Enable verbose logging |
| `--use-optimizer` | boolean | **false** | **KEY**: Use CompleteConsolidator |
| `--case-sensitive` | boolean | false | Case-sensitive pattern matching |
| `--enable-pattern-grouping` | boolean | **true** | Pattern grouping analysis |
| `--enable-co-occurrence-analysis` | boolean | **true** | Co-occurrence analysis |
| `--max-co-occurrence-distance <number>` | string | "5" | Max distance for co-occurrence |
| `--include-framework-analysis` | boolean | **true** | Framework-specific analysis |
| `--enable-validation` | boolean | false | Validation of extracted patterns |
| `--output-format <format>` | string | "map" | Output format (map/array/json) |
| `--sort-by <criteria>` | string | "frequency" | Sorting criteria |
| `--sort-direction <direction>` | string | "desc" | Sorting direction |
| `--enable-atomic-writes` | boolean | **true** | Atomic file operations |
| `--create-backups` | boolean | **true** | Backup files before modification |
| `--identifier-base <number>` | string | "26" | Base for identifier generation |
| `--identifier-start-length <number>` | string | "1" | Starting length for identifiers |
| `--identifier-max-length <number>` | string | "3" | Maximum length for identifiers |
| `--identifier-prefix <string>` | string | "" | Prefix for generated identifiers |
| `--data-structure-max-entries <number>` | number | none | Memory optimization |
| `--enable-lru-eviction` | boolean | false | LRU eviction |
| `--pattern-cache-size <number>` | number | none | Pattern cache size |
| `--memory-efficient-mode` | boolean | false | Memory-efficient mode |

## Current Optimization Behavior

### Legacy Path (Default - useOptimizer=false):
1. **File Discovery**: `discoverFiles(inputPath)` - scans for HTML/JS/JSX/TS/TSX files
2. **Class Extraction**: Uses `createHtmlExtractor()` and `createJsExtractor()` from @tw-enigma/core
3. **Pattern Analysis**: 
   - `generateFrequencyMap(patternInput, options)`
   - `generateCoOccurrenceAnalysis(frequencyMap, options)`
4. **Identifier Generation**: Simple base-26 conversion via `generateShortId()`
5. **CSS Generation**: Creates CSS rules with @apply directives
6. **File Modification**: Direct regex-based class replacement

### Enhanced Path (useOptimizer=true):
1. **File Discovery**: Same as legacy
2. **Enhanced Extraction**: Same extractors but processed for CompleteConsolidator
3. **Complete Consolidation**: `runCompleteConsolidation()` function calls `createCompleteConsolidator()`
4. **Advanced Processing**: Uses all data structures and optimization features

## Core Function Integration

### Current @tw-enigma/core Usage:
1. **`createHtmlExtractor()`**: HTML class extraction (lines 135, 357)
2. **`createJsExtractor()`**: JavaScript/JSX class extraction (lines 136, 365) 
3. **`generateFrequencyMap()`**: Pattern frequency analysis (line 190)
4. **`generateCoOccurrenceAnalysis()`**: Co-occurrence pattern detection (line 196)
5. **`createCompleteConsolidator()`**: Enhanced optimization (lines 419, 403)

### File Extensions Supported:
- HTML: `.html`, `.htm`
- JavaScript: `.js`, `.jsx`, `.ts`, `.tsx`

## Command Dependencies and Order

### Parsing Logic:
1. Commander.js processes global options first
2. Subcommand options override/extend global options
3. Option validation occurs in `runEnigmaOptimization()` (lines 100-104)
4. Type coercion: string inputs converted to numbers where needed

### Critical Decision Points:
- **Line 127**: `if (options.useOptimizer)` - determines optimization path
- **Line 112**: Console output shows which path is being used
- **Lines 118-124**: Early exit if no files found

## Flag Inconsistencies and Issues

### Current Issues:
1. **Duplicate `--pretty` flag**: Exists in both global and subcommand scopes
2. **Type inconsistencies**: Some numeric options are typed as `string | number`
3. **Boolean option defaults**: Inconsistent between interface and command definition
4. **Option inheritance**: Global options don't properly inherit to subcommands

### Missing Features for Task 3:
1. **No `--max-passes`** flag for optimization iterations
2. **No degradation flags**: `--partial`, `--readable` (only `--pretty` exists)
3. **No consolidation ratio reporting** in basic output
4. **No character savings metrics** in standard reporting

## Backward Compatibility Considerations

### Current Behavior Preservation:
- Default `useOptimizer=false` maintains legacy behavior
- All existing flags functional
- File discovery patterns unchanged
- Output format consistent

### Required Changes for Task 3:
1. **Default flip**: `useOptimizer` should default to `true`
2. **New degradation flags**: Add `--partial`, `--readable`, modify `--pretty` semantics
3. **Add `--max-passes`**: Control optimization iterations
4. **Enhanced reporting**: Add consolidation ratio and character savings to default output
5. **Backward compatibility flags**: Possibly add `--legacy` or `--simple` mode

## Current Help Documentation

### Main CLI Help:
- Clear structure with sections for Options and Commands
- Commands listed with descriptions
- Options show defaults where applicable

### Enigma Subcommand Help:
- Comprehensive option listing
- Default values shown in parentheses
- Boolean flags show explicit defaults

### Documentation Gaps:
- No examples of common usage patterns
- Complex optimization options lack detailed explanations
- Relationship between global and subcommand options unclear

## Summary

The current CLI structure is well-organized with clear separation between global and command-specific options. The key architectural decision point is the `--use-optimizer` flag that switches between legacy and enhanced optimization paths. For Task 3, the primary changes will involve:

1. **Flipping the default** from legacy to enhanced optimization
2. **Adding degradation flags** to allow users to opt down from maximum optimization
3. **Adding `--max-passes`** for iteration control
4. **Enhanced reporting** with consolidation metrics
5. **Maintaining backward compatibility** through appropriate flag design

The current structure supports these changes well, with the main modification being to reverse the optimization decision logic and add the new flags to both the interface and command definitions.