/**
 * Unit tests for MongoDB schema operations
 * Tests plan and execution document operations with mocked MongoDB
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { PlanSchema, ExecutionSchema, TemplateSchema } from '../../schemas/MongoDBSchemas.js';

describe('MongoDB Schemas', () => {
  let mockCollection;
  let mockDb;

  beforeEach(() => {
    mockCollection = {
      insertOne: jest.fn(),
      findOne: jest.fn(),
      updateOne: jest.fn(),
      deleteOne: jest.fn(),
      find: jest.fn(),
      createIndex: jest.fn(),
      countDocuments: jest.fn()
    };

    mockDb = {
      collection: jest.fn().mockReturnValue(mockCollection)
    };
  });

  describe('PlanSchema', () => {
    let planSchema;

    beforeEach(() => {
      planSchema = new PlanSchema(mockDb);
    });

    describe('validation', () => {
      it('should validate a valid plan document', () => {
        const validPlan = {
          name: 'Test Plan',
          goal: 'Build application',
          hierarchy: {
            root: {
              id: 'root',
              description: 'Build application',
              complexity: 'COMPLEX',
              children: []
            }
          },
          validation: {
            valid: true,
            feasibility: { overallFeasible: true }
          },
          metadata: {
            createdAt: new Date(),
            createdBy: 'user123'
          }
        };

        const result = planSchema.validate(validPlan);
        expect(result.valid).toBe(true);
        expect(result.errors).toEqual([]);
      });

      it('should reject plan without required fields', () => {
        const invalidPlan = {
          name: 'Test Plan'
          // Missing goal and hierarchy
        };

        const result = planSchema.validate(invalidPlan);
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('Missing required field: goal');
        expect(result.errors).toContain('Missing required field: hierarchy');
      });

      it('should reject plan with invalid complexity value', () => {
        const invalidPlan = {
          name: 'Test Plan',
          goal: 'Build app',
          hierarchy: {
            root: {
              id: 'root',
              description: 'Build app',
              complexity: 'INVALID_VALUE'
            }
          }
        };

        const result = planSchema.validate(invalidPlan);
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('Invalid complexity value: INVALID_VALUE');
      });
    });

    describe('CRUD operations', () => {
      it('should create a new plan', async () => {
        const plan = {
          name: 'New Plan',
          goal: 'Test goal',
          hierarchy: { root: {} }
        };

        mockCollection.insertOne.mockResolvedValue({ insertedId: 'plan123' });

        const result = await planSchema.create(plan);
        
        expect(mockDb.collection).toHaveBeenCalledWith('plans');
        expect(mockCollection.insertOne).toHaveBeenCalledWith(
          expect.objectContaining({
            name: 'New Plan',
            goal: 'Test goal',
            metadata: expect.objectContaining({
              createdAt: expect.any(Date),
              updatedAt: expect.any(Date)
            })
          })
        );
        expect(result).toBe('plan123');
      });

      it('should find a plan by ID', async () => {
        const storedPlan = {
          _id: 'plan123',
          name: 'Stored Plan',
          goal: 'Stored goal'
        };

        mockCollection.findOne.mockResolvedValue(storedPlan);

        const result = await planSchema.findById('plan123');
        
        expect(mockCollection.findOne).toHaveBeenCalledWith({ _id: 'plan123' });
        expect(result).toEqual(storedPlan);
      });

      it('should update a plan', async () => {
        mockCollection.updateOne.mockResolvedValue({ modifiedCount: 1 });

        const updates = {
          name: 'Updated Name',
          'validation.valid': true
        };

        const result = await planSchema.update('plan123', updates);
        
        expect(mockCollection.updateOne).toHaveBeenCalledWith(
          { _id: 'plan123' },
          {
            $set: expect.objectContaining({
              name: 'Updated Name',
              'validation.valid': true,
              'metadata.updatedAt': expect.any(Date)
            })
          }
        );
        expect(result).toBe(true);
      });

      it('should delete a plan', async () => {
        mockCollection.deleteOne.mockResolvedValue({ deletedCount: 1 });

        const result = await planSchema.delete('plan123');
        
        expect(mockCollection.deleteOne).toHaveBeenCalledWith({ _id: 'plan123' });
        expect(result).toBe(true);
      });

      it('should list plans with filters', async () => {
        const plans = [
          { _id: '1', name: 'Plan 1' },
          { _id: '2', name: 'Plan 2' }
        ];

        mockCollection.find.mockReturnValue({
          sort: jest.fn().mockReturnValue({
            limit: jest.fn().mockReturnValue({
              toArray: jest.fn().mockResolvedValue(plans)
            })
          })
        });

        const result = await planSchema.list({ 
          filter: { 'metadata.createdBy': 'user123' },
          sort: { 'metadata.createdAt': -1 },
          limit: 10
        });
        
        expect(mockCollection.find).toHaveBeenCalledWith({ 'metadata.createdBy': 'user123' });
        expect(result).toEqual(plans);
      });
    });

    describe('indexes', () => {
      it('should create required indexes', async () => {
        await planSchema.createIndexes();
        
        expect(mockCollection.createIndex).toHaveBeenCalledWith(
          { 'metadata.createdAt': -1 }
        );
        expect(mockCollection.createIndex).toHaveBeenCalledWith(
          { 'metadata.tags': 1 }
        );
        expect(mockCollection.createIndex).toHaveBeenCalledWith(
          { goal: 'text', name: 'text' }
        );
      });
    });
  });

  describe('ExecutionSchema', () => {
    let executionSchema;

    beforeEach(() => {
      executionSchema = new ExecutionSchema(mockDb);
    });

    describe('validation', () => {
      it('should validate a valid execution document', () => {
        const validExecution = {
          executionId: 'exec123',
          planId: 'plan123',
          status: 'running',
          startTime: new Date(),
          progress: {
            totalTasks: 10,
            completedTasks: 5,
            currentTask: 'task5'
          }
        };

        const result = executionSchema.validate(validExecution);
        expect(result.valid).toBe(true);
        expect(result.errors).toEqual([]);
      });

      it('should reject execution with invalid status', () => {
        const invalidExecution = {
          executionId: 'exec123',
          planId: 'plan123',
          status: 'invalid_status'
        };

        const result = executionSchema.validate(invalidExecution);
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('Invalid status: invalid_status');
      });

      it('should reject execution without required fields', () => {
        const invalidExecution = {
          status: 'running'
          // Missing executionId and planId
        };

        const result = executionSchema.validate(invalidExecution);
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('Missing required field: executionId');
        expect(result.errors).toContain('Missing required field: planId');
      });
    });

    describe('CRUD operations', () => {
      it('should create execution record', async () => {
        const execution = {
          executionId: 'exec123',
          planId: 'plan123',
          status: 'running'
        };

        mockCollection.insertOne.mockResolvedValue({ insertedId: 'record123' });

        const result = await executionSchema.create(execution);
        
        expect(mockDb.collection).toHaveBeenCalledWith('plan_executions');
        expect(mockCollection.insertOne).toHaveBeenCalledWith(
          expect.objectContaining({
            executionId: 'exec123',
            planId: 'plan123',
            status: 'running',
            startTime: expect.any(Date)
          })
        );
        expect(result).toBe('record123');
      });

      it('should find execution by ID', async () => {
        const execution = {
          _id: 'record123',
          executionId: 'exec123',
          status: 'completed'
        };

        mockCollection.findOne.mockResolvedValue(execution);

        const result = await executionSchema.findByExecutionId('exec123');
        
        expect(mockCollection.findOne).toHaveBeenCalledWith({ executionId: 'exec123' });
        expect(result).toEqual(execution);
      });

      it('should update execution status', async () => {
        mockCollection.updateOne.mockResolvedValue({ modifiedCount: 1 });

        const result = await executionSchema.updateStatus('exec123', 'completed', {
          endTime: new Date(),
          results: { success: true }
        });
        
        expect(mockCollection.updateOne).toHaveBeenCalledWith(
          { executionId: 'exec123' },
          {
            $set: expect.objectContaining({
              status: 'completed',
              endTime: expect.any(Date),
              results: { success: true }
            })
          }
        );
        expect(result).toBe(true);
      });

      it('should list executions by plan', async () => {
        const executions = [
          { executionId: 'exec1', status: 'completed' },
          { executionId: 'exec2', status: 'failed' }
        ];

        mockCollection.find.mockReturnValue({
          sort: jest.fn().mockReturnValue({
            limit: jest.fn().mockReturnValue({
              toArray: jest.fn().mockResolvedValue(executions)
            })
          })
        });

        const result = await executionSchema.listByPlan('plan123', 10);
        
        expect(mockCollection.find).toHaveBeenCalledWith({ planId: 'plan123' });
        expect(result).toEqual(executions);
      });
    });

    describe('indexes', () => {
      it('should create required indexes', async () => {
        await executionSchema.createIndexes();
        
        expect(mockCollection.createIndex).toHaveBeenCalledWith(
          { planId: 1, startTime: -1 }
        );
        expect(mockCollection.createIndex).toHaveBeenCalledWith(
          { executionId: 1 },
          { unique: true }
        );
        expect(mockCollection.createIndex).toHaveBeenCalledWith(
          { status: 1, startTime: -1 }
        );
      });
    });
  });

  describe('TemplateSchema', () => {
    let templateSchema;

    beforeEach(() => {
      templateSchema = new TemplateSchema(mockDb);
    });

    describe('validation', () => {
      it('should validate a valid template document', () => {
        const validTemplate = {
          name: 'Web App Template',
          description: 'Template for web applications',
          category: 'web',
          goalTemplate: 'Build a {type} web application with {features}',
          parameters: [
            { name: 'type', type: 'string', required: true },
            { name: 'features', type: 'array', required: false }
          ]
        };

        const result = templateSchema.validate(validTemplate);
        expect(result.valid).toBe(true);
        expect(result.errors).toEqual([]);
      });

      it('should reject template without required fields', () => {
        const invalidTemplate = {
          description: 'Some template'
          // Missing name and goalTemplate
        };

        const result = templateSchema.validate(invalidTemplate);
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('Missing required field: name');
        expect(result.errors).toContain('Missing required field: goalTemplate');
      });
    });

    describe('CRUD operations', () => {
      it('should create template', async () => {
        const template = {
          name: 'API Template',
          goalTemplate: 'Create REST API for {resource}',
          category: 'backend'
        };

        mockCollection.insertOne.mockResolvedValue({ insertedId: 'template123' });

        const result = await templateSchema.create(template);
        
        expect(mockDb.collection).toHaveBeenCalledWith('plan_templates');
        expect(mockCollection.insertOne).toHaveBeenCalledWith(
          expect.objectContaining({
            name: 'API Template',
            metadata: expect.objectContaining({
              createdAt: expect.any(Date)
            })
          })
        );
        expect(result).toBe('template123');
      });

      it('should list templates by category', async () => {
        const templates = [
          { name: 'Template 1', category: 'web' },
          { name: 'Template 2', category: 'web' }
        ];

        mockCollection.find.mockReturnValue({
          sort: jest.fn().mockReturnValue({
            toArray: jest.fn().mockResolvedValue(templates)
          })
        });

        const result = await templateSchema.listByCategory('web');
        
        expect(mockCollection.find).toHaveBeenCalledWith({ category: 'web' });
        expect(result).toEqual(templates);
      });

      it('should apply template parameters', () => {
        const template = {
          goalTemplate: 'Build a {type} application with {feature1} and {feature2}',
          parameters: [
            { name: 'type', type: 'string' },
            { name: 'feature1', type: 'string' },
            { name: 'feature2', type: 'string' }
          ]
        };

        const params = {
          type: 'web',
          feature1: 'authentication',
          feature2: 'database'
        };

        const result = templateSchema.applyParameters(template, params);
        
        expect(result).toBe('Build a web application with authentication and database');
      });
    });

    describe('indexes', () => {
      it('should create required indexes', async () => {
        await templateSchema.createIndexes();
        
        expect(mockCollection.createIndex).toHaveBeenCalledWith(
          { category: 1 }
        );
        expect(mockCollection.createIndex).toHaveBeenCalledWith(
          { name: 'text', description: 'text' }
        );
      });
    });
  });
});