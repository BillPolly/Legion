# @legion/actors

Actor-based concurrency system for the Legion framework.

## Overview

This package provides an actor-based concurrency system that enables building distributed, fault-tolerant applications using the actor model pattern.

## Features (Coming Soon)

- **Actor Model Implementation**: Create and manage actors with isolated state
- **Message Passing**: Asynchronous message passing between actors
- **Supervision**: Actor supervision hierarchies for fault tolerance
- **Location Transparency**: Actors can be local or remote
- **Backpressure Handling**: Built-in backpressure management

## Installation

```bash
npm install @legion/actors
```

## Usage

```javascript
import { Actor, ActorSystem } from '@legion/actors';

// Create an actor system
const system = new ActorSystem();

// Create actors
const actor1 = system.createActor('worker-1');
const actor2 = system.createActor('worker-2');

// Send messages
await actor1.send({ type: 'process', data: 'some work' });

// Broadcast to all actors
await system.broadcast({ type: 'shutdown' });
```

## Development

This is currently a placeholder implementation. The full actor system will be implemented according to the actor model principles:

1. **Encapsulation**: Each actor has its own private state
2. **Message Passing**: Actors communicate only through messages
3. **Concurrency**: Actors process messages concurrently
4. **Fault Tolerance**: Actor hierarchies provide supervision and recovery

## Testing

```bash
npm test
npm run test:watch
npm run test:coverage
```

## License

MIT