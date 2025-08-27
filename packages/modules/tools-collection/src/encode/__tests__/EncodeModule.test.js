/**
 * Comprehensive test suite for EncodeModule
 * Tests all encoding/decoding tools with 100% coverage requirement
 * Following TDD principles established by CalculatorModule
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { ResourceManager } from '@legion/resource-manager';
import EncodeModule from '../EncodeModule.js';

describe('EncodeModule', () => {
  let encodeModule;
  let resourceManager;

  beforeEach(async () => {
    // Get ResourceManager instance
    resourceManager = await ResourceManager.getInstance();
    
    // Create fresh module instance for each test
    encodeModule = await EncodeModule.create(resourceManager);
  });

  afterEach(() => {
    // Clean up any resources
    if (encodeModule) {
      encodeModule = null;
    }
  });

  describe('Module Creation and Initialization', () => {
    it('should create module with correct metadata', () => {
      expect(encodeModule.name).toBe('encode');
      expect(encodeModule.description).toBe('Encoding and decoding utilities for various formats');
      expect(encodeModule.version).toBe('1.0.0');
    });

    it('should have ResourceManager injected', () => {
      expect(encodeModule.resourceManager).toBe(resourceManager);
    });

    it('should register all encoding tools during initialization', () => {
      const tools = encodeModule.getTools();
      expect(tools).toHaveLength(4);
      
      const toolNames = tools.map(t => t.name);
      expect(toolNames).toContain('base64_encode');
      expect(toolNames).toContain('base64_decode');
      expect(toolNames).toContain('url_encode');
      expect(toolNames).toContain('url_decode');
    });

    it('should have proper module structure', () => {
      expect(encodeModule).toHaveProperty('initialize');
      expect(encodeModule).toHaveProperty('getTools');
      expect(encodeModule).toHaveProperty('registerTool');
      expect(typeof encodeModule.initialize).toBe('function');
    });

    it('should create module via static create method', async () => {
      const newModule = await EncodeModule.create(resourceManager);
      expect(newModule).toBeInstanceOf(EncodeModule);
      expect(newModule.resourceManager).toBe(resourceManager);
    });
  });

  describe('Base64 Encoding Tool', () => {
    let base64EncodeTool;

    beforeEach(() => {
      const tools = encodeModule.getTools();
      base64EncodeTool = tools.find(t => t.name === 'base64_encode');
    });

    it('should have correct tool metadata', () => {
      expect(base64EncodeTool.name).toBe('base64_encode');
      expect(base64EncodeTool.description).toBe('Encode data to base64 format');
    });

    it('should have getMetadata method', () => {
      expect(typeof base64EncodeTool.getMetadata).toBe('function');
      const metadata = base64EncodeTool.getMetadata();
      expect(metadata.name).toBe('base64_encode');
      expect(metadata.category).toBe('encoding');
      expect(metadata.tags).toContain('base64');
    });

    it('should have validate method', () => {
      expect(typeof base64EncodeTool.validate).toBe('function');
      
      // Test valid input
      const validResult = base64EncodeTool.validate({ data: 'test' });
      expect(validResult.valid).toBe(true);
      
      // Test invalid input
      const invalidResult = base64EncodeTool.validate({ data: null });
      expect(invalidResult.valid).toBe(false);
    });

    it('should encode simple text correctly', async () => {
      const result = await base64EncodeTool.execute({ data: 'hello world' });
      
      expect(result.success).toBe(true);
      expect(result.result).toBe('aGVsbG8gd29ybGQ=');
      expect(result.originalLength).toBe(11);
      expect(result.encodedLength).toBe(16);
    });

    it('should encode empty string correctly', async () => {
      const result = await base64EncodeTool.execute({ data: '' });
      
      expect(result.success).toBe(true);
      expect(result.result).toBe('');
      expect(result.originalLength).toBe(0);
      expect(result.encodedLength).toBe(0);
    });

    it('should encode unicode text correctly', async () => {
      const result = await base64EncodeTool.execute({ data: 'Hello 世界!' });
      
      expect(result.success).toBe(true);
      expect(result.result).toBe('SGVsbG8g5LiW55WMIQ==');
    });

    it('should handle different input encodings', async () => {
      const result = await base64EncodeTool.execute({ 
        data: 'hello', 
        inputEncoding: 'ascii' 
      });
      
      expect(result.success).toBe(true);
      expect(result.result).toBe('aGVsbG8=');
    });

    it('should handle missing data parameter', async () => {
      const result = await base64EncodeTool.execute({});
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Data is required for encoding');
    });

    it('should handle null data parameter', async () => {
      const result = await base64EncodeTool.execute({ data: null });
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Data is required for encoding');
    });

    it('should handle large text data', async () => {
      const largeText = 'a'.repeat(10000);
      const result = await base64EncodeTool.execute({ data: largeText });
      
      expect(result.success).toBe(true);
      expect(result.originalLength).toBe(10000);
      expect(result.encodedLength).toBeGreaterThan(10000);
    });
  });

  describe('Base64 Decoding Tool', () => {
    let base64DecodeTool;

    beforeEach(() => {
      const tools = encodeModule.getTools();
      base64DecodeTool = tools.find(t => t.name === 'base64_decode');
    });

    it('should have correct tool metadata', () => {
      expect(base64DecodeTool.name).toBe('base64_decode');
      expect(base64DecodeTool.description).toBe('Decode base64 encoded data');
    });

    it('should have compliance methods', () => {
      expect(typeof base64DecodeTool.getMetadata).toBe('function');
      expect(typeof base64DecodeTool.validate).toBe('function');
      
      const metadata = base64DecodeTool.getMetadata();
      expect(metadata.category).toBe('decoding');
    });

    it('should decode simple base64 correctly', async () => {
      const result = await base64DecodeTool.execute({ data: 'aGVsbG8gd29ybGQ=' });
      
      expect(result.success).toBe(true);
      expect(result.result).toBe('hello world');
      expect(result.originalLength).toBe(16);
      expect(result.decodedLength).toBe(11);
    });

    it('should decode empty base64 correctly', async () => {
      const result = await base64DecodeTool.execute({ data: '' });
      
      expect(result.success).toBe(true);
      expect(result.result).toBe('');
      expect(result.originalLength).toBe(0);
      expect(result.decodedLength).toBe(0);
    });

    it('should decode unicode base64 correctly', async () => {
      const result = await base64DecodeTool.execute({ data: 'SGVsbG8g5LiW55WMIQ==' });
      
      expect(result.success).toBe(true);
      expect(result.result).toBe('Hello 世界!');
    });

    it('should handle different output encodings', async () => {
      const result = await base64DecodeTool.execute({ 
        data: 'aGVsbG8=', 
        outputEncoding: 'ascii' 
      });
      
      expect(result.success).toBe(true);
      expect(result.result).toBe('hello');
    });

    it('should handle missing data parameter', async () => {
      const result = await base64DecodeTool.execute({});
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Data is required for decoding');
    });

    it('should handle invalid base64 data gracefully', async () => {
      // Node.js Buffer.from is very forgiving with base64, so this will succeed
      // but the result might not be what was intended
      const result = await base64DecodeTool.execute({ data: 'invalid!!!base64' });
      
      expect(result.success).toBe(true);
      expect(result.result).toBeDefined();
      // The decoded result will be something, but not meaningful
    });

    it('should roundtrip encode/decode correctly', async () => {
      const originalText = 'Test roundtrip encoding/decoding with special chars: !@#$%^&*()';
      
      // Encode first
      const tools = encodeModule.getTools();
      const encodeTool = tools.find(t => t.name === 'base64_encode');
      const encodeResult = await encodeTool.execute({ data: originalText });
      
      // Then decode
      const decodeResult = await base64DecodeTool.execute({ data: encodeResult.result });
      
      expect(decodeResult.success).toBe(true);
      expect(decodeResult.result).toBe(originalText);
    });
  });

  describe('URL Encoding Tool', () => {
    let urlEncodeTool;

    beforeEach(() => {
      const tools = encodeModule.getTools();
      urlEncodeTool = tools.find(t => t.name === 'url_encode');
    });

    it('should have correct tool metadata', () => {
      expect(urlEncodeTool.name).toBe('url_encode');
      expect(urlEncodeTool.description).toBe('URL encode a string');
    });

    it('should have compliance methods', () => {
      expect(typeof urlEncodeTool.getMetadata).toBe('function');
      expect(typeof urlEncodeTool.validate).toBe('function');
      
      const metadata = urlEncodeTool.getMetadata();
      expect(metadata.tags).toContain('url');
    });

    it('should encode simple URL correctly', async () => {
      const result = await urlEncodeTool.execute({ data: 'hello world' });
      
      expect(result.success).toBe(true);
      expect(result.result).toBe('hello%20world');
      expect(result.originalLength).toBe(11);
      expect(result.encodedLength).toBe(13);
    });

    it('should encode special URL characters correctly', async () => {
      const result = await urlEncodeTool.execute({ data: 'key=value&param=test' });
      
      expect(result.success).toBe(true);
      expect(result.result).toBe('key%3Dvalue%26param%3Dtest');
    });

    it('should encode unicode characters correctly', async () => {
      const result = await urlEncodeTool.execute({ data: 'Hello 世界!' });
      
      expect(result.success).toBe(true);
      expect(result.result).toBe('Hello%20%E4%B8%96%E7%95%8C!');
    });

    it('should encode empty string correctly', async () => {
      const result = await urlEncodeTool.execute({ data: '' });
      
      expect(result.success).toBe(true);
      expect(result.result).toBe('');
      expect(result.originalLength).toBe(0);
      expect(result.encodedLength).toBe(0);
    });

    it('should handle missing data parameter', async () => {
      const result = await urlEncodeTool.execute({});
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Data is required for encoding');
    });

    it('should encode complex query string', async () => {
      const queryString = 'search=hello world&category=test & demo&lang=en';
      const result = await urlEncodeTool.execute({ data: queryString });
      
      expect(result.success).toBe(true);
      expect(result.result).toBe('search%3Dhello%20world%26category%3Dtest%20%26%20demo%26lang%3Den');
    });
  });

  describe('URL Decoding Tool', () => {
    let urlDecodeTool;

    beforeEach(() => {
      const tools = encodeModule.getTools();
      urlDecodeTool = tools.find(t => t.name === 'url_decode');
    });

    it('should have correct tool metadata', () => {
      expect(urlDecodeTool.name).toBe('url_decode');
      expect(urlDecodeTool.description).toBe('URL decode a string');
    });

    it('should have compliance methods', () => {
      expect(typeof urlDecodeTool.getMetadata).toBe('function');
      expect(typeof urlDecodeTool.validate).toBe('function');
      
      const metadata = urlDecodeTool.getMetadata();
      expect(metadata.tags).toContain('url');
    });

    it('should decode simple URL correctly', async () => {
      const result = await urlDecodeTool.execute({ data: 'hello%20world' });
      
      expect(result.success).toBe(true);
      expect(result.result).toBe('hello world');
      expect(result.originalLength).toBe(13);
      expect(result.decodedLength).toBe(11);
    });

    it('should decode special URL characters correctly', async () => {
      const result = await urlDecodeTool.execute({ data: 'key%3Dvalue%26param%3Dtest' });
      
      expect(result.success).toBe(true);
      expect(result.result).toBe('key=value&param=test');
    });

    it('should decode unicode characters correctly', async () => {
      const result = await urlDecodeTool.execute({ data: 'Hello%20%E4%B8%96%E7%95%8C!' });
      
      expect(result.success).toBe(true);
      expect(result.result).toBe('Hello 世界!');
    });

    it('should decode empty string correctly', async () => {
      const result = await urlDecodeTool.execute({ data: '' });
      
      expect(result.success).toBe(true);
      expect(result.result).toBe('');
      expect(result.originalLength).toBe(0);
      expect(result.decodedLength).toBe(0);
    });

    it('should handle missing data parameter', async () => {
      const result = await urlDecodeTool.execute({});
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Data is required for decoding');
    });

    it('should handle malformed URL encoded data gracefully', async () => {
      const result = await urlDecodeTool.execute({ data: 'hello%2' }); // Incomplete encoding
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should roundtrip URL encode/decode correctly', async () => {
      const originalText = 'Test URL encoding: spaces & symbols = 100% working!';
      
      // Encode first
      const tools = encodeModule.getTools();
      const encodeTool = tools.find(t => t.name === 'url_encode');
      const encodeResult = await encodeTool.execute({ data: originalText });
      
      // Then decode
      const decodeResult = await urlDecodeTool.execute({ data: encodeResult.result });
      
      expect(decodeResult.success).toBe(true);
      expect(decodeResult.result).toBe(originalText);
    });
  });

  describe('Integration Tests', () => {
    it('should work end-to-end through module interface', async () => {
      const tools = encodeModule.getTools();
      expect(tools).toHaveLength(4);
      
      // Test each tool is accessible
      const base64Encode = tools.find(t => t.name === 'base64_encode');
      const base64Decode = tools.find(t => t.name === 'base64_decode');
      const urlEncode = tools.find(t => t.name === 'url_encode');
      const urlDecode = tools.find(t => t.name === 'url_decode');
      
      expect(base64Encode).toBeDefined();
      expect(base64Decode).toBeDefined();
      expect(urlEncode).toBeDefined();
      expect(urlDecode).toBeDefined();
    });

    it('should handle multiple concurrent operations', async () => {
      const tools = encodeModule.getTools();
      const base64Encode = tools.find(t => t.name === 'base64_encode');
      const urlEncode = tools.find(t => t.name === 'url_encode');
      
      const results = await Promise.all([
        base64Encode.execute({ data: 'test1' }),
        base64Encode.execute({ data: 'test2' }),
        urlEncode.execute({ data: 'hello world' }),
        urlEncode.execute({ data: 'foo & bar' })
      ]);
      
      expect(results).toHaveLength(4);
      results.forEach(result => {
        expect(result.success).toBe(true);
      });
    });

    it('should maintain tool state correctly across operations', async () => {
      const tools = encodeModule.getTools();
      const base64Encode = tools.find(t => t.name === 'base64_encode');
      
      // First operation
      const result1 = await base64Encode.execute({ data: 'first' });
      expect(result1.success).toBe(true);
      
      // Second operation should be independent
      const result2 = await base64Encode.execute({ data: 'second' });
      expect(result2.success).toBe(true);
      
      // Tool should maintain proper structure
      expect(base64Encode.name).toBe('base64_encode');
      expect(base64Encode.description).toBe('Encode data to base64 format');
    });
  });

  describe('Performance Tests', () => {
    it('should handle large data encoding efficiently', async () => {
      const tools = encodeModule.getTools();
      const base64Encode = tools.find(t => t.name === 'base64_encode');
      
      const largeData = 'x'.repeat(50000);
      
      const startTime = Date.now();
      const result = await base64Encode.execute({ data: largeData });
      const endTime = Date.now();
      
      expect(result.success).toBe(true);
      expect(result.originalLength).toBe(50000);
      expect(endTime - startTime).toBeLessThan(200); // Should complete in <200ms
    });

    it('should handle large data decoding efficiently', async () => {
      const tools = encodeModule.getTools();
      const base64Encode = tools.find(t => t.name === 'base64_encode');
      const base64Decode = tools.find(t => t.name === 'base64_decode');
      
      const largeData = 'y'.repeat(50000);
      const encoded = await base64Encode.execute({ data: largeData });
      
      const startTime = Date.now();
      const result = await base64Decode.execute({ data: encoded.result });
      const endTime = Date.now();
      
      expect(result.success).toBe(true);
      expect(result.result).toBe(largeData);
      expect(endTime - startTime).toBeLessThan(200); // Should complete in <200ms
    });

    it('should handle URL encoding of complex strings efficiently', async () => {
      const tools = encodeModule.getTools();
      const urlEncode = tools.find(t => t.name === 'url_encode');
      
      const complexString = 'param1=value with spaces&param2=special!@#$%^&*()characters&param3=unicode 世界'.repeat(1000);
      
      const startTime = Date.now();
      const result = await urlEncode.execute({ data: complexString });
      const endTime = Date.now();
      
      expect(result.success).toBe(true);
      expect(endTime - startTime).toBeLessThan(100); // Should complete in <100ms
    });
  });

  describe('Error Handling', () => {
    it('should handle tool execution errors gracefully', async () => {
      const tools = encodeModule.getTools();
      
      // Test each tool with invalid inputs
      for (const tool of tools) {
        const result = await tool.execute({ data: null });
        expect(result.success).toBe(false);
        expect(result.error).toBeDefined();
      }
    });

    it('should maintain consistent error response format', async () => {
      const tools = encodeModule.getTools();
      const base64Encode = tools.find(t => t.name === 'base64_encode');
      
      const result = await base64Encode.execute({});
      
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('error');
      expect(result.success).toBe(false);
      expect(typeof result.error).toBe('string');
    });
  });
});