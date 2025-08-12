export class SimpleToolHandler {
  constructor(sessionManager) {
    this.sessionManager = sessionManager;
  }
  
  getAllTools() {
    return [
      { name: 'start_app', description: 'Start monitoring an app', inputSchema: { type: 'object', properties: { script: { type: 'string' }, session_id: { type: 'string' }, wait_for_port: { type: 'number' } } } },
      { name: 'query_logs', description: 'Get logs', inputSchema: { type: 'object', properties: { session_id: { type: 'string' }, limit: { type: 'number' } } } },
      { name: 'take_screenshot', description: 'Take screenshot', inputSchema: { type: 'object', properties: { session_id: { type: 'string' } } } },
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
          
        case 'query_logs':
          const logs = await monitor.logStore.getRecentAgentLogs('sidewinder', args.limit || 25);
          return { content: [{ type: 'text', text: `Found ${logs.length} logs` }] };
          
        case 'take_screenshot':
          const result = await monitor.takeScreenshot(sessionId, args);
          return { content: [{ type: 'text', text: '✅ Screenshot taken' }] };
          
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