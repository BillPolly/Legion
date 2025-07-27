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
    this.toolDefinitions = new Map(); // Store full tool definitions
    this.logs = [];
    this.logStats = { error: 0, warning: 0, info: 0 };
    
    // Session management
    this.sessionMode = false;
    this.currentSession = null;
    this.sessions = [];
    
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

    // Tool selection change
    const toolNameSelect = document.getElementById('toolName');
    toolNameSelect.addEventListener('change', (e) => {
      this.onToolSelected(e.target.value);
    });

    // Session management
    const sessionSelect = document.getElementById('sessionSelect');
    if (sessionSelect) {
      sessionSelect.addEventListener('change', (e) => {
        if (e.target.value) {
          this.selectSession(e.target.value);
        }
      });
    }

    const refreshSessionsBtn = document.getElementById('refreshSessions');
    if (refreshSessionsBtn) {
      refreshSessionsBtn.addEventListener('click', () => {
        this.refreshSessions();
      });
    }

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
  async connect() {
    // First get the MCP server URL from config
    try {
      const response = await fetch('/api/config');
      const config = await response.json();
      const mcpUrl = config.mcp?.defaultUrl || 'ws://localhost:8080/ws';
      
      console.log('Connecting to MCP server at:', mcpUrl);
      
      this.updateConnectionStatus('connecting');
      this.showToast(`Connecting to MCP server at ${mcpUrl}...`, 'info');

      this.ws = new WebSocket(mcpUrl);
      
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
        
        case 'sessions-list':
          this.handleSessionsList(message.data);
          break;
        
        case 'session-selected':
          this.handleSessionSelected(message.data);
          break;
        
        case 'context-data':
          this.handleContextData(message.data);
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
    
    // Clean up intervals
    if (this.sessionRefreshInterval) {
      clearInterval(this.sessionRefreshInterval);
      this.sessionRefreshInterval = null;
    }
    
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
    const toolName = document.getElementById('toolName').value;
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
    // Check if we're in session mode
    this.sessionMode = data.sessionMode || false;
    
    // Load tools from welcome message (tools are shared across sessions)
    this.availableTools = [];
    this.toolDefinitions.clear();
    
    if (data.availableTools && Array.isArray(data.availableTools)) {
      data.availableTools.forEach(tool => {
        this.availableTools.push(tool.name);
        this.toolDefinitions.set(tool.name, tool);
      });
    }
    
    // Update available tools display and populate dropdown
    this.updateAvailableTools(this.availableTools);
    this.populateToolDropdown();
    
    if (this.sessionMode) {
      // Show session selector
      const sessionSelector = document.getElementById('sessionSelector');
      if (sessionSelector) {
        sessionSelector.style.display = 'flex';
      }
      
      // Load initial sessions
      if (data.sessions && data.sessions.length > 0) {
        this.handleSessionsList({ sessions: data.sessions });
      } else {
        // Request session list
        this.refreshSessions();
      }
      
      // Set up periodic refresh for sessions
      this.sessionRefreshInterval = setInterval(() => {
        if (!this.currentSession) {
          this.refreshSessions();
        }
      }, 2000); // Refresh every 2 seconds until a session is selected
    } else {
      // Non-session mode - request initial status information
      this.refreshStatus();
      this.refreshContext();
    }
    
    // Update server info display
    document.getElementById('serverInfo').textContent = 
      `Server: ${data.serverId}\nVersion: ${data.version}\nCapabilities: ${data.capabilities.join(', ')}`;
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
    // Extract error message from various possible formats
    const errorMessage = data.message || 
                        data.error?.message || 
                        data.error?.stack?.split('\n')[0] ||
                        'Unknown error';
    
    this.showToast(`Server error: ${errorMessage}`, 'error');
    console.error('Server error:', data);
  }

  /**
   * Handle sessions list
   */
  handleSessionsList(data) {
    this.sessions = data.sessions || [];
    const sessionSelect = document.getElementById('sessionSelect');
    
    if (!sessionSelect) return;
    
    // Clear existing options
    sessionSelect.innerHTML = '<option value="">Select a session...</option>';
    
    // Add session options
    this.sessions.forEach(session => {
      const option = document.createElement('option');
      option.value = session.id;
      const created = new Date(session.created).toLocaleString();
      option.textContent = `${session.id} (Created: ${created}, Requests: ${session.metadata?.requestCount || 0})`;
      
      if (session.id === this.currentSession) {
        option.selected = true;
      }
      
      sessionSelect.appendChild(option);
    });
    
    // Update context count display
    document.getElementById('contextCount').textContent = this.sessions.length > 0 ? 
      this.sessions.map(s => s.handleCount || 0).reduce((a, b) => a + b, 0).toString() : '0';
  }

  /**
   * Handle session selected
   */
  handleSessionSelected(data) {
    console.log('🐛 handleSessionSelected called with data:', data);
    this.currentSession = data.sessionId;
    this.showToast(`Session selected: ${data.sessionId}`, 'success');
    
    
    // Stop periodic refresh once a session is selected
    if (this.sessionRefreshInterval) {
      clearInterval(this.sessionRefreshInterval);
      this.sessionRefreshInterval = null;
    }
    
    // Tools are shared across sessions - no need to update them
    console.log('🐛 Session selected, keeping shared tools:', this.availableTools.length, 'tools available');
    
    // Update context count
    document.getElementById('contextCount').textContent = data.contextCount || '0';
    
    // Refresh status for this session
    this.refreshStatus();
  }

  /**
   * Handle context data
   */
  handleContextData(data) {
    // Update context list display
    const contextList = document.getElementById('contextList');
    if (!contextList) return;
    
    contextList.innerHTML = '';
    
    if (data.contexts && data.contexts.length > 0) {
      data.contexts.forEach(context => {
        const contextItem = document.createElement('div');
        contextItem.className = 'context-item';
        contextItem.innerHTML = `
          <div class="context-name">${context.name}</div>
          <div class="context-data">${JSON.stringify(context.data, null, 2)}</div>
          ${context.description ? `<div class="context-description">${context.description}</div>` : ''}
        `;
        contextList.appendChild(contextItem);
      });
      
      // Update count
      document.getElementById('contextCount').textContent = data.contexts.length.toString();
    } else {
      contextList.innerHTML = '<div class="empty-state">No context data available</div>';
      document.getElementById('contextCount').textContent = '0';
    }
  }

  /**
   * Select a session
   */
  selectSession(sessionId) {
    const message = {
      type: 'select-session',
      id: `req_${++this.requestId}`,
      data: { sessionId }
    };
    
    this.sendMessage(message);
  }

  /**
   * Refresh sessions list
   */
  refreshSessions() {
    const message = {
      type: 'list-sessions',
      id: `req_${++this.requestId}`
    };
    
    this.sendMessage(message);
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
   * Populate the tool dropdown with available tools
   */
  populateToolDropdown() {
    console.log('🐛 populateToolDropdown called');
    console.log('🐛 Available tools for dropdown:', this.availableTools);
    
    const toolSelect = document.getElementById('toolName');
    if (!toolSelect) {
      console.error('🐛 ERROR: Could not find toolName select element!');
      return;
    }
    
    console.log('🐛 Current dropdown children count:', toolSelect.children.length);
    
    // Clear existing options except the first one
    while (toolSelect.children.length > 1) {
      toolSelect.removeChild(toolSelect.lastChild);
    }
    
    // Add tools grouped by category
    const contextTools = this.availableTools.filter(name => name.startsWith('context_'));
    const planTools = this.availableTools.filter(name => name.startsWith('plan_'));
    const debugTools = this.availableTools.filter(name => name.startsWith('web_debug_'));
    const logTools = this.availableTools.filter(name => name.startsWith('read_logs') || name.startsWith('get_log_') || name.startsWith('clear_old_'));
    const otherTools = this.availableTools.filter(name => 
      !name.startsWith('context_') && 
      !name.startsWith('plan_') && 
      !name.startsWith('web_debug_') &&
      !name.startsWith('read_logs') && 
      !name.startsWith('get_log_') && 
      !name.startsWith('clear_old_')
    );
    
    const addToolGroup = (groupName, tools) => {
      if (tools.length > 0) {
        const optgroup = document.createElement('optgroup');
        optgroup.label = groupName;
        
        tools.forEach(toolName => {
          const option = document.createElement('option');
          option.value = toolName;
          option.textContent = toolName;
          optgroup.appendChild(option);
        });
        
        toolSelect.appendChild(optgroup);
      }
    };
    
    addToolGroup('Context Management', contextTools);
    addToolGroup('Plan Execution', planTools);
    addToolGroup('Debug Tools', debugTools);
    addToolGroup('Log Management', logTools);
    addToolGroup('Other Tools', otherTools);
  }

  /**
   * Handle tool selection change
   */
  onToolSelected(toolName) {
    const argsTextarea = document.getElementById('toolArgs');
    const argsHelp = document.getElementById('toolArgsHelp');
    
    if (!toolName) {
      argsTextarea.placeholder = '{"key": "value"}';
      argsHelp.classList.remove('visible');
      return;
    }
    
    const toolDef = this.toolDefinitions.get(toolName);
    if (!toolDef || !toolDef.inputSchema) {
      argsTextarea.placeholder = '{}';
      argsHelp.classList.remove('visible');
      return;
    }
    
    // Generate args help and placeholder
    const { placeholder, helpHtml } = this.generateArgsHelp(toolDef);
    argsTextarea.placeholder = placeholder;
    
    if (helpHtml) {
      argsHelp.innerHTML = helpHtml;
      argsHelp.classList.add('visible');
    } else {
      argsHelp.classList.remove('visible');
    }
  }

  /**
   * Generate arguments help and placeholder from tool schema
   */
  generateArgsHelp(toolDef) {
    const schema = toolDef.inputSchema;
    if (!schema || !schema.properties) {
      return { placeholder: '{}', helpHtml: null };
    }
    
    const required = schema.required || [];
    const properties = schema.properties;
    
    // Generate placeholder with required args
    const placeholderObj = {};
    required.forEach(propName => {
      const prop = properties[propName];
      if (prop) {
        if (prop.type === 'string') {
          placeholderObj[propName] = prop.default || prop.example || 'string';
        } else if (prop.type === 'number') {
          placeholderObj[propName] = prop.default || prop.example || 0;
        } else if (prop.type === 'boolean') {
          placeholderObj[propName] = prop.default !== undefined ? prop.default : true;
        } else if (prop.type === 'array') {
          placeholderObj[propName] = [];
        } else {
          placeholderObj[propName] = {};
        }
      }
    });
    
    const placeholder = Object.keys(placeholderObj).length > 0 ? 
      JSON.stringify(placeholderObj, null, 2) : '{}';
    
    // Generate help HTML
    let helpHtml = `<h4>${toolDef.name}</h4>`;
    if (toolDef.description) {
      helpHtml += `<p>${toolDef.description}</p>`;
    }
    
    if (required.length > 0) {
      helpHtml += `<div class="required-args"><strong>Required:</strong>`;
      required.forEach(propName => {
        const prop = properties[propName];
        helpHtml += `<div class="arg-item">`;
        helpHtml += `<span class="arg-name">${propName}</span>`;
        helpHtml += `<span class="arg-type">(${prop.type || 'any'})</span>`;
        if (prop.description) {
          helpHtml += `<span class="arg-description">- ${prop.description}</span>`;
        }
        helpHtml += `</div>`;
      });
      helpHtml += `</div>`;
    }
    
    const optional = Object.keys(properties).filter(name => !required.includes(name));
    if (optional.length > 0) {
      helpHtml += `<div class="optional-args"><strong>Optional:</strong>`;
      optional.forEach(propName => {
        const prop = properties[propName];
        helpHtml += `<div class="arg-item">`;
        helpHtml += `<span class="arg-name">${propName}</span>`;
        helpHtml += `<span class="arg-type">(${prop.type || 'any'})</span>`;
        if (prop.description) {
          helpHtml += `<span class="arg-description">- ${prop.description}</span>`;
        }
        helpHtml += `</div>`;
      });
      helpHtml += `</div>`;
    }
    
    return { placeholder, helpHtml };
  }

  /**
   * Update available tools display
   */
  updateAvailableTools(tools) {
    const toolsContainer = document.getElementById('availableTools');
    if (!toolsContainer) return;
    
    toolsContainer.innerHTML = '';
    
    // Filter out any undefined/null values and ensure we have strings
    const validTools = (tools || []).filter(tool => tool && typeof tool === 'string');
    
    validTools.forEach(tool => {
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
        const toolSelect = document.getElementById('toolName');
        if (toolSelect) {
          toolSelect.value = tool;
          this.onToolSelected(tool);
        }
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
    document.getElementById('toolArgs').placeholder = '{"key": "value"}';
    document.getElementById('toolArgsHelp').classList.remove('visible');
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