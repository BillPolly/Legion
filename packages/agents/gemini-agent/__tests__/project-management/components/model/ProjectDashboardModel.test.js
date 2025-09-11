/**
 * ProjectDashboardModel Tests
 * Unit tests for project dashboard MVVM model layer
 */

import { ProjectDashboardModel } from '../../../../src/project-management/components/model/ProjectDashboardModel.js';

describe('ProjectDashboardModel', () => {
  let model;
  let mockProjectManager;

  beforeEach(() => {
    // Mock project manager for unit tests
    mockProjectManager = {
      getCurrentProject: async () => ({
        id: 'test-project-001',
        name: 'Test Project',
        phase: 'requirements',
        status: 'active',
        getProgressSummary: () => ({
          progressPercentage: 45,
          completedDeliverables: 2,
          totalDeliverables: 5
        })
      }),
      generateProjectSummary: async (id) => {
        if (id === 'non-existent') {
          throw new Error('Project not found');
        }
        return {
          projectId: 'test-project-001',
          projectName: 'Test Project',
          projectDescription: 'Test Description',
          currentPhase: 'requirements',
          currentStatus: 'active',
          progressPercentage: 45,
          totalDeliverables: 5,
          completedDeliverables: 2,
          createdAt: new Date(),
          updatedAt: new Date()
        };
      },
      getDeliverables: async () => []
    };

    model = new ProjectDashboardModel({
      projectManager: mockProjectManager
    });
  });

  describe('constructor', () => {
    test('should create model with initial state', () => {
      expect(model.projectManager).toBe(mockProjectManager);
      expect(model.projectData).toEqual({});
      expect(model.deliverables).toEqual([]);
      expect(model.phases).toHaveLength(5);
      expect(model.agents).toEqual([]);
      expect(model.changeListeners).toEqual([]);
      expect(model.refreshInterval).toBe(null);
    });
  });

  describe('loadProject', () => {
    test('should load project data and notify listeners', async () => {
      const changeEvents = [];
      model.addChangeListener((data) => changeEvents.push(data));

      const result = await model.loadProject('test-project-001');
      
      expect(result.success).toBe(true);
      expect(model.projectData.id).toBe('test-project-001');
      expect(model.projectData.name).toBe('Test Project');
      expect(changeEvents).toHaveLength(1);
      expect(changeEvents[0].type).toBe('project_loaded');
    });

    test('should handle load errors gracefully', async () => {
      mockProjectManager.getCurrentProject = async () => {
        throw new Error('Project not found');
      };

      const result = await model.loadProject('non-existent');
      expect(result.success).toBe(false);
      expect(result.error).toBe('Project not found');
    });
  });

  describe('updateProjectData', () => {
    test('should update project data and notify listeners', async () => {
      await model.loadProject('test-project-001');
      
      const changeEvents = [];
      model.addChangeListener((data) => changeEvents.push(data));

      const updates = {
        phase: 'domain',
        status: 'active'
      };

      model.updateProjectData(updates);
      
      expect(model.projectData.phase).toBe('domain');
      expect(model.projectData.status).toBe('active');
      expect(changeEvents).toHaveLength(1);
      expect(changeEvents[0].type).toBe('project_updated');
      expect(changeEvents[0].updates).toEqual(updates);
    });
  });

  describe('updateDeliverable', () => {
    test('should update deliverable status and notify listeners', async () => {
      // Setup initial deliverables
      model.deliverables = [
        {
          id: 'del-001',
          name: 'Test Deliverable',
          status: 'pending',
          completion: 0
        }
      ];

      const changeEvents = [];
      model.addChangeListener((data) => changeEvents.push(data));

      model.updateDeliverable('del-001', {
        status: 'completed',
        completion: 100
      });

      expect(model.deliverables[0].status).toBe('completed');
      expect(model.deliverables[0].completion).toBe(100);
      expect(changeEvents).toHaveLength(1);
      expect(changeEvents[0].type).toBe('deliverable_updated');
    });

    test('should handle non-existent deliverable', () => {
      const result = model.updateDeliverable('non-existent', {});
      expect(result.success).toBe(false);
      expect(result.error).toContain('Deliverable non-existent not found');
    });
  });

  describe('getPhaseStatus', () => {
    test('should return phase status information', () => {
      model.projectData = {
        phase: 'requirements',
        progress: 60
      };

      const phaseStatus = model.getPhaseStatus();
      expect(phaseStatus.currentPhase).toBe('requirements');
      expect(phaseStatus.isRequirements).toBe(true);
      expect(phaseStatus.isDomain).toBe(false);
      expect(phaseStatus.progress).toBe(60);
    });
  });

  describe('getDeliverablesSummary', () => {
    test('should return deliverables summary', () => {
      model.deliverables = [
        { status: 'completed', completion: 100 },
        { status: 'in_progress', completion: 50 },
        { status: 'pending', completion: 0 },
        { status: 'blocked', completion: 0 }
      ];

      const summary = model.getDeliverablesSummary();
      expect(summary.total).toBe(4);
      expect(summary.completed).toBe(1);
      expect(summary.inProgress).toBe(1);
      expect(summary.pending).toBe(1);
      expect(summary.blocked).toBe(1);
      expect(summary.averageCompletion).toBe(38); // (100+50+0+0)/4
    });
  });

  describe('startAutoRefresh', () => {
    test('should start automatic data refresh', async () => {
      await model.loadProject('test-project-001');
      
      model.startAutoRefresh(100); // Very short interval for testing
      expect(model.refreshInterval).not.toBe(null);
      
      // Clean up
      model.stopAutoRefresh();
    });
  });

  describe('stopAutoRefresh', () => {
    test('should stop automatic data refresh', async () => {
      await model.loadProject('test-project-001');
      model.startAutoRefresh(100);
      
      model.stopAutoRefresh();
      expect(model.refreshInterval).toBe(null);
    });
  });

  describe('addChangeListener', () => {
    test('should add change listener', () => {
      const listener = () => {};
      model.addChangeListener(listener);
      
      expect(model.changeListeners).toContain(listener);
    });
  });

  describe('removeChangeListener', () => {
    test('should remove change listener', () => {
      const listener = () => {};
      model.addChangeListener(listener);
      model.removeChangeListener(listener);
      
      expect(model.changeListeners).not.toContain(listener);
    });
  });

  describe('destroy', () => {
    test('should clean up model resources', () => {
      model.startAutoRefresh(100);
      model.addChangeListener(() => {});
      
      model.destroy();
      
      expect(model.refreshInterval).toBe(null);
      expect(model.changeListeners).toEqual([]);
      expect(model.projectData).toEqual({});
      expect(model.deliverables).toEqual([]);
    });
  });
});