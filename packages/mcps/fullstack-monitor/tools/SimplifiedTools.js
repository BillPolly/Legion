/**
 * SimplifiedTools - Streamlined MCP tools focused on app debugging
 */

export class SimplifiedTools {
  constructor(sessionManager) {
    this.sessionManager = sessionManager;
  }
  
  /**
   * Get tool definitions for MCP
   */
  getToolDefinitions() {
    return [
      {
        name: 'start_app',
        description: 'Start a Node.js application with automatic monitoring',
        inputSchema: {
          type: 'object',
          properties: {
            script: { 
              type: 'string', 
              description: 'Path to your Node.js app (e.g., server.js)' 
            },
            wait_for_port: { 
              type: 'number', 
              description: 'Port to wait for before considering app ready' 
            },
            log_level: {
              type: 'string',
              enum: ['error', 'warn', 'info', 'debug', 'trace'],
              default: 'info',
              description: 'Initial logging verbosity'
            },
            session_id: {
              type: 'string',
              description: 'Optional session ID',
              default: 'default'
            }
          },
          required: ['script']
        }
      },
      
      {
        name: 'query_logs',
        description: 'Search and filter application logs and system events',
        inputSchema: {
          type: 'object',
          properties: {
            query: { 
              type: 'string', 
              description: 'Text to search for' 
            },
            request_id: { 
              type: 'string', 
              description: 'Filter by specific request ID' 
            },
            level: { 
              type: 'string',
              enum: ['error', 'warn', 'info', 'debug', 'trace'],
              description: 'Minimum log level to include'
            },
            include_system: {
              type: 'boolean',
              default: true,
              description: 'Include Sidewinder instrumentation events'
            },
            last: { 
              type: 'string', 
              description: 'Time range (e.g., "5m", "1h")' 
            },
            limit: {
              type: 'number',
              default: 100,
              description: 'Maximum number of results'
            },
            session_id: {
              type: 'string',
              description: 'Session ID',
              default: 'default'
            }
          }
        }
      },
      
      {
        name: 'set_log_level',
        description: 'Change logging verbosity at runtime',
        inputSchema: {
          type: 'object',
          properties: {
            level: {
              type: 'string',
              enum: ['error', 'warn', 'info', 'debug', 'trace'],
              description: 'New log level'
            },
            session_id: {
              type: 'string',
              default: 'default'
            }
          },
          required: ['level']
        }
      },
      
      {
        name: 'stop_app',
        description: 'Stop the application and monitoring',
        inputSchema: {
          type: 'object',
          properties: {
            session_id: { 
              type: 'string', 
              default: 'default',
              description: 'Session to stop'
            }
          }
        }
      },
      
      {
        name: 'list_sessions',
        description: 'List all active monitoring sessions',
        inputSchema: {
          type: 'object',
          properties: {}
        }
      }
    ];
  }
  
  /**
   * Execute a tool
   */
  async execute(toolName, args) {
    switch (toolName) {
      case 'start_app':
        return await this.startApp(args);
      case 'query_logs':
        return await this.queryLogs(args);
      case 'set_log_level':
        return await this.setLogLevel(args);
      case 'stop_app':
        return await this.stopApp(args);
      case 'list_sessions':
        return await this.listSessions(args);
      default:
        throw new Error(`Unknown tool: ${toolName}`);
    }
  }
  
  /**
   * Start an application with monitoring
   */
  async startApp(args) {
    try {
      const { script, wait_for_port, log_level = 'info', session_id = 'default' } = args;
      
      // Get or create monitor for session
      const monitor = await this.sessionManager.getOrCreateMonitor(session_id);
      
      // Configure Sidewinder based on log level
      const sidewinderProfile = this.mapLogLevelToProfile(log_level);
      
      // Start the app with monitoring
      // This will automatically inject Sidewinder if available
      const result = await monitor.monitorFullStackApp({
        backend: {
          script,
          name: 'app',
          port: wait_for_port,
          instrumentation: {
            enabled: true,
            profile: sidewinderProfile,
            wsPort: 9898,  // Sidewinder WebSocket port
            debug: log_level === 'trace'
          }
        },
        // No frontend for simple app monitoring
        frontend: {
          url: 'http://localhost:' + (wait_for_port || 3000),
          browserOptions: { headless: true }
        }
      });
      
      // Store log level for session
      this.sessionManager.setLogLevel(session_id, log_level);
      
      return {
        content: [{
          type: 'text',
          text: `✅ Started app: ${script}\n` +
                `📊 Session: ${session_id}\n` +
                `📝 Log level: ${log_level}\n` +
                (wait_for_port ? `🔌 Port: ${wait_for_port}\n` : '') +
                `🔍 Monitoring enabled with Sidewinder instrumentation\n\n` +
                `Use query_logs to search logs and see HTTP requests.`
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `❌ Failed to start app: ${error.message}`
        }],
        isError: true
      };
    }
  }
  
  /**
   * Query logs with Sidewinder events
   */
  async queryLogs(args) {
    try {
      const { 
        query, 
        request_id,
        level = 'info',
        include_system = true,
        last,
        limit = 100,
        session_id = 'default' 
      } = args;
      
      const monitor = this.sessionManager.getCurrentMonitor(session_id);
      
      // Get both application logs and Sidewinder events
      const results = [];
      
      // Search application logs
      if (monitor.logManager) {
        const appLogs = await monitor.logManager.searchLogs({
          query: query || '',
          limit
        });
        
        if (appLogs.success && appLogs.matches) {
          appLogs.matches.forEach(log => {
            // Filter by log level
            if (this.shouldIncludeLogLevel(log.level || 'info', level)) {
              results.push({
                timestamp: log.timestamp,
                type: 'app',
                level: log.level || 'info',
                message: log.message,
                source: log.source || 'console'
              });
            }
          });
        }
      }
      
      // Get Sidewinder events if available and requested
      if (include_system) {
        const sidewinderEvents = this.sessionManager.getSidewinderEvents(session_id);
        
        sidewinderEvents.forEach(event => {
          // Filter by request_id if specified
          if (request_id && event.requestId !== request_id) {
            return;
          }
          
          // Filter by query if specified
          if (query && !this.eventMatchesQuery(event, query)) {
            return;
          }
          
          // Format Sidewinder event as log entry
          const logEntry = this.formatSidewinderEvent(event);
          if (this.shouldIncludeLogLevel(logEntry.level, level)) {
            results.push(logEntry);
          }
        });
      }
      
      // Sort by timestamp
      results.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
      
      // Apply time range filter if specified
      if (last) {
        const cutoff = this.parseTimeRange(last);
        const filtered = results.filter(log => 
          new Date(log.timestamp) > cutoff
        );
        results.length = 0;
        results.push(...filtered);
      }
      
      // Limit results
      if (results.length > limit) {
        results.length = limit;
      }
      
      // Format for display
      const formatted = results.map(log => {
        const prefix = log.type === 'app' ? '' : '[sidewinder] ';
        const level = log.level ? `[${log.level.toUpperCase()}] ` : '';
        return `${log.timestamp} ${level}${prefix}${log.message}`;
      }).join('\n');
      
      return {
        content: [{
          type: 'text',
          text: formatted || 'No logs found matching criteria'
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `❌ Error querying logs: ${error.message}`
        }],
        isError: true
      };
    }
  }
  
  /**
   * Set log level dynamically
   */
  async setLogLevel(args) {
    try {
      const { level, session_id = 'default' } = args;
      
      // Update session log level
      this.sessionManager.setLogLevel(session_id, level);
      
      // Send command to Sidewinder if connected
      const sidewinderServer = this.sessionManager.getSidewinderServer();
      if (sidewinderServer) {
        sidewinderServer.broadcast({
          type: 'setLogLevel',
          level,
          sessionId: session_id
        });
      }
      
      return {
        content: [{
          type: 'text',
          text: `✅ Log level set to: ${level}`
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `❌ Failed to set log level: ${error.message}`
        }],
        isError: true
      };
    }
  }
  
  /**
   * Stop application
   */
  async stopApp(args) {
    try {
      const { session_id = 'default' } = args;
      
      await this.sessionManager.endSession(session_id);
      
      return {
        content: [{
          type: 'text',
          text: `✅ Stopped app and cleaned up session: ${session_id}`
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `❌ Failed to stop app: ${error.message}`
        }],
        isError: true
      };
    }
  }
  
  /**
   * List active sessions
   */
  async listSessions() {
    try {
      const sessions = this.sessionManager.getActiveSessions();
      
      if (sessions.length === 0) {
        return {
          content: [{
            type: 'text',
            text: 'No active sessions'
          }]
        };
      }
      
      const formatted = sessions.map(s => 
        `• ${s.id} (started: ${s.startTime})`
      ).join('\n');
      
      return {
        content: [{
          type: 'text',
          text: `Active sessions:\n${formatted}`
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `❌ Failed to list sessions: ${error.message}`
        }],
        isError: true
      };
    }
  }
  
  // Helper methods
  
  mapLogLevelToProfile(level) {
    switch (level) {
      case 'error':
        return 'minimal';  // Just errors
      case 'warn':
        return 'minimal';  // Errors and warnings
      case 'info':
        return 'standard'; // + HTTP requests
      case 'debug':
        return 'standard'; // + More details
      case 'trace':
        return 'full';     // Everything
      default:
        return 'standard';
    }
  }
  
  shouldIncludeLogLevel(logLevel, minLevel) {
    const levels = ['error', 'warn', 'info', 'debug', 'trace'];
    const logIndex = levels.indexOf(logLevel.toLowerCase());
    const minIndex = levels.indexOf(minLevel.toLowerCase());
    return logIndex <= minIndex;
  }
  
  formatSidewinderEvent(event) {
    let message = '';
    let level = 'info';
    
    switch (event.type) {
      case 'http':
        if (event.subtype === 'requestStart') {
          message = `HTTP ${event.request.method} ${event.request.host}${event.request.path} [pending]`;
        } else if (event.subtype === 'response') {
          message = `HTTP ${event.response.statusCode} [${event.response.duration}ms]`;
        }
        break;
        
      case 'console':
        message = `console.${event.method}: ${event.args.join(' ')}`;
        level = event.method === 'error' ? 'error' : 
                event.method === 'warn' ? 'warn' : 'info';
        break;
        
      case 'error':
        message = `${event.subtype}: ${event.error.message}`;
        level = 'error';
        break;
        
      case 'async':
        if (event.subtype === 'contextCreated') {
          message = `Request context: ${event.requestId} - ${event.method} ${event.url}`;
        }
        break;
        
      default:
        message = `${event.type}: ${JSON.stringify(event)}`;
    }
    
    return {
      timestamp: new Date(event.timestamp).toISOString(),
      type: 'system',
      level,
      message,
      requestId: event.requestId
    };
  }
  
  eventMatchesQuery(event, query) {
    const eventStr = JSON.stringify(event).toLowerCase();
    return eventStr.includes(query.toLowerCase());
  }
  
  parseTimeRange(range) {
    const match = range.match(/^(\d+)([mhd])$/);
    if (!match) {
      return new Date(0); // Include all if invalid
    }
    
    const [, num, unit] = match;
    const ms = {
      m: 60 * 1000,
      h: 60 * 60 * 1000,
      d: 24 * 60 * 60 * 1000
    }[unit];
    
    return new Date(Date.now() - (parseInt(num) * ms));
  }
}