/**
 * Copyright (c) 2025 Rowan Cardow
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, expect, it } from 'vitest';
import {
  generateRandomClassName,
  generateUniqueClassName,
} from '../../src/scrambler/ClassNameGenerator';
import { ClassNameRegistry } from '../../src/types/registry';

describe('ClassNameGenerator', () => {
  describe('generateRandomClassName', () => {
    it('should generate a class name of the specified length', () => {
      expect(generateRandomClassName(5)).toHaveLength(5);
      expect(generateRandomClassName(10)).toHaveLength(10);
    });

    it('should start with a letter', () => {
      const className = generateRandomClassName(5);
      expect(className[0]).toMatch(/[a-z]/);
    });

    it('should only contain lowercase letters and numbers', () => {
      const className = generateRandomClassName(10);
      expect(className).toMatch(/^[a-z][a-z0-9]*$/);
    });

    it('should generate different class names on subsequent calls', () => {
      const name1 = generateRandomClassName(8);
      const name2 = generateRandomClassName(8);
      expect(name1).not.toBe(name2);
    });

    it('should handle length 1 correctly', () => {
      const className = generateRandomClassName(1);
      expect(className).toHaveLength(1);
      expect(className).toMatch(/^[a-z]$/);
    });
  });

  describe('generateUniqueClassName', () => {
    it('should generate a unique class name', () => {
      const registry: ClassNameRegistry = {
        existing: { elements: new Set(), cssRule: {} as CSSStyleRule },
      };
      const newName = generateUniqueClassName(registry);
      expect(newName).not.toBe('existing');
      expect(registry[newName]).toBeUndefined();
    });

    it('should handle collisions by generating a new name', () => {
      const name1 = generateRandomClassName(1);
      const registry: ClassNameRegistry = {
        [name1]: { elements: new Set(), cssRule: {} as CSSStyleRule },
      };

      // This is not perfectly deterministic, but we can mock Math.random
      const mockMath = Object.create(global.Math);
      mockMath.random = () => 0.5; // Will always generate 'n'
      global.Math = mockMath;

      const newName = generateUniqueClassName(registry, 1);
      expect(newName).not.toBe(name1);

      // Restore Math
      global.Math = Object.create(global.Math);
    });

    it('should increase length after too many collisions', () => {
      const registry: ClassNameRegistry = {};
      const charset = 'abcdefghijklmnopqrstuvwxyz';
      // Fill up the registry with all possible 1-letter class names
      for (let i = 0; i < charset.length; i++) {
        registry[charset[i]] = { elements: new Set(), cssRule: {} as CSSStyleRule };
      }

      const newName = generateUniqueClassName(registry, 1);
      expect(newName.length).toBeGreaterThan(1);
    });
  });
});
