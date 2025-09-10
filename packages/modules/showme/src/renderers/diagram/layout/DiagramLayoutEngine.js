/**
 * DiagramLayoutEngine - Automatic layout computation for diagrams
 * 
 * Implements various layout algorithms for positioning nodes and edges
 * All layout computation happens on the frontend
 */

import { DagreLayoutAlgorithm } from './DagreLayoutAlgorithm.js';
import { LayoutConstraints } from './LayoutConstraints.js';

export class DiagramLayoutEngine {
  constructor(config = {}) {
    this.config = {
      algorithm: config.algorithm || 'dagre',
      direction: config.direction || 'TB', // TB, BT, LR, RL (for dagre: rankdir)
      spacing: {
        node: config.spacing?.node || 50,
        rank: config.spacing?.rank || 100
      },
      
      // Dagre-specific configuration
      dagre: {
        rankdir: config.direction || 'TB',
        align: config.align || 'UL',
        nodesep: config.spacing?.node || 50,
        edgesep: config.edgesep || 10,
        ranksep: config.spacing?.rank || 50,
        acyclicer: config.acyclicer || 'greedy',
        ranker: config.ranker || 'longest-path',
        marginx: config.marginx || 10,
        marginy: config.marginy || 10,
        debugTiming: config.debugTiming || false
      },
      
      // Constraint configuration
      constraints: {
        enforceConstraints: config.constraints?.enforceConstraints !== false,
        allowPartialViolations: config.constraints?.allowPartialViolations || false,
        constraintPriority: config.constraints?.constraintPriority || 'high',
        maxIterations: config.constraints?.maxIterations || 10,
        tolerance: config.constraints?.tolerance || 1.0,
        ...config.constraints
      },
      
      ...config
    };
    
    // Layout algorithm instances
    this.algorithms = new Map();
    
    // Layout constraints manager
    this.constraints = new LayoutConstraints(this.config.constraints);
    
    // Initialize the appropriate layout algorithm
    this._initializeAlgorithm();
  }

  /**
   * Initialize the layout algorithm
   * @private
   */
  _initializeAlgorithm() {
    if (this.config.algorithm === 'dagre') {
      this.algorithms.set('dagre', new DagreLayoutAlgorithm(this.config.dagre));
    }
    
    // Legacy fallback for simple hierarchical layout
    this.algorithms.set('hierarchical', {
      layout: (graphData) => this._computeHierarchicalLayout(graphData)
    });
  }

  /**
   * Compute layout for the given graph data
   * @param {Object} graphData - { nodes, edges }
   * @returns {Object} Layout result with positions and bounds
   */
  compute(graphData) {
    if (!graphData || !graphData.nodes) {
      throw new Error('Invalid graph data');
    }
    
    // Convert Map-based data to array-based for algorithms
    const normalizedData = this._normalizeGraphData(graphData);
    
    // Handle empty graph
    if (normalizedData.nodes.length === 0) {
      return { 
        positions: new Map(), 
        bounds: { x: 0, y: 0, width: 0, height: 0 },
        edges: new Map()
      };
    }
    
    // Handle single node
    if (normalizedData.nodes.length === 1) {
      const node = normalizedData.nodes[0];
      const positions = new Map();
      positions.set(node.id, { x: 0, y: 0 });
      
      return {
        positions,
        bounds: {
          x: 0,
          y: 0,
          width: node.size?.width || 100,
          height: node.size?.height || 60
        },
        edges: new Map()
      };
    }
    
    // Get the appropriate algorithm
    const algorithm = this.algorithms.get(this.config.algorithm);
    
    if (!algorithm) {
      throw new Error(`Unknown layout algorithm: ${this.config.algorithm}`);
    }
    
    // Run the layout algorithm
    try {
      const result = algorithm.layout(normalizedData);
      
      // Apply constraints to the layout result
      const constrainedResult = this.constraints.applyConstraints(result, normalizedData);
      
      // Ensure result has expected structure
      return {
        positions: constrainedResult.positions || new Map(),
        bounds: constrainedResult.bounds || { x: 0, y: 0, width: 0, height: 0 },
        edges: constrainedResult.edges || new Map(),
        metadata: constrainedResult.metadata || {}
      };
      
    } catch (error) {
      console.error('Layout computation failed:', error);
      
      // Fallback to hierarchical layout
      return this._computeHierarchicalLayout(normalizedData);
    }
  }

  /**
   * Normalize graph data from various input formats
   * @private
   */
  _normalizeGraphData(graphData) {
    const nodes = [];
    const edges = [];
    
    // Handle nodes (support both Map and Array formats)
    if (graphData.nodes instanceof Map) {
      graphData.nodes.forEach(node => nodes.push(node));
    } else if (Array.isArray(graphData.nodes)) {
      nodes.push(...graphData.nodes);
    } else {
      throw new Error('Invalid nodes data format');
    }
    
    // Handle edges (support both Map and Array formats)
    if (graphData.edges instanceof Map) {
      graphData.edges.forEach(edge => edges.push(edge));
    } else if (Array.isArray(graphData.edges)) {
      edges.push(...graphData.edges);
    }
    
    return { nodes, edges };
  }

  /**
   * Fallback hierarchical layout computation
   * @private
   */
  _computeHierarchicalLayout(graphData) {
    const positions = new Map();
    let bounds = { x: 0, y: 0, width: 0, height: 0 };
    
    // Build adjacency information
    const adjacency = this._buildAdjacency(graphData);
    
    // Compute node levels (for hierarchical layout)
    const levels = this._computeLevels(graphData.nodes, adjacency);
    
    // Position nodes based on levels
    this._positionNodes(graphData.nodes, levels, positions);
    
    // Calculate bounds
    bounds = this._calculateBounds(graphData.nodes, positions);
    
    return { positions, bounds, edges: new Map() };
  }

  /**
   * Build adjacency information from edges
   * @private
   */
  _buildAdjacency(graphData) {
    const adjacency = new Map();
    
    // Initialize adjacency lists
    graphData.nodes.forEach(node => {
      adjacency.set(node.id, {
        incoming: [],
        outgoing: []
      });
    });
    
    // Build adjacency from edges
    if (graphData.edges) {
      graphData.edges.forEach(edge => {
        const sourceAdj = adjacency.get(edge.source);
        const targetAdj = adjacency.get(edge.target);
        
        if (sourceAdj && targetAdj) {
          sourceAdj.outgoing.push(edge.target);
          targetAdj.incoming.push(edge.source);
        }
      });
    }
    
    return adjacency;
  }

  /**
   * Compute node levels for hierarchical layout
   * @private
   */
  _computeLevels(nodes, adjacency) {
    const levels = new Map();
    const visited = new Set();
    
    // Find root nodes (no incoming edges)
    const roots = nodes.filter(node => {
      const adj = adjacency.get(node.id);
      return adj && adj.incoming.length === 0;
    });
    
    // If no roots (cycle), start with first node
    if (roots.length === 0 && nodes.length > 0) {
      roots.push(nodes[0]);
    }
    
    // BFS to assign levels
    const queue = roots.map(node => ({ node, level: 0 }));
    
    while (queue.length > 0) {
      const { node, level } = queue.shift();
      
      if (visited.has(node.id)) continue;
      visited.add(node.id);
      
      // Assign level
      if (!levels.has(level)) {
        levels.set(level, []);
      }
      levels.get(level).push(node);
      
      // Add children to queue
      const adj = adjacency.get(node.id);
      if (adj) {
        adj.outgoing.forEach(targetId => {
          if (!visited.has(targetId)) {
            const targetNode = nodes.find(n => n.id === targetId);
            if (targetNode) {
              queue.push({ node: targetNode, level: level + 1 });
            }
          }
        });
      }
    }
    
    // Handle disconnected nodes
    nodes.forEach(node => {
      if (!visited.has(node.id)) {
        const level = levels.size;
        if (!levels.has(level)) {
          levels.set(level, []);
        }
        levels.get(level).push(node);
      }
    });
    
    return levels;
  }

  /**
   * Position nodes based on levels
   * @private
   */
  _positionNodes(nodes, levels, positions) {
    const direction = this.config.direction;
    const nodeSpacing = this.config.spacing.node;
    const rankSpacing = this.config.spacing.rank;
    
    let currentRankPosition = 0;
    
    // Process each level
    levels.forEach((levelNodes, levelIndex) => {
      let currentNodePosition = 0;
      const levelWidth = this._calculateLevelWidth(levelNodes, nodeSpacing);
      
      // Center the level
      const startPosition = -levelWidth / 2;
      currentNodePosition = startPosition;
      
      levelNodes.forEach(node => {
        let x = 0, y = 0;
        
        switch (direction) {
          case 'TB': // Top to Bottom
            x = currentNodePosition + node.size.width / 2;
            y = currentRankPosition;
            break;
            
          case 'BT': // Bottom to Top
            x = currentNodePosition + node.size.width / 2;
            y = -currentRankPosition;
            break;
            
          case 'LR': // Left to Right
            x = currentRankPosition;
            y = currentNodePosition + node.size.height / 2;
            break;
            
          case 'RL': // Right to Left
            x = -currentRankPosition;
            y = currentNodePosition + node.size.height / 2;
            break;
        }
        
        positions.set(node.id, { x, y });
        
        // Move to next node position
        if (direction === 'TB' || direction === 'BT') {
          currentNodePosition += node.size.width + nodeSpacing;
        } else {
          currentNodePosition += node.size.height + nodeSpacing;
        }
      });
      
      // Move to next rank
      if (direction === 'TB' || direction === 'BT') {
        const maxHeight = Math.max(...levelNodes.map(n => n.size.height));
        currentRankPosition += maxHeight + rankSpacing;
      } else {
        const maxWidth = Math.max(...levelNodes.map(n => n.size.width));
        currentRankPosition += maxWidth + rankSpacing;
      }
    });
    
    // Normalize positions (ensure all are positive)
    this._normalizePositions(positions);
  }

  /**
   * Calculate width of a level
   * @private
   */
  _calculateLevelWidth(nodes, spacing) {
    const totalNodeWidth = nodes.reduce((sum, node) => {
      return sum + (this.config.direction === 'TB' || this.config.direction === 'BT' 
        ? node.size.width 
        : node.size.height);
    }, 0);
    
    const totalSpacing = spacing * (nodes.length - 1);
    return totalNodeWidth + totalSpacing;
  }

  /**
   * Normalize positions to ensure all are positive
   * @private
   */
  _normalizePositions(positions) {
    if (positions.size === 0) return;
    
    let minX = Infinity, minY = Infinity;
    
    // Find minimum positions
    positions.forEach(pos => {
      minX = Math.min(minX, pos.x);
      minY = Math.min(minY, pos.y);
    });
    
    // Shift all positions to be positive
    positions.forEach((pos, nodeId) => {
      positions.set(nodeId, {
        x: pos.x - minX,
        y: pos.y - minY
      });
    });
  }

  /**
   * Calculate bounds of the layout
   * @private
   */
  _calculateBounds(nodes, positions) {
    if (nodes.length === 0) {
      return { x: 0, y: 0, width: 0, height: 0 };
    }
    
    let minX = Infinity, minY = Infinity;
    let maxX = -Infinity, maxY = -Infinity;
    
    nodes.forEach(node => {
      const pos = positions.get(node.id);
      if (pos) {
        minX = Math.min(minX, pos.x);
        minY = Math.min(minY, pos.y);
        maxX = Math.max(maxX, pos.x + node.size.width);
        maxY = Math.max(maxY, pos.y + node.size.height);
      }
    });
    
    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY
    };
  }

  /**
   * Destroy the layout engine
   */
  destroy() {
    this.config = null;
    this.graphLib = null;
  }
}