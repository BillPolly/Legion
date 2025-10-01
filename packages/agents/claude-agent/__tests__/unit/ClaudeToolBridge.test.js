/**
 * Unit Tests for ClaudeToolBridge
 *
 * Tests the tool translation layer between Legion and Claude SDK
 */

import { describe, test, expect, beforeEach } from '@jest/globals';
import { ClaudeToolBridge } from '../../src/ClaudeToolBridge.js';

describe('ClaudeToolBridge', () => {
  describe('constructor', () => {
    test('should require toolRegistry', () => {
      expect(() => new ClaudeToolBridge()).toThrow('ClaudeToolBridge requires a toolRegistry');
    });

    test('should store toolRegistry', () => {
      const mockRegistry = { getTool: () => {} };
      const bridge = new ClaudeToolBridge(mockRegistry);
      expect(bridge.toolRegistry).toBe(mockRegistry);
    });
  });

  describe('legionToClaudeTool()', () => {
    let bridge;
    let mockRegistry;

    beforeEach(() => {
      mockRegistry = {
        getTool: () => null,
        getAllTools: () => []
      };
      bridge = new ClaudeToolBridge(mockRegistry);
    });

    test('should convert Legion tool with name, description, schema to Claude format', () => {
      const legionTool = {
        name: 'test_tool',
        description: 'A test tool for unit testing',
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'The search query'
            }
          },
          required: ['query']
        }
      };

      const claudeTool = bridge.legionToClaudeTool(legionTool);

      expect(claudeTool).toEqual({
        name: 'test_tool',
        description: 'A test tool for unit testing',
        input_schema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'The search query'
            }
          },
          required: ['query']
        }
      });
    });

    test('should use default description when missing', () => {
      const legionTool = {
        name: 'test_tool',
        inputSchema: {
          type: 'object',
          properties: {},
          required: []
        }
      };

      const claudeTool = bridge.legionToClaudeTool(legionTool);

      expect(claudeTool.description).toBe('Execute test_tool tool');
    });

    test('should throw error for invalid tool (no name)', () => {
      const legionTool = {
        description: 'No name here',
        inputSchema: {}
      };

      expect(() => bridge.legionToClaudeTool(legionTool)).toThrow('Invalid Legion tool: missing name');
    });

    test('should throw error for null tool', () => {
      expect(() => bridge.legionToClaudeTool(null)).toThrow('Invalid Legion tool: missing name');
    });

    test('should handle tool with schema property instead of inputSchema', () => {
      const legionTool = {
        name: 'test_tool',
        description: 'Test tool',
        schema: {
          type: 'object',
          properties: {
            param: { type: 'string' }
          },
          required: []
        }
      };

      const claudeTool = bridge.legionToClaudeTool(legionTool);

      expect(claudeTool.input_schema).toEqual(legionTool.schema);
    });

    test('should handle missing schema gracefully', () => {
      const legionTool = {
        name: 'test_tool',
        description: 'Test tool'
      };

      const claudeTool = bridge.legionToClaudeTool(legionTool);

      expect(claudeTool.input_schema).toEqual({
        type: 'object',
        properties: {},
        required: []
      });
    });
  });

  describe('legionToolsToClaudeTools()', () => {
    let bridge;
    let mockRegistry;

    beforeEach(() => {
      mockRegistry = {
        getTool: (name) => {
          const tools = {
            tool1: { name: 'tool1', description: 'Tool 1', inputSchema: {} },
            tool2: { name: 'tool2', description: 'Tool 2', inputSchema: {} },
            tool3: { name: 'tool3', description: 'Tool 3', inputSchema: {} }
          };
          return tools[name] || null;
        },
        getAllTools: () => [
          { name: 'tool1', description: 'Tool 1', inputSchema: {} },
          { name: 'tool2', description: 'Tool 2', inputSchema: {} },
          { name: 'tool3', description: 'Tool 3', inputSchema: {} }
        ]
      };
      bridge = new ClaudeToolBridge(mockRegistry);
    });

    test('should convert array of tool names using registry', () => {
      const claudeTools = bridge.legionToolsToClaudeTools(['tool1', 'tool2']);

      expect(claudeTools).toHaveLength(2);
      expect(claudeTools[0].name).toBe('tool1');
      expect(claudeTools[1].name).toBe('tool2');
    });

    test('should convert all tools when no names provided', () => {
      const claudeTools = bridge.legionToolsToClaudeTools();

      expect(claudeTools).toHaveLength(3);
      expect(claudeTools[0].name).toBe('tool1');
      expect(claudeTools[1].name).toBe('tool2');
      expect(claudeTools[2].name).toBe('tool3');
    });

    test('should filter out non-existent tools', () => {
      const claudeTools = bridge.legionToolsToClaudeTools(['tool1', 'nonexistent', 'tool2']);

      expect(claudeTools).toHaveLength(2);
      expect(claudeTools[0].name).toBe('tool1');
      expect(claudeTools[1].name).toBe('tool2');
    });
  });

  describe('executeLegionTool()', () => {
    let bridge;
    let mockRegistry;
    let mockTool;

    beforeEach(() => {
      mockTool = {
        execute: async (input) => ({ data: 'success', input })
      };
      mockRegistry = {
        getTool: (name) => (name === 'test_tool' ? mockTool : null),
        getAllTools: () => []
      };
      bridge = new ClaudeToolBridge(mockRegistry);
    });

    test('should execute tool and return success object', async () => {
      const result = await bridge.executeLegionTool('test_tool', { param: 'value' });

      expect(result).toEqual({
        success: true,
        result: { data: 'success', input: { param: 'value' } },
        toolName: 'test_tool'
      });
    });

    test('should return error object on tool execution error', async () => {
      mockTool.execute = async () => {
        throw new Error('Tool execution failed');
      };

      const result = await bridge.executeLegionTool('test_tool', {});

      expect(result).toEqual({
        success: false,
        error: 'Tool execution failed',
        toolName: 'test_tool'
      });
    });

    test('should throw error for non-existent tool', async () => {
      await expect(
        bridge.executeLegionTool('nonexistent_tool', {})
      ).rejects.toThrow('Tool not found: nonexistent_tool');
    });
  });

  describe('formatToolResult()', () => {
    let bridge;
    let mockRegistry;

    beforeEach(() => {
      mockRegistry = {
        getTool: () => null,
        getAllTools: () => []
      };
      bridge = new ClaudeToolBridge(mockRegistry);
    });

    test('should format success result as string', () => {
      const result = bridge.formatToolResult({ success: true, result: 'Test result' });
      expect(result).toBe('Test result');
    });

    test('should format error result with error message', () => {
      const result = bridge.formatToolResult({ success: false, error: 'Test error' });
      expect(result).toBe('Error: Test error');
    });

    test('should handle object results with JSON.stringify', () => {
      const result = bridge.formatToolResult({
        success: true,
        result: { key: 'value', nested: { data: 123 } }
      });

      const parsed = JSON.parse(result);
      expect(parsed.key).toBe('value');
      expect(parsed.nested.data).toBe(123);
    });

    test('should handle null/undefined results', () => {
      expect(bridge.formatToolResult(null)).toBe('Tool execution completed with no result');
      expect(bridge.formatToolResult(undefined)).toBe('Tool execution completed with no result');
    });

    test('should handle string results directly', () => {
      const result = bridge.formatToolResult('Direct string result');
      expect(result).toBe('Direct string result');
    });

    test('should stringify results without success flag', () => {
      const result = bridge.formatToolResult({ data: 'test', count: 42 });
      const parsed = JSON.parse(result);
      expect(parsed.data).toBe('test');
      expect(parsed.count).toBe(42);
    });
  });
});
