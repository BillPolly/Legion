import { ResourceManager } from '@legion/resource-manager';
import { SOPStorage } from '../../src/SOPStorage.js';
import { SOPLoader } from '../../src/SOPLoader.js';
import { SOPLoadError, SOPValidationError } from '../../src/errors/index.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const packageRoot = path.resolve(__dirname, '../..');

describe('SOPLoader', () => {
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
  
  describe('JSON parsing', () => {
    test('parses valid JSON file', async () => {
      const filePath = path.join(packageRoot, 'data/sops/train-booking.json');
      const sop = await sopLoader.loadFromFile(filePath);
      
      expect(sop.title).toBe('Book a train ticket');
      expect(sop.intent).toBeDefined();
      expect(sop.steps).toBeInstanceOf(Array);
    });
    
    test('throws SOPLoadError on invalid JSON', async () => {
      const invalidPath = path.join(packageRoot, '__tests__/fixtures/invalid.json');
      
      await expect(sopLoader.loadFromFile(invalidPath)).rejects.toThrow(SOPLoadError);
    });
    
    test('throws SOPLoadError on missing file', async () => {
      const missingPath = path.join(packageRoot, 'data/sops/nonexistent.json');
      
      await expect(sopLoader.loadFromFile(missingPath)).rejects.toThrow(SOPLoadError);
    });
  });
  
  describe('structure validation', () => {
    test('validates required fields', () => {
      const invalidSOP = {
        intent: 'Missing title'
      };
      
      expect(() => sopLoader.validateSOPStructure(invalidSOP)).toThrow(SOPValidationError);
    });
    
    test('validates steps array', () => {
      const invalidSOP = {
        title: 'Test',
        intent: 'Test',
        description: 'Test',
        steps: []
      };
      
      expect(() => sopLoader.validateSOPStructure(invalidSOP)).toThrow(SOPValidationError);
    });
    
    test('validates step gloss', () => {
      const invalidSOP = {
        title: 'Test',
        intent: 'Test',
        description: 'Test',
        steps: [{ index: 0 }]
      };
      
      expect(() => sopLoader.validateSOPStructure(invalidSOP)).toThrow(SOPValidationError);
    });
    
    test('validates valid SOP', () => {
      const validSOP = {
        title: 'Valid SOP',
        intent: 'Test intent',
        description: 'Test description',
        steps: [
          { gloss: 'Step 1' },
          { gloss: 'Step 2' }
        ]
      };
      
      expect(() => sopLoader.validateSOPStructure(validSOP)).not.toThrow();
    });
  });
  
  describe('step index assignment', () => {
    test('assigns indices to steps', () => {
      const steps = [
        { gloss: 'Step 1' },
        { gloss: 'Step 2' },
        { gloss: 'Step 3' }
      ];
      
      sopLoader.assignStepIndices(steps);
      
      expect(steps[0].index).toBe(0);
      expect(steps[1].index).toBe(1);
      expect(steps[2].index).toBe(2);
    });
    
    test('preserves existing step data', () => {
      const steps = [
        { gloss: 'Step 1', suggestedTools: ['tool1'], doneWhen: 'Done' }
      ];
      
      sopLoader.assignStepIndices(steps);
      
      expect(steps[0].index).toBe(0);
      expect(steps[0].suggestedTools).toEqual(['tool1']);
      expect(steps[0].doneWhen).toBe('Done');
    });
  });
  
  describe('tool extraction', () => {
    test('extracts tools from steps', () => {
      const sop = {
        steps: [
          { gloss: 'Step 1', suggestedTools: ['tool1', 'tool2'] },
          { gloss: 'Step 2', suggestedTools: ['tool3'] },
          { gloss: 'Step 3' }
        ]
      };
      
      const tools = sopLoader.extractToolsMentioned(sop);
      
      expect(tools).toEqual(['tool1', 'tool2', 'tool3']);
    });
    
    test('removes duplicate tools', () => {
      const sop = {
        steps: [
          { gloss: 'Step 1', suggestedTools: ['tool1', 'tool2'] },
          { gloss: 'Step 2', suggestedTools: ['tool1', 'tool3'] }
        ]
      };
      
      const tools = sopLoader.extractToolsMentioned(sop);
      
      expect(tools).toEqual(['tool1', 'tool2', 'tool3']);
    });
    
    test('returns empty array if no tools', () => {
      const sop = {
        steps: [
          { gloss: 'Step 1' },
          { gloss: 'Step 2' }
        ]
      };
      
      const tools = sopLoader.extractToolsMentioned(sop);
      
      expect(tools).toEqual([]);
    });
    
    test('uses existing toolsMentioned if present', () => {
      const sop = {
        toolsMentioned: ['manual1', 'manual2'],
        steps: [
          { gloss: 'Step 1', suggestedTools: ['tool1'] }
        ]
      };
      
      const tools = sopLoader.extractToolsMentioned(sop);
      
      expect(tools).toEqual(['manual1', 'manual2']);
    });
  });
  
  describe('file discovery', () => {
    test('discovers JSON files in data/sops/', async () => {
      const files = await sopLoader.discoverSOPFiles();
      
      expect(files.length).toBeGreaterThanOrEqual(3);
      expect(files.every(f => f.endsWith('.json'))).toBe(true);
      expect(files.some(f => f.includes('train-booking.json'))).toBe(true);
    });
    
    test('returns full paths', async () => {
      const files = await sopLoader.discoverSOPFiles();
      
      expect(files.every(f => path.isAbsolute(f))).toBe(true);
    });
  });
  
  describe('timestamp addition', () => {
    test('adds createdAt and updatedAt', () => {
      const sop = {
        title: 'Test',
        intent: 'Test',
        description: 'Test'
      };
      
      sopLoader.addTimestamps(sop);
      
      expect(sop.createdAt).toBeInstanceOf(Date);
      expect(sop.updatedAt).toBeInstanceOf(Date);
    });
    
    test('preserves existing createdAt', () => {
      const existingDate = new Date('2025-01-01');
      const sop = {
        title: 'Test',
        createdAt: existingDate
      };
      
      sopLoader.addTimestamps(sop);
      
      expect(sop.createdAt).toEqual(existingDate);
      expect(sop.updatedAt).toBeInstanceOf(Date);
      expect(sop.updatedAt).not.toEqual(existingDate);
    });
  });
  
  describe('full loading', () => {
    test('loads file and saves to database', async () => {
      const filePath = path.join(packageRoot, 'data/sops/file-operations.json');
      const sop = await sopLoader.loadFromFile(filePath);
      
      expect(sop._id).toBeDefined();
      expect(sop.title).toBe('Read and process file');
      expect(sop.steps[0].index).toBe(0);
      expect(sop.steps[1].index).toBe(1);
      expect(sop.toolsMentioned).toContain('file-read');
      
      const found = await sopStorage.findSOPByTitle('Read and process file');
      expect(found).toBeDefined();
      expect(found._id).toEqual(sop._id);
    });
    
    test('loads all SOPs from data directory', async () => {
      const results = await sopLoader.loadAllFromDataDir();
      
      expect(results.loaded).toBeGreaterThanOrEqual(3);
      expect(results.failed).toBe(0);
      
      const sops = await sopStorage.findSOPs();
      expect(sops.length).toBeGreaterThanOrEqual(3);
    });
  });
});