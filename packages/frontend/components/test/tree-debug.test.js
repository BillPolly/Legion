import { TreeScribeInstance } from '../src/components/tree-scribe/TreeScribe.js';

describe('TreeScribe Arrow Debug', () => {
  let container;
  
  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });
  
  afterEach(() => {
    if (container.parentNode) {
      container.parentNode.removeChild(container);
    }
  });
  
  test('should create arrows for all parent nodes', async () => {
    const treeScribe = new TreeScribeInstance({
      dom: container,
      enableFolding: true
    });
    
    // Simple YAML with nested structure
    const yaml = `
title: Root
content: Root content
children:
  - title: Child 1
    content: Child 1 content
    children:
      - title: Grandchild 1
        content: Grandchild content
  - title: Child 2
    content: Child 2 content
`;
    
    await treeScribe.loadYaml(yaml);
    
    // Wait for render
    await new Promise(resolve => setTimeout(resolve, 50));
    
    // Check arrows
    const arrows = container.querySelectorAll('.node-arrow');
    console.log('Arrows found:', arrows.length);
    
    // Check each arrow's parent title
    arrows.forEach(arrow => {
      const title = arrow.parentElement.querySelector('.node-title')?.textContent;
      console.log('Arrow on node:', title);
    });
    
    // Check all nodes
    const nodes = container.querySelectorAll('.tree-node');
    console.log('Total nodes:', nodes.length);
    
    nodes.forEach(node => {
      const title = node.querySelector('.node-title')?.textContent;
      const hasArrow = !!node.querySelector('.node-arrow');
      console.log(`Node "${title}": has arrow = ${hasArrow}`);
    });
    
    // Should have arrows on Root and Child 1 (both have children)
    expect(arrows.length).toBe(2);
  });
});