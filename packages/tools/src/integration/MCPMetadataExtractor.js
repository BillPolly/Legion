/**
 * MCPMetadataExtractor - Extracts structured metadata from MCP servers
 * 
 * Connects to running MCP servers and extracts:
 * - Available tools and their schemas
 * - Available resources
 * - Server capabilities and configuration
 * - Tool categorization and tagging
 * 
 * Converts MCP-specific formats to Legion tool metadata format.
 */

import { EventEmitter } from 'events';

export class MCPMetadataExtractor extends EventEmitter {
  constructor(dependencies = {}) {
    super();
    
    this.resourceManager = dependencies.resourceManager;
    this.timeout = dependencies.timeout || 10000;
    this.retryAttempts = dependencies.retryAttempts || 3;
    this.retryDelay = dependencies.retryDelay || 1000;
    
    // Metadata processing options
    this.options = {
      includeResources: dependencies.includeResources !== false,
      inferCategories: dependencies.inferCategories !== false,
      generateTags: dependencies.generateTags !== false,
      extractExamples: dependencies.extractExamples !== false,
      analyzeSchemas: dependencies.analyzeSchemas !== false,
      ...dependencies
    };
    
    // Category inference patterns
    this.categoryPatterns = {
      'mcp-filesystem': ['file', 'directory', 'path', 'fs', 'read', 'write', 'list'],
      'mcp-git': ['git', 'repository', 'commit', 'branch', 'merge', 'clone', 'push', 'pull'],
      'mcp-web': ['http', 'web', 'url', 'fetch', 'request', 'api', 'scrape'],
      'mcp-database': ['database', 'db', 'sql', 'query', 'table', 'record', 'data'],
      'mcp-development': ['build', 'compile', 'test', 'debug', 'lint', 'format'],
      'mcp-system': ['system', 'process', 'service', 'monitor', 'status', 'config'],
      'mcp-ai': ['ai', 'llm', 'openai', 'anthropic', 'generate', 'embed', 'chat']
    };
    
    // Cache for extracted metadata
    this.metadataCache = new Map(); // serverId -> metadata
    this.cacheTimeout = dependencies.cacheTimeout || 300000; // 5 minutes
  }

  /**
   * Initialize the metadata extractor
   */
  async initialize() {
    this.emit('info', 'Initializing MCP Metadata Extractor');
  }

  /**
   * Extract comprehensive metadata from an MCP server
   */
  async extractServerMetadata(serverProcess) {
    const serverId = serverProcess.serverId;
    
    // Check cache first
    const cached = this.getCachedMetadata(serverId);
    if (cached) {
      this.emit('debug', `Using cached metadata for server ${serverId}`);
      return cached;
    }
    
    this.emit('info', `Extracting metadata from server ${serverId}`);
    
    try {
      const metadata = await this.performExtraction(serverProcess);
      
      // Cache the result
      this.cacheMetadata(serverId, metadata);
      
      this.emit('metadata-extracted', {
        serverId,
        toolCount: metadata.tools.length,
        resourceCount: metadata.resources.length
      });
      
      return metadata;
      
    } catch (error) {
      this.emit('error', `Failed to extract metadata from server ${serverId}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Perform the actual metadata extraction
   */
  async performExtraction(serverProcess) {
    const serverId = serverProcess.serverId;
    const serverConfig = serverProcess.config;
    
    // Extract basic server information
    const basicInfo = {
      serverId,
      name: serverConfig.name || serverId,
      description: serverConfig.description || '',
      category: serverConfig.category || 'mcp-general',
      version: serverConfig.version || '1.0.0',
      tags: [...(serverConfig.tags || []), 'mcp'],
      source: 'mcp'
    };
    
    // Extract tools information
    const tools = await this.extractToolsMetadata(serverProcess);
    
    // Extract resources information (if enabled)
    const resources = this.options.includeResources ? 
      await this.extractResourcesMetadata(serverProcess) : [];
    
    // Infer additional metadata
    const inferredMetadata = this.inferServerMetadata(basicInfo, tools, resources);
    
    return {
      ...basicInfo,
      ...inferredMetadata,
      tools,
      resources,
      extractedAt: Date.now(),
      capabilities: this.analyzeServerCapabilities(tools, resources)
    };
  }

  /**
   * Extract tools metadata from MCP server
   */
  async extractToolsMetadata(serverProcess) {
    const tools = [];
    
    try {
      // Get available tools from the server
      const availableTools = serverProcess.getAvailableTools();
      
      for (const mcpTool of availableTools) {
        const toolMetadata = await this.processToolMetadata(mcpTool, serverProcess);
        tools.push(toolMetadata);
      }
      
      this.emit('debug', `Extracted ${tools.length} tools from server ${serverProcess.serverId}`);
      
    } catch (error) {
      this.emit('warning', `Failed to extract tools metadata: ${error.message}`);
    }
    
    return tools;
  }

  /**
   * Process individual tool metadata
   */
  async processToolMetadata(mcpTool, serverProcess) {
    const toolMetadata = {
      name: mcpTool.name,
      description: mcpTool.description || '',
      inputSchema: this.processInputSchema(mcpTool.inputSchema),
      outputSchema: this.inferOutputSchema(mcpTool),
      
      // Legion-specific metadata
      category: this.inferToolCategory(mcpTool),
      tags: this.generateToolTags(mcpTool),
      capabilities: this.extractToolCapabilities(mcpTool),
      examples: [],
      
      // MCP-specific metadata
      mcpMetadata: {
        originalSchema: mcpTool.inputSchema,
        serverId: serverProcess.serverId
      }
    };
    
    // Generate examples if enabled
    if (this.options.extractExamples) {
      toolMetadata.examples = this.generateToolExamples(mcpTool);
    }
    
    // Analyze schema for additional insights
    if (this.options.analyzeSchemas && mcpTool.inputSchema) {
      toolMetadata.schemaAnalysis = this.analyzeToolSchema(mcpTool.inputSchema);
    }
    
    return toolMetadata;
  }

  /**
   * Extract resources metadata from MCP server
   */
  async extractResourcesMetadata(serverProcess) {
    const resources = [];
    
    try {
      const availableResources = serverProcess.getAvailableResources();
      
      for (const mcpResource of availableResources) {
        const resourceMetadata = {
          uri: mcpResource.uri,
          name: mcpResource.name || this.extractResourceName(mcpResource.uri),
          description: mcpResource.description || '',
          mimeType: mcpResource.mimeType || 'text/plain',
          category: this.inferResourceCategory(mcpResource),
          tags: this.generateResourceTags(mcpResource)
        };
        
        resources.push(resourceMetadata);
      }
      
      this.emit('debug', `Extracted ${resources.length} resources from server ${serverProcess.serverId}`);
      
    } catch (error) {
      this.emit('warning', `Failed to extract resources metadata: ${error.message}`);
    }
    
    return resources;
  }

  /**
   * Process MCP input schema into Legion format
   */
  processInputSchema(mcpSchema) {
    if (!mcpSchema) return null;
    
    // Handle OpenAI function schema format (common in MCP)
    if (mcpSchema.type === 'object' && mcpSchema.properties) {
      return {
        type: 'object',
        properties: this.processSchemaProperties(mcpSchema.properties),
        required: mcpSchema.required || [],
        description: mcpSchema.description
      };
    }
    
    // Handle other schema formats
    if (typeof mcpSchema === 'object') {
      return mcpSchema;
    }
    
    return null;
  }

  /**
   * Process schema properties recursively
   */
  processSchemaProperties(properties) {
    const processed = {};
    
    for (const [key, value] of Object.entries(properties)) {
      processed[key] = {
        type: value.type || 'string',
        description: value.description || '',
        enum: value.enum,
        default: value.default,
        examples: value.examples
      };
      
      // Handle nested objects
      if (value.type === 'object' && value.properties) {
        processed[key].properties = this.processSchemaProperties(value.properties);
      }
      
      // Handle arrays
      if (value.type === 'array' && value.items) {
        processed[key].items = this.processSchemaProperties({ item: value.items }).item;
      }
    }
    
    return processed;
  }

  /**
   * Infer output schema from tool information
   */
  inferOutputSchema(mcpTool) {
    // MCP tools typically return structured content
    return {
      type: 'object',
      properties: {
        content: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              type: { type: 'string', enum: ['text', 'image', 'resource'] },
              text: { type: 'string' },
              data: { type: 'string' },
              mimeType: { type: 'string' }
            }
          }
        },
        isError: { type: 'boolean' }
      }
    };
  }

  /**
   * Infer tool category from name and description
   */
  inferToolCategory(mcpTool) {
    if (!this.options.inferCategories) {
      return 'mcp-tool';
    }
    
    const text = `${mcpTool.name} ${mcpTool.description || ''}`.toLowerCase();
    
    // Check category patterns
    for (const [category, patterns] of Object.entries(this.categoryPatterns)) {
      if (patterns.some(pattern => text.includes(pattern))) {
        return category;
      }
    }
    
    return 'mcp-general';
  }

  /**
   * Generate tags for a tool
   */
  generateToolTags(mcpTool) {
    if (!this.options.generateTags) {
      return ['mcp'];
    }
    
    const tags = new Set(['mcp']);
    
    // Extract tags from tool name
    const nameParts = mcpTool.name.toLowerCase().split(/[_-]/);
    for (const part of nameParts) {
      if (part.length > 2) {
        tags.add(part);
      }
    }
    
    // Extract tags from description
    const description = (mcpTool.description || '').toLowerCase();
    const commonTags = ['read', 'write', 'list', 'create', 'delete', 'update', 'search', 'get', 'set'];
    
    for (const tag of commonTags) {
      if (description.includes(tag)) {
        tags.add(tag);
      }
    }
    
    // Extract domain-specific tags
    const domainTags = ['file', 'git', 'web', 'api', 'database', 'system'];
    for (const tag of domainTags) {
      if (description.includes(tag)) {
        tags.add(tag);
      }
    }
    
    return Array.from(tags);
  }

  /**
   * Extract tool capabilities
   */
  extractToolCapabilities(mcpTool) {
    const capabilities = [];
    const name = mcpTool.name.toLowerCase();
    const description = (mcpTool.description || '').toLowerCase();
    const text = `${name} ${description}`;
    
    // CRUD operations
    if (text.includes('read') || text.includes('get') || text.includes('fetch')) {
      capabilities.push('data reading');
    }
    if (text.includes('write') || text.includes('create') || text.includes('add')) {
      capabilities.push('data writing');
    }
    if (text.includes('update') || text.includes('modify') || text.includes('edit')) {
      capabilities.push('data modification');
    }
    if (text.includes('delete') || text.includes('remove') || text.includes('drop')) {
      capabilities.push('data deletion');
    }
    if (text.includes('list') || text.includes('enumerate') || text.includes('show')) {
      capabilities.push('listing');
    }
    if (text.includes('search') || text.includes('find') || text.includes('query')) {
      capabilities.push('searching');
    }
    
    // Domain-specific capabilities
    if (text.includes('file')) capabilities.push('file operations');
    if (text.includes('git')) capabilities.push('version control');
    if (text.includes('http') || text.includes('api')) capabilities.push('web requests');
    if (text.includes('database') || text.includes('sql')) capabilities.push('data storage');
    
    return capabilities;
  }

  /**
   * Generate tool usage examples
   */
  generateToolExamples(mcpTool) {
    const examples = [];
    
    // Generate basic examples based on schema
    if (mcpTool.inputSchema && mcpTool.inputSchema.properties) {
      const exampleInput = {};
      
      for (const [param, schema] of Object.entries(mcpTool.inputSchema.properties)) {
        if (schema.examples && schema.examples.length > 0) {
          exampleInput[param] = schema.examples[0];
        } else if (schema.default !== undefined) {
          exampleInput[param] = schema.default;
        } else {
          exampleInput[param] = this.generateExampleValue(schema);
        }
      }
      
      if (Object.keys(exampleInput).length > 0) {
        examples.push({
          description: `Basic usage of ${mcpTool.name}`,
          input: exampleInput,
          expectedOutput: 'Success response with relevant data'
        });
      }
    }
    
    return examples;
  }

  /**
   * Generate example value for schema type
   */
  generateExampleValue(schema) {
    switch (schema.type) {
      case 'string':
        if (schema.enum) return schema.enum[0];
        return 'example_value';
      case 'number':
      case 'integer':
        return 42;
      case 'boolean':
        return true;
      case 'array':
        return [];
      case 'object':
        return {};
      default:
        return 'example';
    }
  }

  /**
   * Analyze tool schema for insights
   */
  analyzeToolSchema(schema) {
    if (!schema || !schema.properties) return null;
    
    const analysis = {
      parameterCount: Object.keys(schema.properties).length,
      requiredParameters: (schema.required || []).length,
      optionalParameters: Object.keys(schema.properties).length - (schema.required || []).length,
      parameterTypes: {},
      complexity: 'simple'
    };
    
    // Analyze parameter types
    for (const [param, paramSchema] of Object.entries(schema.properties)) {
      const type = paramSchema.type || 'unknown';
      analysis.parameterTypes[type] = (analysis.parameterTypes[type] || 0) + 1;
    }
    
    // Determine complexity
    if (analysis.parameterCount > 5) {
      analysis.complexity = 'complex';
    } else if (analysis.parameterCount > 2) {
      analysis.complexity = 'moderate';
    }
    
    return analysis;
  }

  /**
   * Infer resource category
   */
  inferResourceCategory(mcpResource) {
    const uri = mcpResource.uri.toLowerCase();
    
    if (uri.includes('file://')) return 'file';
    if (uri.includes('http://') || uri.includes('https://')) return 'web';
    if (uri.includes('git://')) return 'git';
    if (uri.includes('db://') || uri.includes('database')) return 'database';
    
    return 'general';
  }

  /**
   * Generate tags for a resource
   */
  generateResourceTags(mcpResource) {
    const tags = ['mcp', 'resource'];
    const uri = mcpResource.uri.toLowerCase();
    
    if (uri.includes('file://')) tags.push('file');
    if (uri.includes('http')) tags.push('web');
    if (uri.includes('git')) tags.push('git');
    if (mcpResource.mimeType) {
      const mimeType = mcpResource.mimeType.split('/')[0];
      tags.push(mimeType);
    }
    
    return tags;
  }

  /**
   * Extract resource name from URI
   */
  extractResourceName(uri) {
    try {
      const url = new URL(uri);
      return url.pathname.split('/').pop() || url.hostname || uri;
    } catch {
      return uri.split('/').pop() || uri;
    }
  }

  /**
   * Infer additional server metadata
   */
  inferServerMetadata(basicInfo, tools, resources) {
    const inferred = {
      capabilities: [],
      domains: new Set(),
      complexity: 'simple'
    };
    
    // Analyze tools to infer server capabilities
    for (const tool of tools) {
      inferred.capabilities.push(...tool.capabilities);
      
      // Extract domains from tool categories
      if (tool.category.startsWith('mcp-')) {
        inferred.domains.add(tool.category.replace('mcp-', ''));
      }
    }
    
    // Remove duplicates
    inferred.capabilities = [...new Set(inferred.capabilities)];
    inferred.domains = Array.from(inferred.domains);
    
    // Determine complexity
    if (tools.length > 10 || resources.length > 20) {
      inferred.complexity = 'complex';
    } else if (tools.length > 5 || resources.length > 10) {
      inferred.complexity = 'moderate';
    }
    
    return inferred;
  }

  /**
   * Analyze server capabilities
   */
  analyzeServerCapabilities(tools, resources) {
    return {
      toolCount: tools.length,
      resourceCount: resources.length,
      categories: [...new Set(tools.map(t => t.category))],
      operations: [...new Set(tools.flatMap(t => t.capabilities))],
      schemaComplexity: tools.reduce((sum, t) => {
        return sum + (t.schemaAnalysis?.parameterCount || 1);
      }, 0) / Math.max(tools.length, 1)
    };
  }

  /**
   * Cache metadata with expiration
   */
  cacheMetadata(serverId, metadata) {
    this.metadataCache.set(serverId, {
      metadata,
      cachedAt: Date.now()
    });
  }

  /**
   * Get cached metadata if still valid
   */
  getCachedMetadata(serverId) {
    const cached = this.metadataCache.get(serverId);
    if (!cached) return null;
    
    if (Date.now() - cached.cachedAt > this.cacheTimeout) {
      this.metadataCache.delete(serverId);
      return null;
    }
    
    return cached.metadata;
  }

  /**
   * Clear metadata cache
   */
  clearCache(serverId = null) {
    if (serverId) {
      this.metadataCache.delete(serverId);
    } else {
      this.metadataCache.clear();
    }
  }

  /**
   * Get extraction statistics
   */
  getStatistics() {
    return {
      cachedEntries: this.metadataCache.size,
      cacheTimeout: this.cacheTimeout,
      options: this.options
    };
  }
}