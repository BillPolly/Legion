/**
 * NOTE: Validation has been removed from this tool.
 * All validation now happens at the invocation layer.
 * Tools only define schemas as plain JSON Schema objects.
 */

/**
 * Tool Schema Validator
 * 
 * Comprehensive validation system that:
 * 1. Validates tool schemas are properly formatted
 * 2. Checks schemas match actual implementation
 * 3. Verifies database entries against tool definitions
 * 4. Reports and fixes mismatches
 */

import { ModuleLoader } from '../loading/ModuleLoader.js';
import { MongoDBToolRegistryProvider } from '../providers/MongoDBToolRegistryProvider.js';
import { ResourceManager } from '@legion/resource-manager';

export class ToolSchemaValidator {
  constructor(options = {}) {
    this.resourceManager = options.resourceManager;
    this.provider = options.provider;
    this.moduleLoader = options.moduleLoader;
    this.verbose = options.verbose !== false;
    this.initialized = false;
    
    // Validation results
    this.results = {
      total: 0,
      valid: 0,
      invalid: 0,
      missing: 0,
      mismatched: 0,
      errors: [],
      warnings: [],
      fixes: []
    };
  }

  async initialize() {
    if (this.initialized) return;
    
    // Initialize ResourceManager
    if (!this.resourceManager) {
      this.resourceManager = ResourceManager.getInstance();
      await this.resourceManager.initialize();
    }
    
    // Initialize database provider
    if (!this.provider) {
      this.provider = await MongoDBToolRegistryProvider.create(this.resourceManager, {
        enableSemanticSearch: false
      });
    }
    
    // Initialize module loader
    if (!this.moduleLoader) {
      this.moduleLoader = new ModuleLoader();
      await this.moduleLoader.initialize();
    }
    
    this.initialized = true;
  }

  /**
   * Validate all tools in the system
   */
  async validateAll() {
    await this.initialize();
    
    console.log('\n🔍 Tool Schema Validation');
    console.log('═'.repeat(60));
    
    // Get all modules and their tools
    const modulesResult = await this.moduleLoader.loadModules();
    const modules = modulesResult.loaded;
    
    // Get all tools from database
    const dbTools = await this.provider.listTools();
    const dbToolMap = new Map(dbTools.map(t => [t.name, t]));
    
    // Track all tool names we've seen
    const processedTools = new Set();
    
    // Validate each module and its tools
    for (const { config, instance } of modules) {
      if (!instance || typeof instance.getTools !== 'function') continue;
      
      const moduleName = instance.name || config.name;
      console.log(`\n📦 Module: ${moduleName}`);
      console.log('─'.repeat(40));
      
      const tools = instance.getTools();
      
      for (const tool of tools) {
        this.results.total++;
        processedTools.add(tool.name);
        
        const validation = await this.validateTool(tool, moduleName, dbToolMap.get(tool.name));
        
        if (validation.isValid) {
          this.results.valid++;
          if (this.verbose) {
            console.log(`  ✅ ${tool.name}`);
          }
        } else {
          this.results.invalid++;
          console.log(`  ❌ ${tool.name}`);
          validation.errors.forEach(err => {
            console.log(`     - ${err}`);
            this.results.errors.push({ tool: tool.name, module: moduleName, error: err });
          });
        }
        
        // Check for warnings
        if (validation.warnings.length > 0) {
          validation.warnings.forEach(warn => {
            console.log(`  ⚠️  ${tool.name}: ${warn}`);
            this.results.warnings.push({ tool: tool.name, module: moduleName, warning: warn });
          });
        }
      }
    }
    
    // Check for orphaned database entries
    console.log('\n🗄️ Database Consistency Check');
    console.log('─'.repeat(40));
    
    for (const [toolName, dbTool] of dbToolMap.entries()) {
      if (!processedTools.has(toolName)) {
        this.results.missing++;
        console.log(`  ⚠️  Orphaned in DB: ${toolName} (module: ${dbTool.moduleName})`);
        this.results.warnings.push({
          tool: toolName,
          module: dbTool.moduleName,
          warning: 'Tool exists in database but not in module implementation'
        });
      }
    }
    
    // Print summary
    this.printSummary();
    
    return this.results;
  }

  /**
   * Validate a single tool
   */
  async validateTool(tool, moduleName, dbEntry) {
    const validation = {
      isValid: true,
      errors: [],
      warnings: [],
      fixes: []
    };
    
    // 1. Check tool has required properties
    if (!tool.name) {
      validation.isValid = false;
      validation.errors.push('Missing tool name');
    }
    
    if (!tool.description) {
      validation.warnings.push('Missing description');
    }
    
    // 2. Validate input schema
    const inputValidation = this.validateInputSchema(tool);
    if (!inputValidation.isValid) {
      validation.isValid = false;
      validation.errors.push(...inputValidation.errors);
    }
    validation.warnings.push(...inputValidation.warnings);
    
    // 3. Validate output schema (if present)
    const outputValidation = this.validateOutputSchema(tool);
    if (!outputValidation.isValid) {
      validation.isValid = false;
      validation.errors.push(...outputValidation.errors);
    }
    validation.warnings.push(...outputValidation.warnings);
    
    // 4. Check execute method
    const executeValidation = await this.validateExecuteMethod(tool);
    if (!executeValidation.isValid) {
      validation.isValid = false;
      validation.errors.push(...executeValidation.errors);
    }
    
    // 5. Compare with database entry
    if (dbEntry) {
      const dbValidation = this.validateDatabaseEntry(tool, dbEntry);
      if (!dbValidation.isValid) {
        validation.errors.push(...dbValidation.errors);
        this.results.mismatched++;
      }
      validation.warnings.push(...dbValidation.warnings);
      validation.fixes.push(...dbValidation.fixes);
    } else {
      validation.warnings.push('Tool not found in database');
    }
    
    return validation;
  }

  /**
   * Validate input schema
   */
  validateInputSchema(tool) {
    const validation = {
      isValid: true,
      errors: [],
      warnings: []
    };
    
    // Check if inputSchema exists
    if (!tool.inputSchema && !tool.parameters) {
      validation.warnings.push('No input schema defined');
      return validation;
    }
    
    const schema = tool.inputSchema || tool.parameters;
    
    // Check if it's a Zod schema
    if (schema && typeof schema === 'object') {
      if (schema._def && schema._def.typeName) {
        // It's a Zod schema - good!
        try {
          // Try to parse an empty object to check if schema is valid
          const testObj = {};
          if (schema.safeParse) {
            const result = schema.safeParse(testObj);
            // We don't care if it fails, just that it doesn't throw
          }
        } catch (error) {
          validation.isValid = false;
          validation.errors.push(`Invalid Zod schema: ${error.message}`);
        }
      } else if (schema.type === 'object' && schema.properties) {
        // It's a JSON Schema - validate structure
        if (!this.isValidJsonSchema(schema)) {
          validation.isValid = false;
          validation.errors.push('Invalid JSON Schema structure');
        }
      } else if (Object.keys(schema).length === 0) {
        validation.warnings.push('Empty input schema - tool takes no parameters');
      } else {
        validation.warnings.push('Input schema format unclear (not Zod or JSON Schema)');
      }
    }
    
    return validation;
  }

  /**
   * Validate output schema
   */
  validateOutputSchema(tool) {
    const validation = {
      isValid: true,
      errors: [],
      warnings: []
    };
    
    // Output schema is optional but recommended
    if (!tool.outputSchema && !tool.output) {
      validation.warnings.push('No output schema defined - consider adding for better documentation');
      return validation;
    }
    
    const schema = tool.outputSchema || tool.output;
    
    if (schema && typeof schema === 'object') {
      if (Object.keys(schema).length === 0) {
        validation.warnings.push('Empty output schema - tool returns no data');
      } else if (!this.isValidJsonSchema(schema) && !schema._def) {
        validation.warnings.push('Output schema format unclear');
      }
    }
    
    return validation;
  }

  /**
   * Validate execute method
   */
  async validateExecuteMethod(tool) {
    const validation = {
      isValid: true,
      errors: [],
      warnings: []
    };
    
    // Check if tool has execute method
    if (!tool.execute && !tool._execute) {
      validation.isValid = false;
      validation.errors.push('No execute method found');
      return validation;
    }
    
    const executeMethod = tool.execute || tool._execute;
    
    // Check if it's a function
    if (typeof executeMethod !== 'function') {
      validation.isValid = false;
      validation.errors.push('Execute method is not a function');
      return validation;
    }
    
    // Check if it's async (recommended)
    if (executeMethod.constructor.name !== 'AsyncFunction') {
      validation.warnings.push('Execute method is not async - consider making it async');
    }
    
    // Try to analyze the function signature
    const funcStr = executeMethod.toString();
    if (!funcStr.includes('params') && !funcStr.includes('args') && !funcStr.includes('input')) {
      validation.warnings.push('Execute method may not be accepting parameters correctly');
    }
    
    return validation;
  }

  /**
   * Validate database entry against tool definition
   */
  validateDatabaseEntry(tool, dbEntry) {
    const validation = {
      isValid: true,
      errors: [],
      warnings: [],
      fixes: []
    };
    
    // Check name matches
    if (tool.name !== dbEntry.name) {
      validation.isValid = false;
      validation.errors.push(`Name mismatch: tool=${tool.name}, db=${dbEntry.name}`);
    }
    
    // Check description
    if (tool.description !== dbEntry.description) {
      validation.warnings.push('Description mismatch between tool and database');
      validation.fixes.push({ field: 'description', oldValue: dbEntry.description, newValue: tool.description });
    }
    
    // Check input schema
    const toolInputSchema = this.normalizeSchema(tool.inputSchema || tool.parameters);
    const dbInputSchema = this.normalizeSchema(dbEntry.inputSchema);
    
    if (!this.schemasMatch(toolInputSchema, dbInputSchema)) {
      validation.errors.push('Input schema mismatch between tool and database');
      validation.fixes.push({ 
        field: 'inputSchema', 
        issue: 'Schema in database does not match tool implementation',
        dbHas: this.getSchemaInfo(dbInputSchema),
        toolHas: this.getSchemaInfo(toolInputSchema)
      });
    }
    
    // Check output schema
    const toolOutputSchema = this.normalizeSchema(tool.outputSchema || tool.output);
    const dbOutputSchema = this.normalizeSchema(dbEntry.outputSchema);
    
    if (!this.schemasMatch(toolOutputSchema, dbOutputSchema)) {
      if (toolOutputSchema && Object.keys(toolOutputSchema).length > 0) {
        validation.warnings.push('Output schema mismatch - database missing output definition');
        validation.fixes.push({ 
          field: 'outputSchema', 
          issue: 'Database missing output schema that tool defines',
          dbHas: this.getSchemaInfo(dbOutputSchema),
          toolHas: this.getSchemaInfo(toolOutputSchema)
        });
      }
    }
    
    return validation;
  }

  /**
   * Normalize schema for comparison
   */
  normalizeSchema(schema) {
    if (!schema) return {};
    
    // If it's a Zod schema, try to extract shape
    if (schema._def && schema._def.typeName === 'ZodObject') {
      try {
        const shape = {};
        if (schema._def.shape) {
          for (const [key, value] of Object.entries(schema._def.shape())) {
            shape[key] = this.zodToJsonSchema(value);
          }
        }
        return { type: 'object', properties: shape };
      } catch (e) {
        return schema;
      }
    }
    
    return schema;
  }

  /**
   * Convert Zod schema to JSON schema (simplified)
   */
  zodToJsonSchema(zodSchema) {
    if (!zodSchema || !zodSchema._def) return { type: 'any' };
    
    const typeName = zodSchema._def.typeName;
    
    switch (typeName) {
      case 'ZodString':
        return { type: 'string', description: zodSchema._def.description };
      case 'ZodNumber':
        return { type: 'number', description: zodSchema._def.description };
      case 'ZodBoolean':
        return { type: 'boolean', description: zodSchema._def.description };
      case 'ZodArray':
        return { type: 'array', items: this.zodToJsonSchema(zodSchema._def.type) };
      case 'ZodObject':
        return { type: 'object', properties: {} };
      case 'ZodOptional':
        return { ...this.zodToJsonSchema(zodSchema._def.innerType), optional: true };
      case 'ZodUnion':
        return { oneOf: zodSchema._def.options.map(opt => this.zodToJsonSchema(opt)) };
      default:
        return { type: 'any', zodType: typeName };
    }
  }

  /**
   * Check if two schemas match
   */
  schemasMatch(schema1, schema2) {
    // Both empty
    if ((!schema1 || Object.keys(schema1).length === 0) && 
        (!schema2 || Object.keys(schema2).length === 0)) {
      return true;
    }
    
    // One empty, one not
    if (!schema1 || !schema2) {
      return false;
    }
    
    // For now, just check if both have content
    // TODO: Deep comparison
    return Object.keys(schema1).length > 0 && Object.keys(schema2).length > 0;
  }

  /**
   * Get schema info for reporting
   */
  getSchemaInfo(schema) {
    if (!schema || Object.keys(schema).length === 0) {
      return 'empty/missing';
    }
    
    if (schema.properties) {
      const props = Object.keys(schema.properties);
      return `${props.length} properties: ${props.join(', ')}`;
    }
    
    if (schema._def) {
      return `Zod ${schema._def.typeName}`;
    }
    
    return 'unknown format';
  }

  /**
   * Check if JSON Schema is valid
   */
  isValidJsonSchema(schema) {
    if (!schema || typeof schema !== 'object') return false;
    
    // Basic JSON Schema validation
    if (schema.type === 'object') {
      return schema.properties && typeof schema.properties === 'object';
    }
    
    return true;
  }

  /**
   * Print validation summary
   */
  printSummary() {
    console.log('\n' + '═'.repeat(60));
    console.log('📊 Validation Summary');
    console.log('═'.repeat(60));
    
    console.log(`\n✅ Valid tools: ${this.results.valid}/${this.results.total}`);
    console.log(`❌ Invalid tools: ${this.results.invalid}`);
    console.log(`⚠️  Warnings: ${this.results.warnings.length}`);
    console.log(`🔧 Mismatched with DB: ${this.results.mismatched}`);
    console.log(`👻 Orphaned in DB: ${this.results.missing}`);
    
    if (this.results.errors.length > 0) {
      console.log('\n❌ Errors:');
      const errorsByType = {};
      this.results.errors.forEach(err => {
        const key = err.error;
        errorsByType[key] = (errorsByType[key] || 0) + 1;
      });
      
      Object.entries(errorsByType).forEach(([error, count]) => {
        console.log(`  - ${error}: ${count} occurrences`);
      });
    }
    
    if (this.results.warnings.length > 0) {
      console.log('\n⚠️  Warning Types:');
      const warningsByType = {};
      this.results.warnings.forEach(warn => {
        const key = warn.warning;
        warningsByType[key] = (warningsByType[key] || 0) + 1;
      });
      
      Object.entries(warningsByType).forEach(([warning, count]) => {
        console.log(`  - ${warning}: ${count} occurrences`);
      });
    }
    
    console.log('\n' + '═'.repeat(60));
  }

  /**
   * Fix issues found during validation
   */
  async fixIssues(dryRun = true) {
    await this.initialize();
    
    console.log('\n🔧 Fixing Tool Schema Issues');
    console.log('═'.repeat(60));
    
    if (dryRun) {
      console.log('📝 DRY RUN - No changes will be made\n');
    }
    
    // First run validation to find issues
    await this.validateAll();
    
    if (this.results.errors.length === 0 && this.results.warnings.length === 0) {
      console.log('✅ No issues to fix!');
      return;
    }
    
    // Reload all modules and update database with correct schemas
    console.log('\n🔄 Reloading all tools with correct schemas...\n');
    
    const modulesResult = await this.moduleLoader.loadModules();
    const modules = modulesResult.loaded;
    let fixed = 0;
    let failed = 0;
    
    for (const { config, instance } of modules) {
      if (!instance || typeof instance.getTools !== 'function') continue;
      
      const moduleName = instance.name || config.name;
      const tools = instance.getTools();
      
      for (const tool of tools) {
        try {
          // Get the full tool data including all schemas
          const toolData = {
            name: tool.name,
            moduleName: moduleName,
            description: tool.description || '',
            hasExecute: !!(tool.execute || tool._execute),
            inputSchema: this.extractFullSchema(tool.inputSchema || tool.parameters || {}),
            outputSchema: this.extractFullSchema(tool.outputSchema || tool.output || {}),
            category: tool.category || 'general',
            capabilities: tool.capabilities || [],
            tags: tool.tags || [],
            updatedAt: new Date()
          };
          
          if (!dryRun) {
            await this.provider.saveTool(toolData);
            console.log(`  ✅ Fixed: ${tool.name}`);
          } else {
            console.log(`  📝 Would fix: ${tool.name}`);
            if (this.verbose) {
              console.log(`     Input: ${this.getSchemaInfo(toolData.inputSchema)}`);
              console.log(`     Output: ${this.getSchemaInfo(toolData.outputSchema)}`);
            }
          }
          fixed++;
        } catch (error) {
          console.log(`  ❌ Failed to fix ${tool.name}: ${error.message}`);
          failed++;
        }
      }
    }
    
    console.log('\n' + '═'.repeat(60));
    console.log(`📊 Fix Summary: ${fixed} fixed, ${failed} failed`);
    
    if (!dryRun) {
      console.log('\n✅ Database updated with correct schemas');
    } else {
      console.log('\n💡 Run with fixIssues(false) to apply changes');
    }
  }

  /**
   * Extract full schema including nested properties
   */
  extractFullSchema(schema) {
    if (!schema) return {};
    
    // If it's a Zod schema, convert to JSON Schema
    if (schema._def && schema._def.typeName) {
      return this.zodSchemaToFullJson(schema);
    }
    
    // If it's already JSON Schema, return as is
    if (schema.type || schema.properties) {
      return schema;
    }
    
    // If it's empty object, return empty schema
    if (Object.keys(schema).length === 0) {
      return {};
    }
    
    // Otherwise try to infer structure
    return schema;
  }

  /**
   * Convert Zod schema to full JSON schema
   */
  zodSchemaToFullJson(zodSchema) {
    if (!zodSchema || !zodSchema._def) return {};
    
    const def = zodSchema._def;
    const typeName = def.typeName;
    
    // Extract description if available
    const description = def.description || def.checks?.find(c => c.kind === 'description')?.message;
    
    let schema = {};
    
    switch (typeName) {
      case 'ZodString':
        schema = { type: 'string' };
        if (description) schema.description = description;
        if (def.minLength) schema.minLength = def.minLength.value;
        if (def.maxLength) schema.maxLength = def.maxLength.value;
        break;
        
      case 'ZodNumber':
        schema = { type: 'number' };
        if (description) schema.description = description;
        if (def.minimum) schema.minimum = def.minimum.value;
        if (def.maximum) schema.maximum = def.maximum.value;
        break;
        
      case 'ZodBoolean':
        schema = { type: 'boolean' };
        if (description) schema.description = description;
        break;
        
      case 'ZodArray':
        schema = {
          type: 'array',
          items: this.zodSchemaToFullJson(def.type)
        };
        if (description) schema.description = description;
        break;
        
      case 'ZodObject':
        const properties = {};
        const required = [];
        
        if (def.shape) {
          const shape = def.shape();
          for (const [key, value] of Object.entries(shape)) {
            properties[key] = this.zodSchemaToFullJson(value);
            
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
        schema = this.zodSchemaToFullJson(def.innerType);
        // Don't mark as required
        break;
        
      case 'ZodUnion':
        schema = {
          oneOf: def.options.map(opt => this.zodSchemaToFullJson(opt))
        };
        if (description) schema.description = description;
        break;
        
      case 'ZodAny':
        schema = { type: 'any' };
        if (description) schema.description = description;
        break;
        
      default:
        schema = { type: 'unknown', zodType: typeName };
        if (description) schema.description = description;
    }
    
    return schema;
  }
}

// Export for use in scripts
export default ToolSchemaValidator;