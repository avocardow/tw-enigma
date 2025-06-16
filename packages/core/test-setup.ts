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

console.log('✨ Test environment ready');
