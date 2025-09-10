/**
 * Unit tests for GridLayout
 * Tests grid-based layout algorithm with various patterns and configurations
 */

import { jest } from '@jest/globals';
import { GridLayout } from '../../../../src/renderers/diagram/layout/GridLayout.js';

// Mock performance API
global.performance = {
  now: jest.fn(() => Date.now())
};

const createSampleGraphData = (nodeCount = 9) => {
  const nodes = [];
  const edges = [];
  
  for (let i = 0; i < nodeCount; i++) {
    nodes.push({
      id: `node${i}`,
      label: `Node ${i}`,
      size: { width: 100, height: 60 },
      type: i % 3 === 0 ? 'primary' : 'secondary' // For grouping tests
    });
  }
  
  // Add some edges for testing
  for (let i = 0; i < nodeCount - 1; i++) {
    edges.push({
      id: `edge${i}`,
      source: `node${i}`,
      target: `node${i + 1}`
    });
  }
  
  return { nodes, edges };
};

describe('GridLayout', () => {
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
      layout = new GridLayout();
      
      expect(layout).toBeDefined();
      expect(layout.config.gridType).toBe('fixed');
      expect(layout.config.pattern).toBe('row-major');
      expect(layout.config.cellWidth).toBe(120);
      expect(layout.config.cellHeight).toBe(80);
      expect(layout.config.cellAlignment).toBe('center');
      expect(layout.gridDimensions).toEqual({ rows: 0, columns: 0 });
    });

    test('should accept custom configuration', () => {
      layout = new GridLayout({
        gridType: 'square',
        pattern: 'spiral',
        cellWidth: 150,
        cellHeight: 100,
        columns: 4,
        rows: 3,
        horizontalSpacing: 30,
        verticalSpacing: 25
      });

      expect(layout.config.gridType).toBe('square');
      expect(layout.config.pattern).toBe('spiral');
      expect(layout.config.cellWidth).toBe(150);
      expect(layout.config.cellHeight).toBe(100);
      expect(layout.config.columns).toBe(4);
      expect(layout.config.rows).toBe(3);
      expect(layout.config.horizontalSpacing).toBe(30);
      expect(layout.config.verticalSpacing).toBe(25);
    });

    test('should have correct metadata', () => {
      layout = new GridLayout();
      const metadata = layout.getMetadata();
      
      expect(metadata.name).toBe('grid-layout');
      expect(metadata.category).toBe('structured');
      expect(metadata.capabilities.responsive).toBe(true);
      expect(metadata.capabilities.grouping).toBe(true);
      expect(metadata.capabilities.sorting).toBe(true);
    });
  });

  describe('Grid Dimensions Calculation', () => {
    beforeEach(() => {
      layout = new GridLayout();
      await layout.initialize();
    });

    test('should calculate square grid dimensions', async () => {
      layout.config.gridType = 'square';
      
      const result = await layout.layout(graphData);
      
      // 9 nodes should create 3x3 grid
      expect(layout.gridDimensions.columns).toBe(3);
      expect(layout.gridDimensions.rows).toBe(3);
      expect(result.metadata.gridDimensions).toEqual({ columns: 3, rows: 3 });
    });

    test('should calculate fixed grid dimensions', async () => {
      layout.config.gridType = 'fixed';
      layout.config.columns = 4;
      layout.config.rows = 3;
      
      await layout.layout(graphData);
      
      expect(layout.gridDimensions.columns).toBe(4);
      expect(layout.gridDimensions.rows).toBe(3);
    });

    test('should calculate auto grid dimensions', async () => {
      layout.config.gridType = 'auto';
      layout.config.bounds = { width: 500, height: 400, padding: 50 };
      
      await layout.layout(graphData);
      
      expect(layout.gridDimensions.columns).toBeGreaterThan(0);
      expect(layout.gridDimensions.rows).toBeGreaterThan(0);
      expect(layout.gridDimensions.columns * layout.gridDimensions.rows).toBeGreaterThanOrEqual(9);
    });

    test('should handle rectangular grid with aspect ratio', async () => {
      layout.config.gridType = 'rectangular';
      layout.config.bounds = { width: 800, height: 400, padding: 50 };
      
      await layout.layout(graphData);
      
      // Should prefer wider layout due to aspect ratio
      expect(layout.gridDimensions.columns).toBeGreaterThanOrEqual(layout.gridDimensions.rows);
    });

    test('should handle single node', async () => {
      const singleNodeData = createSampleGraphData(1);
      
      await layout.layout(singleNodeData);
      
      expect(layout.gridDimensions.columns).toBe(1);
      expect(layout.gridDimensions.rows).toBe(1);
    });
  });

  describe('Node Positioning Patterns', () => {
    beforeEach(async () => {
      layout = new GridLayout({
        gridType: 'fixed',
        columns: 3,
        rows: 3,
        cellWidth: 100,
        cellHeight: 80,
        horizontalSpacing: 20,
        verticalSpacing: 15
      });
      await layout.initialize();
    });

    test('should position nodes in row-major order', async () => {
      layout.config.pattern = 'row-major';
      
      const result = await layout.layout(graphData);
      
      const node0Pos = result.positions.get('node0');
      const node1Pos = result.positions.get('node1');
      const node3Pos = result.positions.get('node3');
      
      // First row: node0, node1, node2
      // Second row: node3, ...
      expect(node1Pos.x).toBeGreaterThan(node0Pos.x); // node1 to right of node0
      expect(node3Pos.y).toBeGreaterThan(node0Pos.y); // node3 below node0
    });

    test('should position nodes in column-major order', async () => {
      layout.config.pattern = 'column-major';
      
      const result = await layout.layout(graphData);
      
      const node0Pos = result.positions.get('node0');
      const node1Pos = result.positions.get('node1');
      const node3Pos = result.positions.get('node3');
      
      // First column: node0, node1, node2
      // Second column: node3, ...
      expect(node1Pos.y).toBeGreaterThan(node0Pos.y); // node1 below node0
      expect(node3Pos.x).toBeGreaterThan(node0Pos.x); // node3 to right of node0
    });

    test('should position nodes in zigzag pattern', async () => {
      layout.config.pattern = 'zigzag';
      
      const result = await layout.layout(graphData);
      
      expect(result.positions.size).toBe(9);
      
      // Check that positions are valid
      result.positions.forEach(pos => {
        expect(pos.x).toBeGreaterThanOrEqual(0);
        expect(pos.y).toBeGreaterThanOrEqual(0);
        expect(pos.gridPosition).toBeDefined();
        expect(pos.gridPosition.row).toBeGreaterThanOrEqual(0);
        expect(pos.gridPosition.col).toBeGreaterThanOrEqual(0);
      });
    });

    test('should position nodes in spiral pattern', async () => {
      layout.config.pattern = 'spiral';
      
      const result = await layout.layout(graphData);
      
      expect(result.positions.size).toBe(9);
      
      // Verify spiral starts from outer edge
      const node0Pos = result.positions.get('node0');
      expect(node0Pos.gridPosition.row).toBe(0); // Should start at top
      expect(node0Pos.gridPosition.col).toBe(0); // Should start at left
    });
  });

  describe('Cell Position Calculation', () => {
    beforeEach(async () => {
      layout = new GridLayout({
        gridType: 'fixed',
        columns: 2,
        rows: 2,
        cellWidth: 100,
        cellHeight: 80,
        horizontalSpacing: 20,
        verticalSpacing: 15,
        bounds: { width: 500, height: 400, padding: 50 }
      });
      await layout.initialize();
    });

    test('should calculate cell positions with correct spacing', async () => {
      await layout.layout(graphData);
      
      const topLeft = layout.cellPositions.get('0,0');
      const topRight = layout.cellPositions.get('0,1');
      const bottomLeft = layout.cellPositions.get('1,0');
      
      expect(topLeft).toBeDefined();
      expect(topRight).toBeDefined();
      expect(bottomLeft).toBeDefined();
      
      // Check horizontal spacing
      const horizontalDistance = topRight.x - topLeft.x;
      expect(horizontalDistance).toBe(layout.config.cellWidth + layout.config.horizontalSpacing);
      
      // Check vertical spacing
      const verticalDistance = bottomLeft.y - topLeft.y;
      expect(verticalDistance).toBe(layout.config.cellHeight + layout.config.verticalSpacing);
    });

    test('should position grid based on start position', async () => {
      layout.config.startPosition = 'top-left';
      
      await layout.layout(graphData);
      
      const firstCell = layout.cellPositions.get('0,0');
      expect(firstCell.x).toBeGreaterThanOrEqual(layout.config.bounds.padding);
      expect(firstCell.y).toBeGreaterThanOrEqual(layout.config.bounds.padding);
    });

    test('should center grid when start position is center', async () => {
      layout.config.startPosition = 'center';
      
      await layout.layout(graphData);
      
      const bounds = layout.config.bounds;
      const gridInfo = layout.getGridInfo();
      
      expect(gridInfo.bounds.x).toBeGreaterThan(0);
      expect(gridInfo.bounds.y).toBeGreaterThan(0);
      expect(gridInfo.bounds.x + gridInfo.bounds.width).toBeLessThanOrEqual(bounds.width);
      expect(gridInfo.bounds.y + gridInfo.bounds.height).toBeLessThanOrEqual(bounds.height);
    });
  });

  describe('Node Preprocessing', () => {
    beforeEach(async () => {
      layout = new GridLayout();
      await layout.initialize();
    });

    test('should sort nodes when sortBy is specified', async () => {
      layout.config.sortBy = 'label';
      layout.config.sortOrder = 'asc';
      
      const result = await layout.layout(graphData);
      
      // Should position nodes in label order
      const positions = Array.from(result.positions.entries())
        .sort((a, b) => a[1].gridPosition.row * 3 + a[1].gridPosition.col - 
                      (b[1].gridPosition.row * 3 + b[1].gridPosition.col));
      
      expect(positions[0][0]).toBe('node0'); // Node 0 should be first alphabetically
    });

    test('should filter nodes when filterFn is specified', async () => {
      layout.config.filterFn = (node) => node.id.includes('0') || node.id.includes('1');
      
      const result = await layout.layout(graphData);
      
      // Should only have node0 and node1
      expect(result.positions.size).toBeLessThan(graphData.nodes.length);
      expect(result.positions.has('node0')).toBe(true);
      expect(result.positions.has('node1')).toBe(true);
    });

    test('should group nodes when groupBy is specified', async () => {
      layout.config.groupBy = 'type';
      
      await layout.layout(graphData);
      
      expect(layout.nodeGroups.size).toBeGreaterThan(0);
      expect(layout.nodeGroups.has('primary')).toBe(true);
      expect(layout.nodeGroups.has('secondary')).toBe(true);
    });
  });

  describe('Layout Results', () => {
    beforeEach(async () => {
      layout = new GridLayout({
        cellWidth: 100,
        cellHeight: 80
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

    test('should include grid metadata in results', async () => {
      const result = await layout.layout(graphData);
      
      expect(result.metadata.algorithm).toBe('grid');
      expect(result.metadata.gridDimensions).toBeDefined();
      expect(result.metadata.cellCount).toBeGreaterThan(0);
      expect(result.metadata.nodeCount).toBe(graphData.nodes.length);
      expect(result.metadata.executionTime).toBeGreaterThan(0);
      expect(result.metadata.config).toBeDefined();
    });

    test('should have grid position information in node positions', async () => {
      const result = await layout.layout(graphData);
      
      result.positions.forEach(position => {
        expect(position.x).toBeDefined();
        expect(position.y).toBeDefined();
        expect(position.gridPosition).toBeDefined();
        expect(position.gridPosition.row).toBeGreaterThanOrEqual(0);
        expect(position.gridPosition.col).toBeGreaterThanOrEqual(0);
      });
    });

    test('should calculate correct bounds', async () => {
      layout.config.cellWidth = 100;
      layout.config.cellHeight = 80;
      
      const result = await layout.layout(graphData);
      
      expect(result.bounds.x).toBeDefined();
      expect(result.bounds.y).toBeDefined();
      expect(result.bounds.width).toBeGreaterThan(0);
      expect(result.bounds.height).toBeGreaterThan(0);
    });
  });

  describe('Grid Information', () => {
    beforeEach(async () => {
      layout = new GridLayout({
        gridType: 'fixed',
        columns: 3,
        rows: 3,
        cellWidth: 120,
        cellHeight: 90
      });
      await layout.initialize();
    });

    test('should provide grid information', async () => {
      await layout.layout(graphData);
      
      const gridInfo = layout.getGridInfo();
      
      expect(gridInfo.dimensions).toEqual({ columns: 3, rows: 3 });
      expect(gridInfo.cellSize).toEqual({ width: 120, height: 90 });
      expect(gridInfo.cellCount).toBe(9);
      expect(gridInfo.pattern).toBe(layout.config.pattern);
      expect(gridInfo.bounds).toBeDefined();
    });
  });

  describe('Configuration Updates', () => {
    beforeEach(async () => {
      layout = new GridLayout();
      await layout.initialize();
    });

    test('should update configuration and clear caches', () => {
      // First layout to populate caches
      layout.cellPositions.set('test', { x: 0, y: 0 });
      layout.gridDimensions = { rows: 2, columns: 2 };
      
      layout.updateConfig({ cellWidth: 200 });
      
      expect(layout.config.cellWidth).toBe(200);
      expect(layout.cellPositions.size).toBe(0);
      expect(layout.gridDimensions).toEqual({ rows: 0, columns: 0 });
    });
  });

  describe('Edge Cases', () => {
    beforeEach(async () => {
      layout = new GridLayout();
      await layout.initialize();
    });

    test('should handle empty graph data', async () => {
      const emptyData = { nodes: [], edges: [] };
      
      const result = await layout.layout(emptyData);
      
      expect(result.positions.size).toBe(0);
      expect(result.bounds).toEqual({ x: 0, y: 0, width: 0, height: 0 });
    });

    test('should handle single node', async () => {
      const singleNodeData = createSampleGraphData(1);
      
      const result = await layout.layout(singleNodeData);
      
      expect(result.positions.size).toBe(1);
      expect(layout.gridDimensions).toEqual({ columns: 1, rows: 1 });
    });

    test('should handle very large number of nodes', async () => {
      const largeGraphData = createSampleGraphData(100);
      
      const result = await layout.layout(largeGraphData);
      
      expect(result.positions.size).toBe(100);
      expect(result.metadata.nodeCount).toBe(100);
      expect(layout.gridDimensions.columns * layout.gridDimensions.rows).toBeGreaterThanOrEqual(100);
    });

    test('should handle nodes without size information', async () => {
      const noSizeData = {
        nodes: [
          { id: 'node1', label: 'Node 1' },
          { id: 'node2', label: 'Node 2' }
        ],
        edges: []
      };
      
      const result = await layout.layout(noSizeData);
      
      expect(result.positions.size).toBe(2);
      expect(result.bounds.width).toBeGreaterThan(0);
    });
  });

  describe('Performance', () => {
    beforeEach(async () => {
      layout = new GridLayout();
      await layout.initialize();
    });

    test('should complete layout within reasonable time', async () => {
      const largeGraphData = createSampleGraphData(50);
      
      const startTime = Date.now();
      const result = await layout.layout(largeGraphData);
      const endTime = Date.now();
      
      expect(result.positions.size).toBe(50);
      expect(endTime - startTime).toBeLessThan(100); // Should complete within 100ms
    });

    test('should track execution time in metadata', async () => {
      performance.now.mockReturnValueOnce(1000).mockReturnValueOnce(1050);
      
      const result = await layout.layout(graphData);
      
      expect(result.metadata.executionTime).toBe(50);
    });
  });

  describe('Error Handling', () => {
    test('should handle invalid graph data', async () => {
      layout = new GridLayout();
      await layout.initialize();
      
      await expect(layout.layout(null)).rejects.toThrow();
    });

    test('should handle layout errors gracefully', async () => {
      layout = new GridLayout();
      await layout.initialize();
      
      // Force an error by corrupting internal state
      const originalCalculateGrid = layout._calculateGridDimensions;
      layout._calculateGridDimensions = () => {
        throw new Error('Calculation failed');
      };
      
      await expect(layout.layout(graphData)).rejects.toThrow('Calculation failed');
      
      // Restore method
      layout._calculateGridDimensions = originalCalculateGrid;
    });
  });
});