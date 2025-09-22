/**
 * Unit Tests for ActorRemoteFileSystemResourceManager
 * 
 * Tests the ActorRemoteFileSystemResourceManager class that provides
 * browser-side filesystem access via Actor communication.
 */

import { ActorRemoteFileSystemResourceManager } from '../../src/resourcemanagers/ActorRemoteFileSystemResourceManager.js';
import { jest } from '@jest/globals';

// Mock WebSocket
class MockWebSocket extends EventTarget {
  constructor(url) {
    super();
    this.url = url;
    this.readyState = MockWebSocket.CONNECTING;
    this.CONNECTING = 0;
    this.OPEN = 1;
    this.CLOSING = 2;
    this.CLOSED = 3;
    
    // Simulate connection after a short delay
    setTimeout(() => {
      this.readyState = MockWebSocket.OPEN;
      this.dispatchEvent(new Event('open'));
    }, 10);
  }
  
  send(data) {
    if (this.readyState !== MockWebSocket.OPEN) {
      throw new Error('WebSocket is not open');
    }
    // Store sent message for verification
    this.lastSentMessage = data;
  }
  
  close() {
    this.readyState = MockWebSocket.CLOSED;
    this.dispatchEvent(new Event('close'));
  }
  
  // Helper method to simulate receiving messages
  simulateMessage(data) {
    this.dispatchEvent(new MessageEvent('message', { data }));
  }
}

// Mock WebSocketBridgeActor
class MockWebSocketBridgeActor {
  constructor(options) {
    this.options = options;
    this.protocol = options.protocol;
    this.websocket = options.websocket;
    this.actorSpace = options.actorSpace;
    this.name = options.name || 'FileSystemBridge';
    this.isConnected = false;
    
    // Simulate connection after short delay
    setTimeout(() => {
      this.isConnected = true;
    }, 10);
  }
  
  async receive(message) {
    // Store message for verification
    this.lastReceivedMessage = message;
    
    if (!this.isConnected) {
      console.warn(`${this.name}: Not connected, cannot send message`);
      return;
    }
    
    // Simulate actor processing and return response
    const { resolve } = message;
    if (resolve) {
      // Simulate async response
      setTimeout(() => {
        resolve({
          success: true,
          results: [],
          requestId: message.requestId
        });
      }, 5);
    }
    
    return {
      success: true,
      requestId: message.requestId
    };
  }
  
  destroy() {
    this.isConnected = false;
  }
}

// Mock FileSystemProtocol
class MockFileSystemProtocol {
  actorToProtocol(message) {
    return {
      type: `fs_${message.type.replace('filesystem', '').toLowerCase()}`,
      ...message.payload,
      requestId: message.requestId
    };
  }
  
  protocolToActor(message) {
    return {
      type: `filesystem${message.type.replace('fs_', '').replace('_response', 'Result')}`,
      payload: message,
      requestId: message.requestId
    };
  }
}

// Mock global WebSocket
global.WebSocket = MockWebSocket;

// Mock modules before importing the main class
jest.mock('@legion/websocket-actor-protocol', () => ({
  WebSocketBridgeActor: MockWebSocketBridgeActor
}));

jest.mock('../../src/protocol/FileSystemProtocol.js', () => ({
  FileSystemProtocol: MockFileSystemProtocol
}));

describe('ActorRemoteFileSystemResourceManager', () => {
  let resourceManager;
  let mockActorSpace;
  
  beforeEach(() => {
    mockActorSpace = new Map();
    // Add registerActor and unregisterActor methods that the ResourceManager expects
    mockActorSpace.registerActor = jest.fn((name, actor) => {
      mockActorSpace.set(name, actor);
    });
    mockActorSpace.unregisterActor = jest.fn((name) => {
      mockActorSpace.delete(name);
    });
    
    resourceManager = new ActorRemoteFileSystemResourceManager({
      wsUrl: 'ws://localhost:3000/filesystem',
      actorSpace: mockActorSpace,
      verbose: false
    });
  });
  
  afterEach(() => {
    if (resourceManager) {
      resourceManager.destroy();
    }
    jest.clearAllMocks();
  });
  
  describe('Constructor', () => {
    test('should initialize with default options', () => {
      const rm = new ActorRemoteFileSystemResourceManager();
      
      expect(rm.options.wsUrl).toBe('ws://localhost:3000/filesystem');
      expect(rm.options.requestTimeout).toBe(30000);
      expect(rm.options.enableCache).toBe(true);
      expect(rm.options.cacheTTL).toBe(5000);
    });
    
    test('should accept custom options', () => {
      const rm = new ActorRemoteFileSystemResourceManager({
        wsUrl: 'ws://custom:8080/fs',
        requestTimeout: 10000,
        enableCache: false,
        authToken: 'test-token'
      });
      
      expect(rm.options.wsUrl).toBe('ws://custom:8080/fs');
      expect(rm.options.requestTimeout).toBe(10000);
      expect(rm.options.enableCache).toBe(false);
      expect(rm.options.authToken).toBe('test-token');
    });
    
    test('should initialize internal collections', () => {
      expect(resourceManager.pendingRequests).toBeInstanceOf(Map);
      expect(resourceManager.subscriptions).toBeInstanceOf(Map);
      expect(resourceManager.metadataCache).toBeInstanceOf(Map);
      expect(resourceManager.isConnected).toBe(false);
      expect(resourceManager.isAuthenticated).toBe(false);
    });
    
    test('should create WebSocket connection', () => {
      expect(resourceManager.websocket).toBeInstanceOf(MockWebSocket);
      expect(resourceManager.websocket.url).toBe('ws://localhost:3000/filesystem');
    });
    
    test('should create bridge actor', () => {
      expect(resourceManager.bridgeActor).toBeDefined();
      expect(resourceManager.bridgeActor.websocket).toBe(resourceManager.websocket);
      expect(resourceManager.bridgeActor.name).toBe('FileSystemBridge');
    });
  });
  
  describe('Connection Handling', () => {
    test('should handle WebSocket connection', async () => {
      const connectPromise = new Promise(resolve => {
        resourceManager.once('connected', resolve);
      });
      
      // Wait for connection event
      await connectPromise;
      
      expect(resourceManager.isConnected).toBe(true);
    });
    
    test('should handle WebSocket disconnection', async () => {
      // First connect
      await new Promise(resolve => {
        resourceManager.once('connected', resolve);
      });
      
      const disconnectPromise = new Promise(resolve => {
        resourceManager.once('disconnected', resolve);
      });
      
      // Simulate disconnection
      resourceManager.websocket.close();
      
      await disconnectPromise;
      
      expect(resourceManager.isConnected).toBe(false);
      expect(resourceManager.isAuthenticated).toBe(false);
    });
    
    test('should authenticate when token provided', async () => {
      const rmWithAuth = new ActorRemoteFileSystemResourceManager({
        wsUrl: 'ws://localhost:3000/filesystem',
        authToken: 'test-token',
        actorSpace: mockActorSpace
      });
      
      // Mock authentication response
      const authenticateSpy = jest.spyOn(rmWithAuth, '_authenticate');
      
      // Wait for connection
      await new Promise(resolve => {
        rmWithAuth.once('connected', resolve);
      });
      
      expect(authenticateSpy).toHaveBeenCalled();
      
      rmWithAuth.destroy();
    });
  });
  
  describe('Query Interface', () => {
    beforeEach(async () => {
      // Wait for connection
      await new Promise(resolve => {
        resourceManager.once('connected', resolve);
      });
    });
    
    test('should implement queryBuilder method', () => {
      const builder = resourceManager.queryBuilder(null);
      
      expect(builder).toBeDefined();
      expect(typeof builder.query).toBe('function');
    });
    
    test('should execute synchronous queries', () => {
      const querySpec = {
        find: [],
        where: [['file', '/test.txt', 'metadata']]
      };
      
      // Mock the async response to resolve immediately
      const mockResponse = jest.fn(() => {
        // Clear pending requests immediately to avoid busy wait
        resourceManager.pendingRequests.clear();
        return Promise.resolve({ results: [{ path: '/test.txt', type: 'file' }] });
      });
      
      resourceManager._sendActorMessage = mockResponse;
      
      const result = resourceManager.query(querySpec);
      
      expect(mockResponse).toHaveBeenCalledWith({
        type: 'filesystemQuery',
        payload: { querySpec }
      });
    });
    
    test('should validate query specification', () => {
      expect(() => {
        resourceManager.query(null);
      }).toThrow('Query specification is required');
      
      expect(() => {
        resourceManager.query('invalid');
      }).toThrow('Query specification is required');
    });
    
    test('should handle query timeout', () => {
      const slowResourceManager = new ActorRemoteFileSystemResourceManager({
        wsUrl: 'ws://localhost:3000/filesystem',
        requestTimeout: 10, // Very short timeout
        actorSpace: mockActorSpace
      });
      
      const querySpec = { find: [], where: [] };
      
      expect(() => {
        slowResourceManager.query(querySpec);
      }).toThrow('Query timeout');
      
      slowResourceManager.destroy();
    });
  });
  
  describe('Update Interface', () => {
    beforeEach(async () => {
      // Wait for connection
      await new Promise(resolve => {
        resourceManager.once('connected', resolve);
      });
    });
    
    test('should execute synchronous updates', () => {
      const mockResponse = jest.fn(() => {
        setTimeout(() => {
          resourceManager.pendingRequests.clear();
        }, 1);
        return Promise.resolve({ success: true, path: '/test.txt' });
      });
      
      resourceManager._sendActorMessage = mockResponse;
      
      const result = resourceManager.update('/test.txt', {
        content: 'Hello World',
        operation: 'write'
      });
      
      expect(mockResponse).toHaveBeenCalledWith({
        type: 'filesystemUpdate',
        payload: {
          path: '/test.txt',
          data: {
            path: '/test.txt',
            content: 'Hello World',
            operation: 'write'
          }
        }
      });
    });
    
    test('should handle binary data in updates', () => {
      const binaryData = new Uint8Array([72, 101, 108, 108, 111]); // "Hello"
      
      const mockResponse = jest.fn(() => {
        setTimeout(() => {
          resourceManager.pendingRequests.clear();
        }, 1);
        return Promise.resolve({ success: true });
      });
      
      resourceManager._sendActorMessage = mockResponse;
      
      const result = resourceManager.update('/binary.dat', {
        content: binaryData,
        operation: 'write'
      });
      
      const callArgs = mockResponse.mock.calls[0][0];
      expect(callArgs.payload.data.encoding).toBe('base64');
      expect(typeof callArgs.payload.data.content).toBe('string');
    });
    
    test('should validate update data', () => {
      expect(() => {
        resourceManager.update('/test.txt', null);
      }).toThrow('Update data is required');
      
      expect(() => {
        resourceManager.update('/test.txt', 'invalid');
      }).toThrow('Update data is required');
    });
    
    test('should handle update timeout', () => {
      const slowResourceManager = new ActorRemoteFileSystemResourceManager({
        wsUrl: 'ws://localhost:3000/filesystem',
        requestTimeout: 10, // Very short timeout
        actorSpace: mockActorSpace
      });
      
      const result = slowResourceManager.update('/test.txt', {
        content: 'content',
        operation: 'write'
      });
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Update timeout');
      
      slowResourceManager.destroy();
    });
  });
  
  describe('Subscription Interface', () => {
    beforeEach(async () => {
      // Wait for connection
      await new Promise(resolve => {
        resourceManager.once('connected', resolve);
      });
    });
    
    test('should create subscriptions', () => {
      const querySpec = {
        find: [],
        where: [['file', '/test.txt', 'change']]
      };
      
      const callback = jest.fn();
      
      const mockResponse = jest.fn(() => Promise.resolve({ success: true }));
      resourceManager._sendActorMessage = mockResponse;
      
      const subscription = resourceManager.subscribe(querySpec, callback);
      
      expect(subscription).toEqual(expect.objectContaining({
        id: expect.stringMatching(/^sub_\d+$/),
        querySpec: querySpec,
        callback: callback,
        unsubscribe: expect.any(Function)
      }));
      
      expect(resourceManager.subscriptions.size).toBe(1);
      expect(mockResponse).toHaveBeenCalledWith({
        type: 'filesystemSubscribe',
        payload: { querySpec, subscriptionId: subscription.id }
      });
    });
    
    test('should unsubscribe', () => {
      const querySpec = { find: [], where: [] };
      const callback = jest.fn();
      
      const mockResponse = jest.fn(() => Promise.resolve({ success: true }));
      resourceManager._sendActorMessage = mockResponse;
      
      const subscription = resourceManager.subscribe(querySpec, callback);
      const subscriptionId = subscription.id;
      
      subscription.unsubscribe();
      
      expect(resourceManager.subscriptions.has(subscriptionId)).toBe(false);
      expect(mockResponse).toHaveBeenCalledWith({
        type: 'filesystemUnsubscribe',
        payload: { subscriptionId }
      });
    });
    
    test('should validate subscription parameters', () => {
      expect(() => {
        resourceManager.subscribe(null, jest.fn());
      }).toThrow('Query specification is required');
      
      expect(() => {
        resourceManager.subscribe({ find: [], where: [] }, null);
      }).toThrow('Callback function is required');
    });
    
    test('should handle file change notifications', () => {
      const callback = jest.fn();
      const querySpec = { find: [], where: [] };
      
      resourceManager._sendActorMessage = jest.fn(() => Promise.resolve({ success: true }));
      
      const subscription = resourceManager.subscribe(querySpec, callback);
      
      // Simulate file change notification
      resourceManager._handleFileChange({
        subscriptionId: subscription.id,
        changes: {
          path: '/test.txt',
          event: 'modified',
          timestamp: '2023-01-01T00:00:00Z'
        }
      });
      
      expect(callback).toHaveBeenCalledWith({
        path: '/test.txt',
        event: 'modified',
        timestamp: '2023-01-01T00:00:00Z'
      });
    });
  });
  
  describe('Schema Interface', () => {
    test('should return schema information', () => {
      const schema = resourceManager.getSchema();
      
      expect(schema).toEqual(expect.objectContaining({
        version: '1.0.0',
        type: 'actor-remote-filesystem',
        provider: 'ActorRemoteFileSystemResourceManager',
        capabilities: expect.objectContaining({
          read: true,
          write: true,
          watch: true,
          search: true,
          streams: true
        }),
        connection: expect.objectContaining({
          wsUrl: 'ws://localhost:3000/filesystem',
          isConnected: expect.any(Boolean),
          isAuthenticated: expect.any(Boolean)
        })
      }));
    });
  });
  
  describe('Caching', () => {
    beforeEach(async () => {
      // Wait for connection
      await new Promise(resolve => {
        resourceManager.once('connected', resolve);
      });
    });
    
    test('should cache metadata queries', () => {
      const testPath = '/test.txt';
      const testData = [{ path: testPath, type: 'file' }];
      
      resourceManager._setCachedMetadata(testPath, testData);
      
      const cached = resourceManager._getCachedMetadata({
        where: [['file', testPath, 'metadata']]
      });
      
      expect(cached).toEqual(testData);
    });
    
    test('should respect cache TTL', async () => {
      const shortTTLResourceManager = new ActorRemoteFileSystemResourceManager({
        wsUrl: 'ws://localhost:3000/filesystem',
        cacheTTL: 10, // Very short TTL
        actorSpace: mockActorSpace
      });
      
      const testPath = '/test.txt';
      const testData = [{ path: testPath, type: 'file' }];
      
      shortTTLResourceManager._setCachedMetadata(testPath, testData);
      
      // Wait for TTL to expire
      await new Promise(resolve => setTimeout(resolve, 20));
      
      const cached = shortTTLResourceManager._getCachedMetadata({
        where: [['file', testPath, 'metadata']]
      });
      
      expect(cached).toBeNull();
      
      shortTTLResourceManager.destroy();
    });
    
    test('should invalidate cache on updates', () => {
      const testPath = '/test.txt';
      const testData = [{ path: testPath, type: 'file' }];
      
      resourceManager._setCachedMetadata(testPath, testData);
      resourceManager._invalidateCache(testPath);
      
      const cached = resourceManager._getCachedMetadata({
        where: [['file', testPath, 'metadata']]
      });
      
      expect(cached).toBeNull();
    });
  });
  
  describe('Actor Message Handling', () => {
    test('should implement receive method', () => {
      expect(typeof resourceManager.receive).toBe('function');
    });
    
    test('should handle response messages', () => {
      const requestId = 'req_123';
      const mockRequest = {
        resolve: jest.fn(),
        reject: jest.fn()
      };
      
      resourceManager.pendingRequests.set(requestId, mockRequest);
      
      resourceManager.receive({
        type: 'filesystemQueryResult',
        payload: { success: true, results: [] },
        requestId: requestId
      });
      
      expect(mockRequest.resolve).toHaveBeenCalledWith({ success: true, results: [] });
      expect(resourceManager.pendingRequests.has(requestId)).toBe(false);
    });
    
    test('should handle error messages', () => {
      const requestId = 'req_456';
      const mockRequest = {
        resolve: jest.fn(),
        reject: jest.fn()
      };
      
      resourceManager.pendingRequests.set(requestId, mockRequest);
      
      resourceManager.receive({
        type: 'filesystemError',
        payload: { error: { message: 'Test error' } },
        requestId: requestId
      });
      
      expect(mockRequest.reject).toHaveBeenCalledWith(new Error('Test error'));
      expect(resourceManager.pendingRequests.has(requestId)).toBe(false);
    });
    
    test('should handle subscription notifications', () => {
      const subscriptionId = 'sub_123';
      const mockCallback = jest.fn();
      
      resourceManager.subscriptions.set(subscriptionId, {
        id: subscriptionId,
        callback: mockCallback
      });
      
      resourceManager.receive({
        type: 'filesystemFileChange',
        payload: {
          subscriptionId: subscriptionId,
          changes: { path: '/test.txt', event: 'modified' }
        }
      });
      
      expect(mockCallback).toHaveBeenCalledWith({ path: '/test.txt', event: 'modified' });
    });
  });
  
  describe('Cleanup', () => {
    test('should clean up resources on destroy', () => {
      const wsCloseSpy = jest.spyOn(resourceManager.websocket, 'close');
      const bridgeDestroySpy = jest.spyOn(resourceManager.bridgeActor, 'destroy');
      
      resourceManager.destroy();
      
      expect(wsCloseSpy).toHaveBeenCalled();
      expect(bridgeDestroySpy).toHaveBeenCalled();
      expect(resourceManager.isConnected).toBe(false);
      expect(resourceManager.subscriptions.size).toBe(0);
      expect(resourceManager.pendingRequests.size).toBe(0);
      expect(resourceManager.metadataCache.size).toBe(0);
    });
  });
  
  describe('Utility Methods', () => {
    test('should convert ArrayBuffer to base64', () => {
      const buffer = new ArrayBuffer(5);
      const view = new Uint8Array(buffer);
      view.set([72, 101, 108, 108, 111]); // "Hello"
      
      const base64 = resourceManager._arrayBufferToBase64(buffer);
      expect(base64).toBe('SGVsbG8=');
    });
    
    test('should convert base64 to ArrayBuffer', () => {
      const base64 = 'SGVsbG8=';
      const buffer = resourceManager._base64ToArrayBuffer(base64);
      const view = new Uint8Array(buffer);
      
      expect(Array.from(view)).toEqual([72, 101, 108, 108, 111]);
    });
    
    test('should extract path from query', () => {
      const querySpec = {
        where: [['file', '/test.txt', 'metadata']]
      };
      
      const path = resourceManager._extractPathFromQuery(querySpec);
      expect(path).toBe('/test.txt');
    });
    
    test('should identify metadata queries', () => {
      const metadataQuery = {
        where: [['file', '/test.txt', 'metadata']]
      };
      
      const contentQuery = {
        where: [['file', '/test.txt', 'content']]
      };
      
      expect(resourceManager._isMetadataQuery(metadataQuery)).toBe(true);
      expect(resourceManager._isMetadataQuery(contentQuery)).toBe(false);
    });
  });
});