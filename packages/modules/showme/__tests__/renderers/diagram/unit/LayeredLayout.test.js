/**
 * Unit tests for LayeredLayout
 * Tests hierarchical layered layout algorithms with edge crossing minimization
 */

import { jest } from '@jest/globals';
import { LayeredLayout } from '../../../../src/renderers/diagram/layout/LayeredLayout.js';

// Mock performance API
global.performance = {
  now: jest.fn(() => Date.now())
};

const createDAGGraphData = () => {
  const nodes = [
    { id: 'root', label: 'Root', size: { width: 100, height: 60 } },
    { id: 'a', label: 'A', size: { width: 80, height: 50 } },
    { id: 'b', label: 'B', size: { width: 80, height: 50 } },
    { id: 'c', label: 'C', size: { width: 80, height: 50 } },
    { id: 'd', label: 'D', size: { width: 80, height: 50 } },
    { id: 'e', label: 'E', size: { width: 80, height: 50 } }
  ];

  const edges = [
    { id: 'e1', source: 'root', target: 'a' },
    { id: 'e2', source: 'root', target: 'b' },
    { id: 'e3', source: 'a', target: 'c' },
    { id: 'e4', source: 'a', target: 'd' },
    { id: 'e5', source: 'b', target: 'e' }
  ];

  return { nodes, edges };
};

const createComplexDAGData = () => {
  const nodes = [
    { id: 'n1', label: 'Node 1', size: { width: 80, height: 50 } },
    { id: 'n2', label: 'Node 2', size: { width: 80, height: 50 } },
    { id: 'n3', label: 'Node 3', size: { width: 80, height: 50 } },
    { id: 'n4', label: 'Node 4', size: { width: 80, height: 50 } },
    { id: 'n5', label: 'Node 5', size: { width: 80, height: 50 } },
    { id: 'n6', label: 'Node 6', size: { width: 80, height: 50 } }
  ];

  const edges = [
    { id: 'e1', source: 'n1', target: 'n2' },
    { id: 'e2', source: 'n1', target: 'n3' },
    { id: 'e3', source: 'n2', target: 'n4' },
    { id: 'e4', source: 'n3', target: 'n4' },
    { id: 'e5', source: 'n2', target: 'n5' },
    { id: 'e6', source: 'n4', target: 'n6' },
    { id: 'e7', source: 'n5', target: 'n6' }
  ];

  return { nodes, edges };
};

const createCyclicGraphData = () => {
  const nodes = [
    { id: 'a', label: 'A', size: { width: 80, height: 50 } },
    { id: 'b', label: 'B', size: { width: 80, height: 50 } },
    { id: 'c', label: 'C', size: { width: 80, height: 50 } }
  ];

  const edges = [
    { id: 'e1', source: 'a', target: 'b' },
    { id: 'e2', source: 'b', target: 'c' },
    { id: 'e3', source: 'c', target: 'a' } // Creates cycle
  ];

  return { nodes, edges };
};

const createLongEdgeGraphData = () => {
  const nodes = [
    { id: 'layer0', label: 'Layer 0', size: { width: 80, height: 50 } },
    { id: 'layer1', label: 'Layer 1', size: { width: 80, height: 50 } },
    { id: 'layer2', label: 'Layer 2', size: { width: 80, height: 50 } },
    { id: 'layer4', label: 'Layer 4', size: { width: 80, height: 50 } }
  ];

  const edges = [
    { id: 'e1', source: 'layer0', target: 'layer1' },
    { id: 'e2', source: 'layer0', target: 'layer4' }, // Long edge spanning multiple layers
    { id: 'e3', source: 'layer1', target: 'layer2' }
  ];

  return { nodes, edges };
};

describe('LayeredLayout', () => {
  let layout;
  let graphData;

  beforeEach(() => {
    graphData = createDAGGraphData();
    jest.clearAllMocks();
    performance.now.mockReturnValue(1000);
  });

  afterEach(() => {
    if (layout) {
      layout.destroy();
      layout = null;
    }
  });

  describe('Initialization', () => {
    test('should create layout with default configuration', () => {
      layout = new LayeredLayout();

      expect(layout).toBeDefined();
      expect(layout.config.layerDirection).toBe('top-to-bottom');
      expect(layout.config.layerSpacing).toBe(120);
      expect(layout.config.nodeSpacing).toBe(80);
      expect(layout.config.layerAlignment).toBe('center');
      expect(layout.config.minimizeEdgeCrossings).toBe(true);
      expect(layout.config.cycleHandling).toBe('break');
      expect(layout.config.insertVirtualNodes).toBe(true);
      expect(layout.layers).toHaveLength(0);
    });

    test('should accept custom configuration', () => {
      layout = new LayeredLayout({
        layerDirection: 'left-to-right',
        layerSpacing: 150,
        nodeSpacing: 100,
        layerAlignment: 'left',
        nodeAlignment: 'top',
        edgeRouting: 'orthogonal',
        minimizeEdgeCrossings: false,
        cycleHandling: 'ignore',
        feedbackEdges: 'remove',
        layerAssignment: 'topological',
        crossReduction: 'median',
        maxCrossReductionIterations: 15
      });

      expect(layout.config.layerDirection).toBe('left-to-right');
      expect(layout.config.layerSpacing).toBe(150);
      expect(layout.config.nodeSpacing).toBe(100);
      expect(layout.config.layerAlignment).toBe('left');
      expect(layout.config.nodeAlignment).toBe('top');
      expect(layout.config.edgeRouting).toBe('orthogonal');
      expect(layout.config.minimizeEdgeCrossings).toBe(false);
      expect(layout.config.cycleHandling).toBe('ignore');
      expect(layout.config.feedbackEdges).toBe('remove');
      expect(layout.config.layerAssignment).toBe('topological');
      expect(layout.config.crossReduction).toBe('median');
      expect(layout.config.maxCrossReductionIterations).toBe(15);
    });

    test('should have correct metadata', () => {
      layout = new LayeredLayout();
      const metadata = layout.getMetadata();

      expect(metadata.name).toBe('layered-layout');
      expect(metadata.category).toBe('hierarchical');
      expect(metadata.capabilities.directed).toBe(true);
      expect(metadata.capabilities.undirected).toBe(false);
      expect(metadata.capabilities.hierarchical).toBe(true);
      expect(metadata.capabilities.layered).toBe(true);
      expect(metadata.capabilities.crossingMinimization).toBe(true);
    });
  });

  describe('State Management', () => {
    beforeEach(() => {
      layout = new LayeredLayout();
    });

    test('should reset state correctly', () => {
      // Populate some state
      layout.layers = [['node1'], ['node2']];
      layout.nodeToLayer.set('node1', 0);
      layout.nodeRanks.set('node1', 0);
      layout.crossingCount = 5;
      layout.cycles = [['a', 'b', 'c']];

      layout._resetState();

      expect(layout.layers).toHaveLength(0);
      expect(layout.nodeToLayer.size).toBe(0);
      expect(layout.nodeRanks.size).toBe(0);
      expect(layout.crossingCount).toBe(0);
      expect(layout.cycles).toHaveLength(0);
      expect(layout.isDAG).toBe(true);
    });
  });

  describe('Cycle Detection and Handling', () => {
    beforeEach(async () => {
      layout = new LayeredLayout();
      await layout.initialize();
    });

    test('should detect no cycles in DAG', async () => {
      await layout._handleCycles(graphData);

      expect(layout.isDAG).toBe(true);
      expect(layout.cycles).toHaveLength(0);
      expect(layout.feedbackEdges.size).toBe(0);
    });

    test('should detect cycles in cyclic graph', async () => {
      const cyclicData = createCyclicGraphData();
      await layout._handleCycles(cyclicData);

      expect(layout.isDAG).toBe(false);
      expect(layout.cycles.length).toBeGreaterThan(0);
      expect(layout.feedbackEdges.size).toBeGreaterThan(0);
    });

    test('should handle cycle breaking configuration', async () => {
      layout.config.cycleHandling = 'break';
      layout.config.feedbackEdges = 'remove';
      const cyclicData = createCyclicGraphData();
      const originalEdgeCount = cyclicData.edges.length;

      await layout._handleCycles(cyclicData);

      expect(cyclicData.edges.length).toBeLessThan(originalEdgeCount);
    });

    test('should throw error when cycleHandling is error', async () => {
      layout.config.cycleHandling = 'error';
      const cyclicData = createCyclicGraphData();

      await expect(layout._handleCycles(cyclicData)).rejects.toThrow('Graph contains cycles');
    });
  });

  describe('Layer Assignment', () => {
    beforeEach(async () => {
      layout = new LayeredLayout();
      await layout.initialize();
    });

    test('should assign layers using longest path algorithm', async () => {
      layout.config.layerAssignment = 'longest-path';
      await layout._assignLayers(graphData);

      expect(layout.nodeRanks.size).toBe(graphData.nodes.length);
      expect(layout.layers.length).toBeGreaterThan(0);

      // Root should be at layer 0
      expect(layout.nodeRanks.get('root')).toBe(0);

      // Check hierarchy levels are correct
      const rootRank = layout.nodeRanks.get('root');
      const aRank = layout.nodeRanks.get('a');
      const bRank = layout.nodeRanks.get('b');
      const cRank = layout.nodeRanks.get('c');

      expect(aRank).toBeGreaterThan(rootRank);
      expect(bRank).toBeGreaterThan(rootRank);
      expect(cRank).toBeGreaterThan(aRank);
    });

    test('should assign layers using topological ordering', async () => {
      layout.config.layerAssignment = 'topological';
      await layout._assignLayers(graphData);

      expect(layout.nodeRanks.size).toBe(graphData.nodes.length);

      // Check that dependencies are respected
      const rootRank = layout.nodeRanks.get('root');
      const aRank = layout.nodeRanks.get('a');
      const cRank = layout.nodeRanks.get('c');

      expect(aRank).toBeGreaterThan(rootRank);
      expect(cRank).toBeGreaterThan(aRank);
    });

    test('should organize layers correctly', async () => {
      await layout._assignLayers(graphData);

      // Check layer structure
      expect(layout.layers[0]).toContain('root');

      // Each layer should contain appropriate nodes
      layout.layers.forEach((layer, index) => {
        layer.forEach(nodeId => {
          expect(layout.nodeToLayer.get(nodeId)).toBe(index);
        });
      });
    });

    test('should handle specified root nodes', async () => {
      layout.config.rootNodes = ['a'];
      await layout._assignLayers(graphData);

      // 'a' should be in topological order even if not naturally a root
      expect(layout.topologicalOrder).toContain('a');
    });
  });

  describe('Virtual Node Insertion', () => {
    beforeEach(async () => {
      layout = new LayeredLayout({
        insertVirtualNodes: true
      });
      await layout.initialize();
    });

    test('should insert virtual nodes for long edges', async () => {
      const longEdgeData = createLongEdgeGraphData();
      await layout._assignLayers(longEdgeData);

      const originalNodeCount = longEdgeData.nodes.length;
      const originalEdgeCount = longEdgeData.edges.length;

      await layout._insertVirtualNodes(longEdgeData);

      // Should have added virtual nodes
      expect(longEdgeData.nodes.length).toBeGreaterThan(originalNodeCount);
      expect(layout.virtualNodes.size).toBeGreaterThan(0);

      // Should have replaced long edges with segments
      const hasVirtualEdges = longEdgeData.edges.some(e => e.isVirtual);
      expect(hasVirtualEdges).toBe(true);
    });

    test('should not insert virtual nodes when disabled', async () => {
      layout.config.insertVirtualNodes = false;
      const longEdgeData = createLongEdgeGraphData();
      await layout._assignLayers(longEdgeData);

      const originalNodeCount = longEdgeData.nodes.length;
      await layout._insertVirtualNodes(longEdgeData);

      expect(longEdgeData.nodes.length).toBe(originalNodeCount);
      expect(layout.virtualNodes.size).toBe(0);
    });
  });

  describe('Cross Reduction', () => {
    beforeEach(async () => {
      layout = new LayeredLayout({
        minimizeEdgeCrossings: true,
        crossReduction: 'barycenter',
        maxCrossReductionIterations: 5
      });
      await layout.initialize();
    });

    test('should reduce crossings with barycenter method', async () => {
      const complexData = createComplexDAGData();
      await layout._assignLayers(complexData);

      const initialCrossings = layout._countCrossings(complexData);
      await layout._reduceCrossings(complexData);
      const finalCrossings = layout._countCrossings(complexData);

      expect(layout.crossingCount).toBe(finalCrossings);
      // Crossings should be reduced or stay the same
      expect(finalCrossings).toBeLessThanOrEqual(initialCrossings);
    });

    test('should use median cross reduction method', async () => {
      layout.config.crossReduction = 'median';
      const complexData = createComplexDAGData();
      await layout._assignLayers(complexData);

      await layout._reduceCrossings(complexData);

      expect(layout.crossingCount).toBeGreaterThanOrEqual(0);
    });

    test('should skip cross reduction when disabled', async () => {
      layout.config.crossReduction = 'none';
      const complexData = createComplexDAGData();
      await layout._assignLayers(complexData);

      await layout._reduceCrossings(complexData);

      // Should not have changed layer order significantly
      expect(layout.crossingCount).toBe(0);
    });

    test('should count crossings correctly', async () => {
      const complexData = createComplexDAGData();
      await layout._assignLayers(complexData);

      const crossingCount = layout._countCrossings(complexData);

      expect(crossingCount).toBeGreaterThanOrEqual(0);
      expect(Number.isInteger(crossingCount)).toBe(true);
    });

    test('should order layer by adjacent nodes', async () => {
      const complexData = createComplexDAGData();
      await layout._assignLayers(complexData);

      if (layout.layers.length >= 2) {
        const layerIndex = 1;
        const originalOrder = [...layout.layers[layerIndex]];
        const newOrder = layout._orderLayerByAdjacent(layerIndex, complexData, 'down');

        expect(newOrder).toBeDefined();
        expect(newOrder.length).toBe(originalOrder.length);
        expect(newOrder.every(nodeId => originalOrder.includes(nodeId))).toBe(true);
      }
    });
  });

  describe('Node Positioning', () => {
    beforeEach(async () => {
      layout = new LayeredLayout({
        layerDirection: 'top-to-bottom',
        layerSpacing: 100,
        nodeSpacing: 80,
        layerAlignment: 'center',
        bounds: { width: 800, height: 600, padding: 50 }
      });
      await layout.initialize();
    });

    test('should calculate layer positions for top-to-bottom', async () => {
      await layout._assignLayers(graphData);
      layout._calculateLayerPositions();

      expect(layout.layerPositions.size).toBeGreaterThan(0);

      // First layer should be at position 0
      expect(layout.layerPositions.get(0)).toBe(0);

      // Subsequent layers should be spaced correctly
      if (layout.layers.length > 1) {
        expect(layout.layerPositions.get(1)).toBe(100); // layerSpacing
      }
    });

    test('should calculate layer positions for bottom-to-top', async () => {
      layout.config.layerDirection = 'bottom-to-top';
      await layout._assignLayers(graphData);
      layout._calculateLayerPositions();

      // Last layer should be at position 0
      const lastLayerIndex = layout.layers.length - 1;
      expect(layout.layerPositions.get(lastLayerIndex)).toBe(0);
    });

    test('should position nodes in layer with center alignment', async () => {
      await layout._assignLayers(graphData);
      layout._calculateLayerPositions();

      const layerIndex = 0;
      layout._positionNodesInLayer(layerIndex, graphData);

      // Should have positioned nodes for layer 0
      const layer0Nodes = layout.layers[layerIndex];
      layer0Nodes.forEach(nodeId => {
        const position = layout.nodePositions.get(nodeId);
        expect(position).toBeDefined();
        expect(position.x).toBeDefined();
        expect(position.y).toBeDefined();
        expect(position.layer).toBe(layerIndex);
      });
    });

    test('should align nodes left in layer', async () => {
      layout.config.layerAlignment = 'left';
      await layout._assignLayers(graphData);
      await layout._positionNodes(graphData);

      // Check that positions are calculated
      expect(layout.nodePositions.size).toBeGreaterThan(0);

      // All positions should be defined
      layout.nodePositions.forEach(position => {
        expect(position.x).toBeDefined();
        expect(position.y).toBeDefined();
        expect(isFinite(position.x)).toBe(true);
        expect(isFinite(position.y)).toBe(true);
      });
    });
  });

  describe('Coordinate Calculation', () => {
    beforeEach(async () => {
      layout = new LayeredLayout({
        bounds: { width: 800, height: 600, padding: 50 }
      });
      await layout.initialize();
    });

    test('should calculate final coordinates with centering', async () => {
      await layout._assignLayers(graphData);
      await layout._positionNodes(graphData);
      await layout._calculateCoordinates();

      expect(layout.nodePositions.size).toBe(graphData.nodes.length);

      // All nodes should have valid coordinates
      layout.nodePositions.forEach(position => {
        expect(isFinite(position.x)).toBe(true);
        expect(isFinite(position.y)).toBe(true);
        expect(position.layer).toBeGreaterThanOrEqual(0);
        expect(position.layerPosition).toBeGreaterThanOrEqual(0);
      });
    });

    test('should handle empty positions gracefully', async () => {
      layout.nodePositions.clear();
      await layout._calculateCoordinates();

      expect(layout.nodePositions.size).toBe(0);
    });
  });

  describe('Edge Routing', () => {
    beforeEach(async () => {
      layout = new LayeredLayout({
        edgeRouting: 'straight'
      });
      await layout.initialize();
    });

    test('should route edges with straight routing', async () => {
      await layout._assignLayers(graphData);
      await layout._positionNodes(graphData);
      await layout._routeEdges(graphData);

      // Should have edge paths for each edge
      graphData.edges.forEach(edge => {
        const path = layout.edgePaths.get(edge.id);
        expect(path).toBeDefined();
        expect(path.length).toBeGreaterThanOrEqual(2);
        expect(path[0]).toHaveProperty('x');
        expect(path[0]).toHaveProperty('y');
      });
    });

    test('should route edges with orthogonal routing', async () => {
      layout.config.edgeRouting = 'orthogonal';
      layout.config.layerDirection = 'top-to-bottom';

      await layout._assignLayers(graphData);
      await layout._positionNodes(graphData);
      await layout._routeEdges(graphData);

      // Orthogonal paths should have more points
      const edgeId = graphData.edges[0].id;
      const path = layout.edgePaths.get(edgeId);
      if (path) {
        expect(path.length).toBeGreaterThanOrEqual(2);
        // For vertical layout, orthogonal routing should create intermediate points
        if (path.length > 2) {
          expect(path[1]).toHaveProperty('x');
          expect(path[1]).toHaveProperty('y');
        }
      }
    });
  });

  describe('Layout Execution', () => {
    beforeEach(async () => {
      layout = new LayeredLayout({
        bounds: { width: 800, height: 600, padding: 50 }
      });
      await layout.initialize();
    });

    test('should execute complete layered layout', async () => {
      const result = await layout.layout(graphData);

      expect(result.positions).toBeInstanceOf(Map);
      expect(result.positions.size).toBe(graphData.nodes.length);
      expect(result.bounds).toBeDefined();
      expect(result.bounds.width).toBeGreaterThan(0);
      expect(result.bounds.height).toBeGreaterThan(0);
      expect(result.edges).toBeInstanceOf(Map);
      expect(result.metadata).toBeDefined();
    });

    test('should include layered metadata in results', async () => {
      const result = await layout.layout(graphData);

      expect(result.metadata.algorithm).toBe('layered');
      expect(result.metadata.layerDirection).toBe('top-to-bottom');
      expect(result.metadata.layerCount).toBeGreaterThan(0);
      expect(result.metadata.nodeCount).toBe(graphData.nodes.length);
      expect(result.metadata.crossingCount).toBeGreaterThanOrEqual(0);
      expect(result.metadata.isDAG).toBe(true);
      expect(result.metadata.executionTime).toBeGreaterThan(0);
    });

    test('should handle complex DAG with crossing reduction', async () => {
      const complexData = createComplexDAGData();
      layout.config.minimizeEdgeCrossings = true;
      layout.config.crossReduction = 'barycenter';

      const result = await layout.layout(complexData);

      expect(result.positions.size).toBe(complexData.nodes.length);
      expect(result.metadata.crossingCount).toBeGreaterThanOrEqual(0);
      expect(result.metadata.layerCount).toBeGreaterThan(1);
    });

    test('should handle cyclic graph with feedback edges', async () => {
      const cyclicData = createCyclicGraphData();
      layout.config.cycleHandling = 'break';
      layout.config.feedbackEdges = 'minimize';

      const result = await layout.layout(cyclicData);

      expect(result.positions.size).toBe(cyclicData.nodes.length);
      expect(result.metadata.isDAG).toBe(false);
      expect(result.metadata.cycleCount).toBeGreaterThan(0);
    });
  });

  describe('Layout Information', () => {
    beforeEach(async () => {
      layout = new LayeredLayout();
      await layout.initialize();
      await layout.layout(graphData);
    });

    test('should provide layout information', () => {
      const layoutInfo = layout.getLayoutInfo();

      expect(layoutInfo.layerCount).toBe(layout.layers.length);
      expect(layoutInfo.layers).toBeDefined();
      expect(layoutInfo.crossingCount).toBe(layout.crossingCount);
      expect(layoutInfo.cycleCount).toBe(layout.cycles.length);
      expect(layoutInfo.isDAG).toBe(layout.isDAG);
      expect(layoutInfo.virtualNodeCount).toBe(layout.virtualNodes.size);
      expect(layoutInfo.direction).toBe(layout.config.layerDirection);
      expect(layoutInfo.totalNodes).toBe(layout.nodePositions.size);
    });

    test('should provide layer details', () => {
      const layoutInfo = layout.getLayoutInfo();

      layoutInfo.layers.forEach((layerInfo, index) => {
        expect(layerInfo.index).toBe(index);
        expect(layerInfo.nodeCount).toBeGreaterThanOrEqual(0);
        expect(layerInfo.position).toBeDefined();
      });
    });
  });

  describe('Configuration Updates', () => {
    beforeEach(async () => {
      layout = new LayeredLayout();
      await layout.initialize();
    });

    test('should update configuration and clear state', () => {
      // Populate some state
      layout.layers = [['node1']];
      layout.nodeRanks.set('node1', 0);
      layout.crossingCount = 3;

      layout.updateConfig({ layerSpacing: 150 });

      expect(layout.config.layerSpacing).toBe(150);
      expect(layout.layers).toHaveLength(0);
      expect(layout.nodeRanks.size).toBe(0);
      expect(layout.crossingCount).toBe(0);
    });
  });

  describe('Edge Cases', () => {
    beforeEach(async () => {
      layout = new LayeredLayout();
      await layout.initialize();
    });

    test('should handle empty graph data', async () => {
      const emptyData = { nodes: [], edges: [] };
      const result = await layout.layout(emptyData);

      expect(result.positions.size).toBe(0);
      expect(result.bounds).toEqual({ x: 0, y: 0, width: 0, height: 0 });
      expect(result.metadata.layerCount).toBe(0);
    });

    test('should handle single node', async () => {
      const singleNodeData = {
        nodes: [{ id: 'single', size: { width: 80, height: 50 } }],
        edges: []
      };

      const result = await layout.layout(singleNodeData);

      expect(result.positions.size).toBe(1);
      const position = result.positions.get('single');
      expect(position).toBeDefined();
      expect(position.layer).toBe(0);
    });

    test('should handle nodes without edges', async () => {
      const disconnectedData = {
        nodes: [
          { id: 'isolated1', size: { width: 80, height: 50 } },
          { id: 'isolated2', size: { width: 80, height: 50 } }
        ],
        edges: []
      };

      const result = await layout.layout(disconnectedData);

      expect(result.positions.size).toBe(2);
      expect(result.metadata.layerCount).toBe(1); // All in same layer
    });

    test('should handle graph with self-loops', async () => {
      const selfLoopData = {
        nodes: [{ id: 'node1', size: { width: 80, height: 50 } }],
        edges: [{ id: 'self', source: 'node1', target: 'node1' }]
      };

      const result = await layout.layout(selfLoopData);

      expect(result.positions.size).toBe(1);
      // Should handle self-loop gracefully without crashing
    });
  });

  describe('Performance and Bounds', () => {
    beforeEach(async () => {
      layout = new LayeredLayout();
      await layout.initialize();
    });

    test('should calculate correct layout bounds', async () => {
      const result = await layout.layout(graphData);

      expect(result.bounds.x).toBeDefined();
      expect(result.bounds.y).toBeDefined();
      expect(result.bounds.width).toBeGreaterThan(0);
      expect(result.bounds.height).toBeGreaterThan(0);

      // Bounds should encompass all node positions
      let minX = Infinity, maxX = -Infinity;
      let minY = Infinity, maxY = -Infinity;

      result.positions.forEach(pos => {
        minX = Math.min(minX, pos.x);
        maxX = Math.max(maxX, pos.x);
        minY = Math.min(minY, pos.y);
        maxY = Math.max(maxY, pos.y);
      });

      expect(result.bounds.x).toBeLessThanOrEqual(minX);
      expect(result.bounds.y).toBeLessThanOrEqual(minY);
    });

    test('should track execution time', async () => {
      performance.now.mockReturnValueOnce(1000).mockReturnValueOnce(1150);

      const result = await layout.layout(graphData);

      expect(result.metadata.executionTime).toBe(150);
    });
  });

  describe('Error Handling', () => {
    test('should handle invalid graph data', async () => {
      layout = new LayeredLayout();
      await layout.initialize();

      await expect(layout.layout(null)).rejects.toThrow();
    });

    test('should handle cycle detection errors', async () => {
      layout = new LayeredLayout();
      await layout.initialize();

      // Force an error by corrupting cycle detection
      const originalHandleCycles = layout._handleCycles;
      layout._handleCycles = () => {
        throw new Error('Cycle detection failed');
      };

      await expect(layout.layout(graphData)).rejects.toThrow('Cycle detection failed');

      // Restore method
      layout._handleCycles = originalHandleCycles;
    });

    test('should handle layer assignment errors', async () => {
      layout = new LayeredLayout();
      await layout.initialize();

      // Force an error in layer assignment
      const originalAssignLayers = layout._assignLayers;
      layout._assignLayers = () => {
        throw new Error('Layer assignment failed');
      };

      await expect(layout.layout(graphData)).rejects.toThrow('Layer assignment failed');

      // Restore method
      layout._assignLayers = originalAssignLayers;
    });
  });

  describe('Arrays Equality Helper', () => {
    beforeEach(() => {
      layout = new LayeredLayout();
    });

    test('should check array equality correctly', () => {
      expect(layout._arraysEqual([1, 2, 3], [1, 2, 3])).toBe(true);
      expect(layout._arraysEqual([1, 2, 3], [3, 2, 1])).toBe(false);
      expect(layout._arraysEqual([], [])).toBe(true);
      expect(layout._arraysEqual([1], [1, 2])).toBe(false);
      expect(layout._arraysEqual(['a', 'b'], ['a', 'b'])).toBe(true);
    });
  });
});