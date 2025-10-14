/**
 * Action Executor - Hybrid DOM/AX-first then coordinate fallback
 * Executes browser actions with semantic resolution when possible
 */

import pc from 'picocolors';

export class ActionExecutor {
  constructor(page, logger, options = {}) {
    this.page = page;
    this.logger = logger;
    this.screenWidth = options.width || 1440;
    this.screenHeight = options.height || 900;
    this.allowlistHosts = options.allowlistHosts;
  }

  /**
   * Execute a browser action with hybrid approach
   */
  async execute(name, args) {
    this.logger.log(pc.magenta(`Action: ${name} ${JSON.stringify(args ?? {})}`));

    // Guard: allowlisted hosts
    if ((name === 'navigate' || name === 'enter_url') && this.allowlistHosts?.length) {
      const target = new URL(String(args?.url));
      if (!this.allowlistHosts.includes(target.hostname)) {
        throw new Error(`Disallowed host: ${target.hostname}`);
      }
    }

    // Route to specific action handler
    switch (name) {
      case 'navigate':
      case 'enter_url':
        return await this.navigate(args);
      case 'type_text_at':
        return await this.typeTextAt(args);
      case 'click_at':
        return await this.clickAt(args);
      case 'double_click':
        return await this.doubleClick(args);
      case 'right_click':
        return await this.rightClick(args);
      case 'hover_at':
        return await this.hoverAt(args);
      case 'drag_and_drop':
        return await this.dragAndDrop(args);
      case 'scroll_document':
        return await this.scrollDocument(args);
      case 'scroll_at':
        return await this.scrollAt(args);
      case 'go_back':
        return await this.page.goBack();
      case 'go_forward':
        return await this.page.goForward();
      case 'open_web_browser':
        return; // no-op
      case 'wait_5_seconds':
        return await this.page.waitForTimeout(5000);
      default:
        this.logger.log(pc.gray(`Unimplemented action: ${name}`));
        return;
    }
  }

  /**
   * Navigate to URL
   */
  async navigate(args) {
    await this.page.goto(String(args.url), { waitUntil: 'load', timeout: 20000 });
  }

  /**
   * Type text at coordinates with element resolution
   */
  async typeTextAt(args) {
    const { x, y, text = '', press_enter = true, clear_before_typing = true } = args ?? {};
    const el = await this.elementAtOrNearest(x, y);

    if (el) {
      await el.click();
      if (clear_before_typing) {
        await this.page.keyboard.press('Control+A').catch(() => {});
        await this.page.keyboard.press('Meta+A').catch(() => {});
        await this.page.keyboard.press('Backspace').catch(() => {});
      }
      await this.page.keyboard.type(String(text));
      if (press_enter) await this.page.keyboard.press('Enter');
      await el.dispose();
      return;
    }

    // Fallback to coordinates
    await this.clickAtCoords(x, y);
    await this.page.keyboard.type(String(text));
    if (press_enter) await this.page.keyboard.press('Enter');
  }

  /**
   * Click at coordinates with element resolution
   */
  async clickAt(args) {
    const { x, y } = args ?? {};
    const el = await this.elementAtOrNearest(x, y);
    if (el) {
      await el.click();
      await el.dispose();
      return;
    }
    await this.clickAtCoords(x, y);
  }

  /**
   * Double click at coordinates
   */
  async doubleClick(args) {
    const { x, y } = args ?? {};
    const el = await this.elementAtOrNearest(x, y);
    if (el) {
      await el.dblclick();
      await el.dispose();
      return;
    }
    const [px, py] = this.denorm(x, y);
    await this.page.mouse.dblclick(px, py);
  }

  /**
   * Right click at coordinates
   */
  async rightClick(args) {
    const { x, y } = args ?? {};
    const el = await this.elementAtOrNearest(x, y);
    if (el) {
      await el.click({ button: 'right' });
      await el.dispose();
      return;
    }
    const [px, py] = this.denorm(x, y);
    await this.page.mouse.click(px, py, { button: 'right' });
  }

  /**
   * Hover at coordinates
   */
  async hoverAt(args) {
    const { x, y } = args ?? {};
    const el = await this.elementAtOrNearest(x, y);
    if (el) {
      const box = await el.boundingBox();
      if (box) await this.page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await el.dispose();
      return;
    }
    const [px, py] = this.denorm(x, y);
    await this.page.mouse.move(px, py);
  }

  /**
   * Drag and drop
   */
  async dragAndDrop(args) {
    const { x, y, destination_x, destination_y } = args ?? {};
    const src = await this.elementAtOrNearest(x, y);
    const dst = await this.elementAtOrNearest(destination_x, destination_y);

    if (src && dst) {
      await src.dragTo(dst);
      await src.dispose();
      await dst.dispose();
      return;
    }

    // Fallback to coords
    const [sx, sy] = this.denorm(x, y);
    const [dx, dy] = this.denorm(destination_x, destination_y);
    await this.page.mouse.move(sx, sy);
    await this.page.mouse.down();
    await this.page.mouse.move(dx, dy);
    await this.page.mouse.up();
  }

  /**
   * Scroll document
   */
  async scrollDocument(args) {
    const d = String(args?.direction ?? 'down');
    if (d === 'down') await this.page.keyboard.press('PageDown');
    else if (d === 'up') await this.page.keyboard.press('PageUp');
    else if (d === 'left') await this.page.keyboard.press('ArrowLeft');
    else if (d === 'right') await this.page.keyboard.press('ArrowRight');
  }

  /**
   * Scroll at coordinates
   */
  async scrollAt(args) {
    const { x, y, direction = 'down', magnitude = 800 } = args ?? {};
    const [px, py] = this.denorm(x, y);
    await this.page.mouse.move(px, py);
    const amt = Math.round((Number(magnitude) * this.screenHeight) / 1000);
    if (direction === 'down') await this.page.mouse.wheel(0, amt);
    else if (direction === 'up') await this.page.mouse.wheel(0, -amt);
    else if (direction === 'left') await this.page.mouse.wheel(-amt, 0);
    else if (direction === 'right') await this.page.mouse.wheel(amt, 0);
  }

  /**
   * Find element at or nearest to coordinates
   * Uses hit-testing and accessibility tree for semantic resolution
   */
  async elementAtOrNearest(xNorm, yNorm) {
    const [px, py] = this.denorm(xNorm, yNorm);

    // 1) Hit-test using document.elementFromPoint
    const handle = await this.page.evaluateHandle(
      ({ x, y }) => {
        const el = document.elementFromPoint(x, y);
        return el;
      },
      { x: px, y: py }
    );

    let el = handle.asElement();
    if (el) return el;

    // 2) Nearest interactive element by bounding box (AX snapshot)
    const ax = await this.accessibilitySnapshot();
    const nearest = this.findNearestBbox(ax, px, py);
    if (nearest) {
      const sel = await this.page.evaluate(
        ({ x, y }) => {
          const el = document.elementFromPoint(x, y);
          if (!el) return null;
          // Walk up to find an interactive ancestor
          let cur = el;
          while (cur && !cur.click) cur = cur.parentElement;
          if (!cur) return null;
          // Build a stable-ish selector
          if (cur.id) return `#${CSS.escape(cur.id)}`;
          const name = cur.getAttribute('name');
          if (name) return `${cur.tagName.toLowerCase()}[name="${name}"]`;
          const aria = cur.getAttribute('aria-label');
          if (aria) return `${cur.tagName.toLowerCase()}[aria-label="${aria}"]`;
          return null;
        },
        { x: nearest.centerX, y: nearest.centerY }
      );

      if (sel) {
        const found = await this.page.$(sel);
        if (found) return found;
      }
    }

    return null;
  }

  /**
   * Get accessibility snapshot
   */
  async accessibilitySnapshot() {
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
    return ax;
  }

  /**
   * Find nearest bounding box to coordinates
   */
  findNearestBbox(ax, px, py) {
    let best = null;
    for (const n of ax) {
      const b = n.bbox;
      if (!b) continue;
      const cx = b.x + b.width / 2;
      const cy = b.y + b.height / 2;
      const dx = cx - px;
      const dy = cy - py;
      const d = dx * dx + dy * dy;
      if (!best || d < best.d) best = { d, centerX: cx, centerY: cy };
    }
    return best;
  }

  /**
   * Denormalize coordinates (0-999 -> pixels)
   */
  denorm(xNorm, yNorm) {
    const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
    const px = clamp(Math.round((Number(xNorm) / 1000) * this.screenWidth), 0, this.screenWidth - 1);
    const py = clamp(Math.round((Number(yNorm) / 1000) * this.screenHeight), 0, this.screenHeight - 1);
    return [px, py];
  }

  /**
   * Click at coordinates
   */
  async clickAtCoords(xNorm, yNorm) {
    const [px, py] = this.denorm(xNorm, yNorm);
    await this.page.mouse.click(px, py);
  }
}
