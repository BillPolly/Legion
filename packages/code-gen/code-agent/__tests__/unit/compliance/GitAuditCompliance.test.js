/**
 * GitAuditCompliance Unit Tests
 * Phase 9.1.2: Audit and compliance system tests
 * 
 * Tests comprehensive audit trail, compliance reporting,
 * and regulatory compliance features for Git operations.
 */

import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import GitAuditCompliance from '../../../src/compliance/GitAuditCompliance.js';

describe('GitAuditCompliance', () => {
  let auditCompliance;
  let mockResourceManager;
  let mockGitSecurityManager;

  beforeEach(async () => {
    mockResourceManager = {
      get: jest.fn((key) => {
        switch (key) {
          case 'GITHUB_PAT': return 'ghp_test_token';
          case 'GITHUB_AGENT_ORG': return 'TestOrg';
          case 'AUDIT_COMPLIANCE_LEVEL': return 'strict';
          case 'COMPLIANCE_RETENTION_DAYS': return '2555'; // 7 years
          default: return null;
        }
      })
    };

    mockGitSecurityManager = {
      getAuditLog: jest.fn(() => []),
      generateSecurityReport: jest.fn(() => ({
        reportGeneratedAt: new Date().toISOString(),
        securityViolations: []
      })),
      on: jest.fn(),
      removeAllListeners: jest.fn()
    };

    auditCompliance = new GitAuditCompliance(mockResourceManager, {
      enableAuditTrail: true,
      enableComplianceReporting: true,
      enableRegulatory: true,
      complianceStandards: ['SOX', 'GDPR', 'SOC2'],
      auditRetentionDays: 2555, // 7 years
      complianceLevel: 'strict',
      securityManager: mockGitSecurityManager
    });

    await auditCompliance.initialize();
  });

  afterEach(async () => {
    if (auditCompliance) {
      await auditCompliance.cleanup();
    }
  });

  describe('Initialization', () => {
    test('should initialize audit compliance system', async () => {
      expect(auditCompliance.initialized).toBe(true);
      expect(auditCompliance.complianceStandards.size).toBeGreaterThan(0);
      expect(auditCompliance.auditTrail.length).toBe(0);
    });

    test('should emit initialization event', async () => {
      const events = [];
      const newCompliance = new GitAuditCompliance(mockResourceManager, {
        securityManager: mockGitSecurityManager
      });
      
      newCompliance.on('compliance-initialized', (data) => events.push(data));
      await newCompliance.initialize();
      
      expect(events.length).toBe(1);
      expect(events[0]).toHaveProperty('standards');
      expect(events[0]).toHaveProperty('level');
      
      await newCompliance.cleanup();
    });

    test('should register default compliance standards', async () => {
      const expectedStandards = ['SOX', 'GDPR', 'SOC2', 'ISO27001', 'NIST'];
      
      expectedStandards.forEach(standard => {
        expect(auditCompliance.complianceStandards.has(standard)).toBe(true);
      });
    });

    test('should set compliance level correctly', () => {
      expect(auditCompliance.config.complianceLevel).toBe('strict');
    });
  });

  describe('Audit Trail Management', () => {
    test('should record operation audit events', async () => {
      const operation = {
        type: 'commit',
        user: 'test-user',
        timestamp: new Date(),
        details: {
          files: ['test.js'],
          message: 'Test commit'
        }
      };

      auditCompliance.recordOperation(operation);
      
      expect(auditCompliance.auditTrail.length).toBe(1);
      expect(auditCompliance.auditTrail[0]).toHaveProperty('id');
      expect(auditCompliance.auditTrail[0]).toHaveProperty('type', 'commit');
      expect(auditCompliance.auditTrail[0]).toHaveProperty('user', 'test-user');
      expect(auditCompliance.auditTrail[0]).toHaveProperty('complianceLevel');
    });

    test('should emit audit event on operation recording', () => {
      const events = [];
      auditCompliance.on('audit-recorded', (data) => events.push(data));

      const operation = {
        type: 'push',
        user: 'test-user',
        timestamp: new Date()
      };

      auditCompliance.recordOperation(operation);
      
      expect(events.length).toBe(1);
      expect(events[0].type).toBe('push');
    });

    test('should validate audit entries for compliance', () => {
      const validOperation = {
        type: 'commit',
        user: 'test-user',
        timestamp: new Date(),
        details: { files: ['test.js'] }
      };

      const invalidOperation = {
        type: 'commit'
        // Missing required fields
      };

      const validResult = auditCompliance.validateAuditEntry(validOperation);
      const invalidResult = auditCompliance.validateAuditEntry(invalidOperation);

      expect(validResult.valid).toBe(true);
      expect(invalidResult.valid).toBe(false);
      expect(invalidResult.violations.length).toBeGreaterThan(0);
    });

    test('should record compliance violations', async () => {
      const violation = {
        type: 'unauthorized-access',
        severity: 'high',
        description: 'Attempt to access restricted repository',
        user: 'unauthorized-user',
        timestamp: new Date()
      };

      auditCompliance.recordViolation(violation);
      
      expect(auditCompliance.violations.length).toBe(1);
      expect(auditCompliance.violations[0]).toHaveProperty('id');
      expect(auditCompliance.violations[0]).toHaveProperty('type', 'unauthorized-access');
      expect(auditCompliance.violations[0]).toHaveProperty('remediated', false);
    });

    test('should track audit trail integrity', async () => {
      const freshCompliance = new GitAuditCompliance(mockResourceManager, {
        enableAuditTrail: true,
        complianceLevel: 'standard',
        securityManager: mockGitSecurityManager
      });
      await freshCompliance.initialize();

      const operations = [
        { type: 'commit', user: 'user1', timestamp: new Date(), details: { files: ['test1.js'] } },
        { type: 'push', user: 'user2', timestamp: new Date(), details: { branch: 'main' } },
        { type: 'branch', user: 'user1', timestamp: new Date(), details: { name: 'feature' } }
      ];

      operations.forEach(op => freshCompliance.recordOperation(op));
      
      const integrityCheck = freshCompliance.verifyAuditIntegrity();
      
      expect(integrityCheck.valid).toBe(true);
      expect(integrityCheck.entryCount).toBe(3);
      expect(integrityCheck.checksumValid).toBe(true);
      
      await freshCompliance.cleanup();
    });
  });

  describe('Compliance Reporting', () => {
    test('should generate SOX compliance report', async () => {
      // Add test audit data
      const operations = [
        { type: 'commit', user: 'dev1', timestamp: new Date(), details: { files: ['financial.js'] } },
        { type: 'push', user: 'dev1', timestamp: new Date(), details: { branch: 'main' } }
      ];

      operations.forEach(op => auditCompliance.recordOperation(op));

      const soxReport = auditCompliance.generateComplianceReport('SOX');
      
      expect(soxReport).toHaveProperty('standard', 'SOX');
      expect(soxReport).toHaveProperty('reportPeriod');
      expect(soxReport).toHaveProperty('auditTrail');
      expect(soxReport).toHaveProperty('controlsAssessment');
      expect(soxReport).toHaveProperty('complianceStatus');
      expect(soxReport.auditTrail.length).toBe(2);
    });

    test('should generate GDPR compliance report', async () => {
      // Add data processing operations
      const operations = [
        { 
          type: 'data-access', 
          user: 'analyst1', 
          timestamp: new Date(),
          details: { dataTypes: ['personal'], purpose: 'analysis' }
        }
      ];

      operations.forEach(op => auditCompliance.recordOperation(op));

      const gdprReport = auditCompliance.generateComplianceReport('GDPR');
      
      expect(gdprReport).toHaveProperty('standard', 'GDPR');
      expect(gdprReport).toHaveProperty('dataProcessingActivities');
      expect(gdprReport).toHaveProperty('consentManagement');
      expect(gdprReport).toHaveProperty('dataRetention');
      expect(gdprReport).toHaveProperty('rightsRequests');
    });

    test('should generate SOC2 compliance report', async () => {
      const soc2Report = auditCompliance.generateComplianceReport('SOC2');
      
      expect(soc2Report).toHaveProperty('standard', 'SOC2');
      expect(soc2Report).toHaveProperty('trustServicesCriteria');
      expect(soc2Report).toHaveProperty('securityControls');
      expect(soc2Report).toHaveProperty('availabilityMetrics');
      expect(soc2Report).toHaveProperty('confidentialityControls');
    });

    test('should generate comprehensive compliance dashboard', async () => {
      // Add various audit data
      const operations = [
        { type: 'commit', user: 'dev1', timestamp: new Date() },
        { type: 'admin-access', user: 'admin1', timestamp: new Date() }
      ];

      operations.forEach(op => auditCompliance.recordOperation(op));

      const dashboard = auditCompliance.generateComplianceDashboard();
      
      expect(dashboard).toHaveProperty('overallStatus');
      expect(dashboard).toHaveProperty('standardsCompliance');
      expect(dashboard).toHaveProperty('riskAssessment');
      expect(dashboard).toHaveProperty('recentActivity');
      expect(dashboard).toHaveProperty('pendingActions');
      expect(dashboard.standardsCompliance).toHaveProperty('SOX');
      expect(dashboard.standardsCompliance).toHaveProperty('GDPR');
      expect(dashboard.standardsCompliance).toHaveProperty('SOC2');
    });

    test('should include security manager data in reports', async () => {
      mockGitSecurityManager.getAuditLog.mockReturnValue([
        { type: 'security-event', timestamp: new Date().toISOString() }
      ]);

      const report = auditCompliance.generateComplianceReport('SOX');
      
      expect(report).toHaveProperty('securityEvents');
      expect(report.securityEvents.length).toBe(1);
    });
  });

  describe('Regulatory Compliance', () => {
    test('should assess compliance with data retention requirements', () => {
      const now = new Date();
      const operations = [
        { 
          type: 'data-creation', 
          timestamp: new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000), // 1 year ago
          details: { dataType: 'financial' }
        },
        { 
          type: 'data-deletion', 
          timestamp: new Date(now.getTime() - 10 * 365 * 24 * 60 * 60 * 1000), // 10 years ago
          details: { dataType: 'personal' }
        }
      ];

      operations.forEach(op => auditCompliance.recordOperation(op));

      const retentionAssessment = auditCompliance.assessDataRetentionCompliance();
      
      expect(retentionAssessment).toHaveProperty('compliant');
      expect(retentionAssessment).toHaveProperty('violations');
      expect(retentionAssessment).toHaveProperty('recommendations');
    });

    test('should validate access controls compliance', async () => {
      const accessEvents = [
        { 
          type: 'repository-access', 
          user: 'dev1', 
          timestamp: new Date(),
          details: { repository: 'sensitive-repo', permissions: ['read'] }
        },
        {
          type: 'admin-access',
          user: 'admin1',
          timestamp: new Date(),
          details: { action: 'user-management', target: 'dev2' }
        }
      ];

      accessEvents.forEach(event => auditCompliance.recordOperation(event));

      const accessCompliance = auditCompliance.validateAccessControls();
      
      expect(accessCompliance).toHaveProperty('compliant');
      expect(accessCompliance).toHaveProperty('segregationOfDuties');
      expect(accessCompliance).toHaveProperty('leastPrivilege');
      expect(accessCompliance).toHaveProperty('accessReviews');
    });

    test('should monitor change management compliance', () => {
      const changes = [
        {
          type: 'production-change',
          user: 'dev1',
          timestamp: new Date(),
          details: {
            environment: 'production',
            approvals: ['manager1', 'security1'],
            testing: 'completed'
          }
        }
      ];

      changes.forEach(change => auditCompliance.recordOperation(change));

      const changeCompliance = auditCompliance.assessChangeManagement();
      
      expect(changeCompliance).toHaveProperty('compliant');
      expect(changeCompliance).toHaveProperty('approvalProcess');
      expect(changeCompliance).toHaveProperty('testingRequired');
      expect(changeCompliance).toHaveProperty('rollbackCapability');
    });

    test('should generate regulatory risk assessment', () => {
      const riskAssessment = auditCompliance.generateRiskAssessment();
      
      expect(riskAssessment).toHaveProperty('overallRisk');
      expect(riskAssessment).toHaveProperty('riskFactors');
      expect(riskAssessment).toHaveProperty('mitigationStrategies');
      expect(riskAssessment).toHaveProperty('complianceGaps');
      expect(['low', 'medium', 'high', 'critical']).toContain(riskAssessment.overallRisk);
    });
  });

  describe('Audit Search and Filtering', () => {
    test('should search audit trail by criteria', async () => {
      // Create fresh compliance instance for this test to avoid pollution
      const freshCompliance = new GitAuditCompliance(mockResourceManager, {
        enableAuditTrail: true,
        complianceLevel: 'standard', // Use standard to avoid extra violation entries
        securityManager: mockGitSecurityManager
      });
      await freshCompliance.initialize();

      const operations = [
        { type: 'commit', user: 'dev1', timestamp: new Date(), details: { files: ['test1.js'] } },
        { type: 'push', user: 'dev2', timestamp: new Date(), details: { branch: 'main' } },
        { type: 'commit', user: 'dev1', timestamp: new Date(), details: { files: ['test2.js'] } }
      ];

      operations.forEach(op => freshCompliance.recordOperation(op));

      const commitOps = freshCompliance.searchAuditTrail({ type: 'commit' });
      const dev1Ops = freshCompliance.searchAuditTrail({ user: 'dev1' });

      expect(commitOps.length).toBe(2);
      expect(dev1Ops.length).toBe(2);
      
      await freshCompliance.cleanup();
    });

    test('should filter audit trail by date range', async () => {
      const freshCompliance = new GitAuditCompliance(mockResourceManager, {
        enableAuditTrail: true,
        complianceLevel: 'standard',
        securityManager: mockGitSecurityManager
      });
      await freshCompliance.initialize();

      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const lastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      const operations = [
        { type: 'commit', user: 'dev1', timestamp: now, details: { files: ['test1.js'] } },
        { type: 'push', user: 'dev1', timestamp: yesterday, details: { branch: 'main' } },
        { type: 'branch', user: 'dev1', timestamp: lastWeek, details: { name: 'feature' } }
      ];

      operations.forEach(op => freshCompliance.recordOperation(op));

      const recentOps = freshCompliance.searchAuditTrail({
        startDate: yesterday,
        endDate: now
      });

      expect(recentOps.length).toBe(2);
      
      await freshCompliance.cleanup();
    });

    test('should export audit trail for external systems', async () => {
      const freshCompliance = new GitAuditCompliance(mockResourceManager, {
        enableAuditTrail: true,
        complianceLevel: 'standard',
        securityManager: mockGitSecurityManager
      });
      await freshCompliance.initialize();

      const operations = [
        { type: 'commit', user: 'dev1', timestamp: new Date(), details: { files: ['test1.js'] } },
        { type: 'push', user: 'dev1', timestamp: new Date(), details: { branch: 'main' } }
      ];

      operations.forEach(op => freshCompliance.recordOperation(op));

      const csvExport = freshCompliance.exportAuditTrail('csv');
      const jsonExport = freshCompliance.exportAuditTrail('json');

      expect(csvExport).toContain('type,user,timestamp');
      expect(csvExport).toContain('commit,dev1');
      
      expect(jsonExport).toBeDefined();
      const parsedJson = JSON.parse(jsonExport);
      expect(Array.isArray(parsedJson)).toBe(true);
      expect(parsedJson.length).toBe(2);
      
      await freshCompliance.cleanup();
    });
  });

  describe('Compliance Monitoring', () => {
    test('should monitor compliance violations in real-time', async () => {
      const events = [];
      auditCompliance.on('compliance-violation', (data) => events.push(data));

      const violation = {
        type: 'unauthorized-deletion',
        severity: 'critical',
        user: 'unknown-user',
        timestamp: new Date()
      };

      auditCompliance.recordViolation(violation);
      
      expect(events.length).toBe(1);
      expect(events[0].severity).toBe('critical');
    });

    test('should track compliance metrics', async () => {
      const freshCompliance = new GitAuditCompliance(mockResourceManager, {
        enableAuditTrail: true,
        complianceLevel: 'standard',
        securityManager: mockGitSecurityManager
      });
      await freshCompliance.initialize();

      const operations = Array.from({ length: 100 }, (_, i) => ({
        type: i % 2 === 0 ? 'commit' : 'push',
        user: `dev${i % 5}`,
        timestamp: new Date(),
        details: { files: [`test${i}.js`] }
      }));

      operations.forEach(op => freshCompliance.recordOperation(op));

      const metrics = freshCompliance.getComplianceMetrics();
      
      expect(metrics).toHaveProperty('totalOperations', 100);
      expect(metrics).toHaveProperty('complianceRate');
      expect(metrics).toHaveProperty('violationRate');
      expect(metrics).toHaveProperty('userActivity');
      expect(metrics.userActivity).toHaveProperty('dev0');
      
      await freshCompliance.cleanup();
    });

    test('should schedule compliance assessments', async () => {
      const assessments = [];
      auditCompliance.on('scheduled-assessment', (data) => assessments.push(data));

      auditCompliance.scheduleComplianceAssessment('SOX', {
        frequency: 'quarterly',
        nextAssessment: new Date(Date.now() + 24 * 60 * 60 * 1000)
      });

      expect(auditCompliance.scheduledAssessments.size).toBe(1);
      expect(auditCompliance.scheduledAssessments.has('SOX')).toBe(true);
    });
  });

  describe('Data Management', () => {
    test('should clean up expired audit records', () => {
      const now = new Date();
      const oldDate = new Date(now.getTime() - (auditCompliance.config.auditRetentionDays + 1) * 24 * 60 * 60 * 1000);

      auditCompliance.auditTrail.push(
        {
          id: 'old-1',
          type: 'commit',
          timestamp: oldDate
        },
        {
          id: 'recent-1',
          type: 'push',
          timestamp: now
        }
      );

      auditCompliance.cleanupExpiredRecords();
      
      expect(auditCompliance.auditTrail.length).toBe(1);
      expect(auditCompliance.auditTrail[0].id).toBe('recent-1');
    });

    test('should archive audit data for long-term storage', async () => {
      const freshCompliance = new GitAuditCompliance(mockResourceManager, {
        enableAuditTrail: true,
        complianceLevel: 'standard',
        securityManager: mockGitSecurityManager
      });
      await freshCompliance.initialize();

      const operations = Array.from({ length: 50 }, (_, i) => ({
        type: 'commit',
        user: 'dev1',
        timestamp: new Date(),
        details: { files: [`test${i}.js`] }
      }));

      operations.forEach(op => freshCompliance.recordOperation(op));

      const archive = freshCompliance.archiveAuditData({
        startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        endDate: new Date()
      });

      expect(archive).toHaveProperty('records');
      expect(archive).toHaveProperty('metadata');
      expect(archive).toHaveProperty('integrity');
      expect(archive.records.length).toBe(50);
      
      await freshCompliance.cleanup();
    });

    test('should validate audit data integrity', () => {
      const operations = [
        { type: 'commit', user: 'dev1', timestamp: new Date() },
        { type: 'push', user: 'dev1', timestamp: new Date() }
      ];

      operations.forEach(op => auditCompliance.recordOperation(op));

      const integrityCheck = auditCompliance.validateDataIntegrity();
      
      expect(integrityCheck).toHaveProperty('valid', true);
      expect(integrityCheck).toHaveProperty('recordCount');
      expect(integrityCheck).toHaveProperty('checksums');
      expect(integrityCheck).toHaveProperty('timestamp');
    });
  });

  describe('Configuration', () => {
    test('should respect compliance configuration', () => {
      const strictConfig = {
        complianceLevel: 'strict',
        enableAuditTrail: true,
        enableComplianceReporting: true,
        complianceStandards: ['SOX', 'GDPR']
      };

      const compliance = new GitAuditCompliance(mockResourceManager, strictConfig);
      
      expect(compliance.config.complianceLevel).toBe('strict');
      expect(compliance.config.enableAuditTrail).toBe(true);
      expect(compliance.config.complianceStandards).toEqual(['SOX', 'GDPR']);
    });

    test('should use default configuration values', () => {
      const defaultCompliance = new GitAuditCompliance(mockResourceManager);
      
      expect(defaultCompliance.config.enableAuditTrail).toBe(true);
      expect(defaultCompliance.config.auditRetentionDays).toBe(2555);
      expect(defaultCompliance.config.complianceLevel).toBe('standard');
    });
  });

  describe('Error Handling', () => {
    test('should handle invalid audit entries gracefully', () => {
      const invalidOperation = null;
      
      expect(() => {
        auditCompliance.recordOperation(invalidOperation);
      }).not.toThrow();
      
      expect(auditCompliance.auditTrail.length).toBe(0);
    });

    test('should handle compliance report generation errors', () => {
      const invalidStandard = 'INVALID_STANDARD';
      
      expect(() => {
        auditCompliance.generateComplianceReport(invalidStandard);
      }).toThrow('Unsupported compliance standard');
    });

    test('should handle missing security manager gracefully', async () => {
      const complianceWithoutSecurity = new GitAuditCompliance(mockResourceManager, {
        securityManager: null
      });

      await complianceWithoutSecurity.initialize();
      
      const report = complianceWithoutSecurity.generateComplianceReport('SOX');
      expect(report.securityEvents).toEqual([]);
      
      await complianceWithoutSecurity.cleanup();
    });
  });

  describe('Cleanup', () => {
    test('should cleanup compliance resources', async () => {
      expect(auditCompliance.scheduledAssessments.size).toBeGreaterThanOrEqual(0);
      
      const removeListenersSpy = jest.spyOn(auditCompliance, 'removeAllListeners');
      
      await auditCompliance.cleanup();
      
      expect(removeListenersSpy).toHaveBeenCalled();
    });

    test('should not fail cleanup when not initialized', async () => {
      const uninitializedCompliance = new GitAuditCompliance(mockResourceManager);
      
      await expect(uninitializedCompliance.cleanup()).resolves.not.toThrow();
    });
  });
});