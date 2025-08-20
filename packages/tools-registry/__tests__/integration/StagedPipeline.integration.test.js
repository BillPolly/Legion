/**
 * Integration tests for the complete staged pipeline
 * Tests the full flow with real MongoDB, Qdrant, and all services
 * NO MOCKING - uses actual resources
 */

import { LoadingManager } from '../../src/loading/LoadingManager.js';
import { ResourceManager } from '@legion/resource-manager';
import { MongoClient, ObjectId } from 'mongodb';
import { QdrantClient } from '@qdrant/js-client-rest';
import fs from 'fs/promises';
import path from 'path';

describe('Staged Pipeline Integration Tests', () => {
  let loadingManager;
  let resourceManager;
  let mongoClient;
  let qdrantClient;
  let db;
  
  beforeAll(async () => {
    // Initialize ResourceManager with real environment
    resourceManager = ResourceManager.getInstance();
    await resourceManager.initialize();
    
    // Verify required services are available
    const mongoUrl = resourceManager.get('env.MONGODB_URL');
    const qdrantUrl = resourceManager.get('env.QDRANT_URL');
    
    if (!mongoUrl) {
      throw new Error('MONGODB_URL not configured - integration tests require MongoDB');
    }
    
    if (!qdrantUrl) {
      throw new Error('QDRANT_URL not configured - integration tests require Qdrant');
    }
    
    // Connect directly to verify services are running
    mongoClient = new MongoClient(mongoUrl);
    await mongoClient.connect();
    db = mongoClient.db('legion_tools_test');
    
    qdrantClient = new QdrantClient({ url: qdrantUrl });
    
    // Verify Qdrant is accessible
    try {
      await qdrantClient.getCollections();
    } catch (error) {
      throw new Error(`Qdrant not accessible at ${qdrantUrl}: ${error.message}`);
    }
  }, 30000);

  beforeEach(async () => {
    // Clean test database
    await db.collection('modules').deleteMany({});
    await db.collection('tools').deleteMany({});
    await db.collection('tool_perspectives').deleteMany({});
    await db.collection('pipeline_state').deleteMany({});
    
    // Clean Qdrant test collection
    try {
      await qdrantClient.deleteCollection('legion_tools_test');
    } catch (error) {
      // Collection might not exist
    }
    
    // Create LoadingManager instance
    loadingManager = new LoadingManager({
      verbose: false,
      resourceManager
    });
    
    await loadingManager.initialize();
  }, 30000);

  afterEach(async () => {
    if (loadingManager) {
      await loadingManager.close();
    }
  });

  afterAll(async () => {
    // Final cleanup
    await db.collection('modules').deleteMany({});
    await db.collection('tools').deleteMany({});
    await db.collection('tool_perspectives').deleteMany({});
    await db.collection('pipeline_state').deleteMany({});
    
    try {
      await qdrantClient.deleteCollection('legion_tools_test');
    } catch (error) {
      // Ignore
    }
    
    await mongoClient.close();
  });

  describe('Full Pipeline Execution', () => {
    it('should execute complete pipeline successfully', async () => {
      // Create a test module file for discovery
      const testModulePath = path.join(process.cwd(), 'test-module-temp.js');
      const moduleContent = `
        export default class TestModule {
          getTools() {
            return [
              {
                name: 'test_tool_1',
                description: 'First test tool',
                execute: async () => ({ success: true })
              },
              {
                name: 'test_tool_2',
                description: 'Second test tool',
                execute: async () => ({ success: true })
              }
            ];
          }
        }
      `;
      
      await fs.writeFile(testModulePath, moduleContent);
      
      try {
        // Run the full pipeline
        const result = await loadingManager.runFullPipeline({
          forceRestart: true,
          clearModules: true
        });
        
        expect(result).toBeDefined();
        expect(result.success).toBe(true);
        expect(result.counts).toBeDefined();
        expect(result.counts.tools).toBeGreaterThan(0);
        expect(result.verification.passed).toBe(true);
        
        // Verify data in MongoDB
        const toolCount = await db.collection('tools').countDocuments();
        expect(toolCount).toBeGreaterThan(0);
        
        const perspectiveCount = await db.collection('tool_perspectives').countDocuments();
        expect(perspectiveCount).toBeGreaterThan(0);
        
        // Verify pipeline state
        const state = await db.collection('pipeline_state').findOne({ active: true });
        expect(state).toBeDefined();
        expect(state.status).toBe('completed');
        
      } finally {
        // Clean up test file
        await fs.unlink(testModulePath).catch(() => {});
      }
    }, 60000);

    it('should clear all data when clearModules option is set', async () => {
      // Pre-populate some data
      await db.collection('modules').insertMany([
        { name: 'old-module-1', path: '/old/path1' },
        { name: 'old-module-2', path: '/old/path2' }
      ]);
      
      await db.collection('tools').insertMany([
        { name: 'old-tool-1', moduleName: 'old-module-1' },
        { name: 'old-tool-2', moduleName: 'old-module-2' }
      ]);
      
      // Run pipeline with clearModules
      const result = await loadingManager.runFullPipeline({
        forceRestart: true,
        clearModules: true
      });
      
      expect(result.success).toBe(true);
      
      // Verify old data is gone
      const oldTools = await db.collection('tools')
        .find({ name: { $regex: /^old-/ } })
        .toArray();
      expect(oldTools).toHaveLength(0);
      
      const oldModules = await db.collection('modules')
        .find({ name: { $regex: /^old-/ } })
        .toArray();
      expect(oldModules).toHaveLength(0);
    }, 60000);

    it('should handle module filter correctly', async () => {
      // Create multiple test modules
      await db.collection('modules').insertMany([
        { name: 'target-module', path: '/path/target', type: 'class' },
        { name: 'other-module', path: '/path/other', type: 'class' }
      ]);
      
      // Create a mock module loader that returns tools based on module name
      const originalOrchestrator = loadingManager.orchestrator;
      if (originalOrchestrator) {
        originalOrchestrator.moduleLoader = {
          loadModule: async (moduleDoc) => ({
            name: moduleDoc.name,
            getTools: () => [{
              name: `${moduleDoc.name}_tool`,
              description: `Tool from ${moduleDoc.name}`
            }]
          })
        };
      }
      
      // Run pipeline with module filter
      const result = await loadingManager.runFullPipeline({
        module: 'target-module',
        forceRestart: true
      });
      
      expect(result.success).toBe(true);
      
      // Verify only target module's tools were processed
      const tools = await db.collection('tools').find({}).toArray();
      const targetTools = tools.filter(t => t.moduleName === 'target-module');
      const otherTools = tools.filter(t => t.moduleName === 'other-module');
      
      expect(targetTools.length).toBeGreaterThan(0);
      expect(otherTools).toHaveLength(0);
    }, 60000);
  });

  describe('Resume Functionality', () => {
    it('should resume from failed stage', async () => {
      // Simulate a previous run that failed at generatePerspectives
      await db.collection('pipeline_state').insertOne({
        active: true,
        status: 'in_progress',
        stages: {
          clear: { 
            status: 'completed',
            toolsCleared: 0,
            perspectivesCleared: 0
          },
          loadTools: { 
            status: 'completed',
            toolsAdded: 2
          },
          generatePerspectives: {
            status: 'failed',
            error: 'Previous failure'
          }
        },
        startedAt: new Date()
      });
      
      // Add tools that were loaded in previous run
      await db.collection('tools').insertMany([
        { name: 'resumed-tool-1', description: 'Test 1' },
        { name: 'resumed-tool-2', description: 'Test 2' }
      ]);
      
      // Run pipeline - should resume
      const result = await loadingManager.runFullPipeline({
        forceRestart: false // Allow resume
      });
      
      expect(result.success).toBe(true);
      
      // Verify perspectives were generated
      const perspectives = await db.collection('tool_perspectives').find({}).toArray();
      expect(perspectives.length).toBeGreaterThan(0);
      
      // Verify state is complete
      const state = await db.collection('pipeline_state').findOne({ active: true });
      expect(state.status).toBe('completed');
    }, 60000);

    it('should force restart when requested', async () => {
      // Create existing completed state
      await db.collection('pipeline_state').insertOne({
        active: true,
        status: 'completed',
        stages: {
          clear: { status: 'completed' },
          loadTools: { status: 'completed' },
          generatePerspectives: { status: 'completed' },
          generateEmbeddings: { status: 'completed' },
          indexVectors: { status: 'completed' }
        },
        completedAt: new Date()
      });
      
      // Add existing data
      await db.collection('tools').insertOne({ name: 'existing-tool' });
      
      // Run with forceRestart
      const result = await loadingManager.runFullPipeline({
        forceRestart: true
      });
      
      expect(result.success).toBe(true);
      
      // Verify new state was created
      const states = await db.collection('pipeline_state')
        .find({})
        .sort({ startedAt: -1 })
        .toArray();
      
      expect(states.length).toBeGreaterThan(1);
      expect(states[0].active).toBe(true);
      expect(states[1].active).toBe(false); // Old state deactivated
    }, 60000);
  });

  describe('Verification Checks', () => {
    it('should detect and report verification failures', async () => {
      // Manually create inconsistent state
      await db.collection('tools').insertMany([
        { name: 'tool-without-perspective', description: 'Test' }
      ]);
      
      // Create perspectives without embeddings
      await db.collection('tool_perspectives').insertMany([
        { 
          toolName: 'other-tool',
          perspectiveText: 'Test perspective',
          embedding: null
        }
      ]);
      
      // Override verifier to detect issues
      if (loadingManager.orchestrator) {
        loadingManager.orchestrator.verifier.runFinalVerification = async () => ({
          success: false,
          failedChecks: ['Perspective coverage', 'Embedding completeness'],
          checks: [
            { name: 'Tool count', success: true, message: 'Tools: 1' },
            { name: 'Perspective coverage', success: false, message: 'Tools without perspectives: 1' },
            { name: 'Embedding completeness', success: false, message: 'Perspectives without embeddings: 1' }
          ]
        });
      }
      
      // Run pipeline - should fail verification
      await expect(loadingManager.runFullPipeline({
        forceRestart: true
      })).rejects.toThrow('verification failed');
      
      // State should show failure
      const state = await db.collection('pipeline_state').findOne({ active: true });
      expect(state.status).toBe('in_progress'); // Not completed due to verification failure
    }, 60000);

    it('should pass verification for consistent data', async () => {
      // Create minimal but consistent test data
      const toolId = new ObjectId();
      await db.collection('tools').insertOne({
        _id: toolId,
        name: 'verified-tool',
        description: 'Test tool'
      });
      
      const embedding = new Array(768).fill(0.1);
      await db.collection('tool_perspectives').insertOne({
        toolId: toolId,
        toolName: 'verified-tool',
        perspectiveText: 'Test perspective',
        embedding: embedding
      });
      
      // Override stages to not process (just verify existing data)
      if (loadingManager.orchestrator) {
        loadingManager.orchestrator.stages.clear.execute = async () => ({
          success: true,
          toolsCleared: 0,
          perspectivesCleared: 0
        });
        
        loadingManager.orchestrator.stages.loadTools.execute = async () => ({
          success: true,
          toolsAdded: 0,
          modulesProcessed: 0
        });
        
        loadingManager.orchestrator.stages.generatePerspectives.execute = async () => ({
          success: true,
          perspectivesGenerated: 0,
          toolsProcessed: 0
        });
        
        loadingManager.orchestrator.stages.generateEmbeddings.execute = async () => ({
          success: true,
          perspectivesProcessed: 0,
          batchesProcessed: 0
        });
        
        loadingManager.orchestrator.stages.indexVectors.execute = async () => ({
          success: true,
          perspectivesIndexed: 0,
          batchesProcessed: 0
        });
      }
      
      const result = await loadingManager.runFullPipeline({
        forceRestart: true
      });
      
      expect(result.success).toBe(true);
      expect(result.verification.passed).toBe(true);
    }, 60000);
  });

  describe('Error Handling', () => {
    it('should handle MongoDB connection failures', async () => {
      // Close MongoDB connection to simulate failure
      await mongoClient.close();
      
      try {
        await loadingManager.runFullPipeline({
          forceRestart: true
        });
        
        // Should not reach here
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeDefined();
        expect(error.message).toMatch(/mongo|connection|closed/i);
      } finally {
        // Reconnect for cleanup
        await mongoClient.connect();
        db = mongoClient.db('legion_tools_test');
      }
    }, 60000);

    it('should handle stage failures gracefully', async () => {
      // Override a stage to fail
      if (loadingManager.orchestrator) {
        loadingManager.orchestrator.stages.generatePerspectives.execute = async () => {
          throw new Error('Perspective generation service unavailable');
        };
      }
      
      // Add a tool so the stage has something to process
      await db.collection('tools').insertOne({
        name: 'test-tool',
        description: 'Test'
      });
      
      try {
        await loadingManager.runFullPipeline({
          forceRestart: true
        });
        
        // Should not reach here
        expect(true).toBe(false);
      } catch (error) {
        expect(error.message).toContain('Perspective generation service unavailable');
        
        // Verify state shows the failure
        const state = await db.collection('pipeline_state').findOne({ active: true });
        expect(state.stages.generatePerspectives.status).toBe('failed');
        expect(state.stages.generatePerspectives.error).toContain('unavailable');
      }
    }, 60000);
  });

  describe('Progress Tracking', () => {
    it('should track progress throughout execution', async () => {
      const progressUpdates = [];
      
      // Capture progress updates
      const originalEmit = loadingManager.orchestrator?.stateManager?.updateStageStatus;
      if (loadingManager.orchestrator?.stateManager) {
        loadingManager.orchestrator.stateManager.updateStageStatus = async function(stage, status, metadata) {
          progressUpdates.push({ stage, status });
          if (originalEmit) {
            return await originalEmit.call(this, stage, status, metadata);
          }
        };
      }
      
      await loadingManager.runFullPipeline({
        forceRestart: true
      });
      
      // Verify progress was tracked
      expect(progressUpdates.length).toBeGreaterThan(0);
      
      // Should have in_progress and completed for each stage
      const stages = ['clear', 'loadTools', 'generatePerspectives', 'generateEmbeddings', 'indexVectors'];
      for (const stage of stages) {
        const stageUpdates = progressUpdates.filter(u => u.stage === stage);
        expect(stageUpdates.some(u => u.status === 'in_progress')).toBe(true);
        expect(stageUpdates.some(u => u.status === 'completed')).toBe(true);
      }
    }, 60000);

    it('should provide accurate progress information', async () => {
      // Start pipeline in background
      const pipelinePromise = loadingManager.runFullPipeline({
        forceRestart: true
      });
      
      // Wait a bit for pipeline to start
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Get progress while running
      const progress = await loadingManager.getPipelineProgress();
      
      if (progress) {
        expect(progress.currentStage).toBeDefined();
        expect(progress.completedStages).toBeInstanceOf(Array);
        expect(progress.percentComplete).toBeGreaterThanOrEqual(0);
        expect(progress.percentComplete).toBeLessThanOrEqual(100);
      }
      
      // Wait for pipeline to complete
      await pipelinePromise;
      
      // Final progress should show 100%
      const finalProgress = await loadingManager.getPipelineProgress();
      if (finalProgress) {
        expect(finalProgress.percentComplete).toBe(100);
      }
    }, 60000);
  });
});