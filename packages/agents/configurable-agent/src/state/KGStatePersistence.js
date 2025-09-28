/**
 * KGStatePersistence - Uses Handle architecture for agent state persistence
 * 
 * Integrates with the new Handle pattern using TripleStoreDataSource.
 * Supports multiple storage backends: memory, file, and MongoDB.
 */

// Import Handle architecture components
import { TripleStoreDataSource } from '@legion/triplestore';
import { InMemoryTripleStore } from '@legion/triplestore';
import { FileSystemTripleStore } from '@legion/triplestore';

// MongoDB triple store is not available yet, so we'll handle it gracefully
let MongoTripleStore = null;

import { AgentState } from './AgentState.js';
import { StateError } from '../utils/ErrorHandling.js';

/**
 * Manages agent state persistence using the Knowledge Graph
 */
export class KGStatePersistence {
  constructor(options = {}) {
    this.agentId = options.agentId || `agent-${Date.now()}`;
    this.storageType = options.storageType || 'memory';
    this.storageConfig = options.storageConfig || {};
    
    // TripleStore DataSource and store
    this.dataSource = null;
    this.tripleStore = null;
    this.initialized = false;
    
    // Namespace for agent state triples
    this.namespace = `legion:agent:${this.agentId}`;
  }

  /**
   * Initialize the KG persistence system
   */
  async initialize() {
    if (this.initialized) {
      return;
    }

    try {
      // Create the appropriate triple store based on storage type
      this.tripleStore = await this._createTripleStore();
      
      // Wrap triple store with DataSource interface
      this.dataSource = new TripleStoreDataSource(this.tripleStore);
      
      this.initialized = true;
    } catch (error) {
      throw new StateError(
        `Failed to initialize KG persistence: ${error.message}`,
        'kg-init',
        { storageType: this.storageType }
      );
    }
  }

  /**
   * Save agent state to knowledge graph
   * @param {AgentState} state - State to save
   * @returns {Promise<boolean>} Success status
   */
  async saveState(state) {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      const stateId = `${this.namespace}:state`;
      const timestamp = Date.now();
      
      // Clear existing state triples for this agent
      await this._clearAgentTriples();
      
      // Store metadata
      await this._addTriple(stateId, 'rdf:type', 'agent:State');
      await this._addTriple(stateId, 'agent:agentId', this.agentId);
      await this._addTriple(stateId, 'agent:savedAt', timestamp);
      
      // Store configuration
      const configId = `${stateId}:config`;
      await this._addTriple(stateId, 'agent:hasConfig', configId);
      await this._addTriple(configId, 'agent:maxMessages', state.config.maxMessages);
      await this._addTriple(configId, 'agent:pruningStrategy', state.config.pruningStrategy);
      
      // Store conversation history
      const historyId = `${stateId}:history`;
      await this._addTriple(stateId, 'agent:hasHistory', historyId);
      
      for (let i = 0; i < state.conversationHistory.length; i++) {
        const message = state.conversationHistory[i];
        const messageId = `${historyId}:msg${i}`;
        
        await this._addTriple(historyId, 'agent:hasMessage', messageId);
        await this._addTriple(messageId, 'agent:index', i);
        await this._addTriple(messageId, 'agent:role', message.role);
        await this._addTriple(messageId, 'agent:content', message.content);
        await this._addTriple(messageId, 'agent:timestamp', message.timestamp);
        await this._addTriple(messageId, 'agent:id', message.id);
        
        if (message.importance !== undefined) {
          await this._addTriple(messageId, 'agent:importance', message.importance);
        }
      }
      
      // Store context variables
      const contextId = `${stateId}:context`;
      await this._addTriple(stateId, 'agent:hasContext', contextId);
      
      for (const [key, value] of Object.entries(state.contextVariables)) {
        const varId = `${contextId}:${key}`;
        await this._addTriple(contextId, 'agent:hasVariable', varId);
        await this._addTriple(varId, 'agent:key', key);
        await this._addTriple(varId, 'agent:value', JSON.stringify(value));
        await this._addTriple(varId, 'agent:type', typeof value);
      }
      
      // Store state metadata
      const metadataId = `${stateId}:metadata`;
      await this._addTriple(stateId, 'agent:hasMetadata', metadataId);
      await this._addTriple(metadataId, 'agent:createdAt', state.metadata.createdAt);
      await this._addTriple(metadataId, 'agent:lastUpdated', state.metadata.lastUpdated);
      await this._addTriple(metadataId, 'agent:messageCount', state.metadata.messageCount);
      
      if (state.metadata.lastCleared) {
        await this._addTriple(metadataId, 'agent:lastCleared', state.metadata.lastCleared);
      }
      
      return true;
    } catch (error) {
      console.error(`Failed to save state to KG: ${error.message}`);
      return false;
    }
  }

  /**
   * Load agent state from knowledge graph
   * @returns {Promise<AgentState|null>} Loaded state or null
   */
  async loadState() {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      const stateId = `${this.namespace}:state`;
      
      // Check if state exists
      const stateExists = await this._exists(stateId, 'rdf:type', 'agent:State');
      if (!stateExists) {
        return null;
      }
      
      // Load configuration
      const configTriples = await this._query(stateId, 'agent:hasConfig', null);
      if (configTriples.length === 0) {
        return null;
      }
      
      const configId = configTriples[0][2];
      const maxMessages = await this._getValue(configId, 'agent:maxMessages');
      const pruningStrategy = await this._getValue(configId, 'agent:pruningStrategy');
      
      // Create state with config
      const state = new AgentState({
        maxMessages: maxMessages || 100,
        pruningStrategy: pruningStrategy || 'sliding-window'
      });
      
      // Load conversation history
      const historyTriples = await this._query(stateId, 'agent:hasHistory', null);
      if (historyTriples.length > 0) {
        const historyId = historyTriples[0][2];
        const messageTriples = await this._query(historyId, 'agent:hasMessage', null);
        
        // Collect and sort messages by index
        const messages = [];
        for (const [,, messageId] of messageTriples) {
          const index = await this._getValue(messageId, 'agent:index');
          const role = await this._getValue(messageId, 'agent:role');
          const content = await this._getValue(messageId, 'agent:content');
          const timestamp = await this._getValue(messageId, 'agent:timestamp');
          const id = await this._getValue(messageId, 'agent:id');
          const importance = await this._getValue(messageId, 'agent:importance');
          
          messages.push({
            index,
            message: {
              role,
              content,
              timestamp,
              id,
              ...(importance !== null && { importance })
            }
          });
        }
        
        // Sort by index and add to state
        messages.sort((a, b) => a.index - b.index);
        state.conversationHistory = messages.map(m => m.message);
      }
      
      // Load context variables
      const contextTriples = await this._query(stateId, 'agent:hasContext', null);
      if (contextTriples.length > 0) {
        const contextId = contextTriples[0][2];
        const varTriples = await this._query(contextId, 'agent:hasVariable', null);
        
        for (const [,, varId] of varTriples) {
          const key = await this._getValue(varId, 'agent:key');
          const valueStr = await this._getValue(varId, 'agent:value');
          const type = await this._getValue(varId, 'agent:type');
          
          if (key && valueStr) {
            try {
              const value = JSON.parse(valueStr);
              state.contextVariables[key] = value;
            } catch {
              // If JSON parse fails, use raw value
              state.contextVariables[key] = valueStr;
            }
          }
        }
      }
      
      // Load metadata
      const metadataTriples = await this._query(stateId, 'agent:hasMetadata', null);
      if (metadataTriples.length > 0) {
        const metadataId = metadataTriples[0][2];
        
        const createdAt = await this._getValue(metadataId, 'agent:createdAt');
        const lastUpdated = await this._getValue(metadataId, 'agent:lastUpdated');
        const messageCount = await this._getValue(metadataId, 'agent:messageCount');
        const lastCleared = await this._getValue(metadataId, 'agent:lastCleared');
        
        state.metadata = {
          createdAt: createdAt || Date.now(),
          lastUpdated: lastUpdated || Date.now(),
          messageCount: messageCount || state.conversationHistory.length,
          lastCleared: lastCleared || null
        };
      }
      
      return state;
    } catch (error) {
      console.error(`Failed to load state from KG: ${error.message}`);
      return null;
    }
  }

  /**
   * Delete agent state from knowledge graph
   * @returns {Promise<boolean>} Success status
   */
  async deleteState() {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      await this._clearAgentTriples();
      return true;
    } catch (error) {
      console.error(`Failed to delete state from KG: ${error.message}`);
      return false;
    }
  }

  /**
   * Clean up resources
   */
  async cleanup() {
    if (this.tripleStore && typeof this.tripleStore.close === 'function') {
      await this.tripleStore.close();
    }
    this.initialized = false;
  }

  // Private helper methods

  async _createTripleStore() {
    switch (this.storageType) {
      case 'memory':
        return new InMemoryTripleStore();
        
      case 'file':
        const filePath = this.storageConfig.filePath || `./state/${this.agentId}.ttl`;
        return new FileSystemTripleStore(filePath, {
          format: this.storageConfig.format || 'turtle'
        });
        
      case 'mongodb':
        // FAIL FAST - MongoDB triple store not yet implemented
        throw new Error(
          'MongoDB triple store is not yet implemented. ' +
          'Please use "memory" or "file" storage type instead. ' +
          'NO FALLBACK - failing fast as per project requirements.'
        );
        
      default:
        throw new Error(`Unsupported storage type: ${this.storageType}`);
    }
  }

  async _addTriple(subject, predicate, object) {
    if (!this.tripleStore || !this.tripleStore.addTriple) {
      throw new Error(
        'Triple store does not support addTriple method. ' +
        'NO FALLBACK - failing fast as per project requirements.'
      );
    }
    return await this.tripleStore.addTriple(subject, predicate, object);
  }

  async _query(subject, predicate, object) {
    if (!this.tripleStore || !this.tripleStore.query) {
      throw new Error(
        'Triple store does not support query method. ' +
        'NO FALLBACK - failing fast as per project requirements.'
      );
    }
    return await this.tripleStore.query(subject, predicate, object);
  }

  async _exists(subject, predicate, object) {
    if (!this.tripleStore || !this.tripleStore.exists) {
      throw new Error(
        'Triple store does not support exists method. ' +
        'NO FALLBACK - failing fast as per project requirements.'
      );
    }
    return await this.tripleStore.exists(subject, predicate, object);
  }

  async _getValue(subject, predicate) {
    const results = await this._query(subject, predicate, null);
    return results.length > 0 ? results[0][2] : null;
  }

  async _clearAgentTriples() {
    // Query all triples with this agent's namespace as subject
    const triples = await this._query(null, null, null);
    
    for (const [subject, predicate, object] of triples) {
      if (subject.startsWith(this.namespace)) {
        if (this.tripleStore.removeTriple) {
          await this.tripleStore.removeTriple(subject, predicate, object);
        } else {
          throw new Error('Triple store does not support removeTriple method');
        }
      }
    }
  }
}

/**
 * Create a KG-based persistence manager
 * @param {Object} config - Configuration object
 * @returns {KGStatePersistence} Persistence manager instance
 */
export function createKGPersistence(config) {
  return new KGStatePersistence(config);
}