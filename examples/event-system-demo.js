#!/usr/bin/env node

/**
 * Event System Demonstration
 * 
 * This example shows how to use the jsEnvoy event system to monitor
 * tool execution in real-time. It demonstrates:
 * 
 * 1. Module event listeners
 * 2. Agent event relay
 * 3. WebSocket event streaming
 * 4. Event filtering and handling
 */

import { Agent } from '@jsenvoy/agent';
import { AgentWebSocketServer } from '@jsenvoy/agent/src/websocket-server.js';
import CalculatorModule from '@jsenvoy/general-tools/src/calculator/CalculatorModule.js';
import { JsonModule } from '@jsenvoy/general-tools/src/json/JsonModule.js';
import { FileModule } from '@jsenvoy/general-tools/src/file/FileModule.js';
import WebSocket from 'ws';

// Configuration
const PORT = 3005;
const DEMO_MODE = process.argv[2] || 'local'; // 'local' or 'websocket'

/**
 * Demonstrate local event monitoring
 */
async function demonstrateLocalEvents() {
  console.log('\n=== Local Event Monitoring Demo ===\n');

  // Create agent
  const agent = new Agent({
    name: 'EventDemoAgent',
    bio: 'Demonstrates event system capabilities',
    modelConfig: {
      provider: 'openai',
      model: 'gpt-3.5-turbo',
      apiKey: process.env.OPENAI_API_KEY || 'demo-key'
    }
  });

  // Create and register modules
  const calculator = new CalculatorModule();
  const jsonModule = new JsonModule();
  const fileModule = new FileModule();

  // Add event listeners to individual modules
  calculator.on('event', (event) => {
    console.log(`[Calculator Event] ${event.type}: ${event.message}`);
  });

  jsonModule.on('event', (event) => {
    console.log(`[JSON Event] ${event.type}: ${event.message}`);
    if (event.data) {
      console.log('  Data:', JSON.stringify(event.data, null, 2));
    }
  });

  fileModule.on('event', (event) => {
    console.log(`[File Event] ${event.type}: ${event.message}`);
  });

  // Register modules with agent
  agent.registerModule(calculator);
  agent.registerModule(jsonModule);
  agent.registerModule(fileModule);

  // Listen to all module events at agent level
  agent.on('module-event', (event) => {
    console.log(`\n[Agent Relay] ${event.type.toUpperCase()} from ${event.module}${event.tool ? `/${event.tool}` : ''}`);
    console.log(`  Message: ${event.message}`);
    console.log(`  Agent: ${event.agentName} (${event.agentId})`);
    console.log(`  Level: ${event.level}`);
    if (event.data) {
      console.log(`  Data:`, event.data);
    }
    console.log('');
  });

  // Demonstrate calculator events
  console.log('\n--- Testing Calculator Tool ---');
  const calcTool = calculator.tools[0];
  await calcTool.invoke({
    function: {
      name: 'calculator_evaluate',
      arguments: JSON.stringify({ expression: '(5 + 3) * 2' })
    }
  });

  // Demonstrate JSON events
  console.log('\n--- Testing JSON Tools ---');
  const jsonParseTool = jsonModule.tools.find(t => t.name === 'json_parse');
  await jsonParseTool.invoke({
    function: {
      name: 'json_parse',
      arguments: JSON.stringify({ 
        json_string: '{"name": "Event Demo", "version": 1.0, "active": true}' 
      })
    }
  });

  // Test JSON validation with error
  console.log('\n--- Testing JSON Validation (with error) ---');
  const jsonValidateTool = jsonModule.tools.find(t => t.name === 'json_validate');
  await jsonValidateTool.invoke({
    function: {
      name: 'json_validate',
      arguments: JSON.stringify({ 
        json_string: '{"invalid": json}' 
      })
    }
  });

  // Demonstrate file events
  console.log('\n--- Testing File Tool ---');
  const fileWriteTool = fileModule.tools.find(t => t.name === 'write_file');
  await fileWriteTool.invoke({
    function: {
      name: 'write_file',
      arguments: JSON.stringify({ 
        path: './temp-event-demo.txt',
        content: 'Event system demonstration file' 
      })
    }
  });

  // Clean up
  const fileModule2 = new FileModule();
  const deleteFileTool = fileModule2.tools.find(t => t.name === 'delete_file');
  if (deleteFileTool) {
    await deleteFileTool.invoke({
      function: {
        name: 'delete_file',
        arguments: JSON.stringify({ path: './temp-event-demo.txt' })
      }
    });
  }
}

/**
 * Demonstrate WebSocket event streaming
 */
async function demonstrateWebSocketEvents() {
  console.log('\n=== WebSocket Event Streaming Demo ===\n');

  // Create agent
  const agent = new Agent({
    name: 'WebSocketEventAgent',
    bio: 'Demonstrates WebSocket event streaming',
    modelConfig: {
      provider: 'openai',
      model: 'gpt-3.5-turbo',
      apiKey: process.env.OPENAI_API_KEY || 'demo-key'
    }
  });

  // Register modules
  agent.registerModule(new CalculatorModule());
  agent.registerModule(new JsonModule());

  // Start WebSocket server
  const wsServer = new AgentWebSocketServer(agent, { port: PORT });
  await wsServer.start();
  console.log(`WebSocket server started on port ${PORT}`);

  // Create WebSocket client
  const ws = new WebSocket(`ws://localhost:${PORT}`);
  
  await new Promise((resolve) => {
    ws.on('open', () => {
      console.log('Client connected to WebSocket server');
      resolve();
    });
  });

  // Subscribe to events
  ws.send(JSON.stringify({
    id: 'demo-sub-1',
    type: 'subscribe-events'
  }));

  // Handle incoming events
  ws.on('message', (data) => {
    const message = JSON.parse(data.toString());
    
    if (message.type === 'event') {
      const event = message.event;
      console.log(`\n[WebSocket Event] ${event.type.toUpperCase()}`);
      console.log(`  Module: ${event.module}${event.tool ? `/${event.tool}` : ''}`);
      console.log(`  Message: ${event.message}`);
      console.log(`  Level: ${event.level}`);
      if (event.data) {
        console.log(`  Data:`, JSON.stringify(event.data, null, 2));
      }
    } else if (message.type === 'response') {
      console.log(`\n[WebSocket Response] ${message.status}`);
    }
  });

  // Wait a bit for subscription confirmation
  await new Promise(resolve => setTimeout(resolve, 500));

  // Send some tool commands through WebSocket
  console.log('\n--- Sending Calculator Command ---');
  ws.send(JSON.stringify({
    id: 'calc-1',
    type: 'invoke-tool',
    module: 'calculator',
    tool: 'calculator',
    params: { expression: '10 * 5 + 3' }
  }));

  await new Promise(resolve => setTimeout(resolve, 1000));

  console.log('\n--- Sending JSON Command ---');
  ws.send(JSON.stringify({
    id: 'json-1',
    type: 'invoke-tool',
    module: 'json',
    tool: 'json_stringify',
    params: { 
      object: { event: 'demo', timestamp: new Date().toISOString() },
      indent: 2,
      sort_keys: true
    }
  }));

  // Wait for events to be processed
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Test event filtering
  console.log('\n--- Testing Event Filtering ---');
  
  // Unsubscribe from all events
  ws.send(JSON.stringify({
    id: 'demo-unsub-1',
    type: 'unsubscribe-events'
  }));

  // Subscribe only to errors and warnings
  ws.send(JSON.stringify({
    id: 'demo-sub-2',
    type: 'subscribe-events',
    filter: {
      types: ['error', 'warning'],
      modules: ['json']
    }
  }));

  await new Promise(resolve => setTimeout(resolve, 500));

  // Send command that will generate an error
  console.log('\n--- Sending Invalid JSON Command (should see error) ---');
  ws.send(JSON.stringify({
    id: 'json-error-1',
    type: 'invoke-tool',
    module: 'json',
    tool: 'json_parse',
    params: { json_string: 'invalid json' }
  }));

  // Wait for processing
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Cleanup
  ws.close();
  await wsServer.stop();
  console.log('\nWebSocket server stopped');
}

/**
 * Main function
 */
async function main() {
  console.log('jsEnvoy Event System Demonstration');
  console.log('==================================');

  try {
    if (DEMO_MODE === 'websocket') {
      await demonstrateWebSocketEvents();
    } else {
      await demonstrateLocalEvents();
    }
    
    console.log('\n=== Demo Complete ===\n');
  } catch (error) {
    console.error('Demo error:', error);
  }
}

// Run the demo
main().catch(console.error);