/**
 * @jest-environment jsdom
 */

import { Button } from '../src/components/button/index.js';
import { UmbilicalUtils } from '../src/umbilical/index.js';

describe('Button Component', () => {
  // Mock DOM element helper
  const createMockButton = (tagName = 'BUTTON') => ({
    nodeType: 1, // Node.ELEMENT_NODE
    tagName: tagName,
    textContent: '',
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
    _eventHandlers: {}
  });

  describe('Introspection', () => {
    test('should describe requirements when given describe umbilical', () => {
      let capturedRequirements = null;

      Button.create({
        describe: (reqs) => {
          capturedRequirements = reqs.getAll();
        }
      });

      expect(capturedRequirements).toBeDefined();
      expect(capturedRequirements.dom).toBeDefined();
      expect(capturedRequirements.dom.type).toBe('HTMLElement');
      expect(capturedRequirements.onClick).toBeDefined();
      expect(capturedRequirements.onClick.type).toBe('function');
      expect(capturedRequirements.text).toBeDefined();
      expect(capturedRequirements.disabled).toBeDefined();
    });

    test('should validate umbilical when given validate capability', () => {
      const mockElement = createMockButton();
      
      const validation = Button.create({
        validate: (testResult) => ({
          ...testResult,
          hasDomElement: mockElement && mockElement.nodeType === 1,
          hasClickHandler: true
        })
      });

      expect(validation.hasDomElement).toBe(true);
      expect(validation.hasClickHandler).toBe(true);
    });
  });

  describe('Instance Creation', () => {
    test('should create button with minimal umbilical', () => {
      const mockElement = createMockButton();
      const onClick = jest.fn();
      
      const button = Button.create({
        dom: mockElement,
        onClick
      });

      expect(button).toBeDefined();
      expect(button.element).toBe(mockElement);
      expect(button.disabled).toBe(false);
      expect(button.clickCount).toBe(0);
    });

    test('should set initial text when provided', () => {
      const mockElement = createMockButton();
      
      Button.create({
        dom: mockElement,
        onClick: jest.fn(),
        text: 'Click Me'
      });

      expect(mockElement.textContent).toBe('Click Me');
    });

    test('should apply CSS class when provided', () => {
      const mockElement = createMockButton();
      
      Button.create({
        dom: mockElement,
        onClick: jest.fn(),
        className: 'custom-btn'
      });

      expect(mockElement.classList.add).toHaveBeenCalledWith('custom-btn');
    });

    test('should start disabled when specified', () => {
      const mockElement = createMockButton();
      
      const button = Button.create({
        dom: mockElement,
        onClick: jest.fn(),
        disabled: true
      });

      expect(button.disabled).toBe(true);
      expect(mockElement.setAttribute).toHaveBeenCalledWith('disabled', 'true');
      expect(mockElement.setAttribute).toHaveBeenCalledWith('aria-disabled', 'true');
    });

    test('should make non-button elements accessible', () => {
      const mockElement = createMockButton('DIV');
      
      Button.create({
        dom: mockElement,
        onClick: jest.fn()
      });

      expect(mockElement.setAttribute).toHaveBeenCalledWith('role', 'button');
      expect(mockElement.setAttribute).toHaveBeenCalledWith('tabindex', '0');
    });

    test('should throw error when dom is missing', () => {
      expect(() => {
        Button.create({
          onClick: jest.fn()
        });
      }).toThrow('Button missing required capabilities: dom, onClick');
    });

    test('should throw error when onClick is missing', () => {
      expect(() => {
        Button.create({
          dom: createMockButton()
        });
      }).toThrow('Button missing required capabilities: onClick');
    });
  });

  describe('Button Interactions', () => {
    let button;
    let mockElement;
    let onClick;
    let clickHandler;

    beforeEach(() => {
      mockElement = createMockButton();
      onClick = jest.fn();
      
      // Capture the actual click handler
      mockElement.addEventListener.mockImplementation((event, handler) => {
        if (event === 'click') {
          clickHandler = handler;
        }
      });

      button = Button.create({
        dom: mockElement,
        onClick
      });
    });

    test('should handle click events', () => {
      const mockEvent = { preventDefault: jest.fn() };
      
      clickHandler(mockEvent);
      
      expect(onClick).toHaveBeenCalledWith(mockEvent, button, 1);
      expect(button.clickCount).toBe(1);
    });

    test('should increment click count', () => {
      const mockEvent = { preventDefault: jest.fn() };
      
      clickHandler(mockEvent);
      clickHandler(mockEvent);
      
      expect(button.clickCount).toBe(2);
      expect(onClick).toHaveBeenCalledTimes(2);
    });

    test('should not fire onClick when disabled', () => {
      button.disable();
      const mockEvent = { preventDefault: jest.fn() };
      
      clickHandler(mockEvent);
      
      expect(mockEvent.preventDefault).toHaveBeenCalled();
      expect(onClick).not.toHaveBeenCalled();
    });

    test('should handle keyboard events (Enter)', () => {
      let keyHandler;
      mockElement.addEventListener.mockImplementation((event, handler) => {
        if (event === 'keydown') {
          keyHandler = handler;
        }
      });

      // Re-create button to capture keydown handler
      Button.create({
        dom: mockElement,
        onClick
      });

      const enterEvent = { key: 'Enter', preventDefault: jest.fn() };
      keyHandler(enterEvent);
      
      expect(enterEvent.preventDefault).toHaveBeenCalled();
      expect(onClick).toHaveBeenCalled();
    });

    test('should handle keyboard events (Space)', () => {
      let keyHandler;
      mockElement.addEventListener.mockImplementation((event, handler) => {
        if (event === 'keydown') {
          keyHandler = handler;
        }
      });

      Button.create({
        dom: mockElement,
        onClick
      });

      const spaceEvent = { key: ' ', preventDefault: jest.fn() };
      keyHandler(spaceEvent);
      
      expect(spaceEvent.preventDefault).toHaveBeenCalled();
      expect(onClick).toHaveBeenCalled();
    });
  });

  describe('Button State Management', () => {
    let button;
    let mockElement;
    let stateChanges;

    beforeEach(() => {
      mockElement = createMockButton();
      stateChanges = [];
      
      button = Button.create({
        dom: mockElement,
        onClick: jest.fn(),
        onStateChange: (state, reason, instance) => {
          stateChanges.push({ state, reason, instance });
        }
      });
    });

    test('should enable button', () => {
      button.disable();
      button.enable();
      
      expect(button.disabled).toBe(false);
      expect(mockElement.removeAttribute).toHaveBeenCalledWith('disabled');
      expect(mockElement.removeAttribute).toHaveBeenCalledWith('aria-disabled');
      expect(stateChanges.some(change => change.reason === 'disabled-change')).toBe(true);
    });

    test('should disable button', () => {
      button.disable();
      
      expect(button.disabled).toBe(true);
      expect(mockElement.setAttribute).toHaveBeenCalledWith('disabled', 'true');
      expect(mockElement.setAttribute).toHaveBeenCalledWith('aria-disabled', 'true');
      expect(stateChanges.some(change => change.reason === 'disabled-change')).toBe(true);
    });

    test('should update button text', () => {
      button.setText('New Text');
      
      expect(mockElement.textContent).toBe('New Text');
      expect(stateChanges.some(change => change.reason === 'text-change')).toBe(true);
    });

    test('should add/remove CSS classes', () => {
      button.addClass('active');
      expect(mockElement.classList.add).toHaveBeenCalledWith('active');

      button.removeClass('active');
      expect(mockElement.classList.remove).toHaveBeenCalledWith('active');
    });

    test('should programmatically trigger click', () => {
      button.click();
      expect(mockElement.click).toHaveBeenCalled();
    });

    test('should not programmatically click when disabled', () => {
      button.disable();
      button.click();
      expect(mockElement.click).not.toHaveBeenCalled();
    });

    test('should manage focus', () => {
      button.focus();
      expect(mockElement.focus).toHaveBeenCalled();

      button.blur();
      expect(mockElement.blur).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    test('should handle onClick errors gracefully', () => {
      const mockElement = createMockButton();
      let errorCaptured = null;
      let clickHandler;

      mockElement.addEventListener.mockImplementation((event, handler) => {
        if (event === 'click') {
          clickHandler = handler;
        }
      });

      Button.create({
        dom: mockElement,
        onClick: () => {
          throw new Error('Click handler error');
        },
        onError: (error) => {
          errorCaptured = error;
        }
      });

      clickHandler({ preventDefault: jest.fn() });
      
      expect(errorCaptured).toBeInstanceOf(Error);
      expect(errorCaptured.message).toBe('Click handler error');
    });
  });

  describe('Lifecycle Management', () => {
    test('should call onMount when provided', () => {
      const mockElement = createMockButton();
      let mountedInstance = null;
      
      const button = Button.create({
        dom: mockElement,
        onClick: jest.fn(),
        onMount: (instance) => {
          mountedInstance = instance;
        }
      });

      expect(mountedInstance).toBe(button);
    });

    test('should cleanup on destroy', () => {
      const mockElement = createMockButton();
      let destroyedInstance = null;
      
      const button = Button.create({
        dom: mockElement,
        onClick: jest.fn(),
        className: 'test-btn',
        onDestroy: (instance) => {
          destroyedInstance = instance;
        }
      });

      button.destroy();
      
      expect(mockElement.removeEventListener).toHaveBeenCalledTimes(2); // click + keydown
      expect(mockElement.classList.remove).toHaveBeenCalledWith('test-btn');
      expect(destroyedInstance).toBe(button);
    });
  });

  describe('Agent Testing Patterns', () => {
    test('should work with completely mocked umbilical', () => {
      const mockElement = createMockButton();
      const mockUmbilical = UmbilicalUtils.createMockUmbilical({
        dom: mockElement,
        onClick: jest.fn(),
        onStateChange: jest.fn()
      });

      const button = Button.create(mockUmbilical);
      button.setText('Test');
      
      expect(mockUmbilical.onStateChange).toHaveBeenCalledWith(
        { text: 'Test' },
        'text-change',
        button
      );
    });

    test('should allow agent to test different element types', () => {
      const elementTypes = ['BUTTON', 'DIV', 'SPAN', 'A'];
      
      elementTypes.forEach(tagName => {
        const element = createMockButton(tagName);
        const button = Button.create({
          dom: element,
          onClick: jest.fn()
        });

        expect(button.element.tagName).toBe(tagName);
        
        // Non-button elements should get accessibility attributes
        if (tagName !== 'BUTTON') {
          expect(element.setAttribute).toHaveBeenCalledWith('role', 'button');
          expect(element.setAttribute).toHaveBeenCalledWith('tabindex', '0');
        }
      });
    });

    test('should enable agent to test different click scenarios', () => {
      const scenarios = [
        { disabled: false, shouldFire: true },
        { disabled: true, shouldFire: false }
      ];

      scenarios.forEach(({ disabled, shouldFire }) => {
        const mockElement = createMockButton();
        const onClick = jest.fn();
        let clickHandler;

        mockElement.addEventListener.mockImplementation((event, handler) => {
          if (event === 'click') {
            clickHandler = handler;
          }
        });

        const button = Button.create({
          dom: mockElement,
          onClick,
          disabled
        });

        clickHandler({ preventDefault: jest.fn() });
        
        if (shouldFire) {
          expect(onClick).toHaveBeenCalled();
        } else {
          expect(onClick).not.toHaveBeenCalled();
        }
      });
    });
  });
});