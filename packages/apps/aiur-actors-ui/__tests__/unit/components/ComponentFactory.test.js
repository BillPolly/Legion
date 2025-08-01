/**
 * Tests for ComponentFactory
 */
import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';

describe('ComponentFactory', () => {
  let ComponentFactory;
  let mockActorSpace;
  let container;
  
  beforeEach(async () => {
    ({ ComponentFactory } = await import('../../../src/components/ComponentFactory.js'));
    
    // Create mock actor space
    mockActorSpace = {
      getActor: jest.fn(),
      register: jest.fn()
    };
    
    // Create DOM container
    container = document.createElement('div');
    document.body.appendChild(container);
  });
  
  afterEach(() => {
    if (container.parentNode) {
      document.body.removeChild(container);
    }
  });

  test('should create component factory with configuration', () => {
    const factory = new ComponentFactory({
      actorSpace: mockActorSpace,
      theme: 'dark'
    });
    
    expect(factory).toBeDefined();
    expect(factory.config.actorSpace).toBe(mockActorSpace);
    expect(factory.config.theme).toBe('dark');
  });

  test('should validate umbilical requirements', () => {
    const factory = new ComponentFactory();
    
    // Valid umbilical
    const validUmbilical = {
      dom: container,
      actorSpace: mockActorSpace,
      onMount: jest.fn(),
      onDestroy: jest.fn()
    };
    
    const validation = factory.validateUmbilical(validUmbilical, ['dom', 'actorSpace']);
    expect(validation.valid).toBe(true);
    expect(validation.errors).toHaveLength(0);
    
    // Invalid umbilical - missing required
    const invalidUmbilical = {
      dom: container
    };
    
    const invalidValidation = factory.validateUmbilical(invalidUmbilical, ['dom', 'actorSpace']);
    expect(invalidValidation.valid).toBe(false);
    expect(invalidValidation.errors).toContain('Missing required property: actorSpace');
  });

  test('should create terminal component', () => {
    const factory = new ComponentFactory({
      actorSpace: mockActorSpace
    });
    
    const umbilical = {
      dom: container,
      actorSpace: mockActorSpace,
      onMount: jest.fn(),
      config: {
        prompt: '$ ',
        maxHistory: 500
      }
    };
    
    const terminal = factory.createTerminal(umbilical);
    
    expect(terminal).toBeDefined();
    expect(terminal.destroy).toBeInstanceOf(Function);
    expect(terminal.execute).toBeInstanceOf(Function);
    expect(terminal.clear).toBeInstanceOf(Function);
    expect(umbilical.onMount).toHaveBeenCalledWith(terminal);
  });

  test('should create tools panel component', () => {
    const factory = new ComponentFactory({
      actorSpace: mockActorSpace
    });
    
    const umbilical = {
      dom: container,
      actorSpace: mockActorSpace,
      onToolSelect: jest.fn()
    };
    
    const toolsPanel = factory.createToolsPanel(umbilical);
    
    expect(toolsPanel).toBeDefined();
    expect(toolsPanel.destroy).toBeInstanceOf(Function);
    expect(toolsPanel.refreshTools).toBeInstanceOf(Function);
  });

  test('should create session panel component', () => {
    const factory = new ComponentFactory({
      actorSpace: mockActorSpace
    });
    
    const umbilical = {
      dom: container,
      actorSpace: mockActorSpace,
      onSessionChange: jest.fn()
    };
    
    const sessionPanel = factory.createSessionPanel(umbilical);
    
    expect(sessionPanel).toBeDefined();
    expect(sessionPanel.destroy).toBeInstanceOf(Function);
    expect(sessionPanel.refreshSessions).toBeInstanceOf(Function);
  });

  test('should create variables panel component', () => {
    const factory = new ComponentFactory({
      actorSpace: mockActorSpace
    });
    
    const umbilical = {
      dom: container,
      actorSpace: mockActorSpace,
      onVariableSelect: jest.fn()
    };
    
    const variablesPanel = factory.createVariablesPanel(umbilical);
    
    expect(variablesPanel).toBeDefined();
    expect(variablesPanel.destroy).toBeInstanceOf(Function);
    expect(variablesPanel.refreshVariables).toBeInstanceOf(Function);
  });

  test('should handle component lifecycle', () => {
    const factory = new ComponentFactory({
      actorSpace: mockActorSpace
    });
    
    const onMount = jest.fn();
    const onDestroy = jest.fn();
    
    const umbilical = {
      dom: container,
      actorSpace: mockActorSpace,
      onMount,
      onDestroy
    };
    
    const component = factory.createTerminal(umbilical);
    expect(onMount).toHaveBeenCalledWith(component);
    
    component.destroy();
    expect(onDestroy).toHaveBeenCalledWith(component);
  });

  test('should merge factory config with umbilical', () => {
    const factory = new ComponentFactory({
      actorSpace: mockActorSpace,
      theme: 'dark',
      defaultPrompt: '> '
    });
    
    const umbilical = {
      dom: container,
      config: {
        prompt: '$ '
      }
    };
    
    const mergedUmbilical = factory.mergeConfig(umbilical);
    
    expect(mergedUmbilical.actorSpace).toBe(mockActorSpace);
    expect(mergedUmbilical.theme).toBe('dark');
    expect(mergedUmbilical.config.prompt).toBe('$ '); // Umbilical overrides
    expect(mergedUmbilical.config.defaultPrompt).toBe('> '); // Factory default
  });

  test('should create complete application', () => {
    const factory = new ComponentFactory({
      actorSpace: mockActorSpace
    });
    
    // Create container structure
    const terminalContainer = document.createElement('div');
    const toolsContainer = document.createElement('div');
    const sessionContainer = document.createElement('div');
    const variablesContainer = document.createElement('div');
    
    container.appendChild(terminalContainer);
    container.appendChild(toolsContainer);
    container.appendChild(sessionContainer);
    container.appendChild(variablesContainer);
    
    const app = factory.createApplication({
      containers: {
        terminal: terminalContainer,
        tools: toolsContainer,
        session: sessionContainer,
        variables: variablesContainer
      },
      callbacks: {
        onToolSelect: jest.fn(),
        onSessionChange: jest.fn(),
        onVariableSelect: jest.fn()
      }
    });
    
    expect(app).toBeDefined();
    expect(app.terminal).toBeDefined();
    expect(app.toolsPanel).toBeDefined();
    expect(app.sessionPanel).toBeDefined();
    expect(app.variablesPanel).toBeDefined();
    expect(app.destroy).toBeInstanceOf(Function);
    
    // Test destroy cleans up all components
    app.destroy();
  });

  test('should handle errors gracefully', () => {
    const factory = new ComponentFactory();
    
    // No DOM element
    expect(() => {
      factory.createTerminal({ actorSpace: mockActorSpace });
    }).toThrow('Missing required property: dom');
    
    // Invalid DOM element
    expect(() => {
      factory.createTerminal({ 
        dom: 'not-an-element',
        actorSpace: mockActorSpace 
      });
    }).toThrow('Invalid DOM element');
  });
});