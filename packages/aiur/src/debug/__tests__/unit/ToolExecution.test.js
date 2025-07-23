/**
 * Unit tests for MCP tool execution via WebSocket
 */

import { WebDebugServer } from '../../WebDebugServer.js';
import { mockResourceManager, mockMCPServer, sampleWebSocketMessages } from '../fixtures/mockData.js';
import { getSharedWebDebugServer, getSharedServerPort, waitForAsync } from '../fixtures/testSetup.js';
import { WebSocket } from 'ws';

describe('WebDebugServer Tool Execution', () => {
  let webDebugServer;
  let mockRM;

  beforeAll(async () => {
    // Get shared server instance to reduce console noise
    webDebugServer = await getSharedWebDebugServer();
  });

  beforeEach(async () => {
    mockRM = {
      ...mockResourceManager,
      get: mockResourceManager.get
    };
    
    // Reset mock functions before each test
    mockMCPServer.toolDefinitionProvider.executeTool.mockClear();
  });

  afterEach(async () => {
    // Small delay to let connections clean up
    await waitForAsync(50);
  });

  describe('WebSocket message parsing and validation', () => {
    test('should parse valid execute-tool messages', async () => {
      const ws = new WebSocket(`ws://localhost:${webDebugServer.port}/ws`);
      const receivedMessages = [];
      
      ws.on('message', (data) => {
        receivedMessages.push(JSON.parse(data.toString()));
      });

      await new Promise(resolve => ws.on('open', resolve));

      // Mock successful tool execution
      mockMCPServer.toolDefinitionProvider.executeTool.mockResolvedValue({
        content: [{ type: "text", text: '{"success": true}' }],
        isError: false
      });

      // Send valid execute-tool message
      ws.send(JSON.stringify(sampleWebSocketMessages.executeToolRequest));

      await new Promise(resolve => setTimeout(resolve, 200));

      const toolResult = receivedMessages.find(msg => msg.type === 'tool-result');
      expect(toolResult).toBeDefined();
      expect(toolResult.id).toBe(sampleWebSocketMessages.executeToolRequest.id);
      expect(toolResult.data.success).toBe(true);

      ws.close();
    });

    test('should handle missing tool name', async () => {
      const ws = new WebSocket(`ws://localhost:${webDebugServer.port}/ws`);
      const receivedMessages = [];
      
      ws.on('message', (data) => {
        receivedMessages.push(JSON.parse(data.toString()));
      });

      await new Promise(resolve => ws.on('open', resolve));

      // Send message without tool name
      ws.send(JSON.stringify({
        type: 'execute-tool',
        id: 'test-req',
        data: {
          arguments: { filter: 'test' }
        }
      }));

      await new Promise(resolve => setTimeout(resolve, 200));

      const toolResult = receivedMessages.find(msg => msg.type === 'tool-result');
      expect(toolResult).toBeDefined();
      expect(toolResult.data.success).toBe(false);
      expect(toolResult.data.error).toContain('Tool not found');

      ws.close();
    });

    test('should handle missing request ID', async () => {
      const ws = new WebSocket(`ws://localhost:${webDebugServer.port}/ws`);
      const receivedMessages = [];
      
      ws.on('message', (data) => {
        receivedMessages.push(JSON.parse(data.toString()));
      });

      await new Promise(resolve => ws.on('open', resolve));

      // Mock successful tool execution
      mockMCPServer.toolDefinitionProvider.executeTool.mockResolvedValue({
        content: [{ type: "text", text: '{"success": true}' }],
        isError: false
      });

      // Send message without ID
      ws.send(JSON.stringify({
        type: 'execute-tool',
        data: {
          name: 'context_list',
          arguments: {}
        }
      }));

      await new Promise(resolve => setTimeout(resolve, 200));

      // Should still get a response but with undefined id
      const toolResult = receivedMessages.find(msg => msg.type === 'tool-result');
      expect(toolResult).toBeDefined();
      expect(toolResult.id).toBeUndefined();

      ws.close();
    });

    test('should handle malformed execute-tool data', async () => {
      const ws = new WebSocket(`ws://localhost:${webDebugServer.port}/ws`);
      const receivedMessages = [];
      
      ws.on('message', (data) => {
        receivedMessages.push(JSON.parse(data.toString()));
      });

      await new Promise(resolve => ws.on('open', resolve));

      // Send message with missing data field
      ws.send(JSON.stringify({
        type: 'execute-tool',
        id: 'test-req'
      }));

      await new Promise(resolve => setTimeout(resolve, 200));

      const toolResult = receivedMessages.find(msg => msg.type === 'tool-result');
      expect(toolResult).toBeDefined();
      expect(toolResult.data.success).toBe(false);

      ws.close();
    });
  });

  describe('MCP tool routing and execution', () => {
    test('should route tool execution to ToolDefinitionProvider', async () => {
      const ws = new WebSocket(`ws://localhost:${webDebugServer.port}/ws`);
      const receivedMessages = [];
      
      ws.on('message', (data) => {
        receivedMessages.push(JSON.parse(data.toString()));
      });

      await new Promise(resolve => ws.on('open', resolve));

      // Mock successful tool execution
      const expectedResult = {
        content: [{ type: "text", text: '{"contexts": [], "total": 0}' }],
        isError: false
      };
      mockMCPServer.toolDefinitionProvider.executeTool.mockResolvedValue(expectedResult);

      ws.send(JSON.stringify({
        type: 'execute-tool',
        id: 'test-123',
        data: {
          name: 'context_list',
          arguments: { filter: 'deploy*' }
        }
      }));

      await new Promise(resolve => setTimeout(resolve, 200));

      // Verify tool was called with correct parameters
      expect(mockMCPServer.toolDefinitionProvider.executeTool.calls.length).toBe(1);
      const call = mockMCPServer.toolDefinitionProvider.executeTool.calls[0];
      expect(call[0]).toBe('context_list');
      expect(call[1]).toEqual({ filter: 'deploy*' });

      // Verify response
      const toolResult = receivedMessages.find(msg => msg.type === 'tool-result');
      expect(toolResult.data.result).toEqual(expectedResult);

      ws.close();
    });

    test('should handle tool execution with no arguments', async () => {
      const ws = new WebSocket(`ws://localhost:${webDebugServer.port}/ws`);
      
      await new Promise(resolve => ws.on('open', resolve));

      mockMCPServer.toolDefinitionProvider.executeTool.mockResolvedValue({
        content: [{ type: "text", text: '{"status": "ok"}' }],
        isError: false
      });

      ws.send(JSON.stringify({
        type: 'execute-tool',
        id: 'test-456',
        data: {
          name: 'web_debug_status'
        }
      }));

      await new Promise(resolve => setTimeout(resolve, 200));

      // Should pass empty object as arguments
      const call = mockMCPServer.toolDefinitionProvider.executeTool.calls[0];
      expect(call[1]).toEqual({});

      ws.close();
    });

    test('should handle unknown tool names', async () => {
      const ws = new WebSocket(`ws://localhost:${webDebugServer.port}/ws`);
      const receivedMessages = [];
      
      ws.on('message', (data) => {
        receivedMessages.push(JSON.parse(data.toString()));
      });

      await new Promise(resolve => ws.on('open', resolve));

      // Mock tool not found error
      mockMCPServer.toolDefinitionProvider.executeTool.mockRejectedValue(
        new Error('Tool not found: nonexistent_tool')
      );

      ws.send(JSON.stringify({
        type: 'execute-tool',
        id: 'test-789',
        data: {
          name: 'nonexistent_tool',
          arguments: {}
        }
      }));

      await new Promise(resolve => setTimeout(resolve, 200));

      const toolResult = receivedMessages.find(msg => msg.type === 'tool-result');
      expect(toolResult.data.success).toBe(false);
      expect(toolResult.data.error).toContain('Tool not found');

      ws.close();
    });
  });

  describe('tool result formatting and response', () => {
    test('should format successful tool results correctly', async () => {
      const ws = new WebSocket(`ws://localhost:${webDebugServer.port}/ws`);
      const receivedMessages = [];
      
      ws.on('message', (data) => {
        receivedMessages.push(JSON.parse(data.toString()));
      });

      await new Promise(resolve => ws.on('open', resolve));

      const mockResult = {
        content: [{
          type: "text",
          text: JSON.stringify({ success: true, data: "test result" }, null, 2)
        }],
        isError: false
      };

      mockMCPServer.toolDefinitionProvider.executeTool.mockResolvedValue(mockResult);

      ws.send(JSON.stringify({
        type: 'execute-tool',
        id: 'format-test',
        data: { name: 'test_tool', arguments: {} }
      }));

      await new Promise(resolve => setTimeout(resolve, 200));

      const toolResult = receivedMessages.find(msg => msg.type === 'tool-result');
      expect(toolResult).toEqual({
        type: 'tool-result',
        id: 'format-test',
        data: {
          success: true,
          result: mockResult,
          executionTime: expect.any(Number)
        }
      });

      expect(toolResult.data.executionTime).toBeGreaterThan(0);

      ws.close();
    });

    test('should format error tool results correctly', async () => {
      const ws = new WebSocket(`ws://localhost:${webDebugServer.port}/ws`);
      const receivedMessages = [];
      
      ws.on('message', (data) => {
        receivedMessages.push(JSON.parse(data.toString()));
      });

      await new Promise(resolve => ws.on('open', resolve));

      const mockErrorResult = {
        content: [{
          type: "text",
          text: JSON.stringify({ success: false, error: "Tool execution failed" }, null, 2)
        }],
        isError: true
      };

      mockMCPServer.toolDefinitionProvider.executeTool.mockResolvedValue(mockErrorResult);

      ws.send(JSON.stringify({
        type: 'execute-tool',
        id: 'error-test',
        data: { name: 'failing_tool', arguments: {} }
      }));

      await new Promise(resolve => setTimeout(resolve, 200));

      const toolResult = receivedMessages.find(msg => msg.type === 'tool-result');
      expect(toolResult.data.success).toBe(false);
      expect(toolResult.data.result).toEqual(mockErrorResult);

      ws.close();
    });

    test('should include execution time in response', async () => {
      const ws = new WebSocket(`ws://localhost:${webDebugServer.port}/ws`);
      const receivedMessages = [];
      
      ws.on('message', (data) => {
        receivedMessages.push(JSON.parse(data.toString()));
      });

      await new Promise(resolve => ws.on('open', resolve));

      // Mock a delayed tool execution
      mockMCPServer.toolDefinitionProvider.executeTool.mockImplementation(
        async () => {
          await new Promise(resolve => setTimeout(resolve, 100));
          return {
            content: [{ type: "text", text: '{"result": "delayed"}' }],
            isError: false
          };
        }
      );

      const startTime = Date.now();
      ws.send(JSON.stringify({
        type: 'execute-tool',
        id: 'timing-test',
        data: { name: 'slow_tool', arguments: {} }
      }));

      await new Promise(resolve => setTimeout(resolve, 300));

      const toolResult = receivedMessages.find(msg => msg.type === 'tool-result');
      expect(toolResult.data.executionTime).toBeGreaterThanOrEqual(100);
      expect(toolResult.data.executionTime).toBeLessThan(1000);

      ws.close();
    });
  });

  describe('error handling and timeout scenarios', () => {
    test('should handle tool execution exceptions', async () => {
      const ws = new WebSocket(`ws://localhost:${webDebugServer.port}/ws`);
      const receivedMessages = [];
      
      ws.on('message', (data) => {
        receivedMessages.push(JSON.parse(data.toString()));
      });

      await new Promise(resolve => ws.on('open', resolve));

      // Mock tool execution throwing an error
      mockMCPServer.toolDefinitionProvider.executeTool.mockRejectedValue(
        new Error('Database connection failed')
      );

      ws.send(JSON.stringify({
        type: 'execute-tool',
        id: 'exception-test',
        data: { name: 'db_tool', arguments: {} }
      }));

      await new Promise(resolve => setTimeout(resolve, 200));

      const toolResult = receivedMessages.find(msg => msg.type === 'tool-result');
      expect(toolResult.data.success).toBe(false);
      expect(toolResult.data.error).toBe('Database connection failed');
      expect(toolResult.data.executionTime).toBeGreaterThan(0);

      ws.close();
    });

    test('should emit tool-executed event after execution', async () => {
      const ws = new WebSocket(`ws://localhost:${webDebugServer.port}/ws`);
      const receivedMessages = [];
      
      ws.on('message', (data) => {
        receivedMessages.push(JSON.parse(data.toString()));
      });

      await new Promise(resolve => ws.on('open', resolve));

      mockMCPServer.toolDefinitionProvider.executeTool.mockResolvedValue({
        content: [{ type: "text", text: '{"success": true}' }],
        isError: false
      });

      // Clear welcome message
      receivedMessages.length = 0;

      ws.send(JSON.stringify({
        type: 'execute-tool',
        id: 'event-test',
        data: { name: 'test_tool', arguments: { param: 'value' } }
      }));

      await new Promise(resolve => setTimeout(resolve, 200));

      // Should receive both tool-result and event
      const toolResult = receivedMessages.find(msg => msg.type === 'tool-result');
      const eventMsg = receivedMessages.find(msg => 
        msg.type === 'event' && msg.data.eventType === 'tool-executed'
      );

      expect(toolResult).toBeDefined();
      expect(eventMsg).toBeDefined();
      expect(eventMsg.data.payload.tool).toBe('test_tool');
      expect(eventMsg.data.payload.success).toBe(true);
      expect(eventMsg.data.payload.arguments).toEqual({ param: 'value' });

      ws.close();
    });
  });

  describe('concurrent tool execution requests', () => {
    test('should handle multiple concurrent tool requests', async () => {
      const ws = new WebSocket(`ws://localhost:${webDebugServer.port}/ws`);
      const receivedMessages = [];
      
      ws.on('message', (data) => {
        receivedMessages.push(JSON.parse(data.toString()));
      });

      await new Promise(resolve => ws.on('open', resolve));

      // Mock tool execution with different delays
      mockMCPServer.toolDefinitionProvider.executeTool.mockImplementation(
        async (toolName) => {
          const delay = toolName === 'fast_tool' ? 50 : 150;
          await new Promise(resolve => setTimeout(resolve, delay));
          return {
            content: [{ type: "text", text: `{"tool": "${toolName}"}` }],
            isError: false
          };
        }
      );

      // Send multiple requests concurrently
      ws.send(JSON.stringify({
        type: 'execute-tool',
        id: 'concurrent-1',
        data: { name: 'slow_tool', arguments: {} }
      }));

      ws.send(JSON.stringify({
        type: 'execute-tool',
        id: 'concurrent-2',
        data: { name: 'fast_tool', arguments: {} }
      }));

      ws.send(JSON.stringify({
        type: 'execute-tool',
        id: 'concurrent-3',
        data: { name: 'slow_tool', arguments: {} }
      }));

      await new Promise(resolve => setTimeout(resolve, 400));

      // Should receive results for all requests
      const results = receivedMessages.filter(msg => msg.type === 'tool-result');
      expect(results.length).toBe(3);

      const ids = results.map(r => r.id).sort();
      expect(ids).toEqual(['concurrent-1', 'concurrent-2', 'concurrent-3']);

      // Fast tool should complete first
      const fastResult = results.find(r => r.id === 'concurrent-2');
      const slowResult1 = results.find(r => r.id === 'concurrent-1');
      
      expect(fastResult.data.executionTime).toBeLessThan(slowResult1.data.executionTime);

      ws.close();
    });

    test('should maintain request-response correlation', async () => {
      const ws = new WebSocket(`ws://localhost:${webDebugServer.port}/ws`);
      const receivedMessages = [];
      
      ws.on('message', (data) => {
        receivedMessages.push(JSON.parse(data.toString()));
      });

      await new Promise(resolve => ws.on('open', resolve));

      mockMCPServer.toolDefinitionProvider.executeTool.mockImplementation(
        async (toolName, args) => ({
          content: [{ type: "text", text: JSON.stringify({ tool: toolName, args }) }],
          isError: false
        })
      );

      // Send requests with different parameters
      const requests = [
        { id: 'req-1', name: 'tool_a', arguments: { param: 'value1' } },
        { id: 'req-2', name: 'tool_b', arguments: { param: 'value2' } },
        { id: 'req-3', name: 'tool_c', arguments: { param: 'value3' } }
      ];

      requests.forEach(req => {
        ws.send(JSON.stringify({
          type: 'execute-tool',
          id: req.id,
          data: { name: req.name, arguments: req.arguments }
        }));
      });

      await new Promise(resolve => setTimeout(resolve, 200));

      // Verify each response matches its request
      const results = receivedMessages.filter(msg => msg.type === 'tool-result');
      expect(results.length).toBe(3);

      results.forEach(result => {
        const originalReq = requests.find(r => r.id === result.id);
        expect(originalReq).toBeDefined();
        
        const responseData = JSON.parse(result.data.result.content[0].text);
        expect(responseData.tool).toBe(originalReq.name);
        expect(responseData.args).toEqual(originalReq.arguments);
      });

      ws.close();
    });
  });
});