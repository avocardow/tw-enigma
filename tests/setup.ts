/**
 * Global test setup for Vitest
 * Fixes MaxListenersExceededWarning and other common test environment issues
 */

import { EventEmitter } from "events";

// Increase the default max listeners to prevent warnings during CLI tests
EventEmitter.defaultMaxListeners = 30;

// Set process max listeners to handle CLI spawning
process.setMaxListeners(30);

// Additional setup for CLI testing environment
if (process.env.NODE_ENV !== "test") {
  process.env.NODE_ENV = "test";
}

// Suppress warning logs during tests to reduce noise
const originalConsoleWarn = console.warn;
console.warn = (...args: any[]) => {
  // Filter out specific warnings we don't care about in tests
  const message = args.join(" ");
  if (
    message.includes("MaxListenersExceededWarning") ||
    message.includes("Possible EventEmitter memory leak detected")
  ) {
    return;
  }
  originalConsoleWarn.apply(console, args);
};

export {}; 