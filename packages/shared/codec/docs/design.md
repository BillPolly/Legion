# @legion/codec Design Document

## Overview

The @legion/codec package provides a general-purpose typed communication system for WebSocket and other message passing protocols. It ensures message integrity through schema validation and enables both endpoints to automatically negotiate message formats.

## Core Concept

The codec works on a simple principle: **you encode by name, decode by type**. When encoding a message, you provide:

1. **Message name** (string) - The registered schema identifier
2. **Data object** - The actual message data

The codec looks up the schema by name, validates the data against it, and encodes it as JSON. The receiving end decodes the JSON and validates it against the same schema.

```javascript
// Encoding
const result = codec.encode('user_login', {
  username: 'alice',
  password: 'secret123'
});

// Decoding  
const decoded = codec.decode(receivedJsonString);
// Returns: { messageType: 'user_login', message: {...}, success: true }
```

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Application Layer                        │
├─────────────────────────────────────────────────────────────────┤
│  encode('message_name', dataObject) → JSON string              │
│  decode(jsonString) → { messageType, message, success }        │
└─────────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────────┐
│                       Validation Layer                         │
├─────────────────────────────────────────────────────────────────┤
│  • Schema lookup by name                                       │
│  • JSON Schema validation (AJV)                                │
│  • Automatic metadata injection (ID, timestamp)                │
└─────────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────────┐
│                     Schema Registry                             │
├─────────────────────────────────────────────────────────────────┤
│  • Message type definitions                                    │
│  • Schema versioning                                          │
│  • Runtime schema loading                                     │
└─────────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────────┐
│                     Transport Layer                            │
├─────────────────────────────────────────────────────────────────┤
│  WebSocket │ HTTP │ TCP │ Message Queue │ Any text transport   │
└─────────────────────────────────────────────────────────────────┘
```

## Message Flow

### Outbound (Encoding)

1. Application calls `codec.encode('message_name', dataObject)`
2. Codec looks up schema by name in registry
3. Data is validated against schema (if strictValidation enabled)
4. Metadata added automatically (messageId, timestamp, type)
5. Object serialized to JSON string
6. JSON string sent via transport

### Inbound (Decoding)

1. JSON string received from transport
2. JSON parsed to JavaScript object
3. Message type extracted from `type` field
4. Schema looked up by message type
5. Message validated against schema
6. Validated message object returned to application

## Schema System

### Schema Definition

Every message type has a JSON Schema that defines its structure:

```javascript
const userLoginSchema = {
  $id: 'user_login',              // Schema name/identifier
  type: 'object',
  properties: {
    type: { 
      type: 'string', 
      const: 'user_login'         // Must match schema ID
    },
    username: { 
      type: 'string',
      minLength: 1,
      maxLength: 50
    },
    password: { 
      type: 'string',
      minLength: 8
    },
    messageId: { type: 'string' },    // Auto-injected
    timestamp: { 
      type: 'string', 
      format: 'date-time'             // Auto-injected
    }
  },
  required: ['type', 'username', 'password'],
  additionalProperties: false
};

// Register the schema
codec.registerSchema(userLoginSchema);
```

### Usage Pattern

```javascript
// Application only provides the data - NOT the schema
const loginData = {
  username: 'alice',
  password: 'mypassword'
};

// Codec handles validation and metadata
const encoded = codec.encode('user_login', loginData);

// Result includes auto-added fields:
// {
//   type: 'user_login',
//   username: 'alice', 
//   password: 'mypassword',
//   messageId: 'msg_1753719842157_1',
//   timestamp: '2025-07-28T16:24:02.157Z'
// }
```

## Schema Negotiation Protocol

The codec implements automatic schema synchronization between endpoints:

### Initialization Sequence

```
Server                                    Client
  │                                         │
  │ 1. Server starts with schemas          │
  │ 2. Client connects                     │
  │                                         │
  │ ────────[schema_definition]───────────► │ 3. Server sends all schemas
  │                                         │ 4. Client loads schemas
  │                                         │ 5. Client validates compatibility
  │                                         │
  │ ◄─────────────[ack]──────────────────── │ 6. Client acknowledges
  │                                         │
  │ 7. Both endpoints use same schemas      │
  │ ◄────────[typed_messages]─────────────► │
```

### Schema Definition Message

This is sent automatically by the server to synchronize schemas:

```json
{
  "type": "schema_definition",
  "version": "1.0.0",
  "schemas": {
    "user_login": {
      "$id": "user_login",
      "type": "object",
      "properties": { ... }
    },
    "chat_message": {
      "$id": "chat_message", 
      "type": "object",
      "properties": { ... }
    }
  },
  "timestamp": "2025-07-28T16:24:02.157Z"
}
```

## Built-in Message Types

The codec includes several system message types:

### `schema_definition`
- Contains all schema definitions
- Sent by server for protocol negotiation
- Enables automatic schema synchronization

### `error`
- Standardized error reporting
- Includes error codes and detailed messages
- Used for validation failures and protocol errors

### `ack`
- Message acknowledgment
- Enables reliable communication patterns
- Includes original message ID and status

### `ping` / `pong`
- Connection health monitoring
- Automatic keep-alive functionality
- Latency measurement support

## API Design

### Core Methods

```javascript
// Create codec
const codec = new Codec({
  strictValidation: true,    // Enable validation (default: true)
  includeMessageId: true,    // Auto-add message IDs (default: true)  
  includeTiming: true        // Auto-add timestamps (default: true)
});

// Register message schemas
codec.registerSchema(myMessageSchema);

// Encode message by name
const result = codec.encode('message_name', dataObject);
if (result.success) {
  send(result.message);  // result.message is JSON string
}

// Decode received message
const decoded = codec.decode(receivedJsonString);
if (decoded.success) {
  handleMessage(decoded.messageType, decoded.message);
}

// Schema management
const schemaMsg = codec.createSchemaDefinitionMessage();
codec.loadSchemaDefinition(receivedSchemaMsg);
```

### Error Handling

The codec never throws exceptions. All operations return success/error objects:

```javascript
// Encoding error example
const result = codec.encode('unknown_type', data);
// Returns: { 
//   success: false, 
//   message: null, 
//   errors: ['Schema "unknown_type" not found'] 
// }

// Decoding error example  
const decoded = codec.decode('invalid json');
// Returns: {
//   success: false,
//   message: null,
//   messageType: null,
//   errors: ['JSON parsing failed: Unexpected token...']
// }
```

## Integration Patterns

### Simple WebSocket Integration

```javascript
const codec = new Codec();

// Register your message types
codec.registerSchema(userMessageSchema);
codec.registerSchema(chatMessageSchema);

// WebSocket setup
const ws = new WebSocket('ws://localhost:8080');

ws.onopen = () => {
  // Server will send schema_definition message
};

ws.onmessage = (event) => {
  const decoded = codec.decode(event.data);
  
  if (!decoded.success) {
    console.error('Decode failed:', decoded.errors);
    return;
  }
  
  switch (decoded.messageType) {
    case 'schema_definition':
      codec.loadSchemaDefinition(decoded.message);
      break;
      
    case 'chat_message':
      displayMessage(decoded.message);
      break;
      
    case 'error':
      handleError(decoded.message);
      break;
  }
};

// Send a message
function sendChatMessage(content) {
  const result = codec.encode('chat_message', {
    content: content,
    username: currentUser
  });
  
  if (result.success) {
    ws.send(result.message);
  }
}
```

### Server-Side Integration

```javascript
// Server setup with schema broadcasting
const codec = new Codec();
codec.registerSchema(chatMessageSchema);
codec.registerSchema(userLoginSchema);

const wss = new WebSocketServer({ port: 8080 });

wss.on('connection', (ws) => {
  // Send schema definition to new client
  const schemaDef = codec.createSchemaDefinitionMessage();
  const encoded = codec.encode('schema_definition', schemaDef);
  ws.send(encoded.message);
  
  ws.on('message', (data) => {
    const decoded = codec.decode(data.toString());
    
    if (decoded.success) {
      handleClientMessage(decoded.messageType, decoded.message);
    } else {
      // Send error back to client
      const errorMsg = codec.createErrorMessage(
        'DECODING_ERROR',
        'Message decode failed',
        { errors: decoded.errors }
      );
      const errorEncoded = codec.encode('error', errorMsg);
      ws.send(errorEncoded.message);
    }
  });
});
```

## Performance Characteristics

### Schema Compilation
- Schemas compiled once during registration using AJV
- Compiled validators cached for fast reuse
- No runtime schema parsing overhead

### Message Processing
- Direct JSON serialization/parsing
- Single-pass validation with early termination
- Minimal memory allocation per message

### Memory Usage
- Shared schema registry across codec instances
- No circular references or memory leaks
- Compiled validators garbage collected when unused

## Security Considerations

### Input Validation
- All incoming messages validated against schemas
- Malformed JSON rejected before processing
- Unknown message types handled gracefully

### Data Sanitization
- Schema validation prevents injection attacks
- String length limits prevent buffer overflows
- Format validation (email, URI, etc.) built-in

### Protocol Security
- Version negotiation prevents downgrade attacks
- Schema integrity ensured through validation
- Error messages don't leak sensitive information

## Extensibility

### Custom Message Types

```javascript
// Define domain-specific message
const orderSchema = {
  $id: 'create_order',
  type: 'object',
  properties: {
    type: { type: 'string', const: 'create_order' },
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          productId: { type: 'string' },
          quantity: { type: 'integer', minimum: 1 },
          price: { type: 'number', minimum: 0 }
        },
        required: ['productId', 'quantity', 'price']
      }
    },
    customerId: { type: 'string' },
    totalAmount: { type: 'number', minimum: 0 }
  },
  required: ['type', 'items', 'customerId', 'totalAmount']
};

codec.registerSchema(orderSchema);

// Use like any other message type
const result = codec.encode('create_order', {
  customerId: 'cust_123',
  items: [
    { productId: 'prod_456', quantity: 2, price: 29.99 }
  ],
  totalAmount: 59.98
});
```

### Transport Adapters

```javascript
// Generic transport adapter pattern
class TransportAdapter {
  constructor(codec, transport) {
    this.codec = codec;
    this.transport = transport;
    
    transport.onMessage = (data) => {
      const decoded = this.codec.decode(data);
      if (decoded.success) {
        this.onMessage(decoded.messageType, decoded.message);
      } else {
        this.onError(decoded.errors);
      }
    };
  }
  
  send(messageType, data) {
    const encoded = this.codec.encode(messageType, data);
    if (encoded.success) {
      this.transport.send(encoded.message);
    } else {
      this.onError(encoded.errors);
    }
  }
}
```

## Testing Strategy

### Schema Validation Testing

```javascript
// Test valid messages
const validData = { username: 'alice', password: 'password123' };
const result = codec.encode('user_login', validData);
assert(result.success === true);

// Test invalid messages
const invalidData = { username: '', password: '123' }; // Too short
const result2 = codec.encode('user_login', invalidData);
assert(result2.success === false);
assert(result2.errors.length > 0);
```

### Round-trip Testing

```javascript
// Ensure encode/decode consistency
const originalData = { username: 'bob', password: 'secret456' };
const encoded = codec.encode('user_login', originalData);
const decoded = codec.decode(encoded.message);

assert(decoded.success === true);
assert(decoded.messageType === 'user_login');
assert(decoded.message.username === originalData.username);
```

### Protocol Testing

```javascript
// Test schema negotiation
const serverCodec = new Codec();
const clientCodec = new Codec();

serverCodec.registerSchema(mySchema);

const schemaDef = serverCodec.createSchemaDefinitionMessage();
const loadResult = clientCodec.loadSchemaDefinition(schemaDef);

assert(loadResult.success === true);
assert(clientCodec.hasMessageType('my_message_type'));
```

## Migration and Versioning

### Schema Evolution

The codec supports backward-compatible schema evolution:

1. **Adding optional fields** - Always safe
2. **Relaxing validation** - Safe (e.g., increasing maxLength)
3. **Adding new message types** - Safe
4. **Breaking changes** - Require version bump and migration

### Version Management

```javascript
// Version 1.0.0 schema
const userV1 = {
  $id: 'user_profile',
  properties: {
    name: { type: 'string' },
    email: { type: 'string', format: 'email' }
  },
  required: ['name', 'email']
};

// Version 1.1.0 - add optional field (backward compatible)
const userV1_1 = {
  $id: 'user_profile',
  properties: {
    name: { type: 'string' },
    email: { type: 'string', format: 'email' },
    avatar: { type: 'string', format: 'uri' } // New optional field
  },
  required: ['name', 'email'] // Same requirements
};
```

This design provides a robust, type-safe communication system that scales from simple WebSocket chat applications to complex distributed systems while maintaining simplicity and performance.