/**
 * ComputerUseActor - Interactive Actor interface for browser automation
 *
 * Wraps ComputerUseAgent to provide Actor-based control for:
 * - Step-by-step interactive testing
 * - WebSocket-based remote control
 * - Both Gemini AI and direct Puppeteer modes
 */

import { ComputerUseAgent } from './ComputerUseAgent.js';
import { BrowserManager } from './BrowserManager.js';

export class ComputerUseActor {
  constructor(resourceManager, options = {}) {
    this.resourceManager = resourceManager;
    this.options = options;
    this.agent = null;
    this.browserManager = null;
    this.initialized = false;
  }

  /**
   * Actor receive method - handles all commands
   */
  async receive(messageType, data = {}) {
    switch (messageType) {
      case 'init':
        return await this.handleInit(data);

      case 'execute-task':
        return await this.handleExecuteTask(data);

      case 'single-turn':
        return await this.handleSingleTurn(data);

      case 'puppeteer':
        return await this.handlePuppeteer(data);

      case 'screenshot':
        return await this.handleScreenshot(data);

      case 'get-state':
        return await this.handleGetState(data);

      case 'get-page-content':
        return await this.handleGetPageContent(data);

      case 'cleanup':
        return await this.handleCleanup(data);

      default:
        throw new Error(`Unknown message type: ${messageType}`);
    }
  }

  /**
   * Initialize browser session
   */
  async handleInit(data) {
    if (this.initialized) {
      return { ok: false, error: 'Already initialized' };
    }

    const {
      startUrl = 'http://localhost:3001',
      headless = false,
      width = 1440,
      height = 900,
      ...agentOptions
    } = data;

    // Create ComputerUseAgent instance
    this.agent = new ComputerUseAgent(this.resourceManager, {
      startUrl,
      headless,
      width,
      height,
      maxTurns: 1, // We'll control turns manually
      ...agentOptions,
    });

    await this.agent.initialize();
    this.browserManager = this.agent.browserManager;
    this.initialized = true;

    return {
      ok: true,
      sessionId: this.agent.sessionId,
      outDir: this.agent.outDir,
      startUrl,
    };
  }

  /**
   * Execute a full task using Gemini Computer Use
   */
  async handleExecuteTask(data) {
    this.ensureInitialized();

    const { task, maxTurns = 10 } = data;

    if (!task) {
      return { ok: false, error: 'Task is required' };
    }

    // Temporarily adjust maxTurns for this task
    const originalMaxTurns = this.agent.options.maxTurns;
    this.agent.options.maxTurns = maxTurns;

    try {
      const result = await this.agent.executeTask(task);
      return result;
    } finally {
      this.agent.options.maxTurns = originalMaxTurns;
    }
  }

  /**
   * Execute a single turn with Gemini (more granular control)
   */
  async handleSingleTurn(data) {
    this.ensureInitialized();

    const { instruction } = data;

    if (!instruction) {
      return { ok: false, error: 'Instruction is required' };
    }

    // Get current state
    const snapshot = await this.browserManager.getStateSnapshot();
    const png = await this.browserManager.screenshot('before_turn');

    // Build conversation for single turn
    const conversation = [
      {
        role: 'user',
        parts: [
          { text: instruction },
          { text: JSON.stringify(snapshot) },
          { inlineData: { mimeType: 'image/png', data: png.toString('base64') } },
        ],
      },
    ];

    // Configure computer use tools
    const tools = [
      {
        computerUse: {
          environment: 'ENVIRONMENT_BROWSER',
          excludedPredefinedFunctions: this.agent.options.excludedActions || [],
        },
      },
    ];

    try {
      // Call Gemini with single turn
      const response = await this.agent.generateWithBudget(
        conversation,
        tools,
        this.agent.options.stepTimeBudgetMs
      );

      const candidate = response.candidates?.[0];
      const reply = candidate?.content;

      if (!reply) {
        return { ok: false, error: 'No response from Gemini' };
      }

      // Extract and execute function calls
      const calls = this.agent.extractFunctionCalls(response);

      if (calls.length === 0) {
        const text = (reply.parts ?? [])
          .map((p) => p.text)
          .filter(Boolean)
          .join(' ');
        return { ok: true, completed: true, resultText: text, actions: [] };
      }

      // Execute actions
      const actionResults = [];
      for (const call of calls) {
        const { name, args } = call;

        try {
          await this.agent.actionExecutor.execute(name, args);
          await this.browserManager.getPage().waitForTimeout(300);
          actionResults.push({ action: name, ok: true });
        } catch (err) {
          actionResults.push({ action: name, ok: false, error: err.message });
        }
      }

      // Get new state
      const afterPng = await this.browserManager.screenshot('after_turn');

      return {
        ok: true,
        completed: false,
        actions: actionResults,
        screenshot: afterPng.toString('base64'),
      };
    } catch (error) {
      return { ok: false, error: error.message };
    }
  }

  /**
   * Execute direct Puppeteer command
   */
  async handlePuppeteer(data) {
    this.ensureInitialized();

    const { action, selector, value, options } = data;

    if (!action) {
      return { ok: false, error: 'Action is required' };
    }

    const page = this.browserManager.getPage();

    try {
      switch (action) {
        case 'goto':
          await page.goto(value || selector, { waitUntil: 'load', timeout: 20000 });
          break;

        case 'click':
          await page.click(selector, options);
          break;

        case 'fill':
        case 'type':
          await page.fill(selector, value, options);
          break;

        case 'press':
          await page.press(selector, value, options);
          break;

        case 'select':
          await page.selectOption(selector, value, options);
          break;

        case 'check':
          await page.check(selector, options);
          break;

        case 'uncheck':
          await page.uncheck(selector, options);
          break;

        case 'hover':
          await page.hover(selector, options);
          break;

        case 'wait':
          await page.waitForTimeout(value || 1000);
          break;

        case 'waitForSelector':
          await page.waitForSelector(selector, options);
          break;

        case 'evaluate':
          return {
            ok: true,
            result: await page.evaluate(value || selector),
          };

        case 'getAttribute':
          return {
            ok: true,
            result: await page.getAttribute(selector, value),
          };

        case 'textContent':
          return {
            ok: true,
            result: await page.textContent(selector),
          };

        case 'innerHTML':
          return {
            ok: true,
            result: await page.innerHTML(selector),
          };

        default:
          return { ok: false, error: `Unknown action: ${action}` };
      }

      return { ok: true, action };
    } catch (error) {
      return { ok: false, error: error.message, action };
    }
  }

  /**
   * Take screenshot
   */
  async handleScreenshot(data) {
    this.ensureInitialized();

    const { label, fullPage = false } = data;

    try {
      const png = await this.browserManager.screenshot(label);

      return {
        ok: true,
        screenshot: png.toString('base64'),
        mimeType: 'image/png',
      };
    } catch (error) {
      return { ok: false, error: error.message };
    }
  }

  /**
   * Get current page state
   */
  async handleGetState(data) {
    this.ensureInitialized();

    try {
      const state = await this.browserManager.getStateSnapshot();

      return {
        ok: true,
        state,
      };
    } catch (error) {
      return { ok: false, error: error.message };
    }
  }

  /**
   * Get page HTML content
   */
  async handleGetPageContent(data) {
    this.ensureInitialized();

    const { selector } = data;

    try {
      const page = this.browserManager.getPage();

      let content;
      if (selector) {
        content = await page.innerHTML(selector);
      } else {
        content = await page.content();
      }

      return {
        ok: true,
        content,
        url: page.url(),
      };
    } catch (error) {
      return { ok: false, error: error.message };
    }
  }

  /**
   * Cleanup browser session
   */
  async handleCleanup(data) {
    if (!this.initialized) {
      return { ok: true, message: 'Not initialized' };
    }

    try {
      await this.agent.cleanup();
      this.initialized = false;
      this.agent = null;
      this.browserManager = null;

      return { ok: true, message: 'Cleanup complete' };
    } catch (error) {
      return { ok: false, error: error.message };
    }
  }

  /**
   * Helper to ensure initialized
   */
  ensureInitialized() {
    if (!this.initialized) {
      throw new Error('ComputerUseActor not initialized. Call receive("init", {...}) first.');
    }
  }
}
