/**
 * Tests for ClientCommandActor
 */
import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { waitFor } from '../../utils/testHelpers.js';

describe('ClientCommandActor', () => {
  let ClientCommandActor;
  let mockActorSpace;
  let mockChannel;
  let commandActor;
  
  beforeEach(async () => {
    ({ ClientCommandActor } = await import('../../../src/actors/ClientCommandActor.js'));
    
    mockChannel = {
      send: jest.fn(),
      isConnected: true
    };
    
    mockActorSpace = {
      spaceId: 'TestSpace',
      getActor: jest.fn(),
      channels: new Map([[null, mockChannel]]),
      emit: jest.fn()
    };
    
    commandActor = new ClientCommandActor();
    commandActor._space = mockActorSpace;
  });

  test('should be a valid actor', () => {
    expect(commandActor).toBeActor();
  });

  test('should handle execute message', () => {
    const message = {
      type: 'execute',
      tool: 'file_read',
      args: { path: '/test.txt' },
      requestId: 'req-123'
    };
    
    commandActor.receive(message);
    
    expect(mockChannel.send).toHaveBeenCalledWith(
      'tool-executor',
      {
        type: 'tool_execution',
        tool: 'file_read',
        args: { path: '/test.txt' },
        requestId: 'req-123'
      }
    );
  });

  test('should handle response message', () => {
    const responseActor = {
      isActor: true,
      receive: jest.fn()
    };
    
    mockActorSpace.getActor.mockReturnValue(responseActor);
    
    const message = {
      type: 'response',
      requestId: 'req-123',
      result: { success: true, data: 'file contents' }
    };
    
    commandActor.receive(message);
    
    expect(mockActorSpace.getActor).toHaveBeenCalledWith('response-actor');
    expect(responseActor.receive).toHaveBeenCalledWith({
      type: 'command_result',
      requestId: 'req-123',
      result: { success: true, data: 'file contents' }
    });
  });

  test('should emit error for unknown message type', () => {
    const consoleWarn = jest.spyOn(console, 'warn').mockImplementation();
    
    const message = {
      type: 'unknown',
      data: 'test'
    };
    
    commandActor.receive(message);
    
    expect(consoleWarn).toHaveBeenCalledWith(
      'ClientCommandActor: Unknown message type',
      'unknown'
    );
    
    consoleWarn.mockRestore();
  });

  test('should queue messages when not connected', () => {
    mockChannel.isConnected = false;
    
    const message = {
      type: 'execute',
      tool: 'file_list',
      args: {},
      requestId: 'req-456'
    };
    
    commandActor.receive(message);
    
    expect(commandActor.messageQueue.length).toBe(1);
    expect(mockChannel.send).not.toHaveBeenCalled();
  });

  test('should flush queue when connection restored', () => {
    mockChannel.isConnected = false;
    
    // Queue some messages
    commandActor.receive({
      type: 'execute',
      tool: 'tool1',
      args: {},
      requestId: 'req-1'
    });
    
    commandActor.receive({
      type: 'execute',
      tool: 'tool2',
      args: {},
      requestId: 'req-2'
    });
    
    expect(commandActor.messageQueue.length).toBe(2);
    
    // Restore connection
    mockChannel.isConnected = true;
    commandActor.flushQueue();
    
    expect(commandActor.messageQueue.length).toBe(0);
    expect(mockChannel.send).toHaveBeenCalledTimes(2);
  });

  test('should track pending requests', () => {
    const message = {
      type: 'execute',
      tool: 'async_tool',
      args: {},
      requestId: 'req-789'
    };
    
    commandActor.receive(message);
    
    expect(commandActor.pendingRequests.has('req-789')).toBe(true);
    
    // Receive response
    commandActor.receive({
      type: 'response',
      requestId: 'req-789',
      result: { success: true }
    });
    
    expect(commandActor.pendingRequests.has('req-789')).toBe(false);
  });

  test('should handle timeout for pending requests', async () => {
    commandActor.requestTimeout = 100; // Set short timeout for test
    
    const message = {
      type: 'execute',
      tool: 'slow_tool',
      args: {},
      requestId: 'req-timeout'
    };
    
    commandActor.receive(message);
    
    expect(commandActor.pendingRequests.has('req-timeout')).toBe(true);
    
    // Wait for timeout
    await waitFor(
      () => !commandActor.pendingRequests.has('req-timeout'),
      { timeout: 200 }
    );
    
    expect(mockActorSpace.emit).toHaveBeenCalledWith('request_timeout', {
      requestId: 'req-timeout',
      tool: 'slow_tool'
    });
  });

  test('should provide channel status', () => {
    mockChannel.isConnected = true;
    expect(commandActor.isConnected()).toBe(true);
    
    mockChannel.isConnected = false;
    expect(commandActor.isConnected()).toBe(false);
  });

  test('should clean up on destroy', () => {
    // Add some pending requests
    commandActor.pendingRequests.set('req-1', { timer: setTimeout(() => {}, 1000) });
    commandActor.pendingRequests.set('req-2', { timer: setTimeout(() => {}, 1000) });
    
    const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');
    
    commandActor.destroy();
    
    expect(commandActor.pendingRequests.size).toBe(0);
    expect(commandActor.messageQueue.length).toBe(0);
    expect(clearTimeoutSpy).toHaveBeenCalledTimes(2);
    
    clearTimeoutSpy.mockRestore();
  });
});