export class SessionManager {
  constructor(config) {
    this.config = {
      maxHistoryLength: config?.maxHistoryLength ?? 100,
      timeout: config?.timeout ?? 3600000, // 1 hour default
      initialState: config?.initialState,
      persistenceAdapter: config?.persistenceAdapter
    };

    this.state = this.createInitialState();
  }

  createInitialState() {
    return {
      sessionId: this.generateSessionId(),
      state: new Map(this.config.initialState || []),
      history: [],
      contextProviders: [],
      startTime: new Date(),
      lastActivityTime: new Date()
    };
  }

  generateSessionId() {
    return `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  updateActivity() {
    this.state.lastActivityTime = new Date();
  }

  // State management
  getState() {
    return this.state;
  }

  getStateValue(key) {
    return this.state.state.get(key);
  }

  setState(key, value) {
    this.state.state.set(key, value);
    this.updateActivity();
  }

  deleteState(key) {
    this.state.state.delete(key);
    this.updateActivity();
  }

  clearState() {
    this.state.state.clear();
    this.updateActivity();
  }

  // History management
  addHistoryEntry(entry) {
    const fullEntry = {
      ...entry,
      id: `history-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date()
    };

    this.state.history.push(fullEntry);

    // Limit history length
    if (this.config.maxHistoryLength && this.state.history.length > this.config.maxHistoryLength) {
      this.state.history = this.state.history.slice(-this.config.maxHistoryLength);
    }

    this.updateActivity();
  }

  getHistory() {
    return this.state.history;
  }

  getRecentHistory(count) {
    return this.state.history.slice(-count);
  }

  clearHistory() {
    this.state.history = [];
    this.updateActivity();
  }

  // Context provider management
  addContextProvider(provider) {
    const existing = this.state.contextProviders.findIndex(p => p.name === provider.name);
    if (existing >= 0) {
      this.state.contextProviders[existing] = provider;
    } else {
      this.state.contextProviders.push(provider);
    }
    this.updateActivity();
  }

  removeContextProvider(name) {
    this.state.contextProviders = this.state.contextProviders.filter(p => p.name !== name);
    this.updateActivity();
  }

  getContextProviders() {
    return this.state.contextProviders;
  }

  getContextProvider(name) {
    return this.state.contextProviders.find(p => p.name === name);
  }

  clearContextProviders() {
    this.state.contextProviders = [];
    this.updateActivity();
  }

  // Session lifecycle
  isExpired() {
    if (!this.config.timeout) return false;
    const now = Date.now();
    const lastActivity = this.state.lastActivityTime.getTime();
    return now - lastActivity > this.config.timeout;
  }

  reset() {
    this.state = this.createInitialState();
  }

  export() {
    return JSON.stringify(
      this.state,
      (key, value) => value instanceof Map ? Array.from(value.entries()) : value
    );
  }

  import(data) {
    const parsed = JSON.parse(data, (key, value) => {
      if (key === 'state' && Array.isArray(value)) {
        return new Map(value);
      }
      if ((key === 'startTime' || key === 'lastActivityTime' || key === 'timestamp') && typeof value === 'string') {
        return new Date(value);
      }
      return value;
    });
    
    this.state = parsed;
  }

  // Persistence integration
  async save() {
    if (this.config.persistenceAdapter) {
      await this.config.persistenceAdapter.saveState(this.state.sessionId, this.state);
    }
  }

  async load(sessionId) {
    if (this.config.persistenceAdapter) {
      const loaded = await this.config.persistenceAdapter.loadState(sessionId);
      if (loaded) {
        this.state = loaded;
        return true;
      }
    }
    return false;
  }
}