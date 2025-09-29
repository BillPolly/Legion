/**
 * ToolUsingChatAgent - Context-aware intelligent chat agent
 * 
 * Core agent that analyzes user requests, searches for tools, executes them
 * with proper context management, and provides meaningful responses.
 * 
 * Reuses BT Executor's proven context management and tool execution patterns.
 */

import { extractJSON } from '@legion/planner';

export class ToolUsingChatAgent {
  constructor(toolRegistry, llmClient, eventCallback = null) {
    this.toolRegistry = toolRegistry;
    this.llmClient = llmClient;
    this.eventCallback = eventCallback; // For UI observability
    
    // Reuse BT Executor's proven context pattern
    this.executionContext = { 
      artifacts: {
        // Add context for AgentTools
        context: {
          resourceService: null, // Will be set by parent actor
          artifacts: null, // Will reference this.executionContext.artifacts
          llmClient: this.llmClient
        }
      }
    };
    
    // Set circular reference for artifacts
    this.executionContext.artifacts.context.artifacts = this.executionContext.artifacts;
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
        return {
          userResponse: response,
          toolsUsed: [],
          contextUpdated: [],
          reasoning: toolNeedAnalysis.reasoning,
          operationCount: 0
        };
      }

      // Stage 2: Search for relevant tools using semantic search
      this.currentSearchResults = await this.searchForTools(userInput);
      console.log(`[ToolAgent] Found ${this.currentSearchResults.length} tools in search`);

      if (this.currentSearchResults.length === 0) {
        const explanation = await this.explainNoToolsFound(userInput);
        this.addAgentMessage(explanation.userResponse);
        return explanation;
      }

      // Stage 3: Select tool sequence (single or multiple tools)
      const toolPlan = await this.selectToolSequence(this.currentSearchResults, userInput);
      console.log(`[ToolAgent] Tool plan:`, toolPlan);

      if (toolPlan.type === 'none') {
        const explanation = await this.explainNoSuitableTools(userInput, searchResults);
        this.addAgentMessage(explanation.userResponse);
        return explanation;
      }

      // Stage 4: Execute tool plan (single tool or sequence)
      const executionResults = await this.executeToolPlan(toolPlan);
      console.log(`[ToolAgent] Plan execution complete:`, executionResults.success);

      // Stage 5: Generate response to user
      const userResponse = await this.generateUserResponse(userInput, executionResults, toolPlan);

      this.addAgentMessage(userResponse);

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
    // Extract key capabilities from user input for better tool discovery
    const capabilities = this.extractCapabilities(userInput);
    
    const contextVars = Object.keys(this.executionContext.artifacts);
    const contextInfo = contextVars.length > 0 
      ? ` (available data: ${contextVars.join(', ')})`
      : '';
    
    // Search with capability-focused terms
    const enhancedQuery = capabilities.join(' ') + contextInfo;
    console.log(`[ToolAgent] Enhanced search query: "${enhancedQuery}"`);
    console.log(`[ToolAgent] Extracted capabilities: [${capabilities.join(', ')}]`);

    try {
      // Use existing semantic search infrastructure
      let searchResults = await this.toolRegistry.searchTools(enhancedQuery, {
        limit: 10,
        threshold: 0.3
      });

      // Enhanced search: If we extracted specific capabilities but didn't find key tools,
      // do direct lookups for critical tools
      if (capabilities.includes('generate image')) {
        const generateImageTool = await this.toolRegistry.getTool('generate_image');
        if (generateImageTool && !searchResults.find(r => r.name === 'generate_image')) {
          console.log('[ToolAgent] Adding generate_image tool via direct lookup');
          searchResults.push({
            name: 'generate_image',
            description: generateImageTool.description,
            tool: generateImageTool,
            confidence: 1.0
          });
        }
      }

      if (capabilities.includes('display resource')) {
        const displayTool = await this.toolRegistry.getTool('display_resource');
        if (displayTool && !searchResults.find(r => r.name === 'display_resource')) {
          console.log('[ToolAgent] Adding display_resource tool via direct lookup');
          searchResults.push({
            name: 'display_resource',
            description: displayTool.description,
            tool: displayTool,
            confidence: 1.0
          });
        }
      }

      return searchResults || [];
    } catch (error) {
      console.error('[ToolAgent] Error in semantic search:', error);
      return [];
    }
  }

  /**
   * Extract key capabilities from user request for better tool matching
   */
  extractCapabilities(userInput) {
    const input = userInput.toLowerCase();
    const capabilities = [];
    
    // Image generation capabilities
    if (input.includes('create') && (input.includes('image') || input.includes('picture') || input.includes('photo'))) {
      capabilities.push('generate image');
    }
    if (input.includes('generate') && (input.includes('image') || input.includes('picture'))) {
      capabilities.push('generate image');
    }
    
    // Display/show capabilities
    if (input.includes('show') || input.includes('display') || input.includes('window')) {
      capabilities.push('display resource');
    }
    
    // Notification capabilities
    if (input.includes('notify') || input.includes('alert') || input.includes('message')) {
      capabilities.push('notify user');
    }
    
    // File operations
    if (input.includes('save') || input.includes('write') || input.includes('file')) {
      capabilities.push('file write');
    }
    if (input.includes('read') || input.includes('load')) {
      capabilities.push('file read');
    }
    
    // Analysis capabilities  
    if (input.includes('analyze') || input.includes('analyse') || input.includes('examine')) {
      capabilities.push('analyze picture');
    }
    
    // Default fallback - use original input if no capabilities extracted
    if (capabilities.length === 0) {
      capabilities.push(userInput);
    }
    
    return capabilities;
  }

  /**
   * Set serializable agent context for AgentTools
   */
  setAgentContext(agentContext) {
    // Set artifacts reference in context
    agentContext.artifacts = this.executionContext.artifacts;
    
    // Put context with direct property access for tools
    this.executionContext.artifacts.context = {
      resourceActor: agentContext.resourceActor,
      toolRegistry: agentContext.toolRegistry,
      llmClient: agentContext.llmClient,
      plannerActor: agentContext.plannerActor,
      artifacts: this.executionContext.artifacts,
      // Add serialize method for client transmission
      serialize: () => agentContext.serialize()
    };
    console.log('[ToolAgent] Agent context set with direct property access');
    console.log('[ToolAgent] Context has resourceActor:', !!this.executionContext.artifacts.context.resourceActor);
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
- Only store outputs that will be used later
- Use exact parameter names from tool specifications

## Response Format

**Single Tool Response:**
{
  "type": "single",
  "tool": "tool_name",
  "description": "What this accomplishes",
  "inputs": {
    "paramName": "literal_value_or_@varName"
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
   ${result.success ? JSON.stringify(result.data) : `Error: ${result.error}`}
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
      const result = await tool.execute(resolvedInputs);
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

    const response = await this.llmClient.complete(prompt);

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

    const explanation = await this.llmClient.complete(prompt);

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
      const preview = this.getDetailedVariablePreview(value);
      return `- ${key}: ${preview}`;
    }).join('\n');
  }

  /**
   * Get detailed variable preview that shows actual data for LLM context
   */
  getDetailedVariablePreview(value) {
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
          return value.length < 5 ? JSON.stringify(value) : `Array(${value.length})`;
        } else {
          // Show actual object content if small
          try {
            const jsonStr = JSON.stringify(value);
            return jsonStr.length < 200 ? jsonStr : `Object(${Object.keys(value).length} keys)`;
          } catch (error) {
            return `Object(${Object.keys(value).length} keys)`;
          }
        }
      default:
        return `${type}`;
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
      const type = schema.type || typeof schema === 'string' ? schema : 'string';
      const required = inputSchema.required?.includes(param) ? '*' : '';
      return `  - ${param}${required} (${type}): ${schema.description || this.getParameterDescription(param)}`;
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
  clearContext() {
    this.executionContext.artifacts = {};
    this.chatHistory = [];
    this.operationHistory = [];
    this.currentOperation = null;
  }
}