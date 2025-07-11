/**
 * Validates parsed responses against expected schema and tool definitions
 */
class ResponseValidator {
  constructor(tools = []) {
    this.tools = tools;
  }

  /**
   * Validate the complete response structure
   * @param {Object} response - The parsed response object
   * @returns {{valid: boolean, errors: string[]}}
   */
  validateResponse(response) {
    const errors = [];

    // Check if response is an object
    if (!response || typeof response !== 'object') {
      return {
        valid: false,
        errors: ['Response must be an object']
      };
    }

    // Check required fields
    if (!('task_completed' in response)) {
      errors.push('Missing required field: task_completed');
    } else if (typeof response.task_completed !== 'boolean') {
      errors.push('task_completed must be a boolean');
    }

    if (!('response' in response)) {
      errors.push('Missing required field: response');
    } else if (typeof response.response !== 'object' || response.response === null) {
      errors.push('response must be an object');
    } else {
      // Validate response object structure
      if (!response.response.type) {
        errors.push('response.type is required');
      }
      if (!('message' in response.response)) {
        errors.push('response.message is required');
      }
    }

    // If use_tool is present, validate it
    if ('use_tool' in response && response.use_tool !== null) {
      const toolValidation = this.validateToolUse(response.use_tool);
      if (!toolValidation.valid) {
        errors.push(...toolValidation.errors);
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate tool use structure and match against available tools
   * @param {Object} toolUse - The use_tool object
   * @returns {{valid: boolean, errors: string[], suggestions?: Object}}
   */
  validateToolUse(toolUse) {
    const errors = [];
    let suggestions;

    // Check required fields
    if (!toolUse.identifier) {
      errors.push('Missing required field: identifier');
    }
    if (!toolUse.function_name) {
      errors.push('Missing required field: function_name');
    }
    if (!('args' in toolUse)) {
      errors.push('Missing required field: args');
    } else if (!Array.isArray(toolUse.args)) {
      errors.push('args must be an array');
    }

    // If basic structure is invalid, return early
    if (errors.length > 0) {
      return { valid: false, errors };
    }

    // Find the tool
    const tool = this.findToolByIdentifier(toolUse.identifier);
    if (!tool) {
      errors.push(`Unknown tool identifier: ${toolUse.identifier}`);
      
      // Try fuzzy matching for suggestions
      const suggestedTool = this.findSimilarTool(toolUse.identifier);
      if (suggestedTool) {
        suggestions = { tool: suggestedTool.identifier };
      }
    } else {
      // Find the function
      const func = this.findFunction(tool, toolUse.function_name);
      if (!func) {
        errors.push(`Unknown function: ${toolUse.function_name} for tool: ${toolUse.identifier}`);
        
        // Try fuzzy matching for function suggestions
        const suggestedFunc = this.findSimilarFunction(tool, toolUse.function_name);
        if (suggestedFunc) {
          suggestions = { function: suggestedFunc.name };
        }
      } else {
        // Validate arguments
        const argErrors = this.validateArguments(func, toolUse.args);
        errors.push(...argErrors);
      }
    }

    const result = {
      valid: errors.length === 0,
      errors
    };

    if (suggestions) {
      result.suggestions = suggestions;
    }

    return result;
  }

  /**
   * Validate function arguments
   */
  validateArguments(func, providedArgs) {
    const errors = [];
    const requiredArgs = func.arguments || [];

    // Check each required argument
    requiredArgs.forEach((arg, index) => {
      if (arg.required !== false) { // Default to required if not specified
        if (providedArgs.length <= index) {
          errors.push(`Missing required argument at position ${index} for function: ${func.name}`);
        }
      }
    });

    return errors;
  }

  /**
   * Find tool by identifier
   */
  findToolByIdentifier(identifier) {
    return this.tools.find(tool => tool.identifier === identifier) || null;
  }

  /**
   * Find function in tool
   */
  findFunction(tool, functionName) {
    return tool.functions.find(func => func.name === functionName) || null;
  }

  /**
   * Find similar tool using fuzzy matching
   */
  findSimilarTool(identifier) {
    let bestMatch = null;
    let bestScore = 0;

    for (const tool of this.tools) {
      const score = this.similarity(identifier.toLowerCase(), tool.identifier.toLowerCase());
      if (score > 0.7 && score > bestScore) { // 70% similarity threshold
        bestScore = score;
        bestMatch = tool;
      }
    }

    return bestMatch;
  }

  /**
   * Find similar function using fuzzy matching
   */
  findSimilarFunction(tool, functionName) {
    let bestMatch = null;
    let bestScore = 0;

    for (const func of tool.functions) {
      const score = this.similarity(functionName.toLowerCase(), func.name.toLowerCase());
      if (score > 0.7 && score > bestScore) { // 70% similarity threshold
        bestScore = score;
        bestMatch = func;
      }
    }

    return bestMatch;
  }

  /**
   * Calculate similarity between two strings (simple Levenshtein-based)
   */
  similarity(str1, str2) {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) {
      return 1.0;
    }
    
    const editDistance = this.levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }

  /**
   * Calculate Levenshtein distance between two strings
   */
  levenshteinDistance(str1, str2) {
    const matrix = [];

    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1, // substitution
            matrix[i][j - 1] + 1,     // insertion
            matrix[i - 1][j] + 1      // deletion
          );
        }
      }
    }

    return matrix[str2.length][str1.length];
  }
}

module.exports = ResponseValidator;