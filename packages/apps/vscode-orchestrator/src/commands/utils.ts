import * as vscode from 'vscode';
import type { OpenUrlArgs, SleepArgs, BatchArgs } from '../types.js';
import { registerWebviewPanel } from './webview-ops.js';

export async function openUrl(args: OpenUrlArgs): Promise<any> {
  const viewColumn = args.column ?? 2;

  try {
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

    // Set the webview content to an iframe loading the URL
    panel.webview.html = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta http-equiv="Content-Security-Policy" content="default-src * 'unsafe-inline' 'unsafe-eval'; script-src * 'unsafe-inline' 'unsafe-eval'; connect-src * 'unsafe-inline'; img-src * data: blob: 'unsafe-inline'; frame-src *; style-src * 'unsafe-inline';">
        <style>
          body, html {
            margin: 0;
            padding: 0;
            width: 100%;
            height: 100vh;
            overflow: hidden;
          }
          iframe {
            width: 100%;
            height: 100%;
            border: none;
          }
        </style>
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

          logToExtension('info', 'VSCode webview wrapper initialized');

          // Monitor iframe load events
          window.addEventListener('DOMContentLoaded', () => {
            const iframe = document.querySelector('iframe');

            logToExtension('info', 'Iframe element found, setting up monitors', {
              src: iframe.src
            });

            iframe.addEventListener('load', () => {
              logToExtension('info', 'Iframe load event fired', {
                src: iframe.src,
                contentWindow: !!iframe.contentWindow
              });
            });

            iframe.addEventListener('error', (e) => {
              logToExtension('error', 'Iframe error event', {
                error: e.toString()
              });
            });
          });

          // Listen for messages from iframe
          window.addEventListener('message', (event) => {
            logToExtension('info', 'Webview received message from iframe', {
              type: event.data?.type,
              origin: event.origin
            });

            if (event.data && event.data.type === 'open-link') {
              logToExtension('info', 'Valid open-link message, forwarding to extension', {
                url: event.data.url
              });

              // Forward to VS Code extension
              vscode.postMessage({
                command: 'openUrl',
                url: event.data.url
              });

              logToExtension('info', 'Message forwarded to VSCode extension');
            } else {
              logToExtension('warn', 'Message type not recognized', {
                type: event.data?.type
              });
            }
          });

          // Listen for messages from VSCode extension (for script execution)
          window.addEventListener('message', (event) => {
            const message = event.data;

            if (message && message.type === 'executeScript') {
              logToExtension('info', 'Executing script in iframe', {
                script: message.script
              });

              // Execute script in iframe context
              const iframe = document.querySelector('iframe');
              if (iframe && iframe.contentWindow) {
                try {
                  iframe.contentWindow.postMessage({
                    type: 'executeScript',
                    script: message.script
                  }, '*');
                  logToExtension('info', 'Script execution message sent to iframe');
                } catch (error) {
                  logToExtension('error', 'Failed to send script to iframe', {
                    error: error.toString()
                  });
                }
              }
            }
          });

          logToExtension('info', 'Message listeners registered');
        </script>
      </head>
      <body>
        <iframe src="${args.url}"></iframe>
      </body>
      </html>
    `;

    return { url: args.url, column: viewColumn, panel: 'created' };
  } catch (error) {
    throw new Error(`Failed to open URL: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export async function sleep(args: SleepArgs): Promise<any> {
  await new Promise(resolve => setTimeout(resolve, args.ms));
  return { slept: args.ms };
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
