/**
 * Test ChatAgent writing "hello world" to a file through the actor interface
 * This test ensures the ChatAgent actually uses the file_operations tool
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
    console.log('MockChatActor received:', payload.type || payload.eventName);
    if (payload.content) {
      console.log('  Content:', payload.content.substring(0, 100));
    }
    if (payload.tool) {
      console.log('  Tool executed:', payload.tool, 'Success:', payload.success);
    }
    this.receivedMessages.push(payload);
  }
}

describe('ChatAgent Write File Through Actor Interface', () => {
  let resourceManager;
  let moduleLoader;
  let serverActorSpace;
  let clientActorSpace;
  let serverWs;
  let clientWs;
  let mockChatActor;
  let remoteChatAgent;
  const testFile = path.join(__dirname, '../tmp/hello-world-actor.txt');
  
  beforeAll(async () => {
    // Initialize ResourceManager and ModuleLoader
    resourceManager = new ResourceManager();
    await resourceManager.initialize();
    
    moduleLoader = new ModuleLoader(resourceManager);
    await moduleLoader.initialize();
    
    // Load file module for tools
    const { default: FileModule } = await import('../../../general-tools/src/file/FileModule.js');
    await moduleLoader.loadModuleByName('file', FileModule);
    
    console.log('Loaded modules:', moduleLoader.getLoadedModuleNames());
    
    // Create tmp directory if needed
    const tmpDir = path.dirname(testFile);
    try {
      await fs.mkdir(tmpDir, { recursive: true });
    } catch (error) {
      // Directory might exist
    }
    
    // Clean up any existing test file
    try {
      await fs.unlink(testFile);
    } catch (error) {
      // File might not exist
    }
  });
  
  afterAll(async () => {
    // Don't clean up - leave file for inspection
    console.log('Test file remains at:', testFile);
  });
  
  it('should set up actor connection and initialize ChatAgent', async () => {
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
    
    // Get server chat GUID from handshake
    const handshake = serverWs.sentMessages[0];
    const serverChatGuid = handshake.serverActors.chat;
    
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
    
    // Wait for connection to be established
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Initialize ChatAgent
    await serverActorSpace.chatAgent.initialize();
    
    // Create client channel and remote actor
    const channel = clientActorSpace.addChannel(clientWs);
    remoteChatAgent = channel.makeRemote(serverChatGuid);
    
    expect(serverActorSpace.chatAgent).toBeDefined();
    expect(serverActorSpace.chatAgent.llmClient).toBeDefined();
    expect(remoteChatAgent).toBeDefined();
    
    console.log('Actor connection established and ChatAgent initialized');
  });
  
  it('should write "hello world" to a file using file_operations tool', async () => {
    // Clear previous messages
    mockChatActor.receivedMessages = [];
    
    // Send a natural request that should trigger tool use
    const prompt = `Please write "hello world" to a file for me. Save it to: ${testFile}`;
    
    console.log('\nSending prompt to ChatAgent through actor interface...');
    
    // Send message through actor interface
    await remoteChatAgent.receive({
      type: 'chat_message',
      content: prompt
    });
    
    // Wait for tool execution and response
    console.log('Waiting for tool execution...');
    await new Promise(resolve => setTimeout(resolve, 8000));
    
    // Check that tool was executed
    const toolMessage = mockChatActor.receivedMessages.find(
      m => m.eventName === 'tool_executed' && m.tool === 'file_operations'
    );
    
    if (!toolMessage) {
      console.log('All received messages:', mockChatActor.receivedMessages.map(m => ({
        type: m.type || m.eventName,
        tool: m.tool,
        success: m.success
      })));
    }
    
    expect(toolMessage).toBeDefined();
    expect(toolMessage.tool).toBe('file_operations');
    expect(toolMessage.success).toBe(true);
    
    // Verify the file was actually created with correct content
    const fileExists = await fs.access(testFile).then(() => true).catch(() => false);
    expect(fileExists).toBe(true);
    
    const fileContent = await fs.readFile(testFile, 'utf-8');
    expect(fileContent).toBe('hello world');
    
    console.log('\n✅ SUCCESS! File written through actor interface:');
    console.log(`   Path: ${testFile}`);
    console.log(`   Content: "${fileContent}"`);
    
    // Check that we got a response confirming the action
    const responseMessage = mockChatActor.receivedMessages.find(
      m => m.type === 'chat_response' || m.eventName === 'message'
    );
    expect(responseMessage).toBeDefined();
    console.log('   ChatAgent response:', responseMessage.content);
  }, 30000);
});