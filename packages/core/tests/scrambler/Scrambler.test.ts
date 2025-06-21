/**
 * Copyright (c) 2025 Rowan Cardow
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, expect, it, vi } from 'vitest';
import { updateCssRule, updateDomElement } from '../../src/scrambler/Scrambler';

describe('Scrambler', () => {
  describe('updateCssRule', () => {
    it('should update the selectorText of the CSS rule', () => {
      const mockRule = { selectorText: '.original' } as CSSStyleRule;
      const registry: ClassRegistry = {
        original: {
          elements: [],
          cssRule: mockRule,
          originalClassName: 'original',
          lastUpdated: Date.now(),
          stats: {
            queryCount: 0,
            activeElementCount: 0,
            peakElementCount: 0,
          },
        },
      };

      updateCssRule(registry, 'original', 'scrambled');

      expect(mockRule.selectorText).toBe('.scrambled');
    });

    it('should warn if the class name is not in the registry', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const registry: ClassRegistry = {};

      updateCssRule(registry, 'nonexistent', 'scrambled');

      expect(warnSpy).toHaveBeenCalledWith('No CSS rule found for class: nonexistent');
      warnSpy.mockRestore();
    });

    it('should handle entries with no cssRule gracefully', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const registry: ClassRegistry = {
        original: {
          elements: [],
          cssRule: undefined as any,
          originalClassName: 'original',
          lastUpdated: Date.now(),
          stats: {
            queryCount: 0,
            activeElementCount: 0,
            peakElementCount: 0,
          },
        },
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

      const registry: ClassRegistry = {
        original: {
          elements: [
            {
              weakRef: new WeakRef(elem1),
              tagName: 'div',
              classListSnapshot: ['original'],
              createdAt: Date.now(),
              isConnected: true,
            },
            {
              weakRef: new WeakRef(elem2),
              tagName: 'span',
              classListSnapshot: ['original'],
              createdAt: Date.now(),
              isConnected: true,
            },
          ],
          cssRule: undefined as any,
          originalClassName: 'original',
          lastUpdated: Date.now(),
          stats: {
            queryCount: 0,
            activeElementCount: 2,
            peakElementCount: 2,
          },
        },
      };

      updateDomElement(registry, 'original', 'scrambled');

      expect(elem1.classList.contains('scrambled')).toBe(true);
      expect(elem1.classList.contains('original')).toBe(false);
      expect(elem2.classList.contains('scrambled')).toBe(true);
      expect(elem2.classList.contains('original')).toBe(false);
    });

    it('should warn if registry entry is missing', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const registry: ClassRegistry = {};

      updateDomElement(registry, 'nonexistent', 'scrambled');

      expect(warnSpy).toHaveBeenCalledWith('No registry entry found for class: nonexistent');
      warnSpy.mockRestore();
    });
  });
});
