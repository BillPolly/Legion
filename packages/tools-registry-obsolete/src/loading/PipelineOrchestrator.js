/**
 * PipelineOrchestrator - Coordinates all pipeline stages
 * 
 * Responsibilities:
 * - Initialize all stages with dependencies
 * - Execute stages in correct order
 * - Handle resume from failure
 * - Stop immediately on verification failure
 * - Generate final report
 */

import { PipelineStateManager } from './PipelineStateManager.js';
import { PipelineVerifier } from './PipelineVerifier.js';
import { ClearStage } from './stages/ClearStage.js';
import { LoadToolsStage } from './stages/LoadToolsStage.js';
import { GeneratePerspectivesStage } from './stages/GeneratePerspectivesStage.js';
import { GenerateEmbeddingsStage } from './stages/GenerateEmbeddingsStage.js';
import { IndexVectorsStage } from './stages/IndexVectorsStage.js';

export class PipelineOrchestrator {
  constructor(dependencies) {
    // Core dependencies
    this.mongoProvider = dependencies.mongoProvider;
    this.vectorStore = dependencies.vectorStore;
    this.moduleLoader = dependencies.moduleLoader;
    this.perspectiveGenerator = dependencies.perspectiveGenerator;
    this.embeddingService = dependencies.embeddingService;
    
    // Initialize state manager and verifier
    this.stateManager = new PipelineStateManager(this.mongoProvider);
    this.verifier = new PipelineVerifier(this.mongoProvider, this.vectorStore);
    
    // Initialize all stages with their dependencies
    this.stages = {
      clear: new ClearStage({
        mongoProvider: this.mongoProvider,
        vectorStore: this.vectorStore,
        verifier: this.verifier
      }),
      
      loadTools: new LoadToolsStage({
        moduleLoader: this.moduleLoader,
        mongoProvider: this.mongoProvider,
        verifier: this.verifier,
        stateManager: this.stateManager
      }),
      
      generatePerspectives: new GeneratePerspectivesStage({
        perspectiveGenerator: this.perspectiveGenerator,
        mongoProvider: this.mongoProvider,
        verifier: this.verifier,
        stateManager: this.stateManager
      }),
      
      generateEmbeddings: new GenerateEmbeddingsStage({
        embeddingService: this.embeddingService,
        mongoProvider: this.mongoProvider,
        verifier: this.verifier,
        stateManager: this.stateManager,
        batchSize: dependencies.embeddingBatchSize || 50
      }),
      
      indexVectors: new IndexVectorsStage({
        vectorStore: this.vectorStore,
        mongoProvider: this.mongoProvider,
        verifier: this.verifier,
        stateManager: this.stateManager,
        batchSize: dependencies.vectorBatchSize || 100
      })
    };
    
    // Define stage execution order
    this.stageOrder = ['clear', 'loadTools', 'generatePerspectives', 'generateEmbeddings', 'indexVectors'];
  }

  /**
   * Execute the complete pipeline
   */
  async execute(options = {}) {
    const startTime = Date.now();
    console.log('🚀 Starting Tool Registry Pipeline');
    console.log('=' + '='.repeat(59));
    
    // Check if we can resume from a previous run
    const canResume = await this.stateManager.canResume();
    let startStage = null;
    
    if (canResume && !options.forceRestart) {
      console.log('📋 Found existing pipeline state - checking for resume...');
      startStage = await this.determineStartStage();
      
      if (startStage) {
        console.log(`  Resuming from stage: ${startStage}`);
      } else {
        console.log('  Previous pipeline completed - starting fresh');
        await this.stateManager.reset();
      }
    } else {
      console.log('📋 Starting fresh pipeline run');
      await this.stateManager.reset();
    }
    
    // Store options in state for reference
    await this.stateManager.updateStageStatus('pipeline', 'in_progress', {
      options,
      startTime: new Date()
    });
    
    // Execute stages in order
    const stageResults = {};
    
    for (const stageName of this.stageOrder) {
      // Skip completed stages if resuming
      if (startStage && this.shouldSkipStage(stageName, startStage)) {
        console.log(`\n⏭️  Skipping completed stage: ${stageName}`);
        const state = await this.stateManager.getCurrentState();
        // Include the saved state data with success flag for consistency
        stageResults[stageName] = {
          ...state.stages[stageName],
          success: true,
          skipped: true
        };
        continue;
      }
      
      console.log(`\n${'='.repeat(60)}`);
      console.log(`🎯 Stage: ${stageName.toUpperCase()}`);
      console.log('='.repeat(60));
      
      // Update state to mark stage as in progress
      await this.stateManager.updateStageStatus(stageName, 'in_progress');
      
      try {
        // Execute the stage
        const stageOptions = this.getStageOptions(stageName, options);
        const result = await this.stages[stageName].execute(stageOptions);
        
        // Verify result has success flag
        if (!result || result.success === false) {
          throw new Error(`Stage ${stageName} failed verification: ${result?.message || 'Unknown error'}`);
        }
        
        // Store result and update state
        stageResults[stageName] = result;
        await this.stateManager.updateStageStatus(stageName, 'completed', result);
        
        console.log(`\n✅ Stage ${stageName} completed successfully`);
        
      } catch (error) {
        // Stage failed - update state and stop
        await this.stateManager.updateStageStatus(stageName, 'failed', {
          error: error.message,
          stack: error.stack
        });
        
        console.error(`\n❌ Stage ${stageName} failed: ${error.message}`);
        console.log('\n💡 You can resume this pipeline by running it again');
        
        throw error; // Stop pipeline - no rollback, just stop
      }
    }
    
    // All stages completed - run final verification
    console.log(`\n${'='.repeat(60)}`);
    console.log('🔍 FINAL VERIFICATION');
    console.log('='.repeat(60));
    
    const finalVerification = await this.verifier.runFinalVerification();
    
    if (!finalVerification.success) {
      console.error('❌ Final verification failed!');
      console.error('Issues found:', finalVerification.failedChecks);
      throw new Error('Pipeline completed but final verification failed');
    }
    
    // Generate final report
    const duration = Date.now() - startTime;
    const finalReport = await this.generateFinalReport(stageResults, finalVerification, duration);
    
    // Mark pipeline as complete
    await this.stateManager.markComplete(finalReport);
    
    // Display final report
    this.displayFinalReport(finalReport);
    
    return finalReport;
  }

  /**
   * Determine which stage to start from when resuming
   */
  async determineStartStage() {
    const state = await this.stateManager.getCurrentState();
    
    if (!state || !state.stages) {
      return 'clear'; // Start from beginning
    }
    
    // Find first incomplete stage
    for (const stageName of this.stageOrder) {
      const stageState = state.stages[stageName];
      if (!stageState || stageState.status !== 'completed') {
        return stageName;
      }
    }
    
    return null; // All stages complete
  }

  /**
   * Check if a stage should be skipped (already completed)
   */
  shouldSkipStage(stageName, startStage) {
    const startIndex = this.stageOrder.indexOf(startStage);
    const stageIndex = this.stageOrder.indexOf(stageName);
    return stageIndex < startIndex;
  }

  /**
   * Get options for a specific stage
   */
  getStageOptions(stageName, globalOptions) {
    const stageOptions = { ...globalOptions };
    
    // Add stage-specific options
    switch (stageName) {
      case 'clear':
        stageOptions.clearModules = globalOptions.clearModules || false;
        // Pass moduleName for module-specific clearing
        if (globalOptions.module) {
          stageOptions.moduleName = globalOptions.module;
        }
        break;
      case 'loadTools':
        stageOptions.module = globalOptions.module;
        break;
      case 'generatePerspectives':
        stageOptions.module = globalOptions.module;
        break;
      case 'generateEmbeddings':
        // Embeddings stage doesn't need module filter
        break;
      case 'indexVectors':
        // Vector stage doesn't need module filter
        break;
    }
    
    return stageOptions;
  }

  /**
   * Generate final report
   */
  async generateFinalReport(stageResults, finalVerification, duration) {
    // Get final counts
    const toolCount = await this.mongoProvider.count('tools', {});
    const perspectiveCount = await this.mongoProvider.count('tool_perspectives', {});
    const vectorCount = await this.vectorStore.count('legion_tools');
    
    // Ensure minimum duration of 1ms for test environments
    const finalDuration = Math.max(1, duration);
    
    return {
      success: true,
      duration: finalDuration,
      durationFormatted: this.formatDuration(finalDuration),
      timestamp: new Date(),
      
      counts: {
        tools: toolCount,
        perspectives: perspectiveCount,
        vectors: vectorCount,
        perspectivesPerTool: (perspectiveCount / Math.max(toolCount, 1)).toFixed(2),
        vectorsPerTool: (vectorCount / Math.max(toolCount, 1)).toFixed(2)
      },
      
      stages: stageResults,
      
      verification: {
        passed: finalVerification.success,
        checks: finalVerification.checks || []
      }
    };
  }

  /**
   * Display final report
   */
  displayFinalReport(report) {
    console.log('\n' + '='.repeat(60));
    console.log('📊 PIPELINE COMPLETE - FINAL REPORT');
    console.log('='.repeat(60));
    
    console.log('\n📈 Statistics:');
    console.log(`   Duration: ${report.durationFormatted}`);
    console.log(`   Tools: ${report.counts.tools}`);
    console.log(`   Perspectives: ${report.counts.perspectives} (${report.counts.perspectivesPerTool} per tool)`);
    console.log(`   Vectors: ${report.counts.vectors} (${report.counts.vectorsPerTool} per tool)`);
    
    console.log('\n✅ Verification:');
    if (report.verification.checks && report.verification.checks.length > 0) {
      for (const check of report.verification.checks) {
        const status = check.success ? '✓' : '✗';
        console.log(`   ${status} ${check.message}`);
      }
    }
    
    console.log('\n🎉 Pipeline completed successfully!');
    console.log('   All databases are synchronized and verified');
    console.log('='.repeat(60));
  }

  /**
   * Format duration in human readable format
   */
  formatDuration(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }

  /**
   * Get current pipeline progress
   */
  async getProgress() {
    return await this.stateManager.getProgress();
  }

}