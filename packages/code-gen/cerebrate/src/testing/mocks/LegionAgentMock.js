/**
 * Legion Agent Mock for Testing
 * Simulates the behavior of the Legion Agent system for testing purposes
 */
export class LegionAgentMock {
  constructor(options = {}) {
    this.config = {
      model: options.model || 'claude-3-sonnet',
      maxTokens: options.maxTokens || 4096,
      temperature: options.temperature || 0.1,
      failureRate: options.failureRate || 0.0,
      networkDelay: options.networkDelay || 0,
      ...options
    };
    
    this.connected = true;
    this.commandHistory = [];
    this.responses = new Map();
    
    // Setup default responses
    this.setupDefaultResponses();
  }
  
  /**
   * Setup default command responses
   * @private
   */
  setupDefaultResponses() {
    this.responses.set('inspect_element', (params) => ({
      success: true,
      data: {
        element: {
          tagName: 'DIV',
          id: params.selector?.replace('#', '') || 'test-element',
          className: 'test-class',
          attributes: {
            'data-test': 'value',
            'aria-label': 'Test Element'
          },
          textContent: 'Test content',
          styles: {
            backgroundColor: 'rgb(255, 255, 255)',
            padding: '10px',
            margin: '5px',
            border: '1px solid #ccc'
          },
          position: {
            top: 100,
            left: 50,
            width: 200,
            height: 100
          },
          accessibility: {
            role: 'generic',
            tabIndex: -1,
            hasAriaLabel: true
          }
        }
      }
    }));
    
    this.responses.set('analyze_javascript', (params) => ({
      success: true,
      data: {
        syntax: 'valid',
        complexity: 'low',
        issues: [
          'Unused variable detected',
          'Consider using const instead of var'
        ],
        suggestions: [
          'Use modern ES6 syntax',
          'Add error handling',
          'Consider code splitting'
        ],
        metrics: {
          lines: 25,
          functions: 3,
          cyclomaticComplexity: 2,
          maintainabilityIndex: 85
        },
        dependencies: ['lodash', 'moment'],
        securityIssues: []
      }
    }));
    
    this.responses.set('audit_accessibility', (params) => ({
      success: true,
      data: {
        score: 85,
        issues: [
          {
            type: 'missing-alt-text',
            severity: 'error',
            message: 'Image missing alt text',
            element: 'img[src="/test.jpg"]',
            recommendation: 'Add descriptive alt text'
          },
          {
            type: 'color-contrast',
            severity: 'warning',
            message: 'Low color contrast ratio',
            element: '.text-light',
            recommendation: 'Increase contrast ratio to at least 4.5:1'
          }
        ],
        recommendations: [
          'Add ARIA labels to interactive elements',
          'Ensure proper heading hierarchy',
          'Add keyboard navigation support'
        ],
        wcagLevel: 'AA',
        compliance: {
          'A': 95,
          'AA': 85,
          'AAA': 70
        }
      }
    }));
    
    this.responses.set('analyze_performance', (params) => ({
      success: true,
      data: {
        score: 72,
        metrics: {
          loadTime: 1250,
          domContentLoaded: 890,
          firstPaint: 450,
          largestContentfulPaint: 1100,
          firstInputDelay: 25
        },
        bottlenecks: [
          'Large bundle size (2.3MB)',
          'Unused CSS rules (45%)',
          'Unoptimized images (3 found)',
          'Blocking JavaScript (5 scripts)'
        ],
        recommendations: [
          'Enable gzip compression',
          'Optimize images with WebP format',
          'Remove unused CSS',
          'Implement code splitting',
          'Use lazy loading for images'
        ]
      }
    }));
  }
  
  /**
   * Execute a command
   * @param {Object} command - Command to execute
   * @returns {Promise<Object>} - Command result
   */
  async executeCommand(command) {
    // Add network delay if configured
    if (this.config.networkDelay > 0) {
      await new Promise(resolve => setTimeout(resolve, this.config.networkDelay));
    }
    
    // Record command in history
    this.commandHistory.push({
      ...command,
      timestamp: Date.now(),
      id: `cmd-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    });
    
    // Simulate failure if configured
    if (Math.random() < this.config.failureRate) {
      return this.generateErrorResponse(command);
    }
    
    // Get response handler
    const responseHandler = this.responses.get(command.name);
    
    if (!responseHandler) {
      return {
        success: false,
        error: {
          code: 'UNKNOWN_COMMAND',
          message: `Unknown command: ${command.name}`,
          details: { command: command.name }
        }
      };
    }
    
    try {
      return responseHandler(command.params || {});
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'COMMAND_EXECUTION_ERROR',
          message: error.message,
          details: { command: command.name, error: error.stack }
        }
      };
    }
  }
  
  /**
   * Generate error response
   * @param {Object} command - Failed command
   * @returns {Object} - Error response
   * @private
   */
  generateErrorResponse(command) {
    const errorTypes = [
      {
        code: 'ELEMENT_NOT_FOUND',
        message: 'Element not found',
        applicable: ['inspect_element']
      },
      {
        code: 'INVALID_SELECTOR',
        message: 'Invalid CSS selector',
        applicable: ['inspect_element', 'audit_accessibility']
      },
      {
        code: 'SYNTAX_ERROR',
        message: 'JavaScript syntax error',
        applicable: ['analyze_javascript']
      },
      {
        code: 'TIMEOUT',
        message: 'Command timed out',
        applicable: ['*']
      },
      {
        code: 'NETWORK_ERROR',
        message: 'Network connection failed',
        applicable: ['*']
      }
    ];
    
    const applicableErrors = errorTypes.filter(
      err => err.applicable.includes(command.name) || err.applicable.includes('*')
    );
    
    const selectedError = applicableErrors[Math.floor(Math.random() * applicableErrors.length)];
    
    return {
      success: false,
      error: {
        code: selectedError.code,
        message: selectedError.message,
        details: { command: command.name },
        recoverable: selectedError.code !== 'SYNTAX_ERROR',
        retryable: selectedError.code === 'TIMEOUT' || selectedError.code === 'NETWORK_ERROR'
      }
    };
  }
  
  /**
   * Check if agent is connected
   * @returns {boolean} - Connection status
   */
  isConnected() {
    return this.connected;
  }
  
  /**
   * Get agent configuration
   * @returns {Object} - Configuration
   */
  getConfiguration() {
    return { ...this.config };
  }
  
  /**
   * Set failure rate for testing
   * @param {number} rate - Failure rate (0.0 to 1.0)
   */
  setFailureRate(rate) {
    this.config.failureRate = Math.max(0, Math.min(1, rate));
  }
  
  /**
   * Set network delay for testing
   * @param {number} delay - Delay in milliseconds
   */
  setNetworkDelay(delay) {
    this.config.networkDelay = Math.max(0, delay);
  }
  
  /**
   * Get command execution history
   * @returns {Array} - Command history
   */
  getCommandHistory() {
    return [...this.commandHistory];
  }
  
  /**
   * Clear command history
   */
  clearHistory() {
    this.commandHistory = [];
  }
  
  /**
   * Add custom command response
   * @param {string} commandName - Command name
   * @param {Function} responseHandler - Response handler function
   */
  addCustomResponse(commandName, responseHandler) {
    this.responses.set(commandName, responseHandler);
  }
  
  /**
   * Simulate connection loss
   */
  disconnect() {
    this.connected = false;
  }
  
  /**
   * Simulate connection restoration
   */
  reconnect() {
    this.connected = true;
  }
  
  /**
   * Get execution statistics
   * @returns {Object} - Statistics
   */
  getStatistics() {
    const total = this.commandHistory.length;
    const commandCounts = {};
    
    this.commandHistory.forEach(cmd => {
      commandCounts[cmd.name] = (commandCounts[cmd.name] || 0) + 1;
    });
    
    return {
      totalCommands: total,
      commandBreakdown: commandCounts,
      averageDelay: this.config.networkDelay,
      failureRate: this.config.failureRate
    };
  }
  
  /**
   * Reset mock to initial state
   */
  reset() {
    this.clearHistory();
    this.connected = true;
    this.config.failureRate = 0.0;
    this.config.networkDelay = 0;
  }
}