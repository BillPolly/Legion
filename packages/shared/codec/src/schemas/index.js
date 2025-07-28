/**
 * Schema Registry - Central repository for all message schemas
 */

import { 
  SCHEMA_DEFINITION_MESSAGE, 
  ERROR_MESSAGE, 
  ACK_MESSAGE, 
  PING_MESSAGE, 
  PONG_MESSAGE 
} from './base.js';

export class SchemaRegistry {
  constructor() {
    this.schemas = new Map();
    this.version = '1.0.0';
    
    // Register base schemas
    this.registerBaseSchemas();
  }

  /**
   * Register base system schemas
   * @private
   */
  registerBaseSchemas() {
    this.register(SCHEMA_DEFINITION_MESSAGE);
    this.register(ERROR_MESSAGE);
    this.register(ACK_MESSAGE);
    this.register(PING_MESSAGE);
    this.register(PONG_MESSAGE);
  }

  /**
   * Register a schema in the registry
   * @param {object} schema - JSON schema with $id property
   */
  register(schema) {
    if (!schema.$id) {
      throw new Error('Schema must have an $id property');
    }

    this.schemas.set(schema.$id, schema);
  }

  /**
   * Get a schema by ID
   * @param {string} schemaId - Schema identifier
   * @returns {object|null} Schema definition or null if not found
   */
  get(schemaId) {
    return this.schemas.get(schemaId) || null;
  }

  /**
   * Get all registered schema IDs
   * @returns {string[]} Array of schema identifiers
   */
  getSchemaIds() {
    return Array.from(this.schemas.keys());
  }

  /**
   * Get all schemas as an object (for schema definition message)
   * @returns {object} Object with schema IDs as keys and schemas as values
   */
  getAll() {
    const result = {};
    for (const [id, schema] of this.schemas) {
      result[id] = schema;
    }
    return result;
  }

  /**
   * Check if a schema exists
   * @param {string} schemaId - Schema identifier
   * @returns {boolean} True if schema exists
   */
  has(schemaId) {
    return this.schemas.has(schemaId);
  }

  /**
   * Remove a schema from the registry
   * @param {string} schemaId - Schema identifier
   * @returns {boolean} True if schema was removed
   */
  unregister(schemaId) {
    return this.schemas.delete(schemaId);
  }

  /**
   * Get the registry version
   * @returns {string} Version string
   */
  getVersion() {
    return this.version;
  }

  /**
   * Set the registry version
   * @param {string} version - Version string (semver format)
   */
  setVersion(version) {
    if (!/^\d+\.\d+\.\d+$/.test(version)) {
      throw new Error('Version must be in semver format (x.y.z)');
    }
    this.version = version;
  }

  /**
   * Load schemas from an object (used when receiving schema definition)
   * @param {object} schemas - Object with schema IDs as keys
   * @param {boolean} replace - Whether to replace existing schemas
   */
  loadSchemas(schemas, replace = false) {
    if (replace) {
      this.schemas.clear();
      this.registerBaseSchemas();
    }

    for (const [id, schema] of Object.entries(schemas)) {
      if (!schema.$id) {
        schema.$id = id;
      }
      this.register(schema);
    }
  }

  /**
   * Create a schema definition message
   * @returns {object} Schema definition message
   */
  createSchemaDefinitionMessage() {
    return {
      type: 'schema_definition',
      version: this.version,
      schemas: this.getAll(),
      timestamp: new Date().toISOString()
    };
  }
}