/**
 * @legion/codec - General-purpose typed communication codec
 * 
 * Provides schema-based message encoding/decoding with validation
 * for WebSocket and other message passing systems.
 */

export { Codec } from './Codec.js';
export { SchemaValidator } from './validators/SchemaValidator.js';
export { SchemaRegistry } from './schemas/index.js';
export * from './schemas/base.js';