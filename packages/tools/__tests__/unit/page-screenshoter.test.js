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
  });

  describe('constructor', () => {
    test('should initialize with correct properties', () => {
      expect(pageScreenshot.name).toBe('page_screenshot');
      expect(pageScreenshot.description).toContain('screenshot of web pages');
    });
  });

  describe('invoke method', () => {
    test('should take screenshot successfully', async () => {
      const mockScreenshotBuffer = Buffer.from('fake-image-data');
      mockPage.screenshot.mockResolvedValue(mockScreenshotBuffer);

      const toolCall = createMockToolCall('page_screenshot_take', { 
        url: 'https://example.com',
        outputPath: '/tmp/screenshot.png'
      });
      const result = await pageScreenshot.invoke(toolCall);

      validateToolResult(result);
      expect(result.success).toBe(true);
      expect(result.data.outputPath).toBe('/tmp/screenshot.png');
      expect(mockPuppeteer.launch).toHaveBeenCalled();
      expect(mockPage.goto).toHaveBeenCalledWith('https://example.com');
    });

    test('should handle screenshot failure', async () => {
      mockPage.goto.mockRejectedValue(new Error('Page load failed'));

      const toolCall = createMockToolCall('page_screenshot_take', { 
        url: 'https://invalid-url.com',
        outputPath: '/tmp/screenshot.png'
      });
      const result = await pageScreenshot.invoke(toolCall);

      validateToolResult(result);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Page load failed');
    });
  });
});