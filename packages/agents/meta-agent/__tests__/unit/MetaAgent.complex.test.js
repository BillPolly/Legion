/**
 * Unit tests for MetaAgent complex agent functionality
 */

import { jest } from '@jest/globals';
import { MetaAgent } from '../../src/MetaAgent.js';
import { ResourceManager } from '@legion/resource-manager';

describe('MetaAgent - Complex Agent Handlers', () => {
  let metaAgent;
  let resourceManager;
  let mockAgentCreator;

  beforeEach(async () => {
    jest.setTimeout(30000);
    
    // Get ResourceManager singleton
    resourceManager = await ResourceManager.getInstance();
    
    // Create MetaAgent
    metaAgent = new MetaAgent({}, resourceManager);
    
    // Mock AgentCreator methods
    mockAgentCreator = {
      initialize: jest.fn().mockResolvedValue(undefined),
      cleanup: jest.fn().mockResolvedValue(undefined),
      createAgent: jest.fn().mockResolvedValue({
        agentId: 'test-agent-1',
        agentName: 'Test Agent',
        testsPassed: true,
        registrationId: 'reg-123'
      }),
      createComplexAgent: jest.fn().mockResolvedValue({
        agentId: 'complex-agent-1',
        agentName: 'Complex Test Agent',
        testsPassed: true,
        registrationId: 'reg-456',
        decomposition: {
          hierarchy: {
            complexity: 'COMPLEX',
            description: 'Main task',
            subtasks: [
              { description: 'Step 1', complexity: 'SIMPLE' },
              { description: 'Step 2', complexity: 'SIMPLE' }
            ]
          }
        },
        behaviorTree: {
          type: 'sequence',
          children: [
            { type: 'agent_tool', tool: 'tool1' },
            { type: 'agent_tool', tool: 'tool2' }
          ]
        },
        tools: new Set(['tool1', 'tool2']),
        dataFlow: new Map([['Step 1', { from: 'input', to: 'output' }]])
      }),
      listCreatedAgents: jest.fn().mockReturnValue([]),
      getAgent: jest.fn().mockReturnValue(null),
      getTestResults: jest.fn().mockReturnValue({}),
      analyzeAgent: jest.fn().mockResolvedValue({}),
      optimizePrompts: jest.fn().mockResolvedValue({}),
      exportConfig: jest.fn().mockReturnValue('{}'),
      listTemplates: jest.fn().mockReturnValue([]),
      generateFromTemplate: jest.fn().mockResolvedValue({}),
      designBatch: jest.fn().mockResolvedValue({}),
      generateAgentReport: jest.fn().mockResolvedValue({})
    };
    
    // Replace agentCreator with mock
    metaAgent.agentCreator = mockAgentCreator;
    metaAgent.initialized = true;
  });

  afterEach(async () => {
    jest.clearAllMocks();
  });

  describe('handleCreateComplexAgent', () => {
    test('should create complex agent with valid requirements', async () => {
      const requirementsString = JSON.stringify({
        purpose: 'Create a data pipeline',
        taskType: 'analytical'
      });

      const result = await metaAgent.handleCreateComplexAgent(requirementsString);

      expect(mockAgentCreator.createComplexAgent).toHaveBeenCalledWith({
        purpose: 'Create a data pipeline',
        taskType: 'analytical'
      });

      expect(result.type).toBe('complex_agent_created');
      expect(result.content).toContain('Complex Agent created successfully');
      expect(result.content).toContain('complex-agent-1');
      expect(result.content).toContain('Task Decomposition');
      expect(result.content).toContain('Behavior Tree');
      expect(result.content).toContain('Discovered Tools');
      expect(result.data).toBeDefined();
    });

    test('should handle invalid JSON gracefully', async () => {
      const result = await metaAgent.handleCreateComplexAgent('invalid json');

      expect(result.type).toBe('error');
      expect(result.content).toContain('Invalid JSON format');
      expect(mockAgentCreator.createComplexAgent).not.toHaveBeenCalled();
    });

    test('should handle creation failures', async () => {
      mockAgentCreator.createComplexAgent.mockRejectedValueOnce(
        new Error('Creation failed')
      );

      const requirementsString = JSON.stringify({
        purpose: 'Test',
        taskType: 'task'
      });

      const result = await metaAgent.handleCreateComplexAgent(requirementsString);

      expect(result.type).toBe('error');
      expect(result.content).toContain('Failed to create complex agent');
      expect(result.content).toContain('Creation failed');
    });

    test('should include hierarchy details in response', async () => {
      const requirementsString = JSON.stringify({
        purpose: 'Multi-step workflow',
        taskType: 'task'
      });

      const result = await metaAgent.handleCreateComplexAgent(requirementsString);

      expect(result.content).toContain('Task Decomposition');
      expect(result.content).toContain('Complexity: COMPLEX');
      expect(result.content).toContain('Total Steps: 2');
      expect(result.content).toContain('1. Step 1');
      expect(result.content).toContain('2. Step 2');
    });

    test('should include behavior tree details in response', async () => {
      const requirementsString = JSON.stringify({
        purpose: 'Workflow',
        taskType: 'task'
      });

      const result = await metaAgent.handleCreateComplexAgent(requirementsString);

      expect(result.content).toContain('Behavior Tree');
      expect(result.content).toContain('Type: sequence');
      expect(result.content).toContain('Nodes: 2');
    });

    test('should include tools information in response', async () => {
      const requirementsString = JSON.stringify({
        purpose: 'Task',
        taskType: 'task'
      });

      const result = await metaAgent.handleCreateComplexAgent(requirementsString);

      expect(result.content).toContain('Discovered Tools: 2');
      expect(result.content).toContain('- tool1');
      expect(result.content).toContain('- tool2');
    });
  });

  describe('detectComplexityNeeded', () => {
    test('should detect complex tasks from keywords', () => {
      const complexPurposes = [
        'Create a multi-step workflow',
        'Build a pipeline for data processing',
        'Orchestrate multiple services',
        'Coordinate various tasks',
        'Integrate different systems',
        'Build an end-to-end solution',
        'Create a full stack application',
        'Automate the complete process'
      ];

      complexPurposes.forEach(purpose => {
        expect(metaAgent.detectComplexityNeeded(purpose)).toBe(true);
      });
    });

    test('should detect complex tasks from multiple "and" conjunctions', () => {
      const purpose = 'Fetch data and process it and generate reports and send notifications';
      expect(metaAgent.detectComplexityNeeded(purpose)).toBe(true);
    });

    test('should detect complex tasks from sequential indicators', () => {
      const purposes = [
        'Do this then do that',
        'First step, after that second step',
        'Step 1: fetch, Step 2: process'
      ];

      purposes.forEach(purpose => {
        expect(metaAgent.detectComplexityNeeded(purpose)).toBe(true);
      });
    });

    test('should not detect complexity for simple tasks', () => {
      const simplePurposes = [
        'Create a chat agent',
        'Build a calculator',
        'Make a simple tool',
        'Generate text'
      ];

      simplePurposes.forEach(purpose => {
        expect(metaAgent.detectComplexityNeeded(purpose)).toBe(false);
      });
    });
  });

  describe('guidedAgentCreation', () => {
    test('should use createComplexAgent for complex requirements', async () => {
      const requirements = {
        purpose: 'Create a multi-step workflow to process orders and generate reports',
        taskType: 'analytical'
      };

      const result = await metaAgent.guidedAgentCreation(requirements);

      expect(mockAgentCreator.createComplexAgent).toHaveBeenCalledWith(requirements);
      expect(mockAgentCreator.createAgent).not.toHaveBeenCalled();
      expect(result.content).toContain('complex analytical agent with task decomposition');
    });

    test('should use createAgent for simple requirements', async () => {
      const requirements = {
        purpose: 'Create a chat bot',
        taskType: 'conversational'
      };

      const result = await metaAgent.guidedAgentCreation(requirements);

      expect(mockAgentCreator.createAgent).toHaveBeenCalledWith(requirements);
      expect(mockAgentCreator.createComplexAgent).not.toHaveBeenCalled();
      expect(result.content).toContain('standard conversational agent');
    });

    test('should handle complex agent creation failures', async () => {
      mockAgentCreator.createComplexAgent.mockRejectedValueOnce(
        new Error('Complex creation failed')
      );

      const requirements = {
        purpose: 'Create a multi-step workflow',
        taskType: 'task'
      };

      const result = await metaAgent.guidedAgentCreation(requirements);

      expect(result.type).toBe('error');
      expect(result.content).toContain('Failed to create agent');
    });
  });

  describe('handleCommand', () => {
    test('should route /create-complex-agent command correctly', async () => {
      const message = {
        type: 'message',
        content: '/create-complex-agent {"purpose": "test", "taskType": "task"}',
        from: 'user'
      };

      const result = await metaAgent.receive(message);

      expect(mockAgentCreator.createComplexAgent).toHaveBeenCalled();
      expect(result.type).toBe('complex_agent_created');
    });

    test('should handle unknown commands', async () => {
      const message = {
        type: 'message',
        content: '/unknown-command arg1 arg2',
        from: 'user'
      };

      const result = await metaAgent.receive(message);

      expect(result.type).toBe('error');
      expect(result.content).toContain('Unknown command');
    });
  });

  describe('handleNaturalLanguage', () => {
    test('should detect complex agent needs from natural language', async () => {
      const message = {
        type: 'message',
        content: 'Create a pipeline agent',
        from: 'user'
      };

      const result = await metaAgent.receive(message);

      expect(mockAgentCreator.createComplexAgent).toHaveBeenCalled();
      expect(result.content).toContain('complex');
    });

    test('should create standard agent for simple requests', async () => {
      const message = {
        type: 'message',
        content: 'Create a simple chat agent',
        from: 'user'
      };

      const result = await metaAgent.receive(message);

      expect(mockAgentCreator.createAgent).toHaveBeenCalled();
      expect(result.content).toContain('standard');
    });
  });

  describe('analyzeIntent', () => {
    test('should detect create intent', () => {
      const intents = [
        'create an agent',
        'build me an agent',
        'I want to make an agent'
      ];

      intents.forEach(content => {
        const result = metaAgent.analyzeIntent(content);
        expect(result.action).toBe('create');
        expect(result.requirements).toBeDefined();
      });
    });

    test('should detect help intent', () => {
      const intents = [
        'help',
        'what can you do',
        'how do I use this'
      ];

      intents.forEach(content => {
        const result = metaAgent.analyzeIntent(content);
        expect(result.action).toBe('help');
      });
    });

    test('should default to chat for other intents', () => {
      const result = metaAgent.analyzeIntent('tell me about agents');
      expect(result.action).toBe('chat');
    });
  });

  describe('detectTaskType', () => {
    test('should detect conversational type', () => {
      const types = ['chat bot', 'conversation agent', 'support assistant'];
      types.forEach(content => {
        expect(metaAgent.detectTaskType(content)).toBe('conversational');
      });
    });

    test('should detect analytical type', () => {
      const types = ['data analysis', 'review code', 'audit system'];
      types.forEach(content => {
        expect(metaAgent.detectTaskType(content)).toBe('analytical');
      });
    });

    test('should detect creative type', () => {
      const types = ['create content', 'write stories', 'generate ideas'];
      types.forEach(content => {
        expect(metaAgent.detectTaskType(content)).toBe('creative');
      });
    });

    test('should default to task type', () => {
      expect(metaAgent.detectTaskType('do something')).toBe('task');
    });
  });
});