/**
 * CardinalityRenderer
 * 
 * Renders cardinality notation for ER diagram relationships
 * Supports various cardinality types and visual styles
 */

export class CardinalityRenderer {
  constructor(config = {}) {
    this.config = {
      // Visual styles
      fontSize: config.fontSize || 12,
      fontFamily: config.fontFamily || 'Arial, sans-serif',
      textColor: config.textColor || '#333333',
      backgroundColor: config.backgroundColor || '#ffffff',
      borderColor: config.borderColor || '#999999',
      
      // Positioning
      offset: config.offset || 20, // Distance from relationship line
      padding: config.padding || 4, // Text padding
      
      // Style options
      showBackground: config.showBackground !== false,
      showBorder: config.showBorder !== false,
      cornerRadius: config.cornerRadius || 3,
      
      // Cardinality types
      notation: config.notation || 'chen', // chen, crow-foot, ie-notation
      
      ...config
    };
    
    this.cardinalityTypes = {
      // Basic cardinalities
      'one': '1',
      'many': 'N',
      'zero-or-one': '0..1',
      'one-or-many': '1..N',
      'zero-or-many': '0..N',
      'exactly': (n) => n.toString(),
      'range': (min, max) => `${min}..${max}`,
      
      // Chen notation specific
      'chen-one': '1',
      'chen-many': 'N',
      'chen-partial': 'P',
      'chen-total': 'T',
      
      // Crow's foot notation
      'crow-one': '1',
      'crow-many': '∞',
      'crow-zero-one': '0,1',
      'crow-one-many': '1,∞',
      'crow-zero-many': '0,∞'
    };
  }
  
  /**
   * Render cardinality for a relationship edge
   */
  renderCardinality(edge, sourcePos, targetPos, cardinality, svgGroup) {
    if (!cardinality || (!cardinality.source && !cardinality.target)) {
      return;
    }
    
    // Calculate positions along the edge
    const sourceCardPos = this._calculateCardinalityPosition(sourcePos, targetPos, 'source');
    const targetCardPos = this._calculateCardinalityPosition(targetPos, sourcePos, 'target');
    
    // Render source cardinality
    if (cardinality.source) {
      this._renderCardinalityLabel(
        cardinality.source,
        sourceCardPos.x,
        sourceCardPos.y,
        sourceCardPos.angle,
        svgGroup,
        'source'
      );
    }
    
    // Render target cardinality
    if (cardinality.target) {
      this._renderCardinalityLabel(
        cardinality.target,
        targetCardPos.x,
        targetCardPos.y,
        targetCardPos.angle,
        svgGroup,
        'target'
      );
    }
  }
  
  /**
   * Calculate position for cardinality label along edge
   * @private
   */
  _calculateCardinalityPosition(fromPos, toPos, side) {
    const dx = toPos.x - fromPos.x;
    const dy = toPos.y - fromPos.y;
    const length = Math.sqrt(dx * dx + dy * dy);
    
    if (length === 0) {
      return { x: fromPos.x, y: fromPos.y, angle: 0 };
    }
    
    // Normalize direction vector
    const unitX = dx / length;
    const unitY = dy / length;
    
    // Position along the edge (closer to the entity)
    const distance = side === 'source' ? this.config.offset : length - this.config.offset;
    const x = fromPos.x + unitX * distance;
    const y = fromPos.y + unitY * distance;
    
    // Calculate perpendicular offset for label positioning
    const perpX = -unitY * this.config.offset / 2;
    const perpY = unitX * this.config.offset / 2;
    
    return {
      x: x + perpX,
      y: y + perpY,
      angle: Math.atan2(dy, dx) * (180 / Math.PI)
    };
  }
  
  /**
   * Render cardinality label at specified position
   * @private
   */
  _renderCardinalityLabel(cardinality, x, y, angle, svgGroup, side) {
    const text = this._formatCardinality(cardinality);
    if (!text) return;
    
    // Create group for cardinality label
    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    group.setAttribute('class', `cardinality-label cardinality-${side}`);
    group.setAttribute('transform', `translate(${x}, ${y})`);
    
    // Measure text dimensions (approximate)
    const textWidth = text.length * this.config.fontSize * 0.6;
    const textHeight = this.config.fontSize;
    
    // Create background rectangle if enabled
    if (this.config.showBackground) {
      const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      rect.setAttribute('x', -textWidth / 2 - this.config.padding);
      rect.setAttribute('y', -textHeight / 2 - this.config.padding);
      rect.setAttribute('width', textWidth + this.config.padding * 2);
      rect.setAttribute('height', textHeight + this.config.padding * 2);
      rect.setAttribute('fill', this.config.backgroundColor);
      rect.setAttribute('rx', this.config.cornerRadius);
      
      if (this.config.showBorder) {
        rect.setAttribute('stroke', this.config.borderColor);
        rect.setAttribute('stroke-width', 1);
      }
      
      group.appendChild(rect);
    }
    
    // Create text element
    const textEl = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    textEl.setAttribute('x', 0);
    textEl.setAttribute('y', 0);
    textEl.setAttribute('text-anchor', 'middle');
    textEl.setAttribute('dominant-baseline', 'central');
    textEl.setAttribute('font-family', this.config.fontFamily);
    textEl.setAttribute('font-size', this.config.fontSize);
    textEl.setAttribute('fill', this.config.textColor);
    textEl.textContent = text;
    
    group.appendChild(textEl);
    
    // Add to parent group
    svgGroup.appendChild(group);
  }
  
  /**
   * Format cardinality based on notation style
   * @private
   */
  _formatCardinality(cardinality) {
    if (typeof cardinality === 'string') {
      return this.cardinalityTypes[cardinality] || cardinality;
    }
    
    if (typeof cardinality === 'object') {
      switch (this.config.notation) {
        case 'chen':
          return this._formatChenNotation(cardinality);
        case 'crow-foot':
          return this._formatCrowFootNotation(cardinality);
        case 'ie-notation':
          return this._formatIENotation(cardinality);
        default:
          return this._formatStandardNotation(cardinality);
      }
    }
    
    return cardinality.toString();
  }
  
  /**
   * Format Chen notation
   * @private
   */
  _formatChenNotation(cardinality) {
    if (cardinality.min !== undefined && cardinality.max !== undefined) {
      if (cardinality.min === cardinality.max) {
        return cardinality.min.toString();
      }
      return `${cardinality.min}:${cardinality.max === Infinity ? 'N' : cardinality.max}`;
    }
    
    if (cardinality.type) {
      switch (cardinality.type) {
        case 'one': return '1';
        case 'many': return 'N';
        case 'partial': return 'P';
        case 'total': return 'T';
        default: return cardinality.type;
      }
    }
    
    return '1';
  }
  
  /**
   * Format Crow's Foot notation
   * @private
   */
  _formatCrowFootNotation(cardinality) {
    if (cardinality.min !== undefined && cardinality.max !== undefined) {
      const min = cardinality.min;
      const max = cardinality.max === Infinity ? '∞' : cardinality.max;
      
      if (min === 0 && max === 1) return '0,1';
      if (min === 1 && max === 1) return '1';
      if (min === 0 && max === Infinity) return '0,∞';
      if (min === 1 && max === Infinity) return '1,∞';
      
      return `${min},${max}`;
    }
    
    if (cardinality.type) {
      switch (cardinality.type) {
        case 'one': return '1';
        case 'many': return '∞';
        case 'zero-one': return '0,1';
        case 'one-many': return '1,∞';
        case 'zero-many': return '0,∞';
        default: return cardinality.type;
      }
    }
    
    return '1';
  }
  
  /**
   * Format Information Engineering notation
   * @private
   */
  _formatIENotation(cardinality) {
    if (cardinality.min !== undefined && cardinality.max !== undefined) {
      if (cardinality.min === 0 && cardinality.max === 1) return '0..1';
      if (cardinality.min === 1 && cardinality.max === 1) return '1';
      if (cardinality.min === 0 && cardinality.max === Infinity) return '0..*';
      if (cardinality.min === 1 && cardinality.max === Infinity) return '1..*';
      
      const max = cardinality.max === Infinity ? '*' : cardinality.max;
      return `${cardinality.min}..${max}`;
    }
    
    if (cardinality.type) {
      switch (cardinality.type) {
        case 'one': return '1';
        case 'many': return '*';
        case 'zero-one': return '0..1';
        case 'one-many': return '1..*';
        case 'zero-many': return '0..*';
        default: return cardinality.type;
      }
    }
    
    return '1';
  }
  
  /**
   * Format standard notation
   * @private
   */
  _formatStandardNotation(cardinality) {
    if (cardinality.min !== undefined && cardinality.max !== undefined) {
      if (cardinality.min === cardinality.max) {
        return cardinality.min.toString();
      }
      
      const max = cardinality.max === Infinity ? 'N' : cardinality.max;
      return `${cardinality.min}..${max}`;
    }
    
    return cardinality.type || '1';
  }
  
  /**
   * Parse cardinality string into structured format
   */
  parseCardinality(cardinalityStr) {
    if (!cardinalityStr || typeof cardinalityStr !== 'string') {
      return null;
    }
    
    const str = cardinalityStr.trim();
    
    // Handle range notation (e.g., "1..N", "0..1", "1..*")
    const rangeMatch = str.match(/^(\d+)\.\.(\d+|\*|N)$/);
    if (rangeMatch) {
      const min = parseInt(rangeMatch[1]);
      let max = rangeMatch[2];
      if (max === '*' || max === 'N') {
        max = Infinity;
      } else {
        max = parseInt(max);
      }
      return { min, max, type: 'range' };
    }
    
    // Handle comma notation (e.g., "0,1", "1,∞")
    const commaMatch = str.match(/^(\d+),(\d+|∞|\*)$/);
    if (commaMatch) {
      const min = parseInt(commaMatch[1]);
      let max = commaMatch[2];
      if (max === '∞' || max === '*') {
        max = Infinity;
      } else {
        max = parseInt(max);
      }
      return { min, max, type: 'range' };
    }
    
    // Handle colon notation (e.g., "1:N", "0:1")
    const colonMatch = str.match(/^(\d+):(\d+|N|\*)$/);
    if (colonMatch) {
      const min = parseInt(colonMatch[1]);
      let max = colonMatch[2];
      if (max === 'N' || max === '*') {
        max = Infinity;
      } else {
        max = parseInt(max);
      }
      return { min, max, type: 'range' };
    }
    
    // Handle single numbers
    if (/^\d+$/.test(str)) {
      const num = parseInt(str);
      return { min: num, max: num, type: 'exact' };
    }
    
    // Handle named types
    const namedTypes = {
      '1': { min: 1, max: 1, type: 'one' },
      'N': { min: 1, max: Infinity, type: 'many' },
      '*': { min: 0, max: Infinity, type: 'zero-many' },
      '∞': { min: 1, max: Infinity, type: 'many' }
    };
    
    if (namedTypes[str]) {
      return namedTypes[str];
    }
    
    // Default fallback
    return { min: 1, max: 1, type: 'one' };
  }
  
  /**
   * Validate cardinality specification
   */
  validateCardinality(cardinality) {
    if (!cardinality) return false;
    
    if (typeof cardinality === 'string') {
      return this.parseCardinality(cardinality) !== null;
    }
    
    if (typeof cardinality === 'object') {
      if (cardinality.min !== undefined && cardinality.max !== undefined) {
        return cardinality.min >= 0 && cardinality.max >= cardinality.min;
      }
      return cardinality.type !== undefined;
    }
    
    return false;
  }
  
  /**
   * Get available cardinality types for current notation
   */
  getAvailableCardinalityTypes() {
    switch (this.config.notation) {
      case 'chen':
        return ['1', 'N', 'P', 'T', '1:1', '1:N', 'M:N'];
      case 'crow-foot':
        return ['1', '∞', '0,1', '1,∞', '0,∞'];
      case 'ie-notation':
        return ['1', '*', '0..1', '1..*', '0..*'];
      default:
        return ['1', 'N', '0..1', '1..N', '0..N'];
    }
  }
  
  /**
   * Set notation style
   */
  setNotation(notation) {
    if (['chen', 'crow-foot', 'ie-notation'].includes(notation)) {
      this.config.notation = notation;
      return true;
    }
    return false;
  }
  
  /**
   * Get current notation style
   */
  getNotation() {
    return this.config.notation;
  }
}

export default CardinalityRenderer;