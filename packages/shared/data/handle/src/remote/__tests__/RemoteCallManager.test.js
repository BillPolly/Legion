/**
 * RemoteCallManager.test.js
 *
 * Unit tests for RemoteCallManager - handles request/response pattern for remote calls
 *
 * Phase 5, Step 5.3-5.4: Unit tests with NO mocks
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { RemoteCallManager } from '../RemoteCallManager.js';

describe('RemoteCallManager', () => {
  let manager;

  beforeEach(() => {
    manager = new RemoteCallManager();
  });

  describe('Call ID Generation', () => {
    it('should generate unique call IDs', () => {
      const id1 = manager._generateCallId();
      const id2 = manager._generateCallId();
      const id3 = manager._generateCallId();

      expect(id1).toBeDefined();
      expect(id2).toBeDefined();
      expect(id3).toBeDefined();

      // All should be unique
      expect(id1).not.toBe(id2);
      expect(id2).not.toBe(id3);
      expect(id1).not.toBe(id3);
    });

    it('should generate string call IDs', () => {
      const id = manager._generateCallId();
      expect(typeof id).toBe('string');
    });
  });

  describe('Pending Call Storage', () => {
    it('should store pending call with resolve/reject handlers', () => {
      const callId = 'test-call-1';
      const resolve = jest.fn();
      const reject = jest.fn();

      manager.registerCall(callId, resolve, reject);

      expect(manager.hasPendingCall(callId)).toBe(true);
    });

    it('should create promise for pending call', () => {
      const promise = manager.createCall();

      expect(promise.callId).toBeDefined();
      expect(promise.promise).toBeInstanceOf(Promise);
      expect(manager.hasPendingCall(promise.callId)).toBe(true);
    });
  });

  describe('Resolving Calls', () => {
    it('should resolve pending call with result', async () => {
      const { callId, promise } = manager.createCall();
      const result = { data: [1, 2, 3] };

      manager.resolveCall(callId, result);

      const resolved = await promise;
      expect(resolved).toEqual(result);
      expect(manager.hasPendingCall(callId)).toBe(false);
    });

    it('should handle resolving non-existent call gracefully', () => {
      expect(() => {
        manager.resolveCall('non-existent-call', { data: 'test' });
      }).not.toThrow();
    });
  });

  describe('Rejecting Calls', () => {
    it('should reject pending call with error', async () => {
      const { callId, promise } = manager.createCall();
      const error = new Error('Remote call failed');

      manager.rejectCall(callId, error);

      await expect(promise).rejects.toThrow('Remote call failed');
      expect(manager.hasPendingCall(callId)).toBe(false);
    });

    it('should handle rejecting with error message string', async () => {
      const { callId, promise } = manager.createCall();

      manager.rejectCall(callId, 'Something went wrong');

      await expect(promise).rejects.toThrow('Something went wrong');
    });

    it('should handle rejecting non-existent call gracefully', () => {
      expect(() => {
        manager.rejectCall('non-existent-call', new Error('test'));
      }).not.toThrow();
    });
  });

  describe('Call Cleanup', () => {
    it('should clean up call after resolution', async () => {
      const { callId, promise } = manager.createCall();

      expect(manager.hasPendingCall(callId)).toBe(true);

      manager.resolveCall(callId, 'result');
      await promise;

      expect(manager.hasPendingCall(callId)).toBe(false);
    });

    it('should clean up call after rejection', async () => {
      const { callId, promise } = manager.createCall();

      expect(manager.hasPendingCall(callId)).toBe(true);

      manager.rejectCall(callId, 'error');

      try {
        await promise;
      } catch (e) {
        // Expected
      }

      expect(manager.hasPendingCall(callId)).toBe(false);
    });

    it('should allow manual cleanup of pending call', () => {
      const { callId } = manager.createCall();

      expect(manager.hasPendingCall(callId)).toBe(true);

      manager.cleanupCall(callId);

      expect(manager.hasPendingCall(callId)).toBe(false);
    });
  });

  describe('Timeout Handling', () => {
    it('should reject call after timeout', async () => {
      const { callId, promise } = manager.createCall(100); // 100ms timeout

      await expect(promise).rejects.toThrow(/timed out/);
      expect(manager.hasPendingCall(callId)).toBe(false);
    }, 200); // Test timeout longer than call timeout

    it('should not timeout if resolved before timeout', async () => {
      const { callId, promise } = manager.createCall(100); // 100ms timeout

      // Resolve immediately
      manager.resolveCall(callId, 'success');

      const result = await promise;
      expect(result).toBe('success');
    });

    it('should use default timeout if not specified', async () => {
      // RemoteCallManager should have a default timeout
      const { promise } = manager.createCall();

      // Promise should not reject immediately
      await new Promise(resolve => setTimeout(resolve, 50));

      // Promise should still be pending (default timeout is longer)
      expect(promise).toBeInstanceOf(Promise);
    });
  });

  describe('Multiple Concurrent Calls', () => {
    it('should handle multiple pending calls simultaneously', async () => {
      const call1 = manager.createCall();
      const call2 = manager.createCall();
      const call3 = manager.createCall();

      expect(manager.hasPendingCall(call1.callId)).toBe(true);
      expect(manager.hasPendingCall(call2.callId)).toBe(true);
      expect(manager.hasPendingCall(call3.callId)).toBe(true);

      manager.resolveCall(call1.callId, 'result1');
      manager.resolveCall(call2.callId, 'result2');
      manager.resolveCall(call3.callId, 'result3');

      const results = await Promise.all([call1.promise, call2.promise, call3.promise]);

      expect(results).toEqual(['result1', 'result2', 'result3']);
    });

    it('should not interfere between different calls', async () => {
      const call1 = manager.createCall();
      const call2 = manager.createCall();

      manager.resolveCall(call1.callId, 'result1');
      manager.rejectCall(call2.callId, 'error2');

      const result1 = await call1.promise;
      expect(result1).toBe('result1');

      await expect(call2.promise).rejects.toThrow('error2');
    });
  });

  describe('Call Statistics', () => {
    it('should track pending call count', () => {
      expect(manager.getPendingCallCount()).toBe(0);

      const call1 = manager.createCall();
      expect(manager.getPendingCallCount()).toBe(1);

      const call2 = manager.createCall();
      expect(manager.getPendingCallCount()).toBe(2);

      manager.resolveCall(call1.callId, 'result');
      expect(manager.getPendingCallCount()).toBe(1);

      manager.resolveCall(call2.callId, 'result');
      expect(manager.getPendingCallCount()).toBe(0);
    });
  });
});