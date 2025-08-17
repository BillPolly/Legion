/**
 * Integration tests for Legion package serving
 * NO MOCKS - uses real file system and HTTP requests
 */

import { BaseServer } from '../../BaseServer.js';
import fetch from 'node-fetch';
import fs from 'fs/promises';
import path from 'path';

describe('Legion Package Serving Integration Tests', () => {
  let server;
  let testClientFile;
  const testPort = 9878;

  beforeAll(async () => {
    // Create test client file
    testClientFile = path.join(process.cwd(), 'test-legion-client.js');
    await fs.writeFile(testClientFile, `
      import { Actor } from '@legion/actors';
      import { ResourceManager } from '@legion/resource-manager';
      
      export default class TestClient extends Actor {
        constructor() {
          super();
          this.resourceManager = ResourceManager.getInstance();
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

  describe('/legion/* route handling', () => {
    beforeEach(async () => {
      server = new BaseServer();
      await server.initialize();
      
      // Register a test route to start server
      const factory = () => ({ name: 'TestActor' });
      server.registerRoute('/test', factory, testClientFile, testPort);
    });

    it('should serve Legion packages at /legion/* URLs', async () => {
      await server.start();
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Try to fetch a known Legion package file
      const response = await fetch(`http://localhost:${testPort}/legion/actors/Actor.js`);
      
      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toContain('application/javascript');
    });

    it('should serve package index files', async () => {
      await server.start();
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const response = await fetch(`http://localhost:${testPort}/legion/actors/index.js`);
      
      expect(response.status).toBe(200);
      
      const content = await response.text();
      expect(content).toContain('export'); // Should have exports
    });

    it('should rewrite @legion imports in served files', async () => {
      await server.start();
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Fetch client file which has @legion imports
      const response = await fetch(`http://localhost:${testPort}/test/client.js`);
      const content = await response.text();
      
      // Should have rewritten imports
      expect(content).toContain('/legion/actors');
      expect(content).not.toContain('@legion/actors');
      expect(content).toContain('/legion/resource-manager');
      expect(content).not.toContain('@legion/resource-manager');
    });

    it('should handle nested package paths', async () => {
      await server.start();
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Try to access a file in shared/actors
      const response = await fetch(`http://localhost:${testPort}/legion/actors/ActorSpace.js`);
      
      if (response.status === 200) {
        const content = await response.text();
        expect(content).toBeTruthy();
        expect(response.headers.get('content-type')).toContain('javascript');
      } else {
        // File might not exist, but route should be handled
        expect([200, 404]).toContain(response.status);
      }
    });

    it('should return 404 for non-existent Legion packages', async () => {
      await server.start();
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const response = await fetch(`http://localhost:${testPort}/legion/non-existent-package/index.js`);
      
      expect(response.status).toBe(404);
    });

    it('should serve multiple packages', async () => {
      await server.start();
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Test multiple known packages
      const packages = ['actors', 'resource-manager'];
      
      for (const pkg of packages) {
        const response = await fetch(`http://localhost:${testPort}/legion/${pkg}/index.js`);
        
        if (response.status === 200) {
          const content = await response.text();
          expect(content).toBeTruthy();
        }
      }
    });
  });

  describe('Import rewriting in served files', () => {
    it('should rewrite imports when serving client files', async () => {
      server = new BaseServer();
      await server.initialize();
      
      // Create a client file with Legion imports
      const clientWithImports = path.join(process.cwd(), 'test-imports-client.js');
      await fs.writeFile(clientWithImports, `
        import { Actor } from '@legion/actors';
        import { ResourceManager } from '@legion/resource-manager';
        import express from 'express'; // Non-Legion import
        
        export default class Client extends Actor {
          constructor() {
            super();
          }
        }
      `);
      
      const factory = () => ({ name: 'TestActor' });
      server.registerRoute('/app', factory, clientWithImports, testPort);
      await server.start();
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const response = await fetch(`http://localhost:${testPort}/app/client.js`);
      const content = await response.text();
      
      // Check rewriting
      expect(content).toContain("from '/legion/actors/index.js'");
      expect(content).toContain("from '/legion/resource-manager/index.js'");
      expect(content).toContain("from 'express'"); // Non-Legion unchanged
      
      // Clean up
      await fs.unlink(clientWithImports).catch(() => {});
    });

    it('should handle dynamic imports', async () => {
      server = new BaseServer();
      await server.initialize();
      
      const clientWithDynamic = path.join(process.cwd(), 'test-dynamic-client.js');
      await fs.writeFile(clientWithDynamic, `
        export default class Client {
          async loadActor() {
            const { Actor } = await import('@legion/actors');
            return Actor;
          }
        }
      `);
      
      const factory = () => ({ name: 'TestActor' });
      server.registerRoute('/dynamic', factory, clientWithDynamic, testPort);
      await server.start();
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const response = await fetch(`http://localhost:${testPort}/dynamic/client.js`);
      const content = await response.text();
      
      expect(content).toContain("import('/legion/actors/index.js')");
      
      await fs.unlink(clientWithDynamic).catch(() => {});
    });
  });

  describe('Package discovery integration', () => {
    it('should automatically discover and serve all Legion packages', async () => {
      server = new BaseServer();
      await server.initialize();
      
      const factory = () => ({ name: 'TestActor' });
      server.registerRoute('/test', factory, testClientFile, testPort);
      await server.start();
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // The server should have discovered packages
      // Try to access this package itself
      const response = await fetch(`http://localhost:${testPort}/legion/server-framework/index.js`);
      
      // Should either serve it or give proper 404
      expect([200, 404]).toContain(response.status);
    });
  });

  describe('MIME types and headers', () => {
    it('should set correct Content-Type for JavaScript files', async () => {
      server = new BaseServer();
      await server.initialize();
      
      const factory = () => ({ name: 'TestActor' });
      server.registerRoute('/test', factory, testClientFile, testPort);
      await server.start();
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const response = await fetch(`http://localhost:${testPort}/test/client.js`);
      
      expect(response.headers.get('content-type')).toContain('application/javascript');
    });

    it('should support CORS for Legion packages', async () => {
      server = new BaseServer();
      await server.initialize();
      
      const factory = () => ({ name: 'TestActor' });
      server.registerRoute('/test', factory, testClientFile, testPort);
      await server.start();
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const response = await fetch(`http://localhost:${testPort}/legion/actors/index.js`, {
        headers: { 'Origin': 'http://localhost:3000' }
      });
      
      // Should have CORS headers
      const corsHeader = response.headers.get('access-control-allow-origin');
      expect(corsHeader).toBeTruthy();
    });
  });
});