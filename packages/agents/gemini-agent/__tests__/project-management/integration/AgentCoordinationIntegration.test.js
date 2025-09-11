/**
 * Agent Coordination Integration Tests
 * Integration tests with real SD agents - NO MOCKS
 */

import { AgentCoordinationMonitor } from '../../../src/project-management/services/AgentCoordinationMonitor.js';
import { ProjectEventBroadcaster } from '../../../src/project-management/services/ProjectEventBroadcaster.js';
import { ProjectManagerAgent } from '../../../src/project-management/agents/ProjectManagerAgent.js';
import { Deliverable } from '../../../src/project-management/models/Deliverable.js';
import { ResourceManager } from '@legion/resource-manager';

describe('Agent Coordination Integration Tests', () => {
  let monitor;
  let projectManager;
  let eventBroadcaster;
  let resourceManager;
  let mockRemoteActor;
  const testProjectId = `coord-test-${Date.now()}`;

  beforeAll(async () => {
    // Get real ResourceManager - NO MOCKS
    resourceManager = await ResourceManager.getInstance();
    
    // Create real ProjectManagerAgent
    projectManager = new ProjectManagerAgent({
      resourceManager: resourceManager
    });
    await projectManager.initialize();

    // Create mock remote actor for testing
    mockRemoteActor = {
      receive: (messageType, data) => {
        mockRemoteActor.lastMessage = { messageType, data };
        mockRemoteActor.messageHistory = mockRemoteActor.messageHistory || [];
        mockRemoteActor.messageHistory.push({ messageType, data, timestamp: new Date() });
      },
      lastMessage: null,
      messageHistory: []
    };

    // Create real event broadcaster
    eventBroadcaster = new ProjectEventBroadcaster({
      remoteActor: mockRemoteActor
    });

    // Create agent coordination monitor with real components
    monitor = new AgentCoordinationMonitor({
      projectManager: projectManager,
      eventBroadcaster: eventBroadcaster
    });

  }, 30000);

  describe('Real Component Integration', () => {
    test('should monitor real project with SD agent coordination', async () => {
      // Create real project
      const project = await projectManager.initializeProject({
        id: testProjectId,
        name: 'Agent Coordination Test Project',
        description: 'Testing agent coordination monitoring with real components'
      });

      // Start monitoring
      const monitorResult = await monitor.startMonitoring(testProjectId);
      expect(monitorResult.success).toBe(true);

      // Add deliverables to project
      const deliverable1 = new Deliverable({
        id: 'coord-del-001',
        name: 'Requirements Analysis',
        description: 'Analyze project requirements',
        phase: 'requirements'
      });

      const deliverable2 = new Deliverable({
        id: 'coord-del-002', 
        name: 'Domain Modeling',
        description: 'Model domain entities',
        phase: 'domain'
      });

      await projectManager.addDeliverable(testProjectId, deliverable1);
      await projectManager.addDeliverable(testProjectId, deliverable2);

      // Simulate SD agent activity
      await monitor.recordAgentActivity(testProjectId, {
        agentId: 'RequirementsAgent',
        agentType: 'RequirementsAgent',
        activity: 'parsing_requirements',
        deliverableId: 'coord-del-001',
        status: 'busy'
      });

      // Simulate deliverable progress
      await monitor.recordDeliverableProgress(testProjectId, {
        deliverableId: 'coord-del-001',
        agentId: 'RequirementsAgent',
        completion: 50,
        status: 'in_progress'
      });

      // Verify agent activity tracking
      const activities = await monitor.getAgentActivities(testProjectId);
      expect(activities).toHaveLength(1);
      expect(activities[0].agentId).toBe('RequirementsAgent');
      expect(activities[0].activity).toBe('parsing_requirements');

      // Verify deliverable progress tracking
      const progress = await monitor.getDeliverableProgress(testProjectId);
      expect(progress.size).toBe(1);
      expect(progress.get('coord-del-001').completion).toBe(50);

      // Verify actor framework broadcasting
      expect(mockRemoteActor.messageHistory).toHaveLength(2); // agent_activity + deliverable_progress
      expect(mockRemoteActor.messageHistory[0].messageType).toBe('project_update');
      expect(mockRemoteActor.messageHistory[0].data.type).toBe('agent_activity');
      expect(mockRemoteActor.messageHistory[1].data.type).toBe('deliverable_progress');

      // Get coordination summary
      const summary = await monitor.getProjectCoordinationSummary(testProjectId);
      expect(summary.projectId).toBe(testProjectId);
      expect(summary.totalAgents).toBe(1);
      expect(summary.busyAgents).toBe(1);
      expect(summary.totalDeliverables).toBe(1);
      expect(summary.averageCompletion).toBe(50);

      // Clean up
      await monitor.stopMonitoring(testProjectId);
      await projectManager.deleteProject(testProjectId);
    });

    test('should coordinate multiple SD agents in real project workflow', async () => {
      const multiProjectId = `multi-coord-${Date.now()}`;

      // Create project with multiple deliverables
      await projectManager.initializeProject({
        id: multiProjectId,
        name: 'Multi-Agent Coordination Test',
        description: 'Testing multiple SD agent coordination'
      });

      await monitor.startMonitoring(multiProjectId);

      // Add multiple deliverables for different phases
      const deliverables = [
        new Deliverable({
          id: 'multi-req-001',
          name: 'Requirements Analysis',
          description: 'Parse and analyze requirements',
          phase: 'requirements'
        }),
        new Deliverable({
          id: 'multi-dom-001',
          name: 'Domain Modeling',
          description: 'Create domain model',
          phase: 'domain'
        }),
        new Deliverable({
          id: 'multi-arch-001',
          name: 'Architecture Design',
          description: 'Design system architecture',
          phase: 'architecture'
        })
      ];

      for (const deliverable of deliverables) {
        await projectManager.addDeliverable(multiProjectId, deliverable);
      }

      // Simulate multiple agents working concurrently
      const agents = [
        {
          agentId: 'RequirementsAgent',
          deliverableId: 'multi-req-001',
          activity: 'parsing_requirements'
        },
        {
          agentId: 'DomainModelingAgent', 
          deliverableId: 'multi-dom-001',
          activity: 'modeling_entities'
        },
        {
          agentId: 'ArchitectureAgent',
          deliverableId: 'multi-arch-001',
          activity: 'designing_layers'
        }
      ];

      // Record concurrent agent activities
      for (const agent of agents) {
        await monitor.recordAgentActivity(multiProjectId, {
          agentId: agent.agentId,
          agentType: agent.agentId,
          activity: agent.activity,
          deliverableId: agent.deliverableId,
          status: 'busy'
        });
      }

      // Record progress for each deliverable
      await monitor.recordDeliverableProgress(multiProjectId, {
        deliverableId: 'multi-req-001',
        agentId: 'RequirementsAgent',
        completion: 100,
        status: 'completed'
      });

      await monitor.recordDeliverableProgress(multiProjectId, {
        deliverableId: 'multi-dom-001',
        agentId: 'DomainModelingAgent',
        completion: 60,
        status: 'in_progress'
      });

      await monitor.recordDeliverableProgress(multiProjectId, {
        deliverableId: 'multi-arch-001',
        agentId: 'ArchitectureAgent',
        completion: 25,
        status: 'in_progress'
      });

      // Verify coordination summary
      const summary = await monitor.getProjectCoordinationSummary(multiProjectId);
      expect(summary.totalAgents).toBe(3);
      expect(summary.busyAgents).toBe(3);
      expect(summary.totalDeliverables).toBe(3);
      expect(summary.averageCompletion).toBe(62); // (100 + 60 + 25) / 3 rounded

      // Verify all activities recorded
      const allActivities = await monitor.getAgentActivities(multiProjectId);
      expect(allActivities).toHaveLength(3);

      // Verify individual agent activities
      const reqActivities = await monitor.getAgentActivities(multiProjectId, 'RequirementsAgent');
      expect(reqActivities).toHaveLength(1);
      expect(reqActivities[0].activity).toBe('parsing_requirements');

      // Verify all progress recorded
      const allProgress = await monitor.getDeliverableProgress(multiProjectId);
      expect(allProgress.size).toBe(3);
      expect(allProgress.get('multi-req-001').completion).toBe(100);

      // Verify actor framework messages sent for all events
      expect(mockRemoteActor.messageHistory.length).toBeGreaterThan(5); // Multiple activities + progress updates

      // Clean up
      await monitor.stopMonitoring(multiProjectId);
      await projectManager.deleteProject(multiProjectId);
    });
  });

  describe('Real-time Actor Framework Communication', () => {
    test('should send all updates through actor framework', async () => {
      const actorProjectId = `actor-comm-${Date.now()}`;

      await projectManager.initializeProject({
        id: actorProjectId,
        name: 'Actor Communication Test',
        description: 'Testing actor framework communication'
      });

      await monitor.startMonitoring(actorProjectId);

      // Clear message history
      mockRemoteActor.messageHistory = [];

      // Record agent activity
      await monitor.recordAgentActivity(actorProjectId, {
        agentId: 'TestAgent',
        activity: 'test_work',
        status: 'busy'
      });

      // Record deliverable progress  
      await monitor.recordDeliverableProgress(actorProjectId, {
        deliverableId: 'test-del-001',
        completion: 75,
        status: 'in_progress'
      });

      // Verify actor messages
      expect(mockRemoteActor.messageHistory).toHaveLength(2);

      const activityMessage = mockRemoteActor.messageHistory[0];
      expect(activityMessage.messageType).toBe('project_update');
      expect(activityMessage.data.type).toBe('agent_activity');
      expect(activityMessage.data.agentId).toBe('TestAgent');

      const progressMessage = mockRemoteActor.messageHistory[1];
      expect(progressMessage.messageType).toBe('project_update');
      expect(progressMessage.data.type).toBe('deliverable_progress');
      expect(progressMessage.data.completion).toBe(75);

      // Clean up
      await monitor.stopMonitoring(actorProjectId);
      await projectManager.deleteProject(actorProjectId);
    });
  });
});