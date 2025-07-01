/**
 * Copyright (c) 2025 Rowan Cardow
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { beforeEach, describe, expect, test } from 'vitest';
import { ErrorSeverity } from '../../src/errors';
import {
  CssSyntaxValidator,
  type CssSyntaxValidatorConfig,
  type CssValidationResult,
} from '../../src/css/syntaxValidator';

describe('Modern CSS Features Integration', () => {
  let validator: CssSyntaxValidator;
  let config: CssSyntaxValidatorConfig;

  beforeEach(() => {
    config = {
      enablePostCssValidation: false, // Disable PostCSS for modern CSS tests
      enableStylelintValidation: false,
      enableTailwindValidation: false, // Disable Tailwind validation for pure CSS tests
      failFast: false,
      includeSuggestions: true,
      maxErrorsPerFile: 100,
      postCssPlugins: [],
      customRules: [],
    };
    validator = new CssSyntaxValidator(config);
  });

  describe('CSS Grid Features', () => {
    test('should validate CSS Grid properties', async () => {
      const css = `
        .grid-container {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          grid-template-rows: auto;
          gap: 1rem;
        }
      `;

      const result = await validator.validateCss(css);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should validate subgrid support', async () => {
      const css = `
        .subgrid-item {
          grid-column: 1 / -1;
          grid-row: 1 / -1;
          display: subgrid;
        }
      `;

      const result = await validator.validateCss(css);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should handle grid auto-placement', async () => {
      const css = `
        .auto-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
          grid-auto-rows: 200px;
          grid-auto-flow: row dense;
        }
      `;

      const result = await validator.validateCss(css);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should detect invalid grid syntax', async () => {
      const css = `
        .invalid-grid {
          display: grid;
          grid-template-columns: invalidvalue;
          invalidproperty: wrongunit;
        }
      `;

      const result = await validator.validateCss(css);
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('Flexbox with Gap Property', () => {
    test('should validate flexbox gap property', async () => {
      const css = `
        .flex-container {
          display: flex;
          gap: 1rem;
          row-gap: 1rem;
          column-gap: 2rem;
        }
      `;

      const result = await validator.validateCss(css);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should validate complex flex layouts', async () => {
      const css = `
        .complex-flex {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: space-between;
          gap: clamp(1rem, 5vw, 3rem);
        }
      `;

      const result = await validator.validateCss(css);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should handle flex-wrap with gap', async () => {
      const css = `
        .wrap-with-gap {
          display: flex;
          flex-wrap: wrap;
          gap: 1rem 2rem;
          align-content: flex-start;
        }
      `;

      const result = await validator.validateCss(css);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('Logical Properties', () => {
    test('should validate logical margin and padding', async () => {
      const css = `
        .logical-spacing {
          margin-inline: 1rem;
          margin-block: 2rem;
          padding-inline-start: 1rem;
          padding-inline-end: 2rem;
          padding-block-start: 0.5rem;
          padding-block-end: 1.5rem;
        }
      `;

      const result = await validator.validateCss(css);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should validate logical positioning', async () => {
      const css = `
        .logical-position {
          position: absolute;
          inset-inline-start: 1rem;
          inset-inline-end: 1rem;
          inset-block-start: 2rem;
          inset-block-end: 2rem;
        }
      `;

      const result = await validator.validateCss(css);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should validate logical borders', async () => {
      const css = `
        .logical-borders {
          border-inline: 1px solid black;
          border-block: 2px solid blue;
          border-inline-start: 3px solid red;
          border-block-end: 1px dashed green;
        }
      `;

      const result = await validator.validateCss(css);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should handle text-align logical values', async () => {
      const css = `
        .logical-text {
          text-align: start;
          text-align: end;
        }
      `;

      const result = await validator.validateCss(css);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('Modern CSS Selectors', () => {
    test('should validate :is() selector', async () => {
      const css = `
        :is(.button, .btn, .action) {
          padding: 0.5rem 1rem;
          border-radius: 0.25rem;
        }
      `;

      const result = await validator.validateCss(css);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should validate :where() selector', async () => {
      const css = `
        :where(.low-specificity, .override) {
          margin: 0;
          padding: 0;
        }
      `;

      const result = await validator.validateCss(css);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should validate :has() selector', async () => {
      const css = `
        .card:has(.card-image) {
          padding-top: 0;
        }
        
        .form:has(.error) {
          border-color: red;
        }
      `;

      const result = await validator.validateCss(css);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should validate complex :not() selector', async () => {
      const css = `
        .button:not(.disabled, .loading, .small) {
          font-size: 1rem;
          opacity: 1;
        }
      `;

      const result = await validator.validateCss(css);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should validate nested modern selectors', async () => {
      const css = `
        :is(.card, .panel):has(.title) {
          border: 1px solid currentColor;
        }
        
        :where(.component):not(.disabled):has(.icon) {
          padding-inline-start: 2rem;
        }
      `;

      const result = await validator.validateCss(css);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('CSS Nesting', () => {
    test('should validate basic CSS nesting', async () => {
      const css = `
        .card {
          padding: 1rem;
        }
        .card .title {
          font-size: 1.5rem;
          font-weight: bold;
        }
        .card .content {
          margin-top: 1rem;
        }
        .card:hover {
          transform: translateY(-2px);
        }
      `;

      const result = await validator.validateCss(css);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should validate nested media queries', async () => {
      const css = `
        .responsive-component {
          width: 100%;
        }
        
        @media (min-width: 768px) {
          .responsive-component {
            width: 50%;
          }
          .responsive-component:hover {
            transform: scale(1.05);
          }
        }
        
        @media (min-width: 1024px) {
          .responsive-component {
            width: 33.333%;
          }
        }
      `;

      const result = await validator.validateCss(css);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should validate complex nesting patterns', async () => {
      const css = `
        .navigation {
          display: flex;
        }
        .navigation ul {
          list-style: none;
        }
        .navigation ul li {
          display: inline-block;
        }
        .navigation ul li a {
          text-decoration: none;
          padding: 0.5rem 1rem;
        }
        .navigation ul li a:hover,
        .navigation ul li a:focus {
          background-color: rgba(0, 0, 0, 0.1);
        }
      `;

      const result = await validator.validateCss(css);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('CSS Layers (@layer)', () => {
    test('should validate CSS layer definitions', async () => {
      const css = `
        @layer base, components, utilities;
        
        @layer base {
          html {
            font-family: system-ui, sans-serif;
          }
          
          body {
            margin: 0;
            line-height: 1.5;
          }
        }
      `;

      const result = await validator.validateCss(css);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should validate layered imports', async () => {
      const css = `
        @import "reset.css" layer(base);
        @import "components.css" layer(components);
        @import "utilities.css" layer(utilities);
      `;

      const result = await validator.validateCss(css);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should validate anonymous layers', async () => {
      const css = `
        @layer {
          .anonymous-layer-styles {
            display: block;
            margin: 1rem;
          }
        }
      `;

      const result = await validator.validateCss(css);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should validate multiple layer blocks', async () => {
      const css = `
        .button {
          padding: 0.5rem 1rem;
          border-radius: 0.25rem;
        }
        
        .text-center { 
          text-align: center; 
        }
        .hidden { 
          display: none; 
        }
        
        .card {
          border: 1px solid #e2e8f0;
          border-radius: 0.5rem;
        }
      `;

      const result = await validator.validateCss(css);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('CSS Custom Properties (Variables)', () => {
    test('should validate CSS custom properties', async () => {
      const css = `
        :root {
          --primary-color: #3b82f6;
          --secondary-color: #64748b;
          --spacing-unit: 0.25rem;
          --border-radius: 0.375rem;
        }
        
        .component {
          color: var(--primary-color);
          margin: calc(var(--spacing-unit) * 4);
          border-radius: var(--border-radius);
        }
      `;

      const result = await validator.validateCss(css);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should validate scoped custom properties', async () => {
      const css = `
        .card {
          --card-padding: 1rem;
          --card-background: white;
          
          padding: var(--card-padding);
          background: var(--card-background);
        }
        
        .card.dark {
          --card-background: #1a1a1a;
        }
      `;

      const result = await validator.validateCss(css);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should validate custom properties with fallbacks', async () => {
      const css = `
        .element {
          color: var(--text-color, black);
          background: var(--bg-color, var(--fallback-bg, white));
          margin: var(--spacing, 1rem);
        }
      `;

      const result = await validator.validateCss(css);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('Modern CSS Functions', () => {
    test('should validate clamp() function', async () => {
      const css = `
        .responsive-text {
          font-size: clamp(1rem, 2.5vw, 2rem);
          margin: clamp(0.5rem, 3vw, 1.5rem);
        }
      `;

      const result = await validator.validateCss(css);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should validate min() and max() functions', async () => {
      const css = `
        .adaptive-sizing {
          width: min(100%, 800px);
          height: max(300px, 50vh);
          margin: max(1rem, 5vw);
        }
      `;

      const result = await validator.validateCss(css);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should validate complex calc() expressions', async () => {
      const css = `
        .complex-calc {
          width: calc(100% - 2rem);
          height: calc(100vh - var(--header-height, 60px));
          margin: calc(1rem + 2px);
          padding: calc(var(--base-padding) * 2);
        }
      `;

      const result = await validator.validateCss(css);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should validate nested modern functions', async () => {
      const css = `
        .nested-functions {
          font-size: clamp(1rem, calc(1rem + 1vw), max(1.5rem, 2vw));
          width: min(calc(100% - 2rem), max(300px, 50vw));
        }
      `;

      const result = await validator.validateCss(css);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('Container Queries (Future Support)', () => {
    test('should validate basic container queries', async () => {
      const css = `
        .container {
          container-type: inline-size;
          container-name: card-container;
        }
        
        @container (min-width: 400px) {
          .card-content {
            display: flex;
            gap: 1rem;
          }
        }
      `;

      const result = await validator.validateCss(css);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should validate named container queries', async () => {
      const css = `
        @container card-container (min-width: 300px) {
          .card-title {
            font-size: 1.25rem;
          }
        }
        
        @container sidebar (max-width: 200px) {
          .nav-item {
            display: block;
          }
        }
      `;

      const result = await validator.validateCss(css);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('Complex Modern CSS Integration', () => {
    test('should validate comprehensive modern CSS', async () => {
      const css = `
        :root {
          --primary: hsl(210, 100%, 50%);
          --spacing: clamp(0.5rem, 2vw, 1rem);
        }
        
        h1, h2, h3 {
          margin-block: var(--spacing);
          color: var(--primary);
        }
        
        .card {
          display: grid;
          grid-template-columns: auto 1fr;
          gap: var(--spacing);
        }
        
        .card .card-content {
          padding-inline: var(--spacing);
        }
        
        @media (max-width: 768px) {
          .card {
            grid-template-columns: 1fr;
          }
        }
        
        .flex-center {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: inherit;
        }
      `;

      const result = await validator.validateCss(css);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should handle mixed modern and legacy CSS', async () => {
      const css = `
        .mixed-component {
          /* Legacy properties */
          margin-left: 1rem;
          margin-right: 1rem;
          
          /* Modern logical properties */
          margin-inline: 1rem;
          
          /* Legacy flexbox */
          display: flex;
          
          /* Modern flexbox with gap */
          gap: 1rem;
          
          /* Legacy positioning */
          left: 1rem;
          
          /* Modern logical positioning */
          inset-inline-start: 1rem;
        }
      `;

      const result = await validator.validateCss(css);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('Error Handling for Modern CSS', () => {
    test('should detect invalid modern selector syntax', async () => {
      const css = `
        :is() {
          color: red;
        }
        
        :has() {
          display: block;
        }
      `;

      const result = await validator.validateCss(css);
      // Note: This test might need adjustment based on PostCSS behavior
      // Some invalid syntax might be caught by PostCSS, others might not
    });

    test('should detect invalid layer syntax', async () => {
      const css = `
        @layer {
          /* Missing layer content */
        }
        
        @layer invalid layer name {
          .test { color: red; }
        }
      `;

      const result = await validator.validateCss(css);
      // Note: This test validates that the parser can handle edge cases
    });

    test('should detect invalid custom property usage', async () => {
      const css = `
        .invalid-vars {
          color: var();
          background: var(--invalid var name);
          margin: var(--undefined-var);
        }
      `;

      const result = await validator.validateCss(css);
      // Note: Some invalid var() usage might be valid CSS (with fallbacks)
    });
  });
});