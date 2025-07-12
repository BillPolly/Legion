# Incorporating New Packages into jsEnvoy Polyrepo

This guide explains how to incorporate new packages that have been cut and pasted into the jsEnvoy project, transforming them into properly managed subtree repositories.

## Overview

The jsEnvoy project uses a polyrepo-with-subtrees architecture where:
- The main monorepo contains all packages under `/packages/`
- Each package is also maintained as a separate GitHub repository
- Git subtrees synchronize changes between the monorepo and individual repos
- The GitHub organization is **BillPolly**

## Prerequisites

1. **Environment Setup**:
   - Ensure `.env` file exists in the root directory with:
     ```
     GITHUB_PAT=your_github_personal_access_token
     GITHUB_ORG=BillPolly
     ```
   - The PAT needs `repo` and `admin:org` permissions

2. **Dependencies**:
   - Node.js >= 18.0.0
   - Git with subtree support
   - npm packages installed (`npm install` from root)

## Step-by-Step Process

### 1. Prepare the Package

When you have a new package directory (e.g., `packages/llm` and `packages/llm-cli`):

1. **Ensure proper package structure**:
   ```bash
   packages/
   ├── llm/
   │   ├── package.json
   │   ├── src/
   │   └── ...
   └── llm-cli/
       ├── package.json
       ├── src/
       └── ...
   ```

2. **Update package.json**:
   - Ensure the package name follows the naming convention (e.g., `@jsenvoy/llm`)
   - Remove any workspace-specific configuration
   - The repository field will be automatically updated by the scripts

3. **Create .gitignore** (if missing):
   ```
   node_modules/
   .env
   .env.local
   *.log
   .DS_Store
   coverage/
   dist/
   build/
   ```

### 2. Create GitHub Repositories

The `split-monorepo.js` script uses the PolyRepoManager tool to handle repository creation and initial push:

1. **Modify the script** to include your new packages:
   ```javascript
   // In scripts/split-monorepo.js, add to the packages array:
   {
     path: path.join(rootDir, 'packages/llm'),
     repoName: 'jsenvoy-llm',
     description: 'LLM integration package for jsEnvoy'
   },
   {
     path: path.join(rootDir, 'packages/llm-cli'),
     repoName: 'jsenvoy-llm-cli',
     description: 'CLI for LLM operations in jsEnvoy'
   }
   ```

2. **Run the split script**:
   ```bash
   node scripts/split-monorepo.js
   ```

   The script will automatically:
   - Prepare each package for standalone repository use
   - Initialize git repositories in each package directory
   - Create remote repositories on GitHub under BillPolly organization
   - Add remotes with authentication
   - Push the initial code to the remotes

### 3. Add as Git Subtrees

After repositories are created, add them as subtrees to the main repository:

1. **Update .gitsubtree configuration**:
   ```bash
   # Add these lines to .gitsubtree
   packages/llm https://github.com/BillPolly/jsenvoy-llm.git main
   packages/llm-cli https://github.com/BillPolly/jsenvoy-llm-cli.git main
   ```

2. **Setup subtree remotes** (for VSCode integration):
   ```bash
   npm run subtree:setup
   ```

3. **Establish subtree connection**:
   
   Since the packages already exist in the monorepo and have been pushed to remotes, you need to establish the subtree connection:
   
   ```bash
   # First, ensure all changes are committed
   git add .
   git commit -m "Add new llm packages"
   
   # Push existing content to the remotes as subtrees
   git subtree push --prefix=packages/llm https://github.com/BillPolly/jsenvoy-llm.git main
   git subtree push --prefix=packages/llm-cli https://github.com/BillPolly/jsenvoy-llm-cli.git main
   ```

### 4. Verify Setup

1. **Check subtree discovery**:
   ```bash
   npm run subtree:discover
   ```
   Your new packages should appear in the list.

2. **Test pushing changes**:
   ```bash
   # Make a small change in the package
   echo "# Test" >> packages/llm/README.md
   git add packages/llm/README.md
   git commit -m "Test subtree push"
   
   # Push to all subtrees
   npm run subtree:push
   ```

3. **Test pulling changes**:
   ```bash
   npm run subtree:pull
   ```

## Working with Subtrees

### Daily Development Workflow

1. **Make changes in the monorepo** - Work normally in `/packages/`
2. **Commit to main repo** - Regular git commits
3. **Push to subtrees** - `npm run subtree:push` when ready to sync
4. **Pull from subtrees** - `npm run subtree:pull` to get external changes

### Important NPM Scripts

```bash
# Push all subtrees to their remotes
npm run subtree:push

# Pull updates from all subtree remotes
npm run subtree:pull

# Setup remotes for VSCode integration
npm run subtree:setup

# Discover existing subtrees in the repository
npm run subtree:discover
```

## Troubleshooting

### Common Issues

1. **"Repository already exists"**:
   - The GitHub repository might already exist
   - Check https://github.com/BillPolly/[repo-name]
   - Delete it manually if needed or use a different name

2. **"Updates were rejected"**:
   - The remote has changes not in your local
   - Pull first: `npm run subtree:pull`
   - The scripts handle authentication automatically

3. **"No new revisions were found"**:
   - No changes to push
   - Make sure you've committed changes locally first

4. **Authentication errors**:
   - Check your GITHUB_PAT in .env
   - Ensure the token has proper permissions
   - The scripts automatically inject authentication into URLs

### Best Practices

1. **Always commit locally first** before pushing to subtrees
2. **Use the npm scripts** rather than manual git commands
3. **Run tests** before pushing to ensure package works standalone
4. **Keep .gitsubtree updated** when adding new packages
5. **Document dependencies** clearly in each package's README

## How the Scripts Work

The polyrepo system uses these key components:

1. **PolyRepoManager Tool** (`packages/general-tools/src/github/PolyRepoManager.js`):
   - Handles all GitHub API operations
   - Manages git operations (init, remote, push)
   - Provides consistent error handling

2. **ResourceManager** (`packages/modules`):
   - Manages configuration and dependencies
   - Automatically loads environment variables
   - Provides GitHub authentication

3. **Script Flow**:
   - Load environment configuration
   - Initialize GitHub module with credentials
   - Use PolyRepoManager to create repos and push code
   - Update package.json with repository information

## Script Reference

- **`scripts/split-monorepo.js`** - Main script that creates GitHub repos and pushes packages
- **`scripts/git-tools.js`** - Utility functions used by split-monorepo.js
- **`scripts/push-all-subtrees.js`** - Push all configured subtrees
- **`scripts/pull-all-subtrees.js`** - Pull updates from all subtrees
- **`scripts/setup-subtree-remotes.js`** - Configure git remotes for VSCode
- **`scripts/discover-subtrees.js`** - Find existing subtrees in the repo

## Configuration Files

- **`.gitsubtree`** - Maps package directories to GitHub repositories
- **`.env`** - Contains GitHub credentials and organization name
- **`package.json`** - NPM scripts for subtree operations

## Security Notes

- Never commit the `.env` file
- Keep your GITHUB_PAT secure
- Use repository secrets for CI/CD
- The scripts automatically handle authentication token injection
- All sensitive operations use the PolyRepoManager tool which validates credentials