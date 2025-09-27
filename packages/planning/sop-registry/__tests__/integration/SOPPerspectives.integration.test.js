import { ResourceManager } from '@legion/resource-manager';
import { SOPStorage } from '../../src/SOPStorage.js';
import { SOPLoader } from '../../src/SOPLoader.js';
import { SOPPerspectives } from '../../src/SOPPerspectives.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const packageRoot = path.resolve(__dirname, '../..');

describe('SOPPerspectives Integration', () => {
  let resourceManager;
  let sopStorage;
  let sopLoader;
  let sopPerspectives;
  
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
  });
  
  beforeEach(async () => {
    await sopStorage.clearAll();
    await sopStorage.db.collection('sop_perspective_types').deleteMany({});
    await sopStorage._seedPerspectiveTypes();
  });
  
  afterAll(async () => {
    if (sopStorage && sopStorage.isConnected()) {
      await sopStorage.clearAll();
      await sopStorage.close();
    }
  });
  
  test('generates perspectives for multiple real SOPs', async () => {
    await sopLoader.loadAllFromDataDir();
    
    const sops = await sopStorage.findSOPs();
    expect(sops.length).toBeGreaterThanOrEqual(3);
    
    const results = await sopPerspectives.generateForAllSOPs();
    
    expect(results.generated).toBeGreaterThan(0);
    expect(results.failed).toBe(0);
    
    const allPerspectives = await sopStorage.findSOPPerspectives();
    expect(allPerspectives.length).toBe(results.generated);
  });
  
  test('verifies embedding dimensions for all perspectives', async () => {
    await sopLoader.loadAllFromDataDir();
    
    const sops = await sopStorage.findSOPs();
    const firstSOP = sops[0];
    
    await sopPerspectives.generateForSOP(firstSOP._id);
    
    const perspectives = await sopStorage.findPerspectivesBySOP(firstSOP._id);
    
    perspectives.forEach(p => {
      expect(p.embedding).toBeInstanceOf(Array);
      expect(p.embedding).toHaveLength(768);
      expect(p.embedding_model).toBe('nomic-embed-text-v1.5');
      expect(p.embedding_dimensions).toBe(768);
      expect(p.embedding.every(v => typeof v === 'number' && !isNaN(v))).toBe(true);
    });
  });
  
  test('verifies perspective counts match SOP structure', async () => {
    await sopLoader.loadAllFromDataDir();
    
    const trainSOP = await sopStorage.findSOPByTitle('Book a train ticket');
    
    await sopPerspectives.generateForSOP(trainSOP._id);
    
    const perspectives = await sopStorage.findPerspectivesBySOP(trainSOP._id);
    
    const expectedCount = 4 + trainSOP.steps.length;
    expect(perspectives).toHaveLength(expectedCount);
    
    const sopLevel = perspectives.filter(p => p.scope === 'sop');
    expect(sopLevel).toHaveLength(4);
    
    const stepLevel = perspectives.filter(p => p.scope === 'step');
    expect(stepLevel).toHaveLength(trainSOP.steps.length);
  });
  
  test('verifies batch_id linking within scope', async () => {
    await sopLoader.loadAllFromDataDir();
    
    const sops = await sopStorage.findSOPs();
    const firstSOP = sops[0];
    
    await sopPerspectives.generateForSOP(firstSOP._id);
    
    const perspectives = await sopStorage.findPerspectivesBySOP(firstSOP._id);
    
    const sopLevelPerspectives = perspectives.filter(p => p.scope === 'sop');
    const sopBatchIds = [...new Set(sopLevelPerspectives.map(p => p.batch_id))];
    expect(sopBatchIds).toHaveLength(1);
    
    const stepLevelPerspectives = perspectives.filter(p => p.scope === 'step');
    if (stepLevelPerspectives.length > 0) {
      const stepBatchIds = [...new Set(stepLevelPerspectives.map(p => p.batch_id))];
      expect(stepBatchIds).toHaveLength(1);
      
      expect(sopBatchIds[0]).not.toBe(stepBatchIds[0]);
    }
  });
  
  test('handles SOPs with different step counts', async () => {
    await sopLoader.loadAllFromDataDir();
    
    const sops = await sopStorage.findSOPs();
    
    for (const sop of sops) {
      await sopPerspectives.generateForSOP(sop._id);
      
      const perspectives = await sopStorage.findPerspectivesBySOP(sop._id);
      const expectedCount = 4 + sop.steps.length;
      
      expect(perspectives).toHaveLength(expectedCount);
    }
  });
});