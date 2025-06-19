import {
  ALPHABET_CONFIGS,
  toBase26,
  fromBase26,
  generateSequentialName,
  isValidCssIdentifier,
  calculateAestheticScore,
  clearAestheticCache,
  type NameGenerationOptions,
} from '@tw-enigma/core';
import { beforeEach, describe, expect, test } from 'vitest';

beforeEach(() => {
  clearAestheticCache();
});
describe('Name Generation Core Functions', () => {
  test('ALPHABET_CONFIGS contains expected configurations', () => {
    expect(ALPHABET_CONFIGS.minimal).toBeTruthy();
    expect(ALPHABET_CONFIGS.standard).toBeTruthy();
    expect(ALPHABET_CONFIGS.full).toBeTruthy();
  });
});
