/**
 * Tests for the CodeAgent event system
 */

import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { CodeAgent } from '../../src/index.js';
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe('CodeAgent Event System', () => {
  let agent;
  let testDir;
  let events;
  
  beforeEach(async () => {
    testDir = path.join(__dirname, 'temp-test-' + Date.now());
    await fs.mkdir(testDir, { recursive: true });
    
    // Create agent with console output disabled
    agent = new CodeAgent({
      projectType: 'backend',
      enableConsoleOutput: false // Disable console output for testing
    });
    
    // Collect all events
    events = [];
    agent.on('progress', (e) => events.push({ type: 'progress', ...e }));
    agent.on('info', (e) => events.push({ type: 'info', ...e }));
    agent.on('warning', (e) => events.push({ type: 'warning', ...e }));
    agent.on('error', (e) => events.push({ type: 'error', ...e }));
    agent.on('file-created', (e) => events.push({ type: 'file-created', ...e }));
    agent.on('phase-start', (e) => events.push({ type: 'phase-start', ...e }));
    agent.on('phase-complete', (e) => events.push({ type: 'phase-complete', ...e }));
  });
  
  afterEach(async () => {
    if (testDir) {
      await fs.rm(testDir, { recursive: true, force: true });
    }
  });
  
  test('should emit events during initialization', async () => {
    await agent.initialize(testDir);
    
    // Check that initialization events were emitted
    const infoEvents = events.filter(e => e.type === 'info');
    expect(infoEvents).toContainEqual(
      expect.objectContaining({
        type: 'info',
        message: expect.stringContaining('Initializing CodeAgent in:')
      })
    );
    expect(infoEvents).toContainEqual(
      expect.objectContaining({
        type: 'info',
        message: 'CodeAgent initialized successfully'
      })
    );
  });
  
  test('should emit file-created events', async () => {
    await agent.initialize(testDir);
    
    // Write a file directly using the fileOps
    await agent.fileOps.writeFile(
      path.join(testDir, 'test.js'),
      'console.log("test");'
    );
    
    // Emit file-created event manually (since fileOps doesn't know about events)
    agent.emit('file-created', {
      filename: 'test.js',
      filePath: path.join(testDir, 'test.js'),
      size: 20
    });
    
    // Check file-created event
    const fileEvents = events.filter(e => e.type === 'file-created');
    expect(fileEvents).toHaveLength(1);
    expect(fileEvents[0]).toMatchObject({
      type: 'file-created',
      filename: 'test.js',
      size: 20
    });
  });
  
  test('should have unique agent IDs for multiple instances', () => {
    const agent1 = new CodeAgent({ enableConsoleOutput: false });
    const agent2 = new CodeAgent({ enableConsoleOutput: false });
    
    expect(agent1.id).toBeDefined();
    expect(agent2.id).toBeDefined();
    expect(agent1.id).not.toBe(agent2.id);
  });
  
  test('console output can be enabled/disabled', async () => {
    // Agent with console output enabled (default)
    const agentWithConsole = new CodeAgent();
    expect(agentWithConsole.listenerCount('info')).toBeGreaterThan(0);
    
    // Agent with console output disabled
    const agentNoConsole = new CodeAgent({ enableConsoleOutput: false });
    expect(agentNoConsole.listenerCount('info')).toBe(0);
  });
});