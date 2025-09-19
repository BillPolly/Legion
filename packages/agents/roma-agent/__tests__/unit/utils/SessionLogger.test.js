/**
 * Unit tests for SessionLogger
 */

import { jest } from '@jest/globals';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import SessionLogger from '../../../src/utils/SessionLogger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('SessionLogger', () => {
  let logger;
  const testLogDir = path.join(__dirname, '../../tmp/test-logs');

  beforeEach(async () => {
    // Clean up test directory
    try {
      await fs.rm(testLogDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore if doesn't exist
    }
    
    // Create new logger for each test
    logger = new SessionLogger(testLogDir);
  });

  afterEach(async () => {
    // Clean up test logs
    try {
      await fs.rm(testLogDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore if doesn't exist
    }
  });

  describe('initialization', () => {
    it('should create logs directory on initialize', async () => {
      await logger.initialize();
      
      const dirExists = await fs.access(testLogDir)
        .then(() => true)
        .catch(() => false);
      
      expect(dirExists).toBe(true);
    });

    it('should create session file with header', async () => {
      await logger.initialize();
      
      const fileExists = await fs.access(logger.getSessionFile())
        .then(() => true)
        .catch(() => false);
      
      expect(fileExists).toBe(true);
      
      const content = await fs.readFile(logger.getSessionFile(), 'utf8');
      expect(content).toContain('ROMA AGENT SESSION LOG');
      expect(content).toContain(`Session ID: ${logger.getSessionId()}`);
    });

    it('should only initialize once', async () => {
      await logger.initialize();
      const firstFile = logger.getSessionFile();
      
      await logger.initialize(); // Second call
      const secondFile = logger.getSessionFile();
      
      expect(firstFile).toBe(secondFile);
    });
  });

  describe('logInteraction', () => {
    it('should log an interaction with task context', async () => {
      const mockTask = {
        id: 'task-001',
        description: 'Test task',
        depth: 1,
        status: 'in-progress'
      };

      const prompt = 'This is a test prompt';
      const response = 'This is a test response';
      
      await logger.logInteraction(
        mockTask,
        'test-interaction',
        prompt,
        response,
        { extra: 'metadata' }
      );

      const content = await fs.readFile(logger.getSessionFile(), 'utf8');
      
      expect(content).toContain('INTERACTION #1');
      expect(content).toContain('Type: test-interaction');
      expect(content).toContain('Task ID: task-001');
      expect(content).toContain('Task: Test task');
      expect(content).toContain('Depth: 1');
      expect(content).toContain('Status: in-progress');
      expect(content).toContain('PROMPT:');
      expect(content).toContain(prompt);
      expect(content).toContain('RESPONSE:');
      expect(content).toContain(response);
      expect(content).toContain('"extra": "metadata"');
    });

    it('should parse and format JSON responses', async () => {
      const mockTask = { id: 'task-001', description: 'Test' };
      const prompt = 'Test prompt';
      const jsonResponse = '{"result": "success", "value": 42}';
      
      await logger.logInteraction(
        mockTask,
        'json-test',
        prompt,
        jsonResponse
      );

      const content = await fs.readFile(logger.getSessionFile(), 'utf8');
      
      expect(content).toContain('PARSED RESPONSE:');
      expect(content).toContain('"result": "success"');
      expect(content).toContain('"value": 42');
    });

    it('should handle non-JSON responses gracefully', async () => {
      const mockTask = { id: 'task-001', description: 'Test' };
      const prompt = 'Test prompt';
      const textResponse = 'This is plain text, not JSON';
      
      await logger.logInteraction(
        mockTask,
        'text-test',
        prompt,
        textResponse
      );

      const content = await fs.readFile(logger.getSessionFile(), 'utf8');
      
      expect(content).toContain('RESPONSE:');
      expect(content).toContain(textResponse);
      expect(content).not.toContain('PARSED RESPONSE:');
    });

    it('should increment interaction count', async () => {
      const mockTask = { id: 'task-001' };
      
      await logger.logInteraction(mockTask, 'test1', 'p1', 'r1');
      await logger.logInteraction(mockTask, 'test2', 'p2', 'r2');
      await logger.logInteraction(mockTask, 'test3', 'p3', 'r3');

      const content = await fs.readFile(logger.getSessionFile(), 'utf8');
      
      expect(content).toContain('INTERACTION #1');
      expect(content).toContain('INTERACTION #2');
      expect(content).toContain('INTERACTION #3');
    });

    it('should auto-initialize if not initialized', async () => {
      const mockTask = { id: 'task-001' };
      
      // Don't call initialize
      await logger.logInteraction(mockTask, 'test', 'prompt', 'response');
      
      const fileExists = await fs.access(logger.getSessionFile())
        .then(() => true)
        .catch(() => false);
      
      expect(fileExists).toBe(true);
    });
  });

  describe('logMessage', () => {
    it('should log simple messages with level', async () => {
      await logger.logMessage('info', 'This is an info message');
      await logger.logMessage('error', 'This is an error message', { code: 500 });

      const content = await fs.readFile(logger.getSessionFile(), 'utf8');
      
      expect(content).toContain('[INFO] This is an info message');
      expect(content).toContain('[ERROR] This is an error message');
      expect(content).toContain('"code": 500');
    });
  });

  describe('logSummary', () => {
    it('should log session summary with duration and stats', async () => {
      await logger.initialize();
      
      // Simulate some interactions
      const mockTask = { id: 'task-001' };
      await logger.logInteraction(mockTask, 'test1', 'p1', 'r1');
      await logger.logInteraction(mockTask, 'test2', 'p2', 'r2');
      
      // Add small delay to test duration formatting
      await new Promise(resolve => setTimeout(resolve, 100));
      
      await logger.logSummary({
        'Tasks Processed': 5,
        'Tools Executed': 12,
        'Errors': 0
      });

      const content = await fs.readFile(logger.getSessionFile(), 'utf8');
      
      expect(content).toContain('SESSION SUMMARY');
      expect(content).toContain('Total Interactions: 2');
      expect(content).toContain('Tasks Processed: 5');
      expect(content).toContain('Tools Executed: 12');
      expect(content).toContain('Errors: 0');
      expect(content).toContain('Duration:');
    });
  });

  describe('session ID generation', () => {
    it('should generate unique session IDs', () => {
      const logger1 = new SessionLogger(testLogDir);
      const logger2 = new SessionLogger(testLogDir);
      
      expect(logger1.getSessionId()).not.toBe(logger2.getSessionId());
    });

    it('should include timestamp in session ID', () => {
      const sessionId = logger.getSessionId();
      
      // Should have format like: 2024-01-15_10-30-45-123_abc123
      expect(sessionId).toMatch(/^\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}-\d{3}_[a-z0-9]+$/);
    });
  });

  describe('error handling', () => {
    it('should not throw if logging fails after initialization', async () => {
      await logger.initialize();
      
      // Make the log file read-only to simulate write failure
      await fs.chmod(logger.getSessionFile(), 0o444);
      
      const mockTask = { id: 'task-001' };
      
      // Should not throw
      await expect(
        logger.logInteraction(mockTask, 'test', 'prompt', 'response')
      ).resolves.toBeDefined();
      
      // Restore permissions for cleanup
      await fs.chmod(logger.getSessionFile(), 0o644);
    });
  });
});