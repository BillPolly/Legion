/**
 * Edge - Connection between graph nodes
 */

let edgeIdCounter = 0;

export class Edge {
  constructor(config = {}) {
    if (!config.source || !config.target) {
      throw new Error('Edge requires source and target');
    }
    
    this.id = config.id || `edge-${++edgeIdCounter}`;
    this.source = config.source;
    this.target = config.target;
    this.type = config.type || 'default';
    this.label = config.label || '';
    this.data = config.data ? { ...config.data } : {};
    this.directed = config.directed !== false;
    
    // Path control points for curved edges
    this.controlPoints = config.controlPoints ? [...config.controlPoints] : [];
    
    // Style
    this.style = {
      stroke: '#999999',
      strokeWidth: 2,
      strokeDasharray: '',
      opacity: 1,
      markerEnd: 'arrow',
      markerStart: '',
      ...config.style
    };
    
    // Change tracking
    this.dirty = false;
    this.changeListeners = [];
  }

  /**
   * Get edge ID
   */
  getId() {
    return this.id;
  }

  /**
   * Get source node ID
   */
  getSource() {
    return this.source;
  }

  /**
   * Get target node ID
   */
  getTarget() {
    return this.target;
  }

  /**
   * Get edge type
   */
  getType() {
    return this.type;
  }

  /**
   * Set edge type
   */
  setType(type) {
    const oldValue = this.type;
    this.type = type;
    this._notifyChange('propertyChanged', { property: 'type', oldValue, newValue: type });
  }

  /**
   * Get label
   */
  getLabel() {
    return this.label;
  }

  /**
   * Set label
   */
  setLabel(label) {
    const oldValue = this.label;
    this.label = label;
    this._notifyChange('propertyChanged', { property: 'label', oldValue, newValue: label });
  }

  /**
   * Get custom data
   */
  getData() {
    return { ...this.data };
  }

  /**
   * Set custom data
   */
  setData(data, merge = false) {
    const oldValue = this.data;
    this.data = merge ? { ...this.data, ...data } : { ...data };
    this._notifyChange('propertyChanged', { property: 'data', oldValue, newValue: this.data });
  }

  /**
   * Check if edge is directed
   */
  isDirected() {
    return this.directed;
  }

  /**
   * Set directed property
   */
  setDirected(directed) {
    const oldValue = this.directed;
    this.directed = directed;
    this._notifyChange('propertyChanged', { property: 'directed', oldValue, newValue: directed });
  }

  /**
   * Get control points
   */
  getControlPoints() {
    return [...this.controlPoints];
  }

  /**
   * Set control points for curved edges
   */
  setControlPoints(points) {
    this.controlPoints = points ? [...points] : [];
    this._notifyChange('pathChanged', { controlPoints: this.controlPoints });
  }

  /**
   * Clear control points (make straight edge)
   */
  clearControlPoints() {
    this.setControlPoints([]);
  }

  /**
   * Calculate path between nodes
   */
  calculatePath(sourceNode, targetNode) {
    const sourcePos = sourceNode.getPosition();
    const sourceSize = sourceNode.getSize();
    const targetPos = targetNode.getPosition();
    const targetSize = targetNode.getSize();
    
    // Calculate center points
    const start = {
      x: sourcePos.x + sourceSize.width / 2,
      y: sourcePos.y + sourceSize.height / 2
    };
    
    const end = {
      x: targetPos.x + targetSize.width / 2,
      y: targetPos.y + targetSize.height / 2
    };
    
    return {
      start,
      end,
      controlPoints: [...this.controlPoints]
    };
  }

  /**
   * Get intersection point between line and node bounds
   */
  getIntersectionPoint(center, external, node) {
    const bounds = node.getBounds();
    
    // Line from center to external point
    const dx = external.x - center.x;
    const dy = external.y - center.y;
    
    if (Math.abs(dx) < 0.001 && Math.abs(dy) < 0.001) {
      return center;
    }
    
    // Check intersection with each edge of the rectangle
    const edges = [
      // Top edge
      { x1: bounds.left, y1: bounds.top, x2: bounds.right, y2: bounds.top },
      // Right edge
      { x1: bounds.right, y1: bounds.top, x2: bounds.right, y2: bounds.bottom },
      // Bottom edge
      { x1: bounds.right, y1: bounds.bottom, x2: bounds.left, y2: bounds.bottom },
      // Left edge
      { x1: bounds.left, y1: bounds.bottom, x2: bounds.left, y2: bounds.top }
    ];
    
    let closestIntersection = null;
    let closestDistance = Infinity;
    
    for (const edge of edges) {
      const intersection = this._lineIntersection(
        center.x, center.y, external.x, external.y,
        edge.x1, edge.y1, edge.x2, edge.y2
      );
      
      if (intersection) {
        const distance = Math.sqrt(
          Math.pow(intersection.x - center.x, 2) +
          Math.pow(intersection.y - center.y, 2)
        );
        
        if (distance < closestDistance) {
          closestDistance = distance;
          closestIntersection = intersection;
        }
      }
    }
    
    return closestIntersection || center;
  }

  /**
   * Calculate line intersection
   * @private
   */
  _lineIntersection(x1, y1, x2, y2, x3, y3, x4, y4) {
    const denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
    
    if (Math.abs(denom) < 0.001) {
      return null; // Lines are parallel
    }
    
    const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denom;
    const u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / denom;
    
    if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
      return {
        x: x1 + t * (x2 - x1),
        y: y1 + t * (y2 - y1)
      };
    }
    
    return null;
  }

  /**
   * Get style
   */
  getStyle() {
    return { ...this.style };
  }

  /**
   * Set style property
   */
  setStyle(property, value) {
    const oldValue = this.style[property];
    this.style[property] = value;
    this._notifyChange('styleChanged', { property, oldValue, newValue: value });
  }

  /**
   * Set multiple style properties
   */
  setStyles(styles) {
    Object.entries(styles).forEach(([property, value]) => {
      this.setStyle(property, value);
    });
  }

  /**
   * Validate connection between nodes
   */
  isValidConnection(sourceNode, targetNode) {
    // Prevent self-loops unless explicitly allowed
    if (sourceNode === targetNode && !this.data.allowSelfLoop) {
      return false;
    }
    
    return true;
  }

  /**
   * Check if edge connects two specific nodes
   */
  connects(nodeId1, nodeId2) {
    return (
      (this.source === nodeId1 && this.target === nodeId2) ||
      (this.source === nodeId2 && this.target === nodeId1)
    );
  }

  /**
   * Check if edge is connected to a node
   */
  isConnectedTo(nodeId) {
    return this.source === nodeId || this.target === nodeId;
  }

  /**
   * Check if dirty
   */
  isDirty() {
    return this.dirty;
  }

  /**
   * Clear dirty flag
   */
  clearDirty() {
    this.dirty = false;
  }

  /**
   * Add change listener
   */
  onChange(listener) {
    this.changeListeners.push(listener);
  }

  /**
   * Remove change listener
   */
  offChange(listener) {
    const index = this.changeListeners.indexOf(listener);
    if (index !== -1) {
      this.changeListeners.splice(index, 1);
    }
  }

  /**
   * Notify change
   * @private
   */
  _notifyChange(type, details) {
    this.dirty = true;
    const change = { type, ...details };
    this.changeListeners.forEach(listener => listener(change));
  }

  /**
   * Serialize to JSON
   */
  toJSON() {
    return {
      id: this.id,
      source: this.source,
      target: this.target,
      type: this.type,
      label: this.label,
      directed: this.directed,
      controlPoints: [...this.controlPoints],
      style: { ...this.style },
      data: { ...this.data }
    };
  }

  /**
   * Create from JSON
   */
  static fromJSON(json) {
    return new Edge(json);
  }
}