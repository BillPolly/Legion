const RetryManager = require('../../src/response-parser/RetryManager');
const ResponseParser = require('../../src/response-parser/ResponseParser');
const ResponseValidator = require('../../src/response-parser/ResponseValidator');

describe('RetryManager', () => {
  let retryManager;
  let mockModel;
  let mockTools;

  beforeEach(() => {
    mockTools = [
      {
        identifier: 'calculator_tool',
        name: 'Calculator Tool',
        functions: [
          {
            name: 'evaluate',
            arguments: [
              { name: 'expression', dataType: 'string', required: true }
            ]
          }
        ]
      }
    ];

    mockModel = {
      sendAndReceiveResponse: jest.fn()
    };

    retryManager = new RetryManager({
      maxRetries: 3,
      tools: mockTools
    });
  });

  describe('processResponse()', () => {
    it('should return valid response without retry', async () => {
      const validResponse = {
        task_completed: true,
        response: {
          type: 'string',
          message: 'Success'
        }
      };

      mockModel.sendAndReceiveResponse.mockResolvedValue(JSON.stringify(validResponse));

      const result = await retryManager.processResponse(mockModel, []);
      
      expect(result.success).toBe(true);
      expect(result.data).toEqual(validResponse);
      expect(result.retries).toBe(0);
      expect(mockModel.sendAndReceiveResponse).toHaveBeenCalledTimes(1);
    });

    it('should retry on JSON parse error', async () => {
      const invalidJSON = '{"invalid": json}';
      const validResponse = {
        task_completed: true,
        response: { type: 'string', message: 'Fixed' }
      };

      mockModel.sendAndReceiveResponse
        .mockResolvedValueOnce(invalidJSON)
        .mockResolvedValueOnce(JSON.stringify(validResponse));

      const result = await retryManager.processResponse(mockModel, []);
      
      expect(result.success).toBe(true);
      expect(result.data).toEqual(validResponse);
      expect(result.retries).toBe(1);
      expect(mockModel.sendAndReceiveResponse).toHaveBeenCalledTimes(2);
    });

    it('should retry on validation error', async () => {
      const invalidResponse = {
        // Missing task_completed
        response: { type: 'string', message: 'Incomplete' }
      };
      const validResponse = {
        task_completed: true,
        response: { type: 'string', message: 'Complete' }
      };

      mockModel.sendAndReceiveResponse
        .mockResolvedValueOnce(JSON.stringify(invalidResponse))
        .mockResolvedValueOnce(JSON.stringify(validResponse));

      const result = await retryManager.processResponse(mockModel, []);
      
      expect(result.success).toBe(true);
      expect(result.data).toEqual(validResponse);
      expect(result.retries).toBe(1);
    });

    it('should retry on unknown tool error', async () => {
      const wrongToolResponse = {
        task_completed: false,
        response: { type: 'string', message: 'Using tool' },
        use_tool: {
          identifier: 'wrong_tool',
          function_name: 'func',
          args: []
        }
      };
      const correctResponse = {
        task_completed: false,
        response: { type: 'string', message: 'Using correct tool' },
        use_tool: {
          identifier: 'calculator_tool',
          function_name: 'evaluate',
          args: ['2+2']
        }
      };

      mockModel.sendAndReceiveResponse
        .mockResolvedValueOnce(JSON.stringify(wrongToolResponse))
        .mockResolvedValueOnce(JSON.stringify(correctResponse));

      const result = await retryManager.processResponse(mockModel, []);
      
      expect(result.success).toBe(true);
      expect(result.data.use_tool.identifier).toBe('calculator_tool');
      expect(result.retries).toBe(1);
    });

    it('should include error feedback in retry message', async () => {
      const invalidJSON = '{invalid';
      
      mockModel.sendAndReceiveResponse
        .mockResolvedValueOnce(invalidJSON)
        .mockResolvedValueOnce(JSON.stringify({ 
          task_completed: true, 
          response: { type: 'string', message: 'Fixed' } 
        }));

      await retryManager.processResponse(mockModel, [{ role: 'user', content: 'test' }]);
      
      // Check that error feedback was added to messages
      const retryCall = mockModel.sendAndReceiveResponse.mock.calls[1][0];
      const errorMessage = retryCall.find(msg => msg.role === 'user' && msg.content.includes('Failed to parse'));
      expect(errorMessage).toBeDefined();
      expect(errorMessage.content).toContain('Your response had an error');
    });

    it('should respect max retries limit', async () => {
      const invalidJSON = '{invalid';
      
      mockModel.sendAndReceiveResponse.mockResolvedValue(invalidJSON);

      const result = await retryManager.processResponse(mockModel, []);
      
      expect(result.success).toBe(false);
      expect(result.retries).toBe(3); // maxRetries
      expect(mockModel.sendAndReceiveResponse).toHaveBeenCalledTimes(4); // 1 initial + 3 retries
      expect(result.error).toContain('Max retries exceeded');
    });

    it('should handle JSON5 format', async () => {
      const json5Response = `{
        task_completed: true,
        response: {
          type: 'string',
          message: 'Using JSON5',
        },
      }`;

      mockModel.sendAndReceiveResponse.mockResolvedValue(json5Response);

      const result = await retryManager.processResponse(mockModel, []);
      
      expect(result.success).toBe(true);
      expect(result.data.response.message).toBe('Using JSON5');
      expect(result.retries).toBe(0);
    });

    it('should extract JSON from code blocks', async () => {
      const responseWithCodeBlock = `Here's the response:
\`\`\`json
{
  "task_completed": true,
  "response": {
    "type": "string",
    "message": "Extracted from code block"
  }
}
\`\`\``;

      mockModel.sendAndReceiveResponse.mockResolvedValue(responseWithCodeBlock);

      const result = await retryManager.processResponse(mockModel, []);
      
      expect(result.success).toBe(true);
      expect(result.data.response.message).toBe('Extracted from code block');
    });

    it('should provide helpful suggestions for typos', async () => {
      const typoResponse = {
        task_completed: false,
        response: { type: 'string', message: 'Calculating' },
        use_tool: {
          identifier: 'calculater_tool', // typo
          function_name: 'evaluate',
          args: ['2+2']
        }
      };

      mockModel.sendAndReceiveResponse
        .mockResolvedValueOnce(JSON.stringify(typoResponse))
        .mockResolvedValueOnce(JSON.stringify({
          task_completed: true,
          response: { type: 'string', message: 'Fixed' }
        }));

      await retryManager.processResponse(mockModel, []);
      
      const retryCall = mockModel.sendAndReceiveResponse.mock.calls[1][0];
      const errorMessage = retryCall.find(msg => msg.content.includes('Did you mean'));
      expect(errorMessage).toBeDefined();
      expect(errorMessage.content).toContain('calculator_tool');
    });
  });

  describe('formatErrorFeedback()', () => {
    it('should format parse errors clearly', () => {
      const error = {
        type: 'parse',
        message: 'Unexpected token } in JSON at position 10'
      };

      const feedback = retryManager.formatErrorFeedback(error);
      
      expect(feedback).toContain('JSON PARSING ERROR');
      expect(feedback).toContain('Your response could not be parsed as valid JSON');
      expect(feedback).toContain('Unexpected token } in JSON at position 10');
    });

    it('should format validation errors with details', () => {
      const error = {
        type: 'validation',
        errors: [
          'Missing required field: task_completed',
          'response.type is required'
        ]
      };

      const feedback = retryManager.formatErrorFeedback(error);
      
      expect(feedback).toContain('VALIDATION ERROR');
      expect(feedback).toContain('Missing required field: task_completed');
      expect(feedback).toContain('response.type is required');
    });

    it('should include suggestions when available', () => {
      const error = {
        type: 'validation',
        errors: ['Unknown tool identifier: calculater_tool'],
        suggestions: { tool: 'calculator_tool' }
      };

      const feedback = retryManager.formatErrorFeedback(error);
      
      expect(feedback).toContain('Did you mean: calculator_tool');
    });

    it('should include correct format example', () => {
      const error = { type: 'parse', message: 'Some error' };
      
      const feedback = retryManager.formatErrorFeedback(error);
      
      expect(feedback).toContain('Expected format:');
      expect(feedback).toContain('"task_completed":');
      expect(feedback).toContain('"response":');
    });
  });

  describe('exponential backoff', () => {
    it('should apply backoff delays between retries', async () => {
      const invalidResponse = '{invalid}';
      mockModel.sendAndReceiveResponse.mockResolvedValue(invalidResponse);

      const startTime = Date.now();
      const manager = new RetryManager({
        maxRetries: 2,
        tools: mockTools,
        backoffMultiplier: 10 // Very fast for testing (10ms base)
      });

      await manager.processResponse(mockModel, []);
      
      const duration = Date.now() - startTime;
      expect(duration).toBeGreaterThan(20); // Should have some delay (10ms + 20ms)
    });
  });

  describe('error handling', () => {
    it('should handle model throwing errors', async () => {
      mockModel.sendAndReceiveResponse.mockRejectedValue(new Error('Network error'));

      const result = await retryManager.processResponse(mockModel, []);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Network error');
    });

    it('should handle empty responses', async () => {
      mockModel.sendAndReceiveResponse
        .mockResolvedValueOnce('')
        .mockResolvedValueOnce(JSON.stringify({
          task_completed: true,
          response: { type: 'string', message: 'Recovered' }
        }));

      const result = await retryManager.processResponse(mockModel, []);
      
      expect(result.success).toBe(true);
      expect(result.retries).toBe(1);
    });
  });

  describe('configuration', () => {
    it('should work with zero retries', async () => {
      const manager = new RetryManager({
        maxRetries: 0,
        tools: mockTools
      });

      mockModel.sendAndReceiveResponse.mockResolvedValue('{invalid}');

      const result = await manager.processResponse(mockModel, []);
      
      expect(result.success).toBe(false);
      expect(result.retries).toBe(0);
      expect(mockModel.sendAndReceiveResponse).toHaveBeenCalledTimes(1);
    });

    it('should work without tools for basic validation', async () => {
      const manager = new RetryManager({
        maxRetries: 1,
        tools: []
      });

      const response = {
        task_completed: true,
        response: { type: 'string', message: 'No tools needed' }
      };

      mockModel.sendAndReceiveResponse.mockResolvedValue(JSON.stringify(response));

      const result = await manager.processResponse(mockModel, []);
      
      expect(result.success).toBe(true);
      expect(result.data).toEqual(response);
    });
  });
});