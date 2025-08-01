/**
 * Tests for ClientActorSpace
 */
import { describe, test, expect, beforeEach, jest } from '@jest/globals';

describe('ClientActorSpace', () => {
  let ClientActorSpace;
  let ClientChannel;
  let mockWebSocket;
  
  beforeEach(async () => {
    const actors = await import('../../../src/actors/index.js');
    ClientActorSpace = actors.ClientActorSpace;
    ClientChannel = actors.ClientChannel;
    mockWebSocket = new WebSocket('ws://localhost:8080');
  });

  test('should create actor space with unique ID', () => {
    const space = new ClientActorSpace();
    
    expect(space).toBeDefined();
    expect(space.spaceId).toBeDefined();
    expect(typeof space.spaceId).toBe('string');
    expect(space.spaceId).toMatch(/^ClientSpace-/);
  });

  test('should initialize with empty actors and channels', () => {
    const space = new ClientActorSpace();
    
    expect(space.actors).toBeDefined();
    expect(space.actors.size).toBe(0);
    expect(space.channels).toBeDefined();
    expect(space.channels.size).toBe(0);
  });

  test('should register actors', () => {
    const space = new ClientActorSpace();
    const mockActor = {
      isActor: true,
      receive: jest.fn()
    };
    
    space.register(mockActor, 'test-actor');
    
    expect(space.actors.size).toBe(1);
    expect(space.actors.get('test-actor')).toBe(mockActor);
  });

  test('should get registered actor by key', () => {
    const space = new ClientActorSpace();
    const mockActor = {
      isActor: true,
      receive: jest.fn()
    };
    
    space.register(mockActor, 'test-actor');
    const retrieved = space.getActor('test-actor');
    
    expect(retrieved).toBe(mockActor);
  });

  test('should return undefined for non-existent actor', () => {
    const space = new ClientActorSpace();
    const retrieved = space.getActor('non-existent');
    
    expect(retrieved).toBeUndefined();
  });

  test('should create channel from WebSocket', () => {
    const space = new ClientActorSpace();
    const channel = space.addChannel(mockWebSocket);
    
    expect(channel).toBeDefined();
    expect(channel.websocket).toBe(mockWebSocket);
    expect(space.channels.size).toBe(1);
  });

  test('should encode objects to JSON', () => {
    const space = new ClientActorSpace();
    const obj = { type: 'test', data: 'value' };
    
    const encoded = space.encode(obj);
    
    expect(typeof encoded).toBe('string');
    
    // With ActorMessage protocol, the encoded data includes metadata
    const parsed = JSON.parse(encoded);
    expect(parsed.type).toBe('test');
    expect(parsed.payload.data).toBe('value');
    expect(parsed.metadata).toBeDefined();
    expect(parsed.metadata.messageId).toBeDefined();
    expect(parsed.metadata.timestamp).toBeDefined();
  });

  test('should decode JSON to objects', () => {
    const space = new ClientActorSpace();
    const obj = { type: 'test', data: 'value' };
    
    // First encode to get proper ActorMessage format
    const encoded = space.encode(obj);
    const decoded = space.decode(encoded);
    
    // Decoded message should have the ActorMessage structure
    expect(decoded.type).toBe('test');
    expect(decoded.payload.data).toBe('value');
    expect(decoded.metadata).toBeDefined();
  });

  test('should handle legacy JSON format', () => {
    const space = new ClientActorSpace();
    const obj = { type: 'test', data: 'value' };
    const legacyJson = JSON.stringify(obj);
    
    // Should fallback to JSON.parse for non-ActorMessage format
    const decoded = space.decode(legacyJson);
    
    // For legacy format, it should try to parse as ActorMessage but fallback
    expect(decoded.type).toBe('test');
  });

  test('should handle incoming messages', () => {
    const space = new ClientActorSpace();
    const mockActor = {
      isActor: true,
      receive: jest.fn()
    };
    
    space.register(mockActor, 'target-actor');
    
    const message = {
      targetActor: 'target-actor',
      payload: { type: 'test', data: 'value' }
    };
    
    space.handleIncomingMessage(message);
    
    expect(mockActor.receive).toHaveBeenCalledWith(message.payload);
  });

  test('should emit events', () => {
    const space = new ClientActorSpace();
    const listener = jest.fn();
    
    space.on('test-event', listener);
    space.emit('test-event', { data: 'test' });
    
    expect(listener).toHaveBeenCalledWith({ data: 'test' });
  });

  test('should remove event listeners', () => {
    const space = new ClientActorSpace();
    const listener = jest.fn();
    
    space.on('test-event', listener);
    space.off('test-event', listener);
    space.emit('test-event', { data: 'test' });
    
    expect(listener).not.toHaveBeenCalled();
  });

  test('should clean up on destroy', () => {
    const space = new ClientActorSpace();
    const mockActor = {
      isActor: true,
      receive: jest.fn(),
      destroy: jest.fn()
    };
    
    space.register(mockActor, 'test-actor');
    const channel = space.addChannel(mockWebSocket);
    
    space.destroy();
    
    expect(space.actors.size).toBe(0);
    expect(space.channels.size).toBe(0);
    expect(mockActor.destroy).toHaveBeenCalled();
  });
});