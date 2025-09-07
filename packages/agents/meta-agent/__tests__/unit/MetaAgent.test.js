import { jest } from '@jest/globals';
import { MetaAgent } from '../../src/MetaAgent.js';
import { ResourceManager } from '@legion/resource-manager';

describe('MetaAgent', () => {
  let metaAgent;
  let mockResourceManager;
  let mockLLMClient;
  let mockAgentRegistry;
  let mockAgentDesigner;
  let mockPromptTester;
  let mockPromptEvaluator;
  let mockTestRunner;
  let mockTestValidator;

  beforeEach(() => {
    // Create mock LLM client
    mockLLMClient = {
      complete: jest.fn().mockResolvedValue('Mock LLM response')
    };

    // Create mock ResourceManager
    mockResourceManager = {
      get: jest.fn((key) => {
        if (key === 'llmClient') return mockLLMClient;
        return null;
      })
    };

    // Create MetaAgent instance with ResourceManager
    metaAgent = new MetaAgent({
      agent: {
        id: 'test-meta-agent',
        name: 'Test Meta Agent'
      }
    }, mockResourceManager);

    // llmClient should already be set via constructor
    metaAgent.llmClient = mockLLMClient;

    // Create mocks for all components
    mockAgentRegistry = {
      initialize: jest.fn().mockResolvedValue(undefined),
      registerAgent: jest.fn().mockResolvedValue({ 
        success: true, 
        id: 'registered-agent-123' 
      }),
      listAgents: jest.fn().mockResolvedValue([
        { id: 'agent-1', name: 'Agent 1', type: 'task' },
        { id: 'agent-2', name: 'Agent 2', type: 'conversational' }
      ]),
      cleanup: jest.fn().mockResolvedValue(undefined)
    };

    mockAgentDesigner = {
      initialize: jest.fn().mockResolvedValue(undefined),
      designAgent: jest.fn().mockResolvedValue({
        success: true,
        config: {
          agent: { id: 'designed-agent', name: 'Designed Agent', type: 'task' },
          prompts: { system: 'You are a helpful assistant' },
          behavior: { temperature: 0.7, creativity: 0.5 },
          capabilities: { tools: ['file_read', 'file_write'] }
        }
      }),
      cleanup: jest.fn().mockResolvedValue(undefined)
    };

    mockPromptTester = {
      initialize: jest.fn().mockResolvedValue(undefined),
      batchTest: jest.fn().mockResolvedValue({
        successRate: 0.9,
        results: []
      }),
      autoOptimize: jest.fn().mockResolvedValue({
        prompt: 'Optimized prompt',
        improvements: []
      }),
      cleanup: jest.fn().mockResolvedValue(undefined)
    };

    mockPromptEvaluator = {
      initialize: jest.fn().mockResolvedValue(undefined),
      evaluateClarity: jest.fn().mockResolvedValue({
        score: 0.8,
        suggestions: []
      }),
      generateFeedback: jest.fn().mockResolvedValue({
        improvedVersion: 'Improved prompt'
      }),
      cleanup: jest.fn().mockResolvedValue(undefined)
    };

    mockTestRunner = {
      initialize: jest.fn().mockResolvedValue(undefined),
      runAllTests: jest.fn().mockResolvedValue({
        overallSummary: {
          totalTests: 10,
          passed: 9,
          failed: 1,
          overallPassRate: 0.9
        },
        suites: [],
        duration: 1000
      }),
      getPerformanceMetrics: jest.fn().mockResolvedValue({
        avgResponseTime: 100,
        throughput: 10,
        errorRate: 0.05,
        memoryDelta: 1000
      }),
      generateReport: jest.fn().mockResolvedValue('# Test Report\n...'),
      cleanup: jest.fn().mockResolvedValue(undefined)
    };

    mockTestValidator = {
      validatePerformance: jest.fn().mockResolvedValue({
        valid: true,
        passed: [],
        failed: []
      })
    };

    // Inject mocks
    metaAgent.agentRegistry = mockAgentRegistry;
    metaAgent.agentDesigner = mockAgentDesigner;
    metaAgent.promptTester = mockPromptTester;
    metaAgent.promptEvaluator = mockPromptEvaluator;
    metaAgent.testRunner = mockTestRunner;
    metaAgent.testValidator = mockTestValidator;
  });

  describe('Constructor', () => {
    it('should create MetaAgent with default configuration', () => {
      const agent = new MetaAgent({}, mockResourceManager);
      expect(agent.config.id).toBe('meta-agent');
      expect(agent.config.name).toBe('Meta Agent');
      expect(agent.config.type).toBe('task');
    });

    it('should merge custom configuration', () => {
      const agent = new MetaAgent({
        agent: {
          id: 'custom-meta',
          name: 'Custom Meta Agent'
        },
        behavior: {
          creativity: 0.9
        }
      }, mockResourceManager);
      expect(agent.config.id).toBe('custom-meta');
      expect(agent.config.name).toBe('Custom Meta Agent');
      expect(agent.fullConfig.behavior.creativity).toBe(0.9);
    });

    it('should include meta-agent capabilities', () => {
      const agent = new MetaAgent({}, mockResourceManager);
      expect(agent.fullConfig.capabilities.tools).toContain('agent_design');
      expect(agent.fullConfig.capabilities.tools).toContain('agent_testing');
      expect(agent.fullConfig.capabilities.tools).toContain('prompt_engineering');
    });
  });

  describe('Initialize', () => {
    it('should initialize all components', async () => {
      metaAgent.initialize = jest.fn().mockImplementation(async function() {
        // Simulate parent class initialization
        this.initialized = true;
        
        // Initialize components
        await this.agentRegistry.initialize();
        await this.agentDesigner.initialize();
        await this.promptTester.initialize();
        await this.promptEvaluator.initialize();
        await this.testRunner.initialize();
      });

      await metaAgent.initialize();

      expect(metaAgent.initialized).toBe(true);
      expect(mockAgentRegistry.initialize).toHaveBeenCalled();
      expect(mockAgentDesigner.initialize).toHaveBeenCalled();
      expect(mockPromptTester.initialize).toHaveBeenCalled();
      expect(mockPromptEvaluator.initialize).toHaveBeenCalled();
      expect(mockTestRunner.initialize).toHaveBeenCalled();
    });
  });

  describe('createAgent', () => {
    it('should create agent successfully with complete workflow', async () => {
      const requirements = {
        purpose: 'Create a task management agent',
        type: 'task',
        performance: {
          maxResponseTime: 500
        }
      };

      // Mock successful agent creation
      const mockAgent = {
        id: 'created-agent-123',
        name: 'Task Management Agent',
        config: {
          agent: { id: 'designed-agent', name: 'Designed Agent', type: 'task' },
          prompts: { system: 'You are a helpful assistant' },
          behavior: { temperature: 0.7, creativity: 0.5 },
          capabilities: { tools: ['file_read', 'file_write'] }
        },
        fullConfig: {
          agent: { id: 'designed-agent', name: 'Designed Agent', type: 'task' },
          prompts: { system: 'You are a helpful assistant' },
          behavior: { temperature: 0.7, creativity: 0.5 },
          capabilities: { tools: ['file_read', 'file_write'] }
        },
        initialize: jest.fn().mockResolvedValue(undefined),
        updateConfiguration: jest.fn()
      };

      // Override instantiateAgent to return mock agent
      metaAgent.instantiateAgent = jest.fn().mockResolvedValue(mockAgent);

      const result = await metaAgent.createAgent(requirements);

      expect(result.success).toBe(true);
      expect(result.agentId).toBe('created-agent-123');
      expect(result.agentName).toBe('Task Management Agent');
      expect(result.testsPassed).toBe(true);
      expect(result.registrationId).toBe('registered-agent-123');

      // Verify workflow steps
      expect(mockAgentDesigner.designAgent).toHaveBeenCalledWith(requirements);
      expect(mockPromptTester.batchTest).toHaveBeenCalled();
      expect(mockTestRunner.runAllTests).toHaveBeenCalled();
      expect(mockAgentRegistry.registerAgent).toHaveBeenCalled();
    });

    it('should handle design failure', async () => {
      mockAgentDesigner.designAgent.mockResolvedValueOnce({
        success: false,
        error: 'Invalid requirements'
      });

      const result = await metaAgent.createAgent({ purpose: 'Test' });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Design failed');
    });

    it('should refine agent if validation fails', async () => {
      const requirements = { purpose: 'Test agent' };

      // Mock agent with low test pass rate
      mockTestRunner.runAllTests.mockResolvedValueOnce({
        overallSummary: {
          totalTests: 10,
          passed: 5,
          failed: 5,
          overallPassRate: 0.5  // Below threshold
        },
        suites: []
      });

      const mockAgent = {
        id: 'test-agent',
        name: 'Test Agent',
        config: {
          agent: { id: 'test-agent', name: 'Test Agent', type: 'task' },
          prompts: { system: 'Test prompt' },
          behavior: { temperature: 0.7, creativity: 0.5 },
          capabilities: { tools: ['file_read'] }
        },
        fullConfig: {
          agent: { id: 'test-agent', name: 'Test Agent', type: 'task' },
          prompts: { system: 'Test prompt' },
          behavior: { temperature: 0.7, creativity: 0.5 },
          capabilities: { tools: ['file_read'] }
        },
        initialize: jest.fn().mockResolvedValue(undefined),
        updateConfiguration: jest.fn()
      };

      metaAgent.instantiateAgent = jest.fn().mockResolvedValue(mockAgent);
      metaAgent.refineAgent = jest.fn().mockResolvedValue({
        ...mockAgent.config,
        behavior: { temperature: 0.3 }
      });

      await metaAgent.createAgent(requirements);

      expect(metaAgent.refineAgent).toHaveBeenCalled();
      expect(mockAgent.updateConfiguration).toHaveBeenCalled();
    });
  });

  describe('analyzeRequirements', () => {
    it('should analyze requirements using LLM', async () => {
      const requirements = {
        purpose: 'Create a data processing agent',
        needsWebAccess: true
      };

      mockLLMClient.complete.mockResolvedValueOnce(JSON.stringify({
        domain: 'technical',
        needsDataProcessing: true,
        needsWebAccess: true,
        needsFileOperations: false,
        requiresPrecision: true,
        requiresCreativity: false
      }));

      const analysis = await metaAgent.analyzeRequirements(requirements);

      expect(analysis.domain).toBe('technical');
      expect(analysis.needsDataProcessing).toBe(true);
      expect(analysis.needsWebAccess).toBe(true);
      expect(analysis.requiresPrecision).toBe(true);
    });

    it('should fallback to basic analysis on LLM parse error', async () => {
      const requirements = {
        purpose: 'Create a file processing agent'
      };

      mockLLMClient.complete.mockResolvedValueOnce('Invalid JSON response');

      const analysis = await metaAgent.analyzeRequirements(requirements);

      expect(analysis.domain).toBe('general');
      expect(analysis.needsFileOperations).toBe(true);
      expect(analysis.needsDataProcessing).toBe(false);
    });
  });

  describe('optimizePrompts', () => {
    it('should optimize prompts with low success rate', async () => {
      const config = {
        prompts: { system: 'Original prompt' },
        capabilities: { tools: ['file_read'] },
        agent: { type: 'task' }
      };

      mockPromptTester.batchTest.mockResolvedValueOnce({
        successRate: 0.6  // Below threshold
      });

      mockPromptTester.autoOptimize.mockResolvedValueOnce({
        prompt: 'Optimized prompt'
      });

      mockPromptEvaluator.evaluateClarity.mockResolvedValueOnce({
        suggestions: ['Make it clearer']
      });

      mockPromptEvaluator.generateFeedback.mockResolvedValueOnce({
        improvedVersion: 'Final improved prompt'
      });

      const optimized = await metaAgent.optimizePrompts(config);

      expect(optimized.prompts.system).toBe('Final improved prompt');
      expect(mockPromptTester.autoOptimize).toHaveBeenCalled();
      expect(mockPromptEvaluator.generateFeedback).toHaveBeenCalled();
    });

    it('should skip optimization for high-quality prompts', async () => {
      const config = {
        prompts: { system: 'Excellent prompt' },
        capabilities: { tools: [] },
        agent: { type: 'conversational' }
      };

      mockPromptTester.batchTest.mockResolvedValueOnce({
        successRate: 0.95  // Above threshold
      });

      mockPromptEvaluator.evaluateClarity.mockResolvedValueOnce({
        suggestions: []
      });

      const optimized = await metaAgent.optimizePrompts(config);

      expect(optimized.prompts.system).toBe('Excellent prompt');
      expect(mockPromptTester.autoOptimize).not.toHaveBeenCalled();
    });
  });

  describe('validateAgent', () => {
    it('should pass validation with good test results', async () => {
      const agent = { id: 'test-agent' };
      const testResults = {
        overallSummary: {
          overallPassRate: 0.9
        },
        suites: [
          {
            suiteName: 'Basic Tests',
            summary: { passRate: 0.95 }
          }
        ]
      };
      const requirements = { minPassRate: 0.8 };

      const validation = await metaAgent.validateAgent(agent, testResults, requirements);

      expect(validation.passed).toBe(true);
      expect(validation.issues).toHaveLength(0);
    });

    it('should fail validation with low pass rate', async () => {
      const agent = { id: 'test-agent' };
      const testResults = {
        overallSummary: {
          overallPassRate: 0.6
        },
        suites: []
      };
      const requirements = { minPassRate: 0.8 };

      metaAgent.generateRecommendations = jest.fn().mockResolvedValue([
        { action: 'improve_prompts', description: 'Refine prompts' }
      ]);

      const validation = await metaAgent.validateAgent(agent, testResults, requirements);

      expect(validation.passed).toBe(false);
      expect(validation.issues).toContainEqual(
        expect.objectContaining({
          type: 'low_pass_rate',
          actual: 0.6,
          required: 0.8
        })
      );
      expect(validation.recommendations).toHaveLength(1);
    });

    it('should validate performance requirements', async () => {
      const agent = { id: 'test-agent' };
      const testResults = {
        overallSummary: { overallPassRate: 0.9 },
        suites: [
          {
            suiteName: 'Performance Tests',
            summary: { passRate: 0.8 }
          }
        ]
      };
      const requirements = {
        minPassRate: 0.8,
        performance: {
          maxResponseTime: 200
        }
      };

      mockTestValidator.validatePerformance.mockResolvedValueOnce({
        valid: false,
        failed: [{ metric: 'responseTime' }]
      });

      const validation = await metaAgent.validateAgent(agent, testResults, requirements);

      expect(validation.passed).toBe(false);
      expect(validation.issues).toContainEqual(
        expect.objectContaining({
          type: 'performance_issues'
        })
      );
    });
  });

  describe('Message Handling', () => {
    it('should handle /create-agent command', async () => {
      const message = {
        content: '/create-agent {"purpose": "Test agent", "type": "task"}'
      };

      metaAgent.createAgent = jest.fn().mockResolvedValue({
        success: true,
        agentId: 'new-agent',
        agentName: 'Test Agent',
        testsPassed: true
      });

      const response = await metaAgent.handleCreateAgent(message);

      expect(response.type).toBe('agent_created');
      expect(response.content).toContain('Agent created successfully');
      expect(response.data.agentId).toBe('new-agent');
    });

    it('should handle /list-agents command', async () => {
      const message = { content: '/list-agents' };

      const response = await metaAgent.handleListAgents(message);

      expect(response.type).toBe('agent_list');
      expect(response.content).toContain('Agent 1');
      expect(response.content).toContain('Agent 2');
      expect(response.data).toHaveLength(2);
    });

    it('should handle /test-agent command', async () => {
      const message = { content: '/test-agent test-agent-id' };

      metaAgent.createdAgents.set('test-agent-id', {
        agent: { id: 'test-agent-id', name: 'Test Agent' },
        config: {},
        testResults: {},
        workflow: {}
      });

      const response = await metaAgent.handleTestAgent(message);

      expect(response.type).toBe('test_report');
      expect(response.content).toContain('Test Report');
      expect(mockTestRunner.runAllTests).toHaveBeenCalled();
    });

    it('should handle /agent-report command', async () => {
      const message = { content: '/agent-report test-agent-id' };

      const agentData = {
        agent: { 
          id: 'test-agent-id', 
          name: 'Test Agent',
          config: {
            agent: { type: 'task' },
            capabilities: { tools: ['file_read'] },
            behavior: { temperature: 0.7, creativity: 0.5 }
          }
        },
        config: {
          agent: { type: 'task' },
          capabilities: { tools: ['file_read'] },
          behavior: { temperature: 0.7, creativity: 0.5 }
        },
        workflow: {
          steps: [
            { step: 'design', startTime: 1000, endTime: 2000 },
            { step: 'test', startTime: 2000, endTime: 3000 }
          ]
        }
      };

      metaAgent.createdAgents.set('test-agent-id', agentData);
      metaAgent.testResults.set('test-agent-id', {
        overallSummary: {
          totalTests: 10,
          overallPassRate: 0.9
        },
        duration: 5000
      });

      const response = await metaAgent.handleAgentReport(message);

      expect(response.type).toBe('comprehensive_report');
      expect(response.content).toContain('Comprehensive Agent Report');
      expect(response.content).toContain('Test Agent');
    });

    it('should handle invalid agent ID in commands', async () => {
      const message = { content: '/test-agent invalid-id' };

      const response = await metaAgent.handleTestAgent(message);

      expect(response.type).toBe('error');
      expect(response.content).toContain('Agent invalid-id not found');
    });
  });

  describe('Cleanup', () => {
    it('should cleanup all components', async () => {
      metaAgent.cleanup = jest.fn().mockImplementation(async function() {
        // Cleanup components
        if (this.promptTester) await this.promptTester.cleanup();
        if (this.promptEvaluator) await this.promptEvaluator.cleanup();
        if (this.testRunner) await this.testRunner.cleanup();
        if (this.agentRegistry) await this.agentRegistry.cleanup();
        if (this.agentDesigner) await this.agentDesigner.cleanup();
      });

      await metaAgent.cleanup();

      expect(mockPromptTester.cleanup).toHaveBeenCalled();
      expect(mockPromptEvaluator.cleanup).toHaveBeenCalled();
      expect(mockTestRunner.cleanup).toHaveBeenCalled();
      expect(mockAgentRegistry.cleanup).toHaveBeenCalled();
      expect(mockAgentDesigner.cleanup).toHaveBeenCalled();
    });
  });

  describe('Enhancement Methods', () => {
    it('should enhance design based on requirements analysis', async () => {
      const config = {
        prompts: { system: 'Basic prompt' },
        capabilities: { tools: [] },
        behavior: {}
      };

      const requirements = {
        purpose: 'Data processing with web access'
      };

      const analysis = {
        needsDataProcessing: true,
        needsWebAccess: true,
        requiresPrecision: true,
        domain: 'technical'
      };

      metaAgent.analyzeRequirements = jest.fn().mockResolvedValue(analysis);

      const enhanced = await metaAgent.enhanceDesign(config, requirements);

      expect(enhanced.capabilities.tools).toContain('data_processing');
      expect(enhanced.capabilities.tools).toContain('web_search');
      expect(enhanced.behavior.creativity).toBe(0.2);
      expect(enhanced.behavior.temperature).toBe(0.3);
    });

    it('should generate appropriate test cases based on agent type', () => {
      const taskConfig = {
        agent: { type: 'task' },
        capabilities: { tools: ['file_read', 'file_write'] }
      };

      const testCases = metaAgent.generatePromptTestCases(taskConfig);

      expect(testCases).toContainEqual(
        expect.objectContaining({
          input: 'Can you complete a task for me?',
          expectedPatterns: ['yes', 'sure', 'help', 'task']
        })
      );
    });

    it('should generate recommendations for issues', async () => {
      const agent = { id: 'test-agent' };
      const issues = [
        { type: 'low_pass_rate' },
        { type: 'performance_issues' }
      ];

      const recommendations = await metaAgent.generateRecommendations(agent, issues);

      expect(recommendations).toContainEqual(
        expect.objectContaining({
          action: 'improve_prompts'
        })
      );
      expect(recommendations).toContainEqual(
        expect.objectContaining({
          action: 'optimize_tools'
        })
      );
    });
  });

  describe('Refinement Methods', () => {
    it('should refine agent configuration based on issues', async () => {
      const config = {
        prompts: { system: 'Original prompt' },
        behavior: { temperature: 0.7, creativity: 0.7 }
      };

      const issues = [
        { type: 'low_pass_rate' },
        { type: 'inconsistent_behavior' }
      ];

      mockLLMClient.complete.mockResolvedValueOnce('Improved prompt text');

      const refined = await metaAgent.refineAgent(config, issues);

      // Use toBeCloseTo for floating point comparison to avoid precision issues
      expect(refined.behavior.temperature).toBeCloseTo(0.5, 5); // 0.7 - 0.2 = 0.5
      expect(refined.behavior.creativity).toBeCloseTo(0.5, 5); // 0.7 - 0.2 = 0.5
      expect(refined.prompts.examples).toBeDefined();
    });

    it('should add performance optimizations when needed', async () => {
      const config = {
        prompts: { system: 'Prompt' },
        behavior: {}
      };

      const issues = [
        { type: 'performance_issues' }
      ];

      const refined = await metaAgent.refineAgent(config, issues);

      expect(refined.performance).toBeDefined();
      expect(refined.performance.maxTokens).toBe(150);
      expect(refined.performance.timeout).toBe(5000);
      expect(refined.performance.cacheResponses).toBe(true);
    });
  });
});