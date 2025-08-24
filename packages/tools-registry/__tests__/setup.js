/**
 * Global test setup for tools-registry
 * 
 * Minimal setup - ToolRegistry handles its own cleanup via reset()
 */

import { afterEach } from '@jest/globals';
import { ToolRegistry } from '../src/index.js';

// Reset ToolRegistry singleton after each test
afterEach(async () => {
  ToolRegistry.reset();
});