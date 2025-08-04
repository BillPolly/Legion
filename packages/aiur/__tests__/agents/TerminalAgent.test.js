/**
 * Unit tests for TerminalAgent
 */

import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { TerminalAgent } from '../../src/agents/TerminalAgent.js';

describe('TerminalAgent', () => {
  let terminalAgent;
  let mockSessionManager;
  let mockModuleLoader;
  let mockRemoteActor;
  
  beforeEach(() => {
    // Create mock SessionManager
    mockSessionManager = {
      createSession: jest.fn(),
      getSession: jest.fn(),
      executeTool: jest.fn()
    };
    
    // Create mock ModuleLoader
    mockModuleLoader = {
      getAllTools: jest.fn(),
      loadModuleByName: jest.fn(),
      unloadModule: jest.fn(),
      getLoadedModuleNames: jest.fn(),
      getAvailableModules: jest.fn()
    };
    
    // Create mock RemoteActor
    mockRemoteActor = {
      receive: jest.fn()
    };
    
    terminalAgent = new TerminalAgent({
      sessionManager: mockSessionManager,
      moduleLoader: mockModuleLoader
    });
    
    terminalAgent.remoteActor = mockRemoteActor;
  });
  
  describe('initialization', () => {
    test('should initialize with session manager and module loader', () => {
      expect(terminalAgent.sessionManager).toBe(mockSessionManager);
      expect(terminalAgent.moduleLoader).toBe(mockModuleLoader);
      expect(terminalAgent.sessionId).toBeNull();
      expect(terminalAgent.session).toBeNull();
    });
  });
  
  describe('session management', () => {
    test('should handle session_create message', async () => {
      const sessionInfo = {
        sessionId: 'session_123',
        created: new Date().toISOString(),
        capabilities: ['tool_execution'],
        toolProvider: {
          getAllToolDefinitions: jest.fn().mockResolvedValue([])
        }
      };
      mockSessionManager.createSession.mockResolvedValue(sessionInfo);
      
      await terminalAgent.receive({
        type: 'session_create',
        requestId: 'req_123'
      });
      
      expect(mockSessionManager.createSession).toHaveBeenCalled();
      expect(terminalAgent.sessionId).toBe('session_123');
      expect(terminalAgent.session).toBe(sessionInfo);
      
      expect(mockRemoteActor.receive).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'session_created',
          requestId: 'req_123',
          sessionId: 'session_123',
          success: true
        })
      );
    });
    
    test('should handle session_create error', async () => {
      mockSessionManager.createSession.mockRejectedValue(
        new Error('Session creation failed')
      );
      
      await terminalAgent.receive({
        type: 'session_create',
        requestId: 'req_123'
      });
      
      expect(mockRemoteActor.receive).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'session_error',
          requestId: 'req_123',
          error: 'Session creation failed'
        })
      );
    });
    
    test('should handle session_attach message', async () => {
      const session = {
        sessionId: 'existing_session',
        created: new Date().toISOString(),
        toolProvider: {
          getAllToolDefinitions: jest.fn().mockResolvedValue([])
        }
      };
      mockSessionManager.getSession.mockResolvedValue(session);
      
      await terminalAgent.receive({
        type: 'session_attach',
        requestId: 'req_123',
        sessionId: 'existing_session'
      });
      
      expect(mockSessionManager.getSession).toHaveBeenCalledWith('existing_session');
      expect(terminalAgent.sessionId).toBe('existing_session');
      expect(terminalAgent.session).toBe(session);
      
      expect(mockRemoteActor.receive).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'session_attached',
          requestId: 'req_123',
          sessionId: 'existing_session',
          success: true
        })
      );
    });
    
    test('should handle session_attach with non-existent session', async () => {
      mockSessionManager.getSession.mockResolvedValue(null);
      
      await terminalAgent.receive({
        type: 'session_attach',
        requestId: 'req_123',
        sessionId: 'non_existent'
      });
      
      expect(mockRemoteActor.receive).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'session_error',
          requestId: 'req_123',
          error: 'Session non_existent not found'
        })
      );
    });
  });
  
  describe('tool operations', () => {
    beforeEach(() => {
      // Set up an active session
      terminalAgent.session = {
        sessionId: 'test_session',
        toolProvider: {
          getAllToolDefinitions: jest.fn().mockResolvedValue([
            { name: 'tool1', description: 'Tool 1' },
            { name: 'tool2', description: 'Tool 2' }
          ])
        }
      };
      terminalAgent.sessionId = 'test_session';
    });
    
    test('should handle tool_request message', async () => {
      const toolResult = { 
        success: true, 
        data: 'Tool executed successfully' 
      };
      mockSessionManager.executeTool.mockResolvedValue(toolResult);
      
      await terminalAgent.receive({
        type: 'tool_request',
        requestId: 'req_123',
        tool: 'test_tool',
        arguments: { param1: 'value1' }
      });
      
      expect(mockSessionManager.executeTool).toHaveBeenCalledWith(
        'test_tool',
        { param1: 'value1' }
      );
      
      expect(mockRemoteActor.receive).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'tool_response',
          requestId: 'req_123',
          tool: 'test_tool',
          result: toolResult
        })
      );
    });
    
    test('should handle tool_request error', async () => {
      mockSessionManager.executeTool.mockRejectedValue(
        new Error('Tool execution failed')
      );
      
      await terminalAgent.receive({
        type: 'tool_request',
        requestId: 'req_123',
        tool: 'failing_tool',
        arguments: {}
      });
      
      expect(mockRemoteActor.receive).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'tool_error',
          requestId: 'req_123',
          tool: 'failing_tool',
          error: 'Tool execution failed'
        })
      );
    });
    
    test('should handle tool_request without session', async () => {
      terminalAgent.session = null;
      
      await terminalAgent.receive({
        type: 'tool_request',
        requestId: 'req_123',
        tool: 'test_tool',
        arguments: {}
      });
      
      expect(mockSessionManager.executeTool).not.toHaveBeenCalled();
      expect(mockRemoteActor.receive).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'tool_error',
          requestId: 'req_123',
          tool: 'test_tool',
          error: 'No active session'
        })
      );
    });
    
    test('should handle tools_list message', async () => {
      await terminalAgent.receive({
        type: 'tools_list',
        requestId: 'req_123'
      });
      
      expect(mockRemoteActor.receive).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'tools_list_response',
          requestId: 'req_123',
          tools: [
            { name: 'tool1', description: 'Tool 1' },
            { name: 'tool2', description: 'Tool 2' }
          ]
        })
      );
    });
    
    test('should send initial tools after session creation', async () => {
      await terminalAgent.sendInitialTools();
      
      expect(mockRemoteActor.receive).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'initial_tools',
          tools: expect.arrayContaining([
            expect.objectContaining({ name: 'module_list' }),
            expect.objectContaining({ name: 'module_load' }),
            expect.objectContaining({ name: 'module_unload' }),
            expect.objectContaining({ name: 'tool1' }),
            expect.objectContaining({ name: 'tool2' })
          ])
        })
      );
    });
  });
  
  describe('module operations', () => {
    beforeEach(() => {
      terminalAgent.session = { sessionId: 'test_session' };
      terminalAgent.sessionId = 'test_session';
    });
    
    test('should handle module_list message', async () => {
      const moduleListResult = {
        modules: {
          loaded: ['module1', 'module2'],
          available: ['module3', 'module4']
        }
      };
      mockSessionManager.executeTool.mockResolvedValue(moduleListResult);
      
      await terminalAgent.receive({
        type: 'module_list',
        requestId: 'req_123'
      });
      
      expect(mockSessionManager.executeTool).toHaveBeenCalledWith(
        'module_list',
        {}
      );
      
      expect(mockRemoteActor.receive).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'module_list_response',
          requestId: 'req_123',
          modules: moduleListResult.modules
        })
      );
    });
    
    test('should handle module_load message', async () => {
      const loadResult = {
        success: true,
        message: 'Module loaded successfully',
        toolsLoaded: ['new_tool1', 'new_tool2']
      };
      mockSessionManager.executeTool.mockResolvedValue(loadResult);
      
      await terminalAgent.receive({
        type: 'module_load',
        requestId: 'req_123',
        moduleName: 'test_module'
      });
      
      expect(mockSessionManager.executeTool).toHaveBeenCalledWith(
        'module_load',
        { name: 'test_module' }
      );
      
      expect(mockRemoteActor.receive).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'module_loaded',
          requestId: 'req_123',
          moduleName: 'test_module',
          success: true,
          message: 'Module loaded successfully',
          toolsLoaded: ['new_tool1', 'new_tool2']
        })
      );
    });
    
    test('should handle module_unload message', async () => {
      const unloadResult = {
        success: true,
        message: 'Module unloaded successfully'
      };
      mockSessionManager.executeTool.mockResolvedValue(unloadResult);
      
      await terminalAgent.receive({
        type: 'module_unload',
        requestId: 'req_123',
        moduleName: 'test_module'
      });
      
      expect(mockSessionManager.executeTool).toHaveBeenCalledWith(
        'module_unload',
        { name: 'test_module' }
      );
      
      expect(mockRemoteActor.receive).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'module_unloaded',
          requestId: 'req_123',
          moduleName: 'test_module',
          success: true,
          message: 'Module unloaded successfully'
        })
      );
    });
    
    test('should handle module_load error', async () => {
      mockSessionManager.executeTool.mockRejectedValue(
        new Error('Module not found')
      );
      
      await terminalAgent.receive({
        type: 'module_load',
        requestId: 'req_123',
        moduleName: 'unknown_module'
      });
      
      expect(mockRemoteActor.receive).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'module_error',
          requestId: 'req_123',
          moduleName: 'unknown_module',
          error: 'Module not found'
        })
      );
    });
  });
  
  describe('ping/pong', () => {
    test('should respond to ping with pong', async () => {
      await terminalAgent.receive({
        type: 'ping',
        timestamp: 12345
      });
      
      expect(mockRemoteActor.receive).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'pong',
          timestamp: expect.any(Number)
        })
      );
    });
  });
  
  describe('error handling', () => {
    test('should handle unknown message types', async () => {
      await terminalAgent.receive({
        type: 'unknown_message_type',
        requestId: 'req_123',
        data: 'some data'
      });
      
      expect(mockRemoteActor.receive).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'error',
          error: 'Unknown message type: unknown_message_type',
          requestId: 'req_123'
        })
      );
    });
    
    test('should handle errors in message processing', async () => {
      // Force an error by not setting remoteActor
      terminalAgent.remoteActor = null;
      
      await terminalAgent.receive({
        type: 'ping'
      });
      
      // Should not throw, error should be caught
      expect(true).toBe(true);
    });
  });
  
  describe('cleanup', () => {
    test('should clean up on destroy', () => {
      terminalAgent.sessionId = 'test_session';
      terminalAgent.session = { sessionId: 'test_session' };
      terminalAgent.remoteActor = mockRemoteActor;
      
      terminalAgent.destroy();
      
      expect(terminalAgent.sessionId).toBeNull();
      expect(terminalAgent.session).toBeNull();
      expect(terminalAgent.remoteActor).toBeNull();
    });
  });
});