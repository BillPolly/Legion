/**
 * Browser Manager - Manages Playwright browser context and page lifecycle
 */

import { chromium } from 'playwright';
import { mkdir, writeFile, appendFile } from 'fs/promises';
import path from 'path';
import pc from 'picocolors';

export class BrowserManager {
  constructor(options = {}, logger) {
    this.headless = options.headless ?? false;
    this.width = options.width ?? 1440;
    this.height = options.height ?? 900;
    this.startUrl = options.startUrl ?? 'https://www.google.com';
    this.outDir = options.outDir;
    this.logger = logger;

    this.browser = null;
    this.context = null;
    this.page = null;
    this.shotCounter = 0;
    this.recentRequests = [];
    this.consoleLogs = [];
  }

  /**
   * Initialize browser and context
   */
  async initialize() {
    await mkdir(this.outDir, { recursive: true });

    this.browser = await chromium.launch({ headless: this.headless });
    this.context = await this.browser.newContext({
      viewport: { width: this.width, height: this.height },
    });

    // Start tracing for artifacts
    await this.context.tracing.start({ screenshots: true, snapshots: true, sources: true });

    // Capture lightweight network log (last 10)
    this.context.on('requestfinished', (req) => {
      try {
        // Don't await - just capture basic request info without response
        this.recentRequests.push({
          method: req.method(),
          url: req.url(),
          status: null, // Response status not available in sync handler
        });
        if (this.recentRequests.length > 10) this.recentRequests.shift();
      } catch {}
    });

    // Create page
    this.page = await this.context.newPage();

    // Capture console logs
    this.page.on('console', (msg) => {
      try {
        const entry = {
          type: msg.type(),
          text: msg.text(),
          timestamp: new Date().toISOString(),
        };
        this.consoleLogs.push(entry);
        if (this.consoleLogs.length > 50) this.consoleLogs.shift();
      } catch {}
    });

    // Navigate to start URL
    if (this.startUrl) {
      await this.page.goto(this.startUrl, { waitUntil: 'load', timeout: 20000 });
    }

    this.logger.log(pc.green('Browser initialized'));
  }

  /**
   * Take screenshot
   */
  async screenshot(label) {
    const fname = `step_${String(this.shotCounter).padStart(2, '0')}${label ? '_' + label : ''}.png`;
    this.shotCounter += 1;
    const buf = await this.page.screenshot({ type: 'png' });
    await writeFile(path.join(this.outDir, fname), buf);
    return buf;
  }

  /**
   * Get current page state snapshot (AX tree + DOM + URL)
   */
  async getStateSnapshot() {
    const url = this.page.url();
    const viewport = { width: this.width, height: this.height };

    // Accessibility snapshot (pruned for on-screen nodes only)
    const axRaw = await this.page.accessibility.snapshot({ interestingOnly: true }).catch(() => null);
    const ax = [];
    const walk = (node) => {
      if (!node) return;
      if (node.role || node.name)
        ax.push({
          role: node.role,
          name: node.name,
          value: node.value ?? null,
          disabled: node.disabled ?? false,
          checked: node.checked ?? false,
          focused: node.focused ?? false,
          bbox: node.bounds || null,
        });
      if (Array.isArray(node.children)) node.children.forEach(walk);
    };
    walk(axRaw);

    // Lightweight DOM context (ids, names, text of clickable inputs/buttons/links)
    const dom = await this.page.evaluate(() => {
      const pick = (el) => ({
        tag: el.tagName.toLowerCase(),
        id: el.id || undefined,
        name: el.getAttribute('name') || undefined,
        role: el.getAttribute('role') || undefined,
        aria: el.getAttribute('aria-label') || undefined,
        text: el.innerText?.slice(0, 120) || undefined,
      });
      const btns = Array.from(
        document.querySelectorAll('button, [role=button], a, input, select, textarea')
      )
        .slice(0, 100)
        .map(pick);
      return { nodes: btns };
    });

    return {
      url,
      viewport,
      ax: ax.slice(0, 200),
      dom,
      recentRequests: this.recentRequests,
      consoleLogs: this.consoleLogs,
    };
  }

  /**
   * Cleanup browser and save trace
   */
  async cleanup() {
    try {
      await this.context.tracing.stop({ path: path.join(this.outDir, 'trace.zip') });
    } catch {}
    await this.browser?.close();
    this.logger.log(pc.green('Browser cleaned up'));
  }

  /**
   * Get page instance
   */
  getPage() {
    return this.page;
  }
}
