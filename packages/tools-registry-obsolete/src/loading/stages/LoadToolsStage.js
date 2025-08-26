/**
 * LoadToolsStage - Loads tools from discovered modules into MongoDB
 * 
 * Responsibilities:
 * - Load modules from discovery
 * - Extract tools from modules
 * - Save tools to MongoDB
 * - Verify tool counts match
 */

import { ObjectId } from 'mongodb';

export class LoadToolsStage {
  constructor(dependencies) {
    this.moduleLoader = dependencies.moduleLoader;
    this.mongoProvider = dependencies.mongoProvider;
    this.verifier = dependencies.verifier;
    this.stateManager = dependencies.stateManager;
  }

  /**
   * Execute the load tools stage
   */
  async execute(options = {}) {
    console.log('📦 Starting load tools stage...');
    
    // Get modules to load (from discovery or specific module)
    const modules = await this.getModulesToLoad(options.module);
    console.log(`  Found ${modules.length} modules to load`);
    
    // Load tools from each module
    const allTools = [];
    let successCount = 0;
    let failCount = 0;
    
    for (const moduleRecord of modules) {
      try {
        console.log(`  Loading module: ${moduleRecord.name}`);
        const tools = await this.loadToolsFromModule(moduleRecord);
        
        if (tools && tools.length > 0) {
          allTools.push(...tools);
          successCount++;
          console.log(`    ✓ Loaded ${tools.length} tools from ${moduleRecord.name}`);
          
          // Save module to modules collection (runtime state)
          await this.saveModuleRuntimeState(moduleRecord, tools.length, 'loaded');
          
          // Update module_registry status
          await this.updateModuleRegistryStatus(moduleRecord.name, 'loaded');
        } else {
          console.log(`    ⚠️ No tools found in ${moduleRecord.name}`);
          await this.saveModuleRuntimeState(moduleRecord, 0, 'loaded');
          await this.updateModuleRegistryStatus(moduleRecord.name, 'loaded');
        }
      } catch (error) {
        failCount++;
        console.log(`    ❌ Failed to load ${moduleRecord.name}: ${error.message}`);
        await this.updateModuleRegistryStatus(moduleRecord.name, 'failed');
      }
    }
    
    console.log(`  Module loading complete: ${successCount} succeeded, ${failCount} failed`);
    
    // Save tools to MongoDB
    await this.saveTools(allTools);
    
    // Verify
    const verificationResult = await this.verify(allTools.length);
    
    if (!verificationResult.success) {
      throw new Error(`Tool loading verification failed: ${verificationResult.message}`);
    }
    
    return {
      ...verificationResult,
      modulesProcessed: successCount,
      modulesLoaded: successCount,  // Keep for backward compatibility
      modulesFailed: failCount,
      toolsAdded: allTools.length,
      toolsLoaded: allTools.length  // Keep for backward compatibility
    };
  }

  /**
   * Get modules to load from module registry
   */
  async getModulesToLoad(specificModule) {
    if (specificModule) {
      // Load specific module from registry
      const module = await this.mongoProvider.findOne('module_registry', {
        name: specificModule
      });
      
      if (!module) {
        throw new Error(`Module ${specificModule} not found in module registry`);
      }
      
      return [module];
    }
    
    // Load all discovered modules from registry
    const modules = await this.mongoProvider.find('module_registry', {
      enabled: { $ne: false }
    });
    
    return modules;
  }

  /**
   * Load tools from a single module
   */
  async loadToolsFromModule(moduleRecord) {
    const tools = [];
    
    try {
      // Use moduleLoader to get tools
      const loadedModule = await this.moduleLoader.loadModule(moduleRecord);
      
      // Handle both direct array and module object with getTools
      let moduleTools;
      if (Array.isArray(loadedModule)) {
        moduleTools = loadedModule;
      } else if (loadedModule && typeof loadedModule.getTools === 'function') {
        moduleTools = loadedModule.getTools();
      } else {
        return tools;
      }
      
      // Process each tool
      for (const tool of moduleTools) {
        if (!tool.name) {
          console.log(`    ⚠️ Skipping tool without name in ${moduleRecord.name}`);
          continue;
        }
        
        // Prepare tool document for MongoDB with schema validation compliance
        const description = tool.description || `Tool for ${tool.name} functionality`;
        
        // Ensure description meets minimum length requirement (10 characters)
        const validDescription = description.length >= 10 
          ? description 
          : `${description} - performs ${tool.name} operations`;
        
        const toolDoc = {
          name: tool.name,
          description: validDescription,
          moduleName: moduleRecord.name,
          moduleId: moduleRecord._id,
          
          // Ensure category is valid according to schema enum
          category: this.validateCategory(tool.category || moduleRecord.category),
          
          // Schema information - only include if valid
          ...(this.normalizeSchema(tool.inputSchema || tool.schema) && {
            inputSchema: this.normalizeSchema(tool.inputSchema || tool.schema)
          }),
          ...(this.normalizeSchema(tool.outputSchema) && {
            outputSchema: this.normalizeSchema(tool.outputSchema)
          }),
          
          // Metadata - only include fields that match schema
          tags: tool.tags || [],
          examples: tool.examples || [],
          
          // Timestamps
          createdAt: new Date(),
          updatedAt: new Date()
        };
        
        tools.push(toolDoc);
      }
      
    } catch (error) {
      console.error(`    Error loading tools from ${moduleRecord.name}:`, error.message);
      throw error;
    }
    
    return tools;
  }

  /**
   * Validate category against schema enum values
   */
  validateCategory(category) {
    const validCategories = [
      'read', 'write', 'create', 'delete', 'update', 'search',
      'transform', 'validate', 'execute', 'generate', 'analyze'
    ];
    
    if (category && validCategories.includes(category)) {
      return category;
    }
    
    // Default to 'execute' which is a safe generic category
    return 'execute';
  }

  /**
   * Normalize schema to consistent format that matches MongoDB validation
   */
  normalizeSchema(schema) {
    if (!schema) return null;
    
    // Handle Zod schemas - convert to valid JSON Schema
    if (schema._def) {
      return {
        type: 'object',
        properties: schema._def.shape ? this.extractZodProperties(schema._def.shape()) : {},
        additionalProperties: false
      };
    }
    
    // Handle existing JSON schemas - ensure they have required 'type' field
    if (schema.type || schema.properties) {
      return {
        type: schema.type || 'object',
        ...schema
      };
    }
    
    // Handle OpenAI function schemas - convert parameters to JSON Schema
    if (schema.parameters) {
      return {
        type: schema.parameters.type || 'object',
        properties: schema.parameters.properties || {},
        required: schema.parameters.required || []
      };
    }
    
    // Handle plain objects - convert to JSON Schema
    if (typeof schema === 'object') {
      return {
        type: 'object',
        properties: schema,
        additionalProperties: false
      };
    }
    
    return null;
  }

  /**
   * Extract properties from Zod schema definition
   */
  extractZodProperties(shape) {
    const properties = {};
    try {
      const shapeObj = shape();
      for (const [key, zodType] of Object.entries(shapeObj)) {
        if (zodType._def) {
          properties[key] = {
            type: this.zodTypeToJsonSchemaType(zodType._def.typeName)
          };
        }
      }
    } catch (error) {
      // Fallback for complex Zod schemas
      console.log(`    Warning: Could not extract Zod schema properties: ${error.message}`);
    }
    return properties;
  }

  /**
   * Convert Zod type names to JSON Schema types
   */
  zodTypeToJsonSchemaType(zodTypeName) {
    const typeMap = {
      'ZodString': 'string',
      'ZodNumber': 'number',
      'ZodBoolean': 'boolean',
      'ZodArray': 'array',
      'ZodObject': 'object'
    };
    return typeMap[zodTypeName] || 'string';
  }

  /**
   * Save tools to MongoDB
   */
  async saveTools(tools) {
    console.log(`  Saving ${tools.length} tools to MongoDB...`);
    
    if (tools.length === 0) {
      console.log('  No tools to save');
      return;
    }
    
    try {
      // Insert tools in batches for better performance
      const batchSize = 100;
      let totalInserted = 0;
      
      for (let i = 0; i < tools.length; i += batchSize) {
        const batch = tools.slice(i, i + batchSize);
        const result = await this.mongoProvider.insert('tools', batch);
        // Handle both insertedIds and insertedCount
        const insertedCount = result.insertedCount || (result.insertedIds ? Object.keys(result.insertedIds).length : batch.length);
        totalInserted += insertedCount;
        
        console.log(`    Inserted batch ${Math.floor(i / batchSize) + 1}: ${insertedCount} tools`);
      }
      
      console.log(`  ✓ Saved ${totalInserted} tools to MongoDB`);
      
    } catch (error) {
      console.error('  ❌ Error saving tools:', error.message);
      throw error;
    }
  }

  /**
   * Save module runtime state to modules collection
   */
  async saveModuleRuntimeState(moduleRecord, toolCount, status) {
    await this.mongoProvider.insert('modules', {
      ...moduleRecord,
      _id: new ObjectId(), // New ID for runtime record
      registryId: moduleRecord._id, // Reference to registry
      toolCount,
      loadingStatus: status,
      loadedAt: new Date()
    });
  }

  /**
   * Update module status in module_registry
   */
  async updateModuleRegistryStatus(moduleName, status) {
    await this.mongoProvider.update('module_registry', 
      { name: moduleName },
      { 
        $set: { 
          loadingStatus: status,
          lastLoadedAt: new Date()
        }
      }
    );
  }

  /**
   * Verify tools were loaded correctly
   */
  async verify(expectedCount) {
    console.log('  Verifying tool loading...');
    
    const result = await this.verifier.verifyToolCount(expectedCount);
    
    if (result.success) {
      console.log('  ✅ Tool loading verified successfully');
      
      // Additional checks
      const toolsWithoutSchema = await this.mongoProvider.count('tools', {
        inputSchema: null
      });
      
      if (toolsWithoutSchema > 0) {
        console.log(`  ⚠️ ${toolsWithoutSchema} tools have no input schema`);
      }
      
      const toolsWithoutDescription = await this.mongoProvider.count('tools', {
        $or: [
          { description: null },
          { description: '' }
        ]
      });
      
      if (toolsWithoutDescription > 0) {
        console.log(`  ⚠️ ${toolsWithoutDescription} tools have no description`);
      }
      
    } else {
      console.log('  ❌ Tool loading verification failed:', result.message);
    }
    
    return result;
  }
}