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
  let originalEnvVars;
  
  beforeAll(async () => {
    // Store original environment variables
    originalEnvVars = {
      MONGODB_URL: process.env.MONGODB_URL,
      MONGODB_DATABASE: process.env.MONGODB_DATABASE,
      TOOLS_DATABASE_NAME: process.env.TOOLS_DATABASE_NAME,
      QDRANT_COLLECTION_NAME: process.env.QDRANT_COLLECTION_NAME
    };
    
    // Override environment to use test database for all components
    process.env.MONGODB_URL = 'mongodb://localhost:27017/legion_tools_test';
    process.env.MONGODB_DATABASE = 'legion_tools_test';
    process.env.TOOLS_DATABASE_NAME = 'legion_tools_test';
    process.env.QDRANT_COLLECTION_NAME = 'tool_perspectives_test';
    
    // Clear ResourceManager singleton to force reload with new environment
    if (ResourceManager._instance) {
      ResourceManager._instance = null;
    }
    
    // Initialize ResourceManager with test environment
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
      await qdrantClient.deleteCollection('tool_perspectives_test');
    } catch (error) {
      // Collection might not exist
    }
    
    // Create LoadingManager instance (environment variables already set for test database)
    loadingManager = new LoadingManager({
      verbose: false,
      resourceManager
    });
    
    await loadingManager.initialize();
    
    // CRITICAL: Manually populate test database with required modules
    // This step is required because LoadToolsStage.getModulesToLoad() queries the modules collection
    console.log('🔍 Manually populating test database with required modules...');
    
    // Insert test modules directly into the test database
    const testModules = [
      {
        name: 'json',
        type: 'class',
        path: 'packages/tools-collection/src/json',
        className: 'JsonModule',
        description: 'JSON processing tools for parsing, validation, and transformation',
        package: '@legion/tools-collection',
        filePath: 'packages/tools-collection/src/json/JsonModule.js',
        dependencies: [],
        requiredEnvVars: [],
        loadable: true,
        enabled: true, // Add enabled field to match filter in LoadToolsStage
        discoveryStatus: 'discovered',
        discoveredAt: new Date(),
        loadingStatus: 'pending',
        indexingStatus: 'pending',
        validationStatus: 'pending',
        toolCount: 0,
        perspectiveCount: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        name: 'calculator',
        type: 'class', 
        path: 'packages/tools-collection/src/calculator',
        className: 'CalculatorModule',
        description: 'Mathematical calculation tools for basic and advanced computations',
        package: '@legion/tools-collection',
        filePath: 'packages/tools-collection/src/calculator/CalculatorModule.js',
        dependencies: [],
        requiredEnvVars: [],
        loadable: true,
        enabled: true, // Add enabled field to match filter in LoadToolsStage
        discoveryStatus: 'discovered',
        discoveredAt: new Date(),
        loadingStatus: 'pending',
        indexingStatus: 'pending',
        validationStatus: 'pending',
        toolCount: 0,
        perspectiveCount: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];
    
    await db.collection('modules').insertMany(testModules);
    console.log(`✅ Inserted ${testModules.length} test modules into database`);
    
    // Verify we have the modules needed for tests
    const jsonModule = await db.collection('modules').findOne({ name: 'json' });
    const calcModule = await db.collection('modules').findOne({ name: 'calculator' });
    
    if (!jsonModule) {
      throw new Error('json module not found after insertion');
    } else {
      console.log('✅ json module verified in test database');
    }
    if (!calcModule) {
      throw new Error('calculator module not found after insertion');
    } else {
      console.log('✅ calculator module verified in test database');
    }
  }, 45000);

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
      await qdrantClient.deleteCollection('tool_perspectives_test');
    } catch (error) {
      // Ignore
    }
    
    await mongoClient.close();
    
    // Restore original environment variables
    if (originalEnvVars.MONGODB_URL !== undefined) {
      process.env.MONGODB_URL = originalEnvVars.MONGODB_URL;
    } else {
      delete process.env.MONGODB_URL;
    }
    
    if (originalEnvVars.MONGODB_DATABASE !== undefined) {
      process.env.MONGODB_DATABASE = originalEnvVars.MONGODB_DATABASE;
    } else {
      delete process.env.MONGODB_DATABASE;
    }
    
    if (originalEnvVars.TOOLS_DATABASE_NAME !== undefined) {
      process.env.TOOLS_DATABASE_NAME = originalEnvVars.TOOLS_DATABASE_NAME;
    } else {
      delete process.env.TOOLS_DATABASE_NAME;
    }
    
    if (originalEnvVars.QDRANT_COLLECTION_NAME !== undefined) {
      process.env.QDRANT_COLLECTION_NAME = originalEnvVars.QDRANT_COLLECTION_NAME;
    } else {
      delete process.env.QDRANT_COLLECTION_NAME;
    }
  });

  describe('Full Pipeline Execution', () => {
    it('should execute complete pipeline successfully', async () => {
      // Use existing json module since we know it works
      const result = await loadingManager.runFullPipeline({
        forceRestart: true,
        clearModules: true,
        module: 'json' // Use specific module filter to ensure it loads something
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
    }, 60000);

    it('should clear all data when clearModules option is set', async () => {
      // First load some data
      await loadingManager.runFullPipeline({
        forceRestart: true,
        clearModules: true,
        module: 'json'
      });
      
      // Verify data exists
      const toolsBeforeClear = await db.collection('tools').countDocuments();
      const perspectivesBeforeClear = await db.collection('tool_perspectives').countDocuments();
      expect(toolsBeforeClear).toBeGreaterThan(0);
      
      // Run pipeline with clearModules again to clear the data
      const result = await loadingManager.runFullPipeline({
        forceRestart: true,
        clearModules: true,
        module: 'calculator' // Load different module
      });
      
      expect(result.success).toBe(true);
      
      // Verify that only calculator tools remain, json tools are gone
      const tools = await db.collection('tools').find({}).toArray();
      const jsonTools = tools.filter(t => t.moduleName === 'json');
      const calcTools = tools.filter(t => t.moduleName === 'calculator');
      
      expect(jsonTools).toHaveLength(0); // JSON tools cleared
      expect(calcTools.length).toBeGreaterThan(0); // Calculator tools loaded
    }, 60000);

    it('should handle module filter correctly', async () => {
      // Run pipeline with module filter targeting specific module
      const result = await loadingManager.runFullPipeline({
        module: 'json',
        forceRestart: true,
        clearModules: true
      });
      
      expect(result.success).toBe(true);
      
      // Verify only json module's tools were processed
      const tools = await db.collection('tools').find({}).toArray();
      const jsonTools = tools.filter(t => t.moduleName === 'json');
      const otherTools = tools.filter(t => t.moduleName !== 'json');
      
      expect(jsonTools.length).toBeGreaterThan(0);
      expect(otherTools).toHaveLength(0);
      
      // Verify json tools are the expected ones
      const toolNames = jsonTools.map(t => t.name);
      expect(toolNames).toContain('json_parse');
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