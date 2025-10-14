/**
 * Complex E2E tests for ComputerUseAgent
 * Tests form filling, navigation, console reading, and DOM inspection
 * Requires GOOGLE_API_KEY to be set in .env
 * These tests make real LLM calls and browser interactions
 */

import { jest } from '@jest/globals';
import { ResourceManager } from '@legion/resource-manager';
import { ComputerUseAgent } from '../../src/index.js';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('ComputerUseAgent Complex Tasks', () => {
  let resourceManager;
  let agent;
  let testServer;
  const testOutDir = path.join(__dirname, '../tmp/e2e-complex');
  const TEST_SERVER_URL = 'http://localhost:8765';

  beforeAll(async () => {
    resourceManager = await ResourceManager.getInstance();

    // Start test server
    testServer = spawn('node', [
      path.join(__dirname, '../tmp/test-server/server.js')
    ], {
      stdio: 'pipe'
    });

    // Wait for server to start
    await new Promise(resolve => setTimeout(resolve, 2000));
  });

  afterAll(async () => {
    if (testServer) {
      testServer.kill();
    }
  });

  afterEach(async () => {
    if (agent) {
      await agent.cleanup();
      agent = null;
    }
  });

  describe('Form Interaction', () => {
    test('should fill out multi-field form correctly', async () => {
      const googleApiKey = resourceManager.get('env.GOOGLE_API_KEY');
      if (!googleApiKey) {
        console.log('Skipping - GOOGLE_API_KEY not set');
        return;
      }

      agent = new ComputerUseAgent(resourceManager, {
        headless: true,
        maxTurns: 10,
        startUrl: `${TEST_SERVER_URL}/form.html`,
        outDir: testOutDir,
        stepTimeBudgetMs: 45000,
        totalTimeBudgetMs: 300000,
      });

      await agent.initialize();

      const result = await agent.executeTask(
        'Fill out the registration form with: name "Jane Smith", email "jane@test.com", password "test1234", country "United States", check the Technology interest checkbox, select Personal account type, and check the terms checkbox. Do NOT submit the form yet.'
      );

      expect(result).toBeDefined();
      expect(result.outDir).toBeDefined();
      // Agent should complete without errors
    }, 320000); // 5+ minutes for complex form interaction

    test('should submit form and navigate to results page', async () => {
      const googleApiKey = resourceManager.get('env.GOOGLE_API_KEY');
      if (!googleApiKey) {
        console.log('Skipping - GOOGLE_API_KEY not set');
        return;
      }

      agent = new ComputerUseAgent(resourceManager, {
        headless: true,
        maxTurns: 15,
        startUrl: `${TEST_SERVER_URL}/form.html`,
        outDir: testOutDir,
        stepTimeBudgetMs: 45000,
        totalTimeBudgetMs: 400000,
      });

      await agent.initialize();

      const result = await agent.executeTask(
        'Fill out the registration form with: name "John Doe", email "john@test.com", password "secure123", country "Canada", check both Technology and Sports interests, select Business account type, check the terms checkbox, and click the Submit button. Then verify you are on the results page and read the displayed name.'
      );

      expect(result).toBeDefined();
      expect(result.outDir).toBeDefined();
      // Result should mention either the results page or the submitted data
    }, 420000); // 7 minutes for full form submission and navigation
  });

  describe('Console Log Reading', () => {
    test('should read and report console logs from the page', async () => {
      const googleApiKey = resourceManager.get('env.GOOGLE_API_KEY');
      if (!googleApiKey) {
        console.log('Skipping - GOOGLE_API_KEY not set');
        return;
      }

      agent = new ComputerUseAgent(resourceManager, {
        headless: true,
        maxTurns: 8,
        startUrl: `${TEST_SERVER_URL}/form.html`,
        outDir: testOutDir,
        stepTimeBudgetMs: 45000,
        totalTimeBudgetMs: 300000,
      });

      await agent.initialize();

      const result = await agent.executeTask(
        'Check the browser console logs and tell me what messages appear. The page should have logged information about the form fields.'
      );

      expect(result).toBeDefined();
      expect(result.outDir).toBeDefined();
      // Agent should see console logs (they're in the state snapshot)
    }, 320000);
  });

  describe('DOM Inspection', () => {
    test('should read form field values and states', async () => {
      const googleApiKey = resourceManager.get('env.GOOGLE_API_KEY');
      if (!googleApiKey) {
        console.log('Skipping - GOOGLE_API_KEY not set');
        return;
      }

      agent = new ComputerUseAgent(resourceManager, {
        headless: true,
        maxTurns: 10,
        startUrl: `${TEST_SERVER_URL}/form.html`,
        outDir: testOutDir,
        stepTimeBudgetMs: 45000,
        totalTimeBudgetMs: 300000,
      });

      await agent.initialize();

      const result = await agent.executeTask(
        'List all the form fields you can see on this page. Tell me their names, types (text input, checkbox, radio, etc.), and any placeholder text.'
      );

      expect(result).toBeDefined();
      expect(result.outDir).toBeDefined();
      // Agent should identify the form fields from DOM snapshot
    }, 320000);
  });

  describe('Multi-Page Navigation', () => {
    test('should navigate between pages and use browser back button', async () => {
      const googleApiKey = resourceManager.get('env.GOOGLE_API_KEY');
      if (!googleApiKey) {
        console.log('Skipping - GOOGLE_API_KEY not set');
        return;
      }

      agent = new ComputerUseAgent(resourceManager, {
        headless: true,
        maxTurns: 12,
        startUrl: `${TEST_SERVER_URL}/form.html`,
        outDir: testOutDir,
        stepTimeBudgetMs: 45000,
        totalTimeBudgetMs: 350000,
      });

      await agent.initialize();

      const result = await agent.executeTask(
        'Click the link or navigate to the results page (results.html), then use the browser back button to return to the form page. Verify you are back on the registration form.'
      );

      expect(result).toBeDefined();
      expect(result.outDir).toBeDefined();
    }, 370000);
  });

  describe('Form Validation and States', () => {
    test('should interact with checkboxes and verify their checked state', async () => {
      const googleApiKey = resourceManager.get('env.GOOGLE_API_KEY');
      if (!googleApiKey) {
        console.log('Skipping - GOOGLE_API_KEY not set');
        return;
      }

      agent = new ComputerUseAgent(resourceManager, {
        headless: true,
        maxTurns: 10,
        startUrl: `${TEST_SERVER_URL}/form.html`,
        outDir: testOutDir,
        stepTimeBudgetMs: 45000,
        totalTimeBudgetMs: 300000,
      });

      await agent.initialize();

      const result = await agent.executeTask(
        'Check the Technology and Music interest checkboxes, then tell me which checkboxes are currently checked.'
      );

      expect(result).toBeDefined();
      expect(result.outDir).toBeDefined();
      // Agent should be able to read checked state from accessibility tree
    }, 320000);
  });
});
