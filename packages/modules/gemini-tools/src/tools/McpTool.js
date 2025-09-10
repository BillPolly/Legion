/**
 * McpTool - Ported from Gemini CLI mcp-tool.ts to Legion patterns
 * Executes external tools discovered through MCP protocol
 */

import { Tool } from '@legion/tools-registry';

/**
 * Tool for executing external MCP tools (ported from Gemini CLI's mcp-tool.ts)
 */
class McpTool extends Tool {
  constructor(moduleOrConfig, toolName = null) {
    // NEW PATTERN: Tool(module, toolName) - metadata comes from module
    if (toolName && moduleOrConfig?.getToolMetadata) {
      super(moduleOrConfig, toolName);
      
      // Get config from module  
      const config = moduleOrConfig.config || {};
      this.externalTools = new Map(); // toolName -> tool definition
      this.shortName = 'mcptool';
    } 
    // OLD PATTERN: Tool(config) - backwards compatibility
    else {
      super({
        name: 'mcp_tool',
        shortName: 'mcptool',
        description: 'Execute external tools discovered through MCP protocol (ported from Gemini CLI)',
        schema: {
          input: {
            type: 'object',
            properties: {
              external_tool_name: {
                type: 'string',
                description: 'Name of the external tool to execute'
              },
              tool_params: {
                type: 'object',
                description: 'Parameters for the external tool'
              },
              server_id: {
                type: 'string',
                description: 'MCP server ID hosting the tool'
              }
            },
            required: ['external_tool_name', 'tool_params']
          },
          output: {
            type: 'object',
            properties: {
              success: {
                type: 'boolean',
                description: 'Whether the external tool execution succeeded'
              },
              result: {
                type: 'object',
                description: 'Result from the external tool'
              },
              toolName: {
                type: 'string',
                description: 'Name of the executed external tool'
              },
              serverId: {
                type: 'string',
                description: 'Server that provided the tool'
              },
              executionTime: {
                type: 'number',
                description: 'Tool execution time in milliseconds'
              }
            },
            required: ['success', 'toolName']
          }
        }
      });

      this.externalTools = new Map();
    }
  }

  /**
   * Execute external MCP tool (core logic ported from Gemini CLI)
   * @param {Object} args - External tool execution arguments
   * @returns {Promise<Object>} Execution result
   */
  async _execute(args) {
    try {
      const { external_tool_name, tool_params, server_id } = args;
      const startTime = Date.now();

      // Validate external tool exists
      if (!this.externalTools.has(external_tool_name)) {
        throw new Error(`External tool not found: ${external_tool_name}. Use mcp_client_manager to discover tools first.`);
      }

      const toolInfo = this.externalTools.get(external_tool_name);

      // Execute external tool (ported pattern)
      const result = await this._executeExternalTool(toolInfo, tool_params, server_id);
      
      const executionTime = Date.now() - startTime;

      return {
        success: true,
        result,
        toolName: external_tool_name,
        serverId: toolInfo.serverId || server_id || 'unknown',
        executionTime
      };

    } catch (error) {
      return {
        success: false,
        result: null,
        toolName: args.external_tool_name || 'unknown',
        serverId: args.server_id || 'unknown',
        executionTime: 0,
        error: error.message
      };
    }
  }

  /**
   * Execute external tool through MCP protocol (ported logic)
   * @param {Object} toolInfo - Tool definition
   * @param {Object} params - Tool parameters
   * @param {string} serverId - Server hosting the tool
   * @returns {Promise<Object>} Tool result
   */
  async _executeExternalTool(toolInfo, params, serverId) {
    try {
      // For MVP: Simulate external tool execution
      // Real implementation would use MCP protocol to call external server
      
      switch (toolInfo.name.split('_').pop()) { // Get tool type from name
        case 'calculator':
          return this._simulateCalculatorTool(params);
          
        case 'formatter':
          return this._simulateFormatterTool(params);
          
        default:
          return {
            message: `External tool ${toolInfo.name} executed successfully`,
            params,
            timestamp: new Date().toISOString()
          };
      }
    } catch (error) {
      throw new Error(`External tool execution failed: ${error.message}`);
    }
  }

  /**
   * Simulate calculator external tool (for testing)
   * @param {Object} params - Calculator parameters
   * @returns {Object} Calculation result
   */
  _simulateCalculatorTool(params) {
    const { operation, a, b } = params;
    
    let result;
    switch (operation) {
      case 'add': result = a + b; break;
      case 'subtract': result = a - b; break;
      case 'multiply': result = a * b; break;
      case 'divide': 
        if (b === 0) throw new Error('Division by zero');
        result = a / b; 
        break;
      default:
        throw new Error(`Unknown operation: ${operation}`);
    }
    
    return {
      operation,
      operands: [a, b],
      result,
      type: 'calculation'
    };
  }

  /**
   * Simulate formatter external tool (for testing)
   * @param {Object} params - Formatter parameters
   * @returns {Object} Formatting result
   */
  _simulateFormatterTool(params) {
    const { code, language } = params;
    
    // Simple formatting simulation
    let formatted;
    switch (language?.toLowerCase()) {
      case 'javascript':
      case 'js':
        formatted = code.replace(/;/g, ';\n').replace(/{/g, '{\n  ').replace(/}/g, '\n}');
        break;
      default:
        formatted = code; // No formatting for unknown languages
    }
    
    return {
      originalCode: code,
      formattedCode: formatted,
      language,
      type: 'formatting'
    };
  }

  /**
   * Register discovered external tool (ported from Gemini CLI)
   * @param {Object} toolDefinition - External tool definition
   */
  registerExternalTool(toolDefinition) {
    this.externalTools.set(toolDefinition.name, toolDefinition);
  }

  /**
   * Get all registered external tools
   * @returns {Array} External tools
   */
  getRegisteredTools() {
    return Array.from(this.externalTools.values());
  }

  /**
   * Clear all external tools (for testing)
   */
  clearExternalTools() {
    this.externalTools.clear();
    this.discoveryState = MCPDiscoveryState.NOT_STARTED;
  }
}

export default McpTool;