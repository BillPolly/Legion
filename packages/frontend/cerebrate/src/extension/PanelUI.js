/**
 * Panel UI for Cerebrate Chrome DevTools Extension
 * Manages the user interface for the debug panel
 */
export class PanelUI {

  constructor(container, dependencies = {}) {
    this.container = container;
    this.webSocketClient = dependencies.webSocketClient;
    this.commandInterface = dependencies.commandInterface;
    this.eventHandler = dependencies.eventHandler;
    
    this.initialized = false;
    this.currentTheme = 'light';
    this.sectionStates = {};
    this.eventListeners = [];
    
    // UI state
    this.isConnecting = false;
    this.isExecuting = false;
    this.selectedCommand = null;
    
    // Default WebSocket URL
    this.defaultWebSocketUrl = 'ws://localhost:9222';
  }

  /**
   * Initialize the panel UI
   */
  initialize() {
    if (!this.container) {
      throw new Error('Container element is required');
    }

    if (!this.webSocketClient || !this.commandInterface || !this.eventHandler) {
      throw new Error('Required dependencies missing');
    }

    if (this.initialized) {
      return;
    }

    this.createPanelStructure();
    this.setupEventListeners();
    this.setupKeyboardShortcuts();
    this.restoreState();
    
    this.initialized = true;
  }

  /**
   * Create the main panel structure
   * @private
   */
  createPanelStructure() {
    try {
      this.container.className = 'cerebrate-panel theme-light';
      this.container.innerHTML = `
        <div class="cerebrate-header">
          <div class="header-title">
            <h1>Cerebrate AI Debug Assistant</h1>
            <div class="connection-status disconnected" title="Connection Status">
              <span class="status-indicator"></span>
              <span class="status-text">Disconnected</span>
            </div>
          </div>
          <div class="header-controls">
            <button class="theme-toggle" aria-label="Toggle theme">🌓</button>
            <button class="settings-button" aria-label="Settings">⚙️</button>
          </div>
        </div>

        <div class="cerebrate-content">
          <div class="cerebrate-sidebar">
            <div class="collapsible-section" data-section="connection">
              <div class="section-header">
                <h3>Connection</h3>
                <button class="section-toggle" aria-label="Toggle section">−</button>
              </div>
              <div class="section-content">
                <div class="connection-controls">
                  <div class="url-input-group">
                    <label for="websocket-url">WebSocket URL:</label>
                    <input type="text" id="websocket-url" class="websocket-url" 
                           value="${this.defaultWebSocketUrl}" placeholder="ws://localhost:9222">
                  </div>
                  <div class="connection-buttons">
                    <button class="connect-button primary">Connect</button>
                    <button class="disconnect-button secondary" disabled>Disconnect</button>
                  </div>
                </div>
              </div>
            </div>

            <div class="collapsible-section" data-section="commands">
              <div class="section-header">
                <h3>Commands</h3>
                <button class="section-toggle" aria-label="Toggle section">−</button>
              </div>
              <div class="section-content">
                <form class="command-form">
                  <div class="command-input-group">
                    <label for="command-select">Select Command:</label>
                    <select id="command-select" name="command" class="command-select">
                      <option value="">-- Select Command --</option>
                      <option value="inspect_element">Inspect Element</option>
                      <option value="analyze_javascript">Analyze JavaScript</option>
                      <option value="debug_error">Debug Error</option>
                      <option value="analyze_performance">Analyze Performance</option>
                      <option value="check_accessibility">Check Accessibility</option>
                    </select>
                  </div>
                  <div class="command-parameters">
                    <!-- Dynamic parameters will be added here -->
                  </div>
                  <button type="submit" class="execute-button primary" disabled>Execute Command</button>
                </form>
                <div class="execution-feedback"></div>
              </div>
            </div>

            <div class="collapsible-section" data-section="statistics">
              <div class="section-header">
                <h3>Statistics</h3>
                <button class="section-toggle" aria-label="Toggle section">−</button>
              </div>
              <div class="section-content">
                <div class="command-statistics">
                  <h4>Commands</h4>
                  <div class="stats-grid">
                    <div class="stat-item">
                      <span class="stat-label">Total:</span>
                      <span class="stat-value" data-stat="total">0</span>
                    </div>
                    <div class="stat-item">
                      <span class="stat-label">Success:</span>
                      <span class="stat-value" data-stat="success">0</span>
                    </div>
                    <div class="stat-item">
                      <span class="stat-label">Success Rate:</span>
                      <span class="stat-value" data-stat="success-rate">0%</span>
                    </div>
                  </div>
                </div>
                <div class="event-statistics">
                  <h4>Events</h4>
                  <div class="stats-grid">
                    <div class="stat-item">
                      <span class="stat-label">Total Events:</span>
                      <span class="stat-value" data-stat="events-total">0</span>
                    </div>
                  </div>
                  <div class="event-counts"></div>
                </div>
              </div>
            </div>
          </div>

          <div class="cerebrate-main">
            <div class="results-section">
              <div class="section-header">
                <h3>Results</h3>
                <div class="results-controls">
                  <button class="clear-results" aria-label="Clear results">🗑️</button>
                </div>
              </div>
              <div class="results-content">
                <div class="welcome-message">
                  <p>Connect to start debugging with AI assistance.</p>
                </div>
              </div>
            </div>

            <div class="progress-section">
              <div class="progress-display"></div>
            </div>
          </div>
        </div>

        <div class="cerebrate-footer">
          <div class="collapsible-section collapsed" data-section="command-history">
            <div class="section-header">
              <h4>Command History</h4>
              <button class="section-toggle" aria-label="Toggle section">+</button>
            </div>
            <div class="section-content">
              <div class="command-history">
                <p class="empty-state">No commands executed yet.</p>
              </div>
            </div>
          </div>
        </div>

        <div class="error-display" style="display: none;"></div>
      `;

      this.applyStyling();
      this.initializeCollapsibleSections();
    } catch (error) {
      console.error('Error creating panel structure:', error);
    }
  }

  /**
   * Apply CSS styling to the panel
   * @private
   */
  applyStyling() {
    const style = document.createElement('style');
    style.textContent = `
      .cerebrate-panel {
        display: flex;
        flex-direction: column;
        height: 100%;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 12px;
        background: var(--panel-bg, #ffffff);
        color: var(--panel-text, #000000);
        --primary-color: #1976d2;
        --secondary-color: #757575;
        --success-color: #4caf50;
        --error-color: #f44336;
        --warning-color: #ff9800;
      }

      .theme-dark {
        --panel-bg: #1e1e1e;
        --panel-text: #ffffff;
      }

      .cerebrate-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 8px 12px;
        border-bottom: 1px solid var(--secondary-color, #ccc);
        background: var(--panel-bg, #f5f5f5);
      }

      .header-title h1 {
        margin: 0;
        font-size: 14px;
        font-weight: 600;
      }

      .connection-status {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 11px;
      }

      .status-indicator {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: var(--error-color);
      }

      .connection-status.connected .status-indicator {
        background: var(--success-color);
      }

      .cerebrate-content {
        display: flex;
        flex: 1;
        overflow: hidden;
      }

      .cerebrate-sidebar {
        width: 280px;
        border-right: 1px solid var(--secondary-color, #ccc);
        overflow-y: auto;
        background: var(--panel-bg, #fafafa);
      }

      .cerebrate-main {
        flex: 1;
        display: flex;
        flex-direction: column;
        overflow: hidden;
      }

      .collapsible-section {
        border-bottom: 1px solid var(--secondary-color, #eee);
      }

      .section-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 8px 12px;
        background: var(--panel-bg, #f0f0f0);
        cursor: pointer;
      }

      .section-header h3, .section-header h4 {
        margin: 0;
        font-size: 12px;
        font-weight: 500;
      }

      .section-toggle {
        background: none;
        border: none;
        font-size: 14px;
        cursor: pointer;
        color: var(--panel-text);
      }

      .section-content {
        padding: 12px;
      }

      .collapsed .section-content {
        display: none;
      }

      .collapsed .section-toggle::before {
        content: '+';
      }

      .command-form {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }

      .command-input-group, .url-input-group {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }

      .command-input-group label, .url-input-group label {
        font-size: 11px;
        font-weight: 500;
        color: var(--secondary-color);
      }

      .command-select, .websocket-url {
        padding: 6px 8px;
        border: 1px solid var(--secondary-color, #ccc);
        border-radius: 4px;
        font-size: 11px;
        background: var(--panel-bg);
        color: var(--panel-text);
      }

      .connection-buttons, .results-controls {
        display: flex;
        gap: 8px;
      }

      button {
        padding: 6px 12px;
        border: 1px solid var(--secondary-color, #ccc);
        border-radius: 4px;
        font-size: 11px;
        cursor: pointer;
        background: var(--panel-bg);
        color: var(--panel-text);
      }

      .primary {
        background: var(--primary-color);
        color: white;
        border-color: var(--primary-color);
      }

      .secondary {
        background: var(--secondary-color);
        color: white;
      }

      button:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      .results-section {
        flex: 1;
        display: flex;
        flex-direction: column;
        overflow: hidden;
      }

      .results-content {
        flex: 1;
        padding: 12px;
        overflow-y: auto;
      }

      .code-block {
        background: #f8f8f8;
        border: 1px solid #ddd;
        border-radius: 4px;
        padding: 12px;
        font-family: 'Courier New', monospace;
        font-size: 11px;
        overflow-x: auto;
      }

      .language-javascript {
        background: #f8f8f8;
      }

      .stats-grid {
        display: grid;
        grid-template-columns: 1fr;
        gap: 4px;
      }

      .stat-item {
        display: flex;
        justify-content: space-between;
        padding: 2px 0;
      }

      .stat-label {
        font-size: 10px;
        color: var(--secondary-color);
      }

      .stat-value {
        font-size: 10px;
        font-weight: 500;
      }

      .error-display {
        position: fixed;
        top: 50px;
        right: 20px;
        background: var(--error-color);
        color: white;
        padding: 12px;
        border-radius: 4px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.2);
        z-index: 1000;
      }

      .welcome-message {
        text-align: center;
        color: var(--secondary-color);
        margin-top: 50px;
      }

      .execution-feedback {
        margin-top: 8px;
        padding: 8px;
        border-radius: 4px;
        font-size: 11px;
        display: none;
      }

      .execution-feedback.show {
        display: block;
      }

      .execution-feedback.executing {
        background: #e3f2fd;
        color: #1976d2;
        border: 1px solid #bbdefb;
      }

      .progress-display {
        padding: 8px 12px;
        background: #f5f5f5;
        border-top: 1px solid #ddd;
        font-size: 11px;
        min-height: 20px;
      }

      @media (max-width: 600px) {
        .cerebrate-content {
          flex-direction: column;
        }
        
        .cerebrate-sidebar {
          width: 100%;
          border-right: none;
          border-bottom: 1px solid var(--secondary-color, #ccc);
        }
      }
    `;
    
    if (!document.head.querySelector('#cerebrate-styles')) {
      style.id = 'cerebrate-styles';
      document.head.appendChild(style);
    }
  }

  /**
   * Initialize collapsible sections
   * @private
   */
  initializeCollapsibleSections() {
    const sections = this.container.querySelectorAll('.collapsible-section');
    sections.forEach(section => {
      const toggle = section.querySelector('.section-toggle');
      const header = section.querySelector('.section-header');
      
      const toggleSection = () => {
        section.classList.toggle('collapsed');
        const isCollapsed = section.classList.contains('collapsed');
        toggle.textContent = isCollapsed ? '+' : '−';
        
        const sectionName = section.getAttribute('data-section');
        this.sectionStates[sectionName] = !isCollapsed;
      };
      
      toggle.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleSection();
      });
      
      header.addEventListener('click', toggleSection);
    });
  }

  /**
   * Setup event listeners
   * @private
   */
  setupEventListeners() {
    // Connection controls
    const connectButton = this.container.querySelector('.connect-button');
    const disconnectButton = this.container.querySelector('.disconnect-button');
    const urlInput = this.container.querySelector('.websocket-url');

    this.addEventListener(connectButton, 'click', this.handleConnect.bind(this));
    this.addEventListener(disconnectButton, 'click', this.handleDisconnect.bind(this));

    // Command form
    const commandForm = this.container.querySelector('.command-form');
    const commandSelect = this.container.querySelector('.command-select');
    const executeButton = this.container.querySelector('.execute-button');

    this.addEventListener(commandSelect, 'change', this.handleCommandSelect.bind(this));
    this.addEventListener(commandForm, 'submit', this.handleCommandSubmit.bind(this));

    // Theme toggle
    const themeToggle = this.container.querySelector('.theme-toggle');
    this.addEventListener(themeToggle, 'click', this.handleThemeToggle.bind(this));

    // Clear results
    const clearResults = this.container.querySelector('.clear-results');
    this.addEventListener(clearResults, 'click', this.handleClearResults.bind(this));

    // WebSocket client events
    if (this.webSocketClient) {
      this.webSocketClient.on('connected', this.handleWSConnected.bind(this));
      this.webSocketClient.on('disconnected', this.handleWSDisconnected.bind(this));
      this.webSocketClient.on('stateChange', this.handleWSStateChange.bind(this));
    }

    // Event handler events
    if (this.eventHandler) {
      this.eventHandler.on('progress', this.handleProgressUpdate.bind(this));
    }

    // Window resize
    this.addEventListener(window, 'resize', this.handleResize.bind(this));
  }

  /**
   * Setup keyboard shortcuts
   * @private
   */
  setupKeyboardShortcuts() {
    this.addEventListener(document, 'keydown', (event) => {
      if (event.ctrlKey || event.metaKey) {
        switch (event.key) {
          case 'Enter':
            event.preventDefault();
            this.executeCurrentCommand();
            break;
          case 'k':
            event.preventDefault();
            this.focusCommandSelect();
            break;
        }
      }
    });
  }

  /**
   * Add event listener and track for cleanup
   * @param {Element} element - Element to add listener to
   * @param {string} event - Event name
   * @param {Function} handler - Event handler
   * @private
   */
  addEventListener(element, event, handler) {
    element.addEventListener(event, handler);
    this.eventListeners.push({ element, event, handler });
  }

  /**
   * Handle WebSocket connection
   * @private
   */
  async handleConnect() {
    const connectButton = this.container.querySelector('.connect-button');
    const disconnectButton = this.container.querySelector('.disconnect-button');
    const urlInput = this.container.querySelector('.websocket-url');

    this.isConnecting = true;
    connectButton.textContent = 'Connecting...';
    connectButton.disabled = true;

    try {
      await this.webSocketClient.connect(urlInput.value);
    } catch (error) {
      this.showError(`Connection failed: ${error.message}`);
      connectButton.textContent = 'Connect';
      connectButton.disabled = false;
      this.isConnecting = false;
    }
  }

  /**
   * Handle WebSocket disconnection
   * @private
   */
  handleDisconnect() {
    this.webSocketClient.disconnect();
  }

  /**
   * Handle command selection
   * @private
   */
  handleCommandSelect() {
    const commandSelect = this.container.querySelector('.command-select');
    const executeButton = this.container.querySelector('.execute-button');
    
    this.selectedCommand = commandSelect.value;
    executeButton.disabled = !this.selectedCommand || this.isExecuting;

    this.updateCommandParameters();
  }

  /**
   * Handle command form submission
   * @private
   */
  async handleCommandSubmit(event) {
    event.preventDefault();
    this.executeCurrentCommand();
  }

  /**
   * Execute the currently selected command
   * @private
   */
  async executeCurrentCommand() {
    if (!this.selectedCommand || this.isExecuting) return;

    const executeButton = this.container.querySelector('.execute-button');
    const feedback = this.container.querySelector('.execution-feedback');

    this.isExecuting = true;
    executeButton.disabled = true;
    executeButton.textContent = 'Executing...';

    feedback.className = 'execution-feedback show executing';
    feedback.textContent = `Executing ${this.selectedCommand}...`;

    try {
      const parameters = this.getCommandParameters();
      const result = await this.commandInterface.execute(this.selectedCommand, parameters);
      
      this.displayCommandResult(this.selectedCommand, result);
      feedback.style.display = 'none';
      
    } catch (error) {
      this.showError(`Command failed: ${error.message}`);
      feedback.style.display = 'none';
    } finally {
      this.isExecuting = false;
      executeButton.disabled = false;
      executeButton.textContent = 'Execute Command';
      this.updateStatistics();
    }
  }

  /**
   * Handle theme toggle
   * @private
   */
  handleThemeToggle() {
    const newTheme = this.currentTheme === 'light' ? 'dark' : 'light';
    this.setTheme(newTheme);
  }

  /**
   * Handle clear results
   * @private
   */
  handleClearResults() {
    const resultsContent = this.container.querySelector('.results-content');
    resultsContent.innerHTML = '<div class="welcome-message"><p>Results cleared.</p></div>';
  }

  /**
   * Handle WebSocket connected event
   * @private
   */
  handleWSConnected() {
    const connectButton = this.container.querySelector('.connect-button');
    const disconnectButton = this.container.querySelector('.disconnect-button');

    connectButton.textContent = 'Connected';
    connectButton.disabled = true;
    disconnectButton.disabled = false;

    this.updateConnectionStatus('connected');
    this.isConnecting = false;
  }

  /**
   * Handle WebSocket disconnected event
   * @private
   */
  handleWSDisconnected() {
    const connectButton = this.container.querySelector('.connect-button');
    const disconnectButton = this.container.querySelector('.disconnect-button');

    connectButton.textContent = 'Connect';
    connectButton.disabled = false;
    disconnectButton.disabled = true;

    this.updateConnectionStatus('disconnected');
    this.isConnecting = false;
  }

  /**
   * Handle WebSocket state change
   * @param {string} state - New state
   * @private
   */
  handleWSStateChange(state) {
    this.updateConnectionStatus(state);
  }

  /**
   * Handle progress updates
   * @param {Object} data - Progress data
   * @private
   */
  handleProgressUpdate(data) {
    const progressDisplay = this.container.querySelector('.progress-display');
    if (data.message) {
      progressDisplay.textContent = `${data.message} (${Math.round(data.progress * 100)}%)`;
    }
  }

  /**
   * Handle window resize
   * @private
   */
  handleResize() {
    // Handle responsive layout adjustments
  }

  /**
   * Update command parameters based on selected command
   * @private
   */
  updateCommandParameters() {
    const parametersContainer = this.container.querySelector('.command-parameters');
    parametersContainer.innerHTML = '';

    const parameterConfigs = {
      'inspect_element': [
        { name: 'selector', type: 'text', label: 'CSS Selector', placeholder: '#my-element' }
      ],
      'analyze_javascript': [
        { name: 'url', type: 'text', label: 'Script URL (optional)', placeholder: '/path/to/script.js' }
      ],
      'debug_error': [
        { name: 'errorMessage', type: 'text', label: 'Error Message', placeholder: 'TypeError: ...' }
      ]
    };

    const config = parameterConfigs[this.selectedCommand];
    if (config) {
      config.forEach(param => {
        const group = document.createElement('div');
        group.className = 'command-input-group';
        
        const label = document.createElement('label');
        label.textContent = param.label;
        label.setAttribute('for', param.name);
        
        const input = document.createElement('input');
        input.type = param.type;
        input.id = param.name;
        input.name = param.name;
        input.placeholder = param.placeholder || '';
        
        group.appendChild(label);
        group.appendChild(input);
        parametersContainer.appendChild(group);
      });
    }
  }

  /**
   * Get command parameters from form
   * @returns {Object} - Command parameters
   * @private
   */
  getCommandParameters() {
    const parameters = {};
    const inputs = this.container.querySelectorAll('.command-parameters input');
    
    inputs.forEach(input => {
      if (input.value) {
        parameters[input.name] = input.value;
      }
    });

    return parameters;
  }

  /**
   * Focus command select element
   * @private
   */
  focusCommandSelect() {
    const commandSelect = this.container.querySelector('.command-select');
    commandSelect.focus();
  }

  /**
   * Set theme
   * @param {string} theme - Theme name ('light' or 'dark')
   */
  setTheme(theme) {
    this.currentTheme = theme;
    this.container.className = `cerebrate-panel theme-${theme}`;
  }

  /**
   * Toggle section visibility
   * @param {string} sectionName - Section name
   * @param {boolean} visible - Whether section should be visible
   */
  toggleSection(sectionName, visible) {
    const section = this.container.querySelector(`[data-section="${sectionName}"]`);
    if (section) {
      if (visible === undefined) {
        section.classList.toggle('collapsed');
      } else {
        section.classList.toggle('collapsed', !visible);
      }
      
      const toggle = section.querySelector('.section-toggle');
      const isCollapsed = section.classList.contains('collapsed');
      toggle.textContent = isCollapsed ? '+' : '−';
      
      this.sectionStates[sectionName] = !isCollapsed;
    }
  }

  /**
   * Update connection status
   * @param {string} status - Connection status
   */
  updateConnectionStatus(status) {
    const statusElement = this.container.querySelector('.connection-status');
    const statusText = this.container.querySelector('.status-text');
    
    statusElement.className = `connection-status ${status}`;
    statusText.textContent = status.charAt(0).toUpperCase() + status.slice(1);
  }

  /**
   * Display command result
   * @param {string} command - Command name
   * @param {Object} result - Command result
   */
  displayCommandResult(command, result) {
    const resultsContent = this.container.querySelector('.results-content');
    
    const resultElement = document.createElement('div');
    resultElement.className = 'command-result';
    resultElement.innerHTML = `
      <div class="result-header">
        <h4>${command}</h4>
        <span class="result-timestamp">${new Date().toLocaleTimeString()}</span>
      </div>
      <div class="result-content">
        ${this.formatResult(command, result)}
      </div>
    `;

    // Clear welcome message
    if (resultsContent.querySelector('.welcome-message')) {
      resultsContent.innerHTML = '';
    }

    resultsContent.appendChild(resultElement);
    resultsContent.scrollTop = resultsContent.scrollHeight;
  }

  /**
   * Format command result for display
   * @param {string} command - Command name
   * @param {Object} result - Command result
   * @returns {string} - Formatted HTML
   * @private
   */
  formatResult(command, result) {
    if (!result.success) {
      return `<div class="error">Error: ${result.error || 'Unknown error'}</div>`;
    }

    switch (command) {
      case 'inspect_element':
        return this.formatElementInspection(result.data);
      case 'analyze_javascript':
        return this.formatCodeAnalysis(result.data);
      case 'debug_error':
        return this.formatErrorInvestigation(result.data);
      default:
        return this.formatGenericResult(result.data);
    }
  }

  /**
   * Format element inspection result
   * @param {Object} data - Element data
   * @returns {string} - Formatted HTML
   * @private
   */
  formatElementInspection(data) {
    if (!data.element) return '<p>No element data</p>';
    
    const { tagName, id, className, attributes = {} } = data.element;
    
    return `
      <div class="element-inspection">
        <p><strong>Tag:</strong> ${tagName}</p>
        ${id ? `<p><strong>ID:</strong> ${id}</p>` : ''}
        ${className ? `<p><strong>Class:</strong> ${className}</p>` : ''}
        ${Object.keys(attributes).length > 0 ? `
          <p><strong>Attributes:</strong></p>
          <ul>
            ${Object.entries(attributes).map(([key, value]) => 
              `<li>${key}: ${value}</li>`
            ).join('')}
          </ul>
        ` : ''}
      </div>
    `;
  }

  /**
   * Format code analysis result
   * @param {Object} data - Code analysis data
   * @returns {string} - Formatted HTML
   * @private
   */
  formatCodeAnalysis(data) {
    if (!data.codeQuality) return '<p>No analysis data</p>';
    
    const { score, issues = [] } = data.codeQuality;
    
    return `
      <div class="code-analysis">
        <p><strong>Quality Score:</strong> ${score}/100</p>
        ${issues.length > 0 ? `
          <p><strong>Issues:</strong></p>
          <ul>
            ${issues.map(issue => 
              `<li class="issue-${issue.type}">${issue.message} (Line ${issue.line})</li>`
            ).join('')}
          </ul>
        ` : '<p>No issues found.</p>'}
      </div>
    `;
  }

  /**
   * Format error investigation result
   * @param {Object} data - Error data
   * @returns {string} - Formatted HTML
   * @private
   */
  formatErrorInvestigation(data) {
    if (!data.errors) return '<p>No error data</p>';
    
    return `
      <div class="error-investigation">
        ${data.errors.map(error => `
          <div class="error-item">
            <p><strong>Error:</strong> ${error.message}</p>
            ${error.stack ? `<p><strong>Stack:</strong> ${error.stack}</p>` : ''}
            ${error.suggestions && error.suggestions.length > 0 ? `
              <p><strong>Suggestions:</strong></p>
              <ul>
                ${error.suggestions.map(suggestion => `<li>${suggestion}</li>`).join('')}
              </ul>
            ` : ''}
          </div>
        `).join('')}
      </div>
    `;
  }

  /**
   * Format generic result
   * @param {Object} data - Result data
   * @returns {string} - Formatted HTML
   * @private
   */
  formatGenericResult(data) {
    if (data.code && data.language) {
      return `<pre class="code-block language-${data.language}"><code>${data.code}</code></pre>`;
    }

    return `
      <div class="structured-data">
        <pre>${JSON.stringify(data, null, 2)}</pre>
      </div>
    `;
  }

  /**
   * Update statistics display
   * @private
   */
  updateStatistics() {
    if (!this.commandInterface) return;

    const stats = this.commandInterface.getStatistics();
    
    this.container.querySelector('[data-stat="total"]').textContent = stats.totalCommands;
    this.container.querySelector('[data-stat="success"]').textContent = stats.successCount;
    
    const successRate = stats.totalCommands > 0 
      ? Math.round((stats.successCount / stats.totalCommands) * 100)
      : 0;
    this.container.querySelector('[data-stat="success-rate"]').textContent = `${successRate}%`;

    // Update event statistics
    if (this.eventHandler) {
      const eventStats = this.eventHandler.getEventStatistics();
      this.container.querySelector('[data-stat="events-total"]').textContent = eventStats.totalEvents;
      
      const eventCounts = this.container.querySelector('.event-counts');
      eventCounts.innerHTML = Object.entries(eventStats.eventCounts)
        .map(([event, count]) => `<div class="stat-item"><span class="stat-label">${event}:</span><span class="stat-value">${count}</span></div>`)
        .join('');
    }
  }

  /**
   * Show error message
   * @param {string} message - Error message
   * @private
   */
  showError(message) {
    const errorDisplay = this.container.querySelector('.error-display');
    errorDisplay.textContent = message;
    errorDisplay.style.display = 'block';
    
    setTimeout(() => {
      errorDisplay.style.display = 'none';
    }, 5000);
  }

  /**
   * Get panel state for persistence
   * @returns {Object} - Panel state
   */
  getPanelState() {
    return {
      theme: this.currentTheme,
      sections: { ...this.sectionStates },
      websocketUrl: this.container.querySelector('.websocket-url')?.value || this.defaultWebSocketUrl
    };
  }

  /**
   * Restore panel state
   * @param {Object} state - Panel state to restore
   */
  restorePanelState(state) {
    if (state.theme) {
      this.setTheme(state.theme);
    }
    
    if (state.sections) {
      Object.entries(state.sections).forEach(([section, visible]) => {
        this.toggleSection(section, visible);
      });
    }
    
    if (state.websocketUrl) {
      const urlInput = this.container.querySelector('.websocket-url');
      if (urlInput) {
        urlInput.value = state.websocketUrl;
      }
    }
  }

  /**
   * Restore state from storage
   * @private
   */
  restoreState() {
    try {
      const stored = localStorage.getItem('cerebrate-panel-state');
      if (stored) {
        const state = JSON.parse(stored);
        this.restorePanelState(state);
      }
    } catch (error) {
      console.warn('Failed to restore panel state:', error);
    }
  }

  /**
   * Save state to storage
   * @private
   */
  saveState() {
    try {
      const state = this.getPanelState();
      localStorage.setItem('cerebrate-panel-state', JSON.stringify(state));
    } catch (error) {
      console.warn('Failed to save panel state:', error);
    }
  }

  /**
   * Check if panel is initialized
   * @returns {boolean} - True if initialized
   */
  isInitialized() {
    return this.initialized;
  }

  /**
   * Create command form (helper method for testing)
   */
  createCommandForm() {
    // This method exists for testing error handling
    const form = document.createElement('form');
    form.className = 'command-form';
    return form;
  }

  /**
   * Destroy panel and cleanup resources
   */
  destroy() {
    if (!this.initialized) {
      return;
    }

    // Save state before destroying
    this.saveState();

    // Remove event listeners
    this.eventListeners.forEach(({ element, event, handler }) => {
      element.removeEventListener(event, handler);
    });
    this.eventListeners = [];

    // Remove WebSocket client listeners
    if (this.webSocketClient) {
      this.webSocketClient.off('connected', this.handleWSConnected.bind(this));
      this.webSocketClient.off('disconnected', this.handleWSDisconnected.bind(this));
      this.webSocketClient.off('stateChange', this.handleWSStateChange.bind(this));
    }

    // Remove event handler listeners
    if (this.eventHandler) {
      this.eventHandler.off('progress', this.handleProgressUpdate.bind(this));
    }

    // Clear container
    if (this.container) {
      this.container.innerHTML = '';
      this.container.className = '';
    }

    this.initialized = false;
  }
}