/**
 * Fixed tests for hierarchy editor expansion/contraction and editing
 */

import { jest } from '@jest/globals';
import { HierarchyRenderer } from '../src/components/hierarchy-editor/renderer/HierarchyRenderer.js';
import { ExpansionStateManager } from '../src/components/hierarchy-editor/state/ExpansionStateManager.js';
import { JsonHandler } from '../src/components/hierarchy-editor/handlers/JsonHandler.js';

describe('Hierarchy Editor - Working Tests', () => {
  let container;
  let renderer;
  let expansionState;
  let handler;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    expansionState = new ExpansionStateManager({ defaultExpanded: true });
    renderer = new HierarchyRenderer({ expansionState, enableEditing: true });
    handler = new JsonHandler();
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  test('should render nested objects with expansion controls', () => {
    const json = `{
      "nested": {
        "level2": {
          "value": "deep"
        }
      }
    }`;
    
    const node = handler.parse(json);
    const element = renderer.render(node, { formatHandler: handler });
    container.appendChild(element);
    
    // Root is rendered specially, so look for nested and level2
    const expandControls = container.querySelectorAll('.expand-control');
    console.log('Expand controls found:', expandControls.length);
    
    // Should have controls for 'nested' and 'level2'
    expect(expandControls.length).toBeGreaterThan(0);
    
    // Check the nested object has an expand control
    const nestedNode = container.querySelector('[data-node-type="object"]');
    const nestedControl = nestedNode?.querySelector('.expand-control');
    expect(nestedControl).toBeTruthy();
    expect(nestedControl.textContent).toBe('▼');
  });

  test('should collapse and expand nodes', () => {
    const json = `{
      "collapsible": {
        "child1": "value1",
        "child2": "value2"
      }
    }`;
    
    const node = handler.parse(json);
    let element = renderer.render(node);
    container.appendChild(element);
    
    // Find the collapsible object's expand control
    const collapsibleNode = container.querySelector('[data-node-type="object"]');
    const expandControl = collapsibleNode.querySelector('.expand-control');
    
    expect(expandControl).toBeTruthy();
    expect(expandControl.textContent).toBe('▼');
    
    // Check children are visible
    let childKeys = container.querySelectorAll('.node-key');
    const childKeyTexts = Array.from(childKeys).map(k => k.textContent.replace(': ', ''));
    expect(childKeyTexts).toContain('child1');
    expect(childKeyTexts).toContain('child2');
    
    // Click to collapse
    expandControl.click();
    expect(expandControl.textContent).toBe('▶');
    expect(expansionState.isExpanded('collapsible')).toBe(false);
    
    // Re-render
    container.innerHTML = '';
    element = renderer.render(node);
    container.appendChild(element);
    
    // Check children are hidden
    childKeys = container.querySelectorAll('.node-key');
    const newChildKeyTexts = Array.from(childKeys).map(k => k.textContent.replace(': ', ''));
    expect(newChildKeyTexts).toContain('collapsible');
    expect(newChildKeyTexts).not.toContain('child1');
    expect(newChildKeyTexts).not.toContain('child2');
    
    // Check collapsed summary
    const summary = container.querySelector('.collapsed-summary');
    expect(summary).toBeTruthy();
    expect(summary.textContent).toBe(' // 2 properties');
  });

  test('should handle array expansion', () => {
    const json = `{
      "items": [
        {"id": 1, "name": "first"},
        {"id": 2, "name": "second"}
      ]
    }`;
    
    const node = handler.parse(json);
    const element = renderer.render(node, { formatHandler: handler });
    container.appendChild(element);
    
    // Find the items array
    const arrayNode = container.querySelector('[data-node-type="array"]');
    expect(arrayNode).toBeTruthy();
    
    const arrayControl = arrayNode.querySelector('.expand-control');
    expect(arrayControl).toBeTruthy();
    expect(arrayControl.textContent).toBe('▼');
    
    // Check array indices are shown
    const indices = container.querySelectorAll('.array-index');
    expect(indices.length).toBe(2);
    expect(indices[0].textContent).toBe('[0]');
    expect(indices[1].textContent).toBe('[1]');
    
    // Collapse array
    arrayControl.click();
    expect(expansionState.isExpanded('items')).toBe(false);
    
    // Re-render
    container.innerHTML = '';
    const newElement = renderer.render(node);
    container.appendChild(newElement);
    
    // Check summary shows
    const summary = container.querySelector('.collapsed-summary');
    expect(summary).toBeTruthy();
    expect(summary.textContent).toBe(' // 2 items');
  });

  test('should edit values inline', (done) => {
    const json = `{"editable": "originalValue"}`;
    const node = handler.parse(json);
    
    let editData = null;
    renderer.onEdit = (data) => { editData = data; };
    
    const element = renderer.render(node, { formatHandler: handler });
    container.appendChild(element);
    
    // Find and click the value
    const valueElement = container.querySelector('.node-value');
    expect(valueElement).toBeTruthy();
    expect(valueElement.textContent).toBe('"originalValue"');
    
    valueElement.click();
    
    // Check input appears
    const input = container.querySelector('.edit-input');
    expect(input).toBeTruthy();
    expect(input.value).toBe('originalValue');
    
    // Change value
    input.value = 'newValue';
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    
    setTimeout(() => {
      expect(editData).toBeTruthy();
      expect(editData.newValue).toBe('newValue');
      done();
    }, 10);
  });

  test('should expand all and collapse all', () => {
    const json = `{
      "level1a": {
        "level2a": {"value": 1}
      },
      "level1b": {
        "level2b": {"value": 2}
      }
    }`;
    
    const node = handler.parse(json);
    
    // Start with all collapsed
    expansionState.collapseAll();
    
    let element = renderer.render(node);
    container.appendChild(element);
    
    // Only top level should be visible
    let visibleKeys = Array.from(container.querySelectorAll('.node-key'))
      .map(k => k.textContent.replace(': ', ''));
    expect(visibleKeys).toEqual(['level1a', 'level1b']);
    
    // Expand all
    expansionState.expandAll(node);
    
    container.innerHTML = '';
    element = renderer.render(node);
    container.appendChild(element);
    
    // All should be visible
    visibleKeys = Array.from(container.querySelectorAll('.node-key'))
      .map(k => k.textContent.replace(': ', ''));
    expect(visibleKeys).toContain('level1a');
    expect(visibleKeys).toContain('level2a');
    expect(visibleKeys).toContain('value');
    expect(visibleKeys).toContain('level1b');
    expect(visibleKeys).toContain('level2b');
  });

  test('should maintain expansion state across re-renders', () => {
    const json = `{
      "keepOpen": {"a": 1},
      "keepClosed": {"b": 2}
    }`;
    
    const node = handler.parse(json);
    let element = renderer.render(node);
    container.appendChild(element);
    
    // Find and collapse keepClosed
    const nodes = container.querySelectorAll('[data-node-type="object"]');
    const keepClosedNode = Array.from(nodes).find(n => 
      n.querySelector('.node-key')?.textContent.includes('keepClosed')
    );
    
    const control = keepClosedNode.querySelector('.expand-control');
    control.click();
    
    expect(expansionState.isExpanded('keepOpen')).toBe(true);
    expect(expansionState.isExpanded('keepClosed')).toBe(false);
    
    // Re-render multiple times
    for (let i = 0; i < 3; i++) {
      container.innerHTML = '';
      element = renderer.render(node);
      container.appendChild(element);
      
      // Check state is preserved
      const visibleKeys = Array.from(container.querySelectorAll('.node-key'))
        .map(k => k.textContent.replace(': ', ''));
      
      expect(visibleKeys).toContain('keepOpen');
      expect(visibleKeys).toContain('a'); // child of keepOpen
      expect(visibleKeys).toContain('keepClosed');
      expect(visibleKeys).not.toContain('b'); // child of keepClosed
    }
  });
});