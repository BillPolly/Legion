/**
 * ReadWriteViewManager - Manages read/write views for controlled parent state access
 * 
 * Provides view management, read-only vs read-write permissions, state isolation,
 * conflict resolution, optimistic updates, and change batch processing for child
 * components accessing parent state.
 */

export class ReadWriteViewManager {
  /**
   * Create a ReadWriteViewManager
   * @param {Object} options - Configuration options
   * @param {HierarchicalComponent} options.parentComponent - Parent component
   * @param {HierarchicalComponent} options.childComponent - Child component
   * @param {Object} options.dataStore - Data store for state operations
   * @param {Object} [options.permissions] - Permission configuration
   */
  constructor(options) {
    if (!options.parentComponent) {
      throw new Error('Parent component is required');
    }
    
    if (!options.childComponent) {
      throw new Error('Child component is required');
    }
    
    if (!options.dataStore) {
      throw new Error('Data store is required');
    }

    this.parentComponent = options.parentComponent;
    this.childComponent = options.childComponent;
    this.dataStore = options.dataStore;
    
    // Set default permissions if not provided
    this.permissions = options.permissions || {
      read: [],
      write: [],
      readOnly: []
    };

    // View tracking
    this.views = new Map(); // viewId -> ViewDescriptor
    this.viewCounter = 0;

    // Optimistic updates
    this.optimisticUpdatesEnabled = false;
    this.pendingChanges = new Map(); // viewId -> ChangeDescriptor

    // Batch processing
    this.batchMode = false;
    this.batchChanges = new Map(); // viewId -> ChangeDescriptor

    // Conflict resolution
    this.conflictResolutionStrategy = 'last-write-wins'; // 'last-write-wins', 'merge', 'strict'

    // Resource management
    this.subscriptions = new Set();
    this.changeHistory = new Map(); // viewId -> Array<ChangeRecord>
  }

  /**
   * Create a read-only view for specified path
   * @param {string} path - State path to view
   * @param {string} [viewId] - Optional view ID, auto-generated if not provided
   * @returns {Object} View descriptor
   */
  createReadOnlyView(path, viewId = null) {
    this._validatePath(path);
    
    if (!this._hasReadPermission(path)) {
      throw new Error(`No read permission for path "${path}"`);
    }

    const id = viewId || `view_${++this.viewCounter}`;
    
    if (this.views.has(id)) {
      throw new Error(`View with ID "${id}" already exists`);
    }

    const currentValue = this._getValueFromPath(path);
    
    const view = {
      id,
      path,
      type: 'readonly',
      value: currentValue,
      version: 1,
      created: Date.now(),
      lastModified: Date.now()
    };

    this.views.set(id, view);
    return view;
  }

  /**
   * Create a read-write view for specified path
   * @param {string} path - State path to view
   * @param {string} [viewId] - Optional view ID, auto-generated if not provided
   * @returns {Object} View descriptor
   */
  createReadWriteView(path, viewId = null) {
    this._validatePath(path);
    
    const id = viewId || `view_${++this.viewCounter}`;
    
    if (this.views.has(id)) {
      throw new Error(`View with ID "${id}" already exists`);
    }
    
    if (!this._hasReadPermission(path)) {
      throw new Error(`No read permission for path "${path}"`);
    }
    
    if (!this._hasWritePermission(path)) {
      throw new Error(`No write permission for path "${path}"`);
    }

    const currentValue = this._getValueFromPath(path);
    
    const view = {
      id,
      path,
      type: 'readwrite',
      value: currentValue,
      version: 1,
      created: Date.now(),
      lastModified: Date.now()
    };

    this.views.set(id, view);
    return view;
  }

  /**
   * Get view by ID
   * @param {string} viewId - View ID
   * @returns {Object|undefined} View descriptor or undefined if not found
   */
  getView(viewId) {
    return this.views.get(viewId);
  }

  /**
   * Get all views
   * @returns {Array<Object>} Array of all view descriptors
   */
  getAllViews() {
    return Array.from(this.views.values());
  }

  /**
   * Get views by type
   * @param {string} type - View type ('readonly' or 'readwrite')
   * @returns {Array<Object>} Array of view descriptors of specified type
   */
  getViewsByType(type) {
    return this.getAllViews().filter(view => view.type === type);
  }

  /**
   * Check if view exists
   * @param {string} viewId - View ID
   * @returns {boolean} True if view exists
   */
  hasView(viewId) {
    return this.views.has(viewId);
  }

  /**
   * Get view count
   * @returns {number} Number of views
   */
  getViewCount() {
    return this.views.size;
  }

  /**
   * Read current value from view
   * @param {string} viewId - View ID
   * @returns {*} Current view value
   */
  readValue(viewId) {
    const view = this.views.get(viewId);
    if (!view) {
      throw new Error(`View "${viewId}" does not exist`);
    }

    return view.value;
  }

  /**
   * Write value to view
   * @param {string} viewId - View ID
   * @param {*} newValue - New value to write
   * @returns {Promise<void>}
   */
  async writeValue(viewId, newValue) {
    const view = this.views.get(viewId);
    if (!view) {
      throw new Error(`View "${viewId}" does not exist`);
    }

    if (view.type === 'readonly') {
      throw new Error(`Cannot write to read-only view "${viewId}"`);
    }

    const oldValue = view.value;

    // Handle batch mode
    if (this.batchMode) {
      this._addToBatch(viewId, oldValue, newValue);
      view.value = newValue;
      view.version++;
      view.lastModified = Date.now();
      return Promise.resolve();
    }

    // Handle optimistic updates
    if (this.optimisticUpdatesEnabled) {
      this._startOptimisticUpdate(viewId, oldValue, newValue);
    }

    try {
      // Check for strict conflict resolution
      if (this.conflictResolutionStrategy === 'strict') {
        const currentStateValue = this._getValueFromPath(view.path);
        if (currentStateValue !== view.value) {
          throw new Error('Conflict detected: state has been modified externally');
        }
      }

      // Perform the actual state update
      await this.dataStore.updateState({
        [view.path]: newValue
      });

      // Update view state on successful write
      view.value = newValue;
      view.version++;
      view.lastModified = Date.now();

      // Clear pending optimistic change
      this.pendingChanges.delete(viewId);

      // Record change history
      this._recordChange(viewId, oldValue, newValue);

      // Emit change event
      this.childComponent.emit('viewChanged', {
        viewId,
        path: view.path,
        oldValue,
        newValue,
        timestamp: Date.now()
      });

    } catch (error) {
      // Rollback optimistic update on failure
      if (this.optimisticUpdatesEnabled && this.pendingChanges.has(viewId)) {
        const pendingChange = this.pendingChanges.get(viewId);
        view.value = pendingChange.originalValue;
        this.pendingChanges.delete(viewId);
      }

      throw error;
    }
  }

  /**
   * Refresh all view values from current state
   */
  refreshViews() {
    for (const view of this.views.values()) {
      this.refreshView(view.id);
    }
  }

  /**
   * Refresh specific view by ID
   * @param {string} viewId - View ID to refresh
   */
  refreshView(viewId) {
    const view = this.views.get(viewId);
    if (!view) {
      return;
    }

    const currentValue = this._getValueFromPath(view.path);
    const oldValue = view.value;
    
    // Check for conflicts - emit if there's a difference and we have pending changes
    if (oldValue !== currentValue && this.pendingChanges.has(viewId)) {
      this.childComponent.emit('conflictDetected', {
        viewId,
        path: view.path,
        localValue: oldValue,
        externalValue: currentValue,
        timestamp: Date.now()
      });
    }

    view.value = currentValue;
    view.lastModified = Date.now();
  }

  /**
   * Enable optimistic updates
   */
  enableOptimisticUpdates() {
    this.optimisticUpdatesEnabled = true;
  }

  /**
   * Disable optimistic updates
   */
  disableOptimisticUpdates() {
    this.optimisticUpdatesEnabled = false;
  }

  /**
   * Start batch processing mode
   */
  startBatch() {
    this.batchMode = true;
    this.batchChanges.clear();
  }

  /**
   * Commit all batch changes
   * @returns {Promise<void>}
   */
  async commitBatch() {
    if (!this.batchMode) {
      throw new Error('Not in batch mode');
    }

    const changes = {};
    const changeRecords = [];

    // Collect all batch changes
    for (const [viewId, changeDesc] of this.batchChanges) {
      const view = this.views.get(viewId);
      if (view) {
        changes[view.path] = changeDesc.newValue;
        changeRecords.push({
          viewId,
          path: view.path,
          oldValue: changeDesc.oldValue,
          newValue: changeDesc.newValue
        });
      }
    }

    try {
      // Apply all changes at once
      if (Object.keys(changes).length > 0) {
        await this.dataStore.updateState(changes);
      }

      // Record change history for all changes
      for (const record of changeRecords) {
        this._recordChange(record.viewId, record.oldValue, record.newValue);
      }

      // Emit batch committed event
      this.childComponent.emit('batchCommitted', {
        changeCount: changeRecords.length,
        changes: changeRecords,
        timestamp: Date.now()
      });

      // Clear batch state
      this.batchChanges.clear();
      this.batchMode = false;

    } catch (error) {
      // Rollback all batch changes
      await this.rollbackBatch();
      throw error;
    }
  }

  /**
   * Rollback all batch changes
   * @returns {Promise<void>}
   */
  async rollbackBatch() {
    if (!this.batchMode) {
      throw new Error('Not in batch mode');
    }

    // Revert all view values
    for (const [viewId, changeDesc] of this.batchChanges) {
      const view = this.views.get(viewId);
      if (view) {
        view.value = changeDesc.oldValue;
        view.lastModified = Date.now();
      }
    }

    // Clear batch state
    this.batchChanges.clear();
    this.batchMode = false;

    // Emit rollback event
    this.childComponent.emit('batchRolledBack', {
      timestamp: Date.now()
    });
  }

  /**
   * Set conflict resolution strategy
   * @param {string} strategy - Strategy ('last-write-wins', 'merge', 'strict')
   */
  setConflictResolutionStrategy(strategy) {
    const validStrategies = ['last-write-wins', 'merge', 'strict'];
    if (!validStrategies.includes(strategy)) {
      throw new Error(`Invalid conflict resolution strategy: ${strategy}`);
    }

    this.conflictResolutionStrategy = strategy;
  }

  /**
   * Get change history for a view
   * @param {string} viewId - View ID
   * @returns {Array<Object>} Array of change records
   */
  getChangeHistory(viewId) {
    return this.changeHistory.get(viewId) || [];
  }

  /**
   * Remove specific view
   * @param {string} viewId - View ID to remove
   */
  removeView(viewId) {
    this.views.delete(viewId);
    this.pendingChanges.delete(viewId);
    this.batchChanges.delete(viewId);
    this.changeHistory.delete(viewId);
  }

  /**
   * Clear all views
   */
  clearAllViews() {
    this.views.clear();
    this.pendingChanges.clear();
    this.batchChanges.clear();
    this.changeHistory.clear();
  }

  /**
   * Cleanup all resources
   */
  cleanup() {
    // Unsubscribe from all subscriptions
    for (const subscription of this.subscriptions) {
      if (subscription && typeof subscription.unsubscribe === 'function') {
        subscription.unsubscribe();
      }
    }
    this.subscriptions.clear();

    // Clear all state
    this.views.clear();
    this.pendingChanges.clear();
    this.batchChanges.clear();
    this.changeHistory.clear();
    this.batchMode = false;
    this.optimisticUpdatesEnabled = false;

    // Emit cleanup event
    this.childComponent.emit('viewManagerCleanup', {
      timestamp: Date.now()
    });
  }

  /**
   * Validate path parameter
   * @private
   * @param {string} path - Path to validate
   */
  _validatePath(path) {
    if (path === null || path === undefined) {
      throw new Error('Path must be a string');
    }

    if (typeof path !== 'string') {
      throw new Error('Path must be a string');
    }

    if (path.trim() === '') {
      throw new Error('Path cannot be empty');
    }
  }

  /**
   * Check if has read permission for path
   * @private
   * @param {string} path - Path to check
   * @returns {boolean} True if has read permission
   */
  _hasReadPermission(path) {
    if (!Array.isArray(this.permissions.read)) {
      throw new Error('Invalid permission format');
    }

    return this.permissions.read.some(pattern => this._pathMatches(path, pattern));
  }

  /**
   * Check if has write permission for path
   * @private
   * @param {string} path - Path to check
   * @returns {boolean} True if has write permission
   */
  _hasWritePermission(path) {
    if (!Array.isArray(this.permissions.write)) {
      throw new Error('Invalid permission format');
    }

    return this.permissions.write.some(pattern => this._pathMatches(path, pattern));
  }

  /**
   * Check if path matches permission pattern
   * @private
   * @param {string} path - Path to check
   * @param {string} pattern - Permission pattern (supports wildcards)
   * @returns {boolean} True if path matches pattern
   */
  _pathMatches(path, pattern) {
    // Convert pattern to regex
    const regexPattern = pattern
      .replace(/\./g, '\\.')
      .replace(/\*/g, '.*');
    
    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(path);
  }

  /**
   * Get value from state using path
   * @private
   * @param {string} path - Path to get value from
   * @returns {*} Value at path
   */
  _getValueFromPath(path) {
    try {
      const state = this.dataStore.getState();
      const pathSegments = path.split('.');
      let current = state;

      for (const segment of pathSegments) {
        if (current && typeof current === 'object' && segment in current) {
          current = current[segment];
        } else {
          return undefined;
        }
      }

      return current;
    } catch (error) {
      throw new Error(`Failed to read state for path "${path}": ${error.message}`);
    }
  }

  /**
   * Start optimistic update
   * @private
   * @param {string} viewId - View ID
   * @param {*} oldValue - Original value
   * @param {*} newValue - New value
   */
  _startOptimisticUpdate(viewId, oldValue, newValue) {
    const view = this.views.get(viewId);
    if (view) {
      // Store original value for rollback
      this.pendingChanges.set(viewId, {
        originalValue: oldValue,
        newValue,
        timestamp: Date.now()
      });

      // Apply optimistic update immediately
      view.value = newValue;
      view.version++;
      view.lastModified = Date.now();
    }
  }

  /**
   * Add change to batch
   * @private
   * @param {string} viewId - View ID
   * @param {*} oldValue - Old value
   * @param {*} newValue - New value
   */
  _addToBatch(viewId, oldValue, newValue) {
    this.batchChanges.set(viewId, {
      oldValue,
      newValue,
      timestamp: Date.now()
    });
  }

  /**
   * Record change in history
   * @private
   * @param {string} viewId - View ID
   * @param {*} oldValue - Old value
   * @param {*} newValue - New value
   */
  _recordChange(viewId, oldValue, newValue) {
    if (!this.changeHistory.has(viewId)) {
      this.changeHistory.set(viewId, []);
    }

    const history = this.changeHistory.get(viewId);
    history.push({
      oldValue,
      newValue,
      timestamp: Date.now()
    });

    // Keep only last 50 changes to prevent memory leaks
    if (history.length > 50) {
      history.splice(0, history.length - 50);
    }
  }
}