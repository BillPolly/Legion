/**
 * ToolIndexer - Automatic indexing of Legion tools for semantic search
 * 
 * This service processes tool metadata and generates searchable embeddings
 * to enable intelligent tool discovery based on task descriptions.
 */

import { DocumentProcessor } from '../utils/DocumentProcessor.js';
import crypto from 'crypto';

export class ToolIndexer {
  constructor(dependencies = {}) {
    this.embeddingService = dependencies.embeddingService;
    this.vectorStore = dependencies.vectorStore;
    this.documentProcessor = dependencies.documentProcessor || new DocumentProcessor();
    this.collectionName = dependencies.collectionName || 'legion_tools';
    this.indexedTools = new Map();
    this.batchSize = dependencies.batchSize || 50;
  }

  /**
   * Index a single tool with its metadata
   * @param {Object} tool - Tool instance with name, description, etc.
   * @param {Object} metadata - Additional metadata (category, tags, usage patterns)
   * @returns {Promise<Object>} Indexing result
   */
  async indexTool(tool, metadata = {}) {
    if (!tool.name) {
      throw new Error('Tool must have a name');
    }

    // Check if already indexed
    if (this.indexedTools.has(tool.name)) {
      console.log(`Tool ${tool.name} already indexed, updating...`);
    }

    // Create searchable document from tool
    const document = this.createToolDocument(tool, metadata);
    
    // Generate multiple perspective entries for better retrieval
    const perspectives = this.createMultiplePerspectives(document);
    
    // Generate embeddings for all perspectives
    const searchTexts = perspectives.map(p => p.text);
    const embeddings = await this.embeddingService.generateEmbeddings(searchTexts);
    
    // Create vectors for each perspective using UUID format for Qdrant compatibility
    const vectors = perspectives.map((perspective, index) => ({
      id: this._generateToolUUID(tool.name, perspective.type),
      vector: embeddings[index],
      payload: {
        originalId: `tool_${tool.name}_${perspective.type}`, // Store original ID for debugging
        ...document,
        perspectiveType: perspective.type,
        perspectiveText: perspective.text
      }
    }));

    // Store all vectors in database
    await this.vectorStore.upsert(this.collectionName, vectors);
    
    // Track indexed tool
    this.indexedTools.set(tool.name, {
      indexedAt: new Date(),
      document,
      metadata,
      perspectiveCount: vectors.length
    });

    return {
      success: true,
      toolName: tool.name,
      perspectivesIndexed: vectors.length,
      documentIds: vectors.map(v => v.id)
    };
  }

  /**
   * Index multiple tools in batch
   * @param {Array} tools - Array of tools to index
   * @returns {Promise<Object>} Batch indexing results
   */
  async indexTools(tools) {
    const results = {
      success: [],
      failed: [],
      totalProcessed: 0
    };

    // Process in batches
    for (let i = 0; i < tools.length; i += this.batchSize) {
      const batch = tools.slice(i, i + this.batchSize);
      const allVectors = [];
      const toolDocuments = [];

      // Prepare documents and perspectives for each tool
      for (const item of batch) {
        try {
          const tool = item.tool || item;
          const metadata = item.metadata || {};
          const document = this.createToolDocument(tool, metadata);
          const perspectives = this.createMultiplePerspectives(document);
          
          toolDocuments.push({ document, perspectives, tool: tool.name });
        } catch (error) {
          results.failed.push({
            tool: item.tool?.name || item.name,
            error: error.message
          });
        }
      }

      // Generate embeddings for all perspectives in batch
      if (toolDocuments.length > 0) {
        try {
          // Collect all search texts
          const allSearchTexts = [];
          const textToToolMap = [];
          
          toolDocuments.forEach(({ document, perspectives, tool }) => {
            perspectives.forEach(perspective => {
              allSearchTexts.push(perspective.text);
              textToToolMap.push({ document, perspective, tool });
            });
          });
          
          // Generate embeddings for all texts
          const embeddings = await this.embeddingService.generateEmbeddings(allSearchTexts);
          
          // Create vectors with proper mapping using UUID format for Qdrant compatibility
          const vectors = textToToolMap.map((mapping, index) => ({
            id: this._generateToolUUID(mapping.tool, mapping.perspective.type),
            vector: embeddings[index],
            payload: {
              originalId: `tool_${mapping.tool}_${mapping.perspective.type}`, // Store original ID for debugging
              ...mapping.document,
              perspectiveType: mapping.perspective.type,
              perspectiveText: mapping.perspective.text
            }
          }));

          // Store in vector database
          await this.vectorStore.upsert(this.collectionName, vectors);
          
          // Track indexed tools
          toolDocuments.forEach(({ document, tool }) => {
            // Count perspectives for this tool based on originalId in payload
            const toolVectorCount = vectors.filter(v => 
              v.payload.originalId && v.payload.originalId.startsWith(`tool_${tool}_`)
            ).length;
            
            this.indexedTools.set(tool, {
              indexedAt: new Date(),
              document: document,
              metadata: {},
              perspectiveCount: toolVectorCount
            });
            results.success.push(tool);
          });
        } catch (error) {
          console.error('Batch indexing error:', error);
          batch.forEach(item => {
            results.failed.push({
              tool: item.tool?.name || item.name,
              error: 'Batch processing failed'
            });
          });
        }
      }

      results.totalProcessed += batch.length;
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
      id: `tool_${tool.name}`,
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
      indexedAt: new Date().toISOString(),
      
      // Include any additional metadata fields
      ...metadata
    };

    // Add function-specific metadata for multi-function tools
    if (tool.functions && Array.isArray(tool.functions)) {
      document.functions = tool.functions.map(fn => ({
        name: fn.name,
        description: fn.description,
        parameters: this.extractSchemaInfo(fn.parameters)
      }));
    }

    // Generate searchable text
    document.searchableText = this.generateSearchText(document);

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
      // Don't recreate - let upsert create it with the right dimensions
      
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

  /**
   * Generate a valid UUID for tool vectors (Qdrant compatible)
   * Uses deterministic UUID generation so same tool+perspective always gets same ID
   * @private
   */
  _generateToolUUID(toolName, perspectiveType) {
    // Use deterministic UUID generation so same tool+perspective always gets same ID
    
    // Use UUID v5 for deterministic generation
    const namespace = '6ba7b810-9dad-11d1-80b4-00c04fd430c8'; // Standard namespace UUID
    const input = `${toolName}_${perspectiveType}`;
    
    const hash = crypto.createHash('sha1');
    hash.update(namespace.replace(/-/g, ''), 'hex');
    hash.update(input, 'utf8');
    const hashBytes = hash.digest();
    
    // Format as UUID v5
    return [
      hashBytes.toString('hex', 0, 4),
      hashBytes.toString('hex', 4, 6),
      ((hashBytes[6] & 0x0f) | 0x50).toString(16) + hashBytes.toString('hex', 7, 8),
      ((hashBytes[8] & 0x3f) | 0x80).toString(16) + hashBytes.toString('hex', 9, 10),
      hashBytes.toString('hex', 10, 16)
    ].join('-');
  }
}