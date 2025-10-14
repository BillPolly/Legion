/**
 * Agent Integration Test
 * Verifies that the agent system can be invoked and work together
 */

import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import { Task } from '@legion/task-tool';  // Hypothetical Task tool wrapper
import { ResourceManager } from '@legion/resource-manager';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TEST_APP_DIR = path.join(__dirname, 'test-apps', 'buggy-todo-app');

describe('Full-Stack Debugging Agents Integration', () => {
  let resourceManager;
  let serverProcess;

  beforeAll(async () => {
    resourceManager = await ResourceManager.getInstance();

    // Start test app server
    serverProcess = spawn('node', ['server.js'], {
      cwd: TEST_APP_DIR,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    // Wait for server to start
    await new Promise(resolve => setTimeout(resolve, 2000));
  }, 30000);

  afterAll(async () => {
    // Kill test server
    if (serverProcess) {
      serverProcess.kill();
    }
  });

  test('should verify agent definitions exist and are accessible', () => {
    const agentFiles = [
      'uat-writer.md',
      'uat-orchestrator.md',
      'backend-debugger.md',
      'frontend-debugger.md',
      'integration-tester.md',
      'log-analyzer.md'
    ];

    agentFiles.forEach(file => {
      const agentPath = path.join(__dirname, '..', file);
      const fs = require('fs');
      expect(fs.existsSync(agentPath)).toBe(true);
    });
  });

  test('should verify test app is accessible', async () => {
    const response = await fetch('http://localhost:3001/health');
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.status).toBe('ok');
  }, 10000);

  test('should verify test app has intentional bugs', async () => {
    // Test BUG #1: Case-sensitive email login
    const response = await fetch('http://localhost:3001/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'TEST@EXAMPLE.COM',  // Uppercase
        password: 'test123'
      })
    });

    // Should fail due to case-sensitive comparison
    expect(response.status).toBe(401);
  }, 10000);

  test('should verify UAT writer agent definition has correct structure', async () => {
    const fs = require('fs');
    const agentPath = path.join(__dirname, '..', 'uat-writer.md');
    const content = fs.readFileSync(agentPath, 'utf-8');

    // Check for required sections
    expect(content).toContain('---');  // YAML frontmatter
    expect(content).toContain('name: uat-writer');
    expect(content).toContain('description:');
    expect(content).toContain('tools:');
    expect(content).toContain('# UAT Writer Agent');
    expect(content).toContain('**Workflow**');
  });

  test('should verify all agent definitions have consistent structure', () => {
    const fs = require('fs');
    const agentFiles = [
      'uat-writer.md',
      'uat-orchestrator.md',
      'backend-debugger.md',
      'frontend-debugger.md',
      'integration-tester.md',
      'log-analyzer.md'
    ];

    agentFiles.forEach(file => {
      const agentPath = path.join(__dirname, '..', file);
      const content = fs.readFileSync(agentPath, 'utf-8');

      // All agents should have YAML frontmatter
      expect(content.startsWith('---')).toBe(true);
      expect(content).toContain('name:');
      expect(content).toContain('description:');
      expect(content).toContain('tools:');

      // All agents should have role and expertise
      expect(content).toContain('**Role**:');
      expect(content).toContain('**Expertise**:');
      expect(content).toContain('**Workflow**:');
    });
  });

  // NOTE: Full agent execution tests would go here
  // These would use the Task tool to invoke agents and verify they work end-to-end
  // For MVP, we're verifying the structure is correct and test app is runnable

  test.skip('should invoke UAT Writer agent to generate test plan', async () => {
    // This would be a full integration test using the Task tool
    // Skipped for now as it requires the full Claude Code agent system
    /*
    const result = await Task({
      subagent_type: 'general-purpose',
      description: 'Generate UAT test plan',
      prompt: `Use the uat-writer agent to analyze the application at ${TEST_APP_DIR} and create a UAT test document.`
    });

    expect(result).toBeDefined();
    // Verify UAT document was created
    */
  });

  test.skip('should invoke UAT Orchestrator to execute test plan', async () => {
    // This would be a full integration test
    // Skipped for now
    /*
    const result = await Task({
      subagent_type: 'general-purpose',
      description: 'Execute UAT test plan',
      prompt: `Use the uat-orchestrator agent to execute the UAT test plan and fix any bugs found.`
    });

    expect(result).toBeDefined();
    expect(result.allTestsPassed).toBe(true);
    */
  });
});
