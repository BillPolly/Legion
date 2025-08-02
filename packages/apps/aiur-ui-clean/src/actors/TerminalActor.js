import { toolMethods } from '../schemas/messages.js';

/**
 * Terminal Actor - handles terminal commands and responses
 */
export class TerminalActor {
  constructor(terminal) {
    this.terminal = terminal;
    this.actorSpace = null;
    this.name = 'terminal';
    this.guid = null;
    this.toolDefinitions = new Map(); // Store tool definitions with schemas
  }
  
  /**
   * Receive messages from other actors
   */
  receive(payload, envelope) {
    console.log('TerminalActor: Received message:', payload);
    
    // Handle different message types
    if (payload.type === 'output') {
      this.handleOutput(payload);
    } else if (payload.type === 'error') {
      this.handleError(payload);
    } else if (payload.type === 'clear') {
      this.terminal.clear();
    } else if (payload.type === 'tools') {
      this.handleToolsResponse(payload);
    } else if (payload.type === 'context') {
      this.handleContextResponse(payload);
    } else if (payload.type === 'session') {
      this.handleSessionResponse(payload);
    } else {
      // Default: display as output
      this.terminal.addOutput(JSON.stringify(payload, null, 2), 'info');
    }
  }
  
  /**
   * Send a command to the server
   * Commands are sent as tool calls to the server
   */
  async sendCommand(command) {
    if (!this.actorSpace || !this.actorSpace.sessionId) {
      this.terminal.addOutput('Not connected to server or no active session', 'error');
      return;
    }
    
    try {
      let response;
      
      // Parse command into tool name and arguments
      const parts = command.trim().split(' ');
      const toolName = parts[0];
      const args = parts.slice(1);
      
      // Special case: 'tools' command maps to 'tools/list' method
      if (toolName === 'tools') {
        response = await this.actorSpace.callTool(toolMethods.LIST_TOOLS);
        this.handleToolsList(response);
        return;
      }
      
      // Build arguments object based on the tool schema
      let toolArgs = {};
      
      // Check if we have a schema for this tool
      const toolDef = this.toolDefinitions.get(toolName);
      if (toolDef && toolDef.inputSchema && toolDef.inputSchema.properties) {
        // Use schema to parse arguments
        const props = toolDef.inputSchema.properties;
        const propNames = Object.keys(props);
        const required = toolDef.inputSchema.required || [];
        
        // Parse arguments based on schema
        if (propNames.length === 0) {
          // No parameters needed
          toolArgs = {};
        } else if (args.length === 0 && required.length > 0) {
          // Missing required parameters
          this.terminal.addOutput(`Error: ${toolName} requires parameters:`, 'error');
          required.forEach(param => {
            const prop = props[param];
            this.terminal.addOutput(`  ${param} (${prop.type}): ${prop.description || ''}`, 'error');
          });
          return;
        } else {
          // Parse arguments based on their format
          let positionalIndex = 0;
          
          args.forEach(arg => {
            if (arg.includes('=')) {
              // Named parameter: key=value
              const [key, ...valueParts] = arg.split('=');
              const value = valueParts.join('='); // Handle values with '=' in them
              if (props[key]) {
                toolArgs[key] = value;
              }
            } else {
              // Positional parameter - map to schema properties in order
              if (positionalIndex < propNames.length) {
                const paramName = propNames[positionalIndex];
                toolArgs[paramName] = arg;
                positionalIndex++;
              }
            }
          });
          
          // For tools with 'content' parameter that should capture all remaining args
          if (props.content && positionalIndex === 1 && args.length > 1) {
            // Special case for commands like: file_write path "content with spaces"
            toolArgs.content = args.slice(1).join(' ');
          }
        }
        
        // Validate required parameters
        for (const reqParam of required) {
          if (!(reqParam in toolArgs)) {
            this.terminal.addOutput(`Error: Missing required parameter '${reqParam}' for ${toolName}`, 'error');
            const prop = props[reqParam];
            this.terminal.addOutput(`  ${reqParam} (${prop.type}): ${prop.description || ''}`, 'error');
            return;
          }
        }
      } else {
        // No schema available - fall back to generic parsing
        args.forEach((arg, index) => {
          if (arg.includes('=')) {
            const [key, ...valueParts] = arg.split('=');
            toolArgs[key] = valueParts.join('=');
          } else {
            // Generic positional arguments
            if (index === 0) toolArgs.path = arg;
            else if (index === 1) toolArgs.content = arg;
            else toolArgs[`arg${index}`] = arg;
          }
        });
      }
      
      // Call the tool via tools/call method
      response = await this.actorSpace.callTool(toolMethods.CALL_TOOL, {
        name: toolName,
        arguments: toolArgs
      });
      
      // Handle the response
      this.handleToolResult(response);
      
    } catch (error) {
      console.error('TerminalActor: Error executing tool:', error);
      this.terminal.addOutput(`Error: ${error.message}`, 'error');
    }
  }
  
  /**
   * Handle output messages
   */
  handleOutput(payload) {
    const { text, type = 'info' } = payload;
    this.terminal.addOutput(text, type);
  }
  
  /**
   * Handle error messages
   */
  handleError(payload) {
    const { message, details } = payload;
    this.terminal.addOutput(`Error: ${message}`, 'error');
    if (details) {
      this.terminal.addOutput(details, 'error');
    }
  }
  
  /**
   * Handle tools list response
   */
  handleToolsList(response) {
    console.log('TerminalActor: handleToolsList response:', response);
    
    // The response structure from server is { result: { tools: [...] } }
    const toolsData = response?.tools || response?.result?.tools || response;
    
    if (!toolsData || (Array.isArray(toolsData) && toolsData.length === 0)) {
      this.terminal.addOutput('No tools available', 'info');
      this.terminal.addOutput('Try: module_load file', 'info');
      return;
    }
    
    const tools = Array.isArray(toolsData) ? toolsData : (toolsData.tools || []);
    
    if (tools.length === 0) {
      this.terminal.addOutput('No tools available', 'info');
      this.terminal.addOutput('Try: module_load file', 'info');
      return;
    }
    
    // Store tool definitions for parameter validation
    this.toolDefinitions.clear();
    tools.forEach(tool => {
      this.toolDefinitions.set(tool.name, tool);
    });
    
    this.terminal.addOutput(`Available tools (${tools.length}):`, 'info');
    tools.forEach(tool => {
      this.terminal.addOutput(`  ${tool.name}: ${tool.description || 'No description'}`, 'info');
      
      // Show parameters if they exist
      if (tool.inputSchema && tool.inputSchema.properties) {
        const props = tool.inputSchema.properties;
        const required = tool.inputSchema.required || [];
        
        Object.keys(props).forEach(param => {
          const prop = props[param];
          const isRequired = required.includes(param);
          const typeStr = prop.type || 'any';
          const desc = prop.description || '';
          const requiredStr = isRequired ? ' (required)' : ' (optional)';
          
          this.terminal.addOutput(`    - ${param}: ${typeStr}${requiredStr} - ${desc}`, 'info');
        });
        
        if (Object.keys(props).length === 0) {
          this.terminal.addOutput(`    (no parameters)`, 'info');
        }
      }
    });
  }
  
  /**
   * Handle tools response (legacy)
   */
  handleToolsResponse(payload) {
    this.handleToolsList(payload);
  }
  
  /**
   * Handle context response (legacy)
   */
  handleContextResponse(payload) {
    this.handleContextList(payload);
  }
  
  /**
   * Handle session response (legacy)
   */
  handleSessionResponse(payload) {
    this.handleSessionInfo(payload);
  }
  
  /**
   * Handle context list response
   */
  handleContextList(response) {
    if (!response || !response.contexts || response.contexts.length === 0) {
      this.terminal.addOutput('No context available', 'info');
      return;
    }
    
    this.terminal.addOutput('Current context:', 'info');
    response.contexts.forEach(ctx => {
      this.terminal.addOutput(`  - ${ctx.id}: ${ctx.type}`, 'info');
      if (ctx.description) {
        this.terminal.addOutput(`    ${ctx.description}`, 'info');
      }
    });
  }
  
  /**
   * Handle session info response
   */
  handleSessionInfo(response) {
    if (!response) {
      this.terminal.addOutput('No session info available', 'info');
      return;
    }
    
    this.terminal.addOutput('Session info:', 'info');
    this.terminal.addOutput(`  ID: ${response.sessionId || this.actorSpace.sessionId}`, 'info');
    if (response.created) {
      this.terminal.addOutput(`  Created: ${response.created}`, 'info');
    }
    if (response.lastAccessed) {
      this.terminal.addOutput(`  Last accessed: ${response.lastAccessed}`, 'info');
    }
    if (response.tools) {
      this.terminal.addOutput(`  Loaded tools: ${response.tools.length}`, 'info');
    }
  }
  
  /**
   * Handle modules list response
   */
  handleModulesList(response) {
    if (!response || !response.modules) {
      this.terminal.addOutput('No modules info available', 'info');
      return;
    }
    
    if (response.loaded && response.loaded.length > 0) {
      this.terminal.addOutput('Loaded modules:', 'info');
      response.loaded.forEach(mod => {
        this.terminal.addOutput(`  - ${mod}`, 'success');
      });
    }
    
    if (response.available && response.available.length > 0) {
      this.terminal.addOutput('Available modules:', 'info');
      response.available.forEach(mod => {
        this.terminal.addOutput(`  - ${mod}`, 'info');
      });
    }
  }
  
  /**
   * Handle generic tool result
   */
  handleToolResult(response) {
    console.log('TerminalActor: handleToolResult response:', response);
    
    if (response && response.error) {
      // Server returned an error - could be string or object
      const errorMsg = typeof response.error === 'string' 
        ? response.error 
        : (response.error.message || JSON.stringify(response.error));
      this.terminal.addOutput(`Error: ${errorMsg}`, 'error');
      
      // If it's an unknown tool error, suggest checking available tools
      if (errorMsg.includes('Unknown tool') || errorMsg.includes('not found')) {
        this.terminal.addOutput('Type "tools" to see available tools', 'info');
      }
    } else if (response && response.result !== undefined) {
      // Handle different result types
      if (typeof response.result === 'string') {
        // String result - display directly
        this.terminal.addOutput(response.result, 'success');
      } else if (Array.isArray(response.result)) {
        // Array result - display as list
        response.result.forEach(item => {
          if (typeof item === 'string') {
            this.terminal.addOutput(`  - ${item}`, 'success');
          } else {
            this.terminal.addOutput(`  - ${JSON.stringify(item)}`, 'success');
          }
        });
      } else if (typeof response.result === 'object' && response.result !== null) {
        // Object result - format nicely
        if (response.result.message) {
          this.terminal.addOutput(response.result.message, 'success');
        } else if (response.result.loaded !== undefined || response.result.available !== undefined) {
          // Module list response
          this.handleModulesList(response.result);
        } else {
          this.terminal.addOutput(JSON.stringify(response.result, null, 2), 'success');
        }
      } else {
        // Other types - convert to string
        this.terminal.addOutput(String(response.result), 'success');
      }
    } else if (response) {
      // Response without explicit result field
      this.terminal.addOutput(JSON.stringify(response, null, 2), 'success');
    } else {
      this.terminal.addOutput('Tool executed successfully', 'success');
    }
  }
  
  /**
   * Connect the terminal to the actor space
   */
  connect(actorSpace) {
    this.actorSpace = actorSpace;
    actorSpace.registerActor(this, 'terminal');
    
    // Set up connection status listeners
    actorSpace.on('connected', () => {
      this.terminal.addOutput('Connected to server', 'success');
    });
    
    actorSpace.on('session_ready', async ({ sessionId }) => {
      this.terminal.addOutput(`Session created: ${sessionId}`, 'success');
      this.terminal.addOutput('Type .help to see available commands', 'info');
      
      // Load initial tool list to get schemas
      try {
        const response = await this.actorSpace.callTool(toolMethods.LIST_TOOLS);
        this.handleToolsList(response);
      } catch (error) {
        console.error('Failed to load initial tool list:', error);
      }
    });
    
    actorSpace.on('disconnected', () => {
      this.terminal.addOutput('Disconnected from server', 'warning');
    });
    
    actorSpace.on('error', (error) => {
      this.terminal.addOutput(`Connection error: ${error.message || error}`, 'error');
    });
    
    // Listen for tool responses
    actorSpace.on('tool_response', (message) => {
      // Handle any tool responses that weren't handled by promise
      console.log('TerminalActor: Tool response event:', message);
    });
  }
}