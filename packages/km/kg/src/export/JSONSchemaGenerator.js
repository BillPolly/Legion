/**
 * Generates JSON schemas from KG class definitions
 */
export class JSONSchemaGenerator {
  constructor(kgEngine) {
    this.kg = kgEngine;
  }

  /**
   * Generate JSON Schema for a class
   */
  generateClassSchema(classId) {
    const className = this._getValue(classId, 'kg:className');
    const properties = this._getClassProperties(classId);
    const required = properties
      .filter(p => p.required)
      .map(p => p.name);

    return {
      $schema: "http://json-schema.org/draft-07/schema#",
      type: "object",
      title: className,
      properties: this._generatePropertySchemas(properties),
      required: required.length > 0 ? required : undefined,
      additionalProperties: false
    };
  }

  /**
   * Generate JSON Schema for all registered classes
   */
  generateAllClassSchemas() {
    const classes = this.kg.query('?', 'rdf:type', 'kg:EntityClass')
      .map(([classId]) => classId);

    const schemas = {};
    classes.forEach(classId => {
      const className = this._getValue(classId, 'kg:className');
      if (className) {
        schemas[className] = this.generateClassSchema(classId);
      }
    });

    return schemas;
  }

  /**
   * Generate OpenAPI-style schemas
   */
  generateOpenAPISchemas() {
    const schemas = this.generateAllClassSchemas();
    return {
      openapi: "3.0.0",
      components: {
        schemas: schemas
      }
    };
  }

  // Helper methods
  _getValue(subject, predicate) {
    const results = this.kg.query(subject, predicate, '?');
    return results.length > 0 ? results[0][2] : null;
  }

  _getClassProperties(classId) {
    // Get properties from class metadata or infer from instances
    const propertyIds = this.kg.query('?', 'kg:propertyOf', classId)
      .map(([propId]) => propId);

    return propertyIds.map(propId => ({
      id: propId,
      name: this._getValue(propId, 'kg:propertyName'),
      type: this._getValue(propId, 'kg:hasType'),
      required: this._getValue(propId, 'kg:required') !== false,
      description: this._getValue(propId, 'kg:description')
    }));
  }

  _generatePropertySchemas(properties) {
    const schemas = {};
    
    properties.forEach(prop => {
      const schema = {
        type: this._mapTypeToJsonSchema(prop.type)
      };

      if (prop.description) {
        schema.description = prop.description;
      }

      schemas[prop.name] = schema;
    });

    return schemas;
  }

  _mapTypeToJsonSchema(type) {
    const typeMap = {
      'String': 'string',
      'Number': 'number', 
      'Boolean': 'boolean',
      'Array': 'array',
      'Object': 'object',
      'Date': 'string' // with format: date-time
    };
    return typeMap[type] || 'string';
  }
}
