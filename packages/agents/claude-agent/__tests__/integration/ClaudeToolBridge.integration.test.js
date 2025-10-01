/**
 * Integration Tests for ClaudeToolBridge
 *
 * Tests tool translation with a real-like tool registry
 * NO MOCKS - uses actual tool registry interface
 */

import { describe, test, expect, beforeAll } from '@jest/globals';
import { ClaudeToolBridge } from '../../src/ClaudeToolBridge.js';

describe('ClaudeToolBridge Integration', () => {
  let toolRegistry;
  let bridge;

  beforeAll(() => {
    // Create a real-like tool registry with actual tools
    // This simulates the interface that Legion's ToolRegistry will provide
    const tools = new Map();

    // Add real tools with proper structure
    tools.set('file_read', {
      name: 'file_read',
      description: 'Read contents of a file',
      inputSchema: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'Path to the file'
          }
        },
        required: ['path']
      },
      execute: async (input) => {
        if (!input.path) throw new Error('Path is required');
        return `Contents of ${input.path}`;
      }
    });

    tools.set('web_search', {
      name: 'web_search',
      description: 'Search the web for information',
      inputSchema: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Search query'
          },
          limit: {
            type: 'number',
            description: 'Maximum number of results',
            default: 10
          }
        },
        required: ['query']
      },
      execute: async (input) => {
        if (!input.query) throw new Error('Query is required');
        return {
          query: input.query,
          results: [`Result 1 for ${input.query}`, `Result 2 for ${input.query}`],
          count: input.limit || 10
        };
      }
    });

    tools.set('calculator', {
      name: 'calculator',
      description: 'Perform mathematical calculations',
      inputSchema: {
        type: 'object',
        properties: {
          expression: {
            type: 'string',
            description: 'Mathematical expression to evaluate'
          }
        },
        required: ['expression']
      },
      execute: async (input) => {
        // Simple calculator - just for testing
        if (input.expression === '2 + 2') return 4;
        if (input.expression === 'invalid') throw new Error('Invalid expression');
        return 42;
      }
    });

    // Create tool registry interface
    toolRegistry = {
      getTool: (name) => tools.get(name) || null,
      getAllTools: () => Array.from(tools.values())
    };

    bridge = new ClaudeToolBridge(toolRegistry);
  });

  describe('Convert real tools to Claude format', () => {
    test('should convert all tools correctly', () => {
      const claudeTools = bridge.legionToolsToClaudeTools();

      expect(claudeTools).toHaveLength(3);

      const fileReadTool = claudeTools.find(t => t.name === 'file_read');
      expect(fileReadTool).toBeDefined();
      expect(fileReadTool.description).toBe('Read contents of a file');
      expect(fileReadTool.input_schema.properties.path).toBeDefined();
      expect(fileReadTool.input_schema.required).toContain('path');
    });

    test('should convert specific tools by name', () => {
      const claudeTools = bridge.legionToolsToClaudeTools(['web_search', 'calculator']);

      expect(claudeTools).toHaveLength(2);
      expect(claudeTools[0].name).toBe('web_search');
      expect(claudeTools[1].name).toBe('calculator');
    });
  });

  describe('Execute real tool and verify result structure', () => {
    test('should execute file_read tool successfully', async () => {
      const result = await bridge.executeLegionTool('file_read', {
        path: '/test/path.txt'
      });

      expect(result.success).toBe(true);
      expect(result.toolName).toBe('file_read');
      expect(result.result).toBe('Contents of /test/path.txt');
    });

    test('should execute web_search tool with complex result', async () => {
      const result = await bridge.executeLegionTool('web_search', {
        query: 'Claude AI',
        limit: 5
      });

      expect(result.success).toBe(true);
      expect(result.toolName).toBe('web_search');
      expect(result.result.query).toBe('Claude AI');
      expect(result.result.results).toHaveLength(2);
      expect(result.result.count).toBe(5);
    });

    test('should handle tool execution error gracefully', async () => {
      const result = await bridge.executeLegionTool('calculator', {
        expression: 'invalid'
      });

      expect(result.success).toBe(false);
      expect(result.toolName).toBe('calculator');
      expect(result.error).toBe('Invalid expression');
    });

    test('should handle missing required parameter', async () => {
      const result = await bridge.executeLegionTool('file_read', {});

      expect(result.success).toBe(false);
      expect(result.error).toBe('Path is required');
    });
  });

  describe('Format tool results correctly', () => {
    test('should format string result', () => {
      const formatted = bridge.formatToolResult({
        success: true,
        result: 'File contents here'
      });

      expect(formatted).toBe('File contents here');
    });

    test('should format complex object result', () => {
      const formatted = bridge.formatToolResult({
        success: true,
        result: {
          query: 'test',
          results: ['a', 'b'],
          count: 2
        }
      });

      const parsed = JSON.parse(formatted);
      expect(parsed.query).toBe('test');
      expect(parsed.results).toEqual(['a', 'b']);
    });

    test('should format error result', () => {
      const formatted = bridge.formatToolResult({
        success: false,
        error: 'Tool failed'
      });

      expect(formatted).toBe('Error: Tool failed');
    });
  });

  describe('End-to-end tool execution flow', () => {
    test('should complete full cycle: convert -> execute -> format', async () => {
      // 1. Convert tools to Claude format
      const claudeTools = bridge.legionToolsToClaudeTools(['calculator']);
      expect(claudeTools[0].name).toBe('calculator');

      // 2. Execute the tool (as Claude would)
      const execResult = await bridge.executeLegionTool('calculator', {
        expression: '2 + 2'
      });
      expect(execResult.success).toBe(true);
      expect(execResult.result).toBe(4);

      // 3. Format result for Claude
      const formatted = bridge.formatToolResult(execResult);
      expect(formatted).toBe('4');
    });
  });
});
