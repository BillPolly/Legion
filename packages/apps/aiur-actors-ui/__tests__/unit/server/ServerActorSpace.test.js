/**
 * Tests for ServerActorSpace setup
 */
import { describe, test, expect, beforeEach, jest } from '@jest/globals';

describe('ServerActorSpace', () => {
  let ServerActorSpace;
  let mockWebSocket;
  
  beforeEach(async () => {
    ({ ServerActorSpace } = await import('../../../src/server/ServerActorSpace.js'));
    
    mockWebSocket = {
      on: jest.fn(),
      send: jest.fn(),
      close: jest.fn(),
      readyState: 1
    };
  });

  test('should create server actor space with client ID', () => {
    const space = new ServerActorSpace('client-123');
    
    expect(space).toBeDefined();
    expect(space.clientId).toBe('client-123');
    expect(space.spaceId).toMatch(/^ServerSpace-client-123/);
  });

  test('should initialize actors on creation', () => {
    const mockToolRegistry = { getTool: jest.fn() };
    const mockSessionManager = { getSession: jest.fn() };
    const mockEventEmitter = { on: jest.fn(), off: jest.fn(), emit: jest.fn() };
    
    const space = new ServerActorSpace('client-123', {
      toolRegistry: mockToolRegistry,
      sessionManager: mockSessionManager,
      eventEmitter: mockEventEmitter
    });
    
    expect(space.actors.size).toBe(3);
    expect(space.getActor('tool-executor')).toBeDefined();
    expect(space.getActor('session-manager')).toBeDefined();
    expect(space.getActor('event-stream')).toBeDefined();
  });

  test('should handle WebSocket connection', () => {
    const space = new ServerActorSpace('client-123');
    const channel = space.connectWebSocket(mockWebSocket);
    
    expect(channel).toBeDefined();
    expect(mockWebSocket.on).toHaveBeenCalledWith('message', expect.any(Function));
    expect(mockWebSocket.on).toHaveBeenCalledWith('close', expect.any(Function));
    expect(mockWebSocket.on).toHaveBeenCalledWith('error', expect.any(Function));
  });

  test('should handle incoming messages', () => {
    const space = new ServerActorSpace('client-123');
    const mockActor = {
      isActor: true,
      receive: jest.fn()
    };
    
    space.register(mockActor, 'test-actor');
    space.connectWebSocket(mockWebSocket);
    
    // Get the message handler
    const messageHandler = mockWebSocket.on.mock.calls
      .find(call => call[0] === 'message')[1];
    
    // Simulate incoming message
    const message = {
      targetActor: 'test-actor',
      payload: { type: 'test', data: 'value' }
    };
    
    messageHandler(JSON.stringify(message));
    
    expect(mockActor.receive).toHaveBeenCalledWith(message.payload);
  });

  test('should clean up on WebSocket close', () => {
    const space = new ServerActorSpace('client-123');
    const destroySpy = jest.spyOn(space, 'destroy');
    
    space.connectWebSocket(mockWebSocket);
    
    // Get the close handler
    const closeHandler = mockWebSocket.on.mock.calls
      .find(call => call[0] === 'close')[1];
    
    closeHandler();
    
    expect(destroySpy).toHaveBeenCalled();
  });

  test('should emit client events', () => {
    const mockEventEmitter = {
      emit: jest.fn()
    };
    
    const space = new ServerActorSpace('client-123', {
      eventEmitter: mockEventEmitter
    });
    
    space.emitClientEvent('tool_executed', { tool: 'file_read' });
    
    expect(mockEventEmitter.emit).toHaveBeenCalledWith('client:tool_executed', {
      clientId: 'client-123',
      data: { tool: 'file_read' }
    });
  });

  test('should broadcast to client', () => {
    const space = new ServerActorSpace('client-123');
    space.connectWebSocket(mockWebSocket);
    
    const message = {
      type: 'state_update',
      data: { tools: ['tool1', 'tool2'] }
    };
    
    space.broadcastToClient(message);
    
    expect(mockWebSocket.send).toHaveBeenCalledWith(
      JSON.stringify({
        targetActor: 'ui-update-actor',
        payload: message
      })
    );
  });

  test('should handle actor registration and lookup', () => {
    const space = new ServerActorSpace('client-123');
    const mockActor = {
      isActor: true,
      receive: jest.fn()
    };
    
    space.register(mockActor, 'custom-actor');
    
    expect(space.getActor('custom-actor')).toBe(mockActor);
    expect(space.actors.size).toBeGreaterThan(0); // At least the custom actor
  });

  test('should clean up all actors on destroy', () => {
    const mockToolRegistry = { getTool: jest.fn() };
    const space = new ServerActorSpace('client-123', {
      toolRegistry: mockToolRegistry
    });
    
    const actors = Array.from(space.actors.values());
    actors.forEach(actor => {
      if (actor.destroy) {
        jest.spyOn(actor, 'destroy');
      }
    });
    
    space.destroy();
    
    expect(space.actors.size).toBe(0);
    actors.forEach(actor => {
      if (actor.destroy) {
        expect(actor.destroy).toHaveBeenCalled();
      }
    });
  });
});