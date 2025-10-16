import * as vscode from 'vscode';
import type { OpenUrlArgs, SleepArgs, BatchArgs } from '../types.js';

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
        retainContextWhenHidden: true // Keep webview state when hidden
      }
    );

    // Listen for messages from the webview
    panel.webview.onDidReceiveMessage(
      async (message) => {
        console.log('🎯 Extension received message from webview:', message);

        if (message.command === 'openUrl') {
          console.log('✅ Opening URL in column 3:', message.url);
          // Recursively open new URL in column 3
          await openUrl({ url: message.url, column: 3 });
          console.log('✅ URL opened successfully');
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

          console.log('🎯 VSCode webview wrapper initialized');

          // Listen for messages from iframe
          window.addEventListener('message', (event) => {
            console.log('📨 Webview received message:', event.data);

            if (event.data && event.data.type === 'open-link') {
              console.log('✅ Valid open-link message, forwarding to extension...');
              console.log('🔗 URL:', event.data.url);

              // Forward to VS Code extension
              vscode.postMessage({
                command: 'openUrl',
                url: event.data.url
              });

              console.log('📤 Message forwarded to VSCode extension');
            } else {
              console.log('⚠️ Message type not recognized:', event.data?.type);
            }
          });

          console.log('✅ Message listener registered');
        </script>
      </head>
      <body>
        <iframe src="${args.url}" sandbox="allow-same-origin allow-scripts allow-popups allow-forms"></iframe>
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
