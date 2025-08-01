/**
 * Unit tests for Layout base class
 */

import { Layout } from '../../../../../src/components/graph-editor/layout/Layout.js';

// Mock layout implementation for testing
class MockLayout extends Layout {
  constructor(config = {}) {
    super('mock', config);
  }
  
  async calculateLayout(graphData, constraints = {}) {
    this._validateGraphData(graphData);
    
    // Simple grid layout for testing
    const nodes = graphData.nodes.map((node, index) => ({
      id: node.id,
      position: {
        x: (index % 3) * 100 + 50,
        y: Math.floor(index / 3) * 100 + 50
      },
      size: node.size || { width: 80, height: 40 }
    }));
    
    const edges = graphData.edges.map(edge => ({
      id: `${edge.source}-${edge.target}`,
      source: edge.source,
      target: edge.target,
      points: [
        { x: 50, y: 50 },
        { x: 150, y: 50 }
      ]
    }));
    
    return { nodes, edges };
  }
}

// Mock model
const createMockModel = () => {
  const nodes = new Map();
  const edges = new Map();
  let batchDepth = 0;
  
  return {
    getSceneGraph: () => ({
      getNodeById: (id) => nodes.get(id),
      getAllNodes: () => Array.from(nodes.values())
    }),
    getEdgeById: (id) => edges.get(id),
    getEdges: () => Array.from(edges.values()),
    beginBatch: () => { batchDepth++; },
    endBatch: () => { batchDepth--; },
    
    // Helper to add test nodes
    addTestNode: (id, position = { x: 0, y: 0 }) => {
      const node = {
        getId: () => id,
        getPosition: () => ({ ...position }),
        setPosition: function(x, y) {
          position.x = x;
          position.y = y;
        }
      };
      nodes.set(id, node);
      return node;
    },
    
    // Helper to add test edge
    addTestEdge: (id, source, target) => {
      const edge = {
        getId: () => id,
        getSource: () => source,
        getTarget: () => target,
        setPath: function(points) {
          this.path = points;
        }
      };
      edges.set(id, edge);
      return edge;
    }
  };
};

describe('Layout', () => {
  describe('Base Layout Class', () => {
    it('should not allow direct instantiation', () => {
      expect(() => new Layout('test')).toThrow('Layout is an abstract class');
    });
    
    it('should require calculateLayout implementation', async () => {
      class IncompleteLayout extends Layout {
        constructor() {
          super('incomplete');
        }
      }
      
      const layout = new IncompleteLayout();
      await expect(layout.calculateLayout({ nodes: [], edges: [] }))
        .rejects.toThrow('calculateLayout must be implemented by subclasses');
    });
  });
  
  describe('MockLayout Implementation', () => {
    let layout;
    
    beforeEach(() => {
      layout = new MockLayout({
        animated: false,
        animationDuration: 100
      });
    });
    
    describe('Configuration', () => {
      it('should initialize with default config', () => {
        const defaultLayout = new MockLayout();
        expect(defaultLayout.getName()).toBe('mock');
        expect(defaultLayout.getConfig().animated).toBe(true);
        expect(defaultLayout.getConfig().animationDuration).toBe(300);
      });
      
      it('should allow config override', () => {
        const config = layout.getConfig();
        expect(config.animated).toBe(false);
        expect(config.animationDuration).toBe(100);
      });
      
      it('should update config', () => {
        layout.updateConfig({ animated: true, newOption: 'test' });
        const config = layout.getConfig();
        expect(config.animated).toBe(true);
        expect(config.animationDuration).toBe(100); // Preserved
        expect(config.newOption).toBe('test');
      });
    });
    
    describe('Layout State', () => {
      it('should track running state', () => {
        expect(layout.isLayoutRunning()).toBe(false);
      });
      
      it('should store last result', async () => {
        const graphData = {
          nodes: [{ id: 'a' }, { id: 'b' }],
          edges: [{ source: 'a', target: 'b' }]
        };
        
        const model = createMockModel();
        model.addTestNode('a');
        model.addTestNode('b');
        
        await layout.runLayout(graphData, model);
        
        const lastResult = layout.getLastResult();
        expect(lastResult).toBeDefined();
        expect(lastResult.nodes).toHaveLength(2);
        expect(lastResult.edges).toHaveLength(1);
      });
    });
    
    describe('Graph Data Validation', () => {
      it('should validate graph data structure', async () => {
        await expect(layout.calculateLayout(null))
          .rejects.toThrow('Graph data must be an object');
        
        await expect(layout.calculateLayout({}))
          .rejects.toThrow('Graph data must have a nodes array');
        
        await expect(layout.calculateLayout({ nodes: [] }))
          .rejects.toThrow('Graph data must have an edges array');
      });
      
      it('should validate node structure', async () => {
        const invalidGraphData = {
          nodes: [{ id: 'a' }, {}], // Second node missing id
          edges: []
        };
        
        await expect(layout.calculateLayout(invalidGraphData))
          .rejects.toThrow('Node at index 1 missing required \'id\' property');
      });
      
      it('should validate edge structure', async () => {
        const invalidGraphData = {
          nodes: [{ id: 'a' }, { id: 'b' }],
          edges: [{ source: 'a' }] // Missing target
        };
        
        await expect(layout.calculateLayout(invalidGraphData))
          .rejects.toThrow('Edge at index 0 missing required \'source\' or \'target\' property');
      });
    });
    
    describe('Layout Calculation', () => {
      it('should calculate layout for valid graph data', async () => {
        const graphData = {
          nodes: [
            { id: 'node1', size: { width: 100, height: 50 } },
            { id: 'node2', size: { width: 80, height: 40 } },
            { id: 'node3' }
          ],
          edges: [
            { source: 'node1', target: 'node2' },
            { source: 'node2', target: 'node3' }
          ]
        };
        
        const result = await layout.calculateLayout(graphData);
        
        expect(result.nodes).toHaveLength(3);
        expect(result.edges).toHaveLength(2);
        
        // Check node positioning (grid layout)
        expect(result.nodes[0].position).toEqual({ x: 50, y: 50 });
        expect(result.nodes[1].position).toEqual({ x: 150, y: 50 });
        expect(result.nodes[2].position).toEqual({ x: 250, y: 50 });
        
        // Check edge routing
        expect(result.edges[0].points).toHaveLength(2);
      });
    });
    
    describe('Layout Application', () => {
      let model;
      let graphData;
      
      beforeEach(() => {
        model = createMockModel();
        model.addTestNode('a', { x: 0, y: 0 });
        model.addTestNode('b', { x: 10, y: 10 });
        model.addTestEdge('e1', 'a', 'b');
        
        graphData = {
          nodes: [{ id: 'a' }, { id: 'b' }],
          edges: [{ source: 'a', target: 'b' }]
        };
      });
      
      it('should apply immediate layout', async () => {
        const layoutResult = await layout.calculateLayout(graphData);
        await layout.applyLayout(layoutResult, model, { animated: false });
        
        // Check nodes were positioned
        const nodeA = model.getSceneGraph().getNodeById('a');
        const nodeB = model.getSceneGraph().getNodeById('b');
        
        expect(nodeA.getPosition()).toEqual({ x: 50, y: 50 });
        expect(nodeB.getPosition()).toEqual({ x: 150, y: 50 });
      });
      
      it('should run complete layout process', async () => {
        const result = await layout.runLayout(graphData, model);
        
        expect(result).toBeDefined();
        expect(layout.getLastResult()).toBe(result);
        
        // Verify nodes were positioned
        const nodeA = model.getSceneGraph().getNodeById('a');
        expect(nodeA.getPosition().x).toBe(50);
      });
      
      it('should handle layout errors gracefully', async () => {
        await expect(layout.applyLayout(null, model))
          .rejects.toThrow('Layout result and model are required');
      });
    });
    
    describe('Animation', () => {
      it('should support animated layout application', async () => {
        const animatedLayout = new MockLayout({ animated: true, animationDuration: 50 });
        const model = createMockModel();
        model.addTestNode('a', { x: 0, y: 0 });
        
        const graphData = {
          nodes: [{ id: 'a' }],
          edges: []
        };
        
        let progressCalled = false;
        const onProgress = (progress) => {
          progressCalled = true;
          expect(progress).toBeGreaterThanOrEqual(0);
          expect(progress).toBeLessThanOrEqual(1);
        };
        
        const layoutResult = await animatedLayout.calculateLayout(graphData);
        await animatedLayout.applyLayout(layoutResult, model, {
          animated: true,
          animationDuration: 50,
          onProgress
        });
        
        expect(progressCalled).toBe(true);
        
        // Final position should be reached
        const node = model.getSceneGraph().getNodeById('a');
        expect(node.getPosition().x).toBeCloseTo(50);
      });
    });
    
    describe('Layout Cancellation', () => {
      it('should support layout cancellation', () => {
        layout.cancelLayout();
        expect(layout.isLayoutRunning()).toBe(false);
      });
    });
  });
});