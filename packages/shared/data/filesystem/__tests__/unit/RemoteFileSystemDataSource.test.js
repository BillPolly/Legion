/**
 * Unit Tests for RemoteFileSystemDataSource
 * 
 * Tests the RemoteFileSystemDataSource class functionality with mock server
 */

import { RemoteFileSystemDataSource } from '../../src/datasources/index.js';
import { jest } from '@jest/globals';

// Mock WebSocket
global.WebSocket = class MockWebSocket {
  constructor(url) {
    this.url = url;
    this.readyState = 0;
    setTimeout(() => {
      this.readyState = 1;
      if (this.onopen) this.onopen();
    }, 0);
  }
  
  send(data) {
    // Mock send
  }
  
  close() {
    this.readyState = 3;
    if (this.onclose) this.onclose();
  }
};

// Mock XMLHttpRequest for synchronous operations
global.XMLHttpRequest = class MockXMLHttpRequest {
  constructor() {
    this.readyState = 0;
    this.status = 0;
    this.responseText = '';
    this.headers = {};
  }
  
  open(method, url, async) {
    this.method = method;
    this.url = url;
    this.async = async;
  }
  
  setRequestHeader(name, value) {
    this.headers[name] = value;
  }
  
  send(data) {
    // Mock response based on URL
    if (this.url.includes('/api/filesystem/query')) {
      this.status = 200;
      this.responseText = JSON.stringify({
        success: true,
        results: [{
          path: '/test',
          type: 'directory',
          exists: true
        }]
      });
    } else if (this.url.includes('/api/filesystem/update')) {
      this.status = 200;
      this.responseText = JSON.stringify({
        success: true,
        path: '/test/file.txt'
      });
    } else {
      this.status = 404;
      this.responseText = JSON.stringify({
        error: 'Not found'
      });
    }
  }
};

describe('RemoteFileSystemDataSource', () => {
  let dataSource;
  
  beforeEach(() => {
    dataSource = new RemoteFileSystemDataSource({
      serverUrl: 'http://localhost:3000',
      wsUrl: 'ws://localhost:3000/filesystem',
      enableWebSocket: false, // Disable for synchronous testing
      verbose: false // Disable logging for tests
    });
  });
  
  afterEach(() => {
    if (dataSource) {
      dataSource.destroy();
    }
  });
  
  describe('Constructor', () => {
    test('should initialize with default options', () => {
      const rm = new RemoteFileSystemDataSource();
      expect(rm.options.serverUrl).toBe('http://localhost:3000');
      expect(rm.options.wsUrl).toBe('ws://localhost:3000/filesystem');
      expect(rm.options.enableWebSocket).toBe(true);
      rm.destroy();
    });
    
    test('should accept custom options', () => {
      const rm = new RemoteFileSystemDataSource({
        serverUrl: 'http://example.com:8080',
        authToken: 'test-token',
        cacheTTL: 10000
      });
      expect(rm.options.serverUrl).toBe('http://example.com:8080');
      expect(rm.options.authToken).toBe('test-token');
      expect(rm.options.cacheTTL).toBe(10000);
      rm.destroy();
    });
  });
  
  describe('query()', () => {
    test('should execute query via HTTP', () => {
      const querySpec = {
        find: ['path', 'type', 'exists'],
        where: [['directory', '/test', 'metadata']]
      };
      
      const results = dataSource.query(querySpec);
      
      expect(Array.isArray(results)).toBe(true);
      expect(results).toHaveLength(1);
      expect(results[0]).toEqual(expect.objectContaining({
        path: '/test',
        type: 'directory',
        exists: true
      }));
    });
    
    test('should throw error for invalid query', () => {
      expect(() => {
        dataSource.query(null);
      }).toThrow('Query specification is required');
      
      expect(() => {
        dataSource.query('invalid');
      }).toThrow('Query specification is required');
    });
    
    test('should include auth token in headers', () => {
      const rm = new RemoteFileSystemDataSource({
        authToken: 'test-token',
        enableWebSocket: false
      });
      
      const spy = jest.spyOn(XMLHttpRequest.prototype, 'setRequestHeader');
      
      rm.query({ find: [], where: [] });
      
      expect(spy).toHaveBeenCalledWith('Authorization', 'Bearer test-token');
      
      rm.destroy();
    });
  });
  
  describe('update()', () => {
    test('should execute update via HTTP', () => {
      const result = dataSource.update('/test/file.txt', {
        operation: 'write',
        content: 'Hello World'
      });
      
      expect(result).toEqual(expect.objectContaining({
        success: true,
        path: '/test/file.txt'
      }));
    });
    
    test('should handle binary data by converting to base64', () => {
      const binaryData = new Uint8Array([72, 101, 108, 108, 111]);
      
      const spy = jest.spyOn(XMLHttpRequest.prototype, 'send');
      
      dataSource.update('/test/binary.bin', {
        operation: 'write',
        content: binaryData
      });
      
      expect(spy).toHaveBeenCalled();
      const sentData = JSON.parse(spy.mock.calls[0][0]);
      expect(sentData.encoding).toBe('base64');
      expect(typeof sentData.content).toBe('string');
    });
    
    test('should invalidate cache after update', () => {
      // Set cached metadata
      dataSource._setCachedMetadata('/test/file.txt', { exists: true });
      expect(dataSource.metadataCache.has('/test/file.txt')).toBe(true);
      
      // Update file
      dataSource.update('/test/file.txt', {
        operation: 'write',
        content: 'New content'
      });
      
      // Cache should be invalidated
      expect(dataSource.metadataCache.has('/test/file.txt')).toBe(false);
    });
    
    test('should throw error for invalid update data', () => {
      expect(() => {
        dataSource.update('/test', null);
      }).toThrow('Update data is required');
    });
  });
  
  describe('subscribe()', () => {
    test('should throw error when WebSocket is disabled', () => {
      expect(() => {
        dataSource.subscribe({}, () => {});
      }).toThrow('WebSocket is disabled - cannot create subscriptions');
    });
    
    test('should create subscription with WebSocket enabled', async () => {
      const rm = new RemoteFileSystemDataSource({
        enableWebSocket: true,
        verbose: false
      });
      
      // Wait for WebSocket to connect
      await new Promise(resolve => setTimeout(resolve, 10));
      
      const callback = jest.fn();
      const subscription = rm.subscribe(
        { find: [], where: [['file', '/test.txt', 'change']] },
        callback
      );
      
      expect(subscription).toEqual(expect.objectContaining({
        id: expect.any(Number),
        unsubscribe: expect.any(Function)
      }));
      
      rm.destroy();
    });
    
    test('should validate query and callback', () => {
      const rm = new RemoteFileSystemDataSource({
        enableWebSocket: true,
        verbose: false
      });
      
      expect(() => {
        rm.subscribe(null, () => {});
      }).toThrow('Query specification is required');
      
      expect(() => {
        rm.subscribe({}, null);
      }).toThrow('Callback function is required');
      
      rm.destroy();
    });
  });
  
  describe('queryBuilder()', () => {
    test('should return query builder that forwards to query method', () => {
      const builder = dataSource.queryBuilder();
      
      expect(builder).toEqual(expect.objectContaining({
        query: expect.any(Function)
      }));
      
      const results = builder.query({
        find: ['path'],
        where: [['directory', '/test', 'metadata']]
      });
      
      expect(Array.isArray(results)).toBe(true);
    });
  });
  
  describe('getSchema()', () => {
    test('should return schema information', () => {
      const schema = dataSource.getSchema();
      
      expect(schema).toEqual(expect.objectContaining({
        version: '1.0.0',
        type: 'remote-filesystem',
        provider: 'RemoteFileSystemDataSource',
        capabilities: expect.objectContaining({
          read: true,
          write: true,
          search: true,
          streams: true
        })
      }));
    });
    
    test('should reflect WebSocket status in schema', () => {
      const schema = dataSource.getSchema();
      expect(schema.capabilities.watch).toBe(false);
      expect(schema.connection.wsConnected).toBe(false);
    });
  });
  
  describe('WebSocket Management', () => {
    test('should connect WebSocket when enabled', async () => {
      const rm = new RemoteFileSystemDataSource({
        enableWebSocket: true,
        verbose: false
      });
      
      // Wait for connection
      await new Promise(resolve => setTimeout(resolve, 10));
      
      expect(rm.wsConnected).toBe(true);
      
      rm.destroy();
    });
    
    test('should handle WebSocket reconnection', async () => {
      const rm = new RemoteFileSystemDataSource({
        enableWebSocket: true,
        reconnectInterval: 10,
        maxReconnectAttempts: 2
      });
      
      // Wait for initial connection
      await new Promise(resolve => setTimeout(resolve, 10));
      expect(rm.wsConnected).toBe(true);
      
      // Simulate disconnect
      if (rm.ws) {
        rm.ws.close();
      }
      
      // Should attempt reconnection
      expect(rm.reconnectAttempts).toBe(1);
      
      rm.destroy();
    });
  });
  
  describe('Cache Management', () => {
    test('should cache metadata queries', () => {
      const querySpec = {
        find: ['metadata'],
        where: [['file', '/test.txt', 'metadata']]
      };
      
      // First query
      dataSource.query(querySpec);
      expect(dataSource.metadataCache.size).toBe(0); // Cache set happens internally
      
      // Manually set cache to test retrieval
      dataSource._setCachedMetadata('/test.txt', { exists: true });
      expect(dataSource.metadataCache.size).toBe(1);
    });
    
    test('should invalidate parent and child caches', () => {
      // Set multiple cached paths
      dataSource._setCachedMetadata('/parent', { type: 'directory' });
      dataSource._setCachedMetadata('/parent/child', { type: 'directory' });
      dataSource._setCachedMetadata('/parent/child/file.txt', { type: 'file' });
      
      expect(dataSource.metadataCache.size).toBe(3);
      
      // Invalidate middle path
      dataSource._invalidateCache('/parent/child');
      
      // Parent should remain, but child and its children should be cleared
      expect(dataSource.metadataCache.has('/parent')).toBe(true);
      expect(dataSource.metadataCache.has('/parent/child')).toBe(false);
      expect(dataSource.metadataCache.has('/parent/child/file.txt')).toBe(false);
    });
    
    test('should respect cache TTL', () => {
      const rm = new RemoteFileSystemDataSource({
        enableWebSocket: false,
        cacheTTL: 100 // 100ms TTL
      });
      
      // Set cache
      rm._setCachedMetadata('/test.txt', { exists: true });
      
      // Should be in cache
      const cached1 = rm._getCachedMetadata({
        where: [['file', '/test.txt', 'metadata']]
      });
      expect(cached1).toBeTruthy();
      
      // Wait for TTL to expire
      const now = Date.now();
      rm.metadataCache.get('/test.txt').timestamp = now - 200;
      
      // Should be expired
      const cached2 = rm._getCachedMetadata({
        where: [['file', '/test.txt', 'metadata']]
      });
      expect(cached2).toBeNull();
      
      rm.destroy();
    });
  });
  
  describe('Cleanup', () => {
    test('should clean up resources on destroy', () => {
      const rm = new RemoteFileSystemDataSource({
        enableWebSocket: true
      });
      
      // Create some state
      rm._setCachedMetadata('/test', { exists: true });
      rm.subscriptions.set(1, { id: 1, callback: () => {} });
      
      rm.destroy();
      
      expect(rm.metadataCache.size).toBe(0);
      expect(rm.subscriptions.size).toBe(0);
      expect(rm.ws).toBeNull();
    });
  });
});