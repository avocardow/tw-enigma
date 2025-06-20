/**
 * Copyright (c) 2025 Rowan Cardow
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ClassNameRegistry } from '../types/registry';

/**
 * Updates the CSS rule for a given class name.
 *
 * @param registry The class name registry.
 * @param originalClassName The original class name.
 * @param newClassName The new class name.
 */
export function updateCssRule(
  registry: ClassNameRegistry,
  originalClassName: string,
  newClassName: string
): void {
  const entry = registry[originalClassName];
  if (!entry || !entry.cssRule) {
    console.warn(`No CSS rule found for class: ${originalClassName}`);
    return;
  }
  entry.cssRule.selectorText = `.${newClassName}`;
}

export function updateDomElement(
  registry: ClassNameRegistry,
  originalClassName: string,
  newClassName: string
) {
  const entry = registry[originalClassName];
  if (!entry) {
    console.warn(`No registry entry found for class: ${originalClassName}`);
    return;
  }

  for (const element of entry.elements) {
    element.classList.remove(originalClassName);
    element.classList.add(newClassName);
  }
}
