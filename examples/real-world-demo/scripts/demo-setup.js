#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🚀 Setting up TW-Enigma + Scramble Real-World Demo\n');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  blue: '\x1b[34m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function checkRequirements() {
  log('📋 Checking requirements...', 'blue');
  
  try {
    // Check Node.js version
    const nodeVersion = process.version;
    const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);
    
    if (majorVersion < 18) {
      throw new Error(`Node.js 18+ required. Current version: ${nodeVersion}`);
    }
    log(`✅ Node.js ${nodeVersion}`, 'green');
    
    // Check for pnpm
    try {
      execSync('pnpm --version', { stdio: 'ignore' });
      log('✅ pnpm available', 'green');
    } catch {
      log('⚠️  pnpm not found. Installing...', 'yellow');
      execSync('npm install -g pnpm', { stdio: 'inherit' });
    }
    
    // Check if we're in the right directory
    const demoPath = path.join(process.cwd(), 'nextjs-shop');
    if (!fs.existsSync(demoPath)) {
      throw new Error('Demo files not found. Run this script from the examples/real-world-demo directory.');
    }
    log('✅ Demo files found', 'green');
    
  } catch (error) {
    log(`❌ Requirement check failed: ${error.message}`, 'red');
    process.exit(1);
  }
}

function installDependencies() {
  log('\n📦 Installing dependencies...', 'blue');
  
  try {
    // Install root dependencies
    log('Installing demo dependencies...', 'cyan');
    execSync('pnpm install', { stdio: 'inherit' });
    
    // Install Next.js dependencies
    log('Installing Next.js dependencies...', 'cyan');
    process.chdir('nextjs-shop');
    execSync('pnpm install', { stdio: 'inherit' });
    process.chdir('..');
    
    log('✅ Dependencies installed', 'green');
  } catch (error) {
    log(`❌ Dependency installation failed: ${error.message}`, 'red');
    process.exit(1);
  }
}

function setupConfiguration() {
  log('\n⚙️  Setting up configuration...', 'blue');
  
  try {
    // Create necessary directories
    const dirs = [
      'nextjs-shop/.next',
      'nextjs-shop/dist',
      'reports'
    ];
    
    dirs.forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        log(`Created directory: ${dir}`, 'cyan');
      }
    });
    
    // Create .env.local for Next.js if it doesn't exist
    const envPath = 'nextjs-shop/.env.local';
    if (!fs.existsSync(envPath)) {
      const envContent = `# TW-Enigma Demo Environment Variables
NODE_ENV=development
ANALYZE=false
TW_ENIGMA_DEBUG=true
SCRAMBLE_DEBUG=true
DEMO_MODE=true
`;
      fs.writeFileSync(envPath, envContent);
      log('Created .env.local file', 'cyan');
    }
    
    log('✅ Configuration setup complete', 'green');
  } catch (error) {
    log(`❌ Configuration setup failed: ${error.message}`, 'red');
    process.exit(1);
  }
}

function createReports() {
  log('\n📊 Creating initial reports...', 'blue');
  
  try {
    const reportsDir = 'reports';
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
    }
    
    // Create performance baseline report
    const performanceReport = {
      timestamp: new Date().toISOString(),
      demo: 'TW-Enigma Real-World Demo',
      version: '1.0.0',
      baseline: {
        note: 'Run npm run test:performance to generate actual metrics'
      }
    };
    
    fs.writeFileSync(
      path.join(reportsDir, 'performance-baseline.json'),
      JSON.stringify(performanceReport, null, 2)
    );
    
    // Create optimization report template
    const optimizationReport = {
      timestamp: new Date().toISOString(),
      demo: 'TW-Enigma Real-World Demo',
      optimization: {
        note: 'Run npm run test:optimization to generate actual metrics'
      }
    };
    
    fs.writeFileSync(
      path.join(reportsDir, 'optimization-report.json'),
      JSON.stringify(optimizationReport, null, 2)
    );
    
    log('✅ Initial reports created', 'green');
  } catch (error) {
    log(`❌ Report creation failed: ${error.message}`, 'red');
    process.exit(1);
  }
}

function printInstructions() {
  log('\n🎉 Demo setup complete!', 'bright');
  log('\n📚 Available commands:', 'blue');
  log('  npm run dev              - Start development server', 'cyan');
  log('  npm run build            - Build optimized version', 'cyan');
  log('  npm run analyze          - Analyze bundle size', 'cyan');
  log('  npm run test:performance - Run performance tests', 'cyan');
  log('  npm run test:optimization- Test TW-Enigma optimization', 'cyan');
  log('  npm run test:privacy     - Test Scramble privacy protection', 'cyan');
  
  log('\n🎯 Quick start:', 'blue');
  log('  1. npm run dev           - Start the demo', 'yellow');
  log('  2. Open http://localhost:3000', 'yellow');
  log('  3. Open browser dev tools to see optimized classes', 'yellow');
  log('  4. Look for 🔒 icons on protected data', 'yellow');
  
  log('\n🔍 What to look for:', 'blue');
  log('  • Obfuscated CSS class names in production build', 'cyan');
  log('  • 🔒 Protection indicators on sensitive data', 'cyan');
  log('  • Form field protection in newsletter signup', 'cyan');
  log('  • Data scrambling when page is idle (5 seconds)', 'cyan');
  log('  • Reduced bundle sizes in network tab', 'cyan');
  
  log('\n📖 For more details, see:', 'blue');
  log('  • ./README.md - Complete documentation', 'cyan');
  log('  • ./nextjs-shop/README.md - Next.js specific guide', 'cyan');
  log('  • Browser console - Real-time demo logs', 'cyan');
}

// Main execution
function main() {
  try {
    checkRequirements();
    installDependencies();
    setupConfiguration();
    createReports();
    printInstructions();
  } catch (error) {
    log(`❌ Setup failed: ${error.message}`, 'red');
    process.exit(1);
  }
}

main();