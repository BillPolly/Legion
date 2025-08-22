/**
 * Unit tests for PipelineStateManager
 * Tests state tracking and resume capability using mocked dependencies
 */

import { jest } from '@jest/globals';
import { PipelineStateManager } from '../../../src/loading/PipelineStateManager.js';
import { ObjectId } from 'mongodb';

describe('PipelineStateManager', () => {
  let stateManager;
  let mockMongoProvider;
  let mockStateData;
  const testCollectionName = 'pipeline_state_test';

  beforeAll(async () => {
    // Mock state data
    mockStateData = {
      states: []
    };

    // Create mock implementations as regular functions first
    const findOneImpl = async (collection, query) => {
      return mockStateData.states.find(state => {
        if (query.active !== undefined) return state.active === query.active;
        if (query._id) return state._id.toString() === query._id.toString();
        return false;
      }) || null;
    };

    const findImpl = (collection, query) => {
      console.log('🔍 MOCK find() called with:', { collection, query });
      console.log('🔍 MOCK mockStateData.states:', mockStateData.states.map(s => ({ _id: s._id.toString(), active: s.active })));
      const results = mockStateData.states.filter(state => {
        if (query.active !== undefined) return state.active === query.active;
        if (query._id) return state._id.toString() === query._id.toString();
        return true;  // Return all if no query
      });
      console.log('🔍 MOCK find() returning:', results.length, 'states');
      console.log('🔍 MOCK find() actual results:', results);
      return Promise.resolve(results);
    };

    const updateImpl = async (collection, query, update, options = {}) => {
      // Handle multi option
      if (options.multi) {
        const states = mockStateData.states.filter(s => {
          if (query.active !== undefined) return s.active === query.active;
          if (query._id) return s._id.toString() === query._id.toString();
          return false;
        });
        
        states.forEach(state => {
          if (update.$set) {
            Object.assign(state, update.$set);
          }
        });
        
        return { nModified: states.length };
      }
      
      // Single update
      const state = mockStateData.states.find(s => {
        if (query.active !== undefined) return s.active === query.active;
        if (query._id) return s._id.toString() === query._id.toString();
        return false;
      });
      
      if (state) {
        // Handle $set operations
        if (update.$set) {
          // Handle nested updates like stages.loadTools.status
          for (const [path, value] of Object.entries(update.$set)) {
            if (path.startsWith('stages.')) {
              const parts = path.split('.');
              if (parts.length >= 3) {
                const stageName = parts[1];
                const property = parts.slice(2).join('.');
                if (!state.stages) state.stages = {};
                if (!state.stages[stageName]) state.stages[stageName] = {};
                state.stages[stageName][property] = value;
              } else {
                state[path] = value;
              }
            } else {
              state[path] = value;
            }
          }
        }
        
        // Handle $addToSet operations  
        if (update.$addToSet) {
          for (const [path, value] of Object.entries(update.$addToSet)) {
            if (path.startsWith('stages.')) {
              const parts = path.split('.');
              if (parts.length >= 3) {
                const stageName = parts[1];
                const property = parts.slice(2).join('.');
                if (!state.stages) state.stages = {};
                if (!state.stages[stageName]) state.stages[stageName] = {};
                if (!state.stages[stageName][property]) state.stages[stageName][property] = [];
                if (!state.stages[stageName][property].includes(value)) {
                  state.stages[stageName][property].push(value);
                }
              }
            }
          }
        }
        
        // Handle direct property updates (for numeric checkpoint data)
        // The implementation sets checkpoint data directly on the stage
        if (update.$set) {
          for (const [path, value] of Object.entries(update.$set)) {
            if (path.includes('.checkpoint.')) {
              // Handle checkpoint object properties
              const parts = path.split('.');
              if (parts.length >= 4 && parts[0] === 'stages') {
                const stageName = parts[1];
                const property = parts[3];  // Skip 'checkpoint'
                if (!state.stages) state.stages = {};
                if (!state.stages[stageName]) state.stages[stageName] = {};
                state.stages[stageName][property] = value;
              }
            }
          }
        }
        
        return { modifiedCount: 1 };
      } else if (update.$set) {
        // Upsert - create new document
        const newState = {
          _id: new ObjectId(),
          ...update.$set,
          createdAt: new Date()
        };
        mockStateData.states.push(newState);
        return { modifiedCount: 0, upsertedId: newState._id };
      }
      return { modifiedCount: 0 };
    };

    const updateManyImpl = async (collection, query, update) => {
      let modifiedCount = 0;
      mockStateData.states.forEach(state => {
        if (query.active === undefined || state.active === query.active) {
          Object.assign(state, update.$set || {});
          modifiedCount++;
        }
      });
      return { modifiedCount };
    };

    const insertImpl = async (collection, doc) => {
      const newDoc = {
        _id: new ObjectId(),
        ...doc,
        createdAt: new Date()
      };
      mockStateData.states.push(newDoc);
      return { insertedId: newDoc._id };
    };

    // Mock MongoDB provider - NO REAL CONNECTIONS
    // Create a custom mock class that tracks calls and executes implementations
    class MockMongoProvider {
      constructor() {
        this.calls = {
          findOne: [],
          find: [],
          update: [],
          updateMany: [],
          insert: []
        };
      }
      
      async findOne(collection, query) {
        this.calls.findOne.push({ collection, query });
        return findOneImpl(collection, query);
      }
      
      async find(collection, query) {
        this.calls.find.push({ collection, query });
        console.log('🔍 CUSTOM MOCK find() called with:', { collection, query });
        return findImpl(collection, query);
      }
      
      async update(collection, query, update, options) {
        this.calls.update.push({ collection, query, update, options });
        return updateImpl(collection, query, update, options);
      }
      
      async updateMany(collection, query, update) {
        this.calls.updateMany.push({ collection, query, update });
        return updateManyImpl(collection, query, update);
      }
      
      async insert(collection, doc) {
        this.calls.insert.push({ collection, doc });
        return insertImpl(collection, doc);
      }
      
      // Helper methods for test assertions
      wasCalledWith(method, ...expectedArgs) {
        return this.calls[method].some(call => 
          JSON.stringify([call.collection, call.query, call.update, call.options].filter(x => x !== undefined)) ===
          JSON.stringify(expectedArgs)
        );
      }
      
      getCallCount(method) {
        return this.calls[method].length;
      }
      
      clearCalls() {
        Object.keys(this.calls).forEach(method => {
          this.calls[method] = [];
        });
      }
    }
    
    mockMongoProvider = new MockMongoProvider();
  });

  beforeEach(async () => {
    // Reset mock data and clear call history (but keep implementations)
    mockStateData.states = [];
    
    // Clear call history using our custom mock's method
    mockMongoProvider.clearCalls();
    
    // Create fresh state manager
    stateManager = new PipelineStateManager(mockMongoProvider);
    stateManager.stateCollection = testCollectionName;  // Override default collection name
    
    console.log('🔍 SETUP: stateManager.mongoProvider === mockMongoProvider:', stateManager.mongoProvider === mockMongoProvider);
    console.log('🔍 SETUP: stateManager.mongoProvider.find === mockMongoProvider.find:', stateManager.mongoProvider.find === mockMongoProvider.find);
    
    // Test direct mock call
    console.log('🔍 SETUP: Testing direct mock call...');
    try {
      const directResult = stateManager.mongoProvider.find('test', { active: true });
      console.log('🔍 SETUP: Direct mock call result:', directResult);
    } catch (error) {
      console.log('🔍 SETUP: Direct mock call error:', error.message);
    }
  });

  afterAll(async () => {
    // No cleanup needed for mocks
  });

  describe('reset', () => {
    it('should create a new pipeline state', async () => {
      await stateManager.reset();
      
      // Check that insert was called for the new active state
      expect(mockMongoProvider.getCallCount('insert')).toBe(1);
      const insertCall = mockMongoProvider.calls.insert[0];
      expect(insertCall.collection).toBe(testCollectionName);
      expect(insertCall.doc).toEqual(expect.objectContaining({
        active: true,
        status: 'in_progress',  // Implementation uses 'in_progress' not 'pending'
        startedAt: expect.any(Date),
        stages: expect.any(Object)  // Implementation creates default stages
      }));
    });

    it('should deactivate existing states', async () => {
      // Create an existing active state in mock data
      const existingStateId = new ObjectId();
      const existingState = {
        _id: existingStateId,
        active: true,
        status: 'in_progress',
        startedAt: new Date()
      };
      mockStateData.states.push(existingState);

      console.log('🔍 Before reset: mockStateData.states =', mockStateData.states.length);
      console.log('🔍 Existing state:', { _id: existingStateId.toString(), active: existingState.active });

      await stateManager.reset();
      
      // Check that existing states were deactivated (individual updates, not multi)
      expect(mockMongoProvider.getCallCount('update')).toBeGreaterThanOrEqual(1);
      const updateCalls = mockMongoProvider.calls.update;
      const deactivateCall = updateCalls.find(call => 
        call.collection === testCollectionName &&
        call.query._id === existingStateId &&
        call.update.$set.active === false
      );
      expect(deactivateCall).toBeDefined();
      
      // Verify a new state was added to mock data
      const newState = mockStateData.states.find(s => s.active === true);
      expect(newState).toBeDefined();
      expect(newState.status).toBe('in_progress');  // Implementation uses 'in_progress'
    });
  });

  describe('canResume', () => {
    it('should return true when there is an active incomplete pipeline', async () => {
      mockStateData.states.push({
        _id: new ObjectId(),
        active: true,
        status: 'in_progress',
        canResume: true,
        currentStage: 'loadTools',
        stages: {
          clear: { status: 'completed' },
          loadTools: { status: 'in_progress' }
        }
      });

      const canResume = await stateManager.canResume();
      expect(canResume).toBe(true);
    });

    it('should return false when pipeline is completed', async () => {
      mockStateData.states.push({
        _id: new ObjectId(),
        active: true,
        status: 'completed',
        stages: {
          clear: { status: 'completed' },
          loadTools: { status: 'completed' }
        }
      });

      const canResume = await stateManager.canResume();
      expect(canResume).toBe(false);
    });

    it('should return false when no active pipeline exists', async () => {
      const canResume = await stateManager.canResume();
      expect(canResume).toBe(false);
    });
  });

  describe('updateStageStatus', () => {
    beforeEach(async () => {
      await stateManager.reset();
    });

    it('should update stage status and metadata', async () => {
      await stateManager.updateStageStatus('loadTools', 'in_progress', {
        toolsLoaded: 0
      });

      const state = await stateManager.getCurrentState();
      expect(state.stages.loadTools).toBeDefined();
      expect(state.stages.loadTools.status).toBe('in_progress');
      expect(state.stages.loadTools.toolsLoaded).toBe(0);
      expect(state.stages.loadTools.updatedAt).toBeInstanceOf(Date);  // Implementation uses 'updatedAt'
    });

    it('should update completed stage with endedAt timestamp', async () => {
      await stateManager.updateStageStatus('loadTools', 'completed', {
        toolsLoaded: 42
      });

      const state = await stateManager.getCurrentState();
      expect(state.stages.loadTools.status).toBe('completed');
      expect(state.stages.loadTools.toolsLoaded).toBe(42);
      expect(state.stages.loadTools.completedAt).toBeInstanceOf(Date);
    });

    it('should handle failed stage status', async () => {
      await stateManager.updateStageStatus('loadTools', 'failed', {
        error: 'Connection timeout'
      });

      const state = await stateManager.getCurrentState();
      expect(state.stages.loadTools.status).toBe('failed');
      expect(state.stages.loadTools.error).toBe('Connection timeout');
      expect(state.stages.loadTools.updatedAt).toBeInstanceOf(Date);  // Implementation uses 'updatedAt' for all status changes
    });
  });

  describe('recordCheckpoint', () => {
    beforeEach(async () => {
      await stateManager.reset();
    });

    it('should append checkpoint data to stage', async () => {
      await stateManager.recordCheckpoint('generatePerspectives', {
        processed: 'tool-1'
      });

      const state = await stateManager.getCurrentState();
      expect(state.stages.generatePerspectives.processed).toContain('tool-1');
    });

    it('should accumulate multiple checkpoints', async () => {
      await stateManager.recordCheckpoint('generatePerspectives', {
        processed: 'tool-1'
      });
      
      await stateManager.recordCheckpoint('generatePerspectives', {
        processed: 'tool-2'
      });

      const state = await stateManager.getCurrentState();
      expect(state.stages.generatePerspectives.processed).toHaveLength(2);
      expect(state.stages.generatePerspectives.processed).toContain('tool-1');
      expect(state.stages.generatePerspectives.processed).toContain('tool-2');
    });

    it('should handle numeric checkpoint data', async () => {
      await stateManager.recordCheckpoint('generateEmbeddings', {
        processedBatches: 1,
        totalProcessed: 50
      });

      await stateManager.recordCheckpoint('generateEmbeddings', {
        processedBatches: 2,
        totalProcessed: 100
      });

      const state = await stateManager.getCurrentState();
      // Numeric data is stored in the checkpoint object
      expect(state.stages.generateEmbeddings.checkpoint.processedBatches).toBe(2);
      expect(state.stages.generateEmbeddings.checkpoint.totalProcessed).toBe(100);
      expect(state.stages.generateEmbeddings.lastCheckpoint).toBeInstanceOf(Date);
    });
  });

  describe('markComplete', () => {
    beforeEach(async () => {
      await stateManager.reset();
      await stateManager.updateStageStatus('loadTools', 'completed', { toolsLoaded: 10 });
      
      // Ensure the state has a startedAt field for duration calculation
      const state = mockStateData.states.find(s => s.active === true);
      if (state && !state.startedAt) {
        state.startedAt = new Date();
      }
    });

    it('should mark pipeline as complete with final report', async () => {
      const report = {
        success: true,
        duration: 5000,
        counts: {
          tools: 10,
          perspectives: 50,
          vectors: 50
        }
      };

      await stateManager.markComplete(report);

      const state = await stateManager.getCurrentState();
      expect(state.status).toBe('completed');
      expect(state.canResume).toBe(false);
      expect(state.stages.pipeline_complete).toBeDefined();
      expect(state.stages.pipeline_complete.status).toBe('completed');
    });
  });

  describe('getProgress', () => {
    it('should calculate progress based on completed stages', async () => {
      await stateManager.reset();
      
      // Complete some stages
      await stateManager.updateStageStatus('clear', 'completed');
      await stateManager.updateStageStatus('loadTools', 'completed');
      await stateManager.updateStageStatus('generatePerspectives', 'in_progress');

      const progress = await stateManager.getProgress();
      
      expect(progress).toBeDefined();
      expect(progress.completedStages).toContain('clear');
      expect(progress.completedStages).toContain('loadTools');
      expect(progress.currentStage).toBe('generatePerspectives');
      expect(progress.percentComplete).toBeGreaterThan(0);
      expect(progress.percentComplete).toBeLessThan(100);
      expect(progress.isActive).toBe(true);
    });

    it('should return null when no active pipeline exists', async () => {
      const progress = await stateManager.getProgress();
      expect(progress).toBeNull();
    });
  });

  describe('error recovery scenarios', () => {
    it('should handle MongoDB connection errors gracefully', async () => {
      const failingProvider = {
        findOne: async () => {
          throw new Error('Connection lost');
        }
      };

      const failingManager = new PipelineStateManager(failingProvider);
      
      // canResume() catches errors and returns false, so we test that it returns false
      const result = await failingManager.canResume();
      expect(result).toBe(false);
    });

    it('should preserve state across manager instances', async () => {
      await stateManager.reset();
      await stateManager.updateStageStatus('loadTools', 'completed', { toolsLoaded: 25 });

      // Create new manager instance
      const newManager = new PipelineStateManager(mockMongoProvider);
      newManager.stateCollection = testCollectionName;
      
      const state = await newManager.getCurrentState();
      expect(state.stages.loadTools).toBeDefined();
      expect(state.stages.loadTools.toolsLoaded).toBe(25);
    });
  });
});