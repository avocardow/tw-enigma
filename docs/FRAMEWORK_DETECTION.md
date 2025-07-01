# Framework Detection System

## Overview

TW-Enigma includes a comprehensive framework detection system that automatically identifies the frontend framework and build system being used in your project. This enables automatic configuration optimization and framework-specific features.

## Table of Contents

1. [Supported Frameworks](#supported-frameworks)
2. [Detection Methods](#detection-methods)
3. [Configuration](#configuration)
4. [Manual Override](#manual-override)
5. [Custom Framework Detection](#custom-framework-detection)
6. [API Reference](#api-reference)
7. [Troubleshooting](#troubleshooting)

## Supported Frameworks

### React
- **React (CRA)**: Create React App projects
- **Next.js**: Full-stack React framework with SSR/SSG
- **Vite + React**: Lightning-fast React development

### Vue
- **Vue CLI**: Standard Vue.js projects
- **Nuxt.js**: Universal Vue.js framework with SSR/SSG
- **Vite + Vue**: Modern Vue.js development

### Angular
- **Angular CLI**: Official Angular toolchain
- **Angular Universal**: SSR-enabled Angular applications

### Other Frameworks
- **Svelte**: Compile-time optimized framework
- **SvelteKit**: Full-stack Svelte framework
- **Solid.js**: Fine-grained reactive JavaScript library
- **Preact**: Fast 3kB alternative to React

## Detection Methods

The framework detection system uses multiple methods to accurately identify your project setup:

### 1. Package.json Analysis

Analyzes dependencies and devDependencies to identify framework packages:

```javascript
// React detection
{
  "dependencies": {
    "react": "^18.0.0",
    "react-dom": "^18.0.0"
  }
}

// Next.js detection
{
  "dependencies": {
    "next": "^13.0.0"
  }
}

// Vue detection
{
  "dependencies": {
    "vue": "^3.0.0"
  }
}
```

### 2. Configuration File Detection

Looks for framework-specific configuration files:

```
project/
├── next.config.js          # Next.js
├── nuxt.config.ts          # Nuxt.js
├── angular.json            # Angular CLI
├── vite.config.ts          # Vite
├── vue.config.js           # Vue CLI
├── svelte.config.js        # Svelte
└── solid.config.ts         # Solid.js
```

### 3. File Pattern Analysis

Analyzes file extensions and patterns:

```typescript
// React patterns
*.jsx, *.tsx files
App.jsx, App.tsx
index.jsx, index.tsx

// Vue patterns
*.vue files
App.vue
main.js with Vue imports

// Angular patterns
*.component.ts
*.module.ts
app.component.ts
```

### 4. Build System Detection

Identifies the underlying build system:

```typescript
// Webpack detection
webpack.config.js
@webpack/* packages

// Vite detection
vite.config.js
@vitejs/* packages

// Rollup detection
rollup.config.js
@rollup/* packages
```

## Configuration

### Basic Configuration

Enable framework detection in your TW-Enigma configuration:

```javascript
// tw-enigma.config.js
export default {
  framework: {
    // Enable automatic detection (default: true)
    autoDetect: true,
    
    // Detection confidence threshold (0-1)
    confidenceThreshold: 0.7,
    
    // Enable detection caching
    cache: true,
    
    // Custom detection rules
    customRules: [],
  }
};
```

### Advanced Configuration

```javascript
// tw-enigma.config.js
export default {
  framework: {
    detection: {
      // Enable specific detection methods
      packageAnalysis: true,
      configAnalysis: true,
      filePatternAnalysis: true,
      
      // Analysis options
      maxFileAnalysis: 100,
      includePaths: ['src/**/*'],
      excludePaths: ['node_modules/**/*'],
      
      // Timeout for detection (ms)
      timeout: 5000,
    },
    
    // Framework-specific overrides
    overrides: {
      react: {
        preset: 'react-cra',
        ssrCompatible: false,
      },
      nextjs: {
        preset: 'react-nextjs',
        ssrCompatible: true,
      },
    },
  }
};
```

## Manual Override

### Explicit Framework Declaration

Override automatic detection by explicitly declaring your framework:

```javascript
// tw-enigma.config.js
export default {
  framework: {
    type: 'react',
    preset: 'react-nextjs',
    buildSystem: 'next',
    
    // Disable auto-detection
    autoDetect: false,
  }
};
```

### Environment-Specific Overrides

```javascript
// tw-enigma.config.js
export default {
  framework: {
    autoDetect: true,
    
    // Override in specific environments
    overrides: {
      development: {
        optimizations: false,
      },
      production: {
        optimizations: true,
        preset: 'react-nextjs',
      },
    },
  }
};
```

## Custom Framework Detection

### Adding Custom Rules

Create custom detection rules for proprietary or unsupported frameworks:

```javascript
// tw-enigma.config.js
export default {
  framework: {
    customRules: [
      {
        name: 'my-custom-framework',
        detect: {
          // Package detection
          dependencies: ['my-framework'],
          devDependencies: ['my-framework-dev'],
          
          // File pattern detection
          files: ['my-framework.config.js'],
          patterns: ['*.myfw'],
          
          // Custom detection function
          detector: async (projectPath) => {
            // Custom detection logic
            const hasCustomFile = await fs.exists(
              path.join(projectPath, 'custom-marker.json')
            );
            return hasCustomFile ? 0.9 : 0;
          },
        },
        
        // Configuration when detected
        config: {
          preset: 'universal',
          optimizations: {
            strategy: 'atomic',
            cssExtraction: true,
          },
        },
      },
    ],
  }
};
```

### Plugin-based Detection

Create a detection plugin:

```typescript
// plugins/framework-detector.ts
import { FrameworkDetectorPlugin } from '@tw-enigma/core';

export class CustomFrameworkDetector implements FrameworkDetectorPlugin {
  name = 'custom-framework-detector';
  
  async detect(context: DetectionContext): Promise<DetectionResult> {
    const { projectPath, packageJson } = context;
    
    // Custom detection logic
    if (packageJson.dependencies?.['my-framework']) {
      return {
        framework: 'my-framework',
        confidence: 0.95,
        metadata: {
          version: packageJson.dependencies['my-framework'],
          buildSystem: 'custom',
        },
      };
    }
    
    return { framework: 'unknown', confidence: 0 };
  }
  
  configure(result: DetectionResult): FrameworkConfig {
    return {
      optimizations: {
        strategy: 'atomic',
        threshold: 2,
      },
      development: {
        sourceMaps: true,
        hmr: true,
      },
    };
  }
}

// Register the plugin
// tw-enigma.config.js
import { CustomFrameworkDetector } from './plugins/framework-detector';

export default {
  plugins: [
    new CustomFrameworkDetector(),
  ],
};
```

## API Reference

### FrameworkDetector Class

```typescript
class FrameworkDetector {
  constructor(options?: FrameworkDetectorOptions);
  
  // Detect framework in project
  async detect(projectPath: string): Promise<FrameworkInfo>;
  
  // Get available detectors
  getAvailableDetectors(): DetectorInfo[];
  
  // Register custom detector
  registerDetector(detector: FrameworkDetectorPlugin): void;
  
  // Clear detection cache
  clearCache(): void;
}
```

### Types

```typescript
interface FrameworkInfo {
  type: FrameworkType;
  confidence: number;
  metadata: {
    version?: string;
    buildSystem?: string;
    hasSSR?: boolean;
    hasTypeScript?: boolean;
    packageManager?: string;
    dependencies?: string[];
  };
}

interface DetectionResult {
  framework: FrameworkType;
  confidence: number;
  metadata?: Record<string, any>;
}

interface FrameworkDetectorOptions {
  rootPath?: string;
  enablePackageAnalysis?: boolean;
  enableConfigAnalysis?: boolean;
  enableCodeAnalysis?: boolean;
  enableCaching?: boolean;
  maxCodeFiles?: number;
  confidenceThreshold?: number;
}
```

### Usage Example

```typescript
import { FrameworkDetector } from '@tw-enigma/core';

const detector = new FrameworkDetector({
  rootPath: process.cwd(),
  confidenceThreshold: 0.7,
});

const frameworkInfo = await detector.detect('./my-project');

console.log(`Detected: ${frameworkInfo.type}`);
console.log(`Confidence: ${frameworkInfo.confidence}`);
console.log(`Build System: ${frameworkInfo.metadata.buildSystem}`);
```

## Troubleshooting

### Common Issues

#### Framework Not Detected

**Problem**: TW-Enigma doesn't detect your framework

**Solutions**:

1. **Check package.json dependencies**:
   ```bash
   # Ensure framework packages are installed
   npm list react vue angular
   ```

2. **Verify configuration files**:
   ```bash
   # Check for expected config files
   ls -la *.config.js *.config.ts
   ```

3. **Manual override**:
   ```javascript
   // tw-enigma.config.js
   export default {
     framework: {
       type: 'react', // Explicit declaration
       autoDetect: false,
     }
   };
   ```

#### Incorrect Framework Detected

**Problem**: Wrong framework detected

**Solutions**:

1. **Check confidence threshold**:
   ```javascript
   export default {
     framework: {
       confidenceThreshold: 0.8, // Increase threshold
     }
   };
   ```

2. **Use explicit override**:
   ```javascript
   export default {
     framework: {
       type: 'vue', // Force Vue detection
       preset: 'vue-vite',
     }
   };
   ```

#### Multiple Frameworks Detected

**Problem**: Project uses multiple frameworks

**Solutions**:

1. **Workspace configuration**:
   ```javascript
   // tw-enigma.config.js
   export default {
     workspaces: {
       'apps/react-app': {
         framework: { type: 'react' }
       },
       'apps/vue-app': {
         framework: { type: 'vue' }
       }
     }
   };
   ```

2. **Exclude paths**:
   ```javascript
   export default {
     framework: {
       detection: {
         excludePaths: ['packages/vue-components/**/*']
       }
     }
   };
   ```

### Debug Mode

Enable debug logging for detection issues:

```bash
# Enable framework detection debugging
DEBUG=tw-enigma:framework npm run build

# Verbose detection logging
DEBUG=tw-enigma:framework:* npm run build
```

### Detection Report

Generate a detailed detection report:

```javascript
// tw-enigma.config.js
export default {
  framework: {
    debug: {
      generateReport: true,
      reportPath: './detection-report.json',
    }
  }
};
```

Example report:

```json
{
  "timestamp": "2023-12-07T10:30:00Z",
  "projectPath": "/path/to/project",
  "detectionResults": [
    {
      "detector": "ReactDetector",
      "confidence": 0.95,
      "evidence": [
        "react dependency found",
        "react-dom dependency found",
        "*.jsx files detected"
      ]
    }
  ],
  "finalResult": {
    "framework": "react",
    "confidence": 0.95,
    "preset": "react-cra"
  }
}
```

## Performance Considerations

### Caching

Framework detection results are cached by default:

```javascript
// Cache configuration
export default {
  framework: {
    cache: {
      enabled: true,
      ttl: 3600000, // 1 hour in ms
      invalidateOnChange: true, // Clear on package.json changes
    }
  }
};
```

### Optimization

For large projects, optimize detection performance:

```javascript
export default {
  framework: {
    detection: {
      // Limit file analysis
      maxCodeFiles: 50,
      
      // Early exit on high confidence
      earlyExit: true,
      earlyExitThreshold: 0.9,
      
      // Parallel analysis
      parallel: true,
      maxWorkers: 4,
    }
  }
};
```

---

The framework detection system provides the foundation for TW-Enigma's intelligent optimization features. By automatically identifying your project setup, it enables framework-specific optimizations and seamless integration with your existing development workflow.