/**
 * Simple unit tests for ScriptAnalyzer without complex mocking
 */

import { jest } from '@jest/globals';
import { ScriptAnalyzer } from '../../src/ScriptAnalyzer.js';
import path from 'path';
import os from 'os';

describe('ScriptAnalyzer Simple Tests', () => {
  let analyzer;

  beforeEach(() => {
    analyzer = new ScriptAnalyzer();
  });

  describe('Constructor', () => {
    test('should initialize with default agent path', () => {
      const analyzer = new ScriptAnalyzer();
      expect(analyzer.agentPath).toContain('sidewinder-agent.cjs');
    });

    test('should accept custom agent path', () => {
      const customPath = '/custom/agent.js';
      const analyzer = new ScriptAnalyzer({ agentPath: customPath });
      expect(analyzer.agentPath).toBe(customPath);
    });
  });

  describe('parseStartScript()', () => {
    test('should parse simple node command', () => {
      const result = analyzer.parseStartScript('node server.js');
      
      expect(result.isSimpleNode).toBe(true);
      expect(result.entryFile).toBe('server.js');
    });

    test('should detect ts-node', () => {
      const result = analyzer.parseStartScript('ts-node src/index.ts');
      
      expect(result.usesTsNode).toBe(true);
      expect(result.entryFile).toBe('src/index.ts');
    });

    test('should detect nodemon', () => {
      const result = analyzer.parseStartScript('nodemon app.js');
      
      expect(result.usesNodemon).toBe(true);
      expect(result.entryFile).toBe('app.js');
    });

    test('should detect webpack', () => {
      const result = analyzer.parseStartScript('webpack-dev-server');
      
      expect(result.usesWebpack).toBe(true);
      expect(result.buildTool).toBe('webpack');
    });

    test('should detect vite', () => {
      const result = analyzer.parseStartScript('vite');
      
      expect(result.usesVite).toBe(true);
      expect(result.buildTool).toBe('vite');
    });

    test('should detect parcel', () => {
      const result = analyzer.parseStartScript('parcel index.html');
      
      expect(result.usesParcel).toBe(true);
      expect(result.buildTool).toBe('parcel');
    });
  });

  describe('buildEnvironment()', () => {
    test('should build default environment', () => {
      const env = analyzer.buildEnvironment({});
      
      expect(env.SIDEWINDER_SESSION_ID).toBe('default');
      expect(env.SIDEWINDER_WS_PORT).toBe('9901');
      expect(env.SIDEWINDER_WS_HOST).toBe('localhost');
      expect(env.SIDEWINDER_DEBUG).toBe('false');
    });

    test('should use provided options', () => {
      const env = analyzer.buildEnvironment({
        sessionId: 'test-session',
        wsAgentPort: '9999',
        wsHost: 'remote.host',
        debug: true
      });
      
      expect(env.SIDEWINDER_SESSION_ID).toBe('test-session');
      expect(env.SIDEWINDER_WS_PORT).toBe('9999');
      expect(env.SIDEWINDER_WS_HOST).toBe('remote.host');
      expect(env.SIDEWINDER_DEBUG).toBe('true');
    });
  });

  describe('detectFramework()', () => {
    test('should detect Express', async () => {
      const packageJson = {
        dependencies: { express: '^4.18.0' }
      };
      
      const framework = await analyzer.detectFramework(packageJson);
      expect(framework).toBe('express');
    });

    test('should detect Next.js', async () => {
      const packageJson = {
        dependencies: { next: '^13.0.0' }
      };
      
      const framework = await analyzer.detectFramework(packageJson);
      expect(framework).toBe('nextjs');
    });

    test('should detect React', async () => {
      const packageJson = {
        dependencies: { react: '^18.0.0' }
      };
      
      const framework = await analyzer.detectFramework(packageJson);
      expect(framework).toBe('react');
    });

    test('should return null for unknown framework', async () => {
      const packageJson = {
        dependencies: { somelib: '^1.0.0' }
      };
      
      const framework = await analyzer.detectFramework(packageJson);
      expect(framework).toBeNull();
    });
  });

  describe('buildNodeStrategy', () => {
    test('should build correct Node.js strategy', () => {
      const result = analyzer.buildNodeStrategy('/test/app.js', '/test', {});
      
      expect(result.type).toBe('node');
      expect(result.command).toBe('node');
      expect(result.args).toContain('--require');
      expect(result.args).toContain('/test/app.js');
      expect(result.metadata.hasTypeScript).toBe(false);
    });
  });

  describe('buildTypeScriptStrategy', () => {
    test('should build correct TypeScript strategy', () => {
      const result = analyzer.buildTypeScriptStrategy('/test/app.ts', '/test', {});
      
      expect(result.type).toBe('ts-node');
      expect(result.command).toBe('npx');
      expect(result.args).toContain('ts-node');
      expect(result.args).toContain('/test/app.ts');
      expect(result.metadata.hasTypeScript).toBe(true);
    });
  });

  describe('buildPythonStrategy', () => {
    test('should build correct Python strategy', () => {
      const result = analyzer.buildPythonStrategy('/test/app.py', '/test', {});
      
      expect(result.type).toBe('python');
      expect(result.command).toBe('python');
      expect(result.args).toContain('/test/app.py');
      expect(result.requiresAgent).toBe(false);
      expect(result.metadata.language).toBe('python');
    });
  });
});