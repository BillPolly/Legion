/**
 * Tests for Actor Protocol Handler
 */

import { jest } from '@jest/globals';
import { ActorProtocolHandler } from './ActorProtocolHandler.js';

describe('ActorProtocolHandler', () => {
  let handler;
  let mockActorHost;

  beforeEach(() => {
    handler = new ActorProtocolHandler();
    mockActorHost = {
      getActor: jest.fn(),
      createActor: jest.fn(),
      removeActor: jest.fn()
    };
  });

  describe('Message Parsing and Validation', () => {
    test('should parse valid request messages', async () => {
      const message = {
        type: 'request',
        id: 'req-123',
        actor: 'CollectionActor',
        method: 'find',
        params: { collection: 'users' }
      };

      const mockActor = {
        receive: jest.fn().mockResolvedValue([{ id: 1 }])
      };
      mockActorHost.getActor.mockReturnValue(mockActor);

      const response = await handler.processMessage(message, mockActorHost);
      
      expect(response.type).toBe('response');
      expect(response.id).toBe('req-123');
      expect(response.success).toBe(true);
    });

    test('should reject messages without type', async () => {
      const message = {
        id: 'req-123',
        actor: 'CollectionActor'
      };

      await expect(handler.processMessage(message, mockActorHost))
        .rejects.toThrow('Invalid message: missing type');
    });

    test('should reject requests without id', async () => {
      const message = {
        type: 'request',
        actor: 'CollectionActor',
        method: 'find'
      };

      await expect(handler.processMessage(message, mockActorHost))
        .rejects.toThrow('Invalid request: missing id');
    });

    test('should reject requests without actor', async () => {
      const message = {
        type: 'request',
        id: 'req-123',
        method: 'find'
      };

      await expect(handler.processMessage(message, mockActorHost))
        .rejects.toThrow('Invalid request: missing actor');
    });

    test('should reject requests without method', async () => {
      const message = {
        type: 'request',
        id: 'req-123',
        actor: 'CollectionActor'
      };

      await expect(handler.processMessage(message, mockActorHost))
        .rejects.toThrow('Invalid request: missing method');
    });
  });

  describe('Request/Response Correlation', () => {
    test('should maintain request id in response', async () => {
      const message = {
        type: 'request',
        id: 'unique-req-id',
        actor: 'CollectionActor',
        method: 'count',
        params: {}
      };

      const mockActor = {
        receive: jest.fn().mockResolvedValue(42)
      };
      mockActorHost.getActor.mockReturnValue(mockActor);

      const response = await handler.processMessage(message, mockActorHost);
      expect(response.id).toBe('unique-req-id');
    });

    test('should handle concurrent requests with different ids', async () => {
      const mockActor = {
        receive: jest.fn()
          .mockResolvedValueOnce('result1')
          .mockResolvedValueOnce('result2')
      };
      mockActorHost.getActor.mockReturnValue(mockActor);

      const message1 = {
        type: 'request',
        id: 'req-1',
        actor: 'CollectionActor',
        method: 'find',
        params: {}
      };

      const message2 = {
        type: 'request',
        id: 'req-2',
        actor: 'CollectionActor',
        method: 'find',
        params: {}
      };

      const [response1, response2] = await Promise.all([
        handler.processMessage(message1, mockActorHost),
        handler.processMessage(message2, mockActorHost)
      ]);

      expect(response1.id).toBe('req-1');
      expect(response1.data).toBe('result1');
      expect(response2.id).toBe('req-2');
      expect(response2.data).toBe('result2');
    });
  });

  describe('Error Message Formatting', () => {
    test('should format error responses correctly', async () => {
      const message = {
        type: 'request',
        id: 'req-123',
        actor: 'CollectionActor',
        method: 'find',
        params: {}
      };

      const mockError = new Error('Database connection failed');
      const mockActor = {
        receive: jest.fn().mockRejectedValue(mockError)
      };
      mockActorHost.getActor.mockReturnValue(mockActor);

      const response = await handler.processMessage(message, mockActorHost);
      
      expect(response.type).toBe('response');
      expect(response.id).toBe('req-123');
      expect(response.success).toBe(false);
      expect(response.error).toEqual({
        message: 'Database connection failed',
        code: 'ACTOR_ERROR'
      });
    });

    test('should handle actor not found errors', async () => {
      const message = {
        type: 'request',
        id: 'req-123',
        actor: 'NonExistentActor',
        method: 'find',
        params: {}
      };

      mockActorHost.getActor.mockReturnValue(null);

      const response = await handler.processMessage(message, mockActorHost);
      
      expect(response.success).toBe(false);
      expect(response.error.code).toBe('ACTOR_NOT_FOUND');
      expect(response.error.message).toContain('NonExistentActor');
    });

    test('should handle invalid method errors', async () => {
      const message = {
        type: 'request',
        id: 'req-123',
        actor: 'CollectionActor',
        method: 'invalidMethod',
        params: {}
      };

      const mockActor = {
        receive: jest.fn().mockRejectedValue(new Error('Method not found'))
      };
      mockActorHost.getActor.mockReturnValue(mockActor);

      const response = await handler.processMessage(message, mockActorHost);
      
      expect(response.success).toBe(false);
      expect(response.error.message).toContain('Method not found');
    });
  });

  describe('Message Type Handling', () => {
    test('should handle subscription messages', async () => {
      const message = {
        type: 'subscribe',
        id: 'sub-123',
        actor: 'CollectionActor',
        event: 'change'
      };

      const response = await handler.processMessage(message, mockActorHost);
      
      expect(response.type).toBe('response');
      expect(response.id).toBe('sub-123');
      expect(response.success).toBe(true);
      expect(response.data).toEqual({ subscribed: true });
    });

    test('should handle unsubscribe messages', async () => {
      const message = {
        type: 'unsubscribe',
        id: 'unsub-123',
        subscriptionId: 'sub-123'
      };

      const response = await handler.processMessage(message, mockActorHost);
      
      expect(response.type).toBe('response');
      expect(response.id).toBe('unsub-123');
      expect(response.success).toBe(true);
      expect(response.data).toEqual({ unsubscribed: true });
    });

    test('should reject unknown message types', async () => {
      const message = {
        type: 'unknown',
        id: 'req-123'
      };

      await expect(handler.processMessage(message, mockActorHost))
        .rejects.toThrow('Unknown message type: unknown');
    });
  });

  describe('Protocol Compliance', () => {
    test('should include timestamp in all responses', async () => {
      const message = {
        type: 'request',
        id: 'req-123',
        actor: 'CollectionActor',
        method: 'find',
        params: {}
      };

      const mockActor = {
        receive: jest.fn().mockResolvedValue([])
      };
      mockActorHost.getActor.mockReturnValue(mockActor);

      const response = await handler.processMessage(message, mockActorHost);
      
      expect(response.timestamp).toBeDefined();
      expect(typeof response.timestamp).toBe('number');
    });

    test('should follow Actor system message format', async () => {
      const message = {
        type: 'request',
        id: 'req-123',
        actor: 'CollectionActor',
        method: 'find',
        params: { collection: 'users' }
      };

      const mockActor = {
        receive: jest.fn().mockResolvedValue([])
      };
      mockActorHost.getActor.mockReturnValue(mockActor);

      await handler.processMessage(message, mockActorHost);
      
      expect(mockActor.receive).toHaveBeenCalledWith('find', { collection: 'users' });
    });
  });
});