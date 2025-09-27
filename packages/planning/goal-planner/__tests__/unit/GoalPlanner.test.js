import { GoalPlanner } from '../../src/GoalPlanner.js';
import SOPRegistry from '@legion/sop-registry';

describe('GoalPlanner', () => {
  let goalPlanner;
  let sopRegistry;
  
  beforeAll(async () => {
    sopRegistry = await SOPRegistry.getInstance();
    const stats = await sopRegistry.getStatistics();
    
    if (stats.sops.total === 0) {
      await sopRegistry.loadAllSOPs();
    }
    if (stats.perspectives.total === 0) {
      await sopRegistry.generateAllPerspectives();
    }
    
    goalPlanner = await GoalPlanner.getInstance();
  }, 120000);
  
  afterAll(async () => {
    if (sopRegistry) {
      await sopRegistry.cleanup();
    }
  });
  
  describe('singleton pattern', () => {
    test('getInstance returns same instance', async () => {
      const instance1 = await GoalPlanner.getInstance();
      const instance2 = await GoalPlanner.getInstance();
      
      expect(instance1).toBe(instance2);
    });
    
    test('prevents direct instantiation', () => {
      expect(() => new GoalPlanner({ resourceManager: {} })).toThrow();
    });
  });
  
  describe('component initialization', () => {
    test('initializes all components', () => {
      expect(goalPlanner.sopRegistry).toBeDefined();
      expect(goalPlanner.sopAdapter).toBeDefined();
      expect(goalPlanner.applicabilityJudge).toBeDefined();
      expect(goalPlanner.initialized).toBe(true);
    });
  });
  
  describe('SOP candidate retrieval', () => {
    test('retrieves candidates from SOPRegistry', async () => {
      const goal = { gloss: 'Book train ticket' };
      
      const candidates = await goalPlanner.retrieveSOPCandidates(goal);
      
      expect(candidates).toBeInstanceOf(Array);
      expect(candidates.length).toBeGreaterThan(0);
      expect(candidates[0].sop).toBeDefined();
      expect(candidates[0].score).toBeGreaterThan(0);
    });
  });
  
  describe('applicability judgment', () => {
    test('judges SOP suitability', async () => {
      const sop = await sopRegistry.getSOPByTitle('Book a train ticket');
      const goal = {
        gloss: 'Book train to Paris',
        evidence: {
          origin: 'London',
          destination: 'Paris',
          travelDate: '2025-10-01'
        }
      };
      
      const judgment = await goalPlanner.judgeApplicability(sop, goal, {});
      
      expect(judgment.confidence).toBeGreaterThanOrEqual(0);
      expect(judgment.confidence).toBeLessThanOrEqual(1);
    });
  });
  
  describe('main planning API', () => {
    test('plans goal with SOP match', async () => {
      const trainSOP = await sopRegistry.getSOPByTitle('Book a train ticket');
      
      const goal = {
        gloss: 'I want to book a train from London to Paris for October 1st 2025',
        evidence: {
          origin: 'London',
          destination: 'Paris',
          travelDate: '2025-10-01'
        }
      };
      
      const context = {
        domain: 'travel',
        paymentConfigured: true,
        apiAccess: true
      };
      
      const adaptation = await goalPlanner.sopAdapter.adaptSOPToSubgoals(trainSOP, goal);
      
      expect(adaptation).toBeDefined();
      expect(adaptation.subgoals).toBeInstanceOf(Array);
      expect(adaptation.subgoals.length).toBeGreaterThan(0);
      expect(adaptation.decomp).toBe('AND');
    });
    
    test('plan includes metadata', async () => {
      const goal = {
        gloss: 'Call an API',
        evidence: {
          apiUrl: 'test',
          credentials: {}
        }
      };
      
      const plan = await goalPlanner.planGoal(goal);
      
      expect(plan.metadata).toBeDefined();
      expect(plan.metadata.planningTime).toBeGreaterThan(0);
      expect(plan.metadata.timestamp).toBeInstanceOf(Date);
    });
  });
  
  describe('health check', () => {
    test('returns system health status', async () => {
      const health = await goalPlanner.healthCheck();
      
      expect(health.healthy).toBe(true);
      expect(health.sopRegistry.available).toBe(true);
    });
  });
});