import * as vscode from 'vscode';

// Store webview panels by URL for later manipulation
const webviewPanels = new Map<string, vscode.WebviewPanel>();

/**
 * Execute arbitrary JavaScript in a webview
 */
export async function executeScript(args: { url: string; script: string }): Promise<any> {
  const panel = webviewPanels.get(args.url);

  if (!panel) {
    throw new Error(`No webview found for URL: ${args.url}`);
  }

  try {
    // Execute script in the iframe context by injecting script tag
    await panel.webview.postMessage({
      type: 'executeScript',
      script: args.script
    });

    return { executed: true, url: args.url };
  } catch (error) {
    throw new Error(`Failed to execute script: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Fill an input field with a value
 */
export async function fillInput(args: { url: string; selector: string; value: string }): Promise<any> {
  const script = `
    (function() {
      const el = document.querySelector('${args.selector.replace(/'/g, "\\'")}');
      if (!el) throw new Error('Element not found: ${args.selector.replace(/'/g, "\\'")}');
      el.value = '${args.value.replace(/'/g, "\\'")}';
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      return { filled: true, selector: '${args.selector.replace(/'/g, "\\'")}' };
    })()
  `;

  return executeScript({ url: args.url, script });
}

/**
 * Click an element
 */
export async function clickElement(args: { url: string; selector: string }): Promise<any> {
  const script = `
    (function() {
      const el = document.querySelector('${args.selector.replace(/'/g, "\\'")}');
      if (!el) throw new Error('Element not found: ${args.selector.replace(/'/g, "\\'")}');
      el.click();
      return { clicked: true, selector: '${args.selector.replace(/'/g, "\\'")}' };
    })()
  `;

  return executeScript({ url: args.url, script });
}

/**
 * Scroll to an element
 */
export async function scrollTo(args: { url: string; selector: string }): Promise<any> {
  const script = `
    (function() {
      const el = document.querySelector('${args.selector.replace(/'/g, "\\'")}');
      if (!el) throw new Error('Element not found: ${args.selector.replace(/'/g, "\\'")}');
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return { scrolled: true, selector: '${args.selector.replace(/'/g, "\\'")}' };
    })()
  `;

  return executeScript({ url: args.url, script });
}

/**
 * Register a webview panel for later manipulation
 */
export function registerWebviewPanel(url: string, panel: vscode.WebviewPanel): void {
  webviewPanels.set(url, panel);

  // Clean up when panel is disposed
  panel.onDidDispose(() => {
    webviewPanels.delete(url);
  });
}

/**
 * Get a registered webview panel
 */
export function getWebviewPanel(url: string): vscode.WebviewPanel | undefined {
  return webviewPanels.get(url);
}
