/**
 * GitSecurityManager Unit Tests
 * Phase 9.1: Security implementation tests
 * 
 * Tests security validation, token management, permission checking,
 * and audit logging capabilities.
 */

import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import GitSecurityManager from '../../../src/security/GitSecurityManager.js';

describe('GitSecurityManager', () => {
  let securityManager;
  let mockResourceManager;

  beforeEach(async () => {
    mockResourceManager = {
      get: jest.fn((key) => {
        switch (key) {
          case 'GITHUB_PAT': return 'ghp_1234567890123456789012345678901234567890';
          case 'GITHUB_AGENT_ORG': return 'TestOrg';
          case 'GITHUB_USER': return 'test-user';
          default: return null;
        }
      })
    };

    securityManager = new GitSecurityManager(mockResourceManager, {
      enableTokenValidation: true,
      enablePermissionChecking: true,
      enableAuditLogging: true,
      enableEncryption: true
    });
  });

  afterEach(async () => {
    if (securityManager) {
      await securityManager.cleanup();
    }
  });

  describe('Initialization', () => {
    test('should initialize security manager', async () => {
      // Mock GitHub API responses
      global.fetch = jest.fn()
        .mockResolvedValueOnce({
          ok: true,
          headers: {
            get: (header) => {
              switch (header) {
                case 'x-oauth-scopes': return 'repo, user';
                case 'x-github-app-id': return null;
                case 'x-github-installation-id': return null;
                case 'github-authentication-token-expiration': return null;
                default: return null;
              }
            }
          },
          json: () => Promise.resolve({ login: 'test-user' })
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ role: 'member' })
        });

      await securityManager.initialize();
      
      expect(securityManager.initialized).toBe(true);
      expect(securityManager.tokenInfo).toBeDefined();
      expect(securityManager.tokenInfo.user).toBe('test-user');
      expect(securityManager.encryptionKey).toBeDefined();
    });

    test('should emit initialization event', async () => {
      const events = [];
      securityManager.on('initialized', (data) => events.push(data));

      // Mock API calls
      global.fetch = jest.fn()
        .mockResolvedValue({
          ok: true,
          headers: { get: () => 'repo, user' },
          json: () => Promise.resolve({ login: 'test-user' })
        });

      await securityManager.initialize();
      
      expect(events.length).toBe(1);
      expect(events[0]).toHaveProperty('tokenValidation', true);
      expect(events[0]).toHaveProperty('encryption', true);
    });

    test('should handle initialization failures', async () => {
      const events = [];
      securityManager.on('initialization-failed', (data) => events.push(data));

      // Mock failing API call
      global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));

      await expect(securityManager.initialize()).rejects.toThrow();
      expect(events.length).toBe(1);
    });
  });

  describe('Token Validation', () => {
    test('should validate correct token format', () => {
      const validTokens = [
        'ghp_1234567890123456789012345678901234567890',
        'ghs_1234567890123456789012345678901234567890',
        'ghu_1234567890123456789012345678901234567890'
      ];

      validTokens.forEach(token => {
        expect(securityManager.isValidTokenFormat(token)).toBe(true);
      });
    });

    test('should reject invalid token formats', () => {
      const invalidTokens = [
        'invalid-token',
        'ghp_short',
        'ghp_12345678901234567890123456789012345678901', // too long
        'gho_1234567890123456789012345678901234567890', // wrong prefix
        ''
      ];

      invalidTokens.forEach(token => {
        expect(securityManager.isValidTokenFormat(token)).toBe(false);
      });
    });

    test('should validate token with GitHub API', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        headers: {
          get: (header) => {
            switch (header) {
              case 'x-oauth-scopes': return 'repo, user, admin:org';
              case 'x-github-app-id': return '12345';
              default: return null;
            }
          }
        },
        json: () => Promise.resolve({
          login: 'test-user',
          id: 12345
        })
      });

      const tokenInfo = await securityManager.validateTokenWithGitHub('ghp_test');
      
      expect(tokenInfo.user).toBe('test-user');
      expect(tokenInfo.scopes).toEqual(['repo', 'user', 'admin:org']);
      expect(tokenInfo.app_id).toBe('12345');
    });

    test('should handle GitHub API validation failures', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized'
      });

      await expect(
        securityManager.validateTokenWithGitHub('invalid-token')
      ).rejects.toThrow('GitHub API validation failed: 401 Unauthorized');
    });

    test('should determine when token needs refresh', async () => {
      // Fresh token
      securityManager.tokenInfo = {
        lastValidated: new Date(),
        expiresAt: new Date(Date.now() + 7200000) // 2 hours from now
      };
      expect(securityManager.shouldRefreshToken()).toBe(false);

      // Old validation
      securityManager.tokenInfo.lastValidated = new Date(Date.now() - 7200000); // 2 hours ago
      expect(securityManager.shouldRefreshToken()).toBe(true);

      // Expiring soon
      securityManager.tokenInfo = {
        lastValidated: new Date(),
        expiresAt: new Date(Date.now() + 1800000) // 30 minutes from now
      };
      expect(securityManager.shouldRefreshToken()).toBe(true);
    });
  });

  describe('Permission Management', () => {
    beforeEach(async () => {
      securityManager.tokenInfo = {
        user: 'test-user',
        scopes: ['repo', 'admin:org']
      };
    });

    test('should load organization permissions for member', async () => {
      global.fetch = jest.fn()
        .mockResolvedValueOnce({
          ok: true,
          status: 200
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ role: 'member' })
        });

      await securityManager.loadPermissions();
      
      const permissions = securityManager.permissions.get('organization');
      expect(permissions.member).toBe(true);
      expect(permissions.admin).toBe(false);
      expect(permissions.canCreateRepos).toBe(true);
      expect(permissions.canDeleteRepos).toBe(false);
    });

    test('should load organization permissions for admin', async () => {
      global.fetch = jest.fn()
        .mockResolvedValueOnce({
          ok: true,
          status: 200
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ role: 'admin' })
        });

      await securityManager.loadPermissions();
      
      const permissions = securityManager.permissions.get('organization');
      expect(permissions.member).toBe(true);
      expect(permissions.admin).toBe(true);
      expect(permissions.canDeleteRepos).toBe(true);
    });

    test('should handle non-member status', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 404
      });

      await securityManager.loadPermissions();
      
      const permissions = securityManager.permissions.get('organization');
      expect(permissions.member).toBe(false);
      expect(permissions.admin).toBe(false);
      expect(permissions.canCreateRepos).toBe(false);
    });

    test('should check operation permissions', async () => {
      securityManager.permissions.set('organization', {
        member: true,
        admin: false,
        canCreateRepos: true,
        canDeleteRepos: false
      });

      // Create repository - should be allowed
      let result = await securityManager.checkOperationPermission('create-repository');
      expect(result.allowed).toBe(true);

      // Delete repository - should be denied
      result = await securityManager.checkOperationPermission('delete-repository');
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('admin-required');

      // Push to main - should be allowed
      result = await securityManager.checkOperationPermission('push-to-main', {
        branchProtection: 'none'
      });
      expect(result.allowed).toBe(true);
    });

    test('should respect blocked operations', async () => {
      securityManager.config.blockedOperations = ['delete-repository', 'force-push'];

      const result = await securityManager.checkOperationPermission('delete-repository');
      
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('operation-blocked');
    });

    test('should respect allowed operations list', async () => {
      securityManager.config.allowedOperations = ['create-repository', 'commit'];

      // Allowed operation
      let result = await securityManager.checkOperationPermission('create-repository');
      expect(result.allowed).toBe(true);

      // Not in allowed list
      result = await securityManager.checkOperationPermission('delete-repository');
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('operation-not-allowed');
    });
  });

  describe('Sensitive Data Detection', () => {
    test('should detect API keys', () => {
      const content = `
        const config = {
          api_key: "secret-api-key-12345",
          database_password: "super-secret-password"
        };
      `;

      const violations = securityManager.scanForSensitiveData(content, 'config.js');
      
      expect(violations.length).toBeGreaterThan(0);
      expect(violations.some(v => v.pattern.includes('api'))).toBe(true);
      expect(violations.some(v => v.pattern.includes('password'))).toBe(true);
    });

    test('should detect GitHub tokens', () => {
      const content = `
        export const GITHUB_TOKEN = "ghp_1234567890123456789012345678901234567890";
      `;

      const violations = securityManager.scanForSensitiveData(content, 'secrets.js');
      
      expect(violations.length).toBeGreaterThan(0);
      expect(violations[0].severity).toBe('high');
    });

    test('should detect private keys', () => {
      const content = `
        -----BEGIN PRIVATE KEY-----
        MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC...
        -----END PRIVATE KEY-----
      `;

      const violations = securityManager.scanForSensitiveData(content, 'key.pem');
      
      expect(violations.length).toBeGreaterThan(0);
      expect(violations[0].severity).toBe('critical');
    });

    test('should emit events for sensitive data detection', () => {
      const events = [];
      securityManager.on('sensitive-data-detected', (data) => events.push(data));

      const content = 'const secret = "my-secret-token";';
      securityManager.scanForSensitiveData(content, 'test.js');
      
      expect(events.length).toBe(1);
      expect(events[0].filename).toBe('test.js');
      expect(events[0].violations.length).toBeGreaterThan(0);
    });

    test('should use custom sensitive patterns', () => {
      securityManager.config.sensitivePatterns = [
        /custom[_-]secret/gi
      ];

      const content = 'const CUSTOM_SECRET = "my-custom-secret";';
      const violations = securityManager.scanForSensitiveData(content);
      
      expect(violations.length).toBeGreaterThan(0);
    });

    test('should calculate line and column numbers', () => {
      const content = `line 1
line 2 with secret = "token"
line 3`;

      const violations = securityManager.scanForSensitiveData(content);
      
      expect(violations[0].line).toBe(2);
      expect(violations[0].column).toBeGreaterThan(0);
    });
  });

  describe('Encryption', () => {
    test('should encrypt and decrypt data', async () => {
      await securityManager.initializeEncryption();
      
      const originalData = 'sensitive information';
      const encrypted = securityManager.encrypt(originalData);
      
      expect(encrypted).toHaveProperty('encrypted');
      expect(encrypted).toHaveProperty('iv');
      expect(encrypted).toHaveProperty('authTag');
      expect(encrypted.encrypted).not.toBe(originalData);
      
      const decrypted = securityManager.decrypt(encrypted);
      expect(decrypted).toBe(originalData);
    });

    test('should return original data when encryption disabled', () => {
      securityManager.config.enableEncryption = false;
      
      const data = 'test data';
      const result = securityManager.encrypt(data);
      
      expect(result).toBe(data);
    });

    test('should handle encryption without key', () => {
      securityManager.encryptionKey = null;
      
      const data = 'test data';
      const result = securityManager.encrypt(data);
      
      expect(result).toBe(data);
    });
  });

  describe('Audit Logging', () => {
    test('should record audit events', async () => {
      // Trigger some operations to generate audit log
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        headers: { get: () => 'repo, user' },
        json: () => Promise.resolve({ login: 'test-user' })
      });

      await securityManager.validateGitHubToken();
      
      const auditLog = securityManager.getAuditLog();
      expect(auditLog.length).toBeGreaterThan(0);
      expect(auditLog[0]).toHaveProperty('type');
      expect(auditLog[0]).toHaveProperty('timestamp');
    });

    test('should filter audit log by type', async () => {
      // Add some audit entries
      securityManager.auditLog.push(
        {
          type: 'token-validation',
          result: 'valid',
          timestamp: new Date().toISOString()
        },
        {
          type: 'permission-check',
          result: 'allowed',
          timestamp: new Date().toISOString()
        }
      );

      const tokenEvents = securityManager.getAuditLog({ type: 'token-validation' });
      expect(tokenEvents.length).toBe(1);
      expect(tokenEvents[0].type).toBe('token-validation');
    });

    test('should filter audit log by time', () => {
      const now = new Date();
      const hourAgo = new Date(now.getTime() - 3600000);
      
      securityManager.auditLog.push(
        {
          type: 'old-event',
          timestamp: new Date(now.getTime() - 7200000).toISOString()
        },
        {
          type: 'recent-event',
          timestamp: now.toISOString()
        }
      );

      const recentEvents = securityManager.getAuditLog({ since: hourAgo });
      expect(recentEvents.length).toBe(1);
      expect(recentEvents[0].type).toBe('recent-event');
    });

    test('should limit audit log results', () => {
      // Add multiple entries
      for (let i = 0; i < 10; i++) {
        securityManager.auditLog.push({
          type: 'test-event',
          index: i,
          timestamp: new Date().toISOString()
        });
      }

      const limitedEvents = securityManager.getAuditLog({ limit: 5 });
      expect(limitedEvents.length).toBe(5);
    });

    test('should clean up old audit logs', () => {
      const now = new Date();
      const oldDate = new Date(now.getTime() - (91 * 24 * 60 * 60 * 1000)); // 91 days ago
      
      securityManager.auditLog.push(
        {
          type: 'old-event',
          timestamp: oldDate
        },
        {
          type: 'recent-event',
          timestamp: now
        }
      );

      securityManager.cleanupAuditLog();
      
      expect(securityManager.auditLog.length).toBe(1);
      expect(securityManager.auditLog[0].type).toBe('recent-event');
    });
  });

  describe('Security Reporting', () => {
    test('should generate security report', () => {
      // Add some test data
      securityManager.tokenInfo = {
        user: 'test-user',
        scopes: ['repo', 'user'],
        lastValidated: new Date()
      };
      
      securityManager.permissions.set('organization', {
        member: true,
        admin: false
      });

      securityManager.auditLog.push({
        type: 'sensitive-data-detected',
        timestamp: new Date().toISOString()
      });

      const report = securityManager.generateSecurityReport();
      
      expect(report).toHaveProperty('reportGeneratedAt');
      expect(report).toHaveProperty('tokenInfo');
      expect(report).toHaveProperty('permissions');
      expect(report).toHaveProperty('auditSummary');
      expect(report).toHaveProperty('securityViolations');
      expect(report).toHaveProperty('recommendations');
      
      expect(report.tokenInfo.user).toBe('test-user');
      expect(report.securityViolations.length).toBeGreaterThan(0);
    });

    test('should generate security recommendations', () => {
      // Set up conditions for recommendations
      securityManager.tokenInfo = {
        lastValidated: new Date(Date.now() - 7200000) // 2 hours ago
      };
      
      securityManager.config.enableEncryption = false;
      
      securityManager.auditLog.push({
        type: 'sensitive-data-detected',
        timestamp: new Date().toISOString()
      });

      const recommendations = securityManager.generateSecurityRecommendations();
      
      expect(recommendations.length).toBeGreaterThan(0);
      expect(recommendations.some(r => r.type === 'token-refresh')).toBe(true);
      expect(recommendations.some(r => r.type === 'encryption')).toBe(true);
      expect(recommendations.some(r => r.type === 'sensitive-data')).toBe(true);
    });
  });

  describe('Configuration', () => {
    test('should respect security configuration', () => {
      const secureConfig = {
        enableTokenValidation: false,
        enablePermissionChecking: false,
        enableAuditLogging: false,
        enableEncryption: false
      };

      const manager = new GitSecurityManager(mockResourceManager, secureConfig);
      
      expect(manager.config.enableTokenValidation).toBe(false);
      expect(manager.config.enablePermissionChecking).toBe(false);
      expect(manager.config.enableAuditLogging).toBe(false);
      expect(manager.config.enableEncryption).toBe(false);
    });

    test('should use default configuration values', () => {
      const manager = new GitSecurityManager(mockResourceManager);
      
      expect(manager.config.enableTokenValidation).toBe(true);
      expect(manager.config.tokenRefreshThreshold).toBe(3600000);
      expect(manager.config.auditRetentionDays).toBe(90);
    });
  });

  describe('Error Handling', () => {
    test('should handle missing GitHub token', async () => {
      mockResourceManager.get.mockReturnValue(null);

      await expect(securityManager.validateGitHubToken())
        .rejects.toThrow('GitHub token not found');
    });

    test('should handle network errors during validation', async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));

      await expect(securityManager.validateGitHubToken())
        .rejects.toThrow();
      
      const auditLog = securityManager.getAuditLog();
      expect(auditLog.some(entry => entry.result === 'failed')).toBe(true);
    });

    test('should handle permission loading failures', async () => {
      securityManager.tokenInfo = { user: 'test-user' };
      global.fetch = jest.fn().mockRejectedValue(new Error('API error'));

      await expect(securityManager.loadPermissions()).rejects.toThrow();
      
      const auditLog = securityManager.getAuditLog();
      expect(auditLog.some(entry => 
        entry.type === 'permission-check' && entry.result === 'failed'
      )).toBe(true);
    });
  });

  describe('Cleanup', () => {
    test('should cleanup security resources', async () => {
      await securityManager.initializeEncryption();
      expect(securityManager.encryptionKey).toBeDefined();
      
      const removeListenersSpy = jest.spyOn(securityManager, 'removeAllListeners');
      
      await securityManager.cleanup();
      
      expect(securityManager.encryptionKey).toBeNull();
      expect(removeListenersSpy).toHaveBeenCalled();
    });

    test('should not fail cleanup when not initialized', async () => {
      const uninitializedManager = new GitSecurityManager(mockResourceManager);
      
      await expect(uninitializedManager.cleanup()).resolves.not.toThrow();
    });
  });
});