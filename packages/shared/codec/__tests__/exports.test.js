/**
 * Test that all package exports work correctly
 */

import { 
  Codec, 
  SchemaValidator, 
  SchemaRegistry,
  SCHEMA_DEFINITION_MESSAGE,
  ERROR_MESSAGE,
  ACK_MESSAGE,
  PING_MESSAGE,
  PONG_MESSAGE
} from '../src/index.js';

describe('Package Exports', () => {
  test('exports main classes correctly', () => {
    expect(Codec).toBeDefined();
    expect(SchemaValidator).toBeDefined();
    expect(SchemaRegistry).toBeDefined();
  });

  test('exports base schemas correctly', () => {
    expect(SCHEMA_DEFINITION_MESSAGE).toBeDefined();
    expect(ERROR_MESSAGE).toBeDefined();
    expect(ACK_MESSAGE).toBeDefined();
    expect(PING_MESSAGE).toBeDefined();
    expect(PONG_MESSAGE).toBeDefined();
  });

  test('can instantiate exported classes', () => {
    const codec = new Codec();
    const validator = new SchemaValidator();
    const registry = new SchemaRegistry();

    expect(codec).toBeInstanceOf(Codec);
    expect(validator).toBeInstanceOf(SchemaValidator);
    expect(registry).toBeInstanceOf(SchemaRegistry);
  });

  test('exported schemas have correct structure', () => {
    expect(SCHEMA_DEFINITION_MESSAGE.$id).toBe('schema_definition');
    expect(ERROR_MESSAGE.$id).toBe('error_message');
    expect(ACK_MESSAGE.$id).toBe('ack_message');
    expect(PING_MESSAGE.$id).toBe('ping_message');
    expect(PONG_MESSAGE.$id).toBe('pong_message');
  });

  test('can use exported components together', () => {
    const codec = new Codec();
    const testMessage = { content: 'Hello from exports test' };
    
    // Register a simple schema
    const simpleSchema = {
      $id: 'simple_test',
      type: 'object',
      properties: {
        type: { type: 'string', const: 'simple_test' },
        content: { type: 'string' },
        messageId: { type: 'string' },
        timestamp: { type: 'string', format: 'date-time' }
      },
      required: ['type', 'content', 'messageId', 'timestamp']
    };

    codec.registerSchema(simpleSchema);

    // Test encoding/decoding
    const encoded = codec.encode('simple_test', testMessage);
    expect(encoded.success).toBe(true);

    const decoded = codec.decode(encoded.encoded);
    expect(decoded.success).toBe(true);
    expect(decoded.decoded.content).toBe('Hello from exports test');
  });
});