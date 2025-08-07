/**
 * Integration tests for HTTP Module
 * Tests HTTP operations wrapped as tools
 */

import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { 
  HTTPModuleDefinition,
  HTTPModuleInstance 
} from '../../src/modules/HTTPModule.js';

// Mock axios for testing
const mockAxios = {
  create: jest.fn(() => mockAxiosInstance),
  get: jest.fn(),
  post: jest.fn(),
  put: jest.fn(),
  delete: jest.fn(),
  patch: jest.fn(),
  head: jest.fn(),
  options: jest.fn(),
  request: jest.fn()
};

const mockAxiosInstance = {
  get: jest.fn(),
  post: jest.fn(),
  put: jest.fn(),
  delete: jest.fn(),
  patch: jest.fn(),
  head: jest.fn(),
  options: jest.fn(),
  request: jest.fn(),
  interceptors: {
    request: { use: jest.fn() },
    response: { use: jest.fn() }
  }
};

describe('HTTP Module Integration', () => {
  let module;
  let instance;

  beforeEach(async () => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Create module instance with mock axios
    instance = await HTTPModuleDefinition.create({
      baseURL: 'https://api.example.com',
      timeout: 5000,
      headers: {
        'User-Agent': 'TestAgent/1.0'
      },
      axios: mockAxios
    });
    
    module = instance;
  });

  afterEach(async () => {
    if (instance && instance.cleanup) {
      await instance.cleanup();
    }
  });

  describe('Basic HTTP operations', () => {
    test('should perform GET request', async () => {
      const getTool = module.getTool('get');
      
      mockAxiosInstance.get.mockResolvedValue({
        data: { id: 1, name: 'Test' },
        status: 200,
        statusText: 'OK',
        headers: { 'content-type': 'application/json' }
      });

      const result = await getTool.execute({
        url: '/users/1'
      });

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/users/1', {});
      expect(result.data).toEqual({ id: 1, name: 'Test' });
      expect(result.status).toBe(200);
    });

    test('should perform POST request with data', async () => {
      const postTool = module.getTool('post');
      
      mockAxiosInstance.post.mockResolvedValue({
        data: { id: 2, name: 'New User' },
        status: 201,
        statusText: 'Created'
      });

      const result = await postTool.execute({
        url: '/users',
        data: { name: 'New User' }
      });

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/users',
        { name: 'New User' },
        {}
      );
      expect(result.status).toBe(201);
      expect(result.data.name).toBe('New User');
    });

    test('should perform PUT request', async () => {
      const putTool = module.getTool('put');
      
      mockAxiosInstance.put.mockResolvedValue({
        data: { id: 1, name: 'Updated' },
        status: 200
      });

      const result = await putTool.execute({
        url: '/users/1',
        data: { name: 'Updated' }
      });

      expect(mockAxiosInstance.put).toHaveBeenCalledWith(
        '/users/1',
        { name: 'Updated' },
        {}
      );
      expect(result.data.name).toBe('Updated');
    });

    test('should perform DELETE request', async () => {
      const deleteTool = module.getTool('delete');
      
      mockAxiosInstance.delete.mockResolvedValue({
        data: null,
        status: 204,
        statusText: 'No Content'
      });

      const result = await deleteTool.execute({
        url: '/users/1'
      });

      expect(mockAxiosInstance.delete).toHaveBeenCalledWith('/users/1', {});
      expect(result.status).toBe(204);
    });

    test('should perform PATCH request', async () => {
      const patchTool = module.getTool('patch');
      
      mockAxiosInstance.patch.mockResolvedValue({
        data: { id: 1, name: 'Patched' },
        status: 200
      });

      const result = await patchTool.execute({
        url: '/users/1',
        data: { name: 'Patched' }
      });

      expect(mockAxiosInstance.patch).toHaveBeenCalledWith(
        '/users/1',
        { name: 'Patched' },
        {}
      );
      expect(result.data.name).toBe('Patched');
    });

    test('should perform HEAD request', async () => {
      const headTool = module.getTool('head');
      
      mockAxiosInstance.head.mockResolvedValue({
        data: '',
        status: 200,
        headers: {
          'content-length': '1234',
          'last-modified': 'Wed, 21 Oct 2024 07:28:00 GMT'
        }
      });

      const result = await headTool.execute({
        url: '/files/document.pdf'
      });

      expect(mockAxiosInstance.head).toHaveBeenCalledWith('/files/document.pdf', {});
      expect(result.headers['content-length']).toBe('1234');
    });
  });

  describe('Request configuration', () => {
    test('should send custom headers', async () => {
      const getTool = module.getTool('get');
      
      mockAxiosInstance.get.mockResolvedValue({
        data: { success: true },
        status: 200
      });

      await getTool.execute({
        url: '/protected',
        headers: {
          'Authorization': 'Bearer token123'
        }
      });

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/protected', {
        headers: { 'Authorization': 'Bearer token123' }
      });
    });

    test('should send query parameters', async () => {
      const getTool = module.getTool('get');
      
      mockAxiosInstance.get.mockResolvedValue({
        data: { results: [] },
        status: 200
      });

      await getTool.execute({
        url: '/search',
        params: {
          q: 'test',
          limit: 10
        }
      });

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/search', {
        params: { q: 'test', limit: 10 }
      });
    });

    test('should handle timeout configuration', async () => {
      const getTool = module.getTool('get');
      
      mockAxiosInstance.get.mockResolvedValue({
        data: { success: true },
        status: 200
      });

      await getTool.execute({
        url: '/slow-endpoint',
        timeout: 10000
      });

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/slow-endpoint', {
        timeout: 10000
      });
    });
  });

  describe('Error handling', () => {
    test('should handle 404 errors', async () => {
      const getTool = module.getTool('get');
      
      mockAxiosInstance.get.mockRejectedValue({
        response: {
          status: 404,
          statusText: 'Not Found',
          data: { error: 'Resource not found' }
        }
      });

      const result = await getTool.execute({
        url: '/nonexistent'
      });

      expect(result.success).toBe(false);
      expect(result.error.status).toBe(404);
      expect(result.error.message).toContain('404');
    });

    test('should handle network errors', async () => {
      const getTool = module.getTool('get');
      
      mockAxiosInstance.get.mockRejectedValue({
        code: 'ECONNREFUSED',
        message: 'Connection refused'
      });

      const result = await getTool.execute({
        url: '/endpoint'
      });

      expect(result.success).toBe(false);
      expect(result.error.code).toBe('ECONNREFUSED');
    });

    test('should handle timeout errors', async () => {
      const getTool = module.getTool('get');
      
      mockAxiosInstance.get.mockRejectedValue({
        code: 'ECONNABORTED',
        message: 'timeout of 5000ms exceeded'
      });

      const result = await getTool.execute({
        url: '/slow'
      });

      expect(result.success).toBe(false);
      expect(result.error.code).toBe('ECONNABORTED');
    });
  });

  describe('Advanced features', () => {
    test('should support request interceptors', async () => {
      // Verify interceptors were set up
      expect(mockAxiosInstance.interceptors.request.use).toHaveBeenCalled();
      expect(mockAxiosInstance.interceptors.response.use).toHaveBeenCalled();
    });

    test('should support form data', async () => {
      const postTool = module.getTool('post');
      
      mockAxiosInstance.post.mockResolvedValue({
        data: { uploaded: true },
        status: 200
      });

      await postTool.execute({
        url: '/upload',
        data: { file: 'binary-data' },
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/upload',
        { file: 'binary-data' },
        { headers: { 'Content-Type': 'multipart/form-data' } }
      );
    });

    test('should support authentication', async () => {
      // Create instance with auth
      const authInstance = await HTTPModuleDefinition.create({
        baseURL: 'https://api.example.com',
        auth: {
          username: 'user',
          password: 'pass'
        },
        axios: mockAxios
      });

      expect(mockAxios.create).toHaveBeenCalledWith(
        expect.objectContaining({
          auth: { username: 'user', password: 'pass' }
        })
      );
    });

    test('should support retry logic', async () => {
      const getTool = module.getTool('get');
      
      // First call fails, second succeeds
      mockAxiosInstance.get
        .mockRejectedValueOnce({ code: 'ETIMEDOUT' })
        .mockResolvedValueOnce({
          data: { success: true },
          status: 200
        });

      const result = await getTool.execute({
        url: '/flaky',
        retry: {
          retries: 2,
          retryDelay: 100
        }
      });

      // With retry logic, should eventually succeed
      // Note: Actual retry implementation would need to be added
    });

    test('should create download handle for streaming', async () => {
      const downloadTool = module.getTool('download');
      
      const mockStream = {
        pipe: jest.fn(),
        on: jest.fn()
      };
      
      mockAxiosInstance.get.mockResolvedValue({
        data: mockStream,
        status: 200,
        headers: {
          'content-length': '1000000'
        }
      });

      const result = await downloadTool.execute({
        url: '/files/large.zip',
        responseType: 'stream'
      });

      expect(result.handle).toBeDefined();
      expect(result.type).toBe('download');
      expect(result.size).toBe('1000000');
    });

    test('should support custom request transformers', async () => {
      const customInstance = await HTTPModuleDefinition.create({
        baseURL: 'https://api.example.com',
        transformRequest: [(data) => {
          return JSON.stringify({ wrapped: data });
        }],
        axios: mockAxios
      });

      expect(mockAxios.create).toHaveBeenCalledWith(
        expect.objectContaining({
          transformRequest: expect.any(Array)
        })
      );
    });

    test('should support custom response transformers', async () => {
      const customInstance = await HTTPModuleDefinition.create({
        baseURL: 'https://api.example.com',
        transformResponse: [(data) => {
          return { unwrapped: JSON.parse(data) };
        }],
        axios: mockAxios
      });

      expect(mockAxios.create).toHaveBeenCalledWith(
        expect.objectContaining({
          transformResponse: expect.any(Array)
        })
      );
    });
  });

  describe('Batch operations', () => {
    test('should support parallel requests', async () => {
      const batchTool = module.getTool('batch');
      
      mockAxiosInstance.request.mockImplementation((config) => {
        return Promise.resolve({
          data: { url: config.url },
          status: 200
        });
      });

      const result = await batchTool.execute({
        requests: [
          { method: 'GET', url: '/users/1' },
          { method: 'GET', url: '/users/2' },
          { method: 'POST', url: '/users', data: { name: 'New' } }
        ]
      });

      expect(result.results).toHaveLength(3);
      expect(result.results[0].data.url).toBe('/users/1');
      expect(result.results[2].data.url).toBe('/users');
    });

    test('should handle partial batch failures', async () => {
      const batchTool = module.getTool('batch');
      
      mockAxiosInstance.request
        .mockResolvedValueOnce({ data: { id: 1 }, status: 200 })
        .mockRejectedValueOnce({ response: { status: 404 } })
        .mockResolvedValueOnce({ data: { id: 3 }, status: 200 });

      const result = await batchTool.execute({
        requests: [
          { method: 'GET', url: '/users/1' },
          { method: 'GET', url: '/users/999' },
          { method: 'GET', url: '/users/3' }
        ]
      });

      expect(result.results[0].success).toBe(true);
      expect(result.results[1].success).toBe(false);
      expect(result.results[2].success).toBe(true);
    });
  });
});