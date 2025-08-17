/**
 * ExecutionConsole Component
 * Displays and manages execution logs and console output with real-time streaming
 */

import { UmbilicalUtils } from '/legion/frontend-components/src/umbilical/index.js';
import { StandardizedComponentAPI } from '../../base/StandardizedComponentAPI.js';
import { APIResponse } from '../../interfaces/ComponentAPI.js';

/**
 * Model - Manages console state and log data
 */
class ExecutionConsoleModel {
  constructor() {
    this.state = {
      logs: [],
      maxLogEntries: 1000,
      autoScroll: true,
      logLevel: 'info', // debug, info, warn, error
      searchQuery: '',
      isConsoleEnabled: true,
      executionContext: {
        executionId: null,
        taskId: null,
        planId: null
      },
      statistics: {
        totalLogs: 0,
        errorCount: 0,
        warningCount: 0,
        infoCount: 0,
        debugCount: 0,
        sessionStart: new Date().toISOString()
      },
      logLevels: {
        debug: 0,
        info: 1,
        warn: 2,
        error: 3
      }
    };
    
    this.listeners = new Set();
  }

  getState(key) {
    return key ? this.state[key] : { ...this.state };
  }

  updateState(key, value) {
    this.state[key] = value;
    this.notifyListeners({ [key]: value });
  }

  addListener(listener) {
    this.listeners.add(listener);
  }

  removeListener(listener) {
    this.listeners.delete(listener);
  }

  notifyListeners(changes) {
    this.listeners.forEach(listener => listener(changes));
  }

  addLogEntry(logEntry) {
    // Generate ID if not provided
    if (!logEntry.id) {
      logEntry.id = `log-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    // Add timestamp if not provided
    if (!logEntry.timestamp) {
      logEntry.timestamp = new Date().toISOString();
    }

    // Add execution context if available and not provided
    if (!logEntry.context && this.state.executionContext.executionId) {
      logEntry.context = { ...this.state.executionContext };
    }

    // Add to logs
    this.state.logs.push(logEntry);

    // Update statistics
    this.updateStatistics(logEntry);

    // Enforce max entries limit
    if (this.state.logs.length > this.state.maxLogEntries) {
      const removed = this.state.logs.splice(0, this.state.logs.length - this.state.maxLogEntries);
      // Update statistics for removed entries
      removed.forEach(removedEntry => this.updateStatistics(removedEntry, true));
    }

    this.notifyListeners({ logs: this.state.logs, statistics: this.state.statistics });
  }

  updateStatistics(logEntry, isRemoval = false) {
    const modifier = isRemoval ? -1 : 1;
    
    this.state.statistics.totalLogs += modifier;
    
    switch (logEntry.level) {
      case 'debug':
        this.state.statistics.debugCount += modifier;
        break;
      case 'info':
        this.state.statistics.infoCount += modifier;
        break;
      case 'warn':
        this.state.statistics.warningCount += modifier;
        break;
      case 'error':
        this.state.statistics.errorCount += modifier;
        break;
    }

    // Ensure counts don't go negative
    Object.keys(this.state.statistics).forEach(key => {
      if (typeof this.state.statistics[key] === 'number' && this.state.statistics[key] < 0) {
        this.state.statistics[key] = 0;
      }
    });
  }

  clearLogs() {
    this.state.logs = [];
    this.state.statistics = {
      totalLogs: 0,
      errorCount: 0,
      warningCount: 0,
      infoCount: 0,
      debugCount: 0,
      sessionStart: new Date().toISOString()
    };
    this.notifyListeners({ logs: this.state.logs, statistics: this.state.statistics });
  }

  setLogLevel(level) {
    if (this.state.logLevels.hasOwnProperty(level)) {
      this.state.logLevel = level;
      this.notifyListeners({ logLevel: level, filteredLogs: this.getFilteredLogs() });
    }
  }

  setSearchQuery(query) {
    this.state.searchQuery = query.toLowerCase();
    this.notifyListeners({ searchQuery: query, filteredLogs: this.getFilteredLogs() });
  }

  getFilteredLogs() {
    let filtered = this.state.logs;

    // Filter by log level
    const currentLevelValue = this.state.logLevels[this.state.logLevel];
    filtered = filtered.filter(log => {
      const logLevelValue = this.state.logLevels[log.level] || 0;
      return logLevelValue >= currentLevelValue;
    });

    // Filter by search query
    if (this.state.searchQuery) {
      filtered = filtered.filter(log => 
        log.message.toLowerCase().includes(this.state.searchQuery) ||
        (log.source && log.source.toLowerCase().includes(this.state.searchQuery)) ||
        (log.data && JSON.stringify(log.data).toLowerCase().includes(this.state.searchQuery))
      );
    }

    return filtered;
  }

  getLogsByContext(executionId, taskId = null) {
    return this.state.logs.filter(log => {
      if (!log.context) return false;
      
      const matchesExecution = log.context.executionId === executionId;
      const matchesTask = !taskId || log.context.taskId === taskId;
      
      return matchesExecution && matchesTask;
    });
  }

  setExecutionContext(context) {
    this.state.executionContext = { ...this.state.executionContext, ...context };
    this.notifyListeners({ executionContext: this.state.executionContext });
  }

  reset() {
    this.state = {
      logs: [],
      maxLogEntries: 1000,
      autoScroll: true,
      logLevel: 'info',
      searchQuery: '',
      isConsoleEnabled: true,
      executionContext: {
        executionId: null,
        taskId: null,
        planId: null
      },
      statistics: {
        totalLogs: 0,
        errorCount: 0,
        warningCount: 0,
        infoCount: 0,
        debugCount: 0,
        sessionStart: new Date().toISOString()
      },
      logLevels: {
        debug: 0,
        info: 1,
        warn: 2,
        error: 3
      }
    };
    this.notifyListeners(this.state);
  }
}

/**
 * View - Renders console display and handles DOM updates
 */
class ExecutionConsoleView {
  constructor(container, viewModel) {
    this.container = container;
    this.viewModel = viewModel;
    this.render();
  }

  render() {
    this.container.innerHTML = `
      <div class="execution-console-panel">
        <!-- Header with Controls -->
        <div class="console-header">
          <h3>Execution Console</h3>
          <div class="console-controls">
            <div class="log-level-controls">
              <label for="log-level-select">Level:</label>
              <select id="log-level-select" class="log-level-select">
                <option value="debug">Debug</option>
                <option value="info" selected>Info</option>
                <option value="warn">Warning</option>
                <option value="error">Error</option>
              </select>
            </div>
            <div class="search-controls">
              <input type="text" class="log-search-input" placeholder="Search logs...">
              <button class="clear-search-button">✕</button>
            </div>
            <div class="action-controls">
              <button class="auto-scroll-toggle active">📜 Auto-scroll</button>
              <button class="export-logs-button">📤 Export</button>
              <button class="clear-logs-button">🗑️ Clear</button>
            </div>
          </div>
        </div>

        <!-- Statistics Panel -->
        <div class="console-stats">
          <div class="stat-item">
            <span class="stat-label">Total:</span>
            <span class="stat-value total-logs">0</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">Errors:</span>
            <span class="stat-value error-count">0</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">Warnings:</span>
            <span class="stat-value warning-count">0</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">Session:</span>
            <span class="stat-value session-duration">00:00:00</span>
          </div>
        </div>

        <!-- Log Display Area -->
        <div class="console-log-display">
          <div class="log-entries-container"></div>
          
          <!-- Empty State -->
          <div class="console-empty-state" style="display: none;">
            <div class="empty-icon">📋</div>
            <div class="empty-message">No log entries</div>
            <div class="empty-hint">Execution logs will appear here during plan execution</div>
          </div>
        </div>

        <!-- Command Input -->
        <div class="console-command-area">
          <div class="command-input-container">
            <span class="command-prompt">></span>
            <input type="text" class="console-command-input" placeholder="Enter console command...">
            <button class="execute-command-button">Execute</button>
          </div>
          <div class="command-suggestions" style="display: none;">
            <div class="suggestion-item" data-command="clear">clear - Clear all logs</div>
            <div class="suggestion-item" data-command="export">export - Export logs to file</div>
            <div class="suggestion-item" data-command="level debug">level [debug|info|warn|error] - Set log level</div>
            <div class="suggestion-item" data-command="search">search [query] - Search logs</div>
          </div>
        </div>
      </div>
    `;
    
    this.bindEvents();
  }

  bindEvents() {
    // Log level selection
    const logLevelSelect = this.container.querySelector('.log-level-select');
    logLevelSelect.addEventListener('change', (e) => {
      this.viewModel.setLogLevel(e.target.value);
    });

    // Search functionality
    const searchInput = this.container.querySelector('.log-search-input');
    searchInput.addEventListener('input', (e) => {
      this.viewModel.setSearchQuery(e.target.value);
    });

    const clearSearchButton = this.container.querySelector('.clear-search-button');
    clearSearchButton.addEventListener('click', () => {
      searchInput.value = '';
      this.viewModel.setSearchQuery('');
    });

    // Auto-scroll toggle
    const autoScrollToggle = this.container.querySelector('.auto-scroll-toggle');
    autoScrollToggle.addEventListener('click', () => {
      const isActive = autoScrollToggle.classList.contains('active');
      autoScrollToggle.classList.toggle('active', !isActive);
      this.viewModel.setAutoScroll(!isActive);
    });

    // Action buttons
    const exportButton = this.container.querySelector('.export-logs-button');
    exportButton.addEventListener('click', () => {
      this.viewModel.exportLogs();
    });

    const clearButton = this.container.querySelector('.clear-logs-button');
    clearButton.addEventListener('click', () => {
      if (confirm('Clear all logs? This action cannot be undone.')) {
        this.viewModel.clearLogs();
      }
    });

    // Command input
    const commandInput = this.container.querySelector('.console-command-input');
    const executeButton = this.container.querySelector('.execute-command-button');
    
    const executeCommand = () => {
      const command = commandInput.value.trim();
      if (command) {
        this.viewModel.executeCommand(command);
        commandInput.value = '';
      }
    };

    executeButton.addEventListener('click', executeCommand);
    commandInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        executeCommand();
      }
    });

    // Command suggestions
    commandInput.addEventListener('focus', () => {
      this.showCommandSuggestions();
    });

    commandInput.addEventListener('blur', () => {
      setTimeout(() => this.hideCommandSuggestions(), 200);
    });

    // Command suggestion clicks
    const suggestions = this.container.querySelectorAll('.suggestion-item');
    suggestions.forEach(suggestion => {
      suggestion.addEventListener('click', () => {
        commandInput.value = suggestion.dataset.command;
        commandInput.focus();
      });
    });
  }

  updateLogDisplay(logs) {
    const container = this.container.querySelector('.log-entries-container');
    const emptyState = this.container.querySelector('.console-empty-state');

    if (logs.length === 0) {
      this.showEmptyState();
      return;
    }

    this.hideEmptyState();

    // Update log entries
    container.innerHTML = logs.map(log => `
      <div class="log-entry log-level-${log.level}" data-id="${log.id}">
        <div class="log-timestamp">${this.formatTimestamp(log.timestamp)}</div>
        <div class="log-level-badge">${log.level.toUpperCase()}</div>
        <div class="log-source">${log.source || 'system'}</div>
        <div class="log-message">${this.formatLogMessage(log.message)}</div>
        ${log.data ? `<div class="log-data">${this.formatLogData(log.data)}</div>` : ''}
        ${log.context ? `<div class="log-context" title="Execution: ${log.context.executionId}, Task: ${log.context.taskId || 'N/A'}">🔗</div>` : ''}
      </div>
    `).join('');

    // Auto-scroll to bottom if enabled
    if (this.viewModel.model.getState('autoScroll')) {
      this.scrollToBottom();
    }
  }

  scrollToBottom() {
    const container = this.container.querySelector('.log-entries-container');
    const lastEntry = container.lastElementChild;
    if (lastEntry) {
      lastEntry.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }

  updateStatsDisplay(stats) {
    this.container.querySelector('.total-logs').textContent = stats.totalLogs.toString();
    this.container.querySelector('.error-count').textContent = stats.errorCount.toString();
    this.container.querySelector('.warning-count').textContent = stats.warningCount.toString();
    
    // Update session duration
    const sessionStart = new Date(stats.sessionStart);
    const duration = Date.now() - sessionStart.getTime();
    this.container.querySelector('.session-duration').textContent = this.formatDuration(duration);
  }

  showEmptyState() {
    this.container.querySelector('.console-empty-state').style.display = 'flex';
    this.container.querySelector('.log-entries-container').style.display = 'none';
  }

  hideEmptyState() {
    this.container.querySelector('.console-empty-state').style.display = 'none';
    this.container.querySelector('.log-entries-container').style.display = 'block';
  }

  showCommandSuggestions() {
    this.container.querySelector('.command-suggestions').style.display = 'block';
  }

  hideCommandSuggestions() {
    this.container.querySelector('.command-suggestions').style.display = 'none';
  }

  formatTimestamp(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', { hour12: false });
  }

  formatLogMessage(message) {
    // Basic HTML escaping and line break handling
    return message
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\n/g, '<br>');
  }

  formatLogData(data) {
    if (typeof data === 'object') {
      return `<pre>${JSON.stringify(data, null, 2)}</pre>`;
    }
    return String(data);
  }

  formatDuration(milliseconds) {
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    return `${hours.toString().padStart(2, '0')}:${(minutes % 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;
  }
}

/**
 * ViewModel - Manages business logic and coordinates Model/View
 */
class ExecutionConsoleViewModel extends StandardizedComponentAPI {
  constructor(model, view, umbilical) {
    super(model, view, umbilical, 'ExecutionConsole');
    
    this.view = view;
    
    // Listen to model changes
    this.model.addListener(this.onModelChange.bind(this));
  }

  getComponentSpecificMethods() {
    return {
      // === LOG MANAGEMENT ===
      addLogEntry: this.addLogEntry.bind(this),
      clearLogs: this.clearLogs.bind(this),
      getLogs: () => this.model.getState('logs'),
      getFilteredLogs: () => this.model.getFilteredLogs(),
      
      // === FILTERING AND SEARCHING ===
      setLogLevel: this.setLogLevel.bind(this),
      getLogLevel: () => this.model.getState('logLevel'),
      setSearchQuery: this.setSearchQuery.bind(this),
      getSearchQuery: () => this.model.getState('searchQuery'),
      searchLogs: this.searchLogs.bind(this),
      
      // === CONTEXT MANAGEMENT ===
      setExecutionContext: this.setExecutionContext.bind(this),
      getExecutionContext: () => this.model.getState('executionContext'),
      getLogsByContext: this.getLogsByContext.bind(this),
      
      // === CONSOLE SETTINGS ===
      setAutoScroll: this.setAutoScroll.bind(this),
      getAutoScroll: () => this.model.getState('autoScroll'),
      setMaxLogEntries: this.setMaxLogEntries.bind(this),
      getMaxLogEntries: () => this.model.getState('maxLogEntries'),
      setConsoleEnabled: this.setConsoleEnabled.bind(this),
      isConsoleEnabled: () => this.model.getState('isConsoleEnabled'),
      
      // === COMMANDS AND OPERATIONS ===
      executeCommand: this.executeCommand.bind(this),
      exportLogs: this.exportLogs.bind(this),
      
      // === STATISTICS ===
      getExecutionStatistics: () => this.model.getState('statistics')
    };
  }

  getComponentSpecificValidationErrors() {
    const errors = [];
    
    const logs = this.model.getState('logs');
    if (logs.some(log => !log.level || !log.message)) {
      errors.push('Some log entries have missing required fields');
    }
    
    const maxLogEntries = this.model.getState('maxLogEntries');
    if (maxLogEntries < 1 || maxLogEntries > 10000) {
      errors.push('Maximum log entries must be between 1 and 10000');
    }
    
    return errors;
  }

  onModelChange(changes) {
    if ('logs' in changes || 'searchQuery' in changes || 'logLevel' in changes) {
      const filteredLogs = this.model.getFilteredLogs();
      this.view.updateLogDisplay(filteredLogs);
    }
    
    if ('statistics' in changes) {
      this.view.updateStatsDisplay(changes.statistics);
    }
  }

  addLogEntry(logEntry) {
    // Validate log entry
    if (!logEntry || typeof logEntry !== 'object' || !logEntry.level || !logEntry.message) {
      return APIResponse.error('Invalid log entry: missing level or message');
    }

    const validLevels = ['debug', 'info', 'warn', 'error'];
    if (!validLevels.includes(logEntry.level)) {
      return APIResponse.error(`Invalid log level: ${logEntry.level}`);
    }

    this.model.addLogEntry(logEntry);
    
    if (this.umbilical.onLogUpdate) {
      this.umbilical.onLogUpdate({ action: 'add', logEntry });
    }
    
    return APIResponse.success(logEntry);
  }

  clearLogs() {
    this.model.clearLogs();
    
    if (this.umbilical.onLogUpdate) {
      this.umbilical.onLogUpdate({ action: 'clear' });
    }
    
    return APIResponse.success({ message: 'All logs cleared' });
  }

  setLogLevel(level) {
    const validLevels = ['debug', 'info', 'warn', 'error'];
    if (!validLevels.includes(level)) {
      return APIResponse.error(`Invalid log level: ${level}`);
    }
    
    this.model.setLogLevel(level);
    return APIResponse.success({ logLevel: level });
  }

  setSearchQuery(query) {
    this.model.setSearchQuery(query);
    return APIResponse.success({ searchQuery: query });
  }

  searchLogs(query) {
    this.model.setSearchQuery(query);
    const results = this.model.getFilteredLogs();
    return APIResponse.success(results);
  }

  setExecutionContext(context) {
    this.model.setExecutionContext(context);
    return APIResponse.success(context);
  }

  getLogsByContext(executionId, taskId = null) {
    const logs = this.model.getLogsByContext(executionId, taskId);
    return APIResponse.success(logs);
  }

  setAutoScroll(enabled) {
    this.model.updateState('autoScroll', enabled);
    return APIResponse.success({ autoScroll: enabled });
  }

  setMaxLogEntries(maxEntries) {
    if (maxEntries < 1 || maxEntries > 10000) {
      return APIResponse.error('Maximum log entries must be between 1 and 10000');
    }
    
    this.model.updateState('maxLogEntries', maxEntries);
    return APIResponse.success({ maxLogEntries: maxEntries });
  }

  setConsoleEnabled(enabled) {
    this.model.updateState('isConsoleEnabled', enabled);
    return APIResponse.success({ consoleEnabled: enabled });
  }

  executeCommand(command) {
    const timestamp = new Date().toISOString();
    
    // Handle built-in commands
    const [cmd, ...args] = command.split(' ');
    
    switch (cmd.toLowerCase()) {
      case 'clear':
        this.clearLogs();
        break;
      case 'export':
        this.exportLogs();
        break;
      case 'level':
        if (args.length > 0) {
          this.setLogLevel(args[0]);
        }
        break;
      case 'search':
        if (args.length > 0) {
          this.setSearchQuery(args.join(' '));
        }
        break;
      default:
        // Log the command execution
        this.addLogEntry({
          level: 'info',
          message: `Executed command: ${command}`,
          source: 'console',
          timestamp
        });
    }
    
    if (this.umbilical.onConsoleCommand) {
      this.umbilical.onConsoleCommand({ command, timestamp });
    }
    
    return APIResponse.success({ command, executed: true });
  }

  exportLogs() {
    try {
      const logs = this.model.getState('logs');
      const stats = this.model.getState('statistics');
      const context = this.model.getState('executionContext');
      
      const exportData = {
        logs,
        statistics: stats,
        executionContext: context,
        exportedAt: new Date().toISOString(),
        totalEntries: logs.length
      };

      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.download = `execution-logs-${Date.now()}.json`;
      link.href = url;
      link.click();
      URL.revokeObjectURL(url);

      return APIResponse.success({ exported: logs.length });
    } catch (error) {
      return APIResponse.error(`Failed to export logs: ${error.message}`);
    }
  }
}

/**
 * ExecutionConsole - Main component class
 */
export class ExecutionConsole {
  static async create(umbilical) {
    // Validate umbilical
    UmbilicalUtils.validateCapabilities(umbilical, ['dom'], 'ExecutionConsole');
    
    // Create MVVM components
    const model = new ExecutionConsoleModel();
    const view = new ExecutionConsoleView(umbilical.dom, null);
    const viewModel = new ExecutionConsoleViewModel(model, view, umbilical);
    
    // Set view's reference to viewModel
    view.viewModel = viewModel;
    
    return viewModel;
  }
}