/**
 * InheritanceRenderer
 * 
 * Specialized renderer for inheritance relationships in ER diagrams
 * Supports ISA hierarchies, multiple inheritance, and specialization constraints
 */

export class InheritanceRenderer {
  constructor(config = {}) {
    this.config = {
      // Visual styles
      triangleSize: config.triangleSize || 12,
      triangleColor: config.triangleColor || '#666666',
      triangleFillColor: config.triangleFillColor || '#ffffff',
      lineWidth: config.lineWidth || 2,
      lineColor: config.lineColor || '#666666',
      
      // ISA symbol styles
      isaSymbol: config.isaSymbol || 'triangle', // triangle, diamond, circle
      isaLabelPosition: config.isaLabelPosition || 'center', // center, above, below
      isaLabelFont: config.isaLabelFont || 'Arial, sans-serif',
      isaLabelSize: config.isaLabelSize || 10,
      isaLabelColor: config.isaLabelColor || '#333333',
      
      // Constraint indicators
      showConstraints: config.showConstraints !== false,
      constraintPosition: config.constraintPosition || 'near-symbol', // near-symbol, on-line
      constraintFont: config.constraintFont || 'Arial, sans-serif',
      constraintSize: config.constraintSize || 8,
      constraintColor: config.constraintColor || '#cc0000',
      
      // Inheritance types
      supportMultipleInheritance: config.supportMultipleInheritance !== false,
      supportSpecialization: config.supportSpecialization !== false,
      supportGeneralization: config.supportGeneralization !== false,
      
      // Layout preferences
      preferVerticalLayout: config.preferVerticalLayout !== false,
      childSpacing: config.childSpacing || 80,
      levelSpacing: config.levelSpacing || 120,
      
      // Animation
      animateExpansion: config.animateExpansion !== false,
      animationDuration: config.animationDuration || 300,
      
      ...config
    };
    
    this.hierarchies = new Map(); // Track inheritance hierarchies
    this.isaSymbols = new Map(); // Cache for ISA symbols
  }
  
  /**
   * Render inheritance relationship
   */
  renderInheritance(relationship, parentPos, childrenPositions, svgGroup) {
    if (!parentPos || !childrenPositions || childrenPositions.length === 0) {
      return;
    }
    
    // Create group for inheritance
    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    group.setAttribute('class', 'inheritance-relationship');
    group.setAttribute('data-relationship-id', relationship.id);
    
    // Calculate ISA symbol position
    const isaPosition = this._calculateIsaSymbolPosition(parentPos, childrenPositions);
    
    // Render parent-to-ISA connection
    this._renderParentConnection(parentPos, isaPosition, group);
    
    // Render ISA symbol
    this._renderIsaSymbol(relationship, isaPosition, group);
    
    // Render ISA-to-children connections
    this._renderChildrenConnections(isaPosition, childrenPositions, group);
    
    // Render constraints if present
    if (this.config.showConstraints && relationship.constraints) {
      this._renderConstraints(relationship.constraints, isaPosition, group);
    }
    
    // Add labels if present
    if (relationship.label) {
      this._renderInheritanceLabel(relationship.label, isaPosition, group);
    }
    
    svgGroup.appendChild(group);
    return group;
  }
  
  /**
   * Calculate position for ISA symbol
   * @private
   */
  _calculateIsaSymbolPosition(parentPos, childrenPositions) {
    // Calculate centroid of children
    const childrenCenterX = childrenPositions.reduce((sum, pos) => sum + pos.x, 0) / childrenPositions.length;
    const childrenCenterY = childrenPositions.reduce((sum, pos) => sum + pos.y, 0) / childrenPositions.length;
    
    // Position ISA symbol between parent and children
    const midX = (parentPos.x + childrenCenterX) / 2;
    const midY = (parentPos.y + childrenCenterY) / 2;
    
    return {
      x: midX,
      y: midY,
      width: this.config.triangleSize * 2,
      height: this.config.triangleSize * 2
    };
  }
  
  /**
   * Render connection from parent to ISA symbol
   * @private
   */
  _renderParentConnection(parentPos, isaPos, group) {
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', parentPos.x);
    line.setAttribute('y1', parentPos.y + parentPos.height / 2);
    line.setAttribute('x2', isaPos.x);
    line.setAttribute('y2', isaPos.y);
    line.setAttribute('stroke', this.config.lineColor);
    line.setAttribute('stroke-width', this.config.lineWidth);
    line.setAttribute('class', 'inheritance-parent-line');
    
    group.appendChild(line);
  }
  
  /**
   * Render ISA symbol (triangle, diamond, or circle)
   * @private
   */
  _renderIsaSymbol(relationship, position, group) {
    const symbolGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    symbolGroup.setAttribute('class', 'isa-symbol');
    symbolGroup.setAttribute('transform', `translate(${position.x}, ${position.y})`);
    
    switch (this.config.isaSymbol) {
      case 'triangle':
        this._renderTriangleSymbol(symbolGroup);
        break;
      case 'diamond':
        this._renderDiamondSymbol(symbolGroup);
        break;
      case 'circle':
        this._renderCircleSymbol(symbolGroup);
        break;
      default:
        this._renderTriangleSymbol(symbolGroup);
    }
    
    group.appendChild(symbolGroup);
  }
  
  /**
   * Render triangle ISA symbol
   * @private
   */
  _renderTriangleSymbol(group) {
    const size = this.config.triangleSize;
    const triangle = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
    
    const points = [
      `0,${-size}`, // top
      `${-size * 0.866},${size * 0.5}`, // bottom left
      `${size * 0.866},${size * 0.5}`   // bottom right
    ].join(' ');
    
    triangle.setAttribute('points', points);
    triangle.setAttribute('fill', this.config.triangleFillColor);
    triangle.setAttribute('stroke', this.config.triangleColor);
    triangle.setAttribute('stroke-width', this.config.lineWidth);
    triangle.setAttribute('class', 'isa-triangle');
    
    group.appendChild(triangle);
  }
  
  /**
   * Render diamond ISA symbol
   * @private
   */
  _renderDiamondSymbol(group) {
    const size = this.config.triangleSize;
    const diamond = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
    
    const points = [
      `0,${-size}`, // top
      `${size},0`,  // right
      `0,${size}`,  // bottom
      `${-size},0`  // left
    ].join(' ');
    
    diamond.setAttribute('points', points);
    diamond.setAttribute('fill', this.config.triangleFillColor);
    diamond.setAttribute('stroke', this.config.triangleColor);
    diamond.setAttribute('stroke-width', this.config.lineWidth);
    diamond.setAttribute('class', 'isa-diamond');
    
    group.appendChild(diamond);
  }
  
  /**
   * Render circle ISA symbol
   * @private
   */
  _renderCircleSymbol(group) {
    const size = this.config.triangleSize;
    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    
    circle.setAttribute('cx', 0);
    circle.setAttribute('cy', 0);
    circle.setAttribute('r', size);
    circle.setAttribute('fill', this.config.triangleFillColor);
    circle.setAttribute('stroke', this.config.triangleColor);
    circle.setAttribute('stroke-width', this.config.lineWidth);
    circle.setAttribute('class', 'isa-circle');
    
    group.appendChild(circle);
  }
  
  /**
   * Render connections from ISA symbol to children
   * @private
   */
  _renderChildrenConnections(isaPos, childrenPositions, group) {
    for (const childPos of childrenPositions) {
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', isaPos.x);
      line.setAttribute('y1', isaPos.y + this.config.triangleSize);
      line.setAttribute('x2', childPos.x);
      line.setAttribute('y2', childPos.y - childPos.height / 2);
      line.setAttribute('stroke', this.config.lineColor);
      line.setAttribute('stroke-width', this.config.lineWidth);
      line.setAttribute('class', 'inheritance-child-line');
      
      group.appendChild(line);
    }
  }
  
  /**
   * Render inheritance constraints (overlapping, disjoint, etc.)
   * @private
   */
  _renderConstraints(constraints, isaPos, group) {
    const constraintTexts = [];
    
    // Parse constraint types
    if (constraints.overlapping === false) {
      constraintTexts.push('d'); // disjoint
    }
    if (constraints.total === true) {
      constraintTexts.push('t'); // total
    } else if (constraints.partial === true) {
      constraintTexts.push('p'); // partial
    }
    
    if (constraintTexts.length === 0) return;
    
    // Position constraints near ISA symbol
    let offsetY = this.config.constraintPosition === 'near-symbol' ? -20 : 15;
    
    for (let i = 0; i < constraintTexts.length; i++) {
      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      text.setAttribute('x', isaPos.x + (i * 15 - (constraintTexts.length - 1) * 7.5));
      text.setAttribute('y', isaPos.y + offsetY);
      text.setAttribute('text-anchor', 'middle');
      text.setAttribute('dominant-baseline', 'central');
      text.setAttribute('font-family', this.config.constraintFont);
      text.setAttribute('font-size', this.config.constraintSize);
      text.setAttribute('font-weight', 'bold');
      text.setAttribute('fill', this.config.constraintColor);
      text.setAttribute('class', 'inheritance-constraint');
      text.textContent = constraintTexts[i];
      
      group.appendChild(text);
    }
  }
  
  /**
   * Render inheritance relationship label
   * @private
   */
  _renderInheritanceLabel(label, isaPos, group) {
    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    
    let labelY = isaPos.y;
    switch (this.config.isaLabelPosition) {
      case 'above':
        labelY = isaPos.y - this.config.triangleSize - 8;
        break;
      case 'below':
        labelY = isaPos.y + this.config.triangleSize + 15;
        break;
      default: // center
        labelY = isaPos.y;
    }
    
    text.setAttribute('x', isaPos.x);
    text.setAttribute('y', labelY);
    text.setAttribute('text-anchor', 'middle');
    text.setAttribute('dominant-baseline', 'central');
    text.setAttribute('font-family', this.config.isaLabelFont);
    text.setAttribute('font-size', this.config.isaLabelSize);
    text.setAttribute('fill', this.config.isaLabelColor);
    text.setAttribute('class', 'inheritance-label');
    text.textContent = label;
    
    group.appendChild(text);
  }
  
  /**
   * Render multiple inheritance (multiple parents to one child)
   */
  renderMultipleInheritance(parents, child, relationship, svgGroup) {
    if (!this.config.supportMultipleInheritance) {
      console.warn('Multiple inheritance not supported in current configuration');
      return;
    }
    
    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    group.setAttribute('class', 'multiple-inheritance');
    group.setAttribute('data-relationship-id', relationship.id);
    
    // Calculate convergence point (near child)
    const convergencePoint = {
      x: child.x,
      y: child.y - child.height / 2 - 30,
      width: this.config.triangleSize,
      height: this.config.triangleSize
    };
    
    // Render lines from each parent to convergence point
    for (const parent of parents) {
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', parent.x);
      line.setAttribute('y1', parent.y + parent.height / 2);
      line.setAttribute('x2', convergencePoint.x);
      line.setAttribute('y2', convergencePoint.y);
      line.setAttribute('stroke', this.config.lineColor);
      line.setAttribute('stroke-width', this.config.lineWidth);
      line.setAttribute('class', 'multiple-inheritance-parent-line');
      
      group.appendChild(line);
    }
    
    // Render ISA symbol at convergence point
    this._renderIsaSymbol(relationship, convergencePoint, group);
    
    // Render line from convergence point to child
    const childLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    childLine.setAttribute('x1', convergencePoint.x);
    childLine.setAttribute('y1', convergencePoint.y + this.config.triangleSize);
    childLine.setAttribute('x2', child.x);
    childLine.setAttribute('y2', child.y - child.height / 2);
    childLine.setAttribute('stroke', this.config.lineColor);
    childLine.setAttribute('stroke-width', this.config.lineWidth);
    childLine.setAttribute('class', 'multiple-inheritance-child-line');
    
    group.appendChild(childLine);
    
    svgGroup.appendChild(group);
    return group;
  }
  
  /**
   * Calculate optimal layout for inheritance hierarchy
   */
  calculateInheritanceLayout(hierarchy, containerBounds) {
    const positions = new Map();
    const levels = this._analyzeLevels(hierarchy);
    
    // Calculate level heights and widths
    const levelMetrics = levels.map(level => ({
      count: level.length,
      totalWidth: level.length * 150 + (level.length - 1) * this.config.childSpacing,
      maxHeight: Math.max(...level.map(entity => entity.height || 80))
    }));
    
    // Position entities level by level
    let currentY = containerBounds.y + 50;
    
    for (let i = 0; i < levels.length; i++) {
      const level = levels[i];
      const metrics = levelMetrics[i];
      
      let currentX = containerBounds.x + (containerBounds.width - metrics.totalWidth) / 2;
      
      for (const entity of level) {
        positions.set(entity.id, {
          x: currentX + (entity.width || 120) / 2,
          y: currentY + metrics.maxHeight / 2,
          width: entity.width || 120,
          height: entity.height || 80
        });
        
        currentX += (entity.width || 120) + this.config.childSpacing;
      }
      
      currentY += metrics.maxHeight + this.config.levelSpacing;
    }
    
    return positions;
  }
  
  /**
   * Analyze inheritance hierarchy levels
   * @private
   */
  _analyzeLevels(hierarchy) {
    const levels = [];
    const visited = new Set();
    const levelMap = new Map();
    
    // Find root entities (those with no parents)
    const roots = hierarchy.entities.filter(entity => 
      !hierarchy.relationships.some(rel => 
        rel.type === 'inheritance' && rel.child === entity.id
      )
    );
    
    // BFS to assign levels
    let currentLevel = 0;
    let queue = roots;
    
    while (queue.length > 0) {
      levels[currentLevel] = [...queue];
      const nextQueue = [];
      
      for (const entity of queue) {
        visited.add(entity.id);
        levelMap.set(entity.id, currentLevel);
        
        // Find children
        const children = hierarchy.relationships
          .filter(rel => rel.type === 'inheritance' && rel.parent === entity.id)
          .map(rel => hierarchy.entities.find(e => e.id === rel.child))
          .filter(child => child && !visited.has(child.id));
        
        nextQueue.push(...children);
      }
      
      queue = nextQueue;
      currentLevel++;
    }
    
    return levels;
  }
  
  /**
   * Validate inheritance relationship
   */
  validateInheritance(relationship) {
    if (!relationship || typeof relationship !== 'object') {
      return { valid: false, error: 'Invalid relationship object' };
    }
    
    if (relationship.type !== 'inheritance' && relationship.type !== 'isa') {
      return { valid: false, error: 'Relationship type must be "inheritance" or "isa"' };
    }
    
    if (!relationship.parent || !relationship.child) {
      return { valid: false, error: 'Inheritance relationship must have parent and child' };
    }
    
    // Check for circular inheritance
    if (relationship.parent === relationship.child) {
      return { valid: false, error: 'Entity cannot inherit from itself' };
    }
    
    // Additional constraint validation
    if (relationship.constraints) {
      const constraints = relationship.constraints;
      
      // Check for conflicting constraints
      if (constraints.overlapping === true && constraints.disjoint === true) {
        return { 
          valid: false, 
          error: 'Cannot have both overlapping and disjoint constraints' 
        };
      }
      
      if (constraints.total === true && constraints.partial === true) {
        return { 
          valid: false, 
          error: 'Cannot have both total and partial constraints' 
        };
      }
    }
    
    return { valid: true };
  }
  
  /**
   * Get inheritance configuration
   */
  getConfiguration() {
    return { ...this.config };
  }
  
  /**
   * Update inheritance configuration
   */
  updateConfiguration(newConfig) {
    this.config = { ...this.config, ...newConfig };
    this.isaSymbols.clear(); // Clear symbol cache
  }
  
  /**
   * Get supported inheritance features
   */
  getSupportedFeatures() {
    return {
      symbols: ['triangle', 'diamond', 'circle'],
      constraints: ['overlapping', 'disjoint', 'total', 'partial'],
      multipleInheritance: this.config.supportMultipleInheritance,
      specialization: this.config.supportSpecialization,
      generalization: this.config.supportGeneralization,
      animation: this.config.animateExpansion
    };
  }
}

export default InheritanceRenderer;