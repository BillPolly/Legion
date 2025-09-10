/**
 * ObservabilityService - Real-time monitoring and tracking of agent behavior
 * Provides complete visibility into tool execution, file creation, and agent state
 */

import { promises as fs } from 'fs';
import { watch } from 'fs';
import path from 'path';

/**
 * Event types for observability
 */
export const ObservabilityEvents = {
  TOOL_STARTED: 'tool_started',
  TOOL_PROGRESS: 'tool_progress', 
  TOOL_COMPLETED: 'tool_completed',
  TOOL_FAILED: 'tool_failed',
  FILE_CREATED: 'file_created',
  FILE_MODIFIED: 'file_modified',
  DIRECTORY_CREATED: 'directory_created',
  CONVERSATION_UPDATE: 'conversation_update',
  AGENT_STATUS: 'agent_status'
};

/**
 * Service for comprehensive agent observability
 */
export class ObservabilityService {
  constructor() {
    this.events = [];
    this.activeExecutions = new Map(); // executionId -> execution info
    this.fileWatchers = new Map(); // directory -> watcher
    this.websocketClients = new Set(); // Connected WebSocket clients
    this.maxEvents = 1000;
    
    // Execution tracking
    this.executionHistory = [];
    this.performanceMetrics = {
      totalExecutions: 0,
      averageExecutionTime: 0,
      successRate: 0,
      toolUsageStats: {}
    };
    
    console.log('🔍 ObservabilityService initialized');
  }

  /**
   * Add WebSocket client for real-time updates
   * @param {WebSocket} ws - WebSocket client
   */
  addWebSocketClient(ws) {
    this.websocketClients.add(ws);
    
    ws.on('close', () => {
      this.websocketClients.delete(ws);
    });
    
    // Send current status immediately
    this._sendEvent(ws, {
      type: ObservabilityEvents.AGENT_STATUS,
      data: this.getSystemStatus()
    });
    
    console.log('🔗 WebSocket client connected to observability');
  }

  /**
   * Track tool execution start
   * @param {string} toolName - Tool being executed
   * @param {Object} args - Tool arguments
   * @param {string} executionId - Unique execution ID
   */
  trackToolStart(toolName, args, executionId) {
    const execution = {
      id: executionId,
      toolName,
      args,
      startTime: Date.now(),
      status: 'running',
      filesToCreate: this._extractFilePathsFromArgs(args)
    };
    
    this.activeExecutions.set(executionId, execution);
    
    const event = {
      type: ObservabilityEvents.TOOL_STARTED,
      timestamp: Date.now(),
      executionId,
      toolName,
      args: this._sanitizeArgs(args),
      expectedFiles: execution.filesToCreate
    };
    
    this._addEvent(event);
    this._broadcastEvent(event);
    
    console.log(`🔧 [${executionId}] Tool started: ${toolName}`);
    
    // Start watching for files this tool might create
    if (execution.filesToCreate.length > 0) {
      this._watchForFiles(execution.filesToCreate, executionId);
    }
  }

  /**
   * Track tool execution completion
   * @param {string} executionId - Execution ID
   * @param {Object} result - Tool result
   * @param {Error} error - Error if failed
   */
  trackToolComplete(executionId, result = null, error = null) {
    const execution = this.activeExecutions.get(executionId);
    if (!execution) return;
    
    const endTime = Date.now();
    const duration = endTime - execution.startTime;
    
    execution.endTime = endTime;
    execution.duration = duration;
    execution.result = result;
    execution.error = error;
    execution.status = error ? 'failed' : 'success';
    
    // Move to history
    this.activeExecutions.delete(executionId);
    this.executionHistory.push(execution);
    
    // Update metrics
    this._updateMetrics(execution);
    
    const event = {
      type: error ? ObservabilityEvents.TOOL_FAILED : ObservabilityEvents.TOOL_COMPLETED,
      timestamp: endTime,
      executionId,
      toolName: execution.toolName,
      duration,
      success: !error,
      result: this._sanitizeResult(result),
      error: error?.message,
      filesCreated: execution.filesCreated || []
    };
    
    this._addEvent(event);
    this._broadcastEvent(event);
    
    console.log(`${error ? '❌' : '✅'} [${executionId}] Tool ${error ? 'failed' : 'completed'}: ${execution.toolName} (${duration}ms)`);
  }

  /**
   * Track file creation/modification
   * @param {string} filePath - File that was created/modified
   * @param {string} operation - Operation type (created, modified)
   * @param {string} executionId - Related execution ID
   */
  trackFileChange(filePath, operation, executionId = null) {
    const event = {
      type: operation === 'created' ? ObservabilityEvents.FILE_CREATED : ObservabilityEvents.FILE_MODIFIED,
      timestamp: Date.now(),
      filePath,
      operation,
      executionId,
      size: null,
      relativePath: path.relative(process.cwd(), filePath)
    };
    
    // Get file size
    fs.stat(filePath).then(stats => {
      event.size = stats.size;
      event.modified = stats.mtime;
    }).catch(() => {});
    
    // Update execution tracking
    if (executionId && this.activeExecutions.has(executionId)) {
      const execution = this.activeExecutions.get(executionId);
      execution.filesCreated = execution.filesCreated || [];
      execution.filesCreated.push(filePath);
    }
    
    this._addEvent(event);
    this._broadcastEvent(event);
    
    console.log(`📄 [${executionId || 'unknown'}] File ${operation}: ${path.basename(filePath)}`);
  }

  /**
   * Get current system status
   * @returns {Object} System status
   */
  getSystemStatus() {
    return {
      activeExecutions: this.activeExecutions.size,
      totalEvents: this.events.length,
      recentExecutions: this.executionHistory.slice(-5),
      performanceMetrics: this.performanceMetrics,
      watchedDirectories: this.fileWatchers.size,
      connectedClients: this.websocketClients.size,
      memoryUsage: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + 'MB'
    };
  }

  /**
   * Get recent events for dashboard
   * @param {number} limit - Number of recent events
   * @returns {Array} Recent events
   */
  getRecentEvents(limit = 20) {
    return this.events.slice(-limit);
  }

  /**
   * Get active tool executions
   * @returns {Array} Currently running tools
   */
  getActiveExecutions() {
    return Array.from(this.activeExecutions.values());
  }

  /**
   * Extract file paths from tool arguments
   * @param {Object} args - Tool arguments
   * @returns {Array} Potential file paths
   * @private
   */
  _extractFilePathsFromArgs(args) {
    const paths = [];
    
    if (args.absolute_path) paths.push(args.absolute_path);
    if (args.path && args.path.startsWith('/')) paths.push(args.path);
    if (args.paths && Array.isArray(args.paths)) paths.push(...args.paths);
    
    return paths;
  }

  /**
   * Watch for file creation/modification
   * @param {Array} filePaths - Files to watch for
   * @param {string} executionId - Related execution ID
   * @private
   */
  _watchForFiles(filePaths, executionId) {
    for (const filePath of filePaths) {
      const dir = path.dirname(filePath);
      
      // Watch the directory for changes
      if (!this.fileWatchers.has(dir)) {
        try {
          const watcher = watch(dir, { persistent: false }, (eventType, filename) => {
            if (filename && eventType === 'rename') {
              const fullPath = path.join(dir, filename);
              
              // Check if this is the file we're expecting
              if (filePaths.some(expected => expected.endsWith(filename))) {
                // Verify file actually exists (create vs delete)
                fs.access(fullPath).then(() => {
                  this.trackFileChange(fullPath, 'created', executionId);
                }).catch(() => {
                  // File was deleted, not created
                });
              }
            }
          });
          
          this.fileWatchers.set(dir, watcher);
          
          // Auto-cleanup watcher after 30 seconds
          setTimeout(() => {
            if (this.fileWatchers.has(dir)) {
              watcher.close();
              this.fileWatchers.delete(dir);
            }
          }, 30000);
          
        } catch (error) {
          console.warn('Failed to watch directory:', dir, error.message);
        }
      }
    }
  }

  /**
   * Add event to history
   * @param {Object} event - Event to add
   * @private
   */
  _addEvent(event) {
    this.events.push(event);
    
    // Maintain event history size
    if (this.events.length > this.maxEvents) {
      this.events = this.events.slice(-this.maxEvents);
    }
  }

  /**
   * Broadcast event to all connected WebSocket clients
   * @param {Object} event - Event to broadcast
   * @private
   */
  _broadcastEvent(event) {
    const message = JSON.stringify({
      type: 'observability_event',
      event
    });
    
    for (const ws of this.websocketClients) {
      try {
        if (ws.readyState === 1) { // WebSocket.OPEN
          ws.send(message);
        }
      } catch (error) {
        // Remove failed connections
        this.websocketClients.delete(ws);
      }
    }
  }

  /**
   * Send event to specific client
   * @param {WebSocket} ws - WebSocket client
   * @param {Object} event - Event to send
   * @private
   */
  _sendEvent(ws, event) {
    try {
      if (ws.readyState === 1) {
        ws.send(JSON.stringify({
          type: 'observability_event',
          event
        }));
      }
    } catch (error) {
      this.websocketClients.delete(ws);
    }
  }

  /**
   * Sanitize arguments for display
   * @param {Object} args - Tool arguments
   * @returns {Object} Sanitized arguments
   * @private
   */
  _sanitizeArgs(args) {
    const sanitized = { ...args };
    
    // Truncate long content for display
    if (sanitized.content && sanitized.content.length > 200) {
      sanitized.content = sanitized.content.substring(0, 200) + '...';
    }
    
    return sanitized;
  }

  /**
   * Sanitize result for display
   * @param {Object} result - Tool result
   * @returns {Object} Sanitized result
   * @private
   */
  _sanitizeResult(result) {
    if (!result) return null;
    
    const sanitized = { ...result };
    
    // Remove large data from display
    if (sanitized.data && typeof sanitized.data === 'object') {
      sanitized.data = { ...sanitized.data };
      if (sanitized.data.content && sanitized.data.content.length > 200) {
        sanitized.data.content = '[Content truncated for display]';
      }
    }
    
    return sanitized;
  }

  /**
   * Update performance metrics
   * @param {Object} execution - Completed execution
   * @private
   */
  _updateMetrics(execution) {
    this.performanceMetrics.totalExecutions++;
    
    // Update average execution time
    const totalTime = this.executionHistory.reduce((sum, exec) => sum + (exec.duration || 0), 0);
    this.performanceMetrics.averageExecutionTime = Math.round(totalTime / this.executionHistory.length);
    
    // Update success rate
    const successCount = this.executionHistory.filter(exec => exec.status === 'success').length;
    this.performanceMetrics.successRate = Math.round((successCount / this.executionHistory.length) * 100);
    
    // Update tool usage stats
    this.performanceMetrics.toolUsageStats[execution.toolName] = 
      (this.performanceMetrics.toolUsageStats[execution.toolName] || 0) + 1;
  }

  /**
   * Clear all tracking data (for testing)
   */
  clearTrackingData() {
    this.events = [];
    this.activeExecutions.clear();
    this.executionHistory = [];
    
    // Close all file watchers
    for (const watcher of this.fileWatchers.values()) {
      watcher.close();
    }
    this.fileWatchers.clear();
    
    console.log('🧹 Observability tracking data cleared');
  }
}

export default ObservabilityService;