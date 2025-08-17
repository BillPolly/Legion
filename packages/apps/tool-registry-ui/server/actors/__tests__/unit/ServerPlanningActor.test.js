/**
 * Unit tests for ServerPlanningActor
 * Tests message handling and DecentPlanner integration with mocked dependencies
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { ServerPlanningActor } from '../../ServerPlanningActor.js';

describe('ServerPlanningActor', () => {
  let actor;
  let mockDecentPlanner;
  let mockMongoProvider;
  let mockRemoteActor;

  beforeEach(() => {
    // Mock DecentPlanner
    mockDecentPlanner = {
      plan: jest.fn(),
      validatePlan: jest.fn(),
      getOptions: jest.fn().mockReturnValue({
        maxDepth: 5,
        confidenceThreshold: 0.7
      })
    };

    // Mock MongoDB provider
    mockMongoProvider = {
      getCollection: jest.fn().mockReturnValue({
        insertOne: jest.fn(),
        findOne: jest.fn(),
        updateOne: jest.fn(),
        find: jest.fn().mockReturnValue({
          toArray: jest.fn()
        })
      })
    };

    // Mock remote actor for responses
    mockRemoteActor = {
      send: jest.fn()
    };

    actor = new ServerPlanningActor(mockDecentPlanner, mockMongoProvider);
    actor.setRemoteActor(mockRemoteActor);
  });

  describe('initialization', () => {
    it('should initialize with DecentPlanner and MongoDB provider', () => {
      expect(actor.decentPlanner).toBe(mockDecentPlanner);
      expect(actor.mongoProvider).toBe(mockMongoProvider);
    });

    it('should set remote actor', () => {
      expect(actor.remoteActor).toBe(mockRemoteActor);
    });
  });

  describe('plan:create message', () => {
    it('should handle plan creation request', async () => {
      const planResult = {
        goal: 'Build web app',
        phases: {
          informal: {
            hierarchy: { root: { id: 'root' } },
            validation: { valid: true, feasibility: { overallFeasible: true } }
          }
        },
        success: true
      };

      mockDecentPlanner.plan.mockResolvedValue(planResult);

      await actor.receive({
        type: 'plan:create',
        data: {
          goal: 'Build web app',
          context: {},
          options: { maxDepth: 3 }
        }
      });

      expect(mockDecentPlanner.plan).toHaveBeenCalledWith('Build web app', {});
      expect(mockRemoteActor.send).toHaveBeenCalledWith({
        type: 'plan:decomposition:start',
        data: { goal: 'Build web app' }
      });
      expect(mockRemoteActor.send).toHaveBeenCalledWith({
        type: 'plan:complete',
        data: expect.objectContaining({
          hierarchy: planResult.phases.informal.hierarchy,
          validation: planResult.phases.informal.validation
        })
      });
    });

    it('should handle decomposition updates during planning', async () => {
      const planResult = {
        goal: 'Build web app',
        phases: {
          informal: {
            hierarchy: {
              root: {
                id: 'root',
                description: 'Build web app',
                complexity: 'COMPLEX',
                children: [
                  { id: 'task1', description: 'Setup DB', complexity: 'SIMPLE' }
                ]
              }
            },
            validation: { valid: true }
          }
        },
        success: true
      };

      mockDecentPlanner.plan.mockImplementation(async (goal, context) => {
        // Simulate sending decomposition updates
        if (actor.remoteActor) {
          actor.remoteActor.send({
            type: 'plan:decomposition:node',
            data: {
              node: planResult.phases.informal.hierarchy.root,
              level: 0
            }
          });
        }
        return planResult;
      });

      await actor.receive({
        type: 'plan:create',
        data: { goal: 'Build web app', context: {} }
      });

      expect(mockRemoteActor.send).toHaveBeenCalledWith({
        type: 'plan:decomposition:node',
        data: expect.objectContaining({
          level: 0
        })
      });
    });

    it('should handle planning errors', async () => {
      mockDecentPlanner.plan.mockRejectedValue(new Error('LLM unavailable'));

      await actor.receive({
        type: 'plan:create',
        data: { goal: 'Build app', context: {} }
      });

      // First call should be decomposition:start
      expect(mockRemoteActor.send).toHaveBeenNthCalledWith(1, {
        type: 'plan:decomposition:start',
        data: { goal: 'Build app' }
      });

      // Second call should be the error
      expect(mockRemoteActor.send).toHaveBeenNthCalledWith(2, {
        type: 'plan:error',
        data: {
          error: 'Failed to create plan: LLM unavailable',
          details: expect.any(Error),
          timestamp: expect.any(Date)
        }
      });
    });

    it('should handle validation failures', async () => {
      const planResult = {
        goal: 'Build app',
        phases: {
          informal: {
            hierarchy: { root: {} },
            validation: {
              valid: false,
              errors: ['Circular dependency detected']
            }
          }
        },
        success: false,
        reason: 'Validation failed'
      };

      mockDecentPlanner.plan.mockResolvedValue(planResult);

      await actor.receive({
        type: 'plan:create',
        data: { goal: 'Build app', context: {} }
      });

      expect(mockRemoteActor.send).toHaveBeenCalledWith({
        type: 'plan:validation:result',
        data: {
          valid: false,
          errors: ['Circular dependency detected']
        }
      });
    });
  });

  describe('plan:save message', () => {
    it('should save plan to MongoDB', async () => {
      const mockCollection = {
        insertOne: jest.fn().mockResolvedValue({ insertedId: 'plan123' })
      };
      mockMongoProvider.getCollection.mockReturnValue(mockCollection);

      const planData = {
        name: 'My Plan',
        goal: 'Build app',
        hierarchy: { root: {} },
        validation: { valid: true }
      };

      await actor.receive({
        type: 'plan:save',
        data: planData
      });

      expect(mockMongoProvider.getCollection).toHaveBeenCalledWith('plans');
      expect(mockCollection.insertOne).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'My Plan',
          goal: 'Build app',
          metadata: expect.objectContaining({
            createdAt: expect.any(Date)
          })
        })
      );
      expect(mockRemoteActor.send).toHaveBeenCalledWith({
        type: 'plan:saved',
        data: { planId: 'plan123' }
      });
    });

    it('should handle save errors', async () => {
      const mockCollection = {
        insertOne: jest.fn().mockRejectedValue(new Error('DB error'))
      };
      mockMongoProvider.getCollection.mockReturnValue(mockCollection);

      await actor.receive({
        type: 'plan:save',
        data: { name: 'Plan', goal: 'Build' }
      });

      expect(mockRemoteActor.send).toHaveBeenCalledWith({
        type: 'plan:error',
        data: expect.objectContaining({
          error: expect.stringContaining('Failed to save plan')
        })
      });
    });
  });

  describe('plan:load message', () => {
    it('should load plan from MongoDB', async () => {
      const storedPlan = {
        _id: 'plan123',
        name: 'My Plan',
        goal: 'Build app',
        hierarchy: { root: {} }
      };

      const mockCollection = {
        findOne: jest.fn().mockResolvedValue(storedPlan)
      };
      mockMongoProvider.getCollection.mockReturnValue(mockCollection);

      await actor.receive({
        type: 'plan:load',
        data: { planId: 'plan123' }
      });

      expect(mockCollection.findOne).toHaveBeenCalledWith({ _id: 'plan123' });
      expect(mockRemoteActor.send).toHaveBeenCalledWith({
        type: 'plan:loaded',
        data: storedPlan
      });
    });

    it('should handle plan not found', async () => {
      const mockCollection = {
        findOne: jest.fn().mockResolvedValue(null)
      };
      mockMongoProvider.getCollection.mockReturnValue(mockCollection);

      await actor.receive({
        type: 'plan:load',
        data: { planId: 'nonexistent' }
      });

      expect(mockRemoteActor.send).toHaveBeenCalledWith({
        type: 'plan:error',
        data: expect.objectContaining({
          error: 'Plan not found: nonexistent'
        })
      });
    });
  });

  describe('plan:list message', () => {
    it('should list all plans', async () => {
      const plans = [
        { _id: '1', name: 'Plan 1', goal: 'Goal 1' },
        { _id: '2', name: 'Plan 2', goal: 'Goal 2' }
      ];

      const mockCollection = {
        find: jest.fn().mockReturnValue({
          sort: jest.fn().mockReturnValue({
            toArray: jest.fn().mockResolvedValue(plans)
          })
        })
      };
      mockMongoProvider.getCollection.mockReturnValue(mockCollection);

      await actor.receive({
        type: 'plan:list',
        data: {}
      });

      expect(mockCollection.find).toHaveBeenCalledWith({});
      expect(mockRemoteActor.send).toHaveBeenCalledWith({
        type: 'plan:list:result',
        data: { plans }
      });
    });
  });

  describe('plan:validate message', () => {
    it('should validate existing plan', async () => {
      const validationResult = {
        valid: true,
        feasibility: { overallFeasible: true },
        tools: ['tool1', 'tool2']
      };

      mockDecentPlanner.validatePlan.mockResolvedValue(validationResult);

      await actor.receive({
        type: 'plan:validate',
        data: {
          hierarchy: { root: {} }
        }
      });

      expect(mockDecentPlanner.validatePlan).toHaveBeenCalledWith({ root: {} });
      expect(mockRemoteActor.send).toHaveBeenCalledWith({
        type: 'plan:validation:result',
        data: validationResult
      });
    });
  });

  describe('plan:update message', () => {
    it('should update existing plan', async () => {
      const mockCollection = {
        updateOne: jest.fn().mockResolvedValue({ modifiedCount: 1 })
      };
      mockMongoProvider.getCollection.mockReturnValue(mockCollection);

      await actor.receive({
        type: 'plan:update',
        data: {
          planId: 'plan123',
          updates: {
            name: 'Updated Plan',
            hierarchy: { root: { modified: true } }
          }
        }
      });

      expect(mockCollection.updateOne).toHaveBeenCalledWith(
        { _id: 'plan123' },
        {
          $set: expect.objectContaining({
            name: 'Updated Plan',
            'metadata.updatedAt': expect.any(Date)
          })
        }
      );
      expect(mockRemoteActor.send).toHaveBeenCalledWith({
        type: 'plan:updated',
        data: { planId: 'plan123' }
      });
    });
  });

  describe('plan:delete message', () => {
    it('should delete plan from MongoDB', async () => {
      const mockCollection = {
        deleteOne: jest.fn().mockResolvedValue({ deletedCount: 1 })
      };
      mockMongoProvider.getCollection.mockReturnValue(mockCollection);

      await actor.receive({
        type: 'plan:delete',
        data: { planId: 'plan123' }
      });

      expect(mockCollection.deleteOne).toHaveBeenCalledWith({ _id: 'plan123' });
      expect(mockRemoteActor.send).toHaveBeenCalledWith({
        type: 'plan:deleted',
        data: { planId: 'plan123' }
      });
    });
  });

  describe('error handling', () => {
    it('should handle unknown message types', async () => {
      await actor.receive({
        type: 'unknown:message',
        data: {}
      });

      expect(mockRemoteActor.send).toHaveBeenCalledWith({
        type: 'plan:error',
        data: expect.objectContaining({
          error: 'Unknown message type: unknown:message'
        })
      });
    });

    it('should handle missing data', async () => {
      await actor.receive({
        type: 'plan:create'
        // Missing data field
      });

      expect(mockRemoteActor.send).toHaveBeenCalledWith({
        type: 'plan:error',
        data: expect.objectContaining({
          error: expect.stringContaining('Missing required')
        })
      });
    });
  });
});