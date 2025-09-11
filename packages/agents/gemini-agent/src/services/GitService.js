/**
 * GitService - Ported from Gemini CLI gitService.ts
 * Provides Git repository integration and operations
 */

import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';

/**
 * Git service for repository operations (ported from Gemini CLI)
 */
export class GitService {
  constructor(resourceManager, projectRoot = process.cwd()) {
    this.resourceManager = resourceManager;
    this.projectRoot = path.resolve(projectRoot);
    this.isGitRepo = false;
    this.gitAvailable = false;
    this.githubUser = null;
    this.githubPAT = null;
  }

  /**
   * Initialize Git service (ported from Gemini CLI)
   */
  async initialize() {
    try {
      this.gitAvailable = await this.verifyGitAvailability();
      
      // Get GitHub credentials from ResourceManager (Legion pattern)
      this.githubUser = await this.resourceManager.get('env.GITHUB_USER');
      this.githubPAT = await this.resourceManager.get('env.GITHUB_PAT');
      
      if (this.gitAvailable) {
        this.isGitRepo = await this.isGitRepository();
        console.log(`✅ Git service initialized - Repo: ${this.isGitRepo ? 'Yes' : 'No'}`);
        console.log(`🔐 GitHub credentials: ${this.githubUser ? '✅' : '❌'} user, ${this.githubPAT ? '✅' : '❌'} PAT`);
      } else {
        console.warn('⚠️ Git not available on system');
      }
    } catch (error) {
      throw new Error(`Git service initialization failed: ${error.message}`);
    }
  }

  /**
   * Verify Git is available (ported from Gemini CLI)
   * @returns {Promise<boolean>} Whether Git is available
   */
  async verifyGitAvailability() {
    return new Promise((resolve) => {
      const gitCheck = spawn('git', ['--version'], { stdio: 'pipe' });
      
      gitCheck.on('close', (code) => {
        resolve(code === 0);
      });
      
      gitCheck.on('error', () => {
        resolve(false);
      });
    });
  }

  /**
   * Check if current directory is a Git repository (ported from Gemini CLI)
   * @param {string} dir - Directory to check
   * @returns {Promise<boolean>} Whether it's a Git repo
   */
  async isGitRepository(dir = this.projectRoot) {
    try {
      const gitDir = path.join(dir, '.git');
      const stats = await fs.stat(gitDir);
      return stats.isDirectory();
    } catch (error) {
      return false;
    }
  }

  /**
   * Execute Git command (ported pattern from Gemini CLI)
   * @param {Array} args - Git command arguments
   * @param {Object} options - Execution options
   * @returns {Promise<Object>} Command result
   */
  async executeGitCommand(args, options = {}) {
    if (!this.gitAvailable) {
      throw new Error('Git is not available on this system');
    }

    return new Promise((resolve, reject) => {
      const gitProcess = spawn('git', args, {
        cwd: options.cwd || this.projectRoot,
        stdio: 'pipe'
      });

      let stdout = '';
      let stderr = '';

      gitProcess.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      gitProcess.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      gitProcess.on('close', (code) => {
        if (code === 0) {
          resolve({
            success: true,
            stdout: stdout.trim(),
            stderr: stderr.trim(),
            exitCode: code
          });
        } else {
          reject(new Error(`Git command failed: ${stderr || stdout}`));
        }
      });

      gitProcess.on('error', (error) => {
        reject(new Error(`Git execution failed: ${error.message}`));
      });
    });
  }

  /**
   * Get Git status (ported from Gemini CLI)
   * @returns {Promise<Object>} Git status
   */
  async getStatus() {
    if (!this.isGitRepo) {
      return {
        isGitRepo: false,
        message: 'Not a Git repository'
      };
    }

    try {
      const result = await this.executeGitCommand(['status', '--porcelain']);
      
      const statusLines = result.stdout.split('\\n').filter(line => line.trim());
      
      return {
        isGitRepo: true,
        hasChanges: statusLines.length > 0,
        modifiedFiles: statusLines.length,
        statusOutput: result.stdout,
        files: statusLines.map(line => {
          const status = line.substring(0, 2);
          const filepath = line.substring(3);
          return { status, path: filepath };
        })
      };
    } catch (error) {
      throw new Error(`Failed to get Git status: ${error.message}`);
    }
  }

  /**
   * Get Git branch information (ported from Gemini CLI)
   * @returns {Promise<Object>} Branch info
   */
  async getBranchInfo() {
    if (!this.isGitRepo) {
      return { isGitRepo: false };
    }

    try {
      const branchResult = await this.executeGitCommand(['branch', '--show-current']);
      const remotesResult = await this.executeGitCommand(['remote', '-v']).catch(() => ({ stdout: '' }));
      
      return {
        isGitRepo: true,
        currentBranch: branchResult.stdout || 'unknown',
        hasRemotes: remotesResult.stdout.length > 0,
        remotes: remotesResult.stdout.split('\\n').filter(line => line.trim())
      };
    } catch (error) {
      throw new Error(`Failed to get branch info: ${error.message}`);
    }
  }

  /**
   * Get recent Git commits (ported from Gemini CLI)
   * @param {number} count - Number of commits to retrieve
   * @returns {Promise<Array>} Recent commits
   */
  async getRecentCommits(count = 5) {
    if (!this.isGitRepo) {
      return [];
    }

    try {
      const result = await this.executeGitCommand([
        'log', 
        `--max-count=${count}`,
        '--pretty=format:%H|%an|%ad|%s',
        '--date=iso'
      ]);

      if (!result.stdout) {
        return [];
      }

      return result.stdout.split('\\n').map(line => {
        const [hash, author, date, message] = line.split('|');
        return {
          hash: hash?.substring(0, 8),
          author,
          date,
          message
        };
      });
    } catch (error) {
      throw new Error(`Failed to get recent commits: ${error.message}`);
    }
  }

  /**
   * Get Git diff (ported from Gemini CLI)
   * @param {Object} options - Diff options
   * @returns {Promise<string>} Git diff output
   */
  async getDiff(options = {}) {
    if (!this.isGitRepo) {
      return '';
    }

    try {
      const args = ['diff'];
      
      if (options.staged) {
        args.push('--staged');
      }
      
      if (options.files) {
        args.push(...options.files);
      }

      const result = await this.executeGitCommand(args);
      return result.stdout;
    } catch (error) {
      throw new Error(`Failed to get Git diff: ${error.message}`);
    }
  }

  /**
   * Add files to Git staging (ported from Gemini CLI)
   * @param {Array} files - Files to add
   * @returns {Promise<Object>} Add result
   */
  async addFiles(files) {
    if (!this.isGitRepo) {
      throw new Error('Not a Git repository');
    }

    try {
      const result = await this.executeGitCommand(['add', ...files]);
      
      return {
        success: true,
        addedFiles: files.length,
        output: result.stdout
      };
    } catch (error) {
      throw new Error(`Failed to add files: ${error.message}`);
    }
  }

  /**
   * Create Git commit (ported from Gemini CLI)
   * @param {string} message - Commit message
   * @param {Object} options - Commit options
   * @returns {Promise<Object>} Commit result
   */
  async createCommit(message, options = {}) {
    if (!this.isGitRepo) {
      throw new Error('Not a Git repository');
    }

    try {
      const args = ['commit', '-m', message];
      
      if (options.allowEmpty) {
        args.push('--allow-empty');
      }

      const result = await this.executeGitCommand(args);
      
      return {
        success: true,
        message: result.stdout,
        commitCreated: true
      };
    } catch (error) {
      throw new Error(`Failed to create commit: ${error.message}`);
    }
  }

  /**
   * Get Git repository information (ported from Gemini CLI)
   * @returns {Object} Repository info
   */
  getRepositoryInfo() {
    return {
      projectRoot: this.projectRoot,
      isGitRepo: this.isGitRepo,
      gitAvailable: this.gitAvailable
    };
  }

  /**
   * Check if working directory is clean
   * @returns {Promise<boolean>} Whether working directory is clean
   */
  async isWorkingDirectoryClean() {
    if (!this.isGitRepo) {
      return true; // Not a Git repo, consider "clean"
    }

    try {
      const status = await this.getStatus();
      return !status.hasChanges;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get Git configuration value
   * @param {string} key - Configuration key
   * @returns {Promise<string>} Configuration value
   */
  async getConfig(key) {
    if (!this.gitAvailable) {
      throw new Error('Git not available');
    }

    try {
      const result = await this.executeGitCommand(['config', '--get', key]);
      return result.stdout;
    } catch (error) {
      throw new Error(`Failed to get Git config ${key}: ${error.message}`);
    }
  }
}

export default GitService;