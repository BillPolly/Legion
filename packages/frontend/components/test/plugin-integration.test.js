/**
 * Plugin Integration Tests
 * Tests the plugin system isolation, security, and functionality
 */

import { ParserPluginManager, PluginError } from '../src/components/tree-scribe/features/plugins/ParserPluginManager.js';
import csvPluginModule from '../src/components/tree-scribe/features/plugins/examples/csv-parser-plugin.js';
import tomlPluginModule from '../src/components/tree-scribe/features/plugins/examples/toml-parser-plugin.js';

describe('Plugin System Integration', () => {
  let pluginManager;

  beforeEach(() => {
    pluginManager = new ParserPluginManager({
      sandbox: true,
      maxPlugins: 10,
      maxParseTime: 2000,
      maxMemory: 10 * 1024 * 1024 // 10MB
    });
  });

  afterEach(() => {
    // Clean up all registered plugins
    const formats = pluginManager.getFormats();
    formats.forEach(format => {
      pluginManager.unregister(format);
    });
  });

  describe('Plugin Registration', () => {
    test('should register CSV plugin successfully', async () => {
      await pluginManager.register('csv', csvPluginModule);
      
      expect(pluginManager.getFormats()).toContain('csv');
      expect(pluginManager.getMetadata('csv')).toEqual(csvPluginModule.metadata);
    });

    test('should register TOML plugin successfully', async () => {
      await pluginManager.register('toml', tomlPluginModule);
      
      expect(pluginManager.getFormats()).toContain('toml');
      expect(pluginManager.getMetadata('toml')).toEqual(tomlPluginModule.metadata);
    });

    test('should reject invalid plugin structure', async () => {
      const invalidPlugin = {
        // Missing metadata
        Parser: class TestParser {}
      };

      await expect(pluginManager.register('invalid', invalidPlugin))
        .rejects.toThrow(PluginError);
    });

    test('should reject plugin with missing metadata fields', async () => {
      const invalidPlugin = {
        metadata: {
          name: 'TestParser'
          // Missing required fields
        },
        Parser: class TestParser {}
      };

      await expect(pluginManager.register('invalid', invalidPlugin))
        .rejects.toThrow(PluginError);
    });

    test('should reject plugin without Parser class', async () => {
      const invalidPlugin = {
        metadata: {
          name: 'TestParser',
          version: '1.0.0',
          author: 'Test',
          description: 'Test parser'
        }
        // Missing Parser class
      };

      await expect(pluginManager.register('invalid', invalidPlugin))
        .rejects.toThrow(PluginError);
    });

    test('should enforce plugin limit', async () => {
      const limitedManager = new ParserPluginManager({ maxPlugins: 1 });
      
      await limitedManager.register('csv', csvPluginModule);
      
      await expect(limitedManager.register('toml', tomlPluginModule))
        .rejects.toThrow('Maximum number of plugins reached');
    });
  });

  describe('Plugin Parsing', () => {
    beforeEach(async () => {
      await pluginManager.register('csv', csvPluginModule);
      await pluginManager.register('toml', tomlPluginModule);
    });

    test('should parse CSV content correctly', async () => {
      const csvContent = `Name,Age,City
John,30,New York
Jane,25,London`;

      const result = await pluginManager.parse('csv', csvContent);
      
      expect(result.title).toBe('CSV Document');
      expect(result.children).toHaveLength(2); // 2 data rows
      expect(result.sourceFormat).toBe('csv');
      expect(result.children[0].title).toBe('John');
    });

    test('should parse TOML content correctly', async () => {
      const tomlContent = `title = "Test Config"

[database]
server = "192.168.1.1"
ports = [8001, 8002]`;

      const result = await pluginManager.parse('toml', tomlContent);
      
      expect(result.title).toBe('TOML Configuration');
      expect(result.sourceFormat).toBe('toml');
      expect(result.children).toHaveLength(2); // title + database section
    });

    test('should handle parsing errors gracefully', async () => {
      const invalidCsv = 'not,valid,csv\nwith\nincompatible\nrows';
      
      const result = await pluginManager.parse('csv', invalidCsv);
      
      // Should return error node instead of throwing
      expect(result.title).toBe('CSV Parse Error');
      expect(result.contentType).toBe('error');
      expect(result.metadata.error).toBe(true);
    });

    test('should enforce parse timeout', async () => {
      const quickManager = new ParserPluginManager({ maxParseTime: 10 });
      await quickManager.register('csv', csvPluginModule);
      
      // Create large CSV that might take time to parse
      const largeCsv = 'Name,Data\n' + Array(10000).fill('Test,Data').join('\n');
      
      await expect(quickManager.parse('csv', largeCsv))
        .rejects.toThrow('Parse timeout exceeded');
    });
  });

  describe('Plugin Isolation', () => {
    test('should isolate plugins from each other', async () => {
      await pluginManager.register('csv', csvPluginModule);
      await pluginManager.register('toml', tomlPluginModule);
      
      const csvParser = pluginManager.getParser('csv');
      const tomlParser = pluginManager.getParser('toml');
      
      // Each parser should be independent
      expect(csvParser).not.toBe(tomlParser);
      expect(csvParser.getName()).toBe('CsvParser');
      expect(tomlParser.getName()).toBe('TomlParser');
    });

    test('should prevent plugin from accessing global state', async () => {
      // Create malicious plugin that tries to access global state
      const maliciousPlugin = {
        metadata: {
          name: 'MaliciousParser',
          version: '1.0.0',
          author: 'Hacker',
          description: 'Malicious parser'
        },
        Parser: class MaliciousParser {
          getName() { return 'MaliciousParser'; }
          getSupportedFormats() { return ['malicious']; }
          canParse() { return 1.0; }
          validate() { return { valid: true, errors: [] }; }
          
          parse(content) {
            // Try to access global state
            try {
              // This should fail in a proper sandbox
              globalThis.document = 'hacked';
              window.location = 'https://evil.com';
            } catch (e) {
              // Expected to fail
            }
            
            return {
              title: 'Malicious Result',
              children: [],
              metadata: { attempted: 'hack' }
            };
          }
        }
      };

      // Should register successfully (detection happens at runtime)
      await pluginManager.register('malicious', maliciousPlugin);
      
      // Parse should work but not cause damage
      const result = await pluginManager.parse('malicious', 'test');
      expect(result.title).toBe('Malicious Result');
      
      // Global state should be unchanged
      expect(globalThis.document).not.toBe('hacked');
    });

    test('should limit resource usage', async () => {
      // Create resource-intensive plugin
      const resourcePlugin = {
        metadata: {
          name: 'ResourceParser',
          version: '1.0.0',
          author: 'Test',
          description: 'Resource intensive parser'
        },
        Parser: class ResourceParser {
          getName() { return 'ResourceParser'; }
          getSupportedFormats() { return ['resource']; }
          canParse() { return 1.0; }
          validate() { return { valid: true, errors: [] }; }
          
          parse(content) {
            // Try to create many nodes
            const children = [];
            for (let i = 0; i < 100000; i++) {
              children.push({
                title: `Node ${i}`,
                content: `Content for node ${i}`,
                children: []
              });
            }
            
            return {
              title: 'Resource Intensive Result',
              children,
              sourceFormat: 'resource'
            };
          }
        }
      };

      await pluginManager.register('resource', resourcePlugin);
      
      // Should fail due to node count limit
      await expect(pluginManager.parse('resource', 'test'))
        .rejects.toThrow('Node count limit exceeded');
    });
  });

  describe('Plugin Management', () => {
    test('should unregister plugin successfully', async () => {
      await pluginManager.register('csv', csvPluginModule);
      expect(pluginManager.getFormats()).toContain('csv');
      
      pluginManager.unregister('csv');
      expect(pluginManager.getFormats()).not.toContain('csv');
      expect(pluginManager.getParser('csv')).toBeNull();
    });

    test('should provide accurate statistics', async () => {
      await pluginManager.register('csv', csvPluginModule);
      
      const csvContent = 'Name,Age\nJohn,30\nJane,25';
      await pluginManager.parse('csv', csvContent);
      await pluginManager.parse('csv', csvContent);
      
      const stats = pluginManager.getStatistics();
      expect(stats.totalPlugins).toBe(1);
      expect(stats.plugins.csv.metrics.uses).toBe(2);
      expect(stats.plugins.csv.averageParseTime).toBeGreaterThan(0);
    });

    test('should handle plugin errors in statistics', async () => {
      await pluginManager.register('csv', csvPluginModule);
      
      // Cause an error
      try {
        await pluginManager.parse('csv', null);
      } catch (e) {
        // Expected error
      }
      
      const stats = pluginManager.getStatistics();
      expect(stats.plugins.csv.metrics.errors).toBe(1);
    });
  });

  describe('Plugin Validation', () => {
    test('should validate parser implementation', async () => {
      const incompletePlugin = {
        metadata: {
          name: 'IncompleteParser',
          version: '1.0.0',
          author: 'Test',
          description: 'Incomplete parser'
        },
        Parser: class IncompleteParser {
          getName() { return 'IncompleteParser'; }
          // Missing required methods
        }
      };

      await expect(pluginManager.register('incomplete', incompletePlugin))
        .rejects.toThrow('Parser missing required method');
    });

    test('should validate parse results', async () => {
      const badResultPlugin = {
        metadata: {
          name: 'BadResultParser',
          version: '1.0.0',
          author: 'Test',
          description: 'Returns invalid results'
        },
        Parser: class BadResultParser {
          getName() { return 'BadResultParser'; }
          getSupportedFormats() { return ['bad']; }
          canParse() { return 1.0; }
          validate() { return { valid: true, errors: [] }; }
          
          parse() {
            // Return invalid result structure
            return {
              // Missing title
              content: 'Bad result'
            };
          }
        }
      };

      await pluginManager.register('bad', badResultPlugin);
      
      await expect(pluginManager.parse('bad', 'test'))
        .rejects.toThrow('Parse result must have a title');
    });
  });

  describe('Plugin Examples Functionality', () => {
    test('CSV parser should handle hierarchical data', async () => {
      await pluginManager.register('csv', csvPluginModule);
      
      const hierarchicalCsv = `id,name,parent,type
1,Root,,folder
2,Child1,1,file
3,Child2,1,file
4,Grandchild,2,file`;

      const result = await pluginManager.parse('csv', hierarchicalCsv, {
        hierarchyColumn: 'parent'
      });
      
      expect(result.title).toBe('CSV Document');
      expect(result.children[0].title).toBe('Root');
      expect(result.children[0].children).toHaveLength(2); // Child1 and Child2
    });

    test('CSV parser should handle grouping', async () => {
      await pluginManager.register('csv', csvPluginModule);
      
      const groupedCsv = `Name,Department,Salary
John,Engineering,80000
Jane,Engineering,85000
Bob,Marketing,60000
Alice,Marketing,65000`;

      const result = await pluginManager.parse('csv', groupedCsv, {
        groupBy: 'Department'
      });
      
      expect(result.children).toHaveLength(2); // Engineering and Marketing groups
      expect(result.children[0].title).toContain('Department:');
    });

    test('TOML parser should handle complex structures', async () => {
      await pluginManager.register('toml', tomlPluginModule);
      
      const complexToml = `title = "Complex Config"

[database]
server = "localhost"
ports = [5432, 5433]
enabled = true

[[plugins]]
name = "auth"
enabled = true

[[plugins]]
name = "cache"
enabled = false`;

      const result = await pluginManager.parse('toml', complexToml);
      
      expect(result.children).toHaveLength(3); // title, database, plugins
      
      // Check array of tables
      const pluginsSection = result.children.find(child => 
        child.title.includes('plugins')
      );
      expect(pluginsSection).toBeDefined();
      expect(pluginsSection.children).toHaveLength(2); // 2 plugin entries
    });
  });

  describe('Security Edge Cases', () => {
    test('should prevent eval-based code injection', async () => {
      const evalPlugin = {
        metadata: {
          name: 'EvalParser',
          version: '1.0.0',
          author: 'Test',
          description: 'Tries to use eval'
        },
        Parser: class EvalParser {
          getName() { return 'EvalParser'; }
          getSupportedFormats() { return ['eval']; }
          canParse() { return 1.0; }
          validate() { return { valid: true, errors: [] }; }
          
          parse(content) {
            try {
              // This should be blocked
              eval('globalThis.hacked = true');
            } catch (e) {
              // Expected
            }
            
            return {
              title: 'Eval Result',
              children: []
            };
          }
        }
      };

      await pluginManager.register('eval', evalPlugin);
      await pluginManager.parse('eval', 'test');
      
      // Should not be hacked
      expect(globalThis.hacked).toBeUndefined();
    });

    test('should prevent Function constructor abuse', async () => {
      const functionPlugin = {
        metadata: {
          name: 'FunctionParser',
          version: '1.0.0', 
          author: 'Test',
          description: 'Tries to use Function constructor'
        },
        Parser: class FunctionParser {
          getName() { return 'FunctionParser'; }
          getSupportedFormats() { return ['function']; }
          canParse() { return 1.0; }
          validate() { return { valid: true, errors: [] }; }
          
          parse(content) {
            try {
              // This should be blocked or fail
              const fn = new Function('return globalThis');
              const global = fn();
              global.hacked = true;
            } catch (e) {
              // Expected
            }
            
            return {
              title: 'Function Result',
              children: []
            };
          }
        }
      };

      await pluginManager.register('function', functionPlugin);
      await pluginManager.parse('function', 'test');
      
      // Should not be hacked
      expect(globalThis.hacked).toBeUndefined();
    });
  });
});

describe('Plugin Development Workflow', () => {
  test('should support plugin introspection workflow', async () => {
    const pluginManager = new ParserPluginManager();
    
    // 1. Register plugin
    await pluginManager.register('csv', csvPluginModule);
    
    // 2. Get parser capabilities
    const parser = pluginManager.getParser('csv');
    const capabilities = parser.getCapabilities();
    
    expect(capabilities).toHaveProperty('features');
    expect(capabilities).toHaveProperty('options');
    expect(capabilities.features).toContain('auto-delimiter');
    
    // 3. Test format detection
    const csvContent = 'Name,Age\nJohn,30';
    const confidence = parser.canParse(csvContent);
    expect(confidence).toBeGreaterThan(0.8);
    
    // 4. Validate content
    const validation = parser.validate(csvContent);
    expect(validation.valid).toBe(true);
    
    // 5. Parse content
    const result = await pluginManager.parse('csv', csvContent);
    expect(result.title).toBe('CSV Document');
  });

  test('should provide comprehensive error information', async () => {
    const pluginManager = new ParserPluginManager();
    
    try {
      await pluginManager.parse('nonexistent', 'test');
    } catch (error) {
      expect(error).toBeInstanceOf(PluginError);
      expect(error.plugin).toBe('nonexistent');
      expect(error.message).toContain('No plugin registered');
    }
  });
});