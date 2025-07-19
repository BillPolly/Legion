/**
 * CommitOrchestrator - Intelligent commit management and orchestration
 * 
 * Manages the entire commit lifecycle including staging, message generation,
 * commit creation, and validation with AI-powered intelligence.
 */

import EventEmitter from 'events';
import { spawn } from 'child_process';

class CommitOrchestrator extends EventEmitter {
  constructor(repositoryManager, config) {
    super();
    
    this.repositoryManager = repositoryManager;
    this.config = config;
    this.initialized = false;
    
    // Commit configuration
    this.commitConfig = {
      generateMessages: config.generateMessages !== false,
      messageFormat: config.messageFormat || 'conventional',
      signCommits: config.signCommits || false,
      maxMessageLength: config.maxMessageLength || 72,
      includeEmoji: config.includeEmoji || false,
      autoStage: config.autoStage || false
    };
    
    // Staged files tracking
    this.stagedFiles = new Set();
    this.pendingChanges = new Map();
    
    // Commit statistics
    this.commitStats = {
      totalCommits: 0,
      generatedMessages: 0,
      autoStagedFiles: 0,
      failedCommits: 0
    };
  }
  
  async initialize() {
    if (this.initialized) {
      return;
    }
    
    if (!this.repositoryManager.isInitialized()) {
      throw new Error('RepositoryManager must be initialized first');
    }
    
    // Load current staging area state
    await this.loadStagingAreaState();
    
    this.initialized = true;
    this.emit('initialized', {
      commitConfig: this.commitConfig,
      stagedFiles: this.stagedFiles.size
    });
  }
  
  /**
   * Load current staging area state
   */
  async loadStagingAreaState() {
    try {
      const status = await this.executeGitCommand(['status', '--porcelain']);
      this.parseStagingAreaStatus(status);
      
      this.emit('stagingAreaLoaded', {
        stagedCount: this.stagedFiles.size,
        pendingCount: this.pendingChanges.size
      });
    } catch (error) {
      this.emit('error', new Error(`Failed to load staging area: ${error.message}`));
    }
  }
  
  /**
   * Parse git status output
   */
  parseStagingAreaStatus(statusOutput) {
    this.stagedFiles.clear();
    this.pendingChanges.clear();
    
    const lines = statusOutput.split('\n').filter(line => line.trim());
    
    for (const line of lines) {
      const status = line.substring(0, 2);
      const file = line.substring(3).trim();
      
      // Check if file is staged
      if (status[0] !== ' ' && status[0] !== '?') {
        this.stagedFiles.add(file);
      }
      
      // Check if file has unstaged changes
      if (status[1] !== ' ') {
        this.pendingChanges.set(file, {
          staged: status[0] !== ' ' && status[0] !== '?',
          unstaged: status[1] !== ' ',
          untracked: status[0] === '?'
        });
      }
    }
  }
  
  /**
   * Stage files for commit
   */
  async stageFiles(files, options = {}) {
    if (!Array.isArray(files) || files.length === 0) {
      throw new Error('Files must be a non-empty array');
    }
    
    const results = {
      staged: [],
      failed: [],
      alreadyStaged: []
    };
    
    for (const file of files) {
      if (this.stagedFiles.has(file)) {
        results.alreadyStaged.push(file);
        continue;
      }
      
      try {
        await this.executeGitCommand(['add', file]);
        this.stagedFiles.add(file);
        results.staged.push(file);
        
        if (this.commitConfig.autoStage) {
          this.commitStats.autoStagedFiles++;
        }
      } catch (error) {
        results.failed.push({ file, error: error.message });
      }
    }
    
    this.emit('filesStaged', results);
    
    return results;
  }
  
  /**
   * Unstage files
   */
  async unstageFiles(files) {
    if (!Array.isArray(files) || files.length === 0) {
      throw new Error('Files must be a non-empty array');
    }
    
    const results = {
      unstaged: [],
      failed: []
    };
    
    for (const file of files) {
      try {
        await this.executeGitCommand(['reset', 'HEAD', file]);
        this.stagedFiles.delete(file);
        results.unstaged.push(file);
      } catch (error) {
        results.failed.push({ file, error: error.message });
      }
    }
    
    this.emit('filesUnstaged', results);
    
    return results;
  }
  
  /**
   * Create a commit with optional message generation
   */
  async createCommit(message, options = {}) {
    if (!message && !this.commitConfig.generateMessages) {
      throw new Error('Commit message is required when message generation is disabled');
    }
    
    // Check if there are staged files
    if (this.stagedFiles.size === 0) {
      throw new Error('No files staged for commit');
    }
    
    try {
      // Generate message if needed
      if (!message && this.commitConfig.generateMessages) {
        message = await this.generateCommitMessage(options);
        this.commitStats.generatedMessages++;
      }
      
      // Validate message
      this.validateCommitMessage(message);
      
      // Create commit
      const commitArgs = ['commit', '-m', message];
      
      if (this.commitConfig.signCommits) {
        commitArgs.push('-S');
      }
      
      if (options.noVerify) {
        commitArgs.push('--no-verify');
      }
      
      const result = await this.executeGitCommand(commitArgs);
      
      // Parse commit result
      const commitInfo = this.parseCommitResult(result);
      
      // Update stats
      this.commitStats.totalCommits++;
      
      // Clear staged files
      this.stagedFiles.clear();
      
      this.emit('commitCreated', {
        ...commitInfo,
        message,
        options
      });
      
      return {
        success: true,
        ...commitInfo,
        message
      };
      
    } catch (error) {
      this.commitStats.failedCommits++;
      this.emit('commitFailed', { error: error.message, message });
      throw new Error(`Failed to create commit: ${error.message}`);
    }
  }
  
  /**
   * Generate intelligent commit message
   */
  async generateCommitMessage(context = {}) {
    // Get staged changes
    const stagedChanges = await this.analyzeStagedChanges();
    
    // Determine commit type
    const commitType = this.determineCommitType(stagedChanges, context);
    
    // Generate message based on format
    let message;
    switch (this.commitConfig.messageFormat) {
      case 'conventional':
        message = this.generateConventionalMessage(commitType, stagedChanges, context);
        break;
      case 'descriptive':
        message = this.generateDescriptiveMessage(stagedChanges, context);
        break;
      case 'simple':
      default:
        message = this.generateSimpleMessage(stagedChanges, context);
    }
    
    // Add emoji if configured
    if (this.commitConfig.includeEmoji) {
      message = this.addCommitEmoji(commitType) + ' ' + message;
    }
    
    return message;
  }
  
  /**
   * Analyze staged changes
   */
  async analyzeStagedChanges() {
    const diffOutput = await this.executeGitCommand(['diff', '--cached', '--name-status']);
    const changes = {
      added: [],
      modified: [],
      deleted: [],
      renamed: [],
      totalFiles: this.stagedFiles.size
    };
    
    const lines = diffOutput.split('\n').filter(line => line.trim());
    
    for (const line of lines) {
      const [status, ...fileParts] = line.split('\t');
      const file = fileParts.join('\t');
      
      switch (status) {
        case 'A':
          changes.added.push(file);
          break;
        case 'M':
          changes.modified.push(file);
          break;
        case 'D':
          changes.deleted.push(file);
          break;
        case 'R':
          changes.renamed.push(file);
          break;
      }
    }
    
    return changes;
  }
  
  /**
   * Determine commit type from changes
   */
  determineCommitType(changes, context) {
    if (context.type) {
      return context.type;
    }
    
    // Analyze file patterns
    const hasTests = [...this.stagedFiles].some(f => f.includes('test') || f.includes('spec'));
    const hasDocs = [...this.stagedFiles].some(f => f.includes('README') || f.includes('docs/'));
    const hasConfig = [...this.stagedFiles].some(f => f.includes('config') || f.endsWith('.json'));
    
    // Determine type based on changes
    if (changes.added.length > 0 && changes.modified.length === 0) {
      return hasTests ? 'test' : 'feat';
    }
    
    if (changes.deleted.length > 0 && changes.added.length === 0) {
      return 'remove';
    }
    
    if (hasDocs) {
      return 'docs';
    }
    
    if (hasConfig) {
      return 'chore';
    }
    
    if (hasTests) {
      return 'test';
    }
    
    // Default to fix for modifications
    return changes.modified.length > 0 ? 'fix' : 'feat';
  }
  
  /**
   * Generate conventional commit message
   */
  generateConventionalMessage(type, changes, context) {
    const scope = context.scope || this.inferScope(changes);
    const description = context.description || this.generateDescription(changes);
    
    let message = type;
    if (scope) {
      message += `(${scope})`;
    }
    message += `: ${description}`;
    
    // Add body if needed
    if (context.body || changes.totalFiles > 3) {
      message += '\n\n';
      message += context.body || this.generateCommitBody(changes);
    }
    
    // Add breaking change footer if needed
    if (context.breaking) {
      message += '\n\nBREAKING CHANGE: ' + context.breaking;
    }
    
    return message;
  }
  
  /**
   * Generate descriptive commit message
   */
  generateDescriptiveMessage(changes, context) {
    const action = this.determineAction(changes);
    const target = this.determineTarget(changes);
    const reason = context.reason || '';
    
    let message = `${action} ${target}`;
    if (reason) {
      message += ` to ${reason}`;
    }
    
    return message;
  }
  
  /**
   * Generate simple commit message
   */
  generateSimpleMessage(changes, context) {
    if (context.message) {
      return context.message;
    }
    
    const fileCount = changes.totalFiles;
    const actions = [];
    
    if (changes.added.length > 0) {
      actions.push(`Add ${changes.added.length} file${changes.added.length > 1 ? 's' : ''}`);
    }
    if (changes.modified.length > 0) {
      actions.push(`Update ${changes.modified.length} file${changes.modified.length > 1 ? 's' : ''}`);
    }
    if (changes.deleted.length > 0) {
      actions.push(`Remove ${changes.deleted.length} file${changes.deleted.length > 1 ? 's' : ''}`);
    }
    
    return actions.join(', ');
  }
  
  /**
   * Infer scope from file changes
   */
  inferScope(changes) {
    const allFiles = [...changes.added, ...changes.modified, ...changes.deleted];
    
    // Find common directory
    if (allFiles.length > 0) {
      const directories = allFiles.map(f => f.split('/')[0]).filter(d => d);
      const commonDir = this.findMostCommon(directories);
      
      if (commonDir && commonDir !== '.') {
        return commonDir;
      }
    }
    
    return null;
  }
  
  /**
   * Generate commit description
   */
  generateDescription(changes) {
    const totalChanges = changes.added.length + changes.modified.length + changes.deleted.length;
    
    if (totalChanges === 1) {
      const file = [...changes.added, ...changes.modified, ...changes.deleted][0];
      const fileName = file.split('/').pop();
      
      if (changes.added.length === 1) {
        return `add ${fileName}`;
      } else if (changes.modified.length === 1) {
        return `update ${fileName}`;
      } else {
        return `remove ${fileName}`;
      }
    }
    
    return `update ${totalChanges} files`;
  }
  
  /**
   * Generate commit body
   */
  generateCommitBody(changes) {
    const lines = [];
    
    if (changes.added.length > 0) {
      lines.push('Added files:');
      changes.added.forEach(f => lines.push(`- ${f}`));
    }
    
    if (changes.modified.length > 0) {
      if (lines.length > 0) lines.push('');
      lines.push('Modified files:');
      changes.modified.forEach(f => lines.push(`- ${f}`));
    }
    
    if (changes.deleted.length > 0) {
      if (lines.length > 0) lines.push('');
      lines.push('Deleted files:');
      changes.deleted.forEach(f => lines.push(`- ${f}`));
    }
    
    return lines.join('\n');
  }
  
  /**
   * Add emoji to commit message
   */
  addCommitEmoji(type) {
    const emojiMap = {
      feat: '✨',
      fix: '🐛',
      docs: '📝',
      style: '💄',
      refactor: '♻️',
      test: '✅',
      chore: '🔧',
      perf: '⚡',
      ci: '👷',
      build: '📦',
      remove: '🔥'
    };
    
    return emojiMap[type] || '🔨';
  }
  
  /**
   * Validate commit message
   */
  validateCommitMessage(message) {
    if (!message || typeof message !== 'string') {
      throw new Error('Commit message must be a non-empty string');
    }
    
    const lines = message.split('\n');
    const firstLine = lines[0];
    
    if (firstLine.length > this.commitConfig.maxMessageLength) {
      throw new Error(`First line of commit message exceeds ${this.commitConfig.maxMessageLength} characters`);
    }
    
    // Check for conventional format if required
    if (this.commitConfig.messageFormat === 'conventional') {
      const conventionalPattern = /^(\w+)(\(.+\))?: .+/;
      if (!conventionalPattern.test(firstLine)) {
        throw new Error('Commit message must follow conventional format: type(scope): description');
      }
    }
  }
  
  /**
   * Parse commit result
   */
  parseCommitResult(output) {
    const commitHashMatch = output.match(/\[[\w-]+ ([a-f0-9]+)\]/);
    const filesChangedMatch = output.match(/(\d+) file[s]? changed/);
    const insertionsMatch = output.match(/(\d+) insertion[s]?/);
    const deletionsMatch = output.match(/(\d+) deletion[s]?/);
    
    return {
      hash: commitHashMatch ? commitHashMatch[1] : null,
      branch: this.repositoryManager.currentBranch,
      filesChanged: filesChangedMatch ? parseInt(filesChangedMatch[1]) : 0,
      insertions: insertionsMatch ? parseInt(insertionsMatch[1]) : 0,
      deletions: deletionsMatch ? parseInt(deletionsMatch[1]) : 0,
      timestamp: new Date()
    };
  }
  
  /**
   * Amend last commit
   */
  async amendCommit(newMessage = null, options = {}) {
    const amendArgs = ['commit', '--amend'];
    
    if (newMessage) {
      amendArgs.push('-m', newMessage);
    } else if (!options.noEdit) {
      amendArgs.push('--no-edit');
    }
    
    if (options.noVerify) {
      amendArgs.push('--no-verify');
    }
    
    try {
      const result = await this.executeGitCommand(amendArgs);
      
      this.emit('commitAmended', {
        newMessage,
        options
      });
      
      return {
        success: true,
        output: result
      };
      
    } catch (error) {
      throw new Error(`Failed to amend commit: ${error.message}`);
    }
  }
  
  /**
   * Get commit history
   */
  async getCommitHistory(options = {}) {
    const logArgs = ['log'];
    
    if (options.limit) {
      logArgs.push(`-${options.limit}`);
    }
    
    if (options.oneline) {
      logArgs.push('--oneline');
    } else {
      logArgs.push('--pretty=format:%H|%an|%ae|%ad|%s', '--date=iso');
    }
    
    if (options.branch) {
      logArgs.push(options.branch);
    }
    
    try {
      const output = await this.executeGitCommand(logArgs);
      
      if (options.oneline) {
        return output.split('\n').filter(line => line.trim());
      }
      
      return output.split('\n').filter(line => line.trim()).map(line => {
        const [hash, author, email, date, subject] = line.split('|');
        return { hash, author, email, date: new Date(date), subject };
      });
      
    } catch (error) {
      throw new Error(`Failed to get commit history: ${error.message}`);
    }
  }
  
  /**
   * Find most common element in array
   */
  findMostCommon(arr) {
    if (arr.length === 0) return null;
    
    const counts = {};
    let maxCount = 0;
    let mostCommon = null;
    
    for (const item of arr) {
      counts[item] = (counts[item] || 0) + 1;
      if (counts[item] > maxCount) {
        maxCount = counts[item];
        mostCommon = item;
      }
    }
    
    return mostCommon;
  }
  
  /**
   * Determine action from changes
   */
  determineAction(changes) {
    if (changes.added.length > changes.modified.length && changes.added.length > changes.deleted.length) {
      return 'Add';
    }
    if (changes.deleted.length > changes.modified.length && changes.deleted.length > changes.added.length) {
      return 'Remove';
    }
    return 'Update';
  }
  
  /**
   * Determine target from changes
   */
  determineTarget(changes) {
    const allFiles = [...changes.added, ...changes.modified, ...changes.deleted];
    
    if (allFiles.length === 1) {
      return allFiles[0].split('/').pop();
    }
    
    // Find common pattern
    const extensions = allFiles.map(f => f.split('.').pop()).filter(e => e);
    const commonExt = this.findMostCommon(extensions);
    
    if (commonExt) {
      return `${allFiles.length} ${commonExt} files`;
    }
    
    return `${allFiles.length} files`;
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
   * Get orchestrator status
   */
  getStatus() {
    return {
      initialized: this.initialized,
      commitConfig: this.commitConfig,
      stagedFiles: this.stagedFiles.size,
      pendingChanges: this.pendingChanges.size,
      stats: this.commitStats
    };
  }
  
  /**
   * Check if orchestrator is initialized
   */
  isInitialized() {
    return this.initialized;
  }
  
  /**
   * Cleanup resources
   */
  async cleanup() {
    this.stagedFiles.clear();
    this.pendingChanges.clear();
    this.initialized = false;
    this.emit('cleanup');
  }
}

export default CommitOrchestrator;