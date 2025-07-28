# @legion/codec

General-purpose typed communication codec with schema validation for WebSocket and other message passing systems.

## Quick Start

```javascript
import { Codec } from '@legion/codec';

// Create codec instance
const codec = new Codec();

// Register custom message schema
codec.registerSchema({
  $id: 'user_message',
  type: 'object',
  properties: {
    type: { type: 'string', const: 'user_message' },
    username: { type: 'string' },
    content: { type: 'string' },
    timestamp: { type: 'string', format: 'date-time' }
  },
  required: ['type', 'username', 'content'],
  additionalProperties: false
});

// Encode message
const result = codec.encode('user_message', {
  username: 'alice',
  content: 'Hello world!'
});

if (result.success) {
  console.log('Encoded:', result.message);
  // Send result.message over WebSocket or other transport
}

// Decode received message
const decoded = codec.decode(receivedMessage);
if (decoded.success) {
  console.log('Message type:', decoded.messageType);
  console.log('Message data:', decoded.message);
}
```

## Features

- **Schema-based validation** using JSON Schema
- **Type safety** with automatic message type detection
- **Bidirectional communication** with schema negotiation
- **Error handling** with detailed validation messages
- **Extensible** schema registry system
- **Built-in message types** for common patterns

## Installation

```bash
npm install @legion/codec
```

## Documentation

See the [docs](./docs/) directory for complete documentation:

- [Architecture Overview](./docs/architecture.md)
- [API Reference](./docs/api.md) 
- [Schema System](./docs/schemas.md)
- [Integration Guide](./docs/integration.md)
- [Examples](./docs/examples.md)