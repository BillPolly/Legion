# Todo App Example

A simple todo application demonstrating the configuration-driven Legion actor server framework.

## Features

- ✅ Add, toggle, and delete todos
- ✅ Real-time synchronization across multiple clients
- ✅ Pure actor-based communication
- ✅ MVVM pattern in client actor
- ✅ Zero boilerplate server code
- ✅ Configuration-driven setup

## Architecture

This example shows how to build a full-stack application using only:
1. A configuration file (`actor-server.config.js`)
2. A server actor (`ServerTodoActor.js`)
3. A client actor (`ClientTodoActor.js`)

No server setup code, no webpack configuration, no build step required!

## Running the Example

### Quick Start

```bash
# From this directory
npm install
npm start
```

Then open http://localhost:8081/todos in your browser.

### Available Scripts

```bash
# Start the server (default port 8081)
npm start

# Start with verbose logging
npm run start:verbose

# Start on a different port
npm run start:custom-port  # Uses port 3000

# Development mode with file watching (not yet implemented)
npm run dev
```

## How It Works

### 1. Configuration (`actor-server.config.js`)

```javascript
export default {
  name: 'todo-app',
  port: 8081,
  routes: [
    {
      path: '/todos',
      serverActor: './actors/ServerTodoActor.js',
      clientActor: './actors/ClientTodoActor.js'
    }
  ]
};
```

This configuration tells the framework to:
- Serve the app on port 8081
- Create a route at `/todos`
- Use `ServerTodoActor` on the server side
- Load `ClientTodoActor` in the browser

### 2. Server Actor (`ServerTodoActor.js`)

The server actor:
- Maintains the todo list state
- Handles add, toggle, delete, and clear operations
- Broadcasts updates to all connected clients
- Each client gets its own server actor instance

### 3. Client Actor (`ClientTodoActor.js`)

The client actor:
- Manages the UI using MVVM pattern
- Sends user actions to the server
- Updates the UI when receiving server updates
- Handles all DOM manipulation

### 4. Communication Flow

```
User Action → Client Actor → WebSocket → Server Actor
                 ↑                           ↓
                 └── WebSocket ← Updates ────┘
```

## Key Concepts

### Actor Encapsulation
- Each actor is completely self-contained
- Actors communicate only through `receive()` method
- No shared state between actors

### Automatic Setup
- WebSocket connection handled automatically
- Actor pairing handled by the framework
- Client actor loaded as ES module in browser

### Real-time Sync
- Multiple clients can connect to the same route
- Each gets their own server actor instance
- Could be modified to share state across clients

## Extending the Example

### Add Persistence
```javascript
// In ServerTodoActor constructor
constructor(services) {
  this.database = services.database;
  // Load todos from database
}
```

### Share Todos Across Clients
```javascript
// Use a shared service instead of instance state
constructor(services) {
  this.todoService = services.todoService;
  // All clients share the same todo service
}
```

### Add Authentication
```javascript
// In configuration
routes: [
  {
    path: '/todos',
    serverActor: './actors/ServerTodoActor.js',
    clientActor: './actors/ClientTodoActor.js',
    services: ['auth', 'database']
  }
]
```

## Benefits

1. **No Boilerplate**: No server setup code needed
2. **Clear Separation**: Client and server logic completely separated
3. **Testable**: Each actor can be tested independently
4. **Scalable**: Easy to add new routes and actors
5. **Real-time**: WebSocket communication built-in
6. **Type-Safe**: Can add TypeScript for full type safety

## Learn More

See the main [Legion Server Framework](../../README.md) documentation for more details on:
- Configuration options
- Service injection
- Testing actors
- Production deployment