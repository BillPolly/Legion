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
  });

  describe('constructor', () => {
    test('should initialize with correct properties', () => {
      expect(crawler.name).toBe('crawler');
      expect(crawler.description).toContain('crawl websites');
    });
  });

  describe('invoke method', () => {
    test('should crawl website successfully', async () => {
      const mockHtml = '<html><body><a href="/page1">Link 1</a><a href="/page2">Link 2</a></body></html>';
      mockAxios.get.mockResolvedValue({ data: mockHtml });

      const mockElement = {
        find: jest.fn().mockReturnThis(),
        map: jest.fn((fn) => {
          // Simulate map returning array of hrefs
          return ['/page1', '/page2'];
        }),
        get: jest.fn().mockReturnValue(['/page1', '/page2'])
      };
      mockCheerio.load.mockReturnValue(() => mockElement);

      const toolCall = createMockToolCall('crawler_crawl', { 
        url: 'https://example.com',
        maxDepth: 1
      });
      const result = await crawler.invoke(toolCall);

      validateToolResult(result);
      expect(result.success).toBe(true);
      expect(Array.isArray(result.data.urls)).toBe(true);
    });

    test('should handle crawl failure', async () => {
      mockAxios.get.mockRejectedValue(new Error('Network timeout'));

      const toolCall = createMockToolCall('crawler_crawl', { 
        url: 'https://invalid-url.com'
      });
      const result = await crawler.invoke(toolCall);

      validateToolResult(result);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Network timeout');
    });
  });
});