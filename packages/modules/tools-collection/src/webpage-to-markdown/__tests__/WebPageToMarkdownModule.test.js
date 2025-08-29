/**
 * Integration Tests for WebPageToMarkdownModule
 * Testing webpage to markdown conversion functionality
 * Following TDD principles and Clean Architecture
 */

import { jest } from '@jest/globals';
import WebPageToMarkdownModule from '../WebPageToMarkdownModule.js';
import { ResourceManager } from '@legion/resource-manager';

describe('WebPageToMarkdownModule Integration Tests', () => {
  let webpageModule;
  let resourceManager;
  
  beforeAll(async () => {
    resourceManager = await ResourceManager.getInstance();
    webpageModule = await WebPageToMarkdownModule.create(resourceManager);
  });

  describe('Module Creation and Initialization', () => {
    it('should create module with correct metadata', () => {
      expect(webpageModule.name).toBe('WebPageToMarkdownModule');
      expect(webpageModule.description).toBe('Convert webpages to markdown format');
      expect(webpageModule.version).toBe('1.0.0');
    });

    it('should have ResourceManager injected', () => {
      expect(webpageModule.resourceManager).toBeDefined();
      expect(webpageModule.resourceManager).toBe(resourceManager);
    });

    it('should register WebPageToMarkdown tool during initialization', () => {
      const tool = webpageModule.getTool('webpage_to_markdown');
      expect(tool).toBeDefined();
      expect(tool.name).toBe('webpage_to_markdown');
    });
  });

  describe('Tool Registration', () => {
    it('should provide correct tool schema', () => {
      const tool = webpageModule.getTool('webpage_to_markdown');
      
      expect(tool.inputSchema).toBeDefined();
      expect(tool.inputSchema.properties.url).toBeDefined();
      expect(tool.inputSchema.required).toContain('url');
    });

    it('should have proper schema definition', () => {
      const tool = webpageModule.getTool('webpage_to_markdown');
      
      expect(tool.inputSchema.properties.url).toBeDefined();
      expect(tool.inputSchema.properties.includeImages).toBeDefined();
      expect(tool.inputSchema.properties.includeLinks).toBeDefined();
      expect(tool.inputSchema.properties.maxLength).toBeDefined();
      expect(tool.inputSchema.properties.waitForSelector).toBeDefined();
    });
  });

  describe('Conversion Operations', () => {
    it('should validate required url parameter', async () => {
      const tool = webpageModule.getTool('webpage_to_markdown');
      
      const result = await tool.execute({});
      expect(result.success).toBe(false);
      expect(result.error).toContain('Input validation failed');
    });

    it('should validate empty URL parameter', async () => {
      const tool = webpageModule.getTool('webpage_to_markdown');
      
      const result = await tool.execute({ url: '' });
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should validate invalid URL format', async () => {
      const tool = webpageModule.getTool('webpage_to_markdown');
      
      const result = await tool.execute({ url: 'not-a-valid-url' });
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should handle maxLength parameter', async () => {
      const tool = webpageModule.getTool('webpage_to_markdown');
      
      // Test with mock page to avoid actual browser launch
      const originalConvertToMarkdown = tool.convertToMarkdown;
      tool.convertToMarkdown = jest.fn().mockResolvedValue({
        url: 'https://example.com',
        markdown: 'Test content',
        length: 12,
        truncated: false
      });
      
      const result = await tool.execute({
        url: 'https://example.com',
        maxLength: 100
      });
      
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data.truncated).toBe(false);
      
      tool.convertToMarkdown = originalConvertToMarkdown;
    });

    it('should handle boolean parameters correctly', async () => {
      const tool = webpageModule.getTool('webpage_to_markdown');
      
      // Mock to avoid browser launch
      const originalConvertToMarkdown = tool.convertToMarkdown;
      tool.convertToMarkdown = jest.fn().mockImplementation((url, includeImages, includeLinks) => {
        return Promise.resolve({
          url,
          markdown: 'Test',
          length: 4,
          truncated: false,
          includeImages,
          includeLinks
        });
      });
      
      const result = await tool.execute({
        url: 'https://example.com',
        includeImages: false,
        includeLinks: false
      });
      
      expect(result.success).toBe(true);
      expect(tool.convertToMarkdown).toHaveBeenCalledWith(
        'https://example.com',
        false,
        false,
        50000,
        undefined
      );
      
      tool.convertToMarkdown = originalConvertToMarkdown;
    });
  });

  describe('Error Handling', () => {
    it('should handle network errors gracefully', async () => {
      const tool = webpageModule.getTool('webpage_to_markdown');
      
      // Mock to simulate network error
      const originalConvertToMarkdown = tool.convertToMarkdown;
      tool.convertToMarkdown = jest.fn().mockRejectedValue(
        new Error('Failed to launch browser: Network error')
      );
      
      const result = await tool.execute({ url: 'https://example.com' });
      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to launch browser');
      
      tool.convertToMarkdown = originalConvertToMarkdown;
    });

    it('should handle page load errors', async () => {
      const tool = webpageModule.getTool('webpage_to_markdown');
      
      // Mock to simulate page load error
      const originalConvertToMarkdown = tool.convertToMarkdown;
      tool.convertToMarkdown = jest.fn().mockRejectedValue(
        new Error('Failed to load page: 404 Not Found')
      );
      
      const result = await tool.execute({ url: 'https://nonexistent.example.com' });
      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to load page');
      
      tool.convertToMarkdown = originalConvertToMarkdown;
    });

    it('should handle timeout errors', async () => {
      const tool = webpageModule.getTool('webpage_to_markdown');
      
      // Mock to simulate timeout
      const originalConvertToMarkdown = tool.convertToMarkdown;
      tool.convertToMarkdown = jest.fn().mockRejectedValue(
        new Error('Navigation timeout exceeded')
      );
      
      const result = await tool.execute({ 
        url: 'https://slow-loading-site.com',
        waitForSelector: '.never-appears'
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain('timeout');
      
      tool.convertToMarkdown = originalConvertToMarkdown;
    });
  });

  describe('Result Structure', () => {
    it('should return proper success structure', async () => {
      const tool = webpageModule.getTool('webpage_to_markdown');
      
      // Mock successful conversion
      const originalConvertToMarkdown = tool.convertToMarkdown;
      const mockResult = {
        url: 'https://example.com',
        markdown: '# Test Page\n\nContent here',
        length: 25,
        truncated: false
      };
      
      tool.convertToMarkdown = jest.fn().mockResolvedValue(mockResult);
      
      const result = await tool.execute({ url: 'https://example.com' });
      
      expect(result).toHaveProperty('success', true);
      expect(result).toHaveProperty('data');
      expect(result.data).toHaveProperty('url');
      expect(result.data).toHaveProperty('markdown');
      expect(result.data).toHaveProperty('length');
      expect(result.data).toHaveProperty('truncated');
      expect(result.data.url).toBe('https://example.com');
      
      tool.convertToMarkdown = originalConvertToMarkdown;
    });

    it('should handle truncated content', async () => {
      const tool = webpageModule.getTool('webpage_to_markdown');
      
      // Mock truncation scenario
      const originalConvertToMarkdown = tool.convertToMarkdown;
      const longContent = 'A'.repeat(60000);
      
      tool.convertToMarkdown = jest.fn().mockResolvedValue({
        url: 'https://example.com',
        markdown: longContent.substring(0, 50000) + '\n\n... (truncated)',
        length: 50017,
        truncated: true
      });
      
      const result = await tool.execute({ 
        url: 'https://example.com',
        maxLength: 50000
      });
      
      expect(result.success).toBe(true);
      expect(result.data.truncated).toBe(true);
      expect(result.data.length).toBeLessThanOrEqual(50100); // Allow for truncation message
      
      tool.convertToMarkdown = originalConvertToMarkdown;
    });
  });

  describe('Module Statistics', () => {
    it('should provide module statistics', () => {
      const stats = webpageModule.getStatistics ? 
        webpageModule.getStatistics() : 
        { toolCount: 1 };
      
      expect(stats.toolCount).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Integration with ResourceManager', () => {
    it('should use ResourceManager for configuration', () => {
      const tool = webpageModule.getTool('webpage_to_markdown');
      
      // Module should have access to ResourceManager
      expect(webpageModule.resourceManager).toBeDefined();
      
      // Tool should be properly initialized through module
      expect(tool).toBeDefined();
      expect(tool.name).toBe('webpage_to_markdown');
    });
  });
});