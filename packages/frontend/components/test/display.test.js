/**
 * @jest-environment jsdom
 */

import { Display } from '../src/components/display/index.js';
import { UmbilicalUtils } from '../src/umbilical/index.js';

describe('Display Component', () => {
  // Mock DOM element helper
  const createMockElement = () => ({
    nodeType: 1, // Node.ELEMENT_NODE
    textContent: '',
    innerHTML: '',
    classList: {
      add: jest.fn(),
      remove: jest.fn()
    },
    style: {}
  });

  describe('Introspection', () => {
    test('should describe requirements when given describe umbilical', () => {
      let capturedRequirements = null;

      Display.create({
        describe: (reqs) => {
          capturedRequirements = reqs.getAll();
        }
      });

      expect(capturedRequirements).toBeDefined();
      expect(capturedRequirements.dom).toBeDefined();
      expect(capturedRequirements.dom.type).toBe('HTMLElement');
      expect(capturedRequirements.format).toBeDefined();
      expect(capturedRequirements.format.type).toBe('function');
    });

    test('should validate umbilical when given validate capability', () => {
      const mockElement = createMockElement();
      
      const validation = Display.create({
        validate: (testResult) => ({
          ...testResult,
          hasDomElement: mockElement && mockElement.nodeType === 1
        })
      });

      expect(validation.hasDomElement).toBe(true);
    });
  });

  describe('Instance Creation', () => {
    test('should create display with minimal umbilical', () => {
      const mockElement = createMockElement();
      
      const display = Display.create({
        dom: mockElement
      });

      expect(display).toBeDefined();
      expect(display.element).toBe(mockElement);
    });

    test('should apply CSS class when provided', () => {
      const mockElement = createMockElement();
      
      Display.create({
        dom: mockElement,
        className: 'test-class'
      });

      expect(mockElement.classList.add).toHaveBeenCalledWith('test-class');
    });

    test('should throw error when dom is missing', () => {
      expect(() => {
        Display.create({});
      }).toThrow('Display missing required capabilities: dom');
    });

    test('should throw error when dom is not an element', () => {
      expect(() => {
        Display.create({
          dom: { nodeType: 3 } // TEXT_NODE
        });
      }).toThrow('Display requires a valid DOM element');
    });
  });

  describe('Display Operations', () => {
    let display;
    let mockElement;
    let renderCalls;

    beforeEach(() => {
      mockElement = createMockElement();
      renderCalls = [];
      
      display = Display.create({
        dom: mockElement,
        onRender: (data, element, content) => {
          renderCalls.push({ data, element, content });
        }
      });
    });

    test('should update with simple data', () => {
      display.update('Hello World');
      
      expect(mockElement.textContent).toBe('Hello World');
      expect(renderCalls).toHaveLength(1);
      expect(renderCalls[0].data).toBe('Hello World');
    });

    test('should format null/undefined as empty string', () => {
      display.update(null);
      expect(mockElement.textContent).toBe('');
      
      display.update(undefined);
      expect(mockElement.textContent).toBe('');
    });

    test('should stringify objects', () => {
      const obj = { name: 'test', value: 42 };
      display.update(obj);
      
      expect(mockElement.textContent).toBe(JSON.stringify(obj, null, 2));
    });

    test('should use custom formatter when provided', () => {
      const display = Display.create({
        dom: mockElement,
        format: (data) => `Formatted: ${data}`
      });

      display.update('test');
      expect(mockElement.textContent).toBe('Formatted: test');
    });

    test('should use custom template when provided', () => {
      const display = Display.create({
        dom: mockElement,
        template: (data) => `<div class="custom">${data}</div>`
      });

      display.update('test');
      expect(mockElement.innerHTML).toBe('<div class="custom">test</div>');
    });

    test('should clear display', () => {
      display.update('some content');
      display.clear();
      
      expect(mockElement.textContent).toBe('');
    });

    test('should provide current data access', () => {
      display.update('test data');
      expect(display.data).toBe('test data');
    });
  });

  describe('Utility Methods', () => {
    let display;
    let mockElement;

    beforeEach(() => {
      mockElement = createMockElement();
      display = Display.create({
        dom: mockElement
      });
    });

    test('should add CSS classes', () => {
      display.addClass('new-class');
      expect(mockElement.classList.add).toHaveBeenCalledWith('new-class');
    });

    test('should remove CSS classes', () => {
      display.removeClass('old-class');
      expect(mockElement.classList.remove).toHaveBeenCalledWith('old-class');
    });

    test('should set inline styles', () => {
      display.setStyle('color', 'red');
      expect(mockElement.style.color).toBe('red');
    });
  });

  describe('Error Handling', () => {
    test('should handle template errors gracefully', () => {
      const mockElement = createMockElement();
      let errorCaptured = null;
      
      const display = Display.create({
        dom: mockElement,
        template: () => {
          throw new Error('Template error');
        },
        onError: (error) => {
          errorCaptured = error;
        }
      });

      display.update('test');
      
      expect(mockElement.textContent).toBe('Display Error: Template error');
      expect(errorCaptured).toBeInstanceOf(Error);
    });
  });

  describe('Lifecycle Management', () => {
    test('should call onMount when provided', () => {
      const mockElement = createMockElement();
      let mountedInstance = null;
      
      const display = Display.create({
        dom: mockElement,
        onMount: (instance) => {
          mountedInstance = instance;
        }
      });

      expect(mountedInstance).toBe(display);
    });

    test('should cleanup on destroy', () => {
      const mockElement = createMockElement();
      let destroyedInstance = null;
      
      const display = Display.create({
        dom: mockElement,
        className: 'test-class',
        onDestroy: (instance) => {
          destroyedInstance = instance;
        }
      });

      display.destroy();
      
      expect(mockElement.classList.remove).toHaveBeenCalledWith('test-class');
      expect(mockElement.textContent).toBe('');
      expect(destroyedInstance).toBe(display);
    });
  });

  describe('Agent Testing Patterns', () => {
    test('should work with completely mocked umbilical', () => {
      const mockElement = createMockElement();
      const mockUmbilical = UmbilicalUtils.createMockUmbilical({
        dom: mockElement,
        onRender: jest.fn()
      });

      const display = Display.create(mockUmbilical);
      display.update('test');
      
      expect(mockUmbilical.onRender).toHaveBeenCalledWith('test', mockElement, 'test');
    });

    test('should allow agent to validate DOM capabilities', () => {
      const mockElement = createMockElement();
      
      // Agent tests different element types
      const validation = Display.create({
        validate: (result) => ({
          ...result,
          canRenderText: true,
          canRenderHTML: true,
          hasStyleAccess: true
        })
      });

      expect(validation.canRenderText).toBe(true);
    });

    test('should enable agent to test different formatters', () => {
      const mockElement = createMockElement();
      const formatters = [
        (data) => `Text: ${data}`,
        (data) => `JSON: ${JSON.stringify(data)}`,
        (data) => `Upper: ${String(data).toUpperCase()}`
      ];

      formatters.forEach((formatter, index) => {
        const display = Display.create({
          dom: createMockElement(),
          format: formatter
        });

        display.update('test');
        expect(display.element.textContent).toContain(index === 0 ? 'Text:' : index === 1 ? 'JSON:' : 'UPPER:');
      });
    });
  });
});