/**
 * EntityNode - Represents an entity in Entity-Relationship diagrams
 * 
 * Features:
 * - Entity rectangle with rounded corners
 * - Attribute list with key indicators
 * - Primary key highlighting
 * - Foreign key references
 * - Weak entity support (double border)
 * - Entity type classification (strong, weak, associative)
 * - Attribute data types and constraints
 * - Visual customization options
 */

export class EntityNode {
  constructor(config = {}) {
    this.config = {
      // Entity identification
      id: config.id || this._generateId(),
      name: config.name || 'Entity',
      type: config.type || 'strong', // strong, weak, associative
      
      // Position and size
      x: config.x || 0,
      y: config.y || 0,
      width: config.width || 120,
      height: config.height || null, // Auto-calculated based on attributes
      minWidth: config.minWidth || 100,
      minHeight: config.minHeight || 60,
      
      // Attributes
      attributes: config.attributes || [],
      
      // Visual styling
      style: {
        fillColor: config.style?.fillColor || '#E8F4FD',
        strokeColor: config.style?.strokeColor || '#1976D2',
        strokeWidth: config.style?.strokeWidth || 2,
        cornerRadius: config.style?.cornerRadius || 8,
        textColor: config.style?.textColor || '#000000',
        
        // Entity type specific styling
        weakEntityStrokeWidth: config.style?.weakEntityStrokeWidth || 4,
        weakEntityInnerStroke: config.style?.weakEntityInnerStroke || '#FFFFFF',
        associativeEntityDashArray: config.style?.associativeEntityDashArray || '5,5',
        
        // Attribute styling
        attributeSpacing: config.style?.attributeSpacing || 20,
        attributePadding: config.style?.attributePadding || 8,
        keyAttributeColor: config.style?.keyAttributeColor || '#FF6B35',
        foreignKeyColor: config.style?.foreignKeyColor || '#4CAF50',
        derivedAttributeStyle: config.style?.derivedAttributeStyle || 'italic'
      },
      
      // Typography
      typography: {
        entityNameSize: config.typography?.entityNameSize || 14,
        entityNameWeight: config.typography?.entityNameWeight || 'bold',
        attributeSize: config.typography?.attributeSize || 12,
        attributeWeight: config.typography?.attributeWeight || 'normal'
      },
      
      // Behavior
      resizable: config.resizable !== false,
      selectable: config.selectable !== false,
      editable: config.editable !== false,
      
      // Callbacks
      onAttributeChange: config.onAttributeChange || null,
      onEntityTypeChange: config.onEntityTypeChange || null,
      onResize: config.onResize || null,
      
      ...config
    };
    
    // Internal state
    this.element = null;
    this.boundingRect = null;
    this.isSelected = false;
    this.isDragging = false;
    
    // Attribute management
    this.attributeElements = new Map();
    this.primaryKeys = new Set();
    this.foreignKeys = new Set();
    
    // Calculate initial dimensions
    this._calculateDimensions();
  }
  
  /**
   * Generate unique entity ID
   */
  _generateId() {
    return `entity_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  /**
   * Add attribute to entity
   */
  addAttribute(attribute) {
    const attr = {
      name: attribute.name,
      type: attribute.type || 'TEXT',
      isPrimaryKey: attribute.isPrimaryKey || false,
      isForeignKey: attribute.isForeignKey || false,
      isRequired: attribute.isRequired !== false,
      isUnique: attribute.isUnique || false,
      isDerived: attribute.isDerived || false,
      isComposite: attribute.isComposite || false,
      defaultValue: attribute.defaultValue || null,
      constraints: attribute.constraints || [],
      description: attribute.description || '',
      referencedEntity: attribute.referencedEntity || null,
      referencedAttribute: attribute.referencedAttribute || null,
      id: attribute.id || `attr_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`
    };
    
    this.config.attributes.push(attr);
    
    // Update key tracking
    if (attr.isPrimaryKey) {
      this.primaryKeys.add(attr.id);
    }
    if (attr.isForeignKey) {
      this.foreignKeys.add(attr.id);
    }
    
    // Recalculate dimensions
    this._calculateDimensions();
    
    if (this.config.onAttributeChange) {
      this.config.onAttributeChange('add', attr);
    }
    
    return attr;
  }
  
  /**
   * Remove attribute from entity
   */
  removeAttribute(attributeId) {
    const index = this.config.attributes.findIndex(attr => attr.id === attributeId);
    if (index >= 0) {
      const attr = this.config.attributes[index];
      this.config.attributes.splice(index, 1);
      
      // Update key tracking
      this.primaryKeys.delete(attributeId);
      this.foreignKeys.delete(attributeId);
      
      // Recalculate dimensions
      this._calculateDimensions();
      
      if (this.config.onAttributeChange) {
        this.config.onAttributeChange('remove', attr);
      }
      
      return true;
    }
    return false;
  }
  
  /**
   * Update attribute properties
   */
  updateAttribute(attributeId, updates) {
    const attr = this.config.attributes.find(a => a.id === attributeId);
    if (attr) {
      // Update key tracking if changed
      if (updates.isPrimaryKey !== undefined) {
        if (updates.isPrimaryKey) {
          this.primaryKeys.add(attributeId);
        } else {
          this.primaryKeys.delete(attributeId);
        }
      }
      
      if (updates.isForeignKey !== undefined) {
        if (updates.isForeignKey) {
          this.foreignKeys.add(attributeId);
        } else {
          this.foreignKeys.delete(attributeId);
        }
      }
      
      // Apply updates
      Object.assign(attr, updates);
      
      // Recalculate dimensions if name or type changed
      if (updates.name || updates.type) {
        this._calculateDimensions();
      }
      
      if (this.config.onAttributeChange) {
        this.config.onAttributeChange('update', attr);
      }
      
      return attr;
    }
    return null;
  }
  
  /**
   * Get primary key attributes
   */
  getPrimaryKeys() {
    return this.config.attributes.filter(attr => attr.isPrimaryKey);
  }
  
  /**
   * Get foreign key attributes
   */
  getForeignKeys() {
    return this.config.attributes.filter(attr => attr.isForeignKey);
  }
  
  /**
   * Set entity type (strong, weak, associative)
   */
  setEntityType(type) {
    if (['strong', 'weak', 'associative'].includes(type)) {
      this.config.type = type;
      
      if (this.config.onEntityTypeChange) {
        this.config.onEntityTypeChange(type);
      }
      
      return true;
    }
    return false;
  }
  
  /**
   * Calculate entity dimensions based on content
   */
  _calculateDimensions() {
    const { style, typography } = this.config;
    
    // Calculate width based on longest text
    let maxWidth = this._getTextWidth(this.config.name, typography.entityNameSize, typography.entityNameWeight);
    
    for (const attr of this.config.attributes) {
      const attrText = this._formatAttributeText(attr);
      const attrWidth = this._getTextWidth(attrText, typography.attributeSize, typography.attributeWeight);
      maxWidth = Math.max(maxWidth, attrWidth);
    }
    
    // Add padding
    const totalPadding = style.attributePadding * 2;
    this.config.width = Math.max(maxWidth + totalPadding, this.config.minWidth);
    
    // Calculate height
    const headerHeight = typography.entityNameSize + style.attributeSpacing;
    const attributeHeight = this.config.attributes.length * style.attributeSpacing;
    const totalHeight = headerHeight + attributeHeight + totalPadding;
    
    this.config.height = Math.max(totalHeight, this.config.minHeight);
  }
  
  /**
   * Format attribute text for display
   */
  _formatAttributeText(attr) {
    let text = attr.name;
    
    // Add type information
    if (attr.type) {
      text += ` : ${attr.type}`;
    }
    
    // Add key indicators
    if (attr.isPrimaryKey) {
      text = `🔑 ${text}`;
    } else if (attr.isForeignKey) {
      text = `🔗 ${text}`;
    }
    
    // Add required indicator
    if (attr.isRequired && !attr.isPrimaryKey) {
      text += ' *';
    }
    
    // Add unique indicator
    if (attr.isUnique && !attr.isPrimaryKey) {
      text += ' (U)';
    }
    
    // Add derived indicator
    if (attr.isDerived) {
      text = `/${text}/`;
    }
    
    return text;
  }
  
  /**
   * Estimate text width (simple approximation)
   */
  _getTextWidth(text, fontSize, fontWeight = 'normal') {
    const baseWidth = fontSize * 0.6; // Rough approximation
    const weightMultiplier = fontWeight === 'bold' ? 1.1 : 1.0;
    return text.length * baseWidth * weightMultiplier;
  }
  
  /**
   * Render entity as SVG element
   */
  render(container) {
    if (this.element) {
      this.element.remove();
    }
    
    // Create main group
    this.element = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    this.element.setAttribute('class', `entity-node entity-${this.config.type}`);
    this.element.setAttribute('data-entity-id', this.config.id);
    
    // Render based on entity type
    switch (this.config.type) {
      case 'weak':
        this._renderWeakEntity();
        break;
      case 'associative':
        this._renderAssociativeEntity();
        break;
      default:
        this._renderStrongEntity();
    }
    
    // Render attributes
    this._renderAttributes();
    
    // Add interaction handlers
    this._addInteractionHandlers();
    
    container.appendChild(this.element);
    
    return this.element;
  }
  
  /**
   * Render strong entity (standard rectangle)
   */
  _renderStrongEntity() {
    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('x', this.config.x);
    rect.setAttribute('y', this.config.y);
    rect.setAttribute('width', this.config.width);
    rect.setAttribute('height', this.config.height);
    rect.setAttribute('rx', this.config.style.cornerRadius);
    rect.setAttribute('ry', this.config.style.cornerRadius);
    rect.setAttribute('fill', this.config.style.fillColor);
    rect.setAttribute('stroke', this.config.style.strokeColor);
    rect.setAttribute('stroke-width', this.config.style.strokeWidth);
    rect.setAttribute('class', 'entity-background');
    
    this.element.appendChild(rect);
  }
  
  /**
   * Render weak entity (double border)
   */
  _renderWeakEntity() {
    // Outer rectangle
    const outerRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    outerRect.setAttribute('x', this.config.x);
    outerRect.setAttribute('y', this.config.y);
    outerRect.setAttribute('width', this.config.width);
    outerRect.setAttribute('height', this.config.height);
    outerRect.setAttribute('rx', this.config.style.cornerRadius);
    outerRect.setAttribute('ry', this.config.style.cornerRadius);
    outerRect.setAttribute('fill', this.config.style.fillColor);
    outerRect.setAttribute('stroke', this.config.style.strokeColor);
    outerRect.setAttribute('stroke-width', this.config.style.weakEntityStrokeWidth);
    outerRect.setAttribute('class', 'entity-background entity-weak-outer');
    
    // Inner rectangle
    const innerRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    const inset = this.config.style.weakEntityStrokeWidth + 2;
    innerRect.setAttribute('x', this.config.x + inset);
    innerRect.setAttribute('y', this.config.y + inset);
    innerRect.setAttribute('width', this.config.width - (inset * 2));
    innerRect.setAttribute('height', this.config.height - (inset * 2));
    innerRect.setAttribute('rx', Math.max(0, this.config.style.cornerRadius - inset));
    innerRect.setAttribute('ry', Math.max(0, this.config.style.cornerRadius - inset));
    innerRect.setAttribute('fill', 'none');
    innerRect.setAttribute('stroke', this.config.style.strokeColor);
    innerRect.setAttribute('stroke-width', this.config.style.strokeWidth);
    innerRect.setAttribute('class', 'entity-weak-inner');
    
    this.element.appendChild(outerRect);
    this.element.appendChild(innerRect);
  }
  
  /**
   * Render associative entity (dashed border)
   */
  _renderAssociativeEntity() {
    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('x', this.config.x);
    rect.setAttribute('y', this.config.y);
    rect.setAttribute('width', this.config.width);
    rect.setAttribute('height', this.config.height);
    rect.setAttribute('rx', this.config.style.cornerRadius);
    rect.setAttribute('ry', this.config.style.cornerRadius);
    rect.setAttribute('fill', this.config.style.fillColor);
    rect.setAttribute('stroke', this.config.style.strokeColor);
    rect.setAttribute('stroke-width', this.config.style.strokeWidth);
    rect.setAttribute('stroke-dasharray', this.config.style.associativeEntityDashArray);
    rect.setAttribute('class', 'entity-background entity-associative');
    
    this.element.appendChild(rect);
  }
  
  /**
   * Render entity attributes
   */
  _renderAttributes() {
    // Entity name (header)
    const nameText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    nameText.setAttribute('x', this.config.x + this.config.width / 2);
    nameText.setAttribute('y', this.config.y + this.config.style.attributePadding + this.config.typography.entityNameSize);
    nameText.setAttribute('text-anchor', 'middle');
    nameText.setAttribute('font-size', this.config.typography.entityNameSize);
    nameText.setAttribute('font-weight', this.config.typography.entityNameWeight);
    nameText.setAttribute('fill', this.config.style.textColor);
    nameText.setAttribute('class', 'entity-name');
    nameText.textContent = this.config.name;
    
    this.element.appendChild(nameText);
    
    // Separator line
    if (this.config.attributes.length > 0) {
      const separator = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      const separatorY = this.config.y + this.config.style.attributePadding + this.config.typography.entityNameSize + 8;
      separator.setAttribute('x1', this.config.x + 8);
      separator.setAttribute('y1', separatorY);
      separator.setAttribute('x2', this.config.x + this.config.width - 8);
      separator.setAttribute('y2', separatorY);
      separator.setAttribute('stroke', this.config.style.strokeColor);
      separator.setAttribute('stroke-width', 1);
      separator.setAttribute('class', 'entity-separator');
      
      this.element.appendChild(separator);
    }
    
    // Attributes
    const baseY = this.config.y + this.config.style.attributePadding + this.config.typography.entityNameSize + 20;
    
    this.config.attributes.forEach((attr, index) => {
      const attrY = baseY + (index * this.config.style.attributeSpacing);
      
      const attrText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      attrText.setAttribute('x', this.config.x + this.config.style.attributePadding);
      attrText.setAttribute('y', attrY);
      attrText.setAttribute('font-size', this.config.typography.attributeSize);
      attrText.setAttribute('font-weight', this.config.typography.attributeWeight);
      attrText.setAttribute('class', `entity-attribute ${this._getAttributeClasses(attr)}`);
      
      // Set color based on attribute type
      let textColor = this.config.style.textColor;
      if (attr.isPrimaryKey) {
        textColor = this.config.style.keyAttributeColor;
      } else if (attr.isForeignKey) {
        textColor = this.config.style.foreignKeyColor;
      }
      attrText.setAttribute('fill', textColor);
      
      // Set style for derived attributes
      if (attr.isDerived) {
        attrText.setAttribute('font-style', this.config.style.derivedAttributeStyle);
      }
      
      attrText.textContent = this._formatAttributeText(attr);
      
      this.attributeElements.set(attr.id, attrText);
      this.element.appendChild(attrText);
    });
  }
  
  /**
   * Get CSS classes for attribute styling
   */
  _getAttributeClasses(attr) {
    const classes = [];
    
    if (attr.isPrimaryKey) classes.push('primary-key');
    if (attr.isForeignKey) classes.push('foreign-key');
    if (attr.isRequired) classes.push('required');
    if (attr.isUnique) classes.push('unique');
    if (attr.isDerived) classes.push('derived');
    if (attr.isComposite) classes.push('composite');
    
    return classes.join(' ');
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
    
    // Add drag handling
    this.element.addEventListener('mousedown', (e) => {
      if (e.button === 0) { // Left mouse button
        this.startDrag(e);
      }
    });
  }
  
  /**
   * Select the entity
   */
  select() {
    this.isSelected = true;
    this.element.classList.add('selected');
  }
  
  /**
   * Deselect the entity
   */
  deselect() {
    this.isSelected = false;
    this.element.classList.remove('selected');
  }
  
  /**
   * Start editing entity properties
   */
  startEditing() {
    // Implementation would show property editor
    console.log('Start editing entity:', this.config.name);
  }
  
  /**
   * Start drag operation
   */
  startDrag(event) {
    this.isDragging = true;
    
    const startX = event.clientX - this.config.x;
    const startY = event.clientY - this.config.y;
    
    const handleMouseMove = (e) => {
      if (this.isDragging) {
        this.moveTo(e.clientX - startX, e.clientY - startY);
      }
    };
    
    const handleMouseUp = () => {
      this.isDragging = false;
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }
  
  /**
   * Move entity to new position
   */
  moveTo(x, y) {
    this.config.x = x;
    this.config.y = y;
    
    if (this.element) {
      this.element.setAttribute('transform', `translate(${x}, ${y})`);
    }
    
    if (this.config.onResize) {
      this.config.onResize(this.getBoundingRect());
    }
  }
  
  /**
   * Get entity bounding rectangle
   */
  getBoundingRect() {
    return {
      x: this.config.x,
      y: this.config.y,
      width: this.config.width,
      height: this.config.height,
      centerX: this.config.x + this.config.width / 2,
      centerY: this.config.y + this.config.height / 2
    };
  }
  
  /**
   * Get connection points for relationships
   */
  getConnectionPoints() {
    const rect = this.getBoundingRect();
    
    return {
      top: { x: rect.centerX, y: rect.y },
      right: { x: rect.x + rect.width, y: rect.centerY },
      bottom: { x: rect.centerX, y: rect.y + rect.height },
      left: { x: rect.x, y: rect.centerY },
      center: { x: rect.centerX, y: rect.centerY }
    };
  }
  
  /**
   * Serialize entity to JSON
   */
  toJSON() {
    return {
      id: this.config.id,
      name: this.config.name,
      type: this.config.type,
      position: { x: this.config.x, y: this.config.y },
      size: { width: this.config.width, height: this.config.height },
      attributes: this.config.attributes,
      style: this.config.style,
      typography: this.config.typography
    };
  }
  
  /**
   * Create entity from JSON data
   */
  static fromJSON(data) {
    return new EntityNode({
      id: data.id,
      name: data.name,
      type: data.type,
      x: data.position?.x || 0,
      y: data.position?.y || 0,
      width: data.size?.width || 120,
      height: data.size?.height || null,
      attributes: data.attributes || [],
      style: data.style || {},
      typography: data.typography || {}
    });
  }
  
  /**
   * Destroy entity and clean up
   */
  destroy() {
    if (this.element) {
      this.element.remove();
      this.element = null;
    }
    
    this.attributeElements.clear();
    this.primaryKeys.clear();
    this.foreignKeys.clear();
  }
}

export default EntityNode;