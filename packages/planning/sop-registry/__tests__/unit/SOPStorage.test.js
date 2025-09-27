import { ResourceManager } from '@legion/resource-manager';
import { SOPStorage } from '../../src/SOPStorage.js';
import { DatabaseError } from '../../src/errors/index.js';

describe('SOPStorage', () => {
  let resourceManager;
  let sopStorage;
  
  beforeAll(async () => {
    resourceManager = await ResourceManager.getResourceManager();
  });
  
  beforeEach(async () => {
    sopStorage = new SOPStorage({ resourceManager });
    await sopStorage.initialize();
    await sopStorage.clearAll();
    await sopStorage.db.collection('sop_perspective_types').deleteMany({});
    await sopStorage._seedPerspectiveTypes();
  });
  
  afterEach(async () => {
    if (sopStorage && sopStorage.isConnected()) {
      await sopStorage.clearAll();
      await sopStorage.close();
    }
  });
  
  describe('initialization', () => {
    test('connects to MongoDB via ResourceManager', async () => {
      expect(sopStorage.isConnected()).toBe(true);
      expect(sopStorage.db).toBeDefined();
    });
    
    test('creates required collections', async () => {
      const collections = await sopStorage.db.listCollections().toArray();
      const names = collections.map(c => c.name);
      
      expect(names).toContain('sops');
      expect(names).toContain('sop_perspective_types');
      expect(names).toContain('sop_perspectives');
    });
    
    test('seeds default perspective types', async () => {
      const types = await sopStorage.findPerspectiveTypes();
      
      expect(types.length).toBeGreaterThanOrEqual(5);
      const typeNames = types.map(t => t.name);
      expect(typeNames).toContain('intent_perspective');
      expect(typeNames).toContain('preconditions_perspective');
      expect(typeNames).toContain('tools_perspective');
      expect(typeNames).toContain('outcomes_perspective');
      expect(typeNames).toContain('step_perspective');
    });
    
    test('creates indexes', async () => {
      const sopsCollection = sopStorage.db.collection('sops');
      const indexes = await sopsCollection.indexes();
      
      const indexNames = indexes.map(i => Object.keys(i.key).join('_'));
      expect(indexNames).toContain('title');
    });
    
    test('throws DatabaseError if ResourceManager missing', () => {
      expect(() => new SOPStorage({})).toThrow(DatabaseError);
    });
  });
  
  describe('SOP CRUD operations', () => {
    test('saves SOP to database', async () => {
      const sop = {
        title: 'Test SOP',
        intent: 'Test intent',
        description: 'Test description',
        steps: [{ gloss: 'Step 1', index: 0 }]
      };
      
      const saved = await sopStorage.saveSOP(sop);
      
      expect(saved._id).toBeDefined();
      expect(saved.title).toBe('Test SOP');
      expect(saved.createdAt).toBeInstanceOf(Date);
    });
    
    test('finds SOP by ID', async () => {
      const sop = {
        title: 'Find Test',
        intent: 'Test',
        description: 'Test',
        steps: [{ gloss: 'Step 1', index: 0 }]
      };
      
      const saved = await sopStorage.saveSOP(sop);
      const found = await sopStorage.findSOP(saved._id);
      
      expect(found).toBeDefined();
      expect(found.title).toBe('Find Test');
    });
    
    test('finds SOP by title', async () => {
      const sop = {
        title: 'Unique Title',
        intent: 'Test',
        description: 'Test',
        steps: [{ gloss: 'Step 1', index: 0 }]
      };
      
      await sopStorage.saveSOP(sop);
      const found = await sopStorage.findSOPByTitle('Unique Title');
      
      expect(found).toBeDefined();
      expect(found.title).toBe('Unique Title');
    });
    
    test('finds SOPs with filter', async () => {
      await sopStorage.saveSOP({
        title: 'SOP 1',
        intent: 'Test',
        description: 'Test',
        steps: [{ gloss: 'Step 1', index: 0 }],
        tags: ['travel']
      });
      
      await sopStorage.saveSOP({
        title: 'SOP 2',
        intent: 'Test',
        description: 'Test',
        steps: [{ gloss: 'Step 1', index: 0 }],
        tags: ['files']
      });
      
      const travelSOPs = await sopStorage.findSOPs({ tags: 'travel' });
      
      expect(travelSOPs).toHaveLength(1);
      expect(travelSOPs[0].title).toBe('SOP 1');
    });
    
    test('deletes SOP', async () => {
      const sop = {
        title: 'Delete Me',
        intent: 'Test',
        description: 'Test',
        steps: [{ gloss: 'Step 1', index: 0 }]
      };
      
      const saved = await sopStorage.saveSOP(sop);
      await sopStorage.deleteSOP(saved._id);
      
      const found = await sopStorage.findSOP(saved._id);
      expect(found).toBeNull();
    });
    
    test('counts SOPs', async () => {
      await sopStorage.saveSOP({
        title: 'SOP 1',
        intent: 'Test',
        description: 'Test',
        steps: [{ gloss: 'Step 1', index: 0 }]
      });
      
      await sopStorage.saveSOP({
        title: 'SOP 2',
        intent: 'Test',
        description: 'Test',
        steps: [{ gloss: 'Step 1', index: 0 }]
      });
      
      const count = await sopStorage.countSOPs();
      expect(count).toBe(2);
    });
    
    test('upserts on duplicate title', async () => {
      const sop1 = {
        title: 'Same Title',
        intent: 'First',
        description: 'Test',
        steps: [{ gloss: 'Step 1', index: 0 }]
      };
      
      const sop2 = {
        title: 'Same Title',
        intent: 'Second',
        description: 'Test',
        steps: [{ gloss: 'Step 1', index: 0 }]
      };
      
      await sopStorage.saveSOP(sop1);
      await sopStorage.saveSOP(sop2);
      
      const count = await sopStorage.countSOPs();
      expect(count).toBe(1);
      
      const found = await sopStorage.findSOPByTitle('Same Title');
      expect(found.intent).toBe('Second');
    });
  });
  
  describe('perspective type operations', () => {
    test('saves perspective type', async () => {
      const type = {
        name: 'test_perspective',
        description: 'Test perspective',
        prompt_template: 'Test prompt',
        category: 'test',
        scope: 'sop',
        order: 10,
        enabled: true
      };
      
      const saved = await sopStorage.savePerspectiveType(type);
      
      expect(saved.name).toBe('test_perspective');
      expect(saved.created_at).toBeInstanceOf(Date);
    });
    
    test('gets perspective type by name', async () => {
      const found = await sopStorage.getPerspectiveType('intent_perspective');
      
      expect(found).toBeDefined();
      expect(found.name).toBe('intent_perspective');
      expect(found.scope).toBe('sop');
    });
    
    test('finds perspective types with filter', async () => {
      const sopTypes = await sopStorage.findPerspectiveTypes({ scope: 'sop' });
      const stepTypes = await sopStorage.findPerspectiveTypes({ scope: 'step' });
      
      expect(sopTypes.length).toBeGreaterThanOrEqual(4);
      expect(stepTypes.length).toBeGreaterThanOrEqual(1);
    });
  });
  
  describe('perspective CRUD operations', () => {
    let testSOP;
    
    beforeEach(async () => {
      testSOP = await sopStorage.saveSOP({
        title: 'Test SOP for Perspectives',
        intent: 'Test',
        description: 'Test',
        steps: [
          { gloss: 'Step 1', index: 0 },
          { gloss: 'Step 2', index: 1 }
        ]
      });
    });
    
    test('saves single perspective', async () => {
      const perspective = {
        sop_id: testSOP._id,
        sop_title: testSOP.title,
        perspective_type_name: 'intent_perspective',
        perspective_type_id: 'test-type-id',
        scope: 'sop',
        content: 'Test perspective content',
        keywords: ['test', 'perspective'],
        embedding: new Array(768).fill(0.1),
        embedding_model: 'nomic-embed-text-v1.5',
        embedding_dimensions: 768,
        llm_model: 'claude-3-5-sonnet',
        batch_id: 'batch_123'
      };
      
      const saved = await sopStorage.saveSOPPerspective(perspective);
      
      expect(saved._id).toBeDefined();
      expect(saved.sop_id).toEqual(testSOP._id);
      expect(saved.generated_at).toBeInstanceOf(Date);
    });
    
    test('saves multiple perspectives in batch', async () => {
      const perspectives = [
        {
          sop_id: testSOP._id,
          sop_title: testSOP.title,
          perspective_type_name: 'intent_perspective',
          perspective_type_id: 'type-1',
          scope: 'sop',
          content: 'Content 1',
          keywords: ['test'],
          embedding: new Array(768).fill(0.1),
          embedding_model: 'nomic',
          embedding_dimensions: 768,
          llm_model: 'claude',
          batch_id: 'batch_1'
        },
        {
          sop_id: testSOP._id,
          sop_title: testSOP.title,
          perspective_type_name: 'tools_perspective',
          perspective_type_id: 'type-2',
          scope: 'sop',
          content: 'Content 2',
          keywords: ['test'],
          embedding: new Array(768).fill(0.2),
          embedding_model: 'nomic',
          embedding_dimensions: 768,
          llm_model: 'claude',
          batch_id: 'batch_1'
        }
      ];
      
      const count = await sopStorage.saveSOPPerspectives(perspectives);
      
      expect(count).toBe(2);
    });
    
    test('finds perspectives by SOP', async () => {
      await sopStorage.saveSOPPerspective({
        sop_id: testSOP._id,
        sop_title: testSOP.title,
        perspective_type_name: 'intent_perspective',
        perspective_type_id: 'type-1',
        scope: 'sop',
        content: 'Content',
        keywords: [],
        embedding: new Array(768).fill(0.1),
        embedding_model: 'nomic',
        embedding_dimensions: 768,
        llm_model: 'claude',
        batch_id: 'batch_1'
      });
      
      const perspectives = await sopStorage.findPerspectivesBySOP(testSOP._id);
      
      expect(perspectives).toHaveLength(1);
      expect(perspectives[0].sop_id).toEqual(testSOP._id);
    });
    
    test('finds perspectives by step', async () => {
      await sopStorage.saveSOPPerspective({
        sop_id: testSOP._id,
        sop_title: testSOP.title,
        perspective_type_name: 'step_perspective',
        perspective_type_id: 'type-step',
        scope: 'step',
        step_index: 1,
        content: 'Step content',
        keywords: [],
        embedding: new Array(768).fill(0.1),
        embedding_model: 'nomic',
        embedding_dimensions: 768,
        llm_model: 'claude',
        batch_id: 'batch_1'
      });
      
      const perspectives = await sopStorage.findPerspectivesByStep(testSOP._id, 1);
      
      expect(perspectives).toHaveLength(1);
      expect(perspectives[0].step_index).toBe(1);
    });
    
    test('finds perspectives with filter', async () => {
      await sopStorage.saveSOPPerspectives([
        {
          sop_id: testSOP._id,
          sop_title: testSOP.title,
          perspective_type_name: 'intent_perspective',
          perspective_type_id: 'type-1',
          scope: 'sop',
          content: 'SOP level',
          keywords: [],
          embedding: new Array(768).fill(0.1),
          embedding_model: 'nomic',
          embedding_dimensions: 768,
          llm_model: 'claude',
          batch_id: 'batch_1'
        },
        {
          sop_id: testSOP._id,
          sop_title: testSOP.title,
          perspective_type_name: 'step_perspective',
          perspective_type_id: 'type-2',
          scope: 'step',
          step_index: 0,
          content: 'Step level',
          keywords: [],
          embedding: new Array(768).fill(0.2),
          embedding_model: 'nomic',
          embedding_dimensions: 768,
          llm_model: 'claude',
          batch_id: 'batch_1'
        }
      ]);
      
      const sopLevel = await sopStorage.findSOPPerspectives({ scope: 'sop' });
      expect(sopLevel).toHaveLength(1);
      
      const stepLevel = await sopStorage.findSOPPerspectives({ scope: 'step' });
      expect(stepLevel).toHaveLength(1);
    });
    
    test('counts perspectives', async () => {
      await sopStorage.saveSOPPerspective({
        sop_id: testSOP._id,
        sop_title: testSOP.title,
        perspective_type_name: 'intent_perspective',
        perspective_type_id: 'type-1',
        scope: 'sop',
        content: 'Content',
        keywords: [],
        embedding: new Array(768).fill(0.1),
        embedding_model: 'nomic',
        embedding_dimensions: 768,
        llm_model: 'claude',
        batch_id: 'batch_1'
      });
      
      const count = await sopStorage.countSOPPerspectives();
      expect(count).toBe(1);
    });
    
    test('clears SOP perspectives', async () => {
      await sopStorage.saveSOPPerspective({
        sop_id: testSOP._id,
        sop_title: testSOP.title,
        perspective_type_name: 'intent_perspective',
        perspective_type_id: 'type-1',
        scope: 'sop',
        content: 'Content',
        keywords: [],
        embedding: new Array(768).fill(0.1),
        embedding_model: 'nomic',
        embedding_dimensions: 768,
        llm_model: 'claude',
        batch_id: 'batch_1'
      });
      
      const deletedCount = await sopStorage.clearSOPPerspectives(testSOP._id);
      expect(deletedCount).toBe(1);
      
      const remaining = await sopStorage.findPerspectivesBySOP(testSOP._id);
      expect(remaining).toHaveLength(0);
    });
  });
  
  describe('statistics', () => {
    test('returns accurate statistics', async () => {
      await sopStorage.saveSOP({
        title: 'SOP 1',
        intent: 'Test',
        description: 'Test',
        steps: [{ gloss: 'Step 1', index: 0 }]
      });
      
      const stats = await sopStorage.getStatistics();
      
      expect(stats.sops.total).toBe(1);
      expect(stats.perspectives.perspectiveTypes).toBeGreaterThanOrEqual(5);
    });
  });
  
  describe('health check', () => {
    test('returns true when connected', async () => {
      const healthy = await sopStorage.healthCheck();
      expect(healthy).toBe(true);
    });
    
    test('returns false when disconnected', async () => {
      await sopStorage.close();
      const healthy = await sopStorage.healthCheck();
      expect(healthy).toBe(false);
    });
  });
  
  describe('cleanup', () => {
    test('clears all collections', async () => {
      await sopStorage.saveSOP({
        title: 'Clear Test',
        intent: 'Test',
        description: 'Test',
        steps: [{ gloss: 'Step 1', index: 0 }]
      });
      
      await sopStorage.clearAll();
      
      const sops = await sopStorage.findSOPs();
      expect(sops).toHaveLength(0);
      
      const perspectives = await sopStorage.findSOPPerspectives();
      expect(perspectives).toHaveLength(0);
    });
  });
});