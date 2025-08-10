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
      },
      
      {
        name: 'take_screenshot',
        description: 'Take a screenshot of the current page under test. If path is provided, saves to file. If path is omitted, returns image as base64 data URI.',
        inputSchema: {
          type: 'object',
          properties: {
            session_id: {
              type: 'string',
              default: 'default',
              description: 'Session ID'
            },
            format: {
              type: 'string',
              enum: ['png', 'jpeg', 'webp'],
              default: 'png',
              description: 'Image format: png (lossless), jpeg (lossy with quality setting), webp (lossy with quality setting)'
            },
            quality: {
              type: 'number',
              minimum: 0,
              maximum: 100,
              default: 90,
              description: 'Quality for JPEG/WebP formats (0-100). Ignored for PNG format as it is lossless.'
            },
            fullPage: {
              type: 'boolean',
              default: true,
              description: 'Capture the full scrollable page'
            },
            path: {
              type: 'string',
              description: 'Optional file path to save screenshot. If omitted, screenshot is returned as base64 data URI in the response.'
            },
            clip: {
              type: 'object',
              properties: {
                x: { type: 'number' },
                y: { type: 'number' },
                width: { type: 'number' },
                height: { type: 'number' }
              },
              description: 'Optional clipping rectangle'
            }
          }
        }
      },
      
      {
        name: 'record_video',
        description: 'Start or stop video recording of browser interactions',
        inputSchema: {
          type: 'object',
          properties: {
            action: {
              type: 'string',
              enum: ['start', 'stop', 'status'],
              description: 'Recording action to perform'
            },
            session_id: {
              type: 'string',
              default: 'default',
              description: 'Session ID'
            },
            path: {
              type: 'string',
              description: 'Output file path for video (for start action)'
            },
            format: {
              type: 'string',
              enum: ['mp4', 'webm'],
              default: 'mp4',
              description: 'Video format'
            },
            fps: {
              type: 'number',
              minimum: 1,
              maximum: 60,
              default: 30,
              description: 'Frames per second'
            },
            duration: {
              type: 'number',
              minimum: 1,
              description: 'Maximum recording duration in seconds (optional)'
            }
          },
          required: ['action']
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
      case 'take_screenshot':
        return await this.takeScreenshot(args);
      case 'record_video':
        return await this.recordVideo(args);
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
      
      // Get application logs
      if (monitor.logManager) {
        let appLogs;
        
        // Use different methods based on whether we have a query
        if (query && query.trim()) {
          // Use searchLogs for queries
          appLogs = await monitor.logManager.searchLogs({
            query: query.trim(),
            limit
          });
          
          if (appLogs.success && appLogs.matches) {
            appLogs.matches.forEach(log => {
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
        } else {
          // Use getSessionLogs for general log retrieval
          const sessions = await monitor.logManager.listSessions();
          if (sessions.success && sessions.sessions && sessions.sessions.length > 0) {
            // Get logs from all sessions in this monitor
            for (const session of sessions.sessions) {
              const sessionLogs = await monitor.logManager.getSessionLogs(session.sessionId, { limit });
              
              if (sessionLogs.success && sessionLogs.logs) {
                sessionLogs.logs.forEach(log => {
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
          }
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
  
  /**
   * Take screenshot of current page
   */
  async takeScreenshot(args) {
    try {
      const { 
        session_id = 'default',
        format = 'png',
        quality = 90,
        fullPage = true,
        path,
        clip
      } = args;
      
      const monitor = this.sessionManager.getCurrentMonitor(session_id);
      
      // Get the active browser page
      if (!monitor || !monitor.activeBrowsers || monitor.activeBrowsers.size === 0) {
        return {
          content: [{
            type: 'text',
            text: '❌ No active browser found. Start an app first with start_app.'
          }],
          isError: true
        };
      }
      
      // Get the first active browser page
      const browserEntry = Array.from(monitor.activeBrowsers.values())[0];
      const page = browserEntry.page;
      
      // Build screenshot options
      const screenshotOptions = {
        type: format,
        fullPage,
        ...(format !== 'png' && { quality }),
        ...(clip && { clip }),
        ...(path && { path })
      };
      
      // Take screenshot
      const screenshot = await page.screenshot(screenshotOptions);
      
      // Generate filename if not provided
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = path || `screenshot-${timestamp}.${format}`;
      
      if (path) {
        return {
          content: [{
            type: 'text',
            text: `✅ Screenshot saved to: ${path}\n` +
                  `📐 Format: ${format.toUpperCase()}\n` +
                  `📄 Full page: ${fullPage}\n` +
                  (format !== 'png' ? `🎨 Quality: ${quality}%\n` : '') +
                  (clip ? `✂️  Clipped: ${clip.width}x${clip.height} at (${clip.x}, ${clip.y})\n` : '') +
                  `📊 Session: ${session_id}`
          }]
        };
      } else {
        // Return as base64
        const base64 = screenshot.toString('base64');
        return {
          content: [
            {
              type: 'text',
              text: `✅ Screenshot captured\n` +
                    `📐 Format: ${format.toUpperCase()}\n` +
                    `📄 Full page: ${fullPage}\n` +
                    (format !== 'png' ? `🎨 Quality: ${quality}%\n` : '') +
                    (clip ? `✂️  Clipped: ${clip.width}x${clip.height} at (${clip.x}, ${clip.y})\n` : '') +
                    `📊 Session: ${session_id}\n` +
                    `💾 Size: ${Math.round(base64.length / 1024)} KB`
            },
            {
              type: 'image',
              data: `data:image/${format};base64,${base64}`,
              mimeType: `image/${format}`
            }
          ]
        };
      }
      
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `❌ Screenshot failed: ${error.message}`
        }],
        isError: true
      };
    }
  }
  
  /**
   * Record video of browser interactions
   */
  async recordVideo(args) {
    try {
      const { 
        action,
        session_id = 'default',
        path,
        format = 'mp4',
        fps = 30,
        duration
      } = args;
      
      const monitor = this.sessionManager.getCurrentMonitor(session_id);
      
      // Get the active browser page
      if (!monitor || !monitor.activeBrowsers || monitor.activeBrowsers.size === 0) {
        return {
          content: [{
            type: 'text',
            text: '❌ No active browser found. Start an app first with start_app.'
          }],
          isError: true
        };
      }
      
      // Get the first active browser page
      const browserEntry = Array.from(monitor.activeBrowsers.values())[0];
      const page = browserEntry.page;
      
      switch (action) {
        case 'start':
          if (page.isRecording && page.isRecording()) {
            return {
              content: [{
                type: 'text',
                text: '⚠️  Recording is already in progress. Stop current recording first.'
              }],
              isError: true
            };
          }
          
          // Generate filename if not provided
          const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
          const videoPath = path || `recording-${timestamp}.${format}`;
          
          const result = await page.startRecording({
            path: videoPath,
            format,
            fps
          });
          
          // Set up auto-stop if duration is specified
          if (duration) {
            setTimeout(async () => {
              try {
                if (page.isRecording && page.isRecording()) {
                  await page.stopRecording();
                  console.log(`Auto-stopped recording after ${duration} seconds`);
                }
              } catch (error) {
                console.error('Error auto-stopping recording:', error);
              }
            }, duration * 1000);
          }
          
          return {
            content: [{
              type: 'text',
              text: `🎬 Recording started!\n` +
                    `📹 Output: ${videoPath}\n` +
                    `📐 Format: ${format.toUpperCase()}\n` +
                    `🎭 FPS: ${fps}\n` +
                    (duration ? `⏱️  Auto-stop: ${duration} seconds\n` : '') +
                    `📊 Session: ${session_id}\n\n` +
                    `Use record_video with action='stop' to stop recording.`
            }]
          };
          
        case 'stop':
          if (!page.isRecording || !page.isRecording()) {
            return {
              content: [{
                type: 'text',
                text: '⚠️  No recording in progress.'
              }],
              isError: true
            };
          }
          
          const stopResult = await page.stopRecording();
          const durationMs = stopResult.duration;
          const durationSec = Math.round(durationMs / 1000 * 100) / 100;
          
          return {
            content: [{
              type: 'text',
              text: `🛑 Recording stopped!\n` +
                    `📹 Saved to: ${stopResult.path}\n` +
                    `⏱️  Duration: ${durationSec} seconds\n` +
                    `📊 Session: ${session_id}\n` +
                    `🎬 Started: ${stopResult.startTime.toISOString()}\n` +
                    `🏁 Ended: ${stopResult.endTime.toISOString()}`
            }]
          };
          
        case 'status':
          const isRecording = page.isRecording && page.isRecording();
          
          if (isRecording) {
            return {
              content: [{
                type: 'text',
                text: `🎬 Recording is active\n` +
                      `📊 Session: ${session_id}\n` +
                      `⏱️  Status: Recording in progress...`
              }]
            };
          } else {
            return {
              content: [{
                type: 'text',
                text: `⏹️  No active recording\n` +
                      `📊 Session: ${session_id}\n` +
                      `💡 Use record_video with action='start' to begin recording.`
              }]
            };
          }
          
        default:
          return {
            content: [{
              type: 'text',
              text: `❌ Unknown action: ${action}. Use 'start', 'stop', or 'status'.`
            }],
            isError: true
          };
      }
      
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `❌ Video recording failed: ${error.message}`
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