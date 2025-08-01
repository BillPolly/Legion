/**
 * BaseModel - Foundation class for MVVM Model layer
 * 
 * Provides common state management patterns found across complex components:
 * - Change tracking and event emission
 * - State export/import functionality
 * - Batch update support
 * - Common data structure patterns
 */

export class BaseModel {
  constructor(initialData = null, config = {}) {
    this.config = { ...config };
    this.destroyed = false;
    
    // Change tracking
    this.changeListeners = new Set();
    this.pendingChanges = new Map();
    this.batchMode = false;
    
    // Common data structures
    this.items = new Map(); // ID-based lookup
    this.metadata = new Map(); // Additional item metadata
    this.state = new Map(); // Component state
    
    // Initialize with data if provided
    if (initialData) {
      this.setData(initialData);
    }
  }

  /**
   * Set model data - Override in subclasses
   * @param {*} data - The data to set
   */
  setData(data) {
    this.items.clear();
    this.metadata.clear();
    
    if (Array.isArray(data)) {
      data.forEach((item, index) => {
        const id = item.id || `item_${index}`;
        this.items.set(id, item);
      });
    } else if (data && typeof data === 'object') {
      this.items.set('root', data);
    }
    
    this._notifyChange('dataChanged', { data });
  }

  /**
   * Get model data
   * @returns {*} Current model data
   */
  getData() {
    if (this.items.size === 1 && this.items.has('root')) {
      return this.items.get('root');
    }
    return Array.from(this.items.values());
  }

  /**
   * Get item by ID
   * @param {string} id - Item ID
   * @returns {*} Item or null if not found
   */
  getItem(id) {
    return this.items.get(id) || null;
  }

  /**
   * Set item by ID
   * @param {string} id - Item ID
   * @param {*} item - Item data
   */
  setItem(id, item) {
    const oldItem = this.items.get(id);
    this.items.set(id, item);
    
    this._trackChange('itemChanged', { id, item, oldItem });
  }

  /**
   * Remove item by ID
   * @param {string} id - Item ID
   * @returns {boolean} True if item was removed
   */
  removeItem(id) {
    const item = this.items.get(id);
    if (item) {
      this.items.delete(id);
      this.metadata.delete(id);
      this._trackChange('itemRemoved', { id, item });
      return true;
    }
    return false;
  }

  /**
   * Get all items
   * @returns {Array} Array of all items
   */
  getAllItems() {
    return Array.from(this.items.values());
  }

  /**
   * Get all item IDs
   * @returns {Array} Array of all item IDs
   */
  getAllIds() {
    return Array.from(this.items.keys());
  }

  /**
   * Check if item exists
   * @param {string} id - Item ID
   * @returns {boolean} True if item exists
   */
  hasItem(id) {
    return this.items.has(id);
  }

  /**
   * Get item count
   * @returns {number} Number of items
   */
  getItemCount() {
    return this.items.size;
  }

  /**
   * Set item metadata
   * @param {string} id - Item ID
   * @param {string} key - Metadata key
   * @param {*} value - Metadata value
   */
  setMetadata(id, key, value) {
    if (!this.metadata.has(id)) {
      this.metadata.set(id, new Map());
    }
    
    const itemMetadata = this.metadata.get(id);
    const oldValue = itemMetadata.get(key);
    itemMetadata.set(key, value);
    
    this._trackChange('metadataChanged', { id, key, value, oldValue });
  }

  /**
   * Get item metadata
   * @param {string} id - Item ID
   * @param {string} key - Metadata key
   * @returns {*} Metadata value or undefined
   */
  getMetadata(id, key) {
    const itemMetadata = this.metadata.get(id);
    return itemMetadata ? itemMetadata.get(key) : undefined;
  }

  /**
   * Set component state
   * @param {string} key - State key
   * @param {*} value - State value
   */
  setState(key, value) {
    const oldValue = this.state.get(key);
    this.state.set(key, value);
    
    this._trackChange('stateChanged', { key, value, oldValue });
  }

  /**
   * Get component state
   * @param {string} key - State key
   * @returns {*} State value or undefined
   */
  getState(key) {
    return this.state.get(key);
  }

  /**
   * Start batch update mode
   */
  startBatch() {
    this.batchMode = true;
    this.pendingChanges.clear();
  }

  /**
   * End batch update mode and emit all changes
   */
  endBatch() {
    if (!this.batchMode) return;
    
    this.batchMode = false;
    
    if (this.pendingChanges.size > 0) {
      const changes = Array.from(this.pendingChanges.values());
      this.pendingChanges.clear();
      
      this._notifyChange('batchChanged', { changes });
    }
  }

  /**
   * Add change listener
   * @param {Function} listener - Change listener function
   */
  addChangeListener(listener) {
    if (typeof listener === 'function') {
      this.changeListeners.add(listener);
    }
  }

  /**
   * Remove change listener
   * @param {Function} listener - Change listener function
   */
  removeChangeListener(listener) {
    this.changeListeners.delete(listener);
  }

  /**
   * Export current state
   * @returns {Object} State object
   */
  exportState() {
    return {
      items: Object.fromEntries(this.items),
      metadata: Object.fromEntries(
        Array.from(this.metadata.entries()).map(([id, meta]) => [
          id, 
          Object.fromEntries(meta)
        ])
      ),
      state: Object.fromEntries(this.state),
      timestamp: Date.now()
    };
  }

  /**
   * Import state
   * @param {Object} stateData - State data to import
   */
  importState(stateData) {
    if (!stateData || typeof stateData !== 'object') return;
    
    this.startBatch();
    
    try {
      // Import items
      if (stateData.items) {
        this.items.clear();
        Object.entries(stateData.items).forEach(([id, item]) => {
          this.items.set(id, item);
        });
      }
      
      // Import metadata
      if (stateData.metadata) {
        this.metadata.clear();
        Object.entries(stateData.metadata).forEach(([id, meta]) => {
          this.metadata.set(id, new Map(Object.entries(meta)));
        });
      }
      
      // Import state
      if (stateData.state) {
        this.state.clear();
        Object.entries(stateData.state).forEach(([key, value]) => {
          this.state.set(key, value);
        });
      }
      
      this._trackChange('stateImported', { stateData });
      
    } finally {
      this.endBatch();
    }
  }

  /**
   * Get model statistics
   * @returns {Object} Statistics object
   */
  getStats() {
    return {
      itemCount: this.items.size,
      metadataCount: this.metadata.size,
      stateKeys: this.state.size,
      changeListeners: this.changeListeners.size,
      batchMode: this.batchMode,
      pendingChanges: this.pendingChanges.size
    };
  }

  /**
   * Validate model integrity - Override in subclasses
   * @returns {Object} Validation result
   */
  validate() {
    return {
      valid: true,
      errors: [],
      warnings: []
    };
  }

  /**
   * Clean up resources
   */
  destroy() {
    if (this.destroyed) return;
    
    this.destroyed = true;
    this.changeListeners.clear();
    this.pendingChanges.clear();
    this.items.clear();
    this.metadata.clear();
    this.state.clear();
  }

  // Private methods

  /**
   * Track a change (for batch mode or immediate notification)
   * @private
   */
  _trackChange(type, data) {
    if (this.destroyed) return;
    
    const change = { type, data, timestamp: Date.now() };
    
    if (this.batchMode) {
      this.pendingChanges.set(`${type}_${Date.now()}_${Math.random()}`, change);
    } else {
      this._notifyChange(type, data);
    }
  }

  /**
   * Notify change listeners
   * @private
   */
  _notifyChange(type, data) {
    if (this.destroyed || this.changeListeners.size === 0) return;
    
    const changeEvent = { type, data, model: this, timestamp: Date.now() };
    
    this.changeListeners.forEach(listener => {
      try {
        listener(changeEvent);
      } catch (error) {
        console.error('Model change listener error:', error);
      }
    });
  }
}