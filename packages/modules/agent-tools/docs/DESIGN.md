# AgentToolsModule Design

**UI tools for agent planning that integrate seamlessly with the transparent resource handle system**

## Overview

The AgentToolsModule provides UI-specific tools that enable agents to plan rich user interactions involving floating windows, notifications, and resource display. These tools appear in the normal tool registry and work exactly like standard tools, but internally leverage the transparent resource handle system for UI operations.

### Core Concept

Agents can now plan workflows that include UI operations:

```
User: "show me a cat picture"

Agent Planning:
1. generate_image(prompt="cute cat") → catImageHandle
2. display_resource(context, catImageHandle) → floating ImageViewer window

Agent Execution:
- Generates image using existing module tool (normal params)
- Displays image using AgentTool (context + params) - user sees result immediately
```

## Architecture Integration

### Tool Registry Integration

AgentTools appear as **standard tools** in the tool registry with normal metadata:

```javascript
{
  name: "display_resource", 
  description: "Display any resource handle in appropriate viewer",
  category: "ui",
  parameters: {
    resourceHandle: { type: "object", required: true },
    options: { type: "object", optional: true }
  }
}
```

### Context-First Parameter Pattern

**CRITICAL**: All Legion agent tools must ALWAYS take context as the **first parameter**:

```javascript
class DisplayResourceTool extends Tool {
  async execute(context, resourceHandle, options = {}) {
    // Context is ALWAYS first - standard Legion tool pattern
    // resourceHandle and options are normal tool parameters
    await context.resourceService.displayResource(resourceHandle, options);
    return { windowId: resourceHandle.path };
  }
}
```

**Critical: Context is NOT Special Processing**:
- **Context is normal input**: Just like any other tool parameter
- **Always first parameter**: Standard Legion tool convention
- **No special handling**: Agent framework treats it as regular parameter
- **Available in context**: resourceService is available like llmClient, storage, etc.

### Resource Handle System Integration

AgentTools internally use the transparent resource handle system:
- `display_resource` triggers ResourceServerSubActor to create handles
- ResourceClientSubActor creates transparent proxies 
- ResourceWindowManager creates appropriate floating windows
- All existing resource handle architecture works unchanged

## Core Tools Specification

### 1. DisplayResourceTool

**Purpose**: Display any resource in appropriate floating window with default viewer selection

**Interface**:
```javascript
display_resource(context, resourceHandle, options = {})
```

**Parameters**:
- `context` (required): Agent execution context (always first parameter in ALL tools)
- `resourceHandle` (required): Resource handle from previous tool operation
- `options` (optional): Display options object
  - `viewerType`: Override default viewer ("editor", "image", "directory", "auto")
  - `windowId`: Target existing window to replace content (if not provided, creates new window)

**Behavior**:
- Automatically detects resource type from file extension
- Creates new floating window OR replaces content in existing window (if windowId provided)
- Text files → CodeEditor window
- Images → ImageViewer window  
- Directories → DirectoryBrowser window
- **Returns window ID** for future operations on the same window

**Output**:
```javascript
{
  windowId: "unique-window-id", 
  viewerType: "editor",
  resourcePath: resourceHandle.path
}
```

**Agent Guidance**: If the agent plans to update content multiple times, it should remember the windowId to reuse the same window instead of creating multiple windows for related content.

**Agent Planning**:
```
Agent can plan: generate_code(specs) → codeHandle → display_resource(context, codeHandle)
Agent can plan: analyse_picture(imageHandle, prompt) → display_resource(context, imageHandle)
```

### 2. NotifyUserTool

**Purpose**: Show notifications, progress updates, or user queries

**Interface**:
```javascript
notify_user(context, message, type = "info", duration = 3000)
```

**Parameters**:
- `context` (required): Agent execution context (always first parameter in ALL tools)
- `message` (required): Text to display to user
- `type` (optional): "info", "success", "error", "progress", "query"
- `duration` (optional): Display duration in milliseconds (0 = persistent)

**Behavior**:
- "info"/"success"/"error": Toast notification that auto-dismisses
- "progress": Progress indicator for long-running operations  
- "query": User input dialog that returns response
- Uses consistent UI styling with application theme

**Agent Planning**:
```
Agent can plan: notify_user(context, "Processing...", "progress") → long_operation() → notify_user(context, "Complete!", "success")
```

### 3. CloseWindowTool

**Purpose**: Close floating windows programmatically

**Interface**:
```javascript
close_window(context, windowId)
```

**Parameters**:
- `context` (required): Agent execution context (always first parameter in ALL tools)
- `windowId` (required): Window identifier (typically file path)

**Behavior**:
- Closes specified floating window
- Cleans up associated resources and handles
- Returns success status

**Agent Planning**:
```
Agent can plan: display_resource(context, file) → process_data(data) → close_window(context, file)
```

## Context Service Integration

### ResourceService in Context

The agent execution framework provides `context.resourceService` with these methods:

```javascript
context.resourceService = {
  // Display resource in floating window
  displayResource(resourceHandle, options = {}),
  
  // Show notification to user
  showNotification(message, type, duration),
  
  // Close floating window
  closeWindow(windowId),
  
  // Get list of open windows
  getOpenWindows()
}
```

### No Special Configuration Required

AgentTools work exactly like regular tools:
- Loaded from tool registry
- Discovered through normal search
- Planned with using existing planning algorithms  
- Executed using standard tool execution framework
- Only difference: they access `context.resourceService` for UI operations

## Resource Type Detection

### Automatic Viewer Selection

The `display_resource` tool uses the existing ResourceTypeRegistry for intelligent default selection:

```javascript
// Automatic detection (viewerType="auto")
.txt, .js, .json → CodeEditor window
.png, .jpg, .gif → ImageViewer window  
/ (directories) → DirectoryBrowser window
unknown → CodeEditor window (default)
```

### Viewer Override Support

Agents can override default viewer selection:

```javascript
// Force image handle to open in text editor
display_resource(context, imageHandle, {viewerType: "editor"})

// Force text handle to open as image viewer
display_resource(context, textHandle, {viewerType: "image"}) 
```

## Tool Module Structure

### Standard Module Pattern

AgentToolsModule follows the existing Legion tool module pattern:

```
agent-tools/
├── src/
│   ├── AgentToolsModule.js       # Main module export
│   ├── tools/
│   │   ├── DisplayResourceTool.js
│   │   ├── NotifyUserTool.js  
│   │   └── CloseWindowTool.js
│   ├── index.js                  # Module exports
│   └── tools-metadata.json       # Tool registry metadata
└── docs/
    └── DESIGN.md                 # This document
```

### Module Registration

```javascript
// AgentToolsModule.js
export class AgentToolsModule {
  static async create(config = {}) {
    const tools = [
      new DisplayResourceTool(),
      new NotifyUserTool(),
      new CloseWindowTool()
    ];
    
    return { name: 'AgentToolsModule', tools };
  }
}
```

## Agent Planning Benefits

### Rich Workflow Capabilities

Agents can now plan sophisticated UI workflows:

```javascript
// Complex multi-step workflow with UI
User: "Create a summary report and show it to me"

Agent Plan:
1. analyze_data(dataSource) → insights  
2. generate_report(insights) → reportHandle
3. display_resource(context, reportHandle) → windowId
4. notify_user(context, "Report ready for review", "success")
```

### Natural Tool Composition

AgentTools compose naturally with existing tools:

```javascript
// Image analysis workflow with window reuse
1. generate_image("data visualization") → chartHandle
2. display_resource(context, chartHandle) → chartWindowId
3. analyse_picture(chartHandle, "extract insights") → analysisHandle
4. display_resource(context, analysisHandle, {windowId: chartWindowId}) → replace chart with analysis
```

### Zero Framework Changes

The agent planning system requires **no changes** - AgentTools are discovered and planned with using existing mechanisms. The only requirement is that `context.resourceService` is available during tool execution.

## Implementation Requirements

### Context Service Availability

The tool execution framework must provide `context.resourceService` that connects to:
- ResourceServerSubActor (for handle creation)
- ResourceClientSubActor (for window management) 
- ResourceWindowManager (for UI operations)

### Resource Service Interface

```javascript
class ResourceService {
  constructor(resourceServerActor, resourceClientActor, windowManager) {
    this.serverActor = resourceServerActor;
    this.clientActor = resourceClientActor;
    this.windowManager = windowManager;
  }
  
  async displayResource(filePath, viewerType = "auto") {
    // Trigger resource handle creation on server
    // Handle flows through transparent resource handle system
    // Window created automatically by ResourceWindowManager
  }
  
  async showNotification(message, type, duration) {
    // Create notification UI elements
  }
  
  async closeWindow(windowId) {
    // Close window through ResourceWindowManager
  }
}
```

## Key Benefits

1. **Zero Learning Curve**: Tools work exactly like existing tools
2. **Full Plannability**: Agents discover and plan with UI tools naturally
3. **Rich Interactions**: Agents can create sophisticated UI workflows
4. **Transparent Integration**: Leverages existing resource handle system
5. **Extensible**: Easy to add new UI capabilities as tools
6. **Clean Architecture**: No special cases in planning or execution frameworks

This design enables agents to become **UI-capable** while maintaining the clean tool-based planning architecture that makes Legion agents so powerful.