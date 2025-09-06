import { KGSchemaGenerator } from '../../../src/tools/KGSchemaGenerator.js';
import { KGEngine } from '../../../src/core/KGEngine.js';
import { WeatherTool } from '@legion/kg-examples';
import '../../../src/serialization/ObjectExtensions.js';

describe('KGSchemaGenerator', () => {
  let kgEngine, schemaGenerator;

  beforeEach(() => {
    kgEngine = new KGEngine();
    schemaGenerator = new KGSchemaGenerator(kgEngine);
  });

  describe('Constructor', () => {
    test('should initialize with KG engine', () => {
      expect(schemaGenerator.kg).toBe(kgEngine);
    });
  });

  describe('Method Schema Generation', () => {
    beforeEach(() => {
      // Set up a test method with parameters
      const methodId = 'test_method_id';
      kgEngine.addTriple(methodId, 'kg:methodName', 'getCurrentWeather');
      kgEngine.addTriple(methodId, 'kg:description', 'Get current weather for a location');

      // Add parameters
      const param1Id = 'param_location';
      const param2Id = 'param_units';

      kgEngine.addTriple(param1Id, 'kg:parameterOf', methodId);
      kgEngine.addTriple(param1Id, 'kg:parameterName', 'location');
      kgEngine.addTriple(param1Id, 'kg:hasType', 'String');
      kgEngine.addTriple(param1Id, 'kg:isRequired', true);
      kgEngine.addTriple(param1Id, 'kg:parameterIndex', 0);
      kgEngine.addTriple(param1Id, 'kg:description', 'Location to get weather for');

      kgEngine.addTriple(param2Id, 'kg:parameterOf', methodId);
      kgEngine.addTriple(param2Id, 'kg:parameterName', 'units');
      kgEngine.addTriple(param2Id, 'kg:hasType', 'String');
      kgEngine.addTriple(param2Id, 'kg:isRequired', false);
      kgEngine.addTriple(param2Id, 'kg:parameterIndex', 1);
      kgEngine.addTriple(param2Id, 'kg:defaultValue', 'metric');
      kgEngine.addTriple(param2Id, 'kg:allowedValue', 'metric');
      kgEngine.addTriple(param2Id, 'kg:allowedValue', 'imperial');
      kgEngine.addTriple(param2Id, 'kg:allowedValue', 'kelvin');
    });

    test('should generate basic method schema', () => {
      const schema = schemaGenerator.generateMethodSchema('test_method_id');

      expect(schema).toEqual({
        name: 'getCurrentWeather',
        description: 'Get current weather for a location',
        parameters: {
          type: 'object',
          properties: {
            location: {
              type: 'string',
              description: 'Location to get weather for'
            },
            units: {
              type: 'string',
              default: 'metric',
              enum: ['metric', 'imperial', 'kelvin']
            }
          },
          required: ['location']
        }
      });
    });

    test('should handle method without description', () => {
      const methodId = 'method_no_desc';
      kgEngine.addTriple(methodId, 'kg:methodName', 'testMethod');

      const schema = schemaGenerator.generateMethodSchema(methodId);

      expect(schema.name).toBe('testMethod');
      expect(schema.description).toBe('Method: testMethod');
    });

    test('should handle method with no parameters', () => {
      const methodId = 'method_no_params';
      kgEngine.addTriple(methodId, 'kg:methodName', 'simpleMethod');

      const schema = schemaGenerator.generateMethodSchema(methodId);

      expect(schema.parameters.properties).toEqual({});
      expect(schema.parameters.required).toBeUndefined();
    });

    test('should handle method with all optional parameters', () => {
      const methodId = 'method_optional_params';
      kgEngine.addTriple(methodId, 'kg:methodName', 'optionalMethod');

      const paramId = 'optional_param';
      kgEngine.addTriple(paramId, 'kg:parameterOf', methodId);
      kgEngine.addTriple(paramId, 'kg:parameterName', 'optionalParam');
      kgEngine.addTriple(paramId, 'kg:hasType', 'String');
      kgEngine.addTriple(paramId, 'kg:isRequired', false);

      const schema = schemaGenerator.generateMethodSchema(methodId);

      expect(schema.parameters.required).toBeUndefined();
      expect(schema.parameters.properties.optionalParam).toBeDefined();
    });

    test('should sort parameters by index', () => {
      const methodId = 'method_sorted_params';
      kgEngine.addTriple(methodId, 'kg:methodName', 'sortedMethod');

      // Add parameters out of order
      const param1Id = 'param_third';
      const param2Id = 'param_first';
      const param3Id = 'param_second';

      kgEngine.addTriple(param1Id, 'kg:parameterOf', methodId);
      kgEngine.addTriple(param1Id, 'kg:parameterName', 'third');
      kgEngine.addTriple(param1Id, 'kg:parameterIndex', 2);
      kgEngine.addTriple(param1Id, 'kg:hasType', 'String');

      kgEngine.addTriple(param2Id, 'kg:parameterOf', methodId);
      kgEngine.addTriple(param2Id, 'kg:parameterName', 'first');
      kgEngine.addTriple(param2Id, 'kg:parameterIndex', 0);
      kgEngine.addTriple(param2Id, 'kg:hasType', 'String');

      kgEngine.addTriple(param3Id, 'kg:parameterOf', methodId);
      kgEngine.addTriple(param3Id, 'kg:parameterName', 'second');
      kgEngine.addTriple(param3Id, 'kg:parameterIndex', 1);
      kgEngine.addTriple(param3Id, 'kg:hasType', 'String');

      const schema = schemaGenerator.generateMethodSchema(methodId);

      const propertyNames = Object.keys(schema.parameters.properties);
      expect(propertyNames).toEqual(['first', 'second', 'third']);
    });
  });

  describe('Parameter Type Mapping', () => {
    beforeEach(() => {
      const methodId = 'type_test_method';
      kgEngine.addTriple(methodId, 'kg:methodName', 'typeTestMethod');
    });

    test('should map JavaScript types to JSON Schema types', () => {
      const methodId = 'type_test_method';
      const types = [
        { jsType: 'String', jsonType: 'string' },
        { jsType: 'Number', jsonType: 'number' },
        { jsType: 'Boolean', jsonType: 'boolean' },
        { jsType: 'Array', jsonType: 'array' },
        { jsType: 'Object', jsonType: 'object' }
      ];

      types.forEach((typeTest, index) => {
        const paramId = `param_${index}`;
        kgEngine.addTriple(paramId, 'kg:parameterOf', methodId);
        kgEngine.addTriple(paramId, 'kg:parameterName', `param${index}`);
        kgEngine.addTriple(paramId, 'kg:hasType', typeTest.jsType);
      });

      const schema = schemaGenerator.generateMethodSchema(methodId);

      types.forEach((typeTest, index) => {
        const paramName = `param${index}`;
        expect(schema.parameters.properties[paramName].type).toBe(typeTest.jsonType);
      });
    });

    test('should default unknown types to string', () => {
      const methodId = 'type_test_method';
      const paramId = 'unknown_type_param';
      
      kgEngine.addTriple(paramId, 'kg:parameterOf', methodId);
      kgEngine.addTriple(paramId, 'kg:parameterName', 'unknownParam');
      kgEngine.addTriple(paramId, 'kg:hasType', 'CustomType');

      const schema = schemaGenerator.generateMethodSchema(methodId);

      expect(schema.parameters.properties.unknownParam.type).toBe('string');
    });

    test('should handle missing type information', () => {
      const methodId = 'type_test_method';
      const paramId = 'no_type_param';
      
      kgEngine.addTriple(paramId, 'kg:parameterOf', methodId);
      kgEngine.addTriple(paramId, 'kg:parameterName', 'noTypeParam');

      const schema = schemaGenerator.generateMethodSchema(methodId);

      expect(schema.parameters.properties.noTypeParam.type).toBe('string');
    });
  });

  describe('Parameter Properties', () => {
    test('should include parameter description', () => {
      const methodId = 'desc_test_method';
      kgEngine.addTriple(methodId, 'kg:methodName', 'descTestMethod');

      const paramId = 'desc_param';
      kgEngine.addTriple(paramId, 'kg:parameterOf', methodId);
      kgEngine.addTriple(paramId, 'kg:parameterName', 'descParam');
      kgEngine.addTriple(paramId, 'kg:hasType', 'String');
      kgEngine.addTriple(paramId, 'kg:description', 'Parameter with description');

      const schema = schemaGenerator.generateMethodSchema(methodId);

      expect(schema.parameters.properties.descParam.description).toBe('Parameter with description');
    });

    test('should include default values', () => {
      const methodId = 'default_test_method';
      kgEngine.addTriple(methodId, 'kg:methodName', 'defaultTestMethod');

      const paramId = 'default_param';
      kgEngine.addTriple(paramId, 'kg:parameterOf', methodId);
      kgEngine.addTriple(paramId, 'kg:parameterName', 'defaultParam');
      kgEngine.addTriple(paramId, 'kg:hasType', 'String');
      kgEngine.addTriple(paramId, 'kg:defaultValue', 'default_value');

      const schema = schemaGenerator.generateMethodSchema(methodId);

      expect(schema.parameters.properties.defaultParam.default).toBe('default_value');
    });

    test('should include enum values for allowed values', () => {
      const methodId = 'enum_test_method';
      kgEngine.addTriple(methodId, 'kg:methodName', 'enumTestMethod');

      const paramId = 'enum_param';
      kgEngine.addTriple(paramId, 'kg:parameterOf', methodId);
      kgEngine.addTriple(paramId, 'kg:parameterName', 'enumParam');
      kgEngine.addTriple(paramId, 'kg:hasType', 'String');
      kgEngine.addTriple(paramId, 'kg:allowedValue', 'option1');
      kgEngine.addTriple(paramId, 'kg:allowedValue', 'option2');
      kgEngine.addTriple(paramId, 'kg:allowedValue', 'option3');

      const schema = schemaGenerator.generateMethodSchema(methodId);

      expect(schema.parameters.properties.enumParam.enum).toEqual(['option1', 'option2', 'option3']);
    });

    test('should not include enum for parameters without allowed values', () => {
      const methodId = 'no_enum_test_method';
      kgEngine.addTriple(methodId, 'kg:methodName', 'noEnumTestMethod');

      const paramId = 'no_enum_param';
      kgEngine.addTriple(paramId, 'kg:parameterOf', methodId);
      kgEngine.addTriple(paramId, 'kg:parameterName', 'noEnumParam');
      kgEngine.addTriple(paramId, 'kg:hasType', 'String');

      const schema = schemaGenerator.generateMethodSchema(methodId);

      expect(schema.parameters.properties.noEnumParam.enum).toBeUndefined();
    });

    test('should handle numeric default values', () => {
      const methodId = 'numeric_default_method';
      kgEngine.addTriple(methodId, 'kg:methodName', 'numericDefaultMethod');

      const paramId = 'numeric_param';
      kgEngine.addTriple(paramId, 'kg:parameterOf', methodId);
      kgEngine.addTriple(paramId, 'kg:parameterName', 'numericParam');
      kgEngine.addTriple(paramId, 'kg:hasType', 'Number');
      kgEngine.addTriple(paramId, 'kg:defaultValue', 42);

      const schema = schemaGenerator.generateMethodSchema(methodId);

      expect(schema.parameters.properties.numericParam.default).toBe(42);
      expect(schema.parameters.properties.numericParam.type).toBe('number');
    });

    test('should handle boolean default values', () => {
      const methodId = 'boolean_default_method';
      kgEngine.addTriple(methodId, 'kg:methodName', 'booleanDefaultMethod');

      const paramId = 'boolean_param';
      kgEngine.addTriple(paramId, 'kg:parameterOf', methodId);
      kgEngine.addTriple(paramId, 'kg:parameterName', 'booleanParam');
      kgEngine.addTriple(paramId, 'kg:hasType', 'Boolean');
      kgEngine.addTriple(paramId, 'kg:defaultValue', true);

      const schema = schemaGenerator.generateMethodSchema(methodId);

      expect(schema.parameters.properties.booleanParam.default).toBe(true);
      expect(schema.parameters.properties.booleanParam.type).toBe('boolean');
    });
  });

  describe('Tool Schema Generation', () => {
    beforeEach(() => {
      // Set up a tool with multiple methods
      const toolId = 'test_tool_id';
      kgEngine.addTriple(toolId, 'rdf:type', 'kg:AgentTool');

      // Method 1
      const method1Id = 'method_1';
      kgEngine.addTriple(method1Id, 'kg:methodOf', toolId);
      kgEngine.addTriple(method1Id, 'kg:methodName', 'method1');

      // Method 2 (static)
      const method2Id = 'method_2';
      kgEngine.addTriple(method2Id, 'kg:staticMethodOf', toolId);
      kgEngine.addTriple(method2Id, 'kg:methodName', 'method2');

      // Method 3 (instance)
      const method3Id = 'method_3';
      kgEngine.addTriple(method3Id, 'kg:methodOf', toolId);
      kgEngine.addTriple(method3Id, 'kg:methodName', 'method3');
    });

    test('should generate schemas for all tool methods', () => {
      const schemas = schemaGenerator.generateToolSchemas('test_tool_id');

      expect(schemas).toHaveLength(3);
      expect(schemas.map(s => s.name)).toContain('method1');
      expect(schemas.map(s => s.name)).toContain('method2');
      expect(schemas.map(s => s.name)).toContain('method3');
    });

    test('should include both instance and static methods', () => {
      const schemas = schemaGenerator.generateToolSchemas('test_tool_id');

      expect(schemas).toHaveLength(3);
      // All methods should be included regardless of type
    });

    test('should return empty array for tool with no methods', () => {
      const toolId = 'empty_tool';
      kgEngine.addTriple(toolId, 'rdf:type', 'kg:AgentTool');

      const schemas = schemaGenerator.generateToolSchemas(toolId);

      expect(schemas).toHaveLength(0);
    });

    test('should handle non-existent tool', () => {
      const schemas = schemaGenerator.generateToolSchemas('nonexistent_tool');

      expect(schemas).toHaveLength(0);
    });
  });

  describe('All Tools Schema Generation', () => {
    beforeEach(() => {
      // Set up multiple tools
      const tool1Id = 'tool_1';
      const tool2Id = 'tool_2';

      kgEngine.addTriple(tool1Id, 'rdf:type', 'kg:AgentTool');
      kgEngine.addTriple(tool2Id, 'rdf:type', 'kg:AgentTool');

      // Tool 1 methods
      const method1Id = 'tool1_method1';
      kgEngine.addTriple(method1Id, 'kg:methodOf', tool1Id);
      kgEngine.addTriple(method1Id, 'kg:methodName', 'tool1Method1');

      const method2Id = 'tool1_method2';
      kgEngine.addTriple(method2Id, 'kg:methodOf', tool1Id);
      kgEngine.addTriple(method2Id, 'kg:methodName', 'tool1Method2');

      // Tool 2 methods
      const method3Id = 'tool2_method1';
      kgEngine.addTriple(method3Id, 'kg:methodOf', tool2Id);
      kgEngine.addTriple(method3Id, 'kg:methodName', 'tool2Method1');
    });

    test('should generate schemas for all registered tools', () => {
      const schemas = schemaGenerator.generateAllToolSchemas();

      expect(schemas).toHaveLength(3);
      expect(schemas.map(s => s.name)).toContain('tool1Method1');
      expect(schemas.map(s => s.name)).toContain('tool1Method2');
      expect(schemas.map(s => s.name)).toContain('tool2Method1');
    });

    test('should return empty array when no tools are registered', () => {
      const emptyGenerator = new KGSchemaGenerator(new KGEngine());
      const schemas = emptyGenerator.generateAllToolSchemas();

      expect(schemas).toHaveLength(0);
    });

    test('should handle tools with no methods', () => {
      const toolId = 'tool_no_methods';
      kgEngine.addTriple(toolId, 'rdf:type', 'kg:AgentTool');

      const schemas = schemaGenerator.generateAllToolSchemas();

      // Should still return schemas for tools that do have methods
      expect(schemas).toHaveLength(3);
    });
  });

  describe('Helper Methods', () => {
    test('_getValue should return first matching value', () => {
      kgEngine.addTriple('subject1', 'predicate1', 'value1');
      kgEngine.addTriple('subject1', 'predicate1', 'value2');

      const value = schemaGenerator._getValue('subject1', 'predicate1');
      expect(value).toBe('value1'); // Should return first match
    });

    test('_getValue should return null for non-existent triple', () => {
      const value = schemaGenerator._getValue('nonexistent', 'predicate');
      expect(value).toBeNull();
    });

    test('_mapTypeToJsonSchema should map all supported types', () => {
      expect(schemaGenerator._mapTypeToJsonSchema('String')).toBe('string');
      expect(schemaGenerator._mapTypeToJsonSchema('Number')).toBe('number');
      expect(schemaGenerator._mapTypeToJsonSchema('Boolean')).toBe('boolean');
      expect(schemaGenerator._mapTypeToJsonSchema('Array')).toBe('array');
      expect(schemaGenerator._mapTypeToJsonSchema('Object')).toBe('object');
    });

    test('_mapTypeToJsonSchema should default to string for unknown types', () => {
      expect(schemaGenerator._mapTypeToJsonSchema('UnknownType')).toBe('string');
      expect(schemaGenerator._mapTypeToJsonSchema(null)).toBe('string');
      expect(schemaGenerator._mapTypeToJsonSchema(undefined)).toBe('string');
    });
  });

  describe('Edge Cases', () => {
    test('should handle method with malformed parameter data', () => {
      const methodId = 'malformed_method';
      kgEngine.addTriple(methodId, 'kg:methodName', 'malformedMethod');

      // Add parameter with missing required data
      const paramId = 'malformed_param';
      kgEngine.addTriple(paramId, 'kg:parameterOf', methodId);
      // Missing parameter name and type

      const schema = schemaGenerator.generateMethodSchema(methodId);

      expect(schema.name).toBe('malformedMethod');
      expect(schema.parameters.properties).toEqual({});
    });

    test('should handle parameters with null/undefined values', () => {
      const methodId = 'null_values_method';
      kgEngine.addTriple(methodId, 'kg:methodName', 'nullValuesMethod');

      const paramId = 'null_param';
      kgEngine.addTriple(paramId, 'kg:parameterOf', methodId);
      kgEngine.addTriple(paramId, 'kg:parameterName', 'nullParam');
      kgEngine.addTriple(paramId, 'kg:hasType', null);
      kgEngine.addTriple(paramId, 'kg:defaultValue', null);

      const schema = schemaGenerator.generateMethodSchema(methodId);

      expect(schema.parameters.properties.nullParam).toBeDefined();
      expect(schema.parameters.properties.nullParam.type).toBe('string');
    });

    test('should handle very large numbers of parameters', () => {
      const methodId = 'many_params_method';
      kgEngine.addTriple(methodId, 'kg:methodName', 'manyParamsMethod');

      // Add 100 parameters
      for (let i = 0; i < 100; i++) {
        const paramId = `param_${i}`;
        kgEngine.addTriple(paramId, 'kg:parameterOf', methodId);
        kgEngine.addTriple(paramId, 'kg:parameterName', `param${i}`);
        kgEngine.addTriple(paramId, 'kg:hasType', 'String');
        kgEngine.addTriple(paramId, 'kg:parameterIndex', i);
      }

      const startTime = performance.now();
      const schema = schemaGenerator.generateMethodSchema(methodId);
      const endTime = performance.now();

      expect(Object.keys(schema.parameters.properties)).toHaveLength(100);
      expect(endTime - startTime).toBeLessThan(100); // Should complete quickly
    });

    test('should handle parameters with duplicate indices', () => {
      const methodId = 'duplicate_index_method';
      kgEngine.addTriple(methodId, 'kg:methodName', 'duplicateIndexMethod');

      const param1Id = 'param_1';
      const param2Id = 'param_2';

      kgEngine.addTriple(param1Id, 'kg:parameterOf', methodId);
      kgEngine.addTriple(param1Id, 'kg:parameterName', 'param1');
      kgEngine.addTriple(param1Id, 'kg:parameterIndex', 0);

      kgEngine.addTriple(param2Id, 'kg:parameterOf', methodId);
      kgEngine.addTriple(param2Id, 'kg:parameterName', 'param2');
      kgEngine.addTriple(param2Id, 'kg:parameterIndex', 0); // Same index

      const schema = schemaGenerator.generateMethodSchema(methodId);

      expect(Object.keys(schema.parameters.properties)).toHaveLength(2);
      // Should include both parameters despite duplicate indices
    });

    test('should handle empty allowed values array', () => {
      const methodId = 'empty_enum_method';
      kgEngine.addTriple(methodId, 'kg:methodName', 'emptyEnumMethod');

      const paramId = 'empty_enum_param';
      kgEngine.addTriple(paramId, 'kg:parameterOf', methodId);
      kgEngine.addTriple(paramId, 'kg:parameterName', 'emptyEnumParam');
      kgEngine.addTriple(paramId, 'kg:hasType', 'String');

      const schema = schemaGenerator.generateMethodSchema(methodId);

      expect(schema.parameters.properties.emptyEnumParam.enum).toBeUndefined();
    });
  });

  describe('Integration with Real Tool Classes', () => {
    test('should generate schema for WeatherTool methods', () => {
      // This test would require the WeatherTool to be properly serialized
      // For now, we'll simulate the expected structure
      const weatherToolId = WeatherTool.getId();
      kgEngine.addTriple(weatherToolId, 'rdf:type', 'kg:AgentTool');

      const getCurrentWeatherMethod = `${weatherToolId}_getCurrentWeather`;
      kgEngine.addTriple(getCurrentWeatherMethod, 'kg:methodOf', weatherToolId);
      kgEngine.addTriple(getCurrentWeatherMethod, 'kg:methodName', 'getCurrentWeather');
      kgEngine.addTriple(getCurrentWeatherMethod, 'kg:description', 'Get current weather for a location');

      // Add location parameter
      const locationParam = `${getCurrentWeatherMethod}_location`;
      kgEngine.addTriple(locationParam, 'kg:parameterOf', getCurrentWeatherMethod);
      kgEngine.addTriple(locationParam, 'kg:parameterName', 'location');
      kgEngine.addTriple(locationParam, 'kg:hasType', 'String');
      kgEngine.addTriple(locationParam, 'kg:isRequired', true);
      kgEngine.addTriple(locationParam, 'kg:parameterIndex', 0);

      // Add units parameter
      const unitsParam = `${getCurrentWeatherMethod}_units`;
      kgEngine.addTriple(unitsParam, 'kg:parameterOf', getCurrentWeatherMethod);
      kgEngine.addTriple(unitsParam, 'kg:parameterName', 'units');
      kgEngine.addTriple(unitsParam, 'kg:hasType', 'String');
      kgEngine.addTriple(unitsParam, 'kg:isRequired', false);
      kgEngine.addTriple(unitsParam, 'kg:parameterIndex', 1);
      kgEngine.addTriple(unitsParam, 'kg:defaultValue', 'metric');

      const schema = schemaGenerator.generateMethodSchema(getCurrentWeatherMethod);

      expect(schema.name).toBe('getCurrentWeather');
      expect(schema.description).toBe('Get current weather for a location');
      expect(schema.parameters.required).toEqual(['location']);
      expect(schema.parameters.properties.location.type).toBe('string');
      expect(schema.parameters.properties.units.type).toBe('string');
      expect(schema.parameters.properties.units.default).toBe('metric');
    });
  });
});
