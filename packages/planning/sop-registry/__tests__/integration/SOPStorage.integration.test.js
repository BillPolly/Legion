import { ResourceManager } from '@legion/resource-manager';
import { SOPStorage } from '../../src/SOPStorage.js';

describe('SOPStorage Integration', () => {
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
    }
  });
  
  afterAll(async () => {
    if (sopStorage && sopStorage.isConnected()) {
      await sopStorage.close();
    }
  });
  
  test('full initialization with real MongoDB', async () => {
    expect(sopStorage.isConnected()).toBe(true);
    
    const collections = await sopStorage.db.listCollections().toArray();
    const names = collections.map(c => c.name);
    
    expect(names).toContain('sops');
    expect(names).toContain('sop_perspective_types');
    expect(names).toContain('sop_perspectives');
    
    const types = await sopStorage.findPerspectiveTypes();
    expect(types.length).toBeGreaterThanOrEqual(5);
  });
  
  test('concurrent SOP save operations', async () => {
    const sops = Array.from({ length: 10 }, (_, i) => ({
      title: `Concurrent SOP ${i}`,
      intent: `Test intent ${i}`,
      description: `Test description ${i}`,
      steps: [
        { gloss: `Step 1 for SOP ${i}`, index: 0 },
        { gloss: `Step 2 for SOP ${i}`, index: 1 }
      ],
      tags: ['concurrent', 'test']
    }));
    
    await Promise.all(sops.map(s => sopStorage.saveSOP(s)));
    
    const count = await sopStorage.countSOPs();
    expect(count).toBe(10);
    
    const allSOPs = await sopStorage.findSOPs({ tags: 'concurrent' });
    expect(allSOPs).toHaveLength(10);
  });
  
  test('index verification for performance', async () => {
    const sopsCollection = sopStorage.db.collection('sops');
    const indexes = await sopsCollection.indexes();
    
    const indexFields = indexes.map(i => Object.keys(i.key).join('_'));
    
    expect(indexFields).toContain('title');
    expect(indexFields).toContain('tags');
    expect(indexFields).toContain('toolsMentioned');
    
    const typesCollection = sopStorage.db.collection('sop_perspective_types');
    const typeIndexes = await typesCollection.indexes();
    const typeFields = typeIndexes.map(i => Object.keys(i.key).join('_'));
    
    expect(typeFields).toContain('name');
    expect(typeFields).toContain('scope');
  });
  
  test('data integrity across operations', async () => {
    const sop = await sopStorage.saveSOP({
      title: 'Integrity Test',
      intent: 'Test data integrity',
      description: 'Comprehensive test',
      prerequisites: ['prereq1', 'prereq2'],
      inputs: {
        param1: { description: 'Input 1', type: 'string', required: true }
      },
      outputs: {
        result1: { description: 'Output 1', type: 'object' }
      },
      steps: [
        { gloss: 'Step 1', index: 0, suggestedTools: ['tool1'] },
        { gloss: 'Step 2', index: 1, suggestedTools: ['tool2'], doneWhen: 'Complete' }
      ],
      toolsMentioned: ['tool1', 'tool2'],
      tags: ['integrity', 'test'],
      quality: {
        source: 'curated',
        rating: 90,
        updated: '2025-09-27'
      }
    });
    
    expect(sop._id).toBeDefined();
    expect(sop.createdAt).toBeInstanceOf(Date);
    expect(sop.updatedAt).toBeInstanceOf(Date);
    
    const retrieved = await sopStorage.findSOP(sop._id);
    
    expect(retrieved.title).toBe('Integrity Test');
    expect(retrieved.prerequisites).toEqual(['prereq1', 'prereq2']);
    expect(retrieved.steps).toHaveLength(2);
    expect(retrieved.steps[0].suggestedTools).toEqual(['tool1']);
    expect(retrieved.toolsMentioned).toEqual(['tool1', 'tool2']);
    expect(retrieved.quality.rating).toBe(90);
    
    const intentType = await sopStorage.getPerspectiveType('intent_perspective');
    
    const perspective = await sopStorage.saveSOPPerspective({
      sop_id: sop._id,
      sop_title: sop.title,
      perspective_type_name: 'intent_perspective',
      perspective_type_id: intentType._id,
      scope: 'sop',
      content: 'Test data integrity operations',
      keywords: ['integrity', 'data', 'test'],
      embedding: new Array(768).fill(0.5),
      embedding_model: 'nomic-embed-text-v1.5',
      embedding_dimensions: 768,
      llm_model: 'claude-3-5-sonnet',
      batch_id: 'batch_integrity_test'
    });
    
    expect(perspective._id).toBeDefined();
    
    const foundPerspectives = await sopStorage.findPerspectivesBySOP(sop._id);
    expect(foundPerspectives).toHaveLength(1);
    expect(foundPerspectives[0].keywords).toEqual(['integrity', 'data', 'test']);
    
    await sopStorage.deleteSOP(sop._id);
    const deletedSOP = await sopStorage.findSOP(sop._id);
    expect(deletedSOP).toBeNull();
  });
  
  test('perspective lifecycle management', async () => {
    const sop = await sopStorage.saveSOP({
      title: 'Perspective Lifecycle',
      intent: 'Test',
      description: 'Test',
      steps: [
        { gloss: 'Step 1', index: 0 },
        { gloss: 'Step 2', index: 1 },
        { gloss: 'Step 3', index: 2 }
      ]
    });
    
    const types = await sopStorage.findPerspectiveTypes({ scope: 'sop' });
    const sopPerspectives = types.slice(0, 4).map((type, i) => ({
      sop_id: sop._id,
      sop_title: sop.title,
      perspective_type_name: type.name,
      perspective_type_id: type._id,
      scope: 'sop',
      content: `Perspective ${i}`,
      keywords: [`keyword${i}`],
      embedding: new Array(768).fill(0.1 * (i + 1)),
      embedding_model: 'nomic-embed-text-v1.5',
      embedding_dimensions: 768,
      llm_model: 'claude-3-5-sonnet',
      batch_id: 'batch_sop_level'
    }));
    
    const stepType = await sopStorage.getPerspectiveType('step_perspective');
    const stepPerspectives = [0, 1, 2].map(stepIndex => ({
      sop_id: sop._id,
      sop_title: sop.title,
      perspective_type_name: 'step_perspective',
      perspective_type_id: stepType._id,
      scope: 'step',
      step_index: stepIndex,
      content: `Step ${stepIndex} perspective`,
      keywords: [`step${stepIndex}`],
      embedding: new Array(768).fill(0.1 * (stepIndex + 1)),
      embedding_model: 'nomic-embed-text-v1.5',
      embedding_dimensions: 768,
      llm_model: 'claude-3-5-sonnet',
      batch_id: 'batch_step_level'
    }));
    
    const savedCount = await sopStorage.saveSOPPerspectives([
      ...sopPerspectives,
      ...stepPerspectives
    ]);
    
    expect(savedCount).toBe(7);
    
    const allPerspectives = await sopStorage.findPerspectivesBySOP(sop._id);
    expect(allPerspectives).toHaveLength(7);
    
    const sopLevelOnly = allPerspectives.filter(p => p.scope === 'sop');
    expect(sopLevelOnly).toHaveLength(4);
    
    const stepLevelOnly = allPerspectives.filter(p => p.scope === 'step');
    expect(stepLevelOnly).toHaveLength(3);
    
    const step1Perspectives = await sopStorage.findPerspectivesByStep(sop._id, 1);
    expect(step1Perspectives).toHaveLength(1);
    expect(step1Perspectives[0].content).toBe('Step 1 perspective');
    
    const clearedCount = await sopStorage.clearSOPPerspectives(sop._id);
    expect(clearedCount).toBe(7);
  });
});