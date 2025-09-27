import { ResourceManager } from '@legion/resource-manager';
import { VanillaAdapter } from '../../src/VanillaAdapter.js';

describe('VanillaAdapter', () => {
  let resourceManager;
  let vanillaAdapter;
  
  beforeAll(async () => {
    resourceManager = await ResourceManager.getResourceManager();
    vanillaAdapter = new VanillaAdapter({ resourceManager });
    await vanillaAdapter.initialize();
  });
  
  describe('initialization', () => {
    test('initializes with ResourceManager', () => {
      expect(vanillaAdapter.resourceManager).toBe(resourceManager);
      expect(vanillaAdapter.llmClient).toBeDefined();
      expect(vanillaAdapter.initialized).toBe(true);
    });
    
    test('has TemplatedPrompt schema defined', () => {
      expect(vanillaAdapter.promptTemplate).toBeDefined();
      expect(vanillaAdapter.responseSchema).toBeDefined();
      expect(vanillaAdapter.responseSchema.properties.steps).toBeDefined();
    });
  });
  
  describe('goal decomposition with real LLM', () => {
    test('decomposes simple goal', async () => {
      const goal = {
        gloss: 'Write hello world to a file'
      };
      
      const result = await vanillaAdapter.decomposeGoal(goal);
      
      expect(result.subgoals).toBeInstanceOf(Array);
      expect(result.subgoals.length).toBeGreaterThanOrEqual(3);
      expect(result.subgoals.length).toBeLessThanOrEqual(5);
      expect(result.decomp).toBe('AND');
      expect(result.confidence).toBe(0.6);
    });
    
    test('creates subgoals with required fields', async () => {
      const goal = {
        gloss: 'Read a file and count lines'
      };
      
      const result = await vanillaAdapter.decomposeGoal(goal);
      
      result.subgoals.forEach(subgoal => {
        expect(subgoal.gloss).toBeDefined();
        expect(typeof subgoal.gloss).toBe('string');
        expect(subgoal.pred).toBeDefined();
        expect(subgoal.pred.name).toBe('execute');
        expect(subgoal.doneWhen).toBeInstanceOf(Array);
        expect(subgoal.doneWhen[0].kind).toBe('hasEvidence');
        expect(subgoal.doneWhen[0].key).toBeDefined();
      });
    });
    
    test('generates steps for various goal types', async () => {
      const goals = [
        { gloss: 'Search for files in directory' },
        { gloss: 'Send email notification' },
        { gloss: 'Calculate statistics' }
      ];
      
      for (const goal of goals) {
        const result = await vanillaAdapter.decomposeGoal(goal);
        expect(result.subgoals.length).toBeGreaterThanOrEqual(3);
      }
    });
  });
  
  describe('evidence key generation', () => {
    test('generates unique evidence keys', () => {
      const key1 = vanillaAdapter.generateEvidenceKey('Read file contents');
      const key2 = vanillaAdapter.generateEvidenceKey('Write to file');
      
      expect(key1).not.toBe(key2);
      expect(key1.length).toBeGreaterThan(0);
      expect(key2.length).toBeGreaterThan(0);
    });
    
    test('generates camelCase keys', () => {
      const key = vanillaAdapter.generateEvidenceKey('Read file contents');
      
      expect(key).toMatch(/^[a-z][a-zA-Z0-9]*$/);
      expect(key).toBe('readFileContents');
    });
    
    test('handles single word', () => {
      expect(vanillaAdapter.generateEvidenceKey('Search')).toBe('search');
    });
    
    test('handles empty string', () => {
      expect(vanillaAdapter.generateEvidenceKey('')).toBe('result');
    });
  });
});