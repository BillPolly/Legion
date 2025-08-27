/**
 * NOTE: Validation has been removed from this tool.
 * All validation now happens at the invocation layer.
 * Tools only define schemas as plain JSON Schema objects.
 */

/**
 * EncodeModule - Module wrapper for encoding/decoding tools
 */

import { Module, Tool } from '@legion/tools-registry';

// Input schema for Base64EncodeTool
const base64EncodeToolInputSchema = {
  type: 'object',
  properties: {
    data: {
      type: 'string',
      description: 'The data to encode'
    },
    inputEncoding: {
      type: 'string',
      default: 'utf8',
      description: 'Input encoding (default: utf8)'
    }
  },
  required: ['data']
};

// Output schema for Base64EncodeTool
const base64EncodeToolOutputSchema = {
  type: 'object',
  properties: {
    encoded: {
      type: 'string',
      description: 'Base64 encoded data'
    },
    success: {
      type: 'boolean',
      description: 'Whether encoding was successful'
    },
    error: {
      type: 'string',
      description: 'Error message if encoding failed'
    }
  },
  required: ['success']
};

/**
 * Base64 encoding tool
 */
class Base64EncodeTool extends Tool {
  constructor() {
    super({
      name: 'base64_encode',
      description: 'Encode data to base64 format',
      schema: {
        input: base64EncodeToolInputSchema,
        output: base64EncodeToolOutputSchema
      }
    });
  }

  getMetadata() {
    return {
      name: this.name,
      description: this.description,
      inputSchema: this.inputSchema,
      outputSchema: this.outputSchema,
      version: '1.0.0',
      category: 'encoding',
      tags: ['base64', 'encoding', 'string'],
      security: { evaluation: 'safe' }
    };
  }

  validate(params) {
    const errors = [];
    const warnings = [];
    
    if (!params || typeof params !== 'object') {
      errors.push('Parameters must be an object');
      return { valid: false, errors, warnings };
    }
    
    if (params.data === undefined || params.data === null) {
      errors.push('Data is required for encoding');
    }
    
    if (params.inputEncoding && typeof params.inputEncoding !== 'string') {
      errors.push('Input encoding must be a string');
    }
    
    return { valid: errors.length === 0, errors, warnings };
  }

  async execute(params) {
    try {
      const { data, inputEncoding = 'utf8' } = params;
      
      if (data === undefined || data === null) {
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

// Input schema for Base64DecodeTool
const base64DecodeToolInputSchema = {
  type: 'object',
  properties: {
    data: {
      type: 'string',
      description: 'The base64 encoded data to decode'
    },
    outputEncoding: {
      type: 'string',
      default: 'utf8',
      description: 'Output encoding (default: utf8)'
    }
  },
  required: ['data']
};

// Output schema for Base64DecodeTool
const base64DecodeToolOutputSchema = {
  type: 'object',
  properties: {
    decoded: {
      type: 'string',
      description: 'Base64 decoded data'
    },
    success: {
      type: 'boolean',
      description: 'Whether decoding was successful'
    },
    error: {
      type: 'string',
      description: 'Error message if decoding failed'
    }
  },
  required: ['success']
};

/**
 * Base64 decoding tool
 */
class Base64DecodeTool extends Tool {
  constructor() {
    super({
      name: 'base64_decode',
      description: 'Decode base64 encoded data',
      schema: {
        input: base64DecodeToolInputSchema,
        output: base64DecodeToolOutputSchema
      }
    });
  }

  getMetadata() {
    return {
      name: this.name,
      description: this.description,
      inputSchema: this.inputSchema,
      outputSchema: this.outputSchema,
      version: '1.0.0',
      category: 'decoding',
      tags: ['base64', 'decoding', 'string'],
      security: { evaluation: 'safe' }
    };
  }

  validate(params) {
    const errors = [];
    const warnings = [];
    
    if (!params || typeof params !== 'object') {
      errors.push('Parameters must be an object');
      return { valid: false, errors, warnings };
    }
    
    if (params.data === undefined || params.data === null) {
      errors.push('Data is required for decoding');
    }
    
    if (params.outputEncoding && typeof params.outputEncoding !== 'string') {
      errors.push('Output encoding must be a string');
    }
    
    return { valid: errors.length === 0, errors, warnings };
  }

  async execute(params) {
    try {
      const { data, outputEncoding = 'utf8' } = params;
      
      if (data === undefined || data === null) {
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

// Input schema for UrlEncodeTool
const urlEncodeToolInputSchema = {
  type: 'object',
  properties: {
    data: {
      type: 'string',
      description: 'The string to URL encode'
    }
  },
  required: ['data']
};

// Output schema for UrlEncodeTool
const urlEncodeToolOutputSchema = {
  type: 'object',
  properties: {
    encoded: {
      type: 'string',
      description: 'URL encoded data'
    },
    success: {
      type: 'boolean',
      description: 'Whether encoding was successful'
    },
    originalLength: {
      type: 'number',
      description: 'Length of original data'
    },
    encodedLength: {
      type: 'number',
      description: 'Length of encoded data'
    },
    error: {
      type: 'string',
      description: 'Error message if encoding failed'
    }
  },
  required: ['success']
};

/**
 * URL encoding tool
 */
class UrlEncodeTool extends Tool {
  constructor() {
    super({
      name: 'url_encode',
      description: 'URL encode a string',
      schema: {
        input: urlEncodeToolInputSchema,
        output: urlEncodeToolOutputSchema
      }
    });
  }

  getMetadata() {
    return {
      name: this.name,
      description: this.description,
      inputSchema: this.inputSchema,
      outputSchema: this.outputSchema,
      version: '1.0.0',
      category: 'encoding',
      tags: ['url', 'encoding', 'string'],
      security: { evaluation: 'safe' }
    };
  }

  validate(params) {
    const errors = [];
    const warnings = [];
    
    if (!params || typeof params !== 'object') {
      errors.push('Parameters must be an object');
      return { valid: false, errors, warnings };
    }
    
    if (params.data === undefined || params.data === null) {
      errors.push('Data is required for encoding');
    }
    
    if (params.data !== undefined && typeof params.data !== 'string') {
      errors.push('Data must be a string');
    }
    
    return { valid: errors.length === 0, errors, warnings };
  }

  async execute(params) {
    try {
      const { data } = params;
      
      if (data === undefined || data === null) {
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

// Input schema for UrlDecodeTool
const urlDecodeToolInputSchema = {
  type: 'object',
  properties: {
    data: {
      type: 'string',
      description: 'The URL encoded string to decode'
    }
  },
  required: ['data']
};

// Output schema for UrlDecodeTool
const urlDecodeToolOutputSchema = {
  type: 'object',
  properties: {
    decoded: {
      type: 'string',
      description: 'URL decoded data'
    },
    success: {
      type: 'boolean',
      description: 'Whether decoding was successful'
    },
    originalLength: {
      type: 'number',
      description: 'Length of original encoded data'
    },
    decodedLength: {
      type: 'number',
      description: 'Length of decoded data'
    },
    error: {
      type: 'string',
      description: 'Error message if decoding failed'
    }
  },
  required: ['success']
};

/**
 * URL decoding tool
 */
class UrlDecodeTool extends Tool {
  constructor() {
    super({
      name: 'url_decode',
      description: 'URL decode a string',
      schema: {
        input: urlDecodeToolInputSchema,
        output: urlDecodeToolOutputSchema
      }
    });
  }

  getMetadata() {
    return {
      name: this.name,
      description: this.description,
      inputSchema: this.inputSchema,
      outputSchema: this.outputSchema,
      version: '1.0.0',
      category: 'decoding',
      tags: ['url', 'decoding', 'string'],
      security: { evaluation: 'safe' }
    };
  }

  validate(params) {
    const errors = [];
    const warnings = [];
    
    if (!params || typeof params !== 'object') {
      errors.push('Parameters must be an object');
      return { valid: false, errors, warnings };
    }
    
    if (params.data === undefined || params.data === null) {
      errors.push('Data is required for decoding');
    }
    
    if (params.data !== undefined && typeof params.data !== 'string') {
      errors.push('Data must be a string');
    }
    
    return { valid: errors.length === 0, errors, warnings };
  }

  async execute(params) {
    try {
      const { data } = params;
      
      if (data === undefined || data === null) {
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
  constructor() {
    super();
    this.name = 'encode';
    this.description = 'Encoding and decoding utilities for various formats';
    this.version = '1.0.0';
  }

  /**
   * Static async factory method following the standard interface
   */
  static async create(resourceManager) {
    const module = new EncodeModule();
    module.resourceManager = resourceManager;
    await module.initialize();
    return module;
  }

  /**
   * Initialize the module
   */
  async initialize() {
    await super.initialize();
    
    // Register tools
    this.registerTool('base64_encode', new Base64EncodeTool());
    this.registerTool('base64_decode', new Base64DecodeTool());
    this.registerTool('url_encode', new UrlEncodeTool());
    this.registerTool('url_decode', new UrlDecodeTool());
  }
}


export { default as EncodeTool } from './index.js';
