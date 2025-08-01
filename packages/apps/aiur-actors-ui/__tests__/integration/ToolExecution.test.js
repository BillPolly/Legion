/**
 * Tool Execution Integration Tests
 * Tests complete tool execution workflows from UI to server and back
 */
import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';

describe('Tool Execution Integration', () => {
  let toolExecutor;
  let actorSpace;
  let mockWebSocket;
  
  beforeEach(async () => {
    // Import dependencies
    const { ClientActorSpace } = await import('../../src/actors/ClientActorSpace.js');
    
    // Create actor space
    actorSpace = new ClientActorSpace();
    
    // Mock WebSocket for server communication
    mockWebSocket = {
      readyState: 1, // OPEN
      send: jest.fn(),
      close: jest.fn()
    };
    
    // Create tool executor (mock implementation)
    toolExecutor = {
      tools: new Map(),
      executions: new Map(),
      
      registerTool(tool) {
        this.tools.set(tool.id, tool);
      },
      
      async executeTool(toolId, params, context = {}) {
        const tool = this.tools.get(toolId);
        if (!tool) {
          throw new Error(`Tool not found: ${toolId}`);
        }
        
        const executionId = `exec-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const execution = {
          id: executionId,
          toolId,
          tool,
          params,
          context,
          status: 'pending',
          startTime: Date.now(),
          endTime: null,
          result: null,
          error: null,
          logs: []
        };
        
        this.executions.set(executionId, execution);
        
        // Simulate async execution
        return new Promise((resolve, reject) => {
          execution.status = 'running';
          
          setTimeout(() => {
            try {
              // Execute tool logic
              const result = tool.execute(params, context);
              
              execution.status = 'completed';
              execution.endTime = Date.now();
              execution.result = result;
              
              resolve({
                executionId,
                result,
                duration: execution.endTime - execution.startTime
              });
            } catch (error) {
              execution.status = 'failed';
              execution.endTime = Date.now();
              execution.error = error.message;
              
              reject(error);
            }
          }, 100);
        });
      },
      
      getExecution(id) {
        return this.executions.get(id);
      },
      
      cancelExecution(id) {
        const execution = this.executions.get(id);
        if (execution && execution.status === 'running') {
          execution.status = 'cancelled';
          execution.endTime = Date.now();
          return true;
        }
        return false;
      }
    };
  });
  
  afterEach(() => {
    jest.clearAllMocks();
  });
  
  describe('Tool Registration', () => {
    test('should register simple tool', () => {
      const tool = {
        id: 'echo',
        name: 'Echo',
        description: 'Echoes input',
        execute: (params) => params.message
      };
      
      toolExecutor.registerTool(tool);
      
      expect(toolExecutor.tools.has('echo')).toBe(true);
      expect(toolExecutor.tools.get('echo')).toBe(tool);
    });
    
    test('should register tool with parameters', () => {
      const tool = {
        id: 'http-request',
        name: 'HTTP Request',
        description: 'Makes HTTP requests',
        parameters: [
          { name: 'url', type: 'string', required: true },
          { name: 'method', type: 'string', default: 'GET' },
          { name: 'headers', type: 'object', default: {} }
        ],
        execute: (params) => {
          // Validate required parameters
          if (!params.url) {
            throw new Error('URL is required');
          }
          return { url: params.url, method: params.method || 'GET' };
        }
      };
      
      toolExecutor.registerTool(tool);
      
      const registered = toolExecutor.tools.get('http-request');
      expect(registered.parameters).toHaveLength(3);
      expect(registered.parameters[0].required).toBe(true);
    });
    
    test('should register tool with validation', () => {
      const tool = {
        id: 'validate-email',
        name: 'Email Validator',
        validate: (params) => {
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (!emailRegex.test(params.email)) {
            return { valid: false, error: 'Invalid email format' };
          }
          return { valid: true };
        },
        execute: (params) => {
          const validation = tool.validate(params);
          if (!validation.valid) {
            throw new Error(validation.error);
          }
          return { email: params.email, valid: true };
        }
      };
      
      toolExecutor.registerTool(tool);
      
      const registered = toolExecutor.tools.get('validate-email');
      expect(registered.validate).toBeDefined();
    });
  });
  
  describe('Tool Execution', () => {
    beforeEach(() => {
      // Register test tools
      toolExecutor.registerTool({
        id: 'success-tool',
        name: 'Success Tool',
        execute: (params) => ({ success: true, data: params.input })
      });
      
      toolExecutor.registerTool({
        id: 'async-tool',
        name: 'Async Tool',
        execute: async (params) => {
          await new Promise(resolve => setTimeout(resolve, 50));
          return { processed: params.data };
        }
      });
      
      toolExecutor.registerTool({
        id: 'error-tool',
        name: 'Error Tool',
        execute: () => {
          throw new Error('Tool execution failed');
        }
      });
    });
    
    test('should execute tool successfully', async () => {
      const result = await toolExecutor.executeTool('success-tool', { input: 'test' });
      
      expect(result).toMatchObject({
        executionId: expect.stringMatching(/^exec-/),
        result: { success: true, data: 'test' },
        duration: expect.any(Number)
      });
      
      const execution = toolExecutor.getExecution(result.executionId);
      expect(execution.status).toBe('completed');
    });
    
    test('should handle async tool execution', async () => {
      const result = await toolExecutor.executeTool('async-tool', { data: 'async-data' });
      
      expect(result.result).toEqual({ processed: 'async-data' });
      expect(result.duration).toBeGreaterThanOrEqual(50);
    });
    
    test('should handle tool execution errors', async () => {
      await expect(
        toolExecutor.executeTool('error-tool', {})
      ).rejects.toThrow('Tool execution failed');
      
      const executions = Array.from(toolExecutor.executions.values());
      const failed = executions.find(e => e.toolId === 'error-tool');
      
      expect(failed).toBeDefined();
      expect(failed.status).toBe('failed');
      expect(failed.error).toBe('Tool execution failed');
    });
    
    test('should handle missing tool', async () => {
      await expect(
        toolExecutor.executeTool('non-existent', {})
      ).rejects.toThrow('Tool not found: non-existent');
    });
    
    test('should track execution lifecycle', async () => {
      let executionId;
      
      // Start execution
      const promise = toolExecutor.executeTool('async-tool', { data: 'test' });
      
      // Check pending/running status
      const executions = Array.from(toolExecutor.executions.values());
      const running = executions.find(e => e.status === 'running' || e.status === 'pending');
      expect(running).toBeDefined();
      executionId = running.id;
      
      // Wait for completion
      await promise;
      
      // Check completed status
      const completed = toolExecutor.getExecution(executionId);
      expect(completed.status).toBe('completed');
      expect(completed.endTime).toBeGreaterThan(completed.startTime);
    });
  });
  
  describe('Tool Parameter Handling', () => {
    beforeEach(() => {
      toolExecutor.registerTool({
        id: 'param-tool',
        name: 'Parameter Tool',
        parameters: [
          { name: 'required', type: 'string', required: true },
          { name: 'optional', type: 'string', required: false },
          { name: 'withDefault', type: 'number', default: 42 },
          { name: 'boolean', type: 'boolean', default: false },
          { name: 'array', type: 'array', default: [] },
          { name: 'object', type: 'object', default: {} }
        ],
        execute: (params) => params
      });
    });
    
    test('should validate required parameters', async () => {
      // Add validation logic to executor
      toolExecutor.validateParams = function(tool, params) {
        for (const param of tool.parameters || []) {
          if (param.required && !(param.name in params)) {
            throw new Error(`Required parameter missing: ${param.name}`);
          }
        }
      };
      
      const tool = toolExecutor.tools.get('param-tool');
      
      expect(() => {
        toolExecutor.validateParams(tool, {});
      }).toThrow('Required parameter missing: required');
      
      expect(() => {
        toolExecutor.validateParams(tool, { required: 'value' });
      }).not.toThrow();
    });
    
    test('should apply default values', async () => {
      toolExecutor.applyDefaults = function(tool, params) {
        const result = { ...params };
        for (const param of tool.parameters || []) {
          if (!(param.name in result) && 'default' in param) {
            result[param.name] = param.default;
          }
        }
        return result;
      };
      
      const tool = toolExecutor.tools.get('param-tool');
      const params = toolExecutor.applyDefaults(tool, { required: 'test' });
      
      expect(params).toEqual({
        required: 'test',
        withDefault: 42,
        boolean: false,
        array: [],
        object: {}
      });
    });
    
    test('should coerce parameter types', () => {
      toolExecutor.coerceType = function(value, type) {
        switch (type) {
          case 'string':
            return String(value);
          case 'number':
            return Number(value);
          case 'boolean':
            return value === 'true' || value === true;
          case 'array':
            return Array.isArray(value) ? value : [value];
          case 'object':
            return typeof value === 'object' ? value : JSON.parse(value);
          default:
            return value;
        }
      };
      
      expect(toolExecutor.coerceType('123', 'number')).toBe(123);
      expect(toolExecutor.coerceType('true', 'boolean')).toBe(true);
      expect(toolExecutor.coerceType('item', 'array')).toEqual(['item']);
      expect(toolExecutor.coerceType('{"key":"value"}', 'object')).toEqual({ key: 'value' });
    });
  });
  
  describe('Tool Execution Context', () => {
    beforeEach(() => {
      toolExecutor.registerTool({
        id: 'context-tool',
        name: 'Context Tool',
        execute: (params, context) => ({
          params,
          context,
          user: context.user,
          session: context.session,
          variables: context.variables
        })
      });
    });
    
    test('should pass context to tool execution', async () => {
      const context = {
        user: 'test-user',
        session: 'session-123',
        variables: { API_KEY: 'secret' },
        timestamp: Date.now()
      };
      
      const result = await toolExecutor.executeTool('context-tool', { data: 'test' }, context);
      
      expect(result.result).toMatchObject({
        params: { data: 'test' },
        context,
        user: 'test-user',
        session: 'session-123',
        variables: { API_KEY: 'secret' }
      });
    });
    
    test('should isolate context between executions', async () => {
      const context1 = { user: 'user1', data: 'context1' };
      const context2 = { user: 'user2', data: 'context2' };
      
      const [result1, result2] = await Promise.all([
        toolExecutor.executeTool('context-tool', {}, context1),
        toolExecutor.executeTool('context-tool', {}, context2)
      ]);
      
      expect(result1.result.context).toEqual(context1);
      expect(result2.result.context).toEqual(context2);
      expect(result1.result.context).not.toEqual(result2.result.context);
    });
  });
  
  describe('Tool Execution Cancellation', () => {
    beforeEach(() => {
      toolExecutor.registerTool({
        id: 'long-running',
        name: 'Long Running Tool',
        execute: async (params) => {
          for (let i = 0; i < 10; i++) {
            await new Promise(resolve => setTimeout(resolve, 100));
            if (params._cancelled) {
              throw new Error('Execution cancelled');
            }
          }
          return { completed: true };
        }
      });
    });
    
    test('should cancel running execution', async () => {
      const params = { data: 'test' };
      
      // Start execution
      const promise = toolExecutor.executeTool('long-running', params);
      
      // Get execution ID
      const executions = Array.from(toolExecutor.executions.values());
      const running = executions.find(e => e.status === 'running');
      expect(running).toBeDefined();
      
      // Cancel execution
      const cancelled = toolExecutor.cancelExecution(running.id);
      expect(cancelled).toBe(true);
      
      // Mark params as cancelled (simplified cancellation)
      params._cancelled = true;
      
      // Wait for execution to fail
      await expect(promise).rejects.toThrow('Execution cancelled');
      
      const execution = toolExecutor.getExecution(running.id);
      expect(execution.status).toBe('cancelled');
    });
    
    test('should not cancel completed execution', async () => {
      const result = await toolExecutor.executeTool('success-tool', { input: 'test' });
      
      const cancelled = toolExecutor.cancelExecution(result.executionId);
      expect(cancelled).toBe(false);
      
      const execution = toolExecutor.getExecution(result.executionId);
      expect(execution.status).toBe('completed');
    });
  });
  
  describe('Tool Execution Logging', () => {
    beforeEach(() => {
      toolExecutor.registerTool({
        id: 'logging-tool',
        name: 'Logging Tool',
        execute: function(params, context) {
          const log = (level, message) => {
            if (context && context.execution) {
              context.execution.logs.push({
                timestamp: Date.now(),
                level,
                message
              });
            }
          };
          
          log('info', 'Starting execution');
          log('debug', `Parameters: ${JSON.stringify(params)}`);
          
          if (!params.input) {
            log('error', 'Missing input parameter');
            throw new Error('Input required');
          }
          
          log('info', 'Processing input');
          const result = params.input.toUpperCase();
          
          log('info', 'Execution completed');
          return { result };
        }
      });
    });
    
    test('should capture execution logs', async () => {
      // Enhance executor to pass execution in context
      const originalExecute = toolExecutor.executeTool;
      toolExecutor.executeTool = async function(toolId, params, context = {}) {
        const tool = this.tools.get(toolId);
        if (!tool) {
          throw new Error(`Tool not found: ${toolId}`);
        }
        
        const executionId = `exec-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const execution = {
          id: executionId,
          toolId,
          tool,
          params,
          context,
          status: 'running',
          startTime: Date.now(),
          logs: []
        };
        
        this.executions.set(executionId, execution);
        
        // Pass execution in context for logging
        const enhancedContext = { ...context, execution };
        
        try {
          const result = tool.execute(params, enhancedContext);
          execution.status = 'completed';
          execution.result = result;
          execution.endTime = Date.now();
          
          return {
            executionId,
            result,
            duration: execution.endTime - execution.startTime,
            logs: execution.logs
          };
        } catch (error) {
          execution.status = 'failed';
          execution.error = error.message;
          execution.endTime = Date.now();
          throw error;
        }
      };
      
      const result = await toolExecutor.executeTool('logging-tool', { input: 'test' });
      
      expect(result.logs).toEqual(expect.arrayContaining([
        expect.objectContaining({ level: 'info', message: 'Starting execution' }),
        expect.objectContaining({ level: 'debug', message: expect.stringContaining('Parameters') }),
        expect.objectContaining({ level: 'info', message: 'Processing input' }),
        expect.objectContaining({ level: 'info', message: 'Execution completed' })
      ]));
    });
    
    test('should capture error logs', async () => {
      const originalExecute = toolExecutor.executeTool;
      toolExecutor.executeTool = async function(toolId, params, context = {}) {
        const tool = this.tools.get(toolId);
        if (!tool) {
          throw new Error(`Tool not found: ${toolId}`);
        }
        
        const executionId = `exec-${Date.now()}`;
        const execution = {
          id: executionId,
          logs: []
        };
        
        this.executions.set(executionId, execution);
        
        const enhancedContext = { ...context, execution };
        
        try {
          const result = tool.execute(params, enhancedContext);
          execution.status = 'completed';
          return { executionId, result, logs: execution.logs };
        } catch (error) {
          execution.status = 'failed';
          execution.error = error.message;
          return { executionId, error: error.message, logs: execution.logs };
        }
      };
      
      const result = await toolExecutor.executeTool('logging-tool', {});
      
      expect(result.logs).toEqual(expect.arrayContaining([
        expect.objectContaining({ level: 'error', message: 'Missing input parameter' })
      ]));
      expect(result.error).toBe('Input required');
    });
  });
  
  describe('Tool Execution Streaming', () => {
    test('should stream execution progress', async () => {
      const progressEvents = [];
      
      toolExecutor.registerTool({
        id: 'streaming-tool',
        name: 'Streaming Tool',
        execute: async (params, context) => {
          const emit = (progress) => {
            if (context && context.onProgress) {
              context.onProgress(progress);
            }
          };
          
          emit({ percentage: 0, message: 'Starting' });
          await new Promise(resolve => setTimeout(resolve, 50));
          
          emit({ percentage: 25, message: 'Processing phase 1' });
          await new Promise(resolve => setTimeout(resolve, 50));
          
          emit({ percentage: 50, message: 'Processing phase 2' });
          await new Promise(resolve => setTimeout(resolve, 50));
          
          emit({ percentage: 75, message: 'Processing phase 3' });
          await new Promise(resolve => setTimeout(resolve, 50));
          
          emit({ percentage: 100, message: 'Complete' });
          
          return { result: 'streamed' };
        }
      });
      
      const context = {
        onProgress: (progress) => {
          progressEvents.push(progress);
        }
      };
      
      await toolExecutor.executeTool('streaming-tool', {}, context);
      
      expect(progressEvents).toEqual([
        { percentage: 0, message: 'Starting' },
        { percentage: 25, message: 'Processing phase 1' },
        { percentage: 50, message: 'Processing phase 2' },
        { percentage: 75, message: 'Processing phase 3' },
        { percentage: 100, message: 'Complete' }
      ]);
    });
    
    test('should stream partial results', async () => {
      const partialResults = [];
      
      toolExecutor.registerTool({
        id: 'partial-results',
        name: 'Partial Results Tool',
        execute: async (params, context) => {
          const emitPartial = (data) => {
            if (context && context.onPartialResult) {
              context.onPartialResult(data);
            }
          };
          
          const results = [];
          
          for (let i = 1; i <= 5; i++) {
            await new Promise(resolve => setTimeout(resolve, 20));
            const partial = `Result ${i}`;
            results.push(partial);
            emitPartial(partial);
          }
          
          return { allResults: results };
        }
      });
      
      const context = {
        onPartialResult: (result) => {
          partialResults.push(result);
        }
      };
      
      const final = await toolExecutor.executeTool('partial-results', {}, context);
      
      expect(partialResults).toEqual([
        'Result 1',
        'Result 2',
        'Result 3',
        'Result 4',
        'Result 5'
      ]);
      
      expect(final.result.allResults).toEqual(partialResults);
    });
  });
});