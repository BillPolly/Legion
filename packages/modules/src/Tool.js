/**
 * Base class for all tools in the jsEnvoy system
 * Provides standard interface for function calling format
 */
class Tool {
  constructor() {
    this.name = '';
    this.description = '';
  }

  /**
   * Returns the tool description in standard function calling format
   * @returns {Object} Tool description object
   */
  getToolDescription() {
    throw new Error('getToolDescription() must be implemented by subclass');
  }

  /**
   * Invokes the tool with the given tool call from the LLM
   * @param {Object} toolCall - The tool call object from the LLM
   * @param {string} toolCall.id - Unique identifier for this tool call
   * @param {string} toolCall.type - Should be "function"
   * @param {Object} toolCall.function - Function details
   * @param {string} toolCall.function.name - Name of the function to call
   * @param {string} toolCall.function.arguments - JSON string of arguments
   * @returns {Promise<Object>} Tool response in standard format
   */
  async invoke(toolCall) {
    throw new Error('invoke() must be implemented by subclass');
  }

  /**
   * Helper method to create a successful tool response
   * @param {string} toolCallId - The tool call ID
   * @param {string} functionName - The function name
   * @param {*} content - The response content (will be JSON stringified)
   * @returns {Object} Tool response object
   */
  createSuccessResponse(toolCallId, functionName, content) {
    return {
      tool_call_id: toolCallId,
      role: 'tool',
      name: functionName,
      content: typeof content === 'string' ? content : JSON.stringify(content)
    };
  }

  /**
   * Helper method to create an error tool response
   * @param {string} toolCallId - The tool call ID
   * @param {string} functionName - The function name
   * @param {Error|string} error - The error to report
   * @returns {Object} Tool response object
   */
  createErrorResponse(toolCallId, functionName, error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      tool_call_id: toolCallId,
      role: 'tool',
      name: functionName,
      content: JSON.stringify({ error: errorMessage })
    };
  }

  /**
   * Helper method to parse and validate tool call arguments
   * @param {string} argumentsJson - JSON string of arguments
   * @returns {Object} Parsed arguments
   * @throws {Error} If arguments are invalid JSON
   */
  parseArguments(argumentsJson) {
    try {
      return JSON.parse(argumentsJson);
    } catch (error) {
      throw new Error(`Invalid JSON arguments: ${error.message}`);
    }
  }

  /**
   * Helper method to validate required parameters
   * @param {Object} args - The arguments object
   * @param {string[]} required - Array of required parameter names
   * @throws {Error} If required parameters are missing
   */
  validateRequiredParameters(args, required) {
    const missing = required.filter(param => !(param in args));
    if (missing.length > 0) {
      throw new Error(`Missing required parameters: ${missing.join(', ')}`);
    }
  }
}

module.exports = Tool;