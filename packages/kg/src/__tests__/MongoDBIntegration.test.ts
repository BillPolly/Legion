/**
 * MongoDB Integration Tests for the Minimal 2-Field Model
 * Tests the complete storage and service layer integration
 */

import { 
  Capability,
  MongoCapabilityStorage,
  CapabilityService,
  createDefaultConfig
} from '../index';

describe('MongoDB Integration - Minimal 2-Field Model', () => {
  let storage: MongoCapabilityStorage;
  let capabilityService: CapabilityService;

  beforeAll(async () => {
    // Use in-memory MongoDB for testing
    const config = createDefaultConfig();
    config.database = 'test_kg_minimal';
    
    storage = new MongoCapabilityStorage(config);
    capabilityService = new CapabilityService(storage);
    
    await storage.connect();
  });

  afterAll(async () => {
    await storage.disconnect();
  });

  beforeEach(async () => {
    // Clear the database before each test
    await storage.clear();
  });

  describe('Basic CRUD Operations', () => {
    it('should create and retrieve a capability', async () => {
      const capability = await capabilityService.createCapability({
        _id: 'install_kitchen_sink',
        subtypeOf: 'install_sink',
        attributes: {
          name: 'Install Kitchen Sink',
          description: 'Complete installation of kitchen sink',
          duration: '45 minutes',
          cost: 75.00
        }
      });

      expect(capability._id).toBe('install_kitchen_sink');
      expect(capability.subtypeOf).toBe('install_sink');
      expect(capability.name).toBe('Install Kitchen Sink');

      // Retrieve from storage
      const retrieved = await capabilityService.getCapability('install_kitchen_sink');
      expect(retrieved).not.toBeNull();
      expect(retrieved!._id).toBe('install_kitchen_sink');
      expect(retrieved!.subtypeOf).toBe('install_sink');
      expect(retrieved!.name).toBe('Install Kitchen Sink');
    });

    it('should update capability attributes', async () => {
      await capabilityService.createCapability({
        _id: 'test_capability',
        subtypeOf: 'action.task',
        attributes: {
          name: 'Original Name',
          cost: 100
        }
      });

      const updated = await capabilityService.updateCapability('test_capability', {
        attributes: {
          name: 'Updated Name',
          cost: 150,
          duration: '30 minutes'
        }
      });

      expect(updated).not.toBeNull();
      expect(updated!.name).toBe('Updated Name');
      expect(updated!.attributes.cost).toBe(150);
      expect(updated!.attributes.duration).toBe('30 minutes');
    });

    it('should delete capabilities', async () => {
      await capabilityService.createCapability({
        _id: 'to_delete',
        subtypeOf: 'all',
        attributes: { name: 'To Delete' }
      });

      const deleted = await capabilityService.deleteCapability('to_delete');
      expect(deleted).toBe(true);

      const retrieved = await capabilityService.getCapability('to_delete');
      expect(retrieved).toBeNull();
    });
  });

  describe('Relationship Management', () => {
    beforeEach(async () => {
      // Create test capabilities
      await capabilityService.createCapability({
        _id: 'install_sink',
        subtypeOf: 'action.task',
        attributes: { 
          name: 'Install Sink',
          difficulty: 'easy' 
        }
      });

      await capabilityService.createCapability({
        _id: 'pipe_fitting_skill',
        subtypeOf: 'skill',
        attributes: {
          name: 'Pipe Fitting Skill',
          description: 'Skill for fitting pipes'
        }
      });

      await capabilityService.createCapability({
        _id: 'wrench',
        subtypeOf: 'tool',
        attributes: {
          name: 'Pipe Wrench',
          description: 'Tool for gripping pipes'
        }
      });
    });

    it('should handle inheritance relationships', async () => {
      await capabilityService.createCapability({
        _id: 'install_kitchen_sink',
        subtypeOf: 'install_sink', // Inherits from install_sink
        attributes: { 
          name: 'Install Kitchen Sink',
          difficulty: 'intermediate'
        }
      });

      const child = await capabilityService.getCapability('install_kitchen_sink');
      expect(child!.subtypeOf).toBe('install_sink');

      // Find children of install_sink (subtypeOf is now a core field, not an attribute)
      const children = await capabilityService.findCapabilities({ subtypeOf: 'install_sink' });
      expect(children).toHaveLength(1);
      expect(children[0]._id).toBe('install_kitchen_sink');
    });

    it('should handle composition relationships', async () => {
      await capabilityService.createCapability({
        _id: 'bathroom_renovation',
        subtypeOf: 'action.package',
        attributes: { 
          name: 'Bathroom Renovation Package',
          totalCost: 2500.00,
          parts: ['install_sink', 'install_toilet']
        }
      });

      const packageCapability = await capabilityService.getCapability('bathroom_renovation');
      expect(packageCapability!.hasPart).toEqual(['install_sink', 'install_toilet']);
    });

    it('should handle use relationships', async () => {
      await capabilityService.createCapability({
        _id: 'pipe_fitting_use',
        subtypeOf: 'action.use',
        attributes: {
          name: 'Pipe Fitting for Sink Installation',
          duration: '15 minutes',
          cost: 25.00,
          uses: 'pipe_fitting_skill',
          partOf: 'install_sink'
        }
      });

      const use = await capabilityService.getCapability('pipe_fitting_use');
      expect(use!.uses).toBe('pipe_fitting_skill');
      expect(use!.partOf).toBe('install_sink');

      // Find what uses the skill
      const usedBy = await capabilityService.findByAttribute('uses', 'pipe_fitting_skill');
      expect(usedBy).toHaveLength(1);
      expect(usedBy[0]._id).toBe('pipe_fitting_use');
    });
  });

  describe('Search and Query Operations', () => {
    beforeEach(async () => {
      // Create test data
      const capabilities = [
        {
          _id: 'install_kitchen_sink',
          subtypeOf: 'install_sink',
          attributes: {
            name: 'Install Kitchen Sink',
            cost: 75.00,
            difficulty: 'intermediate'
          }
        },
        {
          _id: 'install_bathroom_sink',
          subtypeOf: 'install_sink',
          attributes: {
            name: 'Install Bathroom Sink',
            cost: 50.00,
            difficulty: 'easy'
          }
        },
        {
          _id: 'pipe_wrench',
          subtypeOf: 'tool',
          attributes: {
            name: 'Pipe Wrench',
            cost: 25.00,
            category: 'tool'
          }
        }
      ];

      for (const cap of capabilities) {
        await capabilityService.createCapability(cap);
      }
    });

    it('should find capabilities by attribute', async () => {
      const sinkTasks = await capabilityService.findCapabilities({ subtypeOf: 'install_sink' });
      expect(sinkTasks).toHaveLength(2);
      
      const expensiveTasks = await capabilityService.findByCostRange(60, 100);
      expect(expensiveTasks).toHaveLength(1);
      expect(expensiveTasks[0]._id).toBe('install_kitchen_sink');
    });

    it('should search by text', async () => {
      const sinkResults = await capabilityService.searchByText('sink');
      expect(sinkResults.length).toBeGreaterThan(0);
      
      const kitchenResults = await capabilityService.searchByText('kitchen');
      expect(kitchenResults).toHaveLength(1);
      expect(kitchenResults[0]._id).toBe('install_kitchen_sink');
    });

    it('should find by multiple attributes', async () => {
      const results = await capabilityService.findCapabilities({
        subtypeOf: 'install_sink',
        attributes: { difficulty: 'easy' }
      });
      
      expect(results).toHaveLength(1);
      expect(results[0]._id).toBe('install_bathroom_sink');
    });
  });

  describe('Storage Statistics', () => {
    beforeEach(async () => {
      // Create test capabilities
      const capabilities = [
        { _id: 'task1', subtypeOf: 'action.task', attributes: { name: 'Task 1' } },
        { _id: 'task2', subtypeOf: 'action.task', attributes: { name: 'Task 2' } },
        { _id: 'tool1', subtypeOf: 'resource.tool', attributes: { name: 'Tool 1' } }
      ];

      for (const cap of capabilities) {
        await capabilityService.createCapability(cap);
      }
    });

    it('should provide storage statistics', async () => {
      const stats = await capabilityService.getStorageStats();
      
      expect(stats.totalCapabilities).toBe(3);
      expect(stats.capabilitiesBySubtype['action.task']).toBe(2);
      expect(stats.capabilitiesBySubtype['resource.tool']).toBe(1);
      expect(stats.averageAttributeCount).toBeGreaterThan(0);
    });
  });

  describe('Complex Queries and Performance', () => {
    beforeEach(async () => {
      // Create a larger dataset for performance testing
      const capabilities = [];
      for (let i = 1; i <= 100; i++) {
        capabilities.push({
          _id: `capability_${i}`,
          subtypeOf: i % 3 === 0 ? 'action.task' : i % 3 === 1 ? 'resource.tool' : 'resource.consumable',
          attributes: {
            name: `Capability ${i}`,
            cost: Math.random() * 100,
            difficulty: i % 2 === 0 ? 'easy' : 'hard',
            category: i % 3 === 0 ? 'task' : 'resource'
          }
        });
      }

      await capabilityService.createCapabilities(capabilities);
    });

    it('should handle large datasets efficiently', async () => {
      const start = Date.now();
      
      // Test various query types
      const allCapabilities = await storage.findAll();
      const taskCapabilities = await capabilityService.findCapabilities({ subtypeOf: 'action.task' });
      const expensiveItems = await capabilityService.findByCostRange(50, 100);
      const easyItems = await capabilityService.findByAttribute('difficulty', 'easy');
      
      const end = Date.now();
      const duration = end - start;
      
      expect(allCapabilities).toHaveLength(100);
      expect(taskCapabilities.length).toBeGreaterThan(0);
      expect(expensiveItems.length).toBeGreaterThan(0);
      expect(easyItems.length).toBeGreaterThan(0);
      
      // Should complete within reasonable time (adjust as needed)
      expect(duration).toBeLessThan(5000); // 5 seconds
    });

    it('should handle complex search criteria', async () => {
      const results = await capabilityService.findCapabilities({
        attributes: { difficulty: 'easy' },
        minCost: 25,
        maxCost: 75,
        limit: 10,
        sortBy: 'cost',
        sortOrder: 'asc'
      });

      expect(results.length).toBeLessThanOrEqual(10);
      
      // Verify sorting
      for (let i = 1; i < results.length; i++) {
        expect(results[i].attributes.cost).toBeGreaterThanOrEqual(results[i-1].attributes.cost);
      }
    });
  });

  describe('Relationship Queries', () => {
    beforeEach(async () => {
      // Create a hierarchy of capabilities
      await capabilityService.createCapability({
        _id: 'plumbing_task',
        subtypeOf: 'action.task',
        attributes: { name: 'Plumbing Task' }
      });

      await capabilityService.createCapability({
        _id: 'install_sink',
        subtypeOf: 'plumbing_task',
        attributes: { name: 'Install Sink' }
      });

      await capabilityService.createCapability({
        _id: 'pipe_fitting_skill',
        subtypeOf: 'skill',
        attributes: { name: 'Pipe Fitting Skill' }
      });

      await capabilityService.createCapability({
        _id: 'use_pipe_fitting',
        subtypeOf: 'action.use',
        attributes: {
          name: 'Use Pipe Fitting',
          uses: 'pipe_fitting_skill',
          partOf: 'install_sink'
        }
      });

      await capabilityService.createCapability({
        _id: 'wrench',
        subtypeOf: 'resource.tool',
        attributes: {
          name: 'Wrench',
          requires: ['pipe_fitting_skill']
        }
      });
    });

    it('should get capability with all relationships', async () => {
      const result = await capabilityService.getCapabilityWithRelated('install_sink');
      
      expect(result.capability).not.toBeNull();
      expect(result.capability!._id).toBe('install_sink');
      
      // Should find parent
      expect(result.parent).not.toBeNull();
      expect(result.parent!._id).toBe('plumbing_task');
      
      // Should find children (none in this case)
      expect(result.children).toHaveLength(0);
      
      // Should find what uses this (use_pipe_fitting has partOf: install_sink)
      const partOfResults = await capabilityService.findByAttribute('partOf', 'install_sink');
      expect(partOfResults).toHaveLength(1);
      expect(partOfResults[0]._id).toBe('use_pipe_fitting');
    });
  });
});
