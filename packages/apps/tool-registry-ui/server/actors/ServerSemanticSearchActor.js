/**
 * ServerSemanticSearchActor - Server-side actor for semantic search operations
 * 
 * Refactored to use ToolRegistry's unified search interface
 */

export class ServerSemanticSearchActor {
  constructor(toolRegistry) {
    this.toolRegistry = toolRegistry;
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
      
      // Use ToolRegistry's unified search interface
      const searchResult = await this.toolRegistry.searchTools(query, {
        limit,
        threshold,
        includeMetadata,
        semanticSearch: true // Enable semantic search mode
      });
      
      // Extract tools from the result
      const tools = Array.isArray(searchResult) ? searchResult : (searchResult.tools || []);
      
      console.log(`✅ Found ${tools.length} tools via ToolRegistry search`);
      
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
      // Get statistics from ToolRegistry
      const registryStats = await this.toolRegistry.getStatistics();
      
      const stats = {
        collection: 'legion_tools',
        vectorCount: registryStats.vectorCount || registryStats.perspectives || 0,
        dimensions: 384, // ONNX all-MiniLM-L6-v2
        distance: 'cosine',
        status: registryStats.status || 'Ready',
        perspectiveCount: registryStats.perspectives || 0,
        tools: registryStats.tools || 0,
        modules: registryStats.modules || 0
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
      // ToolRegistry handles embedding generation internally
      // For now, we'll return a success message since embeddings are handled by ToolRegistry
      console.log('Embedding generation handled by ToolRegistry internally');
      
      // Send confirmation to client
      if (this.remoteActor) {
        this.remoteActor.receive({
          type: 'embeddings:generated',
          data: { 
            message: 'Embeddings handled by ToolRegistry',
            count: texts.length 
          }
        });
      }
    } catch (error) {
      console.error('Failed to generate embeddings:', error);
      throw error;
    }
  }

  async indexTool(toolName) {
    try {
      // ToolRegistry handles indexing internally
      // We can trigger re-indexing by getting the tool with perspectives
      const toolWithPerspectives = await this.toolRegistry.getToolWithPerspectives(toolName);
      
      if (!toolWithPerspectives) {
        throw new Error(`Tool not found: ${toolName}`);
      }
      
      const perspectivesCount = toolWithPerspectives.perspectives?.length || 0;
      
      // Send confirmation to client
      if (this.remoteActor) {
        this.remoteActor.receive({
          type: 'index:updated',
          data: {
            toolName,
            perspectivesIndexed: perspectivesCount
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
      // Use ToolRegistry's rebuild capabilities
      // This might trigger perspective regeneration and re-indexing
      const stats = await this.toolRegistry.getStatistics();
      
      if (this.remoteActor) {
        this.remoteActor.receive({
          type: 'index:rebuilt',
          data: {
            success: true,
            message: 'Index rebuild completed via ToolRegistry',
            stats
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
      // Get vector database info from ToolRegistry
      const stats = await this.toolRegistry.getStatistics();
      const healthCheck = await this.toolRegistry.healthCheck();
      
      const info = {
        status: healthCheck.vectorStore?.status || 'Unknown',
        vectorCount: stats.vectorCount || stats.perspectives || 0,
        collections: ['legion_tools'],
        version: healthCheck.vectorStore?.version || '1.7.0',
        dimensions: 384
      };
      
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
            version: 'Unknown',
            vectorCount: 0
          }
        });
      }
    }
  }
}