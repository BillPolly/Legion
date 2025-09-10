/**
 * MethodRenderer
 * 
 * Specialized renderer for UML class methods with proper formatting and visual styling
 * Handles visibility modifiers, parameters, return types, stereotypes, and method properties
 */

export class MethodRenderer {
  constructor(config = {}) {
    this.config = {
      // Visual styling
      fontSize: config.fontSize || 11,
      fontFamily: config.fontFamily || 'Arial, sans-serif',
      lineHeight: config.lineHeight || 18,
      textColor: config.textColor || '#000000',
      
      // Method spacing and padding
      methodPadding: config.methodPadding || 8,
      indentSize: config.indentSize || 16,
      parameterSpacing: config.parameterSpacing || 2,
      
      // Visual options
      showVisibility: config.showVisibility !== false,
      showParameters: config.showParameters !== false,
      showParameterTypes: config.showParameterTypes !== false,
      showParameterDefaults: config.showParameterDefaults !== false,
      showReturnTypes: config.showReturnTypes !== false,
      showStereotypes: config.showStereotypes !== false,
      showConstraints: config.showConstraints !== false,
      showAccessorMethods: config.showAccessorMethods === true,
      
      // Grouping and organization
      groupByVisibility: config.groupByVisibility === true,
      groupByType: config.groupByType === true, // constructors, methods, accessors
      sortAlphabetically: config.sortAlphabetically === true,
      showSeparators: config.showSeparators === true,
      
      // UML compliance
      useUMLNotation: config.useUMLNotation !== false,
      underlineStatic: config.underlineStatic !== false,
      italicizeAbstract: config.italicizeAbstract !== false,
      showMultiplicity: config.showMultiplicity !== false,
      
      // Colors for different method types
      constructorColor: config.constructorColor || '#0066cc',
      staticColor: config.staticColor || '#666666',
      abstractColor: config.abstractColor || '#666666',
      virtualColor: config.virtualColor || '#008000',
      constraintColor: config.constraintColor || '#800080',
      
      // Parameter formatting
      maxParametersInline: config.maxParametersInline || 3,
      parameterWrapThreshold: config.parameterWrapThreshold || 60,
      
      ...config
    };
    
    this.visibilitySymbols = {
      'public': '+',
      'private': '-',
      'protected': '#',
      'package': '~'
    };
    
    this.methodTypeOrder = {
      'constructor': 0,
      'method': 1,
      'getter': 2,
      'setter': 3,
      'accessor': 2
    };
    
    this.renderedMethods = new Map();
  }
  
  /**
   * Render methods for a class compartment
   */
  renderMethods(methods, x, y, width, svgGroup) {
    if (!methods || methods.length === 0) {
      return 0; // Return height used
    }
    
    this.renderedMethods.clear();
    
    // Process and organize methods
    const processedMethods = this._processMethods(methods);
    const organizedMethods = this._organizeMethods(processedMethods);
    
    let currentY = y + this.config.methodPadding;
    let maxHeight = 0;
    
    // Render each method group
    for (const [groupName, groupMethods] of organizedMethods) {
      if (groupMethods.length === 0) continue;
      
      // Render group separator if needed
      if (this.config.showSeparators && groupName !== 'public' && groupName !== 'constructor') {
        currentY += 4; // Small gap between groups
      }
      
      // Render methods in this group
      for (const method of groupMethods) {
        const methodHeight = this._renderSingleMethod(method, x, currentY, width, svgGroup);
        currentY += methodHeight;
        maxHeight += methodHeight;
      }
    }
    
    return Math.max(maxHeight + this.config.methodPadding * 2, this.config.lineHeight);
  }
  
  /**
   * Render a single method
   * @private
   */
  _renderSingleMethod(method, x, y, width, svgGroup) {
    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    group.setAttribute('class', 'uml-method');
    group.setAttribute('data-method-id', method.id);
    
    // Format method text
    const formattedText = this._formatMethodText(method);
    
    // Check if method text needs wrapping
    const needsWrapping = this._needsWrapping(formattedText, width);
    
    if (needsWrapping && this.config.showParameters) {
      return this._renderWrappedMethod(method, formattedText, x, y, width, group, svgGroup);
    } else {
      return this._renderInlineMethod(method, formattedText, x, y, width, group, svgGroup);
    }
  }
  
  /**
   * Render method on single line
   * @private
   */
  _renderInlineMethod(method, formattedText, x, y, width, group, svgGroup) {
    // Determine text styling
    const textStyle = this._getMethodTextStyle(method);
    
    // Create text element
    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.setAttribute('x', x + this.config.methodPadding);
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
    svgGroup.appendChild(group);
    
    // Store rendered method info
    this.renderedMethods.set(method.id, {
      element: group,
      bounds: { x, y, width, height: this.config.lineHeight },
      formattedText,
      wrapped: false
    });
    
    return this.config.lineHeight;
  }
  
  /**
   * Render method with parameter wrapping
   * @private
   */
  _renderWrappedMethod(method, formattedText, x, y, width, group, svgGroup) {
    const textStyle = this._getMethodTextStyle(method);
    let currentY = y;
    
    // Render method signature (name, return type)
    const signature = this._getMethodSignature(method);
    const signatureText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    signatureText.setAttribute('x', x + this.config.methodPadding);
    signatureText.setAttribute('y', currentY + this.config.lineHeight / 2);
    signatureText.setAttribute('font-family', textStyle.fontFamily || this.config.fontFamily);
    signatureText.setAttribute('font-size', textStyle.fontSize || this.config.fontSize);
    signatureText.setAttribute('font-weight', textStyle.fontWeight || 'normal');
    signatureText.setAttribute('font-style', textStyle.fontStyle || 'normal');
    signatureText.setAttribute('text-decoration', textStyle.textDecoration || 'none');
    signatureText.setAttribute('fill', textStyle.color || this.config.textColor);
    signatureText.setAttribute('text-anchor', 'start');
    signatureText.setAttribute('dominant-baseline', 'central');
    signatureText.textContent = signature;
    
    group.appendChild(signatureText);
    currentY += this.config.lineHeight;
    
    // Render parameters on separate lines if any
    if (method.parameters && method.parameters.length > 0 && this.config.showParameters) {
      const paramHeight = this._renderMethodParameters(method.parameters, x, currentY, width, group, textStyle);
      currentY += paramHeight;
    }
    
    const totalHeight = currentY - y;
    
    svgGroup.appendChild(group);
    
    // Store rendered method info
    this.renderedMethods.set(method.id, {
      element: group,
      bounds: { x, y, width, height: totalHeight },
      formattedText,
      wrapped: true
    });
    
    return totalHeight;
  }
  
  /**
   * Render method parameters on separate lines
   * @private
   */
  _renderMethodParameters(parameters, x, y, width, group, textStyle) {
    let currentY = y;
    const indentX = x + this.config.methodPadding + this.config.indentSize;
    
    for (let i = 0; i < parameters.length; i++) {
      const param = parameters[i];
      const paramText = this._formatParameter(param, i === parameters.length - 1);
      
      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      text.setAttribute('x', indentX);
      text.setAttribute('y', currentY + this.config.lineHeight / 2);
      text.setAttribute('font-family', textStyle.fontFamily || this.config.fontFamily);
      text.setAttribute('font-size', (textStyle.fontSize || this.config.fontSize) * 0.9); // Slightly smaller
      text.setAttribute('font-weight', 'normal');
      text.setAttribute('font-style', textStyle.fontStyle || 'normal');
      text.setAttribute('fill', textStyle.color || this.config.textColor);
      text.setAttribute('text-anchor', 'start');
      text.setAttribute('dominant-baseline', 'central');
      text.textContent = paramText;
      
      group.appendChild(text);
      currentY += this.config.lineHeight * 0.8; // Tighter spacing for parameters
    }
    
    return currentY - y;
  }
  
  /**
   * Format complete method text according to UML conventions
   * @private
   */
  _formatMethodText(method) {
    let text = '';
    
    // Add stereotype if present
    if (this.config.showStereotypes && method.stereotype) {
      text += `<<${method.stereotype}>> `;
    }
    
    // Add visibility symbol
    if (this.config.showVisibility) {
      const visibility = method.visibility || 'public';
      text += this.visibilitySymbols[visibility] || '+';
    }
    
    // Add method name
    const name = method.name || method.id || 'unnamed';
    text += name;
    
    // Add parameters
    if (this.config.showParameters) {
      const paramText = this._formatParameterList(method.parameters || []);
      text += `(${paramText})`;
    } else {
      text += '()';
    }
    
    // Add return type
    if (this.config.showReturnTypes && method.returnType && method.returnType !== 'void') {
      text += `: ${method.returnType}`;
    }
    
    // Add multiplicity if present
    if (this.config.showMultiplicity && method.multiplicity) {
      text += `[${this._formatMultiplicity(method.multiplicity)}]`;
    }
    
    // Add property strings (e.g., {abstract}, {query})
    if (this.config.showConstraints && method.properties && method.properties.length > 0) {
      const propertyText = method.properties.map(p => `{${p}}`).join(' ');
      text += ` ${propertyText}`;
    }
    
    return text;
  }
  
  /**
   * Get method signature without parameters
   * @private
   */
  _getMethodSignature(method) {
    let text = '';
    
    // Add stereotype if present
    if (this.config.showStereotypes && method.stereotype) {
      text += `<<${method.stereotype}>> `;
    }
    
    // Add visibility symbol
    if (this.config.showVisibility) {
      const visibility = method.visibility || 'public';
      text += this.visibilitySymbols[visibility] || '+';
    }
    
    // Add method name
    const name = method.name || method.id || 'unnamed';
    text += name;
    
    // Add opening parenthesis
    text += '(';
    
    // Add return type
    if (this.config.showReturnTypes && method.returnType && method.returnType !== 'void') {
      text = text.slice(0, -1); // Remove opening paren
      text += `(): ${method.returnType}`;
    } else {
      text = text.slice(0, -1); // Remove opening paren
      text += '()';
    }
    
    return text;
  }
  
  /**
   * Format parameter list for inline display
   * @private
   */
  _formatParameterList(parameters) {
    if (!parameters || parameters.length === 0) {
      return '';
    }
    
    return parameters.map((param, index) => 
      this._formatParameter(param, false)
    ).join(', ');
  }
  
  /**
   * Format individual parameter
   * @private
   */
  _formatParameter(param, isLast = false) {
    let text = '';
    
    // Parameter direction (in, out, inout)
    if (param.direction && param.direction !== 'in') {
      text += `${param.direction} `;
    }
    
    // Parameter name
    const name = param.name || param.id || 'param';
    text += name;
    
    // Parameter type
    if (this.config.showParameterTypes && param.type) {
      text += `: ${param.type}`;
    }
    
    // Parameter multiplicity
    if (this.config.showMultiplicity && param.multiplicity) {
      text += `[${this._formatMultiplicity(param.multiplicity)}]`;
    }
    
    // Default value
    if (this.config.showParameterDefaults && param.defaultValue !== undefined) {
      text += ` = ${param.defaultValue}`;
    }
    
    return text;
  }
  
  /**
   * Get text styling for method based on its properties
   * @private
   */
  _getMethodTextStyle(method) {
    const style = {};
    
    // Constructor methods
    if (method.type === 'constructor' || method.constructor || method.isConstructor) {
      style.color = this.config.constructorColor;
      style.fontWeight = 'bold';
    }
    
    // Static methods
    if ((method.static || method.isStatic) && this.config.underlineStatic) {
      style.textDecoration = 'underline';
      style.color = this.config.staticColor;
    }
    
    // Abstract methods
    if ((method.abstract || method.isAbstract) && this.config.italicizeAbstract) {
      style.fontStyle = 'italic';
      style.color = this.config.abstractColor;
    }
    
    // Virtual methods
    if (method.virtual || method.isVirtual) {
      style.color = this.config.virtualColor;
    }
    
    return style;
  }
  
  /**
   * Process raw methods into standardized format
   * @private
   */
  _processMethods(methods) {
    return methods.filter(method => {
      // Filter accessor methods if not shown
      if (!this.config.showAccessorMethods) {
        if (method.type === 'getter' || method.type === 'setter' || 
            method.name?.match(/^(get|set)[A-Z]/) || method.accessor) {
          return false;
        }
      }
      return true;
    }).map(method => {
      const processed = { ...method };
      
      // Normalize visibility
      processed.visibility = processed.visibility || 'public';
      
      // Detect method type from name if not specified
      if (!processed.type) {
        if (processed.name && processed.name.match(/^(get|set)[A-Z]/)) {
          processed.type = processed.name.startsWith('get') ? 'getter' : 'setter';
        } else if (processed.constructor || processed.isConstructor) {
          processed.type = 'constructor';
        } else {
          processed.type = 'method';
        }
      }
      
      // Parse multiplicity if it's a string
      if (typeof processed.multiplicity === 'string') {
        processed.multiplicity = this._parseMultiplicity(processed.multiplicity);
      }
      
      // Ensure parameters array
      if (!processed.parameters) {
        processed.parameters = [];
      }
      
      // Ensure properties array
      if (processed.properties && !Array.isArray(processed.properties)) {
        processed.properties = [processed.properties];
      }
      
      return processed;
    });
  }
  
  /**
   * Organize methods by visibility and type
   * @private
   */
  _organizeMethods(methods) {
    const organized = new Map();
    
    if (this.config.groupByType) {
      // Group by method type first, then by visibility
      const typeGroups = new Map();
      
      for (const method of methods) {
        const type = method.type || 'method';
        if (!typeGroups.has(type)) {
          typeGroups.set(type, []);
        }
        typeGroups.get(type).push(method);
      }
      
      // Sort type groups by order
      const sortedTypes = Array.from(typeGroups.keys()).sort((a, b) => {
        const orderA = this.methodTypeOrder[a] ?? 999;
        const orderB = this.methodTypeOrder[b] ?? 999;
        return orderA - orderB;
      });
      
      for (const type of sortedTypes) {
        const typeMethods = typeGroups.get(type);
        
        if (this.config.groupByVisibility) {
          // Further group by visibility within type
          const visibilityGroups = this._groupByVisibility(typeMethods);
          for (const [visibility, visMethods] of visibilityGroups) {
            const key = `${type}-${visibility}`;
            organized.set(key, visMethods);
          }
        } else {
          organized.set(type, this._sortMethods(typeMethods));
        }
      }
    } else if (this.config.groupByVisibility) {
      // Group by visibility only
      const visibilityGroups = this._groupByVisibility(methods);
      for (const [visibility, visMethods] of visibilityGroups) {
        organized.set(visibility, visMethods);
      }
    } else {
      // Single group, sorted
      organized.set('all', this._sortMethods(methods));
    }
    
    return organized;
  }
  
  /**
   * Group methods by visibility
   * @private
   */
  _groupByVisibility(methods) {
    const groups = new Map([
      ['public', []],
      ['protected', []],
      ['package', []],
      ['private', []]
    ]);
    
    for (const method of methods) {
      const visibility = method.visibility || 'public';
      if (groups.has(visibility)) {
        groups.get(visibility).push(method);
      } else {
        groups.get('public').push(method);
      }
    }
    
    // Sort within each group and remove empty groups
    const result = new Map();
    for (const [visibility, groupMethods] of groups) {
      if (groupMethods.length > 0) {
        result.set(visibility, this._sortMethods(groupMethods));
      }
    }
    
    return result;
  }
  
  /**
   * Sort methods alphabetically if configured
   * @private
   */
  _sortMethods(methods) {
    if (this.config.sortAlphabetically) {
      return [...methods].sort((a, b) => 
        (a.name || a.id || '').localeCompare(b.name || b.id || '')
      );
    }
    return methods;
  }
  
  /**
   * Check if method text needs wrapping
   * @private
   */
  _needsWrapping(text, width) {
    // Estimate text width (rough approximation)
    const avgCharWidth = this.config.fontSize * 0.6;
    const estimatedWidth = text.length * avgCharWidth + this.config.methodPadding * 2;
    return estimatedWidth > width || text.length > this.config.parameterWrapThreshold;
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
   * Calculate total height needed for methods
   */
  calculateMethodsHeight(methods) {
    if (!methods || methods.length === 0) {
      return 0;
    }
    
    const processedMethods = this._processMethods(methods);
    const organizedMethods = this._organizeMethods(processedMethods);
    
    let totalHeight = this.config.methodPadding * 2;
    let groupCount = 0;
    
    for (const [, groupMethods] of organizedMethods) {
      if (groupMethods.length === 0) continue;
      
      groupCount++;
      
      // Estimate height for each method (accounting for potential wrapping)
      for (const method of groupMethods) {
        const formattedText = this._formatMethodText(method);
        const needsWrapping = formattedText.length > this.config.parameterWrapThreshold;
        
        if (needsWrapping && method.parameters && method.parameters.length > 0) {
          totalHeight += this.config.lineHeight; // Signature line
          totalHeight += method.parameters.length * this.config.lineHeight * 0.8; // Parameter lines
        } else {
          totalHeight += this.config.lineHeight;
        }
      }
      
      // Add separator space between groups
      if (this.config.showSeparators && groupCount > 1) {
        totalHeight += 4;
      }
    }
    
    return Math.max(totalHeight, this.config.lineHeight);
  }
  
  /**
   * Validate method data
   */
  validateMethod(method) {
    const errors = [];
    const warnings = [];
    
    // Check for required fields
    if (!method.name && !method.id) {
      errors.push('Method must have a name or id');
    }
    
    // Validate visibility
    if (method.visibility && !Object.keys(this.visibilitySymbols).includes(method.visibility)) {
      warnings.push(`Unknown visibility: ${method.visibility}`);
    }
    
    // Validate parameters
    if (method.parameters) {
      for (let i = 0; i < method.parameters.length; i++) {
        const param = method.parameters[i];
        if (!param.name && !param.id) {
          warnings.push(`Parameter ${i} missing name`);
        }
      }
    }
    
    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }
  
  /**
   * Get rendered method information
   */
  getRenderedMethod(methodId) {
    return this.renderedMethods.get(methodId);
  }
  
  /**
   * Get all rendered methods
   */
  getAllRenderedMethods() {
    return Array.from(this.renderedMethods.values());
  }
  
  /**
   * Clear rendered methods cache
   */
  clearRenderedMethods() {
    this.renderedMethods.clear();
  }
  
  /**
   * Update configuration
   */
  updateConfiguration(newConfig) {
    this.config = { ...this.config, ...newConfig };
  }
  
  /**
   * Create sample methods for testing
   */
  createSampleMethods() {
    return [
      {
        id: 'constructor1',
        name: 'Person',
        type: 'constructor',
        visibility: 'public',
        parameters: [
          { name: 'name', type: 'String' },
          { name: 'age', type: 'int', defaultValue: '0' }
        ]
      },
      {
        id: 'method1',
        name: 'getName',
        type: 'getter',
        visibility: 'public',
        returnType: 'String',
        parameters: []
      },
      {
        id: 'method2',
        name: 'setName',
        type: 'setter',
        visibility: 'public',
        returnType: 'void',
        parameters: [
          { name: 'name', type: 'String' }
        ]
      },
      {
        id: 'method3',
        name: 'calculateAge',
        type: 'method',
        visibility: 'protected',
        returnType: 'int',
        parameters: [
          { name: 'birthDate', type: 'Date' },
          { name: 'currentDate', type: 'Date', defaultValue: 'new Date()' }
        ],
        abstract: true
      },
      {
        id: 'method4',
        name: 'toString',
        type: 'method',
        visibility: 'public',
        returnType: 'String',
        parameters: [],
        static: false,
        properties: ['override']
      }
    ];
  }
}

export default MethodRenderer;