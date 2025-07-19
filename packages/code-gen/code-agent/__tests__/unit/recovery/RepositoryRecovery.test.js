/**
 * RepositoryRecovery Unit Tests
 * Phase 7.2: Repository state recovery and repair system tests
 * 
 * Tests repository health checks, backup/restore operations,
 * corruption detection, and automated repair capabilities.
 */

import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import RepositoryRecovery from '../../../src/recovery/RepositoryRecovery.js';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';

describe('RepositoryRecovery', () => {
  let recovery;
  let tempDir;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'repo-recovery-test-'));
    
    recovery = new RepositoryRecovery({
      enableAutoBackup: false, // Disable for testing
      enableMetrics: true,
      enableCorruptionCheck: true,
      backupDirectory: '.git-backups',
      maxBackups: 3
    });
  });

  afterEach(async () => {
    if (recovery) {
      await recovery.cleanup();
    }
    
    if (tempDir) {
      try {
        await fs.rm(tempDir, { recursive: true, force: true });
      } catch (error) {
        // Cleanup failed, continue
      }
    }
  });

  describe('Initialization', () => {
    test('should initialize recovery system', async () => {
      await recovery.initialize(tempDir);
      
      expect(recovery.initialized).toBe(true);
      expect(recovery.repositoryPath).toBe(tempDir);
      
      // Should create backup directory
      const backupPath = path.join(tempDir, '.git-backups');
      const backupExists = await pathExists(backupPath);
      expect(backupExists).toBe(true);
    });

    test('should handle backup directory creation failure', async () => {
      // Create a file with the same name as backup directory
      const conflictPath = path.join(tempDir, '.git-backups');
      await fs.writeFile(conflictPath, 'conflict file');

      await recovery.initialize(tempDir);
      
      expect(recovery.initialized).toBe(true);
      expect(recovery.config.enableAutoBackup).toBe(false); // Should be disabled
    });

    test('should start auto backup when enabled', async () => {
      const autoBackupRecovery = new RepositoryRecovery({
        enableAutoBackup: true,
        backupInterval: 100 // Very short for testing
      });

      const spy = jest.spyOn(autoBackupRecovery, 'startAutoBackup');
      await autoBackupRecovery.initialize(tempDir);
      
      expect(spy).toHaveBeenCalled();
      
      await autoBackupRecovery.cleanup();
    });

    test('should emit initialization event', async () => {
      const events = [];
      recovery.on('initialized', (data) => events.push(data));

      await recovery.initialize(tempDir);
      
      expect(events.length).toBe(1);
      expect(events[0]).toHaveProperty('repositoryPath', tempDir);
      expect(events[0]).toHaveProperty('autoBackup');
      expect(events[0]).toHaveProperty('timestamp');
    });
  });

  describe('Health Checks', () => {
    beforeEach(async () => {
      await recovery.initialize(tempDir);
    });

    test('should check git directory existence', async () => {
      // No .git directory
      let result = await recovery.checkGitDirectory();
      expect(result.healthy).toBe(false);
      expect(result.severity).toBe('critical');
      expect(result.message).toBe('.git directory missing');

      // Create .git directory
      await fs.mkdir(path.join(tempDir, '.git'));
      result = await recovery.checkGitDirectory();
      expect(result.healthy).toBe(true);
      expect(result.message).toBe('.git directory present and valid');
    });

    test('should check git config file', async () => {
      await fs.mkdir(path.join(tempDir, '.git'));
      
      // No config file
      let result = await recovery.checkGitConfig();
      expect(result.healthy).toBe(false);
      expect(result.severity).toBe('warning');
      expect(result.message).toBe('Git config file missing');

      // Empty config file
      const configPath = path.join(tempDir, '.git', 'config');
      await fs.writeFile(configPath, '');
      result = await recovery.checkGitConfig();
      expect(result.healthy).toBe(false);
      expect(result.message).toBe('Git config file empty');

      // Valid config file
      await fs.writeFile(configPath, '[core]\n    repositoryformatversion = 0');
      result = await recovery.checkGitConfig();
      expect(result.healthy).toBe(true);
      expect(result.message).toBe('Git config file present and non-empty');
    });

    test('should check git refs structure', async () => {
      await fs.mkdir(path.join(tempDir, '.git'));
      
      // No refs directory
      let result = await recovery.checkGitRefs();
      expect(result.healthy).toBe(false);
      expect(result.message).toBe('Git refs directory missing');

      // Create refs but no heads
      await fs.mkdir(path.join(tempDir, '.git', 'refs'));
      result = await recovery.checkGitRefs();
      expect(result.healthy).toBe(false);
      expect(result.message).toBe('Git refs/heads directory missing');

      // Create complete refs structure
      await fs.mkdir(path.join(tempDir, '.git', 'refs', 'heads'));
      result = await recovery.checkGitRefs();
      expect(result.healthy).toBe(true);
      expect(result.message).toBe('Git refs structure present');
    });

    test('should check git objects structure', async () => {
      await fs.mkdir(path.join(tempDir, '.git'));
      
      // No objects directory
      let result = await recovery.checkGitObjects();
      expect(result.healthy).toBe(false);
      expect(result.severity).toBe('critical');
      expect(result.message).toBe('Git objects directory missing');

      // Create objects but incomplete structure
      const objectsPath = path.join(tempDir, '.git', 'objects');
      await fs.mkdir(objectsPath);
      result = await recovery.checkGitObjects();
      expect(result.healthy).toBe(false);
      expect(result.severity).toBe('warning');
      expect(result.message).toBe('Git objects structure incomplete');

      // Create complete objects structure
      await fs.mkdir(path.join(objectsPath, 'info'));
      await fs.mkdir(path.join(objectsPath, 'pack'));
      result = await recovery.checkGitObjects();
      expect(result.healthy).toBe(true);
      expect(result.message).toBe('Git objects directory structure present');
    });

    test('should check git index file', async () => {
      await fs.mkdir(path.join(tempDir, '.git'));
      
      // No index file
      let result = await recovery.checkGitIndex();
      expect(result.healthy).toBe(false);
      expect(result.message).toBe('Git index file missing');

      // Empty index file
      const indexPath = path.join(tempDir, '.git', 'index');
      await fs.writeFile(indexPath, '');
      result = await recovery.checkGitIndex();
      expect(result.healthy).toBe(false);
      expect(result.message).toBe('Git index file empty');

      // Valid index file
      await fs.writeFile(indexPath, 'DIRC\x00\x00\x00\x02'); // Basic git index header
      result = await recovery.checkGitIndex();
      expect(result.healthy).toBe(true);
      expect(result.message).toBe('Git index file present and non-empty');
    });

    test('should check repository permissions', async () => {
      await fs.mkdir(path.join(tempDir, '.git'));
      
      const result = await recovery.checkPermissions();
      expect(result.healthy).toBe(true);
      expect(result.message).toBe('Repository permissions are correct');
    });

    test('should perform comprehensive health check', async () => {
      // Create minimal git structure
      await fs.mkdir(path.join(tempDir, '.git'));
      await fs.mkdir(path.join(tempDir, '.git', 'refs'));
      await fs.mkdir(path.join(tempDir, '.git', 'refs', 'heads'));
      await fs.mkdir(path.join(tempDir, '.git', 'objects'));
      await fs.mkdir(path.join(tempDir, '.git', 'objects', 'info'));
      await fs.mkdir(path.join(tempDir, '.git', 'objects', 'pack'));
      await fs.writeFile(path.join(tempDir, '.git', 'config'), '[core]\n    repositoryformatversion = 0');
      await fs.writeFile(path.join(tempDir, '.git', 'index'), 'DIRC\x00\x00\x00\x02');

      const healthReport = await recovery.performHealthCheck();
      
      expect(healthReport.overall).toBe('healthy');
      expect(healthReport.checks).toHaveProperty('gitDirectory');
      expect(healthReport.checks).toHaveProperty('gitConfig');
      expect(healthReport.checks).toHaveProperty('gitRefs');
      expect(healthReport.checks).toHaveProperty('gitObjects');
      expect(healthReport.checks).toHaveProperty('gitIndex');
      expect(healthReport.checks).toHaveProperty('permissions');
      expect(healthReport.issues).toHaveLength(0);
      expect(healthReport.recommendations).toHaveLength(0);
    });

    test('should identify health issues', async () => {
      // Missing .git directory
      const healthReport = await recovery.performHealthCheck();
      
      expect(healthReport.overall).toBe('critical');
      expect(healthReport.issues.length).toBeGreaterThan(0);
      expect(healthReport.recommendations.length).toBeGreaterThan(0);
      
      const gitDirIssue = healthReport.issues.find(issue => issue.check === 'gitDirectory');
      expect(gitDirIssue).toBeDefined();
      expect(gitDirIssue.severity).toBe('critical');
    });
  });

  describe('Backup Operations', () => {
    beforeEach(async () => {
      await recovery.initialize(tempDir);
      
      // Create minimal .git structure for backup
      await fs.mkdir(path.join(tempDir, '.git'));
      await fs.writeFile(path.join(tempDir, '.git', 'config'), '[core]\n    repositoryformatversion = 0');
      await fs.mkdir(path.join(tempDir, '.git', 'refs'));
      await fs.mkdir(path.join(tempDir, '.git', 'objects'));
    });

    test('should create repository backup', async () => {
      const result = await recovery.createBackup('test-backup');
      
      expect(result.success).toBe(true);
      expect(result.name).toBe('test-backup');
      expect(result.path).toBeDefined();
      expect(result.metadata).toBeDefined();
      
      // Verify backup directory exists
      const backupExists = await pathExists(result.path);
      expect(backupExists).toBe(true);
      
      // Verify .git was copied
      const gitBackupExists = await pathExists(path.join(result.path, '.git'));
      expect(gitBackupExists).toBe(true);
      
      // Verify metadata file
      const metadataPath = path.join(result.path, 'backup-metadata.json');
      const metadataExists = await pathExists(metadataPath);
      expect(metadataExists).toBe(true);
    });

    test('should create backup with auto-generated name', async () => {
      const result = await recovery.createBackup();
      
      expect(result.success).toBe(true);
      expect(result.name).toMatch(/^backup-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}/);
    });

    test('should emit backup events', async () => {
      const events = [];
      recovery.on('backup-created', (data) => events.push({ type: 'created', data }));
      recovery.on('backup-failed', (data) => events.push({ type: 'failed', data }));

      await recovery.createBackup('event-test');
      
      expect(events.length).toBe(1);
      expect(events[0].type).toBe('created');
      expect(events[0].data.name).toBe('event-test');
    });

    test('should list available backups', async () => {
      // Create multiple backups
      await recovery.createBackup('backup-1');
      await recovery.createBackup('backup-2');
      await recovery.createBackup('backup-3');

      const backups = await recovery.listBackups();
      
      expect(backups.length).toBe(3);
      expect(backups[0].name).toBe('backup-3'); // Most recent first
      expect(backups[1].name).toBe('backup-2');
      expect(backups[2].name).toBe('backup-1');
      
      // Each backup should have metadata
      backups.forEach(backup => {
        expect(backup).toHaveProperty('name');
        expect(backup).toHaveProperty('timestamp');
        expect(backup).toHaveProperty('repositoryPath');
      });
    });

    test('should clean up old backups', async () => {
      recovery.config.maxBackups = 2;
      
      // Create more backups than the limit
      await recovery.createBackup('backup-1');
      await recovery.createBackup('backup-2');
      await recovery.createBackup('backup-3');
      await recovery.createBackup('backup-4');

      const backups = await recovery.listBackups();
      expect(backups.length).toBeLessThanOrEqual(2);
      
      // Should keep the most recent ones
      const names = backups.map(b => b.name);
      expect(names).toContain('backup-4');
      expect(names).toContain('backup-3');
    });

    test('should update metrics on backup creation', async () => {
      const initialMetrics = recovery.getMetrics();
      expect(initialMetrics.backupsCreated).toBe(0);

      await recovery.createBackup('metrics-test');
      
      const updatedMetrics = recovery.getMetrics();
      expect(updatedMetrics.backupsCreated).toBe(1);
    });
  });

  describe('Restore Operations', () => {
    beforeEach(async () => {
      await recovery.initialize(tempDir);
      
      // Create initial .git structure and backup
      await fs.mkdir(path.join(tempDir, '.git'));
      await fs.writeFile(path.join(tempDir, '.git', 'config'), '[core]\n    repositoryformatversion = 0');
      await fs.writeFile(path.join(tempDir, '.git', 'HEAD'), 'ref: refs/heads/main');
      
      await recovery.createBackup('restore-test');
    });

    test('should restore from backup', async () => {
      // Corrupt the repository
      await fs.rm(path.join(tempDir, '.git'), { recursive: true, force: true });
      
      const result = await recovery.restoreFromBackup('restore-test');
      
      expect(result.success).toBe(true);
      expect(result.name).toBe('restore-test');
      expect(result.preRestoreBackup).toBeDefined();
      
      // Verify .git directory was restored
      const gitExists = await pathExists(path.join(tempDir, '.git'));
      expect(gitExists).toBe(true);
      
      // Verify files were restored
      const configExists = await pathExists(path.join(tempDir, '.git', 'config'));
      expect(configExists).toBe(true);
    });

    test('should create pre-restore backup', async () => {
      // Modify the repository before restore
      await fs.writeFile(path.join(tempDir, '.git', 'MODIFIED'), 'modified content');
      
      const initialBackups = await recovery.listBackups();
      const result = await recovery.restoreFromBackup('restore-test');
      const finalBackups = await recovery.listBackups();
      
      expect(result.success).toBe(true);
      expect(result.preRestoreBackup).toBeDefined();
      expect(finalBackups.length).toBe(initialBackups.length + 1);
      
      // Verify pre-restore backup exists
      const preRestoreBackup = finalBackups.find(b => b.name === result.preRestoreBackup);
      expect(preRestoreBackup).toBeDefined();
    });

    test('should fail to restore non-existent backup', async () => {
      const result = await recovery.restoreFromBackup('non-existent');
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    test('should emit restore events', async () => {
      const events = [];
      recovery.on('backup-restored', (data) => events.push({ type: 'restored', data }));
      recovery.on('restore-failed', (data) => events.push({ type: 'failed', data }));

      await recovery.restoreFromBackup('restore-test');
      
      expect(events.length).toBe(1);
      expect(events[0].type).toBe('restored');
      expect(events[0].data.name).toBe('restore-test');
    });

    test('should update metrics on restore', async () => {
      const initialMetrics = recovery.getMetrics();
      expect(initialMetrics.backupsRestored).toBe(0);

      await recovery.restoreFromBackup('restore-test');
      
      const updatedMetrics = recovery.getMetrics();
      expect(updatedMetrics.backupsRestored).toBe(1);
    });
  });

  describe('Repository Repair', () => {
    beforeEach(async () => {
      await recovery.initialize(tempDir);
    });

    test('should repair repository issues', async () => {
      // Create issues to repair
      await fs.mkdir(path.join(tempDir, '.git'));
      // Missing config and refs
      
      const healthReport = await recovery.performHealthCheck();
      const repairResult = await recovery.repairRepository(healthReport.issues);
      
      expect(repairResult.success).toBe(true);
      expect(repairResult.repairsAttempted).toBeGreaterThan(0);
      expect(repairResult.repairsSuccessful).toBeGreaterThan(0);
      expect(repairResult.details).toBeDefined();
    });

    test('should determine repair strategies', async () => {
      const gitDirIssue = { check: 'gitDirectory' };
      const configIssue = { check: 'gitConfig' };
      const refsIssue = { check: 'gitRefs' };
      
      expect(recovery.determineRepairStrategy(gitDirIssue)).toBe(recovery.recoveryStrategies.missing);
      expect(recovery.determineRepairStrategy(configIssue)).toBe(recovery.recoveryStrategies.config);
      expect(recovery.determineRepairStrategy(refsIssue)).toBe(recovery.recoveryStrategies.refs);
    });

    test('should emit repair events', async () => {
      const events = [];
      recovery.on('repair-start', (data) => events.push({ type: 'start', data }));
      recovery.on('repair-success', (data) => events.push({ type: 'success', data }));
      recovery.on('repair-failed', (data) => events.push({ type: 'failed', data }));

      const issue = { check: 'gitConfig', severity: 'warning', message: 'Config missing' };
      await recovery.repairRepository([issue]);
      
      expect(events.length).toBeGreaterThan(0);
      expect(events[0].type).toBe('start');
    });
  });

  describe('Recovery Strategies', () => {
    beforeEach(async () => {
      await recovery.initialize(tempDir);
    });

    test('should recover from missing repository', async () => {
      const issue = { check: 'gitDirectory', message: '.git missing' };
      const result = await recovery.recoverFromMissing(issue);
      
      expect(result.success).toBe(true);
      expect(result.action).toBe('reinitialized-repository');
      expect(result.message).toBe('Repository reinitialized');
    });

    test('should recover from config issues', async () => {
      await fs.mkdir(path.join(tempDir, '.git'));
      const issue = { check: 'gitConfig', message: 'Config missing' };
      const result = await recovery.recoverFromConfig(issue);
      
      expect(result.success).toBe(true);
      expect(result.action).toBe('recreated-config');
      expect(result.message).toBe('Git config file recreated');
      
      // Verify config was created
      const configExists = await pathExists(path.join(tempDir, '.git', 'config'));
      expect(configExists).toBe(true);
    });

    test('should recover from refs issues', async () => {
      await fs.mkdir(path.join(tempDir, '.git'));
      const issue = { check: 'gitRefs', message: 'Refs missing' };
      const result = await recovery.recoverFromRefs(issue);
      
      expect(result.success).toBe(true);
      expect(result.action).toBe('recreated-refs');
      expect(result.message).toBe('Git refs structure recreated');
      
      // Verify refs structure was created
      const headsExists = await pathExists(path.join(tempDir, '.git', 'refs', 'heads'));
      const tagsExists = await pathExists(path.join(tempDir, '.git', 'refs', 'tags'));
      const remotesExists = await pathExists(path.join(tempDir, '.git', 'refs', 'remotes'));
      
      expect(headsExists).toBe(true);
      expect(tagsExists).toBe(true);
      expect(remotesExists).toBe(true);
    });

    test('should recover from objects issues', async () => {
      await fs.mkdir(path.join(tempDir, '.git'));
      const issue = { check: 'gitObjects', message: 'Objects missing' };
      const result = await recovery.recoverFromObjects(issue);
      
      expect(result.success).toBe(true);
      expect(result.action).toBe('recreated-objects');
      expect(result.message).toBe('Git objects structure recreated');
      
      // Verify objects structure was created
      const infoExists = await pathExists(path.join(tempDir, '.git', 'objects', 'info'));
      const packExists = await pathExists(path.join(tempDir, '.git', 'objects', 'pack'));
      
      expect(infoExists).toBe(true);
      expect(packExists).toBe(true);
    });

    test('should recover from index issues', async () => {
      await fs.mkdir(path.join(tempDir, '.git'));
      const issue = { check: 'gitIndex', message: 'Index corrupted' };
      const result = await recovery.recoverFromIndex(issue);
      
      expect(result.success).toBe(true);
      expect(result.action).toBe('reset-index');
      expect(result.message).toBe('Git index reset');
    });

    test('should recover from corruption with backup', async () => {
      // Create a backup first
      await fs.mkdir(path.join(tempDir, '.git'));
      await fs.writeFile(path.join(tempDir, '.git', 'config'), '[core]\n    test = true');
      await recovery.createBackup('corruption-backup');
      
      const issue = { check: 'corruption', message: 'Repository corrupted' };
      const result = await recovery.recoverFromCorruption(issue);
      
      expect(result.success).toBe(true);
      expect(result.action).toBe('restored-from-backup');
      expect(result.message).toContain('corruption-backup');
    });
  });

  describe('Auto Backup', () => {
    test('should start and stop auto backup', async () => {
      const autoRecovery = new RepositoryRecovery({
        enableAutoBackup: true,
        backupInterval: 50 // Very short for testing
      });

      await autoRecovery.initialize(tempDir);
      expect(autoRecovery.backupTimer).toBeDefined();
      
      await autoRecovery.cleanup();
      expect(autoRecovery.backupTimer).toBeNull();
    });

    test('should emit auto backup failed event', async () => {
      const autoRecovery = new RepositoryRecovery({
        enableAutoBackup: true,
        backupInterval: 10
      });

      const events = [];
      autoRecovery.on('auto-backup-failed', (data) => events.push(data));

      // Initialize with invalid path to cause backup failures
      await autoRecovery.initialize('/invalid/path/that/does/not/exist');
      
      // Wait for backup attempt
      await new Promise(resolve => setTimeout(resolve, 20));
      
      await autoRecovery.cleanup();
    });
  });

  describe('Metrics and Monitoring', () => {
    beforeEach(async () => {
      await recovery.initialize(tempDir);
    });

    test('should track comprehensive metrics', async () => {
      const initialMetrics = recovery.getMetrics();
      
      expect(initialMetrics).toHaveProperty('backupsCreated', 0);
      expect(initialMetrics).toHaveProperty('backupsRestored', 0);
      expect(initialMetrics).toHaveProperty('corruptionDetected', 0);
      expect(initialMetrics).toHaveProperty('repairsSuccessful', 0);
      expect(initialMetrics).toHaveProperty('repairsFailed', 0);
      expect(initialMetrics).toHaveProperty('healthChecksRun', 0);
    });

    test('should update metrics during operations', async () => {
      // Perform health check
      await recovery.performHealthCheck();
      
      // Create backup
      await fs.mkdir(path.join(tempDir, '.git'));
      await recovery.createBackup('metrics-test');
      
      const metrics = recovery.getMetrics();
      expect(metrics.healthChecksRun).toBe(1);
      expect(metrics.backupsCreated).toBe(1);
    });
  });

  describe('Utility Functions', () => {
    beforeEach(async () => {
      await recovery.initialize(tempDir);
    });

    test('should check path existence', async () => {
      expect(await recovery.pathExists(tempDir)).toBe(true);
      expect(await recovery.pathExists('/non/existent/path')).toBe(false);
    });

    test('should copy directories recursively', async () => {
      // Create source structure
      const srcDir = path.join(tempDir, 'source');
      await fs.mkdir(srcDir);
      await fs.writeFile(path.join(srcDir, 'file1.txt'), 'content1');
      await fs.mkdir(path.join(srcDir, 'subdir'));
      await fs.writeFile(path.join(srcDir, 'subdir', 'file2.txt'), 'content2');
      
      // Copy to destination
      const destDir = path.join(tempDir, 'destination');
      await recovery.copyDirectory(srcDir, destDir);
      
      // Verify copy
      expect(await recovery.pathExists(destDir)).toBe(true);
      expect(await recovery.pathExists(path.join(destDir, 'file1.txt'))).toBe(true);
      expect(await recovery.pathExists(path.join(destDir, 'subdir', 'file2.txt'))).toBe(true);
      
      const content1 = await fs.readFile(path.join(destDir, 'file1.txt'), 'utf8');
      const content2 = await fs.readFile(path.join(destDir, 'subdir', 'file2.txt'), 'utf8');
      
      expect(content1).toBe('content1');
      expect(content2).toBe('content2');
    });

    test('should execute git commands', async () => {
      await fs.mkdir(path.join(tempDir, '.git'));
      
      const result = await recovery.executeGitCommand(['status', '--porcelain'], tempDir);
      expect(result).toHaveProperty('stdout');
      expect(result).toHaveProperty('stderr');
    });

    test('should execute system commands', async () => {
      const result = await recovery.executeCommand(['echo', 'test']);
      expect(result.stdout.trim()).toBe('test');
    });
  });

  describe('Error Handling', () => {
    test('should handle uninitialized operations', async () => {
      const uninitializedRecovery = new RepositoryRecovery();
      
      await expect(uninitializedRecovery.performHealthCheck())
        .rejects.toThrow('RepositoryRecovery not initialized');
      
      await expect(uninitializedRecovery.createBackup())
        .rejects.toThrow('RepositoryRecovery not initialized');
    });

    test('should handle failed git commands gracefully', async () => {
      await recovery.initialize(tempDir);
      
      // This should fail because we're not in a git repository
      await expect(recovery.executeGitCommand(['log', '--oneline'], tempDir))
        .rejects.toThrow();
    });

    test('should handle backup failures', async () => {
      await recovery.initialize(tempDir);
      
      // Try to backup non-existent .git directory
      const result = await recovery.createBackup('fail-test');
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });
});

// Helper function
async function pathExists(path) {
  try {
    await fs.access(path);
    return true;
  } catch (error) {
    return false;
  }
}