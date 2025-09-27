import { SOPAdapter } from './SOPAdapter.js';
import { ApplicabilityJudge } from './ApplicabilityJudge.js';
import { VanillaAdapter } from './VanillaAdapter.js';

export class GoalPlanner {
  static _instance = null;
  static _isInitialized = false;
  
  static async getInstance() {
    if (!GoalPlanner._instance) {
      const { ResourceManager } = await import('@legion/resource-manager');
      const resourceManager = await ResourceManager.getResourceManager();
      
      GoalPlanner._instance = new GoalPlanner({ resourceManager });
      await GoalPlanner._instance.initialize();
      GoalPlanner._isInitialized = true;
    }
    return GoalPlanner._instance;
  }
  
  static reset() {
    GoalPlanner._instance = null;
    GoalPlanner._isInitialized = false;
  }
  
  constructor({ resourceManager }) {
    if (GoalPlanner._instance) {
      throw new Error('GoalPlanner is a singleton. Use GoalPlanner.getInstance() instead.');
    }
    
    if (!resourceManager) {
      throw new Error('ResourceManager is required');
    }
    
    this.resourceManager = resourceManager;
    this.sopRegistry = null;
    this.sopAdapter = null;
    this.applicabilityJudge = null;
    this.vanillaAdapter = null;
    this.initialized = false;
  }
  
  async initialize() {
    if (this.initialized) return;
    
    const { default: SOPRegistry } = await import('@legion/sop-registry');
    this.sopRegistry = await SOPRegistry.getInstance();
    
    this.sopAdapter = new SOPAdapter({ 
      resourceManager: this.resourceManager 
    });
    
    this.applicabilityJudge = new ApplicabilityJudge({ 
      resourceManager: this.resourceManager 
    });
    await this.applicabilityJudge.initialize();
    
    this.vanillaAdapter = new VanillaAdapter({
      resourceManager: this.resourceManager
    });
    await this.vanillaAdapter.initialize();
    
    this.initialized = true;
  }
  
  async retrieveSOPCandidates(goal) {
    const results = await this.sopRegistry.searchSOPs(goal.gloss, {
      topK: 3,
      hybridWeight: 0.6
    });
    
    return results;
  }
  
  async judgeApplicability(sop, goal, context) {
    return await this.applicabilityJudge.judge(sop, goal, context);
  }
  
  async planGoal(goal, context = {}) {
    await this._ensureInitialized();
    
    const startTime = Date.now();
    
    const candidates = await this.retrieveSOPCandidates(goal);
    
    for (const candidate of candidates) {
      const judgment = await this.judgeApplicability(candidate.sop, goal, context);
      
      if (judgment.confidence >= 0.5) {
        const adaptation = await this.sopAdapter.adaptSOPToSubgoals(candidate.sop, goal);
        
        return {
          subgoals: adaptation.subgoals,
          decomp: adaptation.decomp,
          source: 'sop',
          confidence: judgment.confidence,
          metadata: {
            sopUsed: candidate.sop.title,
            applicabilityScore: judgment.confidence,
            planningTime: Date.now() - startTime,
            timestamp: new Date()
          }
        };
      }
    }
    
    const vanillaResult = await this.vanillaAdapter.decomposeGoal(goal);
    
    return {
      subgoals: vanillaResult.subgoals,
      decomp: vanillaResult.decomp,
      source: 'vanilla',
      confidence: vanillaResult.confidence,
      metadata: {
        planningTime: Date.now() - startTime,
        timestamp: new Date()
      }
    };
  }
  
  async healthCheck() {
    await this._ensureInitialized();
    
    const sopHealth = await this.sopRegistry.healthCheck();
    const sopStats = await this.sopRegistry.getStatistics();
    
    return {
      healthy: sopHealth.healthy,
      sopRegistry: {
        available: sopHealth.healthy,
        sopsLoaded: sopStats.sops.total
      },
      applicabilityJudge: {
        available: this.applicabilityJudge.initialized
      },
      vanillaAdapter: {
        available: this.vanillaAdapter.initialized
      }
    };
  }
  
  async _ensureInitialized() {
    if (!this.initialized) {
      await this.initialize();
    }
  }
}