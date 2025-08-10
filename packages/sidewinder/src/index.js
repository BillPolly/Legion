/**
 * Sidewinder - Main entry point
 * Provides API for configuring and preparing instrumentation
 */

import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import os from 'os';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class Sidewinder {
  constructor(config = {}) {
    this.config = {
      wsPort: config.wsPort || 9898,
      wsHost: config.wsHost || 'localhost',
      sessionId: config.sessionId || `sw-${Date.now()}`,
      profile: config.profile || 'standard',
      hooks: config.hooks || null,
      debug: config.debug || false,
      tempDir: config.tempDir || os.tmpdir(),
      ...config
    };
    
    this.profiles = {
      minimal: ['console', 'errors'],
      standard: ['console', 'errors', 'http', 'async'],
      full: ['console', 'errors', 'http', 'async', 'memory', 'modules', 'eventloop'],
      custom: config.hooks || []
    };
  }
  
  /**
   * Prepare injection script with configuration
   * Returns path to temporary injection file
   */
  async prepare() {
    // Create unique temp file for this session
    const tempFileName = `sidewinder-${this.config.sessionId}-${crypto.randomBytes(4).toString('hex')}.js`;
    const tempFilePath = path.join(this.config.tempDir, tempFileName);
    
    // Get the hooks to use
    const hooks = this.config.hooks || this.profiles[this.config.profile] || this.profiles.standard;
    
    // Create configuration script
    const configScript = `
// Sidewinder Configuration
process.env.SIDEWINDER_WS_PORT = '${this.config.wsPort}';
process.env.SIDEWINDER_WS_HOST = '${this.config.wsHost}';
process.env.SIDEWINDER_SESSION_ID = '${this.config.sessionId}';
process.env.SIDEWINDER_PROFILE = '${this.config.profile}';
process.env.SIDEWINDER_HOOKS = '${Array.isArray(hooks) ? hooks.join(',') : hooks}';
process.env.SIDEWINDER_DEBUG = '${this.config.debug}';

// Additional configuration
${this.generateAdditionalConfig()}

// Load the actual injection script
require('${path.join(__dirname, 'inject.cjs')}');
`;
    
    await fs.writeFile(tempFilePath, configScript, 'utf8');
    
    // Schedule cleanup
    this.scheduleCleanup(tempFilePath);
    
    return tempFilePath;
  }
  
  /**
   * Generate additional configuration based on options
   */
  generateAdditionalConfig() {
    const lines = [];
    
    if (this.config.captureBody !== undefined) {
      lines.push(`process.env.SIDEWINDER_CAPTURE_BODY = '${this.config.captureBody}';`);
    }
    
    if (this.config.captureHeaders !== undefined) {
      lines.push(`process.env.SIDEWINDER_CAPTURE_HEADERS = '${this.config.captureHeaders}';`);
    }
    
    if (this.config.maxBodySize) {
      lines.push(`process.env.SIDEWINDER_MAX_BODY_SIZE = '${this.config.maxBodySize}';`);
    }
    
    if (this.config.trackResources) {
      lines.push(`process.env.SIDEWINDER_TRACK_RESOURCES = 'true';`);
    }
    
    if (this.config.trackErrorCreation) {
      lines.push(`process.env.SIDEWINDER_TRACK_ERROR_CREATION = 'true';`);
    }
    
    if (this.config.trackPromises) {
      lines.push(`process.env.SIDEWINDER_TRACK_PROMISES = 'true';`);
    }
    
    return lines.join('\n');
  }
  
  /**
   * Schedule cleanup of temp file
   */
  scheduleCleanup(filePath) {
    // Clean up after 1 hour or on process exit
    const timeout = setTimeout(() => {
      this.cleanupFile(filePath);
    }, 3600000); // 1 hour
    
    // Also clean up on exit
    const cleanup = () => {
      clearTimeout(timeout);
      this.cleanupFile(filePath);
    };
    
    process.once('exit', cleanup);
    process.once('SIGINT', cleanup);
    process.once('SIGTERM', cleanup);
  }
  
  /**
   * Clean up temp file
   */
  async cleanupFile(filePath) {
    try {
      await fs.unlink(filePath);
    } catch (err) {
      // Ignore errors - file might already be deleted
    }
  }
  
  /**
   * Get the path to the inject script for direct use
   */
  getInjectPath() {
    return path.join(__dirname, 'inject.cjs');
  }
  
  /**
   * Get the path to the loader script for ES modules
   */
  getLoaderPath() {
    return path.join(__dirname, 'loader.mjs');
  }
  
  /**
   * Create environment variables for manual configuration
   */
  getEnvironmentVariables() {
    const hooks = this.config.hooks || this.profiles[this.config.profile] || this.profiles.standard;
    
    return {
      SIDEWINDER_WS_PORT: String(this.config.wsPort),
      SIDEWINDER_WS_HOST: this.config.wsHost,
      SIDEWINDER_SESSION_ID: this.config.sessionId,
      SIDEWINDER_PROFILE: this.config.profile,
      SIDEWINDER_HOOKS: Array.isArray(hooks) ? hooks.join(',') : hooks,
      SIDEWINDER_DEBUG: String(this.config.debug),
      ...(this.config.captureBody !== undefined && { SIDEWINDER_CAPTURE_BODY: String(this.config.captureBody) }),
      ...(this.config.captureHeaders !== undefined && { SIDEWINDER_CAPTURE_HEADERS: String(this.config.captureHeaders) }),
      ...(this.config.maxBodySize && { SIDEWINDER_MAX_BODY_SIZE: String(this.config.maxBodySize) }),
      ...(this.config.trackResources && { SIDEWINDER_TRACK_RESOURCES: 'true' }),
      ...(this.config.trackErrorCreation && { SIDEWINDER_TRACK_ERROR_CREATION: 'true' }),
      ...(this.config.trackPromises && { SIDEWINDER_TRACK_PROMISES: 'true' })
    };
  }
  
  /**
   * Validate that all required hooks exist
   */
  async validateHooks() {
    const hooks = this.config.hooks || this.profiles[this.config.profile] || this.profiles.standard;
    const hooksDir = path.join(__dirname, '..', 'hooks');
    const errors = [];
    
    for (const hook of hooks) {
      const hookPath = path.join(hooksDir, `${hook}.cjs`);
      try {
        await fs.access(hookPath);
      } catch (err) {
        errors.push(`Hook '${hook}' not found at ${hookPath}`);
      }
    }
    
    if (errors.length > 0) {
      throw new Error(`Hook validation failed:\n${errors.join('\n')}`);
    }
    
    return true;
  }
}

// Export convenience function
export function createSidewinder(config) {
  return new Sidewinder(config);
}

// Re-export for convenience
export default Sidewinder;