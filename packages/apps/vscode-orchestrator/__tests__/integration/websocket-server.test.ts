import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import WebSocket from 'ws';
import { OrchestratorServer } from '../../src/orchestrator-server';
import * as vscode from 'vscode';

describe('WebSocket Server Integration', () => {
  let server: OrchestratorServer;
  let client: WebSocket;
  const TEST_PORT = 17999;

  beforeEach(async () => {
    // Create mock output channel
    const outputChannel = {
      appendLine: () => {},
      clear: () => {},
      dispose: () => {}
    } as any;

    server = new OrchestratorServer(TEST_PORT, outputChannel);
    await server.start();
  });

  afterEach(async () => {
    if (client) {
      client.close();
    }
    await server.stop();
  });

  test('should accept WebSocket connection', (done) => {
    client = new WebSocket(`ws://localhost:${TEST_PORT}`);

    client.on('open', () => {
      expect(client.readyState).toBe(WebSocket.OPEN);
      done();
    });

    client.on('error', (error) => {
      done(error);
    });
  });

  test('should handle unknown command', (done) => {
    client = new WebSocket(`ws://localhost:${TEST_PORT}`);

    client.on('open', () => {
      const command = {
        id: '1',
        cmd: 'unknownCommand',
        args: {}
      };
      client.send(JSON.stringify(command));
    });

    client.on('message', (data) => {
      const response = JSON.parse(data.toString());
      expect(response.id).toBe('1');
      expect(response.ok).toBe(false);
      expect(response.error).toContain('Unknown command');
      expect(response.code).toBe('E_BAD_CMD');
      done();
    });
  });

  test('should execute sleep command', (done) => {
    client = new WebSocket(`ws://localhost:${TEST_PORT}`);

    const startTime = Date.now();

    client.on('open', () => {
      const command = {
        id: '2',
        cmd: 'sleep',
        args: { ms: 100 }
      };
      client.send(JSON.stringify(command));
    });

    client.on('message', (data) => {
      const response = JSON.parse(data.toString());
      const elapsed = Date.now() - startTime;

      expect(response.id).toBe('2');
      expect(response.ok).toBe(true);
      expect(elapsed).toBeGreaterThanOrEqual(90); // Allow 10ms tolerance
      done();
    });
  });

  test('should handle multiple commands sequentially', (done) => {
    client = new WebSocket(`ws://localhost:${TEST_PORT}`);
    let responseCount = 0;

    client.on('open', () => {
      // Send two sleep commands
      client.send(JSON.stringify({ id: '3', cmd: 'sleep', args: { ms: 50 } }));
      client.send(JSON.stringify({ id: '4', cmd: 'sleep', args: { ms: 50 } }));
    });

    client.on('message', (data) => {
      const response = JSON.parse(data.toString());
      responseCount++;

      expect(response.ok).toBe(true);
      expect(['3', '4']).toContain(response.id);

      if (responseCount === 2) {
        done();
      }
    });
  });

  test('should handle batch command', (done) => {
    client = new WebSocket(`ws://localhost:${TEST_PORT}`);

    client.on('open', () => {
      const command = {
        id: '5',
        cmd: 'batch',
        args: {
          ops: [
            { cmd: 'sleep', args: { ms: 50 } },
            { cmd: 'sleep', args: { ms: 50 } }
          ]
        }
      };
      client.send(JSON.stringify(command));
    });

    client.on('message', (data) => {
      const response = JSON.parse(data.toString());

      expect(response.id).toBe('5');
      expect(response.ok).toBe(true);
      expect(response.data).toHaveProperty('results');
      expect(response.data.results).toHaveLength(2);
      done();
    });
  });

  test('should handle malformed JSON', (done) => {
    client = new WebSocket(`ws://localhost:${TEST_PORT}`);

    client.on('open', () => {
      client.send('{ invalid json }');
    });

    client.on('message', (data) => {
      const response = JSON.parse(data.toString());

      expect(response.ok).toBe(false);
      expect(response.error).toBeTruthy();
      expect(response.code).toBe('E_PARSE_ERROR');
      done();
    });
  });

  test('should handle connection close gracefully', (done) => {
    client = new WebSocket(`ws://localhost:${TEST_PORT}`);

    client.on('open', () => {
      client.close();
    });

    client.on('close', () => {
      // Should close without errors
      done();
    });
  });
});
