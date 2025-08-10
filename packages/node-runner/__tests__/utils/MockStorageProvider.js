/**
 * @fileoverview Mock storage provider for integration testing
 */

export class MockStorageProvider {
  constructor() {
    this.data = new Map();
  }

  async store(collection, record) {
    if (!this.data.has(collection)) {
      this.data.set(collection, new Map());
    }
    
    const id = record.logId || record.sessionId || record.processId || Date.now().toString();
    this.data.get(collection).set(id, record);
    return record;
  }

  async get(collection, id) {
    if (!this.data.has(collection)) {
      return null;
    }
    return this.data.get(collection).get(id) || null;
  }

  async update(collection, id, updates) {
    if (!this.data.has(collection)) {
      return null;
    }
    
    const existing = this.data.get(collection).get(id);
    if (!existing) {
      return null;
    }
    
    const updated = { ...existing, ...updates };
    this.data.get(collection).set(id, updated);
    return updated;
  }

  async delete(collection, id) {
    if (!this.data.has(collection)) {
      return false;
    }
    return this.data.get(collection).delete(id);
  }

  async query(collection, filter = {}) {
    if (!this.data.has(collection)) {
      return [];
    }
    
    const records = Array.from(this.data.get(collection).values());
    
    // Simple filter implementation
    return records.filter(record => {
      for (const [key, value] of Object.entries(filter)) {
        if (record[key] !== value) {
          return false;
        }
      }
      return true;
    });
  }

  async count(collection, filter = {}) {
    const results = await this.query(collection, filter);
    return results.length;
  }

  async clear(collection) {
    if (this.data.has(collection)) {
      this.data.get(collection).clear();
    }
  }

  async clearAll() {
    this.data.clear();
  }
}