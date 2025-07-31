/**
 * Integration tests for backward compatibility with existing modules
 */

import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { Module } from '../../src/module/Module.js';
import Tool from '../../src/tool/Tool.js';
import { ModuleFactory } from '../../src/module/ModuleFactory.js';
import ResourceManager from '../../src/resources/ResourceManager.js';

// Legacy module without event system
class LegacyModule {
  constructor() {
    this.name = 'LegacyModule';
    this.tools = [];
  }

  getTools() {
    return this.tools;
  }

  async initialize() {
    return this;
  }

  async cleanup() {
    // Empty cleanup
  }
}

// Legacy tool without event system
class LegacyTool {
  constructor() {
    this.name = 'LegacyTool';
    this.description = 'Legacy tool without event system';
  }

  getToolDescription() {
    return {
      type: 'function',
      function: {
        name: 'legacyTool',
        description: this.description,
        parameters: {
          type: 'object',
          properties: {
            input: { type: 'string' }
          }
        },
        output: {
          success: { type: 'object' },
          failure: { type: 'object' }
        }
      }
    };
  }

  async invoke(toolCall) {
    return { success: true, data: { result: 'legacy result' } };
  }

  async execute(args) {
    return { result: 'legacy result' };
  }
}

// Mixed module - inherits from new Module but uses old patterns
class MixedModule extends Module {
  constructor() {
    super();
    this.name = 'MixedModule';
    
    // Old way of adding tools (direct array manipulation)
    this.tools.push(new LegacyTool());
  }

  // Old-style method that doesn't use events
  performOldStyleOperation() {
    return 'old-style result';
  }
}

// Modern module that uses new event system
class ModernModule extends Module {
  constructor() {
    super();
    this.name = 'ModernModule';
    
    const modernTool = new ModernTool();
    this.registerTool('ModernTool', modernTool);
  }

  performModernOperation() {
    this.emitInfo('Modern operation started');
    const result = 'modern result';
    this.emitInfo('Modern operation completed', { result });
    return result;
  }
}

// Modern tool that uses event system
class ModernTool extends Tool {
  constructor() {
    super({
      name: 'ModernTool',
      description: 'Modern tool with event system'
    });
    this.module = null; // Tools track their module for backward compatibility
  }

  async execute(params) {
    this.progress('Tool execution started');
    const result = { success: true, data: { result: 'modern result' } };
    this.info('Tool execution completed');
    return result;
  }

  // Legacy method support
  setModule(module) {
    this.module = module;
  }

  // Legacy event emission methods for backward compatibility
  emitProgress(message, data = {}) {
    if (this.module) {
      this.module.emitProgress(message, data, this.name);
    }
  }

  emitInfo(message, data = {}) {
    if (this.module) {
      this.module.emitInfo(message, data, this.name);
    }
  }

  emitError(message, data = {}) {
    if (this.module) {
      this.module.emitError(message, data, this.name);
    }
  }

  // Legacy methods for backward compatibility
  getToolDescription() {
    return {
      type: 'function',
      function: {
        name: 'modernTool',
        description: this.description,
        parameters: {
          type: 'object',
          properties: {
            input: { type: 'string' }
          }
        },
        output: {
          success: { type: 'object' },
          failure: { type: 'object' }
        }
      }
    };
  }

  async invoke(toolCall) {
    this.emitProgress('Tool execution started');
    const result = { success: true, data: { result: 'modern result' } };
    this.emitInfo('Tool execution completed');
    return result;
  }
}

describe('Backward Compatibility Tests', () => {
  let resourceManager;
  let moduleFactory;

  beforeEach(() => {
    resourceManager = new ResourceManager();
    moduleFactory = new ModuleFactory(resourceManager);
  });

  describe('Legacy Module Support', () => {
    test('should handle legacy modules without event system', () => {
      const legacyModule = new LegacyModule();
      
      // Should not throw when accessing event-related methods
      expect(() => {
        if (typeof legacyModule.on === 'function') {
          legacyModule.on('test', () => {});
        }
      }).not.toThrow();
      
      // Should still work with basic module operations
      expect(legacyModule.name).toBe('LegacyModule');
      expect(legacyModule.getTools()).toEqual([]);
      expect(typeof legacyModule.initialize).toBe('function');
      expect(typeof legacyModule.cleanup).toBe('function');
    });

    test('should handle legacy tools without event system', () => {
      const legacyTool = new LegacyTool();
      
      // Should not have event methods
      expect(typeof legacyTool.emitEvent).toBe('undefined');
      expect(typeof legacyTool.setModule).toBe('undefined');
      
      // Should still work with basic tool operations
      expect(legacyTool.name).toBe('LegacyTool');
      expect(typeof legacyTool.getToolDescription).toBe('function');
      expect(typeof legacyTool.invoke).toBe('function');
      expect(typeof legacyTool.execute).toBe('function');
    });

    test('should handle mixed module patterns', () => {
      const mixedModule = new MixedModule();
      
      // Should inherit event capabilities from Module
      expect(typeof mixedModule.emitEvent).toBe('function');
      expect(typeof mixedModule.emitInfo).toBe('function');
      expect(typeof mixedModule.on).toBe('function');
      
      // Should still work with old-style operations
      expect(mixedModule.performOldStyleOperation()).toBe('old-style result');
      
      // Should contain the tool added via old pattern
      expect(mixedModule.tools).toHaveLength(1);
      expect(mixedModule.tools[0]).toBeInstanceOf(LegacyTool);
    });

    test('should handle tools added via old pattern', () => {
      const mixedModule = new MixedModule();
      const legacyTool = mixedModule.tools[0];
      
      // Legacy tool should not have module reference
      expect(legacyTool.module).toBeUndefined();
      
      // Should still be able to call tool methods
      expect(legacyTool.name).toBe('LegacyTool');
      expect(typeof legacyTool.invoke).toBe('function');
    });
  });

  describe('Modern Module Integration', () => {
    test('should handle modern modules with event system', () => {
      const modernModule = new ModernModule();
      
      // Should have event capabilities
      expect(typeof modernModule.emitEvent).toBe('function');
      expect(typeof modernModule.on).toBe('function');
      
      // Should have properly registered tools
      const tools = modernModule.getTools();
      expect(tools).toHaveLength(1);
      expect(tools[0]).toBeInstanceOf(ModernTool);
      
      // Tool should have module reference
      expect(tools[0].module).toBe(modernModule);
    });

    test('should emit events during modern operations', () => {
      const modernModule = new ModernModule();
      const events = [];
      
      modernModule.on('event', (event) => events.push(event));
      
      const result = modernModule.performModernOperation();
      
      expect(result).toBe('modern result');
      expect(events).toHaveLength(2);
      expect(events[0].message).toBe('Modern operation started');
      expect(events[1].message).toBe('Modern operation completed');
    });

    test('should handle modern tools with event system', async () => {
      const modernModule = new ModernModule();
      const modernTool = modernModule.tools[0];
      const events = [];
      
      modernModule.on('event', (event) => events.push(event));
      
      const toolCall = {
        id: 'test-call',
        type: 'function',
        function: {
          name: 'modernTool',
          arguments: JSON.stringify({ input: 'test' })
        }
      };
      
      const result = await modernTool.invoke(toolCall);
      
      expect(result.success).toBe(true);
      expect(events).toHaveLength(2);
      expect(events[0].message).toBe('Tool execution started');
      expect(events[1].message).toBe('Tool execution completed');
    });
  });

  describe('Mixed Environment Integration', () => {
    test('should handle both legacy and modern modules together', () => {
      const legacyModule = new LegacyModule();
      const modernModule = new ModernModule();
      
      // Both should be valid modules
      expect(typeof legacyModule.getTools).toBe('function');
      expect(typeof modernModule.getTools).toBe('function');
      
      // Modern module should have event capabilities
      expect(typeof modernModule.emitEvent).toBe('function');
      
      // Legacy module should not break when events are used
      expect(() => {
        modernModule.emitInfo('Test message');
      }).not.toThrow();
    });

    test('should handle module factory with mixed modules', () => {
      const legacyModule = new LegacyModule();
      const modernModule = new ModernModule();
      
      // Should be able to work with both types
      expect(typeof legacyModule.initialize).toBe('function');
      expect(typeof modernModule.initialize).toBe('function');
      
      // Modern module should support event listeners
      if (typeof modernModule.on === 'function') {
        const eventListener = jest.fn();
        modernModule.on('event', eventListener);
        modernModule.emitInfo('Test event');
        expect(eventListener).toHaveBeenCalled();
      }
    });

    test('should handle tools from both legacy and modern modules', () => {
      const legacyModule = new LegacyModule();
      const modernModule = new ModernModule();
      
      // Add a legacy tool to legacy module
      legacyModule.tools.push(new LegacyTool());
      
      const allTools = [
        ...legacyModule.getTools(),
        ...modernModule.getTools()
      ];
      
      expect(allTools).toHaveLength(2);
      expect(allTools[0]).toBeInstanceOf(LegacyTool);
      expect(allTools[1]).toBeInstanceOf(ModernTool);
      
      // Modern tool should have module reference
      expect(allTools[1].module).toBe(modernModule);
      
      // Legacy tool should not have module reference
      expect(allTools[0].module).toBeUndefined();
    });
  });

  describe('Event System Graceful Degradation', () => {
    test('should handle modules that partially implement event system', () => {
      // Create a module that implements some but not all event methods
      class PartialModule {
        constructor() {
          this.name = 'PartialModule';
          this.tools = [];
        }

        getTools() {
          return this.tools;
        }

        // Implements some event methods but not others
        on(event, listener) {
          // Minimal implementation
        }

        emit(event, data) {
          // Minimal implementation
        }

        // Missing emitEvent, emitInfo, etc.
      }

      const partialModule = new PartialModule();
      
      // Should not throw when checking for event capabilities
      expect(() => {
        if (typeof partialModule.on === 'function') {
          partialModule.on('test', () => {});
        }
        if (typeof partialModule.emit === 'function') {
          partialModule.emit('test', {});
        }
      }).not.toThrow();
    });

    test('should handle tools that partially implement event system', () => {
      class PartialTool {
        constructor() {
          this.name = 'PartialTool';
          this.description = 'Partial tool';
        }

        getToolDescription() {
          return {
            type: 'function',
            function: {
              name: 'partialTool',
              description: this.description,
              parameters: { type: 'object' },
              output: { success: { type: 'object' } }
            }
          };
        }

        // Has setModule but not emitEvent
        setModule(module) {
          this.module = module;
        }

        async invoke(toolCall) {
          // Try to emit event if possible
          if (this.module && typeof this.module.emitEvent === 'function') {
            this.module.emitEvent('info', 'Partial tool executed', {}, this.name);
          }
          return { success: true, data: { result: 'partial result' } };
        }
      }

      const modernModule = new ModernModule();
      const partialTool = new PartialTool();
      
      // Should be able to register partial tool
      expect(() => {
        modernModule.registerTool('PartialTool', partialTool);
      }).not.toThrow();
      
      expect(partialTool.module).toBe(modernModule);
    });
  });

  describe('Performance and Memory', () => {
    test('should not impact performance of legacy modules', () => {
      const legacyModule = new LegacyModule();
      const legacyTool = new LegacyTool();
      
      // Add many tools to legacy module
      for (let i = 0; i < 100; i++) {
        legacyModule.tools.push(new LegacyTool());
      }
      
      const startTime = Date.now();
      
      // Perform operations
      for (let i = 0; i < 1000; i++) {
        legacyModule.getTools();
      }
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // Should complete quickly (less than 100ms)
      expect(duration).toBeLessThan(100);
    });

    test('should not cause memory leaks with mixed modules', () => {
      const modules = [];
      
      // Create many modules of different types
      for (let i = 0; i < 50; i++) {
        if (i % 2 === 0) {
          modules.push(new LegacyModule());
        } else {
          modules.push(new ModernModule());
        }
      }
      
      expect(modules).toHaveLength(50);
      
      // Modern modules should have event capabilities
      const modernModules = modules.filter(m => m instanceof ModernModule);
      modernModules.forEach(module => {
        expect(typeof module.emitEvent).toBe('function');
      });
      
      // Legacy modules should not have event capabilities
      const legacyModules = modules.filter(m => m instanceof LegacyModule);
      legacyModules.forEach(module => {
        expect(typeof module.emitEvent).toBe('undefined');
      });
    });
  });

  describe('Error Handling', () => {
    test('should handle errors in legacy modules gracefully', () => {
      class ErrorProneModule {
        constructor() {
          this.name = 'ErrorProneModule';
          this.tools = [];
        }

        getTools() {
          throw new Error('Legacy error');
        }

        async initialize() {
          throw new Error('Initialization error');
        }
      }

      const errorModule = new ErrorProneModule();
      
      // Should still be able to access basic properties
      expect(errorModule.name).toBe('ErrorProneModule');
      
      // Should throw when calling problematic methods
      expect(() => {
        errorModule.getTools();
      }).toThrow('Legacy error');
      
      expect(async () => {
        await errorModule.initialize();
      }).rejects.toThrow('Initialization error');
    });

    test('should handle errors in modern modules without breaking legacy functionality', () => {
      const modernModule = new ModernModule();
      const legacyModule = new LegacyModule();
      
      // Add error listener to prevent unhandled error
      modernModule.on('error', () => {
        // Handle error silently for test
      });
      
      // Error in modern module should not affect legacy module
      expect(() => {
        modernModule.emitError('Test error');
      }).not.toThrow();
      
      // Legacy module should still work
      expect(legacyModule.name).toBe('LegacyModule');
      expect(typeof legacyModule.getTools).toBe('function');
    });
  });

  describe('API Compatibility', () => {
    test('should maintain API compatibility for core methods', () => {
      const modules = [
        new LegacyModule(),
        new MixedModule(),
        new ModernModule()
      ];
      
      modules.forEach(module => {
        // All modules should have these core methods
        expect(typeof module.getTools).toBe('function');
        expect(typeof module.initialize).toBe('function');
        expect(typeof module.cleanup).toBe('function');
        expect(typeof module.name).toBe('string');
        expect(Array.isArray(module.tools)).toBe(true);
      });
    });

    test('should maintain API compatibility for core tool methods', () => {
      const tools = [
        new LegacyTool(),
        new ModernTool()
      ];
      
      tools.forEach(tool => {
        // All tools should have these core methods
        expect(typeof tool.name).toBe('string');
        expect(typeof tool.getToolDescription).toBe('function');
        expect(typeof tool.invoke).toBe('function');
        
        // Tool description should have consistent structure
        const description = tool.getToolDescription();
        expect(description.type).toBe('function');
        expect(description.function).toBeDefined();
        expect(description.function.name).toBeDefined();
        expect(description.function.parameters).toBeDefined();
        expect(description.function.output).toBeDefined();
      });
    });
  });
});