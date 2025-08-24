/**
 * Unit Tests for ToolRegistry Metadata Verification Methods
 * 
 * Tests the comprehensive metadata verification functionality in ToolRegistry
 * including module-tool alignment and complete metadata preservation
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { ToolRegistry } from '../../src/index.js';

describe('ToolRegistry Metadata Verification', () => {
  let toolRegistry;
  let mockResourceManager;
  let mockDatabaseStorage;
  let mockModuleLoader;
  let mockCollections;

  beforeEach(async () => {
    // Reset singleton before each test
    ToolRegistry.reset();
    
    // Create mock collections
    mockCollections = {
      'module-registry': {
        findOne: jest.fn(),
        find: jest.fn().mockReturnValue({
          toArray: jest.fn().mockResolvedValue([])
        })
      },
      modules: {
        findOne: jest.fn(),
        find: jest.fn().mockReturnValue({
          toArray: jest.fn().mockResolvedValue([])
        })
      },
      tools: {
        findOne: jest.fn(),
        find: jest.fn().mockReturnValue({
          toArray: jest.fn().mockResolvedValue([])
        })
      }
    };

    // Create mock database storage
    mockDatabaseStorage = {
      getCollection: jest.fn((name) => mockCollections[name]),
      initialize: jest.fn().mockResolvedValue(true),
      isConnected: true
    };

    // Create mock module loader
    mockModuleLoader = {
      loadModule: jest.fn(),
      getTools: jest.fn(),
      getModuleMetadata: jest.fn()
    };

    // Create mock resource manager
    mockResourceManager = {
      get: jest.fn().mockReturnValue('mock-value')
    };

    // Get ToolRegistry singleton
    toolRegistry = await ToolRegistry.getInstance();

    // Inject mocks (for testing purposes only)
    toolRegistry.databaseStorage = mockDatabaseStorage;
    toolRegistry.moduleLoader = mockModuleLoader;
    toolRegistry.initialized = true;
  });

  afterEach(() => {
    jest.clearAllMocks();
    // Reset singleton after each test
    ToolRegistry.reset();
  });

  describe('verifyModuleMetadata', () => {
    it('should successfully verify a complete module with aligned tools', async () => {
      const moduleName = 'TestModule';
      
      // Mock registry document
      mockCollections['module-registry'].findOne.mockResolvedValue({
        name: moduleName,
        status: 'discovered',
        path: '/test/TestModule.js',
        packageName: 'test-package',
        lastUpdated: '2025-01-01T00:00:00Z',
        discoveredAt: '2025-01-01T00:00:00Z'
      });

      // Mock modules document
      mockCollections.modules.findOne.mockResolvedValue({
        _id: moduleName,
        name: moduleName,
        status: 'loaded',
        loaded: true,
        loadedAt: '2025-01-01T00:00:00Z',
        savedAt: '2025-01-01T00:00:00Z',
        version: '1.0.0',
        description: 'Test module',
        author: 'Test Author',
        keywords: ['test', 'module'],
        dependencies: ['path', 'fs'],
        path: '/test/TestModule.js',
        packageName: 'test-package'
      });

      // Mock tools documents
      mockCollections.tools.find.mockReturnValue({
        toArray: jest.fn().mockResolvedValue([
          {
            _id: 'TestModule:testTool',
            name: 'testTool',
            description: 'A test tool',
            moduleName: moduleName,
            inputSchema: { type: 'object', properties: { input: { type: 'string' } } },
            outputSchema: { type: 'object', properties: { result: { type: 'string' } } },
            category: 'testing',
            tags: ['test', 'tool'],
            savedAt: '2025-01-01T00:00:00Z'
          }
        ])
      });

      // Mock module loading for alignment check
      const mockModuleInstance = {
        getName: () => moduleName,
        getVersion: () => '1.0.0'
      };
      
      mockModuleLoader.loadModule.mockResolvedValue(mockModuleInstance);
      mockModuleLoader.getTools.mockResolvedValue([
        {
          name: 'testTool',
          description: 'A test tool',
          inputSchema: { type: 'object', properties: { input: { type: 'string' } } },
          outputSchema: { type: 'object', properties: { result: { type: 'string' } } },
          category: 'testing',
          tags: ['test', 'tool'],
          execute: jest.fn()
        }
      ]);

      const result = await toolRegistry.verifyModuleMetadata(moduleName);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.moduleName).toBe(moduleName);
      
      // Verify collections data
      expect(result.collections.registry.exists).toBe(true);
      expect(result.collections.modules.exists).toBe(true);
      expect(result.collections.tools.count).toBe(1);
      
      // Verify module-tool alignment
      expect(result.moduleToolAlignment.aligned).toBe(true);
      expect(result.moduleToolAlignment.actualToolsCount).toBe(1);
      expect(result.moduleToolAlignment.databaseToolsCount).toBe(1);
      expect(result.moduleToolAlignment.missingInDatabase).toHaveLength(0);
      expect(result.moduleToolAlignment.extraInDatabase).toHaveLength(0);
      expect(result.moduleToolAlignment.metadataMismatches).toHaveLength(0);
      
      // Verify metadata completeness
      expect(result.metadata.hasVersion).toBe(true);
      expect(result.metadata.hasDescription).toBe(true);
      expect(result.metadata.hasAuthor).toBe(true);
      expect(result.metadata.metadataCompleteness.core).toBe(1); // 3/3 core fields
      expect(result.metadata.metadataCompleteness.extended).toBe(1); // 3/3 extended fields
    });

    it('should detect missing module in registry', async () => {
      const moduleName = 'MissingModule';
      
      // Mock no registry document
      mockCollections['module-registry'].findOne.mockResolvedValue(null);
      mockCollections.modules.findOne.mockResolvedValue(null);

      const result = await toolRegistry.verifyModuleMetadata(moduleName);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain(`Module '${moduleName}' not found in module-registry`);
      expect(result.errors).toContain(`Module '${moduleName}' not found in modules collection`);
      expect(result.collections.registry.exists).toBe(false);
      expect(result.collections.modules.exists).toBe(false);
    });

    it('should detect tool misalignment between module and database', async () => {
      const moduleName = 'MisalignedModule';
      
      // Mock registry and modules documents
      mockCollections['module-registry'].findOne.mockResolvedValue({
        name: moduleName,
        path: '/test/MisalignedModule.js',
        status: 'discovered'
      });

      mockCollections.modules.findOne.mockResolvedValue({
        _id: moduleName,
        name: moduleName,
        path: '/test/MisalignedModule.js',
        status: 'loaded',
        loaded: true
      });

      // Mock database has one tool
      mockCollections.tools.find.mockReturnValue({
        toArray: jest.fn().mockResolvedValue([
          {
            _id: 'MisalignedModule:dbTool',
            name: 'dbTool',
            description: 'Tool only in database',
            moduleName: moduleName
          }
        ])
      });

      // Mock module has different tool
      mockModuleLoader.loadModule.mockResolvedValue({});
      mockModuleLoader.getTools.mockResolvedValue([
        {
          name: 'moduleTool',
          description: 'Tool only in module',
          execute: jest.fn()
        }
      ]);

      const result = await toolRegistry.verifyModuleMetadata(moduleName);

      expect(result.valid).toBe(false);
      expect(result.moduleToolAlignment.aligned).toBe(false);
      expect(result.moduleToolAlignment.missingInDatabase).toContain('moduleTool');
      expect(result.moduleToolAlignment.extraInDatabase).toContain('dbTool');
      expect(result.errors).toContain(`Tool 'moduleTool' exists in module but missing from database`);
      expect(result.errors).toContain(`Tool 'dbTool' exists in database but missing from module`);
    });

    it('should detect metadata mismatches between module and database', async () => {
      const moduleName = 'MismatchedModule';
      
      // Mock documents
      mockCollections['module-registry'].findOne.mockResolvedValue({
        name: moduleName,
        path: '/test/MismatchedModule.js',
        status: 'discovered'
      });

      mockCollections.modules.findOne.mockResolvedValue({
        _id: moduleName,
        name: moduleName,
        path: '/test/MismatchedModule.js',
        status: 'loaded'
      });

      // Mock tool in database
      mockCollections.tools.find.mockReturnValue({
        toArray: jest.fn().mockResolvedValue([
          {
            _id: 'MismatchedModule:tool1',
            name: 'tool1',
            description: 'Old description',
            moduleName: moduleName,
            category: 'old-category'
          }
        ])
      });

      // Mock tool in module with different metadata
      mockModuleLoader.loadModule.mockResolvedValue({});
      mockModuleLoader.getTools.mockResolvedValue([
        {
          name: 'tool1',
          description: 'New description',
          category: 'new-category',
          execute: jest.fn()
        }
      ]);

      const result = await toolRegistry.verifyModuleMetadata(moduleName);

      expect(result.valid).toBe(false);
      expect(result.moduleToolAlignment.metadataMismatches).toHaveLength(1);
      expect(result.moduleToolAlignment.metadataMismatches[0].toolName).toBe('tool1');
      expect(result.moduleToolAlignment.metadataMismatches[0].mismatches).toHaveLength(2);
      expect(result.errors).toContain(`Tool 'tool1' has metadata mismatches between module and database`);
    });

    it('should warn about incomplete metadata', async () => {
      const moduleName = 'IncompleteModule';
      
      // Mock minimal documents
      mockCollections['module-registry'].findOne.mockResolvedValue({
        name: moduleName,
        path: '/test/IncompleteModule.js'
      });

      mockCollections.modules.findOne.mockResolvedValue({
        _id: moduleName,
        name: moduleName,
        status: 'loaded',
        // Missing: loadedAt, savedAt, version, description
      });

      mockCollections.tools.find.mockReturnValue({
        toArray: jest.fn().mockResolvedValue([])
      });

      const result = await toolRegistry.verifyModuleMetadata(moduleName);

      expect(result.valid).toBe(true); // No errors, just warnings
      expect(result.warnings).toContain('Module missing loadedAt timestamp');
      expect(result.warnings).toContain('Module missing savedAt timestamp');
      expect(result.warnings).toContain('Module missing optional metadata field: version');
      expect(result.warnings).toContain('Module missing optional metadata field: description');
    });
  });

  describe('verifyToolMetadata', () => {
    it('should successfully verify a complete tool with module alignment', async () => {
      const toolName = 'testTool';
      const moduleName = 'TestModule';

      // Mock tool document
      mockCollections.tools.findOne.mockResolvedValue({
        _id: `${moduleName}:${toolName}`,
        name: toolName,
        description: 'A test tool',
        moduleName: moduleName,
        inputSchema: { type: 'object', properties: { input: { type: 'string' } } },
        outputSchema: { type: 'object', properties: { result: { type: 'string' } } },
        category: 'testing',
        tags: ['test', 'tool'],
        examples: [{ name: 'example1', input: {}, output: {} }],
        savedAt: '2025-01-01T00:00:00Z'
      });

      // Mock referenced module
      mockCollections.modules.findOne.mockResolvedValue({
        _id: moduleName,
        name: moduleName,
        path: '/test/TestModule.js',
        status: 'loaded',
        loaded: true
      });

      // Mock module loading
      mockModuleLoader.loadModule.mockResolvedValue({});
      mockModuleLoader.getTools.mockResolvedValue([
        {
          name: toolName,
          description: 'A test tool',
          inputSchema: { type: 'object', properties: { input: { type: 'string' } } },
          outputSchema: { type: 'object', properties: { result: { type: 'string' } } },
          category: 'testing',
          tags: ['test', 'tool'],
          examples: [{ name: 'example1', input: {}, output: {} }],
          execute: jest.fn()
        }
      ]);

      const result = await toolRegistry.verifyToolMetadata(toolName);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.toolName).toBe(toolName);
      expect(result.moduleReference).toBe(moduleName);
      
      // Verify module alignment
      expect(result.moduleAlignment.moduleExists).toBe(true);
      expect(result.moduleAlignment.toolExistsInModule).toBe(true);
      expect(result.moduleAlignment.metadataMatches).toBe(true);
      expect(result.moduleAlignment.mismatches).toHaveLength(0);
      
      // Verify metadata completeness
      expect(result.metadata.hasDescription).toBe(true);
      expect(result.metadata.hasInputSchema).toBe(true);
      expect(result.metadata.hasOutputSchema).toBe(true);
      expect(result.metadata.hasCategory).toBe(true);
      expect(result.metadata.hasTags).toBe(true);
      expect(result.metadata.hasExamples).toBe(true);
      expect(result.metadata.completenessScore).toBe(100);
    });

    it('should detect tool not found', async () => {
      const toolName = 'nonexistentTool';

      mockCollections.tools.findOne.mockResolvedValue(null);

      const result = await toolRegistry.verifyToolMetadata(toolName);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain(`Tool '${toolName}' not found in tools collection`);
    });

    it('should detect invalid tool _id format', async () => {
      const toolName = 'badIdTool';
      const moduleName = 'TestModule';

      mockCollections.tools.findOne.mockResolvedValue({
        _id: 'wrong-id-format',
        name: toolName,
        moduleName: moduleName
      });

      mockCollections.modules.findOne.mockResolvedValue({
        _id: moduleName,
        name: moduleName
      });

      const result = await toolRegistry.verifyToolMetadata(toolName);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain(`Tool _id 'wrong-id-format' should be '${moduleName}:${toolName}'`);
    });

    it('should detect security risk of saved execute function', async () => {
      const toolName = 'insecureTool';

      mockCollections.tools.findOne.mockResolvedValue({
        _id: 'Module:insecureTool',
        name: toolName,
        moduleName: 'Module',
        execute: 'function() { return "dangerous"; }' // This should never be saved
      });

      const result = await toolRegistry.verifyToolMetadata(toolName);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Tool has execute function saved to database (security risk)');
    });

    it('should detect tool missing from referenced module', async () => {
      const toolName = 'orphanTool';
      const moduleName = 'TestModule';

      mockCollections.tools.findOne.mockResolvedValue({
        _id: `${moduleName}:${toolName}`,
        name: toolName,
        moduleName: moduleName
      });

      mockCollections.modules.findOne.mockResolvedValue({
        _id: moduleName,
        path: '/test/TestModule.js'
      });

      // Mock module doesn't have this tool
      mockModuleLoader.loadModule.mockResolvedValue({});
      mockModuleLoader.getTools.mockResolvedValue([]);

      const result = await toolRegistry.verifyToolMetadata(toolName);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain(`Tool '${toolName}' exists in database but missing from module '${moduleName}'`);
    });

    it('should calculate completeness score correctly', async () => {
      const toolName = 'partialTool';

      mockCollections.tools.findOne.mockResolvedValue({
        _id: 'Module:partialTool',
        name: toolName, // 10 points
        description: 'A tool', // 15 points
        moduleName: 'Module', // 15 points
        inputSchema: { type: 'object' }, // 20 points
        // Missing: outputSchema, category, tags, examples
      });

      const result = await toolRegistry.verifyToolMetadata(toolName);

      // 10 + 15 + 15 + 20 = 60 points
      expect(result.metadata.completenessScore).toBe(60);
    });

    it('should validate schema structures and warn about issues', async () => {
      const toolName = 'badSchemaTool';

      mockCollections.tools.findOne.mockResolvedValue({
        _id: 'Module:badSchemaTool',
        name: toolName,
        moduleName: 'Module',
        inputSchema: {
          // Missing type field
          properties: {
            field1: {}, // Missing type
            field2: { type: 'string' }
          }
        },
        outputSchema: {
          type: 'array'
          // Missing items for array type
        }
      });

      const result = await toolRegistry.verifyToolMetadata(toolName);

      expect(result.warnings).toContain('inputSchema missing type field');
      expect(result.warnings).toContain('inputSchema.properties.field1 missing type or $ref');
      expect(result.warnings).toContain('outputSchema with array type should have items definition');
    });
  });

  describe('verifySystemIntegrity', () => {
    it('should provide comprehensive system integrity report', async () => {
      // Mock system with 2 modules and 3 tools
      mockCollections['module-registry'].find.mockReturnValue({
        toArray: jest.fn().mockResolvedValue([
          { name: 'Module1', status: 'discovered' },
          { name: 'Module2', status: 'discovered' }
        ])
      });

      mockCollections.modules.find.mockReturnValue({
        toArray: jest.fn().mockResolvedValue([
          { name: 'Module1', status: 'loaded', loaded: true },
          { name: 'Module2', status: 'loaded', loaded: true }
        ])
      });

      mockCollections.tools.find.mockReturnValue({
        toArray: jest.fn().mockResolvedValue([
          { name: 'tool1', moduleName: 'Module1' },
          { name: 'tool2', moduleName: 'Module1' },
          { name: 'tool3', moduleName: 'Module2' }
        ])
      });

      const result = await toolRegistry.verifySystemIntegrity();

      expect(result.valid).toBe(true);
      expect(result.collections.registry.count).toBe(2);
      expect(result.collections.modules.count).toBe(2);
      expect(result.collections.tools.count).toBe(3);
      expect(result.summary.totalModulesInRegistry).toBe(2);
      expect(result.summary.totalLoadedModules).toBe(2);
      expect(result.summary.totalTools).toBe(3);
      expect(result.summary.averageToolsPerModule).toBe(1.5);
      expect(result.summary.integrityScore).toBeGreaterThan(90);
    });

    it('should detect orphaned tools', async () => {
      // Mock orphaned tool scenario
      mockCollections['module-registry'].find.mockReturnValue({
        toArray: jest.fn().mockResolvedValue([
          { name: 'Module1', status: 'discovered' }
        ])
      });

      mockCollections.modules.find.mockReturnValue({
        toArray: jest.fn().mockResolvedValue([
          { name: 'Module1', status: 'loaded' }
        ])
      });

      // Tool references non-existent module
      mockCollections.tools.find.mockReturnValue({
        toArray: jest.fn().mockResolvedValue([
          { name: 'orphanTool', moduleName: 'NonExistentModule' }
        ])
      });

      const result = await toolRegistry.verifySystemIntegrity();

      expect(result.valid).toBe(false);
      expect(result.referentialIntegrity.orphanedTools).toHaveLength(1);
      expect(result.referentialIntegrity.orphanedTools[0].toolName).toBe('orphanTool');
      expect(result.errors).toContain(`Orphaned tool 'orphanTool' references non-existent module 'NonExistentModule'`);
    });
  });

  describe('getMetadataReport', () => {
    it('should generate comprehensive system-wide report', async () => {
      // Mock modules for report
      mockCollections.modules.find.mockReturnValue({
        toArray: jest.fn().mockResolvedValue([
          { name: 'Module1' },
          { name: 'Module2' }
        ])
      });

      // Mock verification calls
      const mockVerification = {
        valid: true,
        errors: [],
        warnings: [],
        metadata: {}
      };

      jest.spyOn(toolRegistry, 'verifyModuleMetadata').mockResolvedValue(mockVerification);
      jest.spyOn(toolRegistry, 'verifySystemIntegrity').mockResolvedValue({
        valid: true,
        errors: [],
        warnings: []
      });

      const result = await toolRegistry.getMetadataReport();

      expect(result.scope).toBe('system-wide');
      expect(result.modules).toHaveLength(2);
      expect(result.systemIntegrity).toBeDefined();
      expect(result.timestamp).toBeDefined();
    });

    it('should generate focused report for specific module', async () => {
      const moduleName = 'TestModule';
      
      const mockVerification = {
        moduleName,
        valid: true,
        errors: [],
        warnings: [],
        metadata: {}
      };

      jest.spyOn(toolRegistry, 'verifyModuleMetadata').mockResolvedValue(mockVerification);
      jest.spyOn(toolRegistry, 'verifySystemIntegrity').mockResolvedValue({
        valid: true,
        errors: [],
        warnings: []
      });

      const result = await toolRegistry.getMetadataReport(moduleName);

      expect(result.scope).toBe(`module:${moduleName}`);
      expect(result.modules).toHaveLength(1);
      expect(result.modules[0].moduleName).toBe(moduleName);
      expect(result.systemIntegrity).toBeDefined();
    });
  });

  describe('_calculateIntegrityScore', () => {
    it('should calculate perfect score for clean system', () => {
      const integrity = {
        errors: [],
        warnings: [],
        collections: { modules: { count: 2 } },
        referentialIntegrity: { modulesWithoutTools: [] }
      };

      const score = toolRegistry._calculateIntegrityScore(integrity);
      expect(score).toBe(100); // 100 base + 10 bonus capped at 100 max
    });

    it('should deduct points for errors and warnings', () => {
      const integrity = {
        errors: ['Error 1', 'Error 2'],
        warnings: ['Warning 1'],
        collections: { modules: { count: 0 } },
        referentialIntegrity: { modulesWithoutTools: [] }
      };

      const score = toolRegistry._calculateIntegrityScore(integrity);
      expect(score).toBe(78); // 100 - 20 (errors) - 2 (warning) = 78
    });
  });
});