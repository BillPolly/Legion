/**
 * HierarchicalComponentLifecycle - Manages hierarchical component lifecycle
 * 
 * Extends ComponentLifecycle to support nested component management,
 * parent-child relationships, and hierarchical mounting/unmounting.
 */

import { ComponentLifecycle } from './ComponentLifecycle.js';
import { HierarchicalComponent } from '../core/HierarchicalComponent.js';
import { DynamicChildManager } from '../utils/DynamicChildManager.js';

export class HierarchicalComponentLifecycle extends ComponentLifecycle {
  constructor(options) {
    // Support both old-style (dataStore) and new-style (options object)
    const dataStore = options.dataStore || options;
    super(dataStore);

    // Track hierarchical components separately
    this.hierarchicalComponents = new Map(); // componentId -> HierarchicalComponent
    this.hierarchicalComponentCounter = 0;
    
    // Track dynamic child managers for array repetition
    this.dynamicChildManagers = new Map(); // childName -> DynamicChildManager
  }

  /**
   * Mount a hierarchical component to the DOM
   * @param {string} dsl - Component DSL definition
   * @param {HTMLElement} container - Container element
   * @param {Object} initialData - Initial component data
   * @param {Object} parentAdapter - Optional parent state adapter for child components
   * @returns {Promise<HierarchicalComponent>} Mounted hierarchical component instance
   */
  async mountHierarchical(dsl, container, initialData = {}, parentAdapter = null) {
    if (!dsl || typeof dsl !== 'string') {
      throw new Error('DSL is required and must be a string');
    }
    
    if (!container || !(container instanceof HTMLElement)) {
      throw new Error('Container must be a valid HTMLElement');
    }

    const componentId = `hierarchical_component_${++this.hierarchicalComponentCounter}`;
    
    try {
      // Execute beforeMount hooks
      await this.executeHooks('beforeMount', { componentId, dsl, container, initialData });
      
      // Use parent's mount method to create basic component
      const basicComponent = await super.mount(dsl, container, initialData);
      
      // Convert to HierarchicalComponent
      const hierarchicalComponent = this.wrapAsHierarchical(basicComponent, componentId, parentAdapter);
      
      // Track hierarchical component
      this.hierarchicalComponents.set(componentId, hierarchicalComponent);
      
      // Execute afterMount hooks
      await this.executeHooks('afterMount', { componentId, componentInstance: hierarchicalComponent });
      
      return hierarchicalComponent;
      
    } catch (error) {
      // Cleanup on mount failure
      if (this.hierarchicalComponents.has(componentId)) {
        await this.unmountHierarchical(componentId);
      }
      throw new Error(`Hierarchical component mount failed: ${error.message}`);
    }
  }

  /**
   * Convert basic ComponentInstance to HierarchicalComponent
   * @param {ComponentInstance} basicComponent - Basic component instance
   * @param {string} componentId - Component ID
   * @param {Object} parentAdapter - Parent state adapter
   * @returns {HierarchicalComponent} Wrapped hierarchical component
   * @private
   */
  wrapAsHierarchical(basicComponent, componentId, parentAdapter = null) {
    // Create hierarchical component with same properties
    const hierarchicalComponent = Object.setPrototypeOf(basicComponent, HierarchicalComponent.prototype);
    
    // Initialize hierarchical-specific properties
    hierarchicalComponent.children = new Map();
    hierarchicalComponent.childStateAdapters = new Map();
    hierarchicalComponent.eventSubscriptions = new Map();
    hierarchicalComponent.parent = null;
    hierarchicalComponent.parentStateAdapter = parentAdapter;
    
    // Override id with hierarchical ID
    hierarchicalComponent.id = componentId;
    
    return hierarchicalComponent;
  }

  /**
   * Unmount a hierarchical component
   * @param {string} componentId - Component ID
   * @returns {Promise<void>}
   */
  async unmountHierarchical(componentId) {
    const component = this.hierarchicalComponents.get(componentId);
    if (!component) {
      return; // Already unmounted or doesn't exist
    }

    try {
      // Execute beforeUnmount hooks
      await this.executeHooks('beforeUnmount', { componentId, component });
      
      // Unmount all child components first
      const childIds = Array.from(component.children.keys());
      for (const childId of childIds) {
        const childComponent = component.children.get(childId);
        if (childComponent && childComponent.isMounted) {
          // Find child's hierarchical ID and unmount through lifecycle
          for (const [hId, hComponent] of this.hierarchicalComponents) {
            if (hComponent === childComponent) {
              await this.unmountHierarchical(hId);
              break;
            }
          }
        }
      }
      
      // Remove from hierarchical tracking first
      this.hierarchicalComponents.delete(componentId);
      
      // Unmount the component itself using parent method
      await component.unmount();
      
      // Execute afterUnmount hooks
      await this.executeHooks('afterUnmount', { componentId, component });
      
    } catch (error) {
      throw new Error(`Hierarchical component unmount failed: ${error.message}`);
    }
  }

  /**
   * Get hierarchical component by ID
   * @param {string} componentId - Component ID
   * @returns {HierarchicalComponent|undefined}
   */
  getHierarchicalComponent(componentId) {
    return this.hierarchicalComponents.get(componentId);
  }

  /**
   * Get all hierarchical components
   * @returns {Array<HierarchicalComponent>}
   */
  getAllHierarchicalComponents() {
    return Array.from(this.hierarchicalComponents.values());
  }

  /**
   * Get number of hierarchical components
   * @returns {number}
   */
  getHierarchicalComponentCount() {
    return this.hierarchicalComponents.size;
  }

  /**
   * Mount child component within parent
   * @param {HierarchicalComponent} parent - Parent component
   * @param {string} childId - Child component ID
   * @param {string} childDsl - Child component DSL
   * @param {HTMLElement} childContainer - Child container element
   * @param {Object} childInitialData - Child initial data
   * @param {Object} childStateAdapter - Child state adapter
   * @returns {Promise<HierarchicalComponent>} Mounted child component
   */
  async mountChild(parent, childId, childDsl, childContainer, childInitialData = {}, childStateAdapter = null) {
    if (!(parent instanceof HierarchicalComponent)) {
      throw new Error('Parent must be a HierarchicalComponent instance');
    }

    if (parent.hasChild(childId)) {
      throw new Error(`Child with ID "${childId}" already exists in parent`);
    }

    try {
      // Mount child as hierarchical component
      const childComponent = await this.mountHierarchical(
        childDsl, 
        childContainer, 
        childInitialData, 
        childStateAdapter
      );

      // Add to parent's children
      parent.addChild(childId, childComponent);

      // Store child state adapter if provided
      if (childStateAdapter) {
        parent.childStateAdapters.set(childId, childStateAdapter);
      }

      return childComponent;

    } catch (error) {
      throw new Error(`Child component mount failed: ${error.message}`);
    }
  }

  /**
   * Unmount child component from parent
   * @param {HierarchicalComponent} parent - Parent component
   * @param {string} childId - Child component ID
   * @returns {Promise<void>}
   */
  async unmountChild(parent, childId) {
    if (!(parent instanceof HierarchicalComponent)) {
      throw new Error('Parent must be a HierarchicalComponent instance');
    }

    const childComponent = parent.getChild(childId);
    if (!childComponent) {
      return; // Child doesn't exist
    }

    try {
      // Find child's hierarchical ID and unmount
      for (const [hId, hComponent] of this.hierarchicalComponents) {
        if (hComponent === childComponent) {
          await this.unmountHierarchical(hId);
          break;
        }
      }

      // Remove from parent (cleanup handled in unmountHierarchical)
      parent.removeChild(childId);

    } catch (error) {
      throw new Error(`Child component unmount failed: ${error.message}`);
    }
  }

  /**
   * Cleanup all hierarchical components
   * @returns {Promise<void>}
   */
  async cleanup() {
    // Unmount all hierarchical components
    const componentIds = Array.from(this.hierarchicalComponents.keys());
    
    for (const componentId of componentIds) {
      await this.unmountHierarchical(componentId);
    }
    
    // Clear tracking
    this.hierarchicalComponents.clear();
    this.hierarchicalComponentCounter = 0;
    
    // Call parent cleanup
    await super.cleanup();
  }

  /**
   * Override update to handle hierarchical components
   * @param {string} componentId - Component ID
   * @param {Object} newData - New data to update
   * @returns {Promise<void>}
   */
  async update(componentId, newData) {
    // Check if it's a hierarchical component first
    const hierarchicalComponent = this.hierarchicalComponents.get(componentId);
    if (hierarchicalComponent) {
      return await hierarchicalComponent.update(newData);
    }

    // Fall back to parent update method
    return await super.update(componentId, newData);
  }

  /**
   * Override getComponent to check hierarchical components first
   * @param {string} componentId - Component ID
   * @returns {ComponentInstance|HierarchicalComponent|undefined}
   */
  getComponent(componentIdOrConfig) {
    // If passed a config object (for DynamicChildManager), create a new component
    if (typeof componentIdOrConfig === 'object' && componentIdOrConfig.id) {
      const config = componentIdOrConfig;
      return new HierarchicalComponent(config);
    }

    // Otherwise treat as component ID lookup
    const componentId = componentIdOrConfig;

    // Check hierarchical components first
    const hierarchicalComponent = this.hierarchicalComponents.get(componentId);
    if (hierarchicalComponent) {
      return hierarchicalComponent;
    }

    // Fall back to parent method
    return super.getComponent(componentId);
  }

  /**
   * Get all components (both regular and hierarchical)
   * @returns {Array<ComponentInstance|HierarchicalComponent>}
   */
  getAllComponents() {
    const regularComponents = super.getAllComponents();
    const hierarchicalComponents = this.getAllHierarchicalComponents();

    return [...regularComponents, ...hierarchicalComponents];
  }

  // Array Repetition Methods

  /**
   * Check if child definition has repeat directive
   * @param {Object} childDefinition - Child definition
   * @returns {boolean}
   */
  hasRepeatDirective(childDefinition) {
    return childDefinition && typeof childDefinition.repeat === 'string' && childDefinition.repeat.length > 0;
  }

  /**
   * Get repeat array path from child definition
   * @param {Object} childDefinition - Child definition
   * @returns {string|null}
   */
  getRepeatArrayPath(childDefinition) {
    return this.hasRepeatDirective(childDefinition) ? childDefinition.repeat : null;
  }

  /**
   * Validate repeat directive syntax
   * @param {Object} childDefinition - Child definition
   * @returns {boolean}
   */
  isValidRepeatDirective(childDefinition) {
    if (!childDefinition || !childDefinition.repeat) {
      return false;
    }
    return typeof childDefinition.repeat === 'string' && childDefinition.repeat.length > 0;
  }

  /**
   * Validate repeat directive and throw error if invalid
   * @param {Object} childDefinition - Child definition
   * @throws {Error} If repeat directive is invalid
   */
  validateRepeatDirective(childDefinition) {
    if (!childDefinition.repeat || typeof childDefinition.repeat !== 'string' || childDefinition.repeat.length === 0) {
      throw new Error('Invalid repeat directive: must be a non-empty string path');
    }
    if (!childDefinition.mountPoint) {
      throw new Error('Repeated components must specify a mountPoint');
    }
  }

  /**
   * Create indexed state projection for array item
   * @param {Object} stateProjection - State projection configuration
   * @param {*} itemData - Array item data
   * @param {number} index - Array index
   * @param {Object} fullData - Full parent data
   * @returns {Object} Projected state
   */
  createIndexedStateProjection(stateProjection, itemData, index, fullData) {
    const result = {};

    for (const [key, path] of Object.entries(stateProjection)) {
      if (path === 'index') {
        result[key] = index;
      } else if (typeof path === 'string') {
        // Check if path contains [index]
        if (path.includes('[index]')) {
          // Split to get base path and nested path
          const beforeIndex = path.split('[index]')[0];
          const afterIndex = path.split('[index]')[1] || '';

          // Verify the base path exists in fullData
          const baseParts = beforeIndex.split('.').filter(p => p);
          let baseExists = fullData;
          for (const part of baseParts) {
            if (baseExists && typeof baseExists === 'object') {
              baseExists = baseExists[part];
            } else {
              baseExists = undefined;
              break;
            }
          }

          // If base path doesn't exist or isn't an array, return undefined
          if (!baseExists || !Array.isArray(baseExists)) {
            result[key] = undefined;
          } else {
            // Base path exists, use itemData
            let current = itemData;

            // Navigate nested properties after [index]
            if (afterIndex && afterIndex.startsWith('.')) {
              const nestedParts = afterIndex.substring(1).split('.');
              for (const part of nestedParts) {
                if (current && typeof current === 'object') {
                  current = current[part];
                } else {
                  current = undefined;
                  break;
                }
              }
            }

            result[key] = current;
          }
        } else {
          // Navigate through fullData for paths without [index]
          const parts = path.split('.');
          let current = fullData;

          for (const part of parts) {
            if (part.includes('[')) {
              const arrayMatch = part.match(/^(.+)\[(\d+)\]$/);
              if (arrayMatch) {
                const [, arrayName, arrayIndex] = arrayMatch;
                current = current?.[arrayName]?.[parseInt(arrayIndex)];
              }
            } else {
              current = current?.[part];
            }
          }

          result[key] = current;
        }
      }
    }

    return result;
  }

  /**
   * Create dynamic child manager for array repetition
   * @param {HierarchicalComponent} parentComponent - Parent component
   * @param {Object} childDefinition - Child component definition
   * @param {Object} repeatConfig - Repeat configuration (repeat, mountPoint, stateProjection)
   * @returns {Object} Dynamic child manager
   */
  createDynamicChildManager(parentComponent, childDefinition, repeatConfig) {
    // Merge childDefinition with repeatConfig for DynamicChildManager
    const fullDefinition = {
      ...childDefinition,
      ...repeatConfig
    };

    // Use the DynamicChildManager class
    const manager = new DynamicChildManager({
      parentComponent,
      childDefinition: fullDefinition,
      arrayPath: repeatConfig.repeat,
      mountPoint: repeatConfig.mountPoint,
      lifecycle: this,
      stateProjection: repeatConfig.stateProjection
    });

    return manager;
  }

  /**
   * Initialize array repetition for a child
   * @param {HierarchicalComponent} parentComponent - Parent component
   * @param {Object} childDefinition - Child component definition
   * @param {Object} repeatConfig - Repeat configuration (repeat, mountPoint, stateProjection)
   * @returns {Promise<Object>} Dynamic child manager
   */
  async initializeArrayRepetition(parentComponent, childDefinition, repeatConfig) {
    this.validateRepeatDirective(repeatConfig);

    const arrayPath = this.getRepeatArrayPath(repeatConfig);

    // Get data from dataStore (handle both mock and real implementations)
    let data;
    if (this.dataStore.getState) {
      data = this.dataStore.getState();
    } else if (this.dataStore.simpleData) {
      data = this.dataStore.simpleData;
    } else {
      throw new Error('DataStore does not have getState() or simpleData');
    }

    // Validate array exists
    const parts = arrayPath.split('.');
    let arrayData = data;
    for (const part of parts) {
      arrayData = arrayData?.[part];
    }

    if (!arrayData) {
      throw new Error(`Array path "${arrayPath}" not found in component state`);
    }

    if (!Array.isArray(arrayData)) {
      throw new Error(`Data at path "${arrayPath}" is not an array`);
    }

    const manager = this.createDynamicChildManager(parentComponent, childDefinition, repeatConfig);

    // Use child name as ID for tracking
    const childId = childDefinition.name || 'child';

    if (!this.dynamicChildManagers) {
      this.dynamicChildManagers = new Map();
    }
    this.dynamicChildManagers.set(childId, manager);

    // Start auto-sync with dataStore
    await manager.startAutoSync(this.dataStore);

    return manager;
  }

  /**
   * Handle array reordering
   * @param {HierarchicalComponent} parentComponent - Parent component
   * @param {string} childId - Child ID
   * @param {Object} newData - New data with reordered array
   */
  async handleArrayReordering(parentComponent, childId, newData) {
    const manager = this.dynamicChildManagers?.get(childId);
    if (!manager) {
      throw new Error(`No dynamic child manager for "${childId}"`);
    }

    // Use syncWithState which extracts the array data internally
    await manager.syncWithState(newData);
  }

  /**
   * Preserve component states during reorder
   * @param {Object} manager - Dynamic child manager
   * @param {Array} newItems - New items array
   */
  async preserveComponentStatesDuringReorder(manager, newItems) {
    // Store current states
    const states = new Map();
    for (const [id, instance] of manager.childInstances) {
      states.set(instance.data.id || id, instance);
    }

    // Reorder instances to match new items
    const reorderedInstances = new Map();
    for (let i = 0; i < newItems.length; i++) {
      const item = newItems[i];
      const itemId = item.id || `item_${i}`;
      const existingInstance = states.get(itemId);

      if (existingInstance) {
        existingInstance.index = i;
        existingInstance.data = item;
        reorderedInstances.set(i, existingInstance);

        // Update component state if updateState method exists
        if (existingInstance.updateState && typeof existingInstance.updateState === 'function') {
          await existingInstance.updateState({ item, index: i });
        }
      }
    }

    manager.childInstances = reorderedInstances;
  }

  /**
   * Handle complex array changes (add/remove/reorder)
   * @param {HierarchicalComponent} parentComponent - Parent component
   * @param {string} childId - Child ID
   * @param {Object} newData - New data with changed array
   */
  async handleComplexArrayChanges(parentComponent, childId, newData) {
    await this.handleArrayReordering(parentComponent, childId, newData);
  }

  /**
   * Handle array changes (add/remove/modify items)
   * @param {HierarchicalComponent} parentComponent - Parent component
   * @param {string} childId - Child ID
   * @param {Object} newData - New data with updated array
   */
  async handleArrayChange(parentComponent, childId, newData) {
    const manager = this.dynamicChildManagers?.get(childId);
    if (!manager) {
      throw new Error(`No dynamic child manager for "${childId}"`);
    }

    // Delegate to manager's syncWithState method
    await manager.syncWithState(newData);
  }

  /**
   * Validate array data at path
   * @param {Object} data - Data object
   * @param {string} arrayPath - Path to array
   * @throws {Error} If data is not an array
   */
  validateArrayData(data, arrayPath) {
    const parts = arrayPath.split('.');
    let current = data;
    for (const part of parts) {
      current = current?.[part];
    }

    if (!Array.isArray(current)) {
      throw new Error(`Data at path "${arrayPath}" is not an array`);
    }
  }

  /**
   * Cleanup array repetition resources
   * @param {HierarchicalComponent} parentComponent - Parent component
   */
  async cleanupArrayRepetition(parentComponent) {
    if (this.dynamicChildManagers) {
      for (const manager of this.dynamicChildManagers.values()) {
        manager.cleanup();
      }
      this.dynamicChildManagers.clear();
    }
  }
}