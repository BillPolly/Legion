# Tool-Using Chat Agent Design

## Overview

Transform the simple echo ChatServerSubActor into an intelligent tool-using agent that can analyze user requests, search for appropriate tools, execute them with proper context management, and provide meaningful responses.

## Core Philosophy

**Context-Aware Intelligence**: The agent considers stored context variables at every decision point, building up knowledge through tool executions and maintaining state across the conversation.

**Reuse Proven Infrastructure**: Leverage BT Executor's mature context management, tool resolution, and parameter substitution systems without the complexity of behavior trees.

## Architecture

### Agent State Management

```javascript
class ToolUsingChatAgent {
  constructor(toolRegistry, llmClient) {
    // Reuse BT Executor's proven patterns
    this.executionContext = { 
      artifacts: {} // Named variables from tool outputs (BT pattern)
    };
    this.chatHistory = [];
    this.resolvedTools = new Map(); // Tool name → executable tool (BT pattern)
    
    // Agent-specific state
    this.currentOperation = null;
    this.operationHistory = [];
  }
}
```

### Context Variable Management

Following BT Executor's `executionContext.artifacts` pattern:

```javascript
// Store tool results with named outputs
this.executionContext.artifacts = {
  "user_file_content": "Hello World!",
  "analysis_result": { sentiment: "positive", confidence: 0.92 },
  "search_results": [...]
};

// Use @varName references in tool parameters  
const toolInputs = {
  "content": "@user_file_content",     // → "Hello World!"
  "analysis": "@analysis_result",    // → { sentiment: "positive", ... }
  "query": "latest news"             // → "latest news" (constant)
};
```

## Decision Pipeline

### Stage 1: Tool Need Analysis

**Input**: 
- Current user message
- Complete chat history  
- All stored context variables (`this.executionContext.artifacts`)

**Process**:
```javascript
async analyzeToolNeed(userInput) {
  const prompt = `
User request: "${userInput}"

Chat history:
${this.formatChatHistory()}

Available context variables:
${this.formatContextVariables()}

Question: Can this request be satisfied with existing context data, 
or do we need to use tools to get additional information/perform actions?

Consider:
- Does the user want information I already have stored?
- Are they asking me to perform an action that requires tools?
- Can I combine existing context data to answer their question?

Respond with JSON: {"needsTools": true/false, "reasoning": "..."}
  `;
  
  const response = await this.llmClient.complete(prompt);
  return JSON.parse(response);
}
```

**Output**: Decision + reasoning

### Stage 2: Semantic Tool Search

**Input**: 
- User request
- Context-enhanced search query
- Available context variables

**Process**:
```javascript
async searchForTools(userInput, contextVars) {
  // Create context-aware search query
  const contextInfo = Object.keys(contextVars).length > 0 
    ? ` (available data: ${Object.keys(contextVars).join(', ')})`
    : '';
  
  const enhancedQuery = userInput + contextInfo;
  
  // Use existing semantic search infrastructure (from ToolDiscoveryAdapter)
  const searchResults = await this.toolRegistry.searchTools(enhancedQuery, {
    limit: 10,
    threshold: 0.3
  });
  
  return searchResults;
}
```

**Output**: Ranked list of tools with confidence scores

### Stage 3: Tool Selection

**Input**:
- Search results from semantic search
- User request
- Available context variables
- Tool schemas and capabilities

**Process**:
```javascript
async selectBestTool(searchResults, userInput, contextVars) {
  const prompt = `
User request: "${userInput}"

Available tools from search:
${searchResults.map(tool => `
- ${tool.name}: ${tool.description}
  Module: ${tool.moduleName}
  Inputs required: ${JSON.stringify(tool.inputSchema)}
  Confidence: ${(tool.confidence * 100).toFixed(1)}%
`).join('\n')}

Available context variables:
${Object.keys(contextVars).map(key => `- ${key}: ${this.getVariablePreview(contextVars[key])}`).join('\n')}

Task: Select the best tool for this request. Consider:

1. **Tool Capability**: Which tool best matches the user's intent?
2. **Parameter Satisfaction**: Can I provide the required parameters from:
   - Context variables (use "@varName" syntax)  
   - Constants (direct values)
3. **Output Utility**: Will the tool's output help answer the user's question?

If no tool is suitable, respond with selectedTool: null and explain why.

Respond with JSON:
{
  "selectedTool": "tool_name" or null,
  "reasoning": "detailed explanation of choice",
  "parameters": {
    "param1": "constant_value",
    "param2": "@context_variable_name"
  },
  "outputVariable": "name_to_store_result_in_context"
}
  `;
  
  const response = await this.llmClient.complete(prompt);
  return JSON.parse(response);
}
```

**Output**: Tool selection with parameter mapping and output naming

### Stage 4: Tool Execution

**Process**: Reuse BT Executor's proven tool execution pipeline:

```javascript
async executeTool(toolSelection) {
  const { selectedTool, parameters, outputVariable } = toolSelection;
  
  // 1. Get resolved tool (using BT's pattern)
  const tool = this.resolvedTools.get(selectedTool);
  if (!tool) {
    throw new Error(`Tool ${selectedTool} not resolved`);
  }
  
  // 2. Resolve parameters with context substitution (BT's resolveParams)
  const resolvedInputs = this.resolveParams(parameters);
  
  // 3. Execute tool
  const result = await tool.execute(resolvedInputs);
  
  // 4. Store result in context with named variable (BT's pattern)
  if (outputVariable && result.success) {
    this.executionContext.artifacts[outputVariable] = result.data;
  }
  
  // 5. Record execution in operation history
  this.operationHistory.push({
    tool: selectedTool,
    inputs: resolvedInputs,
    outputs: result.data,
    outputVariable,
    timestamp: Date.now(),
    success: result.success
  });
  
  return result;
}

// Direct reuse of BT Executor's parameter resolution
resolveParams(params) {
  const resolved = {};
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === 'string' && value.startsWith('@')) {
      // @varName syntax - resolve to artifacts (BT pattern)
      const varName = value.substring(1);
      resolved[key] = this.executionContext.artifacts[varName];
    } else {
      resolved[key] = value; // Constant value
    }
  }
  return resolved;
}
```

### Stage 5: Continue/Complete Decision

**Input**:
- Original user request
- Tool execution result
- Updated context state
- Chat history

**Process**:
```javascript
async decideContinueOrComplete(originalRequest, toolResult, updatedContext) {
  const prompt = `
Original user request: "${originalRequest}"

Latest tool execution:
- Tool: ${toolResult.tool}
- Success: ${toolResult.success}
- Result: ${JSON.stringify(toolResult.data)}
- Stored as: ${toolResult.outputVariable}

Complete updated context:
${JSON.stringify(updatedContext, null, 2)}

Chat history:
${this.formatChatHistory()}

Questions:
1. Is the user's original request now fully satisfied with the available context?
2. If not, what specific additional information or actions do we need?
3. What should I tell the user about what was accomplished?

Respond with JSON:
{
  "complete": true/false,
  "userResponse": "what to tell the user about results",
  "nextAction": "description of what we still need to do" or null
}
  `;
  
  const response = await this.llmClient.complete(prompt);
  return JSON.parse(response);
}
```

**Output**: Completion decision + user response + next action

## Component Reuse from BT Executor

### 1. **Context Management System**
- `this.executionContext.artifacts` for variable storage
- Parameter resolution with `@varName` syntax
- Context serialization for prompts
- Variable lifecycle management

### 2. **Tool Resolution and Caching**
- `this.resolvedTools` Map for tool caching
- Tool validation and execute() method checking
- Error handling for missing tools
- Tool registry integration

### 3. **Execution Patterns**
- Tool parameter validation
- Result handling and storage
- Error propagation and recovery
- Execution history tracking

## Integration with Existing Systems

### Semantic Search Integration

```javascript
// Use existing toolRegistry.searchTools (from ToolDiscoveryAdapter)
const searchResults = await this.toolRegistry.searchTools(query, options);

// Results format (from SearchService):
[{
  tool: ToolObject,      // Executable tool instance
  name: "tool_name",
  description: "...",
  moduleName: "ModuleName", 
  confidence: 0.85,      // Semantic similarity score
  inputSchema: {...},
  outputSchema: {...}
}]
```

### LLM Client Integration

```javascript
// Use existing LLM client from services
const resourceManager = await ResourceManager.getInstance();
const llmClient = await resourceManager.get('llmClient');

// Structured prompting for reliable JSON responses
const response = await llmClient.complete(prompt, {
  temperature: 0.1, // Low temperature for structured decisions
  maxTokens: 1000
});
```

### Chat Message Flow

```javascript
// Replace ChatServerSubActor message handling
async handleSendMessage(data) {
  const { text, timestamp } = data;
  
  try {
    // Process through agent pipeline
    const result = await this.toolAgent.processMessage(text);
    
    // Send enriched response to client
    this.parentActor.sendToSubActor('chat', 'agent-response', {
      text: result.userResponse,
      toolsUsed: result.toolsUsed,
      contextUpdated: result.contextUpdated,
      reasoning: result.reasoning,
      timestamp: new Date().toLocaleTimeString()
    });
    
  } catch (error) {
    // Send error response
    this.parentActor.sendToSubActor('chat', 'agent-error', {
      text: `Sorry, I encountered an error: ${error.message}`,
      error: error.message,
      timestamp: new Date().toLocaleTimeString()
    });
  }
}
```

## UI Enhancements

### Enhanced Message Display

Show agent's tool usage and reasoning:

```javascript
// In ChatComponent - enhanced message types
createAgentMessageElement(message) {
  const messageElement = this.createBasicMessage(message);
  
  // Add tool usage indicator
  if (message.toolsUsed?.length > 0) {
    const toolsDiv = document.createElement('div');
    toolsDiv.className = 'tools-used';
    toolsDiv.innerHTML = `🛠️ Tools used: ${message.toolsUsed.join(', ')}`;
    messageElement.appendChild(toolsDiv);
  }
  
  // Add context updates
  if (message.contextUpdated?.length > 0) {
    const contextDiv = document.createElement('div');  
    contextDiv.className = 'context-updated';
    contextDiv.innerHTML = `📝 Stored: ${message.contextUpdated.join(', ')}`;
    messageElement.appendChild(contextDiv);
  }
  
  return messageElement;
}
```

### Context Variables Display

Add context sidebar to chat:

```javascript
// Show current context state in chat UI
renderContextState() {
  const contextVars = this.agentState.executionContext.artifacts;
  
  return `
<div class="context-sidebar">
  <h4>🗃️ Context Variables</h4>
  ${Object.keys(contextVars).map(key => `
    <div class="context-var">
      <span class="var-name">${key}:</span>
      <span class="var-preview">${this.getVariablePreview(contextVars[key])}</span>
    </div>
  `).join('')}
</div>
  `;
}
```

## Error Handling and Fallbacks

### Tool Execution Failures

```javascript
async handleToolExecutionError(error, toolName, originalRequest) {
  // Store error context for learning
  this.executionContext.artifacts[`${toolName}_error`] = error.message;
  
  // Try to find alternative tools
  const alternativeTools = await this.findAlternativeTools(toolName, originalRequest);
  
  if (alternativeTools.length > 0) {
    return await this.selectAndExecuteAlternative(alternativeTools);
  } else {
    return {
      success: false,
      userResponse: `I tried to use ${toolName} but it failed: ${error.message}. I couldn't find a suitable alternative tool.`,
      reasoning: `Tool ${toolName} execution failed, no alternatives found`
    };
  }
}
```

### No Suitable Tools Found

```javascript
async explainToolLimitations(userRequest, searchResults, contextVars) {
  const prompt = `
User requested: "${userRequest}"

I searched for tools but none are suitable:
${searchResults.map(tool => 
  `- ${tool.name} (${(tool.confidence * 100).toFixed(1)}% match): ${tool.description}`
).join('\n')}

Available context: ${JSON.stringify(contextVars)}

Explain clearly:
1. Why none of these tools match the user's request
2. What capabilities are missing
3. What the user could try instead or how to rephrase their request

Be helpful and specific.
  `;
  
  const explanation = await this.llmClient.complete(prompt);
  return {
    success: false,
    userResponse: explanation,
    reasoning: "No suitable tools found after semantic search"
  };
}
```

## Implementation Classes

### 1. ToolUsingChatAgent

**Purpose**: Core agent intelligence with context-aware decision making

**Key Methods**:
```javascript
class ToolUsingChatAgent {
  async processMessage(userInput)           // Main pipeline entry point
  async analyzeToolNeed(userInput)          // Stage 1: Tool necessity analysis  
  async searchForTools(userInput)           // Stage 2: Semantic tool search
  async selectBestTool(searchResults)       // Stage 3: Context-aware tool selection
  async executeTool(toolSelection)          // Stage 4: Tool execution with context
  async decideContinueOrComplete(result)    // Stage 5: Pipeline continuation logic
  
  // Context management (from BT Executor)
  resolveParams(params)                     // @varName → context value resolution
  formatContextVariables()                  // Context state for LLM prompts
  formatChatHistory()                       // Chat history for LLM context
}
```

### 2. ChatServerToolAgent 

**Purpose**: Server actor that integrates ToolUsingChatAgent into the actor system

**Key Methods**:
```javascript
class ChatServerToolAgent {
  constructor(services)
  async handleSendMessage(data)             // Replace echo with agent processing
  async initializeAgent()                   // Set up tool agent with dependencies
  
  // Message handling
  formatAgentResponse(result)               // Convert agent result to client message
  handleAgentError(error)                   // Error handling and user feedback
}
```

### 3. ContextManager (Extracted Utilities)

**Purpose**: Reusable context management utilities extracted from BT Executor

**Key Methods**:
```javascript
class ContextManager {
  static resolveParams(params, context)     // Parameter resolution utility
  static formatContextForPrompt(context)    // Context serialization for LLM
  static getVariablePreview(value)          // Value preview for UI display
  static validateContextVariable(name, value) // Variable validation
}
```

## Message Protocol

### Client → Server Messages

```javascript
// User sends message (same as current)
{
  type: 'send-message',
  text: "Can you read the file config.json and analyze its structure?",
  timestamp: "10:30:45"
}
```

### Server → Client Messages

```javascript
// Agent response (enhanced from current echo)
{
  type: 'agent-response',
  text: "I read config.json and analyzed its structure. The file contains 3 main sections...",
  toolsUsed: ["file_read", "json_parse"], 
  contextUpdated: ["config_content", "structure_analysis"],
  reasoning: "User wanted file analysis, so I read it then parsed the JSON structure",
  operationCount: 2,
  timestamp: "10:30:47"
}

// Agent error response
{
  type: 'agent-error', 
  text: "I tried to read the file but it doesn't exist. Could you check the path?",
  error: "File not found: config.json",
  attemptedTools: ["file_read"],
  suggestions: ["Check file path", "List directory contents first"],
  timestamp: "10:30:46"
}

// Agent thinking response (optional - for transparency)
{
  type: 'agent-thinking',
  step: "searching",
  message: "Searching for tools that can read files...",
  foundTools: 3,
  timestamp: "10:30:45"
}
```

## Tool Execution Patterns

### Parameter Resolution Examples

```javascript
// Example 1: File analysis workflow
// User: "Read config.json and analyze its structure"

// Step 1: Read file
{
  tool: "file_read",
  parameters: {"filePath": "config.json"},
  outputVariable: "file_content"
}
// Result: artifacts.file_content = "{\\"port\\": 3000, \\"db\\": {...}}"

// Step 2: Analyze structure  
{
  tool: "json_parse",
  parameters: {"content": "@file_content"}, // ← Uses stored result
  outputVariable: "parsed_data"
}
// Result: artifacts.parsed_data = {port: 3000, db: {...}}
```

### Multi-Step Tool Chains

```javascript
// Example 2: Data processing pipeline
// User: "Get weather for New York and send it via email"

// Execution chain with context flow:
// 1. weather_api → artifacts.weather_data
// 2. email_compose(content: "@weather_data") → artifacts.email_draft  
// 3. email_send(message: "@email_draft") → artifacts.send_result
```

### Context Variable Lifecycle

```javascript
// Variable naming conventions
const outputVariable = `${toolName}_result`;           // Default naming
const outputVariable = `user_specified_name`;          // User-provided name
const outputVariable = `${operation}_${timestamp}`;    // Timestamped for uniqueness

// Variable persistence
// - Context persists for entire chat session
// - Variables can be referenced in any future tool execution
// - Variables are displayed in UI for user awareness
```

## Error Handling Strategies

### 1. Tool Execution Failures

```javascript
async handleToolFailure(toolName, error, originalRequest) {
  // Store error for context
  this.executionContext.artifacts[`${toolName}_error`] = error.message;
  
  // Try to find alternative tools
  const alternatives = await this.searchForTools(originalRequest);
  const viableAlternatives = alternatives.filter(tool => 
    tool.name !== toolName && tool.confidence > 0.5
  );
  
  if (viableAlternatives.length > 0) {
    return await this.selectBestTool(viableAlternatives, originalRequest, this.executionContext.artifacts);
  } else {
    return await this.explainFailureToUser(toolName, error, originalRequest);
  }
}
```

### 2. No Suitable Tools

```javascript
async explainNoSuitableTools(userRequest, searchResults) {
  const prompt = `
User request: "${userRequest}"

I found these tools but none are suitable:
${searchResults.map(t => `- ${t.name} (${(t.confidence*100).toFixed(1)}%): ${t.description}`).join('\n')}

Current context: ${JSON.stringify(this.executionContext.artifacts)}

Explain to the user:
1. Why none of these tools can help with their request
2. What specific capabilities are missing  
3. How they could rephrase their request or what tools they might need
4. Whether there's anything in the current context that could help

Be helpful and specific.
  `;
  
  const explanation = await this.llmClient.complete(prompt);
  return {
    success: false,
    userResponse: explanation,
    reasoning: "No suitable tools found after semantic search and evaluation"
  };
}
```

### 3. Parameter Resolution Failures

```javascript
validateParameterResolution(resolvedParams, requiredParams) {
  const missing = [];
  const invalid = [];
  
  for (const [param, value] of Object.entries(resolvedParams)) {
    if (value === undefined && requiredParams.includes(param)) {
      missing.push(param);
    }
    if (typeof value === 'string' && value.startsWith('@')) {
      // Unresolved variable reference
      invalid.push(`${param}: ${value} (variable not found in context)`);
    }
  }
  
  if (missing.length > 0 || invalid.length > 0) {
    throw new Error(`Parameter resolution failed: missing=[${missing.join(',')}], invalid=[${invalid.join(',')}]`);
  }
}
```

## Testing Strategy

### Unit Tests (TDD Approach)

```javascript
describe('ToolUsingChatAgent', () => {
  test('analyzes tool need correctly with existing context', async () => {
    const agent = new ToolUsingChatAgent(mockToolRegistry, mockLLM);
    agent.executionContext.artifacts.user_data = {name: "John"};
    
    const result = await agent.analyzeToolNeed("What's my name?");
    expect(result.needsTools).toBe(false);
    expect(result.reasoning).toContain("already available in context");
  });
  
  test('executes tool with @varName parameter resolution', async () => {
    const agent = new ToolUsingChatAgent(mockToolRegistry, mockLLM);
    agent.executionContext.artifacts.file_path = "/tmp/test.txt";
    
    const selection = {
      selectedTool: "file_read",
      parameters: {"path": "@file_path"},
      outputVariable: "file_content"
    };
    
    await agent.executeTool(selection);
    expect(agent.executionContext.artifacts.file_content).toBeDefined();
  });
});
```

### Integration Tests

```javascript
describe('ChatServerToolAgent Integration', () => {
  test('complete user workflow with tool chain', async () => {
    const agent = new ChatServerToolAgent(realServices);
    
    // User requests file analysis
    const result1 = await agent.handleSendMessage({
      text: "Read config.json and tell me the port number"
    });
    
    // Should use file_read → json_parse → response
    expect(result1.toolsUsed).toContain('file_read');
    expect(result1.contextUpdated).toContain('file_content');
  });
});
```

## Deployment Integration

### Replace ChatServerSubActor

```javascript
// In RootServerActor
// OLD: this.chatSubActor = new ChatServerSubActor(services);
// NEW: this.chatSubActor = new ChatServerToolAgent(services);
```

### UI Message Handling

```javascript
// In ChatComponent - handle new message types
receiveMessage(messageType, data) {
  switch (messageType) {
    case 'agent-response':
      this.handleAgentResponse(data);
      break;
    case 'agent-error':
      this.handleAgentError(data);  
      break;
    case 'agent-thinking':
      this.handleAgentThinking(data);
      break;
    // ... existing cases
  }
}
```

## Success Metrics

1. **Context Awareness**: Agent references previous tool results in subsequent decisions
2. **Tool Chain Execution**: Agent successfully executes multi-step tool workflows  
3. **Failure Recovery**: Agent handles tool failures gracefully with alternatives
4. **Parameter Resolution**: @varName references work correctly across tool executions
5. **User Experience**: Clear communication about what tools were used and why

---

**Ready for Review**: This design leverages BT Executor's proven context management while creating a simple, context-aware tool-using agent for the chat interface.