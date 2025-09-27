import { ResourceManager } from '@legion/resource-manager';
import SOPRegistry from '@legion/sop-registry';
import { ApplicabilityJudge } from '../../src/ApplicabilityJudge.js';

describe('ApplicabilityJudge', () => {
  let resourceManager;
  let sopRegistry;
  let judge;
  let trainSOP;
  
  beforeAll(async () => {
    resourceManager = await ResourceManager.getResourceManager();
    sopRegistry = await SOPRegistry.getInstance();
    
    await sopRegistry.sopStorage.clearAll();
    await sopRegistry.sopStorage.db.collection('sop_perspective_types').deleteMany({});
    await sopRegistry.sopStorage._seedPerspectiveTypes();
    await sopRegistry.loadAllSOPs();
    
    trainSOP = await sopRegistry.getSOPByTitle('Book a train ticket');
    
    judge = new ApplicabilityJudge({ resourceManager });
    await judge.initialize();
  });
  
  afterAll(async () => {
    if (sopRegistry) {
      await sopRegistry.cleanup();
    }
  });
  
  describe('initialization', () => {
    test('initializes with ResourceManager', () => {
      expect(judge.resourceManager).toBe(resourceManager);
      expect(judge.llmClient).toBeDefined();
      expect(judge.initialized).toBe(true);
    });
  });
  
  describe('judgment with real LLM', () => {
    test('judges good match with high confidence', async () => {
      const goal = {
        gloss: 'Book a train ticket to Paris for tomorrow',
        evidence: {
          origin: 'London',
          destination: 'Paris',
          travelDate: '2025-10-01'
        }
      };
      
      const context = {
        domain: 'travel',
        paymentConfigured: true
      };
      
      const judgment = await judge.judge(trainSOP, goal, context);
      
      expect(judgment.confidence).toBeGreaterThan(0);
      expect(judgment.reasoning).toBeDefined();
      expect(typeof judgment.reasoning).toBe('string');
    });
    
    test('judges poor match with low confidence', async () => {
      const goal = {
        gloss: 'Implement a caching layer',
        evidence: {}
      };
      
      const judgment = await judge.judge(trainSOP, goal, {});
      
      expect(judgment.confidence).toBeLessThan(0.5);
    });
    
    test('identifies missing prerequisites', async () => {
      const goal = {
        gloss: 'Book train',
        evidence: {}
      };
      
      const context = {
        paymentConfigured: false
      };
      
      const judgment = await judge.judge(trainSOP, goal, context);
      
      expect(judgment.missingPrerequisites).toBeInstanceOf(Array);
    });
    
    test('identifies missing parameters', async () => {
      const goal = {
        gloss: 'Book train to Paris',
        evidence: {
          destination: 'Paris'
        }
      };
      
      const judgment = await judge.judge(trainSOP, goal, {});
      
      expect(judgment.missingParameters).toBeInstanceOf(Array);
      expect(judgment.missingParameters).toContain('origin');
      expect(judgment.missingParameters).toContain('travelDate');
    });
    
    test('returns structured judgment', async () => {
      const goal = { gloss: 'Book train', evidence: {} };
      
      const judgment = await judge.judge(trainSOP, goal, {});
      
      expect(judgment).toHaveProperty('suitable');
      expect(judgment).toHaveProperty('confidence');
      expect(judgment).toHaveProperty('reasoning');
      expect(judgment).toHaveProperty('missingPrerequisites');
      expect(judgment).toHaveProperty('missingParameters');
      
      expect(typeof judgment.suitable).toBe('boolean');
      expect(typeof judgment.confidence).toBe('number');
      expect(judgment.confidence).toBeGreaterThanOrEqual(0);
      expect(judgment.confidence).toBeLessThanOrEqual(1);
    });
  });
  
  describe('prompt creation', () => {
    test('creates structured prompt', () => {
      const goal = { gloss: 'Test goal', evidence: { key: 'value' } };
      const context = { domain: 'test' };
      
      const prompt = judge.createPrompt(trainSOP, goal, context);
      
      expect(prompt).toContain('Book a train ticket');
      expect(prompt).toContain('Test goal');
      expect(prompt).toContain('key');
      expect(prompt).toContain('domain');
    });
  });
  
  describe('TemplatedPrompt usage', () => {
    test('uses TemplatedPrompt with schema', async () => {
      const goal = {
        gloss: 'Test goal',
        evidence: { key: 'value' }
      };
      
      const sop = await sopRegistry.getSOPByTitle('Book a train ticket');
      const judgment = await judge.judge(sop, goal, {});
      
      expect(judgment.suitable).toBeDefined();
      expect(typeof judgment.suitable).toBe('boolean');
      expect(judgment.confidence).toBeDefined();
      expect(typeof judgment.confidence).toBe('number');
      expect(judgment.reasoning).toBeDefined();
      expect(judgment.missingPrerequisites).toBeInstanceOf(Array);
      expect(judgment.missingParameters).toBeInstanceOf(Array);
    });
  });
});