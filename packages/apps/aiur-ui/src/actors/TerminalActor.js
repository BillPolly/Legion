import { Actor } from '/Legion/shared/actors/src/Actor.js';

/**
 * Terminal Actor - handles terminal commands and responses
 */
export class TerminalActor extends Actor {
  constructor(terminal) {
    super();
    this.terminal = terminal;
    this.remoteAgent = null; // Reference to server TerminalAgent
    this.toolDefinitions = new Map(); // Store tool definitions with schemas
    this.connected = false;
    
    // Set this actor on the terminal (MVVM binding)
    if (this.terminal) {
      this.terminal.actor = this;
    }
  }
  
  /**
   * Set the remote agent reference for sending messages
   */
  setRemoteAgent(remoteAgent) {
    this.remoteAgent = remoteAgent;
    this.connected = true;
    console.log('TerminalActor: Set remote agent reference');
    
    // Initialize terminal if available
    if (this.terminal) {
      this.terminal.addOutput('Connected to terminal agent', 'success');
      
      // Create a session first
      this.createSession();
    }
  }
  
  /**
   * Create a new session with the TerminalAgent
   */
  createSession() {
    if (!this.remoteAgent) {
      console.error('TerminalActor: Cannot create session - no remote agent');
      return;
    }
    
    console.log('TerminalActor: Creating session...');
    this.remoteAgent.receive({
      type: 'session_create',
      requestId: `req_${Date.now()}`,
      timestamp: new Date().toISOString()
    });
  }
  
  /**
   * Disconnect from remote agent
   */
  disconnect() {
    this.remoteAgent = null;
    this.connected = false;
    
    if (this.terminal) {
      this.terminal.addOutput('Disconnected from terminal agent', 'warning');
    }
  }
  
  /**
   * Check if connected
   */
  isConnected() {
    return this.connected && this.remoteAgent;
  }
  
  /**
   * Receive messages from TerminalAgent via actor protocol
   */
  receive(payload, envelope) {
    console.log('TerminalActor: Received message:', payload);
    
    // Handle Aiur protocol messages from TerminalAgent
    if (payload.type) {
      switch (payload.type) {
        case 'session_created':
          this.handleSessionCreated(payload);
          break;
          
        case 'session_attached':
          this.handleSessionAttached(payload);
          break;
          
        case 'initial_tools':
          this.handleInitialTools(payload);
          break;
          
        case 'tools_list_response':
          this.handleToolsListResponse(payload);
          break;
          
        case 'tools_updated':
          this.handleToolsUpdated(payload);
          break;
          
        case 'tool_response':
          this.handleToolResponse(payload);
          break;
          
        case 'tool_error':
          this.handleToolError(payload);
          break;
          
        case 'module_list_response':
          this.handleModuleListResponse(payload);
          break;
          
        case 'module_loaded':
          this.handleModuleLoaded(payload);
          break;
          
        case 'module_unloaded':
          this.handleModuleUnloaded(payload);
          break;
          
        case 'module_error':
          this.handleModuleError(payload);
          break;
          
        case 'session_error':
          this.handleSessionError(payload);
          break;
          
        case 'error':
          this.handleError(payload);
          break;
          
        case 'pong':
          // Ping response
          console.log('TerminalActor: Received pong');
          break;
          
        case 'terminal_response':
          this.handleTerminalResponse(payload);
          break;
          
        case 'tools_list':
          // Alternative tools list response from BT agents
          this.handleToolsListResponse(payload);
          break;
        
        case 'response_sender':
          // Response from BT agent response_sender node
          this.handleBTResponse(payload);
          break;
          
        default:
          console.log('TerminalActor: Unknown message type:', payload.type);
          if (this.terminal) {
            // Only show the raw JSON for truly unknown types
            this.terminal.addOutput(`Unknown response type: ${payload.type}`, 'warning');
            if (payload.error) {
              this.terminal.addOutput(`Error: ${payload.error}`, 'error');
            } else if (payload.data) {
              this.terminal.addOutput(JSON.stringify(payload.data, null, 2), 'info');
            }
          }
      }
    }
  }
  
  /**
   * Handle session created message
   */
  handleSessionCreated(payload) {
    console.log('TerminalActor: Session created:', payload);
    this.sessionId = payload.sessionId;
    
    if (this.terminal) {
      this.terminal.addOutput(`Session created: ${payload.sessionId}`, 'success');
      this.terminal.addOutput('Type .help for available commands', 'info');
    }
  }
  
  /**
   * Handle session attached message
   */
  handleSessionAttached(payload) {
    console.log('TerminalActor: Session attached:', payload);
    this.sessionId = payload.sessionId;
    
    if (this.terminal) {
      this.terminal.addOutput(`Attached to session: ${payload.sessionId}`, 'success');
    }
  }
  
  /**
   * Handle initial tools list
   */
  handleInitialTools(payload) {
    console.log('TerminalActor: Received initial tools:', payload.tools?.length || 0);
    this.updateToolDefinitions(payload.tools || []);
    
    if (this.terminal) {
      this.terminal.addOutput(`Loaded ${payload.tools?.length || 0} tools`, 'info');
    }
  }
  
  /**
   * Handle tools list response
   */
  handleToolsListResponse(payload) {
    console.log('TerminalActor: Tools list response:', payload);
    this.handleToolsList(payload.tools || []);
  }
  
  /**
   * Handle tools updated message
   */
  handleToolsUpdated(payload) {
    console.log('TerminalActor: Tools updated:', payload.tools?.length || 0);
    this.updateToolDefinitions(payload.tools || []);
  }
  
  /**
   * Handle tool response
   */
  handleToolResponse(payload) {
    console.log('TerminalActor: Tool response:', payload);
    this.handleToolResult(payload.result);
  }
  
  /**
   * Handle tool error
   */
  handleToolError(payload) {
    console.error('TerminalActor: Tool error:', payload);
    
    if (this.terminal) {
      this.terminal.addOutput(`Tool error: ${payload.error}`, 'error');
      if (payload.tool) {
        this.terminal.addOutput(`Tool: ${payload.tool}`, 'error');
      }
    }
  }
  
  /**
   * Handle module list response
   */
  handleModuleListResponse(payload) {
    console.log('TerminalActor: Module list response:', payload);
    this.handleModulesList(payload.modules || { loaded: [], available: [] });
  }
  
  /**
   * Handle module loaded message
   */
  handleModuleLoaded(payload) {
    console.log('TerminalActor: Module loaded:', payload);
    
    if (this.terminal) {
      this.terminal.addOutput(payload.message || `Module ${payload.moduleName} loaded`, 'success');
      if (payload.toolsLoaded && payload.toolsLoaded.length > 0) {
        this.terminal.addOutput(`Added ${payload.toolsLoaded.length} tools`, 'info');
      }
    }
  }
  
  /**
   * Handle module unloaded message
   */
  handleModuleUnloaded(payload) {
    console.log('TerminalActor: Module unloaded:', payload);
    
    if (this.terminal) {
      this.terminal.addOutput(payload.message || `Module ${payload.moduleName} unloaded`, 'success');
    }
  }
  
  /**
   * Handle module error
   */
  handleModuleError(payload) {
    console.error('TerminalActor: Module error:', payload);
    
    if (this.terminal) {
      this.terminal.addOutput(`Module error: ${payload.error}`, 'error');
      if (payload.moduleName) {
        this.terminal.addOutput(`Module: ${payload.moduleName}`, 'error');
      }
    }
  }
  
  /**
   * Handle terminal response from BT agents
   */
  handleTerminalResponse(payload) {
    console.log('TerminalActor: Terminal response:', payload);
    
    if (this.terminal) {
      // Check for errors first
      if (payload.success === false || payload.data?.error) {
        const errorMsg = payload.data?.error || payload.error || 'Unknown error';
        this.terminal.addOutput(`Error: ${errorMsg}`, 'error');
        
        // Show additional context if available
        if (payload.data?.route) {
          this.terminal.addOutput('Failed route configuration:', 'error');
          this.terminal.addOutput(JSON.stringify(payload.data.route, null, 2), 'error');
        }
      } 
      // Handle successful responses
      else if (payload.data) {
        // Tools list
        if (payload.data.tools) {
          this.handleToolsList(payload.data.tools);
        }
        // Module list
        else if (payload.data.modules) {
          this.handleModulesList(payload.data.modules);
        }
        // Generic result
        else if (payload.data.result) {
          this.handleToolResult(payload.data.result);
        }
        // Raw data
        else {
          this.terminal.addOutput(JSON.stringify(payload.data, null, 2), 'info');
        }
      }
      // Handle simple success
      else if (payload.success) {
        this.terminal.addOutput('Operation completed successfully', 'success');
      }
      // Fallback for other responses
      else {
        this.terminal.addOutput(JSON.stringify(payload, null, 2), 'info');
      }
    }
  }
  
  /**
   * Handle BT agent response_sender node responses
   */
  handleBTResponse(payload) {
    console.log('TerminalActor: BT response:', payload);
    
    if (this.terminal) {
      // Extract the actual data from the BT response
      if (payload.stepResults && Array.isArray(payload.stepResults)) {
        // Find the tools list step result
        const toolsStep = payload.stepResults.find(step => 
          step.data?.toolsListing || step.data?.tools
        );
        
        if (toolsStep && toolsStep.data?.tools) {
          // Handle as tools list
          this.handleToolsList(toolsStep.data.tools);
          return;
        }
        
        // Find module list step result
        const modulesStep = payload.stepResults.find(step => 
          step.data?.modules
        );
        
        if (modulesStep && modulesStep.data?.modules) {
          // Handle as modules list
          this.handleModulesList(modulesStep.data.modules);
          return;
        }
      }
      
      // Check if there's a routing success/failure
      if (payload.routing) {
        if (payload.routing.success === false) {
          this.terminal.addOutput(`Operation failed: ${payload.routing.messageType}`, 'error');
          if (payload.routing.error) {
            this.terminal.addOutput(`Error: ${payload.routing.error}`, 'error');
          }
        } else if (payload.sequenceComplete) {
          // Just log that it completed, the actual data was already handled above
          console.log('BT sequence completed successfully');
        }
      }
      
      // Fallback: if we couldn't extract specific data, check for generic results
      if (payload.results && payload.results.length > 0) {
        const firstResult = payload.results[0];
        if (firstResult.data && firstResult.data !== '[Circular]') {
          this.terminal.addOutput(JSON.stringify(firstResult.data, null, 2), 'info');
        }
      }
    }
  }
  
  /**
   * Handle session error
   */
  handleSessionError(payload) {
    console.error('TerminalActor: Session error:', payload);
    
    if (this.terminal) {
      this.terminal.addOutput(`Session error: ${payload.error}`, 'error');
    }
  }
  
  /**
   * Send a command to the server via actor protocol
   */
  sendCommand(command) {
    // Validate connection
    if (!this.isConnected()) {
      this.showConnectionError();
      return;
    }
    
    if (!this.remoteAgent) {
      console.error('TerminalActor: No remote agent available');
      if (this.terminal) {
        this.terminal.addOutput('Not connected to terminal agent', 'error');
      }
      return;
    }
    
    console.log('TerminalActor: Processing command:', command);
    
    // Parse the command to determine what Aiur message to send
    const parts = command.trim().split(/\s+/);
    const cmd = parts[0];
    const args = parts.slice(1);
    
    // Generate request ID
    const requestId = `req_${Date.now()}`;
    
    // Handle different commands
    switch (cmd) {
      case 'tools':
      case 'list_tools':
        this.remoteAgent.receive({
          type: 'tools_list',
          requestId
        });
        break;
        
      case 'modules':
      case 'module_list':
        this.remoteAgent.receive({
          type: 'module_list', 
          requestId
        });
        break;
        
      case 'module_load':
        if (args.length === 0) {
          this.terminal.addOutput('Usage: module_load <module_name>', 'error');
          return;
        }
        this.remoteAgent.receive({
          type: 'module_load',
          requestId,
          moduleName: args[0]
        });
        break;
        
      case 'module_unload':
        if (args.length === 0) {
          this.terminal.addOutput('Usage: module_unload <module_name>', 'error');
          return;
        }
        this.remoteAgent.receive({
          type: 'module_unload',
          requestId,
          moduleName: args[0]
        });
        break;
        
      case 'ping':
        this.remoteAgent.receive({
          type: 'ping',
          requestId,
          timestamp: Date.now()
        });
        break;
        
      default:
        // Assume it's a tool request
        const toolName = cmd;
        const toolArgs = this.parseToolArguments(args);
        
        this.remoteAgent.receive({
          type: 'tool_request',
          requestId,
          tool: toolName,
          arguments: toolArgs
        });
        break;
    }
  }
  
  /**
   * Parse tool arguments from command line args
   */
  parseToolArguments(args) {
    const result = {};
    
    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      
      // Check for key=value format
      if (arg.includes('=')) {
        const [key, ...valueParts] = arg.split('=');
        result[key] = valueParts.join('=');
      } else {
        // Positional argument - use as 'arg0', 'arg1', etc
        result[`arg${i}`] = arg;
      }
    }
    
    return result;
  }
  
  
  /**
   * Handle tools list from agent
   */
  handleToolsList(tools) {
    if (!tools || tools.length === 0) {
      if (this.terminal) {
        this.terminal.addOutput('No tools available', 'info');
        this.terminal.addOutput('Try: module_load file', 'info');
      }
      return;
    }
    
    // Store tool definitions
    this.toolDefinitions.clear();
    tools.forEach(tool => {
      this.toolDefinitions.set(tool.name, tool);
    });
    
    // Update terminal's tool definitions for tab completion
    if (this.terminal && this.terminal.updateToolDefinitions) {
      this.terminal.updateToolDefinitions(this.toolDefinitions);
    }
    
    // Display tools
    if (this.terminal) {
      this.terminal.addOutput(`Available tools (${tools.length}):`, 'info');
      tools.forEach(tool => {
        this.terminal.addOutput(`  ${tool.name}: ${tool.description || 'No description'}`, 'info');
      });
    }
  }
  
  /**
   * Handle modules list from agent
   */
  handleModulesList(modules) {
    console.log('TerminalActor: handleModulesList called with:', modules);
    console.log('TerminalActor: terminal exists?', !!this.terminal);
    
    if (!this.terminal) {
      console.error('TerminalActor: No terminal reference!');
      return;
    }
    
    // Handle loaded modules
    if (modules.loaded && modules.loaded.length > 0) {
      this.terminal.addOutput('Loaded modules:', 'info');
      modules.loaded.forEach(mod => {
        // Check if we have details for this module
        if (modules.details && modules.details[mod]) {
          const details = modules.details[mod];
          this.terminal.addOutput(`  ✓ ${mod} (${details.toolCount} tools)`, 'success');
        } else {
          this.terminal.addOutput(`  ✓ ${mod}`, 'success');
        }
      });
    } else {
      this.terminal.addOutput('No modules loaded', 'info');
    }
    
    // Handle available modules
    if (modules.available && modules.available.length > 0) {
      this.terminal.addOutput('', 'info');
      this.terminal.addOutput('Available modules (use module_load <name> to load):', 'info');
      modules.available.forEach(mod => {
        this.terminal.addOutput(`  • ${mod}`, 'info');
      });
    }
  }
  
  /**
   * Show connection error
   */
  showConnectionError() {
    if (this.terminal) {
      this.terminal.addOutput('Not connected to terminal agent', 'error');
    }
  }
  
  /**
   * Handle session info from agent
   */
  handleSessionInfo(info) {
    if (!this.terminal) return;
    
    this.terminal.addOutput('Session info:', 'info');
    this.terminal.addOutput(`  Session ID: ${info.sessionId}`, 'info');
    this.terminal.addOutput(`  Agent ID: ${info.agentId}`, 'info');
    this.terminal.addOutput(`  Connected: ${info.connected}`, 'info');
    if (info.timestamp) {
      this.terminal.addOutput(`  Timestamp: ${info.timestamp}`, 'info');
    }
  }
  
  /**
   * Build tool arguments from command arguments (kept for future use)
   */
  buildToolArguments(toolName, args) {
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
    if (!Array.isArray(newTools)) {
      console.warn('TerminalActor: Invalid tools array:', newTools);
      return;
    }
    
    // Clear and rebuild tool definitions
    this.toolDefinitions.clear();
    newTools.forEach(toolDef => {
      this.toolDefinitions.set(toolDef.name, toolDef);
    });
    
    // Update terminal's tool definitions for tab completion
    if (this.terminal && this.terminal.updateToolDefinitions) {
      this.terminal.updateToolDefinitions(this.toolDefinitions);
    }
    
    // Log what was loaded
    console.log('TerminalActor: Updated tool definitions:', newTools.map(t => t.name));
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