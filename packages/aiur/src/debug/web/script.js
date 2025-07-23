/**
 * Aiur MCP Debug Interface - Client-side JavaScript
 * 
 * This script communicates EXCLUSIVELY via WebSocket with the MCP server.
 * No HTTP APIs are used for tool execution - everything happens through
 * the WebSocket connection.
 */

class DebugInterface {
  constructor() {
    this.ws = null;
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;
    this.reconnectInterval = 5000;
    this.requestId = 0;
    this.pendingRequests = new Map();
    this.eventsPaused = false;
    this.availableTools = [];
    this.logs = [];
    this.logStats = { error: 0, warning: 0, info: 0 };
    
    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.init());
    } else {
      this.init();
    }
  }

  /**
   * Initialize the debug interface
   */
  init() {
    this.setupEventListeners();
    this.connect();
  }

  /**
   * Setup DOM event listeners
   */
  setupEventListeners() {
    // Command execution
    document.getElementById('executeBtn').addEventListener('click', () => {
      this.executeCommand();
    });

    document.getElementById('clearCommand').addEventListener('click', () => {
      this.clearCommand();
    });

    document.getElementById('formatArgs').addEventListener('click', () => {
      this.formatJSON();
    });

    // Tool name autocomplete
    const toolNameInput = document.getElementById('toolName');
    toolNameInput.addEventListener('input', (e) => {
      this.showToolSuggestions(e.target.value);
    });

    toolNameInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        this.executeCommand();
      }
    });

    // Context management
    document.getElementById('refreshContext').addEventListener('click', () => {
      this.refreshContext();
    });

    document.getElementById('contextFilter').addEventListener('input', (e) => {
      this.filterContext(e.target.value);
    });

    // Event stream controls
    document.getElementById('clearEvents').addEventListener('click', () => {
      this.clearEvents();
    });

    document.getElementById('pauseEvents').addEventListener('click', () => {
      this.toggleEventsPause();
    });

    document.getElementById('eventFilter').addEventListener('change', (e) => {
      this.filterEvents(e.target.value);
    });

    // System status
    document.getElementById('refreshStatus').addEventListener('click', () => {
      this.refreshStatus();
    });

    // Log controls
    document.getElementById('clearLogs').addEventListener('click', () => {
      this.clearLogs();
    });

    document.getElementById('logLevel').addEventListener('change', (e) => {
      this.filterLogs(e.target.value);
    });
  }

  /**
   * Connect to WebSocket server
   */
  connect() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    
    this.updateConnectionStatus('connecting');
    this.showToast('Connecting to debug server...', 'info');

    try {
      this.ws = new WebSocket(wsUrl);
      
      this.ws.onopen = () => {
        this.onConnected();
      };

      this.ws.onmessage = (event) => {
        this.onMessage(event);
      };

      this.ws.onclose = () => {
        this.onDisconnected();
      };

      this.ws.onerror = (error) => {
        this.onError(error);
      };

    } catch (error) {
      this.onError(error);
    }
  }

  /**
   * Handle WebSocket connection established
   */
  onConnected() {
    this.isConnected = true;
    this.reconnectAttempts = 0;
    this.updateConnectionStatus('connected');
    this.showToast('Connected to debug server', 'success');
    console.log('🐛 Connected to Aiur MCP Debug Server');
  }

  /**
   * Handle WebSocket message received
   */
  onMessage(event) {
    try {
      const message = JSON.parse(event.data);
      
      switch (message.type) {
        case 'welcome':
          this.handleWelcome(message.data);
          break;
        
        case 'tool-result':
          this.handleToolResult(message);
          break;
        
        case 'event':
          this.handleEvent(message.data);
          break;
        
        case 'server-info':
          this.handleServerInfo(message.data);
          break;
        
        case 'tool-stats':
          this.handleToolStats(message.data);
          break;
        
        case 'error':
          this.handleError(message.data);
          break;
        
        case 'initial-logs':
          this.handleInitialLogs(message.data);
          break;
        
        case 'log-entry':
          this.handleLogEntry(message.data);
          break;
        
        default:
          console.warn('Unknown message type:', message.type);
      }
    } catch (error) {
      console.error('Error parsing WebSocket message:', error);
      this.showToast('Error parsing server message', 'error');
    }
  }

  /**
   * Handle WebSocket disconnection
   */
  onDisconnected() {
    this.isConnected = false;
    this.updateConnectionStatus('disconnected');
    
    // Attempt to reconnect
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      this.showToast(`Connection lost. Reconnecting... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`, 'warning');
      
      setTimeout(() => {
        this.connect();
      }, this.reconnectInterval);
    } else {
      this.showToast('Connection lost. Max reconnection attempts reached.', 'error');
    }
  }

  /**
   * Handle WebSocket error
   */
  onError(error) {
    console.error('WebSocket error:', error);
    this.showToast('WebSocket connection error', 'error');
  }

  /**
   * Send message via WebSocket
   */
  sendMessage(message) {
    if (!this.isConnected || !this.ws) {
      this.showToast('Not connected to server', 'error');
      return false;
    }

    try {
      this.ws.send(JSON.stringify(message));
      return true;
    } catch (error) {
      console.error('Error sending message:', error);
      this.showToast('Error sending message to server', 'error');
      return false;
    }
  }

  /**
   * Execute MCP tool via WebSocket
   */
  executeCommand() {
    const toolName = document.getElementById('toolName').value.trim();
    const toolArgsText = document.getElementById('toolArgs').value.trim();
    
    if (!toolName) {
      this.showToast('Please enter a tool name', 'warning');
      return;
    }

    let args = {};
    if (toolArgsText) {
      try {
        args = JSON.parse(toolArgsText);
      } catch (error) {
        this.showToast('Invalid JSON in arguments', 'error');
        return;
      }
    }

    const requestId = `req_${++this.requestId}`;
    
    // Store pending request
    this.pendingRequests.set(requestId, {
      toolName,
      args,
      startTime: Date.now()
    });

    // Send tool execution request via WebSocket
    const success = this.sendMessage({
      type: 'execute-tool',
      id: requestId,
      data: {
        name: toolName,
        arguments: args
      }
    });

    if (success) {
      this.showToolExecutionStatus(`Executing ${toolName}...`);
      document.getElementById('executeBtn').disabled = true;
    }
  }

  /**
   * Handle welcome message from server
   */
  handleWelcome(data) {
    this.availableTools = data.availableTools || [];
    
    // Update server info display
    document.getElementById('serverInfo').textContent = 
      `Server: ${data.serverId}\nVersion: ${data.version}\nCapabilities: ${data.capabilities.join(', ')}`;
    
    // Update available tools display
    this.updateAvailableTools(this.availableTools);
    
    // Request initial status information
    this.refreshStatus();
    this.refreshContext();
  }

  /**
   * Handle tool execution result
   */
  handleToolResult(message) {
    const { id, data } = message;
    const request = this.pendingRequests.get(id);
    
    if (request) {
      this.pendingRequests.delete(id);
      
      const executionTime = data.executionTime || (Date.now() - request.startTime);
      const resultDisplay = document.getElementById('commandResult');
      
      // Display result
      resultDisplay.textContent = JSON.stringify(data.result, null, 2);
      resultDisplay.className = `result-display ${data.success ? 'success' : 'error'}`;
      
      // Show status
      const status = data.success ? 'Success' : 'Error';
      this.showToolExecutionStatus(`${status} (${executionTime}ms)`);
      
      // Show toast
      this.showToast(
        `${request.toolName}: ${status} in ${executionTime}ms`, 
        data.success ? 'success' : 'error'
      );

      // Special handling for context_list results
      if (request.isContextRefresh && data.success) {
        this.updateContextDisplay(data.result);
      }
    }
    
    // Re-enable execute button
    document.getElementById('executeBtn').disabled = false;
  }

  /**
   * Handle real-time event
   */
  handleEvent(eventData) {
    if (this.eventsPaused) {
      return;
    }

    const eventStream = document.getElementById('eventStream');
    const eventElement = document.createElement('div');
    eventElement.className = `event-item ${eventData.eventType.replace(/-/g, '_')}`;
    
    const timestamp = new Date(eventData.timestamp).toLocaleTimeString();
    
    eventElement.innerHTML = `
      <div class="event-timestamp">${timestamp}</div>
      <span class="event-type">${eventData.eventType}</span>
      <div class="event-data">${JSON.stringify(eventData.payload, null, 2)}</div>
    `;
    
    eventStream.appendChild(eventElement);
    eventStream.scrollTop = eventStream.scrollHeight;
    
    // Limit number of events displayed
    const maxEvents = 500;
    while (eventStream.children.length > maxEvents) {
      eventStream.removeChild(eventStream.firstChild);
    }
  }

  /**
   * Handle server info response
   */
  handleServerInfo(data) {
    document.getElementById('serverHealth').textContent = data.status || 'Unknown';
    document.getElementById('connectedClients').textContent = data.connectedClients || '0';
  }

  /**
   * Handle tool statistics response
   */
  handleToolStats(data) {
    document.getElementById('toolCount').textContent = data.total || '0';
    document.getElementById('contextCount').textContent = 'N/A'; // Will be updated by context refresh
  }

  /**
   * Handle error message
   */
  handleError(data) {
    this.showToast(`Server error: ${data.message}`, 'error');
    console.error('Server error:', data);
  }

  /**
   * Handle initial logs data
   */
  handleInitialLogs(data) {
    console.log('🐛 Received initial logs:', data.count, 'entries');
    this.logs = data.logs || [];
    this.updateLogDisplay();
    this.updateLogStats(data.stats);
  }

  /**
   * Handle new log entry
   */
  handleLogEntry(logEntry) {
    console.log('🐛 New log entry:', logEntry.level, logEntry.message);
    this.logs.unshift(logEntry); // Add to beginning (newest first)
    
    // Keep only last 500 logs
    if (this.logs.length > 500) {
      this.logs = this.logs.slice(0, 500);
    }
    
    this.updateLogDisplay();
    this.updateLogStatsFromLogs();
  }

  /**
   * Show tool suggestions for autocomplete
   */
  showToolSuggestions(input) {
    const suggestionsDiv = document.getElementById('toolSuggestions');
    
    if (!input || input.length < 2) {
      suggestionsDiv.innerHTML = '';
      return;
    }

    const matches = this.availableTools.filter(tool => 
      tool.toLowerCase().includes(input.toLowerCase())
    );

    if (matches.length === 0) {
      suggestionsDiv.innerHTML = '';
      return;
    }

    const suggestionsList = document.createElement('div');
    suggestionsList.className = 'suggestion-list';
    
    matches.slice(0, 10).forEach(tool => {
      const item = document.createElement('div');
      item.className = 'suggestion-item';
      item.textContent = tool;
      item.addEventListener('click', () => {
        document.getElementById('toolName').value = tool;
        suggestionsDiv.innerHTML = '';
      });
      suggestionsList.appendChild(item);
    });
    
    suggestionsDiv.innerHTML = '';
    suggestionsDiv.appendChild(suggestionsList);
  }

  /**
   * Update available tools display
   */
  updateAvailableTools(tools) {
    const toolsContainer = document.getElementById('availableTools');
    toolsContainer.innerHTML = '';
    
    tools.forEach(tool => {
      const tag = document.createElement('span');
      tag.className = 'tool-tag';
      tag.textContent = tool;
      
      // Add type classification
      if (tool.startsWith('context_')) {
        tag.classList.add('context');
      } else if (tool.startsWith('plan_') || tool.startsWith('web_debug_')) {
        tag.classList.add('module');
      }
      
      tag.addEventListener('click', () => {
        document.getElementById('toolName').value = tool;
      });
      
      toolsContainer.appendChild(tag);
    });
  }

  /**
   * Refresh context list
   */
  refreshContext() {
    const requestId = `req_${++this.requestId}`;
    
    this.sendMessage({
      type: 'execute-tool',
      id: requestId,
      data: {
        name: 'context_list',
        arguments: {}
      }
    });

    // Handle the response to update context display
    this.pendingRequests.set(requestId, {
      toolName: 'context_list',
      isContextRefresh: true,
      startTime: Date.now()
    });
  }

  /**
   * Refresh system status
   */
  refreshStatus() {
    this.sendMessage({ type: 'get-server-info' });
    this.sendMessage({ type: 'get-tool-stats' });
  }

  /**
   * Clear command form
   */
  clearCommand() {
    document.getElementById('toolName').value = '';
    document.getElementById('toolArgs').value = '';
    document.getElementById('commandResult').textContent = '';
    document.getElementById('commandResult').className = 'result-display';
    this.showToolExecutionStatus('');
  }

  /**
   * Format JSON in arguments textarea
   */
  formatJSON() {
    const textarea = document.getElementById('toolArgs');
    const text = textarea.value.trim();
    
    if (!text) return;
    
    try {
      const parsed = JSON.parse(text);
      textarea.value = JSON.stringify(parsed, null, 2);
    } catch (error) {
      this.showToast('Invalid JSON - cannot format', 'warning');
    }
  }

  /**
   * Clear event stream
   */
  clearEvents() {
    document.getElementById('eventStream').innerHTML = '';
  }

  /**
   * Toggle event stream pause
   */
  toggleEventsPause() {
    this.eventsPaused = !this.eventsPaused;
    const button = document.getElementById('pauseEvents');
    button.textContent = this.eventsPaused ? 'Resume' : 'Pause';
    
    this.showToast(
      `Event stream ${this.eventsPaused ? 'paused' : 'resumed'}`, 
      'info'
    );
  }

  /**
   * Filter events by type
   */
  filterEvents(eventType) {
    const events = document.querySelectorAll('.event-item');
    
    events.forEach(event => {
      if (!eventType || event.classList.contains(eventType.replace(/-/g, '_'))) {
        event.style.display = 'block';
      } else {
        event.style.display = 'none';
      }
    });
  }

  /**
   * Update context display with data from context_list result
   */
  updateContextDisplay(result) {
    try {
      const contextData = JSON.parse(result.content[0].text);
      const contextList = document.getElementById('contextList');
      
      if (!contextList) return;
      
      contextList.innerHTML = '';
      
      if (contextData.contexts && contextData.contexts.length > 0) {
        contextData.contexts.forEach(context => {
          const contextItem = document.createElement('div');
          contextItem.className = 'context-item';
          contextItem.innerHTML = `
            <div class="context-name">${context.name}</div>
            <div class="context-description">${context.description || 'No description'}</div>
            <div class="context-data">${JSON.stringify(context.data, null, 2)}</div>
          `;
          contextList.appendChild(contextItem);
        });
        
        // Update context count
        document.getElementById('contextCount').textContent = contextData.contexts.length.toString();
      } else {
        contextList.innerHTML = '<div class="no-context">No context items found</div>';
        document.getElementById('contextCount').textContent = '0';
      }
    } catch (error) {
      console.error('Error updating context display:', error);
    }
  }

  /**
   * Filter context items
   */
  filterContext(filter) {
    const contextItems = document.querySelectorAll('.context-item');
    
    contextItems.forEach(item => {
      const nameElement = item.querySelector('.context-name');
      if (nameElement) {
        const name = nameElement.textContent;
        if (!filter || name.toLowerCase().includes(filter.toLowerCase())) {
          item.style.display = 'block';
        } else {
          item.style.display = 'none';
        }
      }
    });
  }

  /**
   * Clear logs
   */
  clearLogs() {
    document.getElementById('logViewer').innerHTML = '';
  }

  /**
   * Filter logs by level
   */
  filterLogs(level) {
    const logs = document.querySelectorAll('.log-entry');
    
    logs.forEach(log => {
      if (!level || log.classList.contains(level)) {
        log.style.display = 'block';
      } else {
        log.style.display = 'none';
      }
    });
  }

  /**
   * Update connection status display
   */
  updateConnectionStatus(status) {
    const statusElement = document.getElementById('connectionStatus');
    statusElement.className = `status ${status}`;
    
    const statusText = {
      connecting: 'Connecting...',
      connected: 'Connected',
      disconnected: 'Disconnected'
    };
    
    statusElement.textContent = statusText[status] || status;
  }

  /**
   * Show tool execution status
   */
  showToolExecutionStatus(message) {
    // Could add a status area near the execute button
    console.log('Tool execution status:', message);
  }

  /**
   * Show toast notification
   */
  showToast(message, type = 'info') {
    const toastContainer = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    
    toastContainer.appendChild(toast);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    }, 5000);
    
    // Also log to console
    console.log(`🐛 ${type.toUpperCase()}: ${message}`);
  }

  /**
   * Update log display with current logs
   */
  updateLogDisplay() {
    const logViewer = document.getElementById('logViewer');
    if (!logViewer) return;

    logViewer.innerHTML = '';

    // Apply current filter
    const currentFilter = document.getElementById('logLevel')?.value || '';
    const filteredLogs = currentFilter ? 
      this.logs.filter(log => log.level === currentFilter) : 
      this.logs;

    filteredLogs.forEach(log => {
      const logElement = document.createElement('div');
      logElement.className = `log-entry ${log.level}`;
      
      const timestamp = new Date(log.timestamp).toLocaleTimeString();
      
      // Create structured log entry
      const timestampEl = document.createElement('div');
      timestampEl.className = 'log-timestamp';
      timestampEl.textContent = timestamp;
      
      const levelEl = document.createElement('span');
      levelEl.className = 'log-level';
      levelEl.textContent = log.level.toUpperCase();
      
      const messageEl = document.createElement('div');
      messageEl.className = 'log-message';
      messageEl.textContent = log.message;
      
      logElement.appendChild(timestampEl);
      logElement.appendChild(levelEl);
      logElement.appendChild(messageEl);
      
      // Add context if present
      if (log.context && Object.keys(log.context).length > 0) {
        const contextEl = document.createElement('div');
        contextEl.className = 'log-context';
        contextEl.textContent = JSON.stringify(log.context, null, 2);
        messageEl.appendChild(contextEl);
      }
      
      logViewer.appendChild(logElement);
    });

    // Auto-scroll to bottom
    logViewer.scrollTop = logViewer.scrollHeight;
  }

  /**
   * Update log statistics from server data
   */
  updateLogStats(stats) {
    if (stats) {
      this.logStats = { ...stats };
    }
    this.updateLogStatsDisplay();
  }

  /**
   * Update log statistics from current logs array
   */
  updateLogStatsFromLogs() {
    const stats = { error: 0, warning: 0, info: 0 };
    
    this.logs.forEach(log => {
      if (stats.hasOwnProperty(log.level)) {
        stats[log.level]++;
      }
    });
    
    this.logStats = stats;
    this.updateLogStatsDisplay();
  }

  /**
   * Update log statistics display in UI
   */
  updateLogStatsDisplay() {
    // Update stats badges if they exist
    const errorCount = document.getElementById('errorCount');
    const warningCount = document.getElementById('warningCount'); 
    const infoCount = document.getElementById('infoCount');
    
    if (errorCount) errorCount.textContent = this.logStats.error || 0;
    if (warningCount) warningCount.textContent = this.logStats.warning || 0;
    if (infoCount) infoCount.textContent = this.logStats.info || 0;
  }
}

// Initialize the debug interface
new DebugInterface();