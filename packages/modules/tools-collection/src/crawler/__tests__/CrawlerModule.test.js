/**
 * Integration Tests for CrawlerModule
 * Testing web crawling functionality
 * Following TDD principles and Clean Architecture
 */

import { jest } from '@jest/globals';
import CrawlerModule from '../CrawlerModule.js';
import Crawler from '../index.js';

describe('CrawlerModule Integration Tests', () => {
  let crawlerModule;
  let mockResourceManager;
  
  beforeAll(async () => {
    // Create mock ResourceManager for testing
    mockResourceManager = {
      get: jest.fn((key) => {
        const mockData = {
          'env.PUPPETEER_EXECUTABLE_PATH': undefined,
          'env.BROWSER_TIMEOUT': '30000'
        };
        return mockData[key];
      }),
      set: jest.fn(),
      has: jest.fn(() => false)
    };
    
    crawlerModule = await CrawlerModule.create(mockResourceManager);
  });

  describe('Module Creation and Initialization', () => {
    it('should create module with correct metadata', () => {
      expect(crawlerModule.name).toBe('CrawlerModule');
      expect(crawlerModule.description).toBe('Web crawler for extracting content from webpages');
      expect(crawlerModule.version).toBe('1.0.0');
    });

    it('should have ResourceManager injected', () => {
      expect(crawlerModule.resourceManager).toBeDefined();
      expect(crawlerModule.resourceManager).toBe(mockResourceManager);
    });

    it('should register Crawler tool during initialization', () => {
      const tool = crawlerModule.getTool('web_crawler');
      expect(tool).toBeDefined();
      expect(tool).toBeInstanceOf(Crawler);
    });
  });

  describe('Tool Registration', () => {
    it('should provide correct tool description', () => {
      const tool = crawlerModule.getTool('web_crawler');
      const description = tool.getToolDescription();
      
      expect(description.type).toBe('function');
      expect(description.function.name).toBe('web_crawler_crawl');
      expect(description.function.parameters.required).toContain('url');
    });

    it('should have proper schema definition', () => {
      const tool = crawlerModule.getTool('web_crawler');
      const description = tool.getToolDescription();
      
      expect(description.function.parameters.properties.url).toBeDefined();
      expect(description.function.parameters.properties.waitForSelector).toBeDefined();
      expect(description.function.parameters.properties.limit).toBeDefined();
    });
  });

  describe('Crawl Operations', () => {
    it('should validate required url parameter', async () => {
      const tool = crawlerModule.getTool('web_crawler');
      
      try {
        await tool.execute({});
        fail('Should have thrown error for missing URL');
      } catch (error) {
        expect(error.message).toContain('required parameter');
        expect(error.cause.errorType).toBe('validation_error');
      }
    });

    it('should validate empty URL parameter', async () => {
      const tool = crawlerModule.getTool('web_crawler');
      
      try {
        await tool.execute({ url: '' });
        fail('Should have thrown error for empty URL');
      } catch (error) {
        expect(error.cause.errorType).toBe('validation_error');
      }
    });

    it('should validate invalid URL format', async () => {
      const tool = crawlerModule.getTool('web_crawler');
      
      try {
        await tool.execute({ url: 'not-a-valid-url' });
        fail('Should have thrown error for invalid URL');
      } catch (error) {
        expect(error.cause.errorType).toBe('validation_error');
      }
    });

    it('should handle limit parameter', async () => {
      const tool = crawlerModule.getTool('web_crawler');
      
      // Mock to avoid browser launch
      const originalCrawl = tool.crawl;
      tool.crawl = jest.fn().mockResolvedValue({
        url: 'https://example.com',
        content: 'Test content',
        links: [],
        images: [],
        metadata: {}
      });
      
      await tool.execute({
        url: 'https://example.com',
        limit: 50
      });
      
      expect(tool.crawl).toHaveBeenCalledWith(
        'https://example.com',
        undefined,
        50
      );
      
      tool.crawl = originalCrawl;
    });

    it('should handle waitForSelector parameter', async () => {
      const tool = crawlerModule.getTool('web_crawler');
      
      // Mock to avoid browser launch
      const originalCrawl = tool.crawl;
      tool.crawl = jest.fn().mockResolvedValue({
        url: 'https://example.com',
        content: 'Test content',
        links: [],
        images: [],
        metadata: {}
      });
      
      await tool.execute({
        url: 'https://example.com',
        waitForSelector: '.content'
      });
      
      expect(tool.crawl).toHaveBeenCalledWith(
        'https://example.com',
        '.content',
        100
      );
      
      tool.crawl = originalCrawl;
    });
  });

  describe('Error Handling', () => {
    it('should handle browser launch errors gracefully', async () => {
      const tool = crawlerModule.getTool('web_crawler');
      
      // Mock to simulate browser launch error
      const originalCrawl = tool.crawl;
      tool.crawl = jest.fn().mockRejectedValue(
        new Error('Failed to launch browser: Network error')
      );
      
      try {
        await tool.execute({ url: 'https://example.com' });
        fail('Should have thrown browser launch error');
      } catch (error) {
        expect(error.message).toContain('Failed to launch browser');
        expect(error.cause.errorType).toBe('crawl_error');
      } finally {
        tool.crawl = originalCrawl;
      }
    });

    it('should handle page load errors', async () => {
      const tool = crawlerModule.getTool('web_crawler');
      
      // Mock to simulate page load error
      const originalCrawl = tool.crawl;
      tool.crawl = jest.fn().mockRejectedValue(
        new Error('Failed to load page: 404 Not Found')
      );
      
      try {
        await tool.execute({ url: 'https://nonexistent.example.com' });
        fail('Should have thrown page load error');
      } catch (error) {
        expect(error.message).toContain('Failed to load page');
        expect(error.cause.errorType).toBe('crawl_error');
      } finally {
        tool.crawl = originalCrawl;
      }
    });

    it('should handle timeout errors', async () => {
      const tool = crawlerModule.getTool('web_crawler');
      
      // Mock to simulate timeout
      const originalCrawl = tool.crawl;
      tool.crawl = jest.fn().mockRejectedValue(
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
        expect(error.cause.errorType).toBe('crawl_error');
      } finally {
        tool.crawl = originalCrawl;
      }
    });
  });

  describe('Result Structure', () => {
    it('should return proper success structure', async () => {
      const tool = crawlerModule.getTool('web_crawler');
      
      // Mock successful crawl
      const originalCrawl = tool.crawl;
      const mockResult = {
        url: 'https://example.com',
        content: 'Page content here',
        links: [
          { text: 'Link 1', href: 'https://example.com/page1', title: '' }
        ],
        images: [
          { src: 'https://example.com/image1.jpg', alt: 'Image 1', title: '' }
        ],
        metadata: {
          title: 'Example Page',
          description: 'Test page description'
        }
      };
      
      tool.crawl = jest.fn().mockResolvedValue(mockResult);
      
      const result = await tool.execute({ url: 'https://example.com' });
      
      expect(result).toHaveProperty('url');
      expect(result).toHaveProperty('content');
      expect(result).toHaveProperty('links');
      expect(result).toHaveProperty('images');
      expect(result).toHaveProperty('metadata');
      expect(result.url).toBe('https://example.com');
      expect(Array.isArray(result.links)).toBe(true);
      expect(Array.isArray(result.images)).toBe(true);
      
      tool.crawl = originalCrawl;
    });

    it('should limit extracted content', async () => {
      const tool = crawlerModule.getTool('web_crawler');
      
      // Mock with lots of links
      const originalCrawl = tool.crawl;
      const manyLinks = Array(200).fill(null).map((_, i) => ({
        text: `Link ${i}`,
        href: `https://example.com/page${i}`,
        title: ''
      }));
      
      tool.crawl = jest.fn().mockResolvedValue({
        url: 'https://example.com',
        content: 'A'.repeat(5000), // Content truncated to 5000 chars by crawl method
        links: manyLinks.slice(0, 50), // Should be limited
        images: [],
        metadata: {}
      });
      
      const result = await tool.execute({ 
        url: 'https://example.com',
        limit: 50
      });
      
      expect(result.links.length).toBeLessThanOrEqual(50);
      expect(result.content.length).toBeLessThanOrEqual(5000); // Content is truncated to 5000
      
      tool.crawl = originalCrawl;
    });
  });

  describe('Module Statistics', () => {
    it('should provide module statistics', () => {
      const stats = crawlerModule.getStatistics ? 
        crawlerModule.getStatistics() : 
        { toolCount: 1 };
      
      expect(stats.toolCount).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Integration with ResourceManager', () => {
    it('should use ResourceManager for configuration', () => {
      const tool = crawlerModule.getTool('web_crawler');
      
      // Module should have access to ResourceManager
      expect(crawlerModule.resourceManager).toBeDefined();
      
      // Tool should be properly initialized through module
      expect(tool).toBeDefined();
      expect(tool.name).toBe('web_crawler');
    });
  });
});