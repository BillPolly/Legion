/**
 * @jest-environment node
 */

import { jest } from '@jest/globals';
import { DeploymentManager } from '../../../src/build/DeploymentManager.js';

describe('Deployment Manager', () => {
  let deploymentManager;
  
  beforeEach(() => {
    deploymentManager = new DeploymentManager();
    jest.clearAllMocks();
  });

  describe('Configuration Validation', () => {
    test('should create deployment manager with default options', () => {
      expect(deploymentManager).toBeDefined();
      expect(deploymentManager.config).toEqual(
        expect.objectContaining({
          environment: 'development',
          autoPublish: false,
          validateBeforeDeploy: true
        })
      );
    });

    test('should validate deployment configuration', () => {
      const validConfig = {
        packagePath: '/path/to/extension.zip',
        environment: 'production',
        store: 'chrome-web-store'
      };
      
      expect(() => {
        deploymentManager.validateConfig(validConfig);
      }).not.toThrow();
    });

    test('should reject invalid deployment configuration', () => {
      const invalidConfig = {
        packagePath: '/path/to/package.zip',
        environment: 'invalid-env'
      };
      
      expect(() => {
        deploymentManager.validateConfig(invalidConfig);
      }).toThrow('Invalid environment: invalid-env');
    });

    test('should require package path for deployment', () => {
      const config = {
        environment: 'production',
        store: 'chrome-web-store'
      };
      
      expect(() => {
        deploymentManager.validateConfig(config);
      }).toThrow('Package path is required for deployment');
    });
  });

  describe('Environment Management', () => {
    test('should support valid environments', () => {
      const validEnvs = ['development', 'staging', 'production'];
      
      for (const env of validEnvs) {
        expect(() => {
          deploymentManager.setEnvironment(env);
        }).not.toThrow();
        
        expect(deploymentManager.getEnvironment()).toBe(env);
      }
    });

    test('should get environment-specific configuration', () => {
      deploymentManager.setEnvironment('production');
      
      const config = deploymentManager.getEnvironmentConfig();
      
      expect(config).toEqual(
        expect.objectContaining({
          environment: 'production',
          validateBeforeDeploy: true,
          createBackup: true
        })
      );
    });

    test('should have different configs for different environments', () => {
      const devConfig = deploymentManager.getEnvironmentConfig('development');
      const prodConfig = deploymentManager.getEnvironmentConfig('production');
      
      expect(devConfig.validateBeforeDeploy).toBe(false);
      expect(prodConfig.validateBeforeDeploy).toBe(true);
    });
  });

  describe('Package Validation', () => {
    test('should validate package structure', async () => {
      const packageInfo = {
        files: ['manifest.json', 'background.js', 'content.js'],
        manifestValid: true,
        size: 1024,
        checksums: {
          sha256: 'abc123',
          md5: 'def456'
        }
      };
      
      const result = deploymentManager.validatePackage(packageInfo);
      
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should detect missing required files', async () => {
      const packageInfo = {
        files: ['manifest.json'],
        manifestValid: true,
        size: 512
      };
      
      const result = deploymentManager.validatePackage(packageInfo);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing recommended file: background.js');
    });

    test('should validate package size limits', async () => {
      const largePackage = {
        files: ['manifest.json', 'background.js'],
        manifestValid: true,
        size: 50 * 1024 * 1024 // 50MB
      };
      
      const result = deploymentManager.validatePackage(largePackage);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Package size exceeds maximum limit (20MB)');
    });

    test('should detect invalid manifest', async () => {
      const packageInfo = {
        files: ['manifest.json', 'background.js'],
        manifestValid: false,
        size: 1024
      };
      
      const result = deploymentManager.validatePackage(packageInfo);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Invalid manifest.json structure');
    });
  });

  describe('Store Integration', () => {
    test('should support chrome web store deployment', () => {
      const storeConfig = deploymentManager.getStoreConfig('chrome-web-store');
      
      expect(storeConfig).toEqual(
        expect.objectContaining({
          name: 'Chrome Web Store',
          uploadEndpoint: expect.any(String),
          apiVersion: expect.any(String)
        })
      );
    });

    test('should support edge add-ons deployment', () => {
      const storeConfig = deploymentManager.getStoreConfig('edge-add-ons');
      
      expect(storeConfig).toEqual(
        expect.objectContaining({
          name: 'Microsoft Edge Add-ons',
          uploadEndpoint: expect.any(String)
        })
      );
    });

    test('should reject unsupported stores', () => {
      expect(() => {
        deploymentManager.getStoreConfig('invalid-store');
      }).toThrow('Unsupported store: invalid-store');
    });
  });

  describe('Backup Management', () => {
    test('should create backup before deployment', () => {
      const deploymentConfig = {
        packagePath: '/path/to/extension.zip',
        environment: 'production',
        createBackup: true
      };
      
      const backupPath = deploymentManager.createBackup(deploymentConfig);
      
      expect(backupPath).toContain('backup');
      expect(backupPath).toContain(new Date().toISOString().split('T')[0]);
    });

    test('should generate unique backup names', () => {
      const config = {
        packagePath: '/path/to/extension.zip',
        environment: 'production'
      };
      
      const backup1 = deploymentManager.createBackup(config);
      const backup2 = deploymentManager.createBackup(config);
      
      expect(backup1).not.toBe(backup2);
    });

    test('should list available backups', () => {
      // Create some mock backups
      deploymentManager.backups = [
        { id: '1', date: '2024-01-01', environment: 'production' },
        { id: '2', date: '2024-01-02', environment: 'staging' }
      ];
      
      const backups = deploymentManager.listBackups();
      
      expect(backups).toHaveLength(2);
      expect(backups[0]).toHaveProperty('id');
      expect(backups[0]).toHaveProperty('date');
      expect(backups[0]).toHaveProperty('environment');
    });
  });

  describe('Rollback Functionality', () => {
    test('should support rollback to previous version', () => {
      // Create a backup first
      const backupPath = deploymentManager.createBackup({
        packagePath: '/path/to/extension.zip',
        environment: 'production'
      });
      
      // Get the backup ID from the created backup
      const backup = deploymentManager.backups[deploymentManager.backups.length - 1];
      
      const rollbackConfig = {
        backupId: backup.id,
        environment: 'production',
        reason: 'Critical bug found'
      };
      
      const result = deploymentManager.rollback(rollbackConfig);
      
      expect(result).toEqual(
        expect.objectContaining({
          success: true,
          backupId: backup.id,
          rolledBackAt: expect.any(String)
        })
      );
    });

    test('should validate rollback configuration', () => {
      const invalidConfig = {
        environment: 'production'
        // Missing backupId
      };
      
      expect(() => {
        deploymentManager.rollback(invalidConfig);
      }).toThrow('Backup ID is required for rollback');
    });

    test('should track rollback history', () => {
      // Create a backup first
      deploymentManager.createBackup({
        packagePath: '/path/to/extension.zip',
        environment: 'production'
      });
      
      const backup = deploymentManager.backups[deploymentManager.backups.length - 1];
      
      const config = {
        backupId: backup.id,
        environment: 'production',
        reason: 'Bug fix'
      };
      
      deploymentManager.rollback(config);
      
      const history = deploymentManager.getRollbackHistory();
      expect(history).toHaveLength(1);
      expect(history[0]).toMatchObject({
        backupId: backup.id,
        environment: 'production',
        reason: 'Bug fix'
      });
    });
  });

  describe('Deployment Status', () => {
    test('should track deployment status', () => {
      const deploymentId = 'deploy-123';
      
      deploymentManager.updateDeploymentStatus(deploymentId, 'in-progress');
      expect(deploymentManager.getDeploymentStatus(deploymentId)).toBe('in-progress');
      
      deploymentManager.updateDeploymentStatus(deploymentId, 'completed');
      expect(deploymentManager.getDeploymentStatus(deploymentId)).toBe('completed');
    });

    test('should get deployment history', () => {
      // Mock some deployments
      deploymentManager.deployments = [
        {
          id: 'deploy-1',
          status: 'completed',
          environment: 'production',
          timestamp: '2024-01-01T10:00:00Z'
        },
        {
          id: 'deploy-2', 
          status: 'failed',
          environment: 'staging',
          timestamp: '2024-01-01T11:00:00Z'
        }
      ];
      
      const history = deploymentManager.getDeploymentHistory();
      
      expect(history).toHaveLength(2);
      // History is sorted by timestamp descending (newest first)
      expect(history[0].status).toBe('failed'); // newer timestamp
      expect(history[1].status).toBe('completed'); // older timestamp
    });

    test('should filter deployments by environment', () => {
      deploymentManager.deployments = [
        { id: '1', environment: 'production', status: 'completed' },
        { id: '2', environment: 'staging', status: 'completed' },
        { id: '3', environment: 'production', status: 'failed' }
      ];
      
      const prodDeployments = deploymentManager.getDeploymentHistory('production');
      
      expect(prodDeployments).toHaveLength(2);
      expect(prodDeployments.every(d => d.environment === 'production')).toBe(true);
    });
  });

  describe('Release Notes', () => {
    test('should generate release notes from commits', () => {
      const commits = [
        { message: 'feat: add new feature', hash: 'abc123' },
        { message: 'fix: resolve critical bug', hash: 'def456' },
        { message: 'docs: update documentation', hash: 'ghi789' }
      ];
      
      const releaseNotes = deploymentManager.generateReleaseNotes(commits, '1.0.0');
      
      expect(releaseNotes).toContain('Version 1.0.0');
      expect(releaseNotes).toContain('add new feature');
      expect(releaseNotes).toContain('resolve critical bug');
    });

    test('should categorize changes by type', () => {
      const commits = [
        { message: 'feat: new feature' },
        { message: 'fix: bug fix' },
        { message: 'perf: performance improvement' }
      ];
      
      const releaseNotes = deploymentManager.generateReleaseNotes(commits, '1.0.0');
      
      expect(releaseNotes).toContain('### Features');
      expect(releaseNotes).toContain('### Bug Fixes'); 
      expect(releaseNotes).toContain('### Performance');
    });
  });

  describe('Error Handling', () => {
    test('should handle deployment failures gracefully', () => {
      const config = {
        packagePath: '/nonexistent/package.zip',
        environment: 'production'
      };
      
      expect(() => {
        deploymentManager.validateConfig(config);
      }).not.toThrow(); // Validation shouldn't throw for nonexistent files
    });

    test('should provide helpful error messages', () => {
      const config = {
        packagePath: '/path/to/package.zip',
        environment: 'invalid'
      };
      
      try {
        deploymentManager.validateConfig(config);
      } catch (error) {
        expect(error.message).toContain('Invalid environment: invalid');
        expect(error.message).toContain('Valid environments: development, staging, production');
      }
    });
  });
});