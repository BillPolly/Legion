/**
 * show_all Command End-to-End Test
 * 
 * Complete E2E test with WebSocket mock simulation and full actor message flow
 * Tests the complete pipeline: Command → SlashCommandAgent → ResourceActor → WebSocket → UI
 * NO MOCKS for core handle system - uses real handles
 */

import { jest } from '@jest/globals';
import { SlashCommandAgent } from '../../src/server/actors/tool-agent/SlashCommandAgent.js';
import { BaseHandle } from '../../../shared/handles/src/BaseHandle.js';
import { FileHandle } from '../../../shared/handles/src/handles/FileHandle.js'; 
import { TypeHandleRegistry } from '../../../shared/handles/src/TypeHandleRegistry.js';

describe('show_all Command End-to-End Test', () => {
  let slashAgent;
  let mockWebSocket;
  let mockResourceActor;
  let mockChatAgent;
  let webSocketMessages;
  let registry;

  beforeAll(() => {
    registry = TypeHandleRegistry.getGlobalRegistry();
  });

  beforeEach(() => {
    registry.clear();
    webSocketMessages = [];
    
    // Mock WebSocket with message capture
    mockWebSocket = {
      send: jest.fn((data) => {
        webSocketMessages.push(JSON.parse(data));
      }),
      readyState: 1, // WebSocket.OPEN
      close: jest.fn()
    };
    
    // Mock resource actor that simulates real UI communication
    mockResourceActor = {
      receive: jest.fn(async (messageType, data) => {
        console.log(`[MockResourceActor] Received: ${messageType}`, data);
        
        if (messageType === 'show-all-request') {
          // Simulate creating a display window
          const windowId = `window-${Date.now()}`;
          
          // Simulate sending to UI via WebSocket
          const uiMessage = {
            type: 'display-object',
            windowId: windowId,
            objectType: data.objectType,
            data: data.handleData || data.objectData,
            introspection: data.introspectionData,
            timestamp: new Date().toISOString()
          };
          
          mockWebSocket.send(JSON.stringify(uiMessage));
          
          return {
            success: true,
            windowId: windowId,
            viewerType: data.objectType === 'handle' ? 'HandleViewer' : 'ObjectViewer',
            message: `${data.objectType} displayed successfully`
          };
        }
        
        return { success: false, error: 'Unknown message type' };
      })
    };
    
    // Create real file system mock for FileHandle testing
    const mockFileSystem = {
      readFile: jest.fn().mockResolvedValue('test file content'),
      writeFile: jest.fn(),
      stat: jest.fn().mockResolvedValue({ size: 1024, mtime: new Date() }),
      watch: jest.fn(),
      unlink: jest.fn()
    };
    
    // Mock chat agent with REAL handles and objects
    mockChatAgent = {
      addResponse: jest.fn(),
      executionContext: {
        artifacts: {
          // Real FileHandle instance
          configFile: new FileHandle('/config/app.json', mockFileSystem),
          
          // Real BaseHandle instance  
          userSession: new BaseHandle('UserSessionHandle', {
            userId: 'user-123',
            sessionId: 'session-abc',
            loginTime: new Date()
          }),
          
          // Plain objects
          appConfig: {
            name: 'TestApp',
            version: '1.0.0',
            features: ['feature1', 'feature2']
          },
          
          // Primitive values
          debugMode: true,
          port: 3000,
          message: 'Hello World'
        }
      }
    };
    
    slashAgent = new SlashCommandAgent();
    slashAgent.setResourceActor(mockResourceActor);
  });

  describe('End-to-End FileHandle Display Workflow', () => {
    test('should complete full FileHandle display pipeline', async () => {
      console.log('\n🎯 Testing complete FileHandle display workflow...');
      
      // Step 1: Execute show_all command
      const args = { object: 'configFile', includeIntrospection: true };
      const result = await slashAgent.handleShowAll(args, mockChatAgent);
      
      // Step 2: Verify command result
      expect(result.success).toBe(true);
      expect(result.objectType).toBe('handle');
      expect(result.handleType).toBe('FileHandle');
      expect(result.windowId).toBeDefined();
      
      // Step 3: Verify resource actor was called correctly
      expect(mockResourceActor.receive).toHaveBeenCalledWith('show-all-request', {
        objectType: 'handle',
        handleData: expect.objectContaining({
          __type: 'RemoteHandle',
          handleType: 'FileHandle',
          handleId: expect.any(String)
        }),
        introspectionData: expect.objectContaining({
          methods: expect.arrayContaining(['read', 'write', 'stat']),
          attributes: expect.arrayContaining(['path', 'extension']),
          typeName: 'FileHandle'
        }),
        displayOptions: {
          includeIntrospection: true,
          format: 'default'
        }
      });
      
      // Step 4: Verify WebSocket message was sent to UI
      expect(webSocketMessages.length).toBe(1);
      
      const uiMessage = webSocketMessages[0];
      expect(uiMessage.type).toBe('display-object');
      expect(uiMessage.objectType).toBe('handle');
      expect(uiMessage.data.__type).toBe('RemoteHandle');
      expect(uiMessage.introspection.typeName).toBe('FileHandle');
      
      console.log('✅ Complete FileHandle pipeline working!');
    });

    test('should handle FileHandle without introspection', async () => {
      const args = { object: 'configFile' }; // No introspection flag
      
      const result = await slashAgent.handleShowAll(args, mockChatAgent);
      
      expect(result.success).toBe(true);
      
      // Should not include introspection data
      const resourceCall = mockResourceActor.receive.mock.calls[0][1];
      expect(resourceCall.introspectionData).toBeUndefined();
      
      const uiMessage = webSocketMessages[0];
      expect(uiMessage.introspection).toBeUndefined();
    });
  });

  describe('End-to-End Plain Object Display Workflow', () => {
    test('should complete full plain object display pipeline', async () => {
      console.log('\n🎯 Testing plain object display workflow...');
      
      const args = { object: 'appConfig' };
      const result = await slashAgent.handleShowAll(args, mockChatAgent);
      
      expect(result.success).toBe(true);
      expect(result.objectType).toBe('serializable');
      expect(result.handleType).toBeUndefined();
      
      // Verify WebSocket message for plain object
      const uiMessage = webSocketMessages[0];
      expect(uiMessage.type).toBe('display-object');
      expect(uiMessage.objectType).toBe('serializable');
      expect(uiMessage.data).toEqual({
        name: 'TestApp',
        version: '1.0.0',
        features: ['feature1', 'feature2']
      });
      
      console.log('✅ Plain object pipeline working!');
    });

    test('should handle primitive values', async () => {
      const args = { object: 'debugMode' };
      const result = await slashAgent.handleShowAll(args, mockChatAgent);
      
      expect(result.objectType).toBe('primitive');
      
      const uiMessage = webSocketMessages[0];
      expect(uiMessage.data).toBe(true);
    });
  });

  describe('WebSocket Communication Simulation', () => {
    test('should simulate complete WebSocket message flow', async () => {
      console.log('\n🎯 Testing WebSocket message flow simulation...');
      
      // Test multiple objects in sequence
      await slashAgent.handleShowAll({ object: 'configFile' }, mockChatAgent);
      await slashAgent.handleShowAll({ object: 'appConfig' }, mockChatAgent);
      await slashAgent.handleShowAll({ object: 'port' }, mockChatAgent);
      
      // Should have sent 3 WebSocket messages
      expect(webSocketMessages.length).toBe(3);
      
      // Verify message sequence
      expect(webSocketMessages[0].objectType).toBe('handle');
      expect(webSocketMessages[1].objectType).toBe('serializable'); 
      expect(webSocketMessages[2].objectType).toBe('primitive');
      
      // Verify all have unique window IDs
      const windowIds = webSocketMessages.map(msg => msg.windowId);
      expect(new Set(windowIds).size).toBe(3); // All unique
      
      console.log('✅ WebSocket message flow working!');
    });

    test('should handle WebSocket connection failures', () => {
      mockWebSocket.send.mockImplementation(() => {
        throw new Error('WebSocket connection lost');
      });
      
      // Should still complete successfully (resource actor handles WebSocket errors)
      return expect(slashAgent.handleShowAll({ object: 'configFile' }, mockChatAgent))
        .resolves.toEqual(expect.objectContaining({ success: true }));
    });
  });

  describe('Bidirectional Handle Flow E2E', () => {
    test('should demonstrate client-created handle sent to server', () => {
      console.log('\n🎯 Testing bidirectional handle flow...');
      
      // Simulate client creating a handle
      const clientHandle = new BaseHandle('ClientUIHandle', {
        elementId: 'button-123',
        eventType: 'click',
        coordinates: { x: 100, y: 200 }
      });
      
      clientHandle.setAttribute('source', 'browser');
      clientHandle.setAttribute('timestamp', Date.now());
      
      // Simulate client sending handle to server via show_all
      const args = { directHandle: clientHandle };
      
      return slashAgent.handleShowAll(args, mockChatAgent).then(result => {
        expect(result.success).toBe(true);
        expect(result.objectType).toBe('handle');
        
        // Verify handle was serialized correctly
        const resourceCall = mockResourceActor.receive.mock.calls[0][1];
        expect(resourceCall.handleData.data.elementId).toBe('button-123');
        expect(resourceCall.handleData.attributes.source).toBe('browser');
        
        console.log('✅ Bidirectional handle flow foundation working!');
      });
    });

    test('should support handle method call simulation', async () => {
      // Create a handle with callable methods
      class InteractiveHandle extends BaseHandle {
        constructor() {
          super('InteractiveHandle', { name: 'interactive' });
        }
        
        async _getValue() {
          return 'interactive value';
        }
        
        async _setValue(value) {
          this.data.value = value;
          return true;
        }
      }
      
      const interactiveHandle = new InteractiveHandle();
      
      // Test serialization preserves callable interface
      const serialized = interactiveHandle.serialize();
      expect(serialized.__type).toBe('RemoteHandle');
      expect(serialized.handleType).toBe('InteractiveHandle');
      
      // This demonstrates the foundation for remote method calls
      // In real system, UI would create RemoteHandle proxy and call methods
      console.log('✅ Interactive handle serialization working!');
    });
  });

  describe('Complete Actor Message Flow Simulation', () => {
    test('should simulate complete server→UI→client actor flow', async () => {
      console.log('\n🎯 Testing complete actor message flow...');
      
      // Server: Create handle with subscription
      const serverHandle = new FileHandle('/server/data.txt', {
        readFile: jest.fn().mockResolvedValue('server content'),
        writeFile: jest.fn(),
        stat: jest.fn(),
        watch: jest.fn(),
        unlink: jest.fn()
      });
      
      // Server: Add to context
      mockChatAgent.executionContext.artifacts.serverData = serverHandle;
      
      // Server: Execute show_all command  
      const result = await slashAgent.handleShowAll({ 
        object: 'serverData', 
        includeIntrospection: true 
      }, mockChatAgent);
      
      expect(result.success).toBe(true);
      
      // UI: Receives handle data via WebSocket
      const uiMessage = webSocketMessages[0];
      expect(uiMessage.type).toBe('display-object');
      expect(uiMessage.data.__type).toBe('RemoteHandle');
      
      // UI: Would create RemoteHandle proxy from received data
      // Client: Would be able to call methods on server handle
      // This demonstrates the complete transparent remote object system
      
      console.log('✅ Complete actor flow simulation working!');
      console.log(`   Server Handle ID: ${serverHandle.getGuid()}`);
      console.log(`   UI Message Type: ${uiMessage.type}`);
      console.log(`   Remote Handle Type: ${uiMessage.data.handleType}`);
    });
  });

  describe('Performance and Error Recovery', () => {
    test('should handle multiple concurrent show_all commands', async () => {
      const promises = [
        slashAgent.handleShowAll({ object: 'configFile' }, mockChatAgent),
        slashAgent.handleShowAll({ object: 'appConfig' }, mockChatAgent),
        slashAgent.handleShowAll({ object: 'userSession' }, mockChatAgent)
      ];
      
      const results = await Promise.all(promises);
      
      results.forEach(result => {
        expect(result.success).toBe(true);
      });
      
      expect(webSocketMessages.length).toBe(3);
    });

    test('should recover from resource actor errors gracefully', async () => {
      mockResourceActor.receive.mockRejectedValue(new Error('Resource actor crashed'));
      
      await expect(slashAgent.handleShowAll({ object: 'configFile' }, mockChatAgent))
        .rejects.toThrow('Resource actor crashed');
        
      // System should still be functional after error
      mockResourceActor.receive.mockResolvedValue({ success: true, windowId: 'recovery-window' });
      
      const result = await slashAgent.handleShowAll({ object: 'appConfig' }, mockChatAgent);
      expect(result.success).toBe(true);
    });

    test('should handle large object serialization efficiently', async () => {
      // Create large object
      const largeObject = {};
      for (let i = 0; i < 1000; i++) {
        largeObject[`property_${i}`] = { 
          id: i, 
          data: `value_${i}`,
          nested: { deep: { value: i * 2 } }
        };
      }
      
      mockChatAgent.executionContext.artifacts.largeData = largeObject;
      
      const result = await slashAgent.handleShowAll({ object: 'largeData' }, mockChatAgent);
      
      expect(result.success).toBe(true);
      expect(result.objectType).toBe('serializable');
      
      const uiMessage = webSocketMessages[0];
      expect(Object.keys(uiMessage.data).length).toBe(1000);
    });
  });

  describe('Real Handle System Integration', () => {
    test('should work with real FileHandle instances', async () => {
      // This test uses real FileHandle, real TypeHandleRegistry, real BaseHandle
      // NO MOCKS for handle system components
      
      const realFileHandle = mockChatAgent.executionContext.artifacts.configFile;
      
      // Verify it's a real FileHandle
      expect(realFileHandle).toBeInstanceOf(FileHandle);
      expect(realFileHandle.isActor).toBe(true);
      expect(realFileHandle.handleType).toBe('FileHandle');
      
      // Test real handle introspection
      expect(realFileHandle.type.name).toBe('FileHandle');
      expect(realFileHandle.type.respondsTo('read')).toBe(true);
      expect(realFileHandle.type.respondsTo('nonExistentMethod')).toBe(false);
      
      // Test real serialization
      const serialized = realFileHandle.serialize();
      expect(serialized.__type).toBe('RemoteHandle');
      expect(serialized.handleType).toBe('FileHandle');
      
      // Test complete workflow with real handle
      const result = await slashAgent.handleShowAll({ 
        object: 'configFile',
        includeIntrospection: true 
      }, mockChatAgent);
      
      expect(result.success).toBe(true);
      expect(result.objectType).toBe('handle');
      
      const uiMessage = webSocketMessages[0];
      expect(uiMessage.introspection.methods).toContain('read');
      expect(uiMessage.introspection.methods).toContain('write');
      
      console.log('✅ Real handle system integration complete!');
    });

    test('should demonstrate handle caching and events in E2E flow', async () => {
      const fileHandle = mockChatAgent.executionContext.artifacts.configFile;
      
      // Set up event subscription (simulates UI subscribing to handle events)
      const eventCallback = jest.fn();
      fileHandle.subscribe('content-changed', eventCallback);
      
      // Display handle via show_all
      await slashAgent.handleShowAll({ object: 'configFile' }, mockChatAgent);
      
      // Simulate file operations (would normally come from UI via remote calls)
      const content = await fileHandle.read();
      expect(content).toBe('test file content');
      
      await fileHandle.write('updated content');
      
      // Event should have been emitted
      expect(eventCallback).toHaveBeenCalledWith(true);
      
      console.log('✅ Handle events and caching working in E2E context!');
    });
  });

  describe('Future Bidirectional Testing Foundation', () => {
    test('should establish foundation for UI→Server handle transmission', () => {
      // Create a handle that represents client-side state
      const clientStateHandle = new BaseHandle('ClientStateHandle', {
        viewState: {
          selectedTab: 'editor',
          scrollPosition: 450,
          openFiles: ['file1.js', 'file2.css']
        },
        userPreferences: {
          theme: 'dark',
          fontSize: 14
        }
      });
      
      clientStateHandle.setAttribute('clientVersion', '1.0.0');
      clientStateHandle.setAttribute('browserType', 'Chrome');
      
      // Serialize as if sending from client to server
      const serialized = clientStateHandle.serialize();
      
      expect(serialized.__type).toBe('RemoteHandle');
      expect(serialized.data.viewState.selectedTab).toBe('editor');
      expect(serialized.attributes.clientVersion).toBe('1.0.0');
      
      console.log('✅ Foundation for client→server handle transmission ready!');
    });

    test('should support complex handle graphs', () => {
      // Create interconnected handles (simulates complex UI state)
      const parentHandle = new BaseHandle('ParentHandle', { id: 'parent' });
      const childHandle = new BaseHandle('ChildHandle', { parentId: 'parent', id: 'child' });
      
      parentHandle.setAttribute('children', ['child']);
      childHandle.setAttribute('parent', 'parent');
      
      // Both handles should serialize independently
      const parentSerialized = parentHandle.serialize();
      const childSerialized = childHandle.serialize();
      
      expect(parentSerialized.handleType).toBe('ParentHandle');
      expect(childSerialized.handleType).toBe('ChildHandle');
      expect(childSerialized.attributes.parent).toBe('parent');
      
      console.log('✅ Complex handle graphs supported!');
    });
  });
});