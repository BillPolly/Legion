/**
 * ServerSemanticSearchActor
 * Server-side actor for semantic search operations
 * Uses singleton ToolRegistry's semantic search capabilities
 */

export class ServerSemanticSearchActor {
  constructor(registryService) {
    this.registryService = registryService;
    this.registry = registryService.getRegistry();
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
          await this.semanticSearch(data.query, data.options);
          break;
          
        case 'search:tools':
          await this.searchTools(data.query, data.options);
          break;
          
        case 'search:similar':
          await this.findSimilarTools(data.toolName, data.options);
          break;
          
        case 'search:index':
          await this.indexTools();
          break;
          
        case 'search:stats':
          await this.getSearchStats();
          break;
          
        default:
          console.log('Unknown semantic search message:', type);
      }
    } catch (error) {
      console.error('Semantic search error:', error);
      if (this.remoteActor) {
        this.remoteActor.receive({
          type: 'search:error',
          data: { 
            error: error.message,
            operation: type,
            originalData: data
          }
        });
      }
    }
  }

  async semanticSearch(query, options = {}) {
    try {
      console.log(`Semantic search for: "${query}"`);
      
      // Check if semantic search is available
      if (!this.registry.semanticDiscovery) {
        console.log('Semantic search not available, falling back to text search');
        return await this.searchTools(query, options);
      }
      
      // Perform semantic search
      const results = await this.registry.semanticDiscovery.search(query, {
        limit: options.limit || 10,
        threshold: options.threshold || 0.7
      });
      
      console.log(`Found ${results.length} semantic matches`);
      
      if (this.remoteActor) {
        this.remoteActor.receive({
          type: 'search:semanticResults',
          data: {
            query,
            results,
            count: results.length
          }
        });
      }
    } catch (error) {
      console.error('Semantic search failed:', error);
      // Fall back to text search
      await this.searchTools(query, options);
    }
  }

  async searchTools(query, options = {}) {
    try {
      console.log(`Text search for tools: "${query}"`);
      
      // Use registry's searchTools method
      const results = await this.registry.searchTools(query, options);
      
      console.log(`Found ${results.length} text matches`);
      
      if (this.remoteActor) {
        this.remoteActor.receive({
          type: 'search:toolResults',
          data: {
            query,
            results,
            count: results.length
          }
        });
      }
    } catch (error) {
      console.error('Tool search failed:', error);
      throw error;
    }
  }

  async findSimilarTools(toolName, options = {}) {
    try {
      console.log(`Finding tools similar to: ${toolName}`);
      
      // First get the tool
      const tool = await this.registry.getTool(toolName);
      if (!tool) {
        throw new Error(`Tool not found: ${toolName}`);
      }
      
      // If semantic search is available, use it
      if (this.registry.semanticDiscovery && this.registry.semanticDiscovery.findSimilar) {
        const similar = await this.registry.semanticDiscovery.findSimilar(toolName, {
          limit: options.limit || 5
        });
        
        console.log(`Found ${similar.length} similar tools`);
        
        if (this.remoteActor) {
          this.remoteActor.receive({
            type: 'search:similarResults',
            data: {
              toolName,
              results: similar,
              count: similar.length
            }
          });
        }
      } else {
        // Fall back to searching by description keywords
        const description = tool.description || '';
        const keywords = description.split(' ').slice(0, 5).join(' ');
        await this.searchTools(keywords, options);
      }
    } catch (error) {
      console.error('Similar tools search failed:', error);
      throw error;
    }
  }

  async indexTools() {
    try {
      console.log('Indexing tools for semantic search...');
      
      // Send indexing started event
      if (this.remoteActor) {
        this.remoteActor.receive({
          type: 'search:indexingStarted',
          data: {}
        });
      }
      
      // Check if semantic indexing is available
      if (!this.registry.semanticDiscovery) {
        throw new Error('Semantic search not available');
      }
      
      // Get all tools
      const tools = await this.registry.listTools({ limit: 10000 });
      console.log(`Indexing ${tools.length} tools...`);
      
      // Index tools (if the semantic discovery supports it)
      if (this.registry.semanticDiscovery.indexTools) {
        const result = await this.registry.semanticDiscovery.indexTools(tools);
        
        console.log('Indexing complete:', result);
        
        if (this.remoteActor) {
          this.remoteActor.receive({
            type: 'search:indexingComplete',
            data: {
              indexed: tools.length,
              ...result
            }
          });
        }
      } else {
        // Semantic discovery might auto-index on search
        console.log('Auto-indexing enabled for semantic search');
        
        if (this.remoteActor) {
          this.remoteActor.receive({
            type: 'search:indexingComplete',
            data: {
              indexed: tools.length,
              mode: 'auto'
            }
          });
        }
      }
    } catch (error) {
      console.error('Tool indexing failed:', error);
      
      if (this.remoteActor) {
        this.remoteActor.receive({
          type: 'search:indexingFailed',
          data: { error: error.message }
        });
      }
    }
  }

  async getSearchStats() {
    try {
      console.log('Getting search statistics');
      
      const stats = {
        semanticSearchAvailable: !!this.registry.semanticDiscovery,
        textSearchAvailable: true,
        timestamp: new Date().toISOString()
      };
      
      // Add semantic search stats if available
      if (this.registry.semanticDiscovery) {
        if (this.registry.semanticDiscovery.getStats) {
          const semanticStats = await this.registry.semanticDiscovery.getStats();
          stats.semantic = semanticStats;
        } else {
          stats.semantic = {
            status: 'available',
            provider: this.registry.semanticDiscovery.constructor.name
          };
        }
      }
      
      // Add text search stats
      const provider = this.registryService.getProvider();
      if (provider && provider.db) {
        try {
          // Check if text index exists
          const indexes = await provider.db.collection('tools').indexes();
          const textIndex = indexes.find(idx => idx.textIndexVersion);
          
          stats.textSearch = {
            status: 'available',
            indexed: !!textIndex,
            indexName: textIndex?.name
          };
        } catch (error) {
          stats.textSearch = {
            status: 'error',
            error: error.message
          };
        }
      }
      
      console.log('Search stats:', stats);
      
      if (this.remoteActor) {
        this.remoteActor.receive({
          type: 'search:stats',
          data: stats
        });
      }
    } catch (error) {
      console.error('Failed to get search stats:', error);
      throw error;
    }
  }
}