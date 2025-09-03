import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import WebProcessor from '../src/processors/WebProcessor.js';

describe('WebProcessor', () => {
  let webProcessor;
  let mockAxios;

  beforeEach(() => {
    // Mock axios for unit tests (mocks allowed in unit tests)
    mockAxios = {
      get: jest.fn()
    };

    webProcessor = new WebProcessor({
      timeout: 10000,
      maxContentSize: 1024 * 1024, // 1MB
      userAgent: 'Legion Semantic Search Bot'
    });
    
    // Inject mock for unit testing
    webProcessor.axios = mockAxios;
  });

  describe('constructor', () => {
    it('should create instance with correct properties', () => {
      expect(webProcessor.options.timeout).toBe(10000);
      expect(webProcessor.options.maxContentSize).toBe(1024 * 1024);
      expect(webProcessor.options.userAgent).toContain('Legion');
    });
  });

  describe('URL validation', () => {
    it('should validate HTTP and HTTPS URLs', () => {
      expect(webProcessor.isValidUrl('https://example.com')).toBe(true);
      expect(webProcessor.isValidUrl('http://example.com')).toBe(true);
      expect(webProcessor.isValidUrl('https://docs.example.com/guide')).toBe(true);
    });

    it('should reject invalid URLs', () => {
      expect(webProcessor.isValidUrl('ftp://example.com')).toBe(false);
      expect(webProcessor.isValidUrl('file:///local/file')).toBe(false);
      expect(webProcessor.isValidUrl('javascript:alert(1)')).toBe(false);
      expect(webProcessor.isValidUrl('not-a-url')).toBe(false);
    });

    it('should reject localhost and private IPs', () => {
      expect(webProcessor.isValidUrl('http://localhost:3000')).toBe(false);
      expect(webProcessor.isValidUrl('http://127.0.0.1')).toBe(false);
      expect(webProcessor.isValidUrl('http://192.168.1.1')).toBe(false);
      expect(webProcessor.isValidUrl('http://10.0.0.1')).toBe(false);
    });
  });

  describe('HTML content extraction', () => {
    it('should extract text from HTML content', () => {
      const html = `<html>
        <head><title>Test Page</title></head>
        <body>
          <h1>Main Heading</h1>
          <p>This is paragraph content.</p>
          <div>Some div content.</div>
          <script>console.log('should be removed');</script>
          <style>.class { color: red; }</style>
        </body>
      </html>`;

      const extracted = webProcessor.extractTextFromHtml(html);
      
      expect(extracted.title).toBe('Test Page');
      expect(extracted.content).toContain('Main Heading');
      expect(extracted.content).toContain('paragraph content');
      expect(extracted.content).toContain('div content');
      
      // Should remove scripts and styles
      expect(extracted.content).not.toContain('console.log');
      expect(extracted.content).not.toContain('color: red');
    });

    it('should handle malformed HTML gracefully', () => {
      const malformedHtml = '<html><body><p>Unclosed paragraph<div>Content</div>';
      
      const extracted = webProcessor.extractTextFromHtml(malformedHtml);
      
      expect(extracted.content).toContain('Unclosed paragraph');
      expect(extracted.content).toContain('Content');
    });

    it('should preserve heading structure for context', () => {
      const html = `<html><body>
        <h1>Chapter 1</h1>
        <p>Chapter content</p>
        <h2>Section 1.1</h2>
        <p>Section content</p>
        <h3>Subsection 1.1.1</h3>
        <p>Subsection content</p>
      </body></html>`;

      const extracted = webProcessor.extractTextFromHtml(html);
      
      expect(extracted.headings).toContain('Chapter 1');
      expect(extracted.headings).toContain('Section 1.1');
      expect(extracted.headings).toContain('Subsection 1.1.1');
    });
  });

  describe('URL processing', () => {
    it('should process valid URL successfully', async () => {
      const mockResponse = {
        data: '<html><head><title>Test</title></head><body><h1>Content</h1></body></html>',
        headers: {
          'content-type': 'text/html; charset=utf-8'
        },
        status: 200
      };

      mockAxios.get.mockResolvedValue(mockResponse);

      const result = await webProcessor.processUrl('https://example.com/test');
      
      expect(result.url).toBe('https://example.com/test');
      expect(result.content).toContain('Content');
      expect(result.contentType).toBe('text/html');
      expect(result.title).toBe('Test');
      expect(result.statusCode).toBe(200);
    });

    it('should throw error for invalid URLs', async () => {
      await expect(
        webProcessor.processUrl('invalid-url')
      ).rejects.toThrow('Invalid URL format');
    });

    it('should throw error for network failures', async () => {
      mockAxios.get.mockRejectedValue(new Error('Network error'));

      await expect(
        webProcessor.processUrl('https://nonexistent.example.com')
      ).rejects.toThrow('Failed to fetch URL');
    });

    it('should handle HTTP error responses', async () => {
      const error = new Error('Request failed');
      error.response = { status: 404, statusText: 'Not Found' };
      mockAxios.get.mockRejectedValue(error);

      await expect(
        webProcessor.processUrl('https://example.com/missing')
      ).rejects.toThrow('HTTP Error 404');
    });

    it('should respect content size limits', async () => {
      const largeContent = 'x'.repeat(2 * 1024 * 1024); // 2MB
      const mockResponse = {
        data: `<html><body>${largeContent}</body></html>`,
        headers: { 'content-type': 'text/html' },
        status: 200
      };

      mockAxios.get.mockResolvedValue(mockResponse);

      await expect(
        webProcessor.processUrl('https://example.com/large')
      ).rejects.toThrow('Content size exceeds maximum');
    });
  });

  describe('content type detection', () => {
    it('should detect content type from response headers', async () => {
      const mockResponse = {
        data: '<html><body>Test</body></html>',
        headers: {
          'content-type': 'text/html; charset=utf-8'
        },
        status: 200
      };

      mockAxios.get.mockResolvedValue(mockResponse);

      const result = await webProcessor.processUrl('https://example.com');
      expect(result.contentType).toBe('text/html');
    });

    it('should fallback to URL extension for content type', async () => {
      const mockResponse = {
        data: '{"test": "json"}',
        headers: {}, // No content-type header
        status: 200
      };

      mockAxios.get.mockResolvedValue(mockResponse);

      const result = await webProcessor.processUrl('https://example.com/data.json');
      expect(result.contentType).toBe('application/json');
    });
  });

  describe('batch URL processing', () => {
    it('should process multiple URLs in batch', async () => {
      const urls = [
        'https://example.com/page1',
        'https://example.com/page2'
      ];

      const mockResponses = [
        {
          data: '<html><body>Page 1</body></html>',
          headers: { 'content-type': 'text/html' },
          status: 200
        },
        {
          data: '<html><body>Page 2</body></html>',
          headers: { 'content-type': 'text/html' },
          status: 200
        }
      ];

      mockAxios.get
        .mockResolvedValueOnce(mockResponses[0])
        .mockResolvedValueOnce(mockResponses[1]);

      const results = await webProcessor.processUrls(urls);
      
      expect(results).toHaveLength(2);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(true);
      expect(results[0].content).toContain('Page 1');
      expect(results[1].content).toContain('Page 2');
    });

    it('should handle mixed success/failure in batch processing', async () => {
      const urls = [
        'https://example.com/good',
        'https://example.com/bad'
      ];

      mockAxios.get
        .mockResolvedValueOnce({
          data: '<html><body>Good page</body></html>',
          headers: { 'content-type': 'text/html' },
          status: 200
        })
        .mockRejectedValueOnce(new Error('Network error'));

      const results = await webProcessor.processUrls(urls);
      
      expect(results).toHaveLength(2);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(false);
      expect(results[1].error).toContain('Failed to fetch URL');
    });
  });

  describe('metadata extraction', () => {
    it('should extract comprehensive metadata from web content', async () => {
      const html = `<html>
        <head>
          <title>Test Document</title>
          <meta name="description" content="Test description">
          <meta name="author" content="Test Author">
        </head>
        <body>
          <h1>Main Content</h1>
          <p>Paragraph content here.</p>
        </body>
      </html>`;

      const mockResponse = {
        data: html,
        headers: {
          'content-type': 'text/html; charset=utf-8',
          'content-length': html.length.toString(),
          'last-modified': 'Wed, 01 Jan 2024 12:00:00 GMT'
        },
        status: 200
      };

      mockAxios.get.mockResolvedValue(mockResponse);

      const result = await webProcessor.processUrl('https://example.com/doc');
      
      expect(result.metadata.description).toBe('Test description');
      expect(result.metadata.author).toBe('Test Author');
      expect(result.metadata.lastModified).toBeDefined();
      expect(result.metadata.contentLength).toBe(html.length);
    });
  });
});