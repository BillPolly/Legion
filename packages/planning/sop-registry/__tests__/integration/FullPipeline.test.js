import SOPRegistry from '../../src/index.js';

describe('Full Pipeline Integration', () => {
  let sopRegistry;
  
  beforeAll(async () => {
    sopRegistry = await SOPRegistry.getInstance();
    await sopRegistry.sopStorage.clearAll();
    await sopRegistry.sopStorage.db.collection('sop_perspective_types').deleteMany({});
    await sopRegistry.sopStorage._seedPerspectiveTypes();
  });
  
  afterAll(async () => {
    if (sopRegistry) {
      await sopRegistry.cleanup();
    }
  });
  
  test('complete workflow: load → generate → search', async () => {
    const loadResult = await sopRegistry.loadAllSOPs();
    expect(loadResult.loaded).toBeGreaterThan(0);
    expect(loadResult.failed).toBe(0);
    
    const genResult = await sopRegistry.generateAllPerspectives();
    expect(genResult.generated).toBeGreaterThan(0);
    expect(genResult.failed).toBe(0);
    
    const searchResults = await sopRegistry.searchSOPs('book train');
    expect(searchResults.length).toBeGreaterThan(0);
    expect(searchResults[0].score).toBeGreaterThan(0);
    
    const stepResults = await sopRegistry.searchSteps('search API');
    expect(stepResults.length).toBeGreaterThan(0);
  });
  
  test('verifies auto-loaded SOPs from data/sops/', async () => {
    const sops = await sopRegistry.listSOPs();
    
    expect(sops.length).toBeGreaterThanOrEqual(3);
    
    const titles = sops.map(s => s.title);
    expect(titles).toContain('Book a train ticket');
    expect(titles).toContain('Read and process file');
    expect(titles).toContain('Call external API with authentication');
  });
  
  test('verifies embedding generation with real Nomic', async () => {
    const perspectives = await sopRegistry.sopStorage.findSOPPerspectives();
    
    expect(perspectives.length).toBeGreaterThan(0);
    
    perspectives.forEach(p => {
      expect(p.embedding).toBeInstanceOf(Array);
      expect(p.embedding).toHaveLength(768);
      expect(p.embedding_model).toBe('nomic-embed-text-v1.5');
    });
  });
  
  test('verifies result ranking and scoring', async () => {
    const results = await sopRegistry.searchSOPs('booking');
    
    expect(results.length).toBeGreaterThan(0);
    
    if (results.length > 1) {
      for (let i = 0; i < results.length - 1; i++) {
        expect(results[i].score).toBeGreaterThanOrEqual(results[i + 1].score);
      }
    }
  });
  
  test('verifies matched perspectives in results', async () => {
    const results = await sopRegistry.searchSOPs('travel');
    
    expect(results.length).toBeGreaterThan(0);
    
    const firstResult = results[0];
    expect(firstResult.matchedPerspectives).toBeInstanceOf(Array);
    expect(firstResult.matchedPerspectives.length).toBeGreaterThan(0);
    
    firstResult.matchedPerspectives.forEach(p => {
      expect(p.type).toBeDefined();
      expect(p.content).toBeDefined();
      expect(p.score).toBeGreaterThan(0);
    });
  });
  
  test('specialized search by intent', async () => {
    const results = await sopRegistry.searchSOPsByIntent('purchase tickets');
    
    expect(results).toBeInstanceOf(Array);
  });
  
  test('specialized search by tools', async () => {
    const results = await sopRegistry.searchSOPsByTools(['train-search-api']);
    
    expect(results.length).toBeGreaterThan(0);
    expect(results.every(r => r.toolsMentioned.includes('train-search-api'))).toBe(true);
  });
  
  test('specialized search by preconditions', async () => {
    const results = await sopRegistry.searchSOPsByPreconditions('payment method');
    
    expect(results).toBeInstanceOf(Array);
  });
  
  test('verifies statistics accuracy', async () => {
    const stats = await sopRegistry.getStatistics();
    
    expect(stats.sops.total).toBeGreaterThanOrEqual(3);
    expect(stats.perspectives.total).toBeGreaterThan(0);
    
    const sops = await sopRegistry.listSOPs();
    expect(stats.sops.total).toBe(sops.length);
  });
  
  test('health check returns healthy status', async () => {
    const health = await sopRegistry.healthCheck();
    
    expect(health.healthy).toBe(true);
    expect(health.database.connected).toBe(true);
    expect(health.perspectives.initialized).toBe(true);
    expect(health.search.initialized).toBe(true);
  });
});