# Tailwind Enigma Plugin

A powerful Tailwind CSS plugin that integrates optimized utility classes from Enigma's pattern analysis into your development workflow.

## Overview

The Tailwind Enigma Plugin automatically generates optimized utility classes based on your project's CSS usage patterns, reducing bundle sizes while maintaining development velocity. It seamlessly integrates with your existing Tailwind CSS setup and provides intelligent autocomplete suggestions.

## Features

- 🚀 **Automatic Utility Generation**: Creates optimized utility classes from frequent patterns
- 🔥 **Hot Reloading**: Watches pattern files and regenerates utilities in development
- 💡 **IDE Integration**: Provides autocomplete and IntelliSense support
- 📊 **Pattern Analysis**: Leverages Enigma's frequency and co-occurrence analysis
- 🎯 **Configurable**: Extensive configuration options for different use cases
- 🔧 **TypeScript Support**: Full TypeScript definitions included

## Installation

### 1. Install the Plugin

```bash
npm install tailwind-enigma
# or
yarn add tailwind-enigma
# or
pnpm add tailwind-enigma
```

### 2. Add to Tailwind Configuration

```javascript
// tailwind.config.js
import tailwindEnigma from "tailwind-enigma";

export default {
  content: ["./src/**/*.{html,js,ts,jsx,tsx}"],
  theme: {
    extend: {},
  },
  plugins: [
    tailwindEnigma({
      // Configuration options
      patterns: {
        enabled: true,
        minFrequency: 2,
      },
      utilities: {
        enabled: true,
        prefix: "tw-opt-",
      },
      development: {
        hotReload: true,
        generateAutocomplete: true,
      },
    }),
  ],
};
```

### 3. Generate Pattern Data

First, run Enigma analysis on your project to generate pattern data:

```bash
# Run Enigma analysis (example)
npx enigma analyze ./src --output ./.enigma/
```

This creates the pattern and frequency files that the plugin uses to generate optimized utilities.

## Configuration

### Complete Configuration Example

```javascript
import tailwindEnigma from "tailwind-enigma";

export default {
  plugins: [
    tailwindEnigma({
      // Pattern analysis configuration
      patterns: {
        enabled: true, // Enable pattern analysis
        minFrequency: 2, // Minimum frequency for inclusion
        includeVariants: true, // Include hover, focus variants
        analyzeCoOccurrence: true, // Analyze class co-occurrence
      },

      // Utility class generation
      utilities: {
        enabled: true, // Enable utility generation
        prefix: "tw-opt-", // Prefix for generated classes
        generateResponsive: true, // Generate responsive variants
        generateHover: true, // Generate hover variants
        generateFocus: true, // Generate focus variants
      },

      // Development features
      development: {
        hotReload: true, // Enable hot reloading
        watchPatterns: true, // Watch pattern files
        generateAutocomplete: true, // Generate autocomplete config
        logOptimizations: false, // Log to console
      },

      // Integration settings
      integration: {
        useExistingOptimizer: true, // Use existing TailwindOptimizer
        enablePostCSSIntegration: true, // Enable PostCSS integration
        preserveComments: false, // Preserve debug comments
      },

      // File paths
      paths: {
        patternsFile: "./.enigma/patterns.json",
        frequencyFile: "./.enigma/frequency.json",
        autocompleteFile: "./.enigma/autocomplete.json",
      },
    }),
  ],
};
```

### Configuration Options

#### `patterns`

Controls pattern analysis behavior:

- `enabled` (boolean): Enable/disable pattern analysis
- `minFrequency` (number): Minimum frequency threshold for pattern inclusion
- `includeVariants` (boolean): Include variant patterns (hover, focus, etc.)
- `analyzeCoOccurrence` (boolean): Analyze class co-occurrence patterns

#### `utilities`

Controls utility class generation:

- `enabled` (boolean): Enable/disable utility generation
- `prefix` (string): Prefix for generated utility classes
- `generateResponsive` (boolean): Generate responsive variants
- `generateHover` (boolean): Generate hover state variants
- `generateFocus` (boolean): Generate focus state variants

#### `development`

Development-specific features:

- `hotReload` (boolean): Enable hot reloading of pattern changes
- `watchPatterns` (boolean): Watch pattern files for changes
- `generateAutocomplete` (boolean): Generate autocomplete configuration
- `logOptimizations` (boolean): Log optimization activities to console

#### `integration`

Integration with existing tools:

- `useExistingOptimizer` (boolean): Use existing TailwindOptimizer plugin
- `enablePostCSSIntegration` (boolean): Enable PostCSS integration
- `preserveComments` (boolean): Preserve debug comments in output

#### `paths`

File path configuration:

- `patternsFile` (string): Path to patterns analysis file
- `frequencyFile` (string): Path to frequency analysis file
- `autocompleteFile` (string): Path to autocomplete configuration file

## Usage

### Basic Usage

Once configured, the plugin automatically generates optimized utility classes based on your pattern data:

```html
<!-- Instead of writing this repeatedly: -->
<div class="flex items-center justify-center p-4 bg-white shadow-lg rounded-lg">
  Content
</div>

<!-- Use the generated optimized class: -->
<div class="tw-opt-0">Content</div>
```

### Generated Utility Classes

The plugin generates two types of utility classes:

1. **Pattern-based utilities**: From frequent class combinations

   - `tw-opt-0`, `tw-opt-1`, etc.

2. **Frequency-based utilities**: From high-frequency individual classes
   - `tw-opt-freq-0`, `tw-opt-freq-1`, etc.

### IDE Integration

#### VS Code

Add to your `.vscode/settings.json`:

```json
{
  "tailwindCSS.experimental.classRegex": [
    ["tw-opt-[\\w-]+", "[\"'`]([^\"'`]*).*?[\"'`]"]
  ],
  "tailwindCSS.includeLanguages": {
    "javascript": "javascript",
    "typescript": "typescript",
    "javascriptreact": "javascript",
    "typescriptreact": "typescript"
  }
}
```

#### WebStorm/IntelliJ

The plugin generates autocomplete configuration that can be imported into WebStorm for enhanced IntelliSense.

## TypeScript Support

Full TypeScript definitions are included:

```typescript
import tailwindEnigma, { TailwindEnigmaConfig } from "tailwind-enigma";

const config: TailwindEnigmaConfig = {
  patterns: {
    enabled: true,
    minFrequency: 3,
  },
  utilities: {
    prefix: "opt-",
  },
};

export default {
  plugins: [tailwindEnigma(config)],
};
```

## Advanced Usage

### Custom Pattern Loading

```javascript
import {
  loadPatternData,
  generateUtilitiesFromPatterns,
} from "tailwind-enigma";

// Load custom pattern data
const { patterns, frequencies } = loadPatternData(
  "./custom/patterns.json",
  "./custom/frequency.json",
);

// Generate utilities programmatically
const utilities = generateUtilitiesFromPatterns(patterns, frequencies, config);
```

### Integration with Build Tools

#### Webpack

```javascript
// webpack.config.js
module.exports = {
  // ... other config
  plugins: [
    new (require("webpack-watch-files-plugin"))({
      files: ["./.enigma/*.json"],
      verbose: true,
    }),
  ],
};
```

#### Vite

```javascript
// vite.config.js
export default {
  // ... other config
  server: {
    watch: {
      include: ["./.enigma/*.json"],
    },
  },
};
```

## Pattern Data Format

### Patterns File Structure

```json
{
  "patterns": [
    {
      "type": "atomic",
      "frequency": 15,
      "classes": ["flex", "items-center", "justify-center"],
      "properties": [
        { "property": "display", "value": "flex" },
        { "property": "align-items", "value": "center" },
        { "property": "justify-content", "value": "center" }
      ],
      "complexity": 3,
      "coOccurrenceStrength": 0.8
    }
  ]
}
```

### Frequency File Structure

```json
{
  "frequencyMap": {
    "flex": 45,
    "items-center": 32,
    "justify-center": 28,
    "bg-white": 25,
    "shadow-lg": 18
  },
  "totalClasses": 1250,
  "analyzedAt": "2025-01-20T18:25:00.000Z"
}
```

## Performance Considerations

### Bundle Size Impact

The plugin generates optimized utility classes that can significantly reduce your CSS bundle size:

- **Before**: Multiple repeated class combinations
- **After**: Single optimized utility classes

### Development Performance

- Hot reloading is optimized for development
- Pattern file watching uses efficient file system APIs
- Autocomplete generation is cached

### Production Optimization

- Comments are stripped in production builds
- Unused utilities are purged by Tailwind's purge process
- Generated utilities follow Tailwind's optimization patterns

## Troubleshooting

### Common Issues

#### Plugin Not Generating Utilities

1. **Check pattern files exist**:

   ```bash
   ls -la ./.enigma/
   ```

2. **Verify file format**:

   ```bash
   cat ./.enigma/patterns.json | jq .
   ```

3. **Check minimum frequency threshold**:
   ```javascript
   patterns: {
     minFrequency: 1, // Lower threshold for testing
   }
   ```

#### Hot Reloading Not Working

1. **Verify file watching**:

   ```javascript
   development: {
     hotReload: true,
     watchPatterns: true,
     logOptimizations: true, // Enable logging
   }
   ```

2. **Check file permissions**:
   ```bash
   chmod 644 ./.enigma/*.json
   ```

#### TypeScript Errors

1. **Install type definitions**:

   ```bash
   npm install --save-dev @types/tailwindcss
   ```

2. **Add to tsconfig.json**:
   ```json
   {
     "compilerOptions": {
       "types": ["tailwind-enigma"]
     }
   }
   ```

### Debug Mode

Enable debug logging:

```javascript
development: {
  logOptimizations: true,
}
```

Or set environment variable:

```bash
TAILWIND_ENIGMA_DEBUG=true npm run dev
```

## API Reference

### Plugin Function

```typescript
function tailwindEnigma(config?: TailwindEnigmaConfig): PluginCreator;
```

### Helper Functions

#### `loadPatternData`

```typescript
function loadPatternData(
  patternsPath: string,
  frequencyPath: string,
): {
  patterns: PatternData[];
  frequencies: Map<string, number>;
};
```

#### `generateUtilitiesFromPatterns`

```typescript
function generateUtilitiesFromPatterns(
  patterns: PatternData[],
  frequencies: Map<string, number>,
  config: TailwindEnigmaConfig,
): Record<string, Record<string, string>>;
```

## Examples

### React Project

```javascript
// tailwind.config.js
import tailwindEnigma from "tailwind-enigma";

export default {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  plugins: [
    tailwindEnigma({
      patterns: { minFrequency: 3 },
      utilities: { prefix: "opt-" },
      development: { hotReload: true },
    }),
  ],
};
```

### Next.js Project

```javascript
// tailwind.config.js
import tailwindEnigma from "tailwind-enigma";

export default {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
  ],
  plugins: [
    tailwindEnigma({
      paths: {
        patternsFile: "./analysis/patterns.json",
        frequencyFile: "./analysis/frequency.json",
      },
    }),
  ],
};
```

### Vue.js Project

```javascript
// tailwind.config.js
import tailwindEnigma from "tailwind-enigma";

export default {
  content: ["./src/**/*.{vue,js,ts}"],
  plugins: [
    tailwindEnigma({
      utilities: { generateResponsive: true },
      development: { generateAutocomplete: true },
    }),
  ],
};
```

## Contributing

See [CONTRIBUTING.md](../CONTRIBUTING.md) for development setup and contribution guidelines.

## License

MIT License - see [LICENSE](../LICENSE) for details.

## Changelog

### v1.0.0

- Initial release
- Pattern-based utility generation
- Hot reloading support
- IDE integration
- TypeScript definitions
- Comprehensive documentation
