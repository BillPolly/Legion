export class SimpleToolHandler {
  constructor(sessionManager) {
    this.sessionManager = sessionManager;
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
    const sessionId = args.session_id || 'default';
    const monitor = await this.sessionManager.getMonitor(sessionId);
    
    try {
      switch (toolName) {
        case 'start_app':
          const config = { backend: { script: args.script, port: args.wait_for_port } };
          await monitor.monitorFullStackApp(config);
          return { content: [{ type: 'text', text: '✅ App started' }] };
          
        case 'open_page':
          // Launch browser if not already launched
          if (!monitor.browser) {
            await monitor.launch({ headless: args.headless || false });
          }
          // Open and monitor the page with automatic browser agent injection
          const pageInfo = await monitor.monitorPage(args.url, sessionId);
          return { content: [{ type: 'text', text: `✅ Page opened: ${args.url}` }] };
          
        case 'query_logs':
          // Get both Sidewinder and browser logs
          const sidewinderLogs = await monitor.logStore.getRecentAgentLogs('sidewinder', args.limit || 25);
          const browserLogs = await monitor.logStore.getRecentAgentLogs('browser', args.limit || 25);
          const allLogs = [...sidewinderLogs, ...browserLogs];
          allLogs.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
          
          if (allLogs.length > 0) {
            const logText = allLogs.map(log => 
              `[${log.timestamp}] [${log.agentType}] ${log.level}: ${log.message}`
            ).join('\n');
            return { content: [{ type: 'text', text: `Found ${allLogs.length} logs:\n\n${logText}` }] };
          } else {
            return { content: [{ type: 'text', text: `Found 0 logs` }] };
          }
          
        case 'take_screenshot':
          const result = await monitor.takeScreenshot(sessionId, args);
          return { content: [{ type: 'text', text: '✅ Screenshot taken' }] };
          
        case 'browser_execute':
          const executeResult = await monitor.executeBrowserCommand(sessionId, args.command, args.args);
          return { content: [{ type: 'text', text: `✅ ${executeResult}` }] };
          
        case 'stop_app':
          await this.sessionManager.endSession(sessionId);
          return { content: [{ type: 'text', text: '✅ Stopped' }] };
          
        case 'list_sessions':
          const sessions = this.sessionManager.listSessions();
          return { content: [{ type: 'text', text: `${sessions.count} sessions` }] };
          
        default:
          throw new Error(`Unknown tool: ${toolName}`);
      }
    } catch (error) {
      return { content: [{ type: 'text', text: `❌ ${error.message}` }] };
    }
  }
}