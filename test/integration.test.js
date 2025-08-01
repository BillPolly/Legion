/**
 * @jest-environment jsdom
 */

import { Counter } from '../src/components/counter/index.js';
import { Display } from '../src/components/display/index.js';
import { Button } from '../src/components/button/index.js';
import { UmbilicalUtils } from '../src/umbilical/index.js';

describe('Component Integration Tests', () => {
  // Helper to create mock DOM elements
  const createMockElement = (tagName = 'DIV') => ({
    nodeType: 1,
    tagName,
    textContent: '',
    innerHTML: '',
    classList: {
      add: jest.fn(),
      remove: jest.fn()
    },
    setAttribute: jest.fn(),
    removeAttribute: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    focus: jest.fn(),
    blur: jest.fn(),
    click: jest.fn(),
    style: {}
  });

  describe('Counter + Display Integration', () => {
    test('should connect counter state to display updates', () => {
      const displayElement = createMockElement();
      let displayInstance;
      let counterInstance;

      // Create display first
      displayInstance = Display.create({
        dom: displayElement,
        format: (value) => `Count: ${value}`
      });

      // Create counter that updates display
      counterInstance = Counter.create({
        initialValue: 5,
        onChange: (newValue) => {
          displayInstance.update(newValue);
        }
      });

      // Test the connection
      counterInstance.increment();
      expect(displayElement.textContent).toBe('Count: 6');

      counterInstance.decrement(2);
      expect(displayElement.textContent).toBe('Count: 4');

      counterInstance.reset();
      expect(displayElement.textContent).toBe('Count: 5');
    });

    test('should handle different display formats', () => {
      const displayElement = createMockElement();
      const formats = [
        (value) => `Value: ${value}`,
        (value) => `${value} items`,
        (value) => value < 0 ? 'Negative!' : String(value)
      ];

      formats.forEach((format, index) => {
        const display = Display.create({
          dom: createMockElement(),
          format
        });

        const counter = Counter.create({
          initialValue: index - 1, // -1, 0, 1
          onChange: (value) => display.update(value)
        });

        counter.increment();
        
        if (index === 0) {
          expect(display.element.textContent).toBe('Value: 0');
        } else if (index === 1) {
          expect(display.element.textContent).toBe('1 items');
        } else {
          expect(display.element.textContent).toBe('2');
        }
      });
    });
  });

  describe('Button + Counter Integration', () => {
    test('should connect button clicks to counter operations', () => {
      const buttonElement = createMockElement('BUTTON');
      let clickHandler;
      let counterInstance;
      let buttonInstance;

      // Capture click handler
      buttonElement.addEventListener.mockImplementation((event, handler) => {
        if (event === 'click') {
          clickHandler = handler;
        }
      });

      // Create counter
      const changes = [];
      counterInstance = Counter.create({
        initialValue: 0,
        onChange: (newValue, oldValue, action) => {
          changes.push({ newValue, oldValue, action });
        }
      });

      // Create button that controls counter
      buttonInstance = Button.create({
        dom: buttonElement,
        text: 'Increment',
        onClick: () => {
          counterInstance.increment();
        }
      });

      // Test the connection
      expect(counterInstance.value).toBe(0);
      
      clickHandler({ preventDefault: jest.fn() });
      expect(counterInstance.value).toBe(1);
      expect(changes[0]).toEqual({
        newValue: 1,
        oldValue: 0,
        action: 'increment'
      });

      clickHandler({ preventDefault: jest.fn() });
      expect(counterInstance.value).toBe(2);
    });

    test('should handle multiple buttons with same counter', () => {
      const incrementBtn = createMockElement('BUTTON');
      const decrementBtn = createMockElement('BUTTON');
      const resetBtn = createMockElement('BUTTON');
      
      let incrementHandler, decrementHandler, resetHandler;

      // Setup event handlers
      incrementBtn.addEventListener.mockImplementation((event, handler) => {
        if (event === 'click') incrementHandler = handler;
      });
      decrementBtn.addEventListener.mockImplementation((event, handler) => {
        if (event === 'click') decrementHandler = handler;
      });
      resetBtn.addEventListener.mockImplementation((event, handler) => {
        if (event === 'click') resetHandler = handler;
      });

      // Create shared counter
      const counter = Counter.create({
        initialValue: 10,
        onChange: () => {} // Just tracking value
      });

      // Create buttons
      Button.create({
        dom: incrementBtn,
        onClick: () => counter.increment()
      });

      Button.create({
        dom: decrementBtn,
        onClick: () => counter.decrement()
      });

      Button.create({
        dom: resetBtn,
        onClick: () => counter.reset()
      });

      // Test multiple button interactions
      expect(counter.value).toBe(10);
      
      incrementHandler({ preventDefault: jest.fn() });
      expect(counter.value).toBe(11);
      
      decrementHandler({ preventDefault: jest.fn() });
      expect(counter.value).toBe(10);
      
      resetHandler({ preventDefault: jest.fn() });
      expect(counter.value).toBe(10); // back to initial
    });
  });

  describe('Full Application Integration', () => {
    test('should create complete counter app with all components', () => {
      // Mock DOM elements
      const displayElement = createMockElement();
      const incrementElement = createMockElement('BUTTON');
      const decrementElement = createMockElement('BUTTON');
      const resetElement = createMockElement('BUTTON');

      // Capture event handlers
      const handlers = {};
      [incrementElement, decrementElement, resetElement].forEach((element, index) => {
        const names = ['increment', 'decrement', 'reset'];
        element.addEventListener.mockImplementation((event, handler) => {
          if (event === 'click') {
            handlers[names[index]] = handler;
          }
        });
      });

      // Track all state changes
      const stateLog = [];
      
      // Create display
      const display = Display.create({
        dom: displayElement,
        format: (value) => `Current: ${value}`,
        onRender: (data) => {
          stateLog.push(`Display rendered: ${data}`);
        }
      });

      // Create counter
      const counter = Counter.create({
        initialValue: 0,
        onChange: (newValue, oldValue, action) => {
          stateLog.push(`Counter ${action}: ${oldValue} → ${newValue}`);
          display.update(newValue);
        }
      });

      // Create buttons
      const incrementBtn = Button.create({
        dom: incrementElement,
        text: '+1',
        onClick: (event, buttonInstance, clickCount) => {
          stateLog.push(`Increment clicked (${clickCount} times)`);
          counter.increment();
        }
      });

      const decrementBtn = Button.create({
        dom: decrementElement,
        text: '-1',
        onClick: () => {
          counter.decrement();
        }
      });

      const resetBtn = Button.create({
        dom: resetElement,
        text: 'Reset',
        onClick: () => {
          counter.reset();
        }
      });

      // Test complete application flow
      
      // Initial state
      display.update(counter.value);
      expect(displayElement.textContent).toBe('Current: 0');

      // Increment twice
      handlers.increment({ preventDefault: jest.fn() });
      handlers.increment({ preventDefault: jest.fn() });
      expect(counter.value).toBe(2);
      expect(displayElement.textContent).toBe('Current: 2');

      // Decrement once
      handlers.decrement({ preventDefault: jest.fn() });
      expect(counter.value).toBe(1);
      expect(displayElement.textContent).toBe('Current: 1');

      // Reset
      handlers.reset({ preventDefault: jest.fn() });
      expect(counter.value).toBe(0);
      expect(displayElement.textContent).toBe('Current: 0');

      // Verify state logging
      expect(stateLog.length).toBeGreaterThan(0);
      expect(stateLog.some(log => log.includes('increment'))).toBe(true);
      expect(stateLog.some(log => log.includes('decrement'))).toBe(true);
      expect(stateLog.some(log => log.includes('reset'))).toBe(true);
    });

    test('should handle component lifecycle in full app', () => {
      const lifecycleLog = [];
      const elements = {
        display: createMockElement(),
        button: createMockElement('BUTTON')
      };

      elements.button.addEventListener.mockImplementation(() => {});

      // Create components with lifecycle tracking
      const display = Display.create({
        dom: elements.display,
        onMount: (instance) => {
          lifecycleLog.push('Display mounted');
        },
        onDestroy: (instance) => {
          lifecycleLog.push('Display destroyed');
        }
      });

      const counter = Counter.create({
        onChange: (value) => display.update(value),
        onMount: (instance) => {
          lifecycleLog.push('Counter mounted');
        },
        onDestroy: (instance) => {
          lifecycleLog.push('Counter destroyed');
        }
      });

      const button = Button.create({
        dom: elements.button,
        onClick: () => counter.increment(),
        onMount: (instance) => {
          lifecycleLog.push('Button mounted');
        },
        onDestroy: (instance) => {
          lifecycleLog.push('Button destroyed');
        }
      });

      // Verify mounting
      expect(lifecycleLog).toContain('Display mounted');
      expect(lifecycleLog).toContain('Counter mounted');
      expect(lifecycleLog).toContain('Button mounted');

      // Test destruction
      display.destroy();
      counter.destroy();
      button.destroy();

      expect(lifecycleLog).toContain('Display destroyed');
      expect(lifecycleLog).toContain('Counter destroyed');
      expect(lifecycleLog).toContain('Button destroyed');
    });
  });

  describe('Agent Composition Workflows', () => {
    test('should simulate agent discovering and composing components', () => {
      // Phase 1: Agent discovers all component requirements
      const discoveries = {};
      
      [Counter, Display, Button].forEach((Component, index) => {
        const names = ['Counter', 'Display', 'Button'];
        const requirements = UmbilicalUtils.createRequirements();
        
        Component.create({
          describe: (reqs) => {
            Object.entries(reqs.getAll()).forEach(([key, spec]) => {
              requirements.add(key, spec.type, spec.description);
            });
          }
        });
        
        discoveries[names[index]] = requirements.getAll();
      });

      // Agent should have discovered all requirements
      expect(discoveries.Counter.onChange).toBeDefined();
      expect(discoveries.Display.dom).toBeDefined();
      expect(discoveries.Button.onClick).toBeDefined();

      // Phase 2: Agent generates umbilicals based on discovery
      const mockElements = {
        display: createMockElement(),
        button: createMockElement('BUTTON')
      };

      mockElements.button.addEventListener.mockImplementation(() => {});

      // Agent creates instances with generated umbilicals
      const instances = {};

      instances.display = Display.create(
        UmbilicalUtils.createMockUmbilical({
          dom: mockElements.display,
          format: (value) => `Agent Display: ${value}`
        })
      );

      instances.counter = Counter.create(
        UmbilicalUtils.createMockUmbilical({
          initialValue: 100,
          onChange: (value) => {
            instances.display.update(value);
          }
        })
      );

      instances.button = Button.create(
        UmbilicalUtils.createMockUmbilical({
          dom: mockElements.button,
          onClick: () => {
            instances.counter.increment(10);
          }
        })
      );

      // Phase 3: Agent tests the composition
      instances.counter.increment();
      expect(instances.counter.value).toBe(101);
      expect(mockElements.display.textContent).toBe('Agent Display: 101');

      // Phase 4: Agent validates the system works end-to-end
      expect(instances.display.element).toBe(mockElements.display);
      expect(instances.button.element).toBe(mockElements.button);
      expect(instances.counter.value).toBe(101);
    });

    test('should demonstrate agent testing different compositions', () => {
      // Agent tests multiple composition patterns
      const compositions = [
        {
          name: 'Simple Counter',
          counter: { initialValue: 0, step: 1 },
          display: { format: (v) => String(v) }
        },
        {
          name: 'Step Counter',
          counter: { initialValue: 10, step: 5 },
          display: { format: (v) => `Steps: ${v}` }
        },
        {
          name: 'Percentage Counter',
          counter: { initialValue: 50, step: 10 },
          display: { format: (v) => `${v}%` }
        }
      ];

      compositions.forEach(({ name, counter: counterConfig, display: displayConfig }) => {
        const displayElement = createMockElement();
        
        const display = Display.create({
          dom: displayElement,
          format: displayConfig.format
        });

        const counter = Counter.create({
          initialValue: counterConfig.initialValue,
          onChange: (value) => display.update(value)
        });

        // Agent tests each composition
        counter.increment(counterConfig.step);
        
        const expectedValue = counterConfig.initialValue + counterConfig.step;
        expect(counter.value).toBe(expectedValue);
        expect(displayElement.textContent).toBe(displayConfig.format(expectedValue));
      });
    });
  });
});