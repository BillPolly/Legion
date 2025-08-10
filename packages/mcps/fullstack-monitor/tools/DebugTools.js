/**
 * DebugTools - Debug scenario execution wrapped as MCP tools
 */

export class DebugTools {
  constructor(sessionManager) {
    this.sessionManager = sessionManager;
  }
  
  /**
   * Get tool definitions for MCP
   */
  getToolDefinitions() {
    return [
      {
        name: 'execute_debug_scenario',
        description: 'Execute a multi-step debugging scenario',
        inputSchema: {
          type: 'object',
          properties: {
            steps: {
              type: 'array',
              description: 'Array of debug steps to execute',
              items: {
                type: 'object',
                properties: {
                  action: {
                    type: 'string',
                    enum: ['navigate', 'click', 'type', 'waitFor', 'screenshot', 'evaluate'],
                    description: 'Action to perform'
                  },
                  selector: {
                    type: 'string',
                    description: 'CSS selector for element (for click, type, waitFor)'
                  },
                  url: {
                    type: 'string',
                    description: 'URL to navigate to (for navigate action)'
                  },
                  text: {
                    type: 'string',
                    description: 'Text to type (for type action)'
                  },
                  options: {
                    type: 'object',
                    description: 'Additional options for the action'
                  }
                }
              }
            },
            session_id: {
              type: 'string',
              description: 'Session ID',
              default: 'default'
            }
          },
          required: ['steps']
        }
      },
      
      {
        name: 'debug_user_flow',
        description: 'Debug a user flow described in natural language',
        inputSchema: {
          type: 'object',
          properties: {
            description: {
              type: 'string',
              description: 'Natural language description of what to debug'
            },
            url: {
              type: 'string',
              description: 'URL where the issue occurs'
            },
            session_id: {
              type: 'string',
              description: 'Session ID',
              default: 'default'
            }
          },
          required: ['description']
        }
      },
      
      {
        name: 'take_screenshot',
        description: 'Take a screenshot of the current page',
        inputSchema: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'Path to save the screenshot'
            },
            full_page: {
              type: 'boolean',
              description: 'Capture full page',
              default: false
            },
            session_id: {
              type: 'string',
              description: 'Session ID',
              default: 'default'
            }
          }
        }
      }
    ];
  }
  
  /**
   * Execute a debug tool
   */
  async execute(toolName, args) {
    switch (toolName) {
      case 'execute_debug_scenario':
        return await this.executeDebugScenario(args);
        
      case 'debug_user_flow':
        return await this.debugUserFlow(args);
        
      case 'take_screenshot':
        return await this.takeScreenshot(args);
        
      default:
        throw new Error(`Unknown tool: ${toolName}`);
    }
  }
  
  /**
   * Execute a debug scenario
   */
  async executeDebugScenario(args) {
    const { steps, session_id = 'default' } = args;
    
    try {
      const monitor = this.sessionManager.getCurrentMonitor(session_id);
      const results = await monitor.debugScenario(steps);
      
      // Format results for MCP
      const formattedResults = results.map((result, index) => ({
        step: index + 1,
        action: result.step.action,
        success: result.success,
        error: result.error,
        correlation_id: result.correlationId,
        insights: result.analysis ? result.analysis.insights : [],
        backend_logs: result.backendLogs ? result.backendLogs.length : 0,
        frontend_logs: result.frontendLogs ? result.frontendLogs.length : 0
      }));
      
      // Analyze overall success
      const successCount = results.filter(r => r.success).length;
      const failureCount = results.length - successCount;
      
      return {
        success: failureCount === 0,
        session_id,
        total_steps: results.length,
        successful_steps: successCount,
        failed_steps: failureCount,
        results: formattedResults,
        summary: this.generateScenarioSummary(results)
      };
      
    } catch (error) {
      return {
        success: false,
        error: error.message,
        stack: error.stack
      };
    }
  }
  
  /**
   * Debug a user flow from natural language
   */
  async debugUserFlow(args) {
    const { description, url, session_id = 'default' } = args;
    
    try {
      // Parse natural language into steps
      const steps = this.parseUserFlowDescription(description, url);
      
      // Execute the scenario
      const result = await this.executeDebugScenario({
        steps,
        session_id
      });
      
      // Add interpretation
      result.interpretation = this.interpretFlowResults(description, result);
      
      return result;
      
    } catch (error) {
      return {
        success: false,
        error: error.message,
        interpretation: `Failed to debug: ${description}`
      };
    }
  }
  
  /**
   * Take a screenshot
   */
  async takeScreenshot(args) {
    const { 
      path = `screenshot-${Date.now()}.png`,
      full_page = false,
      session_id = 'default'
    } = args;
    
    try {
      const monitor = this.sessionManager.getCurrentMonitor(session_id);
      
      // Get the first active page
      const browsers = monitor.activeBrowsers || new Map();
      if (browsers.size === 0) {
        throw new Error('No active browser page to screenshot');
      }
      
      const pageEntry = Array.from(browsers.values())[0];
      const page = pageEntry.page;
      
      // Take screenshot
      const screenshot = await page.screenshot({
        path,
        fullPage: full_page
      });
      
      return {
        success: true,
        session_id,
        path,
        message: `Screenshot saved to ${path}`
      };
      
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
  
  /**
   * Parse natural language description into debug steps
   */
  parseUserFlowDescription(description, url) {
    const steps = [];
    const lower = description.toLowerCase();
    
    // Navigate to URL if provided
    if (url) {
      steps.push({ action: 'navigate', url });
    }
    
    // Common patterns
    if (lower.includes('login')) {
      steps.push(
        { action: 'click', selector: '#login, .login, [href*="login"]' },
        { action: 'type', selector: '#email, #username, [name="email"]', text: 'test@example.com' },
        { action: 'type', selector: '#password, [name="password"]', text: 'password123' },
        { action: 'click', selector: '#submit, button[type="submit"], .login-button' }
      );
    }
    
    if (lower.includes('click') && lower.includes('button')) {
      const buttonText = this.extractButtonText(description);
      steps.push({ 
        action: 'click', 
        selector: `button:contains("${buttonText}"), button.${buttonText.toLowerCase()}` 
      });
    }
    
    if (lower.includes('fill') || lower.includes('type')) {
      steps.push({ 
        action: 'type', 
        selector: 'input[type="text"]:first', 
        text: 'test input' 
      });
    }
    
    if (lower.includes('submit') || lower.includes('form')) {
      steps.push({ 
        action: 'click', 
        selector: 'button[type="submit"], input[type="submit"]' 
      });
    }
    
    if (lower.includes('wait')) {
      steps.push({ 
        action: 'waitFor', 
        selector: '.content, .loaded, main' 
      });
    }
    
    // Default: take screenshot to see current state
    if (steps.length === 0 || lower.includes('screenshot') || lower.includes('see')) {
      steps.push({ 
        action: 'screenshot',
        options: { fullPage: true }
      });
    }
    
    return steps;
  }
  
  /**
   * Extract button text from description
   */
  extractButtonText(description) {
    // Look for quoted text
    const match = description.match(/"([^"]+)"|'([^']+)'/);
    if (match) {
      return match[1] || match[2];
    }
    
    // Look for common button names
    const buttons = ['submit', 'login', 'save', 'continue', 'next', 'send'];
    for (const button of buttons) {
      if (description.toLowerCase().includes(button)) {
        return button;
      }
    }
    
    return 'Submit';
  }
  
  /**
   * Generate summary of scenario results
   */
  generateScenarioSummary(results) {
    const errors = [];
    const warnings = [];
    const correlations = [];
    
    results.forEach((result, index) => {
      if (!result.success) {
        errors.push(`Step ${index + 1} (${result.step.action}) failed: ${result.error}`);
      }
      
      if (result.correlationId) {
        correlations.push(result.correlationId);
      }
      
      if (result.analysis && result.analysis.insights) {
        result.analysis.insights.forEach(insight => {
          if (insight.type === 'backend-errors' || insight.type === 'frontend-errors') {
            errors.push(`${insight.type}: ${insight.messages ? insight.messages.join(', ') : insight.count + ' errors'}`);
          } else if (insight.type === 'slow-request') {
            warnings.push(`Slow request: ${insight.message}`);
          }
        });
      }
    });
    
    return {
      errors,
      warnings,
      correlations: [...new Set(correlations)],
      recommendation: this.generateRecommendation(errors, warnings)
    };
  }
  
  /**
   * Generate recommendation based on errors and warnings
   */
  generateRecommendation(errors, warnings) {
    if (errors.length === 0 && warnings.length === 0) {
      return 'All steps completed successfully. No issues detected.';
    }
    
    if (errors.some(e => e.includes('backend-errors'))) {
      return 'Backend errors detected. Check server logs for details.';
    }
    
    if (errors.some(e => e.includes('frontend-errors'))) {
      return 'Frontend JavaScript errors detected. Check browser console.';
    }
    
    if (errors.some(e => e.includes('failed'))) {
      return 'Some steps failed to execute. Check selectors and page state.';
    }
    
    if (warnings.some(w => w.includes('Slow'))) {
      return 'Performance issues detected. Consider optimizing API responses.';
    }
    
    return 'Issues detected during scenario execution. Review the detailed results.';
  }
  
  /**
   * Interpret flow results in context of the original description
   */
  interpretFlowResults(description, result) {
    const lower = description.toLowerCase();
    
    if (!result.success) {
      if (lower.includes('login') && result.errors?.some(e => e.includes('password'))) {
        return 'Login failed. This could be due to incorrect credentials or authentication issues.';
      }
      
      if (lower.includes('click') && result.errors?.some(e => e.includes('selector'))) {
        return 'Could not find the element to click. The page structure might have changed.';
      }
      
      return `Failed to complete: ${description}. Check the detailed results for specific errors.`;
    }
    
    return `Successfully debugged: ${description}. ${result.summary?.recommendation || 'No issues found.'}`;
  }
}