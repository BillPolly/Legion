import { jest } from '@jest/globals';
import { Module } from '../src/module/Module.js';
import Tool from '../src/tool/Tool.js';

// Mock tools for testing
class MockTool1 extends Tool {
  constructor() {
    super();
    this.name = 'mock_tool_1';
    this.description = 'First mock tool';
  }
}

class MockTool2 extends Tool {
  constructor() {
    super();
    this.name = 'mock_tool_2';
    this.description = 'Second mock tool';
  }
}

// Test module with no dependencies
class NoDependencyModule extends Module {
  static dependencies = [];

  constructor() {
    super();
    this.name = 'no_dependency_module';
    this.tools = [
      new MockTool1()
    ];
  }
}

// Test module with dependencies
class WithDependencyModule extends Module {
  static dependencies = ['apiKey', 'config', 'logger'];

  constructor({ apiKey, config, logger }) {
    super();
    this.name = 'with_dependency_module';
    this.apiKey = apiKey;
    this.config = config;
    this.logger = logger;
    
    this.tools = [
      new MockTool1(),
      new MockTool2()
    ];
  }
}

describe('Module', () => {
  describe('constructor', () => {
    it('should initialize with empty tools array', () => {
      const module = new Module();
      expect(module.name).toBe('');
      expect(module.tools).toEqual([]);
      expect(Array.isArray(module.tools)).toBe(true);
    });

    it('should allow setting name and tools in subclass', () => {
      const module = new NoDependencyModule();
      expect(module.name).toBe('no_dependency_module');
      expect(module.tools).toHaveLength(1);
      expect(module.tools[0]).toBeInstanceOf(MockTool1);
    });
  });

  describe('getTools()', () => {
    it('should return empty array for base module', () => {
      const module = new Module();
      expect(module.getTools()).toEqual([]);
    });

    it('should return tools array', () => {
      const module = new NoDependencyModule();
      const tools = module.getTools();
      
      expect(tools).toHaveLength(1);
      expect(tools[0].name).toBe('mock_tool_1');
    });

    it('should return multiple tools', () => {
      const module = new WithDependencyModule({
        apiKey: 'test-key',
        config: {},
        logger: jest.fn()
      });
      
      const tools = module.getTools();
      expect(tools).toHaveLength(2);
      expect(tools[0].name).toBe('mock_tool_1');
      expect(tools[1].name).toBe('mock_tool_2');
    });

    it('should return the same array reference', () => {
      const module = new NoDependencyModule();
      const tools1 = module.getTools();
      const tools2 = module.getTools();
      
      expect(tools1).toBe(tools2); // Same reference
    });
  });

  describe('module with no dependencies', () => {
    it('should have empty dependencies array', () => {
      expect(NoDependencyModule.dependencies).toEqual([]);
    });

    it('should construct without arguments', () => {
      const module = new NoDependencyModule();
      expect(module).toBeDefined();
      expect(module.name).toBe('no_dependency_module');
    });

    it('should create tools without dependencies', () => {
      const module = new NoDependencyModule();
      expect(module.tools[0]).toBeDefined();
      expect(module.tools[0].name).toBe('mock_tool_1');
    });
  });

  describe('module with dependencies', () => {
    it('should have dependencies array', () => {
      expect(WithDependencyModule.dependencies).toEqual(['apiKey', 'config', 'logger']);
    });

    it('should receive dependencies in constructor', () => {
      const mockLogger = jest.fn();
      const mockConfig = { host: 'localhost' };
      
      const module = new WithDependencyModule({
        apiKey: 'test-api-key',
        config: mockConfig,
        logger: mockLogger
      });
      
      expect(module.apiKey).toBe('test-api-key');
      expect(module.config).toBe(mockConfig);
      expect(module.logger).toBe(mockLogger);
    });

    it('should create tools with access to dependencies', () => {
      const module = new WithDependencyModule({
        apiKey: 'test-key',
        config: { debug: true },
        logger: console.log
      });
      
      expect(module.tools).toHaveLength(2);
      // Module has access to dependencies to pass to tools
      expect(module.apiKey).toBe('test-key');
    });

    it('should handle missing dependencies gracefully', () => {
      // This would typically be caught by ModuleFactory, but module should handle it
      const module = new WithDependencyModule({});
      
      expect(module.apiKey).toBeUndefined();
      expect(module.config).toBeUndefined();
      expect(module.logger).toBeUndefined();
      expect(module.tools).toHaveLength(2); // Tools still created
    });
  });

  describe('edge cases', () => {
    it('should handle module with undefined static dependencies', () => {
      class NoStaticDepsModule extends Module {
        // No static dependencies property
        constructor() {
          super();
          this.name = 'no_static_deps';
        }
      }

      const module = new NoStaticDepsModule();
      expect(module.name).toBe('no_static_deps');
      expect(NoStaticDepsModule.dependencies).toBeUndefined();
    });

    it('should handle empty module name', () => {
      class EmptyNameModule extends Module {
        constructor() {
          super();
          // name not set
          this.tools = [new MockTool1()];
        }
      }

      const module = new EmptyNameModule();
      expect(module.name).toBe('');
      expect(module.tools).toHaveLength(1);
    });

    it('should allow adding tools after construction', () => {
      const module = new Module();
      expect(module.tools).toHaveLength(0);
      
      module.tools.push(new MockTool1());
      expect(module.tools).toHaveLength(1);
      
      module.tools.push(new MockTool2());
      expect(module.tools).toHaveLength(2);
    });

    it('should not share tools between instances', () => {
      const module1 = new NoDependencyModule();
      const module2 = new NoDependencyModule();
      
      expect(module1.tools).not.toBe(module2.tools);
      expect(module1.tools[0]).not.toBe(module2.tools[0]);
    });
  });
});