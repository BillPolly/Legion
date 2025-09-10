/**
 * AgentCoordinationMonitor Tests
 * Unit tests for SD agent activity monitoring within project context
 */

import { AgentCoordinationMonitor } from '../../../src/project-management/services/AgentCoordinationMonitor.js';
import { AgentAssignment } from '../../../src/project-management/models/AgentAssignment.js';
import { Deliverable } from '../../../src/project-management/models/Deliverable.js';

describe('AgentCoordinationMonitor', () => {
  let monitor;
  let mockProjectManager;
  let mockEventBroadcaster;

  beforeEach(() => {
    // Mock dependencies for unit tests
    mockProjectManager = {
      getProjectStatus: async (id) => ({
        id: id,
        agents: new Map(),
        deliverables: new Map()
      }),
      updateDeliverable: async (projectId, deliverableId, updates) => ({
        id: deliverableId,
        ...updates
      })
    };

    mockEventBroadcaster = {
      broadcastUpdate: async (data) => ({
        success: true,
        eventId: `event-${Date.now()}`
      })
    };

    monitor = new AgentCoordinationMonitor({
      projectManager: mockProjectManager,
      eventBroadcaster: mockEventBroadcaster
    });
  });

  describe('constructor', () => {
    test('should create monitor with proper initialization', () => {
      expect(monitor.projectManager).toBe(mockProjectManager);
      expect(monitor.eventBroadcaster).toBe(mockEventBroadcaster);
      expect(monitor.agentActivities).toBeInstanceOf(Map);
      expect(monitor.deliverableProgress).toBeInstanceOf(Map);
      expect(monitor.monitoredProjects).toBeInstanceOf(Set);
    });
  });

  describe('startMonitoring', () => {
    test('should start monitoring project agent activities', async () => {
      const result = await monitor.startMonitoring('test-project-001');
      
      expect(result.success).toBe(true);
      expect(result.projectId).toBe('test-project-001');
      expect(monitor.monitoredProjects.has('test-project-001')).toBe(true);
    });

    test('should not duplicate monitoring for same project', async () => {
      await monitor.startMonitoring('test-project-001');
      const result = await monitor.startMonitoring('test-project-001');
      
      expect(result.alreadyMonitoring).toBe(true);
      expect(monitor.monitoredProjects.size).toBe(1);
    });
  });

  describe('stopMonitoring', () => {
    test('should stop monitoring project', async () => {
      await monitor.startMonitoring('test-project-001');
      expect(monitor.monitoredProjects.has('test-project-001')).toBe(true);

      const result = await monitor.stopMonitoring('test-project-001');
      expect(result.success).toBe(true);
      expect(monitor.monitoredProjects.has('test-project-001')).toBe(false);
    });
  });

  describe('recordAgentActivity', () => {
    test('should record agent activity for monitored project', async () => {
      await monitor.startMonitoring('test-project-001');

      const activity = {
        agentId: 'RequirementsAgent',
        agentType: 'RequirementsAgent',
        activity: 'processing_requirements',
        deliverableId: 'del-001',
        status: 'busy'
      };

      const result = await monitor.recordAgentActivity('test-project-001', activity);
      
      expect(result.success).toBe(true);
      expect(result.activityId).toBeDefined();
      expect(monitor.agentActivities.has('test-project-001')).toBe(true);
      
      const projectActivities = monitor.agentActivities.get('test-project-001');
      expect(projectActivities).toHaveLength(1);
      expect(projectActivities[0].agentId).toBe('RequirementsAgent');
    });

    test('should throw error for non-monitored project', async () => {
      const activity = {
        agentId: 'TestAgent',
        activity: 'test_activity'
      };

      await expect(monitor.recordAgentActivity('non-monitored', activity)).rejects.toThrow('Project non-monitored is not being monitored');
    });
  });

  describe('recordDeliverableProgress', () => {
    test('should record and broadcast deliverable progress', async () => {
      await monitor.startMonitoring('test-project-001');

      const progress = {
        deliverableId: 'del-001',
        agentId: 'RequirementsAgent',
        completion: 75,
        status: 'in_progress'
      };

      const result = await monitor.recordDeliverableProgress('test-project-001', progress);
      
      expect(result.success).toBe(true);
      expect(result.broadcastSent).toBe(true);
      expect(monitor.deliverableProgress.has('test-project-001')).toBe(true);
      
      const projectProgress = monitor.deliverableProgress.get('test-project-001');
      expect(projectProgress.get('del-001')).toBeDefined();
      expect(projectProgress.get('del-001').completion).toBe(75);
    });
  });

  describe('getAgentActivities', () => {
    test('should return agent activities for project', async () => {
      await monitor.startMonitoring('test-project-001');

      const activity1 = {
        agentId: 'RequirementsAgent',
        activity: 'parsing_requirements',
        deliverableId: 'del-001'
      };

      const activity2 = {
        agentId: 'DomainModelingAgent',
        activity: 'modeling_entities',
        deliverableId: 'del-002'
      };

      await monitor.recordAgentActivity('test-project-001', activity1);
      await monitor.recordAgentActivity('test-project-001', activity2);

      const activities = await monitor.getAgentActivities('test-project-001');
      expect(activities).toHaveLength(2);
      expect(activities.map(a => a.agentId)).toContain('RequirementsAgent');
      expect(activities.map(a => a.agentId)).toContain('DomainModelingAgent');
    });

    test('should filter activities by agent ID', async () => {
      await monitor.startMonitoring('test-project-001');

      await monitor.recordAgentActivity('test-project-001', {
        agentId: 'RequirementsAgent',
        activity: 'activity1'
      });

      await monitor.recordAgentActivity('test-project-001', {
        agentId: 'DomainModelingAgent',
        activity: 'activity2'
      });

      const reqActivities = await monitor.getAgentActivities('test-project-001', 'RequirementsAgent');
      expect(reqActivities).toHaveLength(1);
      expect(reqActivities[0].agentId).toBe('RequirementsAgent');
    });
  });

  describe('getDeliverableProgress', () => {
    test('should return deliverable progress for project', async () => {
      await monitor.startMonitoring('test-project-001');

      await monitor.recordDeliverableProgress('test-project-001', {
        deliverableId: 'del-001',
        completion: 50
      });

      await monitor.recordDeliverableProgress('test-project-001', {
        deliverableId: 'del-002',
        completion: 100
      });

      const progress = await monitor.getDeliverableProgress('test-project-001');
      expect(progress.size).toBe(2);
      expect(progress.get('del-001').completion).toBe(50);
      expect(progress.get('del-002').completion).toBe(100);
    });

    test('should filter progress by deliverable ID', async () => {
      await monitor.startMonitoring('test-project-001');

      await monitor.recordDeliverableProgress('test-project-001', {
        deliverableId: 'del-001',
        completion: 75
      });

      const delProgress = await monitor.getDeliverableProgress('test-project-001', 'del-001');
      expect(delProgress.completion).toBe(75);
    });
  });

  describe('getProjectCoordinationSummary', () => {
    test('should return coordination summary for project', async () => {
      await monitor.startMonitoring('test-project-001');

      // Record agent activities
      await monitor.recordAgentActivity('test-project-001', {
        agentId: 'RequirementsAgent',
        status: 'busy',
        deliverableId: 'del-001'
      });

      await monitor.recordAgentActivity('test-project-001', {
        agentId: 'DomainModelingAgent',
        status: 'available'
      });

      // Record deliverable progress
      await monitor.recordDeliverableProgress('test-project-001', {
        deliverableId: 'del-001',
        completion: 80,
        agentId: 'RequirementsAgent'
      });

      const summary = await monitor.getProjectCoordinationSummary('test-project-001');
      
      expect(summary.projectId).toBe('test-project-001');
      expect(summary.totalAgents).toBe(2);
      expect(summary.busyAgents).toBe(1);
      expect(summary.availableAgents).toBe(1);
      expect(summary.totalDeliverables).toBe(1);
      expect(summary.averageCompletion).toBe(80);
    });
  });

  describe('getMonitoringStatistics', () => {
    test('should return overall monitoring statistics', async () => {
      await monitor.startMonitoring('project-001');
      await monitor.startMonitoring('project-002');

      await monitor.recordAgentActivity('project-001', {
        agentId: 'Agent1',
        activity: 'working'
      });

      const stats = await monitor.getMonitoringStatistics();
      
      expect(stats.monitoredProjects).toBe(2);
      expect(stats.totalAgentActivities).toBe(1);
      expect(stats.totalDeliverableProgress).toBe(0);
      expect(stats.monitoringActive).toBe(true);
    });
  });
});