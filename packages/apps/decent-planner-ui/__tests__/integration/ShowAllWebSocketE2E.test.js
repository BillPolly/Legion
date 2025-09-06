/**
 * show_all Command WebSocket E2E Test
 * 
 * Tests complete WebSocket message flow without external dependencies
 * Focuses on actor communication and message serialization
 */

import { jest } from '@jest/globals';
import { SlashCommandAgent } from '../../src/server/actors/tool-agent/SlashCommandAgent.js';

describe('show_all WebSocket E2E Test', () => {
  let slashAgent;
  let webSocketMessages;
  let mockResourceActor;
  let mockChatAgent;

  beforeEach(() => {
    webSocketMessages = [];
    
    // Enhanced WebSocket mock that captures all message details
    const mockWebSocket = {
      send: jest.fn((data) => {
        try {
          const parsed = JSON.parse(data);
          webSocketMessages.push({
            ...parsed,
            rawData: data,
            timestamp: Date.now(),
            size: data.length
          });
        } catch (error) {
          webSocketMessages.push({
            error: 'Invalid JSON',
            rawData: data,
            timestamp: Date.now()
          });
        }
      }),
      readyState: 1,
      close: jest.fn()
    };
    
    // Resource actor that simulates realistic WebSocket communication
    mockResourceActor = {
      receive: jest.fn(async (messageType, data) => {
        const windowId = `window-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
        
        if (messageType === 'show-all-request') {
          // Simulate UI message creation
          const uiMessage = {
            type: 'display-object-request',
            requestId: `req-${Date.now()}`,
            windowId: windowId,
            objectType: data.objectType,
            payload: data.handleData || data.objectData,
            metadata: {
              includeIntrospection: data.displayOptions?.includeIntrospection,
              format: data.displayOptions?.format,
              timestamp: new Date().toISOString()
            }
          };
          
          // Send via WebSocket
          mockWebSocket.send(JSON.stringify(uiMessage));
          
          // Return success response
          return {
            success: true,
            windowId: windowId,
            messageId: uiMessage.requestId,
            viewerType: data.objectType === 'handle' ? 'HandleViewer' : 'ObjectViewer',
            message: `Object of type ${data.objectType} queued for display`
          };
        }
        
        return { success: false, error: `Unknown message type: ${messageType}` };
      })
    };
    
    // Chat agent with various object types
    mockChatAgent = {
      addResponse: jest.fn(),
      executionContext: {
        artifacts: {
          // Mock handle-like object (simulates real handle)
          mockHandle: {
            isActor: true,
            handleType: 'MockFileHandle',
            serialize: jest.fn().mockReturnValue({
              __type: 'RemoteHandle',
              handleId: 'mock-handle-123',
              handleType: 'MockFileHandle',
              attributes: { 
                path: '/mock/file.txt',
                size: 2048 
              },
              data: { path: '/mock/file.txt' }
            }),
            type: {
              listMethods: jest.fn().mockReturnValue(['read', 'write', 'stat']),
              listAttributes: jest.fn().mockReturnValue(['path', 'size', 'extension']),
              name: 'MockFileHandle'
            },
            getGuid: jest.fn().mockReturnValue('mock-handle-123')
          },
          
          // Complex object
          complexData: {
            user: { id: 123, name: 'Test User' },
            preferences: { theme: 'dark', language: 'en' },
            history: [
              { action: 'login', timestamp: '2025-01-01T00:00:00Z' },
              { action: 'view_page', page: '/dashboard' }
            ]
          },
          
          // Simple primitive
          apiKey: 'secret-key-123'
        }
      }
    };
    
    slashAgent = new SlashCommandAgent();
    slashAgent.setResourceActor(mockResourceActor);
  });

  describe('Complete WebSocket Message Pipeline', () => {
    test('should demonstrate full WebSocket communication flow', async () => {
      console.log('\n🚀 Testing complete WebSocket communication pipeline...');
      
      // Test 1: Handle object
      const handleResult = await slashAgent.handleShowAll({ 
        object: 'mockHandle',
        includeIntrospection: true 
      }, mockChatAgent);
      
      expect(handleResult.success).toBe(true);
      expect(handleResult.objectType).toBe('handle');
      
      // Test 2: Complex object  
      const complexResult = await slashAgent.handleShowAll({ 
        object: 'complexData' 
      }, mockChatAgent);
      
      expect(complexResult.success).toBe(true);
      expect(complexResult.objectType).toBe('serializable');
      
      // Test 3: Primitive value
      const primitiveResult = await slashAgent.handleShowAll({ 
        object: 'apiKey' 
      }, mockChatAgent);
      
      expect(primitiveResult.success).toBe(true);
      expect(primitiveResult.objectType).toBe('primitive');
      
      // Verify WebSocket messages
      expect(webSocketMessages.length).toBe(3);
      
      // Analyze each message
      const handleMessage = webSocketMessages[0];
      expect(handleMessage.type).toBe('display-object-request');
      expect(handleMessage.payload.__type).toBe('RemoteHandle');
      expect(handleMessage.metadata.includeIntrospection).toBe(true);
      
      const complexMessage = webSocketMessages[1];
      expect(complexMessage.payload.user.name).toBe('Test User');
      expect(complexMessage.payload.history.length).toBe(2);
      
      const primitiveMessage = webSocketMessages[2];
      expect(primitiveMessage.payload).toBe('secret-key-123');
      
      console.log('✅ Complete WebSocket pipeline working!');
      console.log(`   Handle message size: ${handleMessage.size} bytes`);
      console.log(`   Complex object message size: ${complexMessage.size} bytes`);
      console.log(`   Primitive message size: ${primitiveMessage.size} bytes`);
    });
  });

  describe('Message Size and Performance Analysis', () => {
    test('should analyze WebSocket message efficiency', async () => {
      await slashAgent.handleShowAll({ object: 'mockHandle' }, mockChatAgent);
      
      const message = webSocketMessages[0];
      
      // Verify message structure is efficient
      expect(message.size).toBeLessThan(5000); // Reasonable size limit
      expect(message.type).toBe('display-object-request');
      expect(message.windowId).toBeDefined();
      expect(message.requestId).toBeDefined();
      
      // Handle data should be serialized, not full object
      expect(message.payload.__type).toBe('RemoteHandle');
      expect(message.payload.handleId).toBe('mock-handle-123');
      
      console.log(`📊 Message analysis: ${message.size} bytes, type: ${message.objectType}`);
    });

    test('should handle rapid command execution', async () => {
      const startTime = Date.now();
      
      // Execute multiple commands rapidly
      const promises = [];
      for (let i = 0; i < 10; i++) {
        promises.push(slashAgent.handleShowAll({ object: 'apiKey' }, mockChatAgent));
      }
      
      const results = await Promise.all(promises);
      const endTime = Date.now();
      
      // All should succeed
      results.forEach(result => expect(result.success).toBe(true));
      
      // Should have generated 10 WebSocket messages
      expect(webSocketMessages.length).toBe(10);
      
      // Performance should be reasonable
      expect(endTime - startTime).toBeLessThan(1000); // Under 1 second
      
      console.log(`⚡ Performance: ${results.length} commands in ${endTime - startTime}ms`);
    });
  });

  describe('Error Recovery and Resilience', () => {
    test('should handle WebSocket transmission errors gracefully', async () => {
      // Simulate WebSocket send failure
      mockResourceActor.receive.mockImplementation(async (messageType, data) => {
        // Try to send message that will fail
        try {
          JSON.stringify({ data: BigInt(123) }); // BigInt not serializable
        } catch (error) {
          throw new Error('Serialization failed');
        }
      });
      
      await expect(slashAgent.handleShowAll({ object: 'mockHandle' }, mockChatAgent))
        .rejects.toThrow('Serialization failed');
      
      // System should recover
      mockResourceActor.receive.mockResolvedValue({ success: true, windowId: 'recovery' });
      
      const result = await slashAgent.handleShowAll({ object: 'apiKey' }, mockChatAgent);
      expect(result.success).toBe(true);
    });

    test('should maintain message ordering under load', async () => {
      const commandPromises = [
        slashAgent.handleShowAll({ object: 'mockHandle' }, mockChatAgent),
        slashAgent.handleShowAll({ object: 'complexData' }, mockChatAgent), 
        slashAgent.handleShowAll({ object: 'apiKey' }, mockChatAgent)
      ];
      
      await Promise.all(commandPromises);
      
      // Messages should maintain chronological order
      const timestamps = webSocketMessages.map(msg => msg.timestamp);
      const sortedTimestamps = [...timestamps].sort();
      
      expect(timestamps).toEqual(sortedTimestamps);
      expect(webSocketMessages.length).toBe(3);
    });
  });
});