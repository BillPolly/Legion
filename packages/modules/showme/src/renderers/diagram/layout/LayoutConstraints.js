/**
 * LayoutConstraints - Manages positioning constraints and restrictions for diagram layouts
 * 
 * Supports various constraint types:
 * - Position constraints (fixed, relative, anchored)
 * - Alignment constraints (horizontal, vertical, grid)
 * - Spacing constraints (minimum/maximum distances)
 * - Grouping constraints (cluster, separate)
 * - Layer constraints (rank/level restrictions)
 */

export class LayoutConstraints {
  constructor(config = {}) {
    this.config = {
      enforceConstraints: config.enforceConstraints !== false,
      allowPartialViolations: config.allowPartialViolations || false,
      constraintPriority: config.constraintPriority || 'high', // low, medium, high
      maxIterations: config.maxIterations || 10,
      tolerance: config.tolerance || 1.0,
      ...config
    };

    // Constraint storage
    this.constraints = new Map();
    this.nodeConstraints = new Map();
    this.edgeConstraints = new Map();
    this.globalConstraints = new Map();
    
    // Constraint violation tracking
    this.violations = [];
    this.violationCount = 0;
    
    // Performance tracking
    this.stats = {
      constraintsApplied: 0,
      violationsFixed: 0,
      iterationsUsed: 0,
      processingTime: 0
    };
  }

  /**
   * Add a position constraint for a node
   * @param {string} nodeId - Target node ID
   * @param {Object} constraint - Constraint definition
   */
  addPositionConstraint(nodeId, constraint) {
    const constraintData = {
      id: this._generateConstraintId('position'),
      type: 'position',
      target: nodeId,
      priority: constraint.priority || 'medium',
      ...constraint
    };

    this._addConstraint(constraintData);
    
    if (!this.nodeConstraints.has(nodeId)) {
      this.nodeConstraints.set(nodeId, []);
    }
    this.nodeConstraints.get(nodeId).push(constraintData);

    return constraintData.id;
  }

  /**
   * Add an alignment constraint between nodes
   * @param {Array<string>} nodeIds - Nodes to align
   * @param {Object} constraint - Alignment specification
   */
  addAlignmentConstraint(nodeIds, constraint) {
    const constraintData = {
      id: this._generateConstraintId('alignment'),
      type: 'alignment',
      targets: nodeIds,
      alignment: constraint.alignment || 'horizontal', // horizontal, vertical, center
      priority: constraint.priority || 'medium',
      tolerance: constraint.tolerance || this.config.tolerance,
      ...constraint
    };

    this._addConstraint(constraintData);
    
    // Add to each node's constraint list
    nodeIds.forEach(nodeId => {
      if (!this.nodeConstraints.has(nodeId)) {
        this.nodeConstraints.set(nodeId, []);
      }
      this.nodeConstraints.get(nodeId).push(constraintData);
    });

    return constraintData.id;
  }

  /**
   * Add a spacing constraint between nodes
   * @param {string} sourceId - Source node ID
   * @param {string} targetId - Target node ID
   * @param {Object} constraint - Spacing specification
   */
  addSpacingConstraint(sourceId, targetId, constraint) {
    const constraintData = {
      id: this._generateConstraintId('spacing'),
      type: 'spacing',
      source: sourceId,
      target: targetId,
      minDistance: constraint.minDistance || 0,
      maxDistance: constraint.maxDistance || Infinity,
      preferredDistance: constraint.preferredDistance,
      direction: constraint.direction || 'any', // any, horizontal, vertical
      priority: constraint.priority || 'medium',
      ...constraint
    };

    this._addConstraint(constraintData);
    
    // Add to both nodes' constraint lists
    [sourceId, targetId].forEach(nodeId => {
      if (!this.nodeConstraints.has(nodeId)) {
        this.nodeConstraints.set(nodeId, []);
      }
      this.nodeConstraints.get(nodeId).push(constraintData);
    });

    return constraintData.id;
  }

  /**
   * Add a grouping constraint for nodes
   * @param {Array<string>} nodeIds - Nodes to group
   * @param {Object} constraint - Grouping specification
   */
  addGroupingConstraint(nodeIds, constraint) {
    const constraintData = {
      id: this._generateConstraintId('grouping'),
      type: 'grouping',
      targets: nodeIds,
      groupType: constraint.groupType || 'cluster', // cluster, separate, contain
      boundary: constraint.boundary, // optional bounding area
      padding: constraint.padding || 20,
      priority: constraint.priority || 'medium',
      ...constraint
    };

    this._addConstraint(constraintData);
    
    nodeIds.forEach(nodeId => {
      if (!this.nodeConstraints.has(nodeId)) {
        this.nodeConstraints.set(nodeId, []);
      }
      this.nodeConstraints.get(nodeId).push(constraintData);
    });

    return constraintData.id;
  }

  /**
   * Add a layer constraint for nodes (rank/level restrictions)
   * @param {Array<string>} nodeIds - Nodes to constrain
   * @param {Object} constraint - Layer specification
   */
  addLayerConstraint(nodeIds, constraint) {
    const constraintData = {
      id: this._generateConstraintId('layer'),
      type: 'layer',
      targets: nodeIds,
      layer: constraint.layer, // specific layer number
      minLayer: constraint.minLayer,
      maxLayer: constraint.maxLayer,
      sameLayer: constraint.sameLayer || false,
      priority: constraint.priority || 'high',
      ...constraint
    };

    this._addConstraint(constraintData);
    
    nodeIds.forEach(nodeId => {
      if (!this.nodeConstraints.has(nodeId)) {
        this.nodeConstraints.set(nodeId, []);
      }
      this.nodeConstraints.get(nodeId).push(constraintData);
    });

    return constraintData.id;
  }

  /**
   * Apply constraints to a layout result
   * @param {Object} layoutResult - Layout result with positions
   * @param {Object} graphData - Original graph data
   * @returns {Object} Constraint-adjusted layout result
   */
  applyConstraints(layoutResult, graphData) {
    const startTime = performance.now();
    this.stats.constraintsApplied = 0;
    this.stats.violationsFixed = 0;
    this.stats.iterationsUsed = 0;
    this.violations = [];

    if (!this.config.enforceConstraints || this.constraints.size === 0) {
      this.stats.processingTime = performance.now() - startTime;
      
      // Still return metadata even when no constraints are enforced
      return {
        ...layoutResult,
        metadata: {
          ...layoutResult.metadata,
          constraints: this._generateConstraintMetadata()
        }
      };
    }

    // Create a working copy of positions
    const adjustedPositions = new Map();
    layoutResult.positions.forEach((pos, nodeId) => {
      adjustedPositions.set(nodeId, { ...pos });
    });

    // Apply constraints iteratively
    for (let iteration = 0; iteration < this.config.maxIterations; iteration++) {
      this.stats.iterationsUsed = iteration + 1;
      let violationsFixed = 0;

      // Apply each constraint type in priority order
      const sortedConstraints = this._getSortedConstraints();
      
      for (const constraint of sortedConstraints) {
        const fixed = this._applyConstraint(constraint, adjustedPositions, graphData);
        if (fixed) {
          violationsFixed++;
          this.stats.violationsFixed++;
        }
        this.stats.constraintsApplied++;
      }

      // Check for convergence
      if (violationsFixed === 0) {
        break;
      }
    }

    // Calculate new bounds
    const adjustedBounds = this._calculateBounds(adjustedPositions, graphData.nodes);

    this.stats.processingTime = performance.now() - startTime;

    return {
      ...layoutResult,
      positions: adjustedPositions,
      bounds: adjustedBounds,
      metadata: {
        ...layoutResult.metadata,
        constraints: this._generateConstraintMetadata()
      }
    };
  }

  /**
   * Get constraints affecting a specific node
   * @param {string} nodeId - Node ID
   * @returns {Array} Constraints affecting the node
   */
  getNodeConstraints(nodeId) {
    return this.nodeConstraints.get(nodeId) || [];
  }

  /**
   * Remove a constraint by ID
   * @param {string} constraintId - Constraint ID to remove
   */
  removeConstraint(constraintId) {
    const constraint = this.constraints.get(constraintId);
    if (!constraint) return false;

    this.constraints.delete(constraintId);

    // Remove from node constraint lists
    if (constraint.target) {
      this._removeFromNodeConstraints(constraint.target, constraintId);
    }
    if (constraint.targets) {
      constraint.targets.forEach(nodeId => 
        this._removeFromNodeConstraints(nodeId, constraintId)
      );
    }
    if (constraint.source) {
      this._removeFromNodeConstraints(constraint.source, constraintId);
    }

    return true;
  }

  /**
   * Clear all constraints
   */
  clearConstraints() {
    this.constraints.clear();
    this.nodeConstraints.clear();
    this.edgeConstraints.clear();
    this.globalConstraints.clear();
    this.violations = [];
    this.violationCount = 0;
  }

  /**
   * Get constraint violation report
   * @returns {Object} Violation statistics
   */
  getViolationReport() {
    return {
      totalViolations: this.violationCount,
      activeViolations: this.violations.length,
      violationsByType: this._groupViolationsByType(),
      stats: this.stats
    };
  }

  // Private methods

  /**
   * Generate unique constraint ID
   * @private
   */
  _generateConstraintId(type) {
    return `${type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Add constraint to storage
   * @private
   */
  _addConstraint(constraint) {
    this.constraints.set(constraint.id, constraint);
    
    if (constraint.global) {
      this.globalConstraints.set(constraint.id, constraint);
    }
  }

  /**
   * Get constraints sorted by priority
   * @private
   */
  _getSortedConstraints() {
    const priorityOrder = { high: 3, medium: 2, low: 1 };
    
    return Array.from(this.constraints.values()).sort((a, b) => {
      const priorityA = priorityOrder[a.priority] || 2;
      const priorityB = priorityOrder[b.priority] || 2;
      return priorityB - priorityA; // High priority first
    });
  }

  /**
   * Apply a single constraint
   * @private
   */
  _applyConstraint(constraint, positions, graphData) {
    switch (constraint.type) {
      case 'position':
        return this._applyPositionConstraint(constraint, positions);
      case 'alignment':
        return this._applyAlignmentConstraint(constraint, positions);
      case 'spacing':
        return this._applySpacingConstraint(constraint, positions);
      case 'grouping':
        return this._applyGroupingConstraint(constraint, positions);
      case 'layer':
        return this._applyLayerConstraint(constraint, positions);
      default:
        return false;
    }
  }

  /**
   * Apply position constraint
   * @private
   */
  _applyPositionConstraint(constraint, positions) {
    const nodeId = constraint.target;
    const currentPos = positions.get(nodeId);
    
    if (!currentPos) return false;

    let adjusted = false;

    if (constraint.fixedPosition) {
      const { x, y } = constraint.fixedPosition;
      if (Math.abs(currentPos.x - x) > this.config.tolerance ||
          Math.abs(currentPos.y - y) > this.config.tolerance) {
        // For position constraints, always apply if within tolerance check
        positions.set(nodeId, { x, y });
        adjusted = true;
      }
    }

    if (constraint.bounds) {
      const { minX, maxX, minY, maxY } = constraint.bounds;
      let newX = currentPos.x;
      let newY = currentPos.y;

      if (minX !== undefined && newX < minX) newX = minX;
      if (maxX !== undefined && newX > maxX) newX = maxX;
      if (minY !== undefined && newY < minY) newY = minY;
      if (maxY !== undefined && newY > maxY) newY = maxY;

      if (newX !== currentPos.x || newY !== currentPos.y) {
        positions.set(nodeId, { x: newX, y: newY });
        adjusted = true;
      }
    }

    return adjusted;
  }

  /**
   * Apply alignment constraint
   * @private
   */
  _applyAlignmentConstraint(constraint, positions) {
    const { targets, alignment, tolerance } = constraint;
    const nodePositions = targets.map(id => ({ id, pos: positions.get(id) }))
                                .filter(item => item.pos);

    if (nodePositions.length < 2) return false;

    let adjusted = false;

    if (alignment === 'horizontal') {
      // Align horizontally (same Y coordinate)
      const avgY = nodePositions.reduce((sum, item) => sum + item.pos.y, 0) / nodePositions.length;
      
      nodePositions.forEach(({ id, pos }) => {
        if (Math.abs(pos.y - avgY) > tolerance) {
          positions.set(id, { x: pos.x, y: avgY });
          adjusted = true;
        }
      });
    } else if (alignment === 'vertical') {
      // Align vertically (same X coordinate)
      const avgX = nodePositions.reduce((sum, item) => sum + item.pos.x, 0) / nodePositions.length;
      
      nodePositions.forEach(({ id, pos }) => {
        if (Math.abs(pos.x - avgX) > tolerance) {
          positions.set(id, { x: avgX, y: pos.y });
          adjusted = true;
        }
      });
    } else if (alignment === 'center') {
      // Center alignment
      const avgX = nodePositions.reduce((sum, item) => sum + item.pos.x, 0) / nodePositions.length;
      const avgY = nodePositions.reduce((sum, item) => sum + item.pos.y, 0) / nodePositions.length;
      
      nodePositions.forEach(({ id, pos }) => {
        const distanceFromCenter = Math.sqrt(
          Math.pow(pos.x - avgX, 2) + Math.pow(pos.y - avgY, 2)
        );
        
        if (distanceFromCenter > tolerance) {
          // Move towards center
          const factor = Math.min(0.5, tolerance / distanceFromCenter);
          const newX = pos.x + (avgX - pos.x) * factor;
          const newY = pos.y + (avgY - pos.y) * factor;
          positions.set(id, { x: newX, y: newY });
          adjusted = true;
        }
      });
    }

    return adjusted;
  }

  /**
   * Apply spacing constraint
   * @private
   */
  _applySpacingConstraint(constraint, positions) {
    const sourcePos = positions.get(constraint.source);
    const targetPos = positions.get(constraint.target);

    if (!sourcePos || !targetPos) return false;

    const distance = Math.sqrt(
      Math.pow(targetPos.x - sourcePos.x, 2) + 
      Math.pow(targetPos.y - sourcePos.y, 2)
    );

    let adjusted = false;

    // Check minimum distance violation
    if (constraint.minDistance && distance < constraint.minDistance) {
      const ratio = constraint.minDistance / distance;
      const deltaX = (targetPos.x - sourcePos.x) * (ratio - 1) / 2;
      const deltaY = (targetPos.y - sourcePos.y) * (ratio - 1) / 2;

      positions.set(constraint.source, {
        x: sourcePos.x - deltaX,
        y: sourcePos.y - deltaY
      });
      positions.set(constraint.target, {
        x: targetPos.x + deltaX,
        y: targetPos.y + deltaY
      });
      adjusted = true;
    }

    // Check maximum distance violation
    if (constraint.maxDistance && distance > constraint.maxDistance) {
      const ratio = constraint.maxDistance / distance;
      const newTargetX = sourcePos.x + (targetPos.x - sourcePos.x) * ratio;
      const newTargetY = sourcePos.y + (targetPos.y - sourcePos.y) * ratio;

      positions.set(constraint.target, {
        x: newTargetX,
        y: newTargetY
      });
      adjusted = true;
    }

    return adjusted;
  }

  /**
   * Apply grouping constraint
   * @private
   */
  _applyGroupingConstraint(constraint, positions) {
    const { targets, groupType, padding } = constraint;
    const nodePositions = targets.map(id => ({ id, pos: positions.get(id) }))
                                .filter(item => item.pos);

    if (nodePositions.length < 2) return false;

    let adjusted = false;

    if (groupType === 'cluster') {
      // Move nodes closer together
      const centerX = nodePositions.reduce((sum, item) => sum + item.pos.x, 0) / nodePositions.length;
      const centerY = nodePositions.reduce((sum, item) => sum + item.pos.y, 0) / nodePositions.length;

      nodePositions.forEach(({ id, pos }) => {
        const distanceToCenter = Math.sqrt(
          Math.pow(pos.x - centerX, 2) + Math.pow(pos.y - centerY, 2)
        );

        if (distanceToCenter > padding) {
          // Move towards center more aggressively
          const factor = 0.3; // More aggressive movement
          const newX = pos.x + (centerX - pos.x) * factor;
          const newY = pos.y + (centerY - pos.y) * factor;
          positions.set(id, { x: newX, y: newY });
          adjusted = true;
        }
      });
    } else if (groupType === 'separate') {
      // Ensure minimum separation between group members
      for (let i = 0; i < nodePositions.length; i++) {
        for (let j = i + 1; j < nodePositions.length; j++) {
          const pos1 = nodePositions[i].pos;
          const pos2 = nodePositions[j].pos;
          const distance = Math.sqrt(
            Math.pow(pos2.x - pos1.x, 2) + Math.pow(pos2.y - pos1.y, 2)
          );

          if (distance < padding) {
            // Push nodes apart
            const pushDistance = (padding - distance) / 2;
            const angle = Math.atan2(pos2.y - pos1.y, pos2.x - pos1.x);
            
            const deltaX = Math.cos(angle) * pushDistance;
            const deltaY = Math.sin(angle) * pushDistance;

            positions.set(nodePositions[i].id, {
              x: pos1.x - deltaX,
              y: pos1.y - deltaY
            });
            positions.set(nodePositions[j].id, {
              x: pos2.x + deltaX,
              y: pos2.y + deltaY
            });
            adjusted = true;
          }
        }
      }
    }

    return adjusted;
  }

  /**
   * Apply layer constraint
   * @private
   */
  _applyLayerConstraint(constraint, positions) {
    // Layer constraints are typically handled by the layout algorithm itself
    // This is a placeholder for post-layout adjustments
    return false;
  }

  /**
   * Remove constraint from node constraint lists
   * @private
   */
  _removeFromNodeConstraints(nodeId, constraintId) {
    const nodeConstraints = this.nodeConstraints.get(nodeId);
    if (nodeConstraints) {
      const index = nodeConstraints.findIndex(c => c.id === constraintId);
      if (index !== -1) {
        nodeConstraints.splice(index, 1);
        if (nodeConstraints.length === 0) {
          this.nodeConstraints.delete(nodeId);
        }
      }
    }
  }

  /**
   * Calculate bounds for adjusted positions
   * @private
   */
  _calculateBounds(positions, nodes) {
    if (positions.size === 0) {
      return { x: 0, y: 0, width: 0, height: 0 };
    }

    let minX = Infinity, minY = Infinity;
    let maxX = -Infinity, maxY = -Infinity;

    nodes.forEach(node => {
      const pos = positions.get(node.id);
      if (pos) {
        const halfWidth = (node.size?.width || 100) / 2;
        const halfHeight = (node.size?.height || 60) / 2;
        
        minX = Math.min(minX, pos.x - halfWidth);
        minY = Math.min(minY, pos.y - halfHeight);
        maxX = Math.max(maxX, pos.x + halfWidth);
        maxY = Math.max(maxY, pos.y + halfHeight);
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
   * Group violations by type for reporting
   * @private
   */
  _groupViolationsByType() {
    const grouped = {};
    this.violations.forEach(violation => {
      if (!grouped[violation.type]) {
        grouped[violation.type] = 0;
      }
      grouped[violation.type]++;
    });
    return grouped;
  }

  /**
   * Generate constraint metadata for layout result
   * @private
   */
  _generateConstraintMetadata() {
    return {
      totalConstraints: this.constraints.size,
      constraintsByType: this._groupConstraintsByType(),
      stats: this.stats,
      violations: this.getViolationReport()
    };
  }

  /**
   * Group constraints by type
   * @private
   */
  _groupConstraintsByType() {
    const grouped = {};
    this.constraints.forEach(constraint => {
      if (!grouped[constraint.type]) {
        grouped[constraint.type] = 0;
      }
      grouped[constraint.type]++;
    });
    return grouped;
  }
}

export default LayoutConstraints;