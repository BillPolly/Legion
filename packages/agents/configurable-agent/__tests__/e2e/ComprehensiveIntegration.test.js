/**
 * Comprehensive End-to-End Integration Tests
 * Tests complete agent functionality with all components integrated
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';

describe('Comprehensive E2E Integration Tests', () => {
  let resourceManager;
  let testAgents = [];
  
  beforeAll(async () => {
    // Get ResourceManager singleton
    const { ResourceManager } = await import('@legion/resource-manager');
    resourceManager = await ResourceManager.getInstance();
    
    // Verify we have required resources
    const llmClient = await resourceManager.get('llmClient');
    expect(llmClient).toBeDefined();
  }, 30000);

  afterAll(async () => {
    // Clean up all test agents
    for (const agent of testAgents) {
      try {
        await agent.receive({ type: 'shutdown', from: 'test-cleanup' });
      } catch (error) {
        console.warn('Agent cleanup warning:', error.message);
      }
    }
    testAgents = [];
  });

  beforeEach(() => {
    // Reset test agents array for each test
    testAgents = [];
  });

  afterEach(async () => {
    // Clean up agents created in this test
    for (const agent of testAgents) {
      try {
        await agent.receive({ type: 'shutdown', from: 'test-cleanup' });
      } catch (error) {
        console.warn('Test agent cleanup warning:', error.message);
      }
    }
    testAgents = [];
  });

  describe('8.1 Integration Test Suite Foundation', () => {
    
    it('should verify test environment is properly set up', async () => {
      expect(resourceManager).toBeDefined();
      
      const llmClient = await resourceManager.get('llmClient');
      expect(llmClient).toBeDefined();
      expect(typeof llmClient.complete).toBe('function');
    });

    it('should create agent with minimal configuration', async () => {
      const { ConfigurableAgent } = await import('../../src/core/ConfigurableAgent.js');
      
      const config = createMinimalTestConfig('minimal-test-agent');
      const agent = new ConfigurableAgent(config, resourceManager);
      testAgents.push(agent);
      
      await agent.initialize();
      expect(agent.initialized).toBe(true);
      expect(agent.name).toBe('MinimalTestAgent');
    });

    it('should create agent with full configuration', async () => {
      const { ConfigurableAgent } = await import('../../src/core/ConfigurableAgent.js');
      
      const config = createFullTestConfig('full-test-agent');
      const agent = new ConfigurableAgent(config, resourceManager);
      testAgents.push(agent);
      
      await agent.initialize();
      expect(agent.initialized).toBe(true);
      expect(agent.capabilityManager).toBeDefined();
      expect(agent.promptManager).toBeDefined();
      expect(agent.knowledgeGraph).toBeDefined();
      expect(agent.state).toBeDefined();
    });

    it('should handle configuration validation errors gracefully', async () => {
      const { ConfigurableAgent } = await import('../../src/core/ConfigurableAgent.js');
      
      const invalidConfig = { agent: { name: 'Invalid' } }; // Missing required fields
      
      expect(() => {
        new ConfigurableAgent(invalidConfig, resourceManager);
      }).toThrow();
    });
  });

  describe('8.2 Complete Agent Lifecycle', () => {

    it('should complete full lifecycle: create → initialize → operate → shutdown', async () => {
      const { ConfigurableAgent } = await import('../../src/core/ConfigurableAgent.js');
      
      // Phase 1: Create
      const config = createFullTestConfig('lifecycle-test-agent');
      const agent = new ConfigurableAgent(config, resourceManager);
      expect(agent.initialized).toBe(false);
      
      // Phase 2: Initialize  
      await agent.initialize();
      expect(agent.initialized).toBe(true);
      expect(agent.state).toBeDefined();
      expect(agent.capabilityManager).toBeDefined();
      
      // Phase 3: Operate - Test basic functionality
      const chatResponse = await agent.receive({
        type: 'chat',
        from: 'lifecycle-test',
        content: 'Hello agent',
        sessionId: 'lifecycle-session'
      });
      expect(chatResponse.type).toBe('chat_response');
      expect(chatResponse.content).toBeDefined();
      
      // Phase 4: Shutdown
      const shutdownResponse = await agent.receive({
        type: 'shutdown',
        from: 'lifecycle-test'
      });
      expect(shutdownResponse.type).toBe('shutdown_complete');
      expect(agent.initialized).toBe(false);
      
      // Agent should not be added to testAgents since it's manually shut down
    }, 45000);

    it('should maintain state consistency throughout lifecycle', async () => {
      const { ConfigurableAgent } = await import('../../src/core/ConfigurableAgent.js');
      
      const config = createFullTestConfig('state-lifecycle-agent');
      const agent = new ConfigurableAgent(config, resourceManager);
      testAgents.push(agent);
      
      await agent.initialize();
      
      // Set initial state
      await agent.receive({
        type: 'state_update',
        from: 'state-test',
        updates: { testCounter: 1, testString: 'initial' }
      });
      
      // Perform operations that modify state
      await agent.receive({
        type: 'chat',
        from: 'state-test',
        content: 'Remember my name is Alice',
        sessionId: 'state-session'
      });
      
      // Update state again
      await agent.receive({
        type: 'state_update', 
        from: 'state-test',
        updates: { testCounter: 2, testString: 'updated' }
      });
      
      // Verify state persistence
      const stateExport = await agent.receive({
        type: 'export_state',
        from: 'state-test'
      });
      
      expect(stateExport.type).toBe('state_export');
      expect(stateExport.data.state.context.testCounter).toBe(2);
      expect(stateExport.data.state.context.testString).toBe('updated');
    }, 30000);

    it('should handle initialization errors gracefully', async () => {
      const { ConfigurableAgent } = await import('../../src/core/ConfigurableAgent.js');
      
      // Create config with invalid capability
      const config = createFullTestConfig('init-error-agent');
      config.agent.capabilities = [
        {
          module: 'nonexistent-module',
          tools: ['fake-tool'],
          permissions: { read: true }
        }
      ];
      
      const agent = new ConfigurableAgent(config, resourceManager);
      
      // Initialization should fail gracefully
      await expect(agent.initialize()).rejects.toThrow();
      expect(agent.initialized).toBe(false);
    }, 15000);
  });

  describe('8.3 Cross-Component Integration', () => {

    it('should integrate state + capabilities + prompts + knowledge + BT', async () => {
      const { ConfigurableAgent } = await import('../../src/core/ConfigurableAgent.js');
      const { createConversationFlowConfig } = await import('../../src/bt/AgentBTConfig.js');
      
      const config = createFullTestConfig('cross-component-agent');
      const agent = new ConfigurableAgent(config, resourceManager);
      testAgents.push(agent);
      
      await agent.initialize();
      
      // Test 1: State + Prompts integration
      await agent.receive({
        type: 'state_update',
        from: 'integration-test',
        updates: { 
          userName: 'Bob', 
          preferences: { tone: 'friendly', language: 'english' }
        }
      });
      
      // Test 2: Capabilities + State integration  
      const toolResponse = await agent.receive({
        type: 'tool_request',
        from: 'integration-test',
        tool: 'calculator',
        operation: 'add',
        params: { expression: '10 + 15' }, // Calculator tool expects 'expression' parameter
        sessionId: 'integration-session'
      });
      expect(toolResponse.success).toBe(true);
      expect(toolResponse.result).toBe(25);
      
      // Test 3: Knowledge + Chat integration
      const chatWithKnowledge = await agent.receive({
        type: 'chat',
        from: 'integration-test',
        content: 'My favorite color is purple and I like math',
        sessionId: 'knowledge-session'
      });
      expect(chatWithKnowledge.type).toBe('chat_response');
      
      // Test 4: BT + All Components integration
      const conversationFlow = createConversationFlowConfig({
        userMessage: 'What can you help me with?',
        queryCapabilities: true,
        saveState: true,
        sessionId: 'bt-integration-session'
      });
      
      const btResponse = await agent.receive({
        type: 'execute_bt',
        from: 'integration-test',
        sessionId: 'bt-integration-session',
        btConfig: conversationFlow
      });
      
      // Debug the response if it's an error
      if (btResponse.type === 'bt_execution_error') {
        console.log('BT Execution Error:', btResponse.error);
        console.log('BT Error Stack:', btResponse.stack || 'No stack trace available');
        console.log('BT Error Details:', JSON.stringify(btResponse, null, 2));
        // Also check for errors in the response data
        if (btResponse.data && btResponse.data.error) {
          console.log('Data Error:', btResponse.data.error);
          console.log('Data Stack:', btResponse.data.stack);
        }
      }
      
      // Check the actual response type first  
      expect(btResponse).toBeDefined();
      expect(btResponse.type).toBe('bt_execution_result');
      expect(btResponse.success).toBe(true);
      expect(btResponse.artifacts).toBeDefined();
      expect(btResponse.artifacts.capabilities).toBeDefined();
      expect(btResponse.artifacts.chatResponse).toBeDefined();
      // saveResult is only expected if saveState is true in the config
      if (conversationFlow.children.some(c => c.type === 'agent_state')) {
        expect(btResponse.artifacts.saveResult).toBeDefined();
      }
      
    }, 60000);

    it('should handle component interaction failures gracefully', async () => {
      const { ConfigurableAgent } = await import('../../src/core/ConfigurableAgent.js');
      
      const config = createFullTestConfig('error-handling-agent');
      const agent = new ConfigurableAgent(config, resourceManager);
      testAgents.push(agent);
      
      await agent.initialize();
      
      // Test invalid tool request
      const invalidToolResponse = await agent.receive({
        type: 'tool_request',
        from: 'error-test',
        tool: 'nonexistent-tool',
        operation: 'invalid-operation',
        sessionId: 'error-session'
      });
      expect(invalidToolResponse.success).toBe(false);
      expect(invalidToolResponse.error).toBeDefined();
      
      // Test invalid BT configuration
      const invalidBTResponse = await agent.receive({
        type: 'execute_bt',
        from: 'error-test',
        sessionId: 'bt-error-session',
        btConfig: {
          type: 'invalid_type',
          id: 'invalid-node'
        }
      });
      expect(invalidBTResponse.type).toBe('bt_execution_error');
      
      // Agent should still be operational
      const healthCheck = await agent.receive({
        type: 'query',
        from: 'error-test',
        query: 'What is your configuration?'
      });
      expect(healthCheck.type).toBe('query_response');
      
    }, 30000);

    it('should maintain component isolation and proper error boundaries', async () => {
      const { ConfigurableAgent } = await import('../../src/core/ConfigurableAgent.js');
      
      const config = createFullTestConfig('isolation-test-agent');
      const agent = new ConfigurableAgent(config, resourceManager);
      testAgents.push(agent);
      
      await agent.initialize();
      
      // Component failures should not affect other components
      
      // 1. Tool failure shouldn't affect chat
      await agent.receive({
        type: 'tool_request',
        from: 'isolation-test',
        tool: 'invalid-tool',
        operation: 'fail'
      });
      
      const chatStillWorking = await agent.receive({
        type: 'chat',
        from: 'isolation-test', 
        content: 'Hello after tool failure',
        sessionId: 'isolation-session'
      });
      expect(chatStillWorking.type).toBe('chat_response');
      
      // 2. Invalid state update shouldn't break other operations
      await agent.receive({
        type: 'state_update',
        from: 'isolation-test',
        updates: { invalidKey: { nestedInvalid: () => {} } }
      });
      
      const queryStillWorking = await agent.receive({
        type: 'query',
        from: 'isolation-test',
        query: 'What tools are available?'
      });
      expect(queryStillWorking.type).toBe('query_response');
      
    }, 30000);
  });

  /**
   * Create minimal test configuration
   */
  function createMinimalTestConfig(agentId) {
    return JSON.parse(`{
      "agent": {
        "id": "${agentId}",
        "name": "${agentId.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('')}",
        "type": "conversational",
        "version": "1.0.0",
        "llm": {
          "provider": "anthropic",
          "model": "claude-3-haiku",
          "temperature": 0.1,
          "maxTokens": 100,
          "systemPrompt": "You are a helpful test assistant."
        }
      }
    }`);
  }

  /**
   * Create full test configuration with all components
   */
  function createFullTestConfig(agentId) {
    return JSON.parse(`{
      "agent": {
        "id": "${agentId}",
        "name": "${agentId.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('')}",
        "type": "conversational", 
        "version": "1.0.0",
        "capabilities": [
          {
            "module": "calculator",
            "tools": ["add", "subtract", "multiply", "divide"],
            "permissions": { "read": true, "write": true, "execute": true }
          }
        ],
        "llm": {
          "provider": "anthropic",
          "model": "claude-3-haiku", 
          "temperature": 0.2,
          "maxTokens": 300,
          "systemPrompt": "You are a helpful assistant with calculator capabilities."
        },
        "prompts": {
          "responseFormats": { 
            "default": {
              "type": "text",
              "includeMetadata": false
            }
          }
        },
        "state": {
          "maxHistorySize": 20,
          "pruneStrategy": "sliding",
          "contextVariables": {
            "userName": { "type": "string", "persistent": true },
            "preferences": { "type": "object", "persistent": true },
            "testCounter": { "type": "number", "persistent": false },
            "testString": { "type": "string", "persistent": false }
          }
        },
        "knowledge": {
          "enabled": true,
          "persistence": "session"
        }
      }
    }`);
  }
});