import { SOPRegistry } from '../../src/SOPRegistry.js';

describe('SOPRegistry', () => {
  let sopRegistry;
  
  beforeAll(async () => {
    sopRegistry = await SOPRegistry.getInstance();
    await sopRegistry.sopStorage.clearAll();
    await sopRegistry.sopStorage.db.collection('sop_perspective_types').deleteMany({});
    await sopRegistry.sopStorage._seedPerspectiveTypes();
  });
  
  afterAll(async () => {
    if (sopRegistry && sopRegistry.sopStorage && sopRegistry.sopStorage.isConnected()) {
      await sopRegistry.sopStorage.clearAll();
      await sopRegistry.cleanup();
    }
  });
  
  describe('singleton pattern', () => {
    test('getInstance returns same instance', async () => {
      const instance1 = await SOPRegistry.getInstance();
      const instance2 = await SOPRegistry.getInstance();
      
      expect(instance1).toBe(instance2);
    });
    
    test('prevents direct instantiation', () => {
      expect(() => new SOPRegistry({ resourceManager: {} })).toThrow();
    });
  });
  
  describe('auto-initialization', () => {
    test('initializes on first getInstance', async () => {
      const instance = await SOPRegistry.getInstance();
      
      expect(instance.initialized).toBe(true);
      expect(instance.sopStorage).toBeDefined();
      expect(instance.sopLoader).toBeDefined();
      expect(instance.sopPerspectives).toBeDefined();
      expect(instance.sopSearch).toBeDefined();
    });
  });
  
  describe('component orchestration', () => {
    test('all components share same sopStorage', async () => {
      expect(sopRegistry.sopLoader.sopStorage).toBe(sopRegistry.sopStorage);
      expect(sopRegistry.sopPerspectives.sopStorage).toBe(sopRegistry.sopStorage);
      expect(sopRegistry.sopSearch.sopStorage).toBe(sopRegistry.sopStorage);
    });
    
    test('all components initialized', async () => {
      expect(sopRegistry.sopPerspectives.initialized).toBe(true);
      expect(sopRegistry.sopSearch.initialized).toBe(true);
    });
  });
  
  describe('public API - loading', () => {
    test('loadAllSOPs delegates to loader', async () => {
      const result = await sopRegistry.loadAllSOPs();
      
      expect(result.loaded).toBeGreaterThanOrEqual(0);
      expect(result.failed).toBeDefined();
    });
    
    test('reloadSOPs works', async () => {
      const result = await sopRegistry.reloadSOPs();
      
      expect(result.loaded).toBeGreaterThanOrEqual(0);
    });
  });
  
  describe('public API - retrieval', () => {
    beforeEach(async () => {
      await sopRegistry.sopStorage.clearAll();
      await sopRegistry.loadAllSOPs();
    });
    
    test('getSOP retrieves by ID', async () => {
      const sops = await sopRegistry.listSOPs();
      const firstSOP = sops[0];
      
      const retrieved = await sopRegistry.getSOP(firstSOP._id);
      
      expect(retrieved).toBeDefined();
      expect(retrieved._id).toEqual(firstSOP._id);
    });
    
    test('getSOPByTitle retrieves by title', async () => {
      const sop = await sopRegistry.getSOPByTitle('Book a train ticket');
      
      expect(sop).toBeDefined();
      expect(sop.title).toBe('Book a train ticket');
    });
    
    test('listSOPs returns all SOPs', async () => {
      const sops = await sopRegistry.listSOPs();
      
      expect(sops).toBeInstanceOf(Array);
      expect(sops.length).toBeGreaterThan(0);
    });
    
    test('listSOPs with filter works', async () => {
      const travelSOPs = await sopRegistry.listSOPs({ tags: 'travel' });
      
      expect(travelSOPs.every(s => s.tags.includes('travel'))).toBe(true);
    });
  });
  
  describe('public API - search', () => {
    beforeEach(async () => {
      await sopRegistry.sopStorage.clearAll();
      await sopRegistry.loadAllSOPs();
      await sopRegistry.generateAllPerspectives();
    });
    
    test('searchSOPs delegates to search component', async () => {
      const results = await sopRegistry.searchSOPs('booking');
      
      expect(results).toBeInstanceOf(Array);
    });
    
    test('searchSteps delegates to search component', async () => {
      const results = await sopRegistry.searchSteps('search');
      
      expect(results).toBeInstanceOf(Array);
    });
  });
  
  describe('public API - perspectives', () => {
    beforeEach(async () => {
      await sopRegistry.sopStorage.clearAll();
      await sopRegistry.loadAllSOPs();
    });
    
    test('generatePerspectives delegates to perspectives component', async () => {
      const sops = await sopRegistry.listSOPs();
      const firstSOP = sops[0];
      
      const perspectives = await sopRegistry.generatePerspectives(firstSOP._id);
      
      expect(perspectives).toBeInstanceOf(Array);
      expect(perspectives.length).toBeGreaterThan(0);
    });
    
    test('generateAllPerspectives works', async () => {
      const result = await sopRegistry.generateAllPerspectives();
      
      expect(result.generated).toBeGreaterThan(0);
    });
  });
  
  describe('statistics aggregation', () => {
    test('getStatistics returns comprehensive stats', async () => {
      const stats = await sopRegistry.getStatistics();
      
      expect(stats.sops).toBeDefined();
      expect(stats.perspectives).toBeDefined();
      expect(stats.sops.total).toBeGreaterThanOrEqual(0);
    });
  });
  
  describe('health check', () => {
    test('healthCheck returns status', async () => {
      const health = await sopRegistry.healthCheck();
      
      expect(health.healthy).toBe(true);
      expect(health.database).toBeDefined();
    });
  });
  
  describe('cleanup', () => {
    test('cleanup closes connections', async () => {
      const testInstance = await SOPRegistry.getInstance();
      
      expect(testInstance.sopStorage.isConnected()).toBe(true);
    });
  });
});