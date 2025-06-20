/**
 * Copyright (c) 2025 Rowan Cardow
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, expect, it, vi } from 'vitest';
import { updateCssRule, updateDomElement } from '../../src/scrambler/Scrambler';
import { ClassNameRegistry } from '../../src/types/registry';

describe('Scrambler', () => {
  describe('updateCssRule', () => {
    it('should update the selectorText of the CSS rule', () => {
      const mockRule = { selectorText: '.original' } as CSSStyleRule;
      const registry: ClassNameRegistry = {
        original: { elements: new Set(), cssRule: mockRule },
      };

      updateCssRule(registry, 'original', 'scrambled');

      expect(mockRule.selectorText).toBe('.scrambled');
    });

    it('should warn if the class name is not in the registry', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const registry: ClassNameRegistry = {};

      updateCssRule(registry, 'nonexistent', 'scrambled');

      expect(warnSpy).toHaveBeenCalledWith('No CSS rule found for class: nonexistent');
      warnSpy.mockRestore();
    });

    it('should handle entries with no cssRule gracefully', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const registry: ClassNameRegistry = {
        original: { elements: new Set(), cssRule: undefined as any },
      };

      updateCssRule(registry, 'original', 'scrambled');

      expect(warnSpy).toHaveBeenCalledWith('No CSS rule found for class: original');
      warnSpy.mockRestore();
    });
  });

  describe('updateDomElement', () => {
    it('should update classList of registered elements', () => {
      const elem1 = document.createElement('div');
      elem1.classList.add('original');
      const elem2 = document.createElement('span');
      elem2.classList.add('original');
      const registry: ClassNameRegistry = {
        original: { elements: new Set([elem1, elem2]), cssRule: undefined as any },
      };

      updateDomElement(registry, 'original', 'scrambled');

      expect(elem1.classList.contains('scrambled')).toBe(true);
      expect(elem1.classList.contains('original')).toBe(false);
      expect(elem2.classList.contains('scrambled')).toBe(true);
      expect(elem2.classList.contains('original')).toBe(false);
    });

    it('should warn if registry entry is missing', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const registry: ClassNameRegistry = {};

      updateDomElement(registry, 'nonexistent', 'scrambled');

      expect(warnSpy).toHaveBeenCalledWith('No registry entry found for class: nonexistent');
      warnSpy.mockRestore();
    });
  });
});
