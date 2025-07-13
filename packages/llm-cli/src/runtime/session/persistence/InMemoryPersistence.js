export class InMemoryPersistence {
  constructor() {
    this.sessions = new Map();
  }

  async saveState(sessionId, state) {
    this.sessions.set(sessionId, JSON.parse(JSON.stringify(state)));
  }

  async loadState(sessionId) {
    return this.sessions.get(sessionId);
  }

  async deleteState(sessionId) {
    return this.sessions.delete(sessionId);
  }

  async listSessions() {
    return Array.from(this.sessions.keys());
  }
}