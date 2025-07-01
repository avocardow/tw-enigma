// Jest setup file for global configuration
jest.setTimeout(30000);

// Mock console for cleaner test output
global.console = {
  ...console,
  warn: jest.fn(),
  error: jest.fn(),
  log: jest.fn(),
};