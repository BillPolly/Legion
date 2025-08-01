/**
 * Aiur Actors UI - Main entry point
 */

// Version from package.json
export const version = '1.0.0';

// Component exports (to be implemented)
export const components = {};

// Actor utilities (to be implemented)
export const actors = {};

/**
 * Create and initialize the Aiur Actors UI application
 * @param {Object} config - Application configuration
 * @returns {Object} Application instance
 */
export function createApplication(config = {}) {
  return {
    config,
    start: () => {
      console.log('Application starting...');
    },
    stop: () => {
      console.log('Application stopping...');
    }
  };
}

// Default export
export default {
  version,
  components,
  actors,
  createApplication
};