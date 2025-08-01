/**
 * @jest-environment jsdom
 */

import { ModernTree } from '../src/components/modern-tree/index.js';

describe('ModernTree Inline Editing', () => {
  let container;
  let tree;
  let sampleData;

  beforeEach(() => {
    container = document.createElement('div');
    container.style.width = '400px';
    container.style.height = '300px';
    document.body.appendChild(container);
    
    sampleData = [
      {
        id: 'documents',
        name: '📁 Documents',
        children: [
          {
            id: 'work',
            name: '💼 Work Projects',
            children: [
              { id: 'project1', name: '📊 Q4 Analysis.xlsx' },
              { id: 'project2', name: '📋 Meeting Notes.docx' }
            ]
          }
        ]
      },
      {
        id: 'settings',
        name: '⚙️ System Settings'
      }
    ];
  });

  afterEach(() => {
    if (tree) {
      tree.destroy();
      tree = null;
    }
    if (container.parentNode) {
      container.parentNode.removeChild(container);
    }
  });

  test('should enable inline editing when editable is true', async () => {
    console.log('=== INLINE EDITING BASIC TEST ===');
    
    tree = ModernTree.create({
      dom: container,
      data: sampleData,
      editable: true,
      selectable: 'single'
    });

    await new Promise(resolve => setTimeout(resolve, 100));

    // Find a node to edit
    const documentsNode = container.querySelector('[data-node-id="documents"]');
    expect(documentsNode).toBeTruthy();
    console.log('Found documents node:', documentsNode?.textContent);

    // Double-click to start editing
    console.log('Double-clicking to start editing...');
    const dblClickEvent = new MouseEvent('dblclick', { bubbles: true, cancelable: true });
    documentsNode.dispatchEvent(dblClickEvent);
    
    await new Promise(resolve => setTimeout(resolve, 100));

    // Check if editing mode is active
    const editingInput = container.querySelector('.tree-node-label-input');
    console.log('Editing input found:', !!editingInput);
    console.log('Input value:', editingInput?.value);
    expect(editingInput).toBeTruthy();
    expect(editingInput.value).toBe('Documents'); // Should extract text without emoji
  });

  test('should handle inline editing workflow with emoji preservation', async () => {
    console.log('=== EMOJI PRESERVATION TEST ===');
    
    let editedNodeId = null;
    let oldValue = null;
    let newValue = null;
    
    tree = ModernTree.create({
      dom: container,
      data: sampleData,
      editable: true,
      selectable: 'single',
      onNodeEdit: (nodeId, newVal, oldVal, node) => {
        console.log(`📝 Node edited: ${nodeId} - "${oldVal}" → "${newVal}"`);
        editedNodeId = nodeId;
        oldValue = oldVal;
        newValue = newVal;
      }
    });

    await new Promise(resolve => setTimeout(resolve, 100));

    // Start editing the documents node
    const documentsNode = container.querySelector('[data-node-id="documents"]');
    documentsNode.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    
    await new Promise(resolve => setTimeout(resolve, 50));

    const editingInput = container.querySelector('.tree-node-label-input');
    expect(editingInput).toBeTruthy();
    
    // Change the value
    editingInput.value = 'My Documents';
    console.log('Changed input value to:', editingInput.value);
    
    // Press Enter to finish editing
    const enterEvent = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true });
    editingInput.dispatchEvent(enterEvent);
    
    await new Promise(resolve => setTimeout(resolve, 100));

    // Check that editing callback was called
    expect(editedNodeId).toBe('documents');
    expect(oldValue).toBe('📁 Documents');
    expect(newValue).toBe('📁 My Documents'); // Should preserve emoji
    
    // Check that DOM reflects the change
    const updatedNode = container.querySelector('[data-node-id="documents"] .node-content');
    console.log('Updated node text:', updatedNode?.textContent);
    expect(updatedNode?.textContent).toBe('📁 My Documents');
  });

  test('should cancel editing with Escape key', async () => {
    console.log('=== CANCEL EDITING TEST ===');
    
    let editCallbackFired = false;
    
    tree = ModernTree.create({
      dom: container,
      data: sampleData,
      editable: true,
      onNodeEdit: () => {
        editCallbackFired = true;
      }
    });

    await new Promise(resolve => setTimeout(resolve, 100));

    // Start editing
    const documentsNode = container.querySelector('[data-node-id="documents"]');
    documentsNode.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    
    await new Promise(resolve => setTimeout(resolve, 50));

    const editingInput = container.querySelector('.tree-node-label-input');
    expect(editingInput).toBeTruthy();
    
    // Change the value
    editingInput.value = 'This should be cancelled';
    
    // Press Escape to cancel
    const escapeEvent = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true });
    editingInput.dispatchEvent(escapeEvent);
    
    await new Promise(resolve => setTimeout(resolve, 100));

    // Check that editing was cancelled
    expect(editCallbackFired).toBe(false);
    
    const nodeContent = container.querySelector('[data-node-id="documents"] .node-content');
    expect(nodeContent?.textContent).toBe('📁 Documents'); // Should be unchanged
    console.log('Node text after cancel:', nodeContent?.textContent);
  });

  test('should finish editing on blur', async () => {
    console.log('=== BLUR EDITING TEST ===');
    
    let editCallbackFired = false;
    
    tree = ModernTree.create({
      dom: container,
      data: sampleData,
      editable: true,
      onNodeEdit: () => {
        editCallbackFired = true;
        console.log('Edit callback fired on blur');
      }
    });

    await new Promise(resolve => setTimeout(resolve, 100));

    // Start editing
    const documentsNode = container.querySelector('[data-node-id="documents"]');
    documentsNode.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    
    await new Promise(resolve => setTimeout(resolve, 50));

    const editingInput = container.querySelector('.tree-node-label-input');
    expect(editingInput).toBeTruthy();
    
    // Change the value
    editingInput.value = 'Documents Changed';
    
    // Trigger blur event
    editingInput.dispatchEvent(new FocusEvent('blur', { bubbles: true }));
    
    await new Promise(resolve => setTimeout(resolve, 100));

    // Check that editing was completed
    expect(editCallbackFired).toBe(true);
    
    const nodeContent = container.querySelector('[data-node-id="documents"] .node-content');
    expect(nodeContent?.textContent).toBe('📁 Documents Changed');
    console.log('Node text after blur:', nodeContent?.textContent);
  });

  test('should not start editing when editable is false', async () => {
    console.log('=== NON-EDITABLE TEST ===');
    
    tree = ModernTree.create({
      dom: container,
      data: sampleData,
      editable: false // Explicitly disabled
    });

    await new Promise(resolve => setTimeout(resolve, 100));

    // Try to start editing
    const documentsNode = container.querySelector('[data-node-id="documents"]');
    documentsNode.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    
    await new Promise(resolve => setTimeout(resolve, 100));

    // Should not find editing input
    const editingInput = container.querySelector('.tree-node-label-input');
    expect(editingInput).toBeFalsy();
    console.log('Editing input found (should be false):', !!editingInput);
  });

  test('should handle nodes without emoji correctly', async () => {
    console.log('=== NON-EMOJI EDITING TEST ===');
    
    const nonEmojiData = [
      { id: 'simple', name: 'Simple Text Node' },
      { id: 'another', name: 'Another Node' }
    ];
    
    let editedValue = null;
    
    tree = ModernTree.create({
      dom: container,
      data: nonEmojiData,
      editable: true,
      onNodeEdit: (nodeId, newVal, oldVal) => {
        editedValue = newVal;
        console.log(`Non-emoji edit: "${oldVal}" → "${newVal}"`);
      }
    });

    await new Promise(resolve => setTimeout(resolve, 100));

    // Start editing the simple node
    const simpleNode = container.querySelector('[data-node-id="simple"]');
    simpleNode.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    
    await new Promise(resolve => setTimeout(resolve, 50));

    const editingInput = container.querySelector('.tree-node-label-input');
    expect(editingInput.value).toBe('Simple Text Node');
    
    // Change the value
    editingInput.value = 'Modified Text Node';
    
    // Finish editing
    editingInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    
    await new Promise(resolve => setTimeout(resolve, 100));

    expect(editedValue).toBe('Modified Text Node');
    
    const nodeContent = container.querySelector('[data-node-id="simple"] .node-content');
    expect(nodeContent?.textContent).toBe('Modified Text Node');
  });

  test('should handle rapid double-click to editing transitions', async () => {
    console.log('=== RAPID TRANSITION TEST ===');
    
    tree = ModernTree.create({
      dom: container,
      data: sampleData,
      editable: true
    });

    await new Promise(resolve => setTimeout(resolve, 100));

    const documentsNode = container.querySelector('[data-node-id="documents"]');
    
    // Start editing first node
    documentsNode.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    await new Promise(resolve => setTimeout(resolve, 50));
    
    let firstInput = container.querySelector('.tree-node-label-input');
    expect(firstInput).toBeTruthy();
    
    // Try to start editing another node while first is still editing
    const settingsNode = container.querySelector('[data-node-id="settings"]');
    settingsNode.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    await new Promise(resolve => setTimeout(resolve, 50));
    
    // Should have finished first edit and started second
    const secondInput = container.querySelector('.tree-node-label-input');
    expect(secondInput).toBeTruthy();
    
    // The second input should be for the settings node
    const settingsContent = settingsNode.querySelector('.node-content');
    expect(settingsContent.classList.contains('editing')).toBe(true);
    console.log('Second edit started on:', settingsNode.getAttribute('data-node-id'));
  });
});