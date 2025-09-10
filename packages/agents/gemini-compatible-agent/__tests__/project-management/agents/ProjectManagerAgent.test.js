/**
 * ProjectManagerAgent Tests
 * Unit tests for project manager agent
 */

import { ProjectManagerAgent } from '../../../src/project-management/agents/ProjectManagerAgent.js';
import { ProjectState } from '../../../src/project-management/models/ProjectState.js';
import { Deliverable } from '../../../src/project-management/models/Deliverable.js';

describe('ProjectManagerAgent', () => {
  let agent;
  let mockResourceManager;

  beforeEach(() => {
    // Create mock ResourceManager for unit tests
    mockResourceManager = {
      get: () => null,
      set: () => {},
      getInstance: () => mockResourceManager
    };

    agent = new ProjectManagerAgent({
      resourceManager: mockResourceManager
    });
  });

  describe('constructor', () => {
    test('should create agent with correct configuration', () => {
      expect(agent.name).toBe('ProjectManagerAgent');
      expect(agent.description).toBe('Central project coordination and lifecycle management');
      expect(agent.resourceManager).toBe(mockResourceManager);
      expect(agent.projects).toBeInstanceOf(Map);
      expect(agent.currentProject).toBe(null);
    });
  });

  describe('initializeProject', () => {
    test('should create new project with valid requirements', async () => {
      const requirements = {
        id: 'test-project-001',
        name: 'Test Project',
        description: 'A test project for validation',
        goal: 'Build a user authentication system'
      };

      const project = await agent.initializeProject(requirements);

      expect(project).toBeInstanceOf(ProjectState);
      expect(project.id).toBe('test-project-001');
      expect(project.name).toBe('Test Project');
      expect(project.phase).toBe('requirements');
      expect(project.status).toBe('planning');
      expect(agent.projects.has('test-project-001')).toBe(true);
      expect(agent.currentProject).toBe('test-project-001');
    });

    test('should throw error for invalid requirements', async () => {
      await expect(agent.initializeProject({})).rejects.toThrow('Project ID is required');
      
      await expect(agent.initializeProject({
        id: 'test'
      })).rejects.toThrow('Project name is required');
    });

    test('should throw error for duplicate project ID', async () => {
      const requirements = {
        id: 'test-project-001',
        name: 'Test Project',
        description: 'A test project'
      };

      await agent.initializeProject(requirements);
      await expect(agent.initializeProject(requirements)).rejects.toThrow('Project with ID test-project-001 already exists');
    });
  });

  describe('getProjectStatus', () => {
    test('should return project status for existing project', async () => {
      const requirements = {
        id: 'test-project-001',
        name: 'Test Project',
        description: 'A test project'
      };

      await agent.initializeProject(requirements);
      const status = await agent.getProjectStatus('test-project-001');

      expect(status).toBeInstanceOf(ProjectState);
      expect(status.id).toBe('test-project-001');
    });

    test('should throw error for non-existent project', async () => {
      await expect(agent.getProjectStatus('non-existent')).rejects.toThrow('Project non-existent not found');
    });
  });

  describe('updateProject', () => {
    test('should update project with valid changes', async () => {
      const requirements = {
        id: 'test-project-001',
        name: 'Test Project',
        description: 'A test project'
      };

      await agent.initializeProject(requirements);
      
      const updates = {
        name: 'Updated Test Project',
        description: 'An updated test project'
      };

      const updatedProject = await agent.updateProject('test-project-001', updates);
      expect(updatedProject.name).toBe('Updated Test Project');
      expect(updatedProject.description).toBe('An updated test project');
    });

    test('should throw error for updating non-existent project', async () => {
      await expect(agent.updateProject('non-existent', {})).rejects.toThrow('Project non-existent not found');
    });
  });

  describe('addDeliverable', () => {
    test('should add deliverable to project', async () => {
      const requirements = {
        id: 'test-project-001',
        name: 'Test Project',
        description: 'A test project'
      };

      await agent.initializeProject(requirements);

      const deliverable = new Deliverable({
        id: 'del-001',
        name: 'Requirements Analysis',
        description: 'Analyze project requirements',
        phase: 'requirements'
      });

      const result = await agent.addDeliverable('test-project-001', deliverable);
      expect(result).toBe(deliverable);
      
      const project = agent.projects.get('test-project-001');
      expect(project.deliverables.has('del-001')).toBe(true);
    });
  });

  describe('getProjectList', () => {
    test('should return list of all projects', async () => {
      const requirements1 = {
        id: 'project-001',
        name: 'Project 1',
        description: 'First project'
      };
      const requirements2 = {
        id: 'project-002',
        name: 'Project 2',
        description: 'Second project'
      };

      await agent.initializeProject(requirements1);
      await agent.initializeProject(requirements2);

      const projectList = await agent.getProjectList();
      expect(projectList).toHaveLength(2);
      expect(projectList.map(p => p.id)).toContain('project-001');
      expect(projectList.map(p => p.id)).toContain('project-002');
    });

    test('should return empty array when no projects exist', async () => {
      const projectList = await agent.getProjectList();
      expect(projectList).toEqual([]);
    });
  });

  describe('setCurrentProject', () => {
    test('should set current project', async () => {
      const requirements = {
        id: 'test-project-001',
        name: 'Test Project',
        description: 'A test project'
      };

      await agent.initializeProject(requirements);
      await agent.setCurrentProject('test-project-001');
      
      expect(agent.currentProject).toBe('test-project-001');
    });

    test('should throw error for non-existent project', async () => {
      await expect(agent.setCurrentProject('non-existent')).rejects.toThrow('Project non-existent not found');
    });
  });

  describe('getCurrentProject', () => {
    test('should return current project state', async () => {
      const requirements = {
        id: 'test-project-001',
        name: 'Test Project',
        description: 'A test project'
      };

      await agent.initializeProject(requirements);
      const currentProject = await agent.getCurrentProject();

      expect(currentProject).toBeInstanceOf(ProjectState);
      expect(currentProject.id).toBe('test-project-001');
    });

    test('should return null when no current project', async () => {
      agent.currentProject = null;
      const currentProject = await agent.getCurrentProject();
      expect(currentProject).toBe(null);
    });
  });

  describe('deleteProject', () => {
    test('should delete existing project', async () => {
      const requirements = {
        id: 'test-project-001',
        name: 'Test Project',
        description: 'A test project'
      };

      await agent.initializeProject(requirements);
      expect(agent.projects.has('test-project-001')).toBe(true);

      const result = await agent.deleteProject('test-project-001');
      expect(result).toBe(true);
      expect(agent.projects.has('test-project-001')).toBe(false);
      expect(agent.currentProject).toBe(null); // Should clear current project if deleted
    });

    test('should throw error for non-existent project', async () => {
      await expect(agent.deleteProject('non-existent')).rejects.toThrow('Project non-existent not found');
    });
  });

  describe('generateProjectSummary', () => {
    test('should generate summary for project', async () => {
      const requirements = {
        id: 'test-project-001',
        name: 'Test Project',
        description: 'A test project'
      };

      await agent.initializeProject(requirements);

      const deliverable = new Deliverable({
        id: 'del-001',
        name: 'Requirements',
        description: 'Requirements analysis',
        phase: 'requirements',
        status: 'completed',
        completion: 100
      });

      await agent.addDeliverable('test-project-001', deliverable);

      const summary = await agent.generateProjectSummary('test-project-001');
      
      expect(summary.projectId).toBe('test-project-001');
      expect(summary.projectName).toBe('Test Project');
      expect(summary.currentPhase).toBe('requirements');
      expect(summary.totalDeliverables).toBe(4);  // 3 standard + 1 added
      expect(summary.completedDeliverables).toBe(1);  // Only the manually added one is completed
      expect(summary.progressPercentage).toBe(25);  // 1 completed out of 4 total = 25%
    });
  });
});