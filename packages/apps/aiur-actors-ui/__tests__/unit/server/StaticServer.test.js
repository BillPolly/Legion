/**
 * Tests for Static Server - Serves HTML, CSS, and JavaScript files
 */
import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { createServer } from 'http';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

describe('StaticServer', () => {
  let StaticServer;
  let mockFs, mockPath, mockHttp;
  
  beforeEach(async () => {
    // Mock filesystem
    mockFs = {
      existsSync: jest.fn(),
      readFileSync: jest.fn(),
      statSync: jest.fn()
    };
    
    // Mock path module
    mockPath = {
      join: jest.fn(),
      extname: jest.fn(),
      resolve: jest.fn()
    };
    
    // Mock http module
    mockHttp = {
      createServer: jest.fn()
    };
    
    // Import the StaticServer class (will be created)
    try {
      ({ StaticServer } = await import('../../../src/server/StaticServer.js'));
    } catch (error) {
      // Class doesn't exist yet, create a mock
      StaticServer = class {
        constructor(config = {}) {
          this.port = config.port || 8080;
          this.publicDir = config.publicDir || join(__dirname, '../../../public');
          this.server = null;
          this.mimeTypes = {
            '.html': 'text/html',
            '.js': 'text/javascript',
            '.css': 'text/css',
            '.json': 'application/json',
            '.png': 'image/png',
            '.jpg': 'image/jpeg',
            '.gif': 'image/gif',
            '.svg': 'image/svg+xml',
            '.ico': 'image/x-icon'
          };
        }
        
        start() {
          return new Promise((resolve) => {
            this.server = createServer((req, res) => {
              this.handleRequest(req, res);
            });
            
            this.server.listen(this.port, () => {
              resolve();
            });
          });
        }
        
        handleRequest(req, res) {
          // Handle static file requests
        }
        
        stop() {
          return new Promise((resolve) => {
            if (this.server) {
              this.server.close(() => {
                resolve();
              });
            } else {
              resolve();
            }
          });
        }
      };
    }
  });

  describe('Server Configuration', () => {
    test('should create server with default configuration', () => {
      const server = new StaticServer();
      
      expect(server.port).toBe(8080);
      expect(server.publicDir).toContain('public');
      expect(server.server).toBeNull();
    });

    test('should accept custom port and directory', () => {
      const server = new StaticServer({
        port: 3000,
        publicDir: '/custom/path'
      });
      
      expect(server.port).toBe(3000);
      expect(server.publicDir).toBe('/custom/path');
    });

    test('should configure MIME types', () => {
      const server = new StaticServer();
      
      expect(server.mimeTypes['.html']).toBe('text/html');
      expect(server.mimeTypes['.js']).toBe('text/javascript');
      expect(server.mimeTypes['.css']).toBe('text/css');
      expect(server.mimeTypes['.json']).toBe('application/json');
    });

    test('should support custom MIME types', () => {
      const server = new StaticServer({
        mimeTypes: {
          '.wasm': 'application/wasm'
        }
      });
      
      expect(server.mimeTypes['.wasm']).toBe('application/wasm');
      expect(server.mimeTypes['.html']).toBe('text/html'); // Default still present
    });
  });

  describe('Server Lifecycle', () => {
    test('should start server on specified port', async () => {
      const server = new StaticServer({ port: 8081 });
      
      await server.start();
      
      expect(server.server).toBeDefined();
      expect(server.server.listening).toBe(true);
      
      await server.stop();
    });

    test('should stop server gracefully', async () => {
      const server = new StaticServer();
      
      await server.start();
      expect(server.server.listening).toBe(true);
      
      await server.stop();
      expect(server.server.listening).toBe(false);
    });

    test('should handle multiple start calls', async () => {
      const server = new StaticServer();
      
      await server.start();
      const firstServer = server.server;
      
      // Second start should not create new server
      await server.start();
      expect(server.server).toBe(firstServer);
      
      await server.stop();
    });

    test('should handle stop without start', async () => {
      const server = new StaticServer();
      
      // Should not throw
      await expect(server.stop()).resolves.toBeUndefined();
    });
  });

  describe('File Serving', () => {
    test('should serve index.html for root path', async () => {
      const server = new StaticServer();
      const mockReq = { url: '/', method: 'GET' };
      const mockRes = {
        writeHead: jest.fn(),
        end: jest.fn()
      };
      
      server.handleRequest(mockReq, mockRes);
      
      expect(mockRes.writeHead).toHaveBeenCalledWith(200, {
        'Content-Type': 'text/html'
      });
    });

    test('should serve static files with correct MIME types', async () => {
      const server = new StaticServer();
      
      const testCases = [
        { url: '/style.css', mime: 'text/css' },
        { url: '/script.js', mime: 'text/javascript' },
        { url: '/data.json', mime: 'application/json' },
        { url: '/logo.png', mime: 'image/png' }
      ];
      
      for (const { url, mime } of testCases) {
        const mockReq = { url, method: 'GET' };
        const mockRes = {
          writeHead: jest.fn(),
          end: jest.fn()
        };
        
        server.handleRequest(mockReq, mockRes);
        
        expect(mockRes.writeHead).toHaveBeenCalledWith(200, {
          'Content-Type': mime
        });
      }
    });

    test('should handle 404 for non-existent files', () => {
      const server = new StaticServer();
      const mockReq = { url: '/non-existent.txt', method: 'GET' };
      const mockRes = {
        writeHead: jest.fn(),
        end: jest.fn()
      };
      
      server.handleRequest(mockReq, mockRes);
      
      expect(mockRes.writeHead).toHaveBeenCalledWith(404, {
        'Content-Type': 'text/plain'
      });
      expect(mockRes.end).toHaveBeenCalledWith('404 Not Found');
    });

    test('should prevent directory traversal attacks', () => {
      const server = new StaticServer();
      const mockReq = { url: '/../../../etc/passwd', method: 'GET' };
      const mockRes = {
        writeHead: jest.fn(),
        end: jest.fn()
      };
      
      server.handleRequest(mockReq, mockRes);
      
      expect(mockRes.writeHead).toHaveBeenCalledWith(403, {
        'Content-Type': 'text/plain'
      });
      expect(mockRes.end).toHaveBeenCalledWith('403 Forbidden');
    });

    test('should handle query parameters', () => {
      const server = new StaticServer();
      const mockReq = { url: '/index.html?v=1.0.0', method: 'GET' };
      const mockRes = {
        writeHead: jest.fn(),
        end: jest.fn()
      };
      
      server.handleRequest(mockReq, mockRes);
      
      expect(mockRes.writeHead).toHaveBeenCalledWith(200, {
        'Content-Type': 'text/html'
      });
    });

    test('should support HEAD requests', () => {
      const server = new StaticServer();
      const mockReq = { url: '/index.html', method: 'HEAD' };
      const mockRes = {
        writeHead: jest.fn(),
        end: jest.fn()
      };
      
      server.handleRequest(mockReq, mockRes);
      
      expect(mockRes.writeHead).toHaveBeenCalledWith(200, {
        'Content-Type': 'text/html'
      });
      expect(mockRes.end).toHaveBeenCalledWith(); // No body for HEAD
    });

    test('should reject unsupported methods', () => {
      const server = new StaticServer();
      const mockReq = { url: '/index.html', method: 'POST' };
      const mockRes = {
        writeHead: jest.fn(),
        end: jest.fn()
      };
      
      server.handleRequest(mockReq, mockRes);
      
      expect(mockRes.writeHead).toHaveBeenCalledWith(405, {
        'Content-Type': 'text/plain'
      });
      expect(mockRes.end).toHaveBeenCalledWith('405 Method Not Allowed');
    });
  });

  describe('CORS and Security Headers', () => {
    test('should add CORS headers when configured', () => {
      const server = new StaticServer({
        cors: true,
        corsOrigin: '*'
      });
      
      const mockReq = { url: '/api/data.json', method: 'GET' };
      const mockRes = {
        writeHead: jest.fn(),
        end: jest.fn()
      };
      
      server.handleRequest(mockReq, mockRes);
      
      expect(mockRes.writeHead).toHaveBeenCalledWith(200, expect.objectContaining({
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS'
      }));
    });

    test('should handle OPTIONS requests for CORS', () => {
      const server = new StaticServer({ cors: true });
      const mockReq = { url: '/api/data.json', method: 'OPTIONS' };
      const mockRes = {
        writeHead: jest.fn(),
        end: jest.fn()
      };
      
      server.handleRequest(mockReq, mockRes);
      
      expect(mockRes.writeHead).toHaveBeenCalledWith(204, expect.objectContaining({
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
        'Access-Control-Max-Age': '86400'
      }));
    });

    test('should add security headers', () => {
      const server = new StaticServer({ securityHeaders: true });
      const mockReq = { url: '/index.html', method: 'GET' };
      const mockRes = {
        writeHead: jest.fn(),
        end: jest.fn()
      };
      
      server.handleRequest(mockReq, mockRes);
      
      expect(mockRes.writeHead).toHaveBeenCalledWith(200, expect.objectContaining({
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'SAMEORIGIN',
        'X-XSS-Protection': '1; mode=block'
      }));
    });
  });

  describe('Caching', () => {
    test('should add cache headers for static assets', () => {
      const server = new StaticServer({ caching: true });
      
      const testCases = [
        { url: '/style.css', maxAge: '31536000' }, // 1 year
        { url: '/script.js', maxAge: '31536000' },
        { url: '/logo.png', maxAge: '31536000' },
        { url: '/index.html', maxAge: '0' } // No cache for HTML
      ];
      
      for (const { url, maxAge } of testCases) {
        const mockReq = { url, method: 'GET' };
        const mockRes = {
          writeHead: jest.fn(),
          end: jest.fn()
        };
        
        server.handleRequest(mockReq, mockRes);
        
        expect(mockRes.writeHead).toHaveBeenCalledWith(200, expect.objectContaining({
          'Cache-Control': expect.stringContaining(`max-age=${maxAge}`)
        }));
      }
    });

    test('should handle If-Modified-Since header', () => {
      const server = new StaticServer();
      const mockReq = {
        url: '/style.css',
        method: 'GET',
        headers: {
          'if-modified-since': new Date().toUTCString()
        }
      };
      const mockRes = {
        writeHead: jest.fn(),
        end: jest.fn()
      };
      
      server.handleRequest(mockReq, mockRes);
      
      // Should return 304 Not Modified if file hasn't changed
      expect(mockRes.writeHead).toHaveBeenCalledWith(
        expect.any(Number),
        expect.any(Object)
      );
    });

    test('should support ETag headers', () => {
      const server = new StaticServer({ etag: true });
      const mockReq = { url: '/script.js', method: 'GET' };
      const mockRes = {
        writeHead: jest.fn(),
        end: jest.fn()
      };
      
      server.handleRequest(mockReq, mockRes);
      
      expect(mockRes.writeHead).toHaveBeenCalledWith(200, expect.objectContaining({
        'ETag': expect.any(String)
      }));
    });
  });

  describe('Compression', () => {
    test('should compress responses when accepted', () => {
      const server = new StaticServer({ compression: true });
      const mockReq = {
        url: '/script.js',
        method: 'GET',
        headers: {
          'accept-encoding': 'gzip, deflate'
        }
      };
      const mockRes = {
        writeHead: jest.fn(),
        end: jest.fn()
      };
      
      server.handleRequest(mockReq, mockRes);
      
      expect(mockRes.writeHead).toHaveBeenCalledWith(200, expect.objectContaining({
        'Content-Encoding': 'gzip'
      }));
    });

    test('should not compress small files', () => {
      const server = new StaticServer({ 
        compression: true,
        compressionThreshold: 1024 // 1KB
      });
      
      const mockReq = {
        url: '/small.txt', // Assume < 1KB
        method: 'GET',
        headers: {
          'accept-encoding': 'gzip'
        }
      };
      const mockRes = {
        writeHead: jest.fn(),
        end: jest.fn()
      };
      
      server.handleRequest(mockReq, mockRes);
      
      expect(mockRes.writeHead).toHaveBeenCalledWith(200, 
        expect.not.objectContaining({
          'Content-Encoding': 'gzip'
        })
      );
    });
  });

  describe('Error Handling', () => {
    test('should handle file read errors gracefully', () => {
      const server = new StaticServer();
      
      // Mock file read error
      server.readFile = jest.fn().mockImplementation(() => {
        throw new Error('EACCES: permission denied');
      });
      
      const mockReq = { url: '/protected.html', method: 'GET' };
      const mockRes = {
        writeHead: jest.fn(),
        end: jest.fn()
      };
      
      server.handleRequest(mockReq, mockRes);
      
      expect(mockRes.writeHead).toHaveBeenCalledWith(500, {
        'Content-Type': 'text/plain'
      });
      expect(mockRes.end).toHaveBeenCalledWith('500 Internal Server Error');
    });

    test('should log errors when logger is provided', () => {
      const mockLogger = {
        error: jest.fn()
      };
      
      const server = new StaticServer({ logger: mockLogger });
      
      server.readFile = jest.fn().mockImplementation(() => {
        throw new Error('Test error');
      });
      
      const mockReq = { url: '/error.html', method: 'GET' };
      const mockRes = {
        writeHead: jest.fn(),
        end: jest.fn()
      };
      
      server.handleRequest(mockReq, mockRes);
      
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Error serving'),
        expect.any(Error)
      );
    });
  });

  describe('SPA Support', () => {
    test('should fallback to index.html for SPA routes', () => {
      const server = new StaticServer({ spa: true });
      
      const mockReq = { url: '/app/dashboard', method: 'GET' };
      const mockRes = {
        writeHead: jest.fn(),
        end: jest.fn()
      };
      
      server.handleRequest(mockReq, mockRes);
      
      // Should serve index.html for client-side routing
      expect(mockRes.writeHead).toHaveBeenCalledWith(200, {
        'Content-Type': 'text/html'
      });
    });

    test('should not fallback for actual files', () => {
      const server = new StaticServer({ spa: true });
      
      const mockReq = { url: '/style.css', method: 'GET' };
      const mockRes = {
        writeHead: jest.fn(),
        end: jest.fn()
      };
      
      server.handleRequest(mockReq, mockRes);
      
      expect(mockRes.writeHead).toHaveBeenCalledWith(200, {
        'Content-Type': 'text/css'
      });
    });

    test('should handle API routes separately in SPA mode', () => {
      const server = new StaticServer({ 
        spa: true,
        apiPrefix: '/api'
      });
      
      const mockReq = { url: '/api/users', method: 'GET' };
      const mockRes = {
        writeHead: jest.fn(),
        end: jest.fn()
      };
      
      server.handleRequest(mockReq, mockRes);
      
      // API routes should return 404, not fallback to index.html
      expect(mockRes.writeHead).toHaveBeenCalledWith(404, {
        'Content-Type': 'application/json'
      });
      expect(mockRes.end).toHaveBeenCalledWith(JSON.stringify({
        error: 'API endpoint not found'
      }));
    });
  });
});