#!/usr/bin/env node

/**
 * Version Manager for TW-Enigma
 * 
 * Automates version management including semantic versioning,
 * changelog generation, and release preparation for CI/CD pipelines.
 */

const fs = require('fs').promises;
const path = require('path');
const { execSync } = require('child_process');

class VersionManager {
  constructor(options = {}) {
    this.projectRoot = options.projectRoot || process.cwd();
    this.dryRun = options.dryRun || false;
    this.verbose = options.verbose || false;
    
    this.packages = [
      'packages/core',
      'packages/cli',
    ];
    
    this.config = {
      changelogPath: 'CHANGELOG.md',
      releaseBranch: 'main',
      tagPrefix: 'v',
      conventionalCommits: true,
    };
  }
  
  /**
   * Get current version from package.json
   */
  async getCurrentVersion() {
    const packagePath = path.join(this.projectRoot, 'package.json');
    const content = await fs.readFile(packagePath, 'utf8');
    const pkg = JSON.parse(content);
    return pkg.version;
  }
  
  /**
   * Update version in all package.json files
   */
  async updateVersions(newVersion) {
    this.log(`Updating version to ${newVersion}`);
    
    // Update root package.json
    await this.updatePackageVersion('.', newVersion);
    
    // Update workspace packages
    for (const packagePath of this.packages) {
      await this.updatePackageVersion(packagePath, newVersion);
    }
    
    this.log(`✅ Updated version to ${newVersion} in all packages`);
  }
  
  /**
   * Update version in a single package.json
   */
  async updatePackageVersion(packagePath, newVersion) {
    const fullPath = path.join(this.projectRoot, packagePath, 'package.json');
    
    try {
      const content = await fs.readFile(fullPath, 'utf8');
      const pkg = JSON.parse(content);
      
      const oldVersion = pkg.version;
      pkg.version = newVersion;
      
      if (!this.dryRun) {
        await fs.writeFile(fullPath, JSON.stringify(pkg, null, 2) + '\n');
      }
      
      this.log(`  ${packagePath}: ${oldVersion} → ${newVersion}`);
    } catch (error) {
      throw new Error(`Failed to update version in ${packagePath}: ${error.message}`);
    }
  }
  
  /**
   * Calculate next version based on type
   */
  calculateNextVersion(currentVersion, releaseType) {
    const parts = currentVersion.split('.').map(Number);
    
    switch (releaseType) {
      case 'major':
        return `${parts[0] + 1}.0.0`;
      case 'minor':
        return `${parts[0]}.${parts[1] + 1}.0`;
      case 'patch':
        return `${parts[0]}.${parts[1]}.${parts[2] + 1}`;
      case 'prerelease':
        const preNumber = currentVersion.includes('-') 
          ? parseInt(currentVersion.split('-')[1].split('.')[1] || '0') + 1 
          : 0;
        return `${parts[0]}.${parts[1]}.${parts[2]}-alpha.${preNumber}`;
      default:
        throw new Error(`Invalid release type: ${releaseType}`);
    }
  }
  
  /**
   * Generate changelog from git commits
   */
  async generateChangelog(fromTag, toRef = 'HEAD') {
    this.log('Generating changelog...');
    
    const commits = await this.getCommitsSince(fromTag, toRef);
    const categorizedCommits = this.categorizeCommits(commits);
    
    return this.formatChangelog(categorizedCommits);
  }
  
  /**
   * Get commits since a specific tag
   */
  async getCommitsSince(fromTag, toRef) {
    try {
      const format = '--pretty=format:%H|%s|%b|%an|%ae|%ad';
      const command = fromTag 
        ? `git log ${fromTag}..${toRef} ${format} --no-merges`
        : `git log ${toRef} ${format} --no-merges -20`; // Last 20 commits if no tag
      
      const output = execSync(command, { 
        cwd: this.projectRoot,
        encoding: 'utf8' 
      });
      
      return output.trim().split('\n').filter(Boolean).map(line => {
        const [hash, subject, body, author, email, date] = line.split('|');
        return {
          hash: hash.substring(0, 7),
          subject,
          body,
          author,
          email,
          date,
          type: this.parseCommitType(subject),
        };
      });
    } catch (error) {
      this.log(`Warning: Could not get commits since ${fromTag}: ${error.message}`);
      return [];
    }
  }
  
  /**
   * Parse commit type from conventional commit format
   */
  parseCommitType(subject) {
    const match = subject.match(/^(\w+)(\(.+\))?\s*:\s*(.+)$/);
    if (match) {
      return {
        type: match[1],
        scope: match[2]?.replace(/[()]/g, ''),
        description: match[3],
      };
    }
    
    // Fallback for non-conventional commits
    return {
      type: 'other',
      description: subject,
    };
  }
  
  /**
   * Categorize commits by type
   */
  categorizeCommits(commits) {
    const categories = {
      breaking: [],
      feat: [],
      fix: [],
      perf: [],
      refactor: [],
      docs: [],
      test: [],
      chore: [],
      other: [],
    };
    
    commits.forEach(commit => {
      const type = commit.type.type;
      
      // Check for breaking changes
      if (commit.body.includes('BREAKING CHANGE') || commit.subject.includes('!')) {
        categories.breaking.push(commit);
      } else if (categories[type]) {
        categories[type].push(commit);
      } else {
        categories.other.push(commit);
      }
    });
    
    return categories;
  }
  
  /**
   * Format changelog markdown
   */
  formatChangelog(categorizedCommits) {
    const sections = [
      { key: 'breaking', title: '💥 Breaking Changes', emoji: '💥' },
      { key: 'feat', title: '✨ Features', emoji: '✨' },
      { key: 'fix', title: '🐛 Bug Fixes', emoji: '🐛' },
      { key: 'perf', title: '⚡ Performance', emoji: '⚡' },
      { key: 'refactor', title: '♻️ Refactoring', emoji: '♻️' },
      { key: 'docs', title: '📚 Documentation', emoji: '📚' },
      { key: 'test', title: '🧪 Tests', emoji: '🧪' },
      { key: 'chore', title: '🔧 Chores', emoji: '🔧' },
      { key: 'other', title: '📦 Other', emoji: '📦' },
    ];
    
    let changelog = '';
    
    sections.forEach(section => {
      const commits = categorizedCommits[section.key];
      if (commits.length > 0) {
        changelog += `### ${section.title}\n\n`;
        
        commits.forEach(commit => {
          const scope = commit.type.scope ? `**${commit.type.scope}**: ` : '';
          const description = commit.type.description;
          changelog += `- ${scope}${description} ([${commit.hash}])\n`;
        });
        
        changelog += '\n';
      }
    });
    
    return changelog || '- No notable changes\n\n';
  }
  
  /**
   * Update CHANGELOG.md with new version
   */
  async updateChangelog(version, changelog) {
    const changelogPath = path.join(this.projectRoot, this.config.changelogPath);
    
    const header = `# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

`;
    
    const newEntry = `## [${version}] - ${new Date().toISOString().split('T')[0]}

${changelog}`;
    
    try {
      let existingContent = '';
      try {
        existingContent = await fs.readFile(changelogPath, 'utf8');
      } catch (error) {
        // File doesn't exist, start with header
        existingContent = header;
      }
      
      // Insert new entry after header
      const lines = existingContent.split('\n');
      const headerLines = lines.slice(0, 6); // Keep header
      const bodyLines = lines.slice(6);
      
      const updatedContent = [
        ...headerLines,
        newEntry,
        ...bodyLines,
      ].join('\n');
      
      if (!this.dryRun) {
        await fs.writeFile(changelogPath, updatedContent);
      }
      
      this.log(`✅ Updated ${this.config.changelogPath}`);
    } catch (error) {
      throw new Error(`Failed to update changelog: ${error.message}`);
    }
  }
  
  /**
   * Create git tag for version
   */
  async createTag(version) {
    const tagName = `${this.config.tagPrefix}${version}`;
    
    try {
      if (!this.dryRun) {
        execSync(`git tag -a ${tagName} -m "Release ${version}"`, {
          cwd: this.projectRoot,
          stdio: 'pipe',
        });
      }
      
      this.log(`✅ Created tag: ${tagName}`);
      return tagName;
    } catch (error) {
      throw new Error(`Failed to create tag: ${error.message}`);
    }
  }
  
  /**
   * Commit version changes
   */
  async commitChanges(version) {
    try {
      if (!this.dryRun) {
        execSync('git add .', { cwd: this.projectRoot });
        execSync(`git commit -m "chore: release v${version}"`, {
          cwd: this.projectRoot,
          stdio: 'pipe',
        });
      }
      
      this.log(`✅ Committed version changes for v${version}`);
    } catch (error) {
      throw new Error(`Failed to commit changes: ${error.message}`);
    }
  }
  
  /**
   * Get latest git tag
   */
  async getLatestTag() {
    try {
      const output = execSync('git describe --tags --abbrev=0', {
        cwd: this.projectRoot,
        encoding: 'utf8',
      });
      return output.trim();
    } catch (error) {
      // No tags found
      return null;
    }
  }
  
  /**
   * Check if working directory is clean
   */
  async isWorkingDirectoryClean() {
    try {
      const output = execSync('git status --porcelain', {
        cwd: this.projectRoot,
        encoding: 'utf8',
      });
      return output.trim() === '';
    } catch (error) {
      return false;
    }
  }
  
  /**
   * Full release process
   */
  async release(releaseType) {
    this.log(`🚀 Starting ${releaseType} release process...`);
    
    // Validate preconditions
    if (!await this.isWorkingDirectoryClean()) {
      throw new Error('Working directory is not clean. Please commit or stash changes.');
    }
    
    // Get current version
    const currentVersion = await this.getCurrentVersion();
    this.log(`Current version: ${currentVersion}`);
    
    // Calculate new version
    const newVersion = this.calculateNextVersion(currentVersion, releaseType);
    this.log(`New version: ${newVersion}`);
    
    // Generate changelog
    const latestTag = await this.getLatestTag();
    const changelog = await this.generateChangelog(latestTag);
    
    if (this.dryRun) {
      this.log('\n🔍 DRY RUN - No changes will be made\n');
      this.log('Changelog preview:');
      this.log(changelog);
      return {
        currentVersion,
        newVersion,
        changelog,
        dryRun: true,
      };
    }
    
    // Update versions
    await this.updateVersions(newVersion);
    
    // Update changelog
    await this.updateChangelog(newVersion, changelog);
    
    // Commit changes
    await this.commitChanges(newVersion);
    
    // Create tag
    const tagName = await this.createTag(newVersion);
    
    this.log(`🎉 Release v${newVersion} completed successfully!`);
    
    return {
      currentVersion,
      newVersion,
      changelog,
      tagName,
      dryRun: false,
    };
  }
  
  /**
   * Logging utility
   */
  log(message) {
    if (this.verbose || this.dryRun) {
      console.log(message);
    }
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  
  const options = {
    dryRun: args.includes('--dry-run'),
    verbose: args.includes('--verbose'),
  };
  
  const versionManager = new VersionManager(options);
  
  try {
    switch (command) {
      case 'current':
        const currentVersion = await versionManager.getCurrentVersion();
        console.log(currentVersion);
        break;
        
      case 'release':
        const releaseType = args[1] || 'patch';
        if (!['major', 'minor', 'patch', 'prerelease'].includes(releaseType)) {
          throw new Error('Invalid release type. Use: major, minor, patch, or prerelease');
        }
        await versionManager.release(releaseType);
        break;
        
      case 'changelog':
        const latestTag = await versionManager.getLatestTag();
        const changelog = await versionManager.generateChangelog(latestTag);
        console.log(changelog);
        break;
        
      case 'help':
      default:
        console.log(`
TW-Enigma Version Manager

Usage: node version-manager.js <command> [options]

Commands:
  current           Show current version
  release <type>    Create a new release (major|minor|patch|prerelease)
  changelog         Generate changelog from git commits
  help              Show this help

Options:
  --dry-run         Show what would be done without making changes
  --verbose         Enable verbose logging

Examples:
  node version-manager.js current
  node version-manager.js release patch --dry-run
  node version-manager.js release minor
  node version-manager.js changelog
        `);
        break;
    }
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
    process.exit(1);
  }
}

// Export for use as module
module.exports = { VersionManager };

// Run CLI if executed directly
if (require.main === module) {
  main().catch(error => {
    console.error('❌ Version manager failed:', error.message);
    process.exit(1);
  });
}