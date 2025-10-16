/**
 * RemoteHandle - Convenience wrapper for accessing remote Handles via ActorSpace
 *
 * Provides familiar Handle interface (query, subscribe, value) for remote actors
 * instead of requiring manual actor message construction.
 */

export class RemoteHandle {
  /**
   * Create a RemoteHandle
   * @param {ActorSpace|Channel} actorSpaceOrChannel - The ActorSpace instance or Channel
   * @param {string} guid - The GUID of the remote actor
   */
  constructor(actorSpaceOrChannel, guid) {
    // Check if this is a Channel or ActorSpace
    if (actorSpaceOrChannel.actorSpace) {
      // It's a Channel
      this._channel = actorSpaceOrChannel;
      this._actorSpace = actorSpaceOrChannel.actorSpace;
      this._remoteActor = actorSpaceOrChannel.makeRemote(guid);
    } else {
      // It's an ActorSpace - need to get the channel
      // For now, use the first channel (simple case)
      this._actorSpace = actorSpaceOrChannel;
      const firstChannel = Array.from(actorSpaceOrChannel.channels.values())[0];
      if (!firstChannel) {
        throw new Error('No channels available in ActorSpace');
      }
      this._channel = firstChannel;
      this._remoteActor = firstChannel.makeRemote(guid);
    }
    this._guid = guid;
  }

  /**
   * Query the remote handle
   * @param {Object} querySpec - Query specification
   * @returns {Promise<Array>} Query results
   */
  async query(querySpec) {
    return this._remoteActor.receive({ type: 'query', querySpec });
  }

  /**
   * Subscribe to changes on the remote handle
   * @param {Object} querySpec - Query specification for subscription
   * @param {Function} callback - Callback function for updates
   * @returns {Promise<Function>} Unsubscribe function
   */
  async subscribe(querySpec, callback) {
    return this._remoteActor.receive({ type: 'subscribe', querySpec, callback });
  }

  /**
   * Get current value from the remote handle
   * @returns {Promise<*>} Current value
   */
  async value() {
    return this._remoteActor.receive({ type: 'value' });
  }

  /**
   * Call a method on the remote handle
   * @param {string} method - Method name
   * @param {...*} args - Method arguments
   * @returns {Promise<*>} Method result
   */
  async call(method, ...args) {
    return this._remoteActor.receive({ type: 'remote-call', method, args });
  }
}
