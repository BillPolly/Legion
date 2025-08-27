/**
 * BranchManager - Branch creation, switching, deletion, and strategy implementation
 * 
 * Manages Git branch operations including creation of branches with proper naming,
 * switching between branches, deletion and cleanup, and implementing different
 * branch strategies (main, feature, timestamp).
 */

import EventEmitter from 'events';
import { spawn } from 'child_process';

class BranchManager extends EventEmitter {
  constructor(repositoryManager, config) {
    super();
    
    this.repositoryManager = repositoryManager;
    this.config = config;
    this.initialized = false;
    
    // Branch strategy configuration
    this.branchStrategy = config.branchStrategy || 'main';
    this.branchPrefix = config.branchPrefix || '';
    this.defaultBranch = config.defaultBranch || 'main';
    
    // Branch state
    this.currentBranch = null;
    this.branches = [];
    this.remoteBranches = [];
    
    // Branch naming configuration
    this.namingConfig = {
      maxLength: config.maxBranchNameLength || 100,
      allowedChars: /^[a-zA-Z0-9/_-]+$/,
      reservedNames: ['head', 'master', 'main'],
      illegalChars: /[^a-zA-Z0-9/_-]/g
    };
  }
  
  async initialize() {
    if (this.initialized) {
      return;
    }
    
    if (!this.repositoryManager.isInitialized()) {
      throw new Error('RepositoryManager must be initialized first');
    }
    
    // Load current branch information
    await this.loadBranchInfo();
    
    this.initialized = true;
    this.emit('initialized', {
      currentBranch: this.currentBranch,
      strategy: this.branchStrategy
    });
  }
  
  /**
   * Load current branch information
   */
  async loadBranchInfo() {
    try {
      // Get current branch
      this.currentBranch = await this.getCurrentBranch();
      
      // Load all branches
      this.branches = await this.listBranches();
      
      // Load remote branches if repository has remote
      if (this.repositoryManager.hasRemote) {
        this.remoteBranches = await this.listRemoteBranches();
      }
      
      this.emit('branchInfoLoaded', {
        currentBranch: this.currentBranch,
        localBranches: this.branches.length,
        remoteBranches: this.remoteBranches.length
      });
      
    } catch (error) {
      this.emit('error', new Error(`Failed to load branch info: ${error.message}`));
    }
  }
  
  /**
   * Get current branch information
   */
  async getCurrentBranch() {
    try {
      const branchOutput = await this.executeGitCommand(['branch', '--show-current']);
      const branchName = branchOutput.trim();
      
      if (!branchName) {
        // Probably in detached HEAD state
        const headOutput = await this.executeGitCommand(['rev-parse', 'HEAD']);
        return {
          name: 'HEAD',
          commit: headOutput.trim(),
          tracking: null,
          detached: true
        };
      }
      
      // Get tracking information
      let tracking = null;
      try {
        const trackingOutput = await this.executeGitCommand(['rev-parse', '--abbrev-ref', `${branchName}@{upstream}`]);
        tracking = trackingOutput.trim();
      } catch (error) {
        // No upstream tracking
      }
      
      return {
        name: branchName,
        tracking,
        detached: false
      };
      
    } catch (error) {
      throw new Error(`Failed to get current branch: ${error.message}`);
    }
  }
  
  /**
   * Create a new branch
   */
  async createBranch(branchName, options = {}) {
    // Validate and sanitize branch name
    const validatedName = this.validateBranchName(branchName);
    
    try {
      const createArgs = ['checkout', '-b', validatedName];
      
      // Specify starting point if provided
      if (options.startPoint) {
        createArgs.push(options.startPoint);
      }
      
      await this.executeGitCommand(createArgs);
      
      // Set up tracking if requested
      if (options.track && this.repositoryManager.hasRemote) {
        await this.setUpstreamTracking(validatedName, options.track);
      }
      
      // Update current branch
      this.currentBranch = await this.getCurrentBranch();
      
      this.emit('branchCreated', {
        name: validatedName,
        startPoint: options.startPoint,
        tracking: options.track
      });
      
      return {
        success: true,
        name: validatedName,
        current: true
      };
      
    } catch (error) {
      throw new Error(`Failed to create branch '${validatedName}': ${error.message}`);
    }
  }
  
  /**
   * Switch to an existing branch
   */
  async switchToBranch(branchName, options = {}) {
    try {
      const switchArgs = ['checkout'];
      
      if (options.createIfMissing) {
        switchArgs.push('-B'); // Create branch if it doesn't exist
      }
      
      switchArgs.push(branchName);
      
      await this.executeGitCommand(switchArgs);
      
      // Update current branch
      this.currentBranch = await this.getCurrentBranch();
      
      this.emit('branchSwitched', {
        from: this.currentBranch?.name,
        to: branchName
      });
      
      return {
        success: true,
        name: branchName,
        current: true
      };
      
    } catch (error) {
      throw new Error(`Failed to switch to branch '${branchName}': ${error.message}`);
    }
  }
  
  /**
   * Delete a branch
   */
  async deleteBranch(branchName, options = {}) {
    // Prevent deleting current branch
    if (this.currentBranch && this.currentBranch.name === branchName) {
      throw new Error('Cannot delete current branch');
    }
    
    try {
      const deleteArgs = ['branch'];
      
      if (options.force) {
        deleteArgs.push('-D'); // Force delete
      } else {
        deleteArgs.push('-d'); // Safe delete
      }
      
      deleteArgs.push(branchName);
      
      await this.executeGitCommand(deleteArgs);
      
      // Delete remote tracking branch if requested
      if (options.deleteRemote && this.repositoryManager.hasRemote) {
        await this.deleteRemoteBranch(branchName);
      }
      
      this.emit('branchDeleted', {
        name: branchName,
        force: options.force,
        deleteRemote: options.deleteRemote
      });
      
      return {
        success: true,
        deleted: branchName
      };
      
    } catch (error) {
      throw new Error(`Failed to delete branch '${branchName}': ${error.message}`);
    }
  }
  
  /**
   * List all local branches
   */
  async listBranches() {
    try {
      const output = await this.executeGitCommand(['branch', '--format=%(refname:short)|%(upstream:short)|%(ahead-behind:upstream)']);
      const branches = [];
      
      for (const line of output.trim().split('\n')) {
        if (!line.trim()) continue;
        
        const [name, upstream, aheadBehind] = line.split('|');
        const [ahead, behind] = aheadBehind ? aheadBehind.split(' ') : [0, 0];
        
        branches.push({
          name: name.trim(),
          upstream: upstream || null,
          ahead: parseInt(ahead) || 0,
          behind: parseInt(behind) || 0,
          current: name.trim() === this.currentBranch?.name
        });
      }
      
      return branches;
      
    } catch (error) {
      // Fallback to simple branch listing
      try {
        const output = await this.executeGitCommand(['branch']);
        const branches = [];
        
        for (const line of output.split('\n')) {
          const match = line.match(/^(\*?)\s*(.+)$/);
          if (match) {
            branches.push({
              name: match[2].trim(),
              current: match[1] === '*',
              upstream: null,
              ahead: 0,
              behind: 0
            });
          }
        }
        
        return branches;
      } catch (fallbackError) {
        throw new Error(`Failed to list branches: ${error.message}`);
      }
    }
  }
  
  /**
   * List remote branches
   */
  async listRemoteBranches() {
    try {
      const output = await this.executeGitCommand(['branch', '-r']);
      const branches = [];
      
      for (const line of output.split('\n')) {
        const branch = line.trim();
        if (branch && !branch.includes('->')) {
          branches.push({
            name: branch,
            remote: true
          });
        }
      }
      
      return branches;
      
    } catch (error) {
      throw new Error(`Failed to list remote branches: ${error.message}`);
    }
  }
  
  /**
   * Generate branch name based on strategy
   */
  generateBranchName(context = {}) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    
    switch (this.branchStrategy) {
      case 'main':
        return this.defaultBranch;
      
      case 'feature':
        const featureName = context.feature || context.phase || 'feature';
        const sanitized = this.sanitizeBranchName(featureName);
        return this.branchPrefix ? `${this.branchPrefix}/${sanitized}` : `feature/${sanitized}`;
      
      case 'timestamp':
        const prefix = context.prefix || 'branch';
        return `${prefix}-${timestamp}`;
      
      case 'phase':
        const phase = context.phase || 'phase';
        const sanitizedPhase = this.sanitizeBranchName(phase);
        return `${sanitizedPhase}-${timestamp.slice(-5)}`;
      
      default:
        return `branch-${timestamp}`;
    }
  }
  
  /**
   * Validate branch name
   */
  validateBranchName(name) {
    if (!name || typeof name !== 'string') {
      throw new Error('Branch name must be a non-empty string');
    }
    
    // Check length
    if (name.length > this.namingConfig.maxLength) {
      throw new Error(`Branch name too long (max ${this.namingConfig.maxLength} characters)`);
    }
    
    // Check for reserved names (before sanitization)
    if (this.namingConfig.reservedNames.includes(name.toLowerCase())) {
      throw new Error(`Branch name '${name}' is reserved`);
    }
    
    // Sanitize the name first
    const sanitized = this.sanitizeBranchName(name);
    
    // Check for invalid characters after sanitization
    if (!this.namingConfig.allowedChars.test(sanitized)) {
      throw new Error(`Branch name contains invalid characters: ${name}`);
    }
    
    return sanitized;
  }
  
  /**
   * Sanitize branch name
   */
  sanitizeBranchName(name) {
    return name
      .toLowerCase()
      .replace(this.namingConfig.illegalChars, '-')
      .replace(/^-+|-+$/g, '') // Remove leading/trailing dashes
      .replace(/-+/g, '-'); // Collapse multiple dashes
  }
  
  /**
   * Set upstream tracking for a branch
   */
  async setUpstreamTracking(branchName, upstream) {
    try {
      await this.executeGitCommand(['branch', '--set-upstream-to', upstream, branchName]);
      
      this.emit('upstreamSet', { branch: branchName, upstream });
      
      return { success: true, branch: branchName, upstream };
      
    } catch (error) {
      throw new Error(`Failed to set upstream for '${branchName}': ${error.message}`);
    }
  }
  
  /**
   * Delete remote branch
   */
  async deleteRemoteBranch(branchName) {
    try {
      const remoteName = this.repositoryManager.remoteName || 'origin';
      await this.executeGitCommand(['push', remoteName, '--delete', branchName]);
      
      this.emit('remoteBranchDeleted', { branch: branchName, remote: remoteName });
      
      return { success: true, branch: branchName, remote: remoteName };
      
    } catch (error) {
      throw new Error(`Failed to delete remote branch '${branchName}': ${error.message}`);
    }
  }
  
  /**
   * Merge branch into current branch
   */
  async mergeBranch(branchName, options = {}) {
    try {
      const mergeArgs = ['merge'];
      
      if (options.noFastForward) {
        mergeArgs.push('--no-ff');
      }
      
      if (options.strategy) {
        mergeArgs.push('--strategy', options.strategy);
      }
      
      if (options.message) {
        mergeArgs.push('-m', options.message);
      }
      
      mergeArgs.push(branchName);
      
      const output = await this.executeGitCommand(mergeArgs);
      
      this.emit('branchMerged', {
        branch: branchName,
        into: this.currentBranch?.name,
        strategy: options.strategy
      });
      
      return {
        success: true,
        merged: branchName,
        into: this.currentBranch?.name,
        output
      };
      
    } catch (error) {
      this.emit('mergeFailed', {
        branch: branchName,
        error: error.message
      });
      
      throw new Error(`Failed to merge branch '${branchName}': ${error.message}`);
    }
  }
  
  /**
   * Create and switch to branch based on strategy
   */
  async createStrategyBranch(context = {}) {
    let branchName = this.generateBranchName(context);
    
    // Check if branch already exists
    const exists = await this.branchExists(branchName);
    if (exists) {
      // Generate unique name if branch exists
      branchName = this.generateUniqueBranchName(branchName);
    }
    
    return await this.createBranch(branchName, context.options);
  }
  
  /**
   * Check if branch exists
   */
  async branchExists(branchName) {
    try {
      await this.executeGitCommand(['rev-parse', '--verify', branchName]);
      return true;
    } catch (error) {
      return false;
    }
  }
  
  /**
   * Generate unique branch name
   */
  generateUniqueBranchName(baseName) {
    const timestamp = Date.now().toString().slice(-6);
    return `${baseName}-${timestamp}`;
  }
  
  /**
   * Get branch status and information
   */
  async getBranchStatus() {
    await this.loadBranchInfo();
    
    return {
      current: this.currentBranch,
      branches: this.branches,
      remoteBranches: this.remoteBranches,
      strategy: this.branchStrategy,
      defaultBranch: this.defaultBranch
    };
  }
  
  /**
   * Execute Git command
   */
  async executeGitCommand(args, options = {}) {
    return new Promise((resolve, reject) => {
      const gitProcess = spawn('git', args, {
        cwd: this.repositoryManager.workingDirectory,
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
   * Get branch manager status
   */
  getStatus() {
    return {
      initialized: this.initialized,
      currentBranch: this.currentBranch,
      branchStrategy: this.branchStrategy,
      branchCount: this.branches.length,
      remoteBranchCount: this.remoteBranches.length
    };
  }
  
  /**
   * Check if branch manager is initialized
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

export default BranchManager;