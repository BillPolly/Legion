export class SimpleToolHandler {
  constructor(sessionManager, logger = null, mongoTool = null) {
    this.sessionManager = sessionManager;
    this.logger = logger || console;  // Use provided logger or console
    this.mongoTool = mongoTool;  // Legion MongoDB query tool
  }
  
  setMongoTool(mongoTool) {
    this.logger.info('Setting MongoDB tool in handler', { hasMongoTool: !!mongoTool });
    this.mongoTool = mongoTool;
  }
  
  getAllTools() {
    const tools = [
      { 
        name: 'start_app', 
        description: 'Start monitoring a backend application. Injects Sidewinder agent to capture console logs, errors, server lifecycle events, and process information. Supports Node.js scripts, npm/yarn commands, and TypeScript files. Session ID isolates monitoring from other sessions.', 
        inputSchema: { 
          type: 'object', 
          properties: { 
            script: { type: 'string', description: 'Path to script file or npm package directory to monitor' }, 
            session_id: { type: 'string', description: 'Unique session identifier for isolating this monitoring session' }, 
            wait_for_port: { type: 'number', description: 'Optional port number to wait for server startup (kills existing process on port first)' } 
          },
          required: ['script', 'session_id']
        } 
      },
      { 
        name: 'open_page', 
        description: 'Open and monitor a webpage in a browser session. Injects browser agent to capture console logs, network requests, errors, and user interactions. Each session_id creates an isolated monitoring context. Use data: URLs for custom HTML content.', 
        inputSchema: { 
          type: 'object', 
          properties: { 
            url: { type: 'string', description: 'Web URL (http://, https://) or data: URL with HTML content to open' }, 
            session_id: { type: 'string', description: 'Unique session identifier for isolating this browser session' }, 
            headless: { type: 'boolean', description: 'Optional: Run browser headlessly (true) or visibly (false, default)' } 
          },
          required: ['url', 'session_id']
        } 
      },
      { 
        name: 'query_logs', 
        description: 'Retrieve captured logs for a monitoring session. Returns logs from browser agents (console messages, network requests, errors) and backend agents (console output, server events) sorted by timestamp. Logs are session-scoped for isolation.', 
        inputSchema: { 
          type: 'object', 
          properties: { 
            session_id: { type: 'string', description: 'Session ID to retrieve logs for' }, 
            limit: { type: 'number', description: 'Maximum number of recent logs to return (default: 25)' } 
          },
          required: ['session_id']
        } 
      },
      { 
        name: 'take_screenshot', 
        description: 'Capture a screenshot of the current browser page for a session. Requires an active browser page opened with open_page. Returns base64-encoded image data or saves to file path if specified.', 
        inputSchema: { 
          type: 'object', 
          properties: { 
            session_id: { type: 'string', description: 'Session ID with an active browser page' },
            fullPage: { type: 'boolean', description: 'Optional: Capture full page (true) or viewport only (false, default)' },
            path: { type: 'string', description: 'Optional: File path to save screenshot (if not provided, returns base64)' }
          },
          required: ['session_id']
        } 
      },
      { 
        name: 'browser_execute', 
        description: 'Execute Puppeteer command formats on an active page. All standard Puppeteer page methods are available. Common examples: "title" (get page title), "url" (get current URL), "click" (click element, args: [selector]), "type" (type text, args: [selector, text]), "evaluate" (run JavaScript, args: [function_string]). Requires active browser page from open_page.', 
        inputSchema: { 
          type: 'object', 
          properties: { 
            command: { type: 'string', description: 'Any standard Puppeteer page method (e.g., title, url, click, type, evaluate, waitForSelector, etc.)' }, 
            args: { type: 'array', description: 'Command arguments: [] for title/url, [selector] for click, [selector, text] for type, [js_code] for evaluate' }, 
            session_id: { type: 'string', description: 'Session ID with an active browser page' } 
          },
          required: ['command', 'session_id']
        } 
      },
      { 
        name: 'stop_app', 
        description: 'Stop all monitoring for a session. Terminates backend processes, closes browser pages, but keeps the session logs available for query_logs. Does not stop the monitoring server itself.', 
        inputSchema: { 
          type: 'object', 
          properties: { 
            session_id: { type: 'string', description: 'Optional: Session ID to stop (stops all sessions if not provided)' } 
          } 
        } 
      },
      { 
        name: 'list_sessions', 
        description: 'List all active monitoring sessions and their status. Shows session IDs, active components (browser/backend), number of pages, and uptime information.', 
        inputSchema: { 
          type: 'object', 
          properties: {},
          additionalProperties: false
        } 
      }
    ];
    
    // Always add MongoDB tool - availability is checked at execution time
    tools.push({
        name: 'db_query',
        description: `Execute MongoDB database operations with native JSON syntax for data inspection, debugging, and manipulation. 

This tool provides direct access to MongoDB with all standard operations:
• QUERY: find, findOne, countDocuments, distinct, aggregate - for data retrieval and analysis
• WRITE: insertOne, insertMany, updateOne, updateMany, deleteOne, deleteMany - for data manipulation  
• ADMIN: createIndex, dropCollection, listCollections - for collection management

The tool accepts MongoDB commands exactly as you would write them in the MongoDB shell, just split into command and parameters. Perfect for debugging application data, verifying database state, running ad-hoc queries, and performing data maintenance tasks.

Examples:
- Find users: command="find", params={query: {active: true}, options: {limit: 10}}
- Update status: command="updateMany", params={filter: {status: "pending"}, update: {$set: {status: "active"}}}
- Aggregate stats: command="aggregate", params={pipeline: [{$group: {_id: "$type", count: {$sum: 1}}}]}

Database defaults to environment configuration but can be overridden per operation.`,
        inputSchema: {
          type: 'object',
          properties: {
            database: { 
              type: 'string', 
              description: 'MongoDB database name (optional, defaults to environment configuration)' 
            },
            collection: { 
              type: 'string', 
              description: 'Collection name to operate on' 
            },
            command: { 
              type: 'string',
              enum: [
                'find', 'findOne', 'insertOne', 'insertMany',
                'updateOne', 'updateMany', 'deleteOne', 'deleteMany',
                'aggregate', 'countDocuments', 'distinct',
                'createIndex', 'dropCollection', 'listCollections'
              ],
              description: 'MongoDB command to execute' 
            },
            params: { 
              type: 'object', 
              description: 'Command parameters in MongoDB JSON format (e.g., {query: {...}, options: {...}} for find)' 
            }
          },
          required: ['collection', 'command', 'params']
        }
      });
    
    return tools;
  }
  
  async executeTool(toolName, args) {
    try {
      this.logger.info(`Executing tool: ${toolName}`, { tool: toolName, args });
      
      // Get THE single monitor instance (created at startup)
      const monitor = await this.sessionManager.getMonitor();
      
      this.logger.debug(`Got monitor instance`);
      
      switch (toolName) {
        case 'start_app':
          // Just call the simple method on the monitor
          return await monitor.startApp(args.script, args);
          
        case 'open_page':
          // Just call the simple method on the monitor
          return await monitor.openPage(args.url, args.session_id || 'default', args);
          
        case 'query_logs':
          // Just call the simple method on the monitor
          return await monitor.getLogs(args.limit);
          
        case 'take_screenshot':
          return await monitor.screenshot(args.session_id || 'default', args);
          
        case 'browser_execute':
          return await monitor.browserCommand(args.session_id || 'default', args.command, args.args);
          
        case 'stop_app':
          return await monitor.stopApp();
          
        case 'list_sessions':
          const sessions = this.sessionManager.listSessions();
          return { content: [{ type: 'text', text: `${sessions.count} sessions` }] };
          
        case 'db_query':
          // Execute MongoDB query using Legion tool
          if (!this.mongoTool) {
            throw new Error('MongoDB query tool not available - check database connection');
          }
          
          const mongoResult = await this.mongoTool.execute({
            database: args.database,
            collection: args.collection,
            command: args.command,
            params: args.params
          });
          
          // Format result for MCP response
          if (mongoResult.success) {
            // Format the result based on the command type
            let responseText;
            const { command, result, collection, database } = mongoResult.data;
            
            if (Array.isArray(result)) {
              // For queries that return arrays (find, aggregate, etc.)
              responseText = `✅ ${command} on ${database || 'default'}.${collection}\n`;
              responseText += `Found ${result.length} document(s):\n`;
              responseText += JSON.stringify(result, null, 2);
            } else if (typeof result === 'number') {
              // For count operations
              responseText = `✅ ${command} on ${database || 'default'}.${collection}\n`;
              responseText += `Result: ${result}`;
            } else if (typeof result === 'object' && result !== null) {
              // For single document results or operation results
              responseText = `✅ ${command} on ${database || 'default'}.${collection}\n`;
              responseText += JSON.stringify(result, null, 2);
            } else {
              // For other results (boolean, null, etc.)
              responseText = `✅ ${command} on ${database || 'default'}.${collection}\n`;
              responseText += `Result: ${result}`;
            }
            
            return { content: [{ type: 'text', text: responseText }] };
          } else {
            // Handle errors
            return { 
              content: [{ 
                type: 'text', 
                text: `❌ MongoDB operation failed: ${mongoResult.data.errorMessage}` 
              }] 
            };
          }
          
        default:
          throw new Error(`Unknown tool: ${toolName}`);
      }
    } catch (error) {
      this.logger.error(`Error executing tool ${toolName}`, { 
        tool: toolName,
        error: error.message,
        stack: error.stack 
      });
      return { content: [{ type: 'text', text: `❌ ${error.message}` }] };
    }
  }
}