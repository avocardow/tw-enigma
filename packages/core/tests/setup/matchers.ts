/**
 * Custom Jest Matchers for Framework Detection Tests
 */

import { expect } from '@jest/globals';
import type { DetectionResult, FrameworkInfo } from '../../src/frameworkDetector';

// Extend Jest matchers
expect.extend({
  toHaveFrameworkType(received: DetectionResult, frameworkType: string) {
    const pass = received.primary?.type === frameworkType;
    
    if (pass) {
      return {
        message: () => `Expected result not to have framework type ${frameworkType}`,
        pass: true,
      };
    } else {
      return {
        message: () => `Expected result to have framework type ${frameworkType}, but got ${received.primary?.type || 'undefined'}`,
        pass: false,
      };
    }
  },

  toHaveSSRCapability(received: DetectionResult) {
    const hasSSR = received.primary?.metadata.hasSSR === true;
    
    if (hasSSR) {
      return {
        message: () => 'Expected result not to have SSR capability',
        pass: true,
      };
    } else {
      return {
        message: () => 'Expected result to have SSR capability',
        pass: false,
      };
    }
  },

  toHaveHighConfidence(received: DetectionResult) {
    const confidence = received.primary?.confidence || 0;
    const pass = confidence >= 0.8;
    
    if (pass) {
      return {
        message: () => `Expected result not to have high confidence (>= 0.8), but got ${confidence}`,
        pass: true,
      };
    } else {
      return {
        message: () => `Expected result to have high confidence (>= 0.8), but got ${confidence}`,
        pass: false,
      };
    }
  },

  toDetectCSSInJS(received: DetectionResult) {
    const hasCSSInJS = received.primary?.metadata.hasCSSInJS === true;
    
    if (hasCSSInJS) {
      return {
        message: () => 'Expected result not to detect CSS-in-JS',
        pass: true,
      };
    } else {
      return {
        message: () => 'Expected result to detect CSS-in-JS',
        pass: false,
      };
    }
  },

  toHandleErrorsGracefully(received: DetectionResult) {
    const hasErrors = received.errors.length > 0;
    const hasRecoverableErrors = received.errors.every(error => error.recoverable);
    const hasValidResult = received.primary !== undefined || received.frameworks.length > 0;
    
    if (hasErrors && hasRecoverableErrors && hasValidResult) {
      return {
        message: () => 'Expected result not to handle errors gracefully',
        pass: true,
      };
    } else if (!hasErrors) {
      return {
        message: () => 'Expected result to have recoverable errors, but no errors were found',
        pass: false,
      };
    } else {
      return {
        message: () => `Expected result to handle errors gracefully. Errors: ${JSON.stringify(received.errors, null, 2)}`,
        pass: false,
      };
    }
  },
});

// Helper function to create test assertions
export function expectFrameworkDetection(result: DetectionResult) {
  return {
    toHaveType: (type: string) => expect(result).toHaveFrameworkType(type),
    toHaveSSR: () => expect(result).toHaveSSRCapability(),
    toHaveHighConfidence: () => expect(result).toHaveHighConfidence(),
    toDetectCSSInJS: () => expect(result).toDetectCSSInJS(),
    toHandleErrorsGracefully: () => expect(result).toHandleErrorsGracefully(),
  };
}

// Helper function for framework metadata assertions
export function expectFrameworkMetadata(framework: FrameworkInfo) {
  return {
    toHaveTypeScript: () => expect(framework.metadata.hasTypeScript).toBe(true),
    toHaveSSR: () => expect(framework.metadata.hasSSR).toBe(true),
    toHaveSSG: () => expect(framework.metadata.hasSSG).toBe(true),
    toHaveISR: () => expect(framework.metadata.hasISR).toBe(true),
    toHaveCSSInJS: () => expect(framework.metadata.hasCSSInJS).toBe(true),
    toHaveUtilityFirst: () => expect(framework.metadata.hasUtilityFirst).toBe(true),
    toHaveStylingLibrary: (library: string) => 
      expect(framework.metadata.stylingLibraries).toContain(library),
    toHaveConfidenceAbove: (threshold: number) => 
      expect(framework.confidence).toBeGreaterThan(threshold),
  };
}