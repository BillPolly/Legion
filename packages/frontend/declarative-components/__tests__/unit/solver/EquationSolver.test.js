/**
 * Unit tests for Equation Solver
 * Tests equation solver initialization, state subscription, DOM updates, and event propagation
 */

import { EquationSolver } from '../../../src/solver/EquationSolver.js';

describe('Equation Solver', () => {
  let solver;
  let testElement;
  let testDataStore;
  let eventCallbacks;
  let eventListeners;

  beforeEach(() => {
    // Create real DOM element for testing
    testElement = document.createElement('div');
    
    // Track event listeners
    eventListeners = [];
    const originalAddEventListener = testElement.addEventListener.bind(testElement);
    testElement.addEventListener = (event, handler) => {
      eventListeners.push({ event, handler });
      return originalAddEventListener(event, handler);
    };

    // Create test DataStore with event system
    eventCallbacks = new Map();
    testDataStore = {
      user: {
        name: 'John Doe',
        age: 30,
        active: true,
        profile: {
          bio: 'Developer'
        }
      },
      item: {
        value: 'test',
        count: 42,
        enabled: true
      },
      on: (property, callback) => {
        if (!eventCallbacks.has(property)) {
          eventCallbacks.set(property, []);
        }
        eventCallbacks.get(property).push(callback);
      },
      off: (property, callback) => {
        if (eventCallbacks.has(property)) {
          const callbacks = eventCallbacks.get(property);
          const index = callbacks.indexOf(callback);
          if (index > -1) {
            callbacks.splice(index, 1);
          }
        }
      }
    };

    solver = new EquationSolver(testDataStore);
  });

  describe('Initialization', () => {
    test('should create solver with DataStore', () => {
      expect(solver).toBeDefined();
      expect(solver.dataStore).toBe(testDataStore);
    });

    test('should initialize with empty subscriptions', () => {
      expect(solver.subscriptions).toEqual(new Map());
    });

    test('should initialize with empty element registry', () => {
      expect(solver.elements).toEqual(new Map());
    });

    test('should throw without DataStore', () => {
      expect(() => new EquationSolver()).toThrow('DataStore is required');
    });
  });

  describe('Element Registration', () => {
    test('should register element with key', () => {
      solver.registerElement('root', testElement);

      expect(solver.elements.get('root')).toBe(testElement);
    });

    test('should throw when registering duplicate element key', () => {
      solver.registerElement('root', testElement);

      expect(() => solver.registerElement('root', testElement))
        .toThrow('Element key "root" already registered');
    });

    test('should throw when registering with invalid element', () => {
      expect(() => solver.registerElement('root', null))
        .toThrow('Invalid element');
    });
  });

  describe('Binding Setup', () => {
    test('should setup simple text content binding', () => {
      solver.registerElement('root', testElement);

      const binding = {
        source: 'user.name',
        target: 'root.textContent',
        transform: 'identity'
      };

      solver.setupBinding(binding);

      expect(testElement.textContent).toBe('John Doe');
    });

    test('should setup attribute binding', () => {
      const inputElement = document.createElement('input');
      solver.registerElement('element_1', inputElement);

      const binding = {
        source: 'item.value',
        target: 'element_1.value',
        transform: 'identity'
      };

      solver.setupBinding(binding);

      expect(inputElement.value).toBe('test');
    });

    test('should setup boolean attribute binding', () => {
      const checkboxElement = document.createElement('input');
      checkboxElement.type = 'checkbox';
      solver.registerElement('checkbox', checkboxElement);

      const binding = {
        source: 'item.enabled',
        target: 'checkbox.checked',
        transform: 'identity'
      };

      solver.setupBinding(binding);

      expect(checkboxElement.checked).toBe(true);
    });

    test('should setup data attribute binding', () => {
      solver.registerElement('root', testElement);

      const binding = {
        source: 'item.count',
        target: 'root.data-id',
        transform: 'identity'
      };

      solver.setupBinding(binding);

      expect(testElement.getAttribute('data-id')).toBe('42');
    });

    test('should handle nested property access', () => {
      solver.registerElement('bio', testElement);

      const binding = {
        source: 'user.profile.bio',
        target: 'bio.textContent',
        transform: 'identity'
      };

      solver.setupBinding(binding);

      expect(testElement.textContent).toBe('Developer');
    });

    test('should apply transform function', () => {
      solver.registerElement('text', testElement);
      
      const binding = {
        source: 'user.age',
        target: 'text.textContent',
        transform: 'age => "Age: " + age'
      };

      solver.setupBinding(binding);

      expect(testElement.textContent).toBe('Age: 30');
    });

    test('should handle multi-property transform', () => {
      solver.registerElement('fullname', testElement);
      
      // Add first and last name to test data
      testDataStore.user.firstName = 'John';
      testDataStore.user.lastName = 'Smith';
      
      const binding = {
        source: 'user.firstName,user.lastName',
        target: 'fullname.textContent',
        transform: 'firstName,lastName => firstName + " " + lastName'
      };

      solver.setupBinding(binding);

      expect(testElement.textContent).toBe('John Smith');
    });

    test('should handle conditional transform', () => {
      solver.registerElement('status', testElement);
      
      const binding = {
        source: 'user.active',
        target: 'status.className',
        transform: 'active => active ? "active" : "inactive"'
      };

      solver.setupBinding(binding);

      expect(testElement.className).toBe('active');
    });

    test('should throw on invalid element key', () => {
      const binding = {
        source: 'user.name',
        target: 'nonexistent.textContent',
        transform: 'identity'
      };

      expect(() => solver.setupBinding(binding))
        .toThrow('Element "nonexistent" not registered');
    });

    test('should handle nonexistent source property gracefully', () => {
      solver.registerElement('root', testElement);

      const binding = {
        source: 'nonexistent.property',
        target: 'root.textContent',
        transform: 'identity'
      };

      // Should not throw, but should set empty string
      expect(() => solver.setupBinding(binding)).not.toThrow();
      
      // Element should receive empty string for missing property
      expect(testElement.textContent).toBe('');
    });
  });

  describe('State Subscription', () => {
    test('should subscribe to state changes', () => {
      solver.registerElement('name', testElement);

      const binding = {
        source: 'user.name',
        target: 'name.textContent',
        transform: 'identity'
      };

      solver.setupBinding(binding);

      expect(eventCallbacks.has('user.name')).toBe(true);
      expect(eventCallbacks.get('user.name').length).toBe(1);
    });

    test('should track subscription for cleanup', () => {
      solver.registerElement('name', testElement);

      const binding = {
        source: 'user.name',
        target: 'name.textContent',
        transform: 'identity'
      };

      solver.setupBinding(binding);

      expect(solver.subscriptions.has('user.name')).toBe(true);
    });
  });

  describe('Event Handling', () => {
    test('should setup event binding', () => {
      solver.registerElement('button', testElement);

      const event = {
        element: 'button',
        event: 'click',
        action: 'user.active = !user.active'
      };

      solver.setupEvent(event);

      expect(eventListeners.length).toBe(1);
      expect(eventListeners[0].event).toBe('click');
    });

    test('should execute action on event', () => {
      solver.registerElement('button', testElement);

      const event = {
        element: 'button',
        event: 'click',
        action: 'user.active = false'
      };

      solver.setupEvent(event);

      // Get the event handler and trigger it
      const eventHandler = eventListeners[0].handler;
      eventHandler();

      expect(testDataStore.user.active).toBe(false);
    });

    test('should handle event with modifiers', () => {
      solver.registerElement('input', testElement);

      const event = {
        element: 'input',
        event: 'keyup',
        modifiers: ['enter'],
        action: 'user.name = "submitted"'
      };

      solver.setupEvent(event);

      const eventHandler = eventListeners[0].handler;
      
      // Simulate keyup without enter
      eventHandler({ key: 'a' });
      expect(testDataStore.user.name).toBe('John Doe'); // Unchanged

      // Simulate keyup with enter
      eventHandler({ key: 'Enter' });
      expect(testDataStore.user.name).toBe('submitted');
    });

    test('should handle prevent modifier', () => {
      const mockEvent = {
        preventDefault: () => { mockEvent.defaultPrevented = true; },
        defaultPrevented: false
      };

      solver.registerElement('form', testElement);

      const event = {
        element: 'form',
        event: 'submit',
        modifiers: ['prevent'],
        action: 'user.name = "prevented"'
      };

      solver.setupEvent(event);

      const eventHandler = eventListeners[0].handler;
      eventHandler(mockEvent);

      expect(mockEvent.defaultPrevented).toBe(true);
      expect(testDataStore.user.name).toBe('prevented');
    });

    test('should throw on invalid element for events', () => {
      const event = {
        element: 'nonexistent',
        event: 'click',
        action: 'user.active = true'
      };

      expect(() => solver.setupEvent(event))
        .toThrow('Element "nonexistent" not registered');
    });
  });

  describe('Component Processing', () => {
    test('should process complete component definition', () => {
      const nameElement = document.createElement('h2');
      solver.registerElement('root', testElement);
      solver.registerElement('element_1', nameElement);

      const componentDef = {
        name: 'UserCard',
        entity: 'user',
        structure: {
          root: { element: 'div', class: 'user-card', children: ['element_1'] },
          element_1: { element: 'h2', parent: 'root' }
        },
        bindings: [
          {
            source: 'user.name',
            target: 'element_1.textContent',
            transform: 'identity'
          }
        ],
        events: []
      };

      solver.processComponent(componentDef);

      expect(nameElement.textContent).toBe('John Doe');
    });

    test('should process component with events', () => {
      const buttonElement = document.createElement('button');
      
      // Apply event listener tracking to buttonElement
      const originalButtonAddEventListener = buttonElement.addEventListener.bind(buttonElement);
      buttonElement.addEventListener = (event, handler) => {
        eventListeners.push({ event, handler });
        return originalButtonAddEventListener(event, handler);
      };
      
      solver.registerElement('root', testElement);
      solver.registerElement('button', buttonElement);

      const componentDef = {
        name: 'Counter',
        entity: 'counter',
        structure: {
          root: { element: 'div', children: ['button'] },
          button: { element: 'button', parent: 'root' }
        },
        bindings: [],
        events: [
          {
            element: 'button',
            event: 'click',
            action: 'counter.count++'
          }
        ]
      };

      // Add counter to test data store
      testDataStore.counter = { count: 0 };

      solver.processComponent(componentDef);

      expect(eventListeners.length).toBe(1);
      expect(eventListeners[0].event).toBe('click');
    });
  });

  describe('Cleanup', () => {
    test('should cleanup all subscriptions', () => {
      solver.registerElement('name', testElement);

      const binding = {
        source: 'user.name',
        target: 'name.textContent',
        transform: 'identity'
      };

      solver.setupBinding(binding);
      
      expect(eventCallbacks.get('user.name').length).toBe(1);
      
      solver.cleanup();

      expect(eventCallbacks.get('user.name').length).toBe(0);
    });

    test('should clear all internal state', () => {
      solver.registerElement('test', testElement);

      const binding = {
        source: 'user.name',
        target: 'test.textContent',
        transform: 'identity'
      };

      solver.setupBinding(binding);
      solver.cleanup();

      expect(solver.subscriptions.size).toBe(0);
      expect(solver.elements.size).toBe(0);
    });
  });

  describe('Error Handling', () => {
    test('should throw on invalid binding target', () => {
      solver.registerElement('root', testElement);

      const binding = {
        source: 'user.name',
        target: 'root.invalidProperty',
        transform: 'identity'
      };

      expect(() => solver.setupBinding(binding))
        .toThrow('Invalid target property "invalidProperty"');
    });

    test('should throw on invalid transform syntax', () => {
      solver.registerElement('root', testElement);

      const binding = {
        source: 'user.name',
        target: 'root.textContent',
        transform: 'invalid syntax here'
      };

      expect(() => solver.setupBinding(binding))
        .toThrow('Invalid transform syntax');
    });

    test('should throw on action execution error', () => {
      solver.registerElement('button', testElement);

      const event = {
        element: 'button',
        event: 'click',
        action: 'invalid.syntax.here'
      };

      solver.setupEvent(event);

      const eventHandler = eventListeners[0].handler;
      
      expect(() => eventHandler())
        .toThrow('Failed to execute action');
    });
  });
});