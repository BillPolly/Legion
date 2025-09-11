/**
 * SD Tools Integration Tests
 * Integration tests with real SD tools and project management - NO MOCKS
 */

import { ProjectManagerAgent } from '../../../src/project-management/agents/ProjectManagerAgent.js';
import { DeliverableLifecycleManager } from '../../../src/project-management/services/DeliverableLifecycleManager.js';
import { AgentCoordinationMonitor } from '../../../src/project-management/services/AgentCoordinationMonitor.js';
import { ResourceManager } from '@legion/resource-manager';
import { Deliverable } from '../../../src/project-management/models/Deliverable.js';

describe('SD Tools Integration Tests', () => {
  let projectManager;
  let deliverableManager;
  let coordinationMonitor;
  let resourceManager;
  const testProjectId = `sd-tools-test-${Date.now()}`;

  beforeAll(async () => {
    // Get real ResourceManager - NO MOCKS
    resourceManager = await ResourceManager.getInstance();
    
    // Create real ProjectManagerAgent
    projectManager = new ProjectManagerAgent({
      resourceManager: resourceManager
    });
    await projectManager.initialize();

    // Create real coordination monitor
    coordinationMonitor = new AgentCoordinationMonitor({
      projectManager: projectManager,
      eventBroadcaster: null // For testing without broadcasting
    });

    // Create deliverable lifecycle manager
    deliverableManager = new DeliverableLifecycleManager({
      projectManager: projectManager,
      coordinationMonitor: coordinationMonitor
    });

  }, 30000);

  describe('Real SD Tools Workflow', () => {
    test('should integrate project management with SD tool execution', async () => {
      // Create project
      const project = await projectManager.initializeProject({
        id: testProjectId,
        name: 'SD Tools Integration Project',
        description: 'Testing integration between project management and SD tools'
      });

      // Start monitoring
      await coordinationMonitor.startMonitoring(testProjectId);

      // Create standard deliverables for requirements phase
      const requirementsDeliverables = await deliverableManager.createStandardDeliverables(testProjectId, 'requirements');
      
      expect(requirementsDeliverables).toHaveLength(3);
      expect(requirementsDeliverables.map(d => d.name)).toContain('Requirements Analysis');
      expect(requirementsDeliverables.map(d => d.name)).toContain('User Stories');
      expect(requirementsDeliverables.map(d => d.name)).toContain('Acceptance Criteria');

      // Simulate SD tool execution - Requirements Analysis
      const reqAnalysisDeliverable = requirementsDeliverables.find(d => d.name === 'Requirements Analysis');
      
      // Assign to RequirementsAgent
      await deliverableManager.assignDeliverableToAgent(
        testProjectId, 
        reqAnalysisDeliverable.id, 
        'RequirementsAgent',
        reqAnalysisDeliverable
      );

      // Simulate tool completion
      const toolResult = {
        result: {
          parsedRequirements: [
            {
              id: 'FR-001',
              description: 'User authentication system',
              priority: 'high',
              type: 'functional'
            },
            {
              id: 'FR-002', 
              description: 'Password reset functionality',
              priority: 'medium',
              type: 'functional'
            }
          ],
          quality: 0.92,
          analysisDepth: 'comprehensive'
        },
        artifacts: ['requirements-analysis.json', 'parsed-requirements.md'],
        executionTime: 1500
      };

      await deliverableManager.completeDeliverable(
        testProjectId,
        reqAnalysisDeliverable.id,
        toolResult,
        reqAnalysisDeliverable
      );

      // Verify deliverable completion was recorded
      expect(reqAnalysisDeliverable.status).toBe('completed');
      expect(reqAnalysisDeliverable.completion).toBe(100);
      expect(reqAnalysisDeliverable.artifacts).toContain('requirements-analysis.json');

      // Verify project manager was updated
      const updatedProject = await projectManager.getProjectStatus(testProjectId);
      const completedDeliverable = updatedProject.deliverables.get(reqAnalysisDeliverable.id);
      expect(completedDeliverable.status).toBe('completed');

      // Verify coordination monitoring recorded progress
      const progress = await coordinationMonitor.getDeliverableProgress(testProjectId);
      expect(progress.has(reqAnalysisDeliverable.id)).toBe(true);
      expect(progress.get(reqAnalysisDeliverable.id).completion).toBe(100);

      // Test User Stories deliverable
      const userStoriesDeliverable = requirementsDeliverables.find(d => d.name === 'User Stories');
      
      await deliverableManager.assignDeliverableToAgent(
        testProjectId,
        userStoriesDeliverable.id,
        'RequirementsAgent',
        userStoriesDeliverable
      );

      const userStoriesResult = {
        result: {
          userStories: [
            {
              id: 'US-001',
              story: 'As a user, I want to log in to access my account',
              priority: 'high',
              acceptanceCriteria: ['User can enter credentials', 'System validates credentials']
            }
          ]
        },
        artifacts: ['user-stories.json'],
        executionTime: 800
      };

      await deliverableManager.completeDeliverable(
        testProjectId,
        userStoriesDeliverable.id,
        userStoriesResult,
        userStoriesDeliverable
      );

      // Get final project summary
      const summary = await projectManager.generateProjectSummary(testProjectId);
      expect(summary.totalDeliverables).toBe(3);
      expect(summary.completedDeliverables).toBe(2);
      expect(summary.progressPercentage).toBe(67); // 2/3 * 100

      // Get coordination summary
      const coordSummary = await coordinationMonitor.getProjectCoordinationSummary(testProjectId);
      expect(coordSummary.totalDeliverables).toBe(2); // Only tracked deliverables
      expect(coordSummary.averageCompletion).toBe(100);

      // Clean up
      await coordinationMonitor.stopMonitoring(testProjectId);
      await projectManager.deleteProject(testProjectId);
    });

    test('should handle deliverable dependencies in SD workflow', async () => {
      const depTestProjectId = `dep-test-${Date.now()}`;

      await projectManager.initializeProject({
        id: depTestProjectId,
        name: 'Dependency Test Project',
        description: 'Testing deliverable dependencies'
      });

      await coordinationMonitor.startMonitoring(depTestProjectId);

      // Create deliverables with dependencies
      const reqAnalysis = new Deliverable({
        id: 'dep-req-analysis',
        name: 'Requirements Analysis',
        description: 'Analyze requirements',
        phase: 'requirements'
      });

      const userStories = new Deliverable({
        id: 'dep-user-stories',
        name: 'User Stories',
        description: 'Generate user stories',
        phase: 'requirements'
      });

      // User stories depend on requirements analysis
      userStories.addDependency('dep-req-analysis');

      await projectManager.addDeliverable(depTestProjectId, reqAnalysis);
      await projectManager.addDeliverable(depTestProjectId, userStories);

      // Check dependencies before requirements analysis is complete
      const initialDependencyCheck = await deliverableManager.checkDependencies(depTestProjectId, 'dep-user-stories');
      expect(initialDependencyCheck.canProceed).toBe(false);
      expect(initialDependencyCheck.blockedBy).toContain('dep-req-analysis');

      // Complete requirements analysis
      await deliverableManager.assignDeliverableToAgent(depTestProjectId, 'dep-req-analysis', 'RequirementsAgent', reqAnalysis);
      await deliverableManager.completeDeliverable(depTestProjectId, 'dep-req-analysis', {
        result: { parsed: true }
      }, reqAnalysis);

      // Check dependencies after requirements analysis is complete
      const updatedDependencyCheck = await deliverableManager.checkDependencies(depTestProjectId, 'dep-user-stories');
      expect(updatedDependencyCheck.canProceed).toBe(true);
      expect(updatedDependencyCheck.resolvedDependencies).toBe(1);
      expect(updatedDependencyCheck.blockedBy).toEqual([]);

      // Now user stories can proceed
      await deliverableManager.assignDeliverableToAgent(depTestProjectId, 'dep-user-stories', 'RequirementsAgent', userStories);
      
      // Verify assignment succeeded (no dependency blocking)
      expect(userStories.assignedAgent).toBe('RequirementsAgent');
      expect(userStories.status).toBe('in_progress');

      // Clean up
      await coordinationMonitor.stopMonitoring(depTestProjectId);
      await projectManager.deleteProject(depTestProjectId);
    });
  });

  describe('Phase Transition with Real SD Tools', () => {
    test('should validate phase transitions based on deliverable completion', async () => {
      const phaseTestProjectId = `phase-test-${Date.now()}`;

      await projectManager.initializeProject({
        id: phaseTestProjectId,
        name: 'Phase Transition Test',
        description: 'Testing phase transitions with real SD workflow'
      });

      // Start monitoring for this test
      await coordinationMonitor.startMonitoring(phaseTestProjectId);

      // Create and complete all requirements deliverables
      const reqDeliverables = await deliverableManager.createStandardDeliverables(phaseTestProjectId, 'requirements');

      // Complete all requirements deliverables
      for (const deliverable of reqDeliverables) {
        await deliverableManager.assignDeliverableToAgent(phaseTestProjectId, deliverable.id, 'RequirementsAgent', deliverable);
        await deliverableManager.completeDeliverable(phaseTestProjectId, deliverable.id, {
          result: { completed: true }
        }, deliverable);
      }

      // Get phase progress
      const phaseProgress = await deliverableManager.getPhaseProgress(phaseTestProjectId, 'requirements');
      expect(phaseProgress.isPhaseComplete).toBe(true);
      expect(phaseProgress.completedDeliverables).toBe(3);
      expect(phaseProgress.averageCompletion).toBe(100);

      // Validate phase transition readiness
      const transitionValidation = await deliverableManager.validatePhaseTransition(phaseTestProjectId, 'requirements', 'domain');
      expect(transitionValidation.canTransition).toBe(true);
      expect(transitionValidation.blockers).toEqual([]);

      // Clean up
      await coordinationMonitor.stopMonitoring(phaseTestProjectId);
      await projectManager.deleteProject(phaseTestProjectId);
    });
  });
});