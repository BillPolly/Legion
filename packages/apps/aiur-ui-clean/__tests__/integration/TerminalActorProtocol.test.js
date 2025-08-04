/**
 * Integration tests for TerminalActor ↔ TerminalAgent protocol
 * Tests the complete actor protocol flow with mock WebSockets
 */

import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { MockWebSocket } from '../utils/MockWebSocket.js';
import { ActorSpace } from '../../../../shared/actors/src/ActorSpace.js';
import { TerminalActor } from '../../src/actors/TerminalActor.js';
import { TerminalAgent } from '../../../../aiur/src/agents/TerminalAgent.js';

describe('TerminalActor ↔ TerminalAgent Protocol Integration', () => {
  let serverWS, clientWS;
  let serverSpace, clientSpace;
  let terminalAgent, terminalActor;
  let mockTerminal, mockSessionManager, mockModuleLoader;
  
  beforeEach(() => {
    // Create mock WebSocket pair
    ({ serverWS, clientWS } = MockWebSocket.createPair());
    
    // Create ActorSpaces
    serverSpace = new ActorSpace('server-test');
    clientSpace = new ActorSpace('client-test');
    
    // Create mock dependencies
    mockTerminal = {
      addOutput: jest.fn(),
      clear: jest.fn(),
      updateToolDefinitions: jest.fn()
    };
    
    mockSessionManager = {
      createSession: jest.fn().mockResolvedValue({
        sessionId: 'test-session-123',
        created: new Date().toISOString(),
        capabilities: ['tool_execution'],
        toolProvider: {
          getAllToolDefinitions: jest.fn().mockResolvedValue([
            { name: 'test_tool', description: 'A test tool' }
          ])
        }
      }),
      getSession: jest.fn(),
      executeTool: jest.fn()
    };
    
    mockModuleLoader = {
      getAllTools: jest.fn().mockResolvedValue([]),
      loadModuleByName: jest.fn(),
      unloadModule: jest.fn(),
      getLoadedModuleNames: jest.fn().mockReturnValue(['system']),
      getAvailableModules: jest.fn().mockReturnValue(['file', 'git', 'railway'])
    };
    
    // Create actors
    terminalAgent = new TerminalAgent({
      sessionManager: mockSessionManager,
      moduleLoader: mockModuleLoader
    });
    
    terminalActor = new TerminalActor(mockTerminal);
    
    // Register actors in their spaces
    serverSpace.register(terminalAgent, 'server-terminal');
    clientSpace.register(terminalActor, 'client-terminal');
  });
  
  describe('handshake protocol', () => {
    test('should complete multi-actor handshake', async () => {
      // Simulate server sending initial handshake
      const serverHandshake = {
        type: 'actor_handshake',
        serverActors: {
          chat: 'server-chat',
          terminal: 'server-terminal'
        }
      };
      
      // Client receives handshake
      clientWS.simulateMessage(serverHandshake);
      
      // Client should send acknowledgment
      await new Promise(resolve => setTimeout(resolve, 10));
      const clientAck = clientWS.getLastSentMessage();
      
      expect(clientAck).toEqual({
        type: 'actor_handshake_ack',
        clientActors: {
          chat: 'client-chat',
          terminal: 'client-terminal'
        }
      });
      
      // Server receives acknowledgment and creates channels
      const serverChannel = serverSpace.addChannel(serverWS);
      const clientChannel = clientSpace.addChannel(clientWS);
      
      // Create RemoteActor references
      const serverRemoteActor = serverChannel.makeRemote('client-terminal');
      const clientRemoteActor = clientChannel.makeRemote('server-terminal');
      
      terminalAgent.remoteActor = serverRemoteActor;
      terminalActor.setRemoteAgent(clientRemoteActor);
      
      expect(terminalActor.connected).toBe(true);
      expect(terminalAgent.remoteActor).toBeDefined();
    });
  });
  
  describe('complete terminal flow', () => {
    beforeEach(async () => {
      // Set up actor protocol connections
      const serverChannel = serverSpace.addChannel(serverWS);
      const clientChannel = clientSpace.addChannel(clientWS);
      
      const serverRemoteActor = serverChannel.makeRemote('client-terminal');
      const clientRemoteActor = clientChannel.makeRemote('server-terminal');
      
      terminalAgent.remoteActor = serverRemoteActor;
      terminalActor.setRemoteAgent(clientRemoteActor);
    });
    
    test('should handle session creation flow', async () => {
      // TerminalActor sends session_create
      terminalActor.sendCommand(''); // Empty command triggers session creation in setRemoteAgent
      
      // Wait for async message processing
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Verify session was created
      expect(mockSessionManager.createSession).toHaveBeenCalled();
      expect(terminalActor.sessionId).toBe('test-session-123');
      expect(mockTerminal.addOutput).toHaveBeenCalledWith(
        'Session created: test-session-123',
        'success'
      );
    });
    
    test('should handle tools list request', async () => {
      // Set up session first
      terminalAgent.session = {
        sessionId: 'test-session',
        toolProvider: {
          getAllToolDefinitions: jest.fn().mockResolvedValue([
            { name: 'file_read', description: 'Read a file' },
            { name: 'file_write', description: 'Write a file' }
          ])
        }
      };
      terminalAgent.sessionId = 'test-session';
      
      // Send tools list command
      terminalActor.sendCommand('tools');
      
      // Wait for async processing
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Verify tools were received and displayed
      expect(terminalActor.toolDefinitions.size).toBe(2);
      expect(terminalActor.toolDefinitions.has('file_read')).toBe(true);
      expect(terminalActor.toolDefinitions.has('file_write')).toBe(true);
      expect(mockTerminal.updateToolDefinitions).toHaveBeenCalled();
    });
    
    test('should handle module load flow', async () => {
      // Set up session
      terminalAgent.session = { sessionId: 'test-session' };
      terminalAgent.sessionId = 'test-session';
      
      // Mock module load result
      mockSessionManager.executeTool.mockResolvedValue({
        success: true,
        message: 'Module file loaded',
        toolsLoaded: ['file_read', 'file_write', 'directory_list']
      });
      
      // Send module load command
      terminalActor.sendCommand('module_load file');
      
      // Wait for async processing
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Verify module was loaded
      expect(mockSessionManager.executeTool).toHaveBeenCalledWith(
        'module_load',
        { name: 'file' }
      );
      expect(mockTerminal.addOutput).toHaveBeenCalledWith(
        'Module file loaded',
        'success'
      );
      expect(mockTerminal.addOutput).toHaveBeenCalledWith(
        'Added 3 tools',
        'info'
      );
    });
    
    test('should handle tool execution flow', async () => {
      // Set up session
      terminalAgent.session = { sessionId: 'test-session' };
      terminalAgent.sessionId = 'test-session';
      
      // Mock tool execution result
      mockSessionManager.executeTool.mockResolvedValue({
        content: 'File contents here',
        filepath: '/test.txt',
        size: 100
      });
      
      // Send tool execution command
      terminalActor.sendCommand('file_read path=/test.txt');
      
      // Wait for async processing
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Verify tool was executed
      expect(mockSessionManager.executeTool).toHaveBeenCalledWith(
        'file_read',
        { path: '/test.txt' }
      );
      
      // Verify result was displayed (formatted output)
      expect(mockTerminal.addOutput).toHaveBeenCalled();
    });
    
    test('should handle module list flow', async () => {
      // Set up session
      terminalAgent.session = { sessionId: 'test-session' };
      terminalAgent.sessionId = 'test-session';
      
      // Mock module list result
      mockSessionManager.executeTool.mockResolvedValue({
        modules: {
          loaded: ['system', 'file'],
          available: ['git', 'railway', 'github']
        }
      });
      
      // Send module list command
      terminalActor.sendCommand('modules');
      
      // Wait for async processing
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Verify modules were listed
      expect(mockSessionManager.executeTool).toHaveBeenCalledWith(
        'module_list',
        {}
      );
      expect(mockTerminal.addOutput).toHaveBeenCalledWith(
        'Loaded modules:',
        'info'
      );
      expect(mockTerminal.addOutput).toHaveBeenCalledWith(
        '   ✓ system',
        'success'
      );
      expect(mockTerminal.addOutput).toHaveBeenCalledWith(
        '   ✓ file',
        'success'
      );
    });
  });
  
  describe('error handling', () => {
    beforeEach(async () => {
      // Set up actor protocol connections
      const serverChannel = serverSpace.addChannel(serverWS);
      const clientChannel = clientSpace.addChannel(clientWS);
      
      const serverRemoteActor = serverChannel.makeRemote('client-terminal');
      const clientRemoteActor = clientChannel.makeRemote('server-terminal');
      
      terminalAgent.remoteActor = serverRemoteActor;
      terminalActor.setRemoteAgent(clientRemoteActor);
      
      // Set up session
      terminalAgent.session = { sessionId: 'test-session' };
      terminalAgent.sessionId = 'test-session';
    });
    
    test('should handle tool execution error', async () => {
      // Mock tool execution error
      mockSessionManager.executeTool.mockRejectedValue(
        new Error('File not found')
      );
      
      // Send tool execution command
      terminalActor.sendCommand('file_read path=/nonexistent.txt');
      
      // Wait for async processing
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Verify error was displayed
      expect(mockTerminal.addOutput).toHaveBeenCalledWith(
        'Tool error: File not found',
        'error'
      );
    });
    
    test('should handle module load error', async () => {
      // Mock module load error
      mockSessionManager.executeTool.mockRejectedValue(
        new Error('Module not found: unknown_module')
      );
      
      // Send module load command
      terminalActor.sendCommand('module_load unknown_module');
      
      // Wait for async processing
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Verify error was displayed
      expect(mockTerminal.addOutput).toHaveBeenCalledWith(
        'Module error: Module not found: unknown_module',
        'error'
      );
    });
    
    test('should handle session error', async () => {
      // Clear session to trigger error
      terminalAgent.session = null;
      terminalAgent.sessionId = null;
      
      // Send tool command without session
      terminalActor.sendCommand('file_read path=/test.txt');
      
      // Wait for async processing
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Verify error was displayed
      expect(mockTerminal.addOutput).toHaveBeenCalledWith(
        'Tool error: No active session',
        'error'
      );
    });
  });
  
  describe('ping/pong keepalive', () => {
    beforeEach(async () => {
      // Set up actor protocol connections
      const serverChannel = serverSpace.addChannel(serverWS);
      const clientChannel = clientSpace.addChannel(clientWS);
      
      const serverRemoteActor = serverChannel.makeRemote('client-terminal');
      const clientRemoteActor = clientChannel.makeRemote('server-terminal');
      
      terminalAgent.remoteActor = serverRemoteActor;
      terminalActor.setRemoteAgent(clientRemoteActor);
    });
    
    test('should respond to ping with pong', async () => {
      // Send ping command
      terminalActor.sendCommand('ping');
      
      // Wait for async processing
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Check for pong response
      const messages = serverWS.sentMessages;
      const pongMessage = messages.find(m => 
        m.targetGuid === 'client-terminal' && 
        m.payload?.type === 'pong'
      );
      
      expect(pongMessage).toBeDefined();
      expect(pongMessage.payload.timestamp).toBeDefined();
    });
  });
  
  describe('initial tools sending', () => {
    test('should send initial tools after connection', async () => {
      // Set up actor protocol connections
      const serverChannel = serverSpace.addChannel(serverWS);
      const clientChannel = clientSpace.addChannel(clientWS);
      
      const serverRemoteActor = serverChannel.makeRemote('client-terminal');
      const clientRemoteActor = clientChannel.makeRemote('server-terminal');
      
      terminalAgent.remoteActor = serverRemoteActor;
      
      // Set up session with tools
      terminalAgent.session = {
        sessionId: 'test-session',
        toolProvider: {
          getAllToolDefinitions: jest.fn().mockResolvedValue([
            { name: 'custom_tool', description: 'Custom tool' }
          ])
        }
      };
      
      // Send initial tools
      await terminalAgent.sendInitialTools();
      
      // Wait for message to be sent
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Check that initial tools were sent
      const messages = serverWS.sentMessages;
      const initialToolsMessage = messages.find(m => 
        m.targetGuid === 'client-terminal' && 
        m.payload?.type === 'initial_tools'
      );
      
      expect(initialToolsMessage).toBeDefined();
      expect(initialToolsMessage.payload.tools).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: 'module_list' }),
          expect.objectContaining({ name: 'module_load' }),
          expect.objectContaining({ name: 'module_unload' }),
          expect.objectContaining({ name: 'custom_tool' })
        ])
      );
    });
  });
});