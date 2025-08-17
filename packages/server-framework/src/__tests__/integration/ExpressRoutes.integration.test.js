/**
 * Integration tests for Express route setup
 * Tests actual HTTP server and route serving
 */

import { BaseServer } from '../../BaseServer.js';
import { generateHTML } from '../../htmlTemplate.js';
import fetch from 'node-fetch';
import fs from 'fs/promises';
import path from 'path';

describe('Express Routes Integration Tests', () => {
  let server;
  let testClientFile;
  const testPort = 9876; // Use unique port for tests

  beforeAll(async () => {
    // Create test client file
    testClientFile = path.join(process.cwd(), 'test-express-client.js');
    await fs.writeFile(testClientFile, `
      import { Actor } from '/legion/actors/Actor.js';
      
      export default class TestClient extends Actor {
        constructor() {
          super();
          this.name = 'TestClient';
        }
        
        setRemoteActor(remote) {
          this.remoteActor = remote;
        }
      }
    `);
  });

  afterAll(async () => {
    await fs.unlink(testClientFile).catch(() => {});
  });

  afterEach(async () => {
    if (server) {
      await server.stop().catch(() => {});
      server = null;
    }
  });

  describe('HTML page serving', () => {
    beforeEach(async () => {
      server = new BaseServer();
      await server.initialize();
    });

    it('should serve HTML page at registered route', async () => {
      const factory = (services) => ({ name: 'TestActor' });
      
      server.registerRoute('/test', factory, testClientFile, testPort);
      await server.start();
      
      // Wait a bit for server to start
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const response = await fetch(`http://localhost:${testPort}/test`);
      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toContain('text/html');
      
      const html = await response.text();
      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('<title>');
      expect(html).toContain('WebSocket');
    });

    it('should inject correct WebSocket endpoint in HTML', async () => {
      const factory = (services) => ({ name: 'TestActor' });
      
      server.registerRoute('/app', factory, testClientFile, testPort);
      await server.start();
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const response = await fetch(`http://localhost:${testPort}/app`);
      const html = await response.text();
      
      expect(html).toContain(`ws://localhost:${testPort}/ws`);
      expect(html).toContain("route: '/app'");
    });

    it('should use route name as default title', async () => {
      const factory = (services) => ({ name: 'TestActor' });
      
      server.registerRoute('/dashboard', factory, testClientFile, testPort);
      await server.start();
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const response = await fetch(`http://localhost:${testPort}/dashboard`);
      const html = await response.text();
      
      expect(html).toContain('<title>Dashboard</title>');
    });
  });

  describe('Client actor file serving', () => {
    beforeEach(async () => {
      server = new BaseServer();
      await server.initialize();
    });

    it('should serve client actor JavaScript file', async () => {
      const factory = (services) => ({ name: 'TestActor' });
      
      server.registerRoute('/test', factory, testClientFile, testPort);
      await server.start();
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const response = await fetch(`http://localhost:${testPort}/test/client.js`);
      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toContain('application/javascript');
      
      const content = await response.text();
      expect(content).toContain('export default class TestClient');
      expect(content).toContain('extends Actor');
    });

    it('should set correct MIME type for JavaScript', async () => {
      const factory = (services) => ({ name: 'TestActor' });
      
      server.registerRoute('/app', factory, testClientFile, testPort);
      await server.start();
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const response = await fetch(`http://localhost:${testPort}/app/client.js`);
      const contentType = response.headers.get('content-type');
      
      expect(contentType).toContain('application/javascript');
    });
  });

  describe('Multiple routes on different ports', () => {
    let testClientFile2;

    beforeAll(async () => {
      testClientFile2 = path.join(process.cwd(), 'test-express-client2.js');
      await fs.writeFile(testClientFile2, `
        export default class TestClient2 {
          constructor() { this.name = 'TestClient2'; }
        }
      `);
    });

    afterAll(async () => {
      await fs.unlink(testClientFile2).catch(() => {});
    });

    it('should serve different routes on different ports', async () => {
      server = new BaseServer();
      await server.initialize();
      
      const factory1 = () => ({ name: 'Actor1' });
      const factory2 = () => ({ name: 'Actor2' });
      
      server.registerRoute('/app1', factory1, testClientFile, testPort);
      server.registerRoute('/app2', factory2, testClientFile2, testPort + 1);
      await server.start();
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Test first route
      const response1 = await fetch(`http://localhost:${testPort}/app1`);
      expect(response1.status).toBe(200);
      const html1 = await response1.text();
      expect(html1).toContain("route: '/app1'");
      
      // Test second route
      const response2 = await fetch(`http://localhost:${testPort + 1}/app2`);
      expect(response2.status).toBe(200);
      const html2 = await response2.text();
      expect(html2).toContain("route: '/app2'");
    });

    it('should serve multiple routes on same port', async () => {
      server = new BaseServer();
      await server.initialize();
      
      const factory1 = () => ({ name: 'Actor1' });
      const factory2 = () => ({ name: 'Actor2' });
      
      server.registerRoute('/route1', factory1, testClientFile, testPort);
      server.registerRoute('/route2', factory2, testClientFile2, testPort);
      await server.start();
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Both routes should work on same port
      const response1 = await fetch(`http://localhost:${testPort}/route1`);
      expect(response1.status).toBe(200);
      
      const response2 = await fetch(`http://localhost:${testPort}/route2`);
      expect(response2.status).toBe(200);
    });
  });

  describe('Static route serving', () => {
    let staticDir;

    beforeAll(async () => {
      staticDir = path.join(process.cwd(), 'test-static-express');
      await fs.mkdir(staticDir, { recursive: true });
      await fs.writeFile(path.join(staticDir, 'index.html'), '<h1>Static Content</h1>');
      await fs.writeFile(path.join(staticDir, 'style.css'), 'body { color: red; }');
    });

    afterAll(async () => {
      await fs.rm(staticDir, { recursive: true, force: true }).catch(() => {});
    });

    it('should serve static files', async () => {
      server = new BaseServer();
      await server.initialize();
      
      const factory = () => ({ name: 'Actor' });
      server.registerRoute('/app', factory, testClientFile, testPort);
      server.registerStaticRoute('/static', staticDir);
      await server.start();
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const response = await fetch(`http://localhost:${testPort}/static/index.html`);
      expect(response.status).toBe(200);
      const content = await response.text();
      expect(content).toContain('<h1>Static Content</h1>');
    });

    it('should serve CSS files with correct MIME type', async () => {
      server = new BaseServer();
      await server.initialize();
      
      const factory = () => ({ name: 'Actor' });
      server.registerRoute('/app', factory, testClientFile, testPort);
      server.registerStaticRoute('/assets', staticDir);
      await server.start();
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const response = await fetch(`http://localhost:${testPort}/assets/style.css`);
      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toContain('text/css');
    });
  });

  describe('Health check endpoint', () => {
    it('should provide health check endpoint', async () => {
      server = new BaseServer();
      await server.initialize();
      
      const factory = () => ({ name: 'Actor' });
      server.registerRoute('/app', factory, testClientFile, testPort);
      await server.start();
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const response = await fetch(`http://localhost:${testPort}/health`);
      expect(response.status).toBe(200);
      
      const health = await response.json();
      expect(health.status).toBe('ok');
      expect(health.service).toBe('legion-server');
      expect(health.timestamp).toBeDefined();
    });
  });
});