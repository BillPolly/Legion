/**
 * Test ChatAgent through the full actor interface
 * This simulates how the frontend would interact with ChatAgent
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { ResourceManager, ModuleLoader } from '@legion/module-loader';
import { ServerActorSpace } from '../../src/server/ServerActorSpace.js';
import { ActorSpace } from '../../../shared/actors/src/ActorSpace.js';
import { Actor } from '../../../shared/actors/src/Actor.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Mock WebSocket for testing
class MockWebSocket {
  constructor() {
    this.sentMessages = [];
    this.listeners = new Map();
    this.readyState = 1; // OPEN
  }
  
  send(data) {
    this.sentMessages.push(JSON.parse(data));
    // Echo back to paired socket if set
    if (this.pairedSocket && this.pairedSocket.onmessage) {
      this.pairedSocket.onmessage({ data });
    }
  }
  
  on(event, handler) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(handler);
  }
  
  once(event, handler) {
    const wrapper = (...args) => {
      handler(...args);
      this.off(event, wrapper);
    };
    this.on(event, wrapper);
  }
  
  off(event, handler) {
    if (this.listeners.has(event)) {
      const handlers = this.listeners.get(event);
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    }
  }
  
  emit(event, ...args) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).forEach(handler => handler(...args));
    }
  }
  
  close() {
    this.readyState = 3; // CLOSED
  }
}

// Mock ChatActor that will receive messages from ChatAgent
class MockChatActor extends Actor {
  constructor() {
    super();
    this.receivedMessages = [];
  }
  
  receive(payload) {
    console.log('MockChatActor received:', payload.type || payload.eventName, 
      payload.content ? payload.content.substring(0, 50) + '...' : '');
    this.receivedMessages.push(payload);
  }
}

describe('ChatAgent Actor Interface Test', () => {
  let resourceManager;
  let moduleLoader;
  let serverActorSpace;
  let clientActorSpace;
  let serverWs;
  let clientWs;
  let mockChatActor;
  const testFile = path.join(__dirname, '../tmp/test-actor-hello.txt');
  
  beforeAll(async () => {
    // Initialize ResourceManager and ModuleLoader
    resourceManager = ResourceManager.getInstance();
    await resourceManager.initialize();
    
    moduleLoader = new ModuleLoader(resourceManager);
    await moduleLoader.initialize();
    
    // Load file module for tools
    const { default: FileModule } = await import('../../../general-tools/src/file/FileModule.js');
    await moduleLoader.loadModuleByName('file', FileModule);
    
    // Create mock WebSocket pair
    serverWs = new MockWebSocket();
    clientWs = new MockWebSocket();
    serverWs.pairedSocket = clientWs;
    clientWs.pairedSocket = serverWs;
    
    // Set up message forwarding
    clientWs.onmessage = (event) => {
      serverWs.emit('message', event.data);
    };
    serverWs.onmessage = (event) => {
      clientWs.emit('message', event.data);
    };
  });
  
  afterAll(async () => {
    // Clean up test file
    try {
      await fs.unlink(testFile);
      console.log('Cleaned up test file');
    } catch (error) {
      // File might not exist
    }
  });
  
  it('should establish actor connection and handshake', async () => {
    // Create server-side ActorSpace with ChatAgent
    serverActorSpace = new ServerActorSpace('test-server', {
      sessionManager: null,
      moduleLoader: moduleLoader,
      resourceManager: resourceManager
    });
    
    // Create client-side ActorSpace
    clientActorSpace = new ActorSpace('test-client');
    
    // Create and register mock ChatActor on client side
    mockChatActor = new MockChatActor();
    const clientChatGuid = 'test-client-chat';
    clientActorSpace.register(mockChatActor, clientChatGuid);
    
    // Server initiates connection (sends handshake)
    serverActorSpace.handleConnection(serverWs, 'test-client-id');
    
    // Check that handshake was sent
    expect(serverWs.sentMessages.length).toBeGreaterThan(0);
    const handshake = serverWs.sentMessages[0];
    expect(handshake.type).toBe('actor_handshake');
    expect(handshake.serverActors).toBeDefined();
    expect(handshake.serverActors.chat).toBeDefined();
    
    // Client responds with handshake ACK
    const handshakeAck = {
      type: 'actor_handshake_ack',
      clientActors: {
        chat: clientChatGuid,
        terminal: 'test-client-terminal'
      }
    };
    
    // Send handshake ACK
    serverWs.emit('message', JSON.stringify(handshakeAck));
    
    // Initialize ChatAgent
    await serverActorSpace.chatAgent.initialize();
    
    // Verify ChatAgent is ready
    expect(serverActorSpace.chatAgent).toBeDefined();
    expect(serverActorSpace.chatAgent.llmClient).toBeDefined();
    expect(serverActorSpace.chatAgent.moduleLoader).toBeDefined();
  });
  
  it('should process chat message through actor interface', async () => {
    // Create client channel after handshake
    const channel = clientActorSpace.addChannel(clientWs);
    
    // Get server chat GUID from handshake
    const serverChatGuid = serverWs.sentMessages[0].serverActors.chat;
    
    // Create RemoteActor for server's ChatAgent
    const remoteChatAgent = channel.makeRemote(serverChatGuid);
    
    // Send a simple message through the actor interface
    await remoteChatAgent.receive({
      type: 'chat_message',
      content: 'Say "Hello from actor interface!" and nothing else.'
    });
    
    // Wait for response
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Check that mock actor received response
    const responseMessage = mockChatActor.receivedMessages.find(
      m => m.type === 'chat_response' || m.eventName === 'message'
    );
    expect(responseMessage).toBeDefined();
    expect(responseMessage.content).toContain('Hello from actor interface');
    
    console.log('Received response through actor interface:', responseMessage.content);
  }, 30000);
  
  it('should use tools through actor interface to write file', async () => {
    // Clear previous messages
    mockChatActor.receivedMessages = [];
    
    // Get server chat GUID from handshake
    const serverChatGuid = serverWs.sentMessages[0].serverActors.chat;
    
    // Create RemoteActor for server's ChatAgent
    const channel = clientActorSpace.channels[0]; // Get existing channel
    const remoteChatAgent = channel.makeRemote(serverChatGuid);
    
    // Create tmp directory if needed
    const tmpDir = path.dirname(testFile);
    try {
      await fs.mkdir(tmpDir, { recursive: true });
    } catch (error) {
      // Directory might exist
    }
    
    // Send message to write file through actor interface
    await remoteChatAgent.receive({
      type: 'chat_message',
      content: `Please write "hello world from actors" to the file: ${testFile}
      Use the file_operations tool with operation: 'write'.`
    });
    
    // Wait for tool execution and response
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Check that tool was executed
    const toolMessage = mockChatActor.receivedMessages.find(
      m => m.eventName === 'tool_executed'
    );
    expect(toolMessage).toBeDefined();
    expect(toolMessage.tool).toBe('file_operations');
    expect(toolMessage.success).toBe(true);
    
    // Check that we got a response
    const responseMessage = mockChatActor.receivedMessages.find(
      m => m.type === 'chat_response' || m.eventName === 'message'
    );
    expect(responseMessage).toBeDefined();
    
    // Verify the file was actually created
    const fileContent = await fs.readFile(testFile, 'utf-8');
    expect(fileContent).toBe('hello world from actors');
    
    console.log('File written through actor interface:', fileContent);
    console.log('ChatAgent response:', responseMessage.content);
  }, 30000);
});