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
      
      // If this was a module_load and successful, add the new tools
      if (toolName === 'module_load' && response?.success && response?.toolsLoaded) {
        // The response now contains full tool definitions
        response.toolsLoaded.forEach(toolDef => {
          // Add or update the tool definition
          this.toolDefinitions.set(toolDef.name, toolDef);
        });
        
        // Update terminal's tool definitions for tab completion
        if (this.terminal.updateToolDefinitions) {
          this.terminal.updateToolDefinitions(this.toolDefinitions);
        }
        
        // Show a summary of what was loaded
        console.log(`Module ${response.module} loaded with tools:`, response.toolsLoaded.map(t => t.name));
      }
      
      // If this was module_unload and successful, remove the tools
      if (toolName === 'module_unload' && response?.success) {
        // We'd need the server to tell us which tools to remove
        // For now, we can't easily determine which tools belong to which module
      }
      
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
    
    // Update terminal's tool definitions for tab completion
    if (this.terminal.updateToolDefinitions) {
      this.terminal.updateToolDefinitions(this.toolDefinitions);
    }
    
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