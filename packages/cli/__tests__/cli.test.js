import { jest } from '@jest/globals';
import CLI from '../src/index.js';

describe('CLI', () => {
  describe('initialization', () => {
    it('should create a CLI instance', () => {
      const cli = new CLI();
      expect(cli).toBeInstanceOf(CLI);
    });

    it('should initialize with default properties', () => {
      const cli = new CLI();
      expect(cli.args).toBeUndefined();
      expect(cli.options).toBeUndefined();
      expect(cli.resourceManager).toBeUndefined();
      expect(cli.moduleFactory).toBeUndefined();
    });

    it('should have a run method', () => {
      const cli = new CLI();
      expect(typeof cli.run).toBe('function');
    });

    it('should have a parseArgs method', () => {
      const cli = new CLI();
      expect(typeof cli.parseArgs).toBe('function');
    });

    it('should have a loadModules method', () => {
      const cli = new CLI();
      expect(typeof cli.loadModules).toBe('function');
    });

    it('should have a executeCommand method', () => {
      const cli = new CLI();
      expect(typeof cli.executeCommand).toBe('function');
    });
  });

  describe('run method', () => {
    let cli;
    let consoleLogSpy;
    let consoleErrorSpy;
    let processExitSpy;

    beforeEach(() => {
      cli = new CLI();
      consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
      consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      processExitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {});
    });

    afterEach(() => {
      consoleLogSpy.mockRestore();
      consoleErrorSpy.mockRestore();
      processExitSpy.mockRestore();
    });

    it('should parse arguments when run is called', async () => {
      const parseArgsSpy = jest.spyOn(cli, 'parseArgs').mockImplementation(() => {});
      const loadModulesSpy = jest.spyOn(cli, 'loadModules').mockImplementation(() => {});
      const executeCommandSpy = jest.spyOn(cli, 'executeCommand').mockImplementation(() => {});

      await cli.run(['node', 'jsenvoy']);

      expect(parseArgsSpy).toHaveBeenCalledWith(['node', 'jsenvoy']);
      
      parseArgsSpy.mockRestore();
      loadModulesSpy.mockRestore();
      executeCommandSpy.mockRestore();
    });

    it('should handle errors gracefully', async () => {
      jest.spyOn(cli, 'parseArgs').mockImplementation(() => {
        throw new Error('Test error');
      });

      await cli.run(['node', 'jsenvoy']);

      expect(consoleErrorSpy).toHaveBeenCalledWith('Error:', 'Test error');
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });
  });
});