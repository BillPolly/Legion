/**
 * Integration tests for Legion component serving on /legion/ routes
 * NO MOCKS - tests real component serving with actual HTTP requests
 */

import { createConfigurableServer } from '../../src/index.js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe('Legion Component Serving Integration - NO MOCKS', () => {
  let server;
  let baseUrl;
  
  beforeAll(async () => {
    const config = {
      name: 'legion-component-test',
      port: 0, // Use random port
      routes: [
        {
          path: '/test',
          serverActor: join(__dirname, '../../src/__tests__/fixtures/SimpleServerActor.js'),
          clientActor: join(__dirname, '../../src/__tests__/fixtures/TestClientActor.js'),
          title: 'Test App'
        }
      ]
    };
    
    server = await createConfigurableServer(config);
    await server.start();
    
    // Use port 8080 (from logs)
    baseUrl = `http://localhost:8080`;
    
    console.log(`Test server running on ${baseUrl}`);
  });
  
  afterAll(async () => {
    if (server) {
      await server.stop();
    }
  });

  describe('Legion Package Route Setup', () => {
    test('should serve components package on /legion/components', async () => {
      const response = await fetch(`${baseUrl}/legion/components/src/components/window/index.js`);
      
      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toContain('application/javascript');
      
      const content = await response.text();
      expect(content).toContain('Window Component');
      expect(content).toContain('export const Window');
    });

    test('should serve umbilical utilities on /legion/components/src/umbilical/', async () => {
      const response = await fetch(`${baseUrl}/legion/components/src/umbilical/index.js`);
      
      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toContain('application/javascript');
      
      const content = await response.text();
      expect(content).toContain('UmbilicalUtils');
    });

    test('should serve code-editor component with dependencies', async () => {
      const response = await fetch(`${baseUrl}/legion/components/src/components/code-editor/index.js`);
      
      expect(response.status).toBe(200);
      
      const content = await response.text();
      expect(content).toContain('CodeEditor');
    });

    test('should serve image-viewer component', async () => {
      const response = await fetch(`${baseUrl}/legion/components/src/components/image-viewer/index.js`);
      
      expect(response.status).toBe(200);
      
      const content = await response.text();
      expect(content).toContain('ImageViewer');
    });
  });

  describe('Import Resolution', () => {
    test('should rewrite imports correctly in served components', async () => {
      const response = await fetch(`${baseUrl}/legion/components/src/components/window/index.js`);
      const content = await response.text();
      
      // Should have rewritten the umbilical import to absolute path
      expect(content).toContain('/legion/components/src/umbilical/index.js');
      expect(content).not.toContain('../../umbilical/index.js');
    });

    test('should handle component dependencies correctly', async () => {
      // Test that all dependencies of CodeEditor are available
      const codeEditorResponse = await fetch(`${baseUrl}/legion/components/src/components/code-editor/index.js`);
      const content = await codeEditorResponse.text();
      
      // Extract import paths and test they're all available
      const importPaths = content.match(/from ['"](.*?)['"];?/g) || [];
      
      for (const importMatch of importPaths) {
        const path = importMatch.match(/from ['"](.*)['"];?/)[1];
        if (path.startsWith('/legion/')) {
          const depResponse = await fetch(`${baseUrl}${path}`);
          expect(depResponse.status).toBe(200);
        }
      }
    });
  });

  describe('Dynamic Import Testing', () => {
    test('should allow successful dynamic import of components', async () => {
      // This test will run in the browser context via the test server
      const response = await fetch(`${baseUrl}/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'test-dynamic-import',
          component: 'window'
        })
      });
      
      expect(response.status).toBe(200);
      const result = await response.json();
      expect(result.success).toBe(true);
    });
  });

  describe('Component Functionality', () => {
    test('should create functional Window component', async () => {
      const response = await fetch(`${baseUrl}/test`, {
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create-window',
          title: 'Test Window'
        })
      });
      
      expect(response.status).toBe(200);
      const result = await response.json();
      expect(result.window).toBeDefined();
      expect(result.window.title).toBe('Test Window');
    });

    test('should create functional CodeEditor component', async () => {
      const response = await fetch(`${baseUrl}/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create-code-editor',
          content: 'console.log("test");'
        })
      });
      
      expect(response.status).toBe(200);
      const result = await response.json();
      expect(result.editor).toBeDefined();
      expect(result.content).toBe('console.log("test");');
    });
  });
});