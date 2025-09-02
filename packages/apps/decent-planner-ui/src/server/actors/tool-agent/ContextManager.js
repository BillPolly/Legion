/**
 * ContextManager - Reusable context management utilities
 * 
 * Extracted from BT Executor's proven context management patterns.
 * Provides utilities for parameter resolution, context formatting, and variable management.
 */

export class ContextManager {
  /**
   * Resolve parameters with @varName substitution (from BT Executor)
   * @param {Object} params - Parameters with potential @varName references
   * @param {Object} context - Execution context with artifacts
   * @returns {Object} Resolved parameters
   */
  static resolveParams(params, context) {
    const resolved = {};
    const artifacts = context.artifacts || {};
    
    for (const [key, value] of Object.entries(params)) {
      if (typeof value === 'string' && value.startsWith('@')) {
        // @varName syntax - resolve to artifacts
        const varName = value.substring(1);
        resolved[key] = artifacts[varName];
      } else {
        resolved[key] = value; // Constant value
      }
    }
    
    return resolved;
  }

  /**
   * Format context variables for LLM prompts
   * @param {Object} context - Execution context
   * @returns {string} Formatted context for prompts
   */
  static formatContextForPrompt(context) {
    const artifacts = context.artifacts || {};
    const keys = Object.keys(artifacts);
    
    if (keys.length === 0) {
      return 'No context variables stored.';
    }

    return keys.map(key => 
      `- ${key}: ${ContextManager.getVariablePreview(artifacts[key])}`
    ).join('\n');
  }

  /**
   * Get preview of variable value for display
   * @param {*} value - Variable value
   * @returns {string} Human-readable preview
   */
  static getVariablePreview(value) {
    if (value === null) return 'null';
    if (value === undefined) return 'undefined';
    
    const type = typeof value;
    switch (type) {
      case 'string':
        return value.length > 50 ? `"${value.substring(0, 47)}..."` : `"${value}"`;
      case 'number':
      case 'boolean':
        return String(value);
      case 'object':
        if (Array.isArray(value)) {
          return `Array(${value.length})`;
        } else {
          const keys = Object.keys(value);
          return `Object(${keys.length} keys)`;
        }
      default:
        return `${type}`;
    }
  }

  /**
   * Validate context variable name
   * @param {string} name - Variable name
   * @returns {boolean} True if valid
   */
  static validateContextVariable(name, value) {
    // Variable name validation
    if (!name || typeof name !== 'string') {
      throw new Error('Context variable name must be a non-empty string');
    }

    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) {
      throw new Error('Context variable name must be a valid identifier (letters, numbers, underscore, no spaces)');
    }

    // Value validation (basic)
    if (value === undefined) {
      throw new Error('Context variable value cannot be undefined');
    }

    return true;
  }

  /**
   * Validate parameter resolution results
   * @param {Object} resolvedParams - Resolved parameters
   * @param {Object} originalParams - Original parameters with @varName references
   * @returns {Array} Array of validation errors (empty if valid)
   */
  static validateParameterResolution(resolvedParams, originalParams) {
    const errors = [];
    
    for (const [param, resolvedValue] of Object.entries(resolvedParams)) {
      const originalValue = originalParams[param];
      
      if (resolvedValue === undefined) {
        if (typeof originalValue === 'string' && originalValue.startsWith('@')) {
          const varName = originalValue.substring(1);
          errors.push(`Parameter '${param}': @${varName} (variable not found in context)`);
        } else {
          errors.push(`Parameter '${param}': resolved to undefined`);
        }
      }
      
      // Check for unresolved @varName references
      if (typeof resolvedValue === 'string' && resolvedValue.startsWith('@')) {
        errors.push(`Parameter '${param}': ${resolvedValue} (variable reference not resolved)`);
      }
    }
    
    return errors;
  }

  /**
   * Format chat history for LLM prompts
   * @param {Array} chatHistory - Array of chat messages
   * @param {number} limit - Maximum number of recent messages to include
   * @returns {string} Formatted chat history
   */
  static formatChatHistory(chatHistory, limit = 5) {
    if (!chatHistory || chatHistory.length === 0) {
      return 'No previous chat history.';
    }

    return chatHistory.slice(-limit).map(msg => 
      `${msg.role === 'user' ? 'User' : 'Agent'}: ${msg.content}`
    ).join('\n');
  }

  /**
   * Create context snapshot for debugging/logging
   * @param {Object} context - Execution context
   * @returns {Object} Context snapshot
   */
  static createContextSnapshot(context) {
    const artifacts = context.artifacts || {};
    
    return {
      variableCount: Object.keys(artifacts).length,
      variables: Object.keys(artifacts),
      variablePreviews: Object.fromEntries(
        Object.entries(artifacts).map(([key, value]) => [
          key, 
          ContextManager.getVariablePreview(value)
        ])
      ),
      totalSize: JSON.stringify(artifacts).length
    };
  }

  /**
   * Safely serialize context for logging (avoid circular references)
   * @param {Object} context - Execution context
   * @returns {Object} Serializable context
   */
  static safeSerializeContext(context) {
    const artifacts = context.artifacts || {};
    const serialized = {};
    
    for (const [key, value] of Object.entries(artifacts)) {
      try {
        JSON.stringify(value); // Test if serializable
        serialized[key] = value;
      } catch (error) {
        // Replace circular/unserializable values with previews
        serialized[key] = `[${typeof value}] ${ContextManager.getVariablePreview(value)}`;
      }
    }
    
    return { artifacts: serialized };
  }

  /**
   * Merge contexts (for testing or context composition)
   * @param {Object} baseContext - Base context
   * @param {Object} additionalContext - Additional context to merge
   * @returns {Object} Merged context
   */
  static mergeContexts(baseContext, additionalContext) {
    return {
      artifacts: {
        ...(baseContext.artifacts || {}),
        ...(additionalContext.artifacts || {})
      }
    };
  }
}