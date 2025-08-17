/**
 * SyntheticTool - Represents a Behavior Tree wrapped as a tool
 */

export class SyntheticTool {
  constructor(config) {
    // Validate required fields
    if (!config.name) {
      throw new Error('name is required');
    }
    if (!config.description) {
      throw new Error('description is required');
    }
    if (!config.executionPlan) {
      throw new Error('executionPlan is required');
    }

    // Core fields
    this.id = config.id || `synthetic_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.name = config.name;
    this.description = config.description;
    this.type = 'synthetic'; // Always synthetic
    
    // Schemas
    this.inputSchema = config.inputSchema || {};
    this.outputSchema = config.outputSchema || {};
    
    // Execution plan (the BT this tool wraps)
    this.executionPlan = config.executionPlan;
    
    // Metadata
    this.metadata = {
      createdAt: Date.now(),
      ...config.metadata
    };
  }

  /**
   * Validate the synthetic tool structure
   */
  validate() {
    const errors = [];
    
    // Validate execution plan
    if (!this.executionPlan.type) {
      errors.push('Execution plan missing type');
    }
    
    // Validate schemas
    const validTypes = ['string', 'number', 'boolean', 'object', 'array'];
    
    Object.entries(this.inputSchema).forEach(([key, schema]) => {
      if (schema.type && !validTypes.includes(schema.type)) {
        errors.push(`Invalid type '${schema.type}' for input '${key}'`);
      }
    });
    
    Object.entries(this.outputSchema).forEach(([key, schema]) => {
      if (schema.type && !validTypes.includes(schema.type)) {
        errors.push(`Invalid type '${schema.type}' for output '${key}'`);
      }
    });
    
    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Get tool interface (compatible with real tools)
   */
  getInterface() {
    return {
      name: this.name,
      description: this.description,
      inputSchema: this.inputSchema,
      outputSchema: this.outputSchema,
      type: this.type
    };
  }

  /**
   * Clone the synthetic tool
   */
  clone() {
    return new SyntheticTool({
      name: this.name,
      description: this.description,
      inputSchema: { ...this.inputSchema },
      outputSchema: { ...this.outputSchema },
      executionPlan: JSON.parse(JSON.stringify(this.executionPlan)),
      metadata: { ...this.metadata }
    });
  }

  /**
   * JSON representation
   */
  toJSON() {
    return {
      id: this.id,
      name: this.name,
      description: this.description,
      type: this.type,
      inputSchema: this.inputSchema,
      outputSchema: this.outputSchema,
      executionPlan: this.executionPlan,
      metadata: this.metadata
    };
  }
}