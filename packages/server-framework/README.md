# @legion/server-framework

Actor-based web application framework for building real-time applications with automatic WebSocket communication.

## Overview

The Legion Server Framework provides a simple, powerful foundation for creating web applications with real-time client-server communication:

- **Actor-based architecture** with isolated state per connection
- **Automatic WebSocket setup** and actor handshake handling
- **Legion package integration** with automatic import rewriting for browsers
- **Express + WebSocket servers** with built-in middleware and routing
- **Service injection** via ResourceManager for database and external services

## Quick Start

### 1. Create a Server Actor

```javascript
// server.js
import { BaseServer } from '@legion/server-framework';

function createCounterActor(services) {
  return {
    count: 0,
    
    async receive(messageType, data) {
      switch (messageType) {
        case 'increment':
          this.count++;
          return { type: 'count_updated', count: this.count };
        case 'get_count':
          return { type: 'count_updated', count: this.count };
      }
    }
  };
}

const server = new BaseServer();
await server.initialize();
server.registerRoute('/app', createCounterActor, './client.js', 8080);
await server.start();
```

### 2. Create a Client Actor

```javascript
// client.js
export default class CounterClient {
  constructor() {
    this.count = 0;
  }

  async connect(ws, serverActorId) {
    this.ws = ws;
    this.serverActor = serverActorId;
    
    this.ws.addEventListener('message', (event) => {
      const message = JSON.parse(event.data);
      if (message.type === 'actor_message') {
        this.handleServerMessage(message.message);
      }
    });
  }

  handleServerMessage(message) {
    if (message.type === 'count_updated') {
      this.count = message.count;
      document.getElementById('count').textContent = this.count;
    }
  }

  async increment() {
    await this.sendToServer('increment');
  }

  async sendToServer(messageType, data = {}) {
    this.ws.send(JSON.stringify({
      type: 'actor_message',
      from: 'client-root',
      to: this.serverActor,
      message: { type: messageType, data }
    }));
  }
}
```

### 3. Run Your Application

```bash
node server.js
# Visit http://localhost:8080/app
```

## Core Features

### ✅ Actor-Based Communication
Each WebSocket connection gets its own isolated server actor instance, enabling clean state management and concurrent user handling.

### ✅ Automatic Setup
The framework automatically generates HTML pages with WebSocket connections, actor initialization, and module loading.

### ✅ Legion Package Integration
Automatically discovers and serves Legion packages from your monorepo, with import rewriting for browser compatibility.

### ✅ Production Ready
Includes comprehensive error handling, graceful shutdown, CORS support, and production configuration options.

## Documentation

- **[API Reference](./docs/API.md)** - Complete API documentation and method references
- **[Usage Guide](./docs/USAGE-GUIDE.md)** - Detailed tutorials and patterns
- **[Production Guide](./docs/PRODUCTION-GUIDE.md)** - Deployment, scaling, and monitoring
- **[Migration Guide](./docs/MIGRATION-GUIDE.md)** - Migrating from Express.js and Socket.IO
- **[Troubleshooting](./docs/TROUBLESHOOTING.md)** - Common issues and debugging
- **[Design Document](./docs/DESIGN.md)** - Architecture and design decisions
- **[Examples](./examples/)** - Working example applications

## Features

- ✅ Standard Express + WebSocket setup
- ✅ Plugin-based architecture  
- ✅ Actor space management
- ✅ Automatic package serving
- ✅ Service integration
- ✅ Graceful shutdown
- ✅ Health check endpoints

## License

MIT