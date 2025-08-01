/**
 * Full Application Integration Tests
 * Tests complete workflows and multi-component interactions
 */
import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { JSDOM } from 'jsdom';
import { WebSocket } from 'ws';

describe('Full Application Integration', () => {
  let dom, window, document;
  let app, actorSpace, componentFactory;
  let mockWebSocket;
  
  beforeEach(async () => {
    // Setup DOM environment
    dom = new JSDOM(`
      <!DOCTYPE html>
      <html>
        <body>
          <div id="app">
            <div id="terminal"></div>
            <div id="tools-panel"></div>
            <div id="session-panel"></div>
            <div id="variables-panel"></div>
          </div>
        </body>
      </html>
    `, { url: 'http://localhost' });
    
    window = dom.window;
    document = window.document;
    global.document = document;
    global.window = window;
    global.WebSocket = WebSocket;
    
    // Import components
    const { AiurActorsApp } = await import('../../src/app/AiurActorsApp.js');
    const { ClientActorSpace } = await import('../../src/actors/ClientActorSpace.js');
    const { ComponentFactory } = await import('../../src/components/ComponentFactory.js');
    
    // Create instances
    actorSpace = new ClientActorSpace();
    componentFactory = new ComponentFactory();
    
    // Mock WebSocket
    mockWebSocket = {
      readyState: WebSocket.OPEN,
      send: jest.fn(),
      close: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn()
    };
    
    global.WebSocket = jest.fn(() => mockWebSocket);
    
    // Create application
    app = new AiurActorsApp({
      dom: document.getElementById('app'),
      componentFactory,
      actorSpace,
      options: {
        websocketUrl: 'ws://localhost:8080/actors'
      }
    });
  });
  
  afterEach(() => {
    if (app) {
      app.destroy();
    }
    jest.clearAllMocks();
  });
  
  describe('Application Initialization', () => {
    test('should initialize all components successfully', async () => {
      await app.initialize();
      
      expect(app.initialized).toBe(true);
      expect(app.components.terminal).toBeDefined();
      expect(app.components.toolsPanel).toBeDefined();
      expect(app.components.sessionPanel).toBeDefined();
      expect(app.components.variablesPanel).toBeDefined();
    });
    
    test('should register all required actors', async () => {
      await app.initialize();
      
      expect(actorSpace.getActor('command-actor')).toBeDefined();
      expect(actorSpace.getActor('ui-actor')).toBeDefined();
      expect(actorSpace.getActor('tools-actor')).toBeDefined();
      expect(actorSpace.getActor('sessions-actor')).toBeDefined();
      expect(actorSpace.getActor('variables-actor')).toBeDefined();
    });
    
    test('should establish WebSocket connection', async () => {
      await app.initialize();
      
      // Trigger WebSocket open event
      mockWebSocket.onopen?.();
      
      expect(global.WebSocket).toHaveBeenCalledWith('ws://localhost:8080/actors');
      expect(app.websocket).toBe(mockWebSocket);
    });
    
    test('should handle initialization errors gracefully', async () => {
      // Make component creation fail
      componentFactory.createTerminal = jest.fn(() => {
        throw new Error('Component creation failed');
      });
      
      await expect(app.initialize()).rejects.toThrow('Component creation failed');
      expect(app.initialized).toBe(false);
    });
  });
  
  describe('Component Communication', () => {
    beforeEach(async () => {
      await app.initialize();
      app.start();
    });
    
    test('should handle terminal command execution', () => {
      const terminal = app.components.terminal;
      const commandActor = actorSpace.getActor('command-actor');
      
      // Simulate command execution
      terminal.viewModel.executeCommand('test command');
      
      // Verify command was sent to actor
      expect(commandActor.receive).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'execute',
          command: 'test command'
        })
      );
    });
    
    test('should update tools panel from actor message', () => {
      const toolsPanel = app.components.toolsPanel;
      const toolsActor = actorSpace.getActor('tools-actor');
      
      // Send tools update through actor
      const tools = [
        { id: 'tool1', name: 'Test Tool', category: 'Testing' }
      ];
      
      toolsActor.receive({
        type: 'tools.update',
        tools
      });
      
      // Verify tools panel was updated
      expect(toolsPanel.model.getTools()).toEqual(tools);
    });
    
    test('should handle session switching', () => {
      const sessionPanel = app.components.sessionPanel;
      const terminal = app.components.terminal;
      const sessionsActor = actorSpace.getActor('sessions-actor');
      
      // Create sessions
      const sessions = [
        { id: 'session1', name: 'Session 1', active: true },
        { id: 'session2', name: 'Session 2', active: false }
      ];
      
      sessionsActor.receive({
        type: 'sessions.update',
        sessions
      });
      
      // Switch session
      sessionPanel.viewModel.switchSession('session2');
      
      // Verify session switch was requested
      expect(sessionsActor.receive).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'session.switch',
          sessionId: 'session2'
        })
      );
    });
    
    test('should synchronize variables across components', () => {
      const variablesPanel = app.components.variablesPanel;
      const terminal = app.components.terminal;
      const variablesActor = actorSpace.getActor('variables-actor');
      
      // Update variables through actor
      const variables = [
        { id: 'var1', name: 'testVar', value: 'testValue', type: 'string' }
      ];
      
      variablesActor.receive({
        type: 'variables.update',
        variables
      });
      
      // Verify variables panel was updated
      expect(variablesPanel.model.getVariables()).toEqual(variables);
      
      // Verify terminal autocomplete includes variables
      const suggestions = terminal.viewModel.getAutocompleteSuggestions('$');
      expect(suggestions).toContain(
        expect.objectContaining({ name: 'testVar' })
      );
    });
  });
  
  describe('WebSocket Communication', () => {
    beforeEach(async () => {
      await app.initialize();
      mockWebSocket.onopen?.();
    });
    
    test('should send messages through WebSocket channel', () => {
      const commandActor = actorSpace.getActor('command-actor');
      
      // Execute command that should be sent to server
      commandActor.receive({
        type: 'execute',
        command: 'legion.list',
        requestId: 'req-123'
      });
      
      // Verify message was sent through WebSocket
      expect(mockWebSocket.send).toHaveBeenCalledWith(
        expect.stringContaining('legion.list')
      );
    });
    
    test('should handle incoming WebSocket messages', () => {
      const uiActor = actorSpace.getActor('ui-actor');
      const receiveSpy = jest.spyOn(uiActor, 'receive');
      
      // Simulate incoming message
      const message = {
        type: 'tool.result',
        requestId: 'req-123',
        result: { success: true, data: 'test data' }
      };
      
      mockWebSocket.onmessage?.({
        data: JSON.stringify(message)
      });
      
      // Verify message was routed to correct actor
      expect(receiveSpy).toHaveBeenCalledWith(
        expect.objectContaining(message)
      );
    });
    
    test('should handle WebSocket connection errors', () => {
      const onError = jest.fn();
      app.config.options.onConnectionError = onError;
      
      // Simulate connection error
      const error = new Error('Connection failed');
      mockWebSocket.onerror?.(error);
      
      expect(onError).toHaveBeenCalledWith(error);
      expect(app.errorState).toBe(true);
    });
    
    test('should handle WebSocket reconnection', async () => {
      // Simulate disconnect
      mockWebSocket.readyState = WebSocket.CLOSED;
      mockWebSocket.onclose?.();
      
      expect(app.channel).toBeNull();
      
      // Attempt reconnection
      app.setupWebSocketConnection();
      mockWebSocket.readyState = WebSocket.OPEN;
      mockWebSocket.onopen?.();
      
      expect(app.channel).toBeDefined();
    });
  });
  
  describe('Error Handling and Recovery', () => {
    beforeEach(async () => {
      await app.initialize();
    });
    
    test('should handle component errors gracefully', () => {
      const terminal = app.components.terminal;
      const onError = jest.fn();
      app.config.onError = onError;
      
      // Simulate component error
      const error = new Error('Component error');
      terminal.viewModel.handleError(error);
      
      expect(onError).toHaveBeenCalledWith(error);
    });
    
    test('should recover from error state', async () => {
      // Put app in error state
      app.errorState = true;
      app.initialized = false;
      
      // Attempt recovery
      await app.recover();
      
      expect(app.errorState).toBe(false);
      expect(app.initialized).toBe(true);
    });
    
    test('should clean up resources on destroy', () => {
      const terminal = app.components.terminal;
      const destroySpy = jest.spyOn(terminal, 'destroy');
      
      app.destroy();
      
      expect(destroySpy).toHaveBeenCalled();
      expect(mockWebSocket.close).toHaveBeenCalled();
      expect(app.components).toEqual({});
      expect(app.actors).toEqual({});
    });
  });
  
  describe('User Workflows', () => {
    beforeEach(async () => {
      await app.initialize();
      app.start();
      mockWebSocket.onopen?.();
    });
    
    test('should complete tool execution workflow', () => {
      const terminal = app.components.terminal;
      const toolsPanel = app.components.toolsPanel;
      
      // Step 1: Select a tool
      const tool = { id: 'test-tool', name: 'Test Tool' };
      toolsPanel.model.setTools([tool]);
      toolsPanel.viewModel.selectTool('test-tool');
      
      // Step 2: Execute tool command
      terminal.viewModel.executeCommand('test-tool --param value');
      
      // Step 3: Receive and display result
      const result = { success: true, output: 'Tool executed successfully' };
      terminal.model.addOutput({
        type: 'result',
        content: result.output
      });
      
      // Verify workflow completion
      const output = terminal.model.getOutput();
      expect(output).toContainEqual(
        expect.objectContaining({
          content: 'Tool executed successfully'
        })
      );
    });
    
    test('should complete session management workflow', () => {
      const sessionPanel = app.components.sessionPanel;
      const variablesPanel = app.components.variablesPanel;
      
      // Step 1: Create new session
      sessionPanel.viewModel.createSession('New Session');
      
      // Step 2: Add variables to session
      variablesPanel.viewModel.createVariable({
        name: 'sessionVar',
        value: 'sessionValue',
        type: 'string'
      });
      
      // Step 3: Switch sessions
      sessionPanel.viewModel.switchSession('session2');
      
      // Step 4: Verify session context changed
      const activeSession = sessionPanel.model.getActiveSession();
      expect(activeSession?.id).toBe('session2');
    });
    
    test('should complete variable management workflow', () => {
      const variablesPanel = app.components.variablesPanel;
      const terminal = app.components.terminal;
      
      // Step 1: Create variable
      variablesPanel.viewModel.createVariable({
        name: 'apiKey',
        value: 'secret123',
        type: 'string',
        scope: 'global'
      });
      
      // Step 2: Use variable in command
      terminal.viewModel.executeCommand('echo $apiKey');
      
      // Step 3: Update variable
      variablesPanel.viewModel.updateVariable('var1', {
        value: 'newSecret456'
      });
      
      // Step 4: Delete variable
      variablesPanel.viewModel.deleteVariable('var1');
      
      // Verify variable lifecycle
      const variables = variablesPanel.model.getVariables();
      expect(variables).not.toContainEqual(
        expect.objectContaining({ id: 'var1' })
      );
    });
  });
  
  describe('Performance and Scalability', () => {
    beforeEach(async () => {
      await app.initialize();
    });
    
    test('should handle large amounts of terminal output', () => {
      const terminal = app.components.terminal;
      const maxLines = 1000;
      
      // Add many output lines
      for (let i = 0; i < maxLines * 2; i++) {
        terminal.model.addOutput({
          type: 'result',
          content: `Line ${i}`
        });
      }
      
      // Verify circular buffer limits output
      const output = terminal.model.getOutput();
      expect(output.length).toBeLessThanOrEqual(maxLines);
    });
    
    test('should efficiently update large tool lists', () => {
      const toolsPanel = app.components.toolsPanel;
      const tools = [];
      
      // Create many tools
      for (let i = 0; i < 1000; i++) {
        tools.push({
          id: `tool-${i}`,
          name: `Tool ${i}`,
          category: `Category ${i % 10}`
        });
      }
      
      const startTime = Date.now();
      toolsPanel.model.setTools(tools);
      const endTime = Date.now();
      
      // Should update quickly (< 100ms)
      expect(endTime - startTime).toBeLessThan(100);
      expect(toolsPanel.model.getTools()).toHaveLength(1000);
    });
    
    test('should handle many concurrent actor messages', async () => {
      const promises = [];
      const messageCount = 100;
      
      // Send many messages concurrently
      for (let i = 0; i < messageCount; i++) {
        const promise = new Promise((resolve) => {
          const actor = actorSpace.getActor('command-actor');
          actor.receive({
            type: 'execute',
            command: `command-${i}`,
            requestId: `req-${i}`
          });
          resolve();
        });
        promises.push(promise);
      }
      
      await Promise.all(promises);
      
      // All messages should be processed
      expect(mockWebSocket.send).toHaveBeenCalledTimes(messageCount);
    });
  });
});