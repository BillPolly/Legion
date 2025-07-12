import { StatePersistenceAdapter, SessionState } from '../types';

export class InMemoryPersistence implements StatePersistenceAdapter {
  private storage = new Map<string, SessionState>();

  async saveState(sessionId: string, state: SessionState): Promise<void> {
    // Deep clone the state to avoid mutations
    const cloned = JSON.parse(JSON.stringify(
      state,
      (key, value) => value instanceof Map ? Array.from(value.entries()) : value
    ));
    
    // Restore Maps and Dates
    cloned.state = new Map(cloned.state);
    cloned.startTime = new Date(cloned.startTime);
    cloned.lastActivityTime = new Date(cloned.lastActivityTime);
    cloned.history = cloned.history.map((entry: any) => ({
      ...entry,
      timestamp: new Date(entry.timestamp)
    }));
    
    this.storage.set(sessionId, cloned);
  }

  async loadState(sessionId: string): Promise<SessionState | null> {
    const state = this.storage.get(sessionId);
    return state || null;
  }

  async deleteState(sessionId: string): Promise<void> {
    this.storage.delete(sessionId);
  }

  async listSessions(): Promise<string[]> {
    return Array.from(this.storage.keys());
  }

  clear(): void {
    this.storage.clear();
  }
}