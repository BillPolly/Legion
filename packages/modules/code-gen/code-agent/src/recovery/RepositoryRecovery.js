/**
 * RepositoryRecovery - Repository state recovery and repair system
 * 
 * Handles repository corruption detection, state repair, backup/restore
 * operations, and emergency recovery procedures.
 */

import { EventEmitter } from 'events';
import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';

class RepositoryRecovery extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = {
      enableAutoBackup: config.enableAutoBackup !== false,
      backupInterval: config.backupInterval || 3600000, // 1 hour
      maxBackups: config.maxBackups || 5,
      enableCorruptionCheck: config.enableCorruptionCheck !== false,
      enableMetrics: config.enableMetrics !== false,
      backupDirectory: config.backupDirectory || '.git-backups',
      ...config
    };
    
    this.repositoryPath = null;
    this.backupTimer = null;
    
    // Recovery strategies
    this.recoveryStrategies = {
      corruption: this.recoverFromCorruption.bind(this),
      missing: this.recoverFromMissing.bind(this),
      permission: this.recoverFromPermission.bind(this),
      config: this.recoverFromConfig.bind(this),
      refs: this.recoverFromRefs.bind(this),
      objects: this.recoverFromObjects.bind(this),
      index: this.recoverFromIndex.bind(this)
    };
    
    // Health check patterns
    this.healthChecks = {
      gitDirectory: this.checkGitDirectory.bind(this),
      gitConfig: this.checkGitConfig.bind(this),
      gitRefs: this.checkGitRefs.bind(this),
      gitObjects: this.checkGitObjects.bind(this),
      gitIndex: this.checkGitIndex.bind(this),
      gitHooks: this.checkGitHooks.bind(this),
      permissions: this.checkPermissions.bind(this)
    };
    
    // Metrics
    this.metrics = {
      backupsCreated: 0,
      backupsRestored: 0,
      corruptionDetected: 0,
      repairsSuccessful: 0,
      repairsFailed: 0,
      healthChecksRun: 0
    };
    
    this.initialized = false;
  }
  
  /**
   * Initialize the recovery system
   */
  async initialize(repositoryPath) {
    if (this.initialized) {
      return;
    }
    
    this.repositoryPath = repositoryPath;
    
    // Create backup directory
    const backupPath = path.join(repositoryPath, this.config.backupDirectory);
    try {
      await fs.mkdir(backupPath, { recursive: true });
    } catch (error) {
      // Backup directory creation failed, disable auto backup
      this.config.enableAutoBackup = false;
    }
    
    // Start automatic backup if enabled
    if (this.config.enableAutoBackup) {
      this.startAutoBackup();
    }
    
    this.initialized = true;
    
    this.emit('initialized', {
      repositoryPath,
      autoBackup: this.config.enableAutoBackup,
      timestamp: new Date().toISOString()
    });
  }
  
  /**
   * Perform comprehensive repository health check
   */
  async performHealthCheck() {
    if (!this.initialized) {
      throw new Error('RepositoryRecovery not initialized');
    }
    
    this.metrics.healthChecksRun++;
    
    const healthReport = {
      overall: 'healthy',
      checks: {},
      issues: [],
      recommendations: [],
      timestamp: new Date().toISOString()
    };
    
    // Run all health checks
    for (const [checkName, checkFunction] of Object.entries(this.healthChecks)) {
      try {
        const result = await checkFunction();
        healthReport.checks[checkName] = result;
        
        if (!result.healthy) {
          healthReport.overall = result.severity === 'critical' ? 'critical' : 'warning';
          healthReport.issues.push({
            check: checkName,
            severity: result.severity,
            message: result.message,
            details: result.details
          });
          
          if (result.recommendation) {
            healthReport.recommendations.push({
              check: checkName,
              action: result.recommendation
            });
          }
        }
      } catch (error) {
        healthReport.checks[checkName] = {
          healthy: false,
          severity: 'error',
          message: `Health check failed: ${error.message}`,
          error: error.message
        };
        
        healthReport.overall = 'critical';
        healthReport.issues.push({
          check: checkName,
          severity: 'error',
          message: `Health check error: ${error.message}`
        });
      }
    }
    
    this.emit('health-check-complete', healthReport);
    
    return healthReport;
  }
  
  /**
   * Attempt to repair repository issues
   */
  async repairRepository(issues = null) {
    if (!this.initialized) {
      throw new Error('RepositoryRecovery not initialized');
    }
    
    // If no specific issues provided, run health check first
    if (!issues) {
      const healthReport = await this.performHealthCheck();
      issues = healthReport.issues;
    }
    
    if (!Array.isArray(issues)) {
      issues = [issues];
    }
    
    const repairResults = {
      success: true,
      repairsAttempted: 0,
      repairsSuccessful: 0,
      repairsFailed: 0,
      details: [],
      timestamp: new Date().toISOString()
    };
    
    for (const issue of issues) {
      repairResults.repairsAttempted++;
      
      try {
        const strategy = this.determineRepairStrategy(issue);
        
        if (strategy) {
          this.emit('repair-start', {
            issue: issue.check,
            strategy,
            timestamp: new Date().toISOString()
          });
          
          const result = await strategy(issue);
          
          if (result.success) {
            repairResults.repairsSuccessful++;
            this.metrics.repairsSuccessful++;
            
            repairResults.details.push({
              issue: issue.check,
              strategy,
              success: true,
              action: result.action,
              message: result.message
            });
            
            this.emit('repair-success', {
              issue: issue.check,
              strategy,
              result,
              timestamp: new Date().toISOString()
            });
          } else {
            repairResults.repairsFailed++;
            this.metrics.repairsFailed++;
            repairResults.success = false;
            
            repairResults.details.push({
              issue: issue.check,
              strategy,
              success: false,
              error: result.error,
              message: result.message
            });
            
            this.emit('repair-failed', {
              issue: issue.check,
              strategy,
              result,
              timestamp: new Date().toISOString()
            });
          }
        } else {
          repairResults.repairsFailed++;
          repairResults.success = false;
          
          repairResults.details.push({
            issue: issue.check,
            success: false,
            error: 'No repair strategy available',
            message: `No repair strategy found for ${issue.check}`
          });
        }
      } catch (error) {
        repairResults.repairsFailed++;
        repairResults.success = false;
        
        repairResults.details.push({
          issue: issue.check,
          success: false,
          error: error.message,
          message: `Repair attempt failed: ${error.message}`
        });
      }
    }
    
    return repairResults;
  }
  
  /**
   * Create repository backup
   */
  async createBackup(name = null) {
    if (!this.initialized) {
      throw new Error('RepositoryRecovery not initialized');
    }
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupName = name || `backup-${timestamp}`;
    const backupPath = path.join(this.repositoryPath, this.config.backupDirectory, backupName);
    
    try {
      // Create backup directory
      await fs.mkdir(backupPath, { recursive: true });
      
      // Copy .git directory
      await this.copyDirectory(
        path.join(this.repositoryPath, '.git'),
        path.join(backupPath, '.git')
      );
      
      // Create backup metadata
      const metadata = {
        name: backupName,
        timestamp: new Date().toISOString(),
        repositoryPath: this.repositoryPath,
        version: '1.0.0'
      };
      
      await fs.writeFile(
        path.join(backupPath, 'backup-metadata.json'),
        JSON.stringify(metadata, null, 2)
      );
      
      this.metrics.backupsCreated++;
      
      // Clean up old backups
      await this.cleanupOldBackups();
      
      this.emit('backup-created', {
        name: backupName,
        path: backupPath,
        timestamp: new Date().toISOString()
      });
      
      return {
        success: true,
        name: backupName,
        path: backupPath,
        metadata
      };
      
    } catch (error) {
      this.emit('backup-failed', {
        name: backupName,
        error: error.message,
        timestamp: new Date().toISOString()
      });
      
      return {
        success: false,
        error: error.message
      };
    }
  }
  
  /**
   * Restore repository from backup
   */
  async restoreFromBackup(backupName) {
    if (!this.initialized) {
      throw new Error('RepositoryRecovery not initialized');
    }
    
    const backupPath = path.join(this.repositoryPath, this.config.backupDirectory, backupName);
    
    try {
      // Check if backup exists
      const backupExists = await this.pathExists(backupPath);
      if (!backupExists) {
        throw new Error(`Backup ${backupName} not found`);
      }
      
      // Load backup metadata
      const metadataPath = path.join(backupPath, 'backup-metadata.json');
      const metadata = JSON.parse(await fs.readFile(metadataPath, 'utf8'));
      
      // Create current state backup before restore
      const preRestoreBackup = await this.createBackup(`pre-restore-${Date.now()}`);
      
      // Remove current .git directory
      const gitPath = path.join(this.repositoryPath, '.git');
      await fs.rm(gitPath, { recursive: true, force: true });
      
      // Restore .git directory from backup
      await this.copyDirectory(
        path.join(backupPath, '.git'),
        gitPath
      );
      
      this.metrics.backupsRestored++;
      
      this.emit('backup-restored', {
        name: backupName,
        metadata,
        preRestoreBackup: preRestoreBackup.name,
        timestamp: new Date().toISOString()
      });
      
      return {
        success: true,
        name: backupName,
        metadata,
        preRestoreBackup: preRestoreBackup.name
      };
      
    } catch (error) {
      this.emit('restore-failed', {
        name: backupName,
        error: error.message,
        timestamp: new Date().toISOString()
      });
      
      return {
        success: false,
        error: error.message
      };
    }
  }
  
  /**
   * List available backups
   */
  async listBackups() {
    if (!this.initialized) {
      throw new Error('RepositoryRecovery not initialized');
    }
    
    const backupDir = path.join(this.repositoryPath, this.config.backupDirectory);
    
    try {
      const entries = await fs.readdir(backupDir, { withFileTypes: true });
      const backups = [];
      
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const metadataPath = path.join(backupDir, entry.name, 'backup-metadata.json');
          
          try {
            const metadata = JSON.parse(await fs.readFile(metadataPath, 'utf8'));
            backups.push({
              name: entry.name,
              ...metadata
            });
          } catch (error) {
            // Invalid backup, skip
          }
        }
      }
      
      // Sort by timestamp (newest first)
      backups.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      
      return backups;
      
    } catch (error) {
      return [];
    }
  }
  
  // Health check implementations
  
  async checkGitDirectory() {
    const gitPath = path.join(this.repositoryPath, '.git');
    const exists = await this.pathExists(gitPath);
    
    if (!exists) {
      return {
        healthy: false,
        severity: 'critical',
        message: '.git directory missing',
        recommendation: 'reinitialize-repository'
      };
    }
    
    const stats = await fs.stat(gitPath);
    if (!stats.isDirectory()) {
      return {
        healthy: false,
        severity: 'critical',
        message: '.git is not a directory',
        recommendation: 'remove-and-reinitialize'
      };
    }
    
    return {
      healthy: true,
      message: '.git directory present and valid'
    };
  }
  
  async checkGitConfig() {
    const configPath = path.join(this.repositoryPath, '.git', 'config');
    const exists = await this.pathExists(configPath);
    
    if (!exists) {
      return {
        healthy: false,
        severity: 'warning',
        message: 'Git config file missing',
        recommendation: 'recreate-config'
      };
    }
    
    try {
      const configContent = await fs.readFile(configPath, 'utf8');
      if (configContent.trim().length === 0) {
        return {
          healthy: false,
          severity: 'warning',
          message: 'Git config file empty',
          recommendation: 'recreate-config'
        };
      }
      
      return {
        healthy: true,
        message: 'Git config file present and non-empty'
      };
    } catch (error) {
      return {
        healthy: false,
        severity: 'warning',
        message: `Git config file unreadable: ${error.message}`,
        recommendation: 'recreate-config'
      };
    }
  }
  
  async checkGitRefs() {
    const refsPath = path.join(this.repositoryPath, '.git', 'refs');
    const exists = await this.pathExists(refsPath);
    
    if (!exists) {
      return {
        healthy: false,
        severity: 'warning',
        message: 'Git refs directory missing',
        recommendation: 'recreate-refs'
      };
    }
    
    const headsPath = path.join(refsPath, 'heads');
    const headsExists = await this.pathExists(headsPath);
    
    if (!headsExists) {
      return {
        healthy: false,
        severity: 'warning',
        message: 'Git refs/heads directory missing',
        recommendation: 'recreate-refs'
      };
    }
    
    return {
      healthy: true,
      message: 'Git refs structure present'
    };
  }
  
  async checkGitObjects() {
    const objectsPath = path.join(this.repositoryPath, '.git', 'objects');
    const exists = await this.pathExists(objectsPath);
    
    if (!exists) {
      return {
        healthy: false,
        severity: 'critical',
        message: 'Git objects directory missing',
        recommendation: 'restore-objects'
      };
    }
    
    // Check for basic object directories
    const infoPath = path.join(objectsPath, 'info');
    const packPath = path.join(objectsPath, 'pack');
    
    const infoExists = await this.pathExists(infoPath);
    const packExists = await this.pathExists(packPath);
    
    if (!infoExists || !packExists) {
      return {
        healthy: false,
        severity: 'warning',
        message: 'Git objects structure incomplete',
        recommendation: 'recreate-object-structure'
      };
    }
    
    return {
      healthy: true,
      message: 'Git objects directory structure present'
    };
  }
  
  async checkGitIndex() {
    const indexPath = path.join(this.repositoryPath, '.git', 'index');
    const exists = await this.pathExists(indexPath);
    
    if (!exists) {
      return {
        healthy: false,
        severity: 'warning',
        message: 'Git index file missing',
        recommendation: 'recreate-index'
      };
    }
    
    try {
      const stats = await fs.stat(indexPath);
      if (stats.size === 0) {
        return {
          healthy: false,
          severity: 'warning',
          message: 'Git index file empty',
          recommendation: 'recreate-index'
        };
      }
      
      return {
        healthy: true,
        message: 'Git index file present and non-empty'
      };
    } catch (error) {
      return {
        healthy: false,
        severity: 'warning',
        message: `Git index file error: ${error.message}`,
        recommendation: 'recreate-index'
      };
    }
  }
  
  async checkGitHooks() {
    const hooksPath = path.join(this.repositoryPath, '.git', 'hooks');
    const exists = await this.pathExists(hooksPath);
    
    if (!exists) {
      return {
        healthy: false,
        severity: 'info',
        message: 'Git hooks directory missing',
        recommendation: 'create-hooks-directory'
      };
    }
    
    return {
      healthy: true,
      message: 'Git hooks directory present'
    };
  }
  
  async checkPermissions() {
    try {
      // Test read access
      await fs.access(this.repositoryPath, fs.constants.R_OK);
      
      // Test write access
      await fs.access(this.repositoryPath, fs.constants.W_OK);
      
      // Test .git directory access
      const gitPath = path.join(this.repositoryPath, '.git');
      const gitExists = await this.pathExists(gitPath);
      
      if (gitExists) {
        await fs.access(gitPath, fs.constants.R_OK | fs.constants.W_OK);
      }
      
      return {
        healthy: true,
        message: 'Repository permissions are correct'
      };
    } catch (error) {
      return {
        healthy: false,
        severity: 'critical',
        message: `Permission error: ${error.message}`,
        recommendation: 'fix-permissions'
      };
    }
  }
  
  // Recovery strategy implementations
  
  async recoverFromCorruption(issue) {
    // Attempt to recover from the latest backup
    const backups = await this.listBackups();
    
    if (backups.length > 0) {
      const latestBackup = backups[0];
      const restoreResult = await this.restoreFromBackup(latestBackup.name);
      
      if (restoreResult.success) {
        return {
          success: true,
          action: 'restored-from-backup',
          message: `Restored from backup: ${latestBackup.name}`
        };
      }
    }
    
    // If no backup available, try to reinitialize
    return await this.recoverFromMissing(issue);
  }
  
  async recoverFromMissing(issue) {
    try {
      // Reinitialize git repository
      await this.executeGitCommand(['init'], this.repositoryPath);
      
      return {
        success: true,
        action: 'reinitialized-repository',
        message: 'Repository reinitialized'
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        message: `Failed to reinitialize repository: ${error.message}`
      };
    }
  }
  
  async recoverFromPermission(issue) {
    try {
      // Attempt to fix permissions
      await this.executeCommand(['chmod', '-R', '755', this.repositoryPath]);
      
      return {
        success: true,
        action: 'fixed-permissions',
        message: 'Repository permissions fixed'
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        message: `Failed to fix permissions: ${error.message}`
      };
    }
  }
  
  async recoverFromConfig(issue) {
    try {
      // Recreate basic git config
      const configPath = path.join(this.repositoryPath, '.git', 'config');
      const basicConfig = `[core]
    repositoryformatversion = 0
    filemode = true
    bare = false
    logallrefupdates = true
`;
      
      await fs.writeFile(configPath, basicConfig);
      
      return {
        success: true,
        action: 'recreated-config',
        message: 'Git config file recreated'
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        message: `Failed to recreate config: ${error.message}`
      };
    }
  }
  
  async recoverFromRefs(issue) {
    try {
      // Recreate refs structure
      const refsPath = path.join(this.repositoryPath, '.git', 'refs');
      const headsPath = path.join(refsPath, 'heads');
      const tagsPath = path.join(refsPath, 'tags');
      const remotesPath = path.join(refsPath, 'remotes');
      
      await fs.mkdir(refsPath, { recursive: true });
      await fs.mkdir(headsPath, { recursive: true });
      await fs.mkdir(tagsPath, { recursive: true });
      await fs.mkdir(remotesPath, { recursive: true });
      
      return {
        success: true,
        action: 'recreated-refs',
        message: 'Git refs structure recreated'
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        message: `Failed to recreate refs: ${error.message}`
      };
    }
  }
  
  async recoverFromObjects(issue) {
    try {
      // Recreate objects structure
      const objectsPath = path.join(this.repositoryPath, '.git', 'objects');
      const infoPath = path.join(objectsPath, 'info');
      const packPath = path.join(objectsPath, 'pack');
      
      await fs.mkdir(objectsPath, { recursive: true });
      await fs.mkdir(infoPath, { recursive: true });
      await fs.mkdir(packPath, { recursive: true });
      
      return {
        success: true,
        action: 'recreated-objects',
        message: 'Git objects structure recreated'
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        message: `Failed to recreate objects: ${error.message}`
      };
    }
  }
  
  async recoverFromIndex(issue) {
    try {
      // Reset the index
      await this.executeGitCommand(['reset'], this.repositoryPath);
      
      return {
        success: true,
        action: 'reset-index',
        message: 'Git index reset'
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        message: `Failed to reset index: ${error.message}`
      };
    }
  }
  
  // Utility methods
  
  determineRepairStrategy(issue) {
    const { check } = issue;
    
    if (check.includes('git') && check.includes('Directory')) {
      return this.recoveryStrategies.missing;
    }
    if (check.includes('config')) {
      return this.recoveryStrategies.config;
    }
    if (check.includes('refs')) {
      return this.recoveryStrategies.refs;
    }
    if (check.includes('objects')) {
      return this.recoveryStrategies.objects;
    }
    if (check.includes('index')) {
      return this.recoveryStrategies.index;
    }
    if (check.includes('permissions')) {
      return this.recoveryStrategies.permission;
    }
    
    return this.recoveryStrategies.corruption; // Default to corruption recovery
  }
  
  async executeGitCommand(args, cwd) {
    return new Promise((resolve, reject) => {
      const git = spawn('git', args, { cwd });
      let stdout = '';
      let stderr = '';
      
      git.stdout.on('data', (data) => {
        stdout += data.toString();
      });
      
      git.stderr.on('data', (data) => {
        stderr += data.toString();
      });
      
      git.on('close', (code) => {
        if (code === 0) {
          resolve({ stdout, stderr });
        } else {
          reject(new Error(`Git command failed: ${stderr || stdout}`));
        }
      });
    });
  }
  
  async executeCommand(args) {
    return new Promise((resolve, reject) => {
      const cmd = spawn(args[0], args.slice(1));
      let stdout = '';
      let stderr = '';
      
      cmd.stdout.on('data', (data) => {
        stdout += data.toString();
      });
      
      cmd.stderr.on('data', (data) => {
        stderr += data.toString();
      });
      
      cmd.on('close', (code) => {
        if (code === 0) {
          resolve({ stdout, stderr });
        } else {
          reject(new Error(`Command failed: ${stderr || stdout}`));
        }
      });
    });
  }
  
  async pathExists(path) {
    try {
      await fs.access(path);
      return true;
    } catch (error) {
      return false;
    }
  }
  
  async copyDirectory(src, dest) {
    const stats = await fs.stat(src);
    
    if (stats.isDirectory()) {
      await fs.mkdir(dest, { recursive: true });
      const entries = await fs.readdir(src);
      
      for (const entry of entries) {
        await this.copyDirectory(
          path.join(src, entry),
          path.join(dest, entry)
        );
      }
    } else {
      await fs.copyFile(src, dest);
    }
  }
  
  startAutoBackup() {
    if (this.backupTimer) {
      clearInterval(this.backupTimer);
    }
    
    this.backupTimer = setInterval(async () => {
      try {
        await this.createBackup();
      } catch (error) {
        this.emit('auto-backup-failed', {
          error: error.message,
          timestamp: new Date().toISOString()
        });
      }
    }, this.config.backupInterval);
  }
  
  async cleanupOldBackups() {
    const backups = await this.listBackups();
    
    if (backups.length > this.config.maxBackups) {
      const backupsToDelete = backups.slice(this.config.maxBackups);
      
      for (const backup of backupsToDelete) {
        try {
          const backupPath = path.join(
            this.repositoryPath,
            this.config.backupDirectory,
            backup.name
          );
          await fs.rm(backupPath, { recursive: true, force: true });
          
          this.emit('backup-deleted', {
            name: backup.name,
            timestamp: new Date().toISOString()
          });
        } catch (error) {
          // Continue with other deletions
        }
      }
    }
  }
  
  getMetrics() {
    return { ...this.metrics };
  }
  
  async cleanup() {
    if (this.backupTimer) {
      clearInterval(this.backupTimer);
      this.backupTimer = null;
    }
    
    this.removeAllListeners();
  }
}

export default RepositoryRecovery;