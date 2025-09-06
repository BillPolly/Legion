/**
 * ContextOptimizer Integrated Tests with PromptBuilder
 * 
 * Tests the complete integrated system:
 * - ContextOptimizer with PromptBuilder integration
 * - Live LLM integration for prompt validation
 * - End-to-end context optimization workflow
 * - JSON response validation and parsing
 */

import { ContextOptimizer } from '../ContextOptimizer.js';
import { PromptBuilder } from '../PromptBuilder.js';
import { ResourceManager } from '@legion/resource-manager';

describe('ContextOptimizer + PromptBuilder Integration', () => {
  let optimizer;
  let promptBuilder;
  let llmClient;

  beforeAll(async () => {
    // Get real LLM client from ResourceManager
    const resourceManager = await ResourceManager.getInstance();
    llmClient = await resourceManager.get('llmClient');
    
    if (!llmClient) {
      throw new Error('LLM client not available from ResourceManager - cannot run integration tests');
    }

    optimizer = new ContextOptimizer(llmClient);
    promptBuilder = new PromptBuilder();
    
    // Use faster config for tests
    optimizer.config.maxRetries = 2;
    optimizer.config.retryDelay = 500;
    
    console.log('[Integration] ContextOptimizer + PromptBuilder initialized with real LLM client');
  });

  describe('PromptBuilder Integration', () => {
    test('should use PromptBuilder for chat compression prompts', () => {
      const messages = [
        { role: 'user', content: 'Test message 1', timestamp: 1000 },
        { role: 'assistant', content: 'Test response 1', timestamp: 2000 }
      ];
      const artifacts = { test_var: 'test_value' };
      
      // Verify PromptBuilder is accessible
      expect(optimizer.promptBuilder).toBeInstanceOf(PromptBuilder);
      
      // Test that PromptBuilder generates valid prompts
      const prompt = optimizer.promptBuilder.buildChatCompressionPrompt(messages, artifacts);
      expect(prompt).toContain('## Task: Chat History Compression');
      expect(prompt).toContain('Return JSON with this exact structure');
      expect(prompt).toContain('Test message 1');
      expect(prompt).toContain('test_var');
      expect(optimizer.promptBuilder.validateJsonPrompt(prompt)).toBe(true);
    });

    test('should use PromptBuilder for artifact analysis prompts', () => {
      const artifacts = {
        user_data: { name: 'test' },
        old_temp: 'temporary value'
      };
      const operations = [
        { tool: 'processor', success: true, timestamp: 1000 }
      ];
      
      const prompt = optimizer.promptBuilder.buildArtifactAnalysisPrompt(artifacts, operations);
      expect(prompt).toContain('## Task: Artifact Relevance Analysis');
      expect(prompt).toContain('KEEP');
      expect(prompt).toContain('ARCHIVE');
      expect(prompt).toContain('DISCARD');
      expect(prompt).toContain('user_data');
      expect(prompt).toContain('processor');
      expect(optimizer.promptBuilder.validateJsonPrompt(prompt)).toBe(true);
    });

    test('should use PromptBuilder for operation optimization prompts', () => {
      const operations = [
        { tool: 'data_tool', success: true, outputs: { result: 'data' } },
        { tool: 'failed_tool', success: false, error: 'Test error' }
      ];
      const artifacts = { result: 'processed data' };
      
      const prompt = optimizer.promptBuilder.buildOperationOptimizationPrompt(operations, artifacts);
      expect(prompt).toContain('## Task: Operation History Optimization');
      expect(prompt).toContain('successPatterns');
      expect(prompt).toContain('failureInsights');
      expect(prompt).toContain('data_tool');
      expect(prompt).toContain('failed_tool');
      expect(optimizer.promptBuilder.validateJsonPrompt(prompt)).toBe(true);
    });
  });

  describe('Live LLM Integration with PromptBuilder', () => {
    test('should compress chat history using PromptBuilder prompts with real LLM', async () => {
      const messages = [
        { role: 'user', content: 'I need to create a React component for user authentication', timestamp: Date.now() - 5000 },
        { role: 'assistant', content: 'I can help you create an authentication component. First, let me understand your requirements.', timestamp: Date.now() - 4000 },
        { role: 'user', content: 'I need login, logout, and registration functionality', timestamp: Date.now() - 3000 },
        { role: 'assistant', content: 'Perfect! I\'ll create a component with those features using React hooks for state management.', timestamp: Date.now() - 2000 },
        { role: 'user', content: 'Also add form validation please', timestamp: Date.now() - 1000 },
        { role: 'assistant', content: 'I\'ll include comprehensive form validation with error handling.', timestamp: Date.now() },
        // Additional messages to trigger compression (over 15)
        { role: 'user', content: 'What about styling?', timestamp: Date.now() + 1000 },
        { role: 'assistant', content: 'I recommend using CSS modules or styled-components for component-scoped styling.', timestamp: Date.now() + 2000 },
        { role: 'user', content: 'Let\'s use styled-components', timestamp: Date.now() + 3000 },
        { role: 'assistant', content: 'Great choice! Styled-components provide excellent theming capabilities.', timestamp: Date.now() + 4000 },
        { role: 'user', content: 'How about testing?', timestamp: Date.now() + 5000 },
        { role: 'assistant', content: 'I\'ll include React Testing Library tests for all authentication flows.', timestamp: Date.now() + 6000 },
        { role: 'user', content: 'Perfect, let\'s proceed', timestamp: Date.now() + 7000 },
        { role: 'assistant', content: 'I\'ll start by creating the authentication component structure.', timestamp: Date.now() + 8000 },
        { role: 'user', content: 'Should we add TypeScript?', timestamp: Date.now() + 9000 },
        { role: 'assistant', content: 'TypeScript would provide excellent type safety for the authentication logic.', timestamp: Date.now() + 10000 },
        { role: 'user', content: 'Yes, please use TypeScript', timestamp: Date.now() + 11000 },
        { role: 'assistant', content: 'I\'ll create a TypeScript React authentication component with all requested features.', timestamp: Date.now() + 12000 }
      ];

      const artifacts = {
        auth_component: { type: 'react_component', language: 'typescript' },
        project_config: { framework: 'react', styling: 'styled-components' }
      };

      console.log('[Integration] Testing chat compression with PromptBuilder + real LLM...');
      const result = await optimizer.compressChatHistory(messages, artifacts);

      // Verify compression occurred
      expect(result.optimizedHistory.length).toBeLessThan(messages.length);
      expect(result.optimizedHistory[0].type).toBe('compressed_history');
      expect(result.optimizedHistory[0].content).toContain('CHAT HISTORY SUMMARY');
      
      // Verify PromptBuilder generated valid JSON response
      expect(result.optimizedHistory[0].metadata).toBeDefined();
      expect(result.optimizedHistory[0].metadata.keyInsights).toBeInstanceOf(Array);
      expect(result.optimizedHistory[0].metadata.relevantToCurrentWork).toBeInstanceOf(Array);
      
      console.log('[Integration] ✅ Chat compression successful with PromptBuilder');
      console.log(`[Integration] Compressed ${result.compressionStats.compressed} messages`);
      console.log(`[Integration] Key insights: ${JSON.stringify(result.optimizedHistory[0].metadata.keyInsights)}`);
    }, 30000);

    test('should optimize complete context end-to-end with PromptBuilder', async () => {
      const contextSnapshot = {
        chatHistory: Array.from({ length: 20 }, (_, i) => ({
          role: i % 2 === 0 ? 'user' : 'assistant',
          content: `Integrated test message ${i} about PromptBuilder and context optimization`,
          timestamp: Date.now() - (20 - i) * 1000
        })),
        executionContext: {
          artifacts: {
            output_directory: { value: './tmp', description: 'Output directory' },
            integration_test_result: 'PromptBuilder integration successful',
            auth_component_spec: { 
              features: ['login', 'logout', 'registration'],
              technology: 'React TypeScript',
              styling: 'styled-components'
            },
            validation_rules: {
              email: 'required|email',
              password: 'required|min:8'
            }
          }
        },
        operationHistory: Array.from({ length: 28 }, (_, i) => ({
          tool: `integration_test_tool_${i}`,
          success: i % 8 !== 0, // Some failures for pattern learning
          timestamp: Date.now() - (28 - i) * 2000,
          outputs: i < 4 ? { result: `integration_test_result_${i}` } : {}
        })),
        // Infrastructure that should be preserved
        resourceActor: { id: 'integration_test_resource_actor' },
        toolRegistry: { tools: ['prompt_builder_tool', 'context_optimizer_tool'] }
      };

      console.log('[Integration] Testing complete context optimization with PromptBuilder...');
      const result = await optimizer.optimizeContext(contextSnapshot);

      // Verify optimization metadata
      expect(result._optimizationMetadata).toBeDefined();
      expect(result._optimizationMetadata.timestamp).toBeDefined();
      expect(result._optimizationMetadata.chatCompression).toBeDefined();
      expect(result._optimizationMetadata.operationChanges).toBeDefined();

      // Verify infrastructure preservation
      expect(result.resourceActor).toEqual(contextSnapshot.resourceActor);
      expect(result.toolRegistry).toEqual(contextSnapshot.toolRegistry);

      // Verify optimizations occurred
      expect(result.chatHistory.length).toBeLessThan(contextSnapshot.chatHistory.length);
      expect(result.operationHistory.length).toBeLessThan(contextSnapshot.operationHistory.length);
      
      // Verify PromptBuilder-generated responses are valid
      if (result.chatHistory[0].type === 'compressed_history') {
        expect(result.chatHistory[0].metadata.keyInsights).toBeInstanceOf(Array);
        expect(result.chatHistory[0].metadata.relevantToCurrentWork).toBeInstanceOf(Array);
      }
      
      if (result.operationHistory[0].tool === 'operation_history_summary') {
        expect(result.operationHistory[0].metadata.successPatterns).toBeInstanceOf(Array);
        expect(result.operationHistory[0].metadata.failureInsights).toBeInstanceOf(Array);
      }

      console.log('[Integration] ✅ Complete context optimization successful');
      console.log(`[Integration] Chat: ${contextSnapshot.chatHistory.length} → ${result.chatHistory.length}`);
      console.log(`[Integration] Operations: ${contextSnapshot.operationHistory.length} → ${result.operationHistory.length}`);
      console.log(`[Integration] Artifacts: ${Object.keys(contextSnapshot.executionContext.artifacts).length} → ${Object.keys(result.executionContext.artifacts).length}`);
    }, 60000);
  });

  describe('Error Handling and Retry with PromptBuilder', () => {
    test('should handle LLM errors gracefully with PromptBuilder prompts', async () => {
      // Create a failing LLM client mock for this test
      const failingLlmClient = {
        complete: jest.fn().mockRejectedValue(new Error('Simulated LLM failure'))
      };

      const failingOptimizer = new ContextOptimizer(failingLlmClient);
      failingOptimizer.config.maxRetries = 2;
      failingOptimizer.config.retryDelay = 100;

      // Create enough messages to trigger compression (over 15)
      const messages = Array.from({ length: 20 }, (_, i) => ({
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: `Test message ${i}`,
        timestamp: Date.now() + i
      }));

      // Should fail after retries but return proper error structure
      await expect(failingOptimizer.compressChatHistory(messages, {})).rejects.toThrow(
        'chat history compression failed after 2 attempts'
      );

      // Verify retries were attempted
      expect(failingLlmClient.complete).toHaveBeenCalledTimes(2);
    });

    test('should validate PromptBuilder JSON prompts before sending to LLM', () => {
      const messages = [{ role: 'user', content: 'test' }];
      const artifacts = { test: 'value' };
      
      const prompt = optimizer.promptBuilder.buildChatCompressionPrompt(messages, artifacts);
      
      // Verify the prompt is properly formatted for JSON response
      expect(optimizer.promptBuilder.validateJsonPrompt(prompt)).toBe(true);
      
      // Verify prompt statistics
      const stats = optimizer.promptBuilder.getPromptStats(prompt);
      expect(stats.hasJsonSchema).toBe(true);
      expect(stats.withinLimits).toBe(true);
      expect(stats.length).toBeGreaterThan(100);
    });
  });
});