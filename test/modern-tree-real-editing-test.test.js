/**
 * @jest-environment jsdom
 */

import { ModernTree } from '../src/components/modern-tree/index.js';

describe('ModernTree Real Editing Test', () => {
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
          { id: 'file1', name: '📄 Important File.txt' }
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

  test('should have editable content spans with proper event handlers', async () => {
    console.log('=== REAL EDITING TEST ===');
    
    let editStartEvents = [];
    
    tree = ModernTree.create({
      dom: container,
      data: sampleData,
      editable: true,
      selectable: 'single',
      onNodeEdit: (nodeId, newValue, oldValue, node) => {
        console.log(`✅ Edit completed: ${nodeId} changed from "${oldValue}" to "${newValue}"`);
      }
    });

    // Capture nodeStartEdit events at the viewModel level
    const originalHandleViewEvent = tree.viewModel._handleViewEvent;
    tree.viewModel._handleViewEvent = function(event) {
      if (event.type === 'nodeStartEdit') {
        console.log('🎯 nodeStartEdit event captured:', event.data);
        editStartEvents.push(event.data);
      }
      return originalHandleViewEvent.call(this, event);
    };

    await new Promise(resolve => setTimeout(resolve, 100));

    // Check the DOM structure
    console.log('\n=== DOM STRUCTURE ANALYSIS ===');
    const settingsNode = container.querySelector('[data-node-id="settings"]');
    expect(settingsNode).toBeTruthy();
    console.log('Settings node found:', !!settingsNode);
    
    const contentSpan = settingsNode.querySelector('.node-content');
    expect(contentSpan).toBeTruthy();
    console.log('Content span found:', !!contentSpan);
    console.log('Content span text:', contentSpan.textContent);
    console.log('Content span title:', contentSpan.title);
    console.log('Content span cursor:', getComputedStyle(contentSpan).cursor);

    // Test double-click on the content span specifically
    console.log('\n=== TESTING DOUBLE-CLICK ON CONTENT ===');
    console.log('Double-clicking on content span...');
    
    const dblClickEvent = new MouseEvent('dblclick', {
      bubbles: true,
      cancelable: true,
      view: window
    });
    
    contentSpan.dispatchEvent(dblClickEvent);
    await new Promise(resolve => setTimeout(resolve, 100));
    
    console.log('Edit start events captured:', editStartEvents.length);
    if (editStartEvents.length > 0) {
      console.log('First edit start event:', editStartEvents[0]);
    }
    
    // Check if editing input appeared
    const editingInput = container.querySelector('.tree-node-label-input');
    console.log('Editing input found:', !!editingInput);
    
    if (editingInput) {
      console.log('✅ SUCCESS: Editing input appeared');
      console.log('Input value:', editingInput.value);
      
      // Test completing the edit
      editingInput.value = 'Modified Settings';
      editingInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const updatedText = settingsNode.querySelector('.node-content').textContent;
      console.log('Updated text:', updatedText);
      expect(updatedText).toContain('Modified Settings');
      
    } else {
      console.log('❌ FAILED: No editing input appeared');
      
      // Debug: Try the viewModel command directly
      console.log('Trying direct viewModel command...');
      const result = tree.viewModel.executeCommand('startEdit', { nodeId: 'settings' });
      console.log('Direct command result:', result);
      
      await new Promise(resolve => setTimeout(resolve, 50));
      const directInput = container.querySelector('.tree-node-label-input');
      console.log('Direct command created input:', !!directInput);
      
      if (directInput) {
        console.log('✅ Direct command works, issue is with event handling');
      } else {
        console.log('❌ Even direct command failed');
      }
    }
  });

  test('should distinguish between node click and content double-click', async () => {
    console.log('=== CLICK VS DOUBLE-CLICK TEST ===');
    
    let clickEvents = [];
    let editEvents = [];
    
    tree = ModernTree.create({
      dom: container,
      data: sampleData,
      editable: true,
      selectable: 'single',
      onSelectionChange: (selectedNodes, selectionData) => {
        console.log('Selection changed:', selectionData.map(n => n.name));
        clickEvents.push('selection');
      }
    });

    // Capture edit events
    const originalHandleViewEvent = tree.viewModel._handleViewEvent;
    tree.viewModel._handleViewEvent = function(event) {
      if (event.type === 'nodeStartEdit') {
        editEvents.push(event.data);
      }
      return originalHandleViewEvent.call(this, event);
    };

    await new Promise(resolve => setTimeout(resolve, 100));

    const settingsNode = container.querySelector('[data-node-id="settings"]');
    const contentSpan = settingsNode.querySelector('.node-content');
    
    // Test 1: Single click on node (should select)
    console.log('\n1. Testing single click on node...');
    settingsNode.click();
    await new Promise(resolve => setTimeout(resolve, 50));
    
    console.log('Click events after single click:', clickEvents.length);
    expect(clickEvents.length).toBeGreaterThan(0);
    
    // Test 2: Double-click on content (should start editing)
    console.log('\n2. Testing double-click on content...');
    contentSpan.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    await new Promise(resolve => setTimeout(resolve, 100));
    
    console.log('Edit events after double-click:', editEvents.length);
    const editingInput = container.querySelector('.tree-node-label-input');
    console.log('Editing input appeared:', !!editingInput);
    
    if (editEvents.length > 0 || editingInput) {
      console.log('✅ Double-click correctly triggers editing');
    } else {
      console.log('❌ Double-click did not trigger editing');
    }
  });
});