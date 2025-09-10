/**
 * ProjectManagerAgent Integration Tests
 * Integration tests with real SDModule and ResourceManager - NO MOCKS
 */

import { ProjectManagerAgent } from '../../../src/project-management/agents/ProjectManagerAgent.js';
import { ProjectState } from '../../../src/project-management/models/ProjectState.js';
import { Deliverable } from '../../../src/project-management/models/Deliverable.js';
import { ResourceManager } from '@legion/resource-manager';

describe('ProjectManagerAgent Integration Tests', () => {
  let agent;
  let resourceManager;

  beforeAll(async () => {
    // Get real ResourceManager instance - NO MOCKS
    resourceManager = await ResourceManager.getInstance();
    
    // Create agent with real ResourceManager
    agent = new ProjectManagerAgent({
      resourceManager: resourceManager
    });
    
    // Initialize agent
    await agent.initialize();
  }, 30000); // Longer timeout for initialization

  describe('Real ResourceManager Integration', () => {
    test('should initialize with real ResourceManager', () => {
      expect(agent.resourceManager).toBe(resourceManager);
      expect(agent.name).toBe('ProjectManagerAgent');
    });

    test('should access LLM client through ResourceManager', async () => {
      try {
        const llmClient = await agent.getLLMClient();
        // Should not throw error if properly configured
        expect(llmClient).toBeDefined();
      } catch (error) {
        // If no API key configured, should get specific error message
        expect(error.message).toContain('LLM client not available');
      }
    });
  });

  describe('Project Lifecycle with Real Components', () => {
    const testProjectId = `integration-test-${Date.now()}`;

    test('should create and manage project with real data persistence', async () => {
      const requirements = {
        id: testProjectId,
        name: 'Integration Test Project',
        description: 'A project for integration testing with real components',
        goal: 'Test project management functionality'
      };

      // Create project
      const project = await agent.initializeProject(requirements);
      expect(project).toBeInstanceOf(ProjectState);
      expect(project.id).toBe(testProjectId);

      // Verify project is stored
      const retrievedProject = await agent.getProjectStatus(testProjectId);
      expect(retrievedProject).toBeInstanceOf(ProjectState);
      expect(retrievedProject.id).toBe(testProjectId);

      // Add deliverable
      const deliverable = new Deliverable({
        id: 'del-integration-001',
        name: 'Integration Test Deliverable',
        description: 'Test deliverable for integration testing',
        phase: 'requirements'
      });

      const addedDeliverable = await agent.addDeliverable(testProjectId, deliverable);
      expect(addedDeliverable).toBeInstanceOf(Deliverable);

      // Verify deliverable is in project
      const updatedProject = await agent.getProjectStatus(testProjectId);
      expect(updatedProject.deliverables.has('del-integration-001')).toBe(true);

      // Update deliverable status
      const updatedDeliverable = await agent.updateDeliverable(testProjectId, 'del-integration-001', {
        status: 'completed',
        completion: 100
      });

      expect(updatedDeliverable.status).toBe('completed');
      expect(updatedDeliverable.completion).toBe(100);

      // Generate project summary
      const summary = await agent.generateProjectSummary(testProjectId);
      expect(summary.projectId).toBe(testProjectId);
      expect(summary.totalDeliverables).toBe(1);
      expect(summary.completedDeliverables).toBe(1);
      expect(summary.progressPercentage).toBe(100);

      // Clean up
      await agent.deleteProject(testProjectId);
    });

    test('should handle multiple projects concurrently', async () => {
      const project1Id = `multi-test-1-${Date.now()}`;
      const project2Id = `multi-test-2-${Date.now()}`;

      // Create two projects
      await agent.initializeProject({
        id: project1Id,
        name: 'Multi Test Project 1',
        description: 'First project in multi-project test'
      });

      await agent.initializeProject({
        id: project2Id,
        name: 'Multi Test Project 2', 
        description: 'Second project in multi-project test'
      });

      // Verify both projects exist
      const projectList = await agent.getProjectList();
      const projectIds = projectList.map(p => p.id);
      expect(projectIds).toContain(project1Id);
      expect(projectIds).toContain(project2Id);

      // Test project switching
      await agent.setCurrentProject(project1Id);
      expect(agent.currentProject).toBe(project1Id);

      await agent.setCurrentProject(project2Id);
      expect(agent.currentProject).toBe(project2Id);

      // Clean up
      await agent.deleteProject(project1Id);
      await agent.deleteProject(project2Id);
    });
  });

  describe('Error Handling with Real Components', () => {
    test('should properly handle errors with real error conditions', async () => {
      // Test non-existent project access
      await expect(agent.getProjectStatus('non-existent-project')).rejects.toThrow('Project non-existent-project not found');
      
      // Test invalid project updates
      await expect(agent.updateProject('non-existent-project', {})).rejects.toThrow('Project non-existent-project not found');
      
      // Test deliverable operations on non-existent project
      const testDeliverable = new Deliverable({
        id: 'test-del',
        name: 'Test',
        description: 'Test',
        phase: 'requirements'
      });
      
      await expect(agent.addDeliverable('non-existent-project', testDeliverable)).rejects.toThrow('Project non-existent-project not found');
    });
  });

  describe('Statistics and Monitoring', () => {
    test('should provide accurate agent statistics', () => {
      const stats = agent.getAgentStatistics();
      
      expect(typeof stats.totalProjects).toBe('number');
      expect(typeof stats.projectsInProgress).toBe('number');
      expect(typeof stats.completedProjects).toBe('number');
      expect(typeof stats.registeredAgents).toBe('number');
      expect(stats.currentProject).toBeDefined();
    });
  });
});