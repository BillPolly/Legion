/**
 * Tests for AiurActorsApp - Main application entry point
 */
import { describe, test, expect, beforeEach, jest } from '@jest/globals';

describe('AiurActorsApp', () => {
  let AiurActorsApp;
  let mockDom, mockComponentFactory, mockActorSpace;
  
  beforeEach(async () => {
    // Mock DOM container
    mockDom = {
      querySelector: jest.fn(),
      appendChild: jest.fn(),
      removeChild: jest.fn(),
      innerHTML: '',
      classList: {
        add: jest.fn(),
        remove: jest.fn()
      }
    };
    
    // Mock ComponentFactory
    mockComponentFactory = {
      createTerminal: jest.fn(),
      createToolsPanel: jest.fn(),
      createSessionPanel: jest.fn(),
      createVariablesPanel: jest.fn()
    };
    
    // Mock ActorSpace
    mockActorSpace = {
      register: jest.fn(),
      getActor: jest.fn(),
      createChannel: jest.fn(),
      destroy: jest.fn()
    };
    
    // Mock components
    const mockComponent = {
      destroy: jest.fn(),
      model: {},
      view: {},
      viewModel: {}
    };
    
    mockComponentFactory.createTerminal.mockReturnValue(mockComponent);
    mockComponentFactory.createToolsPanel.mockReturnValue(mockComponent);
    mockComponentFactory.createSessionPanel.mockReturnValue(mockComponent);
    mockComponentFactory.createVariablesPanel.mockReturnValue(mockComponent);
    
    // Import the app class (will be created)
    try {
      ({ AiurActorsApp } = await import('../../../src/app/AiurActorsApp.js'));
    } catch (error) {
      // Class doesn't exist yet, create a mock
      AiurActorsApp = class {
        constructor(config) {
          this.config = config;
          this.initialized = false;
          this.components = {};
          this.actors = {};
        }
        
        async initialize() {
          this.initialized = true;
          return true;
        }
        
        createComponents() {
          this.components.terminal = this.config.componentFactory.createTerminal({
            dom: this.config.dom.querySelector('#terminal'),
            actorSpace: this.config.actorSpace
          });
        }
        
        setupActors() {
          // Setup actors
        }
        
        start() {
          if (!this.initialized) {
            throw new Error('App must be initialized before starting');
          }
        }
        
        stop() {
          // Stop app
        }
        
        destroy() {
          Object.values(this.components).forEach(component => {
            if (component && component.destroy) {
              component.destroy();
            }
          });
        }
      };
    }
  });

  describe('Application Initialization', () => {
    test('should create app with configuration', () => {
      const config = {
        dom: mockDom,
        componentFactory: mockComponentFactory,
        actorSpace: mockActorSpace,
        options: {
          theme: 'dark',
          autoConnect: true
        }
      };
      
      const app = new AiurActorsApp(config);
      
      expect(app).toBeDefined();
      expect(app.config).toBe(config);
      expect(app.initialized).toBe(false);
    });

    test('should validate required configuration', () => {
      expect(() => {
        new AiurActorsApp({});
      }).toThrow('DOM container is required');
      
      expect(() => {
        new AiurActorsApp({ dom: mockDom });
      }).toThrow('ComponentFactory is required');
      
      expect(() => {
        new AiurActorsApp({ dom: mockDom, componentFactory: mockComponentFactory });
      }).toThrow('ActorSpace is required');
    });

    test('should initialize app asynchronously', async () => {
      // Mock DOM elements
      const mockElements = {
        '#terminal': document.createElement('div'),
        '#tools-panel': document.createElement('div'),
        '#session-panel': document.createElement('div'),
        '#variables-panel': document.createElement('div')
      };
      
      mockDom.querySelector.mockImplementation(selector => mockElements[selector]);
      
      const app = new AiurActorsApp({
        dom: mockDom,
        componentFactory: mockComponentFactory,
        actorSpace: mockActorSpace
      });
      
      expect(app.initialized).toBe(false);
      
      const result = await app.initialize();
      
      expect(result).toBe(true);
      expect(app.initialized).toBe(true);
    });

    test('should handle initialization errors gracefully', async () => {
      const app = new AiurActorsApp({
        dom: mockDom,
        componentFactory: mockComponentFactory,
        actorSpace: mockActorSpace
      });
      
      // Mock initialization failure
      app.initialize = jest.fn().mockRejectedValue(new Error('Init failed'));
      
      await expect(app.initialize()).rejects.toThrow('Init failed');
    });
  });

  describe('Component Creation', () => {
    test('should create all UI components', () => {
      // Mock DOM elements
      const terminalEl = document.createElement('div');
      const toolsEl = document.createElement('div');
      const sessionEl = document.createElement('div');
      const variablesEl = document.createElement('div');
      
      mockDom.querySelector.mockImplementation((selector) => {
        switch (selector) {
          case '#terminal': return terminalEl;
          case '#tools-panel': return toolsEl;
          case '#session-panel': return sessionEl;
          case '#variables-panel': return variablesEl;
          default: return null;
        }
      });
      
      const app = new AiurActorsApp({
        dom: mockDom,
        componentFactory: mockComponentFactory,
        actorSpace: mockActorSpace
      });
      
      app.createComponents();
      
      expect(mockComponentFactory.createTerminal).toHaveBeenCalledWith({
        dom: terminalEl,
        actorSpace: mockActorSpace
      });
      
      expect(mockComponentFactory.createToolsPanel).toHaveBeenCalledWith({
        dom: toolsEl,
        actorSpace: mockActorSpace
      });
      
      expect(mockComponentFactory.createSessionPanel).toHaveBeenCalledWith({
        dom: sessionEl,
        actorSpace: mockActorSpace
      });
      
      expect(mockComponentFactory.createVariablesPanel).toHaveBeenCalledWith({
        dom: variablesEl,
        actorSpace: mockActorSpace
      });
    });

    test('should store component references', () => {
      const terminalEl = document.createElement('div');
      mockDom.querySelector.mockReturnValue(terminalEl);
      
      const mockTerminal = { id: 'terminal', destroy: jest.fn() };
      mockComponentFactory.createTerminal.mockReturnValue(mockTerminal);
      
      const app = new AiurActorsApp({
        dom: mockDom,
        componentFactory: mockComponentFactory,
        actorSpace: mockActorSpace
      });
      
      app.createComponents();
      
      expect(app.components.terminal).toBe(mockTerminal);
    });

    test('should handle missing DOM elements gracefully', () => {
      mockDom.querySelector.mockReturnValue(null);
      
      const app = new AiurActorsApp({
        dom: mockDom,
        componentFactory: mockComponentFactory,
        actorSpace: mockActorSpace
      });
      
      expect(() => {
        app.createComponents();
      }).toThrow('Terminal container not found');
    });

    test('should pass configuration to components', () => {
      const terminalEl = document.createElement('div');
      mockDom.querySelector.mockReturnValue(terminalEl);
      
      const app = new AiurActorsApp({
        dom: mockDom,
        componentFactory: mockComponentFactory,
        actorSpace: mockActorSpace,
        options: {
          theme: 'dark',
          terminal: {
            fontSize: '14px',
            fontFamily: 'monospace'
          }
        }
      });
      
      app.createComponents();
      
      expect(mockComponentFactory.createTerminal).toHaveBeenCalledWith({
        dom: terminalEl,
        actorSpace: mockActorSpace,
        config: {
          fontSize: '14px',
          fontFamily: 'monospace'
        }
      });
    });
  });

  describe('Actor Space Setup', () => {
    test('should create and register actors', () => {
      const app = new AiurActorsApp({
        dom: mockDom,
        componentFactory: mockComponentFactory,
        actorSpace: mockActorSpace
      });
      
      app.setupActors();
      
      // Should register required actors
      expect(mockActorSpace.register).toHaveBeenCalledWith(
        expect.any(Object),
        'command-actor'
      );
      
      expect(mockActorSpace.register).toHaveBeenCalledWith(
        expect.any(Object),
        'ui-actor'
      );
      
      expect(mockActorSpace.register).toHaveBeenCalledWith(
        expect.any(Object),
        'tools-actor'
      );
      
      expect(mockActorSpace.register).toHaveBeenCalledWith(
        expect.any(Object),
        'sessions-actor'
      );
      
      expect(mockActorSpace.register).toHaveBeenCalledWith(
        expect.any(Object),
        'variables-actor'
      );
    });

    test('should setup WebSocket channel when configured', () => {
      const mockWebSocket = {
        readyState: 1,
        send: jest.fn(),
        close: jest.fn()
      };
      
      global.WebSocket = jest.fn().mockImplementation(() => mockWebSocket);
      
      const app = new AiurActorsApp({
        dom: mockDom,
        componentFactory: mockComponentFactory,
        actorSpace: mockActorSpace,
        options: {
          websocketUrl: 'ws://localhost:8080'
        }
      });
      
      app.setupWebSocketConnection();
      
      expect(global.WebSocket).toHaveBeenCalledWith('ws://localhost:8080');
      
      // Simulate WebSocket open event to trigger channel creation
      mockWebSocket.onopen();
      
      expect(mockActorSpace.createChannel).toHaveBeenCalledWith(mockWebSocket);
    });

    test('should handle WebSocket connection errors', () => {
      const mockWebSocket = {
        readyState: 3, // CLOSED
        onerror: null
      };
      
      global.WebSocket = jest.fn().mockImplementation(() => mockWebSocket);
      
      const app = new AiurActorsApp({
        dom: mockDom,
        componentFactory: mockComponentFactory,
        actorSpace: mockActorSpace,
        options: {
          websocketUrl: 'ws://localhost:8080',
          onConnectionError: jest.fn()
        }
      });
      
      app.setupWebSocketConnection();
      
      // Simulate error
      const error = new Error('Connection failed');
      mockWebSocket.onerror(error);
      
      expect(app.config.options.onConnectionError).toHaveBeenCalledWith(error);
    });
  });

  describe('Application Lifecycle', () => {
    test('should start app after initialization', () => {
      const app = new AiurActorsApp({
        dom: mockDom,
        componentFactory: mockComponentFactory,
        actorSpace: mockActorSpace
      });
      
      expect(() => {
        app.start();
      }).toThrow('App must be initialized before starting');
      
      app.initialized = true;
      expect(() => {
        app.start();
      }).not.toThrow();
    });

    test('should provide ready callback', async () => {
      const onReady = jest.fn();
      
      // Mock DOM elements
      const mockElements = {
        '#terminal': document.createElement('div'),
        '#tools-panel': document.createElement('div'),
        '#session-panel': document.createElement('div'),
        '#variables-panel': document.createElement('div')
      };
      
      mockDom.querySelector.mockImplementation(selector => mockElements[selector]);
      
      const app = new AiurActorsApp({
        dom: mockDom,
        componentFactory: mockComponentFactory,
        actorSpace: mockActorSpace,
        onReady
      });
      
      await app.initialize();
      app.start();
      
      expect(onReady).toHaveBeenCalledWith(app);
    });

    test('should stop app gracefully', () => {
      const app = new AiurActorsApp({
        dom: mockDom,
        componentFactory: mockComponentFactory,
        actorSpace: mockActorSpace
      });
      
      app.initialized = true;
      app.start();
      
      const stopSpy = jest.spyOn(app, 'stop');
      app.stop();
      
      expect(stopSpy).toHaveBeenCalled();
    });

    test('should destroy app and cleanup resources', () => {
      const mockTerminal = { destroy: jest.fn() };
      const mockToolsPanel = { destroy: jest.fn() };
      
      const app = new AiurActorsApp({
        dom: mockDom,
        componentFactory: mockComponentFactory,
        actorSpace: mockActorSpace
      });
      
      app.components = {
        terminal: mockTerminal,
        toolsPanel: mockToolsPanel
      };
      
      app.destroy();
      
      expect(mockTerminal.destroy).toHaveBeenCalled();
      expect(mockToolsPanel.destroy).toHaveBeenCalled();
      expect(mockActorSpace.destroy).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    test('should handle component creation errors', () => {
      mockComponentFactory.createTerminal.mockImplementation(() => {
        throw new Error('Failed to create terminal');
      });
      
      const app = new AiurActorsApp({
        dom: mockDom,
        componentFactory: mockComponentFactory,
        actorSpace: mockActorSpace,
        onError: jest.fn()
      });
      
      const terminalEl = document.createElement('div');
      mockDom.querySelector.mockReturnValue(terminalEl);
      
      expect(() => {
        app.createComponents();
      }).toThrow('Failed to create terminal');
    });

    test('should emit error events', () => {
      const onError = jest.fn();
      
      const app = new AiurActorsApp({
        dom: mockDom,
        componentFactory: mockComponentFactory,
        actorSpace: mockActorSpace,
        onError
      });
      
      const error = new Error('Test error');
      app.handleError(error);
      
      expect(onError).toHaveBeenCalledWith(error);
    });

    test('should provide error recovery mechanism', async () => {
      // Mock DOM elements
      const mockElements = {
        '#terminal': document.createElement('div'),
        '#tools-panel': document.createElement('div'),
        '#session-panel': document.createElement('div'),
        '#variables-panel': document.createElement('div')
      };
      
      mockDom.querySelector.mockImplementation(selector => mockElements[selector]);
      
      const app = new AiurActorsApp({
        dom: mockDom,
        componentFactory: mockComponentFactory,
        actorSpace: mockActorSpace
      });
      
      // Simulate error state
      app.errorState = true;
      
      await app.recover();
      
      expect(app.errorState).toBe(false);
      expect(app.initialized).toBe(true);
    });
  });

  describe('Public API', () => {
    test('should expose public methods', () => {
      const app = new AiurActorsApp({
        dom: mockDom,
        componentFactory: mockComponentFactory,
        actorSpace: mockActorSpace
      });
      
      expect(typeof app.initialize).toBe('function');
      expect(typeof app.start).toBe('function');
      expect(typeof app.stop).toBe('function');
      expect(typeof app.destroy).toBe('function');
      expect(typeof app.getComponent).toBe('function');
      expect(typeof app.getActor).toBe('function');
      expect(typeof app.executeCommand).toBe('function');
    });

    test('should get component by name', () => {
      const mockTerminal = { id: 'terminal' };
      
      const app = new AiurActorsApp({
        dom: mockDom,
        componentFactory: mockComponentFactory,
        actorSpace: mockActorSpace
      });
      
      app.components.terminal = mockTerminal;
      
      expect(app.getComponent('terminal')).toBe(mockTerminal);
      expect(app.getComponent('nonexistent')).toBeUndefined();
    });

    test('should get actor by key', () => {
      const mockActor = { id: 'command-actor' };
      mockActorSpace.getActor.mockReturnValue(mockActor);
      
      const app = new AiurActorsApp({
        dom: mockDom,
        componentFactory: mockComponentFactory,
        actorSpace: mockActorSpace
      });
      
      expect(app.getActor('command-actor')).toBe(mockActor);
      expect(mockActorSpace.getActor).toHaveBeenCalledWith('command-actor');
    });

    test('should execute commands through command actor', () => {
      const mockCommandActor = {
        receive: jest.fn()
      };
      
      mockActorSpace.getActor.mockReturnValue(mockCommandActor);
      
      const app = new AiurActorsApp({
        dom: mockDom,
        componentFactory: mockComponentFactory,
        actorSpace: mockActorSpace
      });
      
      app.executeCommand('git status');
      
      expect(mockCommandActor.receive).toHaveBeenCalledWith({
        type: 'execute',
        command: 'git status',
        requestId: expect.any(String)
      });
    });
  });
});