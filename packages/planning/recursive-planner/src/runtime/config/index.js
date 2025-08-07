/**
 * Barrel export for configuration system
 */

export { ConfigManager } from './ConfigManager.js';
export { DEFAULT_CONFIG, REQUIRED_ENV_VARS, ENV_TYPE_CONVERSIONS } from './defaults.js';
export * from './validators/index.js';

// Export a pre-configured instance for convenience
import { ConfigManager } from './ConfigManager.js';

export const config = ConfigManager.getInstance().load();