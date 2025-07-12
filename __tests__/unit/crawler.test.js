/**
 * Unit tests for Crawler Tool
 */

import { jest } from '@jest/globals';
import Crawler from '../../src/crawler/index.js';
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

describe('Crawler', () => {
  let crawler;

  beforeEach(() => {
    crawler = new Crawler();
    jest.clearAllMocks();
    
    // Mock the crawl method directly
    crawler.crawl = jest.fn();
  });

  describe('constructor', () => {
    test('should initialize with correct properties', () => {
      expect(crawler.name).toBe('web_crawler');
      expect(crawler.description).toContain('web pages');
    });
  });

  describe('invoke method', () => {
    test('should crawl website successfully', async () => {
      const mockResult = {
        url: 'https://example.com',
        success: true,
        content: 'This is test content',
        links: ['https://example.com/page1', 'https://example.com/page2'],
        images: ['https://example.com/image1.jpg'],
        metadata: { title: 'Test Page', description: 'A test page' }
      };
      
      crawler.crawl.mockResolvedValue(mockResult);

      const toolCall = createMockToolCall('web_crawler_crawl', { 
        url: 'https://example.com'
      });
      const result = await crawler.invoke(toolCall);

      validateToolResult(result);
      expect(result.success).toBe(true);
      expect(Array.isArray(result.data.links)).toBe(true);
      expect(result.data.url).toBe('https://example.com');
    });

    test('should handle crawl failure', async () => {
      crawler.crawl.mockRejectedValue(new Error('Network timeout'));

      const toolCall = createMockToolCall('web_crawler_crawl', { 
        url: 'https://invalid-url.com'
      });
      const result = await crawler.invoke(toolCall);

      validateToolResult(result);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Network timeout');
    });
  });
});