/**
 * Unit tests for RemoteHandle
 * Tests that RemoteHandle correctly wraps RemoteActor for Handle-like interface
 */

import { jest } from '@jest/globals';

describe('RemoteHandle', () => {
  let RemoteHandle, RemoteActor, ActorSpace;
  let mockActorSpace, mockRemoteActor;

  beforeEach(async () => {
    // Dynamically import to allow for module mocking
    const handleModule = await import('../src/RemoteHandle.js');
    RemoteHandle = handleModule.RemoteHandle;

    // Create mock RemoteActor
    mockRemoteActor = {
      receive: jest.fn()
    };

    // Create mock ActorSpace
    mockActorSpace = {
      makeRemote: jest.fn().mockReturnValue(mockRemoteActor)
    };
  });

  describe('constructor', () => {
    test('should create RemoteHandle with actorSpace and guid', () => {
      const remoteHandle = new RemoteHandle(mockActorSpace, 'test-guid');

      expect(remoteHandle._actorSpace).toBe(mockActorSpace);
      expect(remoteHandle._guid).toBe('test-guid');
      expect(mockActorSpace.makeRemote).toHaveBeenCalledWith('test-guid');
      expect(remoteHandle._remoteActor).toBe(mockRemoteActor);
    });
  });

  describe('query', () => {
    test('should send query message to remote actor', async () => {
      const remoteHandle = new RemoteHandle(mockActorSpace, 'test-guid');
      const querySpec = { where: { name: 'test' } };
      const expectedResult = [{ id: 1, name: 'test' }];

      mockRemoteActor.receive.mockResolvedValue(expectedResult);

      const result = await remoteHandle.query(querySpec);

      expect(mockRemoteActor.receive).toHaveBeenCalledWith({
        type: 'query',
        querySpec
      });
      expect(result).toEqual(expectedResult);
    });

    test('should handle empty query spec', async () => {
      const remoteHandle = new RemoteHandle(mockActorSpace, 'test-guid');
      mockRemoteActor.receive.mockResolvedValue([]);

      const result = await remoteHandle.query({});

      expect(mockRemoteActor.receive).toHaveBeenCalledWith({
        type: 'query',
        querySpec: {}
      });
      expect(result).toEqual([]);
    });
  });

  describe('subscribe', () => {
    test('should send subscribe message to remote actor', async () => {
      const remoteHandle = new RemoteHandle(mockActorSpace, 'test-guid');
      const querySpec = { where: { status: 'active' } };
      const callback = jest.fn();
      const unsubscribe = jest.fn();

      mockRemoteActor.receive.mockResolvedValue(unsubscribe);

      const result = await remoteHandle.subscribe(querySpec, callback);

      expect(mockRemoteActor.receive).toHaveBeenCalledWith({
        type: 'subscribe',
        querySpec,
        callback
      });
      expect(result).toBe(unsubscribe);
    });
  });

  describe('value', () => {
    test('should send value message to remote actor', async () => {
      const remoteHandle = new RemoteHandle(mockActorSpace, 'test-guid');
      const expectedValue = { current: 'data' };

      mockRemoteActor.receive.mockResolvedValue(expectedValue);

      const result = await remoteHandle.value();

      expect(mockRemoteActor.receive).toHaveBeenCalledWith({
        type: 'value'
      });
      expect(result).toEqual(expectedValue);
    });
  });

  describe('call', () => {
    test('should pass through method calls to remote actor', async () => {
      const remoteHandle = new RemoteHandle(mockActorSpace, 'test-guid');
      const expectedResult = 42;

      mockRemoteActor.receive.mockResolvedValue(expectedResult);

      const result = await remoteHandle.call('customMethod', 'arg1', 'arg2');

      expect(mockRemoteActor.receive).toHaveBeenCalledWith({
        type: 'remote-call',
        method: 'customMethod',
        args: ['arg1', 'arg2']
      });
      expect(result).toBe(expectedResult);
    });

    test('should handle calls with no arguments', async () => {
      const remoteHandle = new RemoteHandle(mockActorSpace, 'test-guid');
      mockRemoteActor.receive.mockResolvedValue(null);

      await remoteHandle.call('noArgs');

      expect(mockRemoteActor.receive).toHaveBeenCalledWith({
        type: 'remote-call',
        method: 'noArgs',
        args: []
      });
    });

    test('should handle calls with multiple arguments', async () => {
      const remoteHandle = new RemoteHandle(mockActorSpace, 'test-guid');
      mockRemoteActor.receive.mockResolvedValue('result');

      await remoteHandle.call('multiArgs', 1, 'two', { three: 3 }, [4]);

      expect(mockRemoteActor.receive).toHaveBeenCalledWith({
        type: 'remote-call',
        method: 'multiArgs',
        args: [1, 'two', { three: 3 }, [4]]
      });
    });
  });
});
