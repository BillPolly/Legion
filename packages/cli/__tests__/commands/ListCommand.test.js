import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { ListCommand } from '../../src/commands/ListCommand.js';

describe('ListCommand', () => {
  let listCommand;
  let mockModuleLoader;
  let mockToolRegistry;
  let mockConfigManager;
  let mockOutputFormatter;
  let consoleLogSpy;

  beforeEach(() => {
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
    mockModuleLoader = {
      getModules: jest.fn()
    };
    
    mockToolRegistry = {
      getToolsByModule: jest.fn(),
      discoverTools: jest.fn()
    };
    
    mockConfigManager = {
      getAliases: jest.fn(),
      getPresets: jest.fn()
    };
    
    mockOutputFormatter = {
      formatTable: jest.fn()
    };
    
    listCommand = new ListCommand(
      mockModuleLoader,
      mockToolRegistry,
      mockConfigManager,
      mockOutputFormatter
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
    consoleLogSpy.mockRestore();
  });

  describe('execute', () => {
    describe('list all', () => {
      it('should list all modules and tools', async () => {
        const mockModules = new Map([
          ['calculator', { 
            name: 'calculator', 
            description: 'Math tools',
            functionCount: 2,
            dependencies: [],
            tools: []
          }],
          ['file', { 
            name: 'file', 
            description: 'File operations',
            functionCount: 2,
            dependencies: ['fs'],
            tools: []
          }]
        ]);
        
        mockModuleLoader.getModules.mockReturnValue(mockModules);
        
        const mockTools = new Map([
          ['calculator.add', { name: 'add', module: 'calculator', description: 'Add numbers' }],
          ['calculator.subtract', { name: 'subtract', module: 'calculator', description: 'Subtract numbers' }],
          ['file.read', { name: 'read', module: 'file', description: 'Read file' }],
          ['file.write', { name: 'write', module: 'file', description: 'Write file' }]
        ]);
        mockToolRegistry.discoverTools.mockReturnValue(mockTools);
        
        await listCommand.execute({
          command: 'list',
          listType: 'all'
        }, {});
        
        // Should print module and tool information
        expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('=== jsEnvoy CLI ==='));
        expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Modules:'));
        expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Tools:'));
      });
    });

    describe('list modules', () => {
      it('should list only modules', async () => {
        const mockModules = new Map([
          ['calculator', { 
            name: 'calculator',
            functionCount: 1,
            dependencies: [],
            tools: []
          }],
          ['file', { 
            name: 'file',
            functionCount: 1,
            dependencies: [],
            tools: []
          }]
        ]);
        
        mockModuleLoader.getModules.mockReturnValue(mockModules);
        
        await listCommand.execute({
          command: 'list',
          listType: 'modules'
        }, {});
        
        expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Available Modules'));
      });
    });

    describe('list tools', () => {
      it('should list all tools', async () => {
        const mockTools = new Map([
          ['calculator.add', { name: 'add', module: 'calculator', description: 'Add numbers' }],
          ['file.read', { name: 'read', module: 'file', description: 'Read file' }]
        ]);
        mockToolRegistry.discoverTools.mockReturnValue(mockTools);
        
        await listCommand.execute({
          command: 'list',
          listType: 'tools'
        }, {});
        
        expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Available Tools'));
      });

      it('should list tools for specific module', async () => {
        const mockTools = new Map([
          ['calculator.add', { name: 'add', module: 'calculator', description: 'Add numbers' }],
          ['calculator.subtract', { name: 'subtract', module: 'calculator', description: 'Subtract numbers' }],
          ['file.read', { name: 'read', module: 'file', description: 'Read file' }]
        ]);
        mockToolRegistry.discoverTools.mockReturnValue(mockTools);
        
        await listCommand.execute({
          command: 'list',
          listType: 'tools',
          args: { module: 'calculator' }
        }, {});
        
        expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Available Tools'));
      });
    });

    describe('list aliases', () => {
      it('should list all aliases', async () => {
        await listCommand.execute({
          command: 'list',
          listType: 'aliases'
        }, {
          aliases: {
            calc: 'calculator.evaluate',
            ls: 'file.list'
          }
        });
        
        expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Available Aliases'));
      });
    });

    describe('list presets', () => {
      it('should list all presets', async () => {
        await listCommand.execute({
          command: 'list',
          listType: 'presets'
        }, {
          presets: {
            debug: { verbose: true, output: 'json' },
            production: { verbose: false, color: false }
          }
        });
        
        expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Available Presets'));
      });
    });

    it('should handle invalid list type', async () => {
      // Invalid types default to 'all' 
      mockModuleLoader.getModules.mockReturnValue(new Map());
      mockToolRegistry.discoverTools.mockReturnValue(new Map());
      
      await listCommand.execute({
        command: 'list',
        listType: 'invalid'
      }, {});
      
      // Should have called listAll
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('=== jsEnvoy CLI ==='));
    });

    it('should handle empty results gracefully', async () => {
      mockModuleLoader.getModules.mockReturnValue(new Map());
      mockToolRegistry.discoverTools.mockReturnValue(new Map());
      
      await listCommand.execute({
        command: 'list',
        listType: 'all'
      }, {});
      
      expect(consoleLogSpy).toHaveBeenCalledWith('  No modules found');
      expect(consoleLogSpy).toHaveBeenCalledWith('  No tools found');
    });
  });
});