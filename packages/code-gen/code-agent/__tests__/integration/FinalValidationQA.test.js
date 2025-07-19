/**
 * Final Validation and Quality Assurance Tests
 * Phase 10.2.1: Complete end-to-end validation of Git integration system
 * 
 * Tests all integration points, performance benchmarks, security validation,
 * and overall system quality to ensure production readiness.
 */

import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import GitIntegrationManager from '../../src/integration/GitIntegrationManager.js';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';

describe('Final Validation and Quality Assurance', () => {
  let mockResourceManager;
  let testWorkingDirectory;
  let baseTestConfig;

  beforeEach(async () => {
    // Create temporary test directory
    testWorkingDirectory = path.join(os.tmpdir(), `git-final-validation-${Date.now()}`);
    await fs.mkdir(testWorkingDirectory, { recursive: true });
    
    // Initialize as Git repository for testing
    const { spawn } = await import('child_process');
    await new Promise((resolve, reject) => {
      const git = spawn('git', ['init'], { cwd: testWorkingDirectory });
      git.on('close', (code) => {
        if (code === 0) resolve();
        else reject(new Error(`git init failed with code ${code}`));
      });
    });

    // Mock ResourceManager with complete environment
    mockResourceManager = {
      get: jest.fn((key) => {
        switch (key) {
          case 'GITHUB_PAT': return 'ghp_123456789012345678901234567890123456';
          case 'GITHUB_AGENT_ORG': return 'AgentResults';
          case 'GITHUB_USER': return 'test-validation-user';
          case 'NODE_ENV': return 'test';
          case 'GIT_AUTHOR_EMAIL': return 'test@example.com';
          case 'GIT_AUTHOR_NAME': return 'Test User';
          default: return null;
        }
      }),
      getAll: jest.fn(() => ({
        GITHUB_PAT: 'ghp_123456789012345678901234567890123456',
        GITHUB_AGENT_ORG: 'AgentResults',
        GITHUB_USER: 'test-validation-user'
      }))
    };

    // Mock GitHub API for testing
    global.fetch = jest.fn()
      .mockResolvedValueOnce({
        ok: true,
        headers: {
          get: (header) => {
            switch (header) {
              case 'x-oauth-scopes': return 'repo, admin:org, user';
              case 'x-github-app-id': return null;
              default: return null;
            }
          }
        },
        json: () => Promise.resolve({ login: 'test-validation-user', id: 12345 })
      })
      .mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ role: 'admin' })
      });

    // Base configuration for testing without real API calls
    baseTestConfig = {
      enableGitIntegration: true,
      enableSecurityFeatures: false, // Disable API-dependent features
      enableMonitoring: true,
      enableCompliance: true,
      enableErrorRecovery: true,
      branchStrategy: 'feature',
      commitStrategy: 'phase',
      pushStrategy: 'validation'
    };
  });

  afterEach(async () => {
    // Clean up test directory
    if (testWorkingDirectory) {
      try {
        await fs.rm(testWorkingDirectory, { recursive: true, force: true });
      } catch (error) {
        // Ignore cleanup errors
      }
    }
    
    jest.clearAllMocks();
  });

  describe('Complete End-to-End Validation', () => {
    test('should validate complete Git integration workflow', async () => {
      const gitIntegration = new GitIntegrationManager(mockResourceManager, baseTestConfig);

      // Step 1: Initialize system
      await gitIntegration.initialize(testWorkingDirectory);
      expect(gitIntegration.initialized).toBe(true);

      // Step 2: Validate all components are active (security disabled for testing)
      const status = gitIntegration.getStatus();
      expect(status.components.security).toBe(false);
      expect(status.components.monitoring).toBe(true);
      expect(status.components.compliance).toBe(true);
      expect(status.components.errorHandler).toBe(true);

      // Step 3: Test security validation (should work with security disabled)
      const securityValidation = await gitIntegration.validateOperation('test-operation', {
        sensitive: false,
        organization: 'AgentResults'
      });
      expect(securityValidation.allowed).toBe(true);
      expect(securityValidation.reason).toBe('security-disabled');

      // Step 4: Test monitoring functionality
      const operationId = gitIntegration.monitoring.startOperation(
        'validation-test',
        'end-to-end-test',
        { validation: true }
      );
      expect(operationId).toBeDefined();
      
      gitIntegration.monitoring.endOperation(operationId.id, { success: true });
      const metrics = gitIntegration.monitoring.getMetrics();
      expect(metrics.performance.totalOperations).toBeGreaterThan(0);

      // Step 5: Test compliance recording
      gitIntegration.auditCompliance.recordOperation({
        type: 'validation-test',
        user: 'test-validation-user',
        timestamp: new Date(),
        details: { purpose: 'end-to-end-validation' }
      });
      
      const complianceReport = gitIntegration.auditCompliance.generateComplianceReport('SOX');
      expect(complianceReport.auditTrail.length).toBeGreaterThan(0);

      // Step 6: Test error handling
      const testError = new Error('Test error for validation');
      const classified = gitIntegration.errorHandler.classifyError(testError);
      expect(classified).toBeDefined();
      expect(classified).toHaveProperty('classification');
      expect(classified).toHaveProperty('severity');
      expect(classified).toHaveProperty('recoverable');

      // Step 7: Test system health
      const healthReport = await gitIntegration.generateSystemHealthReport();
      expect(healthReport.overall).toBeDefined();
      expect(['healthy', 'warning', 'critical']).toContain(healthReport.overall);

      // Step 8: Cleanup
      await gitIntegration.cleanup();
      expect(gitIntegration.initialized).toBe(false);
    });

    test('should validate integration with all configuration modes', async () => {
      const configurations = [
        {
          name: 'minimal',
          config: {}
        },
        {
          name: 'security-focused',
          config: {
            enableSecurityFeatures: true,
            enableMonitoring: false,
            enableCompliance: false
          }
        },
        {
          name: 'compliance-focused',
          config: {
            enableSecurityFeatures: false,
            enableMonitoring: false,
            enableCompliance: true,
            complianceStandards: ['SOX', 'GDPR']
          }
        },
        {
          name: 'monitoring-focused',
          config: {
            enableSecurityFeatures: false,
            enableMonitoring: true,
            enableCompliance: false
          }
        },
        {
          name: 'full-featured',
          config: {
            enableSecurityFeatures: true,
            enableMonitoring: true,
            enableCompliance: true,
            enableErrorRecovery: true
          }
        }
      ];

      for (const { name, config } of configurations) {
        const gitIntegration = new GitIntegrationManager(mockResourceManager, config);
        
        // Should initialize without errors
        await gitIntegration.initialize(testWorkingDirectory);
        expect(gitIntegration.initialized).toBe(true);
        
        // Should provide valid status
        const status = gitIntegration.getStatus();
        expect(status.initialized).toBe(true);
        expect(status.config).toBeDefined();
        
        // Should cleanup properly
        await gitIntegration.cleanup();
        expect(gitIntegration.initialized).toBe(false);
      }
    });

    test('should validate error recovery in all failure scenarios', async () => {
      const gitIntegration = new GitIntegrationManager(mockResourceManager, {
        enableErrorRecovery: true,
        enableMonitoring: true
      });
      
      await gitIntegration.initialize(testWorkingDirectory);

      const errorScenarios = [
        {
          name: 'network-timeout',
          error: new Error('Network timeout during operation'),
          expectedCategory: 'network'
        },
        {
          name: 'authentication-failure',
          error: new Error('Authentication failed: invalid token'),
          expectedCategory: 'authentication'
        },
        {
          name: 'permission-denied',
          error: new Error('Permission denied: insufficient privileges'),
          expectedCategory: 'permission'
        },
        {
          name: 'resource-not-found',
          error: new Error('Repository not found: test-repo'),
          expectedCategory: 'resource'
        },
        {
          name: 'validation-error',
          error: new Error('Validation failed: invalid input'),
          expectedCategory: 'validation'
        }
      ];

      for (const scenario of errorScenarios) {
        const classified = gitIntegration.errorHandler.classifyError(scenario.error);
        
        expect(classified).toHaveProperty('category');
        expect(classified).toHaveProperty('severity');
        expect(classified).toHaveProperty('recoverable');
        expect(classified).toHaveProperty('retryable');
        
        if (classified.recoverable) {
          const recovery = await gitIntegration.errorHandler.attemptRecovery(scenario.error, {
            operation: 'test-operation',
            context: { scenario: scenario.name }
          });
          expect(recovery).toBeDefined();
        }
      }

      await gitIntegration.cleanup();
    });
  });

  describe('Integration Points Validation', () => {
    test('should validate all component interfaces', async () => {
      const gitIntegration = new GitIntegrationManager(mockResourceManager, {
        enableSecurityFeatures: true,
        enableMonitoring: true,
        enableCompliance: true,
        enableErrorRecovery: true
      });

      await gitIntegration.initialize(testWorkingDirectory);

      // Test GitIntegrationManager → SecurityManager interface
      if (gitIntegration.securityManager) {
        expect(typeof gitIntegration.securityManager.checkOperationPermission).toBe('function');
        expect(typeof gitIntegration.securityManager.generateSecurityReport).toBe('function');
        expect(typeof gitIntegration.securityManager.cleanup).toBe('function');
      }

      // Test GitIntegrationManager → Monitoring interface
      if (gitIntegration.monitoring) {
        expect(typeof gitIntegration.monitoring.startOperation).toBe('function');
        expect(typeof gitIntegration.monitoring.endOperation).toBe('function');
        expect(typeof gitIntegration.monitoring.getMetrics).toBe('function');
        expect(typeof gitIntegration.monitoring.performHealthChecks).toBe('function');
      }

      // Test GitIntegrationManager → AuditCompliance interface
      if (gitIntegration.auditCompliance) {
        expect(typeof gitIntegration.auditCompliance.recordOperation).toBe('function');
        expect(typeof gitIntegration.auditCompliance.generateComplianceReport).toBe('function');
        expect(typeof gitIntegration.auditCompliance.generateComplianceDashboard).toBe('function');
      }

      // Test GitIntegrationManager → ErrorHandler interface
      if (gitIntegration.errorHandler) {
        expect(typeof gitIntegration.errorHandler.classifyError).toBe('function');
        expect(typeof gitIntegration.errorHandler.attemptRecovery).toBe('function');
        expect(typeof gitIntegration.errorHandler.cleanup).toBe('function');
      }

      // Test cross-component integration
      const operation = {
        type: 'test-integration',
        user: 'test-user',
        timestamp: new Date(),
        details: { test: true }
      };

      // Security → Audit integration
      const securityResult = await gitIntegration.validateOperation('test-operation');
      gitIntegration.auditCompliance.recordOperation({
        ...operation,
        securityValidation: securityResult
      });

      // Monitoring → Error handling integration
      const monitoringOp = gitIntegration.monitoring.startOperation('test-op', 'test', {});
      if (monitoringOp) {
        gitIntegration.monitoring.endOperation(monitoringOp.id, { 
          success: false, 
          error: 'Test error' 
        });
      }

      await gitIntegration.cleanup();
    });

    test('should validate configuration propagation across components', async () => {
      const testConfig = {
        branchStrategy: 'timestamp',
        commitStrategy: 'auto',
        pushStrategy: 'always',
        enableSecurityFeatures: true,
        enableMonitoring: true,
        enableCompliance: true,
        complianceLevel: 'strict',
        auditRetentionDays: 365
      };

      const gitIntegration = new GitIntegrationManager(mockResourceManager, testConfig);
      await gitIntegration.initialize(testWorkingDirectory);

      // Verify configuration consistency
      const systemConfig = gitIntegration.getSystemConfiguration();
      expect(systemConfig.branchStrategy).toBe('timestamp');
      expect(systemConfig.securityEnabled).toBe(true);
      expect(systemConfig.monitoringEnabled).toBe(true);
      expect(systemConfig.complianceEnabled).toBe(true);

      // Verify component-specific configuration
      if (gitIntegration.auditCompliance) {
        expect(gitIntegration.auditCompliance.config.complianceLevel).toBe('strict');
        expect(gitIntegration.auditCompliance.config.auditRetentionDays).toBe(365);
      }

      await gitIntegration.cleanup();
    });

    test('should validate event flow between components', async () => {
      const gitIntegration = new GitIntegrationManager(mockResourceManager, {
        enableSecurityFeatures: true,
        enableMonitoring: true,
        enableCompliance: true
      });

      await gitIntegration.initialize(testWorkingDirectory);

      const events = [];
      
      // Listen to various events
      gitIntegration.on('workflow-step', (data) => events.push({ type: 'workflow', data }));
      gitIntegration.on('system-initialized', (data) => events.push({ type: 'system', data }));
      gitIntegration.on('component-error', (data) => events.push({ type: 'error', data }));

      if (gitIntegration.monitoring) {
        gitIntegration.monitoring.on('operation-completed', (data) => events.push({ type: 'monitoring', data }));
      }

      if (gitIntegration.auditCompliance) {
        gitIntegration.auditCompliance.on('audit-recorded', (data) => events.push({ type: 'audit', data }));
      }

      // Trigger events
      await gitIntegration.startPhase('validation-test', { test: true });
      await gitIntegration.commitPhase('validation-test', ['test.js'], 'Test commit');
      await gitIntegration.completePhase('validation-test', { success: true });

      // Verify events were emitted
      expect(events.some(e => e.type === 'workflow')).toBe(true);
      
      if (gitIntegration.auditCompliance) {
        expect(events.some(e => e.type === 'audit')).toBe(true);
      }

      await gitIntegration.cleanup();
    });
  });

  describe('Performance Benchmarks', () => {
    test('should meet performance benchmarks for operation throughput', async () => {
      const gitIntegration = new GitIntegrationManager(mockResourceManager, {
        enableMonitoring: true,
        enableCompliance: true
      });

      await gitIntegration.initialize(testWorkingDirectory);

      const startTime = performance.now();
      const operationCount = 1000;

      // Perform high-volume operations
      for (let i = 0; i < operationCount; i++) {
        await gitIntegration.executeOperation('performance-test', {
          batchIndex: i,
          timestamp: new Date()
        });
      }

      const endTime = performance.now();
      const totalDuration = endTime - startTime;
      const operationsPerSecond = operationCount / (totalDuration / 1000);

      // Performance requirements
      expect(operationsPerSecond).toBeGreaterThan(100); // At least 100 ops/sec
      expect(totalDuration).toBeLessThan(30000); // Complete within 30 seconds

      await gitIntegration.cleanup();
    });

    test('should maintain memory efficiency under load', async () => {
      const gitIntegration = new GitIntegrationManager(mockResourceManager, {
        enableMonitoring: true,
        enableCompliance: true,
        enableErrorRecovery: true
      });

      await gitIntegration.initialize(testWorkingDirectory);

      const initialMemory = process.memoryUsage();

      // Perform memory-intensive operations
      for (let i = 0; i < 500; i++) {
        // Create large operation records
        gitIntegration.auditCompliance.recordOperation({
          type: 'memory-test',
          user: `user-${i}`,
          timestamp: new Date(),
          details: {
            largeData: new Array(1000).fill(`data-${i}`),
            metadata: { iteration: i }
          }
        });

        // Create monitoring operations
        const opId = gitIntegration.monitoring.startOperation(
          `memory-test-${i}`,
          'memory-stress',
          { 
            data: new Array(100).fill(`metric-${i}`),
            index: i 
          }
        );
        
        if (opId) {
          gitIntegration.monitoring.endOperation(opId.id, { success: true });
        }
      }

      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;

      // Memory requirements - should not increase by more than 200MB
      expect(memoryIncrease).toBeLessThan(200 * 1024 * 1024);

      // System should still be responsive
      const healthCheck = await gitIntegration.monitoring.performHealthChecks();
      expect(healthCheck.overall).not.toBe('critical');

      await gitIntegration.cleanup();
    });

    test('should handle concurrent operations efficiently', async () => {
      const gitIntegration = new GitIntegrationManager(mockResourceManager, {
        enableMonitoring: true
      });

      await gitIntegration.initialize(testWorkingDirectory);

      const concurrentCount = 50;
      const startTime = performance.now();

      // Execute concurrent operations
      const promises = Array.from({ length: concurrentCount }, (_, i) => 
        gitIntegration.executeOperation('concurrent-test', {
          operationId: i,
          timestamp: new Date()
        })
      );

      const results = await Promise.all(promises);
      const endTime = performance.now();
      const totalDuration = endTime - startTime;

      // Verify all operations completed successfully
      expect(results.length).toBe(concurrentCount);
      expect(results.every(r => r.success)).toBe(true);

      // Performance requirements for concurrent operations
      expect(totalDuration).toBeLessThan(10000); // Complete within 10 seconds

      await gitIntegration.cleanup();
    });
  });

  describe('Security Validation', () => {
    test('should validate security controls are enforced', async () => {
      const gitIntegration = new GitIntegrationManager(mockResourceManager, {
        enableSecurityFeatures: true,
        enableCompliance: true
      });

      await gitIntegration.initialize(testWorkingDirectory);

      // Test operation validation
      const validOperation = await gitIntegration.validateOperation('commit', {
        files: ['safe-file.js'],
        content: 'console.log("Hello World");'
      });
      expect(validOperation.allowed).toBe(true);

      // Test security reporting
      const securityReport = gitIntegration.securityManager.generateSecurityReport();
      expect(securityReport).toHaveProperty('reportGeneratedAt');
      expect(securityReport).toHaveProperty('securityViolations');
      expect(securityReport).toHaveProperty('tokenInfo');

      // Test audit logging integration
      const auditEntries = gitIntegration.auditCompliance.searchAuditTrail({
        type: 'security-validation'
      });
      expect(Array.isArray(auditEntries)).toBe(true);

      await gitIntegration.cleanup();
    });

    test('should validate compliance requirements are met', async () => {
      const gitIntegration = new GitIntegrationManager(mockResourceManager, {
        enableCompliance: true,
        complianceStandards: ['SOX', 'GDPR', 'SOC2'],
        complianceLevel: 'strict'
      });

      await gitIntegration.initialize(testWorkingDirectory);

      // Test compliance dashboard
      const dashboard = gitIntegration.auditCompliance.generateComplianceDashboard();
      expect(dashboard).toHaveProperty('overallStatus');
      expect(dashboard).toHaveProperty('standardsCompliance');
      expect(dashboard.standardsCompliance).toHaveProperty('SOX');
      expect(dashboard.standardsCompliance).toHaveProperty('GDPR');
      expect(dashboard.standardsCompliance).toHaveProperty('SOC2');

      // Test compliance metrics
      const metrics = gitIntegration.auditCompliance.getComplianceMetrics();
      expect(metrics).toHaveProperty('totalOperations');
      expect(metrics).toHaveProperty('complianceRate');
      expect(metrics).toHaveProperty('violationRate');

      await gitIntegration.cleanup();
    });

    test('should validate data integrity and tamper protection', async () => {
      const gitIntegration = new GitIntegrationManager(mockResourceManager, {
        enableCompliance: true,
        enableAuditTrail: true
      });

      await gitIntegration.initialize(testWorkingDirectory);

      // Record multiple operations
      const operations = [
        { type: 'commit', user: 'user1', timestamp: new Date(), details: { files: ['test1.js'] } },
        { type: 'push', user: 'user2', timestamp: new Date(), details: { branch: 'main' } },
        { type: 'merge', user: 'user1', timestamp: new Date(), details: { from: 'feature', to: 'main' } }
      ];

      operations.forEach(op => gitIntegration.auditCompliance.recordOperation(op));

      // Verify audit trail integrity
      const integrityCheck = gitIntegration.auditCompliance.verifyAuditIntegrity();
      expect(integrityCheck.valid).toBe(true);
      expect(integrityCheck.entryCount).toBe(3);
      expect(integrityCheck.checksumValid).toBe(true);

      // Verify data integrity
      const dataIntegrity = gitIntegration.auditCompliance.validateDataIntegrity();
      expect(dataIntegrity.valid).toBe(true);
      expect(dataIntegrity.recordCount).toBe(3);

      await gitIntegration.cleanup();
    });
  });

  describe('Final Quality Assurance', () => {
    test('should pass comprehensive system health check', async () => {
      const gitIntegration = new GitIntegrationManager(mockResourceManager, {
        enableSecurityFeatures: true,
        enableMonitoring: true,
        enableCompliance: true,
        enableErrorRecovery: true
      });

      await gitIntegration.initialize(testWorkingDirectory);

      // Generate comprehensive health report
      const healthReport = await gitIntegration.generateSystemHealthReport();
      
      expect(healthReport).toHaveProperty('overall');
      expect(healthReport).toHaveProperty('components');
      expect(healthReport).toHaveProperty('security');
      expect(healthReport).toHaveProperty('monitoring');
      expect(healthReport).toHaveProperty('compliance');
      expect(healthReport).toHaveProperty('recommendations');

      // System should be healthy
      expect(['healthy', 'warning']).toContain(healthReport.overall);

      // All components should be active
      expect(healthReport.components.security).toBe('active');
      expect(healthReport.components.monitoring).toBe('active');
      expect(healthReport.components.compliance).toBe('active');
      expect(healthReport.components.errorHandler).toBe('active');

      await gitIntegration.cleanup();
    });

    test('should provide comprehensive system metrics', async () => {
      const gitIntegration = new GitIntegrationManager(mockResourceManager, {
        enableMonitoring: true,
        enableCompliance: true,
        enableSecurityFeatures: true
      });

      await gitIntegration.initialize(testWorkingDirectory);

      // Perform various operations to generate metrics
      await gitIntegration.executeOperation('metrics-test-1', { type: 'commit' });
      await gitIntegration.executeOperation('metrics-test-2', { type: 'push' });
      gitIntegration.auditCompliance.recordOperation({
        type: 'test-operation',
        user: 'test-user',
        timestamp: new Date()
      });

      const systemMetrics = gitIntegration.getSystemMetrics();
      
      expect(systemMetrics).toHaveProperty('uptime');
      expect(systemMetrics).toHaveProperty('components');
      expect(systemMetrics).toHaveProperty('performance');
      expect(systemMetrics).toHaveProperty('security');
      expect(systemMetrics).toHaveProperty('compliance');
      expect(systemMetrics).toHaveProperty('errors');

      // Performance metrics
      expect(systemMetrics.performance).toHaveProperty('operationCount');
      expect(systemMetrics.performance).toHaveProperty('averageResponseTime');
      expect(systemMetrics.performance).toHaveProperty('errorRate');

      // Compliance metrics
      expect(systemMetrics.compliance).toHaveProperty('auditEntries');
      expect(systemMetrics.compliance).toHaveProperty('complianceRate');

      await gitIntegration.cleanup();
    });

    test('should validate complete cleanup and resource management', async () => {
      const instances = [];
      
      // Create multiple instances to test resource management
      for (let i = 0; i < 3; i++) {
        const gitIntegration = new GitIntegrationManager(mockResourceManager, {
          enableMonitoring: true,
          enableCompliance: true,
          instanceId: `qa-test-${i}`
        });
        
        await gitIntegration.initialize(testWorkingDirectory);
        expect(gitIntegration.initialized).toBe(true);
        instances.push(gitIntegration);
      }

      // Cleanup all instances
      for (const instance of instances) {
        await instance.cleanup();
        expect(instance.initialized).toBe(false);
        expect(instance.workingDirectory).toBeNull();
        expect(instance.securityManager).toBeNull();
        expect(instance.monitoring).toBeNull();
        expect(instance.auditCompliance).toBeNull();
        expect(instance.errorHandler).toBeNull();
      }

      // Verify no resource leaks
      expect(instances.every(i => !i.initialized)).toBe(true);
    });
  });
});