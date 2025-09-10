/**
 * ERSymbolLibrary
 * 
 * Comprehensive library of Entity-Relationship diagram symbols
 * Provides reusable, configurable ER diagram components
 */

export class ERSymbolLibrary {
  constructor(config = {}) {
    this.config = {
      // Default styling
      defaultEntityWidth: config.defaultEntityWidth || 120,
      defaultEntityHeight: config.defaultEntityHeight || 80,
      defaultRelationshipWidth: config.defaultRelationshipWidth || 100,
      defaultRelationshipHeight: config.defaultRelationshipHeight || 60,
      defaultAttributeRadius: config.defaultAttributeRadius || 25,
      
      // Colors
      entityColor: config.entityColor || '#ffffff',
      entityBorderColor: config.entityBorderColor || '#333333',
      weakEntityColor: config.weakEntityColor || '#f8f8f8',
      relationshipColor: config.relationshipColor || '#e6f3ff',
      relationshipBorderColor: config.relationshipBorderColor || '#0066cc',
      attributeColor: config.attributeColor || '#fff2cc',
      attributeBorderColor: config.attributeBorderColor || '#cc9900',
      keyAttributeColor: config.keyAttributeColor || '#ffe6cc',
      
      // Fonts
      fontFamily: config.fontFamily || 'Arial, sans-serif',
      fontSize: config.fontSize || 12,
      titleFontSize: config.titleFontSize || 14,
      
      // Line styles
      borderWidth: config.borderWidth || 2,
      lineColor: config.lineColor || '#333333',
      
      // Symbol styles
      cardinalityFontSize: config.cardinalityFontSize || 10,
      constraintFontSize: config.constraintFontSize || 9,
      
      ...config
    };
    
    this.symbolDefinitions = new Map();
    this.patternDefinitions = new Map();
    this.initializeSymbols();
  }
  
  /**
   * Initialize standard ER symbols
   * @private
   */
  initializeSymbols() {
    // Entity symbols
    this.defineSymbol('entity', this._createEntitySymbol.bind(this));
    this.defineSymbol('weak-entity', this._createWeakEntitySymbol.bind(this));
    this.defineSymbol('associative-entity', this._createAssociativeEntitySymbol.bind(this));
    
    // Relationship symbols
    this.defineSymbol('relationship', this._createRelationshipSymbol.bind(this));
    this.defineSymbol('identifying-relationship', this._createIdentifyingRelationshipSymbol.bind(this));
    this.defineSymbol('weak-relationship', this._createWeakRelationshipSymbol.bind(this));
    
    // Attribute symbols
    this.defineSymbol('attribute', this._createAttributeSymbol.bind(this));
    this.defineSymbol('key-attribute', this._createKeyAttributeSymbol.bind(this));
    this.defineSymbol('partial-key-attribute', this._createPartialKeyAttributeSymbol.bind(this));
    this.defineSymbol('multivalued-attribute', this._createMultivaluedAttributeSymbol.bind(this));
    this.defineSymbol('composite-attribute', this._createCompositeAttributeSymbol.bind(this));
    this.defineSymbol('derived-attribute', this._createDerivedAttributeSymbol.bind(this));
    
    // ISA/Inheritance symbols
    this.defineSymbol('isa-triangle', this._createISATriangleSymbol.bind(this));
    this.defineSymbol('isa-diamond', this._createISADiamondSymbol.bind(this));
    this.defineSymbol('isa-circle', this._createISACircleSymbol.bind(this));
    
    // Cardinality symbols
    this.defineSymbol('cardinality-label', this._createCardinalityLabelSymbol.bind(this));
    this.defineSymbol('participation-indicator', this._createParticipationIndicatorSymbol.bind(this));
  }
  
  /**
   * Define a new symbol type
   */
  defineSymbol(name, creatorFunction) {
    this.symbolDefinitions.set(name, creatorFunction);
  }
  
  /**
   * Create symbol instance
   */
  createSymbol(type, options = {}) {
    const creator = this.symbolDefinitions.get(type);
    if (!creator) {
      throw new Error(`Unknown symbol type: ${type}`);
    }
    
    const mergedOptions = { ...this.config, ...options };
    return creator(mergedOptions);
  }
  
  /**
   * Create entity symbol
   * @private
   */
  _createEntitySymbol(options) {
    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    group.setAttribute('class', 'er-entity-symbol');
    
    const width = options.width || this.config.defaultEntityWidth;
    const height = options.height || this.config.defaultEntityHeight;
    const x = options.x || 0;
    const y = options.y || 0;
    
    // Entity rectangle
    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('x', x - width/2);
    rect.setAttribute('y', y - height/2);
    rect.setAttribute('width', width);
    rect.setAttribute('height', height);
    rect.setAttribute('fill', options.entityColor || this.config.entityColor);
    rect.setAttribute('stroke', options.entityBorderColor || this.config.entityBorderColor);
    rect.setAttribute('stroke-width', options.borderWidth || this.config.borderWidth);
    rect.setAttribute('rx', options.cornerRadius || 4);
    group.appendChild(rect);
    
    // Entity label
    if (options.label) {
      const text = this._createTextElement(options.label, x, y, {
        fontSize: options.titleFontSize || this.config.titleFontSize,
        fontWeight: 'bold',
        textAnchor: 'middle',
        dominantBaseline: 'central'
      });
      group.appendChild(text);
    }
    
    return {
      element: group,
      bounds: { x: x - width/2, y: y - height/2, width, height },
      connectionPoints: this._calculateEntityConnectionPoints(x, y, width, height)
    };
  }
  
  /**
   * Create weak entity symbol
   * @private
   */
  _createWeakEntitySymbol(options) {
    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    group.setAttribute('class', 'er-weak-entity-symbol');
    
    const width = options.width || this.config.defaultEntityWidth;
    const height = options.height || this.config.defaultEntityHeight;
    const x = options.x || 0;
    const y = options.y || 0;
    
    // Outer rectangle
    const outerRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    outerRect.setAttribute('x', x - width/2);
    outerRect.setAttribute('y', y - height/2);
    outerRect.setAttribute('width', width);
    outerRect.setAttribute('height', height);
    outerRect.setAttribute('fill', options.weakEntityColor || this.config.weakEntityColor);
    outerRect.setAttribute('stroke', options.entityBorderColor || this.config.entityBorderColor);
    outerRect.setAttribute('stroke-width', options.borderWidth || this.config.borderWidth);
    outerRect.setAttribute('rx', options.cornerRadius || 4);
    group.appendChild(outerRect);
    
    // Inner rectangle (double border effect)
    const innerOffset = 4;
    const innerRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    innerRect.setAttribute('x', x - width/2 + innerOffset);
    innerRect.setAttribute('y', y - height/2 + innerOffset);
    innerRect.setAttribute('width', width - 2 * innerOffset);
    innerRect.setAttribute('height', height - 2 * innerOffset);
    innerRect.setAttribute('fill', 'none');
    innerRect.setAttribute('stroke', options.entityBorderColor || this.config.entityBorderColor);
    innerRect.setAttribute('stroke-width', options.borderWidth || this.config.borderWidth);
    innerRect.setAttribute('rx', options.cornerRadius || 2);
    group.appendChild(innerRect);
    
    // Entity label
    if (options.label) {
      const text = this._createTextElement(options.label, x, y, {
        fontSize: options.titleFontSize || this.config.titleFontSize,
        fontWeight: 'bold',
        textAnchor: 'middle',
        dominantBaseline: 'central'
      });
      group.appendChild(text);
    }
    
    return {
      element: group,
      bounds: { x: x - width/2, y: y - height/2, width, height },
      connectionPoints: this._calculateEntityConnectionPoints(x, y, width, height)
    };
  }
  
  /**
   * Create relationship symbol
   * @private
   */
  _createRelationshipSymbol(options) {
    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    group.setAttribute('class', 'er-relationship-symbol');
    
    const width = options.width || this.config.defaultRelationshipWidth;
    const height = options.height || this.config.defaultRelationshipHeight;
    const x = options.x || 0;
    const y = options.y || 0;
    
    // Relationship diamond
    const diamond = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
    const points = [
      `${x},${y - height/2}`, // top
      `${x + width/2},${y}`,  // right
      `${x},${y + height/2}`, // bottom
      `${x - width/2},${y}`   // left
    ].join(' ');
    
    diamond.setAttribute('points', points);
    diamond.setAttribute('fill', options.relationshipColor || this.config.relationshipColor);
    diamond.setAttribute('stroke', options.relationshipBorderColor || this.config.relationshipBorderColor);
    diamond.setAttribute('stroke-width', options.borderWidth || this.config.borderWidth);
    group.appendChild(diamond);
    
    // Relationship label
    if (options.label) {
      const text = this._createTextElement(options.label, x, y, {
        fontSize: options.fontSize || this.config.fontSize,
        fontWeight: 'normal',
        textAnchor: 'middle',
        dominantBaseline: 'central'
      });
      group.appendChild(text);
    }
    
    return {
      element: group,
      bounds: { x: x - width/2, y: y - height/2, width, height },
      connectionPoints: this._calculateDiamondConnectionPoints(x, y, width, height)
    };
  }
  
  /**
   * Create identifying relationship symbol
   * @private
   */
  _createIdentifyingRelationshipSymbol(options) {
    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    group.setAttribute('class', 'er-identifying-relationship-symbol');
    
    const width = options.width || this.config.defaultRelationshipWidth;
    const height = options.height || this.config.defaultRelationshipHeight;
    const x = options.x || 0;
    const y = options.y || 0;
    
    // Outer diamond
    const outerDiamond = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
    const outerPoints = [
      `${x},${y - height/2}`,
      `${x + width/2},${y}`,
      `${x},${y + height/2}`,
      `${x - width/2},${y}`
    ].join(' ');
    
    outerDiamond.setAttribute('points', outerPoints);
    outerDiamond.setAttribute('fill', options.relationshipColor || this.config.relationshipColor);
    outerDiamond.setAttribute('stroke', options.relationshipBorderColor || this.config.relationshipBorderColor);
    outerDiamond.setAttribute('stroke-width', options.borderWidth || this.config.borderWidth);
    group.appendChild(outerDiamond);
    
    // Inner diamond (double border effect)
    const innerOffset = 6;
    const innerDiamond = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
    const innerPoints = [
      `${x},${y - height/2 + innerOffset}`,
      `${x + width/2 - innerOffset},${y}`,
      `${x},${y + height/2 - innerOffset}`,
      `${x - width/2 + innerOffset},${y}`
    ].join(' ');
    
    innerDiamond.setAttribute('points', innerPoints);
    innerDiamond.setAttribute('fill', 'none');
    innerDiamond.setAttribute('stroke', options.relationshipBorderColor || this.config.relationshipBorderColor);
    innerDiamond.setAttribute('stroke-width', options.borderWidth || this.config.borderWidth);
    group.appendChild(innerDiamond);
    
    // Relationship label
    if (options.label) {
      const text = this._createTextElement(options.label, x, y, {
        fontSize: options.fontSize || this.config.fontSize,
        fontWeight: 'bold',
        textAnchor: 'middle',
        dominantBaseline: 'central'
      });
      group.appendChild(text);
    }
    
    return {
      element: group,
      bounds: { x: x - width/2, y: y - height/2, width, height },
      connectionPoints: this._calculateDiamondConnectionPoints(x, y, width, height)
    };
  }
  
  /**
   * Create attribute symbol
   * @private
   */
  _createAttributeSymbol(options) {
    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    group.setAttribute('class', 'er-attribute-symbol');
    
    const radius = options.radius || this.config.defaultAttributeRadius;
    const x = options.x || 0;
    const y = options.y || 0;
    
    // Attribute circle
    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('cx', x);
    circle.setAttribute('cy', y);
    circle.setAttribute('r', radius);
    circle.setAttribute('fill', options.attributeColor || this.config.attributeColor);
    circle.setAttribute('stroke', options.attributeBorderColor || this.config.attributeBorderColor);
    circle.setAttribute('stroke-width', options.borderWidth || this.config.borderWidth);
    group.appendChild(circle);
    
    // Attribute label
    if (options.label) {
      const text = this._createTextElement(options.label, x, y, {
        fontSize: options.fontSize || this.config.fontSize,
        fontWeight: 'normal',
        textAnchor: 'middle',
        dominantBaseline: 'central'
      });
      group.appendChild(text);
    }
    
    return {
      element: group,
      bounds: { x: x - radius, y: y - radius, width: radius * 2, height: radius * 2 },
      connectionPoints: this._calculateCircleConnectionPoints(x, y, radius)
    };
  }
  
  /**
   * Create key attribute symbol
   * @private
   */
  _createKeyAttributeSymbol(options) {
    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    group.setAttribute('class', 'er-key-attribute-symbol');
    
    const radius = options.radius || this.config.defaultAttributeRadius;
    const x = options.x || 0;
    const y = options.y || 0;
    
    // Key attribute circle
    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('cx', x);
    circle.setAttribute('cy', y);
    circle.setAttribute('r', radius);
    circle.setAttribute('fill', options.keyAttributeColor || this.config.keyAttributeColor);
    circle.setAttribute('stroke', options.attributeBorderColor || this.config.attributeBorderColor);
    circle.setAttribute('stroke-width', (options.borderWidth || this.config.borderWidth) * 1.5);
    group.appendChild(circle);
    
    // Attribute label (underlined for key)
    if (options.label) {
      const text = this._createTextElement(options.label, x, y, {
        fontSize: options.fontSize || this.config.fontSize,
        fontWeight: 'bold',
        textAnchor: 'middle',
        dominantBaseline: 'central',
        textDecoration: 'underline'
      });
      group.appendChild(text);
    }
    
    return {
      element: group,
      bounds: { x: x - radius, y: y - radius, width: radius * 2, height: radius * 2 },
      connectionPoints: this._calculateCircleConnectionPoints(x, y, radius)
    };
  }
  
  /**
   * Create multivalued attribute symbol
   * @private
   */
  _createMultivaluedAttributeSymbol(options) {
    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    group.setAttribute('class', 'er-multivalued-attribute-symbol');
    
    const radius = options.radius || this.config.defaultAttributeRadius;
    const x = options.x || 0;
    const y = options.y || 0;
    
    // Outer circle
    const outerCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    outerCircle.setAttribute('cx', x);
    outerCircle.setAttribute('cy', y);
    outerCircle.setAttribute('r', radius);
    outerCircle.setAttribute('fill', options.attributeColor || this.config.attributeColor);
    outerCircle.setAttribute('stroke', options.attributeBorderColor || this.config.attributeBorderColor);
    outerCircle.setAttribute('stroke-width', options.borderWidth || this.config.borderWidth);
    group.appendChild(outerCircle);
    
    // Inner circle (double border effect)
    const innerRadius = radius - 4;
    const innerCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    innerCircle.setAttribute('cx', x);
    innerCircle.setAttribute('cy', y);
    innerCircle.setAttribute('r', innerRadius);
    innerCircle.setAttribute('fill', 'none');
    innerCircle.setAttribute('stroke', options.attributeBorderColor || this.config.attributeBorderColor);
    innerCircle.setAttribute('stroke-width', options.borderWidth || this.config.borderWidth);
    group.appendChild(innerCircle);
    
    // Attribute label
    if (options.label) {
      const text = this._createTextElement(options.label, x, y, {
        fontSize: options.fontSize || this.config.fontSize,
        fontWeight: 'normal',
        textAnchor: 'middle',
        dominantBaseline: 'central'
      });
      group.appendChild(text);
    }
    
    return {
      element: group,
      bounds: { x: x - radius, y: y - radius, width: radius * 2, height: radius * 2 },
      connectionPoints: this._calculateCircleConnectionPoints(x, y, radius)
    };
  }
  
  /**
   * Create derived attribute symbol
   * @private
   */
  _createDerivedAttributeSymbol(options) {
    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    group.setAttribute('class', 'er-derived-attribute-symbol');
    
    const radius = options.radius || this.config.defaultAttributeRadius;
    const x = options.x || 0;
    const y = options.y || 0;
    
    // Derived attribute circle (dashed border)
    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('cx', x);
    circle.setAttribute('cy', y);
    circle.setAttribute('r', radius);
    circle.setAttribute('fill', options.attributeColor || this.config.attributeColor);
    circle.setAttribute('stroke', options.attributeBorderColor || this.config.attributeBorderColor);
    circle.setAttribute('stroke-width', options.borderWidth || this.config.borderWidth);
    circle.setAttribute('stroke-dasharray', '5,3');
    group.appendChild(circle);
    
    // Attribute label
    if (options.label) {
      const text = this._createTextElement(options.label, x, y, {
        fontSize: options.fontSize || this.config.fontSize,
        fontWeight: 'normal',
        fontStyle: 'italic',
        textAnchor: 'middle',
        dominantBaseline: 'central'
      });
      group.appendChild(text);
    }
    
    return {
      element: group,
      bounds: { x: x - radius, y: y - radius, width: radius * 2, height: radius * 2 },
      connectionPoints: this._calculateCircleConnectionPoints(x, y, radius)
    };
  }
  
  /**
   * Create ISA triangle symbol
   * @private
   */
  _createISATriangleSymbol(options) {
    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    group.setAttribute('class', 'er-isa-triangle-symbol');
    
    const size = options.size || 15;
    const x = options.x || 0;
    const y = options.y || 0;
    
    // ISA triangle
    const triangle = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
    const points = [
      `${x},${y - size}`, // top
      `${x - size * 0.866},${y + size * 0.5}`, // bottom left
      `${x + size * 0.866},${y + size * 0.5}`  // bottom right
    ].join(' ');
    
    triangle.setAttribute('points', points);
    triangle.setAttribute('fill', '#ffffff');
    triangle.setAttribute('stroke', options.lineColor || this.config.lineColor);
    triangle.setAttribute('stroke-width', options.borderWidth || this.config.borderWidth);
    group.appendChild(triangle);
    
    // ISA label
    if (options.showLabel !== false) {
      const text = this._createTextElement('ISA', x, y, {
        fontSize: 8,
        fontWeight: 'bold',
        textAnchor: 'middle',
        dominantBaseline: 'central'
      });
      group.appendChild(text);
    }
    
    return {
      element: group,
      bounds: { x: x - size, y: y - size, width: size * 2, height: size * 1.5 },
      connectionPoints: {
        top: { x, y: y - size },
        bottomLeft: { x: x - size * 0.866, y: y + size * 0.5 },
        bottomRight: { x: x + size * 0.866, y: y + size * 0.5 }
      }
    };
  }
  
  /**
   * Create cardinality label symbol
   * @private
   */
  _createCardinalityLabelSymbol(options) {
    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    group.setAttribute('class', 'er-cardinality-label-symbol');
    
    const x = options.x || 0;
    const y = options.y || 0;
    const label = options.label || '1';
    
    // Background rectangle (optional)
    if (options.showBackground !== false) {
      const textWidth = label.length * 8; // Approximate width
      const textHeight = 16;
      const padding = 4;
      
      const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      rect.setAttribute('x', x - textWidth/2 - padding);
      rect.setAttribute('y', y - textHeight/2 - padding);
      rect.setAttribute('width', textWidth + padding * 2);
      rect.setAttribute('height', textHeight + padding * 2);
      rect.setAttribute('fill', '#ffffff');
      rect.setAttribute('stroke', '#cccccc');
      rect.setAttribute('stroke-width', 1);
      rect.setAttribute('rx', 3);
      group.appendChild(rect);
    }
    
    // Cardinality text
    const text = this._createTextElement(label, x, y, {
      fontSize: options.cardinalityFontSize || this.config.cardinalityFontSize,
      fontWeight: 'bold',
      textAnchor: 'middle',
      dominantBaseline: 'central'
    });
    group.appendChild(text);
    
    return {
      element: group,
      bounds: { x: x - 20, y: y - 10, width: 40, height: 20 }
    };
  }
  
  /**
   * Create text element helper
   * @private
   */
  _createTextElement(content, x, y, styleOptions = {}) {
    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.setAttribute('x', x);
    text.setAttribute('y', y);
    text.setAttribute('font-family', styleOptions.fontFamily || this.config.fontFamily);
    text.setAttribute('font-size', styleOptions.fontSize || this.config.fontSize);
    text.setAttribute('font-weight', styleOptions.fontWeight || 'normal');
    text.setAttribute('font-style', styleOptions.fontStyle || 'normal');
    text.setAttribute('text-anchor', styleOptions.textAnchor || 'start');
    text.setAttribute('dominant-baseline', styleOptions.dominantBaseline || 'baseline');
    
    if (styleOptions.textDecoration) {
      text.setAttribute('text-decoration', styleOptions.textDecoration);
    }
    
    text.textContent = content;
    return text;
  }
  
  /**
   * Calculate connection points for entity rectangles
   * @private
   */
  _calculateEntityConnectionPoints(x, y, width, height) {
    return {
      top: { x, y: y - height/2 },
      bottom: { x, y: y + height/2 },
      left: { x: x - width/2, y },
      right: { x: x + width/2, y },
      topLeft: { x: x - width/2, y: y - height/2 },
      topRight: { x: x + width/2, y: y - height/2 },
      bottomLeft: { x: x - width/2, y: y + height/2 },
      bottomRight: { x: x + width/2, y: y + height/2 }
    };
  }
  
  /**
   * Calculate connection points for diamond shapes
   * @private
   */
  _calculateDiamondConnectionPoints(x, y, width, height) {
    return {
      top: { x, y: y - height/2 },
      bottom: { x, y: y + height/2 },
      left: { x: x - width/2, y },
      right: { x: x + width/2, y }
    };
  }
  
  /**
   * Calculate connection points for circles
   * @private
   */
  _calculateCircleConnectionPoints(x, y, radius) {
    const sqrt2 = Math.sqrt(2);
    return {
      top: { x, y: y - radius },
      bottom: { x, y: y + radius },
      left: { x: x - radius, y },
      right: { x: x + radius, y },
      topLeft: { x: x - radius/sqrt2, y: y - radius/sqrt2 },
      topRight: { x: x + radius/sqrt2, y: y - radius/sqrt2 },
      bottomLeft: { x: x - radius/sqrt2, y: y + radius/sqrt2 },
      bottomRight: { x: x + radius/sqrt2, y: y + radius/sqrt2 }
    };
  }
  
  /**
   * Get all available symbol types
   */
  getAvailableSymbols() {
    return Array.from(this.symbolDefinitions.keys());
  }
  
  /**
   * Get symbol categories
   */
  getSymbolCategories() {
    return {
      entities: ['entity', 'weak-entity', 'associative-entity'],
      relationships: ['relationship', 'identifying-relationship', 'weak-relationship'],
      attributes: ['attribute', 'key-attribute', 'partial-key-attribute', 'multivalued-attribute', 'composite-attribute', 'derived-attribute'],
      inheritance: ['isa-triangle', 'isa-diamond', 'isa-circle'],
      annotations: ['cardinality-label', 'participation-indicator']
    };
  }
  
  /**
   * Create composite symbol (multiple symbols combined)
   */
  createCompositeSymbol(symbols, options = {}) {
    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    group.setAttribute('class', 'er-composite-symbol');
    
    const bounds = { x: Infinity, y: Infinity, width: 0, height: 0 };
    
    for (const symbolDef of symbols) {
      const symbol = this.createSymbol(symbolDef.type, { ...options, ...symbolDef.options });
      group.appendChild(symbol.element);
      
      // Update composite bounds
      bounds.x = Math.min(bounds.x, symbol.bounds.x);
      bounds.y = Math.min(bounds.y, symbol.bounds.y);
      bounds.width = Math.max(bounds.width, symbol.bounds.x + symbol.bounds.width - bounds.x);
      bounds.height = Math.max(bounds.height, symbol.bounds.y + symbol.bounds.height - bounds.y);
    }
    
    return {
      element: group,
      bounds
    };
  }
  
  /**
   * Update configuration
   */
  updateConfiguration(newConfig) {
    this.config = { ...this.config, ...newConfig };
  }
  
  /**
   * Export symbol as SVG string
   */
  exportSymbolAsSVG(type, options = {}) {
    const symbol = this.createSymbol(type, options);
    
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', symbol.bounds.width);
    svg.setAttribute('height', symbol.bounds.height);
    svg.setAttribute('viewBox', `${symbol.bounds.x} ${symbol.bounds.y} ${symbol.bounds.width} ${symbol.bounds.height}`);
    svg.appendChild(symbol.element);
    
    return new XMLSerializer().serializeToString(svg);
  }
}

export default ERSymbolLibrary;