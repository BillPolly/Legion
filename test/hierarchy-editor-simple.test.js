/**
 * Simple debug test for hierarchy editor
 */

import { JsonHandler } from '../src/components/hierarchy-editor/handlers/JsonHandler.js';
import { HierarchyRenderer } from '../src/components/hierarchy-editor/renderer/HierarchyRenderer.js';
import { ExpansionStateManager } from '../src/components/hierarchy-editor/state/ExpansionStateManager.js';

describe('Simple Hierarchy Editor Test', () => {
  test('should render basic JSON structure', () => {
    const container = document.createElement('div');
    const handler = new JsonHandler();
    const expansionState = new ExpansionStateManager();
    const renderer = new HierarchyRenderer({ expansionState, enableEditing: true });
    
    const json = '{"name": "test", "value": 123}';
    const node = handler.parse(json);
    
    console.log('Parsed node type:', node.type);
    console.log('Parsed node name:', node.name);
    console.log('Parsed node children count:', node.children ? node.children.length : 0);
    
    const element = renderer.render(node);
    container.appendChild(element);
    
    console.log('Rendered HTML:', container.innerHTML);
    
    // Debug what's in the DOM
    const nodes = container.querySelectorAll('.hierarchy-node');
    console.log('Number of hierarchy nodes:', nodes.length);
    
    const keys = container.querySelectorAll('.node-key');
    console.log('Number of keys:', keys.length);
    keys.forEach(key => console.log('Key text:', key.textContent));
    
    const values = container.querySelectorAll('.node-value');
    console.log('Number of values:', values.length);
    values.forEach(val => console.log('Value text:', val.textContent));
    
    const expandControls = container.querySelectorAll('.expand-control');
    console.log('Number of expand controls:', expandControls.length);
    
    expect(container.querySelector('.hierarchy-root')).toBeTruthy();
  });
});