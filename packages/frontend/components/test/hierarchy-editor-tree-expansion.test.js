/**
 * @jest-environment jsdom
 */

import { HierarchyEditorDemo } from '../src/components/hierarchy-editor-demo/index.js';

describe('HierarchyEditorDemo Tree Expansion Tests', () => {
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
  
  test('should show expand arrows for objects and arrays', async () => {
    const demo = HierarchyEditorDemo.create({
      dom: container
    });
    
    await waitForRender();
    
    // Load test data with nested structures
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
    
    // Should have expand arrows for object and array
    const expandArrows = basicContainer.querySelectorAll('.expand-arrow');
    expect(expandArrows.length).toBeGreaterThan(0);
    
    // Check specific expand arrows exist
    const objectArrow = basicContainer.querySelector('.expand-arrow[data-expand-path="objectWithChildren"]');
    const arrayArrow = basicContainer.querySelector('.expand-arrow[data-expand-path="arrayWithItems"]');
    
    expect(objectArrow).toBeTruthy();
    expect(arrayArrow).toBeTruthy();
    
    // Arrows should be in expanded state initially (▼)
    expect(objectArrow.textContent).toBe('▼');
    expect(arrayArrow.textContent).toBe('▼');
    
    demo.destroy();
  });
  
  test('should collapse and expand objects when arrow clicked', async () => {
    const demo = HierarchyEditorDemo.create({
      dom: container
    });
    
    await waitForRender();
    
    const basicEditor = demo.getEditorInstance('basic');
    const testData = {
      "parent": {
        "child1": "value1",
        "child2": "value2",
        "grandparent": {
          "grandchild": "deep value"
        }
      }
    };
    
    basicEditor.loadContent(JSON.stringify(testData, null, 2));
    await waitForRender();
    
    const basicContainer = container.querySelector('[data-editor-container="basic"]');
    
    // Initially expanded - should see child elements
    let child1Element = basicContainer.querySelector('.editable-value[data-path="parent.child1"]');
    let child2Element = basicContainer.querySelector('.editable-value[data-path="parent.child2"]');
    expect(child1Element).toBeTruthy();
    expect(child2Element).toBeTruthy();
    
    // Click to collapse
    const parentArrow = basicContainer.querySelector('.expand-arrow[data-expand-path="parent"]');
    expect(parentArrow).toBeTruthy();
    expect(parentArrow.textContent).toBe('▼'); // Initially expanded
    
    parentArrow.click();
    await waitForRender();
    
    // After collapse - arrow should change and children should be hidden
    const collapsedArrow = basicContainer.querySelector('.expand-arrow[data-expand-path="parent"]');
    expect(collapsedArrow.textContent).toBe('▶'); // Now collapsed
    
    // Children should no longer be visible
    child1Element = basicContainer.querySelector('.editable-value[data-path="parent.child1"]');
    child2Element = basicContainer.querySelector('.editable-value[data-path="parent.child2"]');
    expect(child1Element).toBeFalsy();
    expect(child2Element).toBeFalsy();
    
    // Should show summary instead
    const summaryElement = basicContainer.querySelector('[data-expand-path="parent"]');
    expect(summaryElement.textContent).toContain('properties');
    
    // Click to expand again
    collapsedArrow.click();
    await waitForRender();
    
    // Should be expanded again
    const reExpandedArrow = basicContainer.querySelector('.expand-arrow[data-expand-path="parent"]');
    expect(reExpandedArrow.textContent).toBe('▼');
    
    // Children should be visible again
    child1Element = basicContainer.querySelector('.editable-value[data-path="parent.child1"]');
    child2Element = basicContainer.querySelector('.editable-value[data-path="parent.child2"]');
    expect(child1Element).toBeTruthy();
    expect(child2Element).toBeTruthy();
    
    demo.destroy();
  });
  
  test('should handle array expansion and collapse', async () => {
    const demo = HierarchyEditorDemo.create({
      dom: container
    });
    
    await waitForRender();
    
    const basicEditor = demo.getEditorInstance('basic');
    const testData = {
      "items": [
        "string item",
        42,
        { "objectInArray": "nested value" },
        ["nested", "array"]
      ]
    };
    
    basicEditor.loadContent(JSON.stringify(testData, null, 2));
    await waitForRender();
    
    const basicContainer = container.querySelector('[data-editor-container="basic"]');
    
    // Initially expanded - should see array items
    let item0 = basicContainer.querySelector('.editable-value[data-path="items[0]"]');
    let item1 = basicContainer.querySelector('.editable-value[data-path="items[1]"]');
    expect(item0).toBeTruthy();
    expect(item1).toBeTruthy();
    
    // Click to collapse array
    const arrayArrow = basicContainer.querySelector('.expand-arrow[data-expand-path="items"]');
    expect(arrayArrow.textContent).toBe('▼');
    
    arrayArrow.click();
    await waitForRender();
    
    // Should be collapsed
    const collapsedArrow = basicContainer.querySelector('.expand-arrow[data-expand-path="items"]');
    expect(collapsedArrow.textContent).toBe('▶');
    
    // Array items should be hidden
    item0 = basicContainer.querySelector('.editable-value[data-path="items[0]"]');
    item1 = basicContainer.querySelector('.editable-value[data-path="items[1]"]');
    expect(item0).toBeFalsy();
    expect(item1).toBeFalsy();
    
    // Should show item count summary
    const summaryElement = basicContainer.querySelector('[data-expand-path="items"]');
    expect(summaryElement.textContent).toContain('4 items');
    
    demo.destroy();
  });
  
  test('should support expand all and collapse all functionality', async () => {
    const demo = HierarchyEditorDemo.create({
      dom: container
    });
    
    await waitForRender();
    
    const basicEditor = demo.getEditorInstance('basic');
    const testData = {
      "level1": {
        "level2": {
          "level3": {
            "deepValue": "very deep"
          }
        },
        "sibling": ["item1", "item2"]
      },
      "anotherTop": {
        "more": "data"
      }
    };
    
    basicEditor.loadContent(JSON.stringify(testData, null, 2));
    await waitForRender();
    
    const basicContainer = container.querySelector('[data-editor-container="basic"]');
    
    // Collapse all first
    basicEditor.collapseAll();
    await waitForRender();
    
    // All arrows should be collapsed (▶)
    const allArrows = basicContainer.querySelectorAll('.expand-arrow');
    allArrows.forEach(arrow => {
      expect(arrow.textContent).toBe('▶');
    });
    
    // Deep values should not be visible
    let deepValue = basicContainer.querySelector('.editable-value[data-path="level1.level2.level3.deepValue"]');
    expect(deepValue).toBeFalsy();
    
    // Expand all
    basicEditor.expandAll();
    await waitForRender();
    
    // All arrows should be expanded (▼)
    const allArrowsExpanded = basicContainer.querySelectorAll('.expand-arrow');
    allArrowsExpanded.forEach(arrow => {
      expect(arrow.textContent).toBe('▼');
    });
    
    // Deep values should be visible
    deepValue = basicContainer.querySelector('.editable-value[data-path="level1.level2.level3.deepValue"]');
    expect(deepValue).toBeTruthy();
    expect(deepValue.textContent).toContain('very deep');
    
    demo.destroy();
  });
  
  test('should maintain expansion state during editing', async () => {
    const demo = HierarchyEditorDemo.create({
      dom: container
    });
    
    await waitForRender();
    
    const basicEditor = demo.getEditorInstance('basic');
    const testData = {
      "settings": {
        "theme": "light",
        "nested": {
          "deepSetting": "value"
        }
      }
    };
    
    basicEditor.loadContent(JSON.stringify(testData, null, 2));
    await waitForRender();
    
    const basicContainer = container.querySelector('[data-editor-container="basic"]');
    
    // Collapse the nested object
    const nestedArrow = basicContainer.querySelector('.expand-arrow[data-expand-path="settings.nested"]');
    nestedArrow.click();
    await waitForRender();
    
    expect(nestedArrow.textContent).toBe('▶'); // Collapsed
    
    // Edit a value in the parent
    const themeValue = basicContainer.querySelector('.editable-value[data-path="settings.theme"]');
    themeValue.click();
    await waitForRender();
    
    const input = themeValue.nextSibling;
    input.value = 'dark';
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    
    await waitForRender();
    
    // The nested object should still be collapsed after the edit
    const nestedArrowAfterEdit = basicContainer.querySelector('.expand-arrow[data-expand-path="settings.nested"]');
    expect(nestedArrowAfterEdit.textContent).toBe('▶'); // Still collapsed
    
    // Deep value should not be visible
    const deepSetting = basicContainer.querySelector('.editable-value[data-path="settings.nested.deepSetting"]');
    expect(deepSetting).toBeFalsy();
    
    demo.destroy();
  });
  
  test('should handle clicking on summary text to expand', async () => {
    const demo = HierarchyEditorDemo.create({
      dom: container
    });
    
    await waitForRender();
    
    const basicEditor = demo.getEditorInstance('basic');
    const testData = {
      "collapsed": {
        "prop1": "value1",
        "prop2": "value2",
        "prop3": "value3"
      }
    };
    
    basicEditor.loadContent(JSON.stringify(testData, null, 2));
    await waitForRender();
    
    const basicContainer = container.querySelector('[data-editor-container="basic"]');
    
    // Collapse the object
    const arrow = basicContainer.querySelector('.expand-arrow[data-expand-path="collapsed"]');
    arrow.click();
    await waitForRender();
    
    // Should show summary text
    const summaryText = basicContainer.querySelector('[data-expand-path="collapsed"]:not(.expand-arrow)');
    expect(summaryText).toBeTruthy();
    expect(summaryText.textContent).toContain('3 properties');
    
    // Click on summary text should expand
    summaryText.click();
    await waitForRender();
    
    // Should be expanded again
    const expandedArrow = basicContainer.querySelector('.expand-arrow[data-expand-path="collapsed"]');
    expect(expandedArrow.textContent).toBe('▼');
    
    // Properties should be visible
    const prop1 = basicContainer.querySelector('.editable-value[data-path="collapsed.prop1"]');
    expect(prop1).toBeTruthy();
    
    demo.destroy();
  });
  
  test('should prevent editing arrows from triggering edits', async () => {
    const demo = HierarchyEditorDemo.create({
      dom: container
    });
    
    await waitForRender();
    
    const basicEditor = demo.getEditorInstance('basic');
    const testData = {
      "parent": {
        "child": "value"
      }
    };
    
    basicEditor.loadContent(JSON.stringify(testData, null, 2));
    await waitForRender();
    
    const basicContainer = container.querySelector('[data-editor-container="basic"]');
    
    // Click on arrow should not trigger edit mode
    const arrow = basicContainer.querySelector('.expand-arrow[data-expand-path="parent"]');
    arrow.click();
    await waitForRender();
    
    // Should not have created any input elements
    const inputs = basicContainer.querySelectorAll('input');
    expect(inputs.length).toBe(0);
    
    // Should have changed expansion state
    expect(arrow.textContent).toBe('▶'); // Collapsed
    
    demo.destroy();
  });
});