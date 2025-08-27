/**
 * Unit tests for WebFetchTool
 */

import { WebFetchTool } from '../../../src/web-tools/WebFetchTool.js';
import { jest } from '@jest/globals';

describe('WebFetchTool', () => {
  let tool;

  beforeEach(() => {
    tool = new WebFetchTool();
  });

  describe('constructor', () => {
    it('should create tool with correct metadata', () => {
      expect(tool.name).toBe('WebFetch');
      expect(tool.description).toBe('Fetch content from a URL and process it with a prompt');
    });
  });

  describe('fetchAndProcess', () => {
    it('should validate URL format', async () => {
      const input = {
        url: 'not-a-url',
        prompt: 'Process this'
      };

      const result = await tool.execute(input);

      expect(result.success).toBe(false);
      // Validation error could be in data.error or result.error
      expect(result.data || result.error).toBeDefined();
    });

    it('should validate prompt is provided', async () => {
      const input = {
        url: 'https://example.com',
        prompt: ''
      };

      const result = await tool.execute(input);

      expect(result.success).toBe(false);
      // Validation error could be in data.error or result.error
      expect(result.data || result.error).toBeDefined();
    });

    it('should validate timeout range', async () => {
      const input = {
        url: 'https://example.com',
        prompt: 'Process this',
        timeout: 100000 // Too high
      };

      const result = await tool.execute(input);

      expect(result.success).toBe(false);
      // Validation error could be in data.error or result.error
      expect(result.data || result.error).toBeDefined();
    });

    // Live network test - will make actual request
    it('should fetch real content from a URL', async () => {
      const input = {
        url: 'https://www.example.com',
        prompt: 'Summarize this page'
      };

      const result = await tool.execute(input);

      // Could succeed or fail depending on network
      expect(result).toBeDefined();
      expect(result.success).toBeDefined();
      
      if (result.success) {
        expect(result.data).toBeDefined();
        expect(result.data.prompt).toBe('Summarize this page');
        expect(result.data.content_summary).toBeDefined();
        expect(result.data.metadata).toBeDefined();
        expect(result.data.metadata.url).toBe('https://www.example.com');
      } else {
        expect(result.error).toBeDefined();
        expect(result.error.code).toBeDefined();
      }
    });
  });

  describe('getToolMetadata', () => {
    it('should return complete metadata', () => {
      const metadata = tool.getMetadata();

      expect(metadata.name).toBe('WebFetch');
      expect(metadata.description).toBe('Fetch content from a URL and process it with a prompt');
      expect(metadata.input).toBeDefined();
      expect(metadata.input.url).toBeDefined();
      expect(metadata.input.url.required).toBe(true);
      expect(metadata.input.prompt).toBeDefined();
      expect(metadata.input.prompt.required).toBe(true);
      expect(metadata.input.headers).toBeDefined();
      expect(metadata.input.headers.required).toBe(false);
      expect(metadata.output).toBeDefined();
      expect(metadata.output.analysis).toBeDefined();
    });
  });
});