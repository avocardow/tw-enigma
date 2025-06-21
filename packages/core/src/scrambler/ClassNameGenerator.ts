/**
 * Copyright (c) 2025 Rowan Cardow
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * Class Name Scrambling Utilities
 * Core algorithm for generating random class names.
 */

import { ClassNameRegistry } from '../types/registry';

// Using a-z and 0-9 for the character set.
const CHARSET = 'abcdefghijklmnopqrstuvwxyz';

/**
 * Generates a random class name.
 *
 * @param length The desired length of the class name.
 * @returns A random class name string.
 */
export function generateRandomClassName(length = 1): string {
  let result = '';

  // First character must be a letter (a-z) to be a valid CSS class name.
  result += CHARSET.substring(0, 26).charAt(Math.floor(Math.random() * 26));

  // If length > 1, add more random characters (can include numbers).
  for (let i = 1; i < length; i++) {
    result += CHARSET.charAt(Math.floor(Math.random() * CHARSET.length));
  }

  return result;
}

/**
 * Generates a unique class name that doesn't conflict with existing ones in the registry.
 *
 * @param registry The registry of existing class names.
 * @param preferredLength The preferred starting length for the new class name.
 * @returns A unique class name string.
 */
export function generateUniqueClassName(registry: ClassNameRegistry, preferredLength = 1): string {
  let length = preferredLength;
  let attempts = 0;
  let className: string;

  do {
    className = generateRandomClassName(length);
    attempts++;

    // If we've tried too many times at this length, increase the length
    // to reduce the probability of collisions.
    if (attempts > 10) {
      length++;
      attempts = 0;
    }
  } while (registry[className]);

  return className;
}
