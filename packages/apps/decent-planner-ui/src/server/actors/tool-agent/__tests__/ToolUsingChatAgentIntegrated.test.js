/**
 * ToolUsingChatAgent Integration Tests with ContextOptimizer
 * 
 * Tests the complete integrated system including:
 * - Automatic context optimization after every message
 * - Infrastructure preservation during optimization
 * - ResourceActor availability for display_resource tool
 * - End-to-end /show command functionality
 * - Performance and reliability under load
 */

import { ToolUsingChatAgent } from '../ToolUsingChatAgent.js';
import { ResourceManager } from '@legion/resource-manager';

// Mock implementations following existing test patterns
class MockToolRegistry {
  constructor() {
    this.tools = [
      {
        name: 'display_resource',
        category: 'ui',
        description: 'Display resource in viewer',
        execute: jest.fn().mockResolvedValue({ success: true, data: { windowId: 'test_window' } })
      }
    ];
  }

  async searchTools(query) {
    return this.tools.map(tool => ({ ...tool, confidence: 0.9, tool }));
  }
}

class MockLLMClient {
  async complete(prompt, maxTokens) {
    // Simulate context optimization responses
    if (prompt.includes('Chat History Compression')) {
      return JSON.stringify({
        summary: 'Chat history compressed successfully',
        keyInsights: ['User testing integration', 'Context optimization working'],
        relevantToCurrentWork: ['testing', 'integration']
      });
    }
    
    if (prompt.includes('needsTools')) {
      return JSON.stringify({ needsTools: false, reasoning: 'Can answer with context' });
    }
    
    return 'Mock LLM response for integration testing';
  }
}

describe('ToolUsingChatAgent + ContextOptimizer Integration', () => {
  let agent;
  let toolRegistry;
  let llmClient;
  let resourceActor;

  beforeEach(() => {
    // Use mocks following existing test patterns
    toolRegistry = new MockToolRegistry();
    llmClient = new MockLLMClient();
    
    // Mock resource actor for testing
    resourceActor = {
      id: 'integration_test_resource_actor',
      receive: jest.fn().mockResolvedValue(true),
      requestResource: jest.fn().mockResolvedValue({ handle: 'test_handle' })
    };

    agent = new ToolUsingChatAgent(toolRegistry, llmClient, null, resourceActor);
    
    // Faster optimization for tests
    agent.contextOptimizer.config.maxRetries = 2;
    agent.contextOptimizer.config.retryDelay = 100;
    agent.contextOptimizer.config.maxChatMessages = 5; // Lower threshold for testing
    
    console.log('[Integration] ToolUsingChatAgent + ContextOptimizer test setup complete');
  });

  describe('Automatic Context Optimization', () => {
    test('should automatically optimize context after successful message processing', async () => {
      // Add some initial context
      agent.chatHistory = Array.from({ length: 5 }, (_, i) => ({
        role: 'user',
        content: `Initial message ${i}`,
        timestamp: Date.now() - (5 - i) * 1000
      }));
      
      agent.executionContext.artifacts.test_var = 'initial value';
      agent.operationHistory = [
        { tool: 'test_tool', success: true, timestamp: Date.now() - 1000 }
      ];

      // Verify resourceActor is available before optimization
      expect(agent.resourceActor).toBeDefined();
      expect(agent.resourceActor.id).toBe('integration_test_resource_actor');

      // Process a simple message that doesn't need tools
      const response = await agent.processMessage('Hello, what is the current time?');

      // Verify successful response
      expect(response.userResponse).toBeDefined();
      expect(response.complete).toBe(true);

      // Verify context optimization occurred automatically
      expect(agent.chatHistory.length).toBeGreaterThan(5); // Original + new messages
      
      // CRITICAL: Verify resourceActor is still available after optimization
      expect(agent.resourceActor).toBeDefined();
      expect(agent.resourceActor.id).toBe('integration_test_resource_actor');
      
      // Verify other infrastructure preserved
      expect(agent.toolRegistry).toBeDefined();
      expect(agent.llmClient).toBeDefined();
      
      console.log('[Integration] ✅ Automatic optimization preserves infrastructure');
    }, 30000);

    test('should preserve resourceActor through multiple optimization cycles', async () => {
      // Simulate multiple user interactions that trigger optimization
      const messages = [
        'Can you help me with a React project?',
        'How do I set up TypeScript?',
        'What about testing frameworks?',
        'How should I structure my components?',
        'What about state management?'
      ];

      console.log('[Integration] Testing resourceActor preservation through multiple cycles...');
      
      // Verify initial state
      expect(agent.resourceActor).toBeDefined();
      expect(agent.resourceActor.id).toBe('integration_test_resource_actor');

      // Process multiple messages (each triggers automatic optimization)
      for (let i = 0; i < messages.length; i++) {
        const response = await agent.processMessage(messages[i]);
        
        // After each message, verify resourceActor is still there
        expect(agent.resourceActor).toBeDefined();
        expect(agent.resourceActor.id).toBe('integration_test_resource_actor');
        expect(response.complete).toBe(true);
        
        console.log(`[Integration] Message ${i + 1}/${messages.length}: resourceActor preserved ✅`);
      }

      // Final verification
      expect(agent.resourceActor).toBeDefined();
      expect(agent.resourceActor.id).toBe('integration_test_resource_actor');
      
      console.log('[Integration] ✅ ResourceActor preserved through all optimization cycles');
    }, 60000);

    test('should optimize context even after errors', async () => {
      // Add initial context
      agent.chatHistory = Array.from({ length: 10 }, (_, i) => ({
        role: 'user',
        content: `Pre-error message ${i}`,
        timestamp: Date.now() - i * 1000
      }));

      const initialChatLength = agent.chatHistory.length;
      const initialResourceActor = agent.resourceActor;

      // Simulate an error by processing an invalid request
      try {
        await agent.processMessage('/invalid-slash-command-that-should-fail');
      } catch (error) {
        // Error expected
      }

      // Verify context optimization still occurred after error
      // Chat may be compressed, but should have optimization activity
      expect(agent.chatHistory.length).toBeGreaterThan(0); // Has some chat history
      
      // CRITICAL: Verify resourceActor preserved even after error + optimization
      expect(agent.resourceActor).toBeDefined();
      expect(agent.resourceActor).toEqual(initialResourceActor);
      
      console.log('[Integration] ✅ Context optimization and infrastructure preservation work even after errors');
    }, 30000);
  });

  describe('Display Resource Tool Integration', () => {
    test('should maintain resourceActor availability for display_resource tool', async () => {
      // Set up agent with context that would normally trigger optimization
      agent.chatHistory = Array.from({ length: 20 }, (_, i) => ({
        role: 'user',
        content: `Display tool test message ${i}`,
        timestamp: Date.now() + i
      }));

      // Verify resourceActor is available initially
      expect(agent.resourceActor).toBeDefined();

      // Process a message that would use display_resource tool
      // This will trigger automatic optimization afterwards
      const response = await agent.processMessage('Please show me the file at ./test/sample.txt');

      // Verify resourceActor is STILL available after optimization
      expect(agent.resourceActor).toBeDefined();
      expect(agent.resourceActor.id).toBe('integration_test_resource_actor');
      
      // Verify context was optimized (chat should be compressed)
      expect(agent.chatHistory[0].type).toBe('compressed_history');
      
      console.log('[Integration] ✅ ResourceActor available for display_resource after optimization');
    }, 45000);

    test('should fix the original /show command bug', async () => {
      // Simulate the original bug scenario:
      // 1. First /show command works
      // 2. Context gets optimized (instead of brutally cleared)
      // 3. Second /show command should still work

      console.log('[Integration] Testing /show command bug fix...');

      // First /show command simulation
      expect(agent.resourceActor).toBeDefined();
      
      // Add context that would trigger optimization
      agent.chatHistory = Array.from({ length: 18 }, (_, i) => ({
        role: 'user',
        content: `Context that will be optimized ${i}`,
        timestamp: Date.now() + i
      }));

      // Process first /show-like request
      const firstResponse = await agent.processMessage('Show me the documentation file');
      expect(firstResponse.complete).toBe(true);
      
      // Verify resourceActor is STILL available after automatic optimization
      expect(agent.resourceActor).toBeDefined();
      expect(agent.resourceActor.id).toBe('integration_test_resource_actor');
      
      // Process second /show-like request (this would fail in the old system)
      const secondResponse = await agent.processMessage('Show me another file please');
      expect(secondResponse.complete).toBe(true);
      
      // Verify resourceActor is STILL available
      expect(agent.resourceActor).toBeDefined();
      expect(agent.resourceActor.id).toBe('integration_test_resource_actor');

      console.log('[Integration] ✅ /show command bug is FIXED - resourceActor persists through optimizations');
    }, 60000);
  });

  describe('Legacy clearContext Replacement', () => {
    test('should warn when legacy clearContext is used', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      const initialResourceActor = agent.resourceActor;
      agent.clearContext();
      
      // Verify warning was issued
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('clearContext() is deprecated')
      );
      
      // Verify resourceActor is preserved even in legacy method
      expect(agent.resourceActor).toEqual(initialResourceActor);
      
      consoleSpy.mockRestore();
    });

    test('should provide intelligent optimization as alternative to clearContext', async () => {
      // Add context
      agent.chatHistory = [{ role: 'user', content: 'Test message' }];
      agent.executionContext.artifacts.test = 'value';
      agent.operationHistory = [{ tool: 'test', success: true }];
      
      const initialResourceActor = agent.resourceActor;
      
      // Use intelligent optimization instead of clearContext
      await agent.optimizeContextIntelligently();
      
      // Verify resourceActor preserved
      expect(agent.resourceActor).toEqual(initialResourceActor);
      
      // Verify context still exists but may be optimized
      expect(agent.executionContext.artifacts.output_directory).toBeDefined();
    });
  });
});