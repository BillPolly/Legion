/**
 * Enhanced ForceDirectedLayout - Advanced physics-based graph layout
 * 
 * Extends the basic force-directed layout with additional force types:
 * - Variable charge forces based on node properties
 * - Custom attraction patterns
 * - Hierarchical forces
 * - Magnetic field simulation
 * - Gravity wells
 */

import { ForceDirectedLayout } from './ForceDirectedLayout.js';

export class EnhancedForceDirectedLayout extends ForceDirectedLayout {
  constructor(config = {}) {
    super(config);
    
    // Enhanced force configuration - ensure it exists
    const enhancedConfig = config.enhancedForces || {};
    this.config.enhancedForces = {
      // Variable charge based on node properties
      variableCharge: enhancedConfig.variableCharge !== false,
      chargeProperty: enhancedConfig.chargeProperty || 'degree', // degree, weight, custom
      
      // Hierarchical forces
      hierarchical: enhancedConfig.hierarchical || false,
      hierarchyStrength: enhancedConfig.hierarchyStrength || 0.1,
      hierarchyDirection: enhancedConfig.hierarchyDirection || 'vertical', // vertical, horizontal, radial
      
      // Magnetic field simulation
      magnetic: enhancedConfig.magnetic || false,
      magneticField: enhancedConfig.magneticField || { x: 0, y: -0.01 }, // Field vector
      magneticSusceptibility: enhancedConfig.magneticSusceptibility || 1,
      
      // Gravity wells (attractors/repulsors)
      gravityWells: enhancedConfig.gravityWells || [],
      
      // Group-based forces
      groupForce: enhancedConfig.groupForce || false,
      groupAttractionStrength: enhancedConfig.groupAttractionStrength || 0.1,
      groupRepulsionStrength: enhancedConfig.groupRepulsionStrength || -0.05,
      
      // Temperature-based cooling
      temperatureCooling: enhancedConfig.temperatureCooling || false,
      initialTemperature: enhancedConfig.initialTemperature || 1,
      coolingRate: enhancedConfig.coolingRate || 0.95,
      
      // Barnes-Hut optimization for charge forces
      barnesHutTheta: enhancedConfig.barnesHutTheta || 0.9,
      useBarnesHut: enhancedConfig.useBarnesHut || false,
      
      ...enhancedConfig
    };
    
    // Temperature for simulated annealing
    this.temperature = this.config.enhancedForces.initialTemperature;
    
    // Quadtree for Barnes-Hut optimization
    this.quadtree = null;
    
    // Node degree calculation cache
    this.nodeDegrees = new Map();
  }

  /**
   * Initialize enhanced forces
   * @private
   */
  _initializeForces() {
    super._initializeForces();
    
    // Replace or enhance standard forces
    if (this.config.enhancedForces.variableCharge) {
      this.forces.set('charge', this._createVariableChargeForce());
    }
    
    if (this.config.enhancedForces.hierarchical) {
      this.forces.set('hierarchy', this._createHierarchicalForce());
    }
    
    if (this.config.enhancedForces.magnetic) {
      this.forces.set('magnetic', this._createMagneticForce());
    }
    
    if (this.config.enhancedForces.gravityWells.length > 0) {
      this.forces.set('gravityWells', this._createGravityWellForce());
    }
    
    if (this.config.enhancedForces.groupForce) {
      this.forces.set('group', this._createGroupForce());
    }
    
    if (this.config.enhancedForces.useBarnesHut) {
      this.forces.set('charge', this._createBarnesHutForce());
    }
  }

  /**
   * Initialize simulation with enhanced features
   * @private
   */
  _initializeSimulation(graphData) {
    super._initializeSimulation(graphData);
    
    // Calculate node degrees for variable charge
    if (this.config.enhancedForces.variableCharge) {
      this._calculateNodeDegrees();
    }
    
    // Build quadtree for Barnes-Hut if needed
    if (this.config.enhancedForces.useBarnesHut) {
      this._buildQuadtree();
    }
    
    // Initialize temperature
    this.temperature = this.config.enhancedForces.initialTemperature;
    
    // Assign nodes to hierarchy levels if hierarchical
    if (this.config.enhancedForces.hierarchical) {
      this._assignHierarchyLevels(graphData);
    }
  }

  /**
   * Enhanced simulation tick with temperature cooling
   * @private
   */
  _simulationTick(isWarmup = false) {
    if (this.config.enhancedForces.temperatureCooling && !isWarmup) {
      // Apply temperature-based scaling to forces
      const tempScale = this.temperature;
      
      // Apply forces with temperature scaling
      this.forces.forEach((force, name) => {
        if (name !== 'center' && name !== 'collide') {
          // Scale force strength by temperature
          const originalForce = force;
          const scaledForce = (alpha) => {
            const scale = name === 'charge' ? tempScale : Math.sqrt(tempScale);
            return originalForce.call(this, alpha * scale);
          };
          scaledForce.call(this, this.alpha);
        } else {
          force.call(this, this.alpha);
        }
      });
      
      // Cool down temperature
      this.temperature *= this.config.enhancedForces.coolingRate;
    } else {
      super._simulationTick(isWarmup);
    }
  }

  /**
   * Create variable charge force based on node properties
   * @private
   */
  _createVariableChargeForce() {
    return (alpha) => {
      const nodes = Array.from(this.nodes.values());
      const theta = this.config.enhancedForces.barnesHutTheta;
      
      for (let i = 0; i < nodes.length; i++) {
        const node1 = nodes[i];
        const charge1 = this._getNodeCharge(node1);
        
        for (let j = i + 1; j < nodes.length; j++) {
          const node2 = nodes[j];
          const charge2 = this._getNodeCharge(node2);
          
          const dx = node2.x - node1.x || 0.001;
          const dy = node2.y - node1.y || 0.001;
          const distance = Math.sqrt(dx * dx + dy * dy);
          
          if (distance > this.config.chargeDistance) continue;
          
          // Variable charge based on node properties
          const force = alpha * charge1 * charge2 / (distance * distance);
          const fx = force * dx / distance;
          const fy = force * dy / distance;
          
          node1.vx -= fx / node1.mass;
          node1.vy -= fy / node1.mass;
          node2.vx += fx / node2.mass;
          node2.vy += fy / node2.mass;
        }
      }
    };
  }

  /**
   * Create hierarchical force for layered layouts
   * @private
   */
  _createHierarchicalForce() {
    return (alpha) => {
      const strength = this.config.enhancedForces.hierarchyStrength * alpha;
      const direction = this.config.enhancedForces.hierarchyDirection;
      
      this.nodes.forEach(node => {
        if (node.hierarchyLevel == null) return;
        
        const targetPosition = this._getHierarchyTargetPosition(node.hierarchyLevel);
        
        if (direction === 'vertical') {
          const dy = targetPosition.y - node.y;
          node.vy += dy * strength;
        } else if (direction === 'horizontal') {
          const dx = targetPosition.x - node.x;
          node.vx += dx * strength;
        } else if (direction === 'radial') {
          const angle = (node.hierarchyLevel / this.maxHierarchyLevel) * 2 * Math.PI;
          const radius = 100 + node.hierarchyLevel * 100;
          const targetX = radius * Math.cos(angle);
          const targetY = radius * Math.sin(angle);
          
          node.vx += (targetX - node.x) * strength;
          node.vy += (targetY - node.y) * strength;
        }
      });
    };
  }

  /**
   * Create magnetic field force
   * @private
   */
  _createMagneticForce() {
    return (alpha) => {
      const field = this.config.enhancedForces.magneticField;
      const susceptibility = this.config.enhancedForces.magneticSusceptibility;
      
      this.nodes.forEach(node => {
        // Magnetic force proportional to velocity (Lorentz force simulation)
        const crossProduct = node.vx * field.y - node.vy * field.x;
        const magneticForce = crossProduct * susceptibility * alpha;
        
        // Apply perpendicular force
        node.vx += field.y * magneticForce;
        node.vy -= field.x * magneticForce;
      });
    };
  }

  /**
   * Create gravity well force
   * @private
   */
  _createGravityWellForce() {
    return (alpha) => {
      const wells = this.config.enhancedForces.gravityWells;
      
      wells.forEach(well => {
        const wellStrength = well.strength || 100;
        const wellRadius = well.radius || Infinity;
        
        this.nodes.forEach(node => {
          const dx = well.x - node.x;
          const dy = well.y - node.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          
          if (distance < wellRadius && distance > 0) {
            // Gravity falls off with inverse square
            const force = wellStrength * alpha / (distance * distance);
            
            node.vx += force * dx / distance;
            node.vy += force * dy / distance;
          }
        });
      });
    };
  }

  /**
   * Create group-based attraction/repulsion force
   * @private
   */
  _createGroupForce() {
    return (alpha) => {
      const attractionStrength = this.config.enhancedForces.groupAttractionStrength * alpha;
      const repulsionStrength = this.config.enhancedForces.groupRepulsionStrength * alpha;
      
      const nodes = Array.from(this.nodes.values());
      
      for (let i = 0; i < nodes.length; i++) {
        const node1 = nodes[i];
        if (!node1.data.group) continue;
        
        for (let j = i + 1; j < nodes.length; j++) {
          const node2 = nodes[j];
          if (!node2.data.group) continue;
          
          const dx = node2.x - node1.x || 0.001;
          const dy = node2.y - node1.y || 0.001;
          const distance = Math.sqrt(dx * dx + dy * dy);
          
          // Same group: attraction, different groups: mild repulsion
          const strength = node1.data.group === node2.data.group 
            ? attractionStrength 
            : repulsionStrength;
          
          const force = strength / distance;
          const fx = force * dx;
          const fy = force * dy;
          
          node1.vx += fx;
          node1.vy += fy;
          node2.vx -= fx;
          node2.vy -= fy;
        }
      }
    };
  }

  /**
   * Create Barnes-Hut optimized charge force
   * @private
   */
  _createBarnesHutForce() {
    return (alpha) => {
      // Rebuild quadtree each tick
      this._buildQuadtree();
      
      const strength = this.config.chargeStrength * alpha;
      const theta = this.config.enhancedForces.barnesHutTheta;
      
      this.nodes.forEach(node => {
        this._applyBarnesHutForce(node, this.quadtree, strength, theta);
      });
    };
  }

  /**
   * Apply Barnes-Hut force recursively
   * @private
   */
  _applyBarnesHutForce(node, quadnode, strength, theta) {
    if (!quadnode) return;
    
    const dx = quadnode.x - node.x;
    const dy = quadnode.y - node.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    if (distance === 0) return;
    
    // If quadnode is a leaf or satisfies Barnes-Hut criterion
    if (!quadnode.children || quadnode.size / distance < theta) {
      const force = strength * quadnode.mass * node.mass / (distance * distance);
      node.vx -= force * dx / distance / node.mass;
      node.vy -= force * dy / distance / node.mass;
    } else {
      // Recursively apply force from children
      quadnode.children.forEach(child => {
        if (child) this._applyBarnesHutForce(node, child, strength, theta);
      });
    }
  }

  /**
   * Build quadtree for Barnes-Hut optimization
   * @private
   */
  _buildQuadtree() {
    // Find bounds
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    
    this.nodes.forEach(node => {
      minX = Math.min(minX, node.x);
      maxX = Math.max(maxX, node.x);
      minY = Math.min(minY, node.y);
      maxY = Math.max(maxY, node.y);
    });
    
    // Create root quadnode
    this.quadtree = {
      x: (minX + maxX) / 2,
      y: (minY + maxY) / 2,
      size: Math.max(maxX - minX, maxY - minY),
      mass: 0,
      children: null
    };
    
    // Insert all nodes
    this.nodes.forEach(node => {
      this._insertIntoQuadtree(this.quadtree, node);
    });
  }

  /**
   * Insert node into quadtree
   * @private
   */
  _insertIntoQuadtree(quadnode, node) {
    // Update center of mass
    const totalMass = quadnode.mass + node.mass;
    quadnode.x = (quadnode.x * quadnode.mass + node.x * node.mass) / totalMass;
    quadnode.y = (quadnode.y * quadnode.mass + node.y * node.mass) / totalMass;
    quadnode.mass = totalMass;
    
    // If leaf node, subdivide if necessary
    if (!quadnode.children) {
      if (quadnode.node) {
        // Subdivide
        quadnode.children = [null, null, null, null];
        const existingNode = quadnode.node;
        delete quadnode.node;
        
        this._insertIntoQuadtree(quadnode, existingNode);
        this._insertIntoQuadtree(quadnode, node);
      } else {
        // First node in this quadrant
        quadnode.node = node;
      }
    } else {
      // Find appropriate quadrant
      const halfSize = quadnode.size / 2;
      const quadIndex = 
        (node.x > quadnode.x ? 1 : 0) + 
        (node.y > quadnode.y ? 2 : 0);
      
      if (!quadnode.children[quadIndex]) {
        quadnode.children[quadIndex] = {
          x: quadnode.x + (quadIndex & 1 ? halfSize/2 : -halfSize/2),
          y: quadnode.y + (quadIndex & 2 ? halfSize/2 : -halfSize/2),
          size: halfSize,
          mass: 0,
          children: null
        };
      }
      
      this._insertIntoQuadtree(quadnode.children[quadIndex], node);
    }
  }

  /**
   * Calculate node degrees for variable charge
   * @private
   */
  _calculateNodeDegrees() {
    this.nodeDegrees.clear();
    
    // Count edges per node
    this.edges.forEach(edge => {
      const sourceDegree = this.nodeDegrees.get(edge.source) || 0;
      const targetDegree = this.nodeDegrees.get(edge.target) || 0;
      
      this.nodeDegrees.set(edge.source, sourceDegree + 1);
      this.nodeDegrees.set(edge.target, targetDegree + 1);
    });
  }

  /**
   * Get charge for a node based on properties
   * @private
   */
  _getNodeCharge(node) {
    const baseCharge = this.config.chargeStrength;
    
    if (!this.config.enhancedForces.variableCharge) {
      return baseCharge;
    }
    
    const property = this.config.enhancedForces.chargeProperty;
    
    if (property === 'degree') {
      const degree = this.nodeDegrees.get(node.id) || 1;
      return baseCharge * Math.sqrt(degree);
    } else if (property === 'weight' && node.data.weight != null) {
      return baseCharge * node.data.weight;
    } else if (property === 'custom' && node.data.charge != null) {
      return node.data.charge;
    }
    
    return baseCharge;
  }

  /**
   * Assign hierarchy levels to nodes
   * @private
   */
  _assignHierarchyLevels(graphData) {
    // Simple BFS to assign levels
    const visited = new Set();
    const queue = [];
    let maxLevel = 0;
    
    // Find root nodes (no incoming edges or specified as roots)
    const targetNodes = new Set();
    this.edges.forEach(edge => targetNodes.add(edge.target));
    
    this.nodes.forEach((node, nodeId) => {
      if (!targetNodes.has(nodeId) || node.data.isRoot) {
        node.hierarchyLevel = 0;
        queue.push(node);
        visited.add(nodeId);
      }
    });
    
    // BFS to assign levels
    while (queue.length > 0) {
      const current = queue.shift();
      
      this.edges.forEach(edge => {
        if (edge.source === current.id && !visited.has(edge.target)) {
          const targetNode = this.nodes.get(edge.target);
          if (targetNode) {
            targetNode.hierarchyLevel = current.hierarchyLevel + 1;
            maxLevel = Math.max(maxLevel, targetNode.hierarchyLevel);
            queue.push(targetNode);
            visited.add(edge.target);
          }
        }
      });
    }
    
    this.maxHierarchyLevel = maxLevel;
    
    // Assign level 0 to any unvisited nodes
    this.nodes.forEach((node, nodeId) => {
      if (!visited.has(nodeId)) {
        node.hierarchyLevel = 0;
      }
    });
  }

  /**
   * Get target position for hierarchy level
   * @private
   */
  _getHierarchyTargetPosition(level) {
    const direction = this.config.enhancedForces.hierarchyDirection;
    const spacing = 150;
    
    if (direction === 'vertical') {
      return {
        y: -this.config.bounds.height / 2 + spacing + level * spacing
      };
    } else if (direction === 'horizontal') {
      return {
        x: -this.config.bounds.width / 2 + spacing + level * spacing
      };
    }
    
    return { x: 0, y: 0 };
  }
}

export default EnhancedForceDirectedLayout;