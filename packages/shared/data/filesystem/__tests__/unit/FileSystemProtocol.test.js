/**
 * Unit Tests for FileSystemProtocol
 * 
 * Tests the FileSystemProtocol class that implements the Protocol interface
 * for filesystem operations via Actor communication.
 */

import { FileSystemProtocol } from '../../src/protocol/FileSystemProtocol.js';
import { jest } from '@jest/globals';

describe('FileSystemProtocol', () => {
  let protocol;
  
  beforeEach(() => {
    protocol = new FileSystemProtocol();
  });
  
  describe('Constructor', () => {
    test('should initialize with message types', () => {
      expect(protocol.MESSAGE_TYPES).toBeDefined();
      expect(protocol.MESSAGE_TYPES.FS_CONNECT).toBe('fs_connect');
      expect(protocol.MESSAGE_TYPES.FS_QUERY).toBe('fs_query');
      expect(protocol.MESSAGE_TYPES.FS_UPDATE).toBe('fs_update');
      expect(protocol.MESSAGE_TYPES.FS_SUBSCRIBE).toBe('fs_subscribe');
      expect(protocol.MESSAGE_TYPES.FS_UNSUBSCRIBE).toBe('fs_unsubscribe');
    });
  });
  
  describe('Protocol Validation', () => {
    test('should validate filesystem messages', () => {
      const validMessage = {
        type: 'fs_query',
        query: { find: [], where: [] },
        requestId: 'req_123'
      };
      
      expect(() => protocol.validate(validMessage)).not.toThrow();
    });
    
    test('should reject invalid message types', () => {
      const invalidMessage = {
        type: 'invalid_type',
        requestId: 'req_123'
      };
      
      expect(() => protocol.validate(invalidMessage)).toThrow('Invalid message type');
    });
    
    test('should require requestId for most operations', () => {
      const messageWithoutId = {
        type: 'fs_query',
        query: { find: [], where: [] }
      };
      
      expect(() => protocol.validate(messageWithoutId)).toThrow('Request ID is required');
    });
    
    test('should validate query structure for fs_query', () => {
      const invalidQuery = {
        type: 'fs_query',
        requestId: 'req_123',
        query: 'invalid'
      };
      
      expect(() => protocol.validate(invalidQuery)).toThrow('Query must be an object');
    });
    
    test('should validate update data for fs_update', () => {
      const invalidUpdate = {
        type: 'fs_update',
        requestId: 'req_123'
        // Missing path and data
      };
      
      expect(() => protocol.validate(invalidUpdate)).toThrow('Path and data are required');
    });
  });
  
  describe('Actor to Protocol Transformation', () => {
    test('should transform filesystemConnect message', () => {
      const actorMessage = {
        type: 'filesystemConnect',
        payload: { authToken: 'test-token' },
        requestId: 'req_123'
      };
      
      const protocolMessage = protocol.actorToProtocol(actorMessage);
      
      expect(protocolMessage).toEqual({
        type: 'fs_connect',
        authToken: 'test-token',
        requestId: 'req_123'
      });
    });
    
    test('should transform filesystemQuery message', () => {
      const actorMessage = {
        type: 'filesystemQuery',
        payload: { 
          querySpec: { find: [], where: [['file', '/test.txt', 'metadata']] }
        },
        requestId: 'req_456'
      };
      
      const protocolMessage = protocol.actorToProtocol(actorMessage);
      
      expect(protocolMessage).toEqual({
        type: 'fs_query',
        query: { find: [], where: [['file', '/test.txt', 'metadata']] },
        requestId: 'req_456'
      });
    });
    
    test('should transform filesystemUpdate message', () => {
      const actorMessage = {
        type: 'filesystemUpdate',
        payload: { 
          path: '/test.txt',
          data: { content: 'Hello World', operation: 'write' }
        },
        requestId: 'req_789'
      };
      
      const protocolMessage = protocol.actorToProtocol(actorMessage);
      
      expect(protocolMessage).toEqual({
        type: 'fs_update',
        path: '/test.txt',
        data: { content: 'Hello World', operation: 'write' },
        requestId: 'req_789'
      });
    });
    
    test('should transform filesystemSubscribe message', () => {
      const actorMessage = {
        type: 'filesystemSubscribe',
        payload: { 
          querySpec: { find: [], where: [['file', '/test.txt', 'change']] },
          subscriptionId: 'sub_123'
        }
      };
      
      const protocolMessage = protocol.actorToProtocol(actorMessage);
      
      expect(protocolMessage).toEqual({
        type: 'fs_subscribe',
        query: { find: [], where: [['file', '/test.txt', 'change']] },
        subscriptionId: 'sub_123'
      });
    });
    
    test('should transform filesystemUnsubscribe message', () => {
      const actorMessage = {
        type: 'filesystemUnsubscribe',
        payload: { subscriptionId: 'sub_123' }
      };
      
      const protocolMessage = protocol.actorToProtocol(actorMessage);
      
      expect(protocolMessage).toEqual({
        type: 'fs_unsubscribe',
        subscriptionId: 'sub_123'
      });
    });
    
    test('should generate requestId if not provided', () => {
      const actorMessage = {
        type: 'filesystemQuery',
        payload: { querySpec: { find: [], where: [] } }
      };
      
      const protocolMessage = protocol.actorToProtocol(actorMessage);
      
      expect(protocolMessage.requestId).toMatch(/^req_\d+$/);
    });
    
    test('should throw error for unknown actor message type', () => {
      const invalidMessage = {
        type: 'unknownType',
        payload: {}
      };
      
      expect(() => protocol.actorToProtocol(invalidMessage))
        .toThrow('Unknown actor message type: unknownType');
    });
  });
  
  describe('Protocol to Actor Transformation', () => {
    test('should transform fs_connect_response message', () => {
      const protocolMessage = {
        type: 'fs_connect_response',
        success: true,
        sessionId: 'session_123',
        capabilities: { read: true, write: true },
        requestId: 'req_123'
      };
      
      const actorMessage = protocol.protocolToActor(protocolMessage);
      
      expect(actorMessage).toEqual({
        type: 'filesystemConnected',
        payload: {
          success: true,
          sessionId: 'session_123',
          capabilities: { read: true, write: true }
        },
        requestId: 'req_123'
      });
    });
    
    test('should transform fs_query_response message', () => {
      const protocolMessage = {
        type: 'fs_query_response',
        success: true,
        results: [{ path: '/test.txt', type: 'file' }],
        requestId: 'req_456'
      };
      
      const actorMessage = protocol.protocolToActor(protocolMessage);
      
      expect(actorMessage).toEqual({
        type: 'filesystemQueryResult',
        payload: {
          success: true,
          results: [{ path: '/test.txt', type: 'file' }]
        },
        requestId: 'req_456'
      });
    });
    
    test('should transform fs_update_response message', () => {
      const protocolMessage = {
        type: 'fs_update_response',
        success: true,
        path: '/test.txt',
        requestId: 'req_789'
      };
      
      const actorMessage = protocol.protocolToActor(protocolMessage);
      
      expect(actorMessage).toEqual({
        type: 'filesystemUpdateResult',
        payload: {
          success: true,
          path: '/test.txt'
        },
        requestId: 'req_789'
      });
    });
    
    test('should transform fs_file_change message', () => {
      const protocolMessage = {
        type: 'fs_file_change',
        subscriptionId: 'sub_123',
        changes: {
          path: '/test.txt',
          event: 'modified',
          timestamp: '2023-01-01T00:00:00Z'
        }
      };
      
      const actorMessage = protocol.protocolToActor(protocolMessage);
      
      expect(actorMessage).toEqual({
        type: 'filesystemFileChange',
        payload: {
          subscriptionId: 'sub_123',
          changes: {
            path: '/test.txt',
            event: 'modified',
            timestamp: '2023-01-01T00:00:00Z'
          }
        }
      });
    });
    
    test('should transform error messages', () => {
      const protocolMessage = {
        type: 'fs_error',
        error: {
          message: 'File not found',
          code: 'ENOENT'
        },
        requestId: 'req_123'
      };
      
      const actorMessage = protocol.protocolToActor(protocolMessage);
      
      expect(actorMessage).toEqual({
        type: 'filesystemError',
        payload: {
          error: {
            message: 'File not found',
            code: 'ENOENT'
          }
        },
        requestId: 'req_123'
      });
    });
    
    test('should throw error for unknown protocol message type', () => {
      const invalidMessage = {
        type: 'unknown_type',
        requestId: 'req_123'
      };
      
      expect(() => protocol.protocolToActor(invalidMessage))
        .toThrow('Unknown protocol message type: unknown_type');
    });
  });
  
  describe('Bidirectional Transformation', () => {
    test('should maintain consistency through round-trip transformation', () => {
      const originalActor = {
        type: 'filesystemQuery',
        payload: { 
          querySpec: { find: [], where: [['file', '/test.txt', 'metadata']] }
        },
        requestId: 'req_123'
      };
      
      // Actor -> Protocol
      const protocolMessage = protocol.actorToProtocol(originalActor);
      
      // Simulate server response
      const responseProtocol = {
        type: 'fs_query_response',
        success: true,
        results: [{ path: '/test.txt', type: 'file' }],
        requestId: protocolMessage.requestId
      };
      
      // Protocol -> Actor
      const responseActor = protocol.protocolToActor(responseProtocol);
      
      expect(responseActor.requestId).toBe(originalActor.requestId);
      expect(responseActor.type).toBe('filesystemQueryResult');
      expect(responseActor.payload.success).toBe(true);
    });
  });
  
  describe('Binary Data Handling', () => {
    test('should handle binary content in update messages', () => {
      const binaryData = new Uint8Array([72, 101, 108, 108, 111]); // "Hello"
      
      const actorMessage = {
        type: 'filesystemUpdate',
        payload: {
          path: '/binary.dat',
          data: { content: binaryData, encoding: 'binary' }
        },
        requestId: 'req_binary'
      };
      
      const protocolMessage = protocol.actorToProtocol(actorMessage);
      
      expect(protocolMessage.type).toBe('fs_update');
      expect(protocolMessage.data.content).toBe(binaryData);
      expect(protocolMessage.data.encoding).toBe('binary');
    });
  });
});