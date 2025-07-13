/**
 * Git utility functions for managing repository operations
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import { promises as fs } from 'fs';

const execAsync = promisify(exec);

/**
 * Check if a directory is a git repository
 */
export async function isGitRepo(dirPath) {
  try {
    await execAsync('git rev-parse --git-dir', { cwd: dirPath });
    return true;
  } catch {
    return false;
  }
}

/**
 * Initialize a git repository
 */
export async function initRepo(dirPath, initialCommitMessage = 'Initial commit', forceNew = false) {
  const isRepo = await isGitRepo(dirPath);
  
  if (isRepo && forceNew) {
    console.log(`  Removing existing git repository connection...`);
    // Find and remove the .git directory (could be in parent directories)
    let currentPath = dirPath;
    while (currentPath !== '/' && currentPath !== '') {
      const gitPath = path.join(currentPath, '.git');
      try {
        const stats = await fs.stat(gitPath);
        if (stats.isDirectory()) {
          // Found .git directory, but we can't remove it if it's in a parent
          if (currentPath !== dirPath) {
            console.log(`  Package is part of parent repository at ${currentPath}`);
            console.log(`  Creating new standalone repository...`);
            break;
          } else {
            // It's in our directory, we can remove it
            await fs.rm(gitPath, { recursive: true, force: true });
            console.log(`  Removed existing .git directory`);
            break;
          }
        }
      } catch {
        // .git doesn't exist here, continue searching up
      }
      currentPath = path.dirname(currentPath);
    }
  } else if (isRepo && !forceNew) {
    console.log(`  Repository already initialized in ${dirPath}`);
    return { alreadyExists: true };
  }

  // Initialize new repository
  await execAsync('git init', { cwd: dirPath });
  console.log(`  Initialized new git repository`);
  
  // Check if there are files to commit
  const { stdout: status } = await execAsync('git status --porcelain', { cwd: dirPath });
  
  if (status.trim()) {
    // Add all files
    await execAsync('git add .', { cwd: dirPath });
    
    // Create initial commit
    await execAsync(`git commit -m "${initialCommitMessage}"`, { cwd: dirPath });
    
    console.log(`  Created initial commit`);
    return { initialized: true, hasCommit: true };
  } else {
    console.log(`  Repository initialized (no files to commit)`);
    return { initialized: true, hasCommit: false };
  }
}

/**
 * Add a remote to a repository
 */
export async function addRemote(dirPath, remoteName, remoteUrl) {
  // Check if remote already exists
  try {
    await execAsync(`git remote get-url ${remoteName}`, { cwd: dirPath });
    // Remote exists, remove it first
    await execAsync(`git remote remove ${remoteName}`, { cwd: dirPath });
  } catch {
    // Remote doesn't exist, that's fine
  }

  // Add the remote
  await execAsync(`git remote add ${remoteName} ${remoteUrl}`, { cwd: dirPath });
  console.log(`  Added remote '${remoteName}' -> ${remoteUrl}`);
}

/**
 * Push to a remote repository
 */
export async function pushToRemote(dirPath, remoteName = 'origin', branch = 'main', force = false) {
  const forceFlag = force ? '--force' : '';
  const { stdout, stderr } = await execAsync(
    `git push -u ${remoteName} ${branch} ${forceFlag}`,
    { cwd: dirPath }
  );
  
  console.log(`  Pushed to ${remoteName}/${branch}`);
  return { stdout, stderr };
}

/**
 * Get current branch name
 */
export async function getCurrentBranch(dirPath) {
  const { stdout } = await execAsync('git branch --show-current', { cwd: dirPath });
  return stdout.trim() || 'main';
}

/**
 * Check if there are uncommitted changes
 */
export async function hasUncommittedChanges(dirPath) {
  const { stdout } = await execAsync('git status --porcelain', { cwd: dirPath });
  return stdout.trim() !== '';
}

/**
 * Create a .gitignore file if it doesn't exist
 */
export async function ensureGitignore(dirPath) {
  const gitignorePath = path.join(dirPath, '.gitignore');
  
  try {
    await fs.access(gitignorePath);
    return false; // Already exists
  } catch {
    // Create a basic .gitignore
    const content = `node_modules/
.env
.env.local
*.log
.DS_Store
coverage/
dist/
build/
`;
    
    await fs.writeFile(gitignorePath, content);
    console.log(`  Created .gitignore file`);
    return true;
  }
}

/**
 * Extract a subdirectory with git history (using git subtree split)
 */
export async function extractWithHistory(sourceRepo, subdirectory, targetPath) {
  console.log(`  Extracting ${subdirectory} with history...`);
  
  // Create target directory
  await fs.mkdir(targetPath, { recursive: true });
  
  // Create a subtree split
  const { stdout: splitSha } = await execAsync(
    `git subtree split --prefix=${subdirectory} HEAD`,
    { cwd: sourceRepo }
  );
  
  const sha = splitSha.trim();
  console.log(`  Created subtree split: ${sha}`);
  
  // Initialize new repo in target
  await execAsync('git init', { cwd: targetPath });
  
  // Pull the split history
  await execAsync(`git pull ${sourceRepo} ${sha}`, { cwd: targetPath });
  
  console.log(`  Successfully extracted with history`);
  return { success: true, sha };
}

/**
 * Get repository status and information
 */
export async function getRepoStatus(dirPath) {
  const status = {
    isRepo: false,
    hasRemote: false,
    remotes: [],
    branch: null,
    hasUncommittedChanges: false,
    hasUntrackedFiles: false,
    ahead: 0,
    behind: 0
  };

  try {
    // Check if it's a git repo
    await execAsync('git rev-parse --git-dir', { cwd: dirPath });
    status.isRepo = true;

    // Get current branch
    const { stdout: branch } = await execAsync('git branch --show-current', { cwd: dirPath });
    status.branch = branch.trim() || 'HEAD (detached)';

    // Get remotes
    const { stdout: remotes } = await execAsync('git remote -v', { cwd: dirPath });
    if (remotes.trim()) {
      status.hasRemote = true;
      // Parse remotes
      const remoteLines = remotes.trim().split('\n');
      const remoteMap = new Map();
      remoteLines.forEach(line => {
        const [name, url] = line.split('\t');
        if (url) {
          const cleanUrl = url.replace(/ \(fetch\)| \(push\)/, '');
          remoteMap.set(name, cleanUrl);
        }
      });
      status.remotes = Array.from(remoteMap.entries()).map(([name, url]) => ({ name, url }));
    }

    // Check for uncommitted changes
    const { stdout: changes } = await execAsync('git status --porcelain', { cwd: dirPath });
    if (changes.trim()) {
      const lines = changes.trim().split('\n');
      status.hasUncommittedChanges = lines.some(line => !line.startsWith('??'));
      status.hasUntrackedFiles = lines.some(line => line.startsWith('??'));
    }

    // Check ahead/behind if there's a remote
    if (status.hasRemote && status.branch !== 'HEAD (detached)') {
      try {
        const { stdout: tracking } = await execAsync(
          `git rev-list --left-right --count origin/${status.branch}...HEAD`,
          { cwd: dirPath }
        );
        const [behind, ahead] = tracking.trim().split('\t').map(n => parseInt(n, 10));
        status.ahead = ahead || 0;
        status.behind = behind || 0;
      } catch {
        // Remote branch might not exist yet
      }
    }

    return status;
  } catch (error) {
    // Not a git repo
    return status;
  }
}

/**
 * Prepare a package directory for standalone repository
 */
export async function preparePackageRepo(packagePath, repoName, orgName = 'BillPolly') {
  console.log(`  Preparing ${repoName} for standalone repository...`);
  
  // Ensure .gitignore exists
  await ensureGitignore(packagePath);
  
  // Update package.json if it exists
  const packageJsonPath = path.join(packagePath, 'package.json');
  try {
    const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf8'));
    
    // Remove workspace-specific configuration
    delete packageJson.workspaces;
    
    // Update repository field
    packageJson.repository = {
      type: 'git',
      url: `https://github.com/${orgName}/${repoName}.git`
    };
    
    await fs.writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');
    console.log(`  Updated package.json`);
  } catch (error) {
    // package.json might not exist or be invalid
    console.log(`  Warning: Could not update package.json: ${error.message}`);
  }
  
  return { success: true };
}