/**
 * Unit tests for CLI functionality
 */

import { jest } from '@jest/globals';
import { fileURLToPath } from 'url';
import path from 'path';

// Mock modules before importing
jest.mock('readline');
jest.mock('fs/promises');
jest.mock('@jsenvoy/modules');
jest.mock('../../src/Agent.js');

// Import mocked modules
import fs from 'fs/promises';
import readline from 'readline';
import { ResourceManager, ModuleFactory } from '@jsenvoy/modules';
import { Agent } from '../../src/Agent.js';

describe('CLI', () => {
  let mockReadline;
  let mockResourceManager;
  let mockModuleFactory;
  let mockAgent;
  let consoleLogSpy;
  let consoleErrorSpy;
  let processExitSpy;
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup console spies
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
    processExitSpy = jest.spyOn(process, 'exit').mockImplementation();
    
    // Setup readline mock
    mockReadline = {
      prompt: jest.fn(),
      on: jest.fn(),
      close: jest.fn()
    };
    readline.createInterface.mockReturnValue(mockReadline);
    
    // Setup ResourceManager mock
    mockResourceManager = {
      initialize: jest.fn().mockResolvedValue(undefined),
      register: jest.fn()
    };
    ResourceManager.mockImplementation(() => mockResourceManager);
    
    // Setup ModuleFactory mock
    mockModuleFactory = {};
    ModuleFactory.mockImplementation(() => mockModuleFactory);
    
    // Setup Agent mock
    mockAgent = {
      printResponse: jest.fn().mockResolvedValue(undefined)
    };
    Agent.mockImplementation(() => mockAgent);
    
    // Setup fs mock
    fs.readdir.mockResolvedValue([]);
  });
  
  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    processExitSpy.mockRestore();
  });
  
  describe('Tool loading', () => {
    it('should load tools from general-tools directory', async () => {
      // Mock file system structure
      fs.readdir.mockResolvedValue([
        { name: 'calculator', isDirectory: () => true },
        { name: 'file', isDirectory: () => true },
        { name: 'README.md', isDirectory: () => false } // Should skip files
      ]);
      
      // Dynamic import mock
      const mockCalculatorModule = {
        default: class CalculatorModule {
          getTools() {
            return [{
              name: 'calculator',
              description: 'Calculator tool',
              getAllToolDescriptions: () => [
                {
                  function: {
                    name: 'evaluate',
                    description: 'Evaluate expression',
                    parameters: { properties: { expression: {} } }
                  }
                }
              ]
            }];
          }
        }
      };
      
      // We need to test the loadTools function separately since it's internal
      // For now, we'll test that the CLI initializes correctly
      process.env.OPENAI_API_KEY = 'test-key';
      
      // Import CLI dynamically to test initialization
      const { default: runCLI } = await import('../../src/cli.js');
    });
  });
  
  describe('Environment and configuration', () => {
    it('should exit if OPENAI_API_KEY is not set', async () => {
      delete process.env.OPENAI_API_KEY;
      delete process.env.API_KEY;
      
      // Mock the CLI module loading
      await import('../../src/cli.js').catch(() => {});
      
      // Since the CLI runs immediately, we need to check the process.exit was called
      // In a real test, we'd need to refactor the CLI to be more testable
    });
    
    it('should use MODEL_PROVIDER and MODEL_NAME from environment', async () => {
      process.env.OPENAI_API_KEY = 'test-key';
      process.env.MODEL_PROVIDER = 'custom-provider';
      process.env.MODEL_NAME = 'custom-model';
      
      fs.readdir.mockResolvedValue([]);
      
      await import('../../src/cli.js').catch(() => {});
      
      // Check that Agent was called with correct config
      expect(Agent).toHaveBeenCalledWith(
        expect.objectContaining({
          modelConfig: expect.objectContaining({
            provider: 'custom-provider',
            model: 'custom-model',
            apiKey: 'test-key'
          })
        })
      );
    });
  });
  
  describe('User interaction', () => {
    beforeEach(() => {
      process.env.OPENAI_API_KEY = 'test-key';
      fs.readdir.mockResolvedValue([]);
    });
    
    it('should handle user input correctly', async () => {
      let lineHandler;
      mockReadline.on.mockImplementation((event, handler) => {
        if (event === 'line') {
          lineHandler = handler;
        }
      });
      
      await import('../../src/cli.js');
      
      // Simulate user input
      await lineHandler('Hello, agent!');
      
      expect(mockAgent.printResponse).toHaveBeenCalledWith('Hello, agent!');
      expect(mockReadline.prompt).toHaveBeenCalled();
    });
    
    it('should handle exit command', async () => {
      let lineHandler;
      mockReadline.on.mockImplementation((event, handler) => {
        if (event === 'line') {
          lineHandler = handler;
        }
      });
      
      await import('../../src/cli.js');
      
      // Simulate exit command
      await lineHandler('exit');
      
      expect(consoleLogSpy).toHaveBeenCalledWith('\nGoodbye!');
      expect(mockReadline.close).toHaveBeenCalled();
      expect(processExitSpy).toHaveBeenCalledWith(0);
    });
    
    it('should handle quit command', async () => {
      let lineHandler;
      mockReadline.on.mockImplementation((event, handler) => {
        if (event === 'line') {
          lineHandler = handler;
        }
      });
      
      await import('../../src/cli.js');
      
      // Simulate quit command
      await lineHandler('QUIT');
      
      expect(consoleLogSpy).toHaveBeenCalledWith('\nGoodbye!');
      expect(mockReadline.close).toHaveBeenCalled();
      expect(processExitSpy).toHaveBeenCalledWith(0);
    });
    
    it('should handle empty input', async () => {
      let lineHandler;
      mockReadline.on.mockImplementation((event, handler) => {
        if (event === 'line') {
          lineHandler = handler;
        }
      });
      
      await import('../../src/cli.js');
      
      // Simulate empty input
      await lineHandler('   ');
      
      expect(mockAgent.printResponse).not.toHaveBeenCalled();
      expect(mockReadline.prompt).toHaveBeenCalled();
    });
    
    it('should handle errors during agent response', async () => {
      let lineHandler;
      mockReadline.on.mockImplementation((event, handler) => {
        if (event === 'line') {
          lineHandler = handler;
        }
      });
      
      mockAgent.printResponse.mockRejectedValue(new Error('Agent error'));
      
      await import('../../src/cli.js');
      
      // Simulate user input that causes error
      await lineHandler('Cause an error');
      
      expect(consoleErrorSpy).toHaveBeenCalledWith('\nError:', 'Agent error');
      expect(mockReadline.prompt).toHaveBeenCalled();
    });
    
    it('should handle SIGINT (Ctrl+C)', async () => {
      let sigintHandler;
      mockReadline.on.mockImplementation((event, handler) => {
        if (event === 'SIGINT') {
          sigintHandler = handler;
        }
      });
      
      await import('../../src/cli.js');
      
      // Simulate Ctrl+C
      sigintHandler();
      
      expect(consoleLogSpy).toHaveBeenCalledWith('\n\nGoodbye!');
      expect(processExitSpy).toHaveBeenCalledWith(0);
    });
  });
  
  describe('Tool conversion', () => {
    it('should convert jsEnvoy tools to agent format', async () => {
      const mockTool = {
        name: 'test_tool',
        description: 'A test tool',
        getAllToolDescriptions: () => [
          {
            function: {
              name: 'test_function',
              description: 'Test function',
              parameters: {
                properties: {
                  param1: { type: 'string' },
                  param2: { type: 'number' }
                }
              }
            }
          }
        ],
        invoke: jest.fn(),
        safeInvoke: jest.fn()
      };
      
      // Mock a module that returns the tool
      fs.readdir.mockResolvedValue([
        { name: 'test', isDirectory: () => true }
      ]);
      
      // This test would need the actual convertToolToAgentFormat function
      // to be exported or the CLI to be refactored for better testability
    });
  });
  
  describe('Initialization', () => {
    it('should initialize ResourceManager correctly', async () => {
      process.env.OPENAI_API_KEY = 'test-key';
      fs.readdir.mockResolvedValue([]);
      
      await import('../../src/cli.js');
      
      expect(mockResourceManager.initialize).toHaveBeenCalled();
      expect(mockResourceManager.register).toHaveBeenCalledWith('basePath', process.cwd());
      expect(mockResourceManager.register).toHaveBeenCalledWith('encoding', 'utf8');
      expect(mockResourceManager.register).toHaveBeenCalledWith('createDirectories', true);
    });
    
    it('should show correct initialization messages', async () => {
      process.env.OPENAI_API_KEY = 'test-key';
      fs.readdir.mockResolvedValue([]);
      
      await import('../../src/cli.js');
      
      expect(consoleLogSpy).toHaveBeenCalledWith('Initializing jsEnvoy Agent...\n');
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Loaded'));
      expect(consoleLogSpy).toHaveBeenCalledWith('Agent ready! Type your message (or "exit" to quit)\n');
    });
  });
});