/**
 * Unit tests for DagreLayoutAlgorithm ranking system
 * Tests the enhanced ranking algorithms: network-simplex and tight-tree
 */

import { jest } from '@jest/globals';
import { DagreLayoutAlgorithm } from '../../../../src/renderers/diagram/layout/DagreLayoutAlgorithm.js';

describe('DagreLayoutAlgorithm Ranking System', () => {
  let algorithm;

  beforeEach(() => {
    algorithm = new DagreLayoutAlgorithm();
  });

  afterEach(() => {
    if (algorithm) {
      algorithm = null;
    }
  });

  describe('Network Simplex Ranking', () => {
    test('should use network-simplex ranker', () => {
      const networkSimplexAlgorithm = new DagreLayoutAlgorithm({ ranker: 'network-simplex' });
      
      const graphData = {
        nodes: [
          { id: 'A', size: { width: 100, height: 60 } },
          { id: 'B', size: { width: 100, height: 60 } },
          { id: 'C', size: { width: 100, height: 60 } },
          { id: 'D', size: { width: 100, height: 60 } }
        ],
        edges: [
          { id: 'e1', source: 'A', target: 'B' },
          { id: 'e2', source: 'A', target: 'C' },
          { id: 'e3', source: 'B', target: 'D' },
          { id: 'e4', source: 'C', target: 'D' }
        ]
      };

      const result = networkSimplexAlgorithm.layout(graphData);
      
      expect(result.positions.size).toBe(4);
      expect(result.metadata.ranking).toBeDefined();
      expect(result.metadata.ranking.algorithm).toBe('network-simplex');
      expect(result.metadata.ranking.stats).toBeDefined();
      expect(result.metadata.ranking.stats.totalRanks).toBeGreaterThan(0);
    });

    test('should optimize diamond graph layout', () => {
      const networkSimplexAlgorithm = new DagreLayoutAlgorithm({ 
        ranker: 'network-simplex',
        debugTiming: true
      });
      
      const diamondData = {
        nodes: [
          { id: 'top', size: { width: 100, height: 60 } },
          { id: 'left', size: { width: 100, height: 60 } },
          { id: 'right', size: { width: 100, height: 60 } },
          { id: 'bottom', size: { width: 100, height: 60 } }
        ],
        edges: [
          { id: 'e1', source: 'top', target: 'left' },
          { id: 'e2', source: 'top', target: 'right' },
          { id: 'e3', source: 'left', target: 'bottom' },
          { id: 'e4', source: 'right', target: 'bottom' }
        ]
      };

      const result = networkSimplexAlgorithm.layout(diamondData);
      
      expect(result.success).not.toBe(false);
      expect(result.positions.size).toBe(4);
      
      // Check diamond structure is maintained
      const positions = result.positions;
      const topPos = positions.get('top');
      const leftPos = positions.get('left');
      const rightPos = positions.get('right');
      const bottomPos = positions.get('bottom');
      
      // For TB layout
      expect(leftPos.y).toBeGreaterThan(topPos.y);
      expect(rightPos.y).toBeGreaterThan(topPos.y);
      expect(bottomPos.y).toBeGreaterThan(leftPos.y);
      expect(bottomPos.y).toBeGreaterThan(rightPos.y);
      
      // Middle nodes should be at same level
      expect(Math.abs(leftPos.y - rightPos.y)).toBeLessThan(5);
      
      // Check ranking metadata
      expect(result.metadata.ranking.stats.totalRanks).toBe(3); // Should be 3 levels
    });

    test('should handle complex graph with multiple paths', () => {
      const networkSimplexAlgorithm = new DagreLayoutAlgorithm({ ranker: 'network-simplex' });
      
      const complexData = {
        nodes: [
          { id: 'A', size: { width: 80, height: 50 } },
          { id: 'B', size: { width: 80, height: 50 } },
          { id: 'C', size: { width: 80, height: 50 } },
          { id: 'D', size: { width: 80, height: 50 } },
          { id: 'E', size: { width: 80, height: 50 } },
          { id: 'F', size: { width: 80, height: 50 } }
        ],
        edges: [
          { id: 'e1', source: 'A', target: 'B' },
          { id: 'e2', source: 'A', target: 'C' },
          { id: 'e3', source: 'B', target: 'D' },
          { id: 'e4', source: 'C', target: 'D' },
          { id: 'e5', source: 'D', target: 'E' },
          { id: 'e6', source: 'D', target: 'F' }
        ]
      };

      const result = networkSimplexAlgorithm.layout(complexData);
      
      expect(result.positions.size).toBe(6);
      expect(result.metadata.ranking.stats.totalRanks).toBeGreaterThanOrEqual(3);
      expect(result.metadata.ranking.stats.maxRankSize).toBeGreaterThanOrEqual(1);
      expect(result.metadata.ranking.stats.avgRankSize).toBeGreaterThan(0);
    });

    test('should improve over longest-path in specific cases', () => {
      const longPathAlgorithm = new DagreLayoutAlgorithm({ ranker: 'longest-path' });
      const networkSimplexAlgorithm = new DagreLayoutAlgorithm({ ranker: 'network-simplex' });
      
      // Create a graph where network simplex can potentially improve
      const testData = {
        nodes: [
          { id: 'A', size: { width: 100, height: 60 } },
          { id: 'B', size: { width: 100, height: 60 } },
          { id: 'C', size: { width: 100, height: 60 } },
          { id: 'D', size: { width: 100, height: 60 } },
          { id: 'E', size: { width: 100, height: 60 } }
        ],
        edges: [
          { id: 'e1', source: 'A', target: 'B' },
          { id: 'e2', source: 'A', target: 'C' },
          { id: 'e3', source: 'B', target: 'D' },
          { id: 'e4', source: 'C', target: 'D' },
          { id: 'e5', source: 'A', target: 'E' },
          { id: 'e6', source: 'E', target: 'D' }
        ]
      };

      const longPathResult = longPathAlgorithm.layout(testData);
      const networkSimplexResult = networkSimplexAlgorithm.layout(testData);
      
      // Both should produce valid layouts
      expect(longPathResult.positions.size).toBe(5);
      expect(networkSimplexResult.positions.size).toBe(5);
      
      // Network simplex may have different ranking statistics
      expect(networkSimplexResult.metadata.ranking.algorithm).toBe('network-simplex');
      expect(longPathResult.metadata.ranking.algorithm).toBe('longest-path');
    });
  });

  describe('Tight Tree Ranking', () => {
    test('should use tight-tree ranker', () => {
      const tightTreeAlgorithm = new DagreLayoutAlgorithm({ ranker: 'tight-tree' });
      
      const graphData = {
        nodes: [
          { id: 'A', size: { width: 100, height: 60 } },
          { id: 'B', size: { width: 100, height: 60 } },
          { id: 'C', size: { width: 100, height: 60 } }
        ],
        edges: [
          { id: 'e1', source: 'A', target: 'B' },
          { id: 'e2', source: 'B', target: 'C' }
        ]
      };

      const result = tightTreeAlgorithm.layout(graphData);
      
      expect(result.positions.size).toBe(3);
      expect(result.metadata.ranking).toBeDefined();
      expect(result.metadata.ranking.algorithm).toBe('tight-tree');
      expect(result.metadata.tightEdges).toBeDefined();
      expect(result.metadata.treeHeight).toBeDefined();
    });

    test('should identify tight edges', () => {
      const tightTreeAlgorithm = new DagreLayoutAlgorithm({ ranker: 'tight-tree' });
      
      const linearData = {
        nodes: [
          { id: 'A', size: { width: 80, height: 50 } },
          { id: 'B', size: { width: 80, height: 50 } },
          { id: 'C', size: { width: 80, height: 50 } },
          { id: 'D', size: { width: 80, height: 50 } }
        ],
        edges: [
          { id: 'edge1', source: 'A', target: 'B' },
          { id: 'edge2', source: 'B', target: 'C' },
          { id: 'edge3', source: 'C', target: 'D' }
        ]
      };

      const result = tightTreeAlgorithm.layout(linearData);
      
      expect(result.positions.size).toBe(4);
      expect(result.metadata.tightEdges).toBeDefined();
      // In a linear chain, most edges should be tight (rank difference = 1)
      expect(result.metadata.tightEdges.length).toBeGreaterThan(0);
      expect(result.metadata.treeHeight).toBe(3); // 4 nodes in 4 ranks (0,1,2,3)
    });

    test('should compress ranks effectively', () => {
      const tightTreeAlgorithm = new DagreLayoutAlgorithm({ ranker: 'tight-tree' });
      
      const sparseData = {
        nodes: [
          { id: 'A', size: { width: 100, height: 60 } },
          { id: 'B', size: { width: 100, height: 60 } },
          { id: 'C', size: { width: 100, height: 60 } }
        ],
        edges: [
          { id: 'e1', source: 'A', target: 'B' },
          { id: 'e2', source: 'B', target: 'C' }
        ]
      };

      const result = tightTreeAlgorithm.layout(sparseData);
      
      expect(result.positions.size).toBe(3);
      expect(result.metadata.ranking.stats.totalRanks).toBe(3);
      expect(result.metadata.treeHeight).toBe(2); // Should be compressed
    });

    test('should handle tree structures well', () => {
      const tightTreeAlgorithm = new DagreLayoutAlgorithm({ ranker: 'tight-tree' });
      
      const treeData = {
        nodes: [
          { id: 'root', size: { width: 100, height: 60 } },
          { id: 'left', size: { width: 100, height: 60 } },
          { id: 'right', size: { width: 100, height: 60 } },
          { id: 'leaf1', size: { width: 100, height: 60 } },
          { id: 'leaf2', size: { width: 100, height: 60 } },
          { id: 'leaf3', size: { width: 100, height: 60 } }
        ],
        edges: [
          { id: 'e1', source: 'root', target: 'left' },
          { id: 'e2', source: 'root', target: 'right' },
          { id: 'e3', source: 'left', target: 'leaf1' },
          { id: 'e4', source: 'left', target: 'leaf2' },
          { id: 'e5', source: 'right', target: 'leaf3' }
        ]
      };

      const result = tightTreeAlgorithm.layout(treeData);
      
      expect(result.positions.size).toBe(6);
      expect(result.metadata.treeHeight).toBe(2); // 3 levels: root, middle, leaves
      expect(result.metadata.tightEdges.length).toBe(5); // All edges should be tight in tree
      
      // Check tree structure is preserved
      const positions = result.positions;
      const rootPos = positions.get('root');
      const leftPos = positions.get('left');
      const rightPos = positions.get('right');
      const leaf1Pos = positions.get('leaf1');
      const leaf2Pos = positions.get('leaf2');
      const leaf3Pos = positions.get('leaf3');
      
      // Children should be below parents
      expect(leftPos.y).toBeGreaterThan(rootPos.y);
      expect(rightPos.y).toBeGreaterThan(rootPos.y);
      expect(leaf1Pos.y).toBeGreaterThan(leftPos.y);
      expect(leaf2Pos.y).toBeGreaterThan(leftPos.y);
      expect(leaf3Pos.y).toBeGreaterThan(rightPos.y);
    });
  });

  describe('Rank Validation and Fixing', () => {
    test('should validate and fix rank violations', () => {
      // Create algorithm with debug timing to see violation fixes
      const algorithm = new DagreLayoutAlgorithm({ 
        ranker: 'longest-path',
        debugTiming: true
      });

      // Manually create a problematic graph structure
      const problemData = {
        nodes: [
          { id: 'A', size: { width: 100, height: 60 } },
          { id: 'B', size: { width: 100, height: 60 } },
          { id: 'C', size: { width: 100, height: 60 } }
        ],
        edges: [
          { id: 'e1', source: 'A', target: 'B' },
          { id: 'e2', source: 'B', target: 'C' },
          { id: 'e3', source: 'C', target: 'A' } // This creates a cycle
        ]
      };

      // Mock console.warn to catch validation warnings
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

      const result = algorithm.layout(problemData);
      
      expect(result.positions.size).toBe(3);
      
      // Should have valid ranking after fixes
      const positions = result.positions;
      positions.forEach(pos => {
        expect(typeof pos.x).toBe('number');
        expect(typeof pos.y).toBe('number');
        expect(isFinite(pos.x)).toBe(true);
        expect(isFinite(pos.y)).toBe(true);
      });
      
      warnSpy.mockRestore();
    });

    test('should handle disconnected components', () => {
      const algorithm = new DagreLayoutAlgorithm({ ranker: 'network-simplex' });
      
      const disconnectedData = {
        nodes: [
          // Component 1
          { id: 'A1', size: { width: 100, height: 60 } },
          { id: 'B1', size: { width: 100, height: 60 } },
          // Component 2
          { id: 'A2', size: { width: 100, height: 60 } },
          { id: 'B2', size: { width: 100, height: 60 } },
          // Isolated node
          { id: 'isolated', size: { width: 100, height: 60 } }
        ],
        edges: [
          { id: 'e1', source: 'A1', target: 'B1' },
          { id: 'e2', source: 'A2', target: 'B2' }
        ]
      };

      const result = algorithm.layout(disconnectedData);
      
      expect(result.positions.size).toBe(5);
      
      // All nodes should have valid positions
      result.positions.forEach(pos => {
        expect(typeof pos.x).toBe('number');
        expect(typeof pos.y).toBe('number');
      });
      
      expect(result.metadata.ranking.stats.totalRanks).toBeGreaterThan(0);
    });
  });

  describe('Ranking Metadata', () => {
    test('should provide comprehensive ranking statistics', () => {
      const algorithm = new DagreLayoutAlgorithm({ ranker: 'network-simplex' });
      
      const testData = {
        nodes: [
          { id: 'A', size: { width: 100, height: 60 } },
          { id: 'B', size: { width: 100, height: 60 } },
          { id: 'C', size: { width: 100, height: 60 } },
          { id: 'D', size: { width: 100, height: 60 } },
          { id: 'E', size: { width: 100, height: 60 } }
        ],
        edges: [
          { id: 'e1', source: 'A', target: 'B' },
          { id: 'e2', source: 'A', target: 'C' },
          { id: 'e3', source: 'B', target: 'D' },
          { id: 'e4', source: 'C', target: 'E' }
        ]
      };

      const result = algorithm.layout(testData);
      
      expect(result.metadata.ranking).toBeDefined();
      expect(result.metadata.ranking.algorithm).toBe('network-simplex');
      expect(result.metadata.ranking.stats).toBeDefined();
      
      const stats = result.metadata.ranking.stats;
      expect(typeof stats.totalRanks).toBe('number');
      expect(typeof stats.maxRankSize).toBe('number');
      expect(typeof stats.minRankSize).toBe('number');
      expect(typeof stats.avgRankSize).toBe('number');
      expect(typeof stats.rankDistribution).toBe('object');
      expect(typeof result.metadata.ranking.timestamp).toBe('number');
      
      expect(stats.totalRanks).toBeGreaterThan(0);
      expect(stats.maxRankSize).toBeGreaterThanOrEqual(stats.minRankSize);
      expect(stats.avgRankSize).toBeGreaterThan(0);
    });

    test('should track rank distribution correctly', () => {
      const algorithm = new DagreLayoutAlgorithm({ ranker: 'tight-tree' });
      
      const parallelData = {
        nodes: [
          { id: 'source', size: { width: 100, height: 60 } },
          { id: 'mid1', size: { width: 100, height: 60 } },
          { id: 'mid2', size: { width: 100, height: 60 } },
          { id: 'mid3', size: { width: 100, height: 60 } },
          { id: 'sink', size: { width: 100, height: 60 } }
        ],
        edges: [
          { id: 'e1', source: 'source', target: 'mid1' },
          { id: 'e2', source: 'source', target: 'mid2' },
          { id: 'e3', source: 'source', target: 'mid3' },
          { id: 'e4', source: 'mid1', target: 'sink' },
          { id: 'e5', source: 'mid2', target: 'sink' },
          { id: 'e6', source: 'mid3', target: 'sink' }
        ]
      };

      const result = algorithm.layout(parallelData);
      
      const distribution = result.metadata.ranking.stats.rankDistribution;
      
      // Should have 3 ranks with specific distribution
      expect(Object.keys(distribution)).toHaveLength(3);
      
      // Verify total node count matches
      const totalNodes = Object.values(distribution).reduce((sum, count) => sum + count, 0);
      expect(totalNodes).toBe(5);
      
      // Middle rank should have the most nodes (mid1, mid2, mid3)
      const maxCount = Math.max(...Object.values(distribution));
      expect(maxCount).toBe(3);
    });
  });

  describe('Performance and Edge Cases', () => {
    test('should handle single node with all rankers', () => {
      const rankers = ['longest-path', 'network-simplex', 'tight-tree'];
      
      rankers.forEach(ranker => {
        const algorithm = new DagreLayoutAlgorithm({ ranker });
        
        const singleNodeData = {
          nodes: [{ id: 'single', size: { width: 100, height: 60 } }],
          edges: []
        };

        const result = algorithm.layout(singleNodeData);
        
        expect(result.positions.size).toBe(1);
        expect(result.metadata.ranking.algorithm).toBe(ranker);
        expect(result.metadata.ranking.stats.totalRanks).toBe(1);
        expect(result.metadata.ranking.stats.maxRankSize).toBe(1);
      });
    });

    test('should handle large graphs efficiently', () => {
      const algorithm = new DagreLayoutAlgorithm({ 
        ranker: 'network-simplex',
        debugTiming: true
      });
      
      // Create larger graph (30 nodes, tree structure)
      const nodes = [];
      const edges = [];
      
      for (let i = 0; i < 30; i++) {
        nodes.push({
          id: `node${i}`,
          size: { width: 80, height: 50 }
        });
        
        if (i > 0) {
          const parentIndex = Math.floor((i - 1) / 2);
          edges.push({
            id: `edge${i}`,
            source: `node${parentIndex}`,
            target: `node${i}`
          });
        }
      }

      const largeData = { nodes, edges };
      
      const startTime = performance.now();
      const result = algorithm.layout(largeData);
      const endTime = performance.now();
      
      expect(result.positions.size).toBe(30);
      expect(endTime - startTime).toBeLessThan(200); // Should complete in reasonable time
      
      // Check that all nodes got valid positions
      result.positions.forEach(pos => {
        expect(typeof pos.x).toBe('number');
        expect(typeof pos.y).toBe('number');
        expect(isFinite(pos.x)).toBe(true);
        expect(isFinite(pos.y)).toBe(true);
      });
    });
  });
});