/**
 * Unit tests for Serper Tool
 */

import { jest } from '@jest/globals';
import Serper from '../../src/serper/index.js';
import { createMockToolCall, validateToolResult, createMockHttpResponse } from '../utils/test-helpers.js';

// Mock fetch and https
const mockFetch = jest.fn();
global.fetch = mockFetch;

const mockHttpsRequest = jest.fn();
jest.unstable_mockModule('https', () => ({
  default: {
    request: mockHttpsRequest
  }
}));

describe('Serper', () => {
  let serper;

  beforeEach(() => {
    serper = new Serper();
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    test('should initialize with correct properties', () => {
      expect(serper.name).toBe('google_search');
      expect(serper.description).toBe('Performs Google searches using the Serper API');
      expect(serper.apiKey).toBeNull();
      expect(serper.baseUrl).toBe('https://google.serper.dev/search');
    });
  });

  describe('initialize method', () => {
    test('should initialize with valid API key', async () => {
      const result = await serper.initialize({ apiKey: 'test-api-key' });
      
      expect(result).toBe(true);
      expect(serper.apiKey).toBe('test-api-key');
    });

    test('should throw error without API key', async () => {
      await expect(serper.initialize({})).rejects.toThrow('Serper API key is required');
      await expect(serper.initialize(null)).rejects.toThrow('Serper API key is required');
    });
  });

  describe('getToolDescription', () => {
    test('should return correct tool description format', () => {
      const description = serper.getToolDescription();
      
      expect(description.type).toBe('function');
      expect(description.function.name).toBe('google_search_search');
      expect(description.function.description).toContain('Search Google');
      expect(description.function.parameters.required).toContain('query');
      expect(description.function.parameters.properties.query.type).toBe('string');
    });

    test('should include comprehensive output schema', () => {
      const description = serper.getToolDescription();
      
      expect(description.function.output.success).toBeDefined();
      expect(description.function.output.failure).toBeDefined();
      expect(description.function.output.success.properties.organic.type).toBe('array');
      expect(description.function.output.failure.properties.errorType.enum).toContain('api_error');
    });
  });

  describe('performSearch method', () => {
    beforeEach(() => {
      serper.apiKey = 'test-api-key';
    });

    test('should perform successful search with fetch', async () => {
      const mockSearchResults = {
        searchInformation: { totalResults: '1000' },
        organic: [
          { title: 'Test Result', link: 'https://example.com', snippet: 'Test snippet' }
        ],
        relatedSearches: ['related query']
      };

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue(mockSearchResults)
      });

      const result = await serper.performSearch('test query');

      expect(result.success).toBe(true);
      expect(result.data.query).toBe('test query');
      expect(result.data.organic).toHaveLength(1);
      expect(result.data.organic[0].title).toBe('Test Result');
    });

    test('should handle API error response', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
        text: jest.fn().mockResolvedValue('Unauthorized')
      });

      const result = await serper.performSearch('test query');

      expect(result.success).toBe(false);
      expect(result.data.errorType).toBe('api_error');
      expect(result.data.statusCode).toBe(401);
      expect(result.error).toContain('Serper API error');
    });

    test('should handle date range parameter', async () => {
      const mockResults = { organic: [] };
      mockFetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockResults)
      });

      await serper.performSearch('test', 10, 'week');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://google.serper.dev/search',
        expect.objectContaining({
          body: expect.stringContaining('"tbs":"qdr:w"')
        })
      );
    });

    test('should limit number of results', async () => {
      const mockResults = { organic: [] };
      mockFetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockResults)
      });

      await serper.performSearch('test', 150); // Over limit

      expect(mockFetch).toHaveBeenCalledWith(
        'https://google.serper.dev/search',
        expect.objectContaining({
          body: expect.stringContaining('"num":100') // Should be capped at 100
        })
      );
    });

    test('should fallback to https module when fetch fails', async () => {
      mockFetch.mockRejectedValue(new Error('fetch is not defined'));

      const mockResponse = {
        statusCode: 200,
        on: jest.fn()
      };

      const mockRequest = {
        on: jest.fn(),
        write: jest.fn(),
        end: jest.fn()
      };

      mockHttpsRequest.mockImplementation((options, callback) => {
        setTimeout(() => {
          callback(mockResponse);
          const dataHandler = mockResponse.on.mock.calls.find(call => call[0] === 'data')[1];
          const endHandler = mockResponse.on.mock.calls.find(call => call[0] === 'end')[1];
          
          dataHandler(JSON.stringify({ organic: [] }));
          endHandler();
        }, 0);
        return mockRequest;
      });

      const result = await serper.performSearch('test query');

      expect(result.success).toBe(true);
      expect(mockHttpsRequest).toHaveBeenCalled();
    });
  });

  describe('invoke method', () => {
    test('should handle search request when initialized', async () => {
      serper.apiKey = 'test-key';
      
      const mockResults = { organic: [] };
      mockFetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockResults)
      });

      const toolCall = createMockToolCall('google_search_search', { 
        query: 'test search' 
      });
      const result = await serper.invoke(toolCall);

      expect(result.success).toBe(true);
      expect(result.data.query).toBe('test search');
    });

    test('should return failure when not initialized', async () => {
      const toolCall = createMockToolCall('google_search_search', { 
        query: 'test search' 
      });
      const result = await serper.invoke(toolCall);

      expect(result.success).toBe(false);
      expect(result.data.errorType).toBe('not_initialized');
      expect(result.error).toContain('not initialized');
    });

    test('should handle missing query parameter', async () => {
      serper.apiKey = 'test-key';
      
      const toolCall = createMockToolCall('google_search_search', {});
      const result = await serper.invoke(toolCall);

      expect(result.success).toBe(false);
      expect(result.data.errorType).toBe('validation_error');
    });

    test('should handle invalid JSON arguments', async () => {
      const toolCall = {
        id: 'test-call',
        type: 'function',
        function: {
          name: 'google_search_search',
          arguments: 'invalid json'
        }
      };
      const result = await serper.invoke(toolCall);

      expect(result.success).toBe(false);
      expect(result.data.errorType).toBe('validation_error');
    });

    test('should pass through search parameters', async () => {
      serper.apiKey = 'test-key';
      
      const mockResults = { organic: [] };
      mockFetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockResults)
      });

      const toolCall = createMockToolCall('google_search_search', { 
        query: 'test',
        num: 5,
        dateRange: 'day'
      });
      await serper.invoke(toolCall);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://google.serper.dev/search',
        expect.objectContaining({
          body: expect.stringContaining('"num":5')
        })
      );
    });
  });

  describe('search method (legacy)', () => {
    beforeEach(() => {
      serper.apiKey = 'test-key';
    });

    test('should return search data on success', async () => {
      const mockResults = { 
        query: 'test',
        organic: [{ title: 'Result' }] 
      };
      
      mockFetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockResults)
      });

      const result = await serper.search('test query');

      expect(result.query).toBe('test query');
      expect(result.organic).toHaveLength(1);
    });

    test('should throw error on search failure', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        text: jest.fn().mockResolvedValue('Server Error')
      });

      await expect(serper.search('test')).rejects.toThrow();
    });
  });

  describe('date range validation', () => {
    beforeEach(() => {
      serper.apiKey = 'test-key';
    });

    test('should accept valid date ranges', async () => {
      const validRanges = ['day', 'week', 'month', 'year'];
      const mockResults = { organic: [] };
      mockFetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockResults)
      });

      for (const range of validRanges) {
        await serper.performSearch('test', 10, range);
        expect(mockFetch).toHaveBeenCalledWith(
          'https://google.serper.dev/search',
          expect.objectContaining({
            body: expect.stringContaining(`"tbs":"qdr:${range.charAt(0)}"`)
          })
        );
      }
    });

    test('should ignore invalid date ranges', async () => {
      const mockResults = { organic: [] };
      mockFetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockResults)
      });

      await serper.performSearch('test', 10, 'invalid');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://google.serper.dev/search',
        expect.objectContaining({
          body: expect.not.stringContaining('tbs')
        })
      );
    });
  });

  describe('parameter validation', () => {
    test('should validate required query parameter', () => {
      expect(() => serper.validateRequiredParameters({ query: 'test' }, ['query']))
        .not.toThrow();
      expect(() => serper.validateRequiredParameters({}, ['query']))
        .toThrow();
    });
  });

  describe('error handling', () => {
    beforeEach(() => {
      serper.apiKey = 'test-key';
    });

    test('should handle network errors', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      const result = await serper.performSearch('test');

      expect(result.success).toBe(false);
      expect(result.data.errorType).toBe('network_error');
    });

    test('should categorize API errors correctly', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 403,
        text: jest.fn().mockResolvedValue('API limit exceeded')
      });

      const result = await serper.performSearch('test');

      expect(result.success).toBe(false);
      expect(result.data.errorType).toBe('api_error');
      expect(result.data.statusCode).toBe(403);
    });
  });
});