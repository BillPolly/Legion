import { ResourceManager } from '@legion/resource-manager';
import SOPRegistry from '@legion/sop-registry';
import { SOPAdapter } from '../../src/SOPAdapter.js';

describe('SOPAdapter', () => {
  let resourceManager;
  let sopRegistry;
  let sopAdapter;
  let trainSOP;
  
  beforeAll(async () => {
    resourceManager = await ResourceManager.getResourceManager();
    sopRegistry = await SOPRegistry.getInstance();
    
    await sopRegistry.sopStorage.clearAll();
    await sopRegistry.sopStorage.db.collection('sop_perspective_types').deleteMany({});
    await sopRegistry.sopStorage._seedPerspectiveTypes();
    await sopRegistry.loadAllSOPs();
    
    trainSOP = await sopRegistry.getSOPByTitle('Book a train ticket');
  });
  
  beforeEach(() => {
    sopAdapter = new SOPAdapter({ resourceManager });
  });
  
  afterAll(async () => {
    if (sopRegistry) {
      await sopRegistry.cleanup();
    }
  });
  
  describe('parameter extraction', () => {
    test('extracts required parameters', () => {
      const params = sopAdapter.extractParameters(trainSOP, {});
      
      expect(params.required).toContain('origin');
      expect(params.required).toContain('destination');
      expect(params.required).toContain('travelDate');
    });
    
    test('identifies available parameters from evidence', () => {
      const goal = {
        evidence: {
          origin: 'London',
          destination: 'Paris'
        }
      };
      
      const params = sopAdapter.extractParameters(trainSOP, goal);
      
      expect(params.available).toContain('origin');
      expect(params.available).toContain('destination');
      expect(params.missing).toContain('travelDate');
      expect(params.missing).not.toContain('origin');
    });
    
    test('handles SOP with no inputs', () => {
      const simpleSOP = {
        title: 'Simple SOP',
        inputs: {}
      };
      
      const params = sopAdapter.extractParameters(simpleSOP, {});
      
      expect(params.required).toEqual([]);
      expect(params.missing).toEqual([]);
    });
  });
  
  describe('gather subgoal generation', () => {
    test('creates gather subgoal for missing parameter', () => {
      const subgoals = sopAdapter.createGatherSubgoals(['travelDate'], trainSOP);
      
      expect(subgoals).toHaveLength(1);
      expect(subgoals[0].gloss).toBe('Gather travelDate');
      expect(subgoals[0].pred.name).toBe('gather_info');
      expect(subgoals[0].pred.args.key).toBe('travelDate');
      expect(subgoals[0].doneWhen[0].kind).toBe('hasEvidence');
      expect(subgoals[0].doneWhen[0].key).toBe('travelDate');
    });
    
    test('creates multiple gather subgoals', () => {
      const subgoals = sopAdapter.createGatherSubgoals(['origin', 'destination'], trainSOP);
      
      expect(subgoals).toHaveLength(2);
      expect(subgoals[0].gloss).toBe('Gather origin');
      expect(subgoals[1].gloss).toBe('Gather destination');
    });
    
    test('includes provenance for gather subgoals', () => {
      const subgoals = sopAdapter.createGatherSubgoals(['travelDate'], trainSOP);
      
      expect(subgoals[0].provenance).toBeDefined();
      expect(subgoals[0].provenance.sopTitle).toBe('Book a train ticket');
      expect(subgoals[0].provenance.stepIndex).toBe(-1);
      expect(subgoals[0].provenance.reason).toBe('parameter_gathering');
    });
  });
  
  describe('step to subgoal mapping', () => {
    test('maps step with suggested tool', () => {
      const step = {
        gloss: 'Search for available trains',
        suggestedTools: ['train-search-api'],
        index: 1
      };
      
      const subgoal = sopAdapter.mapStepToSubgoal(step, trainSOP, 1);
      
      expect(subgoal.gloss).toBe('Search for available trains');
      expect(subgoal.pred.name).toBe('use_tool');
      expect(subgoal.pred.args.tool).toBe('train-search-api');
      expect(subgoal.doneWhen).toBeInstanceOf(Array);
      expect(subgoal.provenance).toBeDefined();
      expect(subgoal.provenance.sopTitle).toBe('Book a train ticket');
      expect(subgoal.provenance.stepIndex).toBe(1);
      expect(subgoal.provenance.suggestedTool).toBe('train-search-api');
    });
    
    test('maps step without suggested tool', () => {
      const step = {
        gloss: 'Confirm user selection',
        index: 3
      };
      
      const subgoal = sopAdapter.mapStepToSubgoal(step, trainSOP, 3);
      
      expect(subgoal.gloss).toBe('Confirm user selection');
      expect(subgoal.pred.name).toBe('confirm');
      expect(subgoal.pred.args.tool).toBeUndefined();
    });
    
    test('includes sopId in provenance', () => {
      const step = trainSOP.steps[0];
      const subgoal = sopAdapter.mapStepToSubgoal(step, trainSOP, 0);
      
      expect(subgoal.provenance.sopId).toBe(trainSOP._id.toString());
    });
  });
  
  describe('complete SOP adaptation', () => {
    test('adapts SOP with no missing parameters', async () => {
      const goal = {
        gloss: 'Book train to Paris',
        evidence: {
          origin: 'London',
          destination: 'Paris',
          travelDate: '2025-10-01'
        }
      };
      
      const result = await sopAdapter.adaptSOPToSubgoals(trainSOP, goal);
      
      expect(result.subgoals).toBeInstanceOf(Array);
      expect(result.subgoals.length).toBe(trainSOP.steps.length);
      expect(result.decomp).toBe('AND');
      expect(result.confidence).toBeGreaterThan(0);
    });
    
    test('prepends gather subgoals for missing parameters', async () => {
      const goal = {
        gloss: 'Book train to Paris',
        evidence: {}
      };
      
      const result = await sopAdapter.adaptSOPToSubgoals(trainSOP, goal);
      
      const paramGatherSubgoals = result.subgoals.filter(s => 
        s.pred.name === 'gather_info' && s.provenance?.stepIndex === -1
      );
      
      expect(paramGatherSubgoals.length).toBe(3);
      expect(result.subgoals.length).toBe(3 + trainSOP.steps.length);
      
      const firstThree = result.subgoals.slice(0, 3);
      expect(firstThree.every(s => s.provenance?.stepIndex === -1)).toBe(true);
    });
    
    test('all subgoals have required fields', async () => {
      const goal = {
        gloss: 'Book train',
        evidence: {}
      };
      
      const result = await sopAdapter.adaptSOPToSubgoals(trainSOP, goal);
      
      result.subgoals.forEach(subgoal => {
        expect(subgoal.gloss).toBeDefined();
        expect(typeof subgoal.gloss).toBe('string');
        expect(subgoal.pred).toBeDefined();
        expect(subgoal.pred.name).toBeDefined();
        expect(subgoal.doneWhen).toBeInstanceOf(Array);
        expect(subgoal.doneWhen.length).toBeGreaterThan(0);
      });
    });
    
    test('returns high confidence for complete adaptation', async () => {
      const goal = {
        gloss: 'Book train',
        evidence: { origin: 'A', destination: 'B', travelDate: 'today' }
      };
      
      const result = await sopAdapter.adaptSOPToSubgoals(trainSOP, goal);
      
      expect(result.confidence).toBeGreaterThan(0.8);
    });
  });
});