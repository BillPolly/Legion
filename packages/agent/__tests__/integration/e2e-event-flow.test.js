/**
 * End-to-end integration tests for complete event flow
 * Tests the full event pipeline: Tool → Module → Agent → WebSocket
 */

import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { Agent } from '../../src/Agent.js';
import { AgentWebSocketServer } from '../../src/websocket-server.js';
import { Module } from '@jsenvoy/module-loader';
import Tool from '@jsenvoy/module-loader/src/tool/Tool.js';
import WebSocket from 'ws';

// Comprehensive test module that demonstrates various event scenarios
class E2ETestModule extends Module {
  constructor() {
    super();
    this.name = 'E2ETestModule';
    
    // Add various tools to demonstrate event flow
    this.registerTool('FileProcessor', new FileProcessorTool());
    this.registerTool('DataValidator', new DataValidatorTool());
    this.registerTool('ReportGenerator', new ReportGeneratorTool());
  }

  async performComplexWorkflow(data) {
    this.emitInfo('Starting complex workflow', { 
      workflowId: 'complex-workflow',
      inputData: data 
    });

    try {
      // Step 1: Process files
      this.emitProgress('Processing files...', { step: 1, total: 4 });
      const fileResults = await this.tools[0].execute({ files: data.files });
      
      // Step 2: Validate data
      this.emitProgress('Validating data...', { step: 2, total: 4 });
      const validationResults = await this.tools[1].execute({ data: fileResults });
      
      // Step 3: Generate reports
      this.emitProgress('Generating reports...', { step: 3, total: 4 });
      const reportResults = await this.tools[2].execute({ data: validationResults });
      
      // Step 4: Finalize
      this.emitProgress('Finalizing workflow...', { step: 4, total: 4 });
      
      const finalResults = {
        workflowId: 'complex-workflow',
        results: reportResults,
        timestamp: new Date().toISOString()
      };
      
      this.emitInfo('Complex workflow completed successfully', {
        workflowId: 'complex-workflow',
        results: finalResults
      });
      
      return finalResults;
      
    } catch (error) {
      this.emitError('Complex workflow failed', {
        workflowId: 'complex-workflow',
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  async performErrorScenario() {
    this.emitInfo('Starting error scenario workflow');
    
    this.emitProgress('Processing step 1...', { step: 1, total: 3 });
    await new Promise(resolve => setTimeout(resolve, 50));
    
    this.emitProgress('Processing step 2...', { step: 2, total: 3 });
    await new Promise(resolve => setTimeout(resolve, 50));
    
    this.emitWarning('Encountered issue in step 2', {
      issue: 'Data inconsistency detected',
      severity: 'medium'
    });
    
    this.emitProgress('Attempting recovery...', { step: 3, total: 3 });
    await new Promise(resolve => setTimeout(resolve, 50));
    
    this.emitError('Recovery failed - workflow terminated', {
      errorCode: 'RECOVERY_FAILED',
      originalIssue: 'Data inconsistency detected'
    });
    
    throw new Error('Workflow failed');
  }
}

// File processor tool that demonstrates progress events
class FileProcessorTool extends Tool {
  constructor() {
    super();
    this.name = 'FileProcessor';
    this.description = 'Processes files and emits progress events';
  }

  getToolDescription() {
    return {
      type: 'function',
      function: {
        name: 'processFiles',
        description: this.description,
        parameters: {
          type: 'object',
          properties: {
            files: { type: 'array' }
          }
        },
        output: {
          success: { type: 'object' },
          failure: { type: 'object' }
        }
      }
    };
  }

  async execute(args) {
    const files = args.files || [];
    
    this.emitInfo('Starting file processing', { 
      totalFiles: files.length,
      tool: this.name
    });
    
    const results = [];
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      
      this.emitProgress(`Processing file ${i + 1}/${files.length}`, {
        currentFile: file,
        progress: Math.round(((i + 1) / files.length) * 100),
        tool: this.name
      });
      
      // Simulate processing time
      await new Promise(resolve => setTimeout(resolve, 20));
      
      results.push({
        file: file,
        processed: true,
        timestamp: new Date().toISOString()
      });
    }
    
    this.emitInfo('File processing completed', {
      processedFiles: results.length,
      tool: this.name
    });
    
    return { processedFiles: results };
  }
}

// Data validator tool that demonstrates warning events
class DataValidatorTool extends Tool {
  constructor() {
    super();
    this.name = 'DataValidator';
    this.description = 'Validates data and emits warning events for issues';
  }

  getToolDescription() {
    return {
      type: 'function',
      function: {
        name: 'validateData',
        description: this.description,
        parameters: {
          type: 'object',
          properties: {
            data: { type: 'object' }
          }
        },
        output: {
          success: { type: 'object' },
          failure: { type: 'object' }
        }
      }
    };
  }

  async execute(args) {
    const data = args.data || {};
    
    this.emitInfo('Starting data validation', { 
      dataKeys: Object.keys(data),
      tool: this.name
    });
    
    const validationResults = {
      valid: true,
      warnings: [],
      errors: []
    };
    
    // Simulate validation checks
    if (data.processedFiles && data.processedFiles.length === 0) {
      this.emitWarning('No processed files found', {
        severity: 'low',
        tool: this.name
      });
      validationResults.warnings.push('No processed files');
    }
    
    if (data.processedFiles && data.processedFiles.length > 10) {
      this.emitWarning('Large number of files detected', {
        fileCount: data.processedFiles.length,
        recommendation: 'Consider batch processing',
        severity: 'medium',
        tool: this.name
      });
      validationResults.warnings.push('Large file count');
    }
    
    // Simulate validation completion
    await new Promise(resolve => setTimeout(resolve, 30));
    
    this.emitInfo('Data validation completed', {
      validationResults: validationResults,
      tool: this.name
    });
    
    return { validationResults: validationResults, originalData: data };
  }
}

// Report generator tool that demonstrates info events
class ReportGeneratorTool extends Tool {
  constructor() {
    super();
    this.name = 'ReportGenerator';
    this.description = 'Generates reports and emits info events';
  }

  getToolDescription() {
    return {
      type: 'function',
      function: {
        name: 'generateReport',
        description: this.description,
        parameters: {
          type: 'object',
          properties: {
            data: { type: 'object' }
          }
        },
        output: {
          success: { type: 'object' },
          failure: { type: 'object' }
        }
      }
    };
  }

  async execute(args) {
    const data = args.data || {};
    
    this.emitInfo('Starting report generation', { 
      tool: this.name
    });
    
    // Simulate report generation steps
    this.emitProgress('Analyzing data...', { step: 1, total: 3, tool: this.name });
    await new Promise(resolve => setTimeout(resolve, 25));
    
    this.emitProgress('Formatting report...', { step: 2, total: 3, tool: this.name });
    await new Promise(resolve => setTimeout(resolve, 25));
    
    this.emitProgress('Finalizing report...', { step: 3, total: 3, tool: this.name });
    await new Promise(resolve => setTimeout(resolve, 25));
    
    const report = {
      id: `report-${Date.now()}`,
      timestamp: new Date().toISOString(),
      summary: {
        totalFiles: data.originalData?.processedFiles?.length || 0,
        warnings: data.validationResults?.warnings?.length || 0,
        status: 'completed'
      },
      details: data
    };
    
    this.emitInfo('Report generation completed', {
      reportId: report.id,
      reportSummary: report.summary,
      tool: this.name
    });
    
    return { report: report };
  }
}

// Helper functions for WebSocket testing
function createWebSocketClient(port = 3004) {
  return new WebSocket(`ws://localhost:${port}`);
}

function waitForConnection(ws) {
  return new Promise((resolve, reject) => {
    ws.on('open', resolve);
    ws.on('error', reject);
  });
}

function sendAndWaitForResponse(ws, message) {
  return new Promise((resolve, reject) => {
    const messageHandler = (data) => {
      ws.removeListener('message', messageHandler);
      try {
        const response = JSON.parse(data.toString());
        resolve(response);
      } catch (error) {
        reject(error);
      }
    };
    
    ws.on('message', messageHandler);
    ws.send(JSON.stringify(message));
  });
}

function collectEventsUntil(ws, condition, timeout = 5000) {
  return new Promise((resolve, reject) => {
    const events = [];
    let timeoutId;
    
    const messageHandler = (data) => {
      try {
        const message = JSON.parse(data.toString());
        if (message.type === 'event') {
          events.push(message);
          
          if (condition(events)) {
            ws.removeListener('message', messageHandler);
            clearTimeout(timeoutId);
            resolve(events);
          }
        }
      } catch (error) {
        // Ignore parse errors
      }
    };
    
    ws.on('message', messageHandler);
    
    timeoutId = setTimeout(() => {
      ws.removeListener('message', messageHandler);
      reject(new Error(`Timeout waiting for events. Got ${events.length} events.`));
    }, timeout);
  });
}

describe('End-to-End Event Flow Integration', () => {
  let agent;
  let server;
  let wsClient;
  let module;
  const testPort = 3004;

  beforeEach(async () => {
    // Create agent
    agent = new Agent({
      name: 'E2ETestAgent',
      bio: 'End-to-end test agent for event flow testing',
      modelConfig: {
        provider: 'openai',
        model: 'gpt-3.5-turbo',
        apiKey: 'test-key'
      }
    });

    // Create test module
    module = new E2ETestModule();
    agent.registerModule(module);

    // Create and start WebSocket server
    server = new AgentWebSocketServer(agent, { port: testPort });
    await server.start();
    
    // Give server time to start
    await new Promise(resolve => setTimeout(resolve, 100));

    // Create and connect WebSocket client
    wsClient = createWebSocketClient(testPort);
    await waitForConnection(wsClient);
    
    // Subscribe to events
    await sendAndWaitForResponse(wsClient, {
      id: 'subscribe-e2e',
      type: 'subscribe-events'
    });
  });

  afterEach(async () => {
    // Close client connection
    if (wsClient && wsClient.readyState === WebSocket.OPEN) {
      wsClient.close();
    }
    
    // Stop server
    if (server) {
      await server.stop();
    }
    
    // Wait for cleanup
    await new Promise(resolve => setTimeout(resolve, 100));
  });

  describe('Complete Event Flow - Success Scenarios', () => {
    test('should demonstrate complete event flow from tool to websocket', async () => {
      // Set up event collection
      const eventsPromise = collectEventsUntil(wsClient, (events) => {
        // Look for workflow completion event
        return events.some(e => 
          e.event.message === 'Complex workflow completed successfully'
        );
      }, 10000);

      // Trigger the workflow with many files to generate warnings
      const workflowPromise = module.performComplexWorkflow({
        files: Array.from({ length: 15 }, (_, i) => `file${i + 1}.txt`)
      });

      // Wait for both events and workflow completion
      const [events, workflowResult] = await Promise.all([eventsPromise, workflowPromise]);

      // Verify workflow completed
      expect(workflowResult).toMatchObject({
        workflowId: 'complex-workflow',
        results: expect.objectContaining({
          report: expect.objectContaining({
            id: expect.stringMatching(/^report-/),
            summary: expect.objectContaining({
              totalFiles: 15,
              status: 'completed'
            })
          })
        })
      });

      // Verify event flow
      expect(events.length).toBeGreaterThan(10); // Should have many events

      // Check for key workflow events
      const workflowStartEvent = events.find(e => 
        e.event.message === 'Starting complex workflow'
      );
      expect(workflowStartEvent).toBeDefined();
      expect(workflowStartEvent.event.module).toBe('E2ETestModule');
      expect(workflowStartEvent.event.agentId).toBe('E2ETestAgent');

      const workflowEndEvent = events.find(e => 
        e.event.message === 'Complex workflow completed successfully'
      );
      expect(workflowEndEvent).toBeDefined();
      expect(workflowEndEvent.event.data.workflowId).toBe('complex-workflow');

      // Check for tool events
      const toolEvents = events.filter(e => e.event.tool !== null);
      expect(toolEvents.length).toBeGreaterThan(0);

      // Verify we have events from all tools
      const toolNames = new Set(toolEvents.map(e => e.event.tool));
      expect(toolNames).toContain('FileProcessor');
      expect(toolNames).toContain('DataValidator');
      expect(toolNames).toContain('ReportGenerator');

      // Verify event types
      const eventTypes = new Set(events.map(e => e.event.type));
      expect(eventTypes).toContain('info');
      expect(eventTypes).toContain('progress');
      expect(eventTypes).toContain('warning');
    });

    test('should demonstrate progressive event updates', async () => {
      // Track progress events specifically
      const progressEvents = [];
      
      const eventsPromise = collectEventsUntil(wsClient, (events) => {
        const newProgressEvents = events.filter(e => 
          e.event.type === 'progress' && 
          !progressEvents.some(pe => pe.timestamp === e.timestamp)
        );
        progressEvents.push(...newProgressEvents);
        
        // Complete when we have workflow completion
        return events.some(e => 
          e.event.message === 'Complex workflow completed successfully'
        );
      }, 10000);

      // Trigger workflow
      await Promise.all([
        eventsPromise,
        module.performComplexWorkflow({
          files: ['file1.txt', 'file2.txt']
        })
      ]);

      // Verify progress events show progression
      expect(progressEvents.length).toBeGreaterThan(5);
      
      // Check for module-level progress events
      const moduleProgressEvents = progressEvents.filter(e => 
        e.event.tool === null && e.event.module === 'E2ETestModule'
      );
      expect(moduleProgressEvents.length).toBeGreaterThanOrEqual(4); // 4 main workflow steps

      // Check for tool-level progress events
      const toolProgressEvents = progressEvents.filter(e => 
        e.event.tool !== null
      );
      expect(toolProgressEvents.length).toBeGreaterThan(0);
    });

    test('should handle concurrent workflows with separate event streams', async () => {
      // Start two workflows concurrently
      const eventsPromise = collectEventsUntil(wsClient, (events) => {
        // Wait for both workflows to complete
        const completionEvents = events.filter(e => 
          e.event.message === 'Complex workflow completed successfully'
        );
        return completionEvents.length >= 2;
      }, 15000);

      const workflow1Promise = module.performComplexWorkflow({
        files: ['workflow1-file1.txt', 'workflow1-file2.txt']
      });

      const workflow2Promise = module.performComplexWorkflow({
        files: ['workflow2-file1.txt', 'workflow2-file2.txt', 'workflow2-file3.txt']
      });

      // Wait for all to complete
      const [events, result1, result2] = await Promise.all([
        eventsPromise,
        workflow1Promise,
        workflow2Promise
      ]);

      // Verify both workflows completed
      expect(result1.workflowId).toBe('complex-workflow');
      expect(result2.workflowId).toBe('complex-workflow');

      // Verify we have events from both workflows
      expect(events.length).toBeGreaterThan(20); // Should have many events from both

      // Check for tool events from both workflows
      const fileProcessorEvents = events.filter(e => 
        e.event.tool === 'FileProcessor' && e.event.type === 'progress'
      );
      expect(fileProcessorEvents.length).toBeGreaterThan(4); // At least 2 files + 3 files processing
    });
  });

  describe('Complete Event Flow - Error Scenarios', () => {
    test('should demonstrate error event flow from tool to websocket', async () => {
      // Set up event collection for error scenario
      const eventsPromise = collectEventsUntil(wsClient, (events) => {
        // Look for error event
        return events.some(e => 
          e.event.type === 'error' && 
          e.event.message === 'Recovery failed - workflow terminated'
        );
      }, 10000);

      // Trigger error scenario
      const errorPromise = module.performErrorScenario().catch(error => error);

      // Wait for both events and error
      const [events, error] = await Promise.all([eventsPromise, errorPromise]);

      // Verify error occurred
      expect(error).toBeInstanceOf(Error);
      expect(error.message).toBe('Workflow failed');

      // Verify event flow includes error progression
      expect(events.length).toBeGreaterThan(5);

      // Check for progression of events
      const infoEvents = events.filter(e => e.event.type === 'info');
      const progressEvents = events.filter(e => e.event.type === 'progress');
      const warningEvents = events.filter(e => e.event.type === 'warning');
      const errorEvents = events.filter(e => e.event.type === 'error');

      expect(infoEvents.length).toBeGreaterThan(0);
      expect(progressEvents.length).toBeGreaterThan(0);
      expect(warningEvents.length).toBeGreaterThan(0);
      expect(errorEvents.length).toBeGreaterThan(0);

      // Check specific error event
      const finalErrorEvent = errorEvents.find(e => 
        e.event.message === 'Recovery failed - workflow terminated'
      );
      expect(finalErrorEvent).toBeDefined();
      expect(finalErrorEvent.event.data.errorCode).toBe('RECOVERY_FAILED');
    });

    test('should demonstrate warning event flow and recovery', async () => {
      // Set up event collection
      const eventsPromise = collectEventsUntil(wsClient, (events) => {
        // Look for warning event
        return events.some(e => 
          e.event.type === 'warning' && 
          e.event.message === 'Encountered issue in step 2'
        );
      }, 10000);

      // Trigger error scenario to get warning
      const errorPromise = module.performErrorScenario().catch(error => error);

      // Wait for events
      const [events] = await Promise.all([eventsPromise, errorPromise]);

      // Find the warning event
      const warningEvent = events.find(e => 
        e.event.type === 'warning' && 
        e.event.message === 'Encountered issue in step 2'
      );

      expect(warningEvent).toBeDefined();
      expect(warningEvent.event.data.issue).toBe('Data inconsistency detected');
      expect(warningEvent.event.data.severity).toBe('medium');
      expect(warningEvent.event.module).toBe('E2ETestModule');
      expect(warningEvent.event.agentId).toBe('E2ETestAgent');
    });
  });

  describe('Real-time Event Updates', () => {
    test('should provide real-time updates during long-running operations', async () => {
      const eventTimestamps = [];
      
      // Custom event collector that tracks timing
      const eventsPromise = new Promise((resolve) => {
        const events = [];
        
        const messageHandler = (data) => {
          try {
            const message = JSON.parse(data.toString());
            if (message.type === 'event') {
              events.push(message);
              eventTimestamps.push(Date.now());
              
              // Complete when workflow finishes
              if (message.event.message === 'Complex workflow completed successfully') {
                wsClient.removeListener('message', messageHandler);
                resolve(events);
              }
            }
          } catch (error) {
            // Ignore parse errors
          }
        };
        
        wsClient.on('message', messageHandler);
      });

      const startTime = Date.now();
      
      // Trigger workflow
      const workflowPromise = module.performComplexWorkflow({
        files: ['file1.txt', 'file2.txt', 'file3.txt', 'file4.txt', 'file5.txt']
      });

      // Wait for completion
      const [events] = await Promise.all([eventsPromise, workflowPromise]);
      
      const endTime = Date.now();
      const totalDuration = endTime - startTime;

      // Verify events were spread throughout execution
      expect(events.length).toBeGreaterThan(10);
      expect(eventTimestamps.length).toBeGreaterThan(10);
      
      // Check that events were distributed over time
      const firstEventTime = eventTimestamps[0];
      const lastEventTime = eventTimestamps[eventTimestamps.length - 1];
      const eventDuration = lastEventTime - firstEventTime;
      
      expect(eventDuration).toBeGreaterThan(100); // Should take some time
      expect(eventDuration).toBeLessThan(totalDuration * 2); // But not too long
    });

    test('should handle high-frequency events without loss', async () => {
      // Create a module that emits many events rapidly
      const rapidModule = new E2ETestModule();
      agent.registerModule(rapidModule);
      
      const eventsPromise = collectEventsUntil(wsClient, (events) => {
        // Look for completion of rapid events
        return events.filter(e => 
          e.event.message && e.event.message.includes('Rapid event')
        ).length >= 50;
      }, 5000);

      // Emit rapid events
      const rapidPromise = (async () => {
        for (let i = 0; i < 50; i++) {
          rapidModule.emitInfo(`Rapid event ${i}`, { index: i });
          // Small delay to prevent overwhelming
          await new Promise(resolve => setTimeout(resolve, 5));
        }
      })();

      // Wait for events
      const [events] = await Promise.all([eventsPromise, rapidPromise]);

      // Verify all events were captured
      const rapidEvents = events.filter(e => 
        e.event.message && e.event.message.includes('Rapid event')
      );
      
      expect(rapidEvents.length).toBeGreaterThanOrEqual(50);
      
      // Verify events are in order (accounting for duplicates)
      const eventIndices = rapidEvents.map(e => e.event.data.index);
      for (let i = 0; i < eventIndices.length - 1; i++) {
        expect(eventIndices[i]).toBeLessThanOrEqual(eventIndices[i + 1]);
      }
    });
  });

  describe('Event System Performance', () => {
    test('should handle complex workflows efficiently', async () => {
      const startTime = Date.now();
      
      // Run multiple workflows to test performance
      const workflows = [];
      for (let i = 0; i < 3; i++) {
        workflows.push(
          module.performComplexWorkflow({
            files: [`batch-${i}-file1.txt`, `batch-${i}-file2.txt`]
          })
        );
      }

      // Wait for all workflows to complete
      const results = await Promise.all(workflows);
      
      const endTime = Date.now();
      const totalDuration = endTime - startTime;

      // Verify all workflows completed
      expect(results).toHaveLength(3);
      results.forEach(result => {
        expect(result.workflowId).toBe('complex-workflow');
      });

      // Should complete within reasonable time (less than 10 seconds)
      expect(totalDuration).toBeLessThan(10000);
    });
  });
});