/**
 * Comprehensive Metadata Verification Integration Tests
 * 
 * Tests that ALL metadata is correctly preserved through the complete
 * two-collection architecture workflow:
 * 
 * 1. module-registry (discovered modules) 
 * 2. modules (loaded modules)
 * 3. tools (tools with module references)
 * 
 * Follows strict TDD approach with NO MOCKS - validates real database operations
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { DatabaseOperations } from '../../src/core/DatabaseOperations.js';
import { DatabaseStorage } from '../../src/core/DatabaseStorage.js';
import { ModuleDiscovery } from '../../src/core/ModuleDiscovery.js';
import { ResourceManager } from '@legion/resource-manager';
import { MongoClient } from 'mongodb';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Comprehensive Metadata Verification', () => {
  let resourceManager;
  let mongoClient;
  let testDbName;
  let databaseStorage;
  let databaseOperations;
  let moduleDiscovery;
  let testModulesPath;

  beforeEach(async () => {
    // Create unique test database
    testDbName = `test_metadata_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    
    // Initialize ResourceManager
    resourceManager = await ResourceManager.getResourceManager();
    
    // Create MongoDB connection
    const mongoUrl = resourceManager.get('env.MONGODB_URL') || 'mongodb://localhost:27017';
    mongoClient = new MongoClient(mongoUrl);
    await mongoClient.connect();
    
    // Set test database
    resourceManager.set('test', { 
      database: { 
        name: testDbName,
        client: mongoClient
      }
    });

    // Initialize database components
    databaseStorage = new DatabaseStorage({ 
      resourceManager,
      databaseName: testDbName
    });
    await databaseStorage.initialize();

    moduleDiscovery = new ModuleDiscovery({
      databaseStorage,
      verbose: false
    });

    databaseOperations = new DatabaseOperations({
      databaseStorage,
      moduleDiscovery,
      resourceManager,
      verbose: false
    });

    // Create test modules directory
    testModulesPath = path.join(__dirname, `../test-modules-metadata-${Date.now()}`);
    await fs.mkdir(testModulesPath, { recursive: true });
  });

  afterEach(async () => {
    // Clean up database
    if (mongoClient) {
      try {
        await mongoClient.db(testDbName).dropDatabase();
      } catch (error) {
        console.warn('Failed to drop test database:', error.message);
      }
      await mongoClient.close();
    }

    // Clean up test modules
    if (testModulesPath) {
      try {
        await fs.rm(testModulesPath, { recursive: true, force: true });
      } catch (error) {
        console.warn('Failed to clean test modules:', error.message);
      }
    }
  });

  describe('Complete Module Loading Pipeline', () => {
    it('should preserve ALL metadata through module-registry → modules → tools workflow', async () => {
      // Step 1: Create comprehensive test module with rich metadata
      const comprehensiveModule = `
        export default class ComprehensiveModule {
          getName() { 
            return 'ComprehensiveModule'; 
          }
          
          getVersion() { 
            return '2.5.1'; 
          }
          
          getDescription() { 
            return 'A comprehensive test module with rich metadata for validation'; 
          }
          
          getAuthor() {
            return 'Legion Test Suite';
          }
          
          getKeywords() {
            return ['testing', 'metadata', 'validation', 'comprehensive'];
          }
          
          getDependencies() {
            return ['path', 'fs'];
          }
          
          getTools() {
            return [
              {
                name: 'processData',
                description: 'Process complex data structures with validation',
                category: 'data-processing',
                tags: ['validation', 'processing', 'complex'],
                inputSchema: {
                  type: 'object',
                  properties: {
                    data: { 
                      type: 'array', 
                      items: { type: 'object' },
                      description: 'Array of data objects to process'
                    },
                    options: {
                      type: 'object',
                      properties: {
                        strict: { type: 'boolean', default: true },
                        maxItems: { type: 'number', minimum: 1, maximum: 1000 }
                      },
                      required: ['strict']
                    }
                  },
                  required: ['data', 'options']
                },
                outputSchema: {
                  type: 'object',
                  properties: {
                    result: { 
                      type: 'array',
                      description: 'Processed data results'
                    },
                    metadata: {
                      type: 'object',
                      properties: {
                        processedCount: { type: 'number' },
                        errors: { type: 'array' },
                        timestamp: { type: 'string', format: 'date-time' }
                      }
                    }
                  },
                  required: ['result', 'metadata']
                },
                examples: [
                  {
                    name: 'Basic data processing',
                    input: {
                      data: [{ id: 1, value: 'test' }],
                      options: { strict: true }
                    },
                    output: {
                      result: [{ id: 1, value: 'test', processed: true }],
                      metadata: { processedCount: 1, errors: [], timestamp: '2025-01-01T00:00:00Z' }
                    }
                  }
                ],
                execute: async ({ data, options }) => ({
                  result: data.map(item => ({ ...item, processed: true })),
                  metadata: {
                    processedCount: data.length,
                    errors: [],
                    timestamp: new Date().toISOString()
                  }
                })
              },
              {
                name: 'validateInput',
                description: 'Validate input data against schema rules',
                category: 'validation',
                tags: ['validation', 'schema', 'input'],
                inputSchema: {
                  type: 'object',
                  properties: {
                    input: { type: 'any', description: 'Input to validate' },
                    schema: { 
                      type: 'object',
                      description: 'JSON schema for validation'
                    },
                    strict: { type: 'boolean', default: false }
                  },
                  required: ['input', 'schema']
                },
                outputSchema: {
                  type: 'object',
                  properties: {
                    valid: { type: 'boolean' },
                    errors: { 
                      type: 'array',
                      items: { type: 'string' }
                    },
                    normalizedInput: { type: 'any' }
                  },
                  required: ['valid', 'errors']
                },
                execute: async ({ input, schema, strict = false }) => ({
                  valid: true,
                  errors: [],
                  normalizedInput: input
                })
              },
              {
                name: 'transformData',
                description: 'Transform data using configurable rules',
                category: 'transformation',
                tags: ['transform', 'rules', 'data'],
                inputSchema: {
                  type: 'object',
                  properties: {
                    data: { type: 'any' },
                    rules: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          field: { type: 'string' },
                          operation: { type: 'string', enum: ['uppercase', 'lowercase', 'trim'] },
                          condition: { type: 'string' }
                        },
                        required: ['field', 'operation']
                      }
                    }
                  },
                  required: ['data', 'rules']
                },
                outputSchema: {
                  type: 'object',
                  properties: {
                    transformed: { type: 'any' },
                    appliedRules: { type: 'number' }
                  }
                },
                execute: async ({ data, rules }) => ({
                  transformed: data,
                  appliedRules: rules.length
                })
              }
            ];
          }
        }
      `;

      const modulePath = path.join(testModulesPath, 'ComprehensiveModule.js');
      await fs.writeFile(modulePath, comprehensiveModule);

      // Step 2: Discover and save to module-registry
      const discovered = await moduleDiscovery.discoverModules(testModulesPath);
      expect(discovered).toHaveLength(1);
      expect(discovered[0].name).toBe('ComprehensiveModule');
      
      const savedToRegistry = await moduleDiscovery.saveToModuleRegistry(discovered);
      expect(savedToRegistry).toBe(1);

      // Step 3: Verify module-registry content
      const registryCollection = databaseStorage.getCollection('module-registry');
      const registryDoc = await registryCollection.findOne({ name: 'ComprehensiveModule' });
      
      expect(registryDoc).toBeDefined();
      expect(registryDoc.name).toBe('ComprehensiveModule');
      expect(registryDoc.path).toBe(modulePath);
      expect(registryDoc.status).toBe('discovered');
      expect(registryDoc.packageName).toBeDefined();
      expect(registryDoc.lastUpdated).toBeDefined();

      // Step 4: Load module through DatabaseOperations (module-registry → modules)
      const loadResult = await databaseOperations.loadModuleByName('ComprehensiveModule');
      
      expect(loadResult.success).toBe(true);
      expect(loadResult.module).toBeDefined();
      expect(loadResult.tools).toHaveLength(3);
      expect(loadResult.toolsCount).toBe(3);

      // Step 5: Verify modules collection has complete metadata
      const modulesCollection = databaseStorage.getCollection('modules');
      const moduleDoc = await modulesCollection.findOne({ _id: 'ComprehensiveModule' });
      
      expect(moduleDoc).toBeDefined();
      expect(moduleDoc.name).toBe('ComprehensiveModule');
      expect(moduleDoc.version).toBe('2.5.1');
      expect(moduleDoc.description).toBe('A comprehensive test module with rich metadata for validation');
      expect(moduleDoc.status).toBe('loaded');
      expect(moduleDoc.loaded).toBe(true);
      expect(moduleDoc.loadedAt).toBeDefined();
      expect(moduleDoc.savedAt).toBeDefined();
      expect(moduleDoc.path).toBe(modulePath);
      expect(moduleDoc.packageName).toBeDefined();

      // Step 6: Verify tools collection has complete metadata and correct module references
      const toolsCollection = databaseStorage.getCollection('tools');
      const tools = await toolsCollection.find({ moduleName: 'ComprehensiveModule' }).toArray();
      
      expect(tools).toHaveLength(3);

      // Verify processData tool
      const processDataTool = tools.find(t => t.name === 'processData');
      expect(processDataTool).toBeDefined();
      expect(processDataTool.name).toBe('processData');
      expect(processDataTool.description).toBe('Process complex data structures with validation');
      expect(processDataTool.category).toBe('data-processing');
      expect(processDataTool.tags).toEqual(['validation', 'processing', 'complex']);
      expect(processDataTool.moduleName).toBe('ComprehensiveModule');
      expect(processDataTool.savedAt).toBeDefined();
      expect(processDataTool._id).toBe('ComprehensiveModule:processData');
      
      // Verify complete input schema preservation
      expect(processDataTool.inputSchema).toBeDefined();
      expect(processDataTool.inputSchema.type).toBe('object');
      expect(processDataTool.inputSchema.properties.data).toBeDefined();
      expect(processDataTool.inputSchema.properties.data.items).toEqual({ type: 'object' });
      expect(processDataTool.inputSchema.properties.options.properties.strict).toEqual({ type: 'boolean', default: true });
      expect(processDataTool.inputSchema.properties.options.properties.maxItems).toEqual({ type: 'number', minimum: 1, maximum: 1000 });
      expect(processDataTool.inputSchema.required).toEqual(['data', 'options']);
      
      // Verify complete output schema preservation
      expect(processDataTool.outputSchema).toBeDefined();
      expect(processDataTool.outputSchema.properties.metadata.properties.processedCount).toEqual({ type: 'number' });
      expect(processDataTool.outputSchema.required).toEqual(['result', 'metadata']);

      // Verify validateInput tool
      const validateInputTool = tools.find(t => t.name === 'validateInput');
      expect(validateInputTool).toBeDefined();
      expect(validateInputTool.name).toBe('validateInput');
      expect(validateInputTool.description).toBe('Validate input data against schema rules');
      expect(validateInputTool.category).toBe('validation');
      expect(validateInputTool.tags).toEqual(['validation', 'schema', 'input']);
      expect(validateInputTool.moduleName).toBe('ComprehensiveModule');
      expect(validateInputTool._id).toBe('ComprehensiveModule:validateInput');

      // Verify transformData tool
      const transformDataTool = tools.find(t => t.name === 'transformData');
      expect(transformDataTool).toBeDefined();
      expect(transformDataTool.name).toBe('transformData');
      expect(transformDataTool.description).toBe('Transform data using configurable rules');
      expect(transformDataTool.category).toBe('transformation');
      expect(transformDataTool.tags).toEqual(['transform', 'rules', 'data']);
      expect(transformDataTool.moduleName).toBe('ComprehensiveModule');
      expect(transformDataTool.inputSchema.properties.rules.items.properties.operation.enum).toEqual(['uppercase', 'lowercase', 'trim']);

      // Step 7: Verify execute function is NOT saved to database (security)
      tools.forEach(tool => {
        expect(tool.execute).toBeUndefined();
      });

      // Step 8: Verify tool execution still works (loaded from module instance)
      const processDataInstance = loadResult.tools.find(t => t.name === 'processData');
      expect(processDataInstance).toBeDefined();
      expect(typeof processDataInstance.execute).toBe('function');
      
      const execResult = await processDataInstance.execute({
        data: [{ id: 1, value: 'test' }],
        options: { strict: true }
      });
      
      expect(execResult.result).toHaveLength(1);
      expect(execResult.result[0].processed).toBe(true);
      expect(execResult.metadata.processedCount).toBe(1);
      expect(execResult.metadata.timestamp).toBeDefined();
    });

    it('should handle modules with missing optional metadata gracefully', async () => {
      // Step 1: Create minimal module with only required methods
      const minimalModule = `
        export default class MinimalModule {
          getName() { 
            return 'MinimalModule'; 
          }
          
          getTools() {
            return [
              {
                name: 'simpleTool',
                description: 'A simple tool with minimal metadata',
                execute: async ({ input }) => ({ output: input })
              }
            ];
          }
        }
      `;

      const modulePath = path.join(testModulesPath, 'MinimalModule.js');
      await fs.writeFile(modulePath, minimalModule);

      // Step 2: Discover and load
      const discovered = await moduleDiscovery.discoverModules(testModulesPath);
      await moduleDiscovery.saveToModuleRegistry(discovered);
      
      const loadResult = await databaseOperations.loadModuleByName('MinimalModule');
      
      // Step 3: Verify minimal metadata is preserved
      expect(loadResult.success).toBe(true);
      expect(loadResult.module.name).toBe('MinimalModule');
      expect(loadResult.tools).toHaveLength(1);

      // Step 4: Verify database documents handle missing fields
      const moduleDoc = await databaseStorage.getCollection('modules').findOne({ _id: 'MinimalModule' });
      expect(moduleDoc.name).toBe('MinimalModule');
      expect(moduleDoc.version).toBeUndefined(); // getVersion() method missing
      expect(moduleDoc.description).toBeUndefined(); // getDescription() method missing
      
      const toolDoc = await databaseStorage.getCollection('tools').findOne({ name: 'simpleTool' });
      expect(toolDoc.name).toBe('simpleTool');
      expect(toolDoc.description).toBe('A simple tool with minimal metadata');
      expect(toolDoc.inputSchema).toBeUndefined(); // No input schema provided
      expect(toolDoc.outputSchema).toBeUndefined(); // No output schema provided
      expect(toolDoc.category).toBeUndefined(); // No category provided
      expect(toolDoc.tags).toBeUndefined(); // No tags provided
    });

    it('should maintain referential integrity between collections', async () => {
      // Step 1: Create multiple modules
      const module1 = `
        export default class Module1 {
          getName() { return 'Module1'; }
          getDescription() { return 'First test module'; }
          getTools() {
            return [
              { name: 'tool1', description: 'Tool from module 1', execute: async () => ({}) },
              { name: 'tool2', description: 'Another tool from module 1', execute: async () => ({}) }
            ];
          }
        }
      `;

      const module2 = `
        export default class Module2 {
          getName() { return 'Module2'; }
          getDescription() { return 'Second test module'; }
          getTools() {
            return [
              { name: 'tool3', description: 'Tool from module 2', execute: async () => ({}) }
            ];
          }
        }
      `;

      await fs.writeFile(path.join(testModulesPath, 'Module1.js'), module1);
      await fs.writeFile(path.join(testModulesPath, 'Module2.js'), module2);

      // Step 2: Discover and load all modules
      const discovered = await moduleDiscovery.discoverModules(testModulesPath);
      await moduleDiscovery.saveToModuleRegistry(discovered);
      
      for (const module of discovered) {
        await databaseOperations.loadModuleByName(module.name);
      }

      // Step 3: Verify referential integrity
      const modules = await databaseStorage.getCollection('modules').find({}).toArray();
      const tools = await databaseStorage.getCollection('tools').find({}).toArray();

      expect(modules).toHaveLength(2);
      expect(tools).toHaveLength(3);

      // Every tool must reference an existing module
      for (const tool of tools) {
        const referencedModule = modules.find(m => m.name === tool.moduleName);
        expect(referencedModule).toBeDefined();
        expect(tool._id).toBe(`${tool.moduleName}:${tool.name}`);
      }

      // Verify specific tool-to-module relationships
      const tool1 = tools.find(t => t.name === 'tool1');
      const tool2 = tools.find(t => t.name === 'tool2');
      const tool3 = tools.find(t => t.name === 'tool3');

      expect(tool1.moduleName).toBe('Module1');
      expect(tool2.moduleName).toBe('Module1');
      expect(tool3.moduleName).toBe('Module2');

      // Step 4: Verify clear module maintains referential integrity
      await databaseOperations.clearModule('Module1');

      const remainingModules = await databaseStorage.getCollection('modules').find({}).toArray();
      const remainingTools = await databaseStorage.getCollection('tools').find({}).toArray();

      expect(remainingModules).toHaveLength(1);
      expect(remainingModules[0].name).toBe('Module2');
      
      expect(remainingTools).toHaveLength(1);
      expect(remainingTools[0].name).toBe('tool3');
      expect(remainingTools[0].moduleName).toBe('Module2');
    });
  });
});