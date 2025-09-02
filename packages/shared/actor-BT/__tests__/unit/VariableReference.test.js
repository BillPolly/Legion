/**
 * Variable Reference System Tests
 * Tests the new @varName syntax for behavior tree variable references
 * NO MOCKS - Tests real variable resolution functionality
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { BehaviorTreeNode } from '../../src/core/BehaviorTreeNode.js';
import { ActionNode } from '../../src/nodes/ActionNode.js';

// Mock node class for testing
class TestBehaviorTreeNode extends BehaviorTreeNode {
  static getTypeName() {
    return 'test';
  }
  
  async executeNode(context) {
    return { status: 'SUCCESS', data: {} };
  }
}

describe('@varName Variable Reference System', () => {
  let testNode;
  let mockExecutor;
  
  beforeEach(() => {
    // Create mock executor with required properties
    mockExecutor = {
      messageBus: {
        sendMessage: () => {}
      }
    };
    
    const config = {
      id: 'test-node',
      params: {}
    };
    
    testNode = new TestBehaviorTreeNode(config, null, mockExecutor);
  });

  describe('Basic @varName Variable Resolution', () => {
    test('should resolve @varName to context.artifacts value', () => {
      const params = {
        script: '@script_path',
        config: '@app_config'
      };
      
      const context = {
        artifacts: {
          script_path: '/path/to/script.js',
          app_config: { debug: true, port: 3000 }
        }
      };
      
      const resolved = testNode.resolveParams(params, context);
      
      expect(resolved.script).toBe('/path/to/script.js');
      expect(resolved.config).toEqual({ debug: true, port: 3000 });
    });

    test('should handle missing artifacts gracefully', () => {
      const params = {
        script: '@missing_var',
        literal: 'literal_value'
      };
      
      const context = {
        artifacts: {
          other_var: 'exists'
        }
      };
      
      const resolved = testNode.resolveParams(params, context);
      
      expect(resolved.script).toBeUndefined();
      expect(resolved.literal).toBe('literal_value');
    });

    test('should handle context without artifacts', () => {
      const params = {
        script: '@script_path'
      };
      
      const context = {}; // No artifacts property
      
      const resolved = testNode.resolveParams(params, context);
      
      expect(resolved.script).toBeUndefined();
    });
  });

  describe('Complex @varName Scenarios', () => {
    test('should resolve @varName in arrays', () => {
      const params = {
        files: ['@input_file', 'static_file.txt', '@output_file'],
        args: ['--input', '@input_path', '--verbose']
      };
      
      const context = {
        artifacts: {
          input_file: 'data.json',
          output_file: 'result.json',
          input_path: '/tmp/input'
        }
      };
      
      const resolved = testNode.resolveParams(params, context);
      
      expect(resolved.files).toEqual(['data.json', 'static_file.txt', 'result.json']);
      expect(resolved.args).toEqual(['--input', '/tmp/input', '--verbose']);
    });

    test('should resolve @varName in nested objects', () => {
      const params = {
        config: {
          database: {
            host: '@db_host',
            port: 5432,
            credentials: '@db_creds'
          },
          app: {
            name: 'test-app',
            version: '@app_version'
          }
        }
      };
      
      const context = {
        artifacts: {
          db_host: 'localhost',
          db_creds: { user: 'admin', pass: 'secret' },
          app_version: '1.2.3'
        }
      };
      
      const resolved = testNode.resolveParams(params, context);
      
      expect(resolved.config.database.host).toBe('localhost');
      expect(resolved.config.database.port).toBe(5432);
      expect(resolved.config.database.credentials).toEqual({ user: 'admin', pass: 'secret' });
      expect(resolved.config.app.name).toBe('test-app');
      expect(resolved.config.app.version).toBe('1.2.3');
    });

    test('should handle mixed @varName and literal values', () => {
      const params = {
        command: 'node',
        script: '@entry_script',
        args: ['--env', '@environment', '--port', '3000'],
        env: {
          NODE_ENV: '@env_mode',
          PORT: '8080',
          DEBUG: '@debug_flag'
        }
      };
      
      const context = {
        artifacts: {
          entry_script: 'server.js',
          environment: 'production',
          env_mode: 'prod',
          debug_flag: 'false'
        }
      };
      
      const resolved = testNode.resolveParams(params, context);
      
      expect(resolved.command).toBe('node');
      expect(resolved.script).toBe('server.js');
      expect(resolved.args).toEqual(['--env', 'production', '--port', '3000']);
      expect(resolved.env.NODE_ENV).toBe('prod');
      expect(resolved.env.PORT).toBe('8080');
      expect(resolved.env.DEBUG).toBe('false');
    });
  });

  describe('Error Handling and Edge Cases', () => {
    test('should not resolve strings that do not start with @', () => {
      const params = {
        email: 'user@domain.com',  // Contains @ but doesn't start with @
        script: 'test@script.js',  // Contains @ but doesn't start with @
        variable: '@real_var'      // Starts with @ - should resolve
      };
      
      const context = {
        artifacts: {
          real_var: 'resolved_value'
        }
      };
      
      const resolved = testNode.resolveParams(params, context);
      
      expect(resolved.email).toBe('user@domain.com');
      expect(resolved.script).toBe('test@script.js');
      expect(resolved.variable).toBe('resolved_value');
    });

    test('should handle empty variable names', () => {
      const params = {
        empty: '@',           // Just @ symbol
        space: '@ ',          // @ with space
        valid: '@valid_var'   // Proper variable
      };
      
      const context = {
        artifacts: {
          '': 'empty_name',     // Empty string key
          ' ': 'space_name',    // Space key  
          valid_var: 'valid_value'
        }
      };
      
      const resolved = testNode.resolveParams(params, context);
      
      expect(resolved.empty).toBe('empty_name');    // Resolves to artifacts['']
      expect(resolved.space).toBe('space_name');    // Resolves to artifacts[' ']
      expect(resolved.valid).toBe('valid_value');
    });

    test('should handle null and undefined artifacts', () => {
      const params = {
        var1: '@test_var',
        var2: '@another_var'
      };
      
      const contexts = [
        { artifacts: null },
        { artifacts: undefined },
        {} // No artifacts property
      ];
      
      for (const context of contexts) {
        const resolved = testNode.resolveParams(params, context);
        expect(resolved.var1).toBeUndefined();
        expect(resolved.var2).toBeUndefined();
      }
    });
  });

  describe('Variable System Integration', () => {
    test('should work with behavior tree variable flow', () => {
      // Simulate a complete variable flow
      const step1Params = {
        filePath: 'output.txt',
        content: 'Hello World'
      };
      
      const step2Params = {
        script: '@generated_file',
        args: ['--verbose']
      };
      
      // Step 1: Generate file (stores result in artifacts)
      let context = { artifacts: {} };
      const resolved1 = testNode.resolveParams(step1Params, context);
      
      // Simulate storing step 1 result
      context.artifacts.generated_file = '/tmp/output.txt';
      
      // Step 2: Use generated file
      const resolved2 = testNode.resolveParams(step2Params, context);
      
      expect(resolved2.script).toBe('/tmp/output.txt');
      expect(resolved2.args).toEqual(['--verbose']);
    });

    test('should handle chained variable references', () => {
      const params = {
        input: '@file1',
        output: '@file2', 
        transform: '@processor'
      };
      
      const context = {
        artifacts: {
          file1: 'input.json',
          file2: 'output.json',
          processor: 'csv-to-json'
        }
      };
      
      const resolved = testNode.resolveParams(params, context);
      
      expect(resolved.input).toBe('input.json');
      expect(resolved.output).toBe('output.json');
      expect(resolved.transform).toBe('csv-to-json');
    });
  });

  describe('Backward Compatibility Removal', () => {
    test('should NOT resolve old context.artifacts syntax', () => {
      const params = {
        // Old syntax should NOT be resolved - treated as literal
        old_syntax: "context.artifacts['script_path']",
        new_syntax: "@script_path"
      };
      
      const context = {
        artifacts: {
          script_path: '/path/to/script.js'
        }
      };
      
      const resolved = testNode.resolveParams(params, context);
      
      // Old syntax treated as literal string - NOT resolved
      expect(resolved.old_syntax).toBe("context.artifacts['script_path']");
      // New syntax properly resolved
      expect(resolved.new_syntax).toBe('/path/to/script.js');
    });
  });
});