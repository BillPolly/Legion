/**
 * RecoveryStrategy - Handles error recovery and replanning for failed tasks
 * Converted from RecoveryManager component to follow TaskStrategy pattern
 * 
 * Responsibilities:
 * - Classifies errors into types (TRANSIENT, RESOURCE, LOGIC, FATAL)
 * - Implements recovery strategies based on error type
 * - Manages retry logic with backoff strategies
 * - Handles resource cleanup and replanning
 * - Maintains checkpoints for rollback capabilities
 * - Tracks recovery statistics and metrics
 */

import { TaskStrategy } from '@legion/tasks';
import { EnhancedPromptRegistry } from '@legion/prompting-manager';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default class RecoveryStrategy extends TaskStrategy {
  constructor(llmClient = null, toolRegistry = null, configuration = {}) {
    super();
    
    this.llmClient = llmClient;
    this.toolRegistry = toolRegistry;
    this.projectPlanner = null; // Set externally
    const promptsPath = path.resolve(__dirname, '../../../prompts');
    this.promptRegistry = new EnhancedPromptRegistry(promptsPath);

    // Default configuration
    this.config = {
      maxRetries: {
        TRANSIENT: 3,
        RESOURCE: 2,
        LOGIC: 1,
        FATAL: 0
      },
      backoffStrategy: 'exponential',
      resourceCleanupEnabled: true,
      replanningEnabled: true,
      ...configuration
    };

    // Merge nested objects properly
    if (configuration.maxRetries) {
      this.config.maxRetries = {
        TRANSIENT: 3,
        RESOURCE: 2,
        LOGIC: 1,
        FATAL: 0,
        ...configuration.maxRetries
      };
    }

    // Recovery statistics
    this.stats = {
      byType: {
        TRANSIENT: { total: 0, successful: 0, failed: 0, successRate: 0 },
        RESOURCE: { total: 0, successful: 0, failed: 0, successRate: 0 },
        LOGIC: { total: 0, successful: 0, failed: 0, successRate: 0 },
        FATAL: { total: 0, successful: 0, failed: 0, successRate: 0 }
      },
      overall: { total: 0, successful: 0, failed: 0, successRate: 0 }
    };

    // Checkpoints for rollback
    this.checkpoints = new Map();
    this.checkpointCounter = 0;

    // Optional cache for resource cleanup
    this.cache = null;
  }

  getName() {
    return 'Recovery';
  }

  /**
   * Handle messages from parent task
   */
  async onParentMessage(parentTask, message) {
    switch (message.type) {
      case 'start':
      case 'recover':
        return await this._handleRecoveryRequest(message.task || parentTask, message.error, message.attempt);
      case 'checkpoint':
        return await this._handleCheckpointRequest(message.task || parentTask, message.state);
      case 'rollback':
        return await this._handleRollbackRequest(message.checkpointId);
      case 'stats':
        return { success: true, result: this.getRecoveryStatistics() };
      default:
        return { acknowledged: true };
    }
  }

  /**
   * Handle messages from child tasks
   */
  async onChildMessage(childTask, message) {
    const task = childTask.parent;
    if (!task) {
      throw new Error('Child task has no parent');
    }

    switch (message.type) {
      case 'completed':
        return { acknowledged: true };
      case 'failed':
        return { acknowledged: true };
      default:
        return { acknowledged: true };
    }
  }

  /**
   * Handle recovery request from parent task
   */
  async _handleRecoveryRequest(task, error, attempt = 1) {
    try {
      console.log(`🔄 RecoveryStrategy handling recovery for: ${task.description}`);
      
      // Add conversation entry
      task.addConversationEntry('system', 
        `Recovery attempt ${attempt} for error: ${error?.message || 'Unknown error'}`);
      
      // Perform recovery
      const result = await this.recover(error, task, attempt);
      
      // Store recovery result as artifact
      task.storeArtifact(
        'recovery-result',
        result,
        `Recovery result for attempt ${attempt}`,
        'recovery'
      );
      
      // Add conversation entry about completion
      task.addConversationEntry('system', 
        `Recovery ${result.success ? 'succeeded' : 'failed'}: ${result.action}`);
      
      console.log(`✅ RecoveryStrategy completed: ${result.action}`);
      
      return {
        success: result.success,
        result: result,
        artifacts: ['recovery-result']
      };
      
    } catch (error) {
      console.error(`❌ RecoveryStrategy failed: ${error.message}`);
      
      task.addConversationEntry('system', 
        `Recovery strategy failed: ${error.message}`);
      
      return {
        success: false,
        result: error.message
      };
    }
  }

  /**
   * Handle checkpoint creation request
   */
  async _handleCheckpointRequest(task, state) {
    try {
      const checkpointId = await this.createCheckpoint(state);
      
      task.storeArtifact(
        `checkpoint-${checkpointId}`,
        { checkpointId, state },
        `Recovery checkpoint ${checkpointId}`,
        'checkpoint'
      );
      
      return {
        success: true,
        result: { checkpointId },
        artifacts: [`checkpoint-${checkpointId}`]
      };
    } catch (error) {
      return {
        success: false,
        result: error.message
      };
    }
  }

  /**
   * Handle rollback request
   */
  async _handleRollbackRequest(checkpointId) {
    try {
      const result = await this.rollbackToCheckpoint(checkpointId);
      return {
        success: result.success,
        result: result
      };
    } catch (error) {
      return {
        success: false,
        result: error.message
      };
    }
  }

  /**
   * Get configuration
   */
  getConfiguration() {
    return { ...this.config };
  }

  /**
   * Main recovery method - determines strategy based on error type
   */
  async recover(error, task, attempt) {
    const errorType = this.classifyError(error);
    
    try {
      let result;
      
      switch (errorType) {
        case 'TRANSIENT':
          result = await this.retryWithBackoff(task, attempt);
          break;
          
        case 'RESOURCE':
          if (this.config.resourceCleanupEnabled) {
            await this.freeResources();
          }
          result = await this.retryTask(task);
          break;
          
        case 'LOGIC':
          if (this.config.replanningEnabled) {
            const replan = await this.replanTask(task, error);
            result = await this.executeReplan(replan);
          } else {
            result = await this.defaultRecovery(task, error);
          }
          break;
          
        case 'FATAL':
          await this.rollbackToCheckpoint();
          throw new Error(`Fatal error: ${error.message}`);
          
        default:
          result = await this.defaultRecovery(task, error);
      }

      this.recordRecoveryAttempt(errorType, result.success);
      return result;
      
    } catch (recoveryError) {
      this.recordRecoveryAttempt(errorType, false);
      throw recoveryError;
    }
  }

  /**
   * Classify error into recovery type
   */
  classifyError(error) {
    if (!error) {
      return 'LOGIC';
    }

    const message = error.message || error.toString() || '';
    const lowerMessage = message.toLowerCase();

    // TRANSIENT errors
    const transientPatterns = [
      'econnreset', 'connection reset', 'rate limit', 'timeout', 
      'temporary failure', 'service unavailable', 'network'
    ];
    
    if (transientPatterns.some(pattern => lowerMessage.includes(pattern))) {
      return 'TRANSIENT';
    }

    // RESOURCE errors
    const resourcePatterns = [
      'heap out of memory', 'out of memory', 'enospc', 'no space left',
      'quota exceeded', 'disk full', 'memory', 'resource'
    ];
    
    if (resourcePatterns.some(pattern => lowerMessage.includes(pattern))) {
      return 'RESOURCE';
    }

    // FATAL errors
    const fatalPatterns = [
      'state corruption', 'corrupted', 'system failure', 'unrecoverable',
      'data integrity', 'critical component unavailable'
    ];
    
    if (fatalPatterns.some(pattern => lowerMessage.includes(pattern))) {
      return 'FATAL';
    }

    // LOGIC errors (includes TypeError, validation errors, etc.)
    const logicPatterns = [
      'typeerror', 'invalid input', 'missing dependency', 'validation',
      'cannot read property', 'undefined', 'null'
    ];
    
    if (error instanceof TypeError || 
        logicPatterns.some(pattern => lowerMessage.includes(pattern))) {
      return 'LOGIC';
    }

    // Default to LOGIC for unknown errors
    return 'LOGIC';
  }

  /**
   * Retry with backoff strategy
   */
  async retryWithBackoff(task, attempt) {
    const maxAttempts = task.retry?.maxAttempts || this.config.maxRetries.TRANSIENT;
    
    if (attempt > maxAttempts) {
      return {
        success: false,
        action: 'max_retries_exceeded',
        reason: 'max_retries_exceeded',
        attempts: attempt
      };
    }

    const retryConfig = task.retry || {
      strategy: this.config.backoffStrategy,
      baseMs: 1000
    };

    const delay = this.calculateBackoff(attempt, retryConfig);

    return {
      success: true,
      action: 'retry',
      delay: delay,
      attempt: attempt,
      maxAttempts: maxAttempts
    };
  }

  /**
   * Calculate backoff delay
   */
  calculateBackoff(attempt, config) {
    const baseMs = config.baseMs || 1000;
    const strategy = config.strategy || 'exponential';

    switch (strategy) {
      case 'exponential':
        return baseMs * Math.pow(2, attempt - 1);
      case 'linear':
        return baseMs * attempt;
      case 'fixed':
        return baseMs;
      default:
        return baseMs * Math.pow(2, attempt - 1);
    }
  }

  /**
   * Retry task without backoff (for resource errors)
   */
  async retryTask(task) {
    return {
      success: true,
      action: 'retry_after_cleanup',
      task: task,
      cleanupPerformed: true
    };
  }

  /**
   * Free resources (memory, cache, etc.)
   */
  async freeResources() {
    // Trigger garbage collection if available
    if (global.gc) {
      global.gc();
    }

    // Clear cache if available
    if (this.cache && typeof this.cache.clear === 'function') {
      this.cache.clear();
    }

    return true;
  }

  /**
   * Analyze failure to understand root cause
   */
  async analyzeFailure(task, error) {
    if (!this.llmClient) {
      // Fallback analysis without LLM
      return {
        reason: 'unknown_failure',
        failedApproaches: [task.strategy],
        suggestedConstraints: {
          useValidation: true,
          avoidStrategies: [task.strategy]
        }
      };
    }

    try {
      const prompt = await this.promptRegistry.fill('coding/recovery/analyze-failure', {
        task: JSON.stringify(task, null, 2),
        error: error.message,
        errorType: error.constructor.name
      });

      const content = await this.llmClient.complete(prompt);
      return JSON.parse(content);
    } catch (analysisError) {
      console.error('Failure analysis failed:', analysisError);
      return {
        reason: 'analysis_failed',
        failedApproaches: [task.strategy],
        suggestedConstraints: {
          useSimpleApproach: true,
          avoidStrategies: [task.strategy]
        }
      };
    }
  }

  /**
   * Extract constraints from failure analysis
   */
  extractConstraints(analysis) {
    const constraints = { ...analysis.suggestedConstraints };
    
    if (analysis.failedApproaches) {
      constraints.avoidStrategies = analysis.failedApproaches;
    }

    return constraints;
  }

  /**
   * Replan task with constraints
   */
  async replanTask(task, error) {
    const analysis = await this.analyzeFailure(task, error);
    const constraints = this.extractConstraints(analysis);

    if (!this.projectPlanner) {
      throw new Error('Project planner not available for replanning');
    }

    return await this.projectPlanner.replan({
      originalTask: task,
      failureReason: analysis.reason,
      constraints: constraints,
      avoidStrategies: analysis.failedApproaches
    });
  }

  /**
   * Execute replanned tasks
   */
  async executeReplan(replan) {
    return {
      success: true,
      action: 'replan_executed',
      replan: replan,
      newTasks: replan?.tasks || []
    };
  }

  /**
   * Create checkpoint for rollback
   */
  async createCheckpoint(state) {
    const checkpointId = `checkpoint_${++this.checkpointCounter}`;
    
    // Ensure unique timestamps by adding a small increment if needed
    let timestamp = Date.now();
    const existingTimestamps = Array.from(this.checkpoints.values()).map(cp => cp.timestamp);
    while (existingTimestamps.includes(timestamp)) {
      timestamp++;
    }
    
    this.checkpoints.set(checkpointId, {
      id: checkpointId,
      state: JSON.parse(JSON.stringify(state)), // Deep copy
      timestamp: timestamp
    });

    return checkpointId;
  }

  /**
   * Get checkpoint by ID
   */
  getCheckpoint(checkpointId) {
    return this.checkpoints.get(checkpointId);
  }

  /**
   * Rollback to checkpoint
   */
  async rollbackToCheckpoint(checkpointId = null) {
    if (!checkpointId) {
      // Find latest checkpoint by comparing timestamps
      let latest = null;
      let latestTime = 0;
      
      for (const checkpoint of this.checkpoints.values()) {
        if (checkpoint.timestamp > latestTime) {
          latestTime = checkpoint.timestamp;
          latest = checkpoint;
        }
      }
      
      if (!latest) {
        return {
          success: false,
          error: 'No checkpoints available'
        };
      }
      
      return {
        success: true,
        action: 'rollback_completed',
        checkpointId: latest.id,
        state: latest.state,
        timestamp: latest.timestamp
      };
    }

    const checkpoint = this.checkpoints.get(checkpointId);
    
    if (!checkpoint) {
      return {
        success: false,
        error: `Checkpoint not found: ${checkpointId}`
      };
    }

    return {
      success: true,
      action: 'rollback_completed',
      checkpointId: checkpointId,
      state: checkpoint.state,
      timestamp: checkpoint.timestamp
    };
  }

  /**
   * Default recovery strategy
   */
  async defaultRecovery(task, error) {
    console.error('Recovery: Using default strategy for unknown error type', {
      taskId: task.id,
      error: error.message || error.toString()
    });

    return {
      success: true,
      action: 'log_and_continue',
      logged: true,
      task: task,
      error: error.message || error.toString()
    };
  }

  /**
   * Record recovery attempt for statistics
   */
  recordRecoveryAttempt(errorType, success) {
    if (!this.stats.byType[errorType]) {
      this.stats.byType[errorType] = { total: 0, successful: 0, failed: 0, successRate: 0 };
    }

    const typeStats = this.stats.byType[errorType];
    typeStats.total++;
    
    if (success) {
      typeStats.successful++;
    } else {
      typeStats.failed++;
    }
    
    typeStats.successRate = typeStats.total > 0 ? typeStats.successful / typeStats.total : 0;

    // Update overall stats
    this.stats.overall.total++;
    if (success) {
      this.stats.overall.successful++;
    } else {
      this.stats.overall.failed++;
    }
    
    this.stats.overall.successRate = this.stats.overall.total > 0 ? 
      this.stats.overall.successful / this.stats.overall.total : 0;
  }

  /**
   * Get recovery statistics
   */
  getRecoveryStatistics() {
    return JSON.parse(JSON.stringify(this.stats));
  }
}