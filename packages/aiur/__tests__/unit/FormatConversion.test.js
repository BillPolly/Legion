/**
 * @jest-environment node
 */

import { jest } from '@jest/globals';

// Mock FormatConverter class extracted from the stub
class FormatConverter {
  /**
   * Convert Legion format to MCP format
   */
  static legionToMcp(legionResult) {
    if (!legionResult) {
      return {
        content: [{ type: "text", text: "No result from server" }],
        isError: true
      };
    }

    if (!legionResult.success) {
      const errorMessage = legionResult.error || legionResult.message || 'Unknown error';
      const errorCode = legionResult.code ? ` (${legionResult.code})` : '';
      
      return {
        content: [{
          type: "text",
          text: `Error: ${errorMessage}${errorCode}`
        }],
        isError: true
      };
    }

    // Handle successful responses
    if (legionResult.data) {
      if (typeof legionResult.data === 'string') {
        return {
          content: [{ type: "text", text: legionResult.data }]
        };
      } else if (typeof legionResult.data === 'object') {
        return {
          content: [{
            type: "text",
            text: JSON.stringify(legionResult.data, null, 2)
          }]
        };
      }
    }

    // Fallback to message or full result
    const message = legionResult.message || JSON.stringify(legionResult, null, 2);
    return {
      content: [{ type: "text", text: message }]
    };
  }

  /**
   * Convert MCP request to Legion format
   */
  static mcpToLegion(mcpRequest) {
    if (!mcpRequest || !mcpRequest.params) {
      throw new Error('Invalid MCP request format');
    }

    const { name, arguments: args } = mcpRequest.params;
    
    return {
      tool: name,
      arguments: args || {}
    };
  }

  /**
   * Validate MCP request format
   */
  static validateMcpRequest(request) {
    if (!request) {
      return { valid: false, error: 'Request is null or undefined' };
    }

    if (!request.params) {
      return { valid: false, error: 'Missing params in request' };
    }

    if (!request.params.name) {
      return { valid: false, error: 'Missing tool name in params' };
    }

    if (typeof request.params.name !== 'string') {
      return { valid: false, error: 'Tool name must be a string' };
    }

    return { valid: true };
  }

  /**
   * Validate Legion response format
   */
  static validateLegionResponse(response) {
    if (!response) {
      return { valid: false, error: 'Response is null or undefined' };
    }

    if (typeof response.success !== 'boolean') {
      return { valid: false, error: 'Missing or invalid success field' };
    }

    if (!response.success && !response.error && !response.message) {
      return { valid: false, error: 'Error response must have error or message field' };
    }

    return { valid: true };
  }
}

describe('Format Conversion Tests', () => {
  
  describe('Legion to MCP Conversion', () => {
    test('should convert successful Legion response with string data', () => {
      const legionResponse = {
        success: true,
        data: 'Operation completed successfully',
        message: 'Success message'
      };

      const mcpResult = FormatConverter.legionToMcp(legionResponse);

      expect(mcpResult).toEqual({
        content: [{
          type: "text",
          text: 'Operation completed successfully'
        }]
      });
      expect(mcpResult.isError).toBeUndefined();
    });

    test('should convert successful Legion response with object data', () => {
      const legionResponse = {
        success: true,
        data: {
          tools: ['context_add', 'context_get', 'context_list'],
          count: 3,
          status: 'ready'
        }
      };

      const mcpResult = FormatConverter.legionToMcp(legionResponse);

      expect(mcpResult).toEqual({
        content: [{
          type: "text",
          text: JSON.stringify({
            tools: ['context_add', 'context_get', 'context_list'],
            count: 3,
            status: 'ready'
          }, null, 2)
        }]
      });
    });

    test('should convert successful Legion response with complex nested data', () => {
      const legionResponse = {
        success: true,
        data: {
          user: {
            id: 123,
            name: 'Test User',
            preferences: {
              theme: 'dark',
              language: 'en',
              settings: {
                notifications: true,
                privacy: 'medium'
              }
            }
          },
          context: ['item1', 'item2', 'item3']
        }
      };

      const mcpResult = FormatConverter.legionToMcp(legionResponse);

      expect(mcpResult.content).toHaveLength(1);
      expect(mcpResult.content[0].type).toBe('text');
      
      // Verify the JSON structure is preserved
      const parsedData = JSON.parse(mcpResult.content[0].text);
      expect(parsedData.user.preferences.settings.notifications).toBe(true);
      expect(parsedData.context).toEqual(['item1', 'item2', 'item3']);
    });

    test('should convert error Legion response with error field', () => {
      const legionResponse = {
        success: false,
        error: 'Tool not found',
        code: 'TOOL_NOT_FOUND'
      };

      const mcpResult = FormatConverter.legionToMcp(legionResponse);

      expect(mcpResult).toEqual({
        content: [{
          type: "text",
          text: 'Error: Tool not found (TOOL_NOT_FOUND)'
        }],
        isError: true
      });
    });

    test('should convert error Legion response with message field', () => {
      const legionResponse = {
        success: false,
        message: 'Invalid parameters provided'
      };

      const mcpResult = FormatConverter.legionToMcp(legionResponse);

      expect(mcpResult).toEqual({
        content: [{
          type: "text",
          text: 'Error: Invalid parameters provided'
        }],
        isError: true
      });
    });

    test('should handle null or undefined Legion response', () => {
      const mcpResult1 = FormatConverter.legionToMcp(null);
      const mcpResult2 = FormatConverter.legionToMcp(undefined);

      expect(mcpResult1).toEqual({
        content: [{ type: "text", text: "No result from server" }],
        isError: true
      });

      expect(mcpResult2).toEqual({
        content: [{ type: "text", text: "No result from server" }],
        isError: true
      });
    });

    test('should handle Legion response with only message field', () => {
      const legionResponse = {
        success: true,
        message: 'Operation completed but no data returned'
      };

      const mcpResult = FormatConverter.legionToMcp(legionResponse);

      expect(mcpResult).toEqual({
        content: [{
          type: "text",
          text: 'Operation completed but no data returned'
        }]
      });
    });

    test('should handle malformed Legion response', () => {
      const legionResponse = {
        success: true
        // No data or message
      };

      const mcpResult = FormatConverter.legionToMcp(legionResponse);

      expect(mcpResult.content[0].text).toContain('"success": true');
    });
  });

  describe('MCP to Legion Conversion', () => {
    test('should convert valid MCP request', () => {
      const mcpRequest = {
        params: {
          name: 'context_add',
          arguments: {
            name: 'user_data',
            data: { id: 123, name: 'Test User' },
            description: 'User information'
          }
        }
      };

      const legionRequest = FormatConverter.mcpToLegion(mcpRequest);

      expect(legionRequest).toEqual({
        tool: 'context_add',
        arguments: {
          name: 'user_data',
          data: { id: 123, name: 'Test User' },
          description: 'User information'
        }
      });
    });

    test('should convert MCP request with no arguments', () => {
      const mcpRequest = {
        params: {
          name: 'context_list'
        }
      };

      const legionRequest = FormatConverter.mcpToLegion(mcpRequest);

      expect(legionRequest).toEqual({
        tool: 'context_list',
        arguments: {}
      });
    });

    test('should convert MCP request with empty arguments', () => {
      const mcpRequest = {
        params: {
          name: 'context_list',
          arguments: {}
        }
      };

      const legionRequest = FormatConverter.mcpToLegion(mcpRequest);

      expect(legionRequest).toEqual({
        tool: 'context_list', 
        arguments: {}
      });
    });

    test('should handle complex nested arguments', () => {
      const mcpRequest = {
        params: {
          name: 'plan_create',
          arguments: {
            title: 'Deployment Plan',
            steps: [
              {
                id: 'build',
                action: 'npm_build',
                parameters: {
                  script: 'build',
                  env: 'production'
                }
              },
              {
                id: 'deploy',
                action: 'deploy_app',
                dependsOn: ['build'],
                parameters: {
                  target: 'production',
                  config: {
                    replicas: 3,
                    resources: {
                      cpu: '500m',
                      memory: '1Gi'
                    }
                  }
                }
              }
            ],
            saveAs: 'deployment_plan'
          }
        }
      };

      const legionRequest = FormatConverter.mcpToLegion(mcpRequest);

      expect(legionRequest.tool).toBe('plan_create');
      expect(legionRequest.arguments.steps).toHaveLength(2);
      expect(legionRequest.arguments.steps[1].parameters.config.resources.cpu).toBe('500m');
    });

    test('should throw error for invalid MCP request', () => {
      expect(() => {
        FormatConverter.mcpToLegion(null);
      }).toThrow('Invalid MCP request format');

      expect(() => {
        FormatConverter.mcpToLegion({});
      }).toThrow('Invalid MCP request format');

      expect(() => {
        FormatConverter.mcpToLegion({ params: {} });
      }).toThrow('Invalid MCP request format');
    });
  });

  describe('MCP Request Validation', () => {
    test('should validate correct MCP request', () => {
      const validRequest = {
        params: {
          name: 'context_get',
          arguments: { name: 'user_data' }
        }
      };

      const validation = FormatConverter.validateMcpRequest(validRequest);

      expect(validation).toEqual({ valid: true });
    });

    test('should reject null/undefined requests', () => {
      expect(FormatConverter.validateMcpRequest(null)).toEqual({
        valid: false,
        error: 'Request is null or undefined'
      });

      expect(FormatConverter.validateMcpRequest(undefined)).toEqual({
        valid: false,
        error: 'Request is null or undefined'
      });
    });

    test('should reject request without params', () => {
      const invalidRequest = {
        id: 'test-123'
      };

      const validation = FormatConverter.validateMcpRequest(invalidRequest);

      expect(validation).toEqual({
        valid: false,
        error: 'Missing params in request'
      });
    });

    test('should reject request without tool name', () => {
      const invalidRequest = {
        params: {
          arguments: { data: 'test' }
        }
      };

      const validation = FormatConverter.validateMcpRequest(invalidRequest);

      expect(validation).toEqual({
        valid: false,
        error: 'Missing tool name in params'
      });
    });

    test('should reject request with non-string tool name', () => {
      const invalidRequest = {
        params: {
          name: 123,
          arguments: {}
        }
      };

      const validation = FormatConverter.validateMcpRequest(invalidRequest);

      expect(validation).toEqual({
        valid: false,
        error: 'Tool name must be a string'
      });
    });
  });

  describe('Legion Response Validation', () => {
    test('should validate correct success response', () => {
      const validResponse = {
        success: true,
        data: { result: 'success' },
        message: 'Operation completed'
      };

      const validation = FormatConverter.validateLegionResponse(validResponse);

      expect(validation).toEqual({ valid: true });
    });

    test('should validate correct error response', () => {
      const validErrorResponse = {
        success: false,
        error: 'Something went wrong',
        code: 'ERROR_CODE'
      };

      const validation = FormatConverter.validateLegionResponse(validErrorResponse);

      expect(validation).toEqual({ valid: true });
    });

    test('should reject null/undefined responses', () => {
      expect(FormatConverter.validateLegionResponse(null)).toEqual({
        valid: false,
        error: 'Response is null or undefined'
      });

      expect(FormatConverter.validateLegionResponse(undefined)).toEqual({
        valid: false,
        error: 'Response is null or undefined'
      });
    });

    test('should reject response without success field', () => {
      const invalidResponse = {
        data: 'some data'
      };

      const validation = FormatConverter.validateLegionResponse(invalidResponse);

      expect(validation).toEqual({
        valid: false,
        error: 'Missing or invalid success field'
      });
    });

    test('should reject error response without error or message', () => {
      const invalidErrorResponse = {
        success: false,
        code: 'ERROR'
      };

      const validation = FormatConverter.validateLegionResponse(invalidErrorResponse);

      expect(validation).toEqual({
        valid: false,
        error: 'Error response must have error or message field'
      });
    });
  });

  describe('Round-trip Conversion', () => {
    test('should maintain data integrity through round-trip conversion', () => {
      const originalMcpRequest = {
        params: {
          name: 'context_add',
          arguments: {
            name: 'test_data',
            data: {
              complex: {
                nested: {
                  structure: true,
                  array: [1, 2, 3, 'test'],
                  nullValue: null,
                  undefinedValue: undefined
                }
              }
            },
            description: 'Test data for round-trip'
          }
        }
      };

      // Convert MCP -> Legion
      const legionRequest = FormatConverter.mcpToLegion(originalMcpRequest);

      // Simulate Legion processing (success response)
      const legionResponse = {
        success: true,
        data: legionRequest.arguments,
        message: 'Data stored successfully'
      };

      // Convert Legion -> MCP
      const mcpResult = FormatConverter.legionToMcp(legionResponse);

      // Verify data integrity
      expect(mcpResult.isError).toBeUndefined();
      expect(mcpResult.content).toHaveLength(1);
      
      const resultData = JSON.parse(mcpResult.content[0].text);
      expect(resultData.name).toBe('test_data');
      expect(resultData.data.complex.nested.structure).toBe(true);
      expect(resultData.data.complex.nested.array).toEqual([1, 2, 3, 'test']);
    });

    test('should handle error scenarios in round-trip', () => {
      const mcpRequest = {
        params: {
          name: 'invalid_tool',
          arguments: { param: 'value' }
        }
      };

      // Convert MCP -> Legion
      const legionRequest = FormatConverter.mcpToLegion(mcpRequest);

      // Simulate Legion error response
      const legionErrorResponse = {
        success: false,
        error: 'Tool not found: invalid_tool',
        code: 'TOOL_NOT_FOUND'
      };

      // Convert Legion -> MCP
      const mcpResult = FormatConverter.legionToMcp(legionErrorResponse);

      expect(mcpResult.isError).toBe(true);
      expect(mcpResult.content[0].text).toBe('Error: Tool not found: invalid_tool (TOOL_NOT_FOUND)');
    });
  });

  describe('Edge Cases and Error Handling', () => {
    test('should handle extremely large data structures', () => {
      const largeData = {
        array: new Array(10000).fill(0).map((_, i) => ({ id: i, value: `item_${i}` }))
      };

      const legionResponse = {
        success: true,
        data: largeData
      };

      const mcpResult = FormatConverter.legionToMcp(legionResponse);

      expect(mcpResult.content).toHaveLength(1);
      expect(mcpResult.content[0].type).toBe('text');
      
      const parsedData = JSON.parse(mcpResult.content[0].text);
      expect(parsedData.array).toHaveLength(10000);
    });

    test('should handle circular references gracefully', () => {
      const circularData = { name: 'test' };
      circularData.self = circularData;

      const legionResponse = {
        success: true,
        data: circularData
      };

      // This should not crash, though the exact behavior depends on JSON.stringify
      expect(() => {
        FormatConverter.legionToMcp(legionResponse);
      }).not.toThrow();
    });

    test('should handle special characters and unicode', () => {
      const specialData = {
        emoji: '🎉🚀✅❌',
        unicode: 'Iñtërnâtiônàlizætiøn',
        specialChars: '!@#$%^&*()[]{}\\|;:"<>?,./',
        multiline: 'Line 1\nLine 2\nLine 3'
      };

      const legionResponse = {
        success: true,
        data: specialData
      };

      const mcpResult = FormatConverter.legionToMcp(legionResponse);
      const parsedData = JSON.parse(mcpResult.content[0].text);

      expect(parsedData.emoji).toBe('🎉🚀✅❌');
      expect(parsedData.unicode).toBe('Iñtërnâtiônàlizætiøn');
      expect(parsedData.multiline).toBe('Line 1\nLine 2\nLine 3');
    });
  });
});