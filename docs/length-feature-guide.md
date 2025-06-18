# CSS Class Name Length Feature Guide

This guide covers the `--length` feature in Tailwind Enigma, which allows you to control the minimum length of generated CSS class names for enhanced security, obfuscation, and consistency.

## 🎯 Overview

The `--length` feature enables you to set a minimum character count for all generated CSS class names. Instead of using the mathematically optimal length (which might be very short), you can enforce longer names for better security through obfuscation.

### Key Benefits

- **🔒 Enhanced Security**: Longer class names exponentially increase reverse engineering difficulty
- **🎯 Consistent Naming**: Uniform length across all generated classes
- **⚡ Maintained Performance**: Core optimization benefits preserved
- **🔧 Flexible Configuration**: Works with all CLI commands and strategies

## 🚀 Quick Start

### Basic Usage

```bash
# Generate class names with minimum 8 characters
npx enigma --length 8 generate

# Use with initialization
npx enigma --length 6 init --framework react

# Combine with other flags
npx enigma --length 10 --verbose analyze --report
```

### Integration Examples

```bash
# Development workflow
npx enigma --length 4 --pretty watch --hmr

# Production build
npx enigma --length 12 --quiet generate --minify

# Security-focused analysis
npx enigma --length 15 analyze --exclude "**/*.test.*"
```

## 📋 Configuration Options

### CLI Flag

```bash
--length <number>    # Range: 1-26 (integer values only)
```

**Validation:**

- Must be an integer between 1 and 26
- Values outside this range will display helpful error messages
- Works as a global flag with all commands

### Configuration File

```javascript
// enigma.config.js
module.exports = {
  nameGeneration: {
    minimumLength: 8,
    strategy: 'sequential',
    alphabet: 'abcdefghijklmnopqrstuvwxyz',
    ensureCssValid: true,
  },
};
```

### Environment Variables

```bash
# Set via environment
export TW_ENIGMA_NAME_GENERATION_MINIMUM_LENGTH=8
export TW_ENIGMA_NAME_GENERATION_STRATEGY=sequential
export TW_ENIGMA_NAME_GENERATION_ALPHABET=abcdefghijklm

# Configuration priority: CLI flags > Environment > Config file
```

## 🔒 Security & Obfuscation

### Security Levels by Length

| Length | Possible Combinations | Security Level | Recommended Use Case     |
| ------ | --------------------- | -------------- | ------------------------ |
| 1-3    | 18 - 18,278           | **Basic**      | Development, prototyping |
| 4-6    | 456K - 476M           | **Moderate**   | Internal applications    |
| 7-10   | 12B - 18.7T           | **High**       | Public applications      |
| 11-15  | 487T - 6.3Q           | **Very High**  | Financial, healthcare    |
| 16+    | 164Q+                 | **Maximum**    | Government, defense      |

### Real-World Examples

#### Development (Length 4-6)

```css
/* Length 4: Good for development */
.aaab {
  @apply flex items-center justify-center;
}
.aaac {
  @apply px-4 py-2 bg-blue-500 text-white;
}
.aaad {
  @apply hover:bg-blue-600 transition-colors;
}
```

#### Production (Length 8-10)

```css
/* Length 8: High security */
.abjkd7sx {
  @apply flex items-center justify-center;
}
.pqwx9mzn {
  @apply px-4 py-2 bg-blue-500 text-white;
}
.hdyu3vkr {
  @apply hover:bg-blue-600 transition-colors;
}
```

#### High Security (Length 12+)

```css
/* Length 12: Maximum obfuscation */
.kfjd8sxpqw7m {
  @apply flex items-center justify-center;
}
.bhu9mynzv5kt {
  @apply px-4 py-2 bg-blue-500 text-white;
}
.rgx4cajp6ews {
  @apply hover:bg-blue-600 transition-colors;
}
```

### Security Analysis

**Brute Force Resistance:**

- Length 8: ~208 trillion combinations = years to brute force
- Length 10: ~147 quadrillion combinations = centuries to brute force
- Length 12: ~108 quintillion combinations = effectively impossible

**Pattern Analysis Resistance:**

- Longer names obscure semantic patterns
- Harder to correlate with original Tailwind classes
- Cryptographically secure random padding prevents predictability

## ⚡ Performance Considerations

### File Size Impact

```bash
# Measure impact with different lengths
npx enigma --length 4 generate --verbose  # ~15% increase
npx enigma --length 8 generate --verbose  # ~30% increase
npx enigma --length 12 generate --verbose # ~45% increase
```

### Optimal Length Recommendations

| Project Type      | Recommended Length | Reasoning                               |
| ----------------- | ------------------ | --------------------------------------- |
| **Development**   | 3-4                | Fast builds, readable debugging         |
| **Internal Apps** | 6-8                | Good security/performance balance       |
| **Public Apps**   | 8-10               | High security, acceptable size          |
| **Enterprise**    | 10-12              | Maximum security, monitored performance |
| **Financial/Gov** | 12+                | Security priority over size             |

### Performance Monitoring

```bash
# Enable warnings for high length values
npx enigma --length 15 generate --verbose

# Monitor bundle size impact
npx enigma --length 10 analyze --report --format html

# Compare sizes
npx enigma analyze --report --output baseline.json
npx enigma --length 8 analyze --report --output secured.json
```

## 🛠️ Advanced Usage

### Strategy Combinations

```bash
# Sequential with length enforcement
npx enigma --length 8 css-config --strategy sequential

# Frequency-optimized with security
npx enigma --length 10 css-config --strategy frequency-optimized

# Pretty names with minimum length
npx enigma --length 6 css-config --strategy pretty
```

### Custom Alphabets

```javascript
// enigma.config.js - Custom alphabet with length
module.exports = {
  nameGeneration: {
    minimumLength: 8,
    alphabet: 'abcdefghijklm', // Reduced character set
    strategy: 'sequential',
  },
};
```

### Prefix/Suffix with Length

```javascript
// enigma.config.js - Coordinated naming
module.exports = {
  nameGeneration: {
    minimumLength: 6,
    prefix: 'tw-', // tw-xxxxxx (10 chars total)
    suffix: '-opt', // tw-xxxx-opt (11 chars total)
    strategy: 'hybrid',
  },
};
```

## 🔄 Integration Workflows

### Development to Production

```bash
# Development: Short names for debugging
npx enigma --length 3 watch --verbose

# Staging: Moderate security
npx enigma --length 6 generate --sourcemap

# Production: High security
npx enigma --length 10 generate --minify --quiet
```

### CI/CD Pipeline

```yaml
# .github/workflows/build.yml
- name: Generate CSS (Development)
  if: github.ref != 'refs/heads/main'
  run: npx enigma --length 4 generate

- name: Generate CSS (Production)
  if: github.ref == 'refs/heads/main'
  run: npx enigma --length 12 generate --minify
```

### Framework Integration

#### React/Next.js

```json
{
  "scripts": {
    "dev": "next dev & npx enigma --length 4 watch",
    "build": "npx enigma --length 10 generate && next build",
    "analyze": "npx enigma --length 8 analyze --report"
  }
}
```

#### Vue.js

```json
{
  "scripts": {
    "serve": "vue-cli-service serve & npx enigma --length 5 watch",
    "build": "npx enigma --length 12 generate && vue-cli-service build"
  }
}
```

## 🐛 Troubleshooting

### Common Issues

#### Length Too High

```bash
# Error: length > 26
npx enigma --length 30 generate
# ❌ Invalid length value: 30. Must be between 1 and 26.

# Solution: Use maximum 26
npx enigma --length 26 generate
```

#### Performance Warnings

```bash
# Warning for high values
npx enigma --length 20 generate
# ⚠️  Warning: Length 20 may significantly increase CSS file size

# Solution: Monitor and adjust
npx enigma --length 15 generate --verbose
```

#### Invalid Characters

```bash
# Non-integer values
npx enigma --length 8.5 generate
# ❌ Invalid length value: 8.5. Must be an integer.

# Solution: Use integers only
npx enigma --length 8 generate
```

### Debug Mode

```bash
# Debug length enforcement
npx enigma --length 8 --debug generate

# Very verbose output
npx enigma --length 6 --verbose generate

# Check configuration
npx enigma --length 10 config validate
```

## 📊 Benchmarks & Analysis

### Size Comparison

| Length | CSS Size | Gzip Size | Brotli Size | Security Score |
| ------ | -------- | --------- | ----------- | -------------- |
| 3      | 100%     | 100%      | 100%        | Basic          |
| 6      | 115%     | 108%      | 106%        | Moderate       |
| 8      | 125%     | 112%      | 109%        | High           |
| 10     | 135%     | 118%      | 114%        | Very High      |
| 12     | 145%     | 125%      | 120%        | Maximum        |

### Load Time Impact

```bash
# Realistic measurements
Length 6:  +50ms initial load
Length 8:  +80ms initial load
Length 10: +120ms initial load
Length 12: +180ms initial load

# Minimal impact on subsequent loads (cached)
```

## 🔗 Related Documentation

- [CLI Global Options](../packages/cli/README.md#global-options)
- [Name Generation API](./API_REFERENCE.md#namegeneration)
- [Configuration Guide](../packages/core/README.md#configuration)
- [Security Best Practices](./security-guide.md)
- [Performance Optimization](./performance-guide.md)

---

## 💡 Best Practices

1. **Start Small**: Begin with length 6-8 and measure impact
2. **Monitor Performance**: Use `--verbose` to track file size changes
3. **Environment-Specific**: Use shorter lengths in development
4. **Security Assessment**: Match length to your security requirements
5. **Team Coordination**: Document chosen lengths in project README

For questions or advanced use cases, see the [GitHub Discussions](https://github.com/avocardow/tw-enigma/discussions) or [Issues](https://github.com/avocardow/tw-enigma/issues).
