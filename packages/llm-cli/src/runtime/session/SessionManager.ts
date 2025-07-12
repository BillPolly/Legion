import { SessionState, HistoryEntry, StatePersistenceAdapter } from './types';
import { ContextProvider } from '../context/types';
import { SessionConfig } from '../../core/types';

export class SessionManager {
  private state: SessionState;
  private config: SessionConfig;

  constructor(config?: SessionConfig) {
    this.config = {
      maxHistoryLength: config?.maxHistoryLength ?? 100,
      timeout: config?.timeout ?? 3600000, // 1 hour default
      initialState: config?.initialState,
      persistenceAdapter: config?.persistenceAdapter
    };

    this.state = this.createInitialState();
  }

  private createInitialState(): SessionState {
    return {
      sessionId: this.generateSessionId(),
      state: new Map(this.config.initialState || []),
      history: [],
      contextProviders: [],
      startTime: new Date(),
      lastActivityTime: new Date()
    };
  }

  private generateSessionId(): string {
    return `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private updateActivity(): void {
    this.state.lastActivityTime = new Date();
  }

  // State management
  getState(): SessionState {
    return this.state;
  }

  getStateValue(key: string): any {
    return this.state.state.get(key);
  }

  setState(key: string, value: any): void {
    this.state.state.set(key, value);
    this.updateActivity();
  }

  deleteState(key: string): void {
    this.state.state.delete(key);
    this.updateActivity();
  }

  clearState(): void {
    this.state.state.clear();
    this.updateActivity();
  }

  // History management
  addHistoryEntry(entry: Omit<HistoryEntry, 'id' | 'timestamp'>): void {
    const fullEntry: HistoryEntry = {
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

  getHistory(): HistoryEntry[] {
    return this.state.history;
  }

  getRecentHistory(count: number): HistoryEntry[] {
    return this.state.history.slice(-count);
  }

  clearHistory(): void {
    this.state.history = [];
    this.updateActivity();
  }

  // Context provider management
  addContextProvider(provider: ContextProvider): void {
    const existing = this.state.contextProviders.findIndex(p => p.name === provider.name);
    if (existing >= 0) {
      this.state.contextProviders[existing] = provider;
    } else {
      this.state.contextProviders.push(provider);
    }
    this.updateActivity();
  }

  removeContextProvider(name: string): void {
    this.state.contextProviders = this.state.contextProviders.filter(p => p.name !== name);
    this.updateActivity();
  }

  getContextProviders(): ContextProvider[] {
    return this.state.contextProviders;
  }

  getContextProvider(name: string): ContextProvider | undefined {
    return this.state.contextProviders.find(p => p.name === name);
  }

  clearContextProviders(): void {
    this.state.contextProviders = [];
    this.updateActivity();
  }

  // Session lifecycle
  isExpired(): boolean {
    if (!this.config.timeout) return false;
    const now = Date.now();
    const lastActivity = this.state.lastActivityTime.getTime();
    return now - lastActivity > this.config.timeout;
  }

  reset(): void {
    this.state = this.createInitialState();
  }

  export(): string {
    return JSON.stringify(
      this.state,
      (key, value) => value instanceof Map ? Array.from(value.entries()) : value
    );
  }

  import(data: string): void {
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
  async save(): Promise<void> {
    if (this.config.persistenceAdapter) {
      await this.config.persistenceAdapter.saveState(this.state.sessionId, this.state);
    }
  }

  async load(sessionId: string): Promise<boolean> {
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