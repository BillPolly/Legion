import fs from 'fs/promises';
import path from 'path';

export class FilePersistence {
  constructor(directory = '.sessions') {
    this.directory = directory;
  }

  async ensureDirectory() {
    try {
      await fs.mkdir(this.directory, { recursive: true });
    } catch (error) {
      // Directory might already exist
    }
  }

  getFilePath(sessionId) {
    return path.join(this.directory, `${sessionId}.json`);
  }

  async saveState(sessionId, state) {
    await this.ensureDirectory();
    const filePath = this.getFilePath(sessionId);
    const data = JSON.stringify(state, null, 2);
    await fs.writeFile(filePath, data, 'utf-8');
  }

  async loadState(sessionId) {
    try {
      const filePath = this.getFilePath(sessionId);
      const data = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      return null;
    }
  }

  async deleteState(sessionId) {
    try {
      const filePath = this.getFilePath(sessionId);
      await fs.unlink(filePath);
      return true;
    } catch (error) {
      return false;
    }
  }

  async listSessions() {
    try {
      await this.ensureDirectory();
      const files = await fs.readdir(this.directory);
      return files
        .filter(f => f.endsWith('.json'))
        .map(f => f.replace('.json', ''));
    } catch (error) {
      return [];
    }
  }
}