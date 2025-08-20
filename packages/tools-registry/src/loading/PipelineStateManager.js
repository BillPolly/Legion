/**
 * PipelineStateManager - Manages pipeline execution state for resume capability
 * 
 * Single Responsibility: State management and persistence
 * Tracks progress through pipeline stages and enables resume from failure
 */

export class PipelineStateManager {
  constructor(mongoProvider) {
    this.mongoProvider = mongoProvider;
    this.stateCollection = 'pipeline_state';
    this.stateId = 'current_pipeline';
  }

  /**
   * Get the current pipeline state
   * @returns {Object} Current state or null if no state exists
   */
  async getCurrentState() {
    try {
      const state = await this.mongoProvider.findOne(this.stateCollection, {
        active: true
      });
      return state;
    } catch (error) {
      console.log('No existing pipeline state found');
      return null;
    }
  }

  /**
   * Update the status of a specific stage
   * @param {string} stage - Stage name
   * @param {string} status - Status: 'pending', 'in_progress', 'completed', 'failed'
   * @param {Object} metadata - Additional metadata for the stage
   */
  async updateStageStatus(stage, status, metadata = {}) {
    const timestamp = new Date();
    
    // First ensure we have an active state
    const existingState = await this.getCurrentState();
    if (!existingState) {
      // Create a new state if none exists
      await this.reset();
    }
    
    const update = {
      $set: {
        [`stages.${stage}.status`]: status,
        [`stages.${stage}.updatedAt`]: timestamp,
        currentStage: stage,
        lastUpdated: timestamp,
        active: true,
        status: 'in_progress'
      }
    };

    // Add metadata if provided
    if (Object.keys(metadata).length > 0) {
      for (const [key, value] of Object.entries(metadata)) {
        update.$set[`stages.${stage}.${key}`] = value;
      }
    }

    // Set canResume based on status
    if (status === 'failed') {
      update.$set.canResume = true;
      update.$set.lastError = metadata.error || 'Unknown error';
    } else if (status === 'completed') {
      update.$set[`stages.${stage}.completedAt`] = timestamp;
    }

    await this.mongoProvider.update(
      this.stateCollection,
      { active: true },
      update
    );

    return true;
  }

  /**
   * Record a checkpoint within a stage (for granular resume)
   * @param {string} stage - Stage name
   * @param {Object} checkpointData - Data to save at checkpoint
   */
  async recordCheckpoint(stage, checkpointData) {
    const update = {
      $set: {
        [`stages.${stage}.checkpoint`]: checkpointData,
        [`stages.${stage}.lastCheckpoint`]: new Date()
      }
    };

    // For array tracking (like processed tool IDs)
    if (checkpointData.processed) {
      update.$addToSet = {
        [`stages.${stage}.processed`]: checkpointData.processed
      };
      delete update.$set[`stages.${stage}.checkpoint`];
    }

    await this.mongoProvider.update(
      this.stateCollection,
      { active: true },
      update
    );

    return true;
  }

  /**
   * Check if pipeline can resume from current state
   * @returns {boolean} True if can resume
   */
  async canResume() {
    const state = await this.getCurrentState();
    
    if (!state) {
      return false;
    }

    // Can resume if last run didn't complete and we have checkpoint data
    return state.canResume === true && state.currentStage !== 'pipeline_complete';
  }

  /**
   * Reset the entire pipeline state
   */
  async reset() {
    // Mark any existing active states as inactive
    await this.mongoProvider.update(
      this.stateCollection,
      { active: true },
      { $set: { active: false } },
      { multi: true }
    );

    // Create fresh state
    const freshState = {
      active: true,
      status: 'in_progress',
      startedAt: new Date(),
      currentStage: null,
      canResume: false,
      stages: {
        clear: { status: 'pending' },
        loadTools: { status: 'pending' },
        generatePerspectives: { status: 'pending', processed: [] },
        generateEmbeddings: { status: 'pending', processedBatches: 0 },
        indexVectors: { status: 'pending', indexedBatches: 0 }
      }
    };

    await this.mongoProvider.insert(this.stateCollection, freshState);
    return freshState;
  }


  /**
   * Mark pipeline as complete with final statistics
   */
  async markComplete(statistics) {
    await this.updateStageStatus('pipeline_complete', 'completed', {
      ...statistics,
      completedAt: new Date(),
      duration: Date.now() - new Date(await this.getStartTime()).getTime()
    });

    // Update canResume to false and status to completed
    await this.mongoProvider.update(
      this.stateCollection,
      { active: true },
      { $set: { canResume: false, status: 'completed' } }
    );
  }

  /**
   * Get pipeline start time
   */
  async getStartTime() {
    const state = await this.getCurrentState();
    return state?.startedAt || new Date();
  }

  /**
   * Get current pipeline progress
   */
  async getProgress() {
    const state = await this.getCurrentState();
    
    if (!state || !state.active) {
      return null;
    }

    const allStages = ['clear', 'loadTools', 'generatePerspectives', 'generateEmbeddings', 'indexVectors'];
    const completedStages = [];
    let currentStage = null;
    
    for (const stage of allStages) {
      if (state.stages?.[stage]?.status === 'completed') {
        completedStages.push(stage);
      } else if (state.stages?.[stage]?.status === 'in_progress') {
        currentStage = stage;
      }
    }
    
    const percentComplete = (completedStages.length / allStages.length) * 100;
    
    return {
      currentStage,
      completedStages,
      percentComplete,
      isActive: state.active,
      startedAt: state.startedAt
    };
  }
}