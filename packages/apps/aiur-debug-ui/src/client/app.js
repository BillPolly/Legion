/**
 * Aiur Debug UI - Simplified CLI Application
 * 
 * Connects directly to Aiur server WebSocket with codec validation
 * Provides CLI terminal interface and WebSocket message logging
 */

import { CliTerminal } from './cli-terminal/components/CliTerminal.js';
import { ClientCodec } from './codec/ClientCodec.js';

class AiurDebugApp {
  constructor() {
    // Connection state
    this.ws = null;
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;
    this.reconnectInterval = 5000;
    
    // Codec system for schema validation
    this.codec = new ClientCodec();
    this.codecReady = false;
    this.schemas = {};
    this.messageTypes = [];
    
    // CLI Terminal
    this.cliTerminal = null;
    
    // WebSocket logging
    this.wsLogs = [];
    this.logFilter = '';
    
    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.init());
    } else {
      this.init();
    }
  }

  /**
   * Initialize the debug application
   */
  async init() {
    try {
      // Load configuration
      await this.loadConfig();
      
      // Setup event listeners
      this.setupEventListeners();
      
      // Connect to Aiur server
      await this.connect();
      
      console.log('Aiur Debug UI initialized successfully');
    } catch (error) {
      console.error('Failed to initialize debug UI:', error);
      this.showToast('Failed to initialize debug UI', 'error');
    }
  }

  /**
   * Load configuration from server
   */
  async loadConfig() {
    try {
      const response = await fetch('/api/config');
      this.config = await response.json();
      console.log('Config loaded:', this.config);
    } catch (error) {
      console.error('Failed to load config:', error);
      // Use default config
      this.config = {
        mcp: {
          defaultUrl: 'ws://localhost:8080/ws'
        }
      };
    }
  }

  /**
   * Setup DOM event listeners
   */
  setupEventListeners() {
    // Log viewer controls
    const clearLogsBtn = document.getElementById('clearLogs');
    if (clearLogsBtn) {
      clearLogsBtn.addEventListener('click', () => this.clearLogs());
    }
    
    const logLevelSelect = document.getElementById('logLevel');
    if (logLevelSelect) {
      logLevelSelect.addEventListener('change', (e) => {
        this.logFilter = e.target.value;
        this.updateLogDisplay();
      });
    }
  }

  /**
   * Connect to Aiur WebSocket server
   */
  async connect() {
    const url = this.config.mcp.defaultUrl;
    console.log('Connecting to Aiur server:', url);
    
    this.updateConnectionStatus('connecting');
    this.logWebSocketMessage('system', 'connecting', `Connecting to ${url}`);
    
    try {
      this.ws = new WebSocket(url);
      
      this.ws.onopen = () => this.onConnected();
      this.ws.onmessage = (event) => this.onMessage(event);
      this.ws.onclose = () => this.onDisconnected();
      this.ws.onerror = (error) => this.onError(error);
      
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
    this.logWebSocketMessage('system', 'connected', 'Connected to Aiur server');
    
    console.log('Connected to Aiur server');
    this.showToast('Connected to Aiur server', 'success');
  }

  /**
   * Handle WebSocket message received
   */
  onMessage(event) {
    const data = event.data;
    this.logWebSocketMessage('received', 'message', data);
    
    try {
      const message = JSON.parse(data);
      
      // Validate with codec if available
      if (this.codecReady && message.type) {
        const validation = this.codec.validate(message.type, message);
        if (!validation.success) {
          console.warn('Message validation failed:', validation.error);
          this.logWebSocketMessage('error', 'validation', `Validation failed: ${validation.error}`);
        }
      }
      
      // Handle different message types
      switch (message.type) {
        case 'welcome':
          this.handleWelcome(message);
          break;
          
        case 'session_created':
          this.handleSessionCreated(message);
          break;
          
        case 'tool_response':
          this.handleToolResponse(message);
          break;
          
        case 'error':
          this.handleError(message);
          break;
          
        default:
          console.log('Received message:', message);
      }
      
    } catch (error) {
      console.error('Failed to parse WebSocket message:', error);
      this.logWebSocketMessage('error', 'parse', `Parse error: ${error.message}`);
    }
  }

  /**
   * Handle welcome message and initialize codec
   */
  handleWelcome(message) {
    console.log('Welcome message received:', message);
    
    // Initialize codec with schemas if provided
    if (message.schemas && message.messageTypes) {
      this.schemas = message.schemas;
      this.messageTypes = message.messageTypes;
      
      try {
        this.codec.loadSchemas({
          schemas: message.schemas,
          messageTypes: message.messageTypes
        });
        this.codecReady = true;
        this.updateCodecStatus('ready');
        
        console.log('Codec initialized with schemas:', Object.keys(message.schemas).length);
        this.logWebSocketMessage('system', 'codec', `Codec initialized with ${Object.keys(message.schemas).length} schemas`);
      } catch (error) {
        console.error('Failed to initialize codec:', error);
        this.updateCodecStatus('error');
        this.logWebSocketMessage('error', 'codec', `Codec initialization failed: ${error.message}`);
      }
    }
    
    // Update server info
    this.updateServerInfo(message);
    
    // Initialize CLI terminal now that we have connection and schemas
    this.initializeCLITerminal();
  }

  /**
   * Initialize CLI Terminal component
   */
  initializeCLITerminal() {
    if (this.cliTerminal) {
      return; // Already initialized
    }
    
    console.log('Initializing CLI Terminal...');
    
    // Create Aiur connection wrapper for CLI terminal
    const aiurConnection = {
      isConnected: () => this.isConnected,
      sendMessage: (message) => this.sendMessage(message),
      // Add other methods the CLI terminal needs
    };
    
    // Initialize CLI terminal
    this.cliTerminal = new CliTerminal('cliTerminalContainer', aiurConnection);
    
    console.log('CLI Terminal initialized');
    this.logWebSocketMessage('system', 'cli', 'CLI Terminal initialized');
  }

  /**
   * Handle session created response
   */
  handleSessionCreated(message) {
    console.log('Session created:', message);
    this.logWebSocketMessage('system', 'session', `Session created: ${message.sessionId}`);
  }

  /**
   * Handle tool response
   */
  handleToolResponse(message) {
    console.log('Tool response:', message);
    // CLI terminal will handle this through its own mechanism
  }

  /**
   * Handle error message
   */
  handleError(message) {
    console.error('Server error:', message);
    this.logWebSocketMessage('error', 'server', `Server error: ${message.error?.message || message.message}`);
    this.showToast(`Server error: ${message.error?.message || message.message}`, 'error');
  }

  /**
   * Handle WebSocket disconnection
   */
  onDisconnected() {
    this.isConnected = false;
    this.updateConnectionStatus('disconnected');
    this.logWebSocketMessage('system', 'disconnected', 'Disconnected from server');
    
    console.log('Disconnected from server');
    
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
    this.logWebSocketMessage('error', 'connection', `Connection error: ${error.message}`);
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
      const messageStr = JSON.stringify(message);
      this.ws.send(messageStr);
      this.logWebSocketMessage('sent', 'message', messageStr);
      return true;
    } catch (error) {
      console.error('Error sending message:', error);
      this.logWebSocketMessage('error', 'send', `Send error: ${error.message}`);
      this.showToast('Error sending message to server', 'error');
      return false;
    }
  }

  /**
   * Log WebSocket message for debugging
   */
  logWebSocketMessage(direction, type, content) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      direction, // 'sent', 'received', 'system', 'error'
      type,
      content: typeof content === 'string' ? content : JSON.stringify(content, null, 2)
    };
    
    this.wsLogs.unshift(logEntry); // Add to beginning (newest first)
    
    // Keep only last 500 logs
    if (this.wsLogs.length > 500) {
      this.wsLogs = this.wsLogs.slice(0, 500);
    }
    
    this.updateLogDisplay();
  }

  /**
   * Update connection status display
   */
  updateConnectionStatus(status) {
    const statusElement = document.getElementById('connectionStatus');
    if (statusElement) {
      statusElement.className = `status ${status}`;
      
      const statusText = {
        connecting: 'Server: Connecting...',
        connected: 'Server: Connected',
        disconnected: 'Server: Disconnected'
      };
      
      statusElement.textContent = statusText[status] || status;
    }
  }

  /**
   * Update codec status display
   */
  updateCodecStatus(status) {
    const statusElement = document.getElementById('codecStatus');
    if (statusElement) {
      const statusText = {
        ready: 'Codec: Schemas Loaded',
        error: 'Codec: Error',
        loading: 'Codec: Loading...'
      };
      
      statusElement.textContent = statusText[status] || 'Codec: Not Ready';
      statusElement.className = `status ${status}`;
    }
  }

  /**
   * Update server info display
   */
  updateServerInfo(welcomeMessage) {
    const serverInfoElement = document.getElementById('serverInfo');
    if (serverInfoElement) {
      const info = `Server: ${welcomeMessage.serverVersion} | Capabilities: ${welcomeMessage.capabilities?.join(', ') || 'Unknown'}`;
      serverInfoElement.textContent = info;
    }
  }

  /**
   * Update log display
   */
  updateLogDisplay() {
    const logViewer = document.getElementById('logViewer');
    if (!logViewer) return;

    // Apply filter
    const filteredLogs = this.logFilter ? 
      this.wsLogs.filter(log => log.direction === this.logFilter) : 
      this.wsLogs;

    logViewer.innerHTML = '';

    filteredLogs.forEach(log => {
      const logElement = document.createElement('div');
      logElement.className = `log-entry ${log.direction}`;
      
      const timestamp = new Date(log.timestamp).toLocaleTimeString();
      
      logElement.innerHTML = `
        <div class="log-timestamp">${timestamp}</div>
        <span class="log-direction">${log.direction.toUpperCase()}</span>
        <span class="log-type">${log.type}</span>
        <div class="log-content">${log.content}</div>
      `;
      
      logViewer.appendChild(logElement);
    });

    // Auto-scroll to bottom
    logViewer.scrollTop = logViewer.scrollHeight;
  }

  /**
   * Clear log display
   */
  clearLogs() {
    this.wsLogs = [];
    this.updateLogDisplay();
  }

  /**
   * Show toast notification
   */
  showToast(message, type = 'info') {
    const toastContainer = document.getElementById('toastContainer');
    if (!toastContainer) return;
    
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
    console.log(`${type.toUpperCase()}: ${message}`);
  }
}

// Initialize the debug application
new AiurDebugApp();