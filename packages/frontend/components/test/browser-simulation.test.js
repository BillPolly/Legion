/**
 * @jest-environment jsdom
 */

import { ModernTree } from '../src/components/modern-tree/index.js';

describe('Browser Simulation Tests', () => {
  let container;
  let tree;
  let testData;

  beforeEach(() => {
    container = document.createElement('div');
    container.style.width = '400px';
    container.style.height = '300px';
    document.body.appendChild(container);
    
    testData = [
      {
        id: 'root1',
        name: '📁 Root Folder 1',
        children: [
          { id: 'child1', name: '📄 Child 1' },
          { id: 'child2', name: '📄 Child 2' }
        ]
      },
      {
        id: 'root2', 
        name: '📁 Root Folder 2'
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

  describe('Issue 1: Node Selection Problem', () => {
    test('should actually select nodes when clicked in browser simulation', async () => {
      // Capture selection changes
      let selectionCallbackData = null;
      
      tree = ModernTree.create({
        dom: container,
        data: testData,
        selectable: 'single',
        onSelectionChange: (nodes, data) => {
          console.log('Selection change callback fired:', data);
          selectionCallbackData = data;
        }
      });

      // Verify initial state
      const initialSelection = tree.getSelection();
      console.log('Initial selection:', initialSelection);
      expect(initialSelection.length).toBe(0);

      // Find the first root node element
      const firstNodeElement = container.querySelector('.tree-node[data-node-id="root1"]');
      expect(firstNodeElement).toBeTruthy();
      console.log('Found first node element:', firstNodeElement.textContent);

      // Simulate clicking the node exactly like a browser would
      const clickEvent = new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
        view: window
      });
      
      console.log('Simulating click on first node...');
      firstNodeElement.dispatchEvent(clickEvent);

      // Wait for any async processing
      await new Promise(resolve => setTimeout(resolve, 50));

      // Check selection after click
      const selectionAfterClick = tree.getSelection();
      console.log('Selection after click:', selectionAfterClick);
      console.log('Selection callback data:', selectionCallbackData);

      // This should pass if selection is working
      expect(selectionAfterClick.length).toBe(1);
      expect(selectionAfterClick[0].id).toBe('root1');
      expect(selectionCallbackData).not.toBeNull();
      expect(selectionCallbackData.length).toBe(1);
    });

    test('should be able to add child to selected node', async () => {
      tree = ModernTree.create({
        dom: container,
        data: testData,
        selectable: 'single'
      });

      // First select a node
      const firstNodeElement = container.querySelector('.tree-node[data-node-id="root1"]');
      firstNodeElement.click();
      await new Promise(resolve => setTimeout(resolve, 50));

      // Verify selection
      const selection = tree.getSelection();
      console.log('Selection before add:', selection);
      expect(selection.length).toBe(1);

      // Now test adding a child node (simulate the exact demo behavior)
      const selectedNodeId = selection[0].id;
      const newNodeId = `test_child_${Date.now()}`;
      const newNode = {
        id: newNodeId,
        name: '🆕 Test Child'
      };

      // Modify the data structure (like the demo does)
      const modifiedData = JSON.parse(JSON.stringify(testData)); // Deep copy
      const addChildToNode = (nodes, targetId) => {
        for (let node of nodes) {
          if (node.id === targetId) {
            if (!node.children) {
              node.children = [];
            }
            node.children.push(newNode);
            return true;
          }
          if (node.children && addChildToNode(node.children, targetId)) {
            return true;
          }
        }
        return false;
      };

      const success = addChildToNode(modifiedData, selectedNodeId);
      expect(success).toBe(true);

      // Update tree data
      tree.updateConfig({ data: modifiedData });
      tree.executeCommand('expandNode', { nodeId: selectedNodeId });
      
      await new Promise(resolve => setTimeout(resolve, 100));

      // Check if child node is visible
      const childElement = container.querySelector(`[data-node-id="${newNodeId}"]`);
      console.log('Child element found:', childElement?.textContent);
      expect(childElement).toBeTruthy();

      // Verify tree stats
      const stats = tree.getStats();
      console.log('Tree stats after add:', stats);
      expect(stats.totalNodes).toBeGreaterThan(4); // Original 4 + new child
    });
  });

  describe('Issue 2: Theme Switching Problem', () => {
    test('should actually apply theme classes when theme is changed', async () => {
      tree = ModernTree.create({
        dom: container,
        data: testData,
        theme: 'light'
      });

      const treeElement = container.querySelector('.modern-tree');
      expect(treeElement).toBeTruthy();

      console.log('Initial classes:', Array.from(treeElement.classList));
      console.log('Initial theme config:', tree.getConfig().theme);

      // Change to dark theme
      console.log('Changing to dark theme...');
      tree.updateConfig({ theme: 'dark' });

      await new Promise(resolve => setTimeout(resolve, 100));

      console.log('Classes after dark theme:', Array.from(treeElement.classList));
      console.log('Config after dark theme:', tree.getConfig().theme);

      // Check if theme classes are applied
      const hasDarkClass = treeElement.classList.contains('theme-dark');
      const hasLightClass = treeElement.classList.contains('theme-light');

      console.log('Has dark class:', hasDarkClass);
      console.log('Has light class:', hasLightClass);

      expect(tree.getConfig().theme).toBe('dark');
      
      // The visual theme should be applied
      if (!hasDarkClass) {
        console.error('❌ Dark theme class not applied!');
        console.log('Full class list:', treeElement.className);
      }
      
      expect(hasDarkClass).toBe(true);
      expect(hasLightClass).toBe(false);

      // Change back to light theme
      console.log('Changing back to light theme...');
      tree.updateConfig({ theme: 'light' });

      await new Promise(resolve => setTimeout(resolve, 100));

      console.log('Classes after light theme:', Array.from(treeElement.classList));

      const hasLightClassAfter = treeElement.classList.contains('theme-light');
      const hasDarkClassAfter = treeElement.classList.contains('theme-dark');

      expect(hasLightClassAfter).toBe(true);
      expect(hasDarkClassAfter).toBe(false);
    });

    test('should handle rapid theme changes correctly', async () => {
      tree = ModernTree.create({
        dom: container,
        data: testData,
        theme: 'light'
      });

      const treeElement = container.querySelector('.modern-tree');

      // Rapidly change themes
      for (let i = 0; i < 5; i++) {
        const theme = i % 2 === 0 ? 'dark' : 'light';
        console.log(`Setting theme to: ${theme}`);
        tree.updateConfig({ theme });
        await new Promise(resolve => setTimeout(resolve, 20));
      }

      // Final state should be light
      await new Promise(resolve => setTimeout(resolve, 100));
      
      console.log('Final classes:', Array.from(treeElement.classList));
      console.log('Final config theme:', tree.getConfig().theme);

      expect(tree.getConfig().theme).toBe('light');
      expect(treeElement.classList.contains('theme-light')).toBe(true);
      expect(treeElement.classList.contains('theme-dark')).toBe(false);
    });
  });

  describe('Demo Simulation Test', () => {
    test('should simulate exact demo behavior', async () => {
      // Create demo-like environment
      const demoContainer = document.createElement('div');
      demoContainer.innerHTML = `
        <div class="tree-container"></div>
        <div class="theme-selector">
          <button class="theme-btn active" data-theme="light">Light</button>
          <button class="theme-btn" data-theme="dark">Dark</button>
        </div>
        <button id="addNodeBtn">Add Node</button>
      `;
      document.body.appendChild(demoContainer);

      const treeContainer = demoContainer.querySelector('.tree-container');
      
      tree = ModernTree.create({
        dom: treeContainer,
        data: testData,
        theme: 'light',
        selectable: 'single',
        onSelectionChange: (nodes, data) => {
          console.log('Demo selection change:', data.map(n => n.name));
        }
      });

      // Test 1: Select a node by clicking
      console.log('=== Testing node selection ===');
      const nodeToSelect = treeContainer.querySelector('[data-node-id="root1"]');
      expect(nodeToSelect).toBeTruthy();
      
      nodeToSelect.click();
      await new Promise(resolve => setTimeout(resolve, 50));
      
      const selection = tree.getSelection();
      console.log('Selected nodes:', selection.map(s => s.data.name));
      expect(selection.length).toBe(1);

      // Test 2: Add child node to selection
      console.log('=== Testing add child node ===');
      const initialNodeCount = tree.getStats().totalNodes;
      
      // Simulate the demo's add node function
      const addNodeToSelected = () => {
        const currentSelection = tree.getSelection();
        console.log('Current selection for add:', currentSelection);
        
        if (currentSelection.length === 0) {
          console.log('❌ No selection found!');
          return false;
        }

        const newNode = {
          id: `demo_child_${Date.now()}`,
          name: '🆕 Demo Child'
        };

        // Modify data like demo does
        const modifiedData = JSON.parse(JSON.stringify(testData));
        const selectedNodeId = currentSelection[0].id;
        
        const addChild = (nodes, targetId) => {
          for (let node of nodes) {
            if (node.id === targetId) {
              if (!node.children) node.children = [];
              node.children.push(newNode);
              return true;
            }
            if (node.children && addChild(node.children, targetId)) {
              return true;
            }
          }
          return false;
        };

        if (addChild(modifiedData, selectedNodeId)) {
          tree.updateConfig({ data: modifiedData });
          tree.executeCommand('expandNode', { nodeId: selectedNodeId });
          console.log('✅ Added child to selected node');
          return true;
        }
        
        console.log('❌ Failed to add child');
        return false;
      };

      const addSuccess = addNodeToSelected();
      expect(addSuccess).toBe(true);
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const finalNodeCount = tree.getStats().totalNodes;
      console.log(`Node count: ${initialNodeCount} -> ${finalNodeCount}`);
      expect(finalNodeCount).toBe(initialNodeCount + 1);

      // Test 3: Theme switching
      console.log('=== Testing theme switching ===');
      const treeElement = treeContainer.querySelector('.modern-tree');
      
      // Simulate clicking dark theme button
      const darkButton = demoContainer.querySelector('[data-theme="dark"]');
      const lightButton = demoContainer.querySelector('[data-theme="light"]');
      
      console.log('Switching to dark theme...');
      lightButton.classList.remove('active');
      darkButton.classList.add('active');
      tree.updateConfig({ theme: 'dark' });
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      console.log('Theme classes after dark:', Array.from(treeElement.classList));
      expect(treeElement.classList.contains('theme-dark')).toBe(true);

      // Cleanup
      document.body.removeChild(demoContainer);
    });
  });
});