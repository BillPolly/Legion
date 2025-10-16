import type { CommandHandler } from './types.js';
import { openFile, saveFile, replaceAll } from './commands/file-ops.js';
import { typeText, chunkedInsert } from './commands/animated-edit.js';
import { setCursor, reveal, highlight } from './commands/cursor-ops.js';
import { openUrl, sleep, batch } from './commands/utils.js';

export class CommandRegistry {
  private handlers: Map<string, CommandHandler> = new Map();

  constructor() {
    this.registerHandlers();
  }

  private registerHandlers(): void {
    // File operations
    this.handlers.set('open', openFile);
    this.handlers.set('save', saveFile);
    this.handlers.set('replaceAll', replaceAll);

    // Animated editing
    this.handlers.set('type', typeText);
    this.handlers.set('chunkedInsert', chunkedInsert);

    // Cursor & visibility
    this.handlers.set('setCursor', setCursor);
    this.handlers.set('reveal', reveal);
    this.handlers.set('highlight', highlight);

    // Browser & utilities
    this.handlers.set('openUrl', openUrl);
    this.handlers.set('sleep', sleep);

    // Batch - special handling needed
    this.handlers.set('batch', async (args) => {
      return batch(args, this.execute.bind(this));
    });
  }

  async execute(cmd: string, args: any): Promise<any> {
    const handler = this.handlers.get(cmd);
    if (!handler) {
      throw new Error(`Unknown command: ${cmd}`);
    }

    return handler(args);
  }

  hasCommand(cmd: string): boolean {
    return this.handlers.has(cmd);
  }

  getCommands(): string[] {
    return Array.from(this.handlers.keys());
  }
}
