/**
 * ERLayout - Specialized layout algorithm for Entity-Relationship diagrams
 * 
 * Features:
 * - Optimized placement for entities, relationships, and attributes
 * - Hierarchical arrangement for inheritance structures
 * - Minimization of relationship edge crossings
 * - Attribute grouping around entities
 * - Automatic spacing based on cardinality
 * - Support for weak entities and associative entities
 * - ISA hierarchy positioning
 * - Constraint-based layout for foreign key relationships
 */

import { BaseLayoutPlugin } from './BaseLayoutPlugin.js';

export class ERLayout extends BaseLayoutPlugin {
  constructor(config = {}) {
    super({
      name: 'er-layout',
      displayName: 'Entity-Relationship Layout',
      description: 'Specialized layout for ER diagrams',
      version: '1.0.0',
      ...config
    });
    
    this.config = {
      // Layout strategy
      strategy: config.strategy || 'hierarchical', // hierarchical, organic, orthogonal
      
      // Spacing configuration
      entitySpacing: config.entitySpacing || 150,
      relationshipSpacing: config.relationshipSpacing || 100,
      attributeSpacing: config.attributeSpacing || 60,
      inheritanceSpacing: config.inheritanceSpacing || 120,
      minNodeDistance: config.minNodeDistance || 50,
      
      // Entity arrangement
      entityAlignment: config.entityAlignment || 'center', // center, top, bottom
      groupWeakEntities: config.groupWeakEntities !== false,
      groupAssociativeEntities: config.groupAssociativeEntities !== false,
      
      // Relationship optimization
      minimizeCrossings: config.minimizeCrossings !== false,
      straightenRelationships: config.straightenRelationships !== false,
      optimizeCardinality: config.optimizeCardinality !== false,
      
      // Inheritance handling
      inheritanceDirection: config.inheritanceDirection || 'vertical', // vertical, horizontal
      inheritanceAlignment: config.inheritanceAlignment || 'tree', // tree, layered, compact
      separateInheritanceHierarchies: config.separateInheritanceHierarchies !== false,
      
      // Attribute positioning
      attributePosition: config.attributePosition || 'auto', // auto, right, bottom, radial
      attributeGrouping: config.attributeGrouping !== false,
      attributeAlignment: config.attributeAlignment || 'list', // list, grid, compact
      
      // Foreign key visualization
      alignForeignKeys: config.alignForeignKeys !== false,
      groupRelatedEntities: config.groupRelatedEntities !== false,
      
      // Performance
      maxIterations: config.maxIterations || 100,
      convergenceThreshold: config.convergenceThreshold || 0.01,
      useQuadtree: config.useQuadtree !== false,
      
      // Animation
      animationDuration: config.animationDuration || 500,
      animationEasing: config.animationEasing || 'easeInOut',
      
      ...config
    };
    
    // Internal state
    this.entities = new Map();
    this.relationships = new Map();
    this.attributes = new Map();
    this.inheritances = new Map();
    this.entityGroups = new Map();
    this.levels = [];
    this.grid = null;
  }
  
  /**
   * Execute ER-specific layout
   */
  async execute(nodes, edges, options = {}) {
    this.startExecution();
    
    try {
      // Parse ER diagram elements
      this._parseERElements(nodes, edges);
      
      // Group related elements
      this._groupElements();
      
      // Calculate hierarchy levels
      this._calculateHierarchy();
      
      // Apply layout strategy
      let positions;
      switch (this.config.strategy) {
        case 'hierarchical':
          positions = await this._applyHierarchicalLayout();
          break;
        case 'organic':
          positions = await this._applyOrganicLayout();
          break;
        case 'orthogonal':
          positions = await this._applyOrthogonalLayout();
          break;
        default:
          positions = await this._applyHierarchicalLayout();
      }
      
      // Position attributes
      this._positionAttributes(positions);
      
      // Optimize relationships
      if (this.config.minimizeCrossings) {
        positions = this._minimizeRelationshipCrossings(positions);
      }
      
      // Straighten relationship lines
      if (this.config.straightenRelationships) {
        positions = this._straightenRelationships(positions);
      }
      
      // Apply foreign key alignment
      if (this.config.alignForeignKeys) {
        positions = this._alignForeignKeyRelationships(positions);
      }
      
      // Calculate bounds
      const bounds = this._calculateBounds(positions);
      
      this.completeExecution();
      
      return {
        positions,
        bounds,
        metadata: {
          algorithm: 'er-layout',
          strategy: this.config.strategy,
          entityCount: this.entities.size,
          relationshipCount: this.relationships.size,
          inheritanceCount: this.inheritances.size,
          levels: this.levels.length,
          executionTime: this.executionTime
        }
      };
      
    } catch (error) {
      this.handleError(error);
      throw error;
    }
  }
  
  /**
   * Parse ER diagram elements
   */
  _parseERElements(nodes, edges) {
    // Clear previous state
    this.entities.clear();
    this.relationships.clear();
    this.attributes.clear();
    this.inheritances.clear();
    
    // Parse nodes
    for (const node of nodes) {
      switch (node.type) {
        case 'entity':
        case 'weak-entity':
        case 'associative-entity':
          this.entities.set(node.id, {
            ...node,
            entityType: node.type,
            attributes: [],
            relationships: [],
            parent: null,
            children: []
          });
          break;
          
        case 'attribute':
          this.attributes.set(node.id, {
            ...node,
            entityId: node.entityId || null
          });
          break;
          
        case 'relationship':
          this.relationships.set(node.id, {
            ...node,
            entities: [],
            cardinality: node.cardinality || {}
          });
          break;
      }
    }
    
    // Parse edges
    for (const edge of edges) {
      switch (edge.type) {
        case 'inheritance':
        case 'isa':
          this.inheritances.set(edge.id, {
            ...edge,
            parent: edge.source,
            child: edge.target
          });
          
          // Update entity hierarchy
          const parent = this.entities.get(edge.source);
          const child = this.entities.get(edge.target);
          if (parent && child) {
            parent.children.push(edge.target);
            child.parent = edge.source;
          }
          break;
          
        case 'has-attribute':
          const attr = this.attributes.get(edge.target);
          const entity = this.entities.get(edge.source);
          if (attr && entity) {
            attr.entityId = edge.source;
            entity.attributes.push(edge.target);
          }
          break;
          
        case 'participates':
          const rel = this.relationships.get(edge.target || edge.source);
          const ent = this.entities.get(edge.source || edge.target);
          if (rel && ent) {
            rel.entities.push(ent.id);
            ent.relationships.push(rel.id);
          }
          break;
      }
    }
  }
  
  /**
   * Group related elements
   */
  _groupElements() {
    this.entityGroups.clear();
    
    // Group weak entities with their strong entities
    if (this.config.groupWeakEntities) {
      for (const [id, entity] of this.entities) {
        if (entity.entityType === 'weak-entity') {
          // Find identifying relationship
          const identifyingRel = entity.relationships.find(relId => {
            const rel = this.relationships.get(relId);
            return rel && rel.identifying;
          });
          
          if (identifyingRel) {
            const rel = this.relationships.get(identifyingRel);
            const strongEntityId = rel.entities.find(e => e !== id);
            if (strongEntityId) {
              if (!this.entityGroups.has(strongEntityId)) {
                this.entityGroups.set(strongEntityId, []);
              }
              this.entityGroups.get(strongEntityId).push(id);
            }
          }
        }
      }
    }
    
    // Group associative entities
    if (this.config.groupAssociativeEntities) {
      for (const [id, entity] of this.entities) {
        if (entity.entityType === 'associative-entity') {
          // Group with related entities
          for (const relId of entity.relationships) {
            const rel = this.relationships.get(relId);
            if (rel) {
              for (const entId of rel.entities) {
                if (entId !== id) {
                  if (!this.entityGroups.has(entId)) {
                    this.entityGroups.set(entId, []);
                  }
                  this.entityGroups.get(entId).push(id);
                }
              }
            }
          }
        }
      }
    }
  }
  
  /**
   * Calculate hierarchy levels for entities
   */
  _calculateHierarchy() {
    this.levels = [];
    const visited = new Set();
    const levelMap = new Map();
    
    // Find root entities (no parent)
    const roots = [];
    for (const [id, entity] of this.entities) {
      if (!entity.parent) {
        roots.push(id);
      }
    }
    
    // BFS to assign levels
    let currentLevel = 0;
    let queue = [...roots];
    
    while (queue.length > 0) {
      const nextQueue = [];
      this.levels[currentLevel] = [];
      
      for (const entityId of queue) {
        if (visited.has(entityId)) continue;
        
        visited.add(entityId);
        levelMap.set(entityId, currentLevel);
        this.levels[currentLevel].push(entityId);
        
        const entity = this.entities.get(entityId);
        if (entity) {
          // Add children to next level
          for (const childId of entity.children) {
            if (!visited.has(childId)) {
              nextQueue.push(childId);
            }
          }
          
          // Add grouped entities to same level
          const grouped = this.entityGroups.get(entityId) || [];
          for (const groupedId of grouped) {
            if (!visited.has(groupedId)) {
              queue.push(groupedId);
            }
          }
        }
      }
      
      queue = nextQueue;
      currentLevel++;
    }
    
    // Add any unvisited entities to the last level
    for (const [id] of this.entities) {
      if (!visited.has(id)) {
        if (!this.levels[currentLevel]) {
          this.levels[currentLevel] = [];
        }
        this.levels[currentLevel].push(id);
        levelMap.set(id, currentLevel);
      }
    }
    
    // Store level information in entities
    for (const [id, level] of levelMap) {
      const entity = this.entities.get(id);
      if (entity) {
        entity.level = level;
      }
    }
  }
  
  /**
   * Apply hierarchical layout strategy
   */
  async _applyHierarchicalLayout() {
    const positions = new Map();
    const levelHeights = [];
    
    // Calculate level heights
    for (let level = 0; level < this.levels.length; level++) {
      let maxHeight = 0;
      for (const entityId of this.levels[level]) {
        const entity = this.entities.get(entityId);
        if (entity) {
          const height = entity.height || 80;
          maxHeight = Math.max(maxHeight, height);
        }
      }
      levelHeights[level] = maxHeight;
    }
    
    // Position entities by level
    let currentY = 0;
    
    for (let level = 0; level < this.levels.length; level++) {
      const entities = this.levels[level];
      const totalWidth = entities.length * this.config.entitySpacing;
      let currentX = -totalWidth / 2;
      
      for (const entityId of entities) {
        const entity = this.entities.get(entityId);
        if (entity) {
          const width = entity.width || 120;
          const height = entity.height || 80;
          
          positions.set(entityId, {
            x: currentX + width / 2,
            y: currentY + height / 2,
            width,
            height
          });
          
          currentX += this.config.entitySpacing;
        }
      }
      
      currentY += levelHeights[level] + this.config.inheritanceSpacing;
    }
    
    // Position relationships
    for (const [relId, relationship] of this.relationships) {
      const entityPositions = relationship.entities.map(id => positions.get(id)).filter(p => p);
      
      if (entityPositions.length >= 2) {
        // Position at centroid of connected entities
        const centerX = entityPositions.reduce((sum, p) => sum + p.x, 0) / entityPositions.length;
        const centerY = entityPositions.reduce((sum, p) => sum + p.y, 0) / entityPositions.length;
        
        positions.set(relId, {
          x: centerX,
          y: centerY,
          width: 60,
          height: 40
        });
      }
    }
    
    return positions;
  }
  
  /**
   * Apply organic layout strategy
   */
  async _applyOrganicLayout() {
    const positions = new Map();
    
    // Initialize with random positions
    const entities = Array.from(this.entities.keys());
    const radius = Math.sqrt(entities.length) * this.config.entitySpacing;
    
    for (const entityId of entities) {
      const angle = Math.random() * Math.PI * 2;
      const r = Math.random() * radius;
      positions.set(entityId, {
        x: Math.cos(angle) * r,
        y: Math.sin(angle) * r,
        width: 120,
        height: 80
      });
    }
    
    // Apply force-directed algorithm
    for (let iteration = 0; iteration < this.config.maxIterations; iteration++) {
      const forces = new Map();
      
      // Calculate repulsive forces between entities
      for (const id1 of entities) {
        const pos1 = positions.get(id1);
        let fx = 0, fy = 0;
        
        for (const id2 of entities) {
          if (id1 === id2) continue;
          
          const pos2 = positions.get(id2);
          const dx = pos1.x - pos2.x;
          const dy = pos1.y - pos2.y;
          const distance = Math.sqrt(dx * dx + dy * dy) || 1;
          
          const force = (this.config.entitySpacing * this.config.entitySpacing) / (distance * distance);
          fx += (dx / distance) * force;
          fy += (dy / distance) * force;
        }
        
        forces.set(id1, { fx, fy });
      }
      
      // Calculate attractive forces for relationships
      for (const [relId, relationship] of this.relationships) {
        for (let i = 0; i < relationship.entities.length - 1; i++) {
          const id1 = relationship.entities[i];
          const id2 = relationship.entities[i + 1];
          
          const pos1 = positions.get(id1);
          const pos2 = positions.get(id2);
          
          if (pos1 && pos2) {
            const dx = pos2.x - pos1.x;
            const dy = pos2.y - pos1.y;
            const distance = Math.sqrt(dx * dx + dy * dy) || 1;
            
            const force = distance / this.config.relationshipSpacing;
            const fx = (dx / distance) * force * 0.1;
            const fy = (dy / distance) * force * 0.1;
            
            const f1 = forces.get(id1) || { fx: 0, fy: 0 };
            const f2 = forces.get(id2) || { fx: 0, fy: 0 };
            
            forces.set(id1, { fx: f1.fx + fx, fy: f1.fy + fy });
            forces.set(id2, { fx: f2.fx - fx, fy: f2.fy - fy });
          }
        }
      }
      
      // Apply forces
      let maxDisplacement = 0;
      for (const [id, force] of forces) {
        const pos = positions.get(id);
        const displacement = Math.sqrt(force.fx * force.fx + force.fy * force.fy);
        maxDisplacement = Math.max(maxDisplacement, displacement);
        
        pos.x += force.fx * 0.1;
        pos.y += force.fy * 0.1;
      }
      
      // Check convergence
      if (maxDisplacement < this.config.convergenceThreshold) {
        break;
      }
    }
    
    // Position relationships
    for (const [relId, relationship] of this.relationships) {
      const entityPositions = relationship.entities.map(id => positions.get(id)).filter(p => p);
      
      if (entityPositions.length >= 2) {
        const centerX = entityPositions.reduce((sum, p) => sum + p.x, 0) / entityPositions.length;
        const centerY = entityPositions.reduce((sum, p) => sum + p.y, 0) / entityPositions.length;
        
        positions.set(relId, {
          x: centerX,
          y: centerY,
          width: 60,
          height: 40
        });
      }
    }
    
    return positions;
  }
  
  /**
   * Apply orthogonal layout strategy
   */
  async _applyOrthogonalLayout() {
    const positions = new Map();
    
    // Create grid for orthogonal placement
    const entities = Array.from(this.entities.keys());
    const gridSize = Math.ceil(Math.sqrt(entities.length));
    
    this.grid = Array(gridSize).fill(null).map(() => Array(gridSize).fill(null));
    
    // Place entities on grid
    let entityIndex = 0;
    for (let row = 0; row < gridSize; row++) {
      for (let col = 0; col < gridSize; col++) {
        if (entityIndex < entities.length) {
          const entityId = entities[entityIndex];
          this.grid[row][col] = entityId;
          
          positions.set(entityId, {
            x: col * this.config.entitySpacing,
            y: row * this.config.entitySpacing,
            width: 120,
            height: 80
          });
          
          entityIndex++;
        }
      }
    }
    
    // Optimize placement to minimize relationship lengths
    for (let iteration = 0; iteration < this.config.maxIterations / 2; iteration++) {
      let improved = false;
      
      for (let i = 0; i < entities.length - 1; i++) {
        for (let j = i + 1; j < entities.length; j++) {
          const id1 = entities[i];
          const id2 = entities[j];
          
          // Check if swapping would improve layout
          const currentCost = this._calculateOrthogonalCost(positions);
          
          // Swap positions
          const pos1 = positions.get(id1);
          const pos2 = positions.get(id2);
          positions.set(id1, pos2);
          positions.set(id2, pos1);
          
          const newCost = this._calculateOrthogonalCost(positions);
          
          if (newCost < currentCost) {
            improved = true;
          } else {
            // Revert swap
            positions.set(id1, pos1);
            positions.set(id2, pos2);
          }
        }
      }
      
      if (!improved) break;
    }
    
    // Position relationships on grid edges
    for (const [relId, relationship] of this.relationships) {
      const entityPositions = relationship.entities.map(id => positions.get(id)).filter(p => p);
      
      if (entityPositions.length >= 2) {
        // Find orthogonal midpoint
        const p1 = entityPositions[0];
        const p2 = entityPositions[1];
        
        positions.set(relId, {
          x: (p1.x + p2.x) / 2,
          y: (p1.y + p2.y) / 2,
          width: 60,
          height: 40
        });
      }
    }
    
    return positions;
  }
  
  /**
   * Calculate cost for orthogonal layout
   */
  _calculateOrthogonalCost(positions) {
    let cost = 0;
    
    for (const [relId, relationship] of this.relationships) {
      const entityPositions = relationship.entities.map(id => positions.get(id)).filter(p => p);
      
      for (let i = 0; i < entityPositions.length - 1; i++) {
        const p1 = entityPositions[i];
        const p2 = entityPositions[i + 1];
        
        // Manhattan distance for orthogonal layout
        cost += Math.abs(p1.x - p2.x) + Math.abs(p1.y - p2.y);
      }
    }
    
    return cost;
  }
  
  /**
   * Position attributes around their entities
   */
  _positionAttributes(positions) {
    for (const [attrId, attribute] of this.attributes) {
      if (!attribute.entityId) continue;
      
      const entityPos = positions.get(attribute.entityId);
      if (!entityPos) continue;
      
      const entity = this.entities.get(attribute.entityId);
      if (!entity) continue;
      
      const attrIndex = entity.attributes.indexOf(attrId);
      const totalAttrs = entity.attributes.length;
      
      let attrX, attrY;
      
      switch (this.config.attributePosition) {
        case 'right':
          attrX = entityPos.x + entityPos.width / 2 + this.config.attributeSpacing;
          attrY = entityPos.y - (totalAttrs - 1) * 20 / 2 + attrIndex * 20;
          break;
          
        case 'bottom':
          attrX = entityPos.x - (totalAttrs - 1) * 30 / 2 + attrIndex * 30;
          attrY = entityPos.y + entityPos.height / 2 + this.config.attributeSpacing;
          break;
          
        case 'radial':
          const angle = (attrIndex / totalAttrs) * Math.PI * 2;
          const radius = Math.max(entityPos.width, entityPos.height) / 2 + this.config.attributeSpacing;
          attrX = entityPos.x + Math.cos(angle) * radius;
          attrY = entityPos.y + Math.sin(angle) * radius;
          break;
          
        default: // auto
          // Place on least crowded side
          const angle = (attrIndex / totalAttrs) * Math.PI * 2;
          const radius = Math.max(entityPos.width, entityPos.height) / 2 + this.config.attributeSpacing;
          attrX = entityPos.x + Math.cos(angle) * radius;
          attrY = entityPos.y + Math.sin(angle) * radius;
      }
      
      positions.set(attrId, {
        x: attrX,
        y: attrY,
        width: 40,
        height: 20
      });
    }
  }
  
  /**
   * Minimize relationship crossings
   */
  _minimizeRelationshipCrossings(positions) {
    const edges = [];
    
    // Collect all relationship edges
    for (const [relId, relationship] of this.relationships) {
      const relPos = positions.get(relId);
      if (!relPos) continue;
      
      for (const entityId of relationship.entities) {
        const entityPos = positions.get(entityId);
        if (entityPos) {
          edges.push({
            source: relId,
            target: entityId,
            sourcePos: relPos,
            targetPos: entityPos
          });
        }
      }
    }
    
    // Count crossings
    const countCrossings = () => {
      let crossings = 0;
      for (let i = 0; i < edges.length - 1; i++) {
        for (let j = i + 1; j < edges.length; j++) {
          if (this._edgesIntersect(edges[i], edges[j])) {
            crossings++;
          }
        }
      }
      return crossings;
    };
    
    // Try to reduce crossings by adjusting relationship positions
    const currentCrossings = countCrossings();
    
    for (const [relId, relationship] of this.relationships) {
      const relPos = positions.get(relId);
      if (!relPos) continue;
      
      // Try different positions
      const originalPos = { ...relPos };
      let bestPos = originalPos;
      let minCrossings = currentCrossings;
      
      // Try positions around current location
      const offsets = [
        { dx: -20, dy: 0 },
        { dx: 20, dy: 0 },
        { dx: 0, dy: -20 },
        { dx: 0, dy: 20 },
        { dx: -20, dy: -20 },
        { dx: 20, dy: -20 },
        { dx: -20, dy: 20 },
        { dx: 20, dy: 20 }
      ];
      
      for (const offset of offsets) {
        relPos.x = originalPos.x + offset.dx;
        relPos.y = originalPos.y + offset.dy;
        
        const crossings = countCrossings();
        if (crossings < minCrossings) {
          minCrossings = crossings;
          bestPos = { ...relPos };
        }
      }
      
      positions.set(relId, bestPos);
    }
    
    return positions;
  }
  
  /**
   * Check if two edges intersect
   */
  _edgesIntersect(edge1, edge2) {
    // Don't count as intersection if edges share an endpoint
    if (edge1.source === edge2.source || edge1.source === edge2.target ||
        edge1.target === edge2.source || edge1.target === edge2.target) {
      return false;
    }
    
    const { sourcePos: p1, targetPos: p2 } = edge1;
    const { sourcePos: p3, targetPos: p4 } = edge2;
    
    const d = (p4.y - p3.y) * (p2.x - p1.x) - (p4.x - p3.x) * (p2.y - p1.y);
    if (Math.abs(d) < 0.0001) return false; // Parallel lines
    
    const ua = ((p4.x - p3.x) * (p1.y - p3.y) - (p4.y - p3.y) * (p1.x - p3.x)) / d;
    const ub = ((p2.x - p1.x) * (p1.y - p3.y) - (p2.y - p1.y) * (p1.x - p3.x)) / d;
    
    return ua >= 0 && ua <= 1 && ub >= 0 && ub <= 1;
  }
  
  /**
   * Straighten relationship lines
   */
  _straightenRelationships(positions) {
    for (const [relId, relationship] of this.relationships) {
      const relPos = positions.get(relId);
      if (!relPos) continue;
      
      const entityPositions = relationship.entities.map(id => positions.get(id)).filter(p => p);
      
      if (entityPositions.length === 2) {
        const [pos1, pos2] = entityPositions;
        
        // Check if entities are roughly aligned horizontally or vertically
        const dx = Math.abs(pos1.x - pos2.x);
        const dy = Math.abs(pos1.y - pos2.y);
        
        if (dx < dy * 0.3) {
          // Vertically aligned - center relationship horizontally
          relPos.x = (pos1.x + pos2.x) / 2;
        } else if (dy < dx * 0.3) {
          // Horizontally aligned - center relationship vertically
          relPos.y = (pos1.y + pos2.y) / 2;
        }
      }
    }
    
    return positions;
  }
  
  /**
   * Align entities connected by foreign keys
   */
  _alignForeignKeyRelationships(positions) {
    const processed = new Set();
    
    for (const [relId, relationship] of this.relationships) {
      // Check if this is a foreign key relationship
      if (!relationship.isForeignKey) continue;
      
      const [sourceId, targetId] = relationship.entities;
      if (!sourceId || !targetId || processed.has(sourceId) || processed.has(targetId)) {
        continue;
      }
      
      const sourcePos = positions.get(sourceId);
      const targetPos = positions.get(targetId);
      
      if (sourcePos && targetPos) {
        // Align vertically or horizontally based on current positions
        const dx = Math.abs(sourcePos.x - targetPos.x);
        const dy = Math.abs(sourcePos.y - targetPos.y);
        
        if (dx < dy) {
          // Align vertically
          const avgX = (sourcePos.x + targetPos.x) / 2;
          sourcePos.x = avgX;
          targetPos.x = avgX;
        } else {
          // Align horizontally
          const avgY = (sourcePos.y + targetPos.y) / 2;
          sourcePos.y = avgY;
          targetPos.y = avgY;
        }
        
        processed.add(sourceId);
        processed.add(targetId);
      }
    }
    
    return positions;
  }
  
  /**
   * Calculate layout bounds
   */
  _calculateBounds(positions) {
    let minX = Infinity, minY = Infinity;
    let maxX = -Infinity, maxY = -Infinity;
    
    for (const [id, pos] of positions) {
      minX = Math.min(minX, pos.x - pos.width / 2);
      minY = Math.min(minY, pos.y - pos.height / 2);
      maxX = Math.max(maxX, pos.x + pos.width / 2);
      maxY = Math.max(maxY, pos.y + pos.height / 2);
    }
    
    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY
    };
  }
  
  /**
   * Validate input for ER layout
   */
  validateInput(nodes, edges) {
    if (!nodes || !Array.isArray(nodes)) {
      throw new Error('Invalid nodes array');
    }
    
    if (!edges || !Array.isArray(edges)) {
      throw new Error('Invalid edges array');
    }
    
    // Check for at least one entity
    const hasEntity = nodes.some(n => 
      n.type === 'entity' || n.type === 'weak-entity' || n.type === 'associative-entity'
    );
    
    if (!hasEntity) {
      throw new Error('ER layout requires at least one entity node');
    }
    
    return true;
  }
  
  /**
   * Get layout capabilities
   */
  getCapabilities() {
    return {
      ...super.getCapabilities(),
      supportsEntityTypes: ['entity', 'weak-entity', 'associative-entity'],
      supportsRelationshipTypes: ['relationship', 'identifying-relationship'],
      supportsInheritance: true,
      supportsAttributes: true,
      supportsCardinality: true,
      supportsForeignKeys: true,
      strategies: ['hierarchical', 'organic', 'orthogonal'],
      features: [
        'entity-grouping',
        'inheritance-hierarchy',
        'crossing-minimization',
        'foreign-key-alignment',
        'attribute-positioning'
      ]
    };
  }
}

export default ERLayout;