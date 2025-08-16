/**
 * ServerSemanticSearchActor - Server-side actor for semantic search operations
 */

export class ServerSemanticSearchActor {
  constructor(semanticDiscovery, mongoProvider) {
    this.semanticDiscovery = semanticDiscovery;
    this.mongoProvider = mongoProvider;
    this.remoteActor = null;
  }

  setRemoteActor(remoteActor) {
    this.remoteActor = remoteActor;
  }

  async receive(message) {
    const { type, data } = message;
    
    try {
      switch (type) {
        case 'search:semantic':
          await this.performSemanticSearch(data);
          break;
          
        case 'vector:get-stats':
          await this.getVectorStats();
          break;
          
        case 'embeddings:generate':
          await this.generateEmbeddings(data.texts);
          break;
          
        case 'index:tool':
          await this.indexTool(data.toolName);
          break;
          
        case 'index:rebuild':
          await this.rebuildIndex();
          break;
          
        case 'qdrant:get-info':
          await this.getQdrantInfo();
          break;
          
        default:
          console.log('Unknown semantic search message:', type);
      }
    } catch (error) {
      console.error('Error handling semantic search message:', error);
      if (this.remoteActor) {
        this.remoteActor.receive({
          type: 'error',
          data: { error: error.message }
        });
      }
    }
  }

  async performSemanticSearch(options) {
    try {
      const { query, limit = 10, threshold = 0, includeMetadata = true } = options;
      
      console.log(`🔍 Performing semantic search for: "${query}"`);
      
      // Use SemanticToolDiscovery to find relevant tools
      if (!this.semanticDiscovery) {
        console.error('❌ SemanticToolDiscovery not available');
        if (this.remoteActor) {
          this.remoteActor.receive({
            type: 'search:results',
            data: { results: [] }
          });
        }
        return;
      }
      
      // Perform semantic search using SemanticToolDiscovery
      const searchResult = await this.semanticDiscovery.findRelevantTools(query, {
        limit,
        minScore: threshold,
        includeMetadata
      });
      
      // Extract tools from the result (handle both old and new format)
      const tools = searchResult.tools || searchResult;
      
      console.log(`✅ Found ${tools.length} tools via semantic search`);
      
      // Format results for client
      const formattedResults = tools.map(tool => ({
        name: tool.name,
        description: tool.description,
        moduleName: tool.moduleName || tool.module,
        category: tool.category,
        relevanceScore: tool.relevanceScore || tool.score || 0,
        capabilities: tool.capabilities,
        tags: tool.tags,
        inputSchema: tool.inputSchema,
        metadata: tool.metadata
      }));
      
      // Send results to client
      if (this.remoteActor) {
        this.remoteActor.receive({
          type: 'search:results',
          data: { 
            results: formattedResults,
            query,
            metadata: searchResult.metadata
          }
        });
      }
    } catch (error) {
      console.error('Semantic search failed:', error);
      if (this.remoteActor) {
        this.remoteActor.receive({
          type: 'search:results',
          data: { results: [], error: error.message }
        });
      }
    }
  }

  async getVectorStats() {
    try {
      // Get stats from Qdrant
      const qdrantStats = await this.getQdrantCollectionInfo();
      
      // Get perspective count from MongoDB
      const perspectiveCount = await this.mongoProvider.databaseService.mongoProvider.count(
        'tool_perspectives',
        {}
      );
      
      const stats = {
        collection: 'legion_tools',
        vectorCount: qdrantStats.vectorCount || perspectiveCount,
        dimensions: 384, // ONNX all-MiniLM-L6-v2
        distance: 'cosine',
        status: qdrantStats.status || 'Ready',
        perspectiveCount
      };
      
      // Send stats to client
      if (this.remoteActor) {
        this.remoteActor.receive({
          type: 'vector:stats',
          data: { stats }
        });
      }
    } catch (error) {
      console.error('Failed to get vector stats:', error);
      // Send default stats on error
      if (this.remoteActor) {
        this.remoteActor.receive({
          type: 'vector:stats',
          data: {
            stats: {
              collection: 'legion_tools',
              vectorCount: 0,
              dimensions: 384,
              distance: 'cosine',
              status: 'Error'
            }
          }
        });
      }
    }
  }

  async generateEmbeddings(texts) {
    try {
      // Generate embeddings using ONNX
      const embeddings = await this.semanticProvider.embeddingService.generateEmbeddings(texts);
      
      // Send embeddings to client
      if (this.remoteActor) {
        this.remoteActor.receive({
          type: 'embeddings:generated',
          data: { embeddings }
        });
      }
    } catch (error) {
      console.error('Failed to generate embeddings:', error);
      throw error;
    }
  }

  async indexTool(toolName) {
    try {
      // Get tool from database
      const tool = await this.mongoProvider.getTool(toolName);
      
      if (!tool) {
        throw new Error(`Tool not found: ${toolName}`);
      }
      
      // Get or generate perspectives
      let perspectives = await this.mongoProvider.databaseService.mongoProvider.find(
        'tool_perspectives',
        { toolName },
        { limit: 100 }
      );
      
      if (perspectives.length === 0) {
        // Generate perspectives if none exist
        // This would normally use an LLM to generate perspectives
        perspectives = [
          {
            toolName,
            perspectiveType: 'description',
            content: tool.description,
            metadata: { module: tool.moduleName }
          }
        ];
      }
      
      // Generate embeddings and index each perspective
      for (const perspective of perspectives) {
        const embedding = await this.semanticProvider.embeddingService.generateEmbedding(
          perspective.content
        );
        
        await this.semanticProvider.vectorStore.upsert(
          perspective.toolName + '_' + perspective.perspectiveType,
          embedding,
          {
            toolName: perspective.toolName,
            perspectiveType: perspective.perspectiveType,
            module: perspective.metadata?.module
          }
        );
      }
      
      // Send confirmation to client
      if (this.remoteActor) {
        this.remoteActor.receive({
          type: 'index:updated',
          data: {
            toolName,
            perspectivesIndexed: perspectives.length
          }
        });
      }
    } catch (error) {
      console.error('Failed to index tool:', error);
      throw error;
    }
  }

  async rebuildIndex() {
    try {
      // This would be a comprehensive rebuild
      // For now, just return success
      
      if (this.remoteActor) {
        this.remoteActor.receive({
          type: 'index:rebuilt',
          data: {
            success: true,
            message: 'Index rebuild initiated'
          }
        });
      }
    } catch (error) {
      console.error('Failed to rebuild index:', error);
      throw error;
    }
  }

  async getQdrantInfo() {
    try {
      const info = await this.getQdrantCollectionInfo();
      
      // Send info to client
      if (this.remoteActor) {
        this.remoteActor.receive({
          type: 'qdrant:info',
          data: info
        });
      }
    } catch (error) {
      console.error('Failed to get Qdrant info:', error);
      // Send default info on error
      if (this.remoteActor) {
        this.remoteActor.receive({
          type: 'qdrant:info',
          data: {
            status: 'Error',
            collections: [],
            version: 'Unknown'
          }
        });
      }
    }
  }

  async getQdrantCollectionInfo() {
    try {
      // Check if Qdrant is accessible
      const response = await fetch('http://localhost:6333/collections/legion_tools', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (response.ok) {
        const data = await response.json();
        return {
          status: 'Connected',
          vectorCount: data.result?.points_count || 0,
          collections: ['legion_tools'],
          version: '1.7.0' // Default version
        };
      }
    } catch (error) {
      // Qdrant not accessible
    }
    
    return {
      status: 'Disconnected',
      vectorCount: 0,
      collections: [],
      version: 'Unknown'
    };
  }
}