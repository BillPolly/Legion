/**
 * JSON Schema Loader - Converts JSON Schema to KG triples
 * 
 * This class handles the conversion of JSON Schema definitions into
 * knowledge graph triples, enabling storage and querying of schemas
 * within the KG system.
 */

import { SchemaVocabulary } from '../core/SchemaVocabulary.js';

export class JSONSchemaLoader {
  constructor(kgEngine) {
    this.kg = kgEngine;
    this.vocabulary = new SchemaVocabulary(kgEngine);
    this.idCounter = 0;
  }

  /**
   * Load a JSON Schema into the knowledge graph
   * @param {Object} jsonSchema - The JSON Schema object
   * @param {string} schemaId - The ID to use for the schema in the KG
   * @returns {Promise<boolean>} True if loaded successfully
   */
  async loadSchema(jsonSchema, schemaId) {
    // Ensure vocabulary is initialized
    await this.vocabulary.initialize();
    
    // Validate the JSON Schema
    if (!this._isValidJSONSchema(jsonSchema)) {
      throw new Error('Invalid JSON Schema provided');
    }
    
    // Convert to triples
    const triples = this._convertSchemaToTriples(jsonSchema, schemaId);
    
    // Add triples to KG
    if (this.kg.addTriples) {
      await this.kg.addTriples(triples);
    } else {
      // Fallback for synchronous API
      triples.forEach(([s, p, o]) => {
        this.kg.addTriple(s, p, o);
      });
    }
    
    return true;
  }

  /**
   * Convert JSON Schema to KG triples
   * @param {Object} schema - The JSON Schema object
   * @param {string} schemaId - The schema ID
   * @returns {Array<Array>} Array of [subject, predicate, object] triples
   * @private
   */
  _convertSchemaToTriples(schema, schemaId) {
    const triples = [];
    
    // Schema type declaration
    triples.push([schemaId, 'rdf:type', 'kg:Schema']);
    triples.push([schemaId, 'rdf:type', 'kg:JSONSchema']);
    
    // Schema metadata
    this._addMetadataTriples(schema, schemaId, triples);
    
    // Schema type
    if (schema.type) {
      const kgType = this._mapJSONSchemaTypeToKG(schema.type);
      triples.push([schemaId, 'kg:schemaType', kgType]);
    }
    
    // Schema constraints
    this._addConstraintTriples(schema, schemaId, triples);
    
    // Properties (for object schemas)
    if (schema.type === 'object' && schema.properties) {
      this._addPropertyTriples(schema.properties, schemaId, triples, schema.required || []);
    }
    
    // Additional properties
    if (schema.additionalProperties !== undefined) {
      triples.push([schemaId, 'kg:additionalProperties', schema.additionalProperties]);
    }
    
    // Array items schema
    if (schema.type === 'array' && schema.items) {
      this._addArrayItemsTriples(schema.items, schemaId, triples);
    }
    
    // Schema composition (allOf, oneOf, anyOf, not)
    this._addCompositionTriples(schema, schemaId, triples);
    
    // Conditional schemas (if/then/else)
    this._addConditionalTriples(schema, schemaId, triples);
    
    return triples;
  }

  /**
   * Add metadata triples (title, description, etc.)
   * @private
   */
  _addMetadataTriples(schema, schemaId, triples) {
    if (schema.title) {
      triples.push([schemaId, 'rdfs:label', schema.title]);
    }
    
    if (schema.description) {
      triples.push([schemaId, 'rdfs:comment', schema.description]);
    }
    
    if (schema.$id) {
      triples.push([schemaId, 'kg:schemaUri', schema.$id]);
    }
    
    if (schema.$schema) {
      triples.push([schemaId, 'kg:schemaFormat', schema.$schema]);
    }
    
    if (schema.version) {
      triples.push([schemaId, 'kg:version', schema.version]);
    }
    
    if (schema.default !== undefined) {
      triples.push([schemaId, 'kg:defaultValue', schema.default]);
    }
    
    if (schema.examples && Array.isArray(schema.examples)) {
      schema.examples.forEach(example => {
        triples.push([schemaId, 'kg:examples', example]);
      });
    }
    
    if (schema.deprecated === true) {
      triples.push([schemaId, 'kg:deprecated', true]);
    }
  }

  /**
   * Add constraint triples
   * @private
   */
  _addConstraintTriples(schema, schemaId, triples) {
    // String constraints
    if (schema.minLength !== undefined) {
      triples.push([schemaId, 'kg:minLength', schema.minLength]);
    }
    if (schema.maxLength !== undefined) {
      triples.push([schemaId, 'kg:maxLength', schema.maxLength]);
    }
    if (schema.pattern) {
      triples.push([schemaId, 'kg:pattern', schema.pattern]);
    }
    if (schema.format) {
      triples.push([schemaId, 'kg:format', schema.format]);
    }
    
    // Numeric constraints
    if (schema.minimum !== undefined) {
      triples.push([schemaId, 'kg:minimum', schema.minimum]);
    }
    if (schema.maximum !== undefined) {
      triples.push([schemaId, 'kg:maximum', schema.maximum]);
    }
    if (schema.exclusiveMinimum !== undefined) {
      triples.push([schemaId, 'kg:exclusiveMinimum', schema.exclusiveMinimum]);
    }
    if (schema.exclusiveMaximum !== undefined) {
      triples.push([schemaId, 'kg:exclusiveMaximum', schema.exclusiveMaximum]);
    }
    if (schema.multipleOf !== undefined) {
      triples.push([schemaId, 'kg:multipleOf', schema.multipleOf]);
    }
    
    // Array constraints
    if (schema.minItems !== undefined) {
      triples.push([schemaId, 'kg:minItems', schema.minItems]);
    }
    if (schema.maxItems !== undefined) {
      triples.push([schemaId, 'kg:maxItems', schema.maxItems]);
    }
    if (schema.uniqueItems !== undefined) {
      triples.push([schemaId, 'kg:uniqueItems', schema.uniqueItems]);
    }
    
    // Object constraints
    if (schema.minProperties !== undefined) {
      triples.push([schemaId, 'kg:minProperties', schema.minProperties]);
    }
    if (schema.maxProperties !== undefined) {
      triples.push([schemaId, 'kg:maxProperties', schema.maxProperties]);
    }
    
    // Enumeration constraint
    if (schema.enum && Array.isArray(schema.enum)) {
      triples.push([schemaId, 'kg:enum', JSON.stringify(schema.enum)]);
    }
    
    // Const constraint (treated as single-value enum)
    if (schema.const !== undefined) {
      triples.push([schemaId, 'kg:enum', JSON.stringify([schema.const])]);
    }
  }

  /**
   * Add property triples for object schemas
   * @private
   */
  _addPropertyTriples(properties, schemaId, triples, required) {
    Object.entries(properties).forEach(([propName, propSchema]) => {
      const propId = this._generatePropertyId(schemaId, propName);
      
      // Link property to schema
      triples.push([schemaId, 'kg:hasProperty', propId]);
      
      // Property metadata
      triples.push([propId, 'rdf:type', 'kg:Property']);
      triples.push([propId, 'kg:propertyName', propName]);
      
      // Property type
      if (propSchema.type) {
        const kgType = this._mapJSONSchemaTypeToKG(propSchema.type);
        triples.push([propId, 'kg:dataType', kgType]);
      }
      
      // Required status
      const isRequired = required.includes(propName);
      triples.push([propId, 'kg:required', isRequired]);
      
      // Property metadata
      if (propSchema.title) {
        triples.push([propId, 'rdfs:label', propSchema.title]);
      }
      if (propSchema.description) {
        triples.push([propId, 'rdfs:comment', propSchema.description]);
      }
      if (propSchema.default !== undefined) {
        triples.push([propId, 'kg:defaultValue', propSchema.default]);
      }
      if (propSchema.deprecated === true) {
        triples.push([propId, 'kg:deprecated', true]);
      }
      
      // Property constraints
      this._addPropertyConstraintTriples(propSchema, propId, triples);
      
      // Examples
      if (propSchema.examples && Array.isArray(propSchema.examples)) {
        propSchema.examples.forEach(example => {
          triples.push([propId, 'kg:examples', example]);
        });
      }
      
      // Nested object properties
      if (propSchema.type === 'object' && propSchema.properties) {
        const nestedSchemaId = this._generateNestedSchemaId(propId);
        triples.push([propId, 'kg:nestedSchema', nestedSchemaId]);
        
        // Recursively add nested schema
        const nestedTriples = this._convertSchemaToTriples(propSchema, nestedSchemaId);
        triples.push(...nestedTriples);
      }
      
      // Array items
      if (propSchema.type === 'array' && propSchema.items) {
        this._addArrayItemsTriples(propSchema.items, propId, triples);
      }
      
      // Property-level composition (oneOf, anyOf, allOf, not)
      this._addCompositionTriples(propSchema, propId, triples);
    });
  }

  /**
   * Add property-specific constraint triples
   * @private
   */
  _addPropertyConstraintTriples(propSchema, propId, triples) {
    // String constraints
    if (propSchema.minLength !== undefined) {
      triples.push([propId, 'kg:minLength', propSchema.minLength]);
    }
    if (propSchema.maxLength !== undefined) {
      triples.push([propId, 'kg:maxLength', propSchema.maxLength]);
    }
    if (propSchema.pattern) {
      triples.push([propId, 'kg:pattern', propSchema.pattern]);
    }
    if (propSchema.format) {
      triples.push([propId, 'kg:format', propSchema.format]);
    }
    
    // Numeric constraints
    if (propSchema.minimum !== undefined) {
      triples.push([propId, 'kg:minimum', propSchema.minimum]);
    }
    if (propSchema.maximum !== undefined) {
      triples.push([propId, 'kg:maximum', propSchema.maximum]);
    }
    if (propSchema.exclusiveMinimum !== undefined) {
      triples.push([propId, 'kg:exclusiveMinimum', propSchema.exclusiveMinimum]);
    }
    if (propSchema.exclusiveMaximum !== undefined) {
      triples.push([propId, 'kg:exclusiveMaximum', propSchema.exclusiveMaximum]);
    }
    if (propSchema.multipleOf !== undefined) {
      triples.push([propId, 'kg:multipleOf', propSchema.multipleOf]);
    }
    
    // Array constraints
    if (propSchema.minItems !== undefined) {
      triples.push([propId, 'kg:minItems', propSchema.minItems]);
    }
    if (propSchema.maxItems !== undefined) {
      triples.push([propId, 'kg:maxItems', propSchema.maxItems]);
    }
    if (propSchema.uniqueItems !== undefined) {
      triples.push([propId, 'kg:uniqueItems', propSchema.uniqueItems]);
    }
    
    // Enumeration constraint
    if (propSchema.enum && Array.isArray(propSchema.enum)) {
      triples.push([propId, 'kg:enum', JSON.stringify(propSchema.enum)]);
    }
    
    // Const constraint
    if (propSchema.const !== undefined) {
      triples.push([propId, 'kg:enum', JSON.stringify([propSchema.const])]);
    }
  }

  /**
   * Add array items schema triples
   * @private
   */
  _addArrayItemsTriples(itemsSchema, parentId, triples) {
    if (typeof itemsSchema === 'object') {
      const itemsSchemaId = this._generateItemsSchemaId(parentId);
      triples.push([parentId, 'kg:items', itemsSchemaId]);
      
      // Recursively convert items schema
      const itemsTriples = this._convertSchemaToTriples(itemsSchema, itemsSchemaId);
      triples.push(...itemsTriples);
    }
  }

  /**
   * Add composition triples (allOf, oneOf, anyOf, not)
   * @private
   */
  _addCompositionTriples(schema, schemaId, triples) {
    if (schema.allOf && Array.isArray(schema.allOf)) {
      schema.allOf.forEach((subSchema, index) => {
        const subSchemaId = this._generateCompositionSchemaId(schemaId, 'allOf', index);
        triples.push([schemaId, 'kg:allOf', subSchemaId]);
        
        const subTriples = this._convertSchemaToTriples(subSchema, subSchemaId);
        triples.push(...subTriples);
      });
    }
    
    if (schema.oneOf && Array.isArray(schema.oneOf)) {
      schema.oneOf.forEach((subSchema, index) => {
        const subSchemaId = this._generateCompositionSchemaId(schemaId, 'oneOf', index);
        triples.push([schemaId, 'kg:oneOf', subSchemaId]);
        
        const subTriples = this._convertSchemaToTriples(subSchema, subSchemaId);
        triples.push(...subTriples);
      });
    }
    
    if (schema.anyOf && Array.isArray(schema.anyOf)) {
      schema.anyOf.forEach((subSchema, index) => {
        const subSchemaId = this._generateCompositionSchemaId(schemaId, 'anyOf', index);
        triples.push([schemaId, 'kg:anyOf', subSchemaId]);
        
        const subTriples = this._convertSchemaToTriples(subSchema, subSchemaId);
        triples.push(...subTriples);
      });
    }
    
    if (schema.not) {
      const notSchemaId = this._generateCompositionSchemaId(schemaId, 'not', 0);
      triples.push([schemaId, 'kg:not', notSchemaId]);
      
      const notTriples = this._convertSchemaToTriples(schema.not, notSchemaId);
      triples.push(...notTriples);
    }
  }

  /**
   * Add conditional triples (if/then/else)
   * @private
   */
  _addConditionalTriples(schema, schemaId, triples) {
    if (schema.if) {
      const ifSchemaId = this._generateConditionalSchemaId(schemaId, 'if');
      triples.push([schemaId, 'kg:if', ifSchemaId]);
      
      const ifTriples = this._convertSchemaToTriples(schema.if, ifSchemaId);
      triples.push(...ifTriples);
      
      if (schema.then) {
        const thenSchemaId = this._generateConditionalSchemaId(schemaId, 'then');
        triples.push([schemaId, 'kg:then', thenSchemaId]);
        
        const thenTriples = this._convertSchemaToTriples(schema.then, thenSchemaId);
        triples.push(...thenTriples);
      }
      
      if (schema.else) {
        const elseSchemaId = this._generateConditionalSchemaId(schemaId, 'else');
        triples.push([schemaId, 'kg:else', elseSchemaId]);
        
        const elseTriples = this._convertSchemaToTriples(schema.else, elseSchemaId);
        triples.push(...elseTriples);
      }
    }
  }

  /**
   * Map JSON Schema type to KG data type
   * @private
   */
  _mapJSONSchemaTypeToKG(jsonType) {
    const typeMap = {
      'string': 'kg:StringType',
      'number': 'kg:NumberType',
      'integer': 'kg:IntegerType',
      'boolean': 'kg:BooleanType',
      'null': 'kg:NullType',
      'object': 'kg:ObjectType',
      'array': 'kg:ArrayType'
    };
    
    return typeMap[jsonType] || 'kg:StringType';
  }

  /**
   * Validate JSON Schema structure
   * @private
   */
  _isValidJSONSchema(schema) {
    if (!schema || typeof schema !== 'object') {
      return false;
    }
    
    // Must have a type or be a composition schema
    if (!schema.type && !schema.allOf && !schema.oneOf && !schema.anyOf && !schema.not) {
      return false;
    }
    
    // Validate type if present
    if (schema.type) {
      const validTypes = ['string', 'number', 'integer', 'boolean', 'null', 'object', 'array'];
      if (!validTypes.includes(schema.type)) {
        return false;
      }
    }
    
    return true;
  }

  /**
   * Generate property ID
   * @private
   */
  _generatePropertyId(schemaId, propName) {
    return `${schemaId}_prop_${propName}`;
  }

  /**
   * Generate nested schema ID
   * @private
   */
  _generateNestedSchemaId(propId) {
    return `${propId}_nested`;
  }

  /**
   * Generate items schema ID
   * @private
   */
  _generateItemsSchemaId(parentId) {
    return `${parentId}_items`;
  }

  /**
   * Generate composition schema ID
   * @private
   */
  _generateCompositionSchemaId(schemaId, compositionType, index) {
    return `${schemaId}_${compositionType}_${index}`;
  }

  /**
   * Generate conditional schema ID
   * @private
   */
  _generateConditionalSchemaId(schemaId, conditionalType) {
    return `${schemaId}_${conditionalType}`;
  }

  /**
   * Generate unique ID
   * @private
   */
  _generateUniqueId() {
    return `schema_${Date.now()}_${++this.idCounter}`;
  }

  /**
   * Load multiple schemas at once
   * @param {Object} schemas - Object with schemaId -> schema mappings
   * @returns {Promise<boolean>} True if all loaded successfully
   */
  async loadSchemas(schemas) {
    const promises = Object.entries(schemas).map(([schemaId, schema]) => 
      this.loadSchema(schema, schemaId)
    );
    
    await Promise.all(promises);
    return true;
  }

  /**
   * Load schema from JSON string
   * @param {string} jsonString - JSON string containing the schema
   * @param {string} schemaId - The schema ID
   * @returns {Promise<boolean>} True if loaded successfully
   */
  async loadSchemaFromString(jsonString, schemaId) {
    try {
      const schema = JSON.parse(jsonString);
      return await this.loadSchema(schema, schemaId);
    } catch (error) {
      throw new Error(`Failed to parse JSON Schema: ${error.message}`);
    }
  }

  /**
   * Check if a schema exists in the KG
   * @param {string} schemaId - The schema ID to check
   * @returns {Promise<boolean>} True if the schema exists
   */
  async schemaExists(schemaId) {
    if (this.kg.exists) {
      return await this.kg.exists(schemaId, 'rdf:type', 'kg:Schema');
    } else {
      const result = this.kg.query(schemaId, 'rdf:type', 'kg:Schema');
      return result.length > 0;
    }
  }

  /**
   * Remove a schema from the KG
   * @param {string} schemaId - The schema ID to remove
   * @returns {Promise<boolean>} True if removed successfully
   */
  async removeSchema(schemaId) {
    // Get all triples related to this schema
    const schemaTriples = this.kg.query(schemaId, null, null);
    const propertyTriples = this.kg.query(null, 'kg:hasProperty', null)
      .filter(([subject]) => subject === schemaId);
    
    // Get property IDs and their triples
    const propertyIds = propertyTriples.map(([,, propId]) => propId);
    const allPropertyTriples = propertyIds.flatMap(propId => 
      this.kg.query(propId, null, null)
    );
    
    // Remove all triples
    const allTriples = [...schemaTriples, ...allPropertyTriples];
    
    if (this.kg.removeTriples) {
      await this.kg.removeTriples(allTriples);
    } else {
      // Fallback for synchronous API
      allTriples.forEach(([s, p, o]) => {
        this.kg.removeTriple(s, p, o);
      });
    }
    
    return true;
  }
}

export default JSONSchemaLoader;
