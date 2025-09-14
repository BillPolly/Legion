/**
 * ComponentLifecycle - Manages component lifecycle stages
 * 
 * Orchestrates the mounting, updating, and unmounting of declarative components,
 * coordinating between ComponentCompiler, EquationSolver, and DataStore.
 */

import { ComponentCompiler } from '../compiler/ComponentCompiler.js';
import { EquationSolver } from '../solver/EquationSolver.js';
import { DataStoreAdapter } from '../adapters/DataStoreAdapter.js';

export class ComponentLifecycle {
  constructor(dataStore) {
    if (!dataStore) {
      throw new Error('DataStore is required');
    }
    
    this.dataStore = dataStore;
    this.dataStoreAdapter = new DataStoreAdapter(dataStore);
    this.compiler = new ComponentCompiler();
    
    // Track mounted components
    this.mountedComponents = new Map(); // componentId -> ComponentInstance
    this.componentCounter = 0;
    
    // Lifecycle hooks
    this.hooks = {
      beforeMount: new Set(),
      afterMount: new Set(),
      beforeUpdate: new Set(),
      afterUpdate: new Set(),
      beforeUnmount: new Set(),
      afterUnmount: new Set()
    };
  }

  /**
   * Mount a component to the DOM
   * @param {string} dsl - Component DSL definition
   * @param {HTMLElement} container - Container element
   * @param {Object} initialData - Initial component data
   * @returns {Promise<ComponentInstance>} Mounted component instance
   */
  async mount(dsl, container, initialData = {}) {
    if (!dsl || typeof dsl !== 'string') {
      throw new Error('DSL is required and must be a string');
    }
    
    if (!container || !(container instanceof HTMLElement)) {
      throw new Error('Container must be a valid HTMLElement');
    }

    const componentId = `component_${++this.componentCounter}`;
    
    try {
      // Execute beforeMount hooks
      await this.executeHooks('beforeMount', { componentId, dsl, container, initialData });
      
      // Compile DSL to component definition
      const componentDef = this.compiler.compile(dsl);
      
      // Initialize entity data in DataStore
      if (componentDef.entity && Object.keys(initialData).length > 0) {
        // Structure data with entity name as top-level key if not already
        let entityData = initialData;
        
        // Check if data is already structured with entity name
        if (!initialData.hasOwnProperty(componentDef.entity)) {
          // Wrap the data with the entity name
          entityData = {
            [componentDef.entity]: initialData
          };
        }
        
        await this.dataStoreAdapter.initializeEntities(entityData);
      }
      
      // Create per-component EquationSolver to avoid element key collisions
      const solver = new EquationSolver(this.dataStoreAdapter);
      
      // Create DOM structure
      const domElements = this.createDOMStructure(componentDef.structure, container);
      
      // Register elements with solver
      for (const [elementKey, element] of domElements) {
        solver.registerElement(elementKey, element);
      }
      
      // Setup data bindings
      for (const binding of componentDef.bindings) {
        solver.setupBinding(binding);
      }
      
      // Setup event bindings
      for (const event of componentDef.events) {
        solver.setupEvent(event);
      }
      
      // Create component instance
      const componentInstance = new ComponentInstance({
        id: componentId,
        definition: componentDef,
        container,
        domElements,
        lifecycle: this,
        data: initialData
      });
      
      // Store mounted component
      this.mountedComponents.set(componentId, componentInstance);
      
      // Execute afterMount hooks
      await this.executeHooks('afterMount', { componentId, componentInstance });
      
      return componentInstance;
      
    } catch (error) {
      // Cleanup on mount failure
      if (this.mountedComponents.has(componentId)) {
        await this.unmount(componentId);
      }
      throw new Error(`Component mount failed: ${error.message}`);
    }
  }

  /**
   * Create DOM structure from component definition
   * @param {Object} structure - Component structure definition (key-value pairs)
   * @param {HTMLElement} container - Container element
   * @returns {Map} Map of element keys to DOM elements
   * @private
   */
  createDOMStructure(structure, container) {
    const elements = new Map();
    const createdElements = new Map();
    
    // First pass: create all elements
    for (const [key, def] of Object.entries(structure)) {
      const element = document.createElement(def.element);
      
      // Set class
      if (def.class) {
        element.className = def.class;
      }
      
      // Set id
      if (def.id) {
        element.id = def.id;
      }
      
      // Set static attributes
      if (def.attributes) {
        for (const [name, value] of Object.entries(def.attributes)) {
          if (typeof value === 'boolean') {
            if (value) {
              element.setAttribute(name, '');
            }
          } else {
            element.setAttribute(name, value);
          }
        }
      }
      
      createdElements.set(key, element);
      elements.set(key, element);
    }
    
    // Second pass: build hierarchy
    for (const [key, def] of Object.entries(structure)) {
      const element = createdElements.get(key);
      
      if (def.parent) {
        const parent = createdElements.get(def.parent);
        if (parent) {
          parent.appendChild(element);
        }
      } else {
        // Root element goes in container
        container.appendChild(element);
      }
    }
    
    return elements;
  }

  /**
   * Update component data
   * @param {string} componentId - Component ID
   * @param {Object} newData - New data to update
   * @returns {Promise<void>}
   */
  async update(componentId, newData) {
    const component = this.mountedComponents.get(componentId);
    if (!component) {
      throw new Error(`Component "${componentId}" not found`);
    }

    try {
      // Execute beforeUpdate hooks
      await this.executeHooks('beforeUpdate', { componentId, component, newData });
      
      // Update data in DataStore
      const entityName = component.definition.entity;
      if (entityName) {
        for (const [key, value] of Object.entries(newData)) {
          this.dataStoreAdapter.setProperty(`${entityName}.${key}`, value);
        }
      }
      
      // Update component data
      Object.assign(component.data, newData);
      
      // Execute afterUpdate hooks
      await this.executeHooks('afterUpdate', { componentId, component, newData });
      
    } catch (error) {
      throw new Error(`Component update failed: ${error.message}`);
    }
  }

  /**
   * Unmount a component
   * @param {string} componentId - Component ID
   * @returns {Promise<void>}
   */
  async unmount(componentId) {
    const component = this.mountedComponents.get(componentId);
    if (!component) {
      return; // Already unmounted
    }

    try {
      // Execute beforeUnmount hooks
      await this.executeHooks('beforeUnmount', { componentId, component });
      
      // Cleanup solver subscriptions and elements for this component only
      if (component.solver && typeof component.solver.cleanup === 'function') {
        component.solver.cleanup();
      }
      
      // Remove DOM elements created by this component
      for (const [key, element] of component.domElements) {
        if (element.parentNode) {
          element.parentNode.removeChild(element);
        }
      }
      
      // Mark component as unmounted
      component.isMounted = false;
      
      // Remove from mounted components
      this.mountedComponents.delete(componentId);
      
      // Execute afterUnmount hooks
      await this.executeHooks('afterUnmount', { componentId, component });
      
    } catch (error) {
      throw new Error(`Component unmount failed: ${error.message}`);
    }
  }

  /**
   * Get mounted component by ID
   * @param {string} componentId - Component ID
   * @returns {ComponentInstance|undefined}
   */
  getComponent(componentId) {
    return this.mountedComponents.get(componentId);
  }

  /**
   * Get all mounted components
   * @returns {Array<ComponentInstance>}
   */
  getAllComponents() {
    return Array.from(this.mountedComponents.values());
  }

  /**
   * Add lifecycle hook
   * @param {string} hookName - Hook name (beforeMount, afterMount, etc.)
   * @param {Function} callback - Hook callback
   */
  addHook(hookName, callback) {
    if (!this.hooks[hookName]) {
      throw new Error(`Invalid hook name: ${hookName}`);
    }
    
    if (typeof callback !== 'function') {
      throw new Error('Hook callback must be a function');
    }
    
    this.hooks[hookName].add(callback);
  }

  /**
   * Remove lifecycle hook
   * @param {string} hookName - Hook name
   * @param {Function} callback - Hook callback to remove
   */
  removeHook(hookName, callback) {
    if (this.hooks[hookName]) {
      this.hooks[hookName].delete(callback);
    }
  }

  /**
   * Execute lifecycle hooks
   * @param {string} hookName - Hook name
   * @param {Object} context - Hook execution context
   * @private
   */
  async executeHooks(hookName, context) {
    const hooks = this.hooks[hookName];
    if (!hooks || hooks.size === 0) {
      return;
    }

    const promises = Array.from(hooks).map(async (hook) => {
      try {
        await hook(context);
      } catch (error) {
        console.error(`Error in ${hookName} hook:`, error);
      }
    });

    await Promise.all(promises);
  }

  /**
   * Cleanup all mounted components
   * @returns {Promise<void>}
   */
  async cleanup() {
    const componentIds = Array.from(this.mountedComponents.keys());
    
    for (const componentId of componentIds) {
      await this.unmount(componentId);
    }
    
    // Clear all hooks
    for (const hookSet of Object.values(this.hooks)) {
      hookSet.clear();
    }
  }
}

/**
 * ComponentInstance - Represents a mounted component instance
 */
export class ComponentInstance {
  constructor({ id, definition, container, domElements, lifecycle, data }) {
    this.id = id;
    this.definition = definition;
    this.container = container;
    this.domElements = domElements;
    this.lifecycle = lifecycle;
    this.data = { ...data };
    this.isMounted = true;
    this.mountTime = Date.now();
  }

  /**
   * Update component data
   * @param {Object} newData - New data to update
   * @returns {Promise<void>}
   */
  async update(newData) {
    if (!this.isMounted) {
      throw new Error('Cannot update unmounted component');
    }
    
    return this.lifecycle.update(this.id, newData);
  }

  /**
   * Unmount this component
   * @returns {Promise<void>}
   */
  async unmount() {
    if (!this.isMounted) {
      return;
    }
    
    this.isMounted = false;
    return this.lifecycle.unmount(this.id);
  }

  /**
   * Get DOM element by key
   * @param {string} key - Element key
   * @returns {HTMLElement|undefined}
   */
  getElement(key) {
    return this.domElements.get(key);
  }

  /**
   * Get all DOM elements
   * @returns {Map<string, HTMLElement>}
   */
  getAllElements() {
    return new Map(this.domElements);
  }

  /**
   * Get component metadata
   * @returns {Object}
   */
  getMetadata() {
    return {
      id: this.id,
      name: this.definition.name,
      entity: this.definition.entity,
      isMounted: this.isMounted,
      mountTime: this.mountTime,
      elementCount: this.domElements.size,
      bindingCount: this.definition.bindings.length,
      eventCount: this.definition.events.length
    };
  }
}