/**
 * Unit Tests for FileSystemServer
 * 
 * Tests the FileSystemServer class functionality
 */

import { FileSystemServer } from '../../src/server/index.js';
import { jest } from '@jest/globals';
import http from 'http';

describe('FileSystemServer', () => {
  let server;
  
  afterEach(async () => {
    if (server) {
      await server.stop();
      server = null;
    }
  });
  
  describe('Constructor', () => {
    test('should initialize with default options', () => {
      server = new FileSystemServer();
      
      expect(server.options.port).toBe(3000);
      expect(server.options.hostname).toBe('localhost');
      expect(server.options.rootPath).toBe(process.cwd());
      expect(server.options.enableWebSocket).toBe(true);
    });
    
    test('should accept custom options', () => {
      server = new FileSystemServer({
        port: 8080,
        hostname: '0.0.0.0',
        rootPath: '/custom/path',
        enableAuth: true,
        maxFileSize: 50 * 1024 * 1024
      });
      
      expect(server.options.port).toBe(8080);
      expect(server.options.hostname).toBe('0.0.0.0');
      expect(server.options.rootPath).toBe('/custom/path');
      expect(server.options.enableAuth).toBe(true);
      expect(server.options.maxFileSize).toBe(50 * 1024 * 1024);
    });
    
    test('should create Express app', () => {
      server = new FileSystemServer();
      
      expect(server.app).toBeDefined();
      expect(typeof server.app.use).toBe('function');
      expect(typeof server.app.get).toBe('function');
      expect(typeof server.app.post).toBe('function');
    });
    
    test('should create LocalFileSystemResourceManager', () => {
      server = new FileSystemServer({
        rootPath: '/test/path'
      });
      
      expect(server.fsManager).toBeDefined();
      expect(server.fsManager.rootPath).toBe('/test/path');
    });
  });
  
  describe('Server Lifecycle', () => {
    test('should start server on specified port', async () => {
      server = new FileSystemServer({
        port: 0 // Use random port
      });
      
      const result = await server.start();
      
      expect(result).toEqual(expect.objectContaining({
        url: expect.stringContaining('http://'),
        wsUrl: expect.stringContaining('ws://')
      }));
      
      expect(server.server).toBeDefined();
      expect(server.server.listening).toBe(true);
    });
    
    test('should stop server cleanly', async () => {
      server = new FileSystemServer({
        port: 0
      });
      
      await server.start();
      expect(server.server.listening).toBe(true);
      
      await server.stop();
      expect(server.server.listening).toBe(false);
    });
    
    test('should handle server start errors', async () => {
      // Create two servers on same port to trigger error
      const server1 = new FileSystemServer({ port: 0 });
      await server1.start();
      const port = server1.server.address().port;
      
      server = new FileSystemServer({ port });
      
      await expect(server.start()).rejects.toThrow();
      
      await server1.stop();
    });
  });
  
  describe('Routes', () => {
    beforeEach(async () => {
      server = new FileSystemServer({
        port: 0,
        enableWebSocket: false
      });
      await server.start();
    });
    
    test('should have health check endpoint', async () => {
      const port = server.server.address().port;
      
      const response = await fetch(`http://localhost:${port}/health`);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data).toEqual(expect.objectContaining({
        status: 'ok',
        rootPath: expect.any(String),
        capabilities: expect.any(Object)
      }));
    });
    
    test('should validate query endpoint input', async () => {
      const port = server.server.address().port;
      
      // Test with invalid query
      const response = await fetch(`http://localhost:${port}/api/filesystem/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: 'invalid' })
      });
      
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Invalid query specification');
    });
    
    test('should validate update endpoint input', async () => {
      const port = server.server.address().port;
      
      // Test file size limit
      const largeContent = 'x'.repeat(server.options.maxFileSize + 1);
      
      const response = await fetch(`http://localhost:${port}/api/filesystem/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: '/test.txt',
          operation: 'write',
          content: largeContent
        })
      });
      
      expect(response.status).toBe(413);
      const data = await response.json();
      expect(data.error).toBe('File size exceeds limit');
    });
  });
  
  describe('Authentication', () => {
    test('should require auth when enabled', async () => {
      server = new FileSystemServer({
        port: 0,
        enableAuth: true,
        authTokens: new Set(['valid-token']),
        enableWebSocket: false
      });
      
      await server.start();
      const port = server.server.address().port;
      
      // Request without auth
      const response1 = await fetch(`http://localhost:${port}/api/filesystem/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: {} })
      });
      
      expect(response1.status).toBe(401);
      
      // Request with invalid token
      const response2 = await fetch(`http://localhost:${port}/api/filesystem/query`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer invalid-token'
        },
        body: JSON.stringify({ query: {} })
      });
      
      expect(response2.status).toBe(403);
      
      // Request with valid token
      const response3 = await fetch(`http://localhost:${port}/api/filesystem/query`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer valid-token'
        },
        body: JSON.stringify({ query: { find: [], where: [] } })
      });
      
      expect(response3.status).toBe(200);
    });
  });
  
  describe('Path Validation', () => {
    test('should prevent path traversal attacks', () => {
      server = new FileSystemServer({
        rootPath: '/safe/path'
      });
      
      expect(() => {
        server._validatePath('/../etc/passwd');
      }).toThrow('Path traversal attempt detected');
      
      expect(() => {
        server._validatePath('/test/../../../etc/passwd');
      }).toThrow('Path traversal attempt detected');
    });
    
    test('should normalize valid paths', () => {
      server = new FileSystemServer({
        rootPath: '/safe/path'
      });
      
      const normalized = server._validatePath('/test/file.txt');
      expect(normalized).toBe('/test/file.txt');
    });
  });
  
  describe('WebSocket', () => {
    test('should setup WebSocket server when enabled', async () => {
      server = new FileSystemServer({
        port: 0,
        enableWebSocket: true
      });
      
      await server.start();
      
      expect(server.wss).toBeDefined();
      expect(server.wss.path).toBe('/filesystem');
    });
    
    test('should not setup WebSocket when disabled', async () => {
      server = new FileSystemServer({
        port: 0,
        enableWebSocket: false
      });
      
      await server.start();
      
      expect(server.wss).toBeNull();
    });
  });
  
  describe('Query Validation', () => {
    test('should validate paths in query clauses', () => {
      server = new FileSystemServer({
        rootPath: '/safe'
      });
      
      const maliciousQuery = {
        where: [
          ['file', '/../etc/passwd', 'metadata']
        ]
      };
      
      expect(() => {
        server._validateQuery(maliciousQuery);
      }).toThrow('Path traversal attempt detected');
    });
    
    test('should allow valid queries', () => {
      server = new FileSystemServer({
        rootPath: '/safe'
      });
      
      const validQuery = {
        where: [
          ['file', '/test/file.txt', 'metadata'],
          ['parent', '/test', 'list']
        ]
      };
      
      // Should not throw
      server._validateQuery(validQuery);
    });
  });
});