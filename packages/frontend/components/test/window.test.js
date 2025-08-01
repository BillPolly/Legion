/**
 * @jest-environment jsdom
 */

import { Window } from '../src/components/window/index.js';
import { UmbilicalUtils } from '../src/umbilical/index.js';

describe('Window Component', () => {
  // Mock DOM helper
  const createMockContainer = () => {
    const container = document.createElement('div');
    container.style.width = '800px';
    container.style.height = '600px';
    container.style.position = 'relative';
    document.body.appendChild(container);
    return container;
  };

  afterEach(() => {
    document.body.innerHTML = '';
    Window.nextZIndex = 1000; // Reset z-index counter
  });

  describe('Introspection', () => {
    test('should describe requirements when given describe umbilical', () => {
      let capturedRequirements = null;

      Window.create({
        describe: (reqs) => {
          capturedRequirements = reqs.getAll();
        }
      });

      expect(capturedRequirements).toBeDefined();
      expect(capturedRequirements.dom).toBeDefined();
      expect(capturedRequirements.dom.type).toBe('HTMLElement');
      expect(capturedRequirements.title).toBeDefined();
      expect(capturedRequirements.width).toBeDefined();
      expect(capturedRequirements.height).toBeDefined();
      expect(capturedRequirements.theme).toBeDefined();
      expect(capturedRequirements.draggable).toBeDefined();
      expect(capturedRequirements.resizable).toBeDefined();
    });

    test('should validate umbilical when given validate capability', () => {
      const container = createMockContainer();
      
      const validation = Window.create({
        validate: (testResult) => ({
          ...testResult,
          hasDomElement: true,
          hasValidTheme: true,
          hasValidPosition: true
        })
      });

      expect(validation.hasDomElement).toBe(true);
      expect(validation.hasValidTheme).toBe(true);
      expect(validation.hasValidPosition).toBe(true);
    });
  });

  describe('Instance Creation', () => {
    test('should create window with minimal umbilical', () => {
      const container = createMockContainer();
      
      const window = Window.create({
        dom: container
      });

      expect(window).toBeDefined();
      expect(window.window).toBeDefined();
      expect(window.contentElement).toBeDefined();
      expect(window.titleElement).toBeDefined();
      expect(window.titleElement.textContent).toBe('Window');
    });

    test('should create window with custom options', () => {
      const container = createMockContainer();
      
      const window = Window.create({
        dom: container,
        title: 'Test Window',
        width: 600,
        height: 400,
        position: { x: 50, y: 100 },
        theme: 'dark'
      });

      expect(window.titleElement.textContent).toBe('Test Window');
      expect(window.window.style.width).toBe('600px');
      expect(window.window.style.height).toBe('400px');
      expect(window.window.style.left).toBe('50px');
      expect(window.window.style.top).toBe('100px');
    });

    test('should throw error when dom is missing', () => {
      expect(() => {
        Window.create({});
      }).toThrow('Window missing required capabilities: dom');
    });

    test('should increment z-index for each new window', () => {
      const container = createMockContainer();
      
      const window1 = Window.create({ dom: container });
      const z1 = parseInt(window1.window.style.zIndex);
      
      const window2 = Window.create({ dom: container });
      const z2 = parseInt(window2.window.style.zIndex);
      
      expect(z2).toBeGreaterThan(z1);
    });
  });

  describe('Content Management', () => {
    let window;
    let container;

    beforeEach(() => {
      container = createMockContainer();
      window = Window.create({ dom: container });
    });

    test('should set content', () => {
      window.setContent('<h1>Hello World</h1>');
      expect(window.contentElement.innerHTML).toBe('<h1>Hello World</h1>');
    });

    test('should append content', () => {
      window.setContent('<p>First</p>');
      window.appendContent('<p>Second</p>');
      expect(window.contentElement.innerHTML).toBe('<p>First</p><p>Second</p>');
    });

    test('should append element', () => {
      const div = document.createElement('div');
      div.textContent = 'Test Element';
      
      window.appendElement(div);
      expect(window.contentElement.contains(div)).toBe(true);
    });

    test('should clear content', () => {
      window.setContent('<p>Some content</p>');
      window.clearContent();
      expect(window.contentElement.innerHTML).toBe('');
    });
  });

  describe('Window Controls', () => {
    let window;
    let container;
    let callbacks;

    beforeEach(() => {
      container = createMockContainer();
      callbacks = {
        onClose: jest.fn(),
        onMinimize: jest.fn(),
        onMaximize: jest.fn(),
        onResize: jest.fn(),
        onFocus: jest.fn()
      };
      
      window = Window.create({
        dom: container,
        ...callbacks
      });
    });

    test('should show and hide window', () => {
      window.close();
      expect(window.isVisible).toBe(false);
      expect(callbacks.onClose).toHaveBeenCalledWith(window);

      window.show();
      expect(window.isVisible).toBe(true);
    });

    test('should minimize and restore window', () => {
      const initialHeight = window.window.style.height;
      
      window.minimize();
      expect(window.isMinimized).toBe(true);
      expect(window.contentElement.style.display).toBe('none');
      expect(callbacks.onMinimize).toHaveBeenCalledWith(true, window);

      window.minimize(); // Restore
      expect(window.isMinimized).toBe(false);
      expect(window.contentElement.style.display).toBe('block');
      expect(window.window.style.height).toBe(initialHeight);
      expect(callbacks.onMinimize).toHaveBeenCalledWith(false, window);
    });

    test('should maximize and restore window', () => {
      const initialDimensions = {
        width: window.window.style.width,
        height: window.window.style.height,
        left: window.window.style.left,
        top: window.window.style.top
      };

      window.maximize();
      expect(window.isMaximized).toBe(true);
      expect(callbacks.onMaximize).toHaveBeenCalledWith(true, window);

      // Should be larger than initial
      expect(parseInt(window.window.style.width)).toBeGreaterThan(parseInt(initialDimensions.width));

      window.maximize(); // Restore
      expect(window.isMaximized).toBe(false);
      expect(window.window.style.width).toBe(initialDimensions.width);
      expect(callbacks.onMaximize).toHaveBeenCalledWith(false, window);
    });
  });

  describe('Window Properties', () => {
    let window;
    let container;

    beforeEach(() => {
      container = createMockContainer();
      window = Window.create({ dom: container });
    });

    test('should update title', () => {
      window.setTitle('New Title');
      expect(window.titleElement.textContent).toBe('New Title');
    });

    test('should change theme', () => {
      window.setTheme('dark');
      expect(window.window.style.backgroundColor).toBe('#2a2a2a');
      
      window.setTheme('light');
      expect(window.window.style.backgroundColor).toBe('#ffffff');
    });

    test('should throw error for invalid theme', () => {
      expect(() => {
        window.setTheme('invalid');
      }).toThrow('Theme must be either "light" or "dark"');
    });
  });

  describe('Focus Management', () => {
    test('should bring window to front', () => {
      const container = createMockContainer();
      
      const window1 = Window.create({ dom: container });
      const window2 = Window.create({ dom: container });
      
      const z1Before = parseInt(window1.window.style.zIndex);
      const z2Before = parseInt(window2.window.style.zIndex);
      
      expect(z2Before).toBeGreaterThan(z1Before); // window2 is on top
      
      window1.bringToFront();
      
      const z1After = parseInt(window1.window.style.zIndex);
      const z2After = parseInt(window2.window.style.zIndex);
      
      expect(z1After).toBeGreaterThan(z2After); // window1 is now on top
    });

    test('should call onFocus when brought to front', () => {
      const container = createMockContainer();
      const onFocus = jest.fn();
      
      const window = Window.create({
        dom: container,
        onFocus
      });

      window.bringToFront();
      expect(onFocus).toHaveBeenCalledWith(window);
    });
  });

  describe('Event Handling', () => {
    test('should add and remove event listeners', () => {
      const container = createMockContainer();
      const window = Window.create({ dom: container });
      
      const handler = jest.fn();
      window.addEventListener('click', handler);
      
      // Simulate click
      const event = new MouseEvent('click');
      window.window.dispatchEvent(event);
      
      expect(handler).toHaveBeenCalled();
      
      window.removeEventListener('click', handler);
      handler.mockClear();
      
      window.window.dispatchEvent(event);
      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe('Lifecycle Management', () => {
    test('should call onMount when created', () => {
      const container = createMockContainer();
      const onMount = jest.fn();
      
      const window = Window.create({
        dom: container,
        onMount
      });

      expect(onMount).toHaveBeenCalledWith(window);
    });

    test('should cleanup on destroy', () => {
      const container = createMockContainer();
      const onDestroy = jest.fn();
      
      const window = Window.create({
        dom: container,
        onDestroy
      });

      expect(container.contains(window.window)).toBe(true);
      
      window.destroy();
      
      expect(container.contains(window.window)).toBe(false);
      expect(onDestroy).toHaveBeenCalledWith(window);
    });
  });

  describe('Agent Testing Patterns', () => {
    test('should work with completely mocked umbilical', () => {
      const container = createMockContainer();
      const mockUmbilical = UmbilicalUtils.createMockUmbilical({
        dom: container,
        title: 'Agent Window',
        onClose: jest.fn(),
        onFocus: jest.fn()
      });

      const window = Window.create(mockUmbilical);
      
      window.close();
      expect(mockUmbilical.onClose).toHaveBeenCalledWith(window);
      
      window.show();
      window.bringToFront();
      expect(mockUmbilical.onFocus).toHaveBeenCalledWith(window);
    });

    test('should allow agent to test different themes', () => {
      const container = createMockContainer();
      const themes = ['light', 'dark'];
      
      themes.forEach(theme => {
        const window = Window.create({
          dom: container,
          theme
        });

        if (theme === 'dark') {
          expect(window.window.style.backgroundColor).toBe('#2a2a2a');
        } else {
          expect(window.window.style.backgroundColor).toBe('#ffffff');
        }
      });
    });

    test('should enable agent to compose with other components', () => {
      const container = createMockContainer();
      const window = Window.create({ dom: container });
      
      // Agent could add any component to the window content
      const button = document.createElement('button');
      button.textContent = 'Agent Button';
      window.appendElement(button);
      
      expect(window.contentElement.contains(button)).toBe(true);
    });
  });
});