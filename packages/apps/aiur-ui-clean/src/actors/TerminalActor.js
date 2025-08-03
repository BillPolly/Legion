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
    // Validate connection
    if (!this.isConnected()) {
      this.showConnectionError();
      return;
    }
    
    try {
      // Parse the command
      const { toolName, args } = this.parseCommand(command);
      
      // Handle special commands
      if (this.isSpecialCommand(toolName)) {
        await this.handleSpecialCommand(toolName);
        return;
      }
      
      // Build tool arguments from command args
      const toolArgs = await this.buildToolArguments(toolName, args);
      if (!toolArgs) {
        // Error already displayed by buildToolArguments
        return;
      }
      
      // Execute the tool
      const response = await this.executeTool(toolName, toolArgs);
      
      // Handle the response
      this.handleToolResult(response);
      
      // Post-execution actions
      await this.handlePostExecution(toolName, response);
      
    } catch (error) {
      console.error('TerminalActor: Error executing tool:', error);
      this.terminal.addOutput(`Error: ${error.message}`, 'error');
    }
  }
  
  /**
   * Check if connected to server
   */
  isConnected() {
    return this.actorSpace && this.actorSpace.sessionId;
  }
  
  /**
   * Show connection error
   */
  showConnectionError() {
    this.terminal.addOutput('Not connected to server or no active session', 'error');
  }
  
  /**
   * Parse command into tool name and arguments
   */
  parseCommand(command) {
    const parts = command.trim().split(' ');
    return {
      toolName: parts[0],
      args: parts.slice(1)
    };
  }
  
  /**
   * Check if this is a special command
   */
  isSpecialCommand(toolName) {
    return toolName === 'tools'; // Only 'tools' is special to list available tools
  }
  
  /**
   * Handle special commands
   */
  async handleSpecialCommand(toolName) {
    if (toolName === 'tools') {
      // Refresh and show the tools list
      const response = await this.actorSpace.callTool(toolMethods.LIST_TOOLS);
      this.handleToolsList(response, false); // false = show output
    }
  }
  
  /**
   * Build tool arguments from command arguments using schema
   */
  async buildToolArguments(toolName, args) {
    // Get tool definition
    const toolDef = this.toolDefinitions.get(toolName);
    
    if (!toolDef) {
      this.showNoSchemaError(toolName);
      return null;
    }
    
    console.log(`Building arguments for ${toolName}:`, {
      args,
      schema: toolDef.inputSchema,
      properties: toolDef.inputSchema?.properties
    });
    
    if (!toolDef.inputSchema || !toolDef.inputSchema.properties) {
      // Tool has no parameters
      return {};
    }
    
    const schema = toolDef.inputSchema;
    const props = schema.properties;
    const required = schema.required || [];
    const propNames = Object.keys(props);
    
    // No parameters needed
    if (propNames.length === 0) {
      return {};
    }
    
    // Check for missing required parameters
    if (args.length === 0 && required.length > 0) {
      this.showMissingParametersError(toolName, required, props);
      return null;
    }
    
    // Parse arguments according to schema
    const toolArgs = this.mapArgumentsToSchema(args, propNames, props);
    
    // Validate required parameters are present
    const missingParams = this.findMissingRequiredParams(toolArgs, required);
    if (missingParams.length > 0) {
      this.showMissingParametersError(toolName, missingParams, props);
      return null;
    }
    
    return toolArgs;
  }
  
  /**
   * Map command arguments to schema parameters
   */
  mapArgumentsToSchema(args, propNames, props) {
    const toolArgs = {};
    let positionalIndex = 0;
    
    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      
      if (this.isNamedArgument(arg)) {
        // Handle named argument: key=value
        const { key, value } = this.parseNamedArgument(arg);
        if (props[key]) {
          toolArgs[key] = value;
        }
      } else {
        // Handle positional argument
        if (positionalIndex < propNames.length) {
          const paramName = propNames[positionalIndex];
          
          // If this is the last parameter and we have more args, join them
          if (this.shouldJoinRemainingArgs(positionalIndex, propNames.length, i, args.length)) {
            toolArgs[paramName] = args.slice(i).join(' ');
            break;
          } else {
            toolArgs[paramName] = arg;
          }
          positionalIndex++;
        }
      }
    }
    
    return toolArgs;
  }
  
  /**
   * Check if argument is named (contains =)
   */
  isNamedArgument(arg) {
    return arg.includes('=');
  }
  
  /**
   * Parse named argument into key and value
   */
  parseNamedArgument(arg) {
    const [key, ...valueParts] = arg.split('=');
    return {
      key,
      value: valueParts.join('=') // Handle values with '=' in them
    };
  }
  
  /**
   * Check if we should join remaining args for last parameter
   */
  shouldJoinRemainingArgs(positionalIndex, totalParams, currentArgIndex, totalArgs) {
    return positionalIndex === totalParams - 1 && currentArgIndex < totalArgs - 1;
  }
  
  /**
   * Find missing required parameters
   */
  findMissingRequiredParams(toolArgs, required) {
    return required.filter(param => !(param in toolArgs));
  }
  
  /**
   * Show error for missing schema
   */
  showNoSchemaError(toolName) {
    this.terminal.addOutput(`Error: No schema available for tool '${toolName}'`, 'error');
    this.terminal.addOutput('Try running "tools" to refresh the tool list', 'info');
  }
  
  /**
   * Show error for missing parameters
   */
  showMissingParametersError(toolName, params, props) {
    this.terminal.addOutput(`Error: ${toolName} requires parameters:`, 'error');
    params.forEach(param => {
      const prop = props[param];
      this.terminal.addOutput(`  ${param} (${prop.type}): ${prop.description || ''}`, 'error');
    });
  }
  
  /**
   * Execute tool via server
   */
  async executeTool(toolName, toolArgs) {
    return await this.actorSpace.callTool(toolMethods.CALL_TOOL, {
      name: toolName,
      arguments: toolArgs
    });
  }
  
  /**
   * Handle post-execution actions
   */
  async handlePostExecution(toolName, response) {
    // If module was loaded, add new tool definitions to registry
    if (toolName === 'module_load' && response?.success && response?.toolDefinitions) {
      console.log('Module loaded, adding new tool definitions to registry...');
      this.updateToolDefinitions(response.toolDefinitions);
    }
    
    // If module was unloaded, we'd need to remove tools
    // But server doesn't tell us which tools belong to which module yet
  }
  
  /**
   * Update tool definitions after module load
   */
  updateToolDefinitions(newTools) {
    // Add new tool definitions
    newTools.forEach(toolDef => {
      this.toolDefinitions.set(toolDef.name, toolDef);
    });
    
    // Update terminal's tool definitions for tab completion
    if (this.terminal.updateToolDefinitions) {
      this.terminal.updateToolDefinitions(this.toolDefinitions);
    }
    
    // Log what was loaded
    console.log('Tools loaded:', newTools.map(t => t.name));
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
  handleToolsList(response, silent = false) {
    console.log('TerminalActor: handleToolsList response:', response);
    console.log('Silent mode:', silent);
    
    // The response structure from server is { result: { tools: [...] } }
    const toolsData = response?.tools || response?.result?.tools || response;
    console.log('Tools data extracted:', toolsData?.length || 0, 'tools');
    
    // Log first few tool names to debug
    if (Array.isArray(toolsData) && toolsData.length > 0) {
      console.log('First few tools:', toolsData.slice(0, 5).map(t => t.name));
    }
    
    if (!toolsData || (Array.isArray(toolsData) && toolsData.length === 0)) {
      if (!silent) {
        this.terminal.addOutput('No tools available', 'info');
        this.terminal.addOutput('Try: module_load file', 'info');
      }
      return;
    }
    
    const tools = Array.isArray(toolsData) ? toolsData : (toolsData.tools || []);
    
    if (tools.length === 0) {
      if (!silent) {
        this.terminal.addOutput('No tools available', 'info');
        this.terminal.addOutput('Try: module_load file', 'info');
      }
      return;
    }
    
    // Store tool definitions for parameter validation
    this.toolDefinitions.clear();
    tools.forEach(tool => {
      this.toolDefinitions.set(tool.name, tool);
    });
    
    // Update terminal's tool definitions for tab completion
    if (this.terminal.updateToolDefinitions) {
      this.terminal.updateToolDefinitions(this.toolDefinitions);
    }
    
    // Only show output if not in silent mode
    if (!silent) {
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
   * Format a tool response for display
   */
  formatToolResponse(response) {
    // Handle ToolResult format from Legion tools
    if (response && typeof response === 'object') {
      // Check for success field first (standard tool response format)
      if ('success' in response) {
        if (response.success) {
          // Success response - format the whole response minus the success field
          const dataToFormat = { ...response };
          delete dataToFormat.success;
          return this.formatSuccessResponse(dataToFormat);
        } else {
          // Failure response
          return this.formatErrorResponse(response.message || response.error || 'Operation failed', response);
        }
      }
      
      // Check for error field
      if (response.error) {
        return this.formatErrorResponse(response.error, response);
      }
      
      // Check for result field
      if (response.result !== undefined) {
        return this.formatSuccessResponse(response.result);
      }
      
      // Check for specific response types
      if (response.content !== undefined) {
        // File read response
        return this.formatFileReadResponse(response);
      }
      
      if (response.currentDirectory !== undefined) {
        // Directory current response
        return this.formatDirectoryCurrentResponse(response);
      }
      
      if (response.contents !== undefined && response.dirpath !== undefined) {
        // Directory list response
        return this.formatDirectoryListResponse(response);
      }
      
      if (response.filepath !== undefined && response.bytesWritten !== undefined) {
        // File write response
        return this.formatFileWriteResponse(response);
      }
      
      if (response.message !== undefined) {
        // Simple message response
        return this.formatMessageResponse(response);
      }
      
      // Default object formatting
      return this.formatObjectResponse(response);
    }
    
    // String response
    if (typeof response === 'string') {
      return [{ text: response, type: 'success' }];
    }
    
    // Array response
    if (Array.isArray(response)) {
      return this.formatArrayResponse(response);
    }
    
    // Other types
    return [{ text: String(response), type: 'success' }];
  }
  
  formatSuccessResponse(data) {
    if (typeof data === 'string') {
      return [{ text: data, type: 'success' }];
    }
    if (typeof data === 'object' && data !== null) {
      // Special formatting for known response types
      if (data.currentDirectory) {
        return this.formatDirectoryCurrentResponse(data);
      }
      if (data.contents && data.dirpath) {
        return this.formatDirectoryListResponse(data);
      }
      if (data.content && data.filepath) {
        return this.formatFileReadResponse(data);
      }
      if (data.modules) {
        // Format module list
        const output = [];
        if (data.modules.loaded && data.modules.loaded.length > 0) {
          output.push({ text: 'Loaded modules:', type: 'info' });
          data.modules.loaded.forEach(mod => {
            output.push({ text: `   ✓ ${mod}`, type: 'success' });
          });
        } else {
          output.push({ text: 'No modules loaded', type: 'info' });
        }
        
        if (data.modules.available && data.modules.available.length > 0) {
          output.push({ text: 'Available modules:', type: 'info' });
          data.modules.available.forEach(mod => {
            output.push({ text: `   • ${mod}`, type: 'info' });
          });
        }
        return output;
      }
      if (data.message) {
        return this.formatMessageResponse(data);
      }
      return this.formatObjectResponse(data);
    }
    return [{ text: JSON.stringify(data, null, 2), type: 'success' }];
  }
  
  formatErrorResponse(message, data) {
    const output = [];
    output.push({ text: `❌ Error: ${message}`, type: 'error' });
    if (data && data.details) {
      output.push({ text: `   Details: ${data.details}`, type: 'error' });
    }
    if (data && data.errorCode) {
      output.push({ text: `   Code: ${data.errorCode}`, type: 'error' });
    }
    return output;
  }
  
  formatFileReadResponse(response) {
    const output = [];
    output.push({ text: `📄 File: ${response.filepath}`, type: 'success' });
    if (response.size !== undefined) {
      output.push({ text: `   Size: ${this.formatBytes(response.size)}`, type: 'info' });
    }
    output.push({ text: '─'.repeat(40), type: 'info' });
    if (response.content) {
      // Split content by lines and display
      const lines = response.content.split('\n');
      const maxLines = 50; // Limit display to first 50 lines
      const displayLines = lines.slice(0, maxLines);
      displayLines.forEach(line => {
        output.push({ text: line, type: 'success' });
      });
      if (lines.length > maxLines) {
        output.push({ text: `... (${lines.length - maxLines} more lines)`, type: 'info' });
      }
    }
    return output;
  }
  
  formatFileWriteResponse(response) {
    const output = [];
    output.push({ text: `✅ File written: ${response.filepath}`, type: 'success' });
    output.push({ text: `   Bytes written: ${this.formatBytes(response.bytesWritten)}`, type: 'info' });
    if (response.created !== undefined) {
      output.push({ text: `   Status: ${response.created ? 'Created new file' : 'Updated existing file'}`, type: 'info' });
    }
    return output;
  }
  
  formatDirectoryCurrentResponse(response) {
    return [
      { text: `📁 Current directory: ${response.currentDirectory}`, type: 'success' }
    ];
  }
  
  formatDirectoryListResponse(response) {
    const output = [];
    output.push({ text: `📁 Directory: ${response.dirpath}`, type: 'success' });
    output.push({ text: `   Total items: ${response.contents.length}`, type: 'info' });
    output.push({ text: '─'.repeat(40), type: 'info' });
    
    // Separate files and directories
    const dirs = response.contents.filter(item => item.type === 'directory');
    const files = response.contents.filter(item => item.type === 'file');
    
    // Display directories first
    if (dirs.length > 0) {
      dirs.sort((a, b) => a.name.localeCompare(b.name));
      dirs.forEach(dir => {
        output.push({ text: `  📁 ${dir.name}/`, type: 'info' });
      });
    }
    
    // Then display files
    if (files.length > 0) {
      files.sort((a, b) => a.name.localeCompare(b.name));
      files.forEach(file => {
        const sizeStr = file.size !== undefined ? ` (${this.formatBytes(file.size)})` : '';
        output.push({ text: `  📄 ${file.name}${sizeStr}`, type: 'success' });
      });
    }
    
    if (response.contents.length === 0) {
      output.push({ text: '  (empty directory)', type: 'info' });
    }
    
    return output;
  }
  
  formatMessageResponse(response) {
    const output = [];
    
    // Handle success/message format
    if (response.message) {
      if (response.success !== undefined) {
        const icon = response.success ? '✅' : '❌';
        output.push({ text: `${icon} ${response.message}`, type: response.success ? 'success' : 'error' });
      } else {
        output.push({ text: response.message, type: 'success' });
      }
    }
    
    // Add additional fields if present
    if (response.module) {
      output.push({ text: `   Module: ${response.module}`, type: 'info' });
    }
    
    if (response.toolsLoaded && Array.isArray(response.toolsLoaded)) {
      output.push({ text: `   Tools loaded: ${response.toolsLoaded.length}`, type: 'info' });
      response.toolsLoaded.forEach(tool => {
        // Handle both string (old format) and object (new format)
        const toolName = typeof tool === 'string' ? tool : tool.name;
        output.push({ text: `     - ${toolName}`, type: 'info' });
      });
    }
    
    
    return output;
  }
  
  formatObjectResponse(obj) {
    const output = [];
    // Pretty print object with proper indentation
    const formatted = JSON.stringify(obj, null, 2);
    formatted.split('\n').forEach(line => {
      output.push({ text: line, type: 'success' });
    });
    return output;
  }
  
  formatArrayResponse(arr) {
    const output = [];
    arr.forEach(item => {
      if (typeof item === 'string') {
        output.push({ text: `  • ${item}`, type: 'success' });
      } else {
        output.push({ text: `  • ${JSON.stringify(item)}`, type: 'success' });
      }
    });
    return output;
  }
  
  formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Handle generic tool result
   */
  handleToolResult(response) {
    console.log('TerminalActor: handleToolResult response:', response);
    
    try {
      const formatted = this.formatToolResponse(response);
      if (formatted) {
        formatted.forEach(output => {
          this.terminal.addOutput(output.text, output.type);
        });
      }
    } catch (error) {
      console.error('Error formatting response:', error);
      // Fallback to simple JSON display
      this.terminal.addOutput(JSON.stringify(response, null, 2), 'success');
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
      if (this.terminal) {
        this.terminal.addOutput('Connected to server', 'success');
      } else {
        console.log('TerminalActor: Connected to server (terminal not yet attached)');
      }
    });
    
    actorSpace.on('session_ready', async ({ sessionId }) => {
      if (this.terminal) {
        this.terminal.addOutput(`Session created: ${sessionId}`, 'success');
        this.terminal.addOutput('Type .help to see available commands', 'info');
      } else {
        console.log(`TerminalActor: Session created: ${sessionId} (terminal not yet attached)`);
      }
      
      // Load tool schemas so we know how to parse arguments
      try {
        console.log('Loading initial tool schemas...');
        const response = await this.actorSpace.callTool(toolMethods.LIST_TOOLS);
        console.log('Tool list response:', response);
        
        if (!response || (!response.tools && !response.result)) {
          console.error('Invalid tools response:', response);
          if (this.terminal) {
            this.terminal.addOutput('Warning: Failed to load tool schemas. Run "tools" to load them.', 'warning');
          }
        } else {
          this.handleToolsList(response, true); // true = silent mode
          console.log('Tool schemas loaded. Available tools:', this.toolDefinitions.size);
          
          // Check if module_list is available
          if (this.toolDefinitions.has('module_list')) {
            console.log('module_list tool is available');
          } else {
            console.warn('module_list tool is NOT available in initial load');
            console.log('Available tools:', Array.from(this.toolDefinitions.keys()).slice(0, 10));
          }
        }
      } catch (error) {
        console.error('Failed to load tool schemas:', error);
        this.terminal.addOutput('Warning: Failed to load tool schemas. Run "tools" to load them.', 'warning');
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