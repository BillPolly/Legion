/**
 * Integration test for HierarchyEditorDemo with real HierarchyEditor component
 */

import { HierarchyEditorDemo } from '../src/components/hierarchy-editor-demo/index.js';

describe('HierarchyEditorDemo - Real Component Integration', () => {
  let container;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  test('XML format - renders with expansion controls and is editable', async () => {
    const demo = HierarchyEditorDemo.create({ dom: container });
    await new Promise(resolve => setTimeout(resolve, 100));

    // Load XML content
    const xmlCard = container.querySelector('.sample-data-card[data-format="xml"]');
    
    xmlCard.click();
    await new Promise(resolve => setTimeout(resolve, 200));

    // Check that XML content is rendered in the format demo
    const formatContainer = container.querySelector('[data-editor-container="format"]');
    const formatDemo = formatContainer?.querySelector('.he-tree-view');
    console.log('Format demo HTML:', formatDemo?.innerHTML);
    
    const nodes = formatDemo?.querySelectorAll('.hierarchy-node');
    console.log('XML nodes found:', nodes?.length);

    const expandControls = formatDemo?.querySelectorAll('.expand-control');
    console.log('XML expand controls:', expandControls?.length);

    // Check for XML-specific elements
    const xmlElements = formatDemo?.querySelectorAll('[data-node-type="element"]');
    console.log('XML element nodes:', xmlElements?.length);

    // Try to find an editable value
    const editableValues = formatDemo?.querySelectorAll('.node-value[data-editable="true"]');
    console.log('Editable values:', editableValues?.length);

    expect(nodes?.length || 0).toBeGreaterThan(0);
    expect(expandControls?.length || 0).toBeGreaterThan(0);
    
    demo.destroy();
  });

  test('YAML format - renders without errors', async () => {
    const demo = HierarchyEditorDemo.create({ dom: container });
    await new Promise(resolve => setTimeout(resolve, 100));

    // Capture console errors
    const originalError = console.error;
    const errors = [];
    console.error = (...args) => {
      errors.push(args.join(' '));
      originalError(...args);
    };

    // Load YAML content
    const yamlCard = container.querySelector('.sample-data-card[data-format="yaml"]');
    yamlCard.click();
    await new Promise(resolve => setTimeout(resolve, 200));

    console.error = originalError;

    // Check YAML content
    const formatContainer = container.querySelector('[data-editor-container="format"]');
    const formatDemo = formatContainer?.querySelector('.he-tree-view');
    console.log('YAML demo HTML:', formatDemo?.innerHTML);
    
    const nodes = formatDemo?.querySelectorAll('.hierarchy-node');
    console.log('YAML nodes found:', nodes?.length);
    console.log('YAML errors:', errors);

    expect(errors.filter(e => e.includes('Unknown node type')).length).toBe(0);
    expect(nodes?.length || 0).toBeGreaterThan(0);

    demo.destroy();
  });

  test('JSON editing saves properly', async () => {
    const demo = HierarchyEditorDemo.create({ dom: container });
    await new Promise(resolve => setTimeout(resolve, 100));

    // Work with edit demo which has JSON by default
    const editContainer = container.querySelector('[data-editor-container="edit"]');
    const editDemo = editContainer?.querySelector('.he-tree-view');
    console.log('Edit demo HTML:', editDemo?.innerHTML);

    // Find an editable value
    const editableValue = editDemo?.querySelector('.node-value[data-editable="true"]');
    console.log('Found editable value:', editableValue?.textContent);

    if (editableValue) {
      // Click to edit
      editableValue.click();
      await new Promise(resolve => setTimeout(resolve, 50));

      // Check for edit input
      const input = editDemo.querySelector('.edit-input');
      console.log('Edit input found:', !!input);

      if (input) {
        const originalValue = input.value;
        input.value = 'newTestValue';
        input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
        await new Promise(resolve => setTimeout(resolve, 100));

        // Check if value changed
        const updatedValue = editDemo.querySelector('.node-value[data-editable="true"]');
        console.log('Updated value:', updatedValue?.textContent);
        expect(updatedValue?.textContent).not.toBe(originalValue);
      }
    }

    demo.destroy();
  });

  test('All format handlers are properly registered', async () => {
    const demo = HierarchyEditorDemo.create({ dom: container });
    await new Promise(resolve => setTimeout(resolve, 100));

    // Test each format button
    const formats = ['json', 'xml', 'yaml', 'markdown'];
    
    for (const format of formats) {
      console.log(`\nTesting ${format} format:`);
      
      const card = container.querySelector(`.sample-data-card[data-format="${format}"]`);
      expect(card).toBeTruthy();
      
      card.click();
      await new Promise(resolve => setTimeout(resolve, 200));

      const formatContainer = container.querySelector('[data-editor-container="format"]');
      const formatDemo = formatContainer?.querySelector('.he-tree-view');
      const nodes = formatDemo?.querySelectorAll('.hierarchy-node');
      
      console.log(`${format} nodes rendered:`, nodes?.length);
      
      // Each format should render some nodes
      expect(nodes?.length || 0).toBeGreaterThan(0);
    }

    demo.destroy();
  });
});