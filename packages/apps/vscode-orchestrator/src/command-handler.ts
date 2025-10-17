import type { CommandHandler } from './types.js';
import { openFile, saveFile, replaceAll, closeFile } from './commands/file-ops.js';
import { typeText, chunkedInsert, lineByLineInsert } from './commands/animated-edit.js';
import { setCursor, reveal, highlight } from './commands/cursor-ops.js';
import { openUrl, sleep, batch, closeTab, closeAllTabs } from './commands/utils.js';
import { showFlashcard, closeFlashcard } from './commands/flashcard.js';
import { executeScript, fillInput, clickElement, scrollTo, closeWebview } from './commands/webview-ops.js';

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
    this.handlers.set('closeFile', closeFile);

    // Animated editing
    this.handlers.set('type', typeText);
    this.handlers.set('chunkedInsert', chunkedInsert);
    this.handlers.set('lineByLine', lineByLineInsert);

    // Cursor & visibility
    this.handlers.set('setCursor', setCursor);
    this.handlers.set('reveal', reveal);
    this.handlers.set('highlight', highlight);

    // Browser & utilities
    this.handlers.set('openUrl', openUrl);
    this.handlers.set('sleep', sleep);
    this.handlers.set('closeTab', closeTab);
    this.handlers.set('closeAllTabs', closeAllTabs);

    // Flashcard
    this.handlers.set('showFlashcard', showFlashcard);
    this.handlers.set('closeFlashcard', closeFlashcard);

    // Webview manipulation
    this.handlers.set('executeScript', executeScript);
    this.handlers.set('fillInput', fillInput);
    this.handlers.set('clickElement', clickElement);
    this.handlers.set('scrollTo', scrollTo);
    this.handlers.set('closeWebview', closeWebview);

    // Batch - special handling needed
    this.handlers.set('batch', async (args) => {
      return batch(args, this.execute.bind(this));
    });

    // Debug command to list all available commands
    this.handlers.set('listCommands', async () => {
      return { commands: this.getCommands() };
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
