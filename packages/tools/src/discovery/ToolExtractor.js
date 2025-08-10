/**
 * Tool Extractor
 * 
 * Extracts tools from instantiated modules regardless of their format.
 * Handles various tool patterns including class methods, getTools(), arrays, and more.
 */

export class ToolExtractor {
  constructor(options = {}) {
    this.verbose = options.verbose || false;
    this.strict = options.strict || false;
    this.maxDepth = options.maxDepth || 3;
    
    // Track extraction statistics
    this.stats = {
      attempted: 0,
      succeeded: 0,
      failed: 0,
      patterns: {}
    };
  }

  /**
   * Extract tools from a module instance
   */
  async extractTools(moduleInstance, moduleMetadata = {}) {
    this.stats.attempted++;
    
    if (this.verbose) {
      console.log(`🔧 Extracting tools from module: ${moduleMetadata.name || 'unknown'}`);
    }
    
    const tools = [];
    
    try {
      // Try various extraction patterns
      const extractionMethods = [
        this.extractFromGetTools.bind(this),
        this.extractFromToolsProperty.bind(this),
        this.extractFromToolsArray.bind(this),
        this.extractFromMethods.bind(this),
        this.extractFromExports.bind(this),
        this.extractFromRegistry.bind(this),
        this.extractFromProviders.bind(this),
        this.extractFromDefinition.bind(this)
      ];
      
      for (const method of extractionMethods) {
        try {
          const extractedTools = await method(moduleInstance, moduleMetadata);
          if (extractedTools && extractedTools.length > 0) {
            tools.push(...extractedTools);
            const methodName = method.name;
            this.stats.patterns[methodName] = (this.stats.patterns[methodName] || 0) + 1;
            
            if (this.verbose) {
              console.log(`  ✅ Extracted ${extractedTools.length} tools using ${methodName}`);
            }
            
            // If we found tools, we might continue to find more from other patterns
            // unless strict mode is enabled
            if (this.strict) {
              break;
            }
          }
        } catch (error) {
          if (this.verbose) {
            console.log(`  ⚠️ ${method.name} failed: ${error.message}`);
          }
        }
      }
      
      // Deduplicate tools by name
      const uniqueTools = this.deduplicateTools(tools);
      
      // Validate and normalize tools
      const validatedTools = this.validateTools(uniqueTools, moduleMetadata);
      
      this.stats.succeeded++;
      
      if (this.verbose) {
        console.log(`  📦 Total extracted: ${validatedTools.length} tools`);
      }
      
      return validatedTools;
      
    } catch (error) {
      this.stats.failed++;
      
      if (this.verbose) {
        console.log(`  ❌ Extraction failed: ${error.message}`);
      }
      
      if (this.strict) {
        throw error;
      }
      
      return [];
    }
  }

  /**
   * Extract from getTools() method
   */
  async extractFromGetTools(moduleInstance, metadata) {
    if (typeof moduleInstance.getTools !== 'function') {
      return [];
    }
    
    try {
      const tools = await moduleInstance.getTools();
      
      if (!Array.isArray(tools)) {
        // Some modules might return an object with tools as properties
        if (tools && typeof tools === 'object') {
          return Object.values(tools);
        }
        return [];
      }
      
      return tools;
    } catch (error) {
      if (this.verbose) {
        console.log(`    getTools() error: ${error.message}`);
      }
      return [];
    }
  }

  /**
   * Extract from tools property
   */
  async extractFromToolsProperty(moduleInstance, metadata) {
    if (!moduleInstance.tools) {
      return [];
    }
    
    // Handle array of tools
    if (Array.isArray(moduleInstance.tools)) {
      return moduleInstance.tools;
    }
    
    // Handle object with tools as properties
    if (typeof moduleInstance.tools === 'object') {
      return Object.values(moduleInstance.tools);
    }
    
    return [];
  }

  /**
   * Extract from _tools or __tools (private arrays)
   */
  async extractFromToolsArray(moduleInstance, metadata) {
    const tools = [];
    
    // Check for various private tool array patterns
    const privateArrayNames = ['_tools', '__tools', 'toolsArray', 'toolList'];
    
    for (const propName of privateArrayNames) {
      if (moduleInstance[propName] && Array.isArray(moduleInstance[propName])) {
        tools.push(...moduleInstance[propName]);
      }
    }
    
    return tools;
  }

  /**
   * Extract from methods that look like tools
   */
  async extractFromMethods(moduleInstance, metadata) {
    const tools = [];
    
    // Get all properties and methods
    const properties = Object.getOwnPropertyNames(moduleInstance);
    const prototypeProps = moduleInstance.constructor?.prototype ? 
      Object.getOwnPropertyNames(moduleInstance.constructor.prototype) : [];
    
    const allProps = [...new Set([...properties, ...prototypeProps])];
    
    for (const prop of allProps) {
      // Skip common non-tool methods
      if (this.isCommonMethod(prop)) continue;
      
      // Check if it looks like a tool method
      if (this.looksLikeTool(prop, moduleInstance[prop])) {
        try {
          const tool = await this.createToolFromMethod(moduleInstance, prop, metadata);
          if (tool) {
            tools.push(tool);
          }
        } catch (error) {
          // Skip methods that can't be converted to tools
        }
      }
    }
    
    return tools;
  }

  /**
   * Extract from exported functions
   */
  async extractFromExports(moduleInstance, metadata) {
    const tools = [];
    
    // Check if module has an exports object
    if (moduleInstance.exports && typeof moduleInstance.exports === 'object') {
      for (const [name, exported] of Object.entries(moduleInstance.exports)) {
        if (this.isToolLike(exported)) {
          tools.push(exported);
        }
      }
    }
    
    return tools;
  }

  /**
   * Extract from tool registry pattern
   */
  async extractFromRegistry(moduleInstance, metadata) {
    const tools = [];
    
    // Check for registry patterns
    if (moduleInstance.registry || moduleInstance.toolRegistry) {
      const registry = moduleInstance.registry || moduleInstance.toolRegistry;
      
      if (registry.getAll && typeof registry.getAll === 'function') {
        const registeredTools = await registry.getAll();
        if (Array.isArray(registeredTools)) {
          tools.push(...registeredTools);
        }
      } else if (registry.tools) {
        if (Array.isArray(registry.tools)) {
          tools.push(...registry.tools);
        } else if (typeof registry.tools === 'object') {
          tools.push(...Object.values(registry.tools));
        }
      }
    }
    
    return tools;
  }

  /**
   * Extract from provider pattern
   */
  async extractFromProviders(moduleInstance, metadata) {
    const tools = [];
    
    // Check for provider methods
    if (moduleInstance.provide && typeof moduleInstance.provide === 'function') {
      try {
        const provided = await moduleInstance.provide();
        if (Array.isArray(provided)) {
          tools.push(...provided.filter(item => this.isToolLike(item)));
        }
      } catch (error) {
        // Provider might need parameters
      }
    }
    
    // Check for getProviders
    if (moduleInstance.getProviders && typeof moduleInstance.getProviders === 'function') {
      try {
        const providers = await moduleInstance.getProviders();
        for (const provider of providers) {
          if (provider.getTools && typeof provider.getTools === 'function') {
            const providerTools = await provider.getTools();
            if (Array.isArray(providerTools)) {
              tools.push(...providerTools);
            }
          }
        }
      } catch (error) {
        // Ignore provider errors
      }
    }
    
    return tools;
  }

  /**
   * Extract from definition pattern
   */
  async extractFromDefinition(moduleInstance, metadata) {
    const tools = [];
    
    // Check if this is a definition object with getInstance
    if (moduleInstance.definition && moduleInstance.getInstance) {
      try {
        const instance = await moduleInstance.getInstance();
        if (instance) {
          // Recursively extract from the instance
          const instanceTools = await this.extractTools(instance, metadata);
          tools.push(...instanceTools);
        }
      } catch (error) {
        // Instance creation might fail
      }
    }
    
    return tools;
  }

  /**
   * Check if a property name is a common method (not a tool)
   */
  isCommonMethod(name) {
    const commonMethods = [
      'constructor', 'toString', 'valueOf', 'toJSON', 'inspect',
      'hasOwnProperty', 'isPrototypeOf', 'propertyIsEnumerable',
      'getTools', 'getTool', 'initialize', 'setup', 'teardown',
      'connect', 'disconnect', 'on', 'off', 'emit', 'once',
      'addEventListener', 'removeEventListener'
    ];
    
    return commonMethods.includes(name) || 
           name.startsWith('_') || 
           name.startsWith('__');
  }

  /**
   * Check if a property looks like a tool
   */
  looksLikeTool(name, value) {
    // Must be a function or object
    if (typeof value !== 'function' && typeof value !== 'object') {
      return false;
    }
    
    // Check for tool-like names
    const toolPatterns = [
      /^execute/i,
      /^run/i,
      /^process/i,
      /^handle/i,
      /^perform/i,
      /Tool$/i,
      /Action$/i,
      /Command$/i
    ];
    
    if (toolPatterns.some(pattern => pattern.test(name))) {
      return true;
    }
    
    // Check if object has tool-like properties
    if (typeof value === 'object' && value !== null) {
      return this.isToolLike(value);
    }
    
    return false;
  }

  /**
   * Check if an object is tool-like
   */
  isToolLike(obj) {
    if (!obj || typeof obj !== 'object') {
      return false;
    }
    
    // Must have at least name and execute/invoke
    const hasName = 'name' in obj;
    const hasExecute = 'execute' in obj || 'invoke' in obj || 'run' in obj;
    
    // Optional but indicative properties
    const hasDescription = 'description' in obj;
    const hasSchema = 'inputSchema' in obj || 'schema' in obj || 'parameters' in obj;
    
    // If it has name and execute, it's likely a tool
    if (hasName && hasExecute) {
      return true;
    }
    
    // If it has most tool properties, it's likely a tool
    const toolProperties = [hasName, hasExecute, hasDescription, hasSchema].filter(Boolean).length;
    return toolProperties >= 3;
  }

  /**
   * Create a tool object from a method
   */
  async createToolFromMethod(moduleInstance, methodName, metadata) {
    const method = moduleInstance[methodName];
    
    if (typeof method !== 'function') {
      return null;
    }
    
    // Try to extract description from method
    let description = `${methodName} method from ${metadata.name || 'module'}`;
    
    // Check if method has description property
    if (method.description) {
      description = method.description;
    }
    
    // Create a basic tool wrapper
    return {
      name: methodName,
      description,
      moduleName: metadata.name,
      
      async execute(params) {
        return await method.call(moduleInstance, params);
      },
      
      // Try to get schema if available
      inputSchema: method.schema || method.inputSchema || {
        type: 'object',
        properties: {},
        additionalProperties: true
      }
    };
  }

  /**
   * Deduplicate tools by name
   */
  deduplicateTools(tools) {
    const seen = new Map();
    
    for (const tool of tools) {
      const name = tool.name || 'unnamed';
      
      if (!seen.has(name)) {
        seen.set(name, tool);
      } else if (this.verbose) {
        console.log(`    ⚠️ Duplicate tool found: ${name}`);
      }
    }
    
    return Array.from(seen.values());
  }

  /**
   * Validate and normalize tools
   */
  validateTools(tools, moduleMetadata) {
    const validated = [];
    
    for (const tool of tools) {
      try {
        // Must have at least a name
        if (!tool.name) {
          if (this.verbose) {
            console.log(`    ⚠️ Tool missing name, skipping`);
          }
          continue;
        }
        
        // Normalize the tool structure
        const normalizedTool = {
          name: tool.name,
          description: tool.description || `${tool.name} tool`,
          moduleName: moduleMetadata.name,
          moduleType: moduleMetadata.type,
          
          // Preserve original tool reference for execution
          _original: tool,
          
          // Extract schema information
          inputSchema: this.extractSchema(tool),
          outputSchema: tool.outputSchema || tool.output || null,
          
          // Extract examples if available
          examples: tool.examples || [],
          
          // Extract metadata
          category: tool.category || this.inferCategory(tool.name),
          tags: tool.tags || this.inferTags(tool.name, tool.description),
          complexity: tool.complexity || 'simple',
          
          // Execution wrapper
          async execute(params) {
            if (tool.execute && typeof tool.execute === 'function') {
              return await tool.execute(params);
            } else if (tool.invoke && typeof tool.invoke === 'function') {
              return await tool.invoke(params);
            } else if (tool.run && typeof tool.run === 'function') {
              return await tool.run(params);
            } else if (typeof tool === 'function') {
              return await tool(params);
            } else {
              throw new Error(`Tool ${tool.name} has no execution method`);
            }
          }
        };
        
        validated.push(normalizedTool);
        
      } catch (error) {
        if (this.verbose) {
          console.log(`    ⚠️ Tool validation failed for ${tool.name || 'unnamed'}: ${error.message}`);
        }
      }
    }
    
    return validated;
  }

  /**
   * Extract schema from tool
   */
  extractSchema(tool) {
    // Direct schema properties
    if (tool.inputSchema) return tool.inputSchema;
    if (tool.schema) return tool.schema;
    if (tool.parameters) return tool.parameters;
    
    // From validator
    if (tool.validator) {
      if (tool.validator.jsonSchema) return tool.validator.jsonSchema;
      if (tool.validator.schema) return tool.validator.schema;
      if (tool.validator.zodSchema) {
        return {
          type: 'object',
          zodSchema: true,
          description: 'Zod schema (needs conversion)'
        };
      }
    }
    
    // From function signature (if available)
    if (tool.signature) return tool.signature;
    
    // Default open schema
    return {
      type: 'object',
      properties: {},
      additionalProperties: true
    };
  }

  /**
   * Infer category from tool name
   */
  inferCategory(toolName) {
    const name = toolName.toLowerCase();
    
    if (name.includes('read') || name.includes('get') || name.includes('fetch')) return 'read';
    if (name.includes('write') || name.includes('create') || name.includes('save')) return 'write';
    if (name.includes('delete') || name.includes('remove')) return 'delete';
    if (name.includes('update') || name.includes('modify')) return 'update';
    if (name.includes('execute') || name.includes('run')) return 'execute';
    if (name.includes('search') || name.includes('find')) return 'search';
    if (name.includes('validate') || name.includes('check')) return 'validate';
    if (name.includes('transform') || name.includes('convert')) return 'transform';
    
    return 'other';
  }

  /**
   * Infer tags from tool name and description
   */
  inferTags(toolName, description = '') {
    const tags = [];
    const text = `${toolName} ${description}`.toLowerCase();
    
    if (text.includes('file')) tags.push('file');
    if (text.includes('directory') || text.includes('folder')) tags.push('directory');
    if (text.includes('json')) tags.push('json');
    if (text.includes('xml')) tags.push('xml');
    if (text.includes('yaml')) tags.push('yaml');
    if (text.includes('command') || text.includes('bash')) tags.push('command');
    if (text.includes('http') || text.includes('api')) tags.push('network');
    if (text.includes('database') || text.includes('db')) tags.push('database');
    if (text.includes('test')) tags.push('testing');
    if (text.includes('deploy')) tags.push('deployment');
    
    return [...new Set(tags)];
  }

  /**
   * Get extraction statistics
   */
  getStats() {
    return {
      ...this.stats,
      successRate: this.stats.attempted > 0 
        ? (this.stats.succeeded / this.stats.attempted * 100).toFixed(2) + '%'
        : '0%'
    };
  }

  /**
   * Extract tools from multiple modules
   */
  async extractFromMultiple(moduleInstances, metadataArray = []) {
    const allTools = [];
    
    for (let i = 0; i < moduleInstances.length; i++) {
      const moduleInstance = moduleInstances[i];
      const metadata = metadataArray[i] || {};
      
      const tools = await this.extractTools(moduleInstance, metadata);
      allTools.push(...tools);
    }
    
    return allTools;
  }
}