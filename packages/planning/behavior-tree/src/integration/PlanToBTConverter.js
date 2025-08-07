/**
 * PlanToBTConverter - Simple converter from linear plans to BT sequence format
 * 
 * Converts existing plan arrays to BT JSON structure using sequence nodes.
 * This maintains backward compatibility while enabling BT execution.
 */

export class PlanToBTConverter {
  /**
   * Convert linear plan array to BT sequence structure
   * @param {Array} plan - Linear plan array
   * @param {Object} options - Optional conversion options
   * @returns {Object} BT configuration with sequence root
   */
  static convertPlanToBT(plan, options = {}) {
    if (!Array.isArray(plan)) {
      throw new Error('Plan must be an array');
    }

    if (plan.length === 0) {
      return {
        type: 'sequence',
        description: options.description || 'Converted linear plan',
        children: [],
        ...options
      };
    }

    // Convert each plan step to action node
    const children = plan.map((step, index) => ({
      type: 'action',
      id: step.id || `step_${index}`,
      tool: step.tool,
      description: step.description || (step.tool ? `Execute ${step.tool}` : undefined),
      params: step.params || {}
    }));

    return {
      type: 'sequence',
      description: options.description || 'Converted linear plan',
      children,
      ...options
    };
  }

  /**
   * Convert linear plan to selector (fallback) pattern
   * @param {Array} plan - Linear plan array
   * @param {Object} options - Optional conversion options
   * @returns {Object} BT configuration with selector root
   */
  static convertPlanToSelector(plan, options = {}) {
    if (!Array.isArray(plan)) {
      throw new Error('Plan must be an array');
    }

    const children = plan.map((step, index) => ({
      type: 'action',
      id: step.id || `option_${index}`,
      tool: step.tool,
      description: step.description || (step.tool ? `Try ${step.tool}` : undefined),
      params: step.params || {}
    }));

    return {
      type: 'selector',
      description: options.description || 'Converted plan with fallback options',
      children,
      ...options
    };
  }

  /**
   * Convert nested plan structure to BT
   * @param {Array} plan - Plan with nested groups
   * @returns {Object} BT configuration with nested structure
   */
  static convertNestedPlanToBT(plan) {
    if (!Array.isArray(plan)) {
      throw new Error('Plan must be an array');
    }

    const children = plan.map((item, index) => {
      if (item.type === 'group' && item.steps) {
        // Recursively convert nested group
        return {
          type: 'sequence',
          id: item.id || `group_${index}`,
          description: item.description || 'Grouped steps',
          children: item.steps.map((step, stepIndex) => ({
            type: 'action',
            id: step.id || `${item.id || `group_${index}`}_step_${stepIndex}`,
            tool: step.tool,
            description: step.description,
            params: step.params || {}
          }))
        };
      }
      // Regular step
      return {
        type: 'action',
        id: item.id || `step_${index}`,
        tool: item.tool,
        description: item.description,
        params: item.params || {}
      };
    });

    return {
      type: 'sequence',
      description: 'Converted nested plan',
      children
    };
  }

  /**
   * Check if a plan is already in BT format
   * @param {Object|Array} plan - Plan to check
   * @returns {boolean} True if already BT format
   */
  static isBTFormat(plan) {
    return (
      typeof plan === 'object' &&
      !Array.isArray(plan) &&
      plan.type &&
      typeof plan.type === 'string'
    );
  }

  /**
   * Convert plan to BT format if needed
   * @param {Object|Array} plan - Plan in any format
   * @returns {Object} BT-format plan
   */
  static ensureBTFormat(plan) {
    if (this.isBTFormat(plan)) {
      return plan;
    }

    if (Array.isArray(plan)) {
      return this.convertPlanToBT(plan);
    }

    throw new Error('Plan must be array or BT object');
  }

  /**
   * Convert BT back to linear plan (for backward compatibility)
   * @param {Object} btPlan - BT plan structure  
   * @returns {Array} Linear plan array
   */
  static convertBTToPlan(btPlan) {
    if (Array.isArray(btPlan)) {
      return btPlan; // Already linear
    }

    if (!this.isBTFormat(btPlan)) {
      throw new Error('Invalid BT plan format');
    }

    // For now, only handle sequence nodes at root
    if (btPlan.type === 'sequence' && btPlan.children) {
      return btPlan.children
        .filter(child => child.type === 'action')
        .map(child => ({
          id: child.id,
          tool: child.tool,
          description: child.description,
          params: child.params
        }));
    }

    if (btPlan.type === 'action') {
      return [{
        id: btPlan.id || 'single_step',
        tool: btPlan.tool,
        description: btPlan.description,
        params: btPlan.params
      }];
    }

    // For complex BT structures, return simplified representation
    return [{
      id: 'complex_bt',
      tool: 'BT_EXECUTION', 
      description: 'Complex behavior tree execution',
      params: { btStructure: btPlan }
    }];
  }
}