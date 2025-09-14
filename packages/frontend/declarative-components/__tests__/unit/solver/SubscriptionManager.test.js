/**
 * Unit tests for Subscription Management
 * Tests subscription lifecycle, memory management, and cleanup
 */

import { EquationSolver } from '../../../src/solver/EquationSolver.js';

describe('Subscription Management', () => {
  let solver;
  let testElement;
  let testDataStore;
  let eventCallbacks;

  beforeEach(() => {
    // Create real DOM element for testing
    testElement = document.createElement('div');
    
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

  describe('Subscription Creation', () => {
    test('should create subscription for single property', () => {
      solver.registerElement('test', testElement);

      const binding = {
        source: 'user.name',
        target: 'test.textContent',
        transform: 'identity'
      };

      solver.setupBinding(binding);

      expect(solver.subscriptions.has('user.name')).toBe(true);
      expect(solver.subscriptions.get('user.name')).toBeDefined();
      expect(eventCallbacks.has('user.name')).toBe(true);
      expect(eventCallbacks.get('user.name').length).toBe(1);
    });

    test('should create subscriptions for multi-property bindings', () => {
      solver.registerElement('fullname', testElement);
      
      // Add test properties
      testDataStore.user.firstName = 'John';
      testDataStore.user.lastName = 'Smith';
      
      const binding = {
        source: 'user.firstName,user.lastName',
        target: 'fullname.textContent',
        transform: 'firstName,lastName => firstName + " " + lastName'
      };

      solver.setupBinding(binding);

      expect(solver.subscriptions.has('user.firstName')).toBe(true);
      expect(solver.subscriptions.has('user.lastName')).toBe(true);
      expect(eventCallbacks.has('user.firstName')).toBe(true);
      expect(eventCallbacks.has('user.lastName')).toBe(true);
    });

    test('should track multiple subscriptions to same property', () => {
      const element1 = document.createElement('span');
      const element2 = document.createElement('div');
      
      solver.registerElement('element1', element1);
      solver.registerElement('element2', element2);

      const binding1 = {
        source: 'user.name',
        target: 'element1.textContent',
        transform: 'identity'
      };

      const binding2 = {
        source: 'user.name',
        target: 'element2.textContent',
        transform: 'name => "Hello " + name'
      };

      solver.setupBinding(binding1);
      solver.setupBinding(binding2);

      expect(solver.subscriptions.get('user.name')).toBeDefined();
      expect(eventCallbacks.get('user.name').length).toBe(2);
    });

    test('should handle nested property subscriptions', () => {
      solver.registerElement('bio', testElement);

      const binding = {
        source: 'user.profile.bio',
        target: 'bio.textContent',
        transform: 'identity'
      };

      solver.setupBinding(binding);

      expect(solver.subscriptions.has('user.profile.bio')).toBe(true);
      expect(eventCallbacks.has('user.profile.bio')).toBe(true);
    });
  });

  describe('Subscription Updates', () => {
    test('should trigger updates when subscribed property changes', () => {
      solver.registerElement('name', testElement);

      const binding = {
        source: 'user.name',
        target: 'name.textContent',
        transform: 'identity'
      };

      solver.setupBinding(binding);
      expect(testElement.textContent).toBe('John Doe');

      // Simulate property change
      testDataStore.user.name = 'Jane Smith';
      const callback = eventCallbacks.get('user.name')[0];
      callback(testDataStore.user.name);

      expect(testElement.textContent).toBe('Jane Smith');
    });

    test('should handle multi-property updates correctly', () => {
      solver.registerElement('fullname', testElement);
      
      testDataStore.user.firstName = 'John';
      testDataStore.user.lastName = 'Smith';
      
      const binding = {
        source: 'user.firstName,user.lastName',
        target: 'fullname.textContent',
        transform: 'firstName,lastName => firstName + " " + lastName'
      };

      solver.setupBinding(binding);
      expect(testElement.textContent).toBe('John Smith');

      // Simulate first name change
      testDataStore.user.firstName = 'Jane';
      const firstNameCallback = eventCallbacks.get('user.firstName')[0];
      firstNameCallback();

      expect(testElement.textContent).toBe('Jane Smith');

      // Simulate last name change
      testDataStore.user.lastName = 'Doe';
      const lastNameCallback = eventCallbacks.get('user.lastName')[0];
      lastNameCallback();

      expect(testElement.textContent).toBe('Jane Doe');
    });

    test('should update multiple elements bound to same property', () => {
      const element1 = document.createElement('span');
      const element2 = document.createElement('div');
      
      solver.registerElement('element1', element1);
      solver.registerElement('element2', element2);

      const binding1 = {
        source: 'user.name',
        target: 'element1.textContent',
        transform: 'identity'
      };

      const binding2 = {
        source: 'user.name',
        target: 'element2.textContent',
        transform: 'name => "Hello " + name'
      };

      solver.setupBinding(binding1);
      solver.setupBinding(binding2);

      expect(element1.textContent).toBe('John Doe');
      expect(element2.textContent).toBe('Hello John Doe');

      // Simulate property change
      testDataStore.user.name = 'Jane Smith';
      const callbacks = eventCallbacks.get('user.name');
      callbacks.forEach(callback => callback(testDataStore.user.name));

      expect(element1.textContent).toBe('Jane Smith');
      expect(element2.textContent).toBe('Hello Jane Smith');
    });
  });

  describe('Subscription Cleanup', () => {
    test('should remove all subscriptions on cleanup', () => {
      solver.registerElement('name', testElement);
      solver.registerElement('age', testElement);

      const binding1 = {
        source: 'user.name',
        target: 'name.textContent',
        transform: 'identity'
      };

      const binding2 = {
        source: 'user.age',
        target: 'age.textContent',
        transform: 'age => "Age: " + age'
      };

      solver.setupBinding(binding1);
      solver.setupBinding(binding2);

      expect(eventCallbacks.get('user.name').length).toBe(1);
      expect(eventCallbacks.get('user.age').length).toBe(1);
      expect(solver.subscriptions.size).toBe(2);

      solver.cleanup();

      expect(eventCallbacks.get('user.name').length).toBe(0);
      expect(eventCallbacks.get('user.age').length).toBe(0);
      expect(solver.subscriptions.size).toBe(0);
    });

    test('should remove multi-property subscriptions on cleanup', () => {
      solver.registerElement('fullname', testElement);
      
      testDataStore.user.firstName = 'John';
      testDataStore.user.lastName = 'Smith';
      
      const binding = {
        source: 'user.firstName,user.lastName',
        target: 'fullname.textContent',
        transform: 'firstName,lastName => firstName + " " + lastName'
      };

      solver.setupBinding(binding);

      expect(eventCallbacks.get('user.firstName').length).toBe(1);
      expect(eventCallbacks.get('user.lastName').length).toBe(1);
      expect(solver.subscriptions.size).toBe(2);

      solver.cleanup();

      expect(eventCallbacks.get('user.firstName').length).toBe(0);
      expect(eventCallbacks.get('user.lastName').length).toBe(0);
      expect(solver.subscriptions.size).toBe(0);
    });

    test('should handle partial cleanup when some properties have multiple subscribers', () => {
      const element1 = document.createElement('span');
      const element2 = document.createElement('div');
      const anotherSolver = new EquationSolver(testDataStore);
      
      solver.registerElement('element1', element1);
      anotherSolver.registerElement('element2', element2);

      const binding1 = {
        source: 'user.name',
        target: 'element1.textContent',
        transform: 'identity'
      };

      const binding2 = {
        source: 'user.name',
        target: 'element2.textContent',
        transform: 'identity'
      };

      solver.setupBinding(binding1);
      anotherSolver.setupBinding(binding2);

      expect(eventCallbacks.get('user.name').length).toBe(2);

      // Cleanup only first solver
      solver.cleanup();

      expect(eventCallbacks.get('user.name').length).toBe(1);
      expect(solver.subscriptions.size).toBe(0);
      expect(anotherSolver.subscriptions.size).toBe(1);

      // Cleanup second solver
      anotherSolver.cleanup();

      expect(eventCallbacks.get('user.name').length).toBe(0);
      expect(anotherSolver.subscriptions.size).toBe(0);
    });
  });

  describe('Memory Management', () => {
    test('should not create memory leaks with repeated setup/cleanup cycles', () => {
      const binding = {
        source: 'user.name',
        target: 'test.textContent',
        transform: 'identity'
      };

      // Perform multiple setup/cleanup cycles
      for (let i = 0; i < 5; i++) {
        solver.registerElement('test', testElement);
        solver.setupBinding(binding);
        expect(solver.subscriptions.size).toBe(1);
        expect(eventCallbacks.get('user.name').length).toBe(1);

        solver.cleanup();
        expect(solver.subscriptions.size).toBe(0);
        expect(eventCallbacks.get('user.name').length).toBe(0);
      }
    });

    test('should handle cleanup of non-existent subscriptions gracefully', () => {
      // Cleanup without any subscriptions should not throw
      expect(() => solver.cleanup()).not.toThrow();
    });

    test('should clear subscription references after cleanup', () => {
      solver.registerElement('name', testElement);

      const binding = {
        source: 'user.name',
        target: 'name.textContent',
        transform: 'identity'
      };

      solver.setupBinding(binding);
      
      const subscriptionsBefore = solver.subscriptions;
      const elementsBefore = solver.elements;
      
      solver.cleanup();
      
      // Verify internal maps are cleared
      expect(solver.subscriptions).toBe(subscriptionsBefore);
      expect(solver.elements).toBe(elementsBefore);
      expect(solver.subscriptions.size).toBe(0);
      expect(solver.elements.size).toBe(0);
    });
  });

  describe('Error Handling', () => {
    test('should handle DataStore without off method gracefully', () => {
      const incompleteDataStore = {
        user: { name: 'Test' },
        on: () => {}
        // Missing off method
      };

      const incompleteSolver = new EquationSolver(incompleteDataStore);
      incompleteSolver.registerElement('test', testElement);

      const binding = {
        source: 'user.name',
        target: 'test.textContent',
        transform: 'identity'
      };

      incompleteSolver.setupBinding(binding);

      // Cleanup should not fail even without off method
      expect(() => incompleteSolver.cleanup()).not.toThrow();
    });

    test('should handle subscription callback errors gracefully', () => {
      solver.registerElement('test', testElement);

      const binding = {
        source: 'user.name',
        target: 'test.textContent',
        transform: 'identity'
      };

      solver.setupBinding(binding);

      // Simulate callback error by corrupting the element
      testElement.textContent = null;
      solver.elements.set('test', null);

      const callback = eventCallbacks.get('user.name')[0];
      
      // Should not throw when callback fails
      expect(() => callback('New Value')).not.toThrow();
    });
  });
});