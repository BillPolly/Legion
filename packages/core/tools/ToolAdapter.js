const OpenAICompatibleTool = require('./OpenAICompatibleTool');

/**
 * Adapter class that bridges legacy Tool format to OpenAI-compatible format
 */
class ToolAdapter extends OpenAICompatibleTool {
  constructor(legacyTool) {
    super();
    this.legacyTool = legacyTool;
    this.name = legacyTool.identifier;
    this.description = legacyTool.name;
  }

  /**
   * Converts legacy tool format to OpenAI function description format
   */
  getToolDescription() {
    // For now, we'll return descriptions for all functions in the tool
    // In the future, we might want to split tools with multiple functions
    const functions = this.legacyTool.functions.map(func => {
      const properties = {};
      const required = [];

      // Convert legacy arguments to OpenAI parameter format
      func.arguments.forEach(arg => {
        properties[arg.name] = {
          type: this.mapDataType(arg.dataType),
          description: arg.description
        };
        required.push(arg.name);
      });

      return {
        type: 'function',
        function: {
          name: `${this.legacyTool.identifier}_${func.name}`,
          description: func.purpose,
          parameters: {
            type: 'object',
            properties,
            required
          }
        }
      };
    });

    // Return the first function for now (most tools have only one)
    return functions[0];
  }

  /**
   * Maps legacy data types to OpenAI/JSON Schema types
   */
  mapDataType(legacyType) {
    const typeMap = {
      'string': 'string',
      'number': 'number',
      'boolean': 'boolean',
      'array': 'array',
      'object': 'object'
    };
    return typeMap[legacyType.toLowerCase()] || 'string';
  }

  /**
   * Invokes the legacy tool using OpenAI format
   */
  async invoke(toolCall) {
    try {
      // Parse arguments
      const args = this.parseArguments(toolCall.function.arguments);
      
      // Extract function name from the OpenAI function name
      // Format: toolIdentifier_functionName
      const functionName = toolCall.function.name.replace(`${this.legacyTool.identifier}_`, '');
      
      // Check if function exists
      if (!this.legacyTool.functionMap[functionName]) {
        throw new Error(`Function ${functionName} not found in tool ${this.legacyTool.identifier}`);
      }

      // Get the function definition to determine argument order
      const funcDef = this.legacyTool.functions.find(f => f.name === functionName);
      if (!funcDef) {
        throw new Error(`Function definition for ${functionName} not found`);
      }

      // Convert object arguments to array (legacy format)
      const orderedArgs = funcDef.arguments.map(argDef => args[argDef.name]);
      
      // Call the legacy function
      const result = await this.legacyTool.functionMap[functionName](...orderedArgs);
      
      // Return success response
      return this.createSuccessResponse(
        toolCall.id,
        toolCall.function.name,
        result
      );
    } catch (error) {
      // Return error response
      return this.createErrorResponse(
        toolCall.id,
        toolCall.function.name,
        error
      );
    }
  }

  /**
   * Static method to convert legacy tool call format to OpenAI format
   */
  static convertLegacyCallToOpenAI(legacyCall, legacyTool, callId = null) {
    // Legacy format:
    // {
    //   use_tool: {
    //     identifier: "tool-identifier",
    //     function_name: "functionName",
    //     args: ["arg1", "arg2"]
    //   }
    // }
    
    const tool = legacyCall.use_tool;
    const funcDef = legacyTool.functions.find(f => f.name === tool.function_name);
    
    if (!funcDef) {
      throw new Error(`Function ${tool.function_name} not found in tool ${tool.identifier}`);
    }

    // Build arguments object from array
    const argsObject = {};
    funcDef.arguments.forEach((argDef, index) => {
      if (index < tool.args.length) {
        argsObject[argDef.name] = tool.args[index];
      }
    });

    return {
      id: callId || `call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: 'function',
      function: {
        name: `${tool.identifier}_${tool.function_name}`,
        arguments: JSON.stringify(argsObject)
      }
    };
  }

  /**
   * Static method to convert OpenAI response back to legacy format
   */
  static convertOpenAIResponseToLegacy(openAIResponse) {
    // Parse the content if it's JSON
    let content;
    try {
      content = JSON.parse(openAIResponse.content);
    } catch {
      content = openAIResponse.content;
    }

    return {
      tool_result: {
        tool_call_id: openAIResponse.tool_call_id,
        function_name: openAIResponse.name,
        result: content
      }
    };
  }
}

module.exports = ToolAdapter;