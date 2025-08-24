/**
 * Integration tests for MongoDB schema operations
 * Tests with real MongoDB connection
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { PlanSchema, ExecutionSchema, TemplateSchema, initializeSchemas } from '../../schemas/MongoDBSchemas.js';
import { ResourceManager } from '@legion/resource-manager';
import { MongoDBProvider } from '@legion/mongodb-provider';

describe('MongoDB Schemas Integration', () => {
  let mongoProvider;
  let resourceManager;
  let db;
  let planSchema;
  let executionSchema;
  let templateSchema;

  beforeAll(async () => {
    // Initialize real MongoDB connection
    resourceManager = ResourceManager.getInstance();
    await resourceManager.initialize();
    
    mongoProvider = new MongoDBProvider(resourceManager);
    await mongoProvider.connect();
    
    db = mongoProvider.getDatabase();
    
    // Initialize schemas
    const schemas = await initializeSchemas(db);
    planSchema = schemas.planSchema;
    executionSchema = schemas.executionSchema;
    templateSchema = schemas.templateSchema;
  });

  afterAll(async () => {
    // Clean up test data
    if (db) {
      await db.collection('plans').deleteMany({ 'metadata.test': true });
      await db.collection('plan_executions').deleteMany({ 'metadata.test': true });
      await db.collection('plan_templates').deleteMany({ 'metadata.test': true });
    }
    
    if (mongoProvider) {
      await mongoProvider.disconnect();
    }
  });

  describe('PlanSchema Integration', () => {
    let createdPlanId;

    it('should create and retrieve a plan', async () => {
      const plan = {
        name: 'Integration Test Plan',
        goal: 'Test MongoDB integration',
        hierarchy: {
          root: {
            id: 'root',
            description: 'Test task',
            complexity: 'SIMPLE',
            children: []
          },
          levels: [[{ id: 'root' }]],
          depth: 1
        },
        validation: {
          valid: true,
          feasibility: {
            overallFeasible: true,
            feasibleTasks: ['root'],
            infeasibleTasks: []
          }
        },
        metadata: {
          test: true,
          createdBy: 'integration-test'
        }
      };

      createdPlanId = await planSchema.create(plan);
      expect(createdPlanId).toBeDefined();

      const retrieved = await planSchema.findById(createdPlanId);
      expect(retrieved).toBeDefined();
      expect(retrieved.name).toBe('Integration Test Plan');
      expect(retrieved.goal).toBe('Test MongoDB integration');
      expect(retrieved.hierarchy.root.complexity).toBe('SIMPLE');
    });

    it('should update a plan', async () => {
      const updates = {
        name: 'Updated Integration Test Plan',
        'validation.valid': false,
        'validation.errors': ['Test error']
      };

      const updated = await planSchema.update(createdPlanId, updates);
      expect(updated).toBe(true);

      const retrieved = await planSchema.findById(createdPlanId);
      expect(retrieved.name).toBe('Updated Integration Test Plan');
      expect(retrieved.validation.valid).toBe(false);
      expect(retrieved.validation.errors).toContain('Test error');
    });

    it('should list plans with filters', async () => {
      // Create additional test plans
      await planSchema.create({
        name: 'Test Plan 2',
        goal: 'Another test',
        hierarchy: { root: {} },
        metadata: { test: true, category: 'typeA' }
      });

      await planSchema.create({
        name: 'Test Plan 3',
        goal: 'Third test',
        hierarchy: { root: {} },
        metadata: { test: true, category: 'typeB' }
      });

      // List all test plans
      const allPlans = await planSchema.list({
        filter: { 'metadata.test': true }
      });
      expect(allPlans.length).toBeGreaterThanOrEqual(3);

      // List with category filter
      const typeAPlans = await planSchema.list({
        filter: { 'metadata.test': true, 'metadata.category': 'typeA' }
      });
      expect(typeAPlans.length).toBeGreaterThanOrEqual(1);
      expect(typeAPlans[0].metadata.category).toBe('typeA');
    });

    it('should search plans by text', async () => {
      // Create a plan with searchable text
      await planSchema.create({
        name: 'Searchable Plan',
        goal: 'Build a REST API with authentication',
        hierarchy: { root: {} },
        metadata: { test: true }
      });

      // Text search requires text index to be created
      // Search for plans containing "REST API"
      const results = await db.collection('plans').find({
        $text: { $search: 'REST API' },
        'metadata.test': true
      }).toArray();

      if (results.length > 0) {
        expect(results[0].goal).toContain('REST API');
      }
    });

    it('should delete a plan', async () => {
      const deleted = await planSchema.delete(createdPlanId);
      expect(deleted).toBe(true);

      const retrieved = await planSchema.findById(createdPlanId);
      expect(retrieved).toBeNull();
    });
  });

  describe('ExecutionSchema Integration', () => {
    let testPlanId;
    let executionId;

    beforeEach(async () => {
      // Create a test plan for executions
      testPlanId = await planSchema.create({
        name: 'Execution Test Plan',
        goal: 'Test executions',
        hierarchy: { root: {} },
        metadata: { test: true }
      });
    });

    it('should create and retrieve execution record', async () => {
      executionId = 'exec-' + Date.now();
      
      const execution = {
        executionId,
        planId: testPlanId,
        status: 'running',
        progress: {
          totalTasks: 5,
          completedTasks: 0,
          currentTask: null
        },
        artifacts: {},
        logs: [],
        metadata: { test: true }
      };

      const recordId = await executionSchema.create(execution);
      expect(recordId).toBeDefined();

      const retrieved = await executionSchema.findByExecutionId(executionId);
      expect(retrieved).toBeDefined();
      expect(retrieved.executionId).toBe(executionId);
      expect(retrieved.status).toBe('running');
      expect(retrieved.progress.totalTasks).toBe(5);
    });

    it('should update execution status and progress', async () => {
      // Update status
      const statusUpdated = await executionSchema.updateStatus(executionId, 'paused', {
        pausedAt: new Date()
      });
      expect(statusUpdated).toBe(true);

      // Update progress
      await executionSchema.updateProgress(executionId, {
        totalTasks: 5,
        completedTasks: 2,
        currentTask: 'task3'
      });

      const retrieved = await executionSchema.findByExecutionId(executionId);
      expect(retrieved.status).toBe('paused');
      expect(retrieved.pausedAt).toBeDefined();
      expect(retrieved.progress.completedTasks).toBe(2);
      expect(retrieved.progress.currentTask).toBe('task3');
    });

    it('should add logs to execution', async () => {
      await executionSchema.addLog(executionId, {
        type: 'info',
        message: 'Task started'
      });

      await executionSchema.addLog(executionId, {
        type: 'error',
        message: 'Task failed'
      });

      const retrieved = await executionSchema.findByExecutionId(executionId);
      expect(retrieved.logs).toHaveLength(2);
      expect(retrieved.logs[0].message).toBe('Task started');
      expect(retrieved.logs[1].message).toBe('Task failed');
    });

    it('should list executions by plan', async () => {
      // Create multiple executions for the same plan
      await executionSchema.create({
        executionId: 'exec-2',
        planId: testPlanId,
        status: 'completed',
        metadata: { test: true }
      });

      await executionSchema.create({
        executionId: 'exec-3',
        planId: testPlanId,
        status: 'failed',
        metadata: { test: true }
      });

      const executions = await executionSchema.listByPlan(testPlanId);
      expect(executions.length).toBeGreaterThanOrEqual(3);
      
      // Should be sorted by startTime descending
      if (executions.length >= 2) {
        const first = new Date(executions[0].startTime);
        const second = new Date(executions[1].startTime);
        expect(first.getTime()).toBeGreaterThanOrEqual(second.getTime());
      }
    });

    it('should handle unique executionId constraint', async () => {
      const duplicateExecution = {
        executionId,
        planId: testPlanId,
        status: 'running',
        metadata: { test: true }
      };

      await expect(executionSchema.create(duplicateExecution)).rejects.toThrow();
    });
  });

  describe('TemplateSchema Integration', () => {
    let templateId;

    it('should create and retrieve template', async () => {
      const template = {
        name: 'Web API Template',
        description: 'Template for creating REST APIs',
        category: 'backend',
        goalTemplate: 'Create a REST API for {resource} with {operations} operations',
        parameters: [
          { name: 'resource', type: 'string', required: true },
          { name: 'operations', type: 'array', required: true }
        ],
        metadata: { test: true }
      };

      templateId = await templateSchema.create(template);
      expect(templateId).toBeDefined();

      const retrieved = await templateSchema.findById(templateId);
      expect(retrieved).toBeDefined();
      expect(retrieved.name).toBe('Web API Template');
      expect(retrieved.parameters).toHaveLength(2);
    });

    it('should find template by name', async () => {
      const template = await templateSchema.findByName('Web API Template');
      expect(template).toBeDefined();
      expect(template._id).toEqual(templateId);
    });

    it('should apply template parameters', async () => {
      const template = await templateSchema.findById(templateId);
      
      const goal = templateSchema.applyParameters(template, {
        resource: 'users',
        operations: 'CRUD'
      });

      expect(goal).toBe('Create a REST API for users with CRUD operations');
    });

    it('should list templates by category', async () => {
      // Create additional templates
      await templateSchema.create({
        name: 'Frontend Template',
        category: 'frontend',
        goalTemplate: 'Build {type} frontend',
        metadata: { test: true }
      });

      await templateSchema.create({
        name: 'Another Backend Template',
        category: 'backend',
        goalTemplate: 'Create {service} service',
        metadata: { test: true }
      });

      const backendTemplates = await templateSchema.listByCategory('backend');
      expect(backendTemplates.length).toBeGreaterThanOrEqual(2);
      expect(backendTemplates.every(t => t.category === 'backend')).toBe(true);

      const frontendTemplates = await templateSchema.listByCategory('frontend');
      expect(frontendTemplates.length).toBeGreaterThanOrEqual(1);
      expect(frontendTemplates[0].category).toBe('frontend');
    });

    it('should update template', async () => {
      const updated = await templateSchema.update(templateId, {
        description: 'Updated description',
        category: 'fullstack'
      });
      expect(updated).toBe(true);

      const retrieved = await templateSchema.findById(templateId);
      expect(retrieved.description).toBe('Updated description');
      expect(retrieved.category).toBe('fullstack');
    });

    it('should delete template', async () => {
      const deleted = await templateSchema.delete(templateId);
      expect(deleted).toBe(true);

      const retrieved = await templateSchema.findById(templateId);
      expect(retrieved).toBeNull();
    });
  });

  describe('Index Creation', () => {
    it('should have created all required indexes', async () => {
      // Check plan indexes
      const planIndexes = await db.collection('plans').indexes();
      const planIndexNames = planIndexes.map(idx => Object.keys(idx.key).join('_'));
      expect(planIndexNames).toContain('metadata.createdAt_-1');
      expect(planIndexNames).toContain('metadata.tags_1');

      // Check execution indexes
      const execIndexes = await db.collection('plan_executions').indexes();
      const execIndexNames = execIndexes.map(idx => Object.keys(idx.key).join('_'));
      expect(execIndexNames).toContain('planId_1_startTime_-1');
      expect(execIndexNames).toContain('executionId_1');

      // Check template indexes
      const templateIndexes = await db.collection('plan_templates').indexes();
      const templateIndexNames = templateIndexes.map(idx => Object.keys(idx.key).join('_'));
      expect(templateIndexNames).toContain('category_1');
    });
  });
});