/**
 * Tests for ClientChannel (WebSocket channel adapter)
 */
import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { waitFor } from '../../utils/testHelpers.js';

describe('ClientChannel', () => {
  let ClientChannel;
  let mockWebSocket;
  let mockActorSpace;
  
  beforeEach(async () => {
    ({ ClientChannel } = await import('../../../src/actors/ClientChannel.js'));
    
    mockWebSocket = new WebSocket('ws://localhost:8080');
    mockActorSpace = {
      spaceId: 'TestSpace',
      encode: jest.fn(obj => JSON.stringify(obj)),
      decode: jest.fn(str => JSON.parse(str)),
      handleIncomingMessage: jest.fn(),
      makeRemote: jest.fn()
    };
  });

  test('should create channel with WebSocket', () => {
    const channel = new ClientChannel(mockActorSpace, mockWebSocket);
    
    expect(channel).toBeDefined();
    expect(channel.actorSpace).toBe(mockActorSpace);
    expect(channel.websocket).toBe(mockWebSocket);
    expect(channel.isConnected).toBe(false);
  });

  test('should handle WebSocket open event', async () => {
    const channel = new ClientChannel(mockActorSpace, mockWebSocket);
    
    // Trigger WebSocket open
    mockWebSocket.readyState = 1;
    mockWebSocket.onopen({ type: 'open' });
    
    expect(channel.isConnected).toBe(true);
  });

  test('should handle WebSocket close event', () => {
    const channel = new ClientChannel(mockActorSpace, mockWebSocket);
    channel.isConnected = true;
    
    // Trigger WebSocket close
    mockWebSocket.readyState = 3;
    mockWebSocket.onclose({ type: 'close' });
    
    expect(channel.isConnected).toBe(false);
  });

  test('should handle WebSocket error event', () => {
    const channel = new ClientChannel(mockActorSpace, mockWebSocket);
    const consoleError = jest.spyOn(console, 'error').mockImplementation();
    
    const error = new Error('Connection failed');
    mockWebSocket.onerror({ type: 'error', error });
    
    expect(consoleError).toHaveBeenCalledWith('Channel error:', error);
    consoleError.mockRestore();
  });

  test('should handle incoming messages', () => {
    const channel = new ClientChannel(mockActorSpace, mockWebSocket);
    const message = { type: 'test', data: 'value' };
    const messageStr = JSON.stringify(message);
    
    // Trigger message
    mockWebSocket.onmessage({ type: 'message', data: messageStr });
    
    expect(mockActorSpace.decode).toHaveBeenCalledWith(messageStr, channel);
    expect(mockActorSpace.handleIncomingMessage).toHaveBeenCalledWith(message);
  });

  test('should send messages through WebSocket', () => {
    const channel = new ClientChannel(mockActorSpace, mockWebSocket);
    channel.isConnected = true;
    mockWebSocket.readyState = 1;
    
    const targetGuid = 'remote-actor-1';
    const payload = { type: 'command', data: 'test' };
    
    channel.send(targetGuid, payload);
    
    const expectedMessage = { targetGuid, payload };
    expect(mockActorSpace.encode).toHaveBeenCalledWith(expectedMessage);
    expect(mockWebSocket.lastSentData).toBe(JSON.stringify(expectedMessage));
  });

  test('should queue messages when not connected', () => {
    const channel = new ClientChannel(mockActorSpace, mockWebSocket);
    channel.isConnected = false;
    
    const targetGuid = 'remote-actor-1';
    const payload = { type: 'command', data: 'test' };
    
    channel.send(targetGuid, payload);
    
    expect(channel.messageQueue.length).toBe(1);
    expect(channel.messageQueue[0]).toEqual({ targetGuid, payload });
  });

  test('should flush message queue on connection', () => {
    const channel = new ClientChannel(mockActorSpace, mockWebSocket);
    channel.isConnected = false;
    
    // Queue some messages
    channel.send('actor-1', { data: 'msg1' });
    channel.send('actor-2', { data: 'msg2' });
    
    expect(channel.messageQueue.length).toBe(2);
    
    // Connect
    mockWebSocket.readyState = 1;
    mockWebSocket.onopen({ type: 'open' });
    
    expect(channel.messageQueue.length).toBe(0);
    expect(mockActorSpace.encode).toHaveBeenCalledTimes(2);
  });

  test('should create remote actors', () => {
    const channel = new ClientChannel(mockActorSpace, mockWebSocket);
    const guid = 'remote-actor-123';
    
    const remoteActor = channel.makeRemote(guid);
    
    expect(remoteActor).toBeDefined();
    expect(remoteActor.isActor).toBe(true);
    expect(remoteActor.isRemote).toBe(true);
    expect(remoteActor.guid).toBe(guid);
    expect(remoteActor._channel).toBe(channel);
  });

  test('should close WebSocket connection', () => {
    const channel = new ClientChannel(mockActorSpace, mockWebSocket);
    channel.isConnected = true;
    mockWebSocket.readyState = 1; // OPEN
    
    // Mock close is already defined in the MockWebSocket
    channel.close();
    
    // Verify close was called by checking the state
    expect(mockWebSocket.readyState).toBe(3); // CLOSED
    expect(channel.isConnected).toBe(false);
  });

  test('should handle reconnection', async () => {
    const channel = new ClientChannel(mockActorSpace, mockWebSocket);
    
    // Initial connection
    mockWebSocket.readyState = 1;
    mockWebSocket.onopen({ type: 'open' });
    expect(channel.isConnected).toBe(true);
    
    // Disconnect
    mockWebSocket.readyState = 3;
    mockWebSocket.onclose({ type: 'close' });
    expect(channel.isConnected).toBe(false);
    
    // Reconnect with new WebSocket
    const newWebSocket = new WebSocket('ws://localhost:8080');
    channel.reconnect(newWebSocket);
    
    newWebSocket.readyState = 1;
    newWebSocket.onopen({ type: 'open' });
    
    expect(channel.websocket).toBe(newWebSocket);
    expect(channel.isConnected).toBe(true);
  });
});