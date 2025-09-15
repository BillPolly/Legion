/**
 * EquationSolver - Reactive data binding and event handling engine
 * 
 * Provides reactive binding between DataStore properties and DOM elements,
 * handles event processing with modifiers, and manages component lifecycle.
 */

export class EquationSolver {
  constructor(dataStore) {
    if (!dataStore) {
      throw new Error('DataStore is required');
    }
    
    this.dataStore = dataStore;
    this.subscriptions = new Map(); // property -> callback
    this.elements = new Map(); // elementKey -> HTMLElement
  }

  /**
   * Register a DOM element with a key for binding
   * @param {string} elementKey - Unique key for the element
   * @param {HTMLElement} element - DOM element
   */
  registerElement(elementKey, element) {
    if (this.elements.has(elementKey)) {
      throw new Error(`Element key "${elementKey}" already registered`);
    }
    
    if (!element || !(element instanceof HTMLElement)) {
      throw new Error('Invalid element');
    }
    
    this.elements.set(elementKey, element);
  }

  /**
   * Setup a data binding between DataStore and DOM element
   * @param {Object} binding - Binding configuration
   * @param {string} binding.source - Source property path (e.g., 'user.name')
   * @param {string} binding.target - Target element property (e.g., 'root.textContent')
   * @param {string} binding.transform - Transform function or 'identity'
   */
  setupBinding(binding) {
    const { source, target, transform } = binding;
    
    // Parse target
    const [elementKey, property] = target.split('.');
    const element = this.elements.get(elementKey);
    
    if (!element) {
      throw new Error(`Element "${elementKey}" not registered`);
    }
    
    // Validate target property
    if (!this.isValidTargetProperty(element, property)) {
      throw new Error(`Invalid target property "${property}"`);
    }
    
    // Get initial value and apply binding
    const value = this.evaluateSourceValue(source, transform);
    this.applyValueToElement(element, property, value);
    
    // Setup reactive subscription
    this.setupReactiveSubscription(source, () => {
      const newValue = this.evaluateSourceValue(source, transform);
      this.applyValueToElement(element, property, newValue);
    });
  }

  /**
   * Setup event binding for DOM element
   * @param {Object} event - Event configuration
   * @param {string} event.element - Element key
   * @param {string} event.event - Event type (click, keyup, etc.)
   * @param {Array} event.modifiers - Event modifiers (prevent, enter, etc.)
   * @param {string} event.action - Action to execute
   */
  setupEvent(event) {
    const { element: elementKey, event: eventType, modifiers = [], action } = event;
    
    const element = this.elements.get(elementKey);
    if (!element) {
      throw new Error(`Element "${elementKey}" not registered`);
    }
    
    const eventHandler = (domEvent) => {
      // Check modifiers
      if (modifiers.includes('prevent')) {
        domEvent.preventDefault();
      }
      
      if (modifiers.includes('enter') && domEvent.key !== 'Enter') {
        return; // Only proceed if Enter was pressed
      }
      
      // Execute action
      try {
        this.executeAction(action);
      } catch (error) {
        throw new Error('Failed to execute action');
      }
    };
    
    element.addEventListener(eventType, eventHandler);
  }

  /**
   * Process complete component definition
   * @param {Object} componentDef - Component definition with structure, bindings, events
   */
  processComponent(componentDef) {
    const { bindings = [], events = [] } = componentDef;
    
    // Setup all bindings
    bindings.forEach(binding => this.setupBinding(binding));
    
    // Setup all events
    events.forEach(event => this.setupEvent(event));
  }

  /**
   * Cleanup all subscriptions and clear state
   */
  cleanup() {
    // Unsubscribe all DataStore subscriptions
    this.subscriptions.forEach((callback, property) => {
      if (this.dataStore.off) {
        this.dataStore.off(property, callback);
      }
    });
    
    // Clear all internal state
    this.subscriptions.clear();
    this.elements.clear();
  }

  // Private helper methods

  /**
   * Evaluate source value with optional transform
   */
  evaluateSourceValue(source, transform) {
    // Handle multi-property sources (comma-separated)
    if (source.includes(',')) {
      const properties = source.split(',').map(p => p.trim());
      const values = properties.map(prop => this.getNestedProperty(prop));
      
      if (transform === 'identity') {
        return values[0]; // For single property, return the value
      }
      
      return this.applyTransform(transform, values, properties);
    }
    
    // Single property source
    const value = this.getNestedProperty(source);
    
    if (transform === 'identity') {
      return value;
    }
    
    return this.applyTransform(transform, [value], [source]);
  }

  /**
   * Get nested property value from DataStore
   */
  getNestedProperty(propertyPath) {
    // Use the DataStoreAdapter's getProperty method to access data
    if (this.dataStore && typeof this.dataStore.getProperty === 'function') {
      return this.dataStore.getProperty(propertyPath);
    }
    
    // Fallback: direct object access (for backwards compatibility)
    const parts = propertyPath.split('.');
    let current = this.dataStore;
    
    for (const part of parts) {
      if (current && typeof current === 'object' && part in current) {
        current = current[part];
      } else {
        return undefined; // Return undefined for missing properties
      }
    }
    
    return current;
  }

  /**
   * Apply transform function to values
   */
  applyTransform(transform, values, properties) {
    try {
      if (transform.includes('=>')) {
        // Arrow function transform
        const [params, body] = transform.split('=>').map(s => s.trim());
        const paramNames = params.split(',').map(p => p.trim());
        
        // Create function
        const func = new Function(...paramNames, `return ${body}`);
        return func(...values);
      } else {
        throw new Error('Invalid transform syntax');
      }
    } catch (error) {
      throw new Error('Invalid transform syntax');
    }
  }

  /**
   * Apply value to DOM element property
   */
  applyValueToElement(element, property, value) {
    const stringValue = this.convertToString(value);
    
    if (property === 'textContent') {
      element.textContent = stringValue;
    } else if (property === 'value') {
      element.value = stringValue;
    } else if (property === 'checked') {
      element.checked = Boolean(value);
    } else if (property === 'className') {
      element.className = stringValue;
    } else if (property.startsWith('data-')) {
      element.setAttribute(property, stringValue);
    } else {
      // Direct property assignment
      element[property] = value;
    }
  }

  /**
   * Setup reactive subscription for property changes
   */
  setupReactiveSubscription(source, callback) {
    // Handle multi-property sources
    if (source.includes(',')) {
      const properties = source.split(',').map(p => p.trim());
      properties.forEach(prop => {
        this.subscribeToProperty(prop, callback);
      });
    } else {
      this.subscribeToProperty(source, callback);
    }
  }

  /**
   * Subscribe to individual property changes
   */
  subscribeToProperty(property, callback) {
    if (this.dataStore.on) {
      this.dataStore.on(property, callback);
      this.subscriptions.set(property, callback);
    }
  }

  /**
   * Execute action string (e.g., 'user.active = false')
   */
  executeAction(action) {
    try {
      // Handle simple assignments and increments
      if (action.includes('=') && !action.includes('==')) {
        // Assignment: 'user.active = false'
        const [leftSide, rightSide] = action.split('=').map(s => s.trim());
        const value = this.evaluateExpression(rightSide);
        this.setNestedProperty(leftSide, value);
      } else if (action.includes('++')) {
        // Increment: 'counter.count++'
        const property = action.replace('++', '').trim();
        const currentValue = this.getNestedProperty(property);
        this.setNestedProperty(property, (currentValue || 0) + 1);
      } else {
        throw new Error('Unsupported action syntax');
      }
    } catch (error) {
      throw error;
    }
  }

  /**
   * Evaluate expression (right side of assignment)
   */
  evaluateExpression(expression) {
    const trimmed = expression.trim();
    
    // Boolean literals
    if (trimmed === 'true') return true;
    if (trimmed === 'false') return false;
    
    // String literals
    if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
      return trimmed.slice(1, -1);
    }
    
    // Ternary operator
    if (trimmed.includes('?')) {
      const [condition, branches] = trimmed.split('?').map(s => s.trim());
      const [trueBranch, falseBranch] = branches.split(':').map(s => s.trim());
      
      const conditionValue = this.evaluateCondition(condition);
      return conditionValue ? 
        this.evaluateExpression(trueBranch) : 
        this.evaluateExpression(falseBranch);
    }
    
    // Property reference
    if (trimmed.includes('.')) {
      return this.getNestedProperty(trimmed);
    }
    
    // Numeric literal
    if (!isNaN(trimmed)) {
      return Number(trimmed);
    }
    
    throw new Error(`Cannot evaluate expression: ${expression}`);
  }

  /**
   * Evaluate condition for ternary operator
   */
  evaluateCondition(condition) {
    const trimmed = condition.trim();
    
    // Negation
    if (trimmed.startsWith('!')) {
      const property = trimmed.slice(1);
      return !this.getNestedProperty(property);
    }
    
    // Property reference
    return Boolean(this.getNestedProperty(trimmed));
  }

  /**
   * Set nested property value in DataStore
   */
  setNestedProperty(propertyPath, value) {
    // Use the DataStoreAdapter's setProperty method to update data
    if (this.dataStore && typeof this.dataStore.setProperty === 'function') {
      this.dataStore.setProperty(propertyPath, value);
      return;
    }
    
    // Fallback: direct object access (for backwards compatibility)
    const parts = propertyPath.split('.');
    let current = this.dataStore;
    
    // Navigate to parent object
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (!current[part] || typeof current[part] !== 'object') {
        current[part] = {};
      }
      current = current[part];
    }
    
    // Set the final property
    const finalProp = parts[parts.length - 1];
    current[finalProp] = value;
  }

  /**
   * Validate if target property is valid for element
   */
  isValidTargetProperty(element, property) {
    const validProperties = [
      'textContent', 'innerHTML', 'value', 'checked', 'className',
      'disabled', 'hidden', 'id', 'title', 'alt', 'src', 'href'
    ];
    
    // Data attributes
    if (property.startsWith('data-')) {
      return true;
    }
    
    // Standard properties
    if (validProperties.includes(property)) {
      return true;
    }
    
    // Direct element properties
    if (property in element) {
      return true;
    }
    
    return false;
  }

  /**
   * Convert value to string representation
   */
  convertToString(value) {
    if (value === null || value === undefined) {
      return '';
    }
    
    return String(value);
  }
}