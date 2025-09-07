/**
 * Integration test for MetaAgent
 * Tests actual agent creation workflow
 */

import { jest } from '@jest/globals';
import { MetaAgent } from '../../src/MetaAgent.js';
import { ResourceManager } from '@legion/resource-manager';

describe('MetaAgent Integration', () => {
  let metaAgent;
  let resourceManager;

  beforeAll(async () => {
    // Get the singleton ResourceManager
    resourceManager = await ResourceManager.getInstance();
  });

  beforeEach(async () => {
    // Create a new MetaAgent instance
    metaAgent = new MetaAgent({
      agent: {
        id: 'test-meta-agent',
        name: 'Test Meta Agent'
      }
    }, resourceManager);
  });

  describe('Agent Creation Workflow', () => {
    it('should successfully create an agent with mock components', async () => {
      // Mock the LLM client
      const mockLLMClient = {
        complete: jest.fn().mockResolvedValue(JSON.stringify({
          domain: 'technical',
          needsDataProcessing: true,
          needsWebAccess: false,
          needsFileOperations: true,
          requiresPrecision: true,
          requiresCreativity: false
        }))
      };
      
      metaAgent.llmClient = mockLLMClient;

      // Mock the agent components
      metaAgent.agentRegistry = {
        initialize: jest.fn(),
        registerAgent: jest.fn().mockResolvedValue({ 
          success: true, 
          id: 'registered-agent-123' 
        })
      };

      metaAgent.agentDesigner = {
        initialize: jest.fn(),
        designAgent: jest.fn().mockResolvedValue({
          success: true,
          config: {
            agent: { 
              id: 'designed-agent', 
              name: 'Task Manager', 
              type: 'task',
              llm: {
                provider: 'openai',
                model: 'gpt-4'
              }
            },
            prompts: { 
              system: 'You are a task management assistant' 
            },
            behavior: { 
              temperature: 0.7, 
              creativity: 0.5 
            },
            capabilities: { 
              tools: [] 
            }
          }
        })
      };

      metaAgent.promptTester = {
        initialize: jest.fn(),
        batchTest: jest.fn().mockResolvedValue({
          successRate: 0.85
        }),
        autoOptimize: jest.fn().mockResolvedValue({
          prompt: 'Optimized: You are a task management assistant'
        })
      };

      metaAgent.promptEvaluator = {
        initialize: jest.fn(),
        evaluateClarity: jest.fn().mockResolvedValue({
          score: 0.9,
          suggestions: []
        })
      };

      metaAgent.testRunner = {
        initialize: jest.fn(),
        runAllTests: jest.fn().mockResolvedValue({
          overallSummary: {
            totalTests: 10,
            passed: 9,
            failed: 1,
            overallPassRate: 0.9
          },
          suites: [],
          duration: 1500
        }),
        getPerformanceMetrics: jest.fn().mockResolvedValue({
          avgResponseTime: 150,
          throughput: 8
        })
      };

      metaAgent.testValidator = {
        validatePerformance: jest.fn().mockResolvedValue({
          valid: true,
          passed: [],
          failed: []
        })
      };

      // Mock ConfigurableAgent instantiation
      metaAgent.instantiateAgent = jest.fn().mockResolvedValue({
        id: 'task-manager-agent',
        name: 'Task Manager',
        config: {
          id: 'task-manager-agent',
          name: 'Task Manager',
          type: 'task'
        },
        fullConfig: {
          agent: { 
            id: 'task-manager-agent', 
            name: 'Task Manager', 
            type: 'task' 
          },
          prompts: { 
            system: 'Optimized: You are a task management assistant' 
          },
          behavior: { 
            temperature: 0.7, 
            creativity: 0.5 
          },
          capabilities: { 
            tools: ['data_processing', 'json_manipulation', 'file_read', 'file_write'] 
          }
        },
        initialize: jest.fn()
      });

      // Create an agent with requirements
      const requirements = {
        purpose: 'Create a task management agent for tracking user tasks',
        type: 'task',
        minPassRate: 0.85,
        performance: {
          maxResponseTime: 500,
          minThroughput: 5
        }
      };

      const result = await metaAgent.createAgent(requirements);

      // Verify the result
      expect(result.success).toBe(true);
      expect(result.agentId).toBe('task-manager-agent');
      expect(result.agentName).toBe('Task Manager');
      expect(result.testsPassed).toBe(true);
      expect(result.registrationId).toBe('registered-agent-123');

      // Verify the workflow was executed
      expect(metaAgent.agentDesigner.designAgent).toHaveBeenCalledWith(requirements);
      expect(metaAgent.promptTester.batchTest).toHaveBeenCalled();
      expect(metaAgent.testRunner.runAllTests).toHaveBeenCalled();
      expect(metaAgent.agentRegistry.registerAgent).toHaveBeenCalled();

      // Verify the agent was stored
      expect(metaAgent.createdAgents.has('task-manager-agent')).toBe(true);
      
      const storedAgent = metaAgent.createdAgents.get('task-manager-agent');
      expect(storedAgent.agent.name).toBe('Task Manager');
      expect(storedAgent.workflow.result.success).toBe(true);
    });

    it('should handle agent creation failure gracefully', async () => {
      // Mock designer to fail
      metaAgent.agentDesigner = {
        designAgent: jest.fn().mockResolvedValue({
          success: false,
          error: 'Invalid requirements: missing critical information'
        })
      };

      const requirements = {
        // Intentionally minimal requirements
        purpose: 'vague'
      };

      const result = await metaAgent.createAgent(requirements);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Design failed');
      expect(metaAgent.createdAgents.size).toBe(0);
    });
  });

  describe('Message Handling', () => {
    it('should process /create-agent command', async () => {
      // Setup minimal mocks for command handling
      metaAgent.createAgent = jest.fn().mockResolvedValue({
        success: true,
        agentId: 'cmd-agent-123',
        agentName: 'Command Agent',
        testsPassed: true
      });

      const message = {
        content: '/create-agent {"purpose": "Test agent from command", "type": "task"}'
      };

      const response = await metaAgent.handleCreateAgent(message);

      expect(response.type).toBe('agent_created');
      expect(response.content).toContain('Agent created successfully');
      expect(response.data.agentId).toBe('cmd-agent-123');
    });

    it('should list registered agents', async () => {
      metaAgent.agentRegistry = {
        listAgents: jest.fn().mockResolvedValue([
          { id: 'agent-1', name: 'Agent One', type: 'task' },
          { id: 'agent-2', name: 'Agent Two', type: 'conversational' }
        ])
      };

      const message = { content: '/list-agents' };
      const response = await metaAgent.handleListAgents(message);

      expect(response.type).toBe('agent_list');
      expect(response.data).toHaveLength(2);
      expect(response.content).toContain('Agent One');
      expect(response.content).toContain('Agent Two');
    });
  });
});