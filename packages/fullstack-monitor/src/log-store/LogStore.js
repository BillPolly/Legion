export class LogStore {
  constructor() {
    this.logs = [];
    this.session = null;
    this.processes = new Map();
  }

  static async create(resourceManager) {
    return new LogStore();
  }

  async createSession(name, config) {
    this.session = { id: name, status: 'active', ...config };
    return this.session;
  }

  getCurrentSession() {
    return this.session;
  }

  async getRecentAgentLogs(agentType, limit = 25) {
    return this.logs
      .filter(log => log.agentType === agentType)
      .slice(-limit);
  }

  addLog(log) {
    this.logs.push({
      timestamp: new Date().toISOString(),
      ...log
    });
  }

  logSidewinderMessage(message) {
    // Handle console messages from Sidewinder agent
    if (message.type === 'console') {
      this.addLog({
        agentType: 'sidewinder',
        level: message.method || 'info', // log, error, warn, info, debug
        message: message.args ? message.args.join(' ') : '',
        sessionId: message.sessionId,
        pid: message.pid
      });
    }
    // Handle other message types
    else if (message.type === 'log') {
      this.addLog({
        agentType: 'sidewinder',
        level: message.level || 'info',
        message: message.message || message.content,
        sessionId: message.sessionId,
        pid: message.pid
      });
    }
  }

  logBrowserMessage(message) {
    // Handle browser console messages and events
    if (message.type === 'console') {
      this.addLog({
        agentType: 'browser',
        level: message.level || 'info',
        message: message.text || message.message,
        sessionId: message.sessionId,
        pageId: message.pageId,
        source: message.source || 'browser-console'
      });
    }
    // Handle other browser events (fetch, errors, etc.)
    else if (message.type === 'fetch' || message.type === 'error' || message.type === 'interaction') {
      this.addLog({
        agentType: 'browser',
        level: message.type === 'error' ? 'error' : 'info',
        message: message.message || `${message.type}: ${JSON.stringify(message)}`,
        sessionId: message.sessionId,
        pageId: message.pageId,
        source: message.source || `browser-${message.type}`
      });
    }
  }

  addProcessToSession(processInfo) {
    if (this.session) {
      this.processes.set(processInfo.id || processInfo.name, processInfo);
    }
  }

  getSessionProcesses() {
    return Array.from(this.processes.values());
  }

  trackProcess(processInfo) {
    this.addProcessToSession(processInfo);
  }
}