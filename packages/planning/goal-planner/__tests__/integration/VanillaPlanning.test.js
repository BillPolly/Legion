import { ResourceManager } from '@legion/resource-manager';
import { GoalPlanner } from '../../src/GoalPlanner.js';
import SOPRegistry from '@legion/sop-registry';

describe('Vanilla Planning Integration', () => {
  let resourceManager;
  let goalPlanner;
  let sopRegistry;
  
  beforeAll(async () => {
    resourceManager = await ResourceManager.getResourceManager();
    sopRegistry = await SOPRegistry.getInstance();
    goalPlanner = await GoalPlanner.getInstance();
  });
  
  afterAll(async () => {
    if (sopRegistry) {
      await sopRegistry.cleanup();
    }
  });
  
  test('falls back to vanilla when no SOP matches', async () => {
    const goal = {
      gloss: 'Implement a caching layer for the database'
    };
    
    const plan = await goalPlanner.planGoal(goal);
    
    expect(plan.source).toBe('vanilla');
    expect(plan.subgoals).toBeInstanceOf(Array);
    expect(plan.subgoals.length).toBeGreaterThanOrEqual(3);
    expect(plan.subgoals.length).toBeLessThanOrEqual(5);
    expect(plan.confidence).toBe(0.6);
  });
  
  test('vanilla plan has correct structure', async () => {
    const goal = {
      gloss: 'Build a REST API endpoint'
    };
    
    const plan = await goalPlanner.planGoal(goal);
    
    plan.subgoals.forEach(subgoal => {
      expect(subgoal.gloss).toBeDefined();
      expect(subgoal.pred.name).toBe('execute');
      expect(subgoal.doneWhen).toBeInstanceOf(Array);
      expect(subgoal.doneWhen[0].kind).toBe('hasEvidence');
    });
  });
  
  test('vanilla plan has no provenance', async () => {
    const goal = {
      gloss: 'Create a data visualization'
    };
    
    const plan = await goalPlanner.planGoal(goal);
    
    plan.subgoals.forEach(subgoal => {
      expect(subgoal.provenance).toBeUndefined();
    });
  });
});