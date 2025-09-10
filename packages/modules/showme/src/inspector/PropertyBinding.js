/**
 * PropertyBinding
 * 
 * Manages data binding between object properties
 * Supports one-way and two-way binding with optional transformations
 */

export class PropertyBinding {
  constructor(source, sourceProperty, target, targetProperty, options = {}) {
    this.source = source;
    this.sourceProperty = sourceProperty;
    this.target = target;
    this.targetProperty = targetProperty;
    
    this.options = {
      transform: null,
      reverseTransform: null,
      twoWay: false,
      immediate: true,
      ...options
    };
    
    this.id = this.generateId();
    this.active = true;
    
    // Initial sync
    if (this.options.immediate) {
      this.update();
    }
  }

  /**
   * Update target property from source
   */
  update() {
    if (!this.active) return;
    
    let value = this.getSourceValue();
    
    if (this.options.transform) {
      value = this.options.transform(value);
    }
    
    this.setTargetValue(value);
  }

  /**
   * Update source property from target (for two-way binding)
   */
  updateReverse() {
    if (!this.active || !this.options.twoWay) return;
    
    let value = this.getTargetValue();
    
    if (this.options.reverseTransform) {
      value = this.options.reverseTransform(value);
    } else if (this.options.transform && !this.options.reverseTransform) {
      console.warn('Two-way binding without reverseTransform may not work correctly');
    }
    
    this.setSourceValue(value);
  }

  /**
   * Get value from source property
   * @private
   */
  getSourceValue() {
    if (this.source.properties && this.source.properties.hasOwnProperty(this.sourceProperty)) {
      return this.source.properties[this.sourceProperty];
    }
    return this.source[this.sourceProperty];
  }

  /**
   * Set value to target property
   * @private
   */
  setTargetValue(value) {
    if (this.target.properties && this.target.properties.hasOwnProperty(this.targetProperty)) {
      this.target.properties[this.targetProperty] = value;
    } else {
      this.target[this.targetProperty] = value;
    }
  }

  /**
   * Get value from target property
   * @private
   */
  getTargetValue() {
    if (this.target.properties && this.target.properties.hasOwnProperty(this.targetProperty)) {
      return this.target.properties[this.targetProperty];
    }
    return this.target[this.targetProperty];
  }

  /**
   * Set value to source property
   * @private
   */
  setSourceValue(value) {
    if (this.source.properties && this.source.properties.hasOwnProperty(this.sourceProperty)) {
      this.source.properties[this.sourceProperty] = value;
    } else {
      this.source[this.sourceProperty] = value;
    }
  }

  /**
   * Activate binding
   */
  activate() {
    this.active = true;
  }

  /**
   * Deactivate binding
   */
  deactivate() {
    this.active = false;
  }

  /**
   * Check if binding is active
   * @returns {boolean}
   */
  isActive() {
    return this.active;
  }

  /**
   * Generate unique ID
   * @private
   */
  generateId() {
    return `binding_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  }

  /**
   * Get binding ID
   * @returns {string}
   */
  getId() {
    return this.id;
  }

  /**
   * Destroy binding
   */
  destroy() {
    this.active = false;
    this.source = null;
    this.target = null;
  }
}