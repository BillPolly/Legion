/**
 * MongoDB schema definitions and operations for planning interface
 * Provides validation, CRUD operations, and index management
 */

export class PlanSchema {
  constructor(db) {
    if (!db) {
      throw new Error('Database connection is required');
    }
    this.db = db;
    this.collection = db.collection('plans');
  }

  /**
   * Validate a plan document
   */
  validate(plan) {
    const errors = [];
    
    // Required fields
    if (!plan.goal) {
      errors.push('Missing required field: goal');
    }
    if (!plan.hierarchy) {
      errors.push('Missing required field: hierarchy');
    }
    
    // Validate complexity values if present
    if (plan.hierarchy?.root?.complexity) {
      const validComplexities = ['SIMPLE', 'COMPLEX'];
      if (!validComplexities.includes(plan.hierarchy.root.complexity)) {
        errors.push(`Invalid complexity value: ${plan.hierarchy.root.complexity}`);
      }
    }
    
    // Validate nested task nodes
    if (plan.hierarchy?.root) {
      this.validateTaskNode(plan.hierarchy.root, errors);
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }

  validateTaskNode(node, errors) {
    if (node.complexity && !['SIMPLE', 'COMPLEX'].includes(node.complexity)) {
      errors.push(`Invalid complexity value: ${node.complexity}`);
    }
    
    if (node.children) {
      node.children.forEach(child => this.validateTaskNode(child, errors));
    }
  }

  /**
   * Create a new plan
   */
  async create(plan) {
    const validation = this.validate(plan);
    if (!validation.valid) {
      throw new Error(`Invalid plan: ${validation.errors.join(', ')}`);
    }
    
    const document = {
      ...plan,
      metadata: {
        ...plan.metadata,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    };
    
    const result = await this.collection.insertOne(document);
    return result.insertedId;
  }

  /**
   * Find a plan by ID
   */
  async findById(id) {
    return await this.collection.findOne({ _id: id });
  }

  /**
   * Update a plan
   */
  async update(id, updates) {
    const updateDoc = {
      $set: {
        ...updates,
        'metadata.updatedAt': new Date()
      }
    };
    
    const result = await this.collection.updateOne(
      { _id: id },
      updateDoc
    );
    
    return result.modifiedCount > 0;
  }

  /**
   * Delete a plan
   */
  async delete(id) {
    const result = await this.collection.deleteOne({ _id: id });
    return result.deletedCount > 0;
  }

  /**
   * List plans with optional filters
   */
  async list(options = {}) {
    const { filter = {}, sort = { 'metadata.createdAt': -1 }, limit = 50 } = options;
    
    return await this.collection
      .find(filter)
      .sort(sort)
      .limit(limit)
      .toArray();
  }

  /**
   * Create indexes for efficient querying
   */
  async createIndexes() {
    await this.collection.createIndex({ 'metadata.createdAt': -1 });
    await this.collection.createIndex({ 'metadata.tags': 1 });
    await this.collection.createIndex({ goal: 'text', name: 'text' });
  }
}

export class ExecutionSchema {
  constructor(db) {
    if (!db) {
      throw new Error('Database connection is required');
    }
    this.db = db;
    this.collection = db.collection('plan_executions');
  }

  /**
   * Validate an execution document
   */
  validate(execution) {
    const errors = [];
    
    // Required fields
    if (!execution.executionId) {
      errors.push('Missing required field: executionId');
    }
    if (!execution.planId) {
      errors.push('Missing required field: planId');
    }
    
    // Validate status
    if (execution.status) {
      const validStatuses = ['running', 'paused', 'completed', 'failed', 'stopped'];
      if (!validStatuses.includes(execution.status)) {
        errors.push(`Invalid status: ${execution.status}`);
      }
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Create a new execution record
   */
  async create(execution) {
    const validation = this.validate(execution);
    if (!validation.valid) {
      throw new Error(`Invalid execution: ${validation.errors.join(', ')}`);
    }
    
    const document = {
      ...execution,
      startTime: execution.startTime || new Date()
    };
    
    const result = await this.collection.insertOne(document);
    return result.insertedId;
  }

  /**
   * Find execution by execution ID
   */
  async findByExecutionId(executionId) {
    return await this.collection.findOne({ executionId });
  }

  /**
   * Update execution status
   */
  async updateStatus(executionId, status, additionalData = {}) {
    const updateDoc = {
      $set: {
        status,
        ...additionalData
      }
    };
    
    const result = await this.collection.updateOne(
      { executionId },
      updateDoc
    );
    
    return result.modifiedCount > 0;
  }

  /**
   * List executions for a plan
   */
  async listByPlan(planId, limit = 50) {
    return await this.collection
      .find({ planId })
      .sort({ startTime: -1 })
      .limit(limit)
      .toArray();
  }

  /**
   * List all executions with filters
   */
  async list(options = {}) {
    const { filter = {}, sort = { startTime: -1 }, limit = 50 } = options;
    
    return await this.collection
      .find(filter)
      .sort(sort)
      .limit(limit)
      .toArray();
  }

  /**
   * Update execution progress
   */
  async updateProgress(executionId, progress) {
    return await this.collection.updateOne(
      { executionId },
      {
        $set: {
          progress,
          lastUpdated: new Date()
        }
      }
    );
  }

  /**
   * Add log entry to execution
   */
  async addLog(executionId, logEntry) {
    return await this.collection.updateOne(
      { executionId },
      {
        $push: {
          logs: {
            ...logEntry,
            timestamp: new Date()
          }
        }
      }
    );
  }

  /**
   * Create indexes for efficient querying
   */
  async createIndexes() {
    await this.collection.createIndex({ planId: 1, startTime: -1 });
    await this.collection.createIndex({ executionId: 1 }, { unique: true });
    await this.collection.createIndex({ status: 1, startTime: -1 });
  }
}

export class TemplateSchema {
  constructor(db) {
    if (!db) {
      throw new Error('Database connection is required');
    }
    this.db = db;
    this.collection = db.collection('plan_templates');
  }

  /**
   * Validate a template document
   */
  validate(template) {
    const errors = [];
    
    // Required fields
    if (!template.name) {
      errors.push('Missing required field: name');
    }
    if (!template.goalTemplate) {
      errors.push('Missing required field: goalTemplate');
    }
    
    // Validate parameters if present
    if (template.parameters) {
      template.parameters.forEach((param, index) => {
        if (!param.name) {
          errors.push(`Parameter ${index} missing name`);
        }
        if (!param.type) {
          errors.push(`Parameter ${index} missing type`);
        }
      });
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Create a new template
   */
  async create(template) {
    const validation = this.validate(template);
    if (!validation.valid) {
      throw new Error(`Invalid template: ${validation.errors.join(', ')}`);
    }
    
    const document = {
      ...template,
      metadata: {
        ...template.metadata,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    };
    
    const result = await this.collection.insertOne(document);
    return result.insertedId;
  }

  /**
   * Find template by ID
   */
  async findById(id) {
    return await this.collection.findOne({ _id: id });
  }

  /**
   * Find template by name
   */
  async findByName(name) {
    return await this.collection.findOne({ name });
  }

  /**
   * Update a template
   */
  async update(id, updates) {
    const updateDoc = {
      $set: {
        ...updates,
        'metadata.updatedAt': new Date()
      }
    };
    
    const result = await this.collection.updateOne(
      { _id: id },
      updateDoc
    );
    
    return result.modifiedCount > 0;
  }

  /**
   * Delete a template
   */
  async delete(id) {
    const result = await this.collection.deleteOne({ _id: id });
    return result.deletedCount > 0;
  }

  /**
   * List templates by category
   */
  async listByCategory(category) {
    return await this.collection
      .find({ category })
      .sort({ name: 1 })
      .toArray();
  }

  /**
   * List all templates
   */
  async list(options = {}) {
    const { filter = {}, sort = { name: 1 }, limit = 100 } = options;
    
    return await this.collection
      .find(filter)
      .sort(sort)
      .limit(limit)
      .toArray();
  }

  /**
   * Apply parameters to a template
   */
  applyParameters(template, parameters) {
    let goal = template.goalTemplate;
    
    Object.entries(parameters).forEach(([key, value]) => {
      const placeholder = `{${key}}`;
      goal = goal.replace(new RegExp(placeholder, 'g'), value);
    });
    
    return goal;
  }

  /**
   * Create indexes for efficient querying
   */
  async createIndexes() {
    await this.collection.createIndex({ category: 1 });
    await this.collection.createIndex({ name: 'text', description: 'text' });
  }
}

/**
 * Initialize all schemas and create indexes
 */
export async function initializeSchemas(db) {
  const planSchema = new PlanSchema(db);
  const executionSchema = new ExecutionSchema(db);
  const templateSchema = new TemplateSchema(db);
  
  // Create indexes
  await Promise.all([
    planSchema.createIndexes(),
    executionSchema.createIndexes(),
    templateSchema.createIndexes()
  ]);
  
  return {
    planSchema,
    executionSchema,
    templateSchema
  };
}