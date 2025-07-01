# TW-Enigma CLI Flag Specifications - Task 3.2

## Overview
Technical specifications for new CLI flags and command updates to implement maximum optimization as the default behavior with degradation options.

## New Flag Specifications

### 1. `--partial` Flag

**Purpose**: Degradation flag to enable partial optimization instead of maximum optimization.

**Technical Specification**:
- **Type**: `boolean`
- **Default**: `false`
- **Required**: No (optional)
- **Short form**: None (to avoid conflicts)
- **Commander.js definition**: `.option('--partial', 'Enable partial optimization instead of maximum optimization', false)`

**Behavior**:
- When `true`: Uses simplified optimization with limited pattern detection
- When `false` (default): Uses maximum optimization with complete pattern analysis
- **Conflicts**: Mutually exclusive with `--readable` (both cannot be true)
- **Precedence**: If both `--partial` and `--readable` specified, show error

**Implementation Details**:
- Reduces data structure complexity (smaller cache sizes, reduced trie depth)
- Limits co-occurrence analysis distance to 2 (vs default 5)
- Reduces minimum frequency threshold effectively (+1 to user setting)
- Disables advanced pattern grouping
- Uses faster but less thorough identifier generation

**Error Messages**:
- `"Error: --partial and --readable flags cannot be used together"`
- `"Error: --partial conflicts with --max-passes > 1"`

### 2. `--readable` Flag  

**Purpose**: Degradation flag to prioritize human-readable output over maximum optimization.

**Technical Specification**:
- **Type**: `boolean`
- **Default**: `false` 
- **Required**: No (optional)
- **Short form**: `-r`
- **Commander.js definition**: `.option('-r, --readable', 'Prioritize human-readable output over maximum optimization', false)`

**Behavior**:
- When `true`: Generates longer, more descriptive class identifiers
- When `false` (default): Uses shortest possible identifiers for maximum optimization
- **Conflicts**: Mutually exclusive with `--partial`
- **Precedence**: If both specified, show error

**Implementation Details**:
- Sets identifier generation to use descriptive prefixes (e.g., "btn-", "txt-", "bg-")
- Increases `identifierStartLength` to 3 characters minimum
- Uses semantic naming when possible
- Preserves original class names for utilities below frequency threshold
- Adds comments to generated CSS for better understanding

**Error Messages**:
- `"Error: --readable and --partial flags cannot be used together"`

### 3. `--max-passes` Flag

**Purpose**: Control the number of optimization iteration passes.

**Technical Specification**:
- **Type**: `number` (integer)
- **Default**: `3`
- **Required**: No (optional)
- **Range**: `1-10`
- **Short form**: None
- **Commander.js definition**: `.option('--max-passes <number>', 'Maximum number of optimization passes (1-10)', '3')`

**Behavior**:
- Determines how many times the optimization algorithm runs
- Higher values = more thorough optimization but longer processing time
- Pass 1: Basic pattern detection and consolidation
- Pass 2: Cross-pattern optimization and refinement  
- Pass 3+: Micro-optimizations and edge case handling

**Implementation Details**:
- Validates input is integer between 1-10
- Each pass refines the optimization result
- Early termination if no improvements found
- Progress reporting for passes > 1
- Memory usage scales with pass count

**Error Messages**:
- `"Error: --max-passes must be a number between 1 and 10"`
- `"Error: --max-passes must be an integer"`
- `"Error: --partial mode only supports --max-passes=1"`

### 4. Modified `--pretty` Flag Behavior

**Current**: General pretty mode formatting
**New Purpose**: Focus specifically on CSS output formatting (not a degradation flag)

**Technical Specification**:
- **Type**: `boolean`
- **Default**: `false`
- **Required**: No (optional)
- **Short form**: `-p` (maintain compatibility)
- **Commander.js definition**: `.option('-p, --pretty', 'Format CSS output for better readability', false)`

**Updated Behavior**:
- When `true`: Formats CSS with proper indentation, spacing, and comments
- When `false` (default): Minified CSS output
- **No conflicts**: Can be used with any other flags
- **Scope**: Only affects CSS output formatting, not optimization level

## Updated EnigmaOptions Interface

### Current Interface (lines 28-55):
```typescript
interface EnigmaOptions {
  // ... existing properties ...
  useOptimizer?: boolean;
  // ... rest of properties ...
}
```

### New Interface Specification:
```typescript
interface EnigmaOptions {
  input?: string;
  output?: string;
  length?: string | number;
  minFrequency?: string | number;
  dryRun?: boolean;
  verbose?: boolean;
  
  // REMOVED: useOptimizer - maximum optimization is now default
  
  // NEW: Degradation flags
  partial?: boolean;           // Enable partial optimization
  readable?: boolean;          // Enable human-readable output
  maxPasses?: string | number; // Number of optimization passes
  
  // EXISTING: Keep all current advanced options
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
  
  // EXISTING: Pretty mode (updated behavior)
  pretty?: boolean;            // CSS formatting only
}
```

## Command Behavior Changes

### Default Optimization Level Change

**Current Behavior**:
```typescript
// Line 127 in enigma.ts
if (options.useOptimizer) {
  await runCompleteConsolidation(...);
  return;
}
// Legacy optimization continues...
```

**New Behavior**:
```typescript
// Maximum optimization is default
if (options.partial) {
  await runPartialOptimization(...);
  return;
} else if (options.readable) {
  await runReadableOptimization(...);
  return;
}
// Maximum optimization continues as default...
```

### Flag Interaction Logic

**Validation Function**:
```typescript
function validateFlags(options: EnigmaOptions): void {
  // Mutual exclusion
  if (options.partial && options.readable) {
    throw new Error('Error: --partial and --readable flags cannot be used together');
  }
  
  // Max passes validation
  if (options.maxPasses) {
    const passes = parseInt(String(options.maxPasses), 10);
    if (isNaN(passes) || passes < 1 || passes > 10) {
      throw new Error('Error: --max-passes must be a number between 1 and 10');
    }
    if (options.partial && passes > 1) {
      throw new Error('Error: --partial mode only supports --max-passes=1');
    }
  }
}
```

## Help Output Updates

### Main CLI Help (Global Level):
```
Options:
  --partial                              Enable partial optimization (less thorough, faster)
  --readable, -r                         Prioritize human-readable output over maximum optimization  
  --max-passes <number>                  Maximum number of optimization passes (1-10) (default: 3)
  --pretty, -p                          Format CSS output for better readability
```

### Enigma Subcommand Help:
```
Options:
  -i, --input <path>                     Input directory to scan for files (default: "./src")
  -o, --output <path>                    Output CSS file path (default: "./enigma.css")
  -l, --length <number>                  Length of generated class identifiers (default: "1")
  -m, --min-frequency <number>           Minimum pattern frequency threshold (default: "2")
  --dry-run                              Preview changes without writing files (default: false)
  -v, --verbose                          Enable verbose logging (default: false)
  
  Optimization Level:
  --partial                              Enable partial optimization instead of maximum (default: false)
  -r, --readable                         Generate human-readable identifiers (default: false)
  --max-passes <number>                  Number of optimization passes (1-10) (default: 3)
  
  Output Formatting:
  -p, --pretty                          Format CSS output for readability (default: false)
  
  [... existing advanced options ...]
```

## Implementation Priority Order

### Phase 1: Core Flag Infrastructure
1. Add new properties to EnigmaOptions interface
2. Add flag definitions to enigmaCommand
3. Implement flag validation logic
4. Update help documentation

### Phase 2: Optimization Logic Updates  
1. Remove useOptimizer dependency
2. Implement partial optimization mode
3. Implement readable optimization mode
4. Implement max-passes iteration logic

### Phase 3: Enhanced Reporting
1. Add consolidation ratio reporting
2. Add character savings metrics
3. Update progress indicators
4. Enhance verbose output

## Backward Compatibility Strategy

### Migration Path:
1. **Deprecated `--use-optimizer`**: Show warning but still honor for transition period
2. **New `--legacy` flag**: Provide explicit way to use old optimization
3. **Documentation updates**: Clear migration guide for existing users
4. **Version warnings**: Alert users about behavior changes

### Compatibility Flags:
```typescript
// Temporary backward compatibility
legacy?: boolean;           // Use legacy optimization (deprecated)
useOptimizer?: boolean;     // Deprecated - show warning
```

### Warning Messages:
- `"Warning: --use-optimizer is deprecated. Maximum optimization is now default. Use --partial or --readable to reduce optimization level."`
- `"Warning: --legacy flag will be removed in v2.0. Please update your scripts."`

## Edge Cases and Error Handling

### Input Validation:
1. **File existence**: Validate input directory exists
2. **Write permissions**: Check output directory is writable  
3. **Flag combinations**: Validate mutually exclusive flags
4. **Numeric ranges**: Validate --max-passes within bounds

### Graceful Degradation:
1. **Memory pressure**: Automatically reduce passes if memory constrained
2. **Large datasets**: Warning when processing might be slow
3. **No patterns found**: Helpful messaging about frequency thresholds
4. **Timeout handling**: Graceful termination on long-running optimizations

### stdin/stdout Support:
While not explicitly required, the design should accommodate:
- Reading from stdin when no --input specified
- Writing to stdout when --output is "-"
- Piping between commands
- Progress output to stderr to avoid contaminating stdout

## Success Metrics

### Implementation Success Criteria:
1. All new flags parse correctly with validation
2. Flag conflicts properly detected and reported
3. Help output is clear and comprehensive
4. Backward compatibility maintained during transition
5. Error messages are actionable and specific
6. Performance impact of new features is minimal

### User Experience Goals:
1. Default behavior provides maximum optimization
2. Degradation flags offer clear performance/readability tradeoffs
3. Flag names are intuitive and self-documenting
4. Error messages guide users to correct usage
5. Migration from current CLI is straightforward