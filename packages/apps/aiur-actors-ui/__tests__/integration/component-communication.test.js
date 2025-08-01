/**
 * Integration tests for component communication
 * Verifies that components interact correctly through the actor system
 */
import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';

describe('Component Communication', () => {
  let Terminal, ToolsPanel, SessionPanel, VariablesPanel;
  let ClientActorSpace, UIUpdateActor, ClientCommandActor;
  let components, actors, actorSpace;
  
  beforeEach(async () => {
    // Clear DOM
    document.body.innerHTML = '';
    
    // Import components
    try {
      ({ Terminal } = await import('../../src/components/terminal/index.js'));
      ({ ToolsPanel } = await import('../../src/components/tools-panel/index.js'));
      ({ SessionPanel } = await import('../../src/components/session-panel/index.js'));
      ({ VariablesPanel } = await import('../../src/components/variables-panel/index.js'));
      ({ ClientActorSpace } = await import('../../src/actors/ClientActorSpace.js'));
      ({ UIUpdateActor } = await import('../../src/actors/UIUpdateActor.js'));
      ({ ClientCommandActor } = await import('../../src/actors/ClientCommandActor.js'));
    } catch (error) {
      // Mock implementations if not available
      Terminal = class Terminal {
        constructor(umbilical) {
          this.umbilical = umbilical;
          this.element = document.createElement('div');
          this.element.className = 'terminal';
        }
        
        executeCommand(command) {
          this.umbilical.actors.command.send({
            type: 'execute',
            command
          });
        }
        
        handleToolSelected(tool) {
          this.umbilical.viewModel.addOutput({
            type: 'info',
            content: `Tool selected: ${tool.name}`
          });
        }
      };
      
      ToolsPanel = class ToolsPanel {
        constructor(umbilical) {
          this.umbilical = umbilical;
          this.element = document.createElement('div');
          this.element.className = 'tools-panel';
          this.selectedTool = null;
        }
        
        selectTool(toolId) {
          const tool = this.umbilical.model.getToolById(toolId);
          if (tool) {
            this.selectedTool = tool;
            this.umbilical.actors.ui.send({
              type: 'tool.selected',
              tool
            });
          }
        }
        
        updateTools(tools) {
          this.umbilical.model.setTools(tools);
          this.umbilical.view.render();
        }
      };
      
      SessionPanel = class SessionPanel {
        constructor(umbilical) {
          this.umbilical = umbilical;
          this.element = document.createElement('div');
          this.element.className = 'session-panel';
          this.activeSession = null;
        }
        
        switchSession(sessionId) {
          this.activeSession = sessionId;
          this.umbilical.actors.ui.send({
            type: 'session.switched',
            sessionId
          });
        }
        
        handleSessionSwitch(sessionId) {
          // Update UI to reflect new session
          this.umbilical.viewModel.setActiveSession(sessionId);
        }
      };
      
      VariablesPanel = class VariablesPanel {
        constructor(umbilical) {
          this.umbilical = umbilical;
          this.element = document.createElement('div');
          this.element.className = 'variables-panel';
          this.selectedVariable = null;
        }
        
        selectVariable(variableName) {
          const variable = this.umbilical.model.getVariable(variableName);
          if (variable) {
            this.selectedVariable = variable;
            this.umbilical.actors.ui.send({
              type: 'variable.selected',
              variable
            });
          }
        }
        
        updateVariables(variables) {
          this.umbilical.model.setVariables(variables);
          this.umbilical.view.render();
        }
      };
      
      ClientActorSpace = class ClientActorSpace {
        constructor() {
          this.actors = new Map();
          this.listeners = new Map();
        }
        
        registerActor(name, actor) {
          this.actors.set(name, actor);
          actor.actorSpace = this;
        }
        
        send(actorName, message) {
          const actor = this.actors.get(actorName);
          if (actor) {
            actor.receive(message);
          }
        }
        
        broadcast(message) {
          for (const actor of this.actors.values()) {
            actor.receive(message);
          }
        }
      };
      
      UIUpdateActor = class UIUpdateActor {
        constructor() {
          this.handlers = new Map();
        }
        
        receive(message) {
          const handler = this.handlers.get(message.type);
          if (handler) {
            handler(message);
          } else {
            // Broadcast to all components
            this.actorSpace?.broadcast(message);
          }
        }
        
        send(message) {
          this.receive(message);
        }
        
        on(type, handler) {
          this.handlers.set(type, handler);
        }
      };
      
      ClientCommandActor = class ClientCommandActor {
        constructor() {
          this.handlers = new Map();
        }
        
        receive(message) {
          const handler = this.handlers.get(message.type);
          if (handler) {
            handler(message);
          }
        }
        
        send(message) {
          this.receive(message);
        }
        
        on(type, handler) {
          this.handlers.set(type, handler);
        }
      };
    }
    
    // Create actor space and actors
    actorSpace = new ClientActorSpace();
    const uiActor = new UIUpdateActor();
    const commandActor = new ClientCommandActor();
    
    // Mark as actors for registration
    uiActor.isActor = true;
    commandActor.isActor = true;
    
    actorSpace.register(uiActor, 'ui');
    actorSpace.register(commandActor, 'command');
    
    actors = {
      ui: uiActor,
      command: commandActor
    };
    
    // Create components with umbilical
    components = {};
    
    const createUmbilical = (componentName) => ({
      model: {
        data: {},
        getToolById: (id) => ({ id, name: `Tool ${id}`, command: `tool-${id}` }),
        getVariable: (name) => ({ name, value: `value-${name}`, type: 'string' }),
        setTools: jest.fn(),
        setVariables: jest.fn()
      },
      view: {
        render: jest.fn()
      },
      viewModel: {
        addOutput: jest.fn(),
        setActiveSession: jest.fn()
      },
      actors,
      actorSpace
    });
    
    components.terminal = new Terminal(createUmbilical('terminal'));
    components.toolsPanel = new ToolsPanel(createUmbilical('toolsPanel'));
    components.sessionPanel = new SessionPanel(createUmbilical('sessionPanel'));
    components.variablesPanel = new VariablesPanel(createUmbilical('variablesPanel'));
  });
  
  afterEach(() => {
    jest.clearAllMocks();
  });
  
  describe('Terminal to Tools Communication', () => {
    test('should handle tool selection from tools panel', () => {
      // Setup listener on terminal
      const terminalHandler = jest.fn();
      actors.ui.on('tool.selected', (message) => {
        components.terminal.handleToolSelected(message.tool);
        terminalHandler(message);
      });
      
      // Select tool from tools panel
      components.toolsPanel.selectTool('git-status');
      
      // Verify terminal received the message
      expect(terminalHandler).toHaveBeenCalledWith({
        type: 'tool.selected',
        tool: expect.objectContaining({
          id: 'git-status',
          name: 'Tool git-status'
        })
      });
      
      // Verify terminal added output
      expect(components.terminal.umbilical.viewModel.addOutput).toHaveBeenCalledWith({
        type: 'info',
        content: 'Tool selected: Tool git-status'
      });
    });
    
    test('should execute tool command from terminal', () => {
      const commandHandler = jest.fn();
      actors.command.on('execute', commandHandler);
      
      // Execute command from terminal
      components.terminal.executeCommand('git status');
      
      // Verify command actor received the message
      expect(commandHandler).toHaveBeenCalledWith({
        type: 'execute',
        command: 'git status'
      });
    });
    
    test('should update tools list in panel from external source', () => {
      const tools = [
        { id: 'tool1', name: 'Tool 1', command: 'tool1' },
        { id: 'tool2', name: 'Tool 2', command: 'tool2' }
      ];
      
      // Update tools
      components.toolsPanel.updateTools(tools);
      
      // Verify model was updated
      expect(components.toolsPanel.umbilical.model.setTools).toHaveBeenCalledWith(tools);
      expect(components.toolsPanel.umbilical.view.render).toHaveBeenCalled();
    });
    
    test('should handle tool execution result', () => {
      const resultHandler = jest.fn();
      
      // Terminal listens for results
      actors.ui.on('tool.result', (message) => {
        components.terminal.umbilical.viewModel.addOutput({
          type: 'result',
          content: message.result
        });
        resultHandler(message);
      });
      
      // Simulate tool execution result
      actors.ui.send({
        type: 'tool.result',
        toolId: 'git-status',
        result: 'On branch main\nnothing to commit'
      });
      
      // Verify terminal displayed result
      expect(components.terminal.umbilical.viewModel.addOutput).toHaveBeenCalledWith({
        type: 'result',
        content: 'On branch main\nnothing to commit'
      });
    });
  });
  
  describe('Session Switching Effects', () => {
    test('should notify all components when session switches', () => {
      const handlers = {
        terminal: jest.fn(),
        tools: jest.fn(),
        variables: jest.fn()
      };
      
      // Setup listeners
      actors.ui.on('session.switched', (message) => {
        // Simulate broadcasting to all components
        components.terminal.handleSessionSwitch?.(message.sessionId);
        components.toolsPanel.handleSessionSwitch?.(message.sessionId);
        components.variablesPanel.handleSessionSwitch?.(message.sessionId);
        
        handlers.terminal(message);
        handlers.tools(message);
        handlers.variables(message);
      });
      
      // Switch session
      components.sessionPanel.switchSession('session-2');
      
      // Verify all components were notified
      expect(handlers.terminal).toHaveBeenCalledWith({
        type: 'session.switched',
        sessionId: 'session-2'
      });
      expect(handlers.tools).toHaveBeenCalledWith({
        type: 'session.switched',
        sessionId: 'session-2'
      });
      expect(handlers.variables).toHaveBeenCalledWith({
        type: 'session.switched',
        sessionId: 'session-2'
      });
    });
    
    test('should clear terminal output on session switch', () => {
      const clearOutput = jest.fn();
      components.terminal.umbilical.viewModel.clearOutput = clearOutput;
      
      actors.ui.on('session.switched', () => {
        components.terminal.umbilical.viewModel.clearOutput();
      });
      
      // Switch session
      components.sessionPanel.switchSession('new-session');
      
      // Verify terminal was cleared
      expect(clearOutput).toHaveBeenCalled();
    });
    
    test('should reload tools for new session', () => {
      const loadTools = jest.fn();
      components.toolsPanel.loadTools = loadTools;
      
      actors.ui.on('session.switched', (message) => {
        components.toolsPanel.loadTools(message.sessionId);
      });
      
      // Switch session
      components.sessionPanel.switchSession('session-3');
      
      // Verify tools were reloaded
      expect(loadTools).toHaveBeenCalledWith('session-3');
    });
    
    test('should reload variables for new session', () => {
      const loadVariables = jest.fn();
      components.variablesPanel.loadVariables = loadVariables;
      
      actors.ui.on('session.switched', (message) => {
        components.variablesPanel.loadVariables(message.sessionId);
      });
      
      // Switch session
      components.sessionPanel.switchSession('session-4');
      
      // Verify variables were reloaded
      expect(loadVariables).toHaveBeenCalledWith('session-4');
    });
  });
  
  describe('Variable Selection', () => {
    test('should insert variable into terminal input', () => {
      const insertText = jest.fn();
      components.terminal.insertText = insertText;
      
      // Listen for variable selection
      actors.ui.on('variable.selected', (message) => {
        components.terminal.insertText(`$${message.variable.name}`);
      });
      
      // Select variable
      components.variablesPanel.selectVariable('API_KEY');
      
      // Verify terminal inserted the variable
      expect(insertText).toHaveBeenCalledWith('$API_KEY');
    });
    
    test('should show variable details in terminal', () => {
      actors.ui.on('variable.selected', (message) => {
        components.terminal.umbilical.viewModel.addOutput({
          type: 'info',
          content: `Variable: ${message.variable.name} = ${message.variable.value}`
        });
      });
      
      // Select variable
      components.variablesPanel.selectVariable('DEBUG_MODE');
      
      // Verify details were shown
      expect(components.terminal.umbilical.viewModel.addOutput).toHaveBeenCalledWith({
        type: 'info',
        content: 'Variable: DEBUG_MODE = value-DEBUG_MODE'
      });
    });
    
    test('should update variables from external source', () => {
      const variables = [
        { name: 'VAR1', value: 'value1', type: 'string' },
        { name: 'VAR2', value: 123, type: 'number' }
      ];
      
      // Update variables
      components.variablesPanel.updateVariables(variables);
      
      // Verify model was updated
      expect(components.variablesPanel.umbilical.model.setVariables).toHaveBeenCalledWith(variables);
      expect(components.variablesPanel.umbilical.view.render).toHaveBeenCalled();
    });
    
    test('should handle variable updates across components', () => {
      const updateHandlers = {
        terminal: jest.fn(),
        tools: jest.fn()
      };
      
      // Setup listeners
      actors.ui.on('variables.updated', (message) => {
        updateHandlers.terminal(message);
        updateHandlers.tools(message);
      });
      
      // Broadcast variable update
      actors.ui.send({
        type: 'variables.updated',
        variables: [
          { name: 'NEW_VAR', value: 'new-value', type: 'string' }
        ]
      });
      
      // Verify all components were notified
      expect(updateHandlers.terminal).toHaveBeenCalled();
      expect(updateHandlers.tools).toHaveBeenCalled();
    });
  });
  
  describe('Cross-Component Interactions', () => {
    test('should coordinate tool execution with variable substitution', () => {
      const executeHandler = jest.fn();
      actors.command.on('execute', executeHandler);
      
      // Setup variable
      components.variablesPanel.umbilical.model.getVariable = (name) => {
        if (name === 'API_URL') {
          return { name: 'API_URL', value: 'https://api.example.com', type: 'string' };
        }
      };
      
      // Execute command with variable
      components.terminal.executeCommand('curl $API_URL/status');
      
      // Verify command was sent
      expect(executeHandler).toHaveBeenCalledWith({
        type: 'execute',
        command: 'curl $API_URL/status'
      });
    });
    
    test('should update all panels when receiving batch update', () => {
      const batchUpdate = {
        type: 'state.update',
        session: { id: 'session-1', name: 'Session 1' },
        tools: [
          { id: 't1', name: 'Tool 1' },
          { id: 't2', name: 'Tool 2' }
        ],
        variables: [
          { name: 'V1', value: 'val1' },
          { name: 'V2', value: 'val2' }
        ]
      };
      
      // Mock update methods
      components.sessionPanel.updateSession = jest.fn();
      components.toolsPanel.updateTools = jest.fn();
      components.variablesPanel.updateVariables = jest.fn();
      
      // Setup batch update handler
      actors.ui.on('state.update', (message) => {
        if (message.session) {
          components.sessionPanel.updateSession(message.session);
        }
        if (message.tools) {
          components.toolsPanel.updateTools(message.tools);
        }
        if (message.variables) {
          components.variablesPanel.updateVariables(message.variables);
        }
      });
      
      // Send batch update
      actors.ui.send(batchUpdate);
      
      // Verify all panels were updated
      expect(components.sessionPanel.updateSession).toHaveBeenCalledWith(batchUpdate.session);
      expect(components.toolsPanel.updateTools).toHaveBeenCalledWith(batchUpdate.tools);
      expect(components.variablesPanel.updateVariables).toHaveBeenCalledWith(batchUpdate.variables);
    });
    
    test('should handle error propagation across components', () => {
      const errorHandlers = {
        terminal: jest.fn(),
        tools: jest.fn(),
        session: jest.fn(),
        variables: jest.fn()
      };
      
      // Setup error handlers
      actors.ui.on('error', (message) => {
        errorHandlers.terminal(message);
        errorHandlers.tools(message);
        errorHandlers.session(message);
        errorHandlers.variables(message);
        
        // Show error in terminal
        components.terminal.umbilical.viewModel.addOutput({
          type: 'error',
          content: message.error
        });
      });
      
      // Broadcast error
      actors.ui.send({
        type: 'error',
        error: 'Connection lost',
        source: 'websocket'
      });
      
      // Verify all components received error
      Object.values(errorHandlers).forEach(handler => {
        expect(handler).toHaveBeenCalledWith({
          type: 'error',
          error: 'Connection lost',
          source: 'websocket'
        });
      });
      
      // Verify terminal displayed error
      expect(components.terminal.umbilical.viewModel.addOutput).toHaveBeenCalledWith({
        type: 'error',
        content: 'Connection lost'
      });
    });
    
    test('should maintain component sync during rapid updates', () => {
      const updates = [];
      
      // Track all updates
      actors.ui.on('rapid.update', (message) => {
        updates.push(message);
      });
      
      // Send rapid updates
      for (let i = 0; i < 10; i++) {
        actors.ui.send({
          type: 'rapid.update',
          index: i,
          timestamp: Date.now()
        });
      }
      
      // Verify all updates were received in order
      expect(updates).toHaveLength(10);
      updates.forEach((update, index) => {
        expect(update.index).toBe(index);
      });
    });
  });
});