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
   * Check if input is a slash command
   * @param {string} input - User input
   * @returns {boolean} True if slash command
   */
  isSlashCommand(input) {
    return typeof input === 'string' && input.trim().startsWith('/');
  }
}