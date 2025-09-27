import { ResourceManager } from '@legion/resource-manager';
import { SOPStorage } from '../../src/SOPStorage.js';
import { SOPPerspectives } from '../../src/SOPPerspectives.js';
import { SOPSearch } from '../../src/SOPSearch.js';
import { SOPSearchError } from '../../src/errors/index.js';

describe('SOPSearch', () => {
  let resourceManager;
  let sopStorage;
  let sopPerspectives;
  let sopSearch;
  let testSOPs;
  
  beforeAll(async () => {
    resourceManager = await ResourceManager.getResourceManager();
    sopStorage = new SOPStorage({ resourceManager });
    await sopStorage.initialize();
    
    sopPerspectives = new SOPPerspectives({
      resourceManager,
      sopStorage
    });
    await sopPerspectives.initialize();
    
    sopSearch = new SOPSearch({
      resourceManager,
      sopStorage
    });
    await sopSearch.initialize();
  });
  
  beforeEach(async () => {
    await sopStorage.clearAll();
    await sopStorage.db.collection('sop_perspective_types').deleteMany({});
    await sopStorage._seedPerspectiveTypes();
    
    testSOPs = [
      await sopStorage.saveSOP({
        title: 'Book train ticket',
        intent: 'Purchase travel tickets',
        description: 'Book train for travel',
        steps: [
          { gloss: 'Search trains', index: 0 },
          { gloss: 'Select train', index: 1 }
        ],
        tags: ['travel', 'booking']
      }),
      await sopStorage.saveSOP({
        title: 'Read file contents',
        intent: 'Access file data',
        description: 'Read and process file',
        steps: [
          { gloss: 'Open file', index: 0 }
        ],
        tags: ['files', 'io']
      })
    ];
    
    for (const sop of testSOPs) {
      await sopPerspectives.generateForSOP(sop._id);
    }
  });
  
  afterAll(async () => {
    if (sopStorage && sopStorage.isConnected()) {
      await sopStorage.clearAll();
      await sopStorage.close();
    }
  });
  
  describe('initialization', () => {
    test('initializes with ResourceManager', () => {
      expect(sopSearch.resourceManager).toBe(resourceManager);
      expect(sopSearch.sopStorage).toBe(sopStorage);
      expect(sopSearch.initialized).toBe(true);
    });
    
    test('has Nomic service for embeddings', () => {
      expect(sopSearch.nomicService).toBeDefined();
    });
  });
  
  describe('query embedding', () => {
    test('generates embedding for query', async () => {
      const embedding = await sopSearch._getQueryEmbedding('test query');
      
      expect(embedding).toBeInstanceOf(Array);
      expect(embedding).toHaveLength(768);
      expect(embedding.every(v => typeof v === 'number')).toBe(true);
    });
    
    test('caches query embeddings', async () => {
      const query = 'cached query test';
      
      const first = await sopSearch._getQueryEmbedding(query);
      const second = await sopSearch._getQueryEmbedding(query);
      
      expect(first).toEqual(second);
      expect(sopSearch.queryCache.has(sopSearch._createCacheKey(query))).toBe(true);
    });
  });
  
  describe('semantic search', () => {
    test('searches via vector similarity', async () => {
      const results = await sopSearch.searchSemantic('book travel');
      
      expect(results).toBeInstanceOf(Array);
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].sop).toBeDefined();
      expect(results[0].score).toBeGreaterThan(0);
    });
    
    test('returns ranked results', async () => {
      const results = await sopSearch.searchSemantic('train booking');
      
      if (results.length > 1) {
        expect(results[0].score).toBeGreaterThanOrEqual(results[1].score);
      }
    });
    
    test('includes matched perspectives', async () => {
      const results = await sopSearch.searchSemantic('travel tickets');
      
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].matchedPerspectives).toBeInstanceOf(Array);
    });
  });
  
  describe('text search', () => {
    test('searches via MongoDB text index', async () => {
      const results = await sopSearch.searchText('train');
      
      expect(results).toBeInstanceOf(Array);
      expect(results.length).toBeGreaterThan(0);
    });
    
    test('matches on title and description', async () => {
      const results = await sopSearch.searchText('file');
      
      const fileSOP = results.find(r => r.title === 'Read file contents');
      expect(fileSOP).toBeDefined();
    });
  });
  
  describe('hybrid search', () => {
    test('combines semantic and text search', async () => {
      const results = await sopSearch.searchHybrid('booking train');
      
      expect(results).toBeInstanceOf(Array);
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].sop).toBeDefined();
      expect(results[0].score).toBeGreaterThan(0);
    });
    
    test('respects hybrid weight parameter', async () => {
      const semanticBias = await sopSearch.searchHybrid('train', { hybridWeight: 0.9 });
      const textBias = await sopSearch.searchHybrid('train', { hybridWeight: 0.1 });
      
      expect(semanticBias).toBeInstanceOf(Array);
      expect(textBias).toBeInstanceOf(Array);
    });
    
    test('respects topK parameter', async () => {
      const results = await sopSearch.searchHybrid('test', { topK: 1 });
      
      expect(results.length).toBeLessThanOrEqual(1);
    });
  });
  
  describe('step-level search', () => {
    test('searches individual steps', async () => {
      const results = await sopSearch.searchSteps('search trains');
      
      expect(results).toBeInstanceOf(Array);
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].sop).toBeDefined();
      expect(results[0].step).toBeDefined();
      expect(results[0].stepIndex).toBeGreaterThanOrEqual(0);
    });
    
    test('returns step-level matches', async () => {
      const results = await sopSearch.searchSteps('open file');
      
      const openFileStep = results.find(r => 
        r.step.gloss.toLowerCase().includes('open file')
      );
      
      expect(openFileStep).toBeDefined();
    });
  });
  
  describe('result ranking', () => {
    test('ranks results by score descending', async () => {
      const results = await sopSearch.searchHybrid('booking');
      
      if (results.length > 1) {
        for (let i = 0; i < results.length - 1; i++) {
          expect(results[i].score).toBeGreaterThanOrEqual(results[i + 1].score);
        }
      }
    });
  });
  
  describe('search statistics', () => {
    test('tracks query count', async () => {
      await sopSearch.searchSemantic('test1');
      await sopSearch.searchSemantic('test2');
      
      const stats = sopSearch.getSearchStats();
      expect(stats.totalQueries).toBeGreaterThanOrEqual(2);
    });
    
    test('tracks cache hit rate', async () => {
      const query = 'repeated query';
      
      await sopSearch._getQueryEmbedding(query);
      await sopSearch._getQueryEmbedding(query);
      
      const stats = sopSearch.getSearchStats();
      expect(stats.cacheHitRate).toBeGreaterThan(0);
    });
  });
  
  describe('error handling', () => {
    test('throws SOPSearchError on invalid query', async () => {
      await expect(sopSearch.searchSemantic('')).rejects.toThrow(SOPSearchError);
      await expect(sopSearch.searchSemantic(null)).rejects.toThrow(SOPSearchError);
    });
  });
});