/**
 * ActorCommunication Port
 * Interface for actor-based messaging
 */

export class ActorCommunication {
  /**
   * Send message to remote actor
   * @param {string} messageType - Type of message
   * @param {object} data - Message payload
   */
  send(messageType, data) {
    throw new Error('ActorCommunication.send must be implemented');
  }
  
  /**
   * Register handler for incoming messages
   * @param {string} messageType - Type of message to handle
   * @param {function} handler - Message handler function
   */
  on(messageType, handler) {
    throw new Error('ActorCommunication.on must be implemented');
  }
  
  /**
   * Remove message handler
   * @param {string} messageType - Type of message
   * @param {function} handler - Handler to remove
   */
  off(messageType, handler) {
    throw new Error('ActorCommunication.off must be implemented');
  }
  
  /**
   * Check if connected to remote actor
   * @returns {boolean} Connection status
   */
  isConnected() {
    throw new Error('ActorCommunication.isConnected must be implemented');
  }
  
  /**
   * Wait for connection to be established
   * @returns {Promise<void>}
   */
  async waitForConnection() {
    throw new Error('ActorCommunication.waitForConnection must be implemented');
  }
}