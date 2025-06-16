# Security Guide

Comprehensive security guide for the tw-enigma monorepo CI/CD pipeline and package management.

## 📋 Table of Contents

- [Overview](#overview)
- [Secrets Management](#secrets-management)
- [Package Security](#package-security)
- [CI/CD Security](#cicd-security)
- [Vulnerability Management](#vulnerability-management)
- [Access Control](#access-control)
- [Security Monitoring](#security-monitoring)
- [Incident Response](#incident-response)
- [Best Practices](#best-practices)

## 🔒 Overview

Our security strategy encompasses:

- **Secrets Management**: Secure handling of API keys and tokens
- **Package Security**: Dependency scanning and vulnerability management
- **CI/CD Security**: Secure pipeline configuration and access controls
- **Access Control**: Repository and package access management
- **Monitoring**: Continuous security monitoring and alerting
- **Compliance**: Following security best practices and standards

### Security Principles

1. **Principle of Least Privilege**: Minimal required permissions
2. **Defense in Depth**: Multiple security layers
3. **Zero Trust**: Verify everything, trust nothing
4. **Fail Secure**: Secure defaults and safe failure modes
5. **Transparency**: Auditable security practices

## 🔐 Secrets Management

### GitHub Repository Secrets

Configure in GitHub repository settings → Secrets and variables → Actions:

#### Required Secrets
```bash
NPM_TOKEN          # npm registry authentication
  ├── Type: Repository secret
  ├── Scope: Actions
  ├── Purpose: Publishing packages to npm
  ├── Format: npm_XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
  └── Permissions: Publish @tw-enigma scope

GITHUB_TOKEN       # GitHub API access
  ├── Type: Automatically provided
  ├── Scope: Actions
  ├── Purpose: Repository access, releases
  ├── Permissions: Repository read/write
  └── Auto-generated: Per workflow run
```

#### Optional Secrets
```bash
TURBO_TOKEN        # Turborepo remote caching
  ├── Type: Repository secret
  ├── Scope: Actions (optional)
  ├── Purpose: Remote build caching
  ├── Format: turbo_XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
  └── Provider: Vercel Turborepo

CODECOV_TOKEN      # Code coverage reporting
  ├── Type: Repository secret
  ├── Scope: Actions (optional)
  ├── Purpose: Coverage uploads
  ├── Format: codecov_XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
  └── Provider: Codecov
```

### Secret Security Best Practices

#### Token Management
1. **Rotation Policy**:
   - Rotate NPM_TOKEN quarterly
   - Rotate TURBO_TOKEN annually
   - Emergency rotation for suspected compromise

2. **Scope Limitation**:
   ```bash
   # NPM token with limited scope
   npm token create --read-only --cidr=0.0.0.0/0
   npm token create --publish --cidr=0.0.0.0/0
   ```

3. **Audit Trail**:
   - Log all secret usage in CI/CD
   - Monitor secret access patterns
   - Alert on unusual access

#### Secret Validation
```yaml
- name: Validate secrets
  run: |
    if [ -z "$NPM_TOKEN" ]; then
      echo "Error: NPM_TOKEN not set"
      exit 1
    fi
    
    # Validate token format
    if [[ ! "$NPM_TOKEN" =~ ^npm_[A-Za-z0-9]{36}$ ]]; then
      echo "Error: Invalid NPM_TOKEN format"
      exit 1
    fi
```

### Environment Variables

#### Public Variables
```bash
TURBO_TEAM         # Turborepo team name (public)
PNPM_CACHE_FOLDER  # Cache directory (.pnpm)
HUSKY              # Git hooks (disabled in CI: 0)
NODE_ENV           # Environment (production/development)
```

#### Security Environment Variables
```bash
CI                 # CI environment flag (true)
GITHUB_ACTIONS     # GitHub Actions flag (true)
RUNNER_OS          # Operating system (Linux/macOS/Windows)
RUNNER_ARCH        # Architecture (X64/ARM64)
```

## 📦 Package Security

### npm Package Security

#### Package Configuration
```json
{
  "publishConfig": {
    "access": "public",
    "registry": "https://registry.npmjs.org/"
  },
  "files": [
    "dist",
    "README.md",
    "LICENSE",
    "CHANGELOG.md"
  ]
}
```

#### Version Security
```bash
# Check if version already exists
npm view @tw-enigma/core versions --json

# Verify package integrity
npm pack --dry-run
npm audit signatures
```

#### Scope Protection
- **@tw-enigma scope**: Configured with proper ownership
- **Two-factor authentication**: Required for publishing
- **Team access**: Limited to maintainers only

### Dependency Security

#### Automated Scanning
```yaml
- name: Security audit
  run: |
    # High-level vulnerabilities check
    pnpm audit --audit-level=high
    
    # Detailed audit report
    pnpm audit --json > audit-report.json
    
    # Check for security advisories
    npm audit --audit-level=moderate
```

#### License Compliance
```yaml
- name: License check
  run: |
    # Check production dependencies
    pnpm licenses list --prod --json
    
    # Verify allowed licenses
    node scripts/check-licenses.js
```

#### Dependency Validation
```bash
# Verify package integrity
pnpm install --frozen-lockfile

# Check for dependency confusion
pnpm list --depth=0 | grep -E "^((?!@tw-enigma).)*$"

# Validate package checksums
pnpm install --verify-store-integrity
```

## 🔧 CI/CD Security

### Workflow Security

#### Permission Configuration
```yaml
permissions:
  contents: read          # Repository content access
  packages: write         # Package publishing
  actions: read           # Action execution
  security-events: write  # Security scanning results
  pull-requests: write    # PR management
```

#### Job Isolation
```yaml
runs-on: ubuntu-latest    # Secure runner environment
container:               # Optional containerization
  image: node:18-alpine
  options: --read-only    # Read-only filesystem
```

#### Input Validation
```yaml
- name: Validate inputs
  run: |
    # Validate version format
    if [[ ! "${{ github.event.inputs.version }}" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
      echo "Invalid version format"
      exit 1
    fi
```

### Artifact Security

#### Build Artifacts
```yaml
- name: Upload artifacts
  uses: actions/upload-artifact@v4
  with:
    name: build-artifacts
    path: packages/*/dist/
    retention-days: 7      # Limited retention
    if-no-files-found: error
```

#### Release Assets
```yaml
- name: Create release
  uses: actions/create-release@v1
  with:
    tag_name: ${{ github.ref }}
    release_name: Release ${{ github.ref }}
    draft: false
    prerelease: false
```

### Supply Chain Security

#### Dependency Pinning
```yaml
# Pin action versions to specific commits
- uses: actions/checkout@8e5e7e5ab8b370d6c329ec480221332ada57f0ab # v3.5.2
- uses: actions/setup-node@64ed1c7eab4cce3362f8c340dee64e5eaeef8f7c # v3.6.0
```

#### Provenance Generation
```yaml
- name: Generate provenance
  uses: actions/attest-build-provenance@v1
  with:
    subject-path: packages/*/dist/*.tgz
```

## 🚨 Vulnerability Management

### Vulnerability Scanning

#### Automated Scans
```yaml
- name: CodeQL Analysis
  uses: github/codeql-action/analyze@v2
  with:
    languages: typescript, javascript
    
- name: Dependency Review
  uses: actions/dependency-review-action@v3
  with:
    fail-on-severity: high
```

#### Custom Security Checks
```bash
# Check for hardcoded secrets
git log --all --full-history -- "*" | grep -iE "(password|secret|key|token)" || true

# Scan for sensitive files
find . -name "*.key" -o -name "*.pem" -o -name "*.p12" || true

# Check for debug code
grep -r "console.log\|debugger\|TODO\|FIXME" packages/ || true
```

### Vulnerability Response

#### Severity Levels
- **Critical**: Immediate action required (< 4 hours)
- **High**: Action required within 24 hours
- **Medium**: Action required within 1 week
- **Low**: Action required within 1 month

#### Response Process
1. **Detection**: Automated scanning or manual report
2. **Assessment**: Evaluate impact and exploitability
3. **Triage**: Assign severity and priority
4. **Remediation**: Patch, update, or mitigate
5. **Verification**: Test fix and confirm resolution
6. **Communication**: Notify stakeholders

### Security Advisories

#### Creating Advisories
```bash
# GitHub Security Advisory
gh api \
  --method POST \
  -H "Accept: application/vnd.github+json" \
  /repos/OWNER/REPO/security-advisories \
  -f summary="Security vulnerability in @tw-enigma/core" \
  -f description="Description of vulnerability"
```

#### npm Advisory
```bash
# Report to npm
npm audit report <advisory-id>

# Check advisory status
npm audit --audit-level=moderate
```

## 👥 Access Control

### Repository Access

#### Team Structure
```
Maintainers (Admin)
├── Core team members
├── Full repository access
└── All permissions

Contributors (Write)
├── External contributors
├── PR and issue access
└── Limited permissions

Reviewers (Triage)
├── Code reviewers
├── Issue management
└── No merge permissions
```

#### Branch Protection
```yaml
# main branch protection rules
required_status_checks:
  strict: true
  contexts:
    - "ci/build"
    - "ci/test"
    - "ci/security"
    
enforce_admins: true
required_pull_request_reviews:
  required_approving_review_count: 2
  dismiss_stale_reviews: true
  require_code_owner_reviews: true
```

### Package Access

#### npm Access Control
```bash
# Check package access
npm access list packages @tw-enigma/core

# Grant access
npm access grant read-write @tw-enigma:developers @tw-enigma/core

# Revoke access
npm access revoke @tw-enigma:developers @tw-enigma/core
```

#### Two-Factor Authentication
- **Required for**: All maintainers and publishers
- **Enforcement**: npm organization settings
- **Backup codes**: Securely stored and accessible

## 📊 Security Monitoring

### Monitoring Setup

#### GitHub Security Features
```yaml
# Enable security features
security:
  dependabot:
    enabled: true
    alerts: true
    security_updates: true
    
  secret_scanning:
    enabled: true
    push_protection: true
    
  code_scanning:
    enabled: true
    default_setup: true
```

#### Custom Monitoring
```bash
# Daily security checks
#!/bin/bash
echo "Running daily security checks..."

# Check for new vulnerabilities
pnpm audit --audit-level=moderate

# Verify package integrity
pnpm install --verify-store-integrity

# Check for unauthorized changes
git log --since="24 hours ago" --oneline
```

### Alerting

#### Alert Configuration
```yaml
# Security alert channels
alerts:
  email:
    - security@tw-enigma.com
    - maintainers@tw-enigma.com
    
  slack:
    webhook: ${{ secrets.SLACK_SECURITY_WEBHOOK }}
    channel: "#security"
    
  github:
    issues: true
    discussions: false
```

#### Alert Criteria
- New high/critical vulnerabilities
- Failed security scans
- Unauthorized access attempts
- Unusual package download patterns
- Secret scanning alerts

## 🚨 Incident Response

### Incident Classification

#### Security Incidents
- **P0**: Active exploit or data breach
- **P1**: Critical vulnerability with public exploit
- **P2**: High vulnerability without public exploit
- **P3**: Medium/low vulnerabilities

### Response Procedures

#### Immediate Response (P0/P1)
1. **Contain**: Disable affected systems/tokens
2. **Assess**: Determine scope and impact
3. **Communicate**: Notify stakeholders
4. **Investigate**: Root cause analysis
5. **Remediate**: Apply fixes and patches
6. **Monitor**: Enhanced monitoring post-incident

#### Example Response Script
```bash
#!/bin/bash
# Emergency security response

echo "SECURITY INCIDENT RESPONSE ACTIVATED"

# 1. Rotate compromised tokens
echo "Rotating NPM token..."
# Manual step: Generate new NPM token

# 2. Revoke GitHub token
echo "Revoking GitHub tokens..."
gh auth logout

# 3. Check for unauthorized changes
echo "Checking for unauthorized changes..."
git log --since="7 days ago" --author=".*" --oneline

# 4. Audit package downloads
echo "Checking package download logs..."
npm view @tw-enigma/core --json | jq '.time'

# 5. Lock down access
echo "Implementing access restrictions..."
# Manual step: Enable branch protection
```

### Communication Plan

#### Internal Communication
- Security team notification (immediate)
- Engineering team notification (< 1 hour)
- Management notification (< 4 hours)
- Board notification (if required)

#### External Communication
- User notification (if user data affected)
- Security advisory publication
- CVE filing (if applicable)
- npm security team notification

## ✅ Best Practices

### Development Security

#### Secure Coding
```typescript
// Input validation
function validateInput(input: string): string {
  if (typeof input !== 'string') {
    throw new Error('Invalid input type');
  }
  
  // Sanitize input
  return input.replace(/[<>'"]/g, '');
}

// Secure file operations
import { join, resolve } from 'path';

function readUserFile(filename: string): string {
  // Prevent directory traversal
  const safePath = resolve(join(process.cwd(), filename));
  if (!safePath.startsWith(process.cwd())) {
    throw new Error('Invalid file path');
  }
  
  return fs.readFileSync(safePath, 'utf8');
}
```

#### Secret Handling
```typescript
// Environment variable validation
function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Required environment variable ${name} not set`);
  }
  return value;
}

// Secure logging
function logSafely(message: string, data?: any) {
  // Mask sensitive data
  const maskedData = data ? JSON.stringify(data).replace(
    /("(?:password|token|key|secret)"\s*:\s*)"[^"]*"/gi,
    '$1"[REDACTED]"'
  ) : '';
  
  console.log(message, maskedData);
}
```

### Operational Security

#### Regular Security Tasks
- [ ] Weekly dependency updates
- [ ] Monthly security audit
- [ ] Quarterly access review
- [ ] Annual security assessment

#### Security Checklist
- [ ] All secrets properly configured
- [ ] Branch protection rules enabled
- [ ] Two-factor authentication enforced
- [ ] Security scanning enabled
- [ ] Dependency updates automated
- [ ] Incident response plan tested
- [ ] Team security training completed

### Compliance

#### Security Standards
- **OWASP Top 10**: Web application security
- **NIST Cybersecurity Framework**: Risk management
- **CIS Controls**: Security best practices
- **SANS 20**: Critical security controls

#### Documentation Requirements
- Security policy documentation
- Incident response procedures
- Access control matrices
- Security training records

## 📚 Additional Resources

### Security Tools
- [npm audit](https://docs.npmjs.com/cli/v8/commands/npm-audit)
- [GitHub Security](https://docs.github.com/en/code-security)
- [OWASP Guidelines](https://owasp.org/www-project-top-ten/)
- [Node.js Security](https://nodejs.org/en/security/)

### Reporting Security Issues

If you discover a security vulnerability, please:

1. **Do NOT** open a public issue
2. **Email** security@tw-enigma.com (if configured)
3. **Use** GitHub Security Advisories for private reporting
4. **Include** detailed description and reproduction steps
5. **Allow** reasonable time for response and remediation

### Emergency Contacts

- **Security Team**: security@tw-enigma.com
- **On-call**: +1-XXX-XXX-XXXX
- **GitHub Support**: https://support.github.com/
- **npm Support**: https://www.npmjs.com/support

---

Security is everyone's responsibility. When in doubt, err on the side of caution and escalate to the security team. 