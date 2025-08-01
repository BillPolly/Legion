/**
 * Legion Tool Execution Integration Tests
 * Tests integration with Legion framework tools
 */
import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';

describe('Legion Tool Execution Integration', () => {
  let toolExecutor;
  let legionModule;
  let mockResourceManager;
  
  beforeEach(async () => {
    // Mock ResourceManager for Legion tools
    mockResourceManager = {
      get: jest.fn(),
      set: jest.fn(),
      has: jest.fn(),
      delete: jest.fn(),
      initialize: jest.fn().mockResolvedValue(true)
    };
    
    // Mock Legion module structure
    legionModule = {
      name: 'TestModule',
      version: '1.0.0',
      tools: new Map(),
      dependencies: {},
      
      registerTool(tool) {
        this.tools.set(tool.name, tool);
      },
      
      getTool(name) {
        return this.tools.get(name);
      },
      
      getTools() {
        return Array.from(this.tools.values());
      },
      
      execute: jest.fn()
    };
    
    // Create tool executor for Legion tools
    toolExecutor = {
      modules: new Map(),
      tools: new Map(),
      resourceManager: mockResourceManager,
      
      async loadModule(module) {
        this.modules.set(module.name, module);
        
        // Register all module tools
        for (const tool of module.getTools()) {
          this.registerTool(tool, module.name);
        }
        
        return module;
      },
      
      registerTool(tool, moduleName) {
        const toolId = `${moduleName}.${tool.name}`;
        this.tools.set(toolId, {
          ...tool,
          id: toolId,
          module: moduleName
        });
      },
      
      async executeTool(toolId, params, context = {}) {
        const tool = this.tools.get(toolId);
        if (!tool) {
          throw new Error(`Tool not found: ${toolId}`);
        }
        
        // Validate input schema if present
        if (tool.inputSchema && tool.inputSchema.parse) {
          try {
            tool.inputSchema.parse(params);
          } catch (error) {
            throw new Error(`Invalid parameters: ${error.message}`);
          }
        }
        
        // Execute tool with Legion context
        const legionContext = {
          ...context,
          resourceManager: this.resourceManager,
          module: this.modules.get(tool.module),
          emit: (event, data) => {
            if (context.onEvent) {
              context.onEvent(event, data);
            }
          }
        };
        
        return await tool.execute(params, legionContext);
      },
      
      getAllTools() {
        return Array.from(this.tools.values());
      }
    };
  });
  
  afterEach(() => {
    jest.clearAllMocks();
  });
  
  describe('Legion Module Loading', () => {
    test('should load Legion module with tools', async () => {
      // Create sample Legion tools
      const echoTool = {
        name: 'echo',
        description: 'Echoes input',
        inputSchema: {
          parse: (input) => {
            if (!input.message) throw new Error('message is required');
            return input;
          }
        },
        execute: async (params) => ({ output: params.message })
      };
      
      const transformTool = {
        name: 'transform',
        description: 'Transforms text',
        inputSchema: {
          parse: (input) => {
            if (!input.text) throw new Error('text is required');
            if (!input.operation) throw new Error('operation is required');
            return input;
          }
        },
        execute: async (params) => {
          switch (params.operation) {
            case 'uppercase':
              return { result: params.text.toUpperCase() };
            case 'lowercase':
              return { result: params.text.toLowerCase() };
            case 'reverse':
              return { result: params.text.split('').reverse().join('') };
            default:
              throw new Error(`Unknown operation: ${params.operation}`);
          }
        }
      };
      
      // Register tools in module
      legionModule.registerTool(echoTool);
      legionModule.registerTool(transformTool);
      
      // Load module
      await toolExecutor.loadModule(legionModule);
      
      // Verify module loaded
      expect(toolExecutor.modules.has('TestModule')).toBe(true);
      
      // Verify tools registered
      expect(toolExecutor.tools.has('TestModule.echo')).toBe(true);
      expect(toolExecutor.tools.has('TestModule.transform')).toBe(true);
      
      const allTools = toolExecutor.getAllTools();
      expect(allTools).toHaveLength(2);
    });
    
    test('should handle module with dependencies', async () => {
      legionModule.dependencies = {
        database: 'DatabaseConnection',
        cache: 'CacheService'
      };
      
      // Mock dependency resolution
      mockResourceManager.get.mockImplementation((key) => {
        if (key === 'DatabaseConnection') {
          return { query: jest.fn() };
        }
        if (key === 'CacheService') {
          return { get: jest.fn(), set: jest.fn() };
        }
        return null;
      });
      
      const databaseTool = {
        name: 'query',
        description: 'Database query tool',
        execute: async (params, context) => {
          const db = context.resourceManager.get('DatabaseConnection');
          if (!db) throw new Error('Database not available');
          
          return await db.query(params.sql);
        }
      };
      
      legionModule.registerTool(databaseTool);
      await toolExecutor.loadModule(legionModule);
      
      // Execute tool with dependencies
      const db = mockResourceManager.get('DatabaseConnection');
      db.query.mockResolvedValue([{ id: 1, name: 'Test' }]);
      
      const result = await toolExecutor.executeTool(
        'TestModule.query',
        { sql: 'SELECT * FROM users' }
      );
      
      expect(db.query).toHaveBeenCalledWith('SELECT * FROM users');
      expect(result).toEqual([{ id: 1, name: 'Test' }]);
    });
  });
  
  describe('Tool Execution with Zod Validation', () => {
    beforeEach(async () => {
      // Create tool with Zod schema (simulated)
      const zodTool = {
        name: 'validated',
        description: 'Tool with Zod validation',
        inputSchema: {
          parse: (input) => {
            // Simulate Zod validation
            const errors = [];
            
            if (typeof input.name !== 'string') {
              errors.push('name must be a string');
            }
            if (typeof input.age !== 'number') {
              errors.push('age must be a number');
            }
            if (input.age < 0 || input.age > 150) {
              errors.push('age must be between 0 and 150');
            }
            if (input.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email)) {
              errors.push('invalid email format');
            }
            
            if (errors.length > 0) {
              throw new Error(errors.join(', '));
            }
            
            return input;
          }
        },
        execute: async (params) => ({
          message: `Hello ${params.name}, age ${params.age}`
        })
      };
      
      legionModule.registerTool(zodTool);
      await toolExecutor.loadModule(legionModule);
    });
    
    test('should validate input parameters', async () => {
      // Valid input
      const result = await toolExecutor.executeTool(
        'TestModule.validated',
        { name: 'John', age: 30, email: 'john@example.com' }
      );
      
      expect(result).toEqual({
        message: 'Hello John, age 30'
      });
    });
    
    test('should reject invalid parameters', async () => {
      // Invalid age
      await expect(
        toolExecutor.executeTool(
          'TestModule.validated',
          { name: 'John', age: -5 }
        )
      ).rejects.toThrow('age must be between 0 and 150');
      
      // Invalid email
      await expect(
        toolExecutor.executeTool(
          'TestModule.validated',
          { name: 'John', age: 30, email: 'invalid-email' }
        )
      ).rejects.toThrow('invalid email format');
      
      // Wrong types
      await expect(
        toolExecutor.executeTool(
          'TestModule.validated',
          { name: 123, age: '30' }
        )
      ).rejects.toThrow('name must be a string, age must be a number');
    });
  });
  
  describe('Event Emission and Progress Tracking', () => {
    test('should emit progress events during execution', async () => {
      const events = [];
      
      const progressTool = {
        name: 'progress',
        description: 'Tool that emits progress',
        execute: async (params, context) => {
          context.emit('progress', { percentage: 0, status: 'Starting' });
          await new Promise(resolve => setTimeout(resolve, 10));
          
          context.emit('progress', { percentage: 25, status: 'Loading data' });
          await new Promise(resolve => setTimeout(resolve, 10));
          
          context.emit('progress', { percentage: 50, status: 'Processing' });
          await new Promise(resolve => setTimeout(resolve, 10));
          
          context.emit('progress', { percentage: 75, status: 'Finalizing' });
          await new Promise(resolve => setTimeout(resolve, 10));
          
          context.emit('progress', { percentage: 100, status: 'Complete' });
          
          return { result: 'Done' };
        }
      };
      
      legionModule.registerTool(progressTool);
      await toolExecutor.loadModule(legionModule);
      
      const context = {
        onEvent: (event, data) => {
          events.push({ event, data });
        }
      };
      
      const result = await toolExecutor.executeTool(
        'TestModule.progress',
        {},
        context
      );
      
      expect(result).toEqual({ result: 'Done' });
      expect(events).toHaveLength(5);
      expect(events[0]).toEqual({
        event: 'progress',
        data: { percentage: 0, status: 'Starting' }
      });
      expect(events[4]).toEqual({
        event: 'progress',
        data: { percentage: 100, status: 'Complete' }
      });
    });
    
    test('should emit info, warning, and error events', async () => {
      const events = [];
      
      const loggingTool = {
        name: 'logging',
        description: 'Tool that logs events',
        execute: async (params, context) => {
          context.emit('info', 'Processing started');
          context.emit('warning', 'Using default configuration');
          
          if (params.shouldError) {
            context.emit('error', 'An error occurred');
            throw new Error('Tool error');
          }
          
          context.emit('info', 'Processing completed');
          return { success: true };
        }
      };
      
      legionModule.registerTool(loggingTool);
      await toolExecutor.loadModule(legionModule);
      
      const context = {
        onEvent: (event, data) => {
          events.push({ event, data });
        }
      };
      
      // Successful execution
      await toolExecutor.executeTool(
        'TestModule.logging',
        { shouldError: false },
        context
      );
      
      expect(events).toContainEqual({ event: 'info', data: 'Processing started' });
      expect(events).toContainEqual({ event: 'warning', data: 'Using default configuration' });
      expect(events).toContainEqual({ event: 'info', data: 'Processing completed' });
      
      // Error execution
      events.length = 0;
      await expect(
        toolExecutor.executeTool(
          'TestModule.logging',
          { shouldError: true },
          context
        )
      ).rejects.toThrow('Tool error');
      
      expect(events).toContainEqual({ event: 'error', data: 'An error occurred' });
    });
  });
  
  describe('Result Serialization', () => {
    test('should serialize primitive results', async () => {
      const primitiveTool = {
        name: 'primitive',
        execute: async (params) => {
          switch (params.type) {
            case 'string': return 'Hello World';
            case 'number': return 42;
            case 'boolean': return true;
            case 'null': return null;
            case 'undefined': return undefined;
            default: return 'default';
          }
        }
      };
      
      legionModule.registerTool(primitiveTool);
      await toolExecutor.loadModule(legionModule);
      
      // String result
      const stringResult = await toolExecutor.executeTool(
        'TestModule.primitive',
        { type: 'string' }
      );
      expect(stringResult).toBe('Hello World');
      expect(JSON.stringify(stringResult)).toBe('"Hello World"');
      
      // Number result
      const numberResult = await toolExecutor.executeTool(
        'TestModule.primitive',
        { type: 'number' }
      );
      expect(numberResult).toBe(42);
      expect(JSON.stringify(numberResult)).toBe('42');
      
      // Boolean result
      const boolResult = await toolExecutor.executeTool(
        'TestModule.primitive',
        { type: 'boolean' }
      );
      expect(boolResult).toBe(true);
      expect(JSON.stringify(boolResult)).toBe('true');
    });
    
    test('should serialize complex objects', async () => {
      const complexTool = {
        name: 'complex',
        execute: async (params) => {
          return {
            user: {
              id: 1,
              name: 'John Doe',
              email: 'john@example.com',
              metadata: {
                created: new Date('2024-01-01').toISOString(),
                tags: ['admin', 'user'],
                settings: {
                  theme: 'dark',
                  notifications: true
                }
              }
            },
            stats: {
              total: 100,
              active: 75,
              percentages: [0.25, 0.5, 0.75, 1.0]
            }
          };
        }
      };
      
      legionModule.registerTool(complexTool);
      await toolExecutor.loadModule(legionModule);
      
      const result = await toolExecutor.executeTool('TestModule.complex', {});
      
      // Verify structure
      expect(result.user.id).toBe(1);
      expect(result.user.metadata.tags).toEqual(['admin', 'user']);
      expect(result.stats.percentages).toHaveLength(4);
      
      // Verify JSON serialization
      const json = JSON.stringify(result);
      const parsed = JSON.parse(json);
      
      expect(parsed.user.name).toBe('John Doe');
      expect(parsed.user.metadata.settings.theme).toBe('dark');
      expect(parsed.stats.total).toBe(100);
    });
    
    test('should handle circular references', async () => {
      const circularTool = {
        name: 'circular',
        execute: async () => {
          const obj = { name: 'Test' };
          obj.self = obj; // Circular reference
          return obj;
        }
      };
      
      legionModule.registerTool(circularTool);
      await toolExecutor.loadModule(legionModule);
      
      // Add circular reference handler
      toolExecutor.serializeResult = function(result) {
        const seen = new WeakSet();
        
        return JSON.stringify(result, (key, value) => {
          if (typeof value === 'object' && value !== null) {
            if (seen.has(value)) {
              return '[Circular]';
            }
            seen.add(value);
          }
          return value;
        });
      };
      
      const result = await toolExecutor.executeTool('TestModule.circular', {});
      const serialized = toolExecutor.serializeResult(result);
      const parsed = JSON.parse(serialized);
      
      expect(parsed.name).toBe('Test');
      expect(parsed.self).toBe('[Circular]');
    });
    
    test('should serialize binary data', async () => {
      const binaryTool = {
        name: 'binary',
        execute: async () => {
          // Simulate binary data (Buffer in Node.js)
          const buffer = Buffer.from('Hello World', 'utf8');
          
          return {
            data: buffer,
            base64: buffer.toString('base64'),
            hex: buffer.toString('hex')
          };
        }
      };
      
      legionModule.registerTool(binaryTool);
      await toolExecutor.loadModule(legionModule);
      
      // Add binary serialization
      toolExecutor.serializeResult = function(result) {
        return JSON.stringify(result, (key, value) => {
          if (Buffer.isBuffer(value)) {
            return {
              type: 'Buffer',
              data: value.toString('base64')
            };
          }
          return value;
        });
      };
      
      const result = await toolExecutor.executeTool('TestModule.binary', {});
      const serialized = toolExecutor.serializeResult(result);
      const parsed = JSON.parse(serialized);
      
      expect(parsed.data.type).toBe('Buffer');
      expect(parsed.base64).toBe('SGVsbG8gV29ybGQ=');
      expect(parsed.hex).toBe('48656c6c6f20576f726c64');
    });
  });
  
  describe('Error Propagation', () => {
    test('should propagate tool execution errors', async () => {
      const errorTool = {
        name: 'error',
        execute: async (params) => {
          if (params.errorType === 'sync') {
            throw new Error('Synchronous error');
          }
          
          if (params.errorType === 'async') {
            await new Promise(resolve => setTimeout(resolve, 10));
            throw new Error('Asynchronous error');
          }
          
          if (params.errorType === 'custom') {
            const error = new Error('Custom error');
            error.code = 'CUSTOM_ERROR';
            error.details = { param: params.value };
            throw error;
          }
          
          return { success: true };
        }
      };
      
      legionModule.registerTool(errorTool);
      await toolExecutor.loadModule(legionModule);
      
      // Synchronous error
      await expect(
        toolExecutor.executeTool('TestModule.error', { errorType: 'sync' })
      ).rejects.toThrow('Synchronous error');
      
      // Asynchronous error
      await expect(
        toolExecutor.executeTool('TestModule.error', { errorType: 'async' })
      ).rejects.toThrow('Asynchronous error');
      
      // Custom error with metadata
      try {
        await toolExecutor.executeTool('TestModule.error', { 
          errorType: 'custom',
          value: 'test123'
        });
      } catch (error) {
        expect(error.message).toBe('Custom error');
        expect(error.code).toBe('CUSTOM_ERROR');
        expect(error.details).toEqual({ param: 'test123' });
      }
    });
    
    test('should handle validation errors', async () => {
      const validationTool = {
        name: 'validation',
        inputSchema: {
          parse: (input) => {
            const errors = [];
            
            if (!input.required) {
              errors.push({ field: 'required', message: 'Field is required' });
            }
            
            if (input.number && typeof input.number !== 'number') {
              errors.push({ field: 'number', message: 'Must be a number' });
            }
            
            if (input.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email)) {
              errors.push({ field: 'email', message: 'Invalid email format' });
            }
            
            if (errors.length > 0) {
              const error = new Error('Validation failed');
              error.validationErrors = errors;
              throw error;
            }
            
            return input;
          }
        },
        execute: async (params) => ({ validated: true })
      };
      
      legionModule.registerTool(validationTool);
      await toolExecutor.loadModule(legionModule);
      
      try {
        await toolExecutor.executeTool('TestModule.validation', {
          number: 'not-a-number',
          email: 'invalid'
        });
      } catch (error) {
        expect(error.message).toContain('Validation failed');
        expect(error.validationErrors).toBeDefined();
        expect(error.validationErrors).toContainEqual({
          field: 'required',
          message: 'Field is required'
        });
      }
    });
    
    test('should handle timeout errors', async () => {
      const timeoutTool = {
        name: 'timeout',
        execute: async (params) => {
          await new Promise(resolve => setTimeout(resolve, params.delay || 1000));
          return { completed: true };
        }
      };
      
      legionModule.registerTool(timeoutTool);
      await toolExecutor.loadModule(legionModule);
      
      // Add timeout wrapper
      toolExecutor.executeWithTimeout = async function(toolId, params, timeout = 5000) {
        return Promise.race([
          this.executeTool(toolId, params),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Execution timeout')), timeout)
          )
        ]);
      };
      
      // Should timeout
      await expect(
        toolExecutor.executeWithTimeout('TestModule.timeout', { delay: 100 }, 50)
      ).rejects.toThrow('Execution timeout');
      
      // Should complete
      const result = await toolExecutor.executeWithTimeout(
        'TestModule.timeout',
        { delay: 10 },
        100
      );
      expect(result).toEqual({ completed: true });
    });
  });
  
  describe('Module Context and Dependencies', () => {
    test('should provide module context to tools', async () => {
      let capturedContext;
      
      const contextTool = {
        name: 'context',
        execute: async (params, context) => {
          capturedContext = context;
          return {
            hasResourceManager: !!context.resourceManager,
            hasModule: !!context.module,
            moduleName: context.module?.name
          };
        }
      };
      
      legionModule.registerTool(contextTool);
      await toolExecutor.loadModule(legionModule);
      
      const result = await toolExecutor.executeTool('TestModule.context', {});
      
      expect(result.hasResourceManager).toBe(true);
      expect(result.hasModule).toBe(true);
      expect(result.moduleName).toBe('TestModule');
      
      expect(capturedContext.resourceManager).toBe(mockResourceManager);
      expect(capturedContext.module).toBe(legionModule);
    });
    
    test('should share state between tools in same module', async () => {
      // Add shared state to module
      legionModule.state = { counter: 0 };
      
      const incrementTool = {
        name: 'increment',
        execute: async (params, context) => {
          context.module.state.counter += params.amount || 1;
          return { counter: context.module.state.counter };
        }
      };
      
      const getTool = {
        name: 'getCounter',
        execute: async (params, context) => {
          return { counter: context.module.state.counter };
        }
      };
      
      legionModule.registerTool(incrementTool);
      legionModule.registerTool(getTool);
      await toolExecutor.loadModule(legionModule);
      
      // Initial state
      let result = await toolExecutor.executeTool('TestModule.getCounter', {});
      expect(result.counter).toBe(0);
      
      // Increment
      result = await toolExecutor.executeTool('TestModule.increment', { amount: 5 });
      expect(result.counter).toBe(5);
      
      // Check state persisted
      result = await toolExecutor.executeTool('TestModule.getCounter', {});
      expect(result.counter).toBe(5);
      
      // Increment again
      result = await toolExecutor.executeTool('TestModule.increment', { amount: 3 });
      expect(result.counter).toBe(8);
    });
  });
});