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

/**
 * Create a RecoveryStrategy prototype
 * This factory function creates the strategy with its dependencies
 */
export function createRecoveryStrategy(llmClient = null, toolRegistry = null, configuration = {}) {
  // Create the strategy as an object that inherits from TaskStrategy
  const strategy = Object.create(TaskStrategy);
  
  // Store configuration in closure
  const config = {
    llmClient: llmClient,
    toolRegistry: toolRegistry,
    projectPlanner: null, // Set externally
    promptRegistry: null,

    // Default configuration
    options: {
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
    },

    // Recovery statistics
    stats: {
      byType: {
        TRANSIENT: { total: 0, successful: 0, failed: 0, successRate: 0 },
        RESOURCE: { total: 0, successful: 0, failed: 0, successRate: 0 },
        LOGIC: { total: 0, successful: 0, failed: 0, successRate: 0 },
        FATAL: { total: 0, successful: 0, failed: 0, successRate: 0 }
      },
      overall: { total: 0, successful: 0, failed: 0, successRate: 0 }
    },

    // Checkpoints for rollback
    checkpoints: new Map(),
    checkpointCounter: 0,

    // Optional cache for resource cleanup
    cache: null
  };
  
  // Initialize prompt registry
  const promptsPath = path.resolve(__dirname, '../../../prompts');
  config.promptRegistry = new EnhancedPromptRegistry(promptsPath);
  
  // Merge nested objects properly
  if (configuration.maxRetries) {
    config.options.maxRetries = {
      TRANSIENT: 3,
      RESOURCE: 2,
      LOGIC: 1,
      FATAL: 0,
      ...configuration.maxRetries
    };
  }

  /**
   * The only required method - handles all messages
   */
  strategy.onMessage = function onMessage(senderTask, message) {
    // 'this' is the task instance that received the message
    
    try {
      // Determine if message is from child or parent/initiator
      if (senderTask.parent === this) {
        // Message from child task
        switch (message.type) {
          case 'completed':
            console.log(`✅ Recovery child task completed: ${senderTask.description}`);
            this.send(this.parent, { type: 'child-completed', child: senderTask });
            break;
            
          case 'failed':
            this.send(this.parent, { type: 'child-failed', child: senderTask, error: message.error });
            break;
            
          default:
            console.log(`ℹ️ RecoveryStrategy received unhandled message from child: ${message.type}`);
        }
      } else {
        // Message from parent or initiator
        switch (message.type) {
          case 'start':
          case 'recover':
            // Fire-and-forget async operation with error boundary
            handleRecoveryRequest.call(this, config, message.task || senderTask, message.error, message.attempt).catch(error => {
              console.error(`❌ RecoveryStrategy async operation failed: ${error.message}`);
              // Don't let async errors escape - handle them internally
              try {
                this.fail(error);
                if (this.parent) {
                  this.send(this.parent, { type: 'failed', error });
                }
              } catch (innerError) {
                console.error(`❌ Failed to handle async error: ${innerError.message}`);
              }
            });
            break;
            
          case 'checkpoint':
            // Fire-and-forget async operation
            handleCheckpointRequest.call(this, config, message.task || senderTask, message.state).catch(error => {
              console.error(`❌ RecoveryStrategy checkpoint failed: ${error.message}`);
            });
            break;
            
          case 'rollback':
            // Fire-and-forget async operation
            handleRollbackRequest.call(this, config, message.checkpointId).catch(error => {
              console.error(`❌ RecoveryStrategy rollback failed: ${error.message}`);
            });
            break;
            
          case 'stats':
            // Fire-and-forget - respond via send
            this.send(senderTask, { type: 'stats-response', stats: getRecoveryStatistics(config) });
            break;
            
          case 'abort':
            console.log(`🛑 Recovery task aborted`);
            break;
            
          default:
            console.log(`ℹ️ RecoveryStrategy received unhandled message: ${message.type}`);
        }
      }
    } catch (error) {
      // Catch any synchronous errors in message handling
      console.error(`❌ RecoveryStrategy message handler error: ${error.message}`);
      // Don't let errors escape the message handler - handle them gracefully
      try {
        if (this.addConversationEntry) {
          this.addConversationEntry('system', `Message handling error: ${error.message}`);
        }
      } catch (innerError) {
        console.error(`❌ Failed to log message handling error: ${innerError.message}`);
      }
    }
  };
  
  return strategy;
}

// Export default for backward compatibility
export default createRecoveryStrategy;

// ============================================================================
// Internal implementation functions
// These work with the task instance and strategy config
// ============================================================================

/**
 * Handle recovery request from parent task
 * Called with task as 'this' context
 */
async function handleRecoveryRequest(config, task, error, attempt = 1) {
    try {
      console.log(`🔄 RecoveryStrategy handling recovery for: ${task.description}`);
      
      // Add conversation entry
      task.addConversationEntry('system', 
        `Recovery attempt ${attempt} for error: ${error?.message || 'Unknown error'}`);
      
      // Perform recovery
      const result = await recover(config, error, task, attempt);
      
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
      
      const finalResult = {
        success: result.success,
        result: result,
        artifacts: ['recovery-result']
      };
      
      this.complete(finalResult);
      
      // Notify parent if exists (fire-and-forget message passing)
      if (this.parent) {
        this.send(this.parent, { type: 'completed', result: finalResult });
      }
      
      // Fire-and-forget - no return value
      
    } catch (error) {
      console.error(`❌ RecoveryStrategy failed: ${error.message}`);
      
      task.addConversationEntry('system', 
        `Recovery strategy failed: ${error.message}`);
      
      this.fail(error);
      
      // Notify parent of failure if exists (fire-and-forget message passing)
      if (this.parent) {
        this.send(this.parent, { type: 'failed', error });
      }
      
      // Fire-and-forget - no return value
    }
  }

/**
 * Handle checkpoint creation request
 * Called with task as 'this' context
 */
async function handleCheckpointRequest(config, task, state) {
  try {
    const checkpointId = await createCheckpoint(config, state);
      
      task.storeArtifact(
        `checkpoint-${checkpointId}`,
        { checkpointId, state },
        `Recovery checkpoint ${checkpointId}`,
        'checkpoint'
      );
      
    const result = {
      success: true,
      result: { checkpointId },
      artifacts: [`checkpoint-${checkpointId}`]
    };
    
    this.send(this.parent || task, { type: 'checkpoint-response', result });
    
    // Fire-and-forget - no return value
    
  } catch (error) {
    this.send(this.parent || task, { type: 'checkpoint-error', error: error.message });
    
    // Fire-and-forget - no return value
  }
}

/**
 * Handle rollback request
 * Called with task as 'this' context
 */
async function handleRollbackRequest(config, checkpointId) {
  try {
    const result = await rollbackToCheckpoint(config, checkpointId);
    
    this.send(this.parent, { type: 'rollback-response', result });
    
    // Fire-and-forget - no return value
    
  } catch (error) {
    this.send(this.parent, { type: 'rollback-error', error: error.message });
    
    // Fire-and-forget - no return value
  }
}

/**
 * Get configuration from config
 */
function getConfiguration(config) {
  return { ...config };
}

/**
 * Main recovery method - determines strategy based on error type
 */
async function recover(config, error, task, attempt) {
  const errorType = classifyError(error);
  
  try {
    let result;
    
    switch (errorType) {
      case 'TRANSIENT':
        result = await retryWithBackoff(config, task, attempt);
        break;
        
      case 'RESOURCE':
        if (config.options.resourceCleanupEnabled) {
          await freeResources(config);
        }
        result = await retryTask(config, task);
        break;
        
      case 'LOGIC':
        if (config.options.replanningEnabled) {
          const replan = await replanTask(config, task, error);
          result = await executeReplan(config, replan);
        } else {
          result = await defaultRecovery(config, task, error);
        }
        break;
        
      case 'FATAL':
        await rollbackToCheckpoint(config);
        throw new Error(`Fatal error: ${error.message}`);
        
      default:
        result = await defaultRecovery(config, task, error);
    }

    recordRecoveryAttempt(config, errorType, result.success);
    return result;
    
  } catch (recoveryError) {
    recordRecoveryAttempt(config, errorType, false);
    throw recoveryError;
  }
}

/**
 * Classify error into recovery type
 */
function classifyError(error) {
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
async function retryWithBackoff(config, task, attempt) {
  const maxAttempts = task.retry?.maxAttempts || config.options.maxRetries.TRANSIENT;
  
  if (attempt > maxAttempts) {
    return {
      success: false,
      action: 'max_retries_exceeded',
      reason: 'max_retries_exceeded',
      attempts: attempt
    };
  }

  const retryConfig = task.retry || {
    strategy: config.options.backoffStrategy,
    baseMs: 1000
  };

  const delay = calculateBackoff(attempt, retryConfig);

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
function calculateBackoff(attempt, config) {
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
async function retryTask(config, task) {
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
async function freeResources(config) {
  // Trigger garbage collection if available
  if (global.gc) {
    global.gc();
  }

  // Clear cache if available
  if (config.cache && typeof config.cache.clear === 'function') {
    config.cache.clear();
  }

  return true;
}

/**
 * Analyze failure to understand root cause
 */
async function analyzeFailure(config, task, error) {
  if (!config.llmClient) {
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
    const prompt = await config.promptRegistry.fill('coding/recovery/analyze-failure', {
      task: JSON.stringify(task, null, 2),
      error: error.message,
      errorType: error.constructor.name
    });

    const content = await config.llmClient.complete(prompt);
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
function extractConstraints(analysis) {
  const constraints = { ...analysis.suggestedConstraints };
  
  if (analysis.failedApproaches) {
    constraints.avoidStrategies = analysis.failedApproaches;
  }

  return constraints;
}

/**
 * Replan task with constraints
 */
async function replanTask(config, task, error) {
  const analysis = await analyzeFailure(config, task, error);
  const constraints = extractConstraints(analysis);

  if (!config.projectPlanner) {
    throw new Error('Project planner not available for replanning');
  }

  return await config.projectPlanner.replan({
    originalTask: task,
    failureReason: analysis.reason,
    constraints: constraints,
    avoidStrategies: analysis.failedApproaches
  });
}

/**
 * Execute replanned tasks
 */
async function executeReplan(config, replan) {
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
async function createCheckpoint(config, state) {
  const checkpointId = `checkpoint_${++config.checkpointCounter}`;
  
  // Ensure unique timestamps by adding a small increment if needed
  let timestamp = Date.now();
  const existingTimestamps = Array.from(config.checkpoints.values()).map(cp => cp.timestamp);
  while (existingTimestamps.includes(timestamp)) {
    timestamp++;
  }
  
  config.checkpoints.set(checkpointId, {
    id: checkpointId,
    state: JSON.parse(JSON.stringify(state)), // Deep copy
    timestamp: timestamp
  });

  return checkpointId;
}

/**
 * Get checkpoint by ID
 */
function getCheckpoint(config, checkpointId) {
  return config.checkpoints.get(checkpointId);
}

/**
 * Rollback to checkpoint
 */
async function rollbackToCheckpoint(config, checkpointId = null) {
  if (!checkpointId) {
    // Find latest checkpoint by comparing timestamps
    let latest = null;
    let latestTime = 0;
    
    for (const checkpoint of config.checkpoints.values()) {
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

  const checkpoint = config.checkpoints.get(checkpointId);
  
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
async function defaultRecovery(config, task, error) {
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
function recordRecoveryAttempt(config, errorType, success) {
  if (!config.stats.byType[errorType]) {
    config.stats.byType[errorType] = { total: 0, successful: 0, failed: 0, successRate: 0 };
  }

  const typeStats = config.stats.byType[errorType];
  typeStats.total++;
  
  if (success) {
    typeStats.successful++;
  } else {
    typeStats.failed++;
  }
  
  typeStats.successRate = typeStats.total > 0 ? typeStats.successful / typeStats.total : 0;

  // Update overall stats
  config.stats.overall.total++;
  if (success) {
    config.stats.overall.successful++;
  } else {
    config.stats.overall.failed++;
  }
  
  config.stats.overall.successRate = config.stats.overall.total > 0 ? 
    config.stats.overall.successful / config.stats.overall.total : 0;
}

/**
 * Get recovery statistics
 */
function getRecoveryStatistics(config) {
  return JSON.parse(JSON.stringify(config.stats));
}