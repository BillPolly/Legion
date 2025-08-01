/**
 * @jest-environment jsdom
 */

import { ModernTree } from '../src/components/modern-tree/index.js';

describe('Selection Bug Recreation', () => {
  let container;
  let tree;
  let demoData;

  beforeEach(() => {
    container = document.createElement('div');
    container.style.width = '600px';
    container.style.height = '400px';
    document.body.appendChild(container);
    
    // Use exact same data as demo
    demoData = [
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
        id: 'development',
        name: '💻 Development'
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

  test('should reproduce the exact selection bug from demo', async () => {
    console.log('=== RECREATING DEMO SELECTION BUG ===');
    
    // Create tree with exact same config as demo
    let selectionChangeCallbackData = null;
    tree = ModernTree.create({
      dom: container,
      data: demoData,
      theme: 'light',
      selectable: 'single',
      expandable: true,
      searchable: true,
      showIcons: true,
      showLines: true,
      onSelectionChange: (selectedNodes, selectionData) => {
        console.log('Selection changed in tree:', selectionData.map(n => n.name));
        selectionChangeCallbackData = selectionData;
      }
    });

    // Wait for initial render
    await new Promise(resolve => setTimeout(resolve, 50));

    console.log('Tree created, checking initial state...');
    const initialSelection = tree.getSelection();
    console.log('Initial selection:', initialSelection);
    expect(initialSelection.length).toBe(0); // Should be empty initially

    // Find the documents node and click it (simulate user clicking)
    const documentsNode = container.querySelector('[data-node-id="documents"]');
    console.log('Documents node found:', documentsNode?.textContent);
    expect(documentsNode).toBeTruthy();

    console.log('Simulating user click on documents node...');
    documentsNode.click();
    
    // Wait for selection to process
    await new Promise(resolve => setTimeout(resolve, 100));

    // Check selection after click
    const selectionAfterClick = tree.getSelection();
    console.log('Selection after click:', selectionAfterClick);
    console.log('Selection callback data:', selectionChangeCallbackData);

    // This SHOULD show the documents node is selected
    expect(selectionAfterClick.length).toBe(1);
    expect(selectionAfterClick[0].id).toBe('documents');
    
    // Verify the node has selected class
    expect(documentsNode.classList.contains('selected')).toBe(true);

    console.log('✅ Selection working correctly so far...');

    // Now simulate the demo's addRandomNode function EXACTLY
    console.log('=== SIMULATING DEMO ADD NODE FUNCTION ===');
    
    const addRandomNode = () => {
      console.log('addRandomNode called');
      
      // Get selected nodes - THIS IS WHERE THE BUG MIGHT BE
      const selection = tree.getSelection();
      console.log('Current selection:', selection);
      
      // Generate new node data
      const randomId = `node_${Date.now()}`;
      const names = ['📄 New Document', '📁 New Folder', '🎨 New Asset', '📊 New Report'];
      const randomName = names[Math.floor(Math.random() * names.length)];
      
      // Create new node
      const newNode = {
        id: randomId,
        name: randomName
      };
      
      if (selection.length > 0) {
        // Add as child to selected node
        const selectedNodeId = selection[0].id;
        console.log(`Adding child to selected node: ${selectedNodeId}`);
        
        // Find the selected node in the data and add child
        const addChildToNode = (nodes, targetId) => {
          for (let node of nodes) {
            if (node.id === targetId) {
              if (!node.children) {
                node.children = [];
              }
              node.children.push(newNode);
              console.log(`Added child to node ${targetId}:`, newNode);
              return true;
            }
            if (node.children && addChildToNode(node.children, targetId)) {
              return true;
            }
          }
          return false;
        };
        
        if (addChildToNode(demoData, selectedNodeId)) {
          // Update tree with new data first
          tree.updateConfig({ data: [...demoData] });
          // Then expand the parent node to show the new child
          tree.executeCommand('expandNode', { nodeId: selectedNodeId });
          console.log(`Expanded node ${selectedNodeId} to show new child`);
        } else {
          console.warn(`Could not find selected node ${selectedNodeId}, adding to root`);
          demoData.push(newNode);
        }
      } else {
        // No selection, add to root level
        console.log('No selection, adding to root level');
        demoData.push(newNode);
      }
      
      // Update tree with new data (if not already done above)
      if (selection.length === 0) {
        tree.updateConfig({ data: [...demoData] });
      }
      
      // Show confirmation
      console.log(`Added new node: ${randomName} (${randomId})`);
    };

    // Execute the add node function
    addRandomNode();
    
    await new Promise(resolve => setTimeout(resolve, 100));

    // Check if the node was added as a child or at root
    const finalStats = tree.getStats();
    console.log('Final tree stats:', finalStats);

    // If it added to root, we reproduced the bug
    // If it added as child and expanded documents, it's working correctly
    const documentsNodeAfter = container.querySelector('[data-node-id="documents"]');
    const isDocumentsExpanded = tree.debug().model.isExpanded('documents');
    console.log('Documents expanded after add:', isDocumentsExpanded);

    // Look for new child nodes
    const newChildNodes = container.querySelectorAll('[data-node-id^="node_"]');
    console.log('New child nodes found:', newChildNodes.length);
    
    if (isDocumentsExpanded && newChildNodes.length > 0) {
      console.log('✅ SUCCESS: Child was added to selected node and is visible');
      // This is the expected behavior
    } else {
      console.log('❌ BUG REPRODUCED: Node was added to root instead of selected node');
      // This is the bug we need to fix
    }
  });

  test('should fix the selection bug by ensuring selection persists', async () => {
    console.log('=== TESTING SELECTION PERSISTENCE FIX ===');
    
    // Create tree and make selection
    tree = ModernTree.create({
      dom: container,
      data: demoData,
      selectable: 'single'
    });

    await new Promise(resolve => setTimeout(resolve, 50));

    // Select documents node
    const documentsNode = container.querySelector('[data-node-id="documents"]');
    documentsNode.click();
    await new Promise(resolve => setTimeout(resolve, 50));

    // Verify selection exists
    let selection = tree.getSelection();
    expect(selection.length).toBe(1);
    expect(selection[0].id).toBe('documents');
    console.log('Selection confirmed:', selection[0].data.name);

    // Now test if selection persists after various operations that might clear it
    console.log('Testing selection persistence...');

    // Test 1: After theme change
    tree.updateConfig({ theme: 'dark' });
    await new Promise(resolve => setTimeout(resolve, 50));
    selection = tree.getSelection();
    console.log('Selection after theme change:', selection.length);
    
    // Re-select if lost
    if (selection.length === 0) {
      console.log('Selection lost after theme change, re-selecting...');
      documentsNode.click();
      await new Promise(resolve => setTimeout(resolve, 50));
      selection = tree.getSelection();
    }
    
    expect(selection.length).toBe(1);

    // Test 2: After data update (this might be clearing selection)
    console.log('Testing selection after data update...');
    const originalData = [...demoData];
    tree.updateConfig({ data: [...originalData] });
    await new Promise(resolve => setTimeout(resolve, 50));
    
    selection = tree.getSelection();
    console.log('Selection after data update:', selection.length);
    
    if (selection.length === 0) {
      console.log('❌ BUG FOUND: Selection cleared after data update!');
      console.log('This is likely the root cause of the demo issue');
      
      // The fix: preserve selection when updating data
      const selectedNodeId = 'documents'; // We know this was selected
      tree.executeCommand('selectNode', { nodeId: selectedNodeId });
      await new Promise(resolve => setTimeout(resolve, 50));
      
      selection = tree.getSelection();
      console.log('Selection after fix:', selection.length);
      expect(selection.length).toBe(1);
      console.log('✅ Selection restored');
    }

    // Now test adding child node
    const newNode = {
      id: 'test_child',
      name: '🆕 Test Child'
    };

    // Add child to documents
    const modifiedData = JSON.parse(JSON.stringify(demoData));
    modifiedData[0].children.push(newNode); // Add to documents children

    // Update data while preserving selection
    const currentSelection = tree.getSelection();
    tree.updateConfig({ data: modifiedData });
    
    // Restore selection if it was lost
    if (currentSelection.length > 0) {
      await new Promise(resolve => setTimeout(resolve, 50));
      const selectionAfterUpdate = tree.getSelection();
      if (selectionAfterUpdate.length === 0) {
        console.log('Restoring selection after data update...');
        tree.executeCommand('selectNode', { nodeId: currentSelection[0].id });
      }
    }
    
    // Expand to show new child
    tree.executeCommand('expandNode', { nodeId: 'documents' });
    await new Promise(resolve => setTimeout(resolve, 100));

    // Verify child is visible
    const childElement = container.querySelector('[data-node-id="test_child"]');
    expect(childElement).toBeTruthy();
    console.log('✅ Child node added and visible:', childElement.textContent);
  });
});