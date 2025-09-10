/**
 * GridLayout - Grid-based layout plugin for arranging nodes in a structured grid pattern
 * 
 * Provides a clean, organized layout by arranging nodes in rows and columns.
 * Supports various alignment options, spacing configurations, and grid patterns.
 * Ideal for displaying structured data, flowcharts, and organized diagrams.
 */

import { BaseLayoutPlugin } from './BaseLayoutPlugin.js';

export class GridLayout extends BaseLayoutPlugin {
  constructor(config = {}) {
    super(config);
    
    this.config = {
      ...this.config,
      
      // Grid configuration
      gridType: config.gridType || 'fixed', // fixed, auto, square, rectangular
      columns: config.columns || null, // Number of columns (null for auto)
      rows: config.rows || null, // Number of rows (null for auto)
      
      // Spacing configuration
      cellWidth: config.cellWidth || 120, // Width of each grid cell
      cellHeight: config.cellHeight || 80, // Height of each grid cell
      horizontalSpacing: config.horizontalSpacing || 20, // Space between columns
      verticalSpacing: config.verticalSpacing || 20, // Space between rows
      
      // Alignment within cells
      cellAlignment: config.cellAlignment || 'center', // center, top-left, top-center, etc.
      nodeAlignment: config.nodeAlignment || 'center', // How to align nodes within cells
      
      // Grid patterns
      pattern: config.pattern || 'row-major', // row-major, column-major, spiral, zigzag
      startPosition: config.startPosition || 'top-left', // top-left, top-right, bottom-left, bottom-right, center
      
      // Layout direction
      direction: config.direction || 'horizontal', // horizontal, vertical
      fillDirection: config.fillDirection || 'left-to-right', // left-to-right, right-to-left, top-to-bottom, bottom-to-top
      
      // Grouping options
      groupBy: config.groupBy || null, // Property to group nodes by
      groupSpacing: config.groupSpacing || 50, // Extra spacing between groups
      
      // Node filtering and sorting
      sortBy: config.sortBy || null, // Property to sort nodes by
      sortOrder: config.sortOrder || 'asc', // asc, desc
      filterFn: config.filterFn || null, // Function to filter nodes
      
      // Responsive behavior
      responsive: config.responsive !== false,
      minCellSize: config.minCellSize || { width: 80, height: 60 },
      maxCellSize: config.maxCellSize || { width: 200, height: 120 },
      
      ...config
    };
    
    // Grid state
    this.gridDimensions = { rows: 0, columns: 0 };
    this.cellPositions = new Map(); // Maps cell coordinates to positions
    this.nodeGroups = new Map(); // Groups of nodes if grouping is enabled
    this.gridBounds = { x: 0, y: 0, width: 0, height: 0 };
  }
  
  /**
   * Get plugin metadata
   */
  getMetadata() {
    return {
      name: 'grid-layout',
      version: '1.0.0',
      description: 'Grid-based layout with configurable patterns and alignment',
      author: 'ShowMe Module',
      category: 'structured',
      capabilities: {
        directed: true,
        undirected: true,
        weighted: false,
        constraints: true,
        animation: true,
        responsive: true,
        grouping: true,
        sorting: true
      }
    };
  }
  
  /**
   * Execute the grid layout algorithm
   */
  async _executeLayout(graphData) {
    const startTime = performance.now();
    
    try {
      // Prepare nodes for layout
      const processedNodes = this._preprocessNodes(graphData.nodes);
      
      // Calculate grid dimensions
      this._calculateGridDimensions(processedNodes);
      
      // Calculate cell positions
      this._calculateCellPositions();
      
      // Assign nodes to grid positions
      const nodePositions = this._assignNodesToGrid(processedNodes);
      
      // Calculate layout bounds
      this._calculateLayoutBounds();
      
      // Prepare edge information
      const edges = this._processEdges(graphData.edges || []);
      
      const endTime = performance.now();
      
      return {
        positions: nodePositions,
        bounds: { ...this.gridBounds },
        edges,
        metadata: {
          algorithm: 'grid',
          gridDimensions: { ...this.gridDimensions },
          cellCount: this.gridDimensions.rows * this.gridDimensions.columns,
          nodeCount: processedNodes.length,
          groupCount: this.nodeGroups.size,
          executionTime: endTime - startTime,
          config: {
            gridType: this.config.gridType,
            pattern: this.config.pattern,
            dimensions: `${this.gridDimensions.columns}x${this.gridDimensions.rows}`
          }
        }
      };
      
    } catch (error) {
      console.error('Grid layout execution failed:', error);
      throw error;
    }
  }
  
  /**
   * Preprocess nodes (filtering, sorting, grouping)
   */
  _preprocessNodes(nodes) {
    let processedNodes = [...nodes];
    
    // Apply filtering
    if (this.config.filterFn) {
      processedNodes = processedNodes.filter(this.config.filterFn);
    }
    
    // Apply sorting
    if (this.config.sortBy) {
      processedNodes.sort((a, b) => {
        const aVal = a[this.config.sortBy];
        const bVal = b[this.config.sortBy];
        
        let comparison = 0;
        if (aVal < bVal) comparison = -1;
        else if (aVal > bVal) comparison = 1;
        
        return this.config.sortOrder === 'desc' ? -comparison : comparison;
      });
    }
    
    // Apply grouping
    if (this.config.groupBy) {
      this._groupNodes(processedNodes);
    }
    
    return processedNodes;
  }
  
  /**
   * Group nodes by specified property
   */
  _groupNodes(nodes) {
    this.nodeGroups.clear();
    
    nodes.forEach(node => {
      const groupKey = node[this.config.groupBy] || 'ungrouped';
      
      if (!this.nodeGroups.has(groupKey)) {
        this.nodeGroups.set(groupKey, []);
      }
      
      this.nodeGroups.get(groupKey).push(node);
    });
  }
  
  /**
   * Calculate grid dimensions based on configuration and node count
   */
  _calculateGridDimensions(nodes) {
    const nodeCount = nodes.length;
    
    if (this.config.gridType === 'fixed') {
      // Use explicitly specified dimensions
      this.gridDimensions.columns = this.config.columns || Math.ceil(Math.sqrt(nodeCount));
      this.gridDimensions.rows = this.config.rows || Math.ceil(nodeCount / this.gridDimensions.columns);
      
    } else if (this.config.gridType === 'square') {
      // Try to make a square grid
      const side = Math.ceil(Math.sqrt(nodeCount));
      this.gridDimensions.columns = side;
      this.gridDimensions.rows = side;
      
    } else if (this.config.gridType === 'rectangular') {
      // Prefer wider layouts
      const aspectRatio = this.config.bounds.width / this.config.bounds.height;
      this.gridDimensions.columns = Math.ceil(Math.sqrt(nodeCount * aspectRatio));
      this.gridDimensions.rows = Math.ceil(nodeCount / this.gridDimensions.columns);
      
    } else { // auto
      // Automatically determine best dimensions
      this._calculateOptimalDimensions(nodeCount);
    }
    
    // Ensure minimum dimensions
    this.gridDimensions.columns = Math.max(1, this.gridDimensions.columns);
    this.gridDimensions.rows = Math.max(1, this.gridDimensions.rows);
  }
  
  /**
   * Calculate optimal grid dimensions
   */
  _calculateOptimalDimensions(nodeCount) {
    const availableWidth = this.config.bounds.width - 2 * this.config.bounds.padding;
    const availableHeight = this.config.bounds.height - 2 * this.config.bounds.padding;
    
    const cellTotalWidth = this.config.cellWidth + this.config.horizontalSpacing;
    const cellTotalHeight = this.config.cellHeight + this.config.verticalSpacing;
    
    const maxColumns = Math.floor(availableWidth / cellTotalWidth);
    const maxRows = Math.floor(availableHeight / cellTotalHeight);
    
    // Try to fit within bounds while maintaining good proportions
    let bestColumns = Math.min(maxColumns, Math.ceil(Math.sqrt(nodeCount)));
    let bestRows = Math.ceil(nodeCount / bestColumns);
    
    // Adjust if doesn't fit vertically
    if (bestRows > maxRows) {
      bestRows = maxRows;
      bestColumns = Math.ceil(nodeCount / bestRows);
    }
    
    this.gridDimensions.columns = Math.max(1, bestColumns);
    this.gridDimensions.rows = Math.max(1, bestRows);
  }
  
  /**
   * Calculate physical positions for each grid cell
   */
  _calculateCellPositions() {
    this.cellPositions.clear();
    
    const cellTotalWidth = this.config.cellWidth + this.config.horizontalSpacing;
    const cellTotalHeight = this.config.cellHeight + this.config.verticalSpacing;
    
    const gridWidth = this.gridDimensions.columns * cellTotalWidth - this.config.horizontalSpacing;
    const gridHeight = this.gridDimensions.rows * cellTotalHeight - this.config.verticalSpacing;
    
    // Calculate starting position based on alignment
    let startX, startY;
    
    switch (this.config.startPosition) {
      case 'top-left':
        startX = this.config.bounds.padding;
        startY = this.config.bounds.padding;
        break;
      case 'top-right':
        startX = this.config.bounds.width - this.config.bounds.padding - gridWidth;
        startY = this.config.bounds.padding;
        break;
      case 'bottom-left':
        startX = this.config.bounds.padding;
        startY = this.config.bounds.height - this.config.bounds.padding - gridHeight;
        break;
      case 'bottom-right':
        startX = this.config.bounds.width - this.config.bounds.padding - gridWidth;
        startY = this.config.bounds.height - this.config.bounds.padding - gridHeight;
        break;
      case 'center':
      default:
        startX = (this.config.bounds.width - gridWidth) / 2;
        startY = (this.config.bounds.height - gridHeight) / 2;
        break;
    }
    
    // Generate positions for each grid cell
    for (let row = 0; row < this.gridDimensions.rows; row++) {
      for (let col = 0; col < this.gridDimensions.columns; col++) {
        const x = startX + col * cellTotalWidth + this.config.cellWidth / 2;
        const y = startY + row * cellTotalHeight + this.config.cellHeight / 2;
        
        this.cellPositions.set(`${row},${col}`, { x, y, row, col });
      }
    }
  }
  
  /**
   * Assign nodes to grid positions based on pattern
   */
  _assignNodesToGrid(nodes) {
    const positions = new Map();
    
    if (this.config.pattern === 'spiral') {
      this._assignNodesSpiral(nodes, positions);
    } else if (this.config.pattern === 'zigzag') {
      this._assignNodesZigzag(nodes, positions);
    } else if (this.config.pattern === 'column-major') {
      this._assignNodesColumnMajor(nodes, positions);
    } else { // row-major (default)
      this._assignNodesRowMajor(nodes, positions);
    }
    
    return positions;
  }
  
  /**
   * Assign nodes in row-major order
   */
  _assignNodesRowMajor(nodes, positions) {
    let nodeIndex = 0;
    
    for (let row = 0; row < this.gridDimensions.rows && nodeIndex < nodes.length; row++) {
      for (let col = 0; col < this.gridDimensions.columns && nodeIndex < nodes.length; col++) {
        const cellKey = `${row},${col}`;
        const cellPos = this.cellPositions.get(cellKey);
        
        if (cellPos) {
          const node = nodes[nodeIndex];
          positions.set(node.id, {
            x: cellPos.x,
            y: cellPos.y,
            gridPosition: { row, col }
          });
          nodeIndex++;
        }
      }
    }
  }
  
  /**
   * Assign nodes in column-major order
   */
  _assignNodesColumnMajor(nodes, positions) {
    let nodeIndex = 0;
    
    for (let col = 0; col < this.gridDimensions.columns && nodeIndex < nodes.length; col++) {
      for (let row = 0; row < this.gridDimensions.rows && nodeIndex < nodes.length; row++) {
        const cellKey = `${row},${col}`;
        const cellPos = this.cellPositions.get(cellKey);
        
        if (cellPos) {
          const node = nodes[nodeIndex];
          positions.set(node.id, {
            x: cellPos.x,
            y: cellPos.y,
            gridPosition: { row, col }
          });
          nodeIndex++;
        }
      }
    }
  }
  
  /**
   * Assign nodes in zigzag pattern
   */
  _assignNodesZigzag(nodes, positions) {
    let nodeIndex = 0;
    
    for (let row = 0; row < this.gridDimensions.rows && nodeIndex < nodes.length; row++) {
      const isEvenRow = row % 2 === 0;
      const colStart = isEvenRow ? 0 : this.gridDimensions.columns - 1;
      const colEnd = isEvenRow ? this.gridDimensions.columns : -1;
      const colStep = isEvenRow ? 1 : -1;
      
      for (let col = colStart; col !== colEnd && nodeIndex < nodes.length; col += colStep) {
        const cellKey = `${row},${col}`;
        const cellPos = this.cellPositions.get(cellKey);
        
        if (cellPos) {
          const node = nodes[nodeIndex];
          positions.set(node.id, {
            x: cellPos.x,
            y: cellPos.y,
            gridPosition: { row, col }
          });
          nodeIndex++;
        }
      }
    }
  }
  
  /**
   * Assign nodes in spiral pattern
   */
  _assignNodesSpiral(nodes, positions) {
    if (nodes.length === 0) return;
    
    let nodeIndex = 0;
    let top = 0, bottom = this.gridDimensions.rows - 1;
    let left = 0, right = this.gridDimensions.columns - 1;
    
    while (top <= bottom && left <= right && nodeIndex < nodes.length) {
      // Move right along top row
      for (let col = left; col <= right && nodeIndex < nodes.length; col++) {
        this._assignNodeAtPosition(nodes[nodeIndex], top, col, positions);
        nodeIndex++;
      }
      top++;
      
      // Move down along right column
      for (let row = top; row <= bottom && nodeIndex < nodes.length; row++) {
        this._assignNodeAtPosition(nodes[nodeIndex], row, right, positions);
        nodeIndex++;
      }
      right--;
      
      // Move left along bottom row
      if (top <= bottom) {
        for (let col = right; col >= left && nodeIndex < nodes.length; col--) {
          this._assignNodeAtPosition(nodes[nodeIndex], bottom, col, positions);
          nodeIndex++;
        }
        bottom--;
      }
      
      // Move up along left column
      if (left <= right) {
        for (let row = bottom; row >= top && nodeIndex < nodes.length; row--) {
          this._assignNodeAtPosition(nodes[nodeIndex], row, left, positions);
          nodeIndex++;
        }
        left++;
      }
    }
  }
  
  /**
   * Helper to assign a node at specific grid position
   */
  _assignNodeAtPosition(node, row, col, positions) {
    const cellKey = `${row},${col}`;
    const cellPos = this.cellPositions.get(cellKey);
    
    if (cellPos) {
      positions.set(node.id, {
        x: cellPos.x,
        y: cellPos.y,
        gridPosition: { row, col }
      });
    }
  }
  
  /**
   * Calculate layout bounds
   */
  _calculateLayoutBounds() {
    if (this.cellPositions.size === 0) {
      this.gridBounds = { x: 0, y: 0, width: 0, height: 0 };
      return;
    }
    
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    
    this.cellPositions.forEach(pos => {
      const halfWidth = this.config.cellWidth / 2;
      const halfHeight = this.config.cellHeight / 2;
      
      minX = Math.min(minX, pos.x - halfWidth);
      maxX = Math.max(maxX, pos.x + halfWidth);
      minY = Math.min(minY, pos.y - halfHeight);
      maxY = Math.max(maxY, pos.y + halfHeight);
    });
    
    this.gridBounds = {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY
    };
  }
  
  /**
   * Process edges for layout
   */
  _processEdges(edges) {
    const edgeMap = new Map();
    
    edges.forEach(edge => {
      edgeMap.set(edge.id, {
        id: edge.id,
        source: edge.source,
        target: edge.target,
        data: edge
      });
    });
    
    return edgeMap;
  }
  
  /**
   * Update configuration and recalculate if needed
   */
  updateConfig(newConfig) {
    super.updateConfig(newConfig);
    
    // Clear cached calculations that depend on config
    this.cellPositions.clear();
    this.nodeGroups.clear();
    this.gridDimensions = { rows: 0, columns: 0 };
  }
  
  /**
   * Get current grid information
   */
  getGridInfo() {
    return {
      dimensions: { ...this.gridDimensions },
      cellSize: {
        width: this.config.cellWidth,
        height: this.config.cellHeight
      },
      spacing: {
        horizontal: this.config.horizontalSpacing,
        vertical: this.config.verticalSpacing
      },
      bounds: { ...this.gridBounds },
      cellCount: this.gridDimensions.rows * this.gridDimensions.columns,
      pattern: this.config.pattern,
      groupCount: this.nodeGroups.size
    };
  }
}

export default GridLayout;