import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { ListCommand } from '../../src/commands/ListCommand.js';

describe('ListCommand', () => {
  let listCommand;
  let mockModuleLoader;
  let mockToolRegistry;
  let mockConfigManager;
  let mockOutputFormatter;

  beforeEach(() => {
    mockModuleLoader = {
      getModules: jest.fn(),
      getModuleMetadata: jest.fn()
    };
    
    mockToolRegistry = {
      getToolsForModule: jest.fn(),
      getAllTools: jest.fn()
    };
    
    mockConfigManager = {
      getAliases: jest.fn(),
      getPresets: jest.fn()
    };
    
    mockOutputFormatter = {
      formatModuleList: jest.fn(),
      formatToolList: jest.fn(),
      formatAliasList: jest.fn(),
      formatPresetList: jest.fn()
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
  });

  describe('execute', () => {
    describe('list all', () => {
      it('should list all modules and tools', async () => {
        const mockModules = new Map([
          ['calculator', { name: 'calculator', description: 'Math tools' }],
          ['file', { name: 'file', description: 'File operations' }]
        ]);
        
        mockModuleLoader.getModules.mockReturnValue(mockModules);
        mockModuleLoader.getModuleMetadata.mockImplementation(name => ({
          name,
          description: mockModules.get(name).description,
          toolCount: 2
        }));
        
        mockToolRegistry.getAllTools.mockReturnValue([
          { fullName: 'calculator.add', module: 'calculator', name: 'add' },
          { fullName: 'calculator.subtract', module: 'calculator', name: 'subtract' },
          { fullName: 'file.read', module: 'file', name: 'read' },
          { fullName: 'file.write', module: 'file', name: 'write' }
        ]);
        
        await listCommand.execute({
          command: 'list',
          listType: 'all'
        }, {});
        
        expect(mockOutputFormatter.formatModuleList).toHaveBeenCalledWith(
          expect.arrayContaining([
            expect.objectContaining({ name: 'calculator' }),
            expect.objectContaining({ name: 'file' })
          ]),
          {}
        );
        
        expect(mockOutputFormatter.formatToolList).toHaveBeenCalledWith(
          expect.arrayContaining([
            expect.objectContaining({ fullName: 'calculator.add' }),
            expect.objectContaining({ fullName: 'file.read' })
          ]),
          {},
          null
        );
      });
    });

    describe('list modules', () => {
      it('should list only modules', async () => {
        const mockModules = new Map([
          ['calculator', { name: 'calculator' }],
          ['file', { name: 'file' }]
        ]);
        
        mockModuleLoader.getModules.mockReturnValue(mockModules);
        mockModuleLoader.getModuleMetadata.mockImplementation(name => ({
          name,
          toolCount: 1
        }));
        
        await listCommand.execute({
          command: 'list',
          listType: 'modules'
        }, {});
        
        expect(mockOutputFormatter.formatModuleList).toHaveBeenCalled();
        expect(mockOutputFormatter.formatToolList).not.toHaveBeenCalled();
      });
    });

    describe('list tools', () => {
      it('should list all tools', async () => {
        mockToolRegistry.getAllTools.mockReturnValue([
          { fullName: 'calculator.add' },
          { fullName: 'file.read' }
        ]);
        
        await listCommand.execute({
          command: 'list',
          listType: 'tools'
        }, {});
        
        expect(mockOutputFormatter.formatToolList).toHaveBeenCalledWith(
          expect.arrayContaining([
            expect.objectContaining({ fullName: 'calculator.add' }),
            expect.objectContaining({ fullName: 'file.read' })
          ]),
          {},
          null
        );
        expect(mockOutputFormatter.formatModuleList).not.toHaveBeenCalled();
      });

      it('should list tools for specific module', async () => {
        mockToolRegistry.getToolsForModule.mockReturnValue([
          { name: 'add', description: 'Add numbers' },
          { name: 'subtract', description: 'Subtract numbers' }
        ]);
        
        await listCommand.execute({
          command: 'list',
          listType: 'tools',
          options: { module: 'calculator' }
        }, {});
        
        expect(mockToolRegistry.getToolsForModule).toHaveBeenCalledWith('calculator');
        expect(mockOutputFormatter.formatToolList).toHaveBeenCalledWith(
          expect.arrayContaining([
            expect.objectContaining({ 
              fullName: 'calculator.add',
              module: 'calculator'
            })
          ]),
          {},
          'calculator'
        );
      });
    });

    describe('list aliases', () => {
      it('should list all aliases', async () => {
        mockConfigManager.getAliases.mockReturnValue({
          calc: 'calculator.evaluate',
          ls: 'file.list'
        });
        
        await listCommand.execute({
          command: 'list',
          listType: 'aliases'
        }, {});
        
        expect(mockOutputFormatter.formatAliasList).toHaveBeenCalledWith(
          {
            calc: 'calculator.evaluate',
            ls: 'file.list'
          },
          {}
        );
      });
    });

    describe('list presets', () => {
      it('should list all presets', async () => {
        mockConfigManager.getPresets.mockReturnValue({
          debug: { verbose: true, output: 'json' },
          production: { verbose: false, color: false }
        });
        
        await listCommand.execute({
          command: 'list',
          listType: 'presets'
        }, {});
        
        expect(mockOutputFormatter.formatPresetList).toHaveBeenCalledWith(
          {
            debug: { verbose: true, output: 'json' },
            production: { verbose: false, color: false }
          },
          {}
        );
      });
    });

    it('should handle invalid list type', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      
      await listCommand.execute({
        command: 'list',
        listType: 'invalid'
      }, {});
      
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Invalid list type')
      );
      
      consoleErrorSpy.mockRestore();
    });

    it('should handle empty results gracefully', async () => {
      mockModuleLoader.getModules.mockReturnValue(new Map());
      mockToolRegistry.getAllTools.mockReturnValue([]);
      
      await listCommand.execute({
        command: 'list',
        listType: 'all'
      }, {});
      
      expect(mockOutputFormatter.formatModuleList).toHaveBeenCalledWith([], {});
      expect(mockOutputFormatter.formatToolList).toHaveBeenCalledWith([], {}, null);
    });
  });
});