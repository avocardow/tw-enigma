import { existsSync, rmSync } from 'fs';
import { join } from 'path';

// Clean up any lingering test directories before tests run
// This prevents issues where invalid config files from failed tests
// cause subsequent test runs to fail in CI environments

const testConfigDirs = [
  join(process.cwd(), 'test-config'),
  join(process.cwd(), 'packages/core/test-config'),
];

console.log('🧹 Cleaning up test environment...');

for (const dir of testConfigDirs) {
  try {
    if (existsSync(dir)) {
      rmSync(dir, { recursive: true, force: true });
      console.log(`✅ Cleaned up ${dir}`);
    }
  } catch (error) {
    console.warn(`⚠️ Failed to clean up ${dir}:`, error);
  }
}

// Add storage polyfills for JSDOM to prevent SecurityError
// Create comprehensive storage mock that handles all edge cases
const createStorageMock = () => {
  const storage = new Map<string, string>();

  return {
    getItem: (key: string) => storage.get(key) || null,
    setItem: (key: string, value: string) => {
      storage.set(key, String(value));
    },
    removeItem: (key: string) => {
      storage.delete(key);
    },
    clear: () => {
      storage.clear();
    },
    key: (index: number) => {
      const keys = Array.from(storage.keys());
      return keys[index] || null;
    },
    get length() {
      return storage.size;
    },
  };
};

// Mock localStorage and sessionStorage globally for both window and globalThis
const localStorageMock = createStorageMock();
const sessionStorageMock = createStorageMock();

// Handle window object (browser-like environment)
if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'localStorage', {
    value: localStorageMock,
    writable: true,
    configurable: true,
  });

  Object.defineProperty(window, 'sessionStorage', {
    value: sessionStorageMock,
    writable: true,
    configurable: true,
  });
}

// Handle globalThis (universal environment)
if (typeof globalThis !== 'undefined') {
  Object.defineProperty(globalThis, 'localStorage', {
    value: localStorageMock,
    writable: true,
    configurable: true,
  });

  Object.defineProperty(globalThis, 'sessionStorage', {
    value: sessionStorageMock,
    writable: true,
    configurable: true,
  });
}

// Handle global (Node.js environment)
if (typeof global !== 'undefined') {
  Object.defineProperty(global, 'localStorage', {
    value: localStorageMock,
    writable: true,
    configurable: true,
  });

  Object.defineProperty(global, 'sessionStorage', {
    value: sessionStorageMock,
    writable: true,
    configurable: true,
  });
}

// Re-apply to window if it exists to ensure our mock takes precedence
if (typeof window !== 'undefined') {
  // Mock other potentially missing APIs
  if (!window.matchMedia) {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: (query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => {},
      }),
    });
  }
}

console.log('✨ Test environment ready');
