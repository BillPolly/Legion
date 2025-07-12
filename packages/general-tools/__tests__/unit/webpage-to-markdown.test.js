/**
 * Unit tests for Webpage to Markdown Tool
 */

import { jest } from '@jest/globals';
import WebPageToMarkdown from '../../src/webpage-to-markdown/index.js';
import { createMockToolCall, validateToolResult } from '../utils/test-helpers.js';

// Mock axios and cheerio
const mockAxios = {
  get: jest.fn()
};

const mockCheerio = {
  load: jest.fn()
};

jest.unstable_mockModule('axios', () => ({ default: mockAxios }));
jest.unstable_mockModule('cheerio', () => ({ default: mockCheerio }));

describe('WebPageToMarkdown', () => {
  let webpageToMarkdown;

  beforeEach(() => {
    webpageToMarkdown = new WebPageToMarkdown();
    jest.clearAllMocks();
    
    // Mock the convertToMarkdown method directly
    webpageToMarkdown.convertToMarkdown = jest.fn();
  });

  describe('constructor', () => {
    test('should initialize with correct properties', () => {
      expect(webpageToMarkdown.name).toBe('webpage_to_markdown');
      expect(webpageToMarkdown.description).toContain('web pages to markdown');
    });
  });

  describe('invoke method', () => {
    test('should convert webpage to markdown successfully', async () => {
      const mockResult = {
        success: true,
        url: 'https://example.com',
        markdown: '# Test Title\n\nTest content',
        length: 25,
        truncated: false
      };
      
      webpageToMarkdown.convertToMarkdown.mockResolvedValue(mockResult);

      const toolCall = createMockToolCall('webpage_to_markdown_convert', { 
        url: 'https://example.com' 
      });
      const result = await webpageToMarkdown.invoke(toolCall);

      validateToolResult(result);
      expect(result.success).toBe(true);
      expect(result.data.markdown).toContain('Test Title');
      expect(result.data.url).toBe('https://example.com');
    });

    test('should handle fetch failure', async () => {
      webpageToMarkdown.convertToMarkdown.mockRejectedValue(new Error('Network error'));

      const toolCall = createMockToolCall('webpage_to_markdown_convert', { 
        url: 'https://invalid-url.com' 
      });
      const result = await webpageToMarkdown.invoke(toolCall);

      validateToolResult(result);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Network error');
    });
  });
});