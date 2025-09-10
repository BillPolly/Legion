/**
 * CircularLayout - Circular and radial layout plugin for arranging nodes in circular patterns
 * 
 * Provides multiple circular layout strategies:
 * - Simple circle layout with nodes arranged around a circle
 * - Concentric circles for hierarchical data
 * - Radial layout with nodes extending outward from center
 * - Arc-based layouts for partial circles
 * 
 * Ideal for displaying relationships, hierarchies, and network structures.
 */

import { BaseLayoutPlugin } from './BaseLayoutPlugin.js';

export class CircularLayout extends BaseLayoutPlugin {
  constructor(config = {}) {
    super(config);
    
    this.config = {
      ...this.config,
      
      // Circle configuration
      layoutType: config.layoutType || 'circle', // circle, concentric, radial, arc, spiral
      radius: config.radius || 200, // Base radius for circle layouts
      centerX: config.centerX || null, // Center X position (null for auto)
      centerY: config.centerY || null, // Center Y position (null for auto)
      
      // Angular configuration
      startAngle: config.startAngle || 0, // Starting angle in radians
      endAngle: config.endAngle || 2 * Math.PI, // Ending angle in radians
      clockwise: config.clockwise !== false, // Direction of arrangement
      
      // Concentric layout options
      ringCount: config.ringCount || 3, // Number of concentric rings
      ringSpacing: config.ringSpacing || 100, // Space between rings
      innerRadius: config.innerRadius || 50, // Radius of innermost ring
      
      // Radial layout options
      radialLevels: config.radialLevels || 5, // Number of radial levels
      levelSpacing: config.levelSpacing || 80, // Space between levels
      branchAngle: config.branchAngle || Math.PI / 6, // Angle between branches
      
      // Spiral layout options
      spiralTightness: config.spiralTightness || 0.5, // How tightly wound the spiral is
      spiralGrowthRate: config.spiralGrowthRate || 10, // How quickly spiral expands
      spiralTurns: config.spiralTurns || 3, // Number of spiral turns
      
      // Node arrangement
      nodeSpacing: config.nodeSpacing || 'equal', // equal, size-based, custom
      minNodeDistance: config.minNodeDistance || 30, // Minimum distance between nodes
      groupSeparation: config.groupSeparation || 50, // Extra space between groups
      
      // Hierarchy handling
      rootNode: config.rootNode || null, // ID of root node (for radial)
      levelBy: config.levelBy || null, // Property to determine hierarchy level
      sortBy: config.sortBy || null, // Property to sort nodes by
      
      // Visual options
      showCenter: config.showCenter !== false, // Whether to show center point
      labelOffset: config.labelOffset || 20, // Distance of labels from nodes
      
      ...config
    };
    
    // Layout state
    this.centerPoint = { x: 0, y: 0 };
    this.nodesByLevel = new Map(); // Map level to array of nodes
    this.nodeAngles = new Map(); // Map node ID to angle
    this.nodeRadii = new Map(); // Map node ID to radius
    this.hierarchy = new Map(); // Node hierarchy relationships
    this.rings = []; // Array of ring configurations
  }
  
  /**
   * Get plugin metadata
   */
  getMetadata() {
    return {
      name: 'circular-layout',
      version: '1.0.0',
      description: 'Circular and radial layouts with multiple arrangement patterns',
      author: 'ShowMe Module',
      category: 'geometric',
      capabilities: {
        directed: true,
        undirected: true,
        weighted: false,
        constraints: false,
        animation: true,
        hierarchical: true,
        radial: true
      }
    };
  }
  
  /**
   * Execute the circular layout algorithm
   */
  async _executeLayout(graphData) {
    const startTime = performance.now();
    
    try {
      // Calculate center point
      this._calculateCenterPoint();
      
      // Preprocess nodes (filtering, sorting, hierarchy)
      const processedNodes = this._preprocessNodes(graphData.nodes, graphData.edges || []);
      
      // Execute layout based on type
      let nodePositions;
      switch (this.config.layoutType) {
        case 'concentric':
          nodePositions = this._layoutConcentric(processedNodes);
          break;
        case 'radial':
          nodePositions = this._layoutRadial(processedNodes, graphData.edges || []);
          break;
        case 'arc':
          nodePositions = this._layoutArc(processedNodes);
          break;
        case 'spiral':
          nodePositions = this._layoutSpiral(processedNodes);
          break;
        default: // circle
          nodePositions = this._layoutCircle(processedNodes);
          break;
      }
      
      // Calculate layout bounds
      const bounds = this._calculateLayoutBounds(nodePositions);
      
      // Process edges
      const edges = this._processEdges(graphData.edges || []);
      
      const endTime = performance.now();
      
      return {
        positions: nodePositions,
        bounds,
        edges,
        metadata: {
          algorithm: 'circular',
          layoutType: this.config.layoutType,
          centerPoint: { ...this.centerPoint },
          nodeCount: processedNodes.length,
          radius: this.config.radius,
          rings: this.rings.length,
          levels: this.nodesByLevel.size,
          executionTime: endTime - startTime,
          config: {
            layoutType: this.config.layoutType,
            radius: this.config.radius,
            startAngle: this.config.startAngle,
            endAngle: this.config.endAngle
          }
        }
      };
      
    } catch (error) {
      console.error('Circular layout execution failed:', error);
      throw error;
    }
  }
  
  /**
   * Calculate center point for the layout
   */
  _calculateCenterPoint() {
    this.centerPoint = {
      x: this.config.centerX !== null ? this.config.centerX : this.config.bounds.width / 2,
      y: this.config.centerY !== null ? this.config.centerY : this.config.bounds.height / 2
    };
  }
  
  /**
   * Preprocess nodes (hierarchy, sorting, filtering)
   */
  _preprocessNodes(nodes, edges) {
    let processedNodes = [...nodes];
    
    // Apply sorting
    if (this.config.sortBy) {
      processedNodes.sort((a, b) => {
        const aVal = a[this.config.sortBy];
        const bVal = b[this.config.sortBy];
        
        if (aVal < bVal) return -1;
        if (aVal > bVal) return 1;
        return 0;
      });
    }
    
    // Build hierarchy if needed
    if (this.config.layoutType === 'radial' || this.config.layoutType === 'concentric') {
      this._buildHierarchy(processedNodes, edges);
    }
    
    return processedNodes;
  }
  
  /**
   * Build node hierarchy from edges
   */
  _buildHierarchy(nodes, edges) {
    this.hierarchy.clear();
    this.nodesByLevel.clear();
    
    // Create node map
    const nodeMap = new Map();
    nodes.forEach(node => {
      nodeMap.set(node.id, { ...node, children: [], parent: null, level: 0 });
    });
    
    // Build parent-child relationships
    edges.forEach(edge => {
      const parent = nodeMap.get(edge.source);
      const child = nodeMap.get(edge.target);
      
      if (parent && child) {
        parent.children.push(child);
        child.parent = parent;
      }
    });
    
    // Find root node
    let rootNode = null;
    if (this.config.rootNode) {
      rootNode = nodeMap.get(this.config.rootNode);
    } else {
      // Find node with no parent
      rootNode = Array.from(nodeMap.values()).find(node => !node.parent);
    }
    
    if (!rootNode && nodeMap.size > 0) {
      // Use first node as root if no clear root found
      rootNode = Array.from(nodeMap.values())[0];
    }
    
    // Assign levels using BFS
    if (rootNode) {
      const queue = [{ node: rootNode, level: 0 }];
      
      while (queue.length > 0) {
        const { node, level } = queue.shift();
        node.level = level;
        
        if (!this.nodesByLevel.has(level)) {
          this.nodesByLevel.set(level, []);
        }
        this.nodesByLevel.get(level).push(node);
        
        node.children.forEach(child => {
          queue.push({ node: child, level: level + 1 });
        });
      }
    }
    
    // Store hierarchy
    nodeMap.forEach((node, id) => {
      this.hierarchy.set(id, node);
    });
  }
  
  /**
   * Layout nodes in a simple circle
   */
  _layoutCircle(nodes) {
    const positions = new Map();
    
    if (nodes.length === 0) {
      return positions;
    }
    
    const angleRange = this.config.endAngle - this.config.startAngle;
    const angleStep = angleRange / nodes.length;
    
    nodes.forEach((node, index) => {
      const angle = this.config.startAngle + (this.config.clockwise ? index : nodes.length - 1 - index) * angleStep;
      
      const x = this.centerPoint.x + this.config.radius * Math.cos(angle);
      const y = this.centerPoint.y + this.config.radius * Math.sin(angle);
      
      positions.set(node.id, { x, y, angle, radius: this.config.radius });
      this.nodeAngles.set(node.id, angle);
      this.nodeRadii.set(node.id, this.config.radius);
    });
    
    return positions;
  }
  
  /**
   * Layout nodes in concentric circles
   */
  _layoutConcentric(nodes) {
    const positions = new Map();
    
    if (this.nodesByLevel.size === 0) {
      // If no hierarchy, distribute evenly across rings
      return this._layoutConcentricEven(nodes);
    }
    
    this.rings = [];
    
    // Layout each level in a separate ring
    let ringIndex = 0;
    for (const [level, levelNodes] of this.nodesByLevel) {
      const radius = this.config.innerRadius + ringIndex * this.config.ringSpacing;
      const ring = { level, radius, nodeCount: levelNodes.length };
      this.rings.push(ring);
      
      if (levelNodes.length === 1) {
        // Single node at center or ring center
        const x = this.centerPoint.x + (radius > 0 ? radius * Math.cos(0) : 0);
        const y = this.centerPoint.y + (radius > 0 ? radius * Math.sin(0) : 0);
        
        positions.set(levelNodes[0].id, { x, y, angle: 0, radius, level });
        this.nodeAngles.set(levelNodes[0].id, 0);
        this.nodeRadii.set(levelNodes[0].id, radius);
      } else {
        // Distribute nodes around the ring
        const angleStep = (2 * Math.PI) / levelNodes.length;
        
        levelNodes.forEach((node, index) => {
          const angle = this.config.startAngle + index * angleStep;
          
          const x = this.centerPoint.x + radius * Math.cos(angle);
          const y = this.centerPoint.y + radius * Math.sin(angle);
          
          positions.set(node.id, { x, y, angle, radius, level });
          this.nodeAngles.set(node.id, angle);
          this.nodeRadii.set(node.id, radius);
        });
      }
      
      ringIndex++;
    }
    
    return positions;
  }
  
  /**
   * Layout nodes in concentric circles without hierarchy
   */
  _layoutConcentricEven(nodes) {
    const positions = new Map();
    const nodesPerRing = Math.ceil(nodes.length / this.config.ringCount);
    
    this.rings = [];
    
    for (let ring = 0; ring < this.config.ringCount; ring++) {
      const startIndex = ring * nodesPerRing;
      const endIndex = Math.min((ring + 1) * nodesPerRing, nodes.length);
      const ringNodes = nodes.slice(startIndex, endIndex);
      
      if (ringNodes.length === 0) break;
      
      const radius = this.config.innerRadius + ring * this.config.ringSpacing;
      this.rings.push({ level: ring, radius, nodeCount: ringNodes.length });
      
      const angleStep = (2 * Math.PI) / ringNodes.length;
      
      ringNodes.forEach((node, index) => {
        const angle = this.config.startAngle + index * angleStep;
        
        const x = this.centerPoint.x + radius * Math.cos(angle);
        const y = this.centerPoint.y + radius * Math.sin(angle);
        
        positions.set(node.id, { x, y, angle, radius, level: ring });
        this.nodeAngles.set(node.id, angle);
        this.nodeRadii.set(node.id, radius);
      });
    }
    
    return positions;
  }
  
  /**
   * Layout nodes in radial pattern
   */
  _layoutRadial(nodes, edges) {
    const positions = new Map();
    
    if (this.nodesByLevel.size === 0) {
      // Fallback to circle layout
      return this._layoutCircle(nodes);
    }
    
    // Start with root at center
    const rootLevel = this.nodesByLevel.get(0);
    if (rootLevel && rootLevel.length > 0) {
      const rootNode = rootLevel[0];
      positions.set(rootNode.id, {
        x: this.centerPoint.x,
        y: this.centerPoint.y,
        angle: 0,
        radius: 0,
        level: 0
      });
    }
    
    // Layout each level radially
    for (let level = 1; level < this.nodesByLevel.size; level++) {
      const levelNodes = this.nodesByLevel.get(level) || [];
      const radius = level * this.config.levelSpacing;
      
      if (levelNodes.length === 1) {
        // Single node - place at arbitrary angle
        const angle = this.config.startAngle;
        const x = this.centerPoint.x + radius * Math.cos(angle);
        const y = this.centerPoint.y + radius * Math.sin(angle);
        
        positions.set(levelNodes[0].id, { x, y, angle, radius, level });
        this.nodeAngles.set(levelNodes[0].id, angle);
        this.nodeRadii.set(levelNodes[0].id, radius);
      } else {
        // Multiple nodes - distribute based on parent positions
        this._layoutRadialLevel(levelNodes, level, radius, positions);
      }
    }
    
    return positions;
  }
  
  /**
   * Layout nodes at a specific radial level
   */
  _layoutRadialLevel(levelNodes, level, radius, positions) {
    // Group nodes by parent
    const nodesByParent = new Map();
    
    levelNodes.forEach(node => {
      const parent = node.parent;
      const parentId = parent ? parent.id : 'root';
      
      if (!nodesByParent.has(parentId)) {
        nodesByParent.set(parentId, []);
      }
      nodesByParent.get(parentId).push(node);
    });
    
    // Calculate angular sections for each parent
    const totalSections = nodesByParent.size;
    const sectionAngle = (2 * Math.PI) / totalSections;
    
    let sectionIndex = 0;
    for (const [parentId, children] of nodesByParent) {
      const baseSectionAngle = this.config.startAngle + sectionIndex * sectionAngle;
      const childAngleStep = Math.min(sectionAngle * 0.8, this.config.branchAngle * 2) / Math.max(children.length, 1);
      const startChildAngle = baseSectionAngle - (children.length - 1) * childAngleStep / 2;
      
      children.forEach((child, childIndex) => {
        const angle = startChildAngle + childIndex * childAngleStep;
        
        const x = this.centerPoint.x + radius * Math.cos(angle);
        const y = this.centerPoint.y + radius * Math.sin(angle);
        
        positions.set(child.id, { x, y, angle, radius, level });
        this.nodeAngles.set(child.id, angle);
        this.nodeRadii.set(child.id, radius);
      });
      
      sectionIndex++;
    }
  }
  
  /**
   * Layout nodes in an arc
   */
  _layoutArc(nodes) {
    const positions = new Map();
    
    if (nodes.length === 0) {
      return positions;
    }
    
    const angleRange = this.config.endAngle - this.config.startAngle;
    const angleStep = nodes.length > 1 ? angleRange / (nodes.length - 1) : 0;
    
    nodes.forEach((node, index) => {
      const angle = this.config.startAngle + (this.config.clockwise ? index : nodes.length - 1 - index) * angleStep;
      
      const x = this.centerPoint.x + this.config.radius * Math.cos(angle);
      const y = this.centerPoint.y + this.config.radius * Math.sin(angle);
      
      positions.set(node.id, { x, y, angle, radius: this.config.radius });
      this.nodeAngles.set(node.id, angle);
      this.nodeRadii.set(node.id, this.config.radius);
    });
    
    return positions;
  }
  
  /**
   * Layout nodes in a spiral
   */
  _layoutSpiral(nodes) {
    const positions = new Map();
    
    if (nodes.length === 0) {
      return positions;
    }
    
    const totalAngle = this.config.spiralTurns * 2 * Math.PI;
    const angleStep = totalAngle / nodes.length;
    
    nodes.forEach((node, index) => {
      const angle = this.config.startAngle + index * angleStep;
      const radius = this.config.innerRadius + (index / nodes.length) * this.config.radius * this.config.spiralTightness;
      
      const x = this.centerPoint.x + radius * Math.cos(angle);
      const y = this.centerPoint.y + radius * Math.sin(angle);
      
      positions.set(node.id, { x, y, angle, radius });
      this.nodeAngles.set(node.id, angle);
      this.nodeRadii.set(node.id, radius);
    });
    
    return positions;
  }
  
  /**
   * Calculate layout bounds
   */
  _calculateLayoutBounds(positions) {
    if (positions.size === 0) {
      return { x: 0, y: 0, width: 0, height: 0 };
    }
    
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    
    positions.forEach(pos => {
      minX = Math.min(minX, pos.x);
      maxX = Math.max(maxX, pos.x);
      minY = Math.min(minY, pos.y);
      maxY = Math.max(maxY, pos.y);
    });
    
    // Add padding for node size
    const padding = 50;
    minX -= padding;
    maxX += padding;
    minY -= padding;
    maxY += padding;
    
    return {
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
   * Get angle for a node
   */
  getNodeAngle(nodeId) {
    return this.nodeAngles.get(nodeId) || 0;
  }
  
  /**
   * Get radius for a node
   */
  getNodeRadius(nodeId) {
    return this.nodeRadii.get(nodeId) || 0;
  }
  
  /**
   * Get layout information
   */
  getLayoutInfo() {
    return {
      centerPoint: { ...this.centerPoint },
      layoutType: this.config.layoutType,
      rings: [...this.rings],
      levels: this.nodesByLevel.size,
      totalRadius: this.config.radius,
      nodeCount: this.nodeAngles.size
    };
  }
  
  /**
   * Update configuration and clear caches
   */
  updateConfig(newConfig) {
    super.updateConfig(newConfig);
    
    // Clear cached calculations
    this.nodesByLevel.clear();
    this.nodeAngles.clear();
    this.nodeRadii.clear();
    this.hierarchy.clear();
    this.rings = [];
  }
}

export default CircularLayout;