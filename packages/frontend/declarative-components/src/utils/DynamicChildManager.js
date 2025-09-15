/**
 * DynamicChildManager - Manages dynamic creation and destruction of child components
 * 
 * Handles array state changes and automatically creates/removes child components
 * based on data changes. Provides state synchronization between parent array
 * data and child component instances.
 */

export class DynamicChildManager {
  /**
   * Create a DynamicChildManager
   * @param {Object} options - Configuration options
   * @param {HierarchicalComponent} options.parentComponent - Parent component that will contain children
   * @param {Object} options.childDefinition - Component definition for child components
   * @param {string} options.arrayPath - Path to array in state (e.g., 'items' or 'data.items')
   * @param {string} [options.mountPoint='dynamic-children'] - Mount point for child components
   * @param {Object} options.lifecycle - Component lifecycle manager
   * @param {Object} [options.stateProjection] - State projection configuration for children
   */
  constructor(options) {
    if (!options.parentComponent) {
      throw new Error('Parent component is required for dynamic child management');
    }
    
    if (!options.childDefinition) {
      throw new Error('Child definition is required for dynamic child management');
    }
    
    if (!options.arrayPath) {
      throw new Error('Array path is required for dynamic child management');
    }
    
    if (!options.lifecycle) {
      throw new Error('Lifecycle is required for dynamic child management');
    }

    this.parentComponent = options.parentComponent;
    this.childDefinition = options.childDefinition;
    this.arrayPath = options.arrayPath;
    this.mountPoint = options.mountPoint || 'dynamic-children';
    this.lifecycle = options.lifecycle;
    this.stateProjection = options.stateProjection || {};

    // Child instance tracking
    this.childInstances = new Map(); // index -> HierarchicalComponent
    this.arrayStateCache = []; // Cached copy of array for change detection
    this.stateSubscription = null; // State subscription for automatic updates
  }

  /**
   * Detect changes between previous and current array states
   * @param {Array} previousArray - Previous array state
   * @param {Array} currentArray - Current array state
   * @returns {Object} Change description with added, removed, modified, and reordered flags
   */
  detectArrayChanges(previousArray, currentArray) {
    const changes = {
      added: [],
      removed: [],
      modified: [],
      reordered: false
    };

    // If arrays are identical references, no changes
    if (previousArray === currentArray) {
      return changes;
    }

    // Handle null/undefined arrays
    const prevArray = previousArray || [];
    const currArray = currentArray || [];

    // First check for reordering (same items, same length, different order)
    if (prevArray.length === currArray.length) {
      // Compare item IDs or references to detect reordering
      const prevIds = prevArray.map(item => item.id || item);
      const currIds = currArray.map(item => item.id || item);
      
      // Check if same items exist in both arrays (regardless of order)
      const sameItems = prevIds.every(id => currIds.includes(id)) && 
                       currIds.every(id => prevIds.includes(id));
      
      if (sameItems && !this._arraysEqual(prevIds, currIds)) {
        changes.reordered = true;
        return changes; // Return early for reordering - no need to check modifications
      }
    }

    // For complex changes, we need to compare by ID rather than by position
    // Build ID-to-item and ID-to-index maps
    const prevItemsById = new Map();
    const currItemsById = new Map();
    const prevIndexById = new Map();
    const currIndexById = new Map();

    // Map previous array items
    prevArray.forEach((item, index) => {
      const id = item.id || item;
      prevItemsById.set(id, item);
      prevIndexById.set(id, index);
    });

    // Map current array items
    currArray.forEach((item, index) => {
      const id = item.id || item;
      currItemsById.set(id, item);
      currIndexById.set(id, index);
    });

    // Find removed items (in previous but not in current)
    prevItemsById.forEach((item, id) => {
      if (!currItemsById.has(id)) {
        const originalIndex = prevIndexById.get(id);
        changes.removed.push({ index: originalIndex, item });
      }
    });

    // Find added items (in current but not in previous)
    currItemsById.forEach((item, id) => {
      if (!prevItemsById.has(id)) {
        const newIndex = currIndexById.get(id);
        changes.added.push({ index: newIndex, item });
      }
    });

    // Find modified items (same ID, different content)
    currItemsById.forEach((currItem, id) => {
      if (prevItemsById.has(id)) {
        const prevItem = prevItemsById.get(id);
        if (!this._deepEqual(prevItem, currItem)) {
          const currentIndex = currIndexById.get(id);
          changes.modified.push({
            index: currentIndex,
            previousItem: prevItem,
            currentItem: currItem
          });
        }
      }
    });

    return changes;
  }

  /**
   * Extract array from state using dot notation path
   * @param {Object} state - State object
   * @param {string} path - Dot notation path (e.g., 'data.items')
   * @returns {Array} Array from state or empty array if not found
   */
  getArrayFromState(state, path) {
    if (!state || typeof state !== 'object') {
      return [];
    }

    const pathSegments = path.split('.');
    let current = state;

    for (const segment of pathSegments) {
      if (current && typeof current === 'object' && segment in current) {
        current = current[segment];
      } else {
        return [];
      }
    }

    return Array.isArray(current) ? current : [];
  }

  /**
   * Create a new child component for an array item
   * @param {*} itemData - Data for the array item
   * @param {number} index - Index in the array
   * @returns {HierarchicalComponent} Created child component
   */
  createChildComponent(itemData, index) {
    try {
      const childId = `${this.parentComponent.id}-child-${index}`;
      
      // Create child component configuration
      const childConfig = {
        id: childId,
        definition: this.childDefinition,
        container: this.parentComponent.container,
        domElements: new Map(),
        lifecycle: this.lifecycle,
        data: this._createChildData(itemData, index)
      };

      // Create the child component through lifecycle
      const childComponent = this.lifecycle.getComponent(childConfig);
      
      return childComponent;
    } catch (error) {
      throw new Error(`Failed to create child component at index ${index}: ${error.message}`);
    }
  }

  /**
   * Add a child component at specific index
   * @param {*} itemData - Data for the array item
   * @param {number} index - Index where to add the child
   * @returns {Promise<void>}
   */
  async addChildAtIndex(itemData, index) {
    if (typeof index !== 'number' || index < 0) {
      throw new Error(`Invalid index: ${index}`);
    }

    const childComponent = this.createChildComponent(itemData, index);
    const childId = `${this.parentComponent.id}-child-${index}`;

    // Add to parent component
    this.parentComponent.addChild(childId, childComponent);
    
    // Store in our tracking map
    this.childInstances.set(index, childComponent);

    // Mount the child component
    await childComponent.mount();
  }

  /**
   * Remove child component at specific index
   * @param {number} index - Index of child to remove
   * @returns {Promise<boolean>} True if removed, false if not found
   */
  async removeChildAtIndex(index) {
    const childComponent = this.childInstances.get(index);
    
    if (!childComponent) {
      return false;
    }

    // Unmount the child component
    await childComponent.unmount();

    // Remove from parent component
    const childId = `${this.parentComponent.id}-child-${index}`;
    await this.parentComponent.removeChild(childId);

    // Remove from our tracking
    this.childInstances.delete(index);

    return true;
  }

  /**
   * Create child components for all items in an array
   * @param {Array} arrayData - Array of items to create children for
   * @returns {Promise<void>}
   */
  async createChildrenFromArray(arrayData) {
    const createPromises = [];

    for (let i = 0; i < arrayData.length; i++) {
      createPromises.push(this.addChildAtIndex(arrayData[i], i));
    }

    await Promise.all(createPromises);
  }

  /**
   * Remove all child components
   * @returns {Promise<void>}
   */
  async removeAllChildren() {
    const removePromises = [];
    const indices = Array.from(this.childInstances.keys());

    for (const index of indices) {
      removePromises.push(this.removeChildAtIndex(index));
    }

    await Promise.all(removePromises);
  }

  /**
   * Synchronize child components with current state
   * @param {Object} state - Current state object
   * @returns {Promise<void>}
   */
  async syncWithState(state) {
    const currentArray = this.getArrayFromState(state, this.arrayPath);
    const changes = this.detectArrayChanges(this.arrayStateCache, currentArray);

    // Handle removed items (do this first to avoid index conflicts)
    for (const removal of changes.removed.reverse()) {
      await this.removeChildAtIndex(removal.index);
    }

    // Handle added items
    for (const addition of changes.added) {
      await this.addChildAtIndex(addition.item, addition.index);
    }

    // Handle modified items
    for (const modification of changes.modified) {
      await this.updateChildState(modification.index, modification.currentItem);
    }

    // Handle reordering if needed
    if (changes.reordered) {
      await this._reorderChildren(currentArray);
    }

    // Update our cache
    this.arrayStateCache = [...currentArray];
  }

  /**
   * Update state of child component at specific index
   * @param {number} index - Index of child to update
   * @param {*} itemData - New data for the child
   * @returns {Promise<void>}
   */
  async updateChildState(index, itemData) {
    const childComponent = this.childInstances.get(index);
    
    if (!childComponent) {
      throw new Error(`No child component found at index ${index}`);
    }

    // Update child component state with new data
    const newChildData = this._createChildData(itemData, index);
    await childComponent.updateState(newChildData);
  }

  /**
   * Start automatic state synchronization
   * @param {Object} dataStore - Data store to subscribe to
   * @returns {Promise<void>}
   */
  async startAutoSync(dataStore) {
    if (this.stateSubscription) {
      this.stateSubscription.unsubscribe();
    }

    // Subscribe to state changes
    this.stateSubscription = dataStore.subscribe(this.arrayPath, async (newValue) => {
      await this.syncWithState(dataStore.getState());
    });

    // Initial sync
    await this.syncWithState(dataStore.getState());
  }

  /**
   * Stop automatic state synchronization
   */
  stopAutoSync() {
    if (this.stateSubscription) {
      this.stateSubscription.unsubscribe();
      this.stateSubscription = null;
    }
  }

  /**
   * Clean up all resources and remove all children
   * @returns {Promise<void>}
   */
  async cleanup() {
    // Stop auto sync
    this.stopAutoSync();

    // Remove all children
    await this.removeAllChildren();

    // Clear state cache
    this.arrayStateCache = [];
  }

  /**
   * Create child component data with proper entity structure
   * @private
   * @param {*} itemData - Raw item data
   * @param {number} index - Index in array
   * @returns {Object} Data object for child component
   */
  _createChildData(itemData, index) {
    const entityName = this.childDefinition.entity || 'item';
    
    return {
      [entityName]: itemData,
      index: index
    };
  }

  /**
   * Reorder children to match new array order
   * @private
   * @param {Array} newArray - New array with correct order
   * @returns {Promise<void>}
   */
  async _reorderChildren(newArray) {
    // For simplicity, we'll recreate all children in correct order
    // More sophisticated implementation could optimize by moving existing components
    await this.removeAllChildren();
    await this.createChildrenFromArray(newArray);
  }

  /**
   * Deep equality check for objects
   * @private
   * @param {*} a - First value
   * @param {*} b - Second value
   * @returns {boolean} True if deeply equal
   */
  _deepEqual(a, b) {
    if (a === b) return true;
    
    if (a == null || b == null) return a === b;
    
    if (typeof a !== typeof b) return false;
    
    if (typeof a !== 'object') return a === b;
    
    if (Array.isArray(a) !== Array.isArray(b)) return false;
    
    const keysA = Object.keys(a);
    const keysB = Object.keys(b);
    
    if (keysA.length !== keysB.length) return false;
    
    for (const key of keysA) {
      if (!keysB.includes(key)) return false;
      if (!this._deepEqual(a[key], b[key])) return false;
    }
    
    return true;
  }

  /**
   * Array equality check
   * @private
   * @param {Array} a - First array
   * @param {Array} b - Second array
   * @returns {boolean} True if arrays are equal
   */
  _arraysEqual(a, b) {
    if (a.length !== b.length) return false;
    
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) return false;
    }
    
    return true;
  }
}