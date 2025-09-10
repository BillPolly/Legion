/**
 * AttributeRenderer
 * 
 * Specialized renderer for UML class attributes with proper formatting and visual styling
 * Handles visibility modifiers, data types, multiplicity, constraints, and stereotypes
 */

export class AttributeRenderer {
  constructor(config = {}) {
    this.config = {
      // Visual styling
      fontSize: config.fontSize || 11,
      fontFamily: config.fontFamily || 'Arial, sans-serif',
      lineHeight: config.lineHeight || 18,
      textColor: config.textColor || '#000000',
      
      // Attribute spacing and padding
      attributePadding: config.attributePadding || 8,
      indentSize: config.indentSize || 16,
      
      // Visual options
      showVisibility: config.showVisibility !== false,
      showTypes: config.showTypes !== false,
      showMultiplicity: config.showMultiplicity !== false,
      showConstraints: config.showConstraints !== false,
      showStereotypes: config.showStereotypes !== false,
      showDefaultValues: config.showDefaultValues !== false,
      
      // Grouping and organization
      groupByVisibility: config.groupByVisibility === true,
      sortAlphabetically: config.sortAlphabetically === true,
      showSeparators: config.showSeparators === true,
      
      // UML compliance
      useUMLNotation: config.useUMLNotation !== false,
      underlineStatic: config.underlineStatic !== false,
      italicizeAbstract: config.italicizeAbstract !== false,
      
      // Colors for different attribute types
      staticColor: config.staticColor || '#666666',
      abstractColor: config.abstractColor || '#666666',
      derivedColor: config.derivedColor || '#008000',
      constraintColor: config.constraintColor || '#800080',
      
      ...config
    };
    
    this.visibilitySymbols = {
      'public': '+',
      'private': '-',
      'protected': '#',
      'package': '~'
    };
    
    this.renderedAttributes = new Map();
  }
  
  /**
   * Render attributes for a class compartment
   */
  renderAttributes(attributes, x, y, width, svgGroup) {
    if (!attributes || attributes.length === 0) {
      return 0; // Return height used
    }
    
    this.renderedAttributes.clear();
    
    // Process and organize attributes
    const processedAttributes = this._processAttributes(attributes);
    const organizedAttributes = this._organizeAttributes(processedAttributes);
    
    let currentY = y + this.config.attributePadding;
    let maxHeight = 0;
    
    // Render each attribute group
    for (const [groupName, groupAttributes] of organizedAttributes) {
      if (groupAttributes.length === 0) continue;
      
      // Render group separator if needed
      if (this.config.showSeparators && this.config.groupByVisibility && groupName !== 'public') {
        currentY += 4; // Small gap between visibility groups
      }
      
      // Render attributes in this group
      for (const attribute of groupAttributes) {
        const attrHeight = this._renderSingleAttribute(attribute, x, currentY, width, svgGroup);
        currentY += attrHeight;
        maxHeight += attrHeight;
      }
    }
    
    return Math.max(maxHeight + this.config.attributePadding * 2, this.config.lineHeight);
  }
  
  /**
   * Render a single attribute
   * @private
   */
  _renderSingleAttribute(attribute, x, y, width, svgGroup) {
    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    group.setAttribute('class', 'uml-attribute');
    group.setAttribute('data-attribute-id', attribute.id);
    
    // Format attribute text
    const formattedText = this._formatAttributeText(attribute);
    
    // Determine text styling
    const textStyle = this._getAttributeTextStyle(attribute);
    
    // Create text element
    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.setAttribute('x', x + this.config.attributePadding);
    text.setAttribute('y', y + this.config.lineHeight / 2);
    text.setAttribute('font-family', textStyle.fontFamily || this.config.fontFamily);
    text.setAttribute('font-size', textStyle.fontSize || this.config.fontSize);
    text.setAttribute('font-weight', textStyle.fontWeight || 'normal');
    text.setAttribute('font-style', textStyle.fontStyle || 'normal');
    text.setAttribute('text-decoration', textStyle.textDecoration || 'none');
    text.setAttribute('fill', textStyle.color || this.config.textColor);
    text.setAttribute('text-anchor', 'start');
    text.setAttribute('dominant-baseline', 'central');
    text.textContent = formattedText;
    
    group.appendChild(text);
    
    // Add constraint annotations if any
    if (this.config.showConstraints && attribute.constraints && attribute.constraints.length > 0) {
      this._renderConstraintAnnotations(attribute.constraints, x, y, width, group);
    }
    
    svgGroup.appendChild(group);
    
    // Store rendered attribute info
    this.renderedAttributes.set(attribute.id, {
      element: group,
      bounds: { x, y, width, height: this.config.lineHeight },
      formattedText
    });
    
    return this.config.lineHeight;
  }
  
  /**
   * Format attribute text according to UML conventions
   * @private
   */
  _formatAttributeText(attribute) {
    let text = '';
    
    // Add stereotype if present
    if (this.config.showStereotypes && attribute.stereotype) {
      text += `<<${attribute.stereotype}>> `;
    }
    
    // Add visibility symbol
    if (this.config.showVisibility) {
      const visibility = attribute.visibility || 'public';
      text += this.visibilitySymbols[visibility] || '+';
    }
    
    // Add attribute name
    const name = attribute.name || attribute.id || 'unnamed';
    text += name;
    
    // Add multiplicity if present
    if (this.config.showMultiplicity && attribute.multiplicity) {
      text += `[${this._formatMultiplicity(attribute.multiplicity)}]`;
    }
    
    // Add type if present
    if (this.config.showTypes && attribute.type) {
      text += `: ${attribute.type}`;
    }
    
    // Add default value if present
    if (this.config.showDefaultValues && attribute.defaultValue !== undefined) {
      text += ` = ${attribute.defaultValue}`;
    }
    
    // Add property strings (e.g., {readOnly}, {unique})
    if (this.config.showConstraints && attribute.properties && attribute.properties.length > 0) {
      const propertyText = attribute.properties.map(p => `{${p}}`).join(' ');
      text += ` ${propertyText}`;
    }
    
    return text;
  }
  
  /**
   * Get text styling for attribute based on its properties
   * @private
   */
  _getAttributeTextStyle(attribute) {
    const style = {};
    
    // Static attributes
    if ((attribute.static || attribute.isStatic) && this.config.underlineStatic) {
      style.textDecoration = 'underline';
    }
    
    // Abstract attributes (rare but possible)
    if ((attribute.abstract || attribute.isAbstract) && this.config.italicizeAbstract) {
      style.fontStyle = 'italic';
    }
    
    // Derived attributes (shown with /)
    if (attribute.derived || attribute.isDerived) {
      style.color = this.config.derivedColor;
      style.fontStyle = 'italic';
    }
    
    // Static attributes get different color
    if (attribute.static || attribute.isStatic) {
      style.color = this.config.staticColor;
    }
    
    return style;
  }
  
  /**
   * Process raw attributes into standardized format
   * @private
   */
  _processAttributes(attributes) {
    return attributes.map(attr => {
      const processed = { ...attr };
      
      // Normalize visibility
      processed.visibility = processed.visibility || 'public';
      
      // Handle derived attributes (name starting with /)
      if (processed.name && processed.name.startsWith('/')) {
        processed.derived = true;
        processed.name = processed.name.substring(1);
      }
      
      // Parse multiplicity if it's a string
      if (typeof processed.multiplicity === 'string') {
        processed.multiplicity = this._parseMultiplicity(processed.multiplicity);
      }
      
      // Ensure constraints array
      if (processed.constraints && !Array.isArray(processed.constraints)) {
        processed.constraints = [processed.constraints];
      }
      
      // Ensure properties array
      if (processed.properties && !Array.isArray(processed.properties)) {
        processed.properties = [processed.properties];
      }
      
      return processed;
    });
  }
  
  /**
   * Organize attributes by visibility or other grouping
   * @private
   */
  _organizeAttributes(attributes) {
    const organized = new Map();
    
    if (this.config.groupByVisibility) {
      // Group by visibility
      organized.set('public', []);
      organized.set('protected', []);
      organized.set('package', []);
      organized.set('private', []);
      
      for (const attr of attributes) {
        const visibility = attr.visibility || 'public';
        if (organized.has(visibility)) {
          organized.get(visibility).push(attr);
        } else {
          organized.get('public').push(attr);
        }
      }
      
      // Sort within each group if needed
      if (this.config.sortAlphabetically) {
        for (const [, groupAttrs] of organized) {
          groupAttrs.sort((a, b) => (a.name || a.id || '').localeCompare(b.name || b.id || ''));
        }
      }
    } else {
      // Single group
      let sortedAttributes = [...attributes];
      if (this.config.sortAlphabetically) {
        sortedAttributes.sort((a, b) => (a.name || a.id || '').localeCompare(b.name || b.id || ''));
      }
      organized.set('all', sortedAttributes);
    }
    
    return organized;
  }
  
  /**
   * Parse multiplicity string into structured format
   * @private
   */
  _parseMultiplicity(multiplicity) {
    if (!multiplicity || typeof multiplicity !== 'string') {
      return null;
    }
    
    const str = multiplicity.trim();
    
    // Handle range formats: 1..*, 0..1, 1..5
    const rangeMatch = str.match(/^(\d+)\.\.(\d+|\*)$/);
    if (rangeMatch) {
      return {
        min: parseInt(rangeMatch[1]),
        max: rangeMatch[2] === '*' ? Infinity : parseInt(rangeMatch[2])
      };
    }
    
    // Handle single values
    if (/^\d+$/.test(str)) {
      const num = parseInt(str);
      return { min: num, max: num };
    }
    
    // Handle special cases
    if (str === '*') {
      return { min: 0, max: Infinity };
    }
    
    // Return as-is for complex expressions
    return { expression: str };
  }
  
  /**
   * Format multiplicity for display
   * @private
   */
  _formatMultiplicity(multiplicity) {
    if (!multiplicity) return '';
    
    if (multiplicity.expression) {
      return multiplicity.expression;
    }
    
    if (multiplicity.min !== undefined && multiplicity.max !== undefined) {
      if (multiplicity.min === multiplicity.max) {
        return multiplicity.min.toString();
      }
      
      const max = multiplicity.max === Infinity ? '*' : multiplicity.max.toString();
      return `${multiplicity.min}..${max}`;
    }
    
    return multiplicity.toString();
  }
  
  /**
   * Render constraint annotations
   * @private
   */
  _renderConstraintAnnotations(constraints, x, y, width, group) {
    // For now, constraints are included in the main text
    // Future enhancement could show them as separate visual elements
    return;
  }
  
  /**
   * Calculate total height needed for attributes
   */
  calculateAttributesHeight(attributes) {
    if (!attributes || attributes.length === 0) {
      return 0;
    }
    
    const processedAttributes = this._processAttributes(attributes);
    const organizedAttributes = this._organizeAttributes(processedAttributes);
    
    let totalHeight = this.config.attributePadding * 2;
    let groupCount = 0;
    
    for (const [, groupAttributes] of organizedAttributes) {
      if (groupAttributes.length === 0) continue;
      
      groupCount++;
      totalHeight += groupAttributes.length * this.config.lineHeight;
      
      // Add separator space between groups
      if (this.config.showSeparators && this.config.groupByVisibility && groupCount > 1) {
        totalHeight += 4;
      }
    }
    
    return Math.max(totalHeight, this.config.lineHeight);
  }
  
  /**
   * Validate attribute data
   */
  validateAttribute(attribute) {
    const errors = [];
    const warnings = [];
    
    // Check for required fields
    if (!attribute.name && !attribute.id) {
      errors.push('Attribute must have a name or id');
    }
    
    // Validate visibility
    if (attribute.visibility && !Object.keys(this.visibilitySymbols).includes(attribute.visibility)) {
      warnings.push(`Unknown visibility: ${attribute.visibility}`);
    }
    
    // Validate multiplicity
    if (attribute.multiplicity && typeof attribute.multiplicity === 'string') {
      const parsed = this._parseMultiplicity(attribute.multiplicity);
      if (!parsed) {
        warnings.push(`Invalid multiplicity format: ${attribute.multiplicity}`);
      }
    }
    
    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }
  
  /**
   * Get rendered attribute information
   */
  getRenderedAttribute(attributeId) {
    return this.renderedAttributes.get(attributeId);
  }
  
  /**
   * Get all rendered attributes
   */
  getAllRenderedAttributes() {
    return Array.from(this.renderedAttributes.values());
  }
  
  /**
   * Clear rendered attributes cache
   */
  clearRenderedAttributes() {
    this.renderedAttributes.clear();
  }
  
  /**
   * Update configuration
   */
  updateConfiguration(newConfig) {
    this.config = { ...this.config, ...newConfig };
  }
  
  /**
   * Get available visibility types
   */
  getVisibilityTypes() {
    return Object.keys(this.visibilitySymbols);
  }
  
  /**
   * Create sample attributes for testing
   */
  createSampleAttributes() {
    return [
      {
        id: 'attr1',
        name: 'name',
        type: 'String',
        visibility: 'private',
        multiplicity: '1'
      },
      {
        id: 'attr2',
        name: 'age',
        type: 'int',
        visibility: 'protected',
        defaultValue: '0'
      },
      {
        id: 'attr3',
        name: 'isActive',
        type: 'boolean',
        visibility: 'public',
        properties: ['readOnly']
      },
      {
        id: 'attr4',
        name: 'id',
        type: 'UUID',
        visibility: 'public',
        static: true,
        stereotype: 'unique'
      }
    ];
  }
}

export default AttributeRenderer;