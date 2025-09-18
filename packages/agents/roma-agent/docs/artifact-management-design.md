# Artifact Management System Design

## Executive Summary

This document describes the complete redesign of context management in the ROMA agent, replacing the flawed `previousResults` array system with a proper artifact management system. The new system provides named artifact storage, parameter resolution, and clear separation between conversation history and execution artifacts.

## Problem Statement

The current ROMA agent implementation has critical flaws in how it manages execution context:

1. **No Semantic Structure**: Results are stored as raw JSON in a `previousResults` array
2. **Poor LLM Context**: The LLM only sees the last 3 results as JSON dumps
3. **No Artifact Naming**: Results cannot be referenced by name
4. **No Parameter Resolution**: No way to use previous results as inputs to tools
5. **Mixed Concerns**: Conversation history and execution artifacts are conflated

## Design Goals

1. **Named Artifacts**: All execution results stored with semantic names
2. **Clear Separation**: Conversation history and artifacts managed separately
3. **Generic Resolution**: Universal `@artifact_name` syntax for referencing artifacts
4. **LLM Clarity**: Two distinct prompt sections for conversation and available artifacts
5. **Tool Integration**: LLM specifies output artifacts when using tools
6. **No Backward Compatibility**: Complete replacement of the old system

## Core Concepts

### Artifact Records Are Immutable Descriptors

**CRITICAL DESIGN PRINCIPLE**: An artifact record is an immutable descriptor object that DESCRIBES something. The artifact record itself is NEVER destructured or modified after creation. It contains a `value` field that points to the actual data/object/thing that the artifact describes.

```
┌─────────────────────────────────────┐
│      Artifact Record (Immutable)     │
├─────────────────────────────────────┤
│ type: 'file'                         │
│ value: '/tmp/server.js'         ◄────┼──── The file PATH (not contents!)
│ description: 'Server implementation' │
│ purpose: 'Main server entry point'   │
│ timestamp: 1234567890                │
│ metadata: { ... }                    │
└─────────────────────────────────────┘
         │
         ▼
    Stored as-is in Map
    NEVER destructured
    NEVER modified
```

When a tool needs the actual data, ONLY the `value` field is extracted and passed to the tool. The artifact record itself remains intact in the registry.

## System Architecture

### Core Components

```
┌─────────────────────────────────────────────────┐
│                ExecutionContext                  │
├─────────────────────────────────────────────────┤
│ artifacts: Map<string, ArtifactRecord>          │
│ conversationHistory: ConversationMessage[]       │
├─────────────────────────────────────────────────┤
│ + addArtifact(name, artifactRecord)             │
│ + getArtifact(name) → ArtifactRecord            │
│ + getArtifactValue(name) → artifact.value       │
│ + listArtifacts() → [name, ArtifactRecord][]    │
└─────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────┐
│            ExecutionStrategy (base)              │
├─────────────────────────────────────────────────┤
│ + resolveToolInputs(inputs, context)            │
│ + executeToolWithArtifacts(toolCall, context)   │
│ + formatConversationHistory(context)            │
│ + formatArtifactsCatalog(context)               │
└─────────────────────────────────────────────────┘
```

### Data Structures

#### Artifact Record Structure (IMMUTABLE)
```javascript
// This entire object is stored AS-IS in the Map and NEVER destructured
{
  type: string,           // 'file', 'data', 'process', 'config', etc.
  value: any,             // The thing itself: filepath, data object, process ID, etc.
  description: string,    // What this artifact record DESCRIBES
  purpose: string,        // Why this artifact exists/is needed
  timestamp: number,      // When created
  metadata: {             // Additional context
    toolName?: string,    // Tool that created it
    success?: boolean,    // Execution success
    nodeId?: string,      // BT node that created it
    size?: number,        // For files: file size in bytes
    ...                   // Other metadata
  }
}

// Examples of what 'value' contains for different types:
// type: 'file'     -> value: '/path/to/file.js' (the path, NOT contents)
// type: 'data'     -> value: { key: 'value' } (the actual data object)
// type: 'process'  -> value: { pid: 12345, port: 3000 } (process info)
// type: 'config'   -> value: { host: 'localhost', port: 8080 } (config object)
```

#### Conversation Message Structure
```javascript
{
  role: 'user' | 'assistant' | 'system',
  content: string,        // May contain @artifact_name references
  timestamp: number
}
```

#### Tool Call Structure (from LLM)
```javascript
{
  tool: string,           // Tool name
  inputs: {               // Input parameters
    param1: any,          // Direct value
    param2: "@artifact",  // Artifact reference
    ...
  },
  outputs: [              // Output specifications
    {
      name: string,       // Artifact name for this output
      type: string,       // Type of THIS output: 'file', 'data', 'process', etc.
      description: string,// What this output is
      purpose: string     // Why this output is needed
    },
    ...
  ]
}
```

## Implementation Details

### 1. Artifact Registry

The artifact registry is a simple Map that stores artifact records WITHOUT ANY MODIFICATION:

```javascript
class ExecutionContext {
  constructor(parent = null) {
    // Artifact registry - inherits from parent if exists
    this.artifacts = new Map(parent?.artifacts || []);
    
    // Conversation history - separate from artifacts
    this.conversationHistory = [...(parent?.conversationHistory || [])];
    
    // REMOVED: previousResults, sharedState
  }
  
  addArtifact(name, artifactRecord) {
    if (!name || typeof name !== 'string') {
      throw new Error('Artifact name must be a non-empty string');
    }
    if (!artifactRecord || !artifactRecord.type || !artifactRecord.description) {
      throw new Error('Artifact must have type and description');
    }
    if (artifactRecord.value === undefined) {
      throw new Error('Artifact must have a value field (the actual data)');
    }
    
    // Store the ENTIRE artifact record AS-IS - NO DESTRUCTURING
    // The artifact record is IMMUTABLE once created
    this.artifacts.set(name, artifactRecord);
  }
  
  // Returns the ENTIRE artifact record (NOT just the value)
  getArtifact(name) {
    return this.artifacts.get(name);
  }
  
  // Returns ONLY the value field (the actual data) for tool execution
  getArtifactValue(name) {
    const artifactRecord = this.artifacts.get(name);
    return artifactRecord?.value;  // Extract ONLY the value for tool use
  }
  
  // Returns all artifact records (NOT destructured)
  listArtifacts() {
    return Array.from(this.artifacts.entries());
  }
}
```

### 2. Parameter Resolution

Generic resolution of `@artifact_name` references - extracts ONLY the `value` field from artifact records:

```javascript
// In ExecutionStrategy base class
resolveToolInputs(inputs, context) {
  if (!inputs || typeof inputs !== 'object') {
    return inputs;
  }
  
  const resolved = {};
  
  for (const [key, value] of Object.entries(inputs)) {
    if (typeof value === 'string' && value.startsWith('@')) {
      // Artifact reference - get the artifact record
      const artifactName = value.substring(1);
      const artifactRecord = context.getArtifact(artifactName);
      
      if (!artifactRecord) {
        throw new Error(`Artifact not found: @${artifactName}`);
      }
      
      // Extract ONLY the value field (the actual data) from the record
      // The artifact record itself is NEVER passed to tools
      resolved[key] = artifactRecord.value;
    } else if (Array.isArray(value)) {
      // Recursively resolve arrays
      resolved[key] = value.map(item => 
        typeof item === 'string' && item.startsWith('@') 
          ? context.getArtifactValue(item.substring(1))  // Extract value only
          : item
      );
    } else if (typeof value === 'object' && value !== null) {
      // Recursively resolve nested objects
      resolved[key] = this.resolveToolInputs(value, context);
    } else {
      // Direct value
      resolved[key] = value;
    }
  }
  
  return resolved;
}
```

### 3. Tool Execution with Artifact Storage

Creating and storing artifact records - the COMPLETE record is stored, never destructured:

```javascript
async executeToolWithArtifacts(toolCall, context) {
  const { tool: toolName, inputs, outputs } = toolCall;
  
  // Step 1: Resolve artifact references in inputs
  // This extracts ONLY the value fields from referenced artifacts
  const resolvedInputs = this.resolveToolInputs(inputs, context);
  
  // Step 2: Get and execute the tool with the extracted VALUES
  const tool = await this.toolRegistry.getTool(toolName);
  if (!tool) {
    throw new Error(`Tool not found: ${toolName}`);
  }
  
  const result = await tool.execute(resolvedInputs);
  
  // Step 3: Create and store NEW artifact records for outputs
  if (outputs && Array.isArray(outputs)) {
    for (const outputSpec of outputs) {
      // Extract the specific output value
      // Tools may return { data: { output1: ..., output2: ... } }
      // or { data: singleValue } or just the value directly
      let outputValue;
      
      if (result.data && typeof result.data === 'object') {
        // Try to get named property from data
        outputValue = result.data[outputSpec.name] || result.data;
      } else if (result.data !== undefined) {
        outputValue = result.data;
      } else {
        outputValue = result;
      }
      
      // Create a NEW artifact record that DESCRIBES this output
      // Each output has its own specific type (file, data, process, etc.)
      const artifactRecord = {
        type: outputSpec.type,  // The SPECIFIC type of THIS output
        value: outputValue,  // THE ACTUAL DATA from the tool
        description: outputSpec.description,  // What this artifact IS
        purpose: outputSpec.purpose || outputSpec.description,  // Why it exists
        timestamp: Date.now(),
        metadata: {
          toolName: toolName,
          success: result.success !== undefined ? result.success : true,
          inputArtifacts: this.extractArtifactReferences(inputs),
          ...result.metadata
        }
      };
      
      // Store the ENTIRE artifact record AS-IS in the Map
      context.addArtifact(outputSpec.name, artifactRecord);
      
      // Add to conversation history with artifact reference
      context.conversationHistory.push({
        role: 'assistant',
        content: `Executed ${toolName} and stored output as @${outputSpec.name}`,
        timestamp: Date.now()
      });
    }
  }
  
  return result;
}

// Helper to extract artifact references from inputs
extractArtifactReferences(inputs) {
  const refs = [];
  const extract = (obj) => {
    if (typeof obj === 'string' && obj.startsWith('@')) {
      refs.push(obj.substring(1));
    } else if (Array.isArray(obj)) {
      obj.forEach(extract);
    } else if (typeof obj === 'object' && obj !== null) {
      Object.values(obj).forEach(extract);
    }
  };
  extract(inputs);
  return refs;
}
```

### 4. Prompt Formatting

Two separate sections for LLM prompts:

```javascript
// In ExecutionStrategy base class
formatConversationHistory(context, limit = 10) {
  const messages = context.conversationHistory.slice(-limit);
  
  if (messages.length === 0) {
    return "No previous conversation.";
  }
  
  return messages.map(msg => {
    const role = msg.role === 'user' ? 'User' : 
                 msg.role === 'assistant' ? 'Assistant' : 'System';
    return `${role}: ${msg.content}`;
  }).join('\n');
}

formatArtifactsCatalog(context) {
  const artifacts = context.listArtifacts();  // Returns [name, artifactRecord] pairs
  
  if (artifacts.length === 0) {
    return "No artifacts available.";
  }
  
  // Format each artifact record for display (the record itself, NOT destructured)
  const catalog = artifacts.map(([name, artifactRecord]) => {
    // We access properties of the artifact record for DISPLAY only
    // The record itself remains intact in the Map
    const size = this.getArtifactSize(artifactRecord.value);
    return `- @${name} (${artifactRecord.type}): ${artifactRecord.description}\n` +
           `  Purpose: ${artifactRecord.purpose}\n` +
           `  Created: ${new Date(artifactRecord.timestamp).toISOString()}\n` +
           `  Size: ${size}`;
  }).join('\n');
  
  return `Available Artifacts (${artifacts.length}):\n${catalog}`;
}

// Helper to get human-readable size
getArtifactSize(value) {
  if (value === null || value === undefined) return 'empty';
  if (typeof value === 'string') return `${value.length} chars`;
  if (typeof value === 'number') return 'number';
  if (typeof value === 'boolean') return 'boolean';
  if (Array.isArray(value)) return `array[${value.length}]`;
  if (typeof value === 'object') {
    const keys = Object.keys(value);
    return `object{${keys.length} keys}`;
  }
  return typeof value;
}
```

### 5. LLM Prompt Template

```javascript
buildPrompt(task, context) {
  return `
## Conversation History
${this.formatConversationHistory(context)}

## Available Artifacts
${this.formatArtifactsCatalog(context)}

## Current Task
${task.description}

## Instructions

When you need to use a tool, specify it in this format:
{
  "tool": "tool_name",
  "inputs": {
    "parameter1": "direct value or @artifact_name",
    "parameter2": "@another_artifact"
  },
  "outputs": [
    {
      "name": "output_artifact_name",
      "type": "file|data|process|config|etc",
      "description": "Clear description of what this output is",
      "purpose": "Why this output is needed for the task"
    }
  ]
}

Important:
- Reference existing artifacts using @artifact_name in tool inputs
- Always specify meaningful names for outputs
- Each output MUST have a specific type (file, data, process, config, etc.)
- Include clear descriptions and purposes for outputs
- Artifact names should be descriptive (e.g., "server_config", "user_data", "api_response")

Your response:`;
}
```

## Migration Strategy

### Phase 1: Core Implementation
1. Implement new ExecutionContext with artifacts Map
2. Add artifact management methods
3. Implement parameter resolution in ExecutionStrategy base class
4. Add prompt formatting methods

### Phase 2: Strategy Updates
1. Update RecursiveExecutionStrategy to use artifacts
2. Update AtomicExecutionStrategy for artifact storage
3. Update ParallelExecutionStrategy for artifact flow
4. Update SequentialExecutionStrategy for artifact chaining

### Phase 3: Testing & Validation
1. Update all existing tests to use artifacts
2. Add tests for parameter resolution
3. Add tests for artifact storage and retrieval
4. Add tests for prompt formatting
5. Ensure 100% test pass rate

### Files to Modify

1. **Core Files**
   - `/core/ExecutionContext.js` - Complete rewrite
   - `/core/strategies/ExecutionStrategy.js` - Add artifact methods
   
2. **Strategy Files**
   - `/core/strategies/RecursiveExecutionStrategy.js`
   - `/core/strategies/AtomicExecutionStrategy.js`
   - `/core/strategies/ParallelExecutionStrategy.js`
   - `/core/strategies/SequentialExecutionStrategy.js`

3. **Test Files**
   - All files in `/__tests__/` that reference ExecutionContext
   - Add new test files for artifact management

## Example Usage

### Key Principle: Artifact Records vs Values

```javascript
// Example 1: File artifact
context.addArtifact("server_file", {
  type: "file",
  value: "/tmp/server.js",  // <-- The file PATH (not contents!)
  description: "Express server implementation",
  purpose: "Main server entry point",
  timestamp: 1234567890,
  metadata: { size: 2048, encoding: 'utf-8' }
});

// Example 2: Data artifact
context.addArtifact("config", {
  type: "data",
  value: { port: 3000, host: "localhost" },  // <-- The actual data object
  description: "Server configuration",
  purpose: "Configure the Express server",
  timestamp: 1234567890,
  metadata: { source: 'user_input' }
});

// The ENTIRE records above are stored in the Map unchanged

// When a tool needs the file:
const fileRecord = context.getArtifact("server_file");  // Returns the ENTIRE record
const filePath = context.getArtifactValue("server_file");  // Returns ONLY "/tmp/server.js"

// When resolving @server_file in tool inputs:
// Input: { filepath: "@server_file" }
// Resolved: { filepath: "/tmp/server.js" }  // The path is passed to the tool

// When resolving @config in tool inputs:
// Input: { config: "@config" }
// Resolved: { config: { port: 3000, host: "localhost" } }  // The data object is passed
```

### Task Decomposition with Artifacts

```javascript
// LLM decomposes task and specifies artifact flow
{
  "subtasks": [
    {
      "description": "Write server code to file",
      "tool": "file_write",
      "inputs": {
        "filepath": "/tmp/server.js",
        "content": "const express = require('express');\n..."
      },
      "outputs": [
        {
          "name": "server_file",
          "type": "file",
          "description": "Server implementation file",
          "purpose": "File containing the Express server code"
        }
      ]
      // This creates artifact: { type: 'file', value: '/tmp/server.js', ... }
    },
    {
      "description": "Read configuration file",
      "tool": "file_read",
      "inputs": {
        "filepath": "/config/app.json"
      },
      "outputs": [
        {
          "name": "app_config",
          "type": "data",
          "description": "Application configuration data",
          "purpose": "Configuration needed for server setup"
        }
      ]
      // This creates artifact: { type: 'data', value: {port: 3000, ...}, ... }
    },
    {
      "description": "Start the server",
      "tool": "execute_command",
      "inputs": {
        "command": "node",
        "args": ["@server_file"],  // Resolves to "/tmp/server.js"
        "env": "@app_config"       // Resolves to the config object
      },
      "outputs": [
        {
          "name": "server_process",
          "type": "process",
          "description": "Running server process",
          "purpose": "The active server handling requests"
        }
      ]
      // This creates artifact: { type: 'process', value: {pid: 12345, port: 3000}, ... }
    }
  ]
}
```

### Complete Conversation Flow

```
User: Create a web server for my application