/**
 * JestConfigManager - Dynamic Jest configuration management
 * 
 * This class provides programmatic control over Jest configuration,
 * allowing dynamic test setup based on project types and requirements.
 */

class JestConfigManager {
  constructor(options = {}) {
    // Base Jest configuration that applies to all project types
    this.baseConfig = options.baseConfig || {
      testEnvironment: 'node',
      verbose: false,
      collectCoverage: false,
      collectCoverageFrom: [
        'src/**/*.js',
        '!src/**/*.test.js',
        '!src/**/*.spec.js'
      ],
      coverageDirectory: 'coverage',
      coverageReporters: ['text', 'lcov', 'html'],
      coverageThreshold: {
        global: {
          branches: 70,
          functions: 70,
          lines: 70,
          statements: 70
        }
      },
      testMatch: [
        '**/__tests__/**/*.test.js',
        '**/?(*.)+(spec|test).js'
      ],
      testPathIgnorePatterns: [
        '/node_modules/',
        '/build/',
        '/dist/'
      ],
      coveragePathIgnorePatterns: [
        '/node_modules/',
        '/build/',
        '/dist/'
      ],
      testTimeout: 5000,
      setupFiles: [],
      setupFilesAfterEnv: [],
      moduleFileExtensions: ['js', 'json'],
      transform: {},
      moduleNameMapper: {},
      clearMocks: true,
      restoreMocks: true,
      detectOpenHandles: false,
      forceExit: false
    };

    // Project-type specific configurations
    this.projectTypeConfigs = {
      frontend: {
        testEnvironment: 'jsdom',
        setupFilesAfterEnv: ['@testing-library/jest-dom'],
        moduleNameMapper: {
          '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
          '\\.(jpg|jpeg|png|gif|eot|otf|webp|svg|ttf|woff|woff2|mp4|webm|wav|mp3|m4a|aac|oga)$': 'jest-transform-stub'
        },
        transform: {
          '^.+\\.(js|jsx)$': 'babel-jest'
        },
        collectCoverageFrom: [
          'src/**/*.{js,jsx}',
          '!src/**/*.test.{js,jsx}',
          '!src/**/*.spec.{js,jsx}',
          '!src/index.js'
        ]
      },

      backend: {
        testEnvironment: 'node',
        collectCoverageFrom: [
          'src/**/*.js',
          '!src/**/*.test.js',
          '!src/**/*.spec.js'
        ],
        testMatch: [
          '**/__tests__/**/*.test.js',
          '**/?(*.)+(spec|test).js'
        ]
      },

      fullstack: {
        projects: [
          {
            displayName: 'Frontend',
            testEnvironment: 'jsdom',
            testMatch: ['**/frontend/**/*.test.js', '**/client/**/*.test.js'],
            setupFilesAfterEnv: ['@testing-library/jest-dom']
          },
          {
            displayName: 'Backend',
            testEnvironment: 'node',
            testMatch: ['**/backend/**/*.test.js', '**/server/**/*.test.js']
          }
        ],
        collectCoverageFrom: [
          'src/**/*.js',
          '!src/**/*.test.js'
        ]
      }
    };

    this.currentConfig = null;
    this.initialized = false;
    this.customConfig = {};
  }

  /**
   * Initialize the Jest configuration manager
   */
  async initialize(options = {}) {
    if (this.initialized) {
      return; // Already initialized
    }

    const projectType = options.projectType || 'backend';
    this.currentConfig = this.buildConfiguration(projectType);
    this.initialized = true;
  }

  /**
   * Build complete Jest configuration for a project type
   * @param {string} projectType - Type of project (frontend, backend, fullstack)
   * @returns {Object} Complete Jest configuration
   */
  buildConfiguration(projectType = 'backend') {
    const projectConfig = this.projectTypeConfigs[projectType] || {};
    
    const config = {
      ...this.baseConfig,
      ...projectConfig,
      ...this.customConfig,
      projectType: projectType
    };

    // Merge arrays properly
    if (projectConfig.setupFiles) {
      config.setupFiles = [...(this.baseConfig.setupFiles || []), ...projectConfig.setupFiles];
    }

    if (projectConfig.setupFilesAfterEnv) {
      config.setupFilesAfterEnv = [...(this.baseConfig.setupFilesAfterEnv || []), ...projectConfig.setupFilesAfterEnv];
    }

    if (projectConfig.moduleNameMapper) {
      config.moduleNameMapper = { ...this.baseConfig.moduleNameMapper, ...projectConfig.moduleNameMapper };
    }

    if (projectConfig.transform) {
      config.transform = { ...this.baseConfig.transform, ...projectConfig.transform };
    }

    return config;
  }

  /**
   * Get current configuration
   * @returns {Object} Current Jest configuration
   */
  getCurrentConfiguration() {
    if (!this.currentConfig) {
      this.currentConfig = this.buildConfiguration();
    }
    return { ...this.currentConfig };
  }

  /**
   * Set test environment
   * @param {string} environment - Test environment ('node', 'jsdom', or custom path)
   */
  setTestEnvironment(environment) {
    this.customConfig.testEnvironment = environment;
    this._updateCurrentConfig();
  }

  /**
   * Add setup files
   * @param {Array} setupFiles - Array of setup file paths
   */
  addSetupFiles(setupFiles) {
    if (!this.customConfig.setupFiles) {
      this.customConfig.setupFiles = [...(this.currentConfig?.setupFiles || [])];
    }
    this.customConfig.setupFiles.push(...setupFiles);
    this._updateCurrentConfig();
  }

  /**
   * Add setup files after environment
   * @param {Array} setupFilesAfterEnv - Array of setup file paths
   */
  addSetupFilesAfterEnv(setupFilesAfterEnv) {
    if (!this.customConfig.setupFilesAfterEnv) {
      this.customConfig.setupFilesAfterEnv = [...(this.currentConfig?.setupFilesAfterEnv || [])];
    }
    this.customConfig.setupFilesAfterEnv.push(...setupFilesAfterEnv);
    this._updateCurrentConfig();
  }

  /**
   * Add module name mapping
   * @param {Object} moduleNameMapper - Module name mapping object
   */
  addModuleNameMapper(moduleNameMapper) {
    this.customConfig.moduleNameMapper = {
      ...(this.customConfig.moduleNameMapper || {}),
      ...moduleNameMapper
    };
    this._updateCurrentConfig();
  }

  /**
   * Add transforms
   * @param {Object} transforms - Transform configuration object
   */
  addTransforms(transforms) {
    this.customConfig.transform = {
      ...(this.customConfig.transform || {}),
      ...transforms
    };
    this._updateCurrentConfig();
  }

  /**
   * Enable ES modules support
   */
  enableESModules() {
    this.customConfig.preset = undefined;
    this.customConfig.transform = {
      ...(this.customConfig.transform || {}),
      '^.+\\.js$': ['babel-jest', { presets: [['@babel/preset-env', { targets: { node: 'current' } }]] }]
    };
    this.customConfig.extensionsToTreatAsEsm = ['.js'];
    this._updateCurrentConfig();
  }

  /**
   * Set module file extensions
   * @param {Array} extensions - Array of file extensions
   */
  setModuleFileExtensions(extensions) {
    this.customConfig.moduleFileExtensions = extensions;
    this._updateCurrentConfig();
  }

  /**
   * Set coverage threshold
   * @param {Object} threshold - Coverage threshold configuration
   */
  setCoverageThreshold(threshold) {
    this.customConfig.coverageThreshold = threshold;
    this._updateCurrentConfig();
  }

  /**
   * Set coverage collection patterns
   * @param {Array} patterns - Array of glob patterns
   */
  setCoverageCollectionFrom(patterns) {
    this.customConfig.collectCoverageFrom = patterns;
    this._updateCurrentConfig();
  }

  /**
   * Set coverage reporters
   * @param {Array} reporters - Array of reporter names
   */
  setCoverageReporters(reporters) {
    this.customConfig.coverageReporters = reporters;
    this._updateCurrentConfig();
  }

  /**
   * Add custom Jest reporters
   * @param {Array} reporters - Array of reporter configurations
   */
  addReporters(reporters) {
    if (!this.customConfig.reporters) {
      this.customConfig.reporters = [];
    }
    
    reporters.forEach(reporter => {
      if (typeof reporter === 'string') {
        this.customConfig.reporters.push(reporter);
      } else if (Array.isArray(reporter)) {
        // Reporter with options [path, options]
        this.customConfig.reporters.push(reporter);
      } else {
        throw new Error('Reporter must be a string or array [path, options]');
      }
    });
    
    this._updateCurrentConfig();
  }

  /**
   * Set Jest reporters (replaces all)
   * @param {Array} reporters - Array of reporter configurations
   */
  setReporters(reporters) {
    this.customConfig.reporters = reporters;
    this._updateCurrentConfig();
  }

  /**
   * Add Jester reporter integration
   * @param {Object} jesterConfig - Jester configuration options
   */
  addJesterReporter(jesterConfig = {}) {
    const jesterReporterPath = '@legion/jester/reporter';
    const reporter = [jesterReporterPath, {
      dbPath: jesterConfig.dbPath || './test-results.db',
      collectConsole: jesterConfig.collectConsole !== false,
      collectCoverage: jesterConfig.collectCoverage !== false,
      realTimeEvents: jesterConfig.realTimeEvents !== false,
      ...jesterConfig
    }];
    
    this.addReporters([reporter]);
  }

  /**
   * Set coverage directory
   * @param {string} directory - Coverage output directory
   */
  setCoverageDirectory(directory) {
    this.customConfig.coverageDirectory = directory;
    this._updateCurrentConfig();
  }

  /**
   * Add coverage path ignore patterns
   * @param {Array} patterns - Array of ignore patterns
   */
  addCoveragePathIgnorePatterns(patterns) {
    if (!this.customConfig.coveragePathIgnorePatterns) {
      this.customConfig.coveragePathIgnorePatterns = [...(this.currentConfig?.coveragePathIgnorePatterns || [])];
    }
    this.customConfig.coveragePathIgnorePatterns.push(...patterns);
    this._updateCurrentConfig();
  }

  /**
   * Set test timeout
   * @param {number} timeout - Timeout in milliseconds
   */
  setTestTimeout(timeout) {
    this.customConfig.testTimeout = timeout;
    this._updateCurrentConfig();
  }

  /**
   * Set test match patterns
   * @param {Array} patterns - Array of test match patterns
   */
  setTestMatch(patterns) {
    this.customConfig.testMatch = patterns;
    this._updateCurrentConfig();
  }

  /**
   * Add test path ignore patterns
   * @param {Array} patterns - Array of ignore patterns
   */
  addTestPathIgnorePatterns(patterns) {
    if (!this.customConfig.testPathIgnorePatterns) {
      this.customConfig.testPathIgnorePatterns = [...(this.currentConfig?.testPathIgnorePatterns || [])];
    }
    this.customConfig.testPathIgnorePatterns.push(...patterns);
    this._updateCurrentConfig();
  }

  /**
   * Set watch mode options
   * @param {Object} watchOptions - Watch configuration options
   */
  setWatchOptions(watchOptions) {
    Object.assign(this.customConfig, watchOptions);
    this._updateCurrentConfig();
  }

  /**
   * Set verbose output
   * @param {boolean} verbose - Enable verbose output
   */
  setVerbose(verbose) {
    this.customConfig.verbose = verbose;
    this._updateCurrentConfig();
  }

  /**
   * Set clear mocks between tests
   * @param {boolean} clearMocks - Clear mocks setting
   */
  setClearMocks(clearMocks) {
    this.customConfig.clearMocks = clearMocks;
    this._updateCurrentConfig();
  }

  /**
   * Set restore mocks after tests
   * @param {boolean} restoreMocks - Restore mocks setting
   */
  setRestoreMocks(restoreMocks) {
    this.customConfig.restoreMocks = restoreMocks;
    this._updateCurrentConfig();
  }

  /**
   * Set automatic mocking
   * @param {boolean} automock - Automock setting
   */
  setAutomock(automock) {
    this.customConfig.automock = automock;
    this._updateCurrentConfig();
  }

  /**
   * Add mock directories to roots
   * @param {Array} mockPaths - Array of mock directory paths
   */
  addMockDirectories(mockPaths) {
    if (!this.customConfig.roots) {
      this.customConfig.roots = ['<rootDir>'];
    }
    this.customConfig.roots.push(...mockPaths);
    this._updateCurrentConfig();
  }

  /**
   * Configure multi-project setup
   * @param {Array} projects - Array of project configurations
   */
  configureMultiProject(projects) {
    this.customConfig.projects = projects;
    this._updateCurrentConfig();
  }

  /**
   * Add project to multi-project setup
   * @param {Object} projectConfig - Project configuration
   */
  addProject(projectConfig) {
    if (!this.customConfig.projects) {
      this.customConfig.projects = [];
    }
    this.customConfig.projects.push(projectConfig);
    this._updateCurrentConfig();
  }

  /**
   * Set maximum number of workers
   * @param {string|number} maxWorkers - Max workers configuration
   */
  setMaxWorkers(maxWorkers) {
    this.customConfig.maxWorkers = maxWorkers;
    this._updateCurrentConfig();
  }

  /**
   * Set cache directory
   * @param {string} cacheDirectory - Cache directory path
   */
  setCacheDirectory(cacheDirectory) {
    this.customConfig.cacheDirectory = cacheDirectory;
    this._updateCurrentConfig();
  }

  /**
   * Set bail configuration
   * @param {number|boolean} bail - Bail setting
   */
  setBail(bail) {
    this.customConfig.bail = bail;
    this._updateCurrentConfig();
  }

  /**
   * Set detect open handles
   * @param {boolean} detectOpenHandles - Detect open handles setting
   */
  setDetectOpenHandles(detectOpenHandles) {
    this.customConfig.detectOpenHandles = detectOpenHandles;
    this._updateCurrentConfig();
  }

  /**
   * Set force exit after tests
   * @param {boolean} forceExit - Force exit setting
   */
  setForceExit(forceExit) {
    this.customConfig.forceExit = forceExit;
    this._updateCurrentConfig();
  }

  /**
   * Validate Jest configuration structure
   * @param {Object} config - Configuration to validate
   * @returns {boolean} Is configuration valid
   */
  validateConfiguration(config) {
    try {
      if (!config || typeof config !== 'object') {
        return false;
      }

      // Check test environment
      if (config.testEnvironment && typeof config.testEnvironment !== 'string') {
        return false;
      }

      // Check testMatch
      if (config.testMatch && (!Array.isArray(config.testMatch) || !config.testMatch.every(p => typeof p === 'string'))) {
        return false;
      }

      // Check coverage threshold
      if (config.coverageThreshold && typeof config.coverageThreshold !== 'object') {
        return false;
      }

      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get validation errors for a configuration
   * @param {Object} config - Configuration to validate
   * @returns {Array} Array of validation errors
   */
  getValidationErrors(config) {
    const errors = [];

    if (!config || typeof config !== 'object') {
      errors.push({ field: 'config', message: 'Configuration must be an object' });
      return errors;
    }

    if (config.testEnvironment && typeof config.testEnvironment !== 'string') {
      errors.push({ field: 'testEnvironment', message: 'Test environment must be a string' });
    }

    if (config.testMatch && (!Array.isArray(config.testMatch) || !config.testMatch.every(p => typeof p === 'string'))) {
      errors.push({ field: 'testMatch', message: 'Test match must be an array of strings' });
    }

    if (config.coverageThreshold && typeof config.coverageThreshold !== 'object') {
      errors.push({ field: 'coverageThreshold', message: 'Coverage threshold must be an object' });
    }

    return errors;
  }

  /**
   * Analyze configuration performance impact
   * @returns {Object} Performance analysis
   */
  analyzePerformanceImpact() {
    const config = this.getCurrentConfiguration();
    let score = 100;
    const recommendations = [];

    // Check for performance impacting settings
    if (config.verbose) {
      score -= 10;
      recommendations.push('Consider disabling verbose mode for faster test execution');
    }
    
    if (config.reporters && config.reporters.length > 3) {
      score -= 5;
      recommendations.push('Multiple reporters can slow down test execution');
    }

    if (config.collectCoverage && !config.collectCoverageFrom) {
      score -= 20;
      recommendations.push('Specify collectCoverageFrom patterns to avoid collecting coverage from all files');
    }

    if (config.detectOpenHandles) {
      score -= 5;
      recommendations.push('detectOpenHandles can slow down test execution, use only when debugging');
    }

    if (!config.maxWorkers || config.maxWorkers === 1) {
      score -= 15;
      recommendations.push('Consider using multiple workers for parallel test execution');
    }

    return {
      score: Math.max(score, 0),
      recommendations: recommendations,
      impact: score < 70 ? 'high' : score < 85 ? 'medium' : 'low'
    };
  }

  /**
   * Export configuration as JSON string
   * @returns {string} JSON configuration
   */
  exportConfiguration() {
    return JSON.stringify(this.getCurrentConfiguration(), null, 2);
  }

  /**
   * Export configuration as Jest config file
   * @returns {string} Jest config file content
   */
  exportAsConfigFile() {
    const config = this.getCurrentConfiguration();
    return `module.exports = ${JSON.stringify(config, null, 2)};`;
  }

  /**
   * Import configuration from JSON string
   * @param {string} jsonConfig - JSON configuration string
   */
  importConfiguration(jsonConfig) {
    try {
      const config = JSON.parse(jsonConfig);
      if (this.validateConfiguration(config)) {
        this.currentConfig = config;
        this.customConfig = { ...config };
      } else {
        throw new Error('Invalid configuration format');
      }
    } catch (error) {
      throw new Error(`Failed to import configuration: ${error.message}`);
    }
  }

  /**
   * Update configuration at runtime
   * @param {Object} updates - Configuration updates
   */
  updateConfiguration(updates) {
    this.customConfig = { ...this.customConfig, ...updates };
    this._updateCurrentConfig();
  }

  /**
   * Reset to default configuration
   */
  resetToDefaults() {
    this.customConfig = {};
    const projectType = this.currentConfig?.projectType || 'backend';
    this.currentConfig = {
      ...this.baseConfig,
      ...(this.projectTypeConfigs[projectType] || {}),
      projectType: projectType
    };
  }

  // Private helper methods

  /**
   * Update current configuration with custom settings
   * @private
   */
  _updateCurrentConfig() {
    if (this.currentConfig) {
      const projectType = this.currentConfig.projectType || 'backend';
      this.currentConfig = this.buildConfiguration(projectType);
    }
  }
}

export { JestConfigManager };