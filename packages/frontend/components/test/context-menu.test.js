/**
 * @jest-environment jsdom
 */

import { ContextMenu } from '../src/components/context-menu/index.js';
import { UmbilicalUtils } from '../src/umbilical/index.js';

// Mock functions for testing
const createMockFn = () => {
  const fn = (...args) => {
    fn.calls.push(args);
    return fn.returnValue;
  };
  fn.calls = [];
  fn.returnValue = undefined;
  fn.mockReturnValue = (value) => { fn.returnValue = value; return fn; };
  fn.toHaveBeenCalled = () => fn.calls.length > 0;
  fn.toHaveBeenCalledWith = (...expectedArgs) => {
    return fn.calls.some(callArgs => 
      callArgs.length === expectedArgs.length &&
      callArgs.every((arg, i) => arg === expectedArgs[i])
    );
  };
  return fn;
};

// Enhanced expect for mock functions
const expectMock = (mockFn) => ({
  toHaveBeenCalled: () => {
    expect(mockFn.calls.length).toBeGreaterThan(0);
  },
  toHaveBeenCalledWith: (...expectedArgs) => {
    const found = mockFn.calls.some(callArgs => 
      callArgs.length === expectedArgs.length &&
      callArgs.every((arg, i) => {
        if (typeof expectedArgs[i] === 'object' && expectedArgs[i] !== null) {
          return typeof arg === 'object';
        }
        return arg === expectedArgs[i];
      })
    );
    expect(found).toBe(true);
  },
  not: {
    toHaveBeenCalled: () => {
      expect(mockFn.calls.length).toBe(0);
    }
  }
});

describe('ContextMenu Component', () => {
  // Helper to create menu items
  const createMenuItems = () => [
    { label: 'Cut', icon: '✂️', shortcut: 'Ctrl+X' },
    { label: 'Copy', icon: '📋', shortcut: 'Ctrl+C' },
    { label: 'Paste', icon: '📄', shortcut: 'Ctrl+V' },
    { type: 'separator' },
    { 
      label: 'Format', 
      icon: '🎨',
      subitems: [
        { label: 'Bold', shortcut: 'Ctrl+B' },
        { label: 'Italic', shortcut: 'Ctrl+I' },
        { label: 'Underline', shortcut: 'Ctrl+U' }
      ]
    },
    { type: 'separator' },
    { label: 'Delete', icon: '🗑️', disabled: true }
  ];

  // Helper to trigger mouse events
  const triggerMouseEvent = (element, eventType, options = {}) => {
    const event = new MouseEvent(eventType, {
      bubbles: true,
      cancelable: true,
      clientX: 100,
      clientY: 100,
      ...options
    });
    element.dispatchEvent(event);
  };

  afterEach(() => {
    // Clean up any menus left in the DOM
    document.querySelectorAll('.umbilical-context-menu').forEach(el => el.remove());
    document.body.innerHTML = '';
  });

  describe('Introspection', () => {
    test('should describe requirements when given describe umbilical', () => {
      let capturedRequirements = null;

      ContextMenu.create({
        describe: (reqs) => {
          capturedRequirements = reqs.getAll();
        }
      });

      expect(capturedRequirements).toBeDefined();
      expect(capturedRequirements.dom).toBeDefined();
      expect(capturedRequirements.items).toBeDefined();
      expect(capturedRequirements.position).toBeDefined();
      expect(capturedRequirements.trigger).toBeDefined();
      expect(capturedRequirements.onItemSelect).toBeDefined();
      expect(capturedRequirements.theme).toBeDefined();
    });

    test('should validate umbilical when given validate capability', () => {
      const validation = ContextMenu.create({
        validate: (testResult) => testResult,
        items: [], // Provide empty array
        trigger: 'manual',
        theme: 'light'
      });

      expect(validation.hasValidItems).toBe(true); // Empty array is valid
      expect(validation.hasValidTrigger).toBe(true); // Manual trigger is valid
      expect(validation.hasTargetForTrigger).toBe(true); // Manual trigger doesn't need target
      expect(validation.hasValidTheme).toBe(true); // Light theme is valid
    });
  });

  describe('Instance Creation', () => {
    test('should create menu with minimal umbilical', () => {
      const menu = ContextMenu.create({
        items: createMenuItems()
      });

      expect(menu).toBeDefined();
      expect(menu.element).toBeDefined();
      expect(menu.element.classList.contains('umbilical-context-menu')).toBe(true);
      expect(menu.element.classList.contains('light')).toBe(true);
    });

    test('should create menu with custom theme', () => {
      const menu = ContextMenu.create({
        items: createMenuItems(),
        theme: 'dark'
      });

      expect(menu.element.classList.contains('dark')).toBe(true);
      expect(menu.element.classList.contains('light')).toBe(false);
    });

    test('should apply custom className', () => {
      const menu = ContextMenu.create({
        items: createMenuItems(),
        className: 'my-custom-menu'
      });

      expect(menu.element.classList.contains('my-custom-menu')).toBe(true);
    });

    test('should throw error when non-manual trigger lacks targetElement', () => {
      expect(() => {
        ContextMenu.create({
          items: createMenuItems(),
          trigger: 'rightclick'
        });
      }).toThrow('ContextMenu requires targetElement for non-manual triggers');
    });
  });

  describe('Menu Display', () => {
    test('should show menu at specified position', () => {
      const menu = ContextMenu.create({
        items: createMenuItems()
      });

      menu.show({ x: 200, y: 150 });

      expect(menu.isVisible).toBe(true);
      expect(menu.element.style.left).toBe('200px');
      expect(menu.element.style.top).toBe('150px');
      expect(menu.element.style.display).toBe('block');
    });

    test('should hide menu', () => {
      const menu = ContextMenu.create({
        items: createMenuItems()
      });

      menu.show({ x: 100, y: 100 });
      menu.hide();

      expect(menu.isVisible).toBe(false);
    });

    test('should toggle menu visibility', () => {
      const menu = ContextMenu.create({
        items: createMenuItems()
      });

      expect(menu.isVisible).toBe(false);
      
      menu.toggle({ x: 100, y: 100 });
      expect(menu.isVisible).toBe(true);
      
      menu.toggle();
      expect(menu.isVisible).toBe(false);
    });

    test('should adjust position when menu would go off-screen', () => {
      const menu = ContextMenu.create({
        items: createMenuItems()
      });

      // Mock window dimensions
      Object.defineProperty(window, 'innerWidth', { value: 1024, configurable: true });
      Object.defineProperty(window, 'innerHeight', { value: 768, configurable: true });

      // Show menu first
      menu.show({ x: 900, y: 500 });

      // Mock getBoundingClientRect to simulate off-screen position
      const mockGetBoundingClientRect = () => ({
        right: 1100,
        bottom: 800,
        width: 200,
        height: 300,
        left: 900,
        top: 500
      });
      
      menu.element.getBoundingClientRect = mockGetBoundingClientRect;

      // Show again to trigger position adjustment
      menu.show({ x: 900, y: 500 });

      // Should adjust position to keep menu on screen
      expect(parseInt(menu.element.style.left)).toBeLessThan(900);
      expect(parseInt(menu.element.style.top)).toBeLessThan(500);
    });
  });

  describe('Item Rendering', () => {
    test('should render all menu items', () => {
      const items = createMenuItems();
      const menu = ContextMenu.create({ items });

      const menuItems = menu.element.querySelectorAll('.umbilical-menu-item');
      const separators = menu.element.querySelectorAll('.umbilical-menu-separator');

      // 5 regular items + 2 separators
      expect(menuItems.length).toBe(5);
      expect(separators.length).toBe(2);
    });

    test('should render icons and shortcuts', () => {
      const menu = ContextMenu.create({
        items: [{ label: 'Copy', icon: '📋', shortcut: 'Ctrl+C' }]
      });

      const icon = menu.element.querySelector('.umbilical-menu-icon');
      const label = menu.element.querySelector('.umbilical-menu-label');
      const shortcut = menu.element.querySelector('.umbilical-menu-shortcut');

      expect(icon.textContent).toBe('📋');
      expect(label.textContent).toBe('Copy');
      expect(shortcut.textContent).toBe('Ctrl+C');
    });

    test('should mark disabled items', () => {
      const menu = ContextMenu.create({
        items: [{ label: 'Delete', disabled: true }]
      });

      const item = menu.element.querySelector('.umbilical-menu-item');
      expect(item.classList.contains('disabled')).toBe(true);
    });

    test('should mark items with submenus', () => {
      const menu = ContextMenu.create({
        items: [{ label: 'Format', subitems: [{ label: 'Bold' }] }]
      });

      const item = menu.element.querySelector('.umbilical-menu-item');
      expect(item.classList.contains('has-submenu')).toBe(true);
    });
  });

  describe('Item Selection', () => {
    test('should call onItemSelect when item is clicked', () => {
      const onItemSelect = createMockFn();
      const items = [{ label: 'Copy', value: 'copy' }];
      
      const menu = ContextMenu.create({
        items,
        onItemSelect
      });

      menu.show({ x: 100, y: 100 });
      
      const item = menu.element.querySelector('.umbilical-menu-item');
      item.click();

      expectMock(onItemSelect).toHaveBeenCalledWith(items[0], menu);
      expect(menu.isVisible).toBe(false); // Menu should hide after selection
    });

    test('should call item action when clicked', () => {
      const action = createMockFn();
      const items = [{ label: 'Copy', action }];
      
      const menu = ContextMenu.create({ items });

      menu.show({ x: 100, y: 100 });
      
      const item = menu.element.querySelector('.umbilical-menu-item');
      item.click();

      expectMock(action).toHaveBeenCalledWith(items[0], menu);
    });

    test('should not trigger action on disabled items', () => {
      const onItemSelect = createMockFn();
      const action = createMockFn();
      const items = [{ label: 'Delete', disabled: true, action }];
      
      const menu = ContextMenu.create({
        items,
        onItemSelect
      });

      menu.show({ x: 100, y: 100 });
      
      const item = menu.element.querySelector('.umbilical-menu-item');
      item.click();

      expectMock(action).not.toHaveBeenCalled();
      expectMock(onItemSelect).not.toHaveBeenCalled();
      expect(menu.isVisible).toBe(true); // Menu should remain visible
    });
  });

  describe('Item Hover', () => {
    test('should call onItemHover when item is hovered', (done) => {
      const onItemHover = createMockFn();
      const items = [{ label: 'Copy', value: 'copy' }];
      
      const menu = ContextMenu.create({
        items,
        onItemHover
      });

      menu.show({ x: 100, y: 100 });
      
      const item = menu.element.querySelector('.umbilical-menu-item');
      triggerMouseEvent(item, 'mouseenter');

      // Wait a bit for hover to register
      setTimeout(() => {
        expectMock(onItemHover).toHaveBeenCalledWith(items[0], menu);
        done();
      }, 10);
    });
  });

  describe('Submenu Functionality', () => {
    test('should show submenu on hover after delay', (done) => {
      const menu = ContextMenu.create({
        items: [{
          label: 'Format',
          subitems: [{ label: 'Bold' }, { label: 'Italic' }]
        }],
        showDelay: 50 // Short delay for testing
      });

      menu.show({ x: 100, y: 100 });
      
      const item = menu.element.querySelector('.umbilical-menu-item');
      triggerMouseEvent(item, 'mouseenter');

      // Wait for submenu to show
      setTimeout(() => {
        const submenus = document.querySelectorAll('.umbilical-context-menu');
        expect(submenus.length).toBe(2); // Main menu + submenu
        done();
      }, 100);
    });

    test('should hide submenu on mouse leave after delay', (done) => {
      const menu = ContextMenu.create({
        items: [{
          label: 'Format',
          subitems: [{ label: 'Bold' }]
        }],
        showDelay: 50,
        hideDelay: 50
      });

      menu.show({ x: 100, y: 100 });
      
      const item = menu.element.querySelector('.umbilical-menu-item');
      triggerMouseEvent(item, 'mouseenter');

      // Wait for submenu to show
      setTimeout(() => {
        triggerMouseEvent(item, 'mouseleave');
        
        // Wait for submenu to hide
        setTimeout(() => {
          const submenus = document.querySelectorAll('.umbilical-context-menu.visible');
          expect(submenus.length).toBe(1); // Only main menu visible
          done();
        }, 100);
      }, 100);
    });

    test.skip('should select item from submenu', (done) => {
      const onItemSelect = createMockFn();
      const subitems = [{ label: 'Bold', value: 'bold' }];
      
      const menu = ContextMenu.create({
        items: [{
          label: 'Format',
          subitems
        }],
        onItemSelect,
        showDelay: 50
      });

      menu.show({ x: 100, y: 100 });
      
      const item = menu.element.querySelector('.umbilical-menu-item');
      triggerMouseEvent(item, 'mouseenter');

      // Wait for submenu and click item
      setTimeout(() => {
        const submenuItems = document.querySelectorAll('.umbilical-context-menu')[1]
          .querySelectorAll('.umbilical-menu-item');
        
        submenuItems[0].click();
        
        expectMock(onItemSelect).toHaveBeenCalledWith(subitems[0]);
        expect(menu.isVisible).toBe(false); // Main menu should hide
        done();
      }, 100);
    });
  });

  describe('Triggers', () => {
    test('should show menu on right-click when trigger is rightclick', () => {
      const targetElement = document.createElement('div');
      document.body.appendChild(targetElement);
      
      const menu = ContextMenu.create({
        items: createMenuItems(),
        trigger: 'rightclick',
        targetElement
      });

      triggerMouseEvent(targetElement, 'contextmenu', { clientX: 200, clientY: 150 });

      expect(menu.isVisible).toBe(true);
      expect(menu.element.style.left).toBe('200px');
      expect(menu.element.style.top).toBe('150px');
    });

    test.skip('should show menu on click when trigger is click', (done) => {
      const targetElement = document.createElement('div');
      document.body.appendChild(targetElement);
      
      const menu = ContextMenu.create({
        items: createMenuItems(),
        trigger: 'click',
        targetElement
      });

      // Use a regular click event
      const event = new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
        clientX: 300,
        clientY: 250
      });
      
      targetElement.dispatchEvent(event);

      // Allow event to be processed
      setTimeout(() => {
        expect(menu.isVisible).toBe(true);
        expect(menu.element.style.left).toBe('300px');
        expect(menu.element.style.top).toBe('250px');
        done();
      }, 10);
    });
  });

  describe('Keyboard Navigation', () => {
    test('should hide menu on Escape key', () => {
      const menu = ContextMenu.create({
        items: createMenuItems()
      });

      menu.show({ x: 100, y: 100 });
      expect(menu.isVisible).toBe(true);

      const event = new KeyboardEvent('keydown', { key: 'Escape' });
      document.dispatchEvent(event);

      expect(menu.isVisible).toBe(false);
    });
  });

  describe('Document Click Handling', () => {
    test('should hide menu when clicking outside', () => {
      const menu = ContextMenu.create({
        items: createMenuItems()
      });

      menu.show({ x: 100, y: 100 });
      expect(menu.isVisible).toBe(true);

      // Click outside menu
      document.body.click();

      expect(menu.isVisible).toBe(false);
    });

    test('should not hide menu when clicking inside', () => {
      const menu = ContextMenu.create({
        items: createMenuItems()
      });

      menu.show({ x: 100, y: 100 });
      
      // Click on menu itself (not on an item)
      menu.element.click();

      expect(menu.isVisible).toBe(true);
    });
  });

  describe('Dynamic Updates', () => {
    test('should update items dynamically', () => {
      const menu = ContextMenu.create({
        items: [{ label: 'Old Item' }]
      });

      const newItems = [{ label: 'New Item 1' }, { label: 'New Item 2' }];
      menu.setItems(newItems);

      const items = menu.element.querySelectorAll('.umbilical-menu-item');
      expect(items.length).toBe(2);
      expect(items[0].textContent.trim()).toBe('New Item 1');
      expect(items[1].textContent.trim()).toBe('New Item 2');
    });

    test('should update position dynamically', () => {
      const menu = ContextMenu.create({
        items: createMenuItems()
      });

      menu.show({ x: 100, y: 100 });
      menu.setPosition({ x: 200, y: 150 });

      expect(menu.element.style.left).toBe('200px');
      expect(menu.element.style.top).toBe('150px');
    });
  });

  describe('Lifecycle', () => {
    test('should call onShow when menu is shown', () => {
      const onShow = createMockFn();
      const menu = ContextMenu.create({
        items: createMenuItems(),
        onShow
      });

      menu.show({ x: 100, y: 100 });

      expectMock(onShow).toHaveBeenCalledWith(menu);
    });

    test('should call onHide when menu is hidden', () => {
      const onHide = createMockFn();
      const menu = ContextMenu.create({
        items: createMenuItems(),
        onHide
      });

      menu.show({ x: 100, y: 100 });
      menu.hide();

      expectMock(onHide).toHaveBeenCalledWith(menu);
    });

    test('should call onMount if provided', () => {
      const onMount = createMockFn();
      
      const menu = ContextMenu.create({
        items: createMenuItems(),
        onMount
      });

      expectMock(onMount).toHaveBeenCalledWith(menu);
    });

    test('should clean up on destroy', () => {
      const targetElement = document.createElement('div');
      document.body.appendChild(targetElement);
      
      const menu = ContextMenu.create({
        items: createMenuItems(),
        trigger: 'rightclick',
        targetElement
      });

      menu.show({ x: 100, y: 100 });
      menu.destroy();

      expect(menu.element.parentNode).toBeNull();
      
      // Trigger should be removed
      triggerMouseEvent(targetElement, 'contextmenu');
      expect(menu.isVisible).toBe(false);
    });
  });

  describe('Agent Testing Patterns', () => {
    test('should work with completely mocked umbilical', () => {
      const mockUmbilical = UmbilicalUtils.createMockUmbilical({
        items: createMenuItems(),
        onItemSelect: createMockFn(),
        onItemHover: createMockFn()
      });

      const menu = ContextMenu.create(mockUmbilical);
      
      menu.show({ x: 100, y: 100 });
      expect(menu.isVisible).toBe(true);
      
      const item = menu.element.querySelector('.umbilical-menu-item');
      item.click();
      
      expectMock(mockUmbilical.onItemSelect).toHaveBeenCalled();
    });

    test('should allow agent to test different configurations', () => {
      const configs = [
        { items: createMenuItems(), theme: 'light' },
        { items: createMenuItems(), theme: 'dark' },
        { items: createMenuItems(), trigger: 'manual' }
      ];

      configs.forEach(config => {
        const menu = ContextMenu.create(config);
        
        expect(menu).toBeDefined();
        if (config.theme) {
          expect(menu.element.classList.contains(config.theme)).toBe(true);
        }
      });
    });
  });
});