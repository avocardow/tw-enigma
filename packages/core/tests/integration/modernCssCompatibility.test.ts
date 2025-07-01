/**
 * Copyright (c) 2025 Rowan Cardow
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { beforeEach, describe, expect, test } from 'vitest';
import { CssSyntaxValidator } from '../../src/css/syntaxValidator';
import type { CssSyntaxValidatorConfig } from '../../src/css/syntaxValidator';

describe('Modern CSS Cross-Browser Compatibility', () => {
  let validator: CssSyntaxValidator;
  let config: CssSyntaxValidatorConfig;

  beforeEach(() => {
    config = {
      enablePostCssValidation: true,
      enableStylelintValidation: false,
      enableTailwindValidation: false,
      failFast: false,
      includeSuggestions: true,
      maxErrorsPerFile: 100,
      postCssPlugins: [],
      customRules: [],
    };
    validator = new CssSyntaxValidator(config);
  });

  describe('CSS Grid Browser Compatibility', () => {
    test('should validate modern CSS Grid features', async () => {
      const modernGridCss = `
        .modern-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
          grid-template-rows: masonry; /* Future CSS feature */
          gap: clamp(1rem, 3vw, 2rem);
          grid-auto-flow: row dense;
        }
      `;

      const result = await validator.validateCss(modernGridCss);
      // Should handle modern grid features without errors
      expect(result.isValid).toBe(true);
    });

    test('should handle subgrid compatibility', async () => {
      const subgridCss = `
        .parent-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 1rem;
        }
        
        .subgrid-item {
          grid-column: 1 / -1;
          display: subgrid;
          grid-template-columns: subgrid;
        }
      `;

      const result = await validator.validateCss(subgridCss);
      expect(result.isValid).toBe(true);
    });

    test('should validate grid with logical properties', async () => {
      const logicalGridCss = `
        .logical-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 1rem;
          margin-inline: auto;
          padding-block: 2rem;
          border-inline: 1px solid #ccc;
        }
      `;

      const result = await validator.validateCss(logicalGridCss);
      expect(result.isValid).toBe(true);
    });
  });

  describe('Flexbox Gap Property Compatibility', () => {
    test('should validate flexbox with gap property', async () => {
      const flexGapCss = `
        .flex-with-gap {
          display: flex;
          flex-direction: column;
          gap: 1rem;
          align-items: stretch;
        }
        
        .flex-row-gap {
          display: flex;
          flex-wrap: wrap;
          gap: 1rem 2rem; /* row-gap column-gap */
        }
      `;

      const result = await validator.validateCss(flexGapCss);
      expect(result.isValid).toBe(true);
    });

    test('should handle flex gap fallbacks', async () => {
      const flexGapFallbackCss = `
        .flex-gap-fallback {
          display: flex;
          gap: 1rem;
        }
        
        /* Fallback for older browsers */
        .flex-gap-fallback > * + * {
          margin-left: 1rem;
        }
      `;

      const result = await validator.validateCss(flexGapFallbackCss);
      expect(result.isValid).toBe(true);
    });
  });

  describe('Modern Selector Compatibility', () => {
    test('should validate :is() selector compatibility', async () => {
      const isSelectorCss = `
        :is(.button, .btn, input[type="button"], input[type="submit"]) {
          padding: 0.5rem 1rem;
          border-radius: 0.25rem;
          cursor: pointer;
        }
        
        :is(h1, h2, h3, h4, h5, h6) {
          margin-block: 0 1rem;
          line-height: 1.2;
        }
      `;

      const result = await validator.validateCss(isSelectorCss);
      expect(result.isValid).toBe(true);
    });

    test('should validate :where() selector for zero specificity', async () => {
      const whereSelectorCss = `
        :where(.reset, .base) {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        
        :where(.component) :is(.title, .heading) {
          font-weight: bold;
        }
      `;

      const result = await validator.validateCss(whereSelectorCss);
      expect(result.isValid).toBe(true);
    });

    test('should validate :has() parent selector', async () => {
      const hasSelectorCss = `
        .card:has(.card-image) {
          display: grid;
          grid-template-columns: auto 1fr;
        }
        
        .form:has(.error) {
          border-color: red;
          background-color: #fef2f2;
        }
        
        .article:has(> .featured-image) {
          margin-top: 2rem;
        }
      `;

      const result = await validator.validateCss(hasSelectorCss);
      expect(result.isValid).toBe(true);
    });

    test('should handle complex modern selector combinations', async () => {
      const complexSelectorCss = `
        :is(.card, .panel):has(.icon):where(:not(.disabled)) {
          padding-inline-start: 3rem;
        }
        
        :is(.button, .link):not(.disabled, .loading):has(.icon) {
          gap: 0.5rem;
          display: inline-flex;
          align-items: center;
        }
      `;

      const result = await validator.validateCss(complexSelectorCss);
      expect(result.isValid).toBe(true);
    });
  });

  describe('CSS Nesting Compatibility', () => {
    test('should validate basic CSS nesting', async () => {
      const basicNestingCss = `
        .component {
          padding: 1rem;
          background: white;
          
          & .title {
            font-size: 1.5rem;
            margin-bottom: 0.5rem;
          }
          
          & .content {
            line-height: 1.6;
            
            & p {
              margin-bottom: 1rem;
            }
          }
          
          &:hover {
            background: #f8f9fa;
          }
        }
      `;

      const result = await validator.validateCss(basicNestingCss);
      expect(result.isValid).toBe(true);
    });

    test('should handle nested at-rules', async () => {
      const nestedAtRulesCss = `
        .responsive-component {
          width: 100%;
          
          @media (min-width: 768px) {
            width: 50%;
            
            &:hover {
              transform: scale(1.02);
            }
          }
          
          @supports (display: grid) {
            display: grid;
            grid-template-columns: 1fr 1fr;
          }
        }
      `;

      const result = await validator.validateCss(nestedAtRulesCss);
      expect(result.isValid).toBe(true);
    });

    test('should validate complex nesting patterns', async () => {
      const complexNestingCss = `
        .navigation {
          display: flex;
          
          & ul {
            list-style: none;
            margin: 0;
            padding: 0;
            
            & li {
              display: inline-block;
              
              & a {
                display: block;
                padding: 1rem;
                text-decoration: none;
                
                &:hover,
                &:focus {
                  background: rgba(0, 0, 0, 0.1);
                  
                  & .icon {
                    transform: translateX(0.25rem);
                  }
                }
                
                @media (max-width: 768px) {
                  padding: 0.5rem;
                  
                  & .text {
                    display: none;
                  }
                }
              }
            }
          }
        }
      `;

      const result = await validator.validateCss(complexNestingCss);
      expect(result.isValid).toBe(true);
    });
  });

  describe('CSS Layers Compatibility', () => {
    test('should validate cascade layers', async () => {
      const layersCss = `
        @layer reset, base, components, utilities;
        
        @layer reset {
          * {
            box-sizing: border-box;
          }
          
          html, body {
            margin: 0;
            padding: 0;
          }
        }
        
        @layer base {
          body {
            font-family: system-ui, sans-serif;
            line-height: 1.5;
          }
        }
        
        @layer components {
          .button {
            padding: 0.5rem 1rem;
            border: none;
            border-radius: 0.25rem;
            cursor: pointer;
          }
        }
        
        @layer utilities {
          .text-center { text-align: center; }
          .hidden { display: none; }
        }
      `;

      const result = await validator.validateCss(layersCss);
      expect(result.isValid).toBe(true);
    });

    test('should handle anonymous layers', async () => {
      const anonymousLayersCss = `
        @layer {
          .anonymous-layer-component {
            background: #f0f0f0;
            padding: 1rem;
          }
        }
        
        @layer {
          .another-anonymous {
            margin: 1rem;
          }
        }
      `;

      const result = await validator.validateCss(anonymousLayersCss);
      expect(result.isValid).toBe(true);
    });

    test('should validate layer imports', async () => {
      const layerImportsCss = `
        @import "normalize.css" layer(reset);
        @import "base.css" layer(base);
        @import "components.css" layer(components);
        
        @layer utilities {
          .sr-only {
            position: absolute;
            width: 1px;
            height: 1px;
            padding: 0;
            margin: -1px;
            overflow: hidden;
            clip: rect(0, 0, 0, 0);
            white-space: nowrap;
            border: 0;
          }
        }
      `;

      const result = await validator.validateCss(layerImportsCss);
      expect(result.isValid).toBe(true);
    });
  });

  describe('Container Queries Compatibility', () => {
    test('should validate container query syntax', async () => {
      const containerQueryCss = `
        .card-container {
          container-type: inline-size;
          container-name: card;
        }
        
        @container card (min-width: 400px) {
          .card {
            display: grid;
            grid-template-columns: auto 1fr;
            gap: 1rem;
          }
        }
        
        @container (max-width: 300px) {
          .card .title {
            font-size: 1rem;
          }
        }
      `;

      const result = await validator.validateCss(containerQueryCss);
      expect(result.isValid).toBe(true);
    });

    test('should handle size containment', async () => {
      const sizeContainmentCss = `
        .sidebar {
          container-type: size;
          contain: layout style size;
        }
        
        @container (min-height: 400px) {
          .sidebar .widget {
            display: block;
          }
        }
      `;

      const result = await validator.validateCss(sizeContainmentCss);
      expect(result.isValid).toBe(true);
    });
  });

  describe('Cross-Feature Integration', () => {
    test('should validate comprehensive modern CSS integration', async () => {
      const comprehensiveCss = `
        @layer base, components, utilities;
        
        @layer base {
          :root {
            --primary: hsl(210 100% 50%);
            --secondary: hsl(220 15% 25%);
            --spacing: clamp(0.5rem, 2vw, 1rem);
          }
          
          :is(h1, h2, h3, h4, h5, h6) {
            margin-block: 0 var(--spacing);
            color: var(--primary);
          }
        }
        
        @layer components {
          .card {
            container-type: inline-size;
            
            &:has(.featured-image) {
              display: grid;
              grid-template-columns: auto 1fr;
              gap: var(--spacing);
              
              @container (min-width: 400px) {
                grid-template-columns: 200px 1fr;
              }
            }
            
            & .content {
              padding-inline: var(--spacing);
              
              & :is(p, ul, ol) {
                margin-block: calc(var(--spacing) * 0.5);
              }
            }
            
            @media (prefers-reduced-motion: reduce) {
              &:hover {
                transform: none;
              }
            }
          }
          
          .button:not(.disabled, .loading) {
            display: inline-flex;
            align-items: center;
            gap: 0.5rem;
            padding-inline: 1rem;
            padding-block: 0.5rem;
            border: 1px solid var(--primary);
            border-radius: 0.25rem;
            
            &:where(:hover, :focus-visible) {
              background: var(--primary);
              color: white;
            }
          }
        }
        
        @layer utilities {
          .flex-center {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: inherit;
          }
          
          .grid-auto {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: var(--spacing);
          }
        }
      `;

      const result = await validator.validateCss(comprehensiveCss);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should handle progressive enhancement patterns', async () => {
      const progressiveEnhancementCss = `
        .enhanced-component {
          /* Base styles for all browsers */
          padding: 1rem;
          background: #f8f9fa;
          
          /* Enhanced for modern browsers */
          padding-inline: clamp(1rem, 3vw, 2rem);
          background: color-mix(in srgb, white 90%, var(--primary, blue) 10%);
          
          @supports (display: grid) {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          }
          
          @supports (gap: 1rem) {
            gap: 1rem;
          }
          
          @supports selector(:has(*)) {
            &:has(.important) {
              border-inline-start: 4px solid var(--primary);
            }
          }
          
          @supports (container-type: inline-size) {
            container-type: inline-size;
            
            @container (min-width: 400px) {
              padding: 2rem;
            }
          }
        }
      `;

      const result = await validator.validateCss(progressiveEnhancementCss);
      expect(result.isValid).toBe(true);
    });

    test('should validate fallback strategies', async () => {
      const fallbackStrategiesCss = `
        .fallback-component {
          /* Flexbox fallback for grid */
          display: flex;
          flex-wrap: wrap;
          margin: -0.5rem;
          
          & > * {
            margin: 0.5rem;
            flex: 1 1 200px;
          }
          
          /* Grid enhancement */
          @supports (display: grid) {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 1rem;
            margin: 0;
            
            & > * {
              margin: 0;
              flex: none;
            }
          }
          
          /* Logical properties with physical fallbacks */
          margin-left: 1rem;
          margin-right: 1rem;
          margin-inline: 1rem;
          
          /* Custom properties with fallbacks */
          color: black;
          color: var(--text-color, black);
          
          /* Modern functions with fallbacks */
          font-size: 1.2rem;
          font-size: clamp(1rem, 2.5vw, 1.5rem);
        }
      `;

      const result = await validator.validateCss(fallbackStrategiesCss);
      expect(result.isValid).toBe(true);
    });
  });

  describe('Performance and Optimization', () => {
    test('should handle large modern CSS files efficiently', async () => {
      // Generate a large CSS string with modern features
      const largeCssArray: string[] = [];
      
      // Add layer definitions
      largeCssArray.push('@layer base, components, utilities;');
      
      // Generate many modern CSS rules
      for (let i = 0; i < 100; i++) {
        largeCssArray.push(`
          @layer components {
            .component-${i} {
              display: grid;
              grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
              gap: clamp(0.5rem, 2vw, 1rem);
              padding-inline: var(--spacing-${i}, 1rem);
              
              &:has(.icon-${i}) {
                padding-inline-start: 2rem;
              }
              
              @container (min-width: ${300 + i * 10}px) {
                grid-template-columns: repeat(${Math.min(i % 5 + 1, 4)}, 1fr);
              }
            }
          }
        `);
      }
      
      const largeCss = largeCssArray.join('\n');
      
      const startTime = Date.now();
      const result = await validator.validateCss(largeCss);
      const endTime = Date.now();
      
      expect(result.isValid).toBe(true);
      expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5 seconds
    });

    test('should validate complex selector performance', async () => {
      const complexSelectorsCss = `
        :is(.a, .b, .c, .d, .e):not(.disabled):has(.icon):where(:hover, :focus) {
          transform: translateY(-1px);
        }
        
        :is(
          .button,
          input[type="button"],
          input[type="submit"],
          input[type="reset"],
          .btn,
          .action,
          .cta
        ):not(
          .disabled,
          .loading,
          .processing,
          [disabled],
          [aria-disabled="true"]
        ):has(
          .icon,
          .spinner,
          .badge
        ):where(
          :hover,
          :focus,
          :active,
          .active,
          .focused
        ) {
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
        }
      `;

      const result = await validator.validateCss(complexSelectorsCss);
      expect(result.isValid).toBe(true);
    });
  });
});