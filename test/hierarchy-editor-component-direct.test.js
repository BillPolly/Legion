/**
 * Direct test of HierarchyEditor component with all formats
 */

import { HierarchyEditor } from '../src/components/hierarchy-editor/index.js';

describe('HierarchyEditor Component - Direct Testing', () => {
  let container;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  test('JSON - renders and has expansion controls', async () => {
    const json = `{
      "name": "Test",
      "nested": {
        "value": "test"
      }
    }`;
    
    const editor = HierarchyEditor.create({
      dom: container,
      content: json,
      format: 'json'
    });
    
    await new Promise(resolve => setTimeout(resolve, 50));
    
    const nodes = container.querySelectorAll('.hierarchy-node');
    console.log('JSON nodes:', nodes.length);
    
    const expandControls = container.querySelectorAll('.expand-control');
    console.log('JSON expand controls:', expandControls.length);
    
    expect(nodes.length).toBeGreaterThan(0);
    expect(expandControls.length).toBeGreaterThan(0);
    
    editor.destroy();
  });

  test('XML - renders and has expansion controls', async () => {
    const xml = `<root>
      <person>
        <name>John</name>
        <age>30</age>
      </person>
    </root>`;
    
    const editor = HierarchyEditor.create({
      dom: container,
      content: xml,
      format: 'xml'
    });
    
    await new Promise(resolve => setTimeout(resolve, 50));
    
    const nodes = container.querySelectorAll('.hierarchy-node');
    console.log('XML nodes:', nodes.length);
    
    const expandControls = container.querySelectorAll('.expand-control');
    console.log('XML expand controls:', expandControls.length);
    
    const xmlElements = container.querySelectorAll('[data-node-type="element"]');
    console.log('XML element nodes:', xmlElements.length);
    
    expect(nodes.length).toBeGreaterThan(0);
    expect(expandControls.length).toBeGreaterThan(0);
    
    editor.destroy();
  });

  test('YAML - renders without errors', async () => {
    const yaml = `name: Test
version: 1.0.0
items:
  - one
  - two`;
    
    // Capture errors
    const originalError = console.error;
    const errors = [];
    console.error = (...args) => {
      errors.push(args.join(' '));
      originalError(...args);
    };
    
    const editor = HierarchyEditor.create({
      dom: container,
      content: yaml,
      format: 'yaml'
    });
    
    await new Promise(resolve => setTimeout(resolve, 50));
    
    console.error = originalError;
    
    const nodes = container.querySelectorAll('.hierarchy-node');
    console.log('YAML nodes:', nodes.length);
    console.log('YAML errors:', errors);
    
    const expandControls = container.querySelectorAll('.expand-control');
    console.log('YAML expand controls:', expandControls.length);
    
    expect(nodes.length).toBeGreaterThan(0);
    expect(errors.length).toBe(0);
    
    editor.destroy();
  });

  test('Markdown - renders properly', async () => {
    const markdown = `# Title

Some content

## Section

Section content`;
    
    const editor = HierarchyEditor.create({
      dom: container,
      content: markdown,
      format: 'markdown'
    });
    
    await new Promise(resolve => setTimeout(resolve, 50));
    
    const nodes = container.querySelectorAll('.hierarchy-node');
    console.log('Markdown nodes:', nodes.length);
    
    const headings = container.querySelectorAll('.markdown-heading');
    console.log('Markdown headings:', headings.length);
    
    expect(nodes.length).toBeGreaterThan(0);
    expect(headings.length).toBeGreaterThan(0);
    
    editor.destroy();
  });

  test('Editing saves properly', async () => {
    const json = `{"editMe": "originalValue"}`;
    
    let contentChanged = false;
    let newContent = null;
    
    const editor = HierarchyEditor.create({
      dom: container,
      content: json,
      format: 'json',
      onContentChange: (event) => {
        contentChanged = true;
        newContent = event.content;
      }
    });
    
    await new Promise(resolve => setTimeout(resolve, 50));
    
    // Find editable value
    const editableValue = container.querySelector('.node-value[data-editable="true"]');
    expect(editableValue).toBeTruthy();
    
    // Click to edit
    editableValue.click();
    await new Promise(resolve => setTimeout(resolve, 50));
    
    const input = container.querySelector('.edit-input');
    if (input) {
      input.value = 'newValue';
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    console.log('Content changed:', contentChanged);
    console.log('New content:', newContent);
    
    editor.destroy();
  });
});