/**
 * TestResourceManager - Mock ResourceManager for testing
 */

export class MockStorageProvider {
  constructor() {
    this.logs = [];
    this.sessions = new Map();
    this.processes = new Map();
  }
  
  async store(log) {
    this.logs.push(log);
    return { success: true, id: log.logId };
  }
  
  async search(query, options = {}) {
    const matches = this.logs.filter(log => {
      const searchText = `${log.message} ${JSON.stringify(log.metadata || {})}`.toLowerCase();
      return searchText.includes(query.toLowerCase());
    });
    
    const limit = options.limit || 100;
    return { 
      matches: matches.slice(0, limit),
      total: matches.length 
    };
  }
  
  async getSession(sessionId) {
    return this.sessions.get(sessionId);
  }
  
  async createSession(session) {
    this.sessions.set(session.id || session.sessionId, session);
    return session;
  }
  
  async updateSession(session) {
    this.sessions.set(session.id || session.sessionId, session);
    return session;
  }
  
  async addProcess(sessionId, process) {
    const processes = this.processes.get(sessionId) || [];
    processes.push(process);
    this.processes.set(sessionId, processes);
    return process;
  }
  
  async completeProcess(sessionId, processId, exitInfo) {
    const processes = this.processes.get(sessionId) || [];
    const process = processes.find(p => p.processId === processId);
    if (process) {
      process.exitCode = exitInfo.exitCode;
      process.completed = true;
    }
    return process;
  }
  
  async clear() {
    this.logs = [];
    this.sessions.clear();
    this.processes.clear();
  }
  
  async getLogs(sessionId) {
    return this.logs.filter(log => log.sessionId === sessionId);
  }
}

export class TestResourceManager {
  constructor() {
    this.resources = new Map();
    // Add required storage provider
    this.storageProvider = new MockStorageProvider();
    this.resources.set('StorageProvider', this.storageProvider);
    
    // Add optional resources
    this.resources.set('BROWSER_TYPE', 'mock');
  }
  
  get(key) {
    return this.resources.get(key);
  }
  
  set(key, value) {
    this.resources.set(key, value);
    return this;
  }
  
  // Helper to get storage provider directly
  getStorageProvider() {
    return this.storageProvider;
  }
  
  // Clear all test data
  async clear() {
    await this.storageProvider.clear();
  }
}