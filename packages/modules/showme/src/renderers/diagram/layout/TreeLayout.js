/**
 * TreeLayout - Hierarchical tree-based graph layout algorithm
 * 
 * Implements multiple tree layout strategies:
 * - Standard tree layout with configurable directions
 * - Compact tree layout to minimize space
 * - Radial tree layout for circular arrangements
 * 
 * Supports forests (multiple disconnected trees) and various alignment options.
 */

export class TreeLayout {
  constructor(config = {}) {
    this.config = {
      // Layout direction
      direction: config.direction || 'vertical', // vertical, horizontal
      orientation: config.orientation || 'top-down', // top-down, bottom-up, left-to-right, right-to-left
      
      // Spacing configuration
      levelSeparation: config.levelSeparation || 100, // Distance between levels
      nodeSeparation: config.nodeSeparation || 50, // Minimum distance between nodes at same level
      subtreeSeparation: config.subtreeSeparation || 80, // Distance between subtrees
      
      // Tree type
      treeType: config.treeType || 'standard', // standard, compact, radial
      
      // Alignment
      alignment: config.alignment || 'center', // center, left, right
      
      // Bounds
      bounds: {
        width: config.bounds?.width || 1000,
        height: config.bounds?.height || 600,
        padding: config.bounds?.padding || 50
      },
      
      // Performance options
      sortChildren: config.sortChildren !== false, // Sort children for consistent layout
      balanceTree: config.balanceTree !== false, // Balance tree for better aesthetics
      
      ...config
    };
    
    // Layout state
    this.nodes = new Map();
    this.edges = new Map();
    this.roots = [];
    this.levels = new Map(); // Map of node level in tree
    this.positions = new Map();
    this.forest = []; // Array of tree roots for forest handling
    
    // Timing information
    this.timing = {
      startTime: 0,
      endTime: 0,
      phases: {}
    };
    
    // Tree statistics
    this.treeStats = {
      depth: 0,
      width: 0,
      nodeCount: 0
    };
  }

  /**
   * Layout the graph using tree algorithm
   * @param {Object} graphData - Graph data with nodes and edges
   * @returns {Object} Layout result with positions and metadata
   */
  layout(graphData) {
    this.timing.startTime = performance.now();
    
    try {
      // Initialize tree structure
      this._initializeTree(graphData);
      
      // Build tree hierarchy
      this._buildTreeHierarchy();
      
      // Calculate positions based on tree type
      if (this.config.treeType === 'radial') {
        this._layoutRadialTree();
      } else if (this.config.treeType === 'compact') {
        this._layoutCompactTree();
      } else {
        this._layoutStandardTree();
      }
      
      // Apply alignment
      this._applyAlignment();
      
      // Extract results
      const result = this._extractResults();
      
      this.timing.endTime = performance.now();
      result.metadata.timing = {
        total: this.timing.endTime - this.timing.startTime,
        phases: this.timing.phases
      };
      
      return result;
      
    } catch (error) {
      console.error('Tree layout failed:', error);
      return this._fallbackLayout(graphData);
    }
  }

  /**
   * Initialize tree structure from graph data
   * @private
   */
  _initializeTree(graphData) {
    const phaseStart = performance.now();
    
    // Clear previous state
    this.nodes.clear();
    this.edges.clear();
    this.roots = [];
    this.levels.clear();
    this.positions.clear();
    this.forest = [];
    
    // Create node map
    graphData.nodes.forEach(node => {
      this.nodes.set(node.id, {
        id: node.id,
        data: node,
        size: node.size || { width: 100, height: 60 },
        children: [],
        parent: null,
        level: -1,
        x: 0,
        y: 0,
        modifier: 0,
        thread: null,
        ancestor: null
      });
    });
    
    // Process edges to build parent-child relationships
    if (graphData.edges) {
      const hasCycles = this._detectCycles(graphData.edges);
      
      graphData.edges.forEach(edge => {
        const source = this.nodes.get(edge.source);
        const target = this.nodes.get(edge.target);
        
        if (source && target) {
          // For tree layout, edge direction matters
          // source is parent, target is child
          if (!hasCycles || !this._wouldCreateCycle(source, target)) {
            source.children.push(target);
            target.parent = source;
            
            this.edges.set(edge.id, {
              id: edge.id,
              source: edge.source,
              target: edge.target,
              data: edge
            });
          }
        }
      });
      
      this.treeStats.hasCycles = hasCycles;
    }
    
    // Identify root nodes (nodes with no parent)
    this.nodes.forEach(node => {
      if (!node.parent) {
        this.roots.push(node);
        this.forest.push(node);
      }
    });
    
    // Sort children if configured
    if (this.config.sortChildren) {
      this.nodes.forEach(node => {
        node.children.sort((a, b) => a.id.localeCompare(b.id));
      });
    }
    
    this.timing.phases.initialization = performance.now() - phaseStart;
  }

  /**
   * Build tree hierarchy and calculate levels
   * @private
   */
  _buildTreeHierarchy() {
    const phaseStart = performance.now();
    
    let maxDepth = 0;
    let maxWidth = 0;
    const levelCounts = new Map();
    
    // BFS to assign levels
    this.forest.forEach(root => {
      const queue = [{ node: root, level: 0 }];
      
      while (queue.length > 0) {
        const { node, level } = queue.shift();
        
        node.level = level;
        maxDepth = Math.max(maxDepth, level);
        
        // Track nodes per level
        const count = levelCounts.get(level) || 0;
        levelCounts.set(level, count + 1);
        
        // Process children
        node.children.forEach(child => {
          queue.push({ node: child, level: level + 1 });
        });
      }
    });
    
    // Calculate max width
    levelCounts.forEach(count => {
      maxWidth = Math.max(maxWidth, count);
    });
    
    this.treeStats.depth = maxDepth;
    this.treeStats.width = maxWidth;
    this.treeStats.nodeCount = this.nodes.size;
    
    this.timing.phases.hierarchy = performance.now() - phaseStart;
  }

  /**
   * Layout tree using standard algorithm
   * @private
   */
  _layoutStandardTree() {
    const phaseStart = performance.now();
    
    let currentX = 0;
    
    // Layout each tree in the forest
    this.forest.forEach(root => {
      // Use Walker's algorithm for tree layout
      this._initializeNode(root);
      this._firstWalk(root, 0);
      this._secondWalk(root, -root.modifier, currentX);
      
      // Calculate tree bounds for forest spacing
      const treeBounds = this._getTreeBounds(root);
      currentX = treeBounds.maxX + this.config.subtreeSeparation + 50; // Add extra space for forest separation
    });
    
    this.timing.phases.layout = performance.now() - phaseStart;
  }

  /**
   * Layout tree using compact algorithm
   * @private
   */
  _layoutCompactTree() {
    const phaseStart = performance.now();
    
    // Compact layout uses tighter spacing
    const originalNodeSep = this.config.nodeSeparation;
    const originalSubtreeSep = this.config.subtreeSeparation;
    
    this.config.nodeSeparation *= 0.6;
    this.config.subtreeSeparation *= 0.7;
    
    // Use standard layout with compact spacing
    this._layoutStandardTree();
    
    // Restore original spacing
    this.config.nodeSeparation = originalNodeSep;
    this.config.subtreeSeparation = originalSubtreeSep;
    
    this.timing.phases.layout = performance.now() - phaseStart;
  }

  /**
   * Layout tree using radial algorithm
   * @private
   */
  _layoutRadialTree() {
    const phaseStart = performance.now();
    
    // For radial layout, use polar coordinates
    this.forest.forEach(root => {
      const maxRadius = Math.min(
        this.config.bounds.width,
        this.config.bounds.height
      ) / 2 - this.config.bounds.padding;
      
      this._layoutRadialSubtree(root, 0, 2 * Math.PI, 0, maxRadius);
    });
    
    this.timing.phases.layout = performance.now() - phaseStart;
  }

  /**
   * Layout subtree in radial fashion
   * @private
   */
  _layoutRadialSubtree(node, angleStart, angleEnd, depth, maxRadius) {
    const radius = (depth / Math.max(this.treeStats.depth, 1)) * maxRadius;
    const angle = (angleStart + angleEnd) / 2;
    
    node.x = radius * Math.cos(angle);
    node.y = radius * Math.sin(angle);
    
    if (node.children.length > 0) {
      const angleStep = (angleEnd - angleStart) / node.children.length;
      
      node.children.forEach((child, i) => {
        const childAngleStart = angleStart + i * angleStep;
        const childAngleEnd = angleStart + (i + 1) * angleStep;
        
        this._layoutRadialSubtree(
          child,
          childAngleStart,
          childAngleEnd,
          depth + 1,
          maxRadius
        );
      });
    }
  }

  /**
   * Initialize node for Walker's algorithm
   * @private
   */
  _initializeNode(node) {
    node.x = 0;
    node.y = node.level * this.config.levelSeparation;
    node.modifier = 0;
    node.thread = null;
    node.ancestor = node;
  }

  /**
   * First walk of Walker's algorithm
   * @private
   */
  _firstWalk(node, leftSibling) {
    if (node.children.length === 0) {
      // Leaf node
      if (leftSibling) {
        node.x = leftSibling.x + this.config.nodeSeparation + node.size.width / 2;
      } else {
        node.x = 0;
      }
    } else {
      // Internal node
      let defaultAncestor = node.children[0];
      let previousChild = null;
      
      node.children.forEach(child => {
        this._initializeNode(child);
        this._firstWalk(child, previousChild);
        defaultAncestor = this._apportion(child, defaultAncestor);
        previousChild = child;
      });
      
      this._executeShifts(node);
      
      const midpoint = (node.children[0].x + node.children[node.children.length - 1].x) / 2;
      
      if (leftSibling) {
        node.x = leftSibling.x + this.config.nodeSeparation + node.size.width / 2;
        node.modifier = node.x - midpoint;
      } else {
        node.x = midpoint;
      }
    }
  }

  /**
   * Second walk of Walker's algorithm
   * @private
   */
  _secondWalk(node, modifier, xOffset) {
    const isVertical = this.config.direction === 'vertical';
    const isInverted = this.config.orientation === 'bottom-up' || 
                      this.config.orientation === 'right-to-left';
    
    if (isVertical) {
      node.x = node.x + modifier + xOffset;
      node.y = node.level * this.config.levelSeparation;
      
      if (isInverted) {
        node.y = -node.y;
      }
    } else {
      // Horizontal layout - swap x and y coordinates
      // In horizontal layout: x = level (depth), y = position within level
      node.y = node.x + modifier + xOffset;
      node.x = node.level * this.config.levelSeparation;
      
      if (isInverted) {
        // For right-to-left, invert the level positioning
        const maxLevel = this.treeStats.depth || 1;
        node.x = maxLevel * this.config.levelSeparation - node.level * this.config.levelSeparation;
      }
    }
    
    node.children.forEach(child => {
      this._secondWalk(child, modifier + node.modifier, xOffset);
    });
  }

  /**
   * Apportion for Walker's algorithm
   * @private
   */
  _apportion(node, defaultAncestor) {
    if (node.thread) {
      // Complex case - handle threading
      return defaultAncestor;
    }
    return node;
  }

  /**
   * Execute shifts for Walker's algorithm
   * @private
   */
  _executeShifts(node) {
    let shift = 0;
    let change = 0;
    
    for (let i = node.children.length - 1; i >= 0; i--) {
      const child = node.children[i];
      child.x += shift;
      child.modifier += shift;
      change += child.change || 0;
      shift += child.shift || 0 + change;
    }
  }

  /**
   * Apply alignment configuration
   * @private
   */
  _applyAlignment() {
    const isVertical = this.config.direction === 'vertical';
    
    if (this.config.alignment === 'left') {
      // Find leftmost position at each level
      const levelMins = new Map();
      
      this.nodes.forEach(node => {
        const alignmentCoord = isVertical ? node.x : node.y;
        const min = levelMins.get(node.level) || Infinity;
        levelMins.set(node.level, Math.min(min, alignmentCoord));
      });
      
      // Align to leftmost
      this.nodes.forEach(node => {
        if (node.parent && this.config.alignment === 'left') {
          if (isVertical) {
            node.x = node.parent.x;
          } else {
            node.y = node.parent.y;
          }
        }
      });
    } else if (this.config.alignment === 'center') {
      // Center parent over children - only apply to the appropriate axis
      this.nodes.forEach(node => {
        if (node.children.length > 0) {
          if (isVertical) {
            // For vertical layout, center on x-axis
            const childrenXSum = node.children.reduce((sum, child) => sum + child.x, 0);
            const childrenCenter = childrenXSum / node.children.length;
            
            // Small adjustment to ensure perfect centering
            const diff = node.x - childrenCenter;
            if (Math.abs(diff) > 0.1) {
              node.x = childrenCenter;
            }
          } else {
            // For horizontal layout, center on y-axis
            const childrenYSum = node.children.reduce((sum, child) => sum + child.y, 0);
            const childrenCenter = childrenYSum / node.children.length;
            
            // Small adjustment to ensure perfect centering
            const diff = node.y - childrenCenter;
            if (Math.abs(diff) > 0.1) {
              node.y = childrenCenter;
            }
          }
        }
      });
    }
  }

  /**
   * Get bounds of a tree
   * @private
   */
  _getTreeBounds(root) {
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    
    const traverse = (node) => {
      minX = Math.min(minX, node.x);
      maxX = Math.max(maxX, node.x);
      minY = Math.min(minY, node.y);
      maxY = Math.max(maxY, node.y);
      
      node.children.forEach(child => traverse(child));
    };
    
    traverse(root);
    
    return { minX, maxX, minY, maxY };
  }

  /**
   * Detect cycles in edges
   * @private
   */
  _detectCycles(edges) {
    const visited = new Set();
    const recursionStack = new Set();
    
    const hasCycle = (nodeId, adjList) => {
      visited.add(nodeId);
      recursionStack.add(nodeId);
      
      const neighbors = adjList.get(nodeId) || [];
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          if (hasCycle(neighbor, adjList)) {
            return true;
          }
        } else if (recursionStack.has(neighbor)) {
          return true;
        }
      }
      
      recursionStack.delete(nodeId);
      return false;
    };
    
    // Build adjacency list
    const adjList = new Map();
    edges.forEach(edge => {
      if (!adjList.has(edge.source)) {
        adjList.set(edge.source, []);
      }
      adjList.get(edge.source).push(edge.target);
    });
    
    // Check for cycles
    for (const nodeId of this.nodes.keys()) {
      if (!visited.has(nodeId)) {
        if (hasCycle(nodeId, adjList)) {
          return true;
        }
      }
    }
    
    return false;
  }

  /**
   * Check if adding edge would create cycle
   * @private
   */
  _wouldCreateCycle(source, target) {
    // Check if target is ancestor of source
    let current = source.parent;
    while (current) {
      if (current === target) {
        return true;
      }
      current = current.parent;
    }
    return false;
  }

  /**
   * Extract layout results
   * @private
   */
  _extractResults() {
    const positions = new Map();
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    
    // Convert node positions to output format
    this.nodes.forEach((node, nodeId) => {
      positions.set(nodeId, {
        x: node.x,
        y: node.y
      });
      
      const halfWidth = node.size.width / 2;
      const halfHeight = node.size.height / 2;
      
      minX = Math.min(minX, node.x - halfWidth);
      maxX = Math.max(maxX, node.x + halfWidth);
      minY = Math.min(minY, node.y - halfHeight);
      maxY = Math.max(maxY, node.y + halfHeight);
    });
    
    // Handle empty graph
    if (positions.size === 0) {
      minX = maxX = minY = maxY = 0;
    }
    
    const bounds = {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY
    };
    
    const metadata = {
      algorithm: 'tree',
      config: this.config,
      stats: {
        depth: this.treeStats.depth,
        width: this.treeStats.width,
        nodeCount: this.treeStats.nodeCount,
        forestSize: this.forest.length
      },
      hasCycles: this.treeStats.hasCycles || false
    };
    
    return {
      positions,
      bounds,
      edges: new Map(),
      metadata
    };
  }

  /**
   * Fallback layout for error cases
   * @private
   */
  _fallbackLayout(graphData) {
    const positions = new Map();
    const spacing = 100;
    
    // Simple grid layout as fallback
    const cols = Math.ceil(Math.sqrt(graphData.nodes.length));
    
    graphData.nodes.forEach((node, index) => {
      const row = Math.floor(index / cols);
      const col = index % cols;
      
      positions.set(node.id, {
        x: col * spacing,
        y: row * spacing
      });
    });
    
    return {
      positions,
      bounds: {
        x: 0,
        y: 0,
        width: cols * spacing,
        height: Math.ceil(graphData.nodes.length / cols) * spacing
      },
      edges: new Map(),
      metadata: {
        algorithm: 'tree',
        fallback: true
      }
    };
  }
}

export default TreeLayout;