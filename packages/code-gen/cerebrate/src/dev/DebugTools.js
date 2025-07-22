/**
 * Debug Tools for Cerebrate Development
 * Provides logging, performance monitoring, memory tracking, and debugging utilities
 */
import { EventEmitter } from 'events';

export class DebugTools extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = {
      enabled: false,
      logLevel: 'info',
      persistLogs: false,
      maxLogs: 1000,
      maxErrors: 100,
      memoryMonitorInterval: 5000,
      ...config
    };
    
    // Storage
    this.logs = [];
    this.errors = [];
    this.performance = [];
    this.memoryHistory = [];
    this.apiCalls = [];
    
    // State
    this.timers = new Map();
    this.memoryMonitorTimer = null;
    
    // Log levels
    this.logLevels = {
      debug: 0,
      info: 1,
      warn: 2,
      error: 3
    };
  }
  
  /**
   * Check if debugging is enabled
   * @returns {boolean} - Is enabled
   */
  isEnabled() {
    return this.config.enabled;
  }
  
  /**
   * Enable debugging
   */
  enable() {
    this.config.enabled = true;
    this.log('info', 'Debug tools enabled');
  }
  
  /**
   * Disable debugging
   */
  disable() {
    this.config.enabled = false;
    this.stopMemoryMonitoring();
  }
  
  /**
   * Set log level
   * @param {string} level - Log level
   */
  setLogLevel(level) {
    if (!this.logLevels.hasOwnProperty(level)) {
      throw new Error(`Invalid log level: ${level}. Valid levels: ${Object.keys(this.logLevels).join(', ')}`);
    }
    
    this.config.logLevel = level;
  }
  
  /**
   * Log debug message
   * @param {string} message - Log message
   * @param {Object} context - Additional context
   */
  debug(message, context = {}) {
    this.log('debug', message, context);
  }
  
  /**
   * Log info message
   * @param {string} message - Log message
   * @param {Object} context - Additional context
   */
  info(message, context = {}) {
    this.log('info', message, context);
  }
  
  /**
   * Log warning message
   * @param {string} message - Log message
   * @param {Object} context - Additional context
   */
  warn(message, context = {}) {
    this.log('warn', message, context);
  }
  
  /**
   * Log error message
   * @param {string} message - Log message
   * @param {Object} context - Additional context
   */
  error(message, context = {}) {
    this.log('error', message, context);
  }
  
  /**
   * Log message with level
   * @param {string} level - Log level
   * @param {string} message - Log message
   * @param {Object} context - Additional context
   * @private
   */
  log(level, message, context = {}) {
    if (!this.config.enabled) return;
    
    const currentLevelValue = this.logLevels[this.config.logLevel];
    const messageLevelValue = this.logLevels[level];
    
    if (messageLevelValue < currentLevelValue) return;
    
    const logEntry = {
      level,
      message,
      context,
      timestamp: new Date().toISOString(),
      id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    };
    
    this.logs.push(logEntry);
    
    // Limit log size
    if (this.logs.length > this.config.maxLogs) {
      this.logs = this.logs.slice(-this.config.maxLogs);
    }
    
    // Emit log event
    this.emit('log', logEntry);
  }
  
  /**
   * Register log handler
   * @param {Function} handler - Log handler
   */
  onLog(handler) {
    this.on('log', handler);
  }
  
  /**
   * Start performance timer
   * @param {string} name - Timer name
   * @returns {Object} - Timer object
   */
  startTimer(name) {
    const startTime = Date.now();
    
    const timer = {
      name,
      startTime,
      end: () => {
        const endTime = Date.now();
        const duration = endTime - startTime;
        
        const performanceEntry = {
          name,
          startTime,
          endTime,
          duration,
          timestamp: new Date(startTime).toISOString()
        };
        
        this.performance.push(performanceEntry);
        this.timers.delete(name);
        
        return performanceEntry;
      }
    };
    
    this.timers.set(name, timer);
    return timer;
  }
  
  /**
   * Get performance summary
   * @returns {Object} - Performance summary
   */
  getPerformanceSummary() {
    const operations = [...this.performance];
    const totalOperations = operations.length;
    
    if (totalOperations === 0) {
      return {
        totalOperations: 0,
        operations: [],
        averageDuration: 0
      };
    }
    
    const totalDuration = operations.reduce((sum, op) => sum + op.duration, 0);
    const averageDuration = totalDuration / totalOperations;
    
    return {
      totalOperations,
      operations: operations.sort((a, b) => a.startTime - b.startTime),
      averageDuration: Math.round(averageDuration * 100) / 100,
      totalDuration
    };
  }
  
  /**
   * Capture memory snapshot
   * @returns {Object} - Memory snapshot
   */
  captureMemorySnapshot() {
    const memoryUsage = process.memoryUsage();
    
    const snapshot = {
      heapUsed: memoryUsage.heapUsed,
      heapTotal: memoryUsage.heapTotal,
      external: memoryUsage.external,
      rss: memoryUsage.rss,
      timestamp: new Date().toISOString()
    };
    
    this.memoryHistory.push(snapshot);
    
    // Limit history size
    if (this.memoryHistory.length > 1000) {
      this.memoryHistory = this.memoryHistory.slice(-1000);
    }
    
    return snapshot;
  }
  
  /**
   * Start memory monitoring
   * @param {number} interval - Monitor interval in ms
   */
  startMemoryMonitoring(interval = null) {
    if (this.memoryMonitorTimer) {
      this.stopMemoryMonitoring();
    }
    
    const monitorInterval = interval || this.config.memoryMonitorInterval;
    
    this.memoryMonitorTimer = setInterval(() => {
      this.captureMemorySnapshot();
    }, monitorInterval);
  }
  
  /**
   * Stop memory monitoring
   */
  stopMemoryMonitoring() {
    if (this.memoryMonitorTimer) {
      clearInterval(this.memoryMonitorTimer);
      this.memoryMonitorTimer = null;
    }
  }
  
  /**
   * Check if memory monitoring is active
   * @returns {boolean} - Is monitoring
   */
  isMonitoringMemory() {
    return this.memoryMonitorTimer !== null;
  }
  
  /**
   * Get memory statistics
   * @returns {Object} - Memory statistics
   */
  getMemoryStatistics() {
    if (this.memoryHistory.length === 0) {
      return {
        current: null,
        min: 0,
        max: 0,
        average: 0,
        samples: 0
      };
    }
    
    const heapUsedValues = this.memoryHistory.map(snapshot => snapshot.heapUsed);
    const min = Math.min(...heapUsedValues);
    const max = Math.max(...heapUsedValues);
    const average = Math.round((heapUsedValues.reduce((sum, val) => sum + val, 0) / heapUsedValues.length) * 100) / 100;
    
    return {
      current: this.memoryHistory[this.memoryHistory.length - 1],
      min,
      max,
      average,
      samples: this.memoryHistory.length,
      history: this.memoryHistory
    };
  }
  
  /**
   * Capture extension state
   * @returns {Object} - Extension state
   */
  captureExtensionState() {
    return {
      manifest: {
        name: 'Cerebrate Extension',
        version: '1.0.0',
        manifest_version: 3
      },
      permissions: ['activeTab', 'storage', 'debugger'],
      background: {
        service_worker: 'background.js',
        type: 'module'
      },
      contentScripts: [
        {
          matches: ['<all_urls>'],
          js: ['content.js']
        }
      ],
      timestamp: new Date().toISOString()
    };
  }
  
  /**
   * Log Chrome API call
   * @param {string} api - API name
   * @param {Object} params - API parameters
   * @param {Object} result - API result
   */
  logApiCall(api, params = {}, result = {}) {
    if (!this.config.enabled) return;
    
    const apiCall = {
      api,
      params,
      result,
      timestamp: new Date().toISOString(),
      id: `api-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    };
    
    this.apiCalls.push(apiCall);
    
    // Limit API call history
    if (this.apiCalls.length > 1000) {
      this.apiCalls = this.apiCalls.slice(-1000);
    }
    
    this.emit('apiCall', apiCall);
  }
  
  /**
   * Register API call handler
   * @param {Function} handler - API call handler
   */
  onApiCall(handler) {
    this.on('apiCall', handler);
  }
  
  /**
   * Capture error
   * @param {Error} error - Error object
   * @param {Object} context - Error context
   */
  captureError(error, context = {}) {
    const errorEntry = {
      message: error.message,
      stack: error.stack,
      name: error.name,
      context,
      timestamp: new Date().toISOString(),
      id: `error-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    };
    
    this.errors.push(errorEntry);
    
    // Limit error history
    if (this.errors.length > this.config.maxErrors) {
      this.errors = this.errors.slice(-this.config.maxErrors);
    }
    
    this.emit('error', errorEntry);
  }
  
  /**
   * Register error handler
   * @param {Function} handler - Error handler
   */
  onError(handler) {
    this.on('error', handler);
  }
  
  /**
   * Get error statistics
   * @returns {Object} - Error statistics
   */
  getErrorStatistics() {
    const total = this.errors.length;
    
    if (total === 0) {
      return {
        total: 0,
        byComponent: {},
        recent: []
      };
    }
    
    const byComponent = {};
    for (const error of this.errors) {
      const component = error.context?.component || 'unknown';
      byComponent[component] = (byComponent[component] || 0) + 1;
    }
    
    const recent = this.errors
      .slice(-10)
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    return {
      total,
      byComponent,
      recent
    };
  }
  
  /**
   * Clear logs
   */
  clearLogs() {
    this.logs = [];
  }
  
  /**
   * Clear all data
   */
  clearAll() {
    this.logs = [];
    this.errors = [];
    this.performance = [];
    this.memoryHistory = [];
    this.apiCalls = [];
    this.timers.clear();
  }
  
  /**
   * Export logs to different formats
   * @param {string} format - Export format (json, text, csv)
   * @returns {string} - Exported data
   */
  exportLogs(format = 'json') {
    switch (format) {
      case 'json':
        return JSON.stringify(this.logs, null, 2);
        
      case 'text':
        return this.logs
          .map(log => `[${log.timestamp}] ${log.level.toUpperCase()}: ${log.message}`)
          .join('\n');
          
      case 'csv':
        const header = 'timestamp,level,message,context\n';
        const rows = this.logs
          .map(log => `"${log.timestamp}","${log.level}","${log.message}","${JSON.stringify(log.context)}"`)
          .join('\n');
        return header + rows;
        
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }
  
  /**
   * Generate debugging report
   * @returns {Object} - Debug report
   */
  generateReport() {
    return {
      logs: this.logs,
      errors: this.errors,
      performance: this.getPerformanceSummary(),
      memory: this.getMemoryStatistics(),
      extension: this.captureExtensionState(),
      apiCalls: this.apiCalls,
      config: this.config,
      generatedAt: new Date().toISOString(),
      summary: {
        totalLogs: this.logs.length,
        totalErrors: this.errors.length,
        totalApiCalls: this.apiCalls.length,
        memorySnapshots: this.memoryHistory.length
      }
    };
  }
  
  /**
   * Save report to file (simulation)
   * @param {string} format - Report format
   * @returns {Object} - Save result
   */
  saveReport(format = 'json') {
    const report = this.generateReport();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `cerebrate-debug-report-${timestamp}.${format}`;
    
    let content;
    switch (format) {
      case 'json':
        content = JSON.stringify(report, null, 2);
        break;
      case 'text':
        content = this.formatReportAsText(report);
        break;
      default:
        throw new Error(`Unsupported report format: ${format}`);
    }
    
    return {
      success: true,
      filename,
      size: content.length,
      format
    };
  }
  
  /**
   * Format report as text
   * @param {Object} report - Report object
   * @returns {string} - Formatted text
   * @private
   */
  formatReportAsText(report) {
    const lines = [];
    lines.push('# Cerebrate Debug Report');
    lines.push(`Generated: ${report.generatedAt}`);
    lines.push('');
    
    lines.push('## Summary');
    lines.push(`Total Logs: ${report.summary.totalLogs}`);
    lines.push(`Total Errors: ${report.summary.totalErrors}`);
    lines.push(`Total API Calls: ${report.summary.totalApiCalls}`);
    lines.push('');
    
    if (report.errors.length > 0) {
      lines.push('## Recent Errors');
      report.errors.slice(-5).forEach(error => {
        lines.push(`[${error.timestamp}] ${error.message}`);
      });
      lines.push('');
    }
    
    if (report.performance.totalOperations > 0) {
      lines.push('## Performance');
      lines.push(`Total Operations: ${report.performance.totalOperations}`);
      lines.push(`Average Duration: ${report.performance.averageDuration}ms`);
      lines.push('');
    }
    
    return lines.join('\n');
  }
}