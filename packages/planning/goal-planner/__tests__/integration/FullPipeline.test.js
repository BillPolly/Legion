import GoalPlanner from '../../src/index.js';
import SOPRegistry from '@legion/sop-registry';

describe('Full Pipeline Integration', () => {
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
  }, 180000);
  
  afterAll(async () => {
    if (sopRegistry) {
      await sopRegistry.cleanup();
    }
  });
  
  test('complete SOP-based planning workflow', async () => {
    const trainSOP = await sopRegistry.getSOPByTitle('Book a train ticket');
    
    const goal = {
      gloss: 'Book train',
      evidence: {
        origin: 'A',
        destination: 'B',
        travelDate: 'today'
      }
    };
    
    const plan = await goalPlanner.sopAdapter.adaptSOPToSubgoals(trainSOP, goal);
    
    expect(plan.subgoals).toBeInstanceOf(Array);
    expect(plan.subgoals.length).toBe(5);
    expect(plan.decomp).toBe('AND');
    
    plan.subgoals.forEach(subgoal => {
      expect(subgoal.gloss).toBeDefined();
      expect(subgoal.pred).toBeDefined();
      expect(subgoal.doneWhen).toBeInstanceOf(Array);
      expect(subgoal.provenance).toBeDefined();
    });
  });
  
  test('verifies provenance tracking', async () => {
    const trainSOP = await sopRegistry.getSOPByTitle('Book a train ticket');
    
    const goal = {
      gloss: 'Book train',
      evidence: { origin: 'A', destination: 'B', travelDate: 'today' }
    };
    
    const plan = await goalPlanner.sopAdapter.adaptSOPToSubgoals(trainSOP, goal);
    
    const stepSubgoals = plan.subgoals.filter(s => s.provenance.stepIndex >= 0);
    
    expect(stepSubgoals.length).toBe(5);
    stepSubgoals.forEach((subgoal, i) => {
      expect(subgoal.provenance.sopId).toBe(trainSOP._id.toString());
      expect(subgoal.provenance.sopTitle).toBe('Book a train ticket');
      expect(subgoal.provenance.stepIndex).toBe(i);
    });
  });
  
  test('verifies tool suggestions preserved', async () => {
    const trainSOP = await sopRegistry.getSOPByTitle('Book a train ticket');
    
    const goal = {
      gloss: 'Book train',
      evidence: { origin: 'A', destination: 'B', travelDate: 'today' }
    };
    
    const plan = await goalPlanner.sopAdapter.adaptSOPToSubgoals(trainSOP, goal);
    
    const searchStep = plan.subgoals.find(s => s.gloss.includes('Search for available trains'));
    expect(searchStep).toBeDefined();
    expect(searchStep.pred.args.tool).toBe('train-search-api');
    expect(searchStep.provenance.suggestedTool).toBe('train-search-api');
    
    const bookingStep = plan.subgoals.find(s => s.gloss.includes('Execute booking'));
    expect(bookingStep).toBeDefined();
    expect(bookingStep.pred.args.tool).toBe('train-booking-api');
  });
  
  test('health check verifies all systems', async () => {
    const health = await goalPlanner.healthCheck();
    
    expect(health.healthy).toBe(true);
    expect(health.sopRegistry.available).toBe(true);
    expect(health.sopRegistry.sopsLoaded).toBeGreaterThan(0);
    expect(health.applicabilityJudge.available).toBe(true);
  });
});