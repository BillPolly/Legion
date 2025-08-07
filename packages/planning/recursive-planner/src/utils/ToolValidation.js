/**
 * Tool Validation Utilities
 * 
 * Utilities for validating tool calls against tool metadata and
 * providing proper error feedback to the LLM for replanning.
 */

/**
 * Validate tool parameters against tool metadata schema
 */
export function validateToolParameters(params, toolMetadata) {
  const errors = [];
  const schema = toolMetadata.input || {};
  
  // Check required parameters
  for (const [paramName, paramType] of Object.entries(schema)) {
    const isOptional = paramType.endsWith('?');
    const cleanType = paramType.replace('?', '');
    
    if (!isOptional && !(paramName in params)) {
      errors.push(`Missing required parameter: ${paramName} (${cleanType})`);
    }
    
    // Check parameter type if provided
    if (paramName in params) {
      const value = params[paramName];
      const actualType = typeof value;
      
      // Basic type checking
      if (cleanType === 'string' && actualType !== 'string') {
        errors.push(`Parameter ${paramName} must be string, got ${actualType}`);
      } else if (cleanType === 'number' && actualType !== 'number') {
        errors.push(`Parameter ${paramName} must be number, got ${actualType}`);
      } else if (cleanType === 'boolean' && actualType !== 'boolean') {
        errors.push(`Parameter ${paramName} must be boolean, got ${actualType}`);
      }
    }
  }
  
  // Check for unexpected parameters
  const expectedParams = Object.keys(schema);
  const providedParams = Object.keys(params);
  
  for (const provided of providedParams) {
    if (!expectedParams.includes(provided)) {
      errors.push(`Unexpected parameter: ${provided}. Expected: ${expectedParams.join(', ')}`);
    }
  }
  
  return {
    valid: errors.length === 0,
    errors,
    suggestions: errors.length > 0 ? generateSuggestions(params, schema) : []
  };
}

/**
 * Generate suggestions for fixing parameter errors
 */
function generateSuggestions(params, schema) {
  const suggestions = [];
  const expectedParams = Object.keys(schema);
  const providedParams = Object.keys(params);
  
  // Suggest corrections for common naming mistakes
  const commonMappings = {
    'filename': 'path',
    'file': 'path',
    'filepath': 'path',
    'data': 'content',
    'text': 'content',
    'body': 'content',
    'value': 'content'
  };
  
  for (const provided of providedParams) {
    if (!expectedParams.includes(provided)) {
      const suggestion = commonMappings[provided];
      if (suggestion && expectedParams.includes(suggestion)) {
        suggestions.push(`Change '${provided}' to '${suggestion}'`);
      }
    }
  }
  
  return suggestions;
}

/**
 * Create error feedback message for LLM replanning
 */
export function createErrorFeedback(step, error, toolMetadata, availableTools) {
  const validation = validateToolParameters(step.params || {}, toolMetadata);
  
  let feedback = `Tool execution failed for step "${step.description}":\n\n`;
  
  feedback += `Step details:\n`;
  feedback += `- Tool: ${step.tool}\n`;
  feedback += `- Parameters used: ${JSON.stringify(step.params, null, 2)}\n`;
  feedback += `- Error: ${error.message}\n\n`;
  
  if (!validation.valid) {
    feedback += `Parameter validation errors:\n`;
    for (const err of validation.errors) {
      feedback += `- ${err}\n`;
    }
    feedback += `\n`;
    
    if (validation.suggestions.length > 0) {
      feedback += `Suggestions to fix:\n`;
      for (const suggestion of validation.suggestions) {
        feedback += `- ${suggestion}\n`;
      }
      feedback += `\n`;
    }
  }
  
  feedback += `Tool specification for ${step.tool}:\n`;
  feedback += `- Description: ${toolMetadata.description}\n`;
  feedback += `- Required parameters: ${JSON.stringify(toolMetadata.input, null, 2)}\n`;
  feedback += `- Expected output: ${JSON.stringify(toolMetadata.output, null, 2)}\n\n`;
  
  feedback += `Available tools:\n`;
  for (const tool of availableTools.slice(0, 5)) { // Limit to prevent token overflow
    feedback += `- ${tool.name}: ${tool.description || 'No description'}\n`;
  }
  
  feedback += `\nPlease revise the plan to fix these parameter errors and ensure the step will succeed.`;
  
  return feedback;
}

/**
 * Wrap tool execution with validation and error handling
 */
export function createValidatingToolWrapper(tool, availableTools = []) {
  return {
    name: tool.name,
    description: tool.description,
    getMetadata: tool.getMetadata ? tool.getMetadata.bind(tool) : () => ({ description: tool.description }),
    
    execute: async (input) => {
      const metadata = tool.getMetadata ? tool.getMetadata() : { description: tool.description, input: {}, output: {} };
      
      // Pre-execution validation
      const validation = validateToolParameters(input, metadata);
      
      if (!validation.valid) {
        throw new Error(`Tool parameter validation failed: ${validation.errors.join(', ')}. Suggestions: ${validation.suggestions.join(', ')}`);
      }
      
      // Execute tool with error handling
      try {
        const result = await tool.execute(input);
        
        // Check if result indicates failure
        if (result && typeof result === 'object') {
          if (result.success === false) {
            throw new Error(result.data?.errorMessage || `Tool ${tool.name} failed`);
          }
        }
        
        return result;
      } catch (error) {
        // Create detailed error message for LLM feedback
        const step = { tool: tool.name, params: input, description: `Execute ${tool.name}` };
        const feedback = createErrorFeedback(step, error, metadata, availableTools);
        
        // Throw enhanced error with feedback
        const enhancedError = new Error(feedback);
        enhancedError.originalError = error;
        enhancedError.toolValidation = validation;
        enhancedError.toolMetadata = metadata;
        
        throw enhancedError;
      }
    }
  };
}