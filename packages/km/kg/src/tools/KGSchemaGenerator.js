/**
 * Generates JSON schemas for LLM function calling from KG data
 * Note: This is different from @legion/schema which converts JSON schemas to Zod
 */
export class KGSchemaGenerator {
  constructor(kgEngine) {
    this.kg = kgEngine;
  }

  /**
   * Generate JSON schema for a method
   */
  generateMethodSchema(methodId) {
    const methodName = this._getValue(methodId, 'kg:methodName');
    const description = this._getValue(methodId, 'kg:description') || 
                       `Method: ${methodName}`;

    const parameters = this._getMethodParameters(methodId);
    const required = parameters
      .filter(p => p.required)
      .map(p => p.name);

    return {
      name: methodName,
      description: description,
      parameters: {
        type: "object",
        properties: this._generateParameterProperties(parameters),
        required: required.length > 0 ? required : undefined
      }
    };
  }

  /**
   * Generate schemas for all methods of a tool
   */
  generateToolSchemas(toolId) {
    const methods = [
      ...this.kg.query(null, 'kg:methodOf', toolId),
      ...this.kg.query(null, 'kg:staticMethodOf', toolId)
    ].map(([methodId]) => methodId);

    return methods.map(methodId => this.generateMethodSchema(methodId));
  }

  /**
   * Generate schemas for all registered tools
   */
  generateAllToolSchemas() {
    const tools = this.kg.query(null, 'rdf:type', 'kg:AgentTool')
      .map(([toolId]) => toolId);

    const schemas = [];
    tools.forEach(toolId => {
      const toolSchemas = this.generateToolSchemas(toolId);
      schemas.push(...toolSchemas);
    });

    return schemas;
  }

  // Helper methods
  _getValue(subject, predicate) {
    const results = this.kg.query(subject, predicate, null);
    return results.length > 0 ? results[0][2] : null;
  }

  _getMethodParameters(methodId) {
    const paramIds = this.kg.query(null, 'kg:parameterOf', methodId)
      .map(([paramId]) => paramId)
      .sort((a, b) => {
        const aIndex = this._getValue(a, 'kg:parameterIndex') || 0;
        const bIndex = this._getValue(b, 'kg:parameterIndex') || 0;
        return aIndex - bIndex;
      });

    return paramIds.map(paramId => ({
      id: paramId,
      name: this._getValue(paramId, 'kg:parameterName'),
      type: this._getValue(paramId, 'kg:hasType'),
      required: this._getValue(paramId, 'kg:isRequired') !== false,
      defaultValue: this._getValue(paramId, 'kg:defaultValue'),
      description: this._getValue(paramId, 'kg:description'),
      allowedValues: this.kg.query(paramId, 'kg:allowedValue', null)
        .map(([, , value]) => value)
    }));
  }

  _generateParameterProperties(parameters) {
    const properties = {};
    
    parameters.forEach(param => {
      // Skip parameters without a name
      if (!param.name) {
        return;
      }

      const property = {
        type: this._mapTypeToJsonSchema(param.type)
      };

      if (param.description) {
        property.description = param.description;
      }

      if (param.allowedValues && param.allowedValues.length > 0) {
        property.enum = param.allowedValues;
      }

      if (param.defaultValue !== undefined && param.defaultValue !== null) {
        property.default = param.defaultValue;
      }

      properties[param.name] = property;
    });

    return properties;
  }

  _mapTypeToJsonSchema(type) {
    const typeMap = {
      'String': 'string',
      'Number': 'number', 
      'Boolean': 'boolean',
      'Array': 'array',
      'Object': 'object'
    };
    return typeMap[type] || 'string';
  }
}
