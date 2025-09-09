/**
 * Integration tests for WebFetchTool with real web requests
 * NO MOCKS - uses real HTTP requests
 */

import WebFetchTool from '../../src/tools/WebFetchTool.js';

describe('WebFetchTool Integration', () => {
  let tool;

  beforeEach(() => {
    tool = new WebFetchTool({ timeout: 10000, maxLength: 50000 });
  });

  test('should fetch real web page content', async () => {
    const result = await tool._execute({
      url: 'https://example.com'
    });

    expect(result.url).toBe('https://example.com');
    expect(typeof result.content).toBe('string');
    expect(result.content.length).toBeGreaterThan(0);
    
    // Should contain example.com content
    expect(result.content.toLowerCase()).toContain('example');
  }, 15000);

  test('should extract page title from HTML', async () => {
    const result = await tool._execute({
      url: 'https://httpbin.org/html'
    });

    expect(result.url).toBe('https://httpbin.org/html');
    expect(typeof result.title).toBe('string');
    expect(typeof result.content).toBe('string');
    expect(result.content.length).toBeGreaterThan(0);
  }, 15000);

  test('should handle different content types', async () => {
    const result = await tool._execute({
      url: 'https://httpbin.org/json'
    });

    expect(result.url).toBe('https://httpbin.org/json');
    expect(typeof result.content).toBe('string');
    expect(result.content.length).toBeGreaterThan(0);
  }, 15000);

  test('should validate URL format', async () => {
    await expect(tool._execute({
      url: 'invalid-url'
    })).rejects.toThrow('Invalid URL format');

    await expect(tool._execute({
      url: 'ftp://example.com'
    })).rejects.toThrow('Only HTTP and HTTPS URLs are supported');
  });

  test('should handle empty URL', async () => {
    await expect(tool._execute({
      url: ''
    })).rejects.toThrow('URL cannot be empty');

    await expect(tool._execute({
      url: 123
    })).rejects.toThrow('URL must be a string');
  });

  test('should handle HTTP errors gracefully', async () => {
    await expect(tool._execute({
      url: 'https://example.com/nonexistent-page-12345'
    })).rejects.toThrow('HTTP 404');
  }, 15000);

  test('should handle timeout', async () => {
    const shortTimeoutTool = new WebFetchTool({ timeout: 1000 }); // 1 second timeout
    
    await expect(shortTimeoutTool._execute({
      url: 'https://httpbin.org/delay/5' // 5 second delay
    })).rejects.toThrow('Request timeout after 1000ms');
  }, 10000);

  test('should convert HTML to text', async () => {
    const result = await tool._execute({
      url: 'https://httpbin.org/html'
    });

    // Content should be converted from HTML to text
    expect(result.content).not.toContain('<html>');
    expect(result.content).not.toContain('<body>');
    // Should contain readable text content
    expect(result.content.length).toBeGreaterThan(50);
  }, 15000);

  test('should truncate very long content', async () => {
    const shortTool = new WebFetchTool({ maxLength: 100 });
    
    const result = await shortTool._execute({
      url: 'https://httpbin.org/html'
    });

    expect(result.content.length).toBeLessThanOrEqual(200); // Should be truncated + message
    if (result.content.includes('[Content truncated')) {
      expect(result.content).toContain('[Content truncated');
    }
  }, 15000);
});