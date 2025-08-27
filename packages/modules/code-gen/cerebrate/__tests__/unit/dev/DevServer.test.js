/**
 * @jest-environment node
 */

import { jest } from '@jest/globals';
import { DevServer } from '../../../src/dev/DevServer.js';

describe('Development Server', () => {
  let devServer;
  
  beforeEach(() => {
    devServer = new DevServer();
    jest.clearAllMocks();
  });
  
  afterEach(async () => {
    if (devServer && devServer.isRunning()) {
      await devServer.stop();
    }
  });

  describe('Server Initialization', () => {
    test('should create dev server with default configuration', () => {
      expect(devServer).toBeDefined();
      expect(devServer.config).toEqual(
        expect.objectContaining({
          port: 3000,
          host: 'localhost',
          hotReload: true,
          watchFiles: true
        })
      );
    });

    test('should accept custom configuration', () => {
      const customServer = new DevServer({
        port: 8080,
        host: '0.0.0.0',
        hotReload: false
      });
      
      expect(customServer.config.port).toBe(8080);
      expect(customServer.config.host).toBe('0.0.0.0');
      expect(customServer.config.hotReload).toBe(false);
    });
  });

  describe('Server Lifecycle', () => {
    test('should start server successfully', async () => {
      const result = await devServer.start();
      
      expect(result.success).toBe(true);
      expect(result.port).toBe(3000);
      expect(result.url).toBe('http://localhost:3000');
      expect(devServer.isRunning()).toBe(true);
    });

    test('should stop server successfully', async () => {
      await devServer.start();
      expect(devServer.isRunning()).toBe(true);
      
      const result = await devServer.stop();
      
      expect(result.success).toBe(true);
      expect(devServer.isRunning()).toBe(false);
    });

    test('should handle start when already running', async () => {
      await devServer.start();
      
      await expect(devServer.start()).rejects.toThrow('Server is already running');
    });

    test('should handle stop when not running', async () => {
      await expect(devServer.stop()).rejects.toThrow('Server is not running');
    });

    test('should find available port when default is taken', async () => {
      const server1 = new DevServer({ port: 3000 });
      const server2 = new DevServer({ port: 3000 });
      
      await server1.start();
      const result = await server2.start();
      
      expect(result.port).not.toBe(3000);
      expect(result.port).toBeGreaterThan(3000);
      
      await server1.stop();
      await server2.stop();
    });
  });

  describe('File Watching', () => {
    test('should set up file watchers when enabled', async () => {
      const watchedFiles = [];
      devServer.onFileChange((file) => {
        watchedFiles.push(file);
      });
      
      await devServer.start();
      
      expect(devServer.isWatchingFiles()).toBe(true);
    });

    test('should not watch files when disabled', async () => {
      const noWatchServer = new DevServer({ watchFiles: false });
      
      await noWatchServer.start();
      
      expect(noWatchServer.isWatchingFiles()).toBe(false);
      
      await noWatchServer.stop();
    });

    test('should detect file changes', async () => {
      const changes = [];
      devServer.onFileChange((file) => {
        changes.push(file);
      });
      
      await devServer.start();
      
      // Simulate file change
      devServer.simulateFileChange('/src/test.js');
      
      expect(changes).toHaveLength(1);
      expect(changes[0]).toEqual(
        expect.objectContaining({
          path: '/src/test.js',
          event: 'change'
        })
      );
    });

    test('should ignore specified file patterns', async () => {
      const server = new DevServer({
        watchIgnore: ['**/*.test.js', '**/node_modules/**']
      });
      
      const changes = [];
      server.onFileChange((file) => {
        changes.push(file);
      });
      
      await server.start();
      
      server.simulateFileChange('/src/app.test.js');
      server.simulateFileChange('/src/app.js');
      
      expect(changes).toHaveLength(1);
      expect(changes[0].path).toBe('/src/app.js');
      
      await server.stop();
    });
  });

  describe('Hot Reload', () => {
    test('should broadcast reload events when files change', async () => {
      const reloadEvents = [];
      devServer.onReload((event) => {
        reloadEvents.push(event);
      });
      
      await devServer.start();
      
      devServer.simulateFileChange('/src/background.js');
      
      // Wait for debounce
      await new Promise(resolve => setTimeout(resolve, 350));
      
      expect(reloadEvents).toHaveLength(1);
      expect(reloadEvents[0]).toEqual(
        expect.objectContaining({
          type: 'file-changed',
          file: '/src/background.js'
        })
      );
    });

    test('should not reload when hot reload is disabled', async () => {
      const server = new DevServer({ hotReload: false });
      const reloadEvents = [];
      server.onReload((event) => {
        reloadEvents.push(event);
      });
      
      await server.start();
      
      server.simulateFileChange('/src/content.js');
      
      expect(reloadEvents).toHaveLength(0);
      
      await server.stop();
    });

    test('should debounce rapid file changes', async () => {
      const reloadEvents = [];
      devServer.onReload((event) => {
        reloadEvents.push(event);
      });
      
      await devServer.start();
      
      // Simulate rapid changes
      devServer.simulateFileChange('/src/app.js');
      devServer.simulateFileChange('/src/app.js');
      devServer.simulateFileChange('/src/app.js');
      
      // Wait for debounce
      await new Promise(resolve => setTimeout(resolve, 350));
      
      expect(reloadEvents).toHaveLength(1);
    });
  });

  describe('Live Reload', () => {
    test('should inject live reload script into HTML', async () => {
      await devServer.start();
      
      const html = '<html><head></head><body></body></html>';
      const injected = devServer.injectLiveReloadScript(html);
      
      expect(injected).toContain('<script');
      expect(injected).toContain('Live reload');
      expect(injected).toContain('</script>');
    });

    test('should not inject script when disabled', async () => {
      const server = new DevServer({ liveReload: false });
      await server.start();
      
      const html = '<html><head></head><body></body></html>';
      const result = server.injectLiveReloadScript(html);
      
      expect(result).toBe(html);
      
      await server.stop();
    });

    test('should handle HTML without head tag', async () => {
      await devServer.start();
      
      const html = '<body>Content</body>';
      const injected = devServer.injectLiveReloadScript(html);
      
      expect(injected).toContain('<script');
      expect(injected).toContain('Live reload');
    });
  });

  describe('Extension Serving', () => {
    test('should serve extension files', async () => {
      await devServer.start();
      
      const response = devServer.handleRequest('/manifest.json');
      
      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toContain('application/json');
    });

    test('should serve with correct MIME types', async () => {
      await devServer.start();
      
      const jsResponse = devServer.handleRequest('/background.js');
      expect(jsResponse.headers['content-type']).toContain('application/javascript');
      
      const cssResponse = devServer.handleRequest('/styles.css');
      expect(cssResponse.headers['content-type']).toContain('text/css');
      
      const htmlResponse = devServer.handleRequest('/popup.html');
      expect(htmlResponse.headers['content-type']).toContain('text/html');
    });

    test('should return 404 for non-existent files', async () => {
      await devServer.start();
      
      const response = devServer.handleRequest('/nonexistent.js');
      
      expect(response.statusCode).toBe(404);
    });

    test('should serve directory index', async () => {
      await devServer.start();
      
      const response = devServer.handleRequest('/');
      
      expect(response.statusCode).toBe(200);
      expect(response.body).toContain('Directory Index');
    });
  });

  describe('WebSocket Communication', () => {
    test('should establish WebSocket connections', async () => {
      await devServer.start();
      
      const mockWs = {
        send: jest.fn(),
        on: jest.fn(),
        readyState: 1 // OPEN
      };
      
      devServer.handleWebSocketConnection(mockWs);
      
      expect(devServer.getActiveConnections()).toBe(1);
    });

    test('should broadcast messages to all clients', async () => {
      await devServer.start();
      
      const mockWs1 = { send: jest.fn(), readyState: 1 };
      const mockWs2 = { send: jest.fn(), readyState: 1 };
      
      devServer.handleWebSocketConnection(mockWs1);
      devServer.handleWebSocketConnection(mockWs2);
      
      devServer.broadcast({ type: 'reload' });
      
      expect(mockWs1.send).toHaveBeenCalledWith(JSON.stringify({ type: 'reload' }));
      expect(mockWs2.send).toHaveBeenCalledWith(JSON.stringify({ type: 'reload' }));
    });

    test('should handle WebSocket disconnections', async () => {
      await devServer.start();
      
      const mockWs = {
        send: jest.fn(),
        on: jest.fn(),
        readyState: 3 // CLOSED
      };
      
      devServer.handleWebSocketConnection(mockWs);
      devServer.handleWebSocketDisconnection(mockWs);
      
      expect(devServer.getActiveConnections()).toBe(0);
    });
  });

  describe('Development Features', () => {
    test('should provide build status endpoint', async () => {
      await devServer.start();
      
      const response = devServer.handleRequest('/_dev/status');
      
      expect(response.statusCode).toBe(200);
      expect(response.body).toContain('running');
      expect(response.body).toContain('files-watched');
    });

    test('should provide file list endpoint', async () => {
      await devServer.start();
      
      const response = devServer.handleRequest('/_dev/files');
      
      expect(response.statusCode).toBe(200);
      const files = JSON.parse(response.body);
      expect(Array.isArray(files)).toBe(true);
    });

    test('should log requests when debug enabled', async () => {
      const server = new DevServer({ debug: true });
      const logs = [];
      
      server.onLog((message) => {
        logs.push(message);
      });
      
      await server.start();
      server.handleRequest('/test.js');
      
      expect(logs.some(log => /GET \/test\.js/.test(log))).toBe(true);
      
      await server.stop();
    });
  });

  describe('Error Handling', () => {
    test('should handle server start errors', async () => {
      // Create server with invalid configuration should throw during construction
      expect(() => {
        new DevServer({ port: -1 });
      }).toThrow('Port must be between 1 and 65535');
    });

    test('should handle file system errors gracefully', async () => {
      await devServer.start();
      
      // Simulate FS error
      const response = devServer.handleRequest('/protected/file.js');
      
      expect(response.statusCode).toBe(403);
    });

    test('should recover from WebSocket errors', async () => {
      await devServer.start();
      
      const mockWs = {
        send: jest.fn().mockImplementation(() => {
          throw new Error('Send failed');
        }),
        readyState: 1
      };
      
      devServer.handleWebSocketConnection(mockWs);
      
      // Should not throw
      expect(() => {
        devServer.broadcast({ type: 'test' });
      }).not.toThrow();
    });
  });

  describe('Configuration Validation', () => {
    test('should validate port range', () => {
      expect(() => {
        new DevServer({ port: 0 });
      }).toThrow('Port must be between 1 and 65535');

      expect(() => {
        new DevServer({ port: 70000 });
      }).toThrow('Port must be between 1 and 65535');
    });

    test('should validate host format', () => {
      expect(() => {
        new DevServer({ host: '' });
      }).toThrow('Host cannot be empty');
    });

    test('should validate watch patterns', () => {
      expect(() => {
        new DevServer({ watchPatterns: 'invalid' });
      }).toThrow('Watch patterns must be an array');
    });
  });
});