# Cerebrate - Design Document

## Executive Summary

Cerebrate is a Chrome DevTools extension that provides AI-powered frontend debugging capabilities through integration with the Legion Agent system. It establishes a WebSocket connection between Chrome DevTools and a server hosting the Legion Agent, enabling real-time debugging, code analysis, and intelligent assistance during frontend development.

## Architecture Overview

### High-Level Architecture

```
┌─────────────────────────────┐     WebSocket      ┌──────────────────────────────┐
│      Chrome Browser         │    Connection      │     Debug Server            │
│  ┌─────────────────────────┐│                    │  ┌─────────────────────────┐ │
│  │   DevTools Extension    ││ ←──────────────────→ │  │    Legion Agent         │ │
│  │  - Debug Panel          ││                    │  │  - Tool Execution       │ │
│  │  - WebSocket Client     ││                    │  │  - Code Analysis        │ │
│  │  - Command Interface    ││                    │  │  - Error Detection      │ │
│  └─────────────────────────┘│                    │  └─────────────────────────┘ │
└─────────────────────────────┘                    │  ┌─────────────────────────┐ │
                                                   │  │   WebSocket Server      │ │
                                                   │  │  - Connection Manager   │ │
                                                   │  │  - Message Router       │ │
                                                   │  │  - Protocol Handler     │ │
                                                   │  └─────────────────────────┘ │
                                                   └──────────────────────────────┘
```

### Component Relationships

1. **Chrome DevTools Extension** creates a custom panel in DevTools
2. **WebSocket Client** establishes and maintains connection to debug server
3. **Debug Server** hosts the Legion Agent and manages WebSocket connections
4. **Legion Agent** provides AI-powered debugging and analysis capabilities
5. **Message Router** handles bidirectional communication between components

## System Components

### 1. Chrome DevTools Extension

#### Structure
```
extension/
├── manifest.json           # Chrome extension manifest v3
├── devtools.js            # DevTools page entry point  
├── panel.html             # Debug panel UI
├── panel.js               # Panel logic and WebSocket client
├── background.js          # Background service worker
├── content.js             # Content script for page interaction
└── assets/                # Icons, CSS, and static assets
```

#### Key Features
- **Custom DevTools Panel**: Dedicated debugging interface within Chrome DevTools
- **WebSocket Client**: Persistent connection to debug server
- **Command Interface**: UI for sending debugging commands to Legion Agent
- **Real-time Updates**: Live display of agent responses and debugging information
- **Page Context Access**: Ability to interact with the current page's DOM and JavaScript

#### Permissions Required
```json
{
  "permissions": [
    "activeTab",
    "webNavigation", 
    "storage"
  ],
  "host_permissions": [
    "http://localhost/*",
    "https://localhost/*"
  ]
}
```

### 2. Debug Server with Legion Agent

#### Structure
```
server/
├── debug-server.js        # Main server with WebSocket endpoint
├── agent-controller.js    # Interface between WebSocket and Legion Agent
├── message-router.js      # Routes and validates messages
├── connection-manager.js  # Manages WebSocket connections
├── protocol/              # Communication protocol definitions
│   ├── commands.js        # Available debug commands
│   ├── responses.js       # Response format definitions
│   └── events.js          # Event types and handlers
└── test-server.js         # Simple test server for development
```

#### Core Functionality
- **WebSocket Server**: Handles multiple DevTools connections
- **Legion Agent Integration**: Embedded agent for debugging operations
- **Message Processing**: Routes commands between DevTools and agent
- **Session Management**: Maintains debugging sessions per connection
- **Error Handling**: Robust error recovery and reporting

### 3. Communication Protocol

#### Message Format
```json
{
  "id": "unique-message-id",
  "type": "command|response|event",
  "timestamp": "ISO-8601-datetime",
  "payload": {
    "command": "debug_command_name",
    "parameters": {...},
    "data": {...}
  }
}
```

#### Command Types
- **`inspect_element`**: Analyze specific DOM elements
- **`analyze_code`**: AI analysis of JavaScript/CSS code
- **`debug_error`**: Investigate JavaScript errors
- **`performance_check`**: Performance analysis and suggestions
- **`accessibility_audit`**: Accessibility compliance check
- **`optimize_code`**: Code optimization suggestions

#### Response Types
- **`command_result`**: Successful command execution result
- **`error_response`**: Error information and recovery suggestions
- **`progress_update`**: Long-running operation progress
- **`agent_suggestion`**: Proactive suggestions from agent

### 4. Integration Points

#### Legion Agent Integration
```javascript
// Agent Controller Interface
class AgentController {
  constructor(agent) {
    this.agent = agent; // Legion Agent instance
    this.activeSession = null;
  }

  async executeCommand(command, parameters) {
    // Route command to appropriate agent tool
    // Handle response formatting
    // Manage session state
  }
}
```

#### Aiur MCP Server Integration
- **Tool Discovery**: Automatically discover available debugging tools
- **Handle Management**: Use Aiur handles for debugging session state
- **Tool Coordination**: Coordinate multiple tools for complex debugging tasks

## Technical Specifications

### WebSocket Server Implementation

#### Server Configuration
```javascript
const server = new WebSocket.Server({
  port: 9222, // Chrome DevTools standard port
  perMessageDeflate: false,
  maxPayload: 1024 * 1024 // 1MB max message size
});
```

#### Connection Lifecycle
1. **Handshake**: Establish WebSocket connection
2. **Authentication**: Validate connection (development mode)
3. **Session Creation**: Create debugging session
4. **Command Processing**: Handle incoming debug commands
5. **Cleanup**: Clean up resources on disconnect

### Chrome Extension Implementation

#### Manifest v3 Configuration
```json
{
  "manifest_version": 3,
  "name": "Cerebrate",
  "version": "1.0.0",
  "devtools_page": "devtools.html",
  "background": {
    "service_worker": "background.js"
  },
  "content_scripts": [{
    "matches": ["<all_urls>"],
    "js": ["content.js"]
  }]
}
```

#### DevTools Panel Integration
```javascript
// devtools.js
chrome.devtools.panels.create(
  "Cerebrate",
  "icon.png",
  "panel.html",
  (panel) => {
    // Panel initialization
  }
);
```

### Message Routing Architecture

#### Command Processing Flow
```
DevTools Panel → WebSocket Client → Server → Message Router → Agent Controller → Legion Agent
     ↑                                                                              ↓
Response Handler ← WebSocket Server ← Message Router ← Agent Controller ← Tool Execution
```

#### Error Handling Strategy
- **Connection Errors**: Automatic reconnection with exponential backoff
- **Command Errors**: Graceful error reporting with recovery suggestions
- **Agent Errors**: Error context preservation and debugging assistance
- **Protocol Errors**: Message validation and format correction

## Development Workflow

### Local Development Setup

1. **Start Debug Server**:
   ```bash
   cd packages/code-gen/devtools-debug-plugin
   npm run dev
   ```

2. **Build Extension**:
   ```bash
   npm run build:extension
   ```

3. **Load Extension in Chrome**:
   - Navigate to `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select the built extension directory

4. **Test with Sample Page**:
   ```bash
   npm run serve:test
   ```

### Testing Strategy

#### Unit Tests
- WebSocket server functionality
- Message routing and validation
- Agent controller interface
- Extension component logic

#### Integration Tests
- End-to-end message flow
- Agent command execution
- Error handling scenarios
- Connection lifecycle management

#### Manual Testing
- Chrome extension loading and panel creation
- WebSocket connection establishment
- Debug command execution
- Real-time update functionality

## Security Considerations

### Chrome Extension Security
- **Content Security Policy**: Strict CSP for extension pages
- **Permission Minimization**: Request only necessary permissions
- **Message Sanitization**: Validate all incoming messages from web pages

### WebSocket Security
- **Origin Validation**: Verify connection origins
- **Message Validation**: Schema-based message validation
- **Rate Limiting**: Prevent command flooding
- **Session Management**: Secure session handling

### Agent Security
- **Sandboxing**: Limit agent capabilities to debugging context
- **Input Validation**: Sanitize all command parameters
- **Resource Limits**: Prevent resource exhaustion
- **Audit Logging**: Log all debugging operations

## Performance Considerations

### WebSocket Optimization
- **Message Batching**: Batch related messages for efficiency
- **Compression**: Use WebSocket compression for large payloads
- **Connection Pooling**: Reuse connections when possible
- **Heartbeat**: Maintain connection health with periodic pings

### Extension Performance
- **Lazy Loading**: Load panel components on demand
- **Memory Management**: Clean up resources on tab close
- **Event Throttling**: Throttle high-frequency events
- **Background Processing**: Use service worker for heavy operations

### Agent Performance
- **Tool Caching**: Cache frequently used tool results
- **Async Operations**: Non-blocking command execution
- **Resource Monitoring**: Monitor CPU and memory usage
- **Timeout Handling**: Prevent long-running operations from blocking

## Future Enhancements

### Phase 1: Core Debugging
- Basic DOM inspection and analysis
- JavaScript error investigation
- Simple code optimization suggestions

### Phase 2: Advanced Analysis
- Performance profiling and optimization
- Accessibility auditing and fixes
- Cross-browser compatibility checking

### Phase 3: AI-Powered Features
- Predictive debugging suggestions
- Automated test generation
- Smart refactoring recommendations

### Phase 4: Team Collaboration
- Shared debugging sessions
- Team debugging analytics
- Integration with development workflows

## Risk Mitigation

### Technical Risks
- **WebSocket Stability**: Implement robust reconnection logic
- **Extension Updates**: Handle Chrome extension API changes
- **Agent Reliability**: Comprehensive error handling and recovery
- **Performance Impact**: Monitor and optimize resource usage

### User Experience Risks
- **Learning Curve**: Provide comprehensive documentation and tutorials
- **Integration Complexity**: Simplify setup and configuration
- **Feature Overload**: Progressive feature disclosure

### Operational Risks
- **Maintenance Burden**: Automate testing and deployment
- **Compatibility Issues**: Test across Chrome versions and platforms
- **Support Requirements**: Provide clear troubleshooting guides

## Success Metrics

### Technical Metrics
- WebSocket connection stability (>99% uptime)
- Command response time (<500ms average)
- Extension load time (<2s)
- Memory usage (<50MB per session)

### User Metrics
- User adoption rate
- Feature usage frequency
- Error rate and resolution time
- User satisfaction scores

### Business Metrics
- Development productivity improvement
- Bug detection and resolution rate
- Code quality metrics improvement
- Developer tool engagement

---

## WebSocket API Reference

### Protocol Specification

**Endpoint**: `ws://localhost:9222/debug`  
**Protocol**: WebSocket with JSON message format

### Message Structure

All messages follow a standardized JSON format:

```json
{
  "id": "uuid-v4-string",
  "type": "command|response|event|error",
  "timestamp": "2024-01-01T12:00:00.000Z",
  "session": "session-id-string",
  "payload": {
    // Message-specific content
  }
}
```

#### Base Fields
- **`id`** (string): Unique identifier for message correlation
- **`type`** (string): Message type classification
- **`timestamp`** (string): ISO 8601 timestamp
- **`session`** (string): Session identifier for multi-session support
- **`payload`** (object): Message-specific data

### Command Messages

Commands sent from DevTools extension to debug server.

#### DOM Inspection Commands

**`inspect_element`** - Analyze a specific DOM element and provide insights:
```json
{
  "payload": {
    "command": "inspect_element",
    "parameters": {
      "selector": ".my-component",
      "include_styles": true,
      "include_events": true,
      "depth": 2
    }
  }
}
```

**`analyze_dom_tree`** - Analyze DOM structure and identify potential issues:
```json
{
  "payload": {
    "command": "analyze_dom_tree",
    "parameters": {
      "root_selector": "body",
      "max_depth": 10,
      "checks": ["accessibility", "performance", "semantics"]
    }
  }
}
```

#### Code Analysis Commands

**`analyze_javascript`** - Analyze JavaScript code for errors, performance, and best practices:
```json
{
  "payload": {
    "command": "analyze_javascript",
    "parameters": {
      "code": "function example() { ... }",
      "context": "browser",
      "checks": ["syntax", "performance", "security", "best-practices"]
    }
  }
}
```

**`analyze_css`** - Analyze CSS for optimization and compatibility:
```json
{
  "payload": {
    "command": "analyze_css",
    "parameters": {
      "css": ".selector { property: value; }",
      "target_browsers": ["chrome >= 90", "firefox >= 85"],
      "checks": ["compatibility", "performance", "accessibility"]
    }
  }
}
```

#### Error Investigation Commands

**`debug_error`** - Investigate JavaScript errors with AI assistance:
```json
{
  "payload": {
    "command": "debug_error",
    "parameters": {
      "error": {
        "message": "TypeError: Cannot read property 'foo' of undefined",
        "stack": "Error stack trace...",
        "line": 42,
        "column": 15,
        "filename": "app.js"
      },
      "context": {
        "variables": {...},
        "function_scope": "handleClick"
      }
    }
  }
}
```

#### Performance & Accessibility Commands

**`performance_audit`** - Comprehensive performance analysis:
```json
{
  "payload": {
    "command": "performance_audit",
    "parameters": {
      "metrics": {
        "fcp": 1200,
        "lcp": 2500,
        "cls": 0.1,
        "fid": 50
      },
      "analyze_bundle": true,
      "suggest_optimizations": true
    }
  }
}
```

**`accessibility_audit`** - Accessibility compliance check:
```json
{
  "payload": {
    "command": "accessibility_audit",
    "parameters": {
      "standards": ["WCAG2.1-AA", "WCAG2.2-AA"],
      "scope": "full-page",
      "include_suggestions": true
    }
  }
}
```

### Response Messages

#### Standard Success Response
```json
{
  "payload": {
    "status": "success",
    "command": "inspect_element",
    "data": {
      "element": {
        "tag": "div",
        "classes": ["my-component", "active"],
        "attributes": {...},
        "computed_styles": {...}
      },
      "analysis": {
        "accessibility_score": 85,
        "performance_impact": "low",
        "issues": [],
        "suggestions": [
          "Consider adding ARIA labels for better accessibility"
        ]
      }
    },
    "metadata": {
      "execution_time": 150,
      "agent_model": "claude-3-sonnet",
      "confidence": 0.95
    }
  }
}
```

#### Error Responses
```json
{
  "type": "error",
  "payload": {
    "error_code": "INVALID_SELECTOR",
    "error_message": "CSS selector is invalid or element not found",
    "details": {
      "selector": ".invalid[selector",
      "validation_error": "Unclosed bracket in selector"
    },
    "suggestions": [
      "Check selector syntax",
      "Ensure element exists in DOM"
    ]
  }
}
```

**Common Error Codes:**
- `INVALID_COMMAND`: Unrecognized command
- `INVALID_PARAMETERS`: Invalid or missing parameters
- `SELECTOR_NOT_FOUND`: CSS selector matches no elements
- `AGENT_ERROR`: Internal agent processing error
- `TIMEOUT`: Command execution timeout
- `SESSION_EXPIRED`: Debug session has expired

### Event Messages

Real-time events sent from server to DevTools extension:

**Progress Events:**
```json
{
  "payload": {
    "event_type": "progress_update",
    "command_id": "cmd-001",
    "progress": {
      "current": 3,
      "total": 10,
      "step": "Analyzing CSS rules",
      "percentage": 30
    }
  }
}
```

**Agent Suggestion Events:**
```json
{
  "payload": {
    "event_type": "agent_suggestion",
    "suggestion": {
      "type": "optimization",
      "title": "Bundle Size Optimization Opportunity",
      "description": "Detected large unused dependencies in bundle",
      "priority": "medium",
      "actions": [
        {
          "title": "Remove unused lodash functions",
          "command": "optimize_imports",
          "parameters": {...}
        }
      ]
    }
  }
}
```

### Session Management

**Session Creation** (automatic on WebSocket connection):
```json
{
  "session_id": "session-001",
  "created_at": "2024-01-01T12:00:00.000Z",
  "expires_at": "2024-01-01T16:00:00.000Z",
  "capabilities": [
    "dom_inspection",
    "code_analysis", 
    "error_debugging",
    "performance_audit"
  ]
}
```

**Keep Alive** (heartbeat messages):
```json
{
  "payload": {
    "command": "ping"
  }
}
```

### Rate Limiting

**Default Limits:**
- Commands: 60 per minute
- Events: No limit
- Message size: 1MB maximum
- Concurrent commands: 5 per session

**Rate Limit Response:**
```json
{
  "type": "error",
  "payload": {
    "error_code": "RATE_LIMIT_EXCEEDED",
    "error_message": "Too many requests",
    "retry_after": 30,
    "limits": {
      "requests_per_minute": 60,
      "current_usage": 61
    }
  }
}
```

---

## Setup and Installation Guide

### Prerequisites

**System Requirements:**
- Node.js >= 18.0.0
- npm >= 8.0.0
- Chrome/Chromium browser >= 90
- Legion monorepo setup completed

**Legion Dependencies:**
- `@legion/agent` - Core AI agent functionality
- `@legion/module-loader` - Module and tool management
- `@legion/llm` - Language model client
- `@legion/aiur` - MCP server (optional, for advanced features)

### Installation Steps

#### 1. Install Dependencies
```bash
# Navigate to the package directory
cd packages/code-gen/devtools-debug-plugin

# Install dependencies
npm install

# Verify installation
npm run test
```

#### 2. Build Chrome Extension
```bash
# Build extension files
npm run build:extension
```
This creates a `dist/extension/` directory with the built Chrome extension files.

#### 3. Load Extension in Chrome
1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" (toggle in top right)
3. Click "Load unpacked"
4. Select the `dist/extension/` directory
5. The "Cerebrate" extension should appear

#### 4. Verify Installation
1. Open Chrome DevTools (F12 or right-click → Inspect)
2. Look for the "Cerebrate" tab in the DevTools panel
3. If visible, the extension is properly installed

### Development Setup

#### 1. Start Debug Server
```bash
# Start development server with hot reload
npm run dev
```
The server will start on `ws://localhost:9222/debug`

#### 2. Test with Sample Application
```bash
# In another terminal, start test server
npm run serve:test
```
This serves a sample HTML page at `http://localhost:3000` for testing.

#### 3. Connect DevTools to Debug Server
1. Open the test page (`http://localhost:3000`)
2. Open Chrome DevTools (F12)
3. Navigate to the "Cerebrate" tab
4. Click "Connect to Debug Server"
5. Status should show "Connected" with a green indicator

### Configuration

#### Environment Variables
Create a `.env` file in the package root:
```bash
# Debug server configuration
DEBUG_SERVER_PORT=9222
DEBUG_SERVER_HOST=localhost

# Agent configuration
AGENT_MODEL_PROVIDER=openai
AGENT_MODEL_NAME=gpt-4

# Development settings
DEBUG_MODE=true
LOG_LEVEL=info

# Legion integration
AIUR_MCP_SERVER_URL=http://localhost:3001
```

#### Server Configuration
Modify `src/server/config.js` for server-specific settings:
```javascript
export const config = {
  server: {
    port: process.env.DEBUG_SERVER_PORT || 9222,
    host: process.env.DEBUG_SERVER_HOST || 'localhost'
  },
  agent: {
    provider: process.env.AGENT_MODEL_PROVIDER || 'openai',
    model: process.env.AGENT_MODEL_NAME || 'gpt-4',
    timeout: 30000
  },
  websocket: {
    maxPayload: 1024 * 1024, // 1MB
    compression: true,
    heartbeatInterval: 30000
  }
};
```

### Testing

#### Run Tests
```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run integration tests
npm run test:integration
```

#### Manual Testing Checklist
- [ ] Extension loads without errors
- [ ] DevTools panel appears
- [ ] Can connect to debug server
- [ ] Connection status updates correctly
- [ ] Can send inspect_element commands
- [ ] Responses display correctly in UI
- [ ] Error handling works for invalid commands
- [ ] Reconnection works after server restart

### Troubleshooting

#### Extension Not Loading
```bash
# Check Chrome extension errors
# Go to chrome://extensions/ and check for errors

# Verify build output
ls -la dist/extension/
```

#### Connection Issues
```bash
# Verify debug server is running
curl -i -N \
  -H "Connection: Upgrade" \
  -H "Upgrade: websocket" \
  -H "Sec-WebSocket-Key: test" \
  -H "Sec-WebSocket-Version: 13" \
  http://localhost:9222/debug
```

#### Agent Errors
```bash
# Check agent logs
DEBUG=legion:* npm run dev

# Test agent directly
node -e "
import { Agent } from '@legion/agent';
const agent = new Agent({...config});
console.log('Agent loaded successfully');
"
```

#### Enable Debug Logging
```bash
# Server-side logging
DEBUG=devtools:* npm run dev

# Browser console (in DevTools extension context)
console.log('Debug client state:', debugClient.getState());
```

#### Reset and Clean Install
```bash
# Clean installation
npm run clean
rm -rf node_modules package-lock.json
npm install
npm run build:extension

# Reset Chrome extension
# Go to chrome://extensions/
# Remove and reload extension
```

### Development Workflow

#### Making Changes
1. **Server Changes**: Server auto-reloads with nodemon (`npm run dev`)
2. **Extension Changes**: Rebuild (`npm run build:extension`) and reload in Chrome
3. **Testing Changes**: Run tests (`npm test`) and test manually

#### Code Quality
```bash
# Lint code
npm run lint

# Fix linting issues
npm run lint:fix

# Format code
npm run format
```

### Production Deployment

#### Building for Production
```bash
# Build optimized extension
NODE_ENV=production npm run build:extension

# Build server for production
npm run build:server

# Start production server
NODE_ENV=production npm start
```

---

## Conclusion

Cerebrate represents a significant enhancement to the Legion ecosystem, providing developers with AI-powered debugging capabilities directly within their familiar Chrome DevTools environment. The architecture leverages the existing Legion Agent system while providing a seamless, performant, and secure debugging experience.

The design prioritizes extensibility, allowing for future enhancements while maintaining simplicity in the core debugging workflow. Through careful attention to performance, security, and user experience, this plugin will serve as a powerful tool for frontend development and debugging.