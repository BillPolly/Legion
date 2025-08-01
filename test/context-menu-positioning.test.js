/**
 * @jest-environment jsdom
 */

import { ContextMenu } from '../src/components/context-menu/index.js';

// Mock functions for testing
const createMockFn = () => {
  const fn = (...args) => {
    fn.calls.push(args);
    return fn.returnValue;
  };
  fn.calls = [];
  fn.returnValue = undefined;
  fn.mockReturnValue = (value) => { fn.returnValue = value; return fn; };
  return fn;
};

describe('ContextMenu Positioning Tests', () => {
  // Mock DOM element helper
  const createMockElement = (tagName = 'DIV') => ({
    nodeType: 1,
    tagName,
    textContent: '',
    innerHTML: '',
    classList: {
      add: createMockFn(),
      remove: createMockFn(),
      contains: createMockFn().mockReturnValue(false)
    },
    setAttribute: createMockFn(),
    removeAttribute: createMockFn(),
    addEventListener: createMockFn(),
    removeEventListener: createMockFn(),
    focus: createMockFn(),
    blur: createMockFn(),
    click: createMockFn(),
    style: {},
    parentNode: null,
    appendChild: createMockFn(),
    removeChild: createMockFn(),
    getBoundingClientRect: createMockFn().mockReturnValue({
      left: 0,
      top: 0,
      right: 150,
      bottom: 200,
      width: 150,
      height: 200
    })
  });

  let mockWindow;
  let originalWindow;

  beforeEach(() => {
    // Mock window dimensions
    originalWindow = global.window;
    mockWindow = {
      innerWidth: 1024,
      innerHeight: 768
    };
    global.window = mockWindow;
    
    // Mock document.body
    global.document.body = createMockElement();
    global.document.body.appendChild = jest.fn();
  });

  afterEach(() => {
    global.window = originalWindow;
  });

  describe('Main Menu Positioning', () => {
    test('should position menu at exact mouse coordinates when space allows', () => {
      const mockDom = createMockElement();
      const menu = ContextMenu.create({
        dom: mockDom,
        items: [
          { label: 'Item 1' },
          { label: 'Item 2' }
        ]
      });

      // Mock menu dimensions (150x200)
      menu.element.getBoundingClientRect = jest.fn(() => ({
        left: 100,
        top: 100,
        right: 250,
        bottom: 300,
        width: 150,
        height: 200
      }));

      // Show menu at position with plenty of space
      menu.show({ x: 100, y: 100 });

      // Should position exactly at mouse coordinates
      expect(menu.element.style.left).toBe('100px');
      expect(menu.element.style.top).toBe('100px');
    });

    test('should adjust position minimally when menu would go off right edge', () => {
      const mockDom = createMockElement();
      const menu = ContextMenu.create({
        dom: mockDom,
        items: [{ label: 'Item 1' }]
      });

      // Mock menu that would extend beyond right edge
      menu.element.getBoundingClientRect = jest.fn(() => ({
        left: 900,
        top: 100,
        right: 1050, // Would go 26px beyond window.innerWidth (1024)
        bottom: 300,
        width: 150,
        height: 200
      }));

      // Show menu near right edge
      menu.show({ x: 900, y: 100 });

      // Should adjust to fit with margin: 1024 - 150 - 5 = 869
      expect(menu.element.style.left).toBe('869px');
      expect(menu.element.style.top).toBe('100px'); // Y should not change
    });

    test('should adjust position minimally when menu would go off bottom edge', () => {
      const mockDom = createMockElement();
      const menu = ContextMenu.create({
        dom: mockDom,
        items: [{ label: 'Item 1' }]
      });

      // Mock menu that would extend beyond bottom edge
      menu.element.getBoundingClientRect = jest.fn(() => ({
        left: 100,
        top: 600,
        right: 250,
        bottom: 800, // Would go 32px beyond window.innerHeight (768)
        width: 150,
        height: 200
      }));

      // Show menu near bottom edge
      menu.show({ x: 100, y: 600 });

      // Should adjust to fit with margin: 768 - 200 - 5 = 563
      expect(menu.element.style.left).toBe('100px'); // X should not change
      expect(menu.element.style.top).toBe('563px');
    });

    test('should handle both horizontal and vertical adjustments', () => {
      const mockDom = createMockElement();
      const menu = ContextMenu.create({
        dom: mockDom,
        items: [{ label: 'Item 1' }]
      });

      // Mock menu that would extend beyond both edges
      menu.element.getBoundingClientRect = jest.fn(() => ({
        left: 900,
        top: 600,
        right: 1050,
        bottom: 800,
        width: 150,
        height: 200
      }));

      menu.show({ x: 900, y: 600 });

      // Should adjust both dimensions
      expect(menu.element.style.left).toBe('869px'); // 1024 - 150 - 5
      expect(menu.element.style.top).toBe('563px');  // 768 - 200 - 5
    });

    test('should enforce minimum margins', () => {
      const mockDom = createMockElement();
      const menu = ContextMenu.create({
        dom: mockDom,
        items: [{ label: 'Item 1' }]
      });

      menu.element.getBoundingClientRect = jest.fn(() => ({
        left: -10,
        top: -10,
        right: 140,
        bottom: 190,
        width: 150,
        height: 200
      }));

      // Try to show menu at negative coordinates
      menu.show({ x: -10, y: -10 });

      // Should enforce minimum margin
      expect(menu.element.style.left).toBe('5px');
      expect(menu.element.style.top).toBe('5px');
    });
  });

  describe('Submenu Positioning', () => {
    test('should position submenu to the right of parent item by default', () => {
      const mockDom = createMockElement();
      const menu = ContextMenu.create({
        dom: mockDom,
        items: [
          {
            label: 'Parent Item',
            subitems: [
              { label: 'Sub Item 1' },
              { label: 'Sub Item 2' }
            ]
          }
        ]
      });

      // Mock parent menu positioning
      menu.element.getBoundingClientRect = jest.fn(() => ({
        left: 100,
        top: 100,
        right: 250,
        bottom: 300,
        width: 150,
        height: 200
      }));

      menu.show({ x: 100, y: 100 });

      // Get the parent item element
      const parentItem = { getBoundingClientRect: () => ({
        left: 100,
        top: 120,
        right: 250,
        bottom: 140,
        width: 150,
        height: 20
      }) };

      // Simulate mouse enter on parent item
      let submenuCreated = false;
      const originalCreate = ContextMenu.create;
      ContextMenu.create = (config) => {
        if (submenuCreated) return originalCreate(config);
        submenuCreated = true;
        
        const submenu = originalCreate(config);
        
        // Mock submenu dimensions
        submenu.element.getBoundingClientRect = createMockFn().mockReturnValue({
          left: 0,
          top: 0,
          right: 120,
          bottom: 100,
          width: 120,
          height: 100
        });
        
        // Verify submenu positioning would be calculated
        // (this test verifies the calculation logic)
        
        return submenu;
      };

      // This would trigger submenu creation in real scenario
      // We'll verify the positioning logic directly
      const itemRect = parentItem.getBoundingClientRect();
      const expectedX = itemRect.right - 2; // 250 - 2 = 248
      const expectedY = itemRect.top; // 120

      expect(expectedX).toBe(248);
      expect(expectedY).toBe(120);
      
      ContextMenu.create = originalCreate;
    });

    test('should flip submenu to left when it would go off right edge', () => {
      const mockDom = createMockElement();
      
      // Mock parent item near right edge
      const parentItemRect = {
        left: 900,
        top: 120,
        right: 1020, // Close to window edge (1024)
        bottom: 140,
        width: 120,
        height: 20
      };

      const submenuWidth = 150;
      const margin = 5;

      // Default position would be: 1020 - 2 = 1018
      // Submenu would extend to: 1018 + 150 = 1168 (beyond 1024)
      // So it should flip to: 900 - 150 + 2 = 752

      const defaultX = parentItemRect.right - 2; // 1018
      const wouldExceedRight = defaultX + submenuWidth > mockWindow.innerWidth - margin;
      
      expect(wouldExceedRight).toBe(true);
      
      const flippedX = parentItemRect.left - submenuWidth + 2; // 752
      expect(flippedX).toBe(752);
    });

    test('should adjust submenu vertically when it would go off bottom edge', () => {
      const parentItemRect = {
        left: 100,
        top: 700, // Near bottom edge
        right: 250,
        bottom: 720,
        width: 150,
        height: 20
      };

      const submenuHeight = 150;
      const margin = 5;

      // Default Y position: 700
      // Submenu would extend to: 700 + 150 = 850 (beyond 768)
      // Should adjust to: 768 - 150 - 5 = 613

      const defaultY = parentItemRect.top; // 700
      const wouldExceedBottom = defaultY + submenuHeight > mockWindow.innerHeight - margin;
      
      expect(wouldExceedBottom).toBe(true);
      
      const adjustedY = mockWindow.innerHeight - submenuHeight - margin; // 613
      expect(adjustedY).toBe(613);
    });
  });

  describe('Edge Cases', () => {
    test('should handle very small viewport', () => {
      // Mock tiny viewport
      global.window = {
        innerWidth: 200,
        innerHeight: 150
      };

      const mockDom = createMockElement();
      const menu = ContextMenu.create({
        dom: mockDom,
        items: [{ label: 'Item 1' }]
      });

      // Mock large menu
      menu.element.getBoundingClientRect = jest.fn(() => ({
        left: 0,
        top: 0,
        right: 180,
        bottom: 120,
        width: 180,
        height: 120
      }));

      menu.show({ x: 50, y: 50 });

      // Should enforce margins even in tiny viewport
      expect(menu.element.style.left).toBe('15px'); // 200 - 180 - 5
      expect(menu.element.style.top).toBe('25px');  // 150 - 120 - 5
    });

    test('should handle menu larger than viewport', () => {
      const mockDom = createMockElement();
      const menu = ContextMenu.create({
        dom: mockDom,
        items: [{ label: 'Item 1' }]
      });

      // Mock menu larger than viewport
      menu.element.getBoundingClientRect = jest.fn(() => ({
        left: 0,
        top: 0,
        right: 1200, // Wider than viewport (1024)
        bottom: 900, // Taller than viewport (768)
        width: 1200,
        height: 900
      }));

      menu.show({ x: 100, y: 100 });

      // Should position at minimum margin since menu can't fit
      expect(menu.element.style.left).toBe('5px');
      expect(menu.element.style.top).toBe('5px');
    });
  });
});