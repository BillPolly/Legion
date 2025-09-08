/**
 * Integration test for MetaAgent
 * Tests actual agent creation workflow with the new AgentCreator architecture
 */

import { jest } from '@jest/globals';
import { MetaAgent } from '../../src/MetaAgent.js';
import { ResourceManager } from '@legion/resource-manager';

describe('MetaAgent Integration', () => {
  let metaAgent;
  let resourceManager;
  let mockAgentCreator;

  beforeAll(async () => {
    // Get the singleton ResourceManager
    resourceManager = await ResourceManager.getInstance();
  });

  beforeEach(async () => {
    // Create mock AgentCreator
    mockAgentCreator = {
      initialize: jest.fn().mockResolvedValue(undefined),
      cleanup: jest.fn().mockResolvedValue(undefined),
      createAgent: jest.fn().mockResolvedValue({
        success: true,
        agent: { id: 'test-agent', name: 'Test Agent' },
        agentId: 'test-agent',
        agentName: 'Test Agent',
        testsPassed: true,
        registrationId: 'reg-123'
      }),
      listCreatedAgents: jest.fn().mockReturnValue([
        { id: 'agent-1', name: 'Agent 1', testsPassed: true, registrationId: 'reg-1' }
      ]),
      getAgent: jest.fn().mockReturnValue({
        agent: { id: 'test-agent', name: 'Test Agent' },
        config: { agent: { name: 'Test Agent' } },
        testsPassed: true,
        registrationId: 'reg-123'
      }),
      getTestResults: jest.fn().mockReturnValue({
        totalTests: 10,
        passedTests: 9,
        failedTests: 1,
        results: []
      }),
      analyzeAgent: jest.fn().mockResolvedValue({
        score: 85,
        issues: [],
        recommendations: ['Consider adding more test cases'],
        suggestions: ['Improve error handling']
      }),
      optimizePrompts: jest.fn().mockResolvedValue({
        config: { agent: { prompts: { system: 'Optimized prompt' } } },
        optimizations: [{ type: 'system_prompt', reduction: 50 }]
      }),
      exportConfig: jest.fn().mockImplementation((config, format = 'json') => {
        if (format === 'json') return JSON.stringify(config, null, 2);
        if (format === 'yaml') return 'yaml: content';
        throw new Error(`Unsupported format: ${format}`);
      }),
      listTemplates: jest.fn().mockReturnValue([
        { name: 'customer-support', type: 'conversational', description: 'Support agent', capabilities: ['help'], tools: ['search'] }
      ]),
      generateFromTemplate: jest.fn().mockResolvedValue({
        agent: { name: 'Template Agent', id: 'template-agent' }
      }),
      designBatch: jest.fn().mockResolvedValue({
        results: [{ config: { agent: { name: 'Batch Agent 1' } } }],
        errors: [],
        totalProcessed: 1,
        successCount: 1,
        errorCount: 0
      }),
      generateAgentReport: jest.fn().mockResolvedValue({
        agent: { name: 'Test Agent', id: 'test-agent', type: 'task', version: '1.0.0', registrationId: 'reg-123' },
        configuration: { llm: { provider: 'anthropic', model: 'claude' } },
        testing: { passed: true },
        analysis: { score: 85, issues: [], recommendations: [] }
      })
    };

    // Create a new MetaAgent instance
    metaAgent = new MetaAgent({
      agent: {
        id: 'test-meta-agent',
        name: 'Test Meta Agent'
      }
    }, resourceManager);
    
    // Replace the agentCreator with our mock
    metaAgent.agentCreator = mockAgentCreator;
    metaAgent.initialized = true;
  });

  describe('Agent Creation Workflow', () => {
    it('should successfully create an agent with mock components', async () => {
      const requirements = {
        purpose: 'Create a task management agent for tracking user tasks',
        taskType: 'task'
      };

      const response = await metaAgent.guidedAgentCreation(requirements);

      // Verify the result
      expect(response.type).toBe('agent_created');
      expect(response.content).toContain('Agent created successfully');
      expect(response.data.agentId).toBe('test-agent');
      expect(response.data.agentName).toBe('Test Agent');
      expect(response.data.testsPassed).toBe(true);
      expect(response.data.registrationId).toBe('reg-123');

      // Verify AgentCreator was called
      expect(mockAgentCreator.createAgent).toHaveBeenCalledWith(requirements);
    });

    it('should handle agent creation failure gracefully', async () => {
      // Mock AgentCreator to fail
      mockAgentCreator.createAgent.mockRejectedValueOnce(
        new Error('Invalid requirements: missing critical information')
      );

      const requirements = {
        purpose: 'vague',
        taskType: 'task'
      };

      const response = await metaAgent.guidedAgentCreation(requirements);

      expect(response.type).toBe('error');
      expect(response.content).toContain('Failed to create agent');
      expect(response.content).toContain('Invalid requirements');
    });
  });

  describe('Message Handling', () => {
    it('should process /create-agent command', async () => {
      const requirementsJson = '{"purpose": "Test agent from command", "taskType": "task"}';
      
      const response = await metaAgent.handleCreateAgent(requirementsJson);

      expect(response.type).toBe('agent_created');
      expect(response.content).toContain('Agent created successfully');
      expect(response.data.agentId).toBe('test-agent');
      expect(mockAgentCreator.createAgent).toHaveBeenCalledWith({
        purpose: 'Test agent from command',
        taskType: 'task'
      });
    });

    it('should list registered agents', async () => {
      const response = await metaAgent.handleListAgents();

      expect(response.type).toBe('agent_list');
      expect(response.data).toHaveLength(1);
      expect(response.content).toContain('Agent 1');
      expect(mockAgentCreator.listCreatedAgents).toHaveBeenCalled();
    });
  });
});