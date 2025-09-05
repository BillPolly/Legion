/**
 * ToolUsingChatAgent - Context-aware intelligent chat agent
 * 
 * Core agent that analyzes user requests, searches for tools, executes them
 * with proper context management, and provides meaningful responses.
 * 
 * Reuses BT Executor's proven context management and tool execution patterns.
 */

import { extractJSON } from '@legion/planner';
import { ContextOptimizer } from './ContextOptimizer.js';

export class ToolUsingChatAgent {
  constructor(toolRegistry, llmClient, eventCallback = null, resourceActor = null) {
    this.toolRegistry = toolRegistry;
    this.llmClient = llmClient;
    this.eventCallback = eventCallback; // For UI observability
    this.resourceActor = resourceActor; // For AgentTools like display_resource
    
    // Initialize intelligent context optimization
    this.contextOptimizer = new ContextOptimizer(llmClient);
    
    // Reuse BT Executor's proven context pattern
    this.executionContext = { 
      artifacts: {
        output_directory: {
          value: './tmp',
          description: 'Default directory for saving generated files and outputs. When using tools with path parameters, use this directory path with specific filenames (e.g., "./tmp/image.png", "./tmp/document.txt").'
        }
      }
    };
    this.chatHistory = [];
    
    // Agent-specific state
    this.currentOperation = null;
    this.operationHistory = [];
    this.llmInteractions = []; // Track all LLM calls for observability
    this.currentSearchResults = []; // Store search results during request processing
  }


  /**
   * Main pipeline entry point - process user message through complete workflow
   * @param {string} userInput - User's message
   * @returns {Object} Agent response with tool usage and context updates
   */
  async processMessage(userInput) {
    console.log(`[ToolAgent] Processing message: "${userInput}"`);
    
    // Add to chat history
    this.chatHistory.push({
      role: 'user',
      content: userInput,
      timestamp: Date.now()
    });

    try {
      // Stage 1: Analyze if tools are needed
      const toolNeedAnalysis = await this.analyzeToolNeed(userInput);
      console.log(`[ToolAgent] Tool need analysis:`, toolNeedAnalysis);

      if (!toolNeedAnalysis.needsTools) {
        // Can answer with existing context
        const response = await this.respondWithContext(userInput);
        this.addAgentMessage(response);
        
        // Automatic intelligent context optimization after completion
        await this.optimizeContextIntelligently();
        
        return {
          userResponse: response,
          toolsUsed: [],
          contextUpdated: [],
          reasoning: toolNeedAnalysis.reasoning,
          operationCount: 0,
          complete: true
        };
      }

      // Stage 2: Search for relevant tools using semantic search
      this.currentSearchResults = await this.searchForTools(userInput);
      console.log(`[ToolAgent] Found ${this.currentSearchResults.length} tools in search`);

      if (this.currentSearchResults.length === 0) {
        const explanation = await this.explainNoToolsFound(userInput);
        this.addAgentMessage(explanation.userResponse);
        
        // Automatic intelligent context optimization after completion
        await this.optimizeContextIntelligently();
        
        return { ...explanation, complete: true };
      }

      // Stage 3: Select tool sequence (single or multiple tools)
      const toolPlan = await this.selectToolSequence(this.currentSearchResults, userInput);
      console.log(`[ToolAgent] Tool plan:`, toolPlan);

      if (toolPlan.type === 'none') {
        const explanation = await this.explainNoSuitableTools(userInput, searchResults);
        this.addAgentMessage(explanation.userResponse);
        
        // Automatic intelligent context optimization after completion
        await this.optimizeContextIntelligently();
        
        return { ...explanation, complete: true };
      }

      // Stage 4: Execute tool plan (single tool or sequence)
      const executionResults = await this.executeToolPlan(toolPlan);
      console.log(`[ToolAgent] Plan execution complete:`, executionResults.success);

      // Stage 5: Generate response to user
      const userResponse = await this.generateUserResponse(userInput, executionResults, toolPlan);

      this.addAgentMessage(userResponse);

      // Automatic intelligent context optimization after successful completion
      await this.optimizeContextIntelligently();

      return {
        userResponse: userResponse,
        toolsUsed: executionResults.toolsExecuted || [],
        contextUpdated: executionResults.variablesStored || [],
        reasoning: toolPlan.description || toolPlan.reasoning,
        operationCount: executionResults.toolsExecuted?.length || 0,
        complete: true
      };

    } catch (error) {
      console.error('[ToolAgent] Error processing message:', error);
      const errorResponse = `Sorry, I encountered an error while processing your request: ${error.message}`;
      this.addAgentMessage(errorResponse);
      
      // Optimize context even after errors to clean up any partial state
      await this.optimizeContextIntelligently();
      
      return {
        userResponse: errorResponse,
        toolsUsed: [],
        contextUpdated: [],
        reasoning: `Error: ${error.message}`,
        operationCount: 0,
        error: error.message
      };
    }
  }

  /**
   * Stage 1: Analyze if tools are needed for this request
   * Considers existing context to avoid unnecessary tool usage
   */
  async analyzeToolNeed(userInput) {
    const prompt = `
User request: "${userInput}"

Chat history:
${this.formatChatHistory()}

Available context variables:
${this.formatContextVariables()}

Question: Should I use tools to fulfill this request?

**IMPORTANT**: Be helpful by DOING things, not just explaining them.

Consider:
- Does the user want information I already have stored? → needsTools: false
- Are they asking me to CREATE, WRITE, BUILD, RUN, or EXECUTE something? → needsTools: true (be helpful!)
- Are they asking me to ANALYZE, CALCULATE, or PROCESS data? → needsTools: true (use appropriate tools!)
- Can I combine existing context data to answer their question? → needsTools: false

**Be Action-Oriented**: When users ask you to DO something (create files, run programs, analyze data), use tools to actually DO it rather than just giving instructions.

**JSON only**: Return ONLY valid JSON. No markdown, no code blocks, no comments, no explanations, no trailing commas.

Return this exact format:
{"needsTools": true/false, "reasoning": "..."}
    `;

    const response = await this.trackLLMInteraction(prompt, 'tool-need-analysis');

    try {
      return extractJSON(response);
    } catch (error) {
      console.error('[ToolAgent] Error parsing tool need analysis:', error);
      console.error('[ToolAgent] Raw response:', response);
      return { needsTools: true, reasoning: "Failed to parse analysis, defaulting to tool usage" };
    }
  }

  /**
   * Stage 2: Search for relevant tools using semantic search
   * Enhanced with context awareness
   */
  async searchForTools(userInput) {
    // Create context-aware search query
    const contextVars = Object.keys(this.executionContext.artifacts);
    const contextInfo = contextVars.length > 0 
      ? ` (available data: ${contextVars.join(', ')})`
      : '';
    
    const enhancedQuery = userInput + contextInfo;
    console.log(`[ToolAgent] Enhanced search query: "${enhancedQuery}"`);

    try {
      // Use existing semantic search infrastructure
      const searchResults = await this.toolRegistry.searchTools(enhancedQuery, {
        limit: 10,
        threshold: 0.3
      });

      return searchResults || [];
    } catch (error) {
      console.error('[ToolAgent] Error in semantic search:', error);
      return [];
    }
  }

  /**
   * Stage 3: Select tool sequence (single tool or multiple chained tools)
   * Uses formal planner's approach for behavior tree generation
   */
  async selectToolSequence(searchResults, userInput) {
    const prompt = `# Tool Sequence Planning Task

You are an expert tool orchestrator. Analyze the user request and create an executable tool sequence using ONLY the provided tools.

## User Request
${userInput}

## Available Tools (ONLY tools you may use)
${searchResults.map(result => `
### ${result.name}
Description: ${result.tool.description || result.description || 'No description'}
Inputs:
${this.formatToolInputSchema(result.tool.inputSchema)}
Outputs: ${this.formatToolOutputSchema(result.tool.outputSchema)}
`).join('\n')}

## Available Context Variables
${this.formatContextVariables()}

## Task
Create a tool execution sequence that fulfills the user's request. You can:

1. **Single Tool**: If one tool can handle the request completely
2. **Tool Sequence**: If multiple tools need to be chained together

## Variable Rules  
- Store outputs with unique variable names: \`"outputs": {"toolField": "unique_var_name"}\`
- Reference stored variables: \`"@varName"\`
- **IMPORTANT**: Use actual values (like file paths, content) in inputs when you have them, not variable names
- Use @varName syntax only when you need data from a previous tool's output
- Only store outputs that will be used later
- Use exact parameter names from tool specifications

## File Storage Guidelines
- **ALWAYS use the output_directory context variable for file storage when tools have path/directory parameters**
- For tools with path parameters, use the output_directory value (e.g., "path": "@output_directory")
- This ensures all generated files are organized in the designated output location

## Response Format

**Single Tool Response:**
{
  "type": "single",
  "tool": "tool_name",  
  "description": "What this accomplishes",
  "inputs": {
    "paramName": "use_literal_values_when_you_know_them_or_@varName_when_referencing_previous_outputs"
  },
  "outputs": {
    "toolOutputField": "unique_variable_name"
  }
}

**Sequence Response:**
{
  "type": "sequence", 
  "description": "What this sequence accomplishes",
  "steps": [
    {
      "tool": "first_tool",
      "description": "First step",
      "inputs": {"param": "value"},
      "outputs": {"field": "var_name"}
    },
    {
      "tool": "second_tool", 
      "description": "Second step",
      "inputs": {"param": "@var_name"},
      "outputs": {"result": "final_var"}
    }
  ]
}

**No Tools Response:**
{
  "type": "none",
  "reasoning": "Why no tools are needed or suitable"
}

**JSON only**: Return ONLY valid JSON. No markdown, no code blocks, no comments, no explanations, no trailing commas.

Generate the JSON now:`;

    const response = await this.trackLLMInteraction(prompt, 'tool-sequence-planning');

    try {
      return extractJSON(response);
    } catch (error) {
      console.error('[ToolAgent] Error parsing tool selection:', error);
      console.error('[ToolAgent] Raw response:', response);
      return {
        type: 'none',
        reasoning: "Failed to parse tool selection response"
      };
    }
  }

  /**
   * Execute a tool plan (single tool or sequence)
   */
  async executeToolPlan(toolPlan) {
    const results = {
      success: true,
      toolsExecuted: [],
      variablesStored: [],
      results: [],
      errors: []
    };

    try {
      if (toolPlan.type === 'single') {
        // Execute single tool
        const toolSelection = {
          selectedTool: toolPlan.tool,
          parameters: toolPlan.inputs,
          outputs: toolPlan.outputs, // Pass the full outputs mapping
          outputVariable: Object.values(toolPlan.outputs || {})[0] // Get first output variable for fallback
        };
        
        const result = await this.executeTool(toolSelection);
        
        results.toolsExecuted.push(toolPlan.tool);
        if (result.success && toolSelection.outputVariable) {
          results.variablesStored.push(toolSelection.outputVariable);
        }
        results.results.push(result);
        results.success = result.success;
        
      } else if (toolPlan.type === 'sequence') {
        // Execute sequence of tools
        for (const step of toolPlan.steps) {
          console.log(`[ToolAgent] Executing sequence step: ${step.tool}`);
          
          const toolSelection = {
            selectedTool: step.tool,
            parameters: step.inputs,
            outputs: step.outputs, // Pass the full outputs mapping
            outputVariable: Object.values(step.outputs || {})[0] // Get first output variable for fallback
          };
          
          const result = await this.executeTool(toolSelection);
          
          results.toolsExecuted.push(step.tool);
          results.results.push(result);
          
          if (result.success && toolSelection.outputVariable) {
            results.variablesStored.push(toolSelection.outputVariable);
          } else if (!result.success) {
            // Tool in sequence failed
            results.success = false;
            results.errors.push(`${step.tool}: ${result.error}`);
            break; // Stop sequence on failure
          }
        }
      }
      
      return results;
    } catch (error) {
      console.error('[ToolAgent] Error executing tool plan:', error);
      return {
        success: false,
        toolsExecuted: results.toolsExecuted,
        variablesStored: results.variablesStored,
        results: results.results,
        errors: [...results.errors, error.message]
      };
    }
  }

  /**
   * Generate user response based on execution results
   */
  async generateUserResponse(userInput, executionResults, toolPlan) {
    const prompt = `
User request: "${userInput}"

Tool plan executed: ${toolPlan.description}
Tools used: ${executionResults.toolsExecuted.join(', ')}
Variables stored: ${executionResults.variablesStored.join(', ')}

Execution results:
${executionResults.results.map((result, i) => `
${i + 1}. ${executionResults.toolsExecuted[i]}: ${result.success ? 'Success' : 'Failed'}
   ${result.success ? this.summarizeToolResult(result.data) : `Error: ${result.error}`}
`).join('')}

Current context:
${this.formatContextVariables()}

**JSON only**: Return ONLY valid JSON. No markdown, no code blocks, no comments, no explanations, no trailing commas.

Respond with this exact format:
{
  "response": "Clear message to user about what was accomplished and results"
}
    `;

    const jsonResponse = await this.trackLLMInteraction(prompt, 'user-response-generation');
    
    try {
      const parsed = extractJSON(jsonResponse);
      return parsed.response || jsonResponse;
    } catch (error) {
      console.log('[ToolAgent] Failed to parse user response JSON, using raw:', jsonResponse);
      return jsonResponse;
    }
  }

  /**
   * Stage 4: Execute selected tool with context-aware parameter resolution
   * Includes error handling and retry logic
   */
  async executeTool(toolSelection, retryAttempt = 0) {
    const { selectedTool, parameters, outputVariable } = toolSelection;
    
    console.log(`[ToolAgent] Executing tool: ${selectedTool} (attempt ${retryAttempt + 1})`);
    console.log(`[ToolAgent] Parameters:`, parameters);

    // 1. Get tool from search results (results are records with .tool property)
    const searchResult = this.currentSearchResults.find(r => r.name === selectedTool);
    if (!searchResult || !searchResult.tool) {
      throw new Error(`Tool ${selectedTool} not found in search results`);
    }
    
    const tool = searchResult.tool; // Access the actual tool object
    if (typeof tool.execute !== 'function') {
      throw new Error(`Tool ${selectedTool} has no execute method`);
    }

    // 2. Resolve parameters with context substitution (BT's resolveParams)
    const resolvedInputs = this.resolveParams(parameters);
    console.log(`[ToolAgent] Resolved parameters:`, resolvedInputs);

    // 3. Validate parameter resolution
    this.validateParameterResolution(resolvedInputs, parameters);

    try {
      // 4. Execute tool
      let result;
      
      // Check if this is an AgentTool (UI category) that needs context as first parameter
      if (tool.category === 'ui' && this.resourceActor) {
        console.log(`[ToolAgent] Executing AgentTool with context: ${selectedTool}`);
        
        // Create context for AgentTools (same pattern as /show command)
        const agentContext = {
          resourceActor: this.resourceActor,
          toolRegistry: this.toolRegistry,
          llmClient: this.llmClient,
          artifacts: this.executionContext.artifacts
        };
        
        // AgentTools expect context as first parameter, then other resolved inputs
        result = await tool.execute({ context: agentContext, ...resolvedInputs });
      } else {
        // Regular tools get just the resolved inputs
        result = await tool.execute(resolvedInputs);
      }
      
      console.log(`[ToolAgent] Tool execution result:`, { success: result.success, hasData: !!result.data });

      // 5. Store result in context with proper field extraction (BT Executor's pattern)
      if (result.success && result.data !== undefined && toolSelection.outputs) {
        // Map specific tool output fields to variable names (like BT Executor)
        for (const [outputField, variableName] of Object.entries(toolSelection.outputs)) {
          if (result.data && result.data.hasOwnProperty(outputField)) {
            this.executionContext.artifacts[variableName] = result.data[outputField];
            console.log(`[ToolAgent] Mapped ${outputField} → ${variableName}:`, result.data[outputField]);
          }
        }
      } else if (outputVariable && result.success && result.data !== undefined) {
        // Fallback: store entire result if no specific output mapping
        this.executionContext.artifacts[outputVariable] = result.data;
        console.log(`[ToolAgent] Stored entire result in context as: ${outputVariable}`);
      }

      // 6. Record execution in operation history
      this.operationHistory.push({
        tool: selectedTool,
        inputs: resolvedInputs,
        outputs: result.data,
        outputVariable,
        timestamp: Date.now(),
        success: result.success,
        error: result.error
      });

      return {
        ...result,
        tool: selectedTool,
        outputVariable
      };

    } catch (error) {
      console.log(`[ToolAgent] Tool execution error:`, error.message);
      
      // Store error in context for analysis
      this.executionContext.artifacts[`${selectedTool}_error`] = error.message;
      
      // Record failed execution
      this.operationHistory.push({
        tool: selectedTool,
        inputs: resolvedInputs,
        outputs: null,
        outputVariable,
        timestamp: Date.now(),
        success: false,
        error: error.message
      });

      // If first attempt, try to analyze error and retry
      if (retryAttempt === 0) {
        console.log(`[ToolAgent] Analyzing error for retry...`);
        const retryDecision = await this.analyzeErrorAndRetry(selectedTool, error.message, parameters);
        
        if (retryDecision.shouldRetry) {
          console.log(`[ToolAgent] Retrying with: ${retryDecision.newApproach}`);
          return await this.executeRetryStrategy(retryDecision, retryAttempt + 1, toolSelection);
        }
      }

      // No retry or retry failed - return error
      return {
        success: false,
        error: error.message,
        tool: selectedTool,
        outputVariable
      };
    }
  }

  /**
   * Analyze tool execution error and decide on retry strategy
   */
  async analyzeErrorAndRetry(toolName, errorMessage, originalParams) {
    const prompt = `
Tool execution failed:
- Tool: ${toolName}
- Error: ${errorMessage}
- Parameters used: ${JSON.stringify(originalParams)}

Available context: ${this.formatContextVariables()}
Available tools: ${Array.from(this.resolvedTools.keys()).join(', ')}

Analyze the error and decide what to do:

1. Can I fix this by adjusting parameters?
2. Should I try a different tool?
3. Is this a user error that should be explained?

**JSON only**: Return ONLY valid JSON. No markdown, no code blocks, no comments, no explanations, no trailing commas.

Return this exact format:
{
  "shouldRetry": true/false,
  "newApproach": "description of what to try",
  "newTool": "different_tool_name" or null,
  "newParameters": {...} or null,
  "userExplanation": "explanation if no retry possible"
}
    `;

    try {
      const response = await this.trackLLMInteraction(prompt, 'completion-decision');
      return extractJSON(response);
    } catch (error) {
      console.log('[ToolAgent] Error analyzing retry strategy:', error);
      return {
        shouldRetry: false,
        userExplanation: `Tool ${toolName} failed: ${errorMessage}`
      };
    }
  }

  /**
   * Execute retry strategy based on error analysis
   */
  async executeRetryStrategy(retryDecision, retryAttempt, originalToolSelection) {
    if (retryDecision.newTool) {
      // Try different tool
      const newSelection = {
        selectedTool: retryDecision.newTool,
        parameters: retryDecision.newParameters || {},
        outputVariable: `retry_${retryAttempt}_result`
      };
      return await this.executeTool(newSelection, retryAttempt);
    } else if (retryDecision.newParameters) {
      // Retry same tool with different parameters
      const retrySelection = {
        selectedTool: originalToolSelection.selectedTool,
        parameters: retryDecision.newParameters,
        outputVariable: originalToolSelection.outputVariable
      };
      return await this.executeTool(retrySelection, retryAttempt);
    } else {
      // No retry strategy - explain to user
      return {
        success: false,
        error: retryDecision.userExplanation,
        tool: 'analysis',
        outputVariable: null
      };
    }
  }

  /**
   * Stage 5: Decide whether to continue with more tools or complete
   */
  async decideContinueOrComplete(originalRequest, toolResult, toolSelection) {
    const prompt = `
Original user request: "${originalRequest}"

Latest tool execution:
- Tool: ${toolResult.tool}
- Success: ${toolResult.success}
- Result: ${JSON.stringify(toolResult.data)}
- Stored as: ${toolSelection.outputVariable}
${toolResult.error ? `- Error: ${toolResult.error}` : ''}

Complete updated context:
${JSON.stringify(this.executionContext.artifacts, null, 2)}

Chat history:
${this.formatChatHistory()}

Questions:
1. Is the user's original request now fully satisfied with the available context?
2. If not, what specific additional information or actions do we need?
3. What should I tell the user about what was accomplished?

**JSON only**: Return ONLY valid JSON. No markdown, no code blocks, no comments, no explanations, no trailing commas.

Return this exact format:
{
  "complete": true/false,
  "userResponse": "what to tell the user about results", 
  "nextAction": "description of what we still need to do" or null
}
    `;

    const response = await this.trackLLMInteraction(prompt, 'completion-decision');

    try {
      return extractJSON(response);
    } catch (error) {
      console.error('[ToolAgent] Error parsing completion decision:', error);
      console.error('[ToolAgent] Raw response:', response);
      return {
        complete: true,
        userResponse: toolResult.success 
          ? `I executed ${toolResult.tool} successfully. The result is stored as ${toolSelection.outputVariable}.`
          : `I tried to execute ${toolResult.tool} but it failed: ${toolResult.error}`,
        nextAction: null
      };
    }
  }

  /**
   * Respond using only existing context (no tools needed)
   */
  async respondWithContext(userInput) {
    const prompt = `
User request: "${userInput}"

Available context:
${this.formatContextVariables()}

Chat history:
${this.formatChatHistory()}

The user's request can be answered using existing context. Provide a helpful response using the available data.
    `;

    return await this.trackLLMInteraction(prompt, 'user-response-generation');
  }

  /**
   * Explain when no tools are found in search
   */
  async explainNoToolsFound(userInput) {
    return {
      success: false,
      userResponse: `I searched for tools to help with "${userInput}" but didn't find any relevant tools in the registry. You might need to load additional tool modules or rephrase your request.`,
      reasoning: "Semantic search returned no results",
      toolsUsed: [],
      contextUpdated: []
    };
  }

  /**
   * Explain when tools exist but none are suitable
   */
  async explainNoSuitableTools(userRequest, searchResults) {
    const prompt = `
User request: "${userRequest}"

I found these tools but none are suitable:
${searchResults.map(tool => 
  `- ${tool.name} (${((tool.confidence || 0) * 100).toFixed(1)}% match): ${tool.description}`
).join('\n')}

Available context: ${JSON.stringify(this.executionContext.artifacts)}

Explain to the user:
1. Why none of these tools can help with their request
2. What specific capabilities are missing  
3. How they could rephrase their request
4. Whether there's anything in the current context that could help

Be helpful and specific.
    `;

    const explanation = await this.trackLLMInteraction(prompt, 'no-suitable-tools');

    return {
      success: false,
      userResponse: explanation,
      reasoning: "No suitable tools found after evaluation",
      toolsUsed: [],
      contextUpdated: []
    };
  }

  /**
   * Parameter resolution with @varName substitution (from BT Executor)
   */
  resolveParams(params) {
    const resolved = {};
    
    for (const [key, value] of Object.entries(params)) {
      if (typeof value === 'string' && value.startsWith('@')) {
        // @varName syntax - resolve to artifacts
        const varName = value.substring(1);
        resolved[key] = this.executionContext.artifacts[varName];
        console.log(`[ToolAgent] Resolved @${varName} → ${this.getVariablePreview(resolved[key])}`);
      } else {
        resolved[key] = value; // Constant value
      }
    }
    
    return resolved;
  }

  /**
   * Validate that parameter resolution worked correctly
   */
  validateParameterResolution(resolvedParams, originalParams) {
    const missing = [];
    const invalid = [];
    
    for (const [param, value] of Object.entries(resolvedParams)) {
      if (value === undefined) {
        const originalValue = originalParams[param];
        if (typeof originalValue === 'string' && originalValue.startsWith('@')) {
          const varName = originalValue.substring(1);
          invalid.push(`${param}: @${varName} (variable not found in context)`);
        } else {
          missing.push(`${param}: undefined`);
        }
      }
    }
    
    if (missing.length > 0 || invalid.length > 0) {
      const errorDetails = [];
      if (missing.length > 0) errorDetails.push(`missing=[${missing.join(', ')}]`);
      if (invalid.length > 0) errorDetails.push(`invalid=[${invalid.join(', ')}]`);
      
      throw new Error(`Parameter resolution failed: ${errorDetails.join(', ')}`);
    }
  }

  /**
   * Format chat history for LLM prompts
   */
  formatChatHistory() {
    if (this.chatHistory.length === 0) {
      return 'No previous chat history.';
    }

    return this.chatHistory.slice(-5).map(msg => 
      `${msg.role === 'user' ? 'User' : 'Agent'}: ${msg.content}`
    ).join('\n');
  }

  /**
   * Format context variables for LLM prompts
   * Shows actual data for small objects, not just previews
   */
  formatContextVariables() {
    const artifacts = this.executionContext.artifacts;
    const keys = Object.keys(artifacts);
    
    if (keys.length === 0) {
      return 'No context variables stored.';
    }

    return keys.map(key => {
      const value = artifacts[key];
      
      // Handle new format with value/description structure
      if (value && typeof value === 'object' && value.hasOwnProperty('value') && value.hasOwnProperty('description')) {
        return `- ${key}: "${value.value}" (${value.description})`;
      }
      
      // Handle legacy simple value format
      const preview = this.getDetailedVariablePreview(value);
      return `- ${key}: ${preview}`;
    }).join('\n');
  }

  /**
   * Check if a string appears to be base64 encoded data
   */
  isBase64String(str) {
    if (typeof str !== 'string' || str.length < 100) return false;
    
    // Handle data URLs (data:image/png;base64,...)
    if (str.startsWith('data:')) {
      const base64Part = str.split(',')[1];
      if (base64Part) {
        str = base64Part;
      }
    }
    
    // Base64 pattern: letters, numbers, +, /, = (padding)
    const base64Pattern = /^[A-Za-z0-9+/]*={0,2}$/;
    if (!base64Pattern.test(str)) return false;
    
    // Additional heuristics for base64 data
    const hasBase64Chars = /[+/]/.test(str) || str.length > 1000; // Very long strings likely base64
    const properPadding = str.match(/=*$/)?.[0].length <= 2;
    const lengthMultipleOf4 = str.length % 4 === 0;
    
    return hasBase64Chars && properPadding && lengthMultipleOf4;
  }

  /**
   * Get smart summary of data type and size without exposing large content
   */
  getDataTypeSummary(value) {
    if (value === null) return 'null';
    if (value === undefined) return 'undefined';
    
    const type = typeof value;
    
    if (type === 'string') {
      // Handle data URLs specifically
      if (value.startsWith('data:')) {
        const [mimeInfo] = value.split(',');
        const sizeKB = Math.round(value.length / 1024);
        return `[DATA_URL: ${mimeInfo.split(';')[0].split(':')[1] || 'unknown'}, ~${sizeKB}KB]`;
      }
      
      if (this.isBase64String(value)) {
        const sizeKB = Math.round(value.length * 0.75 / 1024); // Approximate decoded size
        return `[BASE64_DATA: ~${sizeKB}KB]`;
      }
      
      if (value.length > 1000) {
        return `[LARGE_TEXT: ${value.length} chars]`;
      }
      
      if (value.length > 100) {
        return `"${value.substring(0, 47)}...${value.substring(value.length - 20)}"`;
      }
      
      return `"${value}"`;
    }
    
    if (type === 'object') {
      if (Array.isArray(value)) {
        return `Array(${value.length} items)`;
      }
      
      const keys = Object.keys(value);
      if (keys.length === 0) return '{}';
      
      // Check if object contains large string values
      const hasLargeStrings = keys.some(key => 
        typeof value[key] === 'string' && value[key].length > 1000
      );
      
      if (hasLargeStrings) {
        return `Object(${keys.length} keys, contains large data)`;
      }
      
      // For small objects, try to show actual content
      try {
        const jsonStr = JSON.stringify(value);
        return jsonStr.length < 200 ? jsonStr : `Object(${keys.length} keys)`;
      } catch (error) {
        return `Object(${keys.length} keys)`;
      }
    }
    
    return String(value);
  }

  /**
   * Get detailed variable preview that shows actual data for LLM context
   * Now with intelligent handling of large strings and base64 data
   */
  getDetailedVariablePreview(value) {
    return this.getDataTypeSummary(value);
  }

  /**
   * Summarize tool result data for LLM prompts without including large content
   */
  summarizeToolResult(data) {
    if (!data || typeof data !== 'object') {
      return this.getDataTypeSummary(data);
    }

    // For objects, create a summary showing structure without large content
    const summary = {};
    for (const [key, value] of Object.entries(data)) {
      if (typeof value === 'string' && value.length > 100) {
        // Use the same smart summarization as context variables
        summary[key] = this.getDataTypeSummary(value);
      } else if (typeof value === 'object' && value !== null) {
        summary[key] = `[OBJECT: ${Object.keys(value).length} keys]`;
      } else {
        summary[key] = value;
      }
    }

    try {
      const jsonStr = JSON.stringify(summary);
      return jsonStr.length < 300 ? jsonStr : `Object(${Object.keys(data).length} keys with summarized large content)`;
    } catch (error) {
      return `Object(${Object.keys(data).length} keys)`;
    }
  }

  /**
   * Format tool input schema for LLM prompt (matches planner format)
   */
  formatToolInputSchema(inputSchema) {
    if (!inputSchema || typeof inputSchema !== 'object') {
      return '  No parameters';
    }

    const properties = inputSchema.properties || inputSchema;
    if (!properties || Object.keys(properties).length === 0) {
      return '  No parameters';
    }

    return Object.entries(properties).map(([param, schema]) => {
      const type = schema.type || (typeof schema === 'string' ? schema : 'string');
      const isRequired = inputSchema.required?.includes(param);
      const requiredLabel = isRequired ? '(required)' : '(optional)';
      return `  - ${param} ${requiredLabel} (${type}): ${schema.description || this.getParameterDescription(param)}`;
    }).join('\n');
  }

  /**
   * Format tool output schema for LLM prompt
   */
  formatToolOutputSchema(outputSchema) {
    if (!outputSchema || typeof outputSchema !== 'object') {
      return 'No return data';
    }

    const properties = outputSchema.properties || outputSchema;
    if (!properties || Object.keys(properties).length === 0) {
      return 'No return data';
    }

    return Object.entries(properties).map(([field, schema]) => {
      const type = schema.type || typeof schema === 'string' ? schema : 'string';
      return `${field} (${type})`;
    }).join(', ');
  }

  /**
   * Get parameter description based on common parameter names
   */
  getParameterDescription(paramName) {
    const descriptions = {
      'filePath': 'Path to the file',
      'filepath': 'Path to the file', 
      'content': 'Text content to process',
      'text': 'Text content to process',
      'url': 'URL to fetch data from',
      'expression': 'Mathematical expression to evaluate',
      'data': 'Data object to analyze',
      'query': 'Search query string'
    };
    return descriptions[paramName] || `${paramName} parameter`;
  }

  /**
   * Track LLM interaction for observability (like planner does)
   */
  async trackLLMInteraction(prompt, purpose) {
    const interactionId = `llm-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Log full prompt for debugging
    console.log(`\n🧠 [LLM REQUEST] ${purpose}`);
    console.log(`Full prompt:\n${prompt}`);
    console.log('=' .repeat(80));

    // Emit start event
    this.emitEvent('llm-interaction', {
      id: interactionId,
      timestamp: new Date().toISOString(),
      type: 'request',
      purpose,
      prompt: prompt.substring(0, 100) + '...', // Truncate for log
      fullPrompt: prompt // Full prompt for detailed inspection
    });

    try {
      const response = await this.llmClient.complete(prompt);
      
      // Log full response for debugging
      console.log(`\n💬 [LLM RESPONSE] ${purpose}`);
      console.log(`Full response:\n${response}`);
      console.log('=' .repeat(80));
      
      // Track successful interaction
      const interaction = {
        id: interactionId,
        timestamp: new Date().toISOString(),
        type: 'response',
        purpose,
        prompt,
        response,
        success: true
      };
      
      this.llmInteractions.push(interaction);
      
      // Emit success event
      this.emitEvent('llm-interaction', interaction);
      
      return response;
    } catch (error) {
      // Track failed interaction
      const interaction = {
        id: interactionId,
        timestamp: new Date().toISOString(),
        type: 'error',
        purpose,
        prompt,
        error: error.message,
        success: false
      };
      
      this.llmInteractions.push(interaction);
      
      // Emit error event
      this.emitEvent('llm-interaction', interaction);
      
      throw error;
    }
  }

  /**
   * Emit event for UI observability
   */
  emitEvent(eventType, data) {
    if (this.eventCallback) {
      this.eventCallback(eventType, data);
    }
  }

  /**
   * Get preview of variable value for display
   */
  getVariablePreview(value) {
    if (value === null) return 'null';
    if (value === undefined) return 'undefined';
    
    const type = typeof value;
    switch (type) {
      case 'string':
        return value.length > 50 ? `"${value.substring(0, 47)}..."` : `"${value}"`;
      case 'number':
      case 'boolean':
        return String(value);
      case 'object':
        if (Array.isArray(value)) {
          return `Array(${value.length})`;
        } else {
          const keys = Object.keys(value);
          return `Object(${keys.length} keys)`;
        }
      default:
        return `${type}`;
    }
  }

  /**
   * Add agent message to chat history
   */
  addAgentMessage(content) {
    this.chatHistory.push({
      role: 'agent',
      content: content,
      timestamp: Date.now()
    });
  }

  /**
   * Get current context state for debugging/display
   */
  getContextState() {
    return {
      artifacts: this.executionContext.artifacts,
      chatHistoryLength: this.chatHistory.length,
      operationCount: this.operationHistory.length,
      currentSearchResultsCount: this.currentSearchResults.length
    };
  }

  /**
   * Clear context (for testing or reset)
   */
  /**
   * Intelligent context optimization using LLM-driven decisions
   * Replaces the old clearContext() with smart optimization that preserves infrastructure
   */
  async optimizeContextIntelligently() {
    try {
      console.log('[ToolAgent] Starting automatic context optimization...');
      
      // Create context snapshot (preserves infrastructure variables)
      const contextSnapshot = this.getContextSnapshot();
      
      // Use ContextOptimizer for intelligent optimization
      const optimizedContext = await this.contextOptimizer.optimizeContext(contextSnapshot);
      
      // Apply optimizations while preserving infrastructure
      this.applyOptimizedContext(optimizedContext);
      
      console.log('[ToolAgent] ✅ Context optimization complete');
    } catch (error) {
      console.error('[ToolAgent] Context optimization failed (continuing with current context):', error.message);
      // Don't throw - optimization failure shouldn't break the user workflow
    }
  }
  
  /**
   * Legacy clearContext method - DEPRECATED
   * Use optimizeContextIntelligently() instead
   */
  clearContext() {
    console.warn('[ToolAgent] ⚠️  clearContext() is deprecated - use optimizeContextIntelligently() instead');
    this.executionContext.artifacts = {};
    this.chatHistory = [];
    this.operationHistory = [];
    this.currentOperation = null;
    // Note: Infrastructure variables (resourceActor, toolRegistry, etc.) are preserved
  }
  
  /**
   * Get complete context snapshot for optimization
   * @returns {Object} Context snapshot with all state
   */
  getContextSnapshot() {
    return {
      chatHistory: this.chatHistory,
      executionContext: this.executionContext,
      operationHistory: this.operationHistory,
      llmInteractions: this.llmInteractions,
      currentOperation: this.currentOperation,
      // Infrastructure variables that must be preserved
      resourceActor: this.resourceActor,
      toolRegistry: this.toolRegistry,
      llmClient: this.llmClient,
      eventCallback: this.eventCallback
    };
  }
  
  /**
   * Apply optimized context while preserving infrastructure
   * @param {Object} optimizedContext - Context returned by ContextOptimizer
   */
  applyOptimizedContext(optimizedContext) {
    // Apply user data optimizations
    this.chatHistory = optimizedContext.chatHistory || [];
    this.executionContext = optimizedContext.executionContext || { artifacts: {} };
    this.operationHistory = optimizedContext.operationHistory || [];
    this.llmInteractions = optimizedContext.llmInteractions || [];
    this.currentOperation = optimizedContext.currentOperation || null;
    
    // Ensure infrastructure variables are always preserved (even if optimization failed)
    if (!this.resourceActor && optimizedContext.resourceActor) {
      this.resourceActor = optimizedContext.resourceActor;
    }
    if (!this.toolRegistry && optimizedContext.toolRegistry) {
      this.toolRegistry = optimizedContext.toolRegistry;
    }
    if (!this.llmClient && optimizedContext.llmClient) {
      this.llmClient = optimizedContext.llmClient;
    }
    if (!this.eventCallback && optimizedContext.eventCallback) {
      this.eventCallback = optimizedContext.eventCallback;
    }
    
    // Always ensure output_directory exists
    if (!this.executionContext.artifacts.output_directory) {
      this.executionContext.artifacts.output_directory = {
        value: './tmp',
        description: 'Default directory for saving generated files and outputs.'
      };
    }
  }
}