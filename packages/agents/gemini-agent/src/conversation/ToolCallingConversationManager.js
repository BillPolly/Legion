/**
 * ToolCallingConversationManager - Uses Legion's output-schema for tool calling
 * Integrates with GeminiToolsModule using proper Legion patterns
 */

import { ResponseValidator } from '@legion/output-schema';
import { ResourceManager } from '@legion/resource-manager';
import GeminiToolsModule from '../../../../modules/gemini-tools/src/GeminiToolsModule.js';
import path from 'path';
import { GeminiPromptManager } from '../prompts/GeminiPromptManager.js';
import GitService from '../services/GitService.js';
import ShellExecutionService from '../services/ShellExecutionService.js';
import ChatRecordingService from '../services/ChatRecordingService.js';

/**
 * Conversation manager with proper tool calling using Legion patterns
 */
export class ToolCallingConversationManager {
  constructor(resourceManager) {
    this.resourceManager = resourceManager;
    this.conversationHistory = [];
    this.turnCounter = 0;
    
    // Initialize core services only
    this._initializeToolsModule();
    this.promptManager = new GeminiPromptManager(resourceManager);
    this.gitService = new GitService(resourceManager);
    this.shellExecutionService = new ShellExecutionService(resourceManager);
    this.chatRecordingService = new ChatRecordingService(resourceManager);
    
    // Initialize services
    this._initializeAllServices();
    
    // Initialize multi-tool workflow schema (supports both single and multiple tools)
    this.toolCallSchema = {
      type: 'object',
      properties: {
        response: {
          type: 'string',
          description: 'Your response to the user'
        },
        use_tool: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Tool name to execute' },
            args: { type: 'object', description: 'Tool arguments' }
          },
          required: ['name', 'args']
        },
        use_tools: {
          type: 'array',
          description: 'Array of tools to execute in sequence',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string', description: 'Tool name' },
              args: { type: 'object', description: 'Tool arguments' }
            },
            required: ['name', 'args']
          }
        }
      },
      required: ['response']
    };
    
    this.responseValidator = new ResponseValidator(this.toolCallSchema);
  }

  // SD module initialization removed - using SDMethodologyService instead

  /**
   * Initialize all services
   */
  async _initializeAllServices() {
    try {
      // Initialize Git service with credentials
      await this.gitService.initialize();
      
      console.log('✅ All core services initialized');
    } catch (error) {
      console.warn('Service initialization warning:', error.message);
    }
  }

  /**
   * Initialize tools module directly
   */
  async _initializeToolsModule() {
    try {
      this.toolsModule = await GeminiToolsModule.create(this.resourceManager);
      console.log('✅ GeminiToolsModule initialized with', this.toolsModule.getStatistics().toolCount, 'tools');
    } catch (error) {
      console.error('❌ Failed to initialize tools module:', error.message);
    }
  }

  /**
   * Process message with tool calling (using Legion output-schema patterns)
   * @param {string} userInput - User's message
   * @returns {Promise<Object>} Response with tool execution
   */
  async processMessage(userInput) {
    this.turnCounter++;

    // Add user message to history
    this.conversationHistory.push({
      id: `turn_${this.turnCounter}_user`,
      type: 'user',
      content: userInput,
      tools: [],
      timestamp: new Date().toISOString()
    });

    // Get LLM client
    const llmClient = await this.resourceManager.get('llmClient');
    
    // Build conversation context
    const context = this.buildConversationContext();
    
    // Build tool calling prompt with project context
    const prompt = await this.buildToolCallingPrompt(userInput, context);
    
    // Process with basic tool calling (removed SD methodology routing)
    
    // Get LLM response for regular tool calling
    const llmResponse = await llmClient.complete(prompt);
    
    console.log('🤖 LLM Response:', llmResponse);
    
    // Try to parse as tool call first using Legion's output-schema
    const validationResult = this.responseValidator.process(llmResponse);
    
    let finalResponse;
    
    if (validationResult.success && (validationResult.data.use_tool || validationResult.data.use_tools)) {
      // Handle both single tool and multi-tool workflows
      const toolCalls = validationResult.data.use_tools || [validationResult.data.use_tool];
      const executedTools = [];
      let toolOutput = '';
      
      // Execute all tools in sequence
      for (const toolCall of toolCalls) {
        try {
          // Generate unique execution ID for tracking
          const executionId = `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          
          console.log('🔧 Executing tool:', toolCall.name, toolCall.args);
          
          // Direct tool execution through GeminiToolsModule
          const toolResult = await this.toolsModule.invoke(toolCall.name, toolCall.args);
          
          console.log('✅ Tool result:', toolResult);
          
          // Store executed tool result
          executedTools.push({
            name: toolCall.name,
            args: toolCall.args,
            result: toolResult,
            executionId
          });
          
          // Handle MCP tool discovery and registration (fix integration)
          if (toolCall.name === 'mcp_client_manager' && toolResult.success && toolResult.data?.discoveredTools) {
            const mcpTool = this.toolsModule.getTool('mcp_tool');
            if (mcpTool) {
              for (const externalTool of toolResult.data.discoveredTools) {
                mcpTool.registerExternalTool(externalTool);
                console.log(`🔗 Registered external tool: ${externalTool.name}`);
              }
            }
          }
          
          toolOutput += `\\n\\nTool ${toolCall.name} executed successfully: ${JSON.stringify(toolResult)}`;
          
        } catch (toolError) {
          console.error('❌ Tool execution failed:', toolError.message);
          
          executedTools.push({
            name: toolCall.name,
            args: toolCall.args,
            error: toolError.message,
            executionId
          });
          
          toolOutput += `\\n\\nTool ${toolCall.name} failed: ${toolError.message}`;
        }
      }
      
      // Create response with all tool executions
      finalResponse = {
        id: `turn_${this.turnCounter}_assistant`,
        type: 'assistant',
        content: `${validationResult.data.response}${toolOutput}`,
        tools: executedTools,
        timestamp: new Date().toISOString()
      };
    } else {
      // Regular conversation response
      finalResponse = {
        id: `turn_${this.turnCounter}_assistant`,
        type: 'assistant',
        content: llmResponse,
        tools: [],
        timestamp: new Date().toISOString()
      };
    }
    
    // Add response to history
    this.conversationHistory.push(finalResponse);
    
    // SINGLE place for compression check - after any response is added
    await this._checkAndCompress(llmClient);
    
    return finalResponse;
  }

  /**
   * Check if compression is needed (simplified for now)
   * @param {Object} llmClient - LLM client for compression
   */
  async _checkAndCompress(llmClient) {
    // Basic compression - keep only last 50 messages
    if (this.conversationHistory.length > 50) {
      this.conversationHistory = this.conversationHistory.slice(-50);
      console.log('✅ Conversation history trimmed to last 50 messages');
    }
  }

  /**
   * Build tool calling prompt using Gemini CLI patterns
   * @param {string} userInput - User's request
   * @param {string} context - Conversation context
   * @returns {string} Tool calling prompt
   */
  async buildToolCallingPrompt(userInput, context) {
    const workingDir = this.resourceManager.get('env.PWD') || this.resourceManager.get('workingDirectory') || process.cwd();
    
    // Build basic project context
    const projectContext = `Working Directory: ${workingDir}`;
    
    const systemPrompt = `You are an interactive web-based coding assistant specializing in software engineering tasks. Your primary goal is to help users safely and efficiently, adhering strictly to the following instructions and utilizing your available tools.

# Core Mandates

- **Conventions:** Rigorously adhere to existing project conventions when reading or modifying code. Analyze surrounding code, tests, and configuration first.
- **Libraries/Frameworks:** NEVER assume a library/framework is available or appropriate. Verify its established usage within the project first.
- **Style & Structure:** Mimic the style, structure, framework choices, typing, and architectural patterns of existing code.
- **Idiomatic Changes:** When editing, understand the local context to ensure changes integrate naturally.
- **Path Construction:** Always use absolute paths combining the project root directory with relative paths. Current working directory: ${workingDir}
- **Proactiveness:** Fulfill requests thoroughly, including reasonable, directly implied follow-up actions.

# Primary Workflows

## Software Engineering Tasks
When requested to perform tasks like fixing bugs, adding features, refactoring, or explaining code:
1. **Understand:** Use grep_search and glob_pattern to understand file structures and patterns. Use read_file to analyze context.
2. **Plan:** Build a coherent plan. Share concise plan with user if helpful.
3. **Implement:** Use edit_file, write_file, shell_command to execute the plan.
4. **Verify:** Use shell_command to run tests and build commands when appropriate.

# Available Tools (Complete Gemini CLI Toolset - 13 Tools)
## File Operations  
- read_file(absolute_path, offset?, limit?): Read file contents with optional line ranges
- write_file(absolute_path, content, encoding?): Write content to files with automatic directory creation  
- edit_file(absolute_path, old_string, new_string, replace_all?): Search and replace in files with backup creation
- smart_edit(absolute_path, old_string, new_string, create_backup?): Intelligent file editing with validation
- read_many_files(paths, include?, exclude?, recursive?): Read multiple files efficiently with glob patterns
- list_files(path, recursive?): List directory contents with metadata

## Search Tools
- grep_search(pattern, path?, include?): Search for patterns in file contents with regex support
- ripgrep_search(pattern, path?, file_type?, ignore_case?): Fast text search with file type filtering
- glob_pattern(pattern, path?, case_sensitive?): Fast file pattern matching with glob patterns

## Web Tools
- web_fetch(url, prompt?): Fetch and process web content with HTML conversion
- web_search(query): Perform web searches with grounding support

## System & Memory
- shell_command(command, working_directory?, timeout?): Execute shell commands with security controls
- save_memory(fact): Save facts to long-term memory for future sessions

## Integration & External Tools
- mcp_client(action='connect|disconnect|list|status', server_url?, server_name?): Connect to and manage MCP servers
- mcp_client_manager(action='discover_all|stop_all|get_discovered_tools|get_discovery_state'): Manage multiple MCP clients and discover external tools
- mcp_tool(external_tool_name, tool_params): Execute external tools discovered through MCP protocol

# Examples
<example>
user: list files here
response: {"response": "I'll list the files in the current directory", "use_tool": {"name": "list_files", "args": {"path": "${workingDir}"}}}
</example>

<example>
user: Read the package.json file
response: {"response": "I'll read the package.json file for you", "use_tool": {"name": "read_file", "args": {"absolute_path": "${workingDir}/package.json"}}}
</example>

<example>
user: Create a hello.js file with console.log
response: {"response": "I'll create the hello.js file with a console.log statement", "use_tool": {"name": "write_file", "args": {"absolute_path": "${workingDir}/hello.js", "content": "console.log('Hello World!');\n"}}}
</example>

${context}

User: ${userInput}

Respond with JSON if tool usage is needed:

For single tool:
{
  "response": "Your helpful response to the user",
  "use_tool": {
    "name": "tool_name",
    "args": {"param": "value"}
  }
}

For multiple tools (use this for multi-step requests):
{
  "response": "I'll perform these operations in sequence",
  "use_tools": [
    {"name": "tool1", "args": {"param": "value1"}},
    {"name": "tool2", "args": {"param": "value2"}}
  ]
}

Or respond with plain text if no tools needed. Always use absolute paths starting with ${workingDir}/

${projectContext}`;

    return systemPrompt;
  }

  /**
   * Build conversation context
   * @returns {string} Formatted context
   */
  buildConversationContext() {
    if (this.conversationHistory.length === 0) {
      return '';
    }

    const recentTurns = this.conversationHistory.slice(-6); // Last 6 turns
    let context = '\\n# Recent Conversation:\\n';
    
    for (const turn of recentTurns) {
      context += `${turn.type.toUpperCase()}: ${turn.content}\\n`;
    }
    
    return context;
  }

  /**
   * Get conversation history
   * @returns {Array} Conversation history
   */
  getConversationHistory() {
    return [...this.conversationHistory];
  }

  /**
   * Clear conversation history
   */
  clearHistory() {
    this.conversationHistory = [];
    this.turnCounter = 0;
  }

  /**
   * Get conversation state (compatibility method)
   */
  getState() {
    return {
      messages: this.conversationHistory,
      turnCounter: this.turnCounter,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Add message to history (compatibility method)
   */
  addMessage(message) {
    if (!message || typeof message !== 'object') {
      throw new Error('Message must be an object');
    }
    if (!message.role || !message.content) {
      throw new Error('Message must have role and content properties');
    }
    
    this.conversationHistory.push({
      ...message,
      timestamp: message.timestamp || new Date().toISOString()
    });
  }

  /**
   * Update working directory (compatibility method)
   */
  updateWorkingDirectory(directory) {
    this.workingDirectory = directory;
  }

  /**
   * Parse tool calls from response (compatibility method)
   */
  parseToolCalls(response) {
    const toolCalls = [];
    
    // Find JSON blocks that contain tool calls
    const jsonBlocks = [];
    let braceCount = 0;
    let start = -1;
    
    for (let i = 0; i < response.length; i++) {
      if (response[i] === '{') {
        if (braceCount === 0) start = i;
        braceCount++;
      } else if (response[i] === '}') {
        braceCount--;
        if (braceCount === 0 && start >= 0) {
          const block = response.substring(start, i + 1);
          jsonBlocks.push(block);
        }
      }
    }
    
    for (const block of jsonBlocks) {
      try {
        const parsed = JSON.parse(block);
        if (parsed.use_tool && parsed.use_tool.name && parsed.use_tool.args) {
          toolCalls.push({
            name: parsed.use_tool.name,
            args: parsed.use_tool.args
          });
        }
      } catch (error) {
        // Skip invalid JSON
      }
    }
    
    return toolCalls;
  }

}

export default ToolCallingConversationManager;