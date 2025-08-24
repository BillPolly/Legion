/**
 * Integration Tests for ToolRegistry Metadata Preservation Workflow
 * 
 * Tests the complete workflow with real database operations to ensure
 * metadata is preserved correctly through the entire pipeline:
 * module-registry → modules → tools → ToolRegistry verification
 * 
 * NO MOCKS - real implementation testing only
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ToolRegistry } from '../../src/integration/ToolRegistry.js';
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

describe('ToolRegistry Metadata Preservation Workflow', () => {
  let resourceManager;
  let mongoClient;
  let testDbName;
  let databaseStorage;
  let databaseOperations;
  let moduleDiscovery;
  let toolRegistry;
  let testModulesPath;

  beforeEach(async () => {
    // Create unique test database
    testDbName = `test_tr_metadata_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    
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

    // Initialize ToolRegistry with proper initialization
    toolRegistry = new ToolRegistry({
      resourceManager,
      options: { cacheSize: 100 }
    });
    
    // Properly initialize ToolRegistry
    await toolRegistry.initialize();

    // Create test modules directory
    testModulesPath = path.join(__dirname, `../tmp/tr-metadata-${Date.now()}`);
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

  describe('Complete Metadata Verification Workflow', () => {
    it('should verify metadata preservation through complete workflow', async () => {
      // Step 1: Create test module with comprehensive metadata
      const testModule = `
        import { Module } from '../../../src/core/Module.js';
        
        export default class TestMetadataModule extends Module {
          constructor() {
            super();
            this.name = 'TestMetadataModule';
            this.description = 'Test module for metadata verification workflow';
            this.version = '1.2.3';
            this.author = 'ToolRegistry Test Suite';
            this.keywords = ['testing', 'metadata', 'verification'];
            this.dependencies = ['path', 'fs', 'util'];
          }
          
          static async create(resourceManager) {
            const instance = new TestMetadataModule();
            await instance.initialize();
            
            // Add tools using registerTool method
            instance.registerTool('dataProcessor', {
              name: 'dataProcessor',
              description: 'Process data with complex schema',
              category: 'data-processing',
              tags: ['processing', 'validation', 'schema'],
              inputSchema: {
                type: 'object',
                properties: {
                  data: { 
                    type: 'array', 
                    items: { type: 'object' },
                    description: 'Data to process'
                  },
                  config: {
                    type: 'object',
                    properties: {
                      strict: { type: 'boolean', default: true },
                      maxSize: { type: 'number', minimum: 1 }
                    },
                    required: ['strict']
                  }
                },
                required: ['data', 'config']
              },
              outputSchema: {
                type: 'object',
                properties: {
                  processed: { type: 'array' },
                  summary: {
                    type: 'object',
                    properties: {
                      count: { type: 'number' },
                      errors: { type: 'array' }
                    }
                  }
                },
                required: ['processed', 'summary']
              },
              examples: [
                {
                  name: 'Basic processing',
                  input: {
                    data: [{ id: 1 }],
                    config: { strict: true }
                  },
                  output: {
                    processed: [{ id: 1, processed: true }],
                    summary: { count: 1, errors: [] }
                  }
                }
              ],
              execute: async ({ data, config }) => ({
                processed: data.map(item => ({ ...item, processed: true })),
                summary: { count: data.length, errors: [] }
              })
            });
            
            instance.registerTool('validator', {
              name: 'validator',
              description: 'Validate input against rules',
              category: 'validation',
              tags: ['validation', 'rules'],
              inputSchema: {
                type: 'object',
                properties: {
                  value: { type: 'any' },
                  rules: { type: 'array' }
                },
                required: ['value', 'rules']
              },
              outputSchema: {
                type: 'object',
                properties: {
                  valid: { type: 'boolean' },
                  violations: { type: 'array' }
                }
              },
              execute: async ({ value, rules }) => ({
                valid: true,
                violations: []
              })
            });
            
            return instance;
          }
        }
      `;

      const modulePath = path.join(testModulesPath, 'TestMetadataModule.js');
      await fs.writeFile(modulePath, testModule);

      // Step 2: Run complete discovery and loading workflow
      const discovered = await moduleDiscovery.discoverModules(testModulesPath);
      await moduleDiscovery.saveToModuleRegistry(discovered);
      
      const loadResult = await databaseOperations.loadModuleByName('TestMetadataModule');
      expect(loadResult.success).toBe(true);
      expect(loadResult.tools).toHaveLength(2);

      // Step 3: Verify module metadata through ToolRegistry
      const moduleVerification = await toolRegistry.verifyModuleMetadata('TestMetadataModule');
      
      expect(moduleVerification.valid).toBe(true);
      expect(moduleVerification.errors).toHaveLength(0);
      expect(moduleVerification.moduleName).toBe('TestMetadataModule');
      
      // Verify collections exist and have content
      expect(moduleVerification.collections.registry.exists).toBe(true);
      expect(moduleVerification.collections.modules.exists).toBe(true);
      expect(moduleVerification.collections.tools.count).toBe(2);
      
      // Verify module-tool alignment
      expect(moduleVerification.moduleToolAlignment.aligned).toBe(true);
      expect(moduleVerification.moduleToolAlignment.actualToolsCount).toBe(2);
      expect(moduleVerification.moduleToolAlignment.databaseToolsCount).toBe(2);
      expect(moduleVerification.moduleToolAlignment.missingInDatabase).toHaveLength(0);
      expect(moduleVerification.moduleToolAlignment.extraInDatabase).toHaveLength(0);
      expect(moduleVerification.moduleToolAlignment.metadataMismatches).toHaveLength(0);
      
      // Verify metadata completeness
      expect(moduleVerification.metadata.hasVersion).toBe(true);
      expect(moduleVerification.metadata.hasDescription).toBe(true);

      // Step 4: Verify individual tool metadata
      const dataProcessorVerification = await toolRegistry.verifyToolMetadata('dataProcessor');
      
      expect(dataProcessorVerification.valid).toBe(true);
      expect(dataProcessorVerification.errors).toHaveLength(0);
      expect(dataProcessorVerification.toolName).toBe('dataProcessor');
      expect(dataProcessorVerification.moduleReference).toBe('TestMetadataModule');
      
      // Verify module alignment
      expect(dataProcessorVerification.moduleAlignment.moduleExists).toBe(true);
      expect(dataProcessorVerification.moduleAlignment.toolExistsInModule).toBe(true);
      expect(dataProcessorVerification.moduleAlignment.metadataMatches).toBe(true);
      expect(dataProcessorVerification.moduleAlignment.mismatches).toHaveLength(0);
      
      // Verify metadata completeness
      expect(dataProcessorVerification.metadata.hasDescription).toBe(true);
      expect(dataProcessorVerification.metadata.hasInputSchema).toBe(true);
      expect(dataProcessorVerification.metadata.hasOutputSchema).toBe(true);
      expect(dataProcessorVerification.metadata.hasCategory).toBe(true);
      expect(dataProcessorVerification.metadata.hasTags).toBe(true);
      expect(dataProcessorVerification.metadata.hasExamples).toBe(true);
      expect(dataProcessorVerification.metadata.completenessScore).toBe(100);

      // Step 5: Verify system integrity
      const systemIntegrity = await toolRegistry.verifySystemIntegrity();
      
      expect(systemIntegrity.valid).toBe(true);
      expect(systemIntegrity.errors).toHaveLength(0);
      expect(systemIntegrity.collections.registry.count).toBe(1);
      expect(systemIntegrity.collections.modules.count).toBe(1);
      expect(systemIntegrity.collections.tools.count).toBe(2);
      expect(systemIntegrity.referentialIntegrity.orphanedTools).toHaveLength(0);
      expect(systemIntegrity.summary.integrityScore).toBeGreaterThanOrEqual(100);
    });

    it('should detect and report metadata discrepancies', async () => {
      // Step 1: Create test module
      const testModule = `
        import { Module } from '../../../src/core/Module.js';
        
        export default class DiscrepancyModule extends Module {
          constructor() {
            super();
            this.name = 'DiscrepancyModule';
            this.description = 'Module for testing discrepancies';
          }
          
          static async create(resourceManager) {
            const instance = new DiscrepancyModule();
            await instance.initialize();
            
            instance.registerTool('testTool', {
              name: 'testTool',
              description: 'Updated tool description',
              category: 'testing',
              tags: ['test', 'updated'],
              inputSchema: { type: 'object', properties: { input: { type: 'string' } } },
              execute: async ({ input }) => ({ output: input })
            });
            
            return instance;
          }
        }
      `;

      const modulePath = path.join(testModulesPath, 'DiscrepancyModule.js');
      await fs.writeFile(modulePath, testModule);

      // Step 2: Load module normally
      const discovered = await moduleDiscovery.discoverModules(testModulesPath);
      await moduleDiscovery.saveToModuleRegistry(discovered);
      await databaseOperations.loadModuleByName('DiscrepancyModule');

      // Step 3: Manually corrupt database to simulate discrepancy
      const toolsCollection = databaseStorage.getCollection('tools');
      await toolsCollection.updateOne(
        { name: 'testTool' },
        {
          $set: {
            description: 'CORRUPTED DESCRIPTION',  // Different from module
            category: 'CORRUPTED',                 // Different from module
            tags: ['CORRUPTED']                    // Different from module
          }
        }
      );

      // Step 4: Verify ToolRegistry detects discrepancies
      const moduleVerification = await toolRegistry.verifyModuleMetadata('DiscrepancyModule');
      
      expect(moduleVerification.valid).toBe(false);
      expect(moduleVerification.moduleToolAlignment.aligned).toBe(false);
      expect(moduleVerification.moduleToolAlignment.metadataMismatches).toHaveLength(1);
      
      const mismatch = moduleVerification.moduleToolAlignment.metadataMismatches[0];
      expect(mismatch.toolName).toBe('testTool');
      expect(mismatch.mismatches).toHaveLength(3); // description, category, tags
      
      // Verify specific error messages
      expect(moduleVerification.errors).toContain(`Tool 'testTool' has metadata mismatches between module and database`);
      
      // Step 5: Verify tool-level verification also detects issues
      const toolVerification = await toolRegistry.verifyToolMetadata('testTool');
      expect(toolVerification.valid).toBe(false);
      expect(toolVerification.moduleAlignment.metadataMatches).toBe(false);
      expect(toolVerification.moduleAlignment.mismatches).toHaveLength(3);
    });

    it('should detect orphaned tools and missing modules', async () => {
      // Step 1: Create test module and load it
      const testModule = `
        import { Module } from '../../../src/core/Module.js';
        
        export default class OrphanTestModule extends Module {
          constructor() {
            super();
            this.name = 'OrphanTestModule';
            this.description = 'Module for testing orphaned tools';
          }
          
          static async create(resourceManager) {
            const instance = new OrphanTestModule();
            await instance.initialize();
            
            instance.registerTool('legitimateTool', {
              name: 'legitimateTool',
              description: 'A legitimate tool',
              execute: async () => ({})
            });
            
            return instance;
          }
        }
      `;

      const modulePath = path.join(testModulesPath, 'OrphanTestModule.js');
      await fs.writeFile(modulePath, testModule);

      const discovered = await moduleDiscovery.discoverModules(testModulesPath);
      await moduleDiscovery.saveToModuleRegistry(discovered);
      await databaseOperations.loadModuleByName('OrphanTestModule');

      // Step 2: Manually create orphaned tool
      const toolsCollection = databaseStorage.getCollection('tools');
      await toolsCollection.insertOne({
        _id: 'NonExistentModule:orphanTool',
        name: 'orphanTool',
        description: 'An orphaned tool',
        moduleName: 'NonExistentModule',
        savedAt: new Date().toISOString()
      });

      // Step 3: Verify system integrity detects orphaned tools
      const systemIntegrity = await toolRegistry.verifySystemIntegrity();
      
      expect(systemIntegrity.valid).toBe(false);
      expect(systemIntegrity.referentialIntegrity.orphanedTools).toHaveLength(1);
      expect(systemIntegrity.referentialIntegrity.orphanedTools[0].toolName).toBe('orphanTool');
      expect(systemIntegrity.referentialIntegrity.orphanedTools[0].referencedModule).toBe('NonExistentModule');
      expect(systemIntegrity.errors).toContain(`Orphaned tool 'orphanTool' references non-existent module 'NonExistentModule'`);

      // Step 4: Verify tool verification detects missing module
      const orphanVerification = await toolRegistry.verifyToolMetadata('orphanTool');
      expect(orphanVerification.valid).toBe(false);
      expect(orphanVerification.errors).toContain(`Tool references non-existent module: 'NonExistentModule'`);
    });

    it('should generate comprehensive metadata report', async () => {
      // Step 1: Create multiple modules with varying metadata quality
      const completeModule = `
        import { Module } from '../../../src/core/Module.js';
        
        export default class CompleteModule extends Module {
          constructor() {
            super();
            this.name = 'CompleteModule';
            this.description = 'Complete module with all metadata';
            this.version = '1.0.0';
            this.author = 'Test Author';
          }
          
          static async create(resourceManager) {
            const instance = new CompleteModule();
            await instance.initialize();
            
            instance.registerTool('completeTool', {
              name: 'completeTool',
              description: 'Tool with complete metadata',
              category: 'complete',
              tags: ['test', 'complete'],
              inputSchema: { type: 'object' },
              outputSchema: { type: 'object' },
              examples: [{ name: 'example', input: {}, output: {} }],
              execute: async () => ({})
            });
            
            return instance;
          }
        }
      `;

      const partialModule = `
        import { Module } from '../../../src/core/Module.js';
        
        export default class PartialModule extends Module {
          constructor() {
            super();
            this.name = 'PartialModule';
            this.description = 'Module with partial metadata';
          }
          
          static async create(resourceManager) {
            const instance = new PartialModule();
            await instance.initialize();
            
            instance.registerTool('partialTool', {
              name: 'partialTool',
              description: 'Tool with partial metadata',
              execute: async () => ({})
            });
            
            return instance;
          }
        }
      `;

      await fs.writeFile(path.join(testModulesPath, 'CompleteModule.js'), completeModule);
      await fs.writeFile(path.join(testModulesPath, 'PartialModule.js'), partialModule);

      // Step 2: Load modules
      const discovered = await moduleDiscovery.discoverModules(testModulesPath);
      await moduleDiscovery.saveToModuleRegistry(discovered);
      
      for (const module of discovered) {
        await databaseOperations.loadModuleByName(module.name);
      }

      // Step 3: Generate system-wide metadata report
      const report = await toolRegistry.getMetadataReport();
      
      expect(report.scope).toBe('system-wide');
      expect(report.modules).toHaveLength(2);
      expect(report.systemIntegrity).toBeDefined();
      expect(report.timestamp).toBeDefined();
      
      // Verify complete module report
      const completeModuleReport = report.modules.find(m => m.moduleName === 'CompleteModule');
      expect(completeModuleReport).toBeDefined();
      expect(completeModuleReport.valid).toBe(true);
      expect(completeModuleReport.metadata.metadataCompleteness.core).toBe(1);
      
      // Verify partial module report
      const partialModuleReport = report.modules.find(m => m.moduleName === 'PartialModule');
      expect(partialModuleReport).toBeDefined();
      expect(partialModuleReport.valid).toBe(true);

      // Step 4: Generate focused report for specific module
      const focusedReport = await toolRegistry.getMetadataReport('CompleteModule');
      
      expect(focusedReport.scope).toBe('module:CompleteModule');
      expect(focusedReport.modules).toHaveLength(1);
      expect(focusedReport.modules[0].moduleName).toBe('CompleteModule');
      expect(focusedReport.systemIntegrity).toBeDefined();
    });

    it('should detect security violations (execute functions in database)', async () => {
      // Step 1: Create normal module
      const testModule = `
        import { Module } from '../../../src/core/Module.js';
        
        export default class SecurityTestModule extends Module {
          constructor() {
            super();
            this.name = 'SecurityTestModule';
            this.description = 'Module for security testing';
          }
          
          static async create(resourceManager) {
            const instance = new SecurityTestModule();
            await instance.initialize();
            
            instance.registerTool('securityTool', {
              name: 'securityTool',
              description: 'Tool for security testing',
              execute: async () => ({ secure: true })
            });
            
            return instance;
          }
        }
      `;

      const modulePath = path.join(testModulesPath, 'SecurityTestModule.js');
      await fs.writeFile(modulePath, testModule);

      // Step 2: Load module normally
      const discovered = await moduleDiscovery.discoverModules(testModulesPath);
      await moduleDiscovery.saveToModuleRegistry(discovered);
      await databaseOperations.loadModuleByName('SecurityTestModule');

      // Step 3: Manually inject execute function into database (simulate security breach)
      const toolsCollection = databaseStorage.getCollection('tools');
      await toolsCollection.updateOne(
        { name: 'securityTool' },
        {
          $set: {
            execute: 'function() { return "malicious code"; }' // This should never exist
          }
        }
      );

      // Step 4: Verify security violation is detected
      const toolVerification = await toolRegistry.verifyToolMetadata('securityTool');
      
      expect(toolVerification.valid).toBe(false);
      expect(toolVerification.errors).toContain('Tool has execute function saved to database (security risk)');
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle database connection errors gracefully', async () => {
      // Close the database connection to simulate error
      await mongoClient.close();

      const result = await toolRegistry.verifyModuleMetadata('NonExistentModule');
      
      expect(result.valid).toBe(false);
      // After closing connection, the module won't be found
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should handle corrupted module data gracefully', async () => {
      // Step 1: Manually create corrupted module document
      const modulesCollection = databaseStorage.getCollection('modules');
      await modulesCollection.insertOne({
        _id: 'CorruptedModule',
        name: 'CorruptedModule',
        // Missing required fields like status, loaded, etc.
      });

      // Step 2: Verify ToolRegistry handles corruption gracefully
      const verification = await toolRegistry.verifyModuleMetadata('CorruptedModule');
      
      // Corrupted modules should be marked as invalid
      expect(verification.valid).toBe(false);
      expect(verification.errors.length).toBeGreaterThan(0);
    });

    it('should handle modules with no tools', async () => {
      // Step 1: Create module with no tools
      const emptyModule = `
        import { Module } from '../../../src/core/Module.js';
        
        export default class EmptyModule extends Module {
          constructor() {
            super();
            this.name = 'EmptyModule';
            this.description = 'Module with no tools';
          }
          
          static async create(resourceManager) {
            const instance = new EmptyModule();
            await instance.initialize();
            // No tools added - module can be empty
            return instance;
          }
        }
      `;

      const modulePath = path.join(testModulesPath, 'EmptyModule.js');
      await fs.writeFile(modulePath, emptyModule);

      // Step 2: Load module
      const discovered = await moduleDiscovery.discoverModules(testModulesPath);
      await moduleDiscovery.saveToModuleRegistry(discovered);
      await databaseOperations.loadModuleByName('EmptyModule');

      // Step 3: Verify module without tools is handled correctly
      const verification = await toolRegistry.verifyModuleMetadata('EmptyModule');
      
      expect(verification.valid).toBe(true);
      expect(verification.collections.tools.count).toBe(0);
      expect(verification.moduleToolAlignment.aligned).toBe(true);
      expect(verification.moduleToolAlignment.actualToolsCount).toBe(0);
      expect(verification.moduleToolAlignment.databaseToolsCount).toBe(0);
    });
  });
});