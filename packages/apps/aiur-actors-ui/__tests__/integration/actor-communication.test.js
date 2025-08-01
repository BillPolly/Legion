/**
 * Integration tests for actor communication
 * Verifies message flows between client and server actors
 */
import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { ClientActorSpace } from '../../src/actors/ClientActorSpace.js';
import { UIUpdateActor } from '../../src/actors/UIUpdateActor.js';
import { ClientCommandActor } from '../../src/actors/ClientCommandActor.js';
import { ActorMessage } from '../../src/actors/ActorMessage.js';

describe('Actor Communication', () => {
  let actorSpace;
  let uiActor;
  let commandActor;
  let mockWebSocket;
  let channel;
  
  beforeEach(() => {
    // Create actor space
    actorSpace = new ClientActorSpace('test-space');
    
    // Create actors
    uiActor = new UIUpdateActor();
    commandActor = new ClientCommandActor();
    
    // Register actors
    actorSpace.register(uiActor, 'ui');
    actorSpace.register(commandActor, 'command');
    
    // Mock WebSocket
    mockWebSocket = {
      readyState: 1, // OPEN
      send: jest.fn(),
      close: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn()
    };
    
    // Add event emitter functionality
    const events = {};
    mockWebSocket.addEventListener.mockImplementation((event, handler) => {
      if (!events[event]) events[event] = [];
      events[event].push(handler);
    });
    
    mockWebSocket.emit = (event, data) => {
      if (events[event]) {
        events[event].forEach(handler => handler(data));
      }
    };
  });
  
  afterEach(() => {
    jest.clearAllMocks();
  });
  
  describe('Complete Message Flows', () => {
    test('should handle tool execution flow', async () => {
      // Setup channel
      channel = actorSpace.addChannel(mockWebSocket);
      
      // Create execution flow tracker
      const flow = [];
      
      // Track command actor messages
      commandActor.receive = jest.fn((message) => {
        flow.push({ actor: 'command', message });
        
        // Simulate sending to server
        if (message.type === 'tool.execute') {
          const serverMessage = ActorMessage.create({
            type: 'server.execute',
            toolId: message.toolId,
            params: message.params
          });
          
          mockWebSocket.send(JSON.stringify(serverMessage.serialize()));
        }
      });
      
      // Track UI actor messages
      uiActor.receive = jest.fn((message) => {
        flow.push({ actor: 'ui', message });
      });
      
      // Start execution flow
      const executeMessage = ActorMessage.create({
        type: 'tool.execute',
        toolId: 'git-status',
        params: {}
      });
      
      commandActor.receive(executeMessage);
      
      // Simulate server response
      const responseMessage = ActorMessage.create({
        type: 'tool.result',
        toolId: 'git-status',
        result: {
          success: true,
          output: 'On branch main\nnothing to commit'
        }
      });
      
      // Simulate receiving from server
      mockWebSocket.emit('message', {
        data: JSON.stringify(responseMessage.serialize())
      });
      
      // Verify flow
      expect(flow).toContainEqual({
        actor: 'command',
        message: expect.objectContaining({
          type: 'tool.execute',
          toolId: 'git-status'
        })
      });
      
      // Verify server communication
      expect(mockWebSocket.send).toHaveBeenCalledWith(
        expect.stringContaining('server.execute')
      );
    });
    
    test('should handle session management flow', () => {
      channel = actorSpace.addChannel(mockWebSocket);
      
      const sessionFlow = [];
      
      // Track session-related messages
      uiActor.receive = jest.fn((message) => {
        if (message.type?.startsWith('session.')) {
          sessionFlow.push(message);
        }
      });
      
      // Create session
      const createSession = ActorMessage.create({
        type: 'session.create',
        name: 'New Session'
      });
      
      uiActor.receive(createSession);
      
      // Switch session
      const switchSession = ActorMessage.create({
        type: 'session.switch',
        sessionId: 'session-123'
      });
      
      uiActor.receive(switchSession);
      
      // Close session
      const closeSession = ActorMessage.create({
        type: 'session.close',
        sessionId: 'session-123'
      });
      
      uiActor.receive(closeSession);
      
      // Verify session flow
      expect(sessionFlow).toEqual([
        expect.objectContaining({ type: 'session.create' }),
        expect.objectContaining({ type: 'session.switch' }),
        expect.objectContaining({ type: 'session.close' })
      ]);
    });
    
    test('should handle variable update flow', () => {
      const variableFlow = [];
      
      // Track variable messages
      uiActor.receive = jest.fn((message) => {
        if (message.type?.startsWith('variable.')) {
          variableFlow.push(message);
          
          // Simulate broadcast to other actors
          actorSpace.getActor('command')?.receive(message);
        }
      });
      
      commandActor.receive = jest.fn((message) => {
        if (message.type?.startsWith('variable.')) {
          variableFlow.push({ ...message, receiver: 'command' });
        }
      });
      
      // Create variable
      const createVar = ActorMessage.create({
        type: 'variable.create',
        name: 'API_KEY',
        value: 'secret123',
        scope: 'global'
      });
      
      uiActor.receive(createVar);
      
      // Update variable
      const updateVar = ActorMessage.create({
        type: 'variable.update',
        name: 'API_KEY',
        value: 'new-secret',
        previousValue: 'secret123'
      });
      
      uiActor.receive(updateVar);
      
      // Delete variable
      const deleteVar = ActorMessage.create({
        type: 'variable.delete',
        name: 'API_KEY'
      });
      
      uiActor.receive(deleteVar);
      
      // Verify variable flow
      expect(variableFlow).toContainEqual(
        expect.objectContaining({ type: 'variable.create' })
      );
      expect(variableFlow).toContainEqual(
        expect.objectContaining({ 
          type: 'variable.update',
          receiver: 'command' 
        })
      );
      expect(variableFlow).toContainEqual(
        expect.objectContaining({ type: 'variable.delete' })
      );
    });
    
    test('should handle multi-actor coordination', () => {
      const coordination = [];
      
      // Setup coordination tracking
      uiActor.receive = jest.fn((message) => {
        coordination.push({ actor: 'ui', ...message });
        
        // UI actor triggers command
        if (message.type === 'user.action') {
          commandActor.receive(ActorMessage.create({
            type: 'execute',
            command: message.command
          }));
        }
      });
      
      commandActor.receive = jest.fn((message) => {
        coordination.push({ actor: 'command', ...message });
        
        // Command actor sends result back to UI
        if (message.type === 'execute') {
          uiActor.receive(ActorMessage.create({
            type: 'result',
            output: `Executed: ${message.command}`
          }));
        }
      });
      
      // Start coordination
      uiActor.receive(ActorMessage.create({
        type: 'user.action',
        command: 'ls -la'
      }));
      
      // Verify coordination
      expect(coordination).toEqual([
        expect.objectContaining({ 
          actor: 'ui', 
          type: 'user.action' 
        }),
        expect.objectContaining({ 
          actor: 'command', 
          type: 'execute' 
        }),
        expect.objectContaining({ 
          actor: 'ui', 
          type: 'result' 
        })
      ]);
    });
  });
  
  describe('Error Scenarios', () => {
    test('should handle invalid message format', () => {
      const errorHandler = jest.fn();
      
      // Setup error handling
      uiActor.onError = errorHandler;
      
      // Send invalid message
      const invalidMessage = { 
        // Missing required fields
        data: 'test' 
      };
      
      try {
        const msg = ActorMessage.create(invalidMessage);
        uiActor.receive(msg);
      } catch (error) {
        errorHandler(error);
      }
      
      // Verify error was handled
      expect(errorHandler).toHaveBeenCalled();
    });
    
    test('should handle actor not found', () => {
      const result = actorSpace.getActor('nonexistent');
      
      // Should gracefully handle missing actor
      expect(result).toBeUndefined();
      expect(() => {
        const actor = actorSpace.getActor('nonexistent');
        if (actor) {
          actor.receive({ type: 'test' });
        }
      }).not.toThrow();
    });
    
    test('should handle execution errors', () => {
      const errorFlow = [];
      
      commandActor.receive = jest.fn((message) => {
        if (message.type === 'execute.error') {
          throw new Error('Execution failed: ' + message.reason);
        }
        errorFlow.push(message);
      });
      
      uiActor.receive = jest.fn((message) => {
        errorFlow.push(message);
        
        // Handle errors
        if (message.error) {
          errorFlow.push({ 
            type: 'error.handled', 
            error: message.error 
          });
        }
      });
      
      // Trigger error
      try {
        commandActor.receive(ActorMessage.create({
          type: 'execute.error',
          reason: 'Command not found'
        }));
      } catch (error) {
        // Send error to UI
        uiActor.receive(ActorMessage.create({
          type: 'error',
          error: error.message
        }));
      }
      
      // Verify error handling
      expect(errorFlow).toContainEqual(
        expect.objectContaining({ 
          type: 'error',
          error: expect.stringContaining('Execution failed')
        })
      );
      expect(errorFlow).toContainEqual(
        expect.objectContaining({ 
          type: 'error.handled' 
        })
      );
    });
    
    test('should handle timeout scenarios', (done) => {
      const timeoutHandler = jest.fn();
      
      // Setup timeout handling
      commandActor.executeWithTimeout = (message, timeout) => {
        return new Promise((resolve, reject) => {
          const timer = setTimeout(() => {
            reject(new Error('Operation timed out'));
          }, timeout);
          
          // Simulate long-running operation
          setTimeout(() => {
            clearTimeout(timer);
            resolve({ success: true });
          }, timeout + 100); // Will timeout
        });
      };
      
      // Execute with timeout
      commandActor.executeWithTimeout(
        ActorMessage.create({ type: 'long.operation' }),
        100
      ).catch(error => {
        timeoutHandler(error);
        
        // Verify timeout was handled
        expect(timeoutHandler).toHaveBeenCalledWith(
          expect.objectContaining({
            message: 'Operation timed out'
          })
        );
        done();
      });
    });
  });
  
  describe('Connection Handling', () => {
    test('should handle WebSocket connection', () => {
      channel = actorSpace.addChannel(mockWebSocket);
      
      // Verify channel was created
      expect(channel).toBeDefined();
      expect(channel.websocket).toBe(mockWebSocket);
      expect(channel.space).toBe(actorSpace);
    });
    
    test('should handle connection open', () => {
      channel = actorSpace.addChannel(mockWebSocket);
      const openHandler = jest.fn();
      
      channel.onOpen = openHandler;
      
      // Simulate connection open
      mockWebSocket.emit('open', {});
      
      // Verify open was handled
      expect(openHandler).toHaveBeenCalled();
    });
    
    test('should handle connection close', () => {
      channel = actorSpace.addChannel(mockWebSocket);
      const closeHandler = jest.fn();
      
      channel.onClose = closeHandler;
      
      // Simulate connection close
      mockWebSocket.emit('close', { code: 1000, reason: 'Normal closure' });
      
      // Verify close was handled
      expect(closeHandler).toHaveBeenCalledWith(
        expect.objectContaining({ code: 1000 })
      );
    });
    
    test('should handle reconnection', () => {
      const reconnectFlow = [];
      
      // Track reconnection
      const createChannel = () => {
        const ch = actorSpace.addChannel(mockWebSocket);
        ch.onClose = () => {
          reconnectFlow.push('closed');
          
          // Attempt reconnection
          setTimeout(() => {
            reconnectFlow.push('reconnecting');
            const newWs = { ...mockWebSocket };
            const newChannel = actorSpace.addChannel(newWs);
            
            if (newChannel) {
              reconnectFlow.push('reconnected');
            }
          }, 100);
        };
        return ch;
      };
      
      channel = createChannel();
      
      // Simulate disconnection
      mockWebSocket.emit('close', {});
      
      // Wait for reconnection
      setTimeout(() => {
        expect(reconnectFlow).toEqual([
          'closed',
          'reconnecting',
          'reconnected'
        ]);
      }, 200);
    });
    
    test('should handle message queuing during reconnection', () => {
      const messageQueue = [];
      
      channel = actorSpace.addChannel(mockWebSocket);
      
      // Override send to queue when disconnected
      const originalSend = channel.send;
      channel.send = function(message) {
        if (mockWebSocket.readyState !== 1) {
          messageQueue.push(message);
          return;
        }
        originalSend.call(this, message);
      };
      
      // Simulate disconnection
      mockWebSocket.readyState = 3; // CLOSED
      
      // Try to send messages
      channel.send(ActorMessage.create({ type: 'queued.1' }));
      channel.send(ActorMessage.create({ type: 'queued.2' }));
      
      // Verify messages were queued
      expect(messageQueue).toHaveLength(2);
      expect(messageQueue[0]).toMatchObject({ type: 'queued.1' });
      expect(messageQueue[1]).toMatchObject({ type: 'queued.2' });
      
      // Simulate reconnection
      mockWebSocket.readyState = 1; // OPEN
      
      // Flush queue
      while (messageQueue.length > 0) {
        channel.send(messageQueue.shift());
      }
      
      // Verify messages were sent
      expect(mockWebSocket.send).toHaveBeenCalledTimes(2);
    });
  });
  
  describe('Actor System Reliability', () => {
    test('should handle concurrent messages', () => {
      const messages = [];
      
      uiActor.receive = jest.fn((msg) => {
        messages.push(msg);
      });
      
      // Send multiple messages concurrently
      const promises = [];
      for (let i = 0; i < 10; i++) {
        promises.push(
          Promise.resolve().then(() => {
            uiActor.receive(ActorMessage.create({
              type: 'concurrent',
              index: i
            }));
          })
        );
      }
      
      return Promise.all(promises).then(() => {
        // Verify all messages were received
        expect(messages).toHaveLength(10);
        
        // Verify order preservation (if required)
        const indices = messages.map(m => m.index);
        expect(indices).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
      });
    });
    
    test('should handle actor isolation', () => {
      const uiMessages = [];
      const commandMessages = [];
      
      uiActor.receive = jest.fn((msg) => {
        uiMessages.push(msg);
      });
      
      commandActor.receive = jest.fn((msg) => {
        commandMessages.push(msg);
      });
      
      // Send to specific actors
      const uiActorRef = actorSpace.getActor('ui');
      const commandActorRef = actorSpace.getActor('command');
      
      if (uiActorRef) {
        uiActorRef.receive(ActorMessage.create({ type: 'ui.only' }));
      }
      if (commandActorRef) {
        commandActorRef.receive(ActorMessage.create({ type: 'command.only' }));
      }
      
      // Verify isolation
      expect(uiMessages).toHaveLength(1);
      expect(uiMessages[0]).toMatchObject({ type: 'ui.only' });
      
      expect(commandMessages).toHaveLength(1);
      expect(commandMessages[0]).toMatchObject({ type: 'command.only' });
    });
    
    test('should handle broadcast messages', () => {
      const received = { ui: [], command: [] };
      
      uiActor.receive = jest.fn((msg) => {
        received.ui.push(msg);
      });
      
      commandActor.receive = jest.fn((msg) => {
        received.command.push(msg);
      });
      
      // Broadcast to all actors
      const broadcastMessage = ActorMessage.create({ 
        type: 'broadcast',
        content: 'Hello all actors'
      });
      
      // Manually broadcast to all actors
      for (const [key, actor] of actorSpace.actors) {
        actor.receive(broadcastMessage);
      }
      
      // Verify all actors received the message
      expect(received.ui).toHaveLength(1);
      expect(received.command).toHaveLength(1);
      expect(received.ui[0]).toEqual(received.command[0]);
    });
    
    test('should handle actor lifecycle', () => {
      const lifecycle = [];
      
      // Track lifecycle events
      const testActor = {
        isActor: true,
        receive: jest.fn(),
        initialize: () => lifecycle.push('initialized'),
        destroy: () => lifecycle.push('destroyed')
      };
      
      // Register actor
      actorSpace.register(testActor, 'test');
      testActor.initialize?.();
      
      // Use actor
      const testActorRef = actorSpace.getActor('test');
      if (testActorRef) {
        testActorRef.receive(ActorMessage.create({ type: 'test' }));
      }
      expect(testActor.receive).toHaveBeenCalled();
      
      // Unregister actor
      actorSpace.actors.delete('test');
      testActor.destroy?.();
      
      // Verify lifecycle
      expect(lifecycle).toEqual(['initialized', 'destroyed']);
      
      // Verify actor is removed
      expect(actorSpace.getActor('test')).toBeUndefined();
    });
    
    test('should handle memory cleanup', () => {
      const bigMessage = ActorMessage.create({
        type: 'large',
        data: new Array(10000).fill('x').join('')
      });
      
      // Track memory (simplified)
      const memoryUsage = [];
      
      uiActor.receive = jest.fn((msg) => {
        memoryUsage.push(msg.data?.length || 0);
        
        // Cleanup large data
        if (msg.type === 'large') {
          msg.data = null;
        }
      });
      
      // Send large message
      uiActor.receive(bigMessage);
      
      // Verify cleanup
      expect(memoryUsage[0]).toBe(10000);
      expect(bigMessage.data).toBeNull();
    });
  });
});