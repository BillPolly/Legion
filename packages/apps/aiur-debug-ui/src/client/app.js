/**
 * Aiur Debug UI - Client Application
 * 
 * Connects to the debug UI server which proxies to MCP servers
 */

import { ToolManager } from './ToolManager.js';
import { ClientCodec } from './codec/ClientCodec.js';

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
    this.sessions = [];
    this.currentSession = null;
    this.sessionMode = false;
    
    // Tool management
    this.toolManager = null; // Will be initialized after connection
    
    // Codec system
    this.clientCodec = new ClientCodec();
    this.codecSupported = false;
    this.codecReady = false;
    this.sessionCodecEnabled = false;
    this.serverSchemas = [];
    this.receivedSchemas = {};
    this.messageTypes = [];
    
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
      
      // Initialize codec status display
      this.updateCodecStatus();
      
      // Connect to debug UI server
      this.connectToProxy();
      
      // CLI Terminal will be initialized after connection
      
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
    // Connect directly to MCP server using configured URL
    const mcpUrl = this.config?.mcp?.defaultUrl || 'ws://localhost:8080/ws';
    
    this.updateConnectionStatus('proxy', 'connecting');
    this.updateConnectionStatus('mcp', 'connecting');
    console.log('Connecting directly to MCP server:', mcpUrl);
    
    try {
      this.ws = new WebSocket(mcpUrl);
      
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
    this.isConnectedToMcp = true;
    this.updateConnectionStatus('proxy', 'connected');
    this.updateConnectionStatus('mcp', 'connected');
    console.log('Connected to Aiur WebSocket server');
    
    // Create a session immediately
    this.sendMessage({
      type: 'session_create',
      requestId: `req_${this.getNextRequestId()}`
    });
  }

  /**
   * Handle proxy message
   */
  onProxyMessage(event) {
    try {
      console.log('Raw message from MCP server:', event.data);
      
      let message;
      let validationResult = null;
      
      // Try to decode with codec if available and ready
      if (this.codecReady && this.clientCodec.isReady()) {
        const decodeResult = this.clientCodec.decode(event.data);
        
        if (decodeResult.success) {
          message = decodeResult.decoded;
          validationResult = {
            success: decodeResult.validated,
            error: decodeResult.validationError,
            validated: decodeResult.validated
          };
          
          if (decodeResult.validated) {
            console.log('[App] Message validated with codec:', message.type);
          } else if (decodeResult.validationError) {
            console.warn('[App] Message validation failed:', decodeResult.validationError);
          }
        } else {
          // Decode failed, fall back to JSON
          try {
            message = JSON.parse(event.data);
            validationResult = { success: false, error: decodeResult.error, validated: false };
            console.warn('[App] Codec decode failed, using JSON fallback:', decodeResult.error);
          } catch (jsonError) {
            console.error('[App] Both codec decode and JSON parsing failed:', jsonError);
            this.handleCodecError(jsonError, 'message parsing');
            return;
          }
        }
      } else {
        // No codec available, use JSON parsing
        message = JSON.parse(event.data);
        validationResult = { success: true, validated: false };
      }
      
      console.log('Parsed message:', message);
      if (validationResult.validated) {
        console.log('✓ Message validated with codec');
      } else if (validationResult.error) {
        console.log('⚠ Message validation failed:', validationResult.error);
      }
      
      // Handle Aiur custom protocol messages
      if (message.type === 'welcome') {
        this.handleAiurWelcome(message);
        return;
      }
      
      if (message.type === 'session_created') {
        this.handleAiurSessionCreated(message);
        return;
      }
      
      if (message.type === 'mcp_response') {
        this.handleAiurMcpResponse(message);
        return;
      }
      
      if (message.type === 'schema_definition') {
        this.handleSchemaDefinition(message);
        return;
      }
      
      // Handle legacy messages if any
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
          this.handleError(message.data || message);
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
   * Handle Aiur welcome message
   */
  handleAiurWelcome(message) {
    console.log('Received Aiur welcome:', message);
    this.clientId = message.clientId;
    
    // Check for codec support
    this.codecSupported = message.codecSupported || false;
    this.serverSchemas = message.supportedSchemas || [];
    
    console.log('Server codec support:', this.codecSupported);
    console.log('Server supported schemas:', this.serverSchemas);
    
    // Request schema definitions if codec is supported
    if (this.codecSupported && this.serverSchemas.length > 0) {
      console.log('Requesting schema definitions from server...');
      this.sendMessage({
        type: 'schema_request',
        requestId: `req_${this.getNextRequestId()}`,
        requestedSchemas: this.serverSchemas
      });
    }
    
    // Create a session
    this.sendMessage({
      type: 'session_create',
      requestId: `req_${this.getNextRequestId()}`
    });
  }
  
  /**
   * Handle schema definition response
   */
  handleSchemaDefinition(message) {
    console.log('Received schema definition:', message);
    
    // Store schemas for codec initialization
    this.receivedSchemas = message.schemas || {};
    this.messageTypes = message.messageTypes || [];
    
    console.log('Received schemas:', Object.keys(this.receivedSchemas).length);
    console.log('Message types:', this.messageTypes);
    
    // Initialize client-side codec with received schemas
    try {
      this.clientCodec.registerSchemas(this.receivedSchemas, this.messageTypes);
      this.codecReady = this.clientCodec.isReady();
      
      console.log('[App] Client codec initialized successfully');
      console.log('[App] Codec ready:', this.codecReady);
      console.log('[App] Supported message types:', this.clientCodec.getMessageTypes());
      
      this.showToast(`Codec initialized with ${Object.keys(this.receivedSchemas).length} schemas`, 'success');
      
    } catch (error) {
      console.error('[App] Failed to initialize client codec:', error);
      this.codecReady = false;
      this.handleCodecError(error, 'schema initialization');
    }
    
    // Update codec status display
    this.updateCodecStatus();
  }
  
  /**
   * Handle Aiur session created
   */
  async handleAiurSessionCreated(message) {
    console.log('Aiur session created:', message);
    this.currentSession = message.sessionId;
    
    // Check if session indicates codec is enabled
    this.sessionCodecEnabled = message.codecEnabled || false;
    console.log('Session codec enabled:', this.sessionCodecEnabled);
    
    // Initialize ToolManager with clean MCP interface
    await this.initializeToolManager();
    
    // Initialize CLI Terminal after tools are ready
    await this.initializeCLITerminal();
    
    // Final codec status update
    this.updateCodecStatus();
  }
  
  /**
   * Initialize ToolManager with clean MCP interface
   */
  async initializeToolManager() {
    console.log('[App] Initializing ToolManager...');
    
    // Create clean MCP interface for ToolManager
    const mcpInterface = {
      requestTools: async () => {
        return new Promise((resolve, reject) => {
          const requestId = `req_${this.getNextRequestId()}`;
          
          // Store resolver for this request
          this.pendingRequests.set(requestId, {
            method: 'tools/list',
            resolve: (result) => {
              if (result && result.tools) {
                resolve(result.tools);
              } else {
                resolve([]);
              }
            },
            reject: reject
          });
          
          // Send request
          const success = this.sendMessage({
            type: 'mcp_request',
            requestId: requestId,
            method: 'tools/list',
            params: {}
          });
          
          if (!success) {
            this.pendingRequests.delete(requestId);
            reject(new Error('Failed to send tools/list request'));
          }
        });
      }
    };
    
    // Create and initialize ToolManager
    this.toolManager = new ToolManager(mcpInterface);
    await this.toolManager.initialize();
    
    console.log(`[App] ToolManager initialized with ${this.toolManager.getTools().size} tools`);
  }

  /**
   * Handle Aiur MCP response
   */
  handleAiurMcpResponse(message) {
    console.log('Aiur MCP response:', message);
    
    if (message.error) {
      this.showToast(`Error: ${message.error}`, 'error');
      // Re-enable button on error
      document.getElementById('executeBtn').disabled = false;
      this.showToolExecutionStatus('Error');
      return;
    }
    
    // Handle pending requests
    if (message.requestId && this.pendingRequests.has(message.requestId)) {
      const request = this.pendingRequests.get(message.requestId);
      this.pendingRequests.delete(message.requestId);
      
      // Handle promise-based requests (ToolManager, CLI, etc.)
      if (request.resolve) {
        if (message.error) {
          request.reject(new Error(message.error));
        } else {
          request.resolve(message.result);
        }
        return;
      }
      
      // Legacy handling for old interface
      if (request.method === 'tools/call') {
        this.displayCommandResult(message.result);
        // Re-enable the execute button
        document.getElementById('executeBtn').disabled = false;
        this.showToolExecutionStatus('Ready');
      }
    }
    
    // Handle tools/list response for legacy components
    if (message.result && message.result.tools) {
      this.updateLegacyToolDisplay(message.result.tools);
    }
  }
  
  /**
   * Handle MCP protocol messages (not used for Aiur)
   */
  handleMcpMessage(message) {
    // Handle responses to our requests
    if (message.id && this.pendingRequests.has(message.id)) {
      const callback = this.pendingRequests.get(message.id);
      this.pendingRequests.delete(message.id);
      
      if (message.error) {
        console.error('MCP request error:', message.error);
        this.showToast(`Error: ${message.error.message}`, 'error');
      } else {
        callback(message.result);
      }
      return;
    }
    
    // Handle notifications
    if (message.method && !message.id) {
      switch (message.method) {
        case 'session.created':
          this.handleSessionCreated(message.params);
          break;
        case 'tools.list':
          this.handleToolsList(message.params);
          break;
        case 'log.message':
          this.handleLogMessage(message.params);
          break;
        default:
          console.log('Unhandled MCP notification:', message);
      }
    }
  }

  /**
   * Handle session created notification
   */
  handleSessionCreated(params) {
    console.log('MCP session created:', params);
    this.currentSession = params.sessionId;
    
    // Request available tools
    this.sendRequest('tools.list', {}, (result) => {
      this.handleToolsList(result);
    });
  }

  /**
   * Update legacy tool display components
   */
  updateLegacyToolDisplay(tools = []) {
    // Update tool selector dropdown
    const toolSelect = document.getElementById('toolName');
    if (toolSelect) {
      toolSelect.innerHTML = '<option value="">Select a tool...</option>';
      tools.forEach(tool => {
        const option = document.createElement('option');
        option.value = tool.name;
        option.textContent = tool.name;
        toolSelect.appendChild(option);
      });
    }
    
    // Update tool count
    const toolCountElement = document.getElementById('toolCount');
    if (toolCountElement) {
      toolCountElement.textContent = tools.length;
    }
    
    // Update available tools display
    const availableToolsElement = document.getElementById('availableTools');
    if (availableToolsElement) {
      availableToolsElement.innerHTML = '';
      tools.forEach(tool => {
        const span = document.createElement('span');
        span.className = 'tool-tag';
        span.textContent = tool.name;
        availableToolsElement.appendChild(span);
      });
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
    
    // Track the request
    this.pendingRequests.set(requestId, {
      method: method,
      params: params,
      timestamp: Date.now()
    });
    
    // Send using Aiur protocol
    this.sendMessage({
      type: 'mcp_request',
      requestId: requestId,
      method: method,
      params: params
    });
  }

  /**
   * Send message to MCP server
   */
  sendMessage(message) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.error('WebSocket not open, readyState:', this.ws?.readyState);
      return false;
    }
    
    try {
      let messageToSend;
      
      // Try to encode with codec if available and ready
      if (this.codecReady && this.clientCodec.isReady() && message.type) {
        const encodeResult = this.clientCodec.encode(message.type, message);
        
        if (encodeResult.success) {
          messageToSend = encodeResult.encoded;
          console.log('[App] Message encoded with codec:', message.type);
          
          if (encodeResult.validated) {
            console.log('✓ Message validated before sending');
          }
        } else {
          // Codec encoding failed, fall back to JSON
          try {
            messageToSend = JSON.stringify(message);
            console.warn('[App] Codec encoding failed, using JSON fallback:', encodeResult.error);
            this.handleCodecError(new Error(encodeResult.error), 'message encoding');
          } catch (jsonError) {
            console.error('[App] Both codec encoding and JSON stringify failed:', jsonError);
            this.handleCodecError(jsonError, 'message serialization');
            return false;
          }
        }
      } else {
        // No codec available or no message type, use JSON
        messageToSend = JSON.stringify(message);
        
        if (this.codecReady && message.type) {
          console.log('[App] Codec ready but message type not supported, using JSON');
        }
      }
      
      console.log('Sending message:', messageToSend);
      this.ws.send(messageToSend);
      return true;
      
    } catch (error) {
      console.error('Failed to send message:', error);
      return false;
    }
  }
  
  /**
   * Send request to MCP server with callback
   */
  sendRequest(method, params, callback) {
    const id = this.getNextRequestId();
    this.pendingRequests.set(id, callback);
    
    this.sendMessage({
      jsonrpc: '2.0',
      method: method,
      params: params,
      id: id
    });
  }
  
  /**
   * Get next request ID
   */
  getNextRequestId() {
    return ++this.requestId;
  }
  
  /**
   * Legacy sendToProxy for compatibility
   */
  sendToProxy(message) {
    // Convert legacy format to MCP format if needed
    return this.sendMessage(message);
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
   * Display command result
   */
  displayCommandResult(result) {
    const resultDisplay = document.getElementById('commandResult');
    if (resultDisplay) {
      // Extract the actual tool result from the content wrapper
      let displayResult = result;
      
      // If result has content array with text, extract it
      if (result && result.content && Array.isArray(result.content)) {
        const textContent = result.content.find(item => item.type === 'text');
        if (textContent && textContent.text) {
          try {
            // Try to parse the text as JSON for better display
            displayResult = JSON.parse(textContent.text);
          } catch (e) {
            // If not JSON, just use the text
            displayResult = textContent.text;
          }
        }
      }
      
      resultDisplay.textContent = JSON.stringify(displayResult, null, 2);
      resultDisplay.className = 'result-display';
    }
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
    console.error('MCP error:', data);
    const errorMessage = typeof data === 'string' ? data : 
                        data?.message || data?.error || 'An error occurred';
    this.showToast(errorMessage, 'error');
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
    const argsTextarea = document.getElementById('toolArgs');
    if (!argsTextarea) return;
    
    // Clear the textarea content when switching tools
    argsTextarea.value = '';
    
    const toolDef = this.toolDefinitions.get(toolName);
    if (!toolDef) {
      argsTextarea.placeholder = '{"key": "value"}';
      return;
    }
    
    // Build placeholder text
    let placeholder = {};
    
    const schema = toolDef.inputSchema;
    if (schema && schema.properties) {
      Object.entries(schema.properties).forEach(([prop, def]) => {
        const required = schema.required?.includes(prop);
        let value = '';
        
        if (def.type === 'string') {
          value = def.description || 'string';
        } else if (def.type === 'number') {
          value = def.default !== undefined ? def.default : 0;
        } else if (def.type === 'boolean') {
          value = def.default !== undefined ? def.default : false;
        } else if (def.type === 'array') {
          value = [];
        } else if (def.type === 'object') {
          value = {};
        } else {
          value = def.description || 'value';
        }
        
        // Add comment for required fields
        if (required) {
          placeholder[prop] = value;
        } else {
          placeholder[`${prop} (optional)`] = value;
        }
      });
    }
    
    // Set the placeholder
    argsTextarea.placeholder = JSON.stringify(placeholder, null, 2);
    
    // Hide the help element
    const helpElement = document.getElementById('toolArgsHelp');
    if (helpElement) {
      helpElement.textContent = '';
      helpElement.style.display = 'none';
    }
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

  /**
   * Update codec status display
   */
  updateCodecStatus() {
    const statusElement = document.getElementById('codecStatus');
    if (!statusElement) return;
    
    let status = 'Not Connected';
    let className = 'status disconnected';
    
    if (this.codecReady && this.sessionCodecEnabled) {
      status = 'Active & Validated';
      className = 'status connected';
    } else if (this.codecSupported && this.codecReady) {
      status = 'Ready (Session Pending)';
      className = 'status connecting';
    } else if (this.codecSupported) {
      status = 'Supported (Loading...)';
      className = 'status connecting';
    } else {
      status = 'Fallback Mode (JSON)';
      className = 'status disconnected';
    }
    
    statusElement.textContent = `CODEC: ${status}`;
    statusElement.className = className;
    
    // Update tooltip with detailed information
    const tooltip = `
Codec Support: ${this.codecSupported ? 'Yes' : 'No'}
Codec Ready: ${this.codecReady ? 'Yes' : 'No'}
Session Codec: ${this.sessionCodecEnabled ? 'Enabled' : 'Disabled'}
Schemas Loaded: ${Object.keys(this.receivedSchemas).length}
Message Types: ${this.messageTypes.length}
    `.trim();
    
    statusElement.title = tooltip;
  }

  /**
   * Enhanced error handling with codec awareness
   */
  handleCodecError(error, context = '') {
    console.error(`[App] Codec error in ${context}:`, error);
    
    // Provide user-friendly error messages
    let userMessage = 'Communication error occurred';
    
    if (error.message.includes('validation')) {
      userMessage = 'Message validation failed - using fallback mode';
    } else if (error.message.includes('schema')) {
      userMessage = 'Schema error - some features may not work properly';
    } else if (error.message.includes('encoding')) {
      userMessage = 'Message encoding failed - falling back to JSON';
    }
    
    this.showToast(userMessage, 'warning');
    
    // Update codec status to reflect error state
    this.updateCodecStatus();
  }

  /**
   * Initialize CLI Terminal component
   */
  async initializeCLITerminal() {
    // Only initialize once
    if (this.cliTerminal) return;
    
    if (!this.toolManager) {
      console.error('[App] Cannot initialize CLI Terminal: ToolManager not available');
      return;
    }
    
    try {
      console.log('[App] Initializing CLI Terminal with ToolManager...');
      
      // Dynamically import the new CLI Terminal v2 module
      const { CliTerminalV2 } = await import('./cli-terminal-v2/index.js');
      
      // Create a clean interface for the CLI using ToolManager
      const cliInterface = {
        // Execute a tool and return the result
        executeTool: async (toolName, args) => {
          const requestId = `req_${++this.requestId}`;
          
          return new Promise((resolve, reject) => {
            // Store the promise resolver
            this.pendingRequests.set(requestId, {
              method: 'tools/call',
              params: { name: toolName, arguments: args },
              timestamp: Date.now(),
              resolve: resolve,
              reject: reject
            });
            
            // Send the request
            const success = this.sendMessage({
              type: 'mcp_request',
              requestId: requestId,
              method: 'tools/call',
              params: {
                name: toolName,
                arguments: args
              }
            });
            
            if (!success) {
              this.pendingRequests.delete(requestId);
              reject(new Error('Failed to send request'));
            }
            
            // Set a timeout
            setTimeout(() => {
              if (this.pendingRequests.has(requestId)) {
                this.pendingRequests.delete(requestId);
                reject(new Error('Request timeout'));
              }
            }, 30000); // 30 second timeout
          });
        }
      };
      
      // Create CLI Terminal v2 instance with ToolManager
      this.cliTerminal = new CliTerminalV2('cliTerminalContainer', cliInterface, this.toolManager);
      
      console.log(`[App] CLI Terminal v2 initialized with ${this.toolManager.getTools().size} tools`);
    } catch (error) {
      console.error('[App] Failed to initialize CLI Terminal:', error);
      this.showToast('Failed to load CLI Terminal', 'error');
    }
  }
}

// Initialize application
new DebugUIApp();