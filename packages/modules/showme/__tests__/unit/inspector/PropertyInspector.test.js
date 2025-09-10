/**
 * Unit Tests for PropertyInspector
 * 
 * Tests the property inspection and editing system for diagram elements
 * NO MOCKS - Tests real property binding and validation functionality
 * 
 * @jest-environment jsdom
 */

import { PropertyInspector } from '../../../src/inspector/PropertyInspector.js';
import { PropertyBinding } from '../../../src/inspector/PropertyBinding.js';

// Manual mock function for ES modules
const mockFn = () => {
  const calls = [];
  const fn = (...args) => {
    calls.push(args);
  };
  fn.calls = calls;
  fn.toHaveBeenCalledWith = (expected) => {
    return calls.some(call => 
      JSON.stringify(call[0]) === JSON.stringify(expected)
    );
  };
  return fn;
};

// Mock vi for compatibility
const vi = { fn: mockFn };

describe('PropertyInspector', () => {
  let inspector;
  let container;

  beforeEach(() => {
    // Setup DOM container
    container = document.createElement('div');
    container.id = 'test-inspector';
    document.body.appendChild(container);
    
    inspector = new PropertyInspector({ container });
  });

  afterEach(() => {
    inspector.destroy();
    document.body.removeChild(container);
  });

  describe('initialization', () => {
    test('should initialize with empty selection', () => {
      expect(inspector.getSelection()).toBeNull();
      expect(inspector.getProperties()).toEqual({});
      expect(inspector.isVisible()).toBe(false);
    });

    test('should create DOM structure', () => {
      const panel = container.querySelector('.property-inspector');
      expect(panel).toBeTruthy();
      
      const header = container.querySelector('.property-inspector-header');
      expect(header).toBeTruthy();
      
      const content = container.querySelector('.property-inspector-content');
      expect(content).toBeTruthy();
    });

    test('should accept custom configuration', () => {
      const customInspector = new PropertyInspector({
        container,
        width: 300,
        collapsible: false,
        position: 'left'
      });
      
      const config = customInspector.getConfiguration();
      expect(config.width).toBe(300);
      expect(config.collapsible).toBe(false);
      expect(config.position).toBe('left');
      
      customInspector.destroy();
    });
  });

  describe('element selection', () => {
    test('should select single element', () => {
      const element = {
        id: 'node-1',
        type: 'node',
        properties: {
          label: 'Test Node',
          x: 100,
          y: 200,
          width: 120,
          height: 80,
          color: '#3498db'
        }
      };
      
      inspector.selectElement(element);
      
      expect(inspector.getSelection()).toEqual(element);
      expect(inspector.getProperties()).toEqual(element.properties);
      expect(inspector.isVisible()).toBe(true);
    });

    test('should handle multiple element selection', () => {
      const elements = [
        {
          id: 'node-1',
          type: 'node',
          properties: { label: 'Node 1', x: 100, y: 100 }
        },
        {
          id: 'node-2',
          type: 'node',
          properties: { label: 'Node 2', x: 200, y: 200 }
        }
      ];
      
      inspector.selectElements(elements);
      
      expect(inspector.getSelection()).toEqual(elements);
      expect(inspector.getSelectionCount()).toBe(2);
      
      // Should show common properties
      const commonProps = inspector.getCommonProperties();
      expect(commonProps).toHaveProperty('type', 'node');
    });

    test('should clear selection', () => {
      const element = {
        id: 'node-1',
        type: 'node',
        properties: { label: 'Test' }
      };
      
      inspector.selectElement(element);
      expect(inspector.getSelection()).toBeTruthy();
      
      inspector.clearSelection();
      
      expect(inspector.getSelection()).toBeNull();
      expect(inspector.getProperties()).toEqual({});
      expect(inspector.isVisible()).toBe(false);
    });

    test('should handle selection change events', () => {
      const changeHandler = vi.fn();
      inspector.on('selectionChanged', changeHandler);
      
      const element = {
        id: 'node-1',
        type: 'node',
        properties: { label: 'Test' }
      };
      
      inspector.selectElement(element);
      
      expect(changeHandler.toHaveBeenCalledWith({
        selection: element,
        previousSelection: null
      })).toBe(true);
    });
  });

  describe('property display', () => {
    test('should display properties in appropriate editors', () => {
      const element = {
        id: 'node-1',
        type: 'node',
        properties: {
          label: 'Test Node',
          x: 100,
          y: 200,
          width: 120,
          height: 80,
          color: '#3498db',
          visible: true,
          opacity: 0.8
        }
      };
      
      inspector.selectElement(element);
      
      // Check text input for label
      const labelInput = container.querySelector('input[data-property="label"]');
      expect(labelInput).toBeTruthy();
      expect(labelInput.value).toBe('Test Node');
      
      // Check number inputs
      const xInput = container.querySelector('input[data-property="x"]');
      expect(xInput).toBeTruthy();
      expect(xInput.type).toBe('number');
      expect(parseFloat(xInput.value)).toBe(100);
      
      // Check color picker
      const colorInput = container.querySelector('input[data-property="color"]');
      expect(colorInput).toBeTruthy();
      expect(colorInput.type).toBe('color');
      expect(colorInput.value).toBe('#3498db');
      
      // Check checkbox for boolean
      const visibleInput = container.querySelector('input[data-property="visible"]');
      expect(visibleInput).toBeTruthy();
      expect(visibleInput.type).toBe('checkbox');
      expect(visibleInput.checked).toBe(true);
      
      // Check range for opacity
      const opacityInput = container.querySelector('input[data-property="opacity"]');
      expect(opacityInput).toBeTruthy();
      expect(opacityInput.type).toBe('range');
      expect(parseFloat(opacityInput.value)).toBe(0.8);
    });

    test('should group related properties', () => {
      const element = {
        id: 'node-1',
        type: 'node',
        properties: {
          label: 'Test',
          x: 100,
          y: 200,
          width: 120,
          height: 80,
          color: '#3498db',
          backgroundColor: '#ffffff',
          borderColor: '#000000'
        }
      };
      
      inspector.selectElement(element);
      
      // Check for grouped sections
      const positionGroup = container.querySelector('.property-group[data-group="position"]');
      expect(positionGroup).toBeTruthy();
      
      const dimensionGroup = container.querySelector('.property-group[data-group="dimensions"]');
      expect(dimensionGroup).toBeTruthy();
      
      const styleGroup = container.querySelector('.property-group[data-group="style"]');
      expect(styleGroup).toBeTruthy();
    });

    test('should handle custom property templates', () => {
      inspector.registerPropertyTemplate('customProp', {
        type: 'select',
        options: ['option1', 'option2', 'option3'],
        defaultValue: 'option1'
      });
      
      const element = {
        id: 'node-1',
        type: 'node',
        properties: {
          customProp: 'option2'
        }
      };
      
      inspector.selectElement(element);
      
      const select = container.querySelector('select[data-property="customProp"]');
      expect(select).toBeTruthy();
      expect(select.value).toBe('option2');
      expect(select.options.length).toBe(3);
    });
  });

  describe('property editing', () => {
    test('should update property on input change', () => {
      const element = {
        id: 'node-1',
        type: 'node',
        properties: {
          label: 'Original Label',
          x: 100
        }
      };
      
      inspector.selectElement(element);
      
      const labelInput = container.querySelector('input[data-property="label"]');
      labelInput.value = 'New Label';
      labelInput.dispatchEvent(new Event('input'));
      
      expect(inspector.getPropertyValue('label')).toBe('New Label');
      expect(element.properties.label).toBe('New Label');
    });

    test('should validate property changes', () => {
      inspector.registerValidator('x', (value) => {
        if (value < 0) return { valid: false, error: 'X must be positive' };
        if (value > 1000) return { valid: false, error: 'X must be less than 1000' };
        return { valid: true };
      });
      
      const element = {
        id: 'node-1',
        type: 'node',
        properties: { x: 100 }
      };
      
      inspector.selectElement(element);
      
      const xInput = container.querySelector('input[data-property="x"]');
      
      // Try invalid value
      xInput.value = '-50';
      xInput.dispatchEvent(new Event('input'));
      
      const error = container.querySelector('.property-error[data-property="x"]');
      expect(error).toBeTruthy();
      expect(error.textContent).toBe('X must be positive');
      expect(element.properties.x).toBe(100); // Should not update
      
      // Try valid value
      xInput.value = '200';
      xInput.dispatchEvent(new Event('input'));
      
      expect(container.querySelector('.property-error[data-property="x"]')).toBeFalsy();
      expect(element.properties.x).toBe(200);
    });

    test('should emit property change events', () => {
      const changeHandler = vi.fn();
      inspector.on('propertyChanged', changeHandler);
      
      const element = {
        id: 'node-1',
        type: 'node',
        properties: { label: 'Test' }
      };
      
      inspector.selectElement(element);
      
      const labelInput = container.querySelector('input[data-property="label"]');
      labelInput.value = 'Updated';
      labelInput.dispatchEvent(new Event('input'));
      
      expect(changeHandler.toHaveBeenCalledWith({
        element: element,
        property: 'label',
        oldValue: 'Test',
        newValue: 'Updated'
      })).toBe(true);
    });

    test('should support batch property updates', () => {
      const element = {
        id: 'node-1',
        type: 'node',
        properties: {
          x: 100,
          y: 200,
          width: 120,
          height: 80
        }
      };
      
      inspector.selectElement(element);
      
      inspector.updateProperties({
        x: 150,
        y: 250,
        width: 140,
        height: 100
      });
      
      expect(element.properties.x).toBe(150);
      expect(element.properties.y).toBe(250);
      expect(element.properties.width).toBe(140);
      expect(element.properties.height).toBe(100);
    });

    test('should handle multi-element property editing', () => {
      const elements = [
        {
          id: 'node-1',
          type: 'node',
          properties: { color: '#ff0000', width: 100 }
        },
        {
          id: 'node-2',
          type: 'node',
          properties: { color: '#00ff00', width: 120 }
        }
      ];
      
      inspector.selectElements(elements);
      
      // Update common property
      inspector.setPropertyValue('color', '#0000ff');
      
      expect(elements[0].properties.color).toBe('#0000ff');
      expect(elements[1].properties.color).toBe('#0000ff');
      
      // Width should remain different
      expect(elements[0].properties.width).toBe(100);
      expect(elements[1].properties.width).toBe(120);
    });
  });

  describe('property binding', () => {
    test('should create property binding', () => {
      const source = {
        id: 'source',
        properties: { value: 100 }
      };
      
      const target = {
        id: 'target',
        properties: { boundValue: 0 }
      };
      
      const binding = inspector.createBinding(
        source, 'value',
        target, 'boundValue'
      );
      
      expect(binding).toBeInstanceOf(PropertyBinding);
      expect(target.properties.boundValue).toBe(100);
      
      // Update source
      source.properties.value = 200;
      binding.update();
      
      expect(target.properties.boundValue).toBe(200);
    });

    test('should support binding transformations', () => {
      const source = {
        id: 'source',
        properties: { value: 10 }
      };
      
      const target = {
        id: 'target',
        properties: { scaledValue: 0 }
      };
      
      const binding = inspector.createBinding(
        source, 'value',
        target, 'scaledValue',
        { transform: (v) => v * 2 }
      );
      
      expect(target.properties.scaledValue).toBe(20);
      
      source.properties.value = 15;
      binding.update();
      
      expect(target.properties.scaledValue).toBe(30);
    });

    test('should support two-way binding', () => {
      const obj1 = {
        id: 'obj1',
        properties: { value: 100 }
      };
      
      const obj2 = {
        id: 'obj2',
        properties: { value: 200 }
      };
      
      const binding = inspector.createTwoWayBinding(
        obj1, 'value',
        obj2, 'value'
      );
      
      expect(obj2.properties.value).toBe(100); // Initial sync
      
      obj2.properties.value = 300;
      binding.updateReverse();
      
      expect(obj1.properties.value).toBe(300);
    });

    test('should manage multiple bindings', () => {
      const source = {
        id: 'source',
        properties: { value: 100 }
      };
      
      const targets = [
        { id: 'target1', properties: { bound: 0 } },
        { id: 'target2', properties: { bound: 0 } },
        { id: 'target3', properties: { bound: 0 } }
      ];
      
      targets.forEach(target => {
        inspector.createBinding(source, 'value', target, 'bound');
      });
      
      expect(targets[0].properties.bound).toBe(100);
      expect(targets[1].properties.bound).toBe(100);
      expect(targets[2].properties.bound).toBe(100);
      
      // Update all bindings
      source.properties.value = 200;
      inspector.updateAllBindings();
      
      expect(targets[0].properties.bound).toBe(200);
      expect(targets[1].properties.bound).toBe(200);
      expect(targets[2].properties.bound).toBe(200);
    });

    test('should remove bindings', () => {
      const source = { id: 'source', properties: { value: 100 } };
      const target = { id: 'target', properties: { bound: 0 } };
      
      const binding = inspector.createBinding(source, 'value', target, 'bound');
      expect(target.properties.bound).toBe(100);
      
      inspector.removeBinding(binding);
      
      source.properties.value = 200;
      inspector.updateAllBindings();
      
      expect(target.properties.bound).toBe(100); // Should not update
    });
  });

  describe('visibility and layout', () => {
    test('should show and hide inspector', () => {
      expect(inspector.isVisible()).toBe(false);
      
      inspector.show();
      expect(inspector.isVisible()).toBe(true);
      expect(container.querySelector('.property-inspector').style.display).not.toBe('none');
      
      inspector.hide();
      expect(inspector.isVisible()).toBe(false);
      expect(container.querySelector('.property-inspector').style.display).toBe('none');
    });

    test('should toggle visibility', () => {
      expect(inspector.isVisible()).toBe(false);
      
      inspector.toggle();
      expect(inspector.isVisible()).toBe(true);
      
      inspector.toggle();
      expect(inspector.isVisible()).toBe(false);
    });

    test('should support collapsible mode', () => {
      // Create separate container to avoid conflicts
      const collapsibleContainer = document.createElement('div');
      document.body.appendChild(collapsibleContainer);
      
      const collapsibleInspector = new PropertyInspector({
        container: collapsibleContainer,
        collapsible: true
      });
      
      const collapseButton = collapsibleContainer.querySelector('.property-inspector-collapse');
      expect(collapseButton).toBeTruthy();
      
      // Click to collapse
      collapseButton.click();
      expect(collapsibleInspector.isCollapsed()).toBe(true);
      
      // Click to expand
      collapseButton.click();
      expect(collapsibleInspector.isCollapsed()).toBe(false);
      
      collapsibleInspector.destroy();
      document.body.removeChild(collapsibleContainer);
    });

    test('should position inspector panel', () => {
      // Create separate container to avoid conflicts
      const rightContainer = document.createElement('div');
      document.body.appendChild(rightContainer);
      
      const rightInspector = new PropertyInspector({
        container: rightContainer,
        position: 'right',
        width: 300
      });
      
      const panel = rightContainer.querySelector('.property-inspector');
      expect(panel.classList.contains('position-right')).toBe(true);
      expect(panel.style.width).toBe('300px');
      
      rightInspector.destroy();
      document.body.removeChild(rightContainer);
    });
  });

  describe('search and filter', () => {
    test('should filter properties by search term', () => {
      const element = {
        id: 'node-1',
        type: 'node',
        properties: {
          label: 'Test Node',
          backgroundColor: '#ffffff',
          borderColor: '#000000',
          borderWidth: 2,
          fontSize: 14,
          fontFamily: 'Arial'
        }
      };
      
      inspector.selectElement(element);
      inspector.setSearchFilter('color');
      
      // Only color properties should be visible
      const visibleProps = container.querySelectorAll('.property-row:not(.hidden)');
      const visiblePropNames = Array.from(visibleProps).map(el => 
        el.querySelector('[data-property]').getAttribute('data-property')
      );
      
      expect(visiblePropNames).toContain('backgroundColor');
      expect(visiblePropNames).toContain('borderColor');
      expect(visiblePropNames).not.toContain('label');
      expect(visiblePropNames).not.toContain('fontSize');
    });

    test('should clear search filter', () => {
      const element = {
        id: 'node-1',
        type: 'node',
        properties: {
          prop1: 'value1',
          prop2: 'value2',
          prop3: 'value3'
        }
      };
      
      inspector.selectElement(element);
      inspector.setSearchFilter('prop1');
      
      let visibleProps = container.querySelectorAll('.property-row:not(.hidden)');
      expect(visibleProps.length).toBe(1);
      
      inspector.clearSearchFilter();
      
      visibleProps = container.querySelectorAll('.property-row:not(.hidden)');
      expect(visibleProps.length).toBe(3);
    });
  });

  describe('undo/redo integration', () => {
    test('should track property changes for undo', () => {
      const element = {
        id: 'node-1',
        type: 'node',
        properties: { label: 'Original' }
      };
      
      inspector.selectElement(element);
      inspector.enableUndoTracking(true);
      
      inspector.setPropertyValue('label', 'Modified');
      
      const history = inspector.getUndoHistory();
      expect(history).toHaveLength(1);
      expect(history[0]).toMatchObject({
        property: 'label',
        oldValue: 'Original',
        newValue: 'Modified'
      });
    });

    test('should apply undo operation', () => {
      const element = {
        id: 'node-1',
        type: 'node',
        properties: { label: 'Original' }
      };
      
      inspector.selectElement(element);
      inspector.enableUndoTracking(true);
      
      inspector.setPropertyValue('label', 'Modified');
      expect(element.properties.label).toBe('Modified');
      
      inspector.undo();
      expect(element.properties.label).toBe('Original');
    });

    test('should apply redo operation', () => {
      const element = {
        id: 'node-1',
        type: 'node',
        properties: { label: 'Original' }
      };
      
      inspector.selectElement(element);
      inspector.enableUndoTracking(true);
      
      inspector.setPropertyValue('label', 'Modified');
      inspector.undo();
      expect(element.properties.label).toBe('Original');
      
      inspector.redo();
      expect(element.properties.label).toBe('Modified');
    });
  });

  describe('cleanup', () => {
    test('should clean up resources on destroy', () => {
      const element = {
        id: 'node-1',
        type: 'node',
        properties: { label: 'Test' }
      };
      
      inspector.selectElement(element);
      
      const source = { id: 'source', properties: { value: 100 } };
      const target = { id: 'target', properties: { bound: 0 } };
      inspector.createBinding(source, 'value', target, 'bound');
      
      inspector.destroy();
      
      expect(inspector.getSelection()).toBeNull();
      expect(inspector.getAllBindings()).toHaveLength(0);
      expect(container.querySelector('.property-inspector')).toBeFalsy();
    });
  });
});