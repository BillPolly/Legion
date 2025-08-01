/**
 * Debug inline editing
 */

import { JsonHandler } from '../src/components/hierarchy-editor/handlers/JsonHandler.js';
import { HierarchyRenderer } from '../src/components/hierarchy-editor/renderer/HierarchyRenderer.js';
import { ExpansionStateManager } from '../src/components/hierarchy-editor/state/ExpansionStateManager.js';

describe('Debug Inline Editing', () => {
  test('check editing mechanism', () => {
    const container = document.createElement('div');
    const handler = new JsonHandler();
    const expansionState = new ExpansionStateManager();
    const renderer = new HierarchyRenderer({ expansionState, enableEditing: true });
    
    const json = '{"test": "value"}';
    const node = handler.parse(json);
    const element = renderer.render(node);
    container.appendChild(element);
    
    console.log('HTML:', container.innerHTML);
    
    // Find value element
    const valueElement = container.querySelector('.node-value');
    console.log('Value element:', valueElement);
    console.log('Value element editable:', valueElement?.getAttribute('data-editable'));
    console.log('Value element text:', valueElement?.textContent);
    
    // Try to trigger click
    if (valueElement) {
      const clickEvent = new MouseEvent('click', { bubbles: true });
      valueElement.dispatchEvent(clickEvent);
      
      // Check for input after click
      setTimeout(() => {
        const input = container.querySelector('.edit-input');
        console.log('Input after click:', input);
        console.log('All inputs:', container.querySelectorAll('input'));
      }, 0);
    }
  });
});