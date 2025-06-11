/**
 * Copyright (c) 2025 Rowan Cardow
 * 
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { z } from 'zod';

// Basic validation result interface
export interface ValidationResult {
  isValid: boolean;
  validationType: 'core' | 'custom' | 'unknown';
  className: string;
  warnings?: string[];
}

// Configuration schema for simple validator
export const SimpleValidatorConfigSchema = z.object({
  enableValidation: z.boolean().default(true),
  skipInvalidClasses: z.boolean().default(false),
  warnOnInvalidClasses: z.boolean().default(true),
  customClasses: z.array(z.string()).default([]),
});

export type SimpleValidatorConfig = z.infer<typeof SimpleValidatorConfigSchema>;

// Core Tailwind CSS classes - minimal essential set
const CORE_TAILWIND_CLASSES = new Set([
  // Display
  'block', 'inline-block', 'inline', 'flex', 'inline-flex', 'table', 'inline-table',
  'table-caption', 'table-cell', 'table-column', 'table-column-group', 'table-footer-group',
  'table-header-group', 'table-row-group', 'table-row', 'flow-root', 'grid', 'inline-grid',
  'contents', 'list-item', 'hidden',
  
  // Position
  'static', 'fixed', 'absolute', 'relative', 'sticky',
  
  // Top / Right / Bottom / Left
  'inset-0', 'inset-x-0', 'inset-y-0', 'top-0', 'right-0', 'bottom-0', 'left-0',
  'inset-px', 'inset-x-px', 'inset-y-px', 'top-px', 'right-px', 'bottom-px', 'left-px',
  'inset-0.5', 'inset-1', 'inset-1.5', 'inset-2', 'inset-2.5', 'inset-3', 'inset-3.5',
  'inset-4', 'inset-5', 'inset-6', 'inset-7', 'inset-8', 'inset-9', 'inset-10',
  
  // Flex Direction
  'flex-row', 'flex-row-reverse', 'flex-col', 'flex-col-reverse',
  
  // Flex Wrap
  'flex-wrap', 'flex-wrap-reverse', 'flex-nowrap',
  
  // Flex
  'flex-1', 'flex-auto', 'flex-initial', 'flex-none',
  
  // Flex Grow
  'grow', 'grow-0',
  
  // Flex Shrink
  'shrink', 'shrink-0',
  
  // Order
  'order-1', 'order-2', 'order-3', 'order-4', 'order-5', 'order-6', 'order-7', 'order-8',
  'order-9', 'order-10', 'order-11', 'order-12', 'order-first', 'order-last', 'order-none',
  
  // Grid Template Columns
  'grid-cols-1', 'grid-cols-2', 'grid-cols-3', 'grid-cols-4', 'grid-cols-5', 'grid-cols-6',
  'grid-cols-7', 'grid-cols-8', 'grid-cols-9', 'grid-cols-10', 'grid-cols-11', 'grid-cols-12',
  'grid-cols-none',
  
  // Justify Content
  'justify-start', 'justify-end', 'justify-center', 'justify-between', 'justify-around',
  'justify-evenly', 'justify-stretch',
  
  // Align Items
  'items-start', 'items-end', 'items-center', 'items-baseline', 'items-stretch',
  
  // Align Self
  'self-auto', 'self-start', 'self-end', 'self-center', 'self-stretch', 'self-baseline',
  
  // Padding
  'p-0', 'p-px', 'p-0.5', 'p-1', 'p-1.5', 'p-2', 'p-2.5', 'p-3', 'p-3.5', 'p-4',
  'p-5', 'p-6', 'p-7', 'p-8', 'p-9', 'p-10', 'p-11', 'p-12', 'p-14', 'p-16',
  'px-0', 'px-px', 'px-0.5', 'px-1', 'px-1.5', 'px-2', 'px-2.5', 'px-3', 'px-3.5', 'px-4',
  'px-5', 'px-6', 'px-7', 'px-8', 'px-9', 'px-10', 'px-11', 'px-12', 'px-14', 'px-16',
  'py-0', 'py-px', 'py-0.5', 'py-1', 'py-1.5', 'py-2', 'py-2.5', 'py-3', 'py-3.5', 'py-4',
  'py-5', 'py-6', 'py-7', 'py-8', 'py-9', 'py-10', 'py-11', 'py-12', 'py-14', 'py-16',
  
  // Margin
  'm-0', 'm-px', 'm-0.5', 'm-1', 'm-1.5', 'm-2', 'm-2.5', 'm-3', 'm-3.5', 'm-4',
  'm-5', 'm-6', 'm-7', 'm-8', 'm-9', 'm-10', 'm-11', 'm-12', 'm-14', 'm-16',
  'mx-0', 'mx-px', 'mx-0.5', 'mx-1', 'mx-1.5', 'mx-2', 'mx-2.5', 'mx-3', 'mx-3.5', 'mx-4',
  'mx-5', 'mx-6', 'mx-7', 'mx-8', 'mx-9', 'mx-10', 'mx-11', 'mx-12', 'mx-14', 'mx-16',
  'my-0', 'my-px', 'my-0.5', 'my-1', 'my-1.5', 'my-2', 'my-2.5', 'my-3', 'my-3.5', 'my-4',
  'my-5', 'my-6', 'my-7', 'my-8', 'my-9', 'my-10', 'my-11', 'my-12', 'my-14', 'my-16',
  
  // Width
  'w-0', 'w-px', 'w-0.5', 'w-1', 'w-1.5', 'w-2', 'w-2.5', 'w-3', 'w-3.5', 'w-4',
  'w-5', 'w-6', 'w-7', 'w-8', 'w-9', 'w-10', 'w-11', 'w-12', 'w-14', 'w-16',
  'w-20', 'w-24', 'w-28', 'w-32', 'w-36', 'w-40', 'w-44', 'w-48', 'w-52', 'w-56',
  'w-60', 'w-64', 'w-72', 'w-80', 'w-96', 'w-auto', 'w-1/2', 'w-1/3', 'w-2/3',
  'w-1/4', 'w-2/4', 'w-3/4', 'w-1/5', 'w-2/5', 'w-3/5', 'w-4/5', 'w-1/6', 'w-2/6',
  'w-3/6', 'w-4/6', 'w-5/6', 'w-1/12', 'w-2/12', 'w-3/12', 'w-4/12', 'w-5/12',
  'w-6/12', 'w-7/12', 'w-8/12', 'w-9/12', 'w-10/12', 'w-11/12', 'w-full', 'w-screen',
  'w-min', 'w-max', 'w-fit',
  
  // Height
  'h-0', 'h-px', 'h-0.5', 'h-1', 'h-1.5', 'h-2', 'h-2.5', 'h-3', 'h-3.5', 'h-4',
  'h-5', 'h-6', 'h-7', 'h-8', 'h-9', 'h-10', 'h-11', 'h-12', 'h-14', 'h-16',
  'h-20', 'h-24', 'h-28', 'h-32', 'h-36', 'h-40', 'h-44', 'h-48', 'h-52', 'h-56',
  'h-60', 'h-64', 'h-72', 'h-80', 'h-96', 'h-auto', 'h-1/2', 'h-1/3', 'h-2/3',
  'h-1/4', 'h-2/4', 'h-3/4', 'h-1/5', 'h-2/5', 'h-3/5', 'h-4/5', 'h-1/6', 'h-2/6',
  'h-3/6', 'h-4/6', 'h-5/6', 'h-full', 'h-screen', 'h-min', 'h-max', 'h-fit',
  
  // Text Size
  'text-xs', 'text-sm', 'text-base', 'text-lg', 'text-xl', 'text-2xl', 'text-3xl',
  'text-4xl', 'text-5xl', 'text-6xl', 'text-7xl', 'text-8xl', 'text-9xl',
  
  // Font Weight
  'font-thin', 'font-extralight', 'font-light', 'font-normal', 'font-medium',
  'font-semibold', 'font-bold', 'font-extrabold', 'font-black',
  
  // Text Color
  'text-black', 'text-white', 'text-gray-50', 'text-gray-100', 'text-gray-200',
  'text-gray-300', 'text-gray-400', 'text-gray-500', 'text-gray-600', 'text-gray-700',
  'text-gray-800', 'text-gray-900', 'text-red-50', 'text-red-100', 'text-red-200',
  'text-red-300', 'text-red-400', 'text-red-500', 'text-red-600', 'text-red-700',
  'text-red-800', 'text-red-900', 'text-blue-50', 'text-blue-100', 'text-blue-200',
  'text-blue-300', 'text-blue-400', 'text-blue-500', 'text-blue-600', 'text-blue-700',
  'text-blue-800', 'text-blue-900',
  
  // Background Color
  'bg-transparent', 'bg-current', 'bg-black', 'bg-white', 'bg-gray-50', 'bg-gray-100',
  'bg-gray-200', 'bg-gray-300', 'bg-gray-400', 'bg-gray-500', 'bg-gray-600',
  'bg-gray-700', 'bg-gray-800', 'bg-gray-900', 'bg-red-50', 'bg-red-100',
  'bg-red-200', 'bg-red-300', 'bg-red-400', 'bg-red-500', 'bg-red-600',
  'bg-red-700', 'bg-red-800', 'bg-red-900', 'bg-blue-50', 'bg-blue-100',
  'bg-blue-200', 'bg-blue-300', 'bg-blue-400', 'bg-blue-500', 'bg-blue-600',
  'bg-blue-700', 'bg-blue-800', 'bg-blue-900',
  
  // Border Radius
  'rounded-none', 'rounded-sm', 'rounded', 'rounded-md', 'rounded-lg', 'rounded-xl',
  'rounded-2xl', 'rounded-3xl', 'rounded-full',
  
  // Border Width
  'border-0', 'border-2', 'border-4', 'border-8', 'border', 'border-x', 'border-y',
  'border-t', 'border-r', 'border-b', 'border-l',
  
  // Border Color
  'border-transparent', 'border-current', 'border-black', 'border-white',
  'border-gray-50', 'border-gray-100', 'border-gray-200', 'border-gray-300',
  'border-gray-400', 'border-gray-500', 'border-gray-600', 'border-gray-700',
  'border-gray-800', 'border-gray-900',
  
  // Box Shadow
  'shadow-sm', 'shadow', 'shadow-md', 'shadow-lg', 'shadow-xl', 'shadow-2xl',
  'shadow-inner', 'shadow-none',
  
  // Opacity
  'opacity-0', 'opacity-5', 'opacity-10', 'opacity-20', 'opacity-25', 'opacity-30',
  'opacity-40', 'opacity-50', 'opacity-60', 'opacity-70', 'opacity-75', 'opacity-80',
  'opacity-90', 'opacity-95', 'opacity-100',
  
  // Cursor
  'cursor-auto', 'cursor-default', 'cursor-pointer', 'cursor-wait', 'cursor-text',
  'cursor-move', 'cursor-help', 'cursor-not-allowed',
  
  // User Select
  'select-none', 'select-text', 'select-all', 'select-auto',
  
  // Pointer Events
  'pointer-events-none', 'pointer-events-auto',
  
  // Overflow
  'overflow-auto', 'overflow-hidden', 'overflow-clip', 'overflow-visible', 'overflow-scroll',
  'overflow-x-auto', 'overflow-y-auto', 'overflow-x-hidden', 'overflow-y-hidden',
  'overflow-x-clip', 'overflow-y-clip', 'overflow-x-visible', 'overflow-y-visible',
  'overflow-x-scroll', 'overflow-y-scroll',
]);

// Responsive prefixes
const RESPONSIVE_PREFIXES = new Set(['sm:', 'md:', 'lg:', 'xl:', '2xl:']);

// State prefixes
const STATE_PREFIXES = new Set([
  'hover:', 'focus:', 'focus-within:', 'focus-visible:', 'active:', 'visited:',
  'target:', 'first:', 'last:', 'only:', 'odd:', 'even:', 'first-of-type:',
  'last-of-type:', 'only-of-type:', 'empty:', 'disabled:', 'enabled:',
  'checked:', 'indeterminate:', 'default:', 'required:', 'valid:', 'invalid:',
  'in-range:', 'out-of-range:', 'placeholder-shown:', 'autofill:', 'read-only:',
]);

// Dark mode prefix
const DARK_MODE_PREFIX = 'dark:';

export class SimplePatternValidator {
  private customClasses: Set<string>;
  private config: SimpleValidatorConfig;

  constructor(config: Partial<SimpleValidatorConfig> = {}) {
    this.config = SimpleValidatorConfigSchema.parse(config);
    this.customClasses = new Set(this.config.customClasses);
  }

  /**
   * Validate a single CSS class
   */
  validateClass(className: string): ValidationResult {
    const trimmedClass = className.trim();
    
    if (!trimmedClass) {
      return {
        isValid: false,
        validationType: 'unknown',
        className: trimmedClass,
        warnings: ['Empty class name'],
      };
    }

    // Check for custom classes first
    if (this.customClasses.has(trimmedClass)) {
      return {
        isValid: true,
        validationType: 'custom',
        className: trimmedClass,
      };
    }

    // Extract base class by removing prefixes
    const baseClass = this.extractBaseClass(trimmedClass);
    
    // Check if base class is a core Tailwind class
    if (CORE_TAILWIND_CLASSES.has(baseClass)) {
      return {
        isValid: true,
        validationType: 'core',
        className: trimmedClass,
      };
    }

    // Check for arbitrary values like w-[100px]
    if (this.isArbitraryValue(baseClass)) {
      return {
        isValid: true,
        validationType: 'core',
        className: trimmedClass,
      };
    }

    // Unknown class
    const warnings = [];
    if (this.config.warnOnInvalidClasses) {
      warnings.push(`Unknown Tailwind class: ${trimmedClass}`);
    }

    return {
      isValid: false,
      validationType: 'unknown',
      className: trimmedClass,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  }

  /**
   * Validate multiple CSS classes
   */
  validateClasses(classNames: string[]): ValidationResult[] {
    return classNames.map(className => this.validateClass(className));
  }

  /**
   * Extract the base class by removing responsive and state prefixes
   */
  private extractBaseClass(className: string): string {
    let baseClass = className;

    // Remove dark mode prefix
    if (baseClass.startsWith(DARK_MODE_PREFIX)) {
      baseClass = baseClass.substring(DARK_MODE_PREFIX.length);
    }

    // Remove responsive prefixes
    for (const prefix of RESPONSIVE_PREFIXES) {
      if (baseClass.startsWith(prefix)) {
        baseClass = baseClass.substring(prefix.length);
        break;
      }
    }

    // Remove state prefixes
    for (const prefix of STATE_PREFIXES) {
      if (baseClass.startsWith(prefix)) {
        baseClass = baseClass.substring(prefix.length);
        break;
      }
    }

    return baseClass;
  }

  /**
   * Check if a class uses arbitrary values (square brackets)
   */
  private isArbitraryValue(className: string): boolean {
    // Check for patterns like w-[100px], bg-[#ff0000], etc.
    const arbitraryPattern = /^[a-z-]+\[[^\]]+\]$/;
    return arbitraryPattern.test(className);
  }

  /**
   * Add custom classes to the validator
   */
  addCustomClasses(classes: string[]): void {
    classes.forEach(cls => this.customClasses.add(cls));
  }

  /**
   * Remove custom classes from the validator
   */
  removeCustomClasses(classes: string[]): void {
    classes.forEach(cls => this.customClasses.delete(cls));
  }

  /**
   * Get all custom classes
   */
  getCustomClasses(): string[] {
    return Array.from(this.customClasses);
  }

  /**
   * Filter valid classes from a list
   */
  filterValidClasses(classNames: string[]): string[] {
    return classNames.filter(className => this.validateClass(className).isValid);
  }

  /**
   * Filter invalid classes from a list
   */
  filterInvalidClasses(classNames: string[]): string[] {
    return classNames.filter(className => !this.validateClass(className).isValid);
  }

  /**
   * Get validation statistics for a list of classes
   */
  getValidationStats(classNames: string[]): {
    total: number;
    valid: number;
    invalid: number;
    core: number;
    custom: number;
    unknown: number;
  } {
    const results = this.validateClasses(classNames);
    
    return {
      total: results.length,
      valid: results.filter(r => r.isValid).length,
      invalid: results.filter(r => !r.isValid).length,
      core: results.filter(r => r.validationType === 'core').length,
      custom: results.filter(r => r.validationType === 'custom').length,
      unknown: results.filter(r => r.validationType === 'unknown').length,
    };
  }
}

// Default instance with standard configuration
export const defaultValidator = new SimplePatternValidator();

// Utility functions for common operations
export function validateClass(className: string): ValidationResult {
  return defaultValidator.validateClass(className);
}

export function validateClasses(classNames: string[]): ValidationResult[] {
  return defaultValidator.validateClasses(classNames);
}

export function isValidClass(className: string): boolean {
  return defaultValidator.validateClass(className).isValid;
}

export function filterValidClasses(classNames: string[]): string[] {
  return defaultValidator.filterValidClasses(classNames);
}

export function filterInvalidClasses(classNames: string[]): string[] {
  return defaultValidator.filterInvalidClasses(classNames);
} 