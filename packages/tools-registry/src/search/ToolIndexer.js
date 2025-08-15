/**
 * ToolIndexer - Automatic indexing of Legion tools for semantic search
 * 
 * This service processes tool metadata and generates searchable embeddings
 * to enable intelligent tool discovery based on task descriptions.
 */

import { DocumentProcessor } from './DocumentProcessor.js';
import { ObjectId } from 'mongodb';

export class ToolIndexer {
  constructor(dependencies = {}) {
    this.embeddingService = dependencies.embeddingService;
    this.vectorStore = dependencies.vectorStore;
    this.documentProcessor = dependencies.documentProcessor || new DocumentProcessor();
    this.collectionName = dependencies.collectionName || 'legion_tools';
    this.mongoProvider = dependencies.mongoProvider; // For storing perspectives in MongoDB
    this.indexedTools = new Map();
    this.batchSize = dependencies.batchSize || 50;
  }

  /**
   * Create ToolIndexer with enforced local ONNX embeddings for tool indexing
   * @param {ResourceManager} resourceManager - Initialized ResourceManager
   * @param {Object} options - Configuration options
   * @returns {Promise<ToolIndexer>} ToolIndexer instance with local ONNX embeddings
   */
  static async createForTools(resourceManager, options = {}) {
    console.log('🔧 Creating ToolIndexer with local ONNX embeddings for tools');
    
    // Import SemanticSearchProvider to get embedding service
    const { SemanticSearchProvider } = await import('../../../semantic-search/src/SemanticSearchProvider.js');
    const toolSemanticProvider = await SemanticSearchProvider.create(resourceManager);
    
    console.log('✅ ToolIndexer configured with local ONNX embedding service');
    
    // Get MongoDB provider from ResourceManager for perspectives storage
    const { StorageProvider } = await import('@legion/storage');
    const storageProvider = await StorageProvider.create(resourceManager);
    const mongoProvider = storageProvider.getProvider('mongodb');
    
    // Create ToolIndexer with local embedding service + MongoDB
    return new ToolIndexer({
      embeddingService: toolSemanticProvider.embeddingService,
      vectorStore: toolSemanticProvider.vectorStore,
      documentProcessor: toolSemanticProvider.documentProcessor,
      mongoProvider: mongoProvider,
      collectionName: options.collectionName || 'legion_tools',
      batchSize: options.batchSize || 50
    });
  }

  /**
   * Index a single tool with its metadata using 3-collection architecture
   * @param {Object} tool - Tool instance with name, description, etc.
   * @param {Object} metadata - Additional metadata (category, tags, usage patterns) 
   * @param {string|Object} toolId - MongoDB ObjectId of the tool (from tools collection)
   * @returns {Promise<Object>} Indexing result
   */
  async indexTool(tool, metadata = {}, toolId = null) {
    if (!tool.name) {
      throw new Error('Tool must have a name');
    }

    if (!toolId) {
      throw new Error('toolId is required for 3-collection architecture');
    }

    // Ensure toolId is a proper ObjectId
    if (typeof toolId === 'string') {
      try {
        toolId = new ObjectId(toolId);
      } catch (error) {
        throw new Error(`Invalid toolId format: ${toolId}. Must be a valid ObjectId.`);
      }
    } else if (!(toolId instanceof ObjectId)) {
      throw new Error(`toolId must be ObjectId or valid ObjectId string, got: ${typeof toolId}`);
    }

    if (!this.mongoProvider) {
      throw new Error('MongoDB provider is required for perspective storage');
    }

    // Check if already indexed
    if (this.indexedTools.has(tool.name)) {
      console.log(`Tool ${tool.name} already indexed, updating...`);
      // Clean up existing perspectives for this tool
      await this.mongoProvider.delete('tool_perspectives', { toolId: toolId });
    }

    // Create searchable document from tool
    const document = this.createToolDocument(tool, metadata);
    
    // Generate multiple perspective entries for better retrieval
    const perspectives = this.createMultiplePerspectives(document);
    
    // Generate embeddings for all perspectives
    const searchTexts = perspectives.map(p => p.text);
    const embeddings = await this.embeddingService.generateEmbeddings(searchTexts);
    
    const timestamp = Date.now();
    const perspectiveRecords = [];
    const vectors = [];

    // Create perspective records for MongoDB and vectors for vector DB
    for (let i = 0; i < perspectives.length; i++) {
      const perspective = perspectives[i];
      const embedding = embeddings[i];
      const embeddingId = `tool_${tool.name}_${perspective.type}_${timestamp}`;

      // MongoDB perspective record (full context)
      const perspectiveRecord = {
        toolId: toolId,
        toolName: tool.name,
        perspectiveType: perspective.type,
        perspectiveText: perspective.text,
        embeddingId: embeddingId,
        embedding: embedding, // Store the actual embedding vector
        embeddingModel: 'all-MiniLM-L6-v2', // ONNX model used for embeddings
        generatedAt: new Date(),
        generationMethod: 'automatic',
        metadata: {
          toolCategory: document.category,
          documentLength: perspective.text.length
        }
      };
      perspectiveRecords.push(perspectiveRecord);

      // Vector DB record (minimal payload for efficiency)
      const vectorRecord = {
        id: embeddingId,
        vector: embedding,
        payload: {
          perspectiveId: null, // Will be filled after MongoDB insert
          toolId: toolId.toString(),
          toolName: tool.name,
          perspectiveType: perspective.type
        }
      };
      vectors.push(vectorRecord);
    }

    // Store perspectives in MongoDB first
    const insertResults = [];
    for (const record of perspectiveRecords) {
      try {
        console.log(`[DEBUG] Inserting perspective: ${record.perspectiveType} for tool ${record.toolName}`);
        console.log(`[DEBUG] Record structure:`, {
          toolId: record.toolId.toString(),
          toolIdType: typeof record.toolId,
          toolName: record.toolName,
          perspectiveType: record.perspectiveType,
          perspectiveTextLength: record.perspectiveText.length,
          hasEmbeddingId: !!record.embeddingId,
          hasGeneratedAt: !!record.generatedAt
        });
        
        const inserted = await this.mongoProvider.insert('tool_perspectives', record);
        insertResults.push(inserted);
        const insertedId = Object.values(inserted.insertedIds)[0];
        console.log(`[DEBUG] Successfully inserted perspective: ${insertedId.toString().slice(-6)}...`);
      } catch (insertError) {
        console.error(`[ERROR] Failed to insert perspective:`, insertError.message);
        console.error(`[ERROR] Failed record:`, JSON.stringify(record, null, 2));
        throw new Error(`Document failed validation: ${insertError.message}`);
      }
    }
    
    // Update vector payloads with MongoDB perspective IDs
    for (let i = 0; i < vectors.length; i++) {
      const insertedId = Object.values(insertResults[i].insertedIds)[0];
      vectors[i].payload.perspectiveId = insertedId.toString();
    }

    // Store embeddings with minimal payloads in vector database
    await this.vectorStore.upsert(this.collectionName, vectors);
    
    // Track indexed tool
    this.indexedTools.set(tool.name, {
      indexedAt: new Date(),
      document,
      metadata,
      perspectiveCount: vectors.length,
      toolId: toolId
    });

    return {
      success: true,
      toolName: tool.name,
      toolId: toolId,
      perspectivesIndexed: vectors.length,
      perspectiveIds: insertResults.map(r => Object.values(r.insertedIds)[0]),
      embeddingIds: vectors.map(v => v.id)
    };
  }

  /**
   * Index multiple tools individually (simplified for 3-collection architecture)
   * @param {Array} tools - Array of {tool, metadata, toolId} objects
   * @returns {Promise<Object>} Batch indexing results
   */
  async indexTools(tools) {
    const results = {
      success: [],
      failed: [],
      totalProcessed: 0
    };

    // Process each tool individually to keep things simple and reliable
    for (const item of tools) {
      try {
        const tool = item.tool || item;
        const metadata = item.metadata || {};
        const toolId = item.toolId;

        if (!toolId) {
          throw new Error('toolId is required for each tool in batch processing');
        }

        const result = await this.indexTool(tool, metadata, toolId);
        results.success.push({
          toolName: result.toolName,
          toolId: result.toolId,
          perspectivesIndexed: result.perspectivesIndexed
        });
      } catch (error) {
        results.failed.push({
          tool: item.tool?.name || item.name,
          error: error.message
        });
      }

      results.totalProcessed++;
    }

    return results;
  }

  /**
   * Create a searchable document from a tool
   * @private
   */
  createToolDocument(tool, metadata = {}) {
    // Extract tool information
    const document = {
      // Core properties
      name: tool.name,
      description: tool.description || '',
      category: metadata.category || tool.category || 'general',
      tags: metadata.tags || tool.tags || [],
      
      // Schema information
      inputSchema: this.extractSchemaInfo(tool.inputSchema || tool.schema),
      outputSchema: this.extractSchemaInfo(tool.outputSchema),
      
      // Capabilities and usage
      capabilities: this.extractCapabilities(tool),
      examples: metadata.examples || tool.examples || [],
      usagePatterns: metadata.usagePatterns || [],
      
      // Relationships
      dependencies: metadata.dependencies || [],
      relatedTools: metadata.relatedTools || [],
      commonlyUsedWith: metadata.commonlyUsedWith || [],
      
      // Metadata
      author: metadata.author || tool.author,
      version: metadata.version || tool.version,
      module: metadata.module,
      indexedAt: new Date().toISOString()
    };

    // Add function-specific metadata for multi-function tools
    if (tool.functions && Array.isArray(tool.functions)) {
      document.functions = tool.functions.map(fn => ({
        name: fn.name,
        description: fn.description,
        parameters: this.extractSchemaInfo(fn.parameters)
      }));
    }

    return document;
  }

  /**
   * Extract schema information for better search
   * @private
   */
  extractSchemaInfo(schema) {
    if (!schema) return null;

    // Handle Zod schemas
    if (schema._def) {
      return this.extractZodSchema(schema);
    }

    // Handle JSON schemas
    if (schema.type || schema.properties) {
      return this.extractJsonSchema(schema);
    }

    // Handle OpenAI function schemas
    if (schema.parameters) {
      return this.extractJsonSchema(schema.parameters);
    }

    return schema;
  }

  /**
   * Extract Zod schema information
   * @private
   */
  extractZodSchema(schema) {
    const info = {
      type: schema._def.typeName?.replace('Zod', '').toLowerCase()
    };

    if (schema._def.shape) {
      info.properties = Object.keys(schema._def.shape());
    }

    if (schema.description) {
      info.description = schema.description;
    }

    return info;
  }

  /**
   * Extract JSON schema information
   * @private
   */
  extractJsonSchema(schema) {
    const info = {
      type: schema.type
    };

    if (schema.properties) {
      info.properties = Object.entries(schema.properties).map(([key, value]) => ({
        name: key,
        type: value.type,
        description: value.description,
        required: schema.required?.includes(key)
      }));
    }

    if (schema.description) {
      info.description = schema.description;
    }

    return info;
  }

  /**
   * Extract tool capabilities from its properties
   * @private
   */
  extractCapabilities(tool) {
    const capabilities = [];

    // Analyze tool name for capabilities
    const namePatterns = {
      'read': 'data reading',
      'write': 'data writing',
      'create': 'resource creation',
      'delete': 'resource deletion',
      'update': 'resource modification',
      'fetch': 'data retrieval',
      'search': 'searching',
      'analyze': 'analysis',
      'generate': 'content generation',
      'validate': 'validation',
      'transform': 'data transformation',
      'execute': 'code execution',
      'deploy': 'deployment',
      'test': 'testing',
      'debug': 'debugging'
    };

    const nameLower = tool.name.toLowerCase();
    for (const [pattern, capability] of Object.entries(namePatterns)) {
      if (nameLower.includes(pattern)) {
        capabilities.push(capability);
      }
    }

    // Analyze description for capabilities
    const description = (tool.description || '').toLowerCase();
    const descPatterns = {
      'api': 'API integration',
      'database': 'database operations',
      'file': 'file operations',
      'network': 'network operations',
      'auth': 'authentication',
      'encrypt': 'encryption',
      'compress': 'compression',
      'parse': 'parsing',
      'format': 'formatting',
      'convert': 'conversion',
      'monitor': 'monitoring',
      'log': 'logging',
      'cache': 'caching',
      'queue': 'queue operations',
      'schedule': 'scheduling'
    };

    for (const [pattern, capability] of Object.entries(descPatterns)) {
      if (description.includes(pattern) && !capabilities.includes(capability)) {
        capabilities.push(capability);
      }
    }

    return capabilities;
  }

  /**
   * Create multiple perspective entries for a tool
   * @private
   */
  createMultiplePerspectives(document) {
    const perspectives = [];
    
    // 1. Name-focused perspective (short, direct)
    perspectives.push({
      type: 'name',
      text: `${document.name} ${document.name.replace(/_/g, ' ')}`
    });
    
    // 2. Description perspective (task-oriented)
    if (document.description) {
      perspectives.push({
        type: 'description',
        text: document.description
      });
      
      // Also create a task-oriented version
      perspectives.push({
        type: 'task',
        text: `${document.description} using ${document.name} tool`
      });
    }
    
    // 3. Capability perspective (action-focused)
    if (document.capabilities && document.capabilities.length > 0) {
      perspectives.push({
        type: 'capabilities',
        text: `${document.capabilities.join(' ')} capability tool`
      });
      
      // Create individual capability entries for strong matching
      document.capabilities.forEach(cap => {
        perspectives.push({
          type: 'capability_single',
          text: `${cap} ${document.name} ${document.category}`
        });
      });
    }
    
    // 4. Example perspective (real usage scenarios)
    if (document.examples && document.examples.length > 0) {
      perspectives.push({
        type: 'examples',
        text: document.examples.join(' ')
      });
    }
    
    // 5. Category/domain perspective
    perspectives.push({
      type: 'category',
      text: `${document.category} operations ${document.tags.join(' ')}`
    });
    
    // 6. Input/output perspective (for technical matching)
    if (document.inputSchema?.properties) {
      const inputs = document.inputSchema.properties.map(p => p.name).join(' ');
      perspectives.push({
        type: 'inputs',
        text: `accepts ${inputs} parameters input`
      });
    }
    
    // 7. Combined short gloss (focused summary)
    perspectives.push({
      type: 'gloss',
      text: `${document.name} ${document.category} ${document.description || ''}`
    });
    
    // 8. Synonym and variation perspective
    const nameVariations = this.generateNameVariations(document.name);
    if (nameVariations.length > 0) {
      perspectives.push({
        type: 'synonyms',
        text: nameVariations.join(' ')
      });
    }
    
    return perspectives;
  }
  
  /**
   * Generate name variations and synonyms
   * @private
   */
  generateNameVariations(name) {
    const variations = [];
    
    // Split by underscore and create variations
    const parts = name.split('_');
    variations.push(parts.join(' '));
    variations.push(parts.join('-'));
    
    // Add common synonyms based on patterns
    const synonymMap = {
      'read': ['load', 'fetch', 'get', 'retrieve'],
      'write': ['save', 'store', 'put', 'create'],
      'delete': ['remove', 'destroy', 'drop', 'clear'],
      'update': ['modify', 'change', 'edit', 'patch'],
      'list': ['enumerate', 'show', 'display', 'get all'],
      'query': ['search', 'find', 'select', 'lookup'],
      'execute': ['run', 'invoke', 'call', 'perform'],
      'test': ['verify', 'check', 'validate', 'assert'],
      'build': ['create', 'construct', 'compile', 'make'],
      'parse': ['analyze', 'process', 'interpret', 'decode']
    };
    
    for (const [key, synonyms] of Object.entries(synonymMap)) {
      if (name.toLowerCase().includes(key)) {
        synonyms.forEach(syn => {
          variations.push(name.toLowerCase().replace(key, syn));
        });
      }
    }
    
    return variations;
  }

  /**
   * Generate searchable text from document
   * @private
   */
  generateSearchText(document) {
    const parts = [];

    // Add name and description
    parts.push(`Tool: ${document.name}`);
    if (document.description) {
      parts.push(`Description: ${document.description}`);
    }

    // Add category and tags
    parts.push(`Category: ${document.category}`);
    if (document.tags.length > 0) {
      parts.push(`Tags: ${document.tags.join(', ')}`);
    }

    // Add capabilities
    if (document.capabilities.length > 0) {
      parts.push(`Capabilities: ${document.capabilities.join(', ')}`);
    }

    // Add input/output information
    if (document.inputSchema?.properties) {
      const inputs = document.inputSchema.properties.map(p => p.name).join(', ');
      parts.push(`Inputs: ${inputs}`);
    }

    // Add function information
    if (document.functions) {
      const functionNames = document.functions.map(f => f.name).join(', ');
      parts.push(`Functions: ${functionNames}`);
    }

    // Add examples
    if (document.examples.length > 0) {
      parts.push(`Examples: ${document.examples.slice(0, 3).join('; ')}`);
    }

    // Add usage patterns
    if (document.usagePatterns.length > 0) {
      parts.push(`Usage: ${document.usagePatterns.join(', ')}`);
    }

    // Add related tools
    if (document.relatedTools.length > 0) {
      parts.push(`Related: ${document.relatedTools.join(', ')}`);
    }

    return parts.join('. ');
  }

  /**
   * Update tool usage patterns based on execution history
   * @param {string} toolName - Tool name
   * @param {Object} usageData - Usage pattern data
   */
  async updateToolUsage(toolName, usageData) {
    const indexed = this.indexedTools.get(toolName);
    if (!indexed) {
      console.warn(`Tool ${toolName} not indexed, cannot update usage`);
      return;
    }

    // Update usage patterns
    if (!indexed.document.usagePatterns) {
      indexed.document.usagePatterns = [];
    }

    // Add new usage pattern
    indexed.document.usagePatterns.push({
      context: usageData.context,
      timestamp: new Date(),
      success: usageData.success,
      relatedTools: usageData.relatedTools || []
    });

    // Keep only recent patterns
    if (indexed.document.usagePatterns.length > 100) {
      indexed.document.usagePatterns = indexed.document.usagePatterns.slice(-100);
    }

    // Re-index with updated patterns
    await this.indexTool(
      { name: toolName, ...indexed.document },
      indexed.metadata
    );
  }

  /**
   * Remove tool from index
   * @param {string} toolName - Tool name to remove
   */
  async removeTool(toolName) {
    const documentId = `tool_${toolName}`;
    
    try {
      await this.vectorStore.delete(this.collectionName, {
        id: documentId
      });
      
      this.indexedTools.delete(toolName);
      
      return { success: true, removed: toolName };
    } catch (error) {
      console.error(`Failed to remove tool ${toolName}:`, error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Clear all indexed tools
   */
  async clearIndex() {
    try {
      // Delete all vectors in collection
      await this.vectorStore.deleteCollection(this.collectionName);
      await this.vectorStore.createCollection(this.collectionName, {
        vectorSize: 384 // ONNX all-MiniLM-L6-v2 embedding size
      });
      
      this.indexedTools.clear();
      
      return { success: true, message: 'Index cleared' };
    } catch (error) {
      console.error('Failed to clear index:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get indexing statistics
   */
  getStatistics() {
    const tools = Array.from(this.indexedTools.values());
    
    const categoryCounts = {};
    const tagCounts = {};
    
    tools.forEach(item => {
      // Count categories
      const category = item.document.category;
      categoryCounts[category] = (categoryCounts[category] || 0) + 1;
      
      // Count tags
      item.document.tags.forEach(tag => {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1;
      });
    });

    return {
      totalIndexed: this.indexedTools.size,
      categories: categoryCounts,
      tags: tagCounts,
      lastIndexed: tools.length > 0 ? 
        Math.max(...tools.map(t => new Date(t.indexedAt).getTime())) : null
    };
  }
}