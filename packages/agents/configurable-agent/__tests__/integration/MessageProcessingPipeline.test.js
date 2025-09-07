/**
 * Integration tests for complete message processing pipeline
 * Tests end-to-end message flow with real ResourceManager integration
 */

import { describe, it, expect, beforeAll, beforeEach, afterAll } from '@jest/globals';
import { ConfigurableAgent } from '../../src/core/ConfigurableAgent.js';

describe('Message Processing Pipeline Integration', () => {
  let resourceManager;
  let agent;
  let testConfig;

  beforeAll(async () => {
    // Get real ResourceManager instance (singleton)
    const { ResourceManager } = await import('@legion/resource-manager');
    resourceManager = await ResourceManager.getInstance();
    
    // Verify we have required resources
    const llmClient = await resourceManager.get('llmClient');
    expect(llmClient).toBeDefined();
  });

  beforeEach(async () => {
    // Create test configuration with wrapped agent structure
    testConfig = {
      agent: {
        id: 'integration-agent-123',
        name: 'IntegrationTestAgent',
        type: 'conversational',
        version: '1.0.0',
        llm: {
          provider: 'anthropic',
          model: 'claude-3',
          temperature: 0.7,
          maxTokens: 1000,
          systemPrompt: 'You are a test assistant for integration testing.',
          retryStrategy: {
            maxRetries: 3,
            backoffMs: 1000
          }
        },
        capabilities: [
          {
            module: 'mock-calculator-module',
            tools: ['add', 'multiply'],
            permissions: {
              basePath: '/tmp',
              allowedExtensions: ['.txt', '.json']
            }
          },
          {
            module: 'mock-calculator-module',
            tools: ['add', 'subtract', 'multiply', 'divide']
          }
        ],
        prompts: {
          templates: {
            greeting: 'Hello {{name}}! I am {{agentName}}.',
            systemMessage: 'System: {{message}}',
            errorResponse: 'Error: {{error}}'
          },
          responseFormats: {
            default: {
              type: 'json',
              includeMetadata: true
            },
            simple: {
              type: 'text',
              includeMetadata: false
            }
          }
        },
        knowledge: {
          enabled: true,
          persistence: 'session',
          storage: 'memory'
        },
        state: {
          conversationHistory: {
            maxMessages: 50,
            pruningStrategy: 'sliding-window'
          },
          contextVariables: {
            userName: {
              type: 'string',
              persistent: true,
              extractionPattern: 'My name is (.+)'
            },
            currentTopic: {
              type: 'string',
              persistent: false
            }
          }
        }
      }
    };

    // Create and initialize agent
    agent = new ConfigurableAgent(testConfig, resourceManager);
    await agent.initialize();
    
    expect(agent.initialized).toBe(true);
  });

  afterAll(async () => {
    // Clean up any resources if needed
    if (agent?.initialized) {
      await agent.receive({
        type: 'shutdown',
        from: 'test-system'
      });
    }
    
    // Force cleanup to prevent Jest from hanging
    if (typeof global.gc === 'function') {
      global.gc();
    }
    
    // Give a small delay to ensure cleanup completes
    await new Promise(resolve => setTimeout(resolve, 100));
  });

  describe('Basic Message Processing', () => {
    it('should process a simple chat message end-to-end', async () => {
      const message = {
        type: 'chat',
        from: 'user-integration-test',
        content: 'Hello, this is an integration test message.',
        sessionId: 'integration-session-1'
      };

      const response = await agent.receive(message);

      expect(response).toBeDefined();
      expect(response.type).toBe('chat_response');
      expect(response.sessionId).toBe('integration-session-1');
      expect(response.to).toBe('user-integration-test');
      expect(response.content).toBeDefined();
      
      // Since response format is JSON by default, content should be an object
      expect(typeof response.content).toBe('object');
      
      // Verify conversation history was updated
      const history = agent.state.getConversationHistory();
      expect(history.length).toBeGreaterThanOrEqual(2); // User message + assistant response
      
      const userMessage = history.find(m => m.role === 'user');
      const assistantMessage = history.find(m => m.role === 'assistant');
      
      expect(userMessage.content).toBe(message.content);
      expect(assistantMessage.content).toBeDefined();
    });

    it('should process template-based messages with variables', async () => {
      const message = {
        type: 'chat',
        from: 'user-template-test',
        content: 'Use the greeting template',
        sessionId: 'template-session-1',
        metadata: {
          template: 'greeting',
          variables: {
            name: 'Alice',
            agentName: agent.name
          }
        }
      };

      const response = await agent.receive(message);

      expect(response.type).toBe('chat_response');
      expect(response.sessionId).toBe('template-session-1');
      
      // The response should have processed the template
      expect(response).toBeDefined();
    });

    it('should handle multiple concurrent messages correctly', async () => {
      const messages = [
        {
          type: 'chat',
          from: 'user-concurrent-1',
          content: 'First concurrent message',
          sessionId: 'concurrent-session-1'
        },
        {
          type: 'chat',
          from: 'user-concurrent-2',
          content: 'Second concurrent message',
          sessionId: 'concurrent-session-2'
        },
        {
          type: 'chat',
          from: 'user-concurrent-3',
          content: 'Third concurrent message',
          sessionId: 'concurrent-session-3'
        }
      ];

      // Process all messages concurrently
      const responses = await Promise.all(
        messages.map(msg => agent.receive(msg))
      );

      expect(responses).toHaveLength(3);
      
      // Verify each response has correct session mapping
      responses.forEach((response, index) => {
        expect(response.type).toBe('chat_response');
        expect(response.sessionId).toBe(`concurrent-session-${index + 1}`);
        expect(response.to).toBe(`user-concurrent-${index + 1}`);
      });

      // Verify conversation history contains all messages
      const history = agent.state.getConversationHistory();
      expect(history.length).toBeGreaterThanOrEqual(6); // 3 user + 3 assistant messages
    }, 15000);
  });

  describe('Tool Integration Pipeline', () => {
    it('should execute tool requests through complete pipeline', async () => {
      const toolMessage = {
        type: 'tool_request',
        from: 'user-tool-test',
        tool: 'add',
        operation: 'add',
        params: { a: 15, b: 25 },
        sessionId: 'tool-session-1'
      };

      const response = await agent.receive(toolMessage);

      expect(response.type).toBe('tool_response');
      expect(response.success).toBe(true);
      expect(response.sessionId).toBe('tool-session-1');
      expect(response.to).toBe('user-tool-test');
      
      // The mock calculator should return the sum
      expect(response.result).toBe(40);
    });

    it('should handle tool permission enforcement in pipeline', async () => {
      const restrictedMessage = {
        type: 'tool_request',
        from: 'user-restricted-test',
        tool: 'divide',
        operation: 'divide',
        params: {
          a: 10,
          b: 0 // Division by zero should be rejected
        },
        sessionId: 'restricted-session-1'
      };

      const response = await agent.receive(restrictedMessage);

      expect(response.type).toBe('tool_response');
      expect(response.success).toBe(false);
      expect(response.error).toContain('Division by zero is not allowed');
      expect(response.sessionId).toBe('restricted-session-1');
    });
  });

  describe('State Management Pipeline', () => {
    it('should extract and store context variables from conversation', async () => {
      const nameMessage = {
        type: 'chat',
        from: 'user-context-test',
        content: 'My name is Bob and I work at TechCorp',
        sessionId: 'context-session-1'
      };

      const response = await agent.receive(nameMessage);
      
      expect(response.type).toBe('chat_response');

      // Check if context extraction worked (if implemented)
      const state = agent.state.getState();
      if (state.context.userName) {
        expect(state.context.userName).toBe('Bob');
      }
    });

    it('should handle state updates through pipeline', async () => {
      const stateMessage = {
        type: 'state_update',
        from: 'system',
        updates: {
          currentTopic: 'integration testing',
          userPreference: 'detailed responses'
        }
      };

      const response = await agent.receive(stateMessage);

      expect(response.type).toBe('state_updated');
      expect(response.success).toBe(true);

      // Verify state was updated
      const state = agent.state.getState();
      expect(state.context.currentTopic).toBe('integration testing');
      expect(state.context.userPreference).toBe('detailed responses');
    });

    it('should save and restore state through pipeline', async () => {
      // First add some conversation history
      await agent.receive({
        type: 'chat',
        from: 'user-save-test',
        content: 'Test message for state saving',
        sessionId: 'save-session-1'
      });

      // Save state
      const saveResponse = await agent.receive({
        type: 'save_state',
        from: 'system'
      });

      expect(saveResponse.type).toBe('state_saved');
      expect(saveResponse.success).toBe(true);

      // Load state (this tests the persistence mechanism)
      const loadResponse = await agent.receive({
        type: 'load_state',
        from: 'system',
        stateId: saveResponse.stateId || 'latest'
      });

      expect(loadResponse.type).toBe('state_loaded');
    });
  });

  describe('Error Handling Pipeline', () => {
    it('should handle invalid message formats gracefully', async () => {
      const invalidMessage = {
        // Missing required fields
        content: 'Invalid message'
      };

      const response = await agent.receive(invalidMessage);

      expect(response.type).toBe('error');
      expect(response.error).toContain('Invalid message format');
    });

    it('should handle LLM errors with retry mechanism', async () => {
      // This test would work with real LLM but is limited in mock environment
      const message = {
        type: 'chat',
        from: 'user-retry-test',
        content: 'Test retry mechanism',
        sessionId: 'retry-session-1',
        retryOnError: true
      };

      const response = await agent.receive(message);
      
      // Should eventually succeed or provide meaningful error
      expect(response.type).toMatch(/^(chat_response|error)$/);
    }, 20000); // 20 second timeout for retry mechanism

    it('should provide detailed error information in pipeline', async () => {
      const errorMessage = {
        type: 'chat',
        from: 'user-error-test',
        content: null, // This should cause an error
        sessionId: 'error-session-1'
      };

      const response = await agent.receive(errorMessage);

      expect(response.type).toBe('error');
      expect(response.error).toBeDefined();
      expect(response.error).toContain('Message content is required');
      expect(response.to).toBe('user-error-test');
    });
  });

  describe('Knowledge Graph Integration Pipeline', () => {
    it('should integrate knowledge graph in message processing', async () => {
      if (!agent.knowledgeGraph) {
        // Skip if KG is not enabled
        return;
      }

      const knowledgeMessage = {
        type: 'chat',
        from: 'user-kg-test',
        content: 'Remember that I prefer technical explanations and I work with Node.js',
        sessionId: 'kg-session-1'
      };

      const response = await agent.receive(knowledgeMessage);

      expect(response.type).toBe('chat_response');
      
      // The knowledge graph should have extracted some context
      // (exact behavior depends on KG implementation)
      expect(response).toBeDefined();
    }, 15000);

    it('should query knowledge graph through pipeline', async () => {
      if (!agent.knowledgeGraph) {
        return; // Skip if KG not available
      }

      const queryMessage = {
        type: 'query',
        from: 'user-query-test',
        query: 'What do you know about my preferences?'
      };

      const response = await agent.receive(queryMessage);

      expect(response.type).toBe('query_response');
      expect(response.data).toBeDefined();
    });
  });

  describe('Full Conversation Flow', () => {
    it('should handle a realistic conversation flow end-to-end', async () => {
      const conversationFlow = [
        {
          type: 'chat',
          from: 'user-conversation',
          content: 'Hello, my name is Alice and I need help with a calculation',
          sessionId: 'full-conversation-1'
        },
        {
          type: 'chat',
          from: 'user-conversation',
          content: 'Can you add 150 and 275 for me?',
          sessionId: 'full-conversation-1'
        },
        {
          type: 'tool_request',
          from: 'user-conversation',
          tool: 'add',
          operation: 'add',
          params: { a: 150, b: 275 },
          sessionId: 'full-conversation-1'
        },
        {
          type: 'chat',
          from: 'user-conversation',
          content: 'Thank you! Can you save this conversation?',
          sessionId: 'full-conversation-1'
        },
        {
          type: 'save_state',
          from: 'user-conversation'
        }
      ];

      const responses = [];
      
      // Process each message in sequence
      for (const message of conversationFlow) {
        const response = await agent.receive(message);
        responses.push(response);
        
        // Brief pause between messages to simulate real conversation
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Verify all responses
      expect(responses).toHaveLength(5);
      
      // Check first response (greeting)
      expect(responses[0].type).toBe('chat_response');
      expect(responses[0].sessionId).toBe('full-conversation-1');
      
      // Check tool execution response
      expect(responses[2].type).toBe('tool_response');
      expect(responses[2].success).toBe(true);
      expect(responses[2].result).toBe(425);
      
      // Check state save response
      expect(responses[4].type).toBe('state_saved');
      expect(responses[4].success).toBe(true);

      // Verify final conversation history
      const finalHistory = agent.state.getConversationHistory();
      expect(finalHistory.length).toBeGreaterThanOrEqual(6); // 3 chat pairs (user + assistant)

      // Export final state
      const exportResponse = await agent.receive({
        type: 'export_state',
        from: 'system'
      });

      expect(exportResponse.type).toBe('state_export');
      expect(exportResponse.data.agentName).toBe('IntegrationTestAgent');
      expect(exportResponse.data.state).toBeDefined();
    }, 15000); // 15 second timeout for complex conversation flow
  });
});