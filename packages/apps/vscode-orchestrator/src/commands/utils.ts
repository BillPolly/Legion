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
