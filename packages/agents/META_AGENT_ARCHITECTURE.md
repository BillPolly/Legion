# MetaAgent and AgentCreator Architecture

## Overview

The MetaAgent system is a sophisticated framework for creating, testing, and managing AI agents through both conversational interfaces and programmatic APIs. It consists of two main components:

1. **AgentCreator** - The core service that handles all agent creation logic
2. **MetaAgent** - A conversational wrapper that provides natural language interaction

## System Components

### 1. AgentCreator (Core Service)
**Location**: `/packages/agents/meta-agent/src/AgentCreator.js`

AgentCreator is the workhorse of the system, providing a complete workflow for agent creation:

#### Key Responsibilities:
- **Agent Design**: Converts requirements into agent configurations
- **Testing**: Validates agent behavior against test cases
- **Refinement**: Improves configurations based on test results
- **Registration**: Stores agents in the registry
- **Template Management**: Pre-defined agent templates
- **Batch Operations**: Create multiple agents simultaneously
- **Export/Import**: Multiple format support (JSON, YAML, TypeScript)

#### Main Methods:
```javascript
// Primary creation method
async createAgent(requirements) {
  // 1. Design agent configuration
  // 2. Create ConfigurableAgent instance
  // 3. Test agent behavior
  // 4. Refine if tests fail
  // 5. Register in AgentRegistry
  // Returns: { agent, agentId, testsPassed, registrationId }
}
```

### 2. MetaAgent (Conversational Interface)
**Location**: `/packages/agents/meta-agent/src/MetaAgent.js`

MetaAgent extends ConfigurableAgent to provide a conversational interface:

#### Key Features:
- **Command System**: Slash commands for structured operations
- **Natural Language**: Understands plain English requests
- **Guided Creation**: Interactive agent design process
- **Reporting**: Comprehensive agent analysis and reports

#### Available Commands:
- `/create-agent` - Create from JSON requirements
- `/list-agents` - Show all created agents
- `/test-agent [id]` - Run tests on an agent
- `/analyze-agent [id]` - Analyze configuration quality
- `/optimize-agent [id]` - Optimize prompts
- `/export-agent [id] [format]` - Export configurations
- `/use-template [name]` - Create from template
- `/batch-create` - Create multiple agents
- `/agent-report [id]` - Full agent report

### 3. ConfigurableAgent (Base Class)
**Location**: `/packages/agents/configurable-agent/src/core/ConfigurableAgent.js`

The foundation for all agents in the system:

#### Architecture:
- **Actor Pattern**: Message-based communication via `receive()` method
- **Component-Based**: Modular design with pluggable capabilities
- **State Management**: Built-in conversation history and context
- **Knowledge Graph**: Optional semantic memory
- **Behavior Trees**: Support for complex workflows

#### Message Types:
- `chat` - Conversational interactions with LLM
- `tool_request` - Execute specific tools
- `query` - Information retrieval
- `state_update` - Modify agent state
- `execute_bt` - Run behavior tree workflows
- `shutdown` - Graceful cleanup

### 4. Supporting Components

#### AgentRegistry
**Location**: `/packages/agents/agent-registry/`
- Persistent storage for agent configurations
- MongoDB-backed repository
- Search and retrieval capabilities
- Version management

#### PromptTester
**Location**: `/packages/agents/prompt-engineering/`
- Validates prompt effectiveness
- Tests consistency and tone
- Format compliance checking
- A/B testing capabilities

#### TestRunner
**Location**: `/packages/agents/agent-testing/`
- Automated agent testing
- Behavioral validation
- Performance metrics
- Test case management

## Agent Creation Workflow

### Step 1: Requirements Analysis
The system analyzes user requirements to determine:
- **Agent Type**: conversational, analytical, creative, or task-oriented
- **Purpose**: What the agent should accomplish
- **Capabilities**: Required skills and tools
- **Constraints**: LLM parameters, safety requirements

### Step 2: Configuration Generation
Using AgentConfigBuilder, the system creates:
```javascript
{
  agent: {
    id: "auto-generated-id",
    name: "Derived from purpose",
    type: "determined-type",
    version: "1.0.0",
    description: "User's purpose",
    llm: {
      provider: "anthropic",
      model: "claude-3-5-sonnet-20241022",
      temperature: 0.7,
      maxTokens: 1000
    },
    prompts: {
      system: "Generated based on type and purpose"
    },
    capabilities: ["array of capabilities"]
  }
}
```

### Step 3: Agent Instantiation
A ConfigurableAgent instance is created and initialized with:
- State management system
- Capability manager
- Prompt manager
- Knowledge graph (if enabled)
- LLM client from ResourceManager

### Step 4: Testing Phase
The agent undergoes testing with:
- Default test cases based on agent type
- User-provided test scenarios
- Pattern matching for expected responses
- Consistency validation

### Step 5: Refinement (if needed)
If tests fail, the system:
- Analyzes failure patterns
- Adjusts system prompts
- Lowers temperature for consistency
- Adds examples for clarity
- Retests the refined configuration

### Step 6: Registration
Successful agents are:
- Stored in AgentRegistry
- Assigned a registration ID
- Made available for retrieval
- Tracked in the system

## Tool Handling

### Tool Discovery Method: **Keyword Matching**

The system uses **basic keyword matching** rather than semantic search for tool discovery:

```javascript
determineTools(requirements) {
  const tools = [];
  const purpose = requirements.purpose.toLowerCase();
  
  // Capability-based matching
  if (requirements.capabilities) {
    for (const capability of requirements.capabilities) {
      const cap = capability.toLowerCase();
      if (cap.includes('file')) tools.push('file_operations');
      if (cap.includes('search')) tools.push('web_search');
      if (cap.includes('data')) tools.push('data_analysis');
      if (cap.includes('code')) tools.push('code_execution');
    }
  }
  
  // Purpose-based matching
  if (purpose.includes('file') || purpose.includes('document')) {
    tools.push('file_operations');
  }
  if (purpose.includes('search') || purpose.includes('research')) {
    tools.push('web_search');
  }
  
  return [...new Set(tools)]; // Remove duplicates
}
```

### Valid Tools List
The system recognizes these predefined tools:
- `file_read`, `file_write`, `file_operations`
- `web_search`, `web_fetch`
- `calculator`, `code_analyzer`, `code_execution`
- `data_transformer`, `data_analysis`
- `directory_manager`, `knowledge_search`
- `ticket_create`, `ticket_creation`
- `escalation`, `json_manipulation`

## Templates System

### Pre-defined Templates

The system includes templates for common agent types:

#### Customer Support Agent
```javascript
{
  type: 'conversational',
  basePrompt: 'You are a helpful customer support agent for {companyName}. You assist customers with {productName}.',
  capabilities: ['answer questions', 'provide support', 'resolve issues'],
  tools: ['knowledge_search', 'ticket_create']
}
```

#### Code Reviewer
```javascript
{
  type: 'analytical',
  basePrompt: 'You are an expert code reviewer. Analyze code for bugs, performance issues, and best practices.',
  capabilities: ['code analysis', 'bug detection', 'suggest improvements'],
  tools: ['code_analyzer', 'file_read']
}
```

#### Content Writer
```javascript
{
  type: 'creative',
  basePrompt: 'You are a creative content writer who generates engaging and informative content.',
  capabilities: ['write articles', 'create stories', 'generate content'],
  tools: ['web_search', 'file_write']
}
```

#### Data Analyst
```javascript
{
  type: 'analytical',
  basePrompt: 'You are a data analyst who processes and analyzes data to provide insights.',
  capabilities: ['data analysis', 'statistical analysis', 'report generation'],
  tools: ['data_transformer', 'file_read', 'file_write']
}
```

### Template Variables
Templates support variable substitution:
```javascript
// Template: "You are a helpful customer support agent for {companyName}"
// Variables: { companyName: "Acme Corp" }
// Result: "You are a helpful customer support agent for Acme Corp"
```

## Natural Language Understanding

### Intent Detection
The MetaAgent analyzes user input to determine intent:

```javascript
analyzeIntent(content) {
  const lowerContent = content.toLowerCase();
  
  // Creation intent
  if (lowerContent.includes('create') || 
      lowerContent.includes('build') || 
      lowerContent.includes('make')) {
    return { 
      action: 'create', 
      requirements: extractRequirements(content) 
    };
  }
  
  // Help intent
  if (lowerContent.includes('help') || 
      lowerContent.includes('what can you')) {
    return { action: 'help' };
  }
  
  // Default to chat
  return { action: 'chat' };
}
```

### Task Type Detection
Automatically determines agent type from description:
- **Conversational**: Keywords like "chat", "support", "conversation"
- **Analytical**: Keywords like "analyze", "review", "audit"
- **Creative**: Keywords like "create", "write", "generate"
- **Task**: Default for specific task-oriented agents

## Analysis and Optimization

### Agent Analysis
The system evaluates agent configurations for:
- **Prompt Quality**: Length, specificity, clarity
- **Capability Definition**: Completeness and validity
- **Tool Selection**: Appropriate tool assignment
- **Configuration Completeness**: All required fields present

### Scoring System
Agents receive a quality score (0-100):
- -20 points for each high-severity issue
- -10 points for medium-severity issues
- -5 points for low-severity issues

### Prompt Optimization
Automatic improvements include:
- Removing redundant phrases
- Simplifying verbose language
- Consolidating duplicate instructions
- Adding clarity directives

## Export Formats

### JSON Export
Standard configuration format for programmatic use

### YAML Export
Human-readable hierarchical format

### TypeScript Export
Type-safe interface definitions for TypeScript projects

## Batch Operations

### Batch Creation
Process multiple agent requirements simultaneously:
```javascript
const requirements = [
  { purpose: "Customer support", taskType: "conversational" },
  { purpose: "Code review", taskType: "analytical" },
  { purpose: "Content creation", taskType: "creative" }
];

const results = await agentCreator.designBatch(requirements);
// Returns: { results, errors, totalProcessed, successCount, errorCount }
```

## Error Handling

The system implements comprehensive error handling:
- **Validation Errors**: Invalid configurations caught early
- **Test Failures**: Automatic refinement attempts
- **LLM Errors**: Retry logic with exponential backoff
- **Registration Failures**: Rollback mechanisms

## Performance Considerations

### Caching
- Created agents stored in memory map
- Test results cached for analysis
- Templates pre-loaded at initialization

### Resource Management
- Proper cleanup on shutdown
- Component lifecycle management
- Memory-efficient batch processing

## Integration Points

### ResourceManager
Central singleton for:
- Environment configuration
- LLM client access
- Shared resource management

### MongoDB
Persistent storage for:
- Agent configurations
- Test results
- Registration data

### LLM Integration
Supports multiple providers:
- Anthropic (Claude)
- OpenAI (GPT)
- Extensible for other providers

## Best Practices

### Agent Design
1. Start with clear, specific requirements
2. Use templates for common patterns
3. Include comprehensive test cases
4. Enable auto-refinement for better results

### Testing
1. Provide domain-specific test cases
2. Test edge cases and error conditions
3. Validate consistency across interactions
4. Monitor token usage and efficiency

### Deployment
1. Register all production agents
2. Export configurations for version control
3. Document agent capabilities clearly
4. Monitor agent performance metrics

## Limitations

### Current Limitations
1. **No Semantic Search**: Tool discovery uses keyword matching only
2. **Limited Tool Set**: Predefined tool list, not dynamically extensible
3. **Basic Intent Detection**: Simple keyword-based NLU
4. **No Learning**: Agents don't improve from usage
5. **Single LLM**: One LLM provider per agent

### Future Enhancements
1. Semantic search for intelligent tool discovery
2. Dynamic tool registration and discovery
3. Advanced NLU with intent classification
4. Reinforcement learning from user feedback
5. Multi-modal agent support

## Example Usage

### Creating an Agent via MetaAgent
```javascript
const metaAgent = new MetaAgent(config, resourceManager);
await metaAgent.initialize();

// Natural language creation
const response = await metaAgent.processMessage({
  content: "Create a customer support agent for Acme Corp that can handle billing inquiries"
});

// Command-based creation
const response = await metaAgent.processMessage({
  content: '/create-agent {"purpose": "Handle billing inquiries", "taskType": "conversational"}'
});
```

### Direct AgentCreator Usage
```javascript
const creator = new AgentCreator(resourceManager);
await creator.initialize();

const result = await creator.createAgent({
  purpose: "Review code for security vulnerabilities",
  taskType: "analytical",
  capabilities: ["code analysis", "security scanning"],
  testCases: [
    {
      input: "Review this SQL: SELECT * FROM users WHERE id = '$id'",
      expectedPatterns: ["injection", "vulnerability", "unsafe"]
    }
  ]
});
```

## Conclusion

The MetaAgent/AgentCreator system provides a powerful, flexible framework for AI agent creation. While it currently uses simple keyword matching for tool discovery rather than semantic search, it offers comprehensive features for designing, testing, and deploying agents through both conversational and programmatic interfaces. The architecture's modular design allows for future enhancements while maintaining backward compatibility.