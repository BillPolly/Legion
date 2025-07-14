/**
 * PlanAction model - Represents an individual action within a plan step
 */

class PlanAction {
  // Static valid action types
  static VALID_TYPES = [
    // File system actions
    'create-directory',
    'create-file',
    'update-file',
    'delete-file',
    'delete-directory',
    'copy-file',
    'move-file',
    // Command actions
    'run-command',
    'run-script',
    // Package actions
    'install-dependency',
    'uninstall-dependency',
    // Validation actions
    'validate-syntax',
    'run-tests',
    'check-output'
  ];
  
  constructor(data = {}) {
    // Validate type is provided
    if (!data.type) {
      throw new Error('Action type is required');
    }
    
    // Validate action type
    if (!PlanAction.VALID_TYPES.includes(data.type)) {
      throw new Error(`Invalid action type: ${data.type}`);
    }
    
    // Core properties
    this.id = data.id || this._generateId();
    this.type = data.type;
    this.status = data.status || 'pending';
    
    // Copy all data properties
    Object.keys(data).forEach(key => {
      if (!['id', 'type', 'status'].includes(key)) {
        this[key] = data[key];
      }
    });
    
    // Result tracking
    this.result = data.result || null;
  }

  /**
   * Generate a unique action ID
   * @private
   */
  _generateId() {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substr(2, 9);
    return `action-${timestamp}-${random}`;
  }

  /**
   * Validate action has required fields
   * @returns {Object} Validation result
   */
  validate() {
    const errors = [];
    
    // Type-specific validation
    switch (this.type) {
      case 'create-directory':
        if (!this.path) {
          errors.push(`${this.type} action requires path`);
        }
        break;
        
      case 'create-file':
      case 'update-file':
        if (!this.path) {
          errors.push(`${this.type} action requires path`);
        }
        if (!this.content && this.content !== '') {
          errors.push(`${this.type} action requires content`);
        }
        break;
        
      case 'delete-file':
        if (!this.path) {
          errors.push(`${this.type} action requires path`);
        }
        break;
        
      case 'copy-file':
      case 'move-file':
        if (!this.source) {
          errors.push(`${this.type} action requires source`);
        }
        if (!this.destination) {
          errors.push(`${this.type} action requires destination`);
        }
        break;
        
      case 'run-command':
        if (!this.command) {
          errors.push(`${this.type} action requires command`);
        }
        break;
        
      case 'run-script':
        if (!this.script) {
          errors.push(`${this.type} action requires script`);
        }
        break;
        
      case 'validate-syntax':
        if (!this.files || !Array.isArray(this.files)) {
          errors.push(`${this.type} action requires files array`);
        }
        break;
        
      case 'run-tests':
        if (!this.testCommand) {
          errors.push(`${this.type} action requires testCommand`);
        }
        break;
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Update action status
   * @param {string} newStatus - New status
   */
  updateStatus(newStatus) {
    const validStatuses = ['pending', 'in-progress', 'completed', 'failed', 'skipped'];
    if (!validStatuses.includes(newStatus)) {
      throw new Error(`Invalid status: ${newStatus}`);
    }
    this.status = newStatus;
  }

  /**
   * Record execution result
   * @param {Object} result - Execution result
   */
  recordResult(result) {
    this.result = {
      ...result,
      timestamp: new Date().toISOString()
    };
    
    // Update status based on result
    if (result.success) {
      this.status = 'completed';
    } else {
      this.status = 'failed';
    }
  }

  /**
   * Estimate duration for this action
   * @returns {number} Estimated duration in milliseconds
   */
  estimateDuration() {
    // Estimates based on action type
    const estimates = {
      'create-directory': 50,
      'create-file': 100,
      'update-file': 100,
      'delete-file': 50,
      'copy-file': 200,
      'move-file': 100,
      'run-command': 5000,
      'run-script': 10000,
      'validate-syntax': 2000,
      'run-tests': 30000,
      'check-output': 500
    };
    
    let estimate = estimates[this.type] || 1000;
    
    // Adjust based on specific properties
    if (this.type === 'create-file' && this.content) {
      // Larger files take longer
      const sizeInKB = this.content.length / 1024;
      if (sizeInKB > 100) {
        estimate += sizeInKB * 10;
      }
    }
    
    if (this.type === 'run-command' && this.command) {
      // Some specific commands take longer
      if (this.command.includes('npm install')) {
        estimate = 30000;
      } else if (this.command.includes('npm test')) {
        estimate = 20000;
      } else if (this.command.includes('npm run')) {
        estimate = 10000;
      }
      // Otherwise use the default estimate for run-command
    }
    
    return estimate;
  }

  /**
   * Check if action is retryable
   * @returns {boolean} Can retry
   */
  isRetryable() {
    // Most file operations are retryable
    const retryableTypes = [
      'create-directory',
      'create-file',
      'update-file',
      'copy-file',
      'move-file',
      'run-command'
    ];
    
    // Tests are generally not retryable (flaky tests should be fixed)
    const nonRetryableTypes = [
      'run-tests',
      'validate-syntax'
    ];
    
    if (nonRetryableTypes.includes(this.type)) {
      return false;
    }
    
    return retryableTypes.includes(this.type);
  }

  /**
   * Get action category
   * @returns {string} Category
   */
  getCategory() {
    const categories = {
      'create-directory': 'file-system',
      'create-file': 'file-system',
      'update-file': 'file-system',
      'delete-file': 'file-system',
      'copy-file': 'file-system',
      'move-file': 'file-system',
      'run-command': 'command',
      'run-script': 'command',
      'validate-syntax': 'validation',
      'run-tests': 'validation',
      'check-output': 'validation'
    };
    
    return categories[this.type] || 'unknown';
  }

  /**
   * Check if action has side effects
   * @returns {boolean} Has side effects
   */
  hasSideEffects() {
    // Validation actions typically don't have side effects
    const noSideEffects = ['validate-syntax', 'check-output'];
    
    // Fix mode for validation does have side effects
    if (this.type === 'validate-syntax' && this.fix) {
      return true;
    }
    
    return !noSideEffects.includes(this.type);
  }

  /**
   * Clone the action
   * @returns {PlanAction} Cloned action
   */
  clone() {
    const data = { ...this };
    delete data.id;
    delete data.status;
    delete data.result;
    return new PlanAction(data);
  }

  /**
   * Export to JSON
   * @returns {Object} JSON representation
   */
  toJSON() {
    return { ...this };
  }

  /**
   * Create from JSON
   * @param {Object} json - JSON data
   * @returns {PlanAction} PlanAction instance
   */
  static fromJSON(json) {
    return new PlanAction(json);
  }

  /**
   * Create action from template
   * @param {string} templateName - Template name
   * @param {Object} params - Template parameters
   * @returns {PlanAction} Created action
   */
  static fromTemplate(templateName, params = {}) {
    const templates = {
      'create-index-html': {
        type: 'create-file',
        path: `${params.path}/index.html`,
        content: `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${params.title || 'App'}</title>
    <link rel="stylesheet" href="style.css">
</head>
<body>
    <div id="app"></div>
    <script src="script.js"></script>
</body>
</html>`
      },
      'create-style-css': {
        type: 'create-file',
        path: `${params.path}/style.css`,
        content: `/* Reset */
* {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
}

/* Base styles */
body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    line-height: 1.6;
    color: #333;
}

/* App container */
#app {
    max-width: 1200px;
    margin: 0 auto;
    padding: 2rem;
}`
      },
      'create-script-js': {
        type: 'create-file',
        path: `${params.path}/script.js`,
        content: `// Main application JavaScript
'use strict';

// Wait for DOM to be ready
document.addEventListener('DOMContentLoaded', () => {
    console.log('App initialized');
    
    // Your code here
});`
      }
    };
    
    const template = templates[templateName];
    if (!template) {
      throw new Error(`Unknown template: ${templateName}`);
    }
    
    return new PlanAction(template);
  }

  /**
   * Create npm init action
   * @param {string} path - Project path
   * @param {Object} packageInfo - Package information
   * @returns {PlanAction} Create file action
   */
  static createNpmInit(path, packageInfo = {}) {
    const packageJson = {
      name: packageInfo.name || 'my-project',
      version: packageInfo.version || '1.0.0',
      description: packageInfo.description || '',
      main: packageInfo.main || 'index.js',
      scripts: {
        test: 'jest',
        start: 'node index.js',
        ...packageInfo.scripts
      },
      keywords: packageInfo.keywords || [],
      author: packageInfo.author || '',
      license: packageInfo.license || 'MIT',
      dependencies: packageInfo.dependencies || {},
      devDependencies: packageInfo.devDependencies || {}
    };
    
    return new PlanAction({
      type: 'create-file',
      path: `${path}/package.json`,
      content: JSON.stringify(packageJson, null, 2)
    });
  }

  /**
   * Create git init action
   * @param {string} path - Project path
   * @returns {PlanAction} Run command action
   */
  static createGitInit(path) {
    return new PlanAction({
      type: 'run-command',
      command: 'git init',
      cwd: path
    });
  }

  /**
   * Create ESLint config action
   * @param {string} path - Project path
   * @param {Object} config - ESLint configuration
   * @returns {PlanAction} Create file action
   */
  static createEslintConfig(path, config = {}) {
    const eslintConfig = {
      env: {
        browser: config.env === 'browser' || config.env === 'both',
        node: config.env === 'node' || config.env === 'both',
        es2021: true
      },
      extends: config.extends || ['eslint:recommended'],
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module'
      },
      rules: config.rules || {}
    };
    
    return new PlanAction({
      type: 'create-file',
      path: `${path}/.eslintrc.json`,
      content: JSON.stringify(eslintConfig, null, 2)
    });
  }

  /**
   * Check if an action type is valid
   * @param {string} type - Type to check
   * @returns {boolean} Is valid
   */
  static isValidType(type) {
    return PlanAction.VALID_TYPES.includes(type);
  }
}

export { PlanAction };