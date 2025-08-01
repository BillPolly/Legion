/**
 * @jest-environment jsdom
 */

import { HierarchyEditorDemo } from '../src/components/hierarchy-editor-demo/index.js';

describe('HierarchyEditorDemo Reality Check - What Does the User Actually See?', () => {
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
  
  const waitForRender = () => new Promise(resolve => setTimeout(resolve, 200));
  
  test('REALITY CHECK: What does the user actually see when they load the app?', async () => {
    console.log('=== STARTING REALITY CHECK ===');
    
    const demo = HierarchyEditorDemo.create({
      dom: container
    });
    
    await waitForRender();
    
    console.log('=== FULL HTML OUTPUT ===');
    console.log(container.innerHTML);
    console.log('=== END HTML OUTPUT ===');
    
    // Check what's actually in the basic editor
    const basicContainer = container.querySelector('[data-editor-container="basic"]');
    console.log('=== BASIC EDITOR CONTENT ===');
    console.log('HTML:', basicContainer.innerHTML);
    console.log('TEXT:', basicContainer.textContent);
    console.log('=== END BASIC EDITOR ===');
    
    demo.destroy();
  });
  
  test('REALITY CHECK: What happens when user loads a JSON file?', async () => {
    console.log('=== FILE LOADING TEST ===');
    
    // Mock fetch to return real JSON
    const testJson = {
      "name": "Test Project",
      "version": "1.0.0",
      "nested": {
        "property": "value",
        "number": 42,
        "boolean": true
      },
      "array": ["item1", "item2", "item3"]
    };
    
    global.fetch = () => Promise.resolve({
      ok: true,
      text: () => Promise.resolve(JSON.stringify(testJson, null, 2))
    });
    
    const demo = HierarchyEditorDemo.create({
      dom: container
    });
    
    await waitForRender();
    
    // Load file via dropdown
    const dropdown = container.querySelector('[data-demo="basic"] select[data-action="load-server-file"]');
    dropdown.value = '/data/samples/package.json';
    dropdown.dispatchEvent(new Event('change', { bubbles: true }));
    
    await waitForRender();
    
    const basicContainer = container.querySelector('[data-editor-container="basic"]');
    console.log('=== AFTER LOADING JSON FILE ===');
    console.log('HTML:', basicContainer.innerHTML);
    console.log('TEXT:', basicContainer.textContent);
    console.log('=== END AFTER LOADING ===');
    
    // Check for hierarchical structure
    console.log('=== CHECKING FOR HIERARCHY ===');
    const treeView = basicContainer.querySelector('.tree-view');
    if (treeView) {
      console.log('Tree view found:', treeView.innerHTML);
    } else {
      console.log('NO TREE VIEW FOUND!');
    }
    
    // Check for editable values
    const editableValues = basicContainer.querySelectorAll('.editable-value');
    console.log(`Found ${editableValues.length} editable values`);
    editableValues.forEach((value, i) => {
      console.log(`Editable ${i}: path="${value.dataset.path}" type="${value.dataset.type}" text="${value.textContent}"`);
    });
    
    delete global.fetch;
    demo.destroy();
  });
  
  test('REALITY CHECK: Does click-to-edit actually work?', async () => {
    console.log('=== CLICK TO EDIT TEST ===');
    
    const demo = HierarchyEditorDemo.create({
      dom: container
    });
    
    await waitForRender();
    
    const basicContainer = container.querySelector('[data-editor-container="basic"]');
    const editableValues = basicContainer.querySelectorAll('.editable-value');
    
    if (editableValues.length === 0) {
      console.log('ERROR: NO EDITABLE VALUES FOUND!');
      console.log('Basic container content:', basicContainer.innerHTML);
      expect(editableValues.length).toBeGreaterThan(0);
      return;
    }
    
    const firstEditable = editableValues[0];
    console.log('=== BEFORE CLICK ===');
    console.log('Editable element:', firstEditable.outerHTML);
    console.log('Text content:', firstEditable.textContent);
    console.log('Data path:', firstEditable.dataset.path);
    
    // Click to edit
    console.log('=== CLICKING TO EDIT ===');
    firstEditable.click();
    
    await waitForRender();
    
    console.log('=== AFTER CLICK ===');
    console.log('Next sibling:', firstEditable.nextSibling?.outerHTML || 'NONE');
    console.log('Parent HTML:', firstEditable.parentElement.innerHTML);
    
    // Check if input was created
    const input = firstEditable.nextSibling;
    if (input && input.tagName === 'INPUT') {
      console.log('SUCCESS: Input field created!');
      console.log('Input type:', input.type);
      console.log('Input value:', input.value);
      
      // Try to edit
      input.value = 'EDITED_VALUE';
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
      
      await waitForRender();
      
      console.log('=== AFTER EDITING ===');
      console.log('Updated element:', firstEditable.outerHTML);
      console.log('Updated text:', firstEditable.textContent);
    } else {
      console.log('ERROR: NO INPUT FIELD CREATED!');
      console.log('All elements in container:', basicContainer.innerHTML);
    }
    
    demo.destroy();
  });
  
  test('REALITY CHECK: Is the layout actually hierarchical?', async () => {
    console.log('=== HIERARCHY LAYOUT TEST ===');
    
    const demo = HierarchyEditorDemo.create({
      dom: container
    });
    
    await waitForRender();
    
    // Load hierarchical data
    const basicEditor = demo.getEditorInstance('basic');
    const hierarchicalData = {
      "root": {
        "level1": {
          "level2": {
            "level3": "deep value"
          },
          "sibling": "sibling value"
        },
        "array": [
          {"item": 1},
          {"item": 2}
        ]
      }
    };
    
    basicEditor.loadContent(JSON.stringify(hierarchicalData, null, 2));
    
    await waitForRender();
    
    const basicContainer = container.querySelector('[data-editor-container="basic"]');
    console.log('=== HIERARCHICAL DATA RENDERING ===');
    console.log('Full HTML:', basicContainer.innerHTML);
    
    // Check for indentation or hierarchical structure
    const treeView = basicContainer.querySelector('.tree-view');
    if (treeView) {
      console.log('=== TREE VIEW CONTENT ===');
      console.log(treeView.innerHTML);
      
      // Look for indentation patterns
      const hasIndentation = treeView.innerHTML.includes('  ') || treeView.innerHTML.includes('&nbsp;');
      const hasNestedDivs = treeView.querySelectorAll('div').length > 1;
      const hasBrTags = treeView.innerHTML.includes('<br>');
      
      console.log('Has indentation spaces:', hasIndentation);
      console.log('Has nested divs:', hasNestedDivs);
      console.log('Has <br> tags:', hasBrTags);
      console.log('Number of div elements:', treeView.querySelectorAll('div').length);
    } else {
      console.log('ERROR: NO TREE VIEW FOUND!');
    }
    
    demo.destroy();
  });
});