/**
 * Basic DOM test for HierarchyEditor
 */

import { HierarchyEditor } from '../src/components/hierarchy-editor/index.js';

describe('HierarchyEditor Basic DOM', () => {
  test('creates basic DOM structure', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    
    console.log('Container before:', container.innerHTML);
    
    const editor = HierarchyEditor.create({
      dom: container,
      content: '{"test": "value"}',
      format: 'json'
    });
    
    console.log('Editor instance:', editor);
    console.log('Editor methods:', Object.keys(editor || {}));
    
    await new Promise(resolve => setTimeout(resolve, 100));
    
    console.log('Container after:', container.innerHTML);
    
    // Check for hierarchy editor element
    const heElement = container.querySelector('.hierarchy-editor');
    console.log('Has .hierarchy-editor:', !!heElement);
    
    // Check for tree view
    const treeView = container.querySelector('.he-tree-view');
    console.log('Has .he-tree-view:', !!treeView);
    
    // Check for any content
    const anyNodes = container.querySelectorAll('*');
    console.log('Total elements in container:', anyNodes.length);
    
    // List all classes
    const allClasses = new Set();
    anyNodes.forEach(node => {
      if (node.className) {
        node.className.split(' ').forEach(cls => allClasses.add(cls));
      }
    });
    console.log('All CSS classes:', Array.from(allClasses));
    
    if (editor && editor.destroy) {
      editor.destroy();
    }
    
    document.body.removeChild(container);
  });
});