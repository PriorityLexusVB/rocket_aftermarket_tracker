# GitHub Security Setup Guide

This document outlines the security automation configured for the Rocket Aftermarket Tracker repository and the manual steps required to enable them in GitHub Settings.

## Configured via Repository Files

The following security automation has been configured through repository files:

### 1. Dependabot (`.github/dependabot.yml`)

Automatically creates pull requests to update dependencies.

**Configured Ecosystems:**

| Ecosystem | Directory | Schedule | Purpose |
|-----------|-----------|----------|---------|
| `npm` | `/` | Weekly (Monday, 6:00 AM EST) | JavaScript/TypeScript dependencies |
| `github-actions` | `/` | Monthly (Monday, 6:00 AM EST) | GitHub Actions workflow dependencies |

**Grouping Strategy:**
- **Security updates**: All security patches grouped together for expedited review
- **Minor and patch**: Non-breaking updates grouped to reduce PR noise
- **Major updates**: Breaking changes kept separate for careful review
- **GitHub Actions**: All action updates grouped together

**Labels Applied:**
- `dependencies` - All dependency PRs
- `automated` - Identifies automated PRs
- `github-actions` - Specifically for workflow updates

### 2. CodeQL Analysis (`.github/workflows/codeql.yml`)

Static analysis security scanning for code vulnerabilities.

**Configuration:**
- **Languages**: `javascript-typescript`
- **Triggers**:
  - Push to `main` branch
  - Pull requests targeting `main` branch  
  - Weekly scheduled scan (Monday, 10:00 UTC / 5:00 AM EST)
- **Query Suites**: `security-extended` + `security-and-quality`

---

## Must Be Enabled Manually in GitHub Settings

Some security features require manual activation in the GitHub UI. Navigate to your repository's settings to enable them.

### Settings → Code security and analysis

Go to: `https://github.com/<your-org-or-username>/<your-repo>/settings/security_analysis`

| Feature | Status | Action Required |
|---------|--------|-----------------|
| **Dependency graph** | Required | ✅ Enable - Allows GitHub to analyze dependencies |
| **Dependabot alerts** | Required | ✅ Enable - Alerts for vulnerable dependencies |
| **Dependabot security updates** | Recommended | ✅ Enable - Auto-creates PRs for security patches |
| **Dependabot version updates** | Optional | ⚡ Enable - Uses `dependabot.yml` config for version PRs |
| **Code scanning** | Required | ✅ Enable - Uses CodeQL workflow for security analysis |
| **Secret scanning** | Recommended | ✅ Enable - Detects secrets committed to code |
| **Push protection** | Recommended | ✅ Enable - Blocks commits containing secrets |

### Step-by-Step Instructions

1. **Enable Dependency Graph**
   - Navigate to Settings → Code security and analysis
   - Find "Dependency graph" and click "Enable"
   - This is required for Dependabot to work

2. **Enable Dependabot Alerts**
   - Find "Dependabot alerts" and click "Enable"
   - This notifies you of known vulnerabilities in dependencies

3. **Enable Dependabot Security Updates**
   - Find "Dependabot security updates" and click "Enable"
   - This automatically creates PRs for security vulnerabilities

4. **Enable Dependabot Version Updates**
   - Find "Dependabot version updates" and click "Enable"
   - This activates the `dependabot.yml` configuration for regular updates

5. **Enable Code Scanning**
   - Find "Code scanning" section
   - The existing `codeql.yml` workflow will be picked up automatically, or you can explicitly select "Set up" → "Default" if needed
   - The `codeql.yml` workflow will run on pushes and PRs

6. **Enable Secret Scanning**
   - Find "Secret scanning" and click "Enable"
   - Optionally enable "Push protection" to block secrets from being pushed

---

## Verification Checklist

After enabling the features above, verify the setup is working:

- [ ] **Dependency graph**: Visit Insights → Dependency graph to see dependencies
- [ ] **Dependabot alerts**: Check Security → Dependabot alerts for any existing vulnerabilities
- [ ] **Code scanning**: Push a commit or create a PR to trigger CodeQL analysis
- [ ] **Secret scanning**: Check Security → Secret scanning alerts

---

## Notes for Organization Admins

Some features may require **GitHub Advanced Security** to be enabled at the organization level:

- Secret scanning with push protection
- Code scanning with advanced queries
- Dependency review in pull requests

Contact your organization administrator if these features are unavailable.

---

## Maintenance

### Dependabot

- Review and merge Dependabot PRs weekly
- Security updates should be prioritized and merged promptly
- Major version updates may require code changes - review changelogs carefully

### CodeQL

- Review code scanning alerts in the Security tab
- False positives can be dismissed with a reason
- Critical and high severity findings should be addressed promptly

### Updating This Configuration

- **Dependabot**: Edit `.github/dependabot.yml` to adjust schedules, grouping, or ecosystems
- **CodeQL**: Edit `.github/workflows/codeql.yml` to add languages or modify query suites
