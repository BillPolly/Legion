# @jsenvoy/resource-manager

Resource management system for jsEnvoy that handles process lifecycle, agent orchestration, and dependency management.

## Features

- **Process Management**: Start, stop, and monitor external processes with dependency ordering
- **Agent Orchestration**: LLM-powered agents with conversation session management
- **Health Monitoring**: Comprehensive health checks (TCP, HTTP, file, custom)
- **Dependency Resolution**: Automatic startup/shutdown ordering based on dependencies
- **Resource Tools**: Unified tool interface for all resources
- **Session Management**: Persistent conversation sessions for agents
- **Template System**: Dynamic prompt templating with context injection

## Installation

```bash
npm install @jsenvoy/resource-manager
```

## Quick Start

```javascript
import { 
  ResourceModuleFactory, 
  ProcessResource, 
  AgentResource 
} from '@jsenvoy/resource-manager';
import { ResourceManager } from '@jsenvoy/module-loader';

// Create resource manager and factory
const resourceManager = new ResourceManager();
await resourceManager.initialize();

const factory = new ResourceModuleFactory(resourceManager);

// Create module with resources
const module = await factory.createModule({
  name: 'my-environment',
  
  // Process resources (local servers/databases)
  processResources: {
    mongodb: {
      command: 'mongod',
      args: ['--port', '27017'],
      healthCheck: {
        type: 'tcp',
        port: 27017
      }
    }
  },
  
  // Service modules (remote APIs)
  serviceModules: {
    'openai-api': {
      package: 'openai',
      type: 'constructor',
      dependencies: { apiKey: 'env.OPENAI_API_KEY' }
    }
  },
  
  // Agent resources (LLM agents)
  agentResources: {
    'code-reviewer': {
      llm: { module: 'openai-api', model: 'gpt-4' },
      systemPrompt: 'You are an expert code reviewer...'
    }
  },
  
  // Tools for accessing resources
  tools: [
    {
      name: 'start_mongodb',
      resource: 'mongodb',
      method: 'start'
    },
    {
      name: 'review_code',
      resource: 'code-reviewer', 
      method: 'single_shot'
    }
  ]
});
```

## Core Components

### ProcessResource

Manages external process lifecycle with comprehensive monitoring:

```javascript
import { ProcessResource } from '@jsenvoy/resource-manager';

const process = new ProcessResource('mongodb', {
  command: 'mongod',
  args: ['--dbpath', './data', '--port', '27017'],
  
  // Health monitoring
  healthCheck: {
    type: 'tcp',
    port: 27017,
    interval: 30000
  },
  
  // Readiness check
  readyCheck: {
    type: 'tcp',
    port: 27017,
    timeout: 30000
  },
  
  // Auto-restart on failure
  autoRestart: true,
  maxRestarts: 5,
  
  // Logging
  logging: {
    file: './logs/mongodb.log',
    console: true
  }
});

await process.initialize();
```

### AgentResource

LLM-powered agents with session management:

```javascript
import { AgentResource } from '@jsenvoy/resource-manager';

const agent = new AgentResource('assistant', {
  llm: {
    module: 'openai-api',
    model: 'gpt-4'
  },
  systemPrompt: 'You are a helpful assistant. Context: ${company} - ${domain}',
  maxSessions: 100,
  sessionTimeout: 3600000,
  
  // Additional context
  context: {
    company: 'My Company',
    domain: 'Software Development'
  }
});

await agent.initialize();

// Single-shot interaction
const response = await agent.invoke('single_shot', {
  prompt: 'Explain dependency injection',
  context: { language: 'JavaScript' }
});

// Conversational interaction
await agent.invoke('chat', {
  sessionId: 'user123',
  message: 'Hello!',
  context: { user: 'John' }
});
```

### ProcessOrchestrator

Manages multiple processes with dependency ordering:

```javascript
import { ProcessOrchestrator } from '@jsenvoy/resource-manager';

const orchestrator = new ProcessOrchestrator();

// Register processes with dependencies
orchestrator.registerProcess('database', mongoProcess, []);
orchestrator.registerProcess('backend', backendProcess, ['database']);
orchestrator.registerProcess('frontend', frontendProcess, ['backend']);

// Start all in dependency order
await orchestrator.startAll({
  parallel: true,    // Start independent processes in parallel
  timeout: 300000,   // 5 minute timeout
  stopOnError: false // Continue starting other processes on failure
});

// Stop all in reverse order
await orchestrator.stopAll();
```

### Health Monitoring

Multiple health check types supported:

```javascript
// TCP port check
healthCheck: {
  type: 'tcp',
  port: 27017,
  host: 'localhost'
}

// HTTP endpoint check
healthCheck: {
  type: 'http',
  url: 'http://localhost:3000/health',
  expectedStatus: 200
}

// File existence check
healthCheck: {
  type: 'file',
  path: '/tmp/service.ready'
}

// Custom check function
healthCheck: {
  type: 'custom',
  function: async () => {
    // Return true if healthy
    return await checkServiceHealth();
  }
}
```

### Session Management

Persistent conversation sessions for agents:

```javascript
import { SessionManager } from '@jsenvoy/resource-manager';

const sessions = new SessionManager({
  maxSessions: 1000,
  sessionTimeout: 3600000, // 1 hour
  cleanupInterval: 300000   // 5 minutes
});

// Create session
const session = sessions.createSession('user123', {
  user: 'John Doe',
  preferences: { language: 'en' }
});

// Add messages
sessions.addMessage('user123', {
  role: 'user',
  content: 'Hello!'
});

sessions.addMessage('user123', {
  role: 'assistant', 
  content: 'Hi! How can I help you?'
});

// Get conversation history
const messages = sessions.getMessages('user123', { limit: 10 });
```

### Resource Tools

Unified tool interface for all resources:

```javascript
import { ResourceTool } from '@jsenvoy/resource-manager';

// Create tool for specific resource method
const tool = ResourceTool.forResourceMethod(
  'mongodb',           // Resource name
  'restart',           // Method name
  resourceManager,     // Resource manager instance
  {
    name: 'restart_mongodb',
    description: 'Restart MongoDB server',
    parameters: {
      type: 'object',
      properties: {
        graceful: { type: 'boolean', default: true }
      }
    }
  }
);

// Use in tool calls
const result = await tool.invoke({
  id: 'call123',
  type: 'function',
  function: {
    name: 'restart_mongodb',
    arguments: '{"graceful": true}'
  }
});
```

## Configuration Schema

Complete module configuration example:

```json
{
  "name": "development-environment",
  "version": "1.0.0",
  "description": "Complete development environment",
  
  "dependencies": {
    "dataPath": {
      "type": "string",
      "default": "./data"
    },
    "openaiApiKey": {
      "type": "string", 
      "required": true
    }
  },

  "processResources": {
    "mongodb": {
      "command": "mongod",
      "args": ["--dbpath", "${dataPath}/mongodb", "--port", "27017"],
      "autoRestart": true,
      "dependencies": [],
      
      "readyCheck": {
        "type": "tcp",
        "port": 27017,
        "timeout": 30000
      },
      
      "healthCheck": {
        "type": "tcp",
        "port": 27017,
        "interval": 30000
      },
      
      "logging": {
        "file": "./logs/mongodb.log",
        "console": false
      }
    },
    
    "redis": {
      "command": "redis-server",
      "args": ["--port", "6379"],
      "dependencies": [],
      "autoRestart": true
    },
    
    "backend": {
      "command": "node", 
      "args": ["server.js"],
      "cwd": "./backend",
      "dependencies": ["mongodb", "redis"],
      
      "readyCheck": {
        "type": "http",
        "url": "http://localhost:3000/health"
      }
    }
  },

  "serviceModules": {
    "openai-api": {
      "package": "openai",
      "type": "constructor",
      "dependencies": {
        "apiKey": "openaiApiKey"
      },
      "tools": [
        {
          "name": "chat_completion",
          "function": "chat.completions.create"
        }
      ]
    }
  },

  "agentResources": {
    "code-reviewer": {
      "llm": {
        "module": "openai-api",
        "model": "gpt-4"
      },
      "systemPrompt": "You are an expert code reviewer. Analyze code for bugs, security issues, and best practices.",
      "maxSessions": 50,
      "sessionTimeout": 1800000
    },
    
    "chatbot": {
      "llm": {
        "module": "openai-api",
        "model": "gpt-3.5-turbo"
      },
      "systemPrompt": "You are a helpful assistant for ${company}. Be friendly and professional.",
      "context": {
        "company": "Acme Corp"
      },
      "maxSessions": 200
    }
  },

  "tools": [
    {
      "name": "start_mongodb",
      "description": "Start MongoDB server",
      "resource": "mongodb",
      "method": "start"
    },
    {
      "name": "mongodb_status", 
      "description": "Check MongoDB status",
      "resource": "mongodb",
      "method": "status"
    },
    {
      "name": "review_code",
      "description": "Review code for issues",
      "resource": "code-reviewer",
      "method": "single_shot",
      "parameters": {
        "type": "object",
        "properties": {
          "code": { "type": "string" },
          "language": { "type": "string" }
        },
        "required": ["code"]
      }
    },
    {
      "name": "chat_with_bot",
      "description": "Chat with the assistant",
      "resource": "chatbot",
      "method": "chat",
      "parameters": {
        "type": "object", 
        "properties": {
          "sessionId": { "type": "string" },
          "message": { "type": "string" }
        },
        "required": ["sessionId", "message"]
      }
    }
  ]
}
```

## API Reference

### Classes

- **`ProcessResource`** - Manages external process lifecycle
- **`AgentResource`** - LLM-powered agent with session management  
- **`ProcessOrchestrator`** - Coordinates multiple processes
- **`SessionManager`** - Manages conversation sessions
- **`HealthChecker`** - Monitors resource health
- **`ResourceTool`** - Tool interface for resources
- **`ResourceModuleFactory`** - Factory for creating resource modules
- **`DependencyGraph`** - Dependency resolution and ordering
- **`PromptTemplate`** - Template system for dynamic prompts

### Resource Types

1. **Process Resources** - Local processes you manage (databases, servers)
2. **Service Modules** - Remote APIs you call (existing JSON module system)
3. **Agent Resources** - LLM agents that orchestrate other resources

This architecture provides a unified, powerful system for managing complex development environments while maintaining the elegance and simplicity of the core jsEnvoy framework.

## License

MIT