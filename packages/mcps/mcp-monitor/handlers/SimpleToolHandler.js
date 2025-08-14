export class SimpleToolHandler {
  constructor(sessionManager, logger = null) {
    this.sessionManager = sessionManager;
    this.logger = logger || console;  // Use provided logger or console
  }
  
  getAllTools() {
    return [
      { name: 'start_app', description: 'Start monitoring an app', inputSchema: { type: 'object', properties: { script: { type: 'string' }, session_id: { type: 'string' }, wait_for_port: { type: 'number' } } } },
      { name: 'open_page', description: 'Open web page with browser monitoring', inputSchema: { type: 'object', properties: { url: { type: 'string' }, session_id: { type: 'string' }, headless: { type: 'boolean' } } } },
      { name: 'query_logs', description: 'Get logs', inputSchema: { type: 'object', properties: { session_id: { type: 'string' }, limit: { type: 'number' } } } },
      { name: 'take_screenshot', description: 'Take screenshot', inputSchema: { type: 'object', properties: { session_id: { type: 'string' } } } },
      { name: 'browser_execute', description: 'Execute browser commands', inputSchema: { type: 'object', properties: { command: { type: 'string' }, args: { type: 'array' }, session_id: { type: 'string' } } } },
      { name: 'stop_app', description: 'Stop monitoring', inputSchema: { type: 'object', properties: { session_id: { type: 'string' } } } },
      { name: 'list_sessions', description: 'List sessions', inputSchema: { type: 'object' } }
    ];
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