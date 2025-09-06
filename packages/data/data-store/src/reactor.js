import { SubscriptionRegistry } from './subscription.js';

/**
 * ReactiveEngine - Change detection and subscription management
 * 
 * Analyzes DataScript transactions and triggers subscriptions based on data changes.
 */

// Private state storage for ReactiveEngine instances
const engineStates = new WeakMap();

/**
 * TransactionAnalyzer - Analyzes DataScript transaction data for changes
 */
export class TransactionAnalyzer {
  /**
   * Analyze transaction data to extract change information
   * @param {Array} txData - Array of datoms from DataScript transaction
   * @returns {Object} Analysis result with change information
   */
  static analyze(txData) {
    if (!txData || !Array.isArray(txData)) {
      return TransactionAnalyzer._emptyAnalysis();
    }

    const changedEntities = new Set();
    const changedAttributes = new Set();
    const referencedEntities = new Set();
    const addedDatoms = [];
    const retractedDatoms = [];
    const changesByEntity = new Map();
    const changesByAttribute = new Map();
    const affectedPairs = new Set();

    for (const datom of txData) {
      if (!datom || typeof datom !== 'object') continue;

      const { e, a, v, added } = datom;

      // Track entity and attribute changes
      changedEntities.add(e);
      changedAttributes.add(a);
      
      // Track entity-attribute pairs
      affectedPairs.add(`${e}|${a}`);

      // Categorize additions vs retractions
      if (added) {
        addedDatoms.push(datom);
      } else {
        retractedDatoms.push(datom);
      }

      // Group by entity
      if (!changesByEntity.has(e)) {
        changesByEntity.set(e, []);
      }
      changesByEntity.get(e).push(datom);

      // Group by attribute
      if (!changesByAttribute.has(a)) {
        changesByAttribute.set(a, []);
      }
      changesByAttribute.get(a).push(datom);

      // Track referenced entities (for ref attributes)
      if (typeof v === 'number' && v > 0 && a !== ':db/txInstant') {
        // This might be a reference to another entity
        referencedEntities.add(v);
      }
    }

    return {
      changedEntities,
      changedAttributes,
      referencedEntities,
      addedDatoms,
      retractedDatoms,
      changesByEntity,
      changesByAttribute,
      affectedPairs,
      
      getSummary() {
        return {
          totalDatoms: txData.length,
          addedCount: addedDatoms.length,
          retractedCount: retractedDatoms.length,
          entitiesChanged: changedEntities.size,
          attributesChanged: changedAttributes.size,
          referencedEntitiesCount: referencedEntities.size
        };
      }
    };
  }

  /**
   * Create empty analysis result
   * @private
   */
  static _emptyAnalysis() {
    return {
      changedEntities: new Set(),
      changedAttributes: new Set(),
      referencedEntities: new Set(),
      addedDatoms: [],
      retractedDatoms: [],
      changesByEntity: new Map(),
      changesByAttribute: new Map(),
      affectedPairs: new Set(),
      
      getSummary() {
        return {
          totalDatoms: 0,
          addedCount: 0,
          retractedCount: 0,
          entitiesChanged: 0,
          attributesChanged: 0,
          referencedEntitiesCount: 0
        };
      }
    };
  }
}

/**
 * ReactiveEngine - Manages subscriptions and change detection
 */
export class ReactiveEngine {
  constructor(store) {
    // Validate input
    if (!store) {
      throw new Error('DataStore is required');
    }
    
    // Check if it's actually a DataStore instance
    if (!store.conn || !store.db || typeof store.db !== 'function') {
      throw new Error('DataStore must be a DataStore instance');
    }

    this.store = store;
    
    // Initialize mutable state in WeakMap
    engineStates.set(this, {
      subscriptionRegistry: new SubscriptionRegistry(),
      isListening: false,
      listenerKey: null,
      lastAnalysis: null,
      onTransactionAnalysis: null
    });
    
    // Freeze the instance
    Object.freeze(this);
  }

  /**
   * Get mutable state for this engine instance
   * @private
   */
  _getState() {
    return engineStates.get(this);
  }

  /**
   * Set onTransactionAnalysis callback
   */
  set onTransactionAnalysis(callback) {
    const state = this._getState();
    if (state) {
      state.onTransactionAnalysis = callback;
    }
  }

  /**
   * Get onTransactionAnalysis callback
   */
  get onTransactionAnalysis() {
    const state = this._getState();
    return state ? state.onTransactionAnalysis : null;
  }

  /**
   * Get subscriptions registry
   */
  get subscriptions() {
    const state = this._getState();
    return state ? state.subscriptionRegistry : new SubscriptionRegistry();
  }

  /**
   * Start listening to DataStore transactions
   */
  startListening() {
    const state = this._getState();
    if (!state || state.isListening) return;

    const listenerKey = `reactive-engine-${Date.now()}-${Math.random()}`;
    this.store.conn.listen(listenerKey, (report) => {
      this.processTransaction(report);
    });
    
    state.isListening = true;
    state.listenerKey = listenerKey;
  }

  /**
   * Stop listening to DataStore transactions
   */
  stopListening() {
    const state = this._getState();
    if (!state || !state.isListening || !state.listenerKey) return;

    this.store.conn.unlisten(state.listenerKey);
    state.isListening = false;
    state.listenerKey = null;
  }

  /**
   * Process a transaction report from DataScript
   * @param {Object} report - Transaction report from DataScript
   */
  processTransaction(report) {
    if (!report || !report.txData) return;

    const state = this._getState();
    if (!state) return;

    // Analyze the transaction
    state.lastAnalysis = TransactionAnalyzer.analyze(report.txData);
    
    // Call external handler if set
    if (typeof state.onTransactionAnalysis === 'function') {
      try {
        state.onTransactionAnalysis(state.lastAnalysis);
      } catch (error) {
        // Don't let callback errors break transaction processing
        console.error('Error in transaction analysis callback:', error);
      }
    }

    // TODO: Process subscriptions (will be implemented in next steps)
    this._processSubscriptions(state.lastAnalysis);
  }

  /**
   * Get the last transaction analysis
   * @returns {Object|null} Last analysis result or null
   */
  getLastAnalysis() {
    const state = this._getState();
    return state ? state.lastAnalysis : null;
  }

  /**
   * Get subscription count
   * @returns {number} Number of active subscriptions
   */
  getSubscriptionCount() {
    const state = this._getState();
    return state ? state.subscriptionRegistry.size() : 0;
  }

  /**
   * Get active subscriptions
   * @returns {Array} Array of subscription objects
   */
  getActiveSubscriptions() {
    const state = this._getState();
    return state ? state.subscriptionRegistry.getAll() : [];
  }

  /**
   * Add a subscription to the registry
   * @param {Subscription} subscription - Subscription to add
   */
  addSubscription(subscription) {
    const state = this._getState();
    if (state) {
      state.subscriptionRegistry.register(subscription);
    }
  }

  /**
   * Remove a subscription from the registry
   * @param {string} subscriptionId - ID of subscription to remove
   * @returns {Subscription|undefined} Removed subscription
   */
  removeSubscription(subscriptionId) {
    const state = this._getState();
    return state ? state.subscriptionRegistry.unregister(subscriptionId) : undefined;
  }

  /**
   * Get subscription by ID
   * @param {string} subscriptionId - Subscription ID
   * @returns {Subscription|undefined} Subscription or undefined
   */
  getSubscription(subscriptionId) {
    const state = this._getState();
    return state ? state.subscriptionRegistry.get(subscriptionId) : undefined;
  }

  /**
   * Find subscriptions by entity ID
   * @param {number|null} entityId - Entity ID or null for general subscriptions
   * @returns {Array<Subscription>} Subscriptions for the entity
   */
  findSubscriptionsByEntity(entityId) {
    const state = this._getState();
    return state ? state.subscriptionRegistry.findByEntity(entityId) : [];
  }

  /**
   * Find subscriptions by attribute
   * @param {string} attribute - Attribute name
   * @returns {Array<Subscription>} Subscriptions involving the attribute
   */
  findSubscriptionsByAttribute(attribute) {
    const state = this._getState();
    return state ? state.subscriptionRegistry.findByAttribute(attribute) : [];
  }

  /**
   * Clean up deactivated subscriptions
   * @returns {number} Number of subscriptions removed
   */
  cleanupSubscriptions() {
    const state = this._getState();
    return state ? state.subscriptionRegistry.cleanup() : 0;
  }

  /**
   * Find subscriptions affected by transaction analysis
   * @param {Object} analysis - Transaction analysis result
   * @returns {Array<Subscription>} Affected subscriptions
   */
  findAffectedSubscriptions(analysis) {
    if (!analysis || !analysis.changedAttributes) {
      return [];
    }

    const affectedSubs = new Set();
    
    // For each changed attribute, find relevant subscriptions
    for (const changedAttr of analysis.changedAttributes) {
      const attrSubs = this.findSubscriptionsByAttribute(changedAttr);
      
      attrSubs.forEach(sub => {
        if (!sub.isEntityRooted()) {
          // General subscriptions: affected if their attributes changed
          affectedSubs.add(sub);
        } else {
          // Entity-rooted subscriptions: affected if their attributes changed AND their entity changed
          if (analysis.changedEntities.has(sub.rootEntity)) {
            affectedSubs.add(sub);
          }
        }
      });
    }
    
    // Filter out inactive subscriptions
    return Array.from(affectedSubs).filter(sub => sub.isActive());
  }

  /**
   * Notify affected subscriptions with change information
   * @param {Object} analysis - Transaction analysis result
   */
  notifyAffectedSubscriptions(analysis) {
    if (!analysis) return;

    const affectedSubscriptions = this.findAffectedSubscriptions(analysis);
    
    // Create change information for callbacks
    const changes = {
      addedEntities: Array.from(analysis.changedEntities).filter(entityId => {
        // Check if entity has only additions (new entity)
        const entityChanges = analysis.changesByEntity.get(entityId) || [];
        return entityChanges.every(datom => datom.added);
      }),
      retractedEntities: Array.from(analysis.changedEntities).filter(entityId => {
        // Check if entity has only retractions (deleted entity)
        const entityChanges = analysis.changesByEntity.get(entityId) || [];
        return entityChanges.every(datom => !datom.added);
      }),
      updatedEntities: Array.from(analysis.changedEntities).filter(entityId => {
        // Check if entity has both additions and retractions (updated entity)
        const entityChanges = analysis.changesByEntity.get(entityId) || [];
        return entityChanges.some(datom => datom.added) && entityChanges.some(datom => !datom.added);
      }),
      changedAttributes: Array.from(analysis.changedAttributes),
      summary: analysis.getSummary()
    };

    // Notify each affected subscription
    affectedSubscriptions.forEach(subscription => {
      try {
        // For now, we'll provide empty results since we haven't implemented query execution yet
        // This will be completed in Phase 4
        const results = [];
        subscription.notify(results, changes);
      } catch (error) {
        // Don't let subscription errors break other notifications
        console.error(`Error notifying subscription ${subscription.id}:`, error);
      }
    });
  }

  /**
   * Process batched changes efficiently
   * @param {Array<Object>} analyses - Array of transaction analyses
   */
  processBatchedChanges(analyses) {
    if (!analyses || analyses.length === 0) return;

    // Combine all analyses into a single change set
    const combinedChanges = {
      changedEntities: new Set(),
      changedAttributes: new Set(),
      addedDatoms: [],
      retractedDatoms: []
    };

    analyses.forEach(analysis => {
      analysis.changedEntities.forEach(e => combinedChanges.changedEntities.add(e));
      analysis.changedAttributes.forEach(a => combinedChanges.changedAttributes.add(a));
      combinedChanges.addedDatoms.push(...analysis.addedDatoms);
      combinedChanges.retractedDatoms.push(...analysis.retractedDatoms);
    });

    // Find unique affected subscriptions across all changes
    const allAffectedSubs = new Set();
    analyses.forEach(analysis => {
      const affected = this.findAffectedSubscriptions(analysis);
      affected.forEach(sub => allAffectedSubs.add(sub));
    });

    // Notify each subscription once with combined changes
    const combinedChangesInfo = {
      addedEntities: Array.from(combinedChanges.changedEntities),
      retractedEntities: [],
      updatedEntities: [],
      changedAttributes: Array.from(combinedChanges.changedAttributes),
      summary: {
        totalChanges: analyses.length,
        totalDatoms: combinedChanges.addedDatoms.length + combinedChanges.retractedDatoms.length
      }
    };

    Array.from(allAffectedSubs).forEach(subscription => {
      try {
        subscription.notify([], combinedChangesInfo);
      } catch (error) {
        console.error(`Error in batched notification for subscription ${subscription.id}:`, error);
      }
    });
  }

  /**
   * Process subscriptions for transaction analysis
   * @param {Object} analysis - Transaction analysis result
   * @private
   */
  _processSubscriptions(analysis) {
    if (!analysis) return;
    
    // Notify affected subscriptions
    this.notifyAffectedSubscriptions(analysis);
    
    // Cleanup deactivated subscriptions periodically
    if (Math.random() < 0.1) { // 10% chance to cleanup on each transaction
      this.cleanupSubscriptions();
    }
  }
}