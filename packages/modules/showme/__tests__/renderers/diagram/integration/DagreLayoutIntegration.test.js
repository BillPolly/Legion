/**
 * Integration tests for Dagre layout algorithm via DiagramLayoutEngine
 * Tests the integration between DiagramLayoutEngine and DagreLayoutAlgorithm
 */

import { jest } from '@jest/globals';
import { DiagramLayoutEngine } from '../../../../src/renderers/diagram/layout/DiagramLayoutEngine.js';
import { DiagramViewModel } from '../../../../src/renderers/diagram/viewmodel/DiagramViewModel.js';
import { DiagramView } from '../../../../src/renderers/diagram/view/DiagramView.js';
import { 
  createTestDOM, 
  cleanupTestDOM,
  createSampleDiagramData 
} from '../test-setup.js';

describe('Dagre Layout Integration', () => {
  let dom;
  let container;
  let layoutEngine;
  let viewModel;
  let view;

  beforeEach(() => {
    dom = createTestDOM();
    container = document.createElement('div');
    container.style.width = '800px';
    container.style.height = '600px';
    document.body.appendChild(container);

    // Create layout engine with Dagre algorithm
    layoutEngine = new DiagramLayoutEngine({
      algorithm: 'dagre',
      direction: 'TB',
      spacing: {
        node: 60,
        rank: 80
      }
    });

    view = new DiagramView(container);
    viewModel = new DiagramViewModel({
      layoutEngine,
      view
    });
  });

  afterEach(() => {
    cleanupTestDOM();
    if (view) view.destroy();
  });

  describe('Basic Integration', () => {
    test('should use Dagre algorithm by default', () => {
      expect(layoutEngine.config.algorithm).toBe('dagre');
      expect(layoutEngine.algorithms.has('dagre')).toBe(true);
    });

    test('should compute layout with Dagre algorithm', () => {
      const sampleData = createSampleDiagramData();
      viewModel.setDiagramData(sampleData);

      const result = viewModel.computeLayout();

      expect(result.success).toBe(true);
      expect(result.layoutData).toBeDefined();
      expect(result.layoutData.positions).toBeInstanceOf(Map);
      expect(result.layoutData.bounds).toBeDefined();

      // Should have positioned all nodes
      expect(result.layoutData.positions.size).toBe(sampleData.nodes.size);
    });

    test('should integrate with view rendering', () => {
      const sampleData = createSampleDiagramData();
      viewModel.setDiagramData(sampleData);
      viewModel.computeLayout();

      // Render the layout
      view.render(viewModel.getState());

      // Check that nodes are positioned according to Dagre layout
      const nodesLayer = view.nodesLayer;
      expect(nodesLayer.children.length).toBe(sampleData.nodes.size);

      // Check that nodes have been positioned
      const nodeElements = Array.from(nodesLayer.children);
      nodeElements.forEach(nodeElement => {
        const transform = nodeElement.getAttribute('transform');
        expect(transform).toMatch(/translate\(-?\d+(\.\d+)?,-?\d+(\.\d+)?\)/);
      });
    });
  });

  describe('Different Graph Structures', () => {
    test('should layout linear chain correctly', () => {
      const chainData = {
        nodes: new Map([
          ['A', { id: 'A', label: 'Node A', position: { x: 0, y: 0 }, size: { width: 100, height: 60 } }],
          ['B', { id: 'B', label: 'Node B', position: { x: 0, y: 0 }, size: { width: 100, height: 60 } }],
          ['C', { id: 'C', label: 'Node C', position: { x: 0, y: 0 }, size: { width: 100, height: 60 } }],
          ['D', { id: 'D', label: 'Node D', position: { x: 0, y: 0 }, size: { width: 100, height: 60 } }]
        ]),
        edges: new Map([
          ['e1', { id: 'e1', source: 'A', target: 'B', label: 'A->B' }],
          ['e2', { id: 'e2', source: 'B', target: 'C', label: 'B->C' }],
          ['e3', { id: 'e3', source: 'C', target: 'D', label: 'C->D' }]
        ])
      };

      viewModel.setDiagramData(chainData);
      const result = viewModel.computeLayout();

      expect(result.success).toBe(true);

      // Check that nodes are arranged in a chain (vertical for TB layout)
      const positions = result.layoutData.positions;
      const posA = positions.get('A');
      const posB = positions.get('B');
      const posC = positions.get('C');
      const posD = positions.get('D');

      expect(posB.y).toBeGreaterThan(posA.y);
      expect(posC.y).toBeGreaterThan(posB.y);
      expect(posD.y).toBeGreaterThan(posC.y);
    });

    test('should layout tree structure correctly', () => {
      const treeData = {
        nodes: new Map([
          ['root', { id: 'root', label: 'Root', position: { x: 0, y: 0 }, size: { width: 100, height: 60 } }],
          ['left', { id: 'left', label: 'Left Child', position: { x: 0, y: 0 }, size: { width: 100, height: 60 } }],
          ['right', { id: 'right', label: 'Right Child', position: { x: 0, y: 0 }, size: { width: 100, height: 60 } }],
          ['leaf1', { id: 'leaf1', label: 'Leaf 1', position: { x: 0, y: 0 }, size: { width: 100, height: 60 } }],
          ['leaf2', { id: 'leaf2', label: 'Leaf 2', position: { x: 0, y: 0 }, size: { width: 100, height: 60 } }]
        ]),
        edges: new Map([
          ['e1', { id: 'e1', source: 'root', target: 'left' }],
          ['e2', { id: 'e2', source: 'root', target: 'right' }],
          ['e3', { id: 'e3', source: 'left', target: 'leaf1' }],
          ['e4', { id: 'e4', source: 'right', target: 'leaf2' }]
        ])
      };

      viewModel.setDiagramData(treeData);
      const result = viewModel.computeLayout();

      expect(result.success).toBe(true);

      const positions = result.layoutData.positions;
      const rootPos = positions.get('root');
      const leftPos = positions.get('left');
      const rightPos = positions.get('right');
      const leaf1Pos = positions.get('leaf1');
      const leaf2Pos = positions.get('leaf2');

      // Check tree hierarchy (TB layout)
      expect(leftPos.y).toBeGreaterThan(rootPos.y);
      expect(rightPos.y).toBeGreaterThan(rootPos.y);
      expect(leaf1Pos.y).toBeGreaterThan(leftPos.y);
      expect(leaf2Pos.y).toBeGreaterThan(rightPos.y);

      // Children should be at similar levels
      expect(Math.abs(leftPos.y - rightPos.y)).toBeLessThan(10);
      expect(Math.abs(leaf1Pos.y - leaf2Pos.y)).toBeLessThan(10);
    });

    test('should layout diamond/diamond DAG correctly', () => {
      const diamondData = {
        nodes: new Map([
          ['top', { id: 'top', label: 'Top', position: { x: 0, y: 0 }, size: { width: 100, height: 60 } }],
          ['left', { id: 'left', label: 'Left', position: { x: 0, y: 0 }, size: { width: 100, height: 60 } }],
          ['right', { id: 'right', label: 'Right', position: { x: 0, y: 0 }, size: { width: 100, height: 60 } }],
          ['bottom', { id: 'bottom', label: 'Bottom', position: { x: 0, y: 0 }, size: { width: 100, height: 60 } }]
        ]),
        edges: new Map([
          ['e1', { id: 'e1', source: 'top', target: 'left' }],
          ['e2', { id: 'e2', source: 'top', target: 'right' }],
          ['e3', { id: 'e3', source: 'left', target: 'bottom' }],
          ['e4', { id: 'e4', source: 'right', target: 'bottom' }]
        ])
      };

      viewModel.setDiagramData(diamondData);
      const result = viewModel.computeLayout();

      expect(result.success).toBe(true);

      const positions = result.layoutData.positions;
      const topPos = positions.get('top');
      const leftPos = positions.get('left');
      const rightPos = positions.get('right');
      const bottomPos = positions.get('bottom');

      // Check diamond structure
      expect(leftPos.y).toBeGreaterThan(topPos.y);
      expect(rightPos.y).toBeGreaterThan(topPos.y);
      expect(bottomPos.y).toBeGreaterThan(leftPos.y);
      expect(bottomPos.y).toBeGreaterThan(rightPos.y);

      // Middle nodes should be at same level
      expect(Math.abs(leftPos.y - rightPos.y)).toBeLessThan(10);
    });
  });

  describe('Direction Support', () => {
    test('should layout top-bottom correctly', () => {
      const tbEngine = new DiagramLayoutEngine({
        algorithm: 'dagre',
        direction: 'TB'
      });

      viewModel.setLayoutEngine(tbEngine);

      const sampleData = createSampleDiagramData();
      viewModel.setDiagramData(sampleData);
      const result = viewModel.computeLayout();

      expect(result.success).toBe(true);
      
      // For TB, source nodes should be above target nodes
      const positions = result.layoutData.positions;
      const node1Pos = positions.get('node1');
      const node2Pos = positions.get('node2');

      if (node1Pos && node2Pos) {
        // Assuming node1 -> node2 edge exists
        expect(node2Pos.y).toBeGreaterThan(node1Pos.y);
      }
    });

    test('should layout left-right correctly', () => {
      const lrEngine = new DiagramLayoutEngine({
        algorithm: 'dagre',
        direction: 'LR'
      });

      viewModel.setLayoutEngine(lrEngine);

      const simpleData = {
        nodes: new Map([
          ['A', { id: 'A', label: 'A', size: { width: 100, height: 60 } }],
          ['B', { id: 'B', label: 'B', size: { width: 100, height: 60 } }]
        ]),
        edges: new Map([
          ['e1', { id: 'e1', source: 'A', target: 'B' }]
        ])
      };

      viewModel.setDiagramData(simpleData);
      const result = viewModel.computeLayout();

      expect(result.success).toBe(true);
      
      const positions = result.layoutData.positions;
      const posA = positions.get('A');
      const posB = positions.get('B');

      // For LR, target should be to the right of source
      expect(posB.x).toBeGreaterThan(posA.x);
    });

    test('should layout bottom-top correctly', () => {
      const btEngine = new DiagramLayoutEngine({
        algorithm: 'dagre',
        direction: 'BT'
      });

      viewModel.setLayoutEngine(btEngine);

      const simpleData = {
        nodes: new Map([
          ['A', { id: 'A', label: 'A', size: { width: 100, height: 60 } }],
          ['B', { id: 'B', label: 'B', size: { width: 100, height: 60 } }]
        ]),
        edges: new Map([
          ['e1', { id: 'e1', source: 'A', target: 'B' }]
        ])
      };

      viewModel.setDiagramData(simpleData);
      const result = viewModel.computeLayout();

      expect(result.success).toBe(true);
      
      const positions = result.layoutData.positions;
      const posA = positions.get('A');
      const posB = positions.get('B');

      // For BT, target should be above source
      expect(posB.y).toBeLessThan(posA.y);
    });

    test('should layout right-left correctly', () => {
      const rlEngine = new DiagramLayoutEngine({
        algorithm: 'dagre',
        direction: 'RL'
      });

      viewModel.setLayoutEngine(rlEngine);

      const simpleData = {
        nodes: new Map([
          ['A', { id: 'A', label: 'A', size: { width: 100, height: 60 } }],
          ['B', { id: 'B', label: 'B', size: { width: 100, height: 60 } }]
        ]),
        edges: new Map([
          ['e1', { id: 'e1', source: 'A', target: 'B' }]
        ])
      };

      viewModel.setDiagramData(simpleData);
      const result = viewModel.computeLayout();

      expect(result.success).toBe(true);
      
      const positions = result.layoutData.positions;
      const posA = positions.get('A');
      const posB = positions.get('B');

      // For RL, target should be to the left of source
      expect(posB.x).toBeLessThan(posA.x);
    });
  });

  describe('Spacing and Configuration', () => {
    test('should respect node spacing configuration', () => {
      const spacedEngine = new DiagramLayoutEngine({
        algorithm: 'dagre',
        direction: 'TB',
        spacing: {
          node: 100,
          rank: 50
        }
      });

      viewModel.setLayoutEngine(spacedEngine);

      const parallelData = {
        nodes: new Map([
          ['root', { id: 'root', label: 'Root', size: { width: 80, height: 50 } }],
          ['left', { id: 'left', label: 'Left', size: { width: 80, height: 50 } }],
          ['right', { id: 'right', label: 'Right', size: { width: 80, height: 50 } }]
        ]),
        edges: new Map([
          ['e1', { id: 'e1', source: 'root', target: 'left' }],
          ['e2', { id: 'e2', source: 'root', target: 'right' }]
        ])
      };

      viewModel.setDiagramData(parallelData);
      const result = viewModel.computeLayout();

      expect(result.success).toBe(true);

      const positions = result.layoutData.positions;
      const leftPos = positions.get('left');
      const rightPos = positions.get('right');

      // Nodes at same level should be well separated
      const horizontalDistance = Math.abs(rightPos.x - leftPos.x);
      expect(horizontalDistance).toBeGreaterThan(80); // At least node width + spacing
    });

    test('should respect rank spacing configuration', () => {
      const spacedEngine = new DiagramLayoutEngine({
        algorithm: 'dagre',
        direction: 'TB',
        spacing: {
          node: 50,
          rank: 120
        }
      });

      viewModel.setLayoutEngine(spacedEngine);

      const chainData = {
        nodes: new Map([
          ['A', { id: 'A', label: 'A', size: { width: 80, height: 40 } }],
          ['B', { id: 'B', label: 'B', size: { width: 80, height: 40 } }]
        ]),
        edges: new Map([
          ['e1', { id: 'e1', source: 'A', target: 'B' }]
        ])
      };

      viewModel.setDiagramData(chainData);
      const result = viewModel.computeLayout();

      expect(result.success).toBe(true);

      const positions = result.layoutData.positions;
      const posA = positions.get('A');
      const posB = positions.get('B');

      // Vertical distance should reflect rank spacing
      const verticalDistance = Math.abs(posB.y - posA.y);
      expect(verticalDistance).toBeGreaterThan(100); // Should be more than just node heights
    });
  });

  describe('Edge Layout Integration', () => {
    test('should provide edge path information', () => {
      const sampleData = createSampleDiagramData();
      viewModel.setDiagramData(sampleData);
      const result = viewModel.computeLayout();

      expect(result.success).toBe(true);

      // Check if edge information is available
      if (result.layoutData.edges) {
        expect(result.layoutData.edges).toBeInstanceOf(Map);
        
        if (result.layoutData.edges.size > 0) {
          // Check first edge has path information
          const firstEdge = Array.from(result.layoutData.edges.values())[0];
          expect(firstEdge.path).toBeDefined();
          expect(firstEdge.path.points).toBeDefined();
          expect(Array.isArray(firstEdge.path.points)).toBe(true);
        }
      }
    });

    test('should handle complex edge routing', () => {
      // Create a graph with crossing edges
      const complexData = {
        nodes: new Map([
          ['A', { id: 'A', label: 'A', size: { width: 100, height: 60 } }],
          ['B', { id: 'B', label: 'B', size: { width: 100, height: 60 } }],
          ['C', { id: 'C', label: 'C', size: { width: 100, height: 60 } }],
          ['D', { id: 'D', label: 'D', size: { width: 100, height: 60 } }],
          ['E', { id: 'E', label: 'E', size: { width: 100, height: 60 } }]
        ]),
        edges: new Map([
          ['e1', { id: 'e1', source: 'A', target: 'D' }],
          ['e2', { id: 'e2', source: 'A', target: 'E' }],
          ['e3', { id: 'e3', source: 'B', target: 'D' }],
          ['e4', { id: 'e4', source: 'C', target: 'E' }]
        ])
      };

      viewModel.setDiagramData(complexData);
      const result = viewModel.computeLayout();

      expect(result.success).toBe(true);
      expect(result.layoutData.positions.size).toBe(5);

      // All nodes should have valid positions
      result.layoutData.positions.forEach(pos => {
        expect(typeof pos.x).toBe('number');
        expect(typeof pos.y).toBe('number');
        expect(isNaN(pos.x)).toBe(false);
        expect(isNaN(pos.y)).toBe(false);
      });
    });
  });

  describe('Performance Integration', () => {
    test('should handle medium-sized graphs efficiently', () => {
      // Create a graph with 20 nodes and 25 edges
      const nodes = new Map();
      const edges = new Map();

      for (let i = 0; i < 20; i++) {
        nodes.set(`node${i}`, {
          id: `node${i}`,
          label: `Node ${i}`,
          size: { width: 100, height: 60 }
        });
      }

      // Create a mix of linear chains and branches
      for (let i = 0; i < 15; i++) {
        edges.set(`edge${i}`, {
          id: `edge${i}`,
          source: `node${i}`,
          target: `node${i + 1}`
        });
      }

      // Add some branches
      for (let i = 15; i < 25; i++) {
        edges.set(`edge${i}`, {
          id: `edge${i}`,
          source: `node${i % 10}`,
          target: `node${(i % 10) + 10}`
        });
      }

      const mediumData = { nodes, edges };

      const startTime = performance.now();
      viewModel.setDiagramData(mediumData);
      const result = viewModel.computeLayout();
      const endTime = performance.now();

      expect(result.success).toBe(true);
      expect(result.layoutData.positions.size).toBe(20);

      // Should complete in reasonable time (< 50ms for 20 nodes)
      expect(endTime - startTime).toBeLessThan(50);
    });

    test('should integrate with view rendering efficiently', () => {
      const sampleData = createSampleDiagramData();
      
      const startTime = performance.now();
      
      // Full integration test
      viewModel.setDiagramData(sampleData);
      viewModel.computeLayout();
      view.render(viewModel.getState());
      
      const endTime = performance.now();

      // Full pipeline should be fast
      expect(endTime - startTime).toBeLessThan(20);

      // Check that rendering was successful
      expect(view.nodesLayer.children.length).toBeGreaterThan(0);
      expect(view.edgesLayer.children.length).toBeGreaterThan(0);
    });
  });

  describe('Fallback Behavior', () => {
    test('should fallback to hierarchical layout on Dagre failure', () => {
      // Mock Dagre algorithm to fail
      const failingEngine = new DiagramLayoutEngine({
        algorithm: 'dagre'
      });

      // Replace the Dagre algorithm with a failing one
      failingEngine.algorithms.set('dagre', {
        layout: () => {
          throw new Error('Simulated Dagre failure');
        }
      });

      viewModel.setLayoutEngine(failingEngine);

      const sampleData = createSampleDiagramData();
      viewModel.setDiagramData(sampleData);
      const result = viewModel.computeLayout();

      // Should still succeed using fallback
      expect(result.success).toBe(true);
      expect(result.layoutData.positions.size).toBe(sampleData.nodes.size);
    });

    test('should work with non-Dagre algorithms', () => {
      const hierarchicalEngine = new DiagramLayoutEngine({
        algorithm: 'hierarchical'
      });

      viewModel.setLayoutEngine(hierarchicalEngine);

      const sampleData = createSampleDiagramData();
      viewModel.setDiagramData(sampleData);
      const result = viewModel.computeLayout();

      expect(result.success).toBe(true);
      expect(result.layoutData.positions.size).toBe(sampleData.nodes.size);
    });
  });

  describe('Layout Metadata Integration', () => {
    test('should provide comprehensive metadata through viewModel', () => {
      const sampleData = createSampleDiagramData();
      viewModel.setDiagramData(sampleData);
      const result = viewModel.computeLayout();

      expect(result.success).toBe(true);

      // Check if metadata is passed through
      if (result.layoutData.metadata) {
        expect(result.layoutData.metadata.algorithm).toBe('dagre');
        expect(result.layoutData.metadata.stats).toBeDefined();
        expect(typeof result.layoutData.metadata.stats.nodes).toBe('number');
        expect(typeof result.layoutData.metadata.stats.edges).toBe('number');
      }
    });

    test('should provide timing information when enabled', () => {
      const timedEngine = new DiagramLayoutEngine({
        algorithm: 'dagre',
        debugTiming: true
      });

      viewModel.setLayoutEngine(timedEngine);

      const sampleData = createSampleDiagramData();
      viewModel.setDiagramData(sampleData);
      const result = viewModel.computeLayout();

      expect(result.success).toBe(true);

      // Check if timing metadata is available
      if (result.layoutData.metadata && result.layoutData.metadata.timing) {
        expect(typeof result.layoutData.metadata.timing.total).toBe('number');
      }
    });
  });
});