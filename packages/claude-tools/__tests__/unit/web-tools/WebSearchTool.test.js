/**
 * Unit tests for WebSearchTool
 */

import { WebSearchTool } from '../../../src/web-tools/WebSearchTool.js';
import { jest } from '@jest/globals';

describe('WebSearchTool', () => {
  let tool;

  beforeEach(() => {
    tool = new WebSearchTool();
  });

  describe('constructor', () => {
    it('should create tool with correct metadata', () => {
      expect(tool.name).toBe('WebSearch');
      expect(tool.description).toBe('Search the web for current information');
    });
  });

  describe('searchWeb', () => {
    it('should return mock search results for valid query', async () => {
      const input = {
        query: 'test query'
      };

      const result = await tool.execute(input);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data.query).toBe('test query');
      expect(result.data.results).toBeInstanceOf(Array);
      expect(result.data.results.length).toBeGreaterThan(0);
      expect(result.data.search_metadata).toBeDefined();
      expect(result.data.search_metadata.search_engine).toBe('mock');
    });

    it('should filter results by allowed domains', async () => {
      const input = {
        query: 'test query',
        allowed_domains: ['example.com']
      };

      const result = await tool.execute(input);

      expect(result.success).toBe(true);
      expect(result.data.results).toBeInstanceOf(Array);
      
      // All results should be from allowed domains
      result.data.results.forEach(r => {
        expect(input.allowed_domains).toContain(r.domain);
      });
    });

    it('should filter out blocked domains', async () => {
      const input = {
        query: 'test query',
        blocked_domains: ['example.com']
      };

      const result = await tool.execute(input);

      expect(result.success).toBe(true);
      expect(result.data.results).toBeInstanceOf(Array);
      
      // No results should be from blocked domains
      result.data.results.forEach(r => {
        expect(input.blocked_domains).not.toContain(r.domain);
      });
    });

    it('should handle both allowed and blocked domains', async () => {
      const input = {
        query: 'test query',
        allowed_domains: ['example.org'],
        blocked_domains: ['example.com']
      };

      const result = await tool.execute(input);

      expect(result.success).toBe(true);
      expect(result.data.results).toBeInstanceOf(Array);
      
      // Should only have results from example.org
      result.data.results.forEach(r => {
        expect(r.domain).toBe('example.org');
      });
    });

    it('should validate minimum query length', async () => {
      const input = {
        query: 'a' // Too short
      };

      const result = await tool.execute(input);

      // Tool base class will validate and return error in data field
      expect(result.success).toBe(false);
      expect(result.data).toBeDefined();
      // The Tool base class puts validation errors in data.error
      if (result.data.error) {
        expect(result.data.error).toBeDefined();
      } else if (result.error) {
        expect(result.error).toBeDefined();
      }
    });

    it('should include search metadata', async () => {
      const input = {
        query: 'test query'
      };

      const result = await tool.execute(input);

      expect(result.success).toBe(true);
      expect(result.data.search_metadata).toBeDefined();
      expect(result.data.search_metadata.total_results).toBeGreaterThanOrEqual(0);
      expect(result.data.search_metadata.search_time_ms).toBeGreaterThanOrEqual(0);
      expect(result.data.search_metadata.search_engine).toBe('mock');
    });
  });

  describe('getToolMetadata', () => {
    it('should return complete metadata', () => {
      const metadata = tool.getMetadata();

      expect(metadata.name).toBe('WebSearch');
      expect(metadata.description).toBe('Search the web for current information');
      expect(metadata.input).toBeDefined();
      expect(metadata.input.query).toBeDefined();
      expect(metadata.input.query.required).toBe(true);
      expect(metadata.input.allowed_domains).toBeDefined();
      expect(metadata.input.allowed_domains.required).toBe(false);
      expect(metadata.output).toBeDefined();
      expect(metadata.output.results).toBeDefined();
    });
  });
});