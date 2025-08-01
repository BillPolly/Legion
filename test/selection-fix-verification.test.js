/**
 * @jest-environment jsdom
 */

import { ModernTree } from '../src/components/modern-tree/index.js';

describe('Selection Fix Verification', () => {
  let container;
  let tree;
  let sampleData;

  beforeEach(() => {
    container = document.createElement('div');
    container.style.width = '600px';
    container.style.height = '400px';
    document.body.appendChild(container);
    
    // Use exact same data as demo
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

  test('should add child to selected node with the fixed demo function', async () => {
    console.log('=== TESTING FIXED DEMO FUNCTION ===');
    
    // Create tree exactly like demo
    let selectionCallbackFired = false;
    tree = ModernTree.create({
      dom: container,
      data: sampleData,
      theme: 'light',
      selectable: 'single',
      expandable: true,
      searchable: true,
      showIcons: true,
      showLines: true,
      onSelectionChange: (selectedNodes, selectionData) => {
        console.log('Selection changed in tree:', selectionData.map(n => n.name));
        selectionCallbackFired = true;
      }
    });

    await new Promise(resolve => setTimeout(resolve, 50));

    // Step 1: User clicks on documents node
    console.log('1. User clicks on documents node...');
    const documentsNode = container.querySelector('[data-node-id="documents"]');
    expect(documentsNode).toBeTruthy();
    documentsNode.click();
    await new Promise(resolve => setTimeout(resolve, 50));

    // Verify selection
    const selection = tree.getSelection();
    console.log('Selection after click:', selection.map(s => s.data.name));
    expect(selection.length).toBe(1);
    expect(selection[0].id).toBe('documents');
    expect(selectionCallbackFired).toBe(true);

    // Step 2: User clicks "Add Node" - simulate the FIXED demo function
    console.log('2. User clicks "Add Node" with FIXED function...');
    
    const addRandomNodeFixed = () => {
      console.log('addRandomNode called');
      
      // Get selected nodes BEFORE any operations
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
        
        if (addChildToNode(sampleData, selectedNodeId)) {
          // Update tree with new data (this will clear selection)
          tree.updateConfig({ data: [...sampleData] });
          
          // IMPORTANT: Restore the selection after data update
          console.log(`Restoring selection for node: ${selectedNodeId}`);
          tree.executeCommand('selectNode', { nodeId: selectedNodeId });
          
          // Then expand the parent node to show the new child
          tree.executeCommand('expandNode', { nodeId: selectedNodeId });
          console.log(`Expanded node ${selectedNodeId} to show new child`);
          
          return { success: true, addedTo: selectedNodeId, newNodeId: randomId };
        } else {
          console.warn(`Could not find selected node ${selectedNodeId}, adding to root`);
          sampleData.push(newNode);
          tree.updateConfig({ data: [...sampleData] });
          return { success: false, addedTo: 'root', newNodeId: randomId };
        }
      } else {
        // No selection, add to root level
        console.log('No selection, adding to root level');
        sampleData.push(newNode);
        tree.updateConfig({ data: [...sampleData] });
        return { success: false, addedTo: 'root', newNodeId: randomId };
      }
    };

    // Execute the fixed function
    const result = addRandomNodeFixed();
    await new Promise(resolve => setTimeout(resolve, 100));

    // Step 3: Verify the results
    console.log('3. Verifying results...');
    console.log('Add node result:', result);

    // Should have succeeded in adding to selected node
    expect(result.success).toBe(true);
    expect(result.addedTo).toBe('documents');

    // Verify selection is still active
    const finalSelection = tree.getSelection();
    console.log('Final selection:', finalSelection.map(s => s.data.name));
    expect(finalSelection.length).toBe(1);
    expect(finalSelection[0].id).toBe('documents');

    // Verify documents node is expanded
    const debug = tree.debug();
    const isExpanded = debug.model.isExpanded('documents');
    console.log('Documents expanded:', isExpanded);
    expect(isExpanded).toBe(true);

    // Verify the new child node is visible in DOM
    const newChildElement = container.querySelector(`[data-node-id="${result.newNodeId}"]`);
    console.log('New child visible:', newChildElement?.textContent);
    expect(newChildElement).toBeTruthy();

    // Verify final tree stats
    const stats = tree.getStats();
    console.log('Final tree stats:', {
      totalNodes: stats.totalNodes,
      selectedNodes: stats.selectedNodes,
      expandedNodes: stats.expandedNodes
    });

    expect(stats.selectedNodes).toBe(1); // Selection preserved
    expect(stats.expandedNodes).toBe(1); // Documents expanded
    expect(stats.totalNodes).toBeGreaterThan(4); // New node added

    console.log('✅ SUCCESS: Fixed demo function works perfectly!');
    console.log('✅ Child node added to selected parent');
    console.log('✅ Selection preserved after data update');
    console.log('✅ Parent node expanded to show child');
    console.log('✅ New child visible in DOM');
  });

  test('should handle multiple add operations correctly', async () => {
    console.log('=== TESTING MULTIPLE ADD OPERATIONS ===');
    
    tree = ModernTree.create({
      dom: container,
      data: sampleData,
      selectable: 'single'
    });

    await new Promise(resolve => setTimeout(resolve, 50));

    // Select documents node
    const documentsNode = container.querySelector('[data-node-id="documents"]');
    documentsNode.click();
    await new Promise(resolve => setTimeout(resolve, 50));

    // Add multiple children
    const addChild = (name) => {
      const selection = tree.getSelection();
      if (selection.length === 0) return false;

      const selectedNodeId = selection[0].id;
      const newNode = { id: `child_${Date.now()}`, name };

      // Add to data
      for (let node of sampleData) {
        if (node.id === selectedNodeId) {
          if (!node.children) node.children = [];
          node.children.push(newNode);
          break;
        }
      }

      // Update tree and restore selection
      tree.updateConfig({ data: [...sampleData] });
      tree.executeCommand('selectNode', { nodeId: selectedNodeId });
      tree.executeCommand('expandNode', { nodeId: selectedNodeId });
      
      return true;
    };

    // Add three children
    console.log('Adding first child...');
    expect(addChild('📄 Child 1')).toBe(true);
    await new Promise(resolve => setTimeout(resolve, 50));

    console.log('Adding second child...');
    expect(addChild('📄 Child 2')).toBe(true);
    await new Promise(resolve => setTimeout(resolve, 50));

    console.log('Adding third child...');
    expect(addChild('📄 Child 3')).toBe(true);
    await new Promise(resolve => setTimeout(resolve, 50));

    // Verify all children are visible
    const childElements = container.querySelectorAll('[data-node-id^="child_"]');
    console.log('Children found:', childElements.length);
    expect(childElements.length).toBe(3);

    // Verify selection is still maintained
    const finalSelection = tree.getSelection();
    expect(finalSelection.length).toBe(1);
    expect(finalSelection[0].id).toBe('documents');

    console.log('✅ Multiple add operations work correctly');
  });
});