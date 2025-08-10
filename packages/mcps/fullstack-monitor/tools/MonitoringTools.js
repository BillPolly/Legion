/**
 * MonitoringTools - Core monitoring operations wrapped as MCP tools
 */

export class MonitoringTools {
  constructor(sessionManager) {
    this.sessionManager = sessionManager;
  }
  
  /**
   * Get tool definitions for MCP
   */
  getToolDefinitions() {
    return [
      {
        name: 'start_fullstack_monitoring',
        description: 'Start monitoring a full-stack application (backend + frontend)',
        inputSchema: {
          type: 'object',
          properties: {
            backend_script: {
              type: 'string',
              description: 'Path to backend server script'
            },
            backend_name: {
              type: 'string',
              description: 'Name for the backend process',
              default: 'backend'
            },
            backend_port: {
              type: 'number',
              description: 'Port the backend will listen on'
            },
            frontend_url: {
              type: 'string',
              description: 'URL of the frontend application'
            },
            headless: {
              type: 'boolean',
              description: 'Run browser in headless mode',
              default: true
            },
            session_id: {
              type: 'string',
              description: 'Optional session ID',
              default: 'default'
            }
          },
          required: ['backend_script', 'frontend_url']
        }
      },
      
      {
        name: 'stop_monitoring',
        description: 'Stop monitoring and clean up resources',
        inputSchema: {
          type: 'object',
          properties: {
            session_id: {
              type: 'string',
              description: 'Session ID to stop',
              default: 'default'
            }
          }
        }
      },
      
      {
        name: 'get_monitoring_stats',
        description: 'Get statistics about current monitoring session',
        inputSchema: {
          type: 'object',
          properties: {
            session_id: {
              type: 'string',
              description: 'Session ID',
              default: 'default'
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
   * Execute a monitoring tool
   */
  async execute(toolName, args) {
    switch (toolName) {
      case 'start_fullstack_monitoring':
        return await this.startFullStackMonitoring(args);
        
      case 'stop_monitoring':
        return await this.stopMonitoring(args);
        
      case 'get_monitoring_stats':
        return await this.getMonitoringStats(args);
        
      case 'list_sessions':
        return await this.listSessions(args);
        
      default:
        throw new Error(`Unknown tool: ${toolName}`);
    }
  }
  
  /**
   * Start full-stack monitoring
   */
  async startFullStackMonitoring(args) {
    const {
      backend_script,
      backend_name = 'backend',
      backend_port,
      frontend_url,
      headless = true,
      session_id = 'default'
    } = args;
    
    try {
      // Get or create monitor
      const monitor = await this.sessionManager.getOrCreateMonitor(session_id);
      
      // Configure and start monitoring
      const config = {
        backend: {
          script: backend_script,
          name: backend_name,
          port: backend_port,
          timeout: 30000
        },
        frontend: {
          url: frontend_url,
          browserOptions: {
            headless,
            devtools: !headless
          }
        }
      };
      
      const result = await monitor.monitorFullStackApp(config);
      
      return {
        success: true,
        session_id,
        backend: {
          name: result.backend.name,
          pid: result.backend.pid,
          status: 'running'
        },
        frontend: {
          url: result.browser.url,
          page_id: result.browser.id
        },
        message: `Monitoring started for ${backend_name} and ${frontend_url}`
      };
      
    } catch (error) {
      return {
        success: false,
        error: error.message,
        stack: error.stack
      };
    }
  }
  
  /**
   * Stop monitoring
   */
  async stopMonitoring(args) {
    const { session_id = 'default' } = args;
    
    try {
      if (!this.sessionManager.hasSession(session_id)) {
        return {
          success: false,
          error: `No active session: ${session_id}`
        };
      }
      
      await this.sessionManager.endSession(session_id);
      
      return {
        success: true,
        session_id,
        message: `Monitoring stopped for session: ${session_id}`
      };
      
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
  
  /**
   * Get monitoring statistics
   */
  async getMonitoringStats(args) {
    const { session_id = 'default' } = args;
    
    try {
      const monitor = this.sessionManager.getCurrentMonitor(session_id);
      const stats = monitor.getStatistics();
      
      return {
        success: true,
        session_id,
        stats: {
          backend: {
            total_logs: stats.backend.totalLogs || 0,
            processes: stats.backend.processes || 0,
            errors: stats.backend.errors || 0
          },
          frontend: {
            console_messages: stats.frontend.totalConsoleMessages || 0,
            network_requests: stats.frontend.totalNetworkRequests || 0,
            errors: stats.frontend.totalErrors || 0
          },
          correlations: stats.correlationsDetected || 0,
          debug_scenarios: stats.debugScenariosRun || 0,
          uptime: stats.uptime || 0
        }
      };
      
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
  
  /**
   * List active sessions
   */
  async listSessions(args) {
    try {
      const sessions = this.sessionManager.getActiveSessions();
      
      return {
        success: true,
        sessions,
        count: sessions.length
      };
      
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
}