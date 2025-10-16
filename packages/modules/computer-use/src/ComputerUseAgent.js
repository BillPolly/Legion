/**
 * Computer Use Agent - LLM-guided browser automation
 * Uses Gemini Computer Use API with Legion architecture
 */

import path from 'path';
import { randomUUID } from 'crypto';
import pc from 'picocolors';
import { appendFile } from 'fs/promises';
import { ComputerUseOptionsSchema, FunctionCallSchema } from './types/index.js';
import { BrowserManager } from './BrowserManager.js';
import { ActionExecutor } from './actions/index.js';

const MODEL_ID = 'gemini-2.5-computer-use-preview-10-2025';

export class ComputerUseAgent {
  constructor(resourceManager, options = {}) {
    // Validate options
    this.options = ComputerUseOptionsSchema.parse(options);

    // Store resource manager
    this.resourceManager = resourceManager;

    // Session ID for tracking
    this.sessionId = `${new Date().toISOString().replace(/[:.]/g, '-')}_${randomUUID().slice(0, 8)}`;
    this.outDir = path.join(this.options.outDir, this.sessionId);

    // Logger (simple for now - don't create files during construction)
    this.logger = {
      log: async (msg) => {
        console.log(msg);
      },
    };

    // Components (initialized later)
    this.browserManager = null;
    this.actionExecutor = null;
    this.llmClient = null;
    this.conversationHistory = [];
  }

  /**
   * Initialize agent
   */
  async initialize() {
    await this.logger.log(`Session: ${this.sessionId}`);

    // Get LLM client from ResourceManager
    this.llmClient = await this.resourceManager.get('llmClient');

    // Ensure we're using Google provider with Computer Use model
    if (this.llmClient.getProviderName() !== 'google') {
      throw new Error('ComputerUseAgent requires Google provider. Set GOOGLE_API_KEY in .env');
    }

    // Initialize browser manager
    this.browserManager = new BrowserManager(
      {
        headless: this.options.headless,
        width: this.options.width,
        height: this.options.height,
        startUrl: this.options.startUrl,
        outDir: this.outDir,
      },
      this.logger
    );
    await this.browserManager.initialize();

    // Initialize action executor
    this.actionExecutor = new ActionExecutor(this.browserManager.getPage(), this.logger, {
      width: this.options.width,
      height: this.options.height,
      allowlistHosts: this.options.allowlistHosts,
    });

    await this.logger.log(pc.green('Agent initialized'));
  }

  /**
   * Execute a task
   */
  async executeTask(task) {
    const started = Date.now();

    // Get initial state
    const snapshot = await this.browserManager.getStateSnapshot();
    const firstPng = await this.browserManager.screenshot('initial');

    // Redact if needed
    const redact = this.options.redact || ((s) => s);

    // Build initial conversation
    this.conversationHistory = [
      {
        role: 'user',
        parts: [
          { text: redact(task) },
          { text: redact(JSON.stringify(snapshot)) },
          { inlineData: { mimeType: 'image/png', data: firstPng.toString('base64') } },
        ],
      },
    ];

    // Configure computer use tools
    const tools = [
      {
        computerUse: {
          environment: 'ENVIRONMENT_BROWSER',
          excludedPredefinedFunctions: this.options.excludedActions,
        },
      },
    ];

    // Main loop
    for (let turn = 1; turn <= this.options.maxTurns; turn++) {
      if (Date.now() - started > this.options.totalTimeBudgetMs) {
        await this.logger.log('Total time budget exceeded');
        break;
      }

      await this.logger.log(pc.cyan(`\nTurn ${turn}/${this.options.maxTurns}`));

      // Call LLM with computer use tools
      const response = await this.generateWithBudget(
        this.conversationHistory,
        tools,
        this.options.stepTimeBudgetMs
      );

      const candidate = response.candidates?.[0];
      const reply = candidate?.content;
      if (!reply) throw new Error('No candidate content returned');

      this.conversationHistory.push(reply);

      // Check for safety blocks
      if (this.hasSafetyRequireConfirmation(response)) {
        await this.logger.log(pc.yellow('Safety confirmation required; denying this turn.'));
        this.conversationHistory.push({
          role: 'user',
          parts: [{ functionResponse: { name: 'safety_block', response: { denied: true } } }],
        });
        continue;
      }

      // Extract function calls
      const calls = this.extractFunctionCalls(response);
      if (calls.length === 0) {
        const text = (reply.parts ?? [])
          .map((p) => p.text)
          .filter(Boolean)
          .join(' ');
        await this.browserManager.screenshot('final');
        await this.logger.log(pc.green('Agent finished.'));
        return { ok: true, resultText: text, outDir: this.outDir };
      }

      // Execute actions
      const actionResults = [];
      for (const call of calls) {
        const { name, args } = call;

        // Check if action has safety decision that requires confirmation
        const safetyDecision = args?.safety_decision;
        const hasSafetyConfirmation = safetyDecision?.decision === 'require_confirmation';

        if (hasSafetyConfirmation) {
          await this.logger.log(pc.yellow(`Safety confirmation for ${name}: ${safetyDecision.explanation}`));
          await this.logger.log(pc.yellow(`Auto-accepting safety confirmation`));
          // Execute the action AND acknowledge with safety_acknowledgement: "true"
          await this.actionExecutor.execute(name, args);
          await this.browserManager.getPage().waitForTimeout(300);
          actionResults.push([name, { safety_acknowledgement: 'true' }]);
          continue;
        }

        try {
          await this.actionExecutor.execute(name, args);
          await this.browserManager.getPage().waitForTimeout(300);
          actionResults.push([name, {}]);
        } catch (err) {
          await this.logger.log(pc.red(`Action error: ${err?.message ?? err}`));
          actionResults.push([name, { error: String(err?.message ?? err) }]);
        }
      }

      // Get new state + screenshot
      const png = await this.browserManager.screenshot();
      const state = await this.browserManager.getStateSnapshot();
      const url = this.browserManager.getPage().url();

      // Gemini API requires function responses in separate message from other content
      // Message 1: Function responses only
      this.conversationHistory.push({
        role: 'user',
        parts: actionResults.map(([name, result]) => {
          // Always include url in response
          return {
            functionResponse: {
              name,
              response: { url, ...result }
            },
          };
        })
      });

      // Message 2: State and image
      this.conversationHistory.push({
        role: 'user',
        parts: [
          { text: redact(JSON.stringify(state)) },
          { inlineData: { mimeType: 'image/png', data: png.toString('base64') } }
        ]
      });

      // Trim conversation history to prevent request size from exceeding limits
      // Gemini requires function calls and responses to match, so we can't just slice randomly
      // Instead, keep only the last N complete turns (model message + function responses + state)
      const MAX_TURNS_TO_KEEP = 3;
      if (turn > MAX_TURNS_TO_KEEP) {
        // Keep: first message (initial task) + last N complete turns
        // Each complete turn = 1 model message + 1 function response message + 1 state+image message
        const firstMessage = this.conversationHistory[0];
        const messagesToKeep = MAX_TURNS_TO_KEEP * 3; // 3 messages per turn
        const recentMessages = this.conversationHistory.slice(-messagesToKeep);
        this.conversationHistory = [firstMessage, ...recentMessages];
      }
    }

    return { ok: false, error: `Reached maxTurns. Check ${this.outDir}`, outDir: this.outDir };
  }

  /**
   * Generate with time budget
   */
  async generateWithBudget(contents, tools, budgetMs) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), budgetMs);

    try {
      // Use LLMClient with returnFullResponse to get raw Gemini response
      const response = await this.llmClient.provider.completeMessages(
        contents,
        MODEL_ID,
        {
          tools,
          returnFullResponse: true,
          signal: ctrl.signal,
        }
      );
      return response;
    } finally {
      clearTimeout(t);
    }
  }

  /**
   * Check for safety confirmation requirement
   */
  hasSafetyRequireConfirmation(res) {
    const safety = res.safetyDecision || res.candidates?.[0]?.safetyDecision;
    return Boolean(safety?.requireConfirmation);
  }

  /**
   * Extract function calls from response
   */
  extractFunctionCalls(res) {
    const parts = res.candidates?.[0]?.content?.parts ?? [];
    const calls = [];
    for (const p of parts) {
      if (p.functionCall) {
        calls.push(FunctionCallSchema.parse(p.functionCall));
      }
    }
    return calls;
  }

  /**
   * Cleanup
   */
  async cleanup() {
    await this.browserManager?.cleanup();
    await this.logger.log(pc.green('Agent cleanup complete'));
  }
}
