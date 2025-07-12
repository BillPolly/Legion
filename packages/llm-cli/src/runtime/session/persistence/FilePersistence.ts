import { StatePersistenceAdapter, SessionState } from '../types';
import * as fs from 'fs/promises';
import * as path from 'path';

export class FilePersistence implements StatePersistenceAdapter {
  constructor(private directory: string) {
    this.ensureDirectory();
  }

  private async ensureDirectory(): Promise<void> {
    await fs.mkdir(this.directory, { recursive: true });
  }

  private getFilePath(sessionId: string): string {
    return path.join(this.directory, `${sessionId}.json`);
  }

  async saveState(sessionId: string, state: SessionState): Promise<void> {
    const serialized = JSON.stringify(
      state,
      (key, value) => value instanceof Map ? Array.from(value.entries()) : value,
      2
    );
    
    await fs.writeFile(this.getFilePath(sessionId), serialized, 'utf-8');
  }

  async loadState(sessionId: string): Promise<SessionState | null> {
    try {
      const content = await fs.readFile(this.getFilePath(sessionId), 'utf-8');
      const parsed = JSON.parse(content, (key, value) => {
        // Restore Maps
        if (key === 'state' && Array.isArray(value)) {
          return new Map(value);
        }
        // Restore Dates
        if ((key === 'startTime' || key === 'lastActivityTime' || key === 'timestamp') && typeof value === 'string') {
          return new Date(value);
        }
        return value;
      });
      
      return parsed;
    } catch (error) {
      return null;
    }
  }

  async deleteState(sessionId: string): Promise<void> {
    try {
      await fs.unlink(this.getFilePath(sessionId));
    } catch (error) {
      // Ignore if file doesn't exist
    }
  }

  async listSessions(): Promise<string[]> {
    try {
      const files = await fs.readdir(this.directory);
      return files
        .filter(file => file.endsWith('.json'))
        .map(file => file.replace('.json', ''));
    } catch (error) {
      return [];
    }
  }
}