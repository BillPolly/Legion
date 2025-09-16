/**
 * Complete System Workflow End-to-End Tests
 * 
 * Tests the entire ROMA Agent system from UI interaction through agent execution:
 * 1. Client UI task submission
 * 2. WebSocket communication to server
 * 3. ROMAOrchestrator task processing
 * 4. Agent decomposition and execution
 * 5. Real-time progress updates
 * 6. Result aggregation and display
 */

import { jest } from '@jest/globals';
import { JSDOM } from 'jsdom';
import { WebSocketServer } from 'ws';
import { ROMAClientActor } from '../../src/client/ROMAClientActor.js';
import { ROMAOrchestrator } from '../../src/core/ROMAOrchestrator.js';
import { ResourceManager } from '@legion/resource-manager';

describe('Complete System Workflow E2E Tests', () => {
  let dom;
  let client;
  let orchestrator;
  let wss;
  let serverPort;
  let resourceManager;

  beforeAll(async () => {
    // Get real ResourceManager instance with real LLM client
    resourceManager = await ResourceManager.getResourceManager();
    
    // Verify real LLM client is available
    const llmClient = await resourceManager.get('llmClient');
    if (!llmClient) {
      throw new Error('Real LLM client not available - E2E tests require real services');
    }
  });

  beforeEach(async () => {
    // Set up WebSocket server on random port
    serverPort = 8080 + Math.floor(Math.random() * 1000);
    
    wss = new WebSocketServer({ 
      port: serverPort,
      path: '/ws'
    });

    // Set up ROMA orchestrator
    orchestrator = new ROMAOrchestrator({
      resourceManager,
      maxConcurrentTasks: 5,
      maxRecursionDepth: 3
    });
    
    // Initialize the orchestrator
    await orchestrator.initialize();

    // Set up WebSocket message handling
    wss.on('connection', (ws) => {
      console.log('WebSocket client connected');
      
      ws.on('message', async (data) => {
        try {
          const message = JSON.parse(data.toString());
          console.log('Received message:', message.type);
          
          if (message.type === 'connection_opened') {
            ws.send(JSON.stringify({
              type: 'connected',
              connectionId: message.connectionId
            }));
          } else if (message.type === 'execute_task') {
            // Handle task execution
            await handleTaskExecution(ws, message);
          }
        } catch (error) {
          console.error('WebSocket message handling error:', error);
          ws.send(JSON.stringify({
            type: 'error',
            data: { error: error.message }
          }));
        }
      });
    });

    // Set up JSDOM environment
    dom = new JSDOM(`
      <!DOCTYPE html>
      <html>
        <head><title>ROMA E2E Test</title></head>
        <body>
          <div id="app"></div>
        </body>
      </html>
    `, {
      url: 'http://localhost:3000',
      pretendToBeVisual: true,
      resources: 'usable'
    });

    // Set up globals
    global.document = dom.window.document;
    global.window = dom.window;
    global.HTMLElement = dom.window.HTMLElement;
    global.SVGElement = dom.window.SVGElement;
    global.Event = dom.window.Event;
    global.KeyboardEvent = dom.window.KeyboardEvent;
    global.MouseEvent = dom.window.MouseEvent;
    global.localStorage = {
      getItem: jest.fn(),
      setItem: jest.fn(),
      removeItem: jest.fn(),
      clear: jest.fn()
    };
    global.navigator = {
      clipboard: {
        writeText: jest.fn().mockResolvedValue()
      }
    };
    // Preserve original URL constructor while mocking specific methods
    const originalURL = global.URL;
    global.URL = originalURL;
    global.URL.createObjectURL = jest.fn(() => 'blob:mock-url');
    global.URL.revokeObjectURL = jest.fn();
    global.Blob = jest.fn();
    global.requestAnimationFrame = jest.fn((cb) => {
      const id = setTimeout(cb, 16);
      return id;
    });
    global.cancelAnimationFrame = jest.fn((id) => clearTimeout(id));

    // Create client
    client = new ROMAClientActor();
  });

  afterEach(async () => {
    // Cleanup
    if (client) {
      await client.cleanup();
    }
    if (wss) {
      wss.close();
    }
    
    // Clean up globals
    Object.keys(global).forEach(key => {
      if (key.startsWith('document') || key.startsWith('window') || 
          key.startsWith('HTML') || key.startsWith('SVG') ||
          ['Event', 'KeyboardEvent', 'MouseEvent', 'localStorage', 'navigator', 'URL', 'Blob', 'requestAnimationFrame', 'cancelAnimationFrame'].includes(key)) {
        delete global[key];
      }
    });
    
    if (dom) {
      dom.window.close();
    }
  });

  /**
   * Handle task execution with real orchestrator
   */
  async function handleTaskExecution(ws, message) {
    const { userRequest, sessionId, options } = message;
    
    try {
      console.log(`Executing task: ${userRequest}`);
      
      // Start task with orchestrator
      const taskResult = await orchestrator.executeTask(
        {
          id: `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          description: userRequest,
          sessionId,
          depth: 0,
          context: {}
        },
        {
          sessionId,
          maxDepth: options.maxDepth || 3,
          progressCallback: (progressData) => {
            // Send progress updates to client
            ws.send(JSON.stringify({
              type: 'task_progress',
              data: progressData
            }));
          }
        }
      );

      // Send completion
      ws.send(JSON.stringify({
        type: 'task_completed',
        data: {
          success: true,
          result: taskResult,
          message: 'Task completed successfully',
          duration: taskResult.executionTime || 5000,
          tokens: 250
        }
      }));

    } catch (error) {
      console.error('Task execution error:', error);
      ws.send(JSON.stringify({
        type: 'error',
        data: { error: error.message }
      }));
    }
  }

  describe('Complete Workflow Tests', () => {
    test('should execute complete web server creation workflow', async () => {
      console.log('=== STARTING COMPLETE WORKFLOW TEST ===');
      
      // Step 1: Initialize client and connect to server
      console.log('Step 1: Connecting client to server...');
      await client.initialize(`ws://localhost:${serverPort}/ws`);
      
      expect(client.connected).toBe(true);
      expect(client.taskInputForms).toBeDefined();
      expect(client.taskGraphViz).toBeDefined();
      expect(client.progressDisplay).toBeDefined();
      
      // Step 2: User enters task in UI
      console.log('Step 2: Setting up task input...');
      const container = document.getElementById('app');
      const textarea = container.querySelector('.task-input-textarea');
      const submitBtn = container.querySelector('.btn-submit-task');
      
      const taskInput = 'Create a simple Express.js web server with health and status endpoints';
      textarea.value = taskInput;
      textarea.dispatchEvent(new Event('input'));
      
      expect(submitBtn.disabled).toBe(false);
      
      // Step 3: Submit task and track execution
      console.log('Step 3: Submitting task...');
      const executionPromise = new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Task execution timeout'));
        }, 60000); // 60 second timeout for real LLM calls
        
        // Listen for completion
        const originalHandleCompleted = client.handleTaskCompleted.bind(client);
        client.handleTaskCompleted = (data) => {
          clearTimeout(timeout);
          originalHandleCompleted(data);
          resolve(data);
        };
        
        // Listen for errors
        const originalHandleError = client.handleError.bind(client);
        client.handleError = (data) => {
          clearTimeout(timeout);
          originalHandleError(data);
          reject(new Error(data.error || 'Task execution failed'));
        };
      });
      
      // Start execution
      client.executeTask(taskInput, {
        maxDepth: 3,
        timeout: 30000,
        priority: 'normal'
      });
      
      // Step 4: Wait for task completion and verify results
      console.log('Step 4: Waiting for task completion...');
      const result = await executionPromise;
      
      // Verify task completed successfully
      expect(result.success).toBe(true);
      expect(result.result).toBeDefined();
      
      // Step 5: Verify UI updates
      console.log('Step 5: Verifying UI updates...');
      
      // Check forms UI
      expect(container.querySelector('.status-value').textContent).toBe('Completed');
      expect(container.querySelector('.output-result')).toBeDefined();
      expect(container.querySelector('.duration-value').textContent).toContain('ms');
      expect(container.querySelector('.tokens-value').textContent).toBe('250');
      
      // Check progress display
      expect(client.progressDisplay.isActive).toBe(false);
      expect(container.querySelector('.progress-status').textContent).toBe('Completed');
      
      // Check task graph (should have nodes)
      expect(client.taskGraph).toBeDefined();
      if (client.taskGraph && client.taskGraph.nodes) {
        expect(client.taskGraph.nodes.length).toBeGreaterThan(0);
      }
      
      console.log('=== COMPLETE WORKFLOW TEST COMPLETED SUCCESSFULLY ===');
    }, 90000); // 90 second test timeout for real LLM calls

    test('should handle task execution errors gracefully', async () => {
      console.log('=== STARTING ERROR HANDLING TEST ===');
      
      // Connect client
      await client.initialize(`ws://localhost:${serverPort}/ws`);
      
      // Set up error tracking
      const errorPromise = new Promise((resolve) => {
        const originalHandleError = client.handleError.bind(client);
        client.handleError = (data) => {
          originalHandleError(data);
          resolve(data);
        };
      });
      
      // Submit a task that is likely to cause an error with real LLM
      // Use an invalid/malformed task that should cause execution issues
      client.executeTask('', { maxDepth: 2 }); // Empty task description should cause validation error
      
      // Wait for error
      const errorData = await errorPromise;
      
      // Verify error handling
      expect(errorData.error).toBeDefined();
      
      // Check if error is classified properly (if available)
      if (errorData.errorType) {
        console.log(`Error classified as: ${errorData.errorType}, retryable: ${errorData.retryable}`);
      }
      
      // Check UI shows error state
      const container = document.getElementById('app');
      expect(container.querySelector('.status-value').textContent).toBe('Error');
      expect(container.querySelector('.output-error')).toBeDefined();
      expect(container.querySelector('.progress-status').textContent).toBe('Failed');
      
      console.log('=== ERROR HANDLING TEST COMPLETED ===');
    }, 30000); // 30 second timeout for error handling test

    test('should handle real-time progress updates during execution', async () => {
      console.log('=== STARTING PROGRESS UPDATES TEST ===');
      
      // Connect client
      await client.initialize(`ws://localhost:${serverPort}/ws`);
      
      const progressUpdates = [];
      
      // Track progress updates
      const originalHandleProgress = client.handleTaskProgress.bind(client);
      client.handleTaskProgress = (data) => {
        progressUpdates.push(data);
        originalHandleProgress(data);
      };
      
      // Submit task
      const taskPromise = new Promise((resolve) => {
        const originalHandleCompleted = client.handleTaskCompleted.bind(client);
        client.handleTaskCompleted = (data) => {
          originalHandleCompleted(data);
          resolve(data);
        };
      });
      
      client.executeTask('Create a simple Node.js script', { maxDepth: 2 });
      
      // Wait for completion
      await taskPromise;
      
      // Verify we received progress updates
      expect(progressUpdates.length).toBeGreaterThan(0);
      
      // Verify progress data structure
      progressUpdates.forEach(update => {
        expect(update).toHaveProperty('status');
        // Task graph might be present in some updates
        if (update.taskGraph) {
          expect(update.taskGraph).toHaveProperty('nodes');
        }
      });
      
      console.log(`=== PROGRESS UPDATES TEST COMPLETED (${progressUpdates.length} updates) ===`);
    }, 60000); // 60 second timeout for progress updates test

    test('should maintain WebSocket connection stability', async () => {
      console.log('=== STARTING CONNECTION STABILITY TEST ===');
      
      // Connect client
      await client.initialize(`ws://localhost:${serverPort}/ws`);
      expect(client.connected).toBe(true);
      
      // Execute multiple tasks in sequence
      const tasks = [
        'Create a simple function',
        'Write a hello world script', 
        'Generate a basic HTML page'
      ];
      
      for (let i = 0; i < tasks.length; i++) {
        console.log(`Executing task ${i + 1}/${tasks.length}: ${tasks[i]}`);
        
        const taskPromise = new Promise((resolve, reject) => {
          // NO TIMEOUTS - let the task complete or fail naturally
          
          const originalHandleCompleted = client.handleTaskCompleted.bind(client);
          client.handleTaskCompleted = (data) => {
            originalHandleCompleted(data);
            resolve(data);
          };
          
          const originalHandleError = client.handleError.bind(client);
          client.handleError = (data) => {
            originalHandleError(data);
            reject(new Error(data.error));
          };
        });
        
        client.executeTask(tasks[i], { maxDepth: 2 });
        await taskPromise;
        
        // Verify connection is still active
        expect(client.connected).toBe(true);
      }
      
      console.log('=== CONNECTION STABILITY TEST COMPLETED ===');
    }, 300000); // 5 minute timeout for Jest - NO task timeouts, just let them complete
  });
});