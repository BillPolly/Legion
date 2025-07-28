/**
 * Basic usage example for @legion/codec
 */

import { Codec } from '../src/index.js';

// Create a codec instance
const codec = new Codec();

// Define a custom message schema
const chatMessageSchema = {
  $id: 'chat_message',
  type: 'object',
  properties: {
    type: { type: 'string', const: 'chat_message' },
    username: { type: 'string', minLength: 1 },
    message: { type: 'string', minLength: 1 },
    channel: { type: 'string' },
    messageId: { type: 'string' },
    timestamp: { type: 'string', format: 'date-time' }
  },
  required: ['type', 'username', 'message', 'messageId', 'timestamp']
};

// Register the schema
codec.registerSchema(chatMessageSchema);

// Encode a message
const messageData = {
  username: 'alice',
  message: 'Hello everyone!',
  channel: 'general'
};

const encodedResult = codec.encode('chat_message', messageData);
console.log('Encoded result:', encodedResult);

if (encodedResult.success) {
  console.log('Encoded message:', encodedResult.encoded);
  
  // Decode the message
  const decodedResult = codec.decode(encodedResult.encoded);
  console.log('Decoded result:', decodedResult);
  
  if (decodedResult.success) {
    console.log('Original username:', decodedResult.decoded.username);
    console.log('Original message:', decodedResult.decoded.message);
  }
}

// Create protocol messages
const errorMessage = codec.createErrorMessage('VALIDATION_ERROR', 'Invalid input');
console.log('Error message:', errorMessage);

const ackMessage = codec.createAckMessage('msg_123', 'success');
console.log('Ack message:', ackMessage);

// Schema negotiation
const schemaDefinition = codec.createSchemaDefinitionMessage();
console.log('Schema definition keys:', Object.keys(schemaDefinition.schemas));