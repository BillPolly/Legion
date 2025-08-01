/**
 * @jest-environment jsdom
 */

import { Divider } from '../src/components/divider/index.js';
import { UmbilicalUtils } from '../src/umbilical/index.js';

describe('Divider Component', () => {
  let container;

  beforeEach(() => {
    container = document.createElement('div');
    container.style.width = '400px';
    container.style.height = '300px';
    container.style.position = 'relative';
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
    // Clean up any cursor state
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  });

  describe('Umbilical Protocol Compliance', () => {
    test('provides introspection via describe', () => {
      let capturedRequirements = null;
      
      Divider.create({
        describe: (reqs) => {
          capturedRequirements = reqs.getAll();
        }
      });

      expect(capturedRequirements).toBeDefined();
      expect(capturedRequirements.dom).toBeDefined();
      expect(capturedRequirements.dom.type).toBe('HTMLElement');
      expect(capturedRequirements.orientation).toBeDefined();
      expect(capturedRequirements.orientation.type).toBe('string');
      expect(capturedRequirements.onResize).toBeDefined();
      expect(capturedRequirements.onResize.type).toBe('function');
    });

    test('validates umbilical capabilities', () => {
      const validUmbilical = {
        dom: container,
        orientation: 'vertical'
      };

      const invalidUmbilical = {
        dom: container,
        orientation: 'invalid'
      };

      const validResult = Divider.create({
        validate: (checks) => {
          return {
            hasDomElement: validUmbilical.dom && validUmbilical.dom.nodeType === Node.ELEMENT_NODE,
            hasValidOrientation: !validUmbilical.orientation || ['vertical', 'horizontal'].includes(validUmbilical.orientation)
          };
        },
        ...validUmbilical
      });

      expect(validResult.hasDomElement).toBe(true);
      expect(validResult.hasValidOrientation).toBe(true);

      const invalidResult = Divider.create({
        validate: (checks) => {
          return {
            hasValidOrientation: !invalidUmbilical.orientation || ['vertical', 'horizontal'].includes(invalidUmbilical.orientation)
          };
        },
        ...invalidUmbilical
      });

      expect(invalidResult.hasValidOrientation).toBe(false);
    });

    test('requires valid DOM element', () => {
      expect(() => {
        Divider.create({ dom: null });
      }).toThrow('Divider requires a valid DOM element');

      expect(() => {
        Divider.create({});
      }).toThrow('missing required capabilities');
    });
  });

  describe('Instance Creation and Basic Functionality', () => {
    test('creates vertical divider with default options', () => {
      const divider = Divider.create({ dom: container });

      expect(divider.orientation).toBe('vertical');
      expect(divider.position).toBe(50);
      expect(divider.enabled).toBe(true);
      expect(divider.locked).toBe(false);
      expect(divider.element).toBeInstanceOf(HTMLElement);
      
      const dividerEl = container.querySelector('.umbilical-divider');
      expect(dividerEl).toBeTruthy();
      expect(dividerEl.style.left).toBe('50%');
      expect(dividerEl.style.cursor).toBe('col-resize');
    });

    test('creates horizontal divider', () => {
      const divider = Divider.create({ 
        dom: container, 
        orientation: 'horizontal' 
      });

      expect(divider.orientation).toBe('horizontal');
      
      const dividerEl = container.querySelector('.umbilical-divider');
      expect(dividerEl.style.top).toBe('50%');
      expect(dividerEl.style.cursor).toBe('row-resize');
    });

    test('respects initial position and bounds', () => {
      const divider = Divider.create({ 
        dom: container,
        initialPosition: 75,
        minPosition: 20,
        maxPosition: 80
      });

      expect(divider.position).toBe(75);
      expect(divider.getBounds()).toEqual({ min: 20, max: 80 });
    });

    test('clamps initial position to bounds', () => {
      const divider = Divider.create({ 
        dom: container,
        initialPosition: 95,
        minPosition: 20,
        maxPosition: 80
      });

      expect(divider.position).toBe(80);
    });
  });

  describe('Position Control', () => {
    let divider;

    beforeEach(() => {
      divider = Divider.create({ dom: container });
    });

    test('sets position programmatically', () => {
      const result = divider.setPosition(75);
      expect(result).toBe(true);
      expect(divider.position).toBe(75);
      
      const dividerEl = container.querySelector('.umbilical-divider');
      expect(dividerEl.style.left).toBe('75%');
    });

    test('clamps position to bounds', () => {
      divider.setBounds(20, 80);
      
      divider.setPosition(10);
      expect(divider.position).toBe(20);
      
      divider.setPosition(95);
      expect(divider.position).toBe(80);
    });

    test('returns false when position unchanged', () => {
      divider.setPosition(50);
      const result = divider.setPosition(50);
      expect(result).toBe(false);
    });

    test('validates position input', () => {
      expect(() => {
        divider.setPosition('invalid');
      }).toThrow('Position must be a number');
    });
  });

  describe('State Control', () => {
    let divider;

    beforeEach(() => {
      divider = Divider.create({ dom: container });
    });

    test('enables and disables divider', () => {
      expect(divider.enabled).toBe(true);
      
      const result1 = divider.disable();
      expect(result1).toBe(true);
      expect(divider.enabled).toBe(false);
      
      const result2 = divider.disable();
      expect(result2).toBe(false); // Already disabled
      
      const result3 = divider.enable();
      expect(result3).toBe(true);
      expect(divider.enabled).toBe(true);
    });

    test('locks and unlocks divider', () => {
      expect(divider.locked).toBe(false);
      
      const result1 = divider.lock();
      expect(result1).toBe(true);
      expect(divider.locked).toBe(true);
      
      const result2 = divider.lock();
      expect(result2).toBe(false); // Already locked
      
      const result3 = divider.unlock();
      expect(result3).toBe(true);
      expect(divider.locked).toBe(false);
    });

    test('cursor changes with state', () => {
      const dividerEl = container.querySelector('.umbilical-divider');
      
      expect(dividerEl.style.cursor).toBe('col-resize');
      
      divider.disable();
      expect(dividerEl.style.cursor).toBe('default');
      
      divider.enable();
      expect(dividerEl.style.cursor).toBe('col-resize');
      
      divider.lock();
      expect(dividerEl.style.cursor).toBe('default');
      
      divider.unlock();
      expect(dividerEl.style.cursor).toBe('col-resize');
    });
  });

  describe('Theme Control', () => {
    let divider;

    beforeEach(() => {
      divider = Divider.create({ dom: container });
    });

    test('sets and gets theme', () => {
      expect(divider.getTheme()).toBe('light');
      
      divider.setTheme('dark');
      expect(divider.getTheme()).toBe('dark');
    });

    test('validates theme input', () => {
      expect(() => {
        divider.setTheme('invalid');
      }).toThrow('Theme must be "light" or "dark"');
    });

    test('applies theme styles', () => {
      const dividerEl = container.querySelector('.umbilical-divider');
      
      // Light theme
      expect(dividerEl.style.backgroundColor).toBe('rgb(209, 213, 219)');
      
      // Dark theme
      divider.setTheme('dark');
      expect(dividerEl.style.backgroundColor).toBe('rgb(75, 85, 99)');
    });
  });

  describe('Bounds Control', () => {
    let divider;

    beforeEach(() => {
      divider = Divider.create({ dom: container });
    });

    test('sets and gets bounds', () => {
      divider.setBounds(25, 75);
      expect(divider.getBounds()).toEqual({ min: 25, max: 75 });
    });

    test('validates bounds input', () => {
      expect(() => {
        divider.setBounds('invalid', 75);
      }).toThrow('Bounds must be numbers');
      
      expect(() => {
        divider.setBounds(75, 25);
      }).toThrow('Minimum bound must be less than maximum bound');
    });

    test('clamps bounds to 0-100 range', () => {
      divider.setBounds(-10, 110);
      expect(divider.getBounds()).toEqual({ min: 0, max: 100 });
    });

    test('adjusts position when out of new bounds', () => {
      divider.setPosition(90);
      expect(divider.position).toBe(90);
      
      divider.setBounds(20, 80);
      expect(divider.position).toBe(80);
    });
  });

  describe('Event Callbacks', () => {
    test('calls onResize when position changes', () => {
      let resizeCalled = false;
      let resizeArgs = null;
      
      const onResize = (position, instance) => {
        resizeCalled = true;
        resizeArgs = { position, instance };
      };
      
      const divider = Divider.create({ 
        dom: container, 
        onResize 
      });

      divider.setPosition(75);
      expect(resizeCalled).toBe(true);
      expect(resizeArgs.position).toBe(75);
      expect(resizeArgs.instance).toBe(divider);
    });

    test('calls onMount when created', () => {
      let mountCalled = false;
      let mountInstance = null;
      
      const onMount = (instance) => {
        mountCalled = true;
        mountInstance = instance;
      };
      
      const divider = Divider.create({ 
        dom: container, 
        onMount 
      });

      expect(mountCalled).toBe(true);
      expect(mountInstance).toBe(divider);
    });

    test('calls onDestroy when destroyed', () => {
      let destroyCalled = false;
      let destroyInstance = null;
      
      const onDestroy = (instance) => {
        destroyCalled = true;
        destroyInstance = instance;
      };
      
      const divider = Divider.create({ 
        dom: container, 
        onDestroy 
      });

      divider.destroy();
      expect(destroyCalled).toBe(true);
      expect(destroyInstance).toBe(divider);
    });
  });

  describe('Mouse Interaction', () => {
    let divider;
    let dividerEl;

    beforeEach(() => {
      divider = Divider.create({ dom: container });
      dividerEl = container.querySelector('.umbilical-divider');
    });

    test('changes appearance on hover', () => {
      const mouseEnter = new Event('mouseenter');
      const mouseLeave = new Event('mouseleave');
      
      dividerEl.dispatchEvent(mouseEnter);
      expect(dividerEl.style.backgroundColor).toBe('rgb(156, 163, 175)');
      
      dividerEl.dispatchEvent(mouseLeave);
      expect(dividerEl.style.backgroundColor).toBe('rgb(209, 213, 219)');
    });

    test('does not respond to hover when disabled', () => {
      divider.disable();
      
      const mouseEnter = new Event('mouseenter');
      dividerEl.dispatchEvent(mouseEnter);
      
      // Should stay disabled color
      expect(dividerEl.style.backgroundColor).toBe('rgb(229, 231, 235)');
    });

    test('drag functionality exists', () => {
      expect(divider.dragging).toBe(false);
      
      // Test that dragging state is accessible
      const dividerEl = container.querySelector('.umbilical-divider');
      expect(dividerEl.style.cursor).toBe('col-resize');
    });

    test('drag cursor changes when disabled or locked', () => {
      const dividerEl = container.querySelector('.umbilical-divider');
      
      expect(dividerEl.style.cursor).toBe('col-resize');
      
      divider.disable();
      expect(dividerEl.style.cursor).toBe('default');
      
      divider.enable();
      divider.lock();
      expect(dividerEl.style.cursor).toBe('default');
    });
  });

  describe('Cleanup', () => {
    test('removes DOM element on destroy', () => {
      const divider = Divider.create({ dom: container });
      
      expect(container.querySelector('.umbilical-divider')).toBeTruthy();
      
      divider.destroy();
      
      expect(container.querySelector('.umbilical-divider')).toBeFalsy();
    });

    test('cleans up event listeners on destroy', () => {
      const divider = Divider.create({ dom: container });
      
      // Verify cleanup doesn't throw errors
      expect(() => {
        divider.destroy();
      }).not.toThrow();
    });

    test('resets body styles on destroy', () => {
      const divider = Divider.create({ dom: container });
      const dividerEl = container.querySelector('.umbilical-divider');
      
      // Simulate drag state
      const mouseDown = new MouseEvent('mousedown', {
        clientX: 200,
        clientY: 150
      });
      dividerEl.dispatchEvent(mouseDown);
      
      expect(document.body.style.cursor).toBe('col-resize');
      
      divider.destroy();
      
      expect(document.body.style.cursor).toBe('');
      expect(document.body.style.userSelect).toBe('');
    });
  });

  describe('Integration Scenarios', () => {
    test('creates multiple dividers in same container', () => {
      const divider1 = Divider.create({ 
        dom: container,
        orientation: 'vertical',
        initialPosition: 33
      });
      
      const divider2 = Divider.create({ 
        dom: container,
        orientation: 'vertical',
        initialPosition: 66
      });

      const dividers = container.querySelectorAll('.umbilical-divider');
      expect(dividers).toHaveLength(2);
      
      expect(divider1.position).toBe(33);
      expect(divider2.position).toBe(66);
    });

    test('handles rapid position changes', () => {
      let resizeCallCount = 0;
      
      const onResize = () => {
        resizeCallCount++;
      };
      
      const divider = Divider.create({ 
        dom: container, 
        onResize 
      });

      for (let i = 0; i < 10; i++) {
        divider.setPosition(10 + i * 8);
      }

      expect(divider.position).toBe(82);
      expect(resizeCallCount).toBe(10);
    });

    test('maintains state through enable/disable cycles', () => {
      const divider = Divider.create({ 
        dom: container,
        initialPosition: 75
      });

      divider.disable();
      divider.setPosition(25);
      expect(divider.position).toBe(25);
      
      divider.enable();
      expect(divider.position).toBe(25);
      expect(divider.enabled).toBe(true);
    });
  });
});