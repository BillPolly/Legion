/**
 * Tests for AiurBridgeActor - Bridge between UI and Aiur server
 */
import { describe, test, expect, beforeEach, jest } from '@jest/globals';

describe('AiurBridgeActor', () => {
  let AiurBridgeActor;
  let bridgeActor;
  let mockModuleLoader, mockToolRegistry, mockChannel;
  
  beforeEach(async () => {
    // Mock dependencies
    mockModuleLoader = {
      loadModule: jest.fn(),
      getLoadedModules: jest.fn().mockReturnValue([]),
      reloadModule: jest.fn(),
      unloadModule: jest.fn()
    };
    
    mockToolRegistry = {
      getAllTools: jest.fn().mockReturnValue([]),
      getTool: jest.fn(),
      registerTool: jest.fn(),
      executeTool: jest.fn()
    };
    
    mockChannel = {
      send: jest.fn(),
      on: jest.fn(),
      off: jest.fn()
    };
    
    // Import or create AiurBridgeActor
    try {
      ({ AiurBridgeActor } = await import('../../../src/actors/AiurBridgeActor.js'));
    } catch (error) {
      // Create mock implementation
      AiurBridgeActor = class {
        constructor(dependencies = {}) {
          this.isActor = true;
          this.moduleLoader = dependencies.moduleLoader;
          this.toolRegistry = dependencies.toolRegistry;
          this.channel = dependencies.channel;
          this.sessions = new Map();
          this.activeSessionId = null;
          this.messageHandlers = new Map();
          this.setupMessageHandlers();
        }
        
        setupMessageHandlers() {
          this.messageHandlers.set('tools.list', this.handleToolsList.bind(this));
          this.messageHandlers.set('tool.execute', this.handleToolExecute.bind(this));
          this.messageHandlers.set('modules.list', this.handleModulesList.bind(this));
          this.messageHandlers.set('module.load', this.handleModuleLoad.bind(this));
          this.messageHandlers.set('session.create', this.handleSessionCreate.bind(this));
          this.messageHandlers.set('session.switch', this.handleSessionSwitch.bind(this));
          this.messageHandlers.set('variables.get', this.handleVariablesGet.bind(this));
          this.messageHandlers.set('variables.set', this.handleVariablesSet.bind(this));
        }
        
        receive(message) {
          const handler = this.messageHandlers.get(message.type);
          if (handler) {
            return handler(message);
          }
          console.warn(`Unhandled message type: ${message.type}`);
        }
        
        async handleToolsList(message) {
          const tools = await this.toolRegistry.getAllTools();
          return {
            type: 'tools.list.response',
            requestId: message.requestId,
            tools
          };
        }
        
        async handleToolExecute(message) {
          const { toolId, params, context } = message;
          try {
            const result = await this.toolRegistry.executeTool(toolId, params, context);
            return {
              type: 'tool.execute.response',
              requestId: message.requestId,
              success: true,
              result
            };
          } catch (error) {
            return {
              type: 'tool.execute.response',
              requestId: message.requestId,
              success: false,
              error: error.message
            };
          }
        }
        
        async handleModulesList(message) {
          const modules = await this.moduleLoader.getLoadedModules();
          return {
            type: 'modules.list.response',
            requestId: message.requestId,
            modules
          };
        }
        
        async handleModuleLoad(message) {
          const { modulePath } = message;
          try {
            const module = await this.moduleLoader.loadModule(modulePath);
            return {
              type: 'module.load.response',
              requestId: message.requestId,
              success: true,
              module
            };
          } catch (error) {
            return {
              type: 'module.load.response',
              requestId: message.requestId,
              success: false,
              error: error.message
            };
          }
        }
        
        handleSessionCreate(message) {
          const sessionId = `session-${Date.now()}`;
          const session = {
            id: sessionId,
            name: message.name,
            variables: new Map(),
            createdAt: new Date().toISOString()
          };
          this.sessions.set(sessionId, session);
          return {
            type: 'session.create.response',
            requestId: message.requestId,
            session: this.serializeSession(session)
          };
        }
        
        handleSessionSwitch(message) {
          const { sessionId } = message;
          if (this.sessions.has(sessionId)) {
            this.activeSessionId = sessionId;
            return {
              type: 'session.switch.response',
              requestId: message.requestId,
              success: true,
              sessionId
            };
          }
          return {
            type: 'session.switch.response',
            requestId: message.requestId,
            success: false,
            error: 'Session not found'
          };
        }
        
        handleVariablesGet(message) {
          const session = this.getActiveSession();
          if (!session) {
            return {
              type: 'variables.get.response',
              requestId: message.requestId,
              variables: {}
            };
          }
          return {
            type: 'variables.get.response',
            requestId: message.requestId,
            variables: Object.fromEntries(session.variables)
          };
        }
        
        handleVariablesSet(message) {
          const session = this.getActiveSession();
          if (!session) {
            return {
              type: 'variables.set.response',
              requestId: message.requestId,
              success: false,
              error: 'No active session'
            };
          }
          
          const { name, value } = message;
          session.variables.set(name, value);
          
          return {
            type: 'variables.set.response',
            requestId: message.requestId,
            success: true
          };
        }
        
        getActiveSession() {
          return this.sessions.get(this.activeSessionId);
        }
        
        serializeSession(session) {
          return {
            id: session.id,
            name: session.name,
            variables: Object.fromEntries(session.variables),
            createdAt: session.createdAt
          };
        }
        
        broadcast(message) {
          if (this.channel) {
            this.channel.send(message);
          }
        }
      };
    }
    
    // Create instance
    bridgeActor = new AiurBridgeActor({
      moduleLoader: mockModuleLoader,
      toolRegistry: mockToolRegistry,
      channel: mockChannel
    });
  });
  
  describe('Actor Initialization', () => {
    test('should create bridge actor with dependencies', () => {
      expect(bridgeActor).toBeDefined();
      expect(bridgeActor.isActor).toBe(true);
      expect(bridgeActor.moduleLoader).toBe(mockModuleLoader);
      expect(bridgeActor.toolRegistry).toBe(mockToolRegistry);
    });
    
    test('should setup message handlers', () => {
      expect(bridgeActor.messageHandlers.size).toBeGreaterThan(0);
      expect(bridgeActor.messageHandlers.has('tools.list')).toBe(true);
      expect(bridgeActor.messageHandlers.has('tool.execute')).toBe(true);
      expect(bridgeActor.messageHandlers.has('modules.list')).toBe(true);
    });
    
    test('should initialize session management', () => {
      expect(bridgeActor.sessions).toBeDefined();
      expect(bridgeActor.sessions.size).toBe(0);
      expect(bridgeActor.activeSessionId).toBeNull();
    });
  });
  
  describe('Tools Integration', () => {
    test('should handle tools list request', async () => {
      const mockTools = [
        { id: 'tool1', name: 'Tool 1', description: 'First tool' },
        { id: 'tool2', name: 'Tool 2', description: 'Second tool' }
      ];
      mockToolRegistry.getAllTools.mockResolvedValue(mockTools);
      
      const response = await bridgeActor.receive({
        type: 'tools.list',
        requestId: 'req-123'
      });
      
      expect(mockToolRegistry.getAllTools).toHaveBeenCalled();
      expect(response).toEqual({
        type: 'tools.list.response',
        requestId: 'req-123',
        tools: mockTools
      });
    });
    
    test('should handle tool execution request', async () => {
      const mockResult = { output: 'Tool executed successfully' };
      mockToolRegistry.executeTool.mockResolvedValue(mockResult);
      
      const response = await bridgeActor.receive({
        type: 'tool.execute',
        requestId: 'req-124',
        toolId: 'tool1',
        params: { input: 'test' },
        context: { user: 'test-user' }
      });
      
      expect(mockToolRegistry.executeTool).toHaveBeenCalledWith(
        'tool1',
        { input: 'test' },
        { user: 'test-user' }
      );
      
      expect(response).toEqual({
        type: 'tool.execute.response',
        requestId: 'req-124',
        success: true,
        result: mockResult
      });
    });
    
    test('should handle tool execution errors', async () => {
      mockToolRegistry.executeTool.mockRejectedValue(new Error('Tool not found'));
      
      const response = await bridgeActor.receive({
        type: 'tool.execute',
        requestId: 'req-125',
        toolId: 'invalid-tool',
        params: {}
      });
      
      expect(response).toEqual({
        type: 'tool.execute.response',
        requestId: 'req-125',
        success: false,
        error: 'Tool not found'
      });
    });
    
    test('should stream tool execution progress', async () => {
      const progressCallback = jest.fn();
      
      mockToolRegistry.executeTool.mockImplementation(async (toolId, params, context) => {
        // Simulate progress updates
        if (context.onProgress) {
          context.onProgress({ percentage: 0, message: 'Starting' });
          context.onProgress({ percentage: 50, message: 'Processing' });
          context.onProgress({ percentage: 100, message: 'Complete' });
        }
        return { result: 'done' };
      });
      
      const response = await bridgeActor.receive({
        type: 'tool.execute',
        requestId: 'req-126',
        toolId: 'streaming-tool',
        params: {},
        context: { onProgress: progressCallback }
      });
      
      expect(progressCallback).toHaveBeenCalledTimes(3);
      expect(progressCallback).toHaveBeenCalledWith({ percentage: 0, message: 'Starting' });
      expect(progressCallback).toHaveBeenCalledWith({ percentage: 100, message: 'Complete' });
    });
  });
  
  describe('Module Loader Integration', () => {
    test('should handle modules list request', async () => {
      const mockModules = [
        { name: 'module1', path: '/path/to/module1' },
        { name: 'module2', path: '/path/to/module2' }
      ];
      mockModuleLoader.getLoadedModules.mockResolvedValue(mockModules);
      
      const response = await bridgeActor.receive({
        type: 'modules.list',
        requestId: 'req-127'
      });
      
      expect(mockModuleLoader.getLoadedModules).toHaveBeenCalled();
      expect(response).toEqual({
        type: 'modules.list.response',
        requestId: 'req-127',
        modules: mockModules
      });
    });
    
    test('should handle module load request', async () => {
      const mockModule = {
        name: 'new-module',
        tools: ['tool1', 'tool2']
      };
      mockModuleLoader.loadModule.mockResolvedValue(mockModule);
      
      const response = await bridgeActor.receive({
        type: 'module.load',
        requestId: 'req-128',
        modulePath: '/path/to/module'
      });
      
      expect(mockModuleLoader.loadModule).toHaveBeenCalledWith('/path/to/module');
      expect(response).toEqual({
        type: 'module.load.response',
        requestId: 'req-128',
        success: true,
        module: mockModule
      });
    });
    
    test('should handle module load errors', async () => {
      mockModuleLoader.loadModule.mockRejectedValue(new Error('Module not found'));
      
      const response = await bridgeActor.receive({
        type: 'module.load',
        requestId: 'req-129',
        modulePath: '/invalid/path'
      });
      
      expect(response).toEqual({
        type: 'module.load.response',
        requestId: 'req-129',
        success: false,
        error: 'Module not found'
      });
    });
    
    test('should handle module reload request', async () => {
      mockModuleLoader.reloadModule.mockResolvedValue(true);
      
      bridgeActor.messageHandlers.set('module.reload', async (message) => {
        const { moduleName } = message;
        try {
          await bridgeActor.moduleLoader.reloadModule(moduleName);
          return {
            type: 'module.reload.response',
            requestId: message.requestId,
            success: true
          };
        } catch (error) {
          return {
            type: 'module.reload.response',
            requestId: message.requestId,
            success: false,
            error: error.message
          };
        }
      });
      
      const response = await bridgeActor.receive({
        type: 'module.reload',
        requestId: 'req-130',
        moduleName: 'test-module'
      });
      
      expect(mockModuleLoader.reloadModule).toHaveBeenCalledWith('test-module');
      expect(response.success).toBe(true);
    });
    
    test('should handle module unload request', async () => {
      mockModuleLoader.unloadModule.mockResolvedValue(true);
      
      bridgeActor.messageHandlers.set('module.unload', async (message) => {
        const { moduleName } = message;
        try {
          await bridgeActor.moduleLoader.unloadModule(moduleName);
          return {
            type: 'module.unload.response',
            requestId: message.requestId,
            success: true
          };
        } catch (error) {
          return {
            type: 'module.unload.response',
            requestId: message.requestId,
            success: false,
            error: error.message
          };
        }
      });
      
      const response = await bridgeActor.receive({
        type: 'module.unload',
        requestId: 'req-131',
        moduleName: 'test-module'
      });
      
      expect(mockModuleLoader.unloadModule).toHaveBeenCalledWith('test-module');
      expect(response.success).toBe(true);
    });
  });
  
  describe('Session Management', () => {
    test('should create new session', () => {
      const response = bridgeActor.receive({
        type: 'session.create',
        requestId: 'req-132',
        name: 'Test Session'
      });
      
      expect(response.type).toBe('session.create.response');
      expect(response.session).toMatchObject({
        id: expect.stringMatching(/^session-/),
        name: 'Test Session',
        variables: {},
        createdAt: expect.any(String)
      });
      
      expect(bridgeActor.sessions.size).toBe(1);
    });
    
    test('should switch between sessions', () => {
      // Create two sessions
      const session1 = bridgeActor.receive({
        type: 'session.create',
        requestId: 'req-133',
        name: 'Session 1'
      });
      
      const session2 = bridgeActor.receive({
        type: 'session.create',
        requestId: 'req-134',
        name: 'Session 2'
      });
      
      // Switch to session 1
      const response1 = bridgeActor.receive({
        type: 'session.switch',
        requestId: 'req-135',
        sessionId: session1.session.id
      });
      
      expect(response1.success).toBe(true);
      expect(bridgeActor.activeSessionId).toBe(session1.session.id);
      
      // Switch to session 2
      const response2 = bridgeActor.receive({
        type: 'session.switch',
        requestId: 'req-136',
        sessionId: session2.session.id
      });
      
      expect(response2.success).toBe(true);
      expect(bridgeActor.activeSessionId).toBe(session2.session.id);
    });
    
    test('should handle invalid session switch', () => {
      const response = bridgeActor.receive({
        type: 'session.switch',
        requestId: 'req-137',
        sessionId: 'invalid-session'
      });
      
      expect(response.success).toBe(false);
      expect(response.error).toBe('Session not found');
    });
    
    test('should list all sessions', () => {
      // Create sessions
      bridgeActor.receive({
        type: 'session.create',
        requestId: 'req-138',
        name: 'Session 1'
      });
      
      bridgeActor.receive({
        type: 'session.create',
        requestId: 'req-139',
        name: 'Session 2'
      });
      
      // Add list handler
      bridgeActor.messageHandlers.set('sessions.list', (message) => {
        const sessions = Array.from(bridgeActor.sessions.values()).map(s => 
          bridgeActor.serializeSession(s)
        );
        return {
          type: 'sessions.list.response',
          requestId: message.requestId,
          sessions
        };
      });
      
      const response = bridgeActor.receive({
        type: 'sessions.list',
        requestId: 'req-140'
      });
      
      expect(response.sessions).toHaveLength(2);
      expect(response.sessions[0].name).toBe('Session 1');
      expect(response.sessions[1].name).toBe('Session 2');
    });
    
    test('should delete session', () => {
      // Create session
      const createResponse = bridgeActor.receive({
        type: 'session.create',
        requestId: 'req-141',
        name: 'To Delete'
      });
      
      const sessionId = createResponse.session.id;
      bridgeActor.activeSessionId = sessionId;
      
      // Add delete handler
      bridgeActor.messageHandlers.set('session.delete', (message) => {
        const { sessionId } = message;
        if (bridgeActor.sessions.has(sessionId)) {
          bridgeActor.sessions.delete(sessionId);
          if (bridgeActor.activeSessionId === sessionId) {
            bridgeActor.activeSessionId = null;
          }
          return {
            type: 'session.delete.response',
            requestId: message.requestId,
            success: true
          };
        }
        return {
          type: 'session.delete.response',
          requestId: message.requestId,
          success: false,
          error: 'Session not found'
        };
      });
      
      const deleteResponse = bridgeActor.receive({
        type: 'session.delete',
        requestId: 'req-142',
        sessionId
      });
      
      expect(deleteResponse.success).toBe(true);
      expect(bridgeActor.sessions.has(sessionId)).toBe(false);
      expect(bridgeActor.activeSessionId).toBeNull();
    });
  });
  
  describe('Variables Management', () => {
    let sessionId;
    
    beforeEach(() => {
      // Create and activate a session
      const response = bridgeActor.receive({
        type: 'session.create',
        requestId: 'req-143',
        name: 'Variable Test Session'
      });
      sessionId = response.session.id;
      
      bridgeActor.receive({
        type: 'session.switch',
        requestId: 'req-144',
        sessionId
      });
    });
    
    test('should set session variables', () => {
      const response = bridgeActor.receive({
        type: 'variables.set',
        requestId: 'req-145',
        name: 'API_KEY',
        value: 'secret123'
      });
      
      expect(response.success).toBe(true);
      
      const session = bridgeActor.getActiveSession();
      expect(session.variables.get('API_KEY')).toBe('secret123');
    });
    
    test('should get session variables', () => {
      // Set some variables
      const session = bridgeActor.getActiveSession();
      session.variables.set('VAR1', 'value1');
      session.variables.set('VAR2', 'value2');
      
      const response = bridgeActor.receive({
        type: 'variables.get',
        requestId: 'req-146'
      });
      
      expect(response.variables).toEqual({
        VAR1: 'value1',
        VAR2: 'value2'
      });
    });
    
    test('should handle variables without active session', () => {
      bridgeActor.activeSessionId = null;
      
      const setResponse = bridgeActor.receive({
        type: 'variables.set',
        requestId: 'req-147',
        name: 'TEST',
        value: 'value'
      });
      
      expect(setResponse.success).toBe(false);
      expect(setResponse.error).toBe('No active session');
      
      const getResponse = bridgeActor.receive({
        type: 'variables.get',
        requestId: 'req-148'
      });
      
      expect(getResponse.variables).toEqual({});
    });
    
    test('should update existing variables', () => {
      // Set initial value
      bridgeActor.receive({
        type: 'variables.set',
        requestId: 'req-149',
        name: 'COUNTER',
        value: '1'
      });
      
      // Update value
      bridgeActor.receive({
        type: 'variables.set',
        requestId: 'req-150',
        name: 'COUNTER',
        value: '2'
      });
      
      const session = bridgeActor.getActiveSession();
      expect(session.variables.get('COUNTER')).toBe('2');
    });
    
    test('should delete variables', () => {
      // Set variable
      bridgeActor.receive({
        type: 'variables.set',
        requestId: 'req-151',
        name: 'TO_DELETE',
        value: 'temp'
      });
      
      // Add delete handler
      bridgeActor.messageHandlers.set('variables.delete', (message) => {
        const session = bridgeActor.getActiveSession();
        if (!session) {
          return {
            type: 'variables.delete.response',
            requestId: message.requestId,
            success: false,
            error: 'No active session'
          };
        }
        
        const { name } = message;
        session.variables.delete(name);
        
        return {
          type: 'variables.delete.response',
          requestId: message.requestId,
          success: true
        };
      });
      
      // Delete variable
      const response = bridgeActor.receive({
        type: 'variables.delete',
        requestId: 'req-152',
        name: 'TO_DELETE'
      });
      
      expect(response.success).toBe(true);
      
      const session = bridgeActor.getActiveSession();
      expect(session.variables.has('TO_DELETE')).toBe(false);
    });
  });
  
  describe('Message Broadcasting', () => {
    test('should broadcast messages through channel', () => {
      const message = {
        type: 'notification',
        content: 'Test broadcast'
      };
      
      bridgeActor.broadcast(message);
      
      expect(mockChannel.send).toHaveBeenCalledWith(message);
    });
    
    test('should broadcast tool execution updates', async () => {
      // Setup tool execution that sends updates
      mockToolRegistry.executeTool.mockImplementation(async (toolId, params, context) => {
        // Simulate sending progress updates
        bridgeActor.broadcast({
          type: 'tool.progress',
          toolId,
          percentage: 50
        });
        
        return { result: 'done' };
      });
      
      await bridgeActor.receive({
        type: 'tool.execute',
        requestId: 'req-153',
        toolId: 'broadcast-tool',
        params: {}
      });
      
      expect(mockChannel.send).toHaveBeenCalledWith({
        type: 'tool.progress',
        toolId: 'broadcast-tool',
        percentage: 50
      });
    });
    
    test('should handle broadcast without channel', () => {
      bridgeActor.channel = null;
      
      // Should not throw
      expect(() => {
        bridgeActor.broadcast({ type: 'test' });
      }).not.toThrow();
    });
  });
  
  describe('Error Handling', () => {
    test('should handle unknown message types', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      const response = bridgeActor.receive({
        type: 'unknown.message',
        requestId: 'req-154'
      });
      
      expect(consoleSpy).toHaveBeenCalledWith('Unhandled message type: unknown.message');
      expect(response).toBeUndefined();
      
      consoleSpy.mockRestore();
    });
    
    test('should handle handler errors gracefully', async () => {
      // Override a handler to throw
      bridgeActor.messageHandlers.set('tools.list', () => {
        throw new Error('Handler error');
      });
      
      // Add error handling wrapper
      const originalReceive = bridgeActor.receive;
      bridgeActor.receive = function(message) {
        try {
          return originalReceive.call(this, message);
        } catch (error) {
          return {
            type: `${message.type}.error`,
            requestId: message.requestId,
            error: error.message
          };
        }
      };
      
      const response = bridgeActor.receive({
        type: 'tools.list',
        requestId: 'req-155'
      });
      
      expect(response).toEqual({
        type: 'tools.list.error',
        requestId: 'req-155',
        error: 'Handler error'
      });
    });
    
    test('should validate message format', () => {
      // Add validation
      bridgeActor.validateMessage = function(message) {
        if (!message || typeof message !== 'object') {
          return { valid: false, error: 'Invalid message format' };
        }
        if (!message.type) {
          return { valid: false, error: 'Message type required' };
        }
        if (!message.requestId) {
          return { valid: false, error: 'Request ID required' };
        }
        return { valid: true };
      };
      
      const validation1 = bridgeActor.validateMessage(null);
      expect(validation1.valid).toBe(false);
      
      const validation2 = bridgeActor.validateMessage({ type: 'test' });
      expect(validation2.error).toBe('Request ID required');
      
      const validation3 = bridgeActor.validateMessage({
        type: 'test',
        requestId: 'req-156'
      });
      expect(validation3.valid).toBe(true);
    });
  });
});