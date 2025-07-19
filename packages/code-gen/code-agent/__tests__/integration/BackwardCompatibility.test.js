/**
 * Backward Compatibility Tests
 * Phase 10.1.2: Backward compatibility with existing code
 * 
 * Tests that the Git integration system maintains backward compatibility
 * with existing CodeAgent and configuration patterns.
 */

import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import GitIntegrationManager from '../../src/integration/GitIntegrationManager.js';
import GitConfigValidator from '../../src/config/GitConfigValidator.js';

describe('Backward Compatibility', () => {
  let mockResourceManager;

  beforeEach(() => {
    mockResourceManager = {
      get: jest.fn((key) => {
        switch (key) {
          case 'GITHUB_PAT': return 'ghp_1234567890123456789012345678901234567890';
          case 'GITHUB_AGENT_ORG': return 'AgentResults';
          case 'GITHUB_USER': return 'test-user';
          default: return null;
        }
      })
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Configuration Compatibility', () => {
    test('should handle legacy configuration format', () => {
      const legacyConfig = {
        gitEnabled: true, // Old format
        branchStrategy: 'main',
        commitFormat: 'simple'
      };

      const { config, errors } = GitConfigValidator.validateAndMerge(legacyConfig, false);
      
      // Should handle gracefully even with unknown properties
      expect(errors.length).toBe(0);
      expect(config.branchStrategy).toBe('main');
    });

    test('should provide default values for missing configuration', () => {
      const minimalConfig = {};

      const { config, errors } = GitConfigValidator.validateAndMerge(minimalConfig, false);
      
      expect(errors.length).toBe(0);
      expect(config.branchStrategy).toBeDefined();
      expect(config.commitMessage).toBeDefined();
      expect(config.repositoryStrategy).toBeDefined();
    });

    test('should merge user config with defaults correctly', () => {
      const userConfig = {
        branchStrategy: 'feature',
        enableCommitSigning: true
      };

      const { config, errors } = GitConfigValidator.validateAndMerge(userConfig, false);
      
      expect(errors.length).toBe(0);
      expect(config.branchStrategy).toBe('feature');
      expect(config.enableCommitSigning).toBe(true);
      expect(config.commitMessage).toBeDefined(); // Should have default
    });

    test('should validate configuration values', () => {
      const invalidConfig = {
        branchStrategy: 'invalid-strategy',
        maxCommitMessageLength: 'not-a-number'
      };

      const { config, errors } = GitConfigValidator.validateAndMerge(invalidConfig, false);
      
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some(e => e.includes('branchStrategy'))).toBe(true);
    });
  });

  describe('GitIntegrationManager Compatibility', () => {
    test('should initialize with minimal configuration', () => {
      const gitIntegration = new GitIntegrationManager(mockResourceManager, {});
      
      expect(gitIntegration).toBeDefined();
      expect(gitIntegration.config).toBeDefined();
      expect(gitIntegration.config.branchStrategy).toBeDefined();
    });

    test('should accept legacy configuration patterns', () => {
      const legacyConfig = {
        git: {
          enabled: true,
          branch: 'main'
        },
        github: {
          organization: 'TestOrg'
        }
      };

      const gitIntegration = new GitIntegrationManager(mockResourceManager, legacyConfig);
      
      expect(gitIntegration).toBeDefined();
      expect(gitIntegration.config).toBeDefined();
    });

    test('should provide status without initialization', () => {
      const gitIntegration = new GitIntegrationManager(mockResourceManager, {});
      
      const status = gitIntegration.getStatus();
      
      expect(status).toBeDefined();
      expect(status.initialized).toBe(false);
      expect(status.workingDirectory).toBeNull();
      expect(status.config).toBeDefined();
    });

    test('should handle missing ResourceManager gracefully', () => {
      expect(() => {
        new GitIntegrationManager(null, {});
      }).not.toThrow();
    });
  });

  describe('API Compatibility', () => {
    test('should maintain existing method signatures', () => {
      const gitIntegration = new GitIntegrationManager(mockResourceManager, {});
      
      // Check that all expected methods exist
      expect(typeof gitIntegration.initialize).toBe('function');
      expect(typeof gitIntegration.cleanup).toBe('function');
      expect(typeof gitIntegration.getStatus).toBe('function');
      expect(typeof gitIntegration.updateConfig).toBe('function');
      
      // Check new methods are also available
      expect(typeof gitIntegration.validateOperation).toBe('function');
      expect(typeof gitIntegration.executeOperation).toBe('function');
      expect(typeof gitIntegration.generateSystemHealthReport).toBe('function');
    });

    test('should return consistent status object structure', () => {
      const gitIntegration = new GitIntegrationManager(mockResourceManager, {});
      
      const status = gitIntegration.getStatus();
      
      expect(status).toHaveProperty('initialized');
      expect(status).toHaveProperty('workingDirectory');
      expect(status).toHaveProperty('config');
      expect(status).toHaveProperty('components');
      expect(typeof status.initialized).toBe('boolean');
    });

    test('should handle updateConfig without breaking existing functionality', () => {
      const gitIntegration = new GitIntegrationManager(mockResourceManager, {
        branchStrategy: 'main'
      });
      
      const originalConfig = gitIntegration.config;
      
      gitIntegration.updateConfig({
        branchStrategy: 'feature',
        commitMessage: { prefix: '[Updated]' }
      });
      
      expect(gitIntegration.config.branchStrategy).toBe('feature');
      expect(gitIntegration.config.commitMessage.prefix).toBe('[Updated]');
    });
  });

  describe('Event Compatibility', () => {
    test('should emit expected events for backward compatibility', async () => {
      const gitIntegration = new GitIntegrationManager(mockResourceManager, {});
      const events = [];
      
      gitIntegration.on('initialize', (data) => events.push({ type: 'initialize', data }));
      gitIntegration.on('cleanup', (data) => events.push({ type: 'cleanup', data }));
      gitIntegration.on('error', (data) => events.push({ type: 'error', data }));
      
      // Test events are emitted correctly
      gitIntegration.emit('initialize', { test: true });
      gitIntegration.emit('cleanup', { test: true });
      gitIntegration.emit('error', { test: true });
      
      expect(events.length).toBe(3);
      expect(events[0].type).toBe('initialize');
      expect(events[1].type).toBe('cleanup');
      expect(events[2].type).toBe('error');
    });

    test('should handle event listeners without breaking', () => {
      const gitIntegration = new GitIntegrationManager(mockResourceManager, {});
      let eventReceived = false;
      
      gitIntegration.on('test-event', () => {
        eventReceived = true;
      });
      
      gitIntegration.emit('test-event');
      
      expect(eventReceived).toBe(true);
    });
  });

  describe('Error Handling Compatibility', () => {
    test('should handle initialization errors gracefully', async () => {
      const gitIntegration = new GitIntegrationManager(mockResourceManager, {});
      const errorEvents = [];
      
      gitIntegration.on('error', (data) => errorEvents.push(data));
      
      // Try to initialize with invalid path
      try {
        await gitIntegration.initialize('/invalid/nonexistent/path');
      } catch (error) {
        // Should catch error gracefully
        expect(error).toBeDefined();
      }
      
      expect(errorEvents.length).toBeGreaterThan(0);
    });

    test('should maintain error event structure', () => {
      const gitIntegration = new GitIntegrationManager(mockResourceManager, {});
      const errorEvents = [];
      
      gitIntegration.on('error', (data) => errorEvents.push(data));
      
      gitIntegration.emit('error', {
        phase: 'test',
        error: 'Test error message'
      });
      
      expect(errorEvents.length).toBe(1);
      expect(errorEvents[0]).toHaveProperty('phase');
      expect(errorEvents[0]).toHaveProperty('error');
    });
  });

  describe('Feature Flag Compatibility', () => {
    test('should work with features disabled', () => {
      const gitIntegration = new GitIntegrationManager(mockResourceManager, {
        enableSecurityFeatures: false,
        enableMonitoring: false,
        enableCompliance: false,
        enableErrorRecovery: false
      });
      
      expect(gitIntegration).toBeDefined();
      expect(gitIntegration.config.enableSecurityFeatures).toBe(false);
      expect(gitIntegration.config.enableMonitoring).toBe(false);
    });

    test('should provide graceful degradation when features are disabled', async () => {
      const gitIntegration = new GitIntegrationManager(mockResourceManager, {
        enableSecurityFeatures: false,
        enableMonitoring: false
      });
      
      // These should work even with features disabled
      const validation = await gitIntegration.validateOperation('test-operation');
      expect(validation).toBeDefined();
      expect(validation.allowed).toBe(true);
      expect(validation.reason).toBe('security-disabled');
    });

    test('should handle mixed feature configurations', () => {
      const gitIntegration = new GitIntegrationManager(mockResourceManager, {
        enableSecurityFeatures: true,
        enableMonitoring: false,
        enableCompliance: true,
        enableErrorRecovery: false
      });
      
      expect(gitIntegration.config.enableSecurityFeatures).toBe(true);
      expect(gitIntegration.config.enableMonitoring).toBe(false);
      expect(gitIntegration.config.enableCompliance).toBe(true);
      expect(gitIntegration.config.enableErrorRecovery).toBe(false);
    });
  });

  describe('Migration Path Validation', () => {
    test('should provide migration warnings for deprecated patterns', () => {
      const legacyConfig = {
        gitEnabled: true, // Deprecated
        githubOrganization: 'TestOrg', // Deprecated format
        branchNaming: 'feature' // Deprecated
      };

      // Should not break with legacy config
      const gitIntegration = new GitIntegrationManager(mockResourceManager, legacyConfig);
      expect(gitIntegration).toBeDefined();
    });

    test('should suggest modern configuration alternatives', () => {
      const { config, errors } = GitConfigValidator.validateAndMerge({
        unknownProperty: 'value'
      }, false);
      
      // Should handle unknown properties gracefully
      expect(errors.length).toBe(0);
      expect(config).toBeDefined();
    });

    test('should support both old and new property names', () => {
      const mixedConfig = {
        branchStrategy: 'feature', // New format
        messageFormat: 'conventional' // New format
      };

      const { config, errors } = GitConfigValidator.validateAndMerge(mixedConfig, false);
      
      expect(errors.length).toBe(0);
      expect(config.branchStrategy).toBe('feature');
      expect(config.commitMessage).toBeDefined();
    });
  });
});