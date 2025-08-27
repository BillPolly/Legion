/**
 * RuntimeConfig - Enhanced configuration for runtime testing capabilities
 * 
 * Manages configuration for log-manager, node-runner, and playwright integrations
 */

import { createValidator } from '@legion/schema';

/**
 * Configuration schema for runtime testing
 */
const runtimeConfigSchema = {
  type: 'object',
  properties: {
    logManager: {
      type: 'object',
      properties: {
        logLevel: {
          type: 'string',
          enum: ['error', 'warn', 'info', 'debug', 'trace'],
          default: 'info'
        },
        bufferSize: {
          type: 'number',
          minimum: 100,
          maximum: 10000,
          default: 1000
        },
        enableStreaming: {
          type: 'boolean',
          default: true
        },
        enableAnalysis: {
          type: 'boolean',
          default: true
        },
        outputFormat: {
          type: 'string',
          enum: ['json', 'text', 'structured'],
          default: 'structured'
        },
        captureStdout: {
          type: 'boolean',
          default: true
        },
        captureStderr: {
          type: 'boolean',
          default: true
        },
        correlationEnabled: {
          type: 'boolean',
          default: true
        }
      },
      default: {}
    },
    
    nodeRunner: {
      type: 'object',
      properties: {
        timeout: {
          type: 'number',
          minimum: 1000,
          maximum: 300000,
          default: 30000
        },
        maxProcesses: {
          type: 'number',
          minimum: 1,
          maximum: 20,
          default: 5
        },
        enableHealthCheck: {
          type: 'boolean',
          default: true
        },
        healthCheckInterval: {
          type: 'number',
          minimum: 1000,
          maximum: 30000,
          default: 5000
        },
        shutdownTimeout: {
          type: 'number',
          minimum: 1000,
          maximum: 60000,
          default: 10000
        },
        processIsolation: {
          type: 'boolean',
          default: true
        },
        captureOutput: {
          type: 'boolean',
          default: true
        },
        workingDirectory: {
          type: 'string'
        }
      },
      default: {}
    },
    
    playwright: {
      type: 'object',
      properties: {
        browserType: {
          type: 'string',
          enum: ['chromium', 'firefox', 'webkit'],
          default: 'chromium'
        },
        headless: {
          type: 'boolean',
          default: true
        },
        timeout: {
          type: 'number',
          minimum: 1000,
          maximum: 120000,
          default: 30000
        },
        viewport: {
          type: 'object',
          properties: {
            width: {
              type: 'number',
              minimum: 320,
              maximum: 1920,
              default: 1280
            },
            height: {
              type: 'number',
              minimum: 240,
              maximum: 1080,
              default: 720
            }
          },
          default: {}
        },
        enableScreenshots: {
          type: 'boolean',
          default: true
        },
        enableVideoRecording: {
          type: 'boolean',
          default: false
        },
        enableTracing: {
          type: 'boolean',
          default: false
        },
        slowMo: {
          type: 'number',
          minimum: 0,
          maximum: 5000,
          default: 0
        },
        devtools: {
          type: 'boolean',
          default: false
        }
      },
      default: {}
    },
    
    integration: {
      type: 'object',
      properties: {
        enableCrossComponentLogging: {
          type: 'boolean',
          default: true
        },
        enablePerformanceMonitoring: {
          type: 'boolean',
          default: true
        },
        enableResourceTracking: {
          type: 'boolean',
          default: true
        },
        maxConcurrentOperations: {
          type: 'number',
          minimum: 1,
          maximum: 10,
          default: 3
        },
        operationTimeout: {
          type: 'number',
          minimum: 5000,
          maximum: 600000,
          default: 60000
        },
        enableFailureRecovery: {
          type: 'boolean',
          default: true
        },
        retryAttempts: {
          type: 'number',
          minimum: 0,
          maximum: 5,
          default: 2
        },
        retryDelay: {
          type: 'number',
          minimum: 100,
          maximum: 10000,
          default: 1000
        }
      },
      default: {}
    },
    
    quality: {
      type: 'object',
      properties: {
        enableRealTimeValidation: {
          type: 'boolean',
          default: true
        },
        enableLogCorrelation: {
          type: 'boolean',
          default: true
        },
        enablePerformanceProfiling: {
          type: 'boolean',
          default: true
        },
        enableVisualRegression: {
          type: 'boolean',
          default: false
        },
        testCoverageThreshold: {
          type: 'number',
          minimum: 0,
          maximum: 100,
          default: 80
        },
        performanceThreshold: {
          type: 'number',
          minimum: 100,
          maximum: 10000,
          default: 2000
        },
        memoryThreshold: {
          type: 'number',
          minimum: 50,
          maximum: 2000,
          default: 500,
          description: 'Memory threshold in MB'
        }
      },
      default: {}
    },
    
    debugging: {
      type: 'object',
      properties: {
        enableVerboseLogging: {
          type: 'boolean',
          default: false
        },
        enableStackTraces: {
          type: 'boolean',
          default: true
        },
        enableSourceMaps: {
          type: 'boolean',
          default: true
        },
        enableBreakpoints: {
          type: 'boolean',
          default: false
        },
        logCorrelationWindow: {
          type: 'number',
          minimum: 1000,
          maximum: 30000,
          default: 5000
        },
        enableRootCauseAnalysis: {
          type: 'boolean',
          default: true
        }
      },
      default: {}
    }
  }
};

const RuntimeConfigSchema = createValidator(runtimeConfigSchema);

/**
 * Default configuration for development environment
 */
const DEFAULT_DEV_CONFIG = {
  logManager: {
    logLevel: 'debug',
    bufferSize: 2000,
    enableStreaming: true,
    enableAnalysis: true,
    outputFormat: 'structured',
    captureStdout: true,
    captureStderr: true,
    correlationEnabled: true
  },
  nodeRunner: {
    timeout: 60000,
    maxProcesses: 3,
    enableHealthCheck: true,
    healthCheckInterval: 3000,
    shutdownTimeout: 15000,
    processIsolation: true,
    captureOutput: true
  },
  playwright: {
    browserType: 'chromium',
    headless: true,
    timeout: 45000,
    viewport: { width: 1280, height: 720 },
    enableScreenshots: true,
    enableVideoRecording: false,
    enableTracing: false,
    slowMo: 0,
    devtools: false
  },
  integration: {
    enableCrossComponentLogging: true,
    enablePerformanceMonitoring: true,
    enableResourceTracking: true,
    maxConcurrentOperations: 2,
    operationTimeout: 90000,
    enableFailureRecovery: true,
    retryAttempts: 3,
    retryDelay: 2000
  },
  quality: {
    enableRealTimeValidation: true,
    enableLogCorrelation: true,
    enablePerformanceProfiling: true,
    enableVisualRegression: false,
    testCoverageThreshold: 80,
    performanceThreshold: 3000,
    memoryThreshold: 300
  },
  debugging: {
    enableVerboseLogging: true,
    enableStackTraces: true,
    enableSourceMaps: true,
    enableBreakpoints: false,
    logCorrelationWindow: 10000,
    enableRootCauseAnalysis: true
  }
};

/**
 * Default configuration for production environment
 */
const DEFAULT_PROD_CONFIG = {
  logManager: {
    logLevel: 'info',
    bufferSize: 1000,
    enableStreaming: true,
    enableAnalysis: true,
    outputFormat: 'json',
    captureStdout: true,
    captureStderr: true,
    correlationEnabled: true
  },
  nodeRunner: {
    timeout: 30000,
    maxProcesses: 5,
    enableHealthCheck: true,
    healthCheckInterval: 5000,
    shutdownTimeout: 10000,
    processIsolation: true,
    captureOutput: true
  },
  playwright: {
    browserType: 'chromium',
    headless: true,
    timeout: 30000,
    viewport: { width: 1280, height: 720 },
    enableScreenshots: false,
    enableVideoRecording: false,
    enableTracing: false,
    slowMo: 0,
    devtools: false
  },
  integration: {
    enableCrossComponentLogging: true,
    enablePerformanceMonitoring: true,
    enableResourceTracking: true,
    maxConcurrentOperations: 3,
    operationTimeout: 60000,
    enableFailureRecovery: true,
    retryAttempts: 2,
    retryDelay: 1000
  },
  quality: {
    enableRealTimeValidation: true,
    enableLogCorrelation: true,
    enablePerformanceProfiling: false,
    enableVisualRegression: false,
    testCoverageThreshold: 90,
    performanceThreshold: 2000,
    memoryThreshold: 500
  },
  debugging: {
    enableVerboseLogging: false,
    enableStackTraces: true,
    enableSourceMaps: false,
    enableBreakpoints: false,
    logCorrelationWindow: 5000,
    enableRootCauseAnalysis: true
  }
};

/**
 * RuntimeConfig class for managing enhanced runtime configuration
 */
class RuntimeConfig {
  constructor(userConfig = {}, environment = 'development') {
    this.environment = environment;
    this.baseConfig = environment === 'production' ? DEFAULT_PROD_CONFIG : DEFAULT_DEV_CONFIG;
    this.config = this.mergeConfig(this.baseConfig, userConfig);
    this.validateConfig();
  }

  /**
   * Merge user configuration with base configuration
   */
  mergeConfig(baseConfig, userConfig) {
    const merged = { ...baseConfig };
    
    // Deep merge each section
    Object.keys(userConfig).forEach(key => {
      if (typeof userConfig[key] === 'object' && !Array.isArray(userConfig[key])) {
        merged[key] = { ...merged[key], ...userConfig[key] };
      } else {
        merged[key] = userConfig[key];
      }
    });
    
    return merged;
  }

  /**
   * Validate configuration against schema
   */
  validateConfig() {
    try {
      this.config = RuntimeConfigSchema.validate(this.config);
    } catch (error) {
      throw new Error(`Invalid runtime configuration: ${error.message}`);
    }
  }

  /**
   * Get configuration for log-manager
   */
  getLogManagerConfig() {
    return {
      ...this.config.logManager,
      environment: this.environment
    };
  }

  /**
   * Get configuration for node-runner
   */
  getNodeRunnerConfig() {
    return {
      ...this.config.nodeRunner,
      environment: this.environment
    };
  }

  /**
   * Get configuration for playwright
   */
  getPlaywrightConfig() {
    // Return all playwright config properties, including any custom ones
    const playwrightConfig = { ...this.config.playwright };
    
    // Ensure any additional properties are preserved
    if (this.config.playwright) {
      Object.keys(this.config.playwright).forEach(key => {
        if (!(key in playwrightConfig)) {
          playwrightConfig[key] = this.config.playwright[key];
        }
      });
    }
    
    return {
      ...playwrightConfig,
      environment: this.environment
    };
  }

  /**
   * Get integration configuration
   */
  getIntegrationConfig() {
    return {
      ...this.config.integration,
      environment: this.environment
    };
  }

  /**
   * Get quality configuration
   */
  getQualityConfig() {
    return {
      ...this.config.quality,
      environment: this.environment
    };
  }

  /**
   * Get debugging configuration
   */
  getDebuggingConfig() {
    return {
      ...this.config.debugging,
      environment: this.environment
    };
  }

  /**
   * Get complete configuration
   */
  getConfig() {
    return {
      ...this.config,
      environment: this.environment
    };
  }

  /**
   * Update configuration at runtime
   */
  updateConfig(updates) {
    this.config = this.mergeConfig(this.config, updates);
    this.validateConfig();
  }

  /**
   * Reset to default configuration
   */
  resetToDefaults() {
    this.config = { ...this.baseConfig };
    this.validateConfig();
  }

  /**
   * Create configuration for testing
   */
  static createTestConfig(overrides = {}) {
    const testConfig = {
      logManager: {
        logLevel: 'debug',
        bufferSize: 100,
        enableStreaming: false,
        enableAnalysis: false,
        outputFormat: 'json'
      },
      nodeRunner: {
        timeout: 10000,
        maxProcesses: 2,
        enableHealthCheck: false,
        processIsolation: false
      },
      playwright: {
        browserType: 'chromium',
        headless: true,
        timeout: 10000,
        enableScreenshots: false,
        enableVideoRecording: false
      },
      integration: {
        enableCrossComponentLogging: false,
        enablePerformanceMonitoring: false,
        maxConcurrentOperations: 1,
        operationTimeout: 15000,
        enableFailureRecovery: false,
        retryAttempts: 1
      },
      quality: {
        enableRealTimeValidation: false,
        enableLogCorrelation: false,
        enablePerformanceProfiling: false,
        testCoverageThreshold: 50
      },
      debugging: {
        enableVerboseLogging: false,
        enableStackTraces: true,
        enableRootCauseAnalysis: false
      }
    };

    return new RuntimeConfig({ ...testConfig, ...overrides }, 'test');
  }

  /**
   * Export configuration to JSON
   */
  toJSON() {
    return {
      environment: this.environment,
      config: this.config
    };
  }

  /**
   * Load configuration from JSON
   */
  static fromJSON(json) {
    const { environment, config } = json;
    return new RuntimeConfig(config, environment);
  }
}

export { RuntimeConfig, RuntimeConfigSchema, DEFAULT_DEV_CONFIG, DEFAULT_PROD_CONFIG };