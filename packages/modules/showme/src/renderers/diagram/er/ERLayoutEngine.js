/**
 * ERLayoutEngine
 * 
 * Advanced layout algorithms specifically designed for Entity-Relationship diagrams
 * Provides optimized layouts for complex ER structures including inheritance hierarchies
 */

export class ERLayoutEngine {
  constructor(config = {}) {
    this.config = {
      // Layout algorithms
      defaultAlgorithm: config.defaultAlgorithm || 'hierarchical-er',
      algorithms: config.algorithms || [
        'hierarchical-er',
        'radial-er', 
        'layered-er',
        'constraint-based-er'
      ],
      
      // Entity positioning
      entitySpacing: config.entitySpacing || 150,
      levelSpacing: config.levelSpacing || 120,
      clusterSpacing: config.clusterSpacing || 200,
      
      // Relationship routing
      relationshipRouting: config.relationshipRouting || 'orthogonal', // orthogonal, curved, straight
      avoidOverlaps: config.avoidOverlaps !== false,
      minimizeCrossings: config.minimizeCrossings !== false,
      
      // Entity clustering
      enableClustering: config.enableClustering !== false,
      clusterByStrongEntity: config.clusterByStrongEntity !== false,
      clusterByModule: config.clusterByModule === true,
      
      // Inheritance layout
      inheritanceDirection: config.inheritanceDirection || 'top-down', // top-down, bottom-up, left-right
      inheritanceSpacing: config.inheritanceSpacing || 100,
      
      // Weak entity positioning
      keepWeakEntitiesClose: config.keepWeakEntitiesClose !== false,
      weakEntityOffset: config.weakEntityOffset || 80,
      
      // Optimization
      maxIterations: config.maxIterations || 200,
      convergenceThreshold: config.convergenceThreshold || 0.01,
      useForceDirected: config.useForceDirected !== false,
      
      // Layout constraints
      maintainAspectRatio: config.maintainAspectRatio !== false,
      preferredAspectRatio: config.preferredAspectRatio || 1.5,
      
      ...config
    };
    
    this.layoutCache = new Map();
    this.constraintSolver = null;
  }
  
  /**
   * Calculate layout for ER diagram
   */
  calculateLayout(diagram, containerBounds) {
    const cacheKey = this._generateCacheKey(diagram, containerBounds);
    if (this.layoutCache.has(cacheKey)) {
      return this.layoutCache.get(cacheKey);
    }
    
    // Parse diagram elements
    const elements = this._parseERDiagram(diagram);
    
    // Select appropriate algorithm
    const algorithm = this._selectLayoutAlgorithm(elements);
    
    // Calculate layout
    let layout;
    switch (algorithm) {
      case 'hierarchical-er':
        layout = this._calculateHierarchicalERLayout(elements, containerBounds);
        break;
      case 'radial-er':
        layout = this._calculateRadialERLayout(elements, containerBounds);
        break;
      case 'layered-er':
        layout = this._calculateLayeredERLayout(elements, containerBounds);
        break;
      case 'constraint-based-er':
        layout = this._calculateConstraintBasedERLayout(elements, containerBounds);
        break;
      default:
        layout = this._calculateHierarchicalERLayout(elements, containerBounds);
    }
    
    // Apply post-processing optimizations
    layout = this._optimizeLayout(layout, elements, containerBounds);
    
    this.layoutCache.set(cacheKey, layout);
    return layout;
  }
  
  /**
   * Parse ER diagram into structured elements
   * @private
   */
  _parseERDiagram(diagram) {
    const entities = [];
    const relationships = [];
    const attributes = [];
    const inheritances = [];
    
    // Extract entities
    if (diagram.entities) {
      entities.push(...diagram.entities);
    } else if (diagram.nodes) {
      entities.push(...diagram.nodes.filter(n => 
        n.type && (n.type.includes('entity') || n.type === 'weak-entity')
      ));
    }
    
    // Extract relationships
    if (diagram.relationships) {
      relationships.push(...diagram.relationships);
    } else if (diagram.edges) {
      relationships.push(...diagram.edges.filter(e => 
        e.type === 'relationship' || e.type === 'identifying-relationship'
      ));
      
      // Extract inheritances
      inheritances.push(...diagram.edges.filter(e => 
        e.type === 'inheritance' || e.type === 'isa'
      ));
    }
    
    // Extract attributes
    if (diagram.attributes) {
      attributes.push(...diagram.attributes);
    } else if (diagram.nodes) {
      attributes.push(...diagram.nodes.filter(n => n.type === 'attribute'));
    }
    
    return {
      entities,
      relationships, 
      attributes,
      inheritances,
      strongEntities: entities.filter(e => e.type !== 'weak-entity'),
      weakEntities: entities.filter(e => e.type === 'weak-entity')
    };
  }
  
  /**
   * Select optimal layout algorithm based on diagram characteristics
   * @private
   */
  _selectLayoutAlgorithm(elements) {
    const { entities, relationships, inheritances } = elements;
    
    // Use hierarchical for inheritance-heavy diagrams
    if (inheritances.length > entities.length * 0.3) {
      return 'hierarchical-er';
    }
    
    // Use radial for highly connected diagrams
    const avgConnections = relationships.length * 2 / entities.length;
    if (avgConnections > 3) {
      return 'radial-er';
    }
    
    // Use layered for linear flow diagrams
    const hasLinearFlow = this._detectLinearFlow(elements);
    if (hasLinearFlow) {
      return 'layered-er';
    }
    
    // Default to constraint-based for complex diagrams
    if (entities.length > 20 || relationships.length > 30) {
      return 'constraint-based-er';
    }
    
    return this.config.defaultAlgorithm;
  }
  
  /**
   * Calculate hierarchical ER layout
   * @private
   */
  _calculateHierarchicalERLayout(elements, containerBounds) {
    const { entities, relationships, inheritances, strongEntities, weakEntities } = elements;
    const positions = new Map();
    
    // Build hierarchy tree
    const hierarchy = this._buildEntityHierarchy(entities, inheritances);
    
    // Position strong entities in hierarchy levels
    const levels = this._calculateHierarchyLevels(hierarchy);
    let currentY = containerBounds.y + 50;
    
    for (let i = 0; i < levels.length; i++) {
      const level = levels[i];
      const levelWidth = level.length * this.config.entitySpacing;
      let currentX = containerBounds.x + (containerBounds.width - levelWidth) / 2;
      
      for (const entity of level) {
        positions.set(entity.id, {
          x: currentX + this.config.entitySpacing / 2,
          y: currentY + 40,
          width: entity.width || 120,
          height: entity.height || 80
        });
        
        currentX += this.config.entitySpacing;
      }
      
      currentY += this.config.levelSpacing;
    }
    
    // Position weak entities near their strong entity dependencies
    for (const weakEntity of weakEntities) {
      const strongEntityId = this._findStrongEntityDependency(weakEntity, relationships);
      if (strongEntityId && positions.has(strongEntityId)) {
        const strongPos = positions.get(strongEntityId);
        positions.set(weakEntity.id, {
          x: strongPos.x + this.config.weakEntityOffset,
          y: strongPos.y + this.config.weakEntityOffset,
          width: weakEntity.width || 120,
          height: weakEntity.height || 80
        });
      }
    }
    
    // Position relationship nodes
    this._positionRelationshipNodes(relationships, positions);
    
    return {
      entities: positions,
      relationships: this._calculateRelationshipPaths(relationships, positions),
      bounds: this._calculateLayoutBounds(positions)
    };
  }
  
  /**
   * Calculate radial ER layout
   * @private
   */
  _calculateRadialERLayout(elements, containerBounds) {
    const { entities, relationships } = elements;
    const positions = new Map();
    
    // Find central entity (most connected)
    const centralEntity = this._findCentralEntity(entities, relationships);
    const centerX = containerBounds.x + containerBounds.width / 2;
    const centerY = containerBounds.y + containerBounds.height / 2;
    
    // Position central entity
    positions.set(centralEntity.id, {
      x: centerX,
      y: centerY,
      width: centralEntity.width || 120,
      height: centralEntity.height || 80
    });
    
    // Calculate concentric rings
    const rings = this._calculateConcentricRings(centralEntity, entities, relationships);
    
    for (let ringIndex = 0; ringIndex < rings.length; ringIndex++) {
      const ring = rings[ringIndex];
      const radius = (ringIndex + 1) * this.config.entitySpacing;
      const angleStep = (2 * Math.PI) / ring.length;
      
      for (let i = 0; i < ring.length; i++) {
        const entity = ring[i];
        const angle = i * angleStep;
        
        positions.set(entity.id, {
          x: centerX + radius * Math.cos(angle),
          y: centerY + radius * Math.sin(angle),
          width: entity.width || 120,
          height: entity.height || 80
        });
      }
    }
    
    return {
      entities: positions,
      relationships: this._calculateRelationshipPaths(relationships, positions),
      bounds: this._calculateLayoutBounds(positions)
    };
  }
  
  /**
   * Calculate layered ER layout
   * @private
   */
  _calculateLayeredERLayout(elements, containerBounds) {
    const { entities, relationships } = elements;
    const positions = new Map();
    
    // Assign entities to layers based on dependencies
    const layers = this._assignEntitiesToLayers(entities, relationships);
    
    let currentY = containerBounds.y + 50;
    
    for (const layer of layers) {
      // Sort entities in layer to minimize crossings
      const sortedLayer = this._minimizeLayerCrossings(layer, relationships);
      
      const layerWidth = sortedLayer.length * this.config.entitySpacing;
      let currentX = containerBounds.x + (containerBounds.width - layerWidth) / 2;
      
      for (const entity of sortedLayer) {
        positions.set(entity.id, {
          x: currentX + this.config.entitySpacing / 2,
          y: currentY + 40,
          width: entity.width || 120,
          height: entity.height || 80
        });
        
        currentX += this.config.entitySpacing;
      }
      
      currentY += this.config.levelSpacing;
    }
    
    return {
      entities: positions,
      relationships: this._calculateRelationshipPaths(relationships, positions),
      bounds: this._calculateLayoutBounds(positions)
    };
  }
  
  /**
   * Calculate constraint-based ER layout using force-directed algorithm
   * @private
   */
  _calculateConstraintBasedERLayout(elements, containerBounds) {
    const { entities, relationships } = elements;
    const positions = new Map();
    
    // Initialize positions randomly
    for (const entity of entities) {
      positions.set(entity.id, {
        x: containerBounds.x + Math.random() * containerBounds.width,
        y: containerBounds.y + Math.random() * containerBounds.height,
        width: entity.width || 120,
        height: entity.height || 80,
        vx: 0,
        vy: 0
      });
    }
    
    // Force-directed iterations
    for (let iteration = 0; iteration < this.config.maxIterations; iteration++) {
      this._applyForces(positions, relationships, containerBounds);
      
      if (this._checkConvergence(positions)) {
        break;
      }
    }
    
    return {
      entities: positions,
      relationships: this._calculateRelationshipPaths(relationships, positions),
      bounds: this._calculateLayoutBounds(positions)
    };
  }
  
  /**
   * Build entity hierarchy from inheritance relationships
   * @private
   */
  _buildEntityHierarchy(entities, inheritances) {
    const hierarchy = {
      roots: [],
      children: new Map(),
      parents: new Map()
    };
    
    // Build parent-child mappings
    for (const inheritance of inheritances) {
      if (!hierarchy.children.has(inheritance.parent)) {
        hierarchy.children.set(inheritance.parent, []);
      }
      hierarchy.children.get(inheritance.parent).push(inheritance.child);
      hierarchy.parents.set(inheritance.child, inheritance.parent);
    }
    
    // Find root entities (no parents)
    for (const entity of entities) {
      if (!hierarchy.parents.has(entity.id)) {
        hierarchy.roots.push(entity);
      }
    }
    
    return hierarchy;
  }
  
  /**
   * Calculate hierarchy levels for positioning
   * @private
   */
  _calculateHierarchyLevels(hierarchy) {
    const levels = [];
    const visited = new Set();
    
    // BFS traversal to assign levels
    let currentLevel = hierarchy.roots.slice();
    
    while (currentLevel.length > 0) {
      levels.push(currentLevel.slice());
      const nextLevel = [];
      
      for (const entity of currentLevel) {
        visited.add(entity.id);
        const children = hierarchy.children.get(entity.id) || [];
        
        for (const childId of children) {
          if (!visited.has(childId)) {
            const child = { id: childId }; // Placeholder, real entity data would be added
            nextLevel.push(child);
          }
        }
      }
      
      currentLevel = nextLevel;
    }
    
    return levels;
  }
  
  /**
   * Find strong entity dependency for weak entity
   * @private
   */
  _findStrongEntityDependency(weakEntity, relationships) {
    for (const rel of relationships) {
      if (rel.identifying && rel.entities && rel.entities.includes(weakEntity.id)) {
        // Find the strong entity in this relationship
        const strongEntityId = rel.entities.find(id => id !== weakEntity.id);
        return strongEntityId;
      }
    }
    return null;
  }
  
  /**
   * Find the most connected entity for radial layout center
   * @private
   */
  _findCentralEntity(entities, relationships) {
    const connectionCounts = new Map();
    
    for (const entity of entities) {
      connectionCounts.set(entity.id, 0);
    }
    
    for (const rel of relationships) {
      if (rel.entities) {
        for (const entityId of rel.entities) {
          connectionCounts.set(entityId, (connectionCounts.get(entityId) || 0) + 1);
        }
      }
    }
    
    let maxConnections = 0;
    let centralEntity = entities[0];
    
    for (const [entityId, count] of connectionCounts) {
      if (count > maxConnections) {
        maxConnections = count;
        centralEntity = entities.find(e => e.id === entityId) || entities[0];
      }
    }
    
    return centralEntity;
  }
  
  /**
   * Calculate concentric rings for radial layout
   * @private
   */
  _calculateConcentricRings(centralEntity, entities, relationships) {
    const rings = [];
    const visited = new Set([centralEntity.id]);
    
    let currentRing = this._getDirectlyConnected(centralEntity.id, entities, relationships);
    
    while (currentRing.length > 0) {
      rings.push(currentRing.filter(e => !visited.has(e.id)));
      
      for (const entity of currentRing) {
        visited.add(entity.id);
      }
      
      // Find next ring
      const nextRing = [];
      for (const entity of currentRing) {
        const connected = this._getDirectlyConnected(entity.id, entities, relationships);
        nextRing.push(...connected.filter(e => !visited.has(e.id)));
      }
      
      currentRing = [...new Map(nextRing.map(e => [e.id, e])).values()]; // Remove duplicates
    }
    
    return rings;
  }
  
  /**
   * Get entities directly connected to given entity
   * @private
   */
  _getDirectlyConnected(entityId, entities, relationships) {
    const connected = [];
    
    for (const rel of relationships) {
      if (rel.entities && rel.entities.includes(entityId)) {
        for (const connectedId of rel.entities) {
          if (connectedId !== entityId) {
            const entity = entities.find(e => e.id === connectedId);
            if (entity) {
              connected.push(entity);
            }
          }
        }
      }
    }
    
    return connected;
  }
  
  /**
   * Apply forces for constraint-based layout
   * @private
   */
  _applyForces(positions, relationships, containerBounds) {
    const entities = Array.from(positions.keys());
    
    // Reset forces
    for (const [entityId, pos] of positions) {
      pos.vx = 0;
      pos.vy = 0;
    }
    
    // Repulsion forces between entities
    for (let i = 0; i < entities.length; i++) {
      for (let j = i + 1; j < entities.length; j++) {
        const pos1 = positions.get(entities[i]);
        const pos2 = positions.get(entities[j]);
        
        const dx = pos2.x - pos1.x;
        const dy = pos2.y - pos1.y;
        const distance = Math.sqrt(dx * dx + dy * dy) || 1;
        
        const force = 1000 / (distance * distance);
        const fx = (dx / distance) * force;
        const fy = (dy / distance) * force;
        
        pos1.vx -= fx;
        pos1.vy -= fy;
        pos2.vx += fx;
        pos2.vy += fy;
      }
    }
    
    // Attraction forces for connected entities
    for (const rel of relationships) {
      if (rel.entities && rel.entities.length === 2) {
        const pos1 = positions.get(rel.entities[0]);
        const pos2 = positions.get(rel.entities[1]);
        
        if (pos1 && pos2) {
          const dx = pos2.x - pos1.x;
          const dy = pos2.y - pos1.y;
          const distance = Math.sqrt(dx * dx + dy * dy) || 1;
          
          const force = distance * 0.01;
          const fx = (dx / distance) * force;
          const fy = (dy / distance) * force;
          
          pos1.vx += fx;
          pos1.vy += fy;
          pos2.vx -= fx;
          pos2.vy -= fy;
        }
      }
    }
    
    // Apply forces and boundary constraints
    for (const [entityId, pos] of positions) {
      pos.x += pos.vx;
      pos.y += pos.vy;
      
      // Boundary constraints
      pos.x = Math.max(containerBounds.x + pos.width/2, 
                      Math.min(containerBounds.x + containerBounds.width - pos.width/2, pos.x));
      pos.y = Math.max(containerBounds.y + pos.height/2,
                      Math.min(containerBounds.y + containerBounds.height - pos.height/2, pos.y));
    }
  }
  
  /**
   * Position relationship nodes between connected entities
   * @private
   */
  _positionRelationshipNodes(relationships, entityPositions) {
    for (const rel of relationships) {
      if (rel.entities && rel.entities.length >= 2) {
        // Calculate centroid of connected entities
        let centerX = 0;
        let centerY = 0;
        let validPositions = 0;
        
        for (const entityId of rel.entities) {
          const pos = entityPositions.get(entityId);
          if (pos) {
            centerX += pos.x;
            centerY += pos.y;
            validPositions++;
          }
        }
        
        if (validPositions > 0) {
          entityPositions.set(rel.id, {
            x: centerX / validPositions,
            y: centerY / validPositions,
            width: rel.width || 80,
            height: rel.height || 40
          });
        }
      }
    }
  }
  
  /**
   * Calculate relationship paths between entities
   * @private
   */
  _calculateRelationshipPaths(relationships, positions) {
    const paths = new Map();
    
    for (const rel of relationships) {
      if (rel.entities && rel.entities.length >= 2) {
        const entityPositions = rel.entities
          .map(id => positions.get(id))
          .filter(pos => pos);
        
        if (entityPositions.length >= 2) {
          paths.set(rel.id, {
            type: this.config.relationshipRouting,
            points: this._generatePath(entityPositions)
          });
        }
      }
    }
    
    return paths;
  }
  
  /**
   * Generate path points for relationship
   * @private
   */
  _generatePath(positions) {
    if (positions.length === 2) {
      return [
        { x: positions[0].x, y: positions[0].y },
        { x: positions[1].x, y: positions[1].y }
      ];
    }
    
    // For multi-way relationships, create star pattern
    const center = {
      x: positions.reduce((sum, pos) => sum + pos.x, 0) / positions.length,
      y: positions.reduce((sum, pos) => sum + pos.y, 0) / positions.length
    };
    
    const paths = [];
    for (const pos of positions) {
      paths.push([
        { x: pos.x, y: pos.y },
        { x: center.x, y: center.y }
      ]);
    }
    
    return paths.flat();
  }
  
  /**
   * Calculate bounds of the layout
   * @private
   */
  _calculateLayoutBounds(positions) {
    let minX = Infinity, minY = Infinity;
    let maxX = -Infinity, maxY = -Infinity;
    
    for (const pos of positions.values()) {
      minX = Math.min(minX, pos.x - pos.width/2);
      minY = Math.min(minY, pos.y - pos.height/2);
      maxX = Math.max(maxX, pos.x + pos.width/2);
      maxY = Math.max(maxY, pos.y + pos.height/2);
    }
    
    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY
    };
  }
  
  /**
   * Optimize layout through post-processing
   * @private
   */
  _optimizeLayout(layout, elements, containerBounds) {
    if (this.config.avoidOverlaps) {
      layout = this._resolveOverlaps(layout);
    }
    
    if (this.config.minimizeCrossings) {
      layout = this._minimizeCrossings(layout, elements.relationships);
    }
    
    if (this.config.maintainAspectRatio) {
      layout = this._adjustAspectRatio(layout, containerBounds);
    }
    
    return layout;
  }
  
  /**
   * Generate cache key for layout
   * @private
   */
  _generateCacheKey(diagram, containerBounds) {
    const entityCount = diagram.entities?.length || 0;
    const relCount = diagram.relationships?.length || 0;
    return `${entityCount}-${relCount}-${containerBounds.width}-${containerBounds.height}`;
  }
  
  /**
   * Detect if diagram has linear flow pattern
   * @private
   */
  _detectLinearFlow(elements) {
    // Simple heuristic: more than 70% of entities have exactly 2 connections
    const { entities, relationships } = elements;
    const connectionCounts = new Map();
    
    for (const entity of entities) {
      connectionCounts.set(entity.id, 0);
    }
    
    for (const rel of relationships) {
      if (rel.entities) {
        for (const entityId of rel.entities) {
          connectionCounts.set(entityId, (connectionCounts.get(entityId) || 0) + 1);
        }
      }
    }
    
    const twoConnectionCount = Array.from(connectionCounts.values()).filter(count => count === 2).length;
    return twoConnectionCount / entities.length > 0.7;
  }
  
  /**
   * Check convergence for force-directed algorithm
   * @private
   */
  _checkConvergence(positions) {
    let totalMovement = 0;
    
    for (const pos of positions.values()) {
      totalMovement += Math.abs(pos.vx) + Math.abs(pos.vy);
    }
    
    return totalMovement < this.config.convergenceThreshold;
  }
  
  /**
   * Clear layout cache
   */
  clearCache() {
    this.layoutCache.clear();
  }
  
  /**
   * Get available layout algorithms
   */
  getAvailableAlgorithms() {
    return this.config.algorithms.slice();
  }
  
  /**
   * Update configuration
   */
  updateConfiguration(newConfig) {
    this.config = { ...this.config, ...newConfig };
    this.clearCache();
  }
}

export default ERLayoutEngine;