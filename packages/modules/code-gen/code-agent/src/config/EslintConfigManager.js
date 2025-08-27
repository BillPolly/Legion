/**
 * EslintConfigManager - Dynamic ESLint configuration management
 * 
 * This class provides programmatic control over ESLint configuration,
 * allowing dynamic rule management based on project types and requirements.
 */

class EslintConfigManager {
  constructor(options = {}) {
    // Base ESLint rules that apply to all project types
    this.baseRules = options.baseRules || {
      // Error prevention
      'no-unused-vars': 'error',
      'no-undef': 'error',
      'no-unreachable': 'error',
      'no-dupe-keys': 'error',
      'no-duplicate-case': 'error',
      
      // Code style
      'no-console': 'warn',
      'semi': ['error', 'always'],
      'quotes': ['error', 'single'],
      'indent': ['error', 2],
      'no-trailing-spaces': 'error',
      'eol-last': 'error',
      
      // Best practices
      'eqeqeq': 'error',
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'error',
      'no-with': 'error',
      
      // ES6+
      'prefer-const': 'error',
      'no-var': 'error',
      'arrow-spacing': 'error',
      'template-curly-spacing': 'error'
    };

    // Project-type specific rules
    this.projectTypeRules = {
      frontend: {
        'no-undef': 'error',
        'no-global-assign': 'error',
        'no-implicit-globals': 'error',
        'no-restricted-globals': ['error', 'event', 'history']
      },
      
      backend: {
        'no-process-exit': 'warn',
        'handle-callback-err': 'error',
        'no-new-require': 'error',
        'no-path-concat': 'error'
      },
      
      fullstack: {
        // Combines frontend and backend rules
        'no-undef': 'error',
        'no-global-assign': 'error',
        'no-process-exit': 'warn',
        'handle-callback-err': 'error'
      }
    };

    // Rule categories for bulk operations
    this.ruleCategories = {
      stylistic: ['indent', 'quotes', 'semi', 'comma-dangle', 'brace-style'],
      security: ['no-eval', 'no-implied-eval', 'no-new-func', 'no-with'],
      es6: ['prefer-const', 'no-var', 'arrow-spacing', 'template-curly-spacing'],
      errors: ['no-unused-vars', 'no-undef', 'no-unreachable', 'no-dupe-keys']
    };

    this.currentConfig = null;
    this.initialized = false;
    this.configCache = new Map();
    this.customRules = {};
  }

  /**
   * Initialize the ESLint configuration manager
   */
  async initialize(options = {}) {
    if (this.initialized) {
      return; // Already initialized
    }

    const projectType = options.projectType || 'fullstack';
    this.currentConfig = this.buildConfiguration(projectType);
    this.initialized = true;
  }

  /**
   * Get base ESLint rules
   * @returns {Object} Base rules object
   */
  getBaseRules() {
    return { ...this.baseRules };
  }

  /**
   * Get project-type specific rules
   * @param {string} projectType - Type of project (frontend, backend, fullstack)
   * @returns {Object} Project-specific rules
   */
  getProjectTypeRules(projectType) {
    return { ...this.projectTypeRules[projectType] } || {};
  }

  /**
   * Build complete ESLint configuration for a project type
   * @param {string} projectType - Type of project
   * @returns {Object} Complete ESLint configuration
   */
  buildConfiguration(projectType = 'fullstack') {
    // Check cache first
    const cacheKey = `${projectType}-${JSON.stringify(this.customRules)}`;
    if (this.configCache.has(cacheKey)) {
      return this.configCache.get(cacheKey);
    }

    const config = {
      env: this._buildEnvironmentConfig(projectType),
      extends: ['eslint:recommended'],
      parserOptions: this._buildParserOptions(),
      rules: this._buildRules(projectType),
      projectType: projectType
    };

    // Cache the configuration
    this.configCache.set(cacheKey, config);
    
    return config;
  }

  /**
   * Get current configuration
   * @returns {Object} Current ESLint configuration
   */
  getCurrentConfiguration() {
    if (!this.currentConfig) {
      this.currentConfig = this.buildConfiguration();
    }
    return { ...this.currentConfig };
  }

  /**
   * Add custom rules to the configuration
   * @param {Object} rules - Custom rules to add
   */
  addCustomRules(rules) {
    this.customRules = { ...this.customRules, ...rules };
    this._invalidateCache();
    this._updateCurrentConfig();
  }

  /**
   * Remove rules from the configuration
   * @param {Array} ruleNames - Array of rule names to remove
   */
  removeRules(ruleNames) {
    for (const ruleName of ruleNames) {
      delete this.customRules[ruleName];
      if (this.currentConfig && this.currentConfig.rules) {
        delete this.currentConfig.rules[ruleName];
      }
    }
    this._invalidateCache();
  }

  /**
   * Set rule severity levels
   * @param {Object} rules - Rules with severity levels
   */
  setRuleSeverity(rules) {
    this.addCustomRules(rules);
  }

  /**
   * Convert severity string to number
   * @param {string} severity - Severity level ('off', 'warn', 'error')
   * @returns {number} Numeric severity (0, 1, 2)
   */
  convertSeverityToNumber(severity) {
    const severityMap = {
      'off': 0,
      'warn': 1,
      'error': 2
    };
    return severityMap[severity] || 0;
  }

  /**
   * Convert severity number to string
   * @param {number} severity - Numeric severity (0, 1, 2)
   * @returns {string} String severity
   */
  convertSeverityToString(severity) {
    const severityMap = {
      0: 'off',
      1: 'warn',
      2: 'error'
    };
    return severityMap[severity] || 'off';
  }

  /**
   * Get rules by severity level
   * @param {string} severity - Severity level to filter by
   * @returns {Array} Array of rule names
   */
  getRulesBySeverity(severity) {
    const config = this.getCurrentConfiguration();
    const rules = [];

    for (const [ruleName, ruleConfig] of Object.entries(config.rules)) {
      const ruleSeverity = Array.isArray(ruleConfig) ? ruleConfig[0] : ruleConfig;
      if (ruleSeverity === severity) {
        rules.push(ruleName);
      }
    }

    return rules;
  }

  /**
   * Validate ESLint configuration structure
   * @param {Object} config - Configuration to validate
   * @returns {boolean} Is configuration valid
   */
  validateConfiguration(config) {
    try {
      if (!config || typeof config !== 'object') {
        return false;
      }

      // Check required properties
      if (!config.rules || typeof config.rules !== 'object') {
        return false;
      }

      if (config.env && typeof config.env !== 'object') {
        return false;
      }

      if (config.parserOptions && typeof config.parserOptions !== 'object') {
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

    if (!config.rules || typeof config.rules !== 'object') {
      errors.push({ field: 'rules', message: 'Rules must be an object' });
    }

    if (config.env && typeof config.env !== 'object') {
      errors.push({ field: 'env', message: 'Environment must be an object' });
    }

    if (config.parserOptions && typeof config.parserOptions !== 'object') {
      errors.push({ field: 'parserOptions', message: 'Parser options must be an object' });
    }

    return errors;
  }

  /**
   * Analyze rule conflicts in the configuration
   * @returns {Array} Array of rule conflicts
   */
  analyzeRuleConflicts() {
    const conflicts = [];
    const config = this.getCurrentConfiguration();
    
    // Define known conflicting rules
    const conflictPairs = [
      ['indent', 'no-tabs'],
      ['quotes', 'jsx-quotes'],
      ['semi', 'no-extra-semi']
    ];

    for (const [rule1, rule2] of conflictPairs) {
      if (config.rules[rule1] && config.rules[rule2]) {
        conflicts.push({
          rule1: rule1,
          rule2: rule2,
          description: `${rule1} and ${rule2} may conflict`
        });
      }
    }

    return conflicts;
  }

  /**
   * Get documentation for a specific rule
   * @param {string} ruleName - Name of the rule
   * @returns {Object} Rule documentation
   */
  getRuleDocumentation(ruleName) {
    // Mock documentation - in real implementation, this would fetch from ESLint docs
    const mockDocs = {
      'no-unused-vars': {
        description: 'Disallow unused variables',
        category: 'Variables',
        recommended: true,
        fixable: false
      },
      'no-console': {
        description: 'Disallow the use of console',
        category: 'Possible Errors',
        recommended: false,
        fixable: false
      },
      'semi': {
        description: 'Require or disallow semicolons',
        category: 'Stylistic Issues',
        recommended: false,
        fixable: true
      }
    };

    return mockDocs[ruleName] || {
      description: 'No documentation available',
      category: 'Unknown',
      recommended: false,
      fixable: false
    };
  }

  /**
   * Update configuration at runtime
   * @param {Object} updates - Configuration updates
   */
  updateConfiguration(updates) {
    if (updates.rules) {
      this.addCustomRules(updates.rules);
    }

    if (updates.env) {
      this.currentConfig.env = { ...this.currentConfig.env, ...updates.env };
    }

    if (updates.parserOptions) {
      this.currentConfig.parserOptions = { ...this.currentConfig.parserOptions, ...updates.parserOptions };
    }

    this._invalidateCache();
  }

  /**
   * Set project type and rebuild configuration
   * @param {string} projectType - New project type
   */
  setProjectType(projectType) {
    this.currentConfig = this.buildConfiguration(projectType);
  }

  /**
   * Enable a category of rules
   * @param {string} category - Rule category to enable
   */
  enableRuleCategory(category) {
    const rules = this.ruleCategories[category];
    if (rules) {
      const enabledRules = {};
      for (const rule of rules) {
        enabledRules[rule] = 'error'; // Default to error level
      }
      this.addCustomRules(enabledRules);
    }
  }

  /**
   * Disable a category of rules
   * @param {string} category - Rule category to disable
   */
  disableRuleCategory(category) {
    const rules = this.ruleCategories[category];
    if (rules) {
      const disabledRules = {};
      for (const rule of rules) {
        disabledRules[rule] = 'off';
      }
      this.addCustomRules(disabledRules);
    }
  }

  /**
   * Export configuration as JSON string
   * @returns {string} JSON configuration
   */
  exportConfiguration() {
    return JSON.stringify(this.getCurrentConfiguration(), null, 2);
  }

  /**
   * Export configuration as ESLint config file
   * @returns {string} ESLint config file content
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
        if (config.rules) {
          this.customRules = { ...config.rules };
        }
        this._invalidateCache();
      } else {
        throw new Error('Invalid configuration format');
      }
    } catch (error) {
      throw new Error(`Failed to import configuration: ${error.message}`);
    }
  }

  // Private helper methods

  /**
   * Build environment configuration based on project type
   * @private
   */
  _buildEnvironmentConfig(projectType) {
    const baseEnv = {
      es6: true,
      ecmaVersion: 2022
    };

    switch (projectType) {
      case 'frontend':
        return {
          ...baseEnv,
          browser: true,
          dom: true
        };

      case 'backend':
        return {
          ...baseEnv,
          node: true,
          commonjs: true
        };

      case 'fullstack':
        return {
          ...baseEnv,
          browser: true,
          node: true,
          commonjs: true
        };

      default:
        return baseEnv;
    }
  }

  /**
   * Build parser options
   * @private
   */
  _buildParserOptions() {
    return {
      ecmaVersion: 2022,
      sourceType: 'module',
      ecmaFeatures: {
        jsx: false,
        globalReturn: false,
        impliedStrict: true
      }
    };
  }

  /**
   * Build complete rules configuration
   * @private
   */
  _buildRules(projectType) {
    const projectRules = this.getProjectTypeRules(projectType);
    
    return {
      ...this.baseRules,
      ...projectRules,
      ...this.customRules
    };
  }

  /**
   * Update current configuration with latest rules
   * @private
   */
  _updateCurrentConfig() {
    if (this.currentConfig) {
      this.currentConfig.rules = this._buildRules(this.currentConfig.projectType || 'fullstack');
    }
  }

  /**
   * Invalidate configuration cache
   * @private
   */
  _invalidateCache() {
    this.configCache.clear();
  }
}

export { EslintConfigManager };