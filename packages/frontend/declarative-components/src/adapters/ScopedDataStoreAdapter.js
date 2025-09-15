/**
 * ScopedDataStoreAdapter - Provides scoped state projection for hierarchical components
 * 
 * Manages state isolation between parent and child components by projecting
 * child state paths to parent state paths while maintaining local scope isolation.
 */

import { DataStoreAdapter } from './DataStoreAdapter.js';
import { StateProjector } from '../utils/StateProjector.js';

export class ScopedDataStoreAdapter {
  constructor(parentAdapter, projectionRules) {
    if (!parentAdapter) {
      throw new Error('Parent adapter is required');
    }
    
    if (!(parentAdapter instanceof DataStoreAdapter)) {
      throw new Error('Parent adapter must be a DataStoreAdapter instance');
    }
    
    if (!projectionRules) {
      throw new Error('Projection rules are required');
    }
    
    if (typeof projectionRules !== 'object' || Array.isArray(projectionRules)) {
      throw new Error('Projection rules must be an object');
    }
    
    this.parentAdapter = parentAdapter;
    this.stateProjector = new StateProjector(projectionRules); // Use StateProjector utility
    this.localScope = {}; // Isolated state for this scoped adapter
    this.subscriptions = new Set(); // Track subscriptions for cleanup
  }

  /**
   * Get projected parent path for a local path
   * @param {string} localPath - Local property path
   * @returns {string} Parent path or original local path if no projection
   */
  getProjectedPath(localPath) {
    return this.stateProjector.project(localPath);
  }

  /**
   * Set projection variable for dynamic array indexing
   * @param {string} variable - Variable name
   * @param {*} value - Variable value
   */
  setProjectionVariable(variable, value) {
    this.stateProjector.setVariable(variable, value);
  }

  /**
   * Get projection variable value
   * @param {string} variable - Variable name
   * @returns {*} Variable value
   */
  getProjectionVariable(variable) {
    return this.stateProjector.getVariable(variable);
  }

  /**
   * Get property value with projection support
   * @param {string} path - Property path
   * @returns {*} Property value
   */
  getProperty(path) {
    const projectedPath = this.getProjectedPath(path);
    
    if (projectedPath === path) {
      // No projection - check local scope first
      return this.getLocalProperty(path);
    } else {
      // Use projection - get from parent adapter
      return this.parentAdapter.getProperty(projectedPath);
    }
  }

  /**
   * Set property value with projection support
   * @param {string} path - Property path
   * @param {*} value - Property value
   */
  setProperty(path, value) {
    const projectedPath = this.getProjectedPath(path);
    
    if (projectedPath === path) {
      // No projection - set in local scope
      this.setLocalProperty(path, value);
    } else {
      // Use projection - set in parent adapter
      this.parentAdapter.setProperty(projectedPath, value);
    }
  }

  /**
   * Get property from local scope
   * @param {string} path - Property path
   * @returns {*} Property value
   * @private
   */
  getLocalProperty(path) {
    const keys = path.split('.');
    let value = this.localScope;
    
    for (const key of keys) {
      if (value && typeof value === 'object' && key in value) {
        value = value[key];
      } else {
        return undefined;
      }
    }
    
    return value;
  }

  /**
   * Set property in local scope
   * @param {string} path - Property path
   * @param {*} value - Property value
   * @private
   */
  setLocalProperty(path, value) {
    const keys = path.split('.');
    let target = this.localScope;
    
    // Navigate to the target object, creating nested objects as needed
    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      if (!target[key] || typeof target[key] !== 'object') {
        target[key] = {};
      }
      target = target[key];
    }
    
    // Set the final value
    target[keys[keys.length - 1]] = value;
  }

  /**
   * Initialize entities in the appropriate scope
   * @param {Object} entityData - Entity data to initialize
   * @returns {Promise<void>}
   */
  async initializeEntities(entityData) {
    // Check if any entity paths are projected
    for (const [entityName, data] of Object.entries(entityData)) {
      if (this.stateProjector.hasProjectionRule(entityName)) {
        // Entity is projected - initialize in parent
        const projectedPath = this.getProjectedPath(entityName);
        await this.parentAdapter.initializeEntities({ [projectedPath]: data });
      } else {
        // Entity is local - store in local scope
        this.setLocalProperty(entityName, data);
      }
    }
  }

  /**
   * Subscribe to property changes with projection support
   * @param {string} path - Property path to watch
   * @param {Function} callback - Change callback
   * @returns {Object} Subscription object with unsubscribe method
   */
  subscribe(path, callback) {
    const projectedPath = this.getProjectedPath(path);
    
    let subscription;
    
    if (projectedPath === path) {
      // Local property - create local subscription mechanism
      // For now, return a simple subscription object
      subscription = {
        id: `local_${Date.now()}_${Math.random()}`,
        path: path,
        callback: callback,
        unsubscribe: () => {
          this.subscriptions.delete(subscription);
        }
      };
    } else {
      // Projected property - subscribe through parent adapter
      subscription = this.parentAdapter.subscribe(projectedPath, callback);
    }
    
    this.subscriptions.add(subscription);
    return subscription;
  }

  /**
   * Get the underlying DataStore (delegated to parent)
   * @returns {Object} DataStore instance
   */
  getDataStore() {
    return this.parentAdapter.getDataStore();
  }

  /**
   * Get reactive engine (delegated to parent)
   * @returns {Object} Reactive engine instance
   */
  getReactiveEngine() {
    return this.parentAdapter.getReactiveEngine();
  }

  /**
   * Clean up subscriptions and references
   */
  cleanup() {
    // Unsubscribe from all subscriptions
    for (const subscription of this.subscriptions) {
      if (typeof subscription.unsubscribe === 'function') {
        subscription.unsubscribe();
      }
    }
    
    // Clear collections
    this.subscriptions.clear();
    this.stateProjector.clearAllVariables();
    this.localScope = {};
  }

  /**
   * Get metadata about this scoped adapter
   * @returns {Object} Metadata
   */
  getMetadata() {
    const projectorMetadata = this.stateProjector.getMetadata();
    return {
      type: 'ScopedDataStoreAdapter',
      projectionRulesCount: projectorMetadata.projectionRuleCount,
      projectionVariablesCount: projectorMetadata.variableCount,
      localScopeKeysCount: Object.keys(this.localScope).length,
      subscriptionsCount: this.subscriptions.size,
      parentAdapterType: this.parentAdapter.constructor.name
    };
  }
}