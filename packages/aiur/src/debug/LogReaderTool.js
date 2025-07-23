/**
 * LogReaderTool - MCP tool for reading and searching log files
 * 
 * Provides tools to read error logs, search for patterns, and get log statistics.
 */

export class LogReaderTool {
  constructor(logManager) {
    this.logManager = logManager;
  }

  /**
   * Static async factory method
   */
  static async create(resourceManager) {
    const logManager = resourceManager.get('logManager');
    if (!logManager) {
      throw new Error('LogManager not found in ResourceManager');
    }
    
    return new LogReaderTool(logManager);
  }

  /**
   * Get tool definitions for MCP
   */
  getToolDefinitions() {
    return [
      {
        name: 'read_logs',
        description: 'Read recent log entries with optional filtering',
        inputSchema: {
          type: 'object',
          properties: {
            limit: {
              type: 'number',
              description: 'Maximum number of log entries to return',
              default: 100
            },
            level: {
              type: 'string',
              description: 'Filter by log level (error, warning, info)',
              enum: ['error', 'warning', 'info', 'critical']
            },
            startTime: {
              type: 'string',
              description: 'Start time for log filtering (ISO 8601 format)'
            },
            endTime: {
              type: 'string',
              description: 'End time for log filtering (ISO 8601 format)'
            },
            search: {
              type: 'string',
              description: 'Search term to filter log messages'
            }
          }
        }
      },
      {
        name: 'get_log_stats',
        description: 'Get statistics about logged errors and warnings',
        inputSchema: {
          type: 'object',
          properties: {}
        }
      },
      {
        name: 'clear_old_logs',
        description: 'Manually trigger cleanup of old log files',
        inputSchema: {
          type: 'object',
          properties: {}
        }
      }
    ];
  }

  /**
   * Execute log reader tool
   */
  async executeLogTool(toolName, args) {
    try {
      switch (toolName) {
        case 'read_logs':
          return await this.readLogs(args);
        
        case 'get_log_stats':
          return await this.getLogStats();
        
        case 'clear_old_logs':
          return await this.clearOldLogs();
        
        default:
          throw new Error(`Unknown log tool: ${toolName}`);
      }
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            success: false,
            error: error.message
          }, null, 2)
        }],
        isError: true
      };
    }
  }

  /**
   * Read recent logs
   */
  async readLogs(args) {
    const { limit = 100, level, startTime, endTime, search } = args;
    
    try {
      let logs = await this.logManager.getRecentLogs({
        limit,
        level,
        startTime,
        endTime
      });
      
      // Apply search filter if provided
      if (search) {
        const searchLower = search.toLowerCase();
        logs = logs.filter(log => {
          const message = (log.message || '').toLowerCase();
          const source = (log.source || '').toLowerCase();
          const errorType = (log.errorType || '').toLowerCase();
          
          return message.includes(searchLower) ||
                 source.includes(searchLower) ||
                 errorType.includes(searchLower);
        });
      }
      
      // Format logs for display
      const formattedLogs = logs.map(log => ({
        timestamp: log.timestamp,
        level: log.level,
        message: log.message,
        source: log.source,
        errorType: log.errorType,
        context: log.context
      }));
      
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            success: true,
            count: formattedLogs.length,
            logs: formattedLogs
          }, null, 2)
        }]
      };
      
    } catch (error) {
      throw new Error(`Failed to read logs: ${error.message}`);
    }
  }

  /**
   * Get log statistics
   */
  async getLogStats() {
    try {
      const stats = this.logManager.getStats();
      const recentErrors = await this.logManager.getRecentLogs({
        limit: 10,
        level: 'error'
      });
      
      const errorTypes = {};
      const errorSources = {};
      
      // Analyze recent errors
      for (const log of recentErrors) {
        if (log.errorType) {
          errorTypes[log.errorType] = (errorTypes[log.errorType] || 0) + 1;
        }
        if (log.source) {
          errorSources[log.source] = (errorSources[log.source] || 0) + 1;
        }
      }
      
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            success: true,
            stats: {
              ...stats,
              recentErrorTypes: errorTypes,
              recentErrorSources: errorSources,
              logDirectory: this.logManager.logDirectory,
              fileLoggingEnabled: this.logManager.enableFileLogging
            }
          }, null, 2)
        }]
      };
      
    } catch (error) {
      throw new Error(`Failed to get log stats: ${error.message}`);
    }
  }

  /**
   * Clear old logs
   */
  async clearOldLogs() {
    try {
      await this.logManager.cleanupOldLogs();
      
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            success: true,
            message: 'Old log files cleaned up successfully'
          }, null, 2)
        }]
      };
      
    } catch (error) {
      throw new Error(`Failed to clear old logs: ${error.message}`);
    }
  }

  /**
   * Check if a tool is a log reader tool
   */
  isLogTool(toolName) {
    const logTools = ['read_logs', 'get_log_stats', 'clear_old_logs'];
    return logTools.includes(toolName);
  }
}