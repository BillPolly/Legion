import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { TabCompleter } from '../../src/interactive/TabCompleter.js';

describe('TabCompleter', () => {
  let tabCompleter;
  let mockModuleLoader;
  let mockToolRegistry;
  let completerFunction;

  beforeEach(() => {
    mockModuleLoader = {
      getModules: jest.fn(),
      getModuleInfo: jest.fn()
    };
    
    mockToolRegistry = {
      getToolsByModule: jest.fn(),
      getToolByName: jest.fn(),
      discoverTools: jest.fn().mockReturnValue(new Map([
        ['calculator.add', { name: 'add', module: 'calculator' }],
        ['calculator.subtract', { name: 'subtract', module: 'calculator' }],
        ['calculator.evaluate', { name: 'evaluate', module: 'calculator' }],
        ['file.read', { name: 'read', module: 'file' }],
        ['file.write', { name: 'write', module: 'file' }]
      ]))
    };
    
    // Set up mock modules
    const mockModules = new Map([
      ['calculator', { name: 'calculator', functionCount: 3 }],
      ['file', { name: 'file', functionCount: 2 }],
      ['http', { name: 'http', functionCount: 4 }]
    ]);
    
    mockModuleLoader.getModules.mockReturnValue(mockModules);
    mockModuleLoader.getModuleInfo.mockImplementation(name => mockModules.get(name));
    
    // Mock getToolByName
    mockToolRegistry.getToolByName.mockImplementation(name => {
      const tools = {
        'calculator.add': {
          name: 'add',
          module: 'calculator',
          parameters: {
            properties: {
              a: { type: 'number' },
              b: { type: 'number' }
            }
          }
        }
      };
      return tools[name];
    });
    
    mockToolRegistry.getToolsByModule.mockImplementation(module => {
      if (module === 'calculator') {
        return [
          { name: 'add', module: 'calculator' },
          { name: 'subtract', module: 'calculator' },
          { name: 'evaluate', module: 'calculator' }
        ];
      } else if (module === 'file') {
        return [
          { name: 'read', module: 'file' },
          { name: 'write', module: 'file' }
        ];
      }
      return [];
    });
    
    tabCompleter = new TabCompleter(mockModuleLoader, mockToolRegistry);
    completerFunction = tabCompleter.getCompleter();
  });

  describe('getCompleter', () => {
    it('should return a completer function', () => {
      expect(typeof completerFunction).toBe('function');
    });

    it('should complete module names', async () => {
      const [completions, line] = await completerFunction('calc');
      
      expect(completions).toContain('calculator');
      expect(line).toBe('calc');
    });

    it('should complete multiple matching modules', async () => {
      // Add more modules that start with 'fi'
      const mockModules = new Map([
        ['file', { name: 'file' }],
        ['filesystem', { name: 'filesystem' }],
        ['filter', { name: 'filter' }]
      ]);
      mockModuleLoader.getModules.mockReturnValue(mockModules);
      
      const [completions, line] = await completerFunction('fi');
      
      expect(completions).toContain('file');
      expect(completions).toContain('filesystem');
      expect(completions).toContain('filter');
      expect(line).toBe('fi');
    });

    it('should complete tool names after module.', async () => {
      const [completions, line] = await completerFunction('calculator.');
      
      expect(completions).toContain('calculator.add');
      expect(completions).toContain('calculator.subtract');
      expect(completions).toContain('calculator.evaluate');
      expect(line).toBe('calculator.');
    });

    it('should complete tool names with partial match', async () => {
      const [completions, line] = await completerFunction('calculator.a');
      
      expect(completions).toContain('calculator.add');
      expect(completions).not.toContain('calculator.subtract');
      expect(line).toBe('calculator.a');
    });

    it('should complete special commands', async () => {
      const [completions, line] = await completerFunction('ex');
      
      expect(completions).toContain('exit');
      expect(line).toBe('ex');
    });

    it('should complete help topics', async () => {
      const [completions, line] = await completerFunction('help calc');
      
      expect(completions).toContain('calculator');
      expect(line).toBe('help calc');
    });

    it('should return empty completions inside quotes', async () => {
      const [completions, line] = await completerFunction('"incomplete string');
      
      expect(completions).toEqual([]);
      expect(line).toBe('"incomplete string');
    });

    it('should complete with trailing space', async () => {
      const [completions, line] = await completerFunction('calculator.add ');
      
      // Should suggest parameter names or nothing
      expect(Array.isArray(completions)).toBe(true);
      expect(line).toBe('calculator.add ');
    });

    it('should handle empty input', async () => {
      const [completions, line] = await completerFunction('');
      
      // Should include special commands and modules
      expect(completions).toContain('exit');
      expect(completions).toContain('help');
      expect(completions).toContain('calculator');
      expect(line).toBe('');
    });

    it('should complete parameter names after tool', async () => {
      // Mock tool with parameters
      mockToolRegistry.getToolsByModule.mockImplementation(module => {
        if (module === 'calculator') {
          return [{
            name: 'add',
            module: 'calculator',
            parameters: {
              properties: {
                a: { type: 'number' },
                b: { type: 'number' }
              }
            }
          }];
        }
        return [];
      });
      
      const [completions, line] = await completerFunction('calculator.add --');
      
      expect(completions).toContain('--a');
      expect(completions).toContain('--b');
      expect(line).toBe('calculator.add --');
    });

    it('should not complete tool names for non-existent module', async () => {
      const [completions, line] = await completerFunction('nonexistent.');
      
      expect(completions).toEqual([]);
      expect(line).toBe('nonexistent.');
    });

    it('should handle complex command lines', async () => {
      const [completions, line] = await completerFunction('calculator.add --a 5 --b');
      
      // Should not include --a again since it's already used
      expect(completions).not.toContain('--a');
      expect(line).toBe('calculator.add --a 5 --b');
    });
  });
});