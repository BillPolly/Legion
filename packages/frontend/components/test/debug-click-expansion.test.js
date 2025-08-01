/**
 * @jest-environment jsdom
 */

import { HierarchyEditorDemo } from '../src/components/hierarchy-editor-demo/index.js';

describe('Debug Click Expansion', () => {
  let container;
  
  beforeEach(() => {
    container = document.createElement('div');
    container.style.width = '1000px';
    container.style.height = '800px';
    document.body.appendChild(container);
  });
  
  afterEach(() => {
    if (container.parentNode) {
      container.parentNode.removeChild(container);
    }
  });
  
  const waitForRender = () => new Promise(resolve => setTimeout(resolve, 150));
  
  test('DEBUG: what happens to DOM when arrow is clicked?', async () => {
    const demo = HierarchyEditorDemo.create({
      dom: container
    });
    
    await waitForRender();
    
    // Load simple test data
    const basicEditor = demo.getEditorInstance('basic');
    const testData = {
      "parent": {
        "child": "value"
      }
    };
    
    basicEditor.loadContent(JSON.stringify(testData, null, 2));
    await waitForRender();
    
    const basicContainer = container.querySelector('[data-editor-container="basic"]');
    
    console.log('=== BEFORE CLICK ===');
    const beforeArrow = basicContainer.querySelector('.expand-arrow[data-expand-path="parent"]');
    console.log('Before arrow exists:', !!beforeArrow);
    console.log('Before arrow text:', beforeArrow ? beforeArrow.textContent : 'N/A');
    
    const beforeChild = basicContainer.querySelector('.editable-value[data-path="parent.child"]');
    console.log('Before child exists:', !!beforeChild);
    
    // Click the arrow
    if (beforeArrow) {
      console.log('=== CLICKING ARROW ===');
      beforeArrow.click();
      await waitForRender();
    }
    
    console.log('=== AFTER CLICK ===');
    const afterArrow = basicContainer.querySelector('.expand-arrow[data-expand-path="parent"]');
    console.log('After arrow exists:', !!afterArrow);
    console.log('After arrow text:', afterArrow ? afterArrow.textContent : 'N/A');
    
    const afterChild = basicContainer.querySelector('.editable-value[data-path="parent.child"]');
    console.log('After child exists:', !!afterChild);
    
    // Let's also check if the expandedNodes set was updated properly
    console.log('=== EDITOR INTERNAL STATE ===');
    console.log('Expanded nodes size:', basicEditor._expandedNodes ? basicEditor._expandedNodes.size : 'N/A');
    if (basicEditor._expandedNodes) {
      console.log('Expanded nodes contents:', Array.from(basicEditor._expandedNodes));
    }
    
    demo.destroy();
  });
});