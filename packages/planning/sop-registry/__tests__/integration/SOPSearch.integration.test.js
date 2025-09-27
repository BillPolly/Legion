import { ResourceManager } from '@legion/resource-manager';
import { SOPStorage } from '../../src/SOPStorage.js';
import { SOPLoader } from '../../src/SOPLoader.js';
import { SOPPerspectives } from '../../src/SOPPerspectives.js';
import { SOPSearch } from '../../src/SOPSearch.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const packageRoot = path.resolve(__dirname, '../..');

describe('SOPSearch Integration', () => {
  let resourceManager;
  let sopStorage;
  let sopLoader;
  let sopPerspectives;
  let sopSearch;
  
  beforeAll(async () => {
    resourceManager = await ResourceManager.getResourceManager();
    sopStorage = new SOPStorage({ resourceManager });
    await sopStorage.initialize();
    
    sopLoader = new SOPLoader({
      sopStorage,
      packageRoot
    });
    
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
    
    await sopStorage.clearAll();
    await sopStorage.db.collection('sop_perspective_types').deleteMany({});
    await sopStorage._seedPerspectiveTypes();
    
    await sopLoader.loadAllFromDataDir();
    await sopPerspectives.generateForAllSOPs();
  });
  
  afterAll(async () => {
    if (sopStorage && sopStorage.isConnected()) {
      await sopStorage.clearAll();
      await sopStorage.close();
    }
  });
  
  test('end-to-end search with real embeddings', async () => {
    const results = await sopSearch.searchHybrid('book train travel');
    
    expect(results).toBeInstanceOf(Array);
    expect(results.length).toBeGreaterThan(0);
    
    const trainSOP = results.find(r => r.sop.title === 'Book a train ticket');
    expect(trainSOP).toBeDefined();
    expect(trainSOP.score).toBeGreaterThan(0);
  });
  
  test('verifies result ranking by relevance', async () => {
    const results = await sopSearch.searchHybrid('booking');
    
    expect(results.length).toBeGreaterThan(0);
    
    if (results.length > 1) {
      for (let i = 0; i < results.length - 1; i++) {
        expect(results[i].score).toBeGreaterThanOrEqual(results[i + 1].score);
      }
    }
    
    const topResult = results[0];
    expect(topResult.sop.title).toContain('train');
  });
  
  test('verifies matched perspectives included', async () => {
    const results = await sopSearch.searchSemantic('travel tickets');
    
    expect(results.length).toBeGreaterThan(0);
    
    const result = results[0];
    expect(result.matchedPerspectives).toBeInstanceOf(Array);
    expect(result.matchedPerspectives.length).toBeGreaterThan(0);
    
    result.matchedPerspectives.forEach(p => {
      expect(p.type).toBeDefined();
      expect(p.content).toBeDefined();
      expect(p.score).toBeGreaterThan(0);
    });
  });
  
  test('step search returns correct SOPs and steps', async () => {
    const results = await sopSearch.searchSteps('search');
    
    expect(results.length).toBeGreaterThan(0);
    
    const result = results[0];
    expect(result.sop).toBeDefined();
    expect(result.step).toBeDefined();
    expect(result.stepIndex).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeGreaterThan(0);
    expect(result.perspective).toBeDefined();
  });
  
  test('semantic search finds relevant SOPs', async () => {
    const apiResults = await sopSearch.searchSemantic('authentication API');
    
    expect(apiResults.length).toBeGreaterThan(0);
    
    const apiSOP = apiResults.find(r => 
      r.sop.title.includes('API') || r.sop.toolsMentioned?.includes('auth-service')
    );
    
    expect(apiSOP).toBeDefined();
  });
  
  test('text search matches on tags', async () => {
    const results = await sopSearch.searchText('files');
    
    const fileSOP = results.find(r => r.tags?.includes('files'));
    expect(fileSOP).toBeDefined();
  });
  
  test('hybrid search combines both methods effectively', async () => {
    const semanticOnly = await sopSearch.searchSemantic('file operations');
    const textOnly = await sopSearch.searchText('file operations');
    const hybrid = await sopSearch.searchHybrid('file operations');
    
    expect(hybrid.length).toBeGreaterThan(0);
    
    const hybridSOPIds = new Set(hybrid.map(r => r.sop._id.toString()));
    const semanticSOPIds = new Set(semanticOnly.map(r => r.sop._id.toString()));
    const textSOPIds = new Set(textOnly.map(r => r.sop._id.toString()));
    
    const overlap = [...hybridSOPIds].filter(id => 
      semanticSOPIds.has(id) || textSOPIds.has(id)
    );
    
    expect(overlap.length).toBeGreaterThan(0);
  });
});