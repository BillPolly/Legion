/**
 * ClaudeToolBridge - Translates between Legion tools and Claude SDK tools
 *
 * Legion tools have a specific format with schema validation.
 * Claude SDK tools use a different format compatible with the Anthropic API.
 *
 * This bridge translates between the two formats bidirectionally.
 */

export class ClaudeToolBridge {
  constructor(toolRegistry) {
    if (!toolRegistry) {
      throw new Error('ClaudeToolBridge requires a toolRegistry');
    }
    this.toolRegistry = toolRegistry;
  }

  /**
   * Convert Legion tool to Claude SDK tool format
   * @param {Object} legionTool - Legion tool definition
   * @returns {Object} Claude SDK compatible tool
   */
  legionToClaudeTool(legionTool) {
    if (!legionTool || !legionTool.name) {
      throw new Error('Invalid Legion tool: missing name');
    }

    return {
      name: legionTool.name,
      description: legionTool.description || `Execute ${legionTool.name} tool`,
      input_schema: this._convertSchema(legionTool.inputSchema || legionTool.schema)
    };
  }

  /**
   * Convert Legion tool registry to array of Claude SDK tools
   * @param {Array<string>} toolNames - Optional array of tool names to include
   * @returns {Promise<Array<Object>>} Array of Claude SDK compatible tools
   */
  async legionToolsToClaudeTools(toolNames = null) {
    let tools;

    if (toolNames) {
      // Get specific tools by name
      const toolPromises = toolNames.map(name => this.toolRegistry.getTool(name));
      tools = (await Promise.all(toolPromises)).filter(Boolean);
    } else {
      // Get all tools using listTools() - ToolRegistry API
      tools = await this.toolRegistry.listTools();
    }

    // Deduplicate tools by name (Claude requires unique tool names)
    // Keep the first occurrence of each tool name
    const uniqueTools = [];
    const seenNames = new Set();

    for (const tool of tools) {
      if (!seenNames.has(tool.name)) {
        uniqueTools.push(tool);
        seenNames.add(tool.name);
      }
    }

    return uniqueTools.map(tool => this.legionToClaudeTool(tool));
  }

  /**
   * Execute a Legion tool with parameters from Claude
   * @param {string} toolName - Name of the tool to execute
   * @param {Object} toolInput - Input parameters from Claude
   * @returns {Promise<Object>} Tool execution result
   */
  async executeLegionTool(toolName, toolInput) {
    const tool = this.toolRegistry.getTool(toolName);

    if (!tool) {
      throw new Error(`Tool not found: ${toolName}`);
    }

    try {
      const result = await tool.execute(toolInput);

      return {
        success: true,
        result: result,
        toolName: toolName
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        toolName: toolName
      };
    }
  }

  /**
   * Convert Legion JSON Schema to Claude input schema format
   * @private
   */
  _convertSchema(legionSchema) {
    if (!legionSchema) {
      return {
        type: 'object',
        properties: {},
        required: []
      };
    }

    // If already in correct format, return as-is
    if (legionSchema.type && legionSchema.properties) {
      return legionSchema;
    }

    // Convert from Legion format if needed
    const claudeSchema = {
      type: 'object',
      properties: {},
      required: []
    };

    if (legionSchema.properties) {
      claudeSchema.properties = { ...legionSchema.properties };
    }

    if (legionSchema.required) {
      claudeSchema.required = [...legionSchema.required];
    }

    return claudeSchema;
  }

  /**
   * Format tool result for Claude
   * @param {Object} result - Tool execution result
   * @returns {string} Formatted result as string
   */
  formatToolResult(result) {
    if (!result) {
      return 'Tool execution completed with no result';
    }

    if (typeof result === 'string') {
      return result;
    }

    if (result.success === false) {
      return `Error: ${result.error || 'Tool execution failed'}`;
    }

    if (result.result) {
      return typeof result.result === 'string'
        ? result.result
        : JSON.stringify(result.result, null, 2);
    }

    return JSON.stringify(result, null, 2);
  }
}
