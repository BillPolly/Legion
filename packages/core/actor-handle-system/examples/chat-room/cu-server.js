#!/usr/bin/env node
/**
 * Computer Use Server - Persistent actor with HTTP API
 */

import { ResourceManager } from '@legion/resource-manager';
import { ComputerUseActor } from '@legion/computer-use';
import http from 'http';
import { writeFileSync } from 'fs';

const PORT = 9876;
const PID_FILE = '/tmp/cu-server.pid';

let actor = null;
let actorInitialized = false;

const server = http.createServer(async (req, res) => {
  if (req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const { command, args } = JSON.parse(body);

        const result = await handleCommand(command, args);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, result }));
      } catch (error) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: error.message, stack: error.stack }));
      }
    });
  } else {
    res.writeHead(404);
    res.end();
  }
});

async function handleCommand(command, args) {
  if (!actor) {
    const rm = await ResourceManager.getInstance();
    actor = new ComputerUseActor(rm);
  }

  switch (command) {
    case 'init':
      const initResult = await actor.receive('init', args);
      actorInitialized = true;
      return initResult;

    case 'screenshot':
      return await actor.receive('screenshot', args);

    case 'ask':
      return await actor.receive('single-turn', args);

    case 'state':
      return await actor.receive('get-state');

    case 'puppeteer':
      return await actor.receive('puppeteer', args);

    case 'cleanup':
      const result = await actor.receive('cleanup');
      actorInitialized = false;
      return result;

    case 'status':
      return { initialized: actorInitialized, pid: process.pid };

    default:
      throw new Error(`Unknown command: ${command}`);
  }
}

server.listen(PORT, () => {
  writeFileSync(PID_FILE, String(process.pid));
  console.log(`Computer Use Server running on port ${PORT}`);
  console.log(`PID: ${process.pid}`);
});

process.on('SIGINT', () => {
  console.log('\nShutting down...');
  server.close();
  process.exit(0);
});
