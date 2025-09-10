/**
 * LayeredLayout - Hierarchical layered layout plugin for directed graphs
 * 
 * Implements Sugiyama-style layered layout algorithm for directed acyclic graphs (DAGs).
 * Organizes nodes in horizontal layers based on their topological ordering,
 * then minimizes edge crossings and optimizes node positioning within layers.
 * 
 * Ideal for flowcharts, dependency graphs, organizational charts, and process diagrams.
 */

import { BaseLayoutPlugin } from './BaseLayoutPlugin.js';

export class LayeredLayout extends BaseLayoutPlugin {
  constructor(config = {}) {
    super(config);
    
    this.config = {
      ...this.config,
      
      // Layer configuration
      layerDirection: config.layerDirection || 'top-to-bottom', // top-to-bottom, bottom-to-top, left-to-right, right-to-left
      layerSpacing: config.layerSpacing || 120, // Distance between layers
      nodeSpacing: config.nodeSpacing || 80, // Distance between nodes in same layer
      
      // Node positioning within layers
      layerAlignment: config.layerAlignment || 'center', // center, left, right, justify
      nodeAlignment: config.nodeAlignment || 'center', // center, top, bottom, middle
      
      // Edge routing
      edgeRouting: config.edgeRouting || 'straight', // straight, orthogonal, curved
      minimizeEdgeCrossings: config.minimizeEdgeCrossings !== false,
      
      // Cycle handling for non-DAG graphs
      cycleHandling: config.cycleHandling || 'break', // break, ignore, error
      feedbackEdges: config.feedbackEdges || 'minimize', // minimize, remove, keep
      
      // Layer assignment
      layerAssignment: config.layerAssignment || 'longest-path', // longest-path, coffman-graham, topological
      layerCompaction: config.layerCompaction !== false,
      
      // Cross-reduction
      crossReduction: config.crossReduction || 'barycenter', // barycenter, median, none
      maxCrossReductionIterations: config.maxCrossReductionIterations || 10,
      
      // Node positioning
      nodePositioning: config.nodePositioning || 'barycenter', // barycenter, median, priority
      maxPositioningIterations: config.maxPositioningIterations || 5,
      
      // Virtual nodes for long edges
      insertVirtualNodes: config.insertVirtualNodes !== false,
      virtualNodeSize: config.virtualNodeSize || { width: 10, height: 10 },
      
      // Layout optimization
      rankSeparation: config.rankSeparation || 50, // Minimum separation between ranks
      nodeSeparation: config.nodeSeparation || 30, // Minimum separation between nodes
      
      // Root node specification
      rootNodes: config.rootNodes || [], // Array of root node IDs
      leafNodes: config.leafNodes || [], // Array of leaf node IDs
      
      ...config
    };
    
    // Layout state
    this.layers = []; // Array of layers, each containing node IDs
    this.nodeToLayer = new Map(); // Map node ID to layer index
    this.layerPositions = new Map(); // Map layer index to Y position
    this.nodePositions = new Map(); // Map node ID to final position
    this.virtualNodes = new Map(); // Map virtual node ID to original edge
    this.feedbackEdges = new Set(); // Set of feedback edges to break cycles
    this.nodeRanks = new Map(); // Map node ID to rank/layer number
    this.layerNodes = new Map(); // Map layer number to array of nodes
    
    // Edge routing state
    this.edgePaths = new Map(); // Map edge ID to path points
    this.crossingCount = 0; // Total edge crossings
    
    // Graph analysis
    this.isDAG = true;
    this.cycles = [];
    this.topologicalOrder = [];
  }
  
  /**
   * Get plugin metadata
   */
  getMetadata() {
    return {
      name: 'layered-layout',
      version: '1.0.0',
      description: 'Hierarchical layered layout with edge crossing minimization',
      author: 'ShowMe Module',
      category: 'hierarchical',
      capabilities: {
        directed: true,
        undirected: false,
        weighted: true,
        constraints: true,
        animation: true,
        hierarchical: true,
        layered: true,
        crossingMinimization: true
      }
    };
  }
  
  /**
   * Execute the layered layout algorithm
   */
  async _executeLayout(graphData) {
    const startTime = performance.now();
    
    try {
      // Reset state
      this._resetState();
      
      // Preprocess graph data
      const processedData = await this._preprocessGraphData(graphData);
      
      // Step 1: Cycle removal (if needed)
      await this._handleCycles(processedData);
      
      // Step 2: Layer assignment
      await this._assignLayers(processedData);
      
      // Step 3: Insert virtual nodes for long edges
      if (this.config.insertVirtualNodes) {
        await this._insertVirtualNodes(processedData);
      }
      
      // Step 4: Cross reduction
      if (this.config.minimizeEdgeCrossings) {
        await this._reduceCrossings(processedData);
      }
      
      // Step 5: Node positioning
      await this._positionNodes(processedData);
      
      // Step 6: Calculate final coordinates
      await this._calculateCoordinates();
      
      // Step 7: Route edges
      await this._routeEdges(processedData);
      
      // Calculate layout bounds
      const bounds = this._calculateLayoutBounds();
      
      const endTime = performance.now();
      
      return {
        positions: new Map(this.nodePositions),
        bounds,
        edges: this._processEdges(processedData.edges),
        metadata: {
          algorithm: 'layered',
          layerDirection: this.config.layerDirection,
          layerCount: this.layers.length,
          nodeCount: processedData.nodes.length,
          virtualNodeCount: this.virtualNodes.size,
          crossingCount: this.crossingCount,
          cycleCount: this.cycles.length,
          isDAG: this.isDAG,
          executionTime: endTime - startTime,
          config: {
            layerDirection: this.config.layerDirection,
            layerSpacing: this.config.layerSpacing,
            crossReduction: this.config.crossReduction,
            cycleHandling: this.config.cycleHandling
          }
        }
      };
      
    } catch (error) {
      console.error('Layered layout execution failed:', error);
      throw error;
    }
  }
  
  /**
   * Reset internal state
   */
  _resetState() {
    this.layers = [];
    this.nodeToLayer.clear();
    this.layerPositions.clear();
    this.nodePositions.clear();
    this.virtualNodes.clear();
    this.feedbackEdges.clear();
    this.nodeRanks.clear();
    this.layerNodes.clear();
    this.edgePaths.clear();
    this.crossingCount = 0;
    this.isDAG = true;
    this.cycles = [];
    this.topologicalOrder = [];
  }
  
  /**
   * Handle cycles in the graph
   */
  async _handleCycles(graphData) {
    // Detect cycles using DFS
    const visited = new Set();
    const recursionStack = new Set();
    const cycleEdges = new Set();
    
    const detectCycle = (nodeId, path = []) => {
      if (recursionStack.has(nodeId)) {
        // Found a cycle
        const cycleStart = path.indexOf(nodeId);
        const cycle = path.slice(cycleStart);
        cycle.push(nodeId); // Close the cycle
        this.cycles.push(cycle);
        this.isDAG = false;
        
        // Mark feedback edges
        for (let i = 0; i < cycle.length - 1; i++) {
          const edge = graphData.edges.find(e => 
            e.source === cycle[i] && e.target === cycle[i + 1]
          );
          if (edge) {
            cycleEdges.add(edge.id);
          }
        }
        return true;
      }
      
      if (visited.has(nodeId)) {
        return false;
      }
      
      visited.add(nodeId);
      recursionStack.add(nodeId);
      path.push(nodeId);
      
      // Visit all adjacent nodes
      const outgoingEdges = graphData.edges.filter(e => e.source === nodeId);
      for (const edge of outgoingEdges) {
        if (detectCycle(edge.target, [...path])) {
          if (this.config.cycleHandling === 'error') {
            throw new Error('Graph contains cycles and cycle handling is set to error');
          }
        }
      }
      
      recursionStack.delete(nodeId);
      return false;
    };
    
    // Check each node for cycles
    for (const node of graphData.nodes) {
      if (!visited.has(node.id)) {
        detectCycle(node.id);
      }
    }
    
    // Handle feedback edges based on configuration
    if (this.config.cycleHandling === 'break' && cycleEdges.size > 0) {
      this.feedbackEdges = cycleEdges;
      
      if (this.config.feedbackEdges === 'remove') {
        // Remove feedback edges from consideration
        graphData.edges = graphData.edges.filter(e => !cycleEdges.has(e.id));
      }
    }
  }
  
  /**
   * Assign nodes to layers
   */
  async _assignLayers(graphData) {
    if (this.config.layerAssignment === 'longest-path') {
      await this._assignLayersLongestPath(graphData);
    } else if (this.config.layerAssignment === 'topological') {
      await this._assignLayersTopological(graphData);
    } else {
      await this._assignLayersLongestPath(graphData); // Default
    }
    
    // Organize layers
    this._organizeLayers(graphData);
  }
  
  /**
   * Assign layers using longest path algorithm
   */
  async _assignLayersLongestPath(graphData) {
    // Calculate the longest path to each node
    const inDegree = new Map();
    const rank = new Map();
    const queue = [];
    
    // Initialize in-degrees and find root nodes
    for (const node of graphData.nodes) {
      inDegree.set(node.id, 0);
      rank.set(node.id, 0);
    }
    
    // Count in-degrees (excluding feedback edges)
    for (const edge of graphData.edges) {
      if (!this.feedbackEdges.has(edge.id)) {
        inDegree.set(edge.target, (inDegree.get(edge.target) || 0) + 1);
      }
    }
    
    // Find root nodes (nodes with no incoming edges)
    for (const [nodeId, degree] of inDegree) {
      if (degree === 0) {
        queue.push(nodeId);
      }
    }
    
    // If no natural roots found, use specified root nodes
    if (queue.length === 0 && this.config.rootNodes.length > 0) {
      queue.push(...this.config.rootNodes);
    }
    
    // Process nodes in topological order
    while (queue.length > 0) {
      const currentNode = queue.shift();
      this.topologicalOrder.push(currentNode);
      
      // Process all outgoing edges
      const outgoingEdges = graphData.edges.filter(e => 
        e.source === currentNode && !this.feedbackEdges.has(e.id)
      );
      
      for (const edge of outgoingEdges) {
        const targetRank = Math.max(
          rank.get(edge.target) || 0,
          (rank.get(currentNode) || 0) + 1
        );
        rank.set(edge.target, targetRank);
        
        inDegree.set(edge.target, inDegree.get(edge.target) - 1);
        if (inDegree.get(edge.target) === 0) {
          queue.push(edge.target);
        }
      }
    }
    
    this.nodeRanks = rank;
  }
  
  /**
   * Assign layers using simple topological ordering
   */
  async _assignLayersTopological(graphData) {
    // Simple level-by-level assignment
    const visited = new Set();
    const currentLevel = new Set();
    let level = 0;
    
    // Find root nodes
    const hasIncomingEdge = new Set();
    graphData.edges.forEach(edge => {
      if (!this.feedbackEdges.has(edge.id)) {
        hasIncomingEdge.add(edge.target);
      }
    });
    
    // Start with root nodes
    graphData.nodes.forEach(node => {
      if (!hasIncomingEdge.has(node.id)) {
        currentLevel.add(node.id);
      }
    });
    
    while (currentLevel.size > 0) {
      const nextLevel = new Set();
      
      for (const nodeId of currentLevel) {
        this.nodeRanks.set(nodeId, level);
        visited.add(nodeId);
        
        // Add children to next level
        const outgoingEdges = graphData.edges.filter(e => 
          e.source === nodeId && !this.feedbackEdges.has(e.id)
        );
        
        for (const edge of outgoingEdges) {
          if (!visited.has(edge.target)) {
            // Check if all parents are visited
            const incomingEdges = graphData.edges.filter(e => 
              e.target === edge.target && !this.feedbackEdges.has(e.id)
            );
            const allParentsVisited = incomingEdges.every(e => visited.has(e.source));
            
            if (allParentsVisited) {
              nextLevel.add(edge.target);
            }
          }
        }
      }
      
      currentLevel.clear();
      nextLevel.forEach(node => currentLevel.add(node));
      level++;
    }
  }
  
  /**
   * Organize nodes into layers
   */
  _organizeLayers(graphData) {
    // Group nodes by rank
    this.layerNodes.clear();
    for (const [nodeId, rank] of this.nodeRanks) {
      if (!this.layerNodes.has(rank)) {
        this.layerNodes.set(rank, []);
      }
      this.layerNodes.get(rank).push(nodeId);
    }
    
    // Convert to layers array
    const maxRank = Math.max(...this.nodeRanks.values());
    this.layers = [];
    for (let i = 0; i <= maxRank; i++) {
      this.layers.push(this.layerNodes.get(i) || []);
    }
    
    // Update node to layer mapping
    this.nodeToLayer.clear();
    this.layers.forEach((layer, layerIndex) => {
      layer.forEach(nodeId => {
        this.nodeToLayer.set(nodeId, layerIndex);
      });
    });
  }
  
  /**
   * Insert virtual nodes for edges spanning multiple layers
   */
  async _insertVirtualNodes(graphData) {
    const newEdges = [];
    const edgesToRemove = [];
    
    for (const edge of graphData.edges) {
      if (this.feedbackEdges.has(edge.id)) continue;
      
      const sourceLayer = this.nodeToLayer.get(edge.source);
      const targetLayer = this.nodeToLayer.get(edge.target);
      
      if (targetLayer - sourceLayer > 1) {
        // Edge spans multiple layers, insert virtual nodes
        edgesToRemove.push(edge);
        
        let currentSource = edge.source;
        for (let layer = sourceLayer + 1; layer < targetLayer; layer++) {
          const virtualId = `virtual_${edge.id}_${layer}`;
          
          // Create virtual node
          const virtualNode = {
            id: virtualId,
            label: '',
            size: { ...this.config.virtualNodeSize },
            isVirtual: true,
            originalEdge: edge.id
          };
          
          graphData.nodes.push(virtualNode);
          this.virtualNodes.set(virtualId, edge);
          this.nodeToLayer.set(virtualId, layer);
          
          // Add to layer
          this.layers[layer].push(virtualId);
          
          // Create edge segment
          newEdges.push({
            id: `${edge.id}_segment_${layer}`,
            source: currentSource,
            target: virtualId,
            originalEdge: edge.id,
            isVirtual: true
          });
          
          currentSource = virtualId;
        }
        
        // Final segment to target
        newEdges.push({
          id: `${edge.id}_segment_final`,
          source: currentSource,
          target: edge.target,
          originalEdge: edge.id,
          isVirtual: true
        });
      }
    }
    
    // Update edges
    graphData.edges = graphData.edges.filter(e => !edgesToRemove.includes(e));
    graphData.edges.push(...newEdges);
  }
  
  /**
   * Reduce edge crossings using iterative improvement
   */
  async _reduceCrossings(graphData) {
    if (this.config.crossReduction === 'none') return;
    
    let improved = true;
    let iteration = 0;
    
    while (improved && iteration < this.config.maxCrossReductionIterations) {
      improved = false;
      
      // Sweep down (order lower layers based on upper layers)
      for (let i = 1; i < this.layers.length; i++) {
        const newOrder = this._orderLayerByAdjacent(i, graphData, 'down');
        if (!this._arraysEqual(newOrder, this.layers[i])) {
          this.layers[i] = newOrder;
          improved = true;
        }
      }
      
      // Sweep up (order upper layers based on lower layers)
      for (let i = this.layers.length - 2; i >= 0; i--) {
        const newOrder = this._orderLayerByAdjacent(i, graphData, 'up');
        if (!this._arraysEqual(newOrder, this.layers[i])) {
          this.layers[i] = newOrder;
          improved = true;
        }
      }
      
      iteration++;
    }
    
    // Count final crossings
    this.crossingCount = this._countCrossings(graphData);
  }
  
  /**
   * Order nodes in layer based on adjacent layer
   */
  _orderLayerByAdjacent(layerIndex, graphData, direction) {
    const layer = this.layers[layerIndex];
    const adjacentLayerIndex = direction === 'down' ? layerIndex - 1 : layerIndex + 1;
    
    if (adjacentLayerIndex < 0 || adjacentLayerIndex >= this.layers.length) {
      return [...layer];
    }
    
    // Calculate barycenter or median position for each node
    const positions = new Map();
    
    for (const nodeId of layer) {
      const adjacentNodes = [];
      
      if (direction === 'down') {
        // Look at incoming edges from previous layer
        const incomingEdges = graphData.edges.filter(e => 
          e.target === nodeId && !this.feedbackEdges.has(e.id)
        );
        for (const edge of incomingEdges) {
          const sourceIndex = this.layers[adjacentLayerIndex].indexOf(edge.source);
          if (sourceIndex >= 0) {
            adjacentNodes.push(sourceIndex);
          }
        }
      } else {
        // Look at outgoing edges to next layer
        const outgoingEdges = graphData.edges.filter(e => 
          e.source === nodeId && !this.feedbackEdges.has(e.id)
        );
        for (const edge of outgoingEdges) {
          const targetIndex = this.layers[adjacentLayerIndex].indexOf(edge.target);
          if (targetIndex >= 0) {
            adjacentNodes.push(targetIndex);
          }
        }
      }
      
      // Calculate position based on method
      let position = 0;
      if (adjacentNodes.length > 0) {
        if (this.config.crossReduction === 'barycenter') {
          position = adjacentNodes.reduce((sum, pos) => sum + pos, 0) / adjacentNodes.length;
        } else if (this.config.crossReduction === 'median') {
          adjacentNodes.sort((a, b) => a - b);
          const mid = Math.floor(adjacentNodes.length / 2);
          position = adjacentNodes.length % 2 === 1 
            ? adjacentNodes[mid]
            : (adjacentNodes[mid - 1] + adjacentNodes[mid]) / 2;
        }
      }
      
      positions.set(nodeId, position);
    }
    
    // Sort nodes by their calculated positions
    return [...layer].sort((a, b) => {
      const posA = positions.get(a) || 0;
      const posB = positions.get(b) || 0;
      
      if (posA !== posB) {
        return posA - posB;
      }
      
      // Use node ID as tiebreaker for stability
      return a.localeCompare(b);
    });
  }
  
  /**
   * Count edge crossings
   */
  _countCrossings(graphData) {
    let crossings = 0;
    
    for (let i = 0; i < this.layers.length - 1; i++) {
      const upperLayer = this.layers[i];
      const lowerLayer = this.layers[i + 1];
      
      // Get all edges between these layers
      const layerEdges = [];
      for (const edge of graphData.edges) {
        const sourceIndex = upperLayer.indexOf(edge.source);
        const targetIndex = lowerLayer.indexOf(edge.target);
        
        if (sourceIndex >= 0 && targetIndex >= 0) {
          layerEdges.push({ source: sourceIndex, target: targetIndex });
        }
      }
      
      // Count crossings between edge pairs
      for (let j = 0; j < layerEdges.length; j++) {
        for (let k = j + 1; k < layerEdges.length; k++) {
          const edge1 = layerEdges[j];
          const edge2 = layerEdges[k];
          
          if ((edge1.source < edge2.source && edge1.target > edge2.target) ||
              (edge1.source > edge2.source && edge1.target < edge2.target)) {
            crossings++;
          }
        }
      }
    }
    
    return crossings;
  }
  
  /**
   * Position nodes within their layers
   */
  async _positionNodes(graphData) {
    // Calculate layer positions based on direction
    this._calculateLayerPositions();
    
    // Position nodes within each layer
    for (let layerIndex = 0; layerIndex < this.layers.length; layerIndex++) {
      this._positionNodesInLayer(layerIndex, graphData);
    }
  }
  
  /**
   * Calculate Y positions for layers
   */
  _calculateLayerPositions() {
    const isVertical = ['top-to-bottom', 'bottom-to-top'].includes(this.config.layerDirection);
    
    for (let i = 0; i < this.layers.length; i++) {
      let position;
      
      if (isVertical) {
        if (this.config.layerDirection === 'top-to-bottom') {
          position = i * this.config.layerSpacing;
        } else {
          position = (this.layers.length - 1 - i) * this.config.layerSpacing;
        }
      } else {
        if (this.config.layerDirection === 'left-to-right') {
          position = i * this.config.layerSpacing;
        } else {
          position = (this.layers.length - 1 - i) * this.config.layerSpacing;
        }
      }
      
      this.layerPositions.set(i, position);
    }
  }
  
  /**
   * Position nodes within a single layer
   */
  _positionNodesInLayer(layerIndex, graphData) {
    const layer = this.layers[layerIndex];
    if (layer.length === 0) return;
    
    const isVertical = ['top-to-bottom', 'bottom-to-top'].includes(this.config.layerDirection);
    const layerPosition = this.layerPositions.get(layerIndex);
    
    // Calculate positions along the layer axis
    const totalWidth = (layer.length - 1) * this.config.nodeSpacing;
    let startPos = 0;
    
    if (this.config.layerAlignment === 'center') {
      startPos = -totalWidth / 2;
    } else if (this.config.layerAlignment === 'right') {
      startPos = -totalWidth;
    }
    // 'left' alignment starts at 0
    
    // Position each node
    for (let i = 0; i < layer.length; i++) {
      const nodeId = layer[i];
      const position = startPos + i * this.config.nodeSpacing;
      
      if (isVertical) {
        this.nodePositions.set(nodeId, {
          x: position,
          y: layerPosition,
          layer: layerIndex,
          layerPosition: i
        });
      } else {
        this.nodePositions.set(nodeId, {
          x: layerPosition,
          y: position,
          layer: layerIndex,
          layerPosition: i
        });
      }
    }
  }
  
  /**
   * Calculate final coordinates with bounds adjustment
   */
  async _calculateCoordinates() {
    if (this.nodePositions.size === 0) return;
    
    // Find bounds of current positions
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    
    this.nodePositions.forEach(pos => {
      minX = Math.min(minX, pos.x);
      maxX = Math.max(maxX, pos.x);
      minY = Math.min(minY, pos.y);
      maxY = Math.max(maxY, pos.y);
    });
    
    // Calculate center of bounds
    const centerX = this.config.bounds.width / 2;
    const centerY = this.config.bounds.height / 2;
    const layoutCenterX = (minX + maxX) / 2;
    const layoutCenterY = (minY + maxY) / 2;
    
    // Apply offset to center the layout
    const offsetX = centerX - layoutCenterX;
    const offsetY = centerY - layoutCenterY;
    
    // Apply offset to all positions
    const finalPositions = new Map();
    this.nodePositions.forEach((pos, nodeId) => {
      finalPositions.set(nodeId, {
        x: pos.x + offsetX,
        y: pos.y + offsetY,
        layer: pos.layer,
        layerPosition: pos.layerPosition
      });
    });
    
    this.nodePositions = finalPositions;
  }
  
  /**
   * Route edges based on configuration
   */
  async _routeEdges(graphData) {
    for (const edge of graphData.edges) {
      const sourcePos = this.nodePositions.get(edge.source);
      const targetPos = this.nodePositions.get(edge.target);
      
      if (!sourcePos || !targetPos) continue;
      
      let path = [];
      
      if (this.config.edgeRouting === 'straight') {
        path = [
          { x: sourcePos.x, y: sourcePos.y },
          { x: targetPos.x, y: targetPos.y }
        ];
      } else if (this.config.edgeRouting === 'orthogonal') {
        // Create orthogonal path
        const isVertical = ['top-to-bottom', 'bottom-to-top'].includes(this.config.layerDirection);
        
        if (isVertical) {
          const midY = (sourcePos.y + targetPos.y) / 2;
          path = [
            { x: sourcePos.x, y: sourcePos.y },
            { x: sourcePos.x, y: midY },
            { x: targetPos.x, y: midY },
            { x: targetPos.x, y: targetPos.y }
          ];
        } else {
          const midX = (sourcePos.x + targetPos.x) / 2;
          path = [
            { x: sourcePos.x, y: sourcePos.y },
            { x: midX, y: sourcePos.y },
            { x: midX, y: targetPos.y },
            { x: targetPos.x, y: targetPos.y }
          ];
        }
      }
      
      this.edgePaths.set(edge.id, path);
    }
  }
  
  /**
   * Calculate layout bounds
   */
  _calculateLayoutBounds() {
    if (this.nodePositions.size === 0) {
      return { x: 0, y: 0, width: 0, height: 0 };
    }
    
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    
    this.nodePositions.forEach(pos => {
      minX = Math.min(minX, pos.x);
      maxX = Math.max(maxX, pos.x);
      minY = Math.min(minY, pos.y);
      maxY = Math.max(maxY, pos.y);
    });
    
    // Add padding for node sizes
    const padding = 50;
    return {
      x: minX - padding,
      y: minY - padding,
      width: maxX - minX + 2 * padding,
      height: maxY - minY + 2 * padding
    };
  }
  
  /**
   * Process edges for layout result
   */
  _processEdges(edges) {
    const edgeMap = new Map();
    
    edges.forEach(edge => {
      const path = this.edgePaths.get(edge.id) || [];
      
      edgeMap.set(edge.id, {
        id: edge.id,
        source: edge.source,
        target: edge.target,
        path,
        isFeedback: this.feedbackEdges.has(edge.id),
        isVirtual: edge.isVirtual || false,
        originalEdge: edge.originalEdge,
        data: edge
      });
    });
    
    return edgeMap;
  }
  
  /**
   * Helper function to check if arrays are equal
   */
  _arraysEqual(arr1, arr2) {
    if (arr1.length !== arr2.length) return false;
    return arr1.every((val, index) => val === arr2[index]);
  }
  
  /**
   * Get layout information
   */
  getLayoutInfo() {
    return {
      layerCount: this.layers.length,
      layers: this.layers.map((layer, index) => ({
        index,
        nodeCount: layer.nodes ? layer.nodes.length : layer.length,
        position: this.layerPositions.get(index)
      })),
      crossingCount: this.crossingCount,
      cycleCount: this.cycles.length,
      isDAG: this.isDAG,
      virtualNodeCount: this.virtualNodes.size,
      direction: this.config.layerDirection,
      totalNodes: this.nodePositions.size
    };
  }
  
  /**
   * Update configuration and clear caches
   */
  updateConfig(newConfig) {
    super.updateConfig(newConfig);
    
    // Clear cached calculations
    this._resetState();
  }
}

export default LayeredLayout;