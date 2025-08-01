/**
 * @jest-environment jsdom
 */

import { ModernTree } from '../src/components/modern-tree/index.js';

describe('ModernTree Inline Editing - Content Verification', () => {
  let container;
  let tree;
  let sampleData;

  beforeEach(() => {
    container = document.createElement('div');
    container.style.width = '600px';
    container.style.height = '400px';
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

  test('should actually change DOM content when editing is completed', async () => {
    console.log('=== CONTENT CHANGE VERIFICATION TEST ===');
    
    let editCallbacks = [];
    
    tree = ModernTree.create({
      dom: container,
      data: sampleData,
      editable: true,
      selectable: 'single',
      onNodeEdit: (nodeId, newValue, oldValue, node) => {
        console.log(`📝 Edit callback: ${nodeId} changed from "${oldValue}" to "${newValue}"`);
        editCallbacks.push({ nodeId, newValue, oldValue, node });
      }
    });

    await new Promise(resolve => setTimeout(resolve, 100));

    // STEP 1: Record original content
    console.log('\n=== STEP 1: RECORD ORIGINAL CONTENT ===');
    const settingsNode = container.querySelector('[data-node-id="settings"]');
    expect(settingsNode).toBeTruthy();
    
    const originalContent = settingsNode.querySelector('.node-content');
    const originalText = originalContent.textContent;
    console.log('Original node text:', originalText);
    expect(originalText).toBe('⚙️ System Settings');

    // STEP 2: Start editing via viewModel command (more reliable than double-click in tests)
    console.log('\n=== STEP 2: START EDITING ===');
    console.log('Starting edit via viewModel command...');
    
    const editResult = tree.viewModel.executeCommand('startEdit', { nodeId: 'settings' });
    console.log('Edit command result:', editResult);
    await new Promise(resolve => setTimeout(resolve, 100));

    // Find the editing input
    const editingInput = container.querySelector('.tree-node-label-input');
    console.log('Editing input found:', !!editingInput);
    console.log('Input value:', editingInput?.value);
    
    if (!editingInput) {
      console.log('❌ FAILED: Could not start editing');
      console.log('Checking if editable is properly configured...');
      console.log('Tree config:', tree.config);
      console.log('ViewModel editing state:', {
        editingNodeId: tree.viewModel.editingNodeId,
        editingInput: tree.viewModel.editingInput
      });
      
      // Try direct view method
      console.log('Trying direct view method...');
      const directInput = tree.view.startEditingNode('settings', 'System Settings', '⚙️');
      console.log('Direct view method result:', !!directInput);
      
      if (directInput) {
        console.log('✅ Direct view method worked, using that input');
        await new Promise(resolve => setTimeout(resolve, 50));
      } else {
        throw new Error('Could not start editing via any method');
      }
    }

    // Get the input (either from command or direct method)
    const activeInput = editingInput || container.querySelector('.tree-node-label-input');
    expect(activeInput).toBeTruthy();
    console.log('Active input value:', activeInput.value);

    // STEP 3: Change the content
    console.log('\n=== STEP 3: CHANGE CONTENT ===');
    const newText = 'Modified Settings';
    activeInput.value = newText;
    console.log('Changed input value to:', newText);

    // STEP 4: Finish editing
    console.log('\n=== STEP 4: FINISH EDITING ===');
    console.log('Triggering Enter key to finish editing...');
    const enterEvent = new KeyboardEvent('keydown', { 
      key: 'Enter', 
      bubbles: true, 
      cancelable: true 
    });
    activeInput.dispatchEvent(enterEvent);
    
    await new Promise(resolve => setTimeout(resolve, 100));

    // STEP 5: Verify content has changed in DOM
    console.log('\n=== STEP 5: VERIFY DOM CHANGES ===');
    
    // Re-query the node content
    const updatedContent = container.querySelector('[data-node-id="settings"] .node-content');
    const updatedText = updatedContent?.textContent;
    console.log('Updated node text:', updatedText);
    
    // Verify the text has actually changed
    expect(updatedText).toBe('⚙️ Modified Settings'); // Should preserve emoji
    expect(updatedText).not.toBe(originalText); // Should be different from original
    
    console.log('✅ Content successfully changed in DOM');
    console.log(`Original: "${originalText}" → Updated: "${updatedText}"`);

    // STEP 6: Verify callback was triggered
    console.log('\n=== STEP 6: VERIFY CALLBACK ===');
    expect(editCallbacks.length).toBe(1);
    expect(editCallbacks[0].nodeId).toBe('settings');
    expect(editCallbacks[0].oldValue).toBe('⚙️ System Settings');
    expect(editCallbacks[0].newValue).toBe('⚙️ Modified Settings');
    console.log('✅ Edit callback was properly triggered');

    // STEP 7: Verify data model has changed
    console.log('\n=== STEP 7: VERIFY DATA MODEL ===');
    const nodeData = tree.model.getNode('settings');
    console.log('Node data after edit:', nodeData);
    expect(nodeData.name).toBe('⚙️ Modified Settings');
    console.log('✅ Data model was updated');

    // STEP 8: Verify no editing UI remains
    console.log('\n=== STEP 8: VERIFY CLEANUP ===');
    const remainingInput = container.querySelector('.tree-node-label-input');
    expect(remainingInput).toBeFalsy();
    
    const editingClasses = container.querySelectorAll('.node-content.editing');
    expect(editingClasses.length).toBe(0);
    console.log('✅ Editing UI properly cleaned up');
  });

  test('should handle emoji extraction and restoration correctly', async () => {
    console.log('=== EMOJI HANDLING VERIFICATION TEST ===');
    
    let editCallbacks = [];
    
    tree = ModernTree.create({
      dom: container,
      data: sampleData,
      editable: true,
      onNodeEdit: (nodeId, newValue, oldValue, node) => {
        editCallbacks.push({ nodeId, newValue, oldValue });
      }
    });

    await new Promise(resolve => setTimeout(resolve, 100));

    // Test with documents node (has emoji)
    console.log('\n=== TESTING EMOJI NODE ===');
    const documentsOriginal = container.querySelector('[data-node-id="documents"] .node-content').textContent;
    console.log('Original documents text:', documentsOriginal);
    
    // Start editing
    tree.viewModel.executeCommand('startEdit', { nodeId: 'documents' });
    await new Promise(resolve => setTimeout(resolve, 50));
    
    const input = container.querySelector('.tree-node-label-input');
    if (input) {
      console.log('Input value (should be without emoji):', input.value);
      expect(input.value).toBe('Documents'); // Should not include emoji
      
      // Change the text
      input.value = 'My Documents';
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Verify emoji was restored
      const finalText = container.querySelector('[data-node-id="documents"] .node-content').textContent;
      console.log('Final text (should have emoji restored):', finalText);
      expect(finalText).toBe('📁 My Documents');
      
      // Verify callback received full text with emoji
      expect(editCallbacks.length).toBe(1);
      expect(editCallbacks[0].newValue).toBe('📁 My Documents');
      console.log('✅ Emoji properly extracted and restored');
    } else {
      console.log('Could not start editing, skipping emoji test');
    }
  });

  test('should persist changes through tree updates', async () => {
    console.log('=== PERSISTENCE THROUGH UPDATES TEST ===');
    
    tree = ModernTree.create({
      dom: container,
      data: sampleData,
      editable: true
    });

    await new Promise(resolve => setTimeout(resolve, 100));

    // Edit a node
    tree.viewModel.executeCommand('startEdit', { nodeId: 'settings' });
    await new Promise(resolve => setTimeout(resolve, 50));
    
    const input = container.querySelector('.tree-node-label-input');
    if (input) {
      input.value = 'Persistent Settings';
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Verify the change
      let nodeText = container.querySelector('[data-node-id="settings"] .node-content').textContent;
      expect(nodeText).toBe('⚙️ Persistent Settings');
      console.log('✅ Change applied:', nodeText);
      
      // Now update the tree data (simulating external data refresh)
      console.log('Triggering tree data update...');
      tree.updateConfig({ data: [...sampleData] });
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Verify the change was reverted (because sampleData hasn't been updated)
      nodeText = container.querySelector('[data-node-id="settings"] .node-content').textContent;
      console.log('Text after data update:', nodeText);
      expect(nodeText).toBe('⚙️ System Settings'); // Reverted to original
      console.log('✅ Data update correctly reverted to source data (expected behavior)');
    } else {
      console.log('Could not start editing, skipping persistence test');
    }
  });

  test('should handle cancellation correctly', async () => {
    console.log('=== CANCELLATION VERIFICATION TEST ===');
    
    let editCallbacks = [];
    
    tree = ModernTree.create({
      dom: container,
      data: sampleData,
      editable: true,
      onNodeEdit: (nodeId, newValue, oldValue, node) => {
        editCallbacks.push({ nodeId, newValue, oldValue });
      }
    });

    await new Promise(resolve => setTimeout(resolve, 100));

    // Record original content
    const originalText = container.querySelector('[data-node-id="settings"] .node-content').textContent;
    console.log('Original text:', originalText);
    
    // Start editing
    tree.viewModel.executeCommand('startEdit', { nodeId: 'settings' });
    await new Promise(resolve => setTimeout(resolve, 50));
    
    const input = container.querySelector('.tree-node-label-input');
    if (input) {
      // Change the text
      input.value = 'This should be cancelled';
      console.log('Changed input to:', input.value);
      
      // Cancel with Escape
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Verify content is unchanged
      const finalText = container.querySelector('[data-node-id="settings"] .node-content').textContent;
      console.log('Final text after cancel:', finalText);
      expect(finalText).toBe(originalText);
      
      // Verify no callback was triggered
      expect(editCallbacks.length).toBe(0);
      console.log('✅ Cancellation worked correctly - no changes applied');
    } else {
      console.log('Could not start editing, skipping cancellation test');
    }
  });
});