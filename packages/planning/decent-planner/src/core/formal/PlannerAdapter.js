/**
 * PlannerAdapter - Adapts the real Planner to work with LevelProcessor
 * 
 * The real Planner returns { success, data, error } 
 * but LevelProcessor expects makePlan to return the BT directly
 */

export class PlannerAdapter {
  constructor(realPlanner) {
    this.realPlanner = realPlanner;
  }

  /**
   * Adapt makePlan to return BT directly or throw error
   */
  async makePlan(requirements, tools, options = {}) {
    // Call real planner
    const result = await this.realPlanner.makePlan(requirements, tools, options);
    
    if (!result.success) {
      throw new Error(result.error || 'Plan generation failed');
    }
    
    // Extract the BT from the result
    // The real planner returns { success, data: { plan, attempts, nodeCount } }
    const behaviorTree = result.data?.plan || result.data;
    
    if (!behaviorTree) {
      throw new Error('No behavior tree generated');
    }
    
    return behaviorTree;
  }
}