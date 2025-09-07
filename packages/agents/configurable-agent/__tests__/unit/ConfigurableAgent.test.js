/**
 * Unit tests for ConfigurableAgent
 * Following TDD methodology without refactor phase
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { ConfigurableAgent } from '../../src/core/ConfigurableAgent.js';
import { AgentState } from '../../src/state/AgentState.js';
import { CapabilityManager } from '../../src/capabilities/CapabilityManager.js';
import { PromptManager } from '../../src/prompts/PromptManager.js';
import { KnowledgeGraphInterface } from '../../src/knowledge/KnowledgeGraphInterface.js';

describe('ConfigurableAgent', () => {
  let agent;
  let mockConfig;
  let mockResourceManager;
  let mockLLMClient;

  beforeEach(() => {
    // Create mock ResourceManager
    mockLLMClient = {
      complete: jest.fn().mockResolvedValue('Mock LLM response')
    };

    mockResourceManager = {
      get: jest.fn(async (key) => {
        if (key === 'llmClient') return mockLLMClient;
        if (key.startsWith('env.')) return 'mock-value';
        return null;
      })
    };

    // Create basic configuration matching the schema
    mockConfig = {
      id: 'test-agent-123',
      name: 'TestAgent',
      type: 'conversational',
      version: '1.0.0',
      llm: {
        provider: 'anthropic',
        model: 'claude-3',
        temperature: 0.7,
        maxTokens: 1000,
        systemPrompt: 'You are a helpful assistant.'
      },
      capabilities: [
        {
          module: 'file',
          tools: ['read', 'write'],
          permissions: {
            basePath: '/tmp',
            allowedExtensions: ['.txt', '.json']
          }
        },
        {
          module: 'calculator',
          tools: ['add', 'subtract', 'multiply', 'divide']
        }
      ],
      prompts: {
        templates: {
          greeting: 'Hello {{name}}!',
          system: 'You are a helpful assistant.'
        }
      },
      knowledge: {
        enabled: true,
        persistence: 'session',
        storage: 'memory'
      }
    };
  });

  describe('Initialization', () => {
    it('should create agent with valid configuration', () => {
      // Wrap config to match schema
      const wrappedConfig = { agent: mockConfig };
      agent = new ConfigurableAgent(wrappedConfig, mockResourceManager);
      
      expect(agent).toBeDefined();
      expect(agent.name).toBe('TestAgent');
      expect(agent.description).toBe(''); // No description in schema
      expect(agent.version).toBe('1.0.0');
      expect(agent.initialized).toBe(false);
    });

    it('should throw error without configuration', () => {
      expect(() => {
        new ConfigurableAgent();
      }).toThrow('Configuration is required');
    });

    it('should throw error without ResourceManager', () => {
      expect(() => {
        new ConfigurableAgent({ agent: mockConfig });
      }).toThrow('ResourceManager is required');
    });

    it('should initialize all components', async () => {
      agent = new ConfigurableAgent({ agent: mockConfig }, mockResourceManager);
      await agent.initialize();

      expect(agent.initialized).toBe(true);
      expect(agent.state).toBeInstanceOf(AgentState);
      expect(agent.capabilityManager).toBeInstanceOf(CapabilityManager);
      expect(agent.promptManager).toBeInstanceOf(PromptManager);
      expect(agent.knowledgeGraph).toBeInstanceOf(KnowledgeGraphInterface);
    });

    it('should not initialize knowledge graph if disabled', async () => {
      mockConfig.knowledge.enabled = false;
      agent = new ConfigurableAgent({ agent: mockConfig }, mockResourceManager);
      await agent.initialize();

      expect(agent.knowledgeGraph).toBeNull();
    });

    it('should fail to initialize twice', async () => {
      agent = new ConfigurableAgent({ agent: mockConfig }, mockResourceManager);
      await agent.initialize();
      
      await expect(agent.initialize()).rejects.toThrow('Agent already initialized');
    });
  });

  describe('Message Receiving (Actor Pattern)', () => {
    beforeEach(async () => {
      agent = new ConfigurableAgent({ agent: mockConfig }, mockResourceManager);
      await agent.initialize();
    });

    it('should receive and process a basic message', async () => {
      const message = {
        type: 'message',
        from: 'user-123',
        content: 'Hello, agent!'
      };

      const response = await agent.receive(message);

      expect(response).toBeDefined();
      expect(response.type).toBe('response');
      expect(response.to).toBe('user-123');
      expect(response.content).toBeDefined();
    });

    it('should handle chat messages', async () => {
      const message = {
        type: 'chat',
        from: 'user-123',
        content: 'What is 2+2?',
        sessionId: 'session-456'
      };

      const response = await agent.receive(message);
      
      // Debug output
      if (response.error) {
        console.log('Response error:', response.error);
      }

      expect(response.type).toBe('chat_response');
      expect(response.sessionId).toBe('session-456');
      expect(mockLLMClient.complete).toHaveBeenCalled();
    });

    it('should handle tool execution requests', async () => {
      const message = {
        type: 'tool_request',
        from: 'user-123',
        tool: 'calculator',
        operation: 'add',
        params: { a: 2, b: 3 }
      };

      const response = await agent.receive(message);

      expect(response.type).toBe('tool_response');
      expect(response.success).toBeDefined();
    });

    it('should handle query messages', async () => {
      const message = {
        type: 'query',
        from: 'user-123',
        query: 'What tools are available?'
      };

      const response = await agent.receive(message);

      expect(response.type).toBe('query_response');
      expect(response.data).toBeDefined();
    });

    it('should handle state management messages', async () => {
      const stateUpdateMessage = {
        type: 'state_update',
        from: 'system',
        updates: {
          contextVariable: 'test-value'
        }
      };

      const response = await agent.receive(stateUpdateMessage);
      
      // Debug output
      if (!response.success) {
        console.log('State update error:', response.error);
      }
      
      expect(response.type).toBe('state_updated');
      expect(response.success).toBe(true);

      // Verify state was updated
      const state = agent.state.getState();
      expect(state.context.contextVariable).toBe('test-value');
    });

    it('should handle invalid message types', async () => {
      const message = {
        type: 'unknown_type',
        from: 'user-123'
      };

      const response = await agent.receive(message);

      expect(response.type).toBe('error');
      expect(response.error).toContain('Unsupported message type');
    });

    it('should validate message structure', async () => {
      const invalidMessage = {
        // Missing required fields
        content: 'Test'
      };

      const response = await agent.receive(invalidMessage);

      expect(response.type).toBe('error');
      expect(response.error).toContain('Invalid message format');
    });
  });

  describe('Message Processing Flow', () => {
    beforeEach(async () => {
      agent = new ConfigurableAgent({ agent: mockConfig }, mockResourceManager);
      await agent.initialize();
    });

    it('should maintain conversation history', async () => {
      const message1 = {
        type: 'chat',
        from: 'user-123',
        content: 'Hello',
        sessionId: 'session-1'
      };

      const message2 = {
        type: 'chat',
        from: 'user-123',
        content: 'How are you?',
        sessionId: 'session-1'
      };

      await agent.receive(message1);
      await agent.receive(message2);

      const history = agent.state.getConversationHistory();
      expect(history).toHaveLength(4); // 2 user messages + 2 assistant responses
    });

    it('should extract and store context from conversations', async () => {
      const message = {
        type: 'chat',
        from: 'user-123',
        content: 'My name is John and I work at Acme Corp',
        sessionId: 'session-1'
      };

      await agent.receive(message);

      // If KG is enabled, context should be extracted
      if (agent.knowledgeGraph) {
        const context = await agent.knowledgeGraph.extractContext([
          { role: 'user', content: message.content }
        ]);
        expect(context.entities).toBeDefined();
      }
    });

    it('should apply prompt templates', async () => {
      const message = {
        type: 'chat',
        from: 'user-123',
        content: 'Use greeting template',
        sessionId: 'session-1',
        metadata: {
          template: 'greeting',
          variables: { name: 'Alice' }
        }
      };

      const response = await agent.receive(message);
      
      // Prompt manager should process templates
      expect(response).toBeDefined();
    });

    it('should respect response format configuration', async () => {
      // Test JSON format (default)
      const message = {
        type: 'chat',
        from: 'user-123',
        content: 'Test message',
        sessionId: 'session-1'
      };

      const response = await agent.receive(message);
      expect(typeof response.content).toBe('object');

      // Test with different response format in prompts
      const markdownConfig = JSON.parse(JSON.stringify(mockConfig));
      markdownConfig.prompts.responseFormats = {
        default: {
          type: 'markdown',
          includeMetadata: false
        }
      };
      agent = new ConfigurableAgent({ agent: markdownConfig }, mockResourceManager);
      await agent.initialize();
      agent.responseFormat = 'markdown'; // Override for test

      const response2 = await agent.receive(message);
      expect(typeof response2.content).toBe('string');
    });

    it('should handle concurrent messages correctly', async () => {
      const messages = [
        { type: 'chat', from: 'user-1', content: 'Message 1', sessionId: 's1' },
        { type: 'chat', from: 'user-2', content: 'Message 2', sessionId: 's2' },
        { type: 'chat', from: 'user-3', content: 'Message 3', sessionId: 's3' }
      ];

      const responses = await Promise.all(
        messages.map(msg => agent.receive(msg))
      );

      expect(responses).toHaveLength(3);
      responses.forEach((response, index) => {
        expect(response.sessionId).toBe(`s${index + 1}`);
      });
    });
  });

  describe('Tool Integration', () => {
    beforeEach(async () => {
      agent = new ConfigurableAgent({ agent: mockConfig }, mockResourceManager);
      await agent.initialize();
    });

    it('should execute allowed tools', async () => {
      const message = {
        type: 'tool_request',
        from: 'user-123',
        tool: 'add',
        operation: 'add',
        params: { a: 5, b: 3 }
      };

      const response = await agent.receive(message);

      expect(response.type).toBe('tool_response');
      expect(response.success).toBe(true);
    });

    it('should reject unauthorized tool operations', async () => {
      const message = {
        type: 'tool_request',
        from: 'user-123',
        tool: 'write',
        operation: 'write',
        params: { path: '/etc/passwd', content: 'hacked' }
      };

      const response = await agent.receive(message);

      expect(response.type).toBe('tool_response');
      expect(response.success).toBe(false);
      // The mock FileModule should throw "Permission denied" for /etc/ paths
      expect(response.error).toContain('Permission denied');
    });

    it('should handle tool errors gracefully', async () => {
      const message = {
        type: 'tool_request',
        from: 'user-123',
        tool: 'nonexistent',
        operation: 'execute',
        params: {}
      };

      const response = await agent.receive(message);

      expect(response.type).toBe('tool_response');
      expect(response.success).toBe(false);
      expect(response.error).toContain('Tool not found');
    });
  });

  describe('LLM Integration', () => {
    beforeEach(async () => {
      agent = new ConfigurableAgent({ agent: mockConfig }, mockResourceManager);
      await agent.initialize();
    });

    it('should use LLM client from ResourceManager', async () => {
      const message = {
        type: 'chat',
        from: 'user-123',
        content: 'Test LLM integration',
        sessionId: 'session-1'
      };

      await agent.receive(message);

      expect(mockResourceManager.get).toHaveBeenCalledWith('llmClient');
      expect(mockLLMClient.complete).toHaveBeenCalled();
    });

    it('should format messages for LLM correctly', async () => {
      const message = {
        type: 'chat',
        from: 'user-123',
        content: 'Test message',
        sessionId: 'session-1'
      };

      await agent.receive(message);

      const llmCallArgs = mockLLMClient.complete.mock.calls[0];
      expect(llmCallArgs[0]).toContain('System: You are a helpful assistant'); // First arg is prompt string
      expect(llmCallArgs[1]).toBe(1000); // Second arg is maxTokens
    });

    it('should handle LLM errors', async () => {
      mockLLMClient.complete.mockRejectedValueOnce(new Error('LLM service unavailable'));

      const message = {
        type: 'chat',
        from: 'user-123',
        content: 'Test message',
        sessionId: 'session-1'
      };

      const response = await agent.receive(message);

      expect(response.type).toBe('chat_response');
      expect(response.error).toContain('Failed to process message');
    });

    it('should include conversation context in LLM calls', async () => {
      // Send multiple messages
      const messages = [
        { type: 'chat', from: 'user-123', content: 'My name is Bob', sessionId: 's1' },
        { type: 'chat', from: 'user-123', content: 'What is my name?', sessionId: 's1' }
      ];

      await agent.receive(messages[0]);
      await agent.receive(messages[1]);

      const lastLLMCall = mockLLMClient.complete.mock.calls[1];
      expect(lastLLMCall[0]).toContain('Assistant:'); // Should contain conversation history
    });
  });

  describe('State Persistence', () => {
    beforeEach(async () => {
      agent = new ConfigurableAgent({ agent: mockConfig }, mockResourceManager);
      await agent.initialize();
    });

    it('should save state on request', async () => {
      const message = {
        type: 'save_state',
        from: 'system'
      };

      const response = await agent.receive(message);

      expect(response.type).toBe('state_saved');
      expect(response.success).toBe(true);
    });

    it('should load state on request', async () => {
      const message = {
        type: 'load_state',
        from: 'system',
        stateId: 'test-state-123'
      };

      const response = await agent.receive(message);

      expect(response.type).toBe('state_loaded');
    });

    it('should export agent state', async () => {
      const message = {
        type: 'export_state',
        from: 'system'
      };

      const response = await agent.receive(message);

      expect(response.type).toBe('state_export');
      expect(response.data).toBeDefined();
      expect(response.data.agentName).toBe('TestAgent');
      expect(response.data.state).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    beforeEach(async () => {
      agent = new ConfigurableAgent({ agent: mockConfig }, mockResourceManager);
      await agent.initialize();
    });

    it('should handle initialization errors', async () => {
      const badConfig = { ...mockConfig };
      delete badConfig.name; // Remove required field

      expect(() => {
        new ConfigurableAgent({ agent: badConfig }, mockResourceManager);
      }).toThrow('Invalid configuration');
    });

    it('should handle component initialization failures', async () => {
      // Mock a failure in state initialization
      jest.spyOn(AgentState.prototype, 'initialize').mockRejectedValueOnce(
        new Error('State init failed')
      );

      agent = new ConfigurableAgent({ agent: mockConfig }, mockResourceManager);
      
      await expect(agent.initialize()).rejects.toThrow('Failed to initialize agent');
    });

    it('should recover from transient errors', async () => {
      // First call fails, second succeeds
      mockLLMClient.complete
        .mockRejectedValueOnce(new Error('Temporary failure'))
        .mockResolvedValueOnce('Success');

      const message = {
        type: 'chat',
        from: 'user-123',
        content: 'Test retry',
        sessionId: 'session-1',
        retryOnError: true
      };

      const response = await agent.receive(message);

      expect(response.type).toBe('chat_response');
      expect(mockLLMClient.complete).toHaveBeenCalledTimes(2);
    });

    it('should provide clear error messages', async () => {
      const message = {
        type: 'chat',
        from: 'user-123',
        content: null, // Invalid content
        sessionId: 'session-1'
      };

      const response = await agent.receive(message);

      expect(response.type).toBe('error');
      expect(response.error).toContain('Message content is required');
    });
  });

  describe('Cleanup and Lifecycle', () => {
    beforeEach(async () => {
      agent = new ConfigurableAgent({ agent: mockConfig }, mockResourceManager);
      await agent.initialize();
    });

    it('should cleanup resources on shutdown', async () => {
      const message = {
        type: 'shutdown',
        from: 'system'
      };

      const response = await agent.receive(message);

      expect(response.type).toBe('shutdown_complete');
      expect(agent.initialized).toBe(false);
    });

    it('should save state before shutdown if configured', async () => {
      agent = new ConfigurableAgent({ agent: mockConfig }, mockResourceManager);
      await agent.initialize();
      agent.autoSaveOnShutdown = true; // Set after initialization

      const message = {
        type: 'shutdown',
        from: 'system'
      };

      const response = await agent.receive(message);

      expect(response.stateSaved).toBe(true);
    });

    it('should handle cleanup errors gracefully', async () => {
      // Mock cleanup error
      jest.spyOn(agent.state, 'cleanup').mockRejectedValueOnce(
        new Error('Cleanup failed')
      );

      const message = {
        type: 'shutdown',
        from: 'system'
      };

      const response = await agent.receive(message);

      expect(response.type).toBe('shutdown_complete');
      expect(response.warnings).toContain('State cleanup failed: Cleanup failed');
    });
  });

  describe('getMetadata', () => {
    beforeEach(async () => {
      agent = new ConfigurableAgent({ agent: mockConfig }, mockResourceManager);
      await agent.initialize();
    });

    it('should return agent metadata', () => {
      const metadata = agent.getMetadata();

      expect(metadata).toEqual({
        name: 'TestAgent',
        description: '',  // description is not in schema
        version: '1.0.0',
        capabilities: ['file', 'calculator'],
        responseFormat: 'json',
        initialized: true
      });
    });
  });
});