# Modern CSS Features in TW-Enigma

This guide covers TW-Enigma's comprehensive support for modern CSS features, including optimization strategies, browser compatibility, and implementation details.

## Table of Contents

- [Overview](#overview)
- [CSS Grid Support](#css-grid-support)
- [Flexbox Enhancement](#flexbox-enhancement)
- [Logical Properties](#logical-properties)
- [Modern CSS Selectors](#modern-css-selectors)
- [CSS Nesting](#css-nesting)
- [CSS Layers (@layer)](#css-layers-layer)
- [Container Queries](#container-queries)
- [CSS Custom Properties](#css-custom-properties)
- [Modern CSS Functions](#modern-css-functions)
- [Browser Compatibility](#browser-compatibility)
- [Performance Considerations](#performance-considerations)
- [Migration Guide](#migration-guide)

## Overview

TW-Enigma provides comprehensive support for modern CSS features, automatically optimizing utility patterns while maintaining compatibility with cutting-edge CSS specifications. The system intelligently detects, processes, and optimizes modern CSS features without breaking functionality.

### Supported Features

- ✅ CSS Grid with subgrid support
- ✅ Flexbox with gap property  
- ✅ Logical properties for internationalization
- ✅ Modern selectors (`:is()`, `:where()`, `:has()`, `:not()`)
- ✅ Native CSS nesting
- ✅ CSS cascade layers (`@layer`)
- 🚧 Container queries (planned)
- ✅ CSS custom properties optimization
- ✅ Modern CSS functions (`clamp()`, `min()`, `max()`)

## CSS Grid Support

TW-Enigma provides comprehensive optimization for CSS Grid layouts, including both utility classes and custom grid implementations.

### Grid Property Optimization

```css
/* Before optimization */
.grid-container { display: grid; }
.grid-cols-3 { grid-template-columns: repeat(3, 1fr); }
.grid-rows-auto { grid-template-rows: auto; }
.grid-gap-4 { gap: 1rem; }

/* After TW-Enigma optimization */
@apply grid-layout-3col;
```

### Subgrid Support

TW-Enigma automatically detects and optimizes subgrid patterns:

```css
/* Optimized subgrid pattern */
.subgrid-item {
  grid-column: 1 / -1;
  grid-row: 1 / -1;
  display: subgrid;
}
```

### Grid Areas Optimization

```css
/* Complex grid area patterns are consolidated */
.grid-template-areas-header {
  grid-template-areas: 
    "header header header"
    "sidebar main aside"
    "footer footer footer";
}
```

### Configuration

```javascript
// tw-enigma.config.js
export default {
  modernCss: {
    grid: {
      enableSubgrid: true,
      optimizeAreas: true,
      consolidateGaps: true
    }
  }
}
```

## Flexbox Enhancement

Enhanced Flexbox support includes the modern `gap` property and advanced flex patterns.

### Flex Gap Property

```css
/* TW-Enigma handles flex gap with fallbacks */
.flex-container {
  display: flex;
  gap: 1rem; /* Modern browsers */
  /* Fallback for older browsers automatically added */
}
```

### Flex Pattern Consolidation

```css
/* Multiple flex utilities are consolidated */
.flex-center {
  display: flex;
  align-items: center;
  justify-content: center;
}

/* Becomes optimized @apply directive */
@apply flex-center-pattern;
```

### Browser Compatibility

TW-Enigma automatically provides fallbacks for flex gap:

```css
/* Generated fallback pattern */
.flex-gap-fallback > * + * {
  margin-left: 1rem; /* Horizontal fallback */
}
```

## Logical Properties

Logical properties enable internationalization-friendly layouts that adapt to different writing modes.

### Margin and Padding Optimization

```css
/* Logical properties are optimized and consolidated */
.margin-inline { margin-inline: 1rem; }
.margin-block { margin-block: 1rem; }
.padding-inline-start { padding-inline-start: 1rem; }
.padding-block-end { padding-block-end: 1rem; }

/* Consolidated to */
@apply logical-spacing-pattern;
```

### Writing Mode Adaptation

```css
/* TW-Enigma generates direction-aware patterns */
.text-direction-adaptive {
  text-align: start; /* instead of left */
  border-inline-start: 1px solid; /* instead of border-left */
}
```

### RTL/LTR Optimization

```css
/* Automatic RTL patterns */
[dir="rtl"] .margin-adaptive { margin-inline-start: auto; }
[dir="ltr"] .margin-adaptive { margin-inline-start: 0; }
```

## Modern CSS Selectors

TW-Enigma supports and optimizes modern CSS selectors while maintaining browser compatibility.

### :is() and :where() Selectors

```css
/* Modern selector optimization */
:is(.button, .btn, .action) {
  padding: 0.5rem 1rem;
}

/* TW-Enigma can consolidate to */
@apply button-base-pattern;
```

### :has() Selector Support

```css
/* Parent selector patterns */
.card:has(.card-image) {
  padding-top: 0;
}

.form:has(.error) {
  border-color: red;
}
```

### Enhanced :not() Selector

```css
/* Complex :not() patterns are optimized */
.button:not(.disabled):not(.loading):not(.small) {
  font-size: 1rem;
}
```

### Specificity Management

TW-Enigma automatically calculates specificity for modern selectors:

```css
/* Specificity-aware optimization */
:where(.low-specificity) { /* 0,0,0 specificity */ }
:is(.medium-specificity) { /* Highest argument specificity */ }
```

## CSS Nesting

Native CSS nesting support with optimization and browser compatibility.

### Nested Rule Optimization

```css
/* Nested CSS patterns */
.card {
  padding: 1rem;
  
  & .title {
    font-size: 1.5rem;
    font-weight: bold;
  }
  
  & .content {
    margin-top: 1rem;
  }
  
  &:hover {
    transform: translateY(-2px);
  }
}
```

### Nesting Flattening

For older browsers, TW-Enigma flattens nested rules:

```css
/* Flattened output for compatibility */
.card { padding: 1rem; }
.card .title { font-size: 1.5rem; font-weight: bold; }
.card .content { margin-top: 1rem; }
.card:hover { transform: translateY(-2px); }
```

### @media Query Nesting

```css
/* Nested media queries are supported */
.responsive-component {
  width: 100%;
  
  @media (min-width: 768px) {
    width: 50%;
  }
  
  @media (min-width: 1024px) {
    width: 33.333%;
  }
}
```

## CSS Layers (@layer)

Comprehensive support for CSS cascade layers for better style organization.

### Layer Definition and Usage

```css
/* Define layers for organization */
@layer base, components, utilities;

@layer base {
  /* Base styles */
  html { font-family: system-ui; }
  body { margin: 0; }
}

@layer components {
  /* Component styles */
  .button { padding: 0.5rem 1rem; }
  .card { border-radius: 0.5rem; }
}

@layer utilities {
  /* Utility classes */
  .text-center { text-align: center; }
  .hidden { display: none; }
}
```

### Layer-Aware Optimization

TW-Enigma respects layer boundaries during optimization:

```css
/* Layer-specific @apply directives */
@layer components {
  .optimized-button {
    @apply button-base-pattern;
  }
}
```

### Layer Import Support

```css
/* Import with layer assignment */
@import "reset.css" layer(base);
@import "components.css" layer(components);
```

### Anonymous Layers

```css
/* Anonymous layer support */
@layer {
  .anonymous-layer-styles {
    /* Styles in anonymous layer */
  }
}
```

## Container Queries

*Note: Container queries are planned for future implementation.*

### Planned Container Query Support

```css
/* Future container query optimization */
@container (min-width: 400px) {
  .card-content {
    display: flex;
  }
}

@container card-container (min-width: 300px) {
  .card-title {
    font-size: 1.25rem;
  }
}
```

## CSS Custom Properties

Optimization and consolidation of CSS custom properties (variables).

### Variable Consolidation

```css
/* Similar custom properties are consolidated */
:root {
  --primary-100: #f0f9ff;
  --primary-200: #e0f2fe;
  --primary-300: #bae6fd;
  /* More primary color variants */
}

/* Consolidated to optimized color scale */
:root {
  @apply primary-color-scale;
}
```

### Variable Scope Optimization

```css
/* Component-scoped variables */
.card {
  --card-padding: 1rem;
  --card-radius: 0.5rem;
  --card-shadow: 0 2px 4px rgba(0,0,0,0.1);
  
  padding: var(--card-padding);
  border-radius: var(--card-radius);
  box-shadow: var(--card-shadow);
}
```

### Theme System Integration

```css
/* Theme-aware variable optimization */
[data-theme="light"] {
  --background: white;
  --text: black;
}

[data-theme="dark"] {
  --background: black;
  --text: white;
}
```

## Modern CSS Functions

Support for modern CSS functions with optimization and fallbacks.

### clamp(), min(), max() Functions

```css
/* Responsive typography using clamp() */
.responsive-text {
  font-size: clamp(1rem, 2.5vw, 2rem);
}

/* Optimized spacing with min/max */
.adaptive-margin {
  margin: max(1rem, 5vw);
}
```

### calc() Expression Optimization

```css
/* Complex calc() expressions are optimized */
.dynamic-width {
  width: calc(100% - 2rem);
  margin: calc(1rem + 2px);
}
```

### Function Fallbacks

```css
/* Automatic fallbacks for unsupported functions */
.fallback-text {
  font-size: 1.5rem; /* Fallback */
  font-size: clamp(1rem, 2.5vw, 2rem); /* Modern */
}
```

## Browser Compatibility

TW-Enigma automatically handles browser compatibility for modern CSS features.

### Feature Detection

```javascript
// Internal browser support detection
const modernCssSupport = {
  grid: '≥ Chrome 57, Firefox 52, Safari 10.1',
  flexGap: '≥ Chrome 84, Firefox 63, Safari 14.1',
  logicalProperties: '≥ Chrome 69, Firefox 41, Safari 12.1',
  nesting: '≥ Chrome 112, Firefox 117, Safari 16.5',
  layers: '≥ Chrome 99, Firefox 97, Safari 15.4',
  containerQueries: '≥ Chrome 105, Firefox 110, Safari 16.0'
};
```

### Automatic Fallbacks

```css
/* TW-Enigma generates progressive enhancement */
.modern-layout {
  /* Fallback for older browsers */
  display: flex;
  
  /* Modern implementation */
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
}
```

### PostCSS Integration

TW-Enigma integrates with PostCSS plugins for broader compatibility:

```javascript
// Automatic PostCSS plugin integration
plugins: [
  'autoprefixer',
  'postcss-logical',
  'postcss-nesting',
  'postcss-custom-properties'
]
```

## Performance Considerations

### Optimization Strategies

1. **Bundle Size Reduction**: Modern CSS features are optimized to reduce overall bundle size
2. **Selective Loading**: Only load polyfills and fallbacks when needed
3. **Tree Shaking**: Unused modern CSS patterns are automatically removed
4. **Critical CSS**: Modern features in critical rendering path are prioritized

### Performance Metrics

```bash
# Performance analysis with modern CSS
npm run enigma analyze --modern-css --performance

# Output includes modern CSS impact metrics
Modern CSS Features Impact:
- CSS Grid optimization: -23% bundle size
- Logical properties: +2% gzip size
- CSS Layers: No impact on runtime performance
- Custom properties: -15% specificity conflicts
```

### Best Practices

1. **Use logical properties** for internationalization needs
2. **Leverage CSS layers** for better style organization
3. **Prefer modern selectors** for cleaner, more maintainable code
4. **Test across browsers** with TW-Enigma's compatibility reports

## Migration Guide

### Upgrading from Legacy CSS

1. **Identify Legacy Patterns**:
   ```bash
   npx tw-enigma audit --legacy-css
   ```

2. **Gradual Migration**:
   ```css
   /* Phase 1: Add modern CSS alongside legacy */
   .button {
     margin-left: 1rem; /* Legacy */
     margin-inline-start: 1rem; /* Modern */
   }
   ```

3. **Use Progressive Enhancement**:
   ```css
   /* TW-Enigma handles this automatically */
   @supports (display: grid) {
     .layout { display: grid; }
   }
   ```

### Configuration Migration

```javascript
// Old configuration
module.exports = {
  // Legacy config
}

// New configuration with modern CSS
export default {
  modernCss: {
    enableAll: true,
    grid: { enable: true },
    flexbox: { enableGap: true },
    logicalProperties: { enable: true },
    selectors: { enable: true },
    nesting: { enable: true },
    layers: { enable: true }
  }
}
```

### Testing Modern CSS Features

```bash
# Test modern CSS compatibility
npm run enigma test --modern-css

# Generate compatibility report
npm run enigma report --browser-support
```

## Troubleshooting

### Common Issues

1. **CSS Layer Order**: Ensure proper layer order for expected cascade
2. **Logical Properties**: Test with different writing modes
3. **Modern Selectors**: Verify browser support for `:has()` selector
4. **Nesting Depth**: Keep nesting levels reasonable for performance

### Debug Mode

```bash
# Enable modern CSS debug logging
npm run enigma optimize --debug-modern-css
```

### Browser Testing

```bash
# Cross-browser testing with modern CSS features
npm run enigma test:browsers --modern-css
```

## Examples

See the `/examples` directory for comprehensive examples of modern CSS feature usage with TW-Enigma optimization.

---

*This documentation covers TW-Enigma's modern CSS feature support. For specific implementation details, see the individual feature guides and API documentation.*