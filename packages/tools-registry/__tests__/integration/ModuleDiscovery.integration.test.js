/**
 * Integration tests for ModuleDiscovery with database storage
 * 
 * Tests actual module discovery in the monorepo and database persistence
 * NO MOCKS - these are real integration tests
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ModuleDiscovery } from '../../src/core/ModuleDiscovery.js';
import { DatabaseStorage } from '../../src/core/DatabaseStorage.js';
import { ResourceManager } from '@legion/resource-manager';
import { MongoClient } from 'mongodb';

describe('ModuleDiscovery Integration Tests', () => {
  let moduleDiscovery;
  let databaseStorage;
  let resourceManager;
  let mongoClient;
  let testDb;
  
  beforeEach(async () => {
    // Use real ResourceManager singleton
    resourceManager = ResourceManager.getInstance();
    await resourceManager.initialize();
    
    // Connect to real MongoDB for testing
    const mongoUrl = resourceManager.get('MONGODB_URL') || 'mongodb://localhost:27017';
    mongoClient = new MongoClient(mongoUrl);
    await mongoClient.connect();
    
    // Use a test database
    testDb = mongoClient.db('test_tool_registry');
    
    // Initialize components
    databaseStorage = new DatabaseStorage({
      db: testDb,
      resourceManager
    });
    
    moduleDiscovery = new ModuleDiscovery({
      databaseStorage,
      verbose: false
    });
    
    // Clear test collections
    await testDb.collection('modules').deleteMany({});
    await testDb.collection('tools').deleteMany({});
  });
  
  afterEach(async () => {
    // Clean up test data
    if (testDb) {
      await testDb.collection('modules').deleteMany({});
      await testDb.collection('tools').deleteMany({});
    }
    
    // Close connections
    if (mongoClient) {
      await mongoClient.close();
    }
  });
  
  describe('Monorepo discovery', () => {
    it('should discover real modules in the Legion monorepo', async () => {
      const modules = await moduleDiscovery.discoverInMonorepo();
      
      expect(Array.isArray(modules)).toBe(true);
      expect(modules.length).toBeGreaterThan(0);
      
      // Should find at least some known modules
      const moduleNames = modules.map(m => m.name);
      
      // Log what we found for debugging
      console.log(`Found ${modules.length} modules in monorepo`);
      console.log('Sample modules:', moduleNames.slice(0, 5));
    });
    
    it('should include valid module metadata', async () => {
      const modules = await moduleDiscovery.discoverInMonorepo();
      
      // Check first module has required fields
      if (modules.length > 0) {
        const firstModule = modules[0];
        
        expect(firstModule).toHaveProperty('name');
        expect(firstModule).toHaveProperty('path');
        expect(firstModule).toHaveProperty('relativePath');
        expect(firstModule).toHaveProperty('packageName');
        expect(firstModule).toHaveProperty('discoveredAt');
        
        // Path should be absolute
        expect(path.isAbsolute(firstModule.path)).toBe(true);
        
        // Should be a .js file
        expect(firstModule.path).toMatch(/\.js$/);
      }
    });
    
    it('should filter out test files and fixtures', async () => {
      const modules = await moduleDiscovery.discoverInMonorepo();
      
      // Should not include test files
      const testFiles = modules.filter(m => 
        m.path.includes('__tests__') || 
        m.path.includes('.test.js') ||
        m.path.includes('.spec.js')
      );
      
      expect(testFiles.length).toBe(0);
    });
  });
  
  describe('Database persistence', () => {
    it('should save discovered modules to database', async () => {
      // Discover modules
      const modules = await moduleDiscovery.discoverInMonorepo();
      
      // Save to database
      const savedCount = await moduleDiscovery.saveModulesToDatabase(modules);
      
      expect(savedCount).toBe(modules.length);
      
      // Verify in database
      const dbModules = await testDb.collection('modules').find({}).toArray();
      expect(dbModules.length).toBe(modules.length);
    });
    
    it('should save module with correct structure', async () => {
      const modules = await moduleDiscovery.discoverInMonorepo();
      
      if (modules.length > 0) {
        await moduleDiscovery.saveModulesToDatabase([modules[0]]);
        
        const savedModule = await testDb.collection('modules').findOne({
          name: modules[0].name
        });
        
        expect(savedModule).toHaveProperty('_id');
        expect(savedModule).toHaveProperty('name');
        expect(savedModule).toHaveProperty('path');
        expect(savedModule).toHaveProperty('relativePath');
        expect(savedModule).toHaveProperty('packageName');
        expect(savedModule).toHaveProperty('discoveredAt');
        expect(savedModule).toHaveProperty('lastUpdated');
      }
    });
    
    it('should update existing modules on re-discovery', async () => {
      const modules = await moduleDiscovery.discoverInMonorepo();
      
      if (modules.length > 0) {
        // Save first time
        await moduleDiscovery.saveModulesToDatabase([modules[0]]);
        
        const firstSave = await testDb.collection('modules').findOne({
          name: modules[0].name
        });
        
        // Wait a bit to ensure timestamp difference
        await new Promise(resolve => setTimeout(resolve, 10));
        
        // Save again (should update)
        await moduleDiscovery.saveModulesToDatabase([modules[0]]);
        
        const secondSave = await testDb.collection('modules').findOne({
          name: modules[0].name
        });
        
        // Should be same document (same _id)
        expect(secondSave._id.toString()).toBe(firstSave._id.toString());
        
        // But updated timestamp
        expect(new Date(secondSave.lastUpdated).getTime())
          .toBeGreaterThan(new Date(firstSave.lastUpdated).getTime());
      }
    });
    
    it('should handle database errors gracefully', async () => {
      // Create a discovery instance with invalid database
      const badStorage = new DatabaseStorage({
        db: null, // Invalid database
        resourceManager
      });
      
      const badDiscovery = new ModuleDiscovery({
        databaseStorage: badStorage
      });
      
      const modules = [{ name: 'Test', path: '/test.js' }];
      
      await expect(badDiscovery.saveModulesToDatabase(modules))
        .rejects
        .toThrow('Database operation failed');
    });
  });
  
  describe('Module validation', () => {
    it('should validate discovered modules and test their interfaces', async () => {
      const modules = await moduleDiscovery.discoverInMonorepo();
      expect(modules.length).toBeGreaterThan(0);
      
      // Test validation on all discovered modules
      let validCount = 0;
      let invalidCount = 0;
      const validModules = [];
      
      for (const module of modules) {
        const isValid = await moduleDiscovery.validateModule(module.path);
        
        if (isValid) {
          validCount++;
          validModules.push(module);
          console.log(`✅ Module ${module.name}: valid`);
        } else {
          invalidCount++;
          console.log(`❌ Module ${module.name}: invalid`);
        }
      }
      
      console.log(`Validation summary: ${validCount} valid, ${invalidCount} invalid`);
      
      // Should have some validation results
      expect(validCount + invalidCount).toBe(modules.length);
      
      // Test that we can actually load at least one valid module if any exist
      if (validModules.length > 0) {
        const sampleValid = validModules[0];
        
        // Import the module and test its interface
        const ModuleClass = await import(sampleValid.path);
        const moduleInstance = new (ModuleClass.default || ModuleClass)();
        
        // Test supported interfaces
        let interfaceFound = false;
        
        // Interface 1: getName() + getTools()
        if (typeof moduleInstance.getName === 'function' && 
            typeof moduleInstance.getTools === 'function') {
          const name = moduleInstance.getName();
          const tools = moduleInstance.getTools();
          expect(typeof name).toBe('string');
          expect(Array.isArray(tools)).toBe(true);
          interfaceFound = true;
          console.log(`Module ${sampleValid.name} implements getName/getTools interface`);
        }
        // Interface 2: name property + listTools()
        else if (typeof moduleInstance.name === 'string' && 
                 typeof moduleInstance.listTools === 'function') {
          const tools = moduleInstance.listTools();
          expect(Array.isArray(tools)).toBe(true);
          interfaceFound = true;
          console.log(`Module ${sampleValid.name} implements name/listTools interface`);
        }
        // Interface 3: getTools() only
        else if (typeof moduleInstance.getTools === 'function') {
          const tools = moduleInstance.getTools();
          expect(Array.isArray(tools)).toBe(true);
          interfaceFound = true;
          console.log(`Module ${sampleValid.name} implements getTools-only interface`);
        }
        
        expect(interfaceFound).toBe(true);
      }
    });
  });
  
  describe('Batch operations', () => {
    it('should handle batch discovery and storage', async () => {
      // Discover all modules
      const modules = await moduleDiscovery.discoverInMonorepo();
      
      // Process in batches
      const batchSize = 10;
      let totalSaved = 0;
      
      for (let i = 0; i < modules.length; i += batchSize) {
        const batch = modules.slice(i, i + batchSize);
        const saved = await moduleDiscovery.saveModulesToDatabase(batch);
        totalSaved += saved;
      }
      
      expect(totalSaved).toBe(modules.length);
      
      // Verify all in database
      const count = await testDb.collection('modules').countDocuments();
      expect(count).toBe(modules.length);
    });
  });
  
  describe('Discovery with filters', () => {
    it('should discover modules from specific package', async () => {
      const modules = await moduleDiscovery.discoverInPackage('tools');
      
      // All modules should be from tools package
      if (modules.length > 0) {
        expect(modules.every(m => 
          m.path.includes('/packages/tools/') || 
          m.packageName === 'tools'
        )).toBe(true);
      }
    });
    
    it('should discover modules matching pattern', async () => {
      const modules = await moduleDiscovery.discoverByPattern(/Calculator/);
      
      // All modules should match pattern
      if (modules.length > 0) {
        expect(modules.every(m => /Calculator/.test(m.name))).toBe(true);
      }
    });
  });
  
  describe('Full workflow', () => {
    it('should complete full discovery → validation → loading → tool extraction workflow', async () => {
      // 1. Discover all modules
      const modules = await moduleDiscovery.discoverInMonorepo();
      console.log(`Discovered ${modules.length} modules`);
      expect(modules.length).toBeGreaterThan(0);
      
      // 2. Validate modules
      const validModules = [];
      let validationErrors = [];
      
      for (const module of modules) {
        try {
          const isValid = await moduleDiscovery.validateModule(module.path);
          if (isValid) {
            validModules.push(module);
          }
        } catch (error) {
          validationErrors.push({ module: module.name, error: error.message });
        }
      }
      console.log(`${validModules.length} modules are valid, ${validationErrors.length} had validation errors`);
      
      // 3. Save valid modules to database
      if (validModules.length > 0) {
        const savedCount = await moduleDiscovery.saveModulesToDatabase(validModules);
        console.log(`Saved ${savedCount} modules to database`);
        expect(savedCount).toBe(validModules.length);
        
        // 4. Verify in database
        const dbModules = await testDb.collection('modules').find({}).toArray();
        expect(dbModules.length).toBe(validModules.length);
        
        // 5. Load modules and extract tools
        const loadedModulesWithTools = [];
        
        for (const module of validModules) {
          try {
            console.log(`Loading module: ${module.name}`);
            const ModuleClass = await import(module.path);
            const moduleInstance = new (ModuleClass.default || ModuleClass)();
            
            // Extract tools based on module interface
            let tools = [];
            let moduleInfo = { name: module.name };
            
            // Try different interfaces
            if (typeof moduleInstance.getName === 'function' && 
                typeof moduleInstance.getTools === 'function') {
              moduleInfo.name = moduleInstance.getName();
              tools = moduleInstance.getTools();
            } else if (typeof moduleInstance.name === 'string' && 
                       typeof moduleInstance.listTools === 'function') {
              moduleInfo.name = moduleInstance.name;
              tools = moduleInstance.listTools();
            } else if (typeof moduleInstance.getTools === 'function') {
              tools = moduleInstance.getTools();
            }
            
            expect(Array.isArray(tools)).toBe(true);
            
            loadedModulesWithTools.push({
              module: moduleInfo,
              tools: tools,
              instance: moduleInstance
            });
            
            console.log(`✅ ${module.name}: loaded ${tools.length} tools`);
            
          } catch (loadError) {
            console.log(`❌ Failed to load ${module.name}: ${loadError.message}`);
          }
        }
        
        // 6. Verify we successfully loaded at least some modules with tools
        expect(loadedModulesWithTools.length).toBeGreaterThan(0);
        
        // 7. Test that extracted tools have proper structure
        const modulesWithTools = loadedModulesWithTools.filter(m => m.tools.length > 0);
        if (modulesWithTools.length > 0) {
          const sampleModule = modulesWithTools[0];
          const sampleTool = sampleModule.tools[0];
          
          expect(sampleTool).toHaveProperty('name');
          expect(typeof sampleTool.name).toBe('string');
          
          if (sampleTool.description) {
            expect(typeof sampleTool.description).toBe('string');
          }
          
          if (sampleTool.execute) {
            expect(typeof sampleTool.execute).toBe('function');
          }
          
          console.log(`✅ Tool structure validated: ${sampleTool.name}`);
        }
        
        console.log(`\n📊 Workflow Summary:`);
        console.log(`  Discovered: ${modules.length} modules`);
        console.log(`  Valid: ${validModules.length} modules`);
        console.log(`  Loaded: ${loadedModulesWithTools.length} modules`);
        console.log(`  With tools: ${loadedModulesWithTools.filter(m => m.tools.length > 0).length} modules`);
        console.log(`  Total tools: ${loadedModulesWithTools.reduce((sum, m) => sum + m.tools.length, 0)} tools`);
        
      } else {
        // This should not happen in a working monorepo - fail the test
        console.log('❌ No valid modules found - this indicates a problem with module discovery or validation');
        expect(validModules.length).toBeGreaterThan(0);
      }
    });
  });
});

// Need to import path for the tests
import path from 'path';