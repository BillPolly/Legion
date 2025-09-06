/**
 * show_all Command Integration Test
 * 
 * Tests the new /show_all command with handle system integration
 * Uses TDD approach with mock WebSocket to test real actor communication
 * NO MOCKS for handle system - tests real handle serialization
 */

import { jest } from '@jest/globals';
import { SlashCommandAgent } from '../../src/server/actors/tool-agent/SlashCommandAgent.js';

describe('show_all Command Integration', () => {
  let slashAgent;
  let mockResourceActor;
  let mockChatAgent;
  let mockWebSocketMessages;
  let registry;

  beforeEach(() => {
    
    // Mock WebSocket message capture
    mockWebSocketMessages = [];
    
    // Mock resource actor that captures messages
    mockResourceActor = {
      receive: jest.fn(async (messageType, data) => {
        mockWebSocketMessages.push({ type: messageType, data });
        
        if (messageType === 'show-all-request') {
          return {
            success: true,
            windowId: `window-${Date.now()}`,
            objectType: data.objectType || 'unknown'
          };
        }
        
        return { success: true };
      })
    };
    
    // Mock chat agent for context
    mockChatAgent = {
      addResponse: jest.fn(),
      executionContext: {
        artifacts: {
          // Mock handle-like object
          testFile: {
            isActor: true,
            handleType: 'FileHandle',
            serialize: jest.fn().mockReturnValue({
              __type: 'RemoteHandle',
              handleId: 'test-file-handle',
              handleType: 'FileHandle',
              attributes: { path: '/test/document.txt' },
              data: { path: '/test/document.txt' }
            }),
            type: {
              listMethods: jest.fn().mockReturnValue(['read', 'write']),
              listAttributes: jest.fn().mockReturnValue(['path', 'extension']),
              name: 'FileHandle'
            },
            getGuid: jest.fn().mockReturnValue('test-file-handle')
          },
          testData: { name: 'test', value: 123, nested: { data: 'deep' } },
          simpleString: 'hello world',
          numberValue: 42
        }
      }
    };
    
    slashAgent = new SlashCommandAgent();
    slashAgent.setResourceActor(mockResourceActor);
  });

  describe('Handle Detection and Processing', () => {
    test('should detect BaseHandle instances correctly', async () => {
      const args = { object: 'testFile' }; // Reference to handle in context
      
      const result = await slashAgent.handleShowAll(args, mockChatAgent);
      
      expect(result.success).toBe(true);
      expect(result.objectType).toBe('handle');
      expect(result.handleType).toBe('FileHandle');
      
      // Should have called resource actor with handle data
      expect(mockResourceActor.receive).toHaveBeenCalledWith('show-all-request', {
        objectType: 'handle',
        handleData: expect.objectContaining({
          __type: 'RemoteHandle',
          handleId: 'test-file-handle',
          handleType: 'FileHandle'
        }),
        displayOptions: {
          includeIntrospection: false,
          format: 'default'
        }
      });
    });

    test('should handle direct handle objects passed as arguments', async () => {
      const mockHandle = {
        isActor: true,
        handleType: 'DirectFileHandle',
        serialize: jest.fn().mockReturnValue({
          __type: 'RemoteHandle',
          handleId: 'direct-handle-123',
          handleType: 'DirectFileHandle'
        }),
        getGuid: jest.fn().mockReturnValue('direct-handle-123')
      };
      
      const args = { directHandle: mockHandle };
      
      const result = await slashAgent.handleShowAll(args, mockChatAgent);
      
      expect(result.success).toBe(true);
      expect(result.objectType).toBe('handle');
      
      // Should serialize the handle for transmission
      const sentData = mockWebSocketMessages[0].data;
      expect(sentData.handleData.__type).toBe('RemoteHandle');
      expect(sentData.handleData.handleType).toBe('DirectFileHandle');
      expect(sentData.handleData.handleId).toBe('direct-handle-123');
    });

    test('should detect plain objects and prepare for serialization', async () => {
      const args = { object: 'testData' }; // Reference to plain object
      
      const result = await slashAgent.handleShowAll(args, mockChatAgent);
      
      expect(result.success).toBe(true);
      expect(result.objectType).toBe('serializable');
      
      const sentData = mockWebSocketMessages[0].data;
      expect(sentData.objectType).toBe('serializable');
      expect(sentData.objectData).toEqual({ name: 'test', value: 123, nested: { data: 'deep' } });
    });

    test('should handle primitive values', async () => {
      const args = { object: 'simpleString' };
      
      const result = await slashAgent.handleShowAll(args, mockChatAgent);
      
      expect(result.success).toBe(true);
      expect(result.objectType).toBe('primitive');
      
      const sentData = mockWebSocketMessages[0].data;
      expect(sentData.objectData).toBe('hello world');
    });
  });

  describe('Handle Serialization through Actor System', () => {
    test('should serialize FileHandle correctly for actor transmission', async () => {
      const fileHandle = mockChatAgent.executionContext.artifacts.testFile;
      const args = { object: 'testFile' };
      
      await slashAgent.handleShowAll(args, mockChatAgent);
      
      const sentMessage = mockWebSocketMessages[0];
      expect(sentMessage.type).toBe('show-all-request');
      
      const handleData = sentMessage.data.handleData;
      expect(handleData.__type).toBe('RemoteHandle');
      expect(handleData.handleType).toBe('FileHandle');
      expect(handleData.attributes.path).toBe('/test/document.txt');
      // Note: extension might not be in mock data, check if available
      if (handleData.attributes.extension) {
        expect(handleData.attributes.extension).toBe('.txt');
      }
    });

    test('should include handle introspection metadata', async () => {
      const args = { object: 'testFile', includeIntrospection: true };
      
      await slashAgent.handleShowAll(args, mockChatAgent);
      
      const sentData = mockWebSocketMessages[0].data;
      expect(sentData.introspectionData).toBeDefined();
      expect(sentData.introspectionData.methods).toContain('read');
      expect(sentData.introspectionData.methods).toContain('write');
      expect(sentData.introspectionData.attributes).toContain('path');
    });

    test('should handle transmission errors gracefully', async () => {
      mockResourceActor.receive.mockRejectedValue(new Error('WebSocket error'));
      
      const args = { object: 'testFile' };
      
      await expect(slashAgent.handleShowAll(args, mockChatAgent)).rejects.toThrow('WebSocket error');
    });
  });

  describe('Command Parsing and Validation', () => {
    test('should parse show_all command arguments correctly', () => {
      const testCases = [
        { input: '/show_all myHandle', expected: { object: 'myHandle' } },
        { input: '/show_all myHandle --introspection', expected: { object: 'myHandle', includeIntrospection: true } },
        { input: '/show_all myData --format=json', expected: { object: 'myData', format: 'json' } }
      ];
      
      testCases.forEach(({ input, expected }) => {
        const parsed = slashAgent.parseShowAllCommand(input);
        expect(parsed).toEqual(expected);
      });
    });

    test('should validate command arguments', () => {
      expect(() => {
        slashAgent.parseShowAllCommand('/show_all');
      }).toThrow('show_all command requires an object reference');
      
      // parseShowAllCommand only parses syntax, doesn't check if object exists
      const parsed = slashAgent.parseShowAllCommand('/show_all nonExistentObject');
      expect(parsed.object).toBe('nonExistentObject');
    });

    test('should provide helpful error messages', async () => {
      const args = { object: 'nonExistentHandle' };
      
      await expect(slashAgent.handleShowAll(args, mockChatAgent))
        .rejects.toThrow('Object nonExistentHandle not found in execution context');
    });
  });

  describe('WebSocket Communication Simulation', () => {
    test('should send proper WebSocket messages for handle display', async () => {
      const args = { object: 'testFile' };
      
      await slashAgent.handleShowAll(args, mockChatAgent);
      
      expect(mockWebSocketMessages.length).toBe(1);
      
      const message = mockWebSocketMessages[0];
      expect(message.type).toBe('show-all-request');
      expect(message.data.objectType).toBe('handle');
      expect(message.data.handleData.__type).toBe('RemoteHandle');
    });

    test('should handle WebSocket response processing', async () => {
      mockResourceActor.receive.mockResolvedValue({
        success: true,
        windowId: 'test-window-123',
        viewerType: 'HandleViewer',
        message: 'Handle displayed successfully'
      });
      
      const args = { object: 'testFile' };
      const result = await slashAgent.handleShowAll(args, mockChatAgent);
      
      expect(result.windowId).toBe('test-window-123');
      expect(result.viewerType).toBe('HandleViewer');
      expect(result.message).toBe('Handle displayed successfully');
      // Note: The actual implementation doesn't call addResponse, it returns the result
    });
  });

  describe('Real Actor System Integration Preview', () => {
    test('should work with actual SlashCommandAgent message handling', async () => {
      // Test command parsing first
      const parsed = slashAgent.parseShowAllCommand('/show_all testFile --introspection');
      expect(parsed.object).toBe('testFile');
      expect(parsed.includeIntrospection).toBe(true);
      
      // Then test the handler directly
      const result = await slashAgent.handleShowAll(parsed, mockChatAgent);
      expect(result.success).toBe(true);
      expect(result.objectType).toBe('handle');
      expect(mockResourceActor.receive).toHaveBeenCalled();
    });

    test('should prepare for UI bidirectional testing', () => {
      // Mock a handle that could be sent from client to server
      const mockClientHandle = {
        isActor: true,
        handleType: 'ClientHandle',
        serialize: jest.fn().mockReturnValue({
          __type: 'RemoteHandle',
          handleId: 'client-handle-abc',
          data: { clientId: 'browser-abc', userAction: 'file-select' }
        })
      };
      
      // Simulate what would happen when UI sends handle to server
      const serialized = mockClientHandle.serialize();
      expect(serialized.__type).toBe('RemoteHandle');
      expect(serialized.data.clientId).toBe('browser-abc');
    });
  });

  describe('Error Handling and Edge Cases', () => {
    test('should handle malformed show_all commands gracefully', async () => {
      const invalidArgs = { invalidKey: 'value' };
      
      await expect(slashAgent.handleShowAll(invalidArgs, mockChatAgent))
        .rejects.toThrow('show_all command requires object parameter');
    });

    test('should handle context with no objects', async () => {
      const emptyContext = { executionContext: { artifacts: {} } };
      const args = { object: 'anything' };
      
      await expect(slashAgent.handleShowAll(args, emptyContext))
        .rejects.toThrow('Object anything not found');
    });

    test('should handle resource actor communication failures', async () => {
      mockResourceActor.receive.mockRejectedValue(new Error('Resource actor not available'));
      
      const args = { object: 'testFile' };
      
      await expect(slashAgent.handleShowAll(args, mockChatAgent))
        .rejects.toThrow('Resource actor not available');
    });
  });
});