/**
 * @fileoverview Unit tests for RunNodeTool with complete JSON Schema definitions
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { RunNodeTool } from '../../src/tools/RunNodeTool.js';

describe('RunNodeTool', () => {
  let runNodeTool;
  let mockModule;

  beforeEach(() => {
    mockModule = {
      processManager: {
        start: jest.fn().mockResolvedValue({ processId: 'test-process-123', process: {} }),
        getRunningProcesses: jest.fn().mockReturnValue([]),
        getProcessInfo: jest.fn().mockReturnValue({ status: 'running' })
      },
      sessionManager: {
        createSession: jest.fn().mockResolvedValue({ sessionId: 'test-session-123' }),
        updateSession: jest.fn().mockResolvedValue(true)
      },
      packageManager: {
        installDependencies: jest.fn().mockResolvedValue(true),
        validatePackageJson: jest.fn().mockResolvedValue(true)
      }
    };
    runNodeTool = new RunNodeTool(mockModule);
  });

  afterEach(() => {
    // Clean up any side effects
    jest.clearAllMocks();
  });

  describe('Tool Definition', () => {
    it('should have correct tool name', () => {
      expect(runNodeTool.name).toBe('run_node');
    });

    it('should have comprehensive description', () => {
      expect(runNodeTool.description).toBeTruthy();
      expect(runNodeTool.description).toContain('Node.js');
      expect(runNodeTool.description).toContain('comprehensive logging');
    });

    it('should have complete JSON Schema for input validation', () => {
      expect(runNodeTool.inputSchema).toBeDefined();
      expect(runNodeTool.inputSchema.type).toBe('object');
      expect(runNodeTool.inputSchema.properties).toBeDefined();
      
      // Check required properties
      const required = runNodeTool.inputSchema.required;
      expect(required).toContain('projectPath');
      expect(required).toContain('command');
    });

    it('should define all expected input parameters', () => {
      const properties = runNodeTool.inputSchema.properties;
      
      // Core parameters
      expect(properties.projectPath).toBeDefined();
      expect(properties.command).toBeDefined();
      expect(properties.args).toBeDefined();
      
      // Optional parameters
      expect(properties.description).toBeDefined();
      expect(properties.installDependencies).toBeDefined();
      expect(properties.env).toBeDefined();
      expect(properties.timeout).toBeDefined();
    });

    it('should have proper parameter constraints', () => {
      const properties = runNodeTool.inputSchema.properties;
      
      // projectPath should be a string
      expect(properties.projectPath.type).toBe('string');
      expect(properties.projectPath.description).toBeTruthy();
      
      // command should be a string
      expect(properties.command.type).toBe('string');
      expect(properties.command.description).toBeTruthy();
      
      // args should be array of strings
      expect(properties.args.type).toBe('array');
      expect(properties.args.items.type).toBe('string');
      
      // timeout should have min/max constraints
      expect(properties.timeout.type).toBe('number');
      expect(properties.timeout.minimum).toBeGreaterThan(0);
      expect(properties.timeout.maximum).toBeLessThanOrEqual(600000);
    });
  });

  describe('Input Validation', () => {
    it('should accept valid minimal input', async () => {
      const validInput = {
        projectPath: process.cwd(), // Use actual working directory
        command: 'npm start'
      };

      // This should not throw
      await expect(runNodeTool.execute(validInput)).resolves.toBeDefined();
    });

    it('should accept valid complete input', async () => {
      const validInput = {
        projectPath: process.cwd(), // Use actual working directory
        command: 'node',
        args: ['server.js', '--port', '3000'],
        description: 'Start development server',
        installDependencies: true,
        env: { NODE_ENV: 'development', PORT: '3000' },
        timeout: 30000
      };

      await expect(runNodeTool.execute(validInput)).resolves.toBeDefined();
    });

    it('should validate projectPath is required', async () => {
      const invalidInput = {
        command: 'npm start'
        // Missing projectPath
      };

      await expect(runNodeTool.execute(invalidInput)).rejects.toThrow();
    });

    it('should validate command is required', async () => {
      const invalidInput = {
        projectPath: process.cwd()
        // Missing command
      };

      await expect(runNodeTool.execute(invalidInput)).rejects.toThrow();
    });

    it('should validate args is array if provided', async () => {
      const invalidInput = {
        projectPath: process.cwd(),
        command: 'node',
        args: 'invalid-string-args' // Should be array
      };

      await expect(runNodeTool.execute(invalidInput)).rejects.toThrow();
    });

    it('should validate timeout constraints', async () => {
      const invalidInput = {
        projectPath: process.cwd(),
        command: 'npm start',
        timeout: -1000 // Invalid negative timeout
      };

      await expect(runNodeTool.execute(invalidInput)).rejects.toThrow();
    });

    it('should validate env is object if provided', async () => {
      const invalidInput = {
        projectPath: process.cwd(),
        command: 'npm start',
        env: 'invalid-env' // Should be object
      };

      await expect(runNodeTool.execute(invalidInput)).rejects.toThrow();
    });
  });

  describe('Process Execution Flow', () => {
    it('should create session before starting process', async () => {
      const input = {
        projectPath: process.cwd(),
        command: 'npm start',
        description: 'Test execution'
      };

      await runNodeTool.execute(input);

      expect(mockModule.sessionManager.createSession).toHaveBeenCalledWith(
        expect.objectContaining({
          projectPath: process.cwd(),
          command: 'npm start',
          description: 'Test execution'
        })
      );
    });

    it('should install dependencies if requested', async () => {
      const input = {
        projectPath: process.cwd(),
        command: 'npm start',
        installDependencies: true
      };

      await runNodeTool.execute(input);

      expect(mockModule.packageManager.installDependencies).toHaveBeenCalledWith(process.cwd());
    });

    it('should start process with correct parameters', async () => {
      const input = {
        projectPath: process.cwd(),
        command: 'node',
        args: ['server.js', '--port', '3000'],
        env: { NODE_ENV: 'test' }
      };

      await runNodeTool.execute(input);

      expect(mockModule.processManager.start).toHaveBeenCalledWith(
        expect.objectContaining({
          command: 'node',
          args: ['server.js', '--port', '3000'],
          workingDir: process.cwd(),
          sessionId: 'test-session-123',
          env: { NODE_ENV: 'test' }
        })
      );
    });

    it('should return execution result with session and process info', async () => {
      const input = {
        projectPath: process.cwd(),
        command: 'npm start'
      };

      const result = await runNodeTool.execute(input);

      expect(result).toEqual({
        success: true,
        sessionId: 'test-session-123',
        processId: 'test-process-123',
        message: expect.stringContaining('started successfully'),
        projectPath: process.cwd(),
        command: 'npm start',
        args: []
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle session creation failure', async () => {
      mockModule.sessionManager.createSession.mockRejectedValueOnce(new Error('Session creation failed'));

      const input = {
        projectPath: process.cwd(),
        command: 'npm start'
      };

      await expect(runNodeTool.execute(input)).rejects.toThrow('Session creation failed');
    });

    it('should handle dependency installation failure', async () => {
      mockModule.packageManager.installDependencies.mockRejectedValueOnce(new Error('Install failed'));

      const input = {
        projectPath: process.cwd(),
        command: 'npm start',
        installDependencies: true
      };

      await expect(runNodeTool.execute(input)).rejects.toThrow('Install failed');
    });

    it('should handle process start failure', async () => {
      mockModule.processManager.start.mockRejectedValueOnce(new Error('Process start failed'));

      const input = {
        projectPath: process.cwd(),
        command: 'npm start'
      };

      await expect(runNodeTool.execute(input)).rejects.toThrow('Process start failed');
    });

    it('should validate project path exists', async () => {
      const input = {
        projectPath: '/nonexistent/path',
        command: 'npm start'
      };

      await expect(runNodeTool.execute(input)).rejects.toThrow('Project path does not exist');
    });
  });

  describe('Event Emission', () => {
    it('should emit progress events during execution', async () => {
      const progressEvents = [];
      runNodeTool.on('progress', (data) => progressEvents.push(data));

      const input = {
        projectPath: process.cwd(),
        command: 'npm start'
      };

      await runNodeTool.execute(input);

      expect(progressEvents.length).toBeGreaterThan(0);
      expect(progressEvents[0]).toEqual(
        expect.objectContaining({
          percentage: expect.any(Number),
          status: expect.any(String)
        })
      );
    });

    it('should emit info events for major steps', async () => {
      const infoEvents = [];
      runNodeTool.on('info', (data) => infoEvents.push(data));

      const input = {
        projectPath: process.cwd(),
        command: 'npm start',
        installDependencies: true
      };

      await runNodeTool.execute(input);

      expect(infoEvents.some(event => event.message.includes('Installing dependencies'))).toBe(true);
      expect(infoEvents.some(event => event.message.includes('Starting process'))).toBe(true);
    });

    it('should emit error events on failures', async () => {
      const errorEvents = [];
      runNodeTool.on('error', (data) => errorEvents.push(data));

      mockModule.processManager.start.mockRejectedValueOnce(new Error('Process failed'));

      const input = {
        projectPath: process.cwd(),
        command: 'npm start'
      };

      await expect(runNodeTool.execute(input)).rejects.toThrow();
      expect(errorEvents.length).toBeGreaterThan(0);
    });
  });

  describe('Integration with Module Dependencies', () => {
    it('should use module processManager correctly', async () => {
      expect(runNodeTool.module).toBe(mockModule);
      expect(runNodeTool.module.processManager).toBeDefined();
      expect(runNodeTool.module.sessionManager).toBeDefined();
      expect(runNodeTool.module.packageManager).toBeDefined();
    });

    it('should pass environment variables to process', async () => {
      const input = {
        projectPath: process.cwd(),
        command: 'npm start',
        env: {
          NODE_ENV: 'production',
          API_KEY: 'test-key',
          DATABASE_URL: 'test-db'
        }
      };

      await runNodeTool.execute(input);

      expect(mockModule.processManager.start).toHaveBeenCalledWith(
        expect.objectContaining({
          env: {
            NODE_ENV: 'production',
            API_KEY: 'test-key',
            DATABASE_URL: 'test-db'
          }
        })
      );
    });

    it('should handle complex argument arrays', async () => {
      const input = {
        projectPath: process.cwd(),
        command: 'node',
        args: [
          'server.js',
          '--port', '8080',
          '--env', 'development',
          '--verbose',
          '--config', './config/app.json'
        ]
      };

      await runNodeTool.execute(input);

      expect(mockModule.processManager.start).toHaveBeenCalledWith(
        expect.objectContaining({
          args: [
            'server.js',
            '--port', '8080',
            '--env', 'development',
            '--verbose',
            '--config', './config/app.json'
          ]
        })
      );
    });
  });
});