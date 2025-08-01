/**
 * @jest-environment jsdom
 */

import { HierarchyEditorDemo } from '../src/components/hierarchy-editor-demo/index.js';

describe('Debug Tree Expansion', () => {
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
  
  test('DEBUG: what is actually rendered with expansion arrows?', async () => {
    const demo = HierarchyEditorDemo.create({
      dom: container
    });
    
    await waitForRender();
    
    // Load the exact test data from the failing test
    const basicEditor = demo.getEditorInstance('basic');
    const testData = {
      "simpleValue": "no arrow here",
      "objectWithChildren": {
        "child1": "value1",
        "child2": "value2"
      },
      "arrayWithItems": [
        "item1",
        "item2",
        { "nestedInArray": "value" }
      ]
    };
    
    basicEditor.loadContent(JSON.stringify(testData, null, 2));
    await waitForRender();
    
    const basicContainer = container.querySelector('[data-editor-container="basic"]');
    
    console.log('=== FULL RENDERED HTML ===');
    console.log(basicContainer.innerHTML);
    console.log('=== END RENDERED HTML ===');
    
    const allArrows = basicContainer.querySelectorAll('.expand-arrow');
    console.log('Number of expand arrows found:', allArrows.length);
    
    allArrows.forEach((arrow, i) => {
      console.log(`Arrow ${i}:`, arrow.outerHTML);
      console.log(`Arrow ${i} path:`, arrow.dataset.expandPath);
      console.log(`Arrow ${i} text:`, arrow.textContent);
    });
    
    demo.destroy();
  });
});