/**
 * @fileoverview Basic Tool mock for testing without Legion dependencies
 * This is a temporary implementation for TDD development
 */

import { EventEmitter } from 'events';

export class Tool extends EventEmitter {
  constructor(config = {}) {
    super();
    this.name = config.name || 'unknown';
    this.description = config.description || '';
    this.inputSchema = config.inputSchema || {};
  }

  async execute(args) {
    throw new Error('execute method must be implemented by subclass');
  }
}