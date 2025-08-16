/**
 * Database Populator
 * 
 * Simple class that takes loaded modules and populates the MongoDB database.
 * Straightforward database operations without complex change detection.
 */

import { MongoDBToolRegistryProvider } from '../providers/MongoDBToolRegistryProvider.js';
import { ResourceManager } from '@legion/resource-manager';

export class DatabasePopulator {
  constructor(options = {}) {
    this.resourceManager = options.resourceManager;
    this.provider = options.provider;
    this.verbose = options.verbose || false;
    this.initialized = false;
  }

  /**
   * Initialize the populator
   */
  async initialize() {
    if (this.initialized) return;
    
    // Initialize ResourceManager if not provided
    if (!this.resourceManager) {
      this.resourceManager = ResourceManager.getInstance();
      await this.resourceManager.initialize();
    }
    
    // Create database provider if not provided
    if (!this.provider) {
      this.provider = await MongoDBToolRegistryProvider.create(this.resourceManager, {
        enableSemanticSearch: false
      });
    }
    
    this.initialized = true;
  }

  /**
   * Populate the database with modules and tools
   */
  async populate(modules, options = {}) {
    await this.initialize();
    
    const { clearExisting = true } = options;  // Default to clearing existing data
    
    if (this.verbose) {
      console.log('\n🗄️ Database Population');
      console.log('━'.repeat(50));
    }
    
    // Clear existing data if requested
    if (clearExisting) {
      await this.clearDatabase();
      if (this.verbose) {
        console.log('✅ Cleared existing data');
      }
    }
    
    const stats = {
      modules: { saved: 0, failed: 0 },
      tools: { saved: 0, failed: 0 }
    };
    
    // Process each module
    for (const { config, instance } of modules) {
      try {
        // Save module to database
        const moduleData = {
          name: instance.name || config.name,  // Use module instance name first, fallback to config
          type: config.type,
          path: config.path,
          className: config.className,
          description: instance.description || config.description,  // Use instance description if available
          package: this.getPackageName(config.path),
          status: 'active',
          createdAt: new Date(),
          updatedAt: new Date()
        };
        
        const savedModule = await this.provider.saveModule(moduleData);
        stats.modules.saved++;
        
        if (this.verbose) {
          const displayName = instance.name || config.name;
          console.log(`\n📦 Module: ${displayName}`);
          console.log(`   Type: ${config.type}`);
          console.log(`   Module ID: ${savedModule._id}`);
          if (instance.name && instance.name !== config.name) {
            console.log(`   Registry name: ${config.name} → Instance name: ${instance.name}`);
          }
        }
        
        // Extract and save tools
        if (instance && typeof instance.getTools === 'function') {
          const tools = instance.getTools();
          
          for (const tool of tools) {
            try {
              const moduleName = instance.name || config.name;  // Use consistent module name
              
              // Extract schemas from various possible locations
              let inputSchema = {};
              let outputSchema = null;
              
              // Try to get input schema from validator first (for tools using Zod)
              if (tool.validator && tool.validator.zodSchema) {
                inputSchema = this.extractSchema(tool.validator.zodSchema);
              } else if (tool.validator && tool.validator.jsonSchema) {
                inputSchema = this.extractSchema(tool.validator.jsonSchema);
              } else if (tool.inputSchema) {
                inputSchema = this.extractSchema(tool.inputSchema);
              } else if (tool.parameters) {
                inputSchema = this.extractSchema(tool.parameters);
              }
              
              // Extract output schema
              if (tool.outputSchema) {
                outputSchema = this.extractSchema(tool.outputSchema);
              } else if (tool.output) {
                outputSchema = this.extractSchema(tool.output);
              }
              
              const toolData = {
                name: tool.name,
                moduleId: savedModule._id,  // Link to the module's _id
                moduleName: moduleName,  // Keep for backwards compatibility
                description: tool.description || '',
                inputSchema: inputSchema,
                outputSchema: outputSchema,
                category: this.inferCategory(tool.name, moduleName),
                status: 'active',
                createdAt: new Date(),
                updatedAt: new Date()
              };
              
              await this.provider.saveTool(toolData);
              stats.tools.saved++;
              
              if (this.verbose) {
                console.log(`   ✅ Tool: ${tool.name}`);
              }
            } catch (error) {
              stats.tools.failed++;
              if (this.verbose) {
                console.log(`   ❌ Tool ${tool.name} failed: ${error.message}`);
              }
            }
          }
        }
      } catch (error) {
        stats.modules.failed++;
        if (this.verbose) {
          console.log(`❌ Module ${config.name} failed: ${error.message}`);
        }
      }
    }
    
    if (this.verbose) {
      console.log('\n' + '━'.repeat(50));
      console.log('📊 Population Summary:');
      console.log(`   Modules: ${stats.modules.saved} saved, ${stats.modules.failed} failed`);
      console.log(`   Tools: ${stats.tools.saved} saved, ${stats.tools.failed} failed`);
      
      // Get final database stats
      const dbStats = await this.provider.getStats();
      console.log('\n📈 Database Totals:');
      console.log(`   Total Modules: ${dbStats.modules}`);
      console.log(`   Total Tools: ${dbStats.tools}`);
    }
    
    return stats;
  }

  /**
   * Clear the database
   */
  async clearDatabase() {
    // Use the database service directly for clearing
    const db = this.provider.databaseService.mongoProvider.db;
    await db.collection('modules').deleteMany({});
    await db.collection('tools').deleteMany({});
  }

  /**
   * Get package name from path
   */
  getPackageName(modulePath) {
    if (modulePath.includes('packages/tools-collection')) {
      return '@legion/tools-collection';
    }
    if (modulePath.includes('packages/tools-registry/')) {
      return '@legion/tools-registry';
    }
    if (modulePath.includes('packages/')) {
      const match = modulePath.match(/packages\/([^/]+)/);
      if (match) {
        return `@legion/${match[1]}`;
      }
    }
    return '@legion/unknown';
  }

  /**
   * Extract schema from tool definition
   * Handles both Zod schemas and JSON schemas
   */
  extractSchema(schema) {
    if (!schema) return null;
    
    // If it's a Zod schema, convert to JSON Schema
    if (schema._def && schema._def.typeName) {
      return this.zodSchemaToJson(schema);
    }
    
    // If it's already JSON Schema or plain object, return as is
    return schema;
  }

  /**
   * Convert Zod schema to JSON schema format
   */
  zodSchemaToJson(zodSchema) {
    if (!zodSchema || !zodSchema._def) return {};
    
    const def = zodSchema._def;
    const typeName = def.typeName;
    
    // Extract description from checks array
    let description = def.description;
    if (!description && def.checks) {
      const descCheck = def.checks.find(c => c.kind === 'describe');
      if (descCheck) description = descCheck.value;
    }
    
    let schema = {};
    
    switch (typeName) {
      case 'ZodString':
        schema = { type: 'string' };
        if (description) schema.description = description;
        // Add string-specific validations
        if (def.checks) {
          for (const check of def.checks) {
            if (check.kind === 'min') schema.minLength = check.value;
            if (check.kind === 'max') schema.maxLength = check.value;
            if (check.kind === 'regex') schema.pattern = check.regex.source;
          }
        }
        break;
        
      case 'ZodNumber':
        schema = { type: 'number' };
        if (description) schema.description = description;
        // Add number-specific validations
        if (def.checks) {
          for (const check of def.checks) {
            if (check.kind === 'min') schema.minimum = check.value;
            if (check.kind === 'max') schema.maximum = check.value;
            if (check.kind === 'int') schema.type = 'integer';
          }
        }
        break;
        
      case 'ZodBoolean':
        schema = { type: 'boolean' };
        if (description) schema.description = description;
        break;
        
      case 'ZodArray':
        schema = {
          type: 'array',
          items: this.zodSchemaToJson(def.type)
        };
        if (description) schema.description = description;
        // Add array-specific validations
        if (def.minLength) schema.minItems = def.minLength.value;
        if (def.maxLength) schema.maxItems = def.maxLength.value;
        break;
        
      case 'ZodObject':
        const properties = {};
        const required = [];
        
        if (def.shape) {
          const shape = typeof def.shape === 'function' ? def.shape() : def.shape;
          for (const [key, value] of Object.entries(shape)) {
            properties[key] = this.zodSchemaToJson(value);
            
            // Check if required (not optional)
            if (!value._def || value._def.typeName !== 'ZodOptional') {
              required.push(key);
            }
          }
        }
        
        schema = {
          type: 'object',
          properties
        };
        
        if (required.length > 0) {
          schema.required = required;
        }
        if (description) schema.description = description;
        break;
        
      case 'ZodOptional':
        schema = this.zodSchemaToJson(def.innerType);
        // Don't mark as required - it's optional
        break;
        
      case 'ZodDefault':
        schema = this.zodSchemaToJson(def.innerType);
        if (def.defaultValue) {
          schema.default = def.defaultValue();
        }
        break;
        
      case 'ZodUnion':
        schema = {
          oneOf: def.options.map(opt => this.zodSchemaToJson(opt))
        };
        if (description) schema.description = description;
        break;
        
      case 'ZodEnum':
        const values = def.values;
        schema = {
          type: 'string',
          enum: values
        };
        if (description) schema.description = description;
        break;
        
      case 'ZodAny':
        schema = {};  // Any type - no restrictions
        if (description) schema.description = description;
        break;
        
      case 'ZodUnknown':
        schema = {};  // Unknown type - no restrictions
        if (description) schema.description = description;
        break;
        
      case 'ZodVoid':
        schema = { type: 'null' };
        if (description) schema.description = description;
        break;
        
      case 'ZodNull':
        schema = { type: 'null' };
        if (description) schema.description = description;
        break;
        
      case 'ZodUndefined':
        schema = { type: 'undefined' };
        if (description) schema.description = description;
        break;
        
      case 'ZodEffects':
        // ZodEffects wraps another schema with transformations/refinements
        schema = this.zodSchemaToJson(def.schema);
        if (description) schema.description = description;
        break;
        
      case 'ZodRecord':
        // ZodRecord is like { [key: string]: value }
        schema = {
          type: 'object',
          additionalProperties: def.valueType ? this.zodSchemaToJson(def.valueType) : true
        };
        if (description) schema.description = description;
        break;
        
      case 'ZodLiteral':
        // Literal value
        schema = { const: def.value };
        if (description) schema.description = description;
        break;
        
      default:
        // Fallback for unknown Zod types
        console.warn(`Unknown Zod type: ${typeName}`);
        schema = {};
        if (description) schema.description = description;
    }
    
    return schema;
  }

  /**
   * Infer category from tool/module name
   */
  inferCategory(toolName, moduleName) {
    const name = (toolName + ' ' + moduleName).toLowerCase();
    
    if (name.includes('file') || name.includes('directory')) {
      return 'file-system';
    }
    if (name.includes('json') || name.includes('parse')) {
      return 'data-processing';
    }
    if (name.includes('ai') || name.includes('generate')) {
      return 'ai-generation';
    }
    if (name.includes('git') || name.includes('github')) {
      return 'version-control';
    }
    if (name.includes('web') || name.includes('browser') || name.includes('crawl')) {
      return 'web';
    }
    if (name.includes('test') || name.includes('jest')) {
      return 'testing';
    }
    if (name.includes('code') || name.includes('analysis')) {
      return 'development';
    }
    if (name.includes('deploy') || name.includes('railway')) {
      return 'deployment';
    }
    if (name.includes('command') || name.includes('system')) {
      return 'system';
    }
    
    return 'general';
  }

  /**
   * Close database connection
   */
  async close() {
    if (this.provider) {
      await this.provider.disconnect();
    }
  }
}

export default DatabasePopulator;