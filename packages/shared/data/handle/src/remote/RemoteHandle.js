/**
 * RemoteHandle.js
 *
 * Handle implementation that acts as its own DataSource and proxies all operations
 * to a remote Handle through Actor channels.
 *
 * Phase 3: Core RemoteHandle Implementation
 *
 * Key characteristics:
 * - Extends Handle
 * - IS its own DataSource (super(this))
 * - All DataSource methods proxy through Actor channel
 * - Stateless - no local cache
 * - Schema-based - enables PrototypeFactory
 */

import { Handle } from '../Handle.js';
import { RemoteCallManager } from './RemoteCallManager.js';

export class RemoteHandle extends Handle {
  /**
   * Create a RemoteHandle wrapping a remote server Handle
   *
   * @param {string} actorGuid - GUID of the server Handle in remote ActorSpace
   * @param {Channel} channel - Actor channel for communication
   * @param {Object} metadata - Handle metadata from serialization
   * @param {string} metadata.handleType - Original Handle type name
   * @param {Object} metadata.schema - DataSource schema
   * @param {Array<string>} metadata.capabilities - Supported operations
   */
  constructor(actorGuid, channel, metadata) {
    // WORKAROUND: Can't pass 'this' to super() before 'this' exists
    // Create a minimal DataSource object that redirects to 'this'
    // This will be replaced with 'this' after super() completes
    const selfRef = {
      query: (...args) => selfRef._target.query(...args),
      subscribe: (...args) => selfRef._target.subscribe(...args),
      getSchema: (...args) => selfRef._target.getSchema(...args),
      queryBuilder: (...args) => selfRef._target.queryBuilder(...args),
      update: (...args) => selfRef._target.update(...args)
    };

    // Call Handle constructor with the redirect object
    super(selfRef);

    // Now 'this' exists - set the redirect target to this RemoteHandle
    selfRef._target = this;

    // Store remote Handle reference
    this.actorGuid = actorGuid;
    this._channel = channel;

    // Store metadata from serialization
    // Note: handleType is a getter in Handle (returns constructor.name)
    // Store the original remote handleType separately
    this._remoteHandleType = metadata.handleType;
    this._schema = metadata.schema;
    this.capabilities = metadata.capabilities || [];

    // Replace dataSource with self (true self-referential)
    this.dataSource = this;

    // Phase 5: Initialize RemoteCallManager for method calls
    this._callManager = new RemoteCallManager();

    // Phase 8: Enable PrototypeFactory if schema present
    if (this._schema) {
      this._enablePrototypeFactory(this._schema);
    }

    // Phase 11: Initialize subscription tracking
    this._subscriptions = new Map();
    this._subscriptionCounter = 0;
  }

  // ============================================================================
  // DataSource Interface Implementation
  // All methods proxy to remote server Handle through Actor channel
  // ============================================================================

  /**
   * Execute query on remote DataSource
   * Phase 5: Implemented with RemoteCallManager
   *
   * @param {Object} querySpec - Query specification
   * @returns {Promise<Array>} Query results
   */
  query(querySpec) {
    return this._callRemote('query', querySpec);
  }

  /**
   * Subscribe to changes on remote DataSource
   * Phase 11: Implemented with remote subscription protocol
   *
   * @param {Object} querySpec - Query specification
   * @param {Function} callback - Callback for updates
   * @returns {Object} Subscription handle with unsubscribe()
   */
  subscribe(querySpec, callback) {
    // Generate unique subscription ID
    const subscriptionId = `sub-${this.actorGuid}-${++this._subscriptionCounter}`;

    // Store callback for incoming updates
    this._subscriptions.set(subscriptionId, callback);

    // Send subscribe request to server (returns subscription handle from server)
    this._callRemote('subscribe', querySpec, subscriptionId).catch(error => {
      // If subscription fails, clean up local callback
      this._subscriptions.delete(subscriptionId);
      throw error;
    });

    // Return unsubscribe handle
    return {
      id: subscriptionId,
      unsubscribe: () => this._unsubscribe(subscriptionId)
    };
  }

  /**
   * Unsubscribe from remote subscription
   * Phase 11: Remote Subscriptions
   * @private
   */
  _unsubscribe(subscriptionId) {
    // Remove local callback
    this._subscriptions.delete(subscriptionId);

    // Notify server to unsubscribe
    this._callRemote('unsubscribe', subscriptionId).catch(error => {
      console.warn(`Failed to unsubscribe ${subscriptionId}:`, error);
    });
  }

  /**
   * Get schema from cached metadata (no remote call needed)
   *
   * @returns {Object|null} DataSource schema
   */
  getSchema() {
    return this._schema;
  }

  /**
   * Get query builder for Handle-based queries
   * TODO: Phase 10 - Verify works with Handle projections
   *
   * @param {Handle} sourceHandle - Handle initiating the query
   * @returns {Object} Query builder instance
   */
  queryBuilder(sourceHandle) {
    // TODO: Implement in Phase 10 - should use DefaultQueryBuilder
    // For now, return minimal implementation to pass validation
    return {
      where: () => this,
      select: () => this,
      orderBy: () => this,
      limit: () => this,
      skip: () => this,
      toArray: () => {
        throw new Error('RemoteHandle.queryBuilder().toArray() not yet implemented - Phase 10');
      }
    };
  }

  /**
   * Update data on remote DataSource
   * Phase 9: Implemented with RemoteCallManager
   *
   * @param {Object} updateSpec - Update specification
   * @returns {Promise<*>} Update result
   */
  update(updateSpec) {
    return this._callRemote('update', updateSpec);
  }

  // ============================================================================
  // Handle Interface Implementation
  // ============================================================================

  /**
   * Get current value through remote query
   * TODO: Phase 5 - Implement with query()
   *
   * @returns {Promise<*>} Current value
   */
  value() {
    // TODO: Implement in Phase 5 using this.query()
    throw new Error('RemoteHandle.value() not yet implemented - Phase 5');
  }

  // ============================================================================
  // RemoteHandle-Specific Methods
  // ============================================================================

  /**
   * Check if this is a remote Handle
   * @returns {boolean} Always true for RemoteHandle
   */
  get isRemote() {
    return true;
  }

  /**
   * Get the remote Actor GUID
   * @returns {string} Actor GUID
   */
  getRemoteGuid() {
    return this.actorGuid;
  }

  /**
   * Get the communication channel
   * @returns {Channel} Actor channel
   */
  getChannel() {
    return this._channel;
  }

  /**
   * Check if a capability is supported
   * @param {string} capability - Capability name
   * @returns {boolean} True if supported
   */
  hasCapability(capability) {
    return this.capabilities.includes(capability);
  }

  // ============================================================================
  // Remote Communication Helpers
  // Phase 5: Remote Call Mechanism
  // ============================================================================

  /**
   * Actor receive() implementation for RemoteHandle
   * Phase 7: Handle remote-response messages from server
   * Phase 11: Handle subscription-update messages from server
   *
   * @param {Object} message - Incoming Actor message
   * @returns {*} Response (if any)
   */
  receive(message) {
    if (typeof message === 'object' && message.type) {
      switch (message.type) {
        case 'remote-response':
          // Phase 7: Route response to RemoteCallManager
          this._handleResponse(message);
          return undefined; // Response handled asynchronously via promise

        case 'subscription-update':
          // Phase 11: Route subscription update to callback
          this._handleSubscriptionUpdate(message);
          return undefined; // Update handled asynchronously

        default:
          // Let parent Handle handle other message types
          return super.receive(message);
      }
    }

    // Let parent Handle handle other message types
    return super.receive(message);
  }

  /**
   * Call a method on the remote Handle and return promise for result
   *
   * @param {string} method - Method name to call on remote DataSource
   * @param {...*} args - Arguments to pass to remote method
   * @returns {Promise<*>} Promise that resolves with remote method result
   * @private
   */
  _callRemote(method, ...args) {
    // Create remote call with promise
    const { callId, promise } = this._callManager.createCall();

    // Get our GUID from ActorSpace for response routing
    const myGuid = this._channel.actorSpace.objectToGuid.get(this);

    // Send message through Actor channel
    const message = {
      type: 'remote-call',
      callId,
      method,
      args,
      sourceGuid: myGuid  // Phase 7: Include source GUID for response routing
    };

    // Send to remote Handle via its Actor GUID
    this._channel.send(this.actorGuid, message);

    return promise;
  }

  /**
   * Handle response from remote call
   * Called by channel when remote-response message arrives
   *
   * @param {Object} response - Response message from server
   * @param {string} response.callId - Call ID
   * @param {*} response.result - Result from remote method (if successful)
   * @param {string} response.error - Error message (if failed)
   * @private
   */
  _handleResponse(response) {
    const { callId, result, error } = response;

    if (error) {
      this._callManager.rejectCall(callId, error);
    } else {
      this._callManager.resolveCall(callId, result);
    }
  }

  /**
   * Handle subscription update from server
   * Phase 11: Remote Subscriptions
   *
   * @param {Object} message - Subscription update message
   * @param {string} message.subscriptionId - Subscription ID
   * @param {*} message.changes - Change data from server
   * @private
   */
  _handleSubscriptionUpdate(message) {
    const { subscriptionId, changes } = message;

    const callback = this._subscriptions.get(subscriptionId);
    if (callback) {
      try {
        callback(changes);
      } catch (error) {
        console.error(`Error in subscription callback for ${subscriptionId}:`, error);
      }
    }
  }

  /**
   * Create a Proxy wrapper that forwards unknown method calls to remote Handle
   * This enables transparent access to custom Handle methods like getType(), getTitle(), etc.
   *
   * @returns {Proxy} Proxied RemoteHandle that forwards unknown methods
   */
  static createProxy(remoteHandle) {
    return new Proxy(remoteHandle, {
      get(target, prop, receiver) {
        // If property exists on RemoteHandle, use it
        if (prop in target || typeof prop === 'symbol') {
          return Reflect.get(target, prop, receiver);
        }

        // For unknown methods, create a function that forwards to remote
        return function(...args) {
          return target._callRemote(prop, ...args);
        };
      }
    });
  }
}