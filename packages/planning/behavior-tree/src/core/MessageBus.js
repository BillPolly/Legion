/**
 * MessageBus - Handles asynchronous communication between BT nodes
 * 
 * Key features:
 * - Prevents call stack overflow with async message processing
 * - Supports both parent-child and peer-to-peer communication
 * - Maintains message ordering and delivery guarantees
 * - Enables reactive coordination patterns
 */

export class MessageBus {
  constructor() {
    this.messageQueue = [];
    this.globalNodes = new Map(); // For cross-tree communication
    this.isProcessing = false;
    this.messageHandlers = new Map();
    this.messageId = 0;
  }

  /**
   * Send message from one node to another
   * @param {BehaviorTreeNode} from - Sender node
   * @param {BehaviorTreeNode} to - Recipient node  
   * @param {Object} message - Message payload
   */
  sendMessage(from, to, message) {
    const messageWithId = {
      id: ++this.messageId,
      from,
      to,
      message: {
        ...message,
        timestamp: Date.now()
      },
      timestamp: Date.now()
    };

    this.messageQueue.push(messageWithId);
    this.processMessages();
  }

  /**
   * Process all queued messages asynchronously
   * Uses setTimeout(0) to break call stack and prevent overflow
   */
  async processMessages() {
    if (this.isProcessing) return;
    this.isProcessing = true;

    while (this.messageQueue.length > 0) {
      const { from, to, message } = this.messageQueue.shift();
      
      try {
        await new Promise(resolve => {
          setTimeout(() => {
            try {
              to.handleMessage(from, message);
            } catch (error) {
              console.error('[MessageBus] Message handling error:', error);
              // Optionally emit error event for monitoring
              this.emitError(from, to, message, error);
            }
            resolve();
          }, 0);
        });
      } catch (error) {
        console.error('[MessageBus] Critical message processing error:', error);
      }
    }

    this.isProcessing = false;
  }

  /**
   * Register a node for global communication
   * @param {string} nodeId - Global unique identifier for the node
   * @param {BehaviorTreeNode} node - The node instance
   */
  registerGlobalNode(nodeId, node) {
    this.globalNodes.set(nodeId, node);
  }

  /**
   * Unregister a global node
   * @param {string} nodeId - Node identifier
   */
  unregisterGlobalNode(nodeId) {
    this.globalNodes.delete(nodeId);
  }

  /**
   * Send message to global node by ID
   * @param {BehaviorTreeNode} from - Sender
   * @param {string} toNodeId - Target node ID
   * @param {Object} message - Message payload
   */
  sendToGlobalNode(from, toNodeId, message) {
    const targetNode = this.globalNodes.get(toNodeId);
    if (!targetNode) {
      console.warn(`[MessageBus] Global node not found: ${toNodeId}`);
      return false;
    }

    this.sendMessage(from, targetNode, message);
    return true;
  }

  /**
   * Broadcast message to all global nodes
   * @param {BehaviorTreeNode} from - Sender
   * @param {Object} message - Message payload
   * @param {Function} filter - Optional filter function
   */
  broadcast(from, message, filter = null) {
    for (const [nodeId, node] of this.globalNodes) {
      if (node === from) continue; // Don't send to self
      if (filter && !filter(nodeId, node)) continue;

      this.sendMessage(from, node, {
        ...message,
        broadcast: true
      });
    }
  }

  /**
   * Register a message handler for specific message types
   * @param {string} messageType - Type of message to handle
   * @param {Function} handler - Handler function
   */
  registerMessageHandler(messageType, handler) {
    if (!this.messageHandlers.has(messageType)) {
      this.messageHandlers.set(messageType, []);
    }
    this.messageHandlers.get(messageType).push(handler);
  }

  /**
   * Emit error for monitoring/debugging
   */
  emitError(from, to, message, error) {
    const errorEvent = {
      type: 'MESSAGE_ERROR',
      from: from.config?.name || 'unknown',
      to: to.config?.name || 'unknown', 
      message,
      error: error.message,
      timestamp: Date.now()
    };

    // Could emit to external monitoring system
    console.error('[MessageBus] Error Event:', errorEvent);
  }

  /**
   * Get current queue status for debugging
   */
  getQueueStatus() {
    return {
      queueLength: this.messageQueue.length,
      isProcessing: this.isProcessing,
      globalNodes: Array.from(this.globalNodes.keys())
    };
  }

  /**
   * Clear all queued messages (for cleanup/reset)
   */
  clearQueue() {
    this.messageQueue = [];
    this.isProcessing = false;
  }

  /**
   * Shutdown the message bus
   */
  async shutdown() {
    // Process remaining messages
    if (this.messageQueue.length > 0) {
      await this.processMessages();
    }

    this.clearQueue();
    this.globalNodes.clear();
    this.messageHandlers.clear();
  }
}