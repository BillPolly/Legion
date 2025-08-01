/**
 * @jest-environment jsdom
 */

import { ModernTree } from '../src/components/modern-tree/index.js';

describe('Actual DOM Inspection Test', () => {
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

  test('should inspect actual DOM behavior and find the real bug', async () => {
    console.log('=== ACTUAL DOM INSPECTION TEST ===');
    
    // Create tree exactly like demo
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
        console.log('🔔 Selection callback fired:', selectionData.map(n => n.name));
      }
    });

    await new Promise(resolve => setTimeout(resolve, 100));

    // STEP 1: Inspect initial DOM state
    console.log('\n=== STEP 1: INITIAL DOM STATE ===');
    const allNodes = container.querySelectorAll('.tree-node');
    console.log('Total tree nodes in DOM:', allNodes.length);
    
    allNodes.forEach((node, i) => {
      const nodeId = node.getAttribute('data-node-id');
      const isSelected = node.classList.contains('selected');
      const isClickable = node.style.cursor === 'pointer' || getComputedStyle(node).cursor === 'pointer';
      console.log(`Node ${i}: ${nodeId} - Selected: ${isSelected} - Clickable: ${isClickable} - Text: "${node.textContent.trim()}"`);
    });

    const documentsNode = container.querySelector('[data-node-id="documents"]');
    console.log('\nDocuments node found:', !!documentsNode);
    console.log('Documents node classes:', documentsNode?.className);
    console.log('Documents node attributes:', documentsNode ? Array.from(documentsNode.attributes).map(a => `${a.name}="${a.value}"`).join(', ') : 'none');

    // STEP 2: Try to click and see what happens
    console.log('\n=== STEP 2: SIMULATING CLICK ===');
    console.log('Tree selection before click:', tree.getSelection().length);
    
    if (documentsNode) {
      console.log('Dispatching click event on documents node...');
      
      // Try multiple ways to click
      const clickEvent1 = new MouseEvent('click', { bubbles: true, cancelable: true });
      documentsNode.dispatchEvent(clickEvent1);
      
      await new Promise(resolve => setTimeout(resolve, 50));
      console.log('Selection after MouseEvent click:', tree.getSelection().length);
      
      // Try calling click() directly
      documentsNode.click();
      await new Promise(resolve => setTimeout(resolve, 50));
      console.log('Selection after .click():', tree.getSelection().length);
      
      // Try focusing and pressing space
      documentsNode.focus();
      const spaceEvent = new KeyboardEvent('keydown', { key: ' ', bubbles: true });
      documentsNode.dispatchEvent(spaceEvent);
      await new Promise(resolve => setTimeout(resolve, 50));
      console.log('Selection after space key:', tree.getSelection().length);
      
      // Check if node has event listeners
      console.log('Node event listeners (approximate check):');
      console.log('- onclick attribute:', documentsNode.getAttribute('onclick'));
      console.log('- has click handler:', documentsNode.onclick ? 'yes' : 'no');
    }

    // STEP 3: Check what actual event handlers are attached
    console.log('\n=== STEP 3: CHECKING EVENT HANDLERS ===');
    const treeContainer = container.querySelector('.modern-tree');
    if (treeContainer) {
      console.log('Tree container found:', !!treeContainer);
      console.log('Tree container event handlers:');
      console.log('- onclick:', treeContainer.onclick ? 'yes' : 'no');
      console.log('- has event listeners (approx):', treeContainer.addEventListener ? 'possible' : 'no');
      
      // Try clicking on the tree container itself
      console.log('Trying click on tree container...');
      treeContainer.click();
      await new Promise(resolve => setTimeout(resolve, 50));
      console.log('Selection after container click:', tree.getSelection().length);
    }

    // STEP 4: Force a selection to see what happens
    console.log('\n=== STEP 4: FORCE SELECTION VIA API ===');
    console.log('Forcing selection via executeCommand...');
    tree.executeCommand('selectNode', { nodeId: 'documents' });
    await new Promise(resolve => setTimeout(resolve, 50));
    
    const forcedSelection = tree.getSelection();
    console.log('Selection after forced select:', forcedSelection.length);
    
    if (forcedSelection.length > 0) {
      console.log('✅ API selection works!');
      console.log('Selected node:', forcedSelection[0].data.name);
      
      // Check if DOM reflects the selection
      const selectedElements = container.querySelectorAll('.tree-node.selected');
      console.log('DOM elements with selected class:', selectedElements.length);
      selectedElements.forEach((el, i) => {
        console.log(`Selected element ${i}:`, el.getAttribute('data-node-id'), el.textContent.trim());
      });
    } else {
      console.log('❌ Even API selection failed!');
    }

    // STEP 5: Now test add node with forced selection
    console.log('\n=== STEP 5: TEST ADD NODE WITH FORCED SELECTION ===');
    
    // Make sure we have a selection
    if (tree.getSelection().length === 0) {
      tree.executeCommand('selectNode', { nodeId: 'documents' });
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    
    const selectionBeforeAdd = tree.getSelection();
    console.log('Selection before add node:', selectionBeforeAdd.length);
    
    if (selectionBeforeAdd.length > 0) {
      console.log('Selected node ID:', selectionBeforeAdd[0].id);
      console.log('Selected node name:', selectionBeforeAdd[0].data.name);
      
      // Now add a child node
      const newNodeId = `test_child_${Date.now()}`;
      const newNode = { id: newNodeId, name: '🆕 Test Child' };
      
      // Add to documents children
      sampleData[0].children.push(newNode);
      console.log('Added child to sampleData');
      
      // Update tree
      console.log('Updating tree config...');
      tree.updateConfig({ data: [...sampleData] });
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Check selection after update
      const selectionAfterUpdate = tree.getSelection();
      console.log('Selection after data update:', selectionAfterUpdate.length);
      
      if (selectionAfterUpdate.length === 0) {
        console.log('❌ CONFIRMED: Data update clears selection');
        console.log('Restoring selection...');
        tree.executeCommand('selectNode', { nodeId: 'documents' });
        await new Promise(resolve => setTimeout(resolve, 50));
      }
      
      // Expand to show child
      tree.executeCommand('expandNode', { nodeId: 'documents' });
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Check if child is in DOM
      const childElement = container.querySelector(`[data-node-id="${newNodeId}"]`);
      console.log('Child node in DOM:', !!childElement);
      if (childElement) {
        console.log('Child node text:', childElement.textContent.trim());
        console.log('✅ Child node successfully added to selected parent');
      } else {
        console.log('❌ Child node not found in DOM');
        
        // Check where it actually went
        const allNodesAfter = container.querySelectorAll('.tree-node');
        console.log('All nodes after add:');
        allNodesAfter.forEach((node, i) => {
          const nodeId = node.getAttribute('data-node-id');
          console.log(`  ${i}: ${nodeId} - "${node.textContent.trim()}"`);
        });
      }
    }

    console.log('\n=== FINAL DOM STATE ===');
    const finalNodes = container.querySelectorAll('.tree-node');
    console.log('Final node count:', finalNodes.length);
    const finalSelection = tree.getSelection();
    console.log('Final selection:', finalSelection.length);
    if (finalSelection.length > 0) {
      console.log('Final selected node:', finalSelection[0].data.name);
    }
  });

  test('should find why click events are not working', async () => {
    console.log('\n=== CLICK EVENT DEBUGGING ===');
    
    tree = ModernTree.create({
      dom: container,
      data: sampleData,
      selectable: 'single',
      onSelectionChange: (nodes, data) => {
        console.log('🔔 Selection changed:', data.map(n => n.name));
      }
    });

    await new Promise(resolve => setTimeout(resolve, 100));

    const documentsNode = container.querySelector('[data-node-id="documents"]');
    
    // Add our own click listener to see if events are firing
    let ourClickFired = false;
    documentsNode.addEventListener('click', (e) => {
      console.log('🖱️  Our click listener fired!');
      console.log('Event target:', e.target.tagName, e.target.className);
      console.log('Event current target:', e.currentTarget.getAttribute('data-node-id'));
      ourClickFired = true;
    });

    // Try clicking
    console.log('Clicking documents node...');
    documentsNode.click();
    await new Promise(resolve => setTimeout(resolve, 100));
    
    console.log('Our click listener fired:', ourClickFired);
    console.log('Tree selection after click:', tree.getSelection().length);
    
    if (ourClickFired && tree.getSelection().length === 0) {
      console.log('❌ FOUND IT: Click events fire but tree selection is not working');
      console.log('This suggests the tree\'s click handler is not properly attached or not working');
    }
  });
});