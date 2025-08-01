/**
 * @jest-environment jsdom
 */

import { ModernTree } from '../src/components/modern-tree/index.js';

describe('Theme Visual Changes Test', () => {
  let container;
  let tree;

  beforeEach(() => {
    container = document.createElement('div');
    container.style.width = '400px';
    container.style.height = '300px';
    document.body.appendChild(container);
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

  test('should have visually different themes', async () => {
    const testData = [
      { id: 'test1', name: '📁 Test Folder' },
      { id: 'test2', name: '📄 Test File' }
    ];

    tree = ModernTree.create({
      dom: container,
      data: testData,
      theme: 'light'
    });

    const treeElement = container.querySelector('.modern-tree');
    expect(treeElement).toBeTruthy();

    // Get computed styles for light theme
    console.log('=== LIGHT THEME ===');
    console.log('Classes:', Array.from(treeElement.classList));
    
    const lightStyles = window.getComputedStyle(treeElement);
    console.log('Background color (light):', lightStyles.backgroundColor);
    console.log('Color (light):', lightStyles.color);
    console.log('Border (light):', lightStyles.border);

    // Change to dark theme
    tree.updateConfig({ theme: 'dark' });
    await new Promise(resolve => setTimeout(resolve, 100));

    console.log('=== DARK THEME ===');
    console.log('Classes:', Array.from(treeElement.classList));
    
    const darkStyles = window.getComputedStyle(treeElement);
    console.log('Background color (dark):', darkStyles.backgroundColor);
    console.log('Color (dark):', darkStyles.color);
    console.log('Border (dark):', darkStyles.border);

    // Verify classes are applied
    expect(treeElement.classList.contains('theme-dark')).toBe(true);
    expect(treeElement.classList.contains('theme-light')).toBe(false);

    // Verify visual differences
    expect(lightStyles.backgroundColor).not.toBe(darkStyles.backgroundColor);
    expect(lightStyles.color).not.toBe(darkStyles.color);

    console.log('✅ Theme switching creates visual differences');
  });

  test('should handle selection with visual feedback', async () => {
    const testData = [
      { id: 'select1', name: '📁 Selectable 1' },
      { id: 'select2', name: '📁 Selectable 2' }
    ];

    let selectionChanged = false;
    tree = ModernTree.create({
      dom: container,
      data: testData,
      selectable: 'single',
      onSelectionChange: (nodes, data) => {
        console.log('Selection callback triggered:', data.map(n => n.name));
        selectionChanged = true;
      }
    });

    // Find and click first node
    const firstNode = container.querySelector('[data-node-id="select1"]');
    expect(firstNode).toBeTruthy();
    console.log('Found node to click:', firstNode.textContent);

    // Simulate click
    firstNode.click();
    await new Promise(resolve => setTimeout(resolve, 50));

    // Check selection
    const selection = tree.getSelection();
    console.log('Selection after click:', selection);
    
    expect(selectionChanged).toBe(true);
    expect(selection.length).toBe(1);
    expect(selection[0].id).toBe('select1');

    // Check visual feedback
    expect(firstNode.classList.contains('selected')).toBe(true);
    console.log('✅ Node has selected class');

    // Test add child to selected node
    console.log('=== Testing add child to selected ===');
    const newChild = {
      id: 'child1',
      name: '🆕 New Child'
    };

    // Modify data to add child
    const modifiedData = [...testData];
    modifiedData[0].children = [newChild];

    // Update tree
    tree.updateConfig({ data: modifiedData });
    tree.executeCommand('expandNode', { nodeId: 'select1' });
    
    await new Promise(resolve => setTimeout(resolve, 100));

    // Check if child is visible
    const childElement = container.querySelector('[data-node-id="child1"]');
    console.log('Child element found:', childElement?.textContent);
    expect(childElement).toBeTruthy();

    console.log('✅ Child node added and visible');
  });
});