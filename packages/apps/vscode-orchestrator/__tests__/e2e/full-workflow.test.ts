import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import WebSocket from 'ws';
import { OrchestratorServer } from '../../src/orchestrator-server';
import * as vscode from 'vscode';

describe('E2E Full Workflow', () => {
  let server: OrchestratorServer;
  let client: WebSocket;
  const TEST_PORT = 17888;
  let messageId = 0;

  beforeAll(async () => {
    // Set up mock workspace
    (vscode as any).setWorkspaceFolder('/tmp/test-workspace');

    const outputChannel = {
      appendLine: () => {},
      clear: () => {},
      dispose: () => {}
    } as any;

    server = new OrchestratorServer(TEST_PORT, outputChannel);
    await server.start();

    // Connect client
    client = new WebSocket(`ws://localhost:${TEST_PORT}`);
    await new Promise((resolve) => {
      client.on('open', resolve);
    });
  });

  afterAll(async () => {
    if (client) {
      client.close();
    }
    await server.stop();
  });

  function sendCommand(cmd: string, args: any): Promise<any> {
    return new Promise((resolve, reject) => {
      const id = String(++messageId);
      const message = { id, cmd, args };

      const timeout = setTimeout(() => {
        reject(new Error(`Command timeout: ${cmd}`));
      }, 5000);

      const handler = (data: Buffer) => {
        const response = JSON.parse(data.toString());
        if (response.id === id) {
          clearTimeout(timeout);
          client.off('message', handler);
          if (response.ok) {
            resolve(response.data);
          } else {
            reject(new Error(response.error));
          }
        }
      };

      client.on('message', handler);
      client.send(JSON.stringify(message));
    });
  }

  test('should complete full demo workflow', async () => {
    // Step 1: Open a new file
    const openResult = await sendCommand('open', {
      file: 'demo.js',
      create: true,
      column: 1
    });
    expect(openResult).toBeDefined();

    // Step 2: Type text with animation
    const typeResult = await sendCommand('type', {
      text: 'console.log("Hello");',
      cps: 80
    });
    expect(typeResult).toHaveProperty('chars');
    expect(typeResult).toHaveProperty('cps');

    // Step 3: Save the file
    const saveResult = await sendCommand('save', {});
    expect(saveResult).toHaveProperty('saved');

    // Step 4: Replace all content
    const replaceResult = await sendCommand('replaceAll', {
      text: 'console.log("Updated");'
    });
    expect(replaceResult).toHaveProperty('length');

    // Step 5: Set cursor position
    const cursorResult = await sendCommand('setCursor', {
      line: 0,
      ch: 7
    });
    expect(cursorResult).toHaveProperty('line', 0);
    expect(cursorResult).toHaveProperty('ch', 7);
  }, 30000);

  test('should handle batch operations', async () => {
    const batchResult = await sendCommand('batch', {
      ops: [
        { cmd: 'open', args: { file: 'batch-test.txt', create: true } },
        { cmd: 'type', args: { text: 'Line 1\n', cps: 120 } },
        { cmd: 'type', args: { text: 'Line 2\n', cps: 120 } },
        { cmd: 'save', args: {} }
      ]
    });

    expect(batchResult).toHaveProperty('operations', 4);
    expect(batchResult.results).toHaveLength(4);
    expect(batchResult.results.every((r: any) => r.ok)).toBe(true);
  }, 30000);

  test('should handle chunked insert', async () => {
    await sendCommand('open', {
      file: 'large-file.js',
      create: true,
      column: 1
    });

    const largeText = Array(500).fill('test').join('\n');
    const chunkResult = await sendCommand('chunkedInsert', {
      text: largeText,
      chunkSize: 200,
      intervalMs: 10
    });

    expect(chunkResult).toHaveProperty('chars');
    expect(chunkResult).toHaveProperty('chunks');
    expect(chunkResult.chars).toBeGreaterThan(0);
  }, 30000);

  test('should handle cursor and reveal operations', async () => {
    await sendCommand('open', {
      file: 'cursor-test.txt',
      create: true,
      column: 1
    });

    await sendCommand('type', {
      text: Array(50).fill('Line\n').join(''),
      cps: 200
    });

    // Set cursor to line 30
    await sendCommand('setCursor', {
      line: 30,
      ch: 0
    });

    // Reveal that line
    const revealResult = await sendCommand('reveal', {
      line: 30,
      ch: 0
    });
    expect(revealResult).toBeDefined();

    // Highlight a range
    const highlightResult = await sendCommand('highlight', {
      start: { line: 25, ch: 0 },
      end: { line: 35, ch: 4 },
      ms: 100
    });
    expect(highlightResult).toBeDefined();
  }, 30000);

  test('should handle multiple files in columns', async () => {
    // Open file in column 1
    await sendCommand('open', {
      file: 'col1.js',
      create: true,
      column: 1
    });

    await sendCommand('type', {
      text: 'const x = 1;',
      cps: 100
    });

    // Open file in column 2
    await sendCommand('open', {
      file: 'col2.js',
      create: true,
      column: 2
    });

    await sendCommand('type', {
      text: 'const y = 2;',
      cps: 100
    });

    const saveResult = await sendCommand('save', {});
    expect(saveResult).toHaveProperty('saved');
  }, 30000);

  test('should handle concurrent commands', async () => {
    // Send multiple sleep commands in parallel
    const promises = [
      sendCommand('sleep', { ms: 100 }),
      sendCommand('sleep', { ms: 100 }),
      sendCommand('sleep', { ms: 100 })
    ];

    const results = await Promise.all(promises);
    expect(results).toHaveLength(3);
    results.forEach(result => {
      expect(result).toHaveProperty('slept', 100);
    });
  }, 30000);

  test('should handle error recovery', async () => {
    // Try to execute unknown command
    try {
      await sendCommand('unknownCommand', {});
      fail('Should have thrown error');
    } catch (error) {
      expect(error).toBeDefined();
      expect((error as Error).message).toContain('Unknown command');
    }

    // Verify connection is still working
    const result = await sendCommand('sleep', { ms: 10 });
    expect(result).toHaveProperty('slept', 10);
  });

  test('should handle openUrl command', async () => {
    const urlResult = await sendCommand('openUrl', {
      url: 'https://example.com',
      column: 2
    });

    expect(urlResult).toHaveProperty('url', 'https://example.com');
    expect(urlResult).toHaveProperty('column', 2);
  });
});
