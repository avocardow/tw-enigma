#!/usr/bin/env node

/**
 * Developer utilities script with enhanced error handling
 * Provides helpful error messages and validation for common development tasks
 */

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// ANSI color codes for better output
const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
};

function colorize(text, color) {
  return `${colors[color]}${text}${colors.reset}`;
}

function logError(message) {
  console.error(`${colors.red}${colors.bold}✗ ERROR:${colors.reset} ${message}`);
}

function logWarning(message) {
  console.warn(`${colors.yellow}${colors.bold}⚠ WARNING:${colors.reset} ${message}`);
}

function logSuccess(message) {
  console.log(`${colors.green}${colors.bold}✓ SUCCESS:${colors.reset} ${message}`);
}

function logInfo(message) {
  console.log(`${colors.blue}${colors.bold}ℹ INFO:${colors.reset} ${message}`);
}

function logSection(title) {
  console.log(`\n${colors.cyan}${colors.bold}=== ${title} ===${colors.reset}\n`);
}

function checkProjectStructure() {
  logSection('Project Structure Validation');

  const requiredFiles = [
    'package.json',
    'turbo.json',
    'pnpm-workspace.yaml',
    'packages/core/package.json',
    'packages/cli/package.json',
  ];

  const missingFiles = requiredFiles.filter((file) => !fs.existsSync(file));

  if (missingFiles.length > 0) {
    logError(`Missing required files: ${missingFiles.join(', ')}`);
    logInfo('Please ensure you are in the project root directory');
    return false;
  }

  logSuccess('Project structure validated');
  return true;
}

function checkDependencies() {
  logSection('Dependency Check');

  try {
    execSync('pnpm --version', { stdio: 'ignore' });
    logSuccess('pnpm is available');
  } catch (error) {
    logError('pnpm is not installed or not available in PATH');
    logInfo('Install pnpm: npm install -g pnpm');
    return false;
  }

  try {
    execSync('turbo --version', { stdio: 'ignore' });
    logSuccess('turbo is available');
  } catch (error) {
    logWarning('turbo is not globally available, using local version');
  }

  return true;
}

function runCommand(command, options = {}) {
  logInfo(`Running: ${colorize(command, 'cyan')}`);

  try {
    const result = execSync(command, {
      stdio: 'pipe',
      encoding: 'utf8',
      ...options,
    });

    logSuccess(`Command completed successfully`);
    if (result.trim()) {
      console.log(result);
    }
    return { success: true, output: result };
  } catch (error) {
    logError(`Command failed with exit code ${error.status}`);

    if (error.stdout) {
      console.log('\nSTDOUT:');
      console.log(error.stdout);
    }

    if (error.stderr) {
      console.error('\nSTDERR:');
      console.error(error.stderr);
    }

    // Provide helpful suggestions based on common errors
    if (error.stderr && error.stderr.includes('ELIFECYCLE')) {
      logInfo('This appears to be a build/script failure. Try:');
      console.log('  - Check for TypeScript errors');
      console.log('  - Run: pnpm clean:all && pnpm install');
      console.log('  - Verify package.json scripts are correct');
    }

    if (error.stderr && error.stderr.includes('Module')) {
      logInfo('This appears to be a module resolution error. Try:');
      console.log('  - Check import/export statements');
      console.log('  - Verify file paths are correct');
      console.log('  - Run: pnpm type-check');
    }

    return { success: false, error: error.message, stderr: error.stderr };
  }
}

function validateBuild() {
  logSection('Build Validation');

  // Check for known issues first
  const coreIndexPath = 'packages/core/src/index.ts';
  if (fs.existsSync(coreIndexPath)) {
    const content = fs.readFileSync(coreIndexPath, 'utf8');
    if (content.includes('export ') && content.split('export ').length > 20) {
      logWarning('Detected many exports in core/index.ts - this may cause duplicate export errors');
      logInfo('Consider consolidating exports or checking for duplicates');
    }
  }

  logInfo('Attempting to build packages...');

  // Try building core first
  const coreResult = runCommand('pnpm --filter @tw-enigma/core build', { cwd: process.cwd() });

  if (!coreResult.success) {
    logError('Core package build failed');
    logInfo('Skipping CLI build due to core dependency');
    return false;
  }

  // Try building CLI
  const cliResult = runCommand('pnpm --filter @tw-enigma/cli build', { cwd: process.cwd() });

  if (!cliResult.success) {
    logError('CLI package build failed');
    return false;
  }

  logSuccess('All packages built successfully');
  return true;
}

function runTests() {
  logSection('Test Validation');

  logInfo('Running unit tests...');
  const testResult = runCommand('pnpm test:unit');

  if (!testResult.success) {
    logWarning('Some tests failed, but this is expected during development');
    return false;
  }

  logSuccess('All tests passed');
  return true;
}

function runLinting() {
  logSection('Code Quality Check');

  logInfo('Running linter...');
  const lintResult = runCommand('pnpm lint');

  if (!lintResult.success) {
    logWarning('Linting issues found');
    logInfo('Run: pnpm lint:fix to auto-fix some issues');
    return false;
  }

  logSuccess('No linting issues found');
  return true;
}

function main() {
  console.log(`${colors.bold}${colors.magenta}🚀 TW-Enigma Developer Utilities${colors.reset}\n`);

  const args = process.argv.slice(2);
  const command = args[0];

  if (!checkProjectStructure()) {
    process.exit(1);
  }

  if (!checkDependencies()) {
    process.exit(1);
  }

  switch (command) {
    case 'validate':
      const buildOk = validateBuild();
      const testOk = runTests();
      const lintOk = runLinting();

      if (buildOk && testOk && lintOk) {
        logSuccess('All validations passed!');
        process.exit(0);
      } else {
        logWarning('Some validations failed, but this may be expected during development');
        process.exit(1);
      }
      break;

    case 'build':
      if (validateBuild()) {
        process.exit(0);
      } else {
        process.exit(1);
      }
      break;

    case 'test':
      if (runTests()) {
        process.exit(0);
      } else {
        process.exit(1);
      }
      break;

    case 'lint':
      if (runLinting()) {
        process.exit(0);
      } else {
        process.exit(1);
      }
      break;

    default:
      console.log(`${colors.bold}Usage:${colors.reset}`);
      console.log('  node scripts/dev-utils.js validate  - Run all validations');
      console.log('  node scripts/dev-utils.js build    - Validate build process');
      console.log('  node scripts/dev-utils.js test     - Run tests');
      console.log('  node scripts/dev-utils.js lint     - Run linting');
      process.exit(0);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  checkProjectStructure,
  checkDependencies,
  runCommand,
  validateBuild,
  runTests,
  runLinting,
  colorize,
  logError,
  logWarning,
  logSuccess,
  logInfo,
  logSection,
};
