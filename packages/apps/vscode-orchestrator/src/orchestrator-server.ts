import * as vscode from 'vscode';
import { WebSocketServer, WebSocket } from 'ws';
import type { CommandEnvelope, ResponseEnvelope } from './types.js';
import { CommandRegistry } from './command-handler.js';
import { FileLogger } from './utils/FileLogger.js';

export class OrchestratorServer {
  private wss: WebSocketServer | null = null;
  private commandRegistry: CommandRegistry;
  private port: number;
  private outputChannel: vscode.OutputChannel;
  private fileLogger: FileLogger;

  constructor(port: number, outputChannel: vscode.OutputChannel) {
    this.port = port;
    this.outputChannel = outputChannel;
    this.commandRegistry = new CommandRegistry();
    // Hardcode log directory to package location
    const logDir = '/Users/williampearson/Legion/packages/apps/vscode-orchestrator/.logs';
    this.fileLogger = new FileLogger({ outputDir: logDir });
  }

  async start(): Promise<void> {
    await this.fileLogger.initialize();

    // Make logger available globally for webview logging
    (global as any).orchestratorLogger = this.fileLogger;

    return new Promise((resolve, reject) => {
      try {
        this.wss = new WebSocketServer({
          host: '127.0.0.1',
          port: this.port
        });

        this.wss.on('listening', () => {
          this.log(`Orchestrator WebSocket server listening on ws://127.0.0.1:${this.port}`);
          vscode.window.showInformationMessage(
            `Orchestrator server started on port ${this.port}`
          );
          resolve();
        });

        this.wss.on('connection', (ws: WebSocket) => {
          this.log('Client connected');
          this.handleConnection(ws);
        });

        this.wss.on('error', (error) => {
          this.log(`WebSocket server error: ${error.message}`);
          reject(error);
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  private handleConnection(ws: WebSocket): void {
    ws.on('message', async (data: Buffer) => {
      try {
        const message: CommandEnvelope = JSON.parse(data.toString());
        this.log(`Received command: ${message.cmd} (id: ${message.id})`, {
          cmd: message.cmd,
          id: message.id,
          args: message.args
        });

        const response = await this.handleCommand(message);
        ws.send(JSON.stringify(response));
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        this.log(`Error handling message: ${errorMsg}`);

        const response: ResponseEnvelope = {
          id: 'unknown',
          ok: false,
          error: errorMsg,
          code: 'E_PARSE_ERROR'
        };
        ws.send(JSON.stringify(response));
      }
    });

    ws.on('close', () => {
      this.log('Client disconnected');
    });

    ws.on('error', (error) => {
      this.log(`WebSocket error: ${error.message}`);
    });
  }

  private async handleCommand(message: CommandEnvelope): Promise<ResponseEnvelope> {
    try {
      if (!this.commandRegistry.hasCommand(message.cmd)) {
        this.log(`Unknown command: ${message.cmd}`, { cmd: message.cmd });
        return {
          id: message.id,
          ok: false,
          error: `Unknown command: ${message.cmd}`,
          code: 'E_BAD_CMD'
        };
      }

      const result = await this.commandRegistry.execute(message.cmd, message.args);

      this.log(`Command executed successfully: ${message.cmd}`, {
        cmd: message.cmd,
        result: result
      });

      return {
        id: message.id,
        ok: true,
        data: result
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.log(`Command execution error: ${errorMsg}`, {
        cmd: message.cmd,
        error: errorMsg,
        stack: error instanceof Error ? error.stack : undefined
      });

      return {
        id: message.id,
        ok: false,
        error: errorMsg,
        code: 'E_EXECUTION_ERROR'
      };
    }
  }

  async stop(): Promise<void> {
    if (this.wss) {
      return new Promise((resolve) => {
        this.wss!.close(() => {
          this.log('Orchestrator server stopped');
          resolve();
        });
      });
    }
  }

  private log(message: string, context: any = {}): void {
    const timestamp = new Date().toISOString();
    this.outputChannel.appendLine(`[${timestamp}] ${message}`);

    // Also log to file (async, don't await to avoid blocking)
    this.fileLogger.log('info', message, context).catch(err => {
      console.error('File logging failed:', err);
    });
  }
}
