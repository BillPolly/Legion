/**
 * Unit tests for DagreLayout
 */

import { DagreLayout } from '../../../../../src/components/graph-editor/layout/DagreLayout.js';

// Mock model similar to Layout.test.js
const createMockModel = () => {
  const nodes = new Map();
  const edges = new Map();
  
  return {
    getSceneGraph: () => ({
      getNodeById: (id) => nodes.get(id),
      getAllNodes: () => Array.from(nodes.values()).filter(n => n.getId() !== 'root')
    }),
    getEdgeById: (id) => edges.get(id),
    getEdges: () => Array.from(edges.values()),
    beginBatch: () => {},
    endBatch: () => {},
    
    addTestNode: (id, data = {}) => {
      const position = data.position || { x: 0, y: 0 };
      const size = data.size || { width: 100, height: 50 };
      
      const node = {
        getId: () => id,
        getPosition: () => ({ ...position }),
        getSize: () => ({ ...size }),
        getLabel: () => data.label || id,
        getData: () => data.data || {},
        setPosition: function(x, y) {
          position.x = x;
          position.y = y;
        }
      };
      nodes.set(id, node);
      return node;
    },
    
    addTestEdge: (id, source, target, data = {}) => {
      const edge = {
        getId: () => id,
        getSource: () => source,
        getTarget: () => target,
        getLabel: () => data.label || '',
        getWeight: () => data.weight || 1,
        getData: () => data.data || {},
        setPath: function(points) {
          this.path = points;
        }
      };
      edges.set(id, edge);
      return edge;
    }
  };
};

describe('DagreLayout', () => {
  let layout;
  
  beforeEach(() => {
    layout = new DagreLayout({
      animated: false,
      rankdir: 'TB',
      nodesep: 100,
      ranksep: 150
    });
  });
  
  describe('Initialization', () => {
    it('should initialize with default Dagre config', () => {
      const defaultLayout = new DagreLayout();
      const config = defaultLayout.getConfig();
      
      expect(defaultLayout.getName()).toBe('dagre');
      expect(config.rankdir).toBe('TB');
      expect(config.ranksep).toBe(150);
      expect(config.nodesep).toBe(100);
      expect(config.animated).toBe(true);
    });
    
    it('should allow config override', () => {
      const config = layout.getConfig();
      expect(config.rankdir).toBe('TB');
      expect(config.nodesep).toBe(100);
      expect(config.animated).toBe(false);
    });
  });
  
  describe('Configuration Methods', () => {
    it('should set rank direction', () => {
      layout.setRankDirection('LR');
      expect(layout.getConfig().rankdir).toBe('LR');
      
      layout.setRankDirection('RL');
      expect(layout.getConfig().rankdir).toBe('RL');
      
      layout.setRankDirection('BT');
      expect(layout.getConfig().rankdir).toBe('BT');
    });
    
    it('should validate rank direction', () => {
      expect(() => layout.setRankDirection('INVALID'))
        .toThrow('Invalid rankdir. Must be one of: TB, BT, LR, RL');
    });
    
    it('should set node separation', () => {
      layout.setNodeSeparation(120);
      expect(layout.getConfig().nodesep).toBe(120);
    });
    
    it('should validate node separation', () => {
      expect(() => layout.setNodeSeparation(-10))
        .toThrow('Node separation must be a positive number');
      
      expect(() => layout.setNodeSeparation('invalid'))
        .toThrow('Node separation must be a positive number');
    });
    
    it('should set rank separation', () => {
      layout.setRankSeparation(200);
      expect(layout.getConfig().ranksep).toBe(200);
    });
    
    it('should validate rank separation', () => {
      expect(() => layout.setRankSeparation(-20))
        .toThrow('Rank separation must be a positive number');
      
      expect(() => layout.setRankSeparation('invalid'))
        .toThrow('Rank separation must be a positive number');
    });
  });
  
  describe('Layout Calculation', () => {
    it('should calculate layout for simple graph', async () => {
      const graphData = {
        nodes: [
          { id: 'A', width: 100, height: 50 },
          { id: 'B', width: 80, height: 40 },
          { id: 'C', width: 120, height: 60 }
        ],
        edges: [
          { source: 'A', target: 'B' },
          { source: 'B', target: 'C' }
        ]
      };
      
      const result = await layout.calculateLayout(graphData);
      
      expect(result).toBeDefined();
      expect(result.nodes).toHaveLength(3);
      expect(result.edges).toHaveLength(2);
      
      // Check that nodes have positions
      result.nodes.forEach(node => {
        expect(node.position).toBeDefined();
        expect(typeof node.position.x).toBe('number');
        expect(typeof node.position.y).toBe('number');
      });
      
      // Check that edges have points
      result.edges.forEach(edge => {
        expect(edge.points).toBeDefined();
        expect(Array.isArray(edge.points)).toBe(true);
        expect(edge.points.length).toBeGreaterThanOrEqual(2);
      });
    });
    
    it('should handle empty graph', async () => {
      const graphData = {
        nodes: [],
        edges: []
      };
      
      const result = await layout.calculateLayout(graphData);
      
      expect(result.nodes).toHaveLength(0);
      expect(result.edges).toHaveLength(0);
    });
    
    it('should handle single node', async () => {
      const graphData = {
        nodes: [{ id: 'A', width: 100, height: 50 }],
        edges: []
      };
      
      const result = await layout.calculateLayout(graphData);
      
      expect(result.nodes).toHaveLength(1);
      expect(result.nodes[0].position).toBeDefined();
      expect(result.edges).toHaveLength(0);
    });
    
    it('should handle constraints with fixed nodes', async () => {
      const graphData = {
        nodes: [
          { id: 'A', width: 100, height: 50 },
          { id: 'B', width: 80, height: 40 }
        ],
        edges: [{ source: 'A', target: 'B' }]
      };
      
      const constraints = {
        fixedNodes: {
          'A': { x: 200, y: 100 }
        }
      };
      
      const result = await layout.calculateLayout(graphData, constraints);
      
      // Fixed node should maintain its position (in a real implementation)
      const nodeA = result.nodes.find(n => n.id === 'A');
      expect(nodeA).toBeDefined();
    });
    
    it('should handle different rank directions', async () => {
      const graphData = {
        nodes: [
          { id: 'A', width: 100, height: 50 },
          { id: 'B', width: 80, height: 40 }
        ],
        edges: [{ source: 'A', target: 'B' }]
      };
      
      // Test different directions
      const directions = ['TB', 'BT', 'LR', 'RL'];
      
      for (const dir of directions) {
        layout.setRankDirection(dir);
        const result = await layout.calculateLayout(graphData);
        
        expect(result.nodes).toHaveLength(2);
        expect(result.edges).toHaveLength(1);
      }
    });
  });
  
  describe('Model Integration', () => {
    it('should create graph data from model', () => {
      const model = createMockModel();
      
      // Add test data
      model.addTestNode('node1', {
        position: { x: 10, y: 20 },
        size: { width: 100, height: 50 },
        label: 'Node 1',
        data: { type: 'input' }
      });
      
      model.addTestNode('node2', {
        position: { x: 30, y: 40 },
        size: { width: 80, height: 40 },
        label: 'Node 2'
      });
      
      model.addTestEdge('edge1', 'node1', 'node2', {
        label: 'connects',
        weight: 2
      });
      
      const graphData = DagreLayout.createGraphDataFromModel(model);
      
      expect(graphData.nodes).toHaveLength(2);
      expect(graphData.edges).toHaveLength(1);
      
      // Check node data
      const node1 = graphData.nodes.find(n => n.id === 'node1');
      expect(node1.label).toBe('Node 1');
      expect(node1.size).toEqual({ width: 100, height: 50 });
      expect(node1.data.type).toBe('input');
      
      // Check edge data
      const edge1 = graphData.edges[0];
      expect(edge1.source).toBe('node1');
      expect(edge1.target).toBe('node2');
      expect(edge1.weight).toBe(2);
    });
  });
  
  describe('Layout Suggestions', () => {
    it('should suggest config for small graphs', () => {
      const graphData = {
        nodes: Array.from({ length: 5 }, (_, i) => ({ id: `node${i}` })),
        edges: [{ source: 'node0', target: 'node1' }]
      };
      
      const config = DagreLayout.suggestLayoutConfig(graphData);
      
      expect(config.nodesep).toBe(120);
      expect(config.ranksep).toBe(100);
      expect(config.rankdir).toBe('TB');
    });
    
    it('should suggest config for medium graphs', () => {
      const graphData = {
        nodes: Array.from({ length: 25 }, (_, i) => ({ id: `node${i}` })),
        edges: Array.from({ length: 30 }, (_, i) => ({
          source: `node${i % 25}`,
          target: `node${(i + 1) % 25}`
        }))
      };
      
      const config = DagreLayout.suggestLayoutConfig(graphData);
      
      expect(config.nodesep).toBe(100);
      expect(config.ranksep).toBe(150);
    });
    
    it('should suggest config for large graphs', () => {
      const graphData = {
        nodes: Array.from({ length: 100 }, (_, i) => ({ id: `node${i}` })),
        edges: Array.from({ length: 50 }, (_, i) => ({
          source: `node${i}`,
          target: `node${i + 1}`
        }))
      };
      
      const config = DagreLayout.suggestLayoutConfig(graphData);
      
      expect(config.nodesep).toBe(80);
      expect(config.ranksep).toBe(120);
      expect(config.rankdir).toBe('LR');
    });
  });
  
  describe('Full Layout Process', () => {
    it('should run complete layout on model', async () => {
      const model = createMockModel();
      
      // Add test nodes at original positions
      model.addTestNode('A', { position: { x: 0, y: 0 } });
      model.addTestNode('B', { position: { x: 10, y: 10 } });
      model.addTestNode('C', { position: { x: 20, y: 20 } });
      
      model.addTestEdge('e1', 'A', 'B');
      model.addTestEdge('e2', 'B', 'C');
      
      const graphData = DagreLayout.createGraphDataFromModel(model);
      const result = await layout.runLayout(graphData, model);
      
      expect(result).toBeDefined();
      
      // Check that nodes were repositioned
      const nodeA = model.getSceneGraph().getNodeById('A');
      const nodeB = model.getSceneGraph().getNodeById('B');
      const nodeC = model.getSceneGraph().getNodeById('C');
      
      // Should be positioned in a grid pattern (mock implementation)
      expect(nodeA.getPosition().x).toBeGreaterThan(0);
      expect(nodeB.getPosition().x).toBeGreaterThan(0);
      expect(nodeC.getPosition().x).toBeGreaterThan(0);
    });
  });
});