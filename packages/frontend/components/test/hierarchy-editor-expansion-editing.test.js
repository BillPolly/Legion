/**
 * Comprehensive tests for hierarchy editor expansion/contraction and editing
 * Using jsdom to test actual DOM interactions
 */

import { jest } from '@jest/globals';
import { HierarchyRenderer } from '../src/components/hierarchy-editor/renderer/HierarchyRenderer.js';
import { ExpansionStateManager } from '../src/components/hierarchy-editor/state/ExpansionStateManager.js';
import { JsonHandler } from '../src/components/hierarchy-editor/handlers/JsonHandler.js';
import { HierarchyNode } from '../src/components/hierarchy-editor/model/HierarchyNode.js';

describe('Hierarchy Editor - Expansion and Editing with Real DOM', () => {
  let container;
  let renderer;
  let expansionState;
  let handler;

  beforeEach(() => {
    // Create a real DOM container
    container = document.createElement('div');
    document.body.appendChild(container);
    
    // Create expansion state manager
    expansionState = new ExpansionStateManager({
      defaultExpanded: true
    });
    
    // Create renderer with expansion state
    renderer = new HierarchyRenderer({
      expansionState,
      enableEditing: true
    });
    
    // Create JSON handler
    handler = new JsonHandler();
  });

  afterEach(() => {
    // Clean up DOM
    document.body.removeChild(container);
  });

  describe('Expansion/Contraction with Real DOM', () => {
    test('should render expansion arrows and handle clicks', () => {
      const json = `{
        "name": "root",
        "nested": {
          "level2": {
            "value": "deep"
          }
        },
        "array": [1, 2, 3]
      }`;
      
      const node = handler.parse(json);
      const element = renderer.render(node);
      container.appendChild(element);
      
      // Check that expansion controls are rendered
      const expandControls = container.querySelectorAll('.expand-control');
      expect(expandControls.length).toBe(4); // root, nested, level2, array
      
      // All should be expanded by default
      expandControls.forEach(control => {
        expect(control.textContent).toBe('▼');
        expect(control.getAttribute('data-expanded')).toBe('true');
      });
      
      // Check that all children are visible
      expect(container.querySelectorAll('.node-children').length).toBe(4);
    });

    test('should collapse node when expansion arrow clicked', () => {
      const json = `{
        "parent": {
          "child1": "value1",
          "child2": "value2"
        }
      }`;
      
      const node = handler.parse(json);
      let element = renderer.render(node);
      container.appendChild(element);
      
      // Find the parent node's expansion control
      const parentControl = container.querySelectorAll('.expand-control')[1]; // Second control is for "parent"
      expect(parentControl).toBeTruthy();
      
      // Click to collapse
      parentControl.click();
      
      // Check that control updated
      expect(parentControl.textContent).toBe('▶');
      expect(parentControl.getAttribute('data-expanded')).toBe('false');
      
      // Verify expansion state was updated
      expect(expansionState.isExpanded('parent')).toBe(false);
      
      // Re-render to see collapsed state
      container.innerHTML = '';
      element = renderer.render(node);
      container.appendChild(element);
      
      // Check that children are not rendered
      const parentNode = container.querySelector('[data-node-type="object"]:not(:first-child)');
      const childrenContainer = parentNode.querySelector('.node-children');
      expect(childrenContainer).toBeFalsy();
      
      // Check that collapsed summary is shown
      const summary = parentNode.querySelector('.collapsed-summary');
      expect(summary).toBeTruthy();
      expect(summary.textContent).toBe(' // 2 properties');
    });

    test('should expand collapsed node when arrow clicked', () => {
      const json = `{"items": ["a", "b", "c"]}`;
      const node = handler.parse(json);
      
      // Start with items collapsed
      expansionState.collapse('items');
      
      let element = renderer.render(node);
      container.appendChild(element);
      
      // Find items array control
      const itemsControl = container.querySelectorAll('.expand-control')[1];
      expect(itemsControl.textContent).toBe('▶');
      
      // Click to expand
      itemsControl.click();
      
      // Verify state changed
      expect(itemsControl.textContent).toBe('▼');
      expect(expansionState.isExpanded('items')).toBe(true);
      
      // Re-render
      container.innerHTML = '';
      element = renderer.render(node);
      container.appendChild(element);
      
      // Check children are visible
      const arrayItems = container.querySelectorAll('.array-index');
      expect(arrayItems.length).toBe(3);
      expect(arrayItems[0].textContent).toBe('[0]');
      expect(arrayItems[1].textContent).toBe('[1]');
      expect(arrayItems[2].textContent).toBe('[2]');
    });

    test('should handle nested expansion states independently', () => {
      const json = `{
        "level1": {
          "level2": {
            "level3": {
              "value": "deep"
            }
          }
        }
      }`;
      
      const node = handler.parse(json);
      const element = renderer.render(node);
      container.appendChild(element);
      
      // Get all controls
      const controls = container.querySelectorAll('.expand-control');
      expect(controls.length).toBe(4); // root, level1, level2, level3
      
      // Collapse level2
      controls[2].click();
      expect(expansionState.isExpanded('level1')).toBe(true);
      expect(expansionState.isExpanded('level1.level2')).toBe(false);
      expect(expansionState.isExpanded('level1.level2.level3')).toBe(true); // Still true but not visible
      
      // Re-render
      container.innerHTML = '';
      const newElement = renderer.render(node);
      container.appendChild(newElement);
      
      // level3 should not be visible because level2 is collapsed
      const visibleControls = container.querySelectorAll('.expand-control');
      expect(visibleControls.length).toBe(3); // root, level1, level2 (level3 hidden)
    });

    test('should expand/collapse all functionality', () => {
      const json = `{
        "a": {
          "b": {
            "c": 1
          }
        },
        "d": {
          "e": 2
        }
      }`;
      
      const node = handler.parse(json);
      
      // Collapse all
      expansionState.collapseAll();
      
      let element = renderer.render(node);
      container.appendChild(element);
      
      // Only root should have children visible
      const visibleNodes = container.querySelectorAll('.node-key');
      expect(visibleNodes.length).toBe(2); // Just 'a' and 'd'
      
      // Expand all
      expansionState.expandAll(node);
      
      container.innerHTML = '';
      element = renderer.render(node);
      container.appendChild(element);
      
      // All nodes should be visible
      const allNodes = container.querySelectorAll('.node-key');
      expect(allNodes.length).toBe(5); // a, b, c, d, e
    });
  });

  describe('Inline Editing with Real DOM', () => {
    test('should edit value when clicked', (done) => {
      const json = `{"editable": "originalValue"}`;
      const node = handler.parse(json);
      
      let editData = null;
      renderer.onEdit = (data) => {
        editData = data;
      };
      
      const element = renderer.render(node);
      container.appendChild(element);
      
      // Find the value element
      const valueElement = container.querySelector('.node-value');
      expect(valueElement).toBeTruthy();
      expect(valueElement.textContent).toBe('"originalValue"');
      
      // Click to start editing
      valueElement.click();
      
      // Check that input appears
      const input = container.querySelector('.edit-input');
      expect(input).toBeTruthy();
      expect(input.value).toBe('originalValue');
      expect(valueElement.style.display).toBe('none');
      
      // Change the value
      input.value = 'newValue';
      
      // Press Enter to confirm
      const enterEvent = new KeyboardEvent('keydown', { key: 'Enter' });
      input.dispatchEvent(enterEvent);
      
      // Use setTimeout to allow for any async operations
      setTimeout(() => {
        // Check edit callback was called
        expect(editData).toEqual({
          type: 'value',
          node: expect.objectContaining({
            name: 'editable',
            value: 'originalValue'
          }),
          oldValue: 'originalValue',
          newValue: 'newValue',
          path: expect.any(String)
        });
        
        // Check input was removed and value element restored
        expect(container.querySelector('.edit-input')).toBeFalsy();
        expect(valueElement.style.display).toBe('');
        
        done();
      }, 0);
    });

    test('should edit key when clicked', (done) => {
      const json = `{"editableKey": "value"}`;
      const node = handler.parse(json);
      
      let editData = null;
      renderer.onEdit = (data) => {
        editData = data;
      };
      
      const element = renderer.render(node);
      container.appendChild(element);
      
      // Find the key element
      const keyElement = container.querySelector('.node-key');
      expect(keyElement).toBeTruthy();
      expect(keyElement.textContent).toBe('editableKey: ');
      
      // Click to start editing
      keyElement.click();
      
      // Check that input appears
      const input = container.querySelector('.edit-input.key-edit');
      expect(input).toBeTruthy();
      expect(input.value).toBe('editableKey');
      
      // Change the key
      input.value = 'newKey';
      
      // Press Enter to confirm
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
      
      setTimeout(() => {
        expect(editData).toEqual({
          type: 'key',
          node: expect.objectContaining({
            name: 'editableKey'
          }),
          oldValue: 'editableKey',
          newValue: 'newKey',
          path: expect.any(String)
        });
        
        done();
      }, 0);
    });

    test('should cancel edit on Escape key', () => {
      const json = `{"test": 123}`;
      const node = handler.parse(json);
      
      const element = renderer.render(node);
      container.appendChild(element);
      
      // Start editing value
      const valueElement = container.querySelector('.node-value');
      valueElement.click();
      
      const input = container.querySelector('.edit-input');
      input.value = '456';
      
      // Press Escape
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      
      // Input should be removed
      expect(container.querySelector('.edit-input')).toBeFalsy();
      expect(valueElement.style.display).toBe('');
      expect(valueElement.textContent).toBe('123'); // Original value unchanged
    });

    test('should handle different value types correctly', () => {
      const json = `{
        "string": "text",
        "number": 42,
        "boolean": true,
        "null": null
      }`;
      
      const node = handler.parse(json);
      const element = renderer.render(node);
      container.appendChild(element);
      
      const values = container.querySelectorAll('.node-value');
      
      // String value
      expect(values[0].textContent).toBe('"text"');
      expect(values[0].classList.contains('string-value')).toBe(true);
      
      // Number value
      expect(values[1].textContent).toBe('42');
      expect(values[1].classList.contains('number-value')).toBe(true);
      
      // Boolean value
      expect(values[2].textContent).toBe('true');
      expect(values[2].classList.contains('boolean-value')).toBe(true);
      
      // Null value
      expect(values[3].textContent).toBe('null');
      expect(values[3].classList.contains('null-value')).toBe(true);
    });
  });

  describe('Complex Interaction Scenarios', () => {
    test('should maintain expansion state while editing', () => {
      const json = `{
        "parent": {
          "child": "value"
        }
      }`;
      
      const node = handler.parse(json);
      const element = renderer.render(node);
      container.appendChild(element);
      
      // Collapse parent
      const parentControl = container.querySelectorAll('.expand-control')[1];
      parentControl.click();
      
      expect(expansionState.isExpanded('parent')).toBe(false);
      
      // Start editing a visible value
      const rootValue = container.querySelector('.node-key');
      rootValue.click();
      
      // Expansion state should remain unchanged
      expect(expansionState.isExpanded('parent')).toBe(false);
      
      // Cancel edit
      const input = container.querySelector('.edit-input');
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      
      // Parent should still be collapsed
      expect(expansionState.isExpanded('parent')).toBe(false);
    });

    test('should handle rapid expansion/collapse clicks', () => {
      const json = `{"items": [1, 2, 3, 4, 5]}`;
      const node = handler.parse(json);
      const element = renderer.render(node);
      container.appendChild(element);
      
      const itemsControl = container.querySelectorAll('.expand-control')[1];
      
      // Rapid clicks
      itemsControl.click(); // collapse
      itemsControl.click(); // expand
      itemsControl.click(); // collapse
      itemsControl.click(); // expand
      
      // Final state should be expanded
      expect(itemsControl.textContent).toBe('▼');
      expect(expansionState.isExpanded('items')).toBe(true);
    });

    test('should persist expansion state across re-renders', () => {
      const json = `{
        "section1": {"a": 1, "b": 2},
        "section2": {"c": 3, "d": 4}
      }`;
      
      const node = handler.parse(json);
      
      // Initial render
      let element = renderer.render(node);
      container.appendChild(element);
      
      // Collapse section1, leave section2 expanded
      const section1Control = container.querySelectorAll('.expand-control')[1];
      section1Control.click();
      
      expect(expansionState.isExpanded('section1')).toBe(false);
      expect(expansionState.isExpanded('section2')).toBe(true);
      
      // Clear and re-render
      container.innerHTML = '';
      element = renderer.render(node);
      container.appendChild(element);
      
      // Check states are preserved
      const controls = container.querySelectorAll('.expand-control');
      expect(controls[1].textContent).toBe('▶'); // section1 collapsed
      expect(controls[2].textContent).toBe('▼'); // section2 expanded
      
      // Verify correct nodes are visible
      const visibleKeys = Array.from(container.querySelectorAll('.node-key')).map(el => 
        el.textContent.replace(': ', '')
      );
      expect(visibleKeys).toContain('section1');
      expect(visibleKeys).toContain('section2');
      expect(visibleKeys).not.toContain('a'); // hidden
      expect(visibleKeys).not.toContain('b'); // hidden
      expect(visibleKeys).toContain('c'); // visible
      expect(visibleKeys).toContain('d'); // visible
    });
  });
});