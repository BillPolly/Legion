/**
 * Unit tests for Page Screenshot Tool
 */

import { jest } from '@jest/globals';
import PageScreenshot from '../../src/page-screenshoter/index.js';
import { createMockToolCall, validateToolResult } from '../utils/test-helpers.js';

// Mock puppeteer
const mockPage = {
  goto: jest.fn(),
  screenshot: jest.fn(),
  close: jest.fn(),
  setViewport: jest.fn()
};

const mockBrowser = {
  newPage: jest.fn(() => mockPage),
  close: jest.fn()
};

const mockPuppeteer = {
  launch: jest.fn(() => mockBrowser)
};

jest.unstable_mockModule('puppeteer', () => ({ default: mockPuppeteer }));

describe('PageScreenshot', () => {
  let pageScreenshot;

  beforeEach(() => {
    pageScreenshot = new PageScreenshot();
    jest.clearAllMocks();
    
    // Mock the screenshot method directly to avoid ES6 module mocking issues
    pageScreenshot.screenshot = jest.fn();
  });

  describe('constructor', () => {
    test('should initialize with correct properties', () => {
      expect(pageScreenshot.name).toBe('page_screenshot');
      expect(pageScreenshot.description).toContain('screenshots of web pages');
    });
  });

  describe('invoke method', () => {
    test('should take screenshot successfully', async () => {
      const mockResult = {
        success: true,
        url: 'https://example.com',
        image: 'base64-image-data',
        isImage: true,
        mimeType: 'image/png',
        fullPage: false,
        dimensions: { width: 1280, height: 720 }
      };
      
      pageScreenshot.screenshot.mockResolvedValue(mockResult);

      const toolCall = createMockToolCall('page_screenshot_capture', { 
        url: 'https://example.com'
      });
      const result = await pageScreenshot.invoke(toolCall);

      validateToolResult(result);
      expect(result.success).toBe(true);
      expect(result.data.url).toBe('https://example.com');
      expect(result.data.image).toBe('base64-image-data');
      expect(pageScreenshot.screenshot).toHaveBeenCalledWith('https://example.com', undefined, undefined, undefined, undefined);
    });

    test('should handle screenshot failure', async () => {
      pageScreenshot.screenshot.mockRejectedValue(new Error('Page load failed'));

      const toolCall = createMockToolCall('page_screenshot_capture', { 
        url: 'https://invalid-url.com'
      });
      const result = await pageScreenshot.invoke(toolCall);

      validateToolResult(result);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Page load failed');
    });
  });
});