/**
 * Test the mock WebSocket with the actor system
 */

import { jest } from '@jest/globals';
import { MockWebSocket, setupMockWebSocket, restoreWebSocket } from '../../helpers/mockWebSocket.js';
import { WebSocketActorManager } from '../../../src/actors/WebSocketActorManager.js';

describe('Mock WebSocket Actor Integration', () => {
  let actorManager;
  let mockBrowser;
  
  beforeAll(() => {
    // Replace global WebSocket with our mock
    setupMockWebSocket();
  });
  
  afterAll(() => {
    restoreWebSocket();
  });
  
  beforeEach(() => {
    // Create a mock tool registry browser API
    mockBrowser = {
      updateState: jest.fn(),
      setTools: jest.fn(),
      setModules: jest.fn()
    };
    
    actorManager = new WebSocketActorManager(mockBrowser);
  });
  
  afterEach(() => {
    if (actorManager) {
      actorManager.disconnect();
    }
  });
  
  test('should establish connection with mock WebSocket', async () => {
    await actorManager.connect('ws://mock-server:8080/ws');
    
    expect(actorManager.isActorSystemConnected()).toBe(true);
    expect(mockBrowser.updateState).toHaveBeenCalledWith('connectionStatus', 'connected');
  });
  
  test('should complete actor handshake', async () => {
    await actorManager.connect('ws://mock-server:8080/ws');
    
    // Check that the handshake was sent
    const ws = actorManager.websocket;
    expect(ws).toBeInstanceOf(MockWebSocket);
    
    const sentMessages = ws.getSentMessages();
    expect(sentMessages[0].type).toBe('actor_handshake');
    expect(sentMessages[0].clientActors).toHaveProperty('tools');
    expect(sentMessages[0].clientActors).toHaveProperty('database');
    expect(sentMessages[0].clientActors).toHaveProperty('search');
  });
  
  test('should create client actors', async () => {
    await actorManager.connect('ws://mock-server:8080/ws');
    
    expect(actorManager.getToolActor()).toBeDefined();
    expect(actorManager.getDatabaseActor()).toBeDefined();
    expect(actorManager.getSearchActor()).toBeDefined();
  });
  
  test('should connect actors to remote counterparts', async () => {
    await actorManager.connect('ws://mock-server:8080/ws');
    
    const toolActor = actorManager.getToolActor();
    expect(toolActor.remoteActor).toBeDefined();
  });
  
  test('should handle loadTools request', async () => {
    await actorManager.connect('ws://mock-server:8080/ws');
    
    // Trigger loadTools
    actorManager.loadTools();
    
    // Wait for the mock response
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Check that tools were set
    expect(mockBrowser.setTools).toHaveBeenCalled();
    const tools = mockBrowser.setTools.mock.calls[0][0];
    expect(tools).toHaveLength(2);
    expect(tools[0].name).toBe('file_write');
  });
  
  test('should handle loadModules request', async () => {
    await actorManager.connect('ws://mock-server:8080/ws');
    
    // Trigger loadModules
    actorManager.loadModules();
    
    // Wait for the mock response
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Check that modules were set
    expect(mockBrowser.setModules).toHaveBeenCalled();
    const modules = mockBrowser.setModules.mock.calls[0][0];
    expect(modules).toHaveLength(2);
    expect(modules[0].name).toBe('file');
  });
  
  test('should handle disconnect', async () => {
    await actorManager.connect('ws://mock-server:8080/ws');
    
    actorManager.disconnect();
    
    // Wait for the close to complete
    await new Promise(resolve => setTimeout(resolve, 20));
    
    expect(actorManager.isActorSystemConnected()).toBe(false);
    expect(actorManager.websocket.readyState).toBe(3); // CLOSED state
  });
  
  test('should handle connection timeout', async () => {
    // Create a mock that doesn't open
    const badWs = new MockWebSocket('ws://bad-server');
    badWs._simulateOpen = () => {}; // Override to prevent opening
    
    global.WebSocket = function() { return badWs; };
    
    await expect(actorManager.connect('ws://bad-server')).rejects.toThrow('WebSocket connection timeout');
    
    // Restore mock
    setupMockWebSocket();
  });
  
  test('should handle handshake timeout', async () => {
    // Create a mock that opens but doesn't respond to handshake
    const badWs = new MockWebSocket('ws://bad-server');
    badWs._simulateServerHandshakeResponse = () => {}; // Override to prevent handshake response
    
    global.WebSocket = function() { return badWs; };
    
    await expect(actorManager.connect('ws://bad-server')).rejects.toThrow('Actor handshake timeout');
    
    // Restore mock
    setupMockWebSocket();
  });
});