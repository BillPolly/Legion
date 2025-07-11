import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { InteractiveCommand } from '../../src/commands/InteractiveCommand.js';
import readline from 'readline';

// Mock readline module
jest.mock('readline');

describe('InteractiveCommand', () => {
  let interactiveCommand;
  let mockInteractiveMode;
  let mockReadlineInterface;
  let consoleLogSpy;

  beforeEach(() => {
    // Create mock readline interface
    mockReadlineInterface = {
      setPrompt: jest.fn(),
      prompt: jest.fn(),
      on: jest.fn(),
      close: jest.fn()
    };
    
    // Mock readline.createInterface
    readline.createInterface = jest.fn().mockReturnValue(mockReadlineInterface);
    
    // Create mock interactive mode
    mockInteractiveMode = {
      start: jest.fn().mockResolvedValue(),
      getCompleter: jest.fn().mockReturnValue((line, callback) => {
        // Mock completer function
        callback(null, [['help', 'exit', 'list'], line]);
      })
    };
    
    interactiveCommand = new InteractiveCommand(mockInteractiveMode);
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
  });

  afterEach(() => {
    jest.clearAllMocks();
    consoleLogSpy.mockRestore();
  });

  describe('execute', () => {
    it('should start interactive mode with readline interface', async () => {
      await interactiveCommand.execute({}, {});
      
      // Verify readline interface was created
      expect(readline.createInterface).toHaveBeenCalledWith({
        input: process.stdin,
        output: process.stdout,
        prompt: 'jsenvoy> ',
        completer: expect.any(Function)
      });
      
      // Verify interactive mode was started
      expect(mockInteractiveMode.start).toHaveBeenCalledWith(
        mockReadlineInterface,
        {}
      );
    });

    it('should display welcome message', async () => {
      await interactiveCommand.execute({}, {});
      
      expect(consoleLogSpy).toHaveBeenCalledWith();
      expect(consoleLogSpy).toHaveBeenCalledWith('jsEnvoy Interactive Mode');
      expect(consoleLogSpy).toHaveBeenCalledWith('Type "help" for commands, "exit" to quit');
    });

    it('should display colored welcome message when color is enabled', async () => {
      await interactiveCommand.execute({}, { color: true });
      
      // The actual chalk output includes ANSI codes, so we check that it was called
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('jsEnvoy Interactive Mode'));
    });

    it('should display plain welcome message when color is disabled', async () => {
      await interactiveCommand.execute({}, { color: false });
      
      expect(consoleLogSpy).toHaveBeenCalledWith('jsEnvoy Interactive Mode');
    });

    it('should pass config to interactive mode', async () => {
      const config = {
        verbose: true,
        interactive: {
          prompt: '>> ',
          history: { max: 500 }
        }
      };
      
      await interactiveCommand.execute({}, config);
      
      expect(mockInteractiveMode.start).toHaveBeenCalledWith(
        mockReadlineInterface,
        config
      );
    });

    it('should get completer from interactive mode', async () => {
      await interactiveCommand.execute({}, {});
      
      expect(mockInteractiveMode.getCompleter).toHaveBeenCalled();
      
      // Verify the completer was passed to readline
      const createInterfaceCall = readline.createInterface.mock.calls[0][0];
      expect(createInterfaceCall.completer).toBeDefined();
    });

    it('should handle errors from interactive mode', async () => {
      const error = new Error('Interactive mode failed');
      mockInteractiveMode.start.mockRejectedValue(error);
      
      await expect(
        interactiveCommand.execute({}, {})
      ).rejects.toThrow('Interactive mode failed');
    });
  });
});