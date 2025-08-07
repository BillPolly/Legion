/**
 * HTTP Module
 * Provides HTTP operations as tools
 */

import axios from 'axios';
import { ModuleDefinition } from './ModuleDefinition.js';
import { ModuleInstance } from './ModuleInstance.js';
import { Tool } from './Tool.js';
import { generateHandle } from '../utils/HandleManager.js';

/**
 * HTTPModuleDefinition
 */
export class HTTPModuleDefinition extends ModuleDefinition {
  static async create(config) {
    // Use provided axios or default
    const axiosLib = config.axios || axios;
    
    // Create axios instance with configuration
    const axiosConfig = {
      baseURL: config.baseURL,
      timeout: config.timeout || 30000,
      headers: config.headers || {},
      ...config
    };

    // Remove our custom config from axios config
    delete axiosConfig.axios;
    delete axiosConfig.retry;

    const axiosInstance = axiosLib.create(axiosConfig);

    // Create module instance
    const instance = new HTTPModuleInstance(this, config, axiosInstance);
    await instance.initialize();
    
    return instance;
  }

  static getMetadata() {
    return {
      name: 'HTTPModule',
      description: 'HTTP operations module',
      version: '1.0.0',
      tools: {
        get: {
          description: 'Perform GET request',
          input: { url: 'string', params: 'object?', headers: 'object?' },
          output: { body: 'any', status: 'number', statusText: 'string', headers: 'object' }
        },
        post: {
          description: 'Perform POST request',
          input: { url: 'string', data: 'any', headers: 'object?' },
          output: { body: 'any', status: 'number', statusText: 'string', headers: 'object' }
        },
        put: {
          description: 'Perform PUT request',
          input: { url: 'string', data: 'any', headers: 'object?' },
          output: { body: 'any', status: 'number', statusText: 'string', headers: 'object' }
        },
        delete: {
          description: 'Perform DELETE request',
          input: { url: 'string', headers: 'object?' },
          output: { body: 'any', status: 'number', statusText: 'string', headers: 'object' }
        },
        patch: {
          description: 'Perform PATCH request',
          input: { url: 'string', data: 'any', headers: 'object?' },
          output: { body: 'any', status: 'number', statusText: 'string', headers: 'object' }
        },
        head: {
          description: 'Perform HEAD request',
          input: { url: 'string', headers: 'object?' },
          output: { headers: 'object', status: 'number', statusText: 'string' }
        },
        options: {
          description: 'Perform OPTIONS request',
          input: { url: 'string', headers: 'object?' },
          output: { headers: 'object', status: 'number', statusText: 'string', body: 'any' }
        },
        download: {
          description: 'Download file with streaming',
          input: { url: 'string', responseType: 'string?' },
          output: { handle: 'string', type: 'string', size: 'string?', contentType: 'string?' }
        },
        batch: {
          description: 'Perform multiple requests in parallel',
          input: { requests: 'Array<{method: string, url: string, data?: any}>' },
          output: { results: 'Array<{success: boolean, data: any}>', summary: 'object' }
        }
      }
    };
  }
}

/**
 * HTTPModuleInstance
 */
export class HTTPModuleInstance extends ModuleInstance {
  constructor(moduleDefinition, config, axiosInstance) {
    super(moduleDefinition, config);
    this.axios = axiosInstance;
    this.downloads = new Map();
  }

  async initialize() {
    // Set up interceptors
    this.setupInterceptors();
    
    // Create tools
    this.createTools();
  }

  setupInterceptors() {
    // Request interceptor
    this.axios.interceptors.request.use(
      (config) => {
        // Could add logging, auth tokens, etc.
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // Response interceptor
    this.axios.interceptors.response.use(
      (response) => {
        // Could add response transformation
        return response;
      },
      (error) => {
        // Could add retry logic here
        return Promise.reject(error);
      }
    );
  }

  /**
   * Prepare request configuration
   */
  prepareConfig(input) {
    const config = {};
    
    if (input.headers) config.headers = input.headers;
    if (input.params) config.params = input.params;
    if (input.timeout) config.timeout = input.timeout;
    if (input.responseType) config.responseType = input.responseType;
    if (input.auth) config.auth = input.auth;
    
    return config;
  }

  /**
   * Format response
   */
  formatResponse(response) {
    return {
      success: true,
      data: {
        body: response.data,
        status: response.status,
        statusText: response.statusText,
        headers: response.headers
      }
    };
  }

  /**
   * Format error response
   */
  formatError(error) {
    if (error.response) {
      // Server responded with error status
      return {
        success: false,
        data: {
          errorMessage: `Request failed with status ${error.response.status}`,
          code: `HTTP_${error.response.status}`,
          status: error.response.status,
          statusText: error.response.statusText,
          responseData: error.response.data,
          stackTrace: error.stack
        }
      };
    } else if (error.request) {
      // Request made but no response
      return {
        success: false,
        data: {
          errorMessage: error.message || 'No response received',
          code: error.code || 'NO_RESPONSE',
          stackTrace: error.stack
        }
      };
    } else {
      // Request setup error
      return {
        success: false,
        data: {
          errorMessage: error.message || 'Request failed',
          code: error.code || 'REQUEST_ERROR',
          stackTrace: error.stack
        }
      };
    }
  }

  /**
   * Execute request with retry logic
   */
  async executeWithRetry(fn, retryConfig) {
    const maxRetries = retryConfig?.retries || 0;
    const retryDelay = retryConfig?.retryDelay || 1000;
    
    let lastError;
    for (let i = 0; i <= maxRetries; i++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;
        if (i < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, retryDelay));
        }
      }
    }
    
    throw lastError;
  }

  createTools() {
    // GET request
    this.tools.get = new Tool({
      name: 'get',
      execute: async (input) => {
        try {
          const config = this.prepareConfig(input);
          const fn = () => this.axios.get(input.url, config);
          const response = await this.executeWithRetry(fn, input.retry);
          return this.formatResponse(response);
        } catch (error) {
          return this.formatError(error);
        }
      },
      getMetadata: () => HTTPModuleDefinition.getMetadata().tools.get
    });

    // POST request
    this.tools.post = new Tool({
      name: 'post',
      execute: async (input) => {
        try {
          const config = this.prepareConfig(input);
          const fn = () => this.axios.post(input.url, input.data, config);
          const response = await this.executeWithRetry(fn, input.retry);
          return this.formatResponse(response);
        } catch (error) {
          return this.formatError(error);
        }
      },
      getMetadata: () => HTTPModuleDefinition.getMetadata().tools.post
    });

    // PUT request
    this.tools.put = new Tool({
      name: 'put',
      execute: async (input) => {
        try {
          const config = this.prepareConfig(input);
          const fn = () => this.axios.put(input.url, input.data, config);
          const response = await this.executeWithRetry(fn, input.retry);
          return this.formatResponse(response);
        } catch (error) {
          return this.formatError(error);
        }
      },
      getMetadata: () => HTTPModuleDefinition.getMetadata().tools.put
    });

    // DELETE request
    this.tools.delete = new Tool({
      name: 'delete',
      execute: async (input) => {
        try {
          const config = this.prepareConfig(input);
          const fn = () => this.axios.delete(input.url, config);
          const response = await this.executeWithRetry(fn, input.retry);
          return this.formatResponse(response);
        } catch (error) {
          return this.formatError(error);
        }
      },
      getMetadata: () => HTTPModuleDefinition.getMetadata().tools.delete
    });

    // PATCH request
    this.tools.patch = new Tool({
      name: 'patch',
      execute: async (input) => {
        try {
          const config = this.prepareConfig(input);
          const fn = () => this.axios.patch(input.url, input.data, config);
          const response = await this.executeWithRetry(fn, input.retry);
          return this.formatResponse(response);
        } catch (error) {
          return this.formatError(error);
        }
      },
      getMetadata: () => HTTPModuleDefinition.getMetadata().tools.patch
    });

    // HEAD request
    this.tools.head = new Tool({
      name: 'head',
      execute: async (input) => {
        try {
          const config = this.prepareConfig(input);
          const fn = () => this.axios.head(input.url, config);
          const response = await this.executeWithRetry(fn, input.retry);
          return {
            headers: response.headers,
            status: response.status,
            statusText: response.statusText
          };
        } catch (error) {
          return this.formatError(error);
        }
      },
      getMetadata: () => HTTPModuleDefinition.getMetadata().tools.head
    });

    // OPTIONS request
    this.tools.options = new Tool({
      name: 'options',
      execute: async (input) => {
        try {
          const config = this.prepareConfig(input);
          const fn = () => this.axios.options(input.url, config);
          const response = await this.executeWithRetry(fn, input.retry);
          return {
            headers: response.headers,
            status: response.status,
            statusText: response.statusText,
            data: response.data
          };
        } catch (error) {
          return this.formatError(error);
        }
      },
      getMetadata: () => HTTPModuleDefinition.getMetadata().tools.options
    });

    // Download with streaming
    this.tools.download = new Tool({
      name: 'download',
      execute: async (input) => {
        try {
          const config = this.prepareConfig(input);
          config.responseType = input.responseType || 'stream';
          
          const response = await this.axios.get(input.url, config);
          
          // Create handle for the download stream
          const handle = generateHandle('download', {
            url: input.url,
            stream: response.data
          });
          
          this.downloads.set(handle._id, response.data);
          
          return {
            handle: handle._id,
            type: 'download',
            size: response.headers['content-length'],
            contentType: response.headers['content-type']
          };
        } catch (error) {
          return this.formatError(error);
        }
      },
      getMetadata: () => HTTPModuleDefinition.getMetadata().tools.download
    });

    // Batch requests
    this.tools.batch = new Tool({
      name: 'batch',
      execute: async (input) => {
        try {
          const requests = input.requests || [];
          
          // Execute all requests in parallel
          const promises = requests.map(async (req) => {
            try {
              const config = {
                method: req.method,
                url: req.url,
                data: req.data,
                headers: req.headers,
                params: req.params
              };
              
              const response = await this.axios.request(config);
              return {
                success: true,
                data: {
                  body: response.data,
                  status: response.status
                }
              };
            } catch (error) {
              return {
                success: false,
                data: this.formatError(error).data
              };
            }
          });
          
          const results = await Promise.all(promises);
          
          return {
            success: true,
            data: {
              results,
              summary: {
                total: results.length,
                successful: results.filter(r => r.success).length,
                failed: results.filter(r => !r.success).length
              }
            }
          };
        } catch (error) {
          return this.formatError(error);
        }
      },
      getMetadata: () => HTTPModuleDefinition.getMetadata().tools.batch
    });
  }

  async cleanup() {
    // Clean up any open streams
    for (const [id, stream] of this.downloads) {
      if (stream && typeof stream.destroy === 'function') {
        stream.destroy();
      }
    }
    this.downloads.clear();
  }
}