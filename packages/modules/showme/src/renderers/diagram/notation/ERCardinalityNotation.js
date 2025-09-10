/**
 * ERCardinalityNotation - Handles various cardinality notation systems for ER diagrams
 * 
 * Features:
 * - Chen notation (original ER notation)
 * - Crow's Foot notation (most common)
 * - UML notation (class diagram style)
 * - IDEF1X notation (information engineering)
 * - Min-Max notation (e.g., 0..1, 1..*, 0..*)
 * - Participation constraints visualization
 * - Symbol generation and rendering
 * - Notation conversion between formats
 */

export class ERCardinalityNotation {
  constructor(config = {}) {
    this.config = {
      // Default notation system
      notation: config.notation || 'crowsfoot', // crowsfoot, chen, uml, idef1x, minmax
      
      // Visual configuration
      symbolSize: config.symbolSize || 15,
      symbolColor: config.symbolColor || '#000000',
      symbolStrokeWidth: config.symbolStrokeWidth || 2,
      symbolFillColor: config.symbolFillColor || '#FFFFFF',
      
      // Label configuration
      showLabels: config.showLabels !== false,
      labelOffset: config.labelOffset || 20,
      labelFontSize: config.labelFontSize || 11,
      labelColor: config.labelColor || '#333333',
      
      // Participation visualization
      showParticipation: config.showParticipation !== false,
      totalParticipationStyle: config.totalParticipationStyle || 'double-line', // double-line, thick-line, filled
      partialParticipationStyle: config.partialParticipationStyle || 'single-line',
      
      ...config
    };
    
    // Notation mappings
    this.notationMappings = {
      crowsfoot: {
        'one': { symbol: '||', label: '1' },
        'zero-or-one': { symbol: 'o|', label: '0..1' },
        'one-or-more': { symbol: '|{', label: '1..*' },
        'zero-or-more': { symbol: 'o{', label: '0..*' },
        'exactly-n': { symbol: '||', label: 'n' }
      },
      chen: {
        'one': { symbol: '1', label: '1' },
        'zero-or-one': { symbol: '0,1', label: '0,1' },
        'one-or-more': { symbol: '1,N', label: '1,N' },
        'zero-or-more': { symbol: '0,N', label: '0,N' },
        'exactly-n': { symbol: 'n', label: 'n' }
      },
      uml: {
        'one': { symbol: '1', label: '1' },
        'zero-or-one': { symbol: '0..1', label: '0..1' },
        'one-or-more': { symbol: '1..*', label: '1..*' },
        'zero-or-more': { symbol: '*', label: '*' },
        'exactly-n': { symbol: 'n', label: 'n' }
      },
      idef1x: {
        'one': { symbol: 'P', label: '' },  // P for parent
        'zero-or-one': { symbol: 'Z', label: '' }, // Z for zero or one
        'one-or-more': { symbol: 'P', label: '' },
        'zero-or-more': { symbol: 'C', label: '' }, // C for child
        'exactly-n': { symbol: 'n', label: '' }
      },
      minmax: {
        'one': { symbol: '(1,1)', label: '(1,1)' },
        'zero-or-one': { symbol: '(0,1)', label: '(0,1)' },
        'one-or-more': { symbol: '(1,n)', label: '(1,n)' },
        'zero-or-more': { symbol: '(0,n)', label: '(0,n)' },
        'exactly-n': { symbol: '(n,n)', label: '(n,n)' }
      }
    };
  }
  
  /**
   * Parse cardinality string to normalized format
   */
  parseCardinality(cardinalityString) {
    if (!cardinalityString) return 'one';
    
    const str = cardinalityString.toString().toLowerCase().trim();
    
    // Check for exact patterns
    if (str === '1' || str === '1..1') return 'one';
    if (str === '0..1' || str === '0,1' || str === '?') return 'zero-or-one';
    if (str === '1..*' || str === '1..n' || str === '1,n' || str === '+') return 'one-or-more';
    if (str === '*' || str === '0..*' || str === '0..n' || str === '0,n') return 'zero-or-more';
    
    // Check for specific number
    if (/^\d+$/.test(str) && str !== '0' && str !== '1') {
      return { type: 'exactly-n', value: parseInt(str) };
    }
    
    // Check for range
    const rangeMatch = str.match(/^(\d+)\.\.(\d+|\*)$/);
    if (rangeMatch) {
      const min = parseInt(rangeMatch[1]);
      const max = rangeMatch[2];
      
      if (min === 0 && max === '1') return 'zero-or-one';
      if (min === 0 && max === '*') return 'zero-or-more';
      if (min === 1 && max === '*') return 'one-or-more';
      if (min === 1 && max === '1') return 'one';
      
      return { type: 'range', min, max };
    }
    
    // Default to one
    return 'one';
  }
  
  /**
   * Convert cardinality between notation systems
   */
  convertNotation(cardinality, fromNotation, toNotation) {
    // First normalize the cardinality
    const normalized = this.parseCardinality(cardinality);
    
    // Get the mapping for target notation
    const targetMapping = this.notationMappings[toNotation];
    if (!targetMapping) {
      throw new Error(`Unsupported notation: ${toNotation}`);
    }
    
    // Handle special cases
    if (typeof normalized === 'object') {
      if (normalized.type === 'exactly-n') {
        return normalized.value.toString();
      }
      if (normalized.type === 'range') {
        return `${normalized.min}..${normalized.max}`;
      }
    }
    
    return targetMapping[normalized] || targetMapping['one'];
  }
  
  /**
   * Create SVG symbol for cardinality
   */
  createSymbol(cardinality, notation = null, container = null) {
    const activeNotation = notation || this.config.notation;
    const normalized = this.parseCardinality(cardinality);
    
    const symbol = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    symbol.setAttribute('class', `cardinality-symbol cardinality-${activeNotation}`);
    
    switch (activeNotation) {
      case 'crowsfoot':
        this._createCrowsFootSymbol(symbol, normalized);
        break;
      case 'chen':
        this._createChenSymbol(symbol, normalized);
        break;
      case 'uml':
        this._createUMLSymbol(symbol, normalized);
        break;
      case 'idef1x':
        this._createIDEF1XSymbol(symbol, normalized);
        break;
      case 'minmax':
        this._createMinMaxSymbol(symbol, normalized);
        break;
      default:
        this._createCrowsFootSymbol(symbol, normalized);
    }
    
    if (container) {
      container.appendChild(symbol);
    }
    
    return symbol;
  }
  
  /**
   * Create Crow's Foot notation symbol
   */
  _createCrowsFootSymbol(container, normalized) {
    const size = this.config.symbolSize;
    
    // Determine symbol components
    let hasCircle = false;
    let hasLine = false;
    let hasCrowsFoot = false;
    
    if (normalized === 'zero-or-one') {
      hasCircle = true;
      hasLine = true;
    } else if (normalized === 'one') {
      hasLine = true;
    } else if (normalized === 'zero-or-more') {
      hasCircle = true;
      hasCrowsFoot = true;
    } else if (normalized === 'one-or-more') {
      hasLine = true;
      hasCrowsFoot = true;
    }
    
    let xOffset = 0;
    
    // Draw circle for zero
    if (hasCircle) {
      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('cx', xOffset + size / 2);
      circle.setAttribute('cy', 0);
      circle.setAttribute('r', size / 3);
      circle.setAttribute('fill', 'none');
      circle.setAttribute('stroke', this.config.symbolColor);
      circle.setAttribute('stroke-width', this.config.symbolStrokeWidth);
      container.appendChild(circle);
      xOffset += size;
    }
    
    // Draw line for one
    if (hasLine) {
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', xOffset);
      line.setAttribute('y1', -size / 2);
      line.setAttribute('x2', xOffset);
      line.setAttribute('y2', size / 2);
      line.setAttribute('stroke', this.config.symbolColor);
      line.setAttribute('stroke-width', this.config.symbolStrokeWidth);
      container.appendChild(line);
      xOffset += size / 3;
    }
    
    // Draw crow's foot for many
    if (hasCrowsFoot) {
      const foot1 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      foot1.setAttribute('x1', xOffset);
      foot1.setAttribute('y1', 0);
      foot1.setAttribute('x2', xOffset + size);
      foot1.setAttribute('y2', -size / 2);
      foot1.setAttribute('stroke', this.config.symbolColor);
      foot1.setAttribute('stroke-width', this.config.symbolStrokeWidth);
      container.appendChild(foot1);
      
      const foot2 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      foot2.setAttribute('x1', xOffset);
      foot2.setAttribute('y1', 0);
      foot2.setAttribute('x2', xOffset + size);
      foot2.setAttribute('y2', 0);
      foot2.setAttribute('stroke', this.config.symbolColor);
      foot2.setAttribute('stroke-width', this.config.symbolStrokeWidth);
      container.appendChild(foot2);
      
      const foot3 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      foot3.setAttribute('x1', xOffset);
      foot3.setAttribute('y1', 0);
      foot3.setAttribute('x2', xOffset + size);
      foot3.setAttribute('y2', size / 2);
      foot3.setAttribute('stroke', this.config.symbolColor);
      foot3.setAttribute('stroke-width', this.config.symbolStrokeWidth);
      container.appendChild(foot3);
    }
  }
  
  /**
   * Create Chen notation symbol
   */
  _createChenSymbol(container, normalized) {
    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.setAttribute('x', 0);
    text.setAttribute('y', 0);
    text.setAttribute('text-anchor', 'middle');
    text.setAttribute('dominant-baseline', 'middle');
    text.setAttribute('font-size', this.config.labelFontSize);
    text.setAttribute('fill', this.config.symbolColor);
    text.setAttribute('font-weight', 'bold');
    
    const mapping = this.notationMappings.chen[normalized];
    text.textContent = mapping ? mapping.label : '1';
    
    container.appendChild(text);
  }
  
  /**
   * Create UML notation symbol
   */
  _createUMLSymbol(container, normalized) {
    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.setAttribute('x', 0);
    text.setAttribute('y', 0);
    text.setAttribute('text-anchor', 'middle');
    text.setAttribute('dominant-baseline', 'middle');
    text.setAttribute('font-size', this.config.labelFontSize);
    text.setAttribute('fill', this.config.symbolColor);
    
    const mapping = this.notationMappings.uml[normalized];
    text.textContent = mapping ? mapping.label : '1';
    
    container.appendChild(text);
  }
  
  /**
   * Create IDEF1X notation symbol
   */
  _createIDEF1XSymbol(container, normalized) {
    const size = this.config.symbolSize;
    
    if (normalized === 'one' || normalized === 'one-or-more') {
      // Solid dot for identifying relationship
      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('cx', 0);
      circle.setAttribute('cy', 0);
      circle.setAttribute('r', size / 3);
      circle.setAttribute('fill', this.config.symbolColor);
      container.appendChild(circle);
    } else if (normalized === 'zero-or-one' || normalized === 'zero-or-more') {
      // Diamond for non-identifying relationship
      const diamond = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
      const points = [
        `0,${-size/2}`,
        `${size/2},0`,
        `0,${size/2}`,
        `${-size/2},0`
      ].join(' ');
      diamond.setAttribute('points', points);
      diamond.setAttribute('fill', 'none');
      diamond.setAttribute('stroke', this.config.symbolColor);
      diamond.setAttribute('stroke-width', this.config.symbolStrokeWidth);
      container.appendChild(diamond);
    }
  }
  
  /**
   * Create Min-Max notation symbol
   */
  _createMinMaxSymbol(container, normalized) {
    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.setAttribute('x', 0);
    text.setAttribute('y', 0);
    text.setAttribute('text-anchor', 'middle');
    text.setAttribute('dominant-baseline', 'middle');
    text.setAttribute('font-size', this.config.labelFontSize);
    text.setAttribute('fill', this.config.symbolColor);
    
    const mapping = this.notationMappings.minmax[normalized];
    text.textContent = mapping ? mapping.label : '(1,1)';
    
    container.appendChild(text);
  }
  
  /**
   * Create participation constraint visualization
   */
  createParticipationSymbol(participation, container = null) {
    const symbol = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    symbol.setAttribute('class', `participation-symbol participation-${participation}`);
    
    if (participation === 'total') {
      // Double line or thick line for total participation
      if (this.config.totalParticipationStyle === 'double-line') {
        const line1 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line1.setAttribute('x1', 0);
        line1.setAttribute('y1', -3);
        line1.setAttribute('x2', this.config.symbolSize * 2);
        line1.setAttribute('y2', -3);
        line1.setAttribute('stroke', this.config.symbolColor);
        line1.setAttribute('stroke-width', this.config.symbolStrokeWidth);
        symbol.appendChild(line1);
        
        const line2 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line2.setAttribute('x1', 0);
        line2.setAttribute('y1', 3);
        line2.setAttribute('x2', this.config.symbolSize * 2);
        line2.setAttribute('y2', 3);
        line2.setAttribute('stroke', this.config.symbolColor);
        line2.setAttribute('stroke-width', this.config.symbolStrokeWidth);
        symbol.appendChild(line2);
      } else if (this.config.totalParticipationStyle === 'thick-line') {
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', 0);
        line.setAttribute('y1', 0);
        line.setAttribute('x2', this.config.symbolSize * 2);
        line.setAttribute('y2', 0);
        line.setAttribute('stroke', this.config.symbolColor);
        line.setAttribute('stroke-width', this.config.symbolStrokeWidth * 2);
        symbol.appendChild(line);
      }
    } else {
      // Single line for partial participation
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', 0);
      line.setAttribute('y1', 0);
      line.setAttribute('x2', this.config.symbolSize * 2);
      line.setAttribute('y2', 0);
      line.setAttribute('stroke', this.config.symbolColor);
      line.setAttribute('stroke-width', this.config.symbolStrokeWidth);
      symbol.appendChild(line);
    }
    
    if (container) {
      container.appendChild(symbol);
    }
    
    return symbol;
  }
  
  /**
   * Render cardinality with label
   */
  renderCardinality(cardinality, position, angle = 0, container = null) {
    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    group.setAttribute('class', 'cardinality-group');
    
    // Apply transformation for position and rotation
    group.setAttribute('transform', `translate(${position.x}, ${position.y}) rotate(${angle * 180 / Math.PI})`);
    
    // Create symbol
    const symbol = this.createSymbol(cardinality);
    group.appendChild(symbol);
    
    // Add label if configured
    if (this.config.showLabels) {
      const normalized = this.parseCardinality(cardinality);
      const mapping = this.notationMappings[this.config.notation][normalized];
      
      if (mapping && mapping.label) {
        const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        label.setAttribute('x', this.config.labelOffset);
        label.setAttribute('y', 0);
        label.setAttribute('text-anchor', 'start');
        label.setAttribute('dominant-baseline', 'middle');
        label.setAttribute('font-size', this.config.labelFontSize);
        label.setAttribute('fill', this.config.labelColor);
        label.textContent = mapping.label;
        group.appendChild(label);
      }
    }
    
    if (container) {
      container.appendChild(group);
    }
    
    return group;
  }
  
  /**
   * Get cardinality description
   */
  getDescription(cardinality) {
    const normalized = this.parseCardinality(cardinality);
    
    const descriptions = {
      'one': 'Exactly one',
      'zero-or-one': 'Zero or one (optional)',
      'one-or-more': 'One or more (mandatory)',
      'zero-or-more': 'Zero or more (optional)',
      'exactly-n': `Exactly ${normalized.value || 'n'}`
    };
    
    if (typeof normalized === 'object') {
      if (normalized.type === 'range') {
        return `Between ${normalized.min} and ${normalized.max}`;
      }
      if (normalized.type === 'exactly-n') {
        return `Exactly ${normalized.value}`;
      }
    }
    
    return descriptions[normalized] || 'Unknown cardinality';
  }
  
  /**
   * Validate cardinality string
   */
  isValidCardinality(cardinalityString) {
    try {
      const normalized = this.parseCardinality(cardinalityString);
      return normalized !== null;
    } catch {
      return false;
    }
  }
  
  /**
   * Get all supported notations
   */
  getSupportedNotations() {
    return Object.keys(this.notationMappings);
  }
  
  /**
   * Get notation configuration
   */
  getNotationConfig(notation) {
    return this.notationMappings[notation] || null;
  }
  
  /**
   * Set active notation
   */
  setNotation(notation) {
    if (this.notationMappings[notation]) {
      this.config.notation = notation;
      return true;
    }
    return false;
  }
  
  /**
   * Compare cardinalities
   */
  compareCardinalities(card1, card2) {
    const norm1 = this.parseCardinality(card1);
    const norm2 = this.parseCardinality(card2);
    
    if (typeof norm1 === 'object' || typeof norm2 === 'object') {
      return JSON.stringify(norm1) === JSON.stringify(norm2);
    }
    
    return norm1 === norm2;
  }
  
  /**
   * Get cardinality constraints
   */
  getConstraints(cardinality) {
    const normalized = this.parseCardinality(cardinality);
    
    const constraints = {
      minOccurrences: 0,
      maxOccurrences: null,
      isOptional: true,
      isMandatory: false,
      isUnique: false
    };
    
    switch (normalized) {
      case 'one':
        constraints.minOccurrences = 1;
        constraints.maxOccurrences = 1;
        constraints.isMandatory = true;
        constraints.isOptional = false;
        constraints.isUnique = true;
        break;
      case 'zero-or-one':
        constraints.minOccurrences = 0;
        constraints.maxOccurrences = 1;
        constraints.isUnique = true;
        break;
      case 'one-or-more':
        constraints.minOccurrences = 1;
        constraints.maxOccurrences = null;
        constraints.isMandatory = true;
        constraints.isOptional = false;
        break;
      case 'zero-or-more':
        constraints.minOccurrences = 0;
        constraints.maxOccurrences = null;
        break;
    }
    
    if (typeof normalized === 'object') {
      if (normalized.type === 'exactly-n') {
        constraints.minOccurrences = normalized.value;
        constraints.maxOccurrences = normalized.value;
        constraints.isMandatory = normalized.value > 0;
        constraints.isOptional = normalized.value === 0;
      } else if (normalized.type === 'range') {
        constraints.minOccurrences = normalized.min;
        constraints.maxOccurrences = normalized.max === '*' ? null : normalized.max;
        constraints.isMandatory = normalized.min > 0;
        constraints.isOptional = normalized.min === 0;
      }
    }
    
    return constraints;
  }
}

export default ERCardinalityNotation;