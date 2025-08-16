export class LogStore {
  constructor() {
    this.logs = [];
    this.session = null;
    this.processes = new Map();
    this.correlations = new Map();
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

  // Add missing methods for full functionality
  trackCorrelation(correlationId, source, data) {
    if (!this.correlations.has(correlationId)) {
      this.correlations.set(correlationId, {
        id: correlationId,
        frontend: null,
        backend: null,
        firstSeen: new Date()
      });
    }
    
    const correlation = this.correlations.get(correlationId);
    correlation[source] = data;
    correlation.lastSeen = new Date();
  }

  getCorrelation(correlationId) {
    return this.correlations.get(correlationId);
  }

  async searchCorrelated(correlationId) {
    const correlatedLogs = this.logs.filter(log => {
      const message = log.message || '';
      return message.includes(correlationId);
    });
    
    return {
      backend: correlatedLogs.filter(log => log.agentType === 'sidewinder'),
      frontend: correlatedLogs.filter(log => log.agentType === 'browser')
    };
  }

  async searchLogs(options = {}) {
    let results = [...this.logs];
    
    if (options.level) {
      results = results.filter(log => log.level === options.level);
    }
    
    if (options.agentType) {
      results = results.filter(log => log.agentType === options.agentType);
    }
    
    if (options.search) {
      results = results.filter(log => {
        const message = log.message || '';
        return message.toLowerCase().includes(options.search.toLowerCase());
      });
    }
    
    if (options.limit) {
      results = results.slice(-options.limit);
    }
    
    return results;
  }

  async logMessage(logData) {
    this.addLog(logData);
  }

  async endSession() {
    if (this.session) {
      this.session.status = 'ended';
      this.session.endTime = new Date();
    }
  }

  async completeProcess(pid, info = {}) {
    for (const [key, process] of this.processes) {
      if (process.pid === pid || process.processId === pid) {
        Object.assign(process, info, { completed: true });
        break;
      }
    }
  }

  async getStatistics() {
    return {
      totalLogs: this.logs.length,
      sessionCount: this.session ? 1 : 0,
      processCount: this.processes.size,
      correlationCount: this.correlations.size
    };
  }

  async cleanup() {
    this.logs = [];
    this.processes.clear();
    this.correlations.clear();
    this.session = null;
  }
}