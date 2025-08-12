/**
 * SemanticSearchActor - Handles semantic search and vector operations
 */

export class SemanticSearchActor {
  constructor(model, viewModel) {
    this.model = model;
    this.viewModel = viewModel;
    this.remoteActor = null;
  }

  setRemoteActor(remoteActor) {
    this.remoteActor = remoteActor;
  }

  // Receive messages from server
  async receive(message) {
    const { type, data } = message;
    
    switch (type) {
      case 'search:results':
        this.model.setSearchResults(data.results);
        break;
        
      case 'vector:stats':
        this.model.setVectorStats(data.stats);
        break;
        
      case 'embeddings:generated':
        // Could store embeddings if needed
        console.log('Embeddings generated for:', data.toolName);
        break;
        
      case 'index:updated':
        console.log('Vector index updated:', data);
        // Could trigger a refresh
        break;
        
      case 'error':
        this.model.setError(data.error);
        break;
        
      default:
        console.log('Unknown search message type:', type);
    }
  }

  // Send messages to server
  async semanticSearch(query, options = {}) {
    if (!this.remoteActor) {
      throw new Error('Not connected to server');
    }
    
    return new Promise((resolve, reject) => {
      const handleResponse = (message) => {
        if (message.type === 'search:results') {
          resolve(message.data.results);
        } else if (message.type === 'error') {
          reject(new Error(message.data.error));
        }
      };
      
      this._pendingHandler = handleResponse;
      
      this.remoteActor.receive({
        type: 'search:semantic',
        data: {
          query,
          limit: options.limit || 10,
          threshold: options.threshold || 0.5,
          includeMetadata: options.includeMetadata || false,
          collection: options.collection || 'legion_tools'
        }
      });
      
      setTimeout(() => {
        if (this._pendingHandler) {
          this._pendingHandler = null;
          reject(new Error('Search timeout'));
        }
      }, 15000);
    });
  }

  async getVectorStats() {
    if (!this.remoteActor) {
      throw new Error('Not connected to server');
    }
    
    return new Promise((resolve, reject) => {
      const handleResponse = (message) => {
        if (message.type === 'vector:stats') {
          resolve(message.data.stats);
        } else if (message.type === 'error') {
          reject(new Error(message.data.error));
        }
      };
      
      this._pendingHandler = handleResponse;
      
      this.remoteActor.receive({
        type: 'vector:get-stats',
        data: {}
      });
      
      setTimeout(() => {
        if (this._pendingHandler) {
          this._pendingHandler = null;
          resolve({
            collection: 'legion_tools',
            vectorCount: 0,
            dimensions: 384,
            distance: 'cosine',
            status: 'Unknown'
          });
        }
      }, 5000);
    });
  }

  async generateEmbeddings(texts) {
    if (!this.remoteActor) {
      throw new Error('Not connected to server');
    }
    
    return new Promise((resolve, reject) => {
      const handleResponse = (message) => {
        if (message.type === 'embeddings:generated') {
          resolve(message.data.embeddings);
        } else if (message.type === 'error') {
          reject(new Error(message.data.error));
        }
      };
      
      this._pendingHandler = handleResponse;
      
      this.remoteActor.receive({
        type: 'embeddings:generate',
        data: { texts }
      });
      
      setTimeout(() => {
        if (this._pendingHandler) {
          this._pendingHandler = null;
          reject(new Error('Embedding generation timeout'));
        }
      }, 30000);
    });
  }

  async indexTool(toolName) {
    if (!this.remoteActor) {
      throw new Error('Not connected to server');
    }
    
    return new Promise((resolve, reject) => {
      const handleResponse = (message) => {
        if (message.type === 'index:updated') {
          resolve(message.data);
        } else if (message.type === 'error') {
          reject(new Error(message.data.error));
        }
      };
      
      this._pendingHandler = handleResponse;
      
      this.remoteActor.receive({
        type: 'index:tool',
        data: { toolName }
      });
      
      setTimeout(() => {
        if (this._pendingHandler) {
          this._pendingHandler = null;
          reject(new Error('Indexing timeout'));
        }
      }, 10000);
    });
  }

  async rebuildIndex() {
    if (!this.remoteActor) {
      throw new Error('Not connected to server');
    }
    
    return new Promise((resolve, reject) => {
      const handleResponse = (message) => {
        if (message.type === 'index:rebuilt') {
          resolve(message.data);
        } else if (message.type === 'error') {
          reject(new Error(message.data.error));
        }
      };
      
      this._pendingHandler = handleResponse;
      
      this.remoteActor.receive({
        type: 'index:rebuild',
        data: {}
      });
      
      setTimeout(() => {
        if (this._pendingHandler) {
          this._pendingHandler = null;
          reject(new Error('Index rebuild timeout'));
        }
      }, 60000); // 1 minute timeout for full rebuild
    });
  }

  async getQdrantInfo() {
    if (!this.remoteActor) {
      throw new Error('Not connected to server');
    }
    
    return new Promise((resolve, reject) => {
      const handleResponse = (message) => {
        if (message.type === 'qdrant:info') {
          resolve(message.data);
        } else if (message.type === 'error') {
          reject(new Error(message.data.error));
        }
      };
      
      this._pendingHandler = handleResponse;
      
      this.remoteActor.receive({
        type: 'qdrant:get-info',
        data: {}
      });
      
      setTimeout(() => {
        if (this._pendingHandler) {
          this._pendingHandler = null;
          resolve({
            status: 'Unavailable',
            collections: [],
            version: 'Unknown'
          });
        }
      }, 5000);
    });
  }
}