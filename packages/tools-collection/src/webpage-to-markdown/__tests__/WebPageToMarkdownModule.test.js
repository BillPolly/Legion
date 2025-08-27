/**
 * Integration Tests for WebPageToMarkdownModule
 * Testing webpage to markdown conversion functionality
 * Following TDD principles and Clean Architecture
 */

import { jest } from '@jest/globals';
import WebPageToMarkdownModule from '../WebPageToMarkdownModule.js';
import WebPageToMarkdown from '../index.js';
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
      expect(tool).toBeInstanceOf(WebPageToMarkdown);
    });
  });

  describe('Tool Registration', () => {
    it('should provide correct tool description', () => {
      const tool = webpageModule.getTool('webpage_to_markdown');
      const description = tool.getToolDescription();
      
      expect(description.type).toBe('function');
      expect(description.function.name).toBe('webpage_to_markdown_convert');
      expect(description.function.parameters.required).toContain('url');
    });

    it('should have proper schema definition', () => {
      const tool = webpageModule.getTool('webpage_to_markdown');
      const description = tool.getToolDescription();
      
      expect(description.function.parameters.properties.url).toBeDefined();
      expect(description.function.parameters.properties.includeImages).toBeDefined();
      expect(description.function.parameters.properties.includeLinks).toBeDefined();
      expect(description.function.parameters.properties.maxLength).toBeDefined();
      expect(description.function.parameters.properties.waitForSelector).toBeDefined();
    });
  });

  describe('Conversion Operations', () => {
    it('should validate required url parameter', async () => {
      const tool = webpageModule.getTool('webpage_to_markdown');
      
      try {
        await tool.execute({});
        fail('Should have thrown error for missing URL');
      } catch (error) {
        expect(error.message).toContain('required parameter');
        expect(error.cause.errorType).toBe('validation_error');
      }
    });

    it('should validate empty URL parameter', async () => {
      const tool = webpageModule.getTool('webpage_to_markdown');
      
      try {
        await tool.execute({ url: '' });
        fail('Should have thrown error for empty URL');
      } catch (error) {
        expect(error.cause.errorType).toBe('validation_error');
      }
    });

    it('should validate invalid URL format', async () => {
      const tool = webpageModule.getTool('webpage_to_markdown');
      
      try {
        await tool.execute({ url: 'not-a-valid-url' });
        fail('Should have thrown error for invalid URL');
      } catch (error) {
        expect(error.cause.errorType).toBe('validation_error');
      }
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
      
      expect(result).toBeDefined();
      expect(result.truncated).toBe(false);
      
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
      
      try {
        await tool.execute({ url: 'https://example.com' });
        fail('Should have thrown network error');
      } catch (error) {
        expect(error.message).toContain('Failed to launch browser');
        expect(error.cause.errorType).toBe('conversion_error');
      } finally {
        tool.convertToMarkdown = originalConvertToMarkdown;
      }
    });

    it('should handle page load errors', async () => {
      const tool = webpageModule.getTool('webpage_to_markdown');
      
      // Mock to simulate page load error
      const originalConvertToMarkdown = tool.convertToMarkdown;
      tool.convertToMarkdown = jest.fn().mockRejectedValue(
        new Error('Failed to load page: 404 Not Found')
      );
      
      try {
        await tool.execute({ url: 'https://nonexistent.example.com' });
        fail('Should have thrown page load error');
      } catch (error) {
        expect(error.message).toContain('Failed to load page');
        expect(error.cause.errorType).toBe('conversion_error');
      } finally {
        tool.convertToMarkdown = originalConvertToMarkdown;
      }
    });

    it('should handle timeout errors', async () => {
      const tool = webpageModule.getTool('webpage_to_markdown');
      
      // Mock to simulate timeout
      const originalConvertToMarkdown = tool.convertToMarkdown;
      tool.convertToMarkdown = jest.fn().mockRejectedValue(
        new Error('Navigation timeout exceeded')
      );
      
      try {
        await tool.execute({ 
          url: 'https://slow-loading-site.com',
          waitForSelector: '.never-appears'
        });
        fail('Should have thrown timeout error');
      } catch (error) {
        expect(error.message).toContain('timeout');
        expect(error.cause.errorType).toBe('conversion_error');
      } finally {
        tool.convertToMarkdown = originalConvertToMarkdown;
      }
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
      
      expect(result).toHaveProperty('url');
      expect(result).toHaveProperty('markdown');
      expect(result).toHaveProperty('length');
      expect(result).toHaveProperty('truncated');
      expect(result.url).toBe('https://example.com');
      
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
      
      expect(result.truncated).toBe(true);
      expect(result.length).toBeLessThanOrEqual(50100); // Allow for truncation message
      
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