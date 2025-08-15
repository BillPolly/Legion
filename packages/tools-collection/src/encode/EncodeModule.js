/**
 * EncodeModule - Module wrapper for encoding/decoding tools
 */

import { Module, Tool } from '@legion/tools-registry';
import { z } from 'zod';

/**
 * Base64 encoding tool
 */
class Base64EncodeTool extends Tool {
  constructor() {
    super({
      name: 'base64_encode',
      description: 'Encode data to base64 format',
      inputSchema: z.object({
        data: z.string().describe('The data to encode'),
        inputEncoding: z.string().optional().default('utf8').describe('Input encoding (default: utf8)')
      })
    });
  }

  async execute(params) {
    try {
      const { data, inputEncoding = 'utf8' } = params;
      
      if (!data) {
        return {
          success: false,
          error: 'Data is required for encoding'
        };
      }
      
      const buffer = Buffer.from(data, inputEncoding);
      const encoded = buffer.toString('base64');
      
      return {
        success: true,
        result: encoded,
        originalLength: data.length,
        encodedLength: encoded.length
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
}

/**
 * Base64 decoding tool
 */
class Base64DecodeTool extends Tool {
  constructor() {
    super({
      name: 'base64_decode',
      description: 'Decode base64 encoded data',
      inputSchema: z.object({
        data: z.string().describe('The base64 encoded data to decode'),
        outputEncoding: z.string().optional().default('utf8').describe('Output encoding (default: utf8)')
      })
    });
  }

  async execute(params) {
    try {
      const { data, outputEncoding = 'utf8' } = params;
      
      if (!data) {
        return {
          success: false,
          error: 'Data is required for decoding'
        };
      }
      
      const buffer = Buffer.from(data, 'base64');
      const decoded = buffer.toString(outputEncoding);
      
      return {
        success: true,
        result: decoded,
        originalLength: data.length,
        decodedLength: decoded.length
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
}

/**
 * URL encoding tool
 */
class UrlEncodeTool extends Tool {
  constructor() {
    super({
      name: 'url_encode',
      description: 'URL encode a string',
      inputSchema: z.object({
        data: z.string().describe('The string to URL encode')
      })
    });
  }

  async execute(params) {
    try {
      const { data } = params;
      
      if (!data) {
        return {
          success: false,
          error: 'Data is required for encoding'
        };
      }
      
      const encoded = encodeURIComponent(data);
      
      return {
        success: true,
        result: encoded,
        originalLength: data.length,
        encodedLength: encoded.length
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
}

/**
 * URL decoding tool
 */
class UrlDecodeTool extends Tool {
  constructor() {
    super({
      name: 'url_decode',
      description: 'URL decode a string',
      inputSchema: z.object({
        data: z.string().describe('The URL encoded string to decode')
      })
    });
  }

  async execute(params) {
    try {
      const { data } = params;
      
      if (!data) {
        return {
          success: false,
          error: 'Data is required for decoding'
        };
      }
      
      const decoded = decodeURIComponent(data);
      
      return {
        success: true,
        result: decoded,
        originalLength: data.length,
        decodedLength: decoded.length
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
}

/**
 * EncodeModule - Provides encoding and decoding tools
 */
export default class EncodeModule extends Module {
  constructor(dependencies = {}) {
    super('EncodeModule', dependencies);
    this.name = 'EncodeModule';
    this.description = 'Encoding and decoding utilities for various formats';
    
    // Register tools
    this.registerTool('base64_encode', new Base64EncodeTool());
    this.registerTool('base64_decode', new Base64DecodeTool());
    this.registerTool('url_encode', new UrlEncodeTool());
    this.registerTool('url_decode', new UrlDecodeTool());
  }
}

// Also export the original tool for backward compatibility if needed
export { default as EncodeTool } from './index.js';