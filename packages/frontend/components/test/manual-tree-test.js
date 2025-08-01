// Manual test to debug tree rendering
import { TreeScribeInstance } from '../src/components/tree-scribe/TreeScribe.js';

// Create a container
const container = document.createElement('div');
document.body.appendChild(container);

// Create TreeScribe instance
const treeScribe = new TreeScribeInstance({
  dom: container,
  enableFolding: true
});

// Test YAML with nested structure
const testYaml = `
title: Root Node
content: This is the root
children:
  - title: Child 1
    content: First child
    children:
      - title: Grandchild 1.1
        content: First grandchild
      - title: Grandchild 1.2
        content: Second grandchild
  - title: Child 2
    content: Second child
    children:
      - title: Grandchild 2.1
        content: Another grandchild
`;

// Load the YAML
treeScribe.loadYaml(testYaml).then(result => {
  console.log('Load result:', result);
  
  // Check what's in the DOM
  setTimeout(() => {
    const arrows = container.querySelectorAll('.node-arrow');
    console.log('Number of arrows found:', arrows.length);
    
    const nodes = container.querySelectorAll('.tree-node');
    console.log('Number of nodes found:', nodes.length);
    
    // Check each node
    nodes.forEach(node => {
      const title = node.querySelector('.node-title')?.textContent;
      const hasArrow = !!node.querySelector('.node-arrow');
      const children = node.querySelector('.node-children');
      console.log('Node:', {
        title,
        hasArrow,
        hasChildrenContainer: !!children,
        childCount: children ? children.children.length : 0
      });
    });
  }, 100);
});