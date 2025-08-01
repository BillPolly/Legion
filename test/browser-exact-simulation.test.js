/**
 * @jest-environment jsdom
 */

import { ModernTree } from '../src/components/modern-tree/index.js';

describe('Browser Exact Simulation', () => {
  let container;
  let tree;

  beforeEach(() => {
    // Create the exact same HTML structure as the demo
    document.body.innerHTML = `
      <div class="container">
        <div class="demo-section">
          <div class="demo-grid">
            <div class="tree-container" id="treeContainer" style="width: 600px; height: 400px;">
              <!-- ModernTree will be rendered here -->
            </div>
          </div>
        </div>
      </div>
    `;
    
    container = document.getElementById('treeContainer');
  });

  afterEach(() => {
    if (tree) {
      tree.destroy();
      tree = null;
    }
    document.body.innerHTML = '';
  });

  test('should simulate EXACT browser demo behavior', async () => {
    console.log('=== EXACT BROWSER DEMO SIMULATION ===');
    
    // Use the exact same data as demo
    const sampleData = [
      {
        id: 'documents',
        name: '📁 Documents',
        children: [
          {
            id: 'work',
            name: '💼 Work Projects',
            children: [
              { id: 'project1', name: '📊 Q4 Analysis.xlsx' },
              { id: 'project2', name: '📋 Meeting Notes.docx' },
              { id: 'project3', name: '📈 Budget Planning.pdf' },
              {
                id: 'archive',
                name: '📦 Archive',
                children: [
                  { id: 'old1', name: '📄 Old Report 1.pdf' },
                  { id: 'old2', name: '📄 Old Report 2.pdf' }
                ]
              }
            ]
          },
          {
            id: 'personal',
            name: '🏠 Personal',
            children: [
              { id: 'photos', name: '📸 Vacation Photos' },
              { id: 'recipes', name: '👨‍🍳 Favorite Recipes.txt' }
            ]
          }
        ]
      },
      {
        id: 'development',
        name: '💻 Development',
        children: [
          {
            id: 'projects',
            name: '🚀 Active Projects',
            children: [
              { id: 'webapp', name: '🌐 Modern Web App' },
              { id: 'mobile', name: '📱 Mobile App' },
              { id: 'api', name: '🔌 REST API Service' }
            ]
          },
          {
            id: 'tools',
            name: '🛠️ Development Tools',
            children: [
              { id: 'vscode', name: '⚡ VS Code Settings' },
              { id: 'git', name: '📝 Git Configs' }
            ]
          }
        ]
      },
      {
        id: 'media',
        name: '🎬 Media Collection',
        children: [
          { id: 'movies', name: '🎥 Movies' },
          { id: 'music', name: '🎵 Music Library' },
          { id: 'podcasts', name: '🎙️ Podcasts' }
        ]
      },
      { id: 'settings', name: '⚙️ System Settings' },
      { id: 'trash', name: '🗑️ Trash (Empty)' }
    ];

    // Initialize tree with EXACT same config as demo
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
      },
      onExpansionChange: () => {
        console.log('Expansion changed');
      },
      onSearchResults: (query, count, results) => {
        console.log(`Search "${query}" found ${count} results:`, results);
      }
    });

    await new Promise(resolve => setTimeout(resolve, 100));

    console.log('Tree initialized');
    console.log('Initial selection:', tree.getSelection().length);

    // SIMULATE EXACT USER WORKFLOW
    console.log('\n=== USER WORKFLOW SIMULATION ===');
    
    // 1. User clicks on documents node (like in browser)
    console.log('1. User clicks on Documents node...');
    const documentsNode = container.querySelector('[data-node-id="documents"]');
    expect(documentsNode).toBeTruthy();
    
    // Log DOM state before click
    console.log('Documents node before click:');
    console.log('- Selected class:', documentsNode.classList.contains('selected'));
    console.log('- aria-selected:', documentsNode.getAttribute('aria-selected'));
    
    // Simulate single click (like real user)
    documentsNode.click();
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Log DOM state after click
    console.log('Documents node after click:');
    console.log('- Selected class:', documentsNode.classList.contains('selected'));
    console.log('- aria-selected:', documentsNode.getAttribute('aria-selected'));
    
    const selectionAfterClick = tree.getSelection();
    console.log('Selection count after click:', selectionAfterClick.length);
    
    if (selectionAfterClick.length > 0) {
      console.log('✅ Selection working - selected:', selectionAfterClick[0].data.name);
    } else {
      console.log('❌ Selection not working');
      return; // Stop here if selection fails
    }

    // 2. Wait a moment (like user would)
    await new Promise(resolve => setTimeout(resolve, 200));
    
    // 3. Check selection is still there
    const selectionAfterWait = tree.getSelection();
    console.log('Selection after wait:', selectionAfterWait.length);
    
    if (selectionAfterWait.length === 0) {
      console.log('❌ Selection disappeared after waiting!');
      return;
    }

    // 4. User clicks "Add Node" - simulate the EXACT demo function
    console.log('\n2. User clicks Add Node button...');
    
    // Copy the exact demo function
    const addRandomNodeFromDemo = () => {
      console.log('addRandomNode called');
      
      // Get selected nodes BEFORE any operations
      const selection = tree.getSelection();
      console.log('Current selection:', selection);
      
      if (selection.length === 0) {
        console.log('❌ NO SELECTION FOUND - This is the bug!');
        return { success: false, reason: 'no_selection' };
      }
      
      // Generate new node data
      const randomId = `node_${Date.now()}`;
      const names = ['📄 New Document', '📁 New Folder', '🎨 New Asset', '📊 New Report'];
      const randomName = names[Math.floor(Math.random() * names.length)];
      
      // Create new node
      const newNode = {
        id: randomId,
        name: randomName
      };
      
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
        return { success: false, reason: 'node_not_found' };
      }
    };

    // Execute the demo function
    const result = addRandomNodeFromDemo();
    await new Promise(resolve => setTimeout(resolve, 150));
    
    console.log('Add node result:', result);
    
    if (result.success) {
      console.log('✅ SUCCESS: Node added to selected parent');
      
      // Verify child is visible
      const childElement = container.querySelector(`[data-node-id="${result.newNodeId}"]`);
      console.log('Child visible in DOM:', !!childElement);
      if (childElement) {
        console.log('Child text:', childElement.textContent.trim());
      }
      
      // Verify parent is expanded
      const debug = tree.debug();
      const isExpanded = debug.model.isExpanded(result.addedTo);
      console.log('Parent expanded:', isExpanded);
      
      // Final selection check
      const finalSelection = tree.getSelection();
      console.log('Final selection count:', finalSelection.length);
      if (finalSelection.length > 0) {
        console.log('Final selected node:', finalSelection[0].data.name);
      }
      
    } else {
      console.log('❌ FAILED:', result.reason);
      if (result.reason === 'no_selection') {
        console.log('🔍 DEBUGGING: Why is selection empty?');
        
        // Check if any nodes have selected class
        const selectedElements = container.querySelectorAll('.tree-node.selected');
        console.log('Elements with selected class:', selectedElements.length);
        
        // Check tree internal state
        const debug = tree.debug();
        console.log('Model selected nodes:', debug.model.getSelectedNodes());
        
        // Check if there's a timing issue
        console.log('Retrying selection check after delay...');
        await new Promise(resolve => setTimeout(resolve, 300));
        const delayedSelection = tree.getSelection();
        console.log('Selection after delay:', delayedSelection.length);
      }
    }
  });
});