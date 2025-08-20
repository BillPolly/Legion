/**
 * Unit tests for PipelineStateManager
 * Tests state tracking and resume capability with real MongoDB
 */

import { PipelineStateManager } from '../../../src/loading/PipelineStateManager.js';
import { MongoClient } from 'mongodb';
import { ResourceManager } from '@legion/resource-manager';

describe('PipelineStateManager', () => {
  let stateManager;
  let mongoProvider;
  let client;
  let db;
  const testCollectionName = 'pipeline_state_test';

  beforeAll(async () => {
    // Use real MongoDB connection
    const resourceManager = ResourceManager.getInstance();
    await resourceManager.initialize();
    
    const mongoUrl = resourceManager.get('env.MONGODB_URL') || 'mongodb://localhost:27017';
    client = new MongoClient(mongoUrl);
    await client.connect();
    
    db = client.db('legion_tools_test');
    
    // Create mock provider that uses real MongoDB
    mongoProvider = {
      db,
      findOne: async (collection, query) => {
        return await db.collection(collection).findOne(query);
      },
      update: async (collection, query, update) => {
        const result = await db.collection(collection).updateOne(query, update, { upsert: true });
        return result;
      },
      insert: async (collection, doc) => {
        const result = await db.collection(collection).insertOne(doc);
        return { insertedId: result.insertedId };
      }
    };
  });

  beforeEach(async () => {
    // Clear test collection before each test
    await db.collection(testCollectionName).deleteMany({});
    
    // Override collection name for testing
    stateManager = new PipelineStateManager(mongoProvider);
    stateManager.collectionName = testCollectionName;
  });

  afterAll(async () => {
    // Clean up test data
    await db.collection(testCollectionName).deleteMany({});
    await client.close();
  });

  describe('reset', () => {
    it('should create a new pipeline state', async () => {
      await stateManager.reset();
      
      const state = await db.collection(testCollectionName).findOne({ active: true });
      expect(state).toBeDefined();
      expect(state.status).toBe('pending');
      expect(state.stages).toEqual({});
      expect(state.startedAt).toBeInstanceOf(Date);
    });

    it('should deactivate existing states', async () => {
      // Create an existing active state
      await db.collection(testCollectionName).insertOne({
        active: true,
        status: 'in_progress',
        startedAt: new Date()
      });

      await stateManager.reset();
      
      const oldStates = await db.collection(testCollectionName).find({ active: false }).toArray();
      expect(oldStates).toHaveLength(1);
      
      const newState = await db.collection(testCollectionName).findOne({ active: true });
      expect(newState).toBeDefined();
      expect(newState.status).toBe('pending');
    });
  });

  describe('canResume', () => {
    it('should return true when there is an active incomplete pipeline', async () => {
      await db.collection(testCollectionName).insertOne({
        active: true,
        status: 'in_progress',
        stages: {
          clear: { status: 'completed' },
          loadTools: { status: 'in_progress' }
        }
      });

      const canResume = await stateManager.canResume();
      expect(canResume).toBe(true);
    });

    it('should return false when pipeline is completed', async () => {
      await db.collection(testCollectionName).insertOne({
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
      expect(state.stages.loadTools.startedAt).toBeInstanceOf(Date);
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
      expect(state.stages.loadTools.failedAt).toBeInstanceOf(Date);
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
      expect(state.stages.generateEmbeddings.processedBatches).toBe(2);
      expect(state.stages.generateEmbeddings.totalProcessed).toBe(100);
    });
  });

  describe('markComplete', () => {
    beforeEach(async () => {
      await stateManager.reset();
      await stateManager.updateStageStatus('loadTools', 'completed', { toolsLoaded: 10 });
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
      expect(state.completedAt).toBeInstanceOf(Date);
      expect(state.finalReport).toEqual(report);
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
      expect(progress.totalStages).toBeGreaterThan(0);
      expect(progress.percentComplete).toBeGreaterThan(0);
      expect(progress.percentComplete).toBeLessThan(100);
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
      
      await expect(failingManager.canResume()).rejects.toThrow('Connection lost');
    });

    it('should preserve state across manager instances', async () => {
      await stateManager.reset();
      await stateManager.updateStageStatus('loadTools', 'completed', { toolsLoaded: 25 });

      // Create new manager instance
      const newManager = new PipelineStateManager(mongoProvider);
      newManager.collectionName = testCollectionName;
      
      const state = await newManager.getCurrentState();
      expect(state.stages.loadTools).toBeDefined();
      expect(state.stages.loadTools.toolsLoaded).toBe(25);
    });
  });
});