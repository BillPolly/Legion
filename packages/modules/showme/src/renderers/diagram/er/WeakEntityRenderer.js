/**
 * WeakEntityRenderer
 * 
 * Specialized renderer for weak entities in ER diagrams
 * Handles visual styling and identifying relationship connections
 */

export class WeakEntityRenderer {
  constructor(config = {}) {
    this.config = {
      // Visual styles for weak entities
      borderStyle: config.borderStyle || 'double', // double, dashed, dotted
      borderWidth: config.borderWidth || 2,
      borderColor: config.borderColor || '#666666',
      innerBorderOffset: config.innerBorderOffset || 3,
      
      // Fill styles
      fillColor: config.fillColor || '#ffffff',
      fillOpacity: config.fillOpacity || 1.0,
      
      // Pattern fills for visual distinction
      usePattern: config.usePattern !== false,
      patternType: config.patternType || 'diagonal-lines', // diagonal-lines, dots, crosshatch
      patternColor: config.patternColor || '#f0f0f0',
      patternOpacity: config.patternOpacity || 0.3,
      
      // Text styling
      textColor: config.textColor || '#333333',
      fontFamily: config.fontFamily || 'Arial, sans-serif',
      fontSize: config.fontSize || 12,
      fontWeight: config.fontWeight || 'normal',
      
      // Identifying relationship styling
      identifyingRelationshipStyle: config.identifyingRelationshipStyle || 'double-line',
      identifyingRelationshipColor: config.identifyingRelationshipColor || '#cc0000',
      identifyingRelationshipWidth: config.identifyingRelationshipWidth || 3,
      
      // Dependency indicators
      showDependencyIndicator: config.showDependencyIndicator !== false,
      dependencyIndicatorSize: config.dependencyIndicatorSize || 8,
      dependencyIndicatorColor: config.dependencyIndicatorColor || '#ff6600',
      
      ...config
    };
    
    this.patterns = new Map(); // Cache for SVG patterns
  }
  
  /**
   * Render a weak entity
   */
  renderWeakEntity(entity, x, y, width, height, svgGroup) {
    // Create group for weak entity
    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    group.setAttribute('class', 'weak-entity');
    group.setAttribute('data-entity-id', entity.id);
    
    // Create pattern definition if needed
    if (this.config.usePattern) {
      this._createPattern(svgGroup.ownerDocument || document);
    }
    
    // Render entity background and borders
    this._renderEntityShape(entity, x, y, width, height, group);
    
    // Render entity text
    this._renderEntityText(entity, x, y, width, height, group);
    
    // Render dependency indicator if entity has dependencies
    if (this.config.showDependencyIndicator && this._hasIdentifyingRelationship(entity)) {
      this._renderDependencyIndicator(x, y, width, height, group);
    }
    
    svgGroup.appendChild(group);
    return group;
  }
  
  /**
   * Render the entity shape with appropriate styling
   * @private
   */
  _renderEntityShape(entity, x, y, width, height, group) {
    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('x', x - width / 2);
    rect.setAttribute('y', y - height / 2);
    rect.setAttribute('width', width);
    rect.setAttribute('height', height);
    
    // Set fill
    if (this.config.usePattern) {
      rect.setAttribute('fill', `url(#weak-entity-pattern-${this.config.patternType})`);
    } else {
      rect.setAttribute('fill', this.config.fillColor);
      rect.setAttribute('fill-opacity', this.config.fillOpacity);
    }
    
    // Set border based on style
    switch (this.config.borderStyle) {
      case 'double':
        this._renderDoubleBorder(rect, x, y, width, height, group);
        break;
      case 'dashed':
        rect.setAttribute('stroke', this.config.borderColor);
        rect.setAttribute('stroke-width', this.config.borderWidth);
        rect.setAttribute('stroke-dasharray', '5,5');
        break;
      case 'dotted':
        rect.setAttribute('stroke', this.config.borderColor);
        rect.setAttribute('stroke-width', this.config.borderWidth);
        rect.setAttribute('stroke-dasharray', '2,3');
        break;
      default:
        rect.setAttribute('stroke', this.config.borderColor);
        rect.setAttribute('stroke-width', this.config.borderWidth);
    }
    
    group.appendChild(rect);
  }
  
  /**
   * Render double border for weak entity
   * @private
   */
  _renderDoubleBorder(mainRect, x, y, width, height, group) {
    // Outer border
    mainRect.setAttribute('stroke', this.config.borderColor);
    mainRect.setAttribute('stroke-width', this.config.borderWidth);
    
    // Inner border
    const innerRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    const offset = this.config.innerBorderOffset;
    innerRect.setAttribute('x', x - width / 2 + offset);
    innerRect.setAttribute('y', y - height / 2 + offset);
    innerRect.setAttribute('width', width - 2 * offset);
    innerRect.setAttribute('height', height - 2 * offset);
    innerRect.setAttribute('fill', 'none');
    innerRect.setAttribute('stroke', this.config.borderColor);
    innerRect.setAttribute('stroke-width', this.config.borderWidth);
    
    group.appendChild(innerRect);
  }
  
  /**
   * Render entity text/label
   * @private
   */
  _renderEntityText(entity, x, y, width, height, group) {
    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.setAttribute('x', x);
    text.setAttribute('y', y);
    text.setAttribute('text-anchor', 'middle');
    text.setAttribute('dominant-baseline', 'central');
    text.setAttribute('font-family', this.config.fontFamily);
    text.setAttribute('font-size', this.config.fontSize);
    text.setAttribute('font-weight', this.config.fontWeight);
    text.setAttribute('fill', this.config.textColor);
    text.setAttribute('class', 'entity-label');
    
    // Handle multi-line text
    const label = entity.label || entity.name || 'Weak Entity';
    const lines = this._wrapText(label, width - 20); // 20px margin
    
    if (lines.length === 1) {
      text.textContent = lines[0];
      group.appendChild(text);
    } else {
      // Multi-line text using tspan elements
      const lineHeight = this.config.fontSize * 1.2;
      const startY = y - (lines.length - 1) * lineHeight / 2;
      
      for (let i = 0; i < lines.length; i++) {
        const tspan = document.createElementNS('http://www.w3.org/2000/svg', 'tspan');
        tspan.setAttribute('x', x);
        tspan.setAttribute('y', startY + i * lineHeight);
        tspan.textContent = lines[i];
        text.appendChild(tspan);
      }
      
      group.appendChild(text);
    }
  }
  
  /**
   * Render dependency indicator
   * @private
   */
  _renderDependencyIndicator(x, y, width, height, group) {
    const size = this.config.dependencyIndicatorSize;
    const indicator = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
    
    // Create diamond shape in top-right corner
    const centerX = x + width / 2 - size - 5;
    const centerY = y - height / 2 + size + 5;
    
    const points = [
      `${centerX},${centerY - size / 2}`, // top
      `${centerX + size / 2},${centerY}`, // right
      `${centerX},${centerY + size / 2}`, // bottom
      `${centerX - size / 2},${centerY}`  // left
    ].join(' ');
    
    indicator.setAttribute('points', points);
    indicator.setAttribute('fill', this.config.dependencyIndicatorColor);
    indicator.setAttribute('stroke', this.config.borderColor);
    indicator.setAttribute('stroke-width', 1);
    indicator.setAttribute('class', 'dependency-indicator');
    
    group.appendChild(indicator);
  }
  
  /**
   * Create SVG pattern for weak entity background
   * @private
   */
  _createPattern(document) {
    const patternId = `weak-entity-pattern-${this.config.patternType}`;
    
    if (this.patterns.has(patternId)) {
      return; // Pattern already exists
    }
    
    // Find or create defs element
    let defs = document.querySelector('defs');
    if (!defs) {
      defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
      const svg = document.querySelector('svg');
      if (svg) {
        svg.insertBefore(defs, svg.firstChild);
      }
    }
    
    // Create pattern element
    const pattern = document.createElementNS('http://www.w3.org/2000/svg', 'pattern');
    pattern.setAttribute('id', patternId);
    pattern.setAttribute('patternUnits', 'userSpaceOnUse');
    
    switch (this.config.patternType) {
      case 'diagonal-lines':
        this._createDiagonalLinesPattern(pattern);
        break;
      case 'dots':
        this._createDotsPattern(pattern);
        break;
      case 'crosshatch':
        this._createCrosshatchPattern(pattern);
        break;
      default:
        this._createDiagonalLinesPattern(pattern);
    }
    
    defs.appendChild(pattern);
    this.patterns.set(patternId, pattern);
  }
  
  /**
   * Create diagonal lines pattern
   * @private
   */
  _createDiagonalLinesPattern(pattern) {
    pattern.setAttribute('width', '8');
    pattern.setAttribute('height', '8');
    
    // Base fill
    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('width', '8');
    rect.setAttribute('height', '8');
    rect.setAttribute('fill', this.config.fillColor);
    pattern.appendChild(rect);
    
    // Diagonal line
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', '0');
    line.setAttribute('y1', '8');
    line.setAttribute('x2', '8');
    line.setAttribute('y2', '0');
    line.setAttribute('stroke', this.config.patternColor);
    line.setAttribute('stroke-width', '1');
    line.setAttribute('stroke-opacity', this.config.patternOpacity);
    pattern.appendChild(line);
  }
  
  /**
   * Create dots pattern
   * @private
   */
  _createDotsPattern(pattern) {
    pattern.setAttribute('width', '10');
    pattern.setAttribute('height', '10');
    
    // Base fill
    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('width', '10');
    rect.setAttribute('height', '10');
    rect.setAttribute('fill', this.config.fillColor);
    pattern.appendChild(rect);
    
    // Dot
    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('cx', '5');
    circle.setAttribute('cy', '5');
    circle.setAttribute('r', '1');
    circle.setAttribute('fill', this.config.patternColor);
    circle.setAttribute('fill-opacity', this.config.patternOpacity);
    pattern.appendChild(circle);
  }
  
  /**
   * Create crosshatch pattern
   * @private
   */
  _createCrosshatchPattern(pattern) {
    pattern.setAttribute('width', '10');
    pattern.setAttribute('height', '10');
    
    // Base fill
    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('width', '10');
    rect.setAttribute('height', '10');
    rect.setAttribute('fill', this.config.fillColor);
    pattern.appendChild(rect);
    
    // Diagonal lines
    const line1 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line1.setAttribute('x1', '0');
    line1.setAttribute('y1', '10');
    line1.setAttribute('x2', '10');
    line1.setAttribute('y2', '0');
    line1.setAttribute('stroke', this.config.patternColor);
    line1.setAttribute('stroke-width', '1');
    line1.setAttribute('stroke-opacity', this.config.patternOpacity);
    pattern.appendChild(line1);
    
    const line2 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line2.setAttribute('x1', '0');
    line2.setAttribute('y1', '0');
    line2.setAttribute('x2', '10');
    line2.setAttribute('y2', '10');
    line2.setAttribute('stroke', this.config.patternColor);
    line2.setAttribute('stroke-width', '1');
    line2.setAttribute('stroke-opacity', this.config.patternOpacity);
    pattern.appendChild(line2);
  }
  
  /**
   * Render identifying relationship line
   */
  renderIdentifyingRelationship(edge, sourcePos, targetPos, svgGroup) {
    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    group.setAttribute('class', 'identifying-relationship');
    group.setAttribute('data-edge-id', edge.id);
    
    switch (this.config.identifyingRelationshipStyle) {
      case 'double-line':
        this._renderDoubleLineRelationship(sourcePos, targetPos, group);
        break;
      case 'thick-line':
        this._renderThickLineRelationship(sourcePos, targetPos, group);
        break;
      case 'colored-line':
        this._renderColoredLineRelationship(sourcePos, targetPos, group);
        break;
      default:
        this._renderDoubleLineRelationship(sourcePos, targetPos, group);
    }
    
    svgGroup.appendChild(group);
    return group;
  }
  
  /**
   * Render double line for identifying relationship
   * @private
   */
  _renderDoubleLineRelationship(sourcePos, targetPos, group) {
    const dx = targetPos.x - sourcePos.x;
    const dy = targetPos.y - sourcePos.y;
    const length = Math.sqrt(dx * dx + dy * dy);
    
    if (length === 0) return;
    
    const unitX = dx / length;
    const unitY = dy / length;
    const perpX = -unitY * 2; // 2px offset for parallel lines
    const perpY = unitX * 2;
    
    // First line
    const line1 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line1.setAttribute('x1', sourcePos.x + perpX);
    line1.setAttribute('y1', sourcePos.y + perpY);
    line1.setAttribute('x2', targetPos.x + perpX);
    line1.setAttribute('y2', targetPos.y + perpY);
    line1.setAttribute('stroke', this.config.identifyingRelationshipColor);
    line1.setAttribute('stroke-width', this.config.identifyingRelationshipWidth);
    group.appendChild(line1);
    
    // Second line
    const line2 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line2.setAttribute('x1', sourcePos.x - perpX);
    line2.setAttribute('y1', sourcePos.y - perpY);
    line2.setAttribute('x2', targetPos.x - perpX);
    line2.setAttribute('y2', targetPos.y - perpY);
    line2.setAttribute('stroke', this.config.identifyingRelationshipColor);
    line2.setAttribute('stroke-width', this.config.identifyingRelationshipWidth);
    group.appendChild(line2);
  }
  
  /**
   * Render thick line for identifying relationship
   * @private
   */
  _renderThickLineRelationship(sourcePos, targetPos, group) {
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', sourcePos.x);
    line.setAttribute('y1', sourcePos.y);
    line.setAttribute('x2', targetPos.x);
    line.setAttribute('y2', targetPos.y);
    line.setAttribute('stroke', this.config.identifyingRelationshipColor);
    line.setAttribute('stroke-width', this.config.identifyingRelationshipWidth * 2);
    group.appendChild(line);
  }
  
  /**
   * Render colored line for identifying relationship
   * @private
   */
  _renderColoredLineRelationship(sourcePos, targetPos, group) {
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', sourcePos.x);
    line.setAttribute('y1', sourcePos.y);
    line.setAttribute('x2', targetPos.x);
    line.setAttribute('y2', targetPos.y);
    line.setAttribute('stroke', this.config.identifyingRelationshipColor);
    line.setAttribute('stroke-width', this.config.identifyingRelationshipWidth);
    line.setAttribute('stroke-dasharray', '10,5');
    group.appendChild(line);
  }
  
  /**
   * Check if entity has identifying relationships
   * @private
   */
  _hasIdentifyingRelationship(entity) {
    return entity.relationships && entity.relationships.some(rel => rel.identifying === true);
  }
  
  /**
   * Wrap text to fit within specified width
   * @private
   */
  _wrapText(text, maxWidth) {
    if (!text) return [];
    
    const words = text.split(/\s+/);
    if (words.length === 1) return [text];
    
    const lines = [];
    let currentLine = '';
    
    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      const testWidth = testLine.length * this.config.fontSize * 0.6; // Approximate width
      
      if (testWidth <= maxWidth) {
        currentLine = testLine;
      } else {
        if (currentLine) {
          lines.push(currentLine);
          currentLine = word;
        } else {
          // Word too long, break it
          lines.push(word);
        }
      }
    }
    
    if (currentLine) {
      lines.push(currentLine);
    }
    
    return lines;
  }
  
  /**
   * Validate weak entity data
   */
  validateWeakEntity(entity) {
    if (!entity || typeof entity !== 'object') {
      return { valid: false, error: 'Invalid entity object' };
    }
    
    if (!entity.id) {
      return { valid: false, error: 'Entity must have an ID' };
    }
    
    if (entity.type !== 'weak-entity') {
      return { valid: false, error: 'Entity type must be "weak-entity"' };
    }
    
    // Check for identifying relationship
    if (!entity.relationships || !entity.relationships.some(rel => rel.identifying)) {
      return { 
        valid: false, 
        error: 'Weak entity must have at least one identifying relationship' 
      };
    }
    
    return { valid: true };
  }
  
  /**
   * Get configuration options
   */
  getConfiguration() {
    return { ...this.config };
  }
  
  /**
   * Update configuration
   */
  updateConfiguration(newConfig) {
    this.config = { ...this.config, ...newConfig };
    this.patterns.clear(); // Clear pattern cache to regenerate with new config
  }
}

export default WeakEntityRenderer;