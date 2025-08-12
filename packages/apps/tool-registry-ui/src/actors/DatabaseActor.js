/**
 * DatabaseActor - Handles database-related communication with server
 */

export class DatabaseActor {
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
      case 'collections:list':
        this.model.setCollections(data.collections);
        break;
        
      case 'collection:data':
        this.model.updateCollectionData(data.collectionName, data);
        break;
        
      case 'documents:list':
        if (this.model.selectedCollection) {
          this.model.updateCollectionData(this.model.selectedCollection.name, {
            documents: data.documents,
            count: data.count
          });
        }
        break;
        
      case 'error':
        this.model.setError(data.error);
        break;
        
      default:
        console.log('Unknown database message type:', type);
    }
  }

  // Send messages to server
  async listCollections() {
    if (!this.remoteActor) {
      throw new Error('Not connected to server');
    }
    
    return new Promise((resolve, reject) => {
      const handleResponse = (message) => {
        if (message.type === 'collections:list') {
          resolve(message.data.collections);
        } else if (message.type === 'error') {
          reject(new Error(message.data.error));
        }
      };
      
      this._pendingHandler = handleResponse;
      
      this.remoteActor.receive({
        type: 'collections:load',
        data: {}
      });
      
      setTimeout(() => {
        if (this._pendingHandler) {
          this._pendingHandler = null;
          reject(new Error('Request timeout'));
        }
      }, 10000);
    });
  }

  async getCollectionData(collectionName, options = {}) {
    if (!this.remoteActor) {
      throw new Error('Not connected to server');
    }
    
    return new Promise((resolve, reject) => {
      const handleResponse = (message) => {
        if (message.type === 'collection:data' && message.data.collectionName === collectionName) {
          resolve(message.data);
        } else if (message.type === 'error') {
          reject(new Error(message.data.error));
        }
      };
      
      this._pendingHandler = handleResponse;
      
      this.remoteActor.receive({
        type: 'collection:get-data',
        data: { 
          collectionName,
          limit: options.limit || 20,
          skip: options.skip || 0,
          query: options.query || {}
        }
      });
      
      setTimeout(() => {
        if (this._pendingHandler) {
          this._pendingHandler = null;
          reject(new Error('Request timeout'));
        }
      }, 10000);
    });
  }

  async queryCollection(collectionName, query) {
    if (!this.remoteActor) {
      throw new Error('Not connected to server');
    }
    
    return new Promise((resolve, reject) => {
      const handleResponse = (message) => {
        if (message.type === 'documents:list') {
          resolve(message.data.documents);
        } else if (message.type === 'error') {
          reject(new Error(message.data.error));
        }
      };
      
      this._pendingHandler = handleResponse;
      
      this.remoteActor.receive({
        type: 'collection:query',
        data: { 
          collectionName,
          query
        }
      });
      
      setTimeout(() => {
        if (this._pendingHandler) {
          this._pendingHandler = null;
          reject(new Error('Query timeout'));
        }
      }, 15000);
    });
  }

  async getCollectionStats(collectionName) {
    if (!this.remoteActor) {
      throw new Error('Not connected to server');
    }
    
    return new Promise((resolve, reject) => {
      const handleResponse = (message) => {
        if (message.type === 'collection:stats') {
          resolve(message.data);
        } else if (message.type === 'error') {
          reject(new Error(message.data.error));
        }
      };
      
      this._pendingHandler = handleResponse;
      
      this.remoteActor.receive({
        type: 'collection:get-stats',
        data: { collectionName }
      });
      
      setTimeout(() => {
        if (this._pendingHandler) {
          this._pendingHandler = null;
          reject(new Error('Request timeout'));
        }
      }, 5000);
    });
  }
}