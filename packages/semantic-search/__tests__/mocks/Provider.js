/**
 * Mock Provider class for testing
 */

export class Provider {
  constructor(config) {
    this.config = config;
    this.connected = false;
  }
  
  async connect() {
    this.connected = true;
  }
  
  async disconnect() {
    this.connected = false;
  }
  
  async find(collection, filter, options) {
    return [];
  }
  
  async findOne(collection, filter) {
    return null;
  }
  
  async insert(collection, documents) {
    return { insertedCount: Array.isArray(documents) ? documents.length : 1 };
  }
  
  async update(collection, filter, update) {
    return { modifiedCount: 1 };
  }
  
  async delete(collection, filter) {
    return { deletedCount: 1 };
  }
  
  isConnected() {
    return this.connected;
  }
  
  getCapabilities() {
    return ['find', 'insert', 'update', 'delete'];
  }
  
  getMetadata() {
    return { name: 'Provider', connected: this.connected };
  }
}