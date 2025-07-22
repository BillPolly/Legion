import { EventEmitter } from 'events';

/**
 * Event Handler for Cerebrate Chrome Extension
 * Processes real-time events from the WebSocket server
 */
export class EventHandler extends EventEmitter {

  constructor(webSocketClient, commandInterface = null) {
    super();
    
    this.wsClient = webSocketClient;
    this.commandInterface = commandInterface;
    this.initialized = false;
    
    // Event state tracking
    this.commandProgress = new Map(); // commandId -> progress info
    this.suggestions = [];
    this.pageStateHistory = [];
    this.eventStatistics = {
      totalEvents: 0,
      eventCounts: {},
      startTime: Date.now(),
      lastEventTimestamp: null
    };
    
    // Event management configuration
    this.eventFilters = []; // Empty means accept all events
    this.confidenceThreshold = 0.5;
    this.eventBuffer = [];
    this.maxBufferSize = 100;
    this.eventExpiration = 300000; // 5 minutes
    this.maxHistorySize = 1000;
    
    // Command-specific event handlers
    this.commandEventHandlers = new Map(); // commandId -> handler
    this.priorityListeners = new Map(); // event -> priority handlers
    
    // Cleanup interval
    this.cleanupInterval = null;
  }

  /**
   * Initialize event handler
   */
  initialize() {
    if (this.initialized) {
      return;
    }

    this.setupEventListeners();
    this.startCleanupInterval();
    this.initialized = true;
  }

  /**
   * Setup WebSocket event listeners
   * @private
   */
  setupEventListeners() {
    if (this.wsClient) {
      this.wsClient.on('message', this.handleMessage.bind(this));
      this.wsClient.on('connected', this.handleConnect.bind(this));
      this.wsClient.on('disconnected', this.handleDisconnect.bind(this));
    }

    if (this.commandInterface) {
      this.commandInterface.on('commandExecuted', this.handleCommandExecuted.bind(this));
    }
  }

  /**
   * Handle incoming WebSocket messages
   * @param {Object} message - WebSocket message
   * @private
   */
  handleMessage(message) {
    if (message.type !== 'event') {
      return;
    }

    // Apply event filters
    if (this.eventFilters.length > 0 && !this.eventFilters.includes(message.event)) {
      return;
    }

    // Update statistics
    this.updateStatistics(message.event);

    // Add to event buffer
    this.addToEventBuffer(message);

    // Route event based on type
    switch (message.event) {
      case 'progress':
        this.handleProgressEvent(message.data);
        break;
      case 'suggestion':
        this.handleSuggestionEvent(message.data);
        break;
      case 'domChange':
        this.handleDOMChangeEvent(message.data);
        break;
      case 'navigation':
        this.handleNavigationEvent(message.data);
        break;
      case 'performance':
        this.handlePerformanceEvent(message.data);
        break;
      default:
        this.handleGenericEvent(message.event, message.data);
    }

    // Route to command-specific handlers
    if (message.data && message.data.command_id) {
      this.routeToCommandHandler(message.data.command_id, message.event, message.data);
    }

    // Emit global event
    this.emitPriorityEvent(message.event, message.data);
  }

  /**
   * Handle progress events
   * @param {Object} data - Progress event data
   * @private
   */
  handleProgressEvent(data) {
    if (!data.command_id) return;

    const progressInfo = {
      progress: data.progress || 0,
      message: data.message || '',
      stage: data.stage,
      lastUpdate: Date.now()
    };

    this.commandProgress.set(data.command_id, progressInfo);

    this.emit('progress', data);

    // Handle completion
    if (data.completed || data.progress >= 1.0) {
      this.emit('progressComplete', data);
      
      // Cleanup completed progress after a delay
      setTimeout(() => {
        this.commandProgress.delete(data.command_id);
      }, 1000);
    }
  }

  /**
   * Handle suggestion events
   * @param {Object} data - Suggestion event data
   * @private
   */
  handleSuggestionEvent(data) {
    const suggestion = {
      ...data.suggestion,
      command_id: data.command_id,
      timestamp: Date.now(),
      id: `suggestion-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    };

    // Apply confidence filtering
    if (suggestion.confidence && suggestion.confidence < this.confidenceThreshold) {
      return;
    }

    this.suggestions.push(suggestion);

    // Limit suggestions array size
    if (this.suggestions.length > this.maxBufferSize) {
      this.suggestions = this.suggestions.slice(-this.maxBufferSize);
    }

    this.emit('suggestion', data);
  }

  /**
   * Handle DOM change events
   * @param {Object} data - DOM change event data
   * @private
   */
  handleDOMChangeEvent(data) {
    this.addToPageStateHistory('domChange', data);
    this.emit('domChange', data);
  }

  /**
   * Handle navigation events
   * @param {Object} data - Navigation event data
   * @private
   */
  handleNavigationEvent(data) {
    this.addToPageStateHistory('navigation', data);
    this.emit('navigation', data);
  }

  /**
   * Handle performance events
   * @param {Object} data - Performance event data
   * @private
   */
  handlePerformanceEvent(data) {
    this.addToPageStateHistory('performance', data);
    this.emit('performance', data);
  }

  /**
   * Handle generic events
   * @param {string} eventType - Event type
   * @param {Object} data - Event data
   * @private
   */
  handleGenericEvent(eventType, data) {
    this.emit(eventType, data);
  }

  /**
   * Handle WebSocket connection
   * @private
   */
  handleConnect() {
    this.emit('eventHandlerConnected');
  }

  /**
   * Handle WebSocket disconnection
   * @private
   */
  handleDisconnect() {
    // Clear transient state but preserve configuration
    this.commandProgress.clear();
    this.suggestions = [];
    this.pageStateHistory = [];
    this.eventBuffer = [];
    
    // Reset statistics
    this.eventStatistics = {
      totalEvents: 0,
      eventCounts: {},
      startTime: Date.now(),
      lastEventTimestamp: null
    };

    this.emit('eventHandlerDisconnected');
  }

  /**
   * Handle command execution
   * @param {Object} commandInfo - Command information
   * @private
   */
  handleCommandExecuted(commandInfo) {
    // Initialize progress tracking for new commands
    if (commandInfo.id && !this.commandProgress.has(commandInfo.id)) {
      this.commandProgress.set(commandInfo.id, {
        progress: 0,
        message: 'Command started',
        lastUpdate: Date.now()
      });
    }
  }

  /**
   * Route event to command-specific handler
   * @param {string} commandId - Command ID
   * @param {string} eventType - Event type
   * @param {Object} data - Event data
   * @private
   */
  routeToCommandHandler(commandId, eventType, data) {
    const handler = this.commandEventHandlers.get(commandId);
    if (handler) {
      handler(eventType, data);
    }
  }

  /**
   * Emit event with priority handling
   * @param {string} eventType - Event type
   * @param {Object} data - Event data
   * @private
   */
  emitPriorityEvent(eventType, data) {
    const priorityHandlers = this.priorityListeners.get(eventType);
    if (priorityHandlers && priorityHandlers.high && data.priority === 'high') {
      priorityHandlers.high.forEach(handler => handler(data));
    }
    
    this.emit(eventType, data);
  }

  /**
   * Add event to page state history
   * @param {string} eventType - Event type
   * @param {Object} data - Event data
   * @private
   */
  addToPageStateHistory(eventType, data) {
    this.pageStateHistory.push({
      event: eventType,
      data: data,
      timestamp: Date.now()
    });

    // Limit history size
    if (this.pageStateHistory.length > this.maxHistorySize) {
      this.pageStateHistory = this.pageStateHistory.slice(-this.maxHistorySize);
    }
  }

  /**
   * Add event to buffer
   * @param {Object} event - Event object
   * @private
   */
  addToEventBuffer(event) {
    this.eventBuffer.push({
      ...event,
      timestamp: Date.now()
    });

    if (this.eventBuffer.length > this.maxBufferSize) {
      this.eventBuffer = this.eventBuffer.slice(-this.maxBufferSize);
    }
  }

  /**
   * Update event statistics
   * @param {string} eventType - Event type
   * @private
   */
  updateStatistics(eventType) {
    this.eventStatistics.totalEvents++;
    this.eventStatistics.eventCounts[eventType] = 
      (this.eventStatistics.eventCounts[eventType] || 0) + 1;
    this.eventStatistics.lastEventTimestamp = Date.now();
  }

  /**
   * Start cleanup interval
   * @private
   */
  startCleanupInterval() {
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredEvents();
    }, 60000); // Run every minute
  }

  /**
   * Get command progress
   * @param {string} commandId - Command ID
   * @returns {Object|null} - Progress information
   */
  getCommandProgress(commandId) {
    return this.commandProgress.get(commandId) || null;
  }

  /**
   * Get suggestions by category
   * @returns {Object} - Categorized suggestions
   */
  getSuggestionsByCategory() {
    const categorized = {};
    
    this.suggestions.forEach(suggestion => {
      const category = suggestion.type || 'general';
      if (!categorized[category]) {
        categorized[category] = [];
      }
      categorized[category].push(suggestion);
    });

    return categorized;
  }

  /**
   * Get filtered suggestions
   * @returns {Array} - Filtered suggestions
   */
  getFilteredSuggestions() {
    return this.suggestions.filter(suggestion => 
      !suggestion.confidence || suggestion.confidence >= this.confidenceThreshold
    );
  }

  /**
   * Get page state history
   * @returns {Array} - Page state history
   */
  getPageStateHistory() {
    return [...this.pageStateHistory];
  }

  /**
   * Get event statistics
   * @returns {Object} - Event statistics
   */
  getEventStatistics() {
    const now = Date.now();
    const duration = (now - this.eventStatistics.startTime) / 1000; // seconds
    
    return {
      ...this.eventStatistics,
      eventsPerSecond: duration > 0 ? this.eventStatistics.totalEvents / duration : 0
    };
  }

  /**
   * Get event buffer
   * @returns {Array} - Event buffer
   */
  getEventBuffer() {
    return [...this.eventBuffer];
  }

  /**
   * Set event filters
   * @param {Array} filters - Array of event types to accept
   */
  setEventFilters(filters) {
    this.eventFilters = [...filters];
  }

  /**
   * Get event filters
   * @returns {Array} - Current event filters
   */
  getEventFilters() {
    return [...this.eventFilters];
  }

  /**
   * Set confidence threshold
   * @param {number} threshold - Confidence threshold (0-1)
   */
  setConfidenceThreshold(threshold) {
    this.confidenceThreshold = Math.max(0, Math.min(1, threshold));
  }

  /**
   * Enable event buffering
   * @param {number} bufferSize - Maximum buffer size
   */
  enableEventBuffering(bufferSize) {
    this.maxBufferSize = bufferSize;
    if (this.eventBuffer.length > bufferSize) {
      this.eventBuffer = this.eventBuffer.slice(-bufferSize);
    }
  }

  /**
   * Set event expiration time
   * @param {number} expiration - Expiration time in milliseconds
   */
  setEventExpiration(expiration) {
    this.eventExpiration = expiration;
  }

  /**
   * Register command-specific event handler
   * @param {string} commandId - Command ID
   * @param {Function} handler - Event handler function
   */
  onCommandEvent(commandId, handler) {
    this.commandEventHandlers.set(commandId, handler);
  }

  /**
   * Remove command event handler
   * @param {string} commandId - Command ID
   */
  offCommandEvent(commandId) {
    this.commandEventHandlers.delete(commandId);
  }

  /**
   * Add listener with priority
   * @param {string} eventType - Event type
   * @param {Function} listener - Event listener
   * @param {Object} options - Options including priority
   */
  on(eventType, listener, options = {}) {
    if (options.priority === 'high') {
      if (!this.priorityListeners.has(eventType)) {
        this.priorityListeners.set(eventType, { high: [], normal: [] });
      }
      this.priorityListeners.get(eventType).high.push(listener);
    }
    
    super.on(eventType, listener);
  }

  /**
   * Cleanup expired events
   */
  cleanupExpiredEvents() {
    const now = Date.now();
    const expiredTime = now - this.eventExpiration;

    // Clean up expired progress entries
    this.commandProgress.forEach((progress, commandId) => {
      if (progress.lastUpdate < expiredTime) {
        this.commandProgress.delete(commandId);
      }
    });

    // Clean up expired suggestions
    this.suggestions = this.suggestions.filter(
      suggestion => suggestion.timestamp > expiredTime
    );

    // Clean up expired history entries
    this.pageStateHistory = this.pageStateHistory.filter(
      entry => entry.timestamp > expiredTime
    );

    // Clean up expired buffer entries
    this.eventBuffer = this.eventBuffer.filter(
      event => event.timestamp > expiredTime
    );
  }

  /**
   * Destroy event handler and cleanup resources
   */
  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    // Remove WebSocket listeners
    if (this.wsClient) {
      this.wsClient.off('message', this.handleMessage.bind(this));
      this.wsClient.off('connected', this.handleConnect.bind(this));
      this.wsClient.off('disconnected', this.handleDisconnect.bind(this));
    }

    // Remove command interface listeners
    if (this.commandInterface) {
      this.commandInterface.off('commandExecuted', this.handleCommandExecuted.bind(this));
    }

    // Clear all data
    this.commandProgress.clear();
    this.suggestions = [];
    this.pageStateHistory = [];
    this.eventBuffer = [];
    this.commandEventHandlers.clear();
    this.priorityListeners.clear();

    // Remove all event listeners
    this.removeAllListeners();

    this.initialized = false;
  }
}