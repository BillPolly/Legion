/**
 * ContextOptimizer Unit Tests
 * 
 * Comprehensive tests for the LLM-powered context optimization system.
 * Tests both mocked LLM responses and error handling scenarios.
 */

import { ContextOptimizer } from '../ContextOptimizer.js';

describe('ContextOptimizer', () => {
  let optimizer;
  let mockLlmClient;

  beforeEach(() => {
    // Mock LLM client with controlled responses
    mockLlmClient = {
      complete: jest.fn()
    };
    
    optimizer = new ContextOptimizer(mockLlmClient);
  });

  describe('Constructor and Configuration', () => {
    test('should initialize with correct default configuration', () => {
      expect(optimizer.config.maxChatMessages).toBe(15);
      expect(optimizer.config.maxOperations).toBe(25);
      expect(optimizer.config.maxArtifacts).toBe(50);
      expect(optimizer.config.compressionRatio).toBe(0.3);
    });

    test('should protect infrastructure fields', () => {
      expect(optimizer.protectedFields.has('resourceActor')).toBe(true);
      expect(optimizer.protectedFields.has('toolRegistry')).toBe(true);
      expect(optimizer.protectedFields.has('llmClient')).toBe(true);
    });

    test('should require LLM client', () => {
      expect(() => new ContextOptimizer()).toThrow();
    });
  });

  describe('Chat History Compression', () => {
    test('should not compress when under message limit', async () => {
      const messages = [
        { role: 'user', content: 'Hello', timestamp: 1 },
        { role: 'assistant', content: 'Hi there', timestamp: 2 }
      ];
      
      const result = await optimizer.compressChatHistory(messages, {});
      
      expect(result.optimizedHistory).toEqual(messages);
      expect(result.compressionStats.compressed).toBe(0);
      expect(mockLlmClient.complete).not.toHaveBeenCalled();
    });

    test('should compress old messages when over limit', async () => {
      // Create 20 messages (over the 15 limit)
      const messages = Array.from({ length: 20 }, (_, i) => ({
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: `Message ${i}`,
        timestamp: i
      }));
      
      mockLlmClient.complete.mockResolvedValue({
        content: JSON.stringify({
          summary: 'User asked about testing, agent helped with setup',
          keyInsights: ['Testing is important', 'Setup requires configuration'],
          relevantToCurrentWork: ['test setup', 'configuration files']
        })
      });
      
      const result = await optimizer.compressChatHistory(messages, { test_config: 'value' });
      
      expect(result.optimizedHistory).toHaveLength(16); // 1 summary + 15 recent
      expect(result.optimizedHistory[0].type).toBe('compressed_history');
      expect(result.optimizedHistory[0].content).toContain('CHAT HISTORY SUMMARY');
      expect(result.compressionStats.compressed).toBe(5); // 20 - 15 = 5 compressed
      expect(mockLlmClient.complete).toHaveBeenCalledWith(
        expect.arrayContaining([expect.objectContaining({ role: 'user' })]),
        expect.objectContaining({ temperature: 0.1 })
      );
    });

    test('should handle LLM failure gracefully', async () => {
      const messages = Array.from({ length: 20 }, (_, i) => ({
        role: 'user',
        content: `Message ${i}`,
        timestamp: i
      }));
      
      mockLlmClient.complete.mockRejectedValue(new Error('LLM API error'));
      
      const result = await optimizer.compressChatHistory(messages, {});
      
      expect(result.optimizedHistory).toHaveLength(15); // Just recent messages
      expect(result.compressionStats.compressed).toBe(0);
    });
  });

  describe('Artifact Relevance Analysis', () => {
    test('should not analyze when under artifact limit', async () => {
      const artifacts = {
        small_var: 'value',
        another_var: 42
      };
      
      const result = await optimizer.analyzeArtifactRelevance(artifacts, {});
      
      expect(result.optimizedArtifacts).toEqual(artifacts);
      expect(result.changeStats.kept).toBe(2);
      expect(mockLlmClient.complete).not.toHaveBeenCalled();
    });

    test('should analyze and optimize when over artifact limit', async () => {
      // Create more than 50 artifacts to trigger optimization
      const artifacts = {};
      for (let i = 0; i < 60; i++) {
        artifacts[`var_${i}`] = `value_${i}`;
      }
      
      mockLlmClient.complete.mockResolvedValue({
        content: JSON.stringify({
          analysis: {
            var_0: { decision: 'KEEP', reason: 'Recently used' },
            var_1: { decision: 'ARCHIVE', reason: 'Potentially useful' },
            var_2: { decision: 'DISCARD', reason: 'No longer needed' }
            // LLM would analyze all 60, but we'll simulate partial response
          }
        })
      });
      
      const result = await optimizer.analyzeArtifactRelevance(artifacts, { operationHistory: [] });
      
      expect(mockLlmClient.complete).toHaveBeenCalled();
      expect(result.changeStats.kept).toBeGreaterThan(0);
      expect(result.optimizedArtifacts.var_0).toBe('value_0'); // KEEP
      expect(result.optimizedArtifacts.var_1_archived).toBeDefined(); // ARCHIVE
      expect(result.optimizedArtifacts.var_2).toBeUndefined(); // DISCARD
    });

    test('should handle empty artifacts', async () => {
      const result = await optimizer.analyzeArtifactRelevance({}, {});
      
      expect(result.optimizedArtifacts).toEqual({});
      expect(result.changeStats.kept).toBe(0);
    });

    test('should handle LLM failure gracefully for artifacts', async () => {
      const artifacts = {};
      for (let i = 0; i < 60; i++) {
        artifacts[`var_${i}`] = `value_${i}`;
      }
      
      mockLlmClient.complete.mockRejectedValue(new Error('LLM failure'));
      
      const result = await optimizer.analyzeArtifactRelevance(artifacts, {});
      
      expect(result.optimizedArtifacts).toEqual(artifacts); // Fallback: keep all
      expect(result.changeStats.kept).toBe(60);
    });
  });

  describe('Operation History Optimization', () => {
    test('should not optimize when under operation limit', async () => {
      const operations = [
        { tool: 'test_tool', success: true, timestamp: 1 },
        { tool: 'another_tool', success: false, timestamp: 2 }
      ];
      
      const result = await optimizer.optimizeOperations(operations, {});
      
      expect(result.optimizedOperations).toEqual(operations);
      expect(result.changeStats.kept).toBe(2);
      expect(mockLlmClient.complete).not.toHaveBeenCalled();
    });

    test('should optimize when over operation limit', async () => {
      // Create 30 operations (over the 25 limit)
      const operations = Array.from({ length: 30 }, (_, i) => ({
        tool: `tool_${i}`,
        success: i % 10 !== 0, // Every 10th operation fails
        timestamp: i,
        inputs: { param: `value_${i}` },
        outputs: { result: `result_${i}` }
      }));
      
      mockLlmClient.complete.mockResolvedValue({
        content: JSON.stringify({
          summary: 'Operations showed pattern of tool usage for data processing',
          successPatterns: ['tool_1 → tool_2 sequence works well'],
          failureInsights: ['tool_0 fails with large inputs'],
          toolsUsed: [{ tool: 'tool_1', purpose: 'data processing' }],
          variableCreators: ['tool_5 created important variables']
        })
      });
      
      const result = await optimizer.optimizeOperations(operations, { some_var: 'value' });
      
      expect(result.optimizedOperations).toHaveLength(26); // 1 summary + 25 recent
      expect(result.optimizedOperations[0].tool).toBe('operation_history_summary');
      expect(result.optimizedOperations[0].metadata.type).toBe('compressed_operations');
      expect(result.changeStats.summarized).toBe(5); // 30 - 25 = 5 summarized
      expect(mockLlmClient.complete).toHaveBeenCalled();
    });

    test('should handle LLM failure gracefully for operations', async () => {
      const operations = Array.from({ length: 30 }, (_, i) => ({
        tool: `tool_${i}`,
        success: true,
        timestamp: i
      }));
      
      mockLlmClient.complete.mockRejectedValue(new Error('LLM failure'));
      
      const result = await optimizer.optimizeOperations(operations, {});
      
      expect(result.optimizedOperations).toHaveLength(25); // Just recent operations
      expect(result.changeStats.kept).toBe(25);
    });
  });

  describe('Complete Context Optimization', () => {
    test('should optimize complete context snapshot', async () => {
      const contextSnapshot = {
        chatHistory: Array.from({ length: 20 }, (_, i) => ({
          role: i % 2 === 0 ? 'user' : 'assistant',
          content: `Message ${i}`,
          timestamp: i
        })),
        executionContext: {
          artifacts: {
            output_directory: { value: './tmp' },
            user_var: 'keep this',
            old_var: 'might discard'
          }
        },
        operationHistory: Array.from({ length: 30 }, (_, i) => ({
          tool: `tool_${i}`,
          success: true,
          timestamp: i
        })),
        resourceActor: { id: 'resource_actor' }, // Infrastructure
        toolRegistry: { id: 'tool_registry' } // Infrastructure
      };
      
      // Mock all LLM calls to return valid responses
      mockLlmClient.complete
        .mockResolvedValueOnce({
          content: JSON.stringify({
            summary: 'Chat summary',
            keyInsights: ['insight1'],
            relevantToCurrentWork: ['work1']
          })
        })
        .mockResolvedValueOnce({
          content: JSON.stringify({
            analysis: {
              output_directory: { decision: 'KEEP', reason: 'Infrastructure' },
              user_var: { decision: 'KEEP', reason: 'Recently used' },
              old_var: { decision: 'DISCARD', reason: 'Not used anymore' }
            }
          })
        })
        .mockResolvedValueOnce({
          content: JSON.stringify({
            summary: 'Operations summary',
            successPatterns: ['pattern1'],
            failureInsights: [],
            toolsUsed: [],
            variableCreators: []
          })
        });
      
      const result = await optimizer.optimizeContext(contextSnapshot);
      
      // Should have optimization metadata
      expect(result._optimizationMetadata).toBeDefined();
      expect(result._optimizationMetadata.timestamp).toBeDefined();
      
      // Infrastructure should be preserved
      expect(result.resourceActor).toEqual(contextSnapshot.resourceActor);
      expect(result.toolRegistry).toEqual(contextSnapshot.toolRegistry);
      
      // Content should be optimized
      expect(result.chatHistory.length).toBeLessThan(contextSnapshot.chatHistory.length);
      expect(result.operationHistory.length).toBeLessThan(contextSnapshot.operationHistory.length);
      
      // Only 2 LLM calls because artifacts are under threshold
      expect(mockLlmClient.complete).toHaveBeenCalledTimes(2);
    });

    test('should handle optimization failure gracefully', async () => {
      const contextSnapshot = {
        chatHistory: Array.from({ length: 20 }, (_, i) => ({ content: `msg ${i}` })), // Force chat optimization
        executionContext: { artifacts: {} },
        operationHistory: []
      };
      
      mockLlmClient.complete.mockRejectedValue(new Error('Complete failure'));
      
      const result = await optimizer.optimizeContext(contextSnapshot);
      
      // Should return original context with error metadata on failure
      expect(result.chatHistory).toEqual(contextSnapshot.chatHistory);
      expect(result.executionContext).toEqual(contextSnapshot.executionContext);
      expect(result.operationHistory).toEqual(contextSnapshot.operationHistory);
      expect(result._optimizationMetadata).toBeDefined();
      expect(result._optimizationMetadata.error).toContain('chat history compression failed after 3 attempts. Last error: Complete failure');
    });

    test('should preserve infrastructure during optimization', async () => {
      const contextSnapshot = {
        resourceActor: { important: 'data' },
        toolRegistry: { tools: [] },
        llmClient: { client: 'instance' },
        chatHistory: [],
        executionContext: { artifacts: {} },
        operationHistory: []
      };
      
      const result = await optimizer.optimizeContext(contextSnapshot);
      
      // All infrastructure should be preserved exactly
      expect(result.resourceActor).toEqual(contextSnapshot.resourceActor);
      expect(result.toolRegistry).toEqual(contextSnapshot.toolRegistry);
      expect(result.llmClient).toEqual(contextSnapshot.llmClient);
    });
  });

  describe('Utility Methods', () => {
    test('should summarize values correctly', () => {
      expect(optimizer.summarizeValue('short')).toBe('String: "short"');
      expect(optimizer.summarizeValue('a'.repeat(150))).toContain('String(150 chars)');
      expect(optimizer.summarizeValue(42)).toBe('number: 42');
      expect(optimizer.summarizeValue(true)).toBe('boolean: true');
      expect(optimizer.summarizeValue([1, 2, 3])).toBe('Array(3 items)');
      expect(optimizer.summarizeValue({ a: 1, b: 2 })).toBe('Object(2 keys): [a, b]');
      expect(optimizer.summarizeValue(null)).toBe('null');
    });

    test('should extract JSON from LLM responses', () => {
      expect(optimizer.extractJSON('{"test": "value"}')).toEqual({ test: 'value' });
      expect(optimizer.extractJSON('Some text {"test": "value"} more text')).toEqual({ test: 'value' });
      expect(optimizer.extractJSON('invalid json')).toEqual({});
    });
  });
});