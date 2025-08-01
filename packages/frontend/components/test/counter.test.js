/**
 * @jest-environment jsdom
 */

import { Counter } from '../src/components/counter/index.js';
import { UmbilicalUtils } from '../src/umbilical/index.js';

describe('Counter Component', () => {
  describe('Introspection', () => {
    test('should describe requirements when given describe umbilical', () => {
      const requirements = UmbilicalUtils.createRequirements();
      let capturedRequirements = null;

      Counter.create({
        describe: (reqs) => {
          capturedRequirements = reqs.getAll();
        }
      });

      expect(capturedRequirements).toBeDefined();
      expect(capturedRequirements.onChange).toBeDefined();
      expect(capturedRequirements.onChange.type).toBe('function');
      expect(capturedRequirements.initialValue).toBeDefined();
      expect(capturedRequirements.initialValue.type).toBe('number');
    });

    test('should validate umbilical when given validate capability', () => {
      const validResult = Counter.create({
        validate: (testResult) => testResult
      });

      expect(validResult).toBeDefined();
      expect(typeof validResult.hasOnChange).toBe('boolean');
      expect(typeof validResult.hasValidInitialValue).toBe('boolean');
    });
  });

  describe('Instance Creation', () => {
    test('should create counter with minimal umbilical', () => {
      const changes = [];
      
      const counter = Counter.create({
        onChange: (newValue, oldValue, action) => {
          changes.push({ newValue, oldValue, action });
        }
      });

      expect(counter).toBeDefined();
      expect(counter.value).toBe(0); // default initial value
    });

    test('should create counter with custom initial value', () => {
      const counter = Counter.create({
        initialValue: 10,
        onChange: () => {}
      });

      expect(counter.value).toBe(10);
    });

    test('should throw error when onChange is missing', () => {
      expect(() => {
        Counter.create({});
      }).toThrow('Counter missing required capabilities: onChange');
    });
  });

  describe('Counter Operations', () => {
    let counter;
    let changes;

    beforeEach(() => {
      changes = [];
      counter = Counter.create({
        initialValue: 5,
        onChange: (newValue, oldValue, action) => {
          changes.push({ newValue, oldValue, action });
        }
      });
    });

    test('should increment by 1 by default', () => {
      counter.increment();
      
      expect(counter.value).toBe(6);
      expect(changes).toHaveLength(1);
      expect(changes[0]).toEqual({
        newValue: 6,
        oldValue: 5,
        action: 'increment'
      });
    });

    test('should increment by custom amount', () => {
      counter.increment(3);
      
      expect(counter.value).toBe(8);
      expect(changes[0].newValue).toBe(8);
    });

    test('should decrement by 1 by default', () => {
      counter.decrement();
      
      expect(counter.value).toBe(4);
      expect(changes[0]).toEqual({
        newValue: 4,
        oldValue: 5,
        action: 'decrement'
      });
    });

    test('should decrement by custom amount', () => {
      counter.decrement(2);
      
      expect(counter.value).toBe(3);
      expect(changes[0].newValue).toBe(3);
    });

    test('should reset to initial value', () => {
      counter.increment(5); // value is now 10
      changes.length = 0; // clear changes
      
      counter.reset();
      
      expect(counter.value).toBe(5); // back to initial
      expect(changes[0]).toEqual({
        newValue: 5,
        oldValue: 10,
        action: 'reset'
      });
    });

    test('should reset to custom value', () => {
      counter.reset(20);
      
      expect(counter.value).toBe(20);
      expect(changes[0].action).toBe('reset');
    });

    test('should set value directly', () => {
      counter.setValue(100);
      
      expect(counter.value).toBe(100);
      expect(changes[0]).toEqual({
        newValue: 100,
        oldValue: 5,
        action: 'set'
      });
    });

    test('should throw error when setting non-number value', () => {
      expect(() => {
        counter.setValue('not a number');
      }).toThrow('Counter value must be a number');
    });
  });

  describe('Lifecycle Callbacks', () => {
    test('should call onMount when provided', () => {
      let mountedInstance = null;
      
      const counter = Counter.create({
        onChange: () => {},
        onMount: (instance) => {
          mountedInstance = instance;
        }
      });

      expect(mountedInstance).toBe(counter);
    });

    test('should call onDestroy when destroy is called', () => {
      let destroyedInstance = null;
      
      const counter = Counter.create({
        onChange: () => {},
        onDestroy: (instance) => {
          destroyedInstance = instance;
        }
      });

      counter.destroy();
      expect(destroyedInstance).toBe(counter);
    });

    test('should call specific action callbacks', () => {
      const callbacks = {
        increment: jest.fn(),
        decrement: jest.fn(),
        reset: jest.fn()
      };

      const counter = Counter.create({
        onChange: () => {},
        onIncrement: callbacks.increment,
        onDecrement: callbacks.decrement,
        onReset: callbacks.reset
      });

      counter.increment();
      expect(callbacks.increment).toHaveBeenCalledWith(1, 0);

      counter.decrement();
      expect(callbacks.decrement).toHaveBeenCalledWith(0, 1);

      counter.reset();
      expect(callbacks.reset).toHaveBeenCalledWith(0, 0);
    });
  });

  describe('Agent Testing Patterns', () => {
    test('should work with completely mocked umbilical', () => {
      // This is how an AI agent would test the component
      const mockUmbilical = UmbilicalUtils.createMockUmbilical({
        onChange: jest.fn()
      });

      const counter = Counter.create(mockUmbilical);
      
      counter.increment();
      
      expect(mockUmbilical.onChange).toHaveBeenCalledWith(1, 0, 'increment');
    });

    test('should validate requirements programmatically', () => {
      // Agent discovers requirements
      const requirements = UmbilicalUtils.createRequirements();
      Counter.create({
        describe: (reqs) => {
          Object.entries(reqs.getAll()).forEach(([key, spec]) => {
            requirements.add(key, spec.type, spec.description);
          });
        }
      });

      // Agent validates a potential umbilical
      const testUmbilical = {
        onChange: () => {},
        initialValue: 10
      };

      const validation = Counter.create({
        validate: (result) => {
          return {
            ...result,
            hasOnChange: typeof testUmbilical.onChange === 'function',
            hasValidInitialValue: typeof testUmbilical.initialValue === 'number'
          };
        }
      });

      expect(validation.hasOnChange).toBe(true);
      expect(validation.hasValidInitialValue).toBe(true);
    });
  });
});