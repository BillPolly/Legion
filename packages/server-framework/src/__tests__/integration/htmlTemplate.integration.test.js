/**
 * Integration tests for HTML template generation
 * Tests the complete HTML generation with real template
 */

import { generateHTML } from '../../htmlTemplate.js';
import { JSDOM } from 'jsdom';

describe('HTML Template Integration Tests', () => {
  describe('Complete HTML generation', () => {
    let dom;
    let document;
    let window;

    beforeEach(() => {
      const html = generateHTML({
        title: 'Integration Test App',
        clientActorPath: '/integration/client.js',
        wsEndpoint: 'ws://localhost:8888/ws',
        route: '/integration'
      });

      // Parse HTML with JSDOM for testing
      dom = new JSDOM(html, {
        runScripts: 'outside-only',
        pretendToBeVisual: true
      });
      document = dom.window.document;
      window = dom.window;
    });

    afterEach(() => {
      if (dom) {
        dom.window.close();
      }
    });

    it('should generate valid HTML document', () => {
      expect(document.doctype).toBeDefined();
      expect(document.documentElement.tagName).toBe('HTML');
      expect(document.head).toBeDefined();
      expect(document.body).toBeDefined();
    });

    it('should set correct page title', () => {
      expect(document.title).toBe('Integration Test App');
    });

    it('should include app container div', () => {
      const appDiv = document.getElementById('app');
      expect(appDiv).toBeDefined();
      expect(appDiv.tagName).toBe('DIV');
    });

    it('should have module script tag', () => {
      const scripts = document.querySelectorAll('script[type="module"]');
      expect(scripts.length).toBeGreaterThan(0);
    });

    it('should include all required JavaScript in script', () => {
      const scriptContent = document.querySelector('script[type="module"]').textContent;

      // Check imports
      expect(scriptContent).toContain("import ClientActor from '/integration/client.js'");
      expect(scriptContent).toContain("import { ActorSpace } from '@legion/actors'");

      // Check WebSocket setup (includes route parameter in new protocol)
      expect(scriptContent).toContain("new WebSocket('ws://localhost:8888/ws?route=/integration')");
      
      // Check actor creation
      expect(scriptContent).toContain("new ClientActor()");
      expect(scriptContent).toContain("new ActorSpace('client')");

      // Check new protocol (server sends first)
      expect(scriptContent).toContain("messageType === 'session-ready'");
      expect(scriptContent).toContain("actorSpace.addChannel(ws)");
    });

    it('should structure WebSocket event handlers correctly', () => {
      const scriptContent = document.querySelector('script[type="module"]').textContent;

      // Check event handlers (no ws.onmessage in new protocol - Channel handles it)
      expect(scriptContent).toContain('ws.onopen');
      expect(scriptContent).toContain('ws.onerror');
      expect(scriptContent).toContain('ws.onclose');
    });

    it('should handle different routes correctly', () => {
      const html1 = generateHTML({
        title: 'Tools',
        clientActorPath: '/tools/client.js',
        wsEndpoint: 'ws://localhost:8090/ws',
        route: '/tools'
      });

      const html2 = generateHTML({
        title: 'Database',
        clientActorPath: '/database/client.js',
        wsEndpoint: 'ws://localhost:8080/ws',
        route: '/database'
      });

      // Route is in query parameter now
      expect(html1).toContain("?route=/tools");
      expect(html1).toContain("/tools/client.js");
      expect(html1).toContain("8090");

      expect(html2).toContain("?route=/database");
      expect(html2).toContain("/database/client.js");
      expect(html2).toContain("8080");
    });

    it('should escape special characters in template variables', () => {
      const html = generateHTML({
        title: 'Test <script>alert("xss")</script>',
        clientActorPath: '/test/client.js',
        wsEndpoint: 'ws://localhost:8080/ws',
        route: '/test'
      });

      // Title should be escaped in HTML
      expect(html).not.toContain('<script>alert("xss")</script>');
      expect(html).toContain('&lt;script&gt;');
    });

    it('should maintain consistent actor naming', () => {
      const scriptContent = document.querySelector('script[type="module"]').textContent;

      // Client actor should always be 'client-root'
      expect(scriptContent).toContain("actorSpace.register(clientActor, 'client-root')");
    });

    it('should include error handling setup', () => {
      const scriptContent = document.querySelector('script[type="module"]').textContent;
      
      expect(scriptContent).toContain('ws.onerror = (error)');
      expect(scriptContent).toContain('console.error');
    });

    it('should include connection close handling', () => {
      const scriptContent = document.querySelector('script[type="module"]').textContent;
      
      expect(scriptContent).toContain('ws.onclose = ()');
      expect(scriptContent).toContain('console.log');
    });
  });

  describe('Template consistency', () => {
    it('should generate consistent HTML structure across multiple calls', () => {
      const options = {
        title: 'Consistent App',
        clientActorPath: '/app/client.js',
        wsEndpoint: 'ws://localhost:8080/ws',
        route: '/app'
      };

      const html1 = generateHTML(options);
      const html2 = generateHTML(options);

      expect(html1).toBe(html2);
    });

    it('should handle missing optional parameters gracefully', () => {
      // Title is optional, should use default
      const html = generateHTML({
        clientActorPath: '/app/client.js',
        wsEndpoint: 'ws://localhost:8080/ws',
        route: '/app'
      });

      expect(html).toContain('<title>Legion App</title>');
    });
  });
});