#!/usr/bin/env node

/**
 * Security Check Runner for TW-Enigma
 * 
 * Performs comprehensive security scanning including dependency vulnerabilities,
 * secret detection, and static code analysis for local development and CI/CD.
 */

const { execSync } = require('child_process');
const fs = require('fs').promises;
const path = require('path');

class SecurityChecker {
  constructor(options = {}) {
    this.projectRoot = options.projectRoot || process.cwd();
    this.verbose = options.verbose || false;
    this.outputDir = options.outputDir || './security-reports';
    this.severityLevel = options.severityLevel || 'medium';
    this.skipCategories = options.skipCategories || [];
    
    this.scanCategories = {
      dependencies: !this.skipCategories.includes('dependencies'),
      secrets: !this.skipCategories.includes('secrets'),
      sast: !this.skipCategories.includes('sast'),
      licenses: !this.skipCategories.includes('licenses'),
    };
    
    this.severityMapping = {
      low: 'low',
      medium: 'moderate',
      high: 'high',
      critical: 'critical',
    };
  }
  
  /**
   * Run all security checks
   */
  async runAllChecks() {
    this.log('🔒 Starting comprehensive security scan...');
    
    await this.ensureOutputDirectory();
    
    const results = {
      timestamp: new Date().toISOString(),
      projectRoot: this.projectRoot,
      severityLevel: this.severityLevel,
      scans: {},
      summary: {
        totalIssues: 0,
        criticalIssues: 0,
        highIssues: 0,
        mediumIssues: 0,
        lowIssues: 0,
        passed: true,
      },
    };
    
    // Run dependency vulnerability scan
    if (this.scanCategories.dependencies) {
      results.scans.dependencies = await this.scanDependencies();
    }
    
    // Run secret detection
    if (this.scanCategories.secrets) {
      results.scans.secrets = await this.scanSecrets();
    }
    
    // Run static analysis
    if (this.scanCategories.sast) {
      results.scans.sast = await this.runStaticAnalysis();
    }
    
    // Run license compliance check
    if (this.scanCategories.licenses) {
      results.scans.licenses = await this.checkLicenses();
    }
    
    // Calculate summary
    this.calculateSummary(results);
    
    // Generate reports
    await this.generateReports(results);
    
    this.log(`✅ Security scan completed. Check ${this.outputDir} for detailed reports.`);
    
    return results;
  }
  
  /**
   * Scan for dependency vulnerabilities
   */
  async scanDependencies() {
    this.log('🔍 Scanning dependency vulnerabilities...');
    
    const result = {
      name: 'Dependency Vulnerabilities',
      status: 'passed',
      vulnerabilities: [],
      summary: {},
      error: null,
    };
    
    try {
      // Run pnpm audit
      const auditLevel = this.severityMapping[this.severityLevel];
      
      try {
        const auditOutput = execSync(`pnpm audit --audit-level ${auditLevel} --json`, {
          cwd: this.projectRoot,
          encoding: 'utf8',
        });
        
        const auditData = JSON.parse(auditOutput);
        
        if (auditData.vulnerabilities) {
          Object.entries(auditData.vulnerabilities).forEach(([name, vuln]) => {
            result.vulnerabilities.push({
              name,
              severity: vuln.severity,
              title: vuln.title,
              url: vuln.url,
              range: vuln.range,
            });
          });
        }
        
        result.summary = {
          total: result.vulnerabilities.length,
          critical: result.vulnerabilities.filter(v => v.severity === 'critical').length,
          high: result.vulnerabilities.filter(v => v.severity === 'high').length,
          moderate: result.vulnerabilities.filter(v => v.severity === 'moderate').length,
          low: result.vulnerabilities.filter(v => v.severity === 'low').length,
        };
        
        if (result.vulnerabilities.length > 0) {
          result.status = 'failed';
          this.log(`⚠️ Found ${result.vulnerabilities.length} dependency vulnerabilities`);
        } else {
          this.log('✅ No dependency vulnerabilities found');
        }
        
      } catch (auditError) {
        // Audit command returns non-zero exit code when vulnerabilities are found
        if (auditError.stdout) {
          try {
            const auditData = JSON.parse(auditError.stdout);
            // Process audit data similar to success case
            result.summary = auditData.metadata?.vulnerabilities || {};
            if (Object.values(result.summary).some(count => count > 0)) {
              result.status = 'failed';
            }
          } catch (parseError) {
            result.error = `Failed to parse audit output: ${parseError.message}`;
          }
        } else {
          result.error = auditError.message;
        }
      }
      
    } catch (error) {
      result.error = error.message;
      result.status = 'error';
    }
    
    return result;
  }
  
  /**
   * Scan for secrets in code
   */
  async scanSecrets() {
    this.log('🕵️ Scanning for hardcoded secrets...');
    
    const result = {
      name: 'Secret Detection',
      status: 'passed',
      secrets: [],
      patterns: [],
      error: null,
    };
    
    try {
      // Define secret patterns
      const secretPatterns = [
        {
          name: 'AWS Access Key',
          pattern: /AKIA[0-9A-Z]{16}/g,
          description: 'AWS Access Key ID'
        },
        {
          name: 'Stripe Live Key',
          pattern: /sk_live_[0-9a-zA-Z]{24}/g,
          description: 'Stripe Secret Live Key'
        },
        {
          name: 'Google API Key',
          pattern: /AIza[0-9A-Za-z\-_]{35}/g,
          description: 'Google API Key'
        },
        {
          name: 'GitHub Token',
          pattern: /gh[pousr]_[A-Za-z0-9_]{36}/g,
          description: 'GitHub Personal Access Token'
        },
        {
          name: 'Generic API Key',
          pattern: /[aA][pP][iI][_]?[kK][eE][yY].*['|\"][0-9a-zA-Z]{32,45}['|\"]/g,
          description: 'Generic API Key Pattern'
        },
        {
          name: 'Private Key',
          pattern: /-----BEGIN\s+.*\s+PRIVATE\s+KEY-----/g,
          description: 'Private Key Header'
        },
      ];
      
      // Scan files for secret patterns
      const filesToScan = await this.getSourceFiles();
      
      for (const filePath of filesToScan) {
        try {
          const content = await fs.readFile(filePath, 'utf8');
          
          for (const pattern of secretPatterns) {
            const matches = content.match(pattern.pattern);
            if (matches) {
              result.secrets.push({
                file: filePath,
                pattern: pattern.name,
                description: pattern.description,
                matches: matches.length,
              });
            }
          }
        } catch (fileError) {
          // Skip files that can't be read
          continue;
        }
      }
      
      if (result.secrets.length > 0) {
        result.status = 'failed';
        this.log(`⚠️ Found ${result.secrets.length} potential secrets`);
      } else {
        this.log('✅ No secrets detected');
      }
      
    } catch (error) {
      result.error = error.message;
      result.status = 'error';
    }
    
    return result;
  }
  
  /**
   * Run static code analysis
   */
  async runStaticAnalysis() {
    this.log('🛡️ Running static code analysis...');
    
    const result = {
      name: 'Static Code Analysis',
      status: 'passed',
      issues: [],
      categories: {},
      error: null,
    };
    
    try {
      // Check if ESLint security plugin is available
      const hasSecurityPlugin = await this.checkEslintSecurityPlugin();
      
      if (hasSecurityPlugin) {
        // Create temporary security-focused ESLint config
        const securityConfig = this.createSecurityEslintConfig();
        const configPath = path.join(this.outputDir, '.eslintrc.security.js');
        await fs.writeFile(configPath, securityConfig);
        
        try {
          const eslintOutput = execSync(`npx eslint . --config ${configPath} --format json`, {
            cwd: this.projectRoot,
            encoding: 'utf8',
          });
          
          const eslintResults = JSON.parse(eslintOutput);
          
          eslintResults.forEach(fileResult => {
            fileResult.messages.forEach(message => {
              if (message.ruleId && message.ruleId.startsWith('security/')) {
                result.issues.push({
                  file: fileResult.filePath,
                  line: message.line,
                  column: message.column,
                  rule: message.ruleId,
                  message: message.message,
                  severity: message.severity === 2 ? 'error' : 'warning',
                });
              }
            });
          });
          
        } catch (eslintError) {
          // ESLint returns non-zero when issues are found
          if (eslintError.stdout) {
            try {
              const eslintResults = JSON.parse(eslintError.stdout);
              // Process results similar to success case
            } catch (parseError) {
              result.error = `Failed to parse ESLint output: ${parseError.message}`;
            }
          }
        }
        
        // Clean up temporary config
        try {
          await fs.unlink(configPath);
        } catch (cleanupError) {
          // Ignore cleanup errors
        }
      } else {
        result.error = 'ESLint security plugin not available. Install with: npm install -D eslint-plugin-security';
      }
      
      // Categorize issues
      result.categories = {
        total: result.issues.length,
        errors: result.issues.filter(i => i.severity === 'error').length,
        warnings: result.issues.filter(i => i.severity === 'warning').length,
      };
      
      if (result.issues.length > 0) {
        result.status = 'failed';
        this.log(`⚠️ Found ${result.issues.length} static analysis issues`);
      } else {
        this.log('✅ No static analysis issues found');
      }
      
    } catch (error) {
      result.error = error.message;
      result.status = 'error';
    }
    
    return result;
  }
  
  /**
   * Check license compliance
   */
  async checkLicenses() {
    this.log('📄 Checking license compliance...');
    
    const result = {
      name: 'License Compliance',
      status: 'passed',
      licenses: {},
      problematic: [],
      error: null,
    };
    
    try {
      // Install license-checker if not available
      try {
        execSync('npm list -g license-checker', { stdio: 'pipe' });
      } catch (installError) {
        this.log('Installing license-checker...');
        execSync('npm install -g license-checker', { stdio: 'pipe' });
      }
      
      // Generate license report
      const licenseOutput = execSync('license-checker --json', {
        cwd: this.projectRoot,
        encoding: 'utf8',
      });
      
      const licenseData = JSON.parse(licenseOutput);
      
      // Define problematic licenses
      const problematicLicenses = [
        'GPL-2.0',
        'GPL-3.0',
        'AGPL-1.0',
        'AGPL-3.0',
        'CPAL-1.0',
        'EUPL-1.1',
        'OSL-3.0',
        'CPOL-1.02',
      ];
      
      // Process license data
      Object.entries(licenseData).forEach(([packageName, packageInfo]) => {
        const licenses = packageInfo.licenses;
        const licenseArray = Array.isArray(licenses) ? licenses : [licenses];
        
        licenseArray.forEach(license => {
          if (!result.licenses[license]) {
            result.licenses[license] = [];
          }
          result.licenses[license].push(packageName);
          
          if (problematicLicenses.includes(license)) {
            result.problematic.push({
              package: packageName,
              license: license,
              reason: 'Potentially incompatible license',
            });
          }
        });
      });
      
      if (result.problematic.length > 0) {
        result.status = 'warning';
        this.log(`⚠️ Found ${result.problematic.length} potentially problematic licenses`);
      } else {
        this.log('✅ All licenses are compliant');
      }
      
    } catch (error) {
      result.error = error.message;
      result.status = 'error';
    }
    
    return result;
  }
  
  /**
   * Calculate overall summary
   */
  calculateSummary(results) {
    const scans = Object.values(results.scans);
    
    results.summary.passed = scans.every(scan => scan.status === 'passed');
    results.summary.totalScans = scans.length;
    results.summary.failedScans = scans.filter(scan => scan.status === 'failed').length;
    results.summary.errorScans = scans.filter(scan => scan.status === 'error').length;
    
    // Aggregate issue counts from different scans
    scans.forEach(scan => {
      if (scan.vulnerabilities) {
        results.summary.totalIssues += scan.vulnerabilities.length;
        results.summary.criticalIssues += scan.vulnerabilities.filter(v => v.severity === 'critical').length;
        results.summary.highIssues += scan.vulnerabilities.filter(v => v.severity === 'high').length;
      }
      
      if (scan.secrets) {
        results.summary.totalIssues += scan.secrets.length;
        results.summary.criticalIssues += scan.secrets.length; // Treat secrets as critical
      }
      
      if (scan.issues) {
        results.summary.totalIssues += scan.issues.length;
        results.summary.highIssues += scan.issues.filter(i => i.severity === 'error').length;
        results.summary.mediumIssues += scan.issues.filter(i => i.severity === 'warning').length;
      }
    });
  }
  
  /**
   * Generate security reports
   */
  async generateReports(results) {
    this.log('📄 Generating security reports...');
    
    // JSON report
    const jsonPath = path.join(this.outputDir, 'security-report.json');
    await fs.writeFile(jsonPath, JSON.stringify(results, null, 2));
    
    // HTML report
    const htmlPath = path.join(this.outputDir, 'security-report.html');
    const htmlContent = this.generateHtmlReport(results);
    await fs.writeFile(htmlPath, htmlContent);
    
    // Console summary
    this.printSummary(results);
    
    this.log(`📋 Reports generated:`);
    this.log(`  JSON: ${jsonPath}`);
    this.log(`  HTML: ${htmlPath}`);
  }
  
  /**
   * Generate HTML report
   */
  generateHtmlReport(results) {
    const statusIcon = results.summary.passed ? '✅' : '❌';
    const statusText = results.summary.passed ? 'PASSED' : 'ISSUES DETECTED';
    
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>TW-Enigma Security Report</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 20px; line-height: 1.6; }
        .header { background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
        .status-pass { color: #28a745; }
        .status-fail { color: #dc3545; }
        .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 30px; }
        .card { background: #f8f9fa; padding: 15px; border-radius: 6px; border-left: 4px solid #007bff; }
        .scan-result { margin-bottom: 30px; padding: 20px; border: 1px solid #e1e5e9; border-radius: 6px; }
        .scan-passed { border-left: 4px solid #28a745; }
        .scan-failed { border-left: 4px solid #dc3545; }
        .scan-error { border-left: 4px solid #ffc107; }
        table { width: 100%; border-collapse: collapse; margin-top: 15px; }
        th, td { padding: 8px; text-align: left; border-bottom: 1px solid #ddd; }
        th { background-color: #f2f2f2; }
        .timestamp { color: #6c757d; font-size: 0.9em; }
    </style>
</head>
<body>
    <div class="header">
        <h1>🔒 TW-Enigma Security Report</h1>
        <p><strong>Status:</strong> <span class="${results.summary.passed ? 'status-pass' : 'status-fail'}">${statusIcon} ${statusText}</span></p>
        <p class="timestamp">Generated: ${results.timestamp}</p>
    </div>
    
    <div class="summary">
        <div class="card">
            <h3>Total Issues</h3>
            <p style="font-size: 2em; margin: 0;">${results.summary.totalIssues}</p>
        </div>
        <div class="card">
            <h3>Critical</h3>
            <p style="font-size: 2em; margin: 0; color: #dc3545;">${results.summary.criticalIssues}</p>
        </div>
        <div class="card">
            <h3>High</h3>
            <p style="font-size: 2em; margin: 0; color: #fd7e14;">${results.summary.highIssues}</p>
        </div>
        <div class="card">
            <h3>Failed Scans</h3>
            <p style="font-size: 2em; margin: 0;">${results.summary.failedScans}</p>
        </div>
    </div>
    
    ${Object.entries(results.scans).map(([scanType, scan]) => `
        <div class="scan-result scan-${scan.status}">
            <h2>${scan.name}</h2>
            <p><strong>Status:</strong> ${scan.status.toUpperCase()}</p>
            
            ${scan.error ? `<p style="color: #dc3545;"><strong>Error:</strong> ${scan.error}</p>` : ''}
            
            ${scan.vulnerabilities && scan.vulnerabilities.length > 0 ? `
                <h3>Vulnerabilities (${scan.vulnerabilities.length})</h3>
                <table>
                    <tr><th>Package</th><th>Severity</th><th>Title</th></tr>
                    ${scan.vulnerabilities.map(vuln => `
                        <tr>
                            <td>${vuln.name}</td>
                            <td style="color: ${vuln.severity === 'critical' ? '#dc3545' : vuln.severity === 'high' ? '#fd7e14' : '#6c757d'}">${vuln.severity}</td>
                            <td>${vuln.title}</td>
                        </tr>
                    `).join('')}
                </table>
            ` : ''}
            
            ${scan.secrets && scan.secrets.length > 0 ? `
                <h3>Potential Secrets (${scan.secrets.length})</h3>
                <table>
                    <tr><th>File</th><th>Pattern</th><th>Matches</th></tr>
                    ${scan.secrets.map(secret => `
                        <tr>
                            <td>${secret.file}</td>
                            <td>${secret.pattern}</td>
                            <td>${secret.matches}</td>
                        </tr>
                    `).join('')}
                </table>
            ` : ''}
        </div>
    `).join('')}
    
</body>
</html>`;
  }
  
  /**
   * Print console summary
   */
  printSummary(results) {
    console.log('\n' + '='.repeat(60));
    console.log('  🔒 SECURITY SCAN SUMMARY');
    console.log('='.repeat(60));
    
    const statusIcon = results.summary.passed ? '✅' : '❌';
    const statusText = results.summary.passed ? 'PASSED' : 'ISSUES DETECTED';
    
    console.log(`\n  Overall Status: ${statusIcon} ${statusText}`);
    console.log(`  Total Issues: ${results.summary.totalIssues}`);
    console.log(`  Critical: ${results.summary.criticalIssues}`);
    console.log(`  High: ${results.summary.highIssues}`);
    console.log(`  Failed Scans: ${results.summary.failedScans}/${results.summary.totalScans}`);
    
    console.log('\n  Scan Results:');
    Object.entries(results.scans).forEach(([scanType, scan]) => {
      const statusEmoji = scan.status === 'passed' ? '✅' : scan.status === 'failed' ? '❌' : '⚠️';
      console.log(`    ${statusEmoji} ${scan.name}: ${scan.status.toUpperCase()}`);
    });
    
    console.log('\n' + '='.repeat(60));
  }
  
  /**
   * Helper methods
   */
  async ensureOutputDirectory() {
    try {
      await fs.mkdir(this.outputDir, { recursive: true });
    } catch (error) {
      // Directory already exists or other error
    }
  }
  
  async getSourceFiles() {
    const files = [];
    const extensions = ['.js', '.ts', '.jsx', '.tsx', '.json', '.md'];
    const excludePatterns = ['node_modules', 'dist', 'build', '.git', 'coverage'];
    
    async function scanDirectory(dir) {
      try {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          
          if (entry.isDirectory()) {
            if (!excludePatterns.some(pattern => entry.name.includes(pattern))) {
              await scanDirectory(fullPath);
            }
          } else if (entry.isFile()) {
            if (extensions.some(ext => entry.name.endsWith(ext))) {
              files.push(fullPath);
            }
          }
        }
      } catch (error) {
        // Skip directories we can't read
      }
    }
    
    await scanDirectory(this.projectRoot);
    return files;
  }
  
  async checkEslintSecurityPlugin() {
    try {
      execSync('npm list eslint-plugin-security', { 
        cwd: this.projectRoot,
        stdio: 'pipe' 
      });
      return true;
    } catch (error) {
      return false;
    }
  }
  
  createSecurityEslintConfig() {
    return `module.exports = {
  extends: ['plugin:security/recommended'],
  plugins: ['security'],
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module'
  },
  env: {
    node: true,
    es2022: true
  },
  rules: {
    'security/detect-unsafe-regex': 'error',
    'security/detect-buffer-noassert': 'error',
    'security/detect-child-process': 'error',
    'security/detect-disable-mustache-escape': 'error',
    'security/detect-eval-with-expression': 'error',
    'security/detect-no-csrf-before-method-override': 'error',
    'security/detect-non-literal-fs-filename': 'error',
    'security/detect-non-literal-regexp': 'error',
    'security/detect-non-literal-require': 'error',
    'security/detect-object-injection': 'error',
    'security/detect-possible-timing-attacks': 'error',
    'security/detect-pseudoRandomBytes': 'error',
    'security/detect-bidi-characters': 'error'
  }
};`;
  }
  
  log(message) {
    if (this.verbose) {
      console.log(message);
    }
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'all';
  
  const options = {
    verbose: args.includes('--verbose') || args.includes('-v'),
    severityLevel: getArgValue(args, '--severity') || 'medium',
    outputDir: getArgValue(args, '--output') || './security-reports',
    skipCategories: getArgValue(args, '--skip')?.split(',') || [],
  };
  
  const checker = new SecurityChecker(options);
  
  try {
    switch (command) {
      case 'all':
      case 'scan':
        const results = await checker.runAllChecks();
        process.exit(results.summary.passed ? 0 : 1);
        break;
        
      case 'dependencies':
        options.skipCategories = ['secrets', 'sast', 'licenses'];
        const depResults = await checker.runAllChecks();
        process.exit(depResults.summary.passed ? 0 : 1);
        break;
        
      case 'secrets':
        options.skipCategories = ['dependencies', 'sast', 'licenses'];
        const secretResults = await checker.runAllChecks();
        process.exit(secretResults.summary.passed ? 0 : 1);
        break;
        
      case 'help':
      default:
        console.log(`
TW-Enigma Security Checker

Usage: node security-check.js [command] [options]

Commands:
  all, scan       Run all security checks (default)
  dependencies    Run dependency vulnerability scan only
  secrets         Run secret detection only
  help            Show this help

Options:
  --verbose, -v          Enable verbose logging
  --severity <level>     Set severity level (low|medium|high|critical)
  --output <dir>         Output directory for reports
  --skip <categories>    Skip categories (comma-separated)

Examples:
  node security-check.js
  node security-check.js --verbose --severity high
  node security-check.js dependencies --output ./reports
  node security-check.js --skip secrets,licenses
        `);
        break;
    }
  } catch (error) {
    console.error(`❌ Security check failed: ${error.message}`);
    process.exit(1);
  }
}

function getArgValue(args, flag) {
  const index = args.indexOf(flag);
  return index !== -1 && index + 1 < args.length ? args[index + 1] : null;
}

// Export for use as module
module.exports = { SecurityChecker };

// Run CLI if executed directly
if (require.main === module) {
  main().catch(error => {
    console.error('❌ Security checker failed:', error.message);
    process.exit(1);
  });
}