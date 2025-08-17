/**
 * Unit tests for HTML template generation
 */

import { generateHTML, getTemplateVariables } from '../../htmlTemplate.js';

describe('HTML Template Generation', () => {
  describe('generateHTML', () => {
    it('should generate HTML with all required elements', () => {
      const html = generateHTML({
        title: 'Test App',
        clientActorPath: '/test/client.js',
        wsEndpoint: 'ws://localhost:8080/ws',
        route: '/test'
      });

      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('<html>');
      expect(html).toContain('<head>');
      expect(html).toContain('<title>Test App</title>');
      expect(html).toContain('<body>');
      expect(html).toContain('<div id="app"></div>');
      expect(html).toContain('</html>');
    });

    it('should inject client actor path correctly', () => {
      const html = generateHTML({
        title: 'Test',
        clientActorPath: '/tools/client.js',
        wsEndpoint: 'ws://localhost:8080/ws',
        route: '/tools'
      });

      expect(html).toContain("import ClientActor from '/tools/client.js'");
    });

    it('should inject WebSocket endpoint correctly', () => {
      const html = generateHTML({
        title: 'Test',
        clientActorPath: '/test/client.js',
        wsEndpoint: 'ws://localhost:9090/ws',
        route: '/test'
      });

      expect(html).toContain("const ws = new WebSocket('ws://localhost:9090/ws')");
    });

    it('should inject route correctly in handshake', () => {
      const html = generateHTML({
        title: 'Test',
        clientActorPath: '/test/client.js',
        wsEndpoint: 'ws://localhost:8080/ws',
        route: '/database'
      });

      expect(html).toContain("route: '/database'");
    });

    it('should include ActorSpace import', () => {
      const html = generateHTML({
        title: 'Test',
        clientActorPath: '/test/client.js',
        wsEndpoint: 'ws://localhost:8080/ws',
        route: '/test'
      });

      expect(html).toContain("import { ActorSpace } from '/legion/actors/ActorSpace.js'");
    });

    it('should include WebSocket connection setup', () => {
      const html = generateHTML({
        title: 'Test',
        clientActorPath: '/test/client.js',
        wsEndpoint: 'ws://localhost:8080/ws',
        route: '/test'
      });

      expect(html).toContain('ws.onopen');
      expect(html).toContain('ws.onmessage');
      expect(html).toContain('ws.onerror');
    });

    it('should include actor handshake logic', () => {
      const html = generateHTML({
        title: 'Test',
        clientActorPath: '/test/client.js',
        wsEndpoint: 'ws://localhost:8080/ws',
        route: '/test'
      });

      expect(html).toContain("type: 'actor_handshake'");
      expect(html).toContain("clientRootActor: 'client-root'");
      expect(html).toContain("type === 'actor_handshake_ack'");
    });

    it('should create client actor instance', () => {
      const html = generateHTML({
        title: 'Test',
        clientActorPath: '/test/client.js',
        wsEndpoint: 'ws://localhost:8080/ws',
        route: '/test'
      });

      expect(html).toContain('const clientActor = new ClientActor()');
      expect(html).toContain("actorSpace.register(clientActor, 'client-root')");
    });

    it('should handle remote actor setup', () => {
      const html = generateHTML({
        title: 'Test',
        clientActorPath: '/test/client.js',
        wsEndpoint: 'ws://localhost:8080/ws',
        route: '/test'
      });

      expect(html).toContain('channel.makeRemote(message.serverRootActor)');
      expect(html).toContain('clientActor.setRemoteActor(remoteActor)');
    });

    it('should be a valid ES module script', () => {
      const html = generateHTML({
        title: 'Test',
        clientActorPath: '/test/client.js',
        wsEndpoint: 'ws://localhost:8080/ws',
        route: '/test'
      });

      expect(html).toContain('<script type="module">');
    });
  });

  describe('getTemplateVariables', () => {
    it('should extract required variables from options', () => {
      const vars = getTemplateVariables({
        title: 'My App',
        clientActorPath: '/app/client.js',
        wsEndpoint: 'ws://localhost:3000/ws',
        route: '/app'
      });

      expect(vars.title).toBe('My App');
      expect(vars.clientActorPath).toBe('/app/client.js');
      expect(vars.wsEndpoint).toBe('ws://localhost:3000/ws');
      expect(vars.route).toBe('/app');
    });

    it('should provide default title if not specified', () => {
      const vars = getTemplateVariables({
        clientActorPath: '/app/client.js',
        wsEndpoint: 'ws://localhost:3000/ws',
        route: '/app'
      });

      expect(vars.title).toBe('Legion App');
    });

    it('should throw error if clientActorPath is missing', () => {
      expect(() => {
        getTemplateVariables({
          wsEndpoint: 'ws://localhost:3000/ws',
          route: '/app'
        });
      }).toThrow('clientActorPath is required');
    });

    it('should throw error if wsEndpoint is missing', () => {
      expect(() => {
        getTemplateVariables({
          clientActorPath: '/app/client.js',
          route: '/app'
        });
      }).toThrow('wsEndpoint is required');
    });

    it('should throw error if route is missing', () => {
      expect(() => {
        getTemplateVariables({
          clientActorPath: '/app/client.js',
          wsEndpoint: 'ws://localhost:3000/ws'
        });
      }).toThrow('route is required');
    });
  });
});