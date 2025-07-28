# @legion/codec

A general-purpose typed communication codec with schema validation for WebSocket and message passing systems.

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
    messageId: { type: 'string' },
    timestamp: { type: 'string', format: 'date-time' }
  },
  required: ['type', 'username', 'content', 'messageId', 'timestamp'],
  additionalProperties: false
});

// Encode message
const result = codec.encode('user_message', {
  username: 'alice',
  content: 'Hello world!'
});

if (result.success) {
  console.log('Encoded:', result.encoded);
  // Send result.encoded over WebSocket or other transport
}

// Decode received message
const decoded = codec.decode(encodedMessage);
if (decoded.success) {
  console.log('Message type:', decoded.messageType);
  console.log('Message data:', decoded.decoded);
}
```

## Features

- **Schema-based validation** using JSON Schema with AJV
- **Type safety** with automatic message type detection and validation
- **Schema negotiation** with built-in protocol support
- **Error handling** with structured error responses (no exceptions)
- **Metadata injection** - automatically adds message IDs and timestamps
- **Built-in message types** for errors, acknowledgments, and protocol messages
- **Extensible** - easy to add custom message schemas

## Installation

```bash
npm install @legion/codec
```

## API Reference

### Codec Class

```javascript
const codec = new Codec(options);
```

**Options:**
- `strictValidation` (boolean, default: true) - Enable schema validation
- `injectMetadata` (boolean, default: true) - Auto-inject messageId and timestamp

**Methods:**
- `registerSchema(schema)` - Register a custom message schema
- `encode(messageType, data)` - Encode a message
- `decode(encodedMessage)` - Decode a JSON message
- `getMessageTypes()` - Get all registered message types
- `hasMessageType(type)` - Check if message type exists
- `getSchema(type)` - Get schema for message type
- `createErrorMessage(code, message, details)` - Create error message
- `createAckMessage(originalMessageId, status)` - Create acknowledgment
- `createSchemaDefinitionMessage()` - Create schema definition for negotiation
- `loadSchemaDefinition(definition, replace)` - Load schemas from definition

## Documentation

See the [docs](./docs/) directory for complete documentation:

- [Design Overview](./docs/design.md) - System architecture and design decisions
- [Implementation Plan](./docs/implementation-plan.md) - Development phases and completion status

## Examples

See the [examples](./examples/) directory for usage examples:

- [Basic Usage](./examples/basic-usage.js) - Simple encoding/decoding example

## Testing

```bash
npm test                 # Run all tests (130+ tests)
npm run test:coverage    # Run with coverage report (98%+ coverage)
npm run test:watch       # Run in watch mode
```