/**
 * RemoteHandle.callRemote.test.js
 *
 * Unit tests for RemoteHandle._callRemote() method
 *
 * Phase 5, Step 5.7-5.8: Test remote call mechanism
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { RemoteHandle } from '../RemoteHandle.js';

describe('RemoteHandle._callRemote()', () => {
  let remoteHandle;
  let mockChannel;
  let sentMessages;

  beforeEach(() => {
    sentMessages = [];

    // Mock channel that records sent messages
    mockChannel = {
      send: jest.fn((guid, message) => {
        sentMessages.push({ guid, message });
      })
    };

    // Create RemoteHandle with mock channel
    remoteHandle = new RemoteHandle('server-guid-123', mockChannel, {
      handleType: 'TestHandle',
      schema: { attributes: {} },
      capabilities: ['query']
    });
  });

  describe('Call ID Generation', () => {
    it('should generate unique call ID for each remote call', () => {
      const promise1 = remoteHandle._callRemote('query', { test: 1 });
      const promise2 = remoteHandle._callRemote('query', { test: 2 });

      expect(sentMessages.length).toBe(2);
      expect(sentMessages[0].message.callId).toBeDefined();
      expect(sentMessages[1].message.callId).toBeDefined();
      expect(sentMessages[0].message.callId).not.toBe(sentMessages[1].message.callId);
    });
  });

  describe('Message Creation', () => {
    it('should create proper remote-call message', () => {
      remoteHandle._callRemote('query', { find: ['?value'] });

      expect(sentMessages.length).toBe(1);
      expect(sentMessages[0].message).toMatchObject({
        type: 'remote-call',
        callId: expect.any(String),
        method: 'query',
        args: [{ find: ['?value'] }]
      });
    });

    it('should send message to correct Actor GUID', () => {
      remoteHandle._callRemote('query', {});

      expect(sentMessages[0].guid).toBe('server-guid-123');
    });

    it('should include all arguments in message', () => {
      remoteHandle._callRemote('update', { set: { name: 'test' } }, { where: { id: 1 } });

      expect(sentMessages[0].message.args).toEqual([
        { set: { name: 'test' } },
        { where: { id: 1 } }
      ]);
    });
  });

  describe('Promise Return', () => {
    it('should return a promise', () => {
      const result = remoteHandle._callRemote('query', {});

      expect(result).toBeInstanceOf(Promise);
    });

    it('should create pending call in call manager', () => {
      const promise = remoteHandle._callRemote('query', {});
      const callId = sentMessages[0].message.callId;

      expect(remoteHandle._callManager.hasPendingCall(callId)).toBe(true);
    });
  });

  describe('Response Handling', () => {
    it('should resolve promise when _handleResponse called with result', async () => {
      const promise = remoteHandle._callRemote('query', {});
      const callId = sentMessages[0].message.callId;

      const result = [{ id: 1, name: 'test' }];
      remoteHandle._handleResponse({ callId, result });

      const resolved = await promise;
      expect(resolved).toEqual(result);
    });

    it('should reject promise when _handleResponse called with error', async () => {
      const promise = remoteHandle._callRemote('query', {});
      const callId = sentMessages[0].message.callId;

      remoteHandle._handleResponse({ callId, error: 'Query failed' });

      await expect(promise).rejects.toThrow('Query failed');
    });

    it('should cleanup call after successful response', async () => {
      const promise = remoteHandle._callRemote('query', {});
      const callId = sentMessages[0].message.callId;

      remoteHandle._handleResponse({ callId, result: [] });
      await promise;

      expect(remoteHandle._callManager.hasPendingCall(callId)).toBe(false);
    });

    it('should cleanup call after error response', async () => {
      const promise = remoteHandle._callRemote('query', {});
      const callId = sentMessages[0].message.callId;

      remoteHandle._handleResponse({ callId, error: 'failed' });

      try {
        await promise;
      } catch (e) {
        // Expected
      }

      expect(remoteHandle._callManager.hasPendingCall(callId)).toBe(false);
    });
  });

  describe('Channel Integration', () => {
    it('should call channel.send with correct parameters', () => {
      remoteHandle._callRemote('query', { test: true });

      expect(mockChannel.send).toHaveBeenCalledTimes(1);
      expect(mockChannel.send).toHaveBeenCalledWith(
        'server-guid-123',
        expect.objectContaining({
          type: 'remote-call',
          method: 'query',
          args: [{ test: true }]
        })
      );
    });
  });

  describe('Multiple Concurrent Calls', () => {
    it('should handle multiple concurrent remote calls', async () => {
      const promise1 = remoteHandle._callRemote('query', { query: 1 });
      const promise2 = remoteHandle._callRemote('query', { query: 2 });
      const promise3 = remoteHandle._callRemote('update', { data: 3 });

      expect(sentMessages.length).toBe(3);

      const callId1 = sentMessages[0].message.callId;
      const callId2 = sentMessages[1].message.callId;
      const callId3 = sentMessages[2].message.callId;

      remoteHandle._handleResponse({ callId: callId1, result: 'result1' });
      remoteHandle._handleResponse({ callId: callId2, result: 'result2' });
      remoteHandle._handleResponse({ callId: callId3, result: 'result3' });

      const results = await Promise.all([promise1, promise2, promise3]);

      expect(results).toEqual(['result1', 'result2', 'result3']);
    });
  });

  describe('query() Method Integration', () => {
    it('should use _callRemote() for query calls', () => {
      const querySpec = { find: ['?value'], where: [] };
      remoteHandle.query(querySpec);

      expect(sentMessages.length).toBe(1);
      expect(sentMessages[0].message).toMatchObject({
        type: 'remote-call',
        method: 'query',
        args: [querySpec]
      });
    });

    it('should return promise from query()', () => {
      const result = remoteHandle.query({ find: ['?value'] });

      expect(result).toBeInstanceOf(Promise);
    });
  });
});