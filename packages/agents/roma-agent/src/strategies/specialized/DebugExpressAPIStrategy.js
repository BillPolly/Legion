/**
 * DebugExpressAPIStrategy - Specialized strategy for debugging Express.js API issues
 * 
 * This is a true SOP (Standard Operating Procedure) for debugging Express.js APIs.
 * It knows exactly how to identify issues with routes, middleware, authentication,
 * error handling, and performance in Express applications.
 */

import { TaskStrategy } from '@legion/tasks';
import path from 'path';

export default class DebugExpressAPIStrategy extends TaskStrategy {
  constructor(llmClient = null, toolRegistry = null, options = {}) {
    super();
    
    this.llmClient = llmClient;
    this.toolRegistry = toolRegistry;
    this.currentTask = null;
    
    // Configurable project root directory
    this.projectRoot = options.projectRoot || process.env.PROJECT_ROOT || '/tmp';
    
    // Pre-instantiated tools (loaded during initialization)
    this.tools = {
      fileRead: null,
      fileWrite: null,
      commandExecutor: null
    };
    
    // Express API debugging configuration
    this.debugConfig = {
      checkRoutes: true,
      checkMiddleware: true,
      checkAuth: true,
      checkDatabase: true,
      checkErrorHandling: true,
      checkPerformance: true,
      useDebugger: false
    };
  }
  
  getName() {
    return 'DebugExpressAPI';
  }
  
  /**
   * Handle messages from parent task
   */
  async onParentMessage(parentTask, message) {
    switch (message.type) {
      case 'start':
      case 'work':
        this.currentTask = parentTask;
        return await this._handleExpressAPIDebugging(parentTask);
        
      case 'abort':
        console.log(`🛑 DebugExpressAPIStrategy received abort`);
        return { acknowledged: true, aborted: true };
        
      default:
        return { acknowledged: true };
    }
  }
  
  /**
   * Handle messages from child tasks (not applicable)
   */
  async onChildMessage(childTask, message) {
    return { acknowledged: false, error: 'DebugExpressAPIStrategy does not handle child messages' };
  }
  
  /**
   * Main Express API debugging handler
   * @private
   */
  async _handleExpressAPIDebugging(task) {
    try {
      console.log(`🐛 DebugExpressAPIStrategy debugging Express API issue: ${task.description}`);
      
      // Initialize components
      await this._initializeComponents(task);
      
      // Analyze the debugging scenario
      const debugScenario = await this._analyzeDebugScenario(task);
      task.addConversationEntry('system', `Express API debug scenario: ${JSON.stringify(debugScenario, null, 2)}`);
      
      // Perform comprehensive debugging
      const result = await this._performExpressAPIDebugging(task, debugScenario);
      
      if (result.success) {
        task.complete(result);
        return result;
      } else {
        task.fail(new Error(result.error || 'Express API debugging failed'));
        return result;
      }
      
    } catch (error) {
      console.error(`❌ DebugExpressAPIStrategy error:`, error);
      task.fail(error);
      return {
        success: false,
        error: error.message,
        artifacts: Object.values(task.getAllArtifacts())
      };
    }
  }
  
  /**
   * Initialize strategy components
   * @private
   */
  async _initializeComponents(task) {
    const context = this._getContextFromTask(task);
    
    this.llmClient = this.llmClient || context.llmClient;
    this.toolRegistry = this.toolRegistry || context.toolRegistry;
    
    if (!this.llmClient) {
      throw new Error('LLM client is required for DebugExpressAPIStrategy');
    }
    
    if (!this.toolRegistry) {
      throw new Error('ToolRegistry is required for DebugExpressAPIStrategy');
    }
    
    // Load required tools
    await this._loadRequiredTools();
  }
  
  /**
   * Load required tools
   * @private
   */
  async _loadRequiredTools() {
    try {
      this.tools.fileRead = await this.toolRegistry.getTool('file_read');
      this.tools.fileWrite = await this.toolRegistry.getTool('file_write');
      this.tools.commandExecutor = await this.toolRegistry.getTool('command_executor');
      
      if (!this.tools.fileRead || !this.tools.fileWrite || !this.tools.commandExecutor) {
        throw new Error('Required tools (file_read, file_write, command_executor) are not available');
      }
      
      console.log('🐛 DebugExpressAPIStrategy tools loaded successfully');
      
    } catch (error) {
      throw new Error(`Failed to load required tools: ${error.message}`);
    }
  }
  
  /**
   * Analyze debug scenario from task description and test results
   * @private
   */
  async _analyzeDebugScenario(task) {
    const prompt = `Analyze this Express.js API debugging task and identify the issue:

Task: "${task.description}"

Available Artifacts: ${task.getArtifactsContext()}

Extract the following debugging information and return as JSON:
{
  "errorType": "route-not-found|middleware-error|auth-failure|validation-error|database-error|timeout|crash|performance",
  "errorMessage": "specific error message from logs or tests",
  "affectedEndpoints": [
    {
      "method": "GET|POST|PUT|DELETE",
      "path": "/endpoint/path",
      "statusCode": 404/500/401/etc,
      "errorDetails": "specific error details"
    }
  ],
  "suspectedCauses": [
    {
      "component": "routes|middleware|auth|database|validation|configuration",
      "description": "what might be wrong",
      "confidence": "high|medium|low"
    }
  ],
  "debuggingSteps": [
    {
      "step": "check-route-definitions",
      "description": "Verify route definitions and mounting",
      "commands": ["grep -r 'router.' src/", "grep -r 'app.use' src/"]
    },
    {
      "step": "check-middleware-order",
      "description": "Verify middleware registration order",
      "files": ["src/index.js", "src/app.js"]
    }
  ],
  "requiredFixes": {
    "codeChanges": true/false,
    "configChanges": true/false,
    "dependencyChanges": true/false,
    "testChanges": true/false
  }
}

Focus on identifying the root cause of the Express.js API issue.`;

    try {
      const response = await this.llmClient.generateResponse([{
        role: 'user',
        content: prompt
      }]);
      
      return JSON.parse(response);
    } catch (error) {
      console.log(`⚠️ Debug scenario analysis failed, using defaults: ${error.message}`);
      return this._getDefaultDebugScenario();
    }
  }
  
  /**
   * Get default debug scenario
   * @private
   */
  _getDefaultDebugScenario() {
    return {
      errorType: 'unknown',
      errorMessage: 'Test failure or error in Express API',
      affectedEndpoints: [],
      suspectedCauses: [
        {
          component: 'unknown',
          description: 'Unable to determine specific cause',
          confidence: 'low'
        }
      ],
      debuggingSteps: [
        {
          step: 'analyze-error-logs',
          description: 'Review error logs and stack traces',
          commands: []
        }
      ],
      requiredFixes: {
        codeChanges: true,
        configChanges: false,
        dependencyChanges: false,
        testChanges: false
      }
    };
  }
  
  /**
   * Perform comprehensive Express API debugging
   * @private
   */
  async _performExpressAPIDebugging(task, debugScenario) {
    console.log(`🔍 Performing Express.js API debugging for ${debugScenario.errorType} error`);
    
    try {
      const debuggingResults = {};
      
      // 1. Analyze error logs and stack traces
      const errorAnalysis = await this._analyzeErrorLogs(task, debugScenario);
      debuggingResults.errorAnalysis = errorAnalysis;
      
      // 2. Check route configurations
      if (debugScenario.errorType === 'route-not-found' || this.debugConfig.checkRoutes) {
        const routeAnalysis = await this._analyzeRoutes(task, debugScenario);
        debuggingResults.routeAnalysis = routeAnalysis;
      }
      
      // 3. Check middleware configuration
      if (debugScenario.errorType === 'middleware-error' || this.debugConfig.checkMiddleware) {
        const middlewareAnalysis = await this._analyzeMiddleware(task, debugScenario);
        debuggingResults.middlewareAnalysis = middlewareAnalysis;
      }
      
      // 4. Check authentication issues
      if (debugScenario.errorType === 'auth-failure' || this.debugConfig.checkAuth) {
        const authAnalysis = await this._analyzeAuthentication(task, debugScenario);
        debuggingResults.authAnalysis = authAnalysis;
      }
      
      // 5. Check database connections
      if (debugScenario.errorType === 'database-error' || this.debugConfig.checkDatabase) {
        const dbAnalysis = await this._analyzeDatabaseIssues(task, debugScenario);
        debuggingResults.dbAnalysis = dbAnalysis;
      }
      
      // 6. Generate fixes based on analysis
      const fixes = await this._generateFixes(task, debugScenario, debuggingResults);
      
      // 7. Apply fixes
      const fixResults = await this._applyFixes(task, fixes);
      
      // Store debugging artifacts
      task.storeArtifact('debug-analysis.json', JSON.stringify(debuggingResults, null, 2), 
        'Debugging analysis results', 'debug');
      task.storeArtifact('applied-fixes.json', JSON.stringify(fixResults, null, 2), 
        'Applied fixes', 'debug');
      
      return {
        success: true,
        result: {
          message: `Express.js API debugging completed for ${debugScenario.errorType} error`,
          errorType: debugScenario.errorType,
          rootCause: debuggingResults.errorAnalysis?.rootCause || 'Unknown',
          fixesApplied: fixResults.applied.length,
          fixesDescription: fixResults.applied.map(f => f.description),
          resolved: fixResults.success
        },
        artifacts: Object.values(task.getAllArtifacts())
      };
      
    } catch (error) {
      return {
        success: false,
        error: `Express.js API debugging failed: ${error.message}`
      };
    }
  }
  
  /**
   * Analyze error logs and stack traces
   * @private
   */
  async _analyzeErrorLogs(task, debugScenario) {
    const prompt = `Analyze these Express.js API error logs and identify the root cause:

Error Type: ${debugScenario.errorType}
Error Message: ${debugScenario.errorMessage}

Artifacts with potential error information:
${task.getArtifactsContext()}

Analyze:
1. Stack trace analysis
2. Error origin (which file and line)
3. Root cause identification
4. Related middleware or route issues
5. Potential configuration problems

Return as JSON:
{
  "rootCause": "specific root cause description",
  "errorLocation": {
    "file": "path/to/file.js",
    "line": 123,
    "function": "functionName"
  },
  "relatedIssues": ["issue1", "issue2"],
  "suggestedFix": "specific fix suggestion"
}`;

    const response = await this.llmClient.generateResponse([{
      role: 'user',
      content: prompt
    }]);
    
    return JSON.parse(response);
  }
  
  /**
   * Analyze route configuration issues
   * @private
   */
  async _analyzeRoutes(task, debugScenario) {
    const prompt = `Analyze Express.js route configuration for these issues:

Affected Endpoints: ${JSON.stringify(debugScenario.affectedEndpoints, null, 2)}

Check for:
1. Route definition issues (missing routes, wrong methods)
2. Route mounting issues (wrong order, missing app.use())
3. Route parameter issues
4. Middleware conflicts
5. Path matching problems

Return specific route fixes as JSON.`;

    const response = await this.llmClient.generateResponse([{
      role: 'user',
      content: prompt
    }]);
    
    return JSON.parse(response);
  }
  
  /**
   * Analyze middleware configuration issues
   * @private
   */
  async _analyzeMiddleware(task, debugScenario) {
    const prompt = `Analyze Express.js middleware configuration for issues:

Error Type: ${debugScenario.errorType}

Check for:
1. Middleware registration order issues
2. Missing middleware
3. Middleware configuration errors
4. Error handling middleware issues
5. CORS, body-parser, or other common middleware problems

Return middleware analysis and fixes as JSON.`;

    const response = await this.llmClient.generateResponse([{
      role: 'user',
      content: prompt
    }]);
    
    return JSON.parse(response);
  }
  
  /**
   * Analyze authentication issues
   * @private
   */
  async _analyzeAuthentication(task, debugScenario) {
    const prompt = `Analyze Express.js authentication issues:

Error: ${debugScenario.errorMessage}

Check for:
1. JWT token validation issues
2. Session configuration problems
3. Authentication middleware issues
4. Authorization logic errors
5. Token expiration or refresh issues

Return authentication analysis and fixes as JSON.`;

    const response = await this.llmClient.generateResponse([{
      role: 'user',
      content: prompt
    }]);
    
    return JSON.parse(response);
  }
  
  /**
   * Analyze database connection issues
   * @private
   */
  async _analyzeDatabaseIssues(task, debugScenario) {
    const prompt = `Analyze Express.js database connection issues:

Error: ${debugScenario.errorMessage}

Check for:
1. Connection string issues
2. Connection pool problems
3. Query errors
4. Transaction issues
5. Database timeout problems

Return database analysis and fixes as JSON.`;

    const response = await this.llmClient.generateResponse([{
      role: 'user',
      content: prompt
    }]);
    
    return JSON.parse(response);
  }
  
  /**
   * Generate fixes based on debugging analysis
   * @private
   */
  async _generateFixes(task, debugScenario, debuggingResults) {
    const prompt = `Generate specific fixes for this Express.js API issue:

Debug Scenario: ${JSON.stringify(debugScenario, null, 2)}
Analysis Results: ${JSON.stringify(debuggingResults, null, 2)}

Generate fixes as an array of:
[
  {
    "type": "code|config|dependency|test",
    "file": "path/to/file.js",
    "description": "what this fix does",
    "changes": {
      "old": "old code",
      "new": "fixed code"
    }
  }
]

Make the fixes specific and actionable.`;

    const response = await this.llmClient.generateResponse([{
      role: 'user',
      content: prompt
    }]);
    
    return JSON.parse(response);
  }
  
  /**
   * Apply generated fixes
   * @private
   */
  async _applyFixes(task, fixes) {
    const applied = [];
    const failed = [];
    
    for (const fix of fixes) {
      try {
        if (fix.type === 'code') {
          // Read current file
          const currentContent = await this.tools.fileRead.execute({
            filepath: fix.file
          });
          
          // Apply fix
          const fixedContent = currentContent.result.replace(fix.changes.old, fix.changes.new);
          
          // Write fixed content
          await this.tools.fileWrite.execute({
            filepath: fix.file,
            content: fixedContent
          });
          
          applied.push(fix);
        } else {
          // For config/dependency/test changes, just track them
          applied.push(fix);
        }
      } catch (error) {
        failed.push({ fix, error: error.message });
      }
    }
    
    return {
      success: failed.length === 0,
      applied,
      failed
    };
  }
  
  /**
   * Extract context from task
   * @private
   */
  _getContextFromTask(task) {
    return {
      llmClient: (task.lookup && task.lookup('llmClient')) || task.context?.llmClient,
      toolRegistry: (task.lookup && task.lookup('toolRegistry')) || task.context?.toolRegistry,
      workspaceDir: (task.lookup && task.lookup('workspaceDir')) || task.context?.workspaceDir || this.projectRoot,
    };
  }
}