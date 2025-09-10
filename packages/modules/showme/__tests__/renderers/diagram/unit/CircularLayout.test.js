/**
 * Unit tests for CircularLayout
 * Tests circular and radial layout algorithms with various configurations
 */

import { jest } from '@jest/globals';
import { CircularLayout } from '../../../../src/renderers/diagram/layout/CircularLayout.js';

// Mock performance API
global.performance = {
  now: jest.fn(() => Date.now())
};

const createSampleGraphData = (nodeCount = 6, withEdges = true) => {
  const nodes = [];
  const edges = [];
  
  for (let i = 0; i < nodeCount; i++) {
    nodes.push({
      id: `node${i}`,
      label: `Node ${i}`,
      size: { width: 80, height: 50 },
      type: i % 2 === 0 ? 'root' : 'child'
    });
  }
  
  if (withEdges) {
    // Create a tree structure for hierarchy tests
    for (let i = 1; i < nodeCount; i++) {
      edges.push({
        id: `edge${i}`,
        source: `node${Math.floor((i - 1) / 2)}`,
        target: `node${i}`
      });
    }
  }
  
  return { nodes, edges };
};

const createHierarchicalGraphData = () => {
  const nodes = [
    { id: 'root', label: 'Root', size: { width: 100, height: 60 } },
    { id: 'child1', label: 'Child 1', size: { width: 80, height: 50 } },
    { id: 'child2', label: 'Child 2', size: { width: 80, height: 50 } },
    { id: 'grandchild1', label: 'Grandchild 1', size: { width: 70, height: 40 } },
    { id: 'grandchild2', label: 'Grandchild 2', size: { width: 70, height: 40 } },
    { id: 'grandchild3', label: 'Grandchild 3', size: { width: 70, height: 40 } }
  ];
  
  const edges = [
    { id: 'e1', source: 'root', target: 'child1' },
    { id: 'e2', source: 'root', target: 'child2' },
    { id: 'e3', source: 'child1', target: 'grandchild1' },
    { id: 'e4', source: 'child1', target: 'grandchild2' },
    { id: 'e5', source: 'child2', target: 'grandchild3' }
  ];
  
  return { nodes, edges };
};

describe('CircularLayout', () => {
  let layout;
  let graphData;

  beforeEach(() => {
    graphData = createSampleGraphData();
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
      layout = new CircularLayout();
      
      expect(layout).toBeDefined();
      expect(layout.config.layoutType).toBe('circle');
      expect(layout.config.radius).toBe(200);
      expect(layout.config.startAngle).toBe(0);
      expect(layout.config.endAngle).toBe(2 * Math.PI);
      expect(layout.config.clockwise).toBe(true);
      expect(layout.centerPoint).toEqual({ x: 0, y: 0 });
      expect(layout.nodesByLevel.size).toBe(0);
    });

    test('should accept custom configuration', () => {
      layout = new CircularLayout({
        layoutType: 'radial',
        radius: 300,
        startAngle: Math.PI / 4,
        endAngle: Math.PI * 1.75,
        clockwise: false,
        ringCount: 5,
        ringSpacing: 150,
        innerRadius: 80,
        levelSpacing: 120
      });

      expect(layout.config.layoutType).toBe('radial');
      expect(layout.config.radius).toBe(300);
      expect(layout.config.startAngle).toBe(Math.PI / 4);
      expect(layout.config.endAngle).toBe(Math.PI * 1.75);
      expect(layout.config.clockwise).toBe(false);
      expect(layout.config.ringCount).toBe(5);
      expect(layout.config.ringSpacing).toBe(150);
      expect(layout.config.innerRadius).toBe(80);
      expect(layout.config.levelSpacing).toBe(120);
    });

    test('should have correct metadata', () => {
      layout = new CircularLayout();
      const metadata = layout.getMetadata();
      
      expect(metadata.name).toBe('circular-layout');
      expect(metadata.category).toBe('geometric');
      expect(metadata.capabilities.radial).toBe(true);
      expect(metadata.capabilities.hierarchical).toBe(true);
      expect(metadata.capabilities.directed).toBe(true);
    });
  });

  describe('Center Point Calculation', () => {
    beforeEach(() => {
      layout = new CircularLayout({
        bounds: { width: 800, height: 600, padding: 50 }
      });
    });

    test('should calculate center point from bounds', () => {
      layout._calculateCenterPoint();
      
      expect(layout.centerPoint.x).toBe(400);
      expect(layout.centerPoint.y).toBe(300);
    });

    test('should use explicit center coordinates', () => {
      layout.config.centerX = 250;
      layout.config.centerY = 150;
      
      layout._calculateCenterPoint();
      
      expect(layout.centerPoint.x).toBe(250);
      expect(layout.centerPoint.y).toBe(150);
    });
  });

  describe('Node Preprocessing', () => {
    beforeEach(() => {
      layout = new CircularLayout();
    });

    test('should sort nodes when sortBy is specified', () => {
      layout.config.sortBy = 'label';
      
      const processedNodes = layout._preprocessNodes(graphData.nodes, graphData.edges);
      
      expect(processedNodes[0].id).toBe('node0');
      expect(processedNodes[1].id).toBe('node1');
    });

    test('should build hierarchy for radial layout', () => {
      layout.config.layoutType = 'radial';
      const hierarchicalData = createHierarchicalGraphData();
      
      layout._preprocessNodes(hierarchicalData.nodes, hierarchicalData.edges);
      
      expect(layout.nodesByLevel.size).toBeGreaterThan(1);
      expect(layout.nodesByLevel.has(0)).toBe(true); // Root level
      expect(layout.hierarchy.size).toBe(hierarchicalData.nodes.length);
    });

    test('should build hierarchy for concentric layout', () => {
      layout.config.layoutType = 'concentric';
      const hierarchicalData = createHierarchicalGraphData();
      
      layout._preprocessNodes(hierarchicalData.nodes, hierarchicalData.edges);
      
      expect(layout.nodesByLevel.size).toBeGreaterThan(1);
      expect(layout.hierarchy.size).toBe(hierarchicalData.nodes.length);
    });

    test('should handle root node specification', () => {
      layout.config.layoutType = 'radial';
      layout.config.rootNode = 'node2';
      
      layout._preprocessNodes(graphData.nodes, graphData.edges);
      
      const rootLevelNodes = layout.nodesByLevel.get(0);
      expect(rootLevelNodes).toBeDefined();
      expect(rootLevelNodes[0].id).toBe('node2');
    });
  });

  describe('Hierarchy Building', () => {
    beforeEach(() => {
      layout = new CircularLayout();
    });

    test('should build correct hierarchy from edges', () => {
      const hierarchicalData = createHierarchicalGraphData();
      
      layout._buildHierarchy(hierarchicalData.nodes, hierarchicalData.edges);
      
      // Check levels
      expect(layout.nodesByLevel.get(0)).toHaveLength(1); // Root
      expect(layout.nodesByLevel.get(1)).toHaveLength(2); // Children
      expect(layout.nodesByLevel.get(2)).toHaveLength(3); // Grandchildren
      
      // Check hierarchy relationships
      const rootNode = layout.hierarchy.get('root');
      expect(rootNode.children).toHaveLength(2);
      expect(rootNode.level).toBe(0);
    });

    test('should handle disconnected nodes', () => {
      const nodes = [
        { id: 'isolated1', label: 'Isolated 1' },
        { id: 'isolated2', label: 'Isolated 2' }
      ];
      const edges = [];
      
      layout._buildHierarchy(nodes, edges);
      
      expect(layout.nodesByLevel.get(0)).toHaveLength(1); // First node as root
    });

    test('should assign levels using BFS', () => {
      const hierarchicalData = createHierarchicalGraphData();
      
      layout._buildHierarchy(hierarchicalData.nodes, hierarchicalData.edges);
      
      const child1 = layout.hierarchy.get('child1');
      const grandchild1 = layout.hierarchy.get('grandchild1');
      
      expect(child1.level).toBe(1);
      expect(grandchild1.level).toBe(2);
      expect(grandchild1.parent).toBe(child1);
    });
  });

  describe('Circle Layout', () => {
    beforeEach(async () => {
      layout = new CircularLayout({
        layoutType: 'circle',
        radius: 200,
        bounds: { width: 500, height: 400, padding: 50 }
      });
      await layout.initialize();
    });

    test('should position nodes in circle', async () => {
      const result = await layout.layout(graphData);
      
      expect(result.positions.size).toBe(6);
      
      // Check that all nodes are at correct radius
      result.positions.forEach((pos, nodeId) => {
        const distance = Math.sqrt(
          Math.pow(pos.x - layout.centerPoint.x, 2) + 
          Math.pow(pos.y - layout.centerPoint.y, 2)
        );
        expect(distance).toBeCloseTo(200, 1);
        expect(pos.radius).toBe(200);
        expect(pos.angle).toBeDefined();
      });
    });

    test('should distribute nodes evenly around circle', async () => {
      const simpleData = createSampleGraphData(4, false);
      const result = await layout.layout(simpleData);
      
      const angles = [];
      result.positions.forEach(pos => angles.push(pos.angle));
      angles.sort((a, b) => a - b);
      
      // Check angular spacing
      const expectedStep = (2 * Math.PI) / 4;
      for (let i = 0; i < angles.length - 1; i++) {
        expect(angles[i + 1] - angles[i]).toBeCloseTo(expectedStep, 2);
      }
    });

    test('should respect clockwise direction', async () => {
      layout.config.clockwise = false;
      
      const simpleData = createSampleGraphData(3, false);
      const result = await layout.layout(simpleData);
      
      const positions = Array.from(result.positions.values());
      const firstAngle = positions[0].angle;
      const secondAngle = positions[1].angle;
      
      // With counter-clockwise, second node should have smaller angle (going backwards)
      expect(secondAngle).toBeLessThan(firstAngle);
    });

    test('should handle angular range limits', async () => {
      layout.config.startAngle = 0;
      layout.config.endAngle = Math.PI; // Half circle
      
      const result = await layout.layout(graphData);
      
      result.positions.forEach(pos => {
        expect(pos.angle).toBeGreaterThanOrEqual(0);
        expect(pos.angle).toBeLessThanOrEqual(Math.PI);
      });
    });
  });

  describe('Concentric Layout', () => {
    beforeEach(async () => {
      layout = new CircularLayout({
        layoutType: 'concentric',
        ringCount: 3,
        ringSpacing: 100,
        innerRadius: 50,
        bounds: { width: 600, height: 500, padding: 50 }
      });
      await layout.initialize();
    });

    test('should position nodes in concentric rings', async () => {
      const hierarchicalData = createHierarchicalGraphData();
      const result = await layout.layout(hierarchicalData);
      
      expect(result.positions.size).toBe(6);
      expect(layout.rings.length).toBeGreaterThan(0);
      
      // Check that different levels have different radii
      const rootPos = result.positions.get('root');
      const child1Pos = result.positions.get('child1');
      const grandchild1Pos = result.positions.get('grandchild1');
      
      expect(rootPos.radius).toBeLessThan(child1Pos.radius);
      expect(child1Pos.radius).toBeLessThan(grandchild1Pos.radius);
    });

    test('should distribute nodes evenly without hierarchy', async () => {
      const simpleData = createSampleGraphData(9, false);
      const result = await layout.layout(simpleData);
      
      expect(result.positions.size).toBe(9);
      expect(layout.rings.length).toBe(3); // 3 rings as configured
      
      // Each ring should have nodes
      layout.rings.forEach(ring => {
        expect(ring.nodeCount).toBeGreaterThan(0);
      });
    });

    test('should handle single node per ring', async () => {
      const singleNodeData = createSampleGraphData(1, false);
      const result = await layout.layout(singleNodeData);
      
      const nodePos = result.positions.get('node0');
      expect(nodePos).toBeDefined();
      expect(nodePos.level).toBeDefined();
    });

    test('should create correct ring spacing', async () => {
      const result = await layout.layout(graphData);
      
      // Check ring spacing
      for (let i = 1; i < layout.rings.length; i++) {
        const prevRadius = layout.rings[i - 1].radius;
        const currRadius = layout.rings[i].radius;
        expect(currRadius - prevRadius).toBe(100); // ringSpacing
      }
    });
  });

  describe('Radial Layout', () => {
    beforeEach(async () => {
      layout = new CircularLayout({
        layoutType: 'radial',
        levelSpacing: 100,
        branchAngle: Math.PI / 4,
        bounds: { width: 600, height: 500, padding: 50 }
      });
      await layout.initialize();
    });

    test('should place root at center', async () => {
      const hierarchicalData = createHierarchicalGraphData();
      const result = await layout.layout(hierarchicalData);
      
      const rootPos = result.positions.get('root');
      expect(rootPos.x).toBe(layout.centerPoint.x);
      expect(rootPos.y).toBe(layout.centerPoint.y);
      expect(rootPos.radius).toBe(0);
      expect(rootPos.level).toBe(0);
    });

    test('should position nodes at correct radial levels', async () => {
      const hierarchicalData = createHierarchicalGraphData();
      const result = await layout.layout(hierarchicalData);
      
      const child1Pos = result.positions.get('child1');
      const grandchild1Pos = result.positions.get('grandchild1');
      
      expect(child1Pos.level).toBe(1);
      expect(child1Pos.radius).toBe(100); // 1 * levelSpacing
      expect(grandchild1Pos.level).toBe(2);
      expect(grandchild1Pos.radius).toBe(200); // 2 * levelSpacing
    });

    test('should group children by parent', async () => {
      const hierarchicalData = createHierarchicalGraphData();
      const result = await layout.layout(hierarchicalData);
      
      // Children of root should be grouped together
      const child1Pos = result.positions.get('child1');
      const child2Pos = result.positions.get('child2');
      
      expect(child1Pos.level).toBe(child2Pos.level);
      expect(child1Pos.radius).toBe(child2Pos.radius);
      
      // Their angles should be different but in same angular section
      expect(child1Pos.angle).not.toBe(child2Pos.angle);
    });

    test('should fallback to circle layout without hierarchy', async () => {
      const simpleData = createSampleGraphData(4, false);
      const result = await layout.layout(simpleData);
      
      // Should fallback to circle layout
      expect(result.positions.size).toBe(4);
      
      // All nodes should be at same radius (circle fallback)
      const radii = Array.from(result.positions.values()).map(pos => pos.radius);
      const uniqueRadii = [...new Set(radii)];
      expect(uniqueRadii.length).toBe(1);
    });
  });

  describe('Arc Layout', () => {
    beforeEach(async () => {
      layout = new CircularLayout({
        layoutType: 'arc',
        startAngle: 0,
        endAngle: Math.PI,
        radius: 200,
        bounds: { width: 500, height: 400, padding: 50 }
      });
      await layout.initialize();
    });

    test('should position nodes in arc', async () => {
      const result = await layout.layout(graphData);
      
      expect(result.positions.size).toBe(6);
      
      // All nodes should be at same radius but different angles within arc
      result.positions.forEach(pos => {
        expect(pos.radius).toBe(200);
        expect(pos.angle).toBeGreaterThanOrEqual(0);
        expect(pos.angle).toBeLessThanOrEqual(Math.PI);
      });
    });

    test('should distribute nodes evenly along arc', async () => {
      const simpleData = createSampleGraphData(5, false);
      const result = await layout.layout(simpleData);
      
      const angles = Array.from(result.positions.values()).map(pos => pos.angle);
      angles.sort((a, b) => a - b);
      
      // First and last should be at arc endpoints
      expect(angles[0]).toBeCloseTo(0, 2);
      expect(angles[angles.length - 1]).toBeCloseTo(Math.PI, 2);
    });

    test('should handle single node in arc', async () => {
      const singleNodeData = createSampleGraphData(1, false);
      const result = await layout.layout(singleNodeData);
      
      const nodePos = result.positions.get('node0');
      expect(nodePos.angle).toBe(0); // Should be at start angle
      expect(nodePos.radius).toBe(200);
    });
  });

  describe('Spiral Layout', () => {
    beforeEach(async () => {
      layout = new CircularLayout({
        layoutType: 'spiral',
        spiralTurns: 2,
        spiralTightness: 0.5,
        innerRadius: 30,
        bounds: { width: 500, height: 400, padding: 50 }
      });
      await layout.initialize();
    });

    test('should position nodes in spiral pattern', async () => {
      const result = await layout.layout(graphData);
      
      expect(result.positions.size).toBe(6);
      
      // Nodes should have increasing radius along spiral
      const positions = Array.from(result.positions.values());
      positions.sort((a, b) => a.angle - b.angle);
      
      for (let i = 1; i < positions.length; i++) {
        expect(positions[i].radius).toBeGreaterThan(positions[i - 1].radius);
      }
    });

    test('should complete specified number of turns', async () => {
      const manyNodesData = createSampleGraphData(20, false);
      const result = await layout.layout(manyNodesData);
      
      const maxAngle = Math.max(...Array.from(result.positions.values()).map(pos => pos.angle));
      const turns = maxAngle / (2 * Math.PI);
      
      expect(turns).toBeCloseTo(2, 0.5); // Should be approximately 2 turns
    });

    test('should start from inner radius', async () => {
      const result = await layout.layout(graphData);
      
      const positions = Array.from(result.positions.values());
      const minRadius = Math.min(...positions.map(pos => pos.radius));
      
      expect(minRadius).toBeGreaterThanOrEqual(30); // Should start near innerRadius
    });
  });

  describe('Layout Results', () => {
    beforeEach(async () => {
      layout = new CircularLayout({
        radius: 200,
        bounds: { width: 500, height: 400, padding: 50 }
      });
      await layout.initialize();
    });

    test('should return valid layout results', async () => {
      const result = await layout.layout(graphData);
      
      expect(result.positions).toBeInstanceOf(Map);
      expect(result.positions.size).toBe(graphData.nodes.length);
      expect(result.bounds).toBeDefined();
      expect(result.bounds.width).toBeGreaterThan(0);
      expect(result.bounds.height).toBeGreaterThan(0);
      expect(result.edges).toBeInstanceOf(Map);
      expect(result.metadata).toBeDefined();
    });

    test('should include circular metadata in results', async () => {
      const result = await layout.layout(graphData);
      
      expect(result.metadata.algorithm).toBe('circular');
      expect(result.metadata.layoutType).toBe('circle');
      expect(result.metadata.centerPoint).toEqual(layout.centerPoint);
      expect(result.metadata.nodeCount).toBe(graphData.nodes.length);
      expect(result.metadata.radius).toBe(200);
      expect(result.metadata.executionTime).toBeGreaterThan(0);
    });

    test('should include position details for each node', async () => {
      const result = await layout.layout(graphData);
      
      result.positions.forEach(position => {
        expect(position.x).toBeDefined();
        expect(position.y).toBeDefined();
        expect(position.angle).toBeDefined();
        expect(position.radius).toBeDefined();
      });
    });

    test('should calculate correct bounds', async () => {
      const result = await layout.layout(graphData);
      
      expect(result.bounds.x).toBeDefined();
      expect(result.bounds.y).toBeDefined();
      expect(result.bounds.width).toBeGreaterThan(0);
      expect(result.bounds.height).toBeGreaterThan(0);
    });
  });

  describe('Layout Information', () => {
    beforeEach(async () => {
      layout = new CircularLayout({
        layoutType: 'concentric',
        radius: 250,
        ringCount: 3,
        bounds: { width: 600, height: 500, padding: 50 }
      });
      await layout.initialize();
    });

    test('should provide layout information', async () => {
      await layout.layout(graphData);
      
      const layoutInfo = layout.getLayoutInfo();
      
      expect(layoutInfo.centerPoint).toEqual(layout.centerPoint);
      expect(layoutInfo.layoutType).toBe('concentric');
      expect(layoutInfo.totalRadius).toBe(250);
      expect(layoutInfo.nodeCount).toBe(layout.nodeAngles.size);
    });

    test('should provide node angle and radius helpers', async () => {
      const result = await layout.layout(graphData);
      
      const firstNodeId = graphData.nodes[0].id;
      const angle = layout.getNodeAngle(firstNodeId);
      const radius = layout.getNodeRadius(firstNodeId);
      
      expect(angle).toBeDefined();
      expect(radius).toBeGreaterThanOrEqual(0);
      
      // Should match position data
      const position = result.positions.get(firstNodeId);
      expect(angle).toBe(position.angle);
      expect(radius).toBe(position.radius);
    });
  });

  describe('Configuration Updates', () => {
    beforeEach(async () => {
      layout = new CircularLayout();
      await layout.initialize();
    });

    test('should update configuration and clear caches', () => {
      // Populate some cached data
      layout.nodeAngles.set('test', 1.5);
      layout.nodeRadii.set('test', 100);
      layout.rings.push({ level: 0, radius: 50, nodeCount: 1 });
      
      layout.updateConfig({ radius: 300 });
      
      expect(layout.config.radius).toBe(300);
      expect(layout.nodeAngles.size).toBe(0);
      expect(layout.nodeRadii.size).toBe(0);
      expect(layout.rings).toHaveLength(0);
    });
  });

  describe('Edge Cases', () => {
    beforeEach(async () => {
      layout = new CircularLayout();
      await layout.initialize();
    });

    test('should handle empty graph data', async () => {
      const emptyData = { nodes: [], edges: [] };
      
      const result = await layout.layout(emptyData);
      
      expect(result.positions.size).toBe(0);
      expect(result.bounds).toEqual({ x: 0, y: 0, width: 0, height: 0 });
    });

    test('should handle single node', async () => {
      const singleNodeData = createSampleGraphData(1, false);
      
      const result = await layout.layout(singleNodeData);
      
      expect(result.positions.size).toBe(1);
      const position = result.positions.get('node0');
      expect(position).toBeDefined();
    });

    test('should handle nodes without edges for hierarchical layouts', async () => {
      layout.config.layoutType = 'radial';
      const noEdgesData = createSampleGraphData(5, false);
      
      const result = await layout.layout(noEdgesData);
      
      expect(result.positions.size).toBe(5);
      // Should fallback to circle layout
    });

    test('should handle disconnected graph components', async () => {
      const disconnectedData = {
        nodes: [
          { id: 'a1', label: 'A1' },
          { id: 'a2', label: 'A2' },
          { id: 'b1', label: 'B1' },
          { id: 'b2', label: 'B2' }
        ],
        edges: [
          { id: 'e1', source: 'a1', target: 'a2' },
          { id: 'e2', source: 'b1', target: 'b2' }
        ]
      };
      
      layout.config.layoutType = 'concentric';
      const result = await layout.layout(disconnectedData);
      
      expect(result.positions.size).toBe(4);
    });

    test('should handle very large radius values', async () => {
      layout.config.radius = 10000;
      
      const result = await layout.layout(graphData);
      
      expect(result.positions.size).toBe(6);
      result.positions.forEach(pos => {
        expect(pos.radius).toBe(10000);
        expect(isFinite(pos.x)).toBe(true);
        expect(isFinite(pos.y)).toBe(true);
      });
    });
  });

  describe('Performance', () => {
    beforeEach(async () => {
      layout = new CircularLayout();
      await layout.initialize();
    });

    test('should complete layout within reasonable time', async () => {
      const largeGraphData = createSampleGraphData(100);
      
      const startTime = Date.now();
      const result = await layout.layout(largeGraphData);
      const endTime = Date.now();
      
      expect(result.positions.size).toBe(100);
      expect(endTime - startTime).toBeLessThan(200); // Should complete within 200ms
    });

    test('should track execution time in metadata', async () => {
      performance.now.mockReturnValueOnce(1000).mockReturnValueOnce(1075);
      
      const result = await layout.layout(graphData);
      
      expect(result.metadata.executionTime).toBe(75);
    });
  });

  describe('Error Handling', () => {
    test('should handle invalid graph data', async () => {
      layout = new CircularLayout();
      await layout.initialize();
      
      await expect(layout.layout(null)).rejects.toThrow();
    });

    test('should handle layout errors gracefully', async () => {
      layout = new CircularLayout();
      await layout.initialize();
      
      // Force an error by corrupting internal state
      const originalCalculateCenter = layout._calculateCenterPoint;
      layout._calculateCenterPoint = () => {
        throw new Error('Center calculation failed');
      };
      
      await expect(layout.layout(graphData)).rejects.toThrow('Center calculation failed');
      
      // Restore method
      layout._calculateCenterPoint = originalCalculateCenter;
    });

    test('should handle invalid configuration gracefully', () => {
      expect(() => {
        layout = new CircularLayout({
          radius: -100, // Invalid radius
          startAngle: 'invalid',
          endAngle: null
        });
      }).not.toThrow();
      
      // Should use reasonable defaults
      expect(layout.config.radius).toBeGreaterThan(0);
    });
  });
});