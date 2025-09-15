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
  constructor(dataStore) {
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
  getComponent(componentId) {
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
}