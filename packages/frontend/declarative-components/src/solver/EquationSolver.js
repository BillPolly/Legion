/**
 * EquationSolver - Reactive data binding and event handling engine
 * 
 * Provides reactive binding between DataStore properties and DOM elements,
 * handles event processing with modifiers, and manages component lifecycle.
 */

export class EquationSolver {
  constructor(dataStore, options = {}) {
    if (!dataStore) {
      throw new Error('DataStore is required');
    }

    this.dataStore = dataStore;
    this.subscriptions = new Map(); // property -> callback
    this.elements = new Map(); // elementKey -> HTMLElement
    this.methods = new Map(); // methodName -> function
    this.computed = new Map(); // propertyName -> function
    this.computedCache = new Map(); // propertyName -> cached value
    this.computedDependencies = new Map(); // propertyName -> array of dependencies
    this.helpers = options.helpers || {}; // Global helper functions
    this.entityParam = options.entityParam; // Store entity parameter name for subscriptions

    // Create a computed proxy for accessing computed values
    this.computedProxy = new Proxy({}, {
      get: (target, prop) => {
        return this.getComputedValue(String(prop));
      }
    });

    // Create a helpers proxy for validating helper function access
    this.helpersProxy = new Proxy({}, {
      get: (target, prop) => {
        if (typeof prop === 'symbol') return undefined;
        const propName = String(prop);
        if (!this.helpers[propName]) {
          throw new Error(`Helper function "${propName}" is not defined`);
        }
        return this.helpers[propName];
      }
    });

    // Initialize methods
    if (options.methods) {
      this.initializeMethods(options.methods, options.entityParam);
    }

    // Initialize computed properties
    if (options.computed) {
      this.initializeComputed(options.computed, options.entityParam);
    }
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
      this.executeAction(action);
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
    this.methods.clear();
    this.computed.clear();
    this.computedCache.clear();
  }

  /**
   * Initialize component methods
   * Creates executable functions from method definitions
   */
  initializeMethods(methodsConfig, entityParam) {
    // Create a proxy for the entity that intercepts property access
    const entityProxy = new Proxy({}, {
      get: (target, prop) => {
        return this.getNestedProperty(`${entityParam}.${String(prop)}`);
      },
      set: (target, prop, value) => {
        this.setNestedProperty(`${entityParam}.${String(prop)}`, value);
        return true;
      }
    });

    for (const [methodName, methodDef] of Object.entries(methodsConfig)) {
      try {
        // Create context object with state access
        const functionBody = `
          const helpers = this.helpersProxy;
          const computed = this.computedProxy;
          ${methodDef.body}
        `;

        // Create function with proper context and bind with entity proxy
        const method = new Function(entityParam, ...methodDef.params, functionBody).bind(this, entityProxy);
        this.methods.set(methodName, method);
      } catch (error) {
        console.error(`Failed to create method "${methodName}":`, error);
        throw new Error(`Invalid method definition for "${methodName}": ${error.message}`);
      }
    }
  }

  /**
   * Initialize computed properties
   * Creates reactive computed values
   */
  initializeComputed(computedConfig, entityParam) {
    // Create a proxy for the entity that intercepts property access
    const entityProxy = new Proxy({}, {
      get: (target, prop) => {
        return this.getNestedProperty(`${entityParam}.${String(prop)}`);
      },
      set: (target, prop, value) => {
        this.setNestedProperty(`${entityParam}.${String(prop)}`, value);
        return true;
      }
    });

    // Store computed refs for dependency resolution
    const computedRefs = new Map();

    for (const [propName, propDef] of Object.entries(computedConfig)) {
      try {
        // Extract dependencies from computed body
        const { dependencies, referencedComputed } = this.extractComputedDependencies(propDef.body, entityParam);
        this.computedDependencies.set(propName, dependencies);
        computedRefs.set(propName, referencedComputed);

        // Create computed function
        const functionBody = `
          const helpers = this.helpersProxy;
          const computed = this.computedProxy;
          ${propDef.body}
        `;

        const computedFn = new Function(entityParam, functionBody).bind(this, entityProxy);
        this.computed.set(propName, computedFn);

        // Initialize cache
        this.computedCache.set(propName, undefined);
      } catch (error) {
        console.error(`Failed to create computed property "${propName}":`, error);
        throw new Error(`Invalid computed definition for "${propName}": ${error.message}`);
      }
    }

    // Resolve transitive dependencies after all computed properties are initialized
    this.resolveComputedDependencies(computedRefs);
  }

  /**
   * Execute a component method
   */
  executeMethod(methodName, ...args) {
    const method = this.methods.get(methodName);
    if (!method) {
      throw new Error(`Method "${methodName}" is not defined`);
    }

    try {
      return method(...args);
    } catch (error) {
      throw new Error(`Error executing method "${methodName}": ${error.message}`);
    }
  }

  /**
   * Get computed property value
   */
  getComputedValue(propName) {
    const computedFn = this.computed.get(propName);
    if (!computedFn) {
      throw new Error(`Computed property "${propName}" is not defined`);
    }

    try {
      const value = computedFn();
      this.computedCache.set(propName, value);
      return value;
    } catch (error) {
      throw new Error(`Error computing "${propName}": ${error.message}`);
    }
  }

  // Private helper methods

  /**
   * Evaluate source value with optional transform
   */
  evaluateSourceValue(source, transform) {
    // Handle multi-property sources (comma-separated)
    if (source.includes(',')) {
      const properties = source.split(',').map(p => p.trim());
      const values = properties.map(prop => this.evaluateSourceProperty(prop));

      if (transform === 'identity') {
        return values[0]; // For single property, return the value
      }

      return this.applyTransform(transform, values, properties);
    }

    // Single property source
    const value = this.evaluateSourceProperty(source);

    if (transform === 'identity') {
      return value;
    }

    return this.applyTransform(transform, [value], [source]);
  }

  /**
   * Evaluate a single source property (data, computed, or helper)
   */
  evaluateSourceProperty(source) {
    // Check for computed property reference
    if (source.startsWith('computed.')) {
      const propName = source.substring('computed.'.length);
      return this.getComputedValue(propName);
    }

    // Check for helper function reference
    if (source.startsWith('helpers.')) {
      const helperName = source.substring('helpers.'.length);
      if (!this.helpers[helperName]) {
        throw new Error(`Helper function "${helperName}" is not defined`);
      }
      // For now, call helper with no arguments - in the future could parse args from DSL
      return this.helpers[helperName]();
    }

    // Regular data property
    return this.getNestedProperty(source);
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
    // Handle computed property sources - subscribe to dependencies
    if (source.startsWith('computed.')) {
      const propName = source.substring('computed.'.length);
      const dependencies = this.computedDependencies.get(propName);

      if (dependencies && dependencies.length > 0) {
        // Subscribe to each dependency
        dependencies.forEach(dep => {
          this.subscribeToProperty(dep, callback);
        });
        this.subscriptions.set(source, callback);
      }
      return;
    }

    // Handle helper function sources - these don't typically need subscriptions
    if (source.startsWith('helpers.')) {
      // Helpers are static functions, no subscription needed
      return;
    }

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
   * Execute action string (e.g., 'user.active = false' or 'increment()')
   */
  executeAction(action) {
    try {
      // Check for method call: methodName(...args)
      const methodCallMatch = action.match(/^(\w+)\s*\((.*)\)$/);
      if (methodCallMatch) {
        const methodName = methodCallMatch[1];
        const argsString = methodCallMatch[2].trim();

        // Parse arguments
        const args = argsString ? argsString.split(',').map(arg => {
          const trimmed = arg.trim();
          // Evaluate each argument
          return this.evaluateExpression(trimmed);
        }) : [];

        // Execute method
        return this.executeMethod(methodName, ...args);
      }

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

    // Computed property reference: computed.propName
    if (trimmed.startsWith('computed.')) {
      const propName = trimmed.substring('computed.'.length);
      return this.getComputedValue(propName);
    }

    // Helper function call: helpers.functionName(args)
    if (trimmed.startsWith('helpers.')) {
      const helperCall = trimmed.substring('helpers.'.length);
      const methodMatch = helperCall.match(/^(\w+)\s*\((.*)\)$/);

      if (methodMatch) {
        const functionName = methodMatch[1];
        const argsString = methodMatch[2].trim();

        if (!this.helpers[functionName]) {
          throw new Error(`Helper function "${functionName}" is not defined`);
        }

        // Parse and evaluate arguments
        const args = argsString ? argsString.split(',').map(arg => {
          return this.evaluateExpression(arg.trim());
        }) : [];

        return this.helpers[functionName](...args);
      }
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
   * Extract dependencies from computed property body
   * @param {string} body - The computed function body
   * @param {string} entityParam - The entity parameter name
   * @returns {Object} Object with dependencies and referencedComputed arrays
   */
  extractComputedDependencies(body, entityParam) {
    const dependencies = [];
    const referencedComputed = [];

    // Find all references to entity properties
    // Matches patterns like: entityParam.property
    const entityRegex = new RegExp(`${entityParam}\\.(\\w+)`, 'g');
    let match;

    while ((match = entityRegex.exec(body)) !== null) {
      const propertyName = match[1];
      const fullPath = `${entityParam}.${propertyName}`;

      if (!dependencies.includes(fullPath)) {
        dependencies.push(fullPath);
      }
    }

    // Find all references to other computed properties
    // Matches patterns like: computed.property
    const computedRegex = /computed\.(\w+)/g;
    while ((match = computedRegex.exec(body)) !== null) {
      const computedName = match[1];
      if (!referencedComputed.includes(computedName)) {
        referencedComputed.push(computedName);
      }
    }

    return { dependencies, referencedComputed };
  }

  /**
   * Resolve transitive dependencies for computed properties
   * Call this after all computed properties have been initialized
   * @param {Map<string, Array<string>>} computedRefs - Map of property names to referenced computed properties
   */
  resolveComputedDependencies(computedRefs) {
    // For each computed property, resolve transitive dependencies
    for (const [propName, deps] of this.computedDependencies.entries()) {
      const allDeps = new Set(deps);

      // Get the computed refs for this property
      const refs = computedRefs.get(propName) || [];

      // For each referenced computed property, add its dependencies
      for (const computedRef of refs) {
        const refDeps = this.computedDependencies.get(computedRef);
        if (refDeps) {
          refDeps.forEach(dep => allDeps.add(dep));
        }
      }

      // Update dependencies with transitive closure
      this.computedDependencies.set(propName, Array.from(allDeps));
    }
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