/**
 * Aiur Debug UI - Client Application
 * 
 * Connects to the debug UI server which proxies to MCP servers
 */

class DebugUIApp {
  constructor() {
    // Connection state
    this.ws = null;
    this.clientId = null;
    this.mcpUrl = null;
    this.isConnectedToProxy = false;
    this.isConnectedToMcp = false;
    
    // Configuration
    this.config = null;
    
    // MCP state
    this.requestId = 0;
    this.pendingRequests = new Map();
    this.availableTools = [];
    this.toolDefinitions = new Map();
    this.sessions = [];
    this.currentSession = null;
    this.sessionMode = false;
    
    // UI state
    this.eventsPaused = false;
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
   * Initialize the application
   */
  async init() {
    try {
      // Load configuration from server
      await this.loadConfig();
      
      // Setup UI event listeners
      this.setupEventListeners();
      
      // Connect to debug UI server
      this.connectToProxy();
      
    } catch (error) {
      console.error('Failed to initialize:', error);
      this.showToast('Failed to initialize application', 'error');
    }
  }

  /**
   * Load configuration from server
   */
  async loadConfig() {
    try {
      const response = await fetch('/api/config');
      this.config = await response.json();
      console.log('Loaded configuration:', this.config);
    } catch (error) {
      console.error('Failed to load config:', error);
      // Use defaults
      this.config = {
        mcp: {
          defaultUrl: 'ws://localhost:8080/ws',
          reconnectInterval: 5000,
          maxReconnectAttempts: 10
        },
        ui: {
          autoConnect: true,
          sessionRefreshInterval: 2000,
          maxEventHistory: 1000,
          maxLogHistory: 5000
        }
      };
    }
  }

  /**
   * Connect to debug UI WebSocket proxy
   */
  connectToProxy() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    
    this.updateConnectionStatus('proxy', 'connecting');
    console.log('Connecting to debug UI proxy:', wsUrl);
    
    try {
      this.ws = new WebSocket(wsUrl);
      
      this.ws.onopen = () => {
        this.onProxyConnected();
      };
      
      this.ws.onmessage = (event) => {
        this.onProxyMessage(event);
      };
      
      this.ws.onclose = () => {
        this.onProxyDisconnected();
      };
      
      this.ws.onerror = (error) => {
        this.onProxyError(error);
      };
      
    } catch (error) {
      console.error('Failed to connect to proxy:', error);
      this.showToast('Failed to connect to debug server', 'error');
    }
  }

  /**
   * Handle proxy connection established
   */
  onProxyConnected() {
    this.isConnectedToProxy = true;
    this.updateConnectionStatus('proxy', 'connected');
    console.log('Connected to debug UI proxy');
  }

  /**
   * Handle proxy message
   */
  onProxyMessage(event) {
    try {
      const message = JSON.parse(event.data);
      
      switch (message.type) {
        case 'welcome':
          this.handleProxyWelcome(message.data);
          break;
          
        case 'connected':
          this.handleMcpConnected(message.data);
          break;
          
        case 'disconnected':
          this.handleMcpDisconnected(message.data);
          break;
          
        case 'reconnecting':
          this.handleMcpReconnecting(message.data);
          break;
          
        case 'mcp-response':
          this.handleMcpResponse(message.data);
          break;
          
        case 'error':
          this.handleError(message.data);
          break;
          
        case 'pong':
          // Heartbeat response
          break;
          
        default:
          console.warn('Unknown message type:', message.type);
      }
      
    } catch (error) {
      console.error('Failed to parse proxy message:', error);
    }
  }

  /**
   * Handle proxy welcome message
   */
  handleProxyWelcome(data) {
    this.clientId = data.clientId;
    this.mcpUrl = data.defaultMcpUrl;
    
    console.log('Debug UI proxy welcome:', data);
    
    // Update UI with MCP URL
    const mcpUrlInput = document.getElementById('mcpUrl');
    if (mcpUrlInput) {
      mcpUrlInput.value = this.mcpUrl;
    }
    
    // Auto-connect to MCP if configured
    if (this.config.ui.autoConnect) {
      this.connectToMcp();
    }
  }

  /**
   * Connect to MCP server through proxy
   */
  connectToMcp(url) {
    const mcpUrl = url || this.mcpUrl || this.config.mcp.defaultUrl;
    
    console.log('Connecting to MCP server:', mcpUrl);
    this.updateConnectionStatus('mcp', 'connecting');
    
    this.sendToProxy({
      type: 'connect',
      data: {
        url: mcpUrl,
        sessionId: this.currentSession
      }
    });
  }

  /**
   * Handle MCP connection established
   */
  handleMcpConnected(data) {
    this.isConnectedToMcp = true;
    this.mcpUrl = data.url;
    this.updateConnectionStatus('mcp', 'connected');
    
    console.log('Connected to MCP server:', data.url);
    this.showToast('Connected to MCP server', 'success');
    
    // Request initial data from MCP
    this.sendMcpRequest('tools/list', {});
    this.sendMcpRequest('sessions/list', {});
  }

  /**
   * Handle MCP disconnection
   */
  handleMcpDisconnected(data) {
    this.isConnectedToMcp = false;
    this.updateConnectionStatus('mcp', 'disconnected');
    
    console.log('Disconnected from MCP server');
    this.showToast('Disconnected from MCP server', 'warning');
  }

  /**
   * Handle MCP reconnecting
   */
  handleMcpReconnecting(data) {
    this.updateConnectionStatus('mcp', 'reconnecting');
    
    const message = `Reconnecting to MCP server (attempt ${data.attempt}/${data.maxAttempts})...`;
    console.log(message);
    this.showToast(message, 'info');
  }

  /**
   * Handle MCP response
   */
  handleMcpResponse(data) {
    // Check if this is a response to a request
    if (data.id && this.pendingRequests.has(data.id)) {
      const request = this.pendingRequests.get(data.id);
      this.pendingRequests.delete(data.id);
      
      // Handle specific response types
      if (request.method === 'tools/list') {
        this.handleToolsList(data.result);
      } else if (request.method === 'sessions/list') {
        this.handleSessionsList(data.result);
      } else if (request.method === 'tools/call') {
        this.handleToolResult(data, request);
      }
      
    } else {
      // Handle notifications or other messages
      this.handleMcpNotification(data);
    }
  }

  /**
   * Handle tools list response
   */
  handleToolsList(result) {
    if (!result || !result.tools) return;
    
    console.log('Received tools list:', result.tools.length, 'tools');
    
    this.availableTools = [];
    this.toolDefinitions.clear();
    
    result.tools.forEach(tool => {
      this.availableTools.push(tool.name);
      this.toolDefinitions.set(tool.name, tool);
    });
    
    this.updateAvailableTools(this.availableTools);
    this.populateToolDropdown();
  }

  /**
   * Handle sessions list response
   */
  handleSessionsList(result) {
    if (!result || !result.sessions) return;
    
    this.sessions = result.sessions;
    this.sessionMode = this.sessions.length > 0;
    
    if (this.sessionMode) {
      document.getElementById('sessionSelector').style.display = 'flex';
      this.updateSessionsList();
    }
  }

  /**
   * Send request to MCP server
   */
  sendMcpRequest(method, params) {
    if (!this.isConnectedToMcp) {
      this.showToast('Not connected to MCP server', 'error');
      return;
    }
    
    const requestId = `req_${++this.requestId}`;
    
    // Track pending request
    this.pendingRequests.set(requestId, {
      method,
      params,
      timestamp: Date.now()
    });
    
    // Send through proxy
    this.sendToProxy({
      type: 'mcp-request',
      data: {
        jsonrpc: '2.0',
        method,
        params,
        id: requestId
      }
    });
  }

  /**
   * Send message to proxy
   */
  sendToProxy(message) {
    if (!this.isConnectedToProxy || !this.ws) {
      console.error('Not connected to proxy');
      return false;
    }
    
    try {
      this.ws.send(JSON.stringify(message));
      return true;
    } catch (error) {
      console.error('Failed to send to proxy:', error);
      return false;
    }
  }

  /**
   * Execute tool command
   */
  executeCommand() {
    const toolName = document.getElementById('toolName').value;
    const toolArgsText = document.getElementById('toolArgs').value.trim();
    
    if (!toolName) {
      this.showToast('Please select a tool', 'warning');
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
    
    // Send tool execution request
    this.sendMcpRequest('tools/call', {
      name: toolName,
      arguments: args
    });
    
    this.showToolExecutionStatus(`Executing ${toolName}...`);
    document.getElementById('executeBtn').disabled = true;
  }

  /**
   * Handle tool execution result
   */
  handleToolResult(response, request) {
    const executionTime = Date.now() - request.timestamp;
    const resultDisplay = document.getElementById('commandResult');
    
    // Re-enable execute button
    document.getElementById('executeBtn').disabled = false;
    
    if (response.error) {
      // Error response
      resultDisplay.textContent = JSON.stringify(response.error, null, 2);
      resultDisplay.className = 'result-display error';
      
      this.showToolExecutionStatus(`Error: ${response.error.message}`);
      this.showToast(`Tool error: ${response.error.message}`, 'error');
      
    } else {
      // Success response
      resultDisplay.textContent = JSON.stringify(response.result, null, 2);
      resultDisplay.className = 'result-display success';
      
      this.showToolExecutionStatus(`Success (${executionTime}ms)`);
      this.showToast(`Tool executed successfully in ${executionTime}ms`, 'success');
    }
  }

  /**
   * Handle error messages
   */
  handleError(data) {
    console.error('Proxy error:', data);
    this.showToast(data.message || 'An error occurred', 'error');
  }

  /**
   * Handle MCP notifications
   */
  handleMcpNotification(data) {
    // Handle various MCP notification types
    console.log('MCP notification:', data);
    this.addEventToStream('mcp-notification', data);
  }

  /**
   * Handle proxy disconnection
   */
  onProxyDisconnected() {
    this.isConnectedToProxy = false;
    this.isConnectedToMcp = false;
    this.updateConnectionStatus('proxy', 'disconnected');
    this.updateConnectionStatus('mcp', 'disconnected');
    
    console.log('Disconnected from debug UI proxy');
    this.showToast('Disconnected from debug server', 'warning');
    
    // Attempt to reconnect after a delay
    setTimeout(() => {
      if (!this.isConnectedToProxy) {
        this.connectToProxy();
      }
    }, 3000);
  }

  /**
   * Handle proxy error
   */
  onProxyError(error) {
    console.error('Proxy WebSocket error:', error);
    this.showToast('Debug server connection error', 'error');
  }

  /**
   * Update connection status display
   */
  updateConnectionStatus(type, status) {
    const statusElement = document.getElementById(`${type}Status`);
    if (!statusElement) return;
    
    statusElement.className = `status ${status}`;
    
    const statusText = {
      connecting: 'Connecting...',
      connected: 'Connected',
      disconnected: 'Disconnected',
      reconnecting: 'Reconnecting...'
    };
    
    statusElement.textContent = `${type.toUpperCase()}: ${statusText[status] || status}`;
    
    // Update button states
    this.updateButtonStates();
  }

  /**
   * Update button states based on connection status
   */
  updateButtonStates() {
    const connectBtn = document.getElementById('connectBtn');
    const disconnectBtn = document.getElementById('disconnectBtn');
    const executeBtn = document.getElementById('executeBtn');
    
    if (connectBtn) {
      connectBtn.disabled = !this.isConnectedToProxy || this.isConnectedToMcp;
    }
    if (disconnectBtn) {
      disconnectBtn.disabled = !this.isConnectedToMcp;
    }
    if (executeBtn) {
      executeBtn.disabled = !this.isConnectedToMcp;
    }
  }

  /**
   * Populate tool dropdown
   */
  populateToolDropdown() {
    const toolSelect = document.getElementById('toolName');
    if (!toolSelect) return;
    
    // Clear existing options
    toolSelect.innerHTML = '<option value="">Select a tool...</option>';
    
    // Add available tools
    this.availableTools.forEach(toolName => {
      const option = document.createElement('option');
      option.value = toolName;
      option.textContent = toolName;
      toolSelect.appendChild(option);
    });
    
    // Update tool count display
    this.updateToolCount(this.availableTools.length);
  }

  /**
   * Update available tools display
   */
  updateAvailableTools(tools) {
    const toolsContainer = document.getElementById('availableTools');
    if (!toolsContainer) return;
    
    toolsContainer.innerHTML = '';
    
    tools.forEach(toolName => {
      const tag = document.createElement('span');
      tag.className = 'tool-tag';
      tag.textContent = toolName;
      tag.addEventListener('click', () => {
        document.getElementById('toolName').value = toolName;
        this.updateToolArguments(toolName);
      });
      toolsContainer.appendChild(tag);
    });
  }

  /**
   * Update tool count display
   */
  updateToolCount(count) {
    const countElement = document.getElementById('toolCount');
    if (countElement) {
      countElement.textContent = count.toString();
    }
  }

  /**
   * Update tool arguments help text
   */
  updateToolArguments(toolName) {
    const helpElement = document.getElementById('toolArgsHelp');
    if (!helpElement) return;
    
    const toolDef = this.toolDefinitions.get(toolName);
    if (!toolDef || !toolDef.inputSchema) {
      helpElement.textContent = '';
      return;
    }
    
    // Generate help text from schema
    const schema = toolDef.inputSchema;
    let helpText = `Parameters for ${toolName}:\n`;
    
    if (schema.properties) {
      Object.entries(schema.properties).forEach(([prop, def]) => {
        const required = schema.required?.includes(prop) ? ' (required)' : '';
        helpText += `  ${prop}: ${def.type || 'any'}${required}\n`;
        if (def.description) {
          helpText += `    ${def.description}\n`;
        }
      });
    }
    
    helpElement.textContent = helpText;
  }

  /**
   * Show tool execution status
   */
  showToolExecutionStatus(message) {
    // Could be displayed in a status area or as a toast
    console.log('Tool execution:', message);
  }

  /**
   * Update sessions list
   */
  updateSessionsList() {
    const sessionSelect = document.getElementById('sessionSelect');
    if (!sessionSelect) return;
    
    sessionSelect.innerHTML = '<option value="">Select a session...</option>';
    
    this.sessions.forEach(session => {
      const option = document.createElement('option');
      option.value = session.id;
      option.textContent = session.name || session.id;
      sessionSelect.appendChild(option);
    });
  }

  /**
   * Add event to stream
   */
  addEventToStream(type, data) {
    if (this.eventsPaused) return;
    
    const eventStream = document.getElementById('eventStream');
    if (!eventStream) return;
    
    const eventElement = document.createElement('div');
    eventElement.className = `event event-${type}`;
    eventElement.innerHTML = `
      <div class="event-timestamp">${new Date().toLocaleTimeString()}</div>
      <div class="event-type">${type}</div>
      <div class="event-data">${JSON.stringify(data, null, 2)}</div>
    `;
    
    eventStream.prepend(eventElement);
    
    // Limit event history
    const maxEvents = this.config?.ui?.maxEventHistory || 1000;
    while (eventStream.children.length > maxEvents) {
      eventStream.removeChild(eventStream.lastChild);
    }
  }

  /**
   * Show toast notification
   */
  showToast(message, type = 'info', duration = 5000) {
    const container = document.getElementById('toastContainer');
    if (!container) {
      console.log(`Toast (${type}):`, message);
      return;
    }
    
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    
    container.appendChild(toast);
    
    // Auto-remove after duration
    setTimeout(() => {
      if (toast.parentNode) {
        toast.remove();
      }
    }, duration);
  }

  /**
   * Setup UI event listeners
   */
  setupEventListeners() {
    // MCP connection
    document.getElementById('connectBtn')?.addEventListener('click', () => {
      const url = document.getElementById('mcpUrl')?.value;
      this.connectToMcp(url);
    });
    
    document.getElementById('disconnectBtn')?.addEventListener('click', () => {
      this.disconnectFromMcp();
    });
    
    // Tool execution
    document.getElementById('executeBtn')?.addEventListener('click', () => {
      this.executeCommand();
    });
    
    document.getElementById('clearCommand')?.addEventListener('click', () => {
      document.getElementById('toolName').value = '';
      document.getElementById('toolArgs').value = '';
      document.getElementById('commandResult').textContent = '';
      document.getElementById('toolArgsHelp').textContent = '';
    });
    
    document.getElementById('formatArgs')?.addEventListener('click', () => {
      const argsTextarea = document.getElementById('toolArgs');
      try {
        const parsed = JSON.parse(argsTextarea.value);
        argsTextarea.value = JSON.stringify(parsed, null, 2);
      } catch (error) {
        this.showToast('Invalid JSON format', 'error');
      }
    });
    
    // Tool selection
    document.getElementById('toolName')?.addEventListener('change', (e) => {
      this.updateToolArguments(e.target.value);
    });
    
    // Session management
    document.getElementById('sessionSelect')?.addEventListener('change', (e) => {
      this.currentSession = e.target.value;
      if (this.isConnectedToMcp) {
        this.disconnectFromMcp();
        setTimeout(() => this.connectToMcp(), 500);
      }
    });
    
    document.getElementById('refreshSessions')?.addEventListener('click', () => {
      if (this.isConnectedToMcp) {
        this.sendMcpRequest('sessions/list', {});
      }
    });
    
    // Context browser
    document.getElementById('refreshContext')?.addEventListener('click', () => {
      this.refreshContextList();
    });
    
    document.getElementById('contextFilter')?.addEventListener('input', (e) => {
      this.filterContextList(e.target.value);
    });
    
    // Event stream controls
    document.getElementById('clearEvents')?.addEventListener('click', () => {
      const eventStream = document.getElementById('eventStream');
      if (eventStream) eventStream.innerHTML = '';
    });
    
    document.getElementById('pauseEvents')?.addEventListener('click', (e) => {
      this.eventsPaused = !this.eventsPaused;
      e.target.textContent = this.eventsPaused ? 'Resume' : 'Pause';
    });
    
    // System status
    document.getElementById('refreshStatus')?.addEventListener('click', () => {
      this.refreshSystemStatus();
    });
    
    // Log viewer
    document.getElementById('clearLogs')?.addEventListener('click', () => {
      const logViewer = document.getElementById('logViewer');
      if (logViewer) logViewer.innerHTML = '';
      this.logs = [];
    });
  }

  /**
   * Disconnect from MCP server
   */
  disconnectFromMcp() {
    this.sendToProxy({ type: 'disconnect' });
  }

  /**
   * Refresh context list
   */
  refreshContextList() {
    if (this.isConnectedToMcp) {
      this.sendMcpRequest('context/list', {});
    }
  }

  /**
   * Filter context list
   */
  filterContextList(filter) {
    // Implementation for filtering context display
    console.log('Filter context:', filter);
  }

  /**
   * Refresh system status
   */
  refreshSystemStatus() {
    if (this.isConnectedToMcp) {
      this.sendMcpRequest('status', {});
    }
  }
}

// Initialize application
new DebugUIApp();