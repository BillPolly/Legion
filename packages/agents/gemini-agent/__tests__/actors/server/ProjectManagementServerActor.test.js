/**
 * ProjectManagementServerActor Tests
 * Unit tests for the refactored project management server actor
 */

import ProjectManagementServerActor from '../../../src/actors/server/ProjectManagementServerActor.js';
import { ResourceManager } from '@legion/resource-manager';

describe('ProjectManagementServerActor', () => {
  let actor;
  let resourceManager;
  let mockMainActor;

  beforeAll(async () => {
    // Get ResourceManager instance once for the entire test suite
    resourceManager = await ResourceManager.getInstance();
  });

  beforeEach(() => {
    // Create mock main actor
    mockMainActor = {
      remoteActor: {
        receive: () => {}
      }
    };

    // Create actor instance
    actor = new ProjectManagementServerActor({
      resourceManager
    });
    
    // Set main actor reference
    actor.setMainActor(mockMainActor);
  });

  describe('constructor', () => {
    test('should create actor with proper initialization', () => {
      expect(actor.resourceManager).toBe(resourceManager);
      expect(actor.mainActor).toBe(mockMainActor);
      expect(actor.projectManager).toBeNull();
      expect(actor.deliverableManager).toBeNull();
      expect(actor.coordinationMonitor).toBeNull();
      expect(actor.eventBroadcaster).toBeNull();
    });

    test('should handle missing resourceManager', () => {
      // The actual implementation doesn't validate the resourceManager in constructor
      const badActor = new ProjectManagementServerActor({});
      expect(badActor.resourceManager).toBeUndefined();
    });
  });

  describe('initialize', () => {
    test('should initialize all project management components', async () => {
      await actor.initialize();

      expect(actor.projectManager).toBeTruthy();
      expect(actor.deliverableManager).toBeTruthy();
      expect(actor.coordinationMonitor).toBeTruthy();
      expect(actor.eventBroadcaster).toBeTruthy();
    });

    test('should handle initialization errors gracefully', async () => {
      // Mock ResourceManager to throw error
      const badActor = new ProjectManagementServerActor({
        resourceManager: {
          get: () => Promise.reject(new Error('Resource not found'))
        }
      });
      badActor.setMainActor(mockMainActor);

      // Should throw error since actual implementation throws
      await expect(badActor.initialize()).rejects.toThrow();
    });
  });

  describe('handleGetProjectData', () => {
    beforeEach(async () => {
      await actor.initialize();
    });

    test('should handle project data request', async () => {
      // Mock project manager methods
      actor.projectManager.generateProjectSummary = () => Promise.resolve('Mock summary');
      actor.projectManager.getDeliverables = () => Promise.resolve([
        {
          id: 'del-001',
          name: 'Test Deliverable',
          phase: 'requirements',
          status: 'in_progress',
          completion: 50,
          assignedAgent: 'TestAgent'
        }
      ]);

      const result = await actor.handleGetProjectData({ projectId: 'test-project' });

      expect(result.projectId).toBe('test-project');
      expect(result.summary).toBe('Mock summary');
      expect(result.deliverables).toHaveLength(1);
      expect(result.deliverables[0].name).toBe('Test Deliverable');
    });

    test('should handle missing project manager', async () => {
      // Clear project manager
      actor.projectManager = null;

      const result = await actor.handleGetProjectData({ projectId: 'test-project' });

      expect(result).toBeUndefined();
    });
  });

  describe('handleGetDeliverableDetails', () => {
    beforeEach(async () => {
      await actor.initialize();
    });

    test('should handle deliverable details request', async () => {
      // Mock database service with proper structure
      actor.projectManager.databaseService = {
        mongoProvider: {
          find: () => Promise.resolve([
            {
              deliverableId: 'del-001',
              content: {
                name: 'Test Deliverable',
                status: 'completed',
                completion: 100,
                result: 'Success',
                artifacts: ['file1.js', 'file2.js'],
                completedAt: new Date().toISOString()
              },
              metadata: {
                agent: 'TestAgent',
                phase: 'requirements',
                executionTime: 1500
              }
            }
          ])
        }
      };

      const result = await actor.handleGetDeliverableDetails({ 
        projectId: 'test-project',
        deliverableId: 'del-001' 
      });

      expect(result).toBeTruthy();
      expect(result.deliverableName).toBe('Test Deliverable');
      expect(result.agent).toBe('TestAgent');
      expect(result.phase).toBe('requirements');
    });

    test('should handle missing database service', async () => {
      // Clear database service
      actor.projectManager.databaseService = null;

      await expect(actor.handleGetDeliverableDetails({ 
        projectId: 'test-project',
        deliverableId: 'del-001' 
      })).rejects.toThrow('Database service not available');
    });
  });

  describe('handleProjectCommand', () => {
    beforeEach(async () => {
      await actor.initialize();
    });

    test('should handle project status command', async () => {
      // Mock the _handleProjectStatus method
      actor._handleProjectStatus = () => Promise.resolve('Mock status');

      const result = await actor.handleProjectCommand(['status']);

      expect(result).toContain('status');
    });

    test('should handle unknown project command', async () => {
      const result = await actor.handleProjectCommand(['unknown']);

      expect(result).toContain('Unknown Project Command');
    });

    test('should handle empty command args', async () => {
      const result = await actor.handleProjectCommand([]);

      expect(result).toContain('Project Management Commands');
    });
  });

  describe('getCurrentProject', () => {
    beforeEach(async () => {
      await actor.initialize();
    });

    test('should return current project when available', () => {
      const mockProject = 'test-project-id';
      actor.projectManager.currentProject = mockProject;

      const result = actor.getCurrentProject();

      expect(result).toBe(mockProject);
    });

    test('should return null when no current project', () => {
      actor.projectManager.currentProject = null;

      const result = actor.getCurrentProject();

      expect(result).toBeNull();
    });
  });

  describe('getProjectContext', () => {
    beforeEach(async () => {
      await actor.initialize();
    });

    test('should return project context string', async () => {
      // Set up current project
      actor.projectManager.currentProject = 'test-project-id';
      
      // Mock the generateProjectSummary method
      actor.projectManager.generateProjectSummary = () => Promise.resolve({
        projectName: 'Test Project',
        currentPhase: 'requirements',
        progressPercentage: 75,
        completedDeliverables: 3,
        totalDeliverables: 5
      });

      const result = await actor.getProjectContext();

      expect(result).toContain('Test Project');
      expect(result).toContain('requirements');
      expect(result).toContain('75%');
    });

    test('should handle no current project', async () => {
      // Clear current project
      actor.projectManager.currentProject = null;

      const result = await actor.getProjectContext();

      expect(result).toContain('No active project');
    });
  });

  describe('setMainActor', () => {
    test('should set main actor reference', () => {
      const newMainActor = { test: 'actor' };
      actor.setMainActor(newMainActor);

      expect(actor.mainActor).toBe(newMainActor);
    });
  });

  describe('setDashboardActor', () => {
    test('should set dashboard actor reference', () => {
      const dashboardActor = { test: 'dashboard' };
      actor.setDashboardActor(dashboardActor);

      expect(actor.dashboardActor).toBe(dashboardActor);
    });
  });
});