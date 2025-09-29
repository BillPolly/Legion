/**
 * Simple unit tests for Agent Injection functionality without complex mocking
 */

import { jest } from '@jest/globals';
import { FullStackMonitor } from '../../src/FullStackMonitor.js';
import { ResourceManager } from '@legion/resource-manager';
import path from 'path';

describe('Agent Injection Simple Tests', () => {
  let monitor;
  let resourceManager;

  beforeEach(async () => {
    resourceManager = await ResourceManager.getInstance();
    
    // Create monitor without starting WebSocket server to speed up tests
    monitor = new FullStackMonitor({
      resourceManager,
      logStore: { getCurrentSession: () => ({ id: 'test' }) },
      session: { id: 'test-session' },
      wsAgentPort: 9901
    });
  });

  describe('Helper Methods', () => {
    test('getSidewinderAgentPath should return correct path', () => {
      const agentPath = monitor.getSidewinderAgentPath();
      expect(agentPath).toContain('sidewinder-agent.cjs');
      expect(path.isAbsolute(agentPath)).toBe(true);
    });

    test('buildNodeCommand should build correct command', () => {
      const command = monitor.buildNodeCommand('app.js');
      expect(command).toContain('node');
      expect(command).toContain('--require');
      expect(command).toContain('sidewinder-agent.cjs');
      expect(command).toContain('app.js');
    });

    test('buildNodeCommand should handle npm commands', () => {
      const command = monitor.buildNodeCommand('npm start');
      expect(command).toContain('NODE_OPTIONS=');
      expect(command).toContain('--require');
      expect(command).toContain('npm start');
    });

    test('buildNodeCommand should handle TypeScript files', () => {
      const command = monitor.buildNodeCommand('app.ts');
      expect(command).toContain('ts-node/register');
      expect(command).toContain('app.ts');
    });

    test('getSidewinderEnv should return environment variables', () => {
      const env = monitor.getSidewinderEnv();
      
      expect(env).toHaveProperty('SIDEWINDER_WS_PORT', '9901');
      expect(env).toHaveProperty('SIDEWINDER_WS_HOST', 'localhost');
      expect(env).toHaveProperty('SIDEWINDER_SESSION_ID');
    });

    test('getSidewinderEnv should use default values', () => {
      const env = monitor.getSidewinderEnv({ port: 9999 });
      expect(env.SIDEWINDER_WS_PORT).toBe('9901'); // Should use monitor's port
    });

    test('getBrowserAgentScript should return script content', () => {
      const script = monitor.getBrowserAgentScript();
      expect(script).toContain('9901');
      expect(typeof script).toBe('string');
    });

    test('getBrowserAgentScript should handle options', () => {
      const script = monitor.getBrowserAgentScript({
        wsUrl: 'ws://custom.host:9999/browser',
        sessionId: 'custom-session-123'
      });
      // Just verify it returns a string
      expect(typeof script).toBe('string');
      expect(script.length).toBeGreaterThan(0);
    });

    test('injectBrowserAgentIntoHTML should inject before closing body', () => {
      const html = '<html><body><h1>Test</h1></body></html>';
      const injected = monitor.injectBrowserAgentIntoHTML(html);
      
      expect(injected).toContain('<script>');
      expect(injected).toContain('</script>');
      const scriptIndex = injected.indexOf('<script>');
      const bodyCloseIndex = injected.indexOf('</body>');
      expect(scriptIndex).toBeLessThan(bodyCloseIndex);
    });

    test('injectBrowserAgentIntoHTML should append if no body tag', () => {
      const html = '<html><h1>Test</h1></html>';
      const injected = monitor.injectBrowserAgentIntoHTML(html);
      
      expect(injected).toContain('<script>');
      expect(injected).toContain('</script>');
      expect(injected.endsWith('</script>\n')).toBe(true);
    });
  });

  describe('Browser Agent Injection', () => {
    test('should prepare browser agent configuration', async () => {
      const mockPage = {
        evaluateOnNewDocument: jest.fn()
      };

      await monitor.injectBrowserAgent(mockPage);

      expect(mockPage.evaluateOnNewDocument).toHaveBeenCalled();
      const injectedScript = mockPage.evaluateOnNewDocument.mock.calls[0][0];
      
      expect(injectedScript).toContain('window.__BROWSER_AGENT_PORT__');
      expect(injectedScript).toContain('window.__BROWSER_AGENT_HOST__');
      expect(injectedScript).toContain('window.__BROWSER_AGENT_SESSION__');
    });

    test('should use custom browser agent configuration', async () => {
      const mockPage = {
        evaluateOnNewDocument: jest.fn()
      };

      await monitor.injectBrowserAgent(mockPage, {
        wsAgentPort: '9999',
        wsHost: 'remote.host',
        sessionId: 'custom-session',
        pageId: 'page-123',
        trackInteractions: true,
        trackMutations: true
      });

      const injectedScript = mockPage.evaluateOnNewDocument.mock.calls[0][0];
      
      expect(injectedScript).toContain("'9999'");
      expect(injectedScript).toContain("'remote.host'");
      expect(injectedScript).toContain("'custom-session'");
      expect(injectedScript).toContain("'page-123'");
      expect(injectedScript).toContain('true');
    });
  });

  describe('getInjectionHelp', () => {
    test('should return help documentation', () => {
      const help = monitor.getInjectionHelp();
      
      expect(help).toContain('SIDEWINDER AGENT');
      expect(help).toContain('BROWSER AGENT');
      expect(help).toContain('EXAMPLES');
      expect(help).toContain('ENVIRONMENT VARIABLES');
    });
  });
});