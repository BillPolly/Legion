/**
 * ToolCallingConversationManager - Uses Legion's output-schema for tool calling
 * Integrates with GeminiToolsModule using proper Legion patterns
 */

import { ResponseValidator } from '@legion/output-schema';
import GeminiToolsModule from '../../../../modules/gemini-tools/src/GeminiToolsModule.js';
import ProjectContextService from '../services/ProjectContextService.js';
import ConversationCompressionService from '../services/ConversationCompressionService.js';
import GeminiPromptManager from '../prompts/GeminiPromptManager.js';

/**
 * Conversation manager with proper tool calling using Legion patterns
 */
export class ToolCallingConversationManager {
  constructor(resourceManager) {
    this.resourceManager = resourceManager;
    this.conversationHistory = [];
    this.turnCounter = 0;
    
    // Initialize tools module, context service, and compression service
    this._initializeToolsModule();
    this.projectContextService = new ProjectContextService(resourceManager, null);
    this.compressionService = new ConversationCompressionService(resourceManager);
    this.promptManager = new GeminiPromptManager(resourceManager);
    
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

    // Get LLM client
    const llmClient = await this.resourceManager.get('llmClient');
    
    // Build conversation context
    const context = this.buildConversationContext();
    
    // Build tool calling prompt with project context
    const prompt = await this.buildToolCallingPrompt(userInput, context);
    
    // Get LLM response
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
          console.log('🔧 Executing tool:', toolCall.name, toolCall.args);
          
          // Use Legion pattern: module.invoke() -> tool.execute(args)
          const toolResult = await this.toolsModule.invoke(toolCall.name, toolCall.args);
          
          console.log('✅ Tool result:', toolResult);
          
          executedTools.push({
            name: toolCall.name,
            args: toolCall.args,
            result: toolResult
          });
          
          // Track file access for context building (Gemini CLI pattern)
          if (toolCall.args.absolute_path) {
            this.projectContextService.trackFileAccess(toolCall.args.absolute_path, toolCall.name.split('_')[0]);
          }
          
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
            error: toolError.message
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
   * Check if compression is needed and compress if so (ported from Gemini CLI)
   * @param {Object} llmClient - LLM client for compression
   */
  async _checkAndCompress(llmClient) {
    if (this.compressionService.needsCompression(this.conversationHistory)) {
      try {
        console.log('🗜️ Compressing conversation (token limit approaching)...');
        
        const compressionPrompt = this.promptManager.getCompressionPrompt();
        const compressionResult = await this.compressionService.compressConversation(
          this.conversationHistory,
          llmClient,
          compressionPrompt
        );
        
        if (compressionResult.compressionStatus === 'compressed') {
          this.conversationHistory = compressionResult.compressedHistory;
          console.log(`✅ Conversation compressed: ${compressionResult.originalTokenCount} → ${compressionResult.newTokenCount} tokens`);
        }
      } catch (compressionError) {
        console.warn('⚠️ Compression failed:', compressionError.message);
      }
    }
  }

  /**
   * Build tool calling prompt using Gemini CLI patterns
   * @param {string} userInput - User's request
   * @param {string} context - Conversation context
   * @returns {string} Tool calling prompt
   */
  async buildToolCallingPrompt(userInput, context) {
    const workingDir = process.cwd();
    
    // Build rich context using project awareness (ported from Gemini CLI)
    const projectContext = await this.projectContextService.buildCompleteContext(workingDir);
    
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
}

export default ToolCallingConversationManager;