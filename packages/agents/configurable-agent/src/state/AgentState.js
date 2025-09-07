/**
 * AgentState - Manages conversation history and context variables
 */

import { StateError } from '../utils/ErrorHandling.js';

/**
 * AgentState class for managing agent conversation and context state
 */
export class AgentState {
  constructor(config = {}) {
    this.config = {
      maxMessages: config.maxMessages || 100,
      pruningStrategy: config.pruningStrategy || 'sliding-window',
      contextVariables: config.contextVariables || {}
    };
    
    this.conversationHistory = [];
    this.contextVariables = {};
    this.metadata = {
      createdAt: Date.now(),
      lastUpdated: Date.now(),
      messageCount: 0,
      lastCleared: null
    };
  }

  /**
   * Add a message to conversation history
   * @param {Object} message - Message object with role and content
   */
  addMessage(message) {
    const enhancedMessage = {
      ...message,
      timestamp: message.timestamp || Date.now(),
      id: message.id || `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    };
    
    this.conversationHistory.push(enhancedMessage);
    this.metadata.messageCount++;
    this.metadata.lastUpdated = Date.now();
    
    // Prune if necessary
    if (this.conversationHistory.length > this.config.maxMessages) {
      this._pruneHistory();
    }
  }

  /**
   * Prune conversation history based on strategy
   * @private
   */
  _pruneHistory() {
    if (this.config.pruningStrategy === 'sliding-window') {
      // Keep only the most recent messages
      const excess = this.conversationHistory.length - this.config.maxMessages;
      this.conversationHistory = this.conversationHistory.slice(excess);
    } else if (this.config.pruningStrategy === 'importance-based') {
      // Keep important messages and the most recent
      const sorted = [...this.conversationHistory]
        .sort((a, b) => (b.importance || 0) - (a.importance || 0));
      
      // Always keep the latest message
      const latest = this.conversationHistory[this.conversationHistory.length - 1];
      const important = sorted.slice(0, this.config.maxMessages - 1);
      
      // Ensure latest is included if not already
      if (!important.includes(latest)) {
        important.push(latest);
      }
      
      // Sort back by timestamp to maintain order
      this.conversationHistory = important
        .sort((a, b) => a.timestamp - b.timestamp)
        .slice(-this.config.maxMessages);
    }
  }

  /**
   * Clear conversation history
   */
  clearHistory() {
    this.conversationHistory = [];
    this.metadata.messageCount = 0;
    this.metadata.lastCleared = Date.now();
    this.metadata.lastUpdated = Date.now();
  }

  /**
   * Get recent messages
   * @param {number} count - Number of recent messages to retrieve
   * @returns {Array} Recent messages
   */
  getRecentMessages(count) {
    return this.conversationHistory.slice(-count);
  }

  /**
   * Get conversation history
   * @returns {Array} Conversation messages
   */
  getConversationHistory() {
    return this.conversationHistory;
  }

  /**
   * Add to conversation history (alias for addMessage)
   * @param {Object} message - Message to add
   */
  addToHistory(message) {
    this.addMessage(message);
  }

  /**
   * Set a context variable
   * @param {string} key - Variable key
   * @param {*} value - Variable value
   * @param {boolean} strict - Whether to enforce variable definition
   */
  setContextVariable(key, value, strict = true) {
    const varDef = this.config.contextVariables[key];
    
    if (strict && !varDef) {
      throw new StateError(
        `Context variable ${key} is not defined`,
        key
      );
    }
    
    // Validate type if definition exists
    if (varDef) {
      const expectedType = varDef.type;
      const actualType = Array.isArray(value) ? 'array' : typeof value;
      
      if (expectedType && expectedType !== actualType) {
        throw new StateError(
          `Invalid type for context variable ${key}: expected ${expectedType}, got ${actualType}`,
          key,
          { expectedType, actualType, value }
        );
      }
    }
    
    this.contextVariables[key] = value;
    this.metadata.lastUpdated = Date.now();
  }

  /**
   * Get a context variable
   * @param {string} key - Variable key
   * @param {*} defaultValue - Default value if not found
   * @returns {*} Variable value
   */
  getContextVariable(key, defaultValue = undefined) {
    return this.contextVariables[key] !== undefined 
      ? this.contextVariables[key] 
      : defaultValue;
  }

  /**
   * Delete a context variable
   * @param {string} key - Variable key
   */
  deleteContextVariable(key) {
    delete this.contextVariables[key];
    this.metadata.lastUpdated = Date.now();
  }

  /**
   * Get all context variables
   * @returns {Object} All context variables
   */
  getAllContextVariables() {
    return { ...this.contextVariables };
  }

  /**
   * Get only persistent context variables
   * @returns {Object} Persistent variables
   */
  getPersistentVariables() {
    const persistent = {};
    
    for (const [key, value] of Object.entries(this.contextVariables)) {
      const varDef = this.config.contextVariables[key];
      if (varDef && varDef.persistent) {
        persistent[key] = value;
      }
    }
    
    return persistent;
  }

  /**
   * Extract variables from text using patterns
   * @param {string} text - Text to extract from
   * @returns {Object} Extracted variables
   */
  extractVariablesFromText(text) {
    const extracted = {};
    
    for (const [key, varDef] of Object.entries(this.config.contextVariables)) {
      if (varDef.extractionPattern) {
        const regex = new RegExp(varDef.extractionPattern, 'i');
        const match = text.match(regex);
        
        if (match && match[1]) {
          extracted[key] = match[1];
          // Also set the variable
          this.setContextVariable(key, match[1], false);
        }
      }
    }
    
    return extracted;
  }

  /**
   * Serialize state to JSON
   * @returns {Object} Serialized state
   */
  toJSON() {
    return {
      conversationHistory: this.conversationHistory,
      contextVariables: this.contextVariables,
      metadata: this.metadata,
      config: this.config
    };
  }

  /**
   * Create AgentState from JSON
   * @param {Object} json - Serialized state
   * @returns {AgentState} New AgentState instance
   */
  static fromJSON(json) {
    const state = new AgentState(json.config || {});
    state.conversationHistory = json.conversationHistory || [];
    state.contextVariables = json.contextVariables || {};
    state.metadata = json.metadata || {
      createdAt: Date.now(),
      lastUpdated: Date.now(),
      messageCount: 0
    };
    
    return state;
  }

  /**
   * Clone the current state
   * @returns {AgentState} Cloned state
   */
  clone() {
    // Create a deep copy using JSON serialization
    const jsonStr = JSON.stringify(this.toJSON());
    const jsonObj = JSON.parse(jsonStr);
    return AgentState.fromJSON(jsonObj);
  }

  /**
   * Prepare state for storage
   * @param {string} storageType - Type of storage (memory, file, mongodb)
   * @returns {Promise<*>} Prepared state
   */
  async prepareForStorage(storageType) {
    const stateData = this.toJSON();
    
    switch (storageType) {
      case 'memory':
        return stateData;
        
      case 'file':
        return JSON.stringify(stateData, null, 2);
        
      case 'mongodb':
        // Remove _id to avoid conflicts
        const { _id, ...mongoData } = stateData;
        return mongoData;
        
      default:
        throw new StateError(
          `Unknown storage type: ${storageType}`,
          'prepareForStorage',
          { storageType }
        );
    }
  }

  /**
   * Restore state from storage
   * @param {*} data - Stored data
   * @param {string} storageType - Type of storage
   * @returns {Promise<AgentState>} Restored state
   */
  static async restoreFromStorage(data, storageType) {
    let stateData;
    
    switch (storageType) {
      case 'memory':
        stateData = data;
        break;
        
      case 'file':
        stateData = typeof data === 'string' ? JSON.parse(data) : data;
        break;
        
      case 'mongodb':
        // Remove MongoDB-specific fields
        const { _id, __v, ...cleanData } = data;
        stateData = cleanData;
        break;
        
      default:
        throw new StateError(
          `Unknown storage type: ${storageType}`,
          'restoreFromStorage',
          { storageType }
        );
    }
    
    return AgentState.fromJSON(stateData);
  }

  /**
   * Get state statistics
   * @returns {Object} Statistics about the state
   */
  getStatistics() {
    const messages = this.conversationHistory;
    const userMessages = messages.filter(m => m.role === 'user').length;
    const assistantMessages = messages.filter(m => m.role === 'assistant').length;
    const systemMessages = messages.filter(m => m.role === 'system').length;
    
    const totalLength = messages.reduce((sum, m) => sum + (m.content?.length || 0), 0);
    const averageMessageLength = messages.length > 0 
      ? Math.round(totalLength / messages.length)
      : 0;
    
    return {
      totalMessages: messages.length,
      userMessages,
      assistantMessages,
      systemMessages,
      averageMessageLength,
      contextVariableCount: Object.keys(this.contextVariables).length,
      persistentVariableCount: Object.keys(this.getPersistentVariables()).length
    };
  }

  /**
   * Get current state
   * @returns {Object} Current state data
   */
  getState() {
    return {
      conversationHistory: this.conversationHistory,
      context: this.contextVariables,
      config: this.config,
      timestamp: this.timestamp,
      version: this.version
    };
  }

  /**
   * Initialize the state (stub for compatibility)
   */
  async initialize() {
    // State is ready to use after construction
    // This method exists for API consistency
    return true;
  }

  /**
   * Cleanup resources
   */
  async cleanup() {
    // Clear sensitive data
    this.conversationHistory = [];
    this.contextVariables = {};
    // Keep persistent config but clear runtime state
    return true;
  }
}