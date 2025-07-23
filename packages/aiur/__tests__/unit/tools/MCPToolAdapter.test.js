/**
 * Tests for MCPToolAdapter class
 * 
 * Tests Legion tool wrapping for MCP compatibility
 */

import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { MCPToolAdapter } from '../../../src/tools/MCPToolAdapter.js';
import { HandleRegistry } from '../../../src/handles/HandleRegistry.js';
import { HandleResolver } from '../../../src/handles/HandleResolver.js';

describe('MCPToolAdapter', () => {
  let handleRegistry;
  let handleResolver;
  let adapter;

  beforeEach(() => {
    handleRegistry = new HandleRegistry();
    handleResolver = new HandleResolver(handleRegistry);
    adapter = new MCPToolAdapter(handleRegistry, handleResolver);
  });

  describe('Tool Wrapping', () => {
    test('should wrap Legion tool for MCP', () => {
      const legionTool = {
        name: 'test-tool',
        description: 'A test tool',
        inputSchema: {
          type: 'object',
          properties: {
            value: { type: 'string' }
          },
          required: ['value']
        },
        execute: async (params) => {
          return { result: params.value.toUpperCase() };
        }
      };

      const mcpTool = adapter.wrapTool(legionTool);

      expect(mcpTool.name).toBe('test-tool');
      expect(mcpTool.description).toBe('A test tool');
      expect(mcpTool.inputSchema).toEqual(legionTool.inputSchema);
      expect(typeof mcpTool.execute).toBe('function');
    });

    test('should preserve tool metadata', () => {
      const legionTool = {
        name: 'metadata-tool',
        description: 'Tool with metadata',
        inputSchema: { type: 'object' },
        metadata: {
          category: 'test',
          tags: ['utility', 'helper'],
          author: 'Legion'
        },
        execute: async () => ({ success: true })
      };

      const mcpTool = adapter.wrapTool(legionTool);

      expect(mcpTool.metadata).toEqual(legionTool.metadata);
      expect(mcpTool.metadata.category).toBe('test');
      expect(mcpTool.metadata.tags).toContain('utility');
    });

    test('should handle tools without optional properties', () => {
      const minimalTool = {
        name: 'minimal-tool',
        execute: async () => ({ message: 'hello' })
      };

      const mcpTool = adapter.wrapTool(minimalTool);

      expect(mcpTool.name).toBe('minimal-tool');
      expect(mcpTool.description).toBe('');
      expect(mcpTool.inputSchema).toEqual({ type: 'object' });
      expect(typeof mcpTool.execute).toBe('function');
    });
  });

  describe('Parameter Resolution', () => {
    beforeEach(() => {
      // Create test handles
      handleRegistry.create('user', { id: 123, name: 'John Doe' });
      handleRegistry.create('config', { apiUrl: 'https://api.test.com', timeout: 5000 });
    });

    test('should resolve handle references in parameters', async () => {
      let receivedParams;
      const legionTool = {
        name: 'param-tool',
        execute: async (params) => {
          receivedParams = params;
          return { success: true };
        }
      };

      const mcpTool = adapter.wrapTool(legionTool);

      await mcpTool.execute({
        userId: '@user',
        settings: '@config',
        static: 'value'
      });

      expect(receivedParams.userId).toEqual({ id: 123, name: 'John Doe' });
      expect(receivedParams.settings).toEqual({ apiUrl: 'https://api.test.com', timeout: 5000 });
      expect(receivedParams.static).toBe('value');
    });

    test('should resolve nested handle references', async () => {
      let receivedParams;
      const legionTool = {
        name: 'nested-tool',
        execute: async (params) => {
          receivedParams = params;
          return { success: true };
        }
      };

      const mcpTool = adapter.wrapTool(legionTool);

      await mcpTool.execute({
        request: {
          user: '@user',
          config: '@config'
        },
        metadata: {
          source: 'mcp',
          userRef: '@user'
        }
      });

      expect(receivedParams.request.user).toEqual({ id: 123, name: 'John Doe' });
      expect(receivedParams.request.config).toEqual({ apiUrl: 'https://api.test.com', timeout: 5000 });
      expect(receivedParams.metadata.source).toBe('mcp');
      expect(receivedParams.metadata.userRef).toEqual({ id: 123, name: 'John Doe' });
    });

    test('should handle missing handle references gracefully', async () => {
      const legionTool = {
        name: 'error-tool',
        execute: async (params) => ({ params })
      };

      const mcpTool = adapter.wrapTool(legionTool);

      const result = await mcpTool.execute({
        existing: '@user',
        missing: '@nonExistent'
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Handle not found: nonExistent');
    });

    test('should allow disabling parameter resolution', async () => {
      const noResolveAdapter = new MCPToolAdapter(handleRegistry, handleResolver, {
        enableParameterResolution: false
      });

      let receivedParams;
      const legionTool = {
        name: 'no-resolve-tool',
        execute: async (params) => {
          receivedParams = params;
          return { success: true };
        }
      };

      const mcpTool = noResolveAdapter.wrapTool(legionTool);

      await mcpTool.execute({
        userRef: '@user'
      });

      expect(receivedParams.userRef).toBe('@user'); // Should not be resolved
    });
  });

  describe('Response Handling', () => {
    test('should format successful responses correctly', async () => {
      const legionTool = {
        name: 'success-tool',
        execute: async (params) => ({
          data: { processed: params.input },
          metadata: { timestamp: Date.now() }
        })
      };

      const mcpTool = adapter.wrapTool(legionTool);

      const result = await mcpTool.execute({ input: 'test' });

      expect(result.success).toBe(true);
      expect(result.data).toEqual({ processed: 'test' });
      expect(result.metadata).toBeDefined();
    });

    test('should handle Legion tool errors', async () => {
      const legionTool = {
        name: 'error-tool',
        execute: async () => {
          throw new Error('Legion tool error');
        }
      };

      const mcpTool = adapter.wrapTool(legionTool);

      const result = await mcpTool.execute({});

      expect(result.success).toBe(false);
      expect(result.error).toContain('Legion tool error');
    });

    test('should preserve saveAs from Legion tool response', async () => {
      const legionTool = {
        name: 'save-tool',
        execute: async (params) => ({
          data: { result: params.input },
          saveAs: 'toolOutput'
        })
      };

      const mcpTool = adapter.wrapTool(legionTool);

      const result = await mcpTool.execute({ input: 'save me' });

      expect(result.success).toBe(true);
      expect(result.data).toEqual({ result: 'save me' });
      expect(result.saveAs).toBe('toolOutput');
    });

    test('should handle complex saveAs configurations', async () => {
      const legionTool = {
        name: 'complex-save-tool',
        execute: async (params) => ({
          data: { value: params.value },
          saveAs: {
            name: 'complexOutput',
            options: { ttl: 60000 }
          }
        })
      };

      const mcpTool = adapter.wrapTool(legionTool);

      const result = await mcpTool.execute({ value: 42 });

      expect(result.success).toBe(true);
      expect(result.saveAs).toEqual({
        name: 'complexOutput',
        options: { ttl: 60000 }
      });
    });
  });

  describe('Error Propagation', () => {
    test('should propagate validation errors', async () => {
      const legionTool = {
        name: 'validation-tool',
        inputSchema: {
          type: 'object',
          properties: {
            required: { type: 'string' }
          },
          required: ['required']
        },
        execute: async (params) => ({ params })
      };

      const mcpTool = adapter.wrapTool(legionTool, { validateInput: true });

      const result = await mcpTool.execute({});

      expect(result.success).toBe(false);
      expect(result.error).toContain('required');
    });

    test('should handle circular references in parameters', async () => {
      // Create circular reference in handle data
      const circular = { name: 'circular' };
      circular.self = circular;
      handleRegistry.create('circular', circular);

      const legionTool = {
        name: 'circular-tool',
        execute: async (params) => ({ result: params.data })
      };

      const mcpTool = adapter.wrapTool(legionTool);

      const result = await mcpTool.execute({
        data: '@circular'
      });

      // Should succeed because circular reference is in the resolved data,
      // not in the resolution process itself
      expect(result.success).toBe(true);
      expect(result.result.name).toBe('circular');
    });

    test('should handle timeout errors gracefully', async () => {
      const legionTool = {
        name: 'timeout-tool',
        execute: async () => {
          // Simulate a long-running operation
          await new Promise(resolve => setTimeout(resolve, 100));
          return { success: true };
        }
      };

      const timeoutAdapter = new MCPToolAdapter(handleRegistry, handleResolver, {
        timeout: 50 // 50ms timeout
      });

      const mcpTool = timeoutAdapter.wrapTool(legionTool);

      const result = await mcpTool.execute({});

      expect(result.success).toBe(false);
      expect(result.error).toContain('timeout');
    });
  });

  describe('Tool Validation', () => {
    test('should validate tool structure', () => {
      const invalidTool = {
        description: 'Missing name and execute'
      };

      expect(() => adapter.wrapTool(invalidTool)).toThrow('Tool must have name and execute function');
    });

    test('should validate execute function', () => {
      const invalidTool = {
        name: 'invalid-tool',
        execute: 'not a function'
      };

      expect(() => adapter.wrapTool(invalidTool)).toThrow('Tool must have name and execute function');
    });

    test('should accept valid tool', () => {
      const validTool = {
        name: 'valid-tool',
        execute: async () => ({ success: true })
      };

      expect(() => adapter.wrapTool(validTool)).not.toThrow();
    });
  });

  describe('Performance and Memory', () => {
    test('should handle large parameter objects efficiently', async () => {
      // Create large test data
      const largeData = { items: new Array(1000).fill(0).map((_, i) => ({ id: i, value: `item${i}` })) };
      handleRegistry.create('largeData', largeData);

      let receivedParams;
      const legionTool = {
        name: 'large-data-tool',
        execute: async (params) => {
          receivedParams = params;
          return { success: true, count: params.data.items.length };
        }
      };

      const mcpTool = adapter.wrapTool(legionTool);

      const start = Date.now();
      const result = await mcpTool.execute({ data: '@largeData' });
      const duration = Date.now() - start;

      expect(result.success).toBe(true);
      expect(result.count).toBe(1000);
      expect(duration).toBeLessThan(100); // Should complete within 100ms
      expect(receivedParams.data.items).toHaveLength(1000);
    });

    test('should not leak memory with repeated calls', async () => {
      const legionTool = {
        name: 'memory-tool',
        execute: async (params) => ({
          echo: params.input,
          timestamp: Date.now()
        })
      };

      const mcpTool = adapter.wrapTool(legionTool);

      // Make multiple calls to check for memory leaks
      const promises = [];
      for (let i = 0; i < 100; i++) {
        promises.push(mcpTool.execute({ input: `test-${i}` }));
      }

      const results = await Promise.all(promises);

      expect(results).toHaveLength(100);
      results.forEach((result, i) => {
        expect(result.success).toBe(true);
        expect(result.echo).toBe(`test-${i}`);
      });
    });
  });

  describe('Configuration Options', () => {
    test('should respect custom timeout', async () => {
      const customAdapter = new MCPToolAdapter(handleRegistry, handleResolver, {
        timeout: 10 // Very short timeout
      });

      const slowTool = {
        name: 'slow-tool',
        execute: async () => {
          await new Promise(resolve => setTimeout(resolve, 50));
          return { success: true };
        }
      };

      const mcpTool = customAdapter.wrapTool(slowTool);
      const result = await mcpTool.execute({});

      expect(result.success).toBe(false);
      expect(result.error).toContain('timeout');
    });

    test('should handle custom error formatter', async () => {
      const customAdapter = new MCPToolAdapter(handleRegistry, handleResolver, {
        errorFormatter: (error) => `CUSTOM: ${error.message}`
      });

      const errorTool = {
        name: 'error-tool',
        execute: async () => {
          throw new Error('Original error');
        }
      };

      const mcpTool = customAdapter.wrapTool(errorTool);
      const result = await mcpTool.execute({});

      expect(result.success).toBe(false);
      expect(result.error).toBe('CUSTOM: Original error');
    });

    test('should support custom response processor', async () => {
      const customAdapter = new MCPToolAdapter(handleRegistry, handleResolver, {
        responseProcessor: (response) => ({
          ...response,
          processed: true,
          timestamp: Date.now()
        })
      });

      const legionTool = {
        name: 'process-tool',
        execute: async (params) => ({ value: params.input })
      };

      const mcpTool = customAdapter.wrapTool(legionTool);
      const result = await mcpTool.execute({ input: 'test' });

      expect(result.success).toBe(true);
      expect(result.processed).toBe(true);
      expect(result.timestamp).toBeDefined();
      expect(result.value).toBe('test');
    });
  });

  describe('Legion Tool Format Support', () => {
    test('should handle Legion tools with getToolDescription method', () => {
      const legionTool = {
        name: 'legion-tool',
        description: 'Tool using Legion format',
        getToolDescription: () => ({
          type: 'function',
          function: {
            name: 'legion_function',
            description: 'A Legion function',
            parameters: {
              type: 'object',
              properties: {
                message: { type: 'string' }
              },
              required: ['message']
            }
          }
        }),
        execute: async (params) => ({ echo: params.message })
      };

      // The adapter should detect this is a Legion tool format
      const mcpTool = adapter.wrapTool(legionTool);
      
      // Should use the tool's name property, not the function name
      expect(mcpTool.name).toBe('legion-tool');
      expect(mcpTool.description).toBe('Tool using Legion format');
    });

    test('should detect multi-function Legion tools with getAllToolDescriptions', () => {
      const multiTool = {
        name: 'multi_operations',
        description: 'Multi-function tool',
        getAllToolDescriptions: () => [
          {
            type: 'function',
            function: {
              name: 'operation_one',
              description: 'First operation',
              parameters: { type: 'object' }
            }
          },
          {
            type: 'function', 
            function: {
              name: 'operation_two',
              description: 'Second operation',
              parameters: { type: 'object' }
            }
          }
        ],
        execute: async (params) => ({ result: 'executed' })
      };

      const mcpTool = adapter.wrapTool(multiTool);
      
      // Multi-function tools need special handling
      expect(mcpTool.name).toBe('multi_operations');
      expect(typeof mcpTool.execute).toBe('function');
    });

    test('should validate tool has required structure', () => {
      // Tool without name
      expect(() => adapter.wrapTool({ execute: async () => {} }))
        .toThrow('Tool must have name and execute function');
      
      // Tool without execute
      expect(() => adapter.wrapTool({ name: 'test' }))
        .toThrow('Tool must have name and execute function');
    });

    test('should handle OpenAI function calling format in Legion tools', async () => {
      const openAITool = {
        name: 'openai_tool',
        description: 'OpenAI format tool',
        // This mimics Legion Tool base class behavior
        invoke: async function(toolCall) {
          const args = JSON.parse(toolCall.function.arguments);
          return { success: true, data: { received: args } };
        },
        safeInvoke: async function(toolCall) {
          try {
            return await this.invoke(toolCall);
          } catch (error) {
            return { success: false, error: error.message };
          }
        },
        execute: async function(params) {
          // Adapter for simple params to toolCall format
          const toolCall = {
            id: `test-${Date.now()}`,
            type: 'function',
            function: {
              name: this.name,
              arguments: JSON.stringify(params)
            }
          };
          const result = await this.safeInvoke(toolCall);
          if (!result.success) throw new Error(result.error);
          return result.data;
        }
      };

      const mcpTool = adapter.wrapTool(openAITool);
      const result = await mcpTool.execute({ test: 'value' });

      expect(result.success).toBe(true);
      expect(result.received).toEqual({ test: 'value' });
    });

    test('should handle ToolResult format from Legion tools', async () => {
      const toolResultTool = {
        name: 'tool_result_tool',
        execute: async (params) => {
          // Simulating ToolResult.success() format
          return {
            success: true,
            data: {
              processed: params.input,
              timestamp: new Date().toISOString()
            }
          };
        }
      };

      const mcpTool = adapter.wrapTool(toolResultTool);
      const result = await mcpTool.execute({ input: 'test data' });

      expect(result.success).toBe(true);
      expect(result.data.processed).toBe('test data');
      expect(result.data.timestamp).toBeDefined();
    });

    test('should handle Legion tool with both getToolDescription and execute', async () => {
      const hybridTool = {
        name: 'hybrid_tool',
        getToolDescription: () => ({
          type: 'function',
          function: {
            name: 'hybrid_function',
            description: 'Hybrid Legion tool',
            parameters: {
              type: 'object',
              properties: {
                value: { type: 'number' }
              }
            }
          }
        }),
        execute: async (params) => ({
          doubled: params.value * 2
        })
      };

      const mcpTool = adapter.wrapTool(hybridTool);
      const result = await mcpTool.execute({ value: 5 });

      expect(result.success).toBe(true);
      expect(result.doubled).toBe(10);
    });
  });
});