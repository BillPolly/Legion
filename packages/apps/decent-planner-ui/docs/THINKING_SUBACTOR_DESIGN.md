# ThinkingSubActor Design Document

## Overview

Implement agent thinking indicator using the proven actor request/handle pattern. The thinking display will show inline progress during complex agent workflows without breaking any existing functionality.

## Architecture

### Current System
```
RootServerActor
├── ChatServerToolAgent ↔ ChatClientSubActor
├── ResourceServerSubActor ↔ ResourceClientSubActor  
├── ToolRegistryServerSubActor ↔ ToolRegistryClientSubActor
└── PlannerServerSubActor ↔ PlannerClientSubActor
```

### Proposed Addition
```
ChatServerToolAgent
└── ThinkingServerSubActor (lazy-created) ↔ ThinkingClientSubActor
                                                     ↓
                                            Injects inline thinking messages
                                                     ↓
                                            ChatClientSubActor chat flow
```

## Request/Handle Protocol

### 1. Thinking Capability Request
```javascript
// ChatClientSubActor (when user sends complex message)
this.remoteActor.receive('thinking:request', { 
  sessionId: 'chat-session-123',
  workflowType: 'agent-processing' 
})
```

### 2. Thinking Handle Response
```javascript  
// ChatServerToolAgent responds
this.remoteActor.receive('thinking:handle', {
  thinkingActorId: 'thinking-actor-456',
  sessionId: 'chat-session-123',
  remoteEndpoint: thinkingServerInstance
})
```

### 3. Point-to-Point Connection
```javascript
// ChatClientSubActor creates thinking sub-actor  
this.thinkingSubActor = new ThinkingClientSubActor()
this.thinkingSubActor.setRemoteActor(remoteThinkingServer)
```

## Event Flow

### Agent Processing Events
```
ToolUsingChatAgent events → ChatServerToolAgent.forwardAgentEvent()
                                    ↓
                          ThinkingServerSubActor.receive()
                                    ↓ (filters & converts)
                          ThinkingClientSubActor.receive()
                                    ↓
                          Inline thinking message in chat
```

### Message Filtering
- **tool-need-analysis** → "🤔 Analyzing your request..."
- **tool-sequence-planning** → "📋 Planning tool sequence..."  
- **user-response-generation** → "💭 Preparing response..."
- **Simple responses** → No thinking display

## UI Integration

### Inline Chat Flow
```
User: "generate a cat picture"
🧠 Agent Thinking (expandable)
  🤔 Analyzing your request... 23:45:12
  📋 Planning tool sequence... 23:45:15
  🔧 Executing generate_image... 23:45:18
▼ Agent completed processing 23:45:20
Agent: "I've generated a cat image for you!"
```

## Implementation Details

### ThinkingServerSubActor
- Receives filtered agent events from ChatServerToolAgent
- Converts technical events to user-friendly progress messages
- Manages workflow start/completion detection
- Sends thinking updates to remote client

### ThinkingClientSubActor  
- Receives thinking updates from server
- Creates special "thinking" message in chat flow
- Uses ThinkingComponent for collapsible display
- Auto-collapses when workflow completes

## Zero Breaking Changes Guarantee

1. **No modifications** to existing actors' receive() methods
2. **No changes** to existing chat message handling  
3. **No changes** to tool execution or agent processing
4. **Additive only** - new message types, new actors
5. **Lazy creation** - thinking actors only exist when needed
6. **Can be disabled** - don't send thinking:request

## Testing Strategy

1. **Isolated Testing**: Test thinking actors independently
2. **Simple Response Testing**: Verify no thinking appears for basic queries
3. **Complex Workflow Testing**: Verify thinking appears and collapses  
4. **Regression Testing**: Ensure existing functionality unchanged
5. **UAT**: Full user acceptance testing with cat generation workflow

## Technical Implementation

### ChatServerToolAgent Changes
```javascript
// Add to receive() method
case 'thinking:request':
  this.createThinkingSubActor(data);
  break;

// Add to forwardAgentEvent() - parallel sending
forwardAgentEvent(eventType, data) {
  // Existing: send to chat
  this.parentActor.sendToSubActor('chat', `agent-${eventType}`, data);
  
  // New: send to thinking if exists
  if (this.thinkingSubActor) {
    this.thinkingSubActor.receive('agent-event', { eventType, data });
  }
}
```

### ChatClientSubActor Changes  
```javascript
// Add to receive() method
case 'thinking:handle':
  this.createThinkingSubActor(data);
  break;

// ThinkingClientSubActor injects thinking messages
// into this.state.messages array with special type
```

### Message Types
- **thinking-start**: Begin thinking indicator
- **thinking-step**: Update with progress step  
- **thinking-complete**: Collapse and finalize
- **thinking-error**: Show error state

---

**Ready for implementation**: This design maintains architectural consistency while adding thinking capability as a completely independent concern using proven patterns.