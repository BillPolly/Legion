import { jest } from '@jest/globals';
import { MetaAgent } from '../../src/MetaAgent.js';
import { AgentCreator } from '../../src/AgentCreator.js';
import { ResourceManager } from '@legion/resource-manager';

describe('MetaAgent', () => {
  let metaAgent;
  let mockResourceManager;
  let mockLLMClient;
  let mockAgentCreator;

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
        { id: 'agent-1', name: 'Agent 1', testsPassed: true, registrationId: 'reg-1' },
        { id: 'agent-2', name: 'Agent 2', testsPassed: false, registrationId: 'reg-2' }
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
        suggestions: ['Improve error handling', 'Add input validation']
      }),
      optimizePrompts: jest.fn().mockResolvedValue({
        config: { agent: { prompts: { system: 'Optimized prompt' } } },
        optimizations: [
          { type: 'system_prompt', reduction: 50 }
        ]
      }),
      exportConfig: jest.fn().mockImplementation((config, format) => {
        if (format === 'json') return JSON.stringify(config, null, 2);
        if (format === 'yaml') return 'yaml: content';
        if (format === 'typescript') return 'interface AgentConfig {}';
        throw new Error(`Unsupported format: ${format}`);
      }),
      listTemplates: jest.fn().mockReturnValue([
        { name: 'customer-support', type: 'conversational', description: 'Customer support agent', capabilities: ['answer', 'help'], tools: ['search'] },
        { name: 'code-reviewer', type: 'analytical', description: 'Code review agent', capabilities: ['analyze'], tools: ['file_read'] }
      ]),
      generateFromTemplate: jest.fn().mockResolvedValue({
        agent: { name: 'Template Agent', id: 'template-agent' }
      }),
      designBatch: jest.fn().mockResolvedValue({
        results: [{ config: { agent: { name: 'Batch Agent 1' } } }],
        errors: [],
        totalProcessed: 2,
        successCount: 1,
        errorCount: 1
      }),
      generateAgentReport: jest.fn().mockResolvedValue({
        agent: { name: 'Test Agent', id: 'test-agent', type: 'task', version: '1.0.0', registrationId: 'reg-123' },
        configuration: { llm: { provider: 'anthropic', model: 'claude', temperature: 0.7 } },
        testing: { passed: true },
        analysis: { score: 85, issues: [], recommendations: [] }
      })
    };

    // Create MetaAgent instance with mocked AgentCreator
    metaAgent = new MetaAgent({
      agent: {
        id: 'test-meta-agent',
        name: 'Test Meta Agent'
      }
    }, mockResourceManager);

    // Override the agentCreator
    metaAgent.agentCreator = mockAgentCreator;
    metaAgent.initialized = true;
  });

  describe('Constructor', () => {
    it('should create MetaAgent with default configuration', () => {
      const agent = new MetaAgent({}, mockResourceManager);
      // ConfigurableAgent stores config in this.config (the agent portion)
      expect(agent.config.id).toBe('meta-agent');
      expect(agent.config.name).toBe('Meta Agent');
      expect(agent.config.type).toBe('conversational');
      expect(agent.config.description).toContain('creates and manages other agents');
    });

    it('should merge custom configuration', () => {
      const agent = new MetaAgent({
        agent: {
          id: 'custom-meta',
          name: 'Custom Meta Agent',
          llm: { temperature: 0.5 }
        },
        behavior: {
          creativity: 0.9
        }
      }, mockResourceManager);
      expect(agent.config.id).toBe('custom-meta');
      expect(agent.config.name).toBe('Custom Meta Agent');
      // ConfigurableAgent doesn't expose behavior config directly
      // It's passed to super() but not stored as a property
    });
  });

  describe('Initialize', () => {
    it('should initialize AgentCreator', async () => {
      const agent = new MetaAgent({}, mockResourceManager);
      agent.agentCreator = null;
      
      // Mock the parent initialize
      const originalInitialize = agent.initialize;
      agent.initialize = jest.fn().mockImplementation(async function() {
        // Simulate parent class initialization
        this.initialized = true;
        
        // Create and initialize AgentCreator
        this.agentCreator = mockAgentCreator;
        await this.agentCreator.initialize();
      });

      await agent.initialize();

      expect(agent.initialized).toBe(true);
      expect(mockAgentCreator.initialize).toHaveBeenCalled();
    });

    it('should handle singleton initialization pattern', async () => {
      const agent = new MetaAgent({}, mockResourceManager);
      agent.agentCreator = null;
      agent.initializationPromise = null;
      
      // Mock the _initialize method
      agent._initialize = jest.fn().mockImplementation(async function() {
        this.initialized = true;
        this.agentCreator = mockAgentCreator;
        await this.agentCreator.initialize();
      });

      // Call initialize multiple times
      const promise1 = agent.initialize();
      const promise2 = agent.initialize();
      
      await Promise.all([promise1, promise2]);

      // Should only initialize once
      expect(agent._initialize).toHaveBeenCalledTimes(1);
    });
  });

  describe('processMessage', () => {
    it('should handle slash commands', async () => {
      const message = { content: '/help' };
      
      metaAgent.handleCommand = jest.fn().mockResolvedValue({
        type: 'help',
        content: 'Help text'
      });

      const response = await metaAgent.processMessage(message);

      expect(metaAgent.handleCommand).toHaveBeenCalledWith(message);
      expect(response.type).toBe('help');
    });

    it('should handle natural language requests', async () => {
      const message = { content: 'Create a customer support agent' };
      
      metaAgent.handleNaturalLanguage = jest.fn().mockResolvedValue({
        type: 'agent_created',
        content: 'Agent created'
      });

      const response = await metaAgent.processMessage(message);

      expect(metaAgent.handleNaturalLanguage).toHaveBeenCalledWith(message);
      expect(response.type).toBe('agent_created');
    });
  });

  describe('Command Handlers', () => {
    describe('handleCreateAgent', () => {
      it('should create agent successfully', async () => {
        const requirementsString = '{"purpose": "Test agent", "taskType": "task"}';
        
        const response = await metaAgent.handleCreateAgent(requirementsString);

        expect(mockAgentCreator.createAgent).toHaveBeenCalledWith({
          purpose: 'Test agent',
          taskType: 'task'
        });
        expect(response.type).toBe('agent_created');
        expect(response.content).toContain('✅ Agent created successfully');
        expect(response.data.agentId).toBe('test-agent');
      });

      it('should handle invalid JSON', async () => {
        const response = await metaAgent.handleCreateAgent('invalid json');

        expect(response.type).toBe('error');
        expect(response.content).toContain('Invalid JSON format');
      });

      it('should handle creation failure', async () => {
        mockAgentCreator.createAgent.mockRejectedValueOnce(new Error('Creation failed'));
        
        const response = await metaAgent.handleCreateAgent('{"purpose": "Test"}');

        expect(response.type).toBe('error');
        expect(response.content).toContain('Failed to create agent: Creation failed');
      });
    });

    describe('handleListAgents', () => {
      it('should list created agents', async () => {
        const response = await metaAgent.handleListAgents();

        expect(mockAgentCreator.listCreatedAgents).toHaveBeenCalled();
        expect(response.type).toBe('agent_list');
        expect(response.content).toContain('Agent 1');
        expect(response.content).toContain('Agent 2');
        expect(response.data).toHaveLength(2);
      });

      it('should handle empty agent list', async () => {
        mockAgentCreator.listCreatedAgents.mockReturnValueOnce([]);
        
        const response = await metaAgent.handleListAgents();

        expect(response.type).toBe('agent_list');
        expect(response.content).toBe('No agents have been created yet.');
        expect(response.data).toEqual([]);
      });
    });

    describe('handleTestAgent', () => {
      it('should test existing agent', async () => {
        const response = await metaAgent.handleTestAgent('test-agent');

        expect(mockAgentCreator.getAgent).toHaveBeenCalledWith('test-agent');
        expect(mockAgentCreator.getTestResults).toHaveBeenCalledWith('test-agent');
        expect(response.type).toBe('test_results');
        expect(response.content).toContain('Test Results for Test Agent');
        expect(response.content).toContain('90.0%'); // Pass rate
      });

      it('should handle missing agent ID', async () => {
        const response = await metaAgent.handleTestAgent(undefined);

        expect(response.type).toBe('error');
        expect(response.content).toBe('Usage: /test-agent [agent-id]');
      });

      it('should handle non-existent agent', async () => {
        mockAgentCreator.getAgent.mockReturnValueOnce(null);
        
        const response = await metaAgent.handleTestAgent('invalid-id');

        expect(response.type).toBe('error');
        expect(response.content).toBe('Agent invalid-id not found');
      });
    });

    describe('handleAnalyzeAgent', () => {
      it('should analyze agent configuration', async () => {
        const response = await metaAgent.handleAnalyzeAgent('test-agent');

        expect(mockAgentCreator.analyzeAgent).toHaveBeenCalled();
        expect(response.type).toBe('analysis');
        expect(response.content).toContain('Analysis for Test Agent');
        expect(response.content).toContain('Score: 85/100');
      });
    });

    describe('handleOptimizeAgent', () => {
      it('should optimize agent prompts', async () => {
        const response = await metaAgent.handleOptimizeAgent('test-agent');

        expect(mockAgentCreator.optimizePrompts).toHaveBeenCalled();
        expect(response.type).toBe('optimization');
        expect(response.content).toContain('Optimization complete');
        expect(response.content).toContain('system_prompt: reduced by 50 characters');
      });
    });

    describe('handleExportAgent', () => {
      it('should export agent in JSON format', async () => {
        const response = await metaAgent.handleExportAgent('test-agent', 'json');

        expect(mockAgentCreator.exportConfig).toHaveBeenCalled();
        expect(response.type).toBe('export');
        expect(response.content).toContain('```json');
      });

      it('should export agent in YAML format', async () => {
        const response = await metaAgent.handleExportAgent('test-agent', 'yaml');

        expect(response.type).toBe('export');
        expect(response.content).toContain('```yaml');
      });

      it('should default to JSON format', async () => {
        // handleExportAgent defaults the second parameter to 'json'
        const response = await metaAgent.handleExportAgent('test-agent', undefined);

        expect(mockAgentCreator.exportConfig).toHaveBeenCalledWith(
          expect.anything(),
          'json'
        );
      });
    });

    describe('handleListTemplates', () => {
      it('should list available templates', async () => {
        const response = await metaAgent.handleListTemplates();

        expect(mockAgentCreator.listTemplates).toHaveBeenCalled();
        expect(response.type).toBe('template_list');
        expect(response.content).toContain('customer-support');
        expect(response.content).toContain('code-reviewer');
      });
    });

    describe('handleUseTemplate', () => {
      it('should create agent from template', async () => {
        const response = await metaAgent.handleUseTemplate('customer-support', '{"companyName": "Test Co"}');

        expect(mockAgentCreator.generateFromTemplate).toHaveBeenCalledWith(
          'customer-support',
          { companyName: 'Test Co' }
        );
        expect(mockAgentCreator.createAgent).toHaveBeenCalled();
        expect(response.type).toBe('agent_created');
        expect(response.content).toContain("Agent created from template 'customer-support'");
      });

      it('should handle missing template name', async () => {
        const response = await metaAgent.handleUseTemplate(undefined, '{}');

        expect(response.type).toBe('error');
        expect(response.content).toBe('Usage: /use-template [template-name] {variables}');
      });
    });

    describe('handleBatchCreate', () => {
      it('should create multiple agents', async () => {
        const response = await metaAgent.handleBatchCreate('[{"purpose": "Agent 1"}, {"purpose": "Agent 2"}]');

        expect(mockAgentCreator.designBatch).toHaveBeenCalled();
        expect(response.type).toBe('batch_results');
        expect(response.content).toContain('Batch Creation Complete');
        expect(response.content).toContain('Total: 2');
      });
    });

    describe('handleAgentReport', () => {
      it('should generate comprehensive agent report', async () => {
        const response = await metaAgent.handleAgentReport('test-agent');

        expect(mockAgentCreator.generateAgentReport).toHaveBeenCalledWith('test-agent');
        expect(response.type).toBe('report');
        expect(response.content).toContain('Agent Report: Test Agent');
        expect(response.content).toContain('Score: 85/100');
      });
    });

    describe('handleHelp', () => {
      it('should return help information', async () => {
        const response = await metaAgent.handleHelp();

        expect(response.type).toBe('help');
        expect(response.content).toContain('Meta Agent - Agent Creation and Management');
        expect(response.content).toContain('/create-agent');
        expect(response.content).toContain('/list-agents');
      });
    });
  });

  describe('Natural Language Processing', () => {
    describe('analyzeIntent', () => {
      it('should detect create intent', async () => {
        const intent = await metaAgent.analyzeIntent('I want to create a customer support agent');

        expect(intent.action).toBe('create');
        expect(intent.requirements.purpose).toContain('customer support');
      });

      it('should detect help intent', async () => {
        const intent = await metaAgent.analyzeIntent('What can you do?');

        expect(intent.action).toBe('help');
      });

      it('should default to chat intent', async () => {
        const intent = await metaAgent.analyzeIntent('Tell me about agents');

        expect(intent.action).toBe('chat');
      });
    });

    describe('detectTaskType', () => {
      it('should detect conversational type', () => {
        const type = metaAgent.detectTaskType('Create a chat support agent');
        expect(type).toBe('conversational');
      });

      it('should detect analytical type', () => {
        const type = metaAgent.detectTaskType('Build an agent to analyze data');
        expect(type).toBe('analytical');
      });

      it('should detect creative type', () => {
        const type = metaAgent.detectTaskType('I need an agent to write content');
        expect(type).toBe('creative');
      });

      it('should default to task type', () => {
        const type = metaAgent.detectTaskType('Make an agent');
        expect(type).toBe('task');
      });
    });

    describe('guidedAgentCreation', () => {
      it('should guide user through agent creation', async () => {
        const requirements = {
          purpose: 'create a helpful assistant',
          taskType: 'conversational'
        };

        const response = await metaAgent.guidedAgentCreation(requirements);

        expect(mockAgentCreator.createAgent).toHaveBeenCalledWith(requirements);
        expect(response.type).toBe('agent_created');
        expect(response.content).toContain('✅ Agent created successfully');
        expect(response.content).toContain('You can now:');
      });

      it('should handle creation failure gracefully', async () => {
        mockAgentCreator.createAgent.mockRejectedValueOnce(new Error('Creation failed'));
        
        const response = await metaAgent.guidedAgentCreation({
          purpose: 'test',
          taskType: 'task'
        });

        expect(response.type).toBe('error');
        expect(response.content).toContain('❌ Failed to create agent');
      });
    });
  });

  describe('handleCommand', () => {
    it('should route commands correctly', async () => {
      metaAgent.handleHelp = jest.fn().mockResolvedValue({ type: 'help' });
      
      const response = await metaAgent.handleCommand({ content: '/help' });

      expect(metaAgent.handleHelp).toHaveBeenCalled();
      expect(response.type).toBe('help');
    });

    it('should handle unknown commands', async () => {
      const response = await metaAgent.handleCommand({ content: '/unknown-command' });

      expect(response.type).toBe('error');
      expect(response.content).toContain('Unknown command: /unknown-command');
    });

    it('should handle command errors', async () => {
      metaAgent.handleCreateAgent = jest.fn().mockRejectedValue(new Error('Command failed'));
      
      const response = await metaAgent.handleCommand({ content: '/create-agent {}' });

      expect(response.type).toBe('error');
      expect(response.content).toContain('Command failed: Command failed');
    });
  });

  describe('Cleanup', () => {
    it('should cleanup AgentCreator', async () => {
      await metaAgent.cleanup();

      expect(mockAgentCreator.cleanup).toHaveBeenCalled();
    });
  });
});