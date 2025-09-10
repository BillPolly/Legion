/**
 * RelationshipEdge - Represents relationships between entities in ER diagrams
 * 
 * Features:
 * - Various relationship types (one-to-one, one-to-many, many-to-many)
 * - Cardinality notation support (1, *, 0..1, 1..*, etc.)
 * - Participation constraints (total/partial)
 * - Identifying vs non-identifying relationships
 * - Relationship attributes
 * - Visual styles for different relationship types
 * - Crow's foot, Chen, and UML notation support
 */

export class RelationshipEdge {
  constructor(config = {}) {
    this.config = {
      // Relationship identification
      id: config.id || this._generateId(),
      name: config.name || '',
      type: config.type || 'association', // association, aggregation, composition, identifying
      
      // Connection points
      source: config.source || null, // Entity ID
      target: config.target || null, // Entity ID
      sourcePort: config.sourcePort || 'auto', // auto, top, right, bottom, left
      targetPort: config.targetPort || 'auto',
      
      // Cardinality
      cardinality: {
        source: config.cardinality?.source || '1', // 1, *, 0..1, 1..*, 0..*, m..n
        target: config.cardinality?.target || '*',
        sourceLabel: config.cardinality?.sourceLabel || null,
        targetLabel: config.cardinality?.targetLabel || null
      },
      
      // Participation constraints
      participation: {
        source: config.participation?.source || 'partial', // total, partial
        target: config.participation?.target || 'partial'
      },
      
      // Relationship attributes
      attributes: config.attributes || [],
      
      // Visual styling
      style: {
        strokeColor: config.style?.strokeColor || '#666666',
        strokeWidth: config.style?.strokeWidth || 2,
        strokeDasharray: config.style?.strokeDasharray || null,
        fillColor: config.style?.fillColor || '#FFFFFF',
        
        // Line style based on relationship type
        identifyingStrokeWidth: config.style?.identifyingStrokeWidth || 3,
        weakStrokeDasharray: config.style?.weakStrokeDasharray || '5,5',
        
        // Notation style
        notation: config.style?.notation || 'crowsfoot', // crowsfoot, chen, uml, idef1x
        
        // Label styling
        labelColor: config.style?.labelColor || '#000000',
        labelBackground: config.style?.labelBackground || '#FFFFFF',
        labelPadding: config.style?.labelPadding || 4,
        fontSize: config.style?.fontSize || 12
      },
      
      // Path configuration
      pathType: config.pathType || 'auto', // auto, straight, orthogonal, bezier
      pathPoints: config.pathPoints || [], // Intermediate points for routing
      
      // Behavior
      selectable: config.selectable !== false,
      editable: config.editable !== false,
      
      // Callbacks
      onSelect: config.onSelect || null,
      onEdit: config.onEdit || null,
      onCardinalityChange: config.onCardinalityChange || null,
      
      ...config
    };
    
    // Internal state
    this.element = null;
    this.pathElement = null;
    this.labelElements = new Map();
    this.symbolElements = new Map();
    this.isSelected = false;
    
    // Calculated path
    this.calculatedPath = null;
    this.boundingBox = null;
  }
  
  /**
   * Generate unique relationship ID
   */
  _generateId() {
    return `relationship_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  /**
   * Set relationship type
   */
  setType(type) {
    if (['association', 'aggregation', 'composition', 'identifying'].includes(type)) {
      this.config.type = type;
      if (this.element) {
        this._updateVisualStyle();
      }
      return true;
    }
    return false;
  }
  
  /**
   * Set cardinality
   */
  setCardinality(source, target) {
    this.config.cardinality.source = source;
    this.config.cardinality.target = target;
    
    if (this.config.onCardinalityChange) {
      this.config.onCardinalityChange(source, target);
    }
    
    if (this.element) {
      this._updateCardinalityLabels();
    }
  }
  
  /**
   * Set participation constraint
   */
  setParticipation(source, target) {
    this.config.participation.source = source;
    this.config.participation.target = target;
    
    if (this.element) {
      this._updateVisualStyle();
    }
  }
  
  /**
   * Add relationship attribute
   */
  addAttribute(attribute) {
    const attr = {
      name: attribute.name,
      type: attribute.type || 'TEXT',
      description: attribute.description || '',
      id: attribute.id || `rel_attr_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`
    };
    
    this.config.attributes.push(attr);
    
    if (this.element) {
      this._renderAttributes();
    }
    
    return attr;
  }
  
  /**
   * Remove relationship attribute
   */
  removeAttribute(attributeId) {
    const index = this.config.attributes.findIndex(attr => attr.id === attributeId);
    if (index >= 0) {
      this.config.attributes.splice(index, 1);
      
      if (this.element) {
        this._renderAttributes();
      }
      
      return true;
    }
    return false;
  }
  
  /**
   * Calculate path between entities
   */
  calculatePath(sourceRect, targetRect) {
    // Determine connection points
    const sourcePoint = this._getConnectionPoint(sourceRect, this.config.sourcePort, targetRect);
    const targetPoint = this._getConnectionPoint(targetRect, this.config.targetPort, sourceRect);
    
    let path;
    switch (this.config.pathType) {
      case 'straight':
        path = this._calculateStraightPath(sourcePoint, targetPoint);
        break;
      case 'orthogonal':
        path = this._calculateOrthogonalPath(sourcePoint, targetPoint);
        break;
      case 'bezier':
        path = this._calculateBezierPath(sourcePoint, targetPoint);
        break;
      default:
        path = this._calculateAutoPath(sourcePoint, targetPoint, sourceRect, targetRect);
    }
    
    this.calculatedPath = path;
    return path;
  }
  
  /**
   * Get connection point on entity
   */
  _getConnectionPoint(rect, port, oppositeRect) {
    if (port === 'auto') {
      // Calculate best connection point based on relative positions
      const dx = oppositeRect.centerX - rect.centerX;
      const dy = oppositeRect.centerY - rect.centerY;
      
      if (Math.abs(dx) > Math.abs(dy)) {
        // Horizontal connection
        port = dx > 0 ? 'right' : 'left';
      } else {
        // Vertical connection
        port = dy > 0 ? 'bottom' : 'top';
      }
    }
    
    switch (port) {
      case 'top':
        return { x: rect.centerX, y: rect.y };
      case 'right':
        return { x: rect.x + rect.width, y: rect.centerY };
      case 'bottom':
        return { x: rect.centerX, y: rect.y + rect.height };
      case 'left':
        return { x: rect.x, y: rect.centerY };
      default:
        return { x: rect.centerX, y: rect.centerY };
    }
  }
  
  /**
   * Calculate straight path
   */
  _calculateStraightPath(source, target) {
    return [source, target];
  }
  
  /**
   * Calculate orthogonal path
   */
  _calculateOrthogonalPath(source, target) {
    const points = [source];
    
    // Add intermediate points for orthogonal routing
    const dx = target.x - source.x;
    const dy = target.y - source.y;
    
    if (Math.abs(dx) > 10 && Math.abs(dy) > 10) {
      // Add corner point
      if (Math.abs(dx) > Math.abs(dy)) {
        points.push({ x: target.x, y: source.y });
      } else {
        points.push({ x: source.x, y: target.y });
      }
    }
    
    points.push(target);
    return points;
  }
  
  /**
   * Calculate bezier path
   */
  _calculateBezierPath(source, target) {
    const dx = target.x - source.x;
    const dy = target.y - source.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    // Calculate control points
    const offset = Math.min(distance * 0.3, 100);
    
    return {
      type: 'bezier',
      source: source,
      target: target,
      control1: { x: source.x + dx * 0.3, y: source.y },
      control2: { x: target.x - dx * 0.3, y: target.y }
    };
  }
  
  /**
   * Calculate auto path (smart routing)
   */
  _calculateAutoPath(source, target, sourceRect, targetRect) {
    // Use orthogonal routing for better readability
    return this._calculateOrthogonalPath(source, target);
  }
  
  /**
   * Render relationship as SVG
   */
  render(container) {
    if (this.element) {
      this.element.remove();
    }
    
    // Create main group
    this.element = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    this.element.setAttribute('class', `relationship-edge relationship-${this.config.type}`);
    this.element.setAttribute('data-relationship-id', this.config.id);
    
    // Render path
    this._renderPath();
    
    // Render cardinality symbols
    this._renderCardinalitySymbols();
    
    // Render labels
    this._renderLabels();
    
    // Render attributes if any
    if (this.config.attributes.length > 0) {
      this._renderAttributes();
    }
    
    // Add interaction handlers
    this._addInteractionHandlers();
    
    container.appendChild(this.element);
    
    return this.element;
  }
  
  /**
   * Render relationship path
   */
  _renderPath() {
    if (!this.calculatedPath) return;
    
    this.pathElement = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    
    // Build path data
    let pathData;
    if (this.calculatedPath.type === 'bezier') {
      const { source, target, control1, control2 } = this.calculatedPath;
      pathData = `M ${source.x} ${source.y} C ${control1.x} ${control1.y}, ${control2.x} ${control2.y}, ${target.x} ${target.y}`;
    } else {
      pathData = `M ${this.calculatedPath[0].x} ${this.calculatedPath[0].y}`;
      for (let i = 1; i < this.calculatedPath.length; i++) {
        pathData += ` L ${this.calculatedPath[i].x} ${this.calculatedPath[i].y}`;
      }
    }
    
    this.pathElement.setAttribute('d', pathData);
    this.pathElement.setAttribute('fill', 'none');
    this.pathElement.setAttribute('stroke', this.config.style.strokeColor);
    this.pathElement.setAttribute('stroke-width', this._getStrokeWidth());
    
    // Apply dash array for weak relationships
    if (this.config.type === 'weak' || this.config.participation.source === 'partial') {
      this.pathElement.setAttribute('stroke-dasharray', this.config.style.weakStrokeDasharray);
    }
    
    this.pathElement.setAttribute('class', 'relationship-path');
    
    this.element.appendChild(this.pathElement);
  }
  
  /**
   * Get stroke width based on relationship type
   */
  _getStrokeWidth() {
    if (this.config.type === 'identifying') {
      return this.config.style.identifyingStrokeWidth;
    }
    return this.config.style.strokeWidth;
  }
  
  /**
   * Render cardinality symbols
   */
  _renderCardinalitySymbols() {
    if (!this.calculatedPath || this.calculatedPath.length < 2) return;
    
    const notation = this.config.style.notation;
    
    // Source cardinality
    this._renderCardinalitySymbol(
      this.calculatedPath[0],
      this.calculatedPath[1],
      this.config.cardinality.source,
      'source',
      notation
    );
    
    // Target cardinality
    const lastIdx = this.calculatedPath.length - 1;
    this._renderCardinalitySymbol(
      this.calculatedPath[lastIdx],
      this.calculatedPath[lastIdx - 1],
      this.config.cardinality.target,
      'target',
      notation
    );
  }
  
  /**
   * Render single cardinality symbol
   */
  _renderCardinalitySymbol(point, referencePoint, cardinality, position, notation) {
    const symbol = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    symbol.setAttribute('class', `cardinality-symbol cardinality-${position}`);
    
    switch (notation) {
      case 'crowsfoot':
        this._renderCrowsFootSymbol(symbol, point, referencePoint, cardinality);
        break;
      case 'chen':
        this._renderChenSymbol(symbol, point, referencePoint, cardinality);
        break;
      case 'uml':
        this._renderUMLSymbol(symbol, point, referencePoint, cardinality);
        break;
      case 'idef1x':
        this._renderIDEF1XSymbol(symbol, point, referencePoint, cardinality);
        break;
      default:
        this._renderCrowsFootSymbol(symbol, point, referencePoint, cardinality);
    }
    
    this.symbolElements.set(position, symbol);
    this.element.appendChild(symbol);
  }
  
  /**
   * Render Crow's Foot notation symbol
   */
  _renderCrowsFootSymbol(container, point, referencePoint, cardinality) {
    const angle = Math.atan2(referencePoint.y - point.y, referencePoint.x - point.x);
    const size = 15;
    
    // Parse cardinality
    const isMany = cardinality.includes('*') || cardinality.includes('n');
    const isOptional = cardinality.includes('0');
    
    // Draw crow's foot for many
    if (isMany) {
      const foot1 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      foot1.setAttribute('x1', point.x);
      foot1.setAttribute('y1', point.y);
      foot1.setAttribute('x2', point.x + size * Math.cos(angle + Math.PI / 6));
      foot1.setAttribute('y2', point.y + size * Math.sin(angle + Math.PI / 6));
      foot1.setAttribute('stroke', this.config.style.strokeColor);
      foot1.setAttribute('stroke-width', this.config.style.strokeWidth);
      container.appendChild(foot1);
      
      const foot2 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      foot2.setAttribute('x1', point.x);
      foot2.setAttribute('y1', point.y);
      foot2.setAttribute('x2', point.x + size * Math.cos(angle - Math.PI / 6));
      foot2.setAttribute('y2', point.y + size * Math.sin(angle - Math.PI / 6));
      foot2.setAttribute('stroke', this.config.style.strokeColor);
      foot2.setAttribute('stroke-width', this.config.style.strokeWidth);
      container.appendChild(foot2);
    }
    
    // Draw circle for optional
    if (isOptional) {
      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('cx', point.x + (size + 5) * Math.cos(angle));
      circle.setAttribute('cy', point.y + (size + 5) * Math.sin(angle));
      circle.setAttribute('r', 4);
      circle.setAttribute('fill', 'none');
      circle.setAttribute('stroke', this.config.style.strokeColor);
      circle.setAttribute('stroke-width', this.config.style.strokeWidth);
      container.appendChild(circle);
    }
    
    // Draw line for mandatory one
    if (!isMany && !isOptional) {
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', point.x + 5 * Math.cos(angle));
      line.setAttribute('y1', point.y + 5 * Math.sin(angle));
      line.setAttribute('x2', point.x + size * Math.cos(angle));
      line.setAttribute('y2', point.y + size * Math.sin(angle));
      line.setAttribute('stroke', this.config.style.strokeColor);
      line.setAttribute('stroke-width', this.config.style.strokeWidth + 1);
      container.appendChild(line);
    }
  }
  
  /**
   * Render labels
   */
  _renderLabels() {
    // Render relationship name if exists
    if (this.config.name) {
      const midPoint = this._getMidPoint();
      
      const labelGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      labelGroup.setAttribute('class', 'relationship-label');
      
      // Background
      const background = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      background.setAttribute('x', midPoint.x - 30);
      background.setAttribute('y', midPoint.y - 10);
      background.setAttribute('width', 60);
      background.setAttribute('height', 20);
      background.setAttribute('fill', this.config.style.labelBackground);
      background.setAttribute('stroke', this.config.style.strokeColor);
      background.setAttribute('stroke-width', 1);
      background.setAttribute('rx', 3);
      labelGroup.appendChild(background);
      
      // Text
      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      text.setAttribute('x', midPoint.x);
      text.setAttribute('y', midPoint.y + 4);
      text.setAttribute('text-anchor', 'middle');
      text.setAttribute('font-size', this.config.style.fontSize);
      text.setAttribute('fill', this.config.style.labelColor);
      text.textContent = this.config.name;
      labelGroup.appendChild(text);
      
      this.labelElements.set('name', labelGroup);
      this.element.appendChild(labelGroup);
    }
    
    // Render cardinality labels
    this._renderCardinalityLabels();
  }
  
  /**
   * Render cardinality labels
   */
  _renderCardinalityLabels() {
    // Source cardinality label
    if (this.config.cardinality.sourceLabel) {
      this._renderCardinalityLabel(
        this.calculatedPath[0],
        this.config.cardinality.sourceLabel,
        'source-label'
      );
    }
    
    // Target cardinality label
    if (this.config.cardinality.targetLabel) {
      const lastIdx = this.calculatedPath.length - 1;
      this._renderCardinalityLabel(
        this.calculatedPath[lastIdx],
        this.config.cardinality.targetLabel,
        'target-label'
      );
    }
  }
  
  /**
   * Render single cardinality label
   */
  _renderCardinalityLabel(point, label, id) {
    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.setAttribute('x', point.x + 20);
    text.setAttribute('y', point.y - 10);
    text.setAttribute('font-size', this.config.style.fontSize - 2);
    text.setAttribute('fill', this.config.style.labelColor);
    text.setAttribute('class', 'cardinality-label');
    text.textContent = label;
    
    this.labelElements.set(id, text);
    this.element.appendChild(text);
  }
  
  /**
   * Render relationship attributes
   */
  _renderAttributes() {
    if (this.config.attributes.length === 0) return;
    
    const midPoint = this._getMidPoint();
    const attrGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    attrGroup.setAttribute('class', 'relationship-attributes');
    
    // Diamond shape for relationship with attributes
    const diamond = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
    const size = 30;
    const points = [
      `${midPoint.x},${midPoint.y - size}`,
      `${midPoint.x + size},${midPoint.y}`,
      `${midPoint.x},${midPoint.y + size}`,
      `${midPoint.x - size},${midPoint.y}`
    ].join(' ');
    
    diamond.setAttribute('points', points);
    diamond.setAttribute('fill', this.config.style.fillColor);
    diamond.setAttribute('stroke', this.config.style.strokeColor);
    diamond.setAttribute('stroke-width', this.config.style.strokeWidth);
    attrGroup.appendChild(diamond);
    
    // Render attribute list
    let yOffset = midPoint.y + size + 20;
    for (const attr of this.config.attributes) {
      const attrText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      attrText.setAttribute('x', midPoint.x);
      attrText.setAttribute('y', yOffset);
      attrText.setAttribute('text-anchor', 'middle');
      attrText.setAttribute('font-size', this.config.style.fontSize - 2);
      attrText.setAttribute('fill', this.config.style.labelColor);
      attrText.textContent = attr.name;
      attrGroup.appendChild(attrText);
      
      yOffset += 15;
    }
    
    this.element.appendChild(attrGroup);
  }
  
  /**
   * Get midpoint of path
   */
  _getMidPoint() {
    if (!this.calculatedPath || this.calculatedPath.length === 0) {
      return { x: 0, y: 0 };
    }
    
    if (this.calculatedPath.type === 'bezier') {
      // For bezier, calculate point at t=0.5
      const { source, target, control1, control2 } = this.calculatedPath;
      const t = 0.5;
      const t2 = t * t;
      const t3 = t2 * t;
      const mt = 1 - t;
      const mt2 = mt * mt;
      const mt3 = mt2 * mt;
      
      return {
        x: mt3 * source.x + 3 * mt2 * t * control1.x + 3 * mt * t2 * control2.x + t3 * target.x,
        y: mt3 * source.y + 3 * mt2 * t * control1.y + 3 * mt * t2 * control2.y + t3 * target.y
      };
    } else {
      // For polyline, find middle segment
      const midIdx = Math.floor(this.calculatedPath.length / 2);
      if (this.calculatedPath.length % 2 === 0) {
        // Even number of points, interpolate between two middle points
        const p1 = this.calculatedPath[midIdx - 1];
        const p2 = this.calculatedPath[midIdx];
        return {
          x: (p1.x + p2.x) / 2,
          y: (p1.y + p2.y) / 2
        };
      } else {
        // Odd number of points, return middle point
        return this.calculatedPath[midIdx];
      }
    }
  }
  
  /**
   * Update visual style
   */
  _updateVisualStyle() {
    if (!this.pathElement) return;
    
    this.pathElement.setAttribute('stroke-width', this._getStrokeWidth());
    
    // Update dash array for weak relationships
    if (this.config.type === 'weak' || this.config.participation.source === 'partial') {
      this.pathElement.setAttribute('stroke-dasharray', this.config.style.weakStrokeDasharray);
    } else {
      this.pathElement.removeAttribute('stroke-dasharray');
    }
  }
  
  /**
   * Update cardinality labels
   */
  _updateCardinalityLabels() {
    // Re-render cardinality symbols and labels
    this.symbolElements.forEach(symbol => symbol.remove());
    this.symbolElements.clear();
    
    this.labelElements.forEach((label, key) => {
      if (key.includes('label')) {
        label.remove();
      }
    });
    
    this._renderCardinalitySymbols();
    this._renderCardinalityLabels();
  }
  
  /**
   * Add interaction handlers
   */
  _addInteractionHandlers() {
    if (this.config.selectable) {
      this.element.addEventListener('click', (e) => {
        e.stopPropagation();
        this.select();
      });
    }
    
    if (this.config.editable) {
      this.element.addEventListener('dblclick', (e) => {
        e.stopPropagation();
        this.startEditing();
      });
    }
  }
  
  /**
   * Select the relationship
   */
  select() {
    this.isSelected = true;
    this.element.classList.add('selected');
    
    if (this.config.onSelect) {
      this.config.onSelect(this);
    }
  }
  
  /**
   * Deselect the relationship
   */
  deselect() {
    this.isSelected = false;
    this.element.classList.remove('selected');
  }
  
  /**
   * Start editing relationship properties
   */
  startEditing() {
    if (this.config.onEdit) {
      this.config.onEdit(this);
    }
  }
  
  /**
   * Update path with new entity positions
   */
  updatePath(sourceRect, targetRect) {
    this.calculatePath(sourceRect, targetRect);
    
    if (this.element) {
      // Remove and re-render
      this.element.innerHTML = '';
      this._renderPath();
      this._renderCardinalitySymbols();
      this._renderLabels();
      if (this.config.attributes.length > 0) {
        this._renderAttributes();
      }
    }
  }
  
  /**
   * Get relationship bounding box
   */
  getBoundingBox() {
    if (!this.calculatedPath || this.calculatedPath.length === 0) {
      return { x: 0, y: 0, width: 0, height: 0 };
    }
    
    let minX = Infinity, minY = Infinity;
    let maxX = -Infinity, maxY = -Infinity;
    
    const points = this.calculatedPath.type === 'bezier' 
      ? [this.calculatedPath.source, this.calculatedPath.target]
      : this.calculatedPath;
    
    for (const point of points) {
      minX = Math.min(minX, point.x);
      minY = Math.min(minY, point.y);
      maxX = Math.max(maxX, point.x);
      maxY = Math.max(maxY, point.y);
    }
    
    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY
    };
  }
  
  /**
   * Check if point is on relationship path
   */
  containsPoint(x, y, tolerance = 5) {
    if (!this.calculatedPath) return false;
    
    // Check distance from path segments
    if (this.calculatedPath.type === 'bezier') {
      // Simplified bezier hit test
      return this._pointNearBezier(x, y, this.calculatedPath, tolerance);
    } else {
      // Check each segment
      for (let i = 0; i < this.calculatedPath.length - 1; i++) {
        const p1 = this.calculatedPath[i];
        const p2 = this.calculatedPath[i + 1];
        
        if (this._pointNearLineSegment(x, y, p1, p2, tolerance)) {
          return true;
        }
      }
    }
    
    return false;
  }
  
  /**
   * Check if point is near line segment
   */
  _pointNearLineSegment(px, py, p1, p2, tolerance) {
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const length = Math.sqrt(dx * dx + dy * dy);
    
    if (length === 0) {
      const dist = Math.sqrt((px - p1.x) ** 2 + (py - p1.y) ** 2);
      return dist <= tolerance;
    }
    
    const t = Math.max(0, Math.min(1, ((px - p1.x) * dx + (py - p1.y) * dy) / (length * length)));
    const projection = {
      x: p1.x + t * dx,
      y: p1.y + t * dy
    };
    
    const dist = Math.sqrt((px - projection.x) ** 2 + (py - projection.y) ** 2);
    return dist <= tolerance;
  }
  
  /**
   * Check if point is near bezier curve (simplified)
   */
  _pointNearBezier(px, py, bezier, tolerance) {
    // Sample the bezier curve and check distance
    const samples = 20;
    for (let i = 0; i <= samples; i++) {
      const t = i / samples;
      const point = this._getBezierPoint(t, bezier);
      const dist = Math.sqrt((px - point.x) ** 2 + (py - point.y) ** 2);
      
      if (dist <= tolerance) {
        return true;
      }
    }
    return false;
  }
  
  /**
   * Get point on bezier curve at parameter t
   */
  _getBezierPoint(t, bezier) {
    const { source, target, control1, control2 } = bezier;
    const t2 = t * t;
    const t3 = t2 * t;
    const mt = 1 - t;
    const mt2 = mt * mt;
    const mt3 = mt2 * mt;
    
    return {
      x: mt3 * source.x + 3 * mt2 * t * control1.x + 3 * mt * t2 * control2.x + t3 * target.x,
      y: mt3 * source.y + 3 * mt2 * t * control1.y + 3 * mt * t2 * control2.y + t3 * target.y
    };
  }
  
  /**
   * Serialize relationship to JSON
   */
  toJSON() {
    return {
      id: this.config.id,
      name: this.config.name,
      type: this.config.type,
      source: this.config.source,
      target: this.config.target,
      sourcePort: this.config.sourcePort,
      targetPort: this.config.targetPort,
      cardinality: this.config.cardinality,
      participation: this.config.participation,
      attributes: this.config.attributes,
      pathType: this.config.pathType,
      pathPoints: this.config.pathPoints,
      style: this.config.style
    };
  }
  
  /**
   * Create relationship from JSON
   */
  static fromJSON(data) {
    return new RelationshipEdge({
      id: data.id,
      name: data.name,
      type: data.type,
      source: data.source,
      target: data.target,
      sourcePort: data.sourcePort,
      targetPort: data.targetPort,
      cardinality: data.cardinality,
      participation: data.participation,
      attributes: data.attributes || [],
      pathType: data.pathType,
      pathPoints: data.pathPoints || [],
      style: data.style || {}
    });
  }
  
  /**
   * Destroy relationship and clean up
   */
  destroy() {
    if (this.element) {
      this.element.remove();
      this.element = null;
    }
    
    this.pathElement = null;
    this.labelElements.clear();
    this.symbolElements.clear();
    this.calculatedPath = null;
  }
}

export default RelationshipEdge;