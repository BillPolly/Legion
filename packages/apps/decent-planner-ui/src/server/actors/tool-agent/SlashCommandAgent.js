/**
 * SlashCommandAgent - Handle slash commands with full chat context access
 * 
 * Operates independently from ToolUsingChatAgent but has access to:
 * - Chat history
 * - Execution context (variables/artifacts)
 * - Operation history  
 * - Tool registry
 * - Saved sessions/plans
 * 
 * Follows fail-fast principles with no fallbacks.
 */

import { SlashCommandProcessor } from './SlashCommandProcessor.js';
import fs from 'fs/promises';
import path from 'path';

export class SlashCommandAgent {
  constructor(toolRegistry, llmClient, eventCallback = null) {
    this.toolRegistry = toolRegistry;
    this.llmClient = llmClient;
    this.eventCallback = eventCallback;
    this.resourceActor = null; // Will be set by parent actor
    
    // Command processor
    this.processor = new SlashCommandProcessor();
    
    // Sessions storage (simple file-based for now)
    this.sessionsDir = path.join(process.cwd(), 'saved-sessions');
  }
  
  /**
   * Set resource actor reference for /show commands
   * @param {Object} resourceActor - ResourceServerSubActor instance
   */
  setResourceActor(resourceActor) {
    this.resourceActor = resourceActor;
  }

  /**
   * Process slash command with full context access
   * @param {string} input - Slash command input
   * @param {Object} chatAgent - Reference to ToolUsingChatAgent for context access
   * @returns {Object} Command response
   */
  async processSlashCommand(input, chatAgent) {
    console.log(`[SlashCommandAgent] Processing: "${input}"`);
    
    // Parse command
    const parsed = this.processor.parseCommand(input);
    
    if (!parsed) {
      throw new Error('Input is not a slash command');
    }
    
    if (!parsed.isValid) {
      return {
        success: false,
        text: parsed.error,
        usage: parsed.usage,
        isSlashCommand: true
      };
    }
    
    // Execute command with context access
    try {
      const result = await this.executeCommand(parsed, chatAgent);
      return {
        success: true,
        text: result,
        isSlashCommand: true,
        command: parsed.command
      };
    } catch (error) {
      console.error(`[SlashCommandAgent] Error executing /${parsed.command}:`, error);
      return {
        success: false,
        text: `Error executing /${parsed.command}: ${error.message}`,
        isSlashCommand: true,
        command: parsed.command,
        error: error.message
      };
    }
  }

  /**
   * Execute a specific command
   * @param {Object} parsed - Parsed command object
   * @param {Object} chatAgent - ToolUsingChatAgent instance
   * @returns {string} Command result text
   */
  async executeCommand(parsed, chatAgent) {
    const { command, args } = parsed;
    
    switch (command) {
      case 'help':
        return this.handleHelp(args, chatAgent);
      case 'context':
        return this.handleContext(args, chatAgent);
      case 'clear':
        return this.handleClear(args, chatAgent);
      case 'debug':
        return this.handleDebug(args, chatAgent);
      case 'history':
        return this.handleHistory(args, chatAgent);
      case 'save':
        return await this.handleSave(args, chatAgent);
      case 'load':
        return await this.handleLoad(args, chatAgent);
      case 'show':
        return await this.handleShow(args, chatAgent);
      case 'show_all':
        return await this.handleShowAll(args, chatAgent);
      case 'ls':
        return await this.handleLs(args, chatAgent);
      case 'cd':
        return await this.handleCd(args, chatAgent);
      case 'pwd':
        return await this.handlePwd(args, chatAgent);
      case 'vars':
        return await this.handleVars(args, chatAgent);
      default:
        throw new Error(`Unknown command: /${command}`);
    }
  }

  /**
   * Handle /help command
   */
  handleHelp(args, chatAgent) {
    const commandName = args.command;
    return this.processor.generateHelpText(commandName);
  }

  /**
   * Handle /context command - show current execution context
   */
  handleContext(args, chatAgent) {
    const context = chatAgent.executionContext;
    const artifacts = context.artifacts || {};
    
    if (Object.keys(artifacts).length === 0) {
      return '**Current Context:** Empty\n\nNo variables or artifacts stored.';
    }
    
    let output = '**Current Context Variables:**\n\n';
    
    Object.entries(artifacts).forEach(([key, value]) => {
      const preview = this.getVariablePreview(value);
      const type = typeof value;
      output += `- **${key}** (${type}): ${preview}\n`;
    });
    
    // Add context statistics
    const totalSize = JSON.stringify(artifacts).length;
    const variableCount = Object.keys(artifacts).length;
    
    output += `\n**Context Statistics:**\n`;
    output += `- Variables: ${variableCount}\n`;
    output += `- Total size: ${this.formatBytes(totalSize)}\n`;
    output += `- Chat history: ${chatAgent.chatHistory.length} messages\n`;
    output += `- Operations: ${chatAgent.operationHistory.length}\n`;
    
    return output;
  }

  /**
   * Handle /clear command - clear chat context
   */
  handleClear(args, chatAgent) {
    const beforeStats = {
      variables: Object.keys(chatAgent.executionContext.artifacts).length,
      chatHistory: chatAgent.chatHistory.length,
      operations: chatAgent.operationHistory.length
    };
    
    // Clear context
    chatAgent.clearContext();
    
    let output = '**Context Cleared Successfully**\n\n';
    output += '**Cleared:**\n';
    output += `- Variables: ${beforeStats.variables}\n`;
    output += `- Chat messages: ${beforeStats.chatHistory}\n`;
    output += `- Operations: ${beforeStats.operations}\n\n`;
    output += 'All stored data has been removed. Starting fresh!';
    
    return output;
  }

  /**
   * Handle /debug command - show debug information
   */
  handleDebug(args, chatAgent) {
    const debugType = args.type || 'all';
    let output = '';
    
    switch (debugType) {
      case 'llm':
        output = this.formatLLMDebugInfo(chatAgent);
        break;
      case 'tools':
        output = this.formatToolDebugInfo(chatAgent);
        break;
      case 'operations':
        output = this.formatOperationDebugInfo(chatAgent);
        break;
      case 'all':
      default:
        output = this.formatCompleteDebugInfo(chatAgent);
        break;
    }
    
    return output;
  }

  /**
   * Handle /history command - show operation history
   */
  handleHistory(args, chatAgent) {
    const count = args.count || 10;
    const operations = chatAgent.operationHistory.slice(-count);
    
    if (operations.length === 0) {
      return '**Operation History:** Empty\n\nNo operations have been performed yet.';
    }
    
    let output = `**Recent Operations (last ${operations.length}):**\n\n`;
    
    operations.forEach((op, index) => {
      const timestamp = new Date(op.timestamp).toLocaleTimeString();
      const status = op.success ? '✅' : '❌';
      
      output += `${status} **${op.tool}** (${timestamp})\n`;
      if (op.outputVariable) {
        output += `   → Stored as: ${op.outputVariable}\n`;
      }
      if (op.error) {
        output += `   → Error: ${op.error}\n`;
      }
      output += '\n';
    });
    
    return output.trim();
  }

  /**
   * Handle /save command - save current session
   */
  async handleSave(args, chatAgent) {
    const sessionName = args.name;
    
    // Validate session name
    if (!/^[a-zA-Z0-9_-]+$/.test(sessionName)) {
      throw new Error('Session name can only contain letters, numbers, underscores and dashes');
    }
    
    // Create session data
    const sessionData = {
      name: sessionName,
      timestamp: new Date().toISOString(),
      chatHistory: chatAgent.chatHistory,
      executionContext: chatAgent.executionContext,
      operationHistory: chatAgent.operationHistory,
      metadata: {
        messageCount: chatAgent.chatHistory.length,
        variableCount: Object.keys(chatAgent.executionContext.artifacts).length,
        operationCount: chatAgent.operationHistory.length
      }
    };
    
    // Ensure sessions directory exists
    await this.ensureSessionsDirectory();
    
    // Save session
    const sessionPath = path.join(this.sessionsDir, `${sessionName}.json`);
    await fs.writeFile(sessionPath, JSON.stringify(sessionData, null, 2), 'utf-8');
    
    let output = `**Session Saved: ${sessionName}**\n\n`;
    output += `**Saved Data:**\n`;
    output += `- Chat messages: ${sessionData.metadata.messageCount}\n`;
    output += `- Variables: ${sessionData.metadata.variableCount}\n`;
    output += `- Operations: ${sessionData.metadata.operationCount}\n`;
    output += `- File: ${sessionPath}\n\n`;
    output += `Use \`/load ${sessionName}\` to restore this session later.`;
    
    return output;
  }

  /**
   * Handle /load command - load saved session
   */
  async handleLoad(args, chatAgent) {
    const sessionName = args.name;
    const sessionPath = path.join(this.sessionsDir, `${sessionName}.json`);
    
    try {
      // Check if file exists
      await fs.access(sessionPath);
      
      // Load session data
      const sessionDataRaw = await fs.readFile(sessionPath, 'utf-8');
      const sessionData = JSON.parse(sessionDataRaw);
      
      // Validate session data structure
      if (!sessionData.chatHistory || !sessionData.executionContext || !sessionData.operationHistory) {
        throw new Error('Invalid session file structure');
      }
      
      // Clear current context first
      chatAgent.clearContext();
      
      // Restore session data
      chatAgent.chatHistory = sessionData.chatHistory || [];
      chatAgent.executionContext = sessionData.executionContext || { artifacts: {} };
      chatAgent.operationHistory = sessionData.operationHistory || [];
      
      const loadedAt = new Date(sessionData.timestamp).toLocaleString();
      
      let output = `**Session Loaded: ${sessionName}**\n\n`;
      output += `**Session Info:**\n`;
      output += `- Saved: ${loadedAt}\n`;
      output += `- Messages: ${sessionData.metadata?.messageCount || sessionData.chatHistory.length}\n`;
      output += `- Variables: ${sessionData.metadata?.variableCount || Object.keys(sessionData.executionContext.artifacts).length}\n`;
      output += `- Operations: ${sessionData.metadata?.operationCount || sessionData.operationHistory.length}\n\n`;
      output += 'Session restored successfully. Previous context has been replaced.';
      
      return output;
      
    } catch (error) {
      if (error.code === 'ENOENT') {
        // List available sessions
        const available = await this.listAvailableSessions();
        throw new Error(`Session '${sessionName}' not found.\n\nAvailable sessions: ${available.join(', ') || 'none'}`);
      }
      throw error;
    }
  }

  /**
   * Format LLM debug information
   */
  formatLLMDebugInfo(chatAgent) {
    const interactions = chatAgent.llmInteractions || [];
    if (interactions.length === 0) {
      return '**LLM Debug:** No interactions recorded.';
    }
    
    let output = `**LLM Debug Information (last ${Math.min(5, interactions.length)}):**\n\n`;
    
    interactions.slice(-5).forEach((interaction, index) => {
      const timestamp = new Date(interaction.timestamp).toLocaleTimeString();
      const status = interaction.success ? '✅' : '❌';
      
      output += `${status} **${interaction.purpose}** (${timestamp})\n`;
      if (interaction.error) {
        output += `   Error: ${interaction.error}\n`;
      }
      output += '\n';
    });
    
    return output.trim();
  }

  /**
   * Format tool debug information
   */
  formatToolDebugInfo(chatAgent) {
    const searchResults = chatAgent.currentSearchResults || [];
    let output = '**Tool Debug Information:**\n\n';
    
    if (searchResults.length === 0) {
      output += 'No recent tool searches.';
    } else {
      output += `**Recent Tool Search Results (${searchResults.length}):**\n`;
      searchResults.slice(0, 5).forEach(result => {
        const confidence = result.confidence ? ` (${(result.confidence * 100).toFixed(1)}%)` : '';
        output += `- ${result.name}${confidence}: ${result.description || 'No description'}\n`;
      });
    }
    
    return output;
  }

  /**
   * Format operation debug information
   */
  formatOperationDebugInfo(chatAgent) {
    return this.handleHistory({ count: 5 }, chatAgent);
  }

  /**
   * Format complete debug information
   */
  formatCompleteDebugInfo(chatAgent) {
    let output = '**Complete Debug Information:**\n\n';
    
    // Context summary
    const contextStats = this.getContextStats(chatAgent);
    output += '**Context Summary:**\n';
    output += `- Variables: ${contextStats.variables}\n`;
    output += `- Chat messages: ${contextStats.messages}\n`;
    output += `- Operations: ${contextStats.operations}\n`;
    output += `- LLM interactions: ${contextStats.llmInteractions}\n\n`;
    
    // Recent activities
    output += '**Recent Activities:**\n';
    const recentOps = chatAgent.operationHistory.slice(-3);
    if (recentOps.length > 0) {
      recentOps.forEach(op => {
        const status = op.success ? '✅' : '❌';
        output += `${status} ${op.tool}`;
        if (op.outputVariable) output += ` → ${op.outputVariable}`;
        output += '\n';
      });
    } else {
      output += 'No recent operations.\n';
    }
    
    return output.trim();
  }

  /**
   * Get context statistics
   */
  getContextStats(chatAgent) {
    return {
      variables: Object.keys(chatAgent.executionContext.artifacts || {}).length,
      messages: chatAgent.chatHistory.length,
      operations: chatAgent.operationHistory.length,
      llmInteractions: (chatAgent.llmInteractions || []).length
    };
  }

  /**
   * Get variable preview for display
   */
  getVariablePreview(value) {
    if (value === null) return 'null';
    if (value === undefined) return 'undefined';
    
    const type = typeof value;
    switch (type) {
      case 'string':
        return value.length > 100 ? `"${value.substring(0, 97)}..."` : `"${value}"`;
      case 'number':
      case 'boolean':
        return String(value);
      case 'object':
        if (Array.isArray(value)) {
          return value.length < 3 ? JSON.stringify(value) : `Array(${value.length})`;
        } else {
          const keys = Object.keys(value);
          if (keys.length < 3) {
            try {
              const json = JSON.stringify(value);
              return json.length < 100 ? json : `Object(${keys.length} keys)`;
            } catch {
              return `Object(${keys.length} keys)`;
            }
          } else {
            return `Object(${keys.length} keys)`;
          }
        }
      default:
        return `${type}`;
    }
  }

  /**
   * Format bytes for display
   */
  formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  /**
   * Ensure sessions directory exists
   */
  async ensureSessionsDirectory() {
    try {
      await fs.access(this.sessionsDir);
    } catch {
      await fs.mkdir(this.sessionsDir, { recursive: true });
    }
  }

  /**
   * List available saved sessions
   */
  async listAvailableSessions() {
    try {
      const files = await fs.readdir(this.sessionsDir);
      return files
        .filter(file => file.endsWith('.json'))
        .map(file => path.basename(file, '.json'));
    } catch {
      return [];
    }
  }

  /**
   * Handle /show command - open resource in appropriate viewer
   * @param {Array} args - Command arguments
   * @param {Object} chatAgent - Chat agent context  
   * @returns {string} Result message
   */
  async handleShow(args, chatAgent) {
    if (!this.resourceActor) {
      throw new Error('/show command requires resource actor - not available');
    }
    
    if (!args.path) {
      throw new Error('/show command requires a file path. Usage: /show <path>');
    }
    
    const resourcePath = args.path;
    console.log(`[SlashCommandAgent] Processing /show for: ${resourcePath}`);
    console.log(`[SlashCommandAgent] Args received:`, args);
    
    try {
      // Request resource through resource actor
      // The resource actor will handle the complete flow:
      // 1. Create resource handle
      // 2. Send to client
      // 3. Client creates window with appropriate viewer
      
      // Determine resource type
      let resourceType = 'file';
      if (resourcePath === '/' || !path.extname(resourcePath)) {
        resourceType = 'directory'; 
      } else if (['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg'].includes(path.extname(resourcePath).toLowerCase())) {
        resourceType = 'image';
      }
      
      // Trigger resource creation (this will flow to client and create window)
      await this.resourceActor.receive('resource:request', {
        path: resourcePath,
        type: resourceType
      });
      
      // Return immediate response to chat
      const fileName = path.basename(resourcePath) || resourcePath;
      return `📂 Opening ${fileName} in ${resourceType} viewer...`;
      
    } catch (error) {
      throw new Error(`Failed to open resource: ${error.message}`);
    }
  }

  /**
   * Handle /show_all command - display any object with intelligent type detection
   * @param {Object} args - Command arguments
   * @param {Object} chatAgent - ToolUsingChatAgent instance
   * @returns {Object} Command result
   */
  async handleShowAll(args, chatAgent) {
    if (!this.resourceActor) {
      throw new Error('/show_all command requires resource actor - not available');
    }
    
    if (!args.object && !args.directHandle) {
      throw new Error('show_all command requires object parameter');
    }
    
    console.log(`[SlashCommandAgent] Processing /show_all for:`, args);
    
    try {
      let targetObject;
      let objectRef = args.object || args.directHandle;
      
      // Handle direct object vs context reference vs file path
      if (typeof objectRef === 'string') {
        if (objectRef.startsWith('@')) {
          // Variable reference - strip @ and look in context
          const varName = objectRef.substring(1);
          targetObject = chatAgent.executionContext.artifacts[varName];
          if (!targetObject) {
            throw new Error(`Variable @${varName} not found in execution context`);
          }
        } else if (objectRef.includes('/') || objectRef.includes('.')) {
          // File path - treat as file path to display
          const fs = await import('fs/promises');
          try {
            await fs.access(objectRef);
            targetObject = objectRef; // Pass file path as-is for file display
          } catch (error) {
            throw new Error(`File not found: ${objectRef}`);
          }
        } else {
          // Object name in context (legacy support)
          targetObject = chatAgent.executionContext.artifacts[objectRef];
          if (!targetObject) {
            throw new Error(`Object ${objectRef} not found in execution context. Use @${objectRef} for variables or provide a file path.`);
          }
        }
      } else {
        // Direct object passed
        targetObject = objectRef;
      }
      
      // Detect object type and prepare for transmission
      const objectInfo = this._analyzeObject(targetObject);
      console.log(`[SlashCommandAgent] Object analysis:`, objectInfo);
      
      // Prepare data for resource actor
      const requestData = {
        objectType: objectInfo.type,
        displayOptions: {
          includeIntrospection: args.includeIntrospection || false,
          format: args.format || 'default'
        }
      };
      
      // Add appropriate data based on object type
      if (objectInfo.type === 'handle') {
        requestData.handleData = targetObject.serialize();
        
        if (args.includeIntrospection) {
          requestData.introspectionData = {
            methods: targetObject.type?.listMethods() || [],
            attributes: targetObject.type?.listAttributes() || [],
            typeName: targetObject.type?.name || 'Unknown'
          };
        }
      } else {
        requestData.objectData = targetObject;
      }
      
      // Send to resource actor for display
      const result = await this.resourceActor.receive('show-all-request', requestData);
      
      const response = {
        success: true,
        objectType: objectInfo.type,
        handleType: objectInfo.type === 'handle' ? targetObject.handleType : undefined,
        ...result
      };
      
      console.log(`[SlashCommandAgent] show_all result:`, response);
      return response;
      
    } catch (error) {
      console.error(`[SlashCommandAgent] show_all error:`, error);
      throw error;
    }
  }

  /**
   * Analyze object to determine type and display strategy
   * @private
   * @param {any} obj - Object to analyze
   * @returns {Object} Analysis result with type and metadata
   */
  _analyzeObject(obj) {
    // Check if it's a handle (extends BaseHandle/Actor)
    if (obj && obj.isActor && obj.handleType && typeof obj.serialize === 'function') {
      return {
        type: 'handle',
        handleType: obj.handleType,
        hasIntrospection: !!obj.type,
        methods: obj.type?.listMethods() || [],
        attributes: obj.type?.listAttributes() || []
      };
    }
    
    // Check if it's a complex object (arrays, custom classes, etc.) first
    if (obj && typeof obj === 'object') {
      // Check if it's a simple plain object (for serialization)
      if (obj.constructor === Object) {
        return {
          type: 'serializable',
          keys: Object.keys(obj),
          size: Object.keys(obj).length
        };
      }
      
      // Everything else is complex
      return {
        type: 'complex',
        constructor: obj.constructor.name,
        isArray: Array.isArray(obj),
        keys: Object.keys(obj)
      };
    }
    
    // Primitive values
    return {
      type: 'primitive',
      valueType: typeof obj,
      value: obj
    };
  }

  /**
   * Parse show_all command arguments
   * @param {string} input - Full command input
   * @returns {Object} Parsed arguments
   */
  parseShowAllCommand(input) {
    const parts = input.trim().split(/\s+/);
    
    if (parts.length < 2) {
      throw new Error('show_all command requires an object reference');
    }
    
    const objectRef = parts[1];
    const args = { object: objectRef };
    
    // Parse flags
    for (let i = 2; i < parts.length; i++) {
      const part = parts[i];
      
      if (part === '--introspection') {
        args.includeIntrospection = true;
      } else if (part.startsWith('--format=')) {
        args.format = part.split('=')[1];
      }
    }
    
    return args;
  }

  /**
   * Handle /ls command - list files and directories
   * @param {Object} args - Command arguments
   * @param {Object} chatAgent - ToolUsingChatAgent instance
   * @returns {string} Directory listing
   */
  async handleLs(args, chatAgent) {
    const fs = await import('fs/promises');
    const path = await import('path');
    
    try {
      const targetPath = args.path || process.cwd();
      const showDetailed = args.detailed || false;
      const filterType = args.type;
      
      console.log(`[SlashCommandAgent] Listing directory: ${targetPath}`);
      
      const entries = await fs.readdir(targetPath, { withFileTypes: true });
      let result = `**Directory: ${targetPath}**\n\n`;
      
      const filteredEntries = entries.filter(entry => {
        if (!filterType) return true;
        
        if (filterType === 'file' && entry.isFile()) return true;
        if (filterType === 'directory' && entry.isDirectory()) return true;
        if (filterType === 'image' && entry.isFile()) {
          const ext = path.extname(entry.name).toLowerCase();
          return ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg'].includes(ext);
        }
        return false;
      });
      
      if (filteredEntries.length === 0) {
        result += '*(empty directory)*';
        return result;
      }
      
      for (const entry of filteredEntries) {
        const icon = entry.isDirectory() ? '📁' : '📄';
        let line = `${icon} ${entry.name}`;
        
        if (showDetailed) {
          const fullPath = path.join(targetPath, entry.name);
          const stats = await fs.stat(fullPath);
          const size = entry.isFile() ? `${Math.round(stats.size / 1024)}KB` : '-';
          const modified = stats.mtime.toISOString().split('T')[0];
          line += ` (${size}, ${modified})`;
        }
        
        result += line + '\n';
      }
      
      return result;
      
    } catch (error) {
      throw new Error(`Failed to list directory: ${error.message}`);
    }
  }

  /**
   * Handle /cd command - change directory
   * @param {Object} args - Command arguments  
   * @param {Object} chatAgent - ToolUsingChatAgent instance
   * @returns {string} Directory change result
   */
  async handleCd(args, chatAgent) {
    const fs = await import('fs/promises');
    
    if (!args.path) {
      throw new Error('/cd command requires a path. Usage: /cd <path>');
    }
    
    try {
      const targetPath = args.path === '~' ? require('os').homedir() : args.path;
      
      // Verify directory exists
      const stats = await fs.stat(targetPath);
      if (!stats.isDirectory()) {
        throw new Error(`${targetPath} is not a directory`);
      }
      
      // Change directory
      process.chdir(targetPath);
      const newDir = process.cwd();
      
      console.log(`[SlashCommandAgent] Changed directory to: ${newDir}`);
      
      // Store in context for future commands
      chatAgent.executionContext.artifacts.current_directory = {
        value: newDir,
        description: 'Current working directory'
      };
      
      return `**Directory changed to:** ${newDir}`;
      
    } catch (error) {
      throw new Error(`Failed to change directory: ${error.message}`);
    }
  }

  /**
   * Handle /pwd command - print working directory
   * @param {Object} args - Command arguments
   * @param {Object} chatAgent - ToolUsingChatAgent instance  
   * @returns {string} Current directory
   */
  async handlePwd(args, chatAgent) {
    const currentDir = process.cwd();
    
    console.log(`[SlashCommandAgent] Current directory: ${currentDir}`);
    
    // Store in context
    chatAgent.executionContext.artifacts.current_directory = {
      value: currentDir,
      description: 'Current working directory'
    };
    
    return `**Current directory:** ${currentDir}`;
  }

  /**
   * Handle /vars command - list execution context variables
   * @param {Object} args - Command arguments
   * @param {Object} chatAgent - ToolUsingChatAgent instance
   * @returns {string} Variable listing
   */
  async handleVars(args, chatAgent) {
    const showDetailed = args.detailed || false;
    const filterType = args.type;
    
    const artifacts = chatAgent.executionContext.artifacts || {};
    const varNames = Object.keys(artifacts);
    
    if (varNames.length === 0) {
      return '**No variables in execution context**\n\nUse tools or commands to create variables.';
    }
    
    let result = '**Execution Context Variables:**\n\n';
    result += `*Use @varName to reference variables in commands*\n\n`;
    
    const filteredVars = varNames.filter(name => {
      if (!filterType) return true;
      
      const value = artifacts[name];
      const analysis = this._analyzeObject(value);
      
      return analysis.type === filterType;
    });
    
    if (filteredVars.length === 0) {
      result += `*No variables of type "${filterType}" found*`;
      return result;
    }
    
    for (const varName of filteredVars) {
      const value = artifacts[varName];
      const analysis = this._analyzeObject(value);
      
      let icon = '📄';
      if (analysis.type === 'handle') icon = '🎭';
      else if (analysis.type === 'complex') icon = '📦';
      else if (analysis.type === 'primitive') icon = '🔸';
      
      let line = `${icon} **@${varName}** (${analysis.type})`;
      
      if (showDetailed) {
        if (analysis.type === 'handle') {
          line += `\n   - Handle Type: ${analysis.handleType}`;
          if (analysis.methods.length > 0) {
            line += `\n   - Methods: ${analysis.methods.join(', ')}`;
          }
          if (analysis.attributes.length > 0) {
            line += `\n   - Attributes: ${analysis.attributes.join(', ')}`;
          }
        } else if (analysis.type === 'serializable') {
          line += `\n   - Keys: ${analysis.keys.join(', ')}`;
        } else if (analysis.type === 'primitive') {
          line += `\n   - Value: ${JSON.stringify(analysis.value).substring(0, 50)}`;
        } else if (analysis.type === 'complex') {
          line += `\n   - Constructor: ${analysis.constructor}`;
          if (analysis.isArray) {
            line += ` (Array)`;
          }
        }
      }
      
      result += line + '\n\n';
    }
    
    result += `\n*Total: ${filteredVars.length} variables*`;
    
    return result;
  }

  /**
   * Check if input is a slash command
   * @param {string} input - User input
   * @returns {boolean} True if slash command
   */
  isSlashCommand(input) {
    return typeof input === 'string' && input.trim().startsWith('/');
  }
}