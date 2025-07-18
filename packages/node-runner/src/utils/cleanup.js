import treeKill from 'tree-kill';

/**
 * Cleanup utilities for process and resource management
 */

/**
 * Registry of cleanup handlers
 */
const cleanupHandlers = new Set();
let cleanupRegistered = false;

/**
 * Register a cleanup handler
 */
export function registerCleanupHandler(handler) {
  cleanupHandlers.add(handler);
  
  if (!cleanupRegistered) {
    setupProcessHandlers();
    cleanupRegistered = true;
  }
}

/**
 * Unregister a cleanup handler
 */
export function unregisterCleanupHandler(handler) {
  cleanupHandlers.delete(handler);
}

/**
 * Setup process event handlers for cleanup
 */
function setupProcessHandlers() {
  const runCleanup = async (signal) => {
    console.log(`\nReceived ${signal}, cleaning up...`);
    
    const handlers = Array.from(cleanupHandlers);
    const results = await Promise.allSettled(
      handlers.map(handler => handler(signal))
    );
    
    // Log any cleanup errors
    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        console.error(`Cleanup handler ${index} failed:`, result.reason);
      }
    });
    
    // Exit after cleanup
    process.exit(0);
  };

  // Handle various termination signals
  process.on('SIGINT', () => runCleanup('SIGINT'));
  process.on('SIGTERM', () => runCleanup('SIGTERM'));
  
  // Handle uncaught errors
  process.on('uncaughtException', (error) => {
    console.error('Uncaught exception:', error);
    runCleanup('uncaughtException');
  });
  
  process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled rejection at:', promise, 'reason:', reason);
    runCleanup('unhandledRejection');
  });
}

/**
 * Kill a process tree
 */
export async function killProcessTree(pid, signal = 'SIGTERM') {
  return new Promise((resolve, reject) => {
    treeKill(pid, signal, (err) => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
}

/**
 * Kill process with timeout and force kill
 */
export async function killProcessWithTimeout(pid, options = {}) {
  const {
    timeout = 5000,
    signal = 'SIGTERM',
    forceSignal = 'SIGKILL'
  } = options;
  
  try {
    // Try graceful termination
    await killProcessTree(pid, signal);
    
    // Wait for process to exit with timeout
    const startTime = Date.now();
    while (Date.now() - startTime < timeout) {
      if (!isProcessRunning(pid)) {
        return { killed: true, forced: false };
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    // Force kill if still running
    await killProcessTree(pid, forceSignal);
    return { killed: true, forced: true };
  } catch (error) {
    // Process might already be dead
    if (!isProcessRunning(pid)) {
      return { killed: true, forced: false };
    }
    throw error;
  }
}

/**
 * Check if process is running
 */
export function isProcessRunning(pid) {
  try {
    // Signal 0 checks if process exists without killing it
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Create a cleanup context for automatic resource management
 */
export class CleanupContext {
  constructor() {
    this.resources = [];
    this.cleaned = false;
  }

  /**
   * Add a resource to be cleaned up
   */
  add(resource, cleanupFn) {
    if (this.cleaned) {
      throw new Error('Cannot add resources after cleanup');
    }
    
    this.resources.push({ resource, cleanupFn });
    return resource;
  }

  /**
   * Add a process to be killed on cleanup
   */
  addProcess(pid) {
    return this.add(pid, async () => {
      if (isProcessRunning(pid)) {
        await killProcessWithTimeout(pid);
      }
    });
  }

  /**
   * Add a function to be called on cleanup
   */
  addFunction(fn) {
    return this.add(fn, fn);
  }

  /**
   * Perform cleanup
   */
  async cleanup() {
    if (this.cleaned) {
      return;
    }
    
    this.cleaned = true;
    
    // Clean up in reverse order
    const reversedResources = [...this.resources].reverse();
    
    for (const { resource, cleanupFn } of reversedResources) {
      try {
        await cleanupFn(resource);
      } catch (error) {
        console.error('Cleanup error:', error);
      }
    }
    
    this.resources = [];
  }

  /**
   * Create a scoped cleanup context
   */
  static async withCleanup(fn) {
    const context = new CleanupContext();
    
    try {
      return await fn(context);
    } finally {
      await context.cleanup();
    }
  }
}

/**
 * Debounce cleanup operations
 */
export function debounceCleanup(fn, delay = 1000) {
  let timeoutId = null;
  let pending = null;
  
  return async (...args) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    
    if (!pending) {
      pending = new Promise((resolve, reject) => {
        timeoutId = setTimeout(async () => {
          try {
            const result = await fn(...args);
            resolve(result);
          } catch (error) {
            reject(error);
          } finally {
            pending = null;
            timeoutId = null;
          }
        }, delay);
      });
    }
    
    return pending;
  };
}