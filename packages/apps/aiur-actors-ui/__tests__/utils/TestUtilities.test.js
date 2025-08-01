/**
 * Tests for test utilities
 */
import { describe, test, expect, beforeEach, jest } from '@jest/globals';

describe('TestUtilities', () => {
  let TestUtilities;
  
  beforeEach(async () => {
    ({ TestUtilities } = await import('./test-utilities.js'));
  });

  describe('createMockUmbilical', () => {
    test('should create basic mock umbilical', () => {
      const umbilical = TestUtilities.createMockUmbilical();
      
      expect(umbilical).toBeDefined();
      expect(umbilical.dom).toBeDefined();
      expect(umbilical.dom.nodeType).toBe(1); // Element node
      expect(umbilical.actorSpace).toBeDefined();
      expect(umbilical.callbacks).toBeDefined();
    });
    
    test('should merge custom properties', () => {
      const custom = {
        theme: 'dark',
        config: { prompt: '$ ' }
      };
      
      const umbilical = TestUtilities.createMockUmbilical(custom);
      
      expect(umbilical.theme).toBe('dark');
      expect(umbilical.config.prompt).toBe('$ ');
      expect(umbilical.dom).toBeDefined(); // Still has defaults
    });
    
    test('should create tracked callbacks', () => {
      const umbilical = TestUtilities.createMockUmbilical();
      
      // Call a callback
      umbilical.onMount({ id: 'test' });
      
      // Check it was tracked
      expect(umbilical.callbacks.onMount).toHaveBeenCalledWith({ id: 'test' });
      expect(umbilical.callbacks.onMount).toHaveBeenCalledTimes(1);
    });
  });

  describe('createMockActorSpace', () => {
    test('should create mock actor space with default actors', () => {
      const actorSpace = TestUtilities.createMockActorSpace();
      
      expect(actorSpace).toBeDefined();
      expect(typeof actorSpace.getActor).toBe('function');
      expect(typeof actorSpace.register).toBe('function');
      expect(typeof actorSpace.destroy).toBe('function');
      
      // Check default actors
      const commandActor = actorSpace.getActor('command-actor');
      expect(commandActor).toBeDefined();
      expect(typeof commandActor.receive).toBe('function');
      
      const updateActor = actorSpace.getActor('ui-update-actor');
      expect(updateActor).toBeDefined();
    });
    
    test('should allow custom actors', () => {
      const customActor = {
        receive: jest.fn()
      };
      
      const actorSpace = TestUtilities.createMockActorSpace({
        'custom-actor': customActor
      });
      
      expect(actorSpace.getActor('custom-actor')).toBe(customActor);
      expect(actorSpace.getActor('command-actor')).toBeDefined(); // Still has defaults
    });
    
    test('should handle actor registration', () => {
      const actorSpace = TestUtilities.createMockActorSpace();
      const newActor = { receive: jest.fn() };
      
      actorSpace.register(newActor, 'new-actor');
      
      expect(actorSpace.getActor('new-actor')).toBe(newActor);
    });
  });

  describe('createDOMTestEnvironment', () => {
    test('should create DOM test environment', () => {
      const env = TestUtilities.createDOMTestEnvironment();
      
      expect(env.container).toBeDefined();
      expect(env.container.parentNode).toBe(document.body);
      expect(typeof env.cleanup).toBe('function');
    });
    
    test('should cleanup DOM on demand', () => {
      const env = TestUtilities.createDOMTestEnvironment();
      const container = env.container;
      
      expect(document.body.contains(container)).toBe(true);
      
      env.cleanup();
      
      expect(document.body.contains(container)).toBe(false);
    });
    
    test('should create nested structure', () => {
      const env = TestUtilities.createDOMTestEnvironment({
        structure: {
          terminal: 'div.terminal',
          sidebar: {
            tools: 'div.tools-panel',
            sessions: 'div.session-panel'
          }
        }
      });
      
      expect(env.elements.terminal).toBeDefined();
      expect(env.elements.terminal.classList.contains('terminal')).toBe(true);
      
      expect(env.elements.sidebar.tools).toBeDefined();
      expect(env.elements.sidebar.tools.classList.contains('tools-panel')).toBe(true);
    });
  });

  describe('waitForActor', () => {
    test('should wait for actor message', async () => {
      const actor = {
        receive: jest.fn()
      };
      
      // Set up to resolve after delay
      setTimeout(() => {
        actor.receive({ type: 'response', data: 'test' });
      }, 10);
      
      const promise = TestUtilities.waitForActor(actor, 'response');
      
      await expect(promise).resolves.toEqual({ type: 'response', data: 'test' });
      expect(actor.receive).toHaveBeenCalled();
    });
    
    test('should timeout if no message', async () => {
      const actor = {
        receive: jest.fn()
      };
      
      const promise = TestUtilities.waitForActor(actor, 'response', 50);
      
      await expect(promise).rejects.toThrow('Timeout waiting for actor message');
    });
  });

  describe('simulateUserInput', () => {
    test('should simulate typing in input', () => {
      const input = document.createElement('input');
      const changeSpy = jest.fn();
      input.addEventListener('input', changeSpy);
      
      TestUtilities.simulateUserInput(input, 'hello world');
      
      expect(input.value).toBe('hello world');
      expect(changeSpy).toHaveBeenCalled();
    });
    
    test('should simulate enter key', () => {
      const input = document.createElement('input');
      const enterSpy = jest.fn();
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') enterSpy();
      });
      
      TestUtilities.simulateUserInput(input, 'command', true);
      
      expect(input.value).toBe('command');
      expect(enterSpy).toHaveBeenCalled();
    });
  });

  describe('captureComponentOutput', () => {
    test('should capture component method calls', () => {
      const component = {
        addOutput: (text) => {},
        clearOutput: () => {}
      };
      
      const captured = TestUtilities.captureComponentOutput(component);
      
      component.addOutput('Line 1');
      component.addOutput('Line 2');
      
      expect(captured.outputs).toEqual(['Line 1', 'Line 2']);
      
      component.clearOutput();
      
      expect(captured.cleared).toBe(true);
      expect(captured.outputs).toEqual([]); // Should be cleared
    });
  });

  describe('createTestComponent', () => {
    test('should create test component with MVVM', () => {
      const config = {
        model: { data: 'test' },
        view: { rendered: false },
        viewModel: { initialized: false }
      };
      
      const component = TestUtilities.createTestComponent(config);
      
      expect(component).toBeDefined();
      expect(component.model).toEqual({ data: 'test' });
      expect(component.view).toEqual({ rendered: false });
      expect(component.viewModel).toEqual({ initialized: false });
      expect(typeof component.destroy).toBe('function');
    });
  });
});