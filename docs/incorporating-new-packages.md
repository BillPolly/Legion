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

You can either modify the existing `split-monorepo.js` script or use the dedicated `add-package-to-polyrepo.js` script:

#### Option A: Using the Dedicated Script (Recommended)

1. **Run the add package script**:
   ```bash
   npm run polyrepo:add <package-name> [-- --keep-name]
   # Or directly: node scripts/add-package-to-polyrepo.js <package-name> [--keep-name]
   
   # Examples:
   npm run polyrepo:add llm                    # Creates repo as jsenvoy-llm
   npm run polyrepo:add llm-cli -- --keep-name # Creates repo as llm-cli
   ```
   
   Use `--keep-name` flag to keep the original package name as the repository name instead of prefixing with `jsenvoy-`.

   The script will automatically:
   - Validate the package exists
   - Update package.json to follow naming conventions
   - Create .gitignore if missing
   - Initialize a local git repository
   - Create the GitHub repository
   - Push the initial code
   - Update .gitsubtree configuration
   - Provide next steps for subtree setup

#### Option B: Modify split-monorepo.js

1. **Add your packages to the script**:
   ```javascript
   // In scripts/split-monorepo.js, add to the packages array:
   {
     path: path.join(rootDir, 'packages/llm'),
     repoName: 'jsenvoy-llm',
     description: 'LLM integration package for jsEnvoy'
   }
   ```

2. **Run the split script**:
   ```bash
   node scripts/split-monorepo.js
   ```

### 3. Add as Git Subtrees

After repositories are created, add them as subtrees to the main repository:

1. **Important**: Remove any `.git` directory from the package:
   ```bash
   rm -rf packages/<package-name>/.git
   ```
   This prevents the package from being treated as a submodule.

2. **Update .gitsubtree configuration**:
   ```bash
   # Add this line to .gitsubtree
   packages/<package-name> https://github.com/BillPolly/jsenvoy-<package-name>.git main
   ```

3. **Setup subtree remotes** (for VSCode integration):
   ```bash
   npm run subtree:setup
   ```

4. **Commit the package to the monorepo**:
   ```bash
   git add .
   git commit -m "Add <package-name> package to polyrepo structure"
   ```

5. **Establish subtree connection**:
   ```bash
   # Push existing content to the remote as a subtree
   git subtree push --prefix=packages/<package-name> https://github.com/BillPolly/jsenvoy-<package-name>.git main
   ```

   Note: If you get "no new revisions were found", the content is already synchronized.

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
   - This often happens when the initial push creates commits
   - Solution: The content is likely already synchronized

3. **"No new revisions were found"**:
   - This is often not an error - it means content is already synchronized
   - Only a problem if you expected new changes to be pushed

4. **Authentication errors**:
   - Check your GITHUB_PAT in .env
   - Ensure the token has proper permissions
   - The scripts automatically inject authentication into URLs

5. **"Package is in submodule"**:
   - The package was accidentally added as a git submodule
   - Fix: `git rm --cached packages/<name>` then `rm -rf packages/<name>/.git`
   - Re-add with `git add packages/<name>/`

6. **Git repository in parent directory**:
   - The script detects the monorepo's .git directory
   - This is expected - the script will create a new standalone repo

### Important Lessons

1. **Always remove .git directories** from packages before committing to avoid submodule issues
2. **Package naming** must follow the `@jsenvoy/` convention in package.json
3. **Repository naming** follows the pattern `jsenvoy-<package-name>` by default, but use `--keep-name` to preserve original names
4. **Initial push conflicts** are common - the content is usually already synchronized
5. **Use dedicated scripts** for single package additions rather than modifying the bulk script

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