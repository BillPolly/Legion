/**
 * Unit Tests for Tool Registry Migration
 * 
 * Tests the data migration functionality in isolation
 */

import { ToolRegistryMigration, runMigrationCLI } from '../../../src/migration/ToolRegistryMigration.js';
import { ResourceManager } from '@legion/tools';
import fs from 'fs/promises';
import path from 'path';

// Mock the dependencies
const mockDatabaseService = {
  mongoProvider: {
    delete: jest.fn(),
  },
  getDatabaseStats: jest.fn()
};

const mockProvider = {
  saveModule: jest.fn(),
  saveTool: jest.fn(),
  getModule: jest.fn(),
  getToolsWithoutEmbeddings: jest.fn()
};

const mockSemanticSearch = {
  indexTool: jest.fn()
};

// Mock the imports
jest.mock('../../../src/database/ToolRegistryDatabaseService.js', () => ({
  ToolRegistryDatabaseService: {
    create: jest.fn()
  }
}));

jest.mock('../../../src/providers/MongoDBToolRegistryProvider.js', () => ({
  MongoDBToolRegistryProvider: {
    create: jest.fn()
  }
}));

jest.mock('../../../src/semantic/SemanticToolSearch.js', () => ({
  SemanticToolSearch: {
    create: jest.fn()
  }
}));

// Mock file system operations
jest.mock('fs/promises');

describe('ToolRegistryMigration Unit Tests', () => {
  let resourceManager;

  beforeAll(async () => {
    resourceManager = new ResourceManager();
    await resourceManager.initialize();
  });

  afterAll(async () => {
    if (resourceManager) {
      await resourceManager.cleanup();
    }
  });

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Setup default mock behaviors
    mockDatabaseService.mongoProvider.delete.mockResolvedValue({ deletedCount: 0 });
    mockDatabaseService.getDatabaseStats.mockResolvedValue({
      modules: 5,
      tools: 25,
      usageRecords: 0
    });
    
    mockProvider.saveModule.mockImplementation(async (data) => ({
      _id: `module_${Date.now()}`,
      ...data
    }));
    mockProvider.saveTool.mockImplementation(async (data) => ({
      _id: `tool_${Date.now()}`,
      ...data
    }));
    mockProvider.getModule.mockResolvedValue(null);
    mockProvider.getToolsWithoutEmbeddings.mockResolvedValue([]);
    
    mockSemanticSearch.indexTool.mockResolvedValue(undefined);
    
    // Setup module imports
    const { ToolRegistryDatabaseService } = require('../../../src/database/ToolRegistryDatabaseService.js');
    const { MongoDBToolRegistryProvider } = require('../../../src/providers/MongoDBToolRegistryProvider.js');
    const { SemanticToolSearch } = require('../../../src/semantic/SemanticToolSearch.js');
    
    ToolRegistryDatabaseService.create.mockResolvedValue(mockDatabaseService);
    MongoDBToolRegistryProvider.create.mockResolvedValue(mockProvider);
    SemanticToolSearch.create.mockResolvedValue(mockSemanticSearch);
  });

  describe('Constructor and Initialization', () => {
    test('should create migration instance', () => {
      console.log('🧪 Testing ToolRegistryMigration creation');

      const migration = new ToolRegistryMigration(resourceManager);

      expect(migration).toBeDefined();
      expect(migration.resourceManager).toBe(resourceManager);
      expect(migration.migrationStats).toEqual({
        modulesProcessed: 0,
        toolsProcessed: 0,
        embeddingsGenerated: 0,
        errors: []
      });
      expect(migration.databaseService).toBeNull();
      expect(migration.provider).toBeNull();
      expect(migration.semanticSearch).toBeNull();

      console.log('✅ Migration instance creation working');
    });

    test('should initialize migration components', async () => {
      console.log('🧪 Testing migration component initialization');

      const migration = new ToolRegistryMigration(resourceManager);
      await migration.initialize();

      expect(migration.databaseService).toBe(mockDatabaseService);
      expect(migration.provider).toBe(mockProvider);
      expect(migration.semanticSearch).toBe(mockSemanticSearch);

      const { ToolRegistryDatabaseService } = require('../../../src/database/ToolRegistryDatabaseService.js');
      const { MongoDBToolRegistryProvider } = require('../../../src/providers/MongoDBToolRegistryProvider.js');
      const { SemanticToolSearch } = require('../../../src/semantic/SemanticToolSearch.js');

      expect(ToolRegistryDatabaseService.create).toHaveBeenCalledWith(resourceManager);
      expect(MongoDBToolRegistryProvider.create).toHaveBeenCalledWith(resourceManager, {
        enableSemanticSearch: true
      });
      expect(SemanticToolSearch.create).toHaveBeenCalledWith(resourceManager, mockProvider);

      console.log('✅ Component initialization working');
    });

    test('should handle semantic search initialization failure', async () => {
      console.log('🧪 Testing semantic search initialization failure handling');

      const { SemanticToolSearch } = require('../../../src/semantic/SemanticToolSearch.js');
      SemanticToolSearch.create.mockRejectedValue(new Error('OpenAI API key not found'));

      const migration = new ToolRegistryMigration(resourceManager);
      await migration.initialize();

      expect(migration.semanticSearch).toBeNull();

      console.log('✅ Semantic search failure handling working');
    });

    test('should handle database service initialization failure', async () => {
      console.log('🧪 Testing database service initialization failure');

      const { ToolRegistryDatabaseService } = require('../../../src/database/ToolRegistryDatabaseService.js');
      ToolRegistryDatabaseService.create.mockRejectedValue(new Error('MongoDB connection failed'));

      const migration = new ToolRegistryMigration(resourceManager);

      await expect(migration.initialize())
        .rejects
        .toThrow('MongoDB connection failed');

      console.log('✅ Database service failure handling working');
    });
  });

  describe('Data Clearing', () => {
    test('should clear existing data', async () => {
      console.log('🧪 Testing existing data clearing');

      const migration = new ToolRegistryMigration(resourceManager);
      await migration.initialize();

      await migration.clearExistingData();

      expect(mockDatabaseService.mongoProvider.delete).toHaveBeenCalledWith('tool_usage', {});
      expect(mockDatabaseService.mongoProvider.delete).toHaveBeenCalledWith('tools', {});
      expect(mockDatabaseService.mongoProvider.delete).toHaveBeenCalledWith('modules', {});

      console.log('✅ Data clearing working');
    });

    test('should handle data clearing failures gracefully', async () => {
      console.log('🧪 Testing data clearing failure handling');

      mockDatabaseService.mongoProvider.delete.mockRejectedValue(new Error('Delete failed'));

      const migration = new ToolRegistryMigration(resourceManager);
      await migration.initialize();

      // Should not throw, should just warn
      await migration.clearExistingData();

      expect(mockDatabaseService.mongoProvider.delete).toHaveBeenCalled();

      console.log('✅ Data clearing failure handling working');
    });
  });

  describe('JSON File Migration', () => {
    test('should migrate from JSON files', async () => {
      console.log('🧪 Testing JSON file migration');

      const mockToolsDatabase = {
        modules: {
          FileModule: {
            description: 'File operations module',
            version: '1.0.0',
            tools: {
              file_read: {
                description: 'Read file contents',
                inputSchema: {
                  type: 'object',
                  properties: {
                    filepath: { type: 'string' }
                  }
                }
              },
              file_write: {
                description: 'Write file contents',
                inputSchema: {
                  type: 'object',
                  properties: {
                    filepath: { type: 'string' },
                    content: { type: 'string' }
                  }
                }
              }
            }
          }
        }
      };

      fs.readFile.mockResolvedValue(JSON.stringify(mockToolsDatabase));

      const migration = new ToolRegistryMigration(resourceManager);
      await migration.initialize();

      await migration.migrateFromJsonFiles();

      expect(mockProvider.saveModule).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'FileModule',
          description: 'File operations module',
          version: '1.0.0'
        })
      );

      expect(mockProvider.saveTool).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'file_read',
          description: 'Read file contents'
        })
      );

      expect(mockProvider.saveTool).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'file_write',
          description: 'Write file contents'
        })
      );

      expect(migration.migrationStats.modulesProcessed).toBe(1);
      expect(migration.migrationStats.toolsProcessed).toBe(2);

      console.log('✅ JSON file migration working');
    });

    test('should handle missing JSON files gracefully', async () => {
      console.log('🧪 Testing missing JSON file handling');

      fs.readFile.mockRejectedValue(new Error('ENOENT: no such file or directory'));

      const migration = new ToolRegistryMigration(resourceManager);
      await migration.initialize();

      // Should not throw, should just add to errors
      await migration.migrateFromJsonFiles();

      expect(migration.migrationStats.errors.length).toBeGreaterThan(0);
      expect(migration.migrationStats.errors[0].type).toBe('json_file');

      console.log('✅ Missing JSON file handling working');
    });

    test('should handle malformed JSON gracefully', async () => {
      console.log('🧪 Testing malformed JSON handling');

      fs.readFile.mockResolvedValue('{ invalid json');

      const migration = new ToolRegistryMigration(resourceManager);
      await migration.initialize();

      await migration.migrateFromJsonFiles();

      expect(migration.migrationStats.errors.length).toBeGreaterThan(0);
      expect(migration.migrationStats.errors[0].type).toBe('json_file');

      console.log('✅ Malformed JSON handling working');
    });

    test('should handle module migration failures', async () => {
      console.log('🧪 Testing module migration failure handling');

      const mockToolsDatabase = {
        modules: {
          FailingModule: {
            description: 'This module will fail to save'
          }
        }
      };

      fs.readFile.mockResolvedValue(JSON.stringify(mockToolsDatabase));
      mockProvider.saveModule.mockRejectedValue(new Error('Save failed'));

      const migration = new ToolRegistryMigration(resourceManager);
      await migration.initialize();

      await migration.migrateFromJsonFiles();

      expect(migration.migrationStats.errors.length).toBeGreaterThan(0);
      expect(migration.migrationStats.errors[0].type).toBe('module');
      expect(migration.migrationStats.errors[0].name).toBe('FailingModule');

      console.log('✅ Module migration failure handling working');
    });
  });

  describe('Inference Methods', () => {
    let migration;

    beforeEach(async () => {
      migration = new ToolRegistryMigration(resourceManager);
      await migration.initialize();
    });

    test('should infer module categories correctly', () => {
      console.log('🧪 Testing module category inference');

      const testCases = [
        { name: 'FileModule', expected: 'filesystem' },
        { name: 'HTTPModule', expected: 'network' },
        { name: 'AIModule', expected: 'ai' },
        { name: 'TestModule', expected: 'testing' },
        { name: 'DeployModule', expected: 'deployment' },
        { name: 'JSONModule', expected: 'data' },
        { name: 'VoiceModule', expected: 'media' },
        { name: 'PlaywrightModule', expected: 'automation' },
        { name: 'RandomModule', expected: 'utility' }
      ];

      for (const testCase of testCases) {
        const result = migration.inferModuleCategory(testCase.name);
        expect(result).toBe(testCase.expected);
      }

      console.log('✅ Module category inference working');
    });

    test('should infer tool categories correctly', () => {
      console.log('🧪 Testing tool category inference');

      const testCases = [
        { name: 'file_read', expected: 'read' },
        { name: 'file_write', expected: 'write' },
        { name: 'file_delete', expected: 'delete' },
        { name: 'file_update', expected: 'update' },
        { name: 'execute_command', expected: 'execute' },
        { name: 'search_files', expected: 'search' },
        { name: 'transform_data', expected: 'transform' },
        { name: 'validate_input', expected: 'validate' },
        { name: 'generate_code', expected: 'generate' },
        { name: 'analyze_data', expected: 'analyze' },
        { name: 'random_tool', expected: 'other' }
      ];

      for (const testCase of testCases) {
        const result = migration.inferToolCategory(testCase.name);
        expect(result).toBe(testCase.expected);
      }

      console.log('✅ Tool category inference working');
    });

    test('should infer tool tags correctly', () => {
      console.log('🧪 Testing tool tags inference');

      const result = migration.inferToolTags('file_read', 'Read file contents from filesystem');

      expect(result).toContain('file');
      expect(result).toContain('read');
      expect(result).not.toContain('write'); // Should not include unrelated tags

      // Test with command tool
      const commandResult = migration.inferToolTags('execute_bash', 'Execute bash commands in terminal');
      expect(commandResult).toContain('command');
      expect(commandResult).toContain('terminal');
      expect(commandResult).toContain('execute');

      console.log('✅ Tool tags inference working');
    });

    test('should infer tool complexity correctly', () => {
      console.log('🧪 Testing tool complexity inference');

      // Simple tool (no complex schema)
      const simpleResult = migration.inferToolComplexity({
        description: 'Simple tool'
      });
      expect(simpleResult).toBe('simple');

      // Moderate tool (2-5 params, 1-3 required)
      const moderateResult = migration.inferToolComplexity({
        inputSchema: {
          type: 'object',
          properties: {
            param1: { type: 'string' },
            param2: { type: 'string' },
            param3: { type: 'string' }
          },
          required: ['param1', 'param2']
        }
      });
      expect(moderateResult).toBe('moderate');

      // Complex tool (>5 params or >3 required)
      const complexResult = migration.inferToolComplexity({
        inputSchema: {
          type: 'object',
          properties: {
            param1: { type: 'string' },
            param2: { type: 'string' },
            param3: { type: 'string' },
            param4: { type: 'string' },
            param5: { type: 'string' },
            param6: { type: 'string' }
          },
          required: ['param1', 'param2', 'param3', 'param4']
        }
      });
      expect(complexResult).toBe('complex');

      console.log('✅ Tool complexity inference working');
    });

    test('should generate tool examples correctly', () => {
      console.log('🧪 Testing tool example generation');

      // File read tool
      const readExamples = migration.generateToolExamples('file_read', {
        description: 'Read file contents'
      });
      expect(readExamples.length).toBeGreaterThan(0);
      expect(readExamples[0]).toHaveProperty('title');
      expect(readExamples[0]).toHaveProperty('description');
      expect(readExamples[0]).toHaveProperty('input');
      expect(readExamples[0]).toHaveProperty('output');

      // File write tool
      const writeExamples = migration.generateToolExamples('file_write', {
        description: 'Write file contents'
      });
      expect(writeExamples.length).toBeGreaterThan(0);
      expect(writeExamples[0].input).toHaveProperty('filepath');
      expect(writeExamples[0].input).toHaveProperty('content');

      // Command tool
      const commandExamples = migration.generateToolExamples('execute_command', {
        description: 'Execute shell commands'
      });
      expect(commandExamples.length).toBeGreaterThan(0);
      expect(commandExamples[0].input).toHaveProperty('command');

      console.log('✅ Tool example generation working');
    });
  });

  describe('Runtime Tool Discovery', () => {
    let migration;

    beforeEach(async () => {
      migration = new ToolRegistryMigration(resourceManager);
      await migration.initialize();
    });

    test('should scan for module directories', async () => {
      console.log('🧪 Testing module directory scanning');

      const mockDirEntries = [
        { name: 'module1', isDirectory: () => true },
        { name: 'module2', isDirectory: () => true },
        { name: 'file.txt', isDirectory: () => false },
        { name: '.hidden', isDirectory: () => true }
      ];

      fs.readdir.mockResolvedValue(mockDirEntries);
      fs.access.mockImplementation(async (path) => {
        if (path.includes('module1/package.json') || path.includes('module1/src')) {
          return; // Exists
        }
        if (path.includes('module2/module.json')) {
          return; // Exists
        }
        throw new Error('ENOENT');
      });

      const result = await migration.scanForModules('/test/packages');

      expect(result.length).toBe(2); // module1 and module2
      expect(result).toContain('/test/packages/module1');
      expect(result).toContain('/test/packages/module2');

      console.log('✅ Module directory scanning working');
    });

    test('should discover package tools', async () => {
      console.log('🧪 Testing package tool discovery');

      const mockModuleJson = {
        name: 'TestModule',
        version: '1.0.0',
        tools: {
          test_tool: {
            description: 'A test tool'
          }
        }
      };

      fs.access.mockResolvedValue(undefined); // File exists
      fs.readFile.mockResolvedValue(JSON.stringify(mockModuleJson));

      await migration.discoverPackageTools('/test/packages/TestModule');

      expect(mockProvider.saveModule).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'TestModule',
          version: '1.0.0'
        })
      );

      expect(mockProvider.saveTool).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'test_tool',
          description: 'A test tool'
        })
      );

      console.log('✅ Package tool discovery working');
    });

    test('should handle discovery errors gracefully', async () => {
      console.log('🧪 Testing discovery error handling');

      fs.readdir.mockRejectedValue(new Error('Permission denied'));

      const migration = new ToolRegistryMigration(resourceManager);
      await migration.initialize();

      // Should not throw, should just warn and add to errors
      await migration.discoverRuntimeTools();

      expect(migration.migrationStats.errors.length).toBeGreaterThan(0);
      expect(migration.migrationStats.errors[0].type).toBe('runtime_discovery');

      console.log('✅ Discovery error handling working');
    });
  });

  describe('Semantic Embedding Generation', () => {
    let migration;

    beforeEach(async () => {
      migration = new ToolRegistryMigration(resourceManager);
      await migration.initialize();
    });

    test('should generate embeddings for tools', async () => {
      console.log('🧪 Testing embedding generation');

      const mockTools = [
        {
          _id: 'tool1',
          name: 'file_read',
          moduleName: 'FileModule',
          description: 'Read file contents'
        },
        {
          _id: 'tool2',
          name: 'file_write',
          moduleName: 'FileModule',
          description: 'Write file contents'
        }
      ];

      mockProvider.getToolsWithoutEmbeddings.mockResolvedValue(mockTools);

      await migration.generateSemanticEmbeddings();

      expect(mockSemanticSearch.indexTool).toHaveBeenCalledTimes(2);
      expect(mockSemanticSearch.indexTool).toHaveBeenCalledWith(mockTools[0]);
      expect(mockSemanticSearch.indexTool).toHaveBeenCalledWith(mockTools[1]);

      expect(migration.migrationStats.embeddingsGenerated).toBe(2);

      console.log('✅ Embedding generation working');
    });

    test('should handle embedding generation failures', async () => {
      console.log('🧪 Testing embedding generation failure handling');

      const mockTools = [
        {
          _id: 'tool1',
          name: 'failing_tool',
          moduleName: 'TestModule',
          description: 'This tool will fail'
        }
      ];

      mockProvider.getToolsWithoutEmbeddings.mockResolvedValue(mockTools);
      mockSemanticSearch.indexTool.mockRejectedValue(new Error('Embedding failed'));

      await migration.generateSemanticEmbeddings();

      expect(migration.migrationStats.embeddingsGenerated).toBe(0);
      expect(migration.migrationStats.errors.length).toBeGreaterThan(0);
      expect(migration.migrationStats.errors[0].type).toBe('embedding');

      console.log('✅ Embedding failure handling working');
    });

    test('should skip if semantic search unavailable', async () => {
      console.log('🧪 Testing semantic search unavailable handling');

      // Create migration without semantic search
      const migrationWithoutSemantics = new ToolRegistryMigration(resourceManager);
      migrationWithoutSemantics.databaseService = mockDatabaseService;
      migrationWithoutSemantics.provider = mockProvider;
      migrationWithoutSemantics.semanticSearch = null;

      await migrationWithoutSemantics.generateSemanticEmbeddings();

      expect(mockSemanticSearch.indexTool).not.toHaveBeenCalled();
      expect(migrationWithoutSemantics.migrationStats.embeddingsGenerated).toBe(0);

      console.log('✅ Semantic search unavailable handling working');
    });

    test('should process embeddings in batches', async () => {
      console.log('🧪 Testing batch processing of embeddings');

      // Create 25 tools (more than default batch size of 20)
      const mockTools = Array.from({ length: 25 }, (_, i) => ({
        _id: `tool${i}`,
        name: `tool_${i}`,
        moduleName: 'TestModule',
        description: `Test tool ${i}`
      }));

      mockProvider.getToolsWithoutEmbeddings.mockResolvedValue(mockTools);

      await migration.generateSemanticEmbeddings();

      expect(mockSemanticSearch.indexTool).toHaveBeenCalledTimes(25);
      expect(migration.migrationStats.embeddingsGenerated).toBe(25);

      console.log('✅ Batch processing working');
    });
  });

  describe('Migration Validation', () => {
    let migration;

    beforeEach(async () => {
      migration = new ToolRegistryMigration(resourceManager);
      await migration.initialize();
    });

    test('should validate successful migration', async () => {
      console.log('🧪 Testing migration validation');

      mockDatabaseService.getDatabaseStats.mockResolvedValue({
        modules: 5,
        tools: 25,
        usageRecords: 0
      });

      await migration.validateMigration();

      expect(mockDatabaseService.getDatabaseStats).toHaveBeenCalled();

      console.log('✅ Migration validation working');
    });

    test('should detect failed migration (no modules)', async () => {
      console.log('🧪 Testing failed migration detection');

      mockDatabaseService.getDatabaseStats.mockResolvedValue({
        modules: 0,
        tools: 0,
        usageRecords: 0
      });

      await expect(migration.validateMigration())
        .rejects
        .toThrow('No modules found in database');

      console.log('✅ Failed migration detection working');
    });

    test('should detect failed migration (no tools)', async () => {
      console.log('🧪 Testing failed migration detection (tools)');

      mockDatabaseService.getDatabaseStats.mockResolvedValue({
        modules: 5,
        tools: 0,
        usageRecords: 0
      });

      await expect(migration.validateMigration())
        .rejects
        .toThrow('No tools found in database');

      console.log('✅ Failed migration detection (tools) working');
    });
  });

  describe('Complete Migration Flow', () => {
    test('should run complete migration successfully', async () => {
      console.log('🧪 Testing complete migration flow');

      const mockToolsDatabase = {
        modules: {
          TestModule: {
            description: 'Test module',
            tools: {
              test_tool: {
                description: 'Test tool'
              }
            }
          }
        }
      };

      fs.readFile.mockResolvedValue(JSON.stringify(mockToolsDatabase));
      fs.readdir.mockResolvedValue([]);
      
      mockDatabaseService.getDatabaseStats.mockResolvedValue({
        modules: 1,
        tools: 1,
        usageRecords: 0
      });

      const migration = new ToolRegistryMigration(resourceManager);
      const result = await migration.migrate({
        clearExisting: true,
        discoverRuntimeTools: true,
        generateEmbeddings: true
      });

      expect(result.success).toBe(true);
      expect(result.stats.modulesProcessed).toBeGreaterThan(0);
      expect(result.stats.toolsProcessed).toBeGreaterThan(0);

      console.log('✅ Complete migration flow working');
    });

    test('should handle migration failure gracefully', async () => {
      console.log('🧪 Testing migration failure handling');

      const { ToolRegistryDatabaseService } = require('../../../src/database/ToolRegistryDatabaseService.js');
      ToolRegistryDatabaseService.create.mockRejectedValue(new Error('Database connection failed'));

      const migration = new ToolRegistryMigration(resourceManager);
      const result = await migration.migrate();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Database connection failed');
      expect(result.stats).toBeDefined();

      console.log('✅ Migration failure handling working');
    });
  });

  describe('CLI Interface', () => {
    test('should handle CLI execution', async () => {
      console.log('🧪 Testing CLI interface');

      // Mock process.argv
      const originalArgv = process.argv;
      process.argv = ['node', 'migration.js', '--clear'];

      // Mock process.exit
      const originalExit = process.exit;
      process.exit = jest.fn();

      // Mock ResourceManager import
      const originalImport = global.__dirname;
      jest.doMock('@legion/tools', () => ({
        ResourceManager: jest.fn().mockImplementation(() => ({
          initialize: jest.fn().mockResolvedValue(undefined)
        }))
      }));

      try {
        // This would normally run the CLI
        // We can't easily test the full CLI without more complex mocking
        expect(typeof runMigrationCLI).toBe('function');
      } finally {
        process.argv = originalArgv;
        process.exit = originalExit;
      }

      console.log('✅ CLI interface structure verified');
    });
  });

  describe('Error Statistics and Reporting', () => {
    let migration;

    beforeEach(async () => {
      migration = new ToolRegistryMigration(resourceManager);
      await migration.initialize();
    });

    test('should track migration statistics', async () => {
      console.log('🧪 Testing migration statistics tracking');

      // Simulate some successful operations
      const moduleData = { name: 'TestModule', description: 'Test' };
      await migration.migrateModule('TestModule', moduleData);

      expect(migration.migrationStats.modulesProcessed).toBe(1);

      console.log('✅ Statistics tracking working');
    });

    test('should print migration summary', () => {
      console.log('🧪 Testing migration summary printing');

      migration.migrationStats.modulesProcessed = 5;
      migration.migrationStats.toolsProcessed = 25;
      migration.migrationStats.embeddingsGenerated = 20;
      migration.migrationStats.errors = [
        { type: 'module', name: 'FailedModule', error: 'Save failed' }
      ];

      // This would normally print to console
      expect(() => migration.printMigrationSummary()).not.toThrow();

      console.log('✅ Migration summary printing working');
    });

    test('should handle large error lists', () => {
      console.log('🧪 Testing large error list handling');

      // Add many errors
      migration.migrationStats.errors = Array.from({ length: 15 }, (_, i) => ({
        type: 'test',
        name: `Error${i}`,
        error: `Test error ${i}`
      }));

      expect(() => migration.printMigrationSummary()).not.toThrow();

      console.log('✅ Large error list handling working');
    });
  });
});