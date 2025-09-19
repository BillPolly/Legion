/**
 * Integration test for session logging in ROMA agent
 */

import { jest } from '@jest/globals';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import SimpleROMAAgent from '../../src/core/SimpleROMAAgent.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Session Logging Integration', () => {
  let agent;
  const testLogDir = path.join(__dirname, '../tmp/test-logs');

  beforeEach(async () => {
    // Clean up test directory
    try {
      await fs.rm(testLogDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore if doesn't exist
    }

    agent = new SimpleROMAAgent();
    await agent.initialize();
  });

  afterEach(async () => {
    // Clean up test logs
    try {
      await fs.rm(testLogDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore if doesn't exist
    }
  });

  describe('with real agent execution', () => {
    it('should log task classification interactions', async () => {
      // Execute a simple task
      const task = {
        description: 'Read the contents of package.json file'
      };

      await agent.execute(task);

      // Check that log file was created
      const sessionFile = agent.sessionLogger.getSessionFile();
      const fileExists = await fs.access(sessionFile)
        .then(() => true)
        .catch(() => false);
      
      expect(fileExists).toBe(true);

      // Read the log content
      const content = await fs.readFile(sessionFile, 'utf8');
      
      // Should contain task classification interaction
      expect(content).toContain('INTERACTION #1');
      expect(content).toContain('Type: task-classification');
      expect(content).toContain('Task: Read the contents of package.json file');
      expect(content).toContain('PROMPT:');
      expect(content).toContain('Analyze this task and classify it as either SIMPLE or COMPLEX');
      expect(content).toContain('RESPONSE:');
    });

    it('should log simple task execution interactions', async () => {
      const task = {
        description: 'Calculate 5 plus 3'
      };

      await agent.execute(task);

      // Read the log content
      const sessionFile = agent.sessionLogger.getSessionFile();
      const content = await fs.readFile(sessionFile, 'utf8');
      
      // Should have classification interaction
      expect(content).toContain('Type: task-classification');
      
      // Should have simple task execution interaction
      expect(content).toContain('Type: simple-task-execution');
      expect(content).toMatch(/toolCount.*:\s*\d+/); // Should log tool count
      
      // Should have session summary
      expect(content).toContain('SESSION SUMMARY');
      expect(content).toContain('Total Interactions:');
      expect(content).toContain('Final Success:');
    }, 60000); // Increase timeout to 60 seconds

    it('should log complex task decomposition interactions', async () => {
      const task = {
        description: 'Build a complete microservices architecture with API gateway, user service, product service, order service, and monitoring dashboard'
      };

      // Execute the task but expect it may not complete due to complexity
      try {
        await agent.execute(task);
      } catch (error) {
        // Task may fail due to complexity, but logging should still work
        console.log('Complex task failed as expected:', error.message);
      }

      // Read the log content
      const sessionFile = agent.sessionLogger.getSessionFile();
      const content = await fs.readFile(sessionFile, 'utf8');
      
      // Should have classification interaction first
      expect(content).toContain('Type: task-classification');
      
      // Should have complex task decomposition interaction
      expect(content).toContain('Type: task-decomposition');
      expect(content).toContain('classification.*:.*COMPLEX');
      
      // Should have multiple interactions for subtasks
      const interactionMatches = content.match(/INTERACTION #\d+/g);
      expect(interactionMatches.length).toBeGreaterThan(1);
    }, 30000); // Reduced timeout since we don't need full completion

    it('should handle logging errors gracefully', async () => {
      // Make the log directory read-only after initialization
      const sessionFile = agent.sessionLogger.getSessionFile();
      const logDir = path.dirname(sessionFile);
      
      // Create the directory and file first
      await fs.mkdir(logDir, { recursive: true });
      await fs.writeFile(sessionFile, 'initial content', 'utf8');
      
      // Make the file read-only
      await fs.chmod(sessionFile, 0o444);
      
      // Execute should not throw even if logging fails
      const task = {
        description: 'Simple test task'
      };
      
      // Should not throw
      await expect(agent.execute(task)).resolves.toBeDefined();
      
      // Restore permissions
      await fs.chmod(sessionFile, 0o644);
    });
  });

  describe('session file management', () => {
    it('should create unique session files for different agent instances', async () => {
      const agent1 = new SimpleROMAAgent();
      await agent1.initialize();
      
      const agent2 = new SimpleROMAAgent();
      await agent2.initialize();
      
      const sessionFile1 = agent1.sessionLogger.getSessionFile();
      const sessionFile2 = agent2.sessionLogger.getSessionFile();
      
      expect(sessionFile1).not.toBe(sessionFile2);
      
      // Both files should exist
      const file1Exists = await fs.access(sessionFile1)
        .then(() => true)
        .catch(() => false);
      const file2Exists = await fs.access(sessionFile2)
        .then(() => true)
        .catch(() => false);
      
      expect(file1Exists).toBe(true);
      expect(file2Exists).toBe(true);
    });

    it('should include timestamps in log entries', async () => {
      const task = {
        description: 'Test task for timestamp verification'
      };

      await agent.execute(task);

      const sessionFile = agent.sessionLogger.getSessionFile();
      const content = await fs.readFile(sessionFile, 'utf8');
      
      // Check for ISO timestamp format
      const timestampPattern = /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/;
      expect(content).toMatch(timestampPattern);
    });
  });
});