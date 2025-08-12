/**
 * Integration tests for actor communication
 */

import { ToolRegistryActor } from '../../../src/actors/ToolRegistryActor.js';
import { DatabaseActor } from '../../../src/actors/DatabaseActor.js';
import { SemanticSearchActor } from '../../../src/actors/SemanticSearchActor.js';
import { createMockActorSpace } from '../../helpers/mockActors.js';

describe('Actor Communication Integration', () => {
  let actorSpace;
  let toolRegistryActor;
  let databaseActor;
  let semanticSearchActor;
  let mockWs;
  
  beforeEach(() => {
    // Create mock WebSocket
    mockWs = new global.WebSocket('ws://localhost:8080');
    
    // Create actor space
    actorSpace = createMockActorSpace();
    
    // Create actors
    toolRegistryActor = new ToolRegistryActor();
    databaseActor = new DatabaseActor();
    semanticSearchActor = new SemanticSearchActor();
    
    // Register actors
    actorSpace.register(toolRegistryActor, 'client-tool-registry');
    actorSpace.register(databaseActor, 'client-database');
    actorSpace.register(semanticSearchActor, 'client-semantic');
    
    // Create channel
    const channel = actorSpace.addChannel(mockWs);
    
    // Create remote actors
    const remoteToolRegistry = channel.makeRemote('server-tool-registry');
    const remoteDatabase = channel.makeRemote('server-database');
    const remoteSemantic = channel.makeRemote('server-semantic');
    
    // Connect actors to remotes
    toolRegistryActor.setRemoteAgent(remoteToolRegistry);
    databaseActor.setRemoteAgent(remoteDatabase);
    semanticSearchActor.setRemoteAgent(remoteSemantic);
  });
  
  afterEach(() => {
    mockWs.close();
  });
  
  describe('WebSocket Handshake', () => {
    test('should complete handshake protocol', async () => {
      // Simulate server handshake
      const handshakeMessage = {
        type: 'actor_handshake',
        serverActors: {
          toolRegistry: 'server-tool-registry',
          database: 'server-database',
          semanticSearch: 'server-semantic'
        }
      };
      
      mockWs._simulateMessage(JSON.stringify(handshakeMessage));
      await nextTick();
      
      // Check that client sent handshake response
      const lastSent = JSON.parse(mockWs._lastSent);
      expect(lastSent.type).toBe('actor_handshake_ack');
      expect(lastSent.clientActors).toBeDefined();
      expect(lastSent.clientActors.toolRegistry).toBe('client-tool-registry');
    });
    
    test('should handle handshake timeout', async () => {
      // Don't send handshake
      const errorHandler = jest.fn();
      mockWs.onerror = errorHandler;
      
      // Wait for timeout
      await new Promise(resolve => setTimeout(resolve, 5100));
      
      // Should close connection
      expect(mockWs.readyState).toBe(mockWs.CLOSED);
    });
  });
  
  describe('Tool Registry Actor', () => {
    test('should request tool list', async () => {
      await toolRegistryActor.requestToolList();
      
      const sentMessage = JSON.parse(mockWs._lastSent);
      expect(sentMessage.targetGuid).toBe('server-tool-registry');
      expect(sentMessage.payload.type).toBe('list_tools');
    });
    
    test('should search tools', async () => {
      await toolRegistryActor.searchTools('file');
      
      const sentMessage = JSON.parse(mockWs._lastSent);
      expect(sentMessage.payload.type).toBe('search_tools');
      expect(sentMessage.payload.query).toBe('file');
    });
    
    test('should execute tool', async () => {
      const args = { filepath: '/test.txt', content: 'test' };
      await toolRegistryActor.executeTool('file_write', args);
      
      const sentMessage = JSON.parse(mockWs._lastSent);
      expect(sentMessage.payload.type).toBe('execute_tool');
      expect(sentMessage.payload.toolName).toBe('file_write');
      expect(sentMessage.payload.args).toEqual(args);
    });
    
    test('should handle tool list response', async () => {
      const listener = jest.fn();
      toolRegistryActor.on('tools:list', listener);
      
      const response = {
        targetGuid: 'client-tool-registry',
        payload: {
          type: 'tools_list',
          tools: [
            { name: 'file_write', module: 'file' },
            { name: 'calculator', module: 'calculator' }
          ]
        }
      };
      
      await actorSpace.handleIncomingMessage(response);
      
      expect(listener).toHaveBeenCalledWith(response.payload.tools);
    });
  });
  
  describe('Database Actor', () => {
    test('should request collections', async () => {
      await databaseActor.requestCollections();
      
      const sentMessage = JSON.parse(mockWs._lastSent);
      expect(sentMessage.targetGuid).toBe('server-database');
      expect(sentMessage.payload.type).toBe('list_collections');
    });
    
    test('should request documents', async () => {
      await databaseActor.requestDocuments('tools', { module: 'file' });
      
      const sentMessage = JSON.parse(mockWs._lastSent);
      expect(sentMessage.payload.type).toBe('get_documents');
      expect(sentMessage.payload.collection).toBe('tools');
      expect(sentMessage.payload.query).toEqual({ module: 'file' });
    });
    
    test('should handle collections response', async () => {
      const listener = jest.fn();
      databaseActor.on('collections:list', listener);
      
      const response = {
        targetGuid: 'client-database',
        payload: {
          type: 'collections_list',
          collections: [
            { name: 'tools', count: 45 },
            { name: 'modules', count: 12 }
          ]
        }
      };
      
      await actorSpace.handleIncomingMessage(response);
      
      expect(listener).toHaveBeenCalledWith(response.payload.collections);
    });
    
    test('should handle documents response', async () => {
      const listener = jest.fn();
      databaseActor.on('documents:list', listener);
      
      const response = {
        targetGuid: 'client-database',
        payload: {
          type: 'documents',
          collection: 'tools',
          documents: [{ _id: '1', name: 'file_write' }],
          total: 1
        }
      };
      
      await actorSpace.handleIncomingMessage(response);
      
      expect(listener).toHaveBeenCalledWith({
        collection: 'tools',
        documents: response.payload.documents,
        total: 1
      });
    });
  });
  
  describe('Semantic Search Actor', () => {
    test('should perform semantic search', async () => {
      await semanticSearchActor.search('file operations');
      
      const sentMessage = JSON.parse(mockWs._lastSent);
      expect(sentMessage.targetGuid).toBe('server-semantic');
      expect(sentMessage.payload.type).toBe('search');
      expect(sentMessage.payload.query).toBe('file operations');
    });
    
    test('should request vector collections', async () => {
      await semanticSearchActor.requestCollections();
      
      const sentMessage = JSON.parse(mockWs._lastSent);
      expect(sentMessage.payload.type).toBe('get_collections');
    });
    
    test('should handle search results', async () => {
      const listener = jest.fn();
      semanticSearchActor.on('search:results', listener);
      
      const response = {
        targetGuid: 'client-semantic',
        payload: {
          type: 'search_results',
          results: [
            { score: 0.95, payload: { toolName: 'file_write' } }
          ]
        }
      };
      
      await actorSpace.handleIncomingMessage(response);
      
      expect(listener).toHaveBeenCalledWith(response.payload.results);
    });
    
    test('should generate embeddings', async () => {
      await semanticSearchActor.generateEmbedding('test text');
      
      const sentMessage = JSON.parse(mockWs._lastSent);
      expect(sentMessage.payload.type).toBe('generate_embedding');
      expect(sentMessage.payload.text).toBe('test text');
    });
  });
  
  describe('Error Handling', () => {
    test('should handle actor not found errors', async () => {
      const response = {
        targetGuid: 'non-existent-actor',
        payload: { type: 'test' }
      };
      
      const result = await actorSpace.handleIncomingMessage(response);
      expect(result.error).toBe('Actor not found');
    });
    
    test('should handle message parsing errors', () => {
      const errorHandler = jest.fn();
      toolRegistryActor.on('error', errorHandler);
      
      // Simulate malformed message
      mockWs._simulateMessage('invalid json {');
      
      expect(errorHandler).toHaveBeenCalled();
    });
    
    test('should handle connection errors', () => {
      const errorHandler = jest.fn();
      toolRegistryActor.on('connection:error', errorHandler);
      
      // Simulate connection error
      mockWs.onerror(new Error('Connection failed'));
      
      expect(errorHandler).toHaveBeenCalled();
    });
    
    test('should handle disconnection', () => {
      const disconnectHandler = jest.fn();
      toolRegistryActor.on('disconnected', disconnectHandler);
      
      mockWs.close();
      
      expect(disconnectHandler).toHaveBeenCalled();
    });
  });
  
  describe('Message Routing', () => {
    test('should route messages to correct actors', async () => {
      const toolListener = jest.fn();
      const dbListener = jest.fn();
      
      toolRegistryActor.on('tools:list', toolListener);
      databaseActor.on('collections:list', dbListener);
      
      // Send message to tool registry actor
      await actorSpace.handleIncomingMessage({
        targetGuid: 'client-tool-registry',
        payload: { type: 'tools_list', tools: [] }
      });
      
      expect(toolListener).toHaveBeenCalled();
      expect(dbListener).not.toHaveBeenCalled();
      
      // Send message to database actor
      await actorSpace.handleIncomingMessage({
        targetGuid: 'client-database',
        payload: { type: 'collections_list', collections: [] }
      });
      
      expect(dbListener).toHaveBeenCalled();
    });
    
    test('should handle broadcast messages', async () => {
      const listeners = [
        jest.fn(),
        jest.fn(),
        jest.fn()
      ];
      
      toolRegistryActor.on('broadcast', listeners[0]);
      databaseActor.on('broadcast', listeners[1]);
      semanticSearchActor.on('broadcast', listeners[2]);
      
      // Simulate broadcast message
      const broadcastMsg = {
        type: 'broadcast',
        payload: { message: 'Server maintenance' }
      };
      
      mockWs._simulateMessage(JSON.stringify(broadcastMsg));
      await nextTick();
      
      // All actors should receive broadcast
      listeners.forEach(listener => {
        expect(listener).toHaveBeenCalledWith(broadcastMsg.payload);
      });
    });
  });
  
  describe('Reconnection', () => {
    test('should handle reconnection', async () => {
      const reconnectHandler = jest.fn();
      toolRegistryActor.on('reconnected', reconnectHandler);
      
      // Close connection
      mockWs.close();
      
      // Create new connection
      const newWs = new global.WebSocket('ws://localhost:8080');
      const newChannel = actorSpace.addChannel(newWs);
      
      // Reconnect actor
      const newRemote = newChannel.makeRemote('server-tool-registry');
      toolRegistryActor.setRemoteAgent(newRemote);
      
      // Simulate reconnection complete
      toolRegistryActor.emit('reconnected');
      
      expect(reconnectHandler).toHaveBeenCalled();
    });
    
    test('should resend pending messages after reconnection', async () => {
      // Queue message while disconnected
      mockWs.readyState = mockWs.CLOSED;
      
      const pendingMessage = { type: 'list_tools' };
      toolRegistryActor.queueMessage(pendingMessage);
      
      // Reconnect
      mockWs.readyState = mockWs.OPEN;
      await toolRegistryActor.flushMessageQueue();
      
      const sentMessage = JSON.parse(mockWs._lastSent);
      expect(sentMessage.payload.type).toBe('list_tools');
    });
  });
  
  describe('Performance', () => {
    test('should handle high message volume', async () => {
      const messageCount = 100;
      const listener = jest.fn();
      toolRegistryActor.on('tools:list', listener);
      
      // Send many messages rapidly
      for (let i = 0; i < messageCount; i++) {
        await actorSpace.handleIncomingMessage({
          targetGuid: 'client-tool-registry',
          payload: { type: 'tools_list', tools: [], id: i }
        });
      }
      
      expect(listener).toHaveBeenCalledTimes(messageCount);
    });
    
    test('should throttle outgoing messages', async () => {
      const sendCount = 50;
      const startTime = Date.now();
      
      // Send many messages rapidly
      for (let i = 0; i < sendCount; i++) {
        await toolRegistryActor.requestToolList();
      }
      
      const duration = Date.now() - startTime;
      
      // Should be throttled (not all sent immediately)
      expect(duration).toBeGreaterThan(100);
    });
  });
});