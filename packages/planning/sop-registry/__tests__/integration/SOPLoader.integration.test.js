import { ResourceManager } from '@legion/resource-manager';
import { SOPStorage } from '../../src/SOPStorage.js';
import { SOPLoader } from '../../src/SOPLoader.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const packageRoot = path.resolve(__dirname, '../..');

describe('SOPLoader Integration', () => {
  let resourceManager;
  let sopStorage;
  let sopLoader;
  
  beforeAll(async () => {
    resourceManager = await ResourceManager.getResourceManager();
    sopStorage = new SOPStorage({ resourceManager });
    await sopStorage.initialize();
  });
  
  beforeEach(async () => {
    await sopStorage.clearAll();
    await sopStorage.db.collection('sop_perspective_types').deleteMany({});
    await sopStorage._seedPerspectiveTypes();
    
    sopLoader = new SOPLoader({
      sopStorage,
      packageRoot
    });
  });
  
  afterAll(async () => {
    if (sopStorage && sopStorage.isConnected()) {
      await sopStorage.clearAll();
      await sopStorage.close();
    }
  });
  
  test('loads all SOPs from data/sops/ directory', async () => {
    const results = await sopLoader.loadAllFromDataDir();
    
    expect(results.loaded).toBeGreaterThanOrEqual(3);
    expect(results.failed).toBe(0);
    
    const sops = await sopStorage.findSOPs();
    expect(sops.length).toBe(results.loaded);
    
    const titles = sops.map(s => s.title);
    expect(titles).toContain('Book a train ticket');
    expect(titles).toContain('Read and process file');
    expect(titles).toContain('Call external API with authentication');
  });
  
  test('validates and saves with all fields', async () => {
    const results = await sopLoader.loadAllFromDataDir();
    
    const trainSOP = await sopStorage.findSOPByTitle('Book a train ticket');
    
    expect(trainSOP).toBeDefined();
    expect(trainSOP._id).toBeDefined();
    expect(trainSOP.title).toBe('Book a train ticket');
    expect(trainSOP.intent).toBeDefined();
    expect(trainSOP.description).toBeDefined();
    expect(trainSOP.prerequisites).toBeInstanceOf(Array);
    expect(trainSOP.inputs).toBeDefined();
    expect(trainSOP.outputs).toBeDefined();
    expect(trainSOP.steps).toBeInstanceOf(Array);
    expect(trainSOP.steps.length).toBe(5);
    expect(trainSOP.toolsMentioned).toContain('train-search-api');
    expect(trainSOP.toolsMentioned).toContain('payment-service');
    expect(trainSOP.tags).toContain('travel');
    expect(trainSOP.quality).toBeDefined();
    expect(trainSOP.quality.source).toBe('curated');
    expect(trainSOP.createdAt).toBeInstanceOf(Date);
    expect(trainSOP.updatedAt).toBeInstanceOf(Date);
  });
  
  test('assigns step indices correctly', async () => {
    await sopLoader.loadAllFromDataDir();
    
    const apiSOP = await sopStorage.findSOPByTitle('Call external API with authentication');
    
    expect(apiSOP.steps).toHaveLength(5);
    expect(apiSOP.steps[0].index).toBe(0);
    expect(apiSOP.steps[1].index).toBe(1);
    expect(apiSOP.steps[2].index).toBe(2);
    expect(apiSOP.steps[3].index).toBe(3);
    expect(apiSOP.steps[4].index).toBe(4);
  });
  
  test('extracts tools from steps', async () => {
    await sopLoader.loadAllFromDataDir();
    
    const fileSOP = await sopStorage.findSOPByTitle('Read and process file');
    
    expect(fileSOP.toolsMentioned).toBeDefined();
    expect(fileSOP.toolsMentioned).toContain('file-exists-check');
    expect(fileSOP.toolsMentioned).toContain('file-read');
  });
  
  test('reloading updates existing SOPs', async () => {
    await sopLoader.loadAllFromDataDir();
    
    const firstLoad = await sopStorage.findSOPByTitle('Book a train ticket');
    const firstLoadTime = firstLoad.updatedAt;
    
    await new Promise(resolve => setTimeout(resolve, 10));
    
    await sopLoader.loadAllFromDataDir();
    
    const secondLoad = await sopStorage.findSOPByTitle('Book a train ticket');
    
    expect(secondLoad._id).toEqual(firstLoad._id);
    expect(secondLoad.updatedAt.getTime()).toBeGreaterThan(firstLoadTime.getTime());
    
    const count = await sopStorage.countSOPs();
    expect(count).toBe(3);
  });
});