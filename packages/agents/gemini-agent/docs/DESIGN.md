# Gemini-Compatible Agent Design Document

## 1. Executive Summary

The Gemini-Compatible Agent is an MVP that replicates the core capabilities of Google's Gemini CLI by **porting all necessary code, prompts, and services** from the Gemini CLI codebase and **reimplementing them using Legion's framework patterns**. This agent provides the same conversational AI experience and tool execution capabilities as Gemini CLI but is built entirely within Legion's ecosystem with zero dependencies on the Gemini CLI package.

### 1.1 Code Porting Strategy
**All Gemini CLI functionality will be ported and reimplemented:**
- **Tools**: File operations, shell commands, search utilities → Native Legion tools
- **Prompts**: System prompts, context builders, compression logic → Legion prompt management  
- **Services**: Conversation management, tool scheduling, memory handling → Legion service patterns
- **Core Logic**: Turn management, streaming responses, error handling → Legion architecture patterns

**Everything follows Legion standards:**
- ResourceManager singleton for all environment access
- Legion's schema package for all JSON validation
- Legion's tool registry patterns
- Legion's MVVM actor framework for UI
- Legion's ConfigurableAgent base class

## 2. System Overview

### 2.1 Purpose
Create an agent that can:
- Engage in natural language conversations about code and files
- Execute file operations (read, write, edit, search)
- Run shell commands safely
- Maintain conversation context and memory
- Provide streaming responses with real-time tool execution
- Offer web-based interface for improved user experience

### 2.2 Scope
- **In Scope**: Core conversational AI, file operations, shell execution, tool integration, web UI
- **Out of Scope**: IDE integration, MCP server support, advanced deployment features

## 3. Architecture

### 3.1 Code Porting Architecture

**This agent is built by porting and reimplementing Gemini CLI components:**

```
Gemini CLI Source Code                    Legion Implementation
┌─────────────────────┐                  ┌─────────────────────┐
│ /packages/core/src/ │────── PORT ────► │ Legion Native Code  │
│                     │      REWRITE     │                     │
│ • tools/*.ts        │────────────────► │ • Native Tools      │
│ • core/prompts.ts   │────────────────► │ • Prompt Manager    │
│ • core/client.ts    │────────────────► │ • Agent Core        │
│ • services/*.ts     │────────────────► │ • Legion Services   │
└─────────────────────┘                  └─────────────────────┘
```

### 3.2 High-Level Architecture (All Legion Components)

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────────┐
│   Web UI        │◄──►│  Agent Core      │◄──►│ Ported Tools        │
│ (Legion MVVM)   │    │ (ConfigurableAgent)│    │ (Legion Patterns)   │
└─────────────────┘    └──────────────────┘    └─────────────────────┘
                              │                           │
                              ▼                           │
                       ┌──────────────────┐              │
                       │ Resource Manager │◄─────────────┘
                       │ (Legion Singleton)│
                       └──────────────────┘
                              │
                              ▼
                       ┌──────────────────┐
                       │   LLM Client     │
                       │ (Legion Pattern) │
                       └──────────────────┘
```

### 3.3 Component Architecture (All Code Ported & Reimplemented)

#### 3.3.1 Agent Core (Ported from `/packages/core/src/core/client.ts`)
- **Source**: Gemini CLI's `client.ts` conversation management logic
- **Implementation**: Extends Legion's `ConfigurableAgent`, all code rewritten to Legion patterns
- **Ported & Reimplemented Components**:
  - **Conversation Controller**: Turn management from Gemini CLI's Turn class → Legion patterns
  - **Tool Scheduler**: Logic from `coreToolScheduler.ts` → Legion tool registry integration  
  - **Memory Manager**: Context compression from `prompts.ts` → Legion memory patterns
  - **Response Streamer**: Streaming logic from Gemini CLI → Legion WebSocket patterns

#### 3.3.2 Native Tools (Ported from `/packages/core/src/tools/`)
- **Source Files Being Ported**:
  - `read-file.ts` → `Legion ReadFileTool`
  - `write-file.ts` → `Legion WriteFileTool`
  - `edit.ts` → `Legion EditFileTool`
  - `shell.ts` → `Legion ShellTool`
  - `grep.ts` → `Legion GrepTool`
  - `glob.ts` → `Legion GlobTool`
  - `ls.ts` → `Legion ListFilesTool`
- **Implementation**: Each tool's logic completely rewritten using Legion tool patterns
- **Standards**: All tools use ResourceManager, Legion schemas, Legion error handling

#### 3.3.3 Prompting System (Ported from `/packages/core/src/core/prompts.ts`)
- **Source Functions Being Ported**:
  - `getCoreSystemPrompt()` → Legion PromptManager system prompts
  - `getCompressionPrompt()` → Legion memory compression prompts
  - Environment context building → Legion context assembly
- **Implementation**: All prompt logic rewritten using Legion's prompt management patterns
- **Integration**: Prompts stored and managed through Legion's ResourceManager

#### 3.2.4 Web Interface
- **Architecture**: Legion's MVVM with Actor framework
- **Components**:
  - Chat Interface: Real-time conversation display
  - Tool Execution View: Shows running tools and results
  - Configuration Panel: Agent settings and tool permissions
  - File Explorer: Browse and edit project files

## 4. Core Features

### 4.1 Conversational AI
- **Natural Language Processing**: Understands coding questions, file manipulation requests, and project queries
- **Context Awareness**: Maintains understanding of current project, recent changes, and conversation history
- **Streaming Responses**: Real-time response generation with progressive disclosure

### 4.2 File Operations
- **Read Operations**: Single and multiple file reading with syntax highlighting
- **Write Operations**: Create new files with proper encoding and permissions
- **Edit Operations**: Intelligent file editing with diff generation and validation
- **Search Operations**: Grep-style content search and glob pattern file finding

### 4.3 Shell Integration
- **Command Execution**: Run shell commands with proper security controls
- **Interactive Sessions**: Support for commands requiring user input
- **Output Streaming**: Real-time command output display
- **Environment Management**: Proper working directory and environment variable handling

### 4.4 Tool Management
- **Dynamic Discovery**: Automatic discovery of available Legion tools
- **Permission System**: User approval for tool execution with security levels
- **Error Handling**: Graceful handling of tool failures with retry mechanisms
- **Result Integration**: Tool outputs integrated into conversation context

### 4.5 Memory & Context
- **Conversation History**: Complete dialogue preservation with compression
- **File Context**: Awareness of project structure and recently modified files  
- **State Persistence**: Session continuity across restarts
- **Context Compression**: Automatic history summarization to manage token limits

## 5. Data Models

### 5.1 Conversation Model
```javascript
{
  id: "conv_12345",
  created: "2025-01-09T10:00:00Z",
  turns: [
    {
      id: "turn_1",
      type: "user" | "assistant",
      content: "string",
      tools: [ToolExecution],
      timestamp: "2025-01-09T10:00:00Z"
    }
  ],
  context: {
    workingDirectory: "/path/to/project",
    recentFiles: ["file1.js", "file2.js"],
    environment: {...}
  }
}
```

### 5.2 Tool Execution Model
```javascript
{
  id: "tool_123",
  name: "read_file",
  parameters: {...},
  status: "pending" | "running" | "completed" | "failed",
  result: {...},
  error: "string | null",
  startTime: "2025-01-09T10:00:00Z",
  endTime: "2025-01-09T10:00:30Z"
}
```

### 5.3 Agent Configuration Model
```javascript
{
  id: "gemini-compatible-agent",
  name: "Gemini Compatible Agent",
  description: "AI coding assistant with Gemini CLI capabilities",
  capabilities: [
    "file-operations",
    "shell-execution", 
    "code-analysis",
    "conversation"
  ],
  tools: {
    allowed: ["read_file", "write_file", "shell_command", ...],
    requiresApproval: ["shell_command", "write_file"],
    autoApprove: ["read_file", "list_files"]
  },
  prompting: {
    systemPrompt: "...",
    conversationStyle: "helpful-coding-assistant",
    maxContextLength: 100000
  }
}
```

## 6. Integration Points

### 6.1 Legion Framework Integration
- **Resource Manager**: All environment access through singleton
- **Tool Registry**: All tools discovered and executed through Legion's registry
- **Schema Validation**: Use Legion's schema package for all JSON validation
- **Actor Framework**: Web UI built with Legion's MVVM actor patterns

### 6.2 Gemini CLI Compatibility
- **Code Porting**: All necessary Gemini CLI code ported to Legion standards (no dependencies on Gemini CLI package)
- **Tool Implementation**: Gemini CLI tools reimplemented using Legion's tool patterns
- **Prompt Porting**: System prompts extracted and adapted to Legion's prompt management
- **Service Migration**: Core services (file operations, shell execution, etc.) ported to Legion architecture
- **Response Format**: Compatible response formatting and streaming implemented natively

### 6.3 External Services
- **LLM Client**: Gemini API through Legion's LLM client abstraction
- **File System**: All file operations through Legion's secure file tools
- **Shell Access**: Controlled shell execution through Legion's shell tools

## 7. User Experience

### 7.1 Web Interface Flow
1. **Initial Load**: Agent configuration loads, tools discover, UI initializes
2. **Conversation Start**: User enters query, system prompt activates
3. **Response Generation**: Streaming response with tool execution visualization
4. **Tool Interaction**: Real-time tool execution with approval prompts
5. **Result Integration**: Tool results integrated into conversation naturally
6. **Context Management**: Automatic context compression when needed

### 7.2 Conversation Patterns
- **Code Questions**: "What does this function do?", "How can I optimize this?"
- **File Operations**: "Read the config file", "Create a new component"
- **Project Analysis**: "Show me all the test files", "Find unused imports"
- **Shell Commands**: "Run the tests", "Install dependencies"

### 7.3 Tool Execution UX
- **Visual Indicators**: Loading spinners, progress bars, status indicators
- **Approval Prompts**: Clear descriptions of what tools will do
- **Result Display**: Syntax-highlighted code, formatted output, error messages
- **Undo Capabilities**: File change history and rollback options

## 8. Security & Safety

### 8.1 Tool Execution Safety
- **Permission System**: Explicit user approval for potentially dangerous operations
- **Sandboxing**: Shell commands run with appropriate restrictions
- **File Access Control**: Read/write permissions based on project boundaries
- **Command Validation**: Shell command analysis before execution

### 8.2 Data Security
- **No Sensitive Data Logging**: Avoid logging API keys, passwords, secrets
- **Secure Communication**: HTTPS for all web traffic, encrypted storage
- **User Data Isolation**: Each user's data kept separate and secure
- **Session Management**: Secure session handling with proper timeouts

## 9. Configuration

### 9.1 Agent Configuration
```javascript
// Default agent configuration
{
  "agent": {
    "name": "Gemini Compatible Agent",
    "model": "gemini-2.0-flash-exp",
    "maxTokens": 100000,
    "temperature": 0.1
  },
  "tools": {
    "autoApprove": ["read_file", "list_files", "search_files"],
    "requireApproval": ["write_file", "shell_command", "delete_file"],
    "disabled": []
  },
  "ui": {
    "theme": "default",
    "showToolExecution": true,
    "enableFileExplorer": true
  }
}
```

### 9.2 Environment Configuration
- **Resource Manager Integration**: All config through Legion's resource manager
- **Environment Variables**: LLM API keys, tool permissions, working directories
- **Runtime Settings**: Debug modes, logging levels, performance tuning

## 10. Technology Stack

### 10.1 Core Technologies
- **Backend**: Node.js with Legion framework
- **Agent Framework**: Legion's ConfigurableAgent
- **LLM Integration**: Gemini API through Legion's LLM client
- **Tools**: Native Legion tools ported from Gemini CLI source code
- **Services**: Core services ported from Gemini CLI and adapted to Legion patterns
- **Data Storage**: File-based configuration and state persistence

### 10.2 Web Interface
- **Frontend**: Pure JavaScript with Legion's component framework
- **UI Architecture**: MVVM with Legion's actor framework
- **Real-time Communication**: WebSockets for streaming responses
- **Styling**: CSS with Legion's design patterns

### 10.3 Development Tools
- **Testing**: Jest with Legion's testing patterns
- **Validation**: Legion's schema package (no Zod outside schema package)
- **Build System**: Node.js native modules, no complex build process
- **Code Quality**: ESLint, Prettier, following Legion's code standards

## 11. Detailed Component Specifications

### 11.1 GeminiCompatibleAgent Class
**Extends**: `ConfigurableAgent`
**Purpose**: Main agent controller that orchestrates all agent functionality

**Core Methods**:
- `initialize()`: Sets up tools, prompts, and initial state
- `processMessage(userInput)`: Main conversation processing loop
- `executeTools(toolRequests)`: Manages tool execution with proper permissions
- `streamResponse(response)`: Handles real-time response streaming
- `compressContext()`: Manages conversation history when approaching token limits

**State Management**:
- Conversation history with turn-based organization
- Tool execution queue and results tracking
- File system awareness and change tracking
- User preferences and permission settings

### 11.2 Detailed Code Porting Plan for Tools

**Each Gemini CLI tool will be completely ported and reimplemented:**

#### 11.2.1 ReadFileTool (From `/packages/core/src/tools/read-file.ts`)
**Source Code Analysis**:
- Current Gemini CLI implementation: File reading with encoding detection, error handling
- Tool schema: File path parameter, content output with metadata
- Security: Path validation, permission checks

**Legion Implementation**:
```javascript
// Port the core logic but use Legion patterns
class ReadFileTool extends LegionToolBase {
  constructor() {
    super({
      name: 'read_file',
      schema: /* ported schema using Legion's schema package */,
      requiresApproval: false
    });
  }

  async execute(params, signal, updateOutput) {
    const resourceManager = await ResourceManager.getInstance();
    // Port the file reading logic from Gemini CLI's read-file.ts
    // But use ResourceManager for all environment access
    // Use Legion's error patterns
    // Use Legion's schema validation
  }
}
```

#### 11.2.2 EditFileTool (From `/packages/core/src/tools/edit.ts`)
**Source Code to Port**:
- Gemini CLI's smart edit functionality with diff generation
- Search and replace logic with validation
- Backup creation and error recovery

**Legion Implementation**:
- Port all edit logic using Legion's file handling patterns
- Use ResourceManager for file system access
- Implement using Legion's schema validation
- Follow Legion's error handling and security models

#### 11.2.3 ShellTool (From `/packages/core/src/tools/shell.ts`)
**Source Code to Port**:
- Command execution with security controls
- Output streaming and error capture
- Process management and cleanup

**Legion Implementation**:
- Port shell execution logic to Legion patterns
- Use Legion's security and validation frameworks
- Integrate with Legion's streaming capabilities

**Complete Porting Strategy for All Tools**:
1. **Extract Core Logic**: Take the functional code from each Gemini CLI tool
2. **Rewrite Interfaces**: Implement using Legion's tool base classes and patterns
3. **Replace Dependencies**: Use ResourceManager instead of direct environment access
4. **Adapt Schemas**: Convert tool schemas to Legion's schema validation system
5. **Security Integration**: Apply Legion's security and approval patterns

### 11.3 ConversationManager Class
**Purpose**: Manages turn-based conversation flow with context awareness

**Core Features**:
- **Turn Management**: Tracks user inputs, agent responses, and tool executions
- **Context Building**: Assembles relevant context from conversation history and file system
- **Memory Compression**: Automatically summarizes old conversation when approaching limits
- **Stream Processing**: Handles real-time response generation with tool integration

**Context Assembly**:
- Recent conversation turns (configurable window)
- Currently open/modified files
- Project structure overview
- Environment variables and working directory
- Previous tool execution results

### 11.4 Detailed Code Porting Plan for Prompts

#### 11.4.1 System Prompt Porting (From `/packages/core/src/core/prompts.ts`)
**Source Function**: `getCoreSystemPrompt(userMemory?: string): string`

**Gemini CLI Code to Port**:
```typescript
// This is the actual Gemini CLI system prompt logic that needs to be ported
export function getCoreSystemPrompt(userMemory?: string): string {
  // Environment context building
  const directoryContext = getDirectoryContextString();
  const environmentContext = getEnvironmentContext();
  
  // Tool descriptions and capabilities
  const toolDescriptions = /* tool capability descriptions */;
  
  // User memory integration
  const memorySection = userMemory ? `\n\nUser Memory:\n${userMemory}` : '';
  
  return `You are Gemini, a helpful AI coding assistant...${directoryContext}${environmentContext}${toolDescriptions}${memorySection}`;
}
```

**Legion Implementation**:
```javascript
class PromptManager {
  async buildSystemPrompt(userMemory = null) {
    const resourceManager = await ResourceManager.getInstance();
    
    // Port the directory context logic using Legion patterns
    const directoryContext = await this.getDirectoryContext(resourceManager);
    
    // Port environment context using ResourceManager
    const environmentContext = await this.getEnvironmentContext(resourceManager);
    
    // Use Legion's tool registry for tool descriptions
    const toolDescriptions = await this.buildToolDescriptions();
    
    // Port the memory integration logic
    const memorySection = userMemory ? `\n\nUser Memory:\n${userMemory}` : '';
    
    // Port the complete system prompt template
    return `You are Gemini, a helpful AI coding assistant...${directoryContext}${environmentContext}${toolDescriptions}${memorySection}`;
  }
}
```

#### 11.4.2 Compression Prompt Porting (From `getCompressionPrompt()`)
**Source Code to Port**: The complete conversation compression logic and instructions

**Legion Implementation**: Port the compression prompt template and logic, adapting it to work with Legion's memory management patterns

#### 11.4.3 Context Building Services Porting
**Source Code to Port**:
- `getDirectoryContextString()` from `environmentContext.ts`
- `getEnvironmentContext()` from `environmentContext.ts`  
- Tool capability descriptions and formatting logic

**Legion Implementation**: Rewrite all context building functions to use ResourceManager and Legion patterns

### 11.5 WebInterface Components

#### 11.5.1 ChatInterface Actor
**Purpose**: Main conversation display and input handling
**Architecture**: MVVM with Legion's actor framework
**State**: Conversation turns, typing indicators, tool execution status
**Events**: User input, response streaming, tool approval requests

#### 11.5.2 ToolExecutionView Actor
**Purpose**: Real-time tool execution visualization
**Features**: Progress indicators, approval prompts, result display
**Integration**: Direct connection to tool execution queue

#### 11.5.3 FileExplorer Actor
**Purpose**: Project file navigation and editing
**Features**: File tree, syntax highlighting, diff viewing
**Integration**: Integrated with agent's file awareness system

#### 11.5.4 ConfigurationPanel Actor
**Purpose**: Agent settings and tool permissions
**Features**: Tool approval settings, model configuration, UI preferences
**Persistence**: Settings saved through Legion's ResourceManager

## 12. Data Flow Architecture

### 12.1 Message Processing Flow
```
User Input → ConversationManager → PromptManager → LLM Client
     ↓                                                   ↓
Tool Approval ← ToolIntegrationBridge ← Agent Response ←─┘
     ↓                    ↓
Tool Execution → Results Integration → Response Streaming → Web UI
```

### 12.2 Tool Execution Flow
```
Tool Request → Permission Check → User Approval (if needed) → Legion Tool Registry
                     ↓                                              ↓
              Security Validation                            Tool Execution
                     ↓                                              ↓
               Error Handling ←─────────────── Result Processing ←─┘
                     ↓
              Context Integration → Conversation Update
```

### 12.3 Context Management Flow
```
File System Changes → Context Invalidation → Context Rebuild
         ↓                      ↓                   ↓
   Change Tracking      History Compression    Prompt Update
         ↓                      ↓                   ↓
   Agent Awareness ←─── Memory Management ←── Active Context
```

## 13. Success Criteria

### 13.1 Code Porting Requirements Met
- ✅ **All Gemini CLI tools completely ported**: read-file.ts, write-file.ts, edit.ts, shell.ts, grep.ts, glob.ts, ls.ts
- ✅ **All prompts completely ported**: getCoreSystemPrompt(), getCompressionPrompt(), context builders
- ✅ **All core services completely ported**: conversation management, tool scheduling, memory handling
- ✅ **Zero dependencies on Gemini CLI package**: Completely self-contained Legion implementation

### 13.2 Legion Framework Integration Requirements Met
- ✅ **ConfigurableAgent base**: Agent extends Legion's ConfigurableAgent class
- ✅ **ResourceManager integration**: All environment access through ResourceManager singleton
- ✅ **Schema validation**: All JSON validation through Legion's schema package only
- ✅ **Tool registry**: All tools registered and accessed through Legion's tool patterns
- ✅ **MVVM actor framework**: Web UI built with Legion's actor patterns

### 13.3 Functional Requirements Met
- ✅ **Natural language conversations**: Same conversation quality as Gemini CLI
- ✅ **File operations**: Read, write, edit files with identical functionality to Gemini CLI
- ✅ **Shell execution**: Safe command execution with approval system
- ✅ **Context maintenance**: Conversation history and compression identical to Gemini CLI
- ✅ **Streaming responses**: Real-time response generation matching Gemini CLI
- ✅ **Web interface**: Full agent interaction through Legion-pattern web UI

### 13.4 Implementation Standards Met
- ✅ **TDD methodology**: All development follows test-driven approach
- ✅ **Legion coding standards**: All code follows Legion's clean architecture principles
- ✅ **100% test pass rate**: No skipped tests, proper error handling
- ✅ **Security compliance**: Legion's security patterns applied throughout
- ✅ **Resource management**: All resources accessed through proper Legion patterns

### 13.5 Code Porting Success Criteria
- ✅ **Functional equivalence**: Each ported component provides identical functionality
- ✅ **Pattern compliance**: All ported code follows Legion framework patterns
- ✅ **Performance equivalence**: Performance matches or exceeds original Gemini CLI
- ✅ **Maintainability**: Code is more maintainable due to Legion's clean architecture
- ✅ **Extensibility**: Easier to extend due to Legion's modular design

This design document provides the comprehensive foundation for **porting and reimplementing all Gemini CLI code** within Legion's ecosystem, ensuring complete functional equivalence while following Legion's framework patterns and standards.