/**
 * @jest-environment node
 */

import { jest } from '@jest/globals';
import { ServerDetector } from '../../../src/client/ServerDetector.js';
import http from 'http';
import net from 'net';

// Mock http module
jest.mock('http');
// Mock net module
jest.mock('net');

describe('ServerDetector', () => {
  let serverDetector;
  let mockServer;

  beforeEach(() => {
    jest.clearAllMocks();
    
    serverDetector = new ServerDetector({
      host: 'localhost',
      port: 8080,
      timeout: 1000,
      retries: 2
    });

    // Mock server for testing
    mockServer = {
      listen: jest.fn(),
      close: jest.fn(),
      on: jest.fn()
    };
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('constructor', () => {
    test('should initialize with default configuration', () => {
      const detector = new ServerDetector();
      
      expect(detector.config.host).toBe('localhost');
      expect(detector.config.port).toBe(8080);
      expect(detector.config.timeout).toBe(5000);
      expect(detector.config.retries).toBe(3);
    });

    test('should initialize with custom configuration', () => {
      const customConfig = {
        host: '127.0.0.1',
        port: 9000,
        timeout: 2000,
        retries: 1
      };
      
      const detector = new ServerDetector(customConfig);
      
      expect(detector.config).toEqual(expect.objectContaining(customConfig));
    });
  });

  describe('isPortInUse', () => {
    test('should return true when port is in use', async () => {
      // Mock net.createServer to simulate port in use
      const mockNetServer = {
        listen: jest.fn((port, callback) => {
          const error = new Error('EADDRINUSE');
          error.code = 'EADDRINUSE';
          callback(error);
        }),
        close: jest.fn()
      };
      
      jest.spyOn(net, 'createServer').mockReturnValue(mockNetServer);

      const result = await serverDetector.isPortInUse(8080);
      
      expect(result).toBe(true);
      expect(mockNetServer.listen).toHaveBeenCalledWith(8080, expect.any(Function));
    });

    test('should return false when port is free', async () => {
      // Mock net.createServer to simulate port free
      const mockNetServer = {
        listen: jest.fn((port, callback) => {
          callback(); // No error means port is free
        }),
        close: jest.fn((callback) => callback())
      };
      
      jest.spyOn(net, 'createServer').mockReturnValue(mockNetServer);

      const result = await serverDetector.isPortInUse(8080);
      
      expect(result).toBe(false);
      expect(mockNetServer.listen).toHaveBeenCalledWith(8080, expect.any(Function));
      expect(mockNetServer.close).toHaveBeenCalled();
    });
  });

  describe('_healthCheck', () => {
    test('should return server info on successful health check', async () => {
      const mockResponse = {
        statusCode: 200,
        setEncoding: jest.fn(),
        on: jest.fn((event, callback) => {
          if (event === 'data') {
            callback(JSON.stringify({
              server: 'PureLegionServer',
              version: '1.0.0',
              status: 'healthy',
              host: 'localhost',
              port: 8080
            }));
          } else if (event === 'end') {
            callback();
          }
        })
      };

      const mockRequest = {
        on: jest.fn((event, callback) => {
          if (event === 'response') {
            callback(mockResponse);
          }
        }),
        setTimeout: jest.fn(),
        end: jest.fn()
      };

      http.request.mockReturnValue(mockRequest);

      const result = await serverDetector._healthCheck();
      
      expect(result).toEqual({
        server: 'PureLegionServer',
        version: '1.0.0',
        status: 'healthy',
        host: 'localhost',
        port: 8080
      });
    });

    test('should throw error on non-200 status code', async () => {
      const mockResponse = {
        statusCode: 500,
        setEncoding: jest.fn(),
        on: jest.fn()
      };

      const mockRequest = {
        on: jest.fn((event, callback) => {
          if (event === 'response') {
            callback(mockResponse);
          }
        }),
        setTimeout: jest.fn(),
        end: jest.fn()
      };

      http.request.mockReturnValue(mockRequest);

      await expect(serverDetector._healthCheck()).rejects.toThrow('Server health check failed');
    });

    test('should handle request timeout', async () => {
      const mockRequest = {
        on: jest.fn(),
        setTimeout: jest.fn((timeout, callback) => {
          // Simulate timeout
          setTimeout(callback, 10);
        }),
        end: jest.fn(),
        destroy: jest.fn()
      };

      http.request.mockReturnValue(mockRequest);

      await expect(serverDetector._healthCheck()).rejects.toThrow('Health check timed out');
    });

    test('should handle request error', async () => {
      const mockRequest = {
        on: jest.fn((event, callback) => {
          if (event === 'error') {
            callback(new Error('Connection refused'));
          }
        }),
        setTimeout: jest.fn(),
        end: jest.fn()
      };

      http.request.mockReturnValue(mockRequest);

      await expect(serverDetector._healthCheck()).rejects.toThrow('Connection refused');
    });
  });

  describe('isServerRunning', () => {
    test('should return server info when server is running', async () => {
      const expectedServerInfo = {
        server: 'PureLegionServer',
        version: '1.0.0',
        status: 'healthy',
        host: 'localhost',
        port: 8080
      };

      // Mock successful health check
      jest.spyOn(serverDetector, '_healthCheck').mockResolvedValue(expectedServerInfo);

      const result = await serverDetector.isServerRunning();
      
      expect(result).toEqual(expectedServerInfo);
    });

    test('should return null when server is not running', async () => {
      // Mock failed health check
      jest.spyOn(serverDetector, '_healthCheck').mockRejectedValue(new Error('Connection refused'));

      const result = await serverDetector.isServerRunning();
      
      expect(result).toBeNull();
    });
  });

  describe('waitForServer', () => {
    test('should resolve when server becomes available', async () => {
      const expectedServerInfo = {
        server: 'PureLegionServer',
        version: '1.0.0',
        status: 'healthy'
      };

      // Mock server becomes available after first attempt
      jest.spyOn(serverDetector, 'isServerRunning')
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(expectedServerInfo);

      const result = await serverDetector.waitForServer(5000);
      
      expect(result).toEqual(expectedServerInfo);
    });

    test('should reject when timeout is reached', async () => {
      // Mock server never becomes available
      jest.spyOn(serverDetector, 'isServerRunning').mockResolvedValue(null);

      await expect(serverDetector.waitForServer(1000)).rejects.toThrow('Server did not start within 1000ms');
    });

    test('should use retry interval for polling', async () => {
      const expectedServerInfo = { server: 'PureLegionServer' };
      
      jest.spyOn(serverDetector, 'isServerRunning')
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(expectedServerInfo);

      const startTime = Date.now();
      const result = await serverDetector.waitForServer(5000, 500);
      const duration = Date.now() - startTime;
      
      expect(result).toEqual(expectedServerInfo);
      expect(duration).toBeGreaterThanOrEqual(1000); // At least 2 intervals
    });
  });

  describe('validateConnection', () => {
    test('should return valid connection status', async () => {
      const serverInfo = {
        server: 'PureLegionServer',
        version: '1.0.0',
        status: 'healthy'
      };

      jest.spyOn(serverDetector, 'isServerRunning').mockResolvedValue(serverInfo);

      const result = await serverDetector.validateConnection();
      
      expect(result).toEqual({
        valid: true,
        serverInfo,
        timestamp: expect.any(Date)
      });
    });

    test('should return invalid connection status', async () => {
      jest.spyOn(serverDetector, 'isServerRunning').mockResolvedValue(null);

      const result = await serverDetector.validateConnection();
      
      expect(result).toEqual({
        valid: false,
        serverInfo: null,
        timestamp: expect.any(Date),
        error: expect.any(String)
      });
    });
  });
});