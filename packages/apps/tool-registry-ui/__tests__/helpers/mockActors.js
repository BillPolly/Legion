/**
 * Mock Actor implementations for testing
 */

export class MockToolRegistryActor {
  constructor() {
    this.remoteAgent = null;
    this.receivedMessages = [];
  }
  
  setRemoteAgent(remoteAgent) {
    this.remoteAgent = remoteAgent;
  }
  
  async receive(message) {
    this.receivedMessages.push(message);
    
    switch (message.type) {
      case 'list_tools':
        return this._mockListTools();
      case 'get_tool':
        return this._mockGetTool(message.toolName);
      case 'execute_tool':
        return this._mockExecuteTool(message.toolName, message.args);
      case 'search_tools':
        return this._mockSearchTools(message.query);
      default:
        return { error: 'Unknown message type' };
    }
  }
  
  _mockListTools() {
    return {
      type: 'tools_list',
      tools: [
        {
          name: 'file_write',
          module: 'file',
          description: 'Write content to a file',
          inputSchema: {
            type: 'object',
            properties: {
              filepath: { type: 'string' },
              content: { type: 'string' }
            }
          }
        },
        {
          name: 'calculator',
          module: 'calculator',
          description: 'Evaluate mathematical expressions',
          inputSchema: {
            type: 'object',
            properties: {
              expression: { type: 'string' }
            }
          }
        },
        {
          name: 'json_parse',
          module: 'json',
          description: 'Parse JSON string to object',
          inputSchema: {
            type: 'object',
            properties: {
              jsonString: { type: 'string' }
            }
          }
        }
      ]
    };
  }
  
  _mockGetTool(toolName) {
    const tools = this._mockListTools().tools;
    const tool = tools.find(t => t.name === toolName);
    
    if (tool) {
      return { type: 'tool_details', tool };
    } else {
      return { type: 'error', error: `Tool not found: ${toolName}` };
    }
  }
  
  _mockExecuteTool(toolName, args) {
    // Simulate tool execution
    const results = {
      file_write: { success: true, message: 'File written successfully' },
      calculator: { success: true, result: 42 },
      json_parse: { success: true, result: { parsed: true } }
    };
    
    const result = results[toolName] || { success: false, error: 'Unknown tool' };
    
    return {
      type: 'tool_result',
      toolName,
      result
    };
  }
  
  _mockSearchTools(query) {
    const allTools = this._mockListTools().tools;
    const filtered = allTools.filter(t => 
      t.name.includes(query) || 
      t.description.toLowerCase().includes(query.toLowerCase())
    );
    
    return {
      type: 'search_results',
      tools: filtered
    };
  }
}

export class MockDatabaseActor {
  constructor() {
    this.remoteAgent = null;
    this.receivedMessages = [];
  }
  
  setRemoteAgent(remoteAgent) {
    this.remoteAgent = remoteAgent;
  }
  
  async receive(message) {
    this.receivedMessages.push(message);
    
    switch (message.type) {
      case 'list_collections':
        return this._mockListCollections();
      case 'get_documents':
        return this._mockGetDocuments(message.collection, message.query);
      case 'get_stats':
        return this._mockGetStats();
      default:
        return { error: 'Unknown message type' };
    }
  }
  
  _mockListCollections() {
    return {
      type: 'collections_list',
      collections: [
        { name: 'tools', count: 45 },
        { name: 'modules', count: 12 },
        { name: 'tool_perspectives', count: 180 }
      ]
    };
  }
  
  _mockGetDocuments(collection, query = {}) {
    const mockDocs = {
      tools: [
        { _id: '1', name: 'file_write', module: 'file' },
        { _id: '2', name: 'file_read', module: 'file' }
      ],
      modules: [
        { _id: '1', name: 'file', type: 'class' },
        { _id: '2', name: 'calculator', type: 'class' }
      ],
      tool_perspectives: [
        { _id: '1', toolId: '1', perspective: 'usage', content: 'Use this to write files' }
      ]
    };
    
    return {
      type: 'documents',
      collection,
      documents: mockDocs[collection] || [],
      total: (mockDocs[collection] || []).length
    };
  }
  
  _mockGetStats() {
    return {
      type: 'database_stats',
      stats: {
        totalCollections: 3,
        totalDocuments: 237,
        totalSize: '1.2 MB'
      }
    };
  }
}

export class MockSemanticSearchActor {
  constructor() {
    this.remoteAgent = null;
    this.receivedMessages = [];
  }
  
  setRemoteAgent(remoteAgent) {
    this.remoteAgent = remoteAgent;
  }
  
  async receive(message) {
    this.receivedMessages.push(message);
    
    switch (message.type) {
      case 'search':
        return this._mockSearch(message.query);
      case 'get_collections':
        return this._mockGetCollections();
      case 'generate_embedding':
        return this._mockGenerateEmbedding(message.text);
      default:
        return { error: 'Unknown message type' };
    }
  }
  
  _mockSearch(query) {
    return {
      type: 'search_results',
      results: [
        {
          id: '1',
          score: 0.95,
          payload: {
            toolName: 'file_write',
            perspective: 'usage',
            content: 'Write content to files on the filesystem'
          }
        },
        {
          id: '2',
          score: 0.87,
          payload: {
            toolName: 'file_read',
            perspective: 'example',
            content: 'Read file content from the filesystem'
          }
        }
      ]
    };
  }
  
  _mockGetCollections() {
    return {
      type: 'vector_collections',
      collections: [
        {
          name: 'tool_perspectives',
          vectors_count: 180,
          dimension: 384,
          status: 'green'
        }
      ]
    };
  }
  
  _mockGenerateEmbedding(text) {
    // Generate mock 384-dimensional embedding
    const embedding = new Array(384).fill(0).map(() => Math.random() - 0.5);
    
    return {
      type: 'embedding',
      embedding,
      dimension: 384
    };
  }
}

// Helper to create a mock ActorSpace for testing
export function createMockActorSpace() {
  const actors = new Map();
  
  return {
    register: (actor, guid) => {
      actors.set(guid, actor);
    },
    
    handleIncomingMessage: async (message) => {
      const actor = actors.get(message.targetGuid);
      if (actor) {
        return await actor.receive(message.payload);
      }
      return { error: 'Actor not found' };
    },
    
    addChannel: (ws) => {
      return {
        makeRemote: (guid) => ({
          guid,
          receive: async (payload) => {
            // Simulate sending through WebSocket
            ws.send(JSON.stringify({ targetGuid: guid, payload }));
            return { sent: true };
          }
        })
      };
    }
  };
}

// Helper to create connected mock actors
export function createConnectedMockActors() {
  const toolRegistryActor = new MockToolRegistryActor();
  const databaseActor = new MockDatabaseActor();
  const semanticSearchActor = new MockSemanticSearchActor();
  
  // Create mock remote agents
  const mockRemotes = {
    toolRegistry: {
      receive: async (msg) => toolRegistryActor.receive(msg)
    },
    database: {
      receive: async (msg) => databaseActor.receive(msg)
    },
    semanticSearch: {
      receive: async (msg) => semanticSearchActor.receive(msg)
    }
  };
  
  // Connect actors to their remotes
  toolRegistryActor.setRemoteAgent(mockRemotes.toolRegistry);
  databaseActor.setRemoteAgent(mockRemotes.database);
  semanticSearchActor.setRemoteAgent(mockRemotes.semanticSearch);
  
  return {
    toolRegistryActor,
    databaseActor,
    semanticSearchActor,
    remotes: mockRemotes
  };
}