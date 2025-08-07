/**
 * RepositoryManager - Repository detection, initialization, and state management
 * 
 * Handles Git repository operations including detection of existing repositories,
 * initialization of new repositories, cloning from remote sources, and
 * maintaining repository state and metadata.
 */

import { promises as fs } from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import EventEmitter from 'events';

class RepositoryManager extends EventEmitter {
  constructor(resourceManager, config, workingDirectory) {
    super();
    
    this.resourceManager = resourceManager;
    this.config = config;
    this.workingDirectory = workingDirectory;
    this.initialized = false;
    
    // Repository state
    this.isGitRepository = false;
    this.hasRemote = false;
    this.remoteName = 'origin';
    this.remoteUrl = null;
    this.currentBranch = null;
    this.repositoryMetadata = null;
    
    // Git configuration
    this.gitConfig = {
      userEmail: null,
      userName: null,
      initialized: false
    };
  }
  
  async initialize() {
    if (this.initialized) {
      return;
    }
    
    // Ensure working directory exists
    await this.ensureDirectoryExists(this.workingDirectory);
    
    // Check if this is already a Git repository
    await this.detectRepository();
    
    // Initialize Git configuration
    await this.initializeGitConfig();
    
    this.initialized = true;
    this.emit('initialized', {
      isGitRepository: this.isGitRepository,
      hasRemote: this.hasRemote,
      workingDirectory: this.workingDirectory
    });
  }
  
  /**
   * Detect if the working directory is a Git repository
   */
  async detectRepository() {
    try {
      const gitDir = path.join(this.workingDirectory, '.git');
      const gitDirStats = await fs.stat(gitDir);
      
      if (gitDirStats.isDirectory() || gitDirStats.isFile()) {
        this.isGitRepository = true;
        
        // Get current branch and remote information
        await this.loadRepositoryInfo();
        
        this.emit('repositoryDetected', {
          path: this.workingDirectory,
          currentBranch: this.currentBranch,
          hasRemote: this.hasRemote,
          remoteUrl: this.remoteUrl
        });
      }
    } catch (error) {
      this.isGitRepository = false;
      this.emit('repositoryNotFound', { path: this.workingDirectory });
    }
  }
  
  /**
   * Load repository information (branch, remote, etc.)
   */
  async loadRepositoryInfo() {
    if (!this.isGitRepository) {
      return;
    }
    
    try {
      // Get current branch
      try {
        const branchResult = await this.executeGitCommand(['branch', '--show-current']);
        this.currentBranch = branchResult.trim() || 'main';
      } catch (error) {
        // No branches yet or other issue
        this.currentBranch = 'main';
      }
      
      // Check for remotes
      try {
        const remoteResult = await this.executeGitCommand(['remote']);
        if (remoteResult.trim()) {
          this.hasRemote = true;
          this.remoteName = remoteResult.split('\n')[0].trim();
          
          // Get remote URL
          const remoteUrlResult = await this.executeGitCommand(['remote', 'get-url', this.remoteName]);
          this.remoteUrl = remoteUrlResult.trim();
        }
      } catch (error) {
        // No remotes configured
      }
      
      // Load repository metadata
      await this.loadRepositoryMetadata();
      
    } catch (error) {
      this.emit('error', new Error(`Failed to load repository info: ${error.message}`));
    }
  }
  
  /**
   * Initialize a new Git repository
   */
  async initializeRepository(options = {}) {
    if (this.isGitRepository && !options.force) {
      throw new Error('Directory is already a Git repository');
    }
    
    try {
      // Initialize Git repository
      await this.executeGitCommand(['init']);
      
      // Set initial branch name if specified
      if (options.initialBranch) {
        await this.executeGitCommand(['checkout', '-b', options.initialBranch]);
        this.currentBranch = options.initialBranch;
      }
      
      // Configure repository
      if (options.description) {
        const descriptionPath = path.join(this.workingDirectory, '.git', 'description');
        await fs.writeFile(descriptionPath, options.description);
      }
      
      this.isGitRepository = true;
      
      // Create initial commit if requested
      if (options.initialCommit) {
        await this.createInitialCommit(options.initialCommit);
      }
      
      this.emit('repositoryInitialized', {
        path: this.workingDirectory,
        initialBranch: this.currentBranch,
        options
      });
      
      return {
        success: true,
        path: this.workingDirectory,
        branch: this.currentBranch
      };
      
    } catch (error) {
      throw new Error(`Failed to initialize repository: ${error.message}`);
    }
  }
  
  /**
   * Clone a repository from a remote URL
   */
  async cloneRepository(remoteUrl, options = {}) {
    try {
      // Ensure the working directory is empty or doesn't exist
      if (await this.directoryExists(this.workingDirectory)) {
        const files = await fs.readdir(this.workingDirectory);
        if (files.length > 0 && !options.force) {
          throw new Error('Working directory is not empty. Use force option to override.');
        }
      }
      
      // Prepare clone command
      const cloneArgs = ['clone'];
      
      if (options.branch) {
        cloneArgs.push('--branch', options.branch);
      }
      
      if (options.depth) {
        cloneArgs.push('--depth', options.depth.toString());
      }
      
      if (options.singleBranch) {
        cloneArgs.push('--single-branch');
      }
      
      cloneArgs.push(remoteUrl, '.');
      
      // Execute clone command
      await this.executeGitCommand(cloneArgs);
      
      // Update repository state
      this.isGitRepository = true;
      this.hasRemote = true;
      this.remoteUrl = remoteUrl;
      this.remoteName = 'origin';
      
      // Load repository information
      await this.loadRepositoryInfo();
      
      this.emit('repositoryCloned', {
        remoteUrl,
        path: this.workingDirectory,
        branch: this.currentBranch,
        options
      });
      
      return {
        success: true,
        remoteUrl,
        path: this.workingDirectory,
        branch: this.currentBranch,
        hasRemote: this.hasRemote
      };
      
    } catch (error) {
      throw new Error(`Failed to clone repository: ${error.message}`);
    }
  }
  
  /**
   * Add a remote to the repository
   */
  async addRemote(name, url, options = {}) {
    if (!this.isGitRepository) {
      throw new Error('Not a Git repository');
    }
    
    try {
      const addArgs = ['remote', 'add'];
      
      if (options.fetch) {
        addArgs.push('-f');
      }
      
      addArgs.push(name, url);
      
      await this.executeGitCommand(addArgs);
      
      if (name === 'origin') {
        this.hasRemote = true;
        this.remoteUrl = url;
        this.remoteName = name;
      }
      
      this.emit('remoteAdded', { name, url, options });
      
      return { success: true, name, url };
      
    } catch (error) {
      throw new Error(`Failed to add remote: ${error.message}`);
    }
  }
  
  /**
   * Configure repository settings
   */
  async configureRepository(settings) {
    if (!this.isGitRepository) {
      throw new Error('Not a Git repository');
    }
    
    try {
      const configurations = [];
      
      // Set user name and email
      if (settings.userName) {
        await this.executeGitCommand(['config', 'user.name', settings.userName]);
        this.gitConfig.userName = settings.userName;
        configurations.push(['user.name', settings.userName]);
      }
      
      if (settings.userEmail) {
        await this.executeGitCommand(['config', 'user.email', settings.userEmail]);
        this.gitConfig.userEmail = settings.userEmail;
        configurations.push(['user.email', settings.userEmail]);
      }
      
      // Set other configurations
      for (const [key, value] of Object.entries(settings.config || {})) {
        await this.executeGitCommand(['config', key, value]);
        configurations.push([key, value]);
      }
      
      this.gitConfig.initialized = true;
      
      this.emit('repositoryConfigured', { configurations, settings });
      
      return { success: true, configurations };
      
    } catch (error) {
      throw new Error(`Failed to configure repository: ${error.message}`);
    }
  }
  
  /**
   * Validate repository health and integrity
   */
  async validateRepository() {
    if (!this.isGitRepository) {
      return {
        valid: false,
        issues: ['Not a Git repository'],
        canRepair: false
      };
    }
    
    const issues = [];
    const warnings = [];
    
    try {
      // Check if .git directory exists and is valid
      await this.executeGitCommand(['status', '--porcelain']);
      
      // Check if remote is accessible (if exists)
      if (this.hasRemote) {
        try {
          await this.executeGitCommand(['ls-remote', '--heads', this.remoteName]);
        } catch (error) {
          warnings.push('Remote repository not accessible');
        }
      }
      
      // Check Git configuration
      if (!this.gitConfig.userName) {
        issues.push('Git user.name not configured');
      }
      
      if (!this.gitConfig.userEmail) {
        issues.push('Git user.email not configured');
      }
      
      // Check for uncommitted changes
      const statusResult = await this.executeGitCommand(['status', '--porcelain']);
      const hasUncommittedChanges = statusResult.trim().length > 0;
      
      return {
        valid: issues.length === 0,
        issues,
        warnings,
        canRepair: true,
        metadata: {
          hasUncommittedChanges,
          currentBranch: this.currentBranch,
          hasRemote: this.hasRemote,
          remoteUrl: this.remoteUrl
        }
      };
      
    } catch (error) {
      issues.push(`Repository validation failed: ${error.message}`);
      return {
        valid: false,
        issues,
        warnings,
        canRepair: false
      };
    }
  }
  
  /**
   * Create initial commit
   */
  async createInitialCommit(message = 'Initial commit') {
    try {
      // Create a basic README if none exists
      const readmePath = path.join(this.workingDirectory, 'README.md');
      if (!await this.fileExists(readmePath)) {
        await fs.writeFile(readmePath, '# Project\n\nGenerated by @legion/code-agent\n');
      }
      
      // Add and commit
      await this.executeGitCommand(['add', '.']);
      await this.executeGitCommand(['commit', '-m', message]);
      
      this.emit('initialCommitCreated', { message });
      
    } catch (error) {
      throw new Error(`Failed to create initial commit: ${error.message}`);
    }
  }
  
  /**
   * Initialize Git configuration
   */
  async initializeGitConfig() {
    try {
      // Only configure Git if we have a Git repository
      if (!this.isGitRepository) {
        this.gitConfig.initialized = true;
        return;
      }
      
      // Try to get existing Git configuration
      try {
        const userName = await this.executeGitCommand(['config', 'user.name']);
        this.gitConfig.userName = userName.trim();
      } catch (error) {
        // User name not configured
      }
      
      try {
        const userEmail = await this.executeGitCommand(['config', 'user.email']);
        this.gitConfig.userEmail = userEmail.trim();
      } catch (error) {
        // User email not configured
      }
      
      // Set default configuration if not present
      if (!this.gitConfig.userName) {
        const defaultName = this.resourceManager.GITHUB_USER || 'CodeAgent';
        await this.configureRepository({ userName: defaultName });
      }
      
      if (!this.gitConfig.userEmail) {
        const defaultEmail = 'code-agent@jsenvoy.ai';
        await this.configureRepository({ userEmail: defaultEmail });
      }
      
      this.gitConfig.initialized = true;
      
    } catch (error) {
      this.emit('error', new Error(`Failed to initialize Git config: ${error.message}`));
    }
  }
  
  /**
   * Load repository metadata
   */
  async loadRepositoryMetadata() {
    try {
      const metadata = {
        workingDirectory: this.workingDirectory,
        isGitRepository: this.isGitRepository,
        currentBranch: this.currentBranch,
        hasRemote: this.hasRemote,
        remoteName: this.remoteName,
        remoteUrl: this.remoteUrl,
        gitConfig: this.gitConfig,
        lastUpdate: new Date()
      };
      
      // Get commit information
      try {
        const lastCommit = await this.executeGitCommand(['log', '-1', '--pretty=format:%H|%an|%ae|%s|%ad']);
        if (lastCommit.trim()) {
          const [hash, author, email, subject, date] = lastCommit.split('|');
          metadata.lastCommit = { hash, author, email, subject, date };
        }
      } catch (error) {
        // No commits yet
      }
      
      this.repositoryMetadata = metadata;
      
    } catch (error) {
      this.emit('error', new Error(`Failed to load repository metadata: ${error.message}`));
    }
  }
  
  /**
   * Execute Git command
   */
  async executeGitCommand(args, options = {}) {
    return new Promise((resolve, reject) => {
      const gitProcess = spawn('git', args, {
        cwd: this.workingDirectory,
        stdio: 'pipe',
        ...options
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
          resolve(stdout);
        } else {
          reject(new Error(`Git command failed: ${stderr || stdout}`));
        }
      });
      
      gitProcess.on('error', (error) => {
        reject(new Error(`Failed to execute git command: ${error.message}`));
      });
    });
  }
  
  /**
   * Utility methods
   */
  async ensureDirectoryExists(dirPath) {
    try {
      await fs.mkdir(dirPath, { recursive: true });
    } catch (error) {
      if (error.code !== 'EEXIST') {
        throw error;
      }
    }
  }
  
  async directoryExists(dirPath) {
    try {
      const stats = await fs.stat(dirPath);
      return stats.isDirectory();
    } catch (error) {
      return false;
    }
  }
  
  async fileExists(filePath) {
    try {
      const stats = await fs.stat(filePath);
      return stats.isFile();
    } catch (error) {
      return false;
    }
  }
  
  // Legacy methods for compatibility
  async setupRepository() {
    await this.initialize();
    return { setup: true };
  }
  
  async pushToRemote() {
    if (!this.hasRemote) {
      throw new Error('No remote configured');
    }
    
    try {
      await this.executeGitCommand(['push', this.remoteName, this.currentBranch]);
      return { pushed: true };
    } catch (error) {
      throw new Error(`Failed to push to remote: ${error.message}`);
    }
  }
  
  async getRepositoryInfo() {
    const statusResult = await this.executeGitCommand(['status', '--porcelain']);
    return { 
      status: statusResult.trim() ? 'dirty' : 'clean',
      branch: this.currentBranch,
      hasRemote: this.hasRemote,
      remoteUrl: this.remoteUrl
    };
  }
  
  async getCommitHistory(limit = 10) {
    try {
      const result = await this.executeGitCommand(['log', `--max-count=${limit}`, '--pretty=format:%H|%an|%ae|%s|%ad']);
      return result.trim().split('\n').map(line => {
        const [hash, author, email, subject, date] = line.split('|');
        return { hash, author, email, subject, date };
      });
    } catch (error) {
      return [];
    }
  }
  
  /**
   * Get repository status
   */
  getStatus() {
    return {
      initialized: this.initialized,
      isGitRepository: this.isGitRepository,
      hasRemote: this.hasRemote,
      currentBranch: this.currentBranch,
      remoteUrl: this.remoteUrl,
      workingDirectory: this.workingDirectory,
      gitConfig: this.gitConfig,
      metadata: this.repositoryMetadata
    };
  }
  
  /**
   * Check if repository manager is initialized
   */
  isInitialized() {
    return this.initialized;
  }
  
  /**
   * Cleanup resources
   */
  async cleanup() {
    this.initialized = false;
    this.emit('cleanup');
  }
}

export default RepositoryManager;