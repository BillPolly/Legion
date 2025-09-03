import { Module } from '@legion/tools-registry';
import { createValidator } from '@legion/schema';
import { fileURLToPath } from 'url';
import IndexContentTool from './tools/IndexContentTool.js';
import SearchContentTool from './tools/SearchContentTool.js';
import QueryRAGTool from './tools/QueryRAGTool.js';
import ManageIndexTool from './tools/ManageIndexTool.js';

const semanticSearchConfigSchema = {
  type: 'object',
  properties: {
    mongodb: {
      type: 'object',
      properties: {
        database: {
          type: 'string',
          default: 'semantic_search'
        },
        collections: {
          type: 'object',
          properties: {
            documents: {
              type: 'string',
              default: 'documents'
            },
            chunks: {
              type: 'string',
              default: 'document_chunks'
            }
          },
          default: {}
        }
      },
      default: {}
    },
    qdrant: {
      type: 'object',
      properties: {
        collection: {
          type: 'string',
          default: 'semantic_content'
        },
        dimensions: {
          type: 'number',
          default: 768
        },
        distance: {
          type: 'string',
          default: 'cosine'
        }
      },
      default: {}
    },
    processing: {
      type: 'object',
      properties: {
        defaultChunkSize: {
          type: 'number',
          default: 800
        },
        defaultOverlap: {
          type: 'number',
          default: 0.2
        },
        maxFileSize: {
          type: 'number',
          default: 52428800  // 50MB
        },
        supportedFileTypes: {
          type: 'array',
          items: { type: 'string' },
          default: ['.txt', '.md', '.json', '.yaml', '.js', '.py', '.java', '.go', '.html']
        }
      },
      default: {}
    }
  },
  default: {}
};

const SemanticSearchConfigValidator = createValidator(semanticSearchConfigSchema);

class RAGModule extends Module {
  constructor() {
    super();
    this.name = 'rag';
    this.description = 'RAG (Retrieval-Augmented Generation) module for indexing and searching content';
    this.version = '1.0.0';
    
    // Set metadata path for automatic loading
    this.metadataPath = './tools-metadata.json';
    
    this.resourceManager = null;
    this.config = null;
  }

  /**
   * Override getModulePath to support proper path resolution
   */
  getModulePath() {
    return fileURLToPath(import.meta.url);
  }

  /**
   * Static async factory method following the standard interface
   */
  static async create(resourceManager) {
    const module = new RAGModule();
    module.resourceManager = resourceManager;
    await module.initialize();
    return module;
  }

  loadConfig(providedConfig = {}) {
    const envConfig = {
      mongodb: {
        database: this.resourceManager.get('env.SEMANTIC_SEARCH_DB_NAME') || 'semantic_search',
        collections: {
          documents: this.resourceManager.get('env.SEMANTIC_SEARCH_DOCS_COLLECTION') || 'documents',
          chunks: this.resourceManager.get('env.SEMANTIC_SEARCH_CHUNKS_COLLECTION') || 'document_chunks'
        }
      },
      qdrant: {
        collection: this.resourceManager.get('env.SEMANTIC_SEARCH_QDRANT_COLLECTION') || 'semantic_content',
        dimensions: parseInt(this.resourceManager.get('env.SEMANTIC_SEARCH_DIMENSIONS') || '768'),
        distance: this.resourceManager.get('env.SEMANTIC_SEARCH_DISTANCE') || 'cosine'
      },
      processing: {
        defaultChunkSize: parseInt(this.resourceManager.get('env.SEMANTIC_SEARCH_CHUNK_SIZE') || '800'),
        defaultOverlap: parseFloat(this.resourceManager.get('env.SEMANTIC_SEARCH_OVERLAP') || '0.2'),
        maxFileSize: parseInt(this.resourceManager.get('env.SEMANTIC_SEARCH_MAX_FILE_SIZE') || '52428800'),
        supportedFileTypes: this.resourceManager.get('env.SEMANTIC_SEARCH_FILE_TYPES')?.split(',') || 
                           ['.txt', '.md', '.json', '.yaml', '.js', '.py', '.java', '.go', '.html']
      }
    };

    const mergedConfig = this._deepMerge(envConfig, providedConfig);
    const result = SemanticSearchConfigValidator.validate(mergedConfig);
    if (!result.valid) {
      throw new Error(`Semantic search configuration validation failed: ${result.errors.map(e => e.message).join(', ')}`);
    }
    return result.data;
  }

  async initialize() {
    await super.initialize(); // This will load metadata automatically
    
    // Load config using resourceManager
    try {
      this.config = this.loadConfig({});
    } catch (error) {
      // If validation fails, use defaults
      this.config = {
        mongodb: {
          database: 'semantic_search',
          collections: {
            documents: 'documents',
            chunks: 'document_chunks'
          }
        },
        qdrant: {
          collection: 'semantic_content',
          dimensions: 768,
          distance: 'cosine'
        },
        processing: {
          defaultChunkSize: 800,
          defaultOverlap: 0.2,
          maxFileSize: 52428800,
          supportedFileTypes: ['.txt', '.md', '.json', '.yaml', '.js', '.py', '.java', '.go', '.html']
        }
      };
    }
    
    // Initialize tools using metadata
    this.initializeTools();
    
    try {
      // Test that required services are available
      const embeddingService = this.resourceManager.get('embeddingService');
      const vectorStore = this.resourceManager.get('vectorStore');
      
      if (embeddingService || vectorStore) {
        this.info('Semantic search module services detected');
      }
      
      return true;
    } catch (error) {
      // Don't throw, just log - module can still be loaded
      this.warning(`Semantic search module initialization warning: ${error.message}`);
      return true;
    }
  }

  /**
   * Get configuration (without sensitive data)
   */
  getConfig() {
    return {
      mongodb: this.config.mongodb,
      qdrant: this.config.qdrant,
      processing: this.config.processing
    };
  }

  /**
   * Initialize tools for this module
   */
  initializeTools() {
    const tools = [
      { key: 'index_content', class: IndexContentTool },
      { key: 'search_content', class: SearchContentTool },
      { key: 'query_rag', class: QueryRAGTool },
      { key: 'manage_index', class: ManageIndexTool }
    ];

    for (const { key, class: ToolClass } of tools) {
      const tool = this.createToolFromMetadata(key, ToolClass);
      // Pass semantic search module reference to tool for execution
      tool.semanticSearchModule = this;
      this.registerTool(tool.name, tool);
    }
  }

  /**
   * Cleanup resources
   */
  async cleanup() {
    if (this.initialized) {
      this.info('Semantic search module cleanup completed');
    }
    await super.cleanup();
  }

  /**
   * Deep merge two objects
   */
  _deepMerge(target, source) {
    const result = { ...target };
    
    for (const key in source) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        result[key] = this._deepMerge(target[key] || {}, source[key]);
      } else {
        result[key] = source[key];
      }
    }
    
    return result;
  }
}

export default RAGModule;