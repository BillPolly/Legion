import GoalPlanner from '../../src/index.js';
import SOPRegistry from '@legion/sop-registry';

describe('End-to-End Planning with Real Components', () => {
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
  
  test('complete workflow: goal → SOP search → judgment → adaptation → plan', async () => {
    const goal = {
      gloss: 'I need to book a train from London to Paris for tomorrow',
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
    
    const plan = await goalPlanner.planGoal(goal, context);
    
    expect(plan).toBeDefined();
    expect(plan.source).toBeDefined();
    expect(plan.subgoals).toBeInstanceOf(Array);
    expect(plan.subgoals.length).toBeGreaterThan(0);
    expect(plan.decomp).toBe('AND');
    expect(plan.confidence).toBeGreaterThan(0);
    
    if (plan.source === 'sop') {
      expect(plan.metadata.sopUsed).toBeDefined();
      expect(plan.metadata.applicabilityScore).toBeGreaterThan(0);
      
      const toolSubgoals = plan.subgoals.filter(s => s.pred.args.tool);
      expect(toolSubgoals.length).toBeGreaterThan(0);
      
      plan.subgoals.forEach(subgoal => {
        expect(subgoal.provenance).toBeDefined();
        expect(subgoal.provenance.sopTitle).toBeDefined();
      });
    } else {
      expect(plan.source).toBe('vanilla');
    }
  });
  
  test('vanilla planning when no SOP matches', async () => {
    const goal = {
      gloss: 'Implement a neural network training pipeline'
    };
    
    const plan = await goalPlanner.planGoal(goal);
    
    expect(plan).toBeDefined();
    expect(plan.source).toBe('vanilla');
    expect(plan.subgoals).toBeInstanceOf(Array);
    expect(plan.subgoals.length).toBeGreaterThanOrEqual(3);
    expect(plan.subgoals.length).toBeLessThanOrEqual(5);
    expect(plan.decomp).toBe('AND');
    expect(plan.confidence).toBe(0.6);
    
    plan.subgoals.forEach(subgoal => {
      expect(subgoal.gloss).toBeDefined();
      expect(subgoal.pred.name).toBe('execute');
      expect(subgoal.doneWhen[0].kind).toBe('hasEvidence');
      expect(subgoal.provenance).toBeUndefined();
    });
  });
  
  test('handles goal with partial evidence - generates gather subgoals', async () => {
    const goal = {
      gloss: 'I want to book a train ticket to Paris',
      evidence: {
        destination: 'Paris'
      }
    };
    
    const context = {
      domain: 'travel',
      paymentConfigured: true
    };
    
    const plan = await goalPlanner.planGoal(goal, context);
    
    if (plan.source === 'sop') {
      const gatherSubgoals = plan.subgoals.filter(s => 
        s.pred.name === 'gather_info' && s.provenance?.reason === 'parameter_gathering'
      );
      
      expect(gatherSubgoals.length).toBeGreaterThan(0);
    } else {
      expect(plan.source).toBe('vanilla');
      expect(plan.subgoals.length).toBeGreaterThanOrEqual(3);
    }
  });
  
  test('uses real ToolRegistry for tool verification (via SOPRegistry)', async () => {
    const goal = {
      gloss: 'Call an external API with authentication',
      evidence: {
        apiUrl: 'https://api.test.com',
        credentials: { key: 'test' }
      }
    };
    
    const plan = await goalPlanner.planGoal(goal);
    
    expect(plan).toBeDefined();
    
    const toolSubgoals = plan.subgoals.filter(s => s.pred.args.tool);
    
    toolSubgoals.forEach(subgoal => {
      expect(subgoal.pred.args.tool).toBeDefined();
      expect(typeof subgoal.pred.args.tool).toBe('string');
    });
  });
});