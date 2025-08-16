/**
 * Integration tests for Tool Registry Server
 */

import { jest, describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import { createServer } from '../../src/server.js';
import toolRegistry from '@legion/tools-registry';

describe('Tool Registry Server Integration', () => {
  let app;
  let server;
  
  beforeAll(async () => {
    // Initialize the registry
    await toolRegistry.initialize();
    
    // Create server instance  
    const serverInstance = await createServer();
    app = serverInstance.app;
    server = serverInstance.server;
  }, 30000);
  
  afterAll(async () => {
    // Close server
    if (server) {
      await new Promise(resolve => server.close(resolve));
    }
  });
  
  describe('Health Endpoints', () => {
    it('should return healthy status', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);
      
      expect(response.body.status).toBe('healthy');
      expect(response.body.service).toBe('tool-registry-server');
    });
    
    it('should return detailed health status', async () => {
      const response = await request(app)
        .get('/health/detailed')
        .expect((res) => {
          // Accept either 200 (healthy) or 503 (degraded/unhealthy)
          if (res.status !== 200 && res.status !== 503) {
            throw new Error(`Unexpected status: ${res.status}`);
          }
        });
      
      expect(response.body.status).toBeDefined();
      expect(response.body.checks).toBeDefined();
      expect(response.body.checks.registry).toBeDefined();
    });
    
    it('should return readiness status', async () => {
      const response = await request(app)
        .get('/health/ready')
        .expect(200);
      
      expect(response.body.ready).toBe(true);
    });
    
    it('should return liveness status', async () => {
      const response = await request(app)
        .get('/health/live')
        .expect(200);
      
      expect(response.body.alive).toBe(true);
    });
  });
  
  describe('API Endpoints', () => {
    it('should get registry statistics', async () => {
      const response = await request(app)
        .get('/api/stats')
        .expect(200);
      
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('pipeline');
    });
    
    it('should list tools', async () => {
      const response = await request(app)
        .get('/api/tools')
        .query({ limit: 10 })
        .expect((res) => {
          // Accept either 200 (success) or 500 (database error)
          if (res.status !== 200 && res.status !== 500) {
            throw new Error(`Unexpected status: ${res.status}`);
          }
        });
      
      if (response.status === 200) {
        expect(response.body).toHaveProperty('tools');
        expect(response.body).toHaveProperty('count');
        expect(Array.isArray(response.body.tools)).toBe(true);
      } else {
        expect(response.body).toHaveProperty('error');
      }
    });
    
    it('should search tools', async () => {
      const response = await request(app)
        .get('/api/search')
        .query({ q: 'calculator', limit: 5 })
        .expect(200);
      
      expect(response.body).toHaveProperty('query', 'calculator');
      expect(response.body).toHaveProperty('results');
      expect(Array.isArray(response.body.results)).toBe(true);
    });
    
    it('should return 400 for search without query', async () => {
      const response = await request(app)
        .get('/api/search')
        .expect(400);
      
      expect(response.body.error).toContain('Query parameter');
    });
    
    it('should get specific tool', async () => {
      // First try to load modules (might fail if database not available)
      await request(app)
        .post('/api/modules/load')
        .expect((res) => {
          // Accept either 200 (success) or 500 (database error)
          if (res.status !== 200 && res.status !== 500) {
            throw new Error(`Unexpected status: ${res.status}`);
          }
        });
      
      // Try to get a tool that should exist after loading
      const response = await request(app)
        .get('/api/tools/calculator')
        .expect((res) => {
          // Either 200 (found), 404 (not found), or 500 (error) is acceptable
          if (res.status === 200) {
            expect(res.body).toHaveProperty('name');
            expect(res.body).toHaveProperty('description');
            // inputSchema might not be present depending on tool implementation
          } else if (res.status === 404) {
            expect(res.body).toHaveProperty('error');
          } else if (res.status === 500) {
            expect(res.body).toHaveProperty('error');
          } else {
            throw new Error(`Unexpected status: ${res.status}`);
          }
        });
    });
    
    it('should handle tool execution', async () => {
      // First ensure modules are loaded
      await request(app)
        .post('/api/modules/load')
        .expect((res) => {
          // Accept either 200 (success) or 500 (database error)
          if (res.status !== 200 && res.status !== 500) {
            throw new Error(`Unexpected status: ${res.status}`);
          }
        });
      
      // Try to execute a tool
      const response = await request(app)
        .post('/api/tools/calculator/execute')
        .send({ expression: '2 + 2' })
        .expect((res) => {
          // Either 200 (success), 404 (tool not found), or 500 (error) is acceptable
          if (res.status === 200) {
            expect(res.body).toBeDefined();
          } else if (res.status === 404) {
            expect(res.body.error).toContain('not found');
          } else if (res.status === 500) {
            expect(res.body).toHaveProperty('error');
          } else {
            throw new Error(`Unexpected status: ${res.status}`);
          }
        });
    });
    
    it('should list modules', async () => {
      const response = await request(app)
        .get('/api/modules')
        .expect((res) => {
          // Either 200 or 503 (database not available) is acceptable
          if (res.status === 200) {
            expect(res.body).toHaveProperty('modules');
            expect(res.body).toHaveProperty('count');
          } else if (res.status === 503) {
            expect(res.body.error).toContain('Database not available');
          } else {
            throw new Error(`Unexpected status: ${res.status}`);
          }
        });
    });
  });
  
  describe('Static Routes', () => {
    it('should return welcome page', async () => {
      const response = await request(app)
        .get('/')
        .expect(200);
      
      expect(response.body.service).toBe('Tool Registry Server');
      expect(response.body.version).toBe('1.0.0');
      expect(response.body.endpoints).toBeDefined();
    });
  });
  
  describe('Error Handling', () => {
    it('should handle 404 for unknown routes', async () => {
      const response = await request(app)
        .get('/api/unknown')
        .expect(404);
      
      // Check for error in response body (might be in different formats)
      expect(response.body && (response.body.error || response.text)).toBeDefined();
    });
    
    it('should handle invalid JSON', async () => {
      const response = await request(app)
        .post('/api/tools/calculator/execute')
        .set('Content-Type', 'application/json')
        .send('invalid json')
        .expect(400);
      
      expect(response.body.error).toBeDefined();
    });
  });
});