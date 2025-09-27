import { ResourceManager } from '@legion/resource-manager';
import { SOPStorage } from '../../src/SOPStorage.js';
import { SOPPerspectives } from '../../src/SOPPerspectives.js';
import { PerspectiveGenerationError } from '../../src/errors/index.js';

describe('SOPPerspectives', () => {
  let resourceManager;
  let sopStorage;
  let sopPerspectives;
  let testSOP;
  
  beforeAll(async () => {
    resourceManager = await ResourceManager.getResourceManager();
    sopStorage = new SOPStorage({ resourceManager });
    await sopStorage.initialize();
  });
  
  beforeEach(async () => {
    await sopStorage.clearAll();
    await sopStorage.db.collection('sop_perspective_types').deleteMany({});
    await sopStorage._seedPerspectiveTypes();
    
    sopPerspectives = new SOPPerspectives({
      resourceManager,
      sopStorage
    });
    await sopPerspectives.initialize();
    
    testSOP = await sopStorage.saveSOP({
      title: 'Test SOP for Perspectives',
      intent: 'Test perspective generation',
      description: 'A test SOP',
      prerequisites: ['prereq1', 'prereq2'],
      inputs: {
        param1: { description: 'Input', type: 'string', required: true }
      },
      outputs: {
        result1: { description: 'Output', type: 'object' }
      },
      steps: [
        { gloss: 'First step', index: 0, suggestedTools: ['tool1'] },
        { gloss: 'Second step', index: 1, suggestedTools: ['tool2'] },
        { gloss: 'Third step', index: 2 }
      ],
      toolsMentioned: ['tool1', 'tool2'],
      tags: ['test']
    });
  });
  
  afterAll(async () => {
    if (sopStorage && sopStorage.isConnected()) {
      await sopStorage.clearAll();
      await sopStorage.close();
    }
  });
  
  describe('initialization', () => {
    test('initializes with ResourceManager', () => {
      expect(sopPerspectives.resourceManager).toBe(resourceManager);
      expect(sopPerspectives.sopStorage).toBe(sopStorage);
      expect(sopPerspectives.initialized).toBe(true);
    });
    
    test('gets LLM client from ResourceManager', () => {
      expect(sopPerspectives.llmClient).toBeDefined();
    });
    
    test('gets Nomic service from ResourceManager', () => {
      expect(sopPerspectives.nomicService).toBeDefined();
    });
  });
  
  describe('SOP-level perspective generation', () => {
    test('generates 4 perspectives in single LLM call', async () => {
      const perspectives = await sopPerspectives.generateForSOP(testSOP._id);
      
      const sopLevel = perspectives.filter(p => p.scope === 'sop');
      expect(sopLevel).toHaveLength(4);
      
      const types = sopLevel.map(p => p.perspective_type_name);
      expect(types).toContain('intent_perspective');
      expect(types).toContain('preconditions_perspective');
      expect(types).toContain('tools_perspective');
      expect(types).toContain('outcomes_perspective');
    });
    
    test('perspectives have required fields', async () => {
      const perspectives = await sopPerspectives.generateForSOP(testSOP._id);
      
      const sopLevel = perspectives.filter(p => p.scope === 'sop');
      
      sopLevel.forEach(p => {
        expect(p.sop_id).toEqual(testSOP._id);
        expect(p.sop_title).toBe(testSOP.title);
        expect(p.perspective_type_name).toBeDefined();
        expect(p.scope).toBe('sop');
        expect(p.content).toBeDefined();
        expect(typeof p.content).toBe('string');
        expect(p.content.length).toBeGreaterThan(0);
        expect(p.keywords).toBeInstanceOf(Array);
        expect(p.generated_at).toBeInstanceOf(Date);
        expect(p.llm_model).toBeDefined();
        expect(p.batch_id).toBeDefined();
      });
    });
  });
  
  describe('step-level perspective generation', () => {
    test('generates perspective for each step', async () => {
      const perspectives = await sopPerspectives.generateForSOP(testSOP._id);
      
      const stepLevel = perspectives.filter(p => p.scope === 'step');
      expect(stepLevel).toHaveLength(3);
      
      expect(stepLevel[0].step_index).toBe(0);
      expect(stepLevel[1].step_index).toBe(1);
      expect(stepLevel[2].step_index).toBe(2);
    });
    
    test('step perspectives have required fields', async () => {
      const perspectives = await sopPerspectives.generateForSOP(testSOP._id);
      
      const stepLevel = perspectives.filter(p => p.scope === 'step');
      
      stepLevel.forEach((p, i) => {
        expect(p.sop_id).toEqual(testSOP._id);
        expect(p.perspective_type_name).toBe('step_perspective');
        expect(p.scope).toBe('step');
        expect(p.step_index).toBe(i);
        expect(p.content).toBeDefined();
        expect(typeof p.content).toBe('string');
        expect(p.embedding).toBeDefined();
      });
    });
  });
  
  describe('embedding generation', () => {
    test('embeds all perspectives via Nomic', async () => {
      const perspectives = await sopPerspectives.generateForSOP(testSOP._id);
      
      perspectives.forEach(p => {
        expect(p.embedding).toBeInstanceOf(Array);
        expect(p.embedding).toHaveLength(768);
        expect(p.embedding_model).toBe('nomic-embed-text-v1.5');
        expect(p.embedding_dimensions).toBe(768);
      });
    });
    
    test('embeddings are valid float arrays', async () => {
      const perspectives = await sopPerspectives.generateForSOP(testSOP._id);
      
      perspectives.forEach(p => {
        expect(p.embedding.every(val => typeof val === 'number')).toBe(true);
        expect(p.embedding.every(val => !isNaN(val))).toBe(true);
      });
    });
  });
  
  describe('saving perspectives', () => {
    test('saves perspectives to database', async () => {
      const perspectives = await sopPerspectives.generateForSOP(testSOP._id);
      
      const saved = await sopStorage.findPerspectivesBySOP(testSOP._id);
      expect(saved).toHaveLength(7);
    });
    
    test('saved perspectives retrievable by step', async () => {
      await sopPerspectives.generateForSOP(testSOP._id);
      
      const step0 = await sopStorage.findPerspectivesByStep(testSOP._id, 0);
      expect(step0).toHaveLength(1);
      expect(step0[0].step_index).toBe(0);
      
      const step1 = await sopStorage.findPerspectivesByStep(testSOP._id, 1);
      expect(step1).toHaveLength(1);
      expect(step1[0].step_index).toBe(1);
    });
  });
  
  describe('batch operations', () => {
    test('links perspectives with batch_id', async () => {
      const perspectives = await sopPerspectives.generateForSOP(testSOP._id);
      
      const sopLevelBatchIds = [...new Set(perspectives.filter(p => p.scope === 'sop').map(p => p.batch_id))];
      expect(sopLevelBatchIds).toHaveLength(1);
      
      const stepLevelBatchIds = [...new Set(perspectives.filter(p => p.scope === 'step').map(p => p.batch_id))];
      expect(stepLevelBatchIds).toHaveLength(1);
    });
    
    test('generates for all SOPs', async () => {
      await sopStorage.saveSOP({
        title: 'SOP 2',
        intent: 'Test',
        description: 'Test',
        steps: [{ gloss: 'Step 1', index: 0 }]
      });
      
      const results = await sopPerspectives.generateForAllSOPs();
      
      expect(results.generated).toBeGreaterThan(0);
      expect(results.failed).toBe(0);
    });
  });
  
  describe('error handling', () => {
    test('throws PerspectiveGenerationError for nonexistent SOP', async () => {
      const fakeId = '507f1f77bcf86cd799439011';
      
      await expect(sopPerspectives.generateForSOP(fakeId)).rejects.toThrow(PerspectiveGenerationError);
    });
  });
});