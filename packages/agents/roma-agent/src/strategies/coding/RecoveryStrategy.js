/**
 * RecoveryStrategy - Handles error recovery and system resilience
 * Uses StandardTaskStrategy to eliminate all boilerplate
 */

import { createTypedStrategy } from '../utils/StandardTaskStrategy.js';

/**
 * Create the strategy using the ultimate abstraction
 * ALL factory and initialization boilerplate is eliminated!
 */
export const createRecoveryStrategy = createTypedStrategy(
  'coding-recovery',                                     // Strategy type for prompt path resolution
  ['file_write', 'file_read', 'command_executor'],       // Required tools (loaded at construction)
  {                                                      // Prompt names (schemas come from YAML frontmatter)
    analyzeFailure: 'analyzeFailure',
    createRecoveryPlan: 'createRecoveryPlan',
    implementRecovery: 'implementRecovery',
    validateRecovery: 'validateRecovery'
  },
  {
    maxRecoveryAttempts: 3,                              // Additional config
    backoffDelay: 2000,
    preserveState: true
  }
);

// Export default for backward compatibility
export default createRecoveryStrategy;

/**
 * Core strategy implementation - the ONLY thing we need to implement!
 * All boilerplate (error handling, message routing, tool loading, etc.) is handled automatically
 */
createRecoveryStrategy.doWork = async function doWork() {
  console.log(`🚨 RecoveryStrategy handling failure: ${this.description}`);
  
  // Get failure information from artifacts or description
  const failureInfo = await getFailureInfo(this);
  if (!failureInfo) {
    return this.failWithError(new Error('No failure information found'), 'Cannot recover without failure details');
  }
  
  this.addConversationEntry('system', `Analyzing ${failureInfo.type} failure: ${failureInfo.message}`);
  
  // Analyze the failure using declarative prompt (schema in YAML frontmatter)
  const analysisPrompt = this.getPrompt('analyzeFailure');
  const analysisResult = await analysisPrompt.execute({
    failureType: failureInfo.type,
    errorMessage: failureInfo.message,
    stackTrace: failureInfo.stackTrace || '',
    context: failureInfo.context || {},
    systemState: failureInfo.systemState || {}
  });
  
  if (!analysisResult.success) {
    return this.failWithError(
      new Error(`Failure analysis failed: ${analysisResult.errors?.join(', ')}`),
      'Could not analyze the failure'
    );
  }
  
  const analysis = analysisResult.data;
  this.addConversationEntry('system', `Root cause: ${analysis.rootCause}, Severity: ${analysis.severity}`);
  
  // Create recovery plan using declarative prompt
  const planPrompt = this.getPrompt('createRecoveryPlan');
  const planResult = await planPrompt.execute({
    analysis: analysis,
    maxAttempts: this.config.maxRecoveryAttempts,
    preserveState: this.config.preserveState,
    availableResources: {
      tools: Object.keys(this.config.tools),
      artifacts: Object.keys(this.getAllArtifacts())
    }
  });
  
  if (!planResult.success) {
    return this.failWithError(
      new Error(`Recovery plan creation failed: ${planResult.errors?.join(', ')}`),
      'Could not create recovery plan'
    );
  }
  
  const recoveryPlan = planResult.data;
  this.addConversationEntry('system', `Created recovery plan with ${recoveryPlan.steps?.length || 0} steps`);
  
  // Execute recovery steps
  const recoveryResults = [];
  for (let i = 0; i < recoveryPlan.steps.length; i++) {
    const step = recoveryPlan.steps[i];
    
    console.log(`🔧 Executing recovery step ${i + 1}: ${step.description}`);
    
    const stepResult = await executeRecoveryStep(step, this);
    recoveryResults.push(stepResult);
    
    if (!stepResult.success) {
      this.addConversationEntry('system', `Recovery step ${i + 1} failed: ${stepResult.error}`);
      
      // If this was a critical step, fail the entire recovery
      if (step.critical) {
        return this.failWithError(
          new Error(`Critical recovery step failed: ${stepResult.error}`),
          `Recovery failed at step ${i + 1}`
        );
      }
    } else {
      this.addConversationEntry('system', `Recovery step ${i + 1} completed successfully`);
    }
  }
  
  // Validate recovery success using declarative prompt
  const validatePrompt = this.getPrompt('validateRecovery');
  const validationResult = await validatePrompt.execute({
    originalFailure: failureInfo,
    recoveryPlan: recoveryPlan,
    recoveryResults: recoveryResults,
    currentState: 'recovered' // simplified for this abstraction
  });
  
  const validation = validationResult.success ? validationResult.data : { recovered: false };
  
  // Complete with artifacts using built-in helper (handles parent notification automatically)
  const artifacts = {
    'failure-analysis': {
      value: JSON.stringify(analysis, null, 2),
      description: `Failure analysis: ${analysis.rootCause}`,
      type: 'json'
    },
    'recovery-plan': {
      value: JSON.stringify(recoveryPlan, null, 2),
      description: `Recovery plan with ${recoveryPlan.steps?.length || 0} steps`,
      type: 'json'
    },
    'recovery-results': {
      value: JSON.stringify(recoveryResults, null, 2),
      description: 'Results from recovery step execution',
      type: 'json'
    }
  };
  
  if (validation.recovered) {
    artifacts['recovery-validation'] = {
      value: JSON.stringify(validation, null, 2),
      description: 'Recovery validation confirmation',
      type: 'json'
    };
  }
  
  this.completeWithArtifacts(artifacts, {
    success: validation.recovered,
    message: validation.recovered ? 'System recovery completed successfully' : 'Recovery partially completed',
    rootCause: analysis.rootCause,
    severity: analysis.severity,
    stepsExecuted: recoveryResults.length,
    stepsSuccessful: recoveryResults.filter(r => r.success).length,
    fullyRecovered: validation.recovered
  });
};

// ============================================================================
// Helper functions - now much simpler since all boilerplate is handled
// ============================================================================

async function getFailureInfo(task) {
  // Try to get failure info from artifacts first
  const artifacts = task.getAllArtifacts();
  for (const artifact of Object.values(artifacts)) {
    if (artifact.type === 'error' || artifact.name.includes('error') || artifact.name.includes('failure')) {
      return {
        type: 'system_error',
        message: artifact.value,
        context: artifact.description,
        stackTrace: artifact.stackTrace,
        systemState: artifact.systemState
      };
    }
  }
  
  // Extract failure info from task description
  const failureTypes = ['error', 'failure', 'crash', 'exception', 'timeout'];
  for (const type of failureTypes) {
    if (task.description.toLowerCase().includes(type)) {
      return {
        type: type,
        message: task.description,
        context: 'Extracted from task description'
      };
    }
  }
  
  // Default to treating description as generic failure
  return {
    type: 'unknown_failure',
    message: task.description,
    context: 'Task description used as failure context'
  };
}

async function executeRecoveryStep(step, task) {
  try {
    let result;
    
    switch (step.type) {
      case 'command':
        result = await task.config.tools.command_executor.execute({
          command: step.command,
          cwd: step.workingDirectory
        });
        break;
        
      case 'file_restore':
        if (step.backupPath && step.targetPath) {
          const backupContent = await task.config.tools.file_read.execute({
            filepath: step.backupPath
          });
          result = await task.config.tools.file_write.execute({
            filepath: step.targetPath,
            content: backupContent.content
          });
        }
        break;
        
      case 'state_reset':
        // Simplified state reset - in real implementation would interact with system state
        result = { success: true, message: 'State reset completed' };
        break;
        
      case 'service_restart':
        if (step.service) {
          result = await task.config.tools.command_executor.execute({
            command: `systemctl restart ${step.service}` // simplified
          });
        }
        break;
        
      default:
        result = { success: false, message: `Unknown recovery step type: ${step.type}` };
    }
    
    return {
      success: result.success,
      step: step.description,
      result: result
    };
    
  } catch (error) {
    return {
      success: false,
      step: step.description,
      error: error.message
    };
  }
}