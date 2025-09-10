/**
 * ClassDiagramRenderer
 * 
 * Renders UML Class Diagrams with proper class boxes, compartments, and relationships
 * Supports inheritance, composition, aggregation, association, and dependency relationships
 */

export class ClassDiagramRenderer {
  constructor(config = {}) {
    this.config = {
      // Class box styling
      classWidth: config.classWidth || 200,
      classMinHeight: config.classMinHeight || 100,
      compartmentPadding: config.compartmentPadding || 8,
      attributeHeight: config.attributeHeight || 20,
      methodHeight: config.methodHeight || 20,
      
      // Colors and styling
      classBackgroundColor: config.classBackgroundColor || '#ffffff',
      classBorderColor: config.classBorderColor || '#000000',
      abstractClassColor: config.abstractClassColor || '#e6f3ff',
      interfaceColor: config.interfaceColor || '#ffe6cc',
      stereotypeColor: config.stereotypeColor || '#cccccc',
      
      // Fonts
      fontFamily: config.fontFamily || 'Arial, sans-serif',
      classNameFontSize: config.classNameFontSize || 14,
      attributeFontSize: config.attributeFontSize || 11,
      methodFontSize: config.methodFontSize || 11,
      stereotypeFontSize: config.stereotypeFontSize || 10,
      
      // Line styling
      borderWidth: config.borderWidth || 2,
      compartmentSeparatorWidth: config.compartmentSeparatorWidth || 1,
      
      // Relationship styling
      relationshipColor: config.relationshipColor || '#000000',
      relationshipWidth: config.relationshipWidth || 1.5,
      arrowSize: config.arrowSize || 10,
      
      // Layout options
      showAttributes: config.showAttributes !== false,
      showMethods: config.showMethods !== false,
      showStereotypes: config.showStereotypes !== false,
      showVisibility: config.showVisibility !== false,
      showTypes: config.showTypes !== false,
      showMultiplicity: config.showMultiplicity !== false,
      
      // UML options
      useUMLNotation: config.useUMLNotation !== false,
      showAccessorMethods: config.showAccessorMethods === true,
      groupByVisibility: config.groupByVisibility === true,
      
      ...config
    };
    
    this.renderedClasses = new Map();
    this.renderedRelationships = new Set();
    this.classPositions = new Map();
  }
  
  /**
   * Render complete class diagram
   */
  renderClassDiagram(diagram, svgGroup, containerBounds) {
    if (!diagram || !svgGroup) {
      throw new Error('Invalid diagram or SVG group');
    }
    
    // Clear previous renders
    this.renderedClasses.clear();
    this.renderedRelationships.clear();
    this.classPositions.clear();
    
    // Extract diagram elements
    const classes = this._extractClasses(diagram);
    const relationships = this._extractRelationships(diagram);
    
    // Calculate layout positions
    const layout = this._calculateLayout(classes, relationships, containerBounds);
    
    // Render classes first
    for (const classData of classes) {
      const position = layout.classes.get(classData.id);
      if (position) {
        this._renderClass(classData, position.x, position.y, svgGroup);
      }
    }
    
    // Render relationships
    for (const relationship of relationships) {
      this._renderRelationship(relationship, svgGroup);
    }
    
    return {
      bounds: layout.bounds,
      classCount: classes.length,
      relationshipCount: relationships.length
    };
  }
  
  /**
   * Render individual class
   * @private
   */
  _renderClass(classData, x, y, svgGroup) {
    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    group.setAttribute('class', 'uml-class');
    group.setAttribute('data-class-id', classData.id);
    
    // Calculate compartments
    const compartments = this._calculateCompartments(classData);
    const totalHeight = compartments.totalHeight;
    
    // Determine background color based on class type
    const backgroundColor = this._getClassBackgroundColor(classData);
    
    // Main class rectangle
    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('x', x);
    rect.setAttribute('y', y);
    rect.setAttribute('width', this.config.classWidth);
    rect.setAttribute('height', totalHeight);
    rect.setAttribute('fill', backgroundColor);
    rect.setAttribute('stroke', this.config.classBorderColor);
    rect.setAttribute('stroke-width', this.config.borderWidth);
    rect.setAttribute('rx', 4);
    group.appendChild(rect);
    
    let currentY = y;
    
    // Render name compartment
    currentY += this._renderNameCompartment(
      classData, 
      x, 
      currentY, 
      this.config.classWidth,
      compartments.nameHeight,
      group
    );
    
    // Render attributes compartment
    if (this.config.showAttributes && compartments.attributes.length > 0) {
      this._renderSeparator(x, currentY, this.config.classWidth, group);
      currentY += this._renderAttributesCompartment(
        compartments.attributes,
        x,
        currentY,
        this.config.classWidth,
        compartments.attributesHeight,
        group
      );
    }
    
    // Render methods compartment
    if (this.config.showMethods && compartments.methods.length > 0) {
      this._renderSeparator(x, currentY, this.config.classWidth, group);
      this._renderMethodsCompartment(
        compartments.methods,
        x,
        currentY,
        this.config.classWidth,
        compartments.methodsHeight,
        group
      );
    }
    
    svgGroup.appendChild(group);
    
    // Store rendered class information
    this.renderedClasses.set(classData.id, {
      element: group,
      bounds: { 
        x, 
        y, 
        width: this.config.classWidth, 
        height: totalHeight 
      },
      connectionPoints: this._calculateConnectionPoints(
        x, 
        y, 
        this.config.classWidth, 
        totalHeight
      )
    });
    
    this.classPositions.set(classData.id, { x, y, width: this.config.classWidth, height: totalHeight });
  }
  
  /**
   * Render class name compartment
   * @private
   */
  _renderNameCompartment(classData, x, y, width, height, group) {
    let currentY = y + this.config.compartmentPadding;
    
    // Render stereotype if present
    if (this.config.showStereotypes && classData.stereotype) {
      const stereoText = this._createTextElement(
        `<<${classData.stereotype}>>`,
        x + width / 2,
        currentY,
        {
          fontSize: this.config.stereotypeFontSize,
          textAnchor: 'middle',
          fontStyle: 'italic',
          fill: this.config.stereotypeColor
        }
      );
      group.appendChild(stereoText);
      currentY += this.config.stereotypeFontSize + 4;
    }
    
    // Render class name
    const className = classData.name || classData.id;
    const nameStyle = {
      fontSize: this.config.classNameFontSize,
      textAnchor: 'middle',
      fontWeight: 'bold'
    };
    
    // Abstract classes use italic
    if (classData.abstract || classData.isAbstract) {
      nameStyle.fontStyle = 'italic';
    }
    
    const nameText = this._createTextElement(
      className,
      x + width / 2,
      currentY,
      nameStyle
    );
    group.appendChild(nameText);
    
    return height;
  }
  
  /**
   * Render attributes compartment
   * @private
   */
  _renderAttributesCompartment(attributes, x, y, width, height, group) {
    let currentY = y + this.config.compartmentPadding;
    
    for (const attr of attributes) {
      const attrText = this._formatAttribute(attr);
      const text = this._createTextElement(
        attrText,
        x + this.config.compartmentPadding,
        currentY,
        {
          fontSize: this.config.attributeFontSize,
          textAnchor: 'start'
        }
      );
      group.appendChild(text);
      currentY += this.config.attributeHeight;
    }
    
    return height;
  }
  
  /**
   * Render methods compartment
   * @private
   */
  _renderMethodsCompartment(methods, x, y, width, height, group) {
    let currentY = y + this.config.compartmentPadding;
    
    for (const method of methods) {
      const methodText = this._formatMethod(method);
      const textStyle = {
        fontSize: this.config.methodFontSize,
        textAnchor: 'start'
      };
      
      // Abstract methods use italic
      if (method.abstract || method.isAbstract) {
        textStyle.fontStyle = 'italic';
      }
      
      const text = this._createTextElement(
        methodText,
        x + this.config.compartmentPadding,
        currentY,
        textStyle
      );
      group.appendChild(text);
      currentY += this.config.methodHeight;
    }
    
    return height;
  }
  
  /**
   * Render compartment separator line
   * @private
   */
  _renderSeparator(x, y, width, group) {
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', x);
    line.setAttribute('y1', y);
    line.setAttribute('x2', x + width);
    line.setAttribute('y2', y);
    line.setAttribute('stroke', this.config.classBorderColor);
    line.setAttribute('stroke-width', this.config.compartmentSeparatorWidth);
    group.appendChild(line);
  }
  
  /**
   * Render relationship between classes
   * @private
   */
  _renderRelationship(relationship, svgGroup) {
    const sourceClass = this.renderedClasses.get(relationship.source || relationship.from);
    const targetClass = this.renderedClasses.get(relationship.target || relationship.to);
    
    if (!sourceClass || !targetClass) {
      return; // Skip if classes not found
    }
    
    const relationshipId = `${relationship.source || relationship.from}-${relationship.target || relationship.to}-${relationship.type}`;
    if (this.renderedRelationships.has(relationshipId)) {
      return; // Already rendered
    }
    
    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    group.setAttribute('class', `uml-relationship uml-${relationship.type}`);
    group.setAttribute('data-relationship-id', relationshipId);
    
    // Calculate connection points
    const sourcePoint = this._findOptimalConnectionPoint(
      sourceClass.bounds,
      targetClass.bounds
    );
    const targetPoint = this._findOptimalConnectionPoint(
      targetClass.bounds,
      sourceClass.bounds
    );
    
    // Render relationship line
    this._renderRelationshipLine(
      relationship,
      sourcePoint,
      targetPoint,
      group
    );
    
    // Render arrowheads and decorations
    this._renderRelationshipDecorations(
      relationship,
      sourcePoint,
      targetPoint,
      group
    );
    
    // Render labels
    this._renderRelationshipLabels(
      relationship,
      sourcePoint,
      targetPoint,
      group
    );
    
    svgGroup.appendChild(group);
    this.renderedRelationships.add(relationshipId);
  }
  
  /**
   * Calculate compartments for a class
   * @private
   */
  _calculateCompartments(classData) {
    const attributes = this._extractAttributes(classData);
    const methods = this._extractMethods(classData);
    
    // Calculate name compartment height
    let nameHeight = this.config.compartmentPadding * 2 + this.config.classNameFontSize;
    if (this.config.showStereotypes && classData.stereotype) {
      nameHeight += this.config.stereotypeFontSize + 4;
    }
    
    // Calculate attributes compartment height
    const attributesHeight = this.config.showAttributes && attributes.length > 0
      ? this.config.compartmentPadding * 2 + (attributes.length * this.config.attributeHeight)
      : 0;
    
    // Calculate methods compartment height
    const methodsHeight = this.config.showMethods && methods.length > 0
      ? this.config.compartmentPadding * 2 + (methods.length * this.config.methodHeight)
      : 0;
    
    const totalHeight = Math.max(
      this.config.classMinHeight,
      nameHeight + attributesHeight + methodsHeight
    );
    
    return {
      nameHeight,
      attributesHeight,
      methodsHeight,
      totalHeight,
      attributes,
      methods
    };
  }
  
  /**
   * Get background color based on class type
   * @private
   */
  _getClassBackgroundColor(classData) {
    if (classData.type === 'interface' || classData.interface) {
      return this.config.interfaceColor;
    }
    if (classData.abstract || classData.isAbstract) {
      return this.config.abstractClassColor;
    }
    return this.config.classBackgroundColor;
  }
  
  /**
   * Format attribute for display
   * @private
   */
  _formatAttribute(attr) {
    let result = '';
    
    // Add visibility
    if (this.config.showVisibility) {
      result += this._getVisibilitySymbol(attr.visibility);
    }
    
    // Add name
    result += attr.name || attr.id;
    
    // Add type
    if (this.config.showTypes && attr.type) {
      result += `: ${attr.type}`;
    }
    
    // Add default value
    if (attr.defaultValue !== undefined) {
      result += ` = ${attr.defaultValue}`;
    }
    
    // Add modifiers
    if (attr.static || attr.isStatic) {
      result = `{static} ${result}`;
    }
    
    return result;
  }
  
  /**
   * Format method for display
   * @private
   */
  _formatMethod(method) {
    let result = '';
    
    // Add visibility
    if (this.config.showVisibility) {
      result += this._getVisibilitySymbol(method.visibility);
    }
    
    // Add name
    result += method.name || method.id;
    
    // Add parameters
    const params = method.parameters || method.params || [];
    const paramStrings = params.map(p => {
      let paramStr = p.name || p.id;
      if (this.config.showTypes && p.type) {
        paramStr += `: ${p.type}`;
      }
      return paramStr;
    });
    result += `(${paramStrings.join(', ')})`;
    
    // Add return type
    if (this.config.showTypes && method.returnType) {
      result += `: ${method.returnType}`;
    }
    
    // Add modifiers
    if (method.static || method.isStatic) {
      result = `{static} ${result}`;
    }
    
    return result;
  }
  
  /**
   * Get UML visibility symbol
   * @private
   */
  _getVisibilitySymbol(visibility) {
    const symbols = {
      'public': '+',
      'private': '-',
      'protected': '#',
      'package': '~'
    };
    return symbols[visibility] || '+';
  }
  
  /**
   * Helper methods for extracting data
   * @private
   */
  _extractClasses(diagram) {
    if (diagram.classes) return diagram.classes;
    if (diagram.nodes) return diagram.nodes.filter(n => n.type === 'class');
    return [];
  }
  
  _extractRelationships(diagram) {
    if (diagram.relationships) return diagram.relationships;
    if (diagram.edges) return diagram.edges;
    return [];
  }
  
  _extractAttributes(classData) {
    const attrs = classData.attributes || classData.properties || [];
    return this.config.groupByVisibility 
      ? this._groupByVisibility(attrs)
      : attrs;
  }
  
  _extractMethods(classData) {
    let methods = classData.methods || classData.operations || [];
    
    // Filter out accessor methods if not shown
    if (!this.config.showAccessorMethods) {
      methods = methods.filter(m => 
        !m.name?.match(/^(get|set)[A-Z]/) && 
        !m.accessor
      );
    }
    
    return this.config.groupByVisibility 
      ? this._groupByVisibility(methods)
      : methods;
  }
  
  /**
   * Group elements by visibility
   * @private
   */
  _groupByVisibility(elements) {
    const groups = {
      'public': [],
      'protected': [],
      'private': [],
      'package': []
    };
    
    for (const element of elements) {
      const visibility = element.visibility || 'public';
      if (groups[visibility]) {
        groups[visibility].push(element);
      } else {
        groups.public.push(element);
      }
    }
    
    // Return in visibility order
    return [
      ...groups.public,
      ...groups.protected,
      ...groups.package,
      ...groups.private
    ];
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
    text.setAttribute('font-size', styleOptions.fontSize || this.config.attributeFontSize);
    text.setAttribute('font-weight', styleOptions.fontWeight || 'normal');
    text.setAttribute('font-style', styleOptions.fontStyle || 'normal');
    text.setAttribute('text-anchor', styleOptions.textAnchor || 'start');
    text.setAttribute('dominant-baseline', styleOptions.dominantBaseline || 'middle');
    text.setAttribute('fill', styleOptions.fill || '#000000');
    text.textContent = content;
    return text;
  }
  
  /**
   * Calculate optimal connection points between classes
   * @private
   */
  _findOptimalConnectionPoint(sourceBounds, targetBounds) {
    const sourceCenter = {
      x: sourceBounds.x + sourceBounds.width / 2,
      y: sourceBounds.y + sourceBounds.height / 2
    };
    
    const targetCenter = {
      x: targetBounds.x + targetBounds.width / 2,
      y: targetBounds.y + targetBounds.height / 2
    };
    
    const dx = targetCenter.x - sourceCenter.x;
    const dy = targetCenter.y - sourceCenter.y;
    
    // Find intersection with source rectangle
    const points = this._calculateConnectionPoints(
      sourceBounds.x,
      sourceBounds.y,
      sourceBounds.width,
      sourceBounds.height
    );
    
    // Choose the closest point to target
    let bestPoint = points.top;
    let bestDistance = Infinity;
    
    for (const point of Object.values(points)) {
      const distance = Math.sqrt(
        Math.pow(point.x - targetCenter.x, 2) + 
        Math.pow(point.y - targetCenter.y, 2)
      );
      if (distance < bestDistance) {
        bestDistance = distance;
        bestPoint = point;
      }
    }
    
    return bestPoint;
  }
  
  /**
   * Calculate connection points for a rectangle
   * @private
   */
  _calculateConnectionPoints(x, y, width, height) {
    return {
      top: { x: x + width / 2, y: y },
      bottom: { x: x + width / 2, y: y + height },
      left: { x: x, y: y + height / 2 },
      right: { x: x + width, y: y + height / 2 }
    };
  }
  
  /**
   * Simple layout calculation (can be enhanced)
   * @private
   */
  _calculateLayout(classes, relationships, containerBounds) {
    const bounds = containerBounds || { x: 0, y: 0, width: 800, height: 600 };
    const classPositions = new Map();
    
    // Simple grid layout for now
    const cols = Math.ceil(Math.sqrt(classes.length));
    const xSpacing = (bounds.width - this.config.classWidth) / Math.max(1, cols - 1);
    const ySpacing = 200;
    
    classes.forEach((classData, index) => {
      const col = index % cols;
      const row = Math.floor(index / cols);
      
      const x = bounds.x + col * xSpacing;
      const y = bounds.y + row * ySpacing;
      
      classPositions.set(classData.id, { x, y });
    });
    
    return {
      classes: classPositions,
      bounds: {
        x: bounds.x,
        y: bounds.y,
        width: bounds.width,
        height: bounds.y + Math.ceil(classes.length / cols) * ySpacing
      }
    };
  }
}

export default ClassDiagramRenderer;