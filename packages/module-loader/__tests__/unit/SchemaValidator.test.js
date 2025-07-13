import { jest } from '@jest/globals';
import { SchemaValidator } from '../../src/schemas/SchemaValidator.js';

describe('SchemaValidator', () => {
  let validator;

  beforeEach(() => {
    validator = new SchemaValidator();
  });

  describe('validateModuleConfig', () => {
    it('should validate a minimal valid module.json', () => {
      const config = {
        name: 'test-module',
        version: '1.0.0',
        description: 'Test module',
        package: 'test-package',
        type: 'static',
        tools: []
      };

      const result = validator.validateModuleConfig(config);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate a complete module.json with all features', () => {
      const config = {
        name: 'axios-module',
        version: '1.0.0',
        description: 'HTTP client module',
        package: 'axios',
        packageVersion: '^1.0.0',
        type: 'factory',
        dependencies: {
          baseURL: {
            type: 'string',
            description: 'Base URL for requests',
            required: false,
            default: 'https://api.example.com'
          }
        },
        initialization: {
          type: 'factory',
          method: 'create',
          config: {
            baseURL: '${baseURL}',
            timeout: 30000
          }
        },
        tools: [{
          name: 'http_get',
          description: 'Make HTTP GET request',
          function: 'get',
          async: true,
          instanceMethod: true,
          parameters: {
            type: 'object',
            properties: {
              url: {
                type: 'string',
                description: 'URL to fetch'
              }
            },
            required: ['url']
          },
          output: {
            success: {
              type: 'object',
              properties: {
                data: { type: 'any' },
                status: { type: 'number' }
              }
            },
            failure: {
              type: 'object',
              properties: {
                error: { type: 'string' }
              }
            }
          }
        }]
      };

      const result = validator.validateModuleConfig(config);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject missing required fields', () => {
      const config = {
        name: 'test-module'
        // missing required fields
      };

      const result = validator.validateModuleConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('version is required');
      expect(result.errors).toContain('description is required');
      expect(result.errors).toContain('package is required');
      expect(result.errors).toContain('type is required');
      expect(result.errors).toContain('tools is required');
    });

    it('should reject invalid module type', () => {
      const config = {
        name: 'test-module',
        version: '1.0.0',
        description: 'Test',
        package: 'test',
        type: 'invalid-type',
        tools: []
      };

      const result = validator.validateModuleConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toMatch(/type must be one of/);
    });

    it('should reject invalid tool configuration', () => {
      const config = {
        name: 'test-module',
        version: '1.0.0',
        description: 'Test',
        package: 'test',
        type: 'static',
        tools: [{
          // missing required fields
          description: 'Test tool'
        }]
      };

      const result = validator.validateModuleConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('tools[0].name is required');
      expect(result.errors).toContain('tools[0].function is required');
    });

    it('should validate dependency types', () => {
      const config = {
        name: 'test-module',
        version: '1.0.0',
        description: 'Test',
        package: 'test',
        type: 'constructor',
        dependencies: {
          apiKey: {
            type: 'invalid-type',
            description: 'API key'
          }
        },
        tools: []
      };

      const result = validator.validateModuleConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toMatch(/dependencies\.apiKey\.type must be one of/);
    });

    it('should validate initialization configuration', () => {
      const config = {
        name: 'test-module',
        version: '1.0.0',
        description: 'Test',
        package: 'test',
        type: 'factory',
        initialization: {
          type: 'invalid-init-type'
        },
        tools: []
      };

      const result = validator.validateModuleConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toMatch(/initialization\.type must be one of/);
    });

    it('should validate parameter schemas', () => {
      const config = {
        name: 'test-module',
        version: '1.0.0',
        description: 'Test',
        package: 'test',
        type: 'static',
        tools: [{
          name: 'test_tool',
          description: 'Test',
          function: 'testFunc',
          parameters: {
            type: 'invalid-type'
          }
        }]
      };

      const result = validator.validateModuleConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toMatch(/parameters\.type must be/);
    });

    it('should allow valid function path formats', () => {
      const configs = [
        { function: 'simpleMethod' },
        { function: 'utils.format' },
        { function: 'deep.nested.method' },
        { function: 'methods[0]' },
        { function: '${methodName}' }
      ];

      configs.forEach(toolConfig => {
        const config = {
          name: 'test-module',
          version: '1.0.0',
          description: 'Test',
          package: 'test',
          type: 'static',
          tools: [{
            name: 'test_tool',
            description: 'Test',
            ...toolConfig
          }]
        };

        const result = validator.validateModuleConfig(config);
        expect(result.valid).toBe(true);
      });
    });
  });

  describe('error formatting', () => {
    it('should provide helpful error messages', () => {
      const config = {
        name: 'test-module',
        version: '1.0.0',
        description: 'Test',
        package: 'test',
        type: 'static',
        tools: [{
          name: 'test_tool',
          function: 'test',
          // missing description
          parameters: {
            type: 'object',
            properties: {
              value: {
                // missing type
                description: 'A value'
              }
            }
          }
        }]
      };

      const result = validator.validateModuleConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('tools[0].description is required');
      expect(result.errors).toContain('tools[0].parameters.properties.value must have type');
    });
  });
});