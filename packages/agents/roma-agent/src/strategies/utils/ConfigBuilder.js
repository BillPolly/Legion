/**
 * ConfigBuilder - Standardized configuration builder for strategies
 * 
 * This utility provides:
 * - Standard configuration structure
 * - Default options merging
 * - Statistics tracking setup
 * - Tool registry initialization
 * - State management structures
 */

/**
 * Build a standard strategy configuration object
 * 
 * @param {Object} params - Configuration parameters
 * @returns {Object} Complete configuration object
 */
export function buildConfig(params = {}) {
  const {
    llmClient = null,
    toolRegistry = null,
    promptRegistry = null,
    options = {},
    defaults = {},
    stats = null,
    tools = null
  } = params;
  
  // Build configuration object
  const config = {
    // Core services
    llmClient,
    toolRegistry,
    promptRegistry,
    
    // Merged options with defaults
    options: mergeOptions(defaults, options),
    
    // State tracking
    initialized: false,
    initError: null,
    initPromise: null,
    
    // Tools cache if needed
    tools: tools || {}
  };
  
  // Add statistics if needed
  if (stats) {
    config.stats = createStatsStructure(stats);
  }
  
  return config;
}

/**
 * Merge options with defaults
 * 
 * @param {Object} defaults - Default options
 * @param {Object} options - User-provided options
 * @returns {Object} Merged options
 */
export function mergeOptions(defaults, options) {
  const merged = { ...defaults };
  
  // Deep merge nested objects
  for (const [key, value] of Object.entries(options)) {
    if (value !== undefined) {
      if (typeof value === 'object' && !Array.isArray(value) && value !== null) {
        // Deep merge objects
        if (typeof merged[key] === 'object' && !Array.isArray(merged[key])) {
          merged[key] = { ...merged[key], ...value };
        } else {
          merged[key] = value;
        }
      } else {
        // Direct assignment for primitives and arrays
        merged[key] = value;
      }
    }
  }
  
  return merged;
}

/**
 * Create a standard statistics tracking structure
 * 
 * @param {Object|Array} spec - Stats specification
 * @returns {Object} Statistics structure
 */
export function createStatsStructure(spec) {
  // If spec is an array of stat names, create basic counters
  if (Array.isArray(spec)) {
    const stats = {
      overall: { total: 0, successful: 0, failed: 0, successRate: 0 }
    };
    
    for (const name of spec) {
      stats[name] = { total: 0, successful: 0, failed: 0, successRate: 0 };
    }
    
    return stats;
  }
  
  // If spec is an object with types, create typed stats
  if (spec.types) {
    const stats = {
      byType: {},
      overall: { total: 0, successful: 0, failed: 0, successRate: 0 }
    };
    
    for (const type of spec.types) {
      stats.byType[type] = { total: 0, successful: 0, failed: 0, successRate: 0 };
    }
    
    return stats;
  }
  
  // Return spec as-is if it's already a structure
  return spec;
}

/**
 * Create execution tracking structures
 * 
 * @returns {Object} Execution tracking structures
 */
export function createExecutionTracking() {
  return {
    completed: new Set(),
    executing: new Set(),
    failed: new Set(),
    artifacts: new Map(),
    checkpoints: new Map(),
    checkpointCounter: 0
  };
}

/**
 * Create retry configuration
 * 
 * @param {Object} overrides - Override values
 * @returns {Object} Retry configuration
 */
export function createRetryConfig(overrides = {}) {
  return mergeOptions({
    maxRetries: 3,
    backoffStrategy: 'exponential',
    initialDelay: 1000,
    maxDelay: 30000,
    retryOn: ['TRANSIENT', 'RESOURCE']
  }, overrides);
}

/**
 * Create validation configuration
 * 
 * @param {Object} overrides - Override values
 * @returns {Object} Validation configuration
 */
export function createValidationConfig(overrides = {}) {
  return mergeOptions({
    validateInputs: true,
    validateOutputs: true,
    validateArtifacts: true,
    strictMode: false,
    allowPartialResults: false
  }, overrides);
}

/**
 * Strategy configuration presets
 */
export const ConfigPresets = {
  /**
   * Analysis strategy preset
   */
  analysis: {
    defaults: {
      outputFormat: 'json',
      validateResults: true,
      maxAnalysisDepth: 3,
      includeMetadata: true
    },
    stats: ['requirements', 'components', 'dependencies']
  },
  
  /**
   * Planning strategy preset
   */
  planning: {
    defaults: {
      outputFormat: 'json',
      validateResults: true,
      generateStructure: true,
      includeQualityGates: true
    },
    stats: ['phases', 'tasks', 'artifacts']
  },
  
  /**
   * Execution strategy preset
   */
  execution: {
    defaults: {
      maxRetries: 3,
      backoffStrategy: 'exponential',
      validateResults: true,
      parallelExecution: true
    },
    stats: {
      types: ['file', 'directory', 'command', 'tool', 'validation']
    },
    // Additional execution tracking
    completed: new Set(),
    executing: new Set(),
    artifacts: new Map()
  },
  
  /**
   * Recovery strategy preset
   */
  recovery: {
    defaults: {
      maxRetries: {
        TRANSIENT: 3,
        RESOURCE: 2,
        LOGIC: 1,
        FATAL: 0
      },
      backoffStrategy: 'exponential',
      resourceCleanupEnabled: true,
      replanningEnabled: true
    },
    stats: {
      types: ['TRANSIENT', 'RESOURCE', 'LOGIC', 'FATAL']
    }
  },
  
  /**
   * Monitoring strategy preset
   */
  monitoring: {
    defaults: {
      checkInterval: 5000,
      maxCheckAttempts: 10,
      collectMetrics: true,
      alertOnFailure: true
    },
    stats: ['health_checks', 'alerts', 'metrics']
  },
  
  /**
   * Quality strategy preset
   */
  quality: {
    defaults: {
      runTests: true,
      runLinting: true,
      checkCoverage: true,
      minCoverage: 80,
      strictMode: false
    },
    stats: ['tests', 'linting', 'coverage']
  }
};

/**
 * Create configuration from preset
 * 
 * @param {string} presetName - Name of the preset
 * @param {Object} overrides - Override configuration
 * @returns {Object} Complete configuration
 */
export function createFromPreset(presetName, overrides = {}) {
  const preset = ConfigPresets[presetName];
  
  if (!preset) {
    throw new Error(`Unknown configuration preset: ${presetName}`);
  }
  
  return buildConfig({
    ...overrides,
    defaults: preset.defaults,
    stats: preset.stats,
    options: overrides.options
  });
}

/**
 * Initialize tools in configuration
 * 
 * @param {Object} config - Configuration object
 * @param {Object} toolRegistry - Tool registry instance
 * @param {Array<string>} toolNames - Tool names to initialize
 * @returns {Promise<void>}
 */
export async function initializeTools(config, toolRegistry, toolNames) {
  if (!toolRegistry) {
    throw new Error('Tool registry required for tool initialization');
  }
  
  config.tools = config.tools || {};
  
  for (const toolName of toolNames) {
    try {
      const tool = await toolRegistry.getTool(toolName);
      if (tool) {
        config.tools[toolName] = tool;
        console.log(`✅ Initialized tool: ${toolName}`);
      } else {
        console.warn(`⚠️ Tool not found: ${toolName}`);
      }
    } catch (error) {
      console.error(`❌ Failed to initialize tool ${toolName}: ${error.message}`);
    }
  }
}

/**
 * Update statistics
 * 
 * @param {Object} stats - Statistics object
 * @param {string} category - Category name
 * @param {boolean} success - Whether the operation was successful
 */
export function updateStats(stats, category, success) {
  // Update category stats
  const catStats = stats.byType ? stats.byType[category] : stats[category];
  if (catStats) {
    catStats.total++;
    if (success) {
      catStats.successful++;
    } else {
      catStats.failed++;
    }
    catStats.successRate = catStats.total > 0 
      ? (catStats.successful / catStats.total * 100).toFixed(1)
      : 0;
  }
  
  // Update overall stats
  if (stats.overall) {
    stats.overall.total++;
    if (success) {
      stats.overall.successful++;
    } else {
      stats.overall.failed++;
    }
    stats.overall.successRate = stats.overall.total > 0
      ? (stats.overall.successful / stats.overall.total * 100).toFixed(1)
      : 0;
  }
}

export default {
  buildConfig,
  mergeOptions,
  createStatsStructure,
  createExecutionTracking,
  createRetryConfig,
  createValidationConfig,
  ConfigPresets,
  createFromPreset,
  initializeTools,
  updateStats
};