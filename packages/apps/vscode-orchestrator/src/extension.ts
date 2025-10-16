import * as vscode from 'vscode';
import { OrchestratorServer } from './orchestrator-server.js';

let server: OrchestratorServer | null = null;
let outputChannel: vscode.OutputChannel;

export async function activate(context: vscode.ExtensionContext) {
  outputChannel = vscode.window.createOutputChannel('VSCode Orchestrator');
  outputChannel.appendLine('VSCode Orchestrator extension activated');

  // Get configuration
  const config = vscode.workspace.getConfiguration('orchestrator');
  const port = config.get<number>('port') ?? 17892;

  // Start server automatically
  server = new OrchestratorServer(port, outputChannel);

  try {
    await server.start();
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    vscode.window.showErrorMessage(`Failed to start Orchestrator server: ${errorMsg}`);
    outputChannel.appendLine(`Failed to start server: ${errorMsg}`);
  }

  // Register toggle command
  const toggleCommand = vscode.commands.registerCommand(
    'orchestrator.toggle',
    async () => {
      if (server) {
        await server.stop();
        server = null;
        vscode.window.showInformationMessage('Orchestrator server stopped');
      } else {
        server = new OrchestratorServer(port, outputChannel);
        try {
          await server.start();
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          vscode.window.showErrorMessage(`Failed to start Orchestrator server: ${errorMsg}`);
        }
      }
    }
  );

  context.subscriptions.push(toggleCommand);
}

export async function deactivate() {
  if (server) {
    await server.stop();
    server = null;
  }

  if (outputChannel) {
    outputChannel.dispose();
  }
}
