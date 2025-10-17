import * as vscode from 'vscode';
import * as fs from 'fs';
import { fileURLToPath } from 'url';
import type { OpenUrlArgs, SleepArgs, BatchArgs } from '../types.js';
import { registerWebviewPanel } from './webview-ops.js';

export async function openUrl(args: OpenUrlArgs): Promise<any> {
  const viewColumn = args.column ?? 2;

  try {
    // Fetch the URL content server-side
    let htmlContent: string;
    try {
      // Handle file:// URLs
      if (args.url.startsWith('file://')) {
        const filePath = fileURLToPath(args.url);
        htmlContent = fs.readFileSync(filePath, 'utf-8');
        console.log(`✅ Read file from ${args.url}: ${htmlContent.length} bytes`);
      } else {
        // Handle http/https URLs
        const response = await fetch(args.url);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        htmlContent = await response.text();
        console.log(`✅ Fetched content from ${args.url}: ${htmlContent.length} bytes`);
      }
    } catch (fetchError) {
      const errorMsg = fetchError instanceof Error ? fetchError.message : String(fetchError);
      console.error(`❌ Failed to fetch ${args.url}: ${errorMsg}`);
      throw new Error(`Failed to fetch URL: ${errorMsg}`);
    }

    // Create a webview panel to display the URL
    const panel = vscode.window.createWebviewPanel(
      'orchestratorBrowser', // Internal ID
      `Browser: ${args.url}`, // Panel title
      viewColumn as vscode.ViewColumn, // Editor column
      {
        enableScripts: true, // Allow JavaScript in the webview
        retainContextWhenHidden: true, // Keep webview state when hidden
        localResourceRoots: [] // Allow loading external resources
      }
    );

    // Register panel for later manipulation (script execution, etc.)
    registerWebviewPanel(args.url, panel);

    // Listen for messages from the webview
    panel.webview.onDidReceiveMessage(
      async (message) => {
        console.log('🎯 Extension received message from webview:', message);

        if (message.command === 'openUrl') {
          console.log('✅ Opening URL in column 3:', message.url);
          // Recursively open new URL in column 3
          await openUrl({ url: message.url, column: 3 });
          console.log('✅ URL opened successfully');
        } else if (message.command === 'log') {
          // Forward webview logs to file logger via global handler
          const logMessage = `[WEBVIEW] ${message.message}`;
          console.log(`${message.level.toUpperCase()}: ${logMessage}`, message.data);

          // Send to global logger if available
          if ((global as any).orchestratorLogger) {
            (global as any).orchestratorLogger.log(message.level, logMessage, message.data);
          }
        } else {
          console.log('⚠️ Unknown command:', message.command);
        }
      }
    );

    // Set up webview with our script that will dynamically inject the fetched content
    panel.webview.html = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta http-equiv="Content-Security-Policy" content="default-src * 'unsafe-inline' 'unsafe-eval' data: blob: file:; script-src * 'unsafe-inline' 'unsafe-eval'; connect-src * 'unsafe-inline'; img-src * data: blob: file: 'unsafe-inline'; frame-src *; style-src * 'unsafe-inline' file:; font-src * data: file:;">
      </head>
      <body>
        <div id="content-container"></div>
        <script>
          const vscode = acquireVsCodeApi();

          // Helper to send logs to extension
          function logToExtension(level, message, data = {}) {
            vscode.postMessage({
              command: 'log',
              level: level,
              message: message,
              data: data
            });
          }

          logToExtension('info', 'Webview initialized, waiting for content');

          // Listen for content from extension
          window.addEventListener('message', (event) => {
            const message = event.data;

            if (message && message.type === 'injectContent') {
              logToExtension('info', 'Received content to inject', {
                contentLength: message.html ? message.html.length : 0
              });

              try {
                const container = document.getElementById('content-container');
                if (container) {
                  // Add base tag to fix relative URLs
                  const baseUrl = message.baseUrl || '';
                  if (baseUrl && !document.querySelector('base')) {
                    const base = document.createElement('base');
                    base.href = baseUrl;
                    document.head.insertBefore(base, document.head.firstChild);
                    logToExtension('info', 'Added base URL', { baseUrl });
                  }

                  container.innerHTML = message.html;
                  logToExtension('info', 'Content injected successfully', {
                    contentPreview: message.html.substring(0, 200)
                  });

                  // Extract and execute scripts from injected HTML
                  const scripts = container.querySelectorAll('script');
                  logToExtension('info', 'Found scripts in injected content', {
                    count: scripts.length
                  });

                  scripts.forEach((oldScript) => {
                    const newScript = document.createElement('script');

                    // Copy all attributes
                    Array.from(oldScript.attributes).forEach(attr => {
                      newScript.setAttribute(attr.name, attr.value);
                    });

                    // Copy script content
                    newScript.textContent = oldScript.textContent;

                    // Replace old script with new one to execute it
                    oldScript.parentNode.replaceChild(newScript, oldScript);
                  });

                  logToExtension('info', 'Scripts executed');

                  // Intercept all link clicks
                  container.addEventListener('click', (e) => {
                    const target = e.target;
                    const link = target.closest('a');

                    if (link && link.href) {
                      e.preventDefault();
                      e.stopPropagation();

                      logToExtension('info', 'Link clicked, opening in new webview', {
                        url: link.href
                      });

                      // Send to extension to open in column 3
                      vscode.postMessage({
                        command: 'openUrl',
                        url: link.href
                      });
                    }
                  }, true);

                  logToExtension('info', 'Link click interception enabled');
                } else {
                  logToExtension('error', 'Content container not found');
                }
              } catch (e) {
                logToExtension('error', 'Failed to inject content', {
                  error: e.toString()
                });
              }
            }
          });

          logToExtension('info', 'Message listeners registered');
        </script>
      </body>
      </html>
    `;

    // Send the fetched content to the webview with base URL
    panel.webview.postMessage({
      type: 'injectContent',
      html: htmlContent,
      baseUrl: args.url
    });

    return { url: args.url, column: viewColumn, panel: 'created' };
  } catch (error) {
    throw new Error(`Failed to open URL: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export async function sleep(args: SleepArgs): Promise<any> {
  await new Promise(resolve => setTimeout(resolve, args.ms));
  return { slept: args.ms };
}

export async function closeTab(args?: { column?: number }): Promise<any> {
  const column = args?.column;

  if (column !== undefined) {
    // Close specific column
    const editor = vscode.window.visibleTextEditors.find(
      e => e.viewColumn === column
    );
    if (editor) {
      await vscode.window.showTextDocument(editor.document, editor.viewColumn);
      await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
      return { closed: true, column };
    }
    return { closed: false, message: 'No editor in that column' };
  } else {
    // Close active editor
    await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
    return { closed: true, column: 'active' };
  }
}

export async function closeAllTabs(): Promise<any> {
  await vscode.commands.executeCommand('workbench.action.closeAllEditors');
  return { closed: 'all' };
}

export async function batch(
  args: BatchArgs,
  executeCommand: (cmd: string, cmdArgs: any) => Promise<any>
): Promise<any> {
  const results = [];

  for (const op of args.ops) {
    try {
      const result = await executeCommand(op.cmd, op.args);
      results.push({ ok: true, data: result });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      results.push({ ok: false, error: errorMsg });
      // Stop on first error
      throw new Error(`Batch failed at operation ${results.length}: ${errorMsg}`);
    }
  }

  return { operations: results.length, results };
}
