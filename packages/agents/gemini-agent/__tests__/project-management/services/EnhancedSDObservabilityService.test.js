/**
 * Enhanced SDObservabilityService Tests
 * Unit tests for enhanced project monitoring service
 */

import { EnhancedSDObservabilityService } from '../../../src/project-management/services/EnhancedSDObservabilityService.js';
import { ProjectState } from '../../../src/project-management/models/ProjectState.js';
import { Deliverable } from '../../../src/project-management/models/Deliverable.js';

describe('EnhancedSDObservabilityService', () => {
  let service;
  let mockResourceManager;
  let mockProjectManager;

  beforeEach(() => {
    // Create mock dependencies for unit tests
    mockResourceManager = {
      get: () => null,
      set: () => {},
      getInstance: () => mockResourceManager
    };

    mockProjectManager = {
      getProjectStatus: async (id) => new ProjectState({
        id: id,
        name: 'Test Project',
        description: 'Test Description'
      }),
      getDeliverables: async () => [],
      generateProjectSummary: async () => ({
        projectId: 'test-001',
        projectName: 'Test Project',
        totalDeliverables: 5,
        completedDeliverables: 2
      })
    };

    service = new EnhancedSDObservabilityService({
      resourceManager: mockResourceManager,
      projectManager: mockProjectManager
    });
  });

  describe('constructor', () => {
    test('should create service with project monitoring capabilities', () => {
      expect(service.resourceManager).toBe(mockResourceManager);
      expect(service.projectManager).toBe(mockProjectManager);
      expect(service.projectSubscriptions).toBeInstanceOf(Map);
      expect(service.projectMetrics).toBeInstanceOf(Map);
      expect(service.projectEvents).toEqual([]);
    });
  });

  describe('subscribeToProject', () => {
    test('should subscribe to project monitoring', async () => {
      const result = await service.subscribeToProject('test-project-001');
      
      expect(result.success).toBe(true);
      expect(result.projectId).toBe('test-project-001');
      expect(service.projectSubscriptions.has('test-project-001')).toBe(true);
    });

    test('should not duplicate existing subscriptions', async () => {
      await service.subscribeToProject('test-project-001');
      await service.subscribeToProject('test-project-001');
      
      expect(service.projectSubscriptions.size).toBe(1);
    });
  });

  describe('unsubscribeFromProject', () => {
    test('should unsubscribe from project monitoring', async () => {
      await service.subscribeToProject('test-project-001');
      expect(service.projectSubscriptions.has('test-project-001')).toBe(true);

      const result = await service.unsubscribeFromProject('test-project-001');
      expect(result.success).toBe(true);
      expect(service.projectSubscriptions.has('test-project-001')).toBe(false);
    });
  });

  describe('getProjectMetrics', () => {
    test('should return project metrics', async () => {
      await service.subscribeToProject('test-project-001');
      
      const metrics = await service.getProjectMetrics('test-project-001');
      expect(metrics.projectId).toBe('test-project-001');
      expect(metrics.subscribed).toBe(true);
      expect(metrics.eventCount).toBeGreaterThanOrEqual(0);
      expect(metrics.lastActivity).toBeDefined();
    });

    test('should throw error for non-subscribed project', async () => {
      await expect(service.getProjectMetrics('non-subscribed')).rejects.toThrow('Not subscribed to project non-subscribed');
    });
  });

  describe('recordProjectEvent', () => {
    test('should record project event', async () => {
      await service.subscribeToProject('test-project-001');
      
      const eventData = {
        type: 'deliverable_completed',
        deliverableId: 'del-001',
        timestamp: new Date()
      };

      const result = await service.recordProjectEvent('test-project-001', eventData);
      expect(result.success).toBe(true);
      expect(service.projectEvents.length).toBe(1);
      expect(service.projectEvents[0].projectId).toBe('test-project-001');
      expect(service.projectEvents[0].type).toBe('deliverable_completed');
    });

    test('should throw error for non-subscribed project', async () => {
      const eventData = {
        type: 'deliverable_completed',
        deliverableId: 'del-001'
      };

      await expect(service.recordProjectEvent('non-subscribed', eventData)).rejects.toThrow('Not subscribed to project non-subscribed');
    });
  });

  describe('generateProjectReport', () => {
    test('should generate comprehensive project report', async () => {
      await service.subscribeToProject('test-project-001');
      
      // Record some events
      await service.recordProjectEvent('test-project-001', {
        type: 'phase_transition',
        fromPhase: 'requirements',
        toPhase: 'domain'
      });

      const report = await service.generateProjectReport('test-project-001', 'summary');
      
      expect(report.projectId).toBe('test-project-001');
      expect(report.reportType).toBe('summary');
      expect(report.projectSummary).toBeDefined();
      expect(report.eventSummary).toBeDefined();
      expect(report.generatedAt).toBeInstanceOf(Date);
    });
  });

  describe('broadcastProjectUpdate', () => {
    test('should broadcast project update to subscribers', async () => {
      // First subscribe to the project
      await service.subscribeToProject('test-project-001');

      const updateData = {
        type: 'status_change',
        projectId: 'test-project-001',
        newStatus: 'active'
      };

      const broadcasts = [];
      service.onBroadcast = (data) => broadcasts.push(data);

      const result = await service.broadcastProjectUpdate('test-project-001', updateData);
      expect(result.success).toBe(true);
      expect(result.broadcastCount).toBeGreaterThanOrEqual(0);
    });
  });

  describe('getActiveProjects', () => {
    test('should return list of subscribed projects', async () => {
      await service.subscribeToProject('project-001');
      await service.subscribeToProject('project-002');

      const activeProjects = await service.getActiveProjects();
      expect(activeProjects).toHaveLength(2);
      expect(activeProjects).toContain('project-001');
      expect(activeProjects).toContain('project-002');
    });
  });

  describe('getSystemStatus', () => {
    test('should return enhanced system status with project information', async () => {
      await service.subscribeToProject('test-project-001');

      const status = await service.getSystemStatus();
      expect(status.subscribedProjects).toBe(1);
      expect(status.totalEvents).toBeGreaterThanOrEqual(0);
      expect(status.monitoringActive).toBe(true);
      expect(status.projectManagerIntegrated).toBe(true);
    });
  });
});