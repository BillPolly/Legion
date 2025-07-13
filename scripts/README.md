# jsEnvoy Scripts

This directory contains JavaScript utilities for managing the jsEnvoy monorepo.

## Splitting the Monorepo

The scripts in this directory help you split the jsEnvoy monorepo into separate GitHub repositories while optionally preserving git history.

### Prerequisites

1. **Environment Variables**: Create a `.env` file in the root directory with:
   ```
   GITHUB_PAT=your_github_personal_access_token
   GITHUB_ORG=BillPolly
   ```

2. **GitHub PAT Permissions**: Your GitHub Personal Access Token needs:
   - `repo` scope for creating repositories
   - `admin:org` scope if creating repositories in an organization

3. **Git Repository**: The monorepo must be a git repository with committed changes

### Available Scripts

#### 1. Check Prerequisites
```bash
npm run split:check
```
This script verifies that all prerequisites are met before attempting to split the repository.

#### 2. Simple Split (Fresh History)
```bash
npm run split:simple
```
- Creates new git repositories for each package
- Initializes with a fresh commit history
- Creates GitHub repositories in the specified organization
- Pushes each package to its own repository

#### 3. Split with History Preservation
```bash
npm run split:history
```
- Uses `git subtree` to preserve commit history for each package
- Extracts each package with its relevant commit history
- Creates GitHub repositories and pushes with preserved history
- Cleans up temporary files after completion

#### 4. Add Single Package (Hierarchical Support)
```bash
node scripts/split/add-hierarchical-package-to-polyrepo.js <package-path> <repo-name> [--keep-name]
```
**Examples:**
- `node scripts/split/add-hierarchical-package-to-polyrepo.js apps/web-frontend web-frontend`
- `node scripts/split/add-hierarchical-package-to-polyrepo.js apps/web-backend web-backend`
- `node scripts/split/add-hierarchical-package-to-polyrepo.js llm llm --keep-name`

**Parameters:**
- `package-path`: Relative path from packages/ (supports hierarchical structure)
- `repo-name`: Name of the GitHub repository to create
- `--keep-name`: Use repo-name as-is instead of adding jsenvoy- prefix

This script supports any hierarchical package structure (e.g., `packages/apps/*`, `packages/tools/*`, etc.)

### What Gets Created

Each package will be pushed to its own repository:
- `BillPolly/jsenvoy-modules`
- `BillPolly/jsenvoy-cli`
- `BillPolly/jsenvoy-tools`
- `BillPolly/jsenvoy-response-parser`
- `BillPolly/jsenvoy-agent`

### Package Preparation

The scripts automatically:
- Create `.gitignore` files if missing
- Update `package.json` to remove workspace configuration
- Add repository information to `package.json`
- Ensure each package is ready to be a standalone repository

### Git Tools API

The `utils/git-tools.js` module provides reusable functions:
- `isGitRepo(dirPath)` - Check if directory is a git repository
- `initRepo(dirPath, commitMessage)` - Initialize a git repository
- `addRemote(dirPath, remoteName, remoteUrl)` - Add a git remote
- `pushToRemote(dirPath, remoteName, branch, force)` - Push to remote
- `extractWithHistory(sourceRepo, subdirectory, targetPath)` - Extract with git subtree
- `preparePackageRepo(packagePath, packageName)` - Prepare for standalone repo

### Troubleshooting

1. **Authentication Failed**: Ensure your GitHub PAT is valid and has the required permissions
2. **Organization Not Found**: Check that the organization name in `.env` is correct
3. **Repository Already Exists**: Delete the existing repository on GitHub or use a different name
4. **Git History Issues**: Use the simple split if you don't need to preserve history

### Step-by-Step Package Splitting

You can split packages individually with fine-grained control:

```bash
# Check the status of a package
npm run split agent check

# Initialize the agent package as a git repository
npm run split agent init

# Create the GitHub repository
npm run split agent create

# Push to GitHub
npm run split agent push

# Or do all steps at once
npm run split agent all
```

The `check` command shows:
- Whether the directory is a valid git repository
- Current branch and uncommitted changes
- Remote configuration and sync status
- Whether the remote matches the expected GitHub repository

### Manual Steps After Splitting

After successfully splitting the monorepo:
1. Update CI/CD configurations in each new repository
2. Set up branch protection rules
3. Configure repository settings (issues, wikis, etc.)
4. Update documentation with new repository URLs
5. Archive or update the original monorepo README