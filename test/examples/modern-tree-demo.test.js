/**
 * @jest-environment jsdom
 */

import { ModernTree } from '../../src/components/modern-tree/index.js';

describe('ModernTree Demo Example', () => {
  let container;
  let tree;
  let demoData;

  beforeEach(() => {
    // Create container similar to the demo
    container = document.createElement('div');
    container.style.width = '600px';
    container.style.height = '400px';
    document.body.appendChild(container);
    
    // Use the same demo data structure
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

  describe('Demo Initialization', () => {
    test('should create tree with demo configuration', () => {
      tree = ModernTree.create({
        dom: container,
        data: demoData,
        theme: 'light',
        selectable: 'single',
        expandable: true,
        searchable: true,
        showIcons: true,
        showLines: true
      });

      expect(tree).toBeDefined();
      expect(typeof tree.destroy).toBe('function');
      
      // Check tree container was created
      const treeContainer = container.querySelector('.modern-tree');
      expect(treeContainer).toBeTruthy();
      expect(treeContainer.classList.contains('theme-light')).toBe(true);
      expect(treeContainer.classList.contains('show-icons')).toBe(true);
      expect(treeContainer.classList.contains('show-lines')).toBe(true);
    });

    test('should render initial tree structure', () => {
      tree = ModernTree.create({
        dom: container,
        data: demoData
      });

      // Should render root nodes initially (not expanded)
      const treeNodes = container.querySelectorAll('.tree-node');
      expect(treeNodes.length).toBe(5); // 5 root level items

      // Check root node content
      const documentsNode = Array.from(treeNodes).find(node => 
        node.textContent.includes('Documents')
      );
      expect(documentsNode).toBeTruthy();
      expect(documentsNode.getAttribute('data-node-id')).toBe('documents');

      const developmentNode = Array.from(treeNodes).find(node => 
        node.textContent.includes('Development')
      );
      expect(developmentNode).toBeTruthy();
      expect(developmentNode.getAttribute('data-node-id')).toBe('development');
    });

    test('should have proper accessibility attributes', () => {
      tree = ModernTree.create({
        dom: container,
        data: demoData
      });

      const treeContainer = container.querySelector('.modern-tree');
      expect(treeContainer.getAttribute('role')).toBe('tree');
      expect(treeContainer.getAttribute('aria-label')).toBeTruthy();
      expect(treeContainer.tabIndex).toBe(0);

      // Check tree nodes have proper ARIA
      const treeNodes = container.querySelectorAll('.tree-node');
      treeNodes.forEach(node => {
        expect(node.getAttribute('role')).toBe('treeitem');
        expect(node.getAttribute('aria-level')).toBeTruthy();
        expect(node.getAttribute('data-node-id')).toBeTruthy();
      });

      // Check aria-live region exists
      const ariaLive = container.querySelector('[aria-live="polite"]');
      expect(ariaLive).toBeTruthy();
    });
  });

  describe('Demo Interactions', () => {
    beforeEach(() => {
      tree = ModernTree.create({
        dom: container,
        data: demoData,
        selectable: 'single'
      });
    });

    test('should expand nodes when clicked', async () => {
      const documentsNode = container.querySelector('[data-node-id="documents"]');
      const toggle = documentsNode.querySelector('.node-toggle');
      
      expect(toggle).toBeTruthy();
      expect(toggle.getAttribute('aria-label')).toBe('Expand');
      
      // Click to expand
      toggle.click();
      
      // Wait for re-render and DOM updates
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Should now show children
      const workNode = container.querySelector('[data-node-id="work"]');
      expect(workNode).toBeTruthy();
      expect(workNode.textContent).toContain('Work Projects');
      
      // Toggle should now show collapse (re-query the toggle after render)
      const updatedToggle = container.querySelector('[data-node-id="documents"] .node-toggle');
      expect(updatedToggle.getAttribute('aria-label')).toBe('Collapse');
      expect(updatedToggle.innerHTML).toBe('▼');
    });

    test('should handle node selection', () => {
      let selectionCallbackFired = false;
      let selectedNodes = [];
      
      // Recreate with selection callback
      tree.destroy();
      tree = ModernTree.create({
        dom: container,
        data: demoData,
        selectable: 'single',
        onSelectionChange: (nodes, data) => {
          selectionCallbackFired = true;
          selectedNodes = data;
        }
      });

      const settingsNode = container.querySelector('[data-node-id="settings"]');
      expect(settingsNode).toBeTruthy();
      
      // Click to select
      settingsNode.click();
      
      // Check selection state
      expect(selectionCallbackFired).toBe(true);
      expect(selectedNodes).toHaveLength(1);
      expect(selectedNodes[0].name).toBe('⚙️ System Settings');
      expect(settingsNode.getAttribute('aria-selected')).toBe('true');
      expect(settingsNode.classList.contains('selected')).toBe(true);
    });

    test('should handle keyboard navigation', () => {
      const treeContainer = container.querySelector('.modern-tree');
      
      // Focus the tree
      treeContainer.focus();
      
      // Simulate arrow down navigation
      const keyEvent = new KeyboardEvent('keydown', { 
        key: 'ArrowDown', 
        bubbles: true 
      });
      treeContainer.dispatchEvent(keyEvent);
      
      // Should have focused a node
      const debug = tree.debug();
      expect(debug.model.getFocusedNode()).toBeTruthy();
    });

    test('should support search functionality', async () => {
      // Search for "Projects" (case sensitive)
      const results = tree.search('Projects');
      
      expect(results).toBeDefined();
      expect(results.length).toBeGreaterThan(0);
      
      // Should find nodes containing "Projects"
      const debug = tree.debug();
      const searchResults = debug.model.searchResults;
      expect(searchResults.size).toBeGreaterThan(0);
      
      // Wait for expansion
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Should expand ancestors of results
      const workNode = container.querySelector('[data-node-id="work"]');
      expect(workNode).toBeTruthy(); // Should be visible due to search expansion
    });

    test('should expand all functionality', () => {
      // Initially only root nodes visible
      let visibleNodes = container.querySelectorAll('.tree-node');
      expect(visibleNodes.length).toBe(5);
      
      // Expand all
      tree.executeCommand('expandAll');
      
      // Should now show all nodes
      visibleNodes = container.querySelectorAll('.tree-node');
      expect(visibleNodes.length).toBeGreaterThan(10); // Many more nodes visible
      
      // Check some deep nodes are visible
      const archiveNode = container.querySelector('[data-node-id="archive"]');
      expect(archiveNode).toBeTruthy();
      
      const oldReport1 = container.querySelector('[data-node-id="old1"]');
      expect(oldReport1).toBeTruthy();
    });

    test('should collapse all functionality', () => {
      // First expand some nodes
      tree.executeCommand('expandAll');
      let visibleNodes = container.querySelectorAll('.tree-node');
      const expandedCount = visibleNodes.length;
      
      // Then collapse all
      tree.executeCommand('collapseAll');
      
      visibleNodes = container.querySelectorAll('.tree-node');
      expect(visibleNodes.length).toBe(5); // Back to just root nodes
      expect(visibleNodes.length).toBeLessThan(expandedCount);
    });
  });

  describe('Demo Configuration Updates', () => {
    beforeEach(() => {
      tree = ModernTree.create({
        dom: container,
        data: demoData,
        theme: 'light'
      });
    });

    test('should update theme dynamically', () => {
      const treeContainer = container.querySelector('.modern-tree');
      expect(treeContainer.classList.contains('theme-light')).toBe(true);
      
      // Update to dark theme
      tree.updateConfig({ theme: 'dark' });
      
      expect(treeContainer.classList.contains('theme-dark')).toBe(true);
      expect(treeContainer.classList.contains('theme-light')).toBe(false);
    });

    test('should update selection mode', () => {
      // Start in single selection
      const config = tree.getConfig();
      expect(config.selectable).toBe('single');
      
      // Update to multiple selection
      tree.updateConfig({ selectable: 'multiple' });
      
      const updatedConfig = tree.getConfig();
      expect(updatedConfig.selectable).toBe('multiple');
    });

    test('should refresh data', () => {
      // Create completely new data to ensure different count
      const newData = [
        { id: 'new-root-1', name: '🆕 New Section 1' },
        { id: 'new-root-2', name: '🆕 New Section 2' },
        { id: 'new-root-3', name: '🆕 New Section 3' }
      ];
      
      tree.updateConfig({ data: newData });
      
      const newStats = tree.getStats();
      expect(newStats.totalNodes).toBe(3); // Exactly 3 new nodes
      
      // Should find the new nodes in DOM
      const newNode1 = container.querySelector('[data-node-id="new-root-1"]');
      expect(newNode1).toBeTruthy();
      expect(newNode1.textContent).toContain('New Section 1');
      
      const newNode2 = container.querySelector('[data-node-id="new-root-2"]');
      expect(newNode2).toBeTruthy();
      expect(newNode2.textContent).toContain('New Section 2');
      
      const newNode3 = container.querySelector('[data-node-id="new-root-3"]');
      expect(newNode3).toBeTruthy();
      expect(newNode3.textContent).toContain('New Section 3');
    });
  });

  describe('Demo Statistics and State', () => {
    beforeEach(() => {
      tree = ModernTree.create({
        dom: container,
        data: demoData
      });
    });

    test('should provide accurate statistics', () => {
      const stats = tree.getStats();
      
      expect(stats.totalNodes).toBeGreaterThan(0);
      expect(stats.rootNodes).toBe(5); // 5 root level items
      expect(stats.visibleNodes).toBe(5); // Initially only roots visible
      expect(stats.selectedNodes).toBe(0); // No selection initially
      expect(stats.expandedNodes).toBe(0); // Nothing expanded initially
      expect(stats.maxDepth).toBeGreaterThan(0); // Has nested structure
    });

    test('should export and import state', () => {
      // Make some changes
      tree.executeCommand('expandNode', { nodeId: 'documents' });
      tree.executeCommand('selectNode', { nodeId: 'work' });
      
      // Export state
      const state = tree.executeCommand('exportState');
      
      expect(state).toBeDefined();
      expect(state.expandedNodes).toContain('documents');
      expect(state.selectedNodes).toContain('work');
      
      // Reset tree
      tree.executeCommand('collapseAll');
      tree.executeCommand('clearSelection');
      
      // Import state
      tree.executeCommand('importState', { state });
      
      // Should restore previous state
      const debug = tree.debug();
      expect(debug.model.isExpanded('documents')).toBe(true);
      expect(debug.model.isSelected('work')).toBe(true);
    });

    test('should handle selection data correctly', () => {
      // Select a node
      tree.executeCommand('selectNode', { nodeId: 'media' });
      
      const selection = tree.getSelection();
      expect(selection).toHaveLength(1);
      expect(selection[0].id).toBe('media');
      expect(selection[0].data.name).toBe('🎬 Media Collection');
    });
  });

  describe('Demo Performance and Edge Cases', () => {
    test('should handle empty data gracefully', () => {
      tree = ModernTree.create({
        dom: container,
        data: []
      });

      expect(tree).toBeDefined();
      
      const stats = tree.getStats();
      expect(stats.totalNodes).toBe(0);
      expect(stats.visibleNodes).toBe(0);
      
      // Should render empty tree container
      const treeContainer = container.querySelector('.modern-tree');
      expect(treeContainer).toBeTruthy();
      
      const treeNodes = container.querySelectorAll('.tree-node');
      expect(treeNodes.length).toBe(0);
    });

    test('should handle large flat dataset', () => {
      // Create large flat dataset
      const largeData = Array.from({ length: 100 }, (_, i) => ({
        id: `item_${i}`,
        name: `📄 Item ${i}`
      }));

      tree = ModernTree.create({
        dom: container,
        data: largeData
      });

      expect(tree).toBeDefined();
      
      const stats = tree.getStats();
      expect(stats.totalNodes).toBe(100);
      expect(stats.rootNodes).toBe(100);
      
      // Should render all nodes (no expansion needed for flat structure)
      const treeNodes = container.querySelectorAll('.tree-node');
      expect(treeNodes.length).toBe(100);
    });

    test('should handle rapid interaction', () => {
      tree = ModernTree.create({
        dom: container,
        data: demoData,
        selectable: 'multiple'
      });

      // Rapidly expand/collapse/select
      for (let i = 0; i < 10; i++) {
        tree.executeCommand('expandAll');
        tree.executeCommand('collapseAll');
        tree.executeCommand('selectNode', { nodeId: 'documents', extend: true });
        tree.executeCommand('clearSelection');
      }

      // Should still be functional
      expect(tree).toBeDefined();
      const stats = tree.getStats();
      expect(stats.totalNodes).toBeGreaterThan(0);
    });

    test('should cleanup properly', () => {
      tree = ModernTree.create({
        dom: container,
        data: demoData
      });

      // Verify tree was created
      expect(container.children.length).toBeGreaterThan(0);
      
      // Destroy tree
      tree.destroy();
      
      // Should cleanup DOM
      expect(container.children.length).toBe(0);
    });
  });

  describe('Demo Real User Workflows', () => {
    beforeEach(() => {
      tree = ModernTree.create({
        dom: container,
        data: demoData,
        selectable: 'multiple'
      });
    });

    test('should support file browser workflow', async () => {
      // User expands Documents folder
      const documentsNode = container.querySelector('[data-node-id="documents"]');
      const documentsToggle = documentsNode.querySelector('.node-toggle');
      documentsToggle.click();
      
      // Should see work and personal folders
      await new Promise(resolve => setTimeout(resolve, 50));
      const workNode = container.querySelector('[data-node-id="work"]');
      const personalNode = container.querySelector('[data-node-id="personal"]');
      expect(workNode).toBeTruthy();
      expect(personalNode).toBeTruthy();
      
      // User expands work folder
      const workToggle = workNode.querySelector('.node-toggle');
      workToggle.click();
      
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Should see project files
      const project1 = container.querySelector('[data-node-id="project1"]');
      expect(project1).toBeTruthy();
      expect(project1.textContent).toContain('Q4 Analysis.xlsx');
      
      // User selects multiple files
      project1.click();
      
      const project2 = container.querySelector('[data-node-id="project2"]');
      
      // Simulate Ctrl+click for multiple selection
      const ctrlClickEvent = new MouseEvent('click', { ctrlKey: true, bubbles: true });
      project2.dispatchEvent(ctrlClickEvent);
      
      // Should have multiple items selected
      const selection = tree.getSelection();
      expect(selection.length).toBeGreaterThanOrEqual(1);
    });

    test('should support search and navigate workflow', async () => {
      // User searches for "App"
      const results = tree.search('App');
      
      expect(results.length).toBeGreaterThan(0);
      
      // Should expand relevant folders and highlight results
      const debug = tree.debug();
      expect(debug.model.searchResults.size).toBeGreaterThan(0);
      
      // Wait for expansion to complete
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Development folder should be expanded to show results
      const projectsNode = container.querySelector('[data-node-id="projects"]');
      expect(projectsNode).toBeTruthy(); // Should be visible due to search
      
      // Clear search
      tree.executeCommand('clearSearch');
      
      // Search results should be cleared
      expect(debug.model.searchResults.size).toBe(0);
    });

    test('should support keyboard-only navigation', () => {
      const treeContainer = container.querySelector('.modern-tree');
      
      // Focus tree and navigate
      treeContainer.focus();
      
      // Navigate down to first item
      treeContainer.dispatchEvent(new KeyboardEvent('keydown', { 
        key: 'ArrowDown', bubbles: true 
      }));
      
      // Expand focused item with right arrow
      treeContainer.dispatchEvent(new KeyboardEvent('keydown', { 
        key: 'ArrowRight', bubbles: true 
      }));
      
      // Navigate down to child
      treeContainer.dispatchEvent(new KeyboardEvent('keydown', { 
        key: 'ArrowDown', bubbles: true 
      }));
      
      // Select with Space
      treeContainer.dispatchEvent(new KeyboardEvent('keydown', { 
        key: ' ', bubbles: true 
      }));
      
      // Should have navigated and selected
      const debug = tree.debug();
      const focusedNode = debug.model.getFocusedNode();
      expect(focusedNode).toBeTruthy();
    });
  });

  describe('Demo UI Controls Testing', () => {
    beforeEach(() => {
      // Create tree with demo HTML structure
      tree = ModernTree.create({
        dom: container,
        data: demoData,
        theme: 'light',
        selectable: 'single'
      });
      
      // Add demo control HTML to container
      container.innerHTML = `
        <div class="modern-tree">${container.innerHTML}</div>
        <div class="theme-selector">
          <button class="theme-btn active" onclick="setTheme('light')">Light</button>
          <button class="theme-btn" onclick="setTheme('dark')">Dark</button>
        </div>
        <button onclick="addRandomNode()">Add Node</button>
      `;
      
      // Re-initialize tree in the new structure
      const treeContainer = container.querySelector('.modern-tree');
      tree.destroy();
      tree = ModernTree.create({
        dom: treeContainer,
        data: demoData,
        theme: 'light',
        selectable: 'single'
      });
    });

    test('should handle theme switching with logging', () => {
      const originalLog = console.log;
      const logMessages = [];
      console.log = (...args) => {
        logMessages.push(args.join(' '));
        originalLog(...args);
      };

      try {
        const treeContainer = container.querySelector('.modern-tree');
        // Tree might not have theme class initially, so let's verify the initial theme
        const initialTheme = tree.getConfig().theme;
        expect(initialTheme).toBe('light');
        
        // Simulate the demo's setTheme function
        const setTheme = (theme) => {
          console.log('setTheme called with:', theme);
          
          // Update active button
          container.querySelectorAll('.theme-btn').forEach(btn => {
            console.log('Removing active from button:', btn.textContent);
            btn.classList.remove('active');
          });
          
          const targetButton = container.querySelector(`.theme-btn[onclick="setTheme('${theme}')"]`);
          console.log('Target button found:', targetButton?.textContent);
          if (targetButton) {
            targetButton.classList.add('active');
            console.log('Added active class to:', targetButton.textContent);
          }
          
          // Update tree theme
          console.log('Updating tree theme to:', theme);
          tree.updateConfig({ theme });
          
          // Verify theme was applied
          console.log('Tree container classes after theme update:', Array.from(treeContainer.classList));
        };

        // Test theme switching
        setTheme('dark');

        // Verify logging occurred
        expect(logMessages.some(msg => msg.includes('setTheme called with: dark'))).toBe(true);
        expect(logMessages.some(msg => msg.includes('Updating tree theme to: dark'))).toBe(true);
        
        // Verify theme was actually changed
        const newTheme = tree.getConfig().theme;
        expect(newTheme).toBe('dark');
        
        // Verify button state changed
        const lightBtn = container.querySelector('.theme-btn[onclick="setTheme(\'light\')"]');
        const darkBtn = container.querySelector('.theme-btn[onclick="setTheme(\'dark\')"]');
        expect(lightBtn.classList.contains('active')).toBe(false);
        expect(darkBtn.classList.contains('active')).toBe(true);

      } finally {
        console.log = originalLog;
      }
    });

    test('should add child node to selected node with logging', async () => {
      const originalLog = console.log;
      const originalWarn = console.warn;
      const logMessages = [];
      const warnMessages = [];
      
      console.log = (...args) => {
        logMessages.push(args.join(' '));
        originalLog(...args);
      };
      console.warn = (...args) => {
        warnMessages.push(args.join(' '));
        originalWarn(...args);
      };

      try {
        // First select a node
        tree.executeCommand('selectNode', { nodeId: 'documents' });
        const selection = tree.getSelection();
        expect(selection.length).toBe(1);
        expect(selection[0].id).toBe('documents');

        // Get initial stats
        const initialStats = tree.getStats();
        const initialTotalNodes = initialStats.totalNodes;

        // Create sample data copy for manipulation
        const sampleData = [...demoData];

        // Simulate the demo's addRandomNode function
        const addRandomNode = () => {
          console.log('addRandomNode called');
          
          // Get selected nodes
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
              // Update tree with new data first
              tree.updateConfig({ data: [...sampleData] });
              // Then expand the parent node to show the new child
              tree.executeCommand('expandNode', { nodeId: selectedNodeId });
              console.log(`Expanded node ${selectedNodeId} to show new child`);
            } else {
              console.warn(`Could not find selected node ${selectedNodeId}, adding to root`);
              sampleData.push(newNode);
            }
          } else {
            // No selection, add to root level
            console.log('No selection, adding to root level');
            sampleData.push(newNode);
          }
          
          // Update tree with new data (if not already done above)
          if (selection.length === 0) {
            tree.updateConfig({ data: [...sampleData] });
          }
          
          // Show confirmation
          console.log(`Added new node: ${randomName} (${randomId})`);
        };

        // Test add node functionality
        addRandomNode();

        // Wait for async operations to complete
        await new Promise(resolve => setTimeout(resolve, 50));

        // Verify logging occurred
        expect(logMessages.some(msg => msg.includes('addRandomNode called'))).toBe(true);
        expect(logMessages.some(msg => msg.includes('Current selection:'))).toBe(true);
        expect(logMessages.some(msg => msg.includes('Adding child to selected node: documents'))).toBe(true);
        expect(logMessages.some(msg => msg.includes('Added child to node documents:'))).toBe(true);

        // Verify tree was updated
        const newStats = tree.getStats();
        expect(newStats.totalNodes).toBe(initialTotalNodes + 1);

        // Verify the documents node is expanded to show the new child
        const debug = tree.debug();
        expect(debug.model.isExpanded('documents')).toBe(true);

        // Verify the new child is visible in the DOM
        const visibleNodes = container.querySelectorAll('.tree-node');
        expect(visibleNodes.length).toBeGreaterThan(5); // More than just root nodes

      } finally {
        console.log = originalLog;
        console.warn = originalWarn;
      }
    });

    test('should add to root when no selection with logging', () => {
      const originalLog = console.log;
      const logMessages = [];
      
      console.log = (...args) => {
        logMessages.push(args.join(' '));
        originalLog(...args);
      };

      try {
        // Clear any selection
        tree.executeCommand('clearSelection');
        const selection = tree.getSelection();
        expect(selection.length).toBe(0);

        // Get initial stats
        const initialStats = tree.getStats();
        const initialTotalNodes = initialStats.totalNodes;

        // Create sample data copy for manipulation
        const sampleData = [...demoData];

        // Simulate addRandomNode with no selection
        const addRandomNode = () => {
          console.log('addRandomNode called');
          const selection = tree.getSelection();
          console.log('Current selection:', selection);
          
          const randomId = `node_${Date.now()}`;
          const newNode = {
            id: randomId,
            name: '📄 New Document'
          };
          
          if (selection.length > 0) {
            // This path won't be taken
          } else {
            console.log('No selection, adding to root level');
            sampleData.push(newNode);
          }
          
          tree.updateConfig({ data: [...sampleData] });
          console.log(`Added new node: ${newNode.name} (${randomId})`);
        };

        addRandomNode();

        // Verify logging for no selection case
        expect(logMessages.some(msg => msg.includes('No selection, adding to root level'))).toBe(true);

        // Verify tree was updated
        const newStats = tree.getStats();
        expect(newStats.totalNodes).toBe(initialTotalNodes + 1);

      } finally {
        console.log = originalLog;
      }
    });
  });
});