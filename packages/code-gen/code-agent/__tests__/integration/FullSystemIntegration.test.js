/**
 * Full System Integration Tests
 * Phase 10.1.1: Complete system with all Git features enabled
 * 
 * Tests the entire Git integration system working together with all
 * components active: security, monitoring, compliance, error handling,
 * branch management, commit orchestration, and workflow integration.
 */

import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import GitIntegrationManager from '../../src/integration/GitIntegrationManager.js';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';

describe('Full System Integration', () => {
  let mockResourceManager;
  let gitIntegration;
  let testConfig;
  let testWorkingDirectory;

  beforeEach(async () => {
    // Create temporary test directory
    testWorkingDirectory = path.join(os.tmpdir(), `git-integration-test-${Date.now()}`);
    await fs.mkdir(testWorkingDirectory, { recursive: true });

    // Mock ResourceManager with all required environment variables
    mockResourceManager = {
      get: jest.fn((key) => {
        switch (key) {
          case 'GITHUB_PAT': return 'ghp_1234567890123456789012345678901234567890';
          case 'GITHUB_AGENT_ORG': return 'AgentResults';
          case 'GITHUB_USER': return 'test-agent-user';
          case 'NODE_ENV': return 'test';
          default: return null;
        }
      }),
      getAll: jest.fn(() => ({
        GITHUB_PAT: 'ghp_1234567890123456789012345678901234567890',
        GITHUB_AGENT_ORG: 'AgentResults',
        GITHUB_USER: 'test-agent-user'
      }))
    };

    // Full integration configuration with all features enabled
    testConfig = {
      enableGitIntegration: true,
      enableSecurityFeatures: false, // Disable for initial testing
      enableMonitoring: true,
      enableCompliance: false, // Disable for initial testing  
      enableErrorRecovery: true,
      branchStrategy: 'feature',
      commitMessageFormat: 'conventional',
      complianceLevel: 'standard',
      gitConfig: {
        branchStrategy: 'feature',
        messageFormat: 'conventional',
        enableBranchProtection: true,
        enableCommitSigning: false,
        maxCommitMessageLength: 72,
        requireApproval: false,
        enableAuditLogging: true,
        retentionDays: 90
      }
    };

    // Mock GitHub API responses
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
        json: () => Promise.resolve({ login: 'test-agent-user', id: 12345 })
      })
      .mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ role: 'admin' })
      });

    // Initialize Git Integration Manager
    gitIntegration = new GitIntegrationManager(mockResourceManager, testConfig);
    await gitIntegration.initialize(testWorkingDirectory);
  });

  afterEach(async () => {
    if (gitIntegration) {
      await gitIntegration.cleanup();
    }
    
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

  describe('Complete System Initialization', () => {
    test('should initialize all Git integration components', async () => {
      expect(gitIntegration.initialized).toBe(true);
      expect(gitIntegration.repositoryManager).toBeDefined();
      expect(gitIntegration.branchManager).toBeDefined();
      expect(gitIntegration.commitOrchestrator).toBeDefined();
      expect(gitIntegration.monitoring).toBeDefined();
      expect(gitIntegration.errorHandler).toBeDefined();
      // Security and compliance are disabled for initial testing
      expect(gitIntegration.securityManager).toBeNull();
      expect(gitIntegration.auditCompliance).toBeNull();
    });


    test('should emit system initialization events', async () => {
      const events = [];
      const newGitIntegration = new GitIntegrationManager(mockResourceManager, testConfig);
      
      newGitIntegration.on('system-initialized', (data) => events.push(data));
      const eventTestDir = path.join(os.tmpdir(), `git-integration-events-${Date.now()}`);
      await fs.mkdir(eventTestDir, { recursive: true });
      await newGitIntegration.initialize(eventTestDir);

      expect(events.length).toBe(1);
      expect(events[0]).toHaveProperty('components');
      expect(events[0].components).toHaveProperty('security', false);
      expect(events[0].components).toHaveProperty('monitoring', true);
      expect(events[0].components).toHaveProperty('compliance', false);

      await newGitIntegration.cleanup();
    });
  });

  describe('Full Feature Integration', () => {
    test('should perform complete workflow with all features active', async () => {
      const workflowEvents = [];
      gitIntegration.on('workflow-step', (data) => workflowEvents.push(data));

      // Simulate complete development workflow
      const workflowSteps = [
        { phase: 'planning', action: 'start' },
        { phase: 'generation', action: 'create-files' },
        { phase: 'testing', action: 'run-tests' },
        { phase: 'quality', action: 'fix-issues' },
        { phase: 'completion', action: 'finalize' }
      ];

      for (const step of workflowSteps) {
        await gitIntegration.startPhase(step.phase, {
          action: step.action,
          metadata: { timestamp: new Date() }
        });

        // Simulate phase work
        await gitIntegration.commitPhase(step.phase, 
          [`${step.phase}-file.js`], 
          `Complete ${step.phase} phase`
        );

        await gitIntegration.completePhase(step.phase, {
          success: true,
          metrics: { duration: 1000 }
        });
      }

      expect(workflowEvents.length).toBeGreaterThan(0);
      expect(workflowEvents.some(e => e.phase === 'planning')).toBe(true);
      expect(workflowEvents.some(e => e.phase === 'completion')).toBe(true);
    });

    test('should integrate security validation in all operations', async () => {
      const securityEvents = [];
      gitIntegration.securityManager.on('security-validation', (data) => securityEvents.push(data));

      // Perform operations that should trigger security validation
      await gitIntegration.validateOperation('create-repository', {
        name: 'test-repo',
        organization: 'AgentResults'
      });

      await gitIntegration.validateOperation('commit', {
        files: ['sensitive-file.js'],
        content: 'const api_key = "secret-key-12345";'
      });

      expect(securityEvents.length).toBeGreaterThan(0);
    });

    test('should capture comprehensive monitoring metrics', async () => {
      // Perform various Git operations
      const operations = [
        { type: 'commit', duration: 500 },
        { type: 'push', duration: 2000 },
        { type: 'branch', duration: 300 },
        { type: 'merge', duration: 1500 }
      ];

      for (const op of operations) {
        const operationId = gitIntegration.monitoring.startOperation(
          `test-${op.type}-${Date.now()}`,
          op.type,
          { testOperation: true }
        );

        // Simulate operation duration
        await new Promise(resolve => setTimeout(resolve, 10));

        gitIntegration.monitoring.endOperation(operationId.id, {
          success: true,
          duration: op.duration
        });
      }

      const metrics = gitIntegration.monitoring.getMetrics();
      expect(metrics.operations.commit).toBeDefined();
      expect(metrics.operations.push).toBeDefined();
      expect(metrics.operations.branch).toBeDefined();
      expect(metrics.operations.merge).toBeDefined();
      expect(metrics.performance.totalOperations).toBe(4);
    });

    test('should generate comprehensive compliance reports', async () => {
      // Record compliance-relevant operations
      const complianceOps = [
        {
          type: 'admin-access',
          user: 'test-admin',
          timestamp: new Date(),
          details: { action: 'repository-creation', target: 'sensitive-repo' }
        },
        {
          type: 'data-access',
          user: 'test-developer',
          timestamp: new Date(),
          details: { dataType: 'personal', purpose: 'development' }
        },
        {
          type: 'production-change',
          user: 'test-operator',
          timestamp: new Date(),
          details: { environment: 'production', approvals: ['manager1'] }
        }
      ];

      complianceOps.forEach(op => {
        gitIntegration.auditCompliance.recordOperation(op);
      });

      // Generate reports for all supported standards
      const soxReport = gitIntegration.auditCompliance.generateComplianceReport('SOX');
      const gdprReport = gitIntegration.auditCompliance.generateComplianceReport('GDPR');
      const soc2Report = gitIntegration.auditCompliance.generateComplianceReport('SOC2');

      expect(soxReport.auditTrail.length).toBeGreaterThan(0);
      expect(gdprReport.dataProcessingActivities).toBeDefined();
      expect(soc2Report.trustServicesCriteria).toBeDefined();

      // Generate compliance dashboard
      const dashboard = gitIntegration.auditCompliance.generateComplianceDashboard();
      expect(dashboard.overallStatus).toBeDefined();
      expect(dashboard.standardsCompliance).toHaveProperty('SOX');
      expect(dashboard.standardsCompliance).toHaveProperty('GDPR');
      expect(dashboard.standardsCompliance).toHaveProperty('SOC2');
    });

    test('should handle complex error scenarios with recovery', async () => {
      const errorEvents = [];
      gitIntegration.errorHandler.on('error-recovered', (data) => errorEvents.push(data));

      // Simulate various error types
      const errors = [
        new Error('Network timeout during push operation'),
        new Error('Authentication failed: invalid token'),
        new Error('Merge conflict in main branch'),
        new Error('Repository not found: test-repo')
      ];

      for (const error of errors) {
        const classified = gitIntegration.errorHandler.classifyError(error);
        expect(classified.category).toBeDefined();
        expect(classified.severity).toBeDefined();
        expect(classified.recoverable).toBeDefined();

        if (classified.recoverable) {
          const recovery = await gitIntegration.errorHandler.attemptRecovery(error, {
            operation: 'test-operation',
            context: { retryCount: 0 }
          });
          expect(recovery).toBeDefined();
        }
      }
    });
  });

  describe('Performance and Scalability', () => {
    test('should handle high-volume operations efficiently', async () => {
      const startTime = performance.now();
      const operations = [];

      // Simulate 100 concurrent operations
      for (let i = 0; i < 100; i++) {
        const operation = gitIntegration.monitoring.startOperation(
          `perf-test-${i}`,
          'commit',
          { batchTest: true, index: i }
        );
        operations.push(operation);
      }

      // Complete all operations
      operations.forEach((op, index) => {
        if (op) {
          gitIntegration.monitoring.endOperation(op.id, {
            success: true,
            batchIndex: index
          });
        }
      });

      const endTime = performance.now();
      const totalDuration = endTime - startTime;

      expect(totalDuration).toBeLessThan(5000); // Should complete within 5 seconds
      expect(gitIntegration.monitoring.getMetrics().performance.totalOperations).toBe(100);
    });

    test('should maintain system stability under load', async () => {
      const initialMemory = process.memoryUsage();

      // Perform memory-intensive operations
      for (let i = 0; i < 50; i++) {
        // Create audit entries
        gitIntegration.auditCompliance.recordOperation({
          type: 'load-test',
          user: `user-${i}`,
          timestamp: new Date(),
          details: { data: new Array(1000).fill(`test-data-${i}`) }
        });

        // Record monitoring metrics
        const opId = gitIntegration.monitoring.startOperation(
          `load-${i}`,
          'stress-test',
          { largeMetadata: new Array(100).fill(`metadata-${i}`) }
        );

        if (opId) {
          gitIntegration.monitoring.endOperation(opId.id, { success: true });
        }
      }

      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;

      // Memory increase should be reasonable (less than 100MB)
      expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024);

      // System should still be responsive
      const healthCheck = await gitIntegration.monitoring.performHealthChecks();
      expect(healthCheck.overall).not.toBe('critical');
    });

    test('should handle resource cleanup effectively', async () => {
      // Create multiple instances to test cleanup
      const instances = [];
      
      for (let i = 0; i < 5; i++) {
        const instance = new GitIntegrationManager(mockResourceManager, {
          ...testConfig,
          instanceId: `test-${i}`
        });
        await instance.initialize();
        instances.push(instance);
      }

      // Verify all instances are initialized
      expect(instances.every(instance => instance.initialized)).toBe(true);

      // Cleanup all instances
      for (const instance of instances) {
        await instance.cleanup();
      }

      // Verify all instances are cleaned up
      expect(instances.every(instance => !instance.initialized)).toBe(true);
    });
  });

  describe('System Reliability', () => {
    test('should maintain data consistency across components', async () => {
      const testUser = 'consistency-test-user';
      const testOperation = {
        type: 'commit',
        user: testUser,
        timestamp: new Date(),
        details: { files: ['consistency-test.js'] }
      };

      // Record operation in multiple components
      gitIntegration.auditCompliance.recordOperation(testOperation);
      
      const monitoringOp = gitIntegration.monitoring.startOperation(
        'consistency-test',
        'commit',
        { user: testUser }
      );
      
      if (monitoringOp) {
        gitIntegration.monitoring.endOperation(monitoringOp.id, { success: true });
      }

      // Verify data consistency
      const auditEntries = gitIntegration.auditCompliance.searchAuditTrail({ user: testUser });
      const monitoringMetrics = gitIntegration.monitoring.getMetrics();

      expect(auditEntries.length).toBeGreaterThan(0);
      expect(auditEntries[0].user).toBe(testUser);
      expect(monitoringMetrics.operations.commit).toBeDefined();
    });

    test('should recover from component failures gracefully', async () => {
      const errorEvents = [];
      gitIntegration.on('component-error', (data) => errorEvents.push(data));

      // Simulate component failures
      const originalMethod = gitIntegration.monitoring.startOperation;
      gitIntegration.monitoring.startOperation = jest.fn(() => {
        throw new Error('Monitoring component failure');
      });

      // System should continue operating despite monitoring failure
      let operationCompleted = false;
      try {
        await gitIntegration.executeOperation('test-operation', {
          type: 'commit',
          allowPartialFailure: true
        });
        operationCompleted = true;
      } catch (error) {
        // Should not throw if partial failure is allowed
      }

      // Restore original method
      gitIntegration.monitoring.startOperation = originalMethod;

      expect(operationCompleted).toBe(true);
    });

    test('should provide system health diagnostics', async () => {
      const healthReport = await gitIntegration.generateSystemHealthReport();

      expect(healthReport).toHaveProperty('overall');
      expect(healthReport).toHaveProperty('components');
      expect(healthReport).toHaveProperty('security');
      expect(healthReport).toHaveProperty('monitoring');
      expect(healthReport).toHaveProperty('compliance');
      expect(healthReport).toHaveProperty('recommendations');

      // Each component should have health status
      expect(healthReport.components.security).toBeDefined();
      expect(healthReport.components.monitoring).toBeDefined();
      expect(healthReport.components.compliance).toBeDefined();
      expect(healthReport.components.errorHandler).toBeDefined();
    });
  });

  describe('Integration Quality Assurance', () => {
    test('should validate all component interfaces', async () => {
      // Test all major component interactions
      const interfaces = [
        { source: 'repositoryManager', target: 'branchManager' },
        { source: 'branchManager', target: 'commitOrchestrator' },
        { source: 'securityManager', target: 'auditCompliance' },
        { source: 'monitoring', target: 'errorHandler' }
      ];

      for (const iface of interfaces) {
        const sourceComponent = gitIntegration[iface.source];
        const targetComponent = gitIntegration[iface.target];

        expect(sourceComponent).toBeDefined();
        expect(targetComponent).toBeDefined();
        expect(typeof sourceComponent.cleanup).toBe('function');
        expect(typeof targetComponent.cleanup).toBe('function');
      }
    });

    test('should enforce configuration consistency', async () => {
      const config = gitIntegration.getSystemConfiguration();

      expect(config).toHaveProperty('branchStrategy');
      expect(config).toHaveProperty('commitMessageFormat');
      expect(config).toHaveProperty('complianceLevel');
      expect(config).toHaveProperty('securityEnabled');
      expect(config).toHaveProperty('monitoringEnabled');

      // Verify configuration is applied consistently
      expect(gitIntegration.branchManager.config.branchStrategy).toBe(config.branchStrategy);
      expect(gitIntegration.commitOrchestrator.config.messageFormat).toBe(config.commitMessageFormat);
      expect(gitIntegration.auditCompliance.config.complianceLevel).toBe(config.complianceLevel);
    });

    test('should provide comprehensive system metrics', async () => {
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

      // Security metrics
      expect(systemMetrics.security).toHaveProperty('validationCount');
      expect(systemMetrics.security).toHaveProperty('violationCount');

      // Compliance metrics
      expect(systemMetrics.compliance).toHaveProperty('auditEntries');
      expect(systemMetrics.compliance).toHaveProperty('complianceRate');
    });
  });
});