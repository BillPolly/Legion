import { SOPStorage } from './SOPStorage.js';
import { SOPLoader } from './SOPLoader.js';
import { SOPPerspectives } from './SOPPerspectives.js';
import { SOPSearch } from './SOPSearch.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const packageRoot = path.resolve(__dirname, '..');

export class SOPRegistry {
  static _instance = null;
  static _isInitialized = false;
  
  static async getInstance() {
    if (!SOPRegistry._instance) {
      const { ResourceManager } = await import('@legion/resource-manager');
      const resourceManager = await ResourceManager.getResourceManager();
      
      SOPRegistry._instance = new SOPRegistry({ resourceManager });
      await SOPRegistry._instance.initialize();
      SOPRegistry._isInitialized = true;
    }
    return SOPRegistry._instance;
  }
  
  static reset() {
    SOPRegistry._instance = null;
    SOPRegistry._isInitialized = false;
  }
  
  constructor({ resourceManager }) {
    if (SOPRegistry._instance) {
      throw new Error('SOPRegistry is a singleton. Use SOPRegistry.getInstance() instead.');
    }
    
    if (!resourceManager) {
      throw new Error('ResourceManager is required');
    }
    
    this.resourceManager = resourceManager;
    this.sopStorage = null;
    this.sopLoader = null;
    this.sopPerspectives = null;
    this.sopSearch = null;
    this.initialized = false;
  }
  
  async initialize() {
    if (this.initialized) return;
    
    this.sopStorage = new SOPStorage({ resourceManager: this.resourceManager });
    await this.sopStorage.initialize();
    
    this.sopLoader = new SOPLoader({
      sopStorage: this.sopStorage,
      packageRoot
    });
    
    this.sopPerspectives = new SOPPerspectives({
      resourceManager: this.resourceManager,
      sopStorage: this.sopStorage
    });
    await this.sopPerspectives.initialize();
    
    this.sopSearch = new SOPSearch({
      resourceManager: this.resourceManager,
      sopStorage: this.sopStorage
    });
    await this.sopSearch.initialize();
    
    this.initialized = true;
  }
  
  async loadAllSOPs(options = {}) {
    await this._ensureInitialized();
    return await this.sopLoader.loadAllFromDataDir();
  }
  
  async reloadSOPs(options = {}) {
    await this._ensureInitialized();
    await this.sopStorage.clearAll();
    const loadResult = await this.sopLoader.loadAllFromDataDir();
    
    if (options.regeneratePerspectives) {
      await this.sopPerspectives.generateForAllSOPs({ forceRegenerate: true });
    }
    
    return loadResult;
  }
  
  async getSOP(sopId) {
    await this._ensureInitialized();
    return await this.sopStorage.findSOP(sopId);
  }
  
  async getSOPByTitle(title) {
    await this._ensureInitialized();
    return await this.sopStorage.findSOPByTitle(title);
  }
  
  async listSOPs(filter = {}) {
    await this._ensureInitialized();
    return await this.sopStorage.findSOPs(filter);
  }
  
  async searchSOPs(query, options = {}) {
    await this._ensureInitialized();
    return await this.sopSearch.searchHybrid(query, options);
  }
  
  async searchSteps(query, options = {}) {
    await this._ensureInitialized();
    return await this.sopSearch.searchSteps(query, options);
  }
  
  async searchSOPsByIntent(intent) {
    await this._ensureInitialized();
    const results = await this.sopSearch.searchSemantic(intent, { topK: 20 });
    return results.filter(r => 
      r.matchedPerspectives.some(p => p.type === 'intent_perspective')
    );
  }
  
  async searchSOPsByTools(tools) {
    await this._ensureInitialized();
    return await this.sopStorage.findSOPs({
      toolsMentioned: { $in: tools }
    });
  }
  
  async searchSOPsByPreconditions(conditions) {
    await this._ensureInitialized();
    const results = await this.sopSearch.searchSemantic(conditions, { topK: 20 });
    return results.filter(r =>
      r.matchedPerspectives.some(p => p.type === 'preconditions_perspective')
    );
  }
  
  async generatePerspectives(sopId, options = {}) {
    await this._ensureInitialized();
    return await this.sopPerspectives.generateForSOP(sopId, options);
  }
  
  async generateAllPerspectives(options = {}) {
    await this._ensureInitialized();
    return await this.sopPerspectives.generateForAllSOPs(options);
  }
  
  async getStatistics() {
    await this._ensureInitialized();
    return await this.sopStorage.getStatistics();
  }
  
  async healthCheck() {
    await this._ensureInitialized();
    
    const dbHealthy = await this.sopStorage.healthCheck();
    
    return {
      healthy: dbHealthy,
      database: {
        connected: dbHealthy
      },
      perspectives: {
        initialized: this.sopPerspectives.initialized
      },
      search: {
        initialized: this.sopSearch.initialized
      }
    };
  }
  
  async cleanup() {
    if (this.sopStorage && this.sopStorage.isConnected()) {
      await this.sopStorage.close();
    }
  }
  
  async _ensureInitialized() {
    if (!this.initialized) {
      await this.initialize();
    }
  }
}