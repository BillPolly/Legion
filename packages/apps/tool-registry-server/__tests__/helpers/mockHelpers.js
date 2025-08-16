/**
 * Mock helpers for testing actors and WebSocket communication
 */

import { jest } from '@jest/globals';
import { EventEmitter } from 'events';

/**
 * Create a mock WebSocket for testing
 */
export function createMockWebSocket() {
  return {
    send: jest.fn(),
    close: jest.fn(),
    readyState: 1, // OPEN
    on: jest.fn(),
    once: jest.fn(),
    emit: jest.fn(),
    removeListener: jest.fn()
  };
}

/**
 * Create a mock ActorSpace
 */
export function createMockActorSpace() {
  const actors = new Map();
  
  return {
    spaceId: 'mock-space-' + Date.now(),
    actors,
    
    register: jest.fn((actor, guid) => {
      actors.set(guid, actor);
    }),
    
    getActors: jest.fn(() => actors),
    
    handleIncomingMessage: jest.fn((message) => {
      const actor = actors.get(message.targetGuid);
      if (actor && actor.receive) {
        return actor.receive(message.payload);
      }
    }),
    
    addChannel: jest.fn((ws) => {
      return {
        makeRemote: jest.fn((guid) => ({
          guid,
          receive: jest.fn((payload) => {
            // Simulate sending through WebSocket
            if (ws && ws.send) {
              ws.send(JSON.stringify({ targetGuid: guid, payload }));
            }
          })
        }))
      };
    })
  };
}

/**
 * Create a mock remote actor
 */
export function createMockRemoteActor() {
  return {
    receive: jest.fn()
  };
}

/**
 * Create a mock ToolRegistryService
 */
export function createMockToolRegistryService() {
  return {
    loadAllModulesFromFileSystem: jest.fn().mockResolvedValue({
      loaded: [],
      failed: [],
      summary: { total: 0, loaded: 0, failed: 0 }
    }),
    getTool: jest.fn(),
    listTools: jest.fn().mockResolvedValue([]),
    loadTools: jest.fn().mockResolvedValue([]),
    loadModules: jest.fn().mockResolvedValue([]),
    executeTool: jest.fn(),
    searchTools: jest.fn().mockResolvedValue([]),
    getStats: jest.fn().mockResolvedValue({}),
    getRegistry: jest.fn().mockReturnValue({}),
    cleanup: jest.fn()
  };
}

/**
 * Create a mock Channel
 */
export function createMockChannel() {
  return {
    makeRemote: jest.fn((guid) => ({
      guid,
      receive: jest.fn()
    }))
  };
}

/**
 * Helper to simulate actor handshake
 */
export function simulateActorHandshake(ws, clientActors) {
  // Simulate server response
  const serverActors = {
    registry: 'server-registry-' + Date.now(),
    database: 'server-database-' + Date.now(),
    search: 'server-search-' + Date.now()
  };
  
  // Send handshake ack
  if (ws.onmessage) {
    ws.onmessage({
      data: JSON.stringify({
        type: 'actor_handshake_ack',
        serverActors
      })
    });
  }
  
  return serverActors;
}

/**
 * Create connected mock actors for testing
 */
export function createConnectedMockActors(registryService) {
  const remoteActor = createMockRemoteActor();
  
  const actor = {
    registryService,
    registry: registryService.getRegistry(),
    remoteActor,
    
    setRemoteActor: jest.fn(function(remote) {
      this.remoteActor = remote;
    }),
    
    receive: jest.fn(async function(message) {
      const { type, data } = message;
      
      // Simulate basic message handling
      switch (type) {
        case 'tools:load':
          const tools = await this.registryService.loadTools();
          if (this.remoteActor) {
            this.remoteActor.receive({
              type: 'tools:list',
              data: { tools }
            });
          }
          break;
          
        case 'modules:load':
          const modules = await this.registryService.loadModules();
          if (this.remoteActor) {
            this.remoteActor.receive({
              type: 'modules:list',
              data: { modules }
            });
          }
          break;
          
        case 'registry:loadAll':
          const result = await this.registryService.loadAllModulesFromFileSystem();
          if (this.remoteActor) {
            this.remoteActor.receive({
              type: 'registry:loadAllComplete',
              data: result
            });
          }
          break;
          
        case 'registry:stats':
          const stats = await this.registryService.getStats();
          if (this.remoteActor) {
            this.remoteActor.receive({
              type: 'registry:stats',
              data: stats
            });
          }
          break;
          
        case 'tool:execute':
          try {
            const result = await this.registryService.executeTool(data.toolName, data.params);
            if (this.remoteActor) {
              this.remoteActor.receive({
                type: 'tool:execute:result',
                data: { result }
              });
            }
          } catch (error) {
            if (this.remoteActor) {
              this.remoteActor.receive({
                type: 'error',
                data: { error: error.message }
              });
            }
          }
          break;
          
        default:
          console.log('Unknown message type:', type);
      }
    })
  };
  
  // Bind methods to maintain context
  actor.setRemoteActor = actor.setRemoteActor.bind(actor);
  actor.receive = actor.receive.bind(actor);
  
  return { actor, remoteActor };
}

/**
 * Mock WebSocket that behaves like a real WebSocket for testing
 */
export class MockWebSocket extends EventEmitter {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  constructor(url) {
    super();
    this.url = url;
    this.readyState = MockWebSocket.OPEN; // Start as open for synchronous testing
    this.send = jest.fn();
    this.close = jest.fn(() => {
      this.readyState = MockWebSocket.CLOSED;
      this.emit('close');
    });

    // Emit open event immediately for synchronous testing
    setTimeout(() => this.emit('open'), 0);
  }

  // Simulate receiving a message
  simulateMessage(data) {
    if (this.readyState === MockWebSocket.OPEN) {
      this.emit('message', Buffer.from(data));
    }
  }

  // Simulate connection error
  simulateError(error) {
    this.emit('error', error);
  }
}

/**
 * Mock WebSocketServer for E2E testing
 */
export class MockWebSocketServer extends EventEmitter {
  constructor(options = {}) {
    super();
    this.options = options;
    this.clients = new Set();
    this.close = jest.fn((callback) => {
      this.clients.clear();
      if (callback) callback();
    });
  }

  // Simulate a client connecting
  simulateConnection(clientOptions = {}, wsService = null) {
    const mockSocket = new MockWebSocket('ws://localhost/ws');
    const mockReq = {
      socket: {
        remoteAddress: clientOptions.ip || '127.0.0.1'
      }
    };

    this.clients.add(mockSocket);

    // Immediately trigger the connection event for synchronous testing
    this.emit('connection', mockSocket, mockReq);
    
    // If wsService is provided, handle the connection directly
    if (wsService) {
      wsService.handleConnection(mockSocket, mockReq);
    }

    return mockSocket;
  }
}

/**
 * Create a complete mock server setup for testing WebSocket functionality
 */
export function createMockServerSetup() {
  const mockRegistryService = createMockToolRegistryService();
  
  const mockActorSpace = createMockActorSpace();
  
  const mockActorManager = {
    createActorSpace: jest.fn().mockResolvedValue(mockActorSpace),
    getActorGuids: jest.fn().mockReturnValue({
      registry: 'server-registry-123',
      database: 'server-database-456', 
      search: 'server-search-789'
    }),
    setupRemoteActors: jest.fn().mockReturnValue({
      registry: createMockRemoteActor(),
      database: createMockRemoteActor(),
      search: createMockRemoteActor()
    }),
    cleanupActorSpace: jest.fn().mockResolvedValue(),
    cleanup: jest.fn().mockResolvedValue()
  };

  const mockWss = new MockWebSocketServer();
  
  return {
    mockRegistryService,
    mockActorSpace,
    mockActorManager,
    mockWss
  };
}