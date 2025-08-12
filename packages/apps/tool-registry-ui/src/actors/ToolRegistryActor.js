/**
 * ToolRegistryActor - Handles tool-related communication with server
 */

export class ToolRegistryActor {
  constructor(model, viewModel) {
    this.model = model;
    this.viewModel = viewModel;
    this.remoteActor = null;
  }

  setRemoteActor(remoteActor) {
    this.remoteActor = remoteActor;
    // Now we can communicate with the server
    this.viewModel.setActors(this, this.viewModel.dbActor, this.viewModel.searchActor);
  }

  // Receive messages from server
  async receive(message) {
    const { type, data } = message;
    
    switch (type) {
      case 'tools:list':
        this.model.setTools(data.tools);
        break;
        
      case 'modules:list':
        this.model.setModules(data.modules);
        break;
        
      case 'tool:executed':
        this.model.addExecutionResult(data.toolName, data.params, data.result);
        break;
        
      case 'tool:perspectives':
        this.model.setPerspectives(data.toolName, data.perspectives);
        break;
        
      case 'error':
        this.model.setError(data.error);
        break;
        
      default:
        console.log('Unknown message type:', type);
    }
  }

  // Send messages to server
  async loadTools() {
    if (!this.remoteActor) {
      throw new Error('Not connected to server');
    }
    
    return new Promise((resolve, reject) => {
      // Set up one-time listener for response
      const handleResponse = (message) => {
        if (message.type === 'tools:list') {
          resolve(message.data.tools);
        } else if (message.type === 'error') {
          reject(new Error(message.data.error));
        }
      };
      
      // Store handler for removal
      this._pendingHandler = handleResponse;
      
      // Send request
      this.remoteActor.receive({
        type: 'tools:load',
        data: {}
      });
      
      // Timeout after 10 seconds
      setTimeout(() => {
        if (this._pendingHandler) {
          this._pendingHandler = null;
          reject(new Error('Request timeout'));
        }
      }, 10000);
    });
  }

  async loadModules() {
    if (!this.remoteActor) {
      throw new Error('Not connected to server');
    }
    
    return new Promise((resolve, reject) => {
      const handleResponse = (message) => {
        if (message.type === 'modules:list') {
          resolve(message.data.modules);
        } else if (message.type === 'error') {
          reject(new Error(message.data.error));
        }
      };
      
      this._pendingHandler = handleResponse;
      
      this.remoteActor.receive({
        type: 'modules:load',
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

  async executeTool(toolName, params) {
    if (!this.remoteActor) {
      throw new Error('Not connected to server');
    }
    
    return new Promise((resolve, reject) => {
      const handleResponse = (message) => {
        if (message.type === 'tool:executed' && message.data.toolName === toolName) {
          resolve(message.data.result);
        } else if (message.type === 'error') {
          reject(new Error(message.data.error));
        }
      };
      
      this._pendingHandler = handleResponse;
      
      this.remoteActor.receive({
        type: 'tool:execute',
        data: { toolName, params }
      });
      
      setTimeout(() => {
        if (this._pendingHandler) {
          this._pendingHandler = null;
          reject(new Error('Tool execution timeout'));
        }
      }, 30000); // 30 second timeout for tool execution
    });
  }

  async getToolPerspectives(toolName) {
    if (!this.remoteActor) {
      throw new Error('Not connected to server');
    }
    
    return new Promise((resolve, reject) => {
      const handleResponse = (message) => {
        if (message.type === 'tool:perspectives' && message.data.toolName === toolName) {
          resolve(message.data.perspectives);
        } else if (message.type === 'error') {
          reject(new Error(message.data.error));
        }
      };
      
      this._pendingHandler = handleResponse;
      
      this.remoteActor.receive({
        type: 'tool:get-perspectives',
        data: { toolName }
      });
      
      setTimeout(() => {
        if (this._pendingHandler) {
          this._pendingHandler = null;
          resolve([]); // Return empty array on timeout
        }
      }, 5000);
    });
  }
}