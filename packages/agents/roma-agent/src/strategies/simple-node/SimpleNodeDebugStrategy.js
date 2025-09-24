/**
 * SimpleNodeDebugStrategy - Strategy for debugging Node.js applications
 * Uses StandardTaskStrategy to eliminate all boilerplate
 */

import { createTypedStrategy } from '../utils/StandardTaskStrategy.js';
import path from 'path';

/**
 * Create the strategy using the ultimate abstraction
 * ALL factory and initialization boilerplate is eliminated!
 */
export const createSimpleNodeDebugStrategy = createTypedStrategy(
  'simple-node-debug',                                   // Strategy type for prompt path resolution
  ['file_write', 'file_read', 'command_executor'],       // Required tools (loaded at construction)
  {                                                      // Prompt names (schemas come from YAML frontmatter)
    analyzeError: 'analyzeError',
    generateFix: 'generateFix',
    validateSolution: 'validateSolution'
  },
  {
    projectRoot: '/tmp/roma-projects'                    // Additional config
  }
);

// Export default for backward compatibility
export default createSimpleNodeDebugStrategy;

/**
 * Core strategy implementation - the ONLY thing we need to implement!
 * All boilerplate (error handling, message routing, tool loading, etc.) is handled automatically
 */
createSimpleNodeDebugStrategy.doWork = async function doWork() {
  console.log(`🔧 Debugging Node.js application: ${this.description}`);
  
  // Get error information from artifacts or description
  const errorInfo = await getErrorInfo(this);
  if (!errorInfo) {
    return this.failWithError(new Error('No error information found'), 'Cannot debug without error details');
  }
  
  // Analyze the error using declarative prompt (schema in YAML frontmatter)
  const analyzePrompt = this.getPrompt('analyzeError');
  const analysisResult = await analyzePrompt.execute({
    errorMessage: errorInfo.message,
    stackTrace: errorInfo.stackTrace || '',
    code: errorInfo.code || '',
    context: errorInfo.context || this.description
  });
  
  if (!analysisResult.success) {
    return this.failWithError(
      new Error(`Failed to analyze error: ${analysisResult.errors?.join(', ')}`),
      'Error analysis step failed'
    );
  }
  
  const analysis = analysisResult.data;
  this.addConversationEntry('system', `Identified ${analysis.errorType} error: ${analysis.rootCause}`);
  
  // Generate fix using declarative prompt
  const fixPrompt = this.getPrompt('generateFix');
  const fixResult = await fixPrompt.execute({
    problem: errorInfo.message,
    rootCause: analysis.rootCause,
    location: analysis.location,
    originalCode: errorInfo.code || '',
    suggestedFix: analysis.suggestedFix
  });
  
  if (!fixResult.success) {
    return this.failWithError(
      new Error(`Failed to generate fix: ${fixResult.errors?.join(', ')}`),
      'Fix generation failed'
    );
  }
  
  const fix = fixResult.data;
  
  // Write fixed code if we have a file location
  if (analysis.location && analysis.location.file && fix.fixedCode) {
    const fixedFilePath = path.join(this.config.projectRoot, `fixed-${Date.now()}-${path.basename(analysis.location.file)}`);
    await this.config.tools.file_write.execute({
      filepath: fixedFilePath,
      content: fix.fixedCode
    });
    
    // Validate the solution if possible
    if (this.description.includes('test') || this.description.includes('validate')) {
      const validationResult = await validateFix(fix, analysis, this);
      if (validationResult) {
        this.addConversationEntry('system', `Fix validation: ${validationResult.result}`);
      }
    }
  }
  
  // Complete with artifacts using built-in helper (handles parent notification automatically)
  const artifacts = {
    'error-analysis': {
      value: JSON.stringify(analysis, null, 2),
      description: `Error analysis: ${analysis.errorType}`,
      type: 'json'
    },
    'debug-fix': {
      value: fix.explanation,
      description: 'Debug solution and explanation',
      type: 'text'
    }
  };
  
  if (fix.fixedCode) {
    artifacts['fixed-code'] = {
      value: fix.fixedCode,
      description: 'Fixed code implementation',
      type: 'file'
    };
  }
  
  this.completeWithArtifacts(artifacts, {
    success: true,
    message: `Identified and fixed ${analysis.errorType} error`,
    errorType: analysis.errorType,
    rootCause: analysis.rootCause,
    confidence: analysis.confidence,
    hasFixedCode: !!fix.fixedCode
  });
};

// ============================================================================
// Helper functions - now much simpler since all boilerplate is handled
// ============================================================================

async function getErrorInfo(task) {
  // Try to get error info from artifacts first
  const artifacts = task.getAllArtifacts();
  for (const artifact of Object.values(artifacts)) {
    if (artifact.type === 'error' || artifact.name.includes('error')) {
      return {
        message: artifact.value,
        stackTrace: artifact.stackTrace,
        code: artifact.code,
        context: artifact.description
      };
    }
  }
  
  // Try to extract error from description
  const errorMatch = task.description.match(/error[:\s](.+?)(?:\n|$)/i);
  if (errorMatch) {
    return {
      message: errorMatch[1],
      context: task.description
    };
  }
  
  // Check if description contains stack trace patterns
  if (task.description.includes('at ') && task.description.includes('.js:')) {
    return {
      message: task.description.split('\n')[0],
      stackTrace: task.description,
      context: 'Stack trace from task description'
    };
  }
  
  // Fall back to treating entire description as error context
  return {
    message: task.description,
    context: 'Full task description used as error context'
  };
}

async function validateFix(fix, analysis, task) {
  if (!fix.fixedCode || !task.config.tools.command_executor) {
    return null;
  }
  
  try {
    const validatePrompt = task.getPrompt('validateSolution');
    const result = await validatePrompt.execute({
      originalProblem: analysis.rootCause,
      proposedSolution: fix.explanation,
      fixedCode: fix.fixedCode
    });
    
    return result.success ? result.data : null;
  } catch (error) {
    console.log(`Could not validate fix: ${error.message}`);
    return null;
  }
}