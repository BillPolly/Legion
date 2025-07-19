/**
 * RuntimeConfig - Enhanced configuration for runtime testing capabilities
 * 
 * Manages configuration for log-manager, node-runner, and playwright integrations
 */

import { z } from 'zod';

/**
 * Configuration schema for runtime testing
 */
const RuntimeConfigSchema = z.object({
  logManager: z.object({
    logLevel: z.enum(['error', 'warn', 'info', 'debug', 'trace']).default('info'),
    bufferSize: z.number().min(100).max(10000).default(1000),
    enableStreaming: z.boolean().default(true),
    enableAnalysis: z.boolean().default(true),
    outputFormat: z.enum(['json', 'text', 'structured']).default('structured'),
    captureStdout: z.boolean().default(true),
    captureStderr: z.boolean().default(true),
    correlationEnabled: z.boolean().default(true)
  }).default({}),
  
  nodeRunner: z.object({
    timeout: z.number().min(1000).max(300000).default(30000),
    maxProcesses: z.number().min(1).max(20).default(5),
    enableHealthCheck: z.boolean().default(true),
    healthCheckInterval: z.number().min(1000).max(30000).default(5000),
    shutdownTimeout: z.number().min(1000).max(60000).default(10000),
    processIsolation: z.boolean().default(true),
    captureOutput: z.boolean().default(true),
    workingDirectory: z.string().optional()
  }).default({}),
  
  playwright: z.object({
    browserType: z.enum(['chromium', 'firefox', 'webkit']).default('chromium'),
    headless: z.boolean().default(true),
    timeout: z.number().min(1000).max(120000).default(30000),
    viewport: z.object({
      width: z.number().min(320).max(1920).default(1280),
      height: z.number().min(240).max(1080).default(720)
    }).default({}),
    enableScreenshots: z.boolean().default(true),
    enableVideoRecording: z.boolean().default(false),
    enableTracing: z.boolean().default(false),
    slowMo: z.number().min(0).max(5000).default(0),
    devtools: z.boolean().default(false)
  }).default({}),
  
  integration: z.object({
    enableCrossComponentLogging: z.boolean().default(true),
    enablePerformanceMonitoring: z.boolean().default(true),
    enableResourceTracking: z.boolean().default(true),
    maxConcurrentOperations: z.number().min(1).max(10).default(3),
    operationTimeout: z.number().min(5000).max(600000).default(60000),
    enableFailureRecovery: z.boolean().default(true),
    retryAttempts: z.number().min(0).max(5).default(2),
    retryDelay: z.number().min(100).max(10000).default(1000)
  }).default({}),
  
  quality: z.object({
    enableRealTimeValidation: z.boolean().default(true),
    enableLogCorrelation: z.boolean().default(true),
    enablePerformanceProfiling: z.boolean().default(true),
    enableVisualRegression: z.boolean().default(false),
    testCoverageThreshold: z.number().min(0).max(100).default(80),
    performanceThreshold: z.number().min(100).max(10000).default(2000),
    memoryThreshold: z.number().min(50).max(2000).default(500) // MB
  }).default({}),
  
  debugging: z.object({
    enableVerboseLogging: z.boolean().default(false),
    enableStackTraces: z.boolean().default(true),
    enableSourceMaps: z.boolean().default(true),
    enableBreakpoints: z.boolean().default(false),
    logCorrelationWindow: z.number().min(1000).max(30000).default(5000),
    enableRootCauseAnalysis: z.boolean().default(true)
  }).default({})
});

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
      this.config = RuntimeConfigSchema.parse(this.config);
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