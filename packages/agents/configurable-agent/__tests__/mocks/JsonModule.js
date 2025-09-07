/**
 * Mock JsonModule for testing
 */

export default class JsonModule {
  constructor() {
    this.name = 'json';
  }

  getTools() {
    return [
      {
        name: 'json_parse',
        description: 'Parse a JSON string into an object',
        inputSchema: {
          type: 'object',
          properties: {
            json_string: { type: 'string', description: 'JSON string to parse' }
          },
          required: ['json_string']
        },
        execute: async (params) => {
          try {
            const result = JSON.parse(params.json_string);
            return {
              success: true,
              result: result
            };
          } catch (error) {
            return {
              success: false,
              error: 'Invalid JSON'
            };
          }
        }
      },
      {
        name: 'json_stringify',
        description: 'Convert an object to JSON string',
        inputSchema: {
          type: 'object',
          properties: {
            object: { type: 'object', description: 'Object to stringify' },
            pretty: { type: 'boolean', description: 'Pretty print output' }
          },
          required: ['object']
        },
        execute: async (params) => {
          try {
            const result = params.pretty 
              ? JSON.stringify(params.object, null, 2)
              : JSON.stringify(params.object);
            return {
              success: true,
              result: result
            };
          } catch (error) {
            return {
              success: false,
              error: 'Failed to stringify object'
            };
          }
        }
      },
      {
        name: 'json_validate',
        description: 'Validate JSON string',
        inputSchema: {
          type: 'object',
          properties: {
            json_string: { type: 'string', description: 'JSON string to validate' }
          },
          required: ['json_string']
        },
        execute: async (params) => {
          try {
            JSON.parse(params.json_string);
            return {
              success: true,
              valid: true
            };
          } catch (error) {
            return {
              success: true,
              valid: false,
              error: error.message
            };
          }
        }
      }
    ];
  }
}