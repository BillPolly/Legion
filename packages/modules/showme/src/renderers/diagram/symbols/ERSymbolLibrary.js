/**
 * ERSymbolLibrary - Comprehensive library of Entity-Relationship diagram symbols
 * 
 * Features:
 * - Entity symbols (strong, weak, associative)
 * - Relationship symbols (diamond, oval, rectangle)
 * - Attribute symbols (oval, multi-valued, derived, composite)
 * - Cardinality notations (crow's foot, UML, min-max)
 * - ISA/inheritance symbols (triangle, circle, union)
 * - Participation constraints (total, partial)
 * - Special symbols (identifiers, discriminators)
 * - Symbol rendering and customization
 * - Symbol templates and presets
 * - Interactive symbol palette
 */

export class ERSymbolLibrary {
  constructor(config = {}) {
    this.config = {
      // Symbol sizing
      defaultSize: config.defaultSize || 20,
      scaleWithZoom: config.scaleWithZoom !== false,
      minScale: config.minScale || 0.5,
      maxScale: config.maxScale || 2.0,
      
      // Symbol styles
      strokeWidth: config.strokeWidth || 2,
      strokeColor: config.strokeColor || '#2C3E50',
      fillColor: config.fillColor || '#FFFFFF',
      textColor: config.textColor || '#2C3E50',
      fontSize: config.fontSize || 12,
      fontFamily: config.fontFamily || 'Arial, sans-serif',
      
      // Special styles
      weakEntityStroke: config.weakEntityStroke || 4,
      derivedAttributeDash: config.derivedAttributeDash || '5,5',
      identifyingRelationshipWidth: config.identifyingRelationshipWidth || 3,
      
      // Symbol categories
      enableEntities: config.enableEntities !== false,
      enableRelationships: config.enableRelationships !== false,
      enableAttributes: config.enableAttributes !== false,
      enableCardinality: config.enableCardinality !== false,
      enableInheritance: config.enableInheritance !== false,
      enableConstraints: config.enableConstraints !== false,
      
      // Rendering options
      useSVG: config.useSVG !== false,
      useCanvas: config.useCanvas || false,
      antialiasing: config.antialiasing !== false,
      
      ...config
    };
    
    // Symbol definitions
    this.symbols = new Map();
    this.symbolCategories = new Map();
    this.symbolPresets = new Map();
    this.customSymbols = new Map();
    
    // Initialize symbol library
    this._initializeSymbols();
    this._initializePresets();
  }
  
  /**
   * Initialize built-in symbols
   */
  _initializeSymbols() {
    // Entity symbols
    this._registerEntitySymbols();
    
    // Relationship symbols
    this._registerRelationshipSymbols();
    
    // Attribute symbols
    this._registerAttributeSymbols();
    
    // Cardinality symbols
    this._registerCardinalitySymbols();
    
    // Inheritance symbols
    this._registerInheritanceSymbols();
    
    // Constraint symbols
    this._registerConstraintSymbols();
    
    // Special symbols
    this._registerSpecialSymbols();
  }
  
  /**
   * Register entity symbols
   */
  _registerEntitySymbols() {
    // Strong entity
    this.registerSymbol('entity.strong', {
      name: 'Strong Entity',
      category: 'entities',
      render: (ctx, x, y, size, options = {}) => {
        const width = size * 1.5;
        const height = size;
        
        if (this.config.useSVG) {
          return this._createSVGRect(x - width/2, y - height/2, width, height, {
            ...options,
            rx: 4,
            ry: 4
          });
        } else {
          ctx.strokeRect(x - width/2, y - height/2, width, height);
        }
      }
    });
    
    // Weak entity
    this.registerSymbol('entity.weak', {
      name: 'Weak Entity',
      category: 'entities',
      render: (ctx, x, y, size, options = {}) => {
        const width = size * 1.5;
        const height = size;
        const offset = 3;
        
        if (this.config.useSVG) {
          const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
          
          // Outer rectangle
          group.appendChild(this._createSVGRect(x - width/2, y - height/2, width, height, {
            ...options,
            rx: 4,
            ry: 4
          }));
          
          // Inner rectangle
          group.appendChild(this._createSVGRect(
            x - width/2 + offset, 
            y - height/2 + offset, 
            width - offset*2, 
            height - offset*2,
            {
              ...options,
              rx: 2,
              ry: 2
            }
          ));
          
          return group;
        } else {
          ctx.strokeRect(x - width/2, y - height/2, width, height);
          ctx.strokeRect(x - width/2 + offset, y - height/2 + offset, width - offset*2, height - offset*2);
        }
      }
    });
    
    // Associative entity
    this.registerSymbol('entity.associative', {
      name: 'Associative Entity',
      category: 'entities',
      render: (ctx, x, y, size, options = {}) => {
        const width = size * 1.5;
        const height = size;
        
        if (this.config.useSVG) {
          const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
          
          // Rectangle
          group.appendChild(this._createSVGRect(x - width/2, y - height/2, width, height, {
            ...options,
            rx: 4,
            ry: 4
          }));
          
          // Diamond inside
          const diamond = document.createElementNS('http://www.w3.org/2000/svg', 'path');
          const dSize = size * 0.4;
          diamond.setAttribute('d', `
            M ${x - dSize} ${y}
            L ${x} ${y - dSize/2}
            L ${x + dSize} ${y}
            L ${x} ${y + dSize/2}
            Z
          `);
          diamond.setAttribute('stroke', options.stroke || this.config.strokeColor);
          diamond.setAttribute('stroke-width', options.strokeWidth || this.config.strokeWidth);
          diamond.setAttribute('fill', 'none');
          
          group.appendChild(diamond);
          return group;
        }
      }
    });
  }
  
  /**
   * Register relationship symbols
   */
  _registerRelationshipSymbols() {
    // Standard relationship
    this.registerSymbol('relationship.standard', {
      name: 'Relationship',
      category: 'relationships',
      render: (ctx, x, y, size, options = {}) => {
        if (this.config.useSVG) {
          return this._createSVGDiamond(x, y, size, options);
        } else {
          this._drawDiamond(ctx, x, y, size);
        }
      }
    });
    
    // Identifying relationship
    this.registerSymbol('relationship.identifying', {
      name: 'Identifying Relationship',
      category: 'relationships',
      render: (ctx, x, y, size, options = {}) => {
        if (this.config.useSVG) {
          const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
          
          // Outer diamond
          group.appendChild(this._createSVGDiamond(x, y, size, options));
          
          // Inner diamond
          group.appendChild(this._createSVGDiamond(x, y, size * 0.7, {
            ...options,
            strokeWidth: this.config.identifyingRelationshipWidth
          }));
          
          return group;
        }
      }
    });
    
    // Ternary relationship
    this.registerSymbol('relationship.ternary', {
      name: 'Ternary Relationship',
      category: 'relationships',
      render: (ctx, x, y, size, options = {}) => {
        if (this.config.useSVG) {
          const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
          const r = size;
          
          // Create hexagon
          const points = [];
          for (let i = 0; i < 6; i++) {
            const angle = (Math.PI / 3) * i;
            points.push({
              x: x + r * Math.cos(angle),
              y: y + r * Math.sin(angle)
            });
          }
          
          const d = points.map((p, i) => (i === 0 ? 'M' : 'L') + ` ${p.x} ${p.y}`).join(' ') + ' Z';
          path.setAttribute('d', d);
          path.setAttribute('stroke', options.stroke || this.config.strokeColor);
          path.setAttribute('stroke-width', options.strokeWidth || this.config.strokeWidth);
          path.setAttribute('fill', options.fill || this.config.fillColor);
          
          return path;
        }
      }
    });
  }
  
  /**
   * Register attribute symbols
   */
  _registerAttributeSymbols() {
    // Simple attribute
    this.registerSymbol('attribute.simple', {
      name: 'Simple Attribute',
      category: 'attributes',
      render: (ctx, x, y, size, options = {}) => {
        if (this.config.useSVG) {
          return this._createSVGEllipse(x, y, size * 0.8, size * 0.5, options);
        }
      }
    });
    
    // Key attribute
    this.registerSymbol('attribute.key', {
      name: 'Key Attribute',
      category: 'attributes',
      render: (ctx, x, y, size, options = {}) => {
        if (this.config.useSVG) {
          const ellipse = this._createSVGEllipse(x, y, size * 0.8, size * 0.5, options);
          
          // Add underline
          const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
          line.setAttribute('x1', x - size * 0.6);
          line.setAttribute('y1', y + size * 0.3);
          line.setAttribute('x2', x + size * 0.6);
          line.setAttribute('y2', y + size * 0.3);
          line.setAttribute('stroke', options.stroke || this.config.strokeColor);
          line.setAttribute('stroke-width', options.strokeWidth || this.config.strokeWidth);
          
          const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
          group.appendChild(ellipse);
          group.appendChild(line);
          
          return group;
        }
      }
    });
    
    // Multi-valued attribute
    this.registerSymbol('attribute.multivalued', {
      name: 'Multi-valued Attribute',
      category: 'attributes',
      render: (ctx, x, y, size, options = {}) => {
        if (this.config.useSVG) {
          const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
          
          // Outer ellipse
          group.appendChild(this._createSVGEllipse(x, y, size * 0.8, size * 0.5, options));
          
          // Inner ellipse
          group.appendChild(this._createSVGEllipse(x, y, size * 0.65, size * 0.4, options));
          
          return group;
        }
      }
    });
    
    // Derived attribute
    this.registerSymbol('attribute.derived', {
      name: 'Derived Attribute',
      category: 'attributes',
      render: (ctx, x, y, size, options = {}) => {
        if (this.config.useSVG) {
          return this._createSVGEllipse(x, y, size * 0.8, size * 0.5, {
            ...options,
            strokeDasharray: this.config.derivedAttributeDash
          });
        }
      }
    });
    
    // Composite attribute
    this.registerSymbol('attribute.composite', {
      name: 'Composite Attribute',
      category: 'attributes',
      render: (ctx, x, y, size, options = {}) => {
        if (this.config.useSVG) {
          const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
          
          // Main ellipse
          const ellipse = this._createSVGEllipse(x, y, size * 0.8, size * 0.5, options);
          group.appendChild(ellipse);
          
          // Connection points for sub-attributes
          const points = [
            { x: x - size * 0.8, y: y },
            { x: x + size * 0.8, y: y },
            { x: x, y: y - size * 0.5 },
            { x: x, y: y + size * 0.5 }
          ];
          
          points.forEach(point => {
            const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            circle.setAttribute('cx', point.x);
            circle.setAttribute('cy', point.y);
            circle.setAttribute('r', 2);
            circle.setAttribute('fill', options.stroke || this.config.strokeColor);
            group.appendChild(circle);
          });
          
          return group;
        }
      }
    });
  }
  
  /**
   * Register cardinality symbols
   */
  _registerCardinalitySymbols() {
    // One
    this.registerSymbol('cardinality.one', {
      name: 'One (1)',
      category: 'cardinality',
      render: (ctx, x, y, size, options = {}) => {
        if (this.config.useSVG) {
          const text = this._createSVGText(x, y, '1', {
            ...options,
            fontSize: size
          });
          return text;
        }
      }
    });
    
    // Many
    this.registerSymbol('cardinality.many', {
      name: 'Many (N)',
      category: 'cardinality',
      render: (ctx, x, y, size, options = {}) => {
        if (this.config.useSVG) {
          const text = this._createSVGText(x, y, 'N', {
            ...options,
            fontSize: size
          });
          return text;
        }
      }
    });
    
    // Zero or one
    this.registerSymbol('cardinality.zero-or-one', {
      name: 'Zero or One (0..1)',
      category: 'cardinality',
      render: (ctx, x, y, size, options = {}) => {
        if (this.config.useSVG) {
          const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
          
          // Circle for zero
          const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
          circle.setAttribute('cx', x - size * 0.3);
          circle.setAttribute('cy', y);
          circle.setAttribute('r', size * 0.2);
          circle.setAttribute('stroke', options.stroke || this.config.strokeColor);
          circle.setAttribute('stroke-width', options.strokeWidth || this.config.strokeWidth);
          circle.setAttribute('fill', 'none');
          
          // Line for one
          const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
          line.setAttribute('x1', x + size * 0.1);
          line.setAttribute('y1', y - size * 0.3);
          line.setAttribute('x2', x + size * 0.1);
          line.setAttribute('y2', y + size * 0.3);
          line.setAttribute('stroke', options.stroke || this.config.strokeColor);
          line.setAttribute('stroke-width', options.strokeWidth || this.config.strokeWidth);
          
          group.appendChild(circle);
          group.appendChild(line);
          
          return group;
        }
      }
    });
    
    // Crow's foot (many)
    this.registerSymbol('cardinality.crows-foot', {
      name: "Crow's Foot (Many)",
      category: 'cardinality',
      render: (ctx, x, y, size, options = {}) => {
        if (this.config.useSVG) {
          const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
          const d = `
            M ${x} ${y}
            L ${x - size * 0.3} ${y - size * 0.3}
            M ${x} ${y}
            L ${x - size * 0.3} ${y}
            M ${x} ${y}
            L ${x - size * 0.3} ${y + size * 0.3}
          `;
          path.setAttribute('d', d);
          path.setAttribute('stroke', options.stroke || this.config.strokeColor);
          path.setAttribute('stroke-width', options.strokeWidth || this.config.strokeWidth);
          path.setAttribute('fill', 'none');
          
          return path;
        }
      }
    });
  }
  
  /**
   * Register inheritance symbols
   */
  _registerInheritanceSymbols() {
    // ISA triangle
    this.registerSymbol('inheritance.isa', {
      name: 'ISA (Is-A)',
      category: 'inheritance',
      render: (ctx, x, y, size, options = {}) => {
        if (this.config.useSVG) {
          const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
          const h = size * 0.866; // height of equilateral triangle
          
          const d = `
            M ${x} ${y - h/2}
            L ${x - size/2} ${y + h/2}
            L ${x + size/2} ${y + h/2}
            Z
          `;
          
          path.setAttribute('d', d);
          path.setAttribute('stroke', options.stroke || this.config.strokeColor);
          path.setAttribute('stroke-width', options.strokeWidth || this.config.strokeWidth);
          path.setAttribute('fill', options.fill || this.config.fillColor);
          
          return path;
        }
      }
    });
    
    // Disjoint
    this.registerSymbol('inheritance.disjoint', {
      name: 'Disjoint',
      category: 'inheritance',
      render: (ctx, x, y, size, options = {}) => {
        if (this.config.useSVG) {
          const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
          
          // Circle with 'd' inside
          const circle = this._createSVGCircle(x, y, size * 0.5, options);
          const text = this._createSVGText(x, y, 'd', {
            ...options,
            fontSize: size * 0.6
          });
          
          group.appendChild(circle);
          group.appendChild(text);
          
          return group;
        }
      }
    });
    
    // Overlapping
    this.registerSymbol('inheritance.overlapping', {
      name: 'Overlapping',
      category: 'inheritance',
      render: (ctx, x, y, size, options = {}) => {
        if (this.config.useSVG) {
          const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
          
          // Circle with 'o' inside
          const circle = this._createSVGCircle(x, y, size * 0.5, options);
          const text = this._createSVGText(x, y, 'o', {
            ...options,
            fontSize: size * 0.6
          });
          
          group.appendChild(circle);
          group.appendChild(text);
          
          return group;
        }
      }
    });
    
    // Union/Category
    this.registerSymbol('inheritance.union', {
      name: 'Union/Category',
      category: 'inheritance',
      render: (ctx, x, y, size, options = {}) => {
        if (this.config.useSVG) {
          const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
          
          // Arc symbol (U shape)
          const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
          const r = size * 0.5;
          
          const d = `
            M ${x - r} ${y - r}
            L ${x - r} ${y}
            A ${r} ${r} 0 0 0 ${x + r} ${y}
            L ${x + r} ${y - r}
          `;
          
          path.setAttribute('d', d);
          path.setAttribute('stroke', options.stroke || this.config.strokeColor);
          path.setAttribute('stroke-width', options.strokeWidth || this.config.strokeWidth);
          path.setAttribute('fill', 'none');
          
          group.appendChild(path);
          
          return group;
        }
      }
    });
  }
  
  /**
   * Register constraint symbols
   */
  _registerConstraintSymbols() {
    // Total participation
    this.registerSymbol('constraint.total', {
      name: 'Total Participation',
      category: 'constraints',
      render: (ctx, x, y, size, options = {}) => {
        if (this.config.useSVG) {
          const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
          line.setAttribute('x1', x - size);
          line.setAttribute('y1', y);
          line.setAttribute('x2', x + size);
          line.setAttribute('y2', y);
          line.setAttribute('stroke', options.stroke || this.config.strokeColor);
          line.setAttribute('stroke-width', (options.strokeWidth || this.config.strokeWidth) * 2);
          
          return line;
        }
      }
    });
    
    // Partial participation
    this.registerSymbol('constraint.partial', {
      name: 'Partial Participation',
      category: 'constraints',
      render: (ctx, x, y, size, options = {}) => {
        if (this.config.useSVG) {
          const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
          line.setAttribute('x1', x - size);
          line.setAttribute('y1', y);
          line.setAttribute('x2', x + size);
          line.setAttribute('y2', y);
          line.setAttribute('stroke', options.stroke || this.config.strokeColor);
          line.setAttribute('stroke-width', options.strokeWidth || this.config.strokeWidth);
          
          return line;
        }
      }
    });
    
    // Existence dependency
    this.registerSymbol('constraint.existence', {
      name: 'Existence Dependency',
      category: 'constraints',
      render: (ctx, x, y, size, options = {}) => {
        if (this.config.useSVG) {
          const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
          
          // Double line
          const line1 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
          line1.setAttribute('x1', x - size);
          line1.setAttribute('y1', y - 2);
          line1.setAttribute('x2', x + size);
          line1.setAttribute('y2', y - 2);
          line1.setAttribute('stroke', options.stroke || this.config.strokeColor);
          line1.setAttribute('stroke-width', options.strokeWidth || this.config.strokeWidth);
          
          const line2 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
          line2.setAttribute('x1', x - size);
          line2.setAttribute('y1', y + 2);
          line2.setAttribute('x2', x + size);
          line2.setAttribute('y2', y + 2);
          line2.setAttribute('stroke', options.stroke || this.config.strokeColor);
          line2.setAttribute('stroke-width', options.strokeWidth || this.config.strokeWidth);
          
          group.appendChild(line1);
          group.appendChild(line2);
          
          return group;
        }
      }
    });
  }
  
  /**
   * Register special symbols
   */
  _registerSpecialSymbols() {
    // Discriminator
    this.registerSymbol('special.discriminator', {
      name: 'Discriminator',
      category: 'special',
      render: (ctx, x, y, size, options = {}) => {
        if (this.config.useSVG) {
          const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
          
          // Circle
          const circle = this._createSVGCircle(x, y, size * 0.4, options);
          
          // Cross inside
          const cross = document.createElementNS('http://www.w3.org/2000/svg', 'path');
          const s = size * 0.25;
          cross.setAttribute('d', `
            M ${x - s} ${y}
            L ${x + s} ${y}
            M ${x} ${y - s}
            L ${x} ${y + s}
          `);
          cross.setAttribute('stroke', options.stroke || this.config.strokeColor);
          cross.setAttribute('stroke-width', options.strokeWidth || this.config.strokeWidth);
          
          group.appendChild(circle);
          group.appendChild(cross);
          
          return group;
        }
      }
    });
    
    // Aggregation
    this.registerSymbol('special.aggregation', {
      name: 'Aggregation',
      category: 'special',
      render: (ctx, x, y, size, options = {}) => {
        if (this.config.useSVG) {
          return this._createSVGDiamond(x, y, size * 0.6, {
            ...options,
            fill: this.config.fillColor
          });
        }
      }
    });
    
    // Composition
    this.registerSymbol('special.composition', {
      name: 'Composition',
      category: 'special',
      render: (ctx, x, y, size, options = {}) => {
        if (this.config.useSVG) {
          return this._createSVGDiamond(x, y, size * 0.6, {
            ...options,
            fill: options.stroke || this.config.strokeColor
          });
        }
      }
    });
  }
  
  /**
   * Initialize symbol presets
   */
  _initializePresets() {
    // Chen notation preset
    this.registerPreset('chen', {
      name: 'Chen Notation',
      symbols: {
        entity: 'entity.strong',
        weakEntity: 'entity.weak',
        relationship: 'relationship.standard',
        attribute: 'attribute.simple',
        keyAttribute: 'attribute.key',
        multivaluedAttribute: 'attribute.multivalued',
        derivedAttribute: 'attribute.derived'
      },
      styles: {
        strokeColor: '#2C3E50',
        fillColor: '#ECF0F1',
        fontSize: 12
      }
    });
    
    // Crow's Foot notation preset
    this.registerPreset('crows-foot', {
      name: "Crow's Foot Notation",
      symbols: {
        entity: 'entity.strong',
        relationship: 'relationship.standard',
        one: 'cardinality.one',
        many: 'cardinality.crows-foot',
        zeroOrOne: 'cardinality.zero-or-one'
      },
      styles: {
        strokeColor: '#34495E',
        fillColor: '#FFFFFF',
        fontSize: 11
      }
    });
    
    // UML notation preset
    this.registerPreset('uml', {
      name: 'UML Notation',
      symbols: {
        entity: 'entity.strong',
        association: 'relationship.standard',
        aggregation: 'special.aggregation',
        composition: 'special.composition',
        inheritance: 'inheritance.isa'
      },
      styles: {
        strokeColor: '#000000',
        fillColor: '#FFFFCC',
        fontSize: 10
      }
    });
  }
  
  /**
   * Register a custom symbol
   */
  registerSymbol(id, definition) {
    if (!definition.render || typeof definition.render !== 'function') {
      throw new Error('Symbol must have a render function');
    }
    
    this.symbols.set(id, definition);
    
    // Add to category
    if (definition.category) {
      if (!this.symbolCategories.has(definition.category)) {
        this.symbolCategories.set(definition.category, new Set());
      }
      this.symbolCategories.get(definition.category).add(id);
    }
    
    return id;
  }
  
  /**
   * Register a symbol preset
   */
  registerPreset(id, preset) {
    this.symbolPresets.set(id, preset);
    return id;
  }
  
  /**
   * Get symbol by ID
   */
  getSymbol(id) {
    return this.symbols.get(id) || this.customSymbols.get(id);
  }
  
  /**
   * Get symbols by category
   */
  getSymbolsByCategory(category) {
    const categorySymbols = this.symbolCategories.get(category);
    if (!categorySymbols) return [];
    
    return Array.from(categorySymbols).map(id => ({
      id,
      ...this.getSymbol(id)
    }));
  }
  
  /**
   * Get all categories
   */
  getCategories() {
    return Array.from(this.symbolCategories.keys());
  }
  
  /**
   * Apply preset
   */
  applyPreset(presetId) {
    const preset = this.symbolPresets.get(presetId);
    if (!preset) {
      throw new Error(`Preset ${presetId} not found`);
    }
    
    // Apply styles
    if (preset.styles) {
      Object.assign(this.config, preset.styles);
    }
    
    return preset;
  }
  
  /**
   * Render symbol
   */
  renderSymbol(symbolId, context, x, y, size, options = {}) {
    const symbol = this.getSymbol(symbolId);
    if (!symbol) {
      console.warn(`Symbol ${symbolId} not found`);
      return null;
    }
    
    // Apply scaling
    if (this.config.scaleWithZoom && options.zoom) {
      size *= Math.min(Math.max(options.zoom, this.config.minScale), this.config.maxScale);
    }
    
    // Merge options with defaults
    const renderOptions = {
      stroke: options.stroke || this.config.strokeColor,
      strokeWidth: options.strokeWidth || this.config.strokeWidth,
      fill: options.fill || this.config.fillColor,
      ...options
    };
    
    return symbol.render(context, x, y, size || this.config.defaultSize, renderOptions);
  }
  
  /**
   * Create symbol palette
   */
  createPalette(container, options = {}) {
    const palette = document.createElement('div');
    palette.className = 'er-symbol-palette';
    palette.style.cssText = `
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      padding: 10px;
      background: #f5f5f5;
      border-radius: 4px;
    `;
    
    const categories = options.categories || this.getCategories();
    
    categories.forEach(category => {
      const categoryDiv = document.createElement('div');
      categoryDiv.className = 'symbol-category';
      categoryDiv.style.cssText = `
        flex: 1;
        min-width: 150px;
      `;
      
      const title = document.createElement('h4');
      title.textContent = category.charAt(0).toUpperCase() + category.slice(1);
      title.style.cssText = `
        margin: 0 0 10px 0;
        font-size: 14px;
        color: #333;
      `;
      categoryDiv.appendChild(title);
      
      const symbols = this.getSymbolsByCategory(category);
      const symbolsDiv = document.createElement('div');
      symbolsDiv.style.cssText = `
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(40px, 1fr));
        gap: 5px;
      `;
      
      symbols.forEach(symbol => {
        const symbolDiv = document.createElement('div');
        symbolDiv.className = 'symbol-item';
        symbolDiv.setAttribute('data-symbol-id', symbol.id);
        symbolDiv.style.cssText = `
          width: 40px;
          height: 40px;
          border: 1px solid #ddd;
          background: white;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 3px;
        `;
        symbolDiv.title = symbol.name;
        
        // Create mini SVG for preview
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('width', '30');
        svg.setAttribute('height', '30');
        svg.setAttribute('viewBox', '-15 -15 30 30');
        
        const element = this.renderSymbol(symbol.id, null, 0, 0, 10);
        if (element) {
          svg.appendChild(element);
        }
        
        symbolDiv.appendChild(svg);
        
        // Add click handler
        symbolDiv.addEventListener('click', () => {
          if (options.onSymbolSelect) {
            options.onSymbolSelect(symbol.id, symbol);
          }
        });
        
        // Add hover effect
        symbolDiv.addEventListener('mouseenter', () => {
          symbolDiv.style.background = '#e8f4f8';
          symbolDiv.style.borderColor = '#4a90e2';
        });
        
        symbolDiv.addEventListener('mouseleave', () => {
          symbolDiv.style.background = 'white';
          symbolDiv.style.borderColor = '#ddd';
        });
        
        symbolsDiv.appendChild(symbolDiv);
      });
      
      categoryDiv.appendChild(symbolsDiv);
      palette.appendChild(categoryDiv);
    });
    
    container.appendChild(palette);
    return palette;
  }
  
  // SVG helper methods
  
  _createSVGRect(x, y, width, height, options = {}) {
    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('x', x);
    rect.setAttribute('y', y);
    rect.setAttribute('width', width);
    rect.setAttribute('height', height);
    rect.setAttribute('stroke', options.stroke || this.config.strokeColor);
    rect.setAttribute('stroke-width', options.strokeWidth || this.config.strokeWidth);
    rect.setAttribute('fill', options.fill || this.config.fillColor);
    
    if (options.rx) rect.setAttribute('rx', options.rx);
    if (options.ry) rect.setAttribute('ry', options.ry);
    if (options.strokeDasharray) rect.setAttribute('stroke-dasharray', options.strokeDasharray);
    
    return rect;
  }
  
  _createSVGCircle(x, y, r, options = {}) {
    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('cx', x);
    circle.setAttribute('cy', y);
    circle.setAttribute('r', r);
    circle.setAttribute('stroke', options.stroke || this.config.strokeColor);
    circle.setAttribute('stroke-width', options.strokeWidth || this.config.strokeWidth);
    circle.setAttribute('fill', options.fill || this.config.fillColor);
    
    if (options.strokeDasharray) circle.setAttribute('stroke-dasharray', options.strokeDasharray);
    
    return circle;
  }
  
  _createSVGEllipse(x, y, rx, ry, options = {}) {
    const ellipse = document.createElementNS('http://www.w3.org/2000/svg', 'ellipse');
    ellipse.setAttribute('cx', x);
    ellipse.setAttribute('cy', y);
    ellipse.setAttribute('rx', rx);
    ellipse.setAttribute('ry', ry);
    ellipse.setAttribute('stroke', options.stroke || this.config.strokeColor);
    ellipse.setAttribute('stroke-width', options.strokeWidth || this.config.strokeWidth);
    ellipse.setAttribute('fill', options.fill || this.config.fillColor);
    
    if (options.strokeDasharray) ellipse.setAttribute('stroke-dasharray', options.strokeDasharray);
    
    return ellipse;
  }
  
  _createSVGDiamond(x, y, size, options = {}) {
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    const d = `
      M ${x - size} ${y}
      L ${x} ${y - size * 0.6}
      L ${x + size} ${y}
      L ${x} ${y + size * 0.6}
      Z
    `;
    path.setAttribute('d', d);
    path.setAttribute('stroke', options.stroke || this.config.strokeColor);
    path.setAttribute('stroke-width', options.strokeWidth || this.config.strokeWidth);
    path.setAttribute('fill', options.fill || this.config.fillColor);
    
    if (options.strokeDasharray) path.setAttribute('stroke-dasharray', options.strokeDasharray);
    
    return path;
  }
  
  _createSVGText(x, y, text, options = {}) {
    const textElement = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    textElement.setAttribute('x', x);
    textElement.setAttribute('y', y);
    textElement.setAttribute('text-anchor', 'middle');
    textElement.setAttribute('dominant-baseline', 'middle');
    textElement.setAttribute('font-size', options.fontSize || this.config.fontSize);
    textElement.setAttribute('font-family', options.fontFamily || this.config.fontFamily);
    textElement.setAttribute('fill', options.fill || this.config.textColor);
    textElement.textContent = text;
    
    return textElement;
  }
  
  _drawDiamond(ctx, x, y, size) {
    ctx.beginPath();
    ctx.moveTo(x - size, y);
    ctx.lineTo(x, y - size * 0.6);
    ctx.lineTo(x + size, y);
    ctx.lineTo(x, y + size * 0.6);
    ctx.closePath();
    ctx.stroke();
  }
  
  /**
   * Export symbol library
   */
  exportLibrary() {
    const symbols = Array.from(this.symbols.entries()).map(([id, def]) => ({
      id,
      name: def.name,
      category: def.category
    }));
    
    const presets = Array.from(this.symbolPresets.entries()).map(([id, preset]) => ({
      id,
      ...preset
    }));
    
    return {
      symbols,
      presets,
      categories: this.getCategories(),
      config: this.config
    };
  }
  
  /**
   * Import symbol library
   */
  importLibrary(data) {
    if (data.symbols) {
      // Would need to reconstruct render functions
      console.warn('Symbol import requires render function reconstruction');
    }
    
    if (data.presets) {
      data.presets.forEach(preset => {
        this.registerPreset(preset.id, preset);
      });
    }
    
    if (data.config) {
      Object.assign(this.config, data.config);
    }
  }
  
  /**
   * Get statistics
   */
  getStats() {
    return {
      totalSymbols: this.symbols.size,
      customSymbols: this.customSymbols.size,
      categories: this.symbolCategories.size,
      presets: this.symbolPresets.size
    };
  }
  
  /**
   * Destroy and cleanup
   */
  destroy() {
    this.symbols.clear();
    this.symbolCategories.clear();
    this.symbolPresets.clear();
    this.customSymbols.clear();
  }
}

export default ERSymbolLibrary;